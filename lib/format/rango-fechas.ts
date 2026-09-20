/**
 * 📅 **A-FEAT-161 — el cálculo de un rango de meses, sin React.**
 *
 * Vive aparte del componente `components/rango-de-fechas.tsx` por dos razones:
 * **1)** es lógica pura y así tiene casos en `npm run probar` — el runner sólo carga `.ts`;
 * **2)** cualquier pantalla puede calcular un mes sin arrastrar el componente.
 */

const dosDigitos = (n: number) => String(n).padStart(2, '0')

/**
 * El primer y el último día de un mes, en el formato que quiere `<input type="date">`.
 *
 * 📌 `mesCero` es el mes de JavaScript: **0 = enero**. El último día sale de pedirle al `Date` el
 * «día 0» del mes siguiente, así febrero bisiesto da 29 sin ninguna tabla.
 */
export function mesCompleto(anio: number, mesCero: number): { desde: string; hasta: string } {
  const ultimo = new Date(anio, mesCero + 1, 0).getDate()
  return {
    desde: `${anio}-${dosDigitos(mesCero + 1)}-01`,
    hasta: `${anio}-${dosDigitos(mesCero + 1)}-${dosDigitos(ultimo)}`,
  }
}

/** El mes de hoy. */
export function mesActual(hoy = new Date()) {
  return mesCompleto(hoy.getFullYear(), hoy.getMonth())
}

/** El mes anterior. ⚠️ En enero devuelve **diciembre del año pasado**, no «mes −1» del mismo año. */
export function mesAnterior(hoy = new Date()) {
  const m = hoy.getMonth() - 1
  return m < 0 ? mesCompleto(hoy.getFullYear() - 1, 11) : mesCompleto(hoy.getFullYear(), m)
}
