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
import { armarCuentasCorrientes, movimientosDeLosSocios, consumosDeTarjetaComoMovimientos, sueldosPendientesComoCompras, CUENTA_FACTURAS,
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
const cols = "id, fecha, debitos, creditos, descripcion, detalle, contable, comprobantes_pagados, estado, categ, sueldo_pago_id, template_cuota_id, cuit:leyendas_adicionales_2"
const conCodigo = await todo((d, h) => sb.from("msa_galicia").select(cols).gte("fecha", D).lte("fecha", H).not("contable", "is", null).order("id").range(d, h))
const pagosTj = await todo((d, h) => sb.from("msa_galicia").select(cols).gte("fecha", D).lte("fecha", H).is("contable", null).ilike("descripcion", "%visa%").order("id").range(d, h))
const cuotas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura").select("id, grupo_pago_id, egreso:egresos_sin_factura(nombre_referencia, cuenta_agrupadora)").order("id").range(d, h))
const grupoTpl = new Map<string, string>()
for (const c of cuotas) { const g = String(c.egreso?.cuenta_agrupadora || c.egreso?.nombre_referencia || "").trim(); if (!g) continue; grupoTpl.set(c.id, g); if (c.grupo_pago_id && !grupoTpl.has(c.grupo_pago_id)) grupoTpl.set(c.grupo_pago_id, g) }
const grupoDe = (m: any) => m.sueldo_pago_id ? "Sueldos" : (m.template_cuota_id && grupoTpl.get(m.template_cuota_id)) || String(m.categ ?? "").trim() || "Otros"
const msa: MovimientoParaCC[] = [...conCodigo, ...pagosTj].map((m: any) => ({ ...m, cuenta: "MSA Galicia cta cte", grupo: grupoDe(m) }))

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

// ── El Excel: resumen + el detalle de cada socio, POR GRUPO
const f: unknown[][] = [["PROTOTIPO — 14.1 Cuentas con socios, detalle ordenado POR GRUPO (para ver; no cambia la app)"],
  ["En cada cuenta: los movimientos juntos por GRUPO (columna «Grupo», igual en todo el grupo) y por fecha adentro. Grupo = Sueldos si está vinculado a un pago de Sueldos · si no, la agrupadora o el template · si no, la CATEG · si no, «Otros»."],
  ["Saldos de inicio: los de tu Excel (JMS −15.000.000 · AMS −10.500.000 · MA y PAM 0). DEBE = MSA le pagó o él retiró · HABER = MSA le debe más."], [],
  ["Contraparte", "Saldo al INICIO", "Facturado / sueldo", "Pagado / cobrado", "Movimiento del ejercicio", "SALDO AL CIERRE"],
  ...cuentas.map(c => [c.contraparte.nombre, c.saldoInicio, c.resumen.totalComprado, c.resumen.totalPagado, c.resumen.saldo, c.saldoAlCierre])]
const ORDEN = [CUENTA_FACTURAS, "MSA Galicia cta cte", "MSA VISA"]
const rango = (b: string) => { const i = ORDEN.indexOf(b); return i < 0 ? 99 : i }
for (const c of cuentas) {
  if (!c.resumen.asientos.length) continue
  f.push([], [], [`DETALLE — ${c.contraparte.nombre}`], ["Cuenta", "Fecha", "Qué es", "Debe", "Haber", "Saldo acumulado", "Grupo", "Concepto", "Otra punta"])
  const cuentaDe = (x: { cuenta?: string }) => x.cuenta ?? "MSA Galicia cta cte"
  let saldo = c.saldoInicio, tD = 0, tH = 0
  f.push(["Saldo al inicio", "", "", "", "", r2(saldo)])
  for (const b of [...new Set(c.resumen.asientos.map(cuentaDe))].sort((a, b) => rango(a) - rango(b) || a.localeCompare(b, "es"))) {
    f.push([`▸ ${b}`])
    let dB = 0, hB = 0
    const del = c.resumen.asientos.filter(x => cuentaDe(x) === b)
      .sort((x, y) => String(x.grupo ?? "").localeCompare(String(y.grupo ?? ""), "es") || x.fecha.localeCompare(y.fecha))
    for (const x of del) {
      const d = x.importe < 0 ? -x.importe : 0, h = x.importe > 0 ? x.importe : 0
      dB += d; hB += h; saldo += x.importe
      f.push([b, x.fecha, x.tipo === "compra" ? "nos factura / sueldo" : x.tipo === "venta" ? "le facturamos" : x.importe > 0 ? "pagó por MSA / aportó" : "MSA le pagó / retiró",
        d ? r2(d) : "", h ? r2(h) : "", r2(saldo), x.grupo ?? (b === CUENTA_FACTURAS ? "Facturas y sueldo" : "Otros"), x.concepto, x.otraPunta ?? ""])
    }
    tD += dB; tH += hB
    f.push([`Subtotal ${b}`, "", "", r2(dB), r2(hB)])
  }
  f.push(["SALDO AL CIERRE (del detalle)", "", "", r2(tD), r2(tH), r2(saldo), Math.abs(r2(saldo) - c.saldoAlCierre) < 0.01 ? "✓ cuadra con el resumen" : `🛑 NO CUADRA (${c.saldoAlCierre})`])
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
