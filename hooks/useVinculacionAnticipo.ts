"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

// Anticipo vinculable — los campos que necesita la lógica de vinculación.
// Cualquier registro de anticipos_proveedores con estos campos sirve.
export interface AnticipoVinculable {
  id: string
  nombre_proveedor: string
  cuit_proveedor: string
  monto: number
  monto_sicore: number | null
  descuento_aplicado: number | null
  sicore: string | null
  tipo_sicore: string | null
  fecha_pago: string
  factura_id: string | null
  descripcion: string | null
}

export interface FacturaCandidato {
  id: string
  denominacion_emisor: string
  cuit: string
  imp_total: number
  fecha_emision: string
  monto_a_abonar: number
  monto_sicore: number | null
}

export interface CalcVinculacion {
  caso: 'A' | 'B'
  saldo: number
  neto_pagado: number
  descuento: number
  sicore: number          // SICORE que aporta el anticipo (flujo clásico)
  sicoreFactura: number   // SICORE propio de la factura, si ya lo tiene (se preserva)
}

const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

// Busca facturas ARCA pendientes (no pagadas/conciliadas) del CUIT dado.
// Reutilizable desde Vista Principal y Cash Flow.
export async function buscarFacturasCandidatas(cuit: string): Promise<FacturaCandidato[]> {
  const { data } = await supabase
    .schema('msa')
    .from('comprobantes_arca')
    .select('id, denominacion_emisor, cuit, imp_total, fecha_emision, estado, monto_a_abonar, monto_sicore')
    .eq('cuit', cuit)
    .not('estado', 'in', '("pagado","conciliado")')
    .order('fecha_emision', { ascending: false })
    .limit(10)
  return (data as FacturaCandidato[]) || []
}

const TABLAS_BANCARIAS: { tabla: string, schema?: string }[] = [
  { tabla: 'msa_galicia' },
  { tabla: 'pam_galicia' },
  { tabla: 'pam_galicia_cc' },
  { tabla: 'ma_galicia', schema: 'ma' },
]

/**
 * Hook que encapsula el wizard de vinculación de un anticipo a una factura.
 * Lógica única compartida entre Vista Principal y Cash Flow.
 *
 * @param onVinculado callback que se ejecuta al vincular con éxito (refrescar datos).
 */
