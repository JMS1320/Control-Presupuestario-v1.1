/**
 * 📬 Excel de trabajo — PROPUESTA DE CLASIFICACIÓN DE MAILS por remitente (A-FEAT-1625, paso 0).
 * JMS 12/11: «auditar la clasificación ANTES de mover nada» — qué grupo, qué acción, cuántos mails, ejemplo con link; él marca.
 *
 *     npx tsx scripts/excel-propuesta-mails.mts          ← SÓLO LEE la base y escribe el Excel (nunca pisa uno existente)
 *     (--seco: no escribe el archivo)
 *
 * 🔒 La propuesta (remitente → tipo/acción/motivo) vive FUERA DE GIT, en la carpeta de comunicación, porque tiene mails de
 * personas y el repo es público: `- Comunicacion JMS Claude - Archivos/Mails/propuesta-clasificacion-<fecha> - FUERA DE GIT.json`.
 * Lo que no figura ahí = se propone dejar la regla como está.
 *
 * Una fila por remitente + regla con la que se clasificó hoy (un remitente con dos reglas —p. ej. Santander «saldo negativo» y
 * el resto— sale en dos filas). Control: la suma de las filas = los recibidos registrados.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"
import { linkGmail } from "../lib/mails/registro"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DIR = join("- Comunicacion JMS Claude - Archivos", "Mails")
const FECHA = "2026-11-13"
const PROP = JSON.parse(readFileSync(join(DIR, `propuesta-clasificacion-${FECHA} - FUERA DE GIT.json`), "utf8"))
const propuestas: Record<string, { tipo: string; accion: string; motivo: string }> = PROP.propuestas
const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")

async function todo(q: () => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q().range(d, d + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break }
  return out
}

// ── Datos ────────────────────────────────────────────────────────────────────────────────────────────────
const mails = await todo(() => sb.from("mails_registro")
  .select("id,fecha,casilla,mensaje_id,remitente,remitente_nombre,asunto,adjuntos,regla_id,tipo,tipo_manual,accion")
  .eq("sentido", "recibido").order("fecha", { ascending: false }))
const reglas = await todo(() => sb.from("mails_reglas").select("id,remitente_patron,asunto_patron,tipo,accion,activa"))
const tiposBD = await todo(() => sb.from("mails_tipos").select("id,nombre,orden"))
const reglaPorId = new Map(reglas.map(r => [r.id, r]))
const nombreTipo: Record<string, string> = Object.fromEntries(tiposBD.map(t => [t.id, t.nombre]))
for (const [id, txt] of Object.entries(PROP.tipos_nuevos ?? {})) nombreTipo[id] = `🆕 ${String(txt).split(" (")[0]}`
const ordenTipo: Record<string, number> = Object.fromEntries(tiposBD.map(t => [t.id, t.orden]))
ordenTipo.informes = 45
const ACCION: Record<string, string> = { avisar: "Avisar (tarea)", guardar: "Guardar", archivar: "Archivar" }

/** La propuesta para un remitente: el mail exacto gana; si no, el @dominio más largo que lo contenga. */
function propuestaDe(rem: string) {
  if (propuestas[rem]) return { ...propuestas[rem], patron: rem }
  const dom = rem.split("@")[1] ?? ""
  const cands = Object.keys(propuestas).filter(k => k.startsWith("@") && (dom === k.slice(1) || dom.endsWith("." + k.slice(1))))
    .sort((a, b) => b.length - a.length)
  return cands[0] ? { ...propuestas[cands[0]], patron: cands[0] } : null
}

function bandeja(tipo: string, accion: string, rem: string): string {
  if (tipo === "informes") return "Sí · paso 1 (queda a la vista en Mails y en el reporte)"
  if (accion === "archivar") return "Sí · paso 1 (primero en ensayo)"
  if (accion === "avisar") return "Paso 2 · se junta en UNA tarea abierta"
  if (tipo === "factura") return "Paso 3 · al guardar la factura"
  if (tipo === "contador") return "Paso 4 · al guardar en Contador/…"
  if (tipo === "impuestos") return /arba\.gov\.ar$/.test(rem) ? "Paso 5 · ARBA" : "Paso 6 · Municipalidad / Red Vial / ABL"
  return "Queda en la bandeja (por ahora)"
}

