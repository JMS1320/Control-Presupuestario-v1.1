/**
 * Capa compartida (UI-agnóstica): registro de retención SICORE v2.
 *
 * 🔑 **La regla que ordena la numeración** (corregida 2026-09-29, A-BUG-1222):
 * **un certificado = un PAGO**, y lo que define el pago es **la transferencia**, no el día. Varias
 * facturas pagadas en un mismo grupo comparten certificado; dos pagos distintos —aunque caigan el
 * mismo día, del mismo proveedor y del mismo régimen— son **dos** certificados. La regla vive en
 * `lib/sicore/clave-certificado.ts` y acá se aplica al asignar el número.
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
  /**
   * 🔑 **De qué PAGO salió.** `null` = pago directo (no agrupado).
   *
   * Es lo que define qué retenciones comparten CERTIFICADO: un certificado = un pago
   * (A-BUG-1222). Sin esto, lo más fino disponible era la fecha, y dos pagos directos al mismo
   * proveedor el mismo día compartían certificado — que es justo lo que no debe pasar.
   */
  grupo_pago_id?: string | null
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
 * - Reutiliza nro_comprobante/nro_certificado **sólo dentro del mismo GRUPO DE PAGO**
 *   (cuit+tipo+quincena+grupo_pago_id). Un pago **directo** siempre estrena número.
 *   Ver A-BUG-1222: antes se reusaba por quincena y un segundo pago heredaba el
 *   certificado del primero, así que el PDF salía con las dos retenciones.
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

    // ── A-BUG-1222 — UN CERTIFICADO = UN PAGO ────────────────────────────────────────────────
    //
    // 🐞 Encontrado por el usuario el 2026-09-29 con BIOFARMA:
    // > *«Hice un pago y el certificado que me genera contempla pago anterior dentro de la misma
    // > quincena. **La agrupación es cuando lo pago agrupado, no agrupar siempre.**»*
    //
    // Y precisado por él el mismo día, después de un primer arreglo mío que usaba la fecha:
    // > *«El certificado debe ser por pago y no por día. **Lo que lo agrupa es la transferencia.**»*
    //
    // 🧨 **Lo que estaba mal**: el número se reusaba para cualquier retención del mismo
    // `cuit + tipo + quincena`, así que un **segundo pago** de la quincena heredaba el certificado
    // del primero — y el PDF, la descarga y el TXT agrupan por ese número **sumando**. Casos reales:
    // BIOFARMA `…000065` informando $178.983,20 donde iban $69.213,15, y LONGO `…000055` con
    // $237.691,30.
    //
    // 🔑 **La regla, ahora que existe `grupo_pago_id`:**
    // - **Pago agrupado** → se reusa el número del mismo grupo. Es la agrupación que el usuario
    //   quiere conservar: varias facturas en una transferencia, un solo certificado.
    // - **Pago directo** → **número nuevo siempre**. Dos directos del mismo día son dos pagos.
    const { data: mismoGrupo } = params.grupo_pago_id
      ? await supabase
          .schema(schema)
          .from('sicore_retenciones')
          .select('nro_comprobante, nro_certificado')
          .eq('cuit_emisor', params.cuit_emisor ?? '')
          .eq('tipo_sicore', params.tipo_sicore)
          .eq('quincena', params.quincena)
          .eq('grupo_pago_id', params.grupo_pago_id)
          .eq('anulado', false)
          .not('nro_comprobante', 'is', null)
          .limit(1)
          .maybeSingle()
      // Pago directo: no hay con quién compartir. Se pide número nuevo.
      : { data: null }

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
