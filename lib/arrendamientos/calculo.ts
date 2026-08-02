import { resolverSerie } from '@/lib/precios/serie'

// Capa compartida (UI-agnóstica): fórmulas de arrendamientos agrícolas.
// Fuente única para Ventas, Presupuesto y Cash Flow — que nadie recalcule por su cuenta.
// Diseño: DISEÑO_PRESUPUESTO.md § INGRESOS — Arrendamientos agrícolas.

// ── Constantes de negocio ─────────────────────────────────────────────────────

// ⚠️ Estas alícuotas son de ARRENDAMIENTO, no del sistema. Ganadería usa otras
// (IIBB 1% e IVA 10,5%) y las lleva en la fila, no como constante. No generalizar
// estas constantes a otros conceptos.

/** Arrendamiento — IIBB: 5% de cada cobro, se paga el mes SIGUIENTE (template IIBB Mensual). */
export const ALICUOTA_IIBB_ARRENDAMIENTO = 0.05
/** Arrendamiento — Ganancias: 6% deducido del cobro (menor ingreso, sobre el neto). */
export const ALICUOTA_GANANCIAS_ARRENDAMIENTO = 0.06
/**
 * Días corridos entre fijación y cobro al vender disponible (pizarra).
 * DEFAULT nada más: el plazo real es **por contrato/cliente**
 * (`contratos_arrendamiento.dias_cobro_disponible`) — Sanpa paga a 15.
 */
export const DIAS_COBRO_PIZARRA_DEFAULT = 20
/** Arrendamiento agrícola: exento de IVA. (Ganadería NO lo es: 10,5%.) */
export const ARRENDAMIENTO_EXENTO_IVA = true

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContratoArrendamiento {
  id: string
  empresa: string
  campania: string
  centro_costo: string
  cliente_cuit: string | null
  cliente_nombre: string
  has: number
  qq_ha_total: number
  grano: string
  cuenta_contable: string | null
  activo: boolean
  notas: string | null
}

export type EstadoCuota = 'presupuestado' | 'parcial' | 'fijado' | 'disponible'

export interface CuotaArrendamiento {
  id: string
  contrato_id: string
  numero_cuota: number
  qq_ha_cuota: number
  fecha_cobro_estimada: string      // 'YYYY-MM-DD'
  posicion_anio: number
  posicion_mes: number
  fecha_cobro_original: string | null
  posicion_orig_anio: number | null
  posicion_orig_mes: number | null
  estado: EstadoCuota
  /** Precio USD/ton manual que pisa el de la posición. NULL = usa `precios_granos`. */
  precio_usd_override: number | null
  /** Precio ARS/ton (pizarra disponible). Gana sobre el USD y NO aplica TC. */
  precio_pesos_override: number | null
  notas: string | null
}

/**
 * VENTA de arrendamiento. Cada fila = una fijación = una venta.
 * "Venta origina Factura/Liquidación que origina Cobro": el comprobante viene después.
 *
 * Precio y TC se fijan en MOMENTOS DISTINTOS. La venta nace al fijar el primero de los
 * dos; hasta que estén ambos el monto en pesos es estimado. Excepción: modo `pizarra`
 * (disponible) se cierra en un solo acto, en ARS, sin TC.
 */
export interface VentaArrendamiento {
  id: string
  cuota_id: string
  tons: number
  modo: 'matba' | 'pizarra'
  fecha_fijacion_precio: string | null
  precio_usd: number | null
  fecha_fijacion_tc: string | null
  tc: number | null
  precio_pesos: number | null
  monto_pesos: number | null
  fecha_cobro: string | null
  comprobante_id: string | null
}

/** Qué le falta a la venta para estar cerrada. */
export type EstadoVenta = 'sin_precio' | 'sin_tc' | 'cerrada'

/**
 * En modo `pizarra` alcanza el precio en pesos: no hay TC que fijar.
 * En modo `matba` hacen falta los dos momentos.
 */
