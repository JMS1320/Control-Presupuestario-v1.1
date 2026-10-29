/**
 * 🌾 LOS SALDOS DE INSUMOS, GAS OIL Y SEMENTERAS — A-FEAT-1386 (e), JMS 2026-10-29: «armalos igual que la hacienda».
 *
 * ⚠️ cambió el mismo 29/10 — JMS: *«tenemos un dato del campo y un dato del balance… el contador se rige por la
 * forma contable… son dos datos que hay que registrar los dos… van a servir para los dos balances»*. Los dos datos
 * YA viven en la FOTO del Balance propio (`balance_foto_valores`, versiones `jms` y `contador`, A-FEAT-1190): esta
 * tabla los LEE de ahí (no guarda copia), y se cargan o corrigen en Balance propio.
 *
 * | Columna | De dónde sale |
 * |---|---|
 * | **Sistema** | el stock valuado de la app y el costo de la sementera. **Sólo al cierre**: la app guarda el stock de hoy, no su historia; al inicio va «—», nunca un cero inventado |
 * | **Campo** | la foto, versión `jms` (tu planilla: balance interno) |
 * | **Balance** | la foto, versión `contador` (la forma contable) |
 *
 * La foto del INICIO es la del cierre anterior; la del cierre, la de la fecha de cierre (si ya existe).
 * 🧮 Diferencias: Sistema − Campo y Campo − Balance (avisan, no frenan: la segunda suele ser tratamiento contable).
 */
import type { MomentoSaldo } from "@/lib/balance/tres-saldos-hacienda"

export interface RubroProductivo { clave: string; nombre: string; ambito?: string; renglones: string[] }

/** Los rubros, con el `ambito` del grupo de insumos de la app y los renglones de la foto que les corresponden. */
export const RUBROS_PRODUCTIVOS: RubroProductivo[] = [
  { clave: "insumos-agricolas", nombre: "Insumos agrícolas", ambito: "agricola", renglones: ["insumos_agricolas"] },
  { clave: "insumos-ganaderos", nombre: "Insumos ganaderos (forrajeros y veterinarios)", ambito: "ganadero", renglones: ["insumos_ganaderos"] },
  { clave: "gasoil", nombre: "Gas oil y otros", ambito: "ambos", renglones: ["insumos_otros"] },
  { clave: "sementeras", nombre: "Sementeras (agrícolas + ganaderas)", renglones: ["sementeras_agricolas", "sementeras_ganaderas"] },
]

export const RENGLONES_PRODUCTIVOS = RUBROS_PRODUCTIVOS.flatMap(r => r.renglones)

/** renglón → versión → importe, de UNA foto. */
export type ValoresFoto = Record<string, { contador?: number | null; jms?: number | null }>

export interface FilaSaldoProductivo {
  clave: string; nombre: string
  sistema: number | null; campo: number | null; balance: number | null
  /** Sistema − Campo */
  difSistema: number | null
  /** Campo − Balance */
  difBalance: number | null
}

const r2 = (n: number) => Math.round(n * 100) / 100
const resta = (a: number | null, b: number | null) => a != null && b != null ? r2(a - b) : null

/** El sistema al cierre por rubro: los grupos de insumos por ámbito y el costo de la sementera. */
export function sistemaProductivoAlCierre(
  grupos: { ambito: string; valuado: number }[], sementeras: number | null,
): Record<string, number> {
  const r: Record<string, number> = {}
  for (const rb of RUBROS_PRODUCTIVOS) {
    if (!rb.ambito) continue
    r[rb.clave] = r2(grupos.filter(g => g.ambito === rb.ambito).reduce((s, g) => s + (g.valuado || 0), 0))
  }
  if (sementeras != null) r.sementeras = r2(sementeras)
  return r
}

export function armarSaldosProductivos(
  sistema: Record<string, number> | null,
  foto: ValoresFoto | null,
): { filas: FilaSaldoProductivo[]; total: FilaSaldoProductivo } {
  const deFoto = (renglones: string[], v: "contador" | "jms") => {
    const xs = renglones.map(r => foto?.[r]?.[v]).filter((x): x is number => x != null)
    return xs.length ? r2(xs.reduce((a, b) => a + b, 0)) : null
  }
  const filas = RUBROS_PRODUCTIVOS.map(rb => {
    const s = sistema?.[rb.clave] ?? null
    const c = deFoto(rb.renglones, "jms")
    const b = deFoto(rb.renglones, "contador")
    return { clave: rb.clave, nombre: rb.nombre, sistema: s, campo: c, balance: b, difSistema: resta(s, c), difBalance: resta(c, b) }
  })
  const sum = (k: "sistema" | "campo" | "balance") => filas.some(f => f[k] != null) ? r2(filas.reduce((a, f) => a + (f[k] ?? 0), 0)) : null
  const s = sum("sistema"), c = sum("campo"), b = sum("balance")
  return { filas, total: { clave: "total", nombre: "TOTAL", sistema: s, campo: c, balance: b, difSistema: resta(s, c), difBalance: resta(c, b) } }
}

/** El día anterior a `AAAA-MM-DD` (la fecha de la foto del inicio = cierre anterior). */
export function diaAnterior(fecha: string): string {
  const d = new Date(fecha + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export type { MomentoSaldo }

/**
 * Lee de la foto del Balance propio los renglones de estos rubros (versiones jms y contador) para las fechas dadas.
 * Devuelve fecha → valores (null = esa foto todavía no existe).
 */
export async function leerFotosProductivas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, empresa: string, fechas: string[],
): Promise<{ fotos: Record<string, ValoresFoto | null>; error: string | null }> {
  const fotos: Record<string, ValoresFoto | null> = Object.fromEntries(fechas.map(f => [f, null]))
  const { data: fs, error: e1 } = await supabase.from("balance_fotos").select("id, fecha_cierre")
    .eq("empresa", empresa).in("fecha_cierre", fechas)
  if (e1) return { fotos, error: e1.message }
  if (!fs?.length) return { fotos, error: null }
  const { data: vs, error: e2 } = await supabase.from("balance_foto_valores").select("foto_id, renglon, version, importe")
    .in("foto_id", fs.map((f: { id: string }) => f.id)).in("renglon", RENGLONES_PRODUCTIVOS)
  if (e2) return { fotos, error: e2.message }
  for (const f of fs as { id: string; fecha_cierre: string }[]) {
    const val: ValoresFoto = {}
    for (const x of (vs ?? []) as { foto_id: string; renglon: string; version: string; importe: number | null }[]) {
      if (x.foto_id !== f.id || (x.version !== "jms" && x.version !== "contador")) continue
      val[x.renglon] = { ...(val[x.renglon] ?? {}), [x.version]: x.importe == null ? null : Number(x.importe) }
    }
    fotos[String(f.fecha_cierre).slice(0, 10)] = val
  }
  return { fotos, error: null }
}
