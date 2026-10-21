/**
 * 📒 ASIENTOS CONTABLES — A-FEAT-1318 (usuario 2026-10-22).
 *
 * Las facturas **no informadas en ARCA** que no se deben imputar al subdiario de IVA. *«Sería como una
 * especie de subdiario (que no es subdiario) llamado "Asientos Contables" de todo el ejercicio, que el
 * contador después mete en la contabilidad con asientos contables»*.
 *
 * ## Cómo se guarda
 * En la misma factura (`comprobantes_arca`): `ddjj_iva = 'Asiento contable'` y **sin mes contable**.
 * Sin mes no entra en ningún subdiario, ni en el Libro IVA, ni en el archivo para ARCA — todos esos
 * caminos filtran por `año_contable` + `mes_contable` —, y no queda «sin imputar» (eso es `'No'`).
 *
 * ## A qué ejercicio pertenece
 * Al de su **fecha de emisión**: no tiene subdiario que lo diga. Es la diferencia con el resto de las
 * compras, que se cortan por el subdiario en que entraron.
 */
import { primerDiaDelEjercicio, type Ejercicio } from "./ejercicio"
import { desdeArca, type AsientoLibroDiario } from "./libro-diario"

/** El valor de `ddjj_iva` que manda una factura a «Asientos Contables». */
export const ESTADO_ASIENTO_CONTABLE = "Asiento contable"
/** Cómo se lo nombra en pantallas y en el Excel. */
export const NOMBRE_ASIENTOS_CONTABLES = "Asientos Contables"

/** ¿Esta factura va a «Asientos Contables»? */
export const esAsientoContable = (f: { ddjj_iva?: unknown }): boolean =>
  String(f.ddjj_iva ?? "").trim() === ESTADO_ASIENTO_CONTABLE

/**
 * Las facturas de «Asientos Contables» del ejercicio: las marcadas, con fecha de emisión entre el
 * primer día y el cierre. Ordenadas por fecha. La columna «Subdiario» dice «Asientos Contables».
 */
export function asientosContablesDelEjercicio(
  facturas: readonly Record<string, unknown>[], ej: Ejercicio,
): AsientoLibroDiario[] {
  const desde = primerDiaDelEjercicio(ej)
  return facturas
    .filter(f => esAsientoContable(f))
    .map(desdeArca)
    .filter(a => a.fecha != null && a.fecha >= desde && a.fecha <= ej.fechaCierre)
    .map(a => ({ ...a, subdiario: NOMBRE_ASIENTOS_CONTABLES }))
    .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""))
}

/**
 * Qué se escribe en la factura al mandarla a «Asientos Contables», y al devolverla a sin imputar.
 * En un solo lugar para que la imputación, la gestión masiva y el panel no escriban distinto.
 */
export const CAMBIO_A_ASIENTO_CONTABLE = { ddjj_iva: ESTADO_ASIENTO_CONTABLE, "año_contable": null, mes_contable: null } as const
export const CAMBIO_DESDE_ASIENTO_CONTABLE = { ddjj_iva: "No", "año_contable": null, mes_contable: null } as const
