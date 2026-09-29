/**
 * 📑 **SEGMENTAR EL EXTRACTO DE JULIO 2025 A ENERO 2026 — una solapa por categoría.**
 *
 * Pedido del usuario 2026-09-29, sobre el Excel que dejó en la carpeta de comunicación:
 * > *«Vos andá mirando el Excel que te dejé con el extracto de 2025 desde 1/7 en adelante… Fijate que
 * > enganche bien con saldo de la app cuando arranca. Quiero que veas en este Excel que yo pongo unas
 * > CATEG que, si bien no son las mismas, te van a ayudar. Si me hacés un Excel en base a esto
 * > agregando solapas, una por cada categ, y subdivididas en el tipo de gasto, de alguna manera
 * > podremos tener los equivalentes de los templates. **Pero vos sólo hacé la segmentación y los
 * > controles** respecto del Excel. Luego vemos cómo poblamos los templates.»*
 *
 * 🛑 **Entonces esto NO mapea nada ni escribe en la base.** Segmenta y controla. La traducción de sus
 * `CATEG` a las categorías de la app, y la carga de los templates, son decisiones suyas y vienen
 * después. Lo único que se agrega como **información** es si esa categoría ya existe en el plan de
 * cuentas — que es un dato, no una decisión.
 *
 * ## Qué produce
 *
 * | Solapa | Qué lleva |
 * |---|---|
 * | **00 Control** | los tres controles, y la lista de las 56 categorías con su total |
 * | **una por CATEG** | arriba, el pivot **tipo de gasto × mes** —que es lo que sirve para armar un template—; abajo, los movimientos uno por uno |
 *
 * ## Los tres controles (§ 🧮 de `CLAUDE.md`)
 *
 * 1. **Interno del Excel:** `saldo inicial + créditos − débitos = último saldo`. Es el camino inverso:
 *    si la planilla perdió o duplicó una fila, esto no cierra.
 * 2. **Enganche con la app:** el último saldo del Excel tiene que explicar el primer saldo que tiene
 *    la app, sumando el primer movimiento de la app. Es el control que él pidió por nombre.
 * 3. **Solapamiento:** que no haya movimientos en las dos fuentes para el mismo día, para no contar
 *    nada dos veces.
 *
 * ```
 * npx tsx scripts/segmentar-extracto-2025.mts
 * ```
 * 🔴 **SÓLO LEE.** El Excel de él no se toca; se escribe uno nuevo en la carpeta de comunicación.
 */
import { createRequire } from "node:module"
import { readFileSync, writeFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { normalizarCuenta } from "../lib/balance/papeles-bancarios"
import { MONEDA, ENTERO, formatearHoja, conFormula, type Columna } from "../lib/balance/formato-excel"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx") as typeof import("xlsx")

const ENTRADA = "- Comunicacion JMS Claude - Archivos/Balance/"
  + "extracto desde julio del 2025 hasta enero 26 parcial. galicia MSA cta cte pesos.xlsx"
const SALIDA = "- Comunicacion JMS Claude - Archivos/Balance/"
  + "Extracto_2025-07_a_2026-01_SEGMENTADO_por_categoria.xlsx"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)

const money = (n: number) => Math.round(n * 100) / 100
const pesos = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2 })

// ── Leer su Excel ─────────────────────────────────────────────────────────────────────────
interface Fila {
  fecha: string; desc: string; deb: number; cre: number; saldo: number
  categ: string; detalle: string; contable: string; interno: string; cc: string
  grupo: string; comprobante: string
  /**
   * La fila que ocupaba en SU planilla.
   *
   * 🧨 **Hace falta y me costó un número falso.** Su planilla está ordenada de la fecha **más nueva a
   * la más vieja**, y en un mismo día hay varios movimientos. Al ordenar sólo por fecha ascendente, el
   * `sort` estable deja las filas del mismo día **todavía al revés**, así que «la última del último
   * día» era la **más vieja** de ese día — y el saldo final que tomé era de media jornada. El control
   * daba $7.645.686,79 de diferencia y el problema no estaba en su planilla sino en mi lectura.
   */
  orden: number
}

