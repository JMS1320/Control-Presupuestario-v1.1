/**
 * 💳 Script 190 — Tarjeta VISA Business MSA con las notas de JMS (A-FEAT-1526; JMS 03/11 sobre el Excel «a fondo»).
 *
 *     npx tsx scripts/190-tarjeta-msa-notas-jms.mts              ← SIMULA
 *     npx tsx scripts/190-tarjeta-msa-notas-jms.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * JMS: «del histórico sólo me importan los templates… si sirve dejar vinculado el pago con su factura está bien, pero no hace falta
 * trabajar con eso… pueden quedar como histórico, el tema es que no volvamos a pasar por ellas como si fueran un pendiente nuevo».
 *
 *  A · Antes del 01/07/2025 (ejercicio 24/25) → estado HISTÓRICO.
 *  B · Jul–dic 2025 con su factura en el subdiario histórico (Coopser por el NÚMERO de factura; peajes y Telecom por CUIT del comercio,
 *      importe ±1 centavo y la factura inmediata anterior al débito, una factura para un solo débito) → HISTÓRICO con la cuenta del
 *      comercio y la factura en la nota. Los que pagan facturas de junio 2025 (ejercicio anterior, no cargadas) → HISTÓRICO con la
 *      cuenta y la nota «factura del ejercicio anterior» (JMS: «ok»).
 *  C · «Su pago» en pesos y en dólares desde jul-25 → `vincularPagoTarjeta` con su «Pago Visa Empresa» (los de dólares tienen su
 *      propio débito en pesos) (JMS: «lo podés conciliar entonces»).
 *  D · vthebestpdf → template «Otros Gastos», cuenta INFORMATICA, como los ya conciliados (JMS: «copiá lo que puse… y replicá»).
 *      Orbith (a auditar) → template «Internet NZ» 2025, contable RET 3 MA, como los ya conciliados (JMS: «ok»).
 *  E · Medicus 19/02/26 → contra su factura de febrero, que queda PAGADA PARCIAL (JMS): factura − NC = $ 764.471,36, debitado
 *      $ 592.213,16 → le quedan $ 172.258,20 a abonar.
 *  F · Corredores Viales 16/01 y 01/02/26 → quedan pendientes: faltan sus facturas de enero 2026 en la app.
 *
 * Deshacer: `190-…-deshacer.mts` restaura desde la foto y borra sólo las cuotas creadas.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { vincularPagoTarjeta } from "../lib/conciliacion/vincular-pago-tarjeta"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/190-foto-antes.json", HECHO = "scripts/190-hecho.json"
const HUELLA = "[script 190] JMS 03/11 (Excel a fondo tarjeta MSA)"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const tj = sb.schema("msa").from.bind(sb.schema("msa"))
const n = (x: unknown) => Number(x) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const igual = (a: number, b: number) => Math.abs(a - b) < 0.015
const $ = (x: number) => `$ ${r2(x).toLocaleString("es-AR")}`
const dmy = (f?: string | null) => (f ? String(f).slice(0, 10).split("-").reverse().join("/") : "")
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const mesDe = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`
const frenos: string[] = []

const filas = (await sb.schema("msa").from("tarjeta_visa_business").select("*").order("fecha")).data ?? []
const abiertos = filas.filter((f: any) => ["pendiente", "auditar"].includes(f.estado))
const hist = (await sb.schema("msa").from("comprobantes_historico").select("id,fecha,punto_de_venta,numero_desde,nro_doc_emisor,denominacion_emisor,imp_total")).data ?? []
const COMERCIO: [RegExp, string, string][] = [
  [/^CORREDORES VIALE/i, "30715804812", "PEAJES, VIATICOS, FLETES ESTRUCTURA"], [/^AUTOPISTAS URBAN/i, "30574876474", "PEAJES, VIATICOS, FLETES ESTRUCTURA"],
  [/^AUTOPISTAS DEL S/i, "30677237119", "PEAJES, VIATICOS, FLETES ESTRUCTURA"], [/^AUTOPISTA DEL OE/i, "30663498513", "PEAJES, VIATICOS, FLETES ESTRUCTURA"],
  [/^COOPSER/i, "30545749994", "LUZ"], [/^PERSONAL FLOW/i, "30639453738", "TELEFONOS E INTERNET BS. AS."],
]
const deComercio = (d: string) => COMERCIO.find(([re]) => re.test(d))

type Acc = { m: any; q: string; txt: string; extra?: any }
const acc: Acc[] = []
const usadasHist = new Set<string>()
// B · emparejar en orden de fecha (una factura para un solo débito)
for (const m of abiertos.filter((m: any) => m.fecha >= "2025-07-01" && m.fecha < "2026-01-01" && deComercio(m.descripcion)).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))) {
  const [, cuit, categ] = deComercio(m.descripcion)!
  const nf = String(m.descripcion).match(/(\d{4})-(\d{8})/)
  let fc: any = null
  if (nf) fc = hist.find((h: any) => h.nro_doc_emisor === cuit && Number(h.punto_de_venta) === Number(nf[1]) && Number(h.numero_desde) === Number(nf[2]))
  else fc = hist.filter((h: any) => h.nro_doc_emisor === cuit && !usadasHist.has(h.id) && igual(n(h.imp_total), n(m.debitos)) && dias(m.fecha, h.fecha) >= -2 && dias(m.fecha, h.fecha) <= 20)
    .sort((a: any, b: any) => dias(m.fecha, a.fecha) - dias(m.fecha, b.fecha))[0]
  if (fc && !igual(n(fc.imp_total), n(m.debitos))) { frenos.push(`${m.fecha} ${m.descripcion}: la factura Nº ${fc.punto_de_venta}-${fc.numero_desde} es de ${fc.imp_total}`); continue }
  if (fc) { usadasHist.add(fc.id); acc.push({ m, q: "hist-fc", txt: `FC ${fc.punto_de_venta}-${fc.numero_desde} de ${fc.denominacion_emisor} del ${dmy(fc.fecha)} (${$(n(fc.imp_total))}, subdiario histórico)`, extra: { categ } }) }
  else if (m.fecha <= "2025-07-10") acc.push({ m, q: "hist-anterior", txt: "paga una factura de junio 2025 (ejercicio anterior, no cargada en la app)", extra: { categ } })
  else frenos.push(`${m.fecha} ${m.descripcion} ${m.debitos}: no encontré su factura en el histórico`)
}
// A
for (const m of abiertos.filter((m: any) => m.fecha < "2025-07-01")) acc.push({ m, q: "anterior", txt: "ejercicio 24/25 (ya cerrado)" })
// C · pagos
const debVisa = ((await sb.from("msa_galicia").select("id,fecha,debitos,estado,descripcion").eq("descripcion", "Pago Visa Empresa")).data ?? []).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
const usadosDeb = new Set<string>()
const resumenes = filas.filter((f: any) => f.estado === "total").sort((a: any, b: any) => String(a.fecha_cierre).localeCompare(String(b.fecha_cierre)))
const anterior = (nr: string) => { const i = resumenes.findIndex((r: any) => r.nro_resumen === nr); return i > 0 ? resumenes[i - 1] : null }
for (const m of abiertos.filter((m: any) => m.fecha >= "2025-07-01" && /^SU PAGO EN PESOS/i.test(m.descripcion))) {
  const d = debVisa.find((x: any) => !usadosDeb.has(x.id) && igual(n(x.debitos), n(m.creditos)) && Math.abs(dias(x.fecha, m.fecha)) <= 5)
  const r = anterior(m.nro_resumen)
  if (!d || !r) { frenos.push(`Su pago ${m.fecha} ${m.creditos}: ${d ? "" : "sin débito"} ${r ? "" : "sin resumen anterior"}`); continue }
  usadosDeb.add(d.id); acc.push({ m, q: "supago", txt: `«Pago Visa Empresa» del ${dmy(d.fecha)} ${$(n(d.debitos))}`, extra: { d, r } })
}
for (const m of abiertos.filter((m: any) => m.fecha >= "2025-07-01" && /^SU PAGO EN USD/i.test(m.descripcion))) {
  const d = debVisa.filter((x: any) => !usadosDeb.has(x.id) && Math.abs(dias(x.fecha, m.fecha)) <= 3 && !abiertos.some((p: any) => /^SU PAGO EN PESOS/i.test(p.descripcion) && igual(n(p.creditos), n(x.debitos))))[0]
  const r = anterior(m.nro_resumen)
  if (!d || !r) { frenos.push(`Su pago USD ${m.fecha}: sin débito en pesos o sin resumen anterior`); continue }
  usadosDeb.add(d.id); acc.push({ m, q: "supago", txt: `parte en dólares (US$ ${n(m.creditos_usd)}) pagada con el «Pago Visa Empresa» del ${dmy(d.fecha)} ${$(n(d.debitos))}`, extra: { d, r } })
}
// D
const TPL_OTROS = "995537c7-91c0-4c7c-8fe3-3df0d5469944", TPL_NZ = "7a2c2da2-6a48-40be-bb44-63de3f846b90"
for (const m of abiertos.filter((m: any) => m.fecha >= "2025-07-01" && /vthebestpdf/i.test(m.descripcion))) acc.push({ m, q: "tpl", txt: "como los vthebestpdf ya conciliados", extra: { tpl: TPL_OTROS, categ: "INFORMATICA" } })
for (const m of abiertos.filter((m: any) => m.fecha >= "2025-07-01" && /^MERPAGO\*ORBITH/i.test(m.descripcion))) acc.push({ m, q: "tpl", txt: "como los Orbith ya conciliados («ok»)", extra: { tpl: TPL_NZ, categ: "Internet NZ", contable: "RET 3 MA" } })
// E · Medicus
const medicus = abiertos.find((m: any) => m.fecha === "2026-02-19" && /^MEDICUS/i.test(m.descripcion))
const { data: fcMed } = await sb.schema("msa").from("comprobantes_arca").select("*").eq("cuit", "30546771314").eq("fecha_emision", "2026-02-18").order("imp_total", { ascending: false })
const fcFeb = (fcMed ?? []).find((c: any) => n(c.imp_total) > 0), ncFeb = (fcMed ?? []).find((c: any) => n(c.imp_total) < 0)
if (!medicus || !fcFeb || !ncFeb) frenos.push("Medicus: no encuentro el débito o la factura/NC de febrero")
const saldoMed = r2(n(fcFeb?.imp_total) + n(ncFeb?.imp_total) - n(medicus?.debitos))
if (medicus) acc.push({ m: medicus, q: "medicus", txt: `factura ${fcFeb?.punto_venta}-${fcFeb?.numero_desde} ${$(n(fcFeb?.imp_total))} − NC ${$(-n(ncFeb?.imp_total))} = ${$(n(fcFeb?.imp_total) + n(ncFeb?.imp_total))}; debitado ${$(n(medicus.debitos))} → PAGADA PARCIAL, quedan ${$(saldoMed)}` })

// Control: todos los abiertos tienen destino, salvo los dos de Corredores de enero
const ids = new Set(acc.map(a => a.m.id))
const quedan = abiertos.filter((m: any) => !ids.has(m.id))
for (const q of ["anterior", "hist-fc", "hist-anterior", "supago", "tpl", "medicus"]) { const xs = acc.filter(a => a.q === q); console.log(`${q}: ${xs.length}`); if (q !== "anterior") for (const a of xs) console.log(`   ${a.m.fecha} ${a.m.descripcion.slice(0, 34)} ${n(a.m.debitos) || n(a.m.creditos) || n(a.m.debitos_usd) + " US$"} → ${a.txt}`) }
console.log(`quedan pendientes: ${quedan.length}`); for (const m of quedan) console.log(`   ${m.fecha} ${m.descripcion} ${m.debitos}`)
if (quedan.some((m: any) => !(/^CORREDORES/i.test(m.descripcion) && m.fecha >= "2026-01-01"))) frenos.push("queda algún abierto sin destino que no es Corredores de enero 2026")
if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }
const debIds = acc.filter(a => a.q === "supago").map(a => a.extra.d.id)
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "msa.tarjeta_visa_business": acc.map(a => a.m), "public.msa_galicia": (await sb.from("msa_galicia").select("*").in("id", debIds)).data, "msa.comprobantes_arca": [fcFeb] }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: { cuotas: string[] } = { cuotas: [] }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
const nota = (m: any, txt: string) => [String(m.nota_operador || "").trim(), `${HUELLA}: ${txt}`].filter(Boolean).join(" · ")
const upd = async (id: string, v: Record<string, unknown>) => { const { error } = await sb.schema("msa").from("tarjeta_visa_business").update(v).eq("id", id); if (error) throw error }
for (const a of acc) {
  const m = a.m
  if (a.q === "anterior") await upd(m.id, { estado: "historico", motivo_revision: null, nota_operador: nota(m, a.txt) })
  else if (a.q === "hist-fc" || a.q === "hist-anterior") await upd(m.id, { estado: "historico", categ: a.extra.categ, motivo_revision: null, detalle: m.detalle || a.txt.slice(0, 120), nota_operador: nota(m, a.txt) })
  else if (a.q === "supago") {
    await vincularPagoTarjeta(sb, { nr: a.extra.r.nro_resumen, cierre: a.extra.r.fecha_cierre, debito: { tabla: "public.msa_galicia", id: a.extra.d.id }, tarjeta: { tabla: "msa.tarjeta_visa_business" }, suPagoIds: [m.id] })
    await upd(m.id, { nota_operador: nota(m, a.txt) })
  } else if (a.q === "tpl") {
    const { data: t } = await sb.from("egresos_sin_factura").select("id,nombre_referencia,categ").eq("id", a.extra.tpl).single()
    const { data: q, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t!.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha, monto: n(m.debitos),
      estado: "conciliado", detalle: `${t!.nombre_referencia} — ${m.descripcion}`.slice(0, 250), tipo_movimiento: "egreso", medio_pago: "tarjeta", visible_contable: false }).select("id").single()
    if (error) throw error; hecho.cuotas.push(q.id); guardar()
    await upd(m.id, { estado: "conciliado", categ: a.extra.categ, template_id: t!.id, template_cuota_id: q.id, ...(a.extra.contable ? { contable: a.extra.contable } : {}), motivo_revision: null,
      comprobantes_pagados: `${t!.nombre_referencia} - ${mesDe(m.fecha)}`, nota_operador: nota(m, a.txt) })
  } else if (a.q === "medicus") {
    await upd(m.id, { estado: "conciliado", comprobante_arca_id: fcFeb.id, categ: fcFeb.cuenta_contable ?? "GASTOS MEDICOS", motivo_revision: null, nota_operador: nota(m, a.txt) })
    const { error } = await sb.schema("msa").from("comprobantes_arca").update({ monto_a_abonar: saldoMed,
      observaciones_pago: [String(fcFeb.observaciones_pago || "").trim(), `${HUELLA}: PAGADA PARCIAL — tarjeta 19/02/26 ${$(n(m.debitos))} (factura − NC ${$(n(fcFeb.imp_total) + n(ncFeb.imp_total))}); quedan ${$(saldoMed)}`].filter(Boolean).join(" · ") }).eq("id", fcFeb.id)
    if (error) throw error
  }
}
console.log(`\n✅ Escrito: ${acc.length} renglones · ${hecho.cuotas.length} cuotas`)
