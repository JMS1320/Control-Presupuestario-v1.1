/**
 * 🧵 **EL HILO DE UN TEMA DEL RECORRIDO** — A-BUG-1478 (JMS 01/11: *«un hilo secuencial: si estoy escribiendo abajo de todo, lo
 * que guardo debería ir ahí como último mensaje»*).
 *
 * «Tu respuesta» guardaba UN texto (`balance_pendientes.resolucion`) y el mensaje nuevo pisaba al anterior: así se perdió uno
 * de JMS en el tema del Voyage. Ahora cada mensaje se AGREGA (`balance_pendientes.hilo`, script 162). Si el tema está pasado
 * a alguien (una tarea en `revisiones`), la conversación es UNA: se muestran juntos los mensajes del tema, el pedido de la
 * tarea y sus respuestas, en orden de fecha; y lo que se escribe mientras la tarea sigue abierta va al hilo de la tarea (así
 * lo ve la otra persona en su 🔔).
 */

export interface MensajeHilo {
  fecha: string
  autor: string | null
  texto: string
  imagen?: string | null
  /** De dónde viene (para el color): el tema o la tarea. */
  de?: "tema" | "tarea"
}

export interface PendienteConHilo {
  hilo?: MensajeHilo[] | null
  resolucion?: string | null
  imagen?: string | null
  created_at?: string | null
  resuelto_at?: string | null
}

export interface TareaConHilo {
  motivo: string
  created_at: string
  creado_por: string | null
  imagen?: string | null
  seguimiento?: { fecha: string; texto: string; autor: string | null; imagen?: string }[] | null
}

const igual = (a?: string | null, b?: string | null) => (a ?? "").trim() === (b ?? "").trim()

/** Los mensajes guardados del tema; si es de antes del hilo, su única respuesta como primer mensaje (no se pierde). */
export function mensajesDelTema(p: PendienteConHilo | null | undefined): MensajeHilo[] {
  if (!p) return []
  if (p.hilo?.length) return p.hilo.map(m => ({ ...m, de: "tema" as const }))
  if (!(p.resolucion ?? "").trim()) return []
  return [{ fecha: p.resuelto_at || p.created_at || "", autor: null, texto: p.resolucion!.trim(), imagen: p.imagen ?? null, de: "tema" }]
}

/** Pura: toda la conversación del tema en orden (lo del tema + el pedido de la tarea + sus respuestas). */
export function hiloDelTema(p: PendienteConHilo | null | undefined, tarea?: TareaConHilo | null): MensajeHilo[] {
  const tema = mensajesDelTema(p)
  const deTarea: MensajeHilo[] = tarea ? [
    { fecha: tarea.created_at, autor: tarea.creado_por, texto: tarea.motivo, imagen: tarea.imagen ?? null, de: "tarea" as const },
    ...(tarea.seguimiento ?? []).map(s => ({ fecha: s.fecha, autor: s.autor, texto: s.texto, imagen: s.imagen ?? null, de: "tarea" as const })),
  ] : []
  // La respuesta vieja que es el mismo texto que el pedido de la tarea (se pasó tal cual) no se repite.
  const sinRepetir = tema.filter(m => !(p && !p.hilo?.length && deTarea.some(t => igual(t.texto, m.texto))))
  return [...sinRepetir, ...deTarea].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
}

/** El hilo guardado más un mensaje nuevo al final (el viejo, si era de antes del hilo, queda como primero). */
export function agregarAlHilo(p: PendienteConHilo | null | undefined, nuevo: MensajeHilo): MensajeHilo[] {
  const previos = mensajesDelTema(p).map(({ de: _de, ...m }) => m)
  return [...previos, { fecha: nuevo.fecha, autor: nuevo.autor, texto: nuevo.texto, ...(nuevo.imagen ? { imagen: nuevo.imagen } : {}) }]
}
