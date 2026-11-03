/**
 * 🏢 Excel de trabajo — GASTOS LIBERTAD y la CUENTA MSA ↔ MA, mes por mes (JMS 03/11). SÓLO LEE la base.
 *
 *     npx tsx scripts/excel-libertad-y-cuenta-ma.mts
 *
 * JMS: «hacé un cuadro de cómo queda Libertad en Excel aparte… hay que armar la cuenta de MSA con PAM, MSA con MA… dirigiéndote en
 * contable para un estudio (e interno para otro)… va más allá de pagos directos: incluye todo tipo de retiro — si MSA pagó una factura
 * de MA, MSA pagase autónomos de MA… por los nombres de los templates, no RET 3… Libertad será un solo renglón de retiros o aportes con
 * su detalle debajo… sería bueno hacer un chequeo más allá de lo anotado en contable: cruzar de base la BBDD… siempre todo mes x mes».
 *
 * Usa las MISMAS funciones que el balance (`desdeCuota`, `vincularBanco`, `hojaLibertad`, `hojaResumenPorMes`), para que el Excel y la
 * solapa «H · Gastos Libertad» den lo mismo. Signo de la cuenta: + = MA RETIRÓ de MSA (MSA puso plata por MA) · − = MA APORTÓ.
 *
 * Qué entra en la cuenta MSA ↔ MA (ejercicio 25/26), y por qué camino se detectó (columna «Detectado por»):
 *  · Un movimiento de una cuenta de MSA (bancos, tarjeta) que paga una cuota de un template de MA, o una factura de MA → MA retiró.
 *  · Un movimiento de una cuenta de MA que paga una cuota de un template de MSA, o una factura de MSA → MA aportó.
 *  · Un movimiento con la marca contable de MA («CTA MA», «RET 3 MA»…) en una cuenta de MSA, aunque no esté atado a nada.
 *  · LIBERTAD: un renglón por mes (lo que MSA pagó − su 50%), sólo ene–jun 2026 (jul–dic 2025 el socio es PAM); su detalle en la solapa.
 *  · NO entran: lo de Libertad uno por uno (va en su renglón), ni los sueldos de MA como empleada de MSA (son sueldo, no retiro).
 * Control: lo detectado por la base SIN marca contable, y lo marcado SIN nada en la base, se listan aparte.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { desdeCuota, type CuotaTemplate } from "../lib/balance/templates-libro"
import { leerMovimientosDeCuotas, vincularBanco, leerExtractoDelEjercicio, indiceDeDestinos } from "../lib/balance/movimientos-de-cuotas"
import { hojaLibertad, esDeLibertad, quienPago, pagosPorFacturaLib } from "../lib/balance/libertad"
import { hojaResumenPorMes } from "../lib/balance/resumen-por-mes"
import { agregarHoja } from "../lib/balance/export-libro-diario"

const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DESDE = "2025-07-01", HASTA = "2026-06-30", ETIQ = "25/26"
const MESES = ["2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"]
const ROT = ["jul-25","ago-25","sep-25","oct-25","nov-25","dic-25","ene-26","feb-26","mar-26","abr-26","may-26","jun-26"]
const meses = MESES.map((clave, i) => ({ clave, rotulo: ROT[i] }))
const r2 = (x: number) => Math.round(x * 100) / 100
const enEj = (f?: string | null) => !!f && f.slice(0, 10) >= DESDE && f.slice(0, 10) <= HASTA
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"

async function todo(q: (d: number, h: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break }
  return out
}

// ── 1 · Las cuotas, como las lee el balance, con su banco
const crudas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura")
  .select("*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable, tipo, cuenta_agrupadora)")
  .gte("fecha_estimada", "2024-01-01").order("id").range(d, h))
let cuotas: CuotaTemplate[] = crudas.map(f => desdeCuota(f))
const leido = await leerMovimientosDeCuotas(sb, cuotas)
cuotas = vincularBanco(cuotas, cuotas, leido.movimientos)
const ex = await leerExtractoDelEjercicio(sb, DESDE, HASTA)
const extracto = { movimientos: ex.movimientos, destinos: indiceDeDestinos(cuotas), tablasQueFallaron: ex.tablasQueFallaron }
const cuotasEj = cuotas.filter(c => enEj(c.fecha))
console.log(`Cuotas leídas ${cuotas.length} (del ejercicio ${cuotasEj.length}) · movimientos del extracto ${ex.movimientos.length}${ex.tablasQueFallaron.length ? ` · ⚠️ fallaron: ${ex.tablasQueFallaron.join(", ")}` : ""}`)

// ── 2 · LIBERTAD — la hoja del balance tal cual, y el neto por mes
const filasLib = hojaLibertad(cuotasEj, ETIQ, meses, extracto)
const libDeTpl = cuotasEj.filter(c => esDeLibertad(c) && Math.abs(c.monto) >= 0.005)
const libTodo = [...libDeTpl, ...pagosPorFacturaLib(libDeTpl, extracto).filter(c => enEj(c.fecha))]
const libMes = MESES.map(m => {
  const cs = libTodo.filter(c => (c.fecha ?? "").slice(0, 7) === m)
  const costo = r2(cs.reduce((t, c) => t + c.monto, 0))
  const msa = r2(cs.filter(c => quienPago(c) === "MSA").reduce((t, c) => t + c.monto, 0))
  return { mes: m, costo, msa, neto: r2(msa - costo / 2) }
})
const libIds = new Set(libTodo.flatMap(c => [c.id, c.grupoPagoId]).filter(Boolean) as string[])

// ── 3 · La cuenta MSA ↔ MA
const porCuota = new Map<string, CuotaTemplate>(); const porGrupo = new Map<string, CuotaTemplate[]>()
for (const c of cuotas) { porCuota.set(c.id, c); if (c.grupoPagoId) porGrupo.set(c.grupoPagoId, [...(porGrupo.get(c.grupoPagoId) ?? []), c]) }
const respDe = (c?: CuotaTemplate) => (c?.responsable ?? "").split("/")[0].trim().toUpperCase()
const fcMA = new Map((await todo((d, h) => sb.schema("ma").from("comprobantes_arca").select("id, denominacion_emisor, punto_venta, numero_desde").order("id").range(d, h))).map((f: any) => [f.id, f]))
const fcMSA = new Map((await todo((d, h) => sb.schema("msa").from("comprobantes_arca").select("id, denominacion_emisor, punto_venta, numero_desde").order("id").range(d, h))).map((f: any) => [f.id, f]))
const MARCA_MA = /\b(cta|ret\s*\d*|cuenta)\s*ma\b/i, MARCA_MSA = /\b(cta|cuenta)\s*msa\b/i
/** El interno de MA: «DIST MA». ⚠️ «DIST MECHI» NO es MA (JMS 03/11). */
const INTERNO_MA = /\bdist\s*ma\b/i
/**
 * ✂️ CORTE POR FECHA (JMS 03/11): Casco, Tapera y Posadas — «son contable PAM en 2025, contable MA en 2026; a nivel interno son de MA
 * desde 3 del 2026 y antes de PAM». Manda sobre la marca del movimiento. Mismo patrón que Libertad (PAM → MA): a generalizar.
 */
