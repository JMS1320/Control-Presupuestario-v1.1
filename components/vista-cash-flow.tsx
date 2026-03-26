"use client"

import { useState, useRef, useEffect } from "react"
import { useMultiCashFlowData, type CashFlowRow, type CashFlowFilters } from "@/hooks/useMultiCashFlowData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Receipt, Calendar, TrendingUp, TrendingDown, DollarSign, Filter, Edit3, Save, X, Plus, Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { ModalValidarCateg } from "./modal-validar-categ"
import { useCuentasContables } from "@/hooks/useCuentasContables"
import useInlineEditor, { type CeldaEnEdicion as CeldaEnEdicionHook } from "@/hooks/useInlineEditor"
import { CategCombobox } from "@/components/ui/categ-combobox"

// Definición de columnas Cash Flow (10 columnas finales + editabilidad)
const columnasDefinicion = [
  { key: 'fecha_estimada', label: 'FECHA Estimada', type: 'date', width: 'w-32', editable: true },
  { key: 'fecha_vencimiento', label: 'Fecha Vencimiento', type: 'date', width: 'w-32', editable: true },
  { key: 'categ', label: 'CATEG', type: 'text', width: 'w-24', editable: true },
  { key: 'centro_costo', label: 'Centro Costo', type: 'text', width: 'w-28', editable: true },
  { key: 'cuit_proveedor', label: 'CUIT Proveedor', type: 'text', width: 'w-32', editable: false }, // Solo lectura (viene de fuente)
  { key: 'nombre_proveedor', label: 'Nombre Proveedor', type: 'text', width: 'w-48', editable: false }, // Solo lectura (viene de fuente)
  { key: 'detalle', label: 'Detalle', type: 'text', width: 'w-64', editable: true },
  { key: 'debitos', label: 'Débitos', type: 'currency', width: 'w-32', align: 'text-right', editable: true },
  { key: 'creditos', label: 'Créditos', type: 'currency', width: 'w-32', align: 'text-right', editable: true },
  { key: 'saldo_cta_cte', label: 'SALDO CTA CTE', type: 'currency', width: 'w-36', align: 'text-right', editable: false } // Calculado
] as const

// Estados disponibles para edición
const ESTADOS_DISPONIBLES = [
  { value: 'pendiente',  label: 'Pendiente',  color: 'bg-gray-100 text-gray-600' },
  { value: 'debito',     label: 'Débito',      color: 'bg-violet-100 text-violet-800' },
  { value: 'pagar',      label: 'Pagar',       color: 'bg-yellow-100 text-yellow-800' },
  { value: 'preparado',  label: 'Preparado',   color: 'bg-orange-100 text-orange-800' },
  { value: 'echeq',      label: '📝 ECHEQ',    color: 'bg-amber-100 text-amber-800' },
  { value: 'pagado',     label: 'Pagado',      color: 'bg-green-100 text-green-800' },
  { value: 'programado', label: 'Programado',  color: 'bg-violet-100 text-violet-800' },
  { value: 'credito',    label: 'Crédito',     color: 'bg-gray-100 text-gray-600' },
  { value: 'conciliado', label: 'Conciliado',  color: 'bg-gray-100 text-gray-800' },
]

// Estados disponibles para anticipos (estado de pago)
const ESTADOS_ANTICIPO = [
  { value: 'pendiente',  label: 'Pendiente',  color: 'bg-gray-100 text-gray-600' },
  { value: 'pagar',      label: 'Pagar',       color: 'bg-yellow-100 text-yellow-800' },
  { value: 'preparado',  label: 'Preparado',   color: 'bg-orange-100 text-orange-800' },
  { value: 'programado', label: 'Programado',  color: 'bg-violet-100 text-violet-800' },
  { value: 'echeq',      label: '📝 ECHEQ',    color: 'bg-amber-100 text-amber-800' },
  { value: 'pagado',     label: 'Pagado',      color: 'bg-green-100 text-green-800' },
  { value: 'conciliado', label: 'Conciliado',  color: 'bg-gray-100 text-gray-800' },
]

// Interface tipos SICORE
interface TipoSicore {
  id: number
  tipo: string
  emoji: string
  minimo_no_imponible: number
  porcentaje_retencion: number
}

// Interface para celda en edición
interface CeldaEnEdicion {
  filaId: string
  columna: string
  valor: string | number
}

