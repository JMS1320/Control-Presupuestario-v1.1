/**
 * 🐄 **EL PAPEL DE STOCK DE HACIENDA DEL BALANCE** (A-FEAT-1541, JMS 04–05/11, aprobado sobre el prototipo).
 *
 * *«tendrá que tener 3 columnas de stock (NZ, SENASA, DDJJ) para inicio y para fin, y en el medio Nacimientos, Mortandad,
 * Reclasificación, Compras, Ventas; el cierre debería ser una fórmula para NZ… una solapa de compras, una de ventas, una de cambios
 * de categoría, una de nacimientos… para poder auditar la tabla»*. El cierre SENASA es un DATO (SENASA se mueve por actas de
 * vacunación, no por eventos — KNOWLEDGE «Hacienda: el signo y SENASA») y se controla por sexo y total.
 *
 * Y el VALORIZADO con el formato de su papel 2.2 (*«tomá este formato… las columnas de trazabilidad a la derecha… las tablas de
 * valores tomados, marcando lo de otra fecha; los links a mano»*), con el inicio valuado igual que el cierre y comparado contra
 * sus papeles y la DDJJ.
 *
 * Puro: arma filas para `hoja()` / `agregarHojaConEstilo` del export.
 */
import { CATEGORIAS_PLANILLA } from "./tres-saldos-hacienda"
import { cantidadConSigno } from "./cuadre-hacienda"
import { unirCeldas, altoDeFila, sinCongelar } from "./formato-excel"
import { DESCUENTO_COMERCIALIZACION, type ValuacionHacienda, type PrecioMag, type PrecioMercado, type PrecioCabeza } from "./hacienda-stock"
import type { PesoCategoria } from "./pesos-hacienda"

export interface MovimientoPapel { fecha: string; tipo: string; cantidad: number; categoria: string; cliente?: string | null; obs?: string | null }

/** Los saldos guardados en la pantalla del balance (papel `hacienda.saldos`): `<momento>.<fuente>.<clave planilla>`. */
export type SaldosGuardados = Record<string, string | number | undefined>

const PLANILLA_DE = new Map(CATEGORIAS_PLANILLA.flatMap(c => c.app.map(a => [a, c.nombre] as const)))
export const planillaDe = (categoriaApp: string) => PLANILLA_DE.get(categoriaApp) ?? `(sin ubicar) ${categoriaApp}`
const HEMBRAS = new Set(["vacas", "vaq-1ra", "cut", "vaquillonas"])
const num = (v: unknown) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null }
const dmy = (f: string) => f ? f.slice(0, 10).split("-").reverse().join("/") : ""

/** Las solapas de detalle, en el orden del cuadro. `tipo` = el de `movimientos_hacienda`. */
export const DETALLES = [
  { tipo: "nacimiento", hoja: "02.3 Nacimientos", columna: "Nacimientos", signo: "+" },
  { tipo: "mortandad", hoja: "02.4 Mortandad", columna: "Mortandad", signo: "-" },
  { tipo: "cambio_categoria", hoja: "02.5 Reclasificacion", columna: "Reclasificación", signo: "+" },
  { tipo: "compra", hoja: "02.6 Compras", columna: "Compras", signo: "+" },
  { tipo: "venta", hoja: "02.7 Ventas", columna: "Ventas", signo: "-" },
  { tipo: "ajuste_stock", hoja: "02.8 Ajustes", columna: "Ajustes", signo: "+" },
] as const

/** Una solapa de detalle: cada movimiento del ejercicio de ese tipo, con su categoría de la planilla (para sumar con fórmulas). */
export function hojaDetalleHacienda(movs: MovimientoPapel[], tipo: string, titulo: string, primerDia: string, fechaCierre: string): { filas: unknown[][]; d0: number; d1: number } {
  const del = movs.filter(m => m.tipo === tipo && m.fecha >= primerDia && m.fecha <= fechaCierre && m.cantidad !== 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.categoria.localeCompare(b.categoria))
  const f: unknown[][] = [[`${titulo} — ejercicio ${dmy(primerDia)} al ${dmy(fechaCierre)}`],
    ["Cada renglón suma en la categoría de la planilla de la columna C (las cabezas en positivo; el cuadro les pone el signo)."], [],
    ["Fecha", "Categoría (app)", "Categoría (planilla)", "Cabezas", "Cliente / proveedor", "Observación"]]
  const d0 = f.length + 1
  for (const m of del) f.push([m.fecha, m.categoria, planillaDe(m.categoria),
    tipo === "cambio_categoria" || tipo === "ajuste_stock" ? m.cantidad : Math.abs(m.cantidad), m.cliente ?? "", m.obs ?? ""])
  if (!del.length) f.push(["", "", "", 0, "", "no hubo en el ejercicio"])
  const d1 = f.length
  f.push(["", "", "TOTAL", { t: "n", f: `SUM(D${d0}:D${d1})`, v: del.reduce((s, m) => s + (tipo === "cambio_categoria" || tipo === "ajuste_stock" ? m.cantidad : Math.abs(m.cantidad)), 0) }])
  return { filas: f, d0, d1 }
}

/**
 * 🐄 El cuadro: una fila por categoría de la planilla. INICIO NZ (la app) · SENASA · DDJJ; los movimientos por tipo (SUMAR.SI sobre
 * las solapas de detalle); CIERRE NZ = fórmula; CIERRE SENASA y DDJJ = datos guardados; control contra la existencia de la app.
 */
