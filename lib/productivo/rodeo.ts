// La línea de tiempo de un rodeo: cuántas cabezas y con qué peso, día por día.
//
// ── Para qué ─────────────────────────────────────────────────────────────────
// Es lo que le da al reparto del consumo (`lib/productivo/consumo.ts`) los grupos con su
// kilo-día. Sin esto el reparto existe pero nadie le pasa los grupos.
//
// ── Por qué día por día y no con promedios ───────────────────────────────────
// Porque los animales entran, mueren y se venden en fechas distintas, y porque el peso crece
// —a veces con la curva quebrada de los tramos de actividad—. Integrar día a día es exacto con
// cualquier curva y evita el promedio-de-promedios, que es donde se cuelan los errores que
// después nadie encuentra. Son ~200 iteraciones: no hay nada que optimizar.
//
// ── Lo que NO hace ───────────────────────────────────────────────────────────
// No decide cuánto comió cada uno. Sólo dice **cuánto animal-kilo hubo cada día**. El reparto
// es del otro lib, y el total sale de la medición. Acá no se inventa ningún consumo.

import type { GrupoConsumidor } from './consumo'

/**
 * Un grupo del rodeo: un paquete de animales que entra, está un tiempo y se va.
 *
 * En recría son los lotes: los que se vendieron, los que quedan, los de reposición. Más el
 * **resto sin lote**, que es el que hace que la cuenta de cabezas cierre.
 */
export interface GrupoRodeo {
  id: string
  nombre: string
  /** Cabezas al entrar. Las bajas se descuentan aparte. */
  cabezas: number
  desde: string
  /** Cuándo salió (venta real, o estimada). `null` = sigue en el rodeo. */
  hasta: string | null
  /**
   * Peso VIVO (bruto) a una fecha. El animal come según lo que pesa parado — el desbaste es
   * para la plata, no para la comida.
   *
   * Se pasa como función para poder usar la curva canónica (`curvaDeLote`), que ya sabe
   * quebrarse cuando el lote cambia de actividad.
   */
  peso: (fecha: string) => number
}

/** Una muerte. Si no dice de qué grupo, se reparte — ver `bajasAlDia`. */
export interface BajaRodeo {
  fecha: string
  cabezas: number
  grupoId?: string | null
  motivo?: string
}

const MS_DIA = 86400000
const iso = (d: Date) => d.toISOString().slice(0, 10)
const aDate = (s: string) => new Date(s + 'T00:00:00')

/**
 * Cabezas de cada grupo en una fecha, ya descontadas las bajas.
 *
 * ⚠️ **Convención**: una baja sin grupo se descuenta **proporcionalmente** entre los grupos
 * presentes ese día. Es una convención, no un hecho — el animal que murió en abril no sabía a
 * qué venta iba a pertenecer.
 *
 * Como toda convención del modelo: **mueve cabezas entre grupos, nunca cambia el total.** Por eso
 * el total sigue siendo el control de los parciales. Cuando la baja SÍ dice de qué grupo es
 * (`grupoId`), no hay convención que valga: se descuenta de ahí.
 */
export function cabezasAlDia(
  grupos: GrupoRodeo[], bajas: BajaRodeo[], fecha: string,
): Map<string, number> {
  const presentes = grupos.filter(g => g.desde <= fecha && (g.hasta == null || fecha < g.hasta))
  const out = new Map(presentes.map(g => [g.id, g.cabezas]))

  for (const b of bajas) {
    if (b.fecha > fecha) continue
    if (b.grupoId) {
      if (out.has(b.grupoId)) out.set(b.grupoId, (out.get(b.grupoId) ?? 0) - b.cabezas)
      continue
    }
    // Sin grupo: proporcional a las cabezas que había el día de la baja.
    const enEsaFecha = grupos.filter(g => g.desde <= b.fecha && (g.hasta == null || b.fecha < g.hasta))
    const total = enEsaFecha.reduce((s, g) => s + g.cabezas, 0)
    if (total <= 0) continue
    for (const g of enEsaFecha) {
      if (!out.has(g.id)) continue
      out.set(g.id, (out.get(g.id) ?? 0) - b.cabezas * (g.cabezas / total))
    }
  }

  for (const [k, v] of out) out.set(k, Math.max(0, v))
  return out
}

/**
 * Kilo-día de cada grupo entre dos fechas, integrando día por día.
 *
 * Devuelve la función que `calcularConsumo()` pide: se la llama una vez por tramo, porque los
 * grupos cambian —los vendidos dejan de comer— y el peso crece.
 */
export function gruposDelRodeo(
  grupos: GrupoRodeo[], bajas: BajaRodeo[] = [],
): (desde: string, hasta: string) => GrupoConsumidor[] {
  return (desde: string, hasta: string) => {
    const acc = new Map<string, number>()
    const fin = aDate(hasta).getTime()
    for (let t = aDate(desde).getTime(); t < fin; t += MS_DIA) {
      const f = iso(new Date(t))
      const cab = cabezasAlDia(grupos, bajas, f)
      for (const g of grupos) {
        const n = cab.get(g.id)
        if (!n || n <= 0) continue
        // Peso VIVO del día. Si la curva devuelve algo raro, no se inventa: ese día no suma.
        const p = g.peso(f)
        if (!isFinite(p) || p <= 0) continue
        acc.set(g.id, (acc.get(g.id) ?? 0) + n * p)
      }
    }
    return grupos
      .filter(g => (acc.get(g.id) ?? 0) > 0)
      .map(g => ({ id: g.id, nombre: g.nombre, kiloDia: acc.get(g.id) ?? 0 }))
  }
}

