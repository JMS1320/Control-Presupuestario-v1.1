/**
 * 🔽 El valor de una cuota en cada columna de la tabla de Cuotas, para el filtro por columna tipo Excel (nota 🌙 JMS 10/11:
 * «no tiene filtros. dijimos aplicar siempre filtros verdad?»). Es lo que se ve en la celda, salvo:
 * - las FECHAS van por mes («2026-05»), como en el Extracto: una lista con cada día no sirve para filtrar;
 * - el MONTO con el formato de la app (es-AR);
 * - «Activo» como Sí / No.
 * Lo vacío lo convierte en «(vacío)» `opcionesDeColumna`.
 */

const CAMPOS_DE_LA_CUOTA = ["fecha_estimada", "fecha_vencimiento", "fecha_pago", "monto", "monto_usd", "tipo_cambio", "descripcion",
  "detalle", "estado", "created_at", "updated_at", "egreso_id"]
const FECHAS = ["fecha_estimada", "fecha_vencimiento", "fecha_pago", "created_at", "updated_at"]
const IMPORTES = ["monto", "monto_usd", "tipo_cambio"]

export function valorFiltroCuota(cuota: Record<string, any>, columna: string): string {
  let v: unknown
  if (columna === "categ") v = cuota.categ || cuota.egreso?.categ
  else if (CAMPOS_DE_LA_CUOTA.includes(columna)) v = cuota[columna]
  else v = cuota.egreso?.[columna]
  if (v == null || v === "") return ""
  if (FECHAS.includes(columna)) return String(v).slice(0, 7)
  if (IMPORTES.includes(columna)) {
    const n = Number(v)
    return isNaN(n) ? String(v) : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (typeof v === "boolean") return v ? "Sí" : "No"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}
