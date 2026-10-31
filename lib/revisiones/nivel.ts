/**
 * 🚦 EL NIVEL DE UNA TAREA — se suman señales (A-FEAT-1449, vista previa respondida por JMS 31/10).
 *
 * JMS: «llega mail de ARBA que se adeuda algo: eso entraría a un caso urgente porque es impuestos + vencido + aviso de
 * deuda de ARBA… iría directo a los mayores niveles de alarma. Otro mail puede tener una factura que se archivó y se
 * da notificación y listo».
 *
 * Señales FIJAS (se guardan en `revisiones.senales` al crear la tarea): de qué se trata, quién avisa.
 * Señales del TIEMPO (se calculan al mostrarla): vencida (+1), vence en los próximos días (+½).
 *   3 o más → 🔴 Máximo · 2 → 🟠 Urgente · 1 → 🟡 A mirar · menos → ⚪ Para saber
 * Los pesos son el punto de partida de la vista previa; pasan a editables con la tanda 3.
 */

export interface Senal { nombre: string; peso: number }
export type Nivel = 1 | 2 | 3 | 4

export const NIVELES: Record<Nivel, { etiqueta: string; emoji: string }> = {
  4: { etiqueta: "Máximo", emoji: "🔴" },
  3: { etiqueta: "Urgente", emoji: "🟠" },
  2: { etiqueta: "A mirar", emoji: "🟡" },
  1: { etiqueta: "Para saber", emoji: "⚪" },
}

/** Días antes del vencimiento en que una tarea «vence pronto» (el default de los templates de impuestos). */
export const DIAS_VENCE_PRONTO = 10

/** Pura: suma las señales fijas + las del tiempo y da el nivel. `hoy` = 'AAAA-MM-DD' (hora argentina). */
export function nivelDeTarea(
  t: { senales?: Senal[] | null; es_tarea?: boolean | null; tarea_hasta?: string | null },
  hoy: string, diasPronto = DIAS_VENCE_PRONTO,
): { puntos: number; nivel: Nivel; senales: Senal[] } {
  const senales = [...(t.senales ?? [])]
  const hasta = t.tarea_hasta?.slice(0, 10)
  if (hasta) {
    if (hasta < hoy) senales.push({ nombre: "vencida", peso: 1 })
    else {
      const dias = Math.round((Date.parse(hasta + "T12:00:00Z") - Date.parse(hoy + "T12:00:00Z")) / 86400000)
      if (dias <= diasPronto) senales.push({ nombre: `vence en ${dias} día${dias === 1 ? "" : "s"}`, peso: 0.5 })
    }
  }
  const puntos = senales.reduce((a, s) => a + (Number(s.peso) || 0), 0)
  const nivel: Nivel = puntos >= 3 ? 4 : puntos >= 2 ? 3 : puntos >= 1 ? 2 : 1
  return { puntos, nivel, senales }
}

/**
 * Pura: las señales fijas de una tarea que sale de un MAIL — a partir de su gravedad (lib/mails/registro.ts):
 * impuestos/legal (+1) y que avise deuda, mora, intimación, saldo negativo… (+1).
 */
export function senalesDeMail(g: { nivel: 0 | 1 | 2; palabras: string[] }, tipo: string | null): Senal[] {
  const s: Senal[] = []
  if (tipo === "impuestos" || tipo === "legal" || g.nivel === 2) s.push({ nombre: tipo === "legal" ? "legal" : "impuestos", peso: 1 })
  if (g.nivel > 0) s.push({ nombre: `avisa ${g.palabras.slice(0, 2).join(", ")}`, peso: 1 })
  return s
}

/** Pura: monto grande (> $ 1.000.000) suma medio punto. */
export function senalMonto(monto: number | null | undefined): Senal[] {
  return monto && Math.abs(monto) > 1_000_000 ? [{ nombre: "monto grande", peso: 0.5 }] : []
}
