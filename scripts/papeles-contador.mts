/**
 * 📒 **Papeles para el contador — detalle de movimientos, ejercicio 2025/26 de MSA** (A-DAT-68, 2026-10-07).
 *
 * Pedido del usuario: *«parte de lo que debo informar al contador es el detalle de suscripción y rescates
 * de Fondos… armar el detalle de movimientos en un Excel aparte que irá directo al contador, donde se vea
 * cada movimiento listado de corrido de punta a punta. En este Excel irán varias solapas; ésta será
 * detalle de FCI. Haremos uno nuevo porque ahí iremos agregando lo terminado»*.
 *
 *     npx tsx scripts/papeles-contador.mts                  → arma el Excel (no escribe en la base)
 *     npx tsx scripts/papeles-contador.mts --cargar-fci     → además LISTA las cuotas de FCI a cargar
 *     npx tsx scripts/papeles-contador.mts --cargar-fci --aplicar   → las carga (con OK del usuario)
 *
 * De dónde sale cada tramo del ejercicio (01/07/2025 → 30/06/2026):
 *   · jul-25 → ene-26: la planilla del usuario (el banco de esos meses no está en la app);
 *   · feb-26 → jun-26: el extracto de la app (`msa_galicia`, CATEG FCI).
 *
 * La carga en el template (decisión del usuario): **una cuota por mes y por sentido** —suscripciones
 * (egreso) y rescates (ingreso)—, en estado **«anterior»** (histórico: no va al Cash Flow ni a conciliar).
 *
 * 🧮 Controles: (1) feb–jun, el extracto contra las cuotas del template (mismo número por dos caminos);
 * (2) jul–ene, lo que se carga contra la planilla, mes por mes.
 */
import { createRequire } from "node:module"
import { readFileSync, writeFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { hojaDePendientes } from "../lib/balance/pendientes-balance"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx") as typeof import("xlsx")

const ENTRADA = "- Comunicacion JMS Claude - Archivos/Balance/"
  + "extracto desde julio del 2025 hasta enero 26 parcial. galicia MSA cta cte pesos.xlsx"
const SALIDA = "- Comunicacion JMS Claude - Archivos/Balance/Papeles para el contador - MSA 2025-26.xlsx"
const TEMPLATE_FCI = "886bba83-b38e-4622-9c69-ff6235e1ef97"   // FIMA Premium Galicia Pesos (MSA)

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const nombreMes = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
const ultimoDia = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }

interface Mov { fecha: string; descripcion: string; detalle: string; suscripcion: number; rescate: number; origen: string; orden: number }

// ── jul-25 → ene-26: la planilla (misma lectura que el segmentado) ──
const wbIn = XLSX.read(readFileSync(ENTRADA), { type: "buffer", cellDates: true })
const aoa = XLSX.utils.sheet_to_json<unknown[]>(wbIn.Sheets[wbIn.SheetNames[0]], { header: 1, raw: true, defval: "" })
const col: Record<string, number> = {}
;(aoa[2] as unknown[]).forEach((h, i) => { if (String(h).trim()) col[String(h).trim()] = i })
const num = (v: unknown) => typeof v === "number" ? v : (parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0)
const tx = (v: unknown) => String(v ?? "").trim()
const movs: Mov[] = []
for (let i = 3; i < aoa.length; i++) {
  const r = aoa[i] as unknown[]
  const f = r[col["Fecha"]]
  if (!(f instanceof Date) || tx(r[col["CATEG"]]).toUpperCase() !== "FCI") continue
  movs.push({
    fecha: f.toISOString().slice(0, 10), descripcion: tx(r[col["Descripción"]]), detalle: tx(r[col["Detalle"]]),
    suscripcion: num(r[col["Débitos"]]), rescate: num(r[col["Créditos"]]), origen: "planilla", orden: -i,
  })
}

// ── feb-26 → jun-26: el extracto de la app ──
const { data: app, error } = await sb.from("msa_galicia")
  .select("id, fecha, descripcion, detalle, debitos, creditos, categ, template_id")
  .gte("fecha", "2026-02-01").lte("fecha", "2026-06-30").eq("categ", "FCI").order("fecha")
if (error) throw error
for (const [k, m] of (app || []).entries()) movs.push({
  fecha: m.fecha, descripcion: m.descripcion || "", detalle: m.detalle || "",
  suscripcion: Number(m.debitos) || 0, rescate: Number(m.creditos) || 0, origen: "extracto app", orden: k,
})
movs.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden)

