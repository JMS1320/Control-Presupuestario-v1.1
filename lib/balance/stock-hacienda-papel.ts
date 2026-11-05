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
  // Control por sexo y total contra SENASA (al cierre), cuando están los datos
  f.push([])
  f.push(["CONTROL CONTRA SENASA AL CIERRE — por sexo y total (SENASA usa otras categorías y se pone al día en las actas de vacunación)"])
  f.push(["", "NZ (cierre)", "SENASA (cierre)", "Diferencia"])
  const filaDe = (clave: string) => t0 + CATEGORIAS_PLANILLA.findIndex(c => c.clave === clave)
  const suma = (letra: string, claves: string[]) => claves.map(k => `${letra}${filaDe(k)}`).join("+")
  const hem = CATEGORIAS_PLANILLA.filter(c => HEMBRAS.has(c.clave)).map(c => c.clave)
  const mac = CATEGORIAS_PLANILLA.filter(c => !HEMBRAS.has(c.clave) && c.clave !== "terneros").map(c => c.clave)
  const idx = (k: string) => CATEGORIAS_PLANILLA.findIndex(c => c.clave === k)
  const sumaV = (i: number, ks: string[]) => ks.reduce((s, k) => s + valores[idx(k)][i], 0)
  for (const [nombre, ks] of [["Hembras (sin terneras al pie)", hem], ["Machos (sin terneros al pie)", mac]] as const) {
    const r = f.length + 1
    const nz = sumaV(9, ks), sn = sumaV(10, ks)
    f.push([nombre, { t: "n", f: suma("K", ks), v: nz }, { t: "n", f: suma("L", ks), v: sn }, { t: "n", f: `C${r}-B${r}`, v: sn - nz }])
  }
  const r = f.length + 1
  const nzT = valores.reduce((s, x) => s + x[9], 0), snT = valores.reduce((s, x) => s + x[10], 0)
  f.push(["TOTAL", { t: "n", f: `K${t1 + 1}`, v: nzT }, { t: "n", f: `L${t1 + 1}`, v: snT }, { t: "n", f: `C${r}-B${r}`, v: snT - nzT }])
  f.push(["SENASA al cierre se carga a mano en la pantalla del balance (Hacienda → saldos). Una diferencia suele ser una muerte o un nacimiento no informado: se explica, no se fuerza."])
  return f
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
/** El link a la cotización en la web original: Entresurcos con el día (o el rango) del dato; Cañuelas, la página. */
export function linkCotizacion(fuente: string, fecha: string): string {
  if (fuente === "mag" || !MOD[fuente]) return URL_MAG
  const [de, ha] = fecha.includes(" a ") ? fecha.split(" a ") : [fecha, fecha]
  return `https://www.entresurcosycorralesya.com/${MOD[fuente]}.html?desde=${de}&hasta=${ha}`
}
const fuenteDe = (origen: string) => {
  const o = origen.toLowerCase()
  return o.startsWith("mag") ? "mag" : o.includes("vientres") ? "vientres" : o.includes("toros") ? "toros" : o.includes("terneras") ? "terneras" : o.includes("terneros") ? "terneros" : ""
}
const fechaDe = (origen: string) => { const m = origen.match(/al (\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : "" }
const link = (texto: string, url: string) => ({ t: "s", v: texto, l: { Target: url } })
/** Una celda con relleno (xlsx-js-style): conserva el valor, la fórmula y el link si los tiene. */
const conRelleno = (c: unknown, rgb: string) => {
  const base = c != null && typeof c === "object" ? { ...(c as object) } as Record<string, unknown>
    : { v: c ?? "", t: typeof c === "number" ? "n" : "s" }
  return { ...base, s: { ...((base.s as object) ?? {}), fill: { patternType: "solid", fgColor: { rgb } } } }
}

/** Un bloque 2.2 (cierre o inicio): reporte a la izquierda, trazabilidad a la derecha. Devuelve dónde quedó el total. */
function bloque22(f: unknown[][], titulo: string, v: ValuacionHacienda, tc: number, tcOrigen: string): { r0: number; r1: number; rt: number } {
  f.push([]); f.push(["SAN MANUEL S.R.L."]); f.push([])
  f.push([titulo, "", "", "", "", "VALORIZACIÓN"])
  f.push(["Valores de mercado — mismo cálculo de la app", "", "", "", "", "PESOS", "DÓLARES"])
  f.push(["HACIENDA", "CANTIDAD", "KG", "VALOR KG/UNIDAD", "VALOR POR CAB", "STOCK VALORIZADO", "U$S", "",
    "Categoría (app)", "Criterio", "Precio de referencia", "Factor", "De dónde sale el precio", "Ver en la web", "De dónde sale el peso"])
  const filas = [...v.filas].sort((a, b) => (ORDEN.indexOf(a.categoria) + 99) % 99 - (ORDEN.indexOf(b.categoria) + 99) % 99)
  const r0 = f.length + 1
  for (const x of filas) {
    const r = f.length + 1
    const porKg = x.pesoKg != null
    const conPrecio = x.precioReferencia != null
    const fte = fuenteDe(x.origenPrecio)
    f.push([ETIQ[x.categoria] ?? x.categoria, x.cabezas, porKg ? x.pesoKg : "",
      conPrecio ? { t: "n", f: `K${r}*L${r}`, v: (x.precioReferencia ?? 0) * x.factor } : "",
      conPrecio ? { t: "n", f: porKg ? `C${r}*D${r}` : `D${r}`, v: x.valorPorCabeza ?? 0 } : "falta el precio",
      conPrecio ? { t: "n", f: `B${r}*E${r}`, v: x.valorTotal ?? 0 } : 0,
      conPrecio ? { t: "n", f: `F${r}/${tc}`, v: (x.valorTotal ?? 0) / tc } : 0, "",
      x.categoria, x.criterio, x.precioReferencia ?? "", x.factor, x.origenPrecio,
      fte ? link("ver la cotización", linkCotizacion(fte, fechaDe(x.origenPrecio))) : "", porKg ? x.origenPeso : "se valúa por cabeza"])
  }
  const r1 = f.length
  const rt = f.length + 1
  f.push(["TOTAL HACIENDA (a precio de mercado)", { t: "n", f: `SUM(B${r0}:B${r1})`, v: v.cabezas }, "", "", "", { t: "n", f: `SUM(F${r0}:F${r1})`, v: v.valuado },
    { t: "n", f: `SUM(G${r0}:G${r1})`, v: v.valuado / tc }])
  // 💰 JMS 05/11: «un descuento de CZ sobre el total del valor del rodeo, 10 % de comercialización total».
  const pct = DESCUENTO_COMERCIALIZACION
  f.push([`Descuento de comercialización (CZ) ${Math.round(pct * 100)} % sobre el total`, "", "", "", "", { t: "n", f: `-F${rt}*${pct}`, v: -(v.descuento ?? Math.round(v.valuado * pct * 100) / 100) },
    { t: "n", f: `-G${rt}*${pct}`, v: -v.valuado * pct / tc }])
  const rn = f.length + 1
  f.push(["TOTAL NETO — valor del balance", "", "", "", "", { t: "n", f: `F${rt}+F${rt + 1}`, v: v.neto ?? Math.round(v.valuado * (1 - pct) * 100) / 100 },
    { t: "n", f: `G${rt}+G${rt + 1}`, v: v.valuado * (1 - pct) / tc }])
  f.push(["", "", "", "", "Tipo de cambio", tc, tcOrigen])
  if (v.huecos.length) f.push([`⚠️ Sin precio: ${v.huecos.map(h => `${h.categoria} (${h.cabezas} cab.)`).join(", ")} — no se valúan en cero.`])
  return { r0, r1, rt: rn }
}

export interface DatosValorizado {
  cierre: ValuacionHacienda
  inicio?: ValuacionHacienda | null
  fechaCierre: string
  fechaInicio: string
  tcCierre: number | null
  /** El renglón del balance anterior (la DDJJ del contador) — `APERTURA`. */
  ddjjInicio?: { cuenta: string; denominacion: string; valor: number } | null
}

/** 💰 La solapa «02.1 Stock valorizado». */
export function hojaStockValorizado(d: DatosValorizado): unknown[][] {
  const f: unknown[][] = [["02.1 — STOCK DE HACIENDA VALORIZADO — cierre e inicio del ejercicio"],
    ["El reporte a la izquierda (formato del papel 2.2); a la derecha, la trazabilidad de cada renglón. Las tablas de precios, con su día y su link, en «02.2 Precios tomados»."]]
  const tc = d.tcCierre ?? 1
  bloque22(f, `2.2) - VALUACIÓN GANADERA (VALORES MERCADO) AL ${dmy(d.fechaCierre)}`, d.cierre, tc, d.tcCierre ? "BNA divisa comprador del cierre" : "⚠️ sin tipo de cambio del cierre")
  if (!d.inicio) {
    f.push([]); f.push(["⚠️ El inicio no se pudo valuar (no se leyeron los precios de esa fecha)."])
    return f
  }
  const p = PAPELES_JMS_INICIO_2025
  const ini = bloque22(f, `2.2) - VALUACIÓN GANADERA (VALORES MERCADO) AL ${dmy(d.fechaInicio)}`, d.inicio, p.tc, "el de los papeles de JMS 2025 (TC prom div)")
  f.push([]); f.push(["LOS TRES VALORES DEL INICIO", "", "", "", "", "PESOS", "Dif. con la app"])
  const a = f.length + 1
  const papeles = Object.values(p.valor).reduce((s, x) => s + x, 0)
  const netoIni = d.inicio.neto ?? d.inicio.valuado
  f.push(["App (mismo cálculo que el cierre, neto del 10 %)", "", "", "", "", { t: "n", f: `F${ini.rt}`, v: netoIni }, { t: "n", f: `F${a}-F${a}`, v: 0 }])
  f.push([`Papeles de JMS ${dmy(p.fecha)} — ${p.fuente}`, "", "", "", "", papeles, { t: "n", f: `F${a + 1}-F${a}`, v: papeles - netoIni }])
  if (d.ddjjInicio) f.push([`DDJJ — balance del contador: ${d.ddjjInicio.cuenta} «${d.ddjjInicio.denominacion}» (sin apertura)`, "", "", "", "", d.ddjjInicio.valor,
    { t: "n", f: `F${a + 2}-F${a}`, v: d.ddjjInicio.valor - netoIni }])
  f.push([]); f.push(["CATEGORÍA POR CATEGORÍA — app (a precio de mercado, antes del 10 %) contra los papeles de JMS", "", "", "", "", "App", "Papeles", "", "Diferencia"])
  for (let r = ini.r0; r <= ini.r1; r++) {
    const fila = f[r - 1] as unknown[]
    const cat = String(fila[8] ?? "")
    const rr = f.length + 1
    f.push([fila[0], "", "", "", "", { t: "n", f: `F${r}`, v: 0 }, p.valor[cat] ?? 0, "", { t: "n", f: `F${rr}-G${rr}`, v: 0 }])
  }
  return f
}

type Tablas = { mag: Array<PrecioMag>; hembra: Array<PrecioMercado>; macho: Array<PrecioMercado>; vientres: Array<PrecioCabeza>; toros: Array<PrecioCabeza> }

/** 💰 La solapa «02.2 Precios tomados»: cada fuente con el día de cada precio, lo usado y lo de otro día marcados, con link. */
export function hojaPreciosTomados(momentos: Array<{ titulo: string; tablas: Tablas | null | undefined; valuacion: ValuacionHacienda | null | undefined }>): unknown[][] {
  const f: unknown[][] = [["02.2 — PRECIOS TOMADOS — lo que se usó para valuar, fuente por fuente, con el día de cada precio y el link a la web original"],
    ["«Usado»: el renglón que toma la valuación. «Otro día»: sale de un día distinto al del resto de su tabla (esa categoría no se operó y se buscó hacia atrás)."]]
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
      for (const x of [...filas].sort((a, b) => String(a.categoria ?? a.familia).localeCompare(String(b.categoria ?? b.familia)))) {
        const vals = k === "mag" ? [x.familia, x.calidad, x.corte, x.promedio, x.maximo]
          : k === "vientres" || k === "toros" ? [x.categoria, x.cantidad, x.promedio, x.maximo, x.minimo] : [x.categoria, x.pesoLo, x.pesoHi, x.promKilo, x.kiloMax]
        const usado = k === "mag" ? x.familia === "VACAS" && String(x.corte ?? "").replace(/\s/g, "") === "+430" && usados.includes("MAG")
          : k === "vientres" || k === "toros" ? usados.includes(String(x.categoria))
          : usados.includes(`${k === "hembra" ? "terneras" : "terneros"} ${x.pesoLo}-${x.pesoHi ?? "+"}`)
        const fe = String(x.fecha ?? "")
        // 🟩 JMS 05/11: «resaltar tenue los renglones tomados, que se note — el ojo vaya directo».
        const fila: unknown[] = [...vals, fe, usado ? "USADO" : "", fe !== comun ? `SÍ — ${fe}` : "", link("ver", linkCotizacion(FTE[k], fe))]
        f.push(usado ? fila.map(c => conRelleno(c, "E2EFDA")) : fe !== comun ? fila.map((c, i) => i === vals.length || i === vals.length + 2 ? conRelleno(c, "FFF2CC") : c) : fila)
      }
      if (k === "mag") f.push(["Cañuelas no tiene link por fecha: en la página se elige el día de la columna «Día del dato»."])
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
  for (const c of pesos) {
    f.push([]); f.push([`${c.categoria} — ${c.animales} animal(es) · ${c.origen}`])
    f.push(["Caravana / animal", "Pesada antes: fecha", "kg", "Pesada después: fecha", "kg", "Días hasta el cierre", "Días entre pesadas", "KG AL CIERRE", "Cómo"])
    const d0 = f.length + 1
    for (const x of c.detalle ?? []) {
      const r = f.length + 1
      const dAntes = Math.round((Date.parse(fechaCierre) - Date.parse(x.antes.fecha)) / 86_400_000)
      const dEntre = x.despues ? Math.round((Date.parse(x.despues.fecha) - Date.parse(x.antes.fecha)) / 86_400_000) : ""
      const kg = x.metodo === "interpolado" ? { t: "n", f: `C${r}+(E${r}-C${r})*F${r}/G${r}`, v: x.kgAlCierre }
        : x.metodo === "ganancia medida" ? { t: "n", f: `C${r}+${c.gananciaMedida ?? 0}*F${r}`, v: x.kgAlCierre } : x.kgAlCierre
      f.push([x.caravana ?? x.animalId, x.antes.fecha, x.antes.kg, x.despues?.fecha ?? "", x.despues?.kg ?? "", dAntes, dEntre, kg,
        x.metodo === "ganancia medida" ? `sin pesada después: + ${c.gananciaMedida} kg/día medidos` : x.metodo])
    }
    const d1 = f.length
    const rp = f.length + 1
    f.push(["PROMEDIO", "", "", "", "", "", "", { t: "n", f: `AVERAGE(H${d0}:H${d1})`, v: c.pesoProyectado }])
    f.push(["Peso que usa la valuación", "", "", "", "", "", "", c.pesoProyectado])
    f.push(["Diferencia (tiene que dar 0, por redondeo ±0,05)", "", "", "", "", "", "", { t: "n", f: `ROUND(H${rp},1)-H${rp + 1}`, v: 0 }])
  }
  if (!pesos.length) f.push([], ["No hay pesadas: las categorías que van por kilo usan el estimado del criterio (por ejemplo CUT 500 kg)."])
  return f
}
