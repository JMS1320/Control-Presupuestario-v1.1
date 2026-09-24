/**
 * 🔬 `npm run ensayo:detalle` — la cuenta del **Detalle de pago** con los datos REALES de un pago
 * ya hecho, e imprime **lo que el proveedor va a leer**. Sólo LEE.
 *
 * ## Por qué existe
 * El Detalle de pago es el que más veces falló (`A-BUG-24`, `A-BUG-102/104/105`, `A-FEAT-93`) y el
 * único cuyo error **sale de la empresa**: lo lee el proveedor y concilia su cuenta corriente
 * contra él. Y **ninguna de esas correcciones se probó nunca con un caso que tuviera descuento Y
 * retención a la vez** — que es justo donde vive `A-BUG-24`.
 *
 * `npm run probar:mail` prueba la aritmética con números escritos a mano (caso IGLESIAS). Esto
 * prueba **el cableado**: que los campos que la cuenta necesita estén realmente cargados en la
 * base, y que los medios de pago se reúnan bien. Es la diferencia que encontró `A-BUG-134`.
 *
 * ## 🛑 No escribe NADA
 * En particular **no encola el mail**: apretar «📄 Detalle de pago» en la app inserta en
 * `public.mails_pago` y el GAS crea un borrador en Gmail. Eso es una escritura y además sale para
 * afuera → § 🛑 Datos. Acá se calcula lo mismo y se imprime.
 *
 * ## Cómo se elige el caso
 * Por **id de factura**, nunca "las últimas que haya" (§ 🛑 Datos: un test que apunta a *"la
 * primera que aparezca"* termina tocando otra cosa). Por defecto, el pago de ALCORTA del 10/09.
 */
