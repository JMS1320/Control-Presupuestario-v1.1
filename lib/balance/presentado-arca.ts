/**
 * 🧾 LO PRESENTADO A ARCA, subdiario por subdiario — el segundo camino del libro diario (A-DAT-61).
 *
 * Criterio del usuario 2026-10-21: *«lo informado a ARCA es lo que tiene que estar en la app; toda
 * diferencia es un error de la app a corregir»*. El libro diario es una copia de los subdiarios
 * presentados, así que **el mismo número llega por dos caminos** (§ 🤖 pieza 4 de `CLAUDE.md`): lo que
 * suma la app y lo que se declaró. Si no coinciden, se muestra la diferencia.
 *
 * 📌 **Por qué está escrito acá y no en la base**: es un hecho histórico que no cambia (lo que se
 * presentó, se presentó) y la app no tiene dónde guardarlo. Sale de los libros de IVA que bajó el
 * usuario de ARCA (`- Comunicacion JMS Claude - Archivos/- libros de iva ARCA/libro_iva_periodo_
 * AAAAMM_original.zip`, archivo `comprobantes_compras.csv`): cantidad de filas y suma de «Importe
 * Total», que ARCA ya da **en pesos** (las de dólares van convertidas con su cotización) y con las
 * notas de crédito en negativo. Para un ejercicio nuevo se agrega su bloque con el mismo cálculo
 * (`scripts/control_iva_presentado_vs_app.py` lee los mismos zips).
 *
 * Medido 2026-10-23: los 11 subdiarios que no son diciembre coinciden al peso con la app.
 */

export interface Presentado {
  comprobantes: number
  total: number
}

/** Por empresa → por subdiario (`AAAA-MM`). Sólo COMPRAS. */
export const PRESENTADO_ARCA_COMPRAS: Record<string, Record<string, Presentado>> = {
  MSA: {
    "2025-07": { comprobantes: 47, total: 17718450.81 },
    "2025-08": { comprobantes: 57, total: 24205780.27 },
    "2025-09": { comprobantes: 42, total: 18617166.96 },
    "2025-10": { comprobantes: 38, total: 48231230.57 },
    "2025-11": { comprobantes: 45, total: 37632449.03 },
    "2025-12": { comprobantes: 36, total: 15813686.35 },
    "2026-01": { comprobantes: 42, total: 12233837.36 },
    "2026-02": { comprobantes: 52, total: 19182441.51 },
    "2026-03": { comprobantes: 53, total: 23747065.79 },
    "2026-04": { comprobantes: 50, total: 20409926.48 },
    "2026-05": { comprobantes: 59, total: 25502236.60 },
    "2026-06": { comprobantes: 42, total: 31145388.86 },
  },
}

export interface FilaContraPresentado {
  subdiario: string
  app: Presentado
  /** null = no hay dato de lo presentado para ese subdiario (no se puede controlar: se dice). */
  presentado: Presentado | null
  /** app − presentado. */
  diferenciaTotal: number
  diferenciaComprobantes: number
  ok: boolean
}

/** Tolerancia de redondeo: centavos repartidos entre muchos comprobantes. */
const TOLERANCIA = 0.05

/**
 * Compara, subdiario por subdiario, lo que suma la app contra lo presentado.
 * Devuelve una fila por cada subdiario pedido, aunque la app no tenga nada (así un mes vacío se ve).
 */
export function compararConPresentado(
  compras: Array<{ subdiario: string; total: number }>,
  subdiarios: string[],
  presentado: Record<string, Presentado> | undefined,
): FilaContraPresentado[] {
  return subdiarios.map(sub => {
    const delMes = compras.filter(a => a.subdiario === sub)
    const app = {
      comprobantes: delMes.length,
      total: Math.round(delMes.reduce((s, a) => s + a.total, 0) * 100) / 100,
    }
    const p = presentado?.[sub] ?? null
    const diferenciaTotal = p ? Math.round((app.total - p.total) * 100) / 100 : 0
    const diferenciaComprobantes = p ? app.comprobantes - p.comprobantes : 0
    return {
      subdiario: sub, app, presentado: p, diferenciaTotal, diferenciaComprobantes,
      ok: p != null && Math.abs(diferenciaTotal) <= TOLERANCIA && diferenciaComprobantes === 0,
    }
  })
}