// ⚠️ ampliado 03/11 — JMS: «el complementario de PAM pasa a MA como Casco, Ombú, Tapera, Entre Ríos»
const CORTE = /casco|tapera|posadas|complementario|omb[uú]|entre\s*r[ií]os/i, CORTE_CONTABLE_MA = "2026-01-01", CORTE_INTERNO_MA = "2026-03-01"
/**
 * 🧩 «DESGLOSAR» (JMS 03/11: «ej. seguro flota: a interno MA lo afecta, ya que tiene su seguro ahí»). Se reparte con lo que ya sabe la base:
 *  · una PÓLIZA: la prima de cada bien del endoso vigente × de quién es ese bien (`polizas_responsables`, contable e interno) — la Tiguan
 *    de la flota es contable MSA / interno MA;
 *  · un detalle «X | Y» (dos facturas en un pago): partes iguales, y la parte que nombra a un empleado de MA es de MA (preocupacional Alondra).
 * Lo que no se puede repartir así se lista en Control con lo que es.
 */
const polizas = await todo((d, h) => sb.from("polizas_seguro").select("id, poliza, template_id").order("id").range(d, h))
const endosos = await todo((d, h) => sb.from("polizas_endosos").select("id, poliza_id, endoso, periodo_desde, periodo_hasta, es_nota_credito").order("id").range(d, h))
const bienes = await todo((d, h) => sb.from("polizas_bienes").select("endoso_id, clave, descripcion, prima").order("id").range(d, h))
const respBien = new Map((await todo((d, h) => sb.from("polizas_responsables").select("clave, responsable_contable, responsable_interno").order("clave").range(d, h))).map((r: any) => [r.clave, r]))
const polizaDeTemplate = new Map(polizas.filter((p: any) => p.template_id).map((p: any) => [p.template_id, p]))
/** La parte de MA en una cuota de póliza, por estudio, según el endoso vigente a la fecha. */
function parteMAPoliza(egresoId: string | undefined, fecha: string): { contable: number; interno: number; detalle: string } | null {
  const p: any = egresoId ? polizaDeTemplate.get(egresoId) : undefined
  if (!p) return null
  const vig = endosos.filter((e: any) => e.poliza_id === p.id && !e.es_nota_credito && String(e.periodo_desde) <= fecha).sort((a: any, b: any) => String(b.periodo_desde).localeCompare(String(a.periodo_desde)))
  // el endoso vigente es el último que empezó antes de la fecha del pago (la cuota se paga dentro del período o apenas después)
  const e = vig.find((x: any) => bienes.some((b: any) => b.endoso_id === x.id))
  if (!e) return null
  const bs = bienes.filter((b: any) => b.endoso_id === e.id)
  const tot = bs.reduce((t: number, b: any) => t + Number(b.prima || 0), 0)
  if (!tot) return null
  const de = (campo: "responsable_contable" | "responsable_interno") => bs.filter((b: any) => String(respBien.get(b.clave)?.[campo] ?? "").toUpperCase() === "MA").reduce((t: number, b: any) => t + Number(b.prima || 0), 0) / tot
  const ma = bs.filter((b: any) => ["responsable_contable", "responsable_interno"].some(c => String(respBien.get(b.clave)?.[c] ?? "").toUpperCase() === "MA"))
  return { contable: de("responsable_contable"), interno: de("responsable_interno"),
    detalle: `póliza ${p.poliza} endoso ${e.endoso}: ${ma.map((b: any) => `${b.clave} ${String(b.descripcion ?? "").slice(0, 22)} ${(Number(b.prima) / tot * 100).toFixed(1)}%`).join(", ") || "ningún bien de MA"}` }
}
/** Lo «Desglosar» que no se pudo repartir (para Control). */
const desglosarSinRepartir: Item[] = []
// Sueldos: los de un EMPLEADO DE MA pagados por MSA (Alondra Olivo) son retiro de MA; el sueldo de MA como empleada de MSA, no.
const empleados = new Map((await todo((d, h) => sb.from("sueldos_empleados").select("id, nombre, empresa").order("id").range(d, h))).map((e: any) => [e.id, e]))
const pagosSueldo = await todo((d, h) => sb.from("sueldos_pagos").select("id, grupo_pago_id, empleado_id").order("id").range(d, h))
const empleadoDePago = new Map<string, any>()
for (const p of pagosSueldo) { const e = empleados.get(p.empleado_id); if (!e) continue; empleadoDePago.set(p.id, e); if (p.grupo_pago_id && !empleadoDePago.has(p.grupo_pago_id)) empleadoDePago.set(p.grupo_pago_id, e) }

