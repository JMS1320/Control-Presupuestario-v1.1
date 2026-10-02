/**
 * 💰 **EL DETALLE DEL COBRO de un comprobante de venta** — A-FEAT-1228 (2026-10-02).
 *
 * Pedido del usuario, con la liquidación de enero de Genta: *«por un lado son las cuotas pactadas
 * con los montos y después cómo lo fuimos cobrando»*. Las cuotas (el plan) ya existen
 * (`plazos`, `repartirEnCuotas`). Esto es la otra mitad: **todo lo que canceló el comprobante**, cada
 * cosa con su medio y su fecha, y el control de que sume lo que el papel dice que se cobra.
 *
 * ## Los medios — y de dónde sale cada uno (nada se guarda dos veces)
 * | Medio | Fuente |
 * |---|---|
 * | `banco` — un crédito conciliado directo contra el comprobante | `msa_galicia.comprobante_venta_id` **sin** `anticipo_id` |
 * | `transferencia` / `echeq` — un pago a cuenta del cliente | `anticipos_proveedores` tipo `cobro`, vinculado |
 * | `echeq_endosado` — un echeq del cliente que se endosó a un tercero | ídem, `estado_pago = 'endosado'` |
 * | `compensacion` — una factura del cliente descontada de lo que pagó | `anticipos_facturas` de esos anticipos, contra un comprobante del mismo CUIT |
 * | `retencion` — un certificado | `msa.retenciones_recibidas` |
 *
 * 🔑 **El banco con `anticipo_id` NO se cuenta**: ese crédito ya está representado por su anticipo.
 * Contarlo dos veces es justo el error que este archivo existe para evitar.
 *
 * 🔑 **La compensación**: el cliente nos facturó algo (Genta: intereses por adelantar, FC 77393,
 * $279.174,47) y lo descontó de lo que pagó. En la base quedó como una *aplicación* del pago a cuenta
 * de $5 M a esa factura. Visto desde la venta, eso **también la cancela**: el anticipo cuenta entero
 * (entró la plata) y la factura descontada cuenta aparte. Si sólo se contara el anticipo, a la venta
 * le faltarían esos $279 mil para cerrar.
 *
 * ## El control (§ 🧮 de CLAUDE.md)
 * `esperado` = lo que el papel dice que se cobra (`cobroEsperado(...).pagoCondiciones` sin las
 * retenciones cargadas aparte — esas son LÍNEAS del detalle). Suma de las líneas − esperado = saldo.
 * Saldo 0 → ✓. Saldo positivo → falta cobrar (o falta cargar algo). Negativo → se cargó de más.
 */

export type MedioCobro = 'banco' | 'transferencia' | 'echeq' | 'echeq_endosado' | 'compensacion' | 'retencion'

export interface LineaCobro {
  medio: MedioCobro
  fecha: string | null
  monto: number
  descripcion: string
  /** Id de la fila de origen (movimiento, anticipo, aplicación, retención). */
  ref: string
}

