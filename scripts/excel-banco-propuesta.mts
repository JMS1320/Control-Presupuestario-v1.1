/**
 * 🏦 Excel de trabajo — CAJA DE AHORRO GALICIA MA: lo que hay hoy y la propuesta para lo pendiente / a auditar
 * (A-FEAT-1526, JMS 02/11: «una vez terminado [el motor] hacer el mismo trabajo con CA de MA y darme otro excel como el de
 * tarjeta pero de su CA. Así vamos dejando todo zanjado»).
 *
 *     npx tsx scripts/excel-banco-propuesta.mts --cuenta MA        ← SÓLO LEE la base y escribe el Excel (nunca pisa uno existente)
 *     npx tsx scripts/excel-banco-propuesta.mts --cuenta PAM-CA    (PAM caja de ahorro) · --cuenta PAM-CC (PAM cuenta corriente)
 *     (--seco: no escribe el archivo)
 *
 * 🏛️ El HISTÓRICO (JMS 02/11): sólo se concilia contra templates; si es de un proveedor que factura, queda en histórico.
 *
 * Cómo se arma la propuesta de cada movimiento sin conciliar, en este orden:
 *   1. lo que ya decidió JMS o tiene forma fija (pago de tarjeta, retiros de MSA/PAM, extracciones, intereses, Libertad…);
 *   2. una FACTURA de MA del mismo CUIT y el mismo importe;
 *   3. una CUOTA de template de MA del mismo importe y fecha cercana;
 *   4. CÓMO SE CONCILIÓ ANTES lo mismo (mismo CUIT o mismo comercio), en la caja o en la tarjeta de MA;
 *   5. si nada de eso: «a estudiar», con el nombre de quien cobra.
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
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
const addDias = (f: string, d: number) => new Date(Date.parse(f) + d * 86400000).toISOString().slice(0, 10)
const ejercicio = (f: string) => { const y = Number(f.slice(0, 4)), m = Number(f.slice(5, 7)); const a = m >= 7 ? y : y - 1; return `${String(a).slice(2)}/${String(a + 1).slice(2)}` }
const norm = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim()
const CUIT: Record<string, string> = { MSA: "30617786016", PAM: "20044390222", MA: "27066824611" }
const CUENTA = (process.argv[process.argv.indexOf("--cuenta") + 1] ?? "").toUpperCase()
const CUENTAS: Record<string, { emp: string; s: string; t: string; nombre: string }> = {
  "MA": { emp: "MA", s: "ma", t: "ma_galicia", nombre: "CA Galicia MA" },
  "PAM-CA": { emp: "PAM", s: "public", t: "pam_galicia", nombre: "CA Galicia PAM" },
  "PAM-CC": { emp: "PAM", s: "public", t: "pam_galicia_cc", nombre: "CC Galicia PAM" },
}
const cta = CUENTAS[CUENTA]
if (!cta) throw new Error("Falta --cuenta MA | PAM-CA | PAM-CC")
const EMP = cta.emp, ESQ = EMP.toLowerCase()
const de = (s: string, t: string) => (s === "public" ? sb.from(t) : sb.schema(s).from(t))
const hermanas = Object.values(CUENTAS).filter(c => c.emp === EMP && c.t !== cta.t)

async function todo(q: () => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q().range(d, d + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break }
  return out
}
// ── Datos ────────────────────────────────────────────────────────────────────────────────────────────────
const filas = await todo(() => de(cta.s, cta.t).select("*").order("fecha").order("orden"))
const otrasCuentas: any[] = []
for (const h of hermanas) otrasCuentas.push(...await todo(() => de(h.s, h.t).select("id,fecha,debitos,creditos,estado,categ,detalle,template_cuota_id,comprobante_arca_id,leyendas_adicionales_1,leyendas_adicionales_2,concepto,descripcion")))
const tarjeta = await todo(() => sb.schema(ESQ).from("tarjeta_visa").select("id,fecha,descripcion,debitos,creditos,debitos_usd,creditos_usd,estado,categ,detalle,nro_resumen,fecha_cierre,fecha_vencimiento"))
const facturasMA = await todo(() => sb.schema(ESQ).from("comprobantes_arca").select("id,cuit,denominacion_emisor,fecha_emision,imp_total,cuenta_contable,estado"))
const proveedores = await todo(() => sb.from("proveedores").select("cuit,razon_social"))
const nombreCuit = new Map(proveedores.map(p => [String(p.cuit), p.razon_social]))
const tpls = await todo(() => sb.from("egresos_sin_factura").select("id,nombre_referencia,categ,responsable,cuit_quien_cobra"))
const tplMA = new Map(tpls.filter(t => String(t.responsable ?? "").trim().toUpperCase().split(/[\s/]/)[0] === EMP).map(t => [t.id, t]))
const tplTodos = new Map(tpls.map(t => [t.id, t]))
const cuotas = (await todo(() => sb.from("cuotas_egresos_sin_factura").select("id,egreso_id,fecha_estimada,monto,estado,descripcion")))
const cuotasMA = cuotas.filter(c => tplMA.has(c.egreso_id))
const cuotaPorId = new Map(cuotas.map(c => [c.id, c]))
const ventasMA = await todo(() => sb.schema(ESQ).from("comprobantes_venta").select("id,fecha_liquidacion,tipo_comprobante,imp_total,denominacion_cliente,cuit_cliente,estado"))
const vinculadas = new Set(filas.map(f => f.template_cuota_id).filter(Boolean))
// Factura → movimientos que la tienen vinculada (para avisar si OTRO movimiento ya la tomó)
const fcVinculos = new Map<string, string[]>()
for (const f of [...filas, ...otrasCuentas, ...(tarjeta as any[])]) if (f.comprobante_arca_id) fcVinculos.set(f.comprobante_arca_id, [...(fcVinculos.get(f.comprobante_arca_id) ?? []), f.id])
const usadaPorOtro = (fcId: string, movId: string) => (fcVinculos.get(fcId) ?? []).some(id => id !== movId)
const facturaPorId = new Map(facturasMA.map(c => [c.id, c]))
// Las cuentas de las OTRAS empresas del grupo, para ver la otra punta de una transferencia entre empresas
const GRUPO: Record<string, [string, string][]> = { MSA: [["public", "msa_galicia"]], PAM: [["public", "pam_galicia"], ["public", "pam_galicia_cc"]], MA: [["ma", "ma_galicia"]] }
const otraPunta = new Map<string, any[]>()
for (const e of Object.keys(GRUPO).filter(e => e !== EMP)) {
  const xs: any[] = []
  for (const [s, t] of GRUPO[e]) xs.push(...(await todo(() => de(s, t).select("fecha,debitos,creditos,descripcion,estado").gte("fecha", "2025-06-01"))).map(x => ({ ...x, cuenta: t })))
  otraPunta.set(e, xs)
}

// ── Claves ───────────────────────────────────────────────────────────────────────────────────────────────
const cuitDe = (f: any): string => {
  const l2 = String(f.leyendas_adicionales_2 ?? "").replace(/\D/g, "")
  if (l2.length === 11) return l2
  for (const l of String(f.concepto ?? "").split(/\r?\n/)) { const m = /^(?:(?:CU|NO)\s+)?(\d{11})$/.exec(l.trim()); if (m) return m[1] }
  return ""
}
/** El nombre que trae el banco: la leyenda 1, o el renglón anterior al CUIT en el concepto. */
const nombreBanco = (f: any): string => {
  if (f.leyendas_adicionales_1 && !/^Sucursal/.test(f.leyendas_adicionales_1)) return String(f.leyendas_adicionales_1).trim()
  const ls = String(f.concepto ?? "").split(/\r?\n/).map(x => x.trim()); const i = ls.findIndex(l => /^(?:(?:CU|NO)\s+)?\d{11}$/.test(l))
  return i > 0 && !/^(PROPIA|TRANSFERENCIA)/.test(ls[i - 1]) ? ls[i - 1] : ""
}
const tipo = (f: any) => String(f.descripcion ?? "").replace(/\s*\d{5,}.*$/, "").trim().toUpperCase()
const clave = (f: any) => { const c = cuitDe(f); return c ? `CUIT ${c}` : `${tipo(f)} · ${norm(f.leyendas_adicionales_1 || "")}` }
const claveComercio = (s: string) => norm(s).split(" ").slice(0, 2).join(" ")