const wbIn = XLSX.read(readFileSync(ENTRADA), { type: "buffer", cellDates: true })
const aoa = XLSX.utils.sheet_to_json<unknown[]>(wbIn.Sheets[wbIn.SheetNames[0]], { header: 1, raw: true, defval: "" })

/** La cabecera está en la fila 3 (1-based): arriba hay dos filas de título. */
const col: Record<string, number> = {}
;(aoa[2] as unknown[]).forEach((h, i) => { if (String(h).trim()) col[String(h).trim()] = i })

const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  const x = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", "."))
  return Number.isFinite(x) ? x : 0
}
const texto = (v: unknown) => String(v ?? "").trim()

const filas: Fila[] = []
let saldoInicial = 0
for (let i = 3; i < aoa.length; i++) {
  const r = aoa[i] as unknown[]
  const f = r[col["Fecha"]]
  if (!(f instanceof Date)) {
    // La última fila es «saldo de inicio de ej 2025» y trae el número en la columna Saldo.
    if (texto(r[0]).toLowerCase().includes("saldo de inicio")) saldoInicial = num(r[col["Saldo"]])
    continue
  }
  filas.push({
    fecha: f.toISOString().slice(0, 10),
    desc: texto(r[col["Descripción"]]),
    deb: num(r[col["Débitos"]]), cre: num(r[col["Créditos"]]),
    saldo: num(r[col["Saldo"]]),
    categ: texto(r[col["CATEG"]]) || "(sin CATEG)",
    detalle: texto(r[col["Detalle"]]) || "(sin detalle)",
    contable: texto(r[col["Contable"]]),
    interno: texto(r[col["Interno"]]),
    cc: texto(r[col["Centro de Costo"]]),
    grupo: texto(r[col["Grupo de Conceptos"]]),
    comprobante: texto(r[col["Número de Comprobante"]]),
    orden: i,
  })
}
/**
 * Su planilla viene de la más nueva a la más vieja; acá se ordena al revés, que es como se lee.
 * **Dentro del mismo día se invierte también el orden original**, que es lo que devuelve la
 * cronología real — ver la nota de `orden`.
 */
filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || b.orden - a.orden)

const totalDeb = money(filas.reduce((s, f) => s + f.deb, 0))
const totalCre = money(filas.reduce((s, f) => s + f.cre, 0))
const ultimo = filas[filas.length - 1]
const primerSaldoSuyo = filas[0]?.saldo ?? 0

/** Los meses que cubre, para las columnas del pivot. */
const meses = [...new Set(filas.map(f => f.fecha.slice(0, 7)))].sort()

// ── Los controles ─────────────────────────────────────────────────────────────────────────
/**
 * 🧮 **Control 1 — interno.** `saldo inicial + créditos − débitos` tiene que dar el último saldo.
 *
 * ⚠️ **Ojo con el orden**: su planilla está ordenada de la fecha más nueva a la más vieja, así que
 * «el último saldo» de la planilla es el del movimiento **más reciente**, no el de la última fila.
 */
const saldoCalculado = money(saldoInicial + totalCre - totalDeb)
const saldoDeclarado = ultimo?.saldo ?? 0
const control1 = money(saldoCalculado - saldoDeclarado)

// Control 2 · el enganche con la app.
const { data: primeras } = await sb.from("msa_galicia")
  .select("fecha, descripcion, debitos, creditos, saldo")
  .order("fecha", { ascending: true }).order("orden", { ascending: true, nullsFirst: false })
  .limit(1)
const primeraApp = (primeras ?? [])[0] as
  { fecha: string; descripcion: string; debitos: number; creditos: number; saldo: number } | undefined

