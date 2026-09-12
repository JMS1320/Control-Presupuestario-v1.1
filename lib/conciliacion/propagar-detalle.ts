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
 * ## 🎯 A dónde va: `detalle` — y la historia de cómo se llegó ahí
 * **Resuelto por [A-FEAT-137]: `detalle` es el destino correcto.** Pero se llegó dando una vuelta
 * que conviene dejar escrita, porque el error intermedio es instructivo.
 *
 * ### Primer intento (mal, [A-BUG-161])
 * La primera versión de este archivo escribía en `cuotas_egresos_sin_factura.detalle` **porque se
 * llama igual que la columna del extracto**. Esa columna está muerta: de **1.045 cuotas tenía UNA**
 * — la que escribió esta misma función —, ninguna pantalla la muestra y ningún código la lee.
 *
 * 🔑 **La equivalencia buena ya estaba escrita en el código, no hacía falta deducirla**:
 * `crearCuotaEnTemplate` (el motor, cuando una regla tiene `llena_template`) inserta
 * `descripcion: regla.detalle || movimiento.descripcion`. O sea que el sistema **ya mapea
 * `extracto.detalle` → `cuota.descripcion`**. Y el Cash Flow lee de ahí
 * (`useMultiCashFlowData`: `detalle: c.descripcion || c.egreso?.nombre_referencia`).
 *
 * 🧨 **El error de método vale más que el bug**: se eligió el destino por **cómo se llama la
 * columna** y no por **dónde se ve el dato** — justo lo que esta feature vino a resolver. Y un
 * `UPDATE` a una columna que existe **no falla**: pasó el type-check, los casos, y hasta la
 * verificación en la base, porque se consultó la columna a la que se había escrito. Lo encontró el
 * usuario mirando la pantalla.
 *
 * ### Segundo intento (también mal, y por eso nació A-FEAT-137)
 * Se apuntó a `descripcion`, que era la columna **visible** y la que el motor ya usaba. Andaba,
 * pero **pisaba la etiqueta generada** (`«Red Vial Cuota Lote Puerto - Junio 2026»`). El usuario
 * puso el dedo en la llaga: *«detalle es detalle y descripción es lo que es un identificador»*.
 * El problema no era el destino: era que **una sola columna estaba haciendo dos trabajos**.
 *
 * ### Ahora
 * Con [A-FEAT-137] el identificador **se genera** y `detalle` guarda sólo lo del usuario, así que
 * este `UPDATE` ya no tiene que elegir entre pisar una etiqueta o escribir en el vacío. Y el
 * detalle que llega del Extracto **es exactamente eso**: lo que una persona escribió.
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
 * @param detalle          lo que quedó escrito en el extracto (va a `descripcion` de la cuota)
 */
export async function propagarDetalleACuota(
  templateCuotaId: string | null | undefined,
  detalle: string | null,
): Promise<ResultadoPropagacion> {
  if (!templateCuotaId) return { propagado: false }

  try {
    const { error } = await supabase
      .from('cuotas_egresos_sin_factura')
      // 🎯 `detalle`, y ahora sí es el campo correcto — ver A-FEAT-137 en el encabezado.
      .update({ detalle: detalle || null, updated_at: new Date().toISOString() })
      .eq('id', templateCuotaId)

    if (error) return { propagado: false, cuotaId: templateCuotaId, error: error.message }
    return { propagado: true, cuotaId: templateCuotaId }
  } catch (e: any) {
    return { propagado: false, cuotaId: templateCuotaId, error: e?.message || String(e) }
  }
}
