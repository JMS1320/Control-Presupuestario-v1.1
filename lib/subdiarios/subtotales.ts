// ════════════════════════════════════════════════════════════════════════════
// Resumen del subdiario en 2 bloques — Compras y Ventas.
//
//  Bloque 1 (`libro`)      : los que SÍ van al Libro IVA. Abre columnas
//                            (neto gravado / exento-no gravado / IVA / otros tributos / total),
//                            con filas Facturas · Notas de Crédito · Total Neto (FC − NC).
//  Bloque 2 (`sinCredito`) : los que NO. Sólo importe total, sin abrir columnas —
//                            que es lo que pide ARCA: en el Libro de Compras, para comprobantes
//                            B o C se informa 0 en "cantidad de alícuotas".
//
// Vive en un lib para que pantalla, Excel y PDF usen la MISMA función y sea imposible
// desincronizarlos. En Compras eso se resolvió el 2026-07-15; Ventas tenía tres copias del
// cálculo (una en la pantalla, otra en el Excel, otra en el PDF) y por eso se trajo acá.
//
// La lista de tipos del bloque 2 es un parámetro, NO una constante compartida: en Compras
// incluye Fac B (una Fac B recibida no da crédito fiscal) y en Ventas no puede incluirla
// (una Fac B emitida sí genera débito). Ver TIPOS_SIN_CREDITO_* en ./cuadratura.
// ════════════════════════════════════════════════════════════════════════════

import type { FilaSubdiario } from './cuadratura'

export interface BloqueColumnas {
  imp_total: number
  iva: number
  imp_neto_gravado: number
  exento_no_gravado: number
  otros_tributos: number
}

export interface SubtotalesSubdiario {
  /** Bloque 1 — el Libro IVA propiamente dicho. */
  libro: {
    fc: BloqueColumnas & { cantidad: number }
    nc: BloqueColumnas & { cantidad: number }
    neto: BloqueColumnas
  }
  /** Bloque 2 — los que no generan crédito/débito fiscal, sólo por importe total. */
  sinCredito: {
    fc: { total: number; cantidad: number }
    nc: { total: number; cantidad: number }
    neto: number
  }

  // ── Alias de compatibilidad ──────────────────────────────────────────────
  // `vista-facturas-arca.tsx` (12k líneas) referencia `.ivaCompras` / `.monotributo` en ~20
  // lugares sobre un estado tipado `any`: renombrarlos a mano NO lo verificaría el compilador.
  // Se mantienen apuntando al mismo objeto. Al tocar esa vista, migrar a `libro`/`sinCredito`.
  /** @deprecated usar `libro` */
  ivaCompras: SubtotalesSubdiario['libro']
  /** @deprecated usar `sinCredito` */
  monotributo: SubtotalesSubdiario['sinCredito']
  /** @deprecated resto del formato viejo, aún leído por el Excel de Compras */
  facturas_c: number
  /** @deprecated */
  cantidad_facturas_c: number
}

const n = (v: any): number => {
  const x = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(x) ? x : 0
}

