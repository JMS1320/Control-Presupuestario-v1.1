/**
 * 📬 Excel de trabajo — CATÁLOGO DE MAILS POR BLOQUE (A-FEAT-1625, paso 0 · v2).
 * JMS 13/11, sobre la v1 (una fila por remitente con 21 columnas): *«primero definiendo los bloques, después las reglas…
 * si me ponés muchísimas columnas me es muy difícil… mejor que usar filtros, dame las solapas directamente»*, y para
 * propaganda y productivo *«tomemos 1 o 2 semanas, lo más reciente»*.
 *
 *     npx tsx scripts/excel-catalogo-mails.mts           ← SÓLO LEE la base y escribe el Excel (nunca pisa uno existente)
 *     (--seco: no escribe el archivo)
 *
 * Solapas: «Bloques» (el catálogo) · una por bloque (los remitentes) · «Un mail, dos funciones» · «Palabras de alerta».
 * 🔒 El mapa remitente → bloque vive FUERA DE GIT (tiene mails de personas): `catalogo-bloques-<fecha> - FUERA DE GIT.json`
 * y la propuesta de la v1 `propuesta-clasificacion-<fecha> - FUERA DE GIT.json`, en la carpeta de comunicación → Mails.
 * Control: cada mail recibido cae en exactamente UN bloque (la suma de los bloques = los recibidos).
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"
import { linkGmail, PALABRAS_GRAVES } from "../lib/mails/registro"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DIR = join("- Comunicacion JMS Claude - Archivos", "Mails")
const FECHA = "2026-11-13"
const DESDE = "2026-10-30"   // las 2 semanas más recientes (30/10 → 13/11)
const CAT = JSON.parse(readFileSync(join(DIR, `catalogo-bloques-${FECHA} - FUERA DE GIT.json`), "utf8"))
const V1 = JSON.parse(readFileSync(join(DIR, `propuesta-clasificacion-${FECHA} - FUERA DE GIT.json`), "utf8")).propuestas
const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const sinTildes = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

async function todo(q: () => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q().range(d, d + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break }
  return out
}
/** Mail exacto gana; si no, el @dominio más largo que lo contenga. */
function buscar<T>(mapa: Record<string, T>, rem: string): T | undefined {
  if (mapa[rem] !== undefined) return mapa[rem]
  const dom = rem.split("@")[1] ?? ""
  const k = Object.keys(mapa).filter(k => k.startsWith("@") && (dom === k.slice(1) || dom.endsWith("." + k.slice(1)))).sort((a, b) => b.length - a.length)[0]
  return k ? mapa[k] : undefined
}
function bloqueDe(m: any): string {
  const rem = String(m.remitente || "").toLowerCase().trim()
  const o = buscar<string>(CAT.overrides, rem); if (o) return o
  const v1 = buscar<{ tipo: string; accion: string }>(V1, rem)
  const tipo = v1?.tipo ?? m.tipo_manual ?? m.tipo ?? "", acc = v1?.accion ?? m.accion ?? ""
  return CAT.porTipoAccion[`${tipo}|${acc}`] ?? CAT.porTipo[tipo] ?? "sin_bloque"
}

// ── Datos ────────────────────────────────────────────────────────────────────────────────────────────────
const mails = (await todo(() => sb.from("mails_registro")
  .select("id,fecha,casilla,mensaje_id,remitente,remitente_nombre,asunto,extracto,tipo,tipo_manual,accion")
  .eq("sentido", "recibido").order("fecha", { ascending: false })))
  .map(m => ({ ...m, rem: String(m.remitente || "").toLowerCase().trim(), bloque: bloqueDe(m), reciente: m.fecha >= DESDE }))
const BLOQUES: { id: string; nombre: string; entra: string; accion: string; ventana?: boolean }[] = [
  ...CAT.bloques, { id: "sin_bloque", nombre: "⚠️ Sin bloque", entra: "No se pudo ubicar", accion: "Decidir" }]
const nombreBloque = Object.fromEntries(BLOQUES.map(b => [b.id, b.nombre]))