// Historia: cómo se concilió antes cada clave (caja) y cada comercio (caja + tarjeta)
const historia = new Map<string, Map<string, number>>()
const suma = (k: string, v: string) => { if (!historia.has(k)) historia.set(k, new Map()); const m = historia.get(k)!; m.set(v, (m.get(v) ?? 0) + 1) }
const destino = (f: any) => {
  const t = f.template_cuota_id ? tplTodos.get(cuotaPorId.get(f.template_cuota_id)?.egreso_id) : null
  return [f.categ, t ? `template «${t.nombre_referencia}»` : f.comprobante_arca_id ? "factura" : "", f.detalle ? `«${f.detalle}»` : ""].filter(Boolean).join(" · ")
}
for (const f of [...filas, ...otrasCuentas].filter(f => f.estado === "conciliado")) { suma(clave(f), destino(f)); if (f.leyendas_adicionales_1) suma(`COM ${claveComercio(f.leyendas_adicionales_1)}`, destino(f)) }
for (const f of tarjeta.filter(f => f.estado === "conciliado")) suma(`COM ${claveComercio(f.descripcion)}`, destino(f))
const comoAntes = (k: string) => { const m = historia.get(k); if (!m) return null; const [v, c] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; return { v, c, total: [...m.values()].reduce((a, b) => a + b, 0) } }

