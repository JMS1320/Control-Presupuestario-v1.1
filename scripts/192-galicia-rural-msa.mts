/**
 * 🌾 Script 192 — Template propio «Galicia Rural MSA» (JMS 03/11: «galicia rural debe tener su propio template» · «1 ok» → cuenta
 * Tarjetas MSA, pago de tarjeta) y sus 2 débitos automáticos al vencimiento de la CC Galicia MSA.
 *
 *     npx tsx scripts/192-galicia-rural-msa.mts              ← SIMULA
 *     npx tsx scripts/192-galicia-rural-msa.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * 01/07/2025 $ 4.398,04 (histórico: sigue en histórico, sólo se le ata la cuota) · 01/07/2026 $ 2.374,02 (pendiente → conciliado).
 * Deshacer: `192-…-deshacer.mts`.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const ESCRIBIR = process.argv.includes("--escribir")
const HECHO = "scripts/192-hecho.json", HUELLA = "[script 192] JMS 03/11"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const movs = (await sb.from("msa_galicia").select("*").ilike("descripcion", "%galicia rural%")).data ?? []
const { data: base } = await sb.from("egresos_sin_factura").select("*").eq("id", "8ad26fb7-6e5a-4092-a8fc-e46ab6ef43ab").single() // «Comision Cuenta Bancaria» de MSA, como molde
const { data: ya } = await sb.from("egresos_sin_factura").select("id").eq("nombre_referencia", "Galicia Rural MSA")
const { data: cc } = await sb.from("cuentas_contables").select("categ,tipo").eq("categ", "Tarjetas MSA").maybeSingle()
console.log(`Template nuevo «Galicia Rural MSA» (cuenta ${cc?.categ} · ${cc?.tipo}) ← ${movs.length} débitos:`)
for (const m of movs) console.log(`   ${m.fecha} $ ${m.debitos} (${m.estado}) ${m.leyendas_adicionales_1 ?? ""}`)
if (movs.length !== 2 || ya?.length || !cc || movs.some((m: any) => m.template_cuota_id)) { console.log("🛑 FRENA: no son 2, ya existe el template, falta la cuenta o alguno ya tiene cuota"); process.exit(1) }
if (!ESCRIBIR) { console.log("(simulación)"); process.exit(0) }
if (existsSync(HECHO)) { console.log("🛑 ya corrido"); process.exit(1) }
const hecho: any = { template: null, cuotas: [], foto: movs }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
const { id: _i, created_at: _c, updated_at: _u, ...b } = base
const { data: t, error } = await sb.from("egresos_sin_factura").insert({ ...b, nombre_referencia: "Galicia Rural MSA", categ: "Tarjetas MSA", tipo: "financiero", cuenta_agrupadora: base.cuenta_agrupadora,
  observaciones_template: `${HUELLA}: débito automático al vencimiento de la tarjeta Galicia Rural` }).select("*").single()
if (error) throw error; hecho.template = t.id; guardar()
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
for (const m of movs) {
  const { data: q, error: e1 } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha, monto: Number(m.debitos),
    estado: "conciliado", detalle: "Galicia Rural MSA — D.A. al vencimiento", tipo_movimiento: "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (e1) throw e1; hecho.cuotas.push(q.id); guardar()
  const { error: e2 } = await sb.from("msa_galicia").update({ template_id: t.id, template_cuota_id: q.id, categ: "Tarjetas MSA", motivo_revision: null, ...(m.estado === "historico" ? {} : { estado: "conciliado" }),
    comprobantes_pagados: `Galicia Rural MSA - ${MESES[Number(m.fecha.slice(5, 7)) - 1]} ${m.fecha.slice(0, 4)}`,
    nota_operador: [String(m.nota_operador || "").trim(), `${HUELLA}: tarjeta Galicia Rural → su template`].filter(Boolean).join(" · ") }).eq("id", m.id)
  if (e2) throw e2
}
console.log(`✅ Template ${t.id} · ${hecho.cuotas.length} cuotas`)
