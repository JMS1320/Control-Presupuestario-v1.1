/**
 * 📆 ¿Hay que preguntar por la FECHA DE PAGO al pasar un lote a un estado que paga? (P-45)
 *
 * ## Por qué existe la pregunta
 * `A-FEAT-22`: antes se asumía la `fecha_estimada`, que **casi nunca es la real** —el registro se
 * hace el día que se paga—, y **de esa fecha sale la quincena de SICORE**. Por eso se pregunta.
 *
 * ## Y por qué a veces no hay nada que preguntar (P-45)
 * El cartel propone **hoy**. Si las filas **ya tienen** `fecha_pago` = hoy, la pregunta es
 * *«¿querés cambiar esta fecha por esta misma fecha?»*. Caso Longo, 18/08.
 *
 * 🔑 **No se elimina la pregunta: se saltea cuando la respuesta ya está.** Un cartel que se
 * contesta solo enseña a despacharlo sin leer — y el día que pregunte algo distinto, se despacha
 * igual. Esa es la razón de fondo, no el click ahorrado.
 *
 * ## ⚠️ El sesgo es deliberado: ante la duda, SE PREGUNTA
 * Preguntar de más cuesta un click. **No preguntar cuando había que hacerlo escribe una fecha
 * equivocada en la que se apoya la quincena de SICORE**, y eso no se nota hasta la DDJJ. Por eso
 * cualquier caso raro —lista vacía, una fila sin fecha, una con otra fecha— cae del lado de
 * preguntar.
 */

export interface FilaConFechaPago {
  fecha_pago?: string | null
}

/**
 * 📅 **A-BUG-157 — los estados a partir de los cuales la fecha de pago importa.**
 *
 * El usuario, 2026-09-12: *«primero hubiera pensado que me pida fecha de pago, para cash flow como
 * para templates, cuando paso a pagar o superior»*. Lo dijo después de pasar una cuota de Red Vial
 * a `pagado` **sin que le preguntara nada** — y quedar sin fecha.
 *
 * 🔑 **La lista vive acá y no en cada pantalla.** Hasta el 2026-09-12 el gate existía **sólo en
 * Cash Flow**, y Templates no preguntaba por ninguno de sus dos caminos (la celda `estado` y la
 * edición masiva). Un criterio copiado en tres lados se desincroniza en el primero que se toca.
 *
 * **Qué entra y qué no**, que es la parte que hay que poder discutir:
 * - `pagar` · `preparado` — la plata **está por salir** y ya hay una fecha real prevista. El
 *   usuario los incluyó explícitamente (*«pagar o superior»*).
 * - `pagado` · `conciliado` — la plata **ya salió**.
 * - `debito` — salió sola; la fecha es la del débito, no la estimada.
 * - ❌ `pendiente` · `programado` · `credito` · `anterior` · `desactivado` — **no hay pago**, así
 *   que preguntar una fecha de pago sería inventar un dato. Es el otro modo de falla: un cartel que
 *   aparece donde no corresponde enseña a despacharlo sin leer, igual que uno que se contesta solo.
 */
export const ESTADOS_QUE_PAGAN = ['pagar', 'preparado', 'pagado', 'conciliado', 'debito'] as const

/** ¿Pasar a este estado implica que hay una fecha de pago real que registrar? */
export const esEstadoQuePaga = (estado: string | null | undefined): boolean =>
  !!estado && (ESTADOS_QUE_PAGAN as readonly string[]).includes(String(estado).toLowerCase().trim())

/**
 * `true` si hay que abrir el cartel de la fecha.
 *
 * Sólo devuelve `false` cuando **todas** las filas ya tienen exactamente la fecha que se iba a
 * proponer. Basta una que no la tenga para preguntar por el lote entero: un lote se confirma
 * junto, y no tendría sentido aplicarle a unas una fecha y a otras otra sin decirlo.
 */
export function hayQuePreguntarFechaPago(filas: FilaConFechaPago[], fechaPropuesta: string): boolean {
  if (filas.length === 0) return true          // sin filas no se sabe nada → se pregunta
  if (!fechaPropuesta) return true             // sin propuesta no hay con qué comparar
  return !filas.every(f => !!f.fecha_pago && f.fecha_pago === fechaPropuesta)
}
