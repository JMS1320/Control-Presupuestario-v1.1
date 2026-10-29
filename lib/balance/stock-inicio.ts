/**
 * 📦 EL STOCK DECLARADO AL INICIO y LAS PASTURAS — A-FEAT-1420 (JMS 29/10).
 *
 * `productivo.stock_inicio` guarda, producto por producto y en sus unidades, el stock DECLARADO a una fecha (el
 * inicio del ejercicio): no es un movimiento, así que no toca la existencia de la app (que sale de los movimientos
 * desde el 17/02/2026). Cada renglón dice de dónde salió (`fuente`) y si se emparejó con un producto de la app.
 * `productivo.pasturas` guarda las pasturas por año de siembra; su valor se amortiza por antigüedad.
 * Pura: se le pasa lo leído.
 */

export interface RenglonStockInicio {
  rubro: "insumo" | "forraje" | "combustible"
  producto_planilla: string
  categoria_planilla: string | null
  /** el producto de la app con el que se emparejó (nombre), si hay */
  producto_app?: string | null
  cantidad: number | null
  unidad: string | null
  precio_unitario: number | null
  moneda: "ARS" | "USD"
  valor_pesos: number | null
  emparejado: "mismo" | "a confirmar" | "nuevo" | null
  version: "jms" | "contador"
  fuente: string
  nota: string | null
}

export interface GrupoStockInicio { grupo: string; renglones: RenglonStockInicio[]; valor: number; sinValor: number }

const r2 = (n: number) => Math.round(n * 100) / 100

/** El nombre del grupo: forrajes y combustible aparte; los insumos por la categoría de la planilla. */
export function grupoDe(r: RenglonStockInicio): string {
  if (r.rubro === "forraje") return "Forrajes"
  if (r.rubro === "combustible") return "Combustible"
  return r.categoria_planilla?.trim() || "Insumos"
}

export function agruparStockInicio(renglones: RenglonStockInicio[]): { grupos: GrupoStockInicio[]; total: number; aConfirmar: number; sinValor: number } {
  const m = new Map<string, RenglonStockInicio[]>()
  for (const r of renglones) { const g = grupoDe(r); m.set(g, [...(m.get(g) ?? []), r]) }
  const grupos = [...m.entries()].map(([grupo, rs]) => ({
    grupo, renglones: rs,
    valor: r2(rs.reduce((s, r) => s + (r.valor_pesos ?? 0), 0)),
    sinValor: rs.filter(r => r.valor_pesos == null).length,
  }))
  return {
    grupos,
    total: r2(grupos.reduce((s, g) => s + g.valor, 0)),
    aConfirmar: renglones.filter(r => r.emparejado === "a confirmar").length,
    sinValor: renglones.filter(r => r.valor_pesos == null).length,
  }
}

export interface Pastura {
  lotes: string; anio_siembra: number; hectareas: number; usd_por_ha: number | null
  vida_util_anios: number; baja_fecha: string | null; baja_motivo: string | null; fuente: string; nota: string | null
}

export interface PasturaValuada extends Pastura {
  valorInicialUsd: number | null
  /** años desde la siembra a la fecha (año de la fecha − año de siembra) */
  anios: number
  /** 0 a 1 */
  amortizado: number
  valorActualUsd: number | null
  dadaDeBaja: boolean
}

/**
 * Valúa una pastura a una fecha: amortiza 1/vida útil por año desde la siembra (JMS: 25 % por año), y si se dio de
 * baja hasta esa fecha vale 0. Ej.: sembrada en 2023, al 30/06/2025 = 2 años = 50 %.
 */
export function valuarPastura(p: Pastura, fecha: string): PasturaValuada {
  const anioFecha = Number(fecha.slice(0, 4))
  const anios = Math.max(0, anioFecha - p.anio_siembra)
  const dadaDeBaja = !!p.baja_fecha && p.baja_fecha <= fecha
  const amortizado = dadaDeBaja ? 1 : Math.min(1, anios / Math.max(1, p.vida_util_anios))
  const valorInicialUsd = p.usd_por_ha == null ? null : r2(p.hectareas * p.usd_por_ha)
  return { ...p, valorInicialUsd, anios, amortizado, dadaDeBaja,
    valorActualUsd: valorInicialUsd == null ? null : r2(valorInicialUsd * (1 - amortizado)) }
}

/** Lee el stock declarado a una fecha y las pasturas de la empresa. Errores → avisos, nunca un cero inventado. */
export async function leerStockInicio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, empresa: string, fecha: string,
): Promise<{ renglones: RenglonStockInicio[]; pasturas: Pastura[]; avisos: string[] }> {
  const avisos: string[] = []
  const p = supabase.schema("productivo")
  const [si, pa] = await Promise.all([
    p.from("stock_inicio").select("*, producto:stock_insumos(producto)").eq("empresa", empresa).eq("fecha", fecha).order("created_at"),
    p.from("pasturas").select("*").eq("empresa", empresa).order("anio_siembra"),
  ])
  if (si.error) avisos.push("No se pudo leer el stock al inicio: " + si.error.message)
  if (pa.error) avisos.push("No se pudieron leer las pasturas: " + pa.error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renglones = ((si.data ?? []) as any[]).map(x => ({
    rubro: x.rubro, producto_planilla: x.producto_planilla, categoria_planilla: x.categoria_planilla,
    producto_app: x.producto?.producto ?? null,
    cantidad: x.cantidad == null ? null : Number(x.cantidad), unidad: x.unidad,
    precio_unitario: x.precio_unitario == null ? null : Number(x.precio_unitario), moneda: x.moneda,
    valor_pesos: x.valor_pesos == null ? null : Number(x.valor_pesos), emparejado: x.emparejado,
    version: x.version, fuente: x.fuente, nota: x.nota,
  })) as RenglonStockInicio[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pasturas = ((pa.data ?? []) as any[]).map(x => ({
    lotes: x.lotes, anio_siembra: Number(x.anio_siembra), hectareas: Number(x.hectareas),
    usd_por_ha: x.usd_por_ha == null ? null : Number(x.usd_por_ha), vida_util_anios: Number(x.vida_util_anios),
    baja_fecha: x.baja_fecha, baja_motivo: x.baja_motivo, fuente: x.fuente, nota: x.nota,
  })) as Pastura[]
  return { renglones, pasturas, avisos }
}
