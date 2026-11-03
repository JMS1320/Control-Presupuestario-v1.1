/**
 * 👥 Excel de trabajo — la CUENTA MSA ↔ SOCIO (MA o PAM), mes por mes con semestres, y GASTOS LIBERTAD (JMS 03/11). SÓLO LEE la base.
 *
 *     npx tsx scripts/excel-cuenta-socio.mts --socio MA      (default)
 *     npx tsx scripts/excel-cuenta-socio.mts --socio PAM
 *
 * JMS: «hay que armar la cuenta de MSA con PAM, MSA con MA… dirigiéndote en contable para un estudio y en interno para otro… va más allá
 * de pagos directos: incluye todo tipo de retiro — si MSA pagó una factura de MA, MSA pagase autónomos de MA… por los nombres de los
 * templates, no RET 3… Libertad será un solo renglón de retiros o aportes con su detalle debajo… hacer un chequeo más allá de lo anotado
 * en contable: cruzar de base la BBDD… siempre todo mes x mes» — y «cuando hay tabla por mes, siempre los 2 semestres».
 *
 * Usa las MISMAS funciones que el balance (`desdeCuota`, `vincularBanco`, `hojaLibertad`, `hojaResumenPorMes`), para que el Excel y la
 * solapa «H · Gastos Libertad» den lo mismo. Signo de la cuenta: + = el socio RETIRÓ de MSA · − = el socio APORTÓ.
 *
 * Qué entra (ejercicio 25/26) y por qué camino («Detectado por»):
 *  · Un movimiento de una cuenta de MSA que paga una cuota de un template del socio, una factura del socio, o el sueldo de un empleado
 *    del socio → retiró. Al revés (una cuenta del socio pagando algo de MSA) → aportó.
 *  · Un movimiento con la marca contable del socio («CTA MA», «RET 3 PAM»…) en una cuenta de MSA, aunque no esté atado a nada.
 *  · 📜 El histórico (jul-25 → ene-26) trae su contable/interno en la NOTA: se lee de ahí.
 *  · ✂️ Corte por fecha (JMS): Casco, Tapera, Posadas, Complementario, Ombú, Entre Ríos — contable PAM en 2025 y MA desde 2026; interno PAM
 *    hasta feb-26 y MA desde mar-26. Manda sobre la marca.
 *  · 🧩 «Desglosar»: se reparte con lo que sabe la base (póliza: prima de cada bien × de quién es; detalle «X | Y»: la parte del empleado).
 *  · 🔺 LIBERTAD: un renglón por mes con el reparto entre tres (el socio del mes: MSA pagó − su 50% + la mitad de lo del tercero; el
 *    tercero: aportó la mitad de lo que pagó). Su detalle, en la solapa Libertad.
 *  · NO entran: lo de Libertad uno por uno (va en su renglón), ni el sueldo de un empleado de MSA (MA como empleada de MSA es sueldo).
 * Control: lo detectado por la base SIN marca contable, lo marcado SIN vínculo, y lo que el interno da al socio y el contable no.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { desdeCuota, type CuotaTemplate } from "../lib/balance/templates-libro"
import { leerMovimientosDeCuotas, vincularBanco, leerExtractoDelEjercicio, indiceDeDestinos } from "../lib/balance/movimientos-de-cuotas"
import { hojaLibertad, esDeLibertad, quienPago, pagosPorFacturaLib, socioDelMes } from "../lib/balance/libertad"
import { hojaResumenPorMes } from "../lib/balance/resumen-por-mes"
import { agregarHoja } from "../lib/balance/export-libro-diario"

const S = (process.argv.includes("--socio") ? process.argv[process.argv.indexOf("--socio") + 1] : "MA").toUpperCase() as "MA" | "PAM"
if (!["MA", "PAM"].includes(S)) { console.log("--socio MA | PAM"); process.exit(1) }
const OTRO = S === "MA" ? "PAM" : "MA"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DESDE = "2025-07-01", HASTA = "2026-06-30", ETIQ = "25/26", HOY = "2026-11-03"
const MESES = ["2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"]
const ROT = ["jul-25","ago-25","sep-25","oct-25","nov-25","dic-25","ene-26","feb-26","mar-26","abr-26","may-26","jun-26"]
const meses = MESES.map((clave, i) => ({ clave, rotulo: ROT[i] }))
const r2 = (x: number) => Math.round(x * 100) / 100
const enEj = (f?: string | null) => !!f && f.slice(0, 10) >= DESDE && f.slice(0, 10) <= HASTA
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const dmy = (f: string) => f.split("-").reverse().join("/")

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
console.log(`Socio ${S} · cuotas leídas ${cuotas.length} (del ejercicio ${cuotasEj.length}) · movimientos del extracto ${ex.movimientos.length}${ex.tablasQueFallaron.length ? ` · ⚠️ fallaron: ${ex.tablasQueFallaron.join(", ")}` : ""}`)

// ── 2 · LIBERTAD — la hoja del balance tal cual, y el renglón del socio por mes (reparto entre tres)
const filasLib = hojaLibertad(cuotasEj, ETIQ, meses, extracto)
const libDeTpl = cuotasEj.filter(c => esDeLibertad(c) && Math.abs(c.monto) >= 0.005)
const libTodo = [...libDeTpl, ...pagosPorFacturaLib(libDeTpl, extracto).filter(c => enEj(c.fecha))]
const libMes = MESES.map(m => {
  const cs = libTodo.filter(c => (c.fecha ?? "").slice(0, 7) === m)
  const costo = r2(cs.reduce((t, c) => t + c.monto, 0))
  const pago = (q: string) => r2(cs.filter(c => quienPago(c) === q).reduce((t, c) => t + c.monto, 0))
  const msa = pago("MSA"), suyo = pago(S), delOtro = pago(OTRO)
  const neto = r2(msa - costo / 2), esSocio = socioDelMes(m) === S
  // 🔺 El mismo reparto de la solapa Libertad: socio del mes → neto + la mitad de lo del tercero; tercero → aportó la mitad de lo suyo
  const cta = esSocio ? r2(neto + delOtro / 2) : r2(-suyo / 2)
  return { mes: m, costo, msa, suyo, delOtro, neto, cta, esSocio }
})
const libIds = new Set(libTodo.flatMap(c => [c.id, c.grupoPagoId]).filter(Boolean) as string[])

// ── 3 · La cuenta MSA ↔ socio
const porCuota = new Map<string, CuotaTemplate>(); const porGrupo = new Map<string, CuotaTemplate[]>()
for (const c of cuotas) { porCuota.set(c.id, c); if (c.grupoPagoId) porGrupo.set(c.grupoPagoId, [...(porGrupo.get(c.grupoPagoId) ?? []), c]) }
const respDe = (c?: CuotaTemplate) => (c?.responsable ?? "").split("/")[0].trim().toUpperCase()
const leerFc = async (schema: string) => new Map((await todo((d, h) => sb.schema(schema).from("comprobantes_arca").select("id, denominacion_emisor, punto_venta, numero_desde").order("id").range(d, h))).map((f: any) => [f.id, f]))
const fcSocio = await leerFc(S.toLowerCase()), fcMSA = await leerFc("msa")
const MARCA_SOCIO = new RegExp(`\\b(cta|ret\\s*\\d*|cuenta)\\s*${S}\\b`, "i"), MARCA_MSA = /\b(cta|cuenta)\s*msa\b/i
/** El interno del socio: «DIST MA» / «DIST PAM». ⚠️ «DIST MECHI» NO es MA (JMS 03/11). */
const INTERNO_SOCIO = new RegExp(`\\bdist\\s*${S}\\b`, "i")
// ✂️ CORTE POR FECHA (JMS 03/11): de PAM hasta la fecha, de MA desde la fecha. A generalizar en una tabla (A-FEAT-1532).
const CORTE = /casco|tapera|posadas|complementario|omb[uú]|entre\s*r[ií]os/i, CORTE_CONTABLE = "2026-01-01", CORTE_INTERNO = "2026-03-01"
const delSocioPorCorte = (fecha: string, desde: string) => (S === "MA" ? fecha >= desde : fecha < desde)
// 🧩 DESGLOSAR por póliza: prima de cada bien del endoso vigente × de quién es (`polizas_responsables`)
const polizas = await todo((d, h) => sb.from("polizas_seguro").select("id, poliza, template_id").order("id").range(d, h))
const endosos = await todo((d, h) => sb.from("polizas_endosos").select("id, poliza_id, endoso, periodo_desde, periodo_hasta, es_nota_credito").order("id").range(d, h))
const bienes = await todo((d, h) => sb.from("polizas_bienes").select("endoso_id, clave, descripcion, prima").order("id").range(d, h))
const respBien = new Map((await todo((d, h) => sb.from("polizas_responsables").select("clave, responsable_contable, responsable_interno").order("clave").range(d, h))).map((r: any) => [r.clave, r]))
const polizaDeTemplate = new Map(polizas.filter((p: any) => p.template_id).map((p: any) => [p.template_id, p]))
function parteSocioPoliza(egresoId: string | undefined, fecha: string): { contable: number; interno: number; detalle: string } | null {
  const p: any = egresoId ? polizaDeTemplate.get(egresoId) : undefined
  if (!p) return null
  const vig = endosos.filter((e: any) => e.poliza_id === p.id && !e.es_nota_credito && String(e.periodo_desde) <= fecha).sort((a: any, b: any) => String(b.periodo_desde).localeCompare(String(a.periodo_desde)))
  const e = vig.find((x: any) => bienes.some((b: any) => b.endoso_id === x.id))
  if (!e) return null
  const bs = bienes.filter((b: any) => b.endoso_id === e.id)
  const tot = bs.reduce((t: number, b: any) => t + Number(b.prima || 0), 0)
  if (!tot) return null
  const esDel = (b: any, campo: string) => String(respBien.get(b.clave)?.[campo] ?? "").toUpperCase() === S
  const de = (campo: string) => bs.filter((b: any) => esDel(b, campo)).reduce((t: number, b: any) => t + Number(b.prima || 0), 0) / tot
  const suyos = bs.filter((b: any) => esDel(b, "responsable_contable") || esDel(b, "responsable_interno"))
  return { contable: de("responsable_contable"), interno: de("responsable_interno"),
    detalle: `póliza ${p.poliza} endoso ${e.endoso}: ${suyos.map((b: any) => `${b.clave} ${String(b.descripcion ?? "").slice(0, 22)} ${(Number(b.prima) / tot * 100).toFixed(1)}%`).join(", ") || `ningún bien de ${S}`}` }
}
// Sueldos: los de un EMPLEADO DEL SOCIO pagados por MSA son retiro; el de un empleado de MSA (MA como empleada de MSA), no.
const empleados = new Map((await todo((d, h) => sb.from("sueldos_empleados").select("id, nombre, empresa").order("id").range(d, h))).map((e: any) => [e.id, e]))
const pagosSueldo = await todo((d, h) => sb.from("sueldos_pagos").select("id, grupo_pago_id, empleado_id").order("id").range(d, h))
const empleadoDePago = new Map<string, any>()
for (const p of pagosSueldo) { const e = empleados.get(p.empleado_id); if (!e) continue; empleadoDePago.set(p.id, e); if (p.grupo_pago_id && !empleadoDePago.has(p.grupo_pago_id)) empleadoDePago.set(p.grupo_pago_id, e) }
const nombresEmpleadosSocio = [...empleados.values()].filter((e: any) => String(e.empresa).toUpperCase() === S).map((e: any) => String(e.nombre).split(" ")[0].toLowerCase())

