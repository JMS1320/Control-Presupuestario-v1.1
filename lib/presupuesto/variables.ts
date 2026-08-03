// Variables de presupuesto — el cálculo.
//
// Todas las matemáticas de un costo presupuestable son la MISMA:
//
//        monto  =  CANTIDAD  ×  PRECIO  ×  (ajuste₁ × ajuste₂ × …)
//
// Lo que cambia es de dónde sale cada pieza. Sanidad = cabezas × $/cabeza.
// Maíz = toneladas × cotización. IATF = (cabezas × 9 kg) × precio del novillo.
// Jornales = días × valor del jornal. Sueldo = 1 × sueldo.
//
// Por eso hay una sola función de cálculo y no una por tipo de costo: si cada
// costo nuevo pidiera código, el modelo habría fallado.
//
// La distribución en el año es un paso aparte y posterior: primero cuánto vale
// el concepto, después en qué meses cae.

export type FuenteCantidad = 'manual' | 'cabezas' | 'hectareas' | 'dias' | 'derivada'
export type FuentePrecio = 'manual' | 'grano' | 'hacienda' | 'insumo' | 'historia'
export type Distribucion = 'mensual' | 'un_mes' | 'calendario' | 'cupo_anual'
export type TipoAjuste = 'ipc' | 'porcentaje' | 'variacion' | 'desvio_historico'

export const ETIQUETA_FUENTE_CANTIDAD: Record<FuenteCantidad, string> = {
  manual: 'A mano',
  cabezas: 'Cabezas del rodeo',
  hectareas: 'Hectáreas de la actividad',
  dias: 'Días',
  derivada: 'Derivada de otra cantidad',
}

export const ETIQUETA_FUENTE_PRECIO: Record<FuentePrecio, string> = {
  manual: 'A mano',
  grano: 'Cotización de grano',
  hacienda: 'Precio de hacienda ($/kg)',
  insumo: 'Precio del insumo',
  historia: 'Historia de la cuenta',
}

export const ETIQUETA_DISTRIBUCION: Record<Distribucion, string> = {
  mensual: 'Todos los meses',
  un_mes: 'Un solo mes',
  calendario: 'Meses fijos',
  cupo_anual: 'Cupo anual (se arrastra)',
}

export const ETIQUETA_AJUSTE: Record<TipoAjuste, string> = {
  ipc: 'IPC',
  porcentaje: '% a mano',
  variacion: 'Variación de una magnitud',
  desvio_historico: 'Desvío contra lo realmente gastado',
}

export interface Ajuste {
  id?: string
  orden: number
  tipo: TipoAjuste
  valor: number | null
  referencia?: string | null
  nota?: string | null
}

export interface Variable {
  id?: string
  concepto: string
  nro_cuenta?: string | null
  centro_costo_id?: string | null
  unidad?: string | null
  cantidad: number | null
  fuente_cantidad: FuenteCantidad
  factor?: number | null
  precio: number | null
  fuente_precio: FuentePrecio
  referencia_precio?: string | null
  distribucion: Distribucion
  meses?: number[] | null
  fundamento?: string | null
  pendiente_a_proposito?: boolean
}

/** Lo que el cálculo necesita saber del mundo para resolver las fuentes externas. */
export interface ContextoVariable {
  /** Cabezas proyectadas del rodeo. */
  cabezas?: number | null
  /** Hectáreas de la actividad en la campaña. */
  hectareas?: number | null
  /** Inflación acumulada a aplicar cuando el ajuste es IPC (ej. 0.87 = 87 %). */
  ipcAcumulado?: number | null
  /** Cotizaciones ya resueltas a pesos, por referencia ("Soja", "Novillo"). */
  precios?: Record<string, number>
  /** Cantidad de la variable de la que ésta deriva. */
  cantidadOrigen?: number | null
}

export interface Paso {
  etiqueta: string
  detalle: string
  /** El valor acumulado DESPUÉS de este paso. */
  acumulado: number
}