// ── Estilos ────────────────────────────────────────────────────────────────────────────────────────────
const AMARILLO = "FFF2CC", GRIS = "D9D9D9", NARANJA = "FCE4D6"
const cab = (v: string, rgb = GRIS) => ({ v, t: "s", s: { font: { bold: true }, fill: { fgColor: { rgb } }, alignment: { wrapText: true, vertical: "top" }, border: { bottom: { style: "thin" } } } })
const txt = (v: string) => ({ v, t: "s", s: { alignment: { wrapText: true, vertical: "top" } } })
const num = (v: number) => ({ v, t: "n", s: { alignment: { vertical: "top" } } })
const link = (m: any) => ({ v: "abrir", t: "s", l: { Target: linkGmail(m.casilla, m.mensaje_id) }, s: { font: { color: { rgb: "0563C1" }, underline: true }, alignment: { vertical: "top" } } })
const resp = () => ({ v: "", t: "s", s: { fill: { fgColor: { rgb: AMARILLO } } } })
const titulo = (v: string) => ({ v, t: "s", s: { font: { bold: true, sz: 13 } } })
function hoja(aoa: any[][], anchos: number[], filtroHasta?: number) {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!cols"] = anchos.map(wch => ({ wch }))
  if (filtroHasta) ws["!autofilter"] = { ref: `A3:${XLSX.utils.encode_col(anchos.length - 1)}${filtroHasta}` }
  ws["!merges"] = [0, 1].map(r => ({ s: { r, c: 0 }, e: { r, c: anchos.length - 1 } }))
  return ws
}
const porRemitente = (lista: any[]) => {
  const g = new Map<string, any[]>()
  for (const m of lista) { if (!g.has(m.rem)) g.set(m.rem, []); g.get(m.rem)!.push(m) }
  return [...g.entries()].map(([rem, ms]) => ({ rem, ms, nombre: ms.find(m => m.remitente_nombre)?.remitente_nombre ?? "", rec: ms.filter(m => m.reciente).length }))
    .sort((a, b) => b.rec - a.rec || b.ms.length - a.ms.length)
}

const wb = XLSX.utils.book_new()

// ── 1 · Bloques ────────────────────────────────────────────────────────────────────────────────────────
const aB: any[][] = [
  [titulo("📬 CATÁLOGO DE MAILS — los BLOQUES (primero esto; las reglas vienen después)")],
  [txt(`Casilla sanmanuel.sp · recibidos · «2 semanas» = del ${dmy(DESDE)} al ${dmy(FECHA)}. Cada bloque tiene su solapa con los remitentes. Marcá en amarillo si el bloque va, si se junta con otro o si falta uno.`)],
  [cab("Nro"), cab("Bloque"), cab("Qué entra"), cab("Qué se hace (propuesta)"), cab("Remitentes"), cab("Mails 2 semanas"), cab("Mails total"), cab("TU RESPUESTA", AMARILLO)],
]
BLOQUES.forEach((b, i) => {
  const ms = mails.filter(m => m.bloque === b.id)
  if (b.id === "sin_bloque" && !ms.length) return
  aB.push([txt(`B${i + 1}`), { v: b.nombre, t: "s", s: { font: { bold: true }, alignment: { vertical: "top" } } }, txt(b.entra), txt(b.accion),
    num(new Set(ms.map(m => m.rem)).size), num(ms.filter(m => m.reciente).length), num(ms.length), resp()])
})
const uB = aB.length
const totRec = mails.filter(m => m.reciente).length
aB.push([], ["", { v: "Total", t: "s", s: { font: { bold: true } } }, "", "", "", { f: `SUM(F4:F${uB})`, t: "n" }, { f: `SUM(G4:G${uB})`, t: "n" }])
const sumaBloques = BLOQUES.reduce((s, b) => s + mails.filter(m => m.bloque === b.id).length, 0)
const cierra = sumaBloques === mails.length
aB.push(["", { v: cierra ? `✓ cierra: los ${mails.length} recibidos caen cada uno en un bloque (${totRec} en las 2 semanas)` : `🛑 NO CIERRA: ${mails.length} recibidos vs ${sumaBloques} en bloques`, t: "s", s: { font: { bold: true, color: { rgb: cierra ? "548235" : "C00000" } } } }])
XLSX.utils.book_append_sheet(wb, hoja(aB, [6, 26, 50, 50, 11, 11, 10, 30]), "Bloques")