/**
 * ¿La suma de los grupos explica el rodeo?
 *
 * Es el control que destapa lo que nadie está mirando: si el ciclo declara 189 cabezas y los
 * lotes suman 145, hay **44 animales que están comiendo y no le pertenecen a nadie**. Su
 * consumo se repartiría entre los demás, inflándoles el costo — sin que nada avise.
 *
 * Por eso el resultado se muestra SIEMPRE, cierre o no, y por eso conviene crear el grupo
 * *resto sin lote* con la diferencia en vez de dejarla afuera.
 */
export function conciliarCabezas(
  aperturaDeclarada: number, grupos: GrupoRodeo[], bajas: BajaRodeo[],
): { declarada: number; enGrupos: number; bajas: number; diferencia: number; cierra: boolean } {
  const enGrupos = grupos.reduce((s, g) => s + g.cabezas, 0)
  const totalBajas = bajas.reduce((s, b) => s + b.cabezas, 0)
  const diferencia = Math.round((aperturaDeclarada - enGrupos) * 100) / 100
  return {
    declarada: aperturaDeclarada, enGrupos, bajas: totalBajas,
    diferencia, cierra: Math.abs(diferencia) < 0.5,
  }
}

/**
 * El grupo que absorbe lo que no está en ningún lote, para que la cuenta cierre.
 *
 * ⚠️ **No es un parche: es lo que evita que el faltante se reparta en silencio.** Un animal
 * fuera de todo lote igual come; si no está declarado, su consumo lo pagan los demás. Con este
 * grupo el costo queda donde corresponde y —además— la fila se ve, que es lo que hace que
 * alguien vaya a cargar el lote que falta.
 */
export function grupoResto(
  aperturaDeclarada: number, grupos: GrupoRodeo[],
  desde: string, peso: (fecha: string) => number,
  nombre = 'Resto sin lote',
): GrupoRodeo | null {
  const enGrupos = grupos.reduce((s, g) => s + g.cabezas, 0)
  const resto = aperturaDeclarada - enGrupos
  if (resto < 0.5) return null
  return { id: '__resto__', nombre, cabezas: resto, desde, hasta: null, peso }
}

// ── Armado desde las filas de la base ─────────────────────────────────────────
//
// Vive acá y no en la pantalla para que el panel de mediciones, el margen y el script de
// verificación armen los MISMOS grupos. Tener dos versiones de esto es la forma más segura de
// que el reparto dé distinto según desde dónde se mire.

export interface FilasRodeo {
  ciclo: {
    fecha_inicio: string | null
    cabezas_machos: number | null
    cabezas_hembras: number | null
    peso_bruto_macho_kg: number | null
    peso_bruto_hembra_kg: number | null
    ganancia_diaria_kg: number | null
  }
  /** Los lotes de la categoría del rodeo, con su cantidad y curva ya resuelta. */
  lotes: {
    id: string
    nombre: string
    cabezas: number
    /** Cuándo se fue de verdad. Manda sobre la estimada. */
    fechaSalidaReal: string | null
    fechaSalidaEstimada: string | null
    peso: (fecha: string) => number
  }[]
  /** Mortandades del rodeo, ya filtradas por categoría y fecha. */
  bajas: BajaRodeo[]
}

/**
 * Los grupos del rodeo listos para repartir, con el **resto sin lote** incluido.
 *
 * El resto no es un relleno: es lo que evita que el consumo de los animales que todavía no
 * están cargados como lote se reparta en silencio entre los que sí. Y como se ve en pantalla,
 * es también el aviso de que falta cargar algo.
 */
export function armarGruposRodeo(f: FilasRodeo): {
  grupos: GrupoRodeo[]
  apertura: number
  desde: string
  conciliacion: ReturnType<typeof conciliarCabezas>
} {
  const desde = f.ciclo.fecha_inicio ?? ''
  const cabM = Number(f.ciclo.cabezas_machos ?? 0)
  const cabH = Number(f.ciclo.cabezas_hembras ?? 0)
  const apertura = cabM + cabH

  const grupos: GrupoRodeo[] = f.lotes.map(l => ({
    id: l.id,
    nombre: l.nombre,
    cabezas: l.cabezas,
    desde,
    // La salida REAL manda sobre la estimada: es la misma regla del dato real por default.
    hasta: l.fechaSalidaReal ?? l.fechaSalidaEstimada ?? null,
    peso: l.peso,
  }))

  // El peso del resto: el promedio ponderado de la apertura, creciendo con la ganancia del
  // ciclo. Es una estimación declarada como tal — el resto no tiene lote y por lo tanto no
  // tiene curva propia.
  const brutoProm = apertura > 0
    ? (cabM * Number(f.ciclo.peso_bruto_macho_kg ?? 0) + cabH * Number(f.ciclo.peso_bruto_hembra_kg ?? 0)) / apertura
    : 0
  const gan = Number(f.ciclo.ganancia_diaria_kg ?? 0)
  const pesoResto = (fecha: string) => {
    if (!desde) return brutoProm
    const d = Math.max(0, Math.round((aDate(fecha).getTime() - aDate(desde).getTime()) / MS_DIA))
    return brutoProm + d * gan
  }

  const resto = desde ? grupoResto(apertura, grupos, desde, pesoResto) : null
  if (resto) grupos.push(resto)

  return { grupos, apertura, desde, conciliacion: conciliarCabezas(apertura, grupos, f.bajas) }
}
