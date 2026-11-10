/**
 * 🧭 DECISIONES P2 (JMS 10/11: «tal vez me puedas hacer un Excel con estas cosas para que me sea más fácil contestarte definitivamente…
 * tiene que ser muy fácil para mí poderte contestar»). Una solapa por decisión (D1…D4), cada renglón con su FICHA COMPLETA (regla
 * CLAUDE.md), y en el Resumen el índice con la celda amarilla para contestar. SÓLO LEE. Sale versionado (no pisa).
 *   npx tsx scripts/decisiones-p2.mts
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { aplicarVistas } from "../lib/balance/formato-excel"
import { agregarHoja, vistasDe } from "../lib/balance/export-libro-diario"
import { fechasReales } from "../lib/excel/fechas-reales"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const dmy = (f: string | null | undefined) => (f ? String(f).slice(0, 10).split("-").reverse().join("/") : "")
const C = (v: string) => ({ t: "s", v, s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: { patternType: "solid", fgColor: { rgb: "FFEEF1F0" } } } })
const T = (v: string) => ({ t: "s", v, s: { font: { bold: true, sz: 13, color: { rgb: "FF1F4E3D" } } } })
const N = (v: string) => ({ t: "s", v, s: { alignment: { wrapText: true, vertical: "top" } } })
const SUB = (v: string) => ({ t: "s", v, s: { font: { bold: true, color: { rgb: "FF1F4E3D" } }, fill: { patternType: "solid", fgColor: { rgb: "FFDDEBF7" } } } })
const MON = "#,##0.00"
const IMP = (v: number) => ({ t: "n", v: Math.round(v * 100) / 100, z: MON })
const VA = (v = "") => ({ t: "s", v, s: { fill: { patternType: "solid", fgColor: { rgb: "FFFFF2CC" } }, alignment: { wrapText: true, vertical: "top" } } })
const limpio = (x: unknown) => String(x ?? "").replace(/\s*\[script[^\]]*\]/g, "").replace(/\s+/g, " ").trim()
const planilla = (n: string | null) => (String(n ?? "").match(/CATEG ([A-Za-zÁÉÍÓÚÑ ]+)/)?.[1] ?? "").trim()
const wb = XLSX.utils.book_new()
async function todas(q: () => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q().range(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) return out } }
const UN = new WeakMap<unknown[][], string[]>()
function agregar(nombre: string, f: unknown[][], anchos: number[], filtroDesde?: number) {
  agregarHoja(wb as any, nombre, f, anchos.map(ancho => ({ ancho })) as any)
  const ws = wb.Sheets[nombre.slice(0, 31)]
  ws["!merges"] = (UN.get(f) ?? []).map(u => XLSX.utils.decode_range(u))
  if (filtroDesde) ws["!autofilter"] = { ref: `A${filtroDesde}:${XLSX.utils.encode_col(anchos.length - 1)}${f.length}` }
}
const idx: Array<{ id: string; solapa: string; pregunta: string; propuesta: string }> = []
/** Cabecera común: título, qué pasa, mi propuesta, la pregunta y la celda para contestar. */
function cabecera(id: string, solapa: string, titulo: string, que: string, propuesta: string, pregunta: string, ancho: number) {
  const h: unknown[][] = [[{ t: "s", v: "⬅ Resumen", l: { Target: "#'Resumen'!A1" } }], [T(`${id} · ${titulo}`)], [], [C("Qué pasa"), N(que)], [C("Mi propuesta"), N(propuesta)], [C("Lo que te pregunto"), N(pregunta)], [C("Tu respuesta"), VA()], []]
  const u = XLSX.utils.encode_col(ancho - 1); UN.set(h, [`A2:${u}2`, `B4:${u}4`, `B5:${u}5`, `B6:${u}6`, `B7:${u}7`])
  idx.push({ id, solapa, pregunta, propuesta })
  return h
}
const FMOV = ["Fecha", "Cuenta", "Débito", "Crédito", "Descripción del banco", "Detalle (tuyo)", "A quién / VEP (leyenda 1)", "CUIT / VEP (leyenda 2)", "Tu planilla (CATEG)", "Estado", "Vinculado a"]
const filaMov = (m: any, cuenta: string, vinc = "") => [dmy(m.fecha), cuenta, Number(m.debitos) ? IMP(Number(m.debitos)) : "", Number(m.creditos) ? IMP(Number(m.creditos)) : "", limpio(m.descripcion), limpio(m.detalle), limpio(m.leyendas_adicionales_1), limpio(m.leyendas_adicionales_2), planilla(m.nota_operador), m.estado, vinc || "(nada)"]
const ANCHOS_MOV = [11, 14, 14, 12, 22, 46, 26, 18, 14, 11, 30]

