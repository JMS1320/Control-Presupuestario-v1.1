/**
 * 📬 Script 272 — BLOQUES DE MAIL + REGLAS NUEVAS (A-FEAT-1625, paso AL1). Acordado con JMS el 13/11 (tabla AG del chat).
 *
 *     npx tsx scripts/272-bloques-y-reglas-mails.mts            ← EN SECO: sólo lee y muestra qué haría
 *     npx tsx scripts/272-bloques-y-reglas-mails.mts --aplicar  ← escribe (con OK de JMS) y guarda la foto para el deshacer
 *     deshacer: npx tsx scripts/272-bloques-y-reglas-mails-deshacer.mts
 *
 * Qué hace (sólo DATOS; no cambia ninguna columna, check ni permiso — las acciones siguen siendo guardar/avisar/archivar):
 *   1. `public.mails_tipos`: renombra y reordena los grupos que quedan (bloques), crea «Productivo · informes» e
 *      «Proveedores inactivos», y manda al fondo los que quedan en desuso (no se borran).
 *   2. `public.mails_reglas`: crea las reglas nuevas (una por remitente, o por @dominio cuando todo el dominio va igual, más
 *      las de «un mail, dos funciones» por asunto) y DESACTIVA las anteriores (no se borran). Marca `[script 272]`.
 *   3. `public.mails_registro`: reaplica las reglas a lo ya registrado (tipo, acción, regla), salvo lo corregido a mano.
 *   🛑 NO mueve, archiva ni descarga nada en la casilla: eso es el paso 3 (el robot), primero en ensayo.
 *
 * 🔒 Las decisiones (qué remitente va a qué bloque) viven FUERA DE GIT —tienen mails de personas—, en la carpeta de
 * comunicación → Mails: `272 decisiones - FUERA DE GIT.json` + el catálogo y la propuesta del 13/11. La foto del antes se
 * guarda ahí mismo (`272 foto antes - FUERA DE GIT.json`) y es lo que usa el deshacer.
 *
 * Control: después de reaplicar, (a) ningún recibido queda sin regla; (b) cada remitente queda en el bloque decidido (salvo
 * los que se parten por asunto); (c) recibidos antes = recibidos después.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { cambiosAlReaplicar, type ReglaMail } from "../lib/mails/registro"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const APLICAR = process.argv.includes("--aplicar")
const MARCA = "[script 272]"
const DIR = join("- Comunicacion JMS Claude - Archivos", "Mails")
const leerJson = (n: string) => JSON.parse(readFileSync(join(DIR, n), "utf8"))
const DEC = leerJson("272 decisiones - FUERA DE GIT.json")
const CAT = leerJson("catalogo-bloques-2026-11-13 - FUERA DE GIT.json")
const V1 = leerJson("propuesta-clasificacion-2026-11-13 - FUERA DE GIT.json").propuestas
const FOTO = join(DIR, "272 foto antes - FUERA DE GIT.json")
const GENERICOS = /^(gmail|hotmail|yahoo|live|outlook)\.com(\.ar)?$/

async function todo(q: () => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q().range(d, d + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break }
  return out
}
function buscar<T>(mapa: Record<string, T>, rem: string): T | undefined {
  if (mapa[rem] !== undefined) return mapa[rem]
  const dom = rem.split("@")[1] ?? ""
  const k = Object.keys(mapa).filter(k => k.startsWith("@") && (dom === k.slice(1) || dom.endsWith("." + k.slice(1)))).sort((a, b) => b.length - a.length)[0]
  return k ? mapa[k] : undefined
}
/** El bloque del catálogo (misma lógica que scripts/excel-catalogo-mails.mts) → el grupo de la base y su acción. */
function destinoDe(rem: string, m: any): { tipo: string; accion: string } {
  const fijo = DEC.porRemitente[rem]; if (fijo) return fijo
  const o = buscar<string>(CAT.overrides, rem)
  let bloque = o
  if (!bloque) {
    const v1 = buscar<{ tipo: string; accion: string }>(V1, rem)
    const tipo = v1?.tipo ?? m.tipo ?? "", acc = v1?.accion ?? m.accion ?? ""
    bloque = CAT.porTipoAccion[`${tipo}|${acc}`] ?? CAT.porTipo[tipo] ?? "contrapartes"
  }
  const tipo = DEC.bloqueATipo[bloque!] ?? "factura"
  return { tipo, accion: DEC.accionPorTipo[tipo] ?? "guardar" }
}

