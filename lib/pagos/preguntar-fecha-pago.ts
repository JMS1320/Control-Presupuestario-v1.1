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
