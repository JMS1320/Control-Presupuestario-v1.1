/**
 * 💳 Script 178 — A-FEAT-1526: TARJETA VISA MA, lo que JMS contestó en el Excel de trabajo (02/11) y aprobó correr:
 * «de la 1 a la 7 podés hacerlo salvo que haya alguna duda… adelante con lo que puedas».
 *
 *     npx tsx scripts/178-tarjeta-ma-respuestas-jms.mts              ← SIMULA: dice qué haría. No escribe.
 *     npx tsx scripts/178-tarjeta-ma-respuestas-jms.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * Qué hace — con las MISMAS funciones que la app, para que quede igual que si se hubiera hecho a mano:
 *   1 · PAGOS DE TARJETA: cada «SU PAGO» (pesos y USD) contra su débito de Galicia MA, si los dos controles de JMS
 *       cierran (anterior − pagos + consumos − bonif = saldo, y mismo importe en el banco). `vincularPagoTarjeta`.
 *   2 · PROSEGUR: confirma las 7 «a auditar», ata la de enero a su factura (dif. $ 0,01), contable LIB en los 9, y la
 *       cuenta SEGURIDAD Y ALARMA a sus facturas de MA (`asignarCuentaAFacturas`, que la lleva a los movimientos).
 *   3 · CONFIRMAR contra factura (Pampero, Fazio, Shop Ferretero, Shell, Mascotillas, Huellitas) + la cuenta que marcó
 *       JMS en la factura (Mascotas NO existe en el plan → esas dos quedan sin cuenta, duda D2).
 *   4 · MIMADOS: la factura queda con la tarjeta; se suelta la extracción de Galicia del 09/03.
 *   6 · JOCKEY: se suelta la factura de Trabucco (no es suya) y queda pendiente para el motor (su template no tiene
 *       cuota de sep-26); la factura de Trabucco lleva cuenta Consumos.
 *   ✋ NO hace el 5 (DirecTV / nafta MSA: falta el rótulo del aporte, D1) ni el 7 (templates nuevos, D2/D3).
 *
 * El «OK» de una fila a auditar es el mismo que el botón ✓ del Extracto: estado conciliado, motivo limpio, huella en
 * `nota_operador`, y la factura pasa a conciliada con su fecha de pago (`conciliarOrigenDelMovimiento`).
 *
 * Deshacer: `178-…-deshacer.mts` restaura, fila por fila, las columnas tocadas desde la foto `scripts/178-foto-antes.json`.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { vincularPagoTarjeta } from "../lib/conciliacion/vincular-pago-tarjeta"
import { conciliarOrigenDelMovimiento } from "../lib/conciliacion/confirmar-origen"
import { asignarCuentaAFacturas } from "../lib/conciliacion/asignar-cuenta"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/178-foto-antes.json"
const HUELLA = "[script 178] JMS 02/11 (Excel tarjeta MA)"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ma = sb.schema("ma")
const n = (x: unknown) => Number(x) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const frenos: string[] = []
const plan: string[] = []

// ── Lectura ──────────────────────────────────────────────────────────────────────────────────────────────
const { data: tj } = await ma.from("tarjeta_visa").select("*").order("fecha")
const { data: gal } = await ma.from("ma_galicia").select("*").ilike("descripcion", "PAGO TARJETA VISA%")
const tarjeta = (tj ?? []) as any[], debitos = (gal ?? []) as any[]
const porId = new Map(tarjeta.map(t => [t.id, t]))

// ── 1 · Pagos de tarjeta ─────────────────────────────────────────────────────────────────────────────────
const resumenes = tarjeta.filter(f => f.estado === "total").sort((a, b) => a.fecha_cierre.localeCompare(b.fecha_cierre))
const c1 = (nr: string) => {
  const r = resumenes.find(x => x.nro_resumen === nr)!
  const rows = tarjeta.filter(f => f.nro_resumen === nr && f.estado !== "total")
  const pagos = rows.filter(x => /^SU PAGO EN PESOS/i.test(x.descripcion)).reduce((t, x) => t + n(x.creditos), 0)
  const otros = rows.filter(x => !/^SU PAGO/i.test(x.descripcion))
  return r2(n(r.creditos) - pagos + otros.reduce((t, x) => t + n(x.debitos) - n(x.creditos), 0) - n(r.debitos))
}
const usados = new Set<string>()
interface Vinculo { nr: string; cierre: string; debito: any; suPagoIds: string[]; que: string }
const vinculos: Vinculo[] = []
for (let i = 1; i < resumenes.length; i++) {
  const pagado = resumenes[i - 1], actual = resumenes[i]
  const sus = tarjeta.filter(f => f.nro_resumen === actual.nro_resumen && /^SU PAGO/i.test(f.descripcion) && f.estado !== "conciliado")
  if (!sus.length) continue
  if (c1(pagado.nro_resumen) !== 0 || c1(actual.nro_resumen) !== 0) { frenos.push(`resumen ${dmy(pagado.fecha_cierre)}: el control 1 no cierra`); continue }
  for (const s of sus.filter(s => /EN PESOS/i.test(s.descripcion))) {
    const d = debitos.find(d => !usados.has(d.id) && Math.abs(n(d.debitos) - n(s.creditos)) < 0.01 && Math.abs(dias(d.fecha, s.fecha)) <= 5)
    if (!d) { frenos.push(`«Su pago» ${dmy(s.fecha)} $ ${s.creditos}: sin débito en Galicia (control 2)`); continue }
    usados.add(d.id); vinculos.push({ nr: pagado.nro_resumen, cierre: pagado.fecha_cierre, debito: d, suPagoIds: [s.id], que: `pesos ${s.creditos}` })
  }
  for (const s of sus.filter(s => /EN USD/i.test(s.descripcion))) {
    const d = debitos.find(d => !usados.has(d.id) && Math.abs(dias(d.fecha, s.fecha)) <= 1)
    if (!d) { plan.push(`  ⚠️ «Su pago en USD» ${dmy(s.fecha)}: no hay débito en pesos para la parte en dólares → queda`); continue }
    usados.add(d.id); vinculos.push({ nr: pagado.nro_resumen, cierre: pagado.fecha_cierre, debito: d, suPagoIds: [s.id], que: `USD ${s.creditos_usd} = $ ${d.debitos}` })
  }
}
plan.push(`1 · Pagos de tarjeta: ${vinculos.length} «Su pago» contra su débito de Galicia MA`)

// ── 2 · Prosegur ─────────────────────────────────────────────────────────────────────────────────────────
const prosegur = tarjeta.filter(f => /PROSEGUR/i.test(f.descripcion))
const prosegurAuditar = prosegur.filter(f => f.estado === "auditar" && f.comprobante_arca_id)
const prosegurEnero = prosegur.find(f => f.estado === "pendiente" && !f.comprobante_arca_id)
const { data: fcPros } = await ma.from("comprobantes_arca").select("id,fecha_emision,imp_total,cuenta_contable").eq("cuit", "30709776564")
const fcEnero = prosegurEnero ? (fcPros ?? []).find((c: any) => Math.abs(n(c.imp_total) - n(prosegurEnero.debitos)) <= 0.01 && Math.abs(dias(c.fecha_emision, prosegurEnero.fecha)) < 20) : null
if (prosegurEnero && !fcEnero) frenos.push("Prosegur enero: no encontré su factura")
if (fcEnero) {
  for (const t of TABLAS_CON_VINCULO_ARCA) {
    const q = t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)
    const { data } = await q.select("id").eq("comprobante_arca_id", fcEnero.id)
    if (data?.length) frenos.push(`la factura de Prosegur de enero ya está atada a un movimiento de ${t.tabla}`)
  }
}
plan.push(`2 · Prosegur: confirmar ${prosegurAuditar.length} · atar enero a la factura del ${dmy(fcEnero?.fecha_emision)} ($ ${fcEnero?.imp_total} vs $ ${prosegurEnero?.debitos}) · contable LIB en ${prosegur.length} · cuenta SEGURIDAD Y ALARMA en ${(fcPros ?? []).length} facturas`)

// ── 3 · Confirmar con cuenta ─────────────────────────────────────────────────────────────────────────────
const CONFIRMAR: [RegExp, string | null][] = [
  [/^PAMPERO JUNCAL/, "Consumos"], [/^MERPAGO\*FAZIO/, null], [/^MERPAGO\*SHOPFERRETERO/, "REPUESTOS Y REPARACIONES"],
  [/^SHELL SARMIENTO/, "COMBUSTIBLES Y LUBRICANTES"], [/^MERPAGO\*MASCOTILLAS/, null], [/^MERPAGO\*HUELLITAS/, null],
]
const confirmar: { mov: any; cuenta: string | null }[] = []
for (const [re, cuenta] of CONFIRMAR) {
  const ms = tarjeta.filter(f => re.test(f.descripcion) && f.estado === "auditar" && f.comprobante_arca_id)
  if (ms.length !== 1) { frenos.push(`${re}: esperaba 1 movimiento a auditar con factura, hay ${ms.length}`); continue }
  confirmar.push({ mov: ms[0], cuenta })
}
plan.push(`3 · Confirmar contra factura: ${confirmar.map(c => `${c.mov.descripcion.split(" ")[0]}${c.cuenta ? ` → ${c.cuenta}` : " (sin cuenta)"}`).join(" · ")}`)

// ── 4 · Mimados ──────────────────────────────────────────────────────────────────────────────────────────
const mimados = tarjeta.find(f => /^MIMADOS/.test(f.descripcion) && f.estado === "auditar" && f.comprobante_arca_id)
const { data: mimGal } = mimados ? await ma.from("ma_galicia").select("*").eq("comprobante_arca_id", mimados.comprobante_arca_id) : { data: [] }
if (!mimados) frenos.push("Mimados: no está a auditar con factura")
if ((mimGal ?? []).length !== 1 || !/EXTRACCION/i.test(mimGal![0].descripcion)) frenos.push("Mimados: esperaba UNA extracción en Galicia atada a su factura")
plan.push(`4 · Mimados: confirmar la tarjeta (${dmy(mimados?.fecha)}) y soltar la extracción de Galicia del ${dmy(mimGal?.[0]?.fecha)}`)

// ── 6 · Jockey / Trabucco ────────────────────────────────────────────────────────────────────────────────
const jockey = tarjeta.find(f => /^JOCKEY/.test(f.descripcion) && f.estado === "auditar" && f.comprobante_arca_id)
const { data: fcTrab } = jockey ? await ma.from("comprobantes_arca").select("id,denominacion_emisor,fecha_emision,imp_total").eq("id", jockey.comprobante_arca_id) : { data: [] }
if (!jockey || !/TRABUCCO/i.test(fcTrab?.[0]?.denominacion_emisor ?? "")) frenos.push("Jockey: no está atado a la factura de Trabucco")
plan.push(`6 · Jockey ${dmy(jockey?.fecha)}: soltar la factura de Trabucco (queda pendiente para el motor) · la factura de Trabucco del ${dmy(fcTrab?.[0]?.fecha_emision)} → cuenta Consumos`)

// ── Foto antes ───────────────────────────────────────────────────────────────────────────────────────────
const idsTj = new Set<string>([...vinculos.flatMap(v => v.suPagoIds), ...prosegur.map(f => f.id), ...confirmar.map(c => c.mov.id), mimados?.id, jockey?.id].filter(Boolean))
const idsGal = new Set<string>([...vinculos.map(v => v.debito.id), ...(mimGal ?? []).map((g: any) => g.id)])
const idsFc = new Set<string>([...(fcPros ?? []).map((c: any) => c.id), ...confirmar.map(c => c.mov.comprobante_arca_id), mimados?.comprobante_arca_id, jockey?.comprobante_arca_id].filter(Boolean))
// la propagación de cuenta puede tocar movimientos atados a esas facturas en cualquiera de las 11 tablas
const otrosMov: Record<string, any[]> = {}
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const q = t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)
  const { data } = await q.select("*").in("comprobante_arca_id", [...idsFc])
  if (data?.length) otrosMov[`${t.schema}.${t.tabla}`] = data
}
const foto = {
  tomada: new Date().toISOString(),
  "ma.tarjeta_visa": tarjeta.filter(t => idsTj.has(t.id)),
  "ma.ma_galicia": [...debitos.filter(d => idsGal.has(d.id)), ...(mimGal ?? [])].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i),
  "ma.comprobantes_arca": ((await ma.from("comprobantes_arca").select("*").in("id", [...idsFc])).data ?? []),
  propagacion: otrosMov,
}
console.log(plan.join("\n"))
console.log(`\nFoto: ${foto["ma.tarjeta_visa"].length} renglones de tarjeta · ${foto["ma.ma_galicia"].length} de Galicia · ${foto["ma.comprobantes_arca"].length} facturas · ${Object.values(otrosMov).flat().length} movimientos atados a esas facturas`)
if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe: ¿ya se corrió?`); process.exit(1) }
writeFileSync(FOTO, JSON.stringify(foto, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const avisos: string[] = []
const okFila = async (mov: any, extra: Record<string, unknown> = {}) => {
  const previa = String(mov.nota_operador || "").trim()
  const huella = `OK ${HUELLA}${mov.motivo_revision ? " · " + mov.motivo_revision : ""}`
  const { error } = await ma.from("tarjeta_visa").update({ estado: "conciliado", motivo_revision: null, nota_operador: [previa, huella].filter(Boolean).join(" · "), ...extra }).eq("id", mov.id)
  if (error) throw error
  const o = await conciliarOrigenDelMovimiento(sb as any, { ...mov, ...extra })
  avisos.push(...o.avisos.map(a => `${mov.descripcion}: ${a}`))
}
// 1
for (const v of vinculos) await vincularPagoTarjeta(sb, { nr: v.nr, cierre: v.cierre, debito: { tabla: "ma.ma_galicia", id: v.debito.id }, tarjeta: { tabla: "ma.tarjeta_visa" }, suPagoIds: v.suPagoIds })
// 2
for (const m of prosegurAuditar) await okFila(m)
if (prosegurEnero && fcEnero) await okFila(prosegurEnero, { comprobante_arca_id: fcEnero.id })
{ const { error } = await ma.from("tarjeta_visa").update({ contable: "LIB" }).in("id", prosegur.map(f => f.id)); if (error) throw error }
const r2a = await asignarCuentaAFacturas(sb as any, "MA", (fcPros ?? []).map((c: any) => c.id), { cuenta_contable: "SEGURIDAD Y ALARMA" })
// 3
for (const c of confirmar) await okFila(c.mov)
const porCuenta = new Map<string, string[]>()
for (const c of confirmar) if (c.cuenta) porCuenta.set(c.cuenta, [...(porCuenta.get(c.cuenta) ?? []), c.mov.comprobante_arca_id])
porCuenta.set("Consumos", [...(porCuenta.get("Consumos") ?? []), jockey.comprobante_arca_id])   // 6 · Trabucco a consumo
const r3: any[] = []
for (const [cuenta, ids] of porCuenta) r3.push(await asignarCuentaAFacturas(sb as any, "MA", ids, { cuenta_contable: cuenta }))
// 4
{ const g = mimGal![0]; const { error } = await ma.from("ma_galicia").update({ comprobante_arca_id: null, estado: "pendiente", categ: null, nro_cuenta: null, motivo_revision: null,
  nota_operador: [String(g.nota_operador || "").trim(), `${HUELLA}: se soltó la factura de Mimados (es de la tarjeta del ${dmy(mimados.fecha)})`].filter(Boolean).join(" · ") }).eq("id", g.id); if (error) throw error }
await okFila(mimados)
// 6
{ const { error } = await ma.from("tarjeta_visa").update({ comprobante_arca_id: null, estado: "pendiente", categ: null, nro_cuenta: null, motivo_revision: null,
  nota_operador: [String(jockey.nota_operador || "").trim(), `${HUELLA}: se soltó la factura de Trabucco (Jockey es una suscripción; va a su template)`].filter(Boolean).join(" · ") }).eq("id", jockey.id); if (error) throw error }

console.log(`\n✅ Escrito. Foto en ${FOTO}.`)
console.log(`   Propagación Prosegur: ${r2a.propagacion.propagados} movimientos · salteados ${r2a.propagacion.salteados.length} · fallaron ${r2a.propagacion.fallaron.length}`)
for (const r of r3) console.log(`   Cuenta ${r.cuenta?.cuenta_contable}: ${r.actualizados} facturas · ${r.propagacion.propagados} movimientos · salteados ${r.propagacion.salteados.length}`)
if (avisos.length) console.log("⚠️ Avisos:\n - " + avisos.join("\n - "))
