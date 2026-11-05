/**
 * ⌨️ Alt+M y elegir con UNA TECLA — A-FEAT-1545 (nota 🌙 JMS 05/11: *«¿algún atajo para apretar y ya elegir luego de
 * Ctrl M?»*). Con el menú abierto, cada sección muestra su tecla: 1…9, después 0, a, b, c… (en el orden del menú, que
 * para cada rol es distinto: por eso la tecla sale de la POSICIÓN, no de la sección).
 */
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "a", "b", "c", "d", "e", "f"]

/** La tecla del ítem número `i` del menú (0 = el primero), o null si no alcanzan. */
export function teclaDeItem(i: number): string | null {
  return TECLAS[i] ?? null
}

/** El ítem que elige esta tecla, o -1. Ignora mayúsculas. */
export function itemDeTecla(tecla: string, cantidad: number): number {
  const i = TECLAS.indexOf((tecla ?? "").toLowerCase())
  return i >= 0 && i < cantidad ? i : -1
}

/** ¿El foco está en algo donde se escribe? Ahí la tecla es texto, no atajo. */
export function escribiendoEn(el: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!el) return false
  const t = (el.tagName ?? "").toUpperCase()
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || !!el.isContentEditable
}