// ── Lo de hoy ───────────────────────────────────────────────────────────────────────────────────────────
const tiposHoy = await todo(() => sb.from("mails_tipos").select("*"))
const reglasHoy = await todo(() => sb.from("mails_reglas").select("*"))
const mails = await todo(() => sb.from("mails_registro").select("id,sentido,remitente,destinatarios,asunto,tipo,accion,tipo_manual,regla_id"))
if (reglasHoy.some(r => String(r.nota ?? "").includes(MARCA))) throw new Error(`🛑 Ya hay reglas con ${MARCA}: el script ya corrió.`)
const recibidos = mails.filter(m => m.sentido === "recibido")

// ── 1 · Las reglas nuevas ─────────────────────────────────────────────────────────────────────────────
const porRem = new Map<string, { tipo: string; accion: string }>()
for (const m of recibidos) {
  const rem = String(m.remitente || "").toLowerCase().trim().replace(/^.*<([^>]+)>.*$/, "$1")
  if (rem && !porRem.has(rem)) porRem.set(rem, destinoDe(rem, m))
}
// Por @dominio si TODO el dominio (no genérico) va al mismo grupo con la misma acción y ninguna regla por asunto lo nombra
const porDom = new Map<string, string[]>()
for (const rem of porRem.keys()) { const d = rem.split("@")[1] ?? ""; if (!porDom.has(d)) porDom.set(d, []); porDom.get(d)!.push(rem) }
type Nueva = { remitente_patron: string; asunto_patron: string | null; tipo: string; accion: string; orden: number; activa: boolean; nota: string }
const nuevas: Nueva[] = []
for (const [d, rems] of porDom) {
  const destinos = new Set(rems.map(r => JSON.stringify(porRem.get(r))))
  if (!GENERICOS.test(d) && destinos.size === 1 && rems.length > 1) {
    const x = porRem.get(rems[0])!
    nuevas.push({ remitente_patron: "@" + d, asunto_patron: null, ...x, orden: 10, activa: true, nota: `${MARCA} bloque por dominio (${rems.length} remitentes)` })
  } else for (const r of rems) nuevas.push({ remitente_patron: r, asunto_patron: null, ...porRem.get(r)!, orden: 10, activa: true, nota: `${MARCA} bloque por remitente` })
}
for (const a of DEC.porAsunto) nuevas.push({ remitente_patron: a.remitente, asunto_patron: a.asunto, tipo: a.tipo, accion: a.accion, orden: 10, activa: true, nota: `${MARCA} ${a.por_que}` })

// ── 2 · Simular: reaplicar con SÓLO las reglas nuevas ─────────────────────────────────────────────────
const simuladas: ReglaMail[] = nuevas.map((r, i) => ({ ...r, id: `nueva-${i}` } as any))
const cambios = cambiosAlReaplicar(mails as any, simuladas)
const despues = new Map(mails.map(m => [m.id, { tipo: m.tipo, accion: m.accion, regla_id: m.regla_id }]))
for (const c of cambios) despues.set(c.id, { tipo: c.tipo, accion: c.accion, regla_id: c.regla_id })
// La regla de cada mail también cambia aunque el tipo y la acción den igual: se recalcula para todos los no manuales
const { clasificarConReglas } = await import("../lib/mails/registro")
const reglaNueva = new Map<string, string | null>()
for (const m of mails) {
  if (m.tipo_manual || String(m.asunto ?? "").startsWith("[Registro de mails]")) continue
  const quien = m.sentido === "enviado" ? String(m.destinatarios ?? "").split(",")[0] : m.remitente
  reglaNueva.set(m.id, clasificarConReglas(simuladas, quien, m.asunto).regla_id)
}

