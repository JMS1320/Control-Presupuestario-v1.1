/**
 * 👤 **A-FEAT-132 — quién cobró, sacado del propio movimiento bancario.**
 *
 * Pedido del usuario 2026-09-12: *«asigné el otro pago a CZ ganadería ok, pero no llenó proveedor y
 * tiene por extracto bancario cómo tomarlo. Podría preguntar eventualmente»*.
 *
 * ## Por qué esto es un lib y no dos funciones adentro del motor
 * Estaban **encerradas en `useMotorConciliacion`**, así que el único que podía usarlas era el motor
 * automático. El camino manual —el que se usa justo cuando el automático no alcanzó— no tenía cómo,
 * y el dato se tiraba. Es la pieza 2 del norte administrativo (§ `CLAUDE.md` 🔍 *¿qué estamos
 * tirando?*): lo más barato que existe, porque no hay que conseguirlo.
 *
 * ⚠️ **El CUIT viene en `leyendas_adicionales_2`.** No es un nombre de columna que nadie adivine, y
 * el tipo de TypeScript dice `leyendas_adicionales2` mientras la base devuelve `leyendas_adicionales_2`
 * — por eso se miran las dos.
 */

/** Sólo los prefijos válidos de CUIT argentino. Un número de 11 dígitos cualquiera no es un CUIT. */
const PREFIJOS_CUIT = [20, 23, 24, 27, 30, 33, 34]

export const normalizarCuit = (cuit: string | null | undefined): string =>
  (cuit || '').replace(/[-.\s]/g, '')

/**
 * Extrae el CUIT de la contraparte del movimiento, si el banco lo mandó.
 *
 * Pura: se prueba en `npm run probar` sin tocar la base.
 */
export function extraerCuitBancario(movimiento: any): string | null {
  const valor = String(
    movimiento?.leyendas_adicionales_2 ?? movimiento?.leyendas_adicionales2 ?? ''
  ).trim()
  if (!/^\d{11}$/.test(valor)) return null
  return PREFIJOS_CUIT.includes(parseInt(valor.substring(0, 2))) ? valor : null
}

/**
 * El nombre que le corresponde a ese CUIT en el maestro de contrapartes.
 *
 * 📍 El maestro es `public.proveedores` (§ `CLAUDE.md` 👥 Contrapartes). Devuelve `null` si el CUIT
 * no está: **no lo da de alta**. Dar de alta al pasar por acá crearía contrapartes desde una
 * pantalla de conciliación, sin razón social real y sin saber si es cliente o proveedor.
 */
export async function buscarNombreProveedor(
  cliente: { from: (t: string) => any },
  cuit: string | null | undefined,
): Promise<string | null> {
  const limpio = normalizarCuit(cuit)
  if (!limpio) return null
  const { data } = await cliente.from('proveedores').select('razon_social').eq('cuit', limpio).maybeSingle()
  return data?.razon_social || null
}

export interface ProveedorPropuesto {
  cuit: string
  nombre: string | null
}

/**
 * Lo que hay para proponer en este movimiento: el CUIT que trae y, si está en el maestro, su nombre.
 *
 * 🔑 **Devuelve el CUIT aunque no encuentre el nombre.** Un CUIT sin nombre sigue siendo un dato
 * útil —dice que la contraparte falta en el maestro—, y callarlo esconde justo el hueco que la
 * § 👥 Contrapartes existe para tapar.
 */
export async function proveedorDelMovimiento(
  cliente: { from: (t: string) => any },
  movimiento: any,
): Promise<ProveedorPropuesto | null> {
  const cuit = extraerCuitBancario(movimiento)
  if (!cuit) return null
  return { cuit, nombre: await buscarNombreProveedor(cliente, cuit) }
}