// Pago de tarjeta: cada débito contra el «SU PAGO EN PESOS» de la tarjeta (mismo importe, ±5 días); la parte en dólares, contra el «SU PAGO EN USD» del mismo día
const suPagos = tarjeta.filter(t => /^SU PAGO/i.test(t.descripcion ?? ""))

// ── Propuesta ────────────────────────────────────────────────────────────────────────────────────────────
interface Prop { grupo: string; accion: string; cuenta?: string; porque: string }
/** 🏛️ JMS 02/11: el histórico sólo se concilia contra templates; si es de un proveedor que factura, queda en histórico. */
function propuesta(f: any): Prop | null {
  const p = propuestaBase(f)
  if (!p || f.estado !== "historico") return p
  const aTemplate = /template|Libertad|Intereses|Pago de tarjeta|CAJA|cuentas propias|Entre empresas|Distribución/i.test(p.grupo + " " + p.accion) && !/factura/i.test(p.grupo)
  return aTemplate ? { ...p, grupo: `Histórico → template: ${p.grupo}` }
    : { grupo: "Histórico: queda en histórico", accion: "Queda en histórico", porque: `JMS: el histórico sólo va contra templates. Lo que sería: ${p.accion} · ${p.porque}` }
}
function propuestaBase(f: any): Prop | null {
  if (f.estado === "conciliado") return null
  const t = tipo(f), l1 = String(f.leyendas_adicionales_1 ?? "").trim(), cuit = cuitDe(f)
  const imp = n(f.debitos) || n(f.creditos), deb = n(f.debitos) > 0
  const motor = f.motivo_revision ? ` · Motor: ${f.motivo_revision}` : ""

  if (/^PAGO TARJETA (VISA|AMEX)/.test(t)) {
    const sp = suPagos.find(p => /EN PESOS/i.test(p.descripcion) && Math.abs(n(p.creditos) - imp) < 0.01 && Math.abs(dias(p.fecha, f.fecha)) <= 5)
    if (sp) return { grupo: "Pago de tarjeta", cuenta: `Tarjetas ${EMP}`, accion: `Conciliar junto con el «Su pago» de la tarjeta del ${dmy(sp.fecha)} (template Tarjeta VISA ${EMP})`,
      porque: `Mismo importe en la tarjeta (${sp.estado}). Ver el Excel de la tarjeta, solapa Pagos` }
    const su = suPagos.find(p => /EN USD/i.test(p.descripcion) && Math.abs(dias(p.fecha, f.fecha)) <= 1)
    if (su) return { grupo: "Pago de tarjeta", cuenta: `Tarjetas ${EMP}`, accion: "Conciliar como la parte en dólares del resumen",
      porque: `«Su pago en USD» del ${dmy(su.fecha)}: US$ ${n(su.creditos_usd)} → ${plata(imp)}${n(su.creditos_usd) ? ` (≈ ${Math.round(imp / n(su.creditos_usd))} por dólar)` : ""}` }
    return { grupo: "Pago de tarjeta", cuenta: `Tarjetas ${EMP}`, accion: /AMEX/.test(t) ? "Template de la AMEX (no hay resumen cargado)" : "Template Tarjeta VISA: el resumen de ese mes no está cargado",
      porque: "No hay «Su pago» del mismo importe en la tarjeta cargada" }
  }
  const empGrupo = Object.keys(CUIT).find(e => e !== EMP && CUIT[e] === cuit)
  if (empGrupo) {
    const op = (otraPunta.get(empGrupo) ?? []).filter(d => Math.abs(n(deb ? d.creditos : d.debitos) - imp) < 0.01 && Math.abs(dias(d.fecha, f.fecha)) <= 3)
    const punta = op.length ? `La otra punta: ${op[0].cuenta} ${dmy(op[0].fecha)} ${plata(imp)} (${op[0].estado})` : `⚠️ No encontré la otra punta en ${empGrupo} (±3 días)`
    const sentido = deb ? `${EMP} → ${empGrupo}` : `${empGrupo} → ${EMP}`
    const a0 = comoAntes(clave(f))
    if (a0) return { grupo: `Entre empresas: ${sentido}`, cuenta: a0.v.split(" · ")[0], accion: `Igual que antes: ${a0.v}`, porque: `${a0.c} de ${a0.total} iguales ya conciliados así. ${punta}` }
    if (EMP === "MA" && !deb) return { grupo: "Retiro de MSA / PAM → Distribución Mamá", cuenta: "Distribucion Mama", accion: `Template «Distribución Mamá»: retiro de ${empGrupo}`, porque: punta }
    return { grupo: `Entre empresas: ${sentido}`, accion: "¿Retiro, aporte o préstamo? (sin antecedente)", porque: punta }
  }
  // Cobro de una venta de MA (arrendamiento): mismo cliente; la diferencia suele ser una retención
  if (!deb && cuit) {
    const vs = ventasMA.filter(v => String(v.cuit_cliente) === cuit && Math.abs(dias(f.fecha, v.fecha_liquidacion)) <= 60 && n(v.imp_total) >= imp - 0.01)
      .sort((a, b) => Math.abs(n(a.imp_total) - imp) - Math.abs(n(b.imp_total) - imp))
    if (vs.length && imp > 10000) {
      const v = vs[0], dif = r2(n(v.imp_total) - imp), pct = n(v.imp_total) ? Math.round(dif / n(v.imp_total) * 1000) / 10 : 0
      return { grupo: "Cobro de venta", accion: dif < 1 ? `Cobro de la factura ${dmy(v.fecha_liquidacion)}` : `Cobro de la factura ${dmy(v.fecha_liquidacion)} con retención de ${plata(dif)} (${pct}%)`,
        porque: `${v.denominacion_cliente}: factura ${plata(n(v.imp_total))} (${v.estado}) − cobrado ${plata(imp)} = ${plata(dif)}.${dif >= 1 ? " Falta el certificado de la retención para cerrarla" : ""}` }
    }
    if (imp <= 10000) return { grupo: "Crédito sin antecedente", accion: "A estudiar: ¿prueba de CBU?", porque: `${nombreBanco(f)} (CUIT ${cuit}) · ${plata(imp)}` }
  }
  if (cuit === CUIT[EMP] || /CTAS PROPIAS|CUENTA PROPIA|TRANSFERENCIA DE CUENTA$/.test(t)) {
    const h = otrasCuentas.find(x => Math.abs(n(deb ? x.creditos : x.debitos) - imp) < 0.01 && Math.abs(dias(x.fecha, f.fecha)) <= 2)
    return { grupo: `Entre cuentas propias de ${EMP}`, cuenta: "INTER", accion: "Interbancaria / entre cuentas propias",
      porque: `${deb ? "Sale" : "Entra"} ${plata(imp)}. ${h ? `La otra punta: ${dmy(h.fecha)} (${h.estado}) en la otra cuenta de ${EMP}` : `La otra punta no está en las cuentas cargadas de ${EMP}`}` }
  }
  if (/^EXTRACCION/.test(t)) return { grupo: "Extracción de efectivo → CAJA", cuenta: "CAJA", accion: "Template de extracción → CAJA",
    porque: `${plata(imp)} en efectivo.${f.categ && f.categ !== "CAJA" ? ` El motor la puso como «${f.categ}»: no corresponde` : ""}${motor}` }
  if (/^INTERES CAPITALIZADO/.test(t)) return { grupo: "Intereses", cuenta: "INTERESES", accion: "Template Interés capitalizado", porque: f.leyendas_adicionales_3 ?? "" }
  if (/PROMO|REINTEGRO/.test(t)) return { grupo: "Reintegros / bonificaciones", accion: "¿A qué cuenta? (no hay antecedentes)", porque: String(f.concepto ?? "").replace(/\s+/g, " ") }
  if (/AYSA|AGUA Y SANE/.test(l1 + " " + (f.concepto ?? "")) && /0000055193/.test(f.concepto ?? ""))
    return { grupo: "Libertad (agua, gas, ABL)", cuenta: "AGUA", accion: f.estado === "auditar" ? "Confirmar con el importe del BANCO (la cuota precargada queda corregida)" : "Atar a la cuota de AySA Libertad del mes",
      porque: `AySA Libertad (cuenta 0000055193)${motor}` }
  if (/METROGAS/.test(l1)) return { grupo: "Libertad (agua, gas, ABL)", cuenta: "GAS", accion: "Atar a la cuota de Metrogas Libertad del mes", porque: `Metrogas ${plata(imp)}${motor}` }
  if (/INM\/ABL/.test(l1)) return { grupo: "Libertad (agua, gas, ABL)", cuenta: "ABL", accion: f.estado === "auditar" ? "Confirmar con el importe del BANCO" : "Atar a la cuota de ABL Libertad", porque: `ABL partida 007001005392${motor}` }
  if (/AUT\.?CLUB/.test(l1)) return { grupo: `ACA (de ${EMP}, no Libertad)`, accion: `Template ACA de ${EMP}`, porque: "JMS 02/11: el ACA «no debería ser un gasto de Libertad sino de PAM o MA»" }
  if (/AUTONOMOS|IMP\.?AFIP/.test(l1)) return { grupo: `Impuestos de ${EMP}`, accion: `Template de ${l1} de ${EMP}`, porque: `Pago con el CUIT ${f.leyendas_adicionales_3}` }
  if (/^AYSA$/.test(l1)) return { grupo: "A estudiar", accion: "¿Qué AySA es? (no es la de Libertad)", porque: `Cuenta ${f.leyendas_adicionales_3}` }

  // 2a · lo que el motor ya ató a una factura y dejó a auditar
  if (f.estado === "auditar" && f.comprobante_arca_id) {
    const c = facturaPorId.get(f.comprobante_arca_id)
    const otro = usadaPorOtro(f.comprobante_arca_id, f.id)
    return { grupo: otro ? "Factura atada a dos movimientos" : "Confirmar contra factura (importe exacto)", cuenta: c?.cuenta_contable ?? "",
      accion: otro ? "Ver cuál de los dos es el pago y soltar el otro" : "Confirmar lo que propuso el motor",
      porque: `${c ? `Factura ${EMP} ${c.denominacion_emisor} ${dmy(c.fecha_emision)} ${plata(n(c.imp_total))}${c.cuenta_contable ? "" : " · la factura no tiene cuenta"}` : "Factura de otra empresa"}${motor}` }
  }
  // 2 · factura de MA del mismo CUIT y el mismo importe
  if (cuit && deb) {
    const fcs = facturasMA.filter(c => String(c.cuit) === cuit && Math.abs(n(c.imp_total) - imp) <= 1 && dias(f.fecha, c.fecha_emision) >= -15 && dias(f.fecha, c.fecha_emision) <= 120)
    const libre = fcs.find(c => !usadaPorOtro(c.id, f.id)) ?? fcs[0]
    if (libre) return { grupo: usadaPorOtro(libre.id, f.id) ? "Factura atada a dos movimientos" : "Contra factura", accion: `Conciliar contra la factura ${dmy(libre.fecha_emision)} ${plata(n(libre.imp_total))}${usadaPorOtro(libre.id, f.id) ? " (⚠️ ya vinculada a otro movimiento)" : ""}`,
      cuenta: libre.cuenta_contable ?? "", porque: `${libre.denominacion_emisor}${libre.cuenta_contable ? "" : " · la factura no tiene cuenta"}${motor}` }
    const otrasFc = facturasMA.filter(c => String(c.cuit) === cuit)
    if (otrasFc.length) return { grupo: "Proveedor que factura — falta la factura", accion: "Queda pendiente: pedir / cargar la factura",
      porque: `${otrasFc[0].denominacion_emisor} le factura a ${EMP} (${otrasFc.length} facturas), pero ninguna de ${plata(imp)}. JMS: lo que siempre se factura no va a template` }
  }

  // 3 · cuota de template de MA del mismo importe
  const cu = cuotasMA.filter(c => !vinculadas.has(c.id) && Math.abs(n(c.monto) - imp) < 0.01 && c.fecha_estimada && Math.abs(dias(f.fecha, c.fecha_estimada)) <= 15)
  if (cu.length === 1) { const tt = tplMA.get(cu[0].egreso_id); return { grupo: "Contra cuota de template", cuenta: tt.categ, accion: `Atar a la cuota del ${dmy(cu[0].fecha_estimada)} de «${tt.nombre_referencia}»`, porque: `Mismo importe, ${Math.abs(dias(f.fecha, cu[0].fecha_estimada))} días${motor}` } }

  // 4 · cómo se concilió antes
  const a = comoAntes(clave(f)) ?? (l1 ? comoAntes(`COM ${claveComercio(l1)}`) : null)
  if (a) return { grupo: deb ? "Como antes (mismo destinatario / comercio)" : "Como antes (mismo origen)", cuenta: a.v.split(" · ")[0], accion: `Igual que antes: ${a.v}`,
    porque: `${a.c} de ${a.total} movimientos iguales ya conciliados así${cuit ? ` · ${nombreCuit.get(cuit) ?? cuit}` : ""}${motor}` }

  // 5 · a estudiar
  const quien = cuit ? `${nombreCuit.get(cuit) ?? (nombreBanco(f) || "?")} (CUIT ${cuit})` : l1 || t
  const ley = [f.leyendas_adicionales_3, f.leyendas_adicionales_4].filter(Boolean).join(" · ")
  return { grupo: t === "COMPRA DEBITO" ? "Compra con débito sin antecedente" : deb ? "Transferencia sin antecedente" : "Crédito sin antecedente", accion: "A estudiar",
    porque: `${quien}${ley ? ` · ${ley}` : ""}${motor}` }
}

