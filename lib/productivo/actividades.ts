// Actividades productivas y sus costos directos.
//
// ── La decisión de arquitectura ──────────────────────────────────────────────
// El usuario fue explícito: *"costos directos debe ser algo que muta con la actividad
// propuesta. no será un template ni nada así. de acuerdo a la actividad se ponen los costos
// directos. así como para recría y engorde hay ciertos insumos y rindes, para cada actividad
// lo habrá."*
//
// O sea: el costo directo NO se registra en ningún lado (no es template, no es factura
// esperada). Es una CONSECUENCIA CALCULADA de la actividad que se decidió hacer. Cambiás la
// actividad y cambia el costo solo. Es la misma naturaleza que el IIBB de la venta de
// arrendamiento: una línea derivada que vive en el presupuesto.
//
// Y como cada actividad tiene sus propios insumos, la lista de costos NO puede ser un juego
// fijo de columnas (`pct_maiz`, `pct_concentrado`, …): tiene que ser una LISTA de ítems que el
// usuario arma. Recría son dos renglones, engorde otros, y la actividad que invente el año que
// viene tendrá los suyos sin tocar código ni migrar la tabla.
//
// ── Los rindes viven con la actividad ────────────────────────────────────────
// La actividad también lleva el RINDE: ganancia diaria y mortandad. Eso es lo que hace que
// asignarla defina el ingreso Y el costo de una sola vez — la curva de peso con la que se
// factura la venta y los kilos de maíz que se compran salen del mismo número, así que no
// pueden describir dos animales distintos. Ver PENDIENTES § FASE C · C-4.

import { racionDiariaKg, pesoFinal, pesoPromedio } from './racion'
import { resolverSerie, type PuntoSerie } from '../precios/serie'

// ── Modelo ────────────────────────────────────────────────────────────────────

export type TipoActividad = 'recria' | 'engorde' | 'pastoreo' | 'cria' | 'agricola' | 'otro'

/** Las agrícolas no comen: no usan ración ni ganancia diaria. */
export function usaRacion(tipo: TipoActividad): boolean {
  return tipo !== 'agricola'
}

export interface Actividad {
  id: string
  empresa: string
  tipo: TipoActividad
  nombre: string
  /** El RINDE: kg que gana por cabeza y por día. Manda sobre la curva de peso del lote. */
  ganancia_diaria_kg: number
  /** Ración diaria como % del peso vivo. Fracción: 1,5 % → 0.015. */
  racion_pct_pv: number
  /** Fracción. */
  pct_mortandad: number
  notas: string | null
  activo: boolean
}

/**
 * Cómo escala un costo. Es lo que decide tanto el CUÁNTO como el CUÁNDO, y cubre las tres
 * familias que no se calculan igual (por cabeza-día, por cabeza-evento, por hectárea).
 */
export type ModoCosto =
  /** % de la ración diaria. Maíz 85 %, concentrado 15 %. → diario */
  | 'pct_racion'
  /** Kilos fijos por cabeza y por día, al margen de la ración. → diario */
  | 'kg_cabeza_dia'
  /** Unidades por cabeza y por mes (sal, minerales). → mensual */
  | 'unid_cabeza_mes'
  /** Dosis por cabeza en un momento puntual (vacuna). → según `momento` */
  | 'unid_cabeza_evento'
  /** Una dosis cada N kg de peso vivo — el modelo que ya usa `lineas_orden_aplicacion`. */
  | 'dosis_cada_kg'
  /** Monto fijo por cabeza en todo el tramo (flete, comisión). → según `momento` */
  | 'monto_cabeza'
  /** Monto por hectárea: el verdeo. NO escala con cabezas. → según `momento` */
  | 'monto_ha'
  /** Monto fijo por mes (alquiler de campo, personal afectado). → mensual */
  | 'monto_mes'
  /**
   * El costo es un % de LO PRODUCIDO, no una cantidad por una cantidad: cosecha,
   * aparcería, comisiones. Necesita que el tramo traiga `valor_produccion`.
   */
  | 'pct_produccion'

/** Cuándo cae el gasto dentro del tramo. */
export type MomentoCosto = 'diario' | 'mensual' | 'inicio' | 'fin' | 'ciclo'