// ── Controles ─────────────────────────────────────────────────────────────────────────────────────────
const nombreNuevo: Record<string, string> = Object.fromEntries([...tiposHoy.map(t => [t.id, t.nombre]), ...DEC.tipos.map((t: any) => [t.id, t.nombre])])
const sinReglaDespues = recibidos.filter(m => !m.tipo_manual && !reglaNueva.get(m.id))
const asuntoRems = new Set(DEC.porAsunto.map((a: any) => a.remitente))
const fuera = recibidos.filter(m => {
  const rem = String(m.remitente || "").toLowerCase().trim()
  if (m.tipo_manual || asuntoRems.has(rem) || [...asuntoRems].some((p: any) => p.startsWith("@") && rem.endsWith(p))) return false
  return despues.get(m.id)!.tipo !== porRem.get(rem)?.tipo
})
const cuenta = (f: (x: any) => string, lista: any[]) => { const m = new Map<string, number>(); for (const x of lista) m.set(f(x), (m.get(f(x)) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]) }
const ACC: Record<string, string> = { avisar: "Tarea", guardar: "Reporte", archivar: "Archivar" }

console.log(`\n📬 Script 272 — ${APLICAR ? "APLICANDO" : "EN SECO (no escribe nada)"}`)
console.log(`\n1 · GRUPOS (bloques):`)
for (const t of DEC.tipos) {
  const hoy = tiposHoy.find(x => x.id === t.id)
  console.log(`   ${String(t.orden).padStart(3)} ${t.nombre}${t.nuevo ? "  🆕" : hoy && hoy.nombre !== t.nombre ? `  (hoy «${hoy.nombre}»)` : ""}`)
}
console.log(`   en desuso (al fondo, no se borran): ${DEC.enDesuso.map((id: string) => tiposHoy.find(x => x.id === id)?.nombre ?? id).join(", ")}`)
console.log(`\n2 · REGLAS: ${nuevas.length} nuevas (${nuevas.filter(r => r.remitente_patron.startsWith("@") && !r.asunto_patron).length} por dominio, ${nuevas.filter(r => !r.remitente_patron.startsWith("@") && !r.asunto_patron).length} por remitente, ${nuevas.filter(r => r.asunto_patron).length} por asunto) · se desactivan ${reglasHoy.filter(r => r.activa).length} de hoy`)
console.log(`\n3 · MAILS: ${cambios.length} cambian de grupo o acción (de ${mails.length}; ${recibidos.length} recibidos)`)
console.log(`   Cómo quedan los RECIBIDOS por grupo y acción:`)
for (const [k, n] of cuenta(m => { const d = despues.get(m.id)!; return `${nombreNuevo[d.tipo ?? ""] ?? "sin grupo"} · ${ACC[d.accion ?? ""] ?? "-"}` }, recibidos)) console.log(`     ${String(n).padStart(5)}  ${k}`)
console.log(`   Los cambios más grandes (antes → después):`)
for (const [k, n] of cuenta(c => `${c.antes} → ${c.tipo}/${c.accion}`, cambios).slice(0, 14)) console.log(`     ${String(n).padStart(5)}  ${k}`)
console.log(`\nCONTROLES`)
console.log(`   (a) recibidos sin regla después: ${sinReglaDespues.length} ${sinReglaDespues.length ? "🛑" : "✓"}`)
console.log(`   (b) recibidos fuera del bloque decidido: ${fuera.length} ${fuera.length ? "🛑 " + [...new Set(fuera.map(m => m.remitente))].slice(0, 5).join(", ") : "✓"}`)
console.log(`   (c) corregidos a mano que no se tocan: ${mails.filter(m => m.tipo_manual).length}`)
const ok = !sinReglaDespues.length && !fuera.length
if (!APLICAR) { console.log(`\n${ok ? "✓ todo cierra" : "🛑 NO cierra"} — en seco, no se escribió nada.`); process.exit(0) }
if (!ok) throw new Error("🛑 Los controles no cierran: no se aplica.")
if (existsSync(FOTO)) throw new Error(`🛑 Ya existe la foto ${FOTO}: no se pisa.`)

