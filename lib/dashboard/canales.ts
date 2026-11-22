/**
 * 🏦 QUÉ CANALES SUMA EL DASHBOARD DE CADA EMPRESA — A-FEAT-1637 (JMS 22/11/2026).
 *
 * *«Cada responsable tiene todos sus canales — el dashboard debe ser total.»* Hasta acá el Dashboard leía sólo el banco de MSA
 * (y los echeqs de terceros). Ahora cada empresa suma **todos sus canales en pesos** del registro único de cuentas
 * (`CUENTAS_BANCARIAS`, `hooks/useMotorConciliacion.ts`): bancos, cajas, tarjetas y echeqs.
 *
 * 🛑 **Quedan afuera, y se dice en la pantalla:** las cuentas en DÓLARES (pesos y dólares nunca mezclados en una tabla, JMS 12/11)
 * y las de **Cotitulares** (no es una empresa). Las inactivas tampoco.
 *
 * Pura: recibe el registro como parámetro, así los casos de `npm run probar` la prueban con datos fijos.
 */

export const EMPRESAS_DASHBOARD = ["MSA", "PAM", "MA"] as const
export type EmpresaDashboard = (typeof EMPRESAS_DASHBOARD)[number]

/** Lo mínimo que hace falta de una cuenta del registro. */
export interface CuentaDelRegistro {
  id: string
  nombre: string
  tabla_bd: string
  schema_bd?: string
  empresa: string
  activa: boolean
  tipo?: string
  moneda?: string
}

export interface CanalDashboard {
  id: string
  nombre: string
  tabla: string
  /** `public` cuando el registro no lo dice. */
  schema: string
  empresa: EmpresaDashboard
  tipo: string
}

const esEmpresa = (e: string): e is EmpresaDashboard => (EMPRESAS_DASHBOARD as readonly string[]).includes(e)

/** Los canales que suma el dashboard para las empresas elegidas, en el orden del registro. */
export function canalesDelDashboard(registro: CuentaDelRegistro[], empresas: Iterable<string>): CanalDashboard[] {
  const elegidas = new Set(empresas)
  return registro
    .filter(c => c.activa && c.moneda !== "USD" && esEmpresa(c.empresa) && elegidas.has(c.empresa))
    .map(c => ({ id: c.id, nombre: c.nombre, tabla: c.tabla_bd, schema: c.schema_bd || "public", empresa: c.empresa as EmpresaDashboard, tipo: c.tipo || "banco" }))
}

/** Lo que NO suma de esas empresas (para la nota debajo de la tabla): sus cuentas en dólares. Cotitulares se aclara aparte. */
export function canalesFueraDelDashboard(registro: CuentaDelRegistro[], empresas: Iterable<string>): string[] {
  const elegidas = new Set(empresas)
  return registro.filter(c => c.activa && c.moneda === "USD" && elegidas.has(c.empresa)).map(c => c.nombre)
}