export interface InsumoActividad {
  id: string
  actividad_id: string
  orden: number
  /** "Maíz", "Concentrado", "Sal", "Siembra verdeo". */
  concepto: string
  modo: ModoCosto
  /** El % (fracción), la cantidad o el monto, según el modo. */
  valor: number
  /** kg · dosis · ml · ha · $ — para mostrar y para netear contra el stock. */
  unidad: string | null
  momento: MomentoCosto
  /** ARS | USD. En USD el monto se pasa al TC presupuestado del mes del gasto. */
  moneda: 'ARS' | 'USD'
  /** $ por unidad. Si es null y hay `producto`, se puede tomar del stock. */
  precio_unitario: number | null
  /** Para descontar del stock real y calcular qué falta comprar. */
  categoria_insumo_id: string | null
  producto: string | null
  notas: string | null
}

/** El momento natural de cada modo, si el usuario no dice otra cosa. */
export const MOMENTO_POR_DEFECTO: Record<ModoCosto, MomentoCosto> = {
  pct_racion: 'diario',
  kg_cabeza_dia: 'diario',
  unid_cabeza_mes: 'mensual',
  unid_cabeza_evento: 'inicio',
  dosis_cada_kg: 'inicio',
  monto_cabeza: 'inicio',
  monto_ha: 'ciclo',
  monto_mes: 'mensual',
  pct_produccion: 'fin',
}

export const ETIQUETA_MODO: Record<ModoCosto, string> = {
  pct_racion: '% de la ración',
  kg_cabeza_dia: 'kg / cabeza / día',
  unid_cabeza_mes: 'unid. / cabeza / mes',
  unid_cabeza_evento: 'unid. / cabeza (evento)',
  dosis_cada_kg: 'dosis cada N kg de peso',
  monto_cabeza: '$ / cabeza',
  monto_ha: 'por hectárea',
  monto_mes: 'por mes',
  pct_produccion: '% de lo producido',
}

/** true si el modo se expresa directamente en pesos (no en cantidad × precio). */
export function esMontoDirecto(modo: ModoCosto): boolean {
  return modo === 'monto_cabeza' || modo === 'monto_ha' || modo === 'monto_mes'
    || modo === 'pct_produccion'
}

export const ETIQUETA_MOMENTO: Record<MomentoCosto, string> = {
  diario: 'todos los días',
  mensual: 'todos los meses',
  inicio: 'al empezar',
  fin: 'al terminar',
  ciclo: 'en el ciclo (se prorratea)',
}

// ── Tramo: la actividad aplicada a un lote entre dos fechas ───────────────────

export interface Tramo {
  actividad: Actividad
  insumos: InsumoActividad[]
  cabezas: number
  desde: string
  hasta: string
  /** Peso por cabeza al arrancar el tramo. */
  peso_inicial_kg: number
  /** Sólo para los costos por hectárea. */
  hectareas?: number
  /**
   * Valor de lo producido, para los costos que salen como % de eso (cosecha, aparcería).
   * En hacienda es la venta del lote; en agricultura, el valor del cultivo.
   */
  valor_produccion?: number
  /** Serie de TC presupuestado, para pasar a pesos los ítems cargados en USD. */
  tiposCambio?: PuntoSerie[]
}

export interface ConsumoMes {
  mes: string
  dias: number
  /** Peso promedio de la hacienda durante ese mes — la ración se sirve sobre esto. */
  peso_prom_kg: number
  /** Una entrada por ítem de costo. */
  items: {
    concepto: string
    modo: ModoCosto
    cantidad: number
    unidad: string | null
    costo: number
    /** Monto en la moneda de carga y el TC usado — para poder explicar el número. */
    moneda: 'ARS' | 'USD'
    monto_origen: number
    tc: number | null
    categoria_insumo_id: string | null
    producto: string | null
  }[]
  costo_total: number
}

const diasDelMes = (anio: number, mes: number) => new Date(anio, mes, 0).getDate()
const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Reparte el consumo del tramo mes a mes.
 *
 * El presupuesto es mensual, así que no alcanza con el total: hay que integrar. Para cada mes
 * se cuentan los días del tramo que caen adentro y se usa el peso promedio **de ese mes** — el
 * animal engorda, la ración es un % del peso vivo, así que el consumo diario sube a lo largo
 * del tramo. Usar el peso promedio de todo el período subestima el final y sobrestima el inicio.
 */
