// Sólo LECTURA: el stock en el presupuesto con los datos reales (A-FEAT-1663 stock paso 3). Arma la ración como la grilla
// (lote → tramo → curva de peso, plan del año de la ración, retenidas al pie) y netea el stock. No escribe nada.
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { tramosParaCosto } from "../lib/productivo/tramos"
import { consumoMensual } from "../lib/productivo/actividades"
import { calcularLineaTiempo } from "../lib/ganaderia/ciclo"
import { esModoRacion, campanaDeMes, aplicarPlanRacion, aplicarPlanLote } from "../lib/presupuesto/costo-campana"
import { stockAlInicio, netearStock } from "../lib/presupuesto/stock-presupuesto"
const mesArgentina = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7)   // hora argentina
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const P = sb.schema("productivo")
const [{ data: lotes }, { data: tra }, { data: acts }, { data: ins }, { data: tc }, { data: ciclos }, { data: planRaw }] = await Promise.all([
  P.from("stock_lotes").select("*").eq("empresa", "MSA"), P.from("lote_tramos").select("*").order("orden"), P.from("actividades").select("*"),
  P.from("actividad_insumos").select("*").order("orden"), sb.from("tipos_cambio").select("anio, mes, tc_presupuestado"), P.from("stock_ciclos").select("*"),
  sb.from("presupuesto_variables").select("*").eq("empresa", "MSA").eq("activo", true),
])
const listaActs = (acts || []).filter((a: any) => a.activo !== false)
const { data: fuera } = await sb.from("presupuesto_marcas").select("fila_id").eq("empresa", "MSA").eq("origen_tabla", "actividad_insumos").eq("marca", "fuera")
const idsFuera = new Set((fuera || []).map((r: any) => String(r.fila_id)))
const deRacion = (ins || []).filter((i: any) => listaActs.some((a: any) => a.id === i.actividad_id) && !idsFuera.has(String(i.id)) && esModoRacion(i.modo))
const tcs = (tc || []).map((r: any) => ({ anio: Number(r.anio), mes: Number(r.mes), valor: Number(r.tc_presupuestado) || 0 }))
const idsRac = new Set(deRacion.map((i: any) => String(i.id)))
const dietaPlan: Record<string, string> = {}
for (const p of planRaw || []) if (p.actividad_id && p.dieta && !p.lote_id) dietaPlan[`${p.actividad_id}|${p.campana}`] = p.dieta
const planLote = (planRaw || []).filter((p: any) => p.lote_id && p.receta_insumo_id).map((p: any) => ({ lote_id: String(p.lote_id), receta_insumo_id: String(p.receta_insumo_id), campana: String(p.campana), cantidad: p.cantidad == null ? null : Number(p.cantidad), precio: p.precio == null ? null : Number(p.precio), moneda: p.moneda ?? null, iva_pct: p.iva_pct == null ? null : Number(p.iva_pct), fecha_desde: p.fecha_desde ?? null, fecha_hasta: p.fecha_hasta ?? null }))
const planRacion = (planRaw || []).filter((p: any) => !p.lote_id).filter((p: any) => p.racion_pct_pv != null || (p.receta_insumo_id && idsRac.has(String(p.receta_insumo_id))))
  .map((p: any) => ({ id: String(p.id), actividad_id: p.actividad_id, receta_insumo_id: p.receta_insumo_id, campana: String(p.campana), racion_pct_pv: p.racion_pct_pv == null ? null : Number(p.racion_pct_pv),
    cantidad: p.cantidad == null ? null : Number(p.cantidad), precio: p.precio == null ? null : Number(p.precio), moneda: p.moneda ?? null, iva_pct: p.iva_pct == null ? null : Number(p.iva_pct) }))