const saldoEsperadoApp = primeraApp
  ? money(saldoDeclarado - Number(primeraApp.debitos ?? 0) + Number(primeraApp.creditos ?? 0))
  : null
const control2 = primeraApp && saldoEsperadoApp != null
  ? money(saldoEsperadoApp - Number(primeraApp.saldo ?? 0)) : null

// Control 3 · solapamiento de fechas.
const { data: solap } = await sb.from("msa_galicia")
  .select("fecha").lte("fecha", ultimo?.fecha ?? "1900-01-01").limit(5)
const solapados = (solap ?? []).length

// ── El plan de cuentas, sólo como información ────────────────────────────────────────────
const { data: plan } = await sb.from("cuentas_contables").select("cuenta_contable, nombre_totalizadora")
const planNorm = new Map(((plan ?? []) as Array<{ cuenta_contable: string; nombre_totalizadora: string | null }>)
  .map(c => [normalizarCuenta(c.cuenta_contable), c]))

// ══════════════════════════════════════════════════════════════════════════════════════════
const wb = XLSX.utils.book_new()
const hoja = (nombre: string, f: unknown[][], cols?: Columna[]) => {
  const ws = XLSX.utils.aoa_to_sheet(f)
  if (cols) formatearHoja(ws, cols)
  XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31))
}

// ── Agrupar por CATEG ─────────────────────────────────────────────────────────────────────
const porCateg = new Map<string, Fila[]>()
for (const f of filas) {
  const g = porCateg.get(f.categ) ?? []
  g.push(f)
  porCateg.set(f.categ, g)
}
const categsOrdenadas = [...porCateg.entries()]
  .map(([categ, fs]) => ({
    categ, fs,
    deb: money(fs.reduce((s, f) => s + f.deb, 0)),
    cre: money(fs.reduce((s, f) => s + f.cre, 0)),
  }))
  .sort((a, b) => (b.deb + b.cre) - (a.deb + a.cre))

/** Nombre de solapa válido para Excel: sin `: \ / ? * [ ]`, único y de 31 caracteres o menos. */
const usados = new Set<string>()
function nombreDeSolapa(categ: string, i: number): string {
  let base = `${String(i + 1).padStart(2, "0")} ${categ}`.replace(/[:\\/?*[\]]/g, "-").slice(0, 31)
  let n = base
  let k = 2
  while (usados.has(n)) { n = `${base.slice(0, 28)}~${k++}` }
  usados.add(n)
  return n
}