// ── Por mes ──
const porMes = new Map<string, { s: number; r: number; ns: number; nr: number }>()
for (const m of movs) {
  const k = m.fecha.slice(0, 7)
  const t = porMes.get(k) || { s: 0, r: 0, ns: 0, nr: 0 }
  if (m.suscripcion) { t.s += m.suscripcion; t.ns++ }
  if (m.rescate) { t.r += m.rescate; t.nr++ }
  porMes.set(k, t)
}

// ── Control 1: feb–jun, extracto contra las cuotas del template ──
const { data: cuotas } = await sb.from("cuotas_egresos_sin_factura")
  .select("fecha_estimada, monto, tipo_movimiento, estado").eq("egreso_id", TEMPLATE_FCI)
const cuotasMes = (ym: string, tipo: string) => r2((cuotas || []).filter((c: any) => String(c.fecha_estimada).startsWith(ym) && c.tipo_movimiento === tipo)
  .reduce((s: number, c: any) => s + (Number(c.monto) || 0), 0))
console.log("CONTROL feb–jun: extracto vs cuotas del template")
for (const ym of ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]) {
  const t = porMes.get(ym) || { s: 0, r: 0, ns: 0, nr: 0 }
  const ok = Math.abs(r2(t.s) - cuotasMes(ym, "egreso")) < 0.01 && Math.abs(r2(t.r) - cuotasMes(ym, "ingreso")) < 0.01
  console.log(`  ${ym}  susc ${fmt(t.s)} / ${fmt(cuotasMes(ym, "egreso"))}   resc ${fmt(t.r)} / ${fmt(cuotasMes(ym, "ingreso"))}   ${ok ? "✓" : "✗ NO CIERRA"}`)
}

// ── El Excel ──
let acum = 0
const filas: (string | number)[][] = [
  ["MARTINEZ SOBRADO AGRO SRL — CUIT 30-61778601-6"],
  ["Detalle de suscripciones y rescates de Fondos Comunes de Inversión — ejercicio 01/07/2025 al 30/06/2026"],
  [],
  ["Fecha", "Descripción", "Detalle", "Suscripción", "Rescate", "Neto acumulado (suscr. − resc.)", "Origen"],
]
for (const m of movs) {
  acum = r2(acum + m.suscripcion - m.rescate)
  const [y, mo, d] = m.fecha.split("-")
  filas.push([`${d}/${mo}/${y}`, m.descripcion, m.detalle, m.suscripcion || "", m.rescate || "", acum, m.origen])
}
const totS = r2(movs.reduce((s, m) => s + m.suscripcion, 0)), totR = r2(movs.reduce((s, m) => s + m.rescate, 0))
filas.push([], ["TOTAL", `${movs.length} movimientos`, "", totS, totR, r2(totS - totR), ""])
filas.push([], ["Resumen por mes"], ["Mes", "Suscripciones", "Cant.", "Rescates", "Cant.", "Neto del mes"])
for (const [ym, t] of [...porMes.entries()].sort()) filas.push([nombreMes(ym), r2(t.s), t.ns, r2(t.r), t.nr, r2(t.s - t.r)])
const ws = XLSX.utils.aoa_to_sheet(filas)
ws["!cols"] = [{ wch: 11 }, { wch: 34 }, { wch: 44 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 13 }]
for (const [addr, cell] of Object.entries(ws)) {
  if (addr.startsWith("!")) continue
  const c = cell as any
  if (typeof c.v === "number" && !/^[CG]/.test(addr)) c.z = "#,##0.00"
}
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, "Detalle FCI")

