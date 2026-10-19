/**
 * 🔎 **Filtros del Cash Flow: tipo de comprobante, número, y ventana hacia atrás.**
 *
 * - **A-FEAT-170** (usuario 2026-09-23): *«con tener un filtro por tipo de comprobante, y hasta escribir
 *   el nro ya que estamos cuando uno quiere buscar algo muy puntual»*. Es lo último que le faltaba al
 *   Cash Flow para reemplazar a la Vista de Pagos (que tenía un filtro de sólo notas de crédito).
 * - **A-FEAT-1237** (nota 2026-09-09): *«chip para ver desde hace x semanas atrás en el tiempo: se puede
 *   elegir Mes o Semana y 1, 2 o 3»*.
 *
 * Lógica pura, probada en `lib/pruebas/casos.ts`.
 */
import { abreviaturaComprobante } from "./notas-credito"

const LETRA: Record<string, number[]> = {
  A: [1, 2, 3, 4, 5, 201, 202, 203],
  B: [6, 7, 8, 9, 10, 206, 207, 208],
  C: [11, 12, 13, 15, 211, 212, 213],
  M: [51, 52, 53, 54],
}

/** Cómo se llama el tipo de comprobante de una fila en el chip: «FC A», «NC C», «Liquidación»… */
export function etiquetaTipoComprobante(f: { origen: string; tipo_comprobante?: number | null; facturas_agrupadas?: number }): string {
  const t = f.tipo_comprobante == null ? null : Number(f.tipo_comprobante)
  if (f.origen === "VENTA") return t != null && t >= 60 && t <= 64 ? "Liquidación" : "Venta"
  if (f.origen !== "ARCA") return "Sin comprobante"
  if (t == null) return (f.facturas_agrupadas ?? 0) > 1 ? "Grupo (tipos mezclados)" : "Sin tipo"
  const letra = Object.entries(LETRA).find(([, cods]) => cods.includes(t))?.[0]
  return letra ? `${abreviaturaComprobante(t)} ${letra}` : `Tipo ${t}`
}

export type UnidadVentana = "semana" | "mes"

/** El primer día que se muestra con la ventana «desde hace N semanas/meses». `hoy` en ISO. */
export function desdeVentana(hoy: string, unidad: UnidadVentana, n: number): string {
  const [a, m, d] = hoy.split("-").map(Number)
  const f = unidad === "semana" ? new Date(Date.UTC(a, m - 1, d - 7 * n)) : new Date(Date.UTC(a, m - 1 - n, d))
  return f.toISOString().slice(0, 10)
}

/** ¿La fila entra en la ventana? Una fila sin fecha se muestra siempre (no se esconde en silencio). */
export function pasaVentana(fecha: string | null | undefined, desde: string | null): boolean {
  if (!desde || !fecha) return true
  return fecha.slice(0, 10) >= desde
}

/**
 * ¿La búsqueda es un número de comprobante de esta fila? Compara sólo los dígitos, así «12842»,
 * «00012842» y «0001-00012842» encuentran lo mismo.
 */
export function coincideNumeroComprobante(
  f: { comprobante_display?: string | null; numero_desde?: number | null; punto_venta?: number | null },
  busqueda: string,
): boolean {
  const q = busqueda.replace(/\D/g, "").replace(/^0+/, "")
  if (q.length < 3) return false
  const textos = [
    String(f.comprobante_display ?? ""),
    f.numero_desde != null ? String(f.numero_desde) : "",
    f.punto_venta != null && f.numero_desde != null ? `${f.punto_venta}${String(f.numero_desde).padStart(8, "0")}` : "",
  ]
  return textos.some(t => t.replace(/\D/g, "").replace(/^0+/, "").includes(q) || t.replace(/\D/g, "").includes(q))
}
