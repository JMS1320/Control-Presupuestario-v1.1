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
 * ## 🎯 A dónde va: `descripcion`, NO `detalle` (A-BUG-161)
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
 * ### Y sí, pisa la etiqueta generada — a sabiendas
 * `descripcion` suele traer `«Red Vial Cuota Lote Puerto - Junio 2026»`, que arma el generador de
 * campaña. Escribir encima la borra. Es aceptable y no rompe nada: **el motor matchea por importe y
 * fecha**, no por ese texto (`buscarEnPool`); la `descripcion` se usa para **mostrar**. Y además el
 * texto es reconstruible — nombre, mes y año siguen en la cuota y su template.
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
      // 🎯 `descripcion`, no `detalle` — ver A-BUG-161 en el encabezado.
      .update({ descripcion: detalle || null, updated_at: new Date().toISOString() })
      .eq('id', templateCuotaId)

    if (error) return { propagado: false, cuotaId: templateCuotaId, error: error.message }
    return { propagado: true, cuotaId: templateCuotaId }
  } catch (e: any) {
    return { propagado: false, cuotaId: templateCuotaId, error: e?.message || String(e) }
  }
}
