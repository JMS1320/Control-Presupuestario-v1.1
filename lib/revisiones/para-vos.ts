/**
 * 🏠 **«Para vos» — lo que va arriba del Principal de cada usuario** (A-FEAT-1411; ⚠️ cambió 31/10 con A-FEAT-1449).
 *
 * JMS 2026-10-28: «los flags le llegan a su Principal… un flag es algo urgente… la flag incluye la creación de una
 * tarea para ese usuario». Orden: primero lo que es PARA MÍ — por NIVEL (las señales sumadas, lib/revisiones/nivel.ts),
 * y a igual nivel las vencidas, después las que vencen antes, después las sin fecha, más nuevas primero —; aparte lo
 * que me toca CONFIRMAR (una tarea con `confirma` que el otro dio por lista: JMS 31/10, lo de Ulises «sólo desaparece
 * si yo confirmo»); lo mío que espera que otro confirme; y abajo lo que YO mandé. Lógica pura, probada en casos.
 */
import { nivelDeTarea, type Senal } from "@/lib/revisiones/nivel"

export interface MarcaParaVos {
  id: string
  estado: string
  asignado_a: string | null
  creado_por: string | null
  created_at: string
  es_tarea?: boolean | null
  tarea_hasta?: string | null
  senales?: Senal[] | null
  confirma?: string | null
}

const n = (s: string | null | undefined) => (s ?? "").trim().toLowerCase()

export function paraVos<T extends MarcaParaVos>(marcas: T[], yo: { mail: string | null; etiqueta: string | null }, hoy: string) {
  const esMio = (m: T) => !!n(yo.mail) && n(m.asignado_a) === n(yo.mail)
  const lasMande = (m: T) => !!n(m.creado_por) && (n(m.creado_por) === n(yo.mail) || n(m.creado_por) === n(yo.etiqueta))
  const meTocaConfirmar = (m: T) => !!n(yo.mail) && n(m.confirma) === n(yo.mail)
  const abiertas = marcas.filter(m => m.estado === "abierta")
  const porConfirmar = marcas.filter(m => m.estado === "por_confirmar")
  const vencida = (m: T) => !!(m.es_tarea && m.tarea_hasta && m.tarea_hasta.slice(0, 10) < hoy)
  const clave = (m: T) => [vencida(m) ? 0 : m.es_tarea && m.tarea_hasta ? 1 : 2, m.tarea_hasta ?? "9999"] as const
  const orden = (a: T, b: T) => {
    const na = nivelDeTarea(a, hoy).puntos, nb = nivelDeTarea(b, hoy).puntos
    if (na !== nb) return nb - na
    const ka = clave(a), kb = clave(b)
    if (ka[0] !== kb[0]) return ka[0] - kb[0]
    if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1
    return b.created_at.localeCompare(a.created_at)
  }
  const paraMi = abiertas.filter(esMio).sort(orden)
  const aConfirmar = porConfirmar.filter(meTocaConfirmar).sort(orden)
  const esperanConfirmacion = porConfirmar.filter(m => esMio(m) && !meTocaConfirmar(m)).sort(orden)
  const mandadas = abiertas.filter(m => !esMio(m) && lasMande(m) && !!m.asignado_a)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return { paraMi, aConfirmar, esperanConfirmacion, mandadas, vencidas: paraMi.filter(vencida).length }
}

export const estaVencida = (m: MarcaParaVos, hoy: string) => !!(m.es_tarea && m.tarea_hasta && m.tarea_hasta.slice(0, 10) < hoy)

/**
 * Pura: qué pasa al apretar «Listo» — si la tarea pide confirmación de OTRA persona, queda 'por_confirmar'; si no
 * (o si el que la cierra es el que confirma), 'resuelta'.
 */
export function estadoAlCerrar(t: { confirma?: string | null }, quien: string | null): "resuelta" | "por_confirmar" {
  return n(t.confirma) && n(t.confirma) !== n(quien) ? "por_confirmar" : "resuelta"
}