export function estadoVenta(v: Pick<VentaArrendamiento, 'modo' | 'precio_usd' | 'tc' | 'precio_pesos'>): EstadoVenta {
  if (v.modo === 'pizarra') return v.precio_pesos != null ? 'cerrada' : 'sin_precio'
  if (v.precio_usd == null) return 'sin_precio'
  if (v.tc == null) return 'sin_tc'
  return 'cerrada'
}

/**
 * Monto en pesos de la venta. Si falta fijar el TC usa el proyectado del mes de cobro
 * y lo marca como estimado — el monto en USD ya es cierto, el de pesos todavía no.
 */
export function montoVenta(
  v: Pick<VentaArrendamiento, 'modo' | 'tons' | 'precio_usd' | 'tc' | 'precio_pesos' | 'fecha_cobro'>,
  tcs: TipoCambio[] = [],
): { monto: number; estimado: boolean } {
  if (v.modo === 'pizarra') {
    return { monto: Number(v.tons) * Number(v.precio_pesos ?? 0), estimado: v.precio_pesos == null }
  }
  if (v.precio_usd == null) return { monto: 0, estimado: true }

  if (v.tc != null) {
    return { monto: Number(v.tons) * Number(v.precio_usd) * Number(v.tc), estimado: false }
  }

  // Precio fijado, TC pendiente → estimar con el TC del mes de cobro
  const [anio, mes] = (v.fecha_cobro ?? '').split('-').map(Number)
  const t = anio && mes ? resolverTC(tcs, anio, mes) : { tc: 0 }
  return { monto: Number(v.tons) * Number(v.precio_usd) * t.tc, estimado: true }
}

export interface PrecioGrano {
  grano: string
  anio: number
  mes: number
  precio_usd: number
}

export interface TipoCambio {
  anio: number
  mes: number
  tc_presupuestado: number | null
  tc_real: number | null
}

// ── Fórmulas base (planilla "- Desarrollo Presuesto." solapa Primeros Pasos) ──

/** Tons totales del contrato. E6 = has × qq_ha / 10 (10 qq = 1 ton). */
export function tonsTotales(has: number, qqHaTotal: number): number {
  return (has * qqHaTotal) / 10
}

/** Tons de una cuota. E7 = has × qq_ha_cuota / 10. */
export function tonsCuota(has: number, qqHaCuota: number): number {
  return (has * qqHaCuota) / 10
}

/** Proporción de la cuota sobre el total. C7 = qq_cuota / qq_total. Informativo. */
export function pctCuota(qqHaCuota: number, qqHaTotal: number): number {
  return qqHaTotal === 0 ? 0 : qqHaCuota / qqHaTotal
}

/**
 * Guardarraíl: la suma de qq de las cuotas debe igualar el arrendamiento total.
 * Es ADVERTENCIA, no bloqueo (mismo criterio que el generador de renovación).
 */
export function validarGuardarrailQq(
  qqHaTotal: number,
  cuotas: { qq_ha_cuota: number }[],
): { ok: boolean; suma: number; diferencia: number } {
  const suma = cuotas.reduce((s, c) => s + Number(c.qq_ha_cuota || 0), 0)
  const diferencia = Math.round((suma - qqHaTotal) * 100) / 100
  return { ok: diferencia === 0, suma, diferencia }
}

// ── Precios y TC ──────────────────────────────────────────────────────────────

export interface PrecioResuelto {
  precio_usd: number
  /** true = no había precio para esa posición; se arrastró el del mes siguiente cargado. */
  arrastrado: boolean
  /** Posición efectivamente usada (puede diferir de la pedida si se arrastró). */
  posicion: { anio: number; mes: number } | null
}

/**
 * Precio de una posición, con ARRASTRE HACIA ADELANTE: si el mes no está cargado se usa
 * el último cargado antes de él. Ver `lib/precios/serie.ts` — es la misma regla para
 * todas las series del presupuesto, así alcanza con cargar los meses donde el precio
 * cambia y nada queda en cero.
 */
