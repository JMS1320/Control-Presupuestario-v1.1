"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

// Extrae el prefijo común (a nivel de palabras) de un array de strings
const extraerPrefijoComun = (nombres: string[]): string => {
  if (nombres.length === 0) return ''
  const palabras = nombres.map(n => n.split(' '))
  const prefijo: string[] = []
  for (let i = 0; i < palabras[0].length; i++) {
    const palabra = palabras[0][i]
    if (palabras.every(p => p[i] === palabra)) {
      prefijo.push(palabra)
    } else {
      break
    }
  }
  return prefijo.join(' ')
}

// Interface unificada para Cash Flow (10 columnas finales)
export interface CashFlowRow {
  id: string
  origen: 'ARCA' | 'TEMPLATE' | 'ANTICIPO' | 'SUELDO'
  origen_tabla: string // Para identificar tabla específica al editar
  egreso_id?: string // Para templates: ID del egreso padre
  fecha_estimada: string
  fecha_vencimiento: string | null
  categ: string
  centro_costo: string
  cuit_proveedor: string
  nombre_proveedor: string
  detalle: string
  debitos: number
  creditos: number
  saldo_cta_cte: number // Calculado
  estado: string // Para tracking de cambios
  // Cuenta contable (solo para filas ARCA)
  nro_cuenta?: string | null
  // Campos SICORE (solo para filas ARCA)
  sicore?: string | null
  imp_neto_gravado?: number
  imp_neto_no_gravado?: number
  imp_op_exentas?: number
  imp_total?: number
  // Moneda (solo para filas ARCA)
  moneda?: string | null        // 'ARS' o 'USD' (null = ARS)
  tipo_cambio?: number          // TC original ARCA (1.0 para ARS)
  tc_pago?: number | null       // TC al momento del pago (editable, nullable)
  // Agrupación de pagos
  grupo_pago_id?: string | null
  facturas_agrupadas?: number   // > 1 indica fila de grupo
  ids_grupo?: string[]          // IDs de las facturas individuales del grupo
  // Medio de pago
  medio_pago?: string           // 'banco' | 'caja_general' | 'caja_ams' | 'caja_sigot'
}

// Filtros para Cash Flow
export interface CashFlowFilters {
  fechaDesde?: string
  fechaHasta?: string
  responsables?: string[]
  estados?: string[]
  origenes?: ('ARCA' | 'TEMPLATE' | 'ANTICIPO' | 'SUELDO')[]
  empresas?: ('MSA' | 'PAM')[]
  busquedaDetalle?: string
  busquedaCateg?: string
  busquedaCUIT?: string
  medioPago?: string  // 'todos' | 'banco' | 'caja_general' | 'caja_ams' | 'caja_sigot'
}