// ── Solapa «Detalle Plazos Fijos» (2026-10-07) — de la planilla; feb–jun no hubo plazos fijos ──
// Cada constitución se empareja con el cobro siguiente: la diferencia son los intereses (menos
// impuestos, si los hubo — pendiente de desglosar, ver solapa de pendientes).
const pf: { fecha: string; desc: string; constit: number; cobro: number }[] = []
for (let i = 3; i < aoa.length; i++) {
  const r = aoa[i] as unknown[]
  const f = r[col["Fecha"]]
  if (!(f instanceof Date) || !/plazo fijo/i.test(tx(r[col["Descripción"]]))) continue
  pf.push({ fecha: f.toISOString().slice(0, 10), desc: tx(r[col["Descripción"]]), constit: num(r[col["Débitos"]]), cobro: num(r[col["Créditos"]]) })
}
pf.sort((a, b) => a.fecha.localeCompare(b.fecha))
const filasPf: (string | number)[][] = [
  ["MARTINEZ SOBRADO AGRO SRL — CUIT 30-61778601-6"],
  ["Detalle de plazos fijos — ejercicio 01/07/2025 al 30/06/2026"],
  [],
  ["Fecha", "Descripción del banco", "Plazo fijo", "Constitución", "Cobro al vencimiento", "Intereses (cobro − constitución)"],
]
let nPf = 0, abierto: number | null = null
for (const m of pf) {
  const [y, mo, d] = m.fecha.split("-")
  if (m.constit) { nPf++; abierto = m.constit }
  const etiqueta = `Plazo fijo ${String(nPf).padStart(2, "0")}`
  const interes = m.cobro && abierto != null ? r2(m.cobro - abierto) : ""
  if (m.cobro) abierto = null
  filasPf.push([`${d}/${mo}/${y}`, m.desc, etiqueta, m.constit || "", m.cobro || "", interes])
}
const totC = r2(pf.reduce((s, m) => s + m.constit, 0)), totCob = r2(pf.reduce((s, m) => s + m.cobro, 0))
filasPf.push([], ["TOTAL", `${pf.length} movimientos`, "", totC, totCob, r2(totCob - totC)])
filasPf.push([], ["⚠ Los cobros incluyen los intereses; si hubo impuestos (retención de Ganancias, etc.), falta desglosarlos — ver «Pendientes a revisar»."])
const wsPf = XLSX.utils.aoa_to_sheet(filasPf)
wsPf["!cols"] = [{ wch: 11 }, { wch: 38 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 26 }]
for (const [addr, cell] of Object.entries(wsPf)) { const c = cell as any; if (!addr.startsWith("!") && typeof c.v === "number") c.z = "#,##0.00" }
XLSX.utils.book_append_sheet(wb, wsPf, "Detalle Plazos Fijos")

// ── Solapa «Pendientes a revisar» — de la MISMA tabla que la pantalla de papeles (A-FEAT-1258) ──
const { data: pends } = await sb.from("balance_pendientes").select("*").eq("empresa", "MSA").eq("anio_cierre", 2026)
const wsPend = XLSX.utils.aoa_to_sheet(hojaDePendientes((pends || []) as any, "MSA — pendientes a revisar del ejercicio 2025/26"))
wsPend["!cols"] = [{ wch: 4 }, { wch: 90 }, { wch: 11 }, { wch: 10 }, { wch: 50 }, { wch: 11 }]
XLSX.utils.book_append_sheet(wb, wsPend, "Pendientes a revisar")
writeFileSync(SALIDA, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
console.log(`\nExcel: ${SALIDA}\n  ${movs.length} movimientos · suscripciones ${fmt(totS)} · rescates ${fmt(totR)} · neto ${fmt(r2(totS - totR))}`)

// ── La carga de jul–ene en el template: una cuota por mes y por sentido, «anterior» ──
if (process.argv.includes("--cargar-fci")) {
  const aplicar = process.argv.includes("--aplicar")
  const aCargar: any[] = []
  for (const [ym, t] of [...porMes.entries()].sort()) {
    if (ym >= "2026-02") continue
    for (const [tipo, monto, n, pal] of [["egreso", t.s, t.ns, "Suscripciones"], ["ingreso", t.r, t.nr, "Rescates"]] as const) {
      if (!(monto > 0)) continue
      const ya = (cuotas || []).some((c: any) => String(c.fecha_estimada).startsWith(ym) && c.tipo_movimiento === tipo)
      if (ya) { console.log(`  ⏭  ${ym} ${pal}: ya hay cuota en ese mes — no se duplica`); continue }
      aCargar.push({
        egreso_id: TEMPLATE_FCI, fecha_estimada: ultimoDia(ym), fecha_vencimiento: ultimoDia(ym),
        monto: r2(monto), estado: "anterior", tipo_movimiento: tipo,
        descripcion: `${pal} FCI ${nombreMes(ym)} (${n} mov.) — histórico`,
      })
    }
  }
  console.log(`\nCUOTAS A CARGAR en «FIMA Premium Galicia Pesos» (MSA), estado «anterior»: ${aCargar.length}`)
  for (const c of aCargar) console.log(`  ${c.fecha_estimada}  ${c.tipo_movimiento === "egreso" ? "suscripción" : "rescate    "}  ${fmt(c.monto).padStart(16)}   ${c.descripcion}`)
  if (aplicar && aCargar.length) {
    const { error: e } = await sb.from("cuotas_egresos_sin_factura").insert(aCargar)
    if (e) throw e
    console.log(`✅ ${aCargar.length} cuotas cargadas`)
  } else if (aCargar.length) console.log("(no se escribió nada: falta --aplicar)")
}
