// Capa compartida (UI-agnóstica): presupuesto de ganadería (venta de destete).
// Fuente única para Ventas, Presupuesto y Cash Flow.
// Modelo: solapa "Ganadería" de `exports_app/- Desarrollo Presuesto..xlsx`.
//
// ⚠️ Las alícuotas NO son constantes: viven en la fila (`alicuota_iva`, `alicuota_iibb`).
// Ganadería es IVA 10,5% + IIBB 1%; arrendamiento es exento + IIBB 5%. Meterlas como
// constantes globales fue el error que destapó esta solapa.

import { resolverSerie } from '@/lib/precios/serie'

export interface PrecioHacienda {
  categoria: string
  anio: number
  mes: number
  precio_pesos_kg: number
  peso_desde?: number | null
  peso_hasta?: number | null
}

// ── Bandas de precio por peso ─────────────────────────────────────────────────
//
// La hacienda se cotiza por KILO y el precio depende del PESO: un ternero de 190 kg no
// vale lo mismo por kilo que uno de 260. Por eso el precio no se busca por categoría
// sino por la banda en la que cae el peso del lote.
//
// Las categorías sin banda (hembras, vaca de refugo, toro) se buscan por nombre.

export interface BandaPrecio {
  nombre: string
  peso_desde: number | null
  peso_hasta: number | null
}

export const BANDAS_HACIENDA: BandaPrecio[] = [
  { nombre: 'Ternero 180/200',       peso_desde: 180, peso_hasta: 200 },
  { nombre: 'Ternero 200/220',       peso_desde: 200, peso_hasta: 220 },
  { nombre: 'Ternero 220/240',       peso_desde: 220, peso_hasta: 240 },
  { nombre: 'Ternero 240/270',       peso_desde: 240, peso_hasta: 270 },
  { nombre: 'Novillito 270/300',     peso_desde: 270, peso_hasta: 300 },
  { nombre: 'Novillito 300/320',     peso_desde: 300, peso_hasta: 320 },
  { nombre: 'Novillo gordo 320/350', peso_desde: 320, peso_hasta: 350 },
  { nombre: 'Novillo gordo 350/390', peso_desde: 350, peso_hasta: 390 },
  // Sin banda: se eligen por categoría
  { nombre: 'Ternera',           peso_desde: null, peso_hasta: null },
  { nombre: 'Vaquillona',        peso_desde: null, peso_hasta: null },
  { nombre: 'Vaca CUT/Descarte', peso_desde: null, peso_hasta: null },
  { nombre: 'Toro',              peso_desde: null, peso_hasta: null },
]

/**
 * Banda que corresponde a un peso. Fuera de rango se toma la más cercana: por debajo
 * la primera, por encima la última — mejor eso que quedarse sin precio.
 */
export function bandaPorPeso(peso: number): BandaPrecio | null {
  const conBanda = BANDAS_HACIENDA.filter(b => b.peso_desde != null)
  if (!conBanda.length || !Number.isFinite(peso)) return null
  const dentro = conBanda.find(b => peso >= b.peso_desde! && peso < b.peso_hasta!)
  if (dentro) return dentro
  return peso < conBanda[0]!.peso_desde! ? conBanda[0]! : conBanda[conBanda.length - 1]!
}

/** Sexo → categorías sin banda (las hembras no se cotizan por peso por ahora). */
export function categoriaPrecioSinBanda(categoriaVenta: string): string {
  if (/hembra|ternera/i.test(categoriaVenta)) return 'Ternera'
  if (/vaquillona/i.test(categoriaVenta)) return 'Vaquillona'
  if (/vaca/i.test(categoriaVenta)) return 'Vaca CUT/Descarte'
  if (/toro|torito/i.test(categoriaVenta)) return 'Toro'
  return categoriaVenta
}

/**
 * Categoría de PRECIO de un lote: si es macho se busca la banda por peso; si no, la
 * categoría plana. Separa "qué animal es" de "en qué banda cotiza".
 */
export function categoriaPrecio(categoriaVenta: string, peso: number): string {
  const esMachoJoven = /ternero|novillo|torito/i.test(categoriaVenta) && !/ternera/i.test(categoriaVenta)
  if (esMachoJoven) {
    const b = bandaPorPeso(peso)
    if (b) return b.nombre
  }
  return categoriaPrecioSinBanda(categoriaVenta)
}

