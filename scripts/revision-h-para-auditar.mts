/**
 * 🔎 REVISIÓN del «H para auditar» — retiros y aportes línea por línea (A-FEAT-1579, puntos 1 y 2 del plan del 09/11). SÓLO LEE.
 * JMS: «ir uno por uno, leer lo que dice el reporte y tratar de entender lo que muestra; ver los datos que lo componen y si está bien
 * rotulado… ver si el contexto está presente para poder lograr el audit».
 *
 * Arma lo mismo que el H para auditar (mismas funciones) y, por cada cuota con efecto, trae del banco el movimiento entero (descripción,
 * beneficiario/CUIT, códigos contable e interno, factura vinculada). Aplica reglas que detectan rótulos o códigos que no cierran y lista
 * los movimientos con código SIN template («directos»), que el reporte sólo muestra como total.
 *
 *     npx tsx scripts/revision-h-para-auditar.mts
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { armarEjercicio, primerDiaDelEjercicio } from "../lib/balance/ejercicio"
import { desdeCuota, armarTemplatesDelEjercicio } from "../lib/balance/templates-libro"
import { leerMovimientosDeCuotas, vincularBanco, leerExtractoDelEjercicio, indiceDeDestinos } from "../lib/balance/movimientos-de-cuotas"
import { auditarCuota, duenoDelGasto, otraParteDelCodigo } from "../lib/balance/auditoria-templates"
import { cuotaSinPago } from "../lib/balance/grupos-templates"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { agregarHoja } from "../lib/balance/export-libro-diario"
import { fechasReales } from "../lib/excel/fechas-reales"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const r2 = (n: number) => Math.round(n * 100) / 100
const desde = (s: string, t: string) => (s === "public" ? sb.from(t) : sb.schema(s).from(t))
async function todo(q: (d: number, h: number) => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break } return out }
const dias = (a: string, b: string) => Math.abs((Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 86_400_000)
const EMP = new Set(["MSA", "PAM", "MA"])
const CUIT: Record<string, string> = { MSA: "30617786016", PAM: "20044390222", MA: "27066824611" }

// ── lo mismo que arma el H para auditar
const ej = armarEjercicio(2026, 6)
const filas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura")
  .select("*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable, tipo, cuenta_agrupadora)")
  .gte("fecha_estimada", "2024-01-01").order("id").range(d, h))
const { data: plan } = await sb.from("cuentas_contables").select("categ, tipo, nro_cuenta, nombre_totalizadora")
const tipoDeCateg = Object.fromEntries((plan ?? []).map((x: any) => [x.categ, x.tipo]))
const { data: conPoliza } = await sb.from("polizas_seguro").select("template_id").not("template_id", "is", null)
let cuotas = filas.map((f: any) => desdeCuota(f, tipoDeCateg as any))
const leido = await leerMovimientosDeCuotas(sb, cuotas)
cuotas = vincularBanco(cuotas, cuotas, leido.movimientos)
const ex = await leerExtractoDelEjercicio(sb, primerDiaDelEjercicio(ej), ej.fechaCierre)
const t = armarTemplatesDelEjercicio(cuotas, ej, { empresa: "MSA", plan: plan ?? [], templatesConPoliza: (conPoliza ?? []).map((p: any) => p.template_id).filter(Boolean),
  bancoSinLeer: leido.tablasQueFallaron, extracto: { movimientos: ex.movimientos, destinos: indiceDeDestinos(cuotas), tablasQueFallaron: ex.tablasQueFallaron } } as any)
const todas = [...t.detalle, ...(t.aCuentaSocio ?? [])]

// ── el movimiento entero de cada cuota (descripción, leyendas, interno, factura)
const ids = [...new Set(todas.flatMap((c: any) => [c.id, c.grupoPagoId]).filter(Boolean))] as string[]
const movsDe = new Map<string, any[]>()
for (const tb of TABLAS_CON_VINCULO_ARCA) {
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await desde(tb.schema, tb.tabla).select("*").in("template_cuota_id", ids.slice(i, i + 200))
    if (error) { console.log(`⚠️ ${tb.cuenta}: ${error.message}`); continue }
    for (const m of data ?? []) movsDe.set(String(m.template_cuota_id), [...(movsDe.get(String(m.template_cuota_id)) ?? []), { ...m, _cuenta: tb.cuenta, _titular: tb.titular }])
  }
}
const ley = (m: any) => [m.leyendas_adicionales_1, m.leyendas_adicionales_2, m.leyendas_adicionales_3, m.leyendas_adicionales_4].map(x => String(x ?? "").trim()).filter(Boolean).join(" · ")

// ── las facturas vinculadas (de qué empresa es cada una)
const idsFact = [...new Set([...movsDe.values()].flat().map(m => m.comprobante_arca_id).concat(ex.movimientos.map((m: any) => m.comprobanteArcaId)).filter(Boolean))] as string[]
const factDe = new Map<string, string>()
for (const s of ["msa", "pam", "ma"]) for (let i = 0; i < idsFact.length; i += 200) {
  const { data } = await sb.schema(s).from("comprobantes_arca").select("id, denominacion_emisor, tipo_comprobante_desc, punto_venta, numero_desde, imp_total").in("id", idsFact.slice(i, i + 200))
  for (const f of data ?? []) factDe.set(f.id, `factura de ${s.toUpperCase()}: ${f.denominacion_emisor} ${f.tipo_comprobante_desc ?? ""} ${f.punto_venta}-${f.numero_desde} ($ ${Number(f.imp_total).toLocaleString("es-AR")})`)
}

// ── la otra punta de cada entrada (misma regla que el reporte) y de cada salida entre empresas
const salidasEx = ex.movimientos.filter((m: any) => !m.enDolares && m.contable && m.debitos - m.creditos > 0)
const entradasEx = ex.movimientos.filter((m: any) => !m.enDolares && m.creditos - m.debitos > 0)

type Fila = { resp: string; agrup: string; concepto: string; fecha: string; importe: number; sentido: string; cuenta: string; titular: string; dueno: string;
  codigo: string; interno: string; efecto: string; marca: string; descripcion: string; beneficiario: string; factura: string; tipo: string; hallazgos: string[]; gravedad: number }
const out: Fila[] = []
for (const c of todas as any[]) {
  if (cuotaSinPago(c)) continue
  const a = auditarCuota(c)
  const ms = movsDe.get(c.id) ?? (c.grupoPagoId ? movsDe.get(c.grupoPagoId) ?? [] : [])
  const titular = String(c.banco?.titular ?? "").toUpperCase()
  const dueno = duenoDelGasto(c)
  const entrada = c.monto < 0
  const interno = [...new Set(ms.map(m => String(m.interno ?? "").trim()).filter(Boolean))].join(" / ")
  const f: Fila = { resp: String(c.responsable ?? "").split("/")[0].trim().toUpperCase(), agrup: c.agrupadoraTemplate || "(sin agrupadora)", concepto: c.concepto,
    fecha: String(c.fecha ?? "").slice(0, 10), importe: r2(c.monto), sentido: entrada ? "ENTRADA (crédito)" : "salida (débito)", cuenta: c.banco?.cuenta ?? "", titular, dueno,
    codigo: a.codigo, interno, efecto: a.efecto, marca: a.marca,
    descripcion: [...new Set(ms.map(m => String(m.descripcion ?? "").trim()).filter(Boolean))].join(" | "),
    beneficiario: [...new Set(ms.map(ley).filter(Boolean))].join(" | "),
    factura: [...new Set(ms.map(m => factDe.get(m.comprobante_arca_id) ?? "").filter(Boolean))].join(" | "),
    tipo: c.tipo ?? "", hallazgos: [], gravedad: 0 }
  const H = (g: number, s: string) => { f.hallazgos.push(s); f.gravedad = Math.max(f.gravedad, g) }
  const otra = otraParteDelCodigo(a.codigo)

  // R1 · pagó otro y no hay código: el efecto se deduce del template, nadie lo marcó
  if (titular && EMP.has(titular) && EMP.has(dueno) && titular !== dueno && !a.codigo && !/LIB/i.test(interno)) H(2, `pagó ${titular} un gasto de ${dueno} y el movimiento NO tiene código contable`)
  // R2 · el código no es el esperado (la marca ⚠️)
  if (/código esperado/.test(a.marca)) H(2, `código ${a.codigo || "(vacío)"}; el esperado es ${a.marca.replace(/^.*código esperado: /, "")}`)
  // R3 · el código nombra a la misma empresa de la cuenta (CTA MA en una cuenta de MA)
  if (otra && otra === titular) H(3, `el código «${a.codigo}» nombra a la misma empresa de la cuenta (${titular}): no tiene otra parte`)
  // R4 · entrada con código: ¿encontró su salida?
  if (entrada && otra && EMP.has(otra)) {
    const s = salidasEx.find((m: any) => m.titular.toUpperCase() === otra && otraParteDelCodigo(m.contable) === titular && Math.abs(r2(m.debitos - m.creditos) + c.monto) < 1 && dias(m.fecha, f.fecha) <= 5)
    if (!s && !(titular !== dueno && otra === dueno)) H(2, `entrada de ${otra} sin la salida en la cuenta de ${otra} (mismo importe, ±5 días): ¿falta conciliar la otra punta?`)
  }
  // R5 · salida con código a otra empresa: ¿la entrada en esa empresa tiene el código que corresponde?
  // sólo las transferencias A LA OTRA EMPRESA (su CUIT en las leyendas o «ctas propias»): un pago a un tercero por cuenta de otro no tiene entrada
  if (!entrada && otra && EMP.has(otra) && (f.beneficiario.includes(CUIT[otra]) || /ctas propias/i.test(f.descripcion))) {
    const e = entradasEx.find((m: any) => m.titular.toUpperCase() === otra && Math.abs(r2(m.creditos - m.debitos) - c.monto) < 1 && dias(m.fecha, f.fecha) <= 5)
    const hayExtracto = ex.movimientos.some((m: any) => m.titular.toUpperCase() === otra && !m.enDolares && dias(m.fecha, f.fecha) <= 10)
    if (!e) H(2, hayExtracto ? `transferencia a ${otra}: no aparece la entrada en las cuentas de ${otra}` : `transferencia a ${otra}: el extracto de ${otra} no está cargado para esa fecha (no se puede ver la otra punta)`)
    else if (otraParteDelCodigo(e.contable ?? "") !== titular) H(2, `la otra punta (${e.cuenta} ${e.fecha}) tiene código «${e.contable || "(vacío)"}», debería nombrar a ${titular}`)
  }
  // R6 · entrada SIN código con efecto (reintegro u otra cosa): leerla
  if (entrada && !a.codigo && a.efecto) H(1, "entrada sin código: ¿reintegro? leer la descripción")
  // R7 · gasto de la empresa marcado como de un socio o familia (lo pagó el dueño y el código dice otra cosa)
  if (!entrada && titular === dueno && a.codigo && c.tipo !== "distribucion" && !/^LIB/i.test(a.codigo)) H(1, `gasto de ${dueno} (tipo ${c.tipo || "sin tipo"}) con código «${a.codigo}»: va a la cuenta de ${otra || a.codigo}, verificar que sea de esa persona`)
  // R8 · varias cuentas pagaron la misma cuota
  if (titular.includes("+")) H(2, "pagada desde varias cuentas: el efecto no se calcula")
  if (a.efecto || f.hallazgos.length) out.push(f)
}

// ── los DIRECTOS: movimientos con código de retiro/aporte que no están en ningún template (el reporte sólo los suma)
const directos = ex.movimientos.filter((m: any) => !m.templateCuotaId && m.contable && /^(CTA|CUENTA|DIST|RET|LIB)\b/i.test(m.contable) && !m.enDolares)
  .map((m: any) => ({ ...m, imp: r2(m.debitos - m.creditos) }))

// ── el Excel de la revisión
const hall = out.filter(f => f.hallazgos.length).sort((a, b) => b.gravedad - a.gravedad || a.resp.localeCompare(b.resp) || a.fecha.localeCompare(b.fecha))
const GRAV = ["", "ℹ️ leer", "⚠️ revisar", "🔴 error"]
const porRegla = new Map<string, { n: number; s: number }>()
for (const f of hall) for (const h of f.hallazgos) { const k = h.replace(/\d[\d.,]*|«[^»]*»|\([^)]*\)| (MSA|PAM|MA|JMS|AMS)\b/g, "·").replace(/\s+/g, " ").slice(0, 90); const x = porRegla.get(k) ?? { n: 0, s: 0 }; porRegla.set(k, { n: x.n + 1, s: r2(x.s + f.importe) }) }
const porEfecto = new Map<string, { n: number; s: number; resp: Set<string> }>()
for (const f of out) if (f.efecto) { const x = porEfecto.get(f.efecto) ?? { n: 0, s: 0, resp: new Set<string>() }; x.n++; x.s = r2(x.s + f.importe); x.resp.add(f.resp); porEfecto.set(f.efecto, x) }

const wb = XLSX.utils.book_new()
const enc = ["Gravedad", "Hallazgo", "Responsable", "Agrupadora", "Concepto", "Fecha", "Importe", "Sentido", "Cuenta", "Dueño del gasto", "Código", "Interno", "Efecto (reporte)", "Descripción del banco", "Beneficiario / leyendas", "Factura vinculada"]
const fila = (f: Fila) => [GRAV[f.gravedad], f.hallazgos.join(" · "), f.resp, f.agrup, f.concepto, f.fecha, f.importe, f.sentido, f.cuenta, f.dueno, f.codigo, f.interno, f.efecto, f.descripcion, f.beneficiario, f.factura]
agregarHoja(wb, "1 Hallazgos", [["HALLAZGOS — lo que el reporte muestra y no cierra (MSA, MA y PAM) — sin cambiar nada"], [`${hall.length} cuotas con algo para mirar · 🔴 ${hall.filter(f => f.gravedad === 3).length} · ⚠️ ${hall.filter(f => f.gravedad === 2).length} · ℹ️ ${hall.filter(f => f.gravedad === 1).length}`], [], enc, ...hall.map(fila)])
agregarHoja(wb, "2 Por regla", [["CUÁNTO DE CADA TIPO DE HALLAZGO"], [], ["Hallazgo (tipo)", "Cuotas", "Importe"], ...[...porRegla].sort((a, b) => b[1].n - a[1].n).map(([k, x]) => [k, x.n, x.s])])
agregarHoja(wb, "3 Por efecto", [["CADA LÍNEA DE «RETIROS Y APORTES» — qué la compone (sin separar las otras puntas)"], [], ["Efecto (como lo dice el reporte)", "Responsables de los templates", "Cuotas", "Importe neto"],
  ...[...porEfecto].sort((a, b) => a[0].localeCompare(b[0], "es")).map(([k, x]) => [k, [...x.resp].join(", "), x.n, x.s])])
agregarHoja(wb, "4 Detalle con contexto", [["CADA CUOTA CON EFECTO, CON SU MOVIMIENTO DEL BANCO ENTERO — el contexto que hoy el reporte no trae"], [], enc, ...out.sort((a, b) => a.resp.localeCompare(b.resp) || a.efecto.localeCompare(b.efecto) || a.fecha.localeCompare(b.fecha)).map(fila)])
agregarHoja(wb, "5 Directos", [["MOVIMIENTOS CON CÓDIGO DE RETIRO / APORTE SIN TEMPLATE — el reporte sólo muestra su total por cuenta y código"], [`${directos.length} movimientos`], [],
  ["Cuenta de", "Cuenta", "Fecha", "Código", "Importe (+ salió / − entró)", "Descripción", "Categ", "Estado", "¿Otro vínculo (sueldo, venta, anticipo)?", "Factura vinculada"],
  ...directos.sort((a: any, b: any) => a.titular.localeCompare(b.titular) || a.contable.localeCompare(b.contable) || a.fecha.localeCompare(b.fecha))
    .map((m: any) => [m.titular, m.cuenta, m.fecha, m.contable, m.imp, m.descripcion, m.categ, m.estado, m.otroVinculo ? "sí" : "", factDe.get(m.comprobanteArcaId) ?? ""])])
fechasReales(wb as any)
let p = join(CARPETA, "Revision H para auditar - retiros y aportes (2026-11-09).xlsx"), v = 2
while (existsSync(p)) p = join(CARPETA, `Revision H para auditar - retiros y aportes (2026-11-09) v${v++}.xlsx`)
XLSX.writeFile(wb, p)
writeFileSync(join("- Comunicacion JMS Claude - Archivos/Balance/respaldos", "revision-h-para-auditar-2026-11-09.json"), JSON.stringify({ hall, porRegla: [...porRegla], porEfecto: [...porEfecto].map(([k, x]) => [k, x.n, x.s]), directos: directos.length }, null, 1))
console.log(`cuotas con efecto o hallazgo ${out.length} · con hallazgo ${hall.length} (🔴 ${hall.filter(f => f.gravedad === 3).length} · ⚠️ ${hall.filter(f => f.gravedad === 2).length} · ℹ️ ${hall.filter(f => f.gravedad === 1).length}) · directos ${directos.length}`)
for (const [k, x] of [...porRegla].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${x.n} × ${k}  ($ ${x.s.toLocaleString("es-AR")})`)
console.log(`📄 ${p}`)
