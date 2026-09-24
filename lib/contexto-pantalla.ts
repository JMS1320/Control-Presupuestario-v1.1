/**
 * 📍 Dónde está parado el usuario — leído del DOM, en UN SOLO lugar.
 *
 * ## Por qué existe este archivo
 * Esto estaba escrito dos veces: en las notas (`Alt+N`) y, al construir las marcas «para revisar»,
 * lo volví a escribir. Y la segunda copia **repitió un bug que la primera ya tenía arreglado**: el
 * contador de pendientes vive DENTRO de la solapa, así que el texto crudo daba `«Sueldos18»` en vez
 * de `«Sueldos»`. Lo detectó el test del navegador el 2026-09-04.
 *
 * Ese es el costo real de duplicar: no el trabajo repetido, sino **que el arreglo no viaja**.
 * Por eso vive acá y lo usan los dos.
 *
 * ## Cómo se marca lo que no debe contarse
 * Cualquier adorno que se meta dentro de una solapa —un contador, un punto de color— se excluye
 * poniéndole `data-nota-ignorar`, sin volver a tocar esta función.
 */

export interface ContextoPantalla {
  /** La solapa de nivel 1: «Egresos», «Productivo». Es la clave por la que se agrupa. */
  pantalla: string
  /** El camino por debajo: «Subdiarios», «Hacienda → Movimientos». */
  subpantalla: string
  /** La ruta SIN el primer segmento — que en esta app es la contraseña (A-SEC-04). */
  ruta: string
}

/** El texto visible de un nodo, salteando lo marcado con `data-nota-ignorar`. */
export function textoLimpio(nodo: Element | null): string {
  if (!nodo) return ""
  const copia = nodo.cloneNode(true) as Element
  copia.querySelectorAll("[data-nota-ignorar]").forEach(n => n.remove())
  return (copia.textContent ?? "").trim()
}

/** La ruta sin la llave de acceso. `/adminjms1320/x/y` → `/x/y`. */
export function rutaSinLlave(): string {
  if (typeof window === "undefined") return ""
  const resto = window.location.pathname.split("/").filter(Boolean).slice(1)
  return "/" + resto.join("/") + window.location.search
}

/**
 * Todas las solapas activas, no sólo la primera.
 *
 * `pantalla` se queda con el nivel 1 a propósito —es la clave de agrupación— y el resto va a
 * `subpantalla`. Sin esto, una marca dice «Egresos» y no «Egresos → Subdiarios», que es lo que hace
 * falta para volver al lugar donde se vio el problema.
 *
 * En el servidor no hay `document`, y esto se evalúa también durante el render en SSR: sin el guard
 * la página entera tiraba `ReferenceError: document is not defined`.
 */
export function contextoActual(): ContextoPantalla {
  if (typeof document === "undefined") return { pantalla: "", subpantalla: "", ruta: "" }
  const activas = Array.from(document.querySelectorAll('[role="tab"][data-state="active"]'))
    .map(t => textoLimpio(t))
    .filter(Boolean)
  return {
    pantalla: (activas[0] ?? "").slice(0, 120),
    subpantalla: activas.slice(1).join(" → ").slice(0, 200),
    ruta: rutaSinLlave(),
  }
}

/** El modal abierto, si hay alguno. Se lee aparte porque no siempre se quiere. */
export function modalActual(): string {
  if (typeof document === "undefined") return ""
  const d = document.querySelector('[role="dialog"] h2, [role="dialog"] [id$="-title"]')
  return textoLimpio(d).slice(0, 160)
}
