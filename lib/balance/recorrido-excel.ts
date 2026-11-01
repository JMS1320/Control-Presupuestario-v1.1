/**
 * 🔁 **EL EXCEL Y EL RECORRIDO, EN SINCRONÍA** — A-FEAT-1500 (JMS 01/11: *«un pendiente en los datos a presentar es un tema
 * en el recorrido que busca su resolución: debería haber entre el Excel y el recorrido una sincronía de equivalencia»*).
 *
 * Se revisó el Excel «original» del 01/11 contra el recorrido y salieron cinco desfases, todos de la misma raíz: el Excel
 * sólo veía la tabla de respuestas (`balance_pendientes`) y el recorrido además ve los temas que arma la app, las tareas y
 * la conversación. Acá se arreglan los cinco con lógica pura, sin tocar datos:
 *
 * 1. **Temas que el Excel no mostraba** (movimientos sin conciliar, deudas, echeqs, contra ARCA): van a la solapa
 *    «00 Recorrido», la misma cola que se ve en pantalla.
 * 2. **Tareas y conversación**: cada pendiente lleva su conversación entera y en manos de quién está.
 * 3. **Resueltos en la app que seguían ABIERTOS** (Juzgado conciliado, Voyage del script 161): si el tema ya no sale en el
 *    recorrido —el movimiento se concilió, la cuota se desactivó—, se lee «resuelto en la app».
 * 4. **Respuestas repetidas** (Manuel, 3 filas por un bug ya corregido): se juntan en una al leer, en los dos lados.
 * 5. **«Resuelto» con algo pendiente de aplicar** (echeq 102): si su tarea sigue abierta, lo dice.
 */
import type { PendienteBalance } from "./pendientes-balance"
import type { Tema } from "./recorrido"
import { hiloDelTema, type MensajeHilo } from "./hilo-tema"

/** Una tarea del recorrido (`revisiones` con `tabla_ref = 'recorrido_balance'`), con la clave de su tema. */
export interface TareaDelRecorrido {
  clave: string
  estado: string
  asignado_a: string | null
  creado_por: string | null
  motivo: string
  resolucion: string | null
  created_at: string
  seguimiento?: { fecha: string; texto: string; autor: string | null }[] | null
}

/** Lo que el recorrido sabe y la tabla de respuestas no: los temas de hoy y las tareas. `calculado = false` = no se armó. */
export interface RecorridoParaExcel {
  calculado: boolean
  temas: Tema[]
  tareas: TareaDelRecorrido[]
}

const CLAVE = /^\[([a-z]+:[^\]]+)\]/
export const claveDePendiente = (texto: string) => CLAVE.exec(texto)?.[1] ?? null

/**
 * Las claves que arma la app a partir de los datos (no de la cobertura ni de una pregunta): si su tema ya no sale, es porque
 * el dato se resolvió (el movimiento se concilió, la cuota se pagó o desactivó, el echeq se marcó).
 */
const DE_LOS_DATOS = /^(conc|deu|chq|ctl|arca):/

/**
 * 4 · Junta las filas de respuesta con la misma clave de tema en una sola: la más vieja (ahí siguen entrando los mensajes),
 * con la conversación de todas en orden y sin repetir, y el estado de la más nueva. Las preguntas sin clave quedan igual.
 */
export function unirPorClave(pendientes: PendienteBalance[]): PendienteBalance[] {
  const grupos = new Map<string, PendienteBalance[]>()
  const out: (PendienteBalance | string)[] = []
  for (const p of pendientes) {
    const k = claveDePendiente(p.texto)
    if (!k) { out.push(p); continue }
    if (!grupos.has(k)) { grupos.set(k, []); out.push(k) }
    grupos.get(k)!.push(p)
  }
  return out.map(x => {
    if (typeof x !== "string") return x
    const filas = [...grupos.get(x)!].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
    if (filas.length === 1) return filas[0]
    const base = filas[0], ultima = filas[filas.length - 1]
    const vistos = new Set<string>()
    const hilo = filas.flatMap(f => hiloDelTema(f)).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
      .filter(m => { const k = `${(m.autor ?? "").trim()}|${m.texto.trim()}`; if (vistos.has(k)) return false; vistos.add(k); return true })
      .map(({ de: _de, ...m }) => m)
    const resolucion = [...filas].reverse().find(f => (f.resolucion ?? "").trim())?.resolucion ?? null
    return { ...base, hilo, resolucion, estado: ultima.estado, resuelto_at: ultima.resuelto_at,
      imagen: base.imagen ?? filas.find(f => f.imagen)?.imagen ?? null }
  })
}

const quien = (s: string | null) => !s ? "" : s === "claude" || s === "Claude" ? "Claude"
  : /josemartinezsobrado|Jose Martinez/i.test(s) ? "JMS" : s

/** «en manos de JMS (abierta)», «falta el visto de JMS», o nada si no tiene tarea viva. */
export function estadoDeTarea(t: TareaDelRecorrido | undefined): string {
  if (!t) return ""
  if (t.estado === "por_confirmar") return "Hecho — falta el visto de JMS"
  if (t.estado === "abierta") return `En manos de ${quien(t.asignado_a) || "—"}`
  return ""
}

