/**
 * Deshace 136 · la carga de resúmenes PDF (A-FEAT-1424).
 *
 *     npx tsx scripts/136-cargar-resumenes-pdf-deshacer.mts              ← dice qué borraría
 *     npx tsx scripts/136-cargar-resumenes-pdf-deshacer.mts --escribir   ← borra (🛑 con OK de JMS)
 *
 * Borra SÓLO los ids que el 136 dejó en `136-cargar-resumenes-pdf-ids.json` — nunca «todo lo de la tabla».
 * Y FRENA si alguno ya se trabajó: conciliado (estado distinto del que puso el 136), con cuenta contable,
 * template, cuota, factura, anticipo, sueldo o grupo vinculado. Eso es trabajo de JMS: se decide con él.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const ESCRIBIR = process.argv.includes("--escribir")
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const db = (schema: string) => (schema === "public" ? sb : sb.schema(schema))

const ids: Record<string, string[]> = JSON.parse(readFileSync("scripts/136-cargar-resumenes-pdf-ids.json", "utf8"))
const VINCULOS = ["categ", "nro_cuenta", "template_id", "template_cuota_id", "comprobante_arca_id", "anticipo_id", "sueldo_pago_id", "par_id"]
const ESTADOS_DEL_136 = ["pendiente", "Pendiente", "total"]

const frenos: string[] = []
for (const [clave, lista] of Object.entries(ids)) {
  const [schema, tabla] = clave.split(".")
  let n = 0
  for (let i = 0; i < lista.length; i += 200) {
    const { data, error } = await db(schema).from(tabla).select("*").in("id", lista.slice(i, i + 200))
    if (error) { frenos.push(`${clave}: ${error.message}`); break }
    n += data?.length ?? 0
    for (const f of data ?? []) {
      const vinc = VINCULOS.filter(k => k in f && f[k] !== null && f[k] !== "")
      if (vinc.length || !ESTADOS_DEL_136.includes(f.estado)) {
        frenos.push(`${clave} ${f.fecha} «${String(f.descripcion).slice(0, 40)}»: estado ${f.estado}${vinc.length ? ` · ${vinc.join(", ")}` : ""}`)
      }
    }
  }
  console.log(`${clave}: ${n} de ${lista.length} siguen en la base`)
}
if (frenos.length) {
  console.log(`\n🛑 NO SE BORRA NADA — ${frenos.length} fila(s) ya trabajadas (decidir con JMS):`)
  for (const f of frenos.slice(0, 30)) console.log("   " + f)
  process.exit(1)
}
if (!ESCRIBIR) { console.log("\n(simulación: con --escribir borra exactamente esos ids)"); process.exit(0) }
for (const [clave, lista] of Object.entries(ids)) {
  const [schema, tabla] = clave.split(".")
  for (let i = 0; i < lista.length; i += 200) {
    const { error } = await db(schema).from(tabla).delete().in("id", lista.slice(i, i + 200))
    if (error) { console.error(`❌ ${clave}: ${error.message}`); process.exit(1) }
  }
  console.log(`✓ ${clave}: borradas ${lista.length}`)
}
