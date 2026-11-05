/**
 * 🐄 **Hacienda valorizada al inicio y al cierre — con el MISMO cálculo de la app** (A-FEAT-1541, sólo lectura).
 *
 * JMS 05/11: *«el valorizado ya lo calcula la app, sólo meterlo acá… esta vez vamos a usar lo mismo para valorizar el inicio y
 * también tomar el dato que se registró en mis papeles al inicio de 2025; tendríamos 2 valores de inicio y el de la DDJJ = 3»*.
 *
 * Usa `valuarHacienda` + `CRITERIOS` + la búsqueda del precio por categoría hacia atrás (`sumarDia`), igual que la pantalla.
 * Cierre: existencia de la app al 30/06/26 y kilos de las pesadas proyectadas. Inicio: existencia al 30/06/25 y los kilos de
 * los papeles de JMS (CUT 450 · vaquillonas 250 · novillitos 250). Escribe `datos/hacienda-valorizada.json`.
 *
 *   npx tsx scripts/excel-hacienda-valorizada.mts
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { valuarHacienda, precioDeCriterio, CRITERIOS, type PrecioMag, type PrecioMercado, type PrecioCabeza, type ExistenciaHacienda, type CriterioValuacion } from "../lib/balance/hacienda-stock"
import { pesosAlCierre, pesoParaValuar, type PesoCategoria } from "../lib/balance/pesos-hacienda"
import { cantidadConSigno } from "../lib/balance/cuadre-hacienda"
import { diasHaciaAtras, sumarDia } from "../lib/balance/precio-al-cierre"
import { GET as getMag } from "../app/api/precios-mag/route"
import { GET as getCabeza } from "../app/api/precios-por-cabeza/route"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const json = async (r: Response) => { try { return await r.json() } catch { return {} } }
const pedirMag = async (d: string, h = d): Promise<PrecioMag[]> => ((await json(await getMag(new Request(`http://x/api/precios-mag?desde=${d}&hasta=${h}`)))).filas ?? [])
const pedirCab = async (tipo: string, d: string, h = d): Promise<PrecioCabeza[]> => ((await json(await getCabeza(new Request(`http://x/api/precios-por-cabeza?tipo=${tipo}&desde=${d}&hasta=${h}`)))).filas ?? [])
// Entresurcos por kilo: el mismo parser de app/api/precios-mercado (esa ruta pide sesión).
const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0
function rango(cat: string) {
  const r = cat.match(/(\d+)\s*-\s*(\d+)/); if (r) return { lo: +r[1], hi: +r[2] as number | null }
  const mas = cat.match(/\+\s*(\d+)/); if (mas) return { lo: +mas[1], hi: null }
  const menos = cat.match(/-\s*(\d+)/); if (menos) return { lo: 0, hi: +menos[1] }
  return { lo: 0, hi: null }
}
async function pedirMercado(sexo: "macho" | "hembra", d: string, h = d): Promise<PrecioMercado[]> {
  const res = await fetch(`https://www.entresurcosycorralesya.com/ajax-modulo-${sexo === "hembra" ? "ternera" : "ternero"}.php?desde=${d}&hasta=${h}`,
    { headers: { "User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest" } })
  const html = await res.text(); const out: PrecioMercado[] = []
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x => x[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim())
    if (tds.length < 8 || !/kg/i.test(tds[0]) || /holando/i.test(tds[0])) continue
    const { lo, hi } = rango(tds[0])
    out.push({ categoria: tds[0], pesoLo: lo, pesoHi: hi, promKilo: num(tds[2]), kiloMax: num(tds[3]), kiloMin: num(tds[4]) })
  }
  return out
}

const menosDias = (f: string, n: number) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10) }
/** Día por día 21 días; si falta una categoría, sigue hacia atrás de a 30 días (hasta un año): JMS «el día anterior hasta encontrar». */
async function porCategoria<T>(fecha: string, pedir: (desde: string, hasta?: string) => Promise<T[]>, clave: (f: T) => string, conPrecio: (f: T) => boolean,
  completo: (fs: Array<T & { fecha: string }>) => boolean) {
  const tomadas = new Map<string, T & { fecha: string }>()
  for (const d of diasHaciaAtras(fecha, 21)) if (sumarDia(tomadas, d, await pedir(d), clave, conPrecio, completo)) return [...tomadas.values()]
  for (let k = 0; k < 12; k++) {
    const hasta = menosDias(fecha, 21 + 30 * k), desde = menosDias(hasta, 29)
    if (sumarDia(tomadas, `${desde} a ${hasta}`, await pedir(desde, hasta), clave, conPrecio, completo)) break
  }
  return [...tomadas.values()]
}

