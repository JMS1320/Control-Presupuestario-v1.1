/**
 * 📦 **LOS STOCKS EN UNA SOLA TABLA — inicio y cierre, cantidad y precio, contable y económico** — A-FEAT-1501.
 *
 * JMS 01/11: *«¿hay alguna lista única de inicio y cierre total con todos los precios y cantidades que faltan? insumo /
 * cabezas por categoría / grano… para cada línea 2 datos, inicio y cierre; y 2 valuaciones: para reportes contables y
 * para cálculos económicos / márgenes / presupuesto. No quisiera reemplazar nada del Excel, pero sintetizado en una sola
 * tabla. Lo que la app ya tiene me lo muestra, lo que calcula me lo muestra, lo que le falta me lo pide.»*
 *
 * No calcula nada nuevo: junta lo que ya arman las solapas de stock (insumos, stock al inicio, hacienda, granos,
 * sementeras, pasturas). Las cantidades y los precios son DATO; los valores son FÓRMULA (cantidad × precio), así al
 * completar un precio el valor sale solo.
 *
 * 🔑 **Las dos valuaciones** ya existían como versiones de la foto del Balance propio: **contador** = la contable, **JMS**
 * (campo) = la económica. Acá bajan a cada ítem. Criterio inicial (JMS lo corrige): lo que valúa la app para los papeles
 * del balance (costo de compra de insumos, MAG/mercado de hacienda, granos a valor neto, pasturas amortizadas) va a la
 * **contable**; la económica arranca de su planilla (stock al inicio, versión JMS) y lo demás se pide.
 */
import type { RenglonStockInicio, Pastura } from "./stock-inicio"
import { valuarPastura } from "./stock-inicio"
import type { StockInsumos } from "./stock-insumos"
import type { ValuacionHacienda } from "./hacienda-stock"
import type { CuadreGranos, ValuacionGranos, Sementeras } from "./granos-sementeras"
import type { TresSaldos } from "./tres-saldos-hacienda"
import { CATEGORIAS_PLANILLA } from "./tres-saldos-hacienda"

export interface LadoStock { cantidad: number | null; precioContable: number | null; precioEconomico: number | null }

export interface LineaStock {
  rubro: string
  item: string
  unidad: string
  inicio: LadoStock
  cierre: LadoStock
  /** Peso promedio (hacienda) o año de siembra (pasturas). */
  extra?: string
  origen: string
}

export interface DatosStocks {
  fechaInicio: string
  fechaCierre: string
  insumos?: StockInsumos | null
  stockInicio?: { renglones: RenglonStockInicio[]; pasturas: Pastura[] } | null
  hacienda?: { valuacion: ValuacionHacienda; saldos?: { inicio: TresSaldos; cierre: TresSaldos } } | null
  granos?: { cuadre: CuadreGranos; valuacion: ValuacionGranos } | null
  sementeras?: Sementeras | null
}

const r2 = (n: number) => Math.round(n * 100) / 100
const vacio = (): LadoStock => ({ cantidad: null, precioContable: null, precioEconomico: null })
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim()
const pos = (n: number | null | undefined) => (n != null && Number.isFinite(n) && n !== 0 ? n : null)

/** Precio en pesos por unidad de un renglón de la planilla (si vino en dólares, del valor en pesos). */
function precioPesos(r: RenglonStockInicio): number | null {
  if (r.valor_pesos != null && r.cantidad) return r2(r.valor_pesos / r.cantidad)
  return r.moneda === "ARS" ? pos(r.precio_unitario) : null
}

const RUBRO_INICIO: Record<RenglonStockInicio["rubro"], string> = { insumo: "Insumos", forraje: "Forrajes", combustible: "Combustible" }
const RUBRO_AMBITO: Record<string, string> = { agricola: "Insumos", ganadero: "Forrajes", ambos: "Combustible" }

/** Lo que JMS nombró y tiene que estar aunque la app no lo tenga: si no aparece, se agrega una línea que lo pide. */
export const ITEMS_ESPERADOS: { rubro: string; item: string; unidad: string; busca: RegExp }[] = [
  { rubro: "Insumos", item: "Agroquímicos", unidad: "lt / kg", busca: /agroquim|herbicid|insecticid|fungicid|glifos/ },
  { rubro: "Insumos", item: "Fertilizantes", unidad: "kg", busca: /fertiliz|urea|map\b|fosfat|sps/ },
  { rubro: "Insumos", item: "Semillas", unidad: "kg", busca: /semilla/ },
  { rubro: "Forrajes", item: "Maíz para la ganadería", unidad: "kg", busca: /maiz/ },
  { rubro: "Forrajes", item: "Concentrado / balanceado", unidad: "kg", busca: /concentrad|balancead|pellet|expeller/ },
  { rubro: "Forrajes", item: "Rollos", unidad: "rollos", busca: /rollo/ },
  { rubro: "Forrajes", item: "Silo de maíz", unidad: "tn", busca: /silo/ },
  { rubro: "Combustible", item: "Gas oil", unidad: "lt", busca: /gas ?oil|gasoil/ },
]