// ── Libro (mismo formato que el de la tarjeta) ─────────────────────────────────────────────────────────────
const GRIS = "E7E6E6", AZUL = "DDEBF7", VERDE = "E2EFDA", AMARILLO = "FFF2CC"
const cab = (v: string, rgb: string) => ({ v, t: "s", s: { font: { bold: true }, fill: { fgColor: { rgb } }, alignment: { wrapText: true, vertical: "top" } } })
const num = (v: number) => ({ v, t: "n", z: "#,##0.00" })
const fx = (f: string, bold = false) => ({ f, t: "n", z: "#,##0.00", s: bold ? { font: { bold: true } } : undefined })
const COLS: [string, string, (f: any, p: Prop | null) => any][] = [
  ["Fecha", GRIS, f => dmy(f.fecha)], ["Descripción", GRIS, f => f.descripcion], ["Débitos", GRIS, f => num(n(f.debitos))], ["Créditos", GRIS, f => num(n(f.creditos))],
  ["Saldo", GRIS, f => num(n(f.saldo))], ["Leyenda 1", GRIS, f => f.leyendas_adicionales_1 ?? ""], ["Leyenda 2", GRIS, f => f.leyendas_adicionales_2 ?? ""],
  ["Leyenda 3", GRIS, f => f.leyendas_adicionales_3 ?? ""], ["Leyenda 4", GRIS, f => f.leyendas_adicionales_4 ?? ""],
  ["Concepto completo", GRIS, f => String(f.concepto ?? "").replace(/\s*\r?\n\s*/g, " | ")],
  ["Ejercicio", AZUL, f => ejercicio(f.fecha)], ["Carga", AZUL, f => (n(f.orden) < 1 ? "PDF oct–dic (script 177)" : "")],
  ["Quién (CUIT)", AZUL, f => { const c = cuitDe(f); return c ? `${nombreCuit.get(c) ?? nombreBanco(f)} ${c}`.trim() : nombreBanco(f) }],
  ["Estado app", AZUL, f => f.estado], ["Cuenta app", AZUL, f => f.categ ?? ""], ["Detalle app", AZUL, f => f.detalle ?? ""], ["Contable app", AZUL, f => f.contable ?? ""],
  ["Vínculo app", AZUL, f => { const c = f.template_cuota_id ? cuotaPorId.get(f.template_cuota_id) : null; const t = c ? tplTodos.get(c.egreso_id) : null
    return t ? `template «${t.nombre_referencia}»` : f.comprobante_arca_id ? "factura" : f.sueldo_pago_id ? "sueldo" : f.anticipo_id ? "anticipo" : f.comprobante_venta_id ? "venta" : "" }],
  ["Motivo del motor", AZUL, f => f.motivo_revision ?? ""],
  ["Propuesta: grupo", VERDE, (_f, p) => p?.grupo ?? "—"], ["Propuesta: qué hacer", VERDE, (_f, p) => p?.accion ?? ""],
  ["Propuesta: cuenta", VERDE, (_f, p) => p?.cuenta ?? ""], ["Propuesta: por qué", VERDE, (_f, p) => p?.porque ?? ""],
  ["JMS: OK / cambio", AMARILLO, () => ""], ["JMS: nota", AMARILLO, () => ""],
]
const L = (i: number) => XLSX.utils.encode_col(i)
const iCol = (t: string) => L(COLS.findIndex(c => c[0] === t))
const props = filas.map(f => propuesta(f))
const aoa: any[][] = [COLS.map(([t, c]) => cab(t, c))]
filas.forEach((f, i) => aoa.push(COLS.map(([, , g]) => g(f, props[i]))))
const ult = aoa.length
aoa.push([])
const sub: any[] = COLS.map(() => "")
sub[1] = { v: "Subtotal de lo filtrado", t: "s", s: { font: { bold: true } } }
for (const t of ["Débitos", "Créditos"]) sub[COLS.findIndex(c => c[0] === t)] = fx(`SUBTOTAL(9,${iCol(t)}2:${iCol(t)}${ult})`, true)
aoa.push(sub)
const wsD = XLSX.utils.aoa_to_sheet(aoa)
wsD["!autofilter"] = { ref: `A1:${L(COLS.length - 1)}${ult}` }
wsD["!cols"] = COLS.map(([t]) => ({ wch: /por qué|qué hacer|Concepto|Motivo/.test(t) ? 50 : /Descrip|Quién|Leyenda 1|grupo/.test(t) ? 28 : 13 }))

