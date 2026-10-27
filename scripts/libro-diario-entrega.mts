/**
 * 📒 **El LIBRO DIARIO para entregar, como Excel aparte** (A-FEAT-1388 ronda 3) — el prototipo que el usuario
 * revisa antes de que sea el export de la app. Misma lógica que la pantalla (`armarLibroDiario`) y el armado en
 * `lib/balance/libro-diario-entrega.ts`, que es lo que después usa la app.
 *
 * Lo presentado a ARCA sale de los zips del libro IVA de la carpeta de comunicación
 * (`- libros de iva ARCA/libro_iva_periodo_AAAAMM_original.zip`); el «papel» de cada comprobante, de los endosos
 * de Pólizas leídos del PDF (`polizas_endosos.total` con su `comprobante_arca_id`).
 *
 * 🔴 **SÓLO LEE.** § 🛑 Datos.
 *
 * ```
 * npx tsx scripts/libro-diario-entrega.mts            # MSA, cierre 2026
 * npx tsx scripts/libro-diario-entrega.mts MSA 2026
 * ```
 */
import { createClient } from "@supabase/supabase-js"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import XLSX from "xlsx-js-style"
import { armarEjercicio, claveSubdiario } from "../lib/balance/ejercicio"
import { armarLibroDiario, desdeArca, desdeHistorico, desdeVenta } from "../lib/balance/libro-diario"
import { PRESENTADO_ARCA_COMPRAS } from "../lib/balance/presentado-arca"
import { traerTodo } from "../lib/supabase-paginado"
import { leerZipLibroIva } from "../lib/subdiarios/libro-presentado"
// Día en hora argentina (§ 🕐 de CLAUDE.md). lib/fechas no se deja importar desde un .mts con tsx.
const hoyArgentina = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())
import JSZip from "jszip"
import {
  armarEntregaLibroDiario, nombreArchivoEntrega, type LoPresentado, type PapelDelComprobante, type TablaOriginal, type AjusteArca,
} from "../lib/balance/libro-diario-entrega"

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

const CARPETA = "- Comunicacion JMS Claude - Archivos"
const ZIPS = join(CARPETA, "- libros de iva ARCA")
const SALIDA = join(CARPETA, "Balance", "Excels trabajando con claude", "Export Balance App")

const ej = armarEjercicio(anioCierre, empresa.mesCierre)
const anios = [anioCierre - 1, anioCierre, anioCierre + 1]

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

const compras = [...arca.data.map(desdeArca), ...historico.data.map(desdeHistorico)]
const libro = armarLibroDiario(compras, ventas.data.map(desdeVenta), ej, PRESENTADO_ARCA_COMPRAS[empresaId])
// 🧾 La provisión de facturas (papel 05): fecha del ejercicio y subdiario posterior al cierre — no va al libro diario.
{
  const prov = libro.provisiones.filter(x => x.fuente !== "venta")
  const f = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2 })
  console.log(`🧾 provisión ${ej.etiqueta}: ${prov.length} comprobante(s) · ${f(prov.reduce((s, x) => s + x.total, 0))}`)
  if (process.env.DETALLE) for (const x of [...prov].sort((m, n) => String(m.fecha).localeCompare(String(n.fecha))))
    console.log(`   ${x.fecha} · subdiario ${x.subdiario} · ${x.tipo} ${x.punto_venta}-${x.numero} · ${x.denominacion.slice(0, 40)} · ${f(x.total)}`)
}

