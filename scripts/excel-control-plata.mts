/**
 * 💰 CONTROL DE LA PLATA — MSA, mes por mes (A-FEAT-1533, primera etapa). SÓLO LEE la base.
 *
 *     npx tsx scripts/excel-cuenta-socio.mts --socio MA ; npx tsx scripts/excel-cuenta-socio.mts --socio PAM   (dejan sus datos)
 *     npx tsx scripts/excel-control-plata.mts
 *
 * JMS 03/11: «quiero ver todas las ventas, todas las compras y ver si cierra contra los cobros y egresos… libro diario de ventas y
 * compras y templates… sueldos lo cuento como template… pones los saldos y cierra o no cierra… ideal mes a mes… el dashboard no:
 * el diario y los templates». Facturas por su TOTAL (lo que se cobra o paga); templates por mes de pago.
 *
 * BLOQUE 1 (esta corrida): lo facturado del mes contra lo que se movió la plata, y la diferencia por mes. Lo que explica la diferencia
 * se suma por bloques, validando con JMS: primero lo que ya dice el banco (FCI, extracciones a caja); después clientes, proveedores,
 * tarjeta, retenciones y diferencia de cambio.
 *  · Ventas y compras: el LIBRO DIARIO del balance (`armarLibroDiario`), por su subdiario (mes contable), TOTAL; las NC restan.
 *  · Templates: cuotas de responsable MSA pagadas (por mes de pago), sin los financieros (plata que cambia de lugar) ni las distribuciones
 *    (retiros: van en la cuenta del socio).
 *  · Sueldos: los pagos a empleados de MSA (los de MA pagados por MSA ya están en la cuenta con MA).
 *  · Libertad: el 50% de MSA es gasto; lo que MSA pagó de más o de menos va en las cuentas con MA y PAM (reparto entre tres).
 *  · Socios: la cuenta MSA↔MA y MSA↔PAM (scripts/excel-cuenta-socio.mts), + = retiró.
 *  · Plata: el saldo de cada cuenta al último movimiento del mes — Galicia, Santander, Provincia (pesos) y la CC en dólares × TC.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"
import { armarEjercicio } from "../lib/balance/ejercicio"
import { armarLibroDiario, desdeArca, desdeHistorico, desdeVenta } from "../lib/balance/libro-diario"
import { PRESENTADO_ARCA_COMPRAS } from "../lib/balance/presentado-arca"
import { desdeCuota } from "../lib/balance/templates-libro"
import { agregarHoja } from "../lib/balance/export-libro-diario"

const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const MESES = ["2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"]
const ROT = ["jul-25","ago-25","sep-25","oct-25","nov-25","dic-25","ene-26","feb-26","mar-26","abr-26","may-26","jun-26"]
const r2 = (x: number) => Math.round(x * 100) / 100
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude", HOY = "2026-11-03"
const finDeMes = (m: string) => { const [a, mm] = m.split("-").map(Number); return new Date(Date.UTC(a, mm, 0)).toISOString().slice(0, 10) }
const NC = new Set([3, 8, 13, 53, 113, 203, 208, 213])
async function todo(q: (d: number, h: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break }
  return out
}
const porMes = () => MESES.map(() => 0)

// ── 1 · Ventas y compras: el libro diario del balance
const ej = armarEjercicio(2026, 6), anios = [2025, 2026, 2027]
const [arca, historico, ventasRaw] = await Promise.all([
  todo((d, h) => sb.schema("msa").from("comprobantes_arca").select("*").in("año_contable", anios).order("id").range(d, h)),
  todo((d, h) => sb.schema("msa").from("comprobantes_historico").select("*").in("anio_contable", anios).order("id").range(d, h)),
  todo((d, h) => sb.schema("msa").from("comprobantes_venta").select("*").in("año_contable", anios).order("id").range(d, h)),
])
const libro = armarLibroDiario([...arca.map(desdeArca), ...historico.map(desdeHistorico)], ventasRaw.map(desdeVenta), ej, PRESENTADO_ARCA_COMPRAS.MSA)
const conSigno = (a: { tipo: number | null; total: number }) => (a.tipo != null && NC.has(a.tipo) ? -Math.abs(a.total) : a.total)
const ventas = porMes(), compras = porMes()
for (const a of libro.ventas) { const j = MESES.indexOf(a.subdiario); if (j >= 0) ventas[j] += conSigno(a) }
for (const a of libro.compras) { const j = MESES.indexOf(a.subdiario); if (j >= 0) compras[j] += conSigno(a) }

// ── 2 · Templates de MSA pagados (mes de pago), sin financieros ni distribuciones
const plan = await todo((d, h) => sb.from("cuentas_contables").select("categ, tipo").order("categ").range(d, h))
const tipoDeCateg = Object.fromEntries(plan.map((p: any) => [p.categ, p.tipo]))
const crudas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura")
  .select("*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable, tipo, cuenta_agrupadora)")
  .gte("fecha_estimada", "2024-06-01").order("id").range(d, h))
const IMPAGOS = new Set(["pendiente", "pagar", "preparado", "programado", "desactivado"])
const templates = porMes(); const tplPorNombre = new Map<string, number[]>(); const tplFuera = new Map<string, { tipo: string; total: number }>()
for (const f of crudas) {
  const c = desdeCuota(f, tipoDeCateg as any)
  if ((c.responsable || "").split("/")[0].trim().toUpperCase() !== "MSA") continue
  if (IMPAGOS.has(String(c.estado).toLowerCase()) || !c.fecha) continue
  const j = MESES.indexOf(c.fecha.slice(0, 7)); if (j < 0) continue
  if (c.tipo === "financiero" || c.tipo === "distribucion" || c.tipo === "NO") { const k = `${c.concepto} [${c.tipo}]`; const x = tplFuera.get(k) ?? { tipo: String(c.tipo), total: 0 }; x.total = r2(x.total + c.monto); tplFuera.set(k, x); continue }
  templates[j] += c.monto
  const v = tplPorNombre.get(c.concepto) ?? porMes(); v[j] += c.monto; tplPorNombre.set(c.concepto, v)
}

// ── 3 · Sueldos pagados a empleados de MSA
const empleados = new Map((await todo((d, h) => sb.from("sueldos_empleados").select("id, nombre, empresa").order("id").range(d, h))).map((e: any) => [e.id, e]))
const pagos = await todo((d, h) => sb.from("sueldos_pagos").select("id, empleado_id, fecha, monto, estado").gte("fecha", "2025-07-01").lte("fecha", "2026-06-30").order("id").range(d, h))
const sueldos = porMes()
for (const p of pagos) { const e: any = empleados.get(p.empleado_id); if (!e || String(e.empresa).toUpperCase() !== "MSA" || String(p.estado) === "programado") continue
  const j = MESES.indexOf(String(p.fecha).slice(0, 7)); if (j >= 0) sueldos[j] += Number(p.monto) || 0 }

// ── 4 · Socios y Libertad (de los scripts de las cuentas con MA y PAM)
const leerSocio = (s: string) => { const p = join(CARPETA, "datos", `cuenta-socio-${s}.json`); if (!existsSync(p)) throw new Error(`Falta ${p}: correr scripts/excel-cuenta-socio.mts --socio ${s}`); return JSON.parse(readFileSync(p, "utf8")) }
const sMA = leerSocio("MA"), sPAM = leerSocio("PAM")
const socioMA: number[] = sMA.cuenta, socioPAM: number[] = sPAM.cuenta, lib50: number[] = sMA.libertad50MSA

// ── 5 · La plata: saldo al último movimiento de cada mes
const cot = await todo((d, h) => sb.from("cotizaciones").select("fecha, compra, venta").eq("serie", "dolar_bna_divisas").order("fecha").range(d, h))
const tcAl = (f: string) => { let tc: any = null; for (const c of cot) { if (String(c.fecha) <= f) tc = c; else break } return tc ? Number(tc.compra || tc.venta) : null }
const CUENTAS = [{ s: "public", t: "msa_galicia", n: "Galicia MSA" }, { s: "msa", t: "santander", n: "Santander MSA" }, { s: "msa", t: "provincia", n: "Provincia MSA" }, { s: "msa", t: "cc_usd", n: "CC dólares MSA (US$ × TC)", usd: true }]
type Mov = { fecha: string; orden: number; saldo: number; deb: number; cred: number; desc: string; categ: string; cp: string }
const saldosCuenta: { n: string; inicio: number; fin: number[]; usd?: boolean; finUsd?: number[] }[] = []
const fci = porMes(), caja = porMes()
for (const c of CUENTAS) {
  const rows: any[] = await todo((d, h) => (c.s === "public" ? sb.from(c.t) : sb.schema(c.s).from(c.t)).select("fecha, orden, saldo, debitos, creditos, descripcion, categ, comprobantes_pagados").lte("fecha", "2026-06-30").order("id").range(d, h))
  const todos: (Mov & { conSaldo: boolean })[] = rows.map(r => ({ fecha: String(r.fecha).slice(0, 10), orden: Number(r.orden) || 0, saldo: Number(r.saldo) || 0, conSaldo: r.saldo != null,
    deb: Number(r.debitos) || 0, cred: Number(r.creditos) || 0, desc: String(r.descripcion ?? ""), categ: String(r.categ ?? ""), cp: String(r.comprobantes_pagados ?? "") }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden)
  // Para el saldo, sólo los movimientos que lo traen (el 30/06/25 de la CC US$ no lo tiene); para FCI y caja, todos
  const ms = todos.filter(m => m.conSaldo)
  const hasta = (f: string) => ms.filter(m => m.fecha <= f)
  // saldo al 30/06/25: el último movimiento hasta esa fecha, o el saldo anterior al primero del ejercicio
  const antes = hasta("2025-06-30"), primero = ms.find(m => m.fecha >= "2025-07-01")
  const ini = antes.length ? antes[antes.length - 1].saldo : primero ? r2(primero.saldo - (primero.cred - primero.deb)) : 0
  const finUsd = MESES.map(m => { const h = hasta(finDeMes(m)); return h.length ? h[h.length - 1].saldo : ini })
  if (c.usd) {
    const tc = MESES.map(m => tcAl(finDeMes(m)) ?? 0), tc0 = tcAl("2025-06-30") ?? 0
    saldosCuenta.push({ n: c.n, inicio: r2(ini * tc0), fin: finUsd.map((v, j) => r2(v * tc[j])), usd: true, finUsd })
  } else saldosCuenta.push({ n: c.n, inicio: ini, fin: finUsd })
  if (!c.usd) for (const m of todos) {
    const j = MESES.indexOf(m.fecha.slice(0, 7)); if (j < 0) continue
    if (/fci|fondos? comun|fima/i.test(m.categ + " " + m.desc)) fci[j] += m.deb - m.cred          // suscripción (sale) − rescate (entra)
    else if (/^caja\b/i.test(m.cp) || /extracci/i.test(m.desc) || /^caja$/i.test(m.categ)) caja[j] += m.deb - m.cred
  }
}
const plataIni = r2(saldosCuenta.reduce((t, c) => t + c.inicio, 0))
const plataFin = MESES.map((_, j) => r2(saldosCuenta.reduce((t, c) => t + c.fin[j], 0)))
const deltaPlata = MESES.map((_, j) => r2(plataFin[j] - (j ? plataFin[j - 1] : plataIni)))

// ── 6 · El cuadro
const facturacion = MESES.map((_, j) => r2(ventas[j] - compras[j] - templates[j] - sueldos[j] - lib50[j] - socioMA[j] - socioPAM[j]))
const dif = MESES.map((_, j) => r2(facturacion[j] - deltaPlata[j]))
const resta = MESES.map((_, j) => r2(dif[j] - fci[j] - caja[j]))
const col = (i: number) => { let s = "", n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }
const C0 = 4 // columna E = jul-25 (A 1er sem · B 2do sem · C total · D concepto)
const h: unknown[][] = [["CONTROL DE LA PLATA — MSA, mes por mes — ejercicio 25/26 (bloque 1)"],
  ["Lo facturado del mes (libro diario + templates + sueldos + Libertad + socios) contra lo que se movió la plata. La diferencia, mes por mes, es lo que hay que explicar por bloques."],
  ["Facturas por su TOTAL (lo que se cobra o paga) · templates por mes de pago · + entra / − sale."], []]
const fila = (concepto: string, v: number[], estilo?: "total" | "ctrl" | "titulo") => {
  const n = h.length + 1
  const celdas = v.map(x => ({ t: "n", v: r2(x), z: '#,##0.00;[Red]-#,##0.00' }))
  h.push([{ t: "n", f: `SUM(${col(C0)}${n}:${col(C0 + 5)}${n})`, v: r2(v.slice(0, 6).reduce((a, b) => a + b, 0)), z: '#,##0.00;[Red]-#,##0.00' },
    { t: "n", f: `SUM(${col(C0 + 6)}${n}:${col(C0 + 11)}${n})`, v: r2(v.slice(6).reduce((a, b) => a + b, 0)), z: '#,##0.00;[Red]-#,##0.00' },
    { t: "n", f: `A${n}+B${n}`, v: r2(v.reduce((a, b) => a + b, 0)), z: '#,##0.00;[Red]-#,##0.00' },
    estilo === "ctrl" ? `▶ ${concepto}` : concepto, ...celdas])
}
const titulo = (t: string) => h.push(["", "", "", t])
h.push(["1er sem", "2do sem", "total", "Concepto", ...ROT])
titulo("A · SEGÚN LA FACTURACIÓN")
fila("+ Ventas facturadas (libro diario, total)", ventas)
fila("− Compras facturadas (libro diario, total)", compras.map(x => -x))
fila("− Templates de MSA pagados (sin financieros ni distribuciones)", templates.map(x => -x))
fila("− Sueldos pagados (empleados de MSA)", sueldos.map(x => -x))
fila("− Libertad: el 50% de MSA", lib50.map(x => -x))
fila("− Cuenta con MA (retiró + / aportó −, con Libertad)", socioMA.map(x => -x))
fila("− Cuenta con PAM (retiró + / aportó −, con Libertad)", socioPAM.map(x => -x))
fila("= Lo que tendría que haberse movido la plata según la facturación", facturacion, "total")
h.push([])
titulo("B · LA PLATA (saldos de los extractos al último movimiento del mes)")
for (const c of saldosCuenta) fila(`Saldo ${c.n}${c.usd ? " — al TC BNA divisas comprador del fin de mes" : ""}`, c.fin)
fila("= Plata al cierre del mes", plataFin, "total")
fila("Variación de la plata en el mes", deltaPlata, "total")
h.push(["", "", "", `Plata al 30/06/2025: ${plataIni.toLocaleString("es-AR", { minimumFractionDigits: 2 })} (${saldosCuenta.map(c => `${c.n} ${c.inicio.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`).join(" · ")})`])
h.push([])
titulo("C · LA DIFERENCIA — facturación − variación de la plata")
fila("Diferencia del mes", dif, "ctrl")
h.push([])
titulo("D · LO QUE YA EXPLICA EL BANCO (plata que salió de estas cuentas sin ser gasto)")
fila("Al fondo común de inversión (suscripciones − rescates)", fci)
fila("Extracciones a caja (efectivo)", caja)
fila("Diferencia que queda por explicar", resta, "ctrl")
h.push([])
titulo("E · PRÓXIMOS BLOQUES (a validar con JMS, de a uno)")
for (const t of ["Clientes: ventas facturadas que no se cobraron en el mes (o cobros de meses anteriores)", "Proveedores: compras facturadas que no se pagaron en el mes (o pagos de facturas anteriores) — el histórico jul–dic no tiene el pago atado",
  "Tarjeta: consumos del mes (ya restados como compra o template) contra el pago del resumen", "Retenciones que nos hicieron al cobrar (bajan el cobro, no son gasto)",
  "Diferencia de cambio de la cuenta en dólares", "Caja: lo gastado en efectivo (si está cargado en la caja) contra lo extraído", "Otras cuentas: Caja Sigot (feb–may), cuentas de MSA en otros bancos"]) h.push(["", "", "", `· ${t}`])
// Detalle de templates por nombre (para revisar el renglón)
const det: unknown[][] = [["TEMPLATES DE MSA PAGADOS, por template y mes (el renglón A · Templates)"], ["Total", "Template", ...ROT],
  ...[...tplPorNombre].sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)).map(([k, v]) => [r2(v.reduce((x, y) => x + y, 0)), k, ...v.map(r2)]), [],
  ["QUEDARON AFUERA (financieros: plata que cambia de lugar · distribuciones: retiros de socios, ya en sus cuentas)"], ["Total", "Template [tipo]"],
  ...[...tplFuera].sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total)).map(([k, x]) => [x.total, k])]

if (!existsSync(CARPETA)) mkdirSync(CARPETA, { recursive: true })
const nombre = (b: string) => { let p = join(CARPETA, `${b}.xlsx`), v = 2; while (existsSync(p)) p = join(CARPETA, `${b} v${v++}.xlsx`); return p }
const wb = XLSX.utils.book_new(); agregarHoja(wb, "Control de la plata", h); agregarHoja(wb, "Templates del renglón", det); fechasReales(wb as any)
const p = nombre(`Control de la plata MSA 25-26 (${HOY})`); XLSX.writeFile(wb, p)

const f = (v: number[]) => v.map(x => (x / 1e6).toFixed(1).padStart(7)).join(" ")
console.log(`meses:            ${MESES.map(m => m.slice(2).padStart(7)).join(" ")}`)
console.log(`ventas            ${f(ventas)}\ncompras           ${f(compras)}\ntemplates         ${f(templates)}\nsueldos           ${f(sueldos)}\nlib50             ${f(lib50)}\nsocio MA          ${f(socioMA)}\nsocio PAM         ${f(socioPAM)}`)
console.log(`= facturación     ${f(facturacion)}\nΔ plata           ${f(deltaPlata)}\nDIFERENCIA        ${f(dif)}\nFCI               ${f(fci)}\ncaja              ${f(caja)}\nRESTA             ${f(resta)}`)
console.log(`plata ini ${plataIni} · fin jun ${plataFin[11]} · ${saldosCuenta.map(c => `${c.n} ${c.inicio}→${c.fin[11]}`).join(" | ")}`)
console.log(`totales: ventas ${r2(ventas.reduce((a, b) => a + b))} compras ${r2(compras.reduce((a, b) => a + b))} templates ${r2(templates.reduce((a, b) => a + b))} sueldos ${r2(sueldos.reduce((a, b) => a + b))} · dif ${r2(dif.reduce((a, b) => a + b))} · resta ${r2(resta.reduce((a, b) => a + b))}`)
console.log(`📄 ${p}`)
