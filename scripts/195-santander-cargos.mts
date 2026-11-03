/**
 * 🏦 Script 195 — Santander MSA: los cargos del banco abiertos → al mismo template que sus anteriores (JMS 03/11: «lo que dejé sin
 * nada es conciliado o cosas que toman las reglas, ¿lo podés conciliar vos?»). Una cuota por cargo.
 *     npx tsx scripts/195-santander-cargos.mts [--escribir]
 * Deshacer: `195-…-deshacer.mts`.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const ESCRIBIR = process.argv.includes("--escribir"), HECHO = "scripts/195-hecho.json", HUELLA = "[script 195] JMS 03/11"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const R: [RegExp, string][] = [[/^Comision (tarjeta debito adicional|por servicio de cuenta)/i, "8ad26fb7-6e5a-4092-a8fc-e46ab6ef43ab"], [/^Iva percepcion/i, "95c57d45-8ef6-4cbe-9499-b4d530591b77"],
  [/^Iva \d/i, "e36bd1e0-058a-46d2-96a1-26ea1f5eb99d"], [/^Impuesto ley 25\.413/i, "70399536-f981-405f-866c-6a704cac63c8"], [/^Intereses por descubierto/i, "32236299-97b2-4376-9ffc-5eb8f111705a"],
  [/^Impuesto de sellos/i, "58c942b9-fec8-414b-bf0f-efa0b72933ab"], [/^Iibb percepcion/i, "a2df331d-ca79-4f3c-9acb-7d4bca30b207"]]
const tpls = new Map(((await sb.from("egresos_sin_factura").select("id,nombre_referencia,categ").in("id", R.map(r => r[1]))).data ?? []).map((t: any) => [t.id, t]))
const movs = (await sb.schema("msa").from("santander").select("*").eq("estado", "pendiente")).data ?? []
const acc = movs.map((m: any) => ({ m, t: tpls.get(R.find(([re]) => re.test(m.descripcion))?.[1] ?? "") })).filter(a => a.t)
const quedan = movs.filter((m: any) => !acc.some(a => a.m.id === m.id))
const k = new Map<string, number>(); for (const a of acc) k.set(a.t.nombre_referencia, (k.get(a.t.nombre_referencia) ?? 0) + 1)
console.log(`A template: ${acc.length}`); for (const [t, n] of k) console.log(`   ${t}: ${n}`)
console.log(`Quedan: ${quedan.length}`); for (const m of quedan) console.log(`   ${m.fecha} ${m.descripcion} ${m.debitos || "+" + m.creditos}`)
if (!ESCRIBIR) { console.log("(simulación)"); process.exit(0) }
if (existsSync(HECHO)) { console.log("🛑 ya corrido"); process.exit(1) }
const hecho: any = { cuotas: [], foto: acc.map(a => a.m) }; const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
for (const { m, t } of acc) {
  const ingreso = Number(m.creditos) > 0
  const { data: q, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha, monto: Number(ingreso ? m.creditos : m.debitos),
    estado: "conciliado", detalle: `${t.nombre_referencia} — ${m.descripcion}`.slice(0, 250), tipo_movimiento: ingreso ? "ingreso" : "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(q.id); guardar()
  const { error: e2 } = await sb.schema("msa").from("santander").update({ estado: "conciliado", categ: t.categ, template_id: t.id, template_cuota_id: q.id, motivo_revision: null,
    comprobantes_pagados: `${t.nombre_referencia} - ${MESES[Number(m.fecha.slice(5, 7)) - 1]} ${m.fecha.slice(0, 4)}`, nota_operador: [String(m.nota_operador || "").trim(), `${HUELLA}: cargo del banco → su template`].filter(Boolean).join(" · ") }).eq("id", m.id)
  if (e2) throw e2
}
console.log(`✅ ${hecho.cuotas.length} cuotas`)
