/**
 * 👥 CUENTAS CON SOCIOS — OPCIONES (JMS 11/11: «trabajar sobre una de las que existen y armar nuevos cuadros que se desprenden sin modificar
 * los anteriores… vamos a agruparlos así los datos, pero no me cambiaste los datos… y tiene que haber todo un check de control»). SÓLO LEE.
 *
 *     npx tsx scripts/excel-cuentas-socios-opciones.mts
 *
 * Base: el prototipo de la 14.1 (scripts/prototipo-14-1-por-grupo.mts, 07/11) — las mismas cuentas, los mismos asientos — más Libertad del
 * cuadro final de «Gastos Libertad» (A-FEAT-1595). Nada se recalcula distinto: los mismos asientos, AGRUPADOS de dos maneras.
 *   A · Cómo está hoy   — el resumen del 14.1 (inicio · facturado · vendido · pagado · movimiento · cierre).
 *   B · Propuesta       — cada socio por BLOQUES: facturas del socio · sueldo · pagos directos al socio · pagado a terceros por su cuenta ·
 *                         Libertad · lo que el socio pagó por MSA · otros. Cada bloque es una fórmula sobre el Detalle.
 *   Control             — por socio, el saldo de A = el de B (es la misma plata agrupada distinto).
 *   Detalle             — cada asiento con su socio, su bloque y su ficha.
 * Signo (el del 14.1): + = le debemos · − = nos debe.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { armarCuentasCorrientes, movimientosDeLosSocios, consumosDeTarjetaComoMovimientos, sueldosPendientesComoCompras,
  type CuentaDelSocio, type MovimientoParaCC, type CompraParaCC, type SueldoParaCC, type ConsumoTarjeta } from "../lib/balance/cuentas-corrientes"
import { agregarHoja } from "../lib/balance/export-libro-diario"
import { fechasReales } from "../lib/excel/fechas-reales"
import { armarEjercicio, primerDiaDelEjercicio } from "../lib/balance/ejercicio"
import { desdeCuota, armarTemplatesDelEjercicio } from "../lib/balance/templates-libro"
import { leerMovimientosDeCuotas, vincularBanco, leerExtractoDelEjercicio, indiceDeDestinos } from "../lib/balance/movimientos-de-cuotas"
import { hojaLibertad, cuentasDeLibertad, conLibertadEnSocios } from "../lib/balance/libertad"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const D = "2025-07-01", H = "2026-06-30"
const MESES = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const r2 = (x: number) => Math.round(x * 100) / 100
async function todo(q: (d: number, h: number) => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break } return out }
const desde = (s: string, t: string) => (s === "public" ? sb.from(t) : sb.schema(s).from(t))

// ── 1 · Lo mismo que el prototipo de la 14.1 (07/11): facturas, sueldo pendiente, Galicia MSA con código, tarjeta y las cuentas de los socios
const arca = await todo((d, h) => sb.schema("msa").from("comprobantes_arca").select("id, fecha_emision, punto_venta, numero_desde, imp_total, cuit, denominacion_emisor").gte("fecha_emision", D).lte("fecha_emision", H).order("id").range(d, h))
const hist = await todo((d, h) => sb.schema("msa").from("comprobantes_historico").select("id, fecha, numero_desde, imp_total, denominacion_emisor").gte("fecha", D).lte("fecha", H).order("id").range(d, h))
const compras: CompraParaCC[] = [
  ...arca.map((a: any) => ({ id: a.id, fecha: a.fecha_emision, numero: `${a.punto_venta ?? ""}-${a.numero_desde ?? ""}`, total: Number(a.imp_total) || 0, cuit: a.cuit, denominacion: a.denominacion_emisor })),
  ...hist.map((a: any) => ({ id: a.id, fecha: a.fecha, numero: String(a.numero_desde ?? ""), total: Number(a.imp_total) || 0, cuit: null, denominacion: a.denominacion_emisor })),
]
const periodos = await todo((d, h) => sb.from("sueldos_periodos").select("*, empleado:sueldos_empleados(nombre, empresa, tipo_empleado, cuit_empleado)").in("anio", [2025, 2026]).order("id").range(d, h))
compras.push(...sueldosPendientesComoCompras(periodos as SueldoParaCC[], MESES))
const cols = "id, fecha, debitos, creditos, descripcion, detalle, contable, comprobantes_pagados, estado, categ, sueldo_pago_id, template_cuota_id, cuit:leyendas_adicionales_2, benef:leyendas_adicionales_1"
const conCodigo = await todo((d, h) => sb.from("msa_galicia").select(cols).gte("fecha", D).lte("fecha", H).not("contable", "is", null).order("id").range(d, h))
const pagosTj = await todo((d, h) => sb.from("msa_galicia").select(cols).gte("fecha", D).lte("fecha", H).is("contable", null).ilike("descripcion", "%visa%").order("id").range(d, h))
const cuotasG = await todo((d, h) => sb.from("cuotas_egresos_sin_factura").select("id, grupo_pago_id, egreso:egresos_sin_factura(nombre_referencia, cuenta_agrupadora)").order("id").range(d, h))
const grupoTpl = new Map<string, string>()
for (const c of cuotasG) { const g = String(c.egreso?.cuenta_agrupadora || c.egreso?.nombre_referencia || "").trim(); if (!g) continue; grupoTpl.set(c.id, g); if (c.grupo_pago_id && !grupoTpl.has(c.grupo_pago_id)) grupoTpl.set(c.grupo_pago_id, g) }
const conceptoTpl = new Map<string, string>()
for (const c of cuotasG) { const g = String(c.egreso?.nombre_referencia ?? "").trim(); if (g) { conceptoTpl.set(c.id, g); if (c.grupo_pago_id && !conceptoTpl.has(c.grupo_pago_id)) conceptoTpl.set(c.grupo_pago_id, g) } }
const empleadosFull = await todo((d, h) => sb.from("sueldos_empleados").select("id, nombre, cuit_empleado, empresa").order("id").range(d, h))
const empleados = new Map(empleadosFull.map((e: any) => [e.id, e.nombre]))
const empleadoDePago = new Map<string, string>()
for (const g of await todo((d, h) => sb.from("sueldos_pagos").select("id, grupo_pago_id, empleado_id").order("id").range(d, h))) {
  const n = empleados.get(g.empleado_id); if (!n) continue; empleadoDePago.set(g.id, n); if (g.grupo_pago_id && !empleadoDePago.has(g.grupo_pago_id)) empleadoDePago.set(g.grupo_pago_id, n)
}
const grupoDe = (m: any) => (m.sueldo_pago_id ? `Sueldos (${empleadoDePago.get(m.sueldo_pago_id) ?? "?"})` : (m.template_cuota_id && grupoTpl.get(m.template_cuota_id)) || String(m.categ ?? "").trim() || "Otros")
const msa: MovimientoParaCC[] = [...conCodigo, ...pagosTj].map((m: any) => ({ ...m, cuenta: "MSA Galicia cta cte", grupo: grupoDe(m) }))
const consumos: ConsumoTarjeta[] = (await todo((d, h) => sb.schema("msa").from("tarjeta_visa_business").select("fecha_vencimiento, descripcion, categ, contable, debitos, creditos, debitos_usd").eq("tipo_fila", "movimiento").gte("fecha_vencimiento", D).lte("fecha_vencimiento", H).order("id").range(d, h)))
  .map((x: any) => ({ vencimiento: x.fecha_vencimiento, descripcion: x.descripcion, categ: x.categ, contable: x.contable, debitos: Number(x.debitos ?? 0), creditos: Number(x.creditos ?? 0), debitosUsd: Number(x.debitos_usd ?? 0) }))
const porLaTarjeta = consumosDeTarjetaComoMovimientos(msa, consumos).map(m => ({ ...m, grupo: m.grupo || "Otros" }))
const CUENTAS = [["MA", "MA caja de ahorro", "ma", "ma_galicia", false], ["MA", "MA VISA", "ma", "tarjeta_visa", true], ["PAM", "PAM caja de ahorro", "public", "pam_galicia", false],
  ["PAM", "PAM cta cte", "public", "pam_galicia_cc", false], ["PAM", "PAM VISA", "pam", "tarjeta_visa", true]] as const
const socios: CuentaDelSocio[] = []
for (const [clave, nombre, s, t, tj] of CUENTAS) {
  const filas = await todo((d, h) => { let q = desde(s, t).select("id, fecha, debitos, creditos, descripcion, detalle, contable, comprobantes_pagados, estado, categ").gte("fecha", D).lte("fecha", H); if (tj) q = q.eq("tipo_fila", "movimiento"); return q.order("id").range(d, h) })
  socios.push({ clave, nombre, movimientos: filas.map((m: any) => ({ ...m, grupo: String(m.categ ?? "").trim() || "Otros" })) })
}
const conSocios = movimientosDeLosSocios([...msa, ...porLaTarjeta], socios)
const papel = armarCuentasCorrientes(compras, [], [...conSocios.msa, ...conSocios.delSocio], { JMS: -15000000, AMS: -10500000, MA: 0, PAM: 0 })

// ── 2 · Libertad: el cuadro final de «Gastos Libertad», armado igual que en el libro H
const ej = armarEjercicio(2026, 6)
const filasTpl = await todo((d, h) => sb.from("cuotas_egresos_sin_factura")
  .select("*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable, tipo, cuenta_agrupadora, año)")
  .gte("fecha_estimada", "2024-01-01").order("id").range(d, h))
const { data: plan } = await sb.from("cuentas_contables").select("categ, tipo, nro_cuenta, nombre_totalizadora")
const tipoDeCateg = Object.fromEntries((plan ?? []).map((x: any) => [x.categ, x.tipo]))
let cuotas = filasTpl.map((f: any) => desdeCuota(f, tipoDeCateg as any))
cuotas = vincularBanco(cuotas, cuotas, (await leerMovimientosDeCuotas(sb, cuotas)).movimientos)
const ex = await leerExtractoDelEjercicio(sb, primerDiaDelEjercicio(ej), ej.fechaCierre)
const templates = armarTemplatesDelEjercicio(cuotas, ej, { empresa: "MSA", plan: plan ?? [], extracto: { movimientos: ex.movimientos, destinos: indiceDeDestinos(cuotas), tablasQueFallaron: ex.tablasQueFallaron } } as any)
const meses = ej.subdiarios.map((x: any) => ({ clave: `${x.anio}-${String(x.mes).padStart(2, "0")}`, rotulo: `${MES[x.mes - 1]}-${String(x.anio).slice(-2)}` }))
const lib = cuentasDeLibertad(hojaLibertad(templates.detalle, ej.etiqueta, meses, (templates as any).entrada?.opciones.extracto))
const cuentas = conLibertadEnSocios(papel.cuentas.filter(c => c.contraparte.socio), lib, { corte: "2025-12-31", cierre: H })

// ── 3 · El BLOQUE de cada asiento (la propuesta), sólo por lo que ya tiene cargado
const movPorId = new Map<string, any>([...conSocios.msa, ...conSocios.delSocio, ...porLaTarjeta].map(m => [String(m.id), m]))
const BLOQUES = [
  ["B2", "Facturas del socio (servicios que le factura a MSA)"],
  ["B3", "Sueldo (lo devengado pendiente y lo pagado)"],
  ["B4", "Pagos DIRECTOS al socio (transferencias a su CUIT)"],
  ["B5", "Pagado a TERCEROS por cuenta del socio (sus impuestos, sus gastos, su tarjeta)"],
  ["B6", "Libertad (cuadro final de «Gastos Libertad»)"],
  ["B7", "Lo que el socio pagó por MSA (aportes)"],
  ["B8", "Otros (lo que no entra en los anteriores: a revisar)"],
] as const
type Bloque = (typeof BLOQUES)[number][0]
const bloqueDe = (a: any, cuitSocio: string): { b: Bloque; porque: string } => {
  if (String(a.id).startsWith("libertad:")) return { b: "B6", porque: "renglón de Libertad del cuadro final" }
  if (a.tipo === "compra") return /^Sueldo /.test(a.concepto) ? { b: "B3", porque: "sueldo devengado pendiente (Sueldos)" } : { b: "B2", porque: "factura de compra a su nombre" }
  if (a.tipo === "venta") return { b: "B8", porque: "le facturamos" }
  const m = movPorId.get(String(a.id))
  if (String(a.id).startsWith("ret-")) return { b: "B8", porque: "retención" }
  if (m?.delSocio) return { b: "B7", porque: `movimiento de la cuenta del socio (${m.cuenta}) marcado «CTA MSA»` }
  if (String(a.grupo ?? "").startsWith("Sueldos")) return { b: "B3", porque: "pago de sueldo (vinculado en Sueldos)" }
  if (m && /visa/i.test(String(m.cuenta ?? ""))) return { b: "B5", porque: "consumo de la tarjeta de MSA por cuenta del socio" }
  const cuit = String(m?.cuit ?? "").replace(/\D/g, "")
  if (cuit && cuit === cuitSocio) return { b: "B4", porque: "el banco informa el CUIT del socio como destinatario" }
  if (cuit) return { b: "B5", porque: `el destinatario es otro CUIT (${cuit})` }
  if (a.importe > 0) return { b: "B8", porque: "entrada sin CUIT informado" }
  return { b: "B5", porque: "salida sin CUIT del socio (paga a un tercero o no lo informa el banco)" }
}

// ── 4 · El Excel
const MONEDA = '#,##0.00;[Red]-#,##0.00;"-"'
const n = (v: number) => ({ t: "n", v: r2(v), z: MONEDA })
const F = (f: string, v: number) => ({ t: "n", f, v: r2(v), z: MONEDA })
const B = (v: string) => ({ t: "s", v, s: { font: { bold: true } } })
const TIT = (v: string) => ({ t: "s", v, s: { font: { bold: true, sz: 14 } } })
const dmy = (f: string) => f.slice(0, 10).split("-").reverse().join("/")

// Detalle (primero: las fórmulas de B apuntan acá)
const det: unknown[][] = [[TIT("DETALLE — cada asiento de las cuentas con los socios, con su bloque de la propuesta")],
  ["Los mismos asientos del 14.1 (y Libertad). Filtrá por Socio y Bloque. Importe con el signo del 14.1: + = le debemos · − = nos debe."], [],
  ["Socio", "Bloque", "Por qué ese bloque", "Cuenta", "Fecha", "Qué es", "Importe", "Debe", "Haber", "Grupo (template / categ)", "Concepto", "CUIT del destino", "Otra punta"].map(B)]
const d1 = det.length + 1
const sumas = new Map<string, number>()
for (const c of cuentas) {
  for (const a of c.resumen.asientos) {
    const { b, porque } = bloqueDe(a, c.contraparte.cuit)
    const m = movPorId.get(String(a.id))
    sumas.set(`${c.contraparte.clave}|${b}`, r2((sumas.get(`${c.contraparte.clave}|${b}`) ?? 0) + a.importe))
    det.push([c.contraparte.clave, b, porque, a.cuenta ?? "MSA Galicia cta cte", dmy(a.fecha), a.tipo === "compra" ? "nos factura / sueldo" : a.tipo === "venta" ? "le facturamos" : a.importe > 0 ? "pagó por MSA / aportó" : "MSA le pagó / por su cuenta",
      n(a.importe), a.importe < 0 ? n(-a.importe) : "", a.importe > 0 ? n(a.importe) : "", a.grupo ?? "", a.concepto, String(m?.cuit ?? "").replace(/\D/g, ""), (a as any).otraPunta ?? ""])
  }
}
const dN = det.length
const R = (col: string) => `'Detalle'!$${col}$${d1}:$${col}$${dN}`

// A · Cómo está hoy
const a: unknown[][] = [[TIT("A · CÓMO ESTÁ HOY — el resumen del 14.1 (con Libertad), tal cual")],
  ["Las mismas columnas que la solapa «14.1 Cuentas con socios». Saldo: + = le debemos · − = nos debe."], [],
  ["Socio", "Saldo al INICIO", "Facturado", "Vendido", "Pagado / cobrado", "Movimiento del ejercicio", "SALDO AL CIERRE"].map(B)]
const filaA = new Map<string, number>()
for (const c of cuentas) {
  const k = a.length + 1; filaA.set(c.contraparte.clave, k)
  a.push([`${c.contraparte.clave} · ${c.contraparte.nombre}`, n(c.saldoInicio), n(c.resumen.totalComprado), n(c.resumen.totalVendido), n(c.resumen.totalPagado), F(`C${k}-D${k}-E${k}`, c.resumen.saldo), F(`B${k}+F${k}`, c.saldoAlCierre)])
}

// B · Propuesta
const b: unknown[][] = [[TIT("B · PROPUESTA — cada socio por BLOQUES (los mismos asientos, agrupados por QUÉ son)")],
  ["Cada bloque es una fórmula sobre «Detalle» (Socio + Bloque). Saldo: + = le debemos · − = nos debe. Retiros y aportes del libro H alimenta B5, B6 y B7."], []]
const filaCierreB = new Map<string, number>()
for (const c of cuentas) {
  b.push([B(`${c.contraparte.clave} · ${c.contraparte.nombre}`)], ["Bloque", "", "Importe"].map(x => (x ? B(x) : x)))
  const k0 = b.length + 1
  b.push(["B1 · Saldo al inicio", "", F(`'A · Cómo está hoy'!B${filaA.get(c.contraparte.clave)}`, c.saldoInicio)])
  for (const [cod, nombre] of BLOQUES) {
    const v = sumas.get(`${c.contraparte.clave}|${cod}`) ?? 0
    b.push([`${cod} · ${nombre}`, "", F(`SUMIFS(${R("G")},${R("A")},"${c.contraparte.clave}",${R("B")},"${cod}")`, v)])
  }
  const kN = b.length, kc = b.length + 1
  filaCierreB.set(c.contraparte.clave, kc)
  b.push([B("= SALDO AL CIERRE"), "", { ...F(`SUM(C${k0}:C${kN})`, c.saldoAlCierre), s: { font: { bold: true }, numFmt: MONEDA } }], [])
}

// Control
const ctl: unknown[][] = [[TIT("CONTROL — la misma plata agrupada de dos maneras tiene que dar el mismo saldo")], [],
  ["Socio", "Saldo al cierre A (hoy)", "Saldo al cierre B (propuesta)", "Diferencia", "¿Cierra?", "Asientos", "Sin clasificar (B8)"].map(B)]
for (const c of cuentas) {
  const k = ctl.length + 1, cl = c.contraparte.clave
  const nAs = c.resumen.asientos.length, b8 = c.resumen.asientos.filter(x => bloqueDe(x, c.contraparte.cuit).b === "B8").length
  ctl.push([`${cl} · ${c.contraparte.nombre}`, F(`'A · Cómo está hoy'!G${filaA.get(cl)}`, c.saldoAlCierre), F(`'B · Propuesta'!C${filaCierreB.get(cl)}`, c.saldoAlCierre),
    F(`B${k}-C${k}`, 0), { t: "s", f: `IF(ABS(D${k})<0.01,"✓ cierra","⚠️ no da")`, v: "✓ cierra" }, { t: "n", v: nAs, z: "0" }, { t: "n", v: b8, z: "0" }])
}
ctl.push([], ["ⓘ «Sin clasificar (B8)»: los asientos que la propuesta no supo ubicar — son los que hay que mirar para que el agrupamiento quede completo."])

const wb = XLSX.utils.book_new()
const MON = { z: MONEDA }
agregarHoja(wb, "Control", ctl, [{ ancho: 40 }, { ancho: 20, ...MON }, { ancho: 22, ...MON }, { ancho: 14, ...MON }, { ancho: 14 }, { ancho: 10 }, { ancho: 18 }] as any)
agregarHoja(wb, "A · Cómo está hoy", a, [{ ancho: 40 }, { ancho: 18, ...MON }, { ancho: 18, ...MON }, { ancho: 14, ...MON }, { ancho: 18, ...MON }, { ancho: 20, ...MON }, { ancho: 18, ...MON }] as any)
agregarHoja(wb, "B · Propuesta", b, [{ ancho: 70 }, { ancho: 2 }, { ancho: 20, ...MON }] as any)
agregarHoja(wb, "Detalle", det, [{ ancho: 8 }, { ancho: 7 }, { ancho: 44 }, { ancho: 22 }, { ancho: 11 }, { ancho: 22 }, { ancho: 16, ...MON }, { ancho: 15, ...MON }, { ancho: 15, ...MON }, { ancho: 30 }, { ancho: 60 }, { ancho: 14 }, { ancho: 24 }] as any)
fechasReales(wb as any)
let p = join(CARPETA, "Cuentas con socios - opciones (2026-11-11).xlsx"), v = 2
while (existsSync(p)) p = join(CARPETA, `Cuentas con socios - opciones (2026-11-11) v${v++}.xlsx`)
XLSX.writeFile(wb, p)
for (const c of cuentas) console.log(`${c.contraparte.clave}: cierre ${c.saldoAlCierre} · ${BLOQUES.map(([cod]) => `${cod} ${sumas.get(`${c.contraparte.clave}|${cod}`) ?? 0}`).join(" · ")}`)
console.log(`📄 ${p}`)
