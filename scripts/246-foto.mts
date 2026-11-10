import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const sel = "id, fecha, descripcion, debitos, debitos_usd, contable, interno, nota_operador, template_cuota_id"
const out: any[] = []
for (const [schema, tabla] of [["pam", "tarjeta_visa"], ["public", "pam_galicia"]]) {
  const { data, error } = await sb.schema(schema).from(tabla).select(sel.replace(", debitos_usd", tabla === "tarjeta_visa" ? ", debitos_usd" : "")).not("template_cuota_id", "is", null).gte("fecha", "2025-07-01").lte("fecha", "2026-07-31").limit(5000)
  if (error) throw error
  const ids = [...new Set(data.map((m: any) => m.template_cuota_id))]
  const ma = new Set<string>()
  for (let i = 0; i < ids.length; i += 200) { const { data: c } = await sb.from("cuotas_egresos_sin_factura").select("id, egreso:egresos_sin_factura!inner(responsable)").in("id", ids.slice(i, i + 200)); for (const x of c ?? []) if (String(x.egreso.responsable ?? "").toUpperCase().startsWith("MA")) ma.add(x.id) }
  for (const m of data) if (ma.has(m.template_cuota_id) && !String(m.contable ?? "").trim()) out.push({ tabla: `${schema}.${tabla}`, ...m })
}
console.log(out.length, out.map(m => m.interno).filter(x => x !== "DIST MA").length, "sin interno DIST MA")
writeFileSync("scripts/246-foto-antes.json", JSON.stringify(out, null, 1))