export function consumoMensual(t: Tramo): ConsumoMes[] {
  const desde = new Date(t.desde + 'T00:00:00')
  const hasta = new Date(t.hasta + 'T00:00:00')
  if (isNaN(desde.getTime()) || isNaN(hasta.getTime()) || hasta <= desde) return []

  const diasTotales = Math.round((hasta.getTime() - desde.getTime()) / 86400000)

  // ── Pasada 1: los meses con días, sin mirar los insumos todavía.
  //
  // Va aparte porque "el primero" y "el último" se saben recién cuando está la lista
  // entera. Calcularlos dentro del recorrido fallaba: con un tramo que termina un día 1
  // (oct→abr), el mes de abril tiene CERO días y se descarta, pero marzo tampoco daba
  // `esUltimo` porque su fin (31/3) es menor que `hasta` (1/4) — y los costos "al
  // terminar", como la cosecha, no caían nunca.
  const buckets: { anio: number; mes: number; dias: number }[] = []
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1)

  while (cursor <= hasta) {
    const anio = cursor.getFullYear()
    const mes = cursor.getMonth() + 1
    const finMes = new Date(anio, mes - 1, diasDelMes(anio, mes))

    const ini = cursor < desde ? desde : cursor
    const fin = finMes > hasta ? hasta : finMes
    const dias = Math.max(0, Math.round((fin.getTime() - ini.getTime()) / 86400000) + (iso(fin) === iso(hasta) ? 0 : 1))

    if (dias > 0) buckets.push({ anio, mes, dias })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  // ── Pasada 2: el costo de cada mes.
  const salida: ConsumoMes[] = []
  let diasAcumulados = 0

  buckets.forEach((b, idx) => {
    const { anio, mes, dias } = b
    // Peso al principio y al final del tramo que cae en este mes
    const pIni = t.peso_inicial_kg + diasAcumulados * t.actividad.ganancia_diaria_kg
    const pFin = pesoFinal(pIni, dias, t.actividad.ganancia_diaria_kg)
    const pProm = pesoPromedio(pIni, pFin)
    const racKgDia = racionDiariaKg(pProm, t.actividad.racion_pct_pv)

    const esPrimero = idx === 0
    const esUltimo = idx === buckets.length - 1

    const items: ConsumoMes['items'] = []
    for (const ins of t.insumos) {
      const { cantidad, aplica } = cantidadDelItem(ins, {
        racKgDia, dias, diasTotales, cabezas: t.cabezas, pesoProm: pProm,
        hectareas: t.hectareas ?? 0, valorProduccion: t.valor_produccion ?? 0,
        esPrimero, esUltimo,
      })
      if (!aplica || Math.abs(cantidad) < 1e-9) continue
      const bruto = esMontoDirecto(ins.modo) ? cantidad : cantidad * (ins.precio_unitario ?? 0)
      // USD → pesos al TC presupuestado del mes del gasto (arrastre hacia adelante,
      // misma serie que usa el arrendamiento).
      const tc = ins.moneda === 'USD'
        ? resolverSerie(t.tiposCambio ?? [], anio, mes).valor
        : null
      const costo = ins.moneda === 'USD' ? bruto * (tc || 0) : bruto
      items.push({
        concepto: ins.concepto, modo: ins.modo, cantidad,
        unidad: esMontoDirecto(ins.modo) ? (ins.moneda === 'USD' ? 'US$' : '$') : ins.unidad,
        costo, moneda: ins.moneda, monto_origen: bruto, tc,
        categoria_insumo_id: ins.categoria_insumo_id, producto: ins.producto,
      })
    }

    salida.push({
      mes: `${anio}-${String(mes).padStart(2, '0')}`,
      dias, peso_prom_kg: pProm, items,
      costo_total: items.reduce((s, i) => s + i.costo, 0),
    })
    diasAcumulados += dias
  })

  return salida
}

