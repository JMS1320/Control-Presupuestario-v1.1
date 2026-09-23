// Capa compartida (UI-agnóstica): quincena SICORE a partir de una fecha.
// Un solo generador para Modal + Cash Flow (antes duplicado en generarQuincenaSicore /
// generarQuincenaSicoreLocal). Ver MANUAL-USO § Pagos.
// Formato: "YY-MM - 1ra|2da" (ej. "26-06 - 1ra").

export function generarQuincenaSicore(fecha: string): string {
  // Parsear la fecha como LOCAL desde el string (evita el corrimiento de zona horaria:
  // new Date("2026-07-16") es UTC medianoche → en Argentina cae al 15/07 → quincena mal).
  // fecha viene como "YYYY-MM-DD" (o ISO); tomamos los primeros 10 chars.
  const [y, m, d] = fecha.slice(0, 10).split('-')
  const yy = (y ?? '').slice(-2)
  const mm = (m ?? '01').padStart(2, '0')
  const dia = parseInt(d ?? '01', 10) || 1
  return `${yy}-${mm} - ${dia <= 15 ? '1ra' : '2da'}`
}

/**
 * 📅 **El PERÍODO DEL MÍNIMO es el MES, no la quincena** — [A-BUG-193](../../PENDIENTES.md#a-bug-193).
 *
 * La RG 830 fija el importe no sujeto a retención **por mes calendario y por sujeto retenido**: si
 * hay varios pagos al mismo proveedor en el mismo mes, **se acumulan y el mínimo se resta una sola
 * vez**. La quincena es el período de **información y depósito** del SICORE — otra cosa.
 *
 * 🧨 **El sistema las trataba como una sola** y reiniciaba el mínimo cada quincena. Medido sobre la
 * base entera: **MASSAGLIA 07/2026 y STRINGHINI 05/2026** recibieron el mínimo de Servicios
 * ($67.170) **dos veces en el mismo mes** — $2.686,80 retenidos de menos. Confirmado por el usuario
 * ([A-DEC-26](../../PENDIENTES.md#a-dec-26)).
 *
 * 📌 **Por qué alcanza con el prefijo**: la quincena se escribe `"YY-MM - 1ra|2da"`, así que sus
 * primeros 5 caracteres **son** el período mensual. No hay que reparsear fechas ni volver a la BD.
 */
export function periodoMensualDeQuincena(quincena: string): string {
  return (quincena ?? '').slice(0, 5)
}

/** Las dos quincenas del mes al que pertenece `quincena`. Para buscar los pagos del período. */
export function quincenasDelMes(quincena: string): string[] {
  const p = periodoMensualDeQuincena(quincena)
  return [`${p} - 1ra`, `${p} - 2da`]
}

/**
 * ¿El pago de `fecha` cae en el mismo período del mínimo que `quincena`?
 *
 * ⚠️ **Compara MESES**, que es el cambio de A-BUG-193: antes se comparaba la quincena entera y por
 * eso un pago de la 1ra no contaba para la 2da.
 */
export function mismoPeriodoDelMinimo(fecha: string, quincena: string): boolean {
  if (!fecha || !quincena) return false
  return periodoMensualDeQuincena(generarQuincenaSicore(fecha)) === periodoMensualDeQuincena(quincena)
}
