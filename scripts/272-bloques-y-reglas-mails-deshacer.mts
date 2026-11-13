/**
 * ↩️ DESHACER del script 272 (bloques de mail + reglas). Vuelve EXACTAMENTE a la foto del antes.
 *
 *     npx tsx scripts/272-bloques-y-reglas-mails-deshacer.mts            ← en seco: muestra qué haría
 *     npx tsx scripts/272-bloques-y-reglas-mails-deshacer.mts --aplicar
 *
 * Sólo toca lo que creó o cambió el 272 (CLAUDE.md § 🛑 Datos), verificado en la base:
 *   - mails: vuelve tipo / acción / regla de los ids de la foto (los que el 272 recalculó);
 *   - reglas: reactiva las que estaban activas en la foto y BORRA sólo las que tienen la marca `[script 272]`;
 *   - grupos: vuelve nombre / orden / nota de los que existían, y borra los creados por el 272 (marca en la nota)
 *     sólo si ningún mail ni regla los usa.
 * Un mail registrado DESPUÉS del 272 con una regla nueva queda con su regla en null y el tipo que tenía (el GAS lo
 * reclasifica con las reglas reactivadas en su próxima pasada sólo si es nuevo; si no, queda para reaplicar desde Mails).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const APLICAR = process.argv.includes("--aplicar")
const MARCA = "[script 272]"
const FOTO = JSON.parse(readFileSync(join("- Comunicacion JMS Claude - Archivos", "Mails", "272 foto antes - FUERA DE GIT.json"), "utf8"))

const reglas = (await sb.from("mails_reglas").select("id,nota,activa")).data ?? []
const marcadas = reglas.filter(r => String(r.nota ?? "").includes(MARCA)).map(r => r.id)
const aReactivar = FOTO.reglasActivas as string[]
const tiposFoto = FOTO.tipos as any[]
const tiposHoy = (await sb.from("mails_tipos").select("*")).data ?? []
const creadosTipo = tiposHoy.filter(t => String(t.nota ?? "") === MARCA && !tiposFoto.some(f => f.id === t.id)).map(t => t.id)
console.log(`↩️ Deshacer 272 — ${APLICAR ? "APLICANDO" : "EN SECO"}`)
console.log(`   mails a restaurar: ${FOTO.mails.length} · reglas a borrar (marca ${MARCA}): ${marcadas.length} · a reactivar: ${aReactivar.length} · grupos creados a borrar: ${creadosTipo.join(", ") || "—"}`)
if (!APLICAR) process.exit(0)

// 1 · mails (antes de borrar reglas: el FK pondría null)
const grupos = new Map<string, string[]>()
for (const m of FOTO.mails) { const k = JSON.stringify({ tipo: m.tipo, accion: m.accion, regla_id: m.regla_id }); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k)!.push(m.id) }
for (const [k, ids] of grupos) for (let i = 0; i < ids.length; i += 200) {
  const { error } = await sb.from("mails_registro").update(JSON.parse(k)).in("id", ids.slice(i, i + 200)); if (error) throw error
}
// 2 · reglas
for (let i = 0; i < aReactivar.length; i += 200) { const { error } = await sb.from("mails_reglas").update({ activa: true }).in("id", aReactivar.slice(i, i + 200)); if (error) throw error }
for (let i = 0; i < marcadas.length; i += 200) { const { error } = await sb.from("mails_reglas").delete().in("id", marcadas.slice(i, i + 200)); if (error) throw error }
// 3 · grupos
for (const t of tiposFoto) { const { error } = await sb.from("mails_tipos").update({ nombre: t.nombre, orden: t.orden, nota: t.nota }).eq("id", t.id); if (error) throw error }
for (const id of creadosTipo) {
  const { count: enMails } = await sb.from("mails_registro").select("id", { count: "exact", head: true }).or(`tipo.eq.${id},tipo_manual.eq.${id}`)
  const { count: enReglas } = await sb.from("mails_reglas").select("id", { count: "exact", head: true }).eq("tipo", id)
  if (enMails || enReglas) { console.log(`   ⚠️ el grupo «${id}» sigue en uso (${enMails} mails, ${enReglas} reglas): no se borra`); continue }
  const { error } = await sb.from("mails_tipos").delete().eq("id", id); if (error) throw error
}
console.log("✓ Deshecho.")
