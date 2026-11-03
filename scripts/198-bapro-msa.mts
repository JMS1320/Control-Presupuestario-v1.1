/**
 * 🏦 Script 198 — BANCO PROVINCIA de MSA (cta cte 8682/2, «SAN MANUEL SRL» CUIT 30617786016): los 15 extractos que mandó el banco
 * (mail «Solicitud de extractos de cuenta bancaria», 03/11/26; PDFs en «- Comunicacion…/Extractos/BAPRO») → `msa.provincia`, y cada
 * movimiento a su template (JMS 03/11: «me mandaron todos los del BAPRO para cargar, hacer las reglas y poder procesar, conciliar»).
 *
 *     npx tsx scripts/198-bapro-msa.mts              ← SIMULA
 *     npx tsx scripts/198-bapro-msa.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * · 125 movimientos 14/07/25 → 29/09/26 (`scripts/198-bapro-movimientos.json`, leídos de los PDF). Control: la cadena de saldos cierra
 *   renglón por renglón desde $ 15.298,25 (saldo anterior del extracto de julio-25); al 30/06/26 da − $ 179.053,43 (descubierto).
 * · Cargos del banco → los MISMOS templates de MSA que Santander (script 195): comisiones → «Comision Cuenta Bancaria», ley 25.413 →
 *   «Debitos / Creditos», IIBB → «IIBB Bancario», sellos → impuesto de sellos, intereses y «liquidación de préstamo» → intereses.
 * · Las 3 transferencias desde Galicia → «Interbancaria BAPRO» (cuota de ingreso, como la otra punta de Santander en el 191).
 * · Y la punta de Galicia del 03/12/25 ($ 350.000), que estaba como «Interbancaria Santander» y llegó al PROVINCIA el 04/12 (Santander no
 *   tiene ese crédito): su cuota pasa al template «Interbancaria BAPRO».
 * Deshacer: `198-…-deshacer.mts` (borra sólo lo insertado y restaura la cuota y el movimiento de Galicia de la foto).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const ESCRIBIR = process.argv.includes("--escribir"), HECHO = "scripts/198-hecho.json", HUELLA = "[script 198] JMS 03/11"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const r2 = (x: number) => Math.round(x * 100) / 100
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const TPL: Record<string, string> = { comision: "8ad26fb7-6e5a-4092-a8fc-e46ab6ef43ab", ley25413: "70399536-f981-405f-866c-6a704cac63c8", iibb: "a2df331d-ca79-4f3c-9acb-7d4bca30b207",
  sellos: "58c942b9-fec8-414b-bf0f-efa0b72933ab", intereses: "32236299-97b2-4376-9ffc-5eb8f111705a", liq_prestamo: "32236299-97b2-4376-9ffc-5eb8f111705a",
  interbancaria: "ed31d9ac-2d66-42e5-a4f4-fee593587e7a" }
const SANTANDER_TPL = "bb356bdf-d033-4771-8dc2-7ce1f8ba7aab", GALICIA_FECHA = "2025-12-03"
const movs = JSON.parse(readFileSync("scripts/198-bapro-movimientos.json", "utf8")) as { fecha: string; descripcion: string; importe: number; saldo: number; tipo: string }[]
const frenos: string[] = []
// Control 1: la cadena de saldos
let s = 15298.25
for (const m of movs) { s = r2(s + m.importe); if (s !== r2(m.saldo)) frenos.push(`cadena rota en ${m.fecha} ${m.descripcion}`) }
const al3006 = movs.filter(m => m.fecha <= "2026-06-30").pop()!.saldo
if (r2(al3006) !== -179053.43) frenos.push(`saldo al 30/06/26 ${al3006} ≠ −179.053,43`)
// Control 2: la tabla vacía y los templates existen
const { count } = await sb.schema("msa").from("provincia").select("id", { count: "exact", head: true })
if (count) frenos.push(`msa.provincia ya tiene ${count} filas`)
const tpls = new Map(((await sb.from("egresos_sin_factura").select("id,nombre_referencia,categ").in("id", [...new Set(Object.values(TPL))])).data ?? []).map((t: any) => [t.id, t]))
for (const m of movs) if (!TPL[m.tipo] || !tpls.get(TPL[m.tipo])) frenos.push(`sin template: ${m.fecha} ${m.descripcion}`)
// La punta de Galicia del 03/12/25
const { data: gal } = await sb.from("msa_galicia").select("*").eq("fecha", GALICIA_FECHA).eq("debitos", 350000)
if (gal?.length !== 1) frenos.push(`Galicia ${GALICIA_FECHA} $350.000: ${gal?.length ?? 0} filas`)
const g: any = gal?.[0]
const gq: any = g?.template_cuota_id ? (await sb.from("cuotas_egresos_sin_factura").select("*").eq("id", g.template_cuota_id).single()).data : null
if (gq && gq.egreso_id !== SANTANDER_TPL) frenos.push("la cuota de Galicia 03/12 ya no es de Interbancaria Santander")
// Resumen
const k = new Map<string, { n: number; t: number }>()
for (const m of movs) { const n = tpls.get(TPL[m.tipo])?.nombre_referencia ?? m.tipo; const x = k.get(n) ?? { n: 0, t: 0 }; x.n++; x.t = r2(x.t + m.importe); k.set(n, x) }
console.log(`${movs.length} movimientos ${movs[0].fecha} → ${movs[movs.length - 1].fecha} · cadena de saldos ✓ · al 30/06/26 $ ${al3006}`)
for (const [n, x] of k) console.log(`   ${n}: ${x.n} · $ ${x.t.toLocaleString("es-AR")}`)
console.log(`Galicia ${GALICIA_FECHA} $350.000: «${g?.comprobantes_pagados}» → «Interbancaria BAPRO - Diciembre 2025»`)
if (frenos.length) { console.log("🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("(simulación)"); process.exit(0) }
if (existsSync(HECHO)) { console.log("🛑 ya corrido"); process.exit(1) }
const hecho: any = { movimientos: [], cuotas: [], fotoGalicia: g, fotoCuotaGalicia: gq }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
let orden = 0
for (const m of movs) {
  const t = tpls.get(TPL[m.tipo]); const ingreso = m.importe > 0; const monto = Math.abs(m.importe)
  const { data: q, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha, monto,
    estado: "conciliado", detalle: `${t.nombre_referencia} — BAPRO: ${m.descripcion}`.slice(0, 250), tipo_movimiento: ingreso ? "ingreso" : "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error
  hecho.cuotas.push(q!.id); guardar()
  const { data: mv, error: e2 } = await sb.schema("msa").from("provincia").insert({ fecha: m.fecha, descripcion: m.descripcion, debitos: ingreso ? 0 : monto, creditos: ingreso ? monto : 0, saldo: m.saldo,
    control: 0, cuenta: "provincia", orden: ++orden, estado: "conciliado", categ: t.categ, template_id: t.id, template_cuota_id: q!.id,
    comprobantes_pagados: `${t.nombre_referencia} - ${MESES[Number(m.fecha.slice(5, 7)) - 1]} ${m.fecha.slice(0, 4)}`,
    nota_operador: `${HUELLA}: extracto del banco (PDF) → su template${ingreso ? " (interbancaria desde Galicia)" : ""}` }).select("id").single()
  if (e2) throw e2
  hecho.movimientos.push(mv!.id); guardar()
}
if (g && gq) {
  const { error: e3 } = await sb.from("cuotas_egresos_sin_factura").update({ egreso_id: TPL.interbancaria, detalle: `Interbancaria BAPRO — ${HUELLA}: llegó al Provincia el 04/12/25 (era Interbancaria Santander)` }).eq("id", gq.id)
  if (e3) throw e3
  const { error: e4 } = await sb.from("msa_galicia").update({ template_id: TPL.interbancaria, comprobantes_pagados: "Interbancaria BAPRO - Diciembre 2025",
    nota_operador: [String(g.nota_operador || "").trim(), `${HUELLA}: es la interbancaria al Provincia del 04/12 (estaba como Santander)`].filter(Boolean).join(" · ") }).eq("id", g.id)
  if (e4) throw e4
}
console.log(`✅ ${hecho.movimientos.length} movimientos · ${hecho.cuotas.length} cuotas · Galicia 03/12 corregida`)