// ── Solapa 00 · los controles y el mapa ──────────────────────────────────────────────────
{
  const f: unknown[][] = []
  f.push(["EXTRACTO GALICIA MSA CTA CTE $ — SEGMENTADO POR CATEGORIA"])
  f.push([`Periodo: ${filas[0]?.fecha} al ${ultimo?.fecha}  ·  ${filas.length} movimientos  ·  ${categsOrdenadas.length} categorias`])
  f.push(["Origen: el Excel del usuario. Esta planilla NO modifica nada: segmenta y controla."])
  f.push([])

  f.push(["LOS TRES CONTROLES"])
  f.push([])
  f.push(["1 · Interno de la planilla", "", "", ""])
  f.push(["", "Saldo al inicio del ejercicio (01/07/2025)", money(saldoInicial)])
  f.push(["", "+ Creditos", totalCre])
  f.push(["", "- Debitos", totalDeb])
  f.push(["", "= Saldo calculado", saldoCalculado])
  f.push(["", `Saldo declarado al ${ultimo?.fecha}`, saldoDeclarado])
  f.push(["", "Diferencia", control1,
    Math.abs(control1) < 0.02 ? "CIERRA" : "NO CIERRA — falta o sobra una fila"])
  f.push([])

  f.push(["2 · Enganche con el extracto de la app"])
  if (!primeraApp) {
    f.push(["", "No se pudo leer el primer movimiento de la app."])
  } else {
    f.push(["", `Saldo declarado al ${ultimo?.fecha} (fin de esta planilla)`, saldoDeclarado])
    f.push(["", `Primer movimiento de la app: ${primeraApp.fecha} — ${primeraApp.descripcion}`,
      money(-Number(primeraApp.debitos ?? 0) + Number(primeraApp.creditos ?? 0))])
    f.push(["", "= Saldo esperado", saldoEsperadoApp])
    f.push(["", "Saldo que tiene la app", money(Number(primeraApp.saldo ?? 0))])
    f.push(["", "Diferencia", control2,
      control2 != null && Math.abs(control2) < 0.02
        ? "ENGANCHA — las dos fuentes son continuas" : "NO ENGANCHA — hay un hueco entre las dos"])
  }
  f.push([])

  f.push(["3 · Solapamiento"])
  f.push(["", `Movimientos de la app con fecha <= ${ultimo?.fecha}`, solapados,
    solapados === 0 ? "SIN SOLAPAMIENTO — no hay nada que descartar" : "HAY SOLAPAMIENTO — revisar"])
  f.push([])
  f.push([])

  f.push(["LAS CATEGORIAS, ordenadas por importe"])
  f.push(["La columna del plan de cuentas es solo INFORMACION: dice si ese nombre ya existe en la app."])
  f.push([])
  f.push(["#", "CATEG", "Movs", "Debitos", "Creditos", "Tipos de gasto distintos",
    "Existe en el plan de cuentas?", "Solapa"])
  categsOrdenadas.forEach((c, i) => {
    const enPlan = planNorm.get(normalizarCuenta(c.categ))
    f.push([
      i + 1, c.categ, c.fs.length, c.deb, c.cre,
      new Set(c.fs.map(x => x.detalle)).size,
      enPlan ? `si — ${enPlan.nombre_totalizadora ?? "sin totalizadora"}` : "no",
      nombreDeSolapa(c.categ, i),
    ])
  })
  const nT = f.length + 1
  const desdeT = nT - categsOrdenadas.length
  f.push(["", "TOTAL", filas.length,
    conFormula(`SUM(D${desdeT}:D${nT - 1})`, totalDeb),
    conFormula(`SUM(E${desdeT}:E${nT - 1})`, totalCre), "", "", ""])

  hoja("00 Control", f, [
    { ancho: 5, z: ENTERO }, { ancho: 44 }, { ancho: 8, z: ENTERO },
    { ancho: 18, z: MONEDA }, { ancho: 18, z: MONEDA }, { ancho: 12, z: ENTERO },
    { ancho: 34 }, { ancho: 26 },
  ])
}

