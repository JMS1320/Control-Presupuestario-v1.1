import { RECURSOS } from "@/lib/auth/recursos"

/**
 * 🏦 PERMISO POR CUENTA DEL EXTRACTO — la decisión, sin base (A-FEAT-1336).
 *
 * Recibe el mapa EFECTIVO del rol (`nivelesDe`) y dice si importar en esa cuenta está frenado, y
 * por qué. Frena sólo lo apagado de forma explícita: en un rol abierto la cuenta no figura y pasa.
 * La usa `exigirCuentaExtracto` (servidor); la prueba `npm run probar`.
 */
export function motivoCuentaBloqueada(niveles: Record<string, string>, cuentaId: string): string | null {
  const recurso = `extracto.cuenta.${cuentaId}`
  // Una cuenta que no está en el registro la avisa `npm run verificar:recursos`; acá no se inventa.
  if (!RECURSOS.some((r) => r.id === recurso)) return null
  const nivel = niveles[recurso]
  if (nivel === "ninguno") return "Esa cuenta no está habilitada para tu rol."
  if (nivel === "lectura") return "Esa cuenta la tenés en sólo lectura: no podés importar."
  return null
}
