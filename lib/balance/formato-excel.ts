/**
 * 📐 EL FORMATO DEL EXCEL QUE VA AL CONTADOR — A-FEAT-1184.
 *
 * Pedido del usuario 2026-09-29, en la solapa «Pasos a seguir» que devolvió:
 * *«formato del número: 1000 · Contabilidad»* y *«formato de tablas… intentemos que sea lo más
 * amigable para el contador»*.
 *
 * ## Por qué un módulo y no un `z` suelto en cada celda
 *
 * Porque el formato **tiene que ser el mismo en las 13 solapas**. Un papel donde los importes se
 * ven distinto en cada hoja obliga a leer dos veces el mismo número para creerle, y el destinatario
 * es alguien que va a recorrer todo el archivo.
 *
 * ## 🧮 Y la parte que pidió expresamente: FÓRMULAS, no resultados
 *
 * *«si son fórmulas deben quedar las fórmulas en el excel y no los datos»* (nota en `02 Hacienda`).
 *
 * 🔑 **No es estética: es poder auditar y poder probar.** Con la fórmula puesta, él cambia un
 * precio en la celda y **el papel se recalcula solo**; con el número pegado, tiene que rehacer la
 * cuenta a mano y el Excel deja de ser una herramienta para pasar a ser una foto.
 */
import * as XLSX from "xlsx"

/**
 * Formato **Contabilidad** de Excel: alinea el signo, separa miles y muestra un guión en el cero.
 * Es el que espera un contador — un `#,##0.00` pelado desalinea la columna en cuanto hay negativos.
 */
export const MONEDA = '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-'
/** Cantidades enteras: cabezas, comprobantes, productos. */
export const ENTERO = "#,##0"
/** Toneladas: tres decimales, porque el cuadre de granos se juega en los kilos. */
export const TONELADAS = "#,##0.000"
/** Coeficientes (0,90 · 1,5). Se muestran como número, no como porcentaje: él los escribe así. */
export const COEFICIENTE = "0.00"
export const FECHA = "dd/mm/yyyy"

/** Qué formato y qué ancho lleva cada columna de una hoja. */
export interface Columna {
  /** Ancho en caracteres. */
  ancho: number
  /** Formato de número. Sin esto, la columna queda como la deja Excel. */
  z?: string
}

/**
 * Aplica anchos y formatos a una hoja ya armada.
 *
 * 📌 **Se aplica al final y sobre la hoja entera**, no celda por celda al construirla: las filas de
 * título y los subtotales intercalados harían que la mitad de las celdas se olvidara el formato, y
 * ése es justo el defecto que hace que un papel se vea desprolijo.
 *
 * ⚠️ **Sólo toca las celdas numéricas.** Una celda de texto en una columna de importes —un
 * `"FALTA EL PRECIO"`, que los hay a propósito— **se deja tal cual**: forzarle un formato de número
 * la mostraría vacía, y ese aviso es el que no puede perderse.
 */
export function formatearHoja(ws: XLSX.WorkSheet, columnas: Columna[]): void {
  ws["!cols"] = columnas.map(c => ({ wch: c.ancho }))
  if (!ws["!ref"]) return

  const r = XLSX.utils.decode_range(ws["!ref"])
  for (let fila = r.s.r; fila <= r.e.r; fila++) {
    for (let col = r.s.c; col <= Math.min(r.e.c, columnas.length - 1); col++) {
      const z = columnas[col]?.z
      if (!z) continue
      const dir = XLSX.utils.encode_cell({ r: fila, c: col })
      const celda = ws[dir] as XLSX.CellObject | undefined
      if (celda && celda.t === "n") celda.z = z
    }
  }
}

/**
 * Una celda con **fórmula**, para que el Excel se pueda recalcular.
 *
 * El `v` es el valor que ya calculamos: Excel lo muestra hasta que el usuario abre el archivo y
 * recalcula. Sin él, la celda se ve vacía hasta que alguien toca algo — que parece un error.
 */
export const conFormula = (formula: string, valor: number, z = MONEDA): XLSX.CellObject =>
  ({ t: "n", f: formula, v: valor, z })

/** Congela la primera fila (o las que se pidan) para que el encabezado no se pierda al scrollear. */
export function congelarEncabezado(ws: XLSX.WorkSheet, filas = 1): void {
  ws["!freeze"] = { xSplit: "0", ySplit: String(filas), topLeftCell: `A${filas + 1}`, activePane: "bottomLeft", state: "frozen" }
}
