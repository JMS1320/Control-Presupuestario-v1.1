/**
 * 🔍 **Diferencias vs ARCA, armado desde Supabase + los zips del libro IVA del disco** — el mismo libro que baja el botón
 * «Bajar Diferencias vs ARCA» de Reportes → Balance (`lib/balance/diferencias-vs-arca.ts`), para compararlo contra los
 * dos reportes armados a mano el 27/10/2026 («Sesion Claude Estanco/Libro Diario»).
 *
 * 🔴 **SÓLO LEE.** § 🛑 Datos.
 *
 * ```
 * npx tsx scripts/diferencias-vs-arca.mts                                  # MSA, cierre 2026, zips de «Sesion Claude Estanco»
 * npx tsx scripts/diferencias-vs-arca.mts MSA 2026 "C:\carpeta\de\zips" "C:\ruta\salida.xlsx"
 * ```
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { armarEjercicio } from "../lib/balance/ejercicio"
import { armarLibroDiario, desdeArca, desdeHistorico, desdeVenta } from "../lib/balance/libro-diario"
import { PRESENTADO_ARCA_COMPRAS } from "../lib/balance/presentado-arca"
import { traerTodo } from "../lib/supabase-paginado"
import { armarDiferenciasVsArca, bytesDiferenciasVsArca, leerZipParaDiferencias } from "../lib/balance/diferencias-vs-arca"
import { filasVentasConsensuado, retencionesSufridas } from "../lib/balance/libro-diario-consensuado"

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
const CARPETA_ZIPS = process.argv[4] || "D:\\Users\\josem\\Documents\\Jose\\- Desarrollo de Software\\Sesion Claude Estanco"
const SALIDA = process.argv[5]
  || "D:\\Users\\josem\\Documents\\Jose\\- Desarrollo de Software\\Sesion Claude Estanco\\Libro Diario\\Descargas de Sistema\\Diferencias_vs_ARCA_MSA_25-26 - generado por script de la rama.xlsx"

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

// Los zips, como si el usuario los eligiera en el selector (todos los libro_iva_periodo_*.zip de la carpeta).
const archivos = readdirSync(CARPETA_ZIPS).filter(n => /^libro_iva_periodo_\d{6}.*\.zip$/i.test(n)).sort()
const zips = await Promise.all(archivos.map(n => leerZipParaDiferencias(n, readFileSync(path.join(CARPETA_ZIPS, n)))))
const l = armarDiferenciasVsArca(libro, empresaId, zips)
writeFileSync(SALIDA, await bytesDiferenciasVsArca(l))

const p = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r = l.resumen
console.log(`🔍 ${SALIDA}`)
console.log(`   solapas: ${l.wb.SheetNames.join(" · ")} · zips: ${archivos.length} leídos, ${r.zips.usados} usados, ${r.zips.descartados} descartados · faltan: ${r.zips.faltan.join(", ") || "ninguno"}`)
console.log(`   compras: ${libro.compras.length} en el libro · ${r.compras.pares} emparejadas · ${r.compras.filas} diferencias`)
for (const [g, n] of Object.entries(r.compras.porGrupo)) console.log(`      ${g}: ${n}`)
console.log(`   compras explicado (neto, no grav, exentas, otros, IVA, total): ${r.compras.explicado.map(p).join(" · ")}`)
console.log(`   compras control explicado − (ARCA − app): ${r.compras.control.map(p).join(" · ")}`)
console.log(`   compras zips − cuadro consensuado: ${r.compras.controlConsensuado?.map(p).join(" · ") ?? "(no hay cuadro para este ejercicio)"}`)
console.log(`   ventas: ${r.ventas.filas} filas de diferencias · no entra en el cuadro: ${r.ventas.noEntra}`)
for (const [g, n] of Object.entries(r.ventas.porGrupo)) console.log(`      ${g}: ${n}`)
console.log(`   ventas ARCA − sistema (neto, no grav, exentas, IVA, total): ${r.ventas.dif.map(p).join(" · ")} · control: ${r.ventas.control.map(p).join(" · ")} · CSV vs XML: ${p(r.ventas.csvVsXml)}`)
// Las retenciones de la app (las de la solapa «Retenciones sufridas» del Libro Diario), contra lo que ARCA restó del total.
const ret = retencionesSufridas(filasVentasConsensuado(libro.ventas))
const sumaRet = ret.reduce((s, f) => s + f.retIva + f.retIibb, 0)
console.log(`   retenciones de la app: ${ret.length} ventas · IVA ${p(ret.reduce((s, f) => s + f.retIva, 0))} + IIBB ${p(ret.reduce((s, f) => s + f.retIibb, 0))} = ${p(sumaRet)}`)
for (const a of r.avisos) console.log(`   ⚠️ ${a}`)
