/**
 * Capa compartida (UI-agnóstica): registro de retención SICORE v2.
 *
 * 🔑 **La regla que ordena la numeración** (corregida 2026-09-29, A-BUG-1222):
 * **un certificado = un PAGO.** Varias facturas pagadas juntas comparten certificado; dos pagos
 * distintos —aunque caigan en la misma quincena y sean del mismo proveedor— son **dos** retenciones
 * con **dos** certificados. Ver el comentario largo en el bloque de reutilización de números.
 */
// Mirror VERBATIM de registrarEnSicoreRetenciones (vista-facturas-arca) con `schema`
// como parámetro (antes usaba schemaName del componente). Numeración perpetua de
// nro_comprobante y nro_certificado, dedup por cuit+tipo+quincena, respeta estado_quincena.
// Ver MANUAL-USO § Pagos. Cuando se deprece el Modal (E5) también usará esta función.

import { supabase } from "@/lib/supabase"

export interface RegistrarRetencionParams {
  origen: 'directo' | 'anticipo' | 'agrupacion'
  quincena: string
  fecha_pago: string
  factura_id?: string | null
  anticipo_id?: string | null
  fecha_emision?: string | null
  tipo_comprobante?: number | null
  punto_venta?: number | null
  numero_desde?: number | null
  cuit_emisor?: string | null
  denominacion_emisor?: string | null
  tipo_sicore: string
  alicuota: number
  neto_gravado_pagado: number
  total_pagado: number
  descuento_aplicado: number
  minimo_no_imponible: number
  base_imponible: number
  retencion: number
  pago: number
}

/**
 * Registra una retención en {schema}.sicore_retenciones (v2).
 * - Bloquea si la quincena está 'declarada'.
 * - Hereda 'cerrada' si la quincena ya estaba cerrada.
 * - Reutiliza nro_comprobante/nro_certificado si ya hay un registro no anulado
 *   del mismo cuit+tipo+quincena **Y DEL MISMO `fecha_pago`**; sino asigna el
 *   siguiente número perpetuo. Ver A-BUG-1222: sin la fecha, un segundo pago
 *   heredaba el certificado del primero y el PDF salía con las dos retenciones.
 * No interrumpe el flujo si falla (loguea).
 */
