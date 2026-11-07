/**
 * 🧾 ANEXO «CONSUMOS MA» — todas las cuotas de los templates Consumos MA (2025, responsable PAM, y 2026, responsable MA) con su pago,
 * la cuenta que pagó, la descripción del banco y los códigos contable / interno TAL COMO ESTÁN HOY (A-FEAT-1579). SÓLO LEE.
 * JMS 07/11: «los consumos son de MA en 2025 y 2026 en principio, pero debería ver la lista. Preparámela como un anexo dejando todo como está hoy».
 *
 *     npx tsx scripts/excel-consumos-ma.mts
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { agregarHoja } from "../lib/balance/export-libro-diario"
import { armarResumenPorMes } from "../lib/balance/resumen-por-mes"
import { fechasReales } from "../lib/excel/fechas-reales"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const desde = (s: string, t: string) => (s === "public" ? sb.from(t) : sb.schema(s).from(t))
const r2 = (n: number) => Math.round(n * 100) / 100

const { data: tpls } = await sb.from("egresos_sin_factura").select("id, nombre_referencia, año, responsable, cuenta_agrupadora").eq("nombre_referencia", "Consumos MA")
const tplDe = new Map<string, any>((tpls ?? []).map((t: any) => [t.id, t]))
const cuotas: any[] = []
for (const t of tpls ?? []) {
  for (let d = 0; ; d += 1000) {
    const { data, error } = await sb.from("cuotas_egresos_sin_factura").select("id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, grupo_pago_id, descripcion").eq("egreso_id", t.id).order("id").range(d, d + 999)
    if (error) throw new Error(error.message)
    cuotas.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
}
const ids = [...new Set(cuotas.flatMap(c => [c.id, c.grupo_pago_id]).filter(Boolean))]
const pagos = new Map<string, any[]>()
for (const t of TABLAS_CON_VINCULO_ARCA) {
  for (let i = 0; i < ids.length; i += 200) {
    let r = await desde(t.schema, t.tabla).select("id, fecha, debitos, creditos, descripcion, contable, interno, template_cuota_id").in("template_cuota_id", ids.slice(i, i + 200))
    if (r.error) r = await desde(t.schema, t.tabla).select("id, fecha, debitos, creditos, descripcion, contable, template_cuota_id").in("template_cuota_id", ids.slice(i, i + 200))
    if (r.error) { console.log(`⚠️ no se pudo leer ${t.cuenta}: ${r.error.message}`); continue }
    for (const m of r.data ?? []) pagos.set(String(m.template_cuota_id), [...(pagos.get(String(m.template_cuota_id)) ?? []), { ...m, cuenta: t.cuenta, titular: t.titular }])
  }
}

const filas = cuotas.map(c => {
  const t = tplDe.get(c.egreso_id), ps = pagos.get(c.id) ?? (c.grupo_pago_id ? pagos.get(c.grupo_pago_id) ?? [] : [])
  const ref = String(c.fecha_vencimiento ?? c.fecha_estimada ?? "").slice(0, 10)
  return { c, t, ps, ref, fechaPago: ps.length ? String(ps[0].fecha).slice(0, 10) : "" }
}).sort((a, b) => (a.fechaPago || a.ref).localeCompare(b.fechaPago || b.ref))

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const meses: { clave: string; rotulo: string }[] = []
for (let y = 2025, m = 1; y < 2026 || m <= 12; m === 12 ? (y++, m = 1) : m++) { meses.push({ clave: `${y}-${String(m).padStart(2, "0")}`, rotulo: `${MES[m - 1]}-${String(y).slice(-2)}` }); if (y === 2026 && m === 12) break }

const items = filas.map(({ c, t, ps, ref, fechaPago }) => {
  const pagador = ps.length ? [...new Set(ps.map(p => p.titular))].join(" + ") : ""
  const cuenta = ps.length ? [...new Set(ps.map(p => p.cuenta))].join(" + ") : "(sin movimiento)"
  return {
    categoria: `Template ${t.año} (responsable ${t.responsable}) — pagó ${pagador || "nadie / sin movimiento"}`,
    mes: (fechaPago || ref).slice(0, 7), importe: Number(c.monto) || 0, orden: `${t.año}|${fechaPago || ref}`,
    columnas: [fechaPago || ref, ref, `Consumos MA ${t.año}`, t.responsable, c.numero_cuota ?? "", c.estado, c.descripcion ?? "", pagador, cuenta,
      ps.map(p => String(p.descripcion ?? "").trim()).filter(Boolean).join(" | "),
      ps.length ? r2(ps.reduce((s, p) => s + Number(p.debitos || 0) - Number(p.creditos || 0), 0)) : "",
      [...new Set(ps.map(p => String(p.contable ?? "").trim() || "(vacío)"))].join(" / "),
      [...new Set(ps.map(p => String(p.interno ?? "").trim() || "(vacío)"))].join(" / "),
      c.grupo_pago_id ? "sí" : ""],
  }
})
const { filas: hoja } = armarResumenPorMes(items, {
  titulo: "ANEXO — CONSUMOS MA (gastos personales de Mercedes): todas las cuotas 2025 y 2026, tal como están hoy",
  notas: ["Template 2025 = responsable PAM · template 2026 = responsable MA. Cada cuota con su pago: quién pagó, cuenta, descripción del banco y los códigos contable / interno de HOY (no se cambió nada).",
    "Fecha = la del pago; si no tiene pago, el vencimiento (o la fecha estimada)."],
  meses, encabezadoDetalle: ["Fecha", "Vencimiento", "Template", "Responsable", "Cuota", "Estado", "Descripción de la cuota", "Quién pagó", "Cuenta",
    "Descripción del banco", "Importe del movimiento", "Código contable", "Código interno", "Pago agrupado"],
  importeEn: 7, semestres: true,
})
const wb = XLSX.utils.book_new()
agregarHoja(wb, "Consumos MA", hoja)
fechasReales(wb as any)
let p = join(CARPETA, "Anexo Consumos MA 2025-2026 (2026-11-07).xlsx"), v = 2
while (existsSync(p)) p = join(CARPETA, `Anexo Consumos MA 2025-2026 (2026-11-07) v${v++}.xlsx`)
XLSX.writeFile(wb, p)
const por = new Map<string, { n: number; s: number }>()
for (const i of items) { const x = por.get(i.categoria) ?? { n: 0, s: 0 }; por.set(i.categoria, { n: x.n + 1, s: r2(x.s + i.importe) }) }
for (const [k, x] of por) console.log(`${x.n} cuotas · $ ${x.s.toLocaleString("es-AR")} · ${k}`)
console.log(`📄 ${p}`)