interface ContextoItem {
  racKgDia: number
  dias: number
  diasTotales: number
  cabezas: number
  pesoProm: number
  hectareas: number
  valorProduccion: number
  esPrimero: boolean
  esUltimo: boolean
}

/** Cantidad (o monto, si el modo es directo) del ítem en este mes. */
function cantidadDelItem(ins: InsumoActividad, c: ContextoItem): { cantidad: number; aplica: boolean } {
  // Los puntuales sólo caen en el mes que les toca
  const puntual = ins.momento === 'inicio' || ins.momento === 'fin'
  if (puntual && !(ins.momento === 'inicio' ? c.esPrimero : c.esUltimo)) {
    return { cantidad: 0, aplica: false }
  }
  // Un costo mensual en un mes partido se prorratea por los días que corresponden
  const proporcionMes = c.dias / 30

  /**
   * momento = 'ciclo': el monto pertenece al ciclo entero ("tantos USD por hectárea en el
   * cultivo de soja"), no a un día ni a un mes. Se prorratea por días sobre el tramo.
   *
   * ⚠️ PROVISORIO. El usuario lo dijo: *"luego el ver cómo se distribuye en el tiempo
   * tenemos que ver"*. Un cultivo NO gasta parejo — la siembra y la cosecha son picos.
   * El reparto uniforme da bien el TOTAL del ciclo pero mal el mes a mes. Ver FASE C · C-9.
   */
  const proporcionCiclo = c.diasTotales > 0 ? c.dias / c.diasTotales : 1
  const escalaMomento = ins.momento === 'ciclo' ? proporcionCiclo : 1

  switch (ins.modo) {
    case 'pct_racion':
      return { cantidad: c.racKgDia * ins.valor * c.dias * c.cabezas, aplica: true }
    case 'kg_cabeza_dia':
      return { cantidad: ins.valor * c.dias * c.cabezas, aplica: true }
    case 'unid_cabeza_mes':
      return { cantidad: ins.valor * proporcionMes * c.cabezas, aplica: true }
    case 'unid_cabeza_evento':
      return { cantidad: ins.valor * c.cabezas, aplica: true }
    case 'dosis_cada_kg':
      // "1 dosis cada 50 kg" → valor = 50
      return { cantidad: ins.valor > 0 ? (c.pesoProm / ins.valor) * c.cabezas : 0, aplica: true }
    case 'monto_cabeza':
      return { cantidad: ins.valor * c.cabezas * escalaMomento, aplica: true }
    case 'monto_ha':
      return { cantidad: ins.valor * c.hectareas * escalaMomento, aplica: true }
    case 'monto_mes':
      return { cantidad: ins.valor * proporcionMes, aplica: true }
    case 'pct_produccion':
      // El costo sale de lo producido: cosecha, aparcería. Sin valor de producción da 0
      // y la UI avisa, en vez de inventar un número.
      return { cantidad: c.valorProduccion * ins.valor * escalaMomento, aplica: true }
    default:
      return { cantidad: 0, aplica: false }
  }
}

/** Suma el costo de varios tramos por mes — lo que consume el presupuesto. */
export function costoPorMes(tramos: Tramo[]): Record<string, number> {
  const total: Record<string, number> = {}
  for (const t of tramos) {
    for (const m of consumoMensual(t)) total[m.mes] = (total[m.mes] || 0) + m.costo_total
  }
  return total
}

/** Cantidad física por insumo y por mes — la base para saber qué falta comprar (C-6). */
export function cantidadPorInsumo(tramos: Tramo[]): Record<string, { concepto: string; unidad: string | null; porMes: Record<string, number>; total: number }> {
  const acc: Record<string, { concepto: string; unidad: string | null; porMes: Record<string, number>; total: number }> = {}
  for (const t of tramos) {
    for (const m of consumoMensual(t)) {
      for (const i of m.items) {
        if (esMontoDirecto(i.modo)) continue // no es una cantidad física
        const k = i.producto || i.concepto
        const a = acc[k] ?? { concepto: i.concepto, unidad: i.unidad, porMes: {}, total: 0 }
        a.porMes[m.mes] = (a.porMes[m.mes] || 0) + i.cantidad
        a.total += i.cantidad
        acc[k] = a
      }
    }
  }
  return acc
}