/** Pura: todas las líneas, por rubro. Lo que no está queda en `null` (se pide), nunca en un cero inventado. */
export function armarStocksUnificados(d: DatosStocks): LineaStock[] {
  const lineas: LineaStock[] = []

  // ── Insumos, forrajes y combustible: el inicio de la planilla declarada, el cierre de la app ──
  const porItem = new Map<string, LineaStock>()
  const clave = (rubro: string, nombre: string) => `${rubro}|${norm(nombre)}`
  for (const r of d.stockInicio?.renglones ?? []) {
    const rubro = RUBRO_INICIO[r.rubro] ?? "Insumos"
    const nombre = r.producto_app || r.producto_planilla
    const k = clave(rubro, nombre)
    const l = porItem.get(k) ?? { rubro, item: nombre, unidad: r.unidad ?? "", inicio: vacio(), cierre: vacio(), origen: "" }
    if (l.inicio.cantidad == null && r.cantidad != null) l.inicio.cantidad = r.cantidad
    if (r.version === "contador") l.inicio.precioContable = precioPesos(r)
    else l.inicio.precioEconomico = precioPesos(r)
    l.origen = `inicio: tu stock declarado (${r.fuente})`
    porItem.set(k, l)
  }
  for (const g of d.insumos?.grupos ?? []) {
    const rubro = RUBRO_AMBITO[g.ambito] ?? "Insumos"
    for (const f of g.filas) {
      const k = clave(rubro, f.producto)
      const l = porItem.get(k) ?? { rubro, item: f.producto, unidad: f.unidad, inicio: vacio(), cierre: vacio(), origen: "" }
      l.cierre.cantidad = f.cantidad
      l.cierre.precioContable = pos(f.costoUnitario)
      if (!l.unidad) l.unidad = f.unidad
      l.origen = [l.origen, `cierre: app (${d.insumos?.alCierre ? `existencia reconstruida al ${d.insumos.alCierre.fecha}` : "existencia de hoy"}, costo de compra)`].filter(Boolean).join(" · ")
      porItem.set(k, l)
    }
  }
  const insumos = [...porItem.values()]
  // 🛑 A-BUG-1508: si no se trajeron el stock al inicio y la existencia, NO se afirma que falten: se dice que no se trajeron.
  const seTrajo = !!d.insumos && !!d.stockInicio
  if (!seTrajo) {
    insumos.push({ rubro: "Insumos", item: "⚠️ No se trajo el stock", unidad: "", inicio: vacio(), cierre: vacio(),
      origen: "no se trajeron el stock al inicio ni la existencia de la app: «⚡ Armar todo» (o «Traer stock y precios») antes de bajar el Excel" })
  } else for (const e of ITEMS_ESPERADOS) {
    if (insumos.some(l => l.rubro === e.rubro && e.busca.test(norm(l.item)))) continue
    insumos.push({ rubro: e.rubro, item: `${e.item} (no está en la app)`, unidad: e.unidad, inicio: vacio(), cierre: vacio(), origen: "lo nombraste vos: no hay ni stock declarado ni existencia en la app" })
  }
  const ordenRubro = ["Insumos", "Forrajes", "Combustible"]
  lineas.push(...insumos.sort((a, b) => ordenRubro.indexOf(a.rubro) - ordenRubro.indexOf(b.rubro) || a.item.localeCompare(b.item)))

  // ── Hacienda: cabezas por categoría (la de tu planilla), peso y precio por cabeza ──
  const val = d.hacienda?.valuacion
  for (const c of CATEGORIAS_PLANILLA) {
    const filas = (val?.filas ?? []).filter(f => c.app.includes(f.categoria))
    const cab = filas.reduce((t, f) => t + f.cabezas, 0)
    const valuadas = filas.filter(f => f.valorTotal != null)
    const valor = valuadas.reduce((t, f) => t + (f.valorTotal ?? 0), 0)
    const cabValuadas = valuadas.reduce((t, f) => t + f.cabezas, 0)
    const conPeso = filas.filter(f => f.pesoKg != null)
    const kg = conPeso.reduce((t, f) => t + (f.pesoKg ?? 0) * f.cabezas, 0), cabKg = conPeso.reduce((t, f) => t + f.cabezas, 0)
    const ini = d.hacienda?.saldos?.inicio.filas.find(f => f.clave === c.clave)
    const cie = d.hacienda?.saldos?.cierre.filas.find(f => f.clave === c.clave)
    const notas: string[] = []
    if (ini && ini.campo != null && ini.campo !== ini.sistema) notas.push(`inicio según tu campo ${ini.campo}`)
    if (cie && cie.campo != null && cie.campo !== cie.sistema) notas.push(`cierre según tu campo ${cie.campo}`)
    lineas.push({
      rubro: "Hacienda", item: c.nombre, unidad: "cabezas",
      inicio: { cantidad: ini ? ini.sistema : null, precioContable: null, precioEconomico: null },
      cierre: { cantidad: cie ? cie.sistema : (filas.length ? cab : null),
        precioContable: cabValuadas && cabValuadas === cab ? r2(valor / cab) : null, precioEconomico: null },
      extra: cabKg ? `${Math.round(kg / cabKg)} kg prom. al cierre` : undefined,
      origen: ["cabezas: app (movimientos de hacienda)", filas.length ? `precio al cierre: ${[...new Set(filas.map(f => f.origenPrecio))].join(" / ")}` : "", ...notas].filter(Boolean).join(" · "),
    })
  }

  // ── Granos (soja): toneladas del cuadre, precio neto de la valuación ──
  if (d.granos) {
    const g = d.granos
    lineas.push({
      rubro: "Granos", item: "Soja", unidad: "tn",
      inicio: { cantidad: g.cuadre.stockInicioTn, precioContable: null, precioEconomico: null },
      cierre: { cantidad: g.cuadre.stockEmpresaTn ?? g.valuacion.toneladas,
        precioContable: g.valuacion.netoFinal != null && g.valuacion.toneladas ? r2(g.valuacion.netoFinal / g.valuacion.toneladas) : null,
        precioEconomico: pos(g.valuacion.precioPorTn) },
      origen: `inicio: ${g.cuadre.notaInicio ?? "stock declarado"} · cierre: app (contable = neto de calidad y gastos; económico = precio de pizarra)`,
    })
  } else {
    lineas.push({ rubro: "Granos", item: "Soja", unidad: "tn", inicio: vacio(), cierre: vacio(), origen: "no se armó el papel de granos (falta «Traer stock y precios»)" })
  }

  // ── Sementeras: el costo de lo sembrado al cierre; el inicio se pide ──
  lineas.push({ rubro: "Sementeras", item: "Sementera al inicio (soja 24/25)", unidad: "global", inicio: { cantidad: 1, precioContable: null, precioEconomico: null }, cierre: vacio(),
    origen: "el año pasado salía de 2 FC ACREN + 2 Moragues (US$ 4.658,78); la app no tiene el detalle" })
  for (const s of d.sementeras?.lineas ?? []) {
    lineas.push({ rubro: "Sementeras", item: `${s.insumo} · lote ${s.lote}`, unidad: s.unidad, inicio: vacio(),
      cierre: { cantidad: s.cantidad, precioContable: pos(s.precioUnitario), precioEconomico: null },
      origen: `cierre: app (orden ejecutada${s.fecha ? ` del ${s.fecha}` : ""}, ${s.hectareas} ha)` })
  }

  // ── Pasturas: hectáreas y US$ por ha amortizados a cada fecha ──
  for (const p of d.stockInicio?.pasturas ?? []) {
    const a = valuarPastura(p, d.fechaInicio), b = valuarPastura(p, d.fechaCierre)
    const porHa = (v: number | null) => (v != null && p.hectareas ? r2(v / p.hectareas) : null)
    lineas.push({ rubro: "Pasturas", item: `${p.lotes}`, unidad: "ha (precio en US$/ha)",
      inicio: { cantidad: a.dadaDeBaja ? 0 : p.hectareas, precioContable: porHa(a.valorActualUsd), precioEconomico: null },
      cierre: { cantidad: b.dadaDeBaja ? 0 : p.hectareas, precioContable: porHa(b.valorActualUsd), precioEconomico: null },
      extra: `siembra ${p.anio_siembra} · vida útil ${p.vida_util_anios} años`,
      origen: `app (pasturas): US$ ${p.usd_por_ha ?? "?"}/ha amortizado ${Math.round(a.amortizado * 100)} % al inicio y ${Math.round(b.amortizado * 100)} % al cierre · ⚠️ en DÓLARES` })
  }
  if (!(d.stockInicio?.pasturas ?? []).length) {
    lineas.push({ rubro: "Pasturas", item: "Lotes de pasturas", unidad: "ha", inicio: vacio(), cierre: vacio(),
      origen: d.stockInicio ? "no hay pasturas cargadas: lote, año de siembra, ha y US$/ha" : "no se trajeron las pasturas (falta «Traer stock y precios»)" })
  }
  return lineas
}

