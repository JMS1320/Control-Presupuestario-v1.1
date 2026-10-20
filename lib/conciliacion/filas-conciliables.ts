/**
 * 💳 **QUÉ FILAS DE UN EXTRACTO PASAN POR EL MOTOR** (A-BUG-1297, 2026-10-19).
 *
 * En la tarjeta, cada resumen trae además de los consumos dos filas que NO se concilian contra Cash Flow:
 * - `pago` — «SU PAGO EN PESOS»: se **vincula** con «Vincular pago» contra el débito de la cuenta corriente;
 * - `resumen` — el total del mes (estado `total`).
 *
 * 🧨 El *Conciliar (N)* de cada resumen ya las dejaba afuera, pero el botón general y el filtrado le
 * mandaban al motor el pago (un crédito de $2 M que se buscaba como si fuera un consumo devuelto).
 * El filtro vive en el MOTOR, así cualquier botón concilia lo mismo; la pantalla usa la misma función
 * para que el número que muestra sea el que se concilia.
 */
export const esFilaConciliable = (m: { tipo_fila?: string | null }) =>
  m.tipo_fila !== "pago" && m.tipo_fila !== "resumen"