const D = "Detalle!", rng = (c: string) => `${D}$${c}$2:$${c}$${ult}`
const cE = iCol("Estado app"), cG = iCol("Propuesta: grupo"), cDe = iCol("Débitos"), cCr = iCol("Créditos"), cEj = iCol("Ejercicio")
const estados = [...new Set(filas.map(f => f.estado))].sort()
const EJS = [...new Set(filas.map(f => ejercicio(f.fecha)))].sort()
const grupos = [...new Set(props.filter(Boolean).map(p => p!.grupo))].sort()
const aR: any[][] = [[{ v: `${cta.nombre.toUpperCase()} — lo que hay hoy y la propuesta (después del motor, 02/11/2026)`, t: "s", s: { font: { bold: true, sz: 13 } } }],
  [`Leer: verde = mi propuesta · amarillo = para que contestes vos.${EMP === "MA" ? " Incluye oct–dic 2025 cargados hoy desde los PDF." : ""}`], [],
  ["Por ESTADO en la app", "Ejercicio", "Movimientos", "Débitos", "Créditos"].map(t => cab(t, AZUL))]
const e0 = aR.length + 1
for (const ej of EJS) for (const e of estados) { const k = `${rng(cE)},"${e}",${rng(cEj)},"${ej}"`; aR.push([e, ej, { f: `COUNTIFS(${k})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${k})`), fx(`SUMIFS(${rng(cCr)},${k})`)]) }
const eN = aR.length
aR.push([], ["Lo PENDIENTE y A AUDITAR, por PROPUESTA", "Ejercicio", "Movimientos", "Débitos", "Créditos"].map(t => cab(t, VERDE)))
const g0 = aR.length + 1
for (const ej of EJS) for (const g of grupos) { const k = `${rng(cG)},"${g}",${rng(cEj)},"${ej}"`; aR.push([g, ej, { f: `COUNTIFS(${k})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${k})`), fx(`SUMIFS(${rng(cCr)},${k})`)]) }
const gN = aR.length
aR.push([], [cab("CONTROL", AMARILLO), "", cab("Movimientos", AMARILLO), cab("Débitos", AMARILLO), cab("Créditos", AMARILLO)])
const t0 = aR.length + 1
aR.push(["Todos los movimientos del Detalle", "", { f: `COUNTA(${D}B2:B${ult})`, t: "n" }, fx(`SUM(${rng(cDe)})`), fx(`SUM(${rng(cCr)})`)])
aR.push(["− suma por estado", "", { f: `SUM(C${e0}:C${eN})`, t: "n" }, fx(`SUM(D${e0}:D${eN})`), fx(`SUM(E${e0}:E${eN})`)])
aR.push([{ v: "= diferencia (tiene que dar 0)", t: "s", s: { font: { bold: true } } }, "", { f: `C${t0}-C${t0 + 1}`, t: "n" }, fx(`D${t0}-D${t0 + 1}`, true), fx(`E${t0}-E${t0 + 1}`, true)])
const k = `${rng(cE)},"<>conciliado"`
aR.push([], ["Pendientes + a auditar", "", { f: `COUNTIFS(${k})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${k})`), fx(`SUMIFS(${rng(cCr)},${k})`)])
const t1 = aR.length
aR.push(["− suma por propuesta", "", { f: `SUM(C${g0}:C${gN})`, t: "n" }, fx(`SUM(D${g0}:D${gN})`), fx(`SUM(E${g0}:E${gN})`)])
aR.push([{ v: "= sin propuesta (tiene que dar 0)", t: "s", s: { font: { bold: true } } }, "", { f: `C${t1}-C${t1 + 1}`, t: "n" }, fx(`D${t1}-D${t1 + 1}`, true), fx(`E${t1}-E${t1 + 1}`, true)])
// Saldo: el del primer movimiento + créditos − débitos = el del último (el extracto no salta)
const p1 = filas[0], pn = filas[filas.length - 1]
aR.push([], [cab("SALDO — el extracto encadena", AMARILLO), "", "", cab("Importe", AMARILLO)])
const s0 = aR.length + 1
aR.push([`Saldo antes del primer movimiento (${dmy(p1.fecha)})`, "", "", num(r2(n(p1.saldo) + n(p1.debitos) - n(p1.creditos)))])
aR.push(["+ créditos − débitos de todo el Detalle", "", "", fx(`SUM(${rng(cCr)})-SUM(${rng(cDe)})`)])
aR.push([`− saldo del último movimiento (${dmy(pn.fecha)})`, "", "", num(n(pn.saldo))])
aR.push([{ v: "= diferencia (tiene que dar 0)", t: "s", s: { font: { bold: true } } }, "", "", fx(`D${s0}+D${s0 + 1}-D${s0 + 2}`, true)])
const wsR = XLSX.utils.aoa_to_sheet(aR)
wsR["!cols"] = [{ wch: 62 }, { wch: 10 }, { wch: 13 }, { wch: 16 }, { wch: 16 }]

