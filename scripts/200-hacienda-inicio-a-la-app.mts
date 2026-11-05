/**
 * 🐄 **Script 200 — A-DAT-98: la hacienda del stock inicial (30/06/25) al recuento con que arranca la app (29/01/26).**
 *
 * JMS 04/11: *«te paso los movimientos de hacienda para que lleguen a nuestros registros… con los nacimientos a cargar debería
 * dar ok con el stock de ajuste con que arranca la app»* · *«son 6 muertes registradas por mí»* · *«nacimientos ponelos en
 * julio todo»* · *«dale, hacé el 1 y el 2»*.
 *
 * Carga (marcados `[script 200]` en `observaciones`):
 *   · existencia inicial al 30/06/25 (321) como `ajuste_stock` — la pantalla de Hacienda lo toma como apertura
 *   · 190 nacimientos (31/07/25) · cambios de categoría · 6 mortandades · las ventas de enero (Sáenz Valiente, Genta)
 * Y deja en 0 los 6 ajustes del recuento del 15/02/26 (422): el recuento coincide con lo calculado. El stock de hoy no cambia.
 *
 * Control (frena si no da): cada categoría al 29/01/26 = el recuento; el stock de hoy igual antes y después.
 * Deshacer: borra SÓLO las filas con `[script 200]` y vuelve los 6 ajustes a su cantidad (por id, verificado).
 *
 *   npx tsx scripts/200-hacienda-inicio-a-la-app.mts             # muestra lo que haría y el control
 *   npx tsx scripts/200-hacienda-inicio-a-la-app.mts --aplicar
 *   npx tsx scripts/200-hacienda-inicio-a-la-app.mts --deshacer
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const prod = () => sb.schema("productivo")
const MARCA = "[script 200]"
const aplicar = process.argv.includes("--aplicar"), deshacer = process.argv.includes("--deshacer")

/** Los 6 ajustes del recuento de Coria (15/02/26) con su cantidad original. */
const RECUENTO: Record<string, { cat: string; cant: number }> = {
  "192336d0-2e91-4c48-8fea-59c5b75b841d": { cat: "Torito", cant: 8 },
  "a1d73647-f3be-4f8c-8acd-86ef071591f6": { cat: "Ternera al Pie", cant: 88 },
  "d49fc31b-f083-4c24-ac51-3666eb29ec88": { cat: "Vaquillona Preñada", cant: 28 },
  "c8cf221b-7e1a-4aa7-a351-4689b0d248bc": { cat: "Ternero al Pie", cant: 102 },
  "1eb23069-0f5e-4b49-9d85-8dd87814f8cd": { cat: "Vaca", cant: 188 },
  "fc5a58f3-fd21-40e0-882d-7886ff0ef20d": { cat: "Toro", cant: 8 },
}
const SAENZ = { nombre: "SAENZ VALIENTE BULLRICH Y CIA SA", cuit: "30576703119" }
const GENTA = { nombre: "PEDRO GENTA Y COMPAÑIA SOCIEDAD ANONIMA", cuit: "30526554562" }
type Fila = { fecha: string; tipo: string; cat: string; cantidad: number; cliente?: { nombre: string; cuit: string }; obs: string }
const ref = " (fecha de referencia)"
const FILAS: Fila[] = [
  ...([["Vaca", 150], ["Vaca CUT/Descarte", 2], ["Vaquillona Preñada", 50], ["Vaquillona de Reposicion", 28], ["Toro", 11], ["Torito", 9], ["Ternero Recria", 71]] as const)
    .map(([cat, n]) => ({ fecha: "2025-06-30", tipo: "ajuste_stock", cat, cantidad: n, obs: "Existencia inicial al 30/06/25 — papeles de trabajo de JMS" })),
  { fecha: "2025-07-31", tipo: "nacimiento", cat: "Ternero al Pie", cantidad: 102, obs: "Nacimientos de la temporada (JMS: todos en julio)" },
  { fecha: "2025-07-31", tipo: "nacimiento", cat: "Ternera al Pie", cantidad: 88, obs: "Nacimientos de la temporada (JMS: todos en julio)" },
  { fecha: "2025-07-31", tipo: "cambio_categoria", cat: "Vaquillona Preñada", cantidad: -45, obs: "Vaquillonas de 1ª parición que parieron → Vaca" },
  { fecha: "2025-07-31", tipo: "cambio_categoria", cat: "Vaca", cantidad: 45, obs: "← Vaquillona Preñada (1ª parición, parieron)" },
  { fecha: "2025-12-31", tipo: "cambio_categoria", cat: "Vaquillona de Reposicion", cantidad: -28, obs: "Reposición preñada → Vaquillona Preñada" + ref },
  { fecha: "2025-12-31", tipo: "cambio_categoria", cat: "Vaquillona Preñada", cantidad: 28, obs: "← Vaquillona de Reposición" + ref },
  // venta y mortandad: en POSITIVO, como las carga la app (el tipo dice que salen)
  { fecha: "2025-12-31", tipo: "mortandad", cat: "Vaca", cantidad: 3, obs: "Muertes registradas por JMS" + ref },
  { fecha: "2025-12-31", tipo: "mortandad", cat: "Toro", cantidad: 1, obs: "Muerte registrada por JMS" + ref },
  { fecha: "2025-12-31", tipo: "mortandad", cat: "Torito", cantidad: 1, obs: "Muerte registrada por JMS" + ref },
  { fecha: "2025-12-31", tipo: "mortandad", cat: "Ternero Recria", cantidad: 1, obs: "Muerte registrada por JMS — novillito" + ref },
  { fecha: "2026-01-26", tipo: "cambio_categoria", cat: "Vaca", cantidad: -4, obs: "Pasan a CUT antes de la venta (se vendieron 6 CUT y había 2)" },
  { fecha: "2026-01-26", tipo: "cambio_categoria", cat: "Vaca CUT/Descarte", cantidad: 4, obs: "← Vaca" },
  { fecha: "2026-01-27", tipo: "venta", cat: "Vaca CUT/Descarte", cantidad: 6, cliente: SAENZ, obs: "Liquidación 209-32006 (FRIMSA 4, VERDE Y NEGRO 2)" },
  { fecha: "2026-01-27", tipo: "venta", cat: "Toro", cantidad: 2, cliente: SAENZ, obs: "Liquidación 209-32006 (RUNFO)" },
  { fecha: "2026-01-27", tipo: "venta", cat: "Vaquillona Preñada", cantidad: 5, cliente: SAENZ, obs: "Liquidación 209-32007 (SANTA GIULIA) — vaquillonas de 1ª parición" },
  { fecha: "2026-01-28", tipo: "venta", cat: "Ternero Recria", cantidad: 70, cliente: GENTA, obs: "Liquidación 11-75880 — 28.000 kg" },
]
const conSigno = (tipo: string, c: number) => (tipo === "venta" || tipo === "mortandad") ? -Math.abs(c) : (tipo === "compra" || tipo === "nacimiento") ? Math.abs(c) : c

