/**
 * 🏷️ Excel de trabajo — CONTABLE e INTERNO de todos los movimientos, con PROPUESTAS y CONTROL DEL 100%. Ejercicio 25/26. SÓLO LEE.
 *
 *     npx tsx scripts/excel-marcas-contable-interno.mts
 *
 * JMS 06/11 (A-FEAT-1577): *«el objetivo es procesar bien estas dos columnas… trabajar en el Excel que tiene todas las marcas… si vos me
 * ponés agrupaciones… iría una por una viendo cosas similares»* · *«¿una propuesta para contable y otra para interno?»* → dos, separadas ·
 * *«el cheq de seguridad es saber que estamos teniendo el 100% de los movimientos… lo que se nos pase acá no lo recuperamos»* ·
 * *«los cheqs siempre quiero verlos»*.
 *
 * Solapas:
 *  · «Control 100%» — tres caminos independientes que tienen que cerrar:
 *      1. la BASE: las 21 tablas que tienen contable/interno, leídas enteras y contadas aparte (conteo directo de la base vs. lo leído);
 *      2. TU PLANILLA de origen (Extracto MSA y Extracto PAM, jul-25 → ene-26) renglón por renglón contra la base;
 *      3. lo que la BASE le da a otro (template, factura o sueldo de otra empresa) y no tiene marca.
 *  · «Contable» y «Interno» — resumen por GRUPO PROPUESTO y por mes (con semestres; Nro que filtra el detalle) y debajo cada movimiento
 *    con todos sus datos + «Grupo propuesto · Socio propuesto · Qué propongo · Tu respuesta». Cada solapa con SU propuesta.
 *  · «Tu planilla vs base» — el detalle del camino 2.
 *  · «Todas las marcas» — cada marca tal como está escrita, con sus variantes y la forma que propongo para unificarlas.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { hojaResumenPorMes } from "../lib/balance/resumen-por-mes"
import { agregarHoja } from "../lib/balance/export-libro-diario"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DESDE = "2025-07-01", HASTA = "2026-06-30", HOY = "2026-11-06"
const MESES = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
const ROT = ["jul-25", "ago-25", "sep-25", "oct-25", "nov-25", "dic-25", "ene-26", "feb-26", "mar-26", "abr-26", "may-26", "jun-26"]
const meses = MESES.map((clave, i) => ({ clave, rotulo: ROT[i] }))
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const r2 = (x: number) => Math.round(x * 100) / 100
const dmy = (f: string) => f.split("-").reverse().join("/")
const OK = "✅", MAL = "🔴", OJO = "🟡"

async function todo(q: (d: number, h: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break }
  return out
}
const desde = (schema: string, tabla: string) => (schema === "public" ? sb.from(tabla) : sb.schema(schema).from(tabla))

// ── Las tablas de la base que tienen las columnas contable e interno (information_schema, consultado el 06/11/2026).
// Si aparece una tabla nueva con esas columnas y no está en la lista de cuentas, el control lo marca en rojo.
const TABLAS_CON_MARCAS_EN_LA_BASE = ["ma.anses_ca_pesos", "ma.ca_usd", "ma.caja_usd", "ma.ma_galicia", "ma.tarjeta_visa", "msa.caja_ams", "msa.caja_general",
  "msa.caja_sigot", "msa.caja_usd", "msa.cc_usd", "msa.echeqs_terceros", "msa.provincia", "msa.santander", "msa.tarjeta_visa_business", "pam.tarjeta_visa",
  "public.cotitulares_ca_pesos", "public.cotitulares_ca_usd", "public.cotitulares_caja_usd", "public.msa_galicia", "public.pam_galicia", "public.pam_galicia_cc"]

// ── Vínculos: template (con su responsable), sueldo (empresa del empleado), factura (de qué empresa es)
const cuotas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura").select("id, egreso_id, grupo_pago_id").order("id").range(d, h))
const egresos = new Map((await todo((d, h) => sb.from("egresos_sin_factura").select("id, nombre_referencia, responsable").order("id").range(d, h))).map((e: any) => [e.id, e]))
const tplDe = new Map<string, { nombre: string; resp: string }>()
for (const c of cuotas) {
  const e: any = egresos.get(c.egreso_id); if (!e) continue
  const x = { nombre: String(e.nombre_referencia ?? ""), resp: String(e.responsable ?? "") }
  tplDe.set(c.id, x)
  if (c.grupo_pago_id) { const ya = tplDe.get(c.grupo_pago_id); tplDe.set(c.grupo_pago_id, ya && ya.nombre !== x.nombre ? { nombre: `${ya.nombre.split(" + ")[0]} + otros (grupo)`, resp: ya.resp === x.resp ? x.resp : `${ya.resp}/${x.resp}` } : x) }
}
const empleados = new Map((await todo((d, h) => sb.from("sueldos_empleados").select("id, nombre, empresa").order("id").range(d, h))).map((e: any) => [e.id, e]))
const sueldoDe = new Map<string, any>()
for (const p of await todo((d, h) => sb.from("sueldos_pagos").select("id, grupo_pago_id, empleado_id").order("id").range(d, h))) {
  const e = empleados.get(p.empleado_id); if (!e) continue
  sueldoDe.set(p.id, e); if (p.grupo_pago_id && !sueldoDe.has(p.grupo_pago_id)) sueldoDe.set(p.grupo_pago_id, e)
}
const fcDe = new Map<string, { emp: string; quien: string }>()
for (const s of ["msa", "pam", "ma"]) for (const f of await todo((d, h) => sb.schema(s).from("comprobantes_arca").select("id, denominacion_emisor").order("id").range(d, h)))
  fcDe.set(f.id, { emp: s.toUpperCase(), quien: String(f.denominacion_emisor ?? "") })

// ── CAMINO 1 · la base, tabla por tabla
type Mov = { id: string; tabla: string; fecha: string; mes: string; cuenta: string; titular: string; usd: boolean; desc: string; detalle: string; contra: string
  deb: number; cred: number; categ: string; tpl: string; delOtro: string; estado: string; contable: string; interno: string; nota: string; enPlanilla: string }
const todos: Mov[] = []
type FilaTabla = { cuenta: string; tabla: string; titular: string; usd: boolean; directoTotal: number | null; leidos: number; directoMarca: number | null; leidosNoNulo: number; enBlanco: number; marcados: number; error: string }
const control1: FilaTabla[] = []
const porCuentaMes = new Map<string, { tot: number[]; marca: number[] }>()
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const ft: FilaTabla = { cuenta: t.cuenta, tabla: `${t.schema}.${t.tabla}`, titular: String(t.titular), usd: !!(t as any).enDolares, directoTotal: null, leidos: 0, directoMarca: null, leidosNoNulo: 0, enBlanco: 0, marcados: 0, error: "" }
  control1.push(ft)
  // conteo DIRECTO de la base (independiente de la lectura de a 1000)
  const c1 = await desde(t.schema, t.tabla).select("*", { count: "exact", head: true }).gte("fecha", DESDE).lte("fecha", HASTA)
  const c2 = await desde(t.schema, t.tabla).select("*", { count: "exact", head: true }).gte("fecha", DESDE).lte("fecha", HASTA).or("contable.not.is.null,interno.not.is.null")
  if (c1.error || c2.error) ft.error = (c1.error ?? c2.error).message
  ft.directoTotal = c1.count ?? null; ft.directoMarca = c2.count ?? null
  let movs: any[] = []
  try { movs = await todo((d, h) => desde(t.schema, t.tabla).select("*").gte("fecha", DESDE).lte("fecha", HASTA).order("id").range(d, h)) } catch (e: any) { ft.error = e.message; continue }
  ft.leidos = movs.length
  const cm = porCuentaMes.get(t.cuenta) ?? { tot: MESES.map(() => 0), marca: MESES.map(() => 0) }; porCuentaMes.set(t.cuenta, cm)
  for (const m of movs) {
    const fecha = String(m.fecha).slice(0, 10), j = MESES.indexOf(fecha.slice(0, 7))
    if (j >= 0) cm.tot[j]++
    const cRaw = m.contable, iRaw = m.interno
    if (cRaw != null || iRaw != null) ft.leidosNoNulo++
    const contable = String(cRaw ?? "").trim(), interno = String(iRaw ?? "").trim()
    if ((cRaw != null || iRaw != null) && !contable && !interno) ft.enBlanco++
    // ¿la base se lo da a OTRO? (camino 3)
    const titular = String(t.titular).toUpperCase()
    const tpl = m.template_cuota_id ? tplDe.get(m.template_cuota_id) : undefined
    const emp = m.sueldo_pago_id ? sueldoDe.get(m.sueldo_pago_id) : undefined
    const fc = m.comprobante_arca_id ? fcDe.get(m.comprobante_arca_id) : undefined
    const ajeno = (x: string) => !!x && !x.toUpperCase().split("/").map(s => s.trim()).includes(titular)
    const delOtro = [tpl && ajeno(tpl.resp) ? `template de ${tpl.resp}` : "", emp && ajeno(String(emp.empresa)) ? `sueldo de ${emp.nombre} (${emp.empresa})` : "",
      fc && ajeno(fc.emp) ? `factura de ${fc.emp}` : ""].filter(Boolean).join(" + ")
    if (!contable && !interno && !delOtro) continue
    if (contable || interno) { ft.marcados++; if (j >= 0) cm.marca[j]++ }
    todos.push({ id: String(m.id), tabla: `${t.schema}.${t.tabla}`, fecha, mes: fecha.slice(0, 7), cuenta: t.cuenta, titular: String(t.titular), usd: ft.usd,
      desc: String(m.descripcion ?? "").slice(0, 80), detalle: String(m.detalle ?? "").trim(), contra: String(m.leyendas_adicionales_1 ?? m.proveedor_nombre ?? "").trim(),
      deb: r2(Number(m.debitos) || 0), cred: r2(Number(m.creditos) || 0), categ: String(m.categ ?? ""),
      tpl: tpl ? `${tpl.nombre}${tpl.resp ? ` (${tpl.resp})` : ""}` : emp ? `Sueldo de ${emp.nombre} (${emp.empresa})` : fc ? `Factura de ${fc.quien} (${fc.emp})` : m.template_cuota_id ? "(cuota no encontrada)" : "",
      delOtro, estado: String(m.estado ?? ""), contable, interno, nota: String(m.nota_operador ?? ""), enPlanilla: "" })
  }
}
todos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cuenta.localeCompare(b.cuenta))
const marcados = todos.filter(m => m.contable || m.interno), sinMarca = todos.filter(m => !m.contable && !m.interno)

// ── CAMINO 2 · tu planilla de origen, renglón por renglón contra la base
const sv = (v: unknown) => (v == null ? "" : String(v).trim())
type FilaPl = { planilla: string; tabla: string; fecha: string; desc: string; deb: number; cred: number; contable: string; interno: string; base?: Mov; baseId?: string; baseC?: string; baseI?: string; estado: string }
const planillas: FilaPl[] = []
const totPlanillaMes = new Map<string, number[]>()
function leerPlanilla(archivo: string, bloques: { tabla: string; nombre: string; deb: string; cred: string; desc: string }[]) {
  const p = join(CARPETA, archivo)
  if (!existsSync(p)) { planillas.push({ planilla: archivo, tabla: "", fecha: "", desc: "NO SE ENCONTRÓ EL ARCHIVO", deb: 0, cred: 0, contable: "", interno: "", estado: MAL }); return }
  const ws = XLSX.readFile(p, { cellDates: true }).Sheets[XLSX.readFile(p, { bookSheets: true }).SheetNames[0]]
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })
  const cabeceras = aoa.map((r, i) => (sv(r?.[0]) === "Fecha" ? i : -1)).filter(i => i >= 0)
  cabeceras.forEach((h, k) => {
    const b = bloques[k]; if (!b) return
    const H = new Map(aoa[h].map((v, j) => [sv(v), j]))
    const fin = cabeceras[k + 1] ?? aoa.length
    const tot = totPlanillaMes.get(b.nombre) ?? MESES.map(() => 0); totPlanillaMes.set(b.nombre, tot)
    for (const r of aoa.slice(h + 1, fin)) {
      const f = r?.[0]; if (!(f instanceof Date)) continue
      const fecha = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`
      if (fecha < DESDE || fecha > HASTA) continue
      const j = MESES.indexOf(fecha.slice(0, 7)); if (j >= 0) tot[j]++
      const contable = sv(r[H.get("Contable")!]), interno = sv(r[H.get("Interno")!])
      if (!contable && !interno) continue
      planillas.push({ planilla: b.nombre, tabla: b.tabla, fecha, desc: sv(r[H.get(b.desc)!]).slice(0, 80), deb: r2(Number(r[H.get(b.deb)!]) || 0), cred: r2(Number(r[H.get(b.cred)!]) || 0), contable, interno, estado: "" })
    }
  })
}
leerPlanilla("Extracto MSA - Control Presupuestario.xlsx", [{ tabla: "public.msa_galicia", nombre: "Extracto MSA (Galicia MSA CC)", deb: "Débitos", cred: "Créditos", desc: "Descripción" }])
leerPlanilla("Extracto PAM - Control Presupuestario.xlsx", [
  { tabla: "public.pam_galicia", nombre: "Extracto PAM (Galicia PAM CA)", deb: "Débito", cred: "Crédito", desc: "Movimiento" },
  { tabla: "public.pam_galicia_cc", nombre: "Extracto PAM (Galicia PAM CC)", deb: "Débitos", cred: "Créditos", desc: "Descripción" }])
// la base de esas tres cuentas, TODOS sus movimientos (con o sin marca), para buscar cada renglón
const baseDe = new Map<string, any[]>()
for (const tabla of ["public.msa_galicia", "public.pam_galicia", "public.pam_galicia_cc"]) {
  const [s, t] = tabla.split(".")
  baseDe.set(tabla, await todo((d, h) => desde(s, t).select("id, fecha, debitos, creditos, contable, interno, nota_operador").gte("fecha", DESDE).lte("fecha", "2026-01-31").order("id").range(d, h)))
}
const norm = (x: string) => x.toUpperCase().replace(/\s+/g, " ").trim()
const usados = new Set<string>()
for (const p of planillas) {
  if (!p.tabla) continue
  const cands = (baseDe.get(p.tabla) ?? []).filter((m: any) => String(m.fecha).slice(0, 10) === p.fecha && r2(Number(m.debitos) || 0) === p.deb && r2(Number(m.creditos) || 0) === p.cred && !usados.has(m.id))
  const igual = (m: any) => norm(sv(m.contable)) === norm(p.contable) && norm(sv(m.interno)) === norm(p.interno)
  const elegido = cands.find(igual) ?? cands[0]
  if (!elegido) { p.estado = `${MAL} no está en la base`; continue }
  usados.add(elegido.id); p.baseId = elegido.id; p.baseC = sv(elegido.contable); p.baseI = sv(elegido.interno)
  p.estado = igual(elegido) ? (sv(elegido.contable) === p.contable && sv(elegido.interno) === p.interno ? `${OK} igual` : `${OK} igual (cambia mayúscula/espacio)`) : `${OJO} en la base dice otra cosa${(() => { const sc = sv(elegido.nota_operador).match(/\[script \d+\][^«]*«[^»]*»/)?.[0]; return sc ? ` — se cambió después: ${sc}` : " — sin explicación en la nota" })()}`
  const mov = todos.find(m => m.id === String(elegido.id)); if (mov) mov.enPlanilla = p.estado.startsWith(OK) ? "✅ igual a tu planilla" : `🟡 tu planilla: ${p.contable || "—"} / ${p.interno || "—"}`
}
// al revés: marcados en la base, en esas cuentas y meses, que no salen de tu planilla (los marcaste después, en la app)
const soloEnBase = marcados.filter(m => ["public.msa_galicia", "public.pam_galicia", "public.pam_galicia_cc"].includes(m.tabla) && m.fecha <= "2026-01-31" && !usados.has(m.id))

// ── PROPUESTAS — contable e interno por separado
const SOCIOS = ["MA", "PAM", "AMS", "JMS", "MANU", "MECHI", "SOLE"]
const TERCEROS = ["AFA", "FED PAT", "CENTRO ARECO SADA", "ESPOSITO", "TRABUCCO", "COTITULARES"]
type Prop = { grupo: string; socio: string; que: string }
function proponerContable(m: Mov): Prop {
  const x = norm(m.contable)
  if (!x) return { grupo: "Sin marca — la base lo da a otro", socio: m.delOtro.match(/\b(MA|PAM|MSA)\b/)?.[1] ?? "?", que: `Falta la marca: ${m.delOtro}. ¿Va a la cuenta de ese socio?` }
  if (/^LIB/.test(x)) return { grupo: "Libertad", socio: "MA · PAM · MSA (entre tres)", que: "Va al renglón de Libertad, aparte de la cuenta de retiros" }
  if (/^DESGLOS/.test(x)) return { grupo: "Desglosar (gasto compartido)", socio: "a repartir", que: "Repartir por lo que es de cada uno (póliza, tarjeta, sueldo)" }
  if (/^ASIENTO CONTABLE/.test(x)) return { grupo: "Gastos e impuestos bancarios (asiento del contador)", socio: m.titular, que: "Es de la empresa de la cuenta; no va a un socio" }
  if (/^(X|VER)$/.test(x)) return { grupo: "Para revisar (X / VER)", socio: "?", que: "Decime qué es" }
  let r: RegExpMatchArray | null
  if ((r = x.match(/^(?:CALCULO|CÁLCULO) (\w+)$/))) return { grupo: "Sueldo de socio (cálculo)", socio: r[1], que: `Sueldo de ${r[1]}: lo que MSA le debe; sus retiros se descuentan de ahí` }
  if ((r = x.match(/^DIST (\w+)$/))) return { grupo: "Distribución a socio", socio: r[1], que: `Distribución a ${r[1]} (no es retiro a cuenta)` }
  if ((r = x.match(/^(\w+) RET\s*(\d+|I)?\s*MSA$/))) return { grupo: "Espejo de un retiro (ya contado en MSA)", socio: r[1], que: `Es la misma transferencia que en MSA figura como retiro de ${r[1]}: se cuenta una vez, del lado de MSA` }
  if ((r = x.match(/^AP\s*(\d+)?\s*MSA$/))) return { grupo: "Aporte del socio a MSA", socio: m.titular, que: `${m.titular} pagó algo de MSA: es aporte de ${m.titular}` }
  if (/^AP\s*\d+$/.test(x)) return { grupo: "Aporte del socio a MSA", socio: m.titular === "MSA" ? "?" : m.titular, que: m.cred ? `MSA recibió un aporte: ¿de quién?` : `${m.titular} le aportó a MSA` }
  if ((r = x.match(/^RET\s*(\d+|I)?\s*(\w+)?$/))) {
    const n = r[1] ?? "", s = r[2] ?? ""
    if (!s) return { grupo: "Espejo de un retiro (ya contado en MSA)", socio: m.titular, que: `Entró de MSA a ${m.titular}: confirmar que es el espejo de un retiro ya marcado en MSA` }
    if (n === "3") return { grupo: "Gastos del socio pagados por MSA", socio: s, que: `Gasto de ${s} (impuesto, sueldo de su empleado, factura a su nombre) pagado por MSA: suma a su cuenta` }
    return { grupo: "Retiro del socio (transferencia)", socio: s, que: `Retiro de ${s}${n === "I" ? " — «RET i» tomado como «RET 1»" : ""}` }
  }
  const cta = x.match(/^(?:CTA|CUENTA) (.+)$/)?.[1] ?? x.match(/^(.+) CTA$/)?.[1]
  if (cta) {
    if (SOCIOS.includes(cta)) return { grupo: m.cred > m.deb ? "Cuenta del socio — entró plata (aporte o devolución)" : "Cuenta del socio — salió plata (retiro o gasto suyo)", socio: cta, que: `Cuenta corriente de ${cta}${x.endsWith(" CTA") ? ` · unificar como «CTA ${cta}»` : ""}` }
    return { grupo: "Cuenta de terceros", socio: cta, que: `Cuenta corriente con ${cta} (no es socio)` }
  }
  return { grupo: "Otra marca", socio: "?", que: "Decime qué es" }
}
function proponerInterno(m: Mov): Prop {
  const x = norm(m.interno)
  if (!x) return { grupo: "Sin marca — la base lo da a otro", socio: m.delOtro.match(/\b(MA|PAM|MSA)\b/)?.[1] ?? "?", que: `Falta la marca: ${m.delOtro}. ¿De quién es el gasto puertas adentro?` }
  let r: RegExpMatchArray | null
  if ((r = x.match(/^DIST (\w+)$/))) return { grupo: "Gasto de un socio (puertas adentro)", socio: r[1], que: `Lo carga ${r[1]}${r[1] === "MECHI" ? " (MECHI no es MA)" : ""}` }
  if (/^GASTO MSA$/.test(x)) return { grupo: "Gasto de MSA", socio: "MSA", que: "Lo carga MSA" }
  if (/^DESGLOS/.test(x)) return { grupo: "Desglosar (gasto compartido)", socio: "a repartir", que: "Repartir por lo que es de cada uno" }
  if (/^(X|VER)$/.test(x)) return { grupo: "Para revisar (X / VER)", socio: "?", que: "Decime qué es" }
  if ((r = x.match(/^RET\s*\d*\s*(\w+)$/))) return { grupo: "Retiro del socio", socio: r[1], que: `Retiro de ${r[1]}` }
  if (/^AP\s*\d+$/.test(x)) return { grupo: "Aporte del socio a MSA", socio: m.titular === "MSA" ? "?" : m.titular, que: "Aporte a MSA: ¿de quién?" }
  return { grupo: "Otra marca (actividad u otro)", socio: "?", que: `«${m.interno}»: decime qué es` }
}

// ── Las dos solapas de trabajo
const ENC = (otra: string) => ["Fecha", "Cuenta", "Empresa de la cuenta", "Descripción del banco", "Detalle", "Contraparte (leyendas)", "CATEG", "Template / factura / sueldo",
  "La base se lo da a", "Estado", `Marca ${otra === "Interno" ? "CONTABLE" : "INTERNO"}`, otra, "En tu planilla de origen", "Nota del movimiento", "Grupo propuesto", "Socio propuesto", "Qué propongo", "Tu respuesta"]
function solapa(col: "contable" | "interno") {
  const prop = col === "contable" ? proponerContable : proponerInterno
  const filas = todos.filter(m => m[col] || (!m.contable && !m.interno))      // los suyos + los sin marca que la base da a otro
  const items = filas.map(m => { const p = prop(m)
    return { categoria: p.grupo, mes: m.mes, importe: r2(m.deb - m.cred), moneda: (m.usd ? "USD" : "ARS") as "ARS" | "USD", orden: `${m.cuenta}|${m.fecha}`,
      columnas: [dmy(m.fecha), m.cuenta, m.titular, m.desc, m.detalle, m.contra, m.categ, m.tpl, m.delOtro, m.estado, (col === "contable" ? m.interno : m.contable) || "(vacío)",
        m[col] || "(vacío)", m.enPlanilla, m.nota.slice(0, 250), p.grupo, p.socio, p.que, ""] } })
  const nSin = filas.filter(m => !m[col]).length
  return { n: filas.length, nSin, filas: hojaResumenPorMes(items, {
    titulo: `${col.toUpperCase()} — mis propuestas para barrer por grupo (ejercicio 25/26: ${filas.length - nSin} con marca + ${nSin} sin marca que la base da a otro)`,
    notas: [col === "contable"
      ? "CONTABLE = de qué cuenta es el movimiento para el contador (cuenta del socio, Libertad, gasto de la empresa…). La propuesta de INTERNO está en la otra solapa."
      : "INTERNO = de quién es el gasto puertas adentro. La propuesta de CONTABLE está en la otra solapa.",
      "Cada renglón del resumen es un GRUPO PROPUESTO; filtrá el detalle por su Nro para barrerlo entero. Respondé en «Tu respuesta» sólo lo que no va como propongo.",
      "Débito = salió plata · crédito = entró. Pesos y dólares van en bloques separados. «La base se lo da a» = template, factura o sueldo de otra empresa."],
    meses, encabezadoDetalle: ENC(col === "contable" ? "Contable" : "Interno"), semestres: true, porMoneda: true, debeHaber: true }) }
}
const sC = solapa("contable"), sI = solapa("interno")

// ── Todas las marcas, con la forma propuesta para unificar
const claveGrupo = (m: string) => norm(m).split(" ").sort().join(" ")
type Marca = { donde: string; marca: string; n: number; deb: number; cred: number; cuentas: Set<string> }
const marcas = new Map<string, Marca>()
for (const f of marcados) for (const [donde, marca] of [["Contable", f.contable], ["Interno", f.interno]] as const) {
  if (!marca) continue
  const k = `${donde}\u0000${marca}`, x = marcas.get(k) ?? { donde, marca, n: 0, deb: 0, cred: 0, cuentas: new Set<string>() }
  x.n++; x.deb = r2(x.deb + f.deb); x.cred = r2(x.cred + f.cred); x.cuentas.add(f.cuenta); marcas.set(k, x)
}
const grupos = new Map<string, Marca[]>()
for (const m of marcas.values()) { const g = `${m.donde}|${claveGrupo(m.marca)}`; grupos.set(g, [...(grupos.get(g) ?? []), m]) }
const formaPropuesta = (m: Marca) => {
  const vs = grupos.get(`${m.donde}|${claveGrupo(m.marca)}`) ?? [m]
  const cta = norm(m.marca).match(/^(.+) CTA$/)?.[1] ?? norm(m.marca).match(/^CTA (.+)$/)?.[1]
  if (cta) return `CTA ${cta}`
  return vs.length > 1 ? [...vs].sort((a, b) => b.n - a.n)[0].marca : ""
}
const listaMarcas = [...marcas.values()].sort((a, b) => a.donde.localeCompare(b.donde) || claveGrupo(a.marca).localeCompare(claveGrupo(b.marca)) || a.marca.localeCompare(b.marca))
const todasLasMarcas: unknown[][] = [["TODAS LAS MARCAS — cada una tal como está escrita (ejercicio 25/26)"],
  ["Las que parecen la misma escrita distinto quedan juntas. «Forma propuesta» = cómo la unificaría (CTA + nombre, como CTA MA; si no, la forma más usada). No se cambió nada en la base."], [],
  ["Columna", "Marca (tal como está)", "Otras formas de escribirla", "Forma propuesta", "Movimientos", "Débitos", "Créditos", "Neto", "Cuentas", "Tu respuesta"],
  ...listaMarcas.map(m => { const otras = (grupos.get(`${m.donde}|${claveGrupo(m.marca)}`) ?? []).filter(x => x.marca !== m.marca).map(x => x.marca)
    const fp = formaPropuesta(m)
    return [m.donde, m.marca, otras.length ? `⚠️ ${otras.join(" · ")}` : "", fp && fp !== m.marca ? `→ ${fp}` : "", m.n, m.deb, m.cred, r2(m.deb - m.cred), [...m.cuentas].join(", "), ""] })]

// ── CONTROL 100%
const listadas = new Set(TABLAS_CON_VINCULO_ARCA.map(t => `${t.schema}.${t.tabla}`))
const faltanEnLista = TABLAS_CON_MARCAS_EN_LA_BASE.filter(t => !listadas.has(t)), sobranEnLista = [...listadas].filter(t => !TABLAS_CON_MARCAS_EN_LA_BASE.includes(t))
const okTabla = (f: FilaTabla) => !f.error && f.directoTotal === f.leidos && f.directoMarca === f.leidosNoNulo
const c1ok = control1.every(okTabla) && !faltanEnLista.length
const pMal = planillas.filter(p => p.estado.startsWith(MAL)), pOjo = planillas.filter(p => p.estado.startsWith(OJO))
const totMarcadosBase = control1.reduce((t, f) => t + f.marcados, 0)
const enExcelC = sC.n - sC.nSin, enExcelI = sI.n - sI.nSin
const enAlgunaSolapa = new Set(todos.filter(m => m.contable || m.interno).map(m => m.id + m.tabla)).size
const c1b = enAlgunaSolapa === totMarcadosBase && marcados.filter(m => m.contable).length === enExcelC && marcados.filter(m => m.interno).length === enExcelI
const meses12 = (xs: number[]) => xs
const ctrl: unknown[][] = [
  ["CONTROL DEL 100% — que no se quede afuera ningún movimiento con marca (ejercicio 25/26)"],
  ["Tres caminos independientes. Si los tres dan ✅, están todos. Si alguno da 🔴 o 🟡, abajo está la lista de cuáles."], [],
  ["Camino", "Qué compara", "Resultado", "Estado"],
  ["1 · La base", `Las ${TABLAS_CON_MARCAS_EN_LA_BASE.length} tablas de la base con contable/interno: conteo directo de la base vs. lo leído, tabla por tabla`,
    `${control1.filter(okTabla).length} de ${control1.length} tablas cierran · ${faltanEnLista.length} tablas de la base fuera de la lista`, c1ok ? OK : MAL],
  ["1 · La base → este Excel", "Movimientos con marca en la base vs. movimientos en las solapas Contable e Interno",
    `base ${totMarcadosBase} con marca · Contable ${enExcelC} (= ${marcados.filter(m => m.contable).length} con contable) · Interno ${enExcelI} (= ${marcados.filter(m => m.interno).length} con interno)`, c1b ? OK : MAL],
  ["2 · Tu planilla de origen", "Cada renglón con contable o interno de «Extracto MSA» y «Extracto PAM» (jul-25 → ene-26) buscado en la base por cuenta, fecha e importe",
    `${planillas.length} renglones: ${planillas.length - pMal.length - pOjo.length} iguales · ${pOjo.length} con otra marca en la base · ${pMal.length} no están en la base`,
    pMal.length ? MAL : pOjo.length ? OJO : OK],
  ["2 · al revés", "Marcados en la base en esas cuentas y meses que no salen de tu planilla (los marcaste después, en la app)", `${soloEnBase.length} movimientos (se listan abajo; no es error)`, soloEnBase.length ? OJO : OK],
  ["3 · Sin marca", "Movimientos sin marca que la base le da a otra empresa (template, factura o sueldo de otro)", `${sinMarca.length} movimientos — están en las dos solapas, grupo «Sin marca»`, sinMarca.length ? OJO : OK],
  [], ["CAMINO 1 — tabla por tabla"],
  ["Cuenta", "Tabla", "Empresa", "Moneda", "Movimientos del ejercicio (conteo directo)", "Leídos", "Con algo en contable/interno (conteo directo)", "Leídos con algo", "…de ésos, sólo espacios", "Con marca (en este Excel)", "Estado", "Error"],
  ...control1.map(f => [f.cuenta, f.tabla, f.titular, f.usd ? "USD" : "ARS", f.directoTotal, f.leidos, f.directoMarca, f.leidosNoNulo, f.enBlanco || "", f.marcados, okTabla(f) ? OK : MAL, f.error]),
  ["TOTAL", "", "", "", control1.reduce((t, f) => t + (f.directoTotal ?? 0), 0), control1.reduce((t, f) => t + f.leidos, 0), control1.reduce((t, f) => t + (f.directoMarca ?? 0), 0),
    control1.reduce((t, f) => t + f.leidosNoNulo, 0), control1.reduce((t, f) => t + f.enBlanco, 0), totMarcadosBase],
  ...(faltanEnLista.length ? [[`${MAL} Tablas de la base con contable/interno que NO se leyeron:`, faltanEnLista.join(", ")]] : [[`${OK} Las ${TABLAS_CON_MARCAS_EN_LA_BASE.length} tablas de la base con contable/interno se leyeron todas.`]]),
  ...(sobranEnLista.length ? [[`Además se leyeron (no tienen contable/interno en el listado del 06/11):`, sobranEnLista.join(", ")]] : []),
  [], ["CAMINO 1 — cuenta × mes: movimientos con marca / movimientos totales"],
  ["Cuenta", ...ROT, "Total con marca", "Total movimientos"],
  ...[...porCuentaMes].map(([c, x]) => [c, ...meses12(x.marca.map((v, j) => `${v} / ${x.tot[j]}`)), x.marca.reduce((a, b) => a + b, 0), x.tot.reduce((a, b) => a + b, 0)]),
  [], ["CAMINO 2 — tu planilla: renglones del ejercicio por mes (todos, con o sin marca) vs. la base"],
  ["Planilla", ...ROT.slice(0, 7), "Total planilla", "Total base", "Estado"],
  ...[...totPlanillaMes].map(([n, xs]) => { const tabla = n.includes("PAM CA") ? "Galicia PAM CA" : n.includes("PAM CC") ? "Galicia PAM CC" : "Galicia MSA CC"
    const base = porCuentaMes.get(tabla)?.tot.slice(0, 7) ?? []
    const tp = xs.slice(0, 7).reduce((a, b) => a + b, 0), tb = base.reduce((a, b) => a + b, 0)
    return [n, ...xs.slice(0, 7).map((v, j) => v === base[j] ? v : `${v} (base ${base[j]})`), tp, tb, tp === tb ? OK : OJO] }),
  ["(🟡 en un mes = la base tiene distinta cantidad de movimientos que tu planilla: se ve en «Tu planilla vs base».)"],
  [], [`CAMINO 2 — renglones de tu planilla que NO están igual en la base (${pMal.length + pOjo.length})`],
  ["Planilla", "Fecha", "Descripción", "Débito", "Crédito", "Contable (planilla)", "Interno (planilla)", "Contable (base)", "Interno (base)", "Estado"],
  ...[...pMal, ...pOjo].map(p => [p.planilla, dmy(p.fecha), p.desc, p.deb, p.cred, p.contable, p.interno, p.baseC ?? "", p.baseI ?? "", p.estado]),
  [], [`CAMINO 2 al revés — marcados en la base (esas cuentas, jul-25 → ene-26) que no salen de tu planilla (${soloEnBase.length})`],
  ["Cuenta", "Fecha", "Descripción", "Débito", "Crédito", "Contable", "Interno", "Nota"],
  ...soloEnBase.map(m => [m.cuenta, dmy(m.fecha), m.desc, m.deb, m.cred, m.contable, m.interno, m.nota.slice(0, 150)]),
  [], [`CAMINO 3 — sin marca, la base se lo da a otro (${sinMarca.length}) — por qué`],
  ["La base se lo da a", "Cuenta", "Movimientos", "Neto"],
  ...[...sinMarca.reduce((acc, m) => { const k = `${m.delOtro}\u0000${m.cuenta}`; const x = acc.get(k) ?? { n: 0, imp: 0 }; x.n++; x.imp = r2(x.imp + m.deb - m.cred); acc.set(k, x); return acc }, new Map<string, { n: number; imp: number }>())]
    .sort((a, b) => b[1].n - a[1].n).map(([k, x]) => { const [a, c] = k.split("\u0000"); return [a, c, x.n, x.imp] }),
]
const vsPlanilla: unknown[][] = [["TU PLANILLA vs. LA BASE — cada renglón con contable o interno de tus planillas de origen (jul-25 → ene-26)"],
  ["Se busca en la base por cuenta, fecha, débito y crédito. Si hay dos iguales el mismo día, se toma primero el que tiene la misma marca."], [],
  ["Planilla", "Fecha", "Descripción", "Débito", "Crédito", "Contable (planilla)", "Interno (planilla)", "Contable (base)", "Interno (base)", "Estado", "Id en la base"],
  ...planillas.map(p => [p.planilla, p.fecha ? dmy(p.fecha) : "", p.desc, p.deb, p.cred, p.contable, p.interno, p.baseC ?? "", p.baseI ?? "", p.estado, p.baseId ?? ""])]

if (!existsSync(CARPETA)) mkdirSync(CARPETA, { recursive: true })
const nombre = (b: string) => { let p = join(CARPETA, `${b}.xlsx`), v = 2; while (existsSync(p)) p = join(CARPETA, `${b} v${v++}.xlsx`); return p }
const wb = XLSX.utils.book_new()
agregarHoja(wb, "Control 100%", ctrl); agregarHoja(wb, "Contable", sC.filas); agregarHoja(wb, "Interno", sI.filas)
agregarHoja(wb, "Tu planilla vs base", vsPlanilla); agregarHoja(wb, "Todas las marcas", todasLasMarcas)
fechasReales(wb as any)
const p = nombre(`Marcas contable e interno - trabajo 25-26 (${HOY})`); XLSX.writeFile(wb, p)

console.log(`CAMINO 1: ${control1.filter(okTabla).length}/${control1.length} tablas cierran ${c1ok ? OK : MAL} · fuera de lista: ${faltanEnLista.join(", ") || "ninguna"} · base con marca ${totMarcadosBase} · Excel contable ${enExcelC} interno ${enExcelI} ${c1b ? OK : MAL}`)
for (const f of control1.filter(f => !okTabla(f))) console.log(`  ${MAL} ${f.cuenta}: directo ${f.directoTotal}/${f.directoMarca} leído ${f.leidos}/${f.leidosNoNulo} ${f.error}`)
console.log(`CAMINO 2: ${planillas.length} renglones · ${pOjo.length} distinta marca · ${pMal.length} no están · al revés ${soloEnBase.length}`)
for (const [n, xs] of totPlanillaMes) console.log(`  ${n}: ${xs.slice(0, 7).join(" ")}`)
console.log(`CAMINO 3: ${sinMarca.length} sin marca que la base da a otro`)
const cuenta = (xs: Mov[], f: (m: Mov) => Prop) => { const g = new Map<string, number>(); for (const m of xs) { const k = f(m).grupo; g.set(k, (g.get(k) ?? 0) + 1) } return [...g].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ") }
console.log("GRUPOS contable:", cuenta(todos.filter(m => m.contable || (!m.contable && !m.interno)), proponerContable))
console.log("GRUPOS interno:", cuenta(todos.filter(m => m.interno || (!m.contable && !m.interno)), proponerInterno))
console.log(`📄 ${p}`)