import fs from "node:fs"
const R = "D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1"
const env = Object.fromEntries(fs.readFileSync(`${R}/.env.local`, "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]))

const api = async (path: string, schema?: string) => {
  const h: Record<string, string> = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  }
  if (schema) h["Accept-Profile"] = schema
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, { headers: h })
  if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`)
  return r.json() as Promise<any[]>
}

// La cuenta REAL, la misma que arma el mail. Sin BD adentro: por eso se puede importar acá.
const C: any = await import(`file:///${R}/lib/pagos/cuenta-detalle-pago.ts`)

// ── El caso: ALCORTA, pago del 10/09/2026 (3 FC agrupadas, con descuento 5 % y SICORE) ──────────
const CASO = {
  nombre: "ALCORTA EDMUNDO ERNESTO — pago del 10/09/2026",
  schema: "msa",
  facturaIds: [
    "47922151-c433-4382-9dda-168adf89a3a9", // FC 10-6337
    "9910217a-9824-4887-a519-b7e6063cd344", // FC 10-6328
    "34d80b5c-644e-4547-8989-f8d7301f8912", // FC 10-6347
  ],
}
const enLista = (ids: string[]) => `(${ids.map(i => `"${i}"`).join(",")})`

console.log(`\n🔬 ENSAYO — Detalle de pago\n${CASO.nombre}\n${"─".repeat(72)}\n`)

const fcs = await api(
  `comprobantes_arca?select=id,punto_venta,numero_desde,imp_total,monto_sicore,descuento_aplicado,monto_a_abonar,fecha_pago,grupo_pago_id&id=in.${enLista(CASO.facturaIds)}`,
  CASO.schema)
if (fcs.length !== CASO.facturaIds.length) {
  console.log(`🔴 Se pidieron ${CASO.facturaIds.length} facturas y volvieron ${fcs.length}. Abortado.`)
  process.exit(1)
}

// ── Los MEDIOS, espejo de `obtenerMediosPagoFactura` ────────────────────────────────────────────
const cubierto = new Map<string, number>()
const sumar = (id: string, n: number) => cubierto.set(id, (cubierto.get(id) ?? 0) + n)
const medios: any[] = []

const ants = await api(`anticipos_proveedores?select=id,monto,fecha_pago,metodo_pago,estado_pago,factura_id&factura_id=in.${enLista(CASO.facturaIds)}`)
const idsAnt = ants.map(a => a.id).filter(Boolean)
const chqAnt = idsAnt.length
  ? await api(`cheques?select=monto,banco,numero,fecha_emision,anticipo_id&anticipo_id=in.${enLista(idsAnt)}`, CASO.schema) : []
for (const a of ants) {
  const chq = chqAnt.find(c => c.anticipo_id === a.id)
  if (chq) medios.push({ tipo: "echeq", monto: chq.monto ?? a.monto ?? 0, detalle: `ECHEQ ${chq.banco ?? ""} ${chq.numero ?? ""}`.trim() })
  else if (a.metodo_pago === "echeq" || a.estado_pago === "echeq") medios.push({ tipo: "echeq", monto: a.monto ?? 0, detalle: "ECHEQ" })
  else medios.push({ tipo: "anticipo", monto: a.monto ?? 0, detalle: "Transferencia" })
}

const chsFc = await api(`cheques?select=monto,banco,numero,fecha_emision,factura_id&factura_id=in.${enLista(CASO.facturaIds)}`, CASO.schema)
for (const c of chsFc) {
  sumar(c.factura_id, c.monto ?? 0)
  medios.push({ tipo: "echeq", monto: c.monto ?? 0, detalle: `ECHEQ ${c.banco ?? ""} ${c.numero ?? ""}`.trim() })
}

const exts = await api(`msa_galicia?select=debitos,fecha,detalle,template_cuota_id&template_cuota_id=in.${enLista(CASO.facturaIds)}`)
for (const e of exts) {
  if ((e.debitos ?? 0) > 0) {
    sumar(e.template_cuota_id, e.debitos)
    medios.push({ tipo: "transferencia", monto: e.debitos, detalle: e.detalle || "Transferencia" })
  }
}

// 🔑 El resto lo agrupa **la función de verdad** (`restosComoMedios`), no una copia de acá.
// La primera versión de este ensayo la duplicaba, y por eso **siguió mostrando tres renglones
// después de arreglar A-BUG-145**: un ensayo que reimplementa lo que prueba deja de probarlo.
medios.push(...C.restosComoMedios(fcs, cubierto))

// ── La cuenta, con la función de verdad ─────────────────────────────────────────────────────────
const items = fcs.map(f => ({
  comprobante: `FC ${String(f.punto_venta).padStart(5, "0")}-${String(f.numero_desde).padStart(8, "0")}`,
  imp_total: Number(f.imp_total),
  monto_sicore: f.monto_sicore === null ? null : Number(f.monto_sicore),
  descuento_aplicado: f.descuento_aplicado === null ? null : Number(f.descuento_aplicado),
  monto_a_abonar: Number(f.monto_a_abonar),
  origen: "ARCA",
}))
const cuenta = C.calcularCuenta(items, medios, "arca")

console.log("Las facturas del pago:")
for (const i of items) {
  console.log(`  ${i.comprobante}  total ${C.money(i.imp_total).padStart(14)}` +
    `  sicore ${C.money(i.monto_sicore ?? 0).padStart(11)}` +
    `  desc ${C.money(i.descuento_aplicado ?? 0).padStart(12)}` +
    `  → abona ${C.money(i.monto_a_abonar).padStart(14)}`)
}
console.log(`\nMedios de pago reunidos: ${medios.length}`)
for (const m of medios) console.log(`  ${String(m.tipo).padEnd(14)} ${C.money(m.monto).padStart(14)}  ${m.detalle ?? ""}`)

console.log(`\n${"─".repeat(72)}\n📄 LO QUE VA A LEER EL PROVEEDOR:\n${C.armarDesglose(cuenta, medios)}\n`)

// ── El control (§ 🧮 el camino inverso) ─────────────────────────────────────────────────────────
console.log("─".repeat(72))
console.log("🧮 CONTROL 1 — suma(medios) + retención + descuento = importe facturas\n")
console.log(`  medios        ${C.money(cuenta.sumaMedios).padStart(16)}`)
console.log(`  retención     ${C.money(cuenta.retencion).padStart(16)}`)
console.log(`  descuento     ${C.money(cuenta.descuento).padStart(16)}`)
console.log(`                ${"".padStart(16, "─")}`)
console.log(`  cancelado     ${C.money(cuenta.totalCancelado).padStart(16)}`)
console.log(`  facturas      ${C.money(cuenta.bruto).padStart(16)}`)
console.log(`  diferencia    ${C.money(cuenta.dif).padStart(16)}`)

const ok = Math.abs(cuenta.dif) <= 1
console.log(`\n${ok ? "✅ CIERRA" : "🔴 NO CIERRA"}${cuenta.desviado ? " — y la app lo marcaría como desvío" : ""}`)

// Segundo control, independiente: que cada factura cierre por su cuenta.
console.log("\n🧮 CONTROL 2 — factura por factura: total − sicore − descuento = monto a abonar\n")
let malas = 0
for (const i of items) {
  const d = i.imp_total - (i.monto_sicore ?? 0) - (i.descuento_aplicado ?? 0) - i.monto_a_abonar
  if (Math.abs(d) > 0.01) malas++
  console.log(`  ${i.comprobante}  ${Math.abs(d) <= 0.01 ? "✅" : `🔴 desvía ${C.money(d)}`}`)
}
console.log(`\n${malas === 0 ? `✅ las ${items.length} cierran` : `🔴 ${malas} no cierran`}\n`)
process.exit(ok && malas === 0 ? 0 : 1)