// ── 2 · Una solapa por bloque ─────────────────────────────────────────────────────────────────────────
for (const b of BLOQUES) {
  const todos = mails.filter(m => m.bloque === b.id)
  if (!todos.length) continue
  const base = b.ventana ? todos.filter(m => m.reciente) : todos
  const filas = porRemitente(base)
  const fuera = b.ventana ? new Set(todos.map(m => m.rem)).size - filas.length : 0
  const aoa: any[][] = [
    [titulo(`${b.nombre}`)],
    [txt(b.ventana
      ? `Sólo los que escribieron en las 2 semanas (${dmy(DESDE)} → ${dmy(FECHA)}): ${filas.length} remitentes. Hay ${fuera} más que escribieron antes y no se listan.`
      : `Todos los remitentes de este bloque (${filas.length}). «2 sem.» = cuántos mails mandó del ${dmy(DESDE)} al ${dmy(FECHA)}.`)],
    [cab("Nro"), cab("Remitente"), cab("Nombre"), cab(b.ventana ? "Mails 2 sem." : "Mails 2 sem."), cab("Mails total"), cab("Último asunto"), cab("Link"), cab("¿VA ACÁ? (si no, a qué bloque)", AMARILLO)],
  ]
  filas.forEach((f, i) => {
    const ult = (b.ventana ? f.ms : f.ms)[0]
    const total = mails.filter(m => m.rem === f.rem && m.bloque === b.id).length
    aoa.push([txt(`${i + 1}`), txt(f.rem), txt(f.nombre), num(f.rec), num(total), txt(ult.asunto ?? ""), link(ult), resp()])
  })
  const nombreHoja = b.nombre.replace(/[·:\\/?*[\]]/g, "-").replace(/\s+-\s+/g, " - ").slice(0, 31)
  XLSX.utils.book_append_sheet(wb, hoja(aoa, [6, 36, 28, 9, 9, 60, 7, 30], aoa.length), nombreHoja)
}