type Item = { mes: string; fecha: string; cuenta: string; titular: string; desc: string; que: string; por: string; contable: string; interno: string; imp: number; nota?: string }
const items: Item[] = []; const marcadosSinNada: Item[] = []; const sinMarca: Item[] = []
/** El estudio es por CONTABLE: lo que el interno da a MA y el contable no, va al control (los dos estudios no coinciden). */
const internoSinContable: Item[] = []
/** El estudio por INTERNO (otro estudio, JMS): todo lo de las cuentas de MSA con interno de MA — Libertad incluida, sin repartir. */
const porInterno: Item[] = []
for (const t of TABLAS_CON_VINCULO_ARCA) {
  if (!["MSA", "MA"].includes(String(t.titular))) continue
  const q = (d: number, h: number) => (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("*").gte("fecha", DESDE).lte("fecha", HASTA).order("id").range(d, h)
  let movs: any[] = []
  try { movs = await todo(q) } catch (e: any) { console.log(`⚠️ ${t.schema}.${t.tabla}: ${e.message}`); continue }
  for (const m of movs) {
    if (m.moneda && String(m.moneda).toUpperCase() !== "ARS" && /usd|dolar/i.test(t.tabla)) continue
    // 📜 El HISTÓRICO (jul-25 → ene-26) guardó su contable e interno en la NOTA («tu planilla: … Contable X · Interno Y»), no en las columnas
    const nTxt = String(m.nota_operador ?? "")
    const deNota = (k: string) => (m.estado === "historico" ? new RegExp(`${k}\\s+([^·]+)`, "i").exec(nTxt)?.[1]?.trim() ?? "" : "")
    const contable = String(m.contable ?? "").trim() || deNota("Contable"), interno = String(m.interno ?? "").trim() || deNota("Interno")
    const deLaNota = !String(m.contable ?? "").trim() && !String(m.interno ?? "").trim() && !!(contable || interno)
    const deb = Number(m.debitos) || 0, cred = Number(m.creditos) || 0
    const cuota = m.template_cuota_id ? porCuota.get(m.template_cuota_id) ?? porGrupo.get(m.template_cuota_id)?.[0] : undefined
    const nota = String(m.nota_operador ?? "").slice(0, 200)
    // El sueldo manda sobre el template (un sueldo pagado en efectivo queda atado también a la cuota de Caja)
    const nombreDe = () => m.sueldo_pago_id && empleadoDePago.get(m.sueldo_pago_id) ? `Sueldos de ${empleadoDePago.get(m.sueldo_pago_id).nombre}`
      : cuota ? (/^caja\b/i.test(cuota.concepto) ? "Efectivo (caja) — ver la nota" : cuota.concepto.replace(/ (MA|MSA|PAM)$/, ""))
      : m.estado === "historico" && /CATEG\s+([A-ZÁÉÍÓÚÑ ]+?)(\s*·|$)/.test(nTxt) ? `Histórico — ${/CATEG\s+([A-ZÁÉÍÓÚÑ ]+?)(\s*·|$)/.exec(nTxt)![1].trim()} (tu planilla)`
      : String(m.comprobantes_pagados || m.categ || m.descripcion || "(sin vínculo)")
    const fecha = String(m.fecha).slice(0, 10)
    const corte = t.titular === "MSA" && !!cuota && CORTE.test(cuota.concepto)
    // ── 🧩 DESGLOSAR: se reparte (póliza o detalle «X | Y») y la parte de MA entra a cada estudio; lo demás va a Control
    if (t.titular === "MSA" && (/^desglos/i.test(contable) || /^desglos/i.test(interno))) {
      const base = { mes: fecha.slice(0, 7), fecha, cuenta: t.cuenta, titular: "MSA", desc: String(m.descripcion ?? "").slice(0, 80), contable, interno, nota: (deLaNota ? "[marca de la nota del histórico] " : "") + nota }
      const imp0 = r2(deb - cred)
      const pol = parteMAPoliza(cuota?.egresoId, fecha)
      const partes = String(m.detalle ?? "").split("|").map(x => x.trim()).filter(Boolean)
      const nombresMA = [...empleados.values()].filter((e: any) => String(e.empresa).toUpperCase() === "MA").map((e: any) => String(e.nombre).split(" ")[0].toLowerCase())
      const parteEmpleado = partes.length > 1 ? partes.filter(p => nombresMA.some(n => p.toLowerCase().includes(n))) : []
      let repartido = false
      if (pol && (pol.contable > 0 || pol.interno > 0)) {
        const que = `${nombreDe()} — parte de MA`
        if (pol.contable > 0 && /^desglos/i.test(contable)) items.push({ ...base, que, por: `desglose por póliza (${(pol.contable * 100).toFixed(1)}% contable)`, imp: r2(imp0 * pol.contable), nota: pol.detalle })
        if (pol.interno > 0 && /^desglos/i.test(interno)) porInterno.push({ ...base, que, por: "", imp: r2(imp0 * pol.interno), nota: `${(pol.interno * 100).toFixed(1)}% · ${pol.detalle}` })
        repartido = true
      } else if (parteEmpleado.length) {
        const share = parteEmpleado.length / partes.length, que = `${nombreDe()} — ${parteEmpleado.join(", ")} (empleada de MA)`
        if (/^desglos/i.test(contable) || !contable) items.push({ ...base, que, por: `desglose por detalle (${parteEmpleado.length} de ${partes.length} partes)`, imp: r2(imp0 * share) })
        if (/^desglos/i.test(interno)) porInterno.push({ ...base, que, por: "", imp: r2(imp0 * share) })
        repartido = true
      }
      if (!repartido) desglosarSinRepartir.push({ ...base, que: nombreDe(), por: pol ? "póliza sin bienes de MA" : "", imp: imp0 })
      continue
    }
    // ── Estudio por INTERNO: antes de cualquier filtro (Libertad entra entera, como dice el interno)
    const esInternoMA = corte ? fecha >= CORTE_INTERNO_MA : INTERNO_MA.test(interno)
    if (t.titular === "MSA" && esInternoMA) porInterno.push({ mes: String(m.fecha).slice(0, 7), fecha: String(m.fecha).slice(0, 10), cuenta: t.cuenta, titular: "MSA",
      desc: String(m.descripcion ?? "").slice(0, 80), que: /^lib/i.test(contable) ? "Libertad (todo, sin repartir)" : nombreDe(), por: "", contable, interno, imp: r2(deb - cred), nota })
    if (/^lib/i.test(contable)) continue                          // Libertad va en su renglón
    if (m.template_cuota_id && libIds.has(m.template_cuota_id)) continue
    const fc = m.comprobante_arca_id ? (t.titular === "MSA" ? fcMA.get(m.comprobante_arca_id) : fcMSA.get(m.comprobante_arca_id)) : undefined
    const otra = t.titular === "MSA" ? "MA" : "MSA"
    // Un sueldo: sólo si el empleado es de la OTRA empresa (Alondra Olivo es de MA); el de MA como empleada de MSA es sueldo, no retiro
    const emp = m.sueldo_pago_id ? empleadoDePago.get(m.sueldo_pago_id) : undefined
    const porSueldo = !!emp && String(emp.empresa).toUpperCase() === otra
    if (m.sueldo_pago_id && !porSueldo && !MARCA_MA.test(contable)) continue
    const porTpl = corte ? fecha >= CORTE_CONTABLE_MA : !!cuota && respDe(cuota) === otra, porFc = !!fc
    const marca = corte ? fecha >= CORTE_CONTABLE_MA : t.titular === "MSA" ? MARCA_MA.test(contable) : MARCA_MSA.test(contable)
    if (corte && fecha < CORTE_CONTABLE_MA) continue             // 2025: es de PAM, no entra a la cuenta con MA
    if (!porTpl && !porFc && !marca && !porSueldo) {
      if (t.titular === "MSA" && /\bdist\s*ma\b/i.test(interno)) internoSinContable.push({ mes: String(m.fecha).slice(0, 7), fecha: String(m.fecha).slice(0, 10), cuenta: t.cuenta,
        titular: "MSA", desc: String(m.descripcion ?? "").slice(0, 80), que: String(m.comprobantes_pagados || m.categ || ""), por: "", contable, interno, imp: r2(deb - cred) })
      continue
    }
    // Qué es: el nombre del template (aunque su responsable no diga MA, como «Retiro MA mensual MSA/PAM»), la factura o el sueldo
    const que = porFc ? `Facturas de ${fc.denominacion_emisor}` : nombreDe()
    // + = MA retiró de MSA: sale plata de MSA por MA (débito en MSA) o entra plata de MA a MSA al revés
    const imp = r2(t.titular === "MSA" ? deb - cred : -(deb - cred))
    const por = [corte ? "corte por fecha (Casco/Tapera/Posadas/Complementario: de MA desde 2026)" : porTpl ? "template de " + otra : "", porFc ? "factura de " + otra : "", porSueldo ? "sueldo de un empleado de " + otra : "", marca ? (deLaNota ? "marca contable (de la nota del histórico)" : "marca contable") : ""].filter(Boolean).join(" + ")
    const it: Item = { mes: String(m.fecha).slice(0, 7), fecha: String(m.fecha).slice(0, 10), cuenta: t.cuenta, titular: String(t.titular), desc: String(m.descripcion ?? "").slice(0, 80),
      que: porFc ? `${que} ${fc.punto_venta}-${fc.numero_desde}` : String(que), por, contable, interno, imp, nota }
    items.push(it)
    if ((porTpl || porFc || porSueldo) && !marca) sinMarca.push(it)
    if (marca && !porTpl && !porFc && !porSueldo && !cuota) marcadosSinNada.push(it)
  }
}
// La categoría del resumen = el nombre del template / factura / marca (no «RET 3»)
const categoria = (it: Item) => it.que.replace(/ \d+-\d+$/, "")
const det = [
  ...items.map(it => ({ categoria: categoria(it), mes: it.mes, importe: it.imp,
    columnas: [it.fecha.split("-").reverse().join("/"), it.cuenta, it.desc, it.que, it.por, it.contable, it.interno, it.nota ?? ""] })),
  ...libMes.filter(x => x.mes >= "2026-01" && x.neto !== 0).map(x => ({ categoria: "LIBERTAD — MSA pagó − su 50% (detalle en la solapa Libertad)", mes: x.mes, importe: x.neto,
    columnas: ["", "Libertad", `costo ${x.costo.toLocaleString("es-AR")} · MSA pagó ${x.msa.toLocaleString("es-AR")} · su 50% ${(x.costo / 2).toLocaleString("es-AR")}`, "Libertad", "cuadro Libertad", "LIB", "", ""] })),
]
const filasCta = hojaResumenPorMes(det, {
  titulo: `CUENTA MSA ↔ MA — ejercicio ${ETIQ} — por CONTABLE y cruce de la base (+ = MA retiró de MSA · − = MA aportó)`,
  notas: ["Sin saldo de inicio: es el MOVIMIENTO del ejercicio. Libertad entra como un renglón por mes (ene–jun 2026; jul–dic 2025 el socio de Libertad es PAM).",
    "Entra todo lo que MSA pagó y era de MA (templates de MA, facturas de MA, sueldos de empleados de MA, lo marcado CTA MA / RET … MA) y al revés (MA pagando cosas de MSA). No entra el sueldo de MA como empleada de MSA.",
    `Control: ${sinMarca.length} movimiento(s) detectados por la base SIN marca contable · ${marcadosSinNada.length} marcados SIN ningún vínculo — ver la solapa Control.`],
  meses, encabezadoDetalle: ["Fecha", "Cuenta", "Descripción del banco", "Qué es", "Detectado por", "Contable", "Interno", "Nota del movimiento"], rotuloImporte: "Importe (+ retiró / − aportó)", semestres: true,
})
// ── El estudio por INTERNO, mes por mes, y la comparación con el de contable
const filasInt = hojaResumenPorMes(porInterno.map(it => ({ categoria: it.que.replace(/ \d+-\d+$/, ""), mes: it.mes, importe: it.imp,
  columnas: [it.fecha.split("-").reverse().join("/"), it.cuenta, it.desc, it.que, it.contable, it.interno, it.nota ?? ""] })), {
  titulo: `MA por INTERNO («DIST MA» / «DIST MECHI») — cuentas de MSA — ejercicio ${ETIQ} (+ = salió de MSA para MA)`,
  notas: ["Otro estudio (JMS): de quién es el gasto puertas adentro. Toma TODO lo de las cuentas de MSA con interno de MA, sin repartir: Libertad entra entera (internamente MA toma el 100%).",
    "No mira las cuentas de MA (no llevan interno). «DIST MECHI» NO es MA. Casco, Tapera y Posadas: de MA desde 03/2026, antes de PAM (corte por fecha, manda sobre la marca)."],
  meses, encabezadoDetalle: ["Fecha", "Cuenta", "Descripción del banco", "Qué es", "Contable", "Interno", "Nota"], rotuloImporte: "Importe", semestres: true,
})
const sumaMes = (xs: { mes: string; imp: number }[], m: string) => r2(xs.filter(x => x.mes === m).reduce((t, x) => t + x.imp, 0))
const contMes = MESES.map(m => r2(sumaMes(items, m) + (m >= "2026-01" ? (libMes.find(x => x.mes === m)?.neto ?? 0) : 0)))
const intMes = MESES.map(m => sumaMes(porInterno, m))
const comparar: unknown[][] = [[`CONTABLE vs INTERNO — MA, mes por mes (${ETIQ})`],
  ["La diferencia se explica sobre todo por: Libertad (en contable va el neto MSA−50%; en interno, todo lo que pagó MSA), Casco/Tapera/Posadas en ene–feb 2026 (contable MA desde enero, interno MA desde marzo), y lo que MA pagó por MSA (sólo en contable)."], [],
  ["1er sem", "2do sem", "total", "", ...ROT, "TOTAL"],
  ...([["Cuenta por CONTABLE (+ Libertad neto)", contMes], ["MA por INTERNO", intMes], ["Diferencia", MESES.map((_, j) => r2(contMes[j] - intMes[j]))]] as [string, number[]][])
    .map(([et, v], k) => { const n = 5 + k, c = (j: number) => String.fromCharCode(69 + j)   // E = jul-25 … P = jun-26
      return [{ t: "n", f: `SUM(E${n}:J${n})`, v: r2(v.slice(0, 6).reduce((a, b) => a + b, 0)) }, { t: "n", f: `SUM(K${n}:P${n})`, v: r2(v.slice(6).reduce((a, b) => a + b, 0)) },
        { t: "n", f: `A${n}+B${n}`, v: r2(v.reduce((a, b) => a + b, 0)) }, et, ...v, { t: "n", f: `SUM(${c(0)}${n}:${c(11)}${n})`, v: r2(v.reduce((a, b) => a + b, 0)) }] })]
const control: unknown[][] = [["CONTROL — lo que la marca contable y la base no dicen igual"], [],
  ["Detectado por la BASE (template o factura de la otra empresa) SIN marca contable"], ["Fecha", "Cuenta", "Descripción", "Qué es", "Importe"],
  ...sinMarca.map(i => [i.fecha.split("-").reverse().join("/"), i.cuenta, i.desc, i.que, i.imp]), [],
  ["MARCADO en contable SIN vínculo en la base (transferencias a MA y otros) — que sean lo que dice la marca"], ["Fecha", "Cuenta", "Descripción", "Marca", "Importe"],
  ...marcadosSinNada.map(i => [i.fecha.split("-").reverse().join("/"), i.cuenta, i.desc, i.contable, i.imp]), [],
  ["INTERNO dice «DIST MA» pero CONTABLE dice otra cosa — los dos estudios no coinciden (no entran a esta cuenta)"],
  ["Fecha", "Cuenta", "Descripción", "Qué pagó", "Contable", "Interno", "Importe"],
  ...internoSinContable.map(i => [i.fecha.split("-").reverse().join("/"), i.cuenta, i.desc, i.que, i.contable || "(vacío)", i.interno, i.imp]), [],
  ["«DESGLOSAR» que no se reparte con lo que sabe la base (no toca a MA salvo que me digas) — pagos de la tarjeta (se desglosa por su resumen), sueldos de JMS/AMS…"],
  ["Fecha", "Cuenta", "Descripción", "Qué pagó", "Contable", "Interno", "Importe", "Nota"],
  ...desglosarSinRepartir.map(i => [i.fecha.split("-").reverse().join("/"), i.cuenta, i.desc, i.que, i.contable || "(vacío)", i.interno || "(vacío)", i.imp, i.nota ?? ""])]

// ── 4 · Escribir (nunca pisa: v2, v3…)
if (!existsSync(CARPETA)) mkdirSync(CARPETA, { recursive: true })
const nombre = (base: string) => { let p = join(CARPETA, `${base}.xlsx`), v = 2; while (existsSync(p)) p = join(CARPETA, `${base} v${v++}.xlsx`); return p }
/** 📌 JMS 03/11: «estas cosas seguilas poniendo dentro del reporte, porque son temas no cerrados». Primera solapa. */
const temas: unknown[][] = [["TEMAS ABIERTOS — lo que falta decidir para cerrar la cuenta MSA ↔ MA y Libertad (" + ETIQ + ")"],
  ["Se actualiza en cada versión. Cuando JMS responde, el tema sale de acá y queda aplicado en las solapas."], [],
  ["#", "Tema", "Qué hay", "Qué falta decidir", "Dónde mirarlo"],
  [1, "AUTO del histórico", "3 pagos jul–sep 2025 «CATEG AUTO» con interno DIST MA en la nota, $ 5.782.079, sin contable", "¿También son retiro de MA por CONTABLE? Hoy cuentan sólo por interno", "MA por interno · «Histórico — AUTO»"],
  [2, "FC - 105 y FC - 851", "Interno DIST MA, contable vacío: $ 522.000 y $ 94.700", "¿Qué son y de quién?", "MA por interno · Control (interno MA, contable otro)"],
  [3, "Posadas en Libertad", "Expensas y ABL de la cochera de Posadas hoy NO entran a Libertad (JMS anotó: «¿habría que agregar Posadas? creo que sí y luego ver con contador»)", "Confirmar con el contador si entra al 50/50", "Libertad"],
  [4, "Fechas de cuotas de Libertad", "Expensas de feb-26 fechada en mar-26 (pago agrupado feb+mar del 10/03); ABL de mar-26 fechado en ene-26", "OK para corregir las 2 fechas (script con deshacer) — no cambia el total, sí el mes", "Libertad"],
  [5, "Luz de diciembre", "Dos pagos de luz en dic-25: $ 205.421 (10/12) y $ 32.770 (31/12)", "¿Qué es la chica?", "Libertad · detalle"],
  [6, "Prosegur", "6 facturas a MA, ene–jun 2026", "¿Empezó en enero 2026 o antes se pagaba de otro modo?", "Libertad"],
  [7, "Cruce PAM ↔ MA en Libertad", "PAM pagó $ 3,0 M de la mitad de MA (2026) y MA $ 2,7 M de la de PAM (2025)", "¿Se registra como cuenta PAM–MA o se deja así? (con MSA no cambia nada)", "Libertad · Quién pagó"],
  [8, "Marcas del histórico en la nota", "286 movimientos jul-25 → ene-26 con contable/interno sólo en la nota (41 con marca)", "Pasarlas a las columnas (cambio de datos: script con OK) — hoy el Excel las lee de la nota", "Detalle · columna Nota"],
  [9, "«Desglosar» sin repartir", "Pagos de la tarjeta de MSA (se desglosan por sus consumos) y sueldos de JMS/AMS", "Nada para MA; van a las cuentas con JMS y AMS cuando se armen", "Control · último cuadro"],
  [10, "Corte por fecha (regla)", "Casco, Tapera, Posadas, Complementario, Ombú, Entre Ríos: contable MA desde 2026, interno desde 03/2026 (fechas escritas en el script)", "Generalizar: una tabla «de quién es tal cosa desde tal fecha» por estudio, que lean socios, Libertad y el papel 14", "—"]]
const wbL = XLSX.utils.book_new(); agregarHoja(wbL, "Gastos Libertad", filasLib); agregarHoja(wbL, "Temas abiertos", [temas[0], temas[1], [], temas[3], ...temas.slice(4).filter((r: any) => [3, 4, 5, 6, 7].includes(r[0]))]); fechasReales(wbL as any)
const pL = nombre("Libertad 25-26 (2026-11-03)"); XLSX.writeFile(wbL, pL)
const wbC = XLSX.utils.book_new(); agregarHoja(wbC, "Temas abiertos", temas); agregarHoja(wbC, "Cuenta MSA-MA", filasCta); agregarHoja(wbC, "Libertad", filasLib); agregarHoja(wbC, "Control", control)
agregarHoja(wbC, "MA por interno", filasInt); agregarHoja(wbC, "Contable vs interno", comparar); fechasReales(wbC as any)
const pC = nombre("Cuenta MSA-MA 25-26 (2026-11-03)"); XLSX.writeFile(wbC, pC)

// ── 5 · Resumen en pantalla
const tot = (xs: Item[]) => r2(xs.reduce((t, i) => t + i.imp, 0))
console.log(`\nLIBERTAD por mes (costo · MSA pagó · neto MSA−50%):`); for (const x of libMes) console.log(`  ${x.mes}  ${x.costo.toFixed(2).padStart(13)}  ${x.msa.toFixed(2).padStart(13)}  ${x.neto.toFixed(2).padStart(12)}`)
console.log(`  total costo ${r2(libMes.reduce((t, x) => t + x.costo, 0))} · neto 2025 ${r2(libMes.slice(0, 6).reduce((t, x) => t + x.neto, 0))} · neto 2026 ${r2(libMes.slice(6).reduce((t, x) => t + x.neto, 0))}`)
console.log(`\nCUENTA MSA↔MA: ${items.length} movimientos · neto ${tot(items)} · + Libertad 2026 ${r2(libMes.slice(6).reduce((t, x) => t + x.neto, 0))}`)
const porCat = new Map<string, number>(); for (const i of items) porCat.set(categoria(i), r2((porCat.get(categoria(i)) ?? 0) + i.imp))
for (const [k, v] of [...porCat].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) console.log(`  ${v.toFixed(2).padStart(14)}  ${k}`)
console.log(`  por mes: ${MESES.map(m => `${m.slice(2)} ${tot(items.filter(i => i.mes === m)).toFixed(0)}`).join(" · ")}`)
console.log(`\nINTERNO MA: ${porInterno.length} movimientos · ${tot(porInterno)}`)
const pi = new Map<string, number>(); for (const i of porInterno) pi.set(i.que.replace(/ \d+-\d+$/, ""), r2((pi.get(i.que.replace(/ \d+-\d+$/, "")) ?? 0) + i.imp))
for (const [k, v] of [...pi].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 25)) console.log(`  ${v.toFixed(2).padStart(14)}  ${k}`)
console.log(`  contable vs interno por mes: ${MESES.map((m, j) => `${m.slice(2)} ${(contMes[j] - intMes[j]).toFixed(0)}`).join(" · ")}`)
const tc = new Map<string, [number, number]>()
for (const i of internoSinContable) { const k = i.contable || "(vacío)"; const x = tc.get(k) ?? [0, 0]; tc.set(k, [x[0] + 1, r2(x[1] + i.imp)]) }
console.log(`Interno «DIST MA» con otro contable: ${[...tc].map(([k, [n, v]]) => `${k} ×${n} (${v})`).join(" · ")}`)
console.log(`Control: sin marca ${sinMarca.length} (${tot(sinMarca)}) · marcados sin vínculo ${marcadosSinNada.length} (${tot(marcadosSinNada)})`)
console.log(`\n📄 ${pL}\n📄 ${pC}`)
