/**
 * 🔁 Corre el control «ANUAL o CUOTAS» (A-FEAT-1582) sobre la base y lista lo que salta. SÓLO LEE.
 *   npx tsx scripts/control-modalidad-templates.mts [año en curso]
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { cargarProblemasDeModalidad } from "../lib/templates/modalidad"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const anio = Number(process.argv[2]) || Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 4))

const r = await cargarProblemasDeModalidad(sb, anio)
console.log(`año en curso ${anio} · cuentas que no se pudieron leer: ${r.tablasQueFallaron.join(", ") || "ninguna"}`)
const por = new Map<string, number>()
for (const p of r.problemas) por.set(p.titulo, (por.get(p.titulo) ?? 0) + 1)
for (const [t, n] of por) console.log(`  ${n} × ${t}`)
for (const p of r.problemas) console.log(`${p.titulo} | ${p.template} (${p.anio ?? "s/año"}) | ${p.cuotas.map(c => `${c.fecha} $${c.monto} ${c.estado}`).join("; ").slice(0, 220)}`)