export const ETIQUETA_MEDIO: Record<MedioCobro, string> = {
  banco: 'Transferencia (banco)',
  transferencia: 'Pago a cuenta',
  echeq: 'Echeq',
  echeq_endosado: 'Echeq endosado',
  compensacion: 'Compensación con factura del cliente',
  retencion: 'Retención',
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Los datos crudos, tal como salen de la base (ver `detalle-cobro-db.ts`). */
export interface FuentesCobro {
  movimientos: { id: string; fecha: string | null; creditos: number | string; anticipo_id?: string | null }[]
  anticipos: { id: string; fecha_pago: string | null; monto: number | string; metodo_pago?: string | null; estado_pago?: string | null; descripcion?: string | null }[]
  /** Aplicaciones de esos anticipos a comprobantes del MISMO cliente (compensaciones). */
  compensaciones: { id: string; anticipo_id: string; monto_aplicado: number | string; fecha?: string | null; comprobante: string }[]
  retenciones: { id: string; tipo: string; monto: number | string; fecha: string | null; nro_certificado?: string | null }[]
}

const TIPO_RET: Record<string, string> = { ganancias: 'Ganancias', iibb: 'IIBB', iva: 'IVA', suss: 'SUSS' }

export function lineasDeCobro(f: FuentesCobro): LineaCobro[] {
  const lineas: LineaCobro[] = []
  for (const m of f.movimientos) {
    if (m.anticipo_id) continue   // lo representa su anticipo
    lineas.push({ medio: 'banco', fecha: m.fecha, monto: Number(m.creditos) || 0, descripcion: 'Crédito en el banco', ref: m.id })
  }
  for (const a of f.anticipos) {
    const medio: MedioCobro = a.estado_pago === 'endosado' ? 'echeq_endosado' : a.metodo_pago === 'echeq' ? 'echeq' : 'transferencia'
    // Un echeq en cartera (A-FEAT-1229) ya cancela la venta: el cliente pagó; qué hace MSA con el cheque es otra cosa.
    const desc = a.estado_pago === 'en_cartera' ? `${a.descripcion || 'Echeq'} · en cartera` : (a.descripcion || ETIQUETA_MEDIO[medio])
    lineas.push({ medio, fecha: a.fecha_pago, monto: Number(a.monto) || 0, descripcion: desc, ref: a.id })
  }
  for (const c of f.compensaciones) {
    lineas.push({ medio: 'compensacion', fecha: c.fecha ?? null, monto: Number(c.monto_aplicado) || 0, descripcion: `Descontó su ${c.comprobante}`, ref: c.id })
  }
  for (const r of f.retenciones) {
    lineas.push({
      medio: 'retencion', fecha: r.fecha, monto: Number(r.monto) || 0,
      descripcion: `Ret. ${TIPO_RET[r.tipo] || r.tipo}${r.nro_certificado ? ` · cert. ${r.nro_certificado}` : ''}`, ref: r.id,
    })
  }
  // Por fecha; las que no tienen fecha, al final.
  return lineas.sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'))
}

export interface DetalleCobro {
  lineas: LineaCobro[]
  /** Lo que el papel dice que se cobra (sin descontar las retenciones cargadas aparte). */
  esperado: number
  total: number
  /** esperado − total. Positivo = falta; negativo = se cargó de más. */
  saldo: number
  cierra: boolean
  /** Subtotales por medio, para la vista. */
  porMedio: Partial<Record<MedioCobro, number>>
}

export function armarDetalleCobro(fuentes: FuentesCobro, esperado: number): DetalleCobro {
  const lineas = lineasDeCobro(fuentes)
  const total = r2(lineas.reduce((s, l) => s + l.monto, 0))
  const saldo = r2(esperado - total)
  const porMedio: Partial<Record<MedioCobro, number>> = {}
  for (const l of lineas) porMedio[l.medio] = r2((porMedio[l.medio] || 0) + l.monto)
  return { lineas, esperado: r2(esperado), total, saldo, cierra: Math.abs(saldo) < 0.01, porMedio }
}

/**
 * Las líneas que cancelan CUOTAS: TODAS, también el crédito del banco, cada una con su fecha.
 *
 * ⚠️ Cambió 2026-10-02 — hasta acá el banco quedaba afuera («concilia su cuota por sí mismo»), y eso
 * suponía **un movimiento por cuota**. Genta pagó la única cuota de enero en 5 partes: con el primer
 * crédito la cuota quedaba conciliada entera y la venta desaparecía para los otros cuatro. Ahora
 * cada cobro, del medio que sea, baja la cuota de su fecha; la cuota se da por conciliada cuando
 * llega a cero.
 */
export function imputacionesDeCobro(lineas: LineaCobro[]): { monto: number; fecha: string | null }[] {
  return lineas.map(l => ({ monto: l.monto, fecha: l.fecha }))
}
