/**
 * 🏦 Script 183 — CA Galicia MA, tanda 3: lo que coincide con su factura + las CUENTAS CORRIENTES de proveedores
 * (A-FEAT-1526; JMS 03/11: «a y b correcto avanza», «Esposito es un corralón, Penino es pintor», «Penino se pagó desde MSA cta cte»).
 *
 *     npx tsx scripts/183-ca-ma-tanda-3.mts              ← SIMULA
 *     npx tsx scripts/183-ca-ma-tanda-3.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * A · COINCIDEN (se concilian contra su factura):
 *     - a auditar con la factura que propuso el motor: Gamboa 3936 / 3988 / 4220, Esposito 19719, Etcheverry 1813, Ripetta 3547, Sola 938;
 *     - pendientes que se atan: Díaz (2 pagos → su única factura de $ 1,9 M), Penino 08/05 → FC 225, 22/05 → FC 224, 29/05 → FC 227.
 * B · CUENTA CORRIENTE (el pago lleva la marca «CTA <proveedor>» y la cuenta del gasto; la factura que llegue no suma el gasto otra vez):
 *     - Centro Areco Sada: 2 pagos + sus 16 comprobantes (saldo: MA le debe $ 316,85, queda en la nota);
 *     - Esposito: el pago del 19/11/25 sin factura · Trabucco: los 3 pagos de 2026 sin factura (Consumos);
 *     - Penino FC 226: pagada desde MSA por la cuenta corriente de MA → queda «pagado» con su nota.
 *     ⏸ Gamboa (17.000 y 3.711.000 sin factura) espera su cuenta contable.
 * CUENTAS en las facturas: Penino, Esposito y Centro Areco Sada → «Pintura, materiales y herramientas»; Sola → «AUTOMOTORES REP Y
 *     MANTENIMIENTO» (la que usa en MSA). Por `asignarCuentaAFacturas`, que propaga a los movimientos atados.
 *
 * Deshacer: `183-…-deshacer.mts` restaura desde la foto (movimientos, facturas y la propagación).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { conciliarOrigenDelMovimiento } from "../lib/conciliacion/confirmar-origen"
import { asignarCuentaAFacturas } from "../lib/conciliacion/asignar-cuenta"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/183-foto-antes.json"
const HUELLA = "[script 183] JMS 03/11"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ma = sb.schema("ma")
const n = (x: unknown) => Number(x) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const frenos: string[] = []
const PINTURA = "Pintura, materiales y herramientas", AUTOS = "AUTOMOTORES REP Y MANTENIMIENTO"
const CUIT = { gamboa: "20208914880", penino: "20139373104", diaz: "20221333382", sola: "20244256512", areco: "30716729520", ripetta: "20055301353",
  esposito: "33506743589", trabucco: "27220014237", etcheverry: "27224315282" }

const { data: movsTodos } = await ma.from("ma_galicia").select("*").neq("estado", "conciliado")
const movs = (movsTodos ?? []).map((m: any) => ({ ...m, cuit: (String(m.concepto ?? "").match(/\d{11}/) ?? [""])[0] }))
const { data: fcsTodas } = await ma.from("comprobantes_arca").select("*").in("cuit", Object.values(CUIT))
const fcs = fcsTodas ?? []
const fcN = (cuit: string, nro: number) => fcs.filter((f: any) => f.cuit === cuit && Number(f.numero_desde) === nro)
const movDe = (cuit: string, fecha: string, monto: number) => movs.filter((m: any) => m.cuit === cuit && m.fecha === fecha && r2(n(m.debitos)) === monto)
const uno = <T,>(xs: T[], qué: string): T | undefined => { if (xs.length !== 1) frenos.push(`${qué}: ${xs.length} encontrados`); return xs[0] }

// ── A1 · a auditar con su factura ────────────────────────────────────────────────────────────────────────
const A1: [string, number, string][] = [[CUIT.gamboa, 3936, "Gamboa"], [CUIT.gamboa, 3988, "Gamboa"], [CUIT.gamboa, 4220, "Gamboa"], [CUIT.esposito, 19719, "Esposito"],
  [CUIT.etcheverry, 1813, "Etcheverry"], [CUIT.ripetta, 3547, "Ripetta"], [CUIT.sola, 938, "Sola"]]
const ok: any[] = []
for (const [c, nro, quien] of A1) {
  const f = uno(fcN(c, nro), `${quien} FC ${nro}`)
  const m = uno(movs.filter((x: any) => x.comprobante_arca_id === f?.id && x.estado === "auditar"), `${quien} FC ${nro} — movimiento a auditar`)
  if (f && m && r2(n(f.imp_total)) !== r2(n(m.debitos))) frenos.push(`${quien} FC ${nro}: importe distinto`)
  if (m) ok.push({ m, f, quien })
}
// ── A2 · pendientes que se atan ──────────────────────────────────────────────────────────────────────────
const fcDiaz = uno(fcs.filter((f: any) => f.cuit === CUIT.diaz), "Díaz factura")
const A2: { m: any; f: any; quien: string }[] = []
for (const [fecha, monto] of [["2025-12-01", 1000000], ["2025-12-05", 900000]] as const) { const m = uno(movDe(CUIT.diaz, fecha, monto), `Díaz ${fecha}`); if (m) A2.push({ m, f: fcDiaz, quien: "Díaz" }) }
for (const [fecha, monto, nro] of [["2026-05-08", 3000000, 225], ["2026-05-22", 2000000, 224], ["2026-05-29", 3000000, 227]] as const) {
  const m = uno(movDe(CUIT.penino, fecha, monto), `Penino ${fecha}`), f = uno(fcN(CUIT.penino, nro), `Penino FC ${nro}`)
  if (f && r2(n(f.imp_total)) !== monto) frenos.push(`Penino FC ${nro}: importe distinto`)
  if (m) A2.push({ m, f, quien: `Penino FC ${nro}` })
}
for (const a of A2) if (a.m.comprobante_arca_id || a.m.template_cuota_id) frenos.push(`${a.quien}: el movimiento ya tiene vínculo`)
if (fcDiaz && r2(A2.filter(a => a.quien === "Díaz").reduce((t, a) => t + n(a.m.debitos), 0)) !== r2(n(fcDiaz.imp_total))) frenos.push("Díaz: los 2 pagos no suman la factura")

// ── B · cuenta corriente ─────────────────────────────────────────────────────────────────────────────────
const B: { m: any; marca: string; categ: string; quien: string }[] = []
for (const m of movs.filter((x: any) => x.cuit === CUIT.areco)) B.push({ m, marca: "CTA CENTRO ARECO SADA", categ: PINTURA, quien: "Centro Areco Sada" })
{ const m = uno(movDe(CUIT.esposito, "2025-11-19", 98144.6), "Esposito 19/11/25"); if (m) B.push({ m, marca: "CTA ESPOSITO", categ: PINTURA, quien: "Esposito (corralón)" }) }
for (const m of movs.filter((x: any) => x.cuit === CUIT.trabucco && n(x.debitos) > 0)) B.push({ m, marca: "CTA TRABUCCO", categ: "Consumos", quien: "Trabucco" })
for (const b of B) if (b.m.comprobante_arca_id || b.m.template_cuota_id) frenos.push(`${b.quien} ${b.m.fecha}: el movimiento ya tiene vínculo`)
const fcsAreco = fcs.filter((f: any) => f.cuit === CUIT.areco)
const pagosAreco = r2(B.filter(b => b.marca === "CTA CENTRO ARECO SADA").reduce((t, b) => t + n(b.m.debitos), 0))
const netoAreco = r2(fcsAreco.reduce((t: number, f: any) => t + n(f.imp_total), 0))
if (fcsAreco.some((f: any) => f.estado !== "pendiente")) frenos.push("Centro Areco Sada: algún comprobante ya no está pendiente")
const fc226 = uno(fcN(CUIT.penino, 226), "Penino FC 226")
if (fc226 && fc226.estado !== "pendiente") frenos.push(`Penino FC 226 está «${fc226.estado}»`)

// ── Cuentas ──────────────────────────────────────────────────────────────────────────────────────────────
const CUENTAS: [string, string[]][] = [
  [PINTURA, fcs.filter((f: any) => [CUIT.penino, CUIT.esposito, CUIT.areco].includes(f.cuit)).map((f: any) => f.id)],
  [AUTOS, fcs.filter((f: any) => f.cuit === CUIT.sola).map((f: any) => f.id)],
]

// ── Reporte ──────────────────────────────────────────────────────────────────────────────────────────────
const $ = (x: number) => `$ ${r2(x).toLocaleString("es-AR")}`
console.log(`A1 · a auditar con su factura, se confirman: ${ok.length} · ${$(ok.reduce((t, o) => t + n(o.m.debitos), 0))}`)
for (const o of ok) console.log(`   ${o.m.fecha} ${$(n(o.m.debitos))} ↔ ${o.quien} FC ${o.f.numero_desde}`)
console.log(`A2 · se atan a su factura: ${A2.length} · ${$(A2.reduce((t, a) => t + n(a.m.debitos), 0))}`)
for (const a of A2) console.log(`   ${a.m.fecha} ${$(n(a.m.debitos))} → ${a.quien} (${a.f?.fecha_emision}, ${$(n(a.f?.imp_total))})`)
console.log(`B · cuenta corriente: ${B.length} pagos · ${$(B.reduce((t, b) => t + n(b.m.debitos), 0))}`)
for (const b of B) console.log(`   ${b.m.fecha} ${$(n(b.m.debitos))} ${b.marca} · ${b.categ}`)
console.log(`   Centro Areco Sada: ${fcsAreco.length} comprobantes neto ${$(netoAreco)} − pagos ${$(pagosAreco)} = MA le debe ${$(netoAreco - pagosAreco)}`)
console.log(`   Penino FC 226 (${$(n(fc226?.imp_total))}) → pagada desde MSA por la cuenta corriente de MA`)
for (const [c, ids] of CUENTAS) console.log(`Cuenta «${c}» → ${ids.length} facturas`)

const idsMov = [...ok.map(o => o.m.id), ...A2.map(a => a.m.id), ...B.map(b => b.m.id)]
if (new Set(idsMov).size !== idsMov.length) frenos.push("un movimiento aparece en dos casos")
if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }

// ── Foto (movimientos, facturas y todo lo que lleva el vínculo con esas facturas) ───────────────────────
const idsFc = fcs.map((f: any) => f.id)
const prop: Record<string, any[]> = {}
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const { data } = await (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("*").in("comprobante_arca_id", idsFc)
  if (data?.length) prop[`${t.schema}.${t.tabla}`] = data
}
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "ma.ma_galicia": movs.filter((m: any) => idsMov.includes(m.id)).map(({ cuit, ...m }: any) => m),
  "ma.comprobantes_arca": fcs, propagacion: prop }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const nota = (m: any, txt: string) => [String(m.nota_operador || "").trim(), txt].filter(Boolean).join(" · ")
const avisos: string[] = []
for (const o of ok) {
  const { error } = await ma.from("ma_galicia").update({ estado: "conciliado", motivo_revision: null,
    nota_operador: nota(o.m, `OK ${HUELLA}: coincide con ${o.quien} FC ${o.f.numero_desde}${o.m.motivo_revision ? " · " + o.m.motivo_revision : ""}`) }).eq("id", o.m.id)
  if (error) throw error
  avisos.push(...(await conciliarOrigenDelMovimiento(sb as any, o.m)).avisos)
}
for (const a of A2) {
  const { error } = await ma.from("ma_galicia").update({ comprobante_arca_id: a.f.id, estado: "conciliado", motivo_revision: null,
    nota_operador: nota(a.m, `${HUELLA}: contra ${a.quien === "Díaz" ? `Díaz FC ${a.f.numero_desde} (2 pagos)` : a.quien}`) }).eq("id", a.m.id)
  if (error) throw error
  avisos.push(...(await conciliarOrigenDelMovimiento(sb as any, { ...a.m, comprobante_arca_id: a.f.id })).avisos)
}
for (const b of B) {
  const { error } = await ma.from("ma_galicia").update({ estado: "conciliado", categ: b.categ, contable: b.marca, motivo_revision: null, detalle: b.m.detalle || `Cuenta corriente ${b.quien}`,
    nota_operador: nota(b.m, `${HUELLA}: pago a cuenta corriente de ${b.quien} (la factura que llegue no suma el gasto otra vez)`) }).eq("id", b.m.id)
  if (error) throw error
}
for (const f of fcsAreco) {
  const { error } = await ma.from("comprobantes_arca").update({ estado: "conciliado",
    observaciones_pago: `${HUELLA}: por cuenta corriente (CTA CENTRO ARECO SADA). Al 03/11: ${fcsAreco.length} comprobantes neto ${$(netoAreco)} − pagos ${$(pagosAreco)} → MA le debe ${$(netoAreco - pagosAreco)}` }).eq("id", f.id)
  if (error) throw error
}
{ const { error } = await ma.from("comprobantes_arca").update({ estado: "pagado",
    observaciones_pago: `${HUELLA}: pagada desde MSA por la cuenta corriente de MA (JMS: «Penino se pagó desde MSA cta cte»)` }).eq("id", fc226.id); if (error) throw error }
const res: string[] = []
for (const [c, ids] of CUENTAS) { const r = await asignarCuentaAFacturas(sb as any, "MA", ids, { cuenta_contable: c }); res.push(`${c}: ${r.actualizados} facturas, ${r.propagacion.propagados} movimientos`) }
console.log(`\n✅ Escrito: ${ok.length} confirmados · ${A2.length} atados · ${B.length} a cuenta corriente · ${fcsAreco.length} comprobantes de Centro Areco Sada · FC 226 pagada por MSA\n   ${res.join("\n   ")}`)
if (avisos.length) console.log("⚠️ Avisos:\n - " + avisos.join("\n - "))