// ── Agrupar por remitente + regla de hoy ───────────────────────────────────────────────────────────────────
const hace30 = new Date(Date.now() - 30 * 86400000).toISOString()
type Grupo = { rem: string; nombre: string; regla: any; tipo: string | null; accion: string | null; mails: any[] }
const grupos = new Map<string, Grupo>()
for (const m of mails) {
  const rem = String(m.remitente || "").toLowerCase().trim()
  const k = `${rem}|${m.regla_id ?? ""}`
  if (!grupos.has(k)) grupos.set(k, { rem, nombre: m.remitente_nombre || "", regla: m.regla_id ? reglaPorId.get(m.regla_id) : null, tipo: m.tipo_manual || m.tipo, accion: m.accion, mails: [] })
  const g = grupos.get(k)!
  if (!g.nombre && m.remitente_nombre) g.nombre = m.remitente_nombre
  g.mails.push(m)
}

const filas = [...grupos.values()].map(g => {
  const p = propuestaDe(g.rem)
  const pTipo = p?.tipo ?? g.tipo ?? "otro", pAcc = p?.accion ?? g.accion ?? "guardar"
  const cambia = !g.regla ? "🆕 sin regla" : (pTipo !== g.tipo || pAcc !== g.accion) ? "⚠️ cambia" : "= igual"
  const asuntos = [...new Set(g.mails.map(m => (m.asunto || "").trim()).filter(Boolean))].slice(0, 3)
  const ult = g.mails[0]
  return {
    g, pTipo, pAcc, cambia, asuntos, ult,
    n: g.mails.length,
    n30: g.mails.filter(m => m.fecha >= hace30).length,
    adj: g.mails.filter(m => Array.isArray(m.adjuntos) && m.adjuntos.length > 0).length,
    primero: g.mails[g.mails.length - 1].fecha, ultimo: ult.fecha,
    reglaTxt: g.regla ? `${g.regla.remitente_patron}${g.regla.asunto_patron ? ` + asunto «${g.regla.asunto_patron}»` : ""}` : "— (sin regla)",
    reglaNueva: !g.regla || cambia === "⚠️ cambia" ? (p?.patron ?? g.rem) : "",
    motivo: p?.motivo ?? (g.regla ? "Se deja como está" : "Sin propuesta: decidir"),
  }
}).sort((a, b) => (ordenTipo[a.pTipo] ?? 999) - (ordenTipo[b.pTipo] ?? 999) || a.pAcc.localeCompare(b.pAcc) || b.n - a.n)

