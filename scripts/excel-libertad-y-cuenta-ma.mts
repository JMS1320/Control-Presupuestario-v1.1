/**
 * 🏢 Excel de trabajo — GASTOS LIBERTAD y la CUENTA MSA ↔ MA, mes por mes (JMS 03/11). SÓLO LEE la base.
 *
 *     npx tsx scripts/excel-libertad-y-cuenta-ma.mts
 *
 * JMS: «hacé un cuadro de cómo queda Libertad en Excel aparte… hay que armar la cuenta de MSA con PAM, MSA con MA… dirigiéndote en
 * contable para un estudio (e interno para otro)… va más allá de pagos directos: incluye todo tipo de retiro — si MSA pagó una factura
 * de MA, MSA pagase autónomos de MA… por los nombres de los templates, no RET 3… Libertad será un solo renglón de retiros o aportes con
 * su detalle debajo… sería bueno hacer un chequeo más allá de lo anotado en contable: cruzar de base la BBDD… siempre todo mes x mes».
 *
 * Usa las MISMAS funciones que el balance (`desdeCuota`, `vincularBanco`, `hojaLibertad`, `hojaResumenPorMes`), para que el Excel y la
 * solapa «H · Gastos Libertad» den lo mismo. Signo de la cuenta: + = MA RETIRÓ de MSA (MSA puso plata por MA) · − = MA APORTÓ.
 *
 * Qué entra en la cuenta MSA ↔ MA (ejercicio 25/26), y por qué camino se detectó (columna «Detectado por»):
 *  · Un movimiento de una cuenta de MSA (bancos, tarjeta) que paga una cuota de un template de MA, o una factura de MA → MA retiró.
 *  · Un movimiento de una cuenta de MA que paga una cuota de un template de MSA, o una factura de MSA → MA aportó.
 *  · Un movimiento con la marca contable de MA («CTA MA», «RET 3 MA»…) en una cuenta de MSA, aunque no esté atado a nada.
 *  · LIBERTAD: un renglón por mes (lo que MSA pagó − su 50%), sólo ene–jun 2026 (jul–dic 2025 el socio es PAM); su detalle en la solapa.
 *  · NO entran: lo de Libertad uno por uno (va en su renglón), ni los sueldos de MA como empleada de MSA (son sueldo, no retiro).
 * Control: lo detectado por la base SIN marca contable, y lo marcado SIN nada en la base, se listan aparte.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { desdeCuota, type CuotaTemplate } from "../lib/balance/templates-libro"
import { leerMovimientosDeCuotas, vincularBanco, leerExtractoDelEjercicio, indiceDeDestinos } from "../lib/balance/movimientos-de-cuotas"
import { hojaLibertad, esDeLibertad, quienPago, pagosPorFacturaLib } from "../lib/balance/libertad"
import { hojaResumenPorMes } from "../lib/balance/resumen-por-mes"
import { agregarHoja } from "../lib/balance/export-libro-diario"

const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DESDE = "2025-07-01", HASTA = "2026-06-30", ETIQ = "25/26"
const MESES = ["2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"]
const ROT = ["jul-25","ago-25","sep-25","oct-25","nov-25","dic-25","ene-26","feb-26","mar-26","abr-26","may-26","jun-26"]
const meses = MESES.map((clave, i) => ({ clave, rotulo: ROT[i] }))
const r2 = (x: number) => Math.round(x * 100) / 100
const enEj = (f?: string | null) => !!f && f.slice(0, 10) >= DESDE && f.slice(0, 10) <= HASTA
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"

async function todo(q: (d: number, h: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break }
  return out
}

// ── 1 · Las cuotas, como las lee el balance, con su banco
const crudas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura")
  .select("*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable, tipo, cuenta_agrupadora)")
  .gte("fecha_estimada", "2024-01-01").order("id").range(d, h))
let cuotas: CuotaTemplate[] = crudas.map(f => desdeCuota(f))
const leido = await leerMovimientosDeCuotas(sb, cuotas)
cuotas = vincularBanco(cuotas, cuotas, leido.movimientos)
const ex = await leerExtractoDelEjercicio(sb, DESDE, HASTA)
const extracto = { movimientos: ex.movimientos, destinos: indiceDeDestinos(cuotas), tablasQueFallaron: ex.tablasQueFallaron }
const cuotasEj = cuotas.filter(c => enEj(c.fecha))
console.log(`Cuotas leídas ${cuotas.length} (del ejercicio ${cuotasEj.length}) · movimientos del extracto ${ex.movimientos.length}${ex.tablasQueFallaron.length ? ` · ⚠️ fallaron: ${ex.tablasQueFallaron.join(", ")}` : ""}`)

// ── 2 · LIBERTAD — la hoja del balance tal cual, y el neto por mes
const filasLib = hojaLibertad(cuotasEj, ETIQ, meses, extracto)
const libDeTpl = cuotasEj.filter(c => esDeLibertad(c) && Math.abs(c.monto) >= 0.005)
const libTodo = [...libDeTpl, ...pagosPorFacturaLib(libDeTpl, extracto).filter(c => enEj(c.fecha))]
const libMes = MESES.map(m => {
  const cs = libTodo.filter(c => (c.fecha ?? "").slice(0, 7) === m)
  const costo = r2(cs.reduce((t, c) => t + c.monto, 0))
  const msa = r2(cs.filter(c => quienPago(c) === "MSA").reduce((t, c) => t + c.monto, 0))
  return { mes: m, costo, msa, neto: r2(msa - costo / 2) }
})
const libIds = new Set(libTodo.flatMap(c => [c.id, c.grupoPagoId]).filter(Boolean) as string[])

// ── 3 · La cuenta MSA ↔ MA
const porCuota = new Map<string, CuotaTemplate>(); const porGrupo = new Map<string, CuotaTemplate[]>()
for (const c of cuotas) { porCuota.set(c.id, c); if (c.grupoPagoId) porGrupo.set(c.grupoPagoId, [...(porGrupo.get(c.grupoPagoId) ?? []), c]) }
const respDe = (c?: CuotaTemplate) => (c?.responsable ?? "").split("/")[0].trim().toUpperCase()
const fcMA = new Map((await todo((d, h) => sb.schema("ma").from("comprobantes_arca").select("id, denominacion_emisor, punto_venta, numero_desde").order("id").range(d, h))).map((f: any) => [f.id, f]))
const fcMSA = new Map((await todo((d, h) => sb.schema("msa").from("comprobantes_arca").select("id, denominacion_emisor, punto_venta, numero_desde").order("id").range(d, h))).map((f: any) => [f.id, f]))
const MARCA_MA = /\b(cta|ret\s*\d*|cuenta)\s*ma\b/i, MARCA_MSA = /\b(cta|cuenta)\s*msa\b/i

type Item = { mes: string; fecha: string; cuenta: string; titular: string; desc: string; que: string; por: string; contable: string; interno: string; imp: number }
const items: Item[] = []; const marcadosSinNada: Item[] = []; const sinMarca: Item[] = []
/** El estudio es por CONTABLE: lo que el interno da a MA y el contable no, va al control (los dos estudios no coinciden). */
const internoSinContable: Item[] = []
for (const t of TABLAS_CON_VINCULO_ARCA) {
  if (!["MSA", "MA"].includes(String(t.titular))) continue
  const q = (d: number, h: number) => (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("*").gte("fecha", DESDE).lte("fecha", HASTA).order("id").range(d, h)
  let movs: any[] = []
  try { movs = await todo(q) } catch (e: any) { console.log(`⚠️ ${t.schema}.${t.tabla}: ${e.message}`); continue }
  for (const m of movs) {
    if (m.moneda && String(m.moneda).toUpperCase() !== "ARS" && /usd|dolar/i.test(t.tabla)) continue
    const contable = String(m.contable ?? "").trim(), interno = String(m.interno ?? "").trim()
    if (/^lib/i.test(contable)) continue                          // Libertad va en su renglón
    if (m.template_cuota_id && libIds.has(m.template_cuota_id)) continue
    if (m.sueldo_pago_id) continue                                // sueldo de MA como empleada: no es retiro
    const deb = Number(m.debitos) || 0, cred = Number(m.creditos) || 0
    const cuota = m.template_cuota_id ? porCuota.get(m.template_cuota_id) ?? porGrupo.get(m.template_cuota_id)?.[0] : undefined
    const fc = m.comprobante_arca_id ? (t.titular === "MSA" ? fcMA.get(m.comprobante_arca_id) : fcMSA.get(m.comprobante_arca_id)) : undefined
    const otra = t.titular === "MSA" ? "MA" : "MSA"
    const porTpl = cuota && respDe(cuota) === otra, porFc = !!fc
    const marca = t.titular === "MSA" ? MARCA_MA.test(contable) : MARCA_MSA.test(contable)
    if (!porTpl && !porFc && !marca) {
      if (t.titular === "MSA" && /\bdist\s*ma\b/i.test(interno)) internoSinContable.push({ mes: String(m.fecha).slice(0, 7), fecha: String(m.fecha).slice(0, 10), cuenta: t.cuenta,
        titular: "MSA", desc: String(m.descripcion ?? "").slice(0, 80), que: String(m.comprobantes_pagados || m.categ || ""), por: "", contable, interno, imp: r2(deb - cred) })
      continue
    }
    const que = porTpl ? `Template «${cuota!.concepto}»` : porFc ? `Factura ${fc.denominacion_emisor} ${fc.punto_venta}-${fc.numero_desde}`
      : (m.comprobantes_pagados || m.categ || m.descripcion || "(sin vínculo)")
    // + = MA retiró de MSA: sale plata de MSA por MA (débito en MSA) o entra plata de MA a MSA al revés
    const imp = r2(t.titular === "MSA" ? deb - cred : -(deb - cred))
    const por = [porTpl ? "template de " + otra : "", porFc ? "factura de " + otra : "", marca ? "marca contable/interno" : ""].filter(Boolean).join(" + ")
    const it: Item = { mes: String(m.fecha).slice(0, 7), fecha: String(m.fecha).slice(0, 10), cuenta: t.cuenta, titular: String(t.titular), desc: String(m.descripcion ?? "").slice(0, 80), que: String(que), por, contable, interno, imp }
    items.push(it)
    if ((porTpl || porFc) && !marca) sinMarca.push(it)
    if (marca && !porTpl && !porFc) marcadosSinNada.push(it)
  }
}
// La categoría del resumen = el nombre del template / factura / marca (no «RET 3»)
const categoria = (it: Item) => it.que.startsWith("Template") ? it.que.replace(/^Template «(.*)»$/, "$1").replace(/ (\d{4}|MA|MSA)$/,"")
  : it.que.startsWith("Factura") ? "Facturas de " + it.que.replace(/^Factura (.*?) \d+-\d+$/, "$1") : `Movimientos marcados «${it.contable || it.interno}»`
const det = [
  ...items.map(it => ({ categoria: categoria(it), mes: it.mes, importe: it.imp,
    columnas: [it.fecha.split("-").reverse().join("/"), it.cuenta, it.desc, it.que, it.por, it.contable, it.interno] })),
  ...libMes.filter(x => x.mes >= "2026-01" && x.neto !== 0).map(x => ({ categoria: "LIBERTAD — MSA pagó − su 50% (detalle en la solapa Libertad)", mes: x.mes, importe: x.neto,
    columnas: ["", "Libertad", `costo ${x.costo.toLocaleString("es-AR")} · MSA pagó ${x.msa.toLocaleString("es-AR")} · su 50% ${(x.costo / 2).toLocaleString("es-AR")}`, "Libertad", "cuadro Libertad", "LIB", ""] })),
]
const filasCta = hojaResumenPorMes(det, {
  titulo: `CUENTA MSA ↔ MA — ejercicio ${ETIQ} — por CONTABLE y cruce de la base (+ = MA retiró de MSA · − = MA aportó)`,
  notas: ["Sin saldo de inicio: es el MOVIMIENTO del ejercicio. Libertad entra como un renglón por mes (ene–jun 2026; jul–dic 2025 el socio de Libertad es PAM).",
    "Entra todo lo que MSA pagó y era de MA (cuotas de templates de MA, facturas de MA, lo marcado CTA MA / RET … MA / DIST MA) y al revés. No entran los sueldos de MA como empleada de MSA.",
    `Control: ${sinMarca.length} movimiento(s) detectados por la base SIN marca contable · ${marcadosSinNada.length} marcados SIN vínculo en la base — ver la solapa Control.`],
  meses, encabezadoDetalle: ["Fecha", "Cuenta", "Descripción del banco", "Qué es", "Detectado por", "Contable", "Interno"], rotuloImporte: "Importe (+ retiró / − aportó)",
})
const control: unknown[][] = [["CONTROL — lo que la marca contable y la base no dicen igual"], [],
  ["Detectado por la BASE (template o factura de la otra empresa) SIN marca contable"], ["Fecha", "Cuenta", "Descripción", "Qué es", "Importe"],
  ...sinMarca.map(i => [i.fecha.split("-").reverse().join("/"), i.cuenta, i.desc, i.que, i.imp]), [],
  ["MARCADO en contable SIN vínculo en la base (transferencias a MA y otros) — que sean lo que dice la marca"], ["Fecha", "Cuenta", "Descripción", "Marca", "Importe"],
  ...marcadosSinNada.map(i => [i.fecha.split("-").reverse().join("/"), i.cuenta, i.desc, i.contable, i.imp]), [],
  ["INTERNO dice «DIST MA» pero CONTABLE dice otra cosa — los dos estudios no coinciden (no entran a esta cuenta)"],
  ["Fecha", "Cuenta", "Descripción", "Qué pagó", "Contable", "Interno", "Importe"],
  ...internoSinContable.map(i => [i.fecha.split("-").reverse().join("/"), i.cuenta, i.desc, i.que, i.contable || "(vacío)", i.interno, i.imp])]

// ── 4 · Escribir (nunca pisa: v2, v3…)
if (!existsSync(CARPETA)) mkdirSync(CARPETA, { recursive: true })
const nombre = (base: string) => { let p = join(CARPETA, `${base}.xlsx`), v = 2; while (existsSync(p)) p = join(CARPETA, `${base} v${v++}.xlsx`); return p }
const wbL = XLSX.utils.book_new(); agregarHoja(wbL, "Gastos Libertad", filasLib); fechasReales(wbL as any)
const pL = nombre("Libertad 25-26 (2026-11-03)"); XLSX.writeFile(wbL, pL)
const wbC = XLSX.utils.book_new(); agregarHoja(wbC, "Cuenta MSA-MA", filasCta); agregarHoja(wbC, "Libertad", filasLib); agregarHoja(wbC, "Control", control); fechasReales(wbC as any)
const pC = nombre("Cuenta MSA-MA 25-26 (2026-11-03)"); XLSX.writeFile(wbC, pC)

// ── 5 · Resumen en pantalla
const tot = (xs: Item[]) => r2(xs.reduce((t, i) => t + i.imp, 0))
console.log(`\nLIBERTAD por mes (costo · MSA pagó · neto MSA−50%):`); for (const x of libMes) console.log(`  ${x.mes}  ${x.costo.toFixed(2).padStart(13)}  ${x.msa.toFixed(2).padStart(13)}  ${x.neto.toFixed(2).padStart(12)}`)
console.log(`  total costo ${r2(libMes.reduce((t, x) => t + x.costo, 0))} · neto 2025 ${r2(libMes.slice(0, 6).reduce((t, x) => t + x.neto, 0))} · neto 2026 ${r2(libMes.slice(6).reduce((t, x) => t + x.neto, 0))}`)
console.log(`\nCUENTA MSA↔MA: ${items.length} movimientos · neto ${tot(items)} · + Libertad 2026 ${r2(libMes.slice(6).reduce((t, x) => t + x.neto, 0))}`)
const porCat = new Map<string, number>(); for (const i of items) porCat.set(categoria(i), r2((porCat.get(categoria(i)) ?? 0) + i.imp))
for (const [k, v] of [...porCat].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) console.log(`  ${v.toFixed(2).padStart(14)}  ${k}`)
console.log(`  por mes: ${MESES.map(m => `${m.slice(2)} ${tot(items.filter(i => i.mes === m)).toFixed(0)}`).join(" · ")}`)
const tc = new Map<string, [number, number]>()
for (const i of internoSinContable) { const k = i.contable || "(vacío)"; const x = tc.get(k) ?? [0, 0]; tc.set(k, [x[0] + 1, r2(x[1] + i.imp)]) }
console.log(`Interno «DIST MA» con otro contable: ${[...tc].map(([k, [n, v]]) => `${k} ×${n} (${v})`).join(" · ")}`)
console.log(`Control: sin marca ${sinMarca.length} (${tot(sinMarca)}) · marcados sin vínculo ${marcadosSinNada.length} (${tot(marcadosSinNada)})`)
console.log(`\n📄 ${pL}\n📄 ${pC}`)
