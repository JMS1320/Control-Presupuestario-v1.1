"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

// Anticipo vinculable — los campos que necesita la lógica de vinculación.
// Cualquier registro de anticipos_proveedores con estos campos sirve.
//
// ⚠️ `anticipos_proveedores` guarda LAS DOS PUNTAS: la columna `tipo` distingue `pago` (a un
// proveedor, contra `comprobantes_arca`) de `cobro` (de un cliente, contra `comprobantes_venta`).
// El nombre de la tabla engaña. Hasta 2026-08-18 el wizard sólo buscaba facturas de compra, así
// que los anticipos de cobro se creaban y quedaban colgados en `pendiente_vincular` para siempre
// (el de BALLESTER "Venta 4 Vacas" llevaba 4 meses). Ver PENDIENTES § A-FEAT-26.
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
  nro_cuenta?: string | null
  /** `pago` (default) = compras · `cobro` = ventas. Decide contra qué facturas se vincula. */
  tipo?: 'pago' | 'cobro'
}

/** ¿Es un anticipo de cobro (ventas)? Todo lo que no lo sea se comporta como antes. */
const esCobro = (a: { tipo?: string | null } | null | undefined) => a?.tipo === 'cobro'

export interface FacturaCandidato {
  id: string
  denominacion_emisor: string
  cuit: string
  imp_total: number
  fecha_emision: string
  monto_a_abonar: number
  monto_sicore: number | null
  nro_cuenta?: string | null
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

/**
 * Facturas candidatas del CUIT dado.
 *
 * @param tipo `pago` (default) → facturas de COMPRA pendientes · `cobro` → facturas de VENTA
 *   pendientes de cobrar.
 *
 * En ventas, `monto_a_abonar` no es una columna: se calcula como
 * **imp_total − retenciones recibidas ya vinculadas − anticipos de cobro ya vinculados**.
 * Ése es el saldo real que falta que entre por banco, y es lo que hace que dos transferencias
 * contra una misma factura funcionen: la segunda ve el saldo que dejó la primera.
 */
export async function buscarFacturasCandidatas(
  cuit: string,
  tipo: 'pago' | 'cobro' = 'pago',
): Promise<FacturaCandidato[]> {
  if (tipo === 'cobro') return buscarFacturasVentaCandidatas(cuit)

  const { data } = await supabase
    .schema('msa')
    .from('comprobantes_arca')
    .select('id, denominacion_emisor, cuit, imp_total, fecha_emision, estado, monto_a_abonar, monto_sicore, nro_cuenta')
    .eq('cuit', cuit)
    // Excluir pagadas/conciliadas (sin saldo que reducir) y anteriores (históricas, no se muestran en ARCA)
    .not('estado', 'in', '("pagado","conciliado","anterior")')
    .order('fecha_emision', { ascending: false })
    .limit(10)
  return (data as FacturaCandidato[]) || []
}

async function buscarFacturasVentaCandidatas(cuit: string): Promise<FacturaCandidato[]> {
  const { data } = await supabase
    .schema('msa')
    .from('comprobantes_venta')
    .select('id, denominacion_cliente, cuit_cliente, imp_total, fecha_liquidacion, estado, nro_cuenta')
    .eq('cuit_cliente', cuit)
    .not('estado', 'in', '("cobrado","conciliado","anterior")')
    .order('fecha_liquidacion', { ascending: false })
    .limit(10)

  const facturas = (data as any[]) || []
  if (facturas.length === 0) return []
  const ids = facturas.map(f => f.id)

  // Lo ya imputado a cada factura: retenciones sufridas + anticipos de cobro vinculados.
  const [{ data: rets }, { data: ants }] = await Promise.all([
    supabase.schema('msa').from('retenciones_recibidas')
      .select('comprobante_venta_id, monto').in('comprobante_venta_id', ids),
    // Los cobros se imputan por `comprobante_venta_id`, NO por `factura_id`: esa última tiene
    // FK a `msa.comprobantes_arca` y guardar ahí una venta lo rechaza la base.
    supabase.from('anticipos_proveedores')
      .select('comprobante_venta_id, monto').in('comprobante_venta_id', ids),
  ])

  const imputado = new Map<string, number>()
  const sumar = (id: string | null, monto: any) => {
    if (!id) return
    imputado.set(id, (imputado.get(id) || 0) + (Number(monto) || 0))
  }
  ;(rets || []).forEach((r: any) => sumar(r.comprobante_venta_id, r.monto))
  ;(ants || []).forEach((a: any) => sumar(a.comprobante_venta_id, a.monto))

  return facturas.map(f => {
    const total = Number(f.imp_total) || 0
    const saldo = total - (imputado.get(f.id) || 0)
    return {
      id: f.id,
      // Se mapea al mismo shape que compras para no bifurcar el modal.
      denominacion_emisor: f.denominacion_cliente || '',
      cuit: f.cuit_cliente || '',
      imp_total: total,
      fecha_emision: f.fecha_liquidacion || '',
      monto_a_abonar: Math.max(0, saldo),
      // En ventas no hay SICORE propio de la factura: las retenciones sufridas ya están
      // descontadas arriba y viven en `retenciones_recibidas`.
      monto_sicore: null,
      nro_cuenta: f.nro_cuenta ?? null,
    }
  }).filter(f => f.monto_a_abonar > 0.01)
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
  const [pasoWizard, setPasoWizard] = useState<'seleccion' | 'confirmacion' | 'externo'>('seleccion')
  const [calculo, setCalculo] = useState<CalcVinculacion | null>(null)
  const [vinculando, setVinculando] = useState(false)
  const [extractoInfo, setExtractoInfo] = useState<{ tabla: string, fecha: string, monto: number, estado: string } | null>(null)
  const [motivoExterno, setMotivoExterno] = useState<string>('')
  // Conflicto de cuenta contable cuando FC y anticipo tienen cuentas distintas
  const [conflictoCuenta, setConflictoCuenta] = useState<{ fc: string, anticipo: string } | null>(null)
  const [cuentaPreferida, setCuentaPreferida] = useState<'fc' | 'anticipo'>('fc')

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

    // Detectar conflicto de cuenta contable
    const fcCuenta = fac.nro_cuenta || null
    const antCuenta = anticipoParaVincular.nro_cuenta || null
    if (fcCuenta && antCuenta && fcCuenta !== antCuenta) {
      setConflictoCuenta({ fc: fcCuenta, anticipo: antCuenta })
      setCuentaPreferida('fc') // default conservador: gana la cuenta ya asignada en la FC
    } else {
      setConflictoCuenta(null)
    }

    const sicore = anticipoParaVincular.monto_sicore || 0
    const descuento = anticipoParaVincular.descuento_aplicado || 0
    // ¿La factura ya tiene SICORE propio? Entonces su monto_a_abonar ya está neto de retención.
    const sicoreFactura = fac.monto_sicore || 0
    // En VENTAS se trabaja siempre sobre el saldo (`monto_a_abonar` ya viene neto de retenciones
    // sufridas y de los anticipos de cobro anteriores) — es la misma mecánica que una factura de
    // compra con SICORE propio, así que se reusa esa rama en vez de escribir una tercera.
    const facturaTieneSicorePropio = sicoreFactura > 0 || esCobro(anticipoParaVincular)

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

  /**
   * Vinculación de un anticipo de COBRO a una factura de venta.
   *
   * Más simple que compras, y a propósito:
   *  · No hay herencia de SICORE — en ventas las retenciones son *sufridas*, ya viven en
   *    `retenciones_recibidas` vinculadas a la factura, y `monto_a_abonar` ya llega neto de ellas.
   *  · `comprobantes_venta` no tiene columna de saldo: el saldo se **recalcula** cada vez desde
   *    imp_total − retenciones − anticipos vinculados. Por eso N cobros sobre una misma factura
   *    funcionan sin guardar nada intermedio.
   *  · En el extracto el vínculo es `comprobante_venta_id`.
   */
  const confirmarVinculacionCobro = async (fac: FacturaCandidato) => {
    if (!anticipoParaVincular || !calculo) return
    const cubierta = calculo.caso === 'A'

    // 1) La factura: sólo cambia de estado cuando queda saldada.
    const updateFac: Record<string, any> = {}
    if (cubierta) {
      updateFac.estado = extractoInfo?.estado === 'conciliado' ? 'conciliado' : 'cobrado'
    }
    // Si la factura no tiene cuenta contable y el anticipo sí, la hereda.
    if (!fac.nro_cuenta && anticipoParaVincular.nro_cuenta) {
      updateFac.nro_cuenta = anticipoParaVincular.nro_cuenta
    }
    if (Object.keys(updateFac).length > 0) {
      const { error } = await supabase
        .schema('msa').from('comprobantes_venta')
        .update(updateFac).eq('id', fac.id)
      if (error) throw error
    }

    // 2) El anticipo queda imputado. `parcial` = entró pero la factura sigue con saldo.
    //    Va en `comprobante_venta_id`, columna propia: `factura_id` tiene FK a
    //    `msa.comprobantes_arca` y escribir ahí un id de venta lo rechaza la base.
    const { error: errAnt } = await supabase
      .from('anticipos_proveedores')
      .update({ comprobante_venta_id: fac.id, estado: cubierta ? 'vinculado' : 'parcial' })
      .eq('id', anticipoParaVincular.id)
    if (errAnt) throw errAnt

    // 3) El movimiento del extracto, si se encuentra: es un CRÉDITO (entró plata).
    let extractoActualizado = false
    for (const { tabla, schema } of TABLAS_BANCARIAS) {
      const client = schema ? supabase.schema(schema) : supabase

      let { data: movs } = await client
        .from(tabla).select('id, creditos, estado')
        .eq('anticipo_id', anticipoParaVincular.id).limit(1)

      if (!movs || movs.length === 0) {
        const { data: porCuit } = await client
          .from(tabla).select('id, creditos, estado, leyendas_adicionales_2')
          .eq('fecha', anticipoParaVincular.fecha_pago)
          .eq('leyendas_adicionales_2', anticipoParaVincular.cuit_proveedor)
          .limit(10)
        const match = (porCuit || []).find((m: any) =>
          Math.abs((parseFloat(m.creditos) || 0) - anticipoParaVincular.monto) < Math.max(1, anticipoParaVincular.monto * 0.03))
        if (match) movs = [match]
      }

      if (movs && movs.length > 0) {
        await client.from(tabla).update({
          comprobante_venta_id: fac.id,
          anticipo_id: anticipoParaVincular.id,
          estado: 'conciliado',
          motivo_revision: null,
        }).eq('id', movs[0].id)
        extractoActualizado = true
        break
      }
    }

    const msgExtracto = extractoActualizado
      ? ' Extracto actualizado.'
      : ' (no se encontró el movimiento en el extracto — se vincula igual)'
    toast.success(cubierta
      ? `Cobro vinculado. Factura saldada por ${fmt(anticipoParaVincular.monto)}.${msgExtracto}`
      : `Cobro parcial vinculado. Saldo a cobrar: ${fmt(calculo.saldo)}.${msgExtracto}`)

    setModalVinculacion(false)
    setAnticipoParaVincular(null)
    await onVinculado?.()
  }

  // Confirmar vinculación definitiva
  const confirmarVinculacion = async () => {
    if (!anticipoParaVincular || !facturaElegida || !calculo) return
    setVinculando(true)
    try {
      const fac = candidatosActivos.find(f => f.id === facturaElegida)
      if (!fac) throw new Error('Factura no encontrada')

      // ── VENTAS ────────────────────────────────────────────────────────────────
      // Camino propio y corto: una factura de venta no hereda SICORE (las retenciones sufridas
      // ya están cargadas aparte y vinculadas), no tiene `monto_a_abonar` donde guardar el saldo
      // —se recalcula— y en el extracto el vínculo es `comprobante_venta_id`.
      if (esCobro(anticipoParaVincular)) {
        await confirmarVinculacionCobro(fac)
        return
      }

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

      // Herencia de cuenta contable (nro_cuenta) — bidireccional
      // Reglas:
      //   FC sin cuenta + anticipo con cuenta → FC hereda del anticipo
      //   FC con cuenta + anticipo sin cuenta → anticipo hereda hacia atrás (por si se concilia después)
      //   ambos con cuenta y difieren → usuario eligió en el modal (cuentaPreferida)
      const fcCuenta = fac.nro_cuenta || null
      const antCuenta = anticipoParaVincular.nro_cuenta || null
      let cuentaFinal: string | null = null
      if (fcCuenta && antCuenta) {
        cuentaFinal = cuentaPreferida === 'anticipo' ? antCuenta : fcCuenta
      } else {
        cuentaFinal = fcCuenta || antCuenta
      }
      // Si la FC no tiene la cuenta final → setearla
      const fcDebeActualizarCuenta = cuentaFinal && fcCuenta !== cuentaFinal
      if (fcDebeActualizarCuenta) {
        herenciaComun.nro_cuenta = cuentaFinal
      }
      // Si el anticipo no tiene la cuenta final → setearla (herencia hacia atrás)
      const anticipoDebeActualizarCuenta = cuentaFinal && antCuenta !== cuentaFinal

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
      const updateAnticipo: Record<string, any> = {
        factura_id: facturaElegida,
        estado: calculo.caso === 'A' ? 'vinculado' : 'parcial',
      }
      if (anticipoDebeActualizarCuenta) updateAnticipo.nro_cuenta = cuentaFinal
      const { error: errAnticipo } = await supabase
        .from('anticipos_proveedores')
        .update(updateAnticipo)
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
    setMotivoExterno('')
    setConflictoCuenta(null)
    setCuentaPreferida('fc')
  }

  // Modo externo: el anticipo se vinculó a una FC que no está en la app
  const iniciarMarcaExterno = () => {
    setMotivoExterno('')
    setPasoWizard('externo')
  }

  const volverDeExterno = () => {
    setMotivoExterno('')
    setPasoWizard('seleccion')
  }

  const confirmarMarcaExterno = async () => {
    if (!anticipoParaVincular) return
    const motivo = motivoExterno.trim()
    if (!motivo) {
      toast.error('La explicación es obligatoria para marcar como externo')
      return
    }
    setVinculando(true)
    try {
      // Guardamos la explicación en `descripcion` (sin sumar columnas).
      // Si el anticipo ya tenía descripcion, la concatenamos para no perder el dato original.
      const descActual = (anticipoParaVincular.descripcion || '').trim()
      const descNueva = descActual ? `${descActual}\n${motivo}` : motivo

      const { error } = await supabase
        .from('anticipos_proveedores')
        .update({
          estado: 'externo',
          descripcion: descNueva,
        })
        .eq('id', anticipoParaVincular.id)
      if (error) throw error

      toast.success('Anticipo marcado como vinculado externamente')
      setModalVinculacion(false)
      setAnticipoParaVincular(null)
      setMotivoExterno('')
      setPasoWizard('seleccion')
      await onVinculado?.()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    } finally {
      setVinculando(false)
    }
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
    motivoExterno,
    conflictoCuenta,
    cuentaPreferida,
    // acciones
    abrirVinculacion,
    onSeleccionarFactura,
    avanzarAConfirmacion,
    volverASeleccion,
    confirmarVinculacion,
    cerrarModal,
    iniciarMarcaExterno,
    volverDeExterno,
    confirmarMarcaExterno,
    setMotivoExterno,
    setCuentaPreferida,
  }
}

export type VinculacionController = ReturnType<typeof useVinculacionAnticipo>
