/**
 * 📗 **El Libro Diario consensuado, armado desde Supabase** — el mismo libro que baja el botón «Bajar Libro Diario» de
 * Reportes → Balance (`lib/balance/libro-diario-consensuado.ts`), para compararlo contra el que se armó a mano el
 * 27/10/2026 («Sesion Claude Estanco/Libro Diario»).
 *
 * 🔴 **SÓLO LEE.** § 🛑 Datos.
 *
 * ```
 * npx tsx scripts/libro-diario-consensuado.mts                 # MSA, cierre 2026
 * npx tsx scripts/libro-diario-consensuado.mts MSA 2026 "C:\ruta\salida.xlsx"
 * ```
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"
import { armarEjercicio } from "../lib/balance/ejercicio"
import { armarLibroDiario, desdeArca, desdeHistorico, desdeVenta } from "../lib/balance/libro-diario"
import { PRESENTADO_ARCA_COMPRAS } from "../lib/balance/presentado-arca"
import { traerTodo } from "../lib/supabase-paginado"
import { armarLibroDiarioConsensuado, bytesLibroDiarioConsensuado } from "../lib/balance/libro-diario-consensuado"
import { leerCobrosYRetenciones } from "../lib/balance/cobros-de-ventas"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const EMPRESAS: Record<string, { schema: string; mesCierre: number }> = {
  MSA: { schema: "msa", mesCierre: 6 }, PAM: { schema: "pam", mesCierre: 12 }, MA: { schema: "ma", mesCierre: 12 },
}
const empresaId = (process.argv[2] || "MSA").toUpperCase()
const anioCierre = Number(process.argv[3] || 2026)
const empresa = EMPRESAS[empresaId]
if (!empresa) { console.error(`❌ Empresa desconocida: ${empresaId}`); process.exit(1) }
const SALIDA = process.argv[4]
  || "D:\\Users\\josem\\Documents\\Jose\\- Desarrollo de Software\\Sesion Claude Estanco\\Libro Diario\\Descargas de Sistema\\Libro_Diario_MSA_25-26 - generado por script de la rama.xlsx"

const ej = armarEjercicio(anioCierre, empresa.mesCierre)
const anios = [anioCierre - 1, anioCierre, anioCierre + 1]

// Las mismas consultas que la pantalla (components/papeles-de-balance.tsx → generar).
const [arca, historico, ventas] = await Promise.all([
  traerTodo((d, h) => sb.schema(empresa.schema).from("comprobantes_arca").select("*", { count: "exact" }).in("año_contable", anios).order("id").range(d, h)),
  empresaId === "MSA"
    ? traerTodo((d, h) => sb.schema("msa").from("comprobantes_historico").select("*", { count: "exact" }).in("anio_contable", anios).order("id").range(d, h))
    : Promise.resolve({ data: [], error: null, esperadas: 0 }),
  traerTodo((d, h) => sb.schema(empresa.schema).from("comprobantes_venta").select("*", { count: "exact" }).in("año_contable", anios).order("id").range(d, h)),
])
for (const [nombre, r] of [["compras", arca], ["histórico", historico], ["ventas", ventas]] as const) {
  if (r.error) throw new Error(`${nombre}: ${r.error.message}`)
  if (r.esperadas != null && r.esperadas !== r.data.length) throw new Error(`${nombre}: llegaron ${r.data.length} de ${r.esperadas}`)
}

const libro = armarLibroDiario(
  [...arca.data.map(desdeArca), ...historico.data.map(desdeHistorico)],
  ventas.data.map(desdeVenta), ej, PRESENTADO_ARCA_COMPRAS[empresaId],
)
const cyr = await leerCobrosYRetenciones(sb, empresaId, empresa.schema)
for (const a of cyr.avisos) console.warn("⚠️ " + a)
const l = armarLibroDiarioConsensuado(libro, empresaId, cyr)
console.log("Control cobros:", JSON.stringify(l.resumen.cobros), "· retenciones:", JSON.stringify(l.resumen.retenciones))
writeFileSync(SALIDA, await bytesLibroDiarioConsensuado(l))

const p = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r = l.resumen
console.log(`📗 ${SALIDA}`)
console.log(`   solapas: ${l.wb.SheetNames.join(" · ")} · cuadro consensuado: ${r.conConsensuado ? "sí" : "no hay para este ejercicio"}`)
console.log(`   compras ${r.compras.comprobantes}: neto ${p(r.compras.totales.O)} · no grav ${p(r.compras.totales.P)} · exentas ${p(r.compras.totales.Q)} · monotributo ${p(r.compras.totales.R)} · otros ${p(r.compras.totales.S)} · IVA ${p(r.compras.totales.T)} · total ${p(r.compras.totales.U)} · dif ${p(r.compras.totales.V)}`)
console.log(`   ventas ${r.ventas.comprobantes}: neto ${p(r.ventas.totales.N)} · no grav ${p(r.ventas.totales.O)} · exentas ${p(r.ventas.totales.P)} · IVA ${p(r.ventas.totales.Q)} · total ${p(r.ventas.totales.R)} · dif ${p(r.ventas.totales.S)}`)
console.log(`   retenciones ${r.retenciones.comprobantes}: IVA ${p(r.retenciones.iva)} · IIBB ${p(r.retenciones.iibb)} · total ${p(r.retenciones.iva + r.retenciones.iibb)}`)
if (libro.historicoSuperado.length) console.log(`   (histórico superado, fuera del libro: ${libro.historicoSuperado.length})`)
if (!libro.controles.sePuedeEntregar) for (const m of libro.controles.motivos) console.log(`   ⚠️ ${m}`)
