// Capa compartida (UI-agnóstica): registro de retención SICORE v2.
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
 *   del mismo cuit+tipo+quincena; sino asigna el siguiente número perpetuo.
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

    // Reutilizar números si ya hay otro registro no anulado del mismo grupo (cuit+tipo+quincena)
    const { data: mismoGrupo } = await supabase
      .schema(schema)
      .from('sicore_retenciones')
      .select('nro_comprobante, nro_certificado')
      .eq('cuit_emisor', params.cuit_emisor ?? '')
      .eq('tipo_sicore', params.tipo_sicore)
      .eq('quincena', params.quincena)
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