// ── D1 · Anticipos de Ganancias MSA
{
  const movs = await todas(() => sb.from("msa_galicia").select("*").gte("fecha", "2025-01-01").lte("fecha", "2026-07-31").ilike("detalle", "%anticipo%gan%").order("id"))
  movs.sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
  const { data: cs } = await sb.from("cuotas_egresos_sin_factura").select("fecha_estimada, monto, estado, detalle, descripcion, egreso:egresos_sin_factura!inner(nombre_referencia, año, responsable)").eq("egreso.nombre_referencia", "Anticipo Ganancias MSA").order("fecha_estimada")
  const h = cabecera("D1", "D1 Anticipos Ganancias MSA", "Anticipos de Ganancias de MSA pagados en el ejercicio, sin cuota",
    `En la cuenta corriente de MSA hay ${movs.length} pagos de anticipos de Ganancias (plan anterior, «SM 8/10» y «10/10») sin vincular: el template «Anticipo Ganancias MSA» tiene cuotas desde dic-25 (25/26, todas «Nada a pagar») y no tiene cuotas de jul–nov 2025.`,
    "Crear el template «Anticipo Ganancias MSA 24/25» con las cuotas del plan: 8/10 (15/07/25, $ 2.067.776,32, vinculada) · 9/10 compensada con IVA disponible («Nada a pagar», con esa nota) · 10/10 (09/09/25, $ 271.066,38, el saldo después de compensar, vinculada).",
    "¿Cómo es el plan? (¿cuántos anticipos, cuáles se pagaron en 2025 antes de julio, el 9/10 compensado) — escribilo como te salga y lo armo.", FMOV.length)
  h.push([SUB("Lo que hay en el banco (Galicia MSA CC)")], FMOV.map(C)); for (const m of movs) h.push(filaMov(m, "Galicia MSA CC"))
  h.push([], [SUB("Las cuotas del template «Anticipo Ganancias MSA», por fecha")], ["Fecha", "Año", "Importe", "Estado", "Detalle", "Nota"].map(C))
  for (const c of cs ?? []) h.push([dmy(c.fecha_estimada), c.egreso.año, IMP(Number(c.monto)), c.estado === "nada_a_pagar" ? "Nada a pagar" : c.estado, limpio(c.detalle), limpio(c.descripcion)])
  agregar("D1 Anticipos Ganancias MSA", h, ANCHOS_MOV)
}

// ── D2 · El SICORE de $ 1.351.504,60 del 12/01/26
{
  const { data: m } = await sb.from("msa_galicia").select("*").eq("fecha", "2026-01-12").eq("debitos", 1351504.60)
  const { data: cs } = await sb.from("cuotas_egresos_sin_factura").select("fecha_estimada, monto, estado, detalle, egreso:egresos_sin_factura!inner(nombre_referencia)").in("egreso.nombre_referencia", ["SICORE 1er Quincena", "SICORE 2da Quincena"]).gte("fecha_estimada", "2025-07-01").lte("fecha_estimada", "2026-02-28").order("fecha_estimada")
  const h = cabecera("D2", "D2 SICORE 12-01", "El pago de SICORE del 12/01/26 ($ 1.351.504,60): ¿qué quincenas cubre?",
    "Un solo VEP por $ 1.351.504,60 sin vincular. Las quincenas de SICORE de sep-25 a ene-26 están todas en $ 0 sin pago: parece que este pago las junta. La app no tiene las declaraciones de SICORE antes de marzo 2026, así que no puedo repartirlo sola.",
    "Si me decís qué quincenas cubre (o el importe de cada una, de las DDJJ o los VEP), lo reparto y lo vinculo. Si no se sabe, queda como está (tu regla: «si no son seguros, mejor no inventar»).",
    "¿Qué quincenas cubre, y con qué importe cada una?", FMOV.length)
  h.push([SUB("El pago (Galicia MSA CC)")], FMOV.map(C)); for (const x of m ?? []) h.push(filaMov(x, "Galicia MSA CC"))
  h.push([], [SUB("Las cuotas de SICORE jul-25 → feb-26 (hoy)")], ["Fecha", "Quincena", "Importe", "Estado", "Detalle / nota"].map(C))
  for (const c of cs ?? []) h.push([dmy(c.fecha_estimada), c.egreso.nombre_referencia, IMP(Number(c.monto)), c.estado === "nada_a_pagar" ? "Nada a pagar" : c.estado, limpio(c.detalle)])
  agregar("D2 SICORE 12-01", h, ANCHOS_MOV)
}