export function VistaCashFlow() {
  const [filtros, setFiltros] = useState<CashFlowFilters | undefined>(undefined)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [busquedaRapida, setBusquedaRapida] = useState('')
  
  // Estados para filtros específicos
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [busquedaProveedor, setBusquedaProveedor] = useState('')
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<string[]>([])
  const [origenesSeleccionados, setOrigenesSeleccionados] = useState<('ARCA' | 'TEMPLATE' | 'ANTICIPO')[]>([])
  const [busquedaDetalle, setBusquedaDetalle] = useState('')
  const [busquedaCateg, setBusquedaCateg] = useState('')
  const [busquedaCUIT, setBusquedaCUIT] = useState('')
  const [medioPagoFiltro, setMedioPagoFiltro] = useState('todos')
  
  // Hook para validación de cuentas contables
  const { cuentas } = useCuentasContables()
  
  // Estados para edición legacy (mantener por compatibilidad modal categ)
  const [celdaEnEdicion, setCeldaEnEdicion] = useState<CeldaEnEdicion | null>(null)
  const [guardandoCambio, setGuardandoCambio] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Estado para cambio de estado (Shift+Click en débitos/créditos)
  const [filaParaCambioEstado, setFilaParaCambioEstado] = useState<CashFlowRow | null>(null)
  
  // Estado para validación de categ
  const [validandoCateg, setValidandoCateg] = useState<{
    isOpen: boolean
    categIngresado: string
    celdaEnEdicion: CeldaEnEdicion | null
  }>({
    isOpen: false,
    categIngresado: '',
    celdaEnEdicion: null
  })
  
  // Estado panel ECHEQs
  const [mostrarPanelEcheqs, setMostrarPanelEcheqs] = useState(false)
  const [cheques, setCheques] = useState<any[]>([])
  const [cargandoCheques, setCargandoCheques] = useState(false)

  const cargarCheques = async () => {
    setCargandoCheques(true)
    const { data } = await supabase.schema('msa').from('cheques')
      .select('*')
      .order('fecha_emision', { ascending: false })
    if (data) setCheques(data)
    setCargandoCheques(false)
  }

  const cambiarEstadoCheque = async (id: string, nuevoEstado: string) => {
    await supabase.schema('msa').from('cheques')
      .update({ estado: nuevoEstado, fecha_estado: new Date().toISOString().split('T')[0] })
      .eq('id', id)
    await cargarCheques()
  }

  const ESTADOS_CHEQUE = [
    { value: 'vigente',    label: 'Vigente',    color: 'bg-amber-100 text-amber-800' },
    { value: 'depositado', label: 'Depositado', color: 'bg-blue-100 text-blue-800' },
    { value: 'cobrado',    label: 'Cobrado',    color: 'bg-green-100 text-green-800' },
    { value: 'rechazado',  label: 'Rechazado',  color: 'bg-red-100 text-red-800' },
  ]

  // Estado para modo PAGOS (Ctrl+Click botón PAGOS)
  const [modoPagos, setModoPagos] = useState(false)
  const [filasSeleccionadas, setFilasSeleccionadas] = useState<Set<string>>(new Set())
  const [cambiarFechaVenc, setCambiarFechaVenc] = useState(false)
  const [cambiarEstadoLote, setCambiarEstadoLote] = useState(true)
  const [valorFechaLote, setValorFechaLote] = useState('')
  const [valorEstadoLote, setValorEstadoLote] = useState('pagado')
  const [procesandoLote, setProcesandoLote] = useState(false)
  // Filtros de origen para modo PAGOS
  const [filtroOrigenPagos, setFiltroOrigenPagos] = useState<{
    arca: boolean
    template: boolean
    anticipo: boolean
  }>({ arca: true, template: true, anticipo: true })

  // Estado para modal Pago Manual (templates abiertos)
  const [modalPagoManual, setModalPagoManual] = useState(false)
  const [templatesAbiertos, setTemplatesAbiertos] = useState<{id: string, nombre_referencia: string, categ: string, cuenta_agrupadora: string | null, es_bidireccional: boolean, responsable: string}[]>([])
  const [templateSeleccionado, setTemplateSeleccionado] = useState<string | null>(null)
  const [pasoModal, setPasoModal] = useState<'seleccionar' | 'datos'>('seleccionar')
  const [tipoMovimiento, setTipoMovimiento] = useState<'egreso' | 'ingreso'>('egreso')
  const [nuevaCuota, setNuevaCuota] = useState({ fecha: '', monto: '', descripcion: '' })
  const [guardandoNuevaCuota, setGuardandoNuevaCuota] = useState(false)

  // Estado para modal Anticipos (crear + ver existentes)
  const [modalAnticipo, setModalAnticipo] = useState(false)
  const [tabAnticipo, setTabAnticipo] = useState<string>('nuevo')
  const [nuevoAnticipo, setNuevoAnticipo] = useState({
    tipo: 'pago' as 'pago' | 'cobro',
    cuit: '',
    nombre: '',
    monto: '',
    fecha: '',
    descripcion: ''
  })
  const [guardandoAnticipo, setGuardandoAnticipo] = useState(false)
  const [anticiposExistentes, setAnticiposExistentes] = useState<any[]>([])
  const [cargandoAnticipos, setCargandoAnticipos] = useState(false)

  // Estados modal SICORE - facturas ARCA
  const [mostrarModalSicore, setMostrarModalSicore] = useState(false)
  const [facturaEnProceso, setFacturaEnProceso] = useState<CashFlowRow | null>(null)
  const [pasoSicore, setPasoSicore] = useState<'tipo' | 'calculo'>('tipo')
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoSicore | null>(null)
  const [montoRetencion, setMontoRetencion] = useState(0)
  const [descuentoAdicional, setDescuentoAdicional] = useState(0)
  const [datosSicoreCalculo, setDatosSicoreCalculo] = useState<{
    netoFactura: number, minimoAplicado: number, baseImponible: number, esRetencionAdicional: boolean
  } | null>(null)
  const [guardadoPendienteCF, setGuardadoPendienteCF] = useState<{
    filaId: string, nuevoEstado: string, estadoAnterior: string
  } | null>(null)
  // Cola SICORE para lote (y para below-minimum auto-advance)
  const [colaLoteSicore, setColaLoteSicore] = useState<CashFlowRow[]>([])
  const [confirmCambioQuincena, setConfirmCambioQuincena] = useState<{
    filaId: string, quincenaAnterior: string, quincenahNueva: string
  } | null>(null)

  // Estados modal SICORE anticipo
  const [tiposSicore, setTiposSicore] = useState<TipoSicore[]>([])
  const [mostrarModalSicoreAnticipo, setMostrarModalSicoreAnticipo] = useState(false)
  const [anticipoSicoreId, setAnticipoSicoreId] = useState<string | null>(null)
  const [anticipoSicoreCuit, setAnticipoSicoreCuit] = useState('')
  const [anticipoSicoreFecha, setAnticipoSicoreFecha] = useState('')
  const [pasoSicoreAnticipo, setPasoSicoreAnticipo] = useState<'pregunta' | 'tipo' | 'campos' | 'calculo'>('pregunta')
  const [tipoSicoreAnticipo, setTipoSicoreAnticipo] = useState<TipoSicore | null>(null)
  const [camposSicore, setCamposSicore] = useState({ neto_gravado: '', neto_no_gravado: '', op_exentas: '', iva: '' })
  const [montoSicoreAnticipo, setMontoSicoreAnticipo] = useState(0)
  const [descuentoSicoreAnticipo, setDescuentoSicoreAnticipo] = useState(0)
  const [datosSicoreAnticipo, setDatosSicoreAnticipo] = useState<{
    netoBase: number, minimoAplicado: number, baseImponible: number,
    esRetencionAdicional: boolean, impTotal: number
  } | null>(null)

  // Estado modal TC de pago (facturas USD)
  const [modalTcPago, setModalTcPago] = useState<{
    open: boolean
    filaId: string
    tcOriginal: number
    tcPagoActual: number | null
    inputVal: string
    guardando: boolean
  }>({ open: false, filaId: '', tcOriginal: 1, tcPagoActual: null, inputVal: '', guardando: false })
  // Flag: si el modal TC de pago fue abierto desde cambio estado → 'pagar', continuar con SICORE al guardar
  const [tcPagoOrigenPagar, setTcPagoOrigenPagar] = useState(false)

  const { data, loading, error, estadisticas, cargarDatos, actualizarRegistro, actualizarBatch, actualizarLocal } = useMultiCashFlowData(filtros)

  // Ref para poder cerrar el editor del hook desde dentro de customValidations
  const hookEditorRef = useRef<{ setCeldaEnEdicion: (v: any) => void } | null>(null)

  // Hook unificado para edición inline (DESPUÉS de cargarDatos para evitar error inicialización)
  const hookEditor = useInlineEditor({
    onLocalUpdate: (filaId, campo, valor, updateData) => {
      // Actualizar cada campo del updateData localmente
      Object.entries(updateData).forEach(([key, val]) => {
        let campoLocal = key
        if (key === 'monto_a_abonar') campoLocal = 'debitos'
        // ANTICIPO: monto/monto_restante mapean a la columna editada (debitos o creditos)
        else if (key === 'monto' || key === 'monto_restante') campoLocal = campo
        actualizarLocal(filaId, campoLocal, val)
      })
    },
    onError: (error) => console.error('Hook error Cash Flow:', error),
    customValidations: async (celda) => {
      // Filas de grupo: redirigir a actualizarRegistro (propaga a todos los miembros)
      const filaActual = data.find(f => f.id === celda.filaId)
      if (filaActual?.ids_grupo && filaActual.ids_grupo.length > 0) {
        let valorFinal: any = celda.valor
        // Procesar fechas: convertir DD/MM/AAAA → YYYY-MM-DD si corresponde
        if (['fecha_estimada', 'fecha_vencimiento'].includes(celda.columna)) {
          const fechaStr = String(valorFinal).trim()
          if (fechaStr.includes('/')) {
            const [d, m, y] = fechaStr.split('/')
            valorFinal = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
          }
        } else if (['debitos', 'creditos'].includes(celda.columna)) {
          valorFinal = parseFloat(String(valorFinal).replace(/\./g, '').replace(',', '.')) || 0
        }
        const exito = await actualizarRegistro(
          celda.filaId,
          celda.campoReal || celda.columna,
          valorFinal,
          filaActual.origen,
          filaActual.egreso_id
        )
        if (exito) hookEditorRef.current?.setCeldaEnEdicion(null)
        return false // Prevenir guardado propio del hook
      }

      // Validación especial para categorías en Cash Flow
      if (celda.columna === 'categ') {
        const categIngresado = String(celda.valor).toUpperCase()
        console.log('🔍 Hook validación CATEG:', categIngresado)
        
        const categExiste = cuentas.some(cuenta => cuenta.categ.toLowerCase() === categIngresado.toLowerCase())
        console.log('- categExiste:', categExiste)
        
        if (!categExiste) {
          // Abrir modal de validación 
          setValidandoCateg({
            isOpen: true,
            categIngresado: categIngresado,
            celdaEnEdicion: celda as any // Cast temporal para compatibilidad
          })
          return false // No guardar todavía
        }
      }
      return true // Proceder con guardado
    }
  })

  // Guardar referencia al hook para usarla desde customValidations
  hookEditorRef.current = hookEditor

  // Abrir modal para editar TC de pago en facturas USD
  const abrirModalTcPago = (fila: CashFlowRow) => {
    setModalTcPago({
      open: true,
      filaId: fila.id,
      tcOriginal: fila.tipo_cambio ?? 1,
      tcPagoActual: fila.tc_pago ?? null,
      inputVal: String(fila.tc_pago ?? fila.tipo_cambio ?? ''),
      guardando: false
    })
  }

  const guardarTcPago = async () => {
    const tc = parseFloat(modalTcPago.inputVal)
    if (!tc || tc <= 0) { toast.error('Ingresá un TC de pago válido'); return }
    // Capturar fila ANTES de las actualizaciones de estado (que son async)
    const filaCapturada = data.find(f => f.id === modalTcPago.filaId)
    const esParaContinuarPagar = tcPagoOrigenPagar
    setModalTcPago(prev => ({ ...prev, guardando: true }))
    try {
      const { error } = await supabase.schema('msa').from('comprobantes_arca')
        .update({ tc_pago: tc })
        .eq('id', modalTcPago.filaId)
      if (error) throw error
      actualizarLocal(modalTcPago.filaId, 'tc_pago', tc)
      // También actualizar débitos local con nuevo TC
      if (filaCapturada) {
        const tcAnterior = filaCapturada.tc_pago ?? filaCapturada.tipo_cambio ?? 1
        const montoBase = filaCapturada.debitos / tcAnterior
        actualizarLocal(modalTcPago.filaId, 'debitos', montoBase * tc)
      }
      toast.success(`TC de pago actualizado: $${tc.toLocaleString('es-AR')}`)
      setModalTcPago(prev => ({ ...prev, open: false }))
      setTcPagoOrigenPagar(false)
      // Si el TC fue pedido para continuar con cambio a 'pagar', seguir automáticamente con SICORE
      if (esParaContinuarPagar && filaCapturada) {
        const filaConTc: CashFlowRow = { ...filaCapturada, tc_pago: tc }
        const pending: PendingSicore = {
          filaId: filaCapturada.id,
          nuevoEstado: 'pagar',
          estadoAnterior: filaCapturada.estado
        }
        setGuardadoPendienteCF(pending)
        // Pasar pending fresco para evitar stale closure
        await evaluarRetencionSicoreCF(filaConTc, pending, [])
      }
    } catch (e) {
      toast.error('Error al guardar TC de pago')
    } finally {
      setModalTcPago(prev => ({ ...prev, guardando: false }))
    }
  }

  // Formatear moneda argentina
  const formatearMoneda = (valor: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(valor)
  }

  // Formatear fecha (evitar problemas de zona horaria)
  const formatearFecha = (fecha: string | null): string => {
    if (!fecha) return '-'
    try {
      // Parsear fecha como local para evitar conversión UTC que resta 1 día
      const [year, month, day] = fecha.split('-')
      const fechaLocal = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return fechaLocal.toLocaleDateString('es-AR')
    } catch {
      return fecha
    }
  }

  // Funciones para edición inline - MIGRADA A HOOK UNIFICADO
  const iniciarEdicion = (fila: CashFlowRow, columna: typeof columnasDefinicion[number], event: React.MouseEvent) => {
    console.log('🔍 Cash Flow iniciarEdicion called:', columna.key, 'ctrlKey:', event.ctrlKey, 'editable:', columna.editable)
    // Shift+Click en débitos/créditos = cambiar estado
    if (event.shiftKey && (columna.key === 'debitos' || columna.key === 'creditos')) {
      event.preventDefault()
      event.stopPropagation()
      iniciarCambioEstado(fila)
      return
    }
    
    // Verificar si la columna es editable para este origen
    const esEditable = columna.editable
    
    // Ctrl+Click normal = editar campo
    if (!event.ctrlKey || !esEditable) return
    
    event.preventDefault()
    event.stopPropagation()
    
    // Usar hook unificado para ALL campos editables
    const valor = fila[columna.key as keyof CashFlowRow]
    console.log('🔄 Cash Flow: Usando hook unificado para:', columna.key)
    
    // Determinar tabla según origen de datos
    console.log('🔍 Cash Flow determinar tabla:', 'fila.origen =', fila.origen, typeof fila.origen)
    let tableName = 'cuotas_egresos_sin_factura' // Default
    if (fila.origen === 'ARCA') {
      tableName = 'comprobantes_arca'
      console.log('✅ Cash Flow: Detectado ARCA → tabla comprobantes_arca')
    } else if (fila.origen === 'ANTICIPO') {
      tableName = 'anticipos_proveedores'
      console.log('💵 Cash Flow: Detectado ANTICIPO → tabla anticipos_proveedores')
    } else {
      console.log('📋 Cash Flow: Default Templates → tabla cuotas_egresos_sin_factura')
    }

    // Determinar origen para el hook
    let origenHook: any = 'CASH_FLOW'
    if (fila.origen === 'ARCA') {
      origenHook = 'ARCA' // Para que use schema msa
    } else if (fila.origen === 'ANTICIPO') {
      origenHook = 'ANTICIPO' // Para mapeo especial de campos
    }

    // Mapear campo del Cash Flow al campo real de BD
    let campoReal = columna.key
    if (fila.origen === 'ARCA') {
      if (columna.key === 'debitos') {
        campoReal = 'monto_a_abonar'
      } else if (columna.key === 'categ') {
        campoReal = 'cuenta_contable'
      }
      // creditos no se puede editar en ARCA (no hay campo destino)
    } else if (fila.origen === 'TEMPLATE') {
      if (columna.key === 'debitos') {
        campoReal = 'monto'
      } else if (columna.key === 'detalle') {
        campoReal = 'descripcion'
      }
    } else if (fila.origen === 'ANTICIPO') {
      // Para anticipos, el hook maneja el mapeo internamente
      if (columna.key === 'debitos' || columna.key === 'creditos') {
        campoReal = columna.key // El hook mapeará a monto/monto_restante
      } else if (columna.key === 'fecha_estimada') {
        campoReal = 'fecha_estimada' // El hook mapeará a fecha_pago
      } else if (columna.key === 'detalle') {
        campoReal = 'detalle' // El hook mapeará a descripcion
      }
    }

    // Para campos de moneda, mostrar valor formateado con coma decimal (es-AR)
    const valorFormateado = columna.type === 'currency' && typeof valor === 'number' && valor !== 0
      ? valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : (valor || '')

    const celdaHook: CeldaEnEdicionHook = {
      filaId: fila.id,
      columna: columna.key,
      valor: valorFormateado,
      tableName,
      origen: origenHook,
      campoReal: campoReal // ← Mapeo del campo real en BD
    }

    console.log('🎯 Cash Flow celdaHook:', celdaHook)

    hookEditor.iniciarEdicion(celdaHook)
  }

  const cancelarEdicion = () => {
    setCeldaEnEdicion(null)
  }

  // Funciones para cambio de estado (Shift+Click)
  const iniciarCambioEstado = (fila: CashFlowRow) => {
    setFilaParaCambioEstado(fila)
  }

  const cambiarEstado = async (nuevoEstado: string) => {
    if (!filaParaCambioEstado) return
    
    try {
      setGuardandoCambio(true)
      
      // HOOK TC PAGO USD - Preguntar TC de pago si es factura USD sin tc_pago
      if (
        filaParaCambioEstado.origen === 'ARCA' &&
        nuevoEstado === 'pagar' &&
        (filaParaCambioEstado.moneda === 'USD' || (filaParaCambioEstado.tipo_cambio ?? 1) > 1.01) &&
        !filaParaCambioEstado.tc_pago
      ) {
        setFilaParaCambioEstado(null)
        setGuardandoCambio(false)
        // Abrir modal de TC de pago; al guardar, continuar automáticamente con SICORE
        setTcPagoOrigenPagar(true)
        abrirModalTcPago(filaParaCambioEstado)
        return
      }

      // HOOK SICORE - Interceptar cambio estado HACIA "pagar" para facturas ARCA
      if (filaParaCambioEstado.origen === 'ARCA' && nuevoEstado === 'pagar' && filaParaCambioEstado.estado !== 'pagar') {
        // Guardar estado pendiente y evaluar SICORE (NO guardar en BD todavía)
        const pending: PendingSicore = {
          filaId: filaParaCambioEstado.id,
          nuevoEstado,
          estadoAnterior: filaParaCambioEstado.estado
        }
        setGuardadoPendienteCF(pending)
        setFilaParaCambioEstado(null)
        setGuardandoCambio(false)
        // Pasar pending explícitamente para evitar stale closure
        await evaluarRetencionSicoreCF(filaParaCambioEstado, pending, [])
        return
      }

      // HOOK QUINCENA - Interceptar cambio a "pagado" para facturas ARCA con SICORE
      if (filaParaCambioEstado.origen === 'ARCA' && nuevoEstado === 'pagado' && filaParaCambioEstado.sicore) {
        const quincenahNueva = generarQuincenaSicoreLocal(filaParaCambioEstado.fecha_estimada)
        if (quincenahNueva !== filaParaCambioEstado.sicore) {
          setConfirmCambioQuincena({
            filaId: filaParaCambioEstado.id,
            quincenaAnterior: filaParaCambioEstado.sicore,
            quincenahNueva
          })
          // Guardar estado de todas formas (la quincena es opcional actualizar)
          await actualizarRegistro(filaParaCambioEstado.id, 'estado', nuevoEstado, 'ARCA')
          setFilaParaCambioEstado(null)
          setGuardandoCambio(false)
          cargarDatos()
          return
        }
      }

      const exito = await actualizarRegistro(
        filaParaCambioEstado.id,
        'estado',
        nuevoEstado,
        filaParaCambioEstado.origen
      )

      if (exito) {
        toast.success(`Estado cambiado a: ${nuevoEstado}`)
        setFilaParaCambioEstado(null)
      } else {
        toast.error('Error al cambiar estado')
      }
    } catch (error) {
      console.error('Error cambiando estado:', error)
      toast.error('Error al cambiar estado')
    } finally {
      setGuardandoCambio(false)
    }
  }

  // Funciones para validación de categ
  const confirmarCateg = async (categFinal: string) => {
    if (!validandoCateg.celdaEnEdicion) return

    const celdaOriginal = validandoCateg.celdaEnEdicion
    
    // Actualizar el valor en la celda
    const nuevaCelda = {
      ...celdaOriginal,
      valor: categFinal
    }
    
    setCeldaEnEdicion(nuevaCelda)
    setValidandoCateg({ isOpen: false, categIngresado: '', celdaEnEdicion: null })
    
    // Ejecutar el guardado real
    await ejecutarGuardadoReal(nuevaCelda)
  }

  const cancelarValidacionCateg = () => {
    setValidandoCateg({ isOpen: false, categIngresado: '', celdaEnEdicion: null })
  }

  // Función auxiliar para ejecutar el guardado sin validación
  const ejecutarGuardadoReal = async (celda: CeldaEnEdicion) => {
    setGuardandoCambio(true)
    
    try {
      // Encontrar la fila original para obtener el origen
      const filaOriginal = data.find(f => f.id === celda.filaId)
      if (!filaOriginal) {
        toast.error('Error: No se encontró el registro')
        return
      }

      // Mapear campo del Cash Flow al campo real de BD
      let campoReal = celda.columna
      
      if (filaOriginal.origen === 'ARCA') {
        // Mapeo para facturas ARCA
        if (celda.columna === 'debitos') {
          campoReal = 'monto_a_abonar' // Permite editar monto a pagar diferente al original
        } else if (celda.columna === 'categ') {
          campoReal = 'cuenta_contable' // En ARCA, 'categ' se guarda como 'cuenta_contable'
        }
        // Para ARCA, los demás campos coinciden: detalle, fecha_estimada, fecha_vencimiento, etc.
      } else if (filaOriginal.origen === 'TEMPLATE') {
        // Mapeo para templates
        if (celda.columna === 'debitos') {
          campoReal = 'monto'
        } else if (celda.columna === 'detalle') {
          campoReal = 'descripcion' // En templates, 'detalle' se guarda como 'descripcion'
        }
        // Para templates: fecha_estimada, fecha_vencimiento coinciden y se guardan en cuotas_egresos_sin_factura
        // categ y centro_costo se guardan en egresos_sin_factura (tabla padre)
      }

      // Validar y convertir valor según tipo
      let valorFinal: any = celda.valor
      const columna = columnasDefinicion.find(c => c.key === celda.columna)
      
      if (columna?.type === 'currency') {
        valorFinal = parseFloat(String(valorFinal).replace(/\./g, '').replace(',', '.')) || 0
      } else if (columna?.type === 'date') {
        // Validar formato de fecha
        if (valorFinal && !Date.parse(String(valorFinal))) {
          toast.error('Formato de fecha inválido')
          return
        }
      }

      // Actualizar en BD
      const exito = await actualizarRegistro(
        celda.filaId,
        campoReal,
        valorFinal,
        filaOriginal.origen,
        filaOriginal.egreso_id // Para templates: ID del egreso padre
      )

      if (exito) {
        toast.success(`${columna?.label} actualizado correctamente`)
        setCeldaEnEdicion(null)
      } else {
        toast.error('Error al guardar cambio')
      }
    } catch (error) {
      console.error('Error guardando cambio:', error)
      toast.error('Error al guardar cambio')
    } finally {
      setGuardandoCambio(false)
    }
  }

  const guardarCambio = async () => {
    if (!celdaEnEdicion) return
    
    // Si está editando categ, validar si existe primero
    if (celdaEnEdicion.columna === 'categ') {
      const categIngresado = String(celdaEnEdicion.valor).toUpperCase()
      
      // DEBUG: Información detallada
      console.log('🔍 DEBUG CATEG:')
      console.log('- categIngresado:', categIngresado)
      console.log('- cuentas cargadas:', cuentas.length)
      console.log('- primeras 3 cuentas:', cuentas.slice(0, 3).map(c => c.categ))
      
      const categExiste = cuentas.some(cuenta => cuenta.categ.toLowerCase() === categIngresado.toLowerCase())
      console.log('- categExiste:', categExiste)
      
      if (categExiste) {
        // Si existe, guardar directo sin modal
        console.log(`✅ CATEG "${categIngresado}" existe → guardado directo`)
        await ejecutarGuardadoReal(celdaEnEdicion)
      } else {
        // Si no existe, mostrar modal con opciones
        console.log(`❓ CATEG "${categIngresado}" no existe → mostrar modal`)
        setValidandoCateg({
          isOpen: true,
          categIngresado: categIngresado,
          celdaEnEdicion: celdaEnEdicion
        })
      }
      return
    }
    
    // Para otros campos, ejecutar guardado directo
    await ejecutarGuardadoReal(celdaEnEdicion)
  }

  const manejarKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      guardarCambio()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelarEdicion()
    }
  }

  // Funciones para filtros
  const aplicarFiltros = () => {
    const nuevosFiltros: CashFlowFilters = {}
    
    // Aplicar filtros de fecha
    if (fechaDesde) nuevosFiltros.fechaDesde = fechaDesde
    if (fechaHasta) nuevosFiltros.fechaHasta = fechaHasta
    
    // Aplicar filtros de búsqueda (convertir en array de responsables)
    const responsables: string[] = []
    if (busquedaProveedor.trim()) {
      responsables.push(busquedaProveedor.trim())
    }
    if (responsables.length > 0) nuevosFiltros.responsables = responsables
    
    // Aplicar filtros de estado
    if (estadosSeleccionados.length > 0) {
      nuevosFiltros.estados = estadosSeleccionados
    }
    
    // Aplicar filtros de origen
    if (origenesSeleccionados.length > 0) {
      nuevosFiltros.origenes = origenesSeleccionados
    }
    
    // Aplicar filtros de búsqueda adicionales
    if (busquedaDetalle.trim()) nuevosFiltros.busquedaDetalle = busquedaDetalle.trim()
    if (busquedaCateg.trim()) nuevosFiltros.busquedaCateg = busquedaCateg.trim()
    if (busquedaCUIT.trim()) nuevosFiltros.busquedaCUIT = busquedaCUIT.trim()
    if (medioPagoFiltro && medioPagoFiltro !== 'todos') nuevosFiltros.medioPago = medioPagoFiltro

    setFiltros(nuevosFiltros)
    toast.success(`Filtros aplicados: ${Object.keys(nuevosFiltros).length} criterios`)
  }
  
  const limpiarFiltros = () => {
    setFechaDesde('')
    setFechaHasta('')
    setBusquedaProveedor('')
    setEstadosSeleccionados([])
    setOrigenesSeleccionados([])
    setBusquedaDetalle('')
    setBusquedaCateg('')
    setBusquedaCUIT('')
    setMedioPagoFiltro('todos')
    setFiltros(undefined)
    toast.success('Filtros limpiados')
  }

  // Funciones para modo PAGOS
  const activarModoPagos = (event: React.MouseEvent) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    setModoPagos(true)
    setFilasSeleccionadas(new Set())
    setFiltroOrigenPagos({ arca: true, template: true, anticipo: true })
    toast.success("Modo PAGOS activado. Selecciona filas con checkboxes")
  }

  const desactivarModoPagos = () => {
    setModoPagos(false)
    setFilasSeleccionadas(new Set())
    setCambiarFechaVenc(false)
    setCambiarEstadoLote(true)
    setValorFechaLote('')
    setValorEstadoLote('pagado')
    setFiltroOrigenPagos({ arca: true, template: true, anticipo: true })
  }

  // Filtrar datos según origen seleccionado en modo PAGOS
  // Filtro rápido por búsqueda (client-side, siempre activo)
  const datosConBusqueda = busquedaRapida.trim()
    ? data.filter(fila => {
        const q = busquedaRapida.toLowerCase().replace(/\./g, '')
        const normalizarMonto = (n: number) => n > 0
          ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '')
          : ''
        return (
          fila.nombre_proveedor?.toLowerCase().includes(q) ||
          fila.cuit_proveedor?.toLowerCase().includes(q) ||
          fila.categ?.toLowerCase().includes(q) ||
          fila.detalle?.toLowerCase().includes(q) ||
          normalizarMonto(fila.debitos).includes(q) ||
          normalizarMonto(fila.creditos).includes(q)
        )
      })
    : data

  const datosFiltradosPagos = modoPagos ? datosConBusqueda.filter(fila => {
    if (fila.origen === 'ARCA' && !filtroOrigenPagos.arca) return false
    if (fila.origen === 'TEMPLATE' && !filtroOrigenPagos.template) return false
    if (fila.origen === 'ANTICIPO' && !filtroOrigenPagos.anticipo) return false
    return true
  }) : datosConBusqueda

  // Seleccionar/Deseleccionar todas las filas visibles
  const seleccionarTodasVisibles = () => {
    const idsVisibles = new Set(datosFiltradosPagos.map(f => f.id))
    setFilasSeleccionadas(idsVisibles)
    toast.success(`${idsVisibles.size} filas seleccionadas`)
  }

  const deseleccionarTodas = () => {
    setFilasSeleccionadas(new Set())
  }

  const toggleFilaSeleccionada = (filaId: string) => {
    setFilasSeleccionadas(prev => {
      const nueva = new Set(prev)
      if (nueva.has(filaId)) {
        nueva.delete(filaId)
      } else {
        nueva.add(filaId)
      }
      return nueva
    })
  }

  const aplicarCambiosLote = async () => {
    if (filasSeleccionadas.size === 0) {
      toast.error("Selecciona al menos una fila")
      return
    }

    if (!cambiarFechaVenc && !cambiarEstadoLote) {
      toast.error("Selecciona al menos una opción: fecha vencimiento o estado")
      return
    }

    if (cambiarFechaVenc && !valorFechaLote) {
      toast.error("Ingresa una fecha válida")
      return
    }

    setProcesandoLote(true)

    try {
      const minimoSicore = 67170
      const calcularNetoLote = (f: CashFlowRow) => {
        const tc = f.tc_pago ?? f.tipo_cambio ?? 1
        return ((f.imp_neto_gravado || 0) + (f.imp_neto_no_gravado || 0) + (f.imp_op_exentas || 0)) * tc
      }

      // Separar filas: las ARCA→'pagar' necesitan evaluación SICORE; el resto va directo
      const todasFilas = Array.from(filasSeleccionadas).map(id => data.find(f => f.id === id)!).filter(Boolean)

      let facturasParaSicore: CashFlowRow[] = []
      const actualizaciones: Array<{id: string, origen: 'ARCA' | 'TEMPLATE', campo: string, valor: any}> = []

      todasFilas.forEach(fila => {
        // Cambio de fecha siempre va al batch directo
        if (cambiarFechaVenc && valorFechaLote) {
          actualizaciones.push({ id: fila.id, origen: fila.origen, campo: 'fecha_vencimiento', valor: valorFechaLote })
          actualizaciones.push({ id: fila.id, origen: fila.origen, campo: 'fecha_estimada', valor: valorFechaLote })
        }

        if (cambiarEstadoLote) {
          const esArcaAPagar = valorEstadoLote === 'pagar' && fila.origen === 'ARCA' && fila.estado !== 'pagar'
          const netoEnPesos = calcularNetoLote(fila)
          const calificaSicore = netoEnPesos > minimoSicore || netoEnPesos < 0

          if (esArcaAPagar && calificaSicore) {
            facturasParaSicore.push(fila)
          } else {
            actualizaciones.push({ id: fila.id, origen: fila.origen, campo: 'estado', valor: valorEstadoLote })
          }
        }
      })

      // Guardar las que no necesitan SICORE primero
      if (actualizaciones.length > 0) {
        await actualizarBatch(actualizaciones)
      }

      // Procesar SICORE para las que califican
      if (facturasParaSicore.length > 0) {
        const mensajeFecha = cambiarFechaVenc && valorFechaLote
          ? `\n📅 Fecha de pago: ${valorFechaLote.split('-').reverse().join('/')}`
          : ''
        const confirmar = window.confirm(
          `${facturasParaSicore.length} factura(s) ARCA califican para retención SICORE:\n\n` +
          facturasParaSicore.map(f => `• ${f.nombre_proveedor || f.cuit_proveedor}`).join('\n') +
          mensajeFecha +
          `\n\n¿Procesar SICORE una por una?`
        )

        if (!confirmar) {
          // Guardar todas sin SICORE
          await actualizarBatch(facturasParaSicore.map(f => ({ id: f.id, origen: 'ARCA' as const, campo: 'estado', valor: 'pagar' })))
          toast.success(`${facturasParaSicore.length} facturas marcadas 'pagar' sin SICORE`)
          desactivarModoPagos()
        } else {
          // Con fecha actualizada si corresponde
          const facturasConFecha = facturasParaSicore.map(f => ({
            ...f,
            ...(cambiarFechaVenc && valorFechaLote ? { fecha_vencimiento: valorFechaLote, fecha_estimada: valorFechaLote } : {})
          }))
          const [primera, ...resto] = facturasConFecha
          setColaLoteSicore(resto)
          const firstPending: PendingSicore = { filaId: primera.id, nuevoEstado: 'pagar', estadoAnterior: primera.estado }
          setGuardadoPendienteCF(firstPending)
          // Actualizar fecha en BD para la primera si aplica
          if (cambiarFechaVenc && valorFechaLote) {
            await supabase.schema('msa').from('comprobantes_arca')
              .update({ fecha_vencimiento: valorFechaLote, fecha_estimada: valorFechaLote })
              .eq('id', primera.id)
          }
          // Pasar pending y cola frescos para evitar stale closure
          await evaluarRetencionSicoreCF(primera, firstPending, resto)
        }
      } else {
        const cambiosTexto = []
        if (cambiarFechaVenc) cambiosTexto.push('fecha vencimiento')
        if (cambiarEstadoLote) cambiosTexto.push('estado')
        toast.success(`${filasSeleccionadas.size} registros actualizados: ${cambiosTexto.join(' y ')}`)
        desactivarModoPagos()
      }
    } catch (error) {
      console.error('Error en aplicarCambiosLote:', error)
      toast.error('Error al aplicar cambios por lote')
    } finally {
      setProcesandoLote(false)
    }
  }

  // Funciones para Pago Manual (templates abiertos)
  const cargarTemplatesAbiertos = async () => {
    try {
      const { data, error } = await supabase
        .from('egresos_sin_factura')
        .select('id, nombre_referencia, categ, cuenta_agrupadora, es_bidireccional, responsable')
        .eq('tipo_template', 'abierto')
        .eq('activo', true)
        .order('cuenta_agrupadora')
        .order('nombre_referencia')

      if (error) throw error
      setTemplatesAbiertos(data || [])
    } catch (error) {
      console.error('Error cargando templates abiertos:', error)
    }
  }

  const abrirModalPagoManual = async () => {
    await cargarTemplatesAbiertos()
    setTemplateSeleccionado(null)
    setPasoModal('seleccionar')
    setTipoMovimiento('egreso')
    setNuevaCuota({ fecha: '', monto: '', descripcion: '' })
    setModalPagoManual(true)
  }

  const guardarPagoManual = async () => {
    if (!templateSeleccionado || !nuevaCuota.fecha || !nuevaCuota.monto) {
      toast.error('Debe completar todos los campos')
      return
    }

    const template = templatesAbiertos.find(t => t.id === templateSeleccionado)

    // Generar descripción automática para FCI o usar la ingresada
    let descripcionFinal = nuevaCuota.descripcion
    if (template?.es_bidireccional && template?.categ === 'FCI') {
      const tipoLabel = tipoMovimiento === 'egreso' ? 'Suscripción' : 'Rescate'
      descripcionFinal = `${tipoLabel} ${template.nombre_referencia}`
    } else if (!descripcionFinal) {
      descripcionFinal = `${template?.nombre_referencia || 'Pago'} - Manual`
    }

    setGuardandoNuevaCuota(true)
    try {
      const { error } = await supabase
        .from('cuotas_egresos_sin_factura')
        .insert({
          egreso_id: templateSeleccionado,
          fecha_estimada: nuevaCuota.fecha,
          fecha_vencimiento: nuevaCuota.fecha,
          monto: parseFloat(nuevaCuota.monto.replace(/\./g, '').replace(',', '.')),
          descripcion: descripcionFinal,
          estado: 'pendiente',
          tipo_movimiento: template?.es_bidireccional ? tipoMovimiento : 'egreso'
        })

      if (error) throw error

      const tipoMsg = template?.es_bidireccional
        ? (tipoMovimiento === 'egreso' ? 'Suscripción' : 'Rescate')
        : 'Pago manual'
      toast.success(`${tipoMsg} agregado exitosamente`)
      setModalPagoManual(false)
      setTemplateSeleccionado(null)
      setTipoMovimiento('egreso')
      setNuevaCuota({ fecha: '', monto: '', descripcion: '' })
      await cargarDatos()
    } catch (error) {
      console.error('Error guardando pago manual:', error)
      toast.error(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setGuardandoNuevaCuota(false)
    }
  }

  // Funciones para Anticipos
  const abrirModalAnticipo = () => {
    setNuevoAnticipo({ tipo: 'pago', cuit: '', nombre: '', monto: '', fecha: '', descripcion: '' })
    setTabAnticipo('nuevo')
    setModalAnticipo(true)
    cargarAnticiposExistentes()
  }

  // Cargar tipos SICORE
  useEffect(() => {
    supabase.from('tipos_sicore_config').select('*').eq('activo', true).order('minimo_no_imponible')
      .then(({ data }) => { if (data) setTiposSicore(data) })
  }, [])

  // Generar quincena SICORE a partir de una fecha
  const generarQuincenaSicoreLocal = (fecha: string): string => {
    const d = new Date(fecha)
    const yy = d.getFullYear().toString().slice(-2)
    const mm = (d.getMonth() + 1).toString().padStart(2, '0')
    return `${yy}-${mm} - ${d.getDate() <= 15 ? '1ra' : '2da'}`
  }

  // Verificar retención previa (solo facturas ARCA, para el flujo de facturas)
  const verificarRetencionPreviaFactura = async (cuit: string, quincena: string): Promise<boolean> => {
    try {
      const { data } = await supabase.schema('msa').from('comprobantes_arca')
        .select('id').eq('cuit', cuit).eq('sicore', quincena).limit(1)
      return !!(data && data.length > 0)
    } catch { return false }
  }

  // Tipo para datos pendientes de guardado
  type PendingSicore = { filaId: string, nuevoEstado: string, estadoAnterior: string }

  // Evaluar si corresponde SICORE para una fila ARCA
  // freshPending y freshCola se pasan explícitamente para evitar stale closures
  const evaluarRetencionSicoreCF = async (
    fila: CashFlowRow,
    freshPending?: PendingSicore | null,
    freshCola?: CashFlowRow[]
  ) => {
    const tc = fila.tc_pago ?? fila.tipo_cambio ?? 1
    const netoGravado = fila.imp_neto_gravado || 0
    const netoNoGravado = fila.imp_neto_no_gravado || 0
    const opExentas = fila.imp_op_exentas || 0
    const netoFactura = netoGravado + netoNoGravado + opExentas
    // SICORE se calcula sobre lo pagado: convertir a pesos con TC de pago
    const netoFacturaPesos = netoFactura * tc
    const minimoServicios = 67170
    const quincena = generarQuincenaSicoreLocal(fila.fecha_vencimiento || fila.fecha_estimada || new Date().toISOString())

    console.log('🔍 SICORE CF: Evaluando fila', {
      id: fila.id,
      proveedor: fila.nombre_proveedor,
      netoGravado,
      netoNoGravado,
      opExentas,
      netoFactura,
      tc,
      netoFacturaPesos,
      minimoServicios,
      califica: netoFacturaPesos > minimoServicios,
      esNegativa: netoFacturaPesos < 0
    })

    // Caso especial: facturas negativas
    if (netoFacturaPesos < 0) {
      const yaRetuvo = await verificarRetencionPreviaFactura(fila.cuit_proveedor, quincena)
      console.log('💰 SICORE CF: Factura negativa - retención previa:', yaRetuvo)
      if (yaRetuvo) {
        setFacturaEnProceso(fila)
        setPasoSicore('tipo')
        setMostrarModalSicore(true)
      } else {
        // Negativa sin retención previa → guardar sin SICORE
        await cancelarSicoreCF(true, freshPending, freshCola)
      }
      return
    }

    // Caso normal: positivos - aplicar filtro mínimo en pesos
    if (netoFacturaPesos <= minimoServicios) {
      console.log('✅ SICORE CF: No corresponde (menor a mínimo) - guardando estado sin SICORE')
      // Por debajo del mínimo → guardar estado sin SICORE
      await cancelarSicoreCF(true, freshPending, freshCola)
      return
    }

    console.log('⚡ SICORE CF: Corresponde evaluación - abriendo modal')
    setFacturaEnProceso(fila)
    setPasoSicore('tipo')
    setMostrarModalSicore(true)
  }

  // Calcular retención según tipo seleccionado
  const calcularRetencionSicoreCF = async (fila: CashFlowRow, tipo: TipoSicore) => {
    // SICORE se calcula sobre lo pagado: usar TC de pago para convertir a pesos
    const tc = fila.tc_pago ?? fila.tipo_cambio ?? 1
    const netoGravado = fila.imp_neto_gravado || 0
    const netoNoGravado = fila.imp_neto_no_gravado || 0
    const opExentas = fila.imp_op_exentas || 0
    const netoFactura = netoGravado + netoNoGravado + opExentas
    const netoFacturaPesos = netoFactura * tc  // ← pesos al TC de pago
    const quincena = generarQuincenaSicoreLocal(fila.fecha_vencimiento || fila.fecha_estimada || new Date().toISOString())

    const yaRetuvo = await verificarRetencionPreviaFactura(fila.cuit_proveedor, quincena)

    let baseImponible = netoFacturaPesos
    let minimoAplicado = 0

    if (!yaRetuvo) {
      if (netoFacturaPesos <= tipo.minimo_no_imponible) {
        alert(`No corresponde retención para ${tipo.tipo}.\nNeto: $${netoFacturaPesos.toLocaleString('es-AR')}\nMínimo: $${tipo.minimo_no_imponible.toLocaleString('es-AR')}`)
        setMostrarModalSicore(false)
        return
      }
      baseImponible = netoFacturaPesos - tipo.minimo_no_imponible
      minimoAplicado = tipo.minimo_no_imponible
    }

    const retencionCalculada = baseImponible * tipo.porcentaje_retencion

    // Guardar netoFacturaPesos (ya en pesos) para mostrar en modal
    setDatosSicoreCalculo({ netoFactura: netoFacturaPesos, minimoAplicado, baseImponible, esRetencionAdicional: yaRetuvo })
    setTipoSeleccionado(tipo)
    setMontoRetencion(retencionCalculada)
    setDescuentoAdicional(0)
    setPasoSicore('calculo')
  }

  // Finalizar SICORE para factura ARCA desde Cash Flow
  const finalizarProcesoSicoreCF = async () => {
    if (!facturaEnProceso || !tipoSeleccionado || !guardadoPendienteCF) return

    try {
      // SICORE se calcula sobre lo pagado: usar TC de pago
      const tc = facturaEnProceso.tc_pago ?? facturaEnProceso.tipo_cambio ?? 1
      const impTotalPesos = (facturaEnProceso.imp_total || 0) * tc
      const saldoPesos = impTotalPesos - montoRetencion - descuentoAdicional
      // monto_a_abonar se guarda en la moneda de la factura:
      // - ARS (tc=1): saldoPesos / 1 = saldoPesos ✓
      // - USD: saldoPesos / tc → número "funcional" que × tc = pesos reales ✓
      const montoAAbona = saldoPesos / tc
      const quincena = generarQuincenaSicoreLocal(facturaEnProceso.fecha_vencimiento || facturaEnProceso.fecha_estimada || new Date().toISOString())

      // 1. Cambiar estado a 'pagar' en BD
      await actualizarRegistro(guardadoPendienteCF.filaId, 'estado', guardadoPendienteCF.nuevoEstado, 'ARCA')

      // 2. Actualizar datos SICORE (monto_sicore siempre en pesos)
      await supabase.schema('msa').from('comprobantes_arca')
        .update({ monto_a_abonar: montoAAbona, sicore: quincena, monto_sicore: montoRetencion, tipo_sicore: tipoSeleccionado.tipo })
        .eq('id', guardadoPendienteCF.filaId)

      toast.success(`✅ SICORE aplicado. Quincena: ${quincena} | Retención: $${montoRetencion.toLocaleString('es-AR')}`)

      // Limpiar modal
      setMostrarModalSicore(false)
      setFacturaEnProceso(null)
      setTipoSeleccionado(null)
      setMontoRetencion(0)
      setDescuentoAdicional(0)
      setGuardadoPendienteCF(null)
      setPasoSicore('tipo')

      // Procesar siguiente en cola (lote) o recargar
      const siguiente = colaLoteSicore[0]
      if (siguiente) {
        const resto = colaLoteSicore.slice(1)
        setColaLoteSicore(resto)
        const nextPending: PendingSicore = { filaId: siguiente.id, nuevoEstado: 'pagar', estadoAnterior: siguiente.estado }
        setGuardadoPendienteCF(nextPending)
        await evaluarRetencionSicoreCF(siguiente, nextPending, resto)
      } else {
        cargarDatos()
      }
    } catch (error) {
      toast.error('Error finalizando SICORE: ' + (error as Error).message)
    }
  }

  // Cancelar SICORE desde Cash Flow
  // freshPending/freshCola: valores frescos para evitar stale closure cuando se llama
  // sincrónicamente después de setState (ej: desde evaluarRetencionSicoreCF)
  const cancelarSicoreCF = async (
    continuarSinSicore: boolean = false,
    freshPending?: PendingSicore | null,
    freshCola?: CashFlowRow[]
  ) => {
    // Usar datos frescos si se proporcionan, sino usar estado React (para llamadas desde UI)
    const pending = freshPending !== undefined ? freshPending : guardadoPendienteCF
    const cola = freshCola !== undefined ? freshCola : colaLoteSicore

    if (pending && !continuarSinSicore) {
      // Restaurar estado anterior en BD y limpiar cola entera
      await actualizarRegistro(pending.filaId, 'estado', pending.estadoAnterior, 'ARCA')
      setColaLoteSicore([])
    } else if (pending && continuarSinSicore) {
      // Guardar el cambio de estado sin SICORE
      await actualizarRegistro(pending.filaId, 'estado', pending.nuevoEstado, 'ARCA')
      if (cola.length === 0) toast.success('Estado cambiado sin retención SICORE')
    }
    setMostrarModalSicore(false)
    setFacturaEnProceso(null)
    setTipoSeleccionado(null)
    setMontoRetencion(0)
    setDescuentoAdicional(0)
    setGuardadoPendienteCF(null)
    setPasoSicore('tipo')

    // Si hay más en cola (lote) y continuamos sin SICORE, avanzar
    if (continuarSinSicore && cola.length > 0) {
      const [siguiente, ...resto] = cola
      setColaLoteSicore(resto)
      const nextPending: PendingSicore = { filaId: siguiente.id, nuevoEstado: 'pagar', estadoAnterior: siguiente.estado }
      setGuardadoPendienteCF(nextPending)
      await evaluarRetencionSicoreCF(siguiente, nextPending, resto)
    } else {
      cargarDatos()
    }
  }

  // Verificar retención previa en AMBAS tablas (facturas + anticipos)
  const verificarRetencionPreviaAnticipo = async (cuit: string, quincena: string): Promise<boolean> => {
    const [{ data: d1 }, { data: d2 }] = await Promise.all([
      supabase.schema('msa').from('comprobantes_arca')
        .select('id').eq('cuit', cuit).eq('sicore', quincena).limit(1),
      supabase.from('anticipos_proveedores')
        .select('id').eq('cuit_proveedor', cuit).eq('sicore', quincena).limit(1)
    ])
    return (d1 && d1.length > 0) || (d2 && d2.length > 0)
  }

  // Calcular SICORE anticipo una vez seleccionado el tipo y los campos
  const calcularSicoreAnticipo = async (tipo: TipoSicore) => {
    const parseCampo = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
    const netoGravado = parseCampo(camposSicore.neto_gravado)
    const netoNoGravado = parseCampo(camposSicore.neto_no_gravado)
    const opExentas = parseCampo(camposSicore.op_exentas)
    const iva = parseCampo(camposSicore.iva)
    const impTotal = netoGravado + netoNoGravado + opExentas + iva
    const netoBase = netoGravado + netoNoGravado + opExentas
    const quincena = generarQuincenaSicoreLocal(anticipoSicoreFecha || new Date().toISOString())

    const yaRetuvo = await verificarRetencionPreviaAnticipo(anticipoSicoreCuit, quincena)

    let baseImponible = netoBase
    let minimoAplicado = 0

    if (!yaRetuvo) {
      if (netoBase <= tipo.minimo_no_imponible) {
        alert(`No corresponde retención para ${tipo.tipo}.\nNeto: $${netoBase.toLocaleString('es-AR')}\nMínimo: $${tipo.minimo_no_imponible.toLocaleString('es-AR')}`)
        return
      }
      baseImponible = netoBase - tipo.minimo_no_imponible
      minimoAplicado = tipo.minimo_no_imponible
    }

    setTipoSicoreAnticipo(tipo)
    setDatosSicoreAnticipo({ netoBase, minimoAplicado, baseImponible, esRetencionAdicional: yaRetuvo, impTotal })
    setMontoSicoreAnticipo(baseImponible * tipo.porcentaje_retencion)
    setDescuentoSicoreAnticipo(0)
    setPasoSicoreAnticipo('calculo')
  }

  // Confirmar y guardar SICORE en el anticipo
  const confirmarSicoreAnticipo = async () => {
    if (!anticipoSicoreId || !tipoSicoreAnticipo || !datosSicoreAnticipo) return
    const quincena = generarQuincenaSicoreLocal(anticipoSicoreFecha || new Date().toISOString())
    const anticipo = anticiposExistentes.find(a => a.id === anticipoSicoreId)
    const saldoFinal = (anticipo?.monto || 0) - montoSicoreAnticipo - descuentoSicoreAnticipo
    const { error } = await supabase.from('anticipos_proveedores').update({
      estado_pago: 'pagar',
      sicore: quincena,
      monto_sicore: montoSicoreAnticipo,
      tipo_sicore: tipoSicoreAnticipo.tipo,
      monto_restante: saldoFinal,
    }).eq('id', anticipoSicoreId)

    if (error) { toast.error('Error guardando SICORE: ' + error.message); return }
    toast.success(`Retención SICORE aplicada: $${montoSicoreAnticipo.toLocaleString('es-AR', { minimumFractionDigits: 2 })} — Quincena ${quincena}`)
    cerrarModalSicoreAnticipo()
    await cargarAnticiposExistentes()
  }

  // Cerrar y limpiar modal SICORE anticipo
  const cerrarModalSicoreAnticipo = () => {
    setMostrarModalSicoreAnticipo(false)
    setAnticipoSicoreId(null)
    setAnticipoSicoreCuit('')
    setAnticipoSicoreFecha('')
    setPasoSicoreAnticipo('pregunta')
    setTipoSicoreAnticipo(null)
    setCamposSicore({ neto_gravado: '', neto_no_gravado: '', op_exentas: '', iva: '' })
    setDatosSicoreAnticipo(null)
    setMontoSicoreAnticipo(0)
    setDescuentoSicoreAnticipo(0)
  }

  const guardarAnticipo = async () => {
    if (!nuevoAnticipo.cuit || !nuevoAnticipo.nombre || !nuevoAnticipo.monto || !nuevoAnticipo.fecha) {
      toast.error('Debe completar CUIT, Nombre, Monto y Fecha')
      return
    }

    setGuardandoAnticipo(true)
    try {
      const monto = parseFloat(nuevoAnticipo.monto.replace(/\./g, '').replace(',', '.'))

      const { data, error } = await supabase
        .from('anticipos_proveedores')
        .insert({
          tipo: nuevoAnticipo.tipo,
          cuit_proveedor: nuevoAnticipo.cuit.replace(/-/g, ''),
          nombre_proveedor: nuevoAnticipo.nombre,
          monto: monto,
          monto_restante: monto,
          fecha_pago: nuevoAnticipo.fecha,
          descripcion: nuevoAnticipo.descripcion || null,
          estado: 'pendiente_vincular'
        })
        .select('id')

      if (error) throw error

      const tipoLabel = nuevoAnticipo.tipo === 'cobro' ? 'Anticipo de Cobro' : 'Anticipo'
      toast.success(`${tipoLabel} registrado. Cambiá el estado a "pagar" para aplicar SICORE.`)

      setNuevoAnticipo({ tipo: 'pago', cuit: '', nombre: '', monto: '', fecha: '', descripcion: '' })
      await cargarDatos()
      await cargarAnticiposExistentes()
    } catch (error) {
      console.error('Error guardando anticipo:', error)
      toast.error(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setGuardandoAnticipo(false)
    }
  }

  const cargarAnticiposExistentes = async () => {
    setCargandoAnticipos(true)
    try {
      const { data, error } = await supabase
        .from('anticipos_proveedores')
        .select('*')
        .order('fecha_pago', { ascending: false })

      if (error) throw error
      setAnticiposExistentes(data || [])
    } catch (error) {
      console.error('Error cargando anticipos:', error)
      toast.error('Error al cargar anticipos')
    } finally {
      setCargandoAnticipos(false)
    }
  }

  const cambiarEstadoPagoAnticipo = async (anticipoId: string, nuevoEstado: string) => {
    // Obtener el anticipo completo para saber si tiene SICORE
    const anticipo = anticiposExistentes.find(a => a.id === anticipoId)

    if (nuevoEstado === 'pagar') {
      if (anticipo?.sicore && anticipo?.monto_sicore) {
        // Ya tiene SICORE: actualizar estado + recalcular saldo
        const saldo = (anticipo.monto || 0) - (anticipo.monto_sicore || 0)
        const { error } = await supabase.from('anticipos_proveedores')
          .update({ estado_pago: 'pagar', monto_restante: saldo }).eq('id', anticipoId)
        if (error) { toast.error('Error: ' + error.message); return }
        toast.success('Anticipo → pagar (SICORE ya aplicado)')
      } else if (anticipo) {
        // Sin SICORE: abrir modal
        setAnticipoSicoreId(anticipo.id)
        setAnticipoSicoreCuit(anticipo.cuit_proveedor)
        setAnticipoSicoreFecha(anticipo.fecha_pago)
        setPasoSicoreAnticipo('tipo')
        setMostrarModalSicoreAnticipo(true)
        return  // no recargar todavía
      }
    } else {
      const { error } = await supabase.from('anticipos_proveedores')
        .update({ estado_pago: nuevoEstado }).eq('id', anticipoId)
      if (error) { toast.error('Error: ' + error.message); return }
      toast.success(`Anticipo → ${nuevoEstado}`)
    }
    await cargarAnticiposExistentes()
    await cargarDatos()
  }

  // Renderizar celda según tipo (con soporte para edición inline) - HOOK UNIFICADO
  const renderizarCelda = (fila: CashFlowRow, columna: typeof columnasDefinicion[number]) => {
    const valor = fila[columna.key as keyof CashFlowRow]
    
    // Verificar si esta celda está siendo editada por el hook
    const esCeldaHookEnEdicion = hookEditor.celdaEnEdicion?.filaId === fila.id && 
                                 hookEditor.celdaEnEdicion?.columna === columna.key
    
    // Si esta celda está en edición del hook, mostrar input del hook
    if (esCeldaHookEnEdicion) {
      return (
        <div className={`${columna.width} ${columna.align || ''} relative`}>
          <div className="flex items-center gap-1">
            {columna.type === 'date' ? (
              <Input
                ref={hookEditor.inputRef} // ✅ AUTO-FOCUS del hook
                type="date"
                value={String(hookEditor.celdaEnEdicion?.valor || '')}
                onChange={(e) => hookEditor.setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
                onKeyDown={hookEditor.manejarKeyDown} // ✅ Enter/Escape del hook
                className="h-6 text-xs p-1 w-full"
                disabled={hookEditor.guardandoCambio}
              />
            ) : columna.type === 'currency' ? (
              <Input
                ref={hookEditor.inputRef}
                type="text"
                placeholder="0,00"
                value={String(hookEditor.celdaEnEdicion?.valor || '')}
                onChange={(e) => hookEditor.setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
                onKeyDown={hookEditor.manejarKeyDown}
                className="h-6 text-xs p-1 w-full text-right"
                disabled={hookEditor.guardandoCambio}
              />
            ) : columna.key === 'categ' ? (
              <>
                <Input
                  ref={hookEditor.inputRef}
                  type="text"
                  list="cuentas-contables-list-cf"
                  value={String(hookEditor.celdaEnEdicion?.valor || '')}
                  onChange={(e) => hookEditor.setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
                  onKeyDown={hookEditor.manejarKeyDown}
                  className="h-6 text-xs p-1 w-full"
                  disabled={hookEditor.guardandoCambio}
                  placeholder="Escribí para buscar..."
                />
                <datalist id="cuentas-contables-list-cf">
                  {cuentas.map(cuenta => (
                    <option key={cuenta.categ} value={cuenta.categ}>
                      {cuenta.cuenta_contable}
                    </option>
                  ))}
                </datalist>
              </>
            ) : (
              <Input
                ref={hookEditor.inputRef}
                type="text"
                value={String(hookEditor.celdaEnEdicion?.valor || '')}
                onChange={(e) => hookEditor.setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
                onKeyDown={hookEditor.manejarKeyDown}
                className="h-6 text-xs p-1 w-full"
                disabled={hookEditor.guardandoCambio}
              />
            )}
            
            {/* Botones de acción */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => hookEditor.guardarCambio()}
                disabled={hookEditor.guardandoCambio}
                className="h-6 w-6 p-0"
              >
                {hookEditor.guardandoCambio ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 text-green-600" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => hookEditor.cancelarEdicion()}
                disabled={hookEditor.guardandoCambio}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          </div>
        </div>
      )
    }
    
    // FALLBACK: Legacy edición (para modal categ si lo necesita)
    const esCeldaLegacyEnEdicion = celdaEnEdicion?.filaId === fila.id && celdaEnEdicion?.columna === columna.key
    if (esCeldaLegacyEnEdicion) {
      // Mantener lógica original por si acaso
      return <div className="text-blue-500">Legacy editing...</div>
    }

    // Celda normal con click handler
    const contenido = (() => {
      switch (columna.type) {
        case 'date':
          return formatearFecha(valor as string)
        
        case 'currency':
          // Colorización según estado — solo en debitos/creditos, nunca en saldo
          let colorClase = 'text-black'
          const montoActual = valor != null ? Number(valor) : 0
          const esColumnaColor = columna.key === 'debitos' || columna.key === 'creditos'
          if (esColumnaColor && montoActual > 0) {
            if (fila.estado === 'pagado') {
              // Aplica a debitos (egresos pagados) y creditos (cobros pagados)
              colorClase = 'text-white bg-green-600 px-2 py-1 rounded'
            } else if (columna.key === 'debitos') {
              // Estados de proceso solo aplican a egresos (columna debitos)
              if (fila.estado === 'pagar') {
                colorClase = 'text-black bg-yellow-300 px-2 py-1 rounded'
              } else if (fila.estado === 'preparado') {
                colorClase = 'text-white bg-orange-500 px-2 py-1 rounded'
              } else if (fila.estado === 'debito' || fila.estado === 'programado') {
                colorClase = 'text-white bg-violet-600 px-2 py-1 rounded'
              }
            }
          }
          
          return (
            <span className={`font-mono ${colorClase}`}>
              {formatearMoneda(valor as number)}
            </span>
          )
        
        case 'text':
        default:
          // Badge USD clickable en columna nombre_proveedor para facturas USD
          if (columna.key === 'nombre_proveedor' && fila.origen === 'ARCA' && (fila.moneda === 'USD' || (fila.tipo_cambio ?? 1) > 1.01)) {
            const tcLabel = fila.tc_pago
              ? `TC Pago: $${fila.tc_pago.toLocaleString('es-AR')}`
              : `TC ARCA: $${(fila.tipo_cambio ?? 1).toLocaleString('es-AR')}`
            return (
              <div className="flex items-center gap-1">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-200 text-amber-800 border border-amber-400 cursor-pointer hover:bg-amber-300 transition-colors shrink-0"
                  title={`${tcLabel} — Click para editar TC de pago`}
                  onClick={(e) => { e.stopPropagation(); abrirModalTcPago(fila) }}
                >
                  💵 USD
                </span>
                <span className="truncate">{(valor as string) || '-'}</span>
              </div>
            )
          }
          return valor || '-'
      }
    })()

    return (
      <div 
        className={`
          ${columna.width} 
          ${columna.align || ''} 
          ${columna.editable ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'} 
          ${columna.editable ? 'border-l-2 border-l-transparent hover:border-l-blue-300' : ''}
          truncate p-1 transition-colors
        `}
        title={`${valor || '-'}${columna.editable ? ' (Ctrl+Click para editar)' : ''}`}
        onClick={(e) => iniciarEdicion(fila, columna, e)}
      >
        {columna.editable && (
          <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 float-right" />
        )}
        {contenido}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
          <span>Cargando Cash Flow...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="text-red-600 mb-4">Error al cargar Cash Flow</div>
            <div className="text-sm text-gray-600 mb-4">{error}</div>
            <Button onClick={cargarDatos} variant="outline">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Registros</p>
                <p className="text-2xl font-bold">{estadisticas.total_registros}</p>
              </div>
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {estadisticas.registros_arca} ARCA + {estadisticas.registros_templates} Templates + {estadisticas.registros_anticipos} Anticipos
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Débitos</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatearMoneda(estadisticas.total_debitos)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Créditos</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatearMoneda(estadisticas.total_creditos)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Saldo Final</p>
                <p className={`text-2xl font-bold ${estadisticas.saldo_final >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatearMoneda(estadisticas.saldo_final)}
                </p>
              </div>
              <DollarSign className={`h-8 w-8 ${estadisticas.saldo_final >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cash Flow - Vista en Tiempo Real
              <Badge variant="secondary" className="text-xs">
                <Edit3 className="h-3 w-3 mr-1" />
                Ctrl+Click para editar
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Buscador rápido siempre visible */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  placeholder="Buscar proveedor, CUIT, categ, detalle..."
                  value={busquedaRapida}
                  onChange={(e) => setBusquedaRapida(e.target.value)}
                  className="pl-8 h-8 w-72 text-sm"
                />
                {busquedaRapida && (
                  <button
                    onClick={() => setBusquedaRapida('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              <Button
                variant={modoPagos ? "default" : "outline"}
                size="sm"
                onClick={modoPagos ? desactivarModoPagos : activarModoPagos}
                title="Ctrl+Click para activar modo PAGOS"
              >
                <Receipt className="h-4 w-4 mr-2" />
                {modoPagos ? 'Cancelar PAGOS' : 'PAGOS'}
              </Button>
              {/* Botón Pago Manual - Templates Abiertos */}
              <Button
                variant="outline"
                size="sm"
                onClick={abrirModalPagoManual}
                className="border-purple-500 text-purple-600 hover:bg-purple-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Pago Manual
              </Button>
              {/* Botón ECHEQs */}
              <Button
                variant={mostrarPanelEcheqs ? "default" : "outline"}
                size="sm"
                onClick={() => { setMostrarPanelEcheqs(!mostrarPanelEcheqs); if (!mostrarPanelEcheqs) cargarCheques() }}
                className={mostrarPanelEcheqs ? "bg-amber-600 hover:bg-amber-700" : "border-amber-500 text-amber-700 hover:bg-amber-50"}
              >
                📝 ECHEQs
              </Button>
              {/* Botón Nuevo Anticipo */}
              <Button
                variant="outline"
                size="sm"
                onClick={abrirModalAnticipo}
                className="border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Anticipo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={cargarDatos}
              >
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filtros avanzados */}
          {mostrarFiltros && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-medium mb-4 text-gray-800">🔍 Filtros Avanzados Cash Flow</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {/* Filtros de fecha */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">📅 Rango de Fechas</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      placeholder="Desde"
                      value={fechaDesde}
                      onChange={(e) => setFechaDesde(e.target.value)}
                      className="text-xs"
                    />
                    <Input
                      type="date"
                      placeholder="Hasta"
                      value={fechaHasta}
                      onChange={(e) => setFechaHasta(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
                
                {/* Búsqueda de proveedor */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">🏢 Proveedor</Label>
                  <Input
                    placeholder="Buscar por nombre proveedor..."
                    value={busquedaProveedor}
                    onChange={(e) => setBusquedaProveedor(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                    className="text-xs"
                  />
                </div>
                
                {/* Búsqueda por CUIT */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">🆔 CUIT</Label>
                  <Input
                    placeholder="Buscar por CUIT..."
                    value={busquedaCUIT}
                    onChange={(e) => setBusquedaCUIT(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                    className="text-xs"
                  />
                </div>

                {/* Filtro por medio de pago */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">💳 Medio de Pago</Label>
                  <Select value={medioPagoFiltro} onValueChange={setMedioPagoFiltro}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="banco">Banco</SelectItem>
                      <SelectItem value="caja_general">Caja General</SelectItem>
                      <SelectItem value="caja_ams">Caja AMS</SelectItem>
                      <SelectItem value="caja_sigot">Caja Sigot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Búsqueda por detalle */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">📋 Detalle</Label>
                  <Input
                    placeholder="Buscar en detalle..."
                    value={busquedaDetalle}
                    onChange={(e) => setBusquedaDetalle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                    className="text-xs"
                  />
                </div>
                
                {/* Búsqueda por CATEG */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">💰 CATEG</Label>
                  <CategCombobox
                    value={busquedaCateg}
                    onValueChange={setBusquedaCateg}
                    placeholder="Buscar por categ..."
                    className="text-xs"
                  />
                </div>
                
                {/* Selector múltiple de estados */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">⚡ Estados</Label>
                  <div className="flex flex-wrap gap-1">
                    {ESTADOS_DISPONIBLES.map((estado) => (
                      <div key={estado.value} className="flex items-center gap-1">
                        <Checkbox
                          id={`estado-${estado.value}`}
                          checked={estadosSeleccionados.includes(estado.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEstadosSeleccionados([...estadosSeleccionados, estado.value])
                            } else {
                              setEstadosSeleccionados(estadosSeleccionados.filter(e => e !== estado.value))
                            }
                          }}
                        />
                        <Label htmlFor={`estado-${estado.value}`} className="text-xs cursor-pointer">
                          {estado.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Selector de orígenes */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">📊 Origen</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="origen-arca"
                        checked={origenesSeleccionados.includes('ARCA')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setOrigenesSeleccionados([...origenesSeleccionados, 'ARCA'])
                          } else {
                            setOrigenesSeleccionados(origenesSeleccionados.filter(o => o !== 'ARCA'))
                          }
                        }}
                      />
                      <Label htmlFor="origen-arca" className="text-sm cursor-pointer">ARCA</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="origen-template"
                        checked={origenesSeleccionados.includes('TEMPLATE')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setOrigenesSeleccionados([...origenesSeleccionados, 'TEMPLATE'])
                          } else {
                            setOrigenesSeleccionados(origenesSeleccionados.filter(o => o !== 'TEMPLATE'))
                          }
                        }}
                      />
                      <Label htmlFor="origen-template" className="text-sm cursor-pointer">Templates</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="origen-anticipo"
                        checked={origenesSeleccionados.includes('ANTICIPO')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setOrigenesSeleccionados([...origenesSeleccionados, 'ANTICIPO'])
                          } else {
                            setOrigenesSeleccionados(origenesSeleccionados.filter(o => o !== 'ANTICIPO'))
                          }
                        }}
                      />
                      <Label htmlFor="origen-anticipo" className="text-sm cursor-pointer">Anticipos</Label>
                    </div>
                  </div>
                </div>
                
                {/* Estadísticas de filtrado */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">📈 Estadísticas</Label>
                  <div className="text-xs text-gray-600">
                    {data.length} registros mostrados
                    {filtros && (
                      <span className="text-blue-600"> (filtrado aplicado)</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={aplicarFiltros}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Aplicar Filtros
                </Button>
                <Button
                  onClick={limpiarFiltros}
                  variant="outline"
                  size="sm"
                >
                  Limpiar
                </Button>
              </div>
            </div>
          )}

          {/* Panel modo PAGOS */}
          {modoPagos && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-blue-800">
                    💰 Modo PAGOS - {filasSeleccionadas.size} filas seleccionadas de {datosFiltradosPagos.length}
                  </h4>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={seleccionarTodasVisibles}
                      className="text-xs"
                    >
                      Seleccionar todas
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deseleccionarTodas}
                      className="text-xs"
                      disabled={filasSeleccionadas.size === 0}
                    >
                      Deseleccionar
                    </Button>
                  </div>
                </div>

                {/* Filtros por origen */}
                <div className="flex items-center gap-6 p-2 bg-white rounded border">
                  <span className="text-sm font-medium text-gray-700">Mostrar:</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filtroOrigenPagos.arca}
                        onCheckedChange={(checked) => setFiltroOrigenPagos(prev => ({ ...prev, arca: !!checked }))}
                      />
                      <span className="text-sm flex items-center gap-1">
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">ARCA</Badge>
                        ({data.filter(f => f.origen === 'ARCA').length})
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filtroOrigenPagos.template}
                        onCheckedChange={(checked) => setFiltroOrigenPagos(prev => ({ ...prev, template: !!checked }))}
                      />
                      <span className="text-sm flex items-center gap-1">
                        <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">Template</Badge>
                        ({data.filter(f => f.origen === 'TEMPLATE').length})
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filtroOrigenPagos.anticipo}
                        onCheckedChange={(checked) => setFiltroOrigenPagos(prev => ({ ...prev, anticipo: !!checked }))}
                      />
                      <span className="text-sm flex items-center gap-1">
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 text-xs">Anticipo</Badge>
                        ({data.filter(f => f.origen === 'ANTICIPO').length})
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Checkboxes independientes */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cambiar-fecha"
                      checked={cambiarFechaVenc}
                      onCheckedChange={setCambiarFechaVenc}
                    />
                    <Label htmlFor="cambiar-fecha">Cambiar fecha vencimiento</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cambiar-estado"
                      checked={cambiarEstadoLote}
                      onCheckedChange={setCambiarEstadoLote}
                    />
                    <Label htmlFor="cambiar-estado">Cambiar estado</Label>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Inputs para ambas opciones */}
                  {cambiarFechaVenc && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Fecha:</Label>
                      <Input
                        type="date"
                        value={valorFechaLote}
                        onChange={(e) => setValorFechaLote(e.target.value)}
                        placeholder="Nueva fecha vencimiento"
                        className="w-40"
                      />
                    </div>
                  )}
                  
                  {cambiarEstadoLote && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Estado:</Label>
                      <Select value={valorEstadoLote} onValueChange={setValorEstadoLote}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTADOS_DISPONIBLES.map((estado) => (
                            <SelectItem key={estado.value} value={estado.value}>
                              {estado.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    onClick={aplicarCambiosLote}
                    disabled={filasSeleccionadas.size === 0 || procesandoLote || (!cambiarFechaVenc && !cambiarEstadoLote)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {procesandoLote ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Aplicando...
                      </>
                    ) : (
                      `Aplicar a ${filasSeleccionadas.size} filas`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tabla Cash Flow */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full">
                {/* Header */}
                <thead className="bg-gray-50 border-b sticky top-0 z-10">
                  <tr>
                    {/* Columna checkbox solo en modo PAGOS */}
                    {modoPagos && (
                      <th className="p-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        Sel.
                      </th>
                    )}
                    
                    {columnasDefinicion.map((col) => (
                      <th 
                        key={col.key} 
                        className={`p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.width}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Body */}
                <tbody className="bg-white divide-y divide-gray-200">
                  {(modoPagos ? datosFiltradosPagos : datosConBusqueda).length === 0 ? (
                    <tr>
                      <td colSpan={columnasDefinicion.length + (modoPagos ? 1 : 0)} className="p-8 text-center text-gray-500">
                        {modoPagos ? 'No hay datos con los filtros seleccionados' : 'No hay datos para mostrar en Cash Flow'}
                        <br />
                        <span className="text-xs">
                          {modoPagos ? 'Activa al menos un filtro de origen (ARCA, Template, Anticipo)' : 'Verifica que existan facturas ARCA o templates con estado pendiente/pagar/debito'}
                        </span>
                      </td>
                    </tr>
                  ) : (
                    (modoPagos ? datosFiltradosPagos : datosConBusqueda).map((fila, index) => {
                      const esUSD = fila.origen === 'ARCA' && (fila.moneda === 'USD' || (fila.tipo_cambio ?? 1) > 1.01)
                      return (
                      <tr
                        key={fila.id}
                        className={`group hover:bg-gray-50 ${
                          filasSeleccionadas.has(fila.id) ? 'bg-blue-50' :
                          fila.estado === 'echeq' ? 'bg-emerald-50' :
                          esUSD ? 'bg-amber-50' :
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                        }`}
                      >
                        {/* Checkbox solo en modo PAGOS */}
                        {modoPagos && (
                          <td className="p-3 text-center">
                            <Checkbox
                              checked={filasSeleccionadas.has(fila.id)}
                              onCheckedChange={() => toggleFilaSeleccionada(fila.id)}
                            />
                          </td>
                        )}
                        
                        {/* Columnas de datos */}
                        {columnasDefinicion.map((col) => (
                          <td key={col.key} className="p-3 text-sm">
                            {renderizarCelda(fila, col)}
                          </td>
                        ))}
                      </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer con información */}
          {data.length > 0 && (
            <div className="mt-4 text-sm text-gray-500 text-center">
              Mostrando {data.length} registros ordenados por fecha estimada
              <br />
              💡 PASO 4 ✅ Edición Ctrl+Click | PASO 5 ✅ Modo PAGOS Ctrl+Click | Estados: 🟢 pagado, 🟡 pagar
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel ECHEQs */}
      {mostrarPanelEcheqs && (
        <Card className="mt-4 border-amber-200">
          <CardHeader className="pb-3 bg-amber-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">📝 Gestión de ECHEQs</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={cargarCheques} disabled={cargandoCheques}>
                  {cargandoCheques ? <Loader2 className="h-4 w-4 animate-spin" /> : '↺ Actualizar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMostrarPanelEcheqs(false)}>✕</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {cheques.length === 0 ? (
              <p className="p-6 text-center text-gray-500">No hay ECHEQs registrados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-3 text-left font-medium">Nro ECHEQ</th>
                      <th className="p-3 text-left font-medium">Banco</th>
                      <th className="p-3 text-left font-medium">Beneficiario</th>
                      <th className="p-3 text-left font-medium">CUIT</th>
                      <th className="p-3 text-right font-medium">Monto</th>
                      <th className="p-3 text-center font-medium">F. Emisión</th>
                      <th className="p-3 text-center font-medium">F. Cobro</th>
                      <th className="p-3 text-left font-medium">SICORE</th>
                      <th className="p-3 text-left font-medium">Concepto</th>
                      <th className="p-3 text-center font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cheques.map(ch => {
                      const estadoInfo = ESTADOS_CHEQUE.find(e => e.value === ch.estado) || ESTADOS_CHEQUE[0]
                      const hoy = new Date().toISOString().split('T')[0]
                      const vencido = ch.fecha_cobro && ch.fecha_cobro < hoy && ch.estado === 'vigente'
                      return (
                        <tr key={ch.id} className={`border-b hover:bg-gray-50 ${vencido ? 'bg-red-50' : ''}`}>
                          <td className="p-3 font-mono text-xs">{ch.numero || <span className="text-gray-400 italic">sin nro</span>}</td>
                          <td className="p-3">{ch.banco}</td>
                          <td className="p-3">{ch.beneficiario_nombre || '-'}</td>
                          <td className="p-3 text-xs text-gray-500">{ch.beneficiario_cuit || '-'}</td>
                          <td className="p-3 text-right font-medium">${(ch.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-center text-xs">{ch.fecha_emision ? new Date(ch.fecha_emision + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</td>
                          <td className={`p-3 text-center text-xs ${vencido ? 'text-red-600 font-semibold' : ''}`}>
                            {ch.fecha_cobro ? new Date(ch.fecha_cobro + 'T12:00:00').toLocaleDateString('es-AR') : '-'}
                            {vencido && ' ⚠️'}
                          </td>
                          <td className="p-3 text-xs">{ch.sicore ? <span className="bg-blue-100 text-blue-700 px-1 rounded">{ch.sicore}</span> : '-'}</td>
                          <td className="p-3 text-xs text-gray-600 max-w-[160px] truncate">{ch.concepto || '-'}</td>
                          <td className="p-3">
                            <select
                              value={ch.estado || 'vigente'}
                              onChange={e => cambiarEstadoCheque(ch.id, e.target.value)}
                              className={`text-xs px-2 py-1 rounded border ${estadoInfo.color} cursor-pointer`}
                            >
                              {ESTADOS_CHEQUE.map(e => (
                                <option key={e.value} value={e.value}>{e.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal cambio de estado (Shift+Click débitos/créditos) */}
      {filaParaCambioEstado && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setFilaParaCambioEstado(null)
          }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Cambiar Estado
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {filaParaCambioEstado.nombre_proveedor}
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              {(filaParaCambioEstado.origen === 'ANTICIPO' ? ESTADOS_ANTICIPO : ESTADOS_DISPONIBLES).map((estado) => (
                <Button
                  key={estado.value}
                  variant={filaParaCambioEstado.estado === estado.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => cambiarEstado(estado.value)}
                  disabled={guardandoCambio}
                  className="justify-start"
                >
                  <Badge variant="outline" className={`mr-2 ${estado.color}`}>
                    {estado.label}
                  </Badge>
                </Button>
              ))}
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilaParaCambioEstado(null)}
                disabled={guardandoCambio}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal validación de categ */}
      <ModalValidarCateg
        isOpen={validandoCateg.isOpen}
        categIngresado={validandoCateg.categIngresado}
        onConfirm={confirmarCateg}
        onCancel={cancelarValidacionCateg}
      />

      {/* Modal TC de pago - Facturas USD */}
      {modalTcPago.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
              💵 TC de Pago — Factura USD
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              TC original ARCA: <strong>${modalTcPago.tcOriginal.toLocaleString('es-AR')}</strong>
              {modalTcPago.tcPagoActual && (
                <span className="ml-2 text-amber-700">(actual: ${modalTcPago.tcPagoActual.toLocaleString('es-AR')})</span>
              )}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Tipo de cambio al momento del pago
                </label>
                <Input
                  type="text"
                  value={modalTcPago.inputVal}
                  onChange={e => setModalTcPago(prev => ({ ...prev, inputVal: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') guardarTcPago(); if (e.key === 'Escape') setModalTcPago(prev => ({ ...prev, open: false })) }}
                  placeholder={String(modalTcPago.tcOriginal).replace('.', ',')}
                  autoFocus
                  className="text-right"
                />
              </div>
              <p className="text-xs text-gray-400">
                El débito en Cash Flow se recalculará con el nuevo TC.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalTcPago(prev => ({ ...prev, open: false }))}
                disabled={modalTcPago.guardando}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={guardarTcPago}
                disabled={modalTcPago.guardando}
                className="flex-1"
              >
                {modalTcPago.guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar TC'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pago Manual - Templates Abiertos */}
      <Dialog open={modalPagoManual} onOpenChange={setModalPagoManual}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pasoModal === 'seleccionar' ? '💰 Pago Manual' : '📝 Datos del Pago'}
            </DialogTitle>
            <DialogDescription>
              {pasoModal === 'seleccionar'
                ? 'Seleccione el template abierto al que desea agregar una cuota'
                : `Agregando pago a: ${templatesAbiertos.find(t => t.id === templateSeleccionado)?.nombre_referencia}`
              }
            </DialogDescription>
          </DialogHeader>

          {/* Paso 1: Seleccionar template */}
          {pasoModal === 'seleccionar' && (
            <div className="py-4 space-y-3">
              {templatesAbiertos.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  <p>No hay templates abiertos disponibles.</p>
                  <p className="text-xs mt-2">Cree un template con tipo "abierto" primero.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {templatesAbiertos.map(template => (
                    <div
                      key={template.id}
                      onClick={() => setTemplateSeleccionado(template.id)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        templateSeleccionado === template.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                      }`}
                    >
                      {template.cuenta_agrupadora && (
                        <div className="text-xs text-gray-400 mb-0.5">{template.cuenta_agrupadora}</div>
                      )}
                      <div className="font-medium">{template.nombre_referencia}</div>
                      <div className="text-xs text-gray-500">
                        {template.categ}
                        {template.responsable && <span className="ml-2 text-blue-600">• {template.responsable}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Paso 2: Ingresar datos */}
          {pasoModal === 'datos' && (
            <div className="py-4 space-y-4">
              {/* Selector tipo movimiento para templates bidireccionales (FCI, etc.) */}
              {(() => {
                const template = templatesAbiertos.find(t => t.id === templateSeleccionado)
                if (template?.es_bidireccional) {
                  const esFCI = template.categ === 'FCI'
                  return (
                    <div className="space-y-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <Label className="font-semibold">Tipo de Movimiento *</Label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="tipoMovimientoCF"
                            value="egreso"
                            checked={tipoMovimiento === 'egreso'}
                            onChange={() => setTipoMovimiento('egreso')}
                            className="w-4 h-4 text-purple-600"
                          />
                          <span className={tipoMovimiento === 'egreso' ? 'font-medium text-purple-700' : ''}>
                            {esFCI ? '📤 Suscripción' : '📤 Egreso'}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="tipoMovimientoCF"
                            value="ingreso"
                            checked={tipoMovimiento === 'ingreso'}
                            onChange={() => setTipoMovimiento('ingreso')}
                            className="w-4 h-4 text-purple-600"
                          />
                          <span className={tipoMovimiento === 'ingreso' ? 'font-medium text-purple-700' : ''}>
                            {esFCI ? '📥 Rescate' : '📥 Ingreso'}
                          </span>
                        </label>
                      </div>
                      {esFCI && (
                        <p className="text-xs text-purple-600 mt-1">
                          {tipoMovimiento === 'egreso'
                            ? 'Suscripción: Compra de cuotapartes (sale dinero del banco)'
                            : 'Rescate: Venta de cuotapartes (entra dinero al banco)'}
                        </p>
                      )}
                    </div>
                  )
                }
                return null
              })()}

              <div className="space-y-2">
                <Label htmlFor="fecha-pago-cf">Fecha</Label>
                <Input
                  id="fecha-pago-cf"
                  type="date"
                  value={nuevaCuota.fecha}
                  onChange={(e) => setNuevaCuota(prev => ({ ...prev, fecha: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monto-pago-cf">Monto</Label>
                <Input
                  id="monto-pago-cf"
                  type="text"
                  placeholder="0,00"
                  value={nuevaCuota.monto}
                  onChange={(e) => setNuevaCuota(prev => ({ ...prev, monto: e.target.value }))}
                />
              </div>

              {/* Descripción: oculta para FCI (es automática) */}
              {(() => {
                const template = templatesAbiertos.find(t => t.id === templateSeleccionado)
                if (template?.es_bidireccional && template?.categ === 'FCI') {
                  return (
                    <div className="text-xs text-gray-500 italic">
                      Descripción automática: "{tipoMovimiento === 'egreso' ? 'Suscripción' : 'Rescate'} {template.nombre_referencia}"
                    </div>
                  )
                }
                return (
                  <div className="space-y-2">
                    <Label htmlFor="descripcion-pago-cf">Descripción (opcional)</Label>
                    <Input
                      id="descripcion-pago-cf"
                      type="text"
                      placeholder="Descripción del pago..."
                      value={nuevaCuota.descripcion}
                      onChange={(e) => setNuevaCuota(prev => ({ ...prev, descripcion: e.target.value }))}
                    />
                  </div>
                )
              })()}
            </div>
          )}

          <DialogFooter className="gap-2">
            {pasoModal === 'seleccionar' ? (
              <>
                <Button variant="outline" onClick={() => setModalPagoManual(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => setPasoModal('datos')}
                  disabled={!templateSeleccionado}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Siguiente
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setPasoModal('seleccionar')}>
                  Volver
                </Button>
                <Button
                  onClick={guardarPagoManual}
                  disabled={guardandoNuevaCuota || !nuevaCuota.fecha || !nuevaCuota.monto}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {guardandoNuevaCuota ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Pago'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Anticipos (Nuevo + Existentes) */}
      <Dialog open={modalAnticipo} onOpenChange={setModalAnticipo}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>💵 Anticipos</DialogTitle>
            <DialogDescription>
              Registrar anticipos o ver los existentes
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tabAnticipo} onValueChange={setTabAnticipo}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="nuevo">Nuevo Anticipo</TabsTrigger>
              <TabsTrigger value="existentes">
                Anticipos Existentes {anticiposExistentes.length > 0 && `(${anticiposExistentes.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="nuevo">
              <div className="py-4 space-y-4">
                {/* Selector de tipo */}
                <div className="space-y-2">
                  <Label>Tipo de Anticipo *</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tipo-anticipo"
                        value="pago"
                        checked={nuevoAnticipo.tipo === 'pago'}
                        onChange={() => setNuevoAnticipo(prev => ({ ...prev, tipo: 'pago' }))}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="flex items-center gap-1">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        Pago (Egreso)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tipo-anticipo"
                        value="cobro"
                        checked={nuevoAnticipo.tipo === 'cobro'}
                        onChange={() => setNuevoAnticipo(prev => ({ ...prev, tipo: 'cobro' }))}
                        className="w-4 h-4 text-green-600"
                      />
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Cobro (Ingreso)
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anticipo-cuit">CUIT {nuevoAnticipo.tipo === 'cobro' ? 'Cliente' : 'Proveedor'} *</Label>
                  <Input
                    id="anticipo-cuit"
                    type="text"
                    placeholder="30-12345678-9"
                    value={nuevoAnticipo.cuit}
                    onChange={(e) => setNuevoAnticipo(prev => ({ ...prev, cuit: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anticipo-nombre">Nombre {nuevoAnticipo.tipo === 'cobro' ? 'Cliente' : 'Proveedor'} *</Label>
                  <Input
                    id="anticipo-nombre"
                    type="text"
                    placeholder={`Nombre del ${nuevoAnticipo.tipo === 'cobro' ? 'cliente' : 'proveedor'}`}
                    value={nuevoAnticipo.nombre}
                    onChange={(e) => setNuevoAnticipo(prev => ({ ...prev, nombre: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="anticipo-monto">Monto *</Label>
                    <Input
                      id="anticipo-monto"
                      type="text"
                      placeholder="0,00"
                      value={nuevoAnticipo.monto}
                      onChange={(e) => setNuevoAnticipo(prev => ({ ...prev, monto: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anticipo-fecha">Fecha Pago *</Label>
                    <Input
                      id="anticipo-fecha"
                      type="date"
                      value={nuevoAnticipo.fecha}
                      onChange={(e) => setNuevoAnticipo(prev => ({ ...prev, fecha: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anticipo-descripcion">Descripción (opcional)</Label>
                  <Input
                    id="anticipo-descripcion"
                    type="text"
                    placeholder="Motivo del anticipo..."
                    value={nuevoAnticipo.descripcion}
                    onChange={(e) => setNuevoAnticipo(prev => ({ ...prev, descripcion: e.target.value }))}
                  />
                </div>

                <div className={`p-3 ${nuevoAnticipo.tipo === 'cobro' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-orange-50 border-orange-200 text-orange-800'} border rounded text-sm`}>
                  💡 <strong>Tip:</strong> {nuevoAnticipo.tipo === 'cobro'
                    ? 'Los anticipos de cobro se mostrarán como CRÉDITOS en el Cash Flow. Cuando desarrollemos la sección Ventas, se vincularán automáticamente.'
                    : 'Cuando importes una factura del mismo CUIT, el sistema aplicará automáticamente este anticipo al monto a abonar.'}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setModalAnticipo(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={guardarAnticipo}
                    disabled={guardandoAnticipo || !nuevoAnticipo.cuit || !nuevoAnticipo.nombre || !nuevoAnticipo.monto || !nuevoAnticipo.fecha}
                    className={nuevoAnticipo.tipo === 'cobro' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}
                  >
                    {guardandoAnticipo ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      `Registrar Anticipo de ${nuevoAnticipo.tipo === 'cobro' ? 'Cobro' : 'Pago'}`
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="existentes">
              <div className="py-4">
                {cargandoAnticipos ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                    <span className="ml-2 text-sm text-gray-500">Cargando anticipos...</span>
                  </div>
                ) : anticiposExistentes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay anticipos registrados
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-2 py-2 text-left">Fecha</th>
                          <th className="px-2 py-2 text-left">Tipo</th>
                          <th className="px-2 py-2 text-left">Proveedor</th>
                          <th className="px-2 py-2 text-left">CUIT</th>
                          <th className="px-2 py-2 text-right">Monto</th>
                          <th className="px-2 py-2 text-right">Restante</th>
                          <th className="px-2 py-2 text-center">Pago</th>
                          <th className="px-2 py-2 text-center">Vinculación</th>
                          <th className="px-2 py-2 text-left">Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anticiposExistentes.map((a) => (
                          <tr key={a.id} className="border-b hover:bg-gray-50">
                            <td className="px-2 py-2 whitespace-nowrap">
                              {a.fecha_pago ? new Date(a.fecha_pago + 'T12:00:00').toLocaleDateString('es-AR') : '-'}
                            </td>
                            <td className="px-2 py-2">
                              <Badge variant="outline" className={a.tipo === 'cobro' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}>
                                {a.tipo === 'cobro' ? 'Cobro' : 'Pago'}
                              </Badge>
                            </td>
                            <td className="px-2 py-2">{a.nombre_proveedor}</td>
                            <td className="px-2 py-2 text-xs">{a.cuit_proveedor}</td>
                            <td className="px-2 py-2 text-right whitespace-nowrap">
                              ${Number(a.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-2 text-right whitespace-nowrap">
                              ${Number(a.monto_restante).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Select
                                value={a.estado_pago || 'pendiente'}
                                onValueChange={(val) => cambiarEstadoPagoAnticipo(a.id, val)}
                              >
                                <SelectTrigger className="h-7 text-xs w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ESTADOS_ANTICIPO.map((e) => (
                                    <SelectItem key={e.value} value={e.value}>
                                      <Badge variant="outline" className={`${e.color} text-xs`}>{e.label}</Badge>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Badge variant="outline" className={
                                a.estado === 'vinculado' ? 'bg-green-50 text-green-700' :
                                a.estado === 'parcial' ? 'bg-blue-50 text-blue-700' :
                                'bg-yellow-50 text-yellow-700'
                              }>
                                {a.estado === 'vinculado' ? 'Vinculado' :
                                 a.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                              </Badge>
                            </td>
                            <td className="px-2 py-2 text-xs text-gray-600 max-w-[200px] truncate">
                              {a.descripcion || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal SICORE - Anticipo de pago */}
      <Dialog open={mostrarModalSicoreAnticipo} onOpenChange={(open) => { if (!open) cerrarModalSicoreAnticipo() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🏛️ Retención SICORE — Anticipo de Pago</DialogTitle>
            <DialogDescription>
              Anticipo registrado. ¿Desea aplicar retención de ganancias?
            </DialogDescription>
          </DialogHeader>

          {/* PASO: pregunta */}
          {pasoSicoreAnticipo === 'pregunta' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800 mb-3">Mínimos por categoría (primera retención en quincena):</p>
                <div className="space-y-1">
                  {tiposSicore.map(t => (
                    <div key={t.id} className="flex justify-between text-sm">
                      <span>{t.emoji} {t.tipo}</span>
                      <span className="text-gray-600">${t.minimo_no_imponible.toLocaleString('es-AR')} — {(t.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => setPasoSicoreAnticipo('tipo')}>
                  ✅ Sí, aplicar retención
                </Button>
                <Button variant="outline" className="flex-1" onClick={cerrarModalSicoreAnticipo}>
                  No, continuar sin retención
                </Button>
              </div>
            </div>
          )}

          {/* PASO: tipo */}
          {pasoSicoreAnticipo === 'tipo' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Seleccione el tipo de operación:</p>
              {tiposSicore.map(tipo => (
                <Button key={tipo.id} variant="outline"
                  className="w-full h-auto p-3 flex items-center justify-between"
                  onClick={() => { setTipoSicoreAnticipo(tipo); setPasoSicoreAnticipo('campos') }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{tipo.emoji}</span>
                    <div className="text-left">
                      <div className="font-medium">{tipo.tipo}</div>
                      <div className="text-xs text-gray-500">Mín: ${tipo.minimo_no_imponible.toLocaleString('es-AR')} · {(tipo.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}%</div>
                    </div>
                  </div>
                </Button>
              ))}
              <Button variant="ghost" className="w-full" onClick={() => setPasoSicoreAnticipo('pregunta')}>← Volver</Button>
            </div>
          )}

          {/* PASO: campos */}
          {pasoSicoreAnticipo === 'campos' && tipoSicoreAnticipo && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Ingrese los importes de la factura:</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'neto_gravado', label: 'Neto Gravado' },
                  { key: 'neto_no_gravado', label: 'Neto No Gravado' },
                  { key: 'op_exentas', label: 'Op. Exentas' },
                  { key: 'iva', label: 'IVA' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={camposSicore[key as keyof typeof camposSicore]}
                      onChange={e => setCamposSicore(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded p-3 text-sm flex justify-between">
                <span className="font-medium">Importe Total (calculado):</span>
                <span className="font-bold">
                  ${([camposSicore.neto_gravado, camposSicore.neto_no_gravado, camposSicore.op_exentas, camposSicore.iva]
                    .reduce((sum, v) => sum + (parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0), 0))
                    .toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => calcularSicoreAnticipo(tipoSicoreAnticipo)}
                  disabled={!(parseFloat(camposSicore.neto_gravado.replace(/\./g, '').replace(',', '.')) > 0)}
                >
                  Calcular SICORE →
                </Button>
                <Button variant="ghost" onClick={() => setPasoSicoreAnticipo('tipo')}>← Volver</Button>
              </div>
            </div>
          )}

          {/* PASO: calculo */}
          {pasoSicoreAnticipo === 'calculo' && tipoSicoreAnticipo && datosSicoreAnticipo && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-3">{tipoSicoreAnticipo.emoji} {tipoSicoreAnticipo.tipo}</h3>
                {datosSicoreAnticipo.esRetencionAdicional && (
                  <div className="bg-yellow-100 text-yellow-800 text-xs p-2 rounded mb-3">
                    ⚠️ Retención adicional en quincena — no se aplica mínimo no imponible
                  </div>
                )}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Neto base:</span><span>${datosSicoreAnticipo.netoBase.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">No imponible:</span><span>-${datosSicoreAnticipo.minimoAplicado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Base imponible:</span><span>${datosSicoreAnticipo.baseImponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">% Retención:</span><span>{(tipoSicoreAnticipo.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}%</span></div>
                  <hr className="my-2"/>
                  <div className="flex justify-between font-semibold"><span>Retención SICORE:</span><span className="text-red-600">${montoSicoreAnticipo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                  {descuentoSicoreAnticipo > 0 && (
                    <div className="flex justify-between"><span className="text-gray-600">Descuento adicional:</span><span className="text-red-600">-${descuentoSicoreAnticipo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-gray-600">Importe total factura:</span><span>${datosSicoreAnticipo.impTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                  <hr className="my-2"/>
                  <div className="flex justify-between text-lg font-bold"><span>Monto a pagar:</span><span className="text-green-600">${(datosSicoreAnticipo.impTotal - montoSicoreAnticipo - descuentoSicoreAnticipo).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button className="bg-green-600 hover:bg-green-700" onClick={confirmarSicoreAnticipo}>✅ Confirmar</Button>
                <Button variant="outline" onClick={() => {
                  const v = prompt('Nuevo monto descuento adicional:', '0')
                  if (v !== null) setDescuentoSicoreAnticipo(parseFloat(v) || 0)
                }}>💰 Descuento adicional</Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  const v = prompt('Nuevo monto retención:', montoSicoreAnticipo.toString())
                  if (v !== null) setMontoSicoreAnticipo(parseFloat(v) || 0)
                }}>📝 Cambiar retención</Button>
                <Button variant="ghost" onClick={cerrarModalSicoreAnticipo}>❌ Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal SICORE - Facturas ARCA desde Cash Flow */}
      <Dialog open={mostrarModalSicore} onOpenChange={(open) => { if (!open) cancelarSicoreCF(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🏛️ Retención SICORE - Ganancias</DialogTitle>
            <DialogDescription>
              {facturaEnProceso ? `${facturaEnProceso.nombre_proveedor} · CUIT ${facturaEnProceso.cuit_proveedor}` : ''}
            </DialogDescription>
          </DialogHeader>

          {pasoSicore === 'tipo' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
                <div className="font-medium text-blue-800">Mínimos por tipo de operación (primera retención quincena):</div>
                {tiposSicore.map(t => (
                  <div key={t.id} className="text-blue-700">
                    {t.emoji} {t.tipo}: ${t.minimo_no_imponible.toLocaleString('es-AR')} · {(t.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}%
                  </div>
                ))}
              </div>
              <div className="font-medium text-gray-700">Seleccioná el tipo de operación:</div>
              <div className="grid grid-cols-2 gap-2">
                {tiposSicore.map(tipo => (
                  <button
                    key={tipo.id}
                    onClick={() => facturaEnProceso && calcularRetencionSicoreCF(facturaEnProceso, tipo)}
                    className="flex flex-col items-center p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-2xl">{tipo.emoji}</span>
                    <span className="text-sm font-medium">{tipo.tipo}</span>
                    <span className="text-xs text-gray-500">{(tipo.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}%</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => cancelarSicoreCF(true)}>
                  Continuar sin retención
                </Button>
                <Button variant="outline" onClick={() => cancelarSicoreCF(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {pasoSicore === 'calculo' && tipoSeleccionado && facturaEnProceso && datosSicoreCalculo && (() => {
            const esUSD = facturaEnProceso.moneda === 'USD' || (facturaEnProceso.tipo_cambio ?? 1) > 1.01
            const tc = facturaEnProceso.tc_pago ?? facturaEnProceso.tipo_cambio ?? 1
            const impTotalPesos = (facturaEnProceso.imp_total || 0) * tc
            const saldoPesos = impTotalPesos - montoRetencion - descuentoAdicional
            return (
            <div className="space-y-4">
              {esUSD && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-center gap-1">
                  💵 Factura USD · TC de pago: <strong>${tc.toLocaleString('es-AR')}</strong> · Montos en ARS
                </div>
              )}
              <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Neto base{esUSD ? ' (ARS)' : ''}:</span><span>${datosSicoreCalculo.netoFactura.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                {datosSicoreCalculo.minimoAplicado > 0 && (
                  <div className="flex justify-between"><span className="text-gray-600">No imponible:</span><span>-${datosSicoreCalculo.minimoAplicado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                )}
                <div className="flex justify-between"><span className="text-gray-600">Base imponible:</span><span>${datosSicoreCalculo.baseImponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">% Retención ({tipoSeleccionado.tipo}):</span><span>{(tipoSeleccionado.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}%</span></div>
                {datosSicoreCalculo.esRetencionAdicional && (
                  <div className="text-xs text-amber-600 font-medium">⚠️ Retención adicional en la quincena (sin descuento mínimo)</div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Monto retención{esUSD ? ' (ARS)' : ''}:</label>
                <input
                  type="text"
                  placeholder="0,00"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={montoRetencion === 0 ? '' : String(montoRetencion).replace('.', ',')}
                  onChange={e => setMontoRetencion(parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Descuento adicional{esUSD ? ' (ARS)' : ''}:</label>
                <input
                  type="text"
                  placeholder="0,00"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={descuentoAdicional === 0 ? '' : String(descuentoAdicional).replace('.', ',')}
                  onChange={e => setDescuentoAdicional(parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0)}
                />
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <div className="flex justify-between font-bold text-base">
                  <span>Saldo a pagar{esUSD ? ' (ARS)' : ''}:</span>
                  <span className="text-green-700">
                    ${saldoPesos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {esUSD && (
                  <div className="text-xs text-gray-500 text-right mt-0.5">
                    ≈ USD {(saldoPesos / tc).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={finalizarProcesoSicoreCF}>
                  ✅ Confirmar y pasar a Pagar
                </Button>
                <Button variant="outline" onClick={() => setPasoSicore('tipo')}>
                  ← Tipo
                </Button>
                <Button variant="outline" onClick={() => cancelarSicoreCF(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal confirmación cambio quincena al pasar a 'pagado' */}
      <Dialog open={!!confirmCambioQuincena} onOpenChange={(open) => { if (!open) setConfirmCambioQuincena(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🗓️ Cambio de Quincena SICORE</DialogTitle>
            <DialogDescription>
              La fecha de pago corresponde a una quincena diferente a la registrada.
            </DialogDescription>
          </DialogHeader>
          {confirmCambioQuincena && (
            <div className="space-y-4">
              <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Quincena registrada:</span>
                  <span className="font-medium line-through text-red-500">{confirmCambioQuincena.quincenaAnterior}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Quincena por fecha:</span>
                  <span className="font-semibold text-green-700">{confirmCambioQuincena.quincenahNueva}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">¿Actualizar la quincena SICORE a <strong>{confirmCambioQuincena.quincenahNueva}</strong>?</p>
              <div className="flex gap-2">
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={async () => {
                  await supabase.schema('msa').from('comprobantes_arca')
                    .update({ sicore: confirmCambioQuincena.quincenahNueva })
                    .eq('id', confirmCambioQuincena.filaId)
                  toast.success(`Quincena actualizada a ${confirmCambioQuincena.quincenahNueva}`)
                  setConfirmCambioQuincena(null)
                  cargarDatos()
                }}>
                  Sí, actualizar
                </Button>
                <Button variant="outline" onClick={() => setConfirmCambioQuincena(null)}>
                  No, mantener {confirmCambioQuincena.quincenaAnterior}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}