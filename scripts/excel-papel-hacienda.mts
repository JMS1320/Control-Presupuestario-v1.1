/**
 * 🐄 **El papel de hacienda del balance (solapas 02 a 02.9), con el dato real, sin pasar por el navegador** (A-FEAT-1541, sólo lectura).
 *
 * JMS 05/11: *«precisamos que me des el Excel sin que yo lo descargue, porque perdemos mucho tiempo en la ida y vuelta»*.
 * Arma EXACTAMENTE las mismas solapas que el set (usa `agregarPapelHacienda` del export) con los mismos datos que junta la pantalla
 * «Papeles de balance → Hacienda»: movimientos, pesadas (hasta 120 días después del cierre), precios al cierre y al inicio
 * (por categoría hacia atrás), kilos del inicio de los papeles de JMS, TC del cierre y los saldos SENASA/DDJJ escritos en la pantalla.
 *
 *   npx tsx scripts/excel-papel-hacienda.mts [carpeta-destino]
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import XLSX from "xlsx-js-style"
import { valuarHacienda, precioDeCriterio, CRITERIOS, type PrecioMag, type PrecioMercado, type PrecioCabeza, type ExistenciaHacienda, type CriterioValuacion } from "../lib/balance/hacienda-stock"
import { pesosAlCierre, pesoParaValuar, type PesoCategoria } from "../lib/balance/pesos-hacienda"
import { cantidadConSigno } from "../lib/balance/cuadre-hacienda"
import { diasHaciaAtras, sumarDia } from "../lib/balance/precio-al-cierre"
import { armarEjercicio, primerDiaDelEjercicio } from "../lib/balance/ejercicio"
import { PAPELES_JMS_INICIO_2025, type MovimientoPapel } from "../lib/balance/stock-hacienda-papel"
import { agregarPapelHacienda } from "../lib/balance/export-libro-diario"
import { leerTcCierre } from "../lib/balance/balance-en-linea-lectura"
import { TABLA_DATOS_USUARIO } from "../lib/balance/datos-usuario-puro"
import { GET as getMag } from "../app/api/precios-mag/route"
import { GET as getCabeza } from "../app/api/precios-por-cabeza/route"

const EMPRESA = "MSA", ANIO = 2026
const DESTINO = process.argv[2] ?? "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ej = armarEjercicio(ANIO), fc = ej.fechaCierre, primerDia = primerDiaDelEjercicio(ej)
const masDias = (f: string, n: number) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const diaInicio = masDias(primerDia, -1)

// ── precios: las mismas fuentes que la pantalla ──
const json = async (r: Response) => { try { return await r.json() } catch { return {} } }
const pedirMag = async (d: string, h = d): Promise<PrecioMag[]> => ((await json(await getMag(new Request(`http://x/api/precios-mag?desde=${d}&hasta=${h}`)))).filas ?? [])
const pedirCab = async (tipo: string, d: string, h = d): Promise<PrecioCabeza[]> => ((await json(await getCabeza(new Request(`http://x/api/precios-por-cabeza?tipo=${tipo}&desde=${d}&hasta=${h}`)))).filas ?? [])
const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0
function rango(cat: string) {
  const r = cat.match(/(\d+)\s*-\s*(\d+)/); if (r) return { lo: +r[1], hi: +r[2] as number | null }
  const mas = cat.match(/\+\s*(\d+)/); if (mas) return { lo: +mas[1], hi: null }
  const menos = cat.match(/-\s*(\d+)/); if (menos) return { lo: 0, hi: +menos[1] }
  return { lo: 0, hi: null }
}
// Entresurcos por kilo: el mismo parser de app/api/precios-mercado (esa ruta pide sesión).
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
/** Como `ultimoPorCategoria` de la pantalla: 21 días hacia atrás y después de a 30 días (12 ventanas). */
async function porCategoria<T>(fecha: string, pedir: (desde: string, hasta?: string) => Promise<T[]>, clave: (f: T) => string, conPrecio: (f: T) => boolean,
  completo: (fs: Array<T & { fecha: string }>) => boolean) {
  const tomadas = new Map<string, T & { fecha: string }>()
  for (const d of diasHaciaAtras(fecha, 21)) if (sumarDia(tomadas, d, await pedir(d), clave, conPrecio, completo)) return [...tomadas.values()]
  for (let k = 0; k < 12; k++) {
    const hasta = masDias(fecha, -(21 + 30 * k)), desde = masDias(hasta, -29)
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
  return { v: valuarHacienda(existencias, mag, { macho, hembra }, {}, pesos, { vientres, toros }), tablas: { mag, hembra, macho, vientres, toros } }
}

// ── movimientos ──
const { data: movs, error: eM } = await sb.schema("productivo").from("movimientos_hacienda")
  .select("cantidad, fecha, tipo, proveedor_cliente, observaciones, categoria:categorias_hacienda(nombre)")
if (eM) throw new Error(eM.message)
const movimientosPapel: MovimientoPapel[] = (movs ?? []).map((m: any) => ({
  fecha: String(m.fecha ?? "").slice(0, 10), tipo: String(m.tipo ?? ""), cantidad: Number(m.cantidad ?? 0),
  categoria: m.categoria?.nombre ?? "", cliente: m.proveedor_cliente ?? null, obs: m.observaciones ?? null,
}))
const existenciaAl = (f: string): ExistenciaHacienda[] => {
  const m = new Map<string, number>()
  for (const x of movimientosPapel) if (x.fecha <= f) m.set(x.categoria, (m.get(x.categoria) ?? 0) + cantidadConSigno(x.tipo, x.cantidad))
  return [...m].filter(([, n]) => n !== 0).map(([categoria, cabezas]) => ({ categoria, cabezas }))
}

// ── pesadas hasta 120 días después del cierre, con caravana ──
const pes: any[] = []
for (let d = 0; ; d += 1000) {
  const { data, error } = await sb.schema("productivo").from("pesadas_terneros")
    .select("ternero_id, fecha, peso_kg, caravana_idv, ternero:terneros(categoria:categorias_hacienda(nombre))")
    .lte("fecha", masDias(fc, 120)).order("id").range(d, d + 999)
  if (error) throw new Error(error.message)
  pes.push(...(data ?? [])); if (!data || data.length < 1000) break
}
const { data: lotes } = await sb.schema("productivo").from("stock_lotes").select("categoria, ganancia_diaria_kg")
const gan: Record<string, number> = {}
for (const l of lotes ?? []) if (l.categoria && Number(l.ganancia_diaria_kg) > 0) gan[l.categoria] = Math.max(gan[l.categoria] ?? 0, Number(l.ganancia_diaria_kg))
const pesosCierre = pesosAlCierre(pes.map(p => ({ categoria: p.ternero?.categoria?.nombre ?? "", animalId: String(p.ternero_id), fecha: String(p.fecha).slice(0, 10),
  pesoKg: Number(p.peso_kg), caravana: p.caravana_idv ?? null })).filter(p => p.categoria && p.pesoKg > 0), gan, fc)

// ── inicio: kilos de los papeles de JMS (como la pantalla) ──
const pesosInicio: PesoCategoria[] = diaInicio === PAPELES_JMS_INICIO_2025.fecha
  ? Object.entries(PAPELES_JMS_INICIO_2025.kg).map(([categoria, kg]) => ({ categoria, animales: 0, pesoUltimaPesada: kg, fechaUltimaPesada: diaInicio,
    gananciaMedida: null, gananciaConfigurada: null, diasHastaCierre: 0, pesoProyectado: kg, origen: `${kg} kg — papeles de JMS ${diaInicio.split("-").reverse().join("/")}`, difiereDeLaConfigurada: false }))
  : []

const [cierre, inicio] = [await valuar(fc, existenciaAl(fc), pesosCierre), await valuar(diaInicio, existenciaAl(diaInicio), pesosInicio)]
const tc = await leerTcCierre(sb, fc).catch(() => null)
const { data: saldos } = await sb.from(TABLA_DATOS_USUARIO).select("clave, texto, valor").eq("empresa", EMPRESA).eq("anio_cierre", ANIO).eq("papel", "hacienda.saldos")
const saldosGuardados: Record<string, string> = Object.fromEntries((saldos ?? []).map((s: any) => [s.clave, String(s.texto ?? s.valor ?? "")]))

const wb = XLSX.utils.book_new()
agregarPapelHacienda(wb, {
  valuacion: cierre.v, movimientosPapel, valuacionInicio: inicio.v, tablasInicio: inicio.tablas, tablasCierre: cierre.tablas,
  tcCierre: tc?.tc ?? null, saldosGuardados, pesos: pesosCierre,
}, EMPRESA, ej)
const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 16).replace("T", " ").replace(":", "")
const archivo = `${DESTINO}/Hacienda - papel del balance ${EMPRESA} 25-26 (${hoy}).xlsx`
XLSX.writeFile(wb, archivo)
console.log(`✅ ${archivo}`)
for (const [k, x] of [["CIERRE", cierre.v], ["INICIO", inicio.v]] as const) {
  console.log(`${k}: ${x.cabezas} cab · a mercado ${x.valuado} · −10 % ${x.descuento} · NETO ${x.neto} · sin precio: ${x.huecos.map(h => h.categoria).join(", ") || "-"}`)
  for (const f of x.filas) console.log(`   ${f.categoria}: ${f.cabezas} × ${f.valorPorCabeza} · kg ${f.pesoKg ?? "-"} · ${f.origenPeso ?? ""}`)
}
