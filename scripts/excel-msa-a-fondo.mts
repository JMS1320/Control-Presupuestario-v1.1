/**
 * 🔎 Excel de trabajo A FONDO — las cuentas de MSA (período de ejercicio). JMS 03/11: «hacelas a fondo porque es período de
 * ejercicio: cuando algo no cuadre buscá todas las alternativas, así no proponés algo por ej. fecha parecida pero otro CUIT. Acá
 * más rigurosos y ponele esmero en las propuestas».
 *
 *     npx tsx scripts/excel-msa-a-fondo.mts --cuenta TARJETA     (VISA Business)
 *     npx tsx scripts/excel-msa-a-fondo.mts --cuenta GALICIA     (cuenta corriente Galicia)
 *     npx tsx scripts/excel-msa-a-fondo.mts --cuenta SANTANDER
 *     npx tsx scripts/excel-msa-a-fondo.mts --cuenta USD         (cuenta corriente en dólares)
 *     … --seco  ← no escribe el Excel
 *
 * SÓLO LEE la base. Nunca pisa un Excel existente (v2, v3…).
 *
 * El rigor, regla por regla:
 *  1 · Para cada movimiento abierto se juntan TODAS las candidatas, de todas las fuentes: facturas de MSA (por el total, por lo que
 *      quedaba a abonar y por el total menos la retención de Ganancias), sumas de 2–3 facturas del mismo proveedor, grupos de pago,
 *      cheques/echeqs por NÚMERO, pagos de sueldos, cuotas de templates, pagos a cuenta, facturas de MA/PAM, ventas (con y sin
 *      retenciones) y la otra punta entre cuentas propias o del grupo.
 *  2 · El CUIT manda: si el banco trae CUIT (o el comercio de la tarjeta tiene un CUIT aprendido de la historia), una factura de
 *      OTRO CUIT nunca se propone — va a «Alertas» como «mismo importe, otro proveedor».
 *  3 · Coherencia del tipo: una comisión, un impuesto del banco o una percepción no se pagan con una factura de proveedor; si el
 *      motor los ató a una, se avisa.
 *  4 · Una factura ya atada a otro movimiento no se propone sin decirlo.
 *  5 · Cada propuesta lleva SEGURIDAD (ALTA: única y con identidad — CUIT, número de cheque, comercio —; MEDIA: única sólo por
 *      importe; BAJA: varias candidatas; SIN: nada) y la lista entera de candidatas, para que JMS elija si no es la primera.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"

const MODO = (process.argv[process.argv.indexOf("--cuenta") + 1] ?? "").toUpperCase()
const CTAS: Record<string, { s: string; t: string; nombre: string; usd?: boolean; tarjeta?: boolean }> = {
  TARJETA: { s: "msa", t: "tarjeta_visa_business", nombre: "Tarjeta VISA Business MSA", tarjeta: true },
  GALICIA: { s: "public", t: "msa_galicia", nombre: "CC Galicia MSA" },
  SANTANDER: { s: "msa", t: "santander", nombre: "Santander MSA" },
  USD: { s: "msa", t: "cc_usd", nombre: "CC dólares MSA", usd: true },
}
const cta = CTAS[MODO]
if (!cta) throw new Error("Falta --cuenta TARJETA | GALICIA | SANTANDER | USD")
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const de = (s: string, t: string) => (s === "public" ? sb.from(t) : sb.schema(s).from(t))
const n = (x: unknown) => Number(x) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const igual = (a: number, b: number) => Math.abs(a - b) < 0.015   // redondeo de 1 centavo (el emisor redondea distinto que el banco)
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dmy = (f?: string | null) => (f ? String(f).slice(0, 10).split("-").reverse().join("/") : "")
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
const filas = await todo(() => de(cta.s, cta.t).select("*").order("fecha").order("orden"))
const abiertos = filas.filter(f => ["pendiente", "auditar"].includes(String(f.estado)))
const FC_COLS = "id,cuit,denominacion_emisor,fecha_emision,imp_total,monto_a_abonar,monto_sicore,estado,cuenta_contable,grupo_pago_id,tipo_comprobante,punto_venta,numero_desde"
const fcMsa = await todo(() => sb.schema("msa").from("comprobantes_arca").select(FC_COLS))
// Las facturas de jul–dic 2025 viven en «comprobantes históricos» (sin vínculo con el banco): también son candidatas
const fcHist = (await todo(() => sb.schema("msa").from("comprobantes_historico").select("id,fecha,tipo,punto_de_venta,numero_desde,nro_doc_emisor,denominacion_emisor,imp_total,cuenta_contable")))
  .map(h => ({ id: h.id, cuit: h.nro_doc_emisor, denominacion_emisor: `${h.denominacion_emisor} [histórico]`, fecha_emision: h.fecha, imp_total: h.imp_total, monto_a_abonar: null, monto_sicore: 0,
    estado: "histórico", cuenta_contable: h.cuenta_contable, grupo_pago_id: null, tipo_comprobante: /nota de cr|NC/i.test(String(h.tipo)) ? 3 : 1, punto_venta: h.punto_de_venta, numero_desde: h.numero_desde, hist: true }))
fcMsa.push(...fcHist)
const fcOtras: any[] = []
for (const s of ["ma", "pam"]) fcOtras.push(...(await todo(() => sb.schema(s).from("comprobantes_arca").select(FC_COLS))).map(f => ({ ...f, empresa: s.toUpperCase() })))
const fcPorId = new Map<string, any>([...fcMsa.map(f => [f.id, { ...f, empresa: "MSA" }] as [string, any]), ...fcOtras.map(f => [f.id, f] as [string, any])])
const esNC = (f: any) => [3, 8, 13, 53, 113, 203, 208, 213].includes(Number(f.tipo_comprobante))
const totalFc = (f: any) => (esNC(f) ? -Math.abs(n(f.imp_total)) : n(f.imp_total))
// Quién tiene atada cada factura (todas las tablas con el vínculo)
const atadas = new Map<string, { tabla: string; id: string; fecha: string; estado: string }[]>()
const cuotaUsada = new Map<string, string>(), sueldoUsado = new Map<string, string>(), anticipoUsado = new Map<string, string>()
const movsDeOtrasCuentas: any[] = []
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const xs = await todo(() => de(t.schema, t.tabla).select("id,fecha,debitos,creditos,estado,comprobante_arca_id,template_cuota_id,descripcion").or("comprobante_arca_id.not.is.null,template_cuota_id.not.is.null"))
  for (const x of xs) {
    if (x.comprobante_arca_id) atadas.set(x.comprobante_arca_id, [...(atadas.get(x.comprobante_arca_id) ?? []), { tabla: t.tabla, id: x.id, fecha: x.fecha, estado: x.estado }])
    if (x.template_cuota_id) cuotaUsada.set(x.template_cuota_id, `${t.tabla} ${dmy(x.fecha)}`)
  }
}
for (const [s, t] of [["public", "msa_galicia"], ["msa", "santander"], ["msa", "cc_usd"], ["public", "pam_galicia"], ["public", "pam_galicia_cc"], ["ma", "ma_galicia"], ["public", "cotitulares_ca_pesos"]]) {
  if (s === cta.s && t === cta.t) continue
  const xs = await todo(() => de(s, t).select("id,fecha,debitos,creditos,estado,descripcion,sueldo_pago_id,anticipo_id").gte("fecha", "2024-06-01"))
  movsDeOtrasCuentas.push(...xs.map(x => ({ ...x, cuenta: t })))
}
for (const x of [...filas, ...movsDeOtrasCuentas]) { if (x.sueldo_pago_id) sueldoUsado.set(x.sueldo_pago_id, x.id); if (x.anticipo_id) anticipoUsado.set(x.anticipo_id, x.id) }
const cheques = await todo(() => sb.schema("msa").from("cheques").select("*"))
const grupos = await todo(() => sb.schema("msa").from("grupos_pago").select("*"))
const empleados = await todo(() => sb.schema("sueldos").from("empleados").select("id,nombre,empresa"))
const empNombre = new Map(empleados.map(e => [e.id, e]))
const sueldos = (await todo(() => sb.schema("sueldos").from("pagos").select("id,empleado_id,tipo,fecha,monto,estado,medio_pago,descripcion")))
  .filter(p => /MSA/.test(String(empNombre.get(p.empleado_id)?.empresa ?? "")))
const tpls = await todo(() => sb.from("egresos_sin_factura").select("id,nombre_referencia,categ,responsable,cuit_quien_cobra,activo"))
const tplPorId = new Map(tpls.map(t => [t.id, t]))
const esMSA = (t: any) => /^MSA\b/.test(String(t?.responsable ?? "").trim().toUpperCase())
const cuotas = (await todo(() => sb.from("cuotas_egresos_sin_factura").select("id,egreso_id,fecha_estimada,fecha_vencimiento,monto,estado,detalle"))).filter(c => esMSA(tplPorId.get(c.egreso_id)))
const cuotaPorId = new Map(cuotas.map(c => [c.id, c]))
const anticipos = (await todo(() => sb.from("anticipos_proveedores").select("*"))).filter(a => (a.empresa ?? "MSA") === "MSA")
const ventas = await todo(() => sb.schema("msa").from("comprobantes_venta").select("id,fecha_liquidacion,imp_total,denominacion_cliente,cuit_cliente,estado,nro_comprobante,tipo_comprobante,ret_iva,ret_iibb"))
const retRec = await todo(() => sb.schema("msa").from("retenciones_recibidas").select("comprobante_venta_id,monto,tipo"))
const retPorVenta = new Map<string, number>()
for (const r of retRec) retPorVenta.set(r.comprobante_venta_id, r2((retPorVenta.get(r.comprobante_venta_id) ?? 0) + n(r.monto)))
const proveedores = await todo(() => sb.from("proveedores").select("cuit,razon_social"))
const nombreCuit = new Map(proveedores.map(p => [String(p.cuit), p.razon_social]))
const CUIT_MSA = "30617786016"

// ── Historia: cómo se concilió antes cada clave en ESTA cuenta (y para la tarjeta, qué CUIT tiene cada comercio) ──
const claveMov = (f: any) => (cta.tarjeta ? claveCom(f.descripcion) : norm(String(f.descripcion ?? "")).slice(0, 40))
const destino = (f: any) => {
  const c = f.template_cuota_id ? cuotaPorId.get(f.template_cuota_id) : null, t = c ? tplPorId.get(c.egreso_id) : null
  return [f.categ, t ? `template «${t.nombre_referencia}»` : f.comprobante_arca_id ? "factura" : f.sueldo_pago_id ? "sueldo" : "", f.contable ? `contable ${f.contable}` : ""].filter(Boolean).join(" · ")
}
const historia = new Map<string, Map<string, number>>()
for (const f of filas.filter(f => f.estado === "conciliado")) {
  const k = claveMov(f), v = destino(f); if (!k || !v) continue
  if (!historia.has(k)) historia.set(k, new Map()); const m = historia.get(k)!; m.set(v, (m.get(v) ?? 0) + 1)
}
const ALIAS: [RegExp, string][] = [[/^DEVOL\.?COM\.?MANT/i, "COMISIÓN MANT DE CTA."], [/^CR IVA/i, "DB IVA $ RESP INSC."], [/^CR\.?RG/i, "DB.RG "], [/^Iva \d|^IVA$/i, "IVA"]]
const comoAntes = (f: any) => { let m = historia.get(claveMov(f)); if (!m) for (const [re, otro] of ALIAS) if (re.test(String(f.descripcion ?? ""))) { m = historia.get(claveMov({ descripcion: otro })); if (m) break } if (!m) return null; const orden = [...m.entries()].sort((a, b) => b[1] - a[1]); const [v, c] = orden[0]; const total = [...m.values()].reduce((a, b) => a + b, 0)
  return { v, c, total, claro: c >= 3 && c / total >= 0.8, reparto: orden.slice(0, 4).map(([x, k]) => `${x} (${k})`).join(" · ") + (orden.length > 4 ? ` · y ${orden.length - 4} destinos más` : "") } }
const cuitDeComercio = new Map<string, Map<string, number>>()
if (cta.tarjeta) for (const f of filas.filter(f => f.comprobante_arca_id)) {
  const c = fcPorId.get(f.comprobante_arca_id); if (!c) continue
  const k = claveCom(f.descripcion); if (!cuitDeComercio.has(k)) cuitDeComercio.set(k, new Map()); const m = cuitDeComercio.get(k)!; m.set(c.cuit, (m.get(c.cuit) ?? 0) + 1)
}
const cuitAprendido = (f: any): { cuit: string; veces: number; otros: number } | null => {
  const m = cuitDeComercio.get(claveCom(f.descripcion)); if (!m) return null
  const [cuit, veces] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; return { cuit, veces, otros: [...m.values()].reduce((a, b) => a + b, 0) - veces }
}
const cuitDelBanco = (f: any): string => {
  if (cta.tarjeta) return ""
  const txt = `${f.leyendas_adicionales_2 ?? ""} ${f.concepto ?? ""} ${f.descripcion ?? ""}`
  const m = txt.match(/\b(\d{11})\b/g)?.find(x => x !== CUIT_MSA || /CTAS PROPIAS|INTERBANKING/i.test(txt))
  return m ?? ""
}

// ── Tipo de movimiento: los que NO pueden ser una factura de proveedor ──────────────────────────────────
const CARGO_BANCO = /COMISI|IMP\.?\s*DEB|IMP\.?\s*CRE|IMPUESTO LEY|LEY 25\.?413|^IVA\b|IVA \d|PERCEP|IMPUESTO DE SELLOS|SELLOS|INTERES|DB IVA|CR IVA|DB\.?RG|CR\.?RG|IIBB PERCEP|DEVOL\.?COM|MANT\.? DE CTA|RENO\.?ANUAL|ING\.? BRUTOS/i
const esCargoBanco = (f: any) => CARGO_BANCO.test(String(f.descripcion ?? ""))

// ── Candidatas ───────────────────────────────────────────────────────────────────────────────────────────
interface Cand { tipo: string; texto: string; fuerza: 3 | 2 | 1; ref?: string }
const fcLibre = (id: string, movId: string) => !(atadas.get(id) ?? []).some(a => a.id !== movId)
const txtAtada = (id: string, movId: string) => { const o = (atadas.get(id) ?? []).filter(a => a.id !== movId); return o.length ? ` ⚠️ ya atada a ${o.map(a => `${a.tabla} ${dmy(a.fecha)} (${a.estado})`).join(", ")}` : "" }
const montosFc = (f: any): [string, number][] => {
  const t = totalFc(f), xs: [string, number][] = [["total", t]]
  if (n(f.monto_a_abonar) && !igual(n(f.monto_a_abonar), t)) xs.push(["a abonar", n(f.monto_a_abonar)])
  if (n(f.monto_sicore) > 0) xs.push(["neto de la retención de Ganancias", r2(t - n(f.monto_sicore))])
  return xs
}
const descFc = (f: any) => `${f.empresa && f.empresa !== "MSA" ? `[${f.empresa}] ` : ""}${f.denominacion_emisor} (CUIT ${f.cuit}) · ${esNC(f) ? "NC" : "FC"} ${f.punto_venta ?? ""}-${f.numero_desde ?? ""} del ${dmy(f.fecha_emision)} · ${plata(totalFc(f))} · ${f.estado}${f.cuenta_contable ? ` · ${f.cuenta_contable}` : " · sin cuenta"}`

function subconjuntos<T>(xs: T[], valor: (x: T) => number, objetivo: number, max = 3): T[][] {
  const out: T[][] = []
  const rec = (i: number, acc: T[], suma: number) => {
    if (acc.length >= 2 && igual(suma, objetivo)) { out.push([...acc]); return }
    if (acc.length >= max || out.length >= 5) return
    for (let j = i; j < xs.length; j++) rec(j + 1, [...acc, xs[j]], suma + valor(xs[j]))
  }
  rec(0, [], 0)
  return out
}

function candidatas(f: any): { cands: Cand[]; alertas: string[]; cuit: string; cuitFuente: string } {
  const cands: Cand[] = [], alertas: string[] = []
  const deb = n(f.debitos) > 0, imp = deb ? n(f.debitos) : n(f.creditos), d = String(f.descripcion ?? "")
  let cuit = cuitDelBanco(f), cuitFuente = cuit ? "el banco" : ""
  if (!cuit && cta.tarjeta) { const a = cuitAprendido(f); if (a) { cuit = a.cuit; cuitFuente = `la historia del comercio (${a.veces} vez/veces${a.otros ? `, ${a.otros} con otro CUIT` : ""})` } }
  if (cuit === CUIT_MSA) cuitFuente = "propia"
  if (!imp) return { cands, alertas, cuit, cuitFuente }

  // 0 · lo que ya propuso el motor
  if (f.comprobante_arca_id) {
    const c = fcPorId.get(f.comprobante_arca_id)
    if (c) {
      const mOk = montosFc(c).find(([, m]) => igual(Math.abs(m), imp)), ok = !!mOk
      if (cuit && cuit !== CUIT_MSA && c.cuit !== cuit) alertas.push(`🚫 El motor la ató a una factura de OTRO CUIT (${c.denominacion_emisor} ${c.cuit}; el movimiento es de ${nombreCuit.get(cuit) ?? cuit})`)
      if (esCargoBanco(f)) alertas.push(`🚫 Es un cargo del banco y el motor lo ató a una factura de proveedor (${c.denominacion_emisor})`)
      if (!ok) alertas.push(`⚠️ El importe de la factura atada no coincide (${plata(totalFc(c))})`)
      const dd = dias(f.fecha, c.fecha_emision)
      if (dd < -5 || dd > 120) alertas.push(`⚠️ La factura atada es del ${dmy(c.fecha_emision)} (${dd} días)`)
      cands.push({ tipo: `Factura atada por el motor${mOk && mOk[0] !== "total" ? ` (coincide ${mOk[0]})` : ""}`, texto: descFc(c) + txtAtada(c.id, f.id), fuerza: (cuit && c.cuit === cuit) || (!cuit && ok && !esCargoBanco(f)) ? (cuit ? 3 : 2) : 1, ref: c.id })
    }
  }
  if (f.template_cuota_id && cuotaPorId.get(f.template_cuota_id)) {
    const c = cuotaPorId.get(f.template_cuota_id), t = tplPorId.get(c.egreso_id)
    cands.push({ tipo: "Cuota atada por el motor", texto: `«${t?.nombre_referencia}» ${dmy(c.fecha_estimada)} ${plata(n(c.monto))} (${c.estado})`, fuerza: igual(n(c.monto), imp) ? 2 : 1, ref: c.id })
  }
  if (deb) {
    // 1 · cheque / echeq por NÚMERO
    const nro = d.match(/(?:Nro\.?:?|N[º°])\s*(\d+)/i)?.[1]
    if (nro && /cheq/i.test(d)) {
      const ch = cheques.filter(c => String(c.numero).replace(/^0+/, "") === nro.replace(/^0+/, ""))
      for (const c of ch) {
        const fc = c.factura_id ? fcPorId.get(c.factura_id) : null
        const ant = c.anticipo_id ? anticipos.find(a => a.id === c.anticipo_id) : null
        cands.push({ tipo: `Cheque Nº ${nro}${ant ? " (pago a cuenta)" : ""}`, ref: ant?.id ?? c.id, texto: `a ${c.beneficiario_nombre ?? "?"}${c.beneficiario_cuit ? ` (CUIT ${c.beneficiario_cuit})` : ""} · ${plata(n(c.monto))} · emitido ${dmy(c.fecha_emision)} · ${c.estado}${fc ? ` · paga ${descFc(fc)}` : ant ? ` · pago a cuenta «${ant.descripcion ?? ""}» (${ant.estado})` : " · sin factura"}`, fuerza: igual(n(c.monto), imp) ? 3 : 1 })
        if (!igual(n(c.monto), imp)) alertas.push(`⚠️ El cheque Nº ${nro} registrado es de ${plata(n(c.monto))}`)
        if (c.beneficiario_cuit) { cuit = c.beneficiario_cuit; cuitFuente = `el cheque Nº ${nro}` }
      }
      if (!ch.length) alertas.push(`El cheque/echeq Nº ${nro} no está registrado en la app (Cheques emitidos)`)
    }
    // 1b · número de factura en la descripción (p. ej. COOPSER O-0023-00174334 = PV 23, Nº 174334): identidad exacta
    const nf = d.match(/(\d{4})-(\d{8})/)
    if (nf) for (const c of fcMsa.filter(c => Number(c.punto_venta) === Number(nf[1]) && Number(c.numero_desde) === Number(nf[2]) && (!cuit || c.cuit === cuit))) {
      const ok = montosFc(c).some(([, x]) => igual(x, imp))
      cands.push({ tipo: `Factura Nº ${nf[1]}-${nf[2]} (el número está en la descripción)`, texto: descFc({ ...c, empresa: "MSA" }) + txtAtada(c.id, f.id), fuerza: ok && fcLibre(c.id, f.id) ? 3 : 1, ref: c.id })
      if (!ok) alertas.push(`⚠️ La factura Nº ${nf[1]}-${nf[2]} es de ${plata(totalFc(c))} y el débito de ${plata(imp)}`)
    }
    // 2 · facturas de MSA, por los tres importes posibles
    if (!esCargoBanco(f)) {
      for (const c of fcMsa) {
        if (c.id === f.comprobante_arca_id || cands.some(x => x.ref === c.id)) continue
        const m = montosFc(c).find(([, x]) => igual(x, imp)); if (!m) continue
        const dd = dias(f.fecha, c.fecha_emision); if (dd < (cta.tarjeta ? -2 : -45) || dd > (cta.tarjeta ? 20 : 240)) continue   // tarjeta: débito automático, la factura viene ANTES
        if (cuit && cuit !== CUIT_MSA && c.cuit !== cuit) { alertas.push(`Mismo importe, OTRO proveedor (no se propone): ${descFc({ ...c, empresa: "MSA" })}`); continue }
        const libre = fcLibre(c.id, f.id)
        cands.push({ tipo: `Factura MSA (${m[0]})`, texto: descFc({ ...c, empresa: "MSA" }) + txtAtada(c.id, f.id) + ` · ${dd} días`, fuerza: !libre ? 1 : cuit ? 3 : 2, ref: c.id })
      }
      // 3 · sumas de 2–3 facturas del MISMO proveedor (sólo si se sabe quién es)
      if (cuit && cuit !== CUIT_MSA) {
        const delProv = fcMsa.filter(c => c.cuit === cuit && fcLibre(c.id, f.id) && !["conciliado", "pagado"].includes(String(c.estado)) && dias(f.fecha, c.fecha_emision) >= (cta.tarjeta ? -2 : -45) && dias(f.fecha, c.fecha_emision) <= (cta.tarjeta ? 35 : 240)).slice(0, 25)
        for (const s of subconjuntos(delProv, totalFc, imp)) cands.push({ tipo: `Suma de ${s.length} facturas del proveedor`, texto: s.map(c => `${esNC(c) ? "NC" : "FC"} ${c.numero_desde} ${dmy(c.fecha_emision)} ${plata(totalFc(c))}`).join(" + "), fuerza: 2, ref: s.map(c => c.id).join(",") })
        // y la suma neta de retención
        for (const s of subconjuntos(delProv.filter(c => n(c.monto_sicore) > 0 || true), c => r2(totalFc(c) - n(c.monto_sicore)), imp)) if (s.some(c => n(c.monto_sicore) > 0))
          cands.push({ tipo: `Suma de ${s.length} facturas netas de retención`, texto: s.map(c => `FC ${c.numero_desde} ${dmy(c.fecha_emision)} ${plata(totalFc(c))} − ret ${plata(n(c.monto_sicore))}`).join(" + "), fuerza: 2, ref: s.map(c => c.id).join(",") })
      }
      // 4 · grupos de pago
      for (const g of grupos.filter(g => igual(n(g.monto_total), imp))) {
        if (cuit && g.cuit && g.cuit !== cuit) { alertas.push(`Grupo de pago del mismo importe pero de otro proveedor (${g.proveedor})`); continue }
        const fs = fcMsa.filter(c => c.grupo_pago_id === g.id)
        cands.push({ tipo: "Grupo de pago", texto: `${g.proveedor} · ${plata(n(g.monto_total))} · ${g.estado} · ${fs.length} facturas: ${fs.map(c => `${c.numero_desde} ${plata(totalFc(c))}`).join(", ")}`, fuerza: cuit && g.cuit === cuit ? 3 : 2, ref: g.id })
      }
      // 5 · facturas de MA / PAM del mismo proveedor e importe (pago cruzado)
      for (const c of fcOtras) {
        if (!igual(totalFc(c), imp) || (cuit && c.cuit !== cuit) || !cuit) continue
        const dd = dias(f.fecha, c.fecha_emision); if (dd < -45 || dd > 240) continue
        cands.push({ tipo: `Factura de ${c.empresa} pagada por MSA`, texto: descFc(c) + txtAtada(c.id, f.id), fuerza: 1, ref: c.id })
      }
    }
    // 6 · sueldos (y el que ató el motor, aunque esté lejos)
    if (f.sueldo_pago_id && !sueldos.some(p => p.id === f.sueldo_pago_id && igual(n(p.monto), imp) && p.fecha && Math.abs(dias(f.fecha, p.fecha)) <= 25)) {
      const p = sueldos.find(p => p.id === f.sueldo_pago_id), e = p ? empNombre.get(p.empleado_id) : null
      cands.push({ tipo: "Sueldo atado por el motor", texto: p ? `${e?.nombre ?? "?"} · ${p.tipo ?? ""} ${dmy(p.fecha)} ${plata(n(p.monto))} · ${p.estado}` : "pago de sueldo que no encuentro", fuerza: p && igual(n(p.monto), imp) ? 2 : 1, ref: f.sueldo_pago_id })
      if (p && Math.abs(dias(f.fecha, p.fecha)) > 25) alertas.push(`⚠️ El sueldo atado por el motor es del ${dmy(p.fecha)} (${dias(f.fecha, p.fecha)} días)`)
    }
    for (const p of sueldos.filter(p => igual(n(p.monto), imp) && p.fecha && Math.abs(dias(f.fecha, p.fecha)) <= 25)) {
      const e = empNombre.get(p.empleado_id)
      const otro = sueldoUsado.has(p.id) && sueldoUsado.get(p.id) !== f.id
      cands.push({ tipo: p.id === f.sueldo_pago_id ? "Sueldo atado por el motor" : "Pago de sueldo", texto: `${e?.nombre ?? "?"} · ${p.tipo ?? ""} ${dmy(p.fecha)} ${plata(n(p.monto))} · ${p.estado}${otro ? " ⚠️ ya atado a otro movimiento" : ""}`, fuerza: otro ? 1 : 2, ref: p.id })
    }
    // 7 · pagos a cuenta (anticipos) pendientes
    for (const a of anticipos.filter(a => a.tipo === "pago" && igual(n(a.monto), imp) && a.estado !== "vinculado"))
      { if (cands.some(c => c.ref === a.id)) continue
      const otro = anticipoUsado.has(a.id) && anticipoUsado.get(a.id) !== f.id
      cands.push({ tipo: "Pago a cuenta registrado", texto: `${a.nombre_proveedor} (${a.cuit_proveedor}) · ${dmy(a.fecha_pago)} ${plata(n(a.monto))} · ${a.descripcion ?? ""} · ${a.estado}${otro ? " ⚠️ ya atado a otro movimiento" : ""}`, fuerza: otro ? 1 : cuit && a.cuit_proveedor === cuit ? 3 : 2, ref: a.id }) }
  } else {
    // créditos: ventas (con y sin retenciones), cobros a cuenta
    for (const v of ventas) {
      const tot = n(v.imp_total), ret = n(retPorVenta.get(v.id)) + n(v.ret_iibb) + n(v.ret_iva)
      const como = igual(tot, imp) ? "total" : ret && igual(r2(tot - ret), imp) ? `neto de retenciones (${plata(ret)})` : null
      if (!como) continue
      const dd = dias(f.fecha, v.fecha_liquidacion ?? f.fecha); if (Math.abs(dd) > 150) continue
      if (cuit && cuit !== CUIT_MSA && v.cuit_cliente !== cuit) { alertas.push(`Venta del mismo importe a OTRO cliente (no se propone): ${v.denominacion_cliente} ${v.nro_comprobante}`); continue }
      cands.push({ tipo: `Cobro de venta (${como})`, texto: `${v.denominacion_cliente} (${v.cuit_cliente}) · ${v.nro_comprobante} del ${dmy(v.fecha_liquidacion)} · ${plata(tot)} · ${v.estado}`, fuerza: cuit ? 3 : 2, ref: v.id })
    }
    for (const a of anticipos.filter(a => a.tipo === "cobro" && igual(n(a.monto), imp)))
      cands.push({ tipo: "Cobro a cuenta registrado", texto: `${a.nombre_proveedor} · ${dmy(a.fecha_pago)} ${plata(n(a.monto))} · ${a.estado}`, fuerza: 2, ref: a.id })
  }
  // 8 · cuotas de templates de MSA (no usadas)
  if (!cands.some(c => c.fuerza === 3)) for (const c of cuotas) {
    if (!igual(n(c.monto), imp) || !c.fecha_estimada || Math.abs(dias(f.fecha, c.fecha_estimada)) > 25) continue
    const t = tplPorId.get(c.egreso_id)
    if (cuit && t?.cuit_quien_cobra && t.cuit_quien_cobra !== cuit) { alertas.push(`Cuota del mismo importe de un template de OTRO beneficiario: «${t.nombre_referencia}»`); continue }
    const usada = cuotaUsada.get(c.id)
    cands.push({ tipo: "Cuota de template", texto: `«${t?.nombre_referencia}» ${dmy(c.fecha_estimada)} ${plata(n(c.monto))} · ${c.estado}${usada ? ` ⚠️ ya atada a ${usada}` : ""}`, fuerza: usada ? 1 : 2, ref: c.id })
  }
  // 8a · proveedor conocido y ninguna candidata: sus facturas más cercanas (se muestran, no se proponen)
  if (deb && cuit && cuit !== CUIT_MSA && !cands.some(c => c.fuerza >= 2)) {
    const delProv = fcMsa.filter(c => c.cuit === cuit && Math.abs(dias(f.fecha, c.fecha_emision)) <= 45).sort((a, b) => Math.abs(dias(f.fecha, a.fecha_emision)) - Math.abs(dias(f.fecha, b.fecha_emision))).slice(0, 4)
    for (const c of delProv) cands.push({ tipo: "Factura del proveedor (NO coincide el importe)", texto: descFc({ ...c, empresa: "MSA" }) + txtAtada(c.id, f.id) + ` · diferencia ${plata(r2(imp - totalFc(c)))}`, fuerza: 1, ref: c.id })
    if (!delProv.length && f.fecha >= "2025-07-01") alertas.push(`${nombreCuit.get(cuit) ?? cuit} no tiene facturas a MSA en ±45 días`)
  }
  // 8b · cuotas CERCANAS (no exactas) de los templates a los que fue antes este tipo de movimiento: se muestran, no se proponen
  if (!cands.length) {
    const m = historia.get(claveMov(f))
    const nombres = m ? [...m.keys()].map(v => v.match(/template «(.+?)»/)?.[1]).filter(Boolean) as string[] : []
    const ids = new Set(tpls.filter(t => nombres.includes(t.nombre_referencia) && esMSA(t)).map(t => t.id))
    const cerca = cuotas.filter(c => ids.has(c.egreso_id) && c.fecha_estimada && Math.abs(dias(f.fecha, c.fecha_estimada)) <= 20 && !cuotaUsada.has(c.id)
        && n(c.monto) > 0 && Math.abs(n(c.monto) - imp) <= 0.25 * imp)
      .filter((c, i, xs) => xs.findIndex(y => y.egreso_id === c.egreso_id && y.fecha_estimada === c.fecha_estimada && igual(n(y.monto), n(c.monto))) === i)
      .sort((a, b) => Math.abs(n(a.monto) - imp) - Math.abs(n(b.monto) - imp)).slice(0, 4)
    for (const c of cerca) cands.push({ tipo: "Cuota cercana (NO coincide el importe)", texto: `«${tplPorId.get(c.egreso_id)?.nombre_referencia}» ${dmy(c.fecha_estimada)} ${plata(n(c.monto))} · ${c.estado} · diferencia ${plata(r2(imp - n(c.monto)))}`, fuerza: 1, ref: c.id })
  }
  // 9 · la otra punta (cuentas propias de MSA y del grupo): mismo importe, sentido contrario, ±3 días
  for (const x of movsDeOtrasCuentas) {
    const otro = deb ? n(x.creditos) : n(x.debitos)
    if (!igual(otro, imp) || Math.abs(dias(f.fecha, x.fecha)) > 3) continue
    const propia = ["msa_galicia", "santander", "cc_usd"].includes(x.cuenta)
    if (!propia && !/TRANSF|TRF|INTERBANK|CTAS PROPIAS|PAGO A PROV|CASH/i.test(String(x.descripcion ?? ""))) continue
    cands.push({ tipo: propia ? "Otra punta en otra cuenta de MSA" : `Otra punta en ${x.cuenta}`, texto: `${x.cuenta} ${dmy(x.fecha)} «${x.descripcion}» ${plata(otro)} · ${x.estado}`, fuerza: propia && (cuit === CUIT_MSA || /PROPIAS|INTERBANK/i.test(d)) ? 3 : 1, ref: x.id })
  }
  return { cands, alertas: [...new Set(alertas)], cuit, cuitFuente }
}

// ── Tarjeta: pagos y controles por resumen ───────────────────────────────────────────────────────────────
const debitosVisa = cta.tarjeta ? (await todo(() => sb.from("msa_galicia").select("id,fecha,debitos,estado,descripcion,template_cuota_id,nro_resumen"))).filter(x => /VISA/i.test(x.descripcion ?? "")) : []
const usadosVisa = new Set<string>(), debitoDePago = new Map<string, any>()
if (cta.tarjeta) for (const p of filas.filter(f => /^SU PAGO EN PESOS/i.test(f.descripcion ?? "")).sort((a, b) => a.fecha.localeCompare(b.fecha))) {
  const dd = debitosVisa.filter(d => !usadosVisa.has(d.id) && igual(n(d.debitos), n(p.creditos)) && Math.abs(dias(d.fecha, p.fecha)) <= 5).sort((a, b) => Math.abs(dias(a.fecha, p.fecha)) - Math.abs(dias(b.fecha, p.fecha)))[0]
  if (dd) { usadosVisa.add(dd.id); debitoDePago.set(p.id, dd) }
}
const resumenes = cta.tarjeta ? filas.filter(f => f.estado === "total").sort((a, b) => String(a.fecha_cierre ?? a.fecha).localeCompare(String(b.fecha_cierre ?? b.fecha))) : []
const res = resumenes.map(r => {
  const rows = filas.filter(f => f.nro_resumen === r.nro_resumen && f.estado !== "total")
  const pagos = rows.filter(x => /^SU PAGO EN PESOS/i.test(x.descripcion)), otros = rows.filter(x => !/^SU PAGO/i.test(x.descripcion))
  const consumos = r2(otros.reduce((t, x) => t + n(x.debitos), 0)), bonif = r2(otros.reduce((t, x) => t + n(x.creditos), 0)), pag = r2(pagos.reduce((t, x) => t + n(x.creditos), 0))
  return { nr: r.nro_resumen, cierre: r.fecha_cierre ?? r.fecha, saldoAnt: n(r.creditos), pag, pagos, consumos, bonif, saldo: n(r.debitos), c1: r2(n(r.creditos) - pag + consumos - bonif - n(r.debitos)) }
})
const resDe = new Map(res.map(r => [r.nr, r]))
// Peajes y servicios facturados por mes: una factura = suma de varias pasadas del mismo comercio
const sumaMensual = new Map<string, string>()
if (cta.tarjeta) {
  const porCuit = new Map<string, any[]>()
  for (const f of abiertos) { const a = cuitAprendido(f); if (a && n(f.debitos) > 0) porCuit.set(a.cuit, [...(porCuit.get(a.cuit) ?? []), f]) }
  for (const [cuit, movs] of porCuit) for (const c of fcMsa.filter(c => c.cuit === cuit && fcLibre(c.id, "-"))) {
    const cerca = movs.filter(m => { const dd = dias(c.fecha_emision, m.fecha); return dd >= -5 && dd <= 40 }).slice(0, 14)
    if (cerca.length < 2) continue
    const s = subconjuntos(cerca, m => n(m.debitos), totalFc(c), 14)[0]
    if (s) for (const m of s) sumaMensual.set(m.id, `${descFc({ ...c, empresa: "MSA" })} = suma de ${s.length} consumos (${s.map(x => `${dmy(x.fecha)} ${plata(n(x.debitos))}`).join(" + ")})`)
  }
}

// Emparejamiento por fecha para proveedor + importe repetido
const emparejados = new Map<string, Map<string, any>>()
function emparejar(f: any, cuit: string, monto: number): any | null {
  const k = `${cuit}|${monto}`
  if (!emparejados.has(k)) {
    const movs = abiertos.filter(m => n(m.debitos) > 0 && igual(n(m.debitos), monto) && (cta.tarjeta ? cuitAprendido(m)?.cuit === cuit : cuitDelBanco(m) === cuit)).sort((a, b) => a.fecha.localeCompare(b.fecha))
    const fcs = fcMsa.filter(c => c.cuit === cuit && igual(totalFc(c), monto) && fcLibre(c.id, "-")).sort((a, b) => a.fecha_emision.localeCompare(b.fecha_emision))
    const usadas = new Set<string>(), mapa = new Map<string, any>()
    for (const m of movs) {
      const c = fcs.filter(c => !usadas.has(c.id) && dias(m.fecha, c.fecha_emision) >= -2 && dias(m.fecha, c.fecha_emision) <= 20).sort((a, b) => dias(m.fecha, a.fecha_emision) - dias(m.fecha, b.fecha_emision))[0]
      if (c) { usadas.add(c.id); mapa.set(m.id, c) }
    }
    emparejados.set(k, mapa)
  }
  return emparejados.get(k)!.get(f.id) ?? null
}

// ── Propuesta ────────────────────────────────────────────────────────────────────────────────────────────
interface Prop { seguridad: "ALTA" | "MEDIA" | "BAJA" | "SIN"; accion: string; cuenta: string; porque: string; candidatas: string; alertas: string; cuit: string; ref?: string }
function propuesta(f: any): Prop | null {
  if (!["pendiente", "auditar"].includes(String(f.estado))) return null
  const { cands, alertas, cuit, cuitFuente } = candidatas(f)
  const d = String(f.descripcion ?? ""), imp = n(f.debitos) || n(f.creditos) || n(f.debitos_usd) || n(f.creditos_usd)
  const lista = cands.sort((a, b) => b.fuerza - a.fuerza).map((c, i) => `${i + 1}) [${c.fuerza === 3 ? "fuerte" : c.fuerza === 2 ? "por importe" : "débil"}] ${c.tipo}: ${c.texto}`).join("\n")
  const base = { candidatas: lista, alertas: alertas.join("\n"), cuit: cuit ? `${nombreCuit.get(cuit) ?? ""} ${cuit}${cuitFuente ? ` (según ${cuitFuente})` : ""}`.trim() : "" }
  const a = comoAntes(f)
  // Ejercicio 24/25 (antes del 01/07/2025): ya cerrado y sin facturas cargadas
  if (f.fecha < "2025-07-01" && !/^SU PAGO/i.test(d)) return { ...base, seguridad: "MEDIA", cuenta: "", accion: "Ejercicio 24/25 (ya cerrado) → queda en histórico",
    porque: "Movimiento anterior al 01/07/2025: no es del balance 25/26 y la app no tiene facturas de MSA de ese período (las cargadas arrancan el 01/07/2025)" }
  // Tarjeta: pagos
  if (cta.tarjeta && /^SU PAGO EN PESOS/i.test(d)) {
    const deb = debitoDePago.get(f.id), r = resDe.get(f.nro_resumen), ok1 = r && Math.abs(r.c1) < 0.01
    return { ...base, seguridad: deb && ok1 ? "ALTA" : deb || (f.fecha < "2025-07-01" && ok1) ? "MEDIA" : "SIN", cuenta: "Tarjetas MSA",
      accion: deb ? `Vincular con el «Pago Visa Empresa» del ${dmy(deb.fecha)} (${deb.estado})` : f.fecha < "2025-07-01" ? "El débito es del ejercicio 24/25: el extracto de Galicia MSA arranca el 01/07/2025. Cerrar como pagado (control 1 ✓)" : "Revisar: no hay débito «Pago Visa Empresa» de ese importe (±5 días)",
      porque: `${plata(n(f.creditos))} · control 1 del resumen ${ok1 ? "✓" : r ? `✗ (dif ${plata(r.c1)})` : "sin resumen"} · control 2 ${deb ? "✓" : "✗"}` }
  }
  if (cta.tarjeta && /^SU PAGO EN USD/i.test(d)) {
    const deb = debitosVisa.filter(x => !usadosVisa.has(x.id) && Math.abs(dias(x.fecha, f.fecha)) <= 3).sort((a, b) => Math.abs(dias(a.fecha, f.fecha)) - Math.abs(dias(b.fecha, f.fecha)))[0]
    if (deb) usadosVisa.add(deb.id)
    return { ...base, seguridad: deb ? "ALTA" : "SIN", cuenta: "Tarjetas MSA", accion: deb ? `Vincular con el «Pago Visa Empresa» del ${dmy(deb.fecha)} por ${plata(n(deb.debitos))} (la parte en dólares, pagada en pesos)` : "Revisar: no encontré el débito en pesos de la parte en dólares",
      porque: deb ? `US$ ${n(f.creditos_usd)} → ${plata(n(deb.debitos))} (≈ ${Math.round(n(deb.debitos) / (n(f.creditos_usd) || 1))} por dólar)` : `US$ ${n(f.creditos_usd)}` }
  }
  // Tarjeta: suma mensual de un comercio contra una factura
  if (sumaMensual.has(f.id) && !cands.some(c => c.fuerza === 3 && /Factura/.test(c.tipo)))
    return { ...base, seguridad: "ALTA", cuenta: "", accion: "Conciliar contra la factura mensual del comercio (junto con los otros consumos de la suma)", porque: sumaMensual.get(f.id)! }
  if (cta.usd) {
    const U: [RegExp, string, string][] = [[/Saldo de inicio/i, "Apertura del ejercicio", "Informativo: saldo inicial al 30/06/2025 (US$ 35.001,63 · TC 1165)"],
      [/COMISION MANTENIMIENTO/i, "Comision Cuenta Bancaria", "Comisión de mantenimiento de la cuenta en dólares"], [/^IVA$/i, "Iva Bancario", "IVA de la comisión"],
      [/IMP\. DEB\. LEY 25413/i, "Debitos / Creditos", "Impuesto al débito (ley 25.413)"], [/PERCEP\. IVA/i, "Percepcion IVA", "Percepción de IVA (servicios digitales)"],
      [/IIBB SERV DIGITALES/i, "IIBB Bancario", "Percepción de IIBB servicios digitales"], [/GOOGLE/i, "INFORMATICA", "Google One (suscripción, se paga en dólares)"],
      [/Galicia Securities/i, "Inversiones (colocación)", "Transferencia a Galicia Securities: es la cuenta comitente de MSA → no es gasto, es una colocación"]]
    const u = U.find(([re]) => re.test(d))
    if (u) return { ...base, seguridad: /Securities|inicio/i.test(d) ? "BAJA" : "MEDIA", cuenta: u[1], accion: /inicio/i.test(d) ? "Informativo (apertura)" : /Securities/i.test(d) ? "Confirmá: colocación en Galicia Securities" : `Template de cargos en dólares → ${u[1]}`, porque: `${u[2]} · US$ ${n(f.debitos) || n(f.creditos)} · la cuenta en dólares no tiene nada conciliado: no hay historia, la propuesta sale del tipo de movimiento` }
  }
  const fuertes = cands.filter(c => c.fuerza === 3), medias = cands.filter(c => c.fuerza === 2)
  const motor = cands.find(c => /atada por el motor/.test(c.tipo))
  const bloqueante = alertas.some(x => x.startsWith("🚫"))
  if (motor && !bloqueante && (motor.fuerza >= 2) && fuertes.filter(c => c !== motor).length === 0 && medias.filter(c => c !== motor).length === 0)
    return { ...base, ref: motor.ref, seguridad: motor.fuerza === 3 ? "ALTA" : "MEDIA", cuenta: fcPorId.get(motor.ref!)?.cuenta_contable ?? "", accion: "Confirmar lo que propuso el motor", porque: `${motor.texto}${f.motivo_revision ? ` · Motor: ${f.motivo_revision}` : ""}` }
  if (motor && bloqueante) {
    const alt = cands.filter(c => c !== motor && c.fuerza >= 2)
    return { ...base, seguridad: alt.length === 1 ? "MEDIA" : "BAJA", cuenta: a?.v.split(" · ")[0] ?? "", accion: `NO confirmar lo del motor${alt.length === 1 ? ` → ${alt[0].tipo}` : alt.length ? " → elegir entre las candidatas" : a ? ` → como antes: ${a.v}` : " → a estudiar"}`, porque: alertas.filter(x => x.startsWith("🚫")).join(" · ") }
  }
  if (fuertes.length === 1) { const c = fuertes[0]; return { ...base, ref: c.ref, seguridad: "ALTA", cuenta: c.ref && fcPorId.get(c.ref)?.cuenta_contable || "", accion: `${c.tipo} →  conciliar`, porque: c.texto } }
  if (fuertes.length > 1) {
    // Mismo proveedor y mismo importe todos los meses (p. ej. un peaje fijo): se empareja por orden de fecha, cada factura una sola vez
    const facts = fuertes.filter(c => /^Factura MSA/.test(c.tipo)).map(c => fcPorId.get(c.ref!)).filter(Boolean)
    if (facts.length === fuertes.length && new Set(facts.map(x => `${x.cuit}|${r2(totalFc(x))}`)).size === 1) {
      const elegida = emparejar(f, facts[0].cuit, r2(totalFc(facts[0])))
      if (elegida) return { ...base, ref: elegida.id, seguridad: "ALTA", cuenta: elegida.cuenta_contable ?? "", accion: "Factura MSA →  conciliar (emparejada por orden de fecha)",
        porque: `${descFc(elegida)} · el proveedor cobra el mismo importe varios meses: cada débito va con la factura INMEDIATA ANTERIOR (débito automático) que no tomó otro débito` }
    }
    return { ...base, seguridad: "BAJA", cuenta: "", accion: `Hay ${fuertes.length} candidatas fuertes: elegir`, porque: "Ver la lista" }
  }
  if (medias.length === 1 && !(a && esCargoBanco(f))) { const c = medias[0]; return { ...base, ref: c.ref, seguridad: "MEDIA", cuenta: c.ref && fcPorId.get(c.ref)?.cuenta_contable || "", accion: `${c.tipo} → conciliar (sólo coincide el importe: confirmalo)`, porque: c.texto } }
  if (medias.length > 1) return { ...base, seguridad: "BAJA", cuenta: "", accion: `Hay ${medias.length} candidatas por importe: elegir`, porque: "Ninguna se distingue de las otras sin el destinatario. Ver la lista" }
  if (a && /· factura/.test(a.v) && a.claro && n(f.debitos) > 0)
    return { ...base, seguridad: "BAJA", cuenta: a.v.split(" · ")[0], accion: `Va contra factura (como siempre: ${a.v}) — falta la factura de este importe`,
      porque: `${base.cuit || "el comercio"}: ninguna factura del proveedor coincide${cands.length ? "; ver las más cercanas en la lista" : ""}. Historia: ${a.reparto}` }
  if (a) return { ...base, seguridad: a.claro ? "MEDIA" : "BAJA", cuenta: a.claro ? a.v.split(" · ")[0] : "", accion: a.claro ? `Igual que antes: ${a.v}` : "A estudiar: la historia no alcanza (el mismo tipo de movimiento fue a destinos distintos)",
    porque: `Historia de «${String(f.descripcion).trim()}» en esta cuenta (${a.total}): ${a.reparto}` }
  return { ...base, seguridad: "SIN", cuenta: "", accion: "A estudiar: no hay ninguna candidata", porque: `${d} · ${plata(imp)}${cuit ? ` · ${base.cuit}` : ""}` }
}

// ── Libro ────────────────────────────────────────────────────────────────────────────────────────────────
const GRIS = "E7E6E6", AZUL = "DDEBF7", VERDE = "E2EFDA", AMARILLO = "FFF2CC", ROJO = "F8CBAD"
const cab = (v: string, rgb: string) => ({ v, t: "s", s: { font: { bold: true }, fill: { fgColor: { rgb } }, alignment: { wrapText: true, vertical: "top" } } })
const num = (v: number) => ({ v, t: "n", z: "#,##0.00" })
const fx = (f: string, bold = false) => ({ f, t: "n", z: "#,##0.00", s: bold ? { font: { bold: true } } : undefined })
const txt = (v: string, rgb?: string) => ({ v, t: "s", s: { alignment: { wrapText: true, vertical: "top" }, ...(rgb ? { fill: { fgColor: { rgb } } } : {}) } })
const vinculo = (f: any) => { const c = f.template_cuota_id ? cuotaPorId.get(f.template_cuota_id) : null; const t = c ? tplPorId.get(c.egreso_id) : null
  const fc = f.comprobante_arca_id ? fcPorId.get(f.comprobante_arca_id) : null
  return t ? `template «${t.nombre_referencia}»` : fc ? `factura ${fc.denominacion_emisor} ${dmy(fc.fecha_emision)} ${plata(totalFc(fc))}` : f.sueldo_pago_id ? "sueldo" : f.anticipo_id ? "pago a cuenta" : f.comprobante_venta_id ? "venta" : "" }
const COLS: [string, string, (f: any, p: Prop | null) => any][] = [
  ["Fecha", GRIS, f => dmy(f.fecha)], ["Descripción", GRIS, f => f.descripcion],
  ...(cta.tarjeta ? [["Cuota", GRIS, (f: any) => f.cuota ?? ""], ["Resumen", GRIS, (f: any) => f.nro_resumen ?? ""], ["Cierre", GRIS, (f: any) => dmy(f.fecha_cierre)]] as [string, string, (f: any, p: Prop | null) => any][]
    : [["Concepto", GRIS, (f: any) => String(f.concepto ?? "").replace(/\s*\r?\n\s*/g, " | ")]] as [string, string, (f: any, p: Prop | null) => any][]),
  ["Débitos", GRIS, f => num(n(f.debitos))], ["Créditos", GRIS, f => num(n(f.creditos))],
  ...((cta.tarjeta ? [["Débitos US$", GRIS, (f: any) => num(n(f.debitos_usd))], ["Créditos US$", GRIS, (f: any) => num(n(f.creditos_usd))]] : []) as [string, string, (f: any, p: Prop | null) => any][]),
  ["Ejercicio", AZUL, f => ejercicio(f.fecha)], ["Estado app", AZUL, f => f.estado], ["Cuenta app", AZUL, f => f.categ ?? ""], ["Contable app", AZUL, f => f.contable ?? ""],
  ["Vínculo app", AZUL, f => vinculo(f)], ["Motivo del motor", AZUL, f => f.motivo_revision ?? ""],
  ["Quién (CUIT)", AZUL, (_f, p) => p?.cuit ?? ""],
  ["Seguridad", VERDE, (_f, p) => (p ? txt(p.seguridad, p.seguridad === "ALTA" ? VERDE : p.seguridad === "SIN" || p.seguridad === "BAJA" ? ROJO : AMARILLO) : "")],
  ["Propuesta: qué hacer", VERDE, (_f, p) => txt(p?.accion ?? "")], ["Propuesta: cuenta", VERDE, (_f, p) => p?.cuenta ?? ""], ["Propuesta: por qué", VERDE, (_f, p) => txt(p?.porque ?? "")],
  ["Todas las candidatas", VERDE, (_f, p) => txt(p?.candidatas ?? "")], ["Alertas", ROJO, (_f, p) => txt(p?.alertas ?? "")],
  ["JMS: OK / cambio", AMARILLO, () => ""], ["JMS: nota", AMARILLO, () => ""],
]
const L = (i: number) => XLSX.utils.encode_col(i)
const iCol = (t: string) => L(COLS.findIndex(c => c[0] === t))
const detalle = filas.filter(f => f.estado !== "total")
const props = detalle.map(f => propuesta(f))
// 🔒 Una factura (o cuota, o pago) se propone para UN solo movimiento: el más cercano después de ella; los demás quedan avisados
{
  const porRef = new Map<string, number[]>()
  props.forEach((p, i) => { if (p?.ref && (fcPorId.has(p.ref) || cuotaPorId.has(p.ref))) porRef.set(p.ref, [...(porRef.get(p.ref) ?? []), i]) })
  for (const [ref, idx] of porRef) {
    if (idx.length < 2) continue
    const fecha = fcPorId.get(ref)?.fecha_emision ?? cuotaPorId.get(ref)?.fecha_estimada
    const dist = (i: number) => { const dd = dias(detalle[i].fecha, fecha); return dd < -2 ? 9999 : dd }
    const gana = [...idx].sort((a, b) => dist(a) - dist(b))[0]
    for (const i of idx.filter(i => i !== gana)) {
      const p = props[i]!
      props[i] = { ...p, ref: undefined, seguridad: "BAJA", accion: "Falta la factura de este movimiento: la candidata ya es del otro", porque: `La que coincidía (${p.porque.slice(0, 160)}) va con el movimiento del ${dmy(detalle[gana].fecha)}, que está más cerca`,
        alertas: [p.alertas, `⚠️ Misma candidata que el movimiento del ${dmy(detalle[gana].fecha)} (${plata(n(detalle[gana].debitos) || n(detalle[gana].creditos))}): no puede ir a los dos`].filter(Boolean).join(" | ") }
    }
  }
}
const aoa: any[][] = [COLS.map(([t, c]) => cab(t, c))]
detalle.forEach((f, i) => aoa.push(COLS.map(([, , g]) => g(f, props[i]))))
const ult = aoa.length
aoa.push([])
const sub: any[] = COLS.map(() => "")
sub[1] = { v: "Subtotal de lo filtrado", t: "s", s: { font: { bold: true } } }
for (const t of ["Débitos", "Créditos", "Débitos US$", "Créditos US$"]) { const i = COLS.findIndex(c => c[0] === t); if (i >= 0) sub[i] = fx(`SUBTOTAL(9,${L(i)}2:${L(i)}${ult})`, true) }
aoa.push(sub)
const wsD = XLSX.utils.aoa_to_sheet(aoa)
wsD["!autofilter"] = { ref: `A1:${L(COLS.length - 1)}${ult}` }
wsD["!cols"] = COLS.map(([t]) => ({ wch: /candidatas/.test(t) ? 80 : /Alertas|por qué|qué hacer|Concepto|Motivo|Vínculo/.test(t) ? 45 : /Descrip|Quién/.test(t) ? 30 : 13 }))

const D = "Detalle!", rng = (c: string) => `${D}$${c}$2:$${c}$${ult}`
const cE = iCol("Estado app"), cS = iCol("Seguridad"), cDe = iCol("Débitos"), cCr = iCol("Créditos"), cEj = iCol("Ejercicio")
const estados = [...new Set(detalle.map(f => f.estado))].sort(), EJS = [...new Set(detalle.map(f => ejercicio(f.fecha)))].sort()
const aR: any[][] = [[{ v: `${cta.nombre.toUpperCase()} — a fondo (03/11/2026)`, t: "s", s: { font: { bold: true, sz: 13 } } }],
  ["Leer: verde = mi propuesta y TODAS las candidatas · rojo = alertas · amarillo = para que contestes vos. Seguridad ALTA = única y con identidad (CUIT, Nº de cheque, comercio); MEDIA = única sólo por importe; BAJA = varias; SIN = ninguna."], [],
  ["Por ESTADO en la app", "Ejercicio", "Movimientos", "Débitos", "Créditos"].map(t => cab(t, AZUL))]
const e0 = aR.length + 1
for (const ej of EJS) for (const e of estados) { const k = `${rng(cE)},"${e}",${rng(cEj)},"${ej}"`; aR.push([e, ej, { f: `COUNTIFS(${k})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${k})`), fx(`SUMIFS(${rng(cCr)},${k})`)]) }
const eN = aR.length
aR.push([], ["Lo ABIERTO por SEGURIDAD de la propuesta", "Ejercicio", "Movimientos", "Débitos", "Créditos"].map(t => cab(t, VERDE)))
const g0 = aR.length + 1
for (const ej of EJS) for (const s of ["ALTA", "MEDIA", "BAJA", "SIN"]) { const k = `${rng(cS)},"${s}",${rng(cEj)},"${ej}"`; aR.push([s, ej, { f: `COUNTIFS(${k})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${k})`), fx(`SUMIFS(${rng(cCr)},${k})`)]) }
const gN = aR.length
aR.push([], [cab("CONTROL", AMARILLO), "", cab("Movimientos", AMARILLO), cab("Débitos", AMARILLO), cab("Créditos", AMARILLO)])
const t0 = aR.length + 1
aR.push(["Todos los movimientos del Detalle", "", { f: `COUNTA(${D}B2:B${ult})`, t: "n" }, fx(`SUM(${rng(cDe)})`), fx(`SUM(${rng(cCr)})`)])
aR.push(["− suma por estado", "", { f: `SUM(C${e0}:C${eN})`, t: "n" }, fx(`SUM(D${e0}:D${eN})`), fx(`SUM(E${e0}:E${eN})`)])
aR.push([{ v: "= diferencia (tiene que dar 0)", t: "s", s: { font: { bold: true } } }, "", { f: `C${t0}-C${t0 + 1}`, t: "n" }, fx(`D${t0}-D${t0 + 1}`, true), fx(`E${t0}-E${t0 + 1}`, true)])
const kAb = `${rng(cE)},"pendiente"`, kAu = `${rng(cE)},"auditar"`
aR.push([], ["Pendientes + a auditar", "", { f: `COUNTIFS(${kAb})+COUNTIFS(${kAu})`, t: "n" }, fx(`SUMIFS(${rng(cDe)},${kAb})+SUMIFS(${rng(cDe)},${kAu})`), fx(`SUMIFS(${rng(cCr)},${kAb})+SUMIFS(${rng(cCr)},${kAu})`)])
const t1 = aR.length
aR.push(["− suma por seguridad", "", { f: `SUM(C${g0}:C${gN})`, t: "n" }, fx(`SUM(D${g0}:D${gN})`), fx(`SUM(E${g0}:E${gN})`)])
aR.push([{ v: "= sin propuesta (tiene que dar 0)", t: "s", s: { font: { bold: true } } }, "", { f: `C${t1}-C${t1 + 1}`, t: "n" }, fx(`D${t1}-D${t1 + 1}`, true), fx(`E${t1}-E${t1 + 1}`, true)])
const wsR = XLSX.utils.aoa_to_sheet(aR)
wsR["!cols"] = [{ wch: 60 }, { wch: 10 }, { wch: 13 }, { wch: 16 }, { wch: 16 }]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, wsR, "Resumen")
XLSX.utils.book_append_sheet(wb, wsD, "Detalle")
if (cta.tarjeta) {
  const P = ["Resumen", "Cierre", "Saldo anterior", "Pagos («Su pago»)", "Consumos", "Bonificaciones", "Saldo del resumen", "CONTROL 1: anterior − pagos + consumos − bonif. − saldo", "Débitos «Pago Visa Empresa»", "CONTROL 2: pagos − débitos", "Dónde y estado"]
  const aP: any[][] = [P.map(t => cab(t, /CONTROL/.test(t) ? AMARILLO : GRIS))]
  res.forEach((r, i) => { const row = i + 2, debs = r.pagos.map(p => debitoDePago.get(p.id)).filter(Boolean)
    aP.push([r.nr, dmy(r.cierre), num(r.saldoAnt), num(r.pag), num(r.consumos), num(r.bonif), num(r.saldo), fx(`C${row}-D${row}+E${row}-F${row}-G${row}`),
      num(r2(debs.reduce((t, d) => t + n(d.debitos), 0))), fx(`D${row}-I${row}`), debs.map(d => `${dmy(d.fecha)} ${d.estado}`).join(" + ")]) })
  const wsP = XLSX.utils.aoa_to_sheet(aP); wsP["!cols"] = P.map(t => ({ wch: /CONTROL|Dónde/.test(t) ? 30 : 16 }))
  XLSX.utils.book_append_sheet(wb, wsP, "Pagos")
}
fechasReales(wb as any)
const DIR = join("- Comunicacion JMS Claude - Archivos", "Balance", "Excels trabajando con claude")
let archivo = ""
for (let v = 1; ; v++) { archivo = join(DIR, `${cta.nombre} - a fondo (2026-11-03)${v > 1 ? ` v${v}` : ""}.xlsx`); if (!existsSync(archivo)) break }
if (!process.argv.includes("--seco")) XLSX.writeFile(wb, archivo)
const cnt = (s: string) => props.filter(p => p?.seguridad === s).length
console.log(`${cta.nombre}: ${detalle.length} movimientos · abiertos ${abiertos.length} → ALTA ${cnt("ALTA")} · MEDIA ${cnt("MEDIA")} · BAJA ${cnt("BAJA")} · SIN ${cnt("SIN")} · con alertas ${props.filter(p => p?.alertas).length}`)
if (cta.tarjeta) for (const r of res) console.log(`  ${r.nr} ${dmy(r.cierre)} c1=${r.c1} pagos=${r.pagos.length} con débito=${r.pagos.filter(p => debitoDePago.has(p.id)).length}`)
if (process.argv.includes("--ver")) detalle.forEach((f, i) => { const p = props[i]; if (p) console.log(`\n${dmy(f.fecha)} ${f.descripcion} ${n(f.debitos) || "+" + n(f.creditos)} [${f.estado}] → ${p.seguridad} · ${p.accion}\n   por qué: ${p.porque}${p.alertas ? `\n   ALERTAS: ${p.alertas.replace(/\n/g, " | ")}` : ""}${p.candidatas ? `\n   cands: ${p.candidatas.replace(/\n/g, " | ").slice(0, 400)}` : ""}`) })
console.log(process.argv.includes("--seco") ? "(seco: no se escribió)" : `\n✅ ${archivo}`)
