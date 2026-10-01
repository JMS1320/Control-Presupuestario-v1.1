import { createClientServer } from "@/lib/supabase-server"

/**
 * EL CLIENTE CON EL QUE DEBE TRABAJAR CASI TODA RUTA — A-FEAT-169 / A-SEC-01
 *
 * Es el cliente de la **sesión de quien hizo el pedido**, así que **queda sujeto a la RLS**. Eso lo
 * convierte en la pieza que hace que la política de permisos se aplique en un solo lugar: la base
 * decide, y la ruta no tiene que acordarse de nada.
 *
 * ⚠️ **Por qué existe, con el número que lo motivó.** El 2026-09-24, **37 de 41 rutas** usaban
 * `supabaseAdmin` (`service_role`), que **saltea la RLS por completo**. O sea que la RLS instalada
 * ese mismo día protegía las 452 escrituras directas del navegador **y no protegía ni una ruta de
 * API**: cada una era una puerta de acceso total, limitada sólo por el guard escrito a mano, y 25
 * de ellas decían apenas «cualquier rol con sesión».
 *
 * Con este cliente, una ruta nueva **nace protegida**. Con el otro, cada ruta nueva es una decisión
 * de seguridad que alguien puede olvidar — y olvidarla no falla, sólo abre.
 *
 * ### Cuándo SÍ va `supabaseAdmin`
 * Sólo tres casos, todos verificados el 2026-09-24:
 *   1. **`auth.admin.*`** — crear/invitar/revocar cuentas, borrar factores 2FA. No hay otra forma.
 *   2. **`public.roles`** — `scripts/60` le revocó el GRANT a `authenticated` a propósito, para que
 *      nadie pueda editarse sus propios permisos. Se lee sólo desde el servidor.
 *   3. **Storage** con permisos elevados (la foto de perfil).
 *
 * Cualquier otro uso es una ruta que se saltea la política sin necesitarlo.
 */
export async function clienteUsuario() {
  return createClientServer()
}
