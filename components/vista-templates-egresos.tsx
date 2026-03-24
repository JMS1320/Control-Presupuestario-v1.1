"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Settings2, FileText, Info, Eye, EyeOff, Plus, X, Filter, Edit3, Save, XCircle, TestTube, Check, RefreshCw } from "lucide-react"
import { CategCombobox } from "@/components/ui/categ-combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCuentasContables } from "@/hooks/useCuentasContables"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { TemplateTestSuite } from "@/components/template-test-suite"
import { usePropagacionCuotas } from "@/hooks/usePropagacionCuotas"
import { usePagoAnual } from "@/hooks/usePagoAnual"
import { usePagoCuotas } from "@/hooks/usePagoCuotas"
import useInlineEditor, { CeldaEnEdicion } from "@/hooks/useInlineEditor"
import { es } from "date-fns/locale"
import { WizardTemplatesEgresos } from "./wizard-templates-egresos"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VistaTemplatesAgrupada } from "./vista-templates-agrupada"

interface CuotaEgresoSinFactura {
  id: string
  egreso_id: string
  fecha_estimada: string
  fecha_vencimiento: string | null
  monto: number
  descripcion: string | null
  estado: string
  created_at: string
  updated_at: string
  egreso?: {
    id: string
    template_master_id: string | null
    categ: string
    centro_costo: string | null
    nombre_referencia: string
    responsable: string | null
    cuit_quien_cobra: string | null
    nombre_quien_cobra: string | null
    tipo_recurrencia: string
    configuracion_reglas: any
    año: number
    activo: boolean
    grupo_impuesto_id: string | null
    tipo_template: string | null  // 'fijo' | 'abierto'
    created_at: string
    updated_at: string
  }
}

// Configuración de columnas disponibles - TODAS VISIBLES por defecto excepto algunas técnicas
const COLUMNAS_CONFIG = {
  fecha_estimada: { label: "Fecha Estimada", visible: true, width: "130px" },
  fecha_vencimiento: { label: "Fecha Vencimiento", visible: true, width: "150px" },
  monto: { label: "Monto", visible: true, width: "130px" },
  descripcion: { label: "Descripción", visible: true, width: "200px" },
  estado: { label: "Estado", visible: true, width: "100px" },
  // Campos del egreso padre
  categ: { label: "CATEG", visible: true, width: "120px" },
  centro_costo: { label: "Centro Costo", visible: true, width: "120px" },
  nombre_referencia: { label: "Nombre Referencia", visible: true, width: "180px" },
  responsable: { label: "Responsable", visible: true, width: "150px" },
  cuit_quien_cobra: { label: "CUIT Quien Cobra", visible: true, width: "140px" },
  nombre_quien_cobra: { label: "Nombre Quien Cobra", visible: true, width: "180px" },
  tipo_recurrencia: { label: "Tipo Recurrencia", visible: true, width: "130px" },
  año: { label: "Año", visible: true, width: "80px" },
  activo: { label: "Activo", visible: true, width: "80px" },
  // Campos técnicos ocultos por defecto
  egreso_id: { label: "Egreso ID", visible: false, width: "120px" },
  template_master_id: { label: "Template Master ID", visible: false, width: "150px" },
  configuracion_reglas: { label: "Config. Reglas", visible: false, width: "150px" },
  created_at: { label: "Creado", visible: false, width: "150px" },
  updated_at: { label: "Actualizado", visible: false, width: "150px" }
} as const

