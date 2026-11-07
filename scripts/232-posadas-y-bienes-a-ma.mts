/**
 * 232 · POSADAS Y LOS BIENES DE PAM QUE PASARON A MA (DATOS) — A-FEAT-1577. OK JMS 07/11:
 *   «si está activo el anual debe estar desactivado los mensuales» · «lo que pasó a MA ponelo como MA» · «hay que chequear los responsables y las reglas».
 *
 *   1. ABL Cochera Posadas Cuota 2026: las 12 mensuales → desactivado (se pagó el ANUAL el 30/01/26; ninguna tiene movimiento ni grupo).
 *   2. Templates 2026 de bienes de PAM que son de MA desde el 01/01/26 (Posadas, inmobiliario y Red Vial de Casco, Entre Ríos, Ombú,
 *      Tapera 1-3): responsable PAM → MA. Quedan en PAM: El Relincho y Quinta Rosello (lib/balance/dueno-de-bienes.ts). No se tocan
 *      el «Complementario PAM» ni el «Fondo Educativo» (a confirmar con JMS).
 *   3. Regla específica de Galicia MSA para Expensas Posadas 2026: contable CTA PAM → CTA MA (los pagos ya los corrigió el 231; la regla
 *      los iba a volver a poner mal en las próximas conciliaciones).
 *
 *     npx tsx scripts/232-posadas-y-bienes-a-ma.mts   → foto (scripts/232-foto-antes.json) + 232-…sql y su deshacer. SÓLO LEE.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const ABL_MENSUAL_2026 = "b90e4a60-c228-4090-87f6-e6575723dad4"
const A_MA = [
  "3a421cff-4452-4562-93d9-33f2526b564e", "b90e4a60-c228-4090-87f6-e6575723dad4", "29cfe388-102e-4f53-871d-4b3a6a4971c8", // Posadas: ABL anual, ABL cuota, expensas
  "4d94bcfd-1aab-4f68-bd51-174bc21e796b", "410b8172-5691-46d9-a42a-a7bf1c822684", "38410a2d-2125-4c48-96a5-84d982912092",   // Inmobiliario anual
  "216ea7db-9b47-4eb8-84d4-38476b4e13fe", "b2066bc9-6498-4c6c-9f38-c677d469e9c2", "01e2e08d-38d8-4312-8848-4f822cf87f05",
  "a36f8ce0-0d15-4e5a-b1a7-8c7065111e3f", "890f5bd9-950c-44a1-8ac5-69b031ced112", "3cb1f9f3-c689-4f1e-9a46-ee377fdcff97",   // Inmobiliario cuota
  "3dc6b92e-fc3a-4e30-bf34-183e0feae5a0", "727d949b-ce55-4832-8cb7-7edfdf566f54", "a96cc66c-34c7-4379-9816-839705c01f63",
  "d639939e-75d0-4035-9d76-66985fe73849", "3e87e1d8-50be-4ad6-8460-370deca4eaeb", "b727bfb9-5d4d-4f77-bfa9-2ec4346fab1b",   // Red Vial anual
  "741b390a-27aa-410c-8775-0c0528cf47d7", "02d85fcb-c861-47e1-9e95-d53171ab2b51", "c05288ce-063c-4f68-a2f9-5e31025429e4",
  "b97e4512-aac5-40ba-a8cd-9d3ca84ec811", "1a2a7c93-a71b-45b3-8c01-7507f9cddb6a", "2f286533-1471-4a43-a666-1d8b51a8c575",   // Red Vial cuota
  "d7f4783d-43f4-4897-b85f-06e273e27971", "46d870e0-1886-4052-a3d5-93695b661d5b", "c483785e-c665-4f95-b540-0766bd036d05",
]
const lit = (x: string | null) => (x == null ? "null" : `'${String(x).replace(/'/g, "''")}'`)

const { data: tpls, error: e1 } = await sb.from("egresos_sin_factura").select("*").in("id", A_MA)
if (e1) throw new Error(e1.message)
if (tpls.length !== A_MA.length) throw new Error(`esperaba ${A_MA.length} templates y vinieron ${tpls.length}`)
for (const t of tpls) {
  if (t.responsable !== "PAM" || String(t.año) !== "2026" || /relincho|rosell/i.test(t.nombre_referencia)) throw new Error(`no corresponde: ${t.nombre_referencia} ${t.año} ${t.responsable}`)
}
const { data: cuotas, error: e2 } = await sb.from("cuotas_egresos_sin_factura").select("*").eq("egreso_id", ABL_MENSUAL_2026)
if (e2) throw new Error(e2.message)
if (cuotas.length !== 12 || cuotas.some((c: any) => c.grupo_pago_id)) throw new Error("las mensuales del ABL 2026 no son las 12 esperadas sin grupo")
const { data: reglas, error: e3 } = await sb.from("reglas_contable_interno").select("*").eq("template_id", "29cfe388-102e-4f53-871d-4b3a6a4971c8").eq("cuenta_bancaria_id", "msa_galicia")
if (e3) throw new Error(e3.message)
if (reglas.length !== 1 || reglas[0].codigo_contable !== "CTA PAM") throw new Error("la regla de Expensas Posadas no está como se leyó")

if (existsSync("scripts/232-foto-antes.json")) throw new Error("ya hay una foto del 232: no se pisa el backup")
writeFileSync("scripts/232-foto-antes.json", JSON.stringify({ tomada: new Date().toISOString(), templates: tpls, cuotas, reglas }, null, 1))

const up = [
  ...cuotas.map((c: any) => `update public.cuotas_egresos_sin_factura set estado = 'desactivado' where id = '${c.id}' and estado = ${lit(c.estado)};`),
  ...tpls.map((t: any) => `update public.egresos_sin_factura set responsable = 'MA' where id = '${t.id}' and responsable = 'PAM';  -- ${t.nombre_referencia} ${t.año}`),
  `update public.reglas_contable_interno set codigo_contable = 'CTA MA', descripcion = coalesce(descripcion,'') || ' [script 232]' where id = '${reglas[0].id}' and codigo_contable = 'CTA PAM';`,
]
const down = [
  ...cuotas.map((c: any) => `update public.cuotas_egresos_sin_factura set estado = ${lit(c.estado)} where id = '${c.id}' and estado = 'desactivado';`),
  ...tpls.map((t: any) => `update public.egresos_sin_factura set responsable = 'PAM' where id = '${t.id}' and responsable = 'MA';`),
  `update public.reglas_contable_interno set codigo_contable = 'CTA PAM', descripcion = ${lit(reglas[0].descripcion)} where id = '${reglas[0].id}' and codigo_contable = 'CTA MA';`,
]
writeFileSync("scripts/232-posadas-y-bienes-a-ma.sql", `-- 232 · Posadas y bienes de PAM → MA (DATOS). Ver scripts/232-posadas-y-bienes-a-ma.mts. Backup: scripts/232-foto-antes.json.
-- ${cuotas.length} cuotas desactivadas · ${tpls.length} templates a responsable MA · 1 regla CTA PAM → CTA MA. Cada update exige el valor leído.
begin;
${up.join("\n")}
commit;
`)
writeFileSync("scripts/232-posadas-y-bienes-a-ma-deshacer.sql", `-- Deshace el 232 (sólo filas que todavía tienen lo que puso el 232).\nbegin;\n${down.join("\n")}\ncommit;\n`)
console.log(`📸 foto · 📜 ${up.length} updates (${cuotas.length} cuotas, ${tpls.length} templates, 1 regla)`)
