/**
 * 💧 Script 199 — Template «AYSA Duhau» de MA y el pago del 20/04/26 conciliado (JMS 03/11: «templates AYSA Duhau sí»; antes:
 * «aysa dijimos que sería de Duhau»). Es el punto (2) de A-FEAT-1529.
 *
 *     npx tsx scripts/199-aysa-duhau-ma.mts              ← SIMULA
 *     npx tsx scripts/199-aysa-duhau-ma.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * · Template nuevo copia de «AYSA Libertad» de MA 2026 (misma cuenta AGUA, agrupadora «Fijos Buenos Aires MA», responsable MA), con
 *   nombre «AYSA Duhau» (cuenta de servicio AySA 000158245700).
 * · Una cuota conciliada por el pago de la CA Galicia MA del 20/04/26 ($ 27.588,70, «Pago de servicios AYSA 000158245700»), y el
 *   movimiento atado a ella. Sin la marca «LIB» (no es un gasto de Libertad: no entra al reparto 50/50 de A-FEAT-1521).
 * Deshacer: `199-…-deshacer.mts` (borra la cuota y el template creados y deja el movimiento como estaba, de la foto).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const ESCRIBIR = process.argv.includes("--escribir"), HECHO = "scripts/199-hecho.json", HUELLA = "[script 199] JMS 03/11"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const MOLDE = "11921930-21d4-4867-9b6f-c01de2247ad4", NOMBRE = "AYSA Duhau"
const frenos: string[] = []
const { data: molde } = await sb.from("egresos_sin_factura").select("*").eq("id", MOLDE).single()
if (!molde) frenos.push("no está el molde AYSA Libertad MA")
const { data: ya } = await sb.from("egresos_sin_factura").select("id").eq("nombre_referencia", NOMBRE)
if (ya?.length) frenos.push(`ya existe «${NOMBRE}»`)
const { data: movs } = await sb.schema("ma").from("ma_galicia").select("*").eq("fecha", "2026-04-20").eq("debitos", 27588.7).eq("estado", "pendiente")
if (movs?.length !== 1) frenos.push(`se esperaba 1 movimiento pendiente del 20/04 por $ 27.588,70 y hay ${movs?.length ?? 0}`)
const m: any = movs?.[0]
console.log(`Template «${NOMBRE}» (copia de «${molde?.nombre_referencia}» ${molde?.responsable} · ${molde?.categ} · ${molde?.cuenta_agrupadora})`)
console.log(`Cuota 20/04/2026 $ 27.588,70 conciliada ← ${m?.descripcion} ${m?.leyendas_adicionales_1} ${m?.leyendas_adicionales_3}`)
if (frenos.length) { console.log("🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("(simulación)"); process.exit(0) }
if (existsSync(HECHO)) { console.log("🛑 ya corrido"); process.exit(1) }
const hecho: any = { template: null, cuota: null, foto: m }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
const { id: _i, created_at: _c, updated_at: _u, ...b } = molde
const { data: t, error } = await sb.from("egresos_sin_factura").insert({ ...b, nombre_referencia: NOMBRE, template_origen_id: MOLDE,
  observaciones_template: `${HUELLA}: AySA de Duhau (cuenta de servicio 000158245700), lo paga MA` }).select("*").single()
if (error) throw error
hecho.template = t.id; guardar()
const { data: q, error: e1 } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha,
  monto: 27588.7, estado: "conciliado", detalle: NOMBRE, tipo_movimiento: "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
if (e1) throw e1
hecho.cuota = q!.id; guardar()
const { error: e2 } = await sb.schema("ma").from("ma_galicia").update({ estado: "conciliado", categ: t.categ, template_id: t.id, template_cuota_id: q!.id, detalle: NOMBRE,
  motivo_revision: null, comprobantes_pagados: `${NOMBRE} - Abril 2026`, nota_operador: [String(m.nota_operador || "").trim(), `${HUELLA}: AySA de Duhau`].filter(Boolean).join(" · ") }).eq("id", m.id)
if (e2) throw e2
console.log("✅ template + cuota + movimiento conciliado")
