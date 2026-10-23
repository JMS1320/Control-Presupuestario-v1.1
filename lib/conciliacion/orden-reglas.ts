/**
 * 🔢 **EL ORDEN DE LAS REGLAS ES POR CUENTA** (A-BUG-1295, 2026-10-19).
 *
 * El motor aplica sólo las reglas de la cuenta que concilia (`cargarReglasActivas` filtra por
 * `cuenta_bancaria_id`), así que el `orden` vale **dentro de la cuenta**: la VISA puede tener su #1
 * aunque la cuenta corriente tenga otro #1.
 *
 * 🧨 Antes, el número sugerido era el máximo de **todas** las cuentas + 1 (la primera regla de la
 * tarjeta salía #44), y las flechas ↑↓ renumeraban **las 72 reglas de la tabla** 1..N — tocando cuentas
 * ajenas y, de paso, perdiendo el intercambio pedido.
 */

export interface ReglaOrdenable {
  id: string
  orden: number
}

/** El número a proponer para una regla nueva: el siguiente al último de ESA cuenta (1 si no tiene ninguna). */
export const proximoOrden = (reglasDeLaCuenta: ReglaOrdenable[]): number =>
  Math.max(0, ...reglasDeLaCuenta.map(r => r.orden)) + 1

/**
 * Mueve una regla un lugar arriba o abajo **entre las de su cuenta**. Devuelve sólo los cambios a
 * escribir (`id` → `orden` nuevo). Se renumera la cuenta 1..N en el orden resultante: así un número
 * repetido o un hueco no deja la flecha sin efecto. Las reglas de otras cuentas no aparecen nunca.
 */
export function moverRegla(
  reglasDeLaCuenta: ReglaOrdenable[],
  id: string,
  direccion: "up" | "down",
): { id: string; orden: number }[] {
  const lista = [...reglasDeLaCuenta].sort((a, b) => a.orden - b.orden)
  const i = lista.findIndex(r => r.id === id)
  const j = direccion === "up" ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return []
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  return lista
    .map((r, k) => ({ id: r.id, orden: k + 1, antes: r.orden }))
    .filter(r => r.orden !== r.antes)
    .map(({ id, orden }) => ({ id, orden }))
}
