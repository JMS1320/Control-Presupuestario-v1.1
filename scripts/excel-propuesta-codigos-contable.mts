/**
 * 🏷️ PROPUESTA CONCRETA de códigos CONTABLE — ejercicio 25/26. SÓLO LEE la base (y el Excel con las respuestas de JMS). A-FEAT-1577.
 *
 *     npx tsx scripts/excel-propuesta-codigos-contable.mts
 *
 * El esquema que aprobó JMS el 06/11 (puntos 1 a 4; el 5 «sí, pero cheq de que esté en las 2 puntas»; el 6 —interno— después):
 *  1 · Un solo código por contraparte: «CTA + quién» (CTA MA, CTA PAM, CTA JMS, CTA AMS, CTA MSA, CTA COTITULARES). Quién retira de quién
 *      = el código + la empresa de la cuenta del movimiento. Retiro o aporte = el signo. El MOTIVO sale del template / factura / sueldo.
 *  2 · La distribución no se marca movimiento por movimiento: es un registro al cierre. Sólo «DIST» un pago que ya es distribución decidida.
 *  3 · El sistema pone solo lo que ya sabe (template, sueldo o factura de otra empresa; transferencia al CUIT de alguien del grupo).
 *  4 · Dejan de ser código: «Asiento contable», «Desglosar» (pendiente de la tarjeta), «X» (falta la factura), terceros. LIB se queda.
 *  5 · Los espejos (la misma plata en las dos cuentas) se cuentan UNA vez, y se controla que esté en las DOS puntas.
 *
 * Solapas: «Control» (el 100% + las dos puntas) · «Propuesta» (por LOTE y por mes; cada movimiento con su código nuevo, de dónde sale y
 * tu respuesta anterior) · «Cuentas» (lo que da el esquema: quién retiró / aportó de quién, mes por mes, cada movimiento una sola vez).
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
const RESPUESTAS = join(CARPETA, "Marcas contable e interno - trabajo 25-26 (2026-11-06) v3.xlsx")
const r2 = (x: number) => Math.round(x * 100) / 100
const dmy = (f: string) => f.split("-").reverse().join("/")
const sv = (v: unknown) => (v == null ? "" : String(v).trim())
const norm = (x: string) => x.toUpperCase().replace(/\s+/g, " ").trim()
const OK = "✅", MAL = "🔴", OJO = "🟡"

async function todo(q: (d: number, h: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break }
  return out
}
const desde = (schema: string, tabla: string) => (schema === "public" ? sb.from(tabla) : sb.schema(schema).from(tabla))

// ── Quién es quién. El orden manda en una pareja: la EMPRESA es la de más arriba, el otro es el SOCIO de esa cuenta.
const ORDEN = ["MSA", "PAM", "MA", "COTITULARES", "JMS", "AMS", "MANU", "MECHI", "SOLE"]
const rango = (x: string) => { const i = ORDEN.indexOf(x); return i < 0 ? 99 : i }
const CUIT: Record<string, string> = { "30617786016": "MSA", "20044390222": "PAM", "27066824611": "MA", "20287492546": "AMS", "23342147739": "JMS" }
const CON_CUENTAS_EN_LA_APP = new Set(["MSA", "PAM", "MA", "COTITULARES"])   // las que tienen cuentas cargadas: ahí se busca la otra punta

// ── Vínculos de la base
const cuotas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura").select("id, egreso_id, grupo_pago_id").order("id").range(d, h))
const egresos = new Map((await todo((d, h) => sb.from("egresos_sin_factura").select("id, nombre_referencia, responsable").order("id").range(d, h))).map((e: any) => [e.id, e]))
const tplDe = new Map<string, { nombre: string; resp: string }>()
for (const c of cuotas) {
  const e: any = egresos.get(c.egreso_id); if (!e) continue
  const x = { nombre: sv(e.nombre_referencia), resp: sv(e.responsable).toUpperCase() }
  tplDe.set(c.id, x)
  if (c.grupo_pago_id && !tplDe.has(c.grupo_pago_id)) tplDe.set(c.grupo_pago_id, x)
}
const empleados = new Map((await todo((d, h) => sb.from("sueldos_empleados").select("id, nombre, empresa").order("id").range(d, h))).map((e: any) => [e.id, e]))
const sueldoDe = new Map<string, any>()
for (const p of await todo((d, h) => sb.from("sueldos_pagos").select("id, grupo_pago_id, empleado_id").order("id").range(d, h))) {
  const e = empleados.get(p.empleado_id); if (!e) continue
  sueldoDe.set(p.id, e); if (p.grupo_pago_id && !sueldoDe.has(p.grupo_pago_id)) sueldoDe.set(p.grupo_pago_id, e)
}
const fcDe = new Map<string, { emp: string; quien: string }>()
for (const s of ["msa", "pam", "ma"]) for (const f of await todo((d, h) => sb.schema(s).from("comprobantes_arca").select("id, denominacion_emisor").order("id").range(d, h)))
  fcDe.set(f.id, { emp: s.toUpperCase(), quien: sv(f.denominacion_emisor) })

// ── Las respuestas de JMS en el Excel anterior (solapa «Contable»), por cuenta + fecha + débito + crédito + descripción
const respuestas = new Map<string, string[]>()
let respuestasLeidas = 0
if (existsSync(RESPUESTAS)) {
  const ws = XLSX.readFile(RESPUESTAS, { cellDates: true }).Sheets["Contable"]
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })
  const h = aoa.findIndex(r => r?.[0] === "Nro" && r.includes("Débito"))
  const H = new Map(aoa[h].map((v: any, j: number) => [sv(v), j]))
  for (const r of aoa.slice(h + 1)) {
    if (typeof r?.[0] !== "number") continue
    const f = r[H.get("Fecha")!]; const fecha = f instanceof Date ? `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}` : sv(f)
    const k = [sv(r[H.get("Cuenta")!]), fecha, r2(Number(r[H.get("Débito")!]) || 0), r2(Number(r[H.get("Crédito")!]) || 0), sv(r[H.get("Descripción del banco")!])].join("|")
    respuestas.set(k, [...(respuestas.get(k) ?? []), sv(r[H.get("Tu respuesta")!])]); respuestasLeidas++
  }
}

// ── Los movimientos: con marca contable, o que la base da a otro, o transferencia con el CUIT de alguien del grupo
type Mov = { id: string; tabla: string; fecha: string; mes: string; cuenta: string; titular: string; usd: boolean; desc: string; detalle: string; contra: string
  deb: number; cred: number; categ: string; vinculo: string; respDe: string; cuitDe: string; viejo: string; interno: string; resp: string; porque: string[]
  codigo: string; empresa: string; socio: string; tipo: string; lote: string; duda: string; punta: string; cuenta_aca: boolean; motivo: string; okV2?: string }
const movs: Mov[] = []
const ctrlTabla: { cuenta: string; directoContable: number | null; leidosContable: number; enPropuesta: number; ok: boolean }[] = []
const todosPorTitular = new Map<string, any[]>()      // todos los movimientos de cada empresa, para buscar la otra punta
let interbancariaCandidatos = 0
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const titular = sv(t.titular).toUpperCase(), usd = !!(t as any).enDolares
  const c = await desde(t.schema, t.tabla).select("*", { count: "exact", head: true }).gte("fecha", DESDE).lte("fecha", HASTA).not("contable", "is", null).neq("contable", "")
  const filas = await todo((d, h) => desde(t.schema, t.tabla).select("*").gte("fecha", DESDE).lte("fecha", HASTA).order("id").range(d, h))
  const ct = { cuenta: t.cuenta, directoContable: c.count ?? null, leidosContable: 0, enPropuesta: 0, ok: false }; ctrlTabla.push(ct)
  for (const m of filas) {
    const viejo = sv(m.contable)
    if (viejo) ct.leidosContable++
    const fecha = String(m.fecha).slice(0, 10), deb = r2(Number(m.debitos) || 0), cred = r2(Number(m.creditos) || 0)
    const txt = Object.values(m).filter(v => typeof v === "string").join(" ")
    const cuitDe = Object.keys(CUIT).find(k => txt.includes(k)) ? CUIT[Object.keys(CUIT).find(k => txt.includes(k))!] : ""
    const base = { tabla: `${t.schema}.${t.tabla}`, cuenta: t.cuenta, titular, fecha, deb, cred, usd, id: String(m.id), cuitDe, viejo }
    todosPorTitular.set(titular, [...(todosPorTitular.get(titular) ?? []), base])
    const tpl = m.template_cuota_id ? tplDe.get(m.template_cuota_id) : undefined
    const emp = m.sueldo_pago_id ? sueldoDe.get(m.sueldo_pago_id) : undefined
    const fc = m.comprobante_arca_id ? fcDe.get(m.comprobante_arca_id) : undefined
    const ajeno = (x: string) => !!x && !x.toUpperCase().split("/").map(s => s.trim()).includes(titular)
    const respDe = tpl && ajeno(tpl.resp) ? tpl.resp.split("/")[0] : emp && ajeno(sv(emp.empresa)) ? sv(emp.empresa).toUpperCase().split("/")[0] : fc && ajeno(fc.emp) ? fc.emp : ""
    const cuitOtro = cuitDe && cuitDe !== titular ? cuitDe : cuitDe === titular && !viejo ? "" : cuitDe
    if (!viejo && !respDe && !cuitOtro) continue
    if (cuitDe === titular) interbancariaCandidatos++
    const k = [t.cuenta, fecha, deb, cred, sv(m.descripcion).slice(0, 80)].join("|")
    const rs = respuestas.get(k); const resp = rs?.shift() ?? ""
    movs.push({ ...base, mes: fecha.slice(0, 7), desc: sv(m.descripcion).slice(0, 80), detalle: sv(m.detalle), contra: sv(m.leyendas_adicionales_1 ?? m.proveedor_nombre),
      categ: sv(m.categ), vinculo: tpl ? `${tpl.nombre} (${tpl.resp})` : emp ? `Sueldo de ${emp.nombre} (${emp.empresa})` : fc ? `Factura de ${fc.quien} (${fc.emp})` : "",
      respDe, interno: sv(m.interno), resp, porque: [], codigo: "", empresa: "", socio: "", tipo: "", lote: "", duda: "", punta: "", cuenta_aca: true, motivo: "" })
    if (viejo) ct.enPropuesta++
  }
  ct.ok = ct.directoContable === ct.leidosContable && ct.leidosContable === ct.enPropuesta
}

// ── LA PROPUESTA, movimiento por movimiento
function pareja(m: Mov, otro: string) {
  const [e, s] = rango(m.titular) <= rango(otro) ? [m.titular, otro] : [otro, m.titular]
  m.empresa = e; m.socio = s
}
for (const m of movs) {
  const v = norm(m.viejo), R = m.resp.toLowerCase(), T = m.titular
  const cod = (otro: string, tipo: string, porque: string) => { m.codigo = `CTA ${otro}`; pareja(m, otro); m.tipo = tipo; m.porque.push(porque) }
  const noLleva = (por: string, porque: string) => { m.codigo = "— (no lleva)"; m.lote = `— No lleva código · ${por}`; m.porque.push(porque) }
  const aDecidir = (que: string) => { m.lote = `? A decidir · ${que}`; m.duda = m.resp }
  const mismaEmpresa = m.cuitDe === T && !m.respDe
  // Cotitulares: el CUIT de MA aparece en sus compra-venta de dólares y «cuentas propias» (MA es cotitular) — no es una transferencia a MA
  const cotitPropia = T === "COTITULARES" && !v && /propia|compra venta de dolares/i.test(m.desc)
  // 1 · lo que deja de ser código
  if (/^ASIENTO CONTABLE/.test(v)) noLleva("gastos e impuestos del banco", "la categoría ya dice que es gasto bancario (tu respuesta: «para acordarse de que se debían informar»)")
  else if (/^DESGLOS/.test(v)) { m.codigo = "— (pendiente de la tarjeta)"; m.lote = "— Tarjeta · se reparte con su resumen"; m.porque.push("el pago de la tarjeta se reparte por sus consumos, cada uno con su template") }
  else if (/^(X)$/.test(v)) { m.codigo = "— (falta la factura)"; m.lote = "— Falta la factura"; m.porque.push("tu respuesta: «pendiente que manden la factura» → es un estado, no un código") }
  else if (/^LIB/.test(v)) { m.codigo = "LIB"; m.lote = "Libertad (50/50, va aparte)"; m.porque.push("Libertad tiene su reparto propio") }
  else if (/^CTA (AFA|FED PAT|CENTRO ARECO SADA|ESPOSITO|TRABUCCO)$/.test(v)) noLleva("terceros (el proveedor ya lo identifica)", "es un tercero, no alguien del grupo")
  else if (cotitPropia) { m.codigo = "?"; m.lote = "? A decidir · Cotitulares: compra-venta de dólares y «cuentas propias» con el CUIT de MA"; m.porque.push("MA es cotitular: ¿es movimiento entre sus propias cuentas o algo de MA?") }
  else if (mismaEmpresa || /interbancaria/.test(R)) { noLleva("entre cuentas de la misma empresa", "la transferencia va a otra cuenta de la misma empresa (su propio CUIT)") }
  else if (/factur.* a msa|facturado a msa/.test(R)) noLleva("facturado a la empresa de la cuenta", "tu respuesta: se facturó a MSA, es gasto de MSA")
  else if (/consumos y listo/.test(R) && !/wilson/.test(R)) noLleva("consumos de MA con template de PAM", "tu respuesta: es la cuenta de MA, son sus consumos")
  else if (T === "MA" && !v && m.respDe === "PAM" && !/wilson/.test(R)) noLleva("consumos de MA con template de PAM", "como tu respuesta para la caja de ahorro de MA: son sus consumos (el template todavía dice PAM)")
  else {
    // 2 · DIST: sólo lo que ya es distribución decidida (PAM a los herederos)
    const dist = v.match(/^DIST (\w+)$/)
    if (dist) { m.codigo = `DIST ${dist[1]}`; pareja(m, dist[1]); m.tipo = "distribución"; m.porque.push("tu respuesta: «estos son distribuciones» (decidida al pagar)") }
    // 3 · «CTA + quién»: de la marca vieja, de la base o del CUIT
    else {
      const socioMarca = (v.match(/^(?:CTA|CUENTA|CALCULO|CÁLCULO) (\w+)$/) ?? v.match(/^(\w+) CTA$/) ?? v.match(/^RET\s*(?:\d+|I)?\s*(MA|PAM)$/) ?? v.match(/^AP\s*\d*\s*(MSA)$/))?.[1]
      const espejoMSA = /^(\w+ )?RET\s*\d*\s*MSA$/.test(v) || v === "RET 1" ? "MSA" : ""
      const ap1 = /^AP\s*\d+$/.test(v) ? (T === "MSA" ? "PAM" : "MSA") : ""        // AP 1: tu respuesta «PAM aporta a MSA»
      let otro = espejoMSA || ap1 || socioMarca || m.respDe || (m.cuitDe !== T ? m.cuitDe : "")
      // en la cuenta del socio, la marca nombra al socio mismo («CTA MA» en la CA de MA): la contraparte es quien le pagó
      if (otro === T) otro = /desde pam/.test(R) ? "PAM" : m.cuitDe && m.cuitDe !== T ? m.cuitDe : "MSA"
      // QUÉ ES: sueldo (cálculo) · transferencia (la plata va / viene del otro: su CUIT, un template de retiro/aporte, o la marca de
      // transferencia) · gasto del otro pagado por la empresa de la cuenta (template/sueldo/factura del otro, RET 3/i, AP 3, tu «RET 3»)
      // ⚠️ el CUIT del socio NO alcanza: un pago a AFIP de sus impuestos lleva su CUIT y es un gasto suyo, no una transferencia
      // En orden: (1) tu marca o tu respuesta dicen gasto (RET 3 / RET i / AP 3) · (2) template de retiro/aporte → transferencia ·
      // (3) template/sueldo/factura DEL OTRO → gasto suyo · (4) va al CUIT del otro → transferencia (sus honorarios: se le paga a él) ·
      // (4b) RET 1 / RET PAM / AP 1 → transferencia · (5) otro vínculo → gasto · (6) sin nada → transferencia
      const esGasto = /^(AP|RET)\s*(3|I)\b/.test(v) || /ret 3|ret i/.test(R) ? true
        : /retiro|aporte|distrib/i.test(m.vinculo) ? false
        : m.respDe === otro ? true
        : m.cuitDe === otro ? false
        : /^(\w+ )?RET\s*1?\s*(MA|PAM|MSA)?$|^AP\s*1$/.test(v) ? false
        : !!m.vinculo
      const esTransf = !esGasto
      const tipoDe = () => /^(CALCULO|CÁLCULO)/.test(v) ? "sueldo (cálculo)" : esTransf ? "transferencias" : `gastos de ${otro} pagados por ${T}`
      if (otro) {
        const tipo = tipoDe()
        cod(otro, tipo, v ? `marca anterior «${m.viejo}»` : m.respDe ? `la base: ${m.vinculo}` : `transferencia al CUIT de ${otro}`)
        if (!v && m.respDe) m.porque.push("antes no tenía marca: el sistema lo sabe por el template/sueldo/factura")
      } else { m.codigo = "?"; m.porque.push(`marca anterior «${m.viejo}»`) }
    }
    if (m.empresa && !m.lote) m.lote = `${m.empresa} ↔ ${m.socio} · ${m.tipo}`
  }
  // las dudas que dejaste: quedan en «A decidir», con el código propuesto igual
  if (/depende|podr[ií]a ir a dist|dist ma - ret 3\?|wilson|ir[ií]a caja/.test(R) || norm(m.viejo) === "VER") aDecidir(/wilson/.test(R) ? "algo raro (¿error?)" : /caja|cotit/.test(R) ? "efectivo: ¿se marca en la caja?" : "elegir el código")
  if (/\?/.test(m.resp) && !m.lote.startsWith("?")) m.duda = m.resp
  m.motivo = m.vinculo || m.categ || m.detalle || m.desc
}

// ══ CONSENSO con JMS (07/11) sobre la «Propuesta … v2»: sus respuestas por movimiento (columna Id) + las reglas acordadas ══
const V2 = join(CARPETA, "Propuesta codigos contable 25-26 (2026-11-06) v2.xlsx")
const okV2 = new Map<string, string>()
if (existsSync(V2)) {
  const aoa: any[][] = XLSX.utils.sheet_to_json(XLSX.readFile(V2).Sheets["Propuesta"], { header: 1, raw: true, defval: null })
  const h = aoa.findIndex(r => r?.[0] === "Nro" && r.includes("Débito")); const H = new Map(aoa[h].map((v: any, j: number) => [sv(v), j]))
  for (const r of aoa.slice(h + 1)) if (typeof r?.[0] === "number") okV2.set(sv(r[H.get("Id")!]), sv(r[H.get("Tu OK / corrección")!]))
}
let aplicadasV2 = 0
for (const m of movs) {
  const a = okV2.get(`${m.tabla}:${m.id}`) ?? ""; m.okV2 = a; if (a) aplicadasV2++
  const A = a.toLowerCase(), antes = m.codigo
  const vacio = (por: string) => { m.codigo = "(vacío)"; m.lote = `(vacío) · ${por}`; m.tipo = ""; m.empresa = ""; m.socio = "" }
  const poner = (codigo: string, otro: string, tipo: string) => { m.codigo = codigo; pareja(m, otro); m.tipo = tipo; m.lote = `${m.empresa} ↔ ${m.socio} · ${tipo}` }
  if (/estas de x quedar con x|seguir[ií]a dejando x/.test(A)) { m.codigo = "X"; m.lote = "X · falta la factura (queda X)" }
  else if (/ir a cta jms|puede ir cta jms/.test(A)) poner("CTA JMS", "JMS", "gastos de JMS pagados por " + m.titular)
  else if (/le pondr[ií]a algo para revisar/.test(A)) poner("CTA COTITULARES", "COTITULARES", "transferencias")            // C8: «ponele cta cotit»
  else if (/posada|revisar templtae aparte/.test(A)) m.titular === "PAM" ? vacio("Posadas pagado por PAM (template propio, fuera de Libertad)") : poner("CTA PAM", "PAM", "gastos de PAM pagados por MSA (Posadas, template propio)")
  else if (/dejalo como flia|flia pero/.test(A)) { m.codigo = "FLIA"; m.lote = "FLIA · entre personas de la familia (no suma en cuentas de empresa)"; m.empresa = ""; m.socio = "" }
  else if (/dist ma pero es de pam/.test(A)) poner("DIST PAM", "PAM", "distribución")
  else if (/dist ma tal vez/.test(A)) poner("DIST MA", "MA", "distribución (pagos de PAM por cuenta de MA)")
  else if (/directa a cta ma/.test(A)) { poner("CTA MA", "MA", "gastos de MA pagados por MSA"); m.porque.push("🔗 vincular a la factura de Penino a MA del 23/04 ($ 1.000.000); NO pasa por caja") }
  else if (/^no llevar[ií]a nada en contable\. pero/.test(A)) vacio("sueldo doméstico (va al template de PAM o MA, no a Libertad)")
  else if (/ya no estar[ií]a en lib/.test(A)) vacio("ACA: gasto propio de PAM / MA (si lo pagara otro, sería retiro)")
  else if (/^(no llevar[ií]a nada|nada|no llevar[ií]a nada)$|poner guion o dejar vac|pensaba que el guion/i.test(A)) vacio(m.lote.replace(/^— (No lleva código · )?/, "") || "no lleva")
  else if (m.lote.startsWith("? A decidir · algo raro")) { poner("CTA MSA", "MSA", "gastos de MSA pagados por MA"); m.porque.push("la base lo vincula a un pago de sueldo de Wilson Barreto (MSA); si el vínculo es un error, se corrige el vínculo") }
  else if (m.lote.startsWith("? A decidir · elegir") && /^cta pam$/i.test(a)) poner("CTA PAM", "PAM", m.tipo || "gastos de PAM pagados por MSA")
  // los guiones que quedaron: también vacío
  if (m.codigo.startsWith("—")) vacio(m.lote.replace(/^— (No lleva código · )?/, ""))
  // PAM → MA: todo es DIST MA (JMS 07/11, punto 1) — también lo que PAM pagó por cuenta de MA
  if (m.titular === "PAM" && m.codigo === "CTA MA") poner("DIST MA", "MA", "distribución (pagos de PAM por cuenta de MA)")
  if (antes !== m.codigo) m.porque.push(`acordado 07/11 (antes «${antes}»)${a ? `: «${a.slice(0, 80)}»` : ""}`)
  if (!m.lote.startsWith("?")) m.duda = ""
}

// ── 5 · LAS DOS PUNTAS: una transferencia entre dos empresas que tienen cuentas en la app tiene que estar en las dos
const usados = new Set<string>()
for (const m of movs) {
  if (!m.codigo.startsWith("CTA") && !m.codigo.startsWith("DIST") || m.lote.startsWith("?")) continue
  const otro = m.empresa === m.titular ? m.socio : m.empresa
  if (m.tipo !== "transferencias" && m.tipo !== "distribución") { m.punta = "no tiene otra punta (pagó a un tercero)"; continue }
  if (!CON_CUENTAS_EN_LA_APP.has(otro)) { m.punta = `la otra punta (${otro}) no tiene cuentas en la app`; continue }
  const imp = m.deb || m.cred
  const dias = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000)
  const cands = (todosPorTitular.get(otro) ?? []).filter((x: any) => !usados.has(x.id) && x.usd === m.usd && dias(x.fecha, m.fecha) <= 3
    && (m.deb ? x.cred === imp && !x.deb : x.deb === imp && !x.cred))
  const x = cands.sort((a: any, b: any) => dias(a.fecha, m.fecha) - dias(b.fecha, m.fecha))[0]
  if (!x) { m.punta = `${MAL} ALERTA: falta la otra punta en ${otro}`; continue }   // JMS 07/11: «las que no tienen contrapartida y deberían, deben marcar alerta»
  usados.add(x.id)
  const enProp = movs.find(y => y.id === x.id && y.tabla !== m.tabla)
  m.punta = `${OK} ${x.cuenta} ${dmy(x.fecha)}${enProp ? ` («${enProp.codigo}»)` : " — 🟡 ahí NO tiene código"}`
  // la misma plata lleva el MISMO tipo en las dos puntas: si una es distribución, la otra también (PAM → MA: «DIST MA» en las dos)
  if (enProp) for (const [a, b] of [[m, enProp], [enProp, m]] as const) if (a.codigo.startsWith("DIST") && b.codigo.startsWith("CTA")) {
    b.codigo = `DIST ${b.titular === b.empresa ? b.socio : b.empresa}`; b.tipo = "distribución";   // el código nombra al otro: en la cuenta de MA, «DIST PAM" b.lote = `${b.empresa} ↔ ${b.socio} · distribución`; b.porque.push(`la otra punta es «${a.codigo}»: misma plata, mismo código`)
  }
  // se cuenta UNA vez: del lado de la empresa (la de más arriba); la otra punta queda como espejo
  if (enProp) { const yo = rango(m.titular) <= rango(enProp.titular); m.cuenta_aca = yo; enProp.cuenta_aca = !yo; if (!yo) m.punta += " · espejo: se cuenta en la otra punta" }
}
for (const m of movs) if (m.punta.includes("espejo") === false && movs.some(y => y !== m && y.punta.includes(`${m.cuenta} ${dmy(m.fecha)}`) && !y.cuenta_aca) && m.cuenta_aca) m.punta += " · se cuenta acá"

// ── CONTROLES
const sinCodigo = movs.filter(m => m.codigo === "?" && !m.lote.startsWith("?"))
const faltaPunta = movs.filter(m => m.punta.startsWith(MAL)), puntaSinCodigo = movs.filter(m => m.punta.includes("NO tiene código"))
const conViejo = movs.filter(m => m.viejo).length
const respSinUsar = [...respuestas.values()].reduce((t, xs) => t + xs.length, 0)
const nuevos = movs.filter(m => !m.viejo)
const ctrl: unknown[][] = [
  ["CONTROL — que estén todos, y que cada transferencia esté en las DOS puntas (ejercicio 25/26)"], [],
  ["Control", "Qué compara", "Resultado", "Estado"],
  ["El 100% de lo marcado", "Movimientos con algo en contable: conteo directo de la base vs. los que están en la propuesta, cuenta por cuenta",
    `${ctrlTabla.filter(c => c.ok).length} de ${ctrlTabla.length} cuentas cierran · ${conViejo} movimientos con marca, todos en la propuesta`, ctrlTabla.every(c => c.ok) ? OK : MAL],
  ["Lo que el sistema suma solo", "Sin marca, pero la base lo da a otra empresa (template, sueldo, factura) o es una transferencia al CUIT de alguien del grupo",
    `${nuevos.length} movimientos nuevos (lote según lo que son)`, nuevos.length ? OJO : OK],
  ["Tus respuestas", "Renglones de la solapa «Contable» del Excel anterior encontrados en la base", `${respuestasLeidas - respSinUsar} de ${respuestasLeidas}`, respSinUsar ? MAL : OK],
  ["Tu revisión del v2", "Respuestas de «Propuesta … v2» encontradas por Id y aplicadas (con las reglas acordadas el 07/11)", `${aplicadasV2} de ${okV2.size}`, aplicadasV2 === okV2.size ? OK : MAL],
  ["Código propuesto", "Movimientos a los que no les pude proponer código", `${sinCodigo.length}`, sinCodigo.length ? MAL : OK],
  ["Las dos puntas", "Transferencias entre empresas con cuentas en la app (MSA, PAM, MA, Cotitulares): la otra punta, mismo importe, ±3 días",
    `${movs.filter(m => m.punta.startsWith(OK)).length} con su otra punta · ${faltaPunta.length} sin la otra punta · ${puntaSinCodigo.length} con la otra punta SIN código`, faltaPunta.length ? MAL : puntaSinCodigo.length ? OJO : OK],
  [], ["Cuenta por cuenta"], ["Cuenta", "Con contable (conteo directo)", "Leídos con contable", "En la propuesta", "Estado"],
  ...ctrlTabla.map(c => [c.cuenta, c.directoContable, c.leidosContable, c.enPropuesta, c.ok ? OK : MAL]),
  [], [`${MAL} SIN LA OTRA PUNTA (${faltaPunta.length}) — la transferencia está en una cuenta y no en la de la contraparte`],
  ["Cuenta", "Fecha", "Descripción", "Débito", "Crédito", "Código", "Lote", "Falta en"],
  ...faltaPunta.map(m => [m.cuenta, dmy(m.fecha), m.desc, m.deb, m.cred, m.codigo, m.lote, m.punta]),
  [], [`${OJO} LA OTRA PUNTA ESTÁ PERO SIN CÓDIGO (${puntaSinCodigo.length}) — se le pondría el código espejo`],
  ["Cuenta", "Fecha", "Descripción", "Débito", "Crédito", "Código", "Otra punta"],
  ...puntaSinCodigo.map(m => [m.cuenta, dmy(m.fecha), m.desc, m.deb, m.cred, m.codigo, m.punta]),
  ...(sinCodigo.length ? [[], [`${MAL} SIN CÓDIGO PROPUESTO (${sinCodigo.length})`], ["Cuenta", "Fecha", "Descripción", "Débito", "Crédito", "Marca anterior", "Tu respuesta"],
    ...sinCodigo.map(m => [m.cuenta, dmy(m.fecha), m.desc, m.deb, m.cred, m.viejo, m.resp])] : []),
]

// ── La propuesta, por LOTE
// JMS 06/11: «Entre» después de Fecha y «CÓDIGO PROPUESTO» después de Crédito
const ENC = ["Fecha", "Entre (empresa ↔ socio)", "Cuenta", "Empresa de la cuenta", "Moneda", "Débito", "Crédito", "CÓDIGO PROPUESTO", "Descripción del banco", "Detalle", "Contraparte", "CATEG", "Template / sueldo / factura",
  "Marca anterior", "Tu respuesta anterior", "Qué es", "De dónde sale", "Otra punta", "¿Suma en las cuentas?", "Tu duda (de tu respuesta)", "Tu OK / corrección", "Id"]
const propuesta = hojaResumenPorMes(movs.map(m => ({ categoria: m.lote || "(sin lote)", mes: m.mes, importe: r2(m.deb - m.cred), moneda: (m.usd ? "USD" : "ARS") as "ARS" | "USD",
  orden: `${m.lote}|${m.fecha}|${m.cuenta}`,
  columnas: [dmy(m.fecha), m.empresa ? `${m.empresa} ↔ ${m.socio}` : "", m.cuenta, m.titular, m.codigo, m.desc, m.detalle, m.contra, m.categ, m.vinculo, m.viejo || "(vacío)", m.resp,
    m.tipo, m.porque.join(" · "), m.punta, m.cuenta_aca ? "sí" : "no (espejo)", m.duda, "", `${m.tabla}:${m.id}`] })), {
  titulo: `PROPUESTA DE CÓDIGOS CONTABLE — ejercicio 25/26 (${movs.length} movimientos, por LOTE)`,
  notas: ["Cada LOTE junta cosas que se tratan igual: «MSA ↔ MA · transferencias», «MSA ↔ MA · gastos de MA pagados por MSA», «(vacío) · …» (en la base queda VACÍO: el texto después del punto es sólo para entender por qué), «FLIA», «X», «? A decidir · …». Filtrá por «CÓDIGO PROPUESTO» o por «Entre» para ver una cuenta entera.",
    "CÓDIGO = CTA + quién (con quién es la cuenta). Quién retira de quién = el código + la empresa de la cuenta. Retiro o aporte = el signo. El motivo = el template / sueldo / factura (no hace falta RET 1/3/i).",
    "Respondé en «Tu OK / corrección» sólo lo que no va. No se cambió nada en la base: al aplicar, se escribe el código con un script y su deshacer, con tu OK."],
  meses, encabezadoDetalle: ENC.filter(x => !["Moneda", "Débito", "Crédito"].includes(x)), semestres: true, porMoneda: true, debeHaber: true, importeEn: 4 })

// ── Lo que da el esquema: quién retiró / aportó de quién (cada movimiento una vez; + = el socio retiró de la empresa, − = aportó)
const cuentan = movs.filter(m => m.empresa && m.cuenta_aca && (m.codigo.startsWith("CTA") || m.codigo.startsWith("DIST")))
const cuentas = hojaResumenPorMes(cuentan.map(m => {
  const signo = m.titular === m.empresa ? 1 : -1   // en la cuenta de la empresa, débito = el socio retiró; en la del socio, crédito = retiró
  return { categoria: `${m.empresa} ↔ ${m.socio}${m.codigo.startsWith("DIST") ? " · distribución" : ""}`, mes: m.mes, importe: r2(signo * (m.deb - m.cred)), moneda: (m.usd ? "USD" : "ARS") as "ARS" | "USD",
    orden: `${m.empresa}${m.socio}|${m.fecha}`, columnas: [m.punta.startsWith(MAL) ? "⚠️ ALERTA" : "", dmy(m.fecha), m.cuenta, m.desc, m.codigo, m.tipo, m.motivo, m.punta] } }), {
  titulo: "CUENTAS — lo que da el esquema: + = el socio RETIRÓ de la empresa · − = APORTÓ (cada transferencia contada una sola vez)",
  notas: [`⚠️ ALERTAS: ${movs.filter(m => m.punta.startsWith(MAL)).length} transferencia(s) sin la otra punta — filtrá «Alerta» (JMS 07/11: deben marcar alerta).`, "Así se vería el reporte con los códigos nuevos. El motivo (transferencia, Red Vial, municipalidad…) sale de la columna «Motivo».",
    "Falta sumar lo que la empresa le debe (sueldo, facturas): eso está en las cuentas MSA-MA y MSA-PAM. Libertad va aparte."],
  meses, encabezadoDetalle: ["Alerta", "Fecha", "Cuenta", "Descripción", "Código", "Qué es", "Motivo", "Otra punta"], rotuloImporte: "Importe (+ retiró / − aportó)", semestres: true, porMoneda: true })

if (!existsSync(CARPETA)) mkdirSync(CARPETA, { recursive: true })
const nombre = (b: string) => { let p = join(CARPETA, `${b}.xlsx`), v = 2; while (existsSync(p)) p = join(CARPETA, `${b} v${v++}.xlsx`); return p }
const wb = XLSX.utils.book_new()
agregarHoja(wb, "Control", ctrl); agregarHoja(wb, "Propuesta", propuesta); agregarHoja(wb, "Cuentas", cuentas)
fechasReales(wb as any)
const p = nombre(`Propuesta codigos contable 25-26 (${HOY})`); XLSX.writeFile(wb, p)

console.log(`movimientos ${movs.length} (con marca ${conViejo}, nuevos ${nuevos.length}) · cuentas ok ${ctrlTabla.filter(c => c.ok).length}/${ctrlTabla.length} · respuestas ${respuestasLeidas - respSinUsar}/${respuestasLeidas} · sin código ${sinCodigo.length}`)
for (const c of ctrlTabla.filter(c => !c.ok)) console.log(`  ${MAL} ${c.cuenta}: directo ${c.directoContable} leídos ${c.leidosContable} en propuesta ${c.enPropuesta}`)
console.log(`2 puntas: ok ${movs.filter(m => m.punta.startsWith(OK)).length} · falta ${faltaPunta.length} · sin código ${puntaSinCodigo.length}`)
const lotes = new Map<string, { n: number; imp: number }>(); for (const m of movs) { const x = lotes.get(m.lote) ?? { n: 0, imp: 0 }; x.n++; x.imp = r2(x.imp + m.deb - m.cred); lotes.set(m.lote, x) }
for (const [l, x] of [...lotes].sort()) console.log(`  ${String(x.n).padStart(4)}  ${l}  ${x.imp}`)
for (const m of faltaPunta) console.log(`  falta punta: ${m.cuenta} ${m.fecha} ${m.deb || -m.cred} ${m.codigo} ${m.desc}`)
console.log(`📄 ${p}`)
const porPareja = new Map<string, number>()
for (const m of cuentan) { const k = `${m.empresa} ↔ ${m.socio}${m.codigo.startsWith("DIST") ? " · distribución" : ""}${m.usd ? " (USD)" : ""}`; porPareja.set(k, r2((porPareja.get(k) ?? 0) + (m.titular === m.empresa ? 1 : -1) * (m.deb - m.cred))) }
console.log("CUENTAS (+ retiró / − aportó):", [...porPareja].map(([k, v]) => `${k} ${v}`).join(" · "))