type Item = { mes: string; fecha: string; cuenta: string; titular: string; desc: string; que: string; por: string; contable: string; interno: string; imp: number; nota?: string }
const items: Item[] = [], marcadosSinNada: Item[] = [], sinMarca: Item[] = [], internoSinContable: Item[] = [], porInterno: Item[] = [], desglosarSinRepartir: Item[] = []
for (const t of TABLAS_CON_VINCULO_ARCA) {
  if (!["MSA", S].includes(String(t.titular))) continue
  const q = (d: number, h: number) => (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("*").gte("fecha", DESDE).lte("fecha", HASTA).order("id").range(d, h)
  let movs: any[] = []
  try { movs = await todo(q) } catch (e: any) { console.log(`⚠️ ${t.schema}.${t.tabla}: ${e.message}`); continue }
  const deMSA = t.titular === "MSA"
  for (const m of movs) {
    if (m.moneda && String(m.moneda).toUpperCase() !== "ARS" && /usd|dolar/i.test(t.tabla)) continue
    // 📜 El histórico guardó su contable e interno en la NOTA («tu planilla: … Contable X · Interno Y»)
    const nTxt = String(m.nota_operador ?? "")
    // Vale aunque el movimiento se haya conciliado después (ya no dice «histórico»): lo que manda es que la nota traiga «tu planilla»
    const deNota = (k: string) => (/tu planilla/i.test(nTxt) ? new RegExp(`${k}\\s+([^·]+)`, "i").exec(nTxt)?.[1]?.trim() ?? "" : "")
    const contable = String(m.contable ?? "").trim() || deNota("Contable"), interno = String(m.interno ?? "").trim() || deNota("Interno")
    const deLaNota = !String(m.contable ?? "").trim() && !String(m.interno ?? "").trim() && !!(contable || interno)
    const deb = Number(m.debitos) || 0, cred = Number(m.creditos) || 0
    const cuota = m.template_cuota_id ? porCuota.get(m.template_cuota_id) ?? porGrupo.get(m.template_cuota_id)?.[0] : undefined
    const nota = nTxt.slice(0, 200)
    const nombreDe = () => m.sueldo_pago_id && empleadoDePago.get(m.sueldo_pago_id) ? `Sueldos de ${empleadoDePago.get(m.sueldo_pago_id).nombre}`
      : cuota ? (/^caja\b/i.test(cuota.concepto) ? "Efectivo (caja) — ver la nota" : cuota.concepto.replace(/ (MA|MSA|PAM)$/, ""))
      : /tu planilla/i.test(nTxt) && /CATEG\s+([A-ZÁÉÍÓÚÑ ]+?)(\s*·|$)/.test(nTxt) ? `Histórico — ${/CATEG\s+([A-ZÁÉÍÓÚÑ ]+?)(\s*·|$)/.exec(nTxt)![1].trim()} (tu planilla)`
      : String(m.comprobantes_pagados || m.categ || m.descripcion || "(sin vínculo)")
    const fecha = String(m.fecha).slice(0, 10), mes = fecha.slice(0, 7)
    const base = { mes, fecha, cuenta: t.cuenta, titular: String(t.titular), desc: String(m.descripcion ?? "").slice(0, 80), contable, interno }
    const corte = deMSA && !!cuota && CORTE.test(cuota.concepto)
    // ── 🧩 DESGLOSAR
    if (deMSA && (/^desglos/i.test(contable) || /^desglos/i.test(interno))) {
      const imp0 = r2(deb - cred), pol = parteSocioPoliza(cuota?.egresoId, fecha)
      const partes = String(m.detalle ?? "").split("|").map(x => x.trim()).filter(Boolean)
      const parteEmpleado = partes.length > 1 ? partes.filter(p => nombresEmpleadosSocio.some(n => p.toLowerCase().includes(n))) : []
      const notaB = (deLaNota ? "[marca de la nota del histórico] " : "") + nota
      let repartido = false
      if (pol && (pol.contable > 0 || pol.interno > 0)) {
        const que = `${nombreDe()} — parte de ${S}`
        if (pol.contable > 0 && /^desglos/i.test(contable)) items.push({ ...base, que, por: `desglose por póliza (${(pol.contable * 100).toFixed(1)}% contable)`, imp: r2(imp0 * pol.contable), nota: pol.detalle })
        if (pol.interno > 0 && /^desglos/i.test(interno)) porInterno.push({ ...base, que, por: "", imp: r2(imp0 * pol.interno), nota: `${(pol.interno * 100).toFixed(1)}% · ${pol.detalle}` })
        repartido = true
      } else if (parteEmpleado.length) {
        const share = parteEmpleado.length / partes.length, que = `${nombreDe()} — ${parteEmpleado.join(", ")} (empleado de ${S})`
        if (/^desglos/i.test(contable) || !contable) items.push({ ...base, que, por: `desglose por detalle (${parteEmpleado.length} de ${partes.length} partes)`, imp: r2(imp0 * share), nota: notaB })
        if (/^desglos/i.test(interno)) porInterno.push({ ...base, que, por: "", imp: r2(imp0 * share), nota: notaB })
        repartido = true
      }
      if (!repartido) desglosarSinRepartir.push({ ...base, que: nombreDe(), por: pol ? `póliza sin bienes de ${S}` : "", imp: imp0, nota: notaB })
      continue
    }
    // ── Estudio por INTERNO (Libertad entra entera, como dice el interno)
    const esInterno = corte ? delSocioPorCorte(fecha, CORTE_INTERNO) : INTERNO_SOCIO.test(interno)
    if (deMSA && esInterno) porInterno.push({ ...base, que: /^lib/i.test(contable) ? "Libertad (todo, sin repartir)" : nombreDe(), por: "", imp: r2(deb - cred), nota })
    if (/^lib/i.test(contable)) continue                          // Libertad va en su renglón
    if (m.template_cuota_id && libIds.has(m.template_cuota_id)) continue
    const fc = m.comprobante_arca_id ? (deMSA ? fcSocio.get(m.comprobante_arca_id) : fcMSA.get(m.comprobante_arca_id)) : undefined
    const otra = deMSA ? S : "MSA"
    const emp = m.sueldo_pago_id ? empleadoDePago.get(m.sueldo_pago_id) : undefined
    const porSueldo = !!emp && String(emp.empresa).toUpperCase() === otra
    if (m.sueldo_pago_id && !porSueldo && !MARCA_SOCIO.test(contable)) continue
    if (corte && !delSocioPorCorte(fecha, CORTE_CONTABLE)) continue   // por el corte, ese mes es del otro socio
    const porTpl = corte ? true : !!cuota && respDe(cuota) === otra, porFc = !!fc
    const marca = corte ? true : deMSA ? MARCA_SOCIO.test(contable) : MARCA_MSA.test(contable)
    if (!porTpl && !porFc && !marca && !porSueldo) {
      if (deMSA && INTERNO_SOCIO.test(interno)) internoSinContable.push({ ...base, que: String(m.comprobantes_pagados || m.categ || ""), por: "", imp: r2(deb - cred) })
      continue
    }
    const que = porFc ? `Facturas de ${fc.denominacion_emisor}` : nombreDe()
    const imp = r2(deMSA ? deb - cred : -(deb - cred))
    const por = [corte ? `corte por fecha (Casco/Tapera/Posadas/Complementario: de ${S} ${S === "MA" ? "desde" : "hasta"} 2026)` : porTpl ? "template de " + otra : "",
      porFc ? "factura de " + otra : "", porSueldo ? "sueldo de un empleado de " + otra : "", !corte && marca ? (deLaNota ? "marca contable (de la nota del histórico)" : "marca contable") : ""].filter(Boolean).join(" + ")
    const it: Item = { ...base, que: porFc ? `${que} ${fc.punto_venta}-${fc.numero_desde}` : String(que), por, imp, nota }
    items.push(it)
    if ((porTpl || porFc || porSueldo) && !marca) sinMarca.push(it)
    if (marca && !porTpl && !porFc && !porSueldo && !cuota) marcadosSinNada.push(it)
  }
}
const categoria = (it: Item) => it.que.replace(/ \d+-\d+$/, "")
const det = [
  ...items.map(it => ({ categoria: categoria(it), mes: it.mes, importe: it.imp,
    columnas: [dmy(it.fecha), it.cuenta, it.desc, it.que, it.por, it.contable, it.interno, it.nota ?? ""] })),
  ...libMes.filter(x => x.cta !== 0).map(x => ({ categoria: "LIBERTAD — reparto entre tres (detalle en la solapa Libertad)", mes: x.mes, importe: x.cta,
    columnas: ["", "Libertad", x.esSocio
      ? `${S} socio: MSA pagó ${x.msa.toLocaleString("es-AR")} − su 50% ${(x.costo / 2).toLocaleString("es-AR")} + mitad de lo que pagó ${OTRO} ${(x.delOtro / 2).toLocaleString("es-AR")}`
      : `${S} tercero (socio ${OTRO}): ${S} pagó ${x.suyo.toLocaleString("es-AR")} → aportó la mitad a MSA`, "Libertad", "cuadro Libertad", "LIB", "", ""] })),
]
const filasCta = hojaResumenPorMes(det, {
  titulo: `CUENTA MSA ↔ ${S} — ejercicio ${ETIQ} — por CONTABLE y cruce de la base (+ = ${S} retiró de MSA · − = ${S} aportó)`,
  notas: [`Sin saldo de inicio: es el MOVIMIENTO del ejercicio. Libertad: un renglón por mes con el reparto entre tres (${S} es socio de Libertad ${S === "MA" ? "ene–jun 2026" : "jul–dic 2025"} y tercero el otro semestre).`,
    `Entra todo lo que MSA pagó y era de ${S} (templates, facturas, sueldos de sus empleados, lo marcado CTA/RET … ${S}) y al revés (${S} pagando cosas de MSA).`,
    `Control: ${sinMarca.length} detectados por la base SIN marca contable · ${marcadosSinNada.length} marcados SIN ningún vínculo — ver la solapa Control.`],
  meses, encabezadoDetalle: ["Fecha", "Cuenta", "Descripción del banco", "Qué es", "Detectado por", "Contable", "Interno", "Nota del movimiento"], rotuloImporte: "Importe (+ retiró / − aportó)", semestres: true,
})
const filasInt = hojaResumenPorMes(porInterno.map(it => ({ categoria: it.que.replace(/ \d+-\d+$/, ""), mes: it.mes, importe: it.imp,
  columnas: [dmy(it.fecha), it.cuenta, it.desc, it.que, it.contable, it.interno, it.nota ?? ""] })), {
  titulo: `${S} por INTERNO («DIST ${S}») — cuentas de MSA — ejercicio ${ETIQ} (+ = salió de MSA para ${S})`,
  notas: [`Otro estudio (JMS): de quién es el gasto puertas adentro. Toma TODO lo de las cuentas de MSA con interno de ${S}, sin repartir (Libertad entra entera).`,
    `No mira las cuentas de ${S} (no llevan interno). «DIST MECHI» NO es MA. Casco, Tapera, Posadas, Complementario: de PAM hasta feb-26 y de MA desde mar-26 (corte por fecha).`],
  meses, encabezadoDetalle: ["Fecha", "Cuenta", "Descripción del banco", "Qué es", "Contable", "Interno", "Nota"], rotuloImporte: "Importe", semestres: true,
})
const sumaMes = (xs: { mes: string; imp: number }[], m: string) => r2(xs.filter(x => x.mes === m).reduce((t, x) => t + x.imp, 0))
const contMes = MESES.map(m => r2(sumaMes(items, m) + (libMes.find(x => x.mes === m)?.cta ?? 0)))
const intMes = MESES.map(m => sumaMes(porInterno, m))
const comparar: unknown[][] = [[`CONTABLE vs INTERNO — ${S}, mes por mes (${ETIQ})`],
  ["La diferencia se explica sobre todo por: Libertad (en contable va el reparto entre tres; en interno, todo lo que pagó MSA), el corte por fecha (contable cambia en enero, interno en marzo), y lo que el socio pagó por MSA (sólo en contable)."], [],
  ["1er sem", "2do sem", "total", "", ...ROT, "TOTAL"],
  ...([[`Cuenta por CONTABLE (+ Libertad, reparto entre tres)`, contMes], [`${S} por INTERNO`, intMes], ["Diferencia", MESES.map((_, j) => r2(contMes[j] - intMes[j]))]] as [string, number[]][])
    .map(([et, v], k) => { const n = 5 + k, c = (j: number) => String.fromCharCode(69 + j)
      return [{ t: "n", f: `SUM(E${n}:J${n})`, v: r2(v.slice(0, 6).reduce((a, b) => a + b, 0)) }, { t: "n", f: `SUM(K${n}:P${n})`, v: r2(v.slice(6).reduce((a, b) => a + b, 0)) },
        { t: "n", f: `A${n}+B${n}`, v: r2(v.reduce((a, b) => a + b, 0)) }, et, ...v, { t: "n", f: `SUM(${c(0)}${n}:${c(11)}${n})`, v: r2(v.reduce((a, b) => a + b, 0)) }] })]
const control: unknown[][] = [[`CONTROL — lo que la marca contable y la base no dicen igual (${S})`], [],
  [`Detectado por la BASE (template, factura o sueldo de ${S}) SIN marca contable`], ["Fecha", "Cuenta", "Descripción", "Qué es", "Importe"],
  ...sinMarca.map(i => [dmy(i.fecha), i.cuenta, i.desc, i.que, i.imp]), [],
  [`MARCADO en contable SIN vínculo en la base (transferencias y otros) — que sean lo que dice la marca`], ["Fecha", "Cuenta", "Descripción", "Marca", "Importe"],
  ...marcadosSinNada.map(i => [dmy(i.fecha), i.cuenta, i.desc, i.contable, i.imp]), [],
  [`INTERNO dice «DIST ${S}» pero CONTABLE dice otra cosa — los dos estudios no coinciden (no entran a esta cuenta)`],
  ["Fecha", "Cuenta", "Descripción", "Qué pagó", "Contable", "Interno", "Importe"],
  ...internoSinContable.map(i => [dmy(i.fecha), i.cuenta, i.desc, i.que, i.contable || "(vacío)", i.interno, i.imp]), [],
  [`«DESGLOSAR» que no se reparte con lo que sabe la base (no toca a ${S} salvo que JMS diga) — pagos de la tarjeta (se desglosa por su resumen), sueldos de JMS/AMS…`],
  ["Fecha", "Cuenta", "Descripción", "Qué pagó", "Contable", "Interno", "Importe", "Nota"],
  ...desglosarSinRepartir.map(i => [dmy(i.fecha), i.cuenta, i.desc, i.que, i.contable || "(vacío)", i.interno || "(vacío)", i.imp, i.nota ?? ""])]

// ── 4 · Temas abiertos (JMS: «seguilas poniendo dentro del reporte, porque son temas no cerrados») — primera solapa
const tot = (xs: Item[]) => r2(xs.reduce((t, i) => t + i.imp, 0))
const T_LIB: unknown[][] = [
  ["Libertad", "Posadas en Libertad", "Expensas y ABL de la cochera de Posadas hoy NO entran (JMS: «¿habría que agregar Posadas? creo que sí y luego ver con contador»)", "Confirmar con el contador si entra al 50/50", "Libertad"],
  ["Libertad", "Fechas de cuotas", "Expensas de feb-26 fechada en mar-26 (pago agrupado feb+mar del 10/03); ABL de mar-26 fechado en ene-26", "OK para corregir las 2 fechas (script con deshacer) — no cambia el total, sí el mes", "Libertad"],
  ["Libertad", "Luz de diciembre", "Dos pagos de luz en dic-25: $ 205.421 (10/12) y $ 32.770 (31/12)", "¿Qué es la chica?", "Libertad · detalle"],
  ["Libertad", "Prosegur", "6 facturas a MA, ene–jun 2026", "¿Empezó en enero 2026 o antes se pagaba de otro modo?", "Libertad"],
  ["Libertad", "Saldo entre PAM y MA", "Calculado (reparto entre tres): el renglón «ENTRE PAM Y MA» es lo que el socio le debe al tercero", "¿Se registra en algún lado?", "Libertad · reparto entre tres"],
]
const T_COMUN: unknown[][] = [
  ["Histórico", "Marcas en la nota", "286 movimientos jul-25 → ene-26 con contable/interno sólo en la nota (41 con marca)", "Pasarlas a las columnas (cambio de datos: script con OK) — hoy el Excel las lee de la nota", "Detalle · columna Nota"],
  ["Regla", "Corte por fecha", "Casco, Tapera, Posadas, Complementario, Ombú, Entre Ríos: contable MA desde 2026, interno desde 03/2026 (fechas escritas en el script)", "Generalizar: una tabla «de quién es tal cosa desde tal fecha» por estudio", "—"],
  ["Control", "«Desglosar» sin repartir", `${desglosarSinRepartir.length} movimientos ($ ${tot(desglosarSinRepartir).toLocaleString("es-AR")}): pagos de la tarjeta de MSA y sueldos de JMS/AMS`, `Nada para ${S}, salvo que alguno lo sea`, "Control · último cuadro"],
]
const T_SOCIO: unknown[][] = S === "MA" ? [
  [S, "AUTO del histórico", "3 pagos jul–sep 2025 «CATEG AUTO» con interno DIST MA en la nota, $ 5.782.079, sin contable", "¿También son retiro de MA por CONTABLE? Hoy cuentan sólo por interno", "MA por interno · «Histórico — AUTO»"],
  [S, "FC - 105 y FC - 851", "Interno DIST MA, contable vacío: $ 522.000 y $ 94.700", "¿Qué son y de quién?", "MA por interno · Control"],
] : [
  [S, `Interno ${S} sin contable`, `${internoSinContable.length} movimientos ($ ${tot(internoSinContable).toLocaleString("es-AR")}) con interno DIST ${S} y contable de otro o vacío`, "¿Son retiro de PAM también por contable?", "Control · interno sin contable"],
  [S, "Sin marca contable", `${sinMarca.length} movimientos ($ ${tot(sinMarca).toLocaleString("es-AR")}) que la base da a ${S} sin marca contable`, "Confirmar que son de PAM", "Control · primer cuadro"],
  [S, "Marcados sin vínculo", `${marcadosSinNada.length} movimientos ($ ${tot(marcadosSinNada).toLocaleString("es-AR")}) marcados ${S} sin nada en la base (transferencias, retiros)`, "Que sean lo que dice la marca", "Control · segundo cuadro"],
]
const temas: unknown[][] = [[`TEMAS ABIERTOS — lo que falta decidir para cerrar la cuenta MSA ↔ ${S} y Libertad (${ETIQ})`],
  ["Se actualiza en cada versión. Cuando JMS responde, el tema sale de acá y queda aplicado en las solapas."], [],
  ["#", "De", "Tema", "Qué hay", "Qué falta decidir", "Dónde mirarlo"],
  ...[...T_SOCIO, ...T_LIB, ...T_COMUN].map((r, i) => [i + 1, ...r])]

// ── 5 · Escribir (nunca pisa: v2, v3…)
if (!existsSync(CARPETA)) mkdirSync(CARPETA, { recursive: true })
const nombre = (b: string) => { let p = join(CARPETA, `${b}.xlsx`), v = 2; while (existsSync(p)) p = join(CARPETA, `${b} v${v++}.xlsx`); return p }
const wbC = XLSX.utils.book_new(); agregarHoja(wbC, "Temas abiertos", temas); agregarHoja(wbC, `Cuenta MSA-${S}`, filasCta); agregarHoja(wbC, "Libertad", filasLib)
agregarHoja(wbC, "Control", control); agregarHoja(wbC, `${S} por interno`, filasInt); agregarHoja(wbC, "Contable vs interno", comparar); fechasReales(wbC as any)
const pC = nombre(`Cuenta MSA-${S} 25-26 (${HOY})`); XLSX.writeFile(wbC, pC)

// ── 6 · Resumen en pantalla
console.log(`\nLIBERTAD (${S}): 1er sem ${r2(libMes.slice(0, 6).reduce((t, x) => t + x.cta, 0))} · 2do sem ${r2(libMes.slice(6).reduce((t, x) => t + x.cta, 0))}`)
console.log(`CUENTA MSA↔${S}: ${items.length} movimientos · ${tot(items)} · con Libertad ${r2(tot(items) + libMes.reduce((t, x) => t + x.cta, 0))}`)
const porCat = new Map<string, number>(); for (const i of items) porCat.set(categoria(i), r2((porCat.get(categoria(i)) ?? 0) + i.imp))
for (const [k, v] of [...porCat].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 30)) console.log(`  ${v.toFixed(2).padStart(14)}  ${k}`)
console.log(`  por mes: ${MESES.map((m, j) => `${m.slice(2)} ${contMes[j].toFixed(0)}`).join(" · ")}`)
console.log(`INTERNO ${S}: ${porInterno.length} movimientos · ${tot(porInterno)}`)
const pi = new Map<string, number>(); for (const i of porInterno) pi.set(categoria(i), r2((pi.get(categoria(i)) ?? 0) + i.imp))
for (const [k, v] of [...pi].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 20)) console.log(`  ${v.toFixed(2).padStart(14)}  ${k}`)
console.log(`Control: sin marca ${sinMarca.length} (${tot(sinMarca)}) · marcados sin vínculo ${marcadosSinNada.length} (${tot(marcadosSinNada)}) · interno sin contable ${internoSinContable.length} (${tot(internoSinContable)}) · desglosar sin repartir ${desglosarSinRepartir.length}`)
console.log(`\n📄 ${pC}`)
