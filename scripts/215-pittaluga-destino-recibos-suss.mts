/**
 * Script 215 (A-FEAT-1559, 06/11 — OK de JMS en esta terminal: «1 sí»): la carpeta donde el script `pittaluga()` de JMS guarda
 * los adjuntos del contador de MA (Drive `SAN MANUEL / SUELDOS - altas - bajas - legajos / Recibos - SUSS`) pasa a ser un
 * DESTINO del archivo (`public.archivo_destinos`) y se le asigna a la regla de ese remitente (`mails_reglas`). Con eso, en
 * Mails → «Para guardar» sus mails se archivan ahí con un clic, con el mismo nombre «aaaa-mm-dd - documento» y sin duplicar.
 *
 *   npx tsx scripts/215-pittaluga-destino-recibos-suss.mts             → foto en scripts/215-foto.json y aplica
 *   npx tsx scripts/215-pittaluga-destino-recibos-suss.mts --deshacer  → borra el destino creado y deja la regla como estaba
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const FOTO = "scripts/215-foto.json"
const CLAVE = "sueldos_recibos_suss"
const REMITENTE = "mpittalugaa@gmail.com"

if (process.argv.includes("--deshacer")) {
  const f = JSON.parse(readFileSync(FOTO, "utf8"))
  const { error } = await sb.from("mails_reglas").update({ archivo_destino: f.regla.archivo_destino }).eq("id", f.regla.id)
  if (error) throw error
  const { error: e2 } = await sb.from("archivo_destinos").delete().eq("clave", CLAVE).like("nota", "[script 215]%")
  if (e2) throw e2
  console.log("deshecho: regla como estaba y destino borrado")
  process.exit(0)
}
if (existsSync(FOTO)) throw new Error("ya hay una foto: el script ya corrió")
const { data: ya } = await sb.from("archivo_destinos").select("clave").eq("clave", CLAVE)
if (ya?.length) throw new Error("el destino ya existe: no se toca")
const { data: reglas, error: e1 } = await sb.from("mails_reglas").select("id, archivo_destino, remitente_patron, tipo, accion").eq("remitente_patron", REMITENTE)
if (e1) throw e1
if (reglas!.length !== 1) throw new Error(`se esperaba 1 regla de ${REMITENTE} y hay ${reglas!.length}`)
writeFileSync(FOTO, JSON.stringify({ regla: reglas![0] }, null, 1))
const { error: e3 } = await sb.from("archivo_destinos").insert({
  clave: CLAVE, nombre: "Recibos - SUSS (contador de MA)", por_anio: false,
  ruta: "SAN MANUEL/SUELDOS - altas - bajas - legajos/Recibos - SUSS",
  ruta_drive: "SAN MANUEL/SUELDOS - altas - bajas - legajos/Recibos - SUSS",
  drive_folder_id: "1ZTiY8uPVRl30t-g2C4iCmctmP73d5O1J",
  nota: "[script 215] la carpeta del script pittaluga() de JMS: VEP 931, UATRE, recibos, altas (A-FEAT-1559)",
})
if (e3) throw e3
const { error: e4 } = await sb.from("mails_reglas").update({ archivo_destino: CLAVE }).eq("id", reglas![0].id)
if (e4) throw e4
const { data: ctl } = await sb.from("mails_reglas").select("remitente_patron, tipo, accion, archivo_destino").eq("id", reglas![0].id).single()
console.log("control:", JSON.stringify(ctl))