export function VistaTemplatesEgresos() {
  const [cuotas, setCuotas] = useState<CuotaEgresoSinFactura[]>([])
  const [cuotasOriginales, setCuotasOriginales] = useState<CuotaEgresoSinFactura[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarWizard, setMostrarWizard] = useState(false)
  
  // Hook para validación de categorías
  const { cuentas, validarCateg, buscarSimilares, crearCuentaContable } = useCuentasContables()
  
  // Hooks para procesos reusables Templates
  const { propagando, ejecutarPropagacion, confirmarPropagacion } = usePropagacionCuotas()
  const { procesando, ejecutarPagoAnual, confirmarPagoAnual } = usePagoAnual()
  const { procesando: procesandoCuotas, ejecutarPagoCuotas, confirmarPagoCuotas } = usePagoCuotas()
  
  // Estados para filtros
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [busquedaResponsable, setBusquedaResponsable] = useState('')
  const [busquedaNombreReferencia, setBusquedaNombreReferencia] = useState('')
  const [busquedaDescripcion, setBusquedaDescripcion] = useState('')
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('todos')
  const [montoMinimo, setMontoMinimo] = useState('')
  const [montoMaximo, setMontoMaximo] = useState('')
  const [busquedaCateg, setBusquedaCateg] = useState('')
  const [tipoRecurrenciaSeleccionado, setTipoRecurrenciaSeleccionado] = useState('todos')
  const [anoSeleccionado, setAnoSeleccionado] = useState('todos')
  const [filtroActivacion, setFiltroActivacion] = useState<'activos' | 'inactivos' | 'todos'>('activos')
  const [mostrarDesactivados, setMostrarDesactivados] = useState(false)
  
  // Estados para edición inline
  const [modoEdicion, setModoEdicion] = useState(false)
  const [celdaEnEdicion, setCeldaEnEdicion] = useState<{
    cuotaId: string
    columna: string
    valor: any
  } | null>(null)
  
  // Estado para modal validación categorías
  const [validandoCateg, setValidandoCateg] = useState<{
    isOpen: boolean
    categIngresado: string
    celdaEnEdicion: {cuotaId: string, columna: string, valor: any} | null
  }>({
    isOpen: false,
    categIngresado: '',
    celdaEnEdicion: null
  })

  // Estado para modal propagación de cuotas (fix bucle + 3 opciones)
  const [modalPropagacion, setModalPropagacion] = useState<{
    isOpen: boolean
    cuotaId: string
    nuevoMonto: number
    datosEdicion: {cuotaId: string, columna: string, valor: any} | null
  }>({
    isOpen: false,
    cuotaId: '',
    nuevoMonto: 0,
    datosEdicion: null
  })
  const [montoPropagacionPersonalizado, setMontoPropagacionPersonalizado] = useState('')
  const [guardandoEnProgreso, setGuardandoEnProgreso] = useState(false)

  // Estado para modal Pago Manual (templates abiertos)
  const [modalPagoManual, setModalPagoManual] = useState(false)
  const [templatesAbiertos, setTemplatesAbiertos] = useState<{id: string, nombre_referencia: string, categ: string, cuenta_agrupadora: string | null, es_bidireccional: boolean, responsable: string}[]>([])
  const [templateSeleccionado, setTemplateSeleccionado] = useState<string | null>(null)
  const [pasoModal, setPasoModal] = useState<'seleccionar' | 'datos'>('seleccionar')
  const [tipoMovimiento, setTipoMovimiento] = useState<'egreso' | 'ingreso'>('egreso')
  const [nuevaCuota, setNuevaCuota] = useState({
    fecha: '',
    monto: '',
    descripcion: ''
  })
  const [guardandoNuevaCuota, setGuardandoNuevaCuota] = useState(false)
  
  // Estados para edición masiva
  const [modoEdicionMasiva, setModoEdicionMasiva] = useState(false)
  const [cuotasSeleccionadasMasiva, setCuotasSeleccionadasMasiva] = useState<Set<string>>(new Set())
  const [nuevoEstadoMasivo, setNuevoEstadoMasivo] = useState('')
  const [modalConversionMasiva, setModalConversionMasiva] = useState(false)
  const [procesandoConversion, setProcesandoConversion] = useState(false)
  const [resultadosConversion, setResultadosConversion] = useState<Array<{nombre: string, ok: boolean, msg: string}>>([])

  // Estado para columnas visibles con valores por defecto
  const [columnasVisibles, setColumnasVisibles] = useState<Record<string, boolean>>(() => {
    // Intentar cargar desde localStorage
    const saved = localStorage.getItem('templates-egresos-columnas-visibles')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // Si hay error, usar valores por defecto
      }
    }
    return Object.fromEntries(
      Object.entries(COLUMNAS_CONFIG).map(([key, config]) => [key, config.visible])
    )
  })

  // Estado para anchos de columnas personalizables con persistencia
  const [anchosColumnas, setAnchosColumnas] = useState<Record<string, string>>(() => {
    // Intentar cargar desde localStorage
    const saved = localStorage.getItem('templates-egresos-anchos-columnas')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // Si hay error, usar valores por defecto
      }
    }
    return Object.fromEntries(
      Object.entries(COLUMNAS_CONFIG).map(([key, config]) => [key, config.width])
    )
  })

  // Guardar cambios de columnas visibles en localStorage
  useEffect(() => {
    localStorage.setItem('templates-egresos-columnas-visibles', JSON.stringify(columnasVisibles))
  }, [columnasVisibles])

  // Guardar cambios de anchos en localStorage
  useEffect(() => {
    localStorage.setItem('templates-egresos-anchos-columnas', JSON.stringify(anchosColumnas))
  }, [anchosColumnas])

  // Cargar cuotas de egresos sin factura desde Supabase
  const cargarCuotas = async () => {
    try {
      setLoading(true)
      setError(null)
      
      let query = supabase
        .from('cuotas_egresos_sin_factura')
        .select(`
          *,
          egreso:egresos_sin_factura(*)
        `)
        
      // Filtrar según mostrarDesactivados
      if (!mostrarDesactivados) {
        query = query.neq('estado', 'desactivado')
      }
      
      const { data, error: supabaseError } = await query
        .order('fecha_estimada', { ascending: false })

      if (supabaseError) {
        console.error('Error al cargar cuotas:', supabaseError)
        setError(`Error al cargar cuotas: ${supabaseError.message}`)
        return
      }

      const cuotasCargadas = data || []
      setCuotas(cuotasCargadas)
      setCuotasOriginales(cuotasCargadas)
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al cargar las cuotas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarCuotas()
  }, [mostrarDesactivados])

  // Función edición masiva de cuotas templates
  const ejecutarEdicionMasivaCuotas = async () => {
    if (cuotasSeleccionadasMasiva.size === 0) {
      alert('Selecciona al menos una cuota')
      return
    }

    if (!nuevoEstadoMasivo) {
      alert('Selecciona un estado para aplicar')
      return
    }

    try {
      const cuotasIds = Array.from(cuotasSeleccionadasMasiva)
      const LOTE_SIZE = 20

      console.log('🔄 Ejecutando edición masiva cuotas templates:', {
        cuotas: cuotasIds.length,
        nuevoEstado: nuevoEstadoMasivo
      })

      for (let i = 0; i < cuotasIds.length; i += LOTE_SIZE) {
        const lote = cuotasIds.slice(i, i + LOTE_SIZE)

        const { error } = await supabase
          .from('cuotas_egresos_sin_factura')
          .update({ estado: nuevoEstadoMasivo })
          .in('id', lote)

        if (error) {
          throw new Error(`Error en lote ${Math.floor(i/LOTE_SIZE) + 1}: ${error.message}`)
        }
      }

      // Limpiar selecciones y recargar
      setCuotasSeleccionadasMasiva(new Set())
      setNuevoEstadoMasivo('')
      setModoEdicionMasiva(false)

      await cargarCuotas()

      alert(`✅ Edición masiva completada: ${cuotasIds.length} cuotas actualizadas a estado "${nuevoEstadoMasivo}"`)
    } catch (error) {
      console.error('Error en edición masiva cuotas:', error)
      alert('Error en edición masiva: ' + (error as Error).message)
    }
  }

  // Conversión masiva Anual → Cuotas
  const cuotasSeleccionadasArray = cuotas.filter(c => cuotasSeleccionadasMasiva.has(c.id))
  const todasSonAnuales = cuotasSeleccionadasArray.length > 0 &&
    cuotasSeleccionadasArray.every(c => c.egreso?.nombre_referencia?.toLowerCase().includes('anual'))
  const tienenGrupoImpuesto = cuotasSeleccionadasArray.every(c => !!c.egreso?.grupo_impuesto_id)
  const puedeConvertirMasivo = todasSonAnuales && tienenGrupoImpuesto

  const ejecutarConversionMasiva = async () => {
    setProcesandoConversion(true)
    setResultadosConversion([])
    // Deduplicar por grupo_impuesto_id (puede haber varias cuotas del mismo template anual)
    const gruposMap = new Map<string, CuotaEgresoSinFactura>()
    for (const c of cuotasSeleccionadasArray) {
      const gid = c.egreso?.grupo_impuesto_id
      if (gid && !gruposMap.has(gid)) gruposMap.set(gid, c)
    }
    const resultados: Array<{nombre: string, ok: boolean, msg: string}> = []
    for (const [gid, cuota] of gruposMap) {
      const res = await ejecutarPagoCuotas({
        templateId: cuota.egreso_id,
        cuotaId: cuota.id,
        grupoImpuestoId: gid
      })
      resultados.push({
        nombre: cuota.egreso?.nombre_referencia || gid,
        ok: res.success,
        msg: res.success
          ? `✅ Cuotas activadas: ${res.cuotasActivadas}`
          : `❌ ${res.error}`
      })
    }
    setResultadosConversion(resultados)
    setProcesandoConversion(false)
    if (resultados.every(r => r.ok)) {
      setCuotasSeleccionadasMasiva(new Set())
      await cargarCuotas()
    }
  }

  // Actualizar valor localmente sin recargar desde BD
  const actualizarCuotaLocal = (filaId: string, campo: string, valor: any) => {
    setCuotas(prev => prev.map(c =>
      c.id === filaId ? { ...c, [campo]: valor } : c
    ))
  }

  // Hook unificado (DESPUÉS de cargarCuotas para evitar error inicialización)
  const hookEditor = useInlineEditor({
    onLocalUpdate: (filaId, campo, valor, updateData) => {
      Object.entries(updateData).forEach(([key, val]) => {
        actualizarCuotaLocal(filaId, key, val)
      })
    },
    onError: (error) => console.error('Hook error Templates:', error)
  })

  // Formatear valores numéricos
  const formatearNumero = (valor: number): string => {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor)
  }

  // Formatear fecha - enfoque directo sin conversión de zona horaria
  const formatearFecha = (fecha: string): string => {
    try {
      // Si viene en formato YYYY-MM-DD, parsearlo directamente
      if (fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [año, mes, dia] = fecha.split('-').map(Number)
        const fechaLocal = new Date(año, mes - 1, dia) // mes - 1 porque Date() usa 0-11
        return format(fechaLocal, 'dd/MM/yyyy', { locale: es })
      }
      // Fallback para otros formatos
      return format(new Date(fecha), 'dd/MM/yyyy', { locale: es })
    } catch {
      return fecha
    }
  }

  // Funciones para filtros
  const aplicarFiltros = () => {
    let cuotasFiltradas = [...cuotasOriginales]
    
    // Filtro por fecha estimada
    if (fechaDesde) {
      cuotasFiltradas = cuotasFiltradas.filter(c => c.fecha_estimada >= fechaDesde)
    }
    if (fechaHasta) {
      cuotasFiltradas = cuotasFiltradas.filter(c => c.fecha_estimada <= fechaHasta)
    }
    
    // Filtro por responsable
    if (busquedaResponsable.trim()) {
      const busqueda = busquedaResponsable.toLowerCase()
      cuotasFiltradas = cuotasFiltradas.filter(c => 
        c.egreso?.responsable?.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por nombre de referencia
    if (busquedaNombreReferencia.trim()) {
      const busqueda = busquedaNombreReferencia.toLowerCase()
      cuotasFiltradas = cuotasFiltradas.filter(c => 
        c.egreso?.nombre_referencia?.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por descripción
    if (busquedaDescripcion.trim()) {
      const busqueda = busquedaDescripcion.toLowerCase()
      cuotasFiltradas = cuotasFiltradas.filter(c => 
        c.descripcion?.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por estado
    if (estadoSeleccionado && estadoSeleccionado !== 'todos') {
      cuotasFiltradas = cuotasFiltradas.filter(c => c.estado === estadoSeleccionado)
    }
    
    // Filtro por rango de montos
    if (montoMinimo) {
      const minimo = parseFloat(montoMinimo)
      cuotasFiltradas = cuotasFiltradas.filter(c => c.monto >= minimo)
    }
    if (montoMaximo) {
      const maximo = parseFloat(montoMaximo)
      cuotasFiltradas = cuotasFiltradas.filter(c => c.monto <= maximo)
    }
    
    // Filtro por CATEG
    if (busquedaCateg.trim()) {
      const busqueda = busquedaCateg.toLowerCase()
      cuotasFiltradas = cuotasFiltradas.filter(c => 
        c.egreso?.categ?.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por tipo de recurrencia
    if (tipoRecurrenciaSeleccionado && tipoRecurrenciaSeleccionado !== 'todos') {
      cuotasFiltradas = cuotasFiltradas.filter(c => 
        c.egreso?.tipo_recurrencia === tipoRecurrenciaSeleccionado
      )
    }
    
    // Filtro por año
    if (anoSeleccionado && anoSeleccionado !== 'todos') {
      const ano = parseInt(anoSeleccionado)
      cuotasFiltradas = cuotasFiltradas.filter(c => c.egreso?.año === ano)
    }
    
    // Filtro por activación de templates
    if (filtroActivacion === 'activos') {
      cuotasFiltradas = cuotasFiltradas.filter(c => c.egreso?.activo === true)
    } else if (filtroActivacion === 'inactivos') {
      cuotasFiltradas = cuotasFiltradas.filter(c => c.egreso?.activo === false)
    }
    // Si es 'todos', no se filtra
    
    setCuotas(cuotasFiltradas)
  }
  
  const limpiarFiltros = () => {
    setFechaDesde('')
    setFechaHasta('')
    setBusquedaResponsable('')
    setBusquedaNombreReferencia('')
    setBusquedaDescripcion('')
    setEstadoSeleccionado('todos')
    setMontoMinimo('')
    setMontoMaximo('')
    setBusquedaCateg('')
    setTipoRecurrenciaSeleccionado('todos')
    setAnoSeleccionado('todos')
    setSoloActivos(false)
    setCuotas(cuotasOriginales)
  }
  
  // Obtener valores únicos para los selectores
  const estadosUnicos = [...new Set(cuotasOriginales.map(c => c.estado))].filter(Boolean).sort()
  const tiposRecurrenciaUnicos = [...new Set(cuotasOriginales.map(c => c.egreso?.tipo_recurrencia))].filter(Boolean).sort()
  const anosUnicos = [...new Set(cuotasOriginales.map(c => c.egreso?.año))].filter(Boolean).sort((a, b) => b - a)

  // Definir campos editables para templates - incluye cuotas y egresos padre
  const camposEditables = [
    'fecha_estimada', 'fecha_vencimiento', 'monto', 'descripcion', 'estado',
    'categ', 'centro_costo', 'responsable', 'nombre_quien_cobra', 'cuit_quien_cobra'
  ]

  // Funciones para edición inline
  const iniciarEdicion = (cuotaId: string, columna: string, valor: any, event: React.MouseEvent) => {
    console.log('🔍 Templates iniciarEdicion called:', columna, 'ctrlKey:', event.ctrlKey, 'modoEdicion:', modoEdicion)
    
    const cuota = cuotas.find(c => c.id === cuotaId)
    const nombreTemplate = cuota?.egreso?.nombre_referencia?.toLowerCase() || ''
    const esTemplateAnual = nombreTemplate.includes('anual')
    const esTemplateCuotas = nombreTemplate.includes('cuota')

    // Ctrl+Shift+Click en monto = Conversión bidireccional Anual ↔ Cuotas
    // Si es template Anual → convertir a Cuotas
    // Si es template Cuotas → convertir a Anual
    if (event.ctrlKey && event.shiftKey && columna === 'monto' && modoEdicion) {
      event.preventDefault()
      if (esTemplateAnual) {
        // Template Anual activo → quiere cambiar a Cuotas
        activarPagoCuotas(cuotaId)
      } else if (esTemplateCuotas) {
        // Template Cuotas activo → quiere cambiar a Anual
        activarPagoAnual(cuotaId)
      } else {
        alert('❌ Este template no tiene par Anual/Cuotas.\nEl nombre debe contener "Anual" o "Cuota".')
      }
      return
    }
    
    // Ctrl+Click normal = Edición inline
    if (!event.ctrlKey || !modoEdicion) return
    
    event.preventDefault()
    event.stopPropagation()
    
    // APPROACH HÍBRIDO: Usar hook solo para fechas (migración gradual)
    if (['fecha_estimada', 'fecha_vencimiento'].includes(columna)) {
      console.log('🔄 Templates: Usando hook para fecha:', columna)
      // Convertir fecha BD (YYYY-MM-DD) a formato input date
      let valorFormateado = valor || ''
      if (['fecha_estimada', 'fecha_vencimiento'].includes(columna) && valor) {
        // Si viene fecha de BD (YYYY-MM-DD), mantener ese formato para input type="date"
        valorFormateado = String(valor).includes('-') ? valor : valor
        console.log('🗓️ Templates iniciarEdicion valor original:', valor, '→ formateado:', valorFormateado)
      }
      
      const celdaHook: CeldaEnEdicion = {
        filaId: cuotaId,
        columna,
        valor: valorFormateado,
        tableName: 'cuotas_egresos_sin_factura',
        origen: 'TEMPLATE'
      }
      hookEditor.iniciarEdicion(celdaHook)
    } else {
      // Lógica original para otros campos
      setCeldaEnEdicion({ cuotaId, columna, valor: valor || '' })
    }
  }

  // Función para activar proceso de pago anual (conversión de Cuotas → Anual)
  const activarPagoAnual = async (cuotaId: string) => {
    try {
      // Obtener información del template para mostrar en confirmación
      const cuota = cuotas.find(c => c.id === cuotaId)
      const nombreTemplate = cuota?.egreso?.nombre_referencia || 'Template'
      const grupoImpuestoId = cuota?.egreso?.grupo_impuesto_id || null

      const confirmacion = await confirmarPagoAnual(cuotaId, nombreTemplate, grupoImpuestoId)

      if (confirmacion.confirmed && confirmacion.grupoImpuestoId) {
        const resultado = await ejecutarPagoAnual({
          templateId: cuota?.egreso_id || '',
          cuotaId: cuotaId,
          grupoImpuestoId: confirmacion.grupoImpuestoId
        })

        if (resultado.success) {
          alert(`✅ Conversión a PAGO ANUAL completada\n• Template Cuotas desactivado: ${resultado.templateCuotasDesactivado}\n• Template Anual activado: ${resultado.templateAnualActivado}\n• Cuotas desactivadas: ${resultado.cuotasDesactivadas}\n• Cuotas activadas: ${resultado.cuotasActivadas}`)
          // Recargar datos
          await cargarCuotas()
        } else {
          alert(`❌ Error: ${resultado.error}`)
        }
      }
    } catch (error) {
      alert(`Error activando pago anual: ${error}`)
    }
  }

  // Función para activar proceso de pago por cuotas (conversión de Anual → Cuotas)
  const activarPagoCuotas = async (cuotaId: string) => {
    try {
      // Obtener información del template para mostrar en confirmación
      const cuota = cuotas.find(c => c.id === cuotaId)
      const nombreTemplate = cuota?.egreso?.nombre_referencia || 'Template'
      const grupoImpuestoId = cuota?.egreso?.grupo_impuesto_id || null

      const confirmacion = await confirmarPagoCuotas(cuotaId, nombreTemplate, grupoImpuestoId)

      if (confirmacion.confirmed && confirmacion.grupoImpuestoId) {
        const resultado = await ejecutarPagoCuotas({
          templateId: cuota?.egreso_id || '',
          cuotaId: cuotaId,
          grupoImpuestoId: confirmacion.grupoImpuestoId
        })

        if (resultado.success) {
          alert(`✅ Conversión a CUOTAS completada\n• Template Anual desactivado: ${resultado.templateAnualDesactivado}\n• Template Cuotas activado: ${resultado.templateCuotasActivado}\n• Cuotas desactivadas: ${resultado.cuotasDesactivadas}\n• Cuotas activadas: ${resultado.cuotasActivadas}`)
          // Recargar datos
          await cargarCuotas()
        } else {
          alert(`❌ Error: ${resultado.error}`)
        }
      }
    } catch (error) {
      alert(`Error activando pago por cuotas: ${error}`)
    }
  }

  const cancelarEdicion = () => {
    setCeldaEnEdicion(null)
  }

  const guardarCambio = async (nuevoValor: string) => {
    if (!celdaEnEdicion || guardandoEnProgreso || modalPropagacion.isOpen) return  // Protección anti-rebote

    // Si está editando categ, validar si existe primero
    if (celdaEnEdicion.columna === 'categ') {
      const categIngresado = String(nuevoValor).toUpperCase()
      
      const categExiste = validarCateg(categIngresado)
      
      if (categExiste) {
        // Si existe, guardar directo
        await ejecutarGuardadoRealTemplates(celdaEnEdicion, nuevoValor)
      } else {
        // Si no existe, mostrar modal con opciones
        setValidandoCateg({
          isOpen: true,
          categIngresado: categIngresado,
          celdaEnEdicion: { ...celdaEnEdicion, valor: nuevoValor }
        })
      }
      return
    }

    // Para otros campos, continuar con el guardado normal
    await ejecutarGuardadoRealTemplates(celdaEnEdicion, nuevoValor)
  }

  const ejecutarGuardadoRealTemplates = async (datosEdicion: {cuotaId: string, columna: string, valor: any}, nuevoValor: string) => {
    try {
      let valorFinal: any = nuevoValor
      
      // Convertir valores según el tipo de campo (igual que en ARCA facturas)
      if (['monto'].includes(datosEdicion.columna)) {
        valorFinal = parseFloat(String(valorFinal)) || 0

        // PROCESO ESPECIAL TEMPLATES: Abrir modal para confirmar propagación
        if (valorFinal > 0) {
          // Abrir modal con 3 opciones (el check modalPropagacion.isOpen evita rebote por onBlur)
          setModalPropagacion({
            isOpen: true,
            cuotaId: datosEdicion.cuotaId,
            nuevoMonto: valorFinal,
            datosEdicion: datosEdicion
          })
          return // Salir aquí, el guardado continúa desde el modal
        }
      } else if (['fecha_estimada', 'fecha_vencimiento'].includes(datosEdicion.columna)) {
        // Validar y convertir fechas
        if (valorFinal && !Date.parse(String(valorFinal))) {
          alert('Formato de fecha inválido')
          return
        }
      }
      
      // Preparar objeto de actualización
      let updateData: any = { [datosEdicion.columna]: valorFinal }
      
      // Regla automática: Si se actualiza fecha_vencimiento, actualizar fecha_estimada para coincidir
      if (datosEdicion.columna === 'fecha_vencimiento' && valorFinal) {
        updateData.fecha_estimada = valorFinal
        console.log(`🔄 Auto-actualización Templates: fecha_vencimiento = ${valorFinal} → fecha_estimada = ${valorFinal}`)
      }
      
      // Guardado simple directo en cuotas (igual que ARCA)
      const { error } = await supabase
        .from('cuotas_egresos_sin_factura')
        .update(updateData)
        .eq('id', datosEdicion.cuotaId)

      if (error) {
        console.error('Error actualizando cuota:', error)
        alert('Error al guardar cambio: ' + error.message)
        return
      }

      // Actualización local sin recargar
      Object.entries(updateData).forEach(([key, val]) => {
        actualizarCuotaLocal(datosEdicion.cuotaId, key, val)
      })
      setCeldaEnEdicion(null)

      console.log(`✅ Templates: ${datosEdicion.columna} actualizado`)
    } catch (error) {
      console.error('Error guardando cambio:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  // Funciones para modal propagación (3 opciones)
  const handlePropagacionSi = async () => {
    if (!modalPropagacion.datosEdicion) return
    setGuardandoEnProgreso(true)

    try {
      // Determinar monto a propagar (personalizado o el mismo de la cuota)
      const montoParaPropagar = montoPropagacionPersonalizado
        ? parseFloat(montoPropagacionPersonalizado.replace(/\./g, '').replace(',', '.')) || modalPropagacion.nuevoMonto
        : modalPropagacion.nuevoMonto

      // 1. Propagar a cuotas futuras
      const resultPropagacion = await ejecutarPropagacion({
        templateId: 'template',
        cuotaModificadaId: modalPropagacion.cuotaId,
        nuevoMonto: montoParaPropagar,
        aplicarATodasLasFuturas: true
      })

      // 2. Guardar la cuota actual (siempre con el monto original editado)
      const { error } = await supabase
        .from('cuotas_egresos_sin_factura')
        .update({ monto: modalPropagacion.nuevoMonto })
        .eq('id', modalPropagacion.cuotaId)

      if (error) throw error

      // 3. Recargar y cerrar
      await cargarCuotas()
      setCeldaEnEdicion(null)
      setModalPropagacion({ isOpen: false, cuotaId: '', nuevoMonto: 0, datosEdicion: null })
      setMontoPropagacionPersonalizado('')

      if (resultPropagacion.success && resultPropagacion.cuotasModificadas > 0) {
        const montoMsg = montoParaPropagar !== modalPropagacion.nuevoMonto
          ? ` (con monto $${montoParaPropagar.toLocaleString('es-AR')})`
          : ''
        alert(`✅ Monto actualizado + ${resultPropagacion.cuotasModificadas} cuotas futuras propagadas${montoMsg}`)
      } else {
        alert('✅ Monto actualizado (no había cuotas futuras)')
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setGuardandoEnProgreso(false)
    }
  }

  const handlePropagacionNo = async () => {
    if (!modalPropagacion.datosEdicion) return
    setGuardandoEnProgreso(true)

    try {
      // Solo guardar la cuota actual (sin propagar)
      const { error } = await supabase
        .from('cuotas_egresos_sin_factura')
        .update({ monto: modalPropagacion.nuevoMonto })
        .eq('id', modalPropagacion.cuotaId)

      if (error) throw error

      actualizarCuotaLocal(modalPropagacion.cuotaId, 'monto', modalPropagacion.nuevoMonto)
      setCeldaEnEdicion(null)
      setModalPropagacion({ isOpen: false, cuotaId: '', nuevoMonto: 0, datosEdicion: null })
      setMontoPropagacionPersonalizado('')
      alert('✅ Solo esta cuota actualizada')
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setGuardandoEnProgreso(false)
    }
  }

  const handlePropagacionCancelar = () => {
    // No hacer nada, solo cerrar modal y limpiar edición
    setCeldaEnEdicion(null)
    setModalPropagacion({ isOpen: false, cuotaId: '', nuevoMonto: 0, datosEdicion: null })
    setMontoPropagacionPersonalizado('')
    setGuardandoEnProgreso(false)
  }

  // Cargar templates abiertos para Pago Manual
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

  // Abrir modal Pago Manual
  const abrirModalPagoManual = async () => {
    await cargarTemplatesAbiertos()
    setTemplateSeleccionado(null)
    setPasoModal('seleccionar')
    setTipoMovimiento('egreso')
    setNuevaCuota({ fecha: '', monto: '', descripcion: '' })
    setModalPagoManual(true)
  }

  // Función para guardar pago manual
  const guardarPagoManual = async () => {
    if (!templateSeleccionado || !nuevaCuota.fecha || !nuevaCuota.monto) {
      alert('Debe completar todos los campos')
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
      alert(`${tipoMsg} agregado exitosamente`)
      setModalPagoManual(false)
      setTemplateSeleccionado(null)
      setTipoMovimiento('egreso')
      setNuevaCuota({ fecha: '', monto: '', descripcion: '' })
      await cargarCuotas()
    } catch (error) {
      console.error('Error guardando pago manual:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setGuardandoNuevaCuota(false)
    }
  }

  // Funciones para modal de validación categorías
  const manejarCrearCategoriaTemplates = async () => {
    const categIngresado = validandoCateg.categIngresado
    const cuentaContable = prompt(`Ingrese nombre de cuenta contable para la categoría "${categIngresado}":`)
    const tipo = prompt(`Ingrese tipo para la categoría "${categIngresado}" (ej: egreso, ingreso):`) || 'egreso'
    
    if (cuentaContable && validandoCateg.celdaEnEdicion) {
      const creado = await crearCuentaContable(categIngresado, cuentaContable, tipo)
      if (creado) {
        await ejecutarGuardadoRealTemplates(validandoCateg.celdaEnEdicion, categIngresado)
        setValidandoCateg({ isOpen: false, categIngresado: '', celdaEnEdicion: null })
      }
    }
  }

  const manejarElegirExistenteTemplates = () => {
    const similares = buscarSimilares(validandoCateg.categIngresado)
    if (similares.length > 0) {
      const opciones = similares.map((c, i) => `${i + 1}. ${c.categ} - ${c.cuenta_contable}`).join('\n')
      const seleccion = prompt(`Categorías similares encontradas:\n${opciones}\n\nIngrese el número de la categoría a usar:`)
      const indice = parseInt(seleccion || '0') - 1
      
      if (indice >= 0 && indice < similares.length && validandoCateg.celdaEnEdicion) {
        const categSeleccionada = similares[indice].categ
        ejecutarGuardadoRealTemplates(validandoCateg.celdaEnEdicion, categSeleccionada)
        setValidandoCateg({ isOpen: false, categIngresado: '', celdaEnEdicion: null })
      }
    } else {
      alert('No se encontraron categorías similares')
    }
  }

  const cerrarModalCategTemplates = () => {
    setValidandoCateg({ isOpen: false, categIngresado: '', celdaEnEdicion: null })
    setCeldaEnEdicion(null)
  }

  // Obtener columnas visibles - SOLO las que existen en COLUMNAS_CONFIG
  const columnasVisiblesArray = Object.entries(columnasVisibles)
    .filter(([key, visible]) => visible && key in COLUMNAS_CONFIG)
    .map(([key]) => key)

  // Colores por estado (usado en badges)
  const colorEstado = (estado: string): string => {
    const mapa: Record<string, string> = {
      pendiente:   'bg-gray-100 text-gray-600 border-gray-200',
      debito:      'bg-violet-100 text-violet-800 border-violet-200',
      pagar:       'bg-yellow-100 text-yellow-800 border-yellow-200',
      preparado:   'bg-orange-100 text-orange-800 border-orange-200',
      pagado:      'bg-green-100 text-green-800 border-green-200',
      programado:  'bg-violet-100 text-violet-800 border-violet-200',
      credito:     'bg-gray-100 text-gray-600 border-gray-200',
      conciliado:  'bg-gray-100 text-gray-600 border-gray-200',
      desactivado: 'bg-gray-100 text-gray-400 border-gray-200',
      anterior:    'bg-gray-100 text-gray-600 border-gray-200',
    }
    return mapa[estado] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  }

  // Renderizar valor de celda según el tipo de columna con soporte para edición
  const renderizarCelda = (cuota: CuotaEgresoSinFactura, columna: string) => {
    let valor: any

    // Obtener valor según la columna
    if (['fecha_estimada', 'fecha_vencimiento', 'mes', 'monto', 'descripcion', 'estado', 'created_at', 'updated_at', 'egreso_id'].includes(columna)) {
      valor = cuota[columna as keyof CuotaEgresoSinFactura]
    } else {
      // Campos del egreso padre
      valor = cuota.egreso?.[columna as keyof typeof cuota.egreso]
    }

    // APPROACH HÍBRIDO: Si la celda está en edición del hook (fechas) - ESTRUCTURA ARCA EXACTA
    if (hookEditor.celdaEnEdicion?.filaId === cuota.id && hookEditor.celdaEnEdicion?.columna === columna) {
      return (
        <div className="flex items-center gap-1">
          <Input
            ref={hookEditor.inputRef} // ✅ AUTO-FOCUS del hook
            type="date"
            value={String(hookEditor.celdaEnEdicion?.valor || '')}
            onChange={(e) => hookEditor.setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
            onKeyDown={hookEditor.manejarKeyDown} // ✅ Enter/Escape del hook
            className="h-6 text-xs p-1 w-full"
            disabled={hookEditor.guardandoCambio}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => hookEditor.guardarCambio()}
            disabled={hookEditor.guardandoCambio}
          >
            {hookEditor.guardandoCambio ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => hookEditor.cancelarEdicion()}
            disabled={hookEditor.guardandoCambio}
          >
            <XCircle className="h-3 w-3" />
          </Button>
        </div>
      )
    }

    // Si está en edición esta celda específica (lógica original para otros campos)
    if (celdaEnEdicion?.cuotaId === cuota.id && celdaEnEdicion?.columna === columna) {
      // Manejar edición de estado con dropdown
      if (columna === 'estado') {
        return (
          <div
            className="flex items-center gap-1 min-w-[120px]"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancelarEdicion(); } }}
          >
            <Select
              value={celdaEnEdicion.valor}
              onValueChange={(value) => guardarCambio(value)}
              defaultOpen={true}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="pagar">Pagar</SelectItem>
                <SelectItem value="preparado">Preparado</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
                <SelectItem value="programado">Programado</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="conciliado">Conciliado</SelectItem>
                <SelectItem value="desactivado">Desactivado</SelectItem>
                <SelectItem value="anterior">Anterior</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={cancelarEdicion}
            >
              <XCircle className="h-3 w-3" />
            </Button>
          </div>
        )
      }

      return (
        <div className="flex items-center gap-1 min-w-[120px]">
          <Input
            type={['fecha_estimada', 'fecha_vencimiento'].includes(columna) ? 'date' : 'text'}
            defaultValue={celdaEnEdicion.valor}
            className="h-8 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                guardarCambio(e.currentTarget.value)
              } else if (e.key === 'Escape') {
                cancelarEdicion()
              }
            }}
            onBlur={(e) => guardarCambio(e.target.value)}
          />
          <Button
            size="sm" 
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => guardarCambio((document.querySelector('input:focus') as HTMLInputElement)?.value || '')}
          >
            <Save className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost" 
            className="h-6 w-6 p-0"
            onClick={cancelarEdicion}
          >
            <XCircle className="h-3 w-3" />
          </Button>
        </div>
      )
    }

    // Determinar si es campo editable
    const esEditable = camposEditables.includes(columna)
    const claseEditable = modoEdicion && esEditable ? 'cursor-pointer hover:bg-blue-50 border border-transparent hover:border-blue-200' : ''
    
    if (valor === null || valor === undefined) {
      return (
        <span 
          className={`text-gray-400 ${claseEditable}`}
          onClick={(e) => esEditable ? iniciarEdicion(cuota.id, columna, valor, e) : undefined}
        >
          {modoEdicion && esEditable && <Edit3 className="h-3 w-3 inline mr-1 opacity-50" />}
          -
        </span>
      )
    }

    const contenidoCelda = (() => {
      switch (columna) {
        case 'fecha_estimada':
        case 'fecha_vencimiento':
        case 'created_at':
        case 'updated_at':
          return formatearFecha(valor as string)
        
        case 'monto':
          return formatearNumero(valor as number)
        
        case 'estado':
          return (
            <Badge className={colorEstado(valor as string)}>
              {valor as string}
            </Badge>
          )
        
        case 'activo':
          return (
            <Badge variant={valor ? 'default' : 'secondary'}>
              {valor ? 'Sí' : 'No'}
            </Badge>
          )
        
        case 'configuracion_reglas':
          return (
            <div className="max-w-xs truncate" title={JSON.stringify(valor)}>
              {JSON.stringify(valor)}
            </div>
          )
        
        case 'nombre_referencia':
        case 'nombre_quien_cobra':
        case 'descripcion':
          return (
            <div className="max-w-xs truncate" title={valor as string}>
              {valor as string}
            </div>
          )
        
        default:
          return String(valor)
      }
    })()

    return (
      <div
        className={claseEditable}
        onClick={(e) => {
          console.log('🔍 Templates onClick:', columna, 'esEditable:', esEditable, 'modoEdicion:', modoEdicion, 'ctrlKey:', e.ctrlKey)
          if (esEditable) {
            iniciarEdicion(cuota.id, columna, valor, e)
          }
        }}
      >
        {modoEdicion && esEditable && <Edit3 className="h-3 w-3 inline mr-1 opacity-50" />}
        {contenidoCelda}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado principal */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Egresos sin Factura</h2>
        <p className="text-muted-foreground">
          Cuotas y compromisos recurrentes generados desde templates
        </p>
      </div>

      {/* Sub-solapas */}
      <Tabs defaultValue="cuotas" className="w-full">
        <TabsList>
          <TabsTrigger value="cuotas">Cuotas</TabsTrigger>
          <TabsTrigger value="agrupada">Vista Agrupada</TabsTrigger>
        </TabsList>

        {/* Tab: Cuotas (vista actual) */}
        <TabsContent value="cuotas" className="space-y-6">
          {/* Template Testing Suite - Solo para Template 10 como prototipo */}
          {cuotas.some(c => c.egreso?.nombre_referencia === 'Inmobiliario' && c.egreso?.año === 2026) && (
            <TemplateTestSuite
              templateId="387da693-9238-4aed-82ea-1feddd85bda8"
              templateName="Template 10 - Inmobiliario 2026"
            />
          )}

          {/* Encabezado con controles */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
          {modoEdicion && (
            <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              💡 <strong>Procesos Templates:</strong> Ctrl+Click = Editar | Ctrl+Shift+Click en monto = Pago Anual ↔ Cuotas (bidireccional) | Editar monto = Opción propagación
            </p>
          )}
        </div>
        
        {/* Controles */}
        <div className="flex items-center gap-2">
          {/* Botón de modo edición */}
          <Button
            variant={modoEdicion ? "default" : "outline"}
            onClick={() => {
              setModoEdicion(!modoEdicion)
              setCeldaEnEdicion(null) // Limpiar edición activa
            }}
            className={modoEdicion ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {modoEdicion ? "Salir Edición" : "Modo Edición"}
          </Button>

          {/* Botón actualizar */}
          <Button
            variant="outline"
            onClick={() => cargarCuotas()}
            title="Recargar datos desde BD"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>

          {/* Botón edición masiva */}
          <Button
            variant={modoEdicionMasiva ? "default" : "outline"}
            onClick={() => {
              setModoEdicionMasiva(!modoEdicionMasiva)
              if (modoEdicionMasiva) {
                setCuotasSeleccionadasMasiva(new Set())
                setNuevoEstadoMasivo('')
              }
            }}
            className={modoEdicionMasiva ? "bg-purple-600 hover:bg-purple-700" : ""}
          >
            <Check className="mr-2 h-4 w-4" />
            {modoEdicionMasiva ? 'Cancelar Masiva' : 'Edición Masiva'}
          </Button>

          <Button
            onClick={() => setMostrarWizard(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Crear Template
          </Button>

          {/* Botón Pago Manual - Templates Abiertos */}
          <Button
            onClick={abrirModalPagoManual}
            variant="outline"
            className="border-purple-500 text-purple-600 hover:bg-purple-50"
          >
            <Plus className="mr-2 h-4 w-4" />
            Pago Manual
          </Button>
          
          {/* Botón de filtros */}
          <Button 
            variant={mostrarFiltros ? "default" : "outline"}
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          
          {/* Toggle desactivados */}
          <div className="flex items-center space-x-2">
            <Label htmlFor="mostrar-desactivados" className="text-sm">
              Mostrar desactivados
            </Label>
            <Checkbox 
              id="mostrar-desactivados"
              checked={mostrarDesactivados}
              onCheckedChange={setMostrarDesactivados}
            />
          </div>
          
          {/* Selector de columnas */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Settings2 className="mr-2 h-4 w-4" />
                Columnas ({columnasVisiblesArray.length})
              </Button>
            </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Seleccionar columnas</h4>
                <p className="text-sm text-muted-foreground">
                  Elige qué columnas mostrar en la tabla
                </p>
              </div>
              
              <ScrollArea className="h-72">
                <div className="space-y-2">
                  {Object.entries(COLUMNAS_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={columnasVisibles[key]}
                        onCheckedChange={(checked) => {
                          setColumnasVisibles(prev => ({
                            ...prev,
                            [key]: !!checked
                          }))
                        }}
                      />
                      <Label htmlFor={key} className="text-sm">
                        {config.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setColumnasVisibles(
                    Object.fromEntries(Object.keys(COLUMNAS_CONFIG).map(key => [key, true]))
                  )}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setColumnasVisibles(
                    Object.fromEntries(
                      Object.entries(COLUMNAS_CONFIG).map(([key, config]) => [key, config.visible])
                    )
                  )}
                >
                  <EyeOff className="mr-1 h-3 w-3" />
                  Por defecto
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAnchosColumnas(
                    Object.fromEntries(
                      Object.entries(COLUMNAS_CONFIG).map(([key, config]) => [key, config.width])
                    )
                  )}
                >
                  <Settings2 className="mr-1 h-3 w-3" />
                  Resetear anchos
                </Button>
              </div>
            </div>
          </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Información sobre modo edición */}
      {modoEdicion && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Modo Edición Activo:</strong> Mantén presionado Ctrl + Click en cualquier celda editable para modificar valores. 
            Campos editables: fecha estimada, fecha vencimiento, monto, descripción, estado, CATEG, centro costo, responsable, nombre quien cobra, CUIT.
          </AlertDescription>
        </Alert>
      )}

      {/* Panel de filtros */}
      {mostrarFiltros && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                🔍 Filtros de Búsqueda Templates
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMostrarFiltros(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Filtros de fecha */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📅 Rango de Fechas Estimadas</Label>
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
              
              {/* Búsqueda de responsable */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">👤 Responsable</Label>
                <Input
                  placeholder="Buscar por responsable..."
                  value={busquedaResponsable}
                  onChange={(e) => setBusquedaResponsable(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                  className="text-xs"
                />
              </div>
              
              {/* Búsqueda por nombre referencia */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📝 Nombre Referencia</Label>
                <Input
                  placeholder="Buscar por nombre referencia..."
                  value={busquedaNombreReferencia}
                  onChange={(e) => setBusquedaNombreReferencia(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                  className="text-xs"
                />
              </div>
              
              {/* Búsqueda por descripción */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📄 Descripción</Label>
                <Input
                  placeholder="Buscar en descripción..."
                  value={busquedaDescripcion}
                  onChange={(e) => setBusquedaDescripcion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                  className="text-xs"
                />
              </div>
              
              {/* Selector de estado */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">⚡ Estado</Label>
                <Select value={estadoSeleccionado} onValueChange={setEstadoSeleccionado}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {estadosUnicos.map(estado => (
                      <SelectItem key={estado} value={estado}>
                        {estado}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              
              {/* Selector de tipo de recurrencia */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">🔄 Tipo Recurrencia</Label>
                <Select value={tipoRecurrenciaSeleccionado} onValueChange={setTipoRecurrenciaSeleccionado}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    {tiposRecurrenciaUnicos.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Selector de año */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📆 Año</Label>
                <Select value={anoSeleccionado} onValueChange={setAnoSeleccionado}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Todos los años" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los años</SelectItem>
                    {anosUnicos.map(ano => (
                      <SelectItem key={ano} value={ano.toString()}>
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Selector de activación de templates */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">🔄 Activación Templates</Label>
                <Select value={filtroActivacion} onValueChange={setFiltroActivacion}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Filtro activación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activos">Solo Activos</SelectItem>
                    <SelectItem value="inactivos">Solo Inactivos</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Rango de montos */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">💵 Rango de Montos</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Monto mínimo"
                    value={montoMinimo}
                    onChange={(e) => setMontoMinimo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                    className="text-xs"
                  />
                  <Input
                    type="text"
                    placeholder="Monto máximo"
                    value={montoMaximo}
                    onChange={(e) => setMontoMaximo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                    className="text-xs"
                  />
                </div>
              </div>
              
              {/* Estadísticas de filtrado */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📊 Estadísticas</Label>
                <div className="text-xs text-gray-600">
                  {cuotas.length} de {cuotasOriginales.length} cuotas mostradas
                  {cuotas.length !== cuotasOriginales.length && (
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
          </CardContent>
        </Card>
      )}

      {/* Estado de carga o error */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <span>Cargando egresos sin factura...</span>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabla de cuotas */}
      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {cuotas.length} Cuotas Encontradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Scroll horizontal y vertical con headers fijos */}
            <div className="w-full overflow-auto max-h-[600px] border rounded-md">
              <Table style={{ minWidth: 'fit-content' }}>
                  <TableHeader className="sticky top-0 z-10 bg-white border-b">
                    <TableRow>
                      {modoEdicionMasiva && (
                        <TableHead style={{ width: '50px', minWidth: '50px' }}>
                          <Checkbox
                            checked={cuotasSeleccionadasMasiva.size === cuotas.length && cuotas.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setCuotasSeleccionadasMasiva(new Set(cuotas.map(c => c.id)))
                              } else {
                                setCuotasSeleccionadasMasiva(new Set())
                              }
                            }}
                          />
                        </TableHead>
                      )}
                      {columnasVisiblesArray.map(columna => {
                        const config = COLUMNAS_CONFIG[columna as keyof typeof COLUMNAS_CONFIG]
                        if (!config) return null // Protección adicional
                        return (
                          <TableHead
                            key={columna}
                            style={{
                              width: anchosColumnas[columna] || config.width,
                              minWidth: anchosColumnas[columna] || config.width
                            }}
                          >
                            {config.label}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cuotas.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={columnasVisiblesArray.length + (modoEdicionMasiva ? 1 : 0)}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No hay egresos sin factura para mostrar
                        </TableCell>
                      </TableRow>
                    ) : (
                      cuotas.map(cuota => (
                        <TableRow key={cuota.id} className={cuotasSeleccionadasMasiva.has(cuota.id) ? 'bg-purple-50' : ''}>
                          {modoEdicionMasiva && (
                            <TableCell style={{ width: '50px', minWidth: '50px' }}>
                              <Checkbox
                                checked={cuotasSeleccionadasMasiva.has(cuota.id)}
                                onCheckedChange={(checked) => {
                                  const nuevaSeleccion = new Set(cuotasSeleccionadasMasiva)
                                  if (checked) {
                                    nuevaSeleccion.add(cuota.id)
                                  } else {
                                    nuevaSeleccion.delete(cuota.id)
                                  }
                                  setCuotasSeleccionadasMasiva(nuevaSeleccion)
                                }}
                              />
                            </TableCell>
                          )}
                          {columnasVisiblesArray.map(columna => {
                            const config = COLUMNAS_CONFIG[columna as keyof typeof COLUMNAS_CONFIG]
                            if (!config) return null // Protección adicional
                            return (
                              <TableCell
                                key={columna}
                                style={{
                                  width: anchosColumnas[columna] || config.width,
                                  minWidth: anchosColumnas[columna] || config.width
                                }}
                              >
                                {renderizarCelda(cuota, columna)}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
            </div>

            {/* Panel de control edición masiva */}
            {modoEdicionMasiva && cuotasSeleccionadasMasiva.size > 0 && (
              <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-purple-900">
                    ✏️ Edición Masiva - {cuotasSeleccionadasMasiva.size} cuotas seleccionadas
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCuotasSeleccionadasMasiva(new Set())}
                  >
                    Limpiar selección
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Selector de estado */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-purple-900">Nuevo Estado</Label>
                    <Select value={nuevoEstadoMasivo} onValueChange={setNuevoEstadoMasivo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="debito">Débito</SelectItem>
                        <SelectItem value="pagar">Pagar</SelectItem>
                        <SelectItem value="preparado">Preparado</SelectItem>
                        <SelectItem value="pagado">Pagado</SelectItem>
                        <SelectItem value="programado">Programado</SelectItem>
                        <SelectItem value="credito">Crédito</SelectItem>
                        <SelectItem value="conciliado">Conciliado</SelectItem>
                        <SelectItem value="desactivado">Desactivado</SelectItem>
                        <SelectItem value="anterior">Anterior</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Botón aplicar */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-purple-900">Acción</Label>
                    <Button
                      onClick={ejecutarEdicionMasivaCuotas}
                      disabled={cuotasSeleccionadasMasiva.size === 0 || !nuevoEstadoMasivo}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      ✅ Aplicar Estado a {cuotasSeleccionadasMasiva.size} cuotas
                    </Button>
                  </div>
                </div>

                {/* Conversión masiva Anual → Cuotas */}
                {puedeConvertirMasivo && (
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-900">🔄 Conversión masiva Anual → Cuotas</p>
                        <p className="text-xs text-purple-600 mt-0.5">
                          {new Set(cuotasSeleccionadasArray.map(c => c.egreso?.grupo_impuesto_id).filter(Boolean)).size} templates seleccionados
                        </p>
                      </div>
                      <Button
                        onClick={() => { setResultadosConversion([]); setModalConversionMasiva(true) }}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        size="sm"
                      >
                        🔄 Convertir a Cuotas
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Wizard para crear templates */}
      {mostrarWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Crear Template de Egreso</h2>
                <Button 
                  variant="outline" 
                  onClick={() => setMostrarWizard(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <WizardTemplatesEgresos />
            </div>
          </div>
        </div>
      )}

      {/* Modal Conversión Masiva Anual → Cuotas */}
      <Dialog open={modalConversionMasiva} onOpenChange={v => { if (!procesandoConversion) setModalConversionMasiva(v) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🔄 Convertir a Cuotas</DialogTitle>
            <DialogDescription>
              Se convertirán los siguientes templates de Anual a Cuotas.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2 max-h-64 overflow-y-auto">
            {Array.from(new Map(
              cuotasSeleccionadasArray
                .filter(c => c.egreso?.grupo_impuesto_id)
                .map(c => [c.egreso!.grupo_impuesto_id!, c])
            ).values()).map(c => (
              <div key={c.egreso?.grupo_impuesto_id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                <span className="font-medium">{c.egreso?.nombre_referencia}</span>
                {resultadosConversion.length > 0 && (() => {
                  const r = resultadosConversion.find(r => r.nombre === c.egreso?.nombre_referencia)
                  return r ? <span className={r.ok ? 'text-green-600' : 'text-red-600'}>{r.msg}</span> : null
                })()}
              </div>
            ))}
          </div>
          <DialogFooter>
            {resultadosConversion.length === 0 ? (
              <>
                <Button variant="outline" onClick={() => setModalConversionMasiva(false)} disabled={procesandoConversion}>
                  Cancelar
                </Button>
                <Button onClick={ejecutarConversionMasiva} disabled={procesandoConversion} className="bg-orange-500 hover:bg-orange-600">
                  {procesandoConversion ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Convirtiendo...</> : '🔄 Confirmar Conversión'}
                </Button>
              </>
            ) : (
              <Button onClick={() => setModalConversionMasiva(false)} className="bg-green-600 hover:bg-green-700">
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Propagación de Cuotas - 3 opciones */}
      <Dialog open={modalPropagacion.isOpen} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>💰 Modificar Monto</DialogTitle>
            <DialogDescription>
              Monto cuota actual: <strong>${modalPropagacion.nuevoMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-600">
              ¿Desea propagar a las cuotas futuras de este template?
            </p>

            {/* Input para monto personalizado de propagación */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Monto a propagar (opcional):
              </label>
              <Input
                type="text"
                placeholder={`Dejar vacío = $${modalPropagacion.nuevoMonto.toLocaleString('es-AR')}`}
                value={montoPropagacionPersonalizado}
                onChange={(e) => setMontoPropagacionPersonalizado(e.target.value)}
                className="w-full"
                disabled={guardandoEnProgreso}
              />
              <p className="text-xs text-gray-500">
                Si ingresa un monto diferente, la cuota actual quedará en ${modalPropagacion.nuevoMonto.toLocaleString('es-AR')}
                y las futuras en el monto ingresado.
              </p>
            </div>

            <ul className="text-sm text-gray-500 list-disc pl-5 space-y-1">
              <li><strong>SÍ, propagar:</strong> Cuotas futuras con monto {montoPropagacionPersonalizado ? `$${(parseFloat(montoPropagacionPersonalizado.replace(/\./g, '').replace(',', '.')) || 0).toLocaleString('es-AR')}` : 'igual'}</li>
              <li><strong>NO, solo esta:</strong> Solo se modificará esta cuota</li>
              <li><strong>Cancelar:</strong> No hacer ningún cambio</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handlePropagacionCancelar}
              disabled={guardandoEnProgreso}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={handlePropagacionNo}
              disabled={guardandoEnProgreso}
            >
              {guardandoEnProgreso ? 'Guardando...' : 'NO, solo esta'}
            </Button>
            <Button
              onClick={handlePropagacionSi}
              disabled={guardandoEnProgreso}
            >
              {guardandoEnProgreso ? 'Guardando...' : 'SÍ, propagar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para validación de categorías */}
      <Dialog open={validandoCateg.isOpen} onOpenChange={() => cerrarModalCategTemplates()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categoría no encontrada</DialogTitle>
            <DialogDescription>
              La categoría "{validandoCateg.categIngresado}" no existe en el sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-gray-600">¿Qué desea hacer?</p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cerrarModalCategTemplates}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={manejarElegirExistenteTemplates}>
              Elegir categoría existente
            </Button>
            <Button onClick={manejarCrearCategoriaTemplates}>
              Crear nueva categoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                            name="tipoMovimiento"
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
                            name="tipoMovimiento"
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
                <Label htmlFor="fecha-pago">Fecha</Label>
                <Input
                  id="fecha-pago"
                  type="date"
                  value={nuevaCuota.fecha}
                  onChange={(e) => setNuevaCuota(prev => ({ ...prev, fecha: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monto-pago">Monto</Label>
                <Input
                  id="monto-pago"
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
                    <Label htmlFor="descripcion-pago">Descripción (opcional)</Label>
                    <Input
                      id="descripcion-pago"
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
        </TabsContent>

        {/* Tab: Vista Agrupada */}
        <TabsContent value="agrupada">
          <VistaTemplatesAgrupada />
        </TabsContent>
      </Tabs>
    </div>
  )
}