/**
 * 🧪 PROTOTIPO del detalle de la 14.1 ordenado POR GRUPO (JMS 07/11: «me lo armás en prototipo y me lo dejás para verlo»). SÓLO LEE.
 * No cambia la app: arma el mismo papel con los datos reales y un Excel aparte, para ver si el orden se lee «suave».
 *
 *     npx tsx scripts/prototipo-14-1-por-grupo.mts
 *
 * El GRUPO de cada movimiento (columna a la derecha, igual en todo el grupo; sin subtítulos por grupo — JMS):
 *   1. vinculado a un pago de Sueldos → «Sueldos» · 2. con template → su agrupadora (o el template) · 3. si no, su CATEG · 4. si no, «Otros».
 * Dentro de cada cuenta: por grupo y, dentro del grupo, por fecha. Las cuentas siguen con su subtítulo y subtotal (eso ya estaba acordado).
 * Saldos de inicio: los de su Excel (JMS −15.000.000 · AMS −10.500.000 · MA y PAM 0). Fuera del prototipo, salen de la pantalla del balance.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { armarCuentasCorrientes, movimientosDeLosSocios, consumosDeTarjetaComoMovimientos, sueldosPendientesComoCompras, CUENTA_FACTURAS, CONTRAPARTES_DEL_BALANCE,
  type CuentaDelSocio, type MovimientoParaCC, type CompraParaCC, type SueldoParaCC, type ConsumoTarjeta } from "../lib/balance/cuentas-corrientes"
import { agregarHoja } from "../lib/balance/export-libro-diario"
import { fechasReales } from "../lib/excel/fechas-reales"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const D = "2025-07-01", H = "2026-06-30"
const MESES = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const r2 = (x: number) => Math.round(x * 100) / 100
async function todo(q: (d: number, h: number) => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break } return out }
const desde = (s: string, t: string) => (s === "public" ? sb.from(t) : sb.schema(s).from(t))

// ── Lo que la empresa le debe: facturas (ARCA y el histórico) y el sueldo pendiente — como la pantalla del balance
const arca = await todo((d, h) => sb.schema("msa").from("comprobantes_arca").select("id, fecha_emision, punto_venta, numero_desde, imp_total, cuit, denominacion_emisor").gte("fecha_emision", D).lte("fecha_emision", H).order("id").range(d, h))
const hist = await todo((d, h) => sb.schema("msa").from("comprobantes_historico").select("id, fecha, numero_desde, imp_total, denominacion_emisor").gte("fecha", D).lte("fecha", H).order("id").range(d, h))
const compras: CompraParaCC[] = [
  ...arca.map((a: any) => ({ id: a.id, fecha: a.fecha_emision, numero: `${a.punto_venta ?? ""}-${a.numero_desde ?? ""}`, total: Number(a.imp_total) || 0, cuit: a.cuit, denominacion: a.denominacion_emisor })),
  ...hist.map((a: any) => ({ id: a.id, fecha: a.fecha, numero: String(a.numero_desde ?? ""), total: Number(a.imp_total) || 0, cuit: null, denominacion: a.denominacion_emisor })),
]
const periodos = await todo((d, h) => sb.from("sueldos_periodos").select("*, empleado:sueldos_empleados(nombre, empresa, tipo_empleado, cuit_empleado)").in("anio", [2025, 2026]).order("id").range(d, h))
compras.push(...sueldosPendientesComoCompras(periodos as SueldoParaCC[], MESES))

// ── Galicia MSA con código, su GRUPO (sueldo → template → CATEG → Otros), y los pagos de la tarjeta
const cols = "id, fecha, debitos, creditos, descripcion, detalle, contable, comprobantes_pagados, estado, categ, sueldo_pago_id, template_cuota_id, cuit:leyendas_adicionales_2, benef:leyendas_adicionales_1"
const conCodigo = await todo((d, h) => sb.from("msa_galicia").select(cols).gte("fecha", D).lte("fecha", H).not("contable", "is", null).order("id").range(d, h))
const pagosTj = await todo((d, h) => sb.from("msa_galicia").select(cols).gte("fecha", D).lte("fecha", H).is("contable", null).ilike("descripcion", "%visa%").order("id").range(d, h))
const cuotas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura").select("id, grupo_pago_id, egreso:egresos_sin_factura(nombre_referencia, cuenta_agrupadora)").order("id").range(d, h))
const grupoTpl = new Map<string, string>()
for (const c of cuotas) { const g = String(c.egreso?.cuenta_agrupadora || c.egreso?.nombre_referencia || "").trim(); if (!g) continue; grupoTpl.set(c.id, g); if (c.grupo_pago_id && !grupoTpl.has(c.grupo_pago_id)) grupoTpl.set(c.grupo_pago_id, g) }
// (el grupo se define más abajo, cuando ya se sabe de quién es cada pago de sueldo)
// 👤 JMS 07/11: «hay cosas que les falta el detalle: beneficiario del pago». El empleado si es un pago de Sueldos; si no, el nombre del banco.
const empleadosFull = await todo((d, h) => sb.from("sueldos_empleados").select("id, nombre, cuit_empleado, empresa").order("id").range(d, h))
const empleados = new Map(empleadosFull.map((e: any) => [e.id, e.nombre]))
const cuitEmpleado = new Map(empleadosFull.map((e: any) => [e.nombre, String(e.cuit_empleado ?? "").replace(/\D/g, "")]))
const empresaEmpleado = new Map(empleadosFull.map((e: any) => [String(e.cuit_empleado ?? "").replace(/\D/g, ""), String(e.empresa ?? "")]))
const empleadoDePago = new Map<string, string>()
for (const g of await todo((d, h) => sb.from("sueldos_pagos").select("id, grupo_pago_id, empleado_id").order("id").range(d, h))) {
  const n = empleados.get(g.empleado_id); if (!n) continue; empleadoDePago.set(g.id, n); if (g.grupo_pago_id && !empleadoDePago.has(g.grupo_pago_id)) empleadoDePago.set(g.grupo_pago_id, n)
}
const conBeneficiario = (m: any) => { const b = (m.sueldo_pago_id && empleadoDePago.get(m.sueldo_pago_id)) || String(m.benef ?? "").trim()
  const base = String(m.detalle ?? "").trim() || String(m.descripcion ?? "").trim()
  return b && !base.toLowerCase().includes(b.toLowerCase().split(" ")[0]) ? `${base} → ${b}` : base }
const socioCuit = (contable: unknown) => CONTRAPARTES_DEL_BALANCE.find(c => c.etiquetasContable.some(e => e.toUpperCase() === String(contable ?? "").trim().toUpperCase()))?.cuit
const grupoDe = (m: any) => {
  if (m.sueldo_pago_id) { const emp = empleadoDePago.get(m.sueldo_pago_id); return emp && cuitEmpleado.get(emp) !== socioCuit(m.contable) ? `Sueldo de ${emp}` : "Sueldos" }
  return (m.template_cuota_id && grupoTpl.get(m.template_cuota_id)) || String(m.categ ?? "").trim() || "Otros"
}
const msa: MovimientoParaCC[] = [...conCodigo, ...pagosTj].map((m: any) => ({ ...m, detalle: conBeneficiario(m), cuenta: "MSA Galicia cta cte", grupo: grupoDe(m) }))

const consumos: ConsumoTarjeta[] = (await todo((d, h) => sb.schema("msa").from("tarjeta_visa_business").select("fecha_vencimiento, descripcion, categ, contable, debitos, creditos, debitos_usd").eq("tipo_fila", "movimiento").gte("fecha_vencimiento", D).lte("fecha_vencimiento", H).order("id").range(d, h)))
  .map((x: any) => ({ vencimiento: x.fecha_vencimiento, descripcion: x.descripcion, categ: x.categ, contable: x.contable, debitos: Number(x.debitos ?? 0), creditos: Number(x.creditos ?? 0), debitosUsd: Number(x.debitos_usd ?? 0) }))
const porLaTarjeta = consumosDeTarjetaComoMovimientos(msa, consumos).map(m => ({ ...m, grupo: m.grupo || "Otros" }))

// ── Las cuentas de los socios
const CUENTAS = [["MA", "MA caja de ahorro", "ma", "ma_galicia", false], ["MA", "MA VISA", "ma", "tarjeta_visa", true], ["PAM", "PAM caja de ahorro", "public", "pam_galicia", false],
  ["PAM", "PAM cta cte", "public", "pam_galicia_cc", false], ["PAM", "PAM VISA", "pam", "tarjeta_visa", true]] as const
const socios: CuentaDelSocio[] = []
for (const [clave, nombre, s, t, tj] of CUENTAS) {
  const filas = await todo((d, h) => { let q = desde(s, t).select("id, fecha, debitos, creditos, descripcion, detalle, contable, comprobantes_pagados, estado, categ").gte("fecha", D).lte("fecha", H); if (tj) q = q.eq("tipo_fila", "movimiento"); return q.order("id").range(d, h) })
  socios.push({ clave, nombre, movimientos: filas.map((m: any) => ({ ...m, grupo: String(m.categ ?? "").trim() || "Otros" })) })
}
const conSocios = movimientosDeLosSocios([...msa, ...porLaTarjeta], socios)
const papel = armarCuentasCorrientes(compras, [], [...conSocios.msa, ...conSocios.delSocio], { JMS: -15000000, AMS: -10500000, MA: 0, PAM: 0 })
const cuentas = papel.cuentas.filter(c => c.contraparte.socio)

// ── El Excel, CON FÓRMULAS (JMS 07/11: «punto 1 eran las fórmulas»): saldo acumulado = anterior − Debe + Haber · subtotales = SUMA ·
// el cierre del detalle contra el SALDO AL CIERRE del resumen · el cheq de sueldos contra el módulo Sueldos.
const num = (fo: string, v: number) => ({ t: "n", f: fo, v: r2(v) })
const txt = (fo: string, v: string) => ({ t: "s", f: fo, v })
const f: unknown[][] = [["PROTOTIPO — 14.1 Cuentas con socios, detalle ordenado POR GRUPO (para ver; no cambia la app)"],
  ["En cada cuenta: los movimientos juntos por GRUPO (columna «Grupo», igual en todo el grupo) y por fecha adentro. Grupo = Sueldos si está vinculado a un pago de Sueldos · si no, la agrupadora o el template · si no, la CATEG · si no, «Otros»."],
  ["Saldos de inicio: los de tu Excel (JMS −15.000.000 · AMS −10.500.000 · MA y PAM 0). DEBE = MSA le pagó o él retiró · HABER = MSA le debe más. Todo con fórmulas."], [],
  ["Contraparte", "Saldo al INICIO", "Facturado / sueldo", "Pagado / cobrado", "Movimiento del ejercicio", "SALDO AL CIERRE"]]
const filaResumen = new Map<string, number>()
for (const c of cuentas) {
  const n = f.length + 1; filaResumen.set(c.contraparte.clave, n)
  f.push([c.contraparte.nombre, c.saldoInicio, c.resumen.totalComprado, c.resumen.totalPagado, c.resumen.saldo, num(`B${n}+E${n}`, c.saldoAlCierre)])
}
const ORDEN = [CUENTA_FACTURAS, "MSA Galicia cta cte", "MSA VISA"]
const rango = (b: string) => { const i = ORDEN.indexOf(b); return i < 0 ? 99 : i }
// el sueldo total de cada socio en el módulo Sueldos (por CUIT, los meses del ejercicio)
const sueldoTotal = new Map<string, number>()
for (const p of periodos as any[]) {
  const cuit = String(p.empleado?.cuit_empleado ?? "").replace(/\D/g, "")
  const c = cuentas.find(x => x.contraparte.cuit === cuit)
  if (c && MESES.includes(`${p.anio}-${String(p.mes).padStart(2, "0")}`)) sueldoTotal.set(c.contraparte.clave, r2((sueldoTotal.get(c.contraparte.clave) ?? 0) + (Number(p.bruto_calculado) || 0)))
}
for (const c of cuentas) {
  if (!c.resumen.asientos.length) continue
  f.push([], [], [`DETALLE — ${c.contraparte.nombre}`], ["Cuenta", "Fecha", "Qué es", "Debe", "Haber", "Saldo acumulado", "Grupo", "Concepto", "Otra punta"])
  const cuentaDe = (x: { cuenta?: string }) => x.cuenta ?? "MSA Galicia cta cte"
  let saldo = c.saldoInicio, tD = 0, tH = 0
  const nIni = f.length + 1
  f.push(["Saldo al inicio", "", "", "", "", num(`B${filaResumen.get(c.contraparte.clave)}`, saldo)])
  let ultSaldo = nIni
  const subtotales: number[] = []
  const primera = f.length + 2
  for (const b of [...new Set(c.resumen.asientos.map(cuentaDe))].sort((a, b) => rango(a) - rango(b) || a.localeCompare(b, "es"))) {
    f.push([`▸ ${b}`])
    let dB = 0, hB = 0
    const desdeB = f.length + 1
    const del = c.resumen.asientos.filter(x => cuentaDe(x) === b)
      .sort((x, y) => String(x.grupo ?? "").localeCompare(String(y.grupo ?? ""), "es") || x.fecha.localeCompare(y.fecha))
    for (const x of del) {
      const d = x.importe < 0 ? -x.importe : 0, h = x.importe > 0 ? x.importe : 0
      dB += d; hB += h; saldo += x.importe
      const n = f.length + 1
      f.push([b, x.fecha, x.tipo === "compra" ? "nos factura / sueldo" : x.tipo === "venta" ? "le facturamos" : x.importe > 0 ? "pagó por MSA / aportó" : "MSA le pagó / retiró",
        d ? r2(d) : "", h ? r2(h) : "", num(`F${ultSaldo}-D${n}+E${n}`, saldo), x.grupo ?? (b === CUENTA_FACTURAS ? "Facturas y sueldo" : "Otros"), x.concepto, x.otraPunta ?? ""])
      ultSaldo = n
    }
    const hastaB = f.length
    tD += dB; tH += hB
    subtotales.push(f.length + 1)
    f.push([`Subtotal ${b}`, "", "", num(`SUM(D${desdeB}:D${hastaB})`, dB), num(`SUM(E${desdeB}:E${hastaB})`, hB)])
  }
  const ultima = f.length, nR = filaResumen.get(c.contraparte.clave)!
  const nC = f.length + 1
  const cuadra = Math.abs(r2(saldo) - c.saldoAlCierre) < 0.01
  f.push(["SALDO AL CIERRE (del detalle)", "", "", num(subtotales.map(x => `D${x}`).join("+"), tD), num(subtotales.map(x => `E${x}`).join("+"), tH), num(`F${ultSaldo}`, saldo),
    txt(`IF(ABS(F${nC}-F${nR})<0.01,"✓ cuadra con el resumen","🛑 NO CUADRA con el resumen")`, cuadra ? "✓ cuadra con el resumen" : "🛑 NO CUADRA con el resumen")])
  // 👷 El cheq contra Sueldos (JMS 07/11: «sería ideal cruzarlo contra sueldos y que dé ok»): lo pagado como sueldo + lo pendiente = el sueldo total.
  const total = sueldoTotal.get(c.contraparte.clave)
  if (total) {
    const pagado = c.resumen.asientos.filter(x => x.grupo === "Sueldos" && x.importe < 0).reduce((t, x) => t - x.importe, 0)
    const pendiente = c.resumen.asientos.filter(x => x.tipo === "compra" && /^Sueldo /.test(x.concepto)).reduce((t, x) => t + x.importe, 0)
    f.push([], ["CHEQ CONTRA SUELDOS"])
    const n1 = f.length + 1
    f.push(["Pagado como sueldo (grupo «Sueldos» de este detalle)", "", "", num(`SUMIFS(D${primera}:D${ultima},G${primera}:G${ultima},"Sueldos")`, pagado)])
    f.push(["Sueldo pendiente al cierre (en «Facturas y sueldo»)", "", "", "", num(`SUMIFS(E${primera}:E${ultima},H${primera}:H${ultima},"Sueldo *")`, pendiente)])
    f.push(["Sueldo total del ejercicio en el módulo Sueldos", "", "", "", "", total])
    const dif = r2(pagado + pendiente - total)
    const empresa = empresaEmpleado.get(c.contraparte.cuit) ?? ""
    const varias = empresa.includes("/")
    f.push(["Diferencia (pagado + pendiente − sueldo total)", "", "", "", "", num(`D${n1}+E${n1 + 1}-F${n1 + 2}`, dif),
      txt(`IF(ABS(F${n1 + 3})<1,"✓ ok","${varias ? "no cierra acá: parte del sueldo lo pagan otras empresas" : "⚠️ no da: ver"}")`,
        Math.abs(dif) < 1 ? "✓ ok" : varias ? "no cierra acá: parte del sueldo lo pagan otras empresas" : "⚠️ no da: ver")])
    if (varias && Math.abs(dif) >= 1) f.push([`En Sueldos, ${c.contraparte.nombre} es empleado de «${empresa}»: el sueldo total es del grupo, y desde MSA se paga una parte. Para que cierre hay que sumar lo pagado desde PAM y MA (pendiente).`])
    console.log(`${c.contraparte.clave}: sueldos pagado ${r2(pagado)} + pendiente ${r2(pendiente)} vs total ${total} → dif ${dif}`)
  }
}
const wb = XLSX.utils.book_new()
agregarHoja(wb, "14.1 prototipo por grupo", f, [{ ancho: 24 }, { ancho: 12 }, { ancho: 22 }, { ancho: 16, z: '#,##0.00;(#,##0.00);"-"' }, { ancho: 16, z: '#,##0.00;(#,##0.00);"-"' },
  { ancho: 18, z: '#,##0.00;(#,##0.00);"-"' }, { ancho: 34 }, { ancho: 60 }, { ancho: 26 }] as any)
fechasReales(wb as any)
let p = join(CARPETA, "Prototipo 14.1 por grupo (2026-11-07).xlsx"), v = 2
while (existsSync(p)) p = join(CARPETA, `Prototipo 14.1 por grupo (2026-11-07) v${v++}.xlsx`)
XLSX.writeFile(wb, p)
for (const c of cuentas) console.log(`${c.contraparte.clave}: inicio ${c.saldoInicio} · cierre ${c.saldoAlCierre}`)
const g = new Map<string, number>(); for (const c of cuentas) for (const x of c.resumen.asientos) { const k = `${c.contraparte.clave} · ${x.cuenta ?? "MSA Galicia cta cte"} · ${x.grupo ?? "—"}`; g.set(k, (g.get(k) ?? 0) + 1) }
console.log([...g].map(([k, n]) => `${k} (${n})`).join("\n"))
console.log(`📄 ${p}`)