/** Qué le falta a una línea, en palabras: lo que se le pide a JMS. */
export function queFalta(l: LineaStock): string {
  const f: string[] = []
  if (l.inicio.cantidad == null) f.push("cantidad inicio")
  if (l.inicio.precioContable == null) f.push("precio contable inicio")
  if (l.inicio.precioEconomico == null) f.push("precio económico inicio")
  if (l.cierre.cantidad == null) f.push("cantidad cierre")
  if (l.cierre.precioContable == null) f.push("precio contable cierre")
  if (l.cierre.precioEconomico == null) f.push("precio económico cierre")
  return f.join(", ")
}

type Celda = string | number | null | { t: string; f: string; v: number | string; z?: string }
const MONEDA = '#,##0.00;(#,##0.00);"-"'
const valorCelda = (fila: number, cCant: string, cPrecio: string, cant: number | null, precio: number | null): Celda => {
  const f = `IF(AND(ISNUMBER(${cCant}${fila}),ISNUMBER(${cPrecio}${fila})),${cCant}${fila}*${cPrecio}${fila},"")`
  return cant != null && precio != null ? { t: "n", f, v: r2(cant * precio), z: MONEDA } : { t: "s", f, v: "" }
}

export const ENCABEZADO_STOCKS = ["Rubro", "Ítem", "Unidad",
  "INICIO cantidad", "INICIO precio contable", "INICIO valor contable", "INICIO precio económico", "INICIO valor económico",
  "CIERRE cantidad", "CIERRE precio contable", "CIERRE valor contable", "CIERRE precio económico", "CIERRE valor económico",
  "Peso / siembra", "De dónde sale", "Qué falta (completalo vos)"]

