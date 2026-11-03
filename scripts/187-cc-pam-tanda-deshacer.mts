/**
 * ↩️ Deshacer del script 187 — restaura movimientos (CC y CA de PAM, CA Cotitulares) y cuotas tocadas desde `scripts/187-foto-antes.json`,
 * y borra SÓLO las cuotas y el template creados (`scripts/187-hecho.json`).
 *
 *     npx tsx scripts/187-cc-pam-tanda-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/187-cc-pam-tanda-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/187-foto-antes.json", "utf8"))
const hecho = JSON.parse(readFileSync("scripts/187-hecho.json", "utf8")) as { templates: string[]; cuotas: string[] }
const MOV = ["estado", "categ", "template_id", "template_cuota_id", "comprobantes_pagados", "motivo_revision", "nota_operador", "contable"]
const COT = [...MOV, "por_cuenta_de", "par_schema", "par_tabla", "par_id"]
const lotes: [string, any[], string[]][] = [["pam_galicia_cc", foto["public.pam_galicia_cc"], MOV], ["pam_galicia", foto["public.pam_galicia"], MOV],
  ["cotitulares_ca_pesos", foto["public.cotitulares_ca_pesos"], COT], ["cuotas_egresos_sin_factura", foto.cuotas, ["monto", "estado", "fecha_pago"]]]
const nuestros = new Set([...foto["public.pam_galicia_cc"], ...foto["public.pam_galicia"]].map((m: any) => m.id))
const ninguno = ["00000000-0000-0000-0000-000000000000"]
const ajenos: any[] = []
for (const t of ["pam_galicia_cc", "pam_galicia"]) {
  const { data } = await sb.from(t).select("id").in("template_cuota_id", hecho.cuotas.length ? hecho.cuotas : ninguno)
  ajenos.push(...(data ?? []).filter((u: any) => !nuestros.has(u.id)))
}
const { data: otras } = await sb.from("cuotas_egresos_sin_factura").select("id").in("egreso_id", hecho.templates.length ? hecho.templates : ninguno)
const cuotasAjenas = (otras ?? []).filter((q: any) => !hecho.cuotas.includes(q.id))
console.log(`Restaura ${lotes.reduce((t, l) => t + l[1].length, 0)} filas · borra ${hecho.cuotas.length} cuotas y ${hecho.templates.length} template`)
if (ajenos.length || cuotasAjenas.length) { console.log("🛑 FRENA: hay movimientos o cuotas que el 187 no creó usando lo suyo"); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const [t, filas, cols] of lotes) for (const f of filas) {
  const { error } = await sb.from(t).update(Object.fromEntries(cols.map(c => [c, f[c]]))).eq("id", f.id); if (error) throw new Error(`${t} ${f.id}: ${error.message}`)
}
if (hecho.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", hecho.cuotas); if (error) throw error }
if (hecho.templates.length) { const { error } = await sb.from("egresos_sin_factura").delete().in("id", hecho.templates); if (error) throw error }
console.log("✅ Deshecho.")
