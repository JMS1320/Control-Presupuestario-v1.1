// Cabezas disponibles para vender que TODAVÍA no tienen venta presupuestada.
//
// La idea es la misma que las toneladas de soja disponibles a fijar: el presupuesto no
// sólo muestra lo que se va a cobrar, también avisa que hay hacienda parada sin vender
// para que no se la olvide.
//
// ── Por qué "por diferencia" ─────────────────────────────────────────────────
// El lote NO es la fuente de verdad de cuántas cabezas hay: es un recorte que el usuario
// arma cuando decide vender. Si de 98 machos arma un lote con los 55 más pesados, los 43
// restantes no están en ninguna tabla de lotes. Existen igual.
//
// Entonces la existencia sale de la FUENTE (la pesada para el stock de hoy, el ciclo para
// los destetes futuros) y lo disponible es la resta:
//
//     disponible = existencia − lo que ya está comprometido en un lote CON fecha de venta
//
// Un lote SIN fecha de venta no se resta: no hay venta presupuestada, así que sigue
// contando como disponible (y no se duplica, porque salió de la misma existencia).
//
// ── El promedio del saldo ────────────────────────────────────────────────────
// El peso promedio de lo que queda NO es el promedio general. Si se venden los más
// pesados, los que quedan pesan menos. Por eso se restan también los KILOS y se divide:
//
//     98 cab · 245,5 kg prom = 24.063 kg
//     − 55 cab · 275,2 kg    =  −15.137 kg
//     ────────────────────────────────────
//       43 cab ·  8.926 kg  → 207,6 kg prom     ← baja, como tiene que bajar
//
// Los dos lados tienen que estar medidos a la MISMA fecha, si no se mezclan kilos de
// momentos distintos. Por eso se usa `peso_base_kg` del lote (el peso a `fecha_peso`,
// que es la pesada) y no el peso proyectado a la venta, que ya tiene la ganancia diaria.

import type { LoteStock, VentaStock } from './ciclo'
import { cantidadDisponible } from './ciclo'
import { categoriaDeTernero, esVendible } from '../productivo/caravanas'

/**
 * De qué tropa sale la cabeza. Es lo que permite netear bien: NO se puede cruzar por
 * nombre de categoría, porque el mismo animal se llama "al Pie" si se vende en el destete
 * y "Recría" si se vende después — cruzar por el nombre haría que el lote no netee contra
 * su propia existencia y el disponible saldría duplicado.
 *
 *   `pesada|macho`      → el stock que hay hoy
 *   `ciclo:<uuid>|hembra` → el destete de ese ciclo
 */
export type ClaveTropa = string

export function sexoDeCategoria(categoria: string): 'macho' | 'hembra' {
  return /ternera|vaquillona|vaca/i.test(categoria) ? 'hembra' : 'macho'
}

/** Cabezas que existen, de dónde salen y desde cuándo están para vender. */
export interface ExistenciaHacienda {
  /** Con qué lotes puede netear. */
  clave: ClaveTropa
  categoria: string
  /** Mes en que quedan disponibles, `YYYY-MM`. */
  mes: string
  cabezas: number
  /** Kilos totales a la fecha de medición (NO proyectados a una venta). */
  kg: number
  origen: 'pesada' | 'destete'
  /** Para poder explicar de dónde salió: "pesada del 6/7" o "destete 26/27". */
  detalle?: string
}

export interface DisponibleCategoria {
  categoria: string
  mes: string
  cabezas: number
  kg: number
  peso_prom: number
  clave: ClaveTropa
  /** Para el tooltip: cuántas había y cuántas ya tienen venta. */
  existentes: number
  comprometidas: number
  origen: 'pesada' | 'destete'
  detalle?: string
}

/**
 * Tropa de un lote: si vino de un destete es la de ese ciclo, si no es el stock de hoy.
 */
export function claveDeLote(lote: Pick<LoteStock, 'ciclo_id' | 'categoria'>): ClaveTropa {
  const sexo = sexoDeCategoria(lote.categoria)
  return lote.ciclo_id ? `ciclo:${lote.ciclo_id}|${sexo}` : `pesada|${sexo}`
}

/**
 * Existencia − lotes con venta presupuestada, por tropa.
 *
 * Devuelve sólo las categorías donde queda saldo. Si la existencia es menor que lo
 * comprometido (el usuario cargó lotes a mano por encima de la pesada) el saldo da
 * cero y no se informa nada: no tiene sentido mostrar disponible negativo.
 */
