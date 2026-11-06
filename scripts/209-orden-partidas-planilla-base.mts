/**
 * Script 209 (A-FEAT-1569, 06/11 — OK de JMS en esta terminal: «sí cargalo»): el orden de las partidas de JMS pasa a ser el de
 * su planilla base, el Excel «INMOBILIARIO RED VIAL AUTOMOTOR 2026» (hoja INMOBILIARIO): MSA (Rojas, Tango Parra 1 y 2, Tango
 * Prim Leboso, Cholo 1 y 2, Portería Nuevo y Viejo, Sánchez, Anexo), PAM Nazarenas (Casco, Tapera 1-3, Ombú, Entre Ríos),
 * PAM ERM (El Relincho, Quinta Rosello 1 y 2). Lo que tenía guardado y no figura ahí (Lima, Lote Puerto, Fondo educativo)
 * va después. Sólo toca `user_metadata.preferencias.ordenPartidas` de JMS; el resto de sus preferencias queda igual.
 *
 *   npx tsx scripts/209-orden-partidas-planilla-base.mts             → foto en scripts/209-foto.json y aplica
 *   npx tsx scripts/209-orden-partidas-planilla-base.mts --deshacer  → vuelve al orden de la foto
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const FOTO = "scripts/209-foto.json"
const MAIL = "josemartinezsobrado@gmail.com"
const BASE = ["rojas", "tango parra 1", "tango parra 2", "tango prim leboso", "cholo 1", "cholo 2", "porteria nuevo", "porteria viejo", "sanchez", "anexo",
  "casco", "tapera 1", "tapera 2", "tapera 3", "ombu", "entre rios", "el relincho", "quinta rosello 1", "quinta rosello 2"]

const { data: lista, error } = await sb.auth.admin.listUsers({ perPage: 200 })
if (error) throw error
const u = lista.users.find(x => x.email === MAIL)
if (!u) throw new Error("no está la cuenta de JMS")
const prefs = (u.user_metadata?.preferencias ?? {}) as Record<string, unknown>

const guardar = async (orden: unknown) => {
  const { error: e } = await sb.auth.admin.updateUserById(u.id, { user_metadata: { ...u.user_metadata, preferencias: { ...prefs, ordenPartidas: orden } } })
  if (e) throw e
}

if (process.argv.includes("--deshacer")) {
  const f = JSON.parse(readFileSync(FOTO, "utf8"))
  await guardar(f.ordenPartidas)
  console.log("deshecho: el orden volvió a", JSON.stringify(f.ordenPartidas))
  process.exit(0)
}
if (existsSync(FOTO)) throw new Error("ya hay una foto: el script ya corrió")
const viejo = Array.isArray(prefs.ordenPartidas) ? (prefs.ordenPartidas as string[]) : null
writeFileSync(FOTO, JSON.stringify({ ordenPartidas: viejo }, null, 1))
const nuevo = [...BASE, ...[...new Set(viejo ?? [])].filter(k => !BASE.includes(k))]
await guardar(nuevo)
const { data: ctl } = await sb.auth.admin.getUserById(u.id)
console.log("ahora:", JSON.stringify((ctl.user?.user_metadata?.preferencias as Record<string, unknown>)?.ordenPartidas))
