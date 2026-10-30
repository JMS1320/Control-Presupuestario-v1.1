/**
 * 🧾 **A-BUG-1432 — al importar ventas, reconocer las que YA están cargadas aunque no coincida el número.**
 *
 * Nota de JMS 30/10: *«¿está preparado el aviso para vincular en la importación contra ventas ya
 * precargadas?»*. No lo estaba: el importador sólo reconocía una venta repetida por tipo + punto de venta +
 * número + CUIT. Una venta cargada a mano con **otro tipo** (liquidación de hacienda 60 vs. 180 de ARCA,
 * CEG 332 vs. 33) o **sin punto de venta ni número** (Pedro Genta 11-75880, A-BUG-1413) no coincidía, y
 * el archivo de ARCA la habría metido **otra vez**.
 *
 * 🔑 Segundo cruce, más flojo: mismo cliente (CUIT) y mismo total (al peso), con fecha a menos de
 * `diasTolerancia` días. Eso no se importa solo: queda como **«posible ya cargada»** y el usuario decide.
 * § 🚦 avisa y deja seguir — puede ser una venta distinta por el mismo importe.
 */

export interface VentaParaCruce {
  tipo_comprobante: number | null
  punto_venta: number | null
  numero_desde: number | null
  cuit_cliente: string | null
  imp_total: number | null
  fecha_liquidacion: string | null
}

export interface VentaExistente extends VentaParaCruce {
  id: string
  nro_comprobante?: string | null
}

export type EstadoCruce =
  | { estado: "nueva" }
  | { estado: "duplicada" }
  | { estado: "posible"; existente: VentaExistente }

const clave = (v: VentaParaCruce) => `${v.tipo_comprobante}|${v.punto_venta}|${v.numero_desde}|${v.cuit_cliente}`
const dias = (a: string | null, b: string | null) =>
  a && b ? Math.abs(Date.parse(a) - Date.parse(b)) / 86400000 : Infinity

export function cruzarVentasImportadas(nuevas: VentaParaCruce[], existentes: VentaExistente[], diasTolerancia = 45): EstadoCruce[] {
  const exactas = new Set(existentes.map(clave))
  // Una existente sólo puede «absorber» una nueva: si no, dos ventas iguales del archivo apuntarían a la misma.
  // Y la que ya coincide exacto con alguna del archivo tampoco puede ser candidata de otra.
  const clavesNuevas = new Set(nuevas.map(clave))
  const usadas = new Set<string>(existentes.filter(e => clavesNuevas.has(clave(e))).map(e => e.id))
  return nuevas.map(n => {
    if (exactas.has(clave(n))) return { estado: "duplicada" as const }
    const cand = existentes
      .filter(e => !usadas.has(e.id)
        && (e.cuit_cliente ?? "") === (n.cuit_cliente ?? "") && !!n.cuit_cliente
        && Math.abs(Math.abs(Number(e.imp_total) || 0) - Math.abs(Number(n.imp_total) || 0)) < 1
        && dias(e.fecha_liquidacion, n.fecha_liquidacion) <= diasTolerancia)
      .sort((a, b) => dias(a.fecha_liquidacion, n.fecha_liquidacion) - dias(b.fecha_liquidacion, n.fecha_liquidacion))[0]
    if (cand) { usadas.add(cand.id); return { estado: "posible" as const, existente: cand } }
    return { estado: "nueva" as const }
  })
}

/** La clave de una venta del archivo, para que la pantalla y el servidor hablen de la misma fila. */
export const claveVenta = clave
