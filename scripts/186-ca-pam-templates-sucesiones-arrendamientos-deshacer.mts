/**
 * ↩️ Deshacer del script 186 — desata los movimientos de PAM (foto `scripts/186-foto-antes.json`) y borra SÓLO las cuotas,
 * templates y cuentas que creó (`scripts/186-hecho.json`).
 *
 *     npx tsx scripts/186-ca-pam-templates-sucesiones-arrendamientos-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/186-ca-pam-templates-sucesiones-arrendamientos-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/186-foto-antes.json", "utf8"))
const hecho = JSON.parse(readFileSync("scripts/186-hecho.json", "utf8")) as { cuentas: string[]; templates: string[]; cuotas: string[] }
const ids = new Set(foto["public.pam_galicia"].map((m: any) => m.id))
const ninguno = ["00000000-0000-0000-0000-000000000000"]
const { data: cuotas } = await sb.from("cuotas_egresos_sin_factura").select("id").in("egreso_id", hecho.templates.length ? hecho.templates : ninguno)
const ajenas = (cuotas ?? []).filter((q: any) => !hecho.cuotas.includes(q.id))
const usan: any[] = []
for (const t of ["pam_galicia", "pam_galicia_cc", "msa_galicia"]) {
  const { data } = await sb.from(t).select("id").in("template_cuota_id", hecho.cuotas.length ? hecho.cuotas : ninguno)
  usan.push(...(data ?? []).filter((u: any) => !ids.has(u.id)))
}
console.log(`Desata ${ids.size} movimientos · borra ${hecho.cuotas.length} cuotas, ${hecho.templates.length} templates y ${hecho.cuentas.length} cuentas`)
if (ajenas.length || usan.length) { console.log("🛑 FRENA: hay cuotas o movimientos que el 186 no creó usando lo suyo"); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const m of foto["public.pam_galicia"]) {
  const { error } = await sb.from("pam_galicia").update({ template_id: m.template_id, template_cuota_id: m.template_cuota_id, comprobantes_pagados: m.comprobantes_pagados,
    nota_operador: m.nota_operador }).eq("id", m.id); if (error) throw error
}
if (hecho.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", hecho.cuotas); if (error) throw error }
if (hecho.templates.length) { const { error } = await sb.from("egresos_sin_factura").delete().in("id", hecho.templates); if (error) throw error }
if (hecho.cuentas.length) { const { error } = await sb.from("cuentas_contables").delete().in("id", hecho.cuentas); if (error) throw error }
console.log("✅ Deshecho.")
