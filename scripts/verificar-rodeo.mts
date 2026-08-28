/**
 * Arma la línea de tiempo del rodeo de recría DESDE LA BASE y verifica que cierre.
 *
 * No usa datos inventados: lee el ciclo, los lotes, las ventas y las mortandades reales, y
 * muestra el kilo-día de cada grupo con su control de cabezas. Es el paso previo a enchufar el
 * reparto del consumo (A-FEAT-43).
 *
 *     npx tsx scripts/verificar-rodeo.mts
 */

import { createClient } from "@supabase/supabase-js"
import { gruposDelRodeo, armarGruposRodeo, type BajaRodeo } from "../lib/productivo/rodeo"
import { curvaDeLote, type TramoLote, type LoteCurva } from "../lib/productivo/tramos"
import type { Actividad } from "../lib/productivo/actividades"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const sb = createClient(url, key)

const n = (x: number) => x.toLocaleString("es-AR", { maximumFractionDigits: 1 })
const dmy = (f: string) => f.split("-").reverse().join("/")

const p = sb.schema("productivo")
const [{ data: ciclos }, { data: lotes }, { data: ventas }, { data: tramos }, { data: acts }, { data: movs }, { data: cats }] =
  await Promise.all([
    p.from("ciclos_recria").select("*").eq("activo", true),
    p.from("stock_lotes").select("*"),
    p.from("stock_ventas").select("*"),
    p.from("lote_tramos").select("*").order("orden"),
    p.from("actividades").select("*").eq("activo", true),
    p.from("movimientos_hacienda").select("fecha, tipo, cantidad, categoria_id"),
    p.from("categorias_hacienda").select("id, nombre"),
  ])

const ciclo = (ciclos || [])[0] as any
if (!ciclo) { console.log("No hay ciclo de recría activo."); process.exit(1) }

const APERTURA = Number(ciclo.cabezas_machos ?? 0) + Number(ciclo.cabezas_hembras ?? 0)
const DESDE = String(ciclo.fecha_inicio)
const HASTA = new Date().toISOString().slice(0, 10)

const nombreCat = new Map(((cats || []) as any[]).map(c => [c.id, String(c.nombre)]))
const listaTramos = (tramos || []) as TramoLote[]
const listaActs = (acts || []) as unknown as Actividad[]

// ── Los grupos: los lotes de recría ──────────────────────────────────────────
// ⚠️ Los TORITOS también comen del mismo silo. El usuario lo dijo desde el principio:
// *"comen todos los machos incluidos los 9 toritos y todas las hembras incluidas las de
// reposición"*. Sin ellos acá, su ración se la reparten los demás y les infla el costo.
const esRecria = (cat: string) => /recria|torito/i.test(cat)
const misLotes = ((lotes || []) as any[]).filter(l => esRecria(String(l.categoria)))

const filasLote = misLotes.map(l => {
  const curva = curvaDeLote(l as unknown as LoteCurva, listaTramos.filter(t => t.lote_id === l.id), listaActs)
  // Se fue cuando se vendió DE VERDAD; si no hay venta, cuando dice que se va a vender.
  const real = ((ventas || []) as any[]).find(v => v.lote_id === l.id)
  return {
    id: String(l.id),
    nombre: `${l.categoria} (${Number(l.cantidad)} cab)${real ? " — vendido" : l.destino_actividad_id ? " — traspaso" : ""}`,
    cabezas: Number(l.cantidad) || 0,
    fechaSalidaReal: real ? String(real.fecha_venta) : null,
    fechaSalidaEstimada: l.fecha_venta_estimada ? String(l.fecha_venta_estimada) : null,
    peso: (f: string) => curva(f),
  }
})

// ── Las bajas: las mortandades de categorías de recría ───────────────────────
const bajas: BajaRodeo[] = ((movs || []) as any[])
  .filter(m => m.tipo === "mortandad" && esRecria(nombreCat.get(m.categoria_id) ?? "") && String(m.fecha) >= DESDE)
  .map(m => ({ fecha: String(m.fecha), cabezas: Number(m.cantidad) || 0, motivo: nombreCat.get(m.categoria_id) }))

// El armado —incluido el "resto sin lote"— sale del MISMO lib que usa la pantalla.
const { grupos, conciliacion } = armarGruposRodeo({ ciclo, lotes: filasLote, bajas })

// ── Salida ───────────────────────────────────────────────────────────────────
console.log(`\n=== CICLO DE RECRÍA ${ciclo.campania} ===`)
console.log(`  abre ${dmy(DESDE)} · declara ${APERTURA} cabezas`
  + ` (${ciclo.cabezas_machos} machos + ${ciclo.cabezas_hembras} hembras)`)

console.log(`\n=== GRUPOS ===`)
for (const g of grupos) {
  console.log(`  ${g.nombre.padEnd(46)} ${String(Math.round(g.cabezas)).padStart(5)} cab`
    + `  ${dmy(g.desde)} → ${g.hasta ? dmy(g.hasta) : "sigue"}`)
}

console.log(`\n=== MORTANDADES (${bajas.length}) ===`)
for (const b of bajas) console.log(`  ${dmy(b.fecha)}  ${b.cabezas} cab  ${b.motivo ?? ""}`)
if (bajas.length === 0) console.log("  (ninguna en el período)")

const c = conciliacion
console.log(`\n=== CONTROL DE CABEZAS ===`)
console.log(`  ${c.cierra ? "✓" : "✗"} el ciclo declara ${c.declarada} y los grupos suman ${n(c.enGrupos)}`
  + (c.cierra ? "" : `  → faltan ${n(c.diferencia)}`))
console.log(`      bajas registradas: ${c.bajas}`)

const kd = gruposDelRodeo(grupos, bajas)(DESDE, HASTA)
const total = kd.reduce((s, g) => s + g.kiloDia, 0)
console.log(`\n=== KILO-DÍA ${dmy(DESDE)} → ${dmy(HASTA)} ===`)
for (const g of kd.sort((a, b) => b.kiloDia - a.kiloDia)) {
  console.log(`  ${g.nombre.padEnd(46)} ${(g.kiloDia / 1e6).toFixed(2).padStart(8)} M`
    + `  ${((g.kiloDia / total) * 100).toFixed(1).padStart(6)} %`)
}
console.log(`  ${"TOTAL".padEnd(46)} ${(total / 1e6).toFixed(2).padStart(8)} M   100,0 %`)

const suma = kd.reduce((s, g) => s + g.kiloDia / total, 0)
console.log(`\n  participaciones suman ${suma.toFixed(6)} ${Math.abs(suma - 1) < 1e-9 ? "✓" : "✗"}`)
console.log(c.cierra ? "\n✅ El rodeo concilia.\n" : "\n⚠️  El rodeo NO concilia — ver arriba.\n")