// Por destinatario: lo sin antecedente / a estudiar agrupado por quién, para decidir UNA vez por destinatario
const abiertos = filas.map((f, i) => ({ f, p: props[i] })).filter(x => x.p && /sin antecedente|A estudiar/.test(x.p.grupo + x.p.accion))
const porQuien = new Map<string, { quien: string; tipo: string; n: number; deb: number; cred: number; desde: string; hasta: string; ej: string[] }>()
for (const { f } of abiertos) {
  const c = cuitDe(f), q = c ? `${nombreCuit.get(c) ?? nombreBanco(f)} · ${c}` : (nombreBanco(f) || tipo(f))
  const k = `${tipo(f)}|${c || claveComercio(nombreBanco(f))}`
  const x = porQuien.get(k) ?? { quien: q, tipo: tipo(f), n: 0, deb: 0, cred: 0, desde: f.fecha, hasta: f.fecha, ej: [] }
  x.n++; x.deb = r2(x.deb + n(f.debitos)); x.cred = r2(x.cred + n(f.creditos)); x.hasta = f.fecha
  const ley = String(f.leyendas_adicionales_3 ?? ""); if (ley && ley !== "VARIOS" && !x.ej.includes(ley)) x.ej.push(ley)
  porQuien.set(k, x)
}
const aQ: any[][] = [["Quién", "Tipo", "Movimientos", "Débitos", "Créditos", "Desde", "Hasta", "Leyenda del banco", "JMS: a qué cuenta / template", "JMS: nota"]
  .map((t, i) => cab(t, i >= 8 ? AMARILLO : AZUL))]
