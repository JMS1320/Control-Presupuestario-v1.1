/**
 * ▶️ Corre el script 229 (o su deshacer) línea por línea por la API, con la MISMA condición del .sql: cambia `contable` sólo si la
 * columna todavía dice exactamente lo que se leyó al generar. Cuenta lo que cambió de verdad. OK de JMS 07/11: «corré todo junto».
 *
 *     npx tsx scripts/229-correr.mts [scripts/229-codigos-contable-nuevos.sql]
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const archivo = process.argv[2] ?? "scripts/229-codigos-contable-nuevos.sql"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const desde = (tabla: string) => { const [s, t] = tabla.split("."); return s === "public" ? sb.from(t) : sb.schema(s).from(t) }
const valor = (x: string) => (x === "null" ? null : x.slice(1, -1).replace(/''/g, "'"))
const LIT = "(null|'(?:[^']|'')*')"
const re = new RegExp(`^update (\\S+) set contable = ${LIT} where id = '([0-9a-f-]+)' and contable is not distinct from ${LIT};$`)

let ok = 0, nada = 0, mal = 0
const noAplicadas: string[] = []
for (const l of readFileSync(archivo, "utf8").split(/\r?\n/)) {
  if (!l.startsWith("update ")) continue
  const m = re.exec(l)
  if (!m) { mal++; noAplicadas.push(`NO SE ENTENDIÓ: ${l.slice(0, 120)}`); continue }
  const [, tabla, nuevoLit, id, viejoLit] = m
  const nuevo = valor(nuevoLit), viejo = valor(viejoLit)
  let q = desde(tabla).update({ contable: nuevo }).eq("id", id)
  q = viejo === null ? q.is("contable", null) : q.eq("contable", viejo)
  const { data, error } = await q.select("id")
  if (error) { mal++; noAplicadas.push(`${tabla} ${id}: ${error.message}`); continue }
  if ((data ?? []).length === 1) ok++
  else { nada++; noAplicadas.push(`${tabla} ${id}: no cambió (ya no decía «${viejo ?? "(vacío)"}»)`) }
}
console.log(`${archivo}: ${ok} cambiados · ${nada} sin cambio · ${mal} con error`)
for (const x of noAplicadas.slice(0, 30)) console.log("  ", x)
