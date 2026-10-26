/**
 * 🔍 CRUCE: «Mis Comprobantes Recibidos» de ARCA vs. lo que tiene la app de MSA (sólo lectura).
 *
 * Pedido del usuario 2026-10-25, al descubrir que DirecTV se facturó a MSA todo 2025 y la app lo tenía
 * desde diciembre: *«habrá que ver si hay más discrepancias. Te dejo el reporte de ARCA para control
 * de la campaña 25/26»*. Mira las dos tablas donde puede estar una factura: `comprobantes_arca` (las
 * del sistema) y `comprobantes_historico` (las de antes, cargadas por el contador).
 *
 * Uso: npx tsx scripts/cruce-arca-vs-app-msa.mts <archivo.csv de ARCA> [salida.json]
 */
import fs from "fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const [csvPath, salida] = process.argv.slice(2)
const num = (s: string) => Number(String(s ?? "").replace(/\./g, "").replace(",", ".")) || 0
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "")
const clave = (tipo: unknown, pv: unknown, nro: unknown, cuit: unknown) =>
  `${parseInt(dig(tipo)) || 0}-${parseInt(dig(pv)) || 0}-${parseInt(dig(nro)) || 0}-${dig(cuit)}`

const lineas = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean)
const cab = lineas[0].split(";").map(c => c.replace(/"/g, ""))
const arca = lineas.slice(1).map(l => {
  const v = l.split(";").map(c => c.replace(/"/g, ""))
  const r = Object.fromEntries(cab.map((c, i) => [c, v[i]]))
  return {
    clave: clave(r["Tipo de Comprobante"], r["Punto de Venta"], r["Número Desde"], r["Nro. Doc. Emisor"]),
    fecha: r["Fecha de Emisión"], tipo: r["Tipo de Comprobante"], emisor: r["Denominación Emisor"],
    cuit: r["Nro. Doc. Emisor"], total: num(r["Imp. Total"]), nro: `${r["Punto de Venta"]}-${r["Número Desde"]}`,
    // ⚠️ El reporte dice «montos en pesos», pero las facturas en dólares vienen EN DÓLARES con su TC.
    moneda: r["Moneda"], tc: num(r["Tipo Cambio"]) || 1,
    pesos: num(r["Imp. Total"]) * (r["Moneda"] === "$" ? 1 : (num(r["Tipo Cambio"]) || 1)),
  }
})

async function todo(q: () => any) {
  const out: any[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await q().range(desde, desde + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}
const app = await todo(() => sb.schema("msa").from("comprobantes_arca")
  .select("tipo_comprobante, punto_venta, numero_desde, cuit, imp_total, fecha_emision, estado, denominacion_emisor, moneda, tipo_cambio"))
const hist = await todo(() => sb.schema("msa").from("comprobantes_historico")
  .select("tipo, punto_de_venta, numero_desde, nro_doc_emisor, imp_total, fecha, denominacion_emisor"))

/** En pesos: la app guarda las facturas en USD en dólares + TC; el histórico, en pesos. */
const pesosApp = (f: any) => Number(f.imp_total) * (f.moneda && !["$", "PES", "ARS"].includes(f.moneda) ? Number(f.tipo_cambio) || 1 : 1)
const pesosDe = (f: any) => ("tipo_comprobante" in f ? pesosApp(f) : Number(f.imp_total))
const enApp = new Map(app.map(f => [clave(f.tipo_comprobante, f.punto_venta, f.numero_desde, f.cuit), f]))
const enHist = new Map(hist.map(f => [clave(f.tipo, f.punto_de_venta, f.numero_desde, f.nro_doc_emisor), f]))

// 2ª pasada: mismo punto de venta + número + importe, aunque el TIPO o el CUIT estén cargados distinto
// (ej. la cooperativa eléctrica: tipo 17 en ARCA, tipo 1 en la app).
const pvNro = (pv: unknown, nro: unknown) => `${parseInt(dig(pv)) || 0}-${parseInt(dig(nro)) || 0}`
const otrosApp = new Map<string, any[]>()
for (const f of app) { const k = pvNro(f.punto_venta, f.numero_desde); otrosApp.set(k, [...(otrosApp.get(k) ?? []), f]) }
const otrosHist = new Map<string, any[]>()
for (const f of hist) { const k = pvNro(f.punto_de_venta, f.numero_desde); otrosHist.set(k, [...(otrosHist.get(k) ?? []), f]) }
const usadosApp = new Set<any>()
const parecida = (a: typeof arca[number]) => {
  const [pv, nro] = a.nro.split("-")
  const k = pvNro(pv, nro)
  const fa = (otrosApp.get(k) ?? []).find(f => Math.abs(Math.abs(pesosDe(f)) - Math.abs(a.pesos)) <= 1)
  if (fa) { usadosApp.add(fa); return { donde: "app", f: fa } }
  const fh = (otrosHist.get(k) ?? []).find(f => Math.abs(Math.abs(pesosDe(f)) - Math.abs(a.pesos)) <= 1)
  return fh ? { donde: "histórico", f: fh } : null
}
const sinClave = arca.filter(a => !enApp.has(a.clave) && !enHist.has(a.clave))
const conOtroTipo = sinClave.map(a => ({ a, p: parecida(a) })).filter(x => x.p)
const faltan = sinClave.filter(a => !conOtroTipo.some(x => x.a === a))
const enLasDos = arca.filter(a => enApp.has(a.clave) && enHist.has(a.clave))
const difImporte = arca.flatMap(a => {
  const f = enApp.get(a.clave) ?? enHist.get(a.clave)
  if (!f) return []
  const t = pesosDe(f)
  return Math.abs(Math.abs(t) - Math.abs(a.pesos)) > 1 ? [{ ...a, app: t }] : []
})
// 💱 Las facturas en dólares: el TC de la app tiene que ser el de ARCA.
const tcDistinto = arca.filter(a => a.moneda !== "$").flatMap(a => {
  const f = enApp.get(a.clave)
  if (!f) return []
  return Math.abs((Number(f.tipo_cambio) || 1) - a.tc) > 0.005 || (f.moneda ?? "$") === "$" ? [{ ...a, appMoneda: f.moneda, appTc: Number(f.tipo_cambio) }] : []
})
const desde = arca.reduce((m, a) => a.fecha < m ? a.fecha : m, "9999"), hasta = arca.reduce((m, a) => a.fecha > m ? a.fecha : m, "")
const sobran = [...enApp.entries()].filter(([k, f]) => f.fecha_emision >= desde && f.fecha_emision <= hasta && !arca.some(a => a.clave === k) && !usadosApp.has(f))
  .map(([, f]) => f)

console.log(`ARCA ${arca.length} (${desde} → ${hasta}) · app ${app.length} · histórico ${hist.length}`)
console.log(`✓ en la app: ${arca.filter(a => enApp.has(a.clave)).length} · sólo en histórico: ${arca.filter(a => !enApp.has(a.clave) && enHist.has(a.clave)).length} · en las dos: ${enLasDos.length}`)
console.log(`≈ están, pero cargadas con otro TIPO o CUIT: ${conOtroTipo.length}`)
for (const { a, p } of conOtroTipo) console.log(`   ${a.fecha} · ${a.nro} · ${a.emisor} · ARCA tipo ${a.tipo} cuit ${a.cuit} · ${p!.donde}: tipo ${p!.f.tipo_comprobante ?? p!.f.tipo} cuit ${p!.f.cuit ?? p!.f.nro_doc_emisor}`)
console.log(`❌ en ARCA y en NINGUNA de las dos: ${faltan.length}`)
for (const f of faltan) console.log(`   ${f.fecha} · tipo ${f.tipo} · ${f.nro} · ${f.emisor} · $${f.total.toLocaleString("es-AR")}`)
console.log(`💱 facturas en USD: ${arca.filter(a => a.moneda !== "$").length} · con TC o moneda distinta en la app: ${tcDistinto.length}`)
console.log(`⚠️ importe distinto en pesos (> $1): ${difImporte.length}`)
for (const f of difImporte) console.log(`   ${f.fecha} · ${f.nro} · ${f.emisor} · ARCA $${f.pesos} vs app $${f.app}`)
console.log(`❓ en la app (en ese período) y NO en ARCA: ${sobran.length}`)
for (const f of sobran) console.log(`   ${f.fecha_emision} · tipo ${f.tipo_comprobante} · ${f.punto_venta}-${f.numero_desde} · ${f.denominacion_emisor} · $${f.imp_total} · ${f.estado}`)
const detalle = arca.map(a => {
  const fa = enApp.get(a.clave), fh = enHist.get(a.clave), otro = conOtroTipo.find(x => x.a === a)
  const donde = fa && fh ? "app y histórico" : fa ? "app" : fh ? "histórico" : otro ? `${otro.p!.donde} (otro tipo/CUIT)` : "NO ESTÁ"
  const f = fa ?? fh ?? otro?.p?.f
  return { ...a, donde, appEstado: fa?.estado ?? null, appPesos: f ? pesosDe(f) : null, appTipo: f ? (f.tipo_comprobante ?? f.tipo) : null }
})
if (salida) fs.writeFileSync(salida, JSON.stringify({ detalle, faltan, conOtroTipo: conOtroTipo.map(x => ({ ...x.a, donde: x.p!.donde, appTipo: x.p!.f.tipo_comprobante ?? x.p!.f.tipo, appCuit: x.p!.f.cuit ?? x.p!.f.nro_doc_emisor })), difImporte, tcDistinto, sobran, enLasDos, desde, hasta, totApp: app.length, totHist: hist.length }, null, 2))
