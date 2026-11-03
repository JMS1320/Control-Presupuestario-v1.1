/**
 * 💵 Script 194 — Templates EN DÓLARES de MSA para los cargos de la CC dólares (JMS 03/11: «deben ir en templates de dólares:
 * template nuevo de cada mismo caso, pero de pesos copiado a dólares»).
 *
 *     npx tsx scripts/194-templates-usd-msa.mts              ← SIMULA
 *     npx tsx scripts/194-templates-usd-msa.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * · 6 templates «<nombre> USD», copia del de pesos de MSA (misma cuenta y agrupadora): Comision Cuenta Bancaria, Iva Bancario,
 *   Debitos / Creditos, IIBB Bancario, Percepcion IVA y Otros Gastos (Google One, como los consumos en dólares de la tarjeta).
 * · Una cuota por cada uno de los 49 cargos ya conciliados por el script 193, con la convención de la app (A-FEAT-1312):
 *   `monto_usd` = el cargo en dólares · `tipo_cambio` = dólar BNA divisas VENDEDOR del día (o el último hábil anterior) ·
 *   `monto` = pesos = monto_usd × TC. Default del dato real: el TC se puede pisar a mano.
 * · El movimiento de `msa.cc_usd` queda atado a su cuota y con su TC e importe en pesos.
 * Deshacer: `194-…-deshacer.mts` (borra sólo templates y cuotas creados y restaura los movimientos).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const ESCRIBIR = process.argv.includes("--escribir"), HECHO = "scripts/194-hecho.json", HUELLA = "[script 194] JMS 03/11"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const r2 = (x: number) => Math.round(x * 100) / 100
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const MOLDE: Record<string, string> = { "Comision Cuenta Bancaria": "8ad26fb7-6e5a-4092-a8fc-e46ab6ef43ab", "Iva Bancario": "e36bd1e0-058a-46d2-96a1-26ea1f5eb99d",
  "Debitos / Creditos": "70399536-f981-405f-866c-6a704cac63c8", "IIBB Bancario": "a2df331d-ca79-4f3c-9acb-7d4bca30b207", "Percepcion IVA": "95c57d45-8ef6-4cbe-9499-b4d530591b77",
  "INFORMATICA": "995537c7-91c0-4c7c-8fe3-3df0d5469944" }
const movs = ((await sb.schema("msa").from("cc_usd").select("*").eq("estado", "conciliado").like("nota_operador", "%[script 193]%")).data ?? []).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
const moldes = new Map(((await sb.from("egresos_sin_factura").select("*").in("id", Object.values(MOLDE))).data ?? []).map((t: any) => [t.id, t]))
const cot = ((await sb.from("cotizaciones").select("fecha,venta").eq("serie", "dolar_bna_divisas").order("fecha")).data ?? [])
const tcDe = (f: string) => { let tc: any = null; for (const c of cot) { if (c.fecha <= f) tc = c; else break } return tc }
const frenos: string[] = []
const { data: ya } = await sb.from("egresos_sin_factura").select("nombre_referencia").in("nombre_referencia", Object.values(MOLDE).map(id => `${moldes.get(id)?.nombre_referencia} USD`))
if (ya?.length) frenos.push(`ya existen: ${ya.map((t: any) => t.nombre_referencia).join(", ")}`)
if (movs.length !== 49) frenos.push(`se esperaban 49 cargos del 193 y hay ${movs.length}`)
const plan = movs.map((m: any) => { const tc = tcDe(m.fecha); const usd = Number(m.debitos) || 0
  if (!MOLDE[m.categ]) frenos.push(`sin molde para ${m.categ}`); if (!tc) frenos.push(`sin cotización para ${m.fecha}`)
  return { m, molde: MOLDE[m.categ], usd, tc: tc ? Number(tc.venta) : null, fechaTc: tc?.fecha, pesos: tc ? r2(usd * Number(tc.venta)) : null } })
const porTpl = new Map<string, { n: number; usd: number; pesos: number }>()
for (const p of plan) { const k = `${moldes.get(p.molde)?.nombre_referencia} USD`; const x = porTpl.get(k) ?? { n: 0, usd: 0, pesos: 0 }; x.n++; x.usd = r2(x.usd + p.usd); x.pesos = r2(x.pesos + (p.pesos ?? 0)); porTpl.set(k, x) }
for (const [k, x] of porTpl) console.log(`«${k}»: ${x.n} cuotas · US$ ${x.usd} · $ ${x.pesos.toLocaleString("es-AR")}`)
console.log(`ej.: ${plan[0]?.m.fecha} US$ ${plan[0]?.usd} × ${plan[0]?.tc} (BNA ${plan[0]?.fechaTc}) = $ ${plan[0]?.pesos}`)
if (frenos.length) { console.log("🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("(simulación)"); process.exit(0) }
if (existsSync(HECHO)) { console.log("🛑 ya corrido"); process.exit(1) }
const hecho: any = { templates: [], cuotas: [], foto: movs }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
const nuevo = new Map<string, any>()
for (const id of new Set(plan.map(p => p.molde))) {
  const { id: _i, created_at: _c, updated_at: _u, ...b } = moldes.get(id)
  const { data: t, error } = await sb.from("egresos_sin_factura").insert({ ...b, nombre_referencia: `${b.nombre_referencia} USD`, template_origen_id: id,
    observaciones_template: `${HUELLA}: copia en DÓLARES de «${b.nombre_referencia}» para la CC dólares de MSA (monto_usd + TC BNA del día)` }).select("*").single()
  if (error) throw error; hecho.templates.push(t.id); guardar(); nuevo.set(id, t)
}
for (const p of plan) {
  const t = nuevo.get(p.molde)
  const { data: q, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t.id, fecha_vencimiento: p.m.fecha, fecha_estimada: p.m.fecha, fecha_pago: p.m.fecha,
    monto: p.pesos, monto_usd: p.usd, tipo_cambio: p.tc, estado: "conciliado", detalle: `${t.nombre_referencia} — ${p.m.descripcion} (TC BNA divisas ${p.fechaTc})`.slice(0, 250),
    tipo_movimiento: "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(q.id); guardar()
  const { error: e2 } = await sb.schema("msa").from("cc_usd").update({ template_id: t.id, template_cuota_id: q.id, tipo_cambio: p.tc, importe_pesos: p.pesos,
    comprobantes_pagados: `${t.nombre_referencia} - ${MESES[Number(p.m.fecha.slice(5, 7)) - 1]} ${p.m.fecha.slice(0, 4)}`,
    nota_operador: [String(p.m.nota_operador || "").trim(), `${HUELLA}: template en dólares, TC BNA divisas vendedor ${p.fechaTc}`].join(" · ") }).eq("id", p.m.id)
  if (e2) throw e2
}
console.log(`✅ ${hecho.templates.length} templates USD · ${hecho.cuotas.length} cuotas`)