for (const x of [...porQuien.values()].sort((a, b) => (b.deb + b.cred) - (a.deb + a.cred)))
  aQ.push([x.quien, x.tipo, x.n, num(x.deb), num(x.cred), dmy(x.desde), dmy(x.hasta), x.ej.join(" · "), "", ""])
const uQ = aQ.length
aQ.push([], [{ v: "Total (= los «sin antecedente» y «a estudiar» del Resumen)", t: "s", s: { font: { bold: true } } }, "", { f: `SUM(C2:C${uQ})`, t: "n" }, fx(`SUM(D2:D${uQ})`, true), fx(`SUM(E2:E${uQ})`, true)])
const wsQ = XLSX.utils.aoa_to_sheet(aQ)
wsQ["!autofilter"] = { ref: `A1:J${uQ}` }
wsQ["!cols"] = [{ wch: 42 }, { wch: 26 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 11 }, { wch: 11 }, { wch: 22 }, { wch: 34 }, { wch: 30 }]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, wsR, "Resumen")
XLSX.utils.book_append_sheet(wb, wsQ, "Por destinatario")
XLSX.utils.book_append_sheet(wb, wsD, "Detalle")
fechasReales(wb as any)
const DIR = join("- Comunicacion JMS Claude - Archivos", "Balance", "Excels trabajando con claude")
let dest = ""
for (let v = 1; ; v++) { dest = join(DIR, `${cta.nombre} - hoy y propuesta (2026-11-02)${v > 1 ? ` v${v}` : ""}.xlsx`); if (!existsSync(dest)) break }
if (!process.argv.includes("--seco")) XLSX.writeFile(wb, dest)

const cnt = (pred: (p: Prop | null, f: any) => boolean) => filas.filter((f, i) => pred(props[i], f)).length
console.log(`Movimientos: ${filas.length} · sin conciliar: ${cnt((_p, f) => f.estado !== "conciliado")} · sin propuesta: ${cnt((p, f) => f.estado !== "conciliado" && !p)}`)
const saldoOk = r2(n(p1.saldo) + n(p1.debitos) - n(p1.creditos) + filas.reduce((a, f) => a + n(f.creditos) - n(f.debitos), 0) - n(pn.saldo))
console.log(`Control de saldo: ${saldoOk}`)
for (const g of grupos) {
  const xs = filas.filter((_f, i) => props[i]?.grupo === g)
  console.log(`  ${g}: ${xs.length} (25/26: ${xs.filter(f => ejercicio(f.fecha) === "25/26").length}) · deb ${plata(xs.reduce((a, f) => a + n(f.debitos), 0))} · cred ${plata(xs.reduce((a, f) => a + n(f.creditos), 0))}`)
}
console.log(process.argv.includes("--seco") ? "(seco: no se escribió)" : `\n✅ ${dest}`)
