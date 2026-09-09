/**
 * 🎯 EL FOCO — en qué está trabajando el usuario **ahora mismo**.
 *
 * ## Para qué
 * El sistema de notas ya captura el contexto solo: lee del DOM las solapas activas y el título del
 * modal abierto, así el usuario no tiene que escribir *«esto es en Productivo → Hacienda»*. Pero hay
 * algo que el DOM no puede decir: **cuál de los ítems de una lista tenía entre manos**.
 *
 * Si está en el tablero de huecos y anota *«esto no lo puedo resolver»*, sin el foco la nota queda
 * como «Presupuesto» y después hay que adivinar cuál era. Con el foco queda **vinculada a su lugar
 * sin que escriba nada** — que es exactamente lo que el sistema de notas viene a hacer.
 *
 * ## Por qué un módulo suelto y no un contexto de React
 * Porque los dos lados **no se conocen ni tienen que conocerse**: el tablero de huecos vive en el
 * Presupuesto y el widget de notas flota sobre toda la app. Meterlos en un provider común los
 * ataría para siempre por una sola variable. Acá cada uno habla con este archivo y con nadie más.
 *
 * ⚠️ **Es memoria de la sesión, no un dato.** Se pierde al refrescar, y está bien: describe lo que
 * está pasando en la pantalla en este segundo, no algo que haya que conservar.
 */

export interface Foco {
  /** Qué clase de cosa. Lo pone la pantalla, nunca el usuario. */
  /**
   * `hueco` · `fila` · `registro` = algo puntual de la pantalla.
   * `recorrido` = una observación sobre **cómo funciona el recorrido mismo**, que no es de ningún
   * paso en particular. El usuario las distingue y merecen leerse distinto.
   */
  tipo: "hueco" | "fila" | "registro" | "recorrido"
  /** Identificador estable — `hacienda:Vacas CUT`, el uuid de una fila. Para volver a encontrarlo. */
  clave: string
  /** Cómo se llamaba en pantalla, en el idioma del usuario. Para leer la nota sin resolver la clave. */
  texto: string
}

let actual: Foco | null = null

/**
 * Declara en qué está parado el usuario. Se llama al abrir algo, no al pasar el mouse:
 * un foco que cambia con el hover convierte la nota en una lotería.
 */
export function ponerFoco(f: Foco | null) { actual = f }

export function mirarFoco(): Foco | null { return actual }

/**
 * Lo borra **sólo si sigue siendo el que este llamador puso**.
 *
 * Sin esa condición, cerrar un modal viejo borraría el foco que acaba de poner otro — el clásico
 * *«se me limpió solo»* que después nadie puede reproducir.
 */
export function soltarFoco(clave: string) {
  if (actual?.clave === clave) actual = null
}