// ── 3 · Un mail, dos funciones ─────────────────────────────────────────────────────────────────────────
// Por DOMINIO: los que mandan mails que caen en más de un bloque (o, dentro de un remitente, con más de una regla).
const porDominio = new Map<string, any[]>()
const GENERICOS = /^(gmail|hotmail|yahoo|live|outlook)\.com(\.ar)?$/   // casillas personales: se agrupa por persona, no por dominio
for (const m of mails) { const dd = m.rem.split("@")[1] ?? m.rem; const d = GENERICOS.test(dd) ? m.rem : dd; if (!porDominio.has(d)) porDominio.set(d, []); porDominio.get(d)!.push(m) }
const dobles = [...porDominio.entries()].map(([d, ms]) => {
  const funciones = new Map<string, any[]>()
  for (const m of ms) { const k = `${nombreBloque[m.bloque]}${m.tipo ? "" : ""}|${m.tipo ?? "—"}/${m.accion ?? "—"}`; if (!funciones.has(k)) funciones.set(k, []); funciones.get(k)!.push(m) }
  return { d, ms, funciones }
}).filter(x => x.funciones.size > 1).sort((a, b) => b.ms.length - a.ms.length)
const aD: any[][] = [
  [titulo("Un mail, dos funciones — el mismo banco u organismo manda cosas distintas")],
  [txt("Cada dominio que manda mails de más de un tipo, con un ejemplo de cada uno. Acá la regla no puede ser «todo lo de este remitente es X»: necesita el asunto o una palabra de alerta (ver la solapa siguiente). Ej. Galicia: la misma casilla manda propaganda y «se venció tu certificado MiPyme».")],
  [cab("Nro"), cab("Dominio"), cab("Función (bloque · hoy tipo/acción)"), cab("Mails"), cab("Asunto de ejemplo"), cab("Link"), cab("TU RESPUESTA", AMARILLO)],
]
dobles.forEach((x, i) => {
  let j = 0
  for (const [k, ms] of [...x.funciones.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const [bl, ta] = k.split("|")
    aD.push([txt(j === 0 ? `D${i + 1}` : ""), txt(j === 0 ? x.d : ""), txt(`${bl} · ${ta}`), num(ms.length), txt(ms[0].asunto ?? ""), link(ms[0]), j === 0 ? resp() : ""])
    j++
  }
})
XLSX.utils.book_append_sheet(wb, hoja(aD, [6, 28, 38, 7, 64, 7, 30]), "Un mail, dos funciones")

// ── 4 · Palabras de alerta (para TODO el ecosistema) ──────────────────────────────────────────────────
const textoDe = (m: any) => " " + sinTildes(`${m.asunto ?? ""} ${m.extracto ?? ""}`).replace(/[^a-z0-9ñ]+/g, " ") + " "
const asuntoDe = (m: any) => " " + sinTildes(m.asunto ?? "").replace(/[^a-z0-9ñ]+/g, " ") + " "
const recientes = mails.filter(m => m.reciente)
const ARCHIVA = new Set(["propaganda", "informes", "sistema"])
const palabras = [...PALABRAS_GRAVES.map(p => ({ p, ya: true })), ...CAT.palabrasPropuestas.filter((p: string) => !PALABRAS_GRAVES.includes(p)).map((p: string) => ({ p, ya: false }))]
const aP: any[][] = [
  [titulo("Palabras de alerta — para TODO el ecosistema, no remitente por remitente")],
  [txt(`Ya existe una lista (25 palabras) que marca un mail como GRAVE en cualquier remitente: va arriba en Mails, en Principal y en el reporte. Pero hoy NO mira lo que se archiva ni la propaganda (porque los boletines dicen «deuda» todos los días) — y así se perdería, por ejemplo, un «venció tu certificado» que llega por la casilla de propaganda de Galicia. Medido en las 2 semanas (${recientes.length} mails): cuántos agarra cada palabra, y cuántos de esos están en un bloque que se archiva (la columna naranja: lo que hoy se perdería). Propuesta: en lo que se archiva, mirar la palabra SÓLO en el ASUNTO (columna «sólo asunto»).`)],
  [cab("Nro"), cab("Palabra"), cab("¿Ya está?"), cab("Mails 2 sem. (asunto + texto)"), cab("…de esos, en un bloque que se archiva", NARANJA), cab("…en lo archivado, sólo en el asunto", NARANJA), cab("Ejemplo"), cab("Link"), cab("TU RESPUESTA (va / no va)", AMARILLO)],
]
palabras.forEach(({ p, ya }, i) => {
  const hits = recientes.filter(m => textoDe(m).includes(` ${p} `))
  const arch = hits.filter(m => ARCHIVA.has(m.bloque))
  const archAsunto = arch.filter(m => asuntoDe(m).includes(` ${p} `))
  const ej = (archAsunto[0] ?? hits.find(m => !ARCHIVA.has(m.bloque)) ?? hits[0])
  aP.push([txt(`P${i + 1}`), { v: p, t: "s", s: { font: { bold: true } } }, txt(ya ? "✓ ya está" : "🆕 propuesta"), num(hits.length), num(arch.length), num(archAsunto.length),
    txt(ej ? `${nombreBloque[ej.bloque]}: ${ej.asunto ?? ""}` : "—"), ej ? link(ej) : "", resp()])
})
XLSX.utils.book_append_sheet(wb, hoja(aP, [6, 18, 12, 12, 14, 14, 64, 7, 22]), "Palabras de alerta")

fechasReales(wb as any)
console.log(`Recibidos ${mails.length} (2 semanas: ${totRec}) · bloques suman ${sumaBloques} · ${cierra ? "✓ cierra" : "🛑 NO CIERRA"}`)
for (const b of BLOQUES) { const ms = mails.filter(m => m.bloque === b.id); if (ms.length) console.log(`  ${b.nombre}: ${new Set(ms.map(m => m.rem)).size} rem · ${ms.filter(m => m.reciente).length} en 2 sem · ${ms.length} total`) }
console.log(`  dominios con dos funciones: ${dobles.length} → ${dobles.map(x => x.d).join(", ")}`)
let dest = ""
for (let v = 1; ; v++) { dest = join(DIR, `Catalogo de mails por bloque (${FECHA}) v${v}.xlsx`); if (!existsSync(dest)) break }
if (!process.argv.includes("--seco")) { XLSX.writeFile(wb, dest); console.log("→", dest) }