export function resolverPrecio(
  precios: PrecioGrano[],
  grano: string,
  anio: number,
  mes: number,
): PrecioResuelto {
  const v = resolverSerie(
    precios.filter(p => p.grano === grano).map(p => ({ anio: p.anio, mes: p.mes, valor: Number(p.precio_usd) })),
    anio, mes,
  )
  return {
    precio_usd: v.valor,
    arrastrado: v.origen !== 'exacto' && v.origen !== 'sin_dato',
    posicion: v.desde ?? (v.origen === 'exacto' ? { anio, mes } : null),
  }
}

/**
 * TC del mes: prioriza el real; si no hay, el presupuestado. Con ARRASTRE HACIA
 * ADELANTE (`lib/precios/serie.ts`): alcanza con cargar los meses donde el TC cambia.
 */
export function resolverTC(tcs: TipoCambio[], anio: number, mes: number): { tc: number; arrastrado: boolean } {
  const puntos = tcs
    .map(t => ({ anio: t.anio, mes: t.mes, valor: Number(t.tc_real ?? t.tc_presupuestado) }))
    .filter(p => Number.isFinite(p.valor) && p.valor > 0)
  const v = resolverSerie(puntos, anio, mes)
  return { tc: v.valor, arrastrado: v.origen !== 'exacto' && v.origen !== 'sin_dato' }
}

// ── Monto de una cuota ────────────────────────────────────────────────────────

export interface MontoCuota {
  tons: number
  precio_usd: number
  tc: number
  monto_pesos: number
  /** Precio y/o TC arrastrados de otro mes → la celda es estimada, no cargada. */
  estimado: boolean
}

/**
 * Precio efectivo de una cuota: el override manual si lo tiene, si no el de la posición.
 * El override existe para valorizar las tons disponibles y para forzar un valor puntual.
 */
export function precioEfectivo(
  contrato: Pick<ContratoArrendamiento, 'grano'>,
  cuota: Pick<CuotaArrendamiento, 'posicion_anio' | 'posicion_mes' | 'precio_usd_override'>,
  precios: PrecioGrano[],
): PrecioResuelto & { manual: boolean } {
  if (cuota.precio_usd_override != null) {
    return {
      precio_usd: Number(cuota.precio_usd_override),
      arrastrado: false,
      manual: true,
      posicion: { anio: cuota.posicion_anio, mes: cuota.posicion_mes },
    }
  }
  return { ...resolverPrecio(precios, contrato.grano, cuota.posicion_anio, cuota.posicion_mes), manual: false }
}

/**
 * Modo de precio según CUÁNDO se cobra:
 *  - mes actual  → `pizarra`: se vende disponible y la pizarra Rosario cotiza en PESOS
 *                  (no tiene futuros), así que el precio se carga en ARS/ton directo.
 *  - mes posterior → `matba`: precio USD de la posición × TC.
 */
export function modoPrecioSegunFecha(fechaCobro: string, hoy = new Date()): 'pizarra' | 'matba' {
  const [anio, mes] = fechaCobro.split('-').map(Number)
  return anio === hoy.getFullYear() && mes === hoy.getMonth() + 1 ? 'pizarra' : 'matba'
}

export interface PrecioCuotaResuelto {
  /** ARS por tonelada ya resuelto, venga de pizarra directa o de Matba × TC. */
  pesos_por_ton: number
  modo: 'pizarra' | 'matba'
  precio_usd: number | null
  tc: number | null
  /** El precio lo puso el usuario a mano (no salió de las tablas). */
  manual: boolean
  /** El precio o el TC se arrastraron de otro mes. */
  arrastrado: boolean
}

/**
 * Precio de la cuota en ARS/ton. Prioridad:
 *   1. `precio_pesos_override` (pizarra) — gana siempre y NO aplica TC.
 *   2. `precio_usd_override` × TC.
 *   3. precio de la posición × TC.
 */