export async function registrarEnSicoreRetenciones(schema: string, params: RegistrarRetencionParams) {
  try {
    const anoActual = new Date().getFullYear()

    // Detectar estado actual de la quincena (registros NO anulados)
    const { data: qInfo } = await supabase
      .schema(schema)
      .from('sicore_retenciones')
      .select('estado_quincena')
      .eq('quincena', params.quincena)
      .eq('anulado', false)
      .order('estado_quincena', { ascending: false }) // 'declarada' > 'cerrada' > 'abierta'
      .limit(1)
      .maybeSingle()
    const estadoQ = (qInfo?.estado_quincena as string | undefined) ?? null

    // Defensivo: si la quincena ya fue declarada, no insertar nada.
    if (estadoQ === 'declarada') {
      console.error('🔒 registrarEnSicoreRetenciones: quincena DECLARADA, insert bloqueado por seguridad', params.quincena)
      return
    }

    const nuevoEstadoQ = estadoQ === 'cerrada' ? 'cerrada' : 'abierta'

    // ── Guarda de IDEMPOTENCIA (A-BUG-146) ────────────────────────────────────────────────────
    //
    // 🐞 El 10/09/2026 la FC 10-6337 de ALCORTA quedó con **dos filas vigentes idénticas**, creadas
    // con **0,69 s de diferencia**: el botón «✅ Confirmar y pasar a Pagar» no tenía guarda de
    // re-entrada y un doble click corrió el flujo entero dos veces.
    //
    // 🧨 Y no era cosmético: `generarTXTCierreV2` agrupa **sumando fila por fila**, así que el TXT
    // le habría declarado a ARCA **$170.358,89 de pago y $140.792,49 de base de más**. La retención
    // salía bien — lo que quedaba mal era lo declarado.
    //
    // 🔑 **Va acá y no en el botón**: el botón es un llamador de varios (Cash Flow, Modal, y el que
    // venga). Taparlo allá arregla el caso que se vio y deja abiertos los otros — la lección de
    // A-BUG-142, donde la regla vivía en un solo camino de los dos.
    //
    // ⚠️ **Qué NO bloquea**: dos pagos parciales legítimos de la misma factura en la misma quincena.
    // Por eso la comparación incluye los **importes**: una fila con la misma factura, la misma
    // quincena, el mismo tipo **y los mismos números** no es un segundo pago, es la misma escritura
    // repetida. Un segundo pago real tiene otro `total_pagado`.
    const claveDoc = params.factura_id
      ? { col: 'factura_id', val: params.factura_id }
      : params.anticipo_id ? { col: 'anticipo_id', val: params.anticipo_id } : null

    if (claveDoc) {
      const { data: yaEsta } = await supabase
        .schema(schema)
        .from('sicore_retenciones')
        .select('id, nro_certificado')
        .eq(claveDoc.col, claveDoc.val)
        .eq('quincena', params.quincena)
        .eq('tipo_sicore', params.tipo_sicore)
        .eq('anulado', false)
        .eq('total_pagado', params.total_pagado)
        .eq('retencion', params.retencion)
        .limit(1)
        .maybeSingle()

      if (yaEsta?.id) {
        // No es un error del usuario ni algo que deba interrumpir: es la segunda mitad de un doble
        // click. Se loguea con el dato que hace falta para investigarlo y se sale sin escribir.
        console.warn(
          '🔁 sicore_retenciones: ya existe una fila idéntica para este comprobante, no se inserta de nuevo',
          { [claveDoc.col]: claveDoc.val, quincena: params.quincena, tipo: params.tipo_sicore,
            total_pagado: params.total_pagado, retencion: params.retencion, existente: yaEsta.id }
        )
        return
      }
    }

    // ── A-BUG-1222 — EL CERTIFICADO SE COMPARTE POR PAGO, NO POR QUINCENA ────────────────────
    //
    // 🐞 Encontrado por el usuario el 2026-09-29, con BIOFARMA:
    // > *«Hice un pago y el certificado que me genera contempla pago anterior dentro de la misma
    // > quincena. **La agrupación es cuando lo pago agrupado, no agrupar siempre. Si son 2 pagos son
    // > 2 retenciones.**»*
    //
    // 🧨 Acá estaba: este bloque reusaba el número para **cualquier** retención del mismo
    // `cuit + tipo + quincena`. Entonces un **segundo pago independiente** dentro de la misma
    // quincena heredaba el certificado del primero — y como el PDF y el TXT agrupan por
    // `nro_certificado` **sumando**, el certificado nuevo salía con la retención vieja adentro.
    //
    // 📌 **Los dos casos reales, medidos en la base:**
    // - **BIOFARMA** (26-09 2da, abierta): 21/09 $109.770,05 + 29/09 $69.213,15 → cert `…000065`
    //   informando **$178.983,20**, cuando el del 29/09 son $69.213,15.
    // - **LONGO** (26-08 2da, cerrada): 18/08 $102.874,10 + 31/08 $134.817,20 → cert `…000055`
    //   con **$237.691,30**.
    //
    // 🔑 **El discriminante es `fecha_pago`**, y es el que corresponde al criterio del usuario: lo
    // que comparte certificado es **un pago**. Varias facturas pagadas juntas el mismo día comparten
    // `fecha_pago` y siguen compartiendo certificado, que es justamente la agrupación que él quiere
    // conservar. Dos pagos en días distintos son dos retenciones y **dos certificados**.
    //
    // ⚠️ **Y no alcanzaba mirar `origen`**: la fila del 29/09 se guardó como `'agrupacion'` —era un
    // pago agrupado de verdad— así que por ese campo parecía correcta. Lo que estaba mal no era el
    // origen, era el alcance de la reutilización.
    const { data: mismoGrupo } = await supabase
      .schema(schema)
      .from('sicore_retenciones')
      .select('nro_comprobante, nro_certificado')
      .eq('cuit_emisor', params.cuit_emisor ?? '')
      .eq('tipo_sicore', params.tipo_sicore)
      .eq('quincena', params.quincena)
      // 👇 LA CORRECCIÓN: el mismo PAGO, no la misma quincena.
      .eq('fecha_pago', params.fecha_pago)
      .eq('anulado', false)
      .not('nro_comprobante', 'is', null)
      .limit(1)
      .maybeSingle()

    let nroComp: number
    let nroCert: string

    if (mismoGrupo?.nro_comprobante) {
      nroComp = mismoGrupo.nro_comprobante as number
      nroCert = mismoGrupo.nro_certificado as string
    } else {
      // Nuevo grupo — asignar siguiente número perpetuo (incluye anulados para preservar cronología)
      const { data: maxComp } = await supabase
        .schema(schema)
        .from('sicore_retenciones')
        .select('nro_comprobante')
        .not('nro_comprobante', 'is', null)
        .order('nro_comprobante', { ascending: false })
        .limit(1)
        .maybeSingle()
      nroComp = ((maxComp?.nro_comprobante as number | null) ?? 0) + 1

      const prefijoCert = `0000${anoActual}`
      const { data: maxCert } = await supabase
        .schema(schema)
        .from('sicore_retenciones')
        .select('nro_certificado')
        .like('nro_certificado', `${prefijoCert}%`)
        .order('nro_certificado', { ascending: false })
        .limit(1)
        .maybeSingle()
      const seqActual = maxCert?.nro_certificado
        ? parseInt((maxCert.nro_certificado as string).slice(-6), 10)
        : 0
      nroCert = `${prefijoCert}${String(seqActual + 1).padStart(6, '0')}`
    }

    const { error } = await supabase
      .schema(schema)
      .from('sicore_retenciones')
      .insert({
        ...params,
        nro_comprobante: nroComp,
        nro_certificado: nroCert,
        estado_quincena: nuevoEstadoQ,
      })
    if (error) console.error('⚠️ sicore_retenciones insert error (no interrumpe flujo):', error)
    else console.log('✅ sicore_retenciones registrado:', params.quincena, params.denominacion_emisor, `comp=${nroComp} cert=${nroCert} estado=${nuevoEstadoQ}`)
  } catch (err) {
    console.error('⚠️ sicore_retenciones excepción (no interrumpe flujo):', err)
  }
}