const { data: cats, error: eC } = await prod().from("categorias_hacienda").select("id, nombre")
if (eC) throw new Error(eC.message)
const idDe = new Map((cats ?? []).map(c => [c.nombre as string, c.id as string]))
const nombreDe = new Map((cats ?? []).map(c => [c.id as string, c.nombre as string]))
for (const f of FILAS) if (!idDe.has(f.cat)) throw new Error(`No existe la categoría «${f.cat}»`)

async function todos() {
  const { data, error } = await prod().from("movimientos_hacienda").select("id, fecha, tipo, cantidad, categoria_id, observaciones")
  if (error) throw new Error(error.message)
  return data ?? []
}
const stock = (movs: Awaited<ReturnType<typeof todos>>, hasta?: string) => {
  const r: Record<string, number> = {}
  for (const m of movs) {
    if (hasta && String(m.fecha) > hasta) continue
    const n = nombreDe.get(m.categoria_id as string) ?? "?"
    r[n] = (r[n] ?? 0) + conSigno(String(m.tipo), Number(m.cantidad))
  }
  return Object.fromEntries(Object.entries(r).filter(([, v]) => v !== 0).sort())
}
const igual = (a: Record<string, number>, b: Record<string, number>) => JSON.stringify(a) === JSON.stringify(b)

const antes = await todos()
const hoyAntes = stock(antes)
const yaCargadas = antes.filter(m => String(m.observaciones ?? "").includes(MARCA))

