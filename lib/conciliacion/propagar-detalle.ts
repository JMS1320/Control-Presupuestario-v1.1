/**
 * 🔁 **A-BUG-158 — el detalle escrito en el Extracto viaja a la cuota conciliada.**
 *
 * Pedido del usuario 2026-09-12, conciliando:
 * > *«Modifiqué detalle y veo que no lo propaga desde extracto hacia templates. Debería hacerlo,
 * > **son 1 en esencia**.»*
 *
 * 🔑 **Esa última frase es el diseño entero.** Un movimiento bancario conciliado y su cuota no son
 * dos registros parecidos que conviene mantener sincronizados: **son el mismo hecho visto de dos
 * lados** — el banco lo ve como plata que salió, el template como una obligación que se cumplió.
 * Que el detalle viva en uno y no en el otro obliga a escribirlo dos veces; y la segunda vez nadie
 * se acuerda, así que en la práctica el dato existe en una sola pantalla.
 *
 * ## Por qué en un lib y no en el `onBlur` del input
 * Porque el detalle del Extracto se guarda desde **dos** lugares (Enter y blur) y porque el mismo
 * movimiento puede estar enganchado a una cuota, a una factura o a un sueldo. La decisión de a
 * quién avisarle no puede estar escrita dentro de un manejador de teclado.
 *
 * ## ⚠️ Qué NO hace, y es a propósito
 * - **No propaga al revés** (template → extracto). El usuario pidió esta dirección, que es la del
 *   trabajo real: se concilia mirando el banco. La vuelta necesita decidir qué gana cuando los dos
 *   cambiaron, y eso no se inventa sin que haga falta.
 * - **No toca facturas ni sueldos todavía.** `comprobante_arca_id` y `sueldo_pago_id` cuelgan del
 *   mismo movimiento y les cabe el mismo argumento, pero cada uno tiene su propia noción de
 *   «detalle» y hay que mirarla antes. Queda dicho acá para que no se pierda.
 * - **No borra.** Vaciar el detalle en el extracto vacía el de la cuota —son lo mismo—, pero
 *   cualquier otra cosa que la cuota tenga cargada no se toca.
 *
 * 🛑 **Nunca tira.** Si la propagación falla, el guardado del extracto ya ocurrió y no se pierde
 * nada: se devuelve el error para que la pantalla lo diga. Un fallo al propagar no puede romper la
 * edición que el usuario acaba de hacer.
 */
import { supabase } from '@/lib/supabase'

export interface ResultadoPropagacion {
  /** `true` si había una cuota enganchada y se le escribió el detalle. */
  propagado: boolean
  /** Id de la cuota que recibió el dato, si hubo. */
  cuotaId?: string
  error?: string
}

/**
 * Lleva el `detalle` del movimiento a la cuota de template que tiene conciliada.
 *
 * @param templateCuotaId  el `template_cuota_id` del movimiento — si viene vacío no hay nada que hacer
 * @param detalle          lo que quedó escrito en el extracto
 */
export async function propagarDetalleACuota(
  templateCuotaId: string | null | undefined,
  detalle: string | null,
): Promise<ResultadoPropagacion> {
  if (!templateCuotaId) return { propagado: false }

  try {
    const { error } = await supabase
      .from('cuotas_egresos_sin_factura')
      .update({ detalle: detalle || null, updated_at: new Date().toISOString() })
      .eq('id', templateCuotaId)

    if (error) return { propagado: false, cuotaId: templateCuotaId, error: error.message }
    return { propagado: true, cuotaId: templateCuotaId }
  } catch (e: any) {
    return { propagado: false, cuotaId: templateCuotaId, error: e?.message || String(e) }
  }
}
