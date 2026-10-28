/**
 * 🏠 **«Para vos» — lo que va arriba del Principal de cada usuario** (A-FEAT-1411).
 *
 * JMS 2026-10-28: «los flags le llegan a su Principal… un flag es algo urgente… la flag incluye la creación de una
 * tarea para ese usuario». Orden: primero lo que es PARA MÍ (tareas vencidas, después las que vencen antes, después
 * las marcas sin fecha, más nuevas primero); abajo lo que YO mandé y espera respuesta. Lógica pura, probada en casos.
 */
export interface MarcaParaVos {
  id: string
  estado: string
  asignado_a: string | null
  creado_por: string | null
  created_at: string
  es_tarea?: boolean | null
  tarea_hasta?: string | null
}

const n = (s: string | null | undefined) => (s ?? "").trim().toLowerCase()

export function paraVos<T extends MarcaParaVos>(marcas: T[], yo: { mail: string | null; etiqueta: string | null }, hoy: string) {
  const esMio = (m: T) => !!n(yo.mail) && n(m.asignado_a) === n(yo.mail)
  const lasMande = (m: T) => !!n(m.creado_por) && (n(m.creado_por) === n(yo.mail) || n(m.creado_por) === n(yo.etiqueta))
  const abiertas = marcas.filter(m => m.estado === "abierta")
  const vencida = (m: T) => !!(m.es_tarea && m.tarea_hasta && m.tarea_hasta.slice(0, 10) < hoy)
  const clave = (m: T) => [vencida(m) ? 0 : m.es_tarea && m.tarea_hasta ? 1 : 2, m.tarea_hasta ?? "9999", ""] as const
  const paraMi = abiertas.filter(esMio).sort((a, b) => {
    const ka = clave(a), kb = clave(b)
    if (ka[0] !== kb[0]) return ka[0] - kb[0]
    if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1
    return b.created_at.localeCompare(a.created_at)
  })
  const mandadas = abiertas.filter(m => !esMio(m) && lasMande(m) && !!m.asignado_a)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return { paraMi, mandadas, vencidas: paraMi.filter(vencida).length }
}

export const estaVencida = (m: MarcaParaVos, hoy: string) => !!(m.es_tarea && m.tarea_hasta && m.tarea_hasta.slice(0, 10) < hoy)
