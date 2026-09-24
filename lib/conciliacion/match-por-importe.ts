/**
 * 🎯 **A-FEAT-158 — cuando el importe es exacto pero la fecha estimada está lejos.**
 *
 * ## El caso que lo originó, y las dos veces que me equivoqué al diagnosticarlo
 * Movimiento del **29/06 por $1.465.100** y factura de **CACERES MENEGONI ISAIAS por $1.465.100
 * exacto**, que nunca se vincularon.
 *
 * 1. Primero dije que era **el CUIT** (el banco informó uno y la factura tiene otro). **Falso**: el
 *    CUIT *prioriza pero no excluye* — si no hay match ahí, el motor reintenta contra toda la base
 *    ([A-BUG-29](../../PENDIENTES.md#a-bug-29)).
 * 2. La causa real es **la fecha**: la factura tiene `fecha_estimada` **11/07** y el movimiento es
 *    del **29/06**. Son **12 días** y la tolerancia del motor es **5**.
 *
 * 🔑 **Y eso es lo que hace razonable la regla nueva:** `fecha_estimada` es **una estimación** —
 * cuándo se pensaba pagar—, no un hecho. El importe exacto, en cambio, es un hecho. Descartar por
 * una estimación equivocada deja el movimiento sin vincular y la factura paga por otro lado.
 *
 * ## La regla
 * > **Importe exacto + un solo candidato = se propone, y queda en `auditar`.**
 *
 * ⚠️ **Sólo si es UNO.** Con dos facturas del mismo importe, elegir sería adivinar: ahí no se
 * propone nada y el movimiento queda pendiente. *Un motor que adivina hace daño en silencio.*
 *
 * 📌 **Nunca concilia derecho**: siempre `auditar` con el motivo escrito. El importe solo no alcanza
 * para dar por cierto un vínculo — alcanza para **traerlo a la vista**, que es lo que hoy no pasa.
 */

/** Lo mínimo que hace falta de un candidato del Cash Flow para decidir. */
export interface CandidatoImporte {
  id: string
  debitos?: number | null
  creditos?: number | null
  fecha_estimada?: string | null
}

export interface MovimientoParaMatch {
  debitos?: number | null
  creditos?: number | null
  fecha?: string | null
}

/**
 * Hasta dónde se estira la búsqueda. Más allá de esto, un importe igual es probablemente
 * coincidencia: los montos redondos se repiten mes a mes.
 */
export const DIAS_MAXIMO = 45

/** Un peso de diferencia es cero. */
const CERO = 0.005

export interface MatchPorImporte {
  candidato: CandidatoImporte
  dias: number
  motivo: string
}

const dias = (a?: string | null, b?: string | null): number | null => {
  if (!a || !b) return null
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null
}

/**
 * Busca el único candidato del mismo importe dentro de `DIAS_MAXIMO`.
 *
 * Devuelve `null` si no hay ninguno **o si hay más de uno** — las dos cosas significan lo mismo para
 * el motor: *no hay nada que proponer sin adivinar*.
 */
export function matchPorImporteExacto(
  movimiento: MovimientoParaMatch,
  pool: CandidatoImporte[],
  toleranciaYaProbada = 5,
): MatchPorImporte | null {
  const debito = Number(movimiento.debitos) || 0
  const credito = Number(movimiento.creditos) || 0
  if (debito < CERO && credito < CERO) return null

  const candidatos = pool.filter(cf => {
    const mismoImporte = debito >= CERO
      ? Math.abs((Number(cf.debitos) || 0) - debito) < CERO
      : Math.abs((Number(cf.creditos) || 0) - credito) < CERO
    if (!mismoImporte) return false

    const d = dias(movimiento.fecha, cf.fecha_estimada)
    // Sin fecha del lado del candidato entra igual: el importe exacto ya es señal suficiente para
    // traerlo a la vista, y una fila sin fecha es justamente la que nadie va a encontrar buscando.
    if (d === null) return true
    // Lo que caía dentro de la tolerancia normal ya lo probó el motor: acá sólo lo que quedó afuera.
    return d > toleranciaYaProbada && d <= DIAS_MAXIMO
  })

  // 🛑 Con más de uno no se elige. Ver el encabezado.
  if (candidatos.length !== 1) return null

  const candidato = candidatos[0]
  const d = dias(movimiento.fecha, candidato.fecha_estimada)
  return {
    candidato,
    dias: d ?? 0,
    motivo: d === null
      ? 'Importe exacto, pero el candidato no tiene fecha estimada'
      : `Importe exacto, pero la fecha estimada está a ${d} días`,
  }
}
