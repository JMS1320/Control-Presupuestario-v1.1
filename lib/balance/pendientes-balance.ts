/**
 * 📌 **Pendientes a revisar de los papeles de trabajo** — A-FEAT-1258 (2026-10-07).
 *
 * Pedido del usuario: *«que cuando hago el export salga el pendiente de chequear; y cuando trabajo desde
 * la app con este export, poder agregar pendientes a esta sección; y que quede a la vista al estar
 * trabajando en esto desde la app»*. Viven en `public.balance_pendientes` (por empresa y año de cierre);
 * un pendiente no se borra: se **resuelve** con una nota, y queda la historia de qué se revisó.
 *
 * Esta parte es pura: arma la solapa del Excel.
 */

export interface PendienteBalance {
  id: string
  empresa: string
  anio_cierre: number
  texto: string
  estado: 'abierto' | 'resuelto'
  resolucion: string | null
  created_at: string
  resuelto_at: string | null
  /** 📷 A-FEAT-1472 — la captura pegada en «Tu respuesta» del recorrido (data-URL; script 159). */
  imagen?: string | null
  /** 🧵 A-BUG-1478 — los mensajes del tema, en orden (script 162). Se agregan, no se pisan. */
  hilo?: { fecha: string; autor: string | null; texto: string; imagen?: string | null }[] | null
  /**
   * ✔ A-FEAT-1487 — quién lo vio (lo arma la pantalla; no es columna de la base): «Claude» = lo resolvió Claude y
   * espera el visto de JMS (tarea por confirmar); vacío en un resuelto = lo resolvió/confirmó JMS desde la app.
   */
  vistoPor?: 'JMS' | 'Claude' | null
}

/**
 * ✔ A-FEAT-1487 — marca cada pendiente con quién lo vio, y suma los temas que resolvió Claude sin pendiente propio
 * (el tema se rearmó desde la tarea): así el export dice qué miró JMS y qué está visto sólo por Claude. JMS: *«si
 * tengo que presentar y hay cosas que no están vistas por mí pero están vistas por vos, de alguna manera están vistas
 * por alguien»*. `porConfirmar` = las tareas por confirmar del recorrido (clave del tema → qué se hizo).
 */
export function pendientesConVisto(pendientes: PendienteBalance[], porConfirmar: { clave: string; titulo: string; resolucion: string }[],
  empresa: string, anioCierre: number): PendienteBalance[] {
  const claveDe = (texto: string) => /^\[([a-z]+:[^\]]+)\]/.exec(texto)?.[1] ?? null
  const porClave = new Map(porConfirmar.map(t => [t.clave, t]))
  const usadas = new Set<string>()
  const out: PendienteBalance[] = pendientes.map(p => {
    const k = claveDe(p.texto)
    const t = k ? porClave.get(k) : undefined
    if (t) { usadas.add(t.clave); return { ...p, vistoPor: 'Claude', resolucion: p.resolucion || t.resolucion } }
    return { ...p, vistoPor: p.estado === 'resuelto' ? 'JMS' : null }
  })
  for (const t of porConfirmar) if (!usadas.has(t.clave)) out.push({ id: `visto:${t.clave}`, empresa, anio_cierre: anioCierre,
    texto: `[${t.clave}] ${t.titulo}`, estado: 'resuelto', resolucion: t.resolucion, created_at: '', resuelto_at: null, vistoPor: 'Claude' })
  return out
}

const dmy = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

/** La solapa del export: primero los abiertos (es lo que hay que mirar), después los resueltos con su nota. */
export function hojaDePendientes(pendientes: (PendienteBalance & { resueltoEnLaApp?: string; tarea?: string; conversacion?: string })[], encabezado: string): unknown[][] {
  // 🔁 A-FEAT-1500: un tema que ya se resolvió en la app (el movimiento se concilió) cuenta como resuelto aunque la fila diga abierto.
  const abierto = (p: typeof pendientes[number]) => p.estado === 'abierto' && !p.resueltoEnLaApp
  const abiertos = pendientes.filter(abierto).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const resueltos = pendientes.filter(p => !abierto(p)).sort((a, b) => (a.resuelto_at || '').localeCompare(b.resuelto_at || ''))
  const filas: unknown[][] = [
    [encabezado],
    [abiertos.length ? `${abiertos.length} pendiente(s) a revisar antes de dar el balance por cerrado` : '✓ Sin pendientes abiertos'],
    // ✔ A-FEAT-1487 — lo que está visto sólo por Claude se cuenta aparte: es lo que JMS no miró.
    ...(resueltos.some(p => p.vistoPor === 'Claude') ? [[`✔ ${resueltos.filter(p => p.vistoPor === 'Claude').length} resuelto(s) por Claude, sin el visto de JMS`]] : []),
    [],
    ['#', 'Pendiente', 'Anotado', 'Estado', 'Resolución', 'Resuelto', 'Visto', 'Tarea', 'Conversación'],
  ]
  ;[...abiertos, ...resueltos].forEach((p, i) => filas.push([
    i + 1, p.texto, dmy(p.created_at),
    p.resueltoEnLaApp ? `resuelto en la app — ${p.resueltoEnLaApp}` : p.estado === 'abierto' ? 'ABIERTO'
      : p.tarea && !/visto/.test(p.tarea) ? 'resuelto — falta aplicar (tarea abierta)' : 'resuelto',
    p.resolucion || '', dmy(p.resuelto_at),
    p.vistoPor === 'Claude' ? 'Resuelto por Claude — sin tu visto' : p.vistoPor === 'JMS' ? 'Visto por JMS' : '',
    p.tarea || '', p.conversacion || '',
  ]))
  return filas
}
