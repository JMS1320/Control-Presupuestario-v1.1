/**
 * 🔔 LA CAMPANITA — qué le toca ver a cada persona (A-FEAT-1364, etapa 3 de A-FEAT-1322).
 *
 * Se apoya en las marcas 🚩 (`public.revisiones`): una marca con destinatario (`asignado_a`, el mail)
 * es un MENSAJE anclado a una cosa. La campanita junta dos listas:
 *   · **para mí**  — lo que alguien me marcó a mí. Queda hasta que se cierra.
 *   · **enviadas** — lo que yo le marqué a otro. Aparece cuando me contesta.
 * Las marcas sin destinatario siguen como hasta hoy, en Principal → Para revisar.
 *
 * «Nuevo» (el número rojo) = la última palabra no es mía y todavía no la vi. Lo visto se guarda en el
 * navegador de cada uno: es una comodidad, no un dato (si se pierde, vuelven a contar como nuevas).
 */

export type Yo = { mail: string | null; etiqueta: string | null }

export type EntradaHilo = { fecha: string; texto: string; autor: string | null }

export type MarcaCampanita = {
  id: string
  estado: string
  motivo: string
  creado_por: string | null
  asignado_a: string | null
  created_at: string
  seguimiento?: EntradaHilo[] | null
}

export type ItemCampanita = {
  id: string
  tipo: "para-mi" | "enviada"
  /** Mensajes del hilo, contando el motivo inicial. Es lo que se recuerda como «visto». */
  mensajes: number
  /** El último que habló (el motivo cuenta como el primero). */
  ultimoAutor: string | null
  nuevo: boolean
}

const normal = (s: string | null | undefined) => (s ?? "").trim().toLowerCase()

/** ¿Este autor soy yo? Las marcas guardan el nombre o, si no hay, el mail (`etiquetaPersona`). */
export function soyYo(autor: string | null | undefined, yo: Yo): boolean {
  const a = normal(autor)
  return !!a && (a === normal(yo.mail) || a === normal(yo.etiqueta))
}

export function clasificarCampanita(
  marcas: MarcaCampanita[],
  yo: Yo,
  vistos: Record<string, number> = {},
): ItemCampanita[] {
  const items: ItemCampanita[] = []
  for (const m of marcas) {
    if (m.estado !== "abierta" || !m.asignado_a) continue
    const paraMi = normal(m.asignado_a) === normal(yo.mail) && !!normal(yo.mail)
    const mia = soyYo(m.creado_por, yo)
    if (!paraMi && !mia) continue

    const hilo = Array.isArray(m.seguimiento) ? m.seguimiento : []
    const mensajes = 1 + hilo.length
    const ultimoAutor = hilo.length ? hilo[hilo.length - 1].autor : m.creado_por
    const tipo = paraMi ? "para-mi" : "enviada"
    // Una enviada sin respuesta no es novedad para quien la mandó.
    const hayAlgoDeOtro = !soyYo(ultimoAutor, yo) && (tipo === "para-mi" || hilo.length > 0)
    items.push({ id: m.id, tipo, mensajes, ultimoAutor, nuevo: hayAlgoDeOtro && (vistos[m.id] ?? 0) < mensajes })
  }
  return items
}

export function contarNuevos(items: ItemCampanita[]): number {
  return items.filter((i) => i.nuevo).length
}