export function useMultiCashFlowData(filtros?: CashFlowFilters) {
  const [data, setData] = useState<CashFlowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Función para calcular fecha estimada (fecha_emision + 7 días)
  const calcularFechaEstimada = (fechaEmision: string): string => {
    const fecha = new Date(fechaEmision)
    fecha.setDate(fecha.getDate() + 7)
    return fecha.toISOString().split('T')[0]
  }

  // Mapear facturas ARCA a formato Cash Flow (con agrupación)
  const mapearFacturasArca = (facturas: any[]): CashFlowRow[] => {
    // Separar facturas agrupadas de las individuales
    const individuales = facturas.filter(f => !f.grupo_pago_id)
    const agrupadas    = facturas.filter(f =>  f.grupo_pago_id)

    // Filas individuales — igual que siempre
    const filasIndividuales: CashFlowRow[] = individuales.map(f => {
      const tc = f.tc_pago ?? f.tipo_cambio ?? 1
      const montoBase = f.monto_a_abonar ?? f.imp_total ?? 0
      // ECHEQ: usar fecha_cobro_echeq para Cash Flow (cuando el cheque se deposita)
      const fechaCF = (f.metodo_pago === 'echeq' && f.fecha_cobro_echeq)
        ? f.fecha_cobro_echeq
        : (f.fecha_estimada || calcularFechaEstimada(f.fecha_emision))
      return {
        id: f.id,
        origen: 'ARCA' as const,
        origen_tabla: 'msa.comprobantes_arca',
        fecha_estimada: fechaCF,
        fecha_vencimiento: f.fecha_vencimiento,
        categ: f.cuenta_contable || 'SIN_CATEG',
        centro_costo: f.centro_costo || 'SIN_CC',
        cuit_proveedor: f.cuit || '',
        nombre_proveedor: f.denominacion_emisor || '',
        detalle: f.detalle || `Factura ${f.tipo_comprobante}-${f.numero_desde}`,
        debitos: montoBase * tc,
        creditos: 0,
        saldo_cta_cte: 0,
        estado: f.estado || 'pendiente',
        medio_pago: f.medio_pago || 'banco',
        nro_cuenta: f.nro_cuenta || null,
        sicore: f.sicore || null,
        imp_neto_gravado: f.imp_neto_gravado || 0,
        imp_neto_no_gravado: f.imp_neto_no_gravado || 0,
        imp_op_exentas: f.imp_op_exentas || 0,
        imp_total: f.imp_total || 0,
        moneda: f.moneda || null,
        tipo_cambio: f.tipo_cambio ?? 1,
        tc_pago: f.tc_pago ?? null,
        grupo_pago_id: null,
      }
    })

    // Filas agrupadas — una fila por grupo
    const porGrupo = new Map<string, any[]>()
    agrupadas.forEach(f => {
      const g = f.grupo_pago_id as string
      if (!porGrupo.has(g)) porGrupo.set(g, [])
      porGrupo.get(g)!.push(f)
    })

    const filasGrupo: CashFlowRow[] = Array.from(porGrupo.entries()).map(([grupoId, fs]) => {
      // Fecha más tardía del grupo
      const fechaMax = fs
        .map(f => f.fecha_estimada || calcularFechaEstimada(f.fecha_emision))
        .sort()
        .at(-1) ?? ''
      const fechaVencMax = fs.map(f => f.fecha_vencimiento).filter(Boolean).sort().at(-1) ?? null
      const totalDebitos = fs.reduce((s, f) => {
        const tc = f.tc_pago ?? f.tipo_cambio ?? 1
        return s + (f.monto_a_abonar ?? f.imp_total ?? 0) * tc
      }, 0)
      // Detalle: lista de los detalles individuales separados por " · "
      const detallesCombinados = fs
        .map(f => f.detalle || `Factura ${f.tipo_comprobante}-${f.numero_desde}`)
        .join(' · ')
      const primera = fs[0]

      return {
        id: grupoId,                         // ID del grupo (para conciliación)
        origen: 'ARCA' as const,
        origen_tabla: 'msa.grupos_pago',
        fecha_estimada: fechaMax,
        fecha_vencimiento: fechaVencMax,
        categ: primera.cuenta_contable || 'SIN_CATEG',
        centro_costo: primera.centro_costo || 'SIN_CC',
        cuit_proveedor: primera.cuit || '',
        nombre_proveedor: primera.denominacion_emisor || '',
        detalle: detallesCombinados,
        debitos: totalDebitos,
        creditos: 0,
        saldo_cta_cte: 0,
        estado: 'pagar',
        sicore: null,
        imp_neto_gravado: 0,
        imp_neto_no_gravado: 0,
        imp_op_exentas: 0,
        imp_total: fs.reduce((s, f) => s + (f.imp_total || 0), 0),
        grupo_pago_id: grupoId,
        facturas_agrupadas: fs.length,
        ids_grupo: fs.map(f => f.id),
      }
    })

    return [...filasIndividuales, ...filasGrupo]
  }

  // Mapear templates egresos a formato Cash Flow (con agrupación)
  const mapearTemplatesEgresos = (cuotas: any[]): CashFlowRow[] => {
    // Separar cuotas agrupadas de las individuales
    const individuales = cuotas.filter(c => !c.grupo_pago_id)
    const agrupadas    = cuotas.filter(c =>  c.grupo_pago_id)

    // Filas individuales
    const filasIndividuales: CashFlowRow[] = individuales.map(c => {
      const esIngreso = c.tipo_movimiento === 'ingreso'
      const monto = c.monto || 0
      return {
        id: c.id,
        origen: 'TEMPLATE' as const,
        origen_tabla: 'cuotas_egresos_sin_factura',
        egreso_id: c.egreso_id,
        fecha_estimada: c.fecha_estimada,
        fecha_vencimiento: c.fecha_vencimiento,
        categ: c.egreso?.categ || 'SIN_CATEG',
        centro_costo: c.egreso?.centro_costo || 'SIN_CC',
        cuit_proveedor: c.egreso?.cuit_quien_cobra || '',
        nombre_proveedor: c.egreso?.nombre_quien_cobra || '',
        detalle: c.descripcion || c.egreso?.nombre_referencia || '',
        debitos: esIngreso ? 0 : monto,
        creditos: esIngreso ? monto : 0,
        saldo_cta_cte: 0,
        estado: c.estado || 'pendiente',
        medio_pago: c.medio_pago || 'banco',
        grupo_pago_id: null,
      }
    })

    // Filas agrupadas — una fila por grupo
    const porGrupo = new Map<string, any[]>()
    agrupadas.forEach(c => {
      const g = c.grupo_pago_id as string
      if (!porGrupo.has(g)) porGrupo.set(g, [])
      porGrupo.get(g)!.push(c)
    })

    const filasGrupo: CashFlowRow[] = Array.from(porGrupo.entries()).map(([grupoId, cs]) => {
      // Fecha más tardía del grupo
      const fechaMax = cs.map(c => c.fecha_estimada).filter(Boolean).sort().at(-1) ?? ''
      const fechaVencMax = cs.map(c => c.fecha_vencimiento).filter(Boolean).sort().at(-1) ?? null
      const totalDebitos = cs.reduce((s, c) => s + (c.tipo_movimiento === 'ingreso' ? 0 : (c.monto || 0)), 0)
      const primera = cs[0]

      // Detalle inteligente para grupos
      const nombres = cs.map(c => c.egreso?.nombre_referencia || '')
      const prefijoComun = extraerPrefijoComun(nombres)
      const prefijoLimpio = prefijoComun.replace(/\b(Cuota|Anual)\b/gi, '').trim()
      const responsable = primera.egreso?.responsable || ''
      const sufijos = cs
        .map(c => {
          const nombre = c.egreso?.nombre_referencia || ''
          return nombre.startsWith(prefijoComun) ? nombre.slice(prefijoComun.length).trim() : nombre
        })
        .filter(Boolean)
      // Número de cuota: mostrar solo si todos los miembros tienen el mismo numero_cuota
      const numeroCuota = primera.numero_cuota
      const totalCuotas = primera.egreso?.cuotas
      const todasIguales = cs.every(c => c.numero_cuota === numeroCuota)
      const infoCuota = (todasIguales && numeroCuota && totalCuotas)
        ? ` Cuota ${numeroCuota}/${totalCuotas}`
        : ''
      const detallesCombinados = prefijoLimpio
        ? `${prefijoLimpio} ${responsable}${infoCuota} · ${sufijos.join(' · ')}`
        : cs.map(c => c.descripcion || c.egreso?.nombre_referencia || '').join(' · ')

      return {
        id: grupoId,
        origen: 'TEMPLATE' as const,
        origen_tabla: 'msa.grupos_pago',
        egreso_id: primera.egreso_id,
        fecha_estimada: fechaMax,
        fecha_vencimiento: fechaVencMax,
        categ: primera.egreso?.categ || 'SIN_CATEG',
        centro_costo: primera.egreso?.centro_costo || 'SIN_CC',
        cuit_proveedor: primera.egreso?.cuit_quien_cobra || '',
        nombre_proveedor: primera.egreso?.nombre_quien_cobra || '',
        detalle: detallesCombinados,
        debitos: totalDebitos,
        creditos: 0,
        saldo_cta_cte: 0,
        estado: primera.estado || 'pendiente',
        grupo_pago_id: grupoId,
        facturas_agrupadas: cs.length,
        ids_grupo: cs.map(c => c.id),
      }
    })

    return [...filasIndividuales, ...filasGrupo]
  }

  // Mapear períodos de sueldos a formato Cash Flow
  const MESES_CASH = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const mapearSueldos = (periodosS: any[]): CashFlowRow[] => {
    return periodosS.map(p => ({
      id: p.id,
      origen: 'SUELDO' as const,
      origen_tabla: 'sueldos.periodos',
      fecha_estimada: p.fecha_fin_periodo,
      fecha_vencimiento: null,
      categ: 'Sueldos',
      centro_costo: 'ESTRUCTURA',
      cuit_proveedor: p.empleado?.cuit_empleado ?? '',
      nombre_proveedor: p.empleado?.nombre ?? '',
      detalle: `Sueldo ${MESES_CASH[(p.mes ?? 1) - 1]} ${p.anio} - ${p.empleado?.nombre ?? ''}`,
      debitos: p.saldo_pendiente ?? p.bruto_calculado ?? 0,
      creditos: 0,
      saldo_cta_cte: 0,
      estado: p.estado ?? 'proyectado',
    }))
  }

  // Mapear anticipos a formato Cash Flow
  const mapearAnticipos = (anticipos: any[]): CashFlowRow[] => {
    return anticipos.map(a => {
      const esCobro = a.tipo === 'cobro'
      // monto neto = monto original - retención SICORE (si aplica)
      const monto = (a.monto || 0) - (a.monto_sicore || 0)
      const tipoLabel = esCobro ? 'ANTICIPO COBRO' : 'ANTICIPO'
      const esVinculado = a.estado === 'vinculado'

      // ECHEQ: usar fecha_cobro_echeq para Cash Flow (cuando el cheque se deposita)
      const fechaAnticipo = (a.metodo_pago === 'echeq' && a.fecha_cobro_echeq)
        ? a.fecha_cobro_echeq
        : a.fecha_pago
      return {
        id: a.id,
        origen: 'ANTICIPO' as const,
        origen_tabla: 'anticipos_proveedores',
        fecha_estimada: fechaAnticipo,
        fecha_vencimiento: null,
        categ: tipoLabel,
        centro_costo: '',
        cuit_proveedor: a.cuit_proveedor || '',
        nombre_proveedor: a.nombre_proveedor || '',
        detalle: `${tipoLabel}: ${a.descripcion || a.nombre_proveedor}${esVinculado ? ' (vinculado - pend. conciliar)' : ''}`,
        debitos: esCobro ? 0 : monto,   // Pago = débito (dinero sale)
        creditos: esCobro ? monto : 0,  // Cobro = crédito (dinero entra)
        saldo_cta_cte: 0,
        estado: a.estado_pago || 'pendiente'
      }
    })
  }

  // Calcular saldos acumulativos
  const calcularSaldosAcumulativos = (filas: CashFlowRow[]): CashFlowRow[] => {
    let saldoAcumulado = 0
    return filas.map(fila => {
      saldoAcumulado += fila.creditos - fila.debitos
      return { ...fila, saldo_cta_cte: saldoAcumulado }
    })
  }

  // Aplicar filtros a los datos
  const aplicarFiltros = (datos: CashFlowRow[], filtros?: CashFlowFilters): CashFlowRow[] => {
    if (!filtros) return datos

    return datos.filter(fila => {
      // Filtro por fecha
      if (filtros.fechaDesde && fila.fecha_estimada < filtros.fechaDesde) return false
      if (filtros.fechaHasta && fila.fecha_estimada > filtros.fechaHasta) return false

      // Filtro por responsables (nombre_proveedor contiene)
      if (filtros.responsables && filtros.responsables.length > 0) {
        const coincide = filtros.responsables.some(resp => 
          fila.nombre_proveedor.toLowerCase().includes(resp.toLowerCase())
        )
        if (!coincide) return false
      }

      // Filtro por estados
      if (filtros.estados && filtros.estados.length > 0) {
        if (!filtros.estados.includes(fila.estado)) return false
      }

      // Filtro por origen
      if (filtros.origenes && filtros.origenes.length > 0) {
        if (!filtros.origenes.includes(fila.origen)) return false
      }

      // Filtro por detalle
      if (filtros.busquedaDetalle && filtros.busquedaDetalle.trim()) {
        const detalleSearch = filtros.busquedaDetalle.toLowerCase()
        if (!fila.detalle.toLowerCase().includes(detalleSearch)) return false
      }

      // Filtro por CATEG
      if (filtros.busquedaCateg && filtros.busquedaCateg.trim()) {
        const categSearch = filtros.busquedaCateg.toLowerCase()
        if (!fila.categ.toLowerCase().includes(categSearch)) return false
      }

      // Filtro por CUIT
      if (filtros.busquedaCUIT && filtros.busquedaCUIT.trim()) {
        const cuitSearch = filtros.busquedaCUIT.toLowerCase()
        if (!fila.cuit_proveedor.toLowerCase().includes(cuitSearch)) return false
      }

      // Filtro por medio de pago
      if (filtros.medioPago && filtros.medioPago !== 'todos') {
        if ((fila.medio_pago || 'banco') !== filtros.medioPago) return false
      }

      return true
    })
  }

  // Función principal para cargar datos
  const cargarDatos = async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Cargar facturas ARCA (excluir: conciliado, credito, anterior)
      const { data: facturasArca, error: errorArca } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('*, grupo_pago_id, moneda, tipo_cambio, tc_pago, metodo_pago, fecha_cobro_echeq')
        .neq('estado', 'conciliado')
        .neq('estado', 'credito')
        .neq('estado', 'anterior')
        .order('fecha_estimada', { ascending: true, nullsFirst: false })

      if (errorArca) {
        console.error('Error cargando facturas ARCA:', errorArca)
        throw new Error(`Error facturas ARCA: ${errorArca.message}`)
      }

      // 2. Cargar templates egresos (excluir: conciliado, desactivado, credito, anterior)
      const { data: templatesEgresos, error: errorTemplates } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select(`
          *,
          egreso:egresos_sin_factura!inner(*)
        `)
        .neq('estado', 'conciliado')
        .neq('estado', 'desactivado')
        .neq('estado', 'credito')
        .neq('estado', 'anterior')
        .eq('egreso.activo', true)
        .order('fecha_estimada', { ascending: true })

      if (errorTemplates) {
        console.error('Error cargando templates egresos:', errorTemplates)
        throw new Error(`Error templates: ${errorTemplates.message}`)
      }

      // 3. Cargar anticipos pendientes de conciliar (excluir solo conciliados)
      const { data: anticipos, error: errorAnticipos } = await supabase
        .from('anticipos_proveedores')
        .select('*')
        .neq('estado', 'conciliado') // Desaparece solo al conciliar con banco
        .order('fecha_pago', { ascending: true })

      if (errorAnticipos) {
        console.error('Error cargando anticipos:', errorAnticipos)
        // No es crítico, continuamos sin anticipos
      }

      // 4. Cargar períodos de sueldos (desde Ene 2026, no históricos)
      const { data: periodosSueldos, error: errorSueldos } = await supabase
        .from('sueldos_periodos')
        .select('*, empleado:sueldos_empleados(id, nombre, cuit_empleado)')
        .gte('fecha_inicio_periodo', '2026-01-01')
        .neq('estado', 'historico')
        .order('fecha_fin_periodo', { ascending: true })

      if (errorSueldos) {
        console.error('Error cargando sueldos:', errorSueldos)
        // No es crítico, continuamos sin sueldos
      }

      // 5. Cargar pagos de sueldos (anticipos + pagos finales, no conciliados)
      const { data: anticiposSueldos, error: errorAntSueldos } = await supabase
        .from('sueldos_pagos')
        .select('*, empleado:sueldos_empleados(id, nombre, cuit_empleado)')
        .in('tipo', ['anticipo', 'sueldo'])
        .neq('estado', 'conciliado')
        .gte('fecha', '2026-01-01')
        .order('fecha', { ascending: true })

      if (errorAntSueldos) {
        console.error('Error cargando anticipos sueldos:', errorAntSueldos)
      }

      // 6. Mapear todas las fuentes a formato unificado
      const filasArca = mapearFacturasArca(facturasArca || [])
      const filasTemplates = mapearTemplatesEgresos(templatesEgresos || [])
      const filasAnticipos = mapearAnticipos(anticipos || [])
      const filasSueldos = mapearSueldos(periodosSueldos || [])
      const filasAnticiposSueldos = (anticiposSueldos || []).map(a => ({
        id: a.id,
        origen: 'SUELDO' as const,
        origen_tabla: 'sueldos.pagos',
        fecha_estimada: a.fecha,
        fecha_vencimiento: null,
        categ: 'Sueldos',
        centro_costo: 'ESTRUCTURA',
        cuit_proveedor: a.empleado?.cuit_empleado ?? '',
        nombre_proveedor: a.empleado?.nombre ?? '',
        detalle: `${a.tipo === 'sueldo' ? 'Pago Saldo' : 'Anticipo'} ${a.empleado?.nombre ?? ''} - ${a.descripcion ?? ''}`,
        debitos: a.monto ?? 0,
        creditos: 0,
        saldo_cta_cte: 0,
        estado: a.estado ?? 'pagar',
      }))

      // 7. Combinar y ordenar por fecha_estimada
      const todasLasFilas = [...filasArca, ...filasTemplates, ...filasAnticipos, ...filasSueldos, ...filasAnticiposSueldos]
        .sort((a, b) => a.fecha_estimada.localeCompare(b.fecha_estimada))

      // 8. Aplicar filtros
      const filasFiltradas = aplicarFiltros(todasLasFilas, filtros)

      // 9. Calcular saldos acumulativos
      const filasConSaldo = calcularSaldosAcumulativos(filasFiltradas)

      setData(filasConSaldo)

      console.log(`✅ Cash Flow cargado: ${filasArca.length} ARCA + ${filasTemplates.length} Templates + ${filasAnticipos.length} Anticipos + ${filasSueldos.length} Sueldos = ${filasConSaldo.length} total`)

    } catch (error) {
      console.error('Error en useMultiCashFlowData:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Actualizar valor localmente sin recargar desde BD
  const actualizarLocal = (id: string, campo: string, valor: any) => {
    setData(prev => prev.map(fila =>
      fila.id === id ? { ...fila, [campo]: valor } : fila
    ))
  }

  // Función para actualizar un registro individual
  const actualizarRegistro = async (
    id: string,
    campo: string,
    valor: any,
    origen: 'ARCA' | 'TEMPLATE' | 'ANTICIPO' | 'SUELDO',
    egresoId?: string
  ): Promise<boolean> => {
    // Períodos de sueldo son de solo lectura (se gestionan en Tab Sueldos)
    // Anticipos de sueldo (sueldos.pagos) sí son editables
    const filaOrigen = data.find(f => f.id === id)
    if (origen === 'SUELDO' && filaOrigen?.origen_tabla !== 'sueldos.pagos') return false
    try {
      // Preparar objeto de actualización
      let updateData: any = { [campo]: valor }

      // Regla automática: Si se actualiza fecha_vencimiento, actualizar fecha_estimada para coincidir
      if (campo === 'fecha_vencimiento' && valor) {
        updateData.fecha_estimada = valor
        console.log(`🔄 Auto-actualización: fecha_vencimiento = ${valor} → fecha_estimada = ${valor}`)
      }

      if (origen === 'SUELDO' && filaOrigen?.origen_tabla === 'sueldos.pagos') {
        // Anticipo de sueldo: mapear campos a sueldos_pagos
        let pagosUpdateData: any = {}
        if (campo === 'estado') {
          pagosUpdateData.estado = valor
        } else if (campo === 'fecha_estimada') {
          pagosUpdateData.fecha = valor
        } else if (campo === 'debitos') {
          pagosUpdateData.monto = valor
        } else if (campo === 'detalle') {
          pagosUpdateData.descripcion = valor
        } else {
          pagosUpdateData[campo] = valor
        }
        const { error } = await supabase
          .from('sueldos_pagos')
          .update(pagosUpdateData)
          .eq('id', id)
        if (error) throw error
      } else if (origen === 'ARCA') {
        // Comprobar si es una fila de grupo → propagar a todos los miembros
        const filaActualArca = data.find(f => f.id === id)
        const idsGrupoArca = filaActualArca?.ids_grupo

        if (idsGrupoArca && idsGrupoArca.length > 0) {
          const { error } = await supabase
            .schema('msa')
            .from('comprobantes_arca')
            .update(updateData)
            .in('id', idsGrupoArca)
          if (error) throw error
        } else {
          const { error } = await supabase
            .schema('msa')
            .from('comprobantes_arca')
            .update(updateData)
            .eq('id', id)
          if (error) throw error
        }
      } else if (origen === 'ANTICIPO') {
        // Para anticipos: mapear campos según la BD
        let anticipoUpdateData: any = {}

        if (campo === 'debitos' || campo === 'creditos') {
          // El monto editable es monto_restante (y también monto si es el total original)
          anticipoUpdateData.monto = valor
          anticipoUpdateData.monto_restante = valor
          console.log(`💵 Anticipo: actualizando monto/monto_restante = ${valor}`)
        } else if (campo === 'fecha_estimada') {
          anticipoUpdateData.fecha_pago = valor
        } else if (campo === 'detalle') {
          anticipoUpdateData.descripcion = valor
        } else if (campo === 'estado') {
          // Estado en Cash Flow mapea a estado_pago (pago del anticipo)
          anticipoUpdateData.estado_pago = valor
        } else {
          // Otros campos directos
          anticipoUpdateData[campo] = valor
        }

        const { error } = await supabase
          .from('anticipos_proveedores')
          .update(anticipoUpdateData)
          .eq('id', id)

        if (error) throw error
      } else {
        // Para templates: categ y centro_costo van a la tabla padre
        if (campo === 'categ' || campo === 'centro_costo') {
          if (!egresoId) {
            throw new Error('Se requiere egreso_id para actualizar categ/centro_costo')
          }

          const { error } = await supabase
            .from('egresos_sin_factura')
            .update(updateData)
            .eq('id', egresoId)

          if (error) throw error
        } else {
          // Comprobar si es una fila de grupo → propagar a todos los miembros
          const filaActual = data.find(f => f.id === id)
          const idsGrupo = filaActual?.ids_grupo

          if (idsGrupo && idsGrupo.length > 0) {
            // Fila colapsada de grupo: actualizar todos los templates del grupo
            const { error } = await supabase
              .from('cuotas_egresos_sin_factura')
              .update(updateData)
              .in('id', idsGrupo)

            if (error) throw error
          } else {
            // Cuota individual
            const { error } = await supabase
              .from('cuotas_egresos_sin_factura')
              .update(updateData)
              .eq('id', id)

            if (error) throw error
          }
        }
      }

      // Actualización local sin recargar desde BD
      actualizarLocal(id, campo, valor)
      return true

    } catch (error) {
      console.error('Error actualizando registro:', {
        error,
        id,
        campo,
        valor,
        origen,
        egresoId,
        detalle: JSON.stringify(error)
      })
      setError(error instanceof Error ? error.message : `Error al actualizar campo ${campo}: ${JSON.stringify(error)}`)
      return false
    }
  }

  // Función para actualización batch (modo PAGOS)
  const actualizarBatch = async (
    actualizaciones: Array<{
      id: string
      origen: 'ARCA' | 'TEMPLATE'
      campo: string
      valor: any
    }>
  ): Promise<boolean> => {
    try {
      // Agrupar por origen para hacer updates eficientes
      const arcaUpdates = actualizaciones.filter(u => u.origen === 'ARCA')
      const templateUpdates = actualizaciones.filter(u => u.origen === 'TEMPLATE')

      // Procesar updates ARCA
      for (const update of arcaUpdates) {
        const { error } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({ [update.campo]: update.valor })
          .eq('id', update.id)

        if (error) throw error
      }

      // Procesar updates Templates
      for (const update of templateUpdates) {
        const { error } = await supabase
          .from('cuotas_egresos_sin_factura')
          .update({ [update.campo]: update.valor })
          .eq('id', update.id)

        if (error) throw error
      }

      // Actualización local de cada registro del batch
      for (const update of actualizaciones) {
        actualizarLocal(update.id, update.campo, update.valor)
      }
      return true

    } catch (error) {
      console.error('Error en actualización batch:', error)
      setError(error instanceof Error ? error.message : 'Error en actualización masiva')
      return false
    }
  }

  // Cargar datos al inicializar y cuando cambien los filtros
  useEffect(() => {
    cargarDatos()
  }, [filtros])

  // Estadísticas calculadas
  const estadisticas = {
    total_registros: data.length,
    total_debitos: data.reduce((sum, row) => sum + row.debitos, 0),
    total_creditos: data.reduce((sum, row) => sum + row.creditos, 0),
    saldo_final: data.length > 0 ? data[data.length - 1].saldo_cta_cte : 0,
    registros_arca: data.filter(row => row.origen === 'ARCA').length,
    registros_templates: data.filter(row => row.origen === 'TEMPLATE').length,
    registros_anticipos: data.filter(row => row.origen === 'ANTICIPO').length
  }

  return {
    data,
    loading,
    error,
    estadisticas,
    cargarDatos,
    actualizarRegistro,
    actualizarBatch,
    actualizarLocal
  }
}