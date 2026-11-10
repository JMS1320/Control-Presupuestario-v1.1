/**
 * 🔍 EL LIBRO H PARA AUDITAR, generado fuera de la app con los datos reales (A-FEAT-1579). SÓLO LEE.
 * Lee lo mismo que Papeles de balance (cuotas de templates, el plan, las pólizas, el banco de cada cuota y el extracto del ejercicio) y
 * arma el H con la opción `auditoria` — el mismo armado que baja el set desde la app. El papel de impuestos no sale acá (lo arma la app).
 *
 *     npx tsx scripts/excel-h-para-auditar.mts [MSA] [2026]
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { armarEjercicio, primerDiaDelEjercicio } from "../lib/balance/ejercicio"
import { desdeCuota, armarTemplatesDelEjercicio } from "../lib/balance/templates-libro"
import { leerCuentasConSaldo, resumirCuenta, hojaControlPlata, armarEtapa2, hojaDetalleEtapa2, puenteDeComprobantes, hojaFacturasPuente } from "../lib/balance/control-plata"
const SOLAPA_PLATA = "Control de la plata", SOLAPA_PLATA_DET = "Plata · adónde fue", SOLAPA_PLATA_FAC = "Plata · facturas"
import { leerMovimientosDeCuotas, vincularBanco, leerExtractoDelEjercicio, indiceDeDestinos, conFacturas } from "../lib/balance/movimientos-de-cuotas"
import { agregarLibroH, vistasDe, agregarHoja, reordenarSolapas } from "../lib/balance/export-libro-diario"
import { SOLAPA_CAMBIOS, CAMBIOS, ANCHOS_CAMBIOS } from "./cambios-presentacion-h.mts"
import { SOLAPA_DATOS, ANCHOS_DATOS, armarDatosARevisar } from "./datos-a-revisar-h.mts"
import { nombreSolapaGrupo, SIN_GRUPO, cuotaSinPago } from "../lib/balance/grupos-templates"
import { armarLibroDiario, desdeArca, desdeHistorico, desdeVenta } from "../lib/balance/libro-diario"
import { PRESENTADO_ARCA_COMPRAS } from "../lib/balance/presentado-arca"
import { aplicarVistas } from "../lib/balance/formato-excel"
import { fechasReales } from "../lib/excel/fechas-reales"
import { cargarCuotasImpuestos, cargarAuxiliaresPapel } from "../lib/impuestos/datos-papel"
import { auditarCuota, esEfectoEntrePartes } from "../lib/balance/auditoria-templates"
import { cargarProblemasDeModalidad } from "../lib/templates/modalidad"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ARGS = process.argv.slice(2).filter(a => !a.startsWith("--"))
const EMPRESA = ARGS[0] ?? "MSA", ANIO = Number(ARGS[1] ?? 2026)
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
async function todo(q: (d: number, h: number) => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break } return out }

const ej = armarEjercicio(ANIO, 6)
const filas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura")
  .select("*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable, tipo, cuenta_agrupadora, año)")
  .gte("fecha_estimada", `${ANIO - 2}-01-01`).order("id").range(d, h))
const { data: planTipos } = await sb.from("cuentas_contables").select("categ, tipo, nro_cuenta, nombre_totalizadora")
const plan = planTipos ?? []
const tipoDeCateg = Object.fromEntries(plan.map((x: any) => [x.categ, x.tipo]))
const { data: conPoliza } = await sb.from("polizas_seguro").select("template_id").not("template_id", "is", null)
let cuotas = filas.map((f: any) => desdeCuota(f, tipoDeCateg as any))
const leido = await leerMovimientosDeCuotas(sb, cuotas)
cuotas = vincularBanco(cuotas, cuotas, leido.movimientos)
cuotas = await conFacturas(sb, cuotas)  // 🔍 el texto de la factura vinculada a cada movimiento
const ex = await leerExtractoDelEjercicio(sb, primerDiaDelEjercicio(ej), ej.fechaCierre)
const templates = armarTemplatesDelEjercicio(cuotas, ej, {
  empresa: EMPRESA, plan, templatesConPoliza: (conPoliza ?? []).map((p: any) => p.template_id).filter(Boolean),
  bancoSinLeer: leido.tablasQueFallaron, extracto: { movimientos: ex.movimientos, destinos: indiceDeDestinos(cuotas), tablasQueFallaron: ex.tablasQueFallaron },
} as any)
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const meses = ej.subdiarios.map((x: any) => ({ clave: `${x.anio}-${String(x.mes).padStart(2, "0")}`, rotulo: `${MES[x.mes - 1]}-${String(x.anio).slice(-2)}` }))

const wb = XLSX.utils.book_new()
// los papeles de impuestos (y el establecimiento de cada partida), como en la app
const [cuotasImp, aux] = await Promise.all([cargarCuotasImpuestos(sb), cargarAuxiliaresPapel(sb)])
const { problemas: estructura } = await cargarProblemasDeModalidad(sb, Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 4)))
console.log(`estructura de templates (anual o cuotas, pagos): ${estructura.length} a corregir`)
// ✍️ A-FEAT-1207: lo que el balance anterior dejó para tomar como gasto de éste (pagos anuales adelantados)
const { data: ajSaldos } = await sb.from("ajustes_balance").select("empresa, concepto, categ, monto, motivo").eq("accion", "saldo_anterior").eq("anio_cierre", ANIO).is("anulado_at", null)
const saldosAnteriores = (ajSaldos ?? []).map((a: any) => ({ empresa: a.empresa, concepto: a.concepto, categ: a.categ ?? "", monto: Number(a.monto) || 0, motivo: a.motivo ?? "" }))
agregarLibroH(wb as any, templates, ej.etiqueta, meses, { cuotas: cuotasImp, ...aux, saldosAnteriores } as any, { auditoria: true, estructura })
// 💰 A-FEAT-1533 (JMS 11/11): el CONTROL DE LA PLATA, etapa 1 — cada cuenta de la empresa, inicio + ingresos − egresos = saldo final, contra la planilla
{
  const corte = `${ANIO - 1}-12-31`, r2 = (n: number) => Math.round(n * 100) / 100
  const leidas = await leerCuentasConSaldo(sb, EMPRESA, ej.fechaCierre)
  const rs = leidas.cuentas.map(c => resumirCuenta(c, primerDiaDelEjercicio(ej), corte, ej.fechaCierre))
  // 💰 etapa 2: adónde fue cada movimiento de esas mismas cuentas, con la ficha de la factura o la venta que pagó / cobró
  const idsArca = [...new Set(ex.movimientos.filter((m: any) => m.titular === EMPRESA && m.comprobanteArcaId).map((m: any) => m.comprobanteArcaId))]
  const idsVenta = [...new Set(ex.movimientos.filter((m: any) => m.titular === EMPRESA && m.comprobanteVentaId).map((m: any) => m.comprobanteVentaId))]
  const fichas = new Map<string, string>()
  const money = (x: number) => Number(x || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  for (let i = 0; i < idsArca.length; i += 150) {
    const { data } = await sb.schema("msa").from("comprobantes_arca").select("id, denominacion_emisor, cuit, tipo_comprobante_desc, punto_venta, numero_desde, imp_total").in("id", idsArca.slice(i, i + 150))
    for (const c of data ?? []) fichas.set(`a:${c.id}`, `${c.denominacion_emisor} (CUIT ${c.cuit}) · ${c.tipo_comprobante_desc ?? "FC"} ${c.punto_venta}-${c.numero_desde} · $ ${money(c.imp_total)}`)
  }
  for (let i = 0; i < idsVenta.length; i += 150) {
    const { data } = await sb.schema("msa").from("comprobantes_venta").select("id, denominacion_cliente, cuit_cliente, punto_venta, numero_desde, imp_total").in("id", idsVenta.slice(i, i + 150))
    for (const c of data ?? []) fichas.set(`v:${c.id}`, `${c.denominacion_cliente} (CUIT ${c.cuit_cliente}) · venta ${c.punto_venta}-${c.numero_desde} · $ ${money(c.imp_total)}`)
  }
  const etapa2 = armarEtapa2(ex.movimientos as any, EMPRESA, new Set(rs.map(r => r.cuenta)), indiceDeDestinos(cuotas) as any,
    { desde: primerDiaDelEjercicio(ej), corte, hasta: ej.fechaCierre },
    (m: any) => (m.comprobanteArcaId ? fichas.get(`a:${m.comprobanteArcaId}`) ?? "factura fuera de MSA" : m.comprobanteVentaId ? fichas.get(`v:${m.comprobanteVentaId}`) ?? "" : ""))
  // 💰 etapa 3: lo REGISTRADO (libro diario, templates, sueldos, consumos de la tarjeta) contra lo que movió el banco (etapa 2)
  const anios = [ANIO - 1, ANIO, ANIO + 1]
  const [arca, historico, ventasRaw] = await Promise.all([
    todo((d, h) => sb.schema("msa").from("comprobantes_arca").select("*").in("año_contable", anios).order("id").range(d, h)),
    todo((d, h) => sb.schema("msa").from("comprobantes_historico").select("*").in("anio_contable", anios).order("id").range(d, h)),
    todo((d, h) => sb.schema("msa").from("comprobantes_venta").select("*").in("año_contable", anios).order("id").range(d, h)),
  ])
  const libro = armarLibroDiario([...arca.map(desdeArca), ...historico.map(desdeHistorico)], ventasRaw.map(desdeVenta), ej, PRESENTADO_ARCA_COMPRAS.MSA)
  const NC = new Set([3, 8, 13, 53, 113, 203, 208, 213])
  const mesesEj = new Set(meses.map(m => m.clave))
  const conSigno = (a: any) => (a.tipo != null && NC.has(a.tipo) ? -Math.abs(a.total) : a.total)
  const sumaLibro = (xs: any[]) => r2(xs.filter(a => mesesEj.has(a.subdiario)).reduce((t, a) => t + conSigno(a), 0))
  const deMSA = (templates.detalle as any[]).filter(c => String(c.responsable ?? "").split("/")[0].trim().toUpperCase() === EMPRESA && !cuotaSinPago(c) && mesesEj.has(String(c.fecha ?? "").slice(0, 7)))
  const tplTipo = (tipo: string) => r2(deMSA.filter(c => c.tipo === tipo).reduce((t, c) => t + c.monto, 0))
  const empleados = new Map((await todo((d, h) => sb.from("sueldos_empleados").select("id, empresa").order("id").range(d, h))).map((e: any) => [e.id, e]))
  const pagosSueldo = await todo((d, h) => sb.from("sueldos_pagos").select("id, empleado_id, fecha, monto, estado").gte("fecha", primerDiaDelEjercicio(ej)).lte("fecha", ej.fechaCierre).order("id").range(d, h))
  const sueldosMSA = r2(pagosSueldo.filter((p: any) => String((empleados.get(p.empleado_id) as any)?.empresa ?? "").split("/")[0].trim().toUpperCase() === EMPRESA && String(p.estado) !== "programado").reduce((t: number, p: any) => t + (Number(p.monto) || 0), 0))
  const consumosVisa = r2((ex.movimientos as any[]).filter(m => m.titular === EMPRESA && /tarjeta|visa/i.test(m.cuenta) && !/^SU PAGO/i.test(m.descripcion) && String(m.estado).toLowerCase() !== "total")
    .reduce((t, m) => t + m.debitos - m.creditos, 0))
  const etapa3 = [
    { nro: "E1", concepto: "Ventas facturadas (libro diario, total; las NC restan)", registrado: sumaLibro(libro.ventas), deDondeRegistrado: "libro diario de ventas del ejercicio", banco: { codigos: ["D2"], lado: "ing" },
      explica: "lo facturado y no cobrado al cierre (deudores), lo cobrado de ventas del ejercicio anterior, las retenciones que nos hicieron" },
    { nro: "E2", concepto: "Compras facturadas (libro diario, total; las NC restan)", registrado: sumaLibro(libro.compras), deDondeRegistrado: "libro diario de compras del ejercicio", banco: { codigos: ["D1"], lado: "egr" },
      explica: "lo no pagado al cierre (proveedores), lo pagado de compras anteriores, lo pagado con tarjeta, caja, echeq u otra empresa, y el histórico jul–ene sin vincular" },
    { nro: "E3", concepto: "Templates de GASTO de MSA pagados", registrado: tplTipo("egreso"), deDondeRegistrado: "cuotas de MSA de tipo gasto pagadas en el ejercicio (libro H)", banco: { codigos: ["D3"], lado: "neto" },
      explica: "lo que pagó la tarjeta, la caja u otra empresa por MSA, y lo que MSA pagó de otras empresas" },
    { nro: "E4", concepto: "Templates de INGRESO de MSA cobrados", registrado: tplTipo("ingreso"), deDondeRegistrado: "cuotas de MSA de tipo ingreso", banco: { codigos: ["D4"], lado: "ing" }, explica: "lo cobrado por otra cuenta" },
    { nro: "E5", concepto: "Sueldos de empleados de MSA pagados", registrado: sueldosMSA, deDondeRegistrado: "pagos de sueldo (Sueldos) de empleados de MSA (los compartidos «MSA/PAM/MA» los paga MSA)", banco: { codigos: ["D5"], lado: "egr" },
      explica: "los sueldos de otras empresas pagados por MSA (van a la cuenta con el socio) y lo pagado por caja" },
    { nro: "E6", concepto: "Retiros y aportes de socios (templates de distribución de MSA)", registrado: tplTipo("distribucion"), deDondeRegistrado: "cuotas de MSA de tipo distribución", banco: { codigos: ["D7"], lado: "neto" },
      explica: "lo pagado desde otra cuenta o caja; los retiros directos sin template están en D15" },
    { nro: "E7", concepto: "Consumos de la tarjeta (resumen VISA MSA)", registrado: consumosVisa, deDondeRegistrado: "movimientos del resumen de la VISA MSA (sin el pago ni el total)", banco: { codigos: ["D8"], lado: "egr" },
      explica: "el saldo de la tarjeta al inicio y al cierre (se paga el mes siguiente)" },
  ] as any[]
  // 💰 etapa 4: por dónde se pagó / cobró cada comprobante del ejercicio (todas las cuentas de las tres empresas, la tarjeta incluida)
  const delEj = (xs: any[]) => xs.filter(x => mesesEj.has(x.subdiario)).map(x => ({ id: String(x.id), fuente: String(x.fuente), total: conSigno(x), fecha: x.fecha,
    ficha: `${x.denominacion} (CUIT ${x.cuit}) · tipo ${x.tipo ?? ""} ${x.punto_venta ?? ""}-${x.numero ?? ""} · ${x.fuente}` }))
  const plata = new Set(rs.map(r => r.cuenta)), esTarjeta = (c: string) => /visa|tarjeta/i.test(c)
  const movsCompra = (ex.movimientos as any[]).filter(m => m.comprobanteArcaId).map(m => ({ id: String(m.comprobanteArcaId), cuenta: m.cuenta, titular: m.titular, importe: r2(m.debitos - m.creditos) }))
  const movsVenta = (ex.movimientos as any[]).filter(m => m.comprobanteVentaId).map(m => ({ id: String(m.comprobanteVentaId), cuenta: m.cuenta, titular: m.titular, importe: r2(m.creditos - m.debitos) }))
  const etapa4 = {
    compras: puenteDeComprobantes(delEj(libro.compras), movsCompra, EMPRESA, plata, esTarjeta, "E2", { hecho: "Pagado", sin: "pago" }),
    ventas: puenteDeComprobantes(delEj(libro.ventas), movsVenta, EMPRESA, plata, esTarjeta, "E1", { hecho: "Cobrado", sin: "cobro" }),
  }
  for (const k of ["compras", "ventas"] as const) console.log(`etapa 4 · ${k}: ${etapa4[k].renglones.map(x => `${x.nro} ${x.valor}`).join(" · ")} · banco ${etapa4[k].enBanco}`)
  agregarHoja(wb as any, SOLAPA_PLATA, hojaControlPlata(rs, EMPRESA, ej.etiqueta, { desde: primerDiaDelEjercicio(ej), corte, hasta: ej.fechaCierre }, leidas.tablasQueFallaron, { e: etapa2, hojaDetalle: SOLAPA_PLATA_DET }, etapa3, etapa4),
    [28, 16, 16, 16, 16, 16, 14, 16, 16, 16, 16, 14, 34, 11, 50].map((ancho, i) => (i >= 1 && i <= 11 ? { ancho, z: "#,##0.00" } : { ancho })) as any)
  agregarHoja(wb as any, SOLAPA_PLATA_FAC, hojaFacturasPuente(etapa4.compras.casos, etapa4.ventas.casos, EMPRESA, ej.etiqueta),
    [7, 12, 70, 11, 18, 18, 16, 50].map((ancho, i) => (i >= 4 && i <= 6 ? { ancho, z: "#,##0.00" } : { ancho })) as any)
  agregarHoja(wb as any, SOLAPA_PLATA_DET, hojaDetalleEtapa2(etapa2, EMPRESA, ej.etiqueta),
    [7, 34, 18, 11, 40, 15, 15, 7, 44, 60, 26, 14, 12].map((ancho, i) => (i === 5 || i === 6 ? { ancho, z: "#,##0.00" } : { ancho })) as any)
  for (const [k, x] of etapa2.pesos) console.log(`etapa 2 · ${k}: ing ${r2(x.ing1 + x.ing2)} egr ${r2(x.egr1 + x.egr2)} (${x.n})`)
  for (const x of etapa3) console.log(`etapa 3 · ${x.nro}: registrado ${x.registrado}`)
  for (const r of rs) console.log(`plata · ${r.cuenta}: ${r.inicio} + ${r2(r.ing1 + r.ing2)} − ${r2(r.egr1 + r.egr2)} = ${r2(r.inicio + r.ing1 + r.ing2 - r.egr1 - r.egr2)} · planilla ${r.extractoFin} · saltos ${r.saltos.length} (${r.ordenadoPor})`)
}
// 📋 --revisar: la solapa «Datos a revisar» (cada punto de la revisión de datos con su contexto), antes del Índice
if (process.argv.includes("--revisar")) {
  const solapaDe = (c: any) => { const r = String(c.responsable ?? "").split("/")[0].trim().toUpperCase(); const n = nombreSolapaGrupo({ responsable: r, agrupadora: (c.agrupadoraTemplate ?? "").trim() || SIN_GRUPO }, "H"); return wb.SheetNames.includes(n) ? n : "" }
  // 🔗 la primera fila de una solapa cuyo detalle cumple la condición (por los nombres del encabezado del detalle)
  const filaDe = (solapa: string, cumple: (f: Record<string, string>) => boolean) => {
    const ws = (wb as any).Sheets[solapa]; if (!ws) return 0
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, blankrows: true })
    const hi = rows.findIndex(r => Array.isArray(r) && r[0] === "Nro" && r.includes("Marca")); if (hi < 0) return 0
    const H = rows[hi].map((x: unknown) => String(x ?? ""))
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i]; if (!Array.isArray(r) || r[0] == null || r[0] === "") break
      if (cumple(Object.fromEntries(H.map((k: string, j: number) => [k, String(r[j] ?? "")])))) return i + 1
    }
    return 0
  }
  agregarHoja(wb as any, SOLAPA_DATOS, await armarDatosARevisar(sb, [...templates.detalle, ...(templates.aCuentaSocio ?? [])] as any, solapaDe, filaDe), ANCHOS_DATOS.map((ancho, i) => (i === 3 ? { ancho, z: "#,##0.00" } : { ancho })) as any)
  reordenarSolapas(wb as any, [SOLAPA_DATOS, ...wb.SheetNames.filter(n => n !== SOLAPA_DATOS)])
}
// 📝 --cambios: la solapa «Cambios de presentación» al final, con un link desde el Índice
if (process.argv.includes("--cambios")) {
  agregarHoja(wb as any, SOLAPA_CAMBIOS, CAMBIOS, ANCHOS_CAMBIOS.map((ancho, i) => (i >= 2 ? { ancho, z: "#,##0.00" } : { ancho })) as any)
  const ix: any = wb.Sheets["Índice"]
  if (ix && !ix.C3) ix.C3 = { t: "s", v: "💰 Control de la plata: tocá acá", l: { Target: `#'${SOLAPA_PLATA}'!A1` } }
  if (ix) ix.B3 = { t: "s", v: "📝 Qué cambió en la presentación (con ejemplos): tocá acá", l: { Target: `#'${SOLAPA_CAMBIOS}'!A1` } }
  if (ix && wb.SheetNames.includes(SOLAPA_DATOS)) ix.A3 = { t: "s", v: "📋 DATOS A REVISAR (DR1…DR10): tocá acá", l: { Target: `#'${SOLAPA_DATOS}'!A1` } }
  // JMS 09/11: las solapas del desarrollo en curso (que después se sacan) van ANTES del índice
  reordenarSolapas(wb as any, [...(wb.SheetNames.includes(SOLAPA_DATOS) ? [SOLAPA_DATOS] : []), SOLAPA_CAMBIOS, "Índice", SOLAPA_PLATA, SOLAPA_PLATA_DET, SOLAPA_PLATA_FAC, "H · Retiros y aportes", "Gastos Libertad", "Inconsistencias"])
}
fechasReales(wb as any)
let p = join(CARPETA, `H para auditar ${EMPRESA} ${ej.etiqueta.replace("/", "-")} (2026-11-07).xlsx`), v = 2
while (existsSync(p)) p = join(CARPETA, `H para auditar ${EMPRESA} ${ej.etiqueta.replace("/", "-")} (2026-11-07) v${v++}.xlsx`)
writeFileSync(p, await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wb as any)))  // como la app: [+] arriba, encabezados inmovilizados

// lo que dice, para el control a ojo
const a = [...templates.detalle, ...(templates.aCuentaSocio ?? [])].map((c: any) => ({ c, a: auditarCuota(c) }))
const cuenta = (re: RegExp) => a.filter(x => re.test(x.a.marca)).length
console.log(`cuotas ${a.length} · ✓ ${cuenta(/^✓/)} · 🔴 sin pagar ${cuenta(/SIN PAGAR/)} · 🟡 ${cuenta(/^🟡/)} · ⚪ ${cuenta(/^⚪/)} · ⚠️ código ${cuenta(/código esperado/)}`)
console.log(`con efecto (pagó otro): ${a.filter(x => esEfectoEntrePartes(x.a.efecto)).length}`)
const ef = new Map<string, number>(); for (const x of a) if (esEfectoEntrePartes(x.a.efecto)) ef.set(x.a.efecto, (ef.get(x.a.efecto) ?? 0) + 1)
for (const [k, n] of [...ef].sort((x, y) => y[1] - x[1])) console.log(`  ${n} × ${k}`)
console.log(`bancos sin leer: ${leido.tablasQueFallaron.join(", ") || "ninguno"} · solapas ${wb.SheetNames.length}`)
console.log(`📄 ${p}`)