// 🧾 Lo presentado, mes por mes, de los zips (sólo MSA tiene la carpeta hoy).
const presentado: Record<string, LoPresentado> = {}
const original: { compras: TablaOriginal; ventas: TablaOriginal } = { compras: { encabezado: [], filas: [] }, ventas: { encabezado: [], filas: [] } }
const sinZip: string[] = []
for (const s of ej.subdiarios) {
  const clave = claveSubdiario(s.anio, s.mes)
  const archivo = join(ZIPS, `libro_iva_periodo_${s.anio}${String(s.mes).padStart(2, "0")}_original.zip`)
  if (empresaId !== "MSA" || !existsSync(archivo)) { sinZip.push(clave); continue }
  const datosZip = readFileSync(archivo)
  const z = await leerZipLibroIva(datosZip)
  presentado[clave] = { compras: z.compras, ventas: z.ventas }
  // El CSV tal cual (para la solapa «original»): encabezado + renglones, sin tocar.
  const zip = await JSZip.loadAsync(datosZip)
  for (const lado of ["compras", "ventas"] as const) {
    const f = Object.values(zip.files).find(x => x.name.toLowerCase().endsWith(`comprobantes_${lado}.csv`))
    if (!f) continue
    const lineas = new TextDecoder("latin1").decode(await f.async("uint8array")).split(/\r?\n/).filter(l => l.trim())
    const celdas = (l: string) => l.split(";").map(c => c.replace(/^"|"$/g, "").trim())
    if (!original[lado].encabezado.length && lineas.length) original[lado].encabezado = celdas(lineas[0])
    for (const l of lineas.slice(1)) original[lado].filas.push({ periodo: clave, valores: celdas(l) })
  }
}

// 📄 El papel: los endosos de Pólizas leídos del PDF, con el comprobante al que están atados.
const endosos = await sb.from("polizas_endosos")
  .select("comprobante_arca_id, comprobante_schema, endoso, total, es_nota_credito, poliza:polizas_seguro(poliza)")
  .not("comprobante_arca_id", "is", null)
if (endosos.error) throw new Error("endosos: " + endosos.error.message)
const papeles: PapelDelComprobante[] = (endosos.data ?? [])
  .filter(e => (e.comprobante_schema ?? empresa.schema) === empresa.schema)
  .map(e => ({
    comprobanteId: String(e.comprobante_arca_id),
    origen: `Póliza ${(e.poliza as unknown as { poliza?: string } | null)?.poliza ?? "?"} · endoso ${e.endoso}`,
    total: Number(e.total), esNotaCredito: !!e.es_nota_credito,
  }))

/**
 * ✍️ La RECTIFICACIÓN de lo declarado (A-DAT-95, decisiones de JMS 27/10) — se aplica encima de los zips, que no se tocan.
 * La app ya está así: lo declarado rectificado tiene que coincidir con ella.
 */
const AJUSTES: AjusteArca[] = empresaId !== "MSA" ? [] : [
  { periodo: "2026-02", lado: "ventas", accion: "sacar", comprobante: { tipo: 180, puntoVenta: 11, numero: 77393, cuit: "30526554562" },
    motivo: "Genta 11-77393 duplicada: se declaró como venta negativa de febrero y como compra de abril; queda sólo la compra (no modifica IVA)" },
  { periodo: "2026-01", lado: "compras", accion: "reemplazar", comprobante: { tipo: 1, puntoVenta: 1, numero: 670822, cuit: "33707366589" },
    nuevo: { exento: -47198.41, otrosTributos: -283.19, total: -47481.60 },
    motivo: "Federación 1-670822: es crédito (póliza 670821 endoso 1, −47.481,60) y se declaró en positivo (no modifica IVA)" },
  { periodo: "2026-04", lado: "compras", accion: "reemplazar", comprobante: { tipo: 1, puntoVenta: 4, numero: 670821, cuit: "33707366589" },
    nuevo: { exento: -81676.64, otrosTributos: -490.06, total: -82166.70 },
    motivo: "Federación 4-670821: es crédito (póliza 670821 endoso 4, −82.166,70) y se declaró en positivo (no modifica IVA)" },
]

