/**
 * ↩️ Deshacer del script 183 — restaura movimientos, facturas y la propagación de cuenta desde `scripts/183-foto-antes.json`.
 * El 183 no crea filas, así que no borra nada.
 *
 *     npx tsx scripts/183-ca-ma-tanda-3-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/183-ca-ma-tanda-3-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/183-foto-antes.json", "utf8"))
const de = (k: string) => { const [s, t] = k.split("."); return s === "public" ? sb.from(t) : sb.schema(s).from(t) }
const MOV = ["estado", "categ", "nro_cuenta", "detalle", "contable", "motivo_revision", "nota_operador", "comprobante_arca_id"]
const FC = ["estado", "cuenta_contable", "nro_cuenta", "fecha_pago", "observaciones_pago"]
const lotes: [string, any[], string[]][] = [["ma.ma_galicia", foto["ma.ma_galicia"], MOV], ["ma.comprobantes_arca", foto["ma.comprobantes_arca"], FC],
  ...Object.entries(foto.propagacion as Record<string, any[]>).map(([k, f]) => [k, f, ["categ", "nro_cuenta"]] as [string, any[], string[]])]
console.log(`Restaura ${lotes.reduce((t, l) => t + l[1].length, 0)} filas`)
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const [k, filas, cols] of lotes) for (const f of filas) {
  const { error } = await de(k).update(Object.fromEntries(cols.map(c => [c, f[c]]))).eq("id", f.id); if (error) throw new Error(`${k} ${f.id}: ${error.message}`)
}
console.log("✅ Deshecho.")
