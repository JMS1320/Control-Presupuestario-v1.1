/**
 * 💳 Excel de trabajo — TARJETA VISA de una empresa: lo que hay hoy y la propuesta para lo pendiente / a auditar
 * (A-FEAT-1526, JMS 02/11: «mejor dejame un excel con lo que hay hoy y tu propuesta de lo pendiente o audit»).
 *
 *     npx tsx scripts/excel-tarjeta-propuesta.mts --empresa MA     ← SÓLO LEE la base y escribe el Excel (nunca pisa uno existente)
 *     npx tsx scripts/excel-tarjeta-propuesta.mts --empresa PAM
 *     (--seco: no escribe el archivo, sólo muestra el control en la consola)
 *
 * Solapas: Resumen (con CONTROL por fórmulas) · Detalle (gris = el resumen del banco, azul = la app, verde = la propuesta,
 * amarillo = para JMS) · Pagos (los dos controles de JMS por resumen).
 *
 * Los dos controles (JMS 02/11: «que salga conciliado cuando coincide el importe contra los consumos que den ok, luego total
 * resumen contra debitado en la CA, y se conciliarían los 2»), generalizados para quien paga PARTE del resumen (PAM):
 *   1 · saldo anterior − pagos del período + consumos − bonificaciones = saldo del resumen
 *   2 · cada «SU PAGO EN PESOS» = un débito «PAGO TARJETA» del banco (mismo importe, ±5 días)
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"

const EMP = (process.argv[process.argv.indexOf("--empresa") + 1] ?? "").toUpperCase()
const CONF: Record<string, { tarjeta: [string, string]; bancos: [string, string, string][]; fc: string }> = {
  MA: { tarjeta: ["ma", "tarjeta_visa"], bancos: [["ma", "ma_galicia", "Galicia MA"]], fc: "ma" },
  PAM: { tarjeta: ["pam", "tarjeta_visa"], bancos: [["public", "pam_galicia", "Galicia PAM CA"], ["public", "pam_galicia_cc", "Galicia PAM CC"]], fc: "pam" },
}
const cf = CONF[EMP]
if (!cf) throw new Error("Falta --empresa MA o PAM")
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const de = (s: string, t: string) => (s === "public" ? sb.from(t) : sb.schema(s).from(t))
const n = (x: unknown) => Number(x) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
const norm = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim()
const claveCom = (s: string) => norm(s).split(" ").slice(0, 2).join(" ")
const ejercicio = (f: string) => { const y = Number(f.slice(0, 4)), m = Number(f.slice(5, 7)); const a = m >= 7 ? y : y - 1; return `${String(a).slice(2)}/${String(a + 1).slice(2)}` }
async function todo(q: () => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q().range(d, d + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break }
  return out
}

// ── Datos ────────────────────────────────────────────────────────────────────────────────────────────────
const filas = await todo(() => de(...cf.tarjeta).select("*").order("fecha").order("orden"))
const debitos: any[] = []
const historiaBanco: any[] = []
for (const [s, t, nombre] of cf.bancos) {
  const xs = await todo(() => de(s, t).select("id,fecha,debitos,estado,categ,detalle,descripcion,template_cuota_id,comprobante_arca_id,leyendas_adicionales_1").order("fecha"))
  for (const x of xs) { if (/^PAGO TARJETA VISA/i.test(x.descripcion ?? "")) debitos.push({ ...x, banco: nombre }); if (x.estado === "conciliado") historiaBanco.push(x) }
}
const idsFc = [...new Set(filas.map(f => f.comprobante_arca_id).filter(Boolean))]
const facturas = new Map<string, any>()
for (const sch of ["ma", "msa", "pam"]) for (let i = 0; i < idsFc.length; i += 200) {
  const { data } = await sb.schema(sch).from("comprobantes_arca").select("id,cuit,fecha_emision,imp_total,denominacion_emisor,cuenta_contable,estado").in("id", idsFc.slice(i, i + 200))
  for (const f of data ?? []) facturas.set(f.id, { ...f, empresa: sch.toUpperCase() })
}
const fcEmpresa = await todo(() => sb.schema(cf.fc).from("comprobantes_arca").select("id,cuit,fecha_emision,imp_total,denominacion_emisor"))
const tpls = await todo(() => sb.from("egresos_sin_factura").select("id,nombre_referencia"))
const tplNombre = new Map(tpls.map(t => [t.id, t.nombre_referencia]))
const cuotas = await todo(() => sb.from("cuotas_egresos_sin_factura").select("id,egreso_id"))
const tplDeCuota = new Map(cuotas.map(c => [c.id, tplNombre.get(c.egreso_id)]))

// ── Pagos: los dos controles ─────────────────────────────────────────────────────────────────────────────
const resumenes = filas.filter(f => f.estado === "total").sort((a, b) => String(a.fecha_cierre ?? a.fecha).localeCompare(String(b.fecha_cierre ?? b.fecha)))
const delResumen = (nr: string) => filas.filter(f => f.nro_resumen === nr && f.estado !== "total")
const usados = new Set<string>()
const debitoDePago = new Map<string, any>()
for (const p of filas.filter(f => /^SU PAGO EN PESOS/i.test(f.descripcion ?? "")).sort((a, b) => a.fecha.localeCompare(b.fecha))) {
  const d = debitos.filter(d => !usados.has(d.id) && Math.abs(n(d.debitos) - n(p.creditos)) < 0.01 && Math.abs(dias(d.fecha, p.fecha)) <= 5)
    .sort((a, b) => Math.abs(dias(a.fecha, p.fecha)) - Math.abs(dias(b.fecha, p.fecha)))[0]
  if (d) { usados.add(d.id); debitoDePago.set(p.id, d) }
}
const debitoUsd = new Map<string, any>()
for (const p of filas.filter(f => /^SU PAGO EN USD/i.test(f.descripcion ?? ""))) {
  const d = debitos.find(d => !usados.has(d.id) && Math.abs(dias(d.fecha, p.fecha)) <= 1)
  if (d) { usados.add(d.id); debitoUsd.set(p.id, d) }
}
interface Res { nr: string; cierre: string; venc: string; saldoAnt: number; pagos: any[]; consumos: number; bonif: number; saldo: number; c1: number; usd: number }
const res: Res[] = resumenes.map(r => {
  const rows = delResumen(r.nro_resumen)
  const pagos = rows.filter(x => /^SU PAGO EN PESOS/i.test(x.descripcion))
  const otros = rows.filter(x => !/^SU PAGO/i.test(x.descripcion))
  const consumos = r2(otros.reduce((t, x) => t + n(x.debitos), 0)), bonif = r2(otros.reduce((t, x) => t + n(x.creditos), 0))
  const pag = r2(pagos.reduce((t, x) => t + n(x.creditos), 0))
  return { nr: r.nro_resumen, cierre: r.fecha_cierre ?? r.fecha, venc: r.fecha_vencimiento ?? "", saldoAnt: n(r.creditos), pagos, consumos, bonif, saldo: n(r.debitos),
    c1: r2(n(r.creditos) - pag + consumos - bonif - n(r.debitos)), usd: r2(otros.reduce((t, x) => t + n(x.debitos_usd) - n(x.creditos_usd), 0)) }
})
const resDe = new Map(res.map(r => [r.nr, r]))
// Si el primer resumen cargado no tiene su anterior, el saldo anterior viene del banco: el control 1 igual vale.

// ── Historia: cómo se concilió antes cada comercio (tarjeta y banco de la empresa) ───────────────────────
const historia = new Map<string, Map<string, number>>()
const destino = (f: any) => [f.categ, f.template_cuota_id ? `template «${tplDeCuota.get(f.template_cuota_id) ?? "?"}»` : f.comprobante_arca_id ? "factura" : "", f.detalle ? `«${f.detalle}»` : ""].filter(Boolean).join(" · ")
const suma = (k: string, v: string) => { if (!k) return; if (!historia.has(k)) historia.set(k, new Map()); const m = historia.get(k)!; m.set(v, (m.get(v) ?? 0) + 1) }
for (const f of filas.filter(f => f.estado === "conciliado")) suma(claveCom(f.descripcion), destino(f))
for (const f of historiaBanco) if (f.leyendas_adicionales_1) suma(claveCom(f.leyendas_adicionales_1), destino(f))
const comoAntes = (s: string) => { const m = historia.get(claveCom(s)); if (!m) return null; const [v, c] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; return { v, c, total: [...m.values()].reduce((a, b) => a + b, 0) } }

// ── Propuesta por renglón ────────────────────────────────────────────────────────────────────────────────
interface Prop { grupo: string; accion: string; cuenta?: string; contable?: string; porque: string }
function propuesta(f: any): Prop | null {
  const d = String(f.descripcion ?? "")
  const fc = f.comprobante_arca_id ? facturas.get(f.comprobante_arca_id) : null
  const imp = n(f.debitos)
  const motor = f.motivo_revision ? ` · Motor: ${f.motivo_revision}` : ""
  if (/PROSEGUR/i.test(d)) {   // JMS 02/11: contra sus facturas, que coincidan, y forman parte de LIB
    const lib = { cuenta: "SEGURIDAD Y ALARMA", contable: "LIB" }
    if (fc && Math.abs(n(fc.imp_total) - imp) < 0.01)
      return { grupo: "Prosegur → LIB", ...lib, accion: f.estado === "conciliado" ? "Ya conciliado: ponerle la cuenta y el contable LIB" : "Confirmar contra su factura (coincide el importe)",
        porque: `Factura ${fc.empresa} ${dmy(fc.fecha_emision)} por ${plata(n(fc.imp_total))}` }
    const cand = fcEmpresa.find(x => x.cuit === "30709776564" && Math.abs(n(x.imp_total) - imp) <= 0.01 && Math.abs(dias(x.fecha_emision, f.fecha)) < 20)
    if (cand) return { grupo: "Prosegur → LIB", ...lib, accion: `Atar a la factura del ${dmy(cand.fecha_emision)} (${plata(n(cand.imp_total))})`,
      porque: `Diferencia de ${plata(r2(n(cand.imp_total) - imp))}: el motor no la tomó por un centavo. ¿Va igual?` }
    return { grupo: "Prosegur → LIB", ...lib, accion: "Queda pendiente: no hay factura del mismo importe", porque: "JMS: sólo si coinciden" }
  }
  if (f.estado === "conciliado" || f.estado === "total") return null
  if (/^SU PAGO EN PESOS/i.test(d)) {
    const deb = debitoDePago.get(f.id), r = resDe.get(f.nro_resumen)
    const ok1 = r && Math.abs(r.c1) < 0.01
    return { grupo: "Pago de tarjeta", cuenta: `Tarjetas ${EMP}`,
      accion: deb && ok1 ? `Conciliar junto con el débito de ${deb.banco} del ${dmy(deb.fecha)} (${deb.estado})` : deb ? "Revisar: el control 1 del resumen no cierra" : "Revisar: no hay débito en el banco por ese importe",
      porque: `${plata(n(f.creditos))}. Control 1 ${ok1 ? "✓" : "✗"} · control 2 ${deb ? "✓" : "✗"}${deb?.estado === "historico" ? " · el débito está en el HISTÓRICO: se ata a su template" : ""}` }
  }
  if (/^SU PAGO EN USD/i.test(d)) {
    const deb = debitoUsd.get(f.id)
    return { grupo: "Pago de tarjeta", cuenta: `Tarjetas ${EMP}`, accion: "Cerrar como informativo ($ 0 en pesos)",
      porque: deb ? `La parte en dólares (US$ ${n(f.creditos_usd)}) se pagó con el débito de ${deb.banco} del ${dmy(deb.fecha)} por ${plata(n(deb.debitos))}` : `US$ ${n(f.creditos_usd)}: no encontré el débito en pesos` }
  }
  if (/DIRECTV/i.test(d) && fc?.empresa === "MSA") return { grupo: "DirecTV (factura de MSA)", accion: "Queda como está", porque: "JMS 02/11: «son las FC de MSA, por ahora no se pone nada»" }
  if (/^PRESTIGIO/i.test(d)) return { grupo: "Prestigio (en cuotas)", accion: "Contra la facturación; si no, queda pendiente", porque: `Cuota ${f.cuota ?? ""} de ${plata(imp)}. La factura de abril tiene una NC por el total el mismo día` }
  if (fc && fc.empresa !== EMP) return { grupo: `Factura de ${fc.empresa} pagada por ${EMP}`, accion: "Lo ves vos: retiro (como propone el motor) o se deja",
    porque: `Factura ${fc.empresa} ${fc.denominacion_emisor} ${dmy(fc.fecha_emision)} ${plata(n(fc.imp_total))}${motor}` }
  if (fc) return { grupo: "Confirmar contra factura", cuenta: fc.cuenta_contable ?? "", accion: "Confirmar contra su factura",
    porque: `Factura ${fc.denominacion_emisor} ${dmy(fc.fecha_emision)} ${plata(n(fc.imp_total))}${fc.cuenta_contable ? "" : " · la factura no tiene cuenta"}${motor}` }
  if (/^(DISCO|CENCOSUD|DIA TIENDA|COTO|CARREFOUR|JUMBO|VEA)/i.test(d)) return { grupo: "Consumo → Consumos", cuenta: "Consumos", accion: "Regla nueva → Consumos", porque: "Supermercado sin factura. JMS: «lo que es consumo, que vaya a consumo»" }
  if (/(EASY|SODIMAC|PINTURER)/i.test(d)) return { grupo: "Hogar / obra → aparte", cuenta: "(cuenta nueva a definir)", accion: "Regla nueva → cuenta aparte", porque: "JMS: «Easy, Sodimac deberían ir aparte»" }
  if (/(EST DE SERVICIO|AXION|SHELL|PARADOR SAN PEDRO|YPF|PUMA)/i.test(d)) return { grupo: "Combustible", cuenta: "COMBUSTIBLES Y LUBRICANTES", accion: "Regla nueva → Combustibles", porque: "Combustible sin factura vinculada" }
  if (/VTV/i.test(d)) return { grupo: "Vehículo", cuenta: "AUTOMOTORES REP Y MANTENIMIENTO", accion: "Regla nueva → Automotores", porque: "VTV" }
  if (/^(INTERESES|IVA RG|DB\.?RG|IIBB PERCEP|DB IVA|COM\.|BONIF COM|IMPUESTO DE SELLOS|INTERES)/i.test(d)) {
    const a = comoAntes(d)
    return { grupo: "Cargos del banco (intereses, percepciones, comisiones)", cuenta: a?.v.split(" · ")[0] ?? "", accion: a ? `Igual que antes: ${a.v}` : "Regla nueva por tipo de cargo", porque: a ? `${a.c} de ${a.total} iguales ya conciliados así` : "Sin antecedente" }
  }
  const a = comoAntes(d)
  if (a) return { grupo: "Como antes (mismo comercio)", cuenta: a.v.split(" · ")[0], accion: `Igual que antes: ${a.v}`, porque: `${a.c} de ${a.total} movimientos del mismo comercio ya conciliados así${motor}` }
  return { grupo: imp > 0 ? "Consumo sin antecedente" : "Crédito sin antecedente", accion: "A estudiar", porque: `${d}${motor}` }
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
  ["Ejercicio", AZUL, f => ejercicio(f.fecha)],
  ["Estado app", AZUL, f => f.estado], ["Cuenta app", AZUL, f => f.categ ?? ""], ["Contable app", AZUL, f => f.contable ?? ""], ["Detalle app", AZUL, f => f.detalle ?? ""],
  ["Factura vinculada", AZUL, f => { const c = facturas.get(f.comprobante_arca_id); return c ? `${c.empresa} · ${c.denominacion_emisor} · ${dmy(c.fecha_emision)} · ${plata(n(c.imp_total))}` : "" }],
  ["Cuenta de la factura", AZUL, f => facturas.get(f.comprobante_arca_id)?.cuenta_contable ?? ""],
  ["Template", AZUL, f => (f.template_cuota_id ? tplDeCuota.get(f.template_cuota_id) ?? "sí" : "")], ["Motivo del motor", AZUL, f => f.motivo_revision ?? ""],
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
const ult = aoa.length
aoa.push([])
const sub: any[] = COLS.map(() => "")
sub[1] = { v: "Subtotal de lo filtrado", t: "s", s: { font: { bold: true } } }
for (const t of ["Débitos $", "Créditos $", "Débitos US$", "Créditos US$"]) sub[COLS.findIndex(c => c[0] === t)] = fx(`SUBTOTAL(9,${iCol(t)}2:${iCol(t)}${ult})`, true)
aoa.push(sub)
const wsD = XLSX.utils.aoa_to_sheet(aoa)
wsD["!autofilter"] = { ref: `A1:${L(COLS.length - 1)}${ult}` }
wsD["!cols"] = COLS.map(([t]) => ({ wch: /por qué|qué hacer|Factura vinc|Motivo/.test(t) ? 50 : /Descrip|grupo/.test(t) ? 32 : 13 }))

// Pagos
const P = ["Resumen", "Cierre", "Vencimiento", "Saldo anterior", "Pagos del período («Su pago»)", "Consumos", "Bonificaciones", "Saldo del resumen",
  "CONTROL 1: anterior − pagos + consumos − bonif. − saldo", "Débitos del banco por esos pagos", "CONTROL 2: pagos − débitos del banco", "Dónde y estado", "Consumos US$", "Propuesta"]
const aP: any[][] = [P.map(t => cab(t, /CONTROL/.test(t) ? AMARILLO : t === "Propuesta" ? VERDE : GRIS))]
res.forEach((r, i) => {
  const row = i + 2
  const debs = r.pagos.map(p => debitoDePago.get(p.id)).filter(Boolean)
  const todos = debs.length === r.pagos.length
  aP.push([r.nr, dmy(r.cierre), dmy(r.venc), num(r.saldoAnt), num(r2(r.pagos.reduce((t, x) => t + n(x.creditos), 0))), num(r.consumos), num(r.bonif), num(r.saldo),
    fx(`D${row}-E${row}+F${row}-G${row}-H${row}`), num(r2(debs.reduce((t, d) => t + n(d.debitos), 0))), fx(`E${row}-J${row}`),
    debs.map(d => `${d.banco} ${dmy(d.fecha)} ${d.estado}`).join(" + "), num(r.usd),
    !r.pagos.length ? "Sin pago en este período" : Math.abs(r.c1) < 0.01 && todos
      ? (r.pagos.every(p => p.estado === "conciliado") && debs.every(d => d.estado === "conciliado") ? "Ya conciliado de los dos lados" : "Los controles cierran → conciliar las dos puntas")
      : "No cerró: revisar"])
})
const nP = res.length + 1
aP.push([], ["", "", "", "", "", "", "", { v: "Diferencias ≠ 0", t: "s", s: { font: { bold: true } } }, { f: `COUNTIF(I2:I${nP},"<>0")`, t: "n" }, "", { f: `COUNTIF(K2:K${nP},"<>0")`, t: "n" }])
const wsP = XLSX.utils.aoa_to_sheet(aP)
wsP["!cols"] = P.map(t => ({ wch: t === "Propuesta" ? 50 : t === "Dónde y estado" ? 40 : t === "Resumen" ? 22 : 15 }))

// Resumen con CONTROL
const D = "Detalle!", rng = (c: string) => `${D}$${c}$2:$${c}$${ult}`
const cE = iCol("Estado app"), cG = iCol("Propuesta: grupo"), cDe = iCol("Débitos $"), cCr = iCol("Créditos $"), cEj = iCol("Ejercicio")
const estados = [...new Set(detalle.map(f => f.estado))].sort()
const ejercicios = [...new Set(detalle.map(f => ejercicio(f.fecha)))].sort()
const grupos = [...new Set(props.filter(Boolean).map(p => p!.grupo))].sort()
const aR: any[][] = [[{ v: `TARJETA VISA ${EMP} — lo que hay hoy y la propuesta (02/11/2026)`, t: "s", s: { font: { bold: true, sz: 13 } } }],
  ["Leer: verde = mi propuesta · amarillo = para que contestes vos · la solapa Pagos tiene tus dos controles por resumen."], [],
  ["Por ESTADO en la app", "Ejercicio", "Movimientos", "Débitos $", "Créditos $"].map(t => cab(t, AZUL))]
const e0 = aR.length + 1
for (const ej of ejercicios) for (const e of estados) { const k = `${rng(cE)},"${e}",${rng(cEj)},"${ej}"`; aR.push([e, ej, { f: `COUNTIFS(${k})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${k})`), fx(`SUMIFS(${rng(cCr)},${k})`)]) }
const eN = aR.length
aR.push([], ["Lo PENDIENTE y A AUDITAR, por PROPUESTA (más Prosegur conciliado, que lleva cuenta y LIB)", "Ejercicio", "Movimientos", "Débitos $", "Créditos $"].map(t => cab(t, VERDE)))
const g0 = aR.length + 1
for (const ej of ejercicios) for (const g of grupos) { const k = `${rng(cG)},"${g}",${rng(cEj)},"${ej}"`; aR.push([g, ej, { f: `COUNTIFS(${k})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${k})`), fx(`SUMIFS(${rng(cCr)},${k})`)]) }
const gN = aR.length
aR.push([], [cab("CONTROL", AMARILLO), "", cab("Movimientos", AMARILLO), cab("Débitos $", AMARILLO), cab("Créditos $", AMARILLO)])
const t0 = aR.length + 1
aR.push(["Todos los renglones del Detalle", "", { f: `COUNTA(${D}B2:B${ult})`, t: "n" }, fx(`SUM(${rng(cDe)})`), fx(`SUM(${rng(cCr)})`)])
aR.push(["− suma por estado", "", { f: `SUM(C${e0}:C${eN})`, t: "n" }, fx(`SUM(D${e0}:D${eN})`), fx(`SUM(E${e0}:E${eN})`)])
aR.push([{ v: "= diferencia (tiene que dar 0)", t: "s", s: { font: { bold: true } } }, "", { f: `C${t0}-C${t0 + 1}`, t: "n" }, fx(`D${t0}-D${t0 + 1}`, true), fx(`E${t0}-E${t0 + 1}`, true)])
const kNo = `${rng(cE)},"<>conciliado"`, kPC = `${rng(cG)},"Prosegur → LIB",${rng(cE)},"conciliado"`
aR.push([], ["Pendientes + a auditar", "", { f: `COUNTIFS(${kNo})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${kNo})`), fx(`SUMIFS(${rng(cCr)},${kNo})`)])
const t1 = aR.length
aR.push(["+ Prosegur ya conciliado (sólo cuenta y LIB)", "", { f: `COUNTIFS(${kPC})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${kPC})`), fx(`SUMIFS(${rng(cCr)},${kPC})`)])
aR.push(["− suma por propuesta", "", { f: `SUM(C${g0}:C${gN})`, t: "n" }, fx(`SUM(D${g0}:D${gN})`), fx(`SUM(E${g0}:E${gN})`)])
aR.push([{ v: "= sin propuesta (tiene que dar 0)", t: "s", s: { font: { bold: true } } }, "", { f: `C${t1}+C${t1 + 1}-C${t1 + 2}`, t: "n" }, fx(`D${t1}+D${t1 + 1}-D${t1 + 2}`, true), fx(`E${t1}+E${t1 + 1}-E${t1 + 2}`, true)])
const wsR = XLSX.utils.aoa_to_sheet(aR)
wsR["!cols"] = [{ wch: 62 }, { wch: 10 }, { wch: 13 }, { wch: 16 }, { wch: 16 }]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, wsR, "Resumen")
XLSX.utils.book_append_sheet(wb, wsD, "Detalle")
XLSX.utils.book_append_sheet(wb, wsP, "Pagos")
fechasReales(wb as any)
const DIR = join("- Comunicacion JMS Claude - Archivos", "Balance", "Excels trabajando con claude")
let destinoArchivo = ""
for (let v = 1; ; v++) { destinoArchivo = join(DIR, `Tarjeta VISA ${EMP} - hoy y propuesta (2026-11-02)${v > 1 ? ` v${v}` : ""}.xlsx`); if (!existsSync(destinoArchivo)) break }
if (!process.argv.includes("--seco")) XLSX.writeFile(wb, destinoArchivo)

const cnt = (pred: (p: Prop | null, f: any) => boolean) => detalle.filter((f, i) => pred(props[i], f)).length
console.log(`${EMP} · Detalle: ${detalle.length} renglones · resúmenes: ${res.length} · sin cerrar: ${cnt((_p, f) => f.estado !== "conciliado")} · sin propuesta: ${cnt((p, f) => f.estado !== "conciliado" && !p)}`)
for (const g of grupos) console.log(`  ${g}: ${cnt(p => p?.grupo === g)}`)
for (const r of res) console.log(`  ${r.nr} ${dmy(r.cierre)} c1=${r.c1} pagos=${r.pagos.length} con débito=${r.pagos.filter(p => debitoDePago.has(p.id)).length}`)
console.log(process.argv.includes("--seco") ? "(seco: no se escribió)" : `\n✅ ${destinoArchivo}`)
