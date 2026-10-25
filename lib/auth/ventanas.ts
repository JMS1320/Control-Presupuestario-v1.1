/**
 * 🕳️ LAS FUNCIONES DE ADENTRO DE LAS VENTANAS — A-BUG-1335.
 *
 * Las 10 `funcionalidad` de `lib/auth/recursos.ts` viven como solapas dentro de tres ventanas
 * (Configuración de reglas y Asignar manualmente en Extracto, Anticipos en Cash Flow). Tenían
 * casilla en Roles pero ninguna pantalla la consultaba: destildarlas no sacaba nada. Acá está la
 * lógica de qué se muestra, para que las tres ventanas decidan igual y `npm run probar` la cubra.
 *
 * `puede` es la pregunta de la pantalla (`useSeMuestra()`): respeta el modo permisos.
 */

export const REGLAS_EXTRACTO = ["extracto.conciliacion", "extracto.contable-interno", "extracto.parseo"]
export const ASIGNAR_EXTRACTO = ["extracto.template", "extracto.arca", "extracto.sueldo", "extracto.grupo", "extracto.venta"]
export const ANTICIPOS_CASHFLOW = ["cashflow.nuevo", "cashflow.existentes"]

type Puede = (recurso: string) => boolean

/** La solapa (sin la sección: `"parseo"`) de la primera permitida, o null si no hay ninguna. */
export function primeraPermitida(recursos: string[], puede: Puede): string | null {
  const r = recursos.find((id) => puede(id))
  return r ? r.split(".").slice(1).join(".") : null
}

/** ¿Hay algo para mostrar en la ventana? Si no, el botón que la abre no se dibuja. */
export function hayAlguna(recursos: string[], puede: Puede): boolean {
  return recursos.some((id) => puede(id))
}

/**
 * En qué solapa abre «Asignar manualmente». Un ingreso abre en Venta (pedido del usuario) y un
 * egreso en Template; si ésa está apagada, la primera permitida. Venta sólo existe para créditos:
 * un débito nunca se concilia contra una venta. null = no hay nada que este rol pueda asignar acá.
 */
export function tabInicialAsignar(esIngreso: boolean, puede: Puede): string | null {
  const orden = esIngreso
    ? ["extracto.venta", "extracto.template", "extracto.arca", "extracto.sueldo", "extracto.grupo"]
    : ["extracto.template", "extracto.arca", "extracto.sueldo", "extracto.grupo"]
  return primeraPermitida(orden, puede)
}
