// Capa compartida (UI-agnóstica): fórmulas de arrendamientos agrícolas.
// Fuente única para Ventas, Presupuesto y Cash Flow — que nadie recalcule por su cuenta.
// Diseño: DISEÑO_PRESUPUESTO.md § INGRESOS — Arrendamientos agrícolas.

// ── Constantes de negocio ─────────────────────────────────────────────────────

/** IIBB: 5% de cada cobro, se paga el mes SIGUIENTE (template IIBB Mensual). */
export const ALICUOTA_IIBB = 0.05
/** Ganancias: 6% deducido del cobro (menor ingreso, sobre el neto). */
export const ALICUOTA_GANANCIAS = 0.06
/** Pizarra Rosario disponible: se cobra a los 20 días corridos de la fijación. */
export const DIAS_COBRO_PIZARRA = 20
/** Arrendamiento agrícola: exento de IVA. */
export const EXENTO_IVA = true

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

export interface FijacionArrendamiento {
  id: string
  cuota_id: string
  fecha_fijacion: string
  tons: number
  modo: 'matba' | 'pizarra'
  precio_usd: number | null
  precio_pesos: number | null
  tc: number | null
  monto_pesos: number
  fecha_cobro: string
  comprobante_id: string | null
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
 * Precio de una posición. Si el mes pedido no está cargado, toma el SIGUIENTE mes
 * con precio y lo marca como arrastrado (la UI debe distinguirlo visualmente).
 */
export function resolverPrecio(
  precios: PrecioGrano[],
  grano: string,
  anio: number,
  mes: number,
): PrecioResuelto {
  const delGrano = precios
    .filter(p => p.grano === grano)
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)

  const exacto = delGrano.find(p => p.anio === anio && p.mes === mes)
  if (exacto) {
    return { precio_usd: Number(exacto.precio_usd), arrastrado: false, posicion: { anio, mes } }
  }

  const siguiente = delGrano.find(p => p.anio > anio || (p.anio === anio && p.mes > mes))
  if (siguiente) {
    return {
      precio_usd: Number(siguiente.precio_usd),
      arrastrado: true,
      posicion: { anio: siguiente.anio, mes: siguiente.mes },
    }
  }

  return { precio_usd: 0, arrastrado: false, posicion: null }
}

/**
 * TC del mes: prioriza el real; si no hay, el presupuestado.
 * Si el mes no está cargado arrastra el ANTERIOR más cercano y, si tampoco hay
 * (el mes pedido es previo a todo lo cargado), el SIGUIENTE más cercano.
 * El fallback tiene que ser bidireccional: si no, una cuota vencida en un mes
 * sin TC previo queda valuada en $0 y desaparece de la vista.
 */
export function resolverTC(tcs: TipoCambio[], anio: number, mes: number): { tc: number; arrastrado: boolean } {
  const valorDe = (t: TipoCambio) => t.tc_real ?? t.tc_presupuestado

  const exacto = tcs.find(t => t.anio === anio && t.mes === mes)
  if (exacto && valorDe(exacto) != null) return { tc: Number(valorDe(exacto)), arrastrado: false }

  const previos = tcs
    .filter(t => valorDe(t) != null && (t.anio < anio || (t.anio === anio && t.mes < mes)))
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes)
  if (previos.length) return { tc: Number(valorDe(previos[0]!)), arrastrado: true }

  const siguientes = tcs
    .filter(t => valorDe(t) != null && (t.anio > anio || (t.anio === anio && t.mes > mes)))
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
  if (siguientes.length) return { tc: Number(valorDe(siguientes[0]!)), arrastrado: true }

  return { tc: 0, arrastrado: false }
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
export function tonsFijadas(fijaciones: Pick<FijacionArrendamiento, 'tons'>[]): number {
  return fijaciones.reduce((s, f) => s + Number(f.tons || 0), 0)
}

/** Tons todavía disponibles a fijar = tons_cuota − Σ fijaciones. */
export function tonsDisponibles(
  has: number,
  qqHaCuota: number,
  fijaciones: Pick<FijacionArrendamiento, 'tons'>[],
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
  fijaciones: Pick<FijacionArrendamiento, 'tons'>[],
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

/** Pizarra Rosario disponible: el cobro cae a los 20 días corridos de la fijación. */
export function fechaCobroPizarra(fechaFijacion: string | Date): string {
  const d = new Date(fechaFijacion)
  d.setDate(d.getDate() + DIAS_COBRO_PIZARRA)
  return d.toISOString().slice(0, 10)
}

/** Fecha más temprana a la que se puede mover un disponible: hoy + 20 días corridos. */
export function fechaMinimaDisponible(hoy = new Date()): string {
  return fechaCobroPizarra(hoy)
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
 *  - disponible/parcial → cualquier dirección, piso hoy + 20 días corridos.
 *  - Al mover, la posición pasa a ser el mes destino.
 *
 * ⚠️ `cuota.estado` debe venir de `estadoDerivado()`, NO de la columna de la BD (ver allí el porqué).
 */
export function puedeMoverCuota(
  cuota: Pick<CuotaArrendamiento, 'estado' | 'fecha_cobro_estimada'>,
  nuevaFecha: string,
  hoy = new Date(),
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
    const minima = new Date(fechaMinimaDisponible(hoy))
    if (destino < minima) {
      return {
        permitido: false,
        motivo: `Lo antes que puede cobrarse es ${minima.toLocaleDateString('es-AR')} (hoy + ${DIAS_COBRO_PIZARRA} días corridos).`,
      }
    }
  }

  const [anio, mes] = nuevaFecha.split('-').map(Number)
  return { permitido: true, nuevaPosicion: { anio, mes } }
}

// ── Impuestos derivados ───────────────────────────────────────────────────────

/** Ganancias 6%: se descuenta del cobro (menor ingreso), sobre el neto. */
export function deduccionGanancias(montoNeto: number): number {
  return montoNeto * ALICUOTA_GANANCIAS
}

/**
 * IIBB (B) — pago mensual al fisco: 5% del neto cobrado, MENOS las retenciones (A)
 * que le practicaron al cobrar. Vence el mes SIGUIENTE al cobro.
 * Las retenciones sufridas NO se presupuestan: entran sólo cuando el cobro ocurre.
 */
export function iibbAPagar(montoNeto: number, retencionesSufridas = 0): number {
  return Math.max(0, montoNeto * ALICUOTA_IIBB - retencionesSufridas)
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