/**
 * La solapa. Las filas de datos arrancan en la fila 6 de Excel (título, 2 de explicación, en blanco, encabezado).
 * Cantidades y precios = dato (lo que falta queda VACÍO para completar); valores = fórmula; subtotal por rubro = SUMA.
 */
export function hojaDeStocks(lineas: LineaStock[], d: Pick<DatosStocks, "fechaInicio" | "fechaCierre">): Celda[][] {
  const faltan = lineas.filter(l => queFalta(l)).length
  const filas: Celda[][] = [
    [`STOCKS — inicio (${d.fechaInicio}) y cierre (${d.fechaCierre}), en una sola tabla`],
    ["Cantidades y precios son DATO: lo vacío es lo que falta, completalo y el valor sale solo (es fórmula). Contable = para el balance del contador; económico = para márgenes y presupuesto."],
    [`${lineas.length} líneas · ${faltan} con algo para completar · no reemplaza ninguna solapa: junta lo de Stock insumos, Stock al inicio, 02 Hacienda, 1 Granos, 3 Sementeras y las pasturas`],
    [],
    ENCABEZADO_STOCKS,
  ]
  const rubros = [...new Set(lineas.map(l => l.rubro))]
  for (const rubro of rubros) {
    const desde = filas.length + 1
    for (const l of lineas.filter(x => x.rubro === rubro)) {
      const n = filas.length + 1
      filas.push([l.rubro, l.item, l.unidad,
        l.inicio.cantidad, l.inicio.precioContable, valorCelda(n, "D", "E", l.inicio.cantidad, l.inicio.precioContable),
        l.inicio.precioEconomico, valorCelda(n, "D", "G", l.inicio.cantidad, l.inicio.precioEconomico),
        l.cierre.cantidad, l.cierre.precioContable, valorCelda(n, "I", "J", l.cierre.cantidad, l.cierre.precioContable),
        l.cierre.precioEconomico, valorCelda(n, "I", "L", l.cierre.cantidad, l.cierre.precioEconomico),
        l.extra ?? "", l.origen, queFalta(l)])
    }
    const hasta = filas.length
    const suma = (col: string, idx: number) => {
      const v = filas.slice(desde - 1, hasta).reduce((t, f) => { const c = f[idx]; return t + (c && typeof c === "object" && typeof c.v === "number" ? c.v : 0) }, 0)
      return { t: "n", f: `SUM(${col}${desde}:${col}${hasta})`, v: r2(v), z: MONEDA }
    }
    filas.push([`Subtotal ${rubro}${rubro === "Pasturas" ? " (US$)" : ""}`, "", "", "", "", suma("F", 5), "", suma("H", 7), "", "", suma("K", 10), "", suma("M", 12), "", "", ""])
    filas.push([])
  }
  return filas
}