// ── Una solapa por CATEG ──────────────────────────────────────────────────────────────────
usados.clear()
categsOrdenadas.forEach((c, i) => {
  const f: unknown[][] = []
  f.push([`${c.categ} — ${c.fs.length} movimientos`])
  f.push([`Debitos ${pesos(c.deb)}  ·  Creditos ${pesos(c.cre)}`])
  f.push([])

  /**
   * 🔑 **Arriba el PIVOT tipo de gasto × mes.** Es lo que sirve para armar un template: un template
   * es un concepto que se repite todos los meses, así que lo que hay que ver es **cuánto y cuántas
   * veces** aparece cada tipo de gasto en cada mes.
   */
  f.push(["TIPO DE GASTO POR MES (neto = debitos - creditos)"])
  f.push(["Tipo de gasto (columna Detalle)", ...meses, "TOTAL", "Meses con movimiento"])

  const porDetalle = new Map<string, Fila[]>()
  for (const x of c.fs) {
    const g = porDetalle.get(x.detalle) ?? []
    g.push(x)
    porDetalle.set(x.detalle, g)
  }
  const detalles = [...porDetalle.entries()]
    .map(([detalle, fs]) => ({ detalle, fs, neto: money(fs.reduce((s, x) => s + x.deb - x.cre, 0)) }))
    .sort((a, b) => Math.abs(b.neto) - Math.abs(a.neto))

  const ultimaCol = String.fromCharCode(65 + meses.length)
  const filaPrimerDetalle = f.length + 1
  for (const d of detalles) {
    const n = f.length + 1
    const porMes = meses.map(m => money(d.fs.filter(x => x.fecha.startsWith(m)).reduce((s, x) => s + x.deb - x.cre, 0)))
    f.push([
      d.detalle, ...porMes,
      conFormula(`SUM(B${n}:${ultimaCol}${n})`, d.neto),
      porMes.filter(v => v !== 0).length,
    ])
  }
  const nTot = f.length + 1
  f.push(["TOTAL",
    ...meses.map((_, j) => conFormula(
      `SUM(${String.fromCharCode(66 + j)}${filaPrimerDetalle}:${String.fromCharCode(66 + j)}${nTot - 1})`,
      money(c.fs.filter(x => x.fecha.startsWith(meses[j])).reduce((s, x) => s + x.deb - x.cre, 0)))),
    conFormula(`SUM(B${nTot}:${ultimaCol}${nTot})`, money(c.deb - c.cre)), "",
  ])

  f.push([])
  f.push([])
  f.push(["LOS MOVIMIENTOS, uno por uno"])
  f.push(["Fecha", "Descripcion del banco", "Debitos", "Creditos", "Tipo de gasto",
    "Contable", "Interno", "Centro de costo", "Grupo del banco", "Comprobante"])
  for (const x of c.fs) {
    f.push([x.fecha, x.desc, x.deb || "", x.cre || "", x.detalle,
      x.contable, x.interno, x.cc, x.grupo, x.comprobante])
  }

  hoja(nombreDeSolapa(c.categ, i), f, [
    { ancho: 38 },                                        // A · tipo de gasto / fecha
    ...meses.map(() => ({ ancho: 15, z: MONEDA })),       // los meses
    { ancho: 17, z: MONEDA },                             // TOTAL
    { ancho: 11, z: ENTERO },                             // meses con movimiento
  ])
})

writeFileSync(SALIDA, XLSX.write(wb, { bookType: "xlsx", type: "buffer" }))

// ── Lo que se dice por consola ────────────────────────────────────────────────────────────
console.log(`\n📑 ${SALIDA.split("/").pop()}`)
console.log(`   ${filas.length} movimientos · ${categsOrdenadas.length} categorias · ${meses.length} meses (${meses[0]} → ${meses[meses.length - 1]})`)
console.log(`\n1 · Interno de la planilla`)
console.log(`   ${pesos(saldoInicial)} + ${pesos(totalCre)} - ${pesos(totalDeb)} = ${pesos(saldoCalculado)}`)
console.log(`   declarado al ${ultimo?.fecha}: ${pesos(saldoDeclarado)}`)
console.log(`   ${Math.abs(control1) < 0.02 ? "✅ CIERRA" : `🛑 NO CIERRA por ${pesos(control1)}`}`)
console.log(`\n2 · Enganche con la app`)
if (primeraApp) {
  console.log(`   ${pesos(saldoDeclarado)} y el primer movimiento de la app (${primeraApp.fecha}, ${primeraApp.descripcion})`)
  console.log(`   esperado ${pesos(saldoEsperadoApp!)} · la app tiene ${pesos(Number(primeraApp.saldo))}`)
  console.log(`   ${control2 != null && Math.abs(control2) < 0.02 ? "✅ ENGANCHA al centavo" : `🛑 NO ENGANCHA por ${pesos(control2 ?? 0)}`}`)
}
console.log(`\n3 · Solapamiento`)
console.log(`   ${solapados === 0 ? "✅ ninguno: la app no tiene movimientos de ese período" : `⚠️ ${solapados} movimiento(s) de la app dentro del período`}`)
console.log(`\n   El primer saldo de la planilla (${filas[0]?.fecha}) es ${pesos(primerSaldoSuyo)}.\n`)