async function valuar(fecha: string, existencias: ExistenciaHacienda[], pesos: PesoCategoria[]) {
  const conCab = new Set(existencias.filter(e => e.cabezas > 0).map(e => e.categoria))
  const cs = (f: (c: CriterioValuacion) => boolean) => CRITERIOS.filter(c => conCab.has(c.categoria) && f(c))
  const pesoDe = (cat: string) => pesoParaValuar(cat, pesos, CRITERIOS.find(c => c.categoria === cat)?.pesoKg ?? null).kg
  const todos = (l: CriterioValuacion[], f: Parameters<typeof precioDeCriterio>[1]) => l.every(c => precioDeCriterio(c, f, pesoDe(c.categoria)) != null)
  const vacio = { macho: [] as PrecioMercado[], hembra: [] as PrecioMercado[] }
  const [mag, hembra, macho, vientres, toros] = await Promise.all([
    porCategoria(fecha, pedirMag, x => `${x.familia}|${x.calidad}|${x.corte ?? ""}`, x => x.promedio > 0 || x.maximo > 0, fs => todos(cs(c => c.fuente === "mag"), { mag: fs })),
    porCategoria(fecha, (d, h) => pedirMercado("hembra", d, h), x => `${x.pesoLo}-${x.pesoHi ?? ""}`, x => (x.kiloMax || x.promKilo) > 0, fs => todos(cs(c => c.fuente === "entresurcos" && c.sexo === "hembra"), { mercado: { ...vacio, hembra: fs } })),
    porCategoria(fecha, (d, h) => pedirMercado("macho", d, h), x => `${x.pesoLo}-${x.pesoHi ?? ""}`, x => (x.kiloMax || x.promKilo) > 0, fs => todos(cs(c => c.fuente === "entresurcos" && c.sexo !== "hembra"), { mercado: { ...vacio, macho: fs } })),
    porCategoria(fecha, (d, h) => pedirCab("vientres", d, h), x => x.categoria, x => x.cantidad > 0 && x.promedio > 0, fs => todos(cs(c => c.tipoPorCabeza === "vientres"), { porCabeza: { vientres: fs, toros: [] } })),
    porCategoria(fecha, (d, h) => pedirCab("toros", d, h), x => x.categoria, x => x.cantidad > 0 && x.promedio > 0, fs => todos(cs(c => c.tipoPorCabeza === "toros"), { porCabeza: { vientres: [], toros: fs } })),
  ])
  return { ...valuarHacienda(existencias, mag, { macho, hembra }, {}, pesos, { vientres, toros }), tablas: { mag, hembra, macho, vientres, toros } }
}

// ── existencia por categoría de la app a una fecha ──
const { data: movs } = await sb.schema("productivo").from("movimientos_hacienda").select("fecha, tipo, cantidad, categoria:categorias_hacienda(nombre)")
const existenciaAl = (f: string): ExistenciaHacienda[] => {
  const m = new Map<string, number>()
  for (const x of movs ?? []) if (String(x.fecha) <= f) m.set(x.categoria?.nombre, (m.get(x.categoria?.nombre) ?? 0) + cantidadConSigno(x.tipo, Number(x.cantidad)))
  return [...m].filter(([, n]) => n !== 0).map(([categoria, cabezas]) => ({ categoria, cabezas }))
}

// ── cierre: pesadas proyectadas como en la pantalla ──
const pes: any[] = []
for (let d = 0; ; d += 1000) {
  const { data } = await sb.schema("productivo").from("pesadas_terneros").select("ternero_id, fecha, peso_kg, ternero:terneros(categoria:categorias_hacienda(nombre))").lte("fecha", "2026-10-28").order("id").range(d, d + 999)
  pes.push(...(data ?? [])); if (!data || data.length < 1000) break
}
const { data: lotes } = await sb.schema("productivo").from("stock_lotes").select("categoria, ganancia_diaria_kg")
const gan: Record<string, number> = {}
for (const l of lotes ?? []) if (l.categoria && Number(l.ganancia_diaria_kg) > 0) gan[l.categoria] = Math.max(gan[l.categoria] ?? 0, Number(l.ganancia_diaria_kg))
const pesosCierre = pesosAlCierre(pes.map(p => ({ categoria: p.ternero?.categoria?.nombre ?? "", animalId: String(p.ternero_id), fecha: String(p.fecha).slice(0, 10), pesoKg: Number(p.peso_kg) }))
  .filter(p => p.categoria && p.pesoKg > 0), gan, "2026-06-30")

// ── inicio: los kilos de los papeles de JMS (STOCK HACIENDA 2025, bloque 2.2) ──
const pesoPapel = (categoria: string, kg: number): PesoCategoria => ({ categoria, animales: 0, pesoUltimaPesada: kg, fechaUltimaPesada: "2025-06-30",
  gananciaMedida: null, gananciaConfigurada: null, diasHastaCierre: 0, pesoProyectado: kg, origen: `${kg} kg — papeles de JMS 30/06/25`, difiereDeLaConfigurada: false })
const pesosInicio = [pesoPapel("Vaca CUT/Descarte", 450), pesoPapel("Vaquillona de Reposicion", 250), pesoPapel("Ternero Recria", 250)]

const inicio = await valuar("2025-06-30", existenciaAl("2025-06-30"), pesosInicio)
const cierre = await valuar("2026-06-30", existenciaAl("2026-06-30"), pesosCierre)
mkdirSync("datos", { recursive: true })
writeFileSync("datos/hacienda-valorizada.json", JSON.stringify({ inicio, cierre }, null, 1))
for (const [k, v] of [["INICIO", inicio], ["CIERRE", cierre]] as const) {
  console.log(`${k}: ${v.cabezas} cab · valuado ${v.valuado} · huecos ${v.huecos.map(h => h.categoria).join(",") || "-"}`)
  for (const f of v.filas) console.log(`   ${f.categoria}: ${f.cabezas} × ${f.valorPorCabeza} = ${f.valorTotal} · ${f.origenPrecio} · ${f.pesoKg ?? ""} ${f.origenPeso}`)
}