export interface PresupuestoGanaderia {
  id: string
  empresa: string
  campania: string
  centro_costo: string | null
  descripcion: string | null
  stock_vientres: number
  pct_destete: number
  pct_machos: number
  pct_reposicion: number
  peso_macho_kg: number
  peso_hembra_kg: number
  precio_kg_override: number | null
  fecha_cobro_estimada: string
  alicuota_iva: number
  alicuota_iibb: number
  cuenta_contable: string | null
  activo: boolean
}

/** Categorías por defecto para buscar precio (destete macho / hembra). */
export const CATEGORIA_MACHO = 'Ternero'
export const CATEGORIA_HEMBRA = 'Ternera'

// ── Precio ────────────────────────────────────────────────────────────────────

export interface PrecioHaciendaResuelto {
  precio_pesos_kg: number
  /** El mes pedido no estaba cargado: se arrastró el siguiente. */
  arrastrado: boolean
  /** Lo escribió el usuario en la fila (pisa la tabla). */
  manual: boolean
}

/**
 * Precio ARS/kg. Prioridad: override de la fila → precio de la categoría en ese mes →
 * siguiente mes cargado (arrastrado). No hay Matba para hacienda: es carga manual.
 */
export function resolverPrecioHacienda(
  precios: PrecioHacienda[],
  categoria: string,
  anio: number,
  mes: number,
  override: number | null = null,
): PrecioHaciendaResuelto {
  if (override != null) return { precio_pesos_kg: Number(override), arrastrado: false, manual: true }

  const v = resolverSerie(
    precios.filter(p => p.categoria === categoria)
      .map(p => ({ anio: p.anio, mes: p.mes, valor: Number(p.precio_pesos_kg) })),
    anio, mes,
  )
  return {
    precio_pesos_kg: v.valor,
    arrastrado: v.origen !== 'exacto' && v.origen !== 'sin_dato',
    manual: false,
  }
}

// ── Cálculo del presupuesto ───────────────────────────────────────────────────

export interface LineaGanaderia {
  categoria: string
  /** Cabezas destetadas de esa categoría (antes de retener reposición). */
  cabezas_destete: number
  /** Cabezas retenidas para reposición (sólo hembras). Negativo en el Excel. */
  reposicion: number
  /** Cabezas efectivamente a la venta. */
  cabezas_venta: number
  peso_kg: number
  kg_totales: number
  precio_kg: number
  neto: number
  iva: number
  total: number
  precio_arrastrado: boolean
  precio_manual: boolean
}

export interface ResultadoGanaderia {
  terneros: number
  lineas: LineaGanaderia[]
  cabezas_venta: number
  kg_totales: number
  neto: number
  iva: number
  total: number
  /** IIBB a pagar el mes SIGUIENTE al cobro, sobre el NETO. */
  iibb: number
  mes_pago_iibb: string
  /** Algún precio se arrastró o falta: el número es estimado. */
  estimado: boolean
}

/**
 * Fórmulas de la planilla:
 *   terneros    = vientres × %destete
 *   machos      = terneros × %machos      · hembras = terneros − machos
 *   reposición  = vientres × %reposición  (sale de las hembras)
 *   venta       = cabezas − reposición
 *   kg          = venta × peso
 *   neto        = kg × precio/kg
 *   IVA         = neto × alícuota_iva     (ganadería 10,5%)
 *   IIBB        = neto × alícuota_iibb    (ganadería 1%), el mes SIGUIENTE al cobro
 */