const retenidasDe = new Map(calcularLineaTiempo(ciclos || []).map((c: any) => [String(c.ciclo.id), Number(c.retenidas) || 0]))
const aportes: any[] = []
for (const l of lotes || []) {
  const mios = (tra || []).filter((t: any) => t.lote_id === l.id)
  if (!mios.length) continue
  const extra = /ternera.*al pie/i.test(String(l.categoria)) && l.ciclo_id ? (retenidasDe.get(String(l.ciclo_id)) || 0) : 0
  for (const tA of tramosParaCosto(l, mios, listaActs, deRacion)) {
    const t0 = extra && tA.hasta <= String(l.fecha_disponible) ? { ...tA, cabezas: tA.cabezas + extra } : tA
    const campT = campanaDeMes(t0.desde.slice(0, 7))
    const pr = aplicarPlanRacion(t0.actividad as any, t0.insumos as any[], campT, planRacion as any)
    const t = { ...t0, actividad: pr.actividad as any, insumos: aplicarPlanLote(pr.insumos as any[], l.id, campT, planLote as any).insumos as any[], dieta: dietaPlan[`${t0.actividad.id}|${campT}`] ?? null }
    for (const m of consumoMensual({ ...t, tiposCambio: tcs } as any)) for (const it of m.items) {
      const d: any = deRacion.find((x: any) => x.actividad_id === t.actividad.id && x.concepto === it.concepto)
      if (d?.insumo_stock_id && it.cantidad > 0) aportes.push({ clave: `${t.actividad.nombre}|${l.categoria}|${it.concepto}`, insumoStockId: String(d.insumo_stock_id), mes: m.mes, kg: it.cantidad, costo: it.costo * (1 + (Number(d.iva_pct) || 0) / 100) })
    }
  }
}
const hoy = mesArgentina()
const ids = [...new Set(aportes.map(a => a.insumoStockId))]
const [{ data: stk }, { data: meds }, { data: ents }] = await Promise.all([
  P.from("stock_insumos").select("id, producto, unidad_medida").in("id", ids),
  P.from("mediciones_insumo").select("insumo_stock_id, fecha, cantidad").in("insumo_stock_id", ids).order("fecha", { ascending: false }),
  P.from("movimientos_insumos").select("insumo_stock_id, fecha, cantidad").eq("tipo", "compra").in("insumo_stock_id", ids),
])
const inicial: Record<string, number | null> = {}
for (const s of stk || []) {
  const kgPorMes: Record<string, number> = {}
  for (const a of aportes.filter(a => a.insumoStockId === s.id)) kgPorMes[a.mes] = (kgPorMes[a.mes] || 0) + a.kg
  const med = (meds || []).find((m: any) => m.insumo_stock_id === s.id)
  const al = stockAlInicio({ id: s.id, producto: s.producto, unidad: s.unidad_medida, medicion: med ? { fecha: med.fecha, cantidad: Number(med.cantidad) } : null,
    entradas: (ents || []).filter((e: any) => e.insumo_stock_id === s.id).map((e: any) => ({ fecha: e.fecha, cantidad: Number(e.cantidad) })) }, kgPorMes, hoy)
  inicial[s.id] = al.kg
  console.log(al.explicacion, al.aviso ? `⚠ ${al.aviso}` : "")
  console.log("   kg por mes:", Object.entries(kgPorMes).filter(([m]) => m >= "2026-08").sort().map(([m, k]) => `${m} ${Math.round(k)}`).join(" · "))
}
const n = netearStock(aportes, inicial, hoy)
for (const s of stk || []) {
  const r = n.porInsumo[s.id]; if (!r) continue
  const desc = [...n.cubierto.entries()].filter(([k]) => aportes.find(a => `${a.clave}|${a.mes}` === k)?.insumoStockId === s.id).reduce((t, [, c]) => t + c.costo, 0)
  console.log(`${s.producto}: arranca ${Math.round(r.inicial)} · alcanza hasta ${r.ultimoMesCubierto ?? "—"} · compra desde ${r.primerMesCompra ?? "—"} (${Math.round(r.kgComprar)} kg) · descuenta $ ${Math.round(desc).toLocaleString("es-AR")}`)
}