export function useVinculacionAnticipo(onVinculado?: () => void | Promise<void>) {
  const [modalVinculacion, setModalVinculacion] = useState(false)
  const [anticipoParaVincular, setAnticipoParaVincular] = useState<AnticipoVinculable | null>(null)
  const [candidatosActivos, setCandidatosActivos] = useState<FacturaCandidato[]>([])
  const [facturaElegida, setFacturaElegida] = useState<string>('')
  const [pasoWizard, setPasoWizard] = useState<'seleccion' | 'confirmacion'>('seleccion')
  const [calculo, setCalculo] = useState<CalcVinculacion | null>(null)
  const [vinculando, setVinculando] = useState(false)
  const [extractoInfo, setExtractoInfo] = useState<{ tabla: string, fecha: string, monto: number, estado: string } | null>(null)

  const abrirVinculacion = async (anticipo: AnticipoVinculable, candidatos: FacturaCandidato[]) => {
    setAnticipoParaVincular(anticipo)
    setCandidatosActivos(candidatos)
    setFacturaElegida('')
    setCalculo(null)
    setExtractoInfo(null)
    setPasoWizard('seleccion')
    setModalVinculacion(true)

    // Buscar si este anticipo ya tiene movimiento en extracto (por anticipo_id o por categ/detalle/monto)
    const netoAnticipo = anticipo.monto - (anticipo.monto_sicore || 0) - (anticipo.descuento_aplicado || 0)

    for (const { tabla, schema } of TABLAS_BANCARIAS) {
      const client = schema ? supabase.schema(schema) : supabase
      // Primero por anticipo_id (si el motor ya lo guardó)
      let { data: movs } = await client
        .from(tabla)
        .select('id, fecha, debitos, creditos, estado')
        .eq('anticipo_id', anticipo.id)
        .limit(1)

      // Si no hay match por anticipo_id, buscar por CUIT en leyendas_adicionales_2 + monto
      if (!movs || movs.length === 0) {
        // Estrategia 1: CUIT del proveedor en leyendas_adicionales_2 (más confiable)
        const { data: movsCuit } = await client
          .from(tabla)
          .select('id, fecha, debitos, creditos, estado, categ, detalle, leyendas_adicionales_2')
          .eq('fecha', anticipo.fecha_pago)
          .eq('leyendas_adicionales_2', anticipo.cuit_proveedor)
          .limit(10)

        // Estrategia 2: categ ANTICIPO o detalle con ANTICIPO (fallback)
        const { data: movsCateg } = await client
          .from(tabla)
          .select('id, fecha, debitos, creditos, estado, categ, detalle')
          .eq('fecha', anticipo.fecha_pago)
          .eq('categ', 'ANTICIPO')
          .limit(10)

        // Combinar y deduplicar
        const todosMovs = [...(movsCuit || []), ...(movsCateg || [])]
        const unicos = todosMovs.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)

        if (unicos.length > 0) {
          // Buscar match por monto: bruto, neto (sin SICORE), o tolerancia 3%
          const match = unicos.find((m: any) => {
            const montoMov = parseFloat(m.debitos) || parseFloat(m.creditos) || 0
            const diffBruto = Math.abs(montoMov - anticipo.monto)
            const diffNeto = Math.abs(montoMov - netoAnticipo)
            return diffBruto < anticipo.monto * 0.03 || diffNeto < netoAnticipo * 0.01 || diffBruto < 1 || diffNeto < 1
          })
          if (match) movs = [match]
        }
      }

      if (movs && movs.length > 0) {
        const m = movs[0]
        setExtractoInfo({
          tabla,
          fecha: m.fecha,
          monto: parseFloat(m.debitos) || parseFloat(m.creditos) || 0,
          estado: m.estado
        })
        break
      }
    }
  }

  // Calcular cuando se selecciona una factura
  const onSeleccionarFactura = (facturaId: string) => {
    setFacturaElegida(facturaId)
    if (!anticipoParaVincular) return
    const fac = candidatosActivos.find(f => f.id === facturaId)
    if (!fac) return

    const sicore = anticipoParaVincular.monto_sicore || 0
    const descuento = anticipoParaVincular.descuento_aplicado || 0
    // ¿La factura ya tiene SICORE propio? Entonces su monto_a_abonar ya está neto de retención.
    const sicoreFactura = fac.monto_sicore || 0
    const facturaTieneSicorePropio = sicoreFactura > 0

    let cubierto: boolean
    let saldo: number
    if (facturaTieneSicorePropio) {
      // SICORE en la FACTURA: trabajar sobre el neto a pagar actual (su SICORE no se toca)
      const montoAPagar = fac.monto_a_abonar
      cubierto = anticipoParaVincular.monto >= montoAPagar - 0.01
      saldo = cubierto ? 0 : montoAPagar - anticipoParaVincular.monto - descuento
    } else {
      // SICORE en el ANTICIPO (flujo clásico): la factura hereda el SICORE del anticipo
      // Caso A: anticipo >= imp_total → FC cubierta; Caso B: saldo = imp_total - anticipo - sicore - descuento
      cubierto = anticipoParaVincular.monto >= fac.imp_total - 0.01
      saldo = cubierto ? 0 : fac.imp_total - anticipoParaVincular.monto - sicore - descuento
    }
    const neto_pagado = anticipoParaVincular.monto - sicore - descuento

    setCalculo({
      caso: cubierto ? 'A' : 'B',
      saldo: Math.max(0, saldo),
      neto_pagado,
      descuento,
      sicore,
      sicoreFactura,
    })
  }

  // Paso 1 → Paso 2
  const avanzarAConfirmacion = () => {
    if (!facturaElegida || !calculo) return
    setPasoWizard('confirmacion')
  }

  // Paso 2 → Paso 1 (botón Atrás)
  const volverASeleccion = () => setPasoWizard('seleccion')

  // Confirmar vinculación definitiva
  const confirmarVinculacion = async () => {
    if (!anticipoParaVincular || !facturaElegida || !calculo) return
    setVinculando(true)
    try {
      const fac = candidatosActivos.find(f => f.id === facturaElegida)
      if (!fac) throw new Error('Factura no encontrada')

      // Datos comunes que la FC hereda del anticipo.
      // Si la factura YA tiene SICORE propio, NO se pisa con el del anticipo (se preserva).
      const facturaTieneSicorePropio = (fac.monto_sicore || 0) > 0
      const herenciaComun: Record<string, any> = {}
      if (!facturaTieneSicorePropio) {
        herenciaComun.sicore = anticipoParaVincular.sicore
        herenciaComun.monto_sicore = anticipoParaVincular.monto_sicore
        herenciaComun.tipo_sicore = anticipoParaVincular.tipo_sicore
      }
      // Heredar descripcion del anticipo a la FC (si tiene)
      if (anticipoParaVincular.descripcion) {
        herenciaComun.detalle = anticipoParaVincular.descripcion
      }

      if (calculo.caso === 'A') {
        // Factura completamente cubierta
        // Si el extracto ya está conciliado → FC = conciliado (pago ya pasó por banco)
        // Si no → FC = pagado
        const estadoFC = extractoInfo?.estado === 'conciliado' ? 'conciliado' : 'pagado'
        const { error: errFac } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({
            ...herenciaComun,
            estado: estadoFC,
            monto_a_abonar: calculo.neto_pagado,
            fecha_vencimiento: anticipoParaVincular.fecha_pago,
            fecha_estimada: anticipoParaVincular.fecha_pago,
          })
          .eq('id', facturaElegida)
        if (errFac) throw errFac
      } else {
        // Caso B: saldo pendiente — FC mantiene su estado, anticipo queda parcial
        const { error: errFac } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({
            ...herenciaComun,
            monto_a_abonar: calculo.saldo,
          })
          .eq('id', facturaElegida)
        if (errFac) throw errFac
      }

      // Vincular anticipo: Caso A → vinculado (desaparece), Caso B → parcial (permanece)
      const { error: errAnticipo } = await supabase
        .from('anticipos_proveedores')
        .update({
          factura_id: facturaElegida,
          estado: calculo.caso === 'A' ? 'vinculado' : 'parcial',
        })
        .eq('id', anticipoParaVincular.id)
      if (errAnticipo) throw errAnticipo

      // Transferir sicore_retenciones: agregar factura_id al registro del anticipo
      if (anticipoParaVincular.sicore || anticipoParaVincular.monto_sicore) {
        await supabase
          .schema('msa')
          .from('sicore_retenciones')
          .update({ factura_id: facturaElegida })
          .eq('anticipo_id', anticipoParaVincular.id)
          .is('factura_id', null)
      }

      // Propagar datos de FC al extracto bancario (si el anticipo ya estaba conciliado)
      // Buscar movimiento en extracto: por anticipo_id, o fallback por categ/detalle ANTICIPO + monto
      let extractoActualizado = false
      const { data: fcCompleta } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('id, nro_cuenta, denominacion_emisor')
        .eq('id', facturaElegida)
        .single()

      // Obtener categ de cuentas_contables vía nro_cuenta de la FC
      let categFC: string | null = null
      if (fcCompleta?.nro_cuenta) {
        const { data: cta } = await supabase
          .from('cuentas_contables')
          .select('categ')
          .eq('nro_cuenta', fcCompleta.nro_cuenta)
          .single()
        categFC = cta?.categ || null
      }

      if (fcCompleta) {
        const netoAnt = anticipoParaVincular.monto - (anticipoParaVincular.monto_sicore || 0) - (anticipoParaVincular.descuento_aplicado || 0)
        for (const { tabla, schema } of TABLAS_BANCARIAS) {
          const client = schema ? supabase.schema(schema) : supabase

          // Primero por anticipo_id
          let { data: movExtracto } = await client
            .from(tabla)
            .select('id, estado')
            .eq('anticipo_id', anticipoParaVincular.id)
            .limit(1)

          // Fallback: CUIT en leyendas_adicionales_2 + categ ANTICIPO
          if (!movExtracto || movExtracto.length === 0) {
            // Estrategia 1: CUIT del proveedor
            const { data: movsCuit } = await client
              .from(tabla)
              .select('id, estado, debitos, creditos, categ, detalle, leyendas_adicionales_2')
              .eq('fecha', anticipoParaVincular.fecha_pago)
              .eq('leyendas_adicionales_2', anticipoParaVincular.cuit_proveedor)
              .limit(10)

            // Estrategia 2: categ ANTICIPO
            const { data: movsCateg } = await client
              .from(tabla)
              .select('id, estado, debitos, creditos, categ, detalle')
              .eq('fecha', anticipoParaVincular.fecha_pago)
              .eq('categ', 'ANTICIPO')
              .limit(10)

            const todosMovs = [...(movsCuit || []), ...(movsCateg || [])]
            const unicos = todosMovs.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)

            const match = unicos.find((m: any) => {
              const montoMov = parseFloat(m.debitos) || parseFloat(m.creditos) || 0
              const diffBruto = Math.abs(montoMov - anticipoParaVincular.monto)
              const diffNeto = Math.abs(montoMov - netoAnt)
              return diffBruto < anticipoParaVincular.monto * 0.03 || diffNeto < netoAnt * 0.01 || diffBruto < 1 || diffNeto < 1
            })
            if (match) movExtracto = [match]
          }

          if (movExtracto && movExtracto.length > 0) {
            const mov = movExtracto[0]
            const detalleExtracto = calculo.caso === 'A'
              ? `Pago total vía anticipo: ${anticipoParaVincular.descripcion || anticipoParaVincular.nombre_proveedor}`
              : `Pago parcial vía anticipo: ${anticipoParaVincular.descripcion || anticipoParaVincular.nombre_proveedor}`

            // Guardar anticipo_id en extracto para trazabilidad
            await client
              .from(tabla)
              .update({
                comprobante_arca_id: fcCompleta.id,
                anticipo_id: anticipoParaVincular.id,
                categ: categFC,
                nro_cuenta: fcCompleta.nro_cuenta,
                detalle: detalleExtracto,
                estado: 'conciliado',
                motivo_revision: null,
              })
              .eq('id', mov.id)

            extractoActualizado = true
            break
          }
        }
      }

      const msgExtracto = extractoActualizado ? ' Extracto bancario actualizado.' : ''
      const estadoFinal = extractoInfo?.estado === 'conciliado' ? 'conciliada' : 'pagada'
      const msg = calculo.caso === 'A'
        ? `Vinculación completa. Factura marcada como ${estadoFinal} (${fmt(calculo.neto_pagado)} neto).${msgExtracto}`
        : `Vinculación parcial. Saldo pendiente: ${fmt(calculo.saldo)}.${msgExtracto}`
      toast.success(msg)
      setModalVinculacion(false)
      setAnticipoParaVincular(null)
      await onVinculado?.()
    } catch (err) {
      toast.error('Error al vincular: ' + (err as Error).message)
    } finally {
      setVinculando(false)
    }
  }

  const cerrarModal = () => {
    setModalVinculacion(false)
    setAnticipoParaVincular(null)
    setFacturaElegida('')
    setCalculo(null)
    setPasoWizard('seleccion')
  }

  return {
    // estado
    modalVinculacion,
    anticipoParaVincular,
    candidatosActivos,
    facturaElegida,
    pasoWizard,
    calculo,
    vinculando,
    extractoInfo,
    // acciones
    abrirVinculacion,
    onSeleccionarFactura,
    avanzarAConfirmacion,
    volverASeleccion,
    confirmarVinculacion,
    cerrarModal,
  }
}

export type VinculacionController = ReturnType<typeof useVinculacionAnticipo>