export interface ResultadoVariable {
  monto: number
  cantidad: number
  precio: number
  /** La conformación paso a paso. Es lo que se muestra: el usuario pidió ver la cadena. */
  pasos: Paso[]
  /** Lo que falta para que el número sea confiable. Vacío = está completo. */
  faltantes: string[]
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

/**
 * Resuelve la CANTIDAD según su fuente.
 * Devuelve `null` cuando la fuente existe pero el dato todavía no: eso NO es cero,
 * es "falta cargarlo", y la diferencia importa para el control de cobertura.
 */
function resolverCantidad(v: Variable, ctx: ContextoVariable): { valor: number | null; detalle: string } {
  switch (v.fuente_cantidad) {
    case 'cabezas': {
      const c = ctx.cabezas
      if (c == null) return { valor: null, detalle: 'faltan las cabezas proyectadas' }
      const f = v.factor ?? 1
      return f === 1
        ? { valor: c, detalle: `${num(c)} cabezas` }
        : { valor: c * f, detalle: `${num(c)} cabezas × ${num(f)}` }
    }
    case 'hectareas': {
      const h = ctx.hectareas
      if (h == null) return { valor: null, detalle: 'faltan las hectáreas de la actividad' }
      const f = v.factor ?? 1
      return f === 1
        ? { valor: h, detalle: `${num(h)} ha` }
        : { valor: h * f, detalle: `${num(h)} ha × ${num(f)}` }
    }
    case 'derivada': {
      const o = ctx.cantidadOrigen
      if (o == null) return { valor: null, detalle: 'falta la cantidad de origen' }
      const f = v.factor ?? 1
      return { valor: o * f, detalle: `${num(o)} × ${num(f)}` }
    }
    case 'dias':
    case 'manual':
    default: {
      if (v.cantidad == null) return { valor: null, detalle: 'falta la cantidad' }
      return { valor: v.cantidad, detalle: `${num(v.cantidad)}${v.unidad ? ' ' + v.unidad : ''}` }
    }
  }
}

/** Resuelve el PRECIO unitario según su fuente. */
function resolverPrecio(v: Variable, ctx: ContextoVariable): { valor: number | null; detalle: string } {
  if (v.fuente_precio === 'manual' || v.fuente_precio === 'historia') {
    if (v.precio == null) {
      return {
        valor: null,
        detalle: v.fuente_precio === 'historia' ? 'falta resolver el precio desde la historia' : 'falta el precio',
      }
    }
    return { valor: v.precio, detalle: pesos(v.precio) }
  }
  // grano · hacienda · insumo: salen de una serie de precios, por referencia.
  const ref = v.referencia_precio
  if (!ref) return { valor: null, detalle: 'falta elegir de qué precio se toma' }
  const p = ctx.precios?.[ref]
  if (p == null) return { valor: null, detalle: `no hay precio cargado para ${ref}` }
  return { valor: p, detalle: `${ref}: ${pesos(p)}` }
}

/**
 * El monto de un concepto, con la conformación paso a paso.
 *
 * Los `pasos` no son un extra de presentación: el usuario pidió explícitamente ver cómo se
 * arma el precio final. Un número que no se puede explicar no sirve para decidir.
 */
export function calcularVariable(
  v: Variable,
  ajustes: Ajuste[],
  ctx: ContextoVariable = {},
): ResultadoVariable {
  const faltantes: string[] = []
  const pasos: Paso[] = []

  const c = resolverCantidad(v, ctx)
  const p = resolverPrecio(v, ctx)
  if (c.valor == null) faltantes.push(c.detalle)
  if (p.valor == null) faltantes.push(p.detalle)

  const cantidad = c.valor ?? 0
  const precio = p.valor ?? 0
  let acum = cantidad * precio

  pasos.push({ etiqueta: 'Cantidad', detalle: c.detalle, acumulado: cantidad })
  pasos.push({ etiqueta: 'Precio', detalle: p.detalle, acumulado: precio })
  pasos.push({ etiqueta: 'Base', detalle: `${c.detalle} × ${p.detalle}`, acumulado: acum })

  for (const a of [...ajustes].sort((x, y) => x.orden - y.orden)) {
    let factor = 1
    let detalle = ''
    switch (a.tipo) {
      case 'ipc': {
        const i = ctx.ipcAcumulado
        if (i == null) { faltantes.push('falta el IPC para el ajuste'); detalle = 'IPC sin cargar'; break }
        factor = 1 + i
        detalle = `IPC ${(i * 100).toFixed(1)} %`
        break
      }
      case 'porcentaje': {
        if (a.valor == null) { faltantes.push('falta el % del ajuste'); detalle = '% sin cargar'; break }
        factor = 1 + a.valor / 100
        detalle = `${a.valor > 0 ? '+' : ''}${num(a.valor)} %`
        break
      }
      case 'variacion':
      case 'desvio_historico': {
        if (a.valor == null) {
          faltantes.push(`falta el valor de "${ETIQUETA_AJUSTE[a.tipo]}"`)
          detalle = 'sin cargar'
          break
        }
        factor = 1 + a.valor / 100
        detalle = `${ETIQUETA_AJUSTE[a.tipo]}: ${a.valor > 0 ? '+' : ''}${num(a.valor)} %`
        break
      }
    }
    acum = acum * factor
    pasos.push({ etiqueta: ETIQUETA_AJUSTE[a.tipo], detalle, acumulado: acum })
  }

  return { monto: acum, cantidad, precio, pasos, faltantes }
}

/**
 * En qué meses cae el monto anual.
 *
 * `cupo_anual` devuelve el total en el primer mes elegido a propósito: el arrastre real
 * (que lo no ejecutado se corra al mes siguiente en vez de evaporarse) necesita saber lo
 * ejecutado, y eso todavía no está — ver P-10/P-17. Mientras tanto no se reparte en doce,
 * porque eso mostraría un gasto mensual que no existe.
 */
export function repartirEnMeses(
  v: Variable,
  montoAnual: number,
  meses: { anio: number; mes: number }[],
): Record<string, number> {
  const clave = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}`
  const out: Record<string, number> = {}
  for (const m of meses) out[clave(m.anio, m.mes)] = 0
  if (meses.length === 0) return out

  switch (v.distribucion) {
    case 'mensual': {
      const porMes = montoAnual / 12
      for (const m of meses) out[clave(m.anio, m.mes)] = porMes
      return out
    }
    case 'calendario': {
      const elegidos = (v.meses ?? []).filter(n => n >= 1 && n <= 12)
      if (elegidos.length === 0) return out
      const porMes = montoAnual / elegidos.length
      for (const m of meses) if (elegidos.includes(m.mes)) out[clave(m.anio, m.mes)] = porMes
      return out
    }
    case 'un_mes':
    case 'cupo_anual':
    default: {
      const elegido = (v.meses ?? [])[0]
      const destino = meses.find(m => m.mes === elegido) ?? meses[0]!
      out[clave(destino.anio, destino.mes)] = montoAnual
      return out
    }
  }
}
