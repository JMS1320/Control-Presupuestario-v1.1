/**
 * 🏦 Script 187 — CC Galicia PAM con las notas de JMS (A-FEAT-1526; JMS 03/11: «listo cta cte gal pam», «cotitulares… es la CA de
 * cotitulares, sería contra esa», «las dos de Quinta Rosello ok, el otro es El Relincho», «adelante»).
 *
 *     npx tsx scripts/187-cc-pam-tanda.mts              ← SIMULA
 *     npx tsx scripts/187-cc-pam-tanda.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * Criterio PAM: el histórico sigue en histórico (sólo se le ata la cuota, como el 176); lo pendiente/a auditar se concilia.
 *   A · SUC ERM (SH) ← 5 cobros del arrendamiento ganadero LC (oct-25) · ARR AGRIC NZ ← el cobro de Provinvest del 20/11/25.
 *   B · Interbancarias PAM ← 5 de la CC + la otra punta del 24/09 en la CA (las otras puntas de la CA ya tienen cuota).
 *   C · 2026: anticipo 15/01 → «Anticipo Ganancias / Bs Pers PAM» · IIBB 15/01 → «IIBB Mensual PAM» · la ANULACIÓN del 13/02
 *       (+86.000,71) entra como devolución al template de anticipos · el pago del 10/04 → OK contra su cuota (la cuota toma el
 *       importe del banco: difería $ 1).
 *   D · Inmobiliario 11/06/26: Quinta Rosello 1 y 2 → sus cuotas (estaban «pagado» sin banco) · El Relincho → template nuevo
 *       «Inmobiliario Cuota El Relincho» (PAM 2026, partida a cargar).
 *   E · «a cta cotitulares» 20/10 y 29/10 ($ 33,18 M) ↔ sus entradas en la CA Cotitulares: la de PAM lleva «CTA COTITULARES», la de
 *       Cotitulares «por cuenta de» PAM + el par (`par_*`) + «CTA PAM», las dos conciliadas.
 *   F · Provinvest 13/07/26 (+2.351.255,36): NO se concilia — es el cobro de la factura de MA de julio entrado en la cuenta de PAM
 *       (JMS: «probable que Provinvest cobró en la cta de PAM»). Queda con nota; falta el reparto de retenciones ($ 217.688,20).
 *
 * Deshacer: `187-…-deshacer.mts` restaura desde la foto y borra sólo lo creado (`scripts/187-hecho.json`).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/187-foto-antes.json", HECHO = "scripts/187-hecho.json"
const HUELLA = "[script 187] JMS 03/11 (Excel CC PAM)"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const n = (x: unknown) => Number(x) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const $ = (x: number) => `$ ${r2(x).toLocaleString("es-AR")}`
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const mesDe = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`
const frenos: string[] = []

const { data: cc } = await sb.from("pam_galicia_cc").select("*")
const { data: ca } = await sb.from("pam_galicia").select("*")
const { data: cot } = await sb.from("cotitulares_ca_pesos").select("*")
type Mov = any
const busca = (xs: Mov[] | null, fecha: string, deb: number, cred: number, qué: string): Mov => {
  const r = (xs ?? []).filter(m => m.fecha === fecha && r2(n(m.debitos)) === deb && r2(n(m.creditos)) === cred)
  if (r.length !== 1) frenos.push(`${qué} ${fecha} ${deb || "+" + cred}: ${r.length} encontrados`)
  return r[0]
}
const { data: tplsTodos } = await sb.from("egresos_sin_factura").select("*").eq("responsable", "PAM")
const tpl = (nombre: string, año?: string) => {
  const t = (tplsTodos ?? []).filter((x: any) => x.nombre_referencia === nombre && (año === undefined || String(x.año) === año))
  if (t.length !== 1) frenos.push(`template «${nombre}» ${año ?? ""}: ${t.length}`)
  return t[0]
}

// ── A, B, C: una cuota nueva por movimiento ──────────────────────────────────────────────────────────────
const aCuota: { tabla: string; m: Mov; t: any; txt: string }[] = []
const SUCSH = tpl("SUC ERM (SH)"), NZ = tpl("ARR AGRIC NZ"), INTER = tpl("Interbancarias PAM"), ANT = tpl("Anticipo Ganancias / Bs Pers PAM", "2026"), IIBB = tpl("IIBB Mensual PAM", "2026")
for (const [f, c] of [["2025-10-17", 4640000], ["2025-10-20", 5800000], ["2025-10-20", 14000000], ["2025-10-29", 7000000], ["2025-10-29", 1740000]] as const)
  aCuota.push({ tabla: "pam_galicia_cc", m: busca(cc, f, 0, c, "LC"), t: SUCSH, txt: "«SUC ERM (SH)» arrendamiento ganadero LC" })
aCuota.push({ tabla: "pam_galicia_cc", m: busca(cc, "2025-11-20", 0, 71567988.87, "NZ"), t: NZ, txt: "«ARR AGRIC NZ»" })
for (const [f, d, c] of [["2025-09-24", 0, 2346229.44], ["2025-09-24", 0, 796.04], ["2025-10-06", 200000, 0], ["2025-12-12", 250000, 0], ["2026-01-12", 800000, 0]] as const)
  aCuota.push({ tabla: "pam_galicia_cc", m: busca(cc, f, d, c, "interbancaria CC"), t: INTER, txt: "«interbancaria»" })
aCuota.push({ tabla: "pam_galicia", m: busca(ca, "2025-09-24", 2346229.44, 0, "interbancaria CA"), t: INTER, txt: "interbancaria (otra punta del 24/09 en la CC)" })
aCuota.push({ tabla: "pam_galicia_cc", m: busca(cc, "2026-01-15", 88444.57, 0, "anticipo"), t: ANT, txt: "«anticipo ok»" })
aCuota.push({ tabla: "pam_galicia_cc", m: busca(cc, "2026-01-15", 2964918.8, 0, "IIBB"), t: IIBB, txt: "«IIBB mensual»" })
aCuota.push({ tabla: "pam_galicia_cc", m: busca(cc, "2026-02-13", 0, 86000.71, "anulación"), t: ANT, txt: "«anulación de otro anticipo» → devolución del anticipo debitado el 13/02" })
for (const a of aCuota) if (a.m && (a.m.template_cuota_id || a.m.comprobante_arca_id)) frenos.push(`${a.m.fecha} ${a.m.descripcion}: ya tiene vínculo`)

// ── C · el pago del 10/04 contra su cuota ────────────────────────────────────────────────────────────────
const ok1004 = busca(cc, "2026-04-10", 86000.71, 0, "anticipo 10/04")
const { data: cu1004 } = await sb.from("cuotas_egresos_sin_factura").select("*").eq("id", ok1004?.template_cuota_id ?? "00000000-0000-0000-0000-000000000000").single()
if (ok1004?.estado !== "auditar" || !cu1004) frenos.push("el pago del 10/04 ya no está a auditar con su cuota")

// ── D · inmobiliario ─────────────────────────────────────────────────────────────────────────────────────
const RQ: { m: Mov; cuota: any; t: string }[] = []
for (const [monto, nombre] of [[45843.7, "Inmobiliario Cuota Quinta Rosello 1"], [19812.3, "Inmobiliario Cuota Quinta Rosello 2"]] as const) {
  const m = busca(cc, "2026-06-11", monto, 0, nombre), t = tpl(nombre, "2026")
  const { data: q } = await sb.from("cuotas_egresos_sin_factura").select("*").eq("egreso_id", t?.id ?? "-").eq("fecha_estimada", "2026-06-11").eq("monto", monto)
  if (q?.length !== 1) frenos.push(`${nombre}: ${q?.length ?? 0} cuotas del 11/06 por ${monto}`)
  RQ.push({ m, cuota: q?.[0], t: nombre })
}
const relincho = busca(cc, "2026-06-11", 164942.2, 0, "El Relincho")
if ((tplsTodos ?? []).some((t: any) => /relincho/i.test(t.nombre_referencia))) frenos.push("ya hay un template de El Relincho")
const baseInmo = tpl("Inmobiliario Cuota Quinta Rosello 1", "2026")

// ── E · cotitulares ──────────────────────────────────────────────────────────────────────────────────────
const COT = ([[24440000, "2025-10-20"], [8740000, "2025-10-29"]] as const).map(([monto, f]) => ({
  pam: busca(cc, f, monto, 0, "a cta cotitulares (PAM)"), cot: busca(cot, f, 0, monto, "a cta cotitulares (Cotitulares)") }))
for (const c of COT) if (c.cot && (c.cot.par_id || c.cot.estado === "conciliado")) frenos.push(`Cotitulares ${c.cot.fecha}: ya tiene pareja o está conciliado`)

// ── F · Provinvest (sólo nota) ───────────────────────────────────────────────────────────────────────────
const prov = busca(cc, "2026-07-13", 0, 2351255.36, "Provinvest 13/07")

// ── Reporte ──────────────────────────────────────────────────────────────────────────────────────────────
console.log(`A-C · cuota nueva por movimiento: ${aCuota.length}`)
for (const a of aCuota) console.log(`   ${a.tabla === "pam_galicia" ? "CA" : "CC"} ${a.m?.fecha} ${n(a.m?.debitos) ? "-" + $(n(a.m?.debitos)) : "+" + $(n(a.m?.creditos))} (${a.m?.estado}) → ${a.t?.nombre_referencia}`)
console.log(`C · 10/04 ${$(86000.71)} OK contra su cuota (${cu1004?.monto} → ${86000.71})`)
for (const r of RQ) console.log(`D · ${r.m?.fecha} ${$(n(r.m?.debitos))} → ${r.t} (cuota ${r.cuota?.estado})`)
console.log(`D · ${relincho?.fecha} ${$(n(relincho?.debitos))} → template NUEVO «Inmobiliario Cuota El Relincho» (PAM 2026, sin partida)`)
for (const c of COT) console.log(`E · ${c.pam?.fecha} ${$(n(c.pam?.debitos))} PAM «CTA COTITULARES» ↔ Cotitulares +${$(n(c.cot?.creditos))} «por cuenta de» PAM`)
console.log(`F · Provinvest ${prov?.fecha} +${$(n(prov?.creditos))}: queda pendiente con nota (cobro de la factura de MA de julio; faltan las retenciones)`)

if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }
const fotoCC = [...aCuota.filter(a => a.tabla === "pam_galicia_cc").map(a => a.m), ok1004, ...RQ.map(r => r.m), relincho, ...COT.map(c => c.pam), prov]
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "public.pam_galicia_cc": fotoCC, "public.pam_galicia": aCuota.filter(a => a.tabla === "pam_galicia").map(a => a.m),
  "public.cotitulares_ca_pesos": COT.map(c => c.cot), cuotas: [cu1004, ...RQ.map(r => r.cuota)] }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: { templates: string[]; cuotas: string[] } = { templates: [], cuotas: [] }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
const nota = (m: any, txt: string) => [String(m.nota_operador || "").trim(), `${HUELLA}: ${txt}`].filter(Boolean).join(" · ")
const estadoFinal = (m: any) => (m.estado === "historico" ? "historico" : "conciliado")
const nuevaCuota = async (tabla: string, m: Mov, t: any, txt: string) => {
  const ingreso = n(m.creditos) > 0
  const { data: q, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha,
    monto: ingreso ? n(m.creditos) : n(m.debitos), estado: "conciliado", detalle: `${t.nombre_referencia} — ${String(m.detalle ?? "").trim() || m.descripcion}`.slice(0, 250),
    tipo_movimiento: ingreso ? "ingreso" : "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(q.id); guardar()
  const { error: e2 } = await sb.from(tabla).update({ template_id: t.id, template_cuota_id: q.id, estado: estadoFinal(m), motivo_revision: null,
    ...(m.estado === "historico" ? {} : { categ: t.categ }), comprobantes_pagados: `${t.nombre_referencia} - ${mesDe(m.fecha)}`, nota_operador: nota(m, txt) }).eq("id", m.id)
  if (e2) throw e2
}
for (const a of aCuota) await nuevaCuota(a.tabla, a.m, a.t, a.txt)
{ const { error } = await sb.from("cuotas_egresos_sin_factura").update({ monto: 86000.71, estado: "conciliado", fecha_pago: "2026-04-10" }).eq("id", cu1004.id); if (error) throw error
  const { error: e2 } = await sb.from("pam_galicia_cc").update({ estado: "conciliado", motivo_revision: null, nota_operador: nota(ok1004, `OK «ok anticipo» (cuota ${cu1004.monto} → banco)`) }).eq("id", ok1004.id); if (e2) throw e2 }
for (const r of RQ) {
  const t = tpl(r.t, "2026")
  const { error } = await sb.from("cuotas_egresos_sin_factura").update({ estado: "conciliado", fecha_pago: r.m.fecha }).eq("id", r.cuota.id); if (error) throw error
  const { error: e2 } = await sb.from("pam_galicia_cc").update({ estado: "conciliado", categ: t.categ, template_id: t.id, template_cuota_id: r.cuota.id, motivo_revision: null,
    comprobantes_pagados: `${r.t} - ${mesDe(r.m.fecha)}`, nota_operador: nota(r.m, `«${r.t.replace("Inmobiliario Cuota ", "")} ok»`) }).eq("id", r.m.id); if (e2) throw e2
}
{ const { id: _i, created_at: _c, updated_at: _u, ...b } = baseInmo
  const { data: t, error } = await sb.from("egresos_sin_factura").insert({ ...b, nombre_referencia: "Inmobiliario Cuota El Relincho", partida_arba: null, template_origen_id: baseInmo.id,
    observaciones_template: `${HUELLA}: «el otro es El Relincho, otra partida» — falta cargar la partida` }).select("*").single()
  if (error) throw error; hecho.templates.push(t.id); guardar()
  await nuevaCuota("pam_galicia_cc", relincho, t, "«El Relincho, otra partida»") }
for (const c of COT) {
  const { error } = await sb.from("pam_galicia_cc").update({ contable: "CTA COTITULARES", nota_operador: nota(c.pam, "«a cta cotitulares» → su entrada en la CA Cotitulares") }).eq("id", c.pam.id); if (error) throw error
  const { error: e2 } = await sb.from("cotitulares_ca_pesos").update({ estado: "conciliado", contable: "CTA PAM", por_cuenta_de: "PAM", par_schema: "public", par_tabla: "pam_galicia_cc", par_id: c.pam.id,
    motivo_revision: null, nota_operador: nota(c.cot, "transferencia de PAM «a cta cotitulares» (cuenta corriente Cotitulares ↔ PAM)") }).eq("id", c.cot.id); if (e2) throw e2
}
{ const { error } = await sb.from("pam_galicia_cc").update({ contable: "CTA MA", nota_operador: nota(prov, "cobro de Provinvest de la factura de MA de julio ($ 2.568.943,56) entrado en la cuenta de PAM — faltan las retenciones ($ 217.688,20) para conciliarlo") }).eq("id", prov.id); if (error) throw error }
console.log(`\n✅ Escrito: ${hecho.templates.length} template · ${hecho.cuotas.length} cuotas nuevas · 10/04 OK · Quinta Rosello ×2 · cotitulares ×2 · Provinvest con nota`)
