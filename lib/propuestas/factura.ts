/**
 * 🔓 **Propuestas de cambio sobre una factura** — A-FEAT-1400 (JMS 28/10: «le marco a Ulises un flag rojo y le
 * dejo habilitada esa factura… él la modifica y la confirma; eso queda pendiente de mi confirmación»).
 * Lógica pura, probada en `lib/pruebas/casos.ts`. La tabla es `public.propuestas_cambio` (script 123).
 */
import { parseNumeroAR } from "@/lib/format/numero"

export type TipoCampo = "texto" | "monto" | "fecha" | "entero"
export const CAMPOS_PROPONIBLES: { campo: string; etiqueta: string; tipo: TipoCampo }[] = [
  { campo: "fecha_emision", etiqueta: "Fecha", tipo: "fecha" },
  { campo: "tipo_comprobante", etiqueta: "Tipo de comprobante (código)", tipo: "entero" },
  { campo: "punto_venta", etiqueta: "Punto de venta", tipo: "entero" },
  { campo: "numero_desde", etiqueta: "Número", tipo: "entero" },
  { campo: "cuit", etiqueta: "CUIT", tipo: "texto" },
  { campo: "denominacion_emisor", etiqueta: "Proveedor", tipo: "texto" },
  { campo: "imp_neto_gravado", etiqueta: "Neto gravado", tipo: "monto" },
  { campo: "imp_neto_no_gravado", etiqueta: "Neto no gravado", tipo: "monto" },
  { campo: "imp_op_exentas", etiqueta: "Exento", tipo: "monto" },
  { campo: "iva", etiqueta: "IVA", tipo: "monto" },
  { campo: "otros_tributos", etiqueta: "Otros tributos", tipo: "monto" },
  { campo: "imp_total", etiqueta: "Total", tipo: "monto" },
  { campo: "cuenta_contable", etiqueta: "Cuenta contable", tipo: "texto" },
  { campo: "centro_costo", etiqueta: "Centro de costo", tipo: "texto" },
  { campo: "detalle", etiqueta: "Detalle", tipo: "texto" },
]

/**
 * ¿Se puede habilitar? Sólo las que NO vienen de ARCA (JMS: «las efectivamente cargadas por API no le doy nunca
 * la habilitación rápida, sólo las que entraron por Excel»; 28/10: «las que importo directo de ARCA es clarísimo
 * para la app; el resto son las editables»). ARCA = `origen_factura = 'ARCA'` o archivo «Mis Comprobantes…» / «arca-…».
 * (Sin ningún dato de origen, por las dudas, no — hoy no hay ninguna así.)
 */
export function esHabilitable(archivoOrigen: string | null | undefined, origenFactura?: string | null): boolean {
  if (String(origenFactura ?? "").trim().toUpperCase() === "ARCA") return false
  const o = String(archivoOrigen ?? "").trim()
  if (!o) return false
  return !/^mis comprobantes/i.test(o) && !/^arca-/i.test(o)
}

/** El valor de un campo como lo guarda la base (montos y enteros a número, textos recortados, vacío = null). */
export function normalizar(tipo: TipoCampo, v: unknown): string | number | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === "") return null
  if (tipo === "monto") return typeof v === "number" ? v : parseNumeroAR(s)
  if (tipo === "entero") { const n = parseInt(s, 10); return Number.isFinite(n) ? n : null }
  if (tipo === "fecha") return s.slice(0, 10)
  return s
}

/** Sólo lo que cambió: `antes` (lo que tiene la factura) y `cambios` (lo nuevo), campo por campo. */
export function diferencias(original: Record<string, unknown>, editado: Record<string, unknown>) {
  const antes: Record<string, unknown> = {}
  const cambios: Record<string, unknown> = {}
  for (const { campo, tipo } of CAMPOS_PROPONIBLES) {
    if (!(campo in editado)) continue
    const a = normalizar(tipo, original[campo])
    const b = normalizar(tipo, editado[campo])
    const iguales = tipo === "monto" && typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 0.005 : a === b
    if (!iguales) { antes[campo] = a; cambios[campo] = b }
  }
  return { antes, cambios, hayCambios: Object.keys(cambios).length > 0 }
}

/** Cómo se ve la habilitación hoy: una habilitada con el plazo vencido se trata como vencida. */
export function estadoVisible(p: { estado: string; vence_at: string | null }, ahora = new Date()): string {
  if (p.estado === "habilitada" && p.vence_at && new Date(p.vence_at) <= ahora) return "vencida"
  return p.estado
}