export function disponiblePorDiferencia(
  existencias: ExistenciaHacienda[],
  lotes: LoteStock[],
  ventas: VentaStock[],
): DisponibleCategoria[] {
  // Kilos y cabezas ya comprometidos en una venta presupuestada, por categoría.
  // Se mide con el peso BASE del lote para que sea comparable con la existencia.
  const comprometido: Record<ClaveTropa, { cabezas: number; kg: number }> = {}
  for (const l of lotes) {
    if (!l.fecha_venta_estimada) continue
    const cab = cantidadDisponible(l, ventas.filter(v => v.lote_id === l.id))
    if (cab <= 0.01) continue
    const clave = claveDeLote(l)
    const acc = comprometido[clave] ?? { cabezas: 0, kg: 0 }
    acc.cabezas += cab
    acc.kg += cab * (Number(l.peso_base_kg) || 0)
    comprometido[clave] = acc
  }

  // Las existencias se agrupan por tropa: la misma tropa puede disponibilizarse en más
  // de un momento, y lo comprometido se descuenta contra la suya, no contra otra.
  const porClave: Record<ClaveTropa, ExistenciaHacienda[]> = {}
  for (const e of existencias) {
    if (e.cabezas <= 0.01) continue
    ;(porClave[e.clave] ??= []).push(e)
  }

  const salida: DisponibleCategoria[] = []

  for (const [clave, lista] of Object.entries(porClave)) {
    const ordenadas = [...lista].sort((a, b) => a.mes.localeCompare(b.mes))
    // Lo comprometido se descuenta de lo que se disponibiliza PRIMERO: lo que se vende
    // sale del stock que ya está, no del destete que todavía no llegó.
    let restaCab = comprometido[clave]?.cabezas ?? 0
    let restaKg = comprometido[clave]?.kg ?? 0

    for (const e of ordenadas) {
      // Los kilos se descuentan al peso promedio de lo comprometido, que es lo que hace
      // que el saldo baje cuando se venden los más pesados.
      const promComprometido = restaCab > 0 ? restaKg / restaCab : 0
      const usaCab = Math.min(restaCab, e.cabezas)
      const usaKg = Math.min(restaKg, usaCab * promComprometido)
      restaCab -= usaCab
      restaKg -= usaKg

      const cabezas = e.cabezas - usaCab
      if (cabezas <= 0.01) continue
      const kg = Math.max(0, e.kg - usaKg)
      salida.push({
        clave,
        categoria: e.categoria,
        mes: e.mes,
        cabezas,
        kg,
        peso_prom: cabezas > 0 ? kg / cabezas : 0,
        existentes: e.cabezas,
        comprometidas: usaCab,
        origen: e.origen,
        detalle: e.detalle,
      })
    }
  }

  return salida.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.mes.localeCompare(b.mes))
}

/**
 * Existencias que salen de la pesada: el stock que hay HOY.
 *
 * La categoría se deduce igual que en el panel de lotes — macho/hembra × torito — para
 * que las dos pantallas hablen de lo mismo. Los toritos y las terneras de reposición no
 * se venden, así que no son existencia vendible.
 */
export function existenciasDePesada(
  filas: { peso_kg: number | string; sexo: string; es_torito: boolean }[],
  mes: string,
  detalle?: string,
): ExistenciaHacienda[] {
  const acc: Record<string, { cabezas: number; kg: number }> = {}
  for (const f of filas) {
    // La categoría sale de `lib/productivo/caravanas.ts`, que es el único lugar donde se
    // interpreta `es_torito` — el flag significa cosas distintas según el sexo (torito en
    // un macho, ternera retenida en una hembra) y tenerlo escrito dos veces ya causó un bug.
    const categoria = categoriaDeTernero(f.sexo, f.es_torito)
    if (!esVendible(categoria)) continue // reposición: no se vende
    const a = acc[categoria] ?? { cabezas: 0, kg: 0 }
    a.cabezas += 1
    a.kg += Number(f.peso_kg) || 0
    acc[categoria] = a
  }
  return Object.entries(acc).map(([categoria, v]) => ({
    clave: `pesada|${sexoDeCategoria(categoria)}`,
    categoria, mes, cabezas: v.cabezas, kg: v.kg, origen: 'pesada' as const, detalle,
  }))
}

/**
 * Existencias que salen de los ciclos: los destetes que todavía no ocurrieron.
 *
 * Lo vendible de un destete ya viene neteado de reposición (`terneros_venta` /
 * `terneras_venta` descuentan toritos y terneras retenidas). Quedan disponibles el mes
 * del destete, con el peso de destete cargado en el ciclo.
 *
 * Sólo se toman los destetes FUTUROS: los pasados ya están en la pesada, y contarlos dos
 * veces duplicaría el stock.
 */
export function existenciasDeCiclos(
  ciclos: {
    id: string
    campania: string
    fecha_destete: string | null
    terneros_venta: number
    terneras_venta: number
    peso_macho: number
    peso_hembra: number
  }[],
  desdeMes: string,
): ExistenciaHacienda[] {
  const salida: ExistenciaHacienda[] = []
  for (const c of ciclos) {
    if (!c.fecha_destete) continue
    const mes = c.fecha_destete.slice(0, 7)
    if (mes < desdeMes) continue
    const detalle = `destete ${c.campania}`
    // Al destete la categoría natural es "al Pie" — es como se nombran los lotes que
    // genera Evolución Rodeo, así que las dos pantallas dicen lo mismo.
    if (c.terneros_venta > 0.01 && c.peso_macho > 0) {
      salida.push({
        clave: `ciclo:${c.id}|macho`,
        categoria: 'Ternero al Pie', mes, cabezas: c.terneros_venta,
        kg: c.terneros_venta * c.peso_macho, origen: 'destete', detalle,
      })
    }
    if (c.terneras_venta > 0.01 && c.peso_hembra > 0) {
      salida.push({
        clave: `ciclo:${c.id}|hembra`,
        categoria: 'Ternera al Pie', mes, cabezas: c.terneras_venta,
        kg: c.terneras_venta * c.peso_hembra, origen: 'destete', detalle,
      })
    }
  }
  return salida
}
