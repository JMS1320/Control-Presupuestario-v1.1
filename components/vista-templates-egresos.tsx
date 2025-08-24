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
import { Loader2, Settings2, FileText, Info, Eye, EyeOff, Plus, X, Filter, Edit3, Save, XCircle, TestTube } from "lucide-react"
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

  // Hook unificado (DESPUÉS de cargarCuotas para evitar error inicialización)
  const hookEditor = useInlineEditor({
    onSuccess: cargarCuotas,
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
    const esTemplateInactivo = cuota?.egreso?.activo === false
    
    // Ctrl+Shift+Click en monto = Activar pago anual (si template activo) o convertir a cuotas (si inactivo)
    if (event.ctrlKey && event.shiftKey && columna === 'monto' && modoEdicion) {
      event.preventDefault()
      if (esTemplateInactivo) {
        activarPagoCuotas(cuotaId)
      } else {
        activarPagoAnual(cuotaId)
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

  // Función para activar proceso de pago anual
  const activarPagoAnual = async (cuotaId: string) => {
    try {
      // Obtener información del template para mostrar en confirmación
      const cuota = cuotas.find(c => c.id === cuotaId)
      const nombreTemplate = cuota?.egreso?.nombre_referencia || 'Template'
      
      const confirmacion = await confirmarPagoAnual(cuotaId, nombreTemplate)
      
      if (confirmacion.confirmed && confirmacion.montoAnual && confirmacion.fechaPago) {
        const resultado = await ejecutarPagoAnual({
          templateId: cuota?.egreso_id || '',
          cuotaId: cuotaId,
          montoAnual: confirmacion.montoAnual,
          fechaPagoAnual: confirmacion.fechaPago
        })
        
        if (resultado.success) {
          alert(`✅ Pago anual configurado\n• Cuotas desactivadas: ${resultado.cuotasDesactivadas}\n• Monto anual: $${confirmacion.montoAnual.toLocaleString('es-AR')}\n• Fecha pago: ${confirmacion.fechaPago}`)
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

  // Función para activar proceso de pago por cuotas (reversa de pago anual)
  const activarPagoCuotas = async (cuotaId: string) => {
    try {
      // Obtener información del template para mostrar en confirmación
      const cuota = cuotas.find(c => c.id === cuotaId)
      const nombreTemplate = cuota?.egreso?.nombre_referencia || 'Template'
      
      const confirmacion = await confirmarPagoCuotas(cuotaId, nombreTemplate)
      
      if (confirmacion.confirmed && confirmacion.montoPorCuota && confirmacion.numeroCuotas && 
          confirmacion.fechaPrimeraCuota && confirmacion.frecuenciaMeses) {
        
        const resultado = await ejecutarPagoCuotas({
          templateId: cuota?.egreso_id || '',
          cuotaId: cuotaId,
          montoPorCuota: confirmacion.montoPorCuota,
          numeroCuotas: confirmacion.numeroCuotas,
          fechaPrimeraCuota: confirmacion.fechaPrimeraCuota,
          frecuenciaMeses: confirmacion.frecuenciaMeses
        })
        
        if (resultado.success) {
          alert(`✅ Template convertido a cuotas\n• Template reactivado: SÍ\n• Cuotas creadas: ${resultado.cuotasCreadas + 1}\n• Monto por cuota: $${confirmacion.montoPorCuota.toLocaleString('es-AR')}`)
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
    if (!celdaEnEdicion) return

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
        
        // PROCESO ESPECIAL TEMPLATES: Confirmar propagación de cuotas cuando se edita monto
        if (valorFinal > 0) {
          const confirmarProp = await confirmarPropagacion(datosEdicion.cuotaId, 'template', valorFinal)
          
          if (confirmarProp) {
            // Usuario quiere propagar a cuotas futuras
            const resultPropagacion = await ejecutarPropagacion({
              templateId: 'template', // Se actualiza después con datos reales
              cuotaModificadaId: datosEdicion.cuotaId,
              nuevoMonto: valorFinal,
              aplicarATodasLasFuturas: true
            })
            
            if (resultPropagacion.success && resultPropagacion.cuotasModificadas > 0) {
              alert(`✅ Propagación exitosa: ${resultPropagacion.cuotasModificadas} cuotas futuras actualizadas`)
            }
          }
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

      // Recargar datos y limpiar edición (igual que ARCA)
      await cargarCuotas()
      setCeldaEnEdicion(null)

      console.log(`✅ Templates: ${datosEdicion.columna} actualizado`)
    } catch (error) {
      console.error('Error guardando cambio:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
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
          <div className="flex items-center gap-1 min-w-[120px]">
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
                <SelectItem value="pagado">Pagado</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="conciliado">Conciliado</SelectItem>
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
            <Badge variant={valor === 'pendiente' ? 'secondary' : 'default'}>
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
          <h2 className="text-2xl font-bold tracking-tight">Egresos sin Factura</h2>
          <p className="text-muted-foreground">
            Cuotas y compromisos recurrentes generados desde templates
          </p>
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
          
          <Button
            onClick={() => setMostrarWizard(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Crear Template
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
                    type="number"
                    placeholder="Monto mínimo"
                    value={montoMinimo}
                    onChange={(e) => setMontoMinimo(e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    type="number"
                    placeholder="Monto máximo"
                    value={montoMaximo}
                    onChange={(e) => setMontoMaximo(e.target.value)}
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
            {/* Scroll horizontal simple */}
            <div className="w-full overflow-auto max-h-[600px] border rounded-md">
              <div style={{ minWidth: 'fit-content' }}>
                <Table>
                  <TableHeader>
                    <TableRow>
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
                          colSpan={columnasVisiblesArray.length} 
                          className="h-24 text-center text-muted-foreground"
                        >
                          No hay egresos sin factura para mostrar
                        </TableCell>
                      </TableRow>
                    ) : (
                      cuotas.map(cuota => (
                        <TableRow key={cuota.id}>
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
            </div>
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
    </div>
  )
}