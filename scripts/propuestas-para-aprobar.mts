/**
 * ✅ PROPUESTAS PARA APROBAR (JMS 10/11: «de las cosas que vos más seguro estás me lo dejás en un Excel aparte, como unas fotos sólo de las
 * tablas de problemas, lo mejor explicadas; yo lo trato de ver ahí directo»). Una solapa por propuesta: qué pasa, qué se haría, los renglones
 * exactos y una columna «¿Va?» para aprobar en bloque. SÓLO LEE.  npx tsx scripts/propuestas-para-aprobar.mts
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { aplicarVistas } from "../lib/balance/formato-excel"
import { agregarHoja, vistasDe } from "../lib/balance/export-libro-diario"
import { cargarProblemasDeModalidad } from "../lib/templates/modalidad"
import { leerMovimientosDeCuotas } from "../lib/balance/movimientos-de-cuotas"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { fechasReales } from "../lib/excel/fechas-reales"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const dmy = (f: string | null | undefined) => (f ? String(f).slice(0, 10).split("-").reverse().join("/") : "")
const C = (v: string) => ({ t: "s", v, s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: { patternType: "solid", fgColor: { rgb: "FFEEF1F0" } } } })
const T = (v: string) => ({ t: "s", v, s: { font: { bold: true, sz: 13, color: { rgb: "FF1F4E3D" } } } })
const N = (v: string) => ({ t: "s", v, s: { alignment: { wrapText: true, vertical: "top" } } })
const MON = "#,##0.00"
const IMP = (v: number) => ({ t: "n", v: Math.round(v * 100) / 100, z: MON })
const VA = () => ({ t: "s", v: "", s: { fill: { patternType: "solid", fgColor: { rgb: "FFFFF2CC" } } } })
const wb = XLSX.utils.book_new()
/** Todas las filas (supabase corta en 1.000 por consulta). */
async function todas(q: () => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q().range(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) return out } }
// Uniones y altos se ponen directo en la hoja (los marcadores de formato-excel viven en otra copia del módulo al correr con tsx).
const UN = new WeakMap<unknown[][], string[]>(), AL = new WeakMap<unknown[][], Record<number, number>>()
const unirCeldas = (f: unknown[][], rs: string[]) => UN.set(f, [...(UN.get(f) ?? []), ...rs])
const altoDeFila = (f: unknown[][], r: number, h: number) => AL.set(f, { ...(AL.get(f) ?? {}), [r]: h })
function agregar(nombre: string, f: unknown[][], anchos: number[], filtro?: string, agrupar?: [number, number]) {
  agregarHoja(wb as any, nombre, f, anchos.map(ancho => ({ ancho })) as any)
  const ws = wb.Sheets[nombre.slice(0, 31)]
  ws["!merges"] = (UN.get(f) ?? []).map(u => XLSX.utils.decode_range(u))
  const rs: any[] = (ws["!rows"] ??= []); for (const [r, h] of Object.entries(AL.get(f) ?? {})) rs[Number(r) - 1] = { ...(rs[Number(r) - 1] ?? {}), hpt: h }
  // 📐 JMS 10/11 («en general listo para agrupar arriba… que se vea mejor la tabla larga de abajo»): la caja de explicación se pliega con el [-]
  if (agrupar) for (let r = agrupar[0]; r <= agrupar[1]; r++) rs[r - 1] = { ...(rs[r - 1] ?? {}), level: 1 }
  if (filtro) ws["!autofilter"] = { ref: filtro }
}
const VERDE = (v: string) => ({ t: "s", v, s: { font: { bold: true, color: { rgb: "FF1E6B3A" } }, fill: { patternType: "solid", fgColor: { rgb: "FFE2F0D9" } } } })
const SUBT = (v: string) => ({ t: "s", v, s: { font: { bold: true, color: { rgb: "FF1F4E3D" } }, fill: { patternType: "solid", fgColor: { rgb: "FFDDEBF7" } } } })
/** Alto (en puntos) para que un texto entre entero en un ancho de `ancho` caracteres: Excel no autoajusta celdas unidas. */
const altoTexto = (txt: string, ancho: number) => Math.max(20, Math.ceil(txt.length / Math.max(20, ancho * 0.95) + 0.3) * 15 + 6)
const resumen: Array<{ id: string; solapa: string; que: string; cuantos: number; importe: number; hacer: string }> = []
type TipoFila = "resp" | "tmpl" | "det" | "total"
interface OpcionesHoja { respuestaDe?: (i: number) => string | undefined; resuelto?: string; tituloVa?: string; notaVa?: string; sinIndice?: boolean; filasSubtitulo?: Set<number>; tipoFila?: (i: number) => TipoFila | undefined; cuantos?: number }
const ESTILO_FILA: Record<string, Record<string, unknown>> = {
  resp: { font: { bold: true, color: { rgb: "FFFFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "FF1F4E3D" } } },
  total: { font: { bold: true, color: { rgb: "FFFFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "FF0B2E24" } } },
  tmpl: { font: { bold: true, color: { rgb: "FF1F4E3D" } }, fill: { patternType: "solid", fgColor: { rgb: "FFDDEBF7" } }, alignment: { wrapText: true, vertical: "top" } },
}
/** Le pone el estilo del tipo de renglón a cada celda, sin perder el valor, la fórmula ni el formato de número. */
const conEstiloFila = (f: unknown[], tipo: TipoFila) => f.map(v => {
  const s = ESTILO_FILA[tipo]; if (!s) return v
  if (v && typeof v === "object" && "t" in (v as object)) return { ...(v as object), s: { ...((v as { s?: object }).s ?? {}), ...s } }
  return { t: typeof v === "number" ? "n" : "s", v: v ?? "", s }
})
function hoja(id: string, solapa: string, titulo: string, que: string, hacer: string, porque: string, enc: string[], filas: unknown[][], importe: number, anchos: number[], o: OpcionesHoja = {}) {
  const h: unknown[][] = [[{ t: "s", v: "⬅ Resumen", l: { Target: "#'Resumen'!A1" } }], [T(`${id} · ${titulo}`)], [], [C("Qué pasa"), N(que)], [C("Qué se haría"), N(hacer)], [C("Por qué"), N(porque)],
    [C(o.resuelto ? "Estado" : "¿Va todo?"), o.resuelto ? VERDE(o.resuelto) : VA(), N(o.resuelto ? "Ya está aplicado: los renglones de abajo quedan como registro de lo que se hizo." : (o.notaVa ?? "← escribí «sí», «no» o «sí salvo…». Si querés decidir renglón por renglón, usá la columna «¿Va?» de abajo."))],
    [], [...enc.map(C), C(o.tituloVa ?? "¿Va?"), C("Comentario")]]
  filas.forEach((f, i) => {
    const tipo = o.tipoFila?.(i)
    if (tipo) h.push([...conEstiloFila(f, tipo), tipo === "tmpl" ? { ...VA(), v: o.respuestaDe?.(i) ?? "" } : conEstiloFila([""], tipo)[0], tipo === "tmpl" ? "" : conEstiloFila([""], tipo)[0]])
    else h.push(o.filasSubtitulo?.has(i) ? [SUBT(String(f[0])), ...f.slice(1).map(() => ""), VA(), ""] : [...f, o.resuelto ? "" : VA(), ""])
  })
  // 📐 JMS 10/11: «está raro de formatos, no lo puedo leer». Las explicaciones iban en UNA celda angosta (la columna B de la tabla) y
  // Excel estiraba el renglón para abajo. Ahora ocupan todo el ancho de la tabla (celdas unidas) con el alto calculado.
  const ultima = XLSX.utils.encode_col(enc.length + 1)
  const anchoTexto = anchos.slice(1).reduce((t, a) => t + a, 0)
  unirCeldas(h, ["A2:" + ultima + "2", ...[4, 5, 6].map(r => `B${r}:${ultima}${r}`), `C7:${ultima}7`])
  for (const [r, txt] of [[4, que], [5, hacer], [6, porque]] as const) altoDeFila(h, r, altoTexto(txt, anchoTexto))
  agregar(solapa, h, anchos, `A9:${ultima}${h.length}`, [3, 8])
  if (!o.sinIndice) resumen.push({ id, solapa, que: titulo, cuantos: o.cuantos ?? filas.length - (o.filasSubtitulo?.size ?? 0), importe, hacer: o.resuelto ? `${o.resuelto} — ${hacer}` : hacer })
}

// 🔍 LA FICHA (regla CLAUDE.md 10/11, «FICHA COMPLETA»): cada renglón trae todo lo que puede servir para decidir, como un detective.
const FICHA = ["Fecha", "Quién pagó (cuenta)", "Importe", "US$ (si fue en dólares)", "A quién (proveedor · CUIT)", "Detalle", "Template", "Responsable del template",
  "Cuenta contable", "Comprobante que dice que pagó", "Código contable hoy", "Interno hoy", "Descripción del banco", "Cómo se pasó a pesos / nota"]
const ANCHOS_FICHA = [11, 16, 14, 10, 34, 26, 22, 12, 24, 30, 13, 12, 36, 40]
const limpio = (x: unknown) => String(x ?? "").replace(/\s*\[script[^\]]*\]/g, "").replace(/\s+/g, " ").trim()
const SEL_CUOTA = "id, monto, fecha_estimada, estado, categ, detalle, descripcion, grupo_pago_id, egreso:egresos_sin_factura!inner(nombre_referencia, responsable, categ, nombre_quien_cobra, cuit_quien_cobra)"
async function cuotasPorId(ids: string[]): Promise<Map<string, any>> {
  const out = new Map<string, any>()
  for (let i = 0; i < ids.length; i += 200) { const { data, error } = await sb.from("cuotas_egresos_sin_factura").select(SEL_CUOTA).in("id", ids.slice(i, i + 200)); if (error) throw new Error(error.message); for (const c of data ?? []) out.set(c.id, c) }
  return out
}
const aQuien = (m: any, c?: any) => limpio([m.leyendas_adicionales_1, m.leyendas_adicionales_2].filter(Boolean).join(" · ") || m.proveedor_nombre || m.beneficiario
  || [c?.egreso?.nombre_quien_cobra, c?.egreso?.cuit_quien_cobra].filter(Boolean).join(" · ") || "")
/** Un renglón de ficha a partir de un movimiento (puede faltar) y su cuota. */
function ficha(m: any | null, cuenta: string, c: any, importe?: number) {
  const usd = Number(m?.debitos_usd ?? m?.usd ?? 0)
  return [dmy(m?.fecha ?? c?.fecha_estimada), m ? cuenta : "(sin pago)", IMP(importe ?? Number(c?.monto ?? m?.debitos ?? 0)),
    usd ? { t: "n", v: usd, z: MON } : "", aQuien(m ?? {}, c), limpio(m?.detalle || c?.detalle),
    c?.egreso?.nombre_referencia ?? "", c?.egreso?.responsable ?? "", c?.categ || c?.egreso?.categ || "(sin cuenta)", limpio(m?.comprobantes_pagados || m?.comprobante),
    m ? (m.contable || "(vacío)") : "", m ? (m.interno || "(vacío)") : "", limpio(m?.descripcion), limpio(c?.descripcion)]
}

// ── P1 · «DIST MA» en lo que pagó PAM de gastos de MA
const SEL_MOV = "id, fecha, descripcion, debitos, creditos, contable, interno, detalle, comprobantes_pagados, nota_operador, leyendas_adicionales_1, leyendas_adicionales_2, template_cuota_id"
const tpm = await todas(() => sb.schema("pam").from("tarjeta_visa").select(SEL_MOV + ", debitos_usd, proveedor_nombre, comprobante").not("template_cuota_id", "is", null).order("id"))
const gpm = await todas(() => sb.from("pam_galicia").select(SEL_MOV).not("template_cuota_id", "is", null).order("id"))
const aplicado246 = (m: any) => String(m.nota_operador ?? "").includes("[script 246]")
const movsPAM = [...tpm.map((m: any) => ({ ...m, cuenta: "VISA PAM" })), ...gpm.map((m: any) => ({ ...m, cuenta: "Galicia PAM CA" }))].filter((m: any) => !String(m.contable ?? "").trim() || aplicado246(m))
const cuotaDe = await cuotasPorId([...new Set(movsPAM.map((m: any) => m.template_cuota_id))] as string[])
const esMA = (c: any) => String(c?.egreso?.responsable ?? "").toUpperCase().startsWith("MA")
const p1 = movsPAM.filter((m: any) => esMA(cuotaDe.get(m.template_cuota_id)) && m.fecha >= "2025-07-01" && m.fecha <= "2026-07-31").sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
const hechos1 = p1.filter(aplicado246).length
hoja("P1", "P1 DIST MA", "Lo que pagó PAM de gastos de MA: falta el código «DIST MA»",
  `${p1.length} pagos de la VISA PAM (jul–dic 2025) y del Galicia PAM CA (Farmacity, 18/06/26) que pagaron templates de MA (Consumos MA, suscripciones, Gastos Médicos). El interno ya decía «DIST MA»; faltaba el código contable. Ene–abr 2026 ya lo tenían.`,
  `Contable «DIST MA» en esos movimientos (no se toca ninguna cuota ni importe). Es tu regla: «si PAM paga algo de MA, entonces DIST MA».`,
  "Aparecieron al pasar Consumos, Médicos y suscripciones 2025 a MA (scripts 239–240). Las compras en dólares (Apple, Skool) ya estaban pasadas a pesos con el TC de cada resumen (scripts 241–242).",
  [...FICHA, "Estado"], p1.map((m: any) => [...ficha(m, m.cuenta, cuotaDe.get(m.template_cuota_id)), aplicado246(m) ? "✅ aplicado (script 246)" : "pendiente"]),
  p1.reduce((t: number, m: any) => t + Number(cuotaDe.get(m.template_cuota_id).monto), 0), [...ANCHOS_FICHA, 22, 10, 30],
  { resuelto: hechos1 === p1.length ? "✅ RESUELTO (script 246, 10/11)" : undefined })

// 🧭 JMS 10/11: «sin hacer más de una solapa, hacé una segmentación: MSA todo junto, MA abajo, PAM abajo, con subtotales; después por template y
// por fecha… lo mismo para deudas». Una solapa por tema: renglón del RESPONSABLE (subtotal) → renglón del TEMPLATE (ahí se contesta) → sus cuotas.
// Y la columna «Posible pago sin vincular»: una cuota en $ 0 o sin pagar no tiene comprobante ni beneficiario propio — lo que sirve para decidir
// es si en alguna cuenta hay un pago suelto que sea suyo (como el anticipo de PAM de agosto, que apareció así).
const SEG = [...FICHA, "Posible pago sin vincular (busqué en todas las cuentas)", "Mi propuesta", "Por qué"]
const ANCHOS_SEG = [...ANCHOS_FICHA, 62, 16, 54, 28, 30]
const ORDEN_RESP = ["MSA", "MA", "PAM"]
const ordenResp = (r: string) => { const i = ORDEN_RESP.indexOf(r.toUpperCase().split(" ")[0]); return i < 0 ? 9 : i }
// los movimientos SIN vincular de todas las cuentas (sin cuota, sin factura, sin sueldo, sin anticipo), una sola lectura
const sueltos: Array<{ fecha: string; imp: number; cuenta: string; txt: string; ver: string }> = []
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const q = () => (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("*").gte("fecha", "2025-06-01").lte("fecha", "2026-08-31").order("id")
  let data: any[] = []
  try { data = await todas(q) } catch { continue }
  for (const m of data) {
    if (m.template_cuota_id || m.comprobante_arca_id || m.sueldo_pago_id || m.anticipo_id || m.comprobante_venta_id) continue
    const imp = Number(m.debitos) || 0; if (imp <= 0) continue
    const partes = [m.descripcion, m.detalle, m.leyendas_adicionales_1, m.leyendas_adicionales_2, m.concepto, m.categ].map(limpio).filter(Boolean)
    sueltos.push({ fecha: String(m.fecha).slice(0, 10), imp, cuenta: t.cuenta ?? t.tabla, txt: partes.join(" ").toLowerCase(),
      ver: `${dmy(m.fecha)} · ${t.cuenta ?? t.tabla} · $ ${imp.toLocaleString("es-AR", { minimumFractionDigits: 2 })} · «${[m.descripcion, m.detalle, m.leyendas_adicionales_1].map(limpio).filter(Boolean).join(" · ").slice(0, 90)}»` })
  }
}
/** Palabras con que el banco suele nombrar el pago de este template. */
function palabrasDe(nombre: string, extra: string[] = []): string[] {
  const n = nombre.toLowerCase(), w: string[] = []
  if (/anticipo|sicore|autonom|aportes|uatre|ganancias/.test(n)) w.push("afip", "arca", "vep")
  if (/iibb/.test(n)) w.push("arba", "iibb")
  if (/metrogas/.test(n)) w.push("metrogas")
  if (/expensas/.test(n)) w.push("consorcio", "expensa")
  if (/^aca/.test(n)) w.push("automovil", "automóvil", " aca")
  if (/internet nz/.test(n)) w.push("orbith")
  if (/automotores|red vial/.test(n)) w.push("municipalidad", "san pedro", "red vial", "automotor")
  if (/abl/.test(n)) w.push("abl", "gcba", "agip")
  if (/tarjeta visa/.test(n)) w.push("pago tarjeta visa", "visa")
  if (/uatre/.test(n)) w.push("uatre")
  for (const nom of ["andres", "jose", "manuel", "mechi", "soledad"]) if (n.includes(nom)) w.push(nom)
  return [...w, ...extra.map(x => x.toLowerCase()).filter(x => x.length >= 4)]
}
/** Hasta 2 pagos sueltos que podrían ser de esta cuota: por importe (el de la cuota, o el típico del template) y/o por palabras, cerca de la fecha. */
function candidatos(fecha: string, monto: number, tipico: number, palabras: string[], ya: Set<string>): string[] {
  const ref = monto > 0 ? monto : tipico
  const out: Array<[number, string]> = []
  for (const m of sueltos) {
    const dias = Math.abs((Date.parse(m.fecha) - Date.parse(fecha)) / 864e5); if (dias > 40) continue
    // estricto a propósito: un candidato flojo confunde más de lo que ayuda (en la 1ª prueba salía el Estudio Contable para los retiros).
    // Por PALABRAS del banco siempre; por IMPORTE solo, únicamente si la cuota tiene importe, casi exacto y cercano.
    const porTexto = palabras.some(p => m.txt.includes(p)) && (ref <= 0 || Math.abs(m.imp - ref) <= 0.6 * ref)
    const porImporte = monto > 0 && Math.abs(m.imp - monto) <= Math.max(1, 0.005 * monto) && dias <= 10
    const puntos = (porImporte ? 2 : 0) + (porTexto ? 2 : 0) - dias / 40
    if (porTexto || porImporte) out.push([puntos, m.ver])
  }
  return out.sort((a, b) => b[0] - a[0]).map(x => x[1]).filter(v => !ya.has(v)).slice(0, 2)
}
/** Si un pago suelto NOMBRA al template (ej. «Sicore 09 - 1ra»), la propuesta no puede ser «Nada a pagar»: pasa a «Revisar» y se dice por qué. */
function ojo(t: { nombre: string; propuesta: string; porque: string; cand: string[] }) {
  const clave = t.nombre.toLowerCase().replace(/\(.*$/, "").split(/[^a-záéíóúñ0-9]+/).find(w => w.length >= 4 && !/^(mensual|cuota|anual|semestral|retiro|tarjeta|aportes|libertad)$/.test(w))
  if (!clave) return
  const nombra = t.cand.filter(c => c.toLowerCase().includes(clave))
  if (nombra.length && t.propuesta !== "Ya decidido") { t.propuesta = "Revisar"; t.porque = `OJO: hay ${nombra.length === 1 ? "un pago sin vincular que nombra" : "pagos sin vincular que nombran"} «${clave}» (columna de al lado): puede que se haya pagado y falte vincular. ${t.porque}` }
}
interface Tmpl { respuesta?: string; resp: string; nombre: string; cuenta: string; aQuien: string; propuesta: string; porque: string; cuotas: Array<{ fecha: string; fila: unknown[] }>; cand: string[] }
/** Arma los renglones segmentados (responsable → template → cuotas por fecha) con subtotales en FÓRMULA (el control se ve). */
function segmentar(tmpls: Tmpl[]) {
  const filas: unknown[][] = [], tipos: TipoFila[] = [], respuestas: Array<string | undefined> = []
  const fila = (i: number) => 10 + i  // el encabezado de la tabla está en la fila 9
  const vacio = (n: number) => Array.from({ length: n }, () => "")
  const respTotales: Array<{ f: number; v: number }> = []
  for (const r of [...new Set(tmpls.map(t => t.resp))].sort((a, b) => ordenResp(a) - ordenResp(b) || a.localeCompare(b))) {
    const ts = tmpls.filter(t => t.resp === r).sort((a, b) => a.nombre.localeCompare(b.nombre))
    const iResp = filas.length; filas.push([]); tipos.push("resp")
    const tTot: Array<{ f: number; v: number }> = []
    for (const t of ts) {
      const iT = filas.length; filas.push([]); tipos.push("tmpl"); respuestas[iT] = t.respuesta
      const cs = [...t.cuotas].sort((a, b) => a.fecha.localeCompare(b.fecha))
      for (const c of cs) { filas.push([...c.fila, ...vacio(SEG.length - c.fila.length)]); tipos.push("det") }
      const v = cs.reduce((s, c) => s + Number((c.fila[2] as { v?: number })?.v ?? 0), 0)
      filas[iT] = [`${t.nombre}  (${cs.length} cuota${cs.length === 1 ? "" : "s"})`, "", { t: "n", f: cs.length ? `SUM(C${fila(iT + 1)}:C${fila(iT + cs.length)})` : "0", v, z: MON }, "", t.aQuien, "", t.nombre, t.resp, t.cuenta,
        ...vacio(5), t.cand.join("\n") || "(no encontré ninguno)", t.propuesta, t.porque]
      tTot.push({ f: fila(iT), v })
    }
    const v = tTot.reduce((s, x) => s + x.v, 0)
    const nCuotas = ts.reduce((s, t) => s + t.cuotas.length, 0)
    filas[iResp] = [`${r} — ${ts.length} template${ts.length === 1 ? "" : "s"} · ${nCuotas} cuota${nCuotas === 1 ? "" : "s"}`, "", { t: "n", f: tTot.map(x => `C${x.f}`).join("+") || "0", v, z: MON }, ...vacio(SEG.length - 3)]
    respTotales.push({ f: fila(iResp), v })
  }
  filas.push([`TOTAL — ${tmpls.length} templates · ${tmpls.reduce((s, t) => s + t.cuotas.length, 0)} cuotas`, "", { t: "n", f: respTotales.map(x => `C${x.f}`).join("+") || "0", v: respTotales.reduce((s, x) => s + x.v, 0), z: MON }, ...vacio(SEG.length - 3)]); tipos.push("total")
  return { filas, tipos, respuestas }
}

// ── P2 · Cuotas en $ 0 «conciliado» sin pago — por responsable, template y fecha
const anio = Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 4))
const { problemas } = await cargarProblemasDeModalidad(sb, anio)
// JMS 10/11: «no me des ingresos brutos en cero porque ya sabemos y eso va a quedar así» (SICORE igual: «lo que no, queda así… el contador lo tiene»)
const QUEDAN_ASI = /IIBB|SICORE/
const cerosTodos = problemas.filter(p => p.tipo === "conciliada_en_cero")
const ceros = cerosTodos.filter(p => !QUEDAN_ASI.test(p.template))
const quedanAsi = cerosTodos.filter(p => QUEDAN_ASI.test(p.template))
const c2 = await cuotasPorId(ceros.flatMap(p => p.cuotas.map(c => c.id)))
/** Mi lectura de cada template (a confirmar por JMS), con lo que se sabe. */
function lectura(nombre: string, conImporte: number): [string, string] {
  if (/Anticipo Ganancias MSA/.test(nombre)) return ["Nada a pagar", "Lo confirmaste: MSA no tuvo anticipos (todos cubiertos). Se aplica cuando exista el estado «Nada a pagar» (A-FEAT-1587)."]
  if (/SICORE/.test(nombre)) return ["Nada a pagar", "Probable: quincenas sin retenciones que depositar (las quincenas con importe sí se pagaron)."]
  if (/IIBB/.test(nombre)) return ["Nada a pagar", conImporte ? "Probable: meses con saldo a favor (los meses con importe sí se pagaron)." : "Probable: en todo el ejercicio no hubo importe a pagar (saldo a favor)."]
  if (/^Retiro/.test(nombre)) return ["Nada a pagar", conImporte ? "Probable: ese mes no hubo retiro (los otros sí)." : "Probable: en todo el ejercicio no hubo retiro."]
  if (/UATRE/.test(nombre)) return ["Revisar", "Los otros meses se pagaron: ¿estos meses no hubo nada que pagar, o falta vincular el pago? Mirá «Posible pago sin vincular»."]
  return ["Revisar", "Los otros meses se pagaron: puede faltar vincular el pago de este mes (o no hubo que pagar). Mirá «Posible pago sin vincular»."]
}
// lo que JMS ya contestó en la versión anterior de este archivo (P2) viaja a la nueva: no se le vuelve a preguntar
const carpetaP = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const { readdirSync: rdP } = await import("node:fs")
const numV = (f: string) => Number(f.match(/ v(\d+)\.xlsx$/)?.[1] ?? 1)
const previa = rdP(carpetaP).filter(f => f.startsWith("Propuestas para aprobar - H para auditar (2026-11-10)") && f.endsWith(".xlsx")).sort((a, b) => numV(a) - numV(b)).pop()
const yaContestado = new Map<string, string>()
if (previa) {
  const hp = XLSX.readFile(join(carpetaP, previa)).Sheets["P2 Ceros por template"]
  if (hp) {
    const a = XLSX.utils.sheet_to_json(hp, { header: 1, raw: false, defval: "" }) as string[][]
    const enc = a[8] ?? [], iR = enc.findIndex(x => /^Tu respuesta/.test(x)), iC = enc.indexOf("Comentario")
    for (const r of a.slice(9)) {
      const nom = String(r[0] ?? "").replace(/\s*\(\d+ cuotas?\)\s*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim()
      const txt = [r[iR], r[iC]].map(x => String(x ?? "").trim()).filter(Boolean).join(" · ")
      if (nom && txt) yaContestado.set(nom, `(tu respuesta en la v${numV(previa)}) ${txt}`)
    }
  }
}
const tmplsP2: Tmpl[] = []
for (const p of ceros) {
  const cuotasDelEj = await todas(() => sb.from("cuotas_egresos_sin_factura").select("id, monto, fecha_estimada, estado").eq("egreso_id", p.templateId).gte("fecha_estimada", "2025-07-01").lte("fecha_estimada", "2026-06-30").order("id"))
  const conPlata = cuotasDelEj.filter((c: any) => Number(c.monto) > 0 && c.estado !== "desactivado").map((c: any) => Number(c.monto)).sort((a: number, b: number) => a - b)
  const tipico = conPlata.length ? conPlata[Math.floor(conPlata.length / 2)] : 0
  const una = c2.get(p.cuotas[0].id)
  const [propuesta, porQue] = lectura(p.template, conPlata.length)
  const quien = [una?.egreso?.nombre_quien_cobra, una?.egreso?.cuit_quien_cobra].filter(Boolean)
  const palabras = palabrasDe(p.template, quien.map(String))
  const ya = new Set<string>()
  const cuotas = p.cuotas.map(c => {
    const cand = /Anticipo Ganancias MSA/.test(p.template) ? [] : candidatos(String(c.fecha ?? ""), 0, tipico, palabras, ya)
    cand.forEach(x => ya.add(x))
    const f = ficha(null, "", c2.get(c.id), c.monto); f[13] = `${limpio(f[13])}${f[13] ? " · " : ""}año del template: ${p.anio ?? "—"} · cuotas con importe en el ejercicio: ${conPlata.length}${tipico ? ` (típico $ ${tipico.toLocaleString("es-AR", { minimumFractionDigits: 2 })})` : ""}`
    return { fecha: String(c.fecha ?? ""), fila: [...f, cand.join("\n")] }
  })
  tmplsP2.push({ respuesta: yaContestado.get(p.template), resp: String(una?.egreso?.responsable ?? "?"), nombre: `${p.template}${p.anio ? ` (${p.anio})` : ""}`, cuenta: una?.categ || una?.egreso?.categ || "(sin cuenta)", aQuien: quien.join(" · "),
    propuesta, porque: porQue, cuotas, cand: [...new Set(cuotas.flatMap(c => String(c.fila[FICHA.length] ?? "").split("\n").filter(Boolean)))].slice(0, 3) })
}
tmplsP2.forEach(ojo)
const s2 = segmentar(tmplsP2)
hoja("P2", "P2 Ceros por template", "Cuotas en $ 0 «conciliado» sin ningún pago: ¿qué pasó en cada template?",
  `${ceros.reduce((t, p) => t + p.cuotas.length, 0)} cuotas en $ 0 de ${ceros.length} templates dicen «conciliado» pero no tienen ningún pago. Ordenadas por responsable (MSA, MA, PAM, con su subtotal), después por template y por fecha. Fuera de la lista: lo ya resuelto (anticipos, Caja, Expensas, IIBB MA, retiros de enero, SICORE con pago) y, por tu regla, IIBB y SICORE en $ 0 sin match («quedan así»): ${quedanAsi.map(p => `${p.template} ${p.cuotas.length}`).join(", ")}.`,
  "Contestás en la celda amarilla del renglón celeste de cada template, una de tres: «Nada a pagar» (correctamente en $ 0: estado nuevo, A-FEAT-1587) · «Se pagó, falta vincular» (lo busco y lo vinculo) · «Revisar». Los renglones blancos de abajo de cada template son sus cuotas, con la ficha completa.",
  "Una cuota en $ 0 no tiene pago, así que no tiene comprobante ni beneficiario propio: por eso la columna «Posible pago sin vincular» muestra, si existe, un pago suelto de cualquier cuenta que podría ser suyo (por importe típico del template, por palabras del banco y por fecha). Si no aparece ninguno, es más probable que no hubo nada que pagar.",
  SEG, s2.filas, 0, ANCHOS_SEG,
  { tipoFila: i => s2.tipos[i], respuestaDe: i => s2.respuestas[i], cuantos: tmplsP2.length, tituloVa: "Tu respuesta (Nada a pagar / Se pagó, falta vincular / Revisar)", notaVa: "← si estás de acuerdo con «Mi propuesta» en todos, escribí «sí». Si no, contestá en la celda amarilla de cada template (renglones celestes)." })

// ── P3 · Otros Gastos sin subcuenta → INFORMATICA (✅ script 249: las 9 cuotas, por id)
const ids249 = (JSON.parse(readFileSync("scripts/249-foto-antes.json", "utf8")) as Array<{ id: string }>).map(x => x.id)
const c3 = [...(await cuotasPorId(ids249)).values()].sort((a: any, b: any) => a.fecha_estimada.localeCompare(b.fecha_estimada))
const { movimientos: movs3 } = await leerMovimientosDeCuotas(sb, c3.map((c: any) => ({ id: c.id, grupoPagoId: c.grupo_pago_id })) as any)
const movDe3 = (c: any) => movs3.find(m => m.vinculo === c.id || m.vinculo === c.grupo_pago_id) ?? null
hoja("P3", "P3 Sin cuenta", "Cuotas de «Otros Gastos» sin subcuenta → INFORMATICA",
  `${c3.length} cuotas de «Otros Gastos» (vthebestpdf y Google One) no tenían subcuenta: su MOVIMIENTO ya decía INFORMATICA (lo habías puesto vos), pero a la cuota no le había llegado, y el balance lee la cuota («sin clasificar»). No hay otros casos así en ninguna cuenta.`,
  "Subcuenta INFORMATICA en la cuota. Sin código contable ni interno: son Otros Gastos de MSA (tu respuesta: «no implica ni contable ni interno, solamente le faltaba la subcuenta»).",
  "Tu respuesta del 10/11.",
  [...FICHA, "Subcuenta antes"], c3.map((c: any) => { const m = movDe3(c); return [...ficha(m, m?.cuenta ?? "", c), "(vacía)"] }),
  c3.reduce((t: number, c: any) => t + Number(c.monto), 0), [...ANCHOS_FICHA, 14, 10, 30], { resuelto: "✅ RESUELTO (script 249, 10/11)" })

// ── P4 · FLIA (✅ script 247: los 4 movimientos, por id)
const ids247 = (JSON.parse(readFileSync("scripts/247-foto-antes.json", "utf8")).movimientos as Array<{ id: string }>).map(x => x.id)
const { data: flia } = await sb.schema("ma").from("ma_galicia").select("id, fecha, descripcion, debitos, creditos, contable, interno, detalle, comprobantes_pagados, leyendas_adicionales_1, leyendas_adicionales_2, template_cuota_id").in("id", ids247)
flia.sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
const c4 = await cuotasPorId(flia.map((m: any) => m.template_cuota_id).filter(Boolean))
hoja("P4", "P4 FLIA", "Transferencias entre familiares: template «FLIA» en vez de código",
  "4 movimientos de MA CA tenían código «FLIA» y estaban en el template «Consumos MA» (sumaban como consumos). Son transferencias entre familiares: José María → MA ($ 2.001.000) y MA → Andrés ($ 325.000).",
  "Template «FLIA» de MA (entra y sale), las 4 cuotas pasaron ahí y los movimientos quedaron sin código contable ni interno. La categoría «FLIA» se creó en el plan sin rubro (no va a ningún lugar en particular). Tu regla de auditar toda transferencia de MA con alguien de la familia quedó como A-FEAT-1586.",
  "Tu respuesta: «FLIA no va a ninguna cuenta corriente… es la categoría del egreso o ingreso y no implica contable ni interno salvo que se diga lo contrario».",
  [...FICHA, "Entró / salió"], flia.map((m: any) => [...ficha(m, "Galicia MA CA", c4.get(m.template_cuota_id), Number(m.debitos) || Number(m.creditos)), Number(m.creditos) ? "entró a MA" : "salió de MA"]),
  flia.reduce((t: number, m: any) => t + Number(m.debitos) - Number(m.creditos), 0), [...ANCHOS_FICHA, 12, 10, 30], { resuelto: "✅ RESUELTO (script 247, 10/11)" })

// ── P5 · Vulcano (✅ script 250)
hoja("P5", "P5 Vulcano", "Reintegro de gastos médicos a Fabián Vulcano: gasto de MSA, no de MA",
  "La transferencia del Galicia MSA del 06/04/26 ($ 84.000 a Marcela Sandra Amestoy, CUIT 27177378858, «Reintegro Vulcano Gastos Medicos») estaba en «Otros Gastos» con «CTA MA», y además vinculada POR ERROR al pago de sueldo de Alondra Olivo («Pago Saldo Mar 2026», $ 84.000), que ya tiene su transferencia propia del 08/04/26.",
  "En Sueldos, Vulcano abril 2026: «Varios» $ 84.000 a cobrar (reintegro gastos médicos) y el pago del 06/04 vinculado a la transferencia (netea: el saldo del mes sigue en $ 1.760.000). La transferencia salió de Otros Gastos (cuota desactivada, «pasó a Sueldos») y quedó sin «CTA MA». Alondra quedó sólo con su transferencia del 08/04.",
  "Tu indicación: «a Vulcano hay que ponerle un concepto de esto del tema médico de 84… de ahí se le vincula la transferencia y ahí se netea». Vulcano y Elvio cobran siempre en efectivo de la caja (no cargada): por eso no tienen otros pagos.",
  ["Fecha", "Cuenta", "Importe", "A quién (CUIT)", "Detalle del banco", "Antes", "Ahora"],
  [[dmy("2026-04-06"), "Galicia MSA CC", IMP(84000), "Marcela Sandra Amestoy · 27177378858", "Trf Inmed Proveed — Reintegro Vulcano Gastos Medicos", "Otros Gastos · GASTOS VARIOS GANADERIA · CTA MA · vinculada al pago de Alondra Olivo", "Sueldos · Fabián Vulcano · abril 2026 · Varios (reintegro gastos médicos) · sin código"]],
  84000, [12, 16, 12, 30, 40, 44, 44, 10, 30], { resuelto: "✅ RESUELTO (script 250, 10/11)" })

// ── Abiertos (DR7, DR8, DR10): con TODO el contexto, copiados del último H para auditar («Datos a revisar»)
const carpeta = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const { readdirSync } = await import("node:fs")
const ultimaH = readdirSync(carpeta).filter(f => /^H para auditar MSA 25-26 \(2026-11-07\) v\d+\.xlsx$/.test(f)).sort((a, b) => Number(a.match(/v(\d+)/)![1]) - Number(b.match(/v(\d+)/)![1])).pop()!
const dr = XLSX.utils.sheet_to_json(XLSX.readFile(join(carpeta, ultimaH)).Sheets["Datos a revisar"], { header: 1, raw: true }) as unknown[][]
const encDR = ["Fecha", "Cuenta / quién pagó", "Importe", "Concepto", "Proveedor", "Comprobante", "Detalle", "Código", "Descripción del banco", "Beneficiario / CUIT", "Está en (solapa del H)"]
const filaDR = (x: unknown[]) => [typeof x[1] === "number" ? { t: "n", v: x[1], z: "dd/mm/yyyy" } : x[1], x[2], IMP(Number(x[3]) || 0), x[4], x[5], x[6], x[7], x[8], x[9], x[10], (x[11] as { v?: string })?.v ?? x[11] ?? ""]
const ANCHOS_DR = [11, 22, 14, 24, 22, 14, 36, 14, 30, 34, 26, 12, 30]
const sumaDR = (fs: unknown[][]) => fs.reduce((t, f) => t + Number((f[2] as { v?: number })?.v || 0), 0)

// A1 · DR7 (sin pagar al 30/06/26) — misma lógica que P2 (JMS 10/11: «lo mismo para deudas»): responsable → template → fecha, con subtotales.
// Las filas salen de «Datos a revisar» del último H (así coinciden con la auditoría) y se completan con la cuota de la base (la ficha).
// JMS 10/11: lo ya decidido no se vuelve a preguntar — automotores (esperan la reliquidación, A-FEAT-1581) y UATRE (mensual: lo que no se pagó es deuda)
const YA_DECIDIDO_A1 = /Automotores|UATRE/
const dr7Todos = dr.filter(x => x && x[0] === "DR7")
const dr7 = dr7Todos.filter(x => !YA_DECIDIDO_A1.test(String(x[4] ?? "")))
const decididosA1 = dr7Todos.filter(x => YA_DECIDIDO_A1.test(String(x[4] ?? "")))
const serialAIso = (v: unknown) => typeof v === "number" ? new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10) : String(v ?? "").split("/").reverse().join("-")
const pend = await todas(() => sb.from("cuotas_egresos_sin_factura").select(SEL_CUOTA).gte("fecha_estimada", "2025-07-01").lte("fecha_estimada", "2026-06-30").in("estado", ["pendiente", "pagar", "preparado", "programado"]).order("id"))  // sólo las IMPAGAS (no «Nada a pagar», no débito ni crédito)
const clave = (_f: string, m: number, n: string) => `${Math.round(m)}|${n}`  // por template e importe; la fecha se elige la más cercana (el H puede usar el vencimiento)
const pendDe = new Map<string, any[]>(); for (const c of pend) { const k = clave(c.fecha_estimada, Number(c.monto), c.egreso.nombre_referencia); pendDe.set(k, [...(pendDe.get(k) ?? []), c]) }
const LECTURA_A1: Array<[RegExp, string, string]> = [
  [/Automotores/, "Ya decidido", "Esperan la reliquidación de la Municipalidad SP (A-FEAT-1581). No hace falta contestar."],
  [/ABL Cochera/, "Se pagó, falta vincular", "El detalle dice «pagó JMS desde su CA el 30/01»: NO es deuda, falta cargar ese pago (¿como pago de JMS, CTA JMS?)."],
  [/Aportes Domesticas/, "Nada a pagar", "En $ 0: probable que no hubo nada que pagar."],
  [/Tarjeta VISA PAM/, "Revisar", "¿Son resúmenes ya pagados que falta vincular, o deuda al cierre? Mirá «Posible pago sin vincular»."],
]
const tmA1 = new Map<string, Tmpl>()
for (const x of dr7) {
  const fecha = serialAIso(x[1]), monto = Number(x[3]) || 0, nombre = String(x[4] ?? "")
  const lista = pendDe.get(clave(fecha, monto, nombre)) ?? []; lista.sort((a, b) => Math.abs(Date.parse(a.fecha_estimada) - Date.parse(fecha)) - Math.abs(Date.parse(b.fecha_estimada) - Date.parse(fecha))); const c = lista.shift()
  const esta = String((x[11] as { v?: string })?.v ?? x[11] ?? "")
  const resp = String(c?.egreso?.responsable ?? esta.split("·")[1] ?? "?").trim()
  const f = c ? ficha(null, "", c, monto) : [dmy(fecha), x[2], IMP(monto), "", [x[5], x[10]].filter(Boolean).join(" · "), x[7] ?? "", nombre, resp, "", x[6] ?? "", x[8] ?? "", "", x[9] ?? "", ""]
  f[13] = `${limpio(f[13])}${f[13] ? " · " : ""}está en «${esta}»`
  const k = `${resp}|${nombre}`
  if (!tmA1.has(k)) {
    const [, prop, porq] = LECTURA_A1.find(([re]) => re.test(nombre)) ?? [null, "Revisar", "¿Deuda al 30/06/26 (se iba a pagar) o se pagó y falta vincular? Mirá «Posible pago sin vincular»."]
    tmA1.set(k, { resp, nombre, cuenta: c?.categ || c?.egreso?.categ || "", aQuien: [c?.egreso?.nombre_quien_cobra, c?.egreso?.cuit_quien_cobra, x[5]].filter(Boolean).join(" · "), propuesta: prop as string, porque: porq as string, cuotas: [], cand: [] })
  }
  const t = tmA1.get(k)!
  const cand = /Automotores/.test(nombre) ? [] : candidatos(fecha, monto, 0, palabrasDe(nombre, [String(x[5] ?? "")]), new Set(t.cand))
  t.cand.push(...cand)
  t.cuotas.push({ fecha, fila: [...f, cand.join("\n")] })
}
// ⚠️ 10/11: las cuotas sin pagar de la BASE que NO salen en el H (ej. los seguros de Accidentes Personales sincronizados de la póliza) también van,
// marcadas: así no se pierden aunque el libro tenga un hueco (a revisar por qué no las toma).
let faltanEnH = 0
for (const lista of pendDe.values()) for (const c of lista) {
  const nombre = String(c.egreso?.nombre_referencia ?? ""); if (YA_DECIDIDO_A1.test(nombre)) continue
  faltanEnH++
  const resp = String(c.egreso?.responsable ?? "?"), k = `${resp}|${nombre}`
  if (!tmA1.has(k)) tmA1.set(k, { resp, nombre, cuenta: c.categ || c.egreso?.categ || "", aQuien: [c.egreso?.nombre_quien_cobra, c.egreso?.cuit_quien_cobra].filter(Boolean).join(" · "),
    propuesta: "Revisar", porque: "OJO: esta cuota sin pagar NO aparece en el H para auditar (hay que ver por qué el libro no la toma). ¿Deuda al 30/06/26 o se pagó?", cuotas: [], cand: [] })
  const f = ficha(null, "", c, Number(c.monto)); f[13] = `${limpio(f[13])}${f[13] ? " · " : ""}⚠️ no aparece en el H para auditar`
  const t = tmA1.get(k)!
  const cand = candidatos(c.fecha_estimada, Number(c.monto), 0, palabrasDe(nombre), new Set(t.cand)); t.cand.push(...cand)
  t.cuotas.push({ fecha: c.fecha_estimada, fila: [...f, cand.join("\n")] })
}
for (const t of tmA1.values()) { t.cand = [...new Set(t.cand)].slice(0, 3); ojo(t) }
const sA1 = segmentar([...tmA1.values()])
hoja("DR7", "A1 DR7 Deuda", "Cuotas SIN PAGAR al cierre (30/06/26): ¿van como DEUDA?",
  `Las ${dr7.length} cuotas del ejercicio que al 30/06/26 seguían pendientes y falta decidir (las ${decididosA1.length} ya decididas no están: automotores esperan la reliquidación y UATRE queda como deuda)${faltanEnH ? `, más ${faltanEnH} que están sin pagar en la base pero NO salen en el H (marcadas)` : ""}, ordenadas por responsable (MSA, MA, PAM, con su subtotal), después por template y por fecha. Si se iban a pagar, son deuda al cierre (van al papel de cuentas a pagar); si no, «Nada a pagar»; si se pagaron, falta vincular el pago.`,
  "Contestás en la celda amarilla del renglón celeste de cada template: «Deuda» · «Nada a pagar» · «Se pagó, falta vincular» · «Revisar». Los renglones blancos son sus cuotas con la ficha completa.",
  `Una cuota sin pagar no tiene comprobante ni beneficiario propio: la columna «Posible pago sin vincular» muestra, si existe, un pago suelto de cualquier cuenta que podría ser suyo (por importe, palabras del banco y fecha). Copiado de «${ultimaH}», solapa «Datos a revisar», y completado con la cuota de la base.`,
  SEG, sA1.filas, sumaDR(dr7.map(filaDR)), ANCHOS_SEG,
  { tipoFila: i => sA1.tipos[i], respuestaDe: i => sA1.respuestas[i], cuantos: dr7.length + faltanEnH, tituloVa: "Tu respuesta (Deuda / Nada a pagar / Se pagó, falta vincular / Revisar)", notaVa: "← no hace falta: contestá en la celda amarilla de cada template (renglones celestes)." })

const filas8 = dr.filter(x => x && x[0] === "DR8").map(filaDR)
hoja("DR8", "A2 DR8 Extracto MA", "La transferencia de PAM a MA del 06/08/25 ($ 4.000.000) sin su otra punta",
  "Salió del Galicia PAM al BBVA FRANCÉS de MA (CBU 0170023740000003618361, CUIT 27066824611, «Retiro MAM Frances»), no al Galicia MA: por eso no tenía otra punta. Es la única transferencia de PAM a MA de jul → oct-25.",
  "Se le anotó la otra punta: «entra al BBVA Francés de MA, cuenta sin extracto en el sistema, no se usa más». No se crea la cuenta (tu respuesta: «es una cuenta que no se va a usar nunca más… sería el único movimiento»).",
  "Tu respuesta del 10/11.", encDR, filas8, sumaDR(filas8), ANCHOS_DR, { resuelto: "✅ RESUELTO (script 248, 10/11)" })

const filas10 = dr.filter(x => x && x[0] === "DR10").map(filaDR)
hoja("DR10", "A3 DR10 Leguizamon Aduriz", "Transferencias de MA con «CTA MSA» sin factura que coincida (Leguizamón y Aduriz)",
  "Leguizamón (María Elizabet, CUIT 27124882511) le facturó SÓLO a MSA: Fac A 0004-00000563 del 06/02/26 por $ 150.390 (a MA nunca). Aduriz (Pedro Aduriz Berro, CUIT 20263173326) le facturó SÓLO a MSA: Fac C 0002-00000591 del 24/09/26 por $ 75.000 (ya del ejercicio siguiente). Los pagos de MA ($ 57.400 el 09/04/26 y $ 60.000 el 04/12/25) no coinciden con esas facturas.",
  "Quedan como están: «CTA MSA» = MA pagó algo de MSA (aporte de MA a MSA), sin factura que coincida. No se cambió nada.",
  "Tu decisión del 03/11 (script 185) y tu confirmación del 10/11.", encDR, filas10, sumaDR(filas10), ANCHOS_DR, { resuelto: "✅ RESUELTO (sin cambios: quedan CTA MSA)" })

// ── Resumen: ÍNDICE arriba (JMS 10/11: «si vos me dejás el índice, yo voy a cada punto… de solapa en solapa»). Son 8 decisiones, una
// por solapa; la columna «Tu respuesta» trae lo que escribiste en «¿Va todo?» de cada solapa, así se ve qué falta contestar.
const r: unknown[][] = [[T("PROPUESTAS PARA APROBAR — H para auditar MSA 25/26")],
  [N(`Son ${resumen.length} decisiones, una por solapa. Hacé click en «Ir a», leé la caja de arriba (qué pasa, qué se haría, por qué) y escribí «sí», «no» o «sí salvo…» en la celda amarilla «¿Va todo?». Los renglones de abajo de cada solapa son el detalle para mirar. Lo que ya está aplicado dice «✅ RESUELTO (script N)»: cada uno se hizo con un script con foto previa y deshacer. En cada solapa, el [–] de la izquierda pliega la caja de arriba.`)], [],
  ["Nº", "Ir a", "Qué hay que decidir", "Renglones", "Importe", "Qué se haría", "Tu respuesta"].map(C)]
for (const p of resumen) r.push([p.id, { t: "s", v: `➜ ${p.solapa}`, l: { Target: `#'${p.solapa}'!B7` }, s: { font: { color: { rgb: "FF0563C1" }, underline: true } } }, N(p.que),
  { t: "n", v: p.cuantos, z: "0" }, IMP(p.importe), N(p.hacer), { t: "s", f: `IF('${p.solapa}'!B7="","(sin contestar)",'${p.solapa}'!B7)`, v: "(sin contestar)" }])
const finIndice = r.length
r.push([], [C("Te falta traer (para cerrar dos temas)")],
  ["📄", N("El PDF del resumen de la VISA PAM de MAYO 2026 («VISA PAM - 26-05»): para pasar a pesos la última compra en dólares (Spotify, US$ 2,40, resumen del 30/04/26). Dejalo en Extractos / Galicia Eminent PAM / TJ VISA PAM.")],
  ["🚗", N("La RELIQUIDACIÓN de automotores con la Municipalidad de San Pedro: importes de Gol, Tiguan y Toyota 2026 (y Gol y Tiguan jul–dic 2025). Con eso se cargan las cuotas pendientes (hoy en $ 0) y se pagan.")])
r.push([], [C("Quedaron como pendiente (no se resuelven acá)")],
  ["A-DAT-100", N("Anticipos de Ganancias / Bs Pers de PAM 2025: agosto se pagó ($ 86.000,71 el 14/08/25, sin vincular); octubre y diciembre no se encontraron.")],
  ["A-FEAT-1587", N("Construir el estado «Nada a pagar» (el nombre lo elegiste el 10/11) para las cuotas que correctamente quedaron en $ 0.")],
  ["A-FEAT-1586", N("Auditar toda transferencia de MA con alguien de la familia: ¿contra factura o FLIA?")])
r.push([], [C("Ya resuelto en la charla (no hace falta aprobar)")],
  ["DR5", N("Pasajes de JMS con «CTA JMS»: quedan así — es un pago a JMS que genera saldo a facturar (él lo factura como reintegro).")])
const anchosR = [7, 26, 44, 11, 16, 60, 22]
const totalR = anchosR.reduce((t, a) => t + a, 0)
const uR = ["A1:G1", "A2:G2"]; altoDeFila(r, 2, altoTexto(String((r[1][0] as { v: string }).v), totalR))
r.forEach((fila, i) => {
  if (i < finIndice) return
  if (fila.length === 1) uR.push(`A${i + 1}:G${i + 1}`)
  if (fila.length === 2) { uR.push(`B${i + 1}:G${i + 1}`); altoDeFila(r, i + 1, altoTexto(String((fila[1] as { v: string }).v), totalR - 7)) }
})
unirCeldas(r, uR)
agregar("Resumen", r, anchosR)
wb.SheetNames = ["Resumen", ...wb.SheetNames.filter(n => n !== "Resumen")]
// JMS 10/11: «no los pises… si cambia, le hacés una versión nueva». La primera (sin número) es la v1.
const base = "Propuestas para aprobar - H para auditar (2026-11-10)"
const vs0 = readdirSync(carpeta).filter(f => f.startsWith(base) && f.endsWith(".xlsx")).map(f => Number(f.match(/ v(\d+)\.xlsx$/)?.[1] ?? 1))
const destino = join(carpeta, `${base} v${Math.max(0, ...vs0) + 1}.xlsx`)
if (existsSync(destino)) throw new Error("ya existe " + destino)
fechasReales(wb as any)
const vs = vistasDe(wb as any); const orden = wb.SheetNames; const vistas = [vs[vs.length - 1], ...vs.slice(0, -1)]
writeFileSync(destino, Buffer.from(await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistas)))
console.log("📄", destino); for (const p of resumen) console.log(` ${p.id} · ${p.cuantos} renglones · ${p.importe.toFixed(2)}`); void orden
