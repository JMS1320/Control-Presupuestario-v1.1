/**
 * Deshace 137 · vuelve a dejar el resumen VISA PAM 25-01 como estaba antes (la foto, con sus mismos ids).
 *
 *     npx tsx scripts/137-recargar-visa-pam-2025-01-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/137-recargar-visa-pam-2025-01-deshacer.mts --escribir   ← lo hace (🛑 con OK de JMS)
 *
 * Borra SÓLO las filas que insertó el 137 (`…-ids.json`) y FRENA si alguna ya se trabajó. Después reinserta la
 * foto (`Extractos/137 foto antes - VISA PAM 25-01.json` en la carpeta de comunicación, fuera de git) tal cual.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const ESCRIBIR = process.argv.includes("--escribir")
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const tabla = () => sb.schema("pam").from("tarjeta_visa")

const ids: string[] = JSON.parse(readFileSync("scripts/137-recargar-visa-pam-2025-01-ids.json", "utf8"))
const foto: any[] = JSON.parse(readFileSync("../Control-Presupuestario-v1.1/- Comunicacion JMS Claude - Archivos/Extractos/137 foto antes - VISA PAM 25-01.json", "utf8"))
const VINCULOS = ["categ", "nro_cuenta", "template_id", "template_cuota_id", "comprobante_arca_id", "anticipo_id", "sueldo_pago_id"]

const { data: nuevas } = await tabla().select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
const trabajadas = (nuevas ?? []).filter(f => VINCULOS.some(k => f[k] !== null && f[k] !== "") || !["pendiente", "total"].includes(f.estado))
if (trabajadas.length) { console.log(`🛑 ${trabajadas.length} fila(s) del 137 ya se trabajaron: no se deshace sin decidirlo con JMS.`); process.exit(1) }
const { data: yaEstan } = await tabla().select("id").in("id", foto.map(f => f.id))
console.log(`Borraría ${nuevas?.length ?? 0} filas del 137 y reinsertaría ${foto.length - (yaEstan?.length ?? 0)} de la foto (de ${foto.length}).`)
if (!ESCRIBIR) process.exit(0)

if (ids.length) { const { error } = await tabla().delete().in("id", ids); if (error) throw error }
const faltan = foto.filter(f => !(yaEstan ?? []).some(y => y.id === f.id))
if (faltan.length) { const { error } = await tabla().insert(faltan); if (error) throw error }
console.log("✓ Resumen 25-01 vuelto a como estaba.")
