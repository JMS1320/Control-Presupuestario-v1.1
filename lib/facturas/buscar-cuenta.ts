/**
 * 🔎 Buscar cuentas del plan por texto (nombre, nombre largo o número) — el buscador del modal de asignar.
 *
 * 🐛 A-BUG-1377 (2026-10-26): el plan tiene cuentas SIN número (Consumos, FCI, CAJA…) y el buscador hacía
 * `c.nro_cuenta.includes(...)`: al escribir la primera letra la pantalla se caía («This page couldn't load»).
 */
export interface CuentaBuscable {
  categ: string | null
  cuenta_contable?: string | null
  nro_cuenta?: string | number | null
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()

export function cuentasQueCoinciden<T extends CuentaBuscable>(plan: readonly T[], texto: string): T[] {
  const q = norm(texto)
  const crudo = texto.trim()
  if (!q && !crudo) return [...plan]
  return plan.filter(c => norm(c.categ).includes(q) || norm(c.cuenta_contable).includes(q) || String(c.nro_cuenta ?? "").includes(crudo))
}