export function calcularSubtotalesSubdiario(
  filas: FilaSubdiario[],
  tiposSinCredito: number[],
  usarTipoCambio = true,
): SubtotalesSubdiario {
  /** Las facturas en USD se llevan a pesos. TC ausente o 0 vale 1. */
  const tcDe = (f: FilaSubdiario) => (usarTipoCambio ? n(f.tipo_cambio) || 1 : 1)

  const sumarBloque = (lista: FilaSubdiario[], abs: boolean): BloqueColumnas =>
    lista.reduce<BloqueColumnas>((acc, f) => {
      const tc = tcDe(f)
      const sgn = (v: number) => (abs ? Math.abs(v) : v)
      acc.imp_total += sgn(n(f.imp_total)) * tc
      acc.iva += sgn(n(f.iva)) * tc
      acc.imp_neto_gravado += sgn(n(f.imp_neto_gravado)) * tc
      acc.exento_no_gravado += sgn(n(f.imp_neto_no_gravado) + n(f.imp_op_exentas)) * tc
      acc.otros_tributos += sgn(n(f.otros_tributos)) * tc
      return acc
    }, { imp_total: 0, iva: 0, imp_neto_gravado: 0, exento_no_gravado: 0, otros_tributos: 0 })

  const esSinCredito = (f: FilaSubdiario) =>
    f.tipo_comprobante != null && tiposSinCredito.includes(Number(f.tipo_comprobante))

  // Bloque 1 — con crédito/débito fiscal
  const conCredito = filas.filter(f => !esSinCredito(f))
  const fcList = conCredito.filter(f => n(f.imp_total) >= 0)
  const ncList = conCredito.filter(f => n(f.imp_total) < 0)
  const sumFC = sumarBloque(fcList, false)
  const sumNC = sumarBloque(ncList, true)   // las NC se muestran en positivo y se RESTAN
  const sumNeto: BloqueColumnas = {
    imp_total: sumFC.imp_total - sumNC.imp_total,
    iva: sumFC.iva - sumNC.iva,
    imp_neto_gravado: sumFC.imp_neto_gravado - sumNC.imp_neto_gravado,
    exento_no_gravado: sumFC.exento_no_gravado - sumNC.exento_no_gravado,
    otros_tributos: sumFC.otros_tributos - sumNC.otros_tributos,
  }

  // Bloque 2 — sin crédito/débito fiscal
  const sinCred = filas.filter(esSinCredito)
  const sinCredComprob = sinCred.filter(f => n(f.imp_total) >= 0)
  const sinCredNC = sinCred.filter(f => n(f.imp_total) < 0)
  const totalComprob = sinCredComprob.reduce((s, f) => s + n(f.imp_total) * tcDe(f), 0)
  const totalNC = sinCredNC.reduce((s, f) => s + Math.abs(n(f.imp_total)) * tcDe(f), 0)

  const libro = {
    fc: { ...sumFC, cantidad: fcList.length },
    nc: { ...sumNC, cantidad: ncList.length },
    neto: sumNeto,
  }
  const sinCredito = {
    fc: { total: totalComprob, cantidad: sinCredComprob.length },
    nc: { total: totalNC, cantidad: sinCredNC.length },
    neto: totalComprob - totalNC,
  }

  return {
    libro,
    sinCredito,
    ivaCompras: libro,
    monotributo: sinCredito,
    facturas_c: totalComprob,
    cantidad_facturas_c: sinCredComprob.length,
  }
}

/**
 * Desglose por alícuota, para el "Detalle por Alícuotas" que exige el Libro IVA.
 *
 * Dos orígenes distintos según la tabla:
 *  - **Compras** (`comprobantes_arca`) tiene columnas por tasa (`iva_21`, `neto_grav_iva_21`, …)
 *    → se suman directo. Es el camino fiel a ARCA, que lleva una fila por alícuota.
 *  - **Ventas** (`comprobantes_venta`) NO las tiene: guarda un único par `alicuota_iva` + `iva`
 *    por comprobante → hay que agrupar. Un comprobante sin `alicuota_iva` (operación exenta)
 *    no entra en ninguna banda: su importe ya está contado en Exento/No Gravado.
 */
export interface FilaAlicuota { alicuota: number; neto: number; iva: number }

export function desglosePorAlicuotaVentas(
  filas: FilaSubdiario[],
  tiposSinCredito: number[],
): FilaAlicuota[] {
  const porTasa = new Map<number, { neto: number; iva: number }>()
  for (const f of filas) {
    if (f.tipo_comprobante != null && tiposSinCredito.includes(Number(f.tipo_comprobante))) continue
    const alic = (f as any).alicuota_iva
    if (alic == null) continue
    const tasa = Number(alic)
    const cur = porTasa.get(tasa) || { neto: 0, iva: 0 }
    // Los importes ya vienen con signo desde la BD (las NC se guardan en negativo),
    // así que sumar directo deja el neto de la banda con el signo correcto.
    cur.neto += n(f.imp_neto_gravado)
    cur.iva += n(f.iva)
    porTasa.set(tasa, cur)
  }
  return Array.from(porTasa.entries())
    .map(([alicuota, v]) => ({ alicuota, ...v }))
    .sort((a, b) => a.alicuota - b.alicuota)
}