if (deshacer) {
  console.log(`Deshacer: ${yaCargadas.length} fila(s) con ${MARCA} a borrar y 6 ajustes a restaurar.`)
  const { error: eD } = await prod().from("movimientos_hacienda").delete().in("id", yaCargadas.map(m => m.id))
  if (eD) throw new Error(eD.message)
  for (const [id, r] of Object.entries(RECUENTO)) {
    const m = antes.find(x => x.id === id)
    if (!m) throw new Error(`No está el ajuste ${id}`)
    const obs = String(m.observaciones ?? "").replace(/ · \[script 200\].*$/, "")
    const { error } = await prod().from("movimientos_hacienda").update({ cantidad: r.cant, observaciones: obs }).eq("id", id)
    if (error) throw new Error(error.message)
  }
  const hoyDespues = stock(await todos())
  console.log(igual(hoyAntes, hoyDespues) ? "✓ el stock de hoy no cambió" : "⚠️ el stock de hoy cambió")
  process.exit(0)
}

// ── frenos antes de tocar nada ──
if (yaCargadas.length) throw new Error(`Ya hay ${yaCargadas.length} fila(s) con ${MARCA}: ¿ya se corrió?`)
for (const [id, r] of Object.entries(RECUENTO)) {
  const m = antes.find(x => x.id === id)
  if (!m || Number(m.cantidad) !== r.cant || nombreDe.get(m.categoria_id as string) !== r.cat || m.tipo !== "ajuste_stock")
    throw new Error(`El ajuste ${id} no es el esperado (${r.cat} ${r.cant}): no se toca nada.`)
}
if (antes.some(m => String(m.fecha) < "2026-02-15")) throw new Error("Ya hay movimientos anteriores al 15/02/26: no se toca nada.")

// ── simulación: lo que quedaría ──
const simulado = [
  ...antes.map(m => (RECUENTO[m.id as string] ? { ...m, cantidad: 0 } : m)),
  ...FILAS.map((f, i) => ({ id: `nuevo-${i}`, fecha: f.fecha, tipo: f.tipo, cantidad: f.cantidad, categoria_id: idDe.get(f.cat)!, observaciones: MARCA })),
]
const alRecuento = stock(simulado, "2026-01-29")
const esperado = Object.fromEntries(Object.values(RECUENTO).map(r => [r.cat, r.cant]).sort())
const hoySimulado = stock(simulado)
console.log("Al 29/01/26 con la carga:", alRecuento)
console.log("Recuento de Coria:        ", esperado)
console.log("Stock de hoy antes:  ", hoyAntes)
console.log("Stock de hoy después:", hoySimulado)
console.log("Al 30/06/25 (inicio):", stock(simulado, "2025-06-30"))
if (!igual(alRecuento, esperado)) throw new Error("🛑 La carga no da el recuento: no se toca nada.")
if (!igual(hoyAntes, hoySimulado)) throw new Error("🛑 El stock de hoy cambiaría: no se toca nada.")
console.log(`✓ Control: ${FILAS.length} filas nuevas; al 29/01/26 da el recuento y el stock de hoy no cambia.`)
if (!aplicar) { console.log("(simulación — para cargar: --aplicar)"); process.exit(0) }

// ── aplicar ──
const { error: eI } = await prod().from("movimientos_hacienda").insert(FILAS.map(f => ({
  fecha: f.fecha, tipo: f.tipo, categoria_id: idDe.get(f.cat), cantidad: f.cantidad,
  proveedor_cliente: f.cliente?.nombre ?? null, cuit: f.cliente?.cuit ?? null,
  observaciones: `${f.obs} · ${MARCA} A-DAT-98`,
})))
if (eI) throw new Error(eI.message)
for (const [id, r] of Object.entries(RECUENTO)) {
  const m = antes.find(x => x.id === id)!
  const { error } = await prod().from("movimientos_hacienda").update({
    cantidad: 0, observaciones: `${m.observaciones ?? ""} · ${MARCA} el recuento coincide con lo calculado desde el 30/06/25 (era ${r.cant})`,
  }).eq("id", id)
  if (error) throw new Error(error.message)
}
const despues = await todos()
console.log(igual(stock(despues, "2026-01-29"), esperado) && igual(stock(despues), hoyAntes)
  ? "✅ Cargado: al 29/01/26 da el recuento y el stock de hoy no cambió." : "⚠️ Cargado, pero el control no da: correr --deshacer y avisar.")
