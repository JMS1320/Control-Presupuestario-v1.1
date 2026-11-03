/**
 * 🏦 Script 191 — CC Galicia MSA con las notas y respuestas de JMS (A-FEAT-1526; 03/11). Todo por id.
 *
 *     npx tsx scripts/191-cc-galicia-msa-notas-jms.mts              ← SIMULA
 *     npx tsx scripts/191-cc-galicia-msa-notas-jms.mts --escribir   ← escribe (OK de JMS en esta terminal: «adelante»)
 *
 *  1 · Federación Patronal: 2 créditos (20/04, 13/05) → su cuenta corriente (se pide la NC).
 *  2 · AFA: 2 créditos del 20/05 → contable «CTA AFA» (su cuenta corriente; JMS compara después con su documento).
 *  3 · Vuelta Amado: transferencia 05/06 → FC 244 como PAGO PARCIAL (quedan $ 1.500.000 a identificar); cheques 31841742–747 →
 *      FC 247 y 31841748–750 → FC 250 (cierran al centavo), los 9 registrados en Cheques emitidos.
 *  4 · Penino (JMS: «MSA pagó 3 millones (RET 3 MA) y hay que conciliarlas contra 3 millones en MA; el resto FC y pago desde MA ok»):
 *      MSA 24/04 transferencia $ 2 M → FC 224 de MA, RET 3 MA (y el pago a cuenta de Penino queda vinculado); MSA 24/04 extracción $ 1 M
 *      → RET 3 MA con nota «efectivo a Penino, FC 223 de MA» (sigue atada a su cuota de Caja); en MA: la extracción del 06/05 ($ 1 M) y la
 *      transferencia del 22/05 ($ 2 M) pasan a la FC 226; FC 223 y 224 quedan pagadas por MSA.
 *  5 · Alcorta 13/07 $ 523.192,96 = FC 10-6187 + FC 10-6204 (a abonar) − NC 10-803 → conciliados los 3.
 *  6 · Acreditamiento de haberes 31/07 $ 1.827.069 = 3 anticipos del 31/07 → Sueldos, detalle encadenado.
 *  7 · Confirmar lo del motor: SICORE 14/07, Smart Farming ×3, Parador 11/08, Iglesias 04/09, echeq 107 (Longo) y 108 (Biofarma), orden
 *      judicial 01/09 (cuota alimentaria); cheque 31841751 → su pago a cuenta de Iglesias. Cheques 108 y 31841751 → cobrados; el echeq
 *      107 se registra.
 *  8 · Comisiones: extracción 28/07 y 20/08 (se suelta la factura de Penduzzu que había atado el motor) → «Comision Extraccion
 *      Efectivo»; chequeras 09/09 → «Comision Cheques».
 *  9 · Histórico (JMS: «interbancarias por las dudas; débitos automáticos, extracción… a su template»): las 4 transferencias a cuenta
 *      propia → «Interbancaria Santander» con su punta en Santander cuando está; extracción del cajero 01/07/25 → «Caja». Siguen en histórico.
 *      Santander: los 2 créditos interbanking de 13/02 y 16/06/26 (su punta en Galicia ya conciliada) → al mismo template.
 *
 * Deshacer: `191-…-deshacer.mts` (foto por tabla; borra sólo cuotas y cheques creados).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { conciliarOrigenDelMovimiento } from "../lib/conciliacion/confirmar-origen"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/191-foto-antes.json", HECHO = "scripts/191-hecho.json"
const HUELLA = "[script 191] JMS 03/11 (CC Galicia MSA)"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const T = (k: string) => { const [s, t] = k.split("."); return s === "public" ? sb.from(t) : sb.schema(s).from(t) }
const n = (x: unknown) => Number(x) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const mesDe = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`
const frenos: string[] = []

const G = {
  fedpat: ["2c003149-77d4-4fa4-b76a-8aeebb32f6c3", "52379328-6c7a-4fd8-b603-c9f959bf41a3"],
  afa: ["f5ebc964-384b-435a-85ff-e33919047808", "648c81f9-76e8-429a-bc93-ac3ffaf06aac"],
  vuelta244: "3246bbf8-55b1-4e37-9903-b3c9e6452d54",
  ch247: ["3638c7af-62c1-4eb5-9858-5f1cc3ac77c0", "873df621-cdac-457b-a9e3-2da59fefb589", "05174631-49bd-4773-887b-8a8acd0f3f0d", "53d0e4dc-43d2-4cfc-90a1-4400cf82eb95", "54a380cb-4abd-46c5-b5d8-85b498601864", "006401fa-bfee-4aec-a50f-6495d8164b25"],
  ch250: ["87a47e2e-640d-4c4c-955f-7b55aa927b82", "b5b5526a-64c1-49f9-a1ec-a78d7f851c4b", "a0ed9a7e-1654-4290-b1bc-790d7f2a6801"],
  msaPenino2M: "532809fd-f6de-49cb-936b-27369b6b8d5a", msaPenino1M: "19e5f9f2-db6e-4974-a7ed-09fb1787abf8",
  alcorta: "5f8e9539-51bd-400f-b98b-54dd68c7c41f", haberes: "cc49b0bf-ee11-4df0-9f31-96020acf4f34",
  confirmar: ["bcae8da1-6bd7-4cb4-a7ac-e966f3438b7b", "444f6063-4f5c-441e-becd-66fc5aaeea35", "5b61b4f7-c28e-4888-bc48-bb541d93489a", "ec2b6e44-0784-408d-a9da-372f64b9722b",
    "b5d68a77-8cb7-4c77-8216-95224848bffe", "cd98ef83-014a-43d6-97b9-a20fcf1302b1", "bedf7d90-df56-404a-bbaf-99d0b8a0dc74", "4578848c-3ac1-4479-a555-e309dfb030c1", "c37c7bd2-2efa-465e-a212-848277069a77"],
  ch751: "b0bc0a3c-623a-4a11-9afc-b44d651b7482",
  comExtr: ["1a2ee700-64e3-4340-aca9-741ca95e3f11", "cb3f3814-ba76-49c0-a13b-96e36869df86"], comCheq: "a3b31b9f-08b7-4a90-b9f0-fa83d5483865",
  inter: [["39f4c6a3-5609-442e-8a90-6027a4976e07", "ee743d21-ade0-4c4b-b124-c7477daeb89e"], ["8442b320-0004-48a5-92e2-6f9989568be7", "610a2ee8-2af4-47c9-9d03-bc3ae5dfce31"],
    ["05300d7a-bcee-4cd6-a7ce-ea3f0ab302e8", "0189d736-7d36-4565-a7a6-9a93d09df501"], ["1ca830a6-6563-4ba3-a7d9-a4e908bd672e", null]] as [string, string | null][],
  santSolo: ["088e96ae-39ef-4515-b244-de129de49b09", "c69a2258-a75a-4421-8049-4f2f5c4fd6fe"],
  cajero: "004efbb3-83b2-43d7-ad4c-7ae06bb35a2a",
}
const FC = { v244: "d0b07348-1d2a-40ed-85b0-d5be300ed4e9", v247: "e533e15e-353b-446c-bf39-1f875f0435a7", v250: "27e2bd04-3aec-4766-a016-ad2f6a577c58",
  a6187: "cffbe3f4-30f8-4383-922d-9eadab09ead1", a6204: "d2769664-d2a3-4616-bf29-aad0c5b0983b", a803: "1a458471-d0d9-400d-b397-f57c3d36a226",
  p223: "b97ca33a-caa9-4082-ab56-6ac4c6f58c78", p224: "403d939c-2828-4f6a-a779-2093bae68c80", p226: "c80053f7-5da3-4b64-b46f-c04ec2caf7cd" }
const MA_MOV = { ext0605: "ee71dd50-4808-4ff7-b44e-c9a49ab5cd48", tr2205: "a1450d86-4ae3-4327-b017-e30c7aa38363" }
const ANT = { penino: "1cd40e96-d435-48ed-b1de-6327afb2d873", iglesias: "12cef0e4-92df-4a82-b527-fcb3f0de9617" }
const CHQ = { c108: "353df2e6-e8ec-44a5-871e-612453b76504", c751: "9ec6fc5e-e234-4649-ac19-9ec6dc79fc6e" }
const SUELDOS31 = ["0c8b4b4f-c0d9-49e1-917e-e9255a79c23f", "fcd73155-da16-4022-88b4-bdf2246aab07", "e54bba1f-0f13-4042-a233-767243227050"]
const TPL = { comExtr: "7397172b-0d68-4c12-bd5b-1e9004290aec", comCheq: "ed85f256-c475-42cc-a13b-c2038809ce71", interSant: "bb356bdf-d033-4771-8dc2-7ce1f8ba7aab", caja: "5767ce58-807d-4c47-a91f-1dc7fc53e699" }

// ── Lectura + controles ──────────────────────────────────────────────────────────────────────────────────
const idsGal = [...G.fedpat, ...G.afa, G.vuelta244, ...G.ch247, ...G.ch250, G.msaPenino2M, G.msaPenino1M, G.alcorta, G.haberes, ...G.confirmar, G.ch751, ...G.comExtr, G.comCheq, ...G.inter.map(x => x[0]), G.cajero]
const idsSant = [...G.inter.map(x => x[1]).filter(Boolean) as string[], ...G.santSolo]
const gal = new Map(((await sb.from("msa_galicia").select("*").in("id", idsGal)).data ?? []).map((m: any) => [m.id, m]))
const sant = new Map(((await sb.schema("msa").from("santander").select("*").in("id", idsSant)).data ?? []).map((m: any) => [m.id, m]))
const fcMsa = new Map(((await sb.schema("msa").from("comprobantes_arca").select("*").in("id", [FC.v244, FC.v247, FC.v250, FC.a6187, FC.a6204, FC.a803])).data ?? []).map((m: any) => [m.id, m]))
const fcMa = new Map(((await sb.schema("ma").from("comprobantes_arca").select("*").in("id", [FC.p223, FC.p224, FC.p226])).data ?? []).map((m: any) => [m.id, m]))
const maMov = new Map(((await sb.schema("ma").from("ma_galicia").select("*").in("id", Object.values(MA_MOV))).data ?? []).map((m: any) => [m.id, m]))
const ants = new Map(((await sb.from("anticipos_proveedores").select("*").in("id", Object.values(ANT))).data ?? []).map((m: any) => [m.id, m]))
const cheques = new Map(((await sb.schema("msa").from("cheques").select("*").in("id", Object.values(CHQ))).data ?? []).map((m: any) => [m.id, m]))
const sueldos = new Map(((await sb.schema("sueldos").from("pagos").select("*").in("id", SUELDOS31)).data ?? []).map((m: any) => [m.id, m]))
const tpls = new Map(((await sb.from("egresos_sin_factura").select("id,nombre_referencia,categ").in("id", Object.values(TPL))).data ?? []).map((t: any) => [t.id, t]))
for (const id of idsGal) if (!gal.has(id)) frenos.push(`falta el movimiento ${id}`)
for (const id of idsSant) if (!sant.has(id)) frenos.push(`falta Santander ${id}`)
const sum = (ids: string[]) => r2(ids.reduce((t, id) => t + n(gal.get(id)?.debitos), 0))
if (sum(G.ch247) !== r2(n(fcMsa.get(FC.v247)?.imp_total))) frenos.push(`cheques FC 247: ${sum(G.ch247)} ≠ ${fcMsa.get(FC.v247)?.imp_total}`)
if (sum(G.ch250) !== r2(n(fcMsa.get(FC.v250)?.imp_total))) frenos.push(`cheques FC 250: ${sum(G.ch250)} ≠ ${fcMsa.get(FC.v250)?.imp_total}`)
const alc = r2(n(fcMsa.get(FC.a6187)?.monto_a_abonar) + n(fcMsa.get(FC.a6204)?.monto_a_abonar) + n(fcMsa.get(FC.a803)?.imp_total))
if (alc !== r2(n(gal.get(G.alcorta)?.debitos))) frenos.push(`Alcorta: ${alc} ≠ ${gal.get(G.alcorta)?.debitos}`)
const suel = r2(SUELDOS31.reduce((t, id) => t + n(sueldos.get(id)?.monto), 0))
if (suel !== r2(n(gal.get(G.haberes)?.debitos))) frenos.push(`haberes: ${suel} ≠ ${gal.get(G.haberes)?.debitos}`)
const pen = r2(n(maMov.get(MA_MOV.ext0605)?.debitos) + n(maMov.get(MA_MOV.tr2205)?.debitos))
if (pen !== r2(n(fcMa.get(FC.p226)?.imp_total))) frenos.push(`Penino FC 226: ${pen} ≠ ${fcMa.get(FC.p226)?.imp_total}`)
if (r2(n(gal.get(G.msaPenino2M)?.debitos) + n(gal.get(G.msaPenino1M)?.debitos)) !== r2(n(fcMa.get(FC.p223)?.imp_total) + n(fcMa.get(FC.p224)?.imp_total))) frenos.push("Penino: MSA 24/04 ≠ FC 223 + 224")
for (const [g, s] of G.inter) if (s && r2(n(gal.get(g)?.debitos)) !== r2(n(sant.get(s)?.creditos))) frenos.push(`interbancaria ${g}: importes distintos`)
for (const t of Object.values(TPL)) if (!tpls.has(t)) frenos.push(`falta el template ${t}`)
for (const id of [...G.fedpat, ...G.afa, G.vuelta244, ...G.ch247, ...G.ch250, G.alcorta, G.haberes, ...G.comExtr, G.comCheq]) if (gal.get(id)?.estado === "conciliado") frenos.push(`${id} ya está conciliado`)
console.log(`Movimientos Galicia: ${gal.size} · Santander: ${sant.size} · controles: cheques 247 ${sum(G.ch247)} · 250 ${sum(G.ch250)} · Alcorta ${alc} · haberes ${suel} · Penino FC 226 ${pen}`)
if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("(simulación: todo cierra, no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }
const cuotaCaja = (await sb.from("cuotas_egresos_sin_factura").select("*").in("id", [gal.get(G.msaPenino1M)?.template_cuota_id, ...G.confirmar.map(id => gal.get(id)?.template_cuota_id)].filter(Boolean))).data ?? []
// lo que tocará conciliarOrigen en el paso 7: sus facturas y sueldos, para que el deshacer los pueda restaurar
const fcConf = (await sb.schema("msa").from("comprobantes_arca").select("*").in("id", G.confirmar.map(id => gal.get(id)?.comprobante_arca_id).filter(Boolean))).data ?? []
const suelConf = (await sb.schema("sueldos").from("pagos").select("*").in("id", G.confirmar.map(id => gal.get(id)?.sueldo_pago_id).filter(Boolean))).data ?? []
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "public.msa_galicia": [...gal.values()], "msa.santander": [...sant.values()], "msa.comprobantes_arca": [...fcMsa.values(), ...fcConf],
  "ma.comprobantes_arca": [...fcMa.values()], "ma.ma_galicia": [...maMov.values()], "public.anticipos_proveedores": [...ants.values()], "msa.cheques": [...cheques.values()],
  "sueldos.pagos": [...sueldos.values(), ...suelConf], cuotas: cuotaCaja }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: { cuotas: string[]; cheques: string[] } = { cuotas: [], cheques: [] }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
const nota = (m: any, txt: string) => [String(m?.nota_operador || "").trim(), `${HUELLA}: ${txt}`].filter(Boolean).join(" · ")
const upd = async (k: string, id: string, v: Record<string, unknown>) => { const { error } = await T(k).update(v).eq("id", id); if (error) throw new Error(`${k} ${id}: ${error.message}`) }
const avisos: string[] = []
const origen = async (m: any, extra: Record<string, unknown> = {}) => { avisos.push(...(await conciliarOrigenDelMovimiento(sb as any, { ...m, ...extra })).avisos) }
const cuota = async (tplId: string, m: any, ingreso: boolean, cuenta: string, txt: string, estadoMov?: string) => {
  const t = tpls.get(tplId); const monto = ingreso ? n(m.creditos) : n(m.debitos)
  const { data: q, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: tplId, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha, monto,
    estado: "conciliado", detalle: `${t.nombre_referencia} — ${m.descripcion}`.slice(0, 250), tipo_movimiento: ingreso ? "ingreso" : "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(q.id); guardar()
  await upd(cuenta, m.id, { template_id: tplId, template_cuota_id: q.id, ...(estadoMov ? { estado: estadoMov } : {}), categ: t.categ, comprobante_arca_id: null, motivo_revision: null,
    comprobantes_pagados: `${t.nombre_referencia} - ${mesDe(m.fecha)}`, nota_operador: nota(m, txt) })
}
// 1 · Fed. Patronal
for (const id of G.fedpat) await upd("public.msa_galicia", id, { estado: "conciliado", categ: "Seguros Estructura", contable: "CTA FED PAT", motivo_revision: null, nota_operador: nota(gal.get(id), "Federación Patronal → su cuenta corriente (se pide la NC)") })
// 2 · AFA
for (const id of G.afa) await upd("public.msa_galicia", id, { estado: "conciliado", contable: "CTA AFA", categ: null, motivo_revision: null, nota_operador: nota(gal.get(id), "cobro de AFA → su cuenta corriente (JMS la compara después con su documento)") })
// 3 · Vuelta Amado
{ const m = gal.get(G.vuelta244), f = fcMsa.get(FC.v244)
  await upd("public.msa_galicia", m.id, { estado: "conciliado", comprobante_arca_id: f.id, categ: f.cuenta_contable, motivo_revision: null, nota_operador: nota(m, "Vuelta Amado FC 244: PAGO PARCIAL — quedan $ 1.500.000 a identificar (cheques/endosos); JMS lo ve después") })
  await upd("msa.comprobantes_arca", f.id, { monto_a_abonar: 1500000, observaciones_pago: [String(f.observaciones_pago || "").trim(), `${HUELLA}: pago parcial 05/06 $ 284.266 (transferencia); $ 1.500.000 a identificar`].filter(Boolean).join(" · ") }) }
const registrarCheque = async (m: any, fc: any, numero: string, benef: string, cuit: string) => {
  const { data, error } = await sb.schema("msa").from("cheques").insert({ numero, banco: "Galicia", monto: n(m.debitos), moneda: "ARS", fecha_emision: m.fecha, fecha_cobro: m.fecha,
    beneficiario_nombre: benef, beneficiario_cuit: cuit, estado: "cobrado", fecha_estado: m.fecha, factura_id: fc.id, concepto: `${HUELLA}: registrado desde el extracto (débito del ${m.fecha})` }).select("id").single()
  if (error) throw error; hecho.cheques.push(data.id); guardar()
}
for (const [ids, fcId] of [[G.ch247, FC.v247], [G.ch250, FC.v250]] as const) {
  const f = fcMsa.get(fcId)
  for (const id of ids) {
    const m = gal.get(id), nro = String(m.descripcion).match(/(\d{8})/)![1]
    await upd("public.msa_galicia", id, { estado: "conciliado", comprobante_arca_id: fcId, sueldo_pago_id: null, categ: f.cuenta_contable, motivo_revision: null, nota_operador: nota(m, `cheque ${nro} → Vuelta Amado FC ${f.numero_desde} (los cheques suman la factura al centavo)`) })
    await registrarCheque(m, f, nro, "VUELTA AMADO", "20939406620")
  }
  await origen(gal.get(ids[0]), { comprobante_arca_id: fcId })
}
// 4 · Penino
{ const m2 = gal.get(G.msaPenino2M), m1 = gal.get(G.msaPenino1M), f224 = fcMa.get(FC.p224), f223 = fcMa.get(FC.p223), f226 = fcMa.get(FC.p226)
  await upd("public.msa_galicia", m2.id, { comprobante_arca_id: f224.id, contable: "RET 3 MA", categ: f224.cuenta_contable ?? "Pintura, materiales y herramientas", nota_operador: nota(m2, "Penino FC 224 de MA pagada por MSA → RET 3 MA") })
  await upd("public.msa_galicia", m1.id, { contable: "RET 3 MA", nota_operador: nota(m1, "efectivo entregado a Penino: FC 223 de MA ($ 1 M) → RET 3 MA (sigue atada a su cuota de Caja)") })
  const a = ants.get(ANT.penino)
  await upd("public.anticipos_proveedores", a.id, { estado: "vinculado", monto_restante: 0, descripcion: `${a.descripcion ?? ""} · ${HUELLA}: aplicado a la FC 224 de MA (RET 3 MA)` })
  for (const [mid, txt] of [[MA_MOV.ext0605, "efectivo $ 1 M"], [MA_MOV.tr2205, "transferencia $ 2 M"]] as const) {
    const mm = maMov.get(mid); await upd("ma.ma_galicia", mid, { comprobante_arca_id: f226.id, nota_operador: nota(mm, `Penino FC 226 (${txt}); la FC ${mid === MA_MOV.ext0605 ? 223 : 224} la pagó MSA el 24/04`) })
  }
  await upd("ma.comprobantes_arca", f226.id, { estado: "conciliado", fecha_pago: "2026-05-22", observaciones_pago: [String(f226.observaciones_pago || "").trim(), `${HUELLA}: pagada por MA (06/05 $ 1 M efectivo + 22/05 $ 2 M); corrige lo del script 183`].filter(Boolean).join(" · ") })
  for (const f of [f223, f224]) await upd("ma.comprobantes_arca", f.id, { estado: "pagado", fecha_pago: "2026-04-24", observaciones_pago: [String(f.observaciones_pago || "").trim(), `${HUELLA}: pagada por MSA el 24/04 (${f.id === f223.id ? "$ 1 M en efectivo" : "transferencia $ 2 M"}) → RET 3 MA`].filter(Boolean).join(" · ") }) }
// 5 · Alcorta
{ const m = gal.get(G.alcorta), f = fcMsa.get(FC.a6187)
  await upd("public.msa_galicia", m.id, { estado: "conciliado", comprobante_arca_id: f.id, categ: f.cuenta_contable, motivo_revision: null, nota_operador: nota(m, "Alcorta: FC 10-6187 $ 368.199,61 + FC 10-6204 $ 186.688,33 (a abonar) − NC 10-803 $ 31.694,98 = $ 523.192,96") })
  for (const id of [FC.a6187, FC.a6204, FC.a803]) await upd("msa.comprobantes_arca", id, { estado: "conciliado", fecha_pago: m.fecha }) }
// 6 · Acreditamiento de haberes
{ const m = gal.get(G.haberes)
  await upd("public.msa_galicia", m.id, { estado: "conciliado", categ: "Sueldos", sueldo_pago_id: SUELDOS31[0], motivo_revision: null, detalle: "Sigot $ 150.000 + Barreto $ 750.581 + Sigot $ 926.488 = $ 1.827.069",
    nota_operador: nota(m, "acreditamiento de haberes = 3 anticipos del 31/07") })
  for (const id of SUELDOS31) await upd("sueldos.pagos", id, { estado: "conciliado" }) }
// 7 · confirmar lo del motor
for (const id of G.confirmar) { const m = gal.get(id)
  await upd("public.msa_galicia", id, { estado: "conciliado", motivo_revision: null, nota_operador: nota(m, `OK · ${m.motivo_revision ?? ""}`.trim()) }); await origen(m) }
{ const m = gal.get(G.ch751)
  await upd("public.msa_galicia", m.id, { estado: "conciliado", anticipo_id: ANT.iglesias, motivo_revision: null, nota_operador: nota(m, "cheque 31841751 → pago a cuenta de Iglesias (insumos)") }) }
await upd("msa.cheques", CHQ.c751, { estado: "cobrado", fecha_cobro: "2026-09-22", fecha_estado: "2026-09-22" })
await upd("msa.cheques", CHQ.c108, { estado: "cobrado", fecha_cobro: "2026-09-23", fecha_estado: "2026-09-23" })
{ const m = gal.get("bedf7d90-df56-404a-bbaf-99d0b8a0dc74"), { data: f } = await sb.schema("msa").from("comprobantes_arca").select("*").eq("id", m.comprobante_arca_id).single()
  await registrarCheque(m, f, "107", f.denominacion_emisor, f.cuit) }
// 8 · comisiones
for (const id of G.comExtr) await cuota(TPL.comExtr, gal.get(id), false, "public.msa_galicia", "comisión por extracción en efectivo" + (gal.get(id).comprobante_arca_id ? " (se suelta la factura de Penduzzu que había atado el motor)" : ""), "conciliado")
await cuota(TPL.comCheq, gal.get(G.comCheq), false, "public.msa_galicia", "comisión por entrega de chequeras", "conciliado")
// 9 · histórico: interbancarias y extracción
for (const [g, s] of G.inter) {
  await cuota(TPL.interSant, gal.get(g), false, "public.msa_galicia", s ? "interbancaria a Santander (con su punta)" : "interbancaria a Santander (la punta de Santander no está pendiente)")
  if (s) await cuota(TPL.interSant, sant.get(s), true, "msa.santander", "interbancaria desde Galicia (con su punta)", "conciliado")
}
for (const s of G.santSolo) await cuota(TPL.interSant, sant.get(s), true, "msa.santander", "interbancaria desde Galicia (la punta de Galicia ya está conciliada)", "conciliado")
await cuota(TPL.caja, gal.get(G.cajero), false, "public.msa_galicia", "extracción del cajero → Caja (histórico)")
console.log(`\n✅ Escrito: ${hecho.cuotas.length} cuotas · ${hecho.cheques.length} cheques registrados`)
if (avisos.length) console.log("⚠️ Avisos:\n - " + avisos.join("\n - "))