export function resolverPrecioCuota(
  contrato: Pick<ContratoArrendamiento, 'grano'>,
  cuota: Pick<CuotaArrendamiento, 'posicion_anio' | 'posicion_mes' | 'fecha_cobro_estimada' | 'precio_usd_override' | 'precio_pesos_override'>,
  precios: PrecioGrano[],
  tcs: TipoCambio[],
): PrecioCuotaResuelto {
  if (cuota.precio_pesos_override != null) {
    return {
      pesos_por_ton: Number(cuota.precio_pesos_override),
      modo: 'pizarra',
      precio_usd: null,
      tc: null,
      manual: true,
      arrastrado: false,
    }
  }

  const p = precioEfectivo(contrato, cuota, precios)
  const [anioCobro, mesCobro] = cuota.fecha_cobro_estimada.split('-').map(Number)
  const t = resolverTC(tcs, anioCobro, mesCobro)

  return {
    pesos_por_ton: p.precio_usd * t.tc,
    modo: 'matba',
    precio_usd: p.precio_usd,
    tc: t.tc,
    manual: p.manual,
    arrastrado: p.arrastrado || t.arrastrado,
  }
}

/** Monto presupuestado de una cuota: tons × precio ARS/ton resuelto. */
export function calcularMontoCuota(
  contrato: Pick<ContratoArrendamiento, 'has' | 'grano'>,
  cuota: Pick<CuotaArrendamiento, 'qq_ha_cuota' | 'posicion_anio' | 'posicion_mes' | 'fecha_cobro_estimada' | 'precio_usd_override' | 'precio_pesos_override'>,
  precios: PrecioGrano[],
  tcs: TipoCambio[],
): MontoCuota {
  const tons = tonsCuota(Number(contrato.has), Number(cuota.qq_ha_cuota))
  const p = resolverPrecioCuota(contrato, cuota, precios, tcs)

  return {
    tons,
    precio_usd: p.precio_usd ?? 0,
    tc: p.tc ?? 0,
    monto_pesos: tons * p.pesos_por_ton,
    estimado: p.arrastrado,
  }
}

// ── Fijaciones ────────────────────────────────────────────────────────────────

/** Tons ya fijadas de una cuota. */
export function tonsFijadas(fijaciones: Pick<VentaArrendamiento, 'tons'>[]): number {
  return fijaciones.reduce((s, f) => s + Number(f.tons || 0), 0)
}

/** Tons todavía disponibles a fijar = tons_cuota − Σ fijaciones. */
export function tonsDisponibles(
  has: number,
  qqHaCuota: number,
  fijaciones: Pick<VentaArrendamiento, 'tons'>[],
): number {
  const total = tonsCuota(Number(has), Number(qqHaCuota))
  return Math.max(0, total - tonsFijadas(fijaciones))
}

/**
 * Estado derivado de la cuota (fijaciones + fecha de cobro).
 *
 * ⚠️ ES ESTE el que gobierna, NO la columna `cuotas_arrendamiento.estado`: esa se desactualiza
 * sola cuando pasa la fecha de cobro sin que nadie toque la fila (una cuota queda 'presupuestado'
 * en la BD aunque ya venció y sus tons estén disponibles a fijar). La columna es sólo un hint
 * para filtrar en SQL. Todo lo que decida comportamiento — mostrar, mover, fijar — usa esta función.
 */
export function estadoDerivado(
  has: number,
  qqHaCuota: number,
  fijaciones: Pick<VentaArrendamiento, 'tons'>[],
  fechaCobro: string,
  hoy = new Date(),
): EstadoCuota {
  const total = tonsCuota(Number(has), Number(qqHaCuota))
  const fijado = tonsFijadas(fijaciones)

  if (fijado >= total - 0.001) return 'fijado'
  if (fijado > 0) return 'parcial'
  // Sin fijar y ya pasó la fecha de cobro → las tons quedan disponibles a fijar
  return new Date(fechaCobro) < hoy ? 'disponible' : 'presupuestado'
}

/**
 * Pizarra disponible: el cobro cae a N días corridos de la FECHA DE FIJACIÓN
 * (que es la fecha de la venta, y no necesariamente hoy).
 * `dias` sale del contrato; el default es sólo un fallback.
 */