const hoy = hoyArgentina()
const datos = { libro, empresa: empresaId, presentado, papeles, generado: hoy, arcaOriginal: original, ajustesArca: AJUSTES }
const { wb, analisis: a } = armarEntregaLibroDiario(datos)
// SUFIJO=… agrega una marca al nombre (p. ej. «ANTES de cta cte AFA»), para no pisar uno abierto ni una foto.
const ruta = join(SALIDA, nombreArchivoEntrega(datos, hoy).replace(".xlsx", process.env.SUFIJO ? ` - ${process.env.SUFIJO}.xlsx` : ".xlsx"))
writeFileSync(ruta, XLSX.write(wb, { bookType: "xlsx", type: "buffer" }))

const pesos = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2 })
console.log(`📒 ${ruta}`)
console.log(`   hojas: ${wb.SheetNames.length} · subdiarios: ${a.compras.filter(s => s.asientos.length).length} de compras + ${a.ventas.filter(s => s.asientos.length).length} de ventas`)
console.log(`   ${a.sePuedeInformar ? "✅ se puede informar" : "🛑 NO informar todavía"}`)
if (sinZip.length) console.log(`   ⚠️ sin libro IVA presentado: ${sinZip.join(", ")}`)
for (const x of a.aRectificar) console.log(`   🛑 ${x.nombre}: ${x.motivos.join(" | ")}`)
for (const p of a.papelDistinto) console.log(`   📄 ${p.asiento.subdiario} ${p.asiento.denominacion} ${p.asiento.punto_venta}-${p.asiento.numero}: papel ${pesos(p.papel.total)} · cargado ${pesos(p.asiento.total)} · declarado ${p.declarado ? pesos(p.declarado.total) : p.declarado === null ? "no figura" : "sin dato"}`)
console.log(`   tipo/signo cruzados: ${a.tipoSigno.filter(t => !t.aceptado).length} (aceptados por el papel: ${a.tipoSigno.filter(t => t.aceptado).length}) · partes que no suman: ${a.descuadres.compras.length + a.descuadres.ventas.length}`)
for (const lado of ["compras", "ventas"] as const) {
  const subs = lado === "compras" ? a.compras : a.ventas
  const app = subs.reduce((t, s) => t + s.totales.total, 0)
  const dec = subs.reduce((t, s) => t + (s.contra?.totales.presentado.total ?? 0), 0)
  console.log(`   ${lado}: app ${pesos(app)} · declarado ${pesos(dec)} · por cuenta ${pesos(a.porCuenta[lado].totalGeneral.total)}`)
}

// 🔎 DETALLE=1: lo que no coincide, comprobante por comprobante (para revisar el emparejamiento).
if (process.env.DETALLE) {
  for (const lado of ["compras", "ventas"] as const) {
    for (const s of lado === "compras" ? a.compras : a.ventas) {
      if (!s.contra || s.contra.ok) continue
      const c = s.contra
      console.log(`\n── ${s.clave} ${lado}: app ${c.totales.app.comprobantes}/${pesos(c.totales.app.total)}/${pesos(c.totales.app.creditoFiscal)} · decl ${c.totales.presentado.comprobantes}/${pesos(c.totales.presentado.total)}/${pesos(c.totales.presentado.creditoFiscal)}`)
      for (const f of c.soloApp) console.log(`   sóloApp   t${f.tipo_comprobante} ${f.punto_venta}-${f.numero_desde} ${f.cuit} ${String(f.denominacion_emisor).slice(0, 30)} ${pesos(Number(f.imp_total))}`)
      for (const p of c.soloPresentado) console.log(`   sóloDecl  t${p.tipo} ${p.puntoVenta}-${p.numero} ${p.cuit} ${p.denominacion.slice(0, 30)} ${pesos(p.total)}`)
      for (const x of c.importeDistinto) console.log(`   importe   t${x.app.tipo_comprobante} ${x.app.punto_venta}-${x.app.numero_desde} ${String(x.app.denominacion_emisor).slice(0, 30)} app ${pesos(Number(x.app.imp_total))} decl ${pesos(x.presentado.total)}`)
    }
  }
}
