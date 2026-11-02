/**
 * 💳 Excel de trabajo — TARJETA VISA MA: lo que hay hoy y la propuesta para lo pendiente / a auditar (A-FEAT-1526, JMS 02/11:
 * «mejor dejame un excel con lo que hay hoy y tu propuesta de lo pendiente o audit. Yo te dejo mi contestación y lo hacés»).
 *
 *     npx tsx scripts/excel-tarjeta-ma-propuesta.mts      ← SÓLO LEE la base y escribe el Excel (nunca pisa uno existente)
 *
 * Solapas: Resumen (con CONTROL por fórmulas) · Detalle (todos los renglones de la tarjeta, gris = el resumen del banco,
 * azul = lo que tiene la app, verde = la propuesta, amarillo = para JMS) · Pagos (los dos controles de JMS por resumen:
 * 1 · consumos − bonificaciones = total del resumen; 2 · total del resumen = «SU PAGO» del siguiente = débito en Galicia MA).
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const n = (x: unknown) => Number(x) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const addDias = (f: string, d: number) => new Date(Date.parse(f) + d * 86400000).toISOString().slice(0, 10)

// ── Datos ────────────────────────────────────────────────────────────────────────────────────────────────
const { data: tj, error } = await sb.schema("ma").from("tarjeta_visa").select("*").order("fecha").order("orden")
if (error) throw error
const filas = (tj ?? []) as any[]
const { data: gal } = await sb.schema("ma").from("ma_galicia")
  .select("id,fecha,debitos,estado,categ,template_cuota_id,descripcion,comprobante_arca_id").ilike("descripcion", "PAGO TARJETA VISA%").order("fecha")
const debitosCA = (gal ?? []) as any[]

// Facturas vinculadas: pueden ser de MA o de MSA (DirecTV, Deheza)
const idsFc = [...new Set(filas.map(f => f.comprobante_arca_id).filter(Boolean))]
const facturas = new Map<string, any>()
for (const sch of ["ma", "msa", "pam"]) {
  const { data } = await sb.schema(sch).from("comprobantes_arca").select("id,fecha_emision,imp_total,denominacion_emisor,cuenta_contable,estado").in("id", idsFc)
  for (const f of data ?? []) facturas.set(f.id, { ...f, empresa: sch.toUpperCase() })
}
// Prosegur: todas sus facturas en MA, para la que no se ató por un centavo
const { data: fcProsegur } = await sb.schema("ma").from("comprobantes_arca").select("id,fecha_emision,imp_total").eq("cuit", "30709776564")
// Mimados: a qué otro movimiento quedó atada su factura
const fcMimados = filas.find(f => /^MIMADOS/i.test(f.descripcion) && f.estado === "auditar")?.comprobante_arca_id
const { data: otroMimados } = fcMimados
  ? await sb.schema("ma").from("ma_galicia").select("fecha,debitos,descripcion,estado").eq("comprobante_arca_id", fcMimados) : { data: [] }

// ── Pagos de tarjeta: los dos controles por resumen ─────────────────────────────────────────────────────
const resumenes = filas.filter(f => f.estado === "total").sort((a, b) => a.fecha_cierre.localeCompare(b.fecha_cierre))
const delResumen = (nr: string) => filas.filter(f => f.nro_resumen === nr && f.estado !== "total")
const usados = new Set<string>()
interface Pago { nr: string; cierre: string; venc: string; consumos: number; bonif: number; total: number; consumosUsd: number;
  suPago?: any; suPagoUsd?: any; debito?: any; debitoUsd?: any }
const pagos: Pago[] = resumenes.map((r, i) => {
  const rows = delResumen(r.nro_resumen)
  const noPago = rows.filter(x => !/^SU PAGO/i.test(x.descripcion))
  const sig = resumenes[i + 1] ? delResumen(resumenes[i + 1].nro_resumen) : []
  const total = n(r.debitos)
  const p: Pago = { nr: r.nro_resumen, cierre: r.fecha_cierre, venc: r.fecha_vencimiento, total,
    consumos: r2(noPago.reduce((t, x) => t + n(x.debitos), 0)), bonif: r2(noPago.reduce((t, x) => t + n(x.creditos), 0)),
    consumosUsd: r2(noPago.reduce((t, x) => t + n(x.debitos_usd) - n(x.creditos_usd), 0)) }
  // «SU PAGO» del resumen siguiente: uno o varios que suman el total
  const suPagos = sig.filter(x => /^SU PAGO EN PESOS/i.test(x.descripcion))
  p.suPago = suPagos.length ? { filas: suPagos, importe: r2(suPagos.reduce((t, x) => t + n(x.creditos), 0)) } : undefined
  p.suPagoUsd = sig.find(x => /^SU PAGO EN USD/i.test(x.descripcion))
  // Débitos en Galicia MA entre el cierre y el vencimiento + 10 días: los que suman el total (en pesos)
  const ventana = debitosCA.filter(d => !usados.has(d.id) && d.fecha >= p.cierre && d.fecha <= addDias(p.venc, 10))
  const exacto = ventana.find(d => Math.abs(n(d.debitos) - total) < 0.01)
  let elegidos: any[] = exacto ? [exacto] : []
  if (!exacto && suPagos.length > 1) {
    const porPago = suPagos.map(s => ventana.find(d => Math.abs(n(d.debitos) - n(s.creditos)) < 0.01 && !usados.has(d.id)))
    if (porPago.every(Boolean)) elegidos = porPago as any[]
  }
  elegidos.forEach(d => usados.add(d.id))
  p.debito = elegidos.length ? { filas: elegidos, importe: r2(elegidos.reduce((t, d) => t + n(d.debitos), 0)) } : undefined
  if (p.consumosUsd > 0 && elegidos.length) {
    const otro = debitosCA.find(d => !usados.has(d.id) && elegidos.some(e => e.fecha === d.fecha))
    if (otro) { p.debitoUsd = otro; usados.add(otro.id) }
  }
  return p
})
const pagoDeFila = new Map<string, Pago>()
for (const p of pagos) for (const s of p.suPago?.filas ?? []) pagoDeFila.set(s.id, p)
const pagoUsdDeFila = new Map<string, Pago>()
for (const p of pagos) if (p.suPagoUsd) pagoUsdDeFila.set(p.suPagoUsd.id, p)

// ── Propuesta por renglón ────────────────────────────────────────────────────────────────────────────────
interface Prop { grupo: string; accion: string; cuenta?: string; contable?: string; porque: string }
function propuesta(f: any): Prop | null {
  const d = String(f.descripcion ?? "")
  const fc = f.comprobante_arca_id ? facturas.get(f.comprobante_arca_id) : null
  const imp = n(f.debitos)
  // Prosegur va siempre: también los conciliados (cuenta y LIB)
  if (/PROSEGUR/i.test(d)) {
    const lib = { cuenta: "SEGURIDAD Y ALARMA", contable: "LIB" }
    if (fc && Math.abs(n(fc.imp_total) - imp) < 0.01)
      return { grupo: "Prosegur → LIB", ...lib, accion: f.estado === "conciliado" ? "Ya conciliado: ponerle la cuenta y el contable LIB" : "Confirmar contra su factura (coincide el importe)",
        porque: `Factura MA ${dmy(fc.fecha_emision)} por ${plata(n(fc.imp_total))}. JMS: «contra sus facturas, que coincidan, y forman parte de LIB»` }
    const cand = (fcProsegur ?? []).find((x: any) => Math.abs(n(x.imp_total) - imp) <= 0.01 && Math.abs(Date.parse(x.fecha_emision) - Date.parse(f.fecha)) < 20 * 86400000)
    if (cand) return { grupo: "Prosegur → LIB", ...lib, accion: `Atar a la factura del ${dmy(cand.fecha_emision)} (${plata(n(cand.imp_total))})`,
      porque: `Diferencia de ${plata(r2(n(cand.imp_total) - imp))}: el motor no la tomó por un centavo. ¿Va igual?` }
    return { grupo: "Prosegur → LIB", ...lib, accion: "Queda pendiente: no hay factura del mismo importe", porque: "JMS: sólo si coinciden" }
  }
  if (f.estado === "conciliado" || f.estado === "total") return null
  if (/^SU PAGO EN PESOS/i.test(d)) {
    const p = pagoDeFila.get(f.id)
    const ok1 = p && Math.abs(p.consumos - p.bonif - p.total) < 0.01
    const ok2 = p && p.suPago && p.debito && Math.abs(p.suPago.importe - p.total) < 0.01 && Math.abs(p.debito.importe - p.total) < 0.01
    return { grupo: "Pago de tarjeta", cuenta: "Tarjetas MA",
      accion: ok1 && ok2 ? `Conciliar junto con el débito de Galicia MA del ${p!.debito.filas.map((x: any) => dmy(x.fecha)).join(" + ")}` : "Revisar: algún control no cierra (ver solapa Pagos)",
      porque: p ? `Paga el resumen que cerró el ${dmy(p.cierre)} (total ${plata(p.total)}). Control 1 ${ok1 ? "✓" : "✗"} · control 2 ${ok2 ? "✓" : "✗"}` : "No se encontró el resumen que paga" }
  }
  if (/^SU PAGO EN USD/i.test(d)) {
    const p = pagoUsdDeFila.get(f.id)
    return { grupo: "Pago de tarjeta", cuenta: "Tarjetas MA", accion: "Cerrar como informativo ($ 0 en pesos)",
      porque: p?.debitoUsd ? `La parte en dólares (US$ ${n(f.creditos_usd)}) se pagó con el débito de Galicia MA del ${dmy(p.debitoUsd.fecha)} por ${plata(n(p.debitoUsd.debitos))}` : `US$ ${n(f.creditos_usd)}: no encontré el débito en pesos` }
  }
  if (/DIRECTV/i.test(d)) return { grupo: "DirecTV (factura de MSA)", accion: "Queda como está", porque: "JMS 02/11: «son las FC de MSA, por ahora no se pone nada»" }
  if (/^PRESTIGIO/i.test(d)) return { grupo: "Prestigio (en cuotas)", accion: "Queda pendiente", porque: imp > 100000
    ? "Cuota de 3 × $ 634.244,80 = factura MA 13/04 $ 1.902.734,40, pero el mismo día hay una nota de crédito por el total. Contra la facturación sólo si se aclara la NC"
    : "Cuota de 6 × $ 11.610,91 = $ 69.665,46 = factura 15/05 $ 221.484,50 − NC $ 151.819,04. Falta la cuota 6 en la tarjeta. Contra la facturación cuando estén las 6" }
  if (fc && fc.empresa === "MSA") return { grupo: "Factura de MSA pagada por MA", accion: "Lo ves vos: retiro (como propone el motor) o se deja",
    porque: `Factura MSA ${fc.denominacion_emisor} ${dmy(fc.fecha_emision)} ${plata(n(fc.imp_total))}. MSA no tiene ningún débito de ese importe (ni Galicia ni Visa MSA): la pagó MA` }
  if (/^MIMADOS/i.test(d)) {
    const o = (otroMimados ?? [])[0]
    return { grupo: "Confirmar (importe exacto)", accion: "Confirmar contra la tarjeta y SOLTAR el otro vínculo",
      porque: o ? `La factura también quedó atada a Galicia MA ${dmy(o.fecha)} «${o.descripcion}» por ${plata(n(o.debitos))} (${o.estado}): una extracción de efectivo, no es el pago` : "Doble vínculo" }
  }
  if (f.estado === "auditar" && /15 días/.test(f.motivo_revision ?? "")) return { grupo: "Confirmar (importe exacto)", accion: "Confirmar contra su factura",
    porque: `${fc ? `Factura ${fc.empresa} ${fc.denominacion_emisor} ${dmy(fc.fecha_emision)} ${plata(n(fc.imp_total))}` : ""}. Importe exacto; la fecha de la factura está a 15 días (normal en tarjeta)` }
  if (/^(DISCO|CENCOSUD|DIA TIENDA)/i.test(d)) return { grupo: "Consumo → Consumos", cuenta: "Consumos", accion: "Regla nueva → Consumos", porque: "Supermercado sin factura. JMS: «lo que es consumo, que vaya a consumo»" }
  if (/(EASY|SODIMAC|PINTURER)/i.test(d)) return { grupo: "Hogar / obra → aparte", cuenta: "(cuenta nueva a definir)", accion: "Regla nueva → cuenta aparte",
    porque: "JMS: «Easy, Sodimac deberían ir aparte». Falta el nombre de la cuenta: ¿«Mantenimiento hogar»? ¿es de Libertad?" }
  if (/(EST DE SERVICIO|AXION|SHELL|PARADOR SAN PEDRO|YPF|PUMA)/i.test(d)) return { grupo: "Combustible", cuenta: "COMBUSTIBLES Y LUBRICANTES", accion: "Regla nueva → Combustibles",
    porque: /PARADOR/i.test(d) ? "Parador San Pedro le factura a MSA, pero ninguna factura coincide con este importe" : "Mismo comercio que otros ya conciliados como combustible" }
  if (/VTV/i.test(d)) return { grupo: "Vehículo", cuenta: "AUTOMOTORES REP Y MANTENIMIENTO", accion: "Regla nueva → Automotores", porque: "VTV" }
  return { grupo: "A estudiar", accion: "A estudiar", porque: f.motivo_revision ?? "" }
}

// ── Libro ────────────────────────────────────────────────────────────────────────────────────────────────
const GRIS = "E7E6E6", AZUL = "DDEBF7", VERDE = "E2EFDA", AMARILLO = "FFF2CC"
const cab = (v: string, rgb: string) => ({ v, t: "s", s: { font: { bold: true }, fill: { fgColor: { rgb } }, alignment: { wrapText: true, vertical: "top" } } })
const num = (v: number) => ({ v, t: "n", z: "#,##0.00" })
const fx = (f: string, bold = false) => ({ f, t: "n", z: "#,##0.00", s: bold ? { font: { bold: true } } : undefined })

const COLS: [string, string, (f: any, p: Prop | null) => any][] = [
  ["Fecha", GRIS, f => dmy(f.fecha)], ["Descripción", GRIS, f => f.descripcion], ["Cuota", GRIS, f => f.cuota ?? ""],
  ["Comprobante", GRIS, f => f.comprobante ?? ""], ["Débitos $", GRIS, f => num(n(f.debitos))], ["Créditos $", GRIS, f => num(n(f.creditos))],
  ["Débitos US$", GRIS, f => num(n(f.debitos_usd))], ["Créditos US$", GRIS, f => num(n(f.creditos_usd))],
  ["Resumen", GRIS, f => f.nro_resumen ?? ""], ["Cierre", GRIS, f => dmy(f.fecha_cierre)], ["Adicional", GRIS, f => f.titular_adicional ?? f.tarjeta_adicional ?? ""],
  ["Ejercicio", AZUL, f => (f.fecha <= "2026-06-30" ? "25/26" : "26/27")],
  ["Estado app", AZUL, f => f.estado], ["Cuenta app", AZUL, f => f.categ ?? ""], ["Contable app", AZUL, f => f.contable ?? ""], ["Detalle app", AZUL, f => f.detalle ?? ""],
  ["Factura vinculada", AZUL, f => { const c = facturas.get(f.comprobante_arca_id); return c ? `${c.empresa} · ${c.denominacion_emisor} · ${dmy(c.fecha_emision)} · ${plata(n(c.imp_total))}` : "" }],
  ["Cuenta de la factura", AZUL, f => facturas.get(f.comprobante_arca_id)?.cuenta_contable ?? ""],
  ["Template", AZUL, f => (f.template_cuota_id ? "sí" : "")], ["Motivo del motor", AZUL, f => f.motivo_revision ?? ""],
  ["Propuesta: grupo", VERDE, (_f, p) => p?.grupo ?? "—"], ["Propuesta: qué hacer", VERDE, (_f, p) => p?.accion ?? ""],
  ["Propuesta: cuenta", VERDE, (_f, p) => p?.cuenta ?? ""], ["Propuesta: contable", VERDE, (_f, p) => p?.contable ?? ""],
  ["Propuesta: por qué", VERDE, (_f, p) => p?.porque ?? ""],
  ["JMS: OK / cambio", AMARILLO, () => ""], ["JMS: nota", AMARILLO, () => ""],
]
const L = (i: number) => XLSX.utils.encode_col(i)
const iCol = (t: string) => L(COLS.findIndex(c => c[0] === t))

const detalle = filas.filter(f => f.estado !== "total")
const props = detalle.map(f => propuesta(f))
const aoa: any[][] = [COLS.map(([t, c]) => cab(t, c))]
detalle.forEach((f, i) => aoa.push(COLS.map(([, , g]) => g(f, props[i]))))
const ult = aoa.length // última fila de datos (1-based)
aoa.push([])
const sub: any[] = COLS.map(() => "")
sub[1] = { v: "Subtotal de lo filtrado", t: "s", s: { font: { bold: true } } }
for (const t of ["Débitos $", "Créditos $", "Débitos US$", "Créditos US$"]) sub[COLS.findIndex(c => c[0] === t)] = fx(`SUBTOTAL(9,${iCol(t)}2:${iCol(t)}${ult})`, true)
aoa.push(sub)
const wsD = XLSX.utils.aoa_to_sheet(aoa)
wsD["!autofilter"] = { ref: `A1:${L(COLS.length - 1)}${ult}` }
wsD["!cols"] = COLS.map(([t]) => ({ wch: /por qué|qué hacer|Factura vinc|Motivo/.test(t) ? 50 : /Descrip/.test(t) ? 32 : 13 }))
wsD["!freeze"] = { xSplit: 2, ySplit: 1 }

// Pagos
const P = ["Resumen", "Cierre", "Vencimiento", "Consumos $", "Bonificaciones $", "Total del resumen $", "CONTROL 1: consumos − bonif. − total",
  "«SU PAGO» del siguiente $", "Estado «SU PAGO»", "Débito en Galicia MA $", "Fecha débito", "Estado débito", "CONTROL 2a: SU PAGO − total", "CONTROL 2b: débito − total",
  "Consumos US$", "Débito Galicia MA por los US$ ($)", "Fecha", "Estado", "Propuesta"]
const aP: any[][] = [P.map((t, i) => cab(t, i >= 18 ? VERDE : i >= 6 && /CONTROL/.test(t) ? AMARILLO : GRIS))]
pagos.forEach((p, i) => {
  const r = i + 2
  const ok = Math.abs(p.consumos - p.bonif - p.total) < 0.01 && p.suPago && p.debito && Math.abs(p.suPago.importe - p.total) < 0.01 && Math.abs(p.debito.importe - p.total) < 0.01
  aP.push([p.nr, dmy(p.cierre), dmy(p.venc), num(p.consumos), num(p.bonif), num(p.total), fx(`D${r}-E${r}-F${r}`),
    p.suPago ? num(p.suPago.importe) : "no está (resumen siguiente sin cargar)", p.suPago ? [...new Set(p.suPago.filas.map((x: any) => x.estado))].join(" / ") : "",
    p.debito ? num(p.debito.importe) : "sin débito", p.debito ? p.debito.filas.map((x: any) => dmy(x.fecha)).join(" + ") : "",
    p.debito ? [...new Set(p.debito.filas.map((x: any) => x.estado))].join(" / ") : "",
    p.suPago ? fx(`H${r}-F${r}`) : "", p.debito ? fx(`J${r}-F${r}`) : "",
    num(p.consumosUsd), p.debitoUsd ? num(n(p.debitoUsd.debitos)) : "", p.debitoUsd ? dmy(p.debitoUsd.fecha) : "", p.debitoUsd?.estado ?? "",
    ok ? (p.suPago.filas.every((x: any) => x.estado === "conciliado") && p.debito.filas.every((x: any) => x.estado === "conciliado")
      ? "Ya conciliado de los dos lados" : "Los controles cierran → conciliar las dos puntas (débito de Galicia y «SU PAGO»)")
      : !p.suPago ? "Espera el resumen siguiente" : "No cerró: revisar"])
})
const wsP = XLSX.utils.aoa_to_sheet(aP)
wsP["!cols"] = P.map(t => ({ wch: t === "Propuesta" ? 60 : t === "Resumen" ? 22 : 15 }))

// Resumen con CONTROL
const D = "Detalle!"
const cE = iCol("Estado app"), cG = iCol("Propuesta: grupo"), cDe = iCol("Débitos $"), cCr = iCol("Créditos $"), cEj = iCol("Ejercicio")
const rng = (c: string) => `${D}$${c}$2:$${c}$${ult}`
const estados = [...new Set(detalle.map(f => f.estado))].sort()
const grupos = [...new Set(props.filter(Boolean).map(p => p!.grupo))].sort()
const aR: any[][] = [[{ v: "TARJETA VISA MA — lo que hay hoy y la propuesta (02/11/2026)", t: "s", s: { font: { bold: true, sz: 13 } } }],
  ["Leer: verde = mi propuesta · amarillo = para que contestes vos · la solapa Pagos tiene tus dos controles por resumen."], [],
  ["Por ESTADO en la app", "Ejercicio", "Movimientos", "Débitos $", "Créditos $"].map(t => cab(t, AZUL))]
const filaEstado0 = aR.length + 1
for (const ej of ["25/26", "26/27"]) for (const e of estados) {
  const k = `${rng(cE)},"${e}",${rng(cEj)},"${ej}"`
  aR.push([e, ej, { f: `COUNTIFS(${k})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${k})`), fx(`SUMIFS(${rng(cCr)},${k})`)])
}
const filaEstadoN = aR.length
aR.push([], ["Lo PENDIENTE y A AUDITAR, por PROPUESTA (más Prosegur conciliado, que lleva cuenta y LIB)", "Ejercicio", "Movimientos", "Débitos $", "Créditos $"].map(t => cab(t, VERDE)))
const filaG0 = aR.length + 1
for (const ej of ["25/26", "26/27"]) for (const g of grupos) {
  const k = `${rng(cG)},"${g}",${rng(cEj)},"${ej}"`
  aR.push([g, ej, { f: `COUNTIFS(${k})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${k})`), fx(`SUMIFS(${rng(cCr)},${k})`)])
}
const filaGN = aR.length
aR.push([], [cab("CONTROL", AMARILLO), "", cab("Movimientos", AMARILLO), cab("Débitos $", AMARILLO), cab("Créditos $", AMARILLO)])
const t0 = aR.length + 1
aR.push(["Todos los renglones del Detalle", "", { f: `COUNTA(${D}B2:B${ult})`, t: "n" }, fx(`SUM(${rng(cDe)})`), fx(`SUM(${rng(cCr)})`)])
aR.push(["− suma por estado", "", { f: `SUM(C${filaEstado0}:C${filaEstadoN})`, t: "n" }, fx(`SUM(D${filaEstado0}:D${filaEstadoN})`), fx(`SUM(E${filaEstado0}:E${filaEstadoN})`)])
aR.push([{ v: "= diferencia (tiene que dar 0)", t: "s", s: { font: { bold: true } } }, "", { f: `C${t0}-C${t0 + 1}`, t: "n" }, fx(`D${t0}-D${t0 + 1}`, true), fx(`E${t0}-E${t0 + 1}`, true)])
const kNoConc = `${rng(cE)},"<>conciliado"`
aR.push([], ["Pendientes + a auditar (todo el período)", "", { f: `COUNTIFS(${kNoConc})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${kNoConc})`), fx(`SUMIFS(${rng(cCr)},${kNoConc})`)])
const t1 = aR.length
const kProsC = `${rng(cG)},"Prosegur → LIB",${rng(cE)},"conciliado"`
aR.push(["+ Prosegur ya conciliado (sólo cuenta y LIB)", "", { f: `COUNTIFS(${kProsC})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${kProsC})`), fx(`SUMIFS(${rng(cCr)},${kProsC})`)])
aR.push(["− suma por propuesta", "", { f: `SUM(C${filaG0}:C${filaGN})`, t: "n" }, fx(`SUM(D${filaG0}:D${filaGN})`), fx(`SUM(E${filaG0}:E${filaGN})`)])
aR.push([{ v: "= sin propuesta (tiene que dar 0)", t: "s", s: { font: { bold: true } } }, "", { f: `C${t1}+C${t1 + 1}-C${t1 + 2}`, t: "n" }, fx(`D${t1}+D${t1 + 1}-D${t1 + 2}`, true), fx(`E${t1}+E${t1 + 1}-E${t1 + 2}`, true)])
aR.push([], ["Pagos de tarjeta — tus dos controles", "", "Resúmenes", "Diferencias ≠ 0"].map(t => cab(t, AMARILLO)))
const nP = pagos.length + 1
aR.push(["Control 1: consumos − bonificaciones = total del resumen", "", pagos.length, { f: `COUNTIF(Pagos!G2:G${nP},"<>0")`, t: "n" }])
aR.push(["Control 2a: «SU PAGO» del siguiente = total", "", pagos.filter(p => p.suPago).length, { f: `COUNTIFS(Pagos!M2:M${nP},"<>0",Pagos!M2:M${nP},"<>")`, t: "n" }])
aR.push(["Control 2b: débito en Galicia MA = total", "", pagos.filter(p => p.debito).length, { f: `COUNTIFS(Pagos!N2:N${nP},"<>0",Pagos!N2:N${nP},"<>")`, t: "n" }])
const wsR = XLSX.utils.aoa_to_sheet(aR)
wsR["!cols"] = [{ wch: 62 }, { wch: 10 }, { wch: 13 }, { wch: 16 }, { wch: 16 }]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, wsR, "Resumen")
XLSX.utils.book_append_sheet(wb, wsD, "Detalle")
XLSX.utils.book_append_sheet(wb, wsP, "Pagos")
fechasReales(wb as any)

const DIR = join("- Comunicacion JMS Claude - Archivos", "Balance", "Excels trabajando con claude")
let destino = ""
for (let v = 1; ; v++) {
  destino = join(DIR, `Tarjeta VISA MA - hoy y propuesta (2026-11-02)${v > 1 ? ` v${v}` : ""}.xlsx`)
  if (!existsSync(destino)) break
}
XLSX.writeFile(wb, destino)

// Consola: el mismo control, para verificar antes de entregar
const cuenta = (pred: (p: Prop | null, f: any) => boolean) => detalle.filter((f, i) => pred(props[i], f)).length
console.log(`Detalle: ${detalle.length} renglones · resúmenes: ${pagos.length}`)
console.log(`Pendiente/auditar: ${cuenta((_p, f) => f.estado !== "conciliado")} · sin propuesta entre ellos: ${cuenta((p, f) => f.estado !== "conciliado" && !p)}`)
for (const g of grupos) console.log(`  ${g}: ${cuenta(p => p?.grupo === g)} (25/26: ${cuenta((p, f) => p?.grupo === g && f.fecha <= "2026-06-30")})`)
for (const p of pagos) console.log(`  ${p.nr} ${dmy(p.cierre)} c1=${r2(p.consumos - p.bonif - p.total)} suPago=${p.suPago?.importe ?? "—"} débito=${p.debito?.importe ?? "—"} usd=${p.consumosUsd}→${p.debitoUsd?.debitos ?? "—"}`)
console.log(`\n✅ ${destino}`)