// ── Aplicar ───────────────────────────────────────────────────────────────────────────────────────────
writeFileSync(FOTO, JSON.stringify({
  fecha: new Date().toISOString(), tipos: tiposHoy, reglasActivas: reglasHoy.filter(r => r.activa).map(r => r.id),
  mails: mails.filter(m => reglaNueva.has(m.id)).map(m => ({ id: m.id, tipo: m.tipo, accion: m.accion, regla_id: m.regla_id })),
}, null, 1))
// 1 · tipos
const nuevosTipos = DEC.tipos.filter((t: any) => !tiposHoy.some(x => x.id === t.id))
if (nuevosTipos.length) { const { error } = await sb.from("mails_tipos").insert(nuevosTipos.map((t: any) => ({ id: t.id, nombre: t.nombre, orden: t.orden, nota: MARCA }))); if (error) throw error }
for (const t of DEC.tipos.filter((t: any) => tiposHoy.some(x => x.id === t.id))) {
  const { error } = await sb.from("mails_tipos").update({ nombre: t.nombre, orden: t.orden }).eq("id", t.id); if (error) throw error
}
let o = 900
for (const id of DEC.enDesuso) { const { error } = await sb.from("mails_tipos").update({ orden: o++, nota: `${MARCA} en desuso` }).eq("id", id); if (error) throw error }
// 2 · reglas: crear las nuevas, después desactivar las de hoy
const { data: creadas, error: eIns } = await sb.from("mails_reglas").insert(nuevas).select("id,remitente_patron,asunto_patron")
if (eIns) throw eIns
const idsHoy = reglasHoy.filter(r => r.activa).map(r => r.id)
{ const { error } = await sb.from("mails_reglas").update({ activa: false }).in("id", idsHoy); if (error) throw error }
// 3 · mails: con las reglas reales
const reales = (await todo(() => sb.from("mails_reglas").select("*").eq("activa", true))) as ReglaMail[]
const grupos = new Map<string, string[]>()
for (const m of mails) {
  if (!reglaNueva.has(m.id)) continue
  const quien = m.sentido === "enviado" ? String(m.destinatarios ?? "").split(",")[0] : m.remitente
  const c = clasificarConReglas(reales, quien, m.asunto)
  if (c.regla_id === m.regla_id && c.tipo === m.tipo && c.accion === m.accion) continue
  const k = JSON.stringify(c); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k)!.push(m.id)
}
let n = 0
for (const [k, ids] of grupos) {
  const c = JSON.parse(k)
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb.from("mails_registro").update({ tipo: c.tipo, accion: c.accion, regla_id: c.regla_id }).in("id", ids.slice(i, i + 200))
    if (error) throw error
  }
  n += ids.length
}
// Control después, leído de la base
const reg = await todo(() => sb.from("mails_registro").select("id,sentido,regla_id,tipo_manual").eq("sentido", "recibido"))
const sinR = reg.filter(m => !m.regla_id && !m.tipo_manual).length
console.log(`\n✓ Aplicado: ${nuevosTipos.length} grupos nuevos, ${creadas!.length} reglas nuevas, ${idsHoy.length} desactivadas, ${n} mails reclasificados.`)
console.log(`   Control en la base: recibidos ${reg.length} (antes ${recibidos.length}) · sin regla ${sinR} ${reg.length === recibidos.length && !sinR ? "✓" : "🛑"}`)
console.log(`   Foto para el deshacer: ${FOTO}`)
