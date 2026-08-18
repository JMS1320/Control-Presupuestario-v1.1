// ════════════════════════════════════════════════════════════════════════════
// Control de cuadratura de un subdiario de IVA (Compras y Ventas)
//
// La identidad que tiene que cumplirse en TODO comprobante es:
//     imp_total = neto_gravado + neto_no_gravado + op_exentas + iva + otros_tributos
//
// Sumada sobre el período, eso da el control que pidió el usuario:
//     Total general − Neto − Exento/No Gravado − IVA − Otros Tributos − (bloque sin crédito) = 0
//
// El "bloque sin crédito" (Fac B y C en Compras) se resta aparte porque en el resumen
// no se abre por columnas: entra como un importe total y nada más.
//
// ⚠️ La igualdad NO da cero exacto: los emisores redondean. En MSA 07/2026 el residuo fue
// de $0,01 y venía de 4 facturas (La Mercure −0,02; Telecom, Miceli y Deheza +0,01 c/u),
// que están así en ARCA. Por eso el control tiene tolerancia y, sobre todo, por eso lista
// LOS COMPROBANTES que descuadran: el número global sirve para saber que algo pasa, la lista
// es la que sirve para arreglarlo.
// ════════════════════════════════════════════════════════════════════════════

/** Descuadre máximo que se atribuye a redondeo del emisor, por comprobante. */
export const TOLERANCIA_POR_COMPROBANTE = 0.05

/**
 * COMPRAS — tipos que NO generan crédito fiscal: Fac B (6/7/8) y Fac C (11/12/13).
 * Salen del Libro IVA Compras y van al bloque 2, sin abrir columnas.
 * Decidido con el usuario el 2026-07-15 (antes el bloque 1 sólo excluía el tipo 11, lo que
 * dejaba ND C y NC C contadas dos veces). Vive acá para que el resumen en pantalla, el
 * Excel, el PDF y este control clasifiquen con la MISMA lista.
 */
export const TIPOS_SIN_CREDITO_COMPRAS = [6, 7, 8, 11, 12, 13]

/**
 * VENTAS — sólo los comprobantes C (11/12/13).
 * NO se copia la lista de Compras: una Fac B recibida no da crédito fiscal, pero una Fac B
 * EMITIDA sí genera débito y tiene que quedar dentro del Libro IVA Ventas.
 * ⚠️ Lista a confirmar con el usuario. Hoy no afecta ningún dato: `comprobantes_venta` sólo
 * tiene tipos 1, 201 y 332 (verificado 2026-08-13), ninguno C.
 */
export const TIPOS_SIN_CREDITO_VENTAS = [11, 12, 13]

export interface FilaSubdiario {
  id?: string
  tipo_comprobante?: number | null
  /** Compras: las facturas en USD se llevan a pesos con este TC. Ventas no lo usa. */
  tipo_cambio?: number | null
  imp_neto_gravado?: number | string | null
  imp_neto_no_gravado?: number | string | null
  imp_op_exentas?: number | string | null
  /** Sólo Compras: `comprobantes_venta` no tiene esta columna. */
  otros_tributos?: number | string | null
  iva?: number | string | null
  imp_total?: number | string | null
  // Para poder identificar la fila en el detalle de descuadres
  fecha_emision?: string | null
  fecha_liquidacion?: string | null
  denominacion_emisor?: string | null
  denominacion_cliente?: string | null
  punto_venta?: number | null
  numero_desde?: number | null
}

export interface Descuadre {
  id?: string
  fecha: string
  nombre: string
  comprobante: string
  imp_total: number
  suma_partes: number
  diferencia: number
}

export interface ResultadoCuadratura {
  cantidad: number
  totalGeneral: number
  netoGravado: number
  exentoNoGravado: number
  iva: number
  otrosTributos: number
  sinCredito: number
  /** Total general − las partes. Cero (o dentro de tolerancia) = cuadra. */
  diferencia: number
  tolerancia: number
  ok: boolean
  /** true si cuadra pero con residuo: hay descuadres individuales de redondeo. */
  soloRedondeo: boolean
  descuadres: Descuadre[]
}

const n = (v: number | string | null | undefined): number => {
  const x = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(x as number) ? (x as number) : 0
}

/** El TC vale 1 si no está cargado o es 0 — igual criterio que `calcularSubtotalesSubdiario`. */
const tcDe = (f: FilaSubdiario): number => n(f.tipo_cambio) || 1

/**
 * @param filas             comprobantes del período (ya filtrados por mes/año)
 * @param tiposSinCredito   códigos que van al bloque "no generan crédito fiscal" y por lo
 *                          tanto se restan como importe total, sin abrir columnas.
 *                          Compras: [6,7,8,11,12,13]. Ventas: ver MODULO / decisión abierta.
 * @param usarTipoCambio    Compras convierte USD→$ con `tipo_cambio`; Ventas ya guarda en pesos.
 */
export function verificarCuadratura(
  filas: FilaSubdiario[],
  tiposSinCredito: number[],
  usarTipoCambio = true,
): ResultadoCuadratura {
  const esSinCredito = (f: FilaSubdiario) =>
    f.tipo_comprobante != null && tiposSinCredito.includes(Number(f.tipo_comprobante))

  let totalGeneral = 0
  let netoGravado = 0
  let exentoNoGravado = 0
  let iva = 0
  let otrosTributos = 0
  let sinCredito = 0
  const descuadres: Descuadre[] = []

  for (const f of filas) {
    const tc = usarTipoCambio ? tcDe(f) : 1
    const total = n(f.imp_total) * tc
    totalGeneral += total

    if (esSinCredito(f)) {
      sinCredito += total
    } else {
      const ng = n(f.imp_neto_gravado) * tc
      const eng = (n(f.imp_neto_no_gravado) + n(f.imp_op_exentas)) * tc
      const i = n(f.iva) * tc
      const ot = n(f.otros_tributos) * tc
      netoGravado += ng
      exentoNoGravado += eng
      iva += i
      otrosTributos += ot

      // Descuadre de esta fila en particular — lo que hace accionable el control
      const partes = ng + eng + i + ot
      const dif = total - partes
      if (Math.abs(dif) > TOLERANCIA_POR_COMPROBANTE) {
        descuadres.push({
          id: f.id,
          fecha: f.fecha_emision || f.fecha_liquidacion || '',
          nombre: f.denominacion_emisor || f.denominacion_cliente || '(sin nombre)',
          comprobante: [f.tipo_comprobante, f.punto_venta, f.numero_desde]
            .filter(v => v != null)
            .join('-') || '—',
          imp_total: total,
          suma_partes: partes,
          diferencia: dif,
        })
      }
    }
  }

  const diferencia = totalGeneral - netoGravado - exentoNoGravado - iva - otrosTributos - sinCredito
  // El redondeo se acumula por comprobante, así que la tolerancia escala con la cantidad.
  const tolerancia = Math.max(TOLERANCIA_POR_COMPROBANTE, TOLERANCIA_POR_COMPROBANTE * filas.length)
  const ok = Math.abs(diferencia) <= tolerancia

  descuadres.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))

  return {
    cantidad: filas.length,
    totalGeneral,
    netoGravado,
    exentoNoGravado,
    iva,
    otrosTributos,
    sinCredito,
    diferencia,
    tolerancia,
    ok,
    soloRedondeo: ok && Math.abs(diferencia) > 0.005,
    descuadres,
  }
}