// ── D3 · Las 6 devoluciones de retenciones de Ganancias no declaradas
{
  const movs = await todas(() => sb.from("msa_galicia").select("*").eq("fecha", "2026-01-08").ilike("detalle", "%ret de ganancias%").order("id"))
  const h = cabecera("D3", "D3 Devoluciones retenciones", "Las 6 devoluciones de retenciones de Ganancias no declaradas (08/01/26)",
    "Tu explicación: «una vieja liquidación que finalmente no declaré: lo que les retuve se lo transferí». Busqué la factura de cada proveedor de la que salió la retención: La Mercure, Alcorta y Massaglia tienen facturas de dic-25 / ene-26, pero ninguna da exacto el importe devuelto como retención; Castillo, Sola e Iglesias no tienen facturas en ese período. Tu planilla clasificó cada una como el gasto del proveedor (ASES, VET, ALIM…).",
    "Template «Devolución retenciones Ganancias no declaradas» (MSA) con una cuota por proveedor = su transferencia, vinculada, con la cuenta del gasto que pusiste en tu planilla (así el gasto queda completo: lo pagado + lo retenido devuelto = la factura). Queda resuelto para la auditoría sin inventar a qué factura va.",
    "¿Va así? Si sabés de qué factura salió cada una, decímelo y lo ato a la factura.", FMOV.length + 1)
  h.push([SUB("Las 6 transferencias (Galicia MSA CC)")], [...FMOV, "Facturas de ese proveedor (dic-25 / ene-26)"].map(C))
  for (const m of movs) {
    const cuit = String(m.leyendas_adicionales_2 ?? "").replace(/\D/g, "")
    const { data: f } = await sb.schema("msa").from("comprobantes_arca").select("fecha_emision, tipo_comprobante, punto_venta, numero_desde, imp_total, imp_neto_gravado").eq("cuit", cuit).gte("fecha_emision", "2025-06-01").lte("fecha_emision", "2026-01-08").order("fecha_emision")
    h.push([...filaMov(m, "Galicia MSA CC"), (f ?? []).map((x: any) => `${dmy(x.fecha_emision)} FC ${x.punto_venta}-${x.numero_desde} total $ ${Number(x.imp_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })} (neto $ ${Number(x.imp_neto_gravado).toLocaleString("es-AR", { minimumFractionDigits: 2 })})`).join(" · ") || "(no hay facturas en ese período)"])
  }
  agregar("D3 Devoluciones retenciones", h, [...ANCHOS_MOV, 70])
}

