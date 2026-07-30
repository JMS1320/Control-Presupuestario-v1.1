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

// ── Modelo ────────────────────────────────────────────────────────────────────

export type TipoActividad = 'recria' | 'engorde' | 'pastoreo' | 'cria' | 'otro'

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

/** Cuándo cae el gasto dentro del tramo. */
export type MomentoCosto = 'diario' | 'mensual' | 'inicio' | 'fin'

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
  monto_ha: 'inicio',
  monto_mes: 'mensual',
}

export const ETIQUETA_MODO: Record<ModoCosto, string> = {
  pct_racion: '% de la ración',
  kg_cabeza_dia: 'kg / cabeza / día',
  unid_cabeza_mes: 'unid. / cabeza / mes',
  unid_cabeza_evento: 'unid. / cabeza (evento)',
  dosis_cada_kg: 'dosis cada N kg de peso',
  monto_cabeza: '$ / cabeza',
  monto_ha: '$ / hectárea',
  monto_mes: '$ / mes',
}

/** true si el modo se expresa directamente en pesos (no en cantidad × precio). */
export function esMontoDirecto(modo: ModoCosto): boolean {
  return modo === 'monto_cabeza' || modo === 'monto_ha' || modo === 'monto_mes'
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
  const salida: ConsumoMes[] = []

  // Recorrido mes a mes desde el mes del inicio hasta el del fin
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1)
  let diasAcumulados = 0

  while (cursor <= hasta) {
    const anio = cursor.getFullYear()
    const mes = cursor.getMonth() + 1
    const finMes = new Date(anio, mes - 1, diasDelMes(anio, mes))

    const ini = cursor < desde ? desde : cursor
    const fin = finMes > hasta ? hasta : finMes
    const dias = Math.max(0, Math.round((fin.getTime() - ini.getTime()) / 86400000) + (iso(fin) === iso(hasta) ? 0 : 1))

    if (dias > 0) {
      // Peso al principio y al final del tramo que cae en este mes
      const pIni = t.peso_inicial_kg + diasAcumulados * t.actividad.ganancia_diaria_kg
      const pFin = pesoFinal(pIni, dias, t.actividad.ganancia_diaria_kg)
      const pProm = pesoPromedio(pIni, pFin)
      const racKgDia = racionDiariaKg(pProm, t.actividad.racion_pct_pv)

      const esPrimero = ini <= desde
      const esUltimo = fin >= hasta

      const items: ConsumoMes['items'] = []
      for (const ins of t.insumos) {
        const { cantidad, aplica } = cantidadDelItem(ins, {
          racKgDia, dias, diasTotales, cabezas: t.cabezas, pesoProm: pProm,
          hectareas: t.hectareas ?? 0, esPrimero, esUltimo,
        })
        if (!aplica || Math.abs(cantidad) < 1e-9) continue
        const costo = esMontoDirecto(ins.modo) ? cantidad : cantidad * (ins.precio_unitario ?? 0)
        items.push({
          concepto: ins.concepto, modo: ins.modo, cantidad,
          unidad: esMontoDirecto(ins.modo) ? '$' : ins.unidad,
          costo,
          categoria_insumo_id: ins.categoria_insumo_id, producto: ins.producto,
        })
      }

      salida.push({
        mes: `${anio}-${String(mes).padStart(2, '0')}`,
        dias, peso_prom_kg: pProm, items,
        costo_total: items.reduce((s, i) => s + i.costo, 0),
      })
      diasAcumulados += dias
    }

    cursor.setMonth(cursor.getMonth() + 1)
  }

  return salida
}

interface ContextoItem {
  racKgDia: number
  dias: number
  diasTotales: number
  cabezas: number
  pesoProm: number
  hectareas: number
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
      return { cantidad: ins.valor * c.cabezas, aplica: true }
    case 'monto_ha':
      return { cantidad: ins.valor * c.hectareas, aplica: true }
    case 'monto_mes':
      return { cantidad: ins.valor * proporcionMes, aplica: true }
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
