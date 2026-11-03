/**
 * Script 196 — JMS 03/11: «marcalo como histórico y sí, dalo de alta financiero».
 *  · Santander 08/07/25 «Pago de honorarios» $ 1.064.403 (AMS) → estado HISTÓRICO (pagos a personal del período histórico no se registran).
 *  · Alta en el plan de «Compra / Venta de dólares», tipo FINANCIERO (la usa el template del mismo nombre y no estaba en el plan).
 *     npx tsx scripts/196-ams-historico-y-cuenta-usd.mts [--escribir]   · Deshacer: `196-…-deshacer.mts`.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const ESCRIBIR = process.argv.includes("--escribir"), HECHO = "scripts/196-hecho.json"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const { data: ms } = await sb.schema("msa").from("santander").select("*").eq("fecha", "2025-07-08").eq("debitos", 1064403).eq("estado", "pendiente")
const { data: tpl } = await sb.from("egresos_sin_factura").select("categ").ilike("categ", "Compra / Venta de d%lares").limit(1)
const categ = tpl?.[0]?.categ
const { data: ya } = await sb.from("cuentas_contables").select("id").eq("categ", categ ?? "-")
console.log(`AMS: ${ms?.length} movimiento · cuenta «${categ}» ${ya?.length ? "YA EXISTE" : "a dar de alta (financiero)"}`)
if (ms?.length !== 1 || !categ || ya?.length) { console.log("🛑 FRENA"); process.exit(1) }
if (!ESCRIBIR) { console.log("(simulación)"); process.exit(0) }
if (existsSync(HECHO)) { console.log("🛑 ya corrido"); process.exit(1) }
const m = ms[0]
const { error: e1 } = await sb.schema("msa").from("santander").update({ estado: "historico", nota_operador: [String(m.nota_operador || "").trim(), "[script 196] JMS 03/11: honorarios AMS jul-25 → histórico (pagos a personal del período histórico no se registran)"].filter(Boolean).join(" · ") }).eq("id", m.id)
if (e1) throw e1
const { data: c, error: e2 } = await sb.from("cuentas_contables").insert({ categ, cuenta_contable: categ, tipo: "financiero", activo: true, imputable: true, nombre_totalizadora: "MOVIMIENTOS INTERNOS EMPRESA" }).select("id").single()
if (e2) throw e2
writeFileSync(HECHO, JSON.stringify({ mov: { id: m.id, estado: m.estado, nota_operador: m.nota_operador }, cuenta: c.id }, null, 2))
console.log("✅ listo")