// ── D4 · El tramo histórico jul-25 → ene-26 sin vincular
{
  const movs = await todas(() => sb.from("msa_galicia").select("*").gte("fecha", "2025-07-01").lte("fecha", "2026-06-30").eq("estado", "historico")
    .is("template_cuota_id", null).is("comprobante_arca_id", null).is("sueldo_pago_id", null).is("anticipo_id", null).is("comprobante_venta_id", null).order("id"))
  movs.sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
  const porCateg = new Map<string, { n: number; d: number }>()
  for (const m of movs) { const k = planilla(m.nota_operador) || "(sin categ)"; const x = porCateg.get(k) ?? { n: 0, d: 0 }; x.n++; x.d += Number(m.debitos) || 0; porCateg.set(k, x) }
  const h = cabecera("D4", "D4 Tramo historico", `El tramo histórico (jul-25 → ene-26): ${movs.length} movimientos de MSA sin vincular`,
    `De feb a jun 2026 el Galicia MSA está 100 % conciliado. De jul-25 a ene-26 hay ${movs.length} movimientos en estado «histórico» (por eso no los ves filtrando pendientes): tienen tu clasificación de la planilla en la nota, pero no están vinculados a su cuota, factura o sueldo (A-DEC-1009). Por eso las cuotas de esos meses aparecen en $ 0 o sin pagar aunque el pago está en el banco.`,
    "Vincularlos por tandas, de lo más fácil a lo más difícil: primero los que tienen factura (pagos a proveedores, contra su factura) y los impuestos; después sueldos; al final lo chico. Cada tanda con su script, foto y deshacer, y con el corte del H antes y después.",
    "¿Arrancamos? ¿Por qué grupo querés empezar? (abajo, los grupos por tu categoría de la planilla)", FMOV.length)
  h.push([SUB("Por tu categoría de la planilla")], ["Categoría", "Movimientos", "Débitos"].map(C))
  for (const [k, x] of [...porCateg].sort((a, b) => b[1].d - a[1].d)) h.push([k, { t: "n", v: x.n, z: "0" }, IMP(x.d)])
  h.push([], [SUB("Los movimientos, por fecha (con filtro)")])
  const desde = h.length + 1
  h.push(FMOV.map(C)); for (const m of movs) h.push(filaMov(m, "Galicia MSA CC"))
  agregar("D4 Tramo historico", h, ANCHOS_MOV, desde)
}

// ── Resumen
const r: unknown[][] = [[T("DECISIONES QUE QUEDAN DE P2 — H para auditar MSA 25/26")],
  [N("Cada decisión tiene su solapa con la ficha completa. Contestá en la celda amarilla de la solapa (o acá, en «Tu respuesta»). Nada está hecho todavía: cada una se aplica después con un script con foto previa y deshacer.")], [],
  ["Nº", "Ir a", "Lo que te pregunto", "Mi propuesta", "Tu respuesta"].map(C)]
for (const p of idx) r.push([p.id, { t: "s", v: `➜ ${p.solapa}`, l: { Target: `#'${p.solapa}'!B7` }, s: { font: { color: { rgb: "FF0563C1" }, underline: true } } }, N(p.pregunta), N(p.propuesta),
  { t: "s", f: `IF('${p.solapa}'!B7="","(sin contestar)",'${p.solapa}'!B7)`, v: "(sin contestar)" }])
r.push([], [SUB("Ya hecho hoy con tu OK (script 257)")],
  ["", N("SICORE: 1ra ago, 2da ago y 1ra sep 2025 vinculados a su pago; 1ra feb-26 «Nada a pagar». UATRE: ago, oct y dic-25 pasan a deuda (pendiente) y se crearon feb y mar-26 pendientes. IIBB MA: 8 cuotas «Nada a pagar». IIBB PAM 2025: template nuevo con sus 4 pagos vinculados. Retiros semestrales de enero-26: «Nada a pagar» (no hubo distribución).")],
  ["", N("Quedan como alerta, por tu regla («si no hay match, quedan así»): IIBB MSA ago-25, feb-26 (ventas de enero $ 152 M) y may-26; SICORE 1ra jul-25.")])
UN.set(r, ["A1:E1", "A2:E2"])
agregar("Resumen", r, [6, 30, 50, 70, 30])
wb.SheetNames = ["Resumen", ...wb.SheetNames.filter(n => n !== "Resumen")]
const carpeta = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const base = "Decisiones P2 - H para auditar (2026-11-10)"
const nv = (f: string) => Number(f.match(/ v(\d+)\.xlsx$/)?.[1] ?? 0)
const destino = join(carpeta, `${base} v${Math.max(0, ...readdirSync(carpeta).filter(f => f.startsWith(base)).map(nv)) + 1}.xlsx`)
if (existsSync(destino)) throw new Error("ya existe " + destino)
fechasReales(wb as any)
const vs = vistasDe(wb as any); const vistas = [vs[vs.length - 1], ...vs.slice(0, -1)]
writeFileSync(destino, Buffer.from(await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistas)))
console.log("📄", destino)