export function hojaStockHacienda(movs: MovimientoPapel[], primerDia: string, fechaCierre: string, saldos: SaldosGuardados,
  rangos: Record<string, { d0: number; d1: number }>): unknown[][] {
  const conSigno = movs.map(m => ({ ...m, cantidad: cantidadConSigno(m.tipo, m.cantidad) }))
  const inicioApp = new Map<string, number>(), cierreApp = new Map<string, number>()
  for (const m of conSigno) {
    const p = planillaDe(m.categoria)
    if (m.fecha < primerDia) inicioApp.set(p, (inicioApp.get(p) ?? 0) + m.cantidad)
    if (m.fecha <= fechaCierre) cierreApp.set(p, (cierreApp.get(p) ?? 0) + m.cantidad)
  }
  const f: unknown[][] = [[`02 — STOCK DE HACIENDA (cabezas) — ${dmy(primerDia)} al ${dmy(fechaCierre)}`],
    ["NZ = nuestro registro (la app) · SENASA = lo registrado en SENASA · DDJJ = lo declarado en el balance. Los movimientos salen de las solapas 02.3 a 02.8 (fórmulas)."],
    [], ["Categoría", "INICIO NZ", "INICIO SENASA", "INICIO DDJJ", ...DETALLES.map(d => d.columna), "CIERRE NZ", "CIERRE SENASA", "CIERRE DDJJ", "Control: la app al cierre", "NZ − app (tiene que dar 0)"]]
  const t0 = f.length + 1
  const v = (k: string) => num(saldos[k])
  // los valores ya calculados (los que se ven si Excel no recalcula al abrir)
  const delEj = conSigno.filter(m => m.fecha >= primerDia && m.fecha <= fechaCierre)
  const mov = (tipo: string, p: string) => delEj.filter(m => m.tipo === tipo && planillaDe(m.categoria) === p).reduce((s, m) => s + m.cantidad, 0)
  const valores: number[][] = []
  for (const c of CATEGORIAS_PLANILLA) {
    const r = f.length + 1
    const movVals = DETALLES.map(d => mov(d.tipo, c.nombre))
    const movCols = DETALLES.map((d, i) => {
      const g = rangos[d.tipo]; if (!g) return movVals[i]
      return { t: "n", f: `${d.signo === "-" ? "-" : ""}SUMIFS('${d.hoja}'!$D$${g.d0}:$D$${g.d1},'${d.hoja}'!$C$${g.d0}:$C$${g.d1},$A${r})`, v: movVals[i] }
    })
    const ini = inicioApp.get(c.nombre) ?? 0, cie = ini + movVals.reduce((a, b) => a + b, 0)
    const sI = v(`inicio.senasa.${c.clave}`), dI = v(`inicio.balance.${c.clave}`), sC = v(`cierre.senasa.${c.clave}`), dC = v(`cierre.balance.${c.clave}`)
    valores.push([ini, sI ?? 0, dI ?? 0, ...movVals, cie, sC ?? 0, dC ?? 0, cierreApp.get(c.nombre) ?? 0, cie - (cierreApp.get(c.nombre) ?? 0)])
    f.push([c.nombre, ini, sI ?? "", dI ?? "", ...movCols,
      { t: "n", f: `B${r}+SUM(E${r}:J${r})`, v: cie },
      sC ?? "", dC ?? "", cierreApp.get(c.nombre) ?? 0, { t: "n", f: `K${r}-N${r}`, v: cie - (cierreApp.get(c.nombre) ?? 0) }])
  }
  const t1 = f.length
  const col = (i: number) => String.fromCharCode(65 + i)
  f.push(["TOTAL", ...Array.from({ length: 14 }, (_, i) => ({ t: "n", f: `SUM(${col(i + 1)}${t0}:${col(i + 1)}${t1})`, v: valores.reduce((s, x) => s + x[i], 0) }))])
  marcoDelStock(f, t0 - 1, t1 + 1)
  altoDeFila(f, t0 - 1, 45)
  const filaDe = (clave: string) => t0 + CATEGORIAS_PLANILLA.findIndex(c => c.clave === clave)
  // 🧮 JMS 05/11 (Papeles v11.04, solapa 02): el mismo stock AGRUPADO — vientres (vacas + vaquillonas a parir + CUT), vaquillonas,
  //    novillitos, terneros y toros/toritos —, con su total y un control contra el total de arriba (tiene que dar 0).
  f.push([])
  const g0 = f.length + 1
  const GRUPOS: Array<[string, string[]]> = [["Vacas Vqll a parir", ["vacas", "vaq-1ra", "cut"]], ["Vaquillonas", ["vaquillonas"]],
    ["Novillitos", ["novillitos"]], ["Terneros/as", ["terneros"]], ["Toros/Toritos", ["toros", "toritos"]]]
  const iDe = (k: string) => CATEGORIAS_PLANILLA.findIndex(c => c.clave === k)
  for (const [nombre, ks] of GRUPOS) {
    f.push([nombre, ...Array.from({ length: 14 }, (_, i) => ({ t: "n", f: `SUM(${ks.map(k => `${col(i + 1)}${filaDe(k)}`).join(",")})`,
      v: ks.reduce((s, k) => s + (valores[iDe(k)]?.[i] ?? 0), 0) }))])
  }
  const g1 = f.length
  f.push(["TOTAL", ...Array.from({ length: 14 }, (_, i) => ({ t: "n", f: `SUM(${col(i + 1)}${g0}:${col(i + 1)}${g1})`, v: valores.reduce((s, x) => s + x[i], 0) }))])
  marcoDelStock(f, g0 - 1, g1 + 1)
  const rg = g1 + 1
  f.push(["Control", ...Array.from({ length: 14 }, (_, i) => ({ t: "n", f: `${col(i + 1)}${rg}-${col(i + 1)}${t1 + 1}`, v: 0 }))])
  // Control por sexo y total contra SENASA (al cierre), cuando están los datos
  f.push([])
  f.push(["CONTROL CONTRA SENASA AL CIERRE — por sexo y total (SENASA usa otras categorías y se pone al día en las actas de vacunación)"])
  // 🟨 JMS 05/11: la diferencia en amarillo, y al lado un recuadro para escribir a qué se debe.
  const AMARILLO = "FFFF00"
  const rEncS = f.length + 1
  const recuadro = (c: unknown, i: number) => conEstilo(c, { border: { top: GRUESA_N, bottom: GRUESA_N, ...(i === 0 ? { left: GRUESA_N } : {}), ...(i === 4 ? { right: GRUESA_N } : {}) },
    alignment: { vertical: "center", wrapText: true }, font: { italic: true, color: { rgb: "66706F" } } })
  f.push(["", "NZ (cierre)", "SENASA (cierre)", conRelleno("Diferencia", AMARILLO), "", "", "", "", "",
    ...["A qué se debe la diferencia (escribilo acá; por ejemplo, una muerte no informada)", "", "", "", ""].map(recuadro)])
  unirCeldas(f, [`J${rEncS}:N${rEncS}`])
  altoDeFila(f, rEncS, 30)
  const suma = (letra: string, claves: string[]) => claves.map(k => `${letra}${filaDe(k)}`).join("+")
  const hem = CATEGORIAS_PLANILLA.filter(c => HEMBRAS.has(c.clave)).map(c => c.clave)
  const mac = CATEGORIAS_PLANILLA.filter(c => !HEMBRAS.has(c.clave) && c.clave !== "terneros").map(c => c.clave)
  const idx = (k: string) => CATEGORIAS_PLANILLA.findIndex(c => c.clave === k)
  const sumaV = (i: number, ks: string[]) => ks.reduce((s, k) => s + valores[idx(k)][i], 0)
  const sinSenasa = CATEGORIAS_PLANILLA.every(c => v(`cierre.senasa.${c.clave}`) == null)
  for (const [nombre, ks] of [["Hembras (sin terneras al pie)", hem], ["Machos (sin terneros al pie)", mac]] as const) {
    const r = f.length + 1
    const nz = sumaV(9, ks), sn = sumaV(10, ks)
    // SUM y no «+»: una celda sin cargar es texto vacío y la suma con «+» da #¡VALOR!
    f.push([nombre, { t: "n", f: `SUM(${suma("K", ks).replace(/\+/g, ",")})`, v: nz }, { t: "n", f: `SUM(${suma("L", ks).replace(/\+/g, ",")})`, v: sn },
      conRelleno(sinSenasa ? "SENASA sin cargar" : { t: "n", f: `C${r}-B${r}`, v: sn - nz }, AMARILLO)])
  }
  const r = f.length + 1
  const nzT = valores.reduce((s, x) => s + x[9], 0), snT = valores.reduce((s, x) => s + x[10], 0)
  // la banda de TOTAL va a mano: con la diferencia en amarillo, la fila ya no recibe la automática
  const LIN = { style: "thin", color: { rgb: "B9C4C0" } }
  const tot = (c: unknown, fondo = "E3EEEC") => conEstilo(conRelleno(c, fondo), { font: { bold: true }, border: { top: LIN, bottom: { ...LIN, style: "double" } } })
  f.push([tot("TOTAL"), tot({ t: "n", f: `K${t1 + 1}`, v: nzT }), tot({ t: "n", f: `L${t1 + 1}`, v: snT }),
    tot(sinSenasa ? "SENASA sin cargar" : { t: "n", f: `C${r}-B${r}`, v: snT - nzT }, AMARILLO)])
  f.push(["SENASA al cierre se carga a mano en la pantalla del balance (Hacienda → saldos). Una diferencia suele ser una muerte o un nacimiento no informado: se explica, no se fuerza."])
  return f
}

/**
 * 🎨 JMS 05/11 (Papeles v11.03, solapa 02): tres recuadros de borde grueso — INICIO (B–D), Compras y Ventas (I–J) y CIERRE (K–M) —,
 * inicio y cierre en durazno claro y compras/ventas en naranja con negrita. Filas de Excel `rEnc` (encabezado) a `rTot` (TOTAL).
 */
