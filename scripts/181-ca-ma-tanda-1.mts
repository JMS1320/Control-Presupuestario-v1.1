/**
 * 🏦 Script 181 — A-FEAT-1526: CAJA DE AHORRO GALICIA MA, TANDA 1 a mano según las notas de JMS en el Excel de trabajo
 * (JMS 02/11: «lo mejor es que vayas haciendo la conciliación manualmente… si coincide coincide; si no coincide puede ir a
 * cta cte» · «dale, arrancá con la primera tanda»). Lo de atrás, a mano y SIN crear reglas (JMS: cada mes lo mira él).
 *
 *     npx tsx scripts/181-ca-ma-tanda-1.mts              ← SIMULA (lee las notas del Excel y dice qué haría)
 *     npx tsx scripts/181-ca-ma-tanda-1.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * Lee las notas DIRECTO del Excel «CA Galicia MA - hoy y propuesta (2026-11-02).xlsx» (columna «JMS: nota», y «JMS: OK /
 * cambio» si la llenó), y cruza cada renglón con su movimiento por fecha + débito + crédito + descripción.
 *
 *   CONSUMO        sin factura → template «Consumos MA» (una cuota por movimiento, como el motor; los créditos como ingreso)
 *                  con factura del mismo importe ya atada por el motor (a auditar) → OK + cuenta Consumos en la factura
 *   INTERBANCARIA  → template «Interbancarias MA»
 *   CAJA           → template «Caja» (MA) — corrige lo que el motor había puesto como Sueldos / sin categoría
 *   LIBERTAD 2026  AySA y ABL ya atados a su cuota (con el importe del banco) → OK · Metrogas → la cuota de su mes. Contable LIB.
 *   ✋ Fuera: Libertad 2025 (los templates de 2025 son de PAM y pagó la cuenta de MA: es un cruce, se pregunta) · la AySA de
 *   otra cuenta (000158245700) · Centro Areco Sada (le factura a MA pero JMS escribió «Consumo») · todo lo de factura,
 *   Provinvest, promociones y «ver CUIT» (tandas siguientes).
 *
 * Deshacer: `181-…-deshacer.mts` borra sólo las cuotas que creó y restaura movimientos, cuotas y facturas desde la foto.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { conciliarOrigenDelMovimiento } from "../lib/conciliacion/confirmar-origen"
import { asignarCuentaAFacturas } from "../lib/conciliacion/asignar-cuenta"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/181-foto-antes.json", HECHO = "scripts/181-hecho.json"
const HUELLA = "[script 181] JMS 02/11 (Excel CA MA)"
const EXCEL = join("- Comunicacion JMS Claude - Archivos", "Balance", "Excels trabajando con claude", "CA Galicia MA - hoy y propuesta (2026-11-02).xlsx")
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ma = sb.schema("ma")
const n = (x: unknown) => Number(String(x ?? "").replace(/,/g, "")) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const mesDe = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`
const titulo = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
const frenos: string[] = []

// ── 1 · Las notas de JMS, del Excel ──────────────────────────────────────────────────────────────────────
const wb = XLSX.readFile(EXCEL, { cellDates: true })
const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Detalle"], { raw: true, defval: "" })
const iso = (v: any) => (v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : String(v).slice(0, 10))
const clave = (fecha: string, deb: number, cred: number, desc: string) => `${fecha}|${r2(deb)}|${r2(cred)}|${desc.trim().toUpperCase()}`
const notas = new Map<string, string[]>()
for (const r of rows) {
  if (!r["Fecha"]) continue
  const nota = [r["JMS: OK / cambio"], r["JMS: nota"]].map(x => String(x ?? "").trim()).filter(Boolean).join(" · ")
  if (!nota) continue
  const k = clave(iso(r["Fecha"]), n(r["Débitos"]), n(r["Créditos"]), String(r["Descripción"]))
  notas.set(k, [...(notas.get(k) ?? []), nota])
}
const tipoDe = (nota: string): string | null => {
  const t = nota.toLowerCase()
  if (/\binterbancaria/.test(t)) return "interbancaria"
  if (/^caja$/.test(t)) return "caja"
  if (/aysa templ|metrogas templ|abl libertad|expensas libertad/.test(t)) return "libertad"
  if (/(^|· )consumo$/.test(t) || /^consumo( ·|$)/.test(t)) return "consumo"
  return null
}

// ── 2 · Los movimientos ──────────────────────────────────────────────────────────────────────────────────
const { data: movs } = await ma.from("ma_galicia").select("*").in("estado", ["pendiente", "auditar"])
const porClave = new Map<string, any[]>()
for (const m of movs ?? []) { const k = clave(m.fecha, n(m.debitos), n(m.creditos), m.descripcion); porClave.set(k, [...(porClave.get(k) ?? []), m]) }
const { data: tpls } = await sb.from("egresos_sin_factura").select("id,nombre_referencia,responsable,categ").eq("responsable", "MA").in("nombre_referencia", ["Consumos MA", "Interbancarias MA", "Caja", "Metrogas Libertad"])
const tpl = (nm: string) => (tpls ?? []).find((t: any) => t.nombre_referencia === nm)
for (const nm of ["Consumos MA", "Interbancarias MA", "Caja", "Metrogas Libertad"]) if (!tpl(nm)) frenos.push(`no está el template «${nm}» de MA`)
const { data: cuotasMetro } = await sb.from("cuotas_egresos_sin_factura").select("*").eq("egreso_id", tpl("Metrogas Libertad")?.id)
const fcVinc = new Map<string, number>()
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const { data } = await (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("comprobante_arca_id").not("comprobante_arca_id", "is", null)
  for (const x of data ?? []) fcVinc.set(x.comprobante_arca_id, (fcVinc.get(x.comprobante_arca_id) ?? 0) + 1)
}

interface Accion { mov: any; que: string; nota: string; extra?: any }
const acciones: Accion[] = [], fuera: string[] = []
const sinMov: string[] = []
for (const [k, ns] of notas) {
  const ms = porClave.get(k) ?? []
  if (ms.length !== ns.length) { if (!ms.length) sinMov.push(k); else frenos.push(`${k}: ${ns.length} notas para ${ms.length} movimientos`); continue }
  ms.forEach((m, i) => {
    const nota = ns[i], tp = tipoDe(nota)
    const lbl = `${m.fecha} ${m.descripcion} ${m.debitos || "+" + m.creditos} «${nota}»`
    if (!tp) { fuera.push(`${lbl} — otra tanda`); return }
    if (tp === "consumo") {
      if (/30716729520/.test(m.concepto ?? "")) { fuera.push(`${lbl} — Centro Areco Sada le factura a MA: se pregunta`); return }
      if (m.comprobante_arca_id && m.estado === "auditar") {
        if ((fcVinc.get(m.comprobante_arca_id) ?? 0) > 1) { fuera.push(`${lbl} — su factura está atada a otro movimiento`); return }
        acciones.push({ mov: m, que: "consumo-factura", nota }); return
      }
      if (m.comprobante_arca_id || m.template_cuota_id) { fuera.push(`${lbl} — ya tiene vínculo, no se toca`); return }
      acciones.push({ mov: m, que: "consumo-template", nota }); return
    }
    if (tp === "interbancaria" || tp === "caja") {
      if (m.comprobante_arca_id) { fuera.push(`${lbl} — tiene una factura atada (la suelta otra tanda)`); return }
      acciones.push({ mov: m, que: tp, nota }); return
    }
    // libertad
    if (m.fecha < "2026-01-01") { fuera.push(`${lbl} — Libertad 2025: template de PAM pagado por MA, se pregunta`); return }
    if (/000158245700/.test(m.concepto ?? "")) { fuera.push(`${lbl} — AySA de otra cuenta, se pregunta`); return }
    if (m.template_cuota_id && m.estado === "auditar") { acciones.push({ mov: m, que: "libertad-ok", nota }); return }
    if (/METROGAS/.test(m.leyendas_adicionales_1 ?? "")) {
      const mes = m.fecha.slice(0, 7)
      const cu = (cuotasMetro ?? []).filter((c: any) => String(c.fecha_estimada).slice(0, 7) === mes && c.estado !== "conciliado")
      if (cu.length !== 1) { fuera.push(`${lbl} — Metrogas: ${cu.length} cuotas libres en ${mes}`); return }
      acciones.push({ mov: m, que: "libertad-metrogas", nota, extra: cu[0] }); return
    }
    fuera.push(`${lbl} — Libertad sin caso previsto`)
  })
}
const cuenta = (q: string) => acciones.filter(a => a.que === q)
const suma = (xs: Accion[]) => r2(xs.reduce((t, a) => t + n(a.mov.debitos) - n(a.mov.creditos), 0))
console.log(`Notas en el Excel: ${[...notas.values()].flat().length} · sin movimiento abierto hoy (ya resueltos): ${sinMov.length}`)
for (const q of ["consumo-template", "consumo-factura", "interbancaria", "caja", "libertad-ok", "libertad-metrogas"]) console.log(`  ${q}: ${cuenta(q).length} · neto $ ${suma(cuenta(q))}`)
console.log(`  fuera de esta tanda: ${fuera.length}`)
for (const f of fuera.filter(f => !/otra tanda$/.test(f))) console.log(`     ${f}`)

// ── Foto ─────────────────────────────────────────────────────────────────────────────────────────────────
const idsFc = cuenta("consumo-factura").map(a => a.mov.comprobante_arca_id)
const fotoFc = idsFc.length ? (await ma.from("comprobantes_arca").select("*").in("id", idsFc)).data : []
const idsCuotas = [...cuenta("libertad-ok").map(a => a.mov.template_cuota_id), ...cuenta("libertad-metrogas").map(a => a.extra.id)]
const fotoCuotas = idsCuotas.length ? (await sb.from("cuotas_egresos_sin_factura").select("*").in("id", idsCuotas)).data : []
const prop: Record<string, any[]> = {}
for (const t of TABLAS_CON_VINCULO_ARCA) {
  if (!idsFc.length) break
  const { data } = await (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("*").in("comprobante_arca_id", idsFc)
  if (data?.length) prop[`${t.schema}.${t.tabla}`] = data
}
if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "ma.ma_galicia": acciones.map(a => a.mov), "ma.comprobantes_arca": fotoFc, cuotas: fotoCuotas, propagacion: prop }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: { cuotas: string[] } = { cuotas: [] }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2))
const nota = (m: any, txt: string) => [String(m.nota_operador || "").trim(), txt].filter(Boolean).join(" · ")
const etiqueta = (t: any) => (t.nombre_referencia.endsWith(" MA") ? t.nombre_referencia : `${t.nombre_referencia} MA`)
const avisos: string[] = []
const aTemplate = async (a: Accion, t: any, detalle: string) => {
  const m = a.mov, ingreso = n(m.creditos) > 0
  const { data: cu, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha,
    monto: ingreso ? n(m.creditos) : n(m.debitos), estado: "conciliado", detalle, tipo_movimiento: ingreso ? "ingreso" : "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(cu.id); guardar()
  const { error: e2 } = await ma.from("ma_galicia").update({ estado: "conciliado", categ: t.categ, nro_cuenta: null, detalle: m.detalle || detalle, template_id: t.id, template_cuota_id: cu.id,
    comprobantes_pagados: `${etiqueta(t)} - ${mesDe(m.fecha)}`, motivo_revision: null, comprobante_arca_id: null, nota_operador: nota(m, `${HUELLA}: «${a.nota}»`) }).eq("id", m.id)
  if (e2) throw e2
}
const quien = (m: any) => {
  const l1 = String(m.leyendas_adicionales_1 ?? "").trim()
  if (l1 && !/^Sucursal/.test(l1)) return titulo(l1).slice(0, 30)
  const ls = String(m.concepto ?? "").split(/\r?\n/).map((x: string) => x.trim()); const i = ls.findIndex((l: string) => /^(?:(?:CU|NO)\s+)?\d{11}$/.test(l))
  return i > 0 ? titulo(ls[i - 1]).slice(0, 30) : titulo(m.descripcion).slice(0, 30)
}
for (const a of cuenta("consumo-template")) await aTemplate(a, tpl("Consumos MA"), `Consumos MA — ${quien(a.mov)}`)
for (const a of cuenta("interbancaria")) await aTemplate(a, tpl("Interbancarias MA"), "Interbancaria")
for (const a of cuenta("caja")) await aTemplate(a, tpl("Caja"), "Extracción de efectivo")
for (const a of [...cuenta("consumo-factura"), ...cuenta("libertad-ok")]) {
  const m = a.mov
  const { error } = await ma.from("ma_galicia").update({ estado: "conciliado", motivo_revision: null, ...(a.que === "libertad-ok" ? { contable: "LIB" } : {}),
    nota_operador: nota(m, `OK ${HUELLA}: «${a.nota}»${m.motivo_revision ? " · " + m.motivo_revision : ""}`) }).eq("id", m.id)
  if (error) throw error
  avisos.push(...(await conciliarOrigenDelMovimiento(sb as any, m)).avisos)
}
for (const a of cuenta("libertad-metrogas")) {
  const m = a.mov, cu = a.extra, t = tpl("Metrogas Libertad")
  const { error } = await sb.from("cuotas_egresos_sin_factura").update({ monto: n(m.debitos), estado: "conciliado", fecha_pago: m.fecha }).eq("id", cu.id); if (error) throw error
  const { error: e2 } = await ma.from("ma_galicia").update({ estado: "conciliado", categ: t.categ, detalle: m.detalle || "Metrogas Libertad", template_id: t.id, template_cuota_id: cu.id, contable: "LIB",
    comprobantes_pagados: `Metrogas Libertad MA - ${mesDe(m.fecha)}`, motivo_revision: null, nota_operador: nota(m, `${HUELLA}: «${a.nota}» (cuota precargada $ ${cu.monto} → banco)`) }).eq("id", m.id)
  if (e2) throw e2
}
const rC = idsFc.length ? await asignarCuentaAFacturas(sb as any, "MA", idsFc, { cuenta_contable: "Consumos" }) : null
console.log(`\n✅ Escrito: ${hecho.cuotas.length} cuotas nuevas · ${acciones.length} movimientos conciliados · cuenta Consumos en ${rC?.actualizados ?? 0} facturas (${rC?.propagacion.propagados ?? 0} movimientos)`)
if (avisos.length) console.log("⚠️ Avisos:\n - " + avisos.join("\n - "))