// ── Excel ───────────────────────────────────────────────────────────────────────────────────────────────
const AMARILLO = "FFF2CC", NARANJA = "FCE4D6", VERDE = "E2EFDA", GRIS = "D9D9D9", CELESTE = "DDEBF7"
const cab = (v: string, rgb: string) => ({ v, t: "s", s: { font: { bold: true }, fill: { fgColor: { rgb } }, alignment: { wrapText: true, vertical: "top" }, border: { bottom: { style: "thin" } } } })
const COLS: [string, string, number][] = [
  ["Nro", GRIS, 6], ["Remitente", GRIS, 34], ["Nombre", GRIS, 26], ["Mails", GRIS, 7], ["Últimos 30 días", GRIS, 9], ["Con adjunto", GRIS, 9],
  ["Primero", GRIS, 11], ["Último", GRIS, 11], ["Asuntos de ejemplo (hasta 3)", GRIS, 60], ["Link al último", GRIS, 10],
  ["HOY · regla", CELESTE, 30], ["HOY · tipo", CELESTE, 16], ["HOY · acción", CELESTE, 13],
  ["PROPUESTA · tipo", VERDE, 18], ["PROPUESTA · acción", VERDE, 14], ["¿Cambia?", VERDE, 12], ["PROPUESTA · regla (remitente o @dominio)", VERDE, 32],
  ["¿Sale de la bandeja?", VERDE, 30], ["Por qué", VERDE, 50],
  ["TU RESPUESTA (OK / otro tipo / otra acción)", AMARILLO, 22], ["TU NOTA", AMARILLO, 40],
]
const aoa: any[][] = [COLS.map(([t, c]) => cab(t, c))]
filas.forEach((f, i) => {
  const fill = f.cambia === "⚠️ cambia" ? { fill: { fgColor: { rgb: NARANJA } } } : {}
  const link = linkGmail(f.ult.casilla, f.ult.mensaje_id)
  aoa.push([
    { v: i + 1, t: "n" }, f.g.rem, f.g.nombre, { v: f.n, t: "n" }, { v: f.n30, t: "n" }, { v: f.adj, t: "n" },
    dmy(f.primero), dmy(f.ultimo), { v: f.asuntos.join("  ·  "), t: "s", s: { alignment: { wrapText: true, vertical: "top" } } },
    { v: "abrir", t: "s", l: { Target: link }, s: { font: { color: { rgb: "0563C1" }, underline: true } } },
    f.reglaTxt, f.g.tipo ? (nombreTipo[f.g.tipo] ?? f.g.tipo) : "—", f.g.accion ? ACCION[f.g.accion] ?? f.g.accion : "—",
    { v: nombreTipo[f.pTipo] ?? f.pTipo, t: "s", s: { font: { bold: true }, ...fill } }, { v: ACCION[f.pAcc] ?? f.pAcc, t: "s", s: { font: { bold: true }, ...fill } },
    { v: f.cambia, t: "s", s: fill }, f.reglaNueva, bandeja(f.pTipo, f.pAcc, f.g.rem),
    { v: f.motivo, t: "s", s: { alignment: { wrapText: true, vertical: "top" } } },
    { v: "", t: "s", s: { fill: { fgColor: { rgb: AMARILLO } } } }, { v: "", t: "s", s: { fill: { fgColor: { rgb: AMARILLO } } } },
  ])
})
const ultFila = aoa.length
const total = mails.length
aoa.push([], ["", { v: "Total de mails (suma de la columna)", t: "s", s: { font: { bold: true } } }, "", { f: `SUBTOTAL(9,D2:D${ultFila})`, t: "n", s: { font: { bold: true } } }])
const wsD = XLSX.utils.aoa_to_sheet(aoa)
const L = (i: number) => XLSX.utils.encode_col(i)
wsD["!autofilter"] = { ref: `A1:${L(COLS.length - 1)}${ultFila}` }
wsD["!cols"] = COLS.map(([, , w]) => ({ wch: w }))
wsD["!freeze"] = { xSplit: 2, ySplit: 1 }
;(wsD as any)["!views"] = [{ state: "frozen", xSplit: 2, ySplit: 1 }]

// Resumen: hoy vs propuesta, con control
const sumaFilas = filas.reduce((s, f) => s + f.n, 0)
const conteo = (clave: (f: typeof filas[number]) => string) => {
  const m = new Map<string, { rem: number; mails: number; n30: number }>()
  for (const f of filas) { const k = clave(f); const x = m.get(k) ?? { rem: 0, mails: 0, n30: 0 }; x.rem++; x.mails += f.n; x.n30 += f.n30; m.set(k, x) }
  return [...m.entries()].sort((a, b) => b[1].mails - a[1].mails)
}
const titulo = (v: string) => [{ v, t: "s", s: { font: { bold: true, sz: 13 } } }]
const ok = sumaFilas === total
const aR: any[][] = [
  titulo("📬 PROPUESTA DE CLASIFICACIÓN DE MAILS — paso 0 del plan «el mail se procesa solo» (A-FEAT-1625)"),
  [`Casilla sanmanuel.sp · sólo los RECIBIDOS · armado el ${dmy(FECHA)} · nada se movió ni se cambió todavía: esto es para que marques.`],
  [],
  [{ v: "A · CONTROL", t: "s", s: { font: { bold: true } } }],
  ["A1 · Recibidos registrados en la base", "", { v: total, t: "n" }],
  ["A2 · Suma de las filas de «Por remitente»", "", { v: sumaFilas, t: "n" }],
  [{ v: ok ? "✓ cierra (A1 = A2)" : `🛑 NO CIERRA: diferencia ${total - sumaFilas}`, t: "s", s: { font: { bold: true, color: { rgb: ok ? "548235" : "C00000" } } } }],
  [],
  [{ v: "B · QUÉ CAMBIA", t: "s", s: { font: { bold: true } } }, "", cab("Remitentes", GRIS), cab("Mails", GRIS), cab("Últimos 30 días", GRIS)],
  ...conteo(f => f.cambia).map(([k, x], i) => [`B${i + 1} · ${k}`, "", { v: x.rem, t: "n" }, { v: x.mails, t: "n" }, { v: x.n30, t: "n" }]),
  [],
  [{ v: "C · CÓMO QUEDARÍA (propuesta)", t: "s", s: { font: { bold: true } } }, "", cab("Remitentes", GRIS), cab("Mails", GRIS), cab("Últimos 30 días", GRIS)],
  ...conteo(f => `${nombreTipo[f.pTipo] ?? f.pTipo} · ${ACCION[f.pAcc] ?? f.pAcc}`).map(([k, x], i) => [`C${i + 1} · ${k}`, "", { v: x.rem, t: "n" }, { v: x.mails, t: "n" }, { v: x.n30, t: "n" }]),
  [],
  [{ v: "D · CUÁNTO SALE DE LA BANDEJA", t: "s", s: { font: { bold: true } } }, "", cab("Remitentes", GRIS), cab("Mails", GRIS), cab("Últimos 30 días", GRIS)],
  ...conteo(f => bandeja(f.pTipo, f.pAcc, f.g.rem)).map(([k, x], i) => [`D${i + 1} · ${k}`, "", { v: x.rem, t: "n" }, { v: x.mails, t: "n" }, { v: x.n30, t: "n" }]),
  [],
  [{ v: "E · CÓMO SE MARCA", t: "s", s: { font: { bold: true } } }],
  ["E1 · En «Por remitente», columna amarilla: «OK» si está bien; si no, el tipo o la acción que va (o «otra cosa» + tu nota)."],
  ["E2 · Las filas en NARANJA son las que cambian algo que hoy tiene regla: miralas primero (filtro «¿Cambia?» = ⚠️)."],
  ["E3 · «🆕 Informes productivos» es un TIPO NUEVO propuesto (tu criterio del 12/11): sale de la bandeja pero queda a la vista. Si no lo querés, poné «Propaganda»."],
  ["E4 · El link «abrir» va al último mail de ese remitente en Gmail (con la sesión de sanmanuel.sp abierta)."],
]
const wsR = XLSX.utils.aoa_to_sheet(aR)
wsR["!cols"] = [{ wch: 62 }, { wch: 2 }, { wch: 12 }, { wch: 10 }, { wch: 14 }]
wsR["!merges"] = [0, 1, ...aR.map((_, i) => i).filter(i => i >= aR.length - 4)].map(r => ({ s: { r, c: 0 }, e: { r, c: 4 } }))
for (const r of [1, ...aR.map((_, i) => i).filter(i => i >= aR.length - 4)]) {
  const ref = XLSX.utils.encode_cell({ r, c: 0 }); const c = wsR[ref]
  if (c) c.s = { ...(c.s ?? {}), alignment: { wrapText: true, vertical: "top" } }
}
wsR["!rows"] = aR.map((_, i) => (i >= aR.length - 4 || i === 1 ? { hpt: 32 } : {}))

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, wsR, "Resumen")
XLSX.utils.book_append_sheet(wb, wsD, "Por remitente")
fechasReales(wb as any)

console.log(`Recibidos ${total} · filas ${filas.length} · suma ${sumaFilas} · ${ok ? "✓ cierra" : "🛑 NO CIERRA"}`)
for (const [k, x] of conteo(f => f.cambia)) console.log(`  ${k}: ${x.rem} remitentes, ${x.mails} mails`)
for (const [k, x] of conteo(f => bandeja(f.pTipo, f.pAcc, f.g.rem))) console.log(`  ${k}: ${x.rem} rem, ${x.mails} mails, ${x.n30} en 30 días`)
const sinProp = filas.filter(f => f.motivo === "Sin propuesta: decidir")
if (sinProp.length) console.log(`  ⚠️ sin propuesta: ${sinProp.map(f => f.g.rem).join(", ")}`)

let dest = ""
for (let v = 1; ; v++) { dest = join(DIR, `Propuesta de clasificacion de mails (${FECHA}) v${v}.xlsx`); if (!existsSync(dest)) break }
if (!process.argv.includes("--seco")) { XLSX.writeFile(wb, dest); console.log("→", dest) }