const DURAZNO = "FDE9D9", NARANJA = "E26B0A"
const GRUESA_N = { style: "medium", color: { rgb: "000000" } }
function marcoDelStock(f: unknown[][], rEnc: number, rTot: number) {
  const GRUESA = GRUESA_N
  const cajas: [number, number][] = [[1, 3], [8, 9], [10, 12]]
  for (let r = rEnc; r <= rTot; r++) {
    const fila = f[r - 1]
    for (const [a, b] of cajas) for (let c = a; c <= b; c++) {
      const borde: Record<string, unknown> = {}
      if (c === a) borde.left = GRUESA
      if (c === b) borde.right = GRUESA
      if (r === rEnc) borde.top = GRUESA
      if (r === rTot) borde.bottom = GRUESA
      let celda = conEstilo(fila[c] ?? "", { border: borde })
      if (r > rEnc && r < rTot) celda = c === 8 || c === 9 ? conEstilo(conRelleno(celda, NARANJA), { font: { bold: true } }) : conRelleno(celda, DURAZNO)
      fila[c] = celda
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 💰 EL VALORIZADO — formato del papel 2.2 de JMS
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Los valores de sus papeles al 30/06/25 («- STOCK HACIENDA 2025», 2.2 VALUACIÓN GANADERA), por categoría de la app. */
export const PAPELES_JMS_INICIO_2025 = {
  fecha: "2025-06-30", tc: 1200.5, fuente: "«- STOCK HACIENDA 2025», bloque 2.2 VALUACIÓN GANADERA (papeles de JMS)",
  valor: { "Vaca": 184950000, "Vaquillona Preñada": 85500000, "Vaca CUT/Descarte": 1980000, "Toro": 23870000, "Torito": 13770000,
    "Vaquillona de Reposicion": 25200000, "Ternero Recria": 70290000 } as Record<string, number>,
  /** Los kilos que usó (son los que valúan el inicio en la app). */
  kg: { "Vaca CUT/Descarte": 450, "Vaquillona de Reposicion": 250, "Ternero Recria": 250, "Torito": 300 } as Record<string, number>,
}

const ETIQ: Record<string, string> = {
  "Vaca": "VACAS al parir", "Vaquillona Preñada": "Vqll para 1° PARICIÓN al parir", "Vaca CUT/Descarte": "CUT",
  "Toro": "TOROS", "Torito": "TORITOS 1 AÑO", "Vaquillona de Reposicion": "Vaquillona para reposición",
  "Ternera Recria": "Vaquillona (recría)", "Ternero Recria": "Novillito / ternero para venta",
}
const ORDEN = ["Vaca", "Vaquillona Preñada", "Vaca CUT/Descarte", "Toro", "Torito", "Vaquillona de Reposicion", "Ternera Recria", "Ternero Recria"]
// 🔗 JMS 05/11: el link es la PÁGINA que él abre (vientres.html?desde=…), no la tabla interna (ajax-modulo-…php): mismos datos, con la web.
const MOD: Record<string, string> = { terneras: "terneras", terneros: "terneros", vientres: "vientres", toros: "toros" }
export const URL_MAG = "https://www.mercadoagroganadero.com.ar/dll/hacienda1.dll/haciinfo000502"
/**
 * El link a la cotización en la web original, con el día (o el rango) del dato.
 * ⚠️ Cambió 05/11 (JMS: «el link de las vacas del MAG no me lleva a los precios de esa fecha sino de hoy»): el MAG SÍ acepta la
 * fecha en la dirección (`?txtFECHAINI=dd/mm/aaaa&txtFECHAFIN=dd/mm/aaaa`, la abre con las fechas cargadas). Sin fecha, la página.
 */
export function linkCotizacion(fuente: string, fecha: string): string {
  const [de, ha] = fecha.includes(" a ") ? fecha.split(" a ") : [fecha, fecha]
  if (fuente === "mag") return de ? `${URL_MAG}?txtFECHAINI=${dmy(de)}&txtFECHAFIN=${dmy(ha)}` : URL_MAG
  if (!MOD[fuente]) return URL_MAG
  return `https://www.entresurcosycorralesya.com/${MOD[fuente]}.html?desde=${de}&hasta=${ha}`
}
const round1 = (x: number | null) => (x == null ? "" : Math.round(x * 10) / 10)
const fuenteDe = (origen: string) => {
  const o = origen.toLowerCase()
  return o.startsWith("mag") ? "mag" : o.includes("vientres") ? "vientres" : o.includes("toros") ? "toros" : o.includes("terneras") ? "terneras" : o.includes("terneros") ? "terneros" : ""
}
const fechaDe = (origen: string) => { const m = origen.match(/al (\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : "" }
/** 🔗 Un link discreto: azul y subrayado, como los de la web (JMS 05/11). */
const link = (texto: string, url: string) => ({ t: "s", v: texto, l: { Target: url }, s: { font: { color: { rgb: "0563C1" }, underline: true } } })
/** Una celda con relleno (xlsx-js-style): conserva el valor, la fórmula y el link si los tiene. */
const conEstilo = (c: unknown, estilo: Record<string, unknown>) => {
  const base = c != null && typeof c === "object" ? { ...(c as object) } as Record<string, unknown>
    : { v: c ?? "", t: typeof c === "number" ? "n" : "s" }
  return { ...base, s: { ...((base.s as object) ?? {}), ...estilo } }
}
const conRelleno = (c: unknown, rgb: string) => conEstilo(c, { fill: { patternType: "solid", fgColor: { rgb } } })

/** 💵 JMS 05/11: «siempre diferenciado de color las columnas de dólares de las de pesos» — los dólares en celeste. */
// 🎨 Los colores que puso JMS en su papel (05/11): pesos celeste, dólares verde, precio y link amarillo.
const COLOR_PESOS = "DBEEF4", COLOR_USD = "D7E4BD"
const usd = (c: unknown) => conRelleno(c, COLOR_USD)
const pesos = (c: unknown) => conRelleno(c, COLOR_PESOS)
const LINEA = { style: "thin", color: { rgb: "000000" } }
/** Borde fino en los cuatro lados (la tabla del 2.2 va enmarcada). */
const borde = (c: unknown) => conEstilo(c, { border: { top: LINEA, bottom: LINEA, left: LINEA, right: LINEA } })
const centrado = (c: unknown) => conEstilo(c, { alignment: { horizontal: "center", vertical: "center", wrapText: true } })
/** 👀 Lo que tiene que llamar la atención en la trazabilidad (el precio y su link): fondo ámbar. */
const ojo = (c: unknown) => conRelleno(c, "FFE699")
const enNegrita = (texto: string) => ({ t: "s", v: texto, s: { font: { bold: true } } })

/**
 * 🏷️ JMS 05/11 (en la 02.1): la referencia del precio en cuatro columnas — precio · mercado · categoría · ver en la web. El mercado y
 * la categoría del mercado salen de «de dónde sale el precio» (`MAG · VACAS + 430 · …`, `Entresurcos vientres · Vacas C. Gtia. … · …`).
 */
export function referenciaDelPrecio(origen: string): { mercado: string; categoria: string } {
  const partes = origen.split(" · ")
  const cat = (partes[1] ?? "").replace(/\s*\(pesan [^)]*\)/, "").trim()
  const mayus = cat ? cat[0].toUpperCase() + cat.slice(1) : ""
  if (/^MAG\b/.test(origen)) return { mercado: "Mercado Agroganadero (Cañuelas)", categoria: mayus }
  if (/^Entresurcos\b/.test(origen)) return { mercado: "Entre Surcos y Corrales", categoria: mayus }
  if (origen === "cargado a mano") return { mercado: "cargado a mano", categoria: "" }
  return { mercado: "", categoria: "" }
}

/**
 * Un bloque 2.2 (cierre o inicio): reporte a la izquierda, trazabilidad a la derecha. Devuelve dónde quedó cada renglón.
 * Columnas: A hacienda · B cantidad · C kg · D-F pesos (kg/unidad, por cabeza, stock) · G-I dólares (ídem) · K-Q trazabilidad
 * (K precio · L mercado · M categoría del mercado · N ver en la web — juntas bajo «Referencia» — · O categoría (app) · P criterio · Q factor ·
 * R de dónde sale el precio · S de dónde sale el peso).
 */
function bloque22(f: unknown[][], titulo: string, v: ValuacionHacienda, tc: number, tcOrigen: string, altoTitulo = 30):
  { r0: number; r1: number; rt: number; rtc: number; filaDe: Record<string, number> } {
  f.push([]); f.push(["SAN MANUEL S.R.L."]); f.push([])
  const tit = (c: unknown) => centrado(conEstilo(conRelleno(c, "EEF1F0"), { font: { bold: true } }))
  f.push([tit(titulo), tit(""), tit(""), tit(""), tit(""), tit("VALORIZACIÓN"), tit(""), tit(""), tit("")])
  altoDeFila(f, f.length, altoTitulo)
  f.push([])   // JMS 05/11: una fila entre el título y la tabla
  const rv = f.length + 1
  f.push([borde(conRelleno("Valores de mercado — mismo cálculo de la app", "FFFFFF")), borde(""), borde(""), borde(centrado(pesos("PESOS"))), borde(pesos("")), borde(pesos("")),
    borde(centrado(usd("DÓLARES"))), borde(usd("")), borde(usd("")), conRelleno("", "FFFFFF"),
    borde(centrado(ojo(enNegrita("Referencia")))), borde(ojo("")), borde(ojo("")), borde(ojo("")), ...Array.from({ length: 5 }, () => conRelleno("", "FFFFFF"))])
  unirCeldas(f, [`A${rv}:C${rv}`, `D${rv}:F${rv}`, `G${rv}:I${rv}`, `K${rv}:N${rv}`])
  const enc = (c: unknown) => borde(centrado(c))
  altoDeFila(f, rv + 1, 33.75)   // JMS 05/11 (v11.04): 33,75
  f.push([enc("HACIENDA"), enc("CANTIDAD"), enc("KG"), enc(pesos("VALOR KG/UNIDAD")), enc(pesos("VALOR POR CAB")), enc(pesos("STOCK VALORIZADO")),
    enc(usd("VALOR KG/UNIDAD U$S")), enc(usd("VALOR POR CAB U$S")), enc(usd("STOCK U$S")), "",
    enc(ojo(enNegrita("Precio"))), enc(ojo(enNegrita("Mercado"))), enc(ojo(enNegrita("Categoría"))), enc(ojo(enNegrita("Ver en la web"))),
    enc("Categoría (app)"), enc("Criterio"), enc("Factor"),
    enc("De dónde sale el precio"), enc("De dónde sale el peso")])
  const filas = [...v.filas].sort((a, b) => (ORDEN.indexOf(a.categoria) + 99) % 99 - (ORDEN.indexOf(b.categoria) + 99) % 99)
  const r0 = f.length + 1
  const rtc = r0 + filas.length + 3   // TOTAL, descuento, neto, tipo de cambio (r0 ya cuenta la fila en blanco de arriba)
  const T = `$F$${rtc}`
  const filaDe: Record<string, number> = {}
  for (const x of filas) {
    const r = f.length + 1
    filaDe[x.categoria] = r
    const porKg = x.pesoKg != null
    const conPrecio = x.precioReferencia != null
    const fte = fuenteDe(x.origenPrecio)
    const ref = referenciaDelPrecio(x.origenPrecio)
    const unidad = (x.precioReferencia ?? 0) * x.factor
    // 🎨 JMS 05/11 (v11.04): cantidad, kilos y nombre centrados; la cantidad en negrita y más grande; los kilos sin decimales.
    const medio = (c: unknown, extra: Record<string, unknown> = {}) => conEstilo(c, { alignment: { horizontal: "center", vertical: "center" }, ...extra })
    // 🐄 JMS 05/11 (comentario en la 02.1): lo que se valúa POR CABEZA no lleva «valor kg/unidad» — «no hay que pintarlos, sólo no
    //    llenarlo». El valor por cabeza sale directo del precio (K × factor).
    f.push([medio(ETIQ[x.categoria] ?? x.categoria), medio(x.cabezas, { font: { bold: true, sz: 12 } }), medio(porKg ? { t: "n", v: x.pesoKg, z: "0" } : ""),
      pesos(conPrecio && porKg ? { t: "n", f: `K${r}*Q${r}`, v: unidad } : ""),
      pesos(conPrecio ? { t: "n", f: porKg ? `C${r}*D${r}` : `K${r}*Q${r}`, v: x.valorPorCabeza ?? 0 } : "falta el precio"),
      pesos(conPrecio ? { t: "n", f: `B${r}*E${r}`, v: x.valorTotal ?? 0 } : 0),
      usd(conPrecio ? { t: "n", f: porKg ? `D${r}/${T}` : `K${r}*Q${r}/${T}`, v: unidad / tc } : ""),
      usd(conPrecio ? { t: "n", f: `E${r}/${T}`, v: (x.valorPorCabeza ?? 0) / tc } : ""),
      usd(conPrecio ? { t: "n", f: `F${r}/${T}`, v: (x.valorTotal ?? 0) / tc } : 0), "",
      // 👀 JMS 05/11 (nota en la 02.1): «rearmé el orden de columnas; a estas dos ponerles que visualmente llamen a ser vistas, y
      //    "ver la cotización" en formato link discreto».
      ojo(x.precioReferencia ?? ""), ojo(ref.mercado), centrado(ojo(enNegrita(ref.categoria))),
      ojo(fte ? link("ver la cotización", linkCotizacion(fte, fechaDe(x.origenPrecio))) : ""),
      x.categoria, x.criterio, x.factor, x.origenPrecio, porKg ? x.origenPeso : "se valúa por cabeza"])
    // la tabla enmarcada: borde en el reporte (A–I) y en la trazabilidad (K–Q)
    const fila = f[f.length - 1]
    f[f.length - 1] = fila.map((c, i) => (i === 9 ? c : borde(c)))
    altoDeFila(f, r, 30)
  }
  const r1 = f.length
  const rt = f.length + 1
  altoDeFila(f, rt, 20.25)
  f.push(["TOTAL HACIENDA (a precio de mercado)", { t: "n", f: `SUM(B${r0}:B${r1})`, v: v.cabezas }, "", pesos(""), pesos(""), pesos({ t: "n", f: `SUM(F${r0}:F${r1})`, v: v.valuado }),
    usd(""), usd(""), usd({ t: "n", f: `SUM(I${r0}:I${r1})`, v: v.valuado / tc })])
  // 💰 JMS 05/11: «un descuento de CZ sobre el total del valor del rodeo, 10 % de comercialización total».
  const pct = DESCUENTO_COMERCIALIZACION
  f.push([`Descuento de comercialización (CZ) ${Math.round(pct * 100)} % sobre el total`, "", "", pesos(""), pesos(""), pesos({ t: "n", f: `-F${rt}*${pct}`, v: -(v.descuento ?? Math.round(v.valuado * pct * 100) / 100) }),
    usd(""), usd(""), usd({ t: "n", f: `-I${rt}*${pct}`, v: -v.valuado * pct / tc })])
  const rn = f.length + 1
  f.push(["TOTAL NETO — valor del balance", "", "", pesos(""), pesos(""), pesos({ t: "n", f: `F${rt}+F${rt + 1}`, v: v.neto ?? Math.round(v.valuado * (1 - pct) * 100) / 100 }),
    usd(""), usd(""), usd({ t: "n", f: `I${rt}+I${rt + 1}`, v: v.valuado * (1 - pct) / tc })])
  f.push(["", "", "", "", "Tipo de cambio", tc, tcOrigen])
  if (v.huecos.length) f.push([`⚠️ Sin precio: ${v.huecos.map(h => `${h.categoria} (${h.cabezas} cab.)`).join(", ")} — no se valúan en cero.`])
  return { r0, r1, rt: rn, rtc, filaDe }
}

/** 💵 El precio de un rango de kilos en una tabla de Entresurcos (el que contiene `kg`), a precio máximo como el criterio. */
function precioDelRango(tabla: PrecioMercado[] | undefined, kg: number): { precio: number; fila: PrecioMercado & { fecha?: string } } | null {
  const fila = (tabla ?? []).find(x => x.pesoLo <= kg && (x.pesoHi == null || kg <= x.pesoHi)) as (PrecioMercado & { fecha?: string }) | undefined
  if (!fila) return null
  const precio = fila.kiloMax || fila.promKilo
  return precio > 0 ? { precio, fila } : null
}

export interface DatosValorizado {
  cierre: ValuacionHacienda
  inicio?: ValuacionHacienda | null
  fechaCierre: string
  fechaInicio: string
  tcCierre: number | null
  /** El renglón del balance anterior (la DDJJ del contador) — `APERTURA`. */
  ddjjInicio?: { cuenta: string; denominacion: string; valor: number } | null
  /** 💵 Las tablas de precios (para el ternero liviano 180–200 kg de referencia). */
  tablasCierre?: { macho: PrecioMercado[]; hembra: PrecioMercado[] } | null
  tablasInicio?: { macho: PrecioMercado[]; hembra: PrecioMercado[] } | null
}

/** 💰 La solapa «02.1 Stock valorizado». */
export function hojaStockValorizado(d: DatosValorizado): unknown[][] {
  const f: unknown[][] = [["02.1 — STOCK DE HACIENDA VALORIZADO — cierre e inicio del ejercicio"],
    ["El reporte a la izquierda (formato del papel 2.2); a la derecha, la trazabilidad de cada renglón. Las tablas de precios, con su día y su link, en «02.2 Precios tomados»."]]
  sinCongelar(f)   // JMS 05/11 (comentario en A8): «sacá fijar encabezado»
  const tc = d.tcCierre ?? 1
  const cie = bloque22(f, `2.2) - VALUACIÓN GANADERA (VALORES MERCADO) AL ${dmy(d.fechaCierre)}`, d.cierre, tc, d.tcCierre ? "BNA divisa comprador del cierre" : "⚠️ sin tipo de cambio del cierre")
  if (!d.inicio) {
    f.push([]); f.push(["⚠️ El inicio no se pudo valuar (no se leyeron los precios de esa fecha)."])
    return f
  }
  const p = PAPELES_JMS_INICIO_2025
  // 🎨 JMS 05/11: el título del inicio, como en su papel — «VALUACIÓN ANTERIOR» y el año abajo.
  const ini = bloque22(f, `2.2) - VALUACIÓN ANTERIOR\n--((${d.fechaInicio.slice(0, 4)}))--`, d.inicio, p.tc, "el de los papeles de JMS 2025 (TC prom div)", 36)
  f.push([]); f.push(["LOS TRES VALORES DEL INICIO", "", "", "", "", "PESOS", "Dif. con la app"])
  const a = f.length + 1
  const papeles = Object.values(p.valor).reduce((s, x) => s + x, 0)
  const netoIni = d.inicio.neto ?? d.inicio.valuado
  f.push(["App (mismo cálculo que el cierre, neto del 10 %)", "", "", "", "", { t: "n", f: `F${ini.rt}`, v: netoIni }, { t: "n", f: `F${a}-F${a}`, v: 0 }])
  f.push([`Papeles de JMS ${dmy(p.fecha)} — ${p.fuente}`, "", "", "", "", papeles, { t: "n", f: `F${a + 1}-F${a}`, v: papeles - netoIni }])
  if (d.ddjjInicio) f.push([`DDJJ — balance del contador: ${d.ddjjInicio.cuenta} «${d.ddjjInicio.denominacion}» (sin apertura)`, "", "", "", "", d.ddjjInicio.valor,
    { t: "n", f: `F${a + 2}-F${a}`, v: d.ddjjInicio.valor - netoIni }])
  f.push([]); altoDeFila(f, f.length + 1, 75); f.push([`CATEGORÍA POR CATEGORÍA AL ${dmy(d.fechaInicio)} (cierre anterior = inicio de este ejercicio) — app (a precio de mercado, antes del 10 %) contra los papeles de JMS`, "", "", "", "", "App", "Papeles", "", "Diferencia"])
  for (let r = ini.r0; r <= ini.r1; r++) {
    const fila = f[r - 1] as unknown[]
    const c14 = fila[14] as { v?: unknown } | string | undefined   // la celda viene enmarcada (objeto con estilo)
    const cat = String((typeof c14 === "object" ? c14?.v : c14) ?? "")
    const rr = f.length + 1
    f.push([fila[0], "", "", "", "", { t: "n", f: `F${r}`, v: 0 }, p.valor[cat] ?? 0, "", { t: "n", f: `F${rr}-G${rr}`, v: 0 }])
  }
  variacionDePrecios(f, d, cie, ini)
  return f
}

/**
 * 📈 JMS 05/11 (en la 02.1): «agregar variación de valores en pesos y en dólares de las categorías. Vaca por cabeza, novillo por
 * precio del kg (más allá de cuánto pesa) — para los terneros, de 180 a 200 kg como referencia del liviano, además de la que tenemos».
 * Inicio contra cierre del precio por unidad (columna «VALOR KG/UNIDAD» de cada bloque), con fórmula, en pesos y en dólares.
 */
function variacionDePrecios(f: unknown[][], d: DatosValorizado, cie: ReturnType<typeof bloque22>, ini: ReturnType<typeof bloque22>) {
  f.push([]); f.push([`VARIACIÓN DE PRECIOS POR CATEGORÍA — entre el cierre anterior (${dmy(d.fechaInicio)}) y este cierre (${dmy(d.fechaCierre)}) — por cabeza lo que se valúa por cabeza; por kilo la recría, sin importar cuánto pese`])
  altoDeFila(f, f.length + 1, 75)   // JMS 05/11 (v11.04)
  f.push(["Categoría", "Unidad", pesos(`Cierre anterior ${dmy(d.fechaInicio)} $`), pesos(`Este cierre ${dmy(d.fechaCierre)} $`), pesos("Variación $"), pesos("Variación %"),
    usd(`Cierre anterior U$S`), usd(`Este cierre U$S`), usd("Variación U$S"), usd("Variación %")])
  const Ti = `$F$${ini.rtc}`, Tc = `$F$${cie.rtc}`
  const ti = PAPELES_JMS_INICIO_2025.tc, tc = d.tcCierre ?? 1
  const pct = (a: number, b: number) => (a ? b / a - 1 : 0)
  /** `ci`/`cc`: el precio por unidad en pesos al inicio y al cierre (valor), y de dónde sale (fórmula o nada). */
  const renglon = (nombre: string, unidad: string, ci: { v: number; f?: string }, cc: { v: number; f?: string }) => {
    const r = f.length + 1
    const ui = ci.v / ti, uc = cc.v / tc
    f.push([nombre, unidad, pesos(ci.f ? { t: "n", f: ci.f, v: ci.v } : ci.v), pesos(cc.f ? { t: "n", f: cc.f, v: cc.v } : cc.v),
      pesos({ t: "n", f: `D${r}-C${r}`, v: cc.v - ci.v }), pesos({ t: "n", f: `IF(C${r}=0,0,D${r}/C${r}-1)`, v: pct(ci.v, cc.v), z: "0.0%" }),
      usd({ t: "n", f: `C${r}/${Ti}`, v: ui }), usd({ t: "n", f: `D${r}/${Tc}`, v: uc }), usd({ t: "n", f: `H${r}-G${r}`, v: uc - ui }),
      usd({ t: "n", f: `IF(G${r}=0,0,H${r}/G${r}-1)`, v: pct(ui, uc), z: "0.0%" })])
  }
  for (const cat of ORDEN) {
    const ri = ini.filaDe[cat], rc = cie.filaDe[cat]
    const fc = d.cierre.filas.find(x => x.categoria === cat), fi = d.inicio?.filas.find(x => x.categoria === cat)
    if (!ri || !rc || fc?.precioReferencia == null || fi?.precioReferencia == null) {
      if (ri || rc) f.push([ETIQ[cat] ?? cat, "—", ri ? "" : "no había al inicio", rc ? "" : "no hay al cierre"])
      continue
    }
    // por cabeza: la columna «valor por cabeza» (E), porque «valor kg/unidad» (D) va vacía; por kilo: D.
    const cI = fi.pesoKg != null ? "D" : "E", cC = fc.pesoKg != null ? "D" : "E"
    renglon(ETIQ[cat] ?? cat, fc.pesoKg != null ? "por kg" : "por cabeza",
      { v: fi.precioReferencia * fi.factor, f: `${cI}${ri}` }, { v: fc.precioReferencia * fc.factor, f: `${cC}${rc}` })
  }
  // 🐂 El liviano de referencia: 180–200 kg, a precio máximo como el criterio.
  for (const [sexo, nombre] of [["macho", "Ternero liviano 180–200 kg (referencia)"]] as const) {
    const pi = precioDelRango(d.tablasInicio?.[sexo], 190), pc = precioDelRango(d.tablasCierre?.[sexo], 190)
    if (pi && pc) renglon(nombre, `por kg · ${pi.fila.categoria}`, { v: pi.precio }, { v: pc.precio })
    else f.push([nombre, "—", pi ? "" : "sin dato al inicio", pc ? "" : "sin dato al cierre"])
  }
  f.push([`El tipo de cambio de cada punta es el de su bloque (inicio F${ini.rtc} · cierre F${cie.rtc}).`])
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 📈 02.10 — CUÁNTO AUMENTÓ EL RODEO, EN DÓLARES — JMS 05/11: «teniendo dólares contra dólares, ver cuánto aumenta el valor del
// rodeo de cría y de recría aparte… en dólares y en kg o cantidad: tanto en aumento de vientres, tanto en aumento de kg de recría
// (x cabezas de tal peso)».
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Cría = los vientres, los toros y la CUT; recría = lo que se está criando (terneras, novillitos, toritos, vaquillonas de reposición). */
export const GRUPO_RODEO: Record<string, "Cría" | "Recría"> = {
  "Vaca": "Cría", "Vaquillona Preñada": "Cría", "Toro": "Cría", "Vaca CUT/Descarte": "Cría",
  "Ternera Recria": "Recría", "Ternero Recria": "Recría", "Torito": "Recría", "Vaquillona de Reposicion": "Recría",
}
const VIENTRES = ["Vaca", "Vaquillona Preñada"]

/**
 * 📈 La solapa «02.10 Aumento del rodeo U$S». Por categoría, a precio de mercado (antes del 10 %, que es el mismo en las dos
 * puntas), dólares del inicio contra dólares del cierre, y el aumento abierto en dos con fórmula:
 * **por cantidad** (más cabezas en cría, más kilos en recría, al precio del inicio) y **por precio** (lo que cambió el precio en
 * dólares, sobre la cantidad del cierre). El control: las dos partes suman el aumento.
 */
export function hojaAumentoRodeo(d: DatosValorizado): unknown[][] {
  const ti = PAPELES_JMS_INICIO_2025.tc, tc = d.tcCierre ?? 1
  const f: unknown[][] = [["02.10 — CUÁNTO AUMENTÓ EL RODEO, EN DÓLARES — cría y recría aparte"],
    ["Dólares del inicio contra dólares del cierre, a precio de mercado (antes del 10 % de comercialización, que es igual en las dos puntas). Cría se mide en cabezas; la recría, en kilos (cabezas × peso)."],
    ["Aumento = por cantidad (Δ cabezas o Δ kilos × precio U$S del inicio) + por precio (Δ precio U$S × cantidad del cierre)."],
    ["Tipo de cambio inicio", ti, "papeles de JMS 2025 (TC prom div)"],
    ["Tipo de cambio cierre", tc, d.tcCierre ? "BNA divisa comprador del cierre" : "⚠️ sin tipo de cambio del cierre"],
    []]
  sinCongelar(f)   // JMS 05/11 (v11.04, comentario en H1): «movilizar paneles»
  if (!d.inicio) { f.push(["⚠️ El inicio no se pudo valuar: no hay contra qué comparar."]); return f }
  const enc = ["Categoría", "Unidad", "Cabezas inicio", "Cabezas cierre", "Kg/cab inicio", "Kg/cab cierre", "Cantidad inicio", "Cantidad cierre", "Δ cantidad",
    usd("Precio U$S inicio"), usd("Precio U$S cierre"), usd("Valor U$S inicio"), usd("Valor U$S cierre"), usd("AUMENTO U$S"), usd("por cantidad"), usd("por precio"), "Control"]
  const totales: Record<string, number[]> = {}
  const resumen: unknown[][] = []
  for (const grupo of ["Cría", "Recría"] as const) {
    const cats = ORDEN.filter(c => GRUPO_RODEO[c] === grupo && (d.inicio!.filas.some(x => x.categoria === c) || d.cierre.filas.some(x => x.categoria === c)))
    f.push([`RODEO DE ${grupo.toUpperCase()}`]); f.push(enc); altoDeFila(f, f.length, 30)
    const r0 = f.length + 1
    for (const cat of cats) {
      const fi = d.inicio.filas.find(x => x.categoria === cat), fc = d.cierre.filas.find(x => x.categoria === cat)
      const porKg = (fc ?? fi)!.pesoKg != null
      const unidadDe = (x: typeof fi) => (x?.precioReferencia != null ? x.precioReferencia * x.factor : null)
      const pi = unidadDe(fi), pc = unidadDe(fc)
      const r = f.length + 1
      const r2 = (x: number) => Math.round(x * 100) / 100
      // Precio que falta en una punta: el MISMO precio en dólares de la otra (la categoría que aparece o desaparece queda toda «por cantidad»).
      const uI = pi != null ? r2(pi) / ti : null, uC = pc != null ? r2(pc) / tc : null
      const puI = uI ?? uC ?? 0, puC = uC ?? uI ?? 0
      const cabI = fi?.cabezas ?? 0, cabC = fc?.cabezas ?? 0, kgI = fi?.pesoKg ?? 0, kgC = fc?.pesoKg ?? 0
      const qI = porKg ? cabI * kgI : cabI, qC = porKg ? cabC * kgC : cabC
      f.push([ETIQ[cat] ?? cat, porKg ? "kilos" : "cabezas", cabI, cabC, porKg ? kgI : "", porKg ? kgC : "",
        { t: "n", f: porKg ? `C${r}*E${r}` : `C${r}`, v: qI }, { t: "n", f: porKg ? `D${r}*F${r}` : `D${r}`, v: qC }, { t: "n", f: `H${r}-G${r}`, v: qC - qI },
        usd({ t: "n", f: pi != null ? `${r2(pi)}/$B$4` : `K${r}`, v: puI }), usd({ t: "n", f: pc != null ? `${r2(pc)}/$B$5` : `J${r}`, v: puC }),
        usd({ t: "n", f: `G${r}*J${r}`, v: qI * puI }), usd({ t: "n", f: `H${r}*K${r}`, v: qC * puC }), usd({ t: "n", f: `M${r}-L${r}`, v: qC * puC - qI * puI }),
        usd({ t: "n", f: `I${r}*J${r}`, v: (qC - qI) * puI }), usd({ t: "n", f: `(K${r}-J${r})*H${r}`, v: (puC - puI) * qC }),
        { t: "n", f: `ROUND(N${r}-O${r}-P${r},2)`, v: 0 }])
    }
    const r1 = f.length, rt = f.length + 1
    const sum = (col: string) => ({ t: "n", f: `SUM(${col}${r0}:${col}${r1})` })
    const val = (i: number) => (f.slice(r0 - 1, r1) as unknown[][]).reduce((a, row) => a + (Number((row[i] as { v?: number })?.v ?? row[i]) || 0), 0)
    const v = [2, 3, 11, 12, 13, 14, 15].map(val)
    f.push([`TOTAL ${grupo.toUpperCase()}`, "", { ...sum("C"), v: v[0] }, { ...sum("D"), v: v[1] }, "", "", "", "", "", usd(""), usd(""),
      usd({ ...sum("L"), v: v[2] }), usd({ ...sum("M"), v: v[3] }), usd({ ...sum("N"), v: v[4] }), usd({ ...sum("O"), v: v[5] }), usd({ ...sum("P"), v: v[6] }),
      { t: "n", f: `ROUND(N${rt}-O${rt}-P${rt},2)`, v: 0 }])
    totales[grupo] = [rt, v[4], v[5], v[6]]
    // La lectura en una línea: vientres (cría) y kilos (recría).
    if (grupo === "Cría") {
      const filasV = cats.map((c, k) => (VIENTRES.includes(c) ? r0 + k : 0)).filter(Boolean)
      const vi = filasV.reduce((a, r) => a + Number(f[r - 1][2]), 0), vc = filasV.reduce((a, r) => a + Number(f[r - 1][3]), 0)
      resumen.push(["Cría — vientres (vacas + vaquillonas preñadas)", "cabezas",
        { t: "n", f: filasV.map(r => `C${r}`).join("+") || "0", v: vi }, { t: "n", f: filasV.map(r => `D${r}`).join("+") || "0", v: vc },
        { t: "n", f: `${filasV.map(r => `D${r}`).join("+") || "0"}-(${filasV.map(r => `C${r}`).join("+") || "0"})`, v: vc - vi }, "",
        usd({ t: "n", f: `N${rt}`, v: v[4] }), usd({ t: "n", f: `O${rt}`, v: v[5] }), usd({ t: "n", f: `P${rt}`, v: v[6] })])
    } else {
      const kI = (f.slice(r0 - 1, r1) as unknown[][]).reduce((a, row) => a + (Number((row[6] as { v?: number })?.v) || 0), 0)
      const kC = (f.slice(r0 - 1, r1) as unknown[][]).reduce((a, row) => a + (Number((row[7] as { v?: number })?.v) || 0), 0)
      // 🐂 JMS 05/11 (comentario en E26): «recría también se debe expresar en cantidades × kg promedio, además de mantener el total de kg».
      resumen.push(["Recría — cabezas", "cabezas", { t: "n", f: `SUM(C${r0}:C${r1})`, v: v[0] }, { t: "n", f: `SUM(D${r0}:D${r1})`, v: v[1] },
        { t: "n", f: `SUM(D${r0}:D${r1})-SUM(C${r0}:C${r1})`, v: v[1] - v[0] }])
      resumen.push(["Recría — kg promedio por cabeza", "kg/cab", { t: "n", f: `IF(SUM(C${r0}:C${r1})=0,0,SUM(G${r0}:G${r1})/SUM(C${r0}:C${r1}))`, v: v[0] ? kI / v[0] : 0, z: "0" },
        { t: "n", f: `IF(SUM(D${r0}:D${r1})=0,0,SUM(H${r0}:H${r1})/SUM(D${r0}:D${r1}))`, v: v[1] ? kC / v[1] : 0, z: "0" },
        { t: "n", f: `IF(SUM(D${r0}:D${r1})=0,0,SUM(H${r0}:H${r1})/SUM(D${r0}:D${r1}))-IF(SUM(C${r0}:C${r1})=0,0,SUM(G${r0}:G${r1})/SUM(C${r0}:C${r1}))`,
          v: (v[1] ? kC / v[1] : 0) - (v[0] ? kI / v[0] : 0), z: "0" }])
      resumen.push(["Recría — kilos (cabezas × peso)", "kilos", { t: "n", f: `SUM(G${r0}:G${r1})`, v: kI }, { t: "n", f: `SUM(H${r0}:H${r1})`, v: kC },
        { t: "n", f: `SUM(H${r0}:H${r1})-SUM(G${r0}:G${r1})`, v: kC - kI }, "",
        usd({ t: "n", f: `N${rt}`, v: v[4] }), usd({ t: "n", f: `O${rt}`, v: v[5] }), usd({ t: "n", f: `P${rt}`, v: v[6] })])
    }
    f.push([])
  }
  const rc = totales["Cría"][0], rr = totales["Recría"][0]
  f.push(["EN RESUMEN"])
  f.push(["", "Unidad", "Inicio", "Cierre", "Aumento", "", usd("AUMENTO U$S"), usd("por cantidad"), usd("por precio")]); altoDeFila(f, f.length, 30)
  for (const x of resumen) f.push(x)
  const [, nC, oC, pC] = totales["Cría"], [, nR, oR, pR] = totales["Recría"]
  f.push(["TOTAL RODEO", "", "", "", "", "", usd({ t: "n", f: `N${rc}+N${rr}`, v: nC + nR }), usd({ t: "n", f: `O${rc}+O${rr}`, v: oC + oR }), usd({ t: "n", f: `P${rc}+P${rr}`, v: pC + pR })])
  return f
}

type Tablas = { mag: Array<PrecioMag>; hembra: Array<PrecioMercado>; macho: Array<PrecioMercado>; vientres: Array<PrecioCabeza>; toros: Array<PrecioCabeza> }

/** 💰 La solapa «02.2 Precios tomados»: cada fuente con el día de cada precio, lo usado y lo de otro día marcados, con link. */
export function hojaPreciosTomados(momentos: Array<{ titulo: string; tablas: Tablas | null | undefined; valuacion: ValuacionHacienda | null | undefined }>): unknown[][] {
  const f: unknown[][] = [["02.2 — PRECIOS TOMADOS — lo que se usó para valuar, fuente por fuente, con el día de cada precio y el link a la web original"],
    ["«Usado» (en amarillo): el renglón que toma la valuación. «Otro día» (en rojo): sale de un día distinto al del resto de su tabla (esa categoría no se operó y se buscó hacia atrás)."]]
  const NOMBRE: Record<string, string> = { vientres: "Entresurcos — vientres (por cabeza)", toros: "Entresurcos — toros (por cabeza)",
    hembra: "Entresurcos — terneras (por kilo)", macho: "Entresurcos — terneros (por kilo)", mag: "Cañuelas (MAG) — vacas" }
  const FTE: Record<string, string> = { vientres: "vientres", toros: "toros", hembra: "terneras", macho: "terneros", mag: "mag" }
  for (const m of momentos) {
    f.push([]); f.push([m.titulo])
    if (!m.tablas) { f.push(["(no se leyeron los precios)"]); continue }
    const usados = (m.valuacion?.filas ?? []).map(x => x.origenPrecio).join(" ")
    for (const k of ["vientres", "toros", "hembra", "macho", "mag"] as const) {
      const filas = (m.tablas[k] ?? []) as unknown as Array<Record<string, unknown> & { fecha?: string }>
      f.push([]); f.push([NOMBRE[k]])
      if (!filas.length) { f.push(["(sin datos en el período buscado)"]); continue }
      const cuenta = new Map<string, number>()
      for (const x of filas) cuenta.set(String(x.fecha ?? ""), (cuenta.get(String(x.fecha ?? "")) ?? 0) + 1)
      const comun = [...cuenta].sort((a, b) => b[1] - a[1])[0][0]
      const enc = k === "mag" ? ["Categoría", "Calidad", "Corte", "Promedio", "Máximo"]
        : k === "vientres" || k === "toros" ? ["Categoría", "Cabezas", "Promedio", "Máximo", "Mínimo"] : ["Categoría", "Kg desde", "Kg hasta", "$/kg promedio", "$/kg máximo"]
      f.push([...enc, "Día del dato", "¿Usado?", "¿Otro día?", "Ver en la web"])
      altoDeFila(f, f.length, 30)   // JMS 05/11: encabezados más altos
      for (const x of [...filas].sort((a, b) => String(a.categoria ?? a.familia).localeCompare(String(b.categoria ?? b.familia)))) {
        const vals = k === "mag" ? [x.familia, x.calidad, x.corte, x.promedio, x.maximo]
          : k === "vientres" || k === "toros" ? [x.categoria, x.cantidad, x.promedio, x.maximo, x.minimo] : [x.categoria, x.pesoLo, x.pesoHi, x.promKilo, x.kiloMax]
        const usado = k === "mag" ? x.familia === "VACAS" && String(x.corte ?? "").replace(/\s/g, "") === "+430" && usados.includes("MAG")
          : k === "vientres" || k === "toros" ? usados.includes(String(x.categoria))
          : usados.includes(`${k === "hembra" ? "terneras" : "terneros"} ${x.pesoLo}-${x.pesoHi ?? "+"}`)
        const fe = String(x.fecha ?? "")
        // 🟨 JMS 05/11: lo usado, el renglón entero en AMARILLO; el «otro día», en rojo y negrita («usar así, amarillo, como te pongo»).
        const otro = fe !== comun ? conEstilo(`SÍ — ${fe}`, { font: { bold: true, color: { rgb: "FF0000" } } }) : ""
        const fila: unknown[] = [...vals, fe, usado ? "USADO" : "", otro, link("ver", linkCotizacion(FTE[k], fe))]
        f.push(usado ? fila.map(c => conRelleno(c, "FFFF00")) : fila)
      }
    }
  }
  return f
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// ⚖️ CÓMO SE CALCULARON LOS KILOS — JMS 05/11: «no está el detalle de cómo se calculó los kg… para los kg de novillos, etc.»
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚖️ «02.9 Calculo de los kilos»: por categoría, animal por animal — la pesada de antes y la de después del cierre, y el peso al
 * cierre (interpolado con fórmula), o la ganancia medida si no hay pesada después. El promedio es el peso que usa la valuación.
 */
export function hojaCalculoKilos(pesos: PesoCategoria[], fechaCierre: string): unknown[][] {
  const f: unknown[][] = [[`02.9 — CÓMO SE CALCULARON LOS KILOS AL ${dmy(fechaCierre)}`],
    ["Animal por animal: peso al cierre = pesada de antes + (pesada de después − pesada de antes) × días hasta el cierre ÷ días entre las dos. Sin pesada después: la de antes + la ganancia diaria medida × los días."],
    ["El promedio de cada categoría es el peso que usa «02.1 Stock valorizado»."]]
  /**
   * 📋 JMS 05/11 (en la 02.9): «acá poner promedio pesada anterior, pesada actual, promedio aumento entre pesadas, etc. — es un
   * reporte todo esto». El resumen por categoría va ARRIBA, y abajo el detalle animal por animal que lo respalda.
   */
  const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const masComun = (xs: string[]) => { const m = new Map<string, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]).map(([k]) => dmy(k)).slice(0, 2).join(", ") }
  f.push([]); f.push(["RESUMEN POR CATEGORÍA"])
  altoDeFila(f, f.length + 1, 60)   // JMS 05/11 (v11.04)
  f.push(["Categoría", "Animales", "Pesada antes: fecha", "kg promedio", "Pesada después: fecha", "kg promedio", "Aumento entre pesadas (kg)", "Ganancia diaria (kg/día)", "KG AL CIERRE (promedio)", "Peso que usa la valuación"])
  for (const c of pesos) {
    const det = c.detalle ?? [], con = det.filter(x => x.despues)
    const dEntre = (x: (typeof det)[number]) => Math.round((Date.parse(x.despues!.fecha) - Date.parse(x.antes.fecha)) / 86_400_000)
    f.push([c.categoria, det.length || c.animales, masComun(det.map(x => x.antes.fecha)), round1(prom(det.map(x => x.antes.kg))),
      con.length ? masComun(con.map(x => x.despues!.fecha)) : "sin pesada después", con.length ? round1(prom(con.map(x => x.despues!.kg))) : "",
      con.length ? round1(prom(con.map(x => x.despues!.kg - x.antes.kg))) : "",
      con.length ? Math.round((prom(con.map(x => (x.despues!.kg - x.antes.kg) / Math.max(1, dEntre(x)))) ?? 0) * 1000) / 1000 : (c.gananciaMedida ?? ""),
      round1(prom(det.map(x => x.kgAlCierre))), c.pesoProyectado])
  }
  for (const c of pesos) {
    f.push([]); f.push([`${c.categoria} — ${c.animales} animal(es) · ${c.origen}`])
    altoDeFila(f, f.length + 1, 45)
    f.push(["Caravana / animal", "Pesada antes: fecha", "kg", "Pesada después: fecha", "kg", "Días hasta el cierre", "Días entre pesadas", "KG AL CIERRE", "Cómo",
      "Aumento entre pesadas (kg)", "Ganancia diaria (kg/día)"])
    const d0 = f.length + 1
    for (const x of c.detalle ?? []) {
      const r = f.length + 1
      const dAntes = Math.round((Date.parse(fechaCierre) - Date.parse(x.antes.fecha)) / 86_400_000)
      const dEntre = x.despues ? Math.round((Date.parse(x.despues.fecha) - Date.parse(x.antes.fecha)) / 86_400_000) : ""
      const kg = x.metodo === "interpolado" ? { t: "n", f: `C${r}+(E${r}-C${r})*F${r}/G${r}`, v: x.kgAlCierre }
        : x.metodo === "ganancia medida" ? { t: "n", f: `C${r}+${c.gananciaMedida ?? 0}*F${r}`, v: x.kgAlCierre } : x.kgAlCierre
      f.push([x.caravana ?? x.animalId, x.antes.fecha, x.antes.kg, x.despues?.fecha ?? "", x.despues?.kg ?? "", dAntes, dEntre, kg,
        x.metodo === "ganancia medida" ? `sin pesada después: + ${c.gananciaMedida} kg/día medidos` : x.metodo,
        x.despues ? { t: "n", f: `E${r}-C${r}`, v: x.despues.kg - x.antes.kg } : "",
        x.despues && dEntre ? { t: "n", f: `J${r}/G${r}`, v: (x.despues.kg - x.antes.kg) / Number(dEntre) } : ""])
    }
    const d1 = f.length
    const rp = f.length + 1
    f.push(["PROMEDIO", "", { t: "n", f: `AVERAGE(C${d0}:C${d1})`, v: prom((c.detalle ?? []).map(x => x.antes.kg)) ?? 0 }, "",
      (c.detalle ?? []).some(x => x.despues) ? { t: "n", f: `AVERAGE(E${d0}:E${d1})`, v: prom((c.detalle ?? []).filter(x => x.despues).map(x => x.despues!.kg)) ?? 0 } : "",
      "", "", { t: "n", f: `AVERAGE(H${d0}:H${d1})`, v: c.pesoProyectado }, "",
      (c.detalle ?? []).some(x => x.despues) ? { t: "n", f: `AVERAGE(J${d0}:J${d1})`, v: prom((c.detalle ?? []).filter(x => x.despues).map(x => x.despues!.kg - x.antes.kg)) ?? 0 } : "",
      (c.detalle ?? []).some(x => x.despues) ? { t: "n", f: `AVERAGE(K${d0}:K${d1})` } : ""])
    f.push(["Peso que usa la valuación", "", "", "", "", "", "", c.pesoProyectado])
    f.push(["Diferencia (tiene que dar 0, por redondeo ±0,05)", "", "", "", "", "", "", { t: "n", f: `ROUND(H${rp},1)-H${rp + 1}`, v: 0 }])
  }
  if (!pesos.length) f.push([], ["No hay pesadas: las categorías que van por kilo usan el estimado del criterio (por ejemplo CUT 500 kg)."])
  return f
}