export function calcularGanaderia(
  p: PresupuestoGanaderia,
  precios: PrecioHacienda[],
): ResultadoGanaderia {
  const [anioCobro, mesCobro] = p.fecha_cobro_estimada.split('-').map(Number)

  const terneros = Number(p.stock_vientres) * Number(p.pct_destete)
  const machos = terneros * Number(p.pct_machos)
  const hembras = terneros - machos
  const reposicion = Number(p.stock_vientres) * Number(p.pct_reposicion)

  const armar = (
    categoria: string, cabezasDestete: number, repo: number, peso: number,
  ): LineaGanaderia => {
    const pr = resolverPrecioHacienda(precios, categoria, anioCobro, mesCobro, p.precio_kg_override)
    const cabezasVenta = Math.max(0, cabezasDestete - repo)
    const kg = cabezasVenta * Number(peso)
    const neto = kg * pr.precio_pesos_kg
    const iva = neto * Number(p.alicuota_iva)
    return {
      categoria,
      cabezas_destete: cabezasDestete,
      reposicion: repo,
      cabezas_venta: cabezasVenta,
      peso_kg: Number(peso),
      kg_totales: kg,
      precio_kg: pr.precio_pesos_kg,
      neto, iva, total: neto + iva,
      precio_arrastrado: pr.arrastrado,
      precio_manual: pr.manual,
    }
  }

  const lineas = [
    // La reposición sale de las hembras: los machos van todos a la venta
    armar(CATEGORIA_MACHO, machos, 0, p.peso_macho_kg),
    armar(CATEGORIA_HEMBRA, hembras, reposicion, p.peso_hembra_kg),
  ]

  const neto = lineas.reduce((s, l) => s + l.neto, 0)
  const iva = lineas.reduce((s, l) => s + l.iva, 0)

  return {
    terneros,
    lineas,
    cabezas_venta: lineas.reduce((s, l) => s + l.cabezas_venta, 0),
    kg_totales: lineas.reduce((s, l) => s + l.kg_totales, 0),
    neto, iva, total: neto + iva,
    iibb: neto * Number(p.alicuota_iibb),
    mes_pago_iibb: mesSiguiente(p.fecha_cobro_estimada),
    estimado: lineas.some(l => l.precio_kg === 0 || l.precio_arrastrado),
  }
}

/** Mes siguiente al cobro, 'YYYY-MM' — cuando se paga el IIBB. */
export function mesSiguiente(fecha: string): string {
  const [anio, mes] = fecha.split('-').map(Number)
  const d = new Date(anio, mes, 1) // mes es 1-based → new Date(anio, mes) ya es el siguiente
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Referencia del historial real (productivo.ciclos_cria) ────────────────────

export interface CicloCria {
  anio_servicio: number
  cabezas_servicio: number | null
  cabezas_prenadas: number | null
  terneros_destetados: number | null
  machos_destetados: number | null
  hembras_destetados: number | null
  kg_promedio: number | null
}

export interface ReferenciaHistorica {
  anio: number
  vientres: number
  pct_destete: number | null
  pct_machos: number | null
  kg_promedio: number | null
}

/**
 * Los parámetros reales del último ciclo CERRADO (con destete cargado), para mostrarlos
 * al lado de los campos como referencia. **No pisa nada**: el usuario decide si su
 * proyección es más conservadora que el histórico.
 */
export function referenciaHistorica(ciclos: CicloCria[]): ReferenciaHistorica | null {
  const porAnio = new Map<number, CicloCria[]>()
  for (const c of ciclos) {
    if (!porAnio.has(c.anio_servicio)) porAnio.set(c.anio_servicio, [])
    porAnio.get(c.anio_servicio)!.push(c)
  }

  const cerrados = Array.from(porAnio.entries())
    .filter(([, cs]) => cs.some(c => c.terneros_destetados != null))
    .sort((a, b) => b[0] - a[0])

  const ultimo = cerrados[0]
  if (!ultimo) return null

  const [anio, cs] = ultimo
  const sum = (f: (c: CicloCria) => number | null) =>
    cs.reduce((s, c) => s + (Number(f(c)) || 0), 0)

  const vientres = sum(c => c.cabezas_servicio)
  const destetados = sum(c => c.terneros_destetados)
  const machos = sum(c => c.machos_destetados)
  const kgs = cs.map(c => Number(c.kg_promedio)).filter(k => k > 0)

  return {
    anio,
    vientres,
    pct_destete: vientres > 0 ? destetados / vientres : null,
    pct_machos: destetados > 0 ? machos / destetados : null,
    kg_promedio: kgs.length ? kgs.reduce((s, k) => s + k, 0) / kgs.length : null,
  }
}