/** La tarea viva de cada tema (la más nueva, si hubiera varias). */
export function tareasPorClave(tareas: TareaDelRecorrido[]): Map<string, TareaDelRecorrido> {
  const m = new Map<string, TareaDelRecorrido>()
  for (const t of [...tareas].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (t.estado === "abierta" || t.estado === "por_confirmar") m.set(t.clave, t)
  }
  return m
}

/** La conversación en una celda: «dd/mm Autor: texto», un mensaje por línea. */
export function conversacionEnTexto(hilo: MensajeHilo[], max = 30000): string {
  const dm = (f: string) => f ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : ""
  return hilo.map(m => `${dm(m.fecha)} ${quien(m.autor) || "—"}: ${m.texto.replace(/\s+/g, " ").trim()}`).join("\n").slice(0, max)
}

/** Un pendiente con lo que agrega el recorrido, para la solapa «Pendientes a revisar». */
export interface PendienteSincronizado extends PendienteBalance {
  /** 3 · «el movimiento ya está conciliado…»: el tema ya no sale, aunque la fila diga abierto. */
  resueltoEnLaApp?: string
  /** 5 / 2 · en manos de quién está, si tiene tarea viva. */
  tarea?: string
  /** 2 · la conversación entera (tema + tarea). */
  conversacion?: string
}

/** 3 · Por qué un tema de los datos ya no sale, en las palabras de la app. */
function porQueYaNoSale(clave: string): string {
  if (clave.startsWith("conc:")) return "el movimiento ya no está pendiente (se concilió)"
  if (clave.startsWith("deu:")) return "la deuda ya no figura (se pagó o se desactivó la cuota)"
  if (clave.startsWith("chq:")) return "el echeq ya está marcado"
  return "ya no sale en el recorrido"
}

/** Junta (4), cruza con los temas de hoy (3) y con las tareas (2, 5). Sin recorrido calculado, sólo junta. */
export function sincronizarPendientes(pendientes: PendienteBalance[], r: RecorridoParaExcel | null | undefined): PendienteSincronizado[] {
  const unidos = unirPorClave(pendientes)
  if (!r) return unidos
  const vivas = tareasPorClave(r.tareas)
  const claves = new Set(r.temas.map(t => t.clave))
  return unidos.map(p => {
    const k = claveDePendiente(p.texto)
    const t = k ? vivas.get(k) : undefined
    const hilo = hiloDelTema(p, t ? { motivo: t.motivo, created_at: t.created_at, creado_por: t.creado_por, seguimiento: t.seguimiento } : null)
    const out: PendienteSincronizado = { ...p, tarea: estadoDeTarea(t), conversacion: conversacionEnTexto(hilo) }
    if (r.calculado && k && DE_LOS_DATOS.test(k) && !claves.has(k) && !t && p.estado === "abierto") out.resueltoEnLaApp = porQueYaNoSale(k)
    return out
  })
}

const GRUPO_TEXTO: Record<string, string> = {
  visto: "✔ Para tu visto", arca: "🧾 Contra ARCA", conciliacion: "🏦 Conciliar", cheque: "✍️ Echeqs", "falta inicio": "⏳ Falta inicio",
  error: "⛔ Error", decision: "❓ A decidir", pregunta: "💬 Pregunta", deuda: "🧾 Deuda sin pago", documento: "📥 Documento que falta",
  "sin informacion": "📭 Falta información", "pendiente desarrollo": "🛠️ Pendiente de desarrollo",
}

/** 1 · La solapa «00 Recorrido»: la misma cola que se ve en pantalla, primero lo abierto. */
export function hojaDelRecorrido(r: RecorridoParaExcel | null | undefined, encabezado: string): unknown[][] {
  if (!r || !r.calculado) {
    return [[encabezado], [], ["⚠️ El recorrido no se calculó para este Excel (no se pudo leer la conciliación): faltan los movimientos, las deudas, "
      + "los echeqs y el cruce contra ARCA. Volvé a bajarlo desde «Bajar el Excel»."]]
  }
  const vivas = tareasPorClave(r.tareas)
  const abiertos = r.temas.filter(t => !t.respondido), respondidos = r.temas.filter(t => t.respondido)
  const filas: unknown[][] = [
    [encabezado],
    [`${abiertos.length} tema(s) abiertos · ${respondidos.length} respondido(s) · ${r.temas.length} en total — es la misma lista del recorrido en la app`],
    [],
    ["#", "Grupo", "Papel", "Tema", "Qué pasa", "Propuesta", "Estado", "Tarea", "Conversación"],
  ]
  ;[...abiertos, ...respondidos].forEach((t, i) => {
    const tarea = vivas.get(t.clave)
    const hilo = hiloDelTema(t.pendiente, tarea ? { motivo: tarea.motivo, created_at: tarea.created_at, creado_por: tarea.creado_por, seguimiento: tarea.seguimiento } : null)
    filas.push([i + 1, GRUPO_TEXTO[t.grupo] ?? t.grupo, t.papel, t.titulo, t.que, t.propuesta ?? "",
      t.respondido ? "respondido" : hilo.length ? "con conversación" : "sin tocar", estadoDeTarea(tarea), conversacionEnTexto(hilo)])
  })
  return filas
}
