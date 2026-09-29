/**
 * 🔗 **El ENCARGO: «llevame a cancelar las notas de crédito de este proveedor».**
 *
 * Nace 2026-09-29, cuando el usuario probó el aviso del Cash Flow y lo marcó 🟡:
 * > *«Anduvo en parte, porque **no hubo botón para cancelarlas unas con otras** como lo teníamos
 * > desarrollado.»*
 *
 * ## Qué problema resuelve, y por qué no es sólo un link
 *
 * La cancelación de notas de crédito ya existe y funciona, pero vive **adentro** de la pantalla de
 * Pagos (`vista-facturas-arca`, 12.615 líneas), enganchada a su estado local. Desde el Cash Flow no
 * se la puede invocar: son dos componentes que no se conocen.
 *
 * Las dos salidas malas eran evidentes:
 * - **Copiar la cancelación al Cash Flow** → dos lugares que cancelan notas de crédito. El día que
 *   cambie el criterio, uno queda viejo **sin que nada lo señale**. Es § 🗺️ *«se arregló un camino
 *   de los dos»*, que en este proyecto ya pasó cinco veces.
 * - **Dejar sólo el cartel** → que es lo que hice la primera vez, y el usuario tenía razón en
 *   marcarlo a medias: avisarle que hay $2 M mal y después mandarlo a buscar la pantalla **no le
 *   ahorra el trabajo, se lo mueve de lugar**.
 *
 * ## Cómo funciona: un encargo, no una copia
 *
 * El Cash Flow **deja un encargo** —qué proveedor— y navega. La pantalla de Pagos lo levanta al
 * cargar y **abre SU modal de siempre**, ya con las facturas y las notas de crédito de ese CUIT.
 * La lógica de cancelar sigue existiendo **una sola vez**.
 *
 * ## ⚠️ Por qué `sessionStorage` y no la URL
 *
 * Porque un CUIT en la URL queda en el historial y se puede compartir o recargar días después,
 * disparando el modal sobre un estado que ya cambió. El encargo es **de un solo uso**: se lee, se
 * borra, y **vence**. Si la navegación se pierde en el camino, no queda nada colgado.
 *
 * 🛑 **Y no viaja ningún dato del negocio**: va el CUIT y el nombre, nada de importes ni de ids de
 * comprobante. La pantalla de destino vuelve a buscar todo contra la base — si entre el click y la
 * llegada alguien pagó una factura, se ve la realidad y no una foto vieja.
 */

const CLAVE = "encargo-cancelacion-nc"

/** Cuánto vale un encargo antes de considerarse viejo. Un minuto alcanza para navegar. */
const VENCE_EN_MS = 60_000

export interface EncargoCancelacionNC {
  cuit: string
  proveedor: string
  /** Epoch en milisegundos. Sirve para descartar un encargo que quedó colgado. */
  pedidoEn: number
}

/**
 * Deja el encargo y navega a Egresos.
 *
 * ⚠️ **Navega con `?seccion=egresos`**, que es el mecanismo que la app ya usa para entrar a una
 * sección desde afuera (ver `app/page.tsx`). No se inventa una forma nueva de navegar.
 */
export function dejarEncargoCancelacionNC(cuit: string, proveedor: string): void {
  try {
    const encargo: EncargoCancelacionNC = { cuit, proveedor, pedidoEn: Date.now() }
    sessionStorage.setItem(CLAVE, JSON.stringify(encargo))
  } catch {
    // Storage bloqueado (ventana privada, permisos). No se corta la navegación: el usuario llega
    // igual a Pagos y cancela a mano, que es exactamente lo que hacía antes de esta feature.
  }
  window.location.href = "/?seccion=egresos"
}

/**
 * Levanta el encargo **y lo borra**. Devuelve `null` si no hay, si está vencido o si no se pudo leer.
 *
 * 🔑 **Se borra siempre, aunque esté vencido.** Un encargo que sobrevive a su lectura vuelve a
 * abrir el modal cada vez que la pantalla se recarga, que es molesto y además confuso: parecería
 * que el sistema insiste con algo que ya resolviste.
 */
export function tomarEncargoCancelacionNC(): EncargoCancelacionNC | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE)
    if (!crudo) return null
    sessionStorage.removeItem(CLAVE)
    const e = JSON.parse(crudo) as EncargoCancelacionNC
    if (!e?.cuit) return null
    if (Date.now() - (e.pedidoEn || 0) > VENCE_EN_MS) return null
    return e
  } catch {
    return null
  }
}