export function fechaCobroPizarra(
  fechaFijacion: string | Date,
  dias = DIAS_COBRO_PIZARRA_DEFAULT,
): string {
  const d = typeof fechaFijacion === 'string'
    ? new Date(fechaFijacion + 'T00:00:00')
    : new Date(fechaFijacion)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Fecha más temprana a la que se puede mover un disponible: hoy + N días corridos. */
export function fechaMinimaDisponible(hoy = new Date(), dias = DIAS_COBRO_PIZARRA_DEFAULT): string {
  return fechaCobroPizarra(hoy, dias)
}

// ── Reglas de movimiento ──────────────────────────────────────────────────────

export interface ResultadoMover {
  permitido: boolean
  motivo?: string
  /** Al mover, la posición pasa a ser el mes destino. */
  nuevaPosicion?: { anio: number; mes: number }
}

/**
 * Reglas (DISEÑO_PRESUPUESTO.md § Estados y reglas de movimiento):
 *  - fijado    → NO se mueve (ya generó factura).
 *  - presupuestado → sólo hacia ADELANTE.
 *  - disponible/parcial → cualquier dirección, piso hoy + N días corridos (N = plazo
 *    de cobro del contrato: Sanpa 15, default 20).
 *  - Al mover, la posición pasa a ser el mes destino.
 *
 * ⚠️ `cuota.estado` debe venir de `estadoDerivado()`, NO de la columna de la BD (ver allí el porqué).
 */
export function puedeMoverCuota(
  cuota: Pick<CuotaArrendamiento, 'estado' | 'fecha_cobro_estimada'>,
  nuevaFecha: string,
  hoy = new Date(),
  diasCobro = DIAS_COBRO_PIZARRA_DEFAULT,
): ResultadoMover {
  if (cuota.estado === 'fijado') {
    return { permitido: false, motivo: 'La cuota ya está fijada y generó factura: no se puede mover.' }
  }

  const destino = new Date(nuevaFecha)
  const actual = new Date(cuota.fecha_cobro_estimada)

  if (cuota.estado === 'presupuestado' && destino < actual) {
    return {
      permitido: false,
      motivo: 'Una cuota presupuestada sólo se puede mover hacia adelante.',
    }
  }

  if (cuota.estado === 'disponible' || cuota.estado === 'parcial') {
    const minima = new Date(fechaMinimaDisponible(hoy, diasCobro) + 'T00:00:00')
    if (destino < minima) {
      return {
        permitido: false,
        motivo: `Lo antes que puede cobrarse es ${minima.toLocaleDateString('es-AR')} (hoy + ${diasCobro} días corridos).`,
      }
    }
  }

  const [anio, mes] = nuevaFecha.split('-').map(Number)
  return { permitido: true, nuevaPosicion: { anio, mes } }
}

// ── Impuestos derivados ───────────────────────────────────────────────────────

/** Ganancias 6%: se descuenta del cobro (menor ingreso), sobre el neto. */
export function deduccionGanancias(montoNeto: number): number {
  return montoNeto * ALICUOTA_GANANCIAS_ARRENDAMIENTO
}

/**
 * IIBB (B) — pago mensual al fisco: 5% del neto cobrado, MENOS las retenciones (A)
 * que le practicaron al cobrar. Vence el mes SIGUIENTE al cobro.
 * Las retenciones sufridas NO se presupuestan: entran sólo cuando el cobro ocurre.
 */
export function iibbAPagar(montoNeto: number, retencionesSufridas = 0): number {
  return Math.max(0, montoNeto * ALICUOTA_IIBB_ARRENDAMIENTO - retencionesSufridas)
}

/** Mes en que se paga el IIBB de un cobro: el siguiente. Devuelve 'YYYY-MM'. */
export function mesPagoIIBB(fechaCobro: string): string {
  const [anio, mes] = fechaCobro.split('-').map(Number)
  const d = new Date(anio, mes, 1) // mes es 1-based → new Date(anio, mes) ya es el siguiente
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Neto que efectivamente entra: bruto − ganancias 6% − retención IIBB sufrida (si la hay). */
export function cobroNeto(montoBruto: number, retencionIIBBSufrida = 0): number {
  return montoBruto - deduccionGanancias(montoBruto) - retencionIIBBSufrida
}
