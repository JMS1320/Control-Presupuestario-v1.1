"use client"

import { useState, useEffect, useRef } from "react"
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Icons importados para funcionalidad Excel import + UI
import { Loader2, Settings2, Receipt, Info, Eye, EyeOff, Filter, X, Edit3, Save, Check, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Calendar } from "lucide-react"
import { CategCombobox } from "@/components/ui/categ-combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCuentasContables } from "@/hooks/useCuentasContables"
import useInlineEditor, { type CeldaEnEdicion } from "@/hooks/useInlineEditor"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface FacturaArca {
  id: string
  fecha_emision: string
  tipo_comprobante: number
  punto_venta: number | null
  numero_desde: number | null
  numero_hasta: number | null
  codigo_autorizacion: string | null
  tipo_doc_emisor: number | null
  cuit: string
  denominacion_emisor: string
  tipo_cambio: number
  moneda: string
  imp_neto_gravado: number
  imp_neto_no_gravado: number
  imp_op_exentas: number
  otros_tributos: number
  iva: number
  imp_total: number
  campana: string | null
  año_contable: number | null
  mes_contable: number | null
  fc: string | null
  cuenta_contable: string | null
  centro_costo: string | null
  estado: string
  observaciones_pago: string | null
  detalle: string | null
  archivo_origen: string | null
  fecha_importacion: string | null
  fecha_modificacion: string | null
  fecha_estimada: string | null
  fecha_vencimiento: string | null
  monto_a_abonar: number | null
  ddjj_iva: string
  created_at: string
  // Campos IVA por alícuotas que existen en BD pero faltaban en interface
  iva_2_5: number | null
  iva_5: number | null
  iva_10_5: number | null
  iva_21: number | null
  iva_27: number | null
  neto_grav_iva_0: number | null
  neto_grav_iva_2_5: number | null
  neto_grav_iva_5: number | null
  neto_grav_iva_10_5: number | null
  neto_grav_iva_21: number | null
  neto_grav_iva_27: number | null
  // Campos SICORE - Retenciones Ganancias
  sicore: string | null
  monto_sicore: number | null
}

// Interface para configuración tipos SICORE
interface TipoSicore {
  id: number
  tipo: string
  emoji: string
  minimo_no_imponible: number
  porcentaje_retencion: number
  activo: boolean
}

// Configuración de columnas disponibles - TODAS VISIBLES por defecto  
const COLUMNAS_CONFIG = {
  fecha_emision: { label: "Fecha Emisión", visible: true, width: "120px" },
  tipo_comprobante: { label: "Tipo Comp.", visible: true, width: "100px" },
  punto_venta: { label: "Punto Venta", visible: true, width: "120px" },
  numero_desde: { label: "Número Desde", visible: true, width: "140px" },
  numero_hasta: { label: "Número Hasta", visible: false, width: "140px" },
  codigo_autorizacion: { label: "Cód. Autorización", visible: false, width: "160px" },
  tipo_doc_emisor: { label: "Tipo Doc.", visible: false, width: "100px" },
  cuit: { label: "CUIT", visible: true, width: "120px" },
  denominacion_emisor: { label: "Proveedor", visible: true, width: "200px" },
  tipo_cambio: { label: "Tipo Cambio", visible: true, width: "120px" },
  moneda: { label: "Moneda", visible: true, width: "80px" },
  imp_neto_gravado: { label: "Neto Gravado", visible: true, width: "130px" },
  imp_neto_no_gravado: { label: "Neto No Gravado", visible: true, width: "140px" },
  imp_op_exentas: { label: "Op. Exentas", visible: true, width: "120px" },
  otros_tributos: { label: "Otros Tributos", visible: true, width: "130px" },
  iva: { label: "IVA", visible: true, width: "120px" },
  imp_total: { label: "Total", visible: true, width: "130px" },
  campana: { label: "Campaña", visible: true, width: "120px" },
  año_contable: { label: "Año Contable", visible: true, width: "120px" },
  mes_contable: { label: "Mes Contable", visible: true, width: "120px" },
  fc: { label: "FC", visible: true, width: "80px" },
  cuenta_contable: { label: "Cuenta Contable", visible: true, width: "150px" },
  centro_costo: { label: "Centro Costo", visible: true, width: "120px" },
  estado: { label: "Estado", visible: true, width: "100px" },
  observaciones_pago: { label: "Obs. Pago", visible: true, width: "150px" },
  detalle: { label: "Detalle", visible: true, width: "150px" },
  archivo_origen: { label: "Archivo Origen", visible: false, width: "200px" },
  fecha_importacion: { label: "Fecha Importación", visible: false, width: "150px" },
  fecha_modificacion: { label: "Fecha Modificación", visible: false, width: "150px" },
  fecha_estimada: { label: "Fecha Estimada", visible: true, width: "130px" },
  fecha_vencimiento: { label: "Fecha Vencimiento", visible: true, width: "150px" },
  monto_a_abonar: { label: "Monto a Abonar", visible: true, width: "140px" },
  ddjj_iva: { label: "DDJJ IVA", visible: true, width: "100px" },
  created_at: { label: "Created At", visible: false, width: "150px" }
} as const

export function VistaFacturasArca() {
  const [facturas, setFacturas] = useState<FacturaArca[]>([])
  const [facturasOriginales, setFacturasOriginales] = useState<FacturaArca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Hook para validación de categorías
  const { cuentas, validarCateg, buscarSimilares, crearCuentaContable } = useCuentasContables()
  
  // Estados para filtros
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [busquedaProveedor, setBusquedaProveedor] = useState('')
  const [busquedaCUIT, setBusquedaCUIT] = useState('')
  const [busquedaDetalle, setBusquedaDetalle] = useState('')
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('todos')
  const [montoMinimo, setMontoMinimo] = useState('')
  const [montoMaximo, setMontoMaximo] = useState('')
  const [busquedaCateg, setBusquedaCateg] = useState('')
  
  // Estados para tabs de navegación
  const [tabActivo, setTabActivo] = useState<'facturas' | 'subdiarios'>('facturas')
  
  // Estados para Subdiarios
  const [periodoConsulta, setPeriodoConsulta] = useState('')
  const [mostrarModalImputar, setMostrarModalImputar] = useState(false)
  const [periodoImputacion, setPeriodoImputacion] = useState('')
  const [mostrarSinImputar, setMostrarSinImputar] = useState(true)
  const [mostrarImputadas, setMostrarImputadas] = useState(false)
  const [facturasSeleccionadas, setFacturasSeleccionadas] = useState<Set<string>>(new Set())
  const [facturasPeriodo, setFacturasPeriodo] = useState<FacturaArca[]>([])
  const [facturasImputacion, setFacturasImputacion] = useState<FacturaArca[]>([])
  const [subtotales, setSubtotales] = useState<any>(null)
  const [cargandoSubdiarios, setCargandoSubdiarios] = useState(false)
  
  // Estados para gestión masiva de facturas
  const [mostrarGestionMasiva, setMostrarGestionMasiva] = useState(false)
  const [facturasSeleccionadasGestion, setFacturasSeleccionadasGestion] = useState<Set<string>>(new Set())
  const [nuevoEstadoDDJJ, setNuevoEstadoDDJJ] = useState('')
  
  // Estado para mostrar columnas detalladas en Subdiarios
  const [mostrarColumnasDetalladas, setMostrarColumnasDetalladas] = useState(false)
  
  // Estados para flujo SICORE - Retenciones Ganancias
  const [mostrarModalSicore, setMostrarModalSicore] = useState(false)
  const [facturaEnProceso, setFacturaEnProceso] = useState<FacturaArca | null>(null)
  const [tiposSicore, setTiposSicore] = useState<TipoSicore[]>([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoSicore | null>(null)
  const [montoRetencion, setMontoRetencion] = useState(0)
  const [descuentoAdicional, setDescuentoAdicional] = useState(0)
  const [pasoSicore, setPasoSicore] = useState<'tipo' | 'calculo' | 'descuento'>('tipo')
  const [datosSicoreCalculo, setDatosSicoreCalculo] = useState<{
    netoFactura: number
    minimoAplicado: number
    baseImponible: number
    esRetencionAdicional: boolean
  } | null>(null)

  // Estado para guardado pendiente - permite cancelar SICORE sin guardar estado
  const [guardadoPendiente, setGuardadoPendiente] = useState<{facturaId: string, columna: string, valor: any, estadoAnterior: string} | null>(null)
  
  // Estados para cierre de quincena SICORE
  const [mostrarModalCierreQuincena, setMostrarModalCierreQuincena] = useState(false)
  const [quincenaSeleccionada, setQuincenaSeleccionada] = useState('')
  const [procesandoCierre, setProcesandoCierre] = useState(false)

  // Estados para Vista de Pagos
  const [mostrarModalPagos, setMostrarModalPagos] = useState(false)
  const [facturasPagos, setFacturasPagos] = useState<FacturaArca[]>([])
  const [templatesPagos, setTemplatesPagos] = useState<any[]>([])
  const [facturasSeleccionadasPagos, setFacturasSeleccionadasPagos] = useState<Set<string>>(new Set())
  const [templatesSeleccionadosPagos, setTemplatesSeleccionadosPagos] = useState<Set<string>>(new Set())
  const [filtrosPagos, setFiltrosPagos] = useState({ pendiente: true, pagar: true, preparado: true })
  const [filtroOrigenPagos, setFiltroOrigenPagos] = useState({ arca: true, template: true })
  const [cargandoPagos, setCargandoPagos] = useState(false)
  const [fechaPagoSeleccionada, setFechaPagoSeleccionada] = useState<string>('')

  // Cola de facturas pendientes de procesar SICORE (para múltiples selecciones)
  const [colaSicore, setColaSicore] = useState<FacturaArca[]>([])
  const [procesandoColaSicore, setProcesandoColaSicore] = useState(false)
  
  // Estados para configuración de carpetas con persistencia
  const [carpetaPorDefecto, setCarpetaPorDefectoState] = useState<any>(null)
  
  // Función para persistir carpeta por defecto
  const setCarpetaPorDefecto = (carpeta: any) => {
    setCarpetaPorDefectoState(carpeta)
    if (carpeta) {
      localStorage.setItem('carpetaPorDefectoDDJJ', JSON.stringify({
        name: carpeta.name,
        // No podemos serializar el handle completo, solo el nombre para mostrar
      }))
    }
  }

  // Cargar carpeta por defecto al inicio (solo nombre para mostrar)
  useEffect(() => {
    try {
      const carpetaGuardada = localStorage.getItem('carpetaPorDefectoDDJJ')
      if (carpetaGuardada) {
        const carpetaInfo = JSON.parse(carpetaGuardada)
        // Solo mantenemos la info para mostrar, no el handle real
        setCarpetaPorDefectoState({ name: carpetaInfo.name, isFromStorage: true })
      }
    } catch (error) {
      console.log('Error cargando carpeta por defecto:', error)
    }
  }, [])
  
  // Cargar tipos SICORE al inicializar
  useEffect(() => {
    const cargarTiposSicore = async () => {
      try {
        const { data, error } = await supabase
          .from('tipos_sicore_config')
          .select('*')
          .eq('activo', true)
          .order('minimo_no_imponible', { ascending: true })
        
        if (error) {
          console.error('Error cargando tipos SICORE:', error)
          return
        }
        
        setTiposSicore(data || [])
      } catch (error) {
        console.error('Error cargando tipos SICORE:', error)
      }
    }
    
    cargarTiposSicore()
  }, [])
  
  const [nuevoPeriodo, setNuevoPeriodo] = useState('')

  // Generar períodos desde mes actual hacia atrás
  const generarPeriodos = () => {
    const periodos = []
    const hoy = new Date()
    
    for (let i = 0; i < 12; i++) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const mes = String(fecha.getMonth() + 1).padStart(2, '0')
      const año = fecha.getFullYear()
      periodos.push(`${mes}/${año}`)
    }
    return periodos
  }
  
  // Estados para importador Excel
  const [mostrarImportador, setMostrarImportador] = useState(false)
  const [archivoImportacion, setArchivoImportacion] = useState<File | null>(null)
  const [importandoExcel, setImportandoExcel] = useState(false)
  const [resultadoImportacion, setResultadoImportacion] = useState<any>(null)
  const [empresa, setEmpresa] = useState<'MSA' | 'PAM'>('MSA')
  
  // Estados para edición inline
  const [modoEdicion, setModoEdicion] = useState(false)
  const [celdaEnEdicion, setCeldaEnEdicion] = useState<{facturaId: string, columna: string, valor: any} | null>(null)
  const [guardandoCambio, setGuardandoCambio] = useState(false)
  const inputRefLocal = useRef<HTMLInputElement>(null)
  const celdaAnteriorRef = useRef<string | null>(null)

  // Auto-focus y auto-select SOLO al iniciar edición (no en cada cambio de valor)
  useEffect(() => {
    const celdaActualId = celdaEnEdicion ? `${celdaEnEdicion.facturaId}-${celdaEnEdicion.columna}` : null

    // Solo ejecutar si cambió la celda (nueva edición), no si solo cambió el valor
    if (celdaActualId && celdaActualId !== celdaAnteriorRef.current && inputRefLocal.current) {
      setTimeout(() => {
        inputRefLocal.current?.focus()
        inputRefLocal.current?.select()
      }, 50)
    }

    celdaAnteriorRef.current = celdaActualId
  }, [celdaEnEdicion])
  
  // Estado para modal validación categorías
  const [validandoCateg, setValidandoCateg] = useState<{
    isOpen: boolean
    categIngresado: string
    celdaEnEdicion: {facturaId: string, columna: string, valor: any} | null
  }>({
    isOpen: false,
    categIngresado: '',
    celdaEnEdicion: null
  })
  
  // Estado para columnas visibles con valores por defecto
  const [columnasVisibles, setColumnasVisibles] = useState<Record<string, boolean>>(() => {
    // Intentar cargar desde localStorage
    const saved = localStorage.getItem('facturas-arca-columnas-visibles')
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
    const saved = localStorage.getItem('facturas-arca-anchos-columnas')
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
    localStorage.setItem('facturas-arca-columnas-visibles', JSON.stringify(columnasVisibles))
  }, [columnasVisibles])

  // Guardar cambios de anchos en localStorage
  useEffect(() => {
    localStorage.setItem('facturas-arca-anchos-columnas', JSON.stringify(anchosColumnas))
  }, [anchosColumnas])

  // Cargar facturas ARCA desde Supabase
  const cargarFacturas = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: supabaseError } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('*')
        .order('fecha_emision', { ascending: false })

      if (supabaseError) {
        console.error('Error al cargar facturas:', supabaseError)
        setError(`Error al cargar facturas: ${supabaseError.message}`)
        return
      }

      const facturasCargadas = data || []
      setFacturas(facturasCargadas)
      setFacturasOriginales(facturasCargadas)
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al cargar las facturas')
    } finally {
      setLoading(false)
    }
  }

  // Hook unificado (DESPUÉS de cargarFacturas para evitar error inicialización)
  const hookEditor = useInlineEditor({
    onSuccess: cargarFacturas,
    onError: (error) => console.error('Hook error:', error)
  })

  useEffect(() => {
    cargarFacturas()
  }, [])

  // Auto-cargar facturas cuando cambia el período de imputación
  useEffect(() => {
    if (periodoImputacion) {
      cargarFacturasImputacion(periodoImputacion)
    } else {
      // Si no hay período, limpiar lista
      setFacturasImputacion([])
    }
  }, [periodoImputacion, mostrarSinImputar, mostrarImputadas])

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
    let facturasFiltradas = [...facturasOriginales]
    
    // Filtro por fecha de emisión
    if (fechaDesde) {
      facturasFiltradas = facturasFiltradas.filter(f => f.fecha_emision >= fechaDesde)
    }
    if (fechaHasta) {
      facturasFiltradas = facturasFiltradas.filter(f => f.fecha_emision <= fechaHasta)
    }
    
    // Filtro por proveedor
    if (busquedaProveedor.trim()) {
      const busqueda = busquedaProveedor.toLowerCase()
      facturasFiltradas = facturasFiltradas.filter(f => 
        f.denominacion_emisor && f.denominacion_emisor.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por CUIT
    if (busquedaCUIT.trim()) {
      facturasFiltradas = facturasFiltradas.filter(f => 
        f.cuit && f.cuit.includes(busquedaCUIT)
      )
    }
    
    // Filtro por detalle
    if (busquedaDetalle.trim()) {
      const busqueda = busquedaDetalle.toLowerCase()
      facturasFiltradas = facturasFiltradas.filter(f => 
        f.detalle && f.detalle.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por estado
    if (estadoSeleccionado && estadoSeleccionado !== 'todos') {
      facturasFiltradas = facturasFiltradas.filter(f => f.estado === estadoSeleccionado)
    }
    
    // Filtro por rango de montos
    if (montoMinimo) {
      const minimo = parseFloat(montoMinimo)
      facturasFiltradas = facturasFiltradas.filter(f => f.imp_total >= minimo)
    }
    if (montoMaximo) {
      const maximo = parseFloat(montoMaximo)
      facturasFiltradas = facturasFiltradas.filter(f => f.imp_total <= maximo)
    }
    
    // Filtro por cuenta contable (CATEG)
    if (busquedaCateg.trim()) {
      const busqueda = busquedaCateg.toLowerCase()
      facturasFiltradas = facturasFiltradas.filter(f => 
        f.cuenta_contable && f.cuenta_contable.toLowerCase().includes(busqueda)
      )
    }
    
    setFacturas(facturasFiltradas)
  }
  
  const limpiarFiltros = () => {
    setFechaDesde('')
    setFechaHasta('')
    setBusquedaProveedor('')
    setBusquedaCUIT('')
    setBusquedaDetalle('')
    setEstadoSeleccionado('todos')
    setMontoMinimo('')
    setMontoMaximo('')
    setBusquedaCateg('')
    setFacturas(facturasOriginales)
  }
  
  // Funciones para edición inline
  const iniciarEdicion = (facturaId: string, columna: string, valor: any, event: React.MouseEvent) => {
    if (!event.ctrlKey || !modoEdicion) return
    
    event.preventDefault()
    event.stopPropagation()
    
    // TESTING: Usar hook solo para fechas (approach gradual)
    if (['fecha_estimada', 'fecha_vencimiento'].includes(columna)) {
      console.log('🔄 Usando hook para fecha:', columna)
      const celdaHook: CeldaEnEdicion = {
        filaId: facturaId,
        columna,
        valor: valor || '',
        tableName: 'comprobantes_arca',
        origen: 'ARCA'
      }
      hookEditor.iniciarEdicion(celdaHook)
    } else {
      // Lógica original para otros campos
      setCeldaEnEdicion({
        facturaId,
        columna,
        valor: valor || ''
      })
    }
  }

  const cancelarEdicion = () => {
    setCeldaEnEdicion(null)
  }

  // Manejador de teclado para edición inline (Enter=guardar, Escape=cancelar)
  const manejarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      guardarCambio()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelarEdicion()
    }
  }

  const guardarCambio = async () => {
    if (!celdaEnEdicion) return
    
    console.log('🔍 DEBUG guardarCambio:', { celdaEnEdicion, cuentasCargadas: cuentas.length })
    
    // Si está editando cuenta_contable, validar si existe primero
    if (celdaEnEdicion.columna === 'cuenta_contable') {
      const categIngresado = String(celdaEnEdicion.valor).toUpperCase()
      
      console.log('🔍 DEBUG validando categoria:', { categIngresado })
      
      const categExiste = validarCateg(categIngresado)
      
      console.log('🔍 DEBUG resultado validación:', { categExiste })
      
      if (categExiste) {
        // Si existe, guardar directo
        console.log('✅ Categoría existe, guardando directo')
        await ejecutarGuardadoReal(celdaEnEdicion)
      } else {
        // Si no existe, mostrar modal con opciones
        console.log('❌ Categoría no existe, mostrando modal')
        setValidandoCateg({
          isOpen: true,
          categIngresado: categIngresado,
          celdaEnEdicion: celdaEnEdicion
        })
      }
      return
    }
    
    // Para otros campos, continuar con el guardado normal
    await ejecutarGuardadoReal(celdaEnEdicion)
  }

  const ejecutarGuardadoReal = async (datosEdicion: {facturaId: string, columna: string, valor: any}) => {
    setGuardandoCambio(true)
    
    try {
      let valorFinal: any = datosEdicion.valor
      
      // Convertir valores según el tipo de campo
      if (['monto_a_abonar', 'imp_total', 'imp_neto_gravado', 'imp_neto_no_gravado', 'imp_op_exentas', 'otros_tributos', 'iva', 'tipo_cambio'].includes(datosEdicion.columna)) {
        valorFinal = parseFloat(String(valorFinal)) || 0
      }
      
      const { error } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .update({ [datosEdicion.columna]: valorFinal })
        .eq('id', datosEdicion.facturaId)
      
      if (error) {
        console.error('Error actualizando factura:', error)
        alert('Error al guardar cambio: ' + error.message)
        return
      }
      
      // Actualizar estado local
      const nuevasFacturas = facturas.map(f => 
        f.id === datosEdicion.facturaId 
          ? { ...f, [datosEdicion.columna]: valorFinal }
          : f
      )
      setFacturas(nuevasFacturas)
      
      const nuevasFacturasOriginales = facturasOriginales.map(f => 
        f.id === datosEdicion.facturaId 
          ? { ...f, [datosEdicion.columna]: valorFinal }
          : f
      )
      setFacturasOriginales(nuevasFacturasOriginales)
      
      setCeldaEnEdicion(null)
      
      // HOOK SICORE - Interceptar cambio estado HACIA "pagar" ANTES del guardado
      console.log('🔍 SICORE DEBUG Hook:', { columna: datosEdicion.columna, valorFinal, esEstado: datosEdicion.columna === 'estado' })
      if (datosEdicion.columna === 'estado' && valorFinal === 'pagar') {
        const facturaOriginal = facturasOriginales.find(f => f.id === datosEdicion.facturaId)
        const estadoAnterior = facturaOriginal?.estado
        
        // Solo ejecutar SICORE si el estado cambió HACIA 'pagar' (no si ya estaba en 'pagar')
        if (estadoAnterior !== 'pagar') {
          const facturaModificada = nuevasFacturas.find(f => f.id === datosEdicion.facturaId)
          if (facturaModificada) {
            console.log(`🎯 SICORE: Cambio detectado ${estadoAnterior} → pagar - INTERCEPTANDO`)
            
            // GUARDAR datos del cambio pendiente (sin ejecutar aún)
            setGuardadoPendiente({
              facturaId: datosEdicion.facturaId,
              columna: datosEdicion.columna,
              valor: valorFinal,
              estadoAnterior: estadoAnterior || 'pendiente'
            })
            
            // NO TOCAR la UI aquí - debe quedar en estado 'pagar' hasta cancelar
            // La UI ya se actualizó arriba con 'pagar', solo interceptamos el guardado BD
            
            // EVALUAR SICORE (no guarda aún, solo muestra modal)
            await evaluarRetencionSicore(facturaModificada)
            return // NO ejecutar guardado normal
          }
        } else {
          console.log('⏭️ SICORE: Factura ya estaba en estado pagar, no ejecutar')
        }
      }
      alert('Cambio guardado exitosamente')
      
    } catch (error) {
      console.error('Error guardando cambio:', error)
      alert('Error al guardar cambio')
    } finally {
      setGuardandoCambio(false)
    }
  }

  // Funciones para modal de validación categorías
  const manejarCrearCategoria = async () => {
    const categIngresado = validandoCateg.categIngresado
    const cuentaContable = prompt(`Ingrese nombre de cuenta contable para la categoría "${categIngresado}":`)
    const tipo = prompt(`Ingrese tipo para la categoría "${categIngresado}" (ej: egreso, ingreso):`) || 'egreso'
    
    if (cuentaContable) {
      const creado = await crearCuentaContable(categIngresado, cuentaContable, tipo)
      if (creado && validandoCateg.celdaEnEdicion) {
        await ejecutarGuardadoReal(validandoCateg.celdaEnEdicion)
        setValidandoCateg({ isOpen: false, categIngresado: '', celdaEnEdicion: null })
      }
    }
  }

  const manejarElegirExistente = () => {
    const similares = buscarSimilares(validandoCateg.categIngresado)
    if (similares.length > 0) {
      const opciones = similares.map((c, i) => `${i + 1}. ${c.categ} - ${c.cuenta_contable}`).join('\n')
      const seleccion = prompt(`Categorías similares encontradas:\n${opciones}\n\nIngrese el número de la categoría a usar:`)
      const indice = parseInt(seleccion || '0') - 1
      
      if (indice >= 0 && indice < similares.length && validandoCateg.celdaEnEdicion) {
        const categSeleccionada = similares[indice].categ
        const nuevaEdicion = { ...validandoCateg.celdaEnEdicion, valor: categSeleccionada }
        ejecutarGuardadoReal(nuevaEdicion)
        setValidandoCateg({ isOpen: false, categIngresado: '', celdaEnEdicion: null })
      }
    } else {
      alert('No se encontraron categorías similares')
    }
  }

  const cerrarModalCateg = () => {
    setValidandoCateg({ isOpen: false, categIngresado: '', celdaEnEdicion: null })
    setCeldaEnEdicion(null)
  }

  // Obtener estados únicos para el selector
  const estadosUnicos = [...new Set(facturasOriginales.map(f => f.estado))].filter(Boolean).sort()

  // Obtener columnas visibles
  const columnasVisiblesArray = Object.entries(columnasVisibles)
    .filter(([_, visible]) => visible)
    .map(([key]) => key as keyof FacturaArca)

  // Campos editables en ARCA
  const camposEditables = [
    'fecha_estimada', 'fecha_vencimiento', 'monto_a_abonar', 'cuenta_contable', 
    'centro_costo', 'estado', 'observaciones_pago', 'detalle', 'campana'
  ]

  // Renderizar valor de celda según el tipo de columna
  const renderizarCelda = (factura: FacturaArca, columna: keyof FacturaArca) => {
    const valor = factura[columna]
    const esEditable = camposEditables.includes(columna as string)
    const esCeldaEnEdicion = celdaEnEdicion?.facturaId === factura.id && celdaEnEdicion?.columna === columna
    
    if (columna === 'cuenta_contable') {
      console.log('🔍 DEBUG cuenta_contable:', { valor, esEditable, modoEdicion, camposEditables })
    }

    // Si esta celda está en edición (hook) para fechas, mostrar input del hook
    const esCeldaHookEnEdicion = (['fecha_estimada', 'fecha_vencimiento'].includes(columna as string)) && 
                                hookEditor.celdaEnEdicion?.filaId === factura.id && 
                                hookEditor.celdaEnEdicion?.columna === columna
    
    if (esCeldaHookEnEdicion) {
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
            <X className="h-3 w-3" />
          </Button>
        </div>
      )
    }

    // Si esta celda está en edición (lógica original), mostrar input
    if (esCeldaEnEdicion) {
      return (
        <div className="flex items-center gap-1">
          {(['fecha_estimada', 'fecha_vencimiento'].includes(columna as string)) ? (
            <Input
              type="date"
              value={String(celdaEnEdicion.valor)}
              onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
              onKeyDown={manejarKeyDown}
              className="h-6 text-xs p-1 w-full"
              disabled={guardandoCambio}
            />
          ) : (['monto_a_abonar', 'imp_total'].includes(columna as string)) ? (
            <Input
              ref={inputRefLocal}
              type="number"
              step="0.01"
              value={String(celdaEnEdicion.valor)}
              onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
              onKeyDown={manejarKeyDown}
              className="h-6 text-xs p-1 w-full text-right"
              disabled={guardandoCambio}
            />
          ) : (columna === 'estado') ? (
            <div onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancelarEdicion(); } }}>
              <Select
                value={String(celdaEnEdicion.valor)}
                onValueChange={(value) => {
                  setCeldaEnEdicion(prev => prev ? { ...prev, valor: value } : null)
                  // Auto-guardar al seleccionar estado
                  setTimeout(() => guardarCambio(), 50)
                }}
                disabled={guardandoCambio}
                defaultOpen={true}
              >
                <SelectTrigger className="h-6 text-xs p-1 w-full">
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
            </div>
          ) : (columna === 'cuenta_contable') ? (
            <>
              <Input
                ref={inputRefLocal}
                type="text"
                list="cuentas-contables-list"
                value={String(celdaEnEdicion.valor || '')}
                onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
                onKeyDown={manejarKeyDown}
                className="h-6 text-xs p-1 w-full"
                disabled={guardandoCambio}
                placeholder="Escribí para buscar..."
              />
              <datalist id="cuentas-contables-list">
                {cuentas.map(cuenta => (
                  <option key={cuenta.categ} value={cuenta.categ}>
                    {cuenta.cuenta_contable}
                  </option>
                ))}
              </datalist>
            </>
          ) : (
            <Input
              ref={inputRefLocal}
              type="text"
              value={String(celdaEnEdicion.valor || '')}
              onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
              onKeyDown={manejarKeyDown}
              className="h-6 text-xs p-1 w-full"
              disabled={guardandoCambio}
            />
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={guardarCambio}
            disabled={guardandoCambio}
            className="h-6 w-6 p-0"
          >
            {guardandoCambio ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3 text-green-600" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={cancelarEdicion}
            disabled={guardandoCambio}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3 text-red-600" />
          </Button>
        </div>
      )
    }

    if (valor === null || valor === undefined) {
      return esEditable && modoEdicion ? (
        <div 
          className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
          onClick={(e) => iniciarEdicion(factura.id, columna, '', e)}
          title="Ctrl+Click para editar"
        >
          <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
          <span className="text-gray-400">-</span>
        </div>
      ) : <span className="text-gray-400">-</span>
    }

    switch (columna) {
      case 'fecha_emision':
      case 'fecha_importacion':
      case 'fecha_modificacion':
      case 'fecha_estimada':
      case 'fecha_vencimiento':
      case 'created_at':
        const contenidoFecha = formatearFecha(valor as string)
        return esEditable && modoEdicion ? (
          <div 
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => iniciarEdicion(factura.id, columna, valor, e)}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoFecha}
          </div>
        ) : contenidoFecha
      
      case 'imp_neto_gravado':
      case 'imp_neto_no_gravado':
      case 'imp_op_exentas':
      case 'otros_tributos':
      case 'iva':
      case 'imp_total':
      case 'tipo_cambio':
      case 'monto_a_abonar':
        const contenidoNumero = formatearNumero(valor as number)
        return esEditable && modoEdicion ? (
          <div 
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => iniciarEdicion(factura.id, columna, valor, e)}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoNumero}
          </div>
        ) : contenidoNumero
      
      case 'denominacion_emisor':
        const contenidoDenominacion = (
          <div className="max-w-xs truncate" title={valor as string}>
            {valor as string}
          </div>
        )
        return esEditable && modoEdicion ? (
          <div 
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => iniciarEdicion(factura.id, columna, valor, e)}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoDenominacion}
          </div>
        ) : contenidoDenominacion
      
      case 'estado':
        const contenidoEstado = (
          <Badge variant={valor === 'pendiente' ? 'secondary' : 'default'}>
            {valor as string}
          </Badge>
        )
        return esEditable && modoEdicion ? (
          <div 
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => iniciarEdicion(factura.id, columna, valor, e)}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoEstado}
          </div>
        ) : contenidoEstado
      
      default:
        const contenidoDefault = (valor !== null && valor !== undefined && valor !== '') ? String(valor) : '(vacío)'
        return esEditable && modoEdicion ? (
          <div 
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => {
              console.log('🖱️ CLICK en celda:', { columna, valor, ctrlKey: e.ctrlKey })
              iniciarEdicion(factura.id, columna, valor || '', e)
            }}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoDefault}
          </div>
        ) : contenidoDefault
    }
  }

  // Función para manejar la importación de Excel
  const manejarImportacionExcel = async () => {
    if (!archivoImportacion) return

    setImportandoExcel(true)
    setResultadoImportacion(null)

    try {
      const formData = new FormData()
      formData.append('file', archivoImportacion)
      formData.append('empresa', empresa)

      const response = await fetch('/api/import-facturas-arca', {
        method: 'POST',
        body: formData
      })

      const resultado = await response.json()
      setResultadoImportacion(resultado)

      if (resultado.success) {
        // Recargar las facturas después de una importación exitosa
        cargarFacturas()
        setMostrarImportador(false)
        setArchivoImportacion(null)
      }
    } catch (error) {
      console.error('Error en importación:', error)
      setResultadoImportacion({
        success: false,
        error: 'Error de conexión durante la importación'
      })
    } finally {
      setImportandoExcel(false)
    }
  }

  // Funciones para Subdiarios
  const cargarFacturasPeriodo = async (periodo: string) => {
    if (!periodo) {
      setFacturasPeriodo([])
      setSubtotales(null)
      return
    }

    setCargandoSubdiarios(true)
    try {
      const [mes, año] = periodo.split('/') // FIX: formato es MM/YYYY
      console.log('🔍 DEBUG cargarFacturasSubdiarios:', { periodo, mes, año })
      const { data, error } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('*')
        .eq('año_contable', parseInt(año))
        .eq('mes_contable', parseInt(mes))
        .order('fecha_emision', { ascending: false })

      if (error) throw error

      const facturas = data || []
      setFacturasPeriodo(facturas)
      
      // Calcular subtotales
      const totales = facturas.reduce((acc, f) => {
        acc.imp_total += Number(f.imp_total) || 0
        acc.iva += Number(f.iva) || 0
        acc.imp_neto_gravado += Number(f.imp_neto_gravado) || 0
        acc.imp_neto_no_gravado += Number(f.imp_neto_no_gravado) || 0
        acc.imp_op_exentas += Number(f.imp_op_exentas) || 0
        acc.otros_tributos += Number(f.otros_tributos) || 0
        return acc
      }, {
        imp_total: 0, iva: 0, imp_neto_gravado: 0, 
        imp_neto_no_gravado: 0, imp_op_exentas: 0, otros_tributos: 0
      })

      // Facturas C (tipo 11) por separado
      const facturasC = facturas.filter(f => f.tipo_comprobante === 11)
      const totalFacturasC = facturasC.reduce((sum, f) => sum + (Number(f.imp_total) || 0), 0)

      setSubtotales({ ...totales, facturas_c: totalFacturasC, cantidad_facturas_c: facturasC.length })
    } catch (error) {
      console.error('Error cargando período:', error)
    } finally {
      setCargandoSubdiarios(false)
    }
  }

  const cargarFacturasImputacion = async (periodoObjetivo?: string) => {
    // VALIDACIÓN: Siempre requerir período para filtro de fecha
    if (!periodoObjetivo) {
      console.log('⚠️ No se especificó período - no se cargan facturas')
      setFacturasImputacion([])
      return
    }
    try {
      console.log('🔍 DEBUG cargarFacturasImputacion INICIO:', { 
        periodoObjetivo, 
        mostrarSinImputar, 
        mostrarImputadas,
        timestamp: new Date().toISOString()
      })

      const filtrosEstado = []
      if (mostrarSinImputar) filtrosEstado.push('No')
      if (mostrarImputadas) filtrosEstado.push('Imputado')

      if (filtrosEstado.length === 0) {
        console.log('❌ No hay filtros de estado seleccionados')
        setFacturasImputacion([])
        return
      }

      let query = supabase.schema('msa').from('comprobantes_arca').select('*')

      // Filtro por fecha: solo facturas <= período objetivo
      if (periodoObjetivo) {
        const [mes, año] = periodoObjetivo.split('/') // Formato: MM/YYYY
        
        // Calcular último día del mes correctamente (no siempre 31)
        const ultimoDiaMes = new Date(parseInt(año), parseInt(mes), 0).getDate()
        const fechaLimite = `${año}-${mes.padStart(2, '0')}-${ultimoDiaMes.toString().padStart(2, '0')}`
        
        console.log('📅 Aplicando filtro fecha:', { periodoObjetivo, mes, año, ultimoDiaMes, fechaLimite })
        
        query = query.lte('fecha_emision', fechaLimite)
        
        // FILTROS DE ESTADO DDJJ (DESPUÉS del filtro de fecha)
        if (mostrarSinImputar && !mostrarImputadas) {
          // Solo sin imputar (CON filtro fecha ya aplicado arriba)
          query = query.eq('ddjj_iva', 'No')
          console.log('🔍 Filtro aplicado: fecha <= período Y ddjj_iva = No')
        } else if (!mostrarSinImputar && mostrarImputadas) {
          // Solo imputadas del período específico (CON filtro fecha ya aplicado arriba)
          query = query.eq('ddjj_iva', 'Imputado')
               .eq('año_contable', parseInt(año))
               .eq('mes_contable', parseInt(mes))
          console.log('🔍 Filtro aplicado: fecha <= período Y Imputado del período')
        } else if (mostrarSinImputar && mostrarImputadas) {
          // Ambos: Sin imputar + Imputadas del período (CON filtro fecha ya aplicado arriba)
          query = query.or(`ddjj_iva.eq.No,and(ddjj_iva.eq.Imputado,año_contable.eq.${parseInt(año)},mes_contable.eq.${parseInt(mes)})`)
          console.log('🔍 Filtro aplicado: fecha <= período Y (No O Imputado del período)')
        }
      } else {
        // Sin período específico, usar filtros básicos
        query = query.in('ddjj_iva', filtrosEstado)
        console.log('🔍 Filtro aplicado: filtros básicos sin período')
      }

      console.log('🚀 EJECUTANDO QUERY final con período:', periodoObjetivo)
      const { data, error } = await query.order('fecha_emision', { ascending: false })

      if (error) {
        console.error('❌ Error en query:', error)
        throw error
      }

      console.log('✅ Facturas encontradas:', data?.length || 0)
      setFacturasImputacion(data || [])
    } catch (error) {
      console.error('Error cargando facturas imputación:', error)
    }
  }

  const ejecutarImputacion = async () => {
    if (facturasSeleccionadas.size === 0 || !periodoImputacion) return

    try {
      const [mes, año] = periodoImputacion.split('/') // Formato: MM/YYYY
      const facturasIds = Array.from(facturasSeleccionadas)
      
      console.log('🔍 DEBUG ejecutarImputacion:', {
        periodoImputacion,
        mes: parseInt(mes),
        año: parseInt(año), 
        facturasSeleccionadas: facturasSeleccionadas.size,
        totalIds: facturasIds.length
      })

      // Procesar en lotes para evitar URL muy larga
      const LOTE_SIZE = 20
      for (let i = 0; i < facturasIds.length; i += LOTE_SIZE) {
        const lote = facturasIds.slice(i, i + LOTE_SIZE)
        console.log(`📦 Procesando lote ${Math.floor(i/LOTE_SIZE) + 1}: ${lote.length} facturas`)
        
        const { error } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({
            año_contable: parseInt(año),
            mes_contable: parseInt(mes),
            ddjj_iva: 'Imputado'
          })
          .in('id', lote)
        
        if (error) {
          console.error(`❌ Error en lote ${Math.floor(i/LOTE_SIZE) + 1}:`, error)
          throw error
        }
      }

      console.log('✅ Imputación completada exitosamente')
      
      // Limpiar selecciones y recargar
      setFacturasSeleccionadas(new Set())
      setMostrarModalImputar(false)
      setPeriodoImputacion('')
      // NO recargar facturas automáticamente después de imputar
      if (periodoConsulta) await cargarFacturasPeriodo(periodoConsulta)
      
      alert(`${facturasIds.length} facturas imputadas al período ${periodoImputacion}`)
    } catch (error) {
      console.error('Error en imputación:', error)
      alert('Error al imputar facturas')
    }
  }

  const confirmarDDJJ = async () => {
    if (!periodoConsulta) return

    // Confirmar acción
    const confirmar = window.confirm(
      `¿Confirmar DDJJ para el período ${periodoConsulta}?\n\n` +
      `Esto cambiará TODAS las facturas "Imputado" a "DDJJ OK" y el período quedará cerrado.\n\n` +
      `⚠️ Esta acción NO se puede deshacer.`
    )
    
    if (!confirmar) return

    try {
      const [mes, año] = periodoConsulta.split('/')
      
      // Actualizar todas las facturas imputadas del período a DDJJ OK
      const { error } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .update({ ddjj_iva: 'DDJJ OK' })
        .eq('mes_contable', parseInt(mes))
        .eq('año_contable', parseInt(año))
        .eq('ddjj_iva', 'Imputado')

      if (error) {
        console.error('Error confirmando DDJJ:', error)
        alert('Error al confirmar DDJJ: ' + error.message)
        return
      }

      // Recargar facturas del período para mostrar cambios
      await cargarFacturasPeriodo(periodoConsulta)
      
      // DESCARGA AUTOMÁTICA: Obtener facturas actualizadas directamente de BD
      const { data: facturasActualizadas, error: errorFetch } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('*')
        .eq('mes_contable', parseInt(mes))
        .eq('año_contable', parseInt(año))
        .eq('ddjj_iva', 'DDJJ OK')

      if (errorFetch) {
        console.error('Error obteniendo facturas para descarga:', errorFetch)
        alert(`✅ DDJJ confirmada para período ${periodoConsulta}\n\n⚠️ Error obteniendo datos para descarga automática`)
        return
      }

      const facturasConfirmadas = facturasActualizadas || []
      
      console.log('📥 Iniciando descarga automática...', {
        periodo: periodoConsulta,
        totalFacturas: facturasConfirmadas.length
      })
      
      alert(`✅ DDJJ confirmada para período ${periodoConsulta}\n\n📊 Para generar reportes, usa el botón "📊 Generar PDF + Excel" cuando lo necesites.`)
    } catch (error) {
      console.error('Error confirmando DDJJ:', error)
      alert('Error al confirmar DDJJ')
    }
  }

  // Generar reportes independiente - sin restricción de estado DDJJ
  const generarReportesPeriodo = async () => {
    if (!periodoConsulta) {
      alert('Selecciona un período para generar reportes')
      return
    }

    try {
      const [mes, año] = periodoConsulta.split('/')
      
      // Obtener todas las facturas del período (independiente del estado DDJJ)
      const { data: facturasReporte, error } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('*')
        .eq('mes_contable', parseInt(mes))
        .eq('año_contable', parseInt(año))

      if (error) {
        console.error('Error obteniendo facturas para reporte:', error)
        alert('Error obteniendo datos para reporte: ' + error.message)
        return
      }

      const facturasProcesar = facturasReporte || []
      
      console.log('📊 Generando reportes independientes...', {
        periodo: periodoConsulta,
        totalFacturas: facturasProcesar.length,
        estados: facturasProcesar.map(f => f.ddjj_iva)
      })
      
      if (facturasProcesar.length === 0) {
        alert(`⚠️ No hay facturas registradas para el período ${periodoConsulta}`)
        return
      }

      // Sistema de selección de carpeta mejorado
      let directorioDestino = null
      let ubicacionFinal = 'carpeta Descargas'
      
      if ('showDirectoryPicker' in window) {
        try {
          // Opciones de destino
          const opciones = [
            '1. Cambiar carpeta por defecto',
            carpetaPorDefecto ? `2. Usar carpeta por defecto actual (${carpetaPorDefecto.name})` : '2. Establecer carpeta por defecto',
            '3. Cancelar descarga',
            '',
            'Elige una opción (1, 2 o 3):'
          ].join('\n')
          
          const respuesta = prompt(opciones)
          
          if (respuesta === '1') {
            // Cambiar carpeta por defecto
            const nuevaCarpetaPorDefecto = await (window as any).showDirectoryPicker({
              startIn: carpetaPorDefecto || 'downloads' // Iniciar desde carpeta actual o Descargas
            })
            setCarpetaPorDefecto(nuevaCarpetaPorDefecto)
            directorioDestino = nuevaCarpetaPorDefecto
            ubicacionFinal = `nueva carpeta por defecto "${nuevaCarpetaPorDefecto.name}"`
            console.log('📁 Nueva carpeta por defecto establecida:', nuevaCarpetaPorDefecto.name)
          } else if (respuesta === '2') {
            if (carpetaPorDefecto && !carpetaPorDefecto.isFromStorage) {
              // Usar carpeta por defecto existente (handle real)
              directorioDestino = carpetaPorDefecto
              ubicacionFinal = `carpeta por defecto "${carpetaPorDefecto.name}"`
              console.log('📁 Usando carpeta por defecto:', carpetaPorDefecto.name)
            } else {
              // Establecer carpeta por defecto (primera vez o recarga desde localStorage)
              const nuevaCarpeta = await (window as any).showDirectoryPicker()
              setCarpetaPorDefecto(nuevaCarpeta)
              directorioDestino = nuevaCarpeta
              ubicacionFinal = `carpeta por defecto establecida "${nuevaCarpeta.name}"`
              console.log('📁 Carpeta por defecto establecida:', nuevaCarpeta.name)
            }
          } else {
            // Opción 3 o cualquier otra cosa = Cancelar descarga
            console.log('📁 Descarga cancelada por el usuario')
            alert('📁 Descarga cancelada')
            return // Salir sin generar archivos
          }
        } catch (error) {
          console.log('Usuario canceló selección de carpeta')
          alert('📁 Descarga cancelada')
          return // Salir sin generar archivos
        }
      }

      // Generar archivos con opción de carpeta personalizada
      console.log('🔍 DEBUG: Iniciando generación archivos con facturas:', facturasProcesar.length)
      console.log('🔍 DEBUG: Primera factura para procesar:', facturasProcesar[0])
      console.log('🔍 DEBUG: DirectorioDestino antes de Excel:', directorioDestino ? directorioDestino.name : 'null')
      
      await generarExcelConCarpeta(facturasProcesar, periodoConsulta, directorioDestino)
      
      console.log('🔍 DEBUG: DirectorioDestino antes de PDF:', directorioDestino ? directorioDestino.name : 'null')
      // Generar PDF inmediatamente después del Excel, sin timeout
      await generarPDFConCarpeta(facturasProcesar, periodoConsulta, directorioDestino)
      
      alert(`📊 Reportes generados para período ${periodoConsulta}\n\n📥 Descargando:\n• Excel con ${facturasProcesar.length} facturas\n• PDF con resumen detallado\n\n📁 Archivos guardados en ${ubicacionFinal}`)
      
    } catch (error) {
      console.error('Error generando reportes:', error)
      alert('Error al generar reportes')
    }
  }

  // Función helper para generar nombres únicos de archivo
  const generarNombreUnico = async (directorio: any, nombreBase: string, extension: string): Promise<string> => {
    if (!directorio) return `${nombreBase}.${extension}` // Si no hay directorio personalizado, usar nombre base
    
    let contador = 0
    let nombreFinal = `${nombreBase}.${extension}`
    
    try {
      // Intentar acceder al archivo para ver si existe (sin crear)
      while (true) {
        try {
          await directorio.getFileHandle(nombreFinal, { create: false })
          // Si llegamos aquí, el archivo existe, intentar con siguiente número
          contador++
          nombreFinal = `${nombreBase} (${contador}).${extension}`
          console.log(`📝 Archivo existe, probando: ${nombreFinal}`)
        } catch (error) {
          // Error significa que el archivo no existe, podemos usar este nombre
          console.log(`📝 Nombre disponible encontrado: ${nombreFinal}`)
          break
        }
      }
    } catch (error) {
      console.log('Error verificando archivos existentes:', error)
      // En caso de error, usar el nombre base
      nombreFinal = `${nombreBase}.${extension}`
    }
    
    console.log(`✅ Nombre único final: ${nombreFinal}`)
    return nombreFinal
  }

  // Generar Excel con opción de carpeta personalizada
  const generarExcelConCarpeta = async (facturas: FacturaArca[], periodo: string, directorio: any = null) => {
    try {
      console.log('📊 Generando Excel con', facturas.length, 'facturas')
      
      // Validar datos de entrada
      if (!facturas || facturas.length === 0) {
        throw new Error('No hay facturas para exportar')
      }
      
      // Función para formato Excel contabilidad - sin puntos en contenido, coma decimal
      const formatearNumeroExcel = (valor) => {
        if (valor === 0 || valor === null || valor === undefined) return 0
        // Convertir a string con coma como separador decimal, sin puntos de miles
        return parseFloat(valor.toFixed(2))
      }

      // Preparar datos para Excel - Formato LIBRO IVA COMPRAS
      const datosExcel = facturas.map((f, index) => {
        console.log(`🔍 DEBUG Excel: Procesando factura ${index + 1}:`, {
          fecha_emision: f.fecha_emision,
          denominacion_emisor: f.denominacion_emisor,
          cuit: f.cuit,
          tipo_comprobante: f.tipo_comprobante
        })
        
        // Calcular IVA Diferencial (todo lo que NO es 21%)
        const ivaDiferencial = (f.iva_2_5 || 0) + (f.iva_5 || 0) + (f.iva_10_5 || 0) + (f.iva_27 || 0)
        
        return {
          'Fecha': f.fecha_emision || '',
          'Tipo-N° Comp.': f.tipo_comprobante || '',
          'Razón Social': f.denominacion_emisor || '',
          'C.U.I.T.': f.cuit || '',
          'Neto Gravado': formatearNumeroExcel(f.imp_neto_gravado),
          'Neto No Gravado': formatearNumeroExcel(f.imp_neto_no_gravado),
          'Op. Exentas': formatearNumeroExcel(f.imp_op_exentas),
          'Otros Tributos': formatearNumeroExcel(f.otros_tributos),
          'IVA 21%': formatearNumeroExcel(f.iva_21),
          'IVA Diferencial': formatearNumeroExcel(ivaDiferencial),
          'Total IVA': formatearNumeroExcel(f.iva),
          'Imp. Total': formatearNumeroExcel(f.imp_total)
        }
      })

      // Calcular totales para Excel
      const totales = facturas.reduce((acc, f) => ({
        neto_gravado: acc.neto_gravado + (f.imp_neto_gravado || 0),
        neto_no_gravado: acc.neto_no_gravado + (f.imp_neto_no_gravado || 0),
        op_exentas: acc.op_exentas + (f.imp_op_exentas || 0),
        otros_tributos: acc.otros_tributos + (f.otros_tributos || 0),
        iva_diferencial: acc.iva_diferencial + ((f.iva_2_5 || 0) + (f.iva_5 || 0) + (f.iva_10_5 || 0) + (f.iva_27 || 0)),
        total_iva: acc.total_iva + (f.iva || 0),
        importe_total: acc.importe_total + (f.imp_total || 0),
        // Alícuotas separadas
        iva_2_5: acc.iva_2_5 + (f.iva_2_5 || 0),
        iva_5: acc.iva_5 + (f.iva_5 || 0),
        iva_10_5: acc.iva_10_5 + (f.iva_10_5 || 0),
        iva_21: acc.iva_21 + (f.iva_21 || 0),
        iva_27: acc.iva_27 + (f.iva_27 || 0),
        neto_0: acc.neto_0 + (f.neto_grav_iva_0 || 0),
        neto_2_5: acc.neto_2_5 + (f.neto_grav_iva_2_5 || 0),
        neto_5: acc.neto_5 + (f.neto_grav_iva_5 || 0),
        neto_10_5: acc.neto_10_5 + (f.neto_grav_iva_10_5 || 0),
        neto_21: acc.neto_21 + (f.neto_grav_iva_21 || 0),
        neto_27: acc.neto_27 + (f.neto_grav_iva_27 || 0)
      }), {
        neto_gravado: 0, neto_no_gravado: 0, op_exentas: 0, otros_tributos: 0,
        iva_diferencial: 0, total_iva: 0, importe_total: 0,
        iva_2_5: 0, iva_5: 0, iva_10_5: 0, iva_21: 0, iva_27: 0,
        neto_0: 0, neto_2_5: 0, neto_5: 0, neto_10_5: 0, neto_21: 0, neto_27: 0
      })

      // Calcular Monotributista (facturas tipo C)
      const monotributista = facturas
        .filter(f => f.tipo_comprobante === 11) // Tipo 11 = Factura C (MONOTRIBUTISTA)
        .reduce((acc, f) => acc + (f.imp_total || 0), 0)

      // Calcular total general + monotributo
      const totalGeneral = totales.neto_gravado + totales.neto_no_gravado + totales.op_exentas + totales.otros_tributos + totales.total_iva + totales.importe_total

      // Agregar filas de totales
      const filasExtras = [
        {},
        { 'Fecha': 'TOTALES GENERALES', 'Neto Gravado': formatearNumeroExcel(totales.neto_gravado), 'Neto No Gravado': formatearNumeroExcel(totales.neto_no_gravado), 'Op. Exentas': formatearNumeroExcel(totales.op_exentas), 'Otros Tributos': formatearNumeroExcel(totales.otros_tributos), 'IVA 21%': formatearNumeroExcel(totales.iva_21), 'IVA Diferencial': formatearNumeroExcel(totales.iva_diferencial), 'Total IVA': formatearNumeroExcel(totales.total_iva), 'Imp. Total': formatearNumeroExcel(totales.importe_total) },
        {},
        { 'Fecha': 'Detalle por Alícuotas', 'Tipo-N° Comp.': 'Neto $', 'Razón Social': 'Alíc.', 'C.U.I.T.': 'IVA $' },
        { 'Fecha': 'Al 0%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_0), 'Razón Social': '0.00', 'C.U.I.T.': formatearNumeroExcel(0) },
        { 'Fecha': 'Al 2.5%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_2_5), 'Razón Social': '2.50', 'C.U.I.T.': formatearNumeroExcel(totales.iva_2_5) },
        { 'Fecha': 'Al 5%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_5), 'Razón Social': '5.00', 'C.U.I.T.': formatearNumeroExcel(totales.iva_5) },
        { 'Fecha': 'Al 10.5%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_10_5), 'Razón Social': '10.50', 'C.U.I.T.': formatearNumeroExcel(totales.iva_10_5) },
        { 'Fecha': 'Al 21%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_21), 'Razón Social': '21.00', 'C.U.I.T.': formatearNumeroExcel(totales.iva_21) },
        { 'Fecha': 'Al 27%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_27), 'Razón Social': '27.00', 'C.U.I.T.': formatearNumeroExcel(totales.iva_27) },
        { 'Fecha': 'TOTALES', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_gravado), 'Razón Social': '----', 'C.U.I.T.': formatearNumeroExcel(totales.total_iva) },
        {},
        {},
        { 'Fecha': 'TOTALES GENERALES:' },
        { 'Fecha': 'Concepto ', 'Tipo-N° Comp.': 'Importe $' },
        { 'Fecha': 'Neto Gravado ', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_gravado) },
        { 'Fecha': 'Neto No Gravado', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_no_gravado) },
        { 'Fecha': 'Op. Exentas ', 'Tipo-N° Comp.': formatearNumeroExcel(totales.op_exentas) },
        { 'Fecha': 'Otros Tributos ', 'Tipo-N° Comp.': formatearNumeroExcel(totales.otros_tributos) },
        { 'Fecha': 'Total IVA ', 'Tipo-N° Comp.': formatearNumeroExcel(totales.total_iva) },
        { 'Fecha': 'Monotributo', 'Tipo-N° Comp.': formatearNumeroExcel(monotributista) },
        { 'Fecha': 'Importe Total', 'Tipo-N° Comp.': formatearNumeroExcel(totales.importe_total) }
      ]

      // Crear libro Excel
      const datosCompletos = [...datosExcel, ...filasExtras]
      const ws = XLSX.utils.json_to_sheet(datosCompletos)
      
      // Aplicar formato contabilidad a columnas numéricas (E a L)
      const range = XLSX.utils.decode_range(ws['!ref'])
      if (!ws['!cols']) ws['!cols'] = []
      
      // Formato contabilidad para columnas numéricas
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (let C = 4; C <= 11; ++C) { // Columnas E (4) a L (11) - las numéricas
          const cellAddress = XLSX.utils.encode_cell({r: R, c: C})
          if (ws[cellAddress] && typeof ws[cellAddress].v === 'number') {
            ws[cellAddress].s = { 
              numFmt: '#,##0.00;[Red]-#,##0.00' // Formato contabilidad con coma decimal
            }
          }
        }
      }
      
      const wb = XLSX.utils.book_new()
      
      // Calcular fechas del período correctamente
      const [mes, año] = periodo.split('/')
      const fechaInicio = `01/${mes.padStart(2, '0')}/${año}`
      const ultimoDiaMes = new Date(parseInt(año), parseInt(mes), 0).getDate()
      const fechaFin = `${ultimoDiaMes.toString().padStart(2, '0')}/${mes.padStart(2, '0')}/${año}`
      
      XLSX.utils.book_append_sheet(wb, ws, `LIBRO IVA COMPRAS ${mes}-${año}`)
      
      // Generar nombre único para evitar sobreescribir
      const añoCorto = año.slice(-2)
      const nombreBase = `LIBRO IVA COMPRAS ${añoCorto}-${mes.padStart(2, '0')}`
      const filename = await generarNombreUnico(directorio, nombreBase, 'xlsx')

      if (directorio) {
        // Guardar en carpeta personalizada usando File System Access API
        const contenidoExcel = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        const archivoHandle = await directorio.getFileHandle(filename, { create: true })
        const writable = await archivoHandle.createWritable()
        await writable.write(contenidoExcel)
        await writable.close()
        console.log('✅ Excel guardado en carpeta personalizada:', filename)
      } else {
        // Descargar normalmente
        XLSX.writeFile(wb, filename)
        console.log('✅ Excel descargado en carpeta por defecto:', filename)
      }
      
    } catch (error) {
      console.error('❌ Error generando Excel:', error)
      alert('Error al generar archivo Excel: ' + (error as Error).message)
    }
  }

  // Generar PDF con opción de carpeta personalizada
  const generarPDFConCarpeta = async (facturas: FacturaArca[], periodo: string, directorio: any = null) => {
    try {
      console.log('🔍 DEBUG PDF: Iniciando generación con', facturas.length, 'facturas')
      console.log('🔍 DEBUG PDF: Período recibido:', periodo)
      console.log('🔍 DEBUG PDF: Primera factura recibida:', facturas[0])
      console.log('🔍 DEBUG PDF: Directorio destino:', directorio ? directorio.name : 'Descargas por defecto')
      
      if (!facturas || facturas.length === 0) {
        console.error('🚨 DEBUG PDF: No hay facturas para procesar!')
        throw new Error('No hay facturas para generar PDF')
      }
      
      // PDF en orientación horizontal (landscape)
      const doc = new jsPDF('landscape', 'mm', 'a4')
      
      // Calcular fechas del período
      const [mes, año] = periodo.split('/')
      const fechaInicio = `01/${mes.padStart(2, '0')}/${año}`
      const ultimoDiaMes = new Date(parseInt(año), parseInt(mes), 0).getDate()
      const fechaFin = `${ultimoDiaMes.toString().padStart(2, '0')}/${mes.padStart(2, '0')}/${año}`
      
      // Header profesional
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('MARTINEZ SOBRADO AGRO SRL', 20, 15)
      doc.text('30-61778601-6', 180, 15)
      doc.text('COMPRAS', 250, 15)
      
      doc.setFontSize(12)
      doc.setFont(undefined, 'normal')
      doc.text(`LIBRO DE IVA COMPRAS - Movimientos desde el ${fechaInicio} hasta el ${fechaFin}`, 20, 25)
      
      // Información general
      doc.setFontSize(10)
      doc.text(`Fecha generación: ${new Date().toLocaleDateString('es-AR')}`, 20, 35)
      doc.text(`Total facturas: ${facturas.length}`, 150, 35)
      
      // Calcular totales igual que Excel
      console.log('🔍 DEBUG PDF: Calculando totales...')
      const totales = facturas.reduce((acc, f) => ({
        neto_gravado: acc.neto_gravado + (f.imp_neto_gravado || 0),
        neto_no_gravado: acc.neto_no_gravado + (f.imp_neto_no_gravado || 0),
        op_exentas: acc.op_exentas + (f.imp_op_exentas || 0),
        otros_tributos: acc.otros_tributos + (f.otros_tributos || 0),
        iva_diferencial: acc.iva_diferencial + ((f.iva_2_5 || 0) + (f.iva_5 || 0) + (f.iva_10_5 || 0) + (f.iva_27 || 0)),
        total_iva: acc.total_iva + (f.iva || 0),
        importe_total: acc.importe_total + (f.imp_total || 0),
        // Alícuotas separadas
        iva_2_5: acc.iva_2_5 + (f.iva_2_5 || 0),
        iva_5: acc.iva_5 + (f.iva_5 || 0),
        iva_10_5: acc.iva_10_5 + (f.iva_10_5 || 0),
        iva_21: acc.iva_21 + (f.iva_21 || 0),
        iva_27: acc.iva_27 + (f.iva_27 || 0),
        neto_0: acc.neto_0 + (f.neto_grav_iva_0 || 0),
        neto_2_5: acc.neto_2_5 + (f.neto_grav_iva_2_5 || 0),
        neto_5: acc.neto_5 + (f.neto_grav_iva_5 || 0),
        neto_10_5: acc.neto_10_5 + (f.neto_grav_iva_10_5 || 0),
        neto_21: acc.neto_21 + (f.neto_grav_iva_21 || 0),
        neto_27: acc.neto_27 + (f.neto_grav_iva_27 || 0)
      }), {
        neto_gravado: 0, neto_no_gravado: 0, op_exentas: 0, otros_tributos: 0,
        iva_diferencial: 0, total_iva: 0, importe_total: 0,
        iva_2_5: 0, iva_5: 0, iva_10_5: 0, iva_21: 0, iva_27: 0,
        neto_0: 0, neto_2_5: 0, neto_5: 0, neto_10_5: 0, neto_21: 0, neto_27: 0
      })

      // Calcular Monotributista (facturas tipo C)
      const monotributista = facturas
        .filter(f => f.tipo_comprobante === 11) // Tipo 11 = Factura C (MONOTRIBUTISTA)
        .reduce((acc, f) => acc + (f.imp_total || 0), 0)

      console.log('🔍 DEBUG PDF: Totales calculados:', totales)
      
      // Función para formato PDF con puntos de miles + espacios + ceros como " -   "
      const formatearNumeroPDF = (valor) => {
        if (valor === 0 || valor === null || valor === undefined) return ' -   '
        const formatted = valor.toLocaleString('es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
        return ` ${formatted} `
      }

      // Tabla horizontal con formato LIBRO IVA COMPRAS (mostrar todas las facturas)
      console.log('🔍 DEBUG PDF: Preparando datos tabla con', facturas.length, 'facturas')
      const datosTabla = facturas.map((f, index) => {
        if (index < 3) { // Solo log de las primeras 3 para no saturar
          console.log(`🔍 DEBUG PDF: Procesando factura ${index + 1}:`, {
            fecha: f.fecha_emision,
            proveedor: f.denominacion_emisor,
            cuit: f.cuit,
            total: f.imp_total
          })
        }
        
        // Calcular IVA Diferencial para cada factura
        const ivaDiferencial = (f.iva_2_5 || 0) + (f.iva_5 || 0) + (f.iva_10_5 || 0) + (f.iva_27 || 0)
        
        return [
          f.fecha_emision || '',
          f.tipo_comprobante || '',
          (f.denominacion_emisor || '').substring(0, 18),
          f.cuit || '',
          formatearNumeroPDF(f.imp_neto_gravado).trim(),
          formatearNumeroPDF(f.imp_neto_no_gravado).trim(),
          formatearNumeroPDF(f.imp_op_exentas).trim(),
          formatearNumeroPDF(f.otros_tributos).trim(),
          formatearNumeroPDF(f.iva_21).trim(),
          formatearNumeroPDF(ivaDiferencial).trim(),
          formatearNumeroPDF(f.iva).trim(),
          formatearNumeroPDF(f.imp_total).trim()
        ]
      })

      // Agregar fila totales
      datosTabla.push([
        '', '', 'TOTALES GENERALES', '',
        formatearNumeroPDF(totales.neto_gravado).trim(),
        formatearNumeroPDF(totales.neto_no_gravado).trim(),
        formatearNumeroPDF(totales.op_exentas).trim(),
        formatearNumeroPDF(totales.otros_tributos).trim(),
        formatearNumeroPDF(totales.iva_21).trim(),
        formatearNumeroPDF(totales.iva_diferencial).trim(),
        formatearNumeroPDF(totales.total_iva).trim(),
        formatearNumeroPDF(totales.importe_total).trim()
      ])


      console.log('🔍 DEBUG PDF: Datos tabla preparados:', datosTabla.length, 'filas')
      console.log('🔍 DEBUG PDF: Primera fila tabla:', datosTabla[0])

      // Usar autoTable para tabla horizontal
      console.log('🔍 DEBUG PDF: Generando tabla con autoTable...')
      autoTable(doc, {
        head: [['Fecha', 'Tipo-N° Comp.', 'Razón Social', 'C.U.I.T.', 'Neto Gravado', 'Neto No Gravado', 'Op. Exentas', 'Otros Tributos', 'IVA 21%', 'IVA Diferencial', 'Total IVA', 'Imp. Total']],
        body: datosTabla,
        startY: 45,
        styles: { fontSize: 6, cellPadding: 1 },
        headStyles: { fillColor: [66, 139, 202], fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 20 },  // Fecha
          1: { cellWidth: 25 },  // Tipo-N° Comp
          2: { cellWidth: 30 },  // Razón Social  
          3: { cellWidth: 25 },  // CUIT
          4: { cellWidth: 22 },  // Neto Gravado
          5: { cellWidth: 22 },  // Neto No Gravado
          6: { cellWidth: 20 },  // Op. Exentas
          7: { cellWidth: 20 },  // Otros Tributos
          8: { cellWidth: 18 },  // IVA 21%
          9: { cellWidth: 18 },  // IVA Diferencial
          10: { cellWidth: 20 }, // Total IVA
          11: { cellWidth: 22 }  // Imp. Total
        }
      })
      console.log('🔍 DEBUG PDF: Tabla generada exitosamente')
      
      // Nueva página para desglose por alícuotas
      doc.addPage('landscape', 'a4')
      
      // Header para página de desglose
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('MARTINEZ SOBRADO AGRO SRL', 20, 15)
      doc.text('30-61778601-6', 180, 15)
      doc.text('DESGLOSE IVA POR ALÍCUOTAS', 200, 15)
      
      doc.setFontSize(12)
      doc.text(`Período: ${fechaInicio} al ${fechaFin}`, 20, 30)
      
      const yPosition = 50
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      doc.text('Detalle por Alícuotas:', 20, yPosition)
      
      const desgloseData = [
        ['Al 0%', formatearNumeroPDF(totales.neto_0).trim(), '0.00', formatearNumeroPDF(0).trim()],
        ['Al 2.5%', formatearNumeroPDF(totales.neto_2_5).trim(), '2.50', formatearNumeroPDF(totales.iva_2_5).trim()],
        ['Al 5%', formatearNumeroPDF(totales.neto_5).trim(), '5.00', formatearNumeroPDF(totales.iva_5).trim()],
        ['Al 10.5%', formatearNumeroPDF(totales.neto_10_5).trim(), '10.50', formatearNumeroPDF(totales.iva_10_5).trim()],
        ['Al 21%', formatearNumeroPDF(totales.neto_21).trim(), '21.00', formatearNumeroPDF(totales.iva_21).trim()],
        ['Al 27%', formatearNumeroPDF(totales.neto_27).trim(), '27.00', formatearNumeroPDF(totales.iva_27).trim()],
        ['TOTALES', formatearNumeroPDF(totales.neto_gravado).trim(), '----', formatearNumeroPDF(totales.total_iva).trim()]
      ]

      autoTable(doc, {
        head: [['Detalle', 'Neto $', 'Alíc.', 'IVA $']],
        body: desgloseData,
        startY: yPosition + 5,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
        columnStyles: {
          0: { cellWidth: 30 },  // Detalle
          1: { cellWidth: 40 },  // Neto $
          2: { cellWidth: 20 },  // Alíc.
          3: { cellWidth: 40 }   // IVA $
        },
        didDrawCell: function(data) {
          // Resaltar fila TOTALES (última fila, índice 6)
          if (data.row.index === 6) {
            doc.setFont(undefined, 'bold')
            doc.setFillColor(220, 220, 220) // Color gris claro
          }
        }
      })
      
      // Agregar totales generales y MONOTRIBUTISTA en página desglose
      const yTotales = doc.lastAutoTable.finalY + 15
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      doc.text('TOTALES GENERALES:', 20, yTotales)
      
      const totalesGenerales = [
        ['Neto Gravado', formatearNumeroPDF(totales.neto_gravado).trim()],
        ['Neto No Gravado', formatearNumeroPDF(totales.neto_no_gravado).trim()],
        ['Op. Exentas', formatearNumeroPDF(totales.op_exentas).trim()],
        ['Otros Tributos', formatearNumeroPDF(totales.otros_tributos).trim()],
        ['Total IVA', formatearNumeroPDF(totales.total_iva).trim()],
        ['Monotributo', formatearNumeroPDF(monotributista).trim()],
        ['Importe Total', formatearNumeroPDF(totales.importe_total).trim()]
      ]
      
      autoTable(doc, {
        head: [['Concepto', 'Importe $']],
        body: totalesGenerales,
        startY: yTotales + 5,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 60, halign: 'right' }
        }
      })

      // Generar nombre único para evitar sobreescribir  
      const añoCorto = año.slice(-2)
      const nombreBase = `LIBRO IVA COMPRAS ${añoCorto}-${mes.padStart(2, '0')}`
      const filename = await generarNombreUnico(directorio, nombreBase, 'pdf')

      console.log('🔍 DEBUG PDF: Antes de guardar - directorio:', directorio ? 'SI EXISTE' : 'NULL')
      console.log('🔍 DEBUG PDF: Filename único generado:', filename)

      if (directorio) {
        // Guardar en carpeta personalizada usando File System Access API
        console.log('🔍 DEBUG PDF: Intentando guardar en carpeta personalizada:', directorio.name)
        const contenidoPDF = doc.output('arraybuffer')
        const archivoHandle = await directorio.getFileHandle(filename, { create: true })
        const writable = await archivoHandle.createWritable()
        await writable.write(contenidoPDF)
        await writable.close()
        console.log('✅ PDF guardado en carpeta personalizada:', filename)
      } else {
        // Descargar normalmente
        console.log('🔍 DEBUG PDF: Directorio es null, descargando en Descargas por defecto')
        doc.save(filename)
        console.log('✅ PDF descargado en carpeta por defecto:', filename)
      }
      
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert('Error al generar archivo PDF: ' + (error as Error).message)
    }
  }

  // Validar si un período ya está declarado (tiene facturas con DDJJ OK)
  const validarPeriodoDeclarado = async (periodo: string): Promise<boolean> => {
    const [mes, año] = periodo.split('/')
    
    try {
      const { data, error } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('id')
        .eq('mes_contable', parseInt(mes))
        .eq('año_contable', parseInt(año))
        .eq('ddjj_iva', 'DDJJ OK')
        .limit(1)
        
      if (error) {
        console.error('Error validando período:', error)
        return false
      }
      
      return data && data.length > 0
    } catch (error) {
      console.error('Error validando período:', error)
      return false
    }
  }

  // Generar y descargar Excel DDJJ
  const descargarExcelDDJJ = (facturas: FacturaArca[], periodo: string) => {
    try {
      console.log('📊 Generando Excel con', facturas.length, 'facturas')
      
      // Validar datos de entrada
      if (!facturas || facturas.length === 0) {
        throw new Error('No hay facturas para exportar')
      }
      
      // Preparar datos para Excel - TODOS los campos de la pantalla consulta
      const datosExcel = facturas.map((f, index) => {
        console.log(`📋 Procesando factura ${index + 1}:`, f)
        return {
          'Fecha': f.fecha_factura || '',
          'Proveedor': f.razon_social || '',
          'CUIT': f.cuit_emisor || '',
          'Tipo': f.tipo_comprobante || '',
          'Neto Gravado': f.imp_neto_gravado || 0,
          'Neto No Gravado': f.imp_neto_no_gravado || 0,
          'Op. Exentas': f.imp_op_exentas || 0,
          'Otros Tributos': f.otros_tributos || 0,
          'Total IVA': f.iva || 0,
          'Imp. Total': f.imp_total || 0,
          'Estado DDJJ': f.ddjj_iva || '',
          'Punto Venta': f.punto_venta || '',
          'Número Factura': f.numero_factura || '',
          'Mes Contable': f.mes_contable || '',
          'Año Contable': f.año_contable || '',
          'Fecha Emisión': f.fecha_emision || '',
          'Fecha Vencimiento': f.fecha_vencimiento || '',
          'CAI': f.cai || '',
          'Categoría': f.categ || ''
        }
      })

      console.log('📊 Datos Excel preparados:', datosExcel)

      // Crear libro Excel
      const ws = XLSX.utils.json_to_sheet(datosExcel)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `DDJJ ${periodo.replace('/', '-')}`)
      
      // Descargar archivo con nuevo formato: Subdiario Compras (MSA) aa-mm
      const [mes, año] = periodo.split('/')
      const añoCorto = año.slice(-2) // últimos 2 dígitos del año
      const filename = `Subdiario Compras (MSA) ${añoCorto}-${mes.padStart(2, '0')}.xlsx`
      console.log('💾 Descargando Excel:', filename)
      XLSX.writeFile(wb, filename)
      
      console.log('✅ Excel generado exitosamente:', filename)
      console.log('📁 Excel guardado como:', filename, 'en carpeta Descargas')
    } catch (error) {
      console.error('❌ Error detallado generando Excel:', error)
      console.error('📊 Facturas recibidas:', facturas)
      alert('Error al generar archivo Excel: ' + (error as Error).message)
    }
  }

  // Generar y descargar PDF DDJJ
  const descargarPDFDDJJ = (facturas: FacturaArca[], periodo: string) => {
    try {
      console.log('🔍 DEBUG PDF: Iniciando generación con', facturas.length, 'facturas')
      console.log('🔍 DEBUG PDF: Primera factura:', facturas[0])
      
      const doc = new jsPDF()
      
      // Título
      doc.setFontSize(16)
      doc.text(`DECLARACIÓN JURADA IVA - PERÍODO ${periodo}`, 20, 20)
      
      // Información general
      doc.setFontSize(10)
      doc.text(`Fecha generación: ${new Date().toLocaleDateString('es-AR')}`, 20, 35)
      doc.text(`Total facturas: ${facturas.length}`, 20, 42)
      
      // Mensaje si no hay facturas
      if (facturas.length === 0) {
        doc.setFontSize(12)
        doc.text('⚠️ No hay facturas en estado "DDJJ OK" para este período', 20, 60)
        doc.text('Verifique que las facturas estén correctamente imputadas y confirmadas.', 20, 75)
      }
      
      // Calcular totales
      const totales = facturas.reduce((acc, f) => ({
        neto_gravado: acc.neto_gravado + (f.imp_neto_gravado || 0),
        neto_no_gravado: acc.neto_no_gravado + (f.imp_neto_no_gravado || 0),
        op_exentas: acc.op_exentas + (f.imp_op_exentas || 0),
        total_iva: acc.total_iva + (f.iva || 0),
        otros_tributos: acc.otros_tributos + (f.otros_tributos || 0),
        importe_total: acc.importe_total + (f.imp_total || 0)
      }), {
        neto_gravado: 0, neto_no_gravado: 0, op_exentas: 0, 
        total_iva: 0, otros_tributos: 0, importe_total: 0
      })

      doc.text(`Total Neto Gravado: $${totales.neto_gravado.toLocaleString('es-AR')}`, 20, 49)
      doc.text(`Total IVA: $${totales.total_iva.toLocaleString('es-AR')}`, 20, 56)
      doc.text(`Total General: $${totales.importe_total.toLocaleString('es-AR')}`, 20, 63)
      
      // Tabla con facturas - TODOS los datos principales (máximo 50 por límites PDF)
      if (facturas.length > 0) {
        const datosTabla = facturas.slice(0, 50).map(f => [
          f.fecha_factura || '',
          (f.razon_social || '').substring(0, 20),
          f.cuit_emisor || '',
          f.tipo_comprobante || '',
          (f.imp_neto_gravado || 0).toLocaleString('es-AR'),
          (f.iva || 0).toLocaleString('es-AR'),
          (f.imp_total || 0).toLocaleString('es-AR'),
          f.ddjj_iva || ''
        ])

        // Usar autoTable importado
        autoTable(doc, {
          head: [['Fecha', 'Proveedor', 'CUIT', 'Tipo', 'Neto Grav.', 'IVA', 'Total', 'Estado']],
          body: datosTabla,
          startY: facturas.length === 0 ? 85 : 75,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [66, 139, 202] },
          columnStyles: {
            0: { cellWidth: 18 }, // Fecha
            1: { cellWidth: 25 }, // Proveedor
            2: { cellWidth: 25 }, // CUIT
            3: { cellWidth: 18 }, // Tipo
            4: { cellWidth: 20 }, // Neto Gravado
            5: { cellWidth: 20 }, // IVA
            6: { cellWidth: 20 }, // Total
            7: { cellWidth: 20 }  // Estado
          }
        })
        
        // Agregar nota si hay más facturas
        if (facturas.length > 50) {
          doc.setFontSize(9)
          doc.text(`⚠️ Mostrando primeras 50 de ${facturas.length} facturas. Descargue Excel para ver todas.`, 20, doc.lastAutoTable.finalY + 10)
        }
      }

      // Descargar archivo con nuevo formato: Subdiario Compras (MSA) aa-mm
      const [mes, año] = periodo.split('/')
      const añoCorto = año.slice(-2) // últimos 2 dígitos del año
      const filename = `Subdiario Compras (MSA) ${añoCorto}-${mes.padStart(2, '0')}.pdf`
      doc.save(filename)
      
      console.log('📥 PDF generado:', filename)
      console.log('📁 PDF guardado como:', filename, 'en carpeta Descargas')
    } catch (error) {
      console.error('Error generando PDF:', error)  
      alert('Error al generar archivo PDF')
    }
  }

  // Función gestión masiva de facturas
  const ejecutarGestionMasiva = async () => {
    if (facturasSeleccionadasGestion.size === 0) {
      alert('Selecciona al menos una factura')
      return
    }

    // Obtener rol real del usuario desde la URL
    const pathArray = window.location.pathname.split('/')
    const accessRoute = pathArray[1] // Primera parte después del dominio
    const rolUsuario = accessRoute === 'adminjms1320' ? 'admin' : 'contable'
    
    // Validar permisos según rol y cambios de estado
    const facturasArray = Array.from(facturasSeleccionadasGestion)
    
    // SOLO ADMIN puede revertir desde "DDJJ OK" hacia otros estados
    if (rolUsuario !== 'admin' && nuevoEstadoDDJJ && nuevoEstadoDDJJ !== 'sin-cambios') {
      const facturasProhibidas = facturasPeriodo.filter(f => 
        facturasArray.includes(f.id) && 
        f.ddjj_iva === 'DDJJ OK' && 
        nuevoEstadoDDJJ !== 'DDJJ OK' // Intentando cambiar DESDE "DDJJ OK" hacia otro estado
      )

      if (facturasProhibidas.length > 0) {
        alert(`❌ Sin permisos: Solo administrador puede revertir el estado "DDJJ OK". ${facturasProhibidas.length} facturas requieren permisos de administrador.`)
        return
      }
    }

    // Validación especial para ADMIN que intenta cambiar facturas DDJJ OK
    if (rolUsuario === 'admin') {
      const facturasDDJJOK = facturasPeriodo.filter(f => 
        facturasArray.includes(f.id) && 
        f.ddjj_iva === 'DDJJ OK' &&
        nuevoEstadoDDJJ && nuevoEstadoDDJJ !== 'sin-cambios' && nuevoEstadoDDJJ !== 'DDJJ OK'
      )

      if (facturasDDJJOK.length > 0) {
        const textoConfirmacion = prompt(
          `🚨 ADVERTENCIA CRÍTICA: MODIFICACIÓN DDJJ FISCAL\n\n` +
          `Estás intentando cambiar ${facturasDDJJOK.length} facturas desde estado "DDJJ OK" a "${nuevoEstadoDDJJ}".\n\n` +
          `⚠️ RIESGO: Las facturas con "DDJJ OK" ya fueron declaradas fiscalmente.\n` +
          `Cambiar su estado puede afectar declaraciones oficiales presentadas.\n\n` +
          `Si entiendes el riesgo y quieres continuar, tipea exactamente: CONTINUAR\n` +
          `Cualquier otro texto cancelará la operación.`
        )

        if (textoConfirmacion !== 'CONTINUAR') {
          alert('❌ Operación cancelada. No se modificaron las facturas.')
          return
        }
      }
    }

    const confirmar = window.confirm(
      `¿Confirmar cambios masivos?\n\n` +
      `• ${facturasSeleccionadasGestion.size} facturas seleccionadas\n` +
      `• Nuevo estado DDJJ: ${(nuevoEstadoDDJJ && nuevoEstadoDDJJ !== 'sin-cambios') ? nuevoEstadoDDJJ : '(sin cambios)'}\n` +
      `• Nuevo período: ${(nuevoPeriodo && nuevoPeriodo !== 'sin-cambios') ? nuevoPeriodo : '(sin cambios)'}\n\n` +
      `⚠️ Esta acción modificará múltiples registros.`
    )

    if (!confirmar) return

    try {
      // Preparar datos de actualización
      const updateData: any = {}
      
      if (nuevoEstadoDDJJ && nuevoEstadoDDJJ !== 'sin-cambios') {
        updateData.ddjj_iva = nuevoEstadoDDJJ
      }
      
      if (nuevoPeriodo && nuevoPeriodo !== 'sin-cambios') {
        const [mes, año] = nuevoPeriodo.split('/')
        updateData.mes_contable = parseInt(mes)
        updateData.año_contable = parseInt(año)
      }

      console.log('🔄 Ejecutando gestión masiva:', {
        facturas: facturasSeleccionadasGestion.size,
        updateData,
        rolUsuario
      })

      // Actualizar en lotes
      const facturasIds = Array.from(facturasSeleccionadasGestion)
      const LOTE_SIZE = 20
      
      for (let i = 0; i < facturasIds.length; i += LOTE_SIZE) {
        const lote = facturasIds.slice(i, i + LOTE_SIZE)
        
        const { error } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update(updateData)
          .in('id', lote)

        if (error) {
          throw new Error(`Error en lote ${Math.floor(i/LOTE_SIZE) + 1}: ${error.message}`)
        }
      }

      // Limpiar selecciones y recargar
      setFacturasSeleccionadasGestion(new Set())
      setNuevoEstadoDDJJ('')
      setNuevoPeriodo('')
      setMostrarGestionMasiva(false)
      
      if (periodoConsulta) await cargarFacturasPeriodo(periodoConsulta)
      
      alert(`✅ Gestión masiva completada: ${facturasIds.length} facturas actualizadas`)
    } catch (error) {
      console.error('Error en gestión masiva:', error)
      alert('Error en gestión masiva: ' + (error as Error).message)
    }
  }

  // FUNCIONES SICORE - RETENCIONES GANANCIAS
  
  // Generar quincena según fecha vencimiento
  const generarQuincenaSicore = (fechaVencimiento: string): string => {
    const fecha = new Date(fechaVencimiento)
    const año = fecha.getFullYear().toString().slice(-2) // últimos 2 dígitos
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0')
    const dia = fecha.getDate()
    
    const quincena = dia <= 15 ? '1ra' : '2da'
    return `${año}-${mes} - ${quincena}`
  }
  
  // Verificar si ya se retuvo a este proveedor en esta quincena
  const verificarRetencionPrevia = async (cuit: string, quincena: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('id')
        .eq('cuit', cuit)
        .eq('sicore', quincena)
        .limit(1)
      
      if (error) {
        console.error('Error verificando retención previa:', error)
        return false
      }
      
      return (data && data.length > 0)
    } catch (error) {
      console.error('Error verificando retención previa:', error)
      return false
    }
  }
  
  // Función principal: evaluar si corresponde retención SICORE
  // FÓRMULA BASE: netoFactura = gravado + no_gravado + exento
  const evaluarRetencionSicore = async (factura: FacturaArca) => {
    try {
      const netoGravado = factura.imp_neto_gravado || 0
      const netoNoGravado = factura.imp_neto_no_gravado || 0
      const opExentas = factura.imp_op_exentas || 0
      const netoFactura = netoGravado + netoNoGravado + opExentas
      const minimoServicios = 67170 // Mínimo más bajo (Servicios/Transporte)
      const quincena = generarQuincenaSicore(factura.fecha_vencimiento || factura.fecha_estimada || new Date().toISOString())

      console.log('🔍 SICORE: Evaluando factura', {
        id: factura.id,
        proveedor: factura.denominacion_emisor,
        netoGravado,
        netoNoGravado,
        opExentas,
        netoFactura,
        minimoServicios,
        esNegativa: netoFactura < 0
      })

      // CASO ESPECIAL: Facturas negativas
      if (netoFactura < 0) {
        // Para facturas negativas, verificar si ya hay retención previa
        const yaRetuvo = await verificarRetencionPrevia(factura.cuit, quincena)
        console.log('💰 SICORE: Factura negativa - verificación previa', { yaRetuvo, cuit: factura.cuit, quincena })

        if (yaRetuvo) {
          // Si ya retuvo, permitir retención negativa
          console.log('⚡ SICORE: Factura negativa con retención previa - PERMITIR')
          setFacturaEnProceso(factura)
          setPasoSicore('tipo')
          setMostrarModalSicore(true)
          return
        } else {
          // Si no retuvo antes, no corresponde retención sobre negativo
          console.log('✅ SICORE: Factura negativa sin retención previa - No corresponde')
          return
        }
      }

      // CASO NORMAL: Facturas positivas - aplicar filtro de mínimo
      if (netoFactura <= minimoServicios) {
        console.log('✅ SICORE: No corresponde (menor a mínimo servicios)')
        return
      }

      // Sí corresponde evaluación → iniciar flujo interactivo
      console.log('⚡ SICORE: Corresponde evaluación - iniciando flujo')
      setFacturaEnProceso(factura)
      setPasoSicore('tipo')
      setMostrarModalSicore(true)

    } catch (error) {
      console.error('Error evaluando retención SICORE:', error)
      alert('Error evaluando retención SICORE: ' + (error as Error).message)
    }
  }
  
  // Calcular retención según tipo seleccionado
  // FÓRMULA: (gravado + no_gravado + exento) - minimo_no_imponible = base_imponible * porcentaje
  const calcularRetencionSicore = async (factura: FacturaArca, tipo: TipoSicore) => {
    try {
      const netoGravado = factura.imp_neto_gravado || 0
      const netoNoGravado = factura.imp_neto_no_gravado || 0
      const opExentas = factura.imp_op_exentas || 0
      const netoFactura = netoGravado + netoNoGravado + opExentas
      const quincena = generarQuincenaSicore(factura.fecha_vencimiento || factura.fecha_estimada || new Date().toISOString())

      console.log('🧮 SICORE: Calculando retención', {
        tipo: tipo.tipo,
        netoGravado,
        netoNoGravado,
        opExentas,
        netoFactura,
        minimo: tipo.minimo_no_imponible,
        porcentaje: tipo.porcentaje_retencion,
        quincena
      })

      // PRIMERO: Verificar retención previa en quincena
      const yaRetuvo = await verificarRetencionPrevia(factura.cuit, quincena)
      console.log('🔍 SICORE: Verificación previa', { yaRetuvo, cuit: factura.cuit, quincena })

      let baseImponible = netoFactura
      let minimoAplicado = 0

      if (!yaRetuvo) {
        // Primera retención: verificar si supera mínimo específico del tipo
        if (netoFactura <= tipo.minimo_no_imponible) {
          alert(`No corresponde retención para ${tipo.tipo}.\nNeto Factura: $${netoFactura.toLocaleString('es-AR')}\nMínimo: $${tipo.minimo_no_imponible.toLocaleString('es-AR')}`)
          setMostrarModalSicore(false)
          return
        }
        // Descontar mínimo no imponible para primera retención
        baseImponible = netoFactura - tipo.minimo_no_imponible
        minimoAplicado = tipo.minimo_no_imponible
        console.log('📋 SICORE: Primera retención quincena - descuenta mínimo')
      } else {
        // Retención adicional: retener sobre monto completo (sin aplicar mínimo)
        baseImponible = netoFactura
        minimoAplicado = 0
        console.log('📋 SICORE: Retención adicional quincena - sin descuento mínimo')
      }

      const retencionCalculada = baseImponible * tipo.porcentaje_retencion

      console.log('✅ SICORE: Retención calculada', {
        netoFactura,
        minimoAplicado,
        baseImponible,
        retencion: retencionCalculada,
        yaRetuvoAntes: yaRetuvo
      })

      // Guardar datos adicionales para mostrar en el modal
      setDatosSicoreCalculo({
        netoFactura,
        minimoAplicado,
        baseImponible,
        esRetencionAdicional: yaRetuvo
      })

      setTipoSeleccionado(tipo)
      setMontoRetencion(retencionCalculada)
      setDescuentoAdicional(0)
      setPasoSicore('calculo')

    } catch (error) {
      console.error('Error calculando retención SICORE:', error)
      alert('Error calculando retención: ' + (error as Error).message)
    }
  }
  
  // Ejecutar cambio de estado pendiente (después de confirmar SICORE)
  const ejecutarGuardadoPendiente = async () => {
    if (!guardadoPendiente) return
    
    console.log('💾 Ejecutando guardado pendiente:', guardadoPendiente)
    
    // La UI ya está actualizada con el estado correcto ('pagar')
    // Solo necesitamos ejecutar el guardado en BD y actualizar facturasOriginales
    const nuevasFacturasOriginales = facturasOriginales.map(factura => 
      factura.id === guardadoPendiente.facturaId 
        ? { ...factura, [guardadoPendiente.columna]: guardadoPendiente.valor }
        : factura
    )
    setFacturasOriginales(nuevasFacturasOriginales)
    
    // Ejecutar guardado en BD
    await ejecutarGuardadoReal({ facturaId: guardadoPendiente.facturaId, columna: guardadoPendiente.columna, valor: guardadoPendiente.valor })
    
    // Limpiar guardado pendiente
    setGuardadoPendiente(null)
  }

  // Cancelar cambio de estado pendiente
  const cancelarGuardadoPendiente = async (continuarSinSicore: boolean = false) => {
    console.log('❌ Cancelando guardado pendiente:', guardadoPendiente, { continuarSinSicore })

    if (guardadoPendiente) {
      if (continuarSinSicore) {
        // Mantener el estado 'pagar' pero sin aplicar SICORE
        // El estado ya fue actualizado en BD, solo actualizar UI
        console.log('⏭️ Continuando sin SICORE, estado pagar mantenido')
      } else {
        // Restaurar estado anterior en la UI y BD
        const nuevasFacturas = facturas.map(factura =>
          factura.id === guardadoPendiente.facturaId
            ? { ...factura, [guardadoPendiente.columna]: guardadoPendiente.estadoAnterior }
            : factura
        )
        setFacturas(nuevasFacturas)

        const nuevasFacturasOriginales = facturasOriginales.map(factura =>
          factura.id === guardadoPendiente.facturaId
            ? { ...factura, [guardadoPendiente.columna]: guardadoPendiente.estadoAnterior }
            : factura
        )
        setFacturasOriginales(nuevasFacturasOriginales)

        // Restaurar en BD también
        await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({ estado: guardadoPendiente.estadoAnterior })
          .eq('id', guardadoPendiente.facturaId)
      }
    }

    // Limpiar estados SICORE y guardado pendiente
    setGuardadoPendiente(null)
    setMostrarModalSicore(false)
    setFacturaEnProceso(null)
    setTipoSeleccionado(null)
    setMontoRetencion(0)
    setDescuentoAdicional(0)
    setPasoSicore('tipo')

    // Procesar siguiente factura de la cola si hay
    if (colaSicore.length > 0) {
      setTimeout(() => procesarSiguienteSicore(), 100)
    } else if (procesandoColaSicore) {
      setProcesandoColaSicore(false)
      // Recargar facturas
      if (mostrarModalPagos) {
        const { data } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .select('*')
          .in('estado', ['pendiente', 'pagar', 'preparado'])
          .order('fecha_vencimiento', { ascending: true })
        if (data) setFacturasPagos(data)
      }
      cargarFacturas()
    }
  }

  // Finalizar proceso SICORE y actualizar BD
  const finalizarProcesoSicore = async () => {
    if (!facturaEnProceso || !tipoSeleccionado) return
    
    try {
      // PRIMERO: Ejecutar el cambio de estado pendiente (estado → 'pagar')
      await ejecutarGuardadoPendiente()
      
      const saldoFinal = (facturaEnProceso.imp_total || 0) - montoRetencion - descuentoAdicional
      const quincena = generarQuincenaSicore(facturaEnProceso.fecha_vencimiento || facturaEnProceso.fecha_estimada || new Date().toISOString())
      
      console.log('💾 SICORE: Finalizando proceso', {
        facturaId: facturaEnProceso.id,
        montoRetencion,
        descuentoAdicional,
        saldoFinal,
        quincena
      })
      
      // SEGUNDO: Actualizar factura con datos SICORE
      const { error } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .update({
          monto_a_abonar: saldoFinal,
          sicore: quincena,
          monto_sicore: montoRetencion
          // Nota: estado ya fue actualizado por ejecutarGuardadoPendiente()
        })
        .eq('id', facturaEnProceso.id)
      
      if (error) {
        throw new Error(error.message)
      }
      
      // Actualizar estado local con datos SICORE
      const nuevasFacturas = facturas.map(f => 
        f.id === facturaEnProceso.id 
          ? { ...f, monto_a_abonar: saldoFinal, sicore: quincena, monto_sicore: montoRetencion }
          : f
      )
      setFacturas(nuevasFacturas)
      
      const nuevasFacturasOriginales = facturasOriginales.map(f => 
        f.id === facturaEnProceso.id 
          ? { ...f, monto_a_abonar: saldoFinal, sicore: quincena, monto_sicore: montoRetencion }
          : f
      )
      setFacturasOriginales(nuevasFacturasOriginales)
      
      // Cerrar modal y limpiar estados
      setMostrarModalSicore(false)
      setFacturaEnProceso(null)
      setTipoSeleccionado(null)
      setMontoRetencion(0)
      setDescuentoAdicional(0)
      setPasoSicore('tipo')
      
      alert(`✅ Retención SICORE aplicada exitosamente\n\nQuincena: ${quincena}\nRetención: $${montoRetencion.toLocaleString('es-AR')}\nSaldo a pagar: $${saldoFinal.toLocaleString('es-AR')}`)

      // Procesar siguiente factura de la cola si hay
      procesarSiguienteSicore()

    } catch (error) {
      console.error('Error finalizando proceso SICORE:', error)
      alert('Error finalizando proceso SICORE: ' + (error as Error).message)
    }
  }

  // Procesar siguiente factura de la cola SICORE
  const procesarSiguienteSicore = async () => {
    if (colaSicore.length === 0) {
      setProcesandoColaSicore(false)
      // Recargar facturas del modal de pagos si está abierto
      if (mostrarModalPagos) {
        const { data } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .select('*')
          .in('estado', ['pendiente', 'pagar', 'preparado'])
          .order('fecha_vencimiento', { ascending: true })
        if (data) setFacturasPagos(data)
      }
      cargarFacturas()
      return
    }

    // Tomar la primera factura de la cola
    const [siguiente, ...resto] = colaSicore
    setColaSicore(resto)

    console.log(`🔄 SICORE Cola: Procesando siguiente (${resto.length} restantes)`, siguiente.denominacion_emisor)

    // Actualizar estado a 'pagar' en BD primero
    // Incluir fechas si están en el objeto (fueron seteadas al crear la cola)
    const updateData: any = { estado: 'pagar' }
    if (siguiente.fecha_vencimiento) {
      updateData.fecha_vencimiento = siguiente.fecha_vencimiento
      updateData.fecha_estimada = siguiente.fecha_vencimiento
      console.log(`🔄 SICORE Cola: Actualizando fechas = ${siguiente.fecha_vencimiento}`)
    }

    const { error } = await supabase
      .schema('msa')
      .from('comprobantes_arca')
      .update(updateData)
      .eq('id', siguiente.id)

    if (error) {
      console.error('Error actualizando estado:', error)
      procesarSiguienteSicore() // Continuar con la siguiente
      return
    }

    // Guardar datos pendientes
    setGuardadoPendiente({
      facturaId: siguiente.id,
      columna: 'estado',
      valor: 'pagar',
      estadoAnterior: 'pendiente'
    })

    // Evaluar SICORE para esta factura
    await evaluarRetencionSicore({ ...siguiente, estado: 'pagar' })
  }

  // ============= FUNCIONES CIERRE QUINCENA SICORE =============

  // Generar lista de quincenas disponibles (últimos 6 meses)
  const generarQuincenasDisponibles = () => {
    const quincenas = []
    const ahora = new Date()
    
    for (let i = 0; i < 12; i++) { // 12 quincenas = 6 meses
      const fecha = new Date(ahora)
      fecha.setDate(fecha.getDate() - (i * 15)) // Retroceder de a 15 días
      
      const quincena = generarQuincenaSicore(fecha.toISOString())
      if (!quincenas.includes(quincena)) {
        quincenas.push(quincena)
      }
    }
    
    return quincenas.sort().reverse() // Más recientes primero
  }

  // Buscar todas las retenciones SICORE de una quincena
  const buscarRetencionesQuincena = async (quincena: string) => {
    try {
      console.log('🔍 SICORE: Buscando retenciones para quincena', quincena)
      
      const { data, error } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('id, denominacion_emisor, cuit, monto_sicore, fecha_vencimiento, fecha_estimada, estado')
        .eq('sicore', quincena)
        .not('monto_sicore', 'is', null)
        .gt('monto_sicore', 0)
      
      if (error) {
        throw new Error(error.message)
      }
      
      const totalRetenciones = data?.reduce((sum, f) => sum + (f.monto_sicore || 0), 0) || 0
      
      console.log('📊 SICORE: Retenciones encontradas', {
        quincena,
        cantidad: data?.length || 0,
        totalRetenciones,
        facturas: data
      })
      
      return {
        facturas: data || [],
        totalRetenciones,
        cantidad: data?.length || 0
      }
      
    } catch (error) {
      console.error('Error buscando retenciones quincena:', error)
      throw error
    }
  }

  // Procesar cierre completo de quincena
  const procesarCierreQuincena = async (quincena: string) => {
    try {
      setProcesandoCierre(true)
      
      // 1. Buscar todas las retenciones de la quincena
      console.log('🎯 SICORE: Iniciando cierre quincena', quincena)
      const { facturas, totalRetenciones, cantidad } = await buscarRetencionesQuincena(quincena)
      
      if (cantidad === 0) {
        alert(`No se encontraron retenciones SICORE para la quincena ${quincena}`)
        return
      }
      
      // 2. Generar reportes PDF + Excel
      await generarReportesCierreQuincena(facturas, quincena, totalRetenciones)
      
      // 3. TODO: Actualizar/crear template SICORE
      console.log('⚠️ TODO: Actualizar template SICORE con monto total', totalRetenciones)
      
      alert(`✅ Cierre de quincena ${quincena} completado!\n\n📊 Resumen:\n• ${cantidad} facturas procesadas\n• Total retenciones: $${totalRetenciones.toLocaleString('es-AR')}\n\n📄 Reportes generados:\n• Excel con detalle por factura\n• PDF con resumen y totales`)
      
      setMostrarModalCierreQuincena(false)
      setQuincenaSeleccionada('')
      
    } catch (error) {
      console.error('Error procesando cierre quincena:', error)
      alert('Error procesando cierre de quincena: ' + (error as Error).message)
    } finally {
      setProcesandoCierre(false)
    }
  }

  // Generar reportes Excel + PDF para cierre de quincena
  const generarReportesCierreQuincena = async (facturas: any[], quincena: string, totalRetenciones: number) => {
    try {
      // Gestión de carpeta (misma lógica que subdiarios)
      let directorioDestino = null
      let ubicacionFinal = 'Descargas'
      
      if (carpetaPorDefecto) {
        try {
          await (carpetaPorDefecto as any).requestPermission({ mode: 'readwrite' })
          directorioDestino = carpetaPorDefecto
          ubicacionFinal = carpetaPorDefecto.name
        } catch (error) {
          console.log('Error accediendo carpeta por defecto, usando selector manual')
          directorioDestino = await (window as any).showDirectoryPicker()
          ubicacionFinal = directorioDestino.name
        }
      } else {
        const opciones = [
          '1. Cambiar carpeta por defecto',
          carpetaPorDefecto ? `2. Usar carpeta por defecto actual (${carpetaPorDefecto.name})` : '2. Establecer carpeta por defecto',
          '3. Cancelar descarga',
          '',
          'Elige una opción (1, 2 o 3):'
        ].join('\n')
        
        const eleccion = prompt(opciones)
        
        if (eleccion === '1' || eleccion === '2') {
          directorioDestino = await (window as any).showDirectoryPicker()
          ubicacionFinal = directorioDestino.name
          
          if (eleccion === '2') {
            setCarpetaPorDefecto(directorioDestino)
            console.log('📁 Carpeta por defecto establecida:', directorioDestino.name)
          }
        } else {
          console.log('📁 Descarga cancelada por el usuario')
          alert('📁 Descarga cancelada')
          return
        }
      }
      
      // Generar reportes
      await generarExcelCierreQuincena(facturas, quincena, totalRetenciones, directorioDestino)
      await generarPDFCierreQuincena(facturas, quincena, totalRetenciones, directorioDestino)
      
      console.log('✅ Reportes cierre quincena generados exitosamente')
      
    } catch (error) {
      console.error('Error generando reportes cierre quincena:', error)
      throw error
    }
  }

  // Generar Excel para cierre de quincena
  const generarExcelCierreQuincena = async (facturas: any[], quincena: string, totalRetenciones: number, directorio: any = null) => {
    try {
      console.log('📊 Generando Excel cierre quincena SICORE')
      
      // Importar XLSX dinámicamente
      const XLSX = await import('xlsx')
      
      // Preparar datos para Excel
      const datosExcel = facturas.map(factura => ({
        'Fecha de Pago': factura.fecha_vencimiento || '',
        'CUIT': factura.cuit || '',
        'Proveedor': factura.denominacion_emisor || '',
        'Tipo FC': factura.tipo_comprobante || '',
        'Nro Factura': `${factura.punto_venta || ''}${factura.punto_venta && factura.nro_desde ? '-' : ''}${factura.nro_desde || ''}`,
        'Retención Aplicada': factura.monto_sicore || 0
      }))
      
      // Agregar fila de totales
      datosExcel.push({
        'Fecha de Pago': '',
        'CUIT': '',
        'Proveedor': 'TOTAL RETENCIONES',
        'Tipo FC': '',
        'Nro Factura': '',
        'Retención Aplicada': totalRetenciones
      })
      
      // Crear workbook
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(datosExcel)
      
      // Ajustar anchos de columnas
      const colWidths = [
        { wch: 15 }, // Quincena SICORE
        { wch: 15 }, // CUIT
        { wch: 40 }, // Proveedor
        { wch: 15 }, // Retención SICORE
        { wch: 10 }, // Estado
        { wch: 15 }, // Fecha Vencimiento
        { wch: 15 }  // Fecha Estimada
      ]
      ws['!cols'] = colWidths
      
      XLSX.utils.book_append_sheet(wb, ws, `SICORE ${quincena}`)
      
      // Generar archivo
      const nombreArchivo = `SICORE_Cierre_${quincena.replace(/\//g, '-')}_${new Date().toISOString().split('T')[0]}.xlsx`
      
      if (directorio) {
        // Guardar en directorio seleccionado
        const archivoHandle = await directorio.getFileHandle(nombreArchivo, { create: true })
        const writableStream = await archivoHandle.createWritable()
        
        const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
        await writableStream.write(buffer)
        await writableStream.close()
        
        console.log('📊 Excel guardado en:', nombreArchivo)
      } else {
        // Descarga normal
        XLSX.writeFile(wb, nombreArchivo)
      }
      
    } catch (error) {
      console.error('Error generando Excel cierre quincena:', error)
      throw error
    }
  }

  // Generar PDF para cierre de quincena  
  const generarPDFCierreQuincena = async (facturas: any[], quincena: string, totalRetenciones: number, directorio: any = null) => {
    try {
      console.log('📄 Generando PDF cierre quincena SICORE')
      
      // Importar jsPDF dinámicamente
      const { jsPDF } = await import('jspdf')
      await import('jspdf-autotable')
      
      const doc = new jsPDF()
      
      // Header del documento
      doc.setFontSize(16)
      doc.text('CIERRE DE QUINCENA SICORE', 20, 20)
      doc.setFontSize(12)
      doc.text(`Quincena: ${quincena}`, 20, 30)
      doc.text(`Fecha generación: ${new Date().toLocaleDateString('es-AR')}`, 20, 40)
      doc.text(`Total facturas: ${facturas.length}`, 20, 50)
      doc.text(`Total retenciones: $${totalRetenciones.toLocaleString('es-AR')}`, 20, 60)
      
      // Tabla de facturas
      const columnas = [
        'Fecha de Pago',
        'CUIT',
        'Proveedor',
        'Tipo FC',
        'Nro Factura',
        'Retención Aplicada'
      ]
      
      const filas = facturas.map(factura => [
        factura.fecha_vencimiento || '',
        factura.cuit || '',
        factura.denominacion_emisor || '',
        factura.tipo_comprobante || '',
        `${factura.punto_venta || ''}${factura.punto_venta && factura.nro_desde ? '-' : ''}${factura.nro_desde || ''}`,
        `$${(factura.monto_sicore || 0).toLocaleString('es-AR')}`
      ])
      
      // Agregar fila de total
      filas.push([
        '',
        '',
        'TOTAL RETENCIONES',
        '',
        '',
        `$${totalRetenciones.toLocaleString('es-AR')}`
      ])
      
      // Generar tabla
      autoTable(doc, {
        head: [columnas],
        body: filas,
        startY: 80,
        styles: {
          fontSize: 8,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        columnStyles: {
          2: { halign: 'right' } // Alinear montos a la derecha
        },
        didParseCell: function(data: any) {
          // Resaltar fila de totales
          if (data.row.index === filas.length - 1 && data.section === 'body') {
            data.cell.styles.fillColor = [230, 230, 230]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      })
      
      // Generar archivo
      const nombreArchivo = `SICORE_Cierre_${quincena.replace(/\//g, '-')}_${new Date().toISOString().split('T')[0]}.pdf`
      
      if (directorio) {
        // Guardar en directorio seleccionado
        const archivoHandle = await directorio.getFileHandle(nombreArchivo, { create: true })
        const writableStream = await archivoHandle.createWritable()
        
        const pdfBlob = doc.output('blob')
        await writableStream.write(pdfBlob)
        await writableStream.close()
        
        console.log('📄 PDF guardado en:', nombreArchivo)
      } else {
        // Descarga normal
        doc.save(nombreArchivo)
      }
      
    } catch (error) {
      console.error('Error generando PDF cierre quincena:', error)
      throw error
    }
  }

  // Componente SubdiariosContent
  const SubdiariosContent = () => (
    <div className="space-y-6">
      {/* Controles principales */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Subdiarios DDJJ IVA</CardTitle>
          <p className="text-sm text-muted-foreground">
            Consulta períodos y gestión de imputaciones contables
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selector período consulta */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">🗓️ Consultar Período</Label>
              <Select value={periodoConsulta} onValueChange={(value) => {
                setPeriodoConsulta(value)
                cargarFacturasPeriodo(value)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar MM/AAAA" />
                </SelectTrigger>
                <SelectContent>
                  {generarPeriodos().map(periodo => (
                    <SelectItem key={periodo} value={periodo}>{periodo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botones de Acciones */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">⚡ Acciones</Label>
              <div className="space-y-2">
                <Button 
                  onClick={() => {
                    setMostrarModalImputar(true)
                    // NO cargar facturas automáticamente - usuario debe seleccionar período primero
                    setFacturasImputacion([])
                    setFacturasSeleccionadas(new Set())
                  }}
                  className="w-full"
                >
                  Imputar Facturas
                </Button>
                
                {/* Botón Confirmar DDJJ - solo si hay facturas "Imputado" */}
                {periodoConsulta && facturasPeriodo.some(f => f.ddjj_iva === 'Imputado') && (
                  <Button 
                    onClick={confirmarDDJJ}
                    variant="default"
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    ✅ Confirmar DDJJ {periodoConsulta}
                  </Button>
                )}

                {/* Botón Gestionar Facturas - solo si hay facturas en el período */}
                {console.log('🔍 DEBUG Botón Gestionar:', { periodoConsulta, facturasPeriodoLength: facturasPeriodo.length })}
                {periodoConsulta && facturasPeriodo.length > 0 && (
                  <Button 
                    onClick={() => {
                      console.log('🔧 DEBUG: Activar modo gestión masiva')
                      setMostrarGestionMasiva(!mostrarGestionMasiva)
                      setFacturasSeleccionadasGestion(new Set()) // Limpiar selección
                    }}
                    variant={mostrarGestionMasiva ? "default" : "outline"}
                    className={mostrarGestionMasiva 
                      ? "w-full bg-blue-600 hover:bg-blue-700 text-white" 
                      : "w-full border-blue-500 text-blue-600 hover:bg-blue-50"
                    }
                  >
                    {mostrarGestionMasiva ? "❌ Cancelar Gestión" : "🔧 Gestionar Facturas"} ({facturasPeriodo.length})
                  </Button>
                )}

                {/* Botón Generar Reportes - independiente de estado DDJJ */}
                {periodoConsulta && facturasPeriodo.length > 0 && (
                  <Button 
                    onClick={generarReportesPeriodo}
                    variant="outline"
                    className="w-full border-green-500 text-green-600 hover:bg-green-50"
                  >
                    📊 Generar PDF + Excel ({facturasPeriodo.length} facturas)
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subtotales del período */}
      {subtotales && (
        <Card>
          <CardHeader>
            <CardTitle>📈 Subtotales Período {periodoConsulta}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-gray-600">Total General</p>
                <p className="font-bold text-lg">${subtotales.imp_total.toLocaleString('es-AR')}</p>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-gray-600">IVA</p>
                <p className="font-bold">${subtotales.iva.toLocaleString('es-AR')}</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded">
                <p className="text-gray-600">Neto Gravado</p>
                <p className="font-bold">${subtotales.imp_neto_gravado.toLocaleString('es-AR')}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <p className="text-gray-600">Neto No Gravado</p>
                <p className="font-bold">${subtotales.imp_neto_no_gravado.toLocaleString('es-AR')}</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded">
                <p className="text-gray-600">Op. Exentas</p>
                <p className="font-bold">${subtotales.imp_op_exentas.toLocaleString('es-AR')}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-gray-600">Otros Tributos</p>
                <p className="font-bold">${subtotales.otros_tributos.toLocaleString('es-AR')}</p>
              </div>
            </div>
            
            {/* Facturas C separadas */}
            {subtotales.cantidad_facturas_c > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium mb-2">📋 Facturas C (Tipo 11) - Apartado</h4>
                <div className="bg-red-50 p-3 rounded">
                  <p className="text-gray-600">Total Facturas C ({subtotales.cantidad_facturas_c} facturas)</p>
                  <p className="font-bold text-lg">${subtotales.facturas_c.toLocaleString('es-AR')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabla facturas del período */}
      {facturasPeriodo.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>📋 Facturas del Período {periodoConsulta}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {facturasPeriodo.length} facturas encontradas
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMostrarColumnasDetalladas(!mostrarColumnasDetalladas)}
                className="flex items-center gap-2"
              >
                {mostrarColumnasDetalladas ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {mostrarColumnasDetalladas ? 'Ocultar Detalle' : 'Mostrar Detalle IVA'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white border-b">
                  <TableRow>
                    {mostrarGestionMasiva && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={facturasSeleccionadasGestion.size === facturasPeriodo.length && facturasPeriodo.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFacturasSeleccionadasGestion(new Set(facturasPeriodo.map(f => f.id)))
                            } else {
                              setFacturasSeleccionadasGestion(new Set())
                            }
                          }}
                        />
                      </TableHead>
                    )}
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead>Tipo</TableHead>
                    {mostrarColumnasDetalladas ? (
                      <>
                        {/* Columnas detalladas de Netos por Alícuota */}
                        <TableHead className="text-xs">Neto 0%</TableHead>
                        <TableHead className="text-xs">Neto 2.5%</TableHead>
                        <TableHead className="text-xs">Neto 5%</TableHead>
                        <TableHead className="text-xs">Neto 10.5%</TableHead>
                        <TableHead className="text-xs">Neto 21%</TableHead>
                        <TableHead className="text-xs">Neto 27%</TableHead>
                        <TableHead className="text-xs">Neto No Grav.</TableHead>
                        <TableHead className="text-xs">Op. Exentas</TableHead>
                        <TableHead className="text-xs">Otros Trib.</TableHead>
                        {/* Columnas detalladas de IVAs por Alícuota */}
                        <TableHead className="text-xs">IVA 0%</TableHead>
                        <TableHead className="text-xs">IVA 2.5%</TableHead>
                        <TableHead className="text-xs">IVA 5%</TableHead>
                        <TableHead className="text-xs">IVA 10.5%</TableHead>
                        <TableHead className="text-xs">IVA 21%</TableHead>
                        <TableHead className="text-xs">IVA 27%</TableHead>
                      </>
                    ) : (
                      <>
                        {/* Columnas básicas (actuales) */}
                        <TableHead>Neto Gravado</TableHead>
                        <TableHead>Neto No Gravado</TableHead>
                        <TableHead>Op. Exentas</TableHead>
                        <TableHead>Otros Tributos</TableHead>
                      </>
                    )}
                    <TableHead>Total IVA</TableHead>
                    <TableHead>Imp. Total</TableHead>
                    <TableHead>Estado DDJJ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facturasPeriodo.map(factura => (
                    <TableRow key={factura.id}>
                      {mostrarGestionMasiva && (
                        <TableCell>
                          <Checkbox
                            checked={facturasSeleccionadasGestion.has(factura.id)}
                            onCheckedChange={(checked) => {
                              const nuevaSeleccion = new Set(facturasSeleccionadasGestion)
                              if (checked) {
                                nuevaSeleccion.add(factura.id)
                              } else {
                                nuevaSeleccion.delete(factura.id)
                              }
                              setFacturasSeleccionadasGestion(nuevaSeleccion)
                            }}
                          />
                        </TableCell>
                      )}
                      <TableCell>{formatearFecha(factura.fecha_emision)}</TableCell>
                      <TableCell className="max-w-48 truncate">{factura.denominacion_emisor}</TableCell>
                      <TableCell>{factura.cuit}</TableCell>
                      <TableCell>{factura.tipo_comprobante}</TableCell>
                      {mostrarColumnasDetalladas ? (
                        <>
                          {/* Columnas detalladas de Netos por Alícuota */}
                          <TableCell className="text-right text-xs">${Number(factura.neto_grav_iva_0 || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.neto_grav_iva_2_5 || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.neto_grav_iva_5 || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.neto_grav_iva_10_5 || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.neto_grav_iva_21 || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.neto_grav_iva_27 || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.imp_neto_no_gravado || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.imp_op_exentas || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.otros_tributos || 0).toLocaleString('es-AR')}</TableCell>
                          {/* Columnas detalladas de IVAs por Alícuota */}
                          <TableCell className="text-right text-xs">${Number(0).toLocaleString('es-AR')}</TableCell> {/* IVA 0% siempre es 0 */}
                          <TableCell className="text-right text-xs">${Number(factura.iva_2_5 || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.iva_5 || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.iva_10_5 || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.iva_21 || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${Number(factura.iva_27 || 0).toLocaleString('es-AR')}</TableCell>
                        </>
                      ) : (
                        <>
                          {/* Columnas básicas (actuales) */}
                          <TableCell className="text-right">${Number(factura.imp_neto_gravado || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right">${Number(factura.imp_neto_no_gravado || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right">${Number(factura.imp_op_exentas || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right">${Number(factura.otros_tributos || 0).toLocaleString('es-AR')}</TableCell>
                        </>
                      )}
                      <TableCell className="text-right">${Number(factura.iva || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">${Number(factura.imp_total || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell>
                        <Badge variant={
                          factura.ddjj_iva === 'DDJJ OK' ? 'default' :
                          factura.ddjj_iva === 'Imputado' ? 'secondary' : 'outline'
                        }>
                          {factura.ddjj_iva}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Panel de controles gestión masiva */}
            {mostrarGestionMasiva && facturasSeleccionadasGestion.size > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-blue-900">
                    🔧 Gestión Masiva - {facturasSeleccionadasGestion.size} facturas seleccionadas
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFacturasSeleccionadasGestion(new Set())}
                  >
                    Limpiar selección
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Cambiar Estado DDJJ */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-blue-900">Estado DDJJ</Label>
                    <Select value={nuevoEstadoDDJJ} onValueChange={setNuevoEstadoDDJJ}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sin-cambios">Sin cambios</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Imputado">Imputado</SelectItem>
                        <SelectItem value="DDJJ OK">DDJJ OK</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cambiar Período */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-blue-900">Período MM/AAAA</Label>
                    <Select value={nuevoPeriodo} onValueChange={setNuevoPeriodo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar período" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sin-cambios">Sin cambios</SelectItem>
                        {generarPeriodos().map(periodo => (
                          <SelectItem key={periodo} value={periodo}>{periodo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Botón aplicar */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-blue-900">Acción</Label>
                    <Button
                      onClick={ejecutarGestionMasiva}
                      disabled={facturasSeleccionadasGestion.size === 0 || 
                        (!nuevoEstadoDDJJ || nuevoEstadoDDJJ === 'sin-cambios') && 
                        (!nuevoPeriodo || nuevoPeriodo === 'sin-cambios')}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      ✅ Aplicar Cambios
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Facturas ARCA - MSA</h2>
        <p className="text-muted-foreground">
          Gestión de comprobantes recibidos importados desde ARCA
        </p>
      </div>

      {/* Tabs principales */}
      <Tabs value={tabActivo} onValueChange={(value) => setTabActivo(value as 'facturas' | 'subdiarios')}>
        <TabsList>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="subdiarios">Subdiarios</TabsTrigger>
        </TabsList>

        {/* Tab Content: Facturas */}
        <TabsContent value="facturas" className="space-y-6">
          <div className="flex items-center justify-end">
        
        <div className="flex gap-2">
          {/* Botón importar Excel */}
          <Button 
            variant="outline"
            onClick={() => setMostrarImportador(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
          
          {/* Botón de filtros */}
          <Button 
            variant={mostrarFiltros ? "default" : "outline"}
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          
          {/* Botón modo edición */}
          <Button 
            variant={modoEdicion ? "default" : "outline"}
            onClick={() => setModoEdicion(!modoEdicion)}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {modoEdicion ? 'Salir Edición' : 'Modo Edición'}
          </Button>
          
          {/* Botón cierre quincena SICORE */}
          <Button
            variant="outline"
            className="bg-orange-50 hover:bg-orange-100 border-orange-300"
            onClick={() => setMostrarModalCierreQuincena(true)}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Cierre Quincena SICORE
          </Button>

          {/* Botón Vista de Pagos */}
          <Button
            variant="outline"
            className="bg-green-50 hover:bg-green-100 border-green-300"
            onClick={async () => {
              setCargandoPagos(true)
              setMostrarModalPagos(true)
              setFiltroOrigenPagos({ arca: true, template: true })
              setFacturasSeleccionadasPagos(new Set())
              setTemplatesSeleccionadosPagos(new Set())

              // Cargar facturas ARCA con estados relevantes para pagos
              const { data: arcaData, error: arcaError } = await supabase
                .schema('msa')
                .from('comprobantes_arca')
                .select('*')
                .in('estado', ['pendiente', 'pagar', 'preparado'])
                .order('fecha_vencimiento', { ascending: true })

              if (!arcaError && arcaData) {
                setFacturasPagos(arcaData)
              }

              // Cargar templates/cuotas con estados relevantes para pagos
              const { data: templatesData, error: templatesError } = await supabase
                .from('cuotas_egresos_sin_factura')
                .select(`
                  *,
                  egreso:egresos_sin_factura!inner(*)
                `)
                .in('estado', ['pendiente', 'pagar', 'preparado'])
                .eq('egreso.activo', true)
                .order('fecha_vencimiento', { ascending: true })

              if (!templatesError && templatesData) {
                setTemplatesPagos(templatesData)
              }

              setCargandoPagos(false)
            }}
          >
            💰 Pagos
          </Button>

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

      {/* Panel de filtros */}
      {mostrarFiltros && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                🔍 Filtros de Búsqueda
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
                <Label className="text-sm font-medium">📅 Rango de Fechas de Emisión</Label>
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
                  className="text-xs"
                />
              </div>
              
              {/* Búsqueda por detalle */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📝 Detalle</Label>
                <Input
                  placeholder="Buscar en detalle..."
                  value={busquedaDetalle}
                  onChange={(e) => setBusquedaDetalle(e.target.value)}
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
                <Label className="text-sm font-medium">💰 Cuenta Contable</Label>
                <CategCombobox
                  value={busquedaCateg}
                  onValueChange={setBusquedaCateg}
                  placeholder="Buscar por cuenta contable..."
                  className="text-xs"
                />
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
                  {facturas.length} de {facturasOriginales.length} facturas mostradas
                  {facturas.length !== facturasOriginales.length && (
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
            <span>Cargando facturas ARCA...</span>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabla de facturas */}
      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {facturas.length} Facturas Encontradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Scroll horizontal y vertical con headers fijos */}
            <div className="w-full overflow-auto max-h-[600px] border rounded-md">
              <Table style={{ minWidth: 'fit-content' }}>
                <TableHeader className="sticky top-0 z-10 bg-white border-b">
                    <TableRow>
                      {columnasVisiblesArray.map(columna => (
                        <TableHead 
                          key={columna} 
                          style={{ 
                            width: anchosColumnas[columna] || COLUMNAS_CONFIG[columna].width,
                            minWidth: anchosColumnas[columna] || COLUMNAS_CONFIG[columna].width
                          }}
                        >
                          {COLUMNAS_CONFIG[columna].label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facturas.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={columnasVisiblesArray.length} 
                          className="h-24 text-center text-muted-foreground"
                        >
                          No hay facturas para mostrar
                        </TableCell>
                      </TableRow>
                    ) : (
                      facturas.map(factura => (
                        <TableRow key={factura.id}>
                          {columnasVisiblesArray.map(columna => (
                            <TableCell 
                              key={columna}
                              style={{ 
                                width: anchosColumnas[columna] || COLUMNAS_CONFIG[columna].width,
                                minWidth: anchosColumnas[columna] || COLUMNAS_CONFIG[columna].width
                              }}
                            >
                              {renderizarCelda(factura, columna)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Modal para validación de categorías */}
      <Dialog open={validandoCateg.isOpen} onOpenChange={() => cerrarModalCateg()}>
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
            <Button variant="outline" onClick={cerrarModalCateg}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={manejarElegirExistente}>
              Elegir categoría existente
            </Button>
            <Button onClick={manejarCrearCategoria}>
              Crear nueva categoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para importación de Excel */}
      <Dialog open={mostrarImportador} onOpenChange={setMostrarImportador}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Facturas ARCA desde Excel
            </DialogTitle>
            <DialogDescription>
              Selecciona el archivo Excel de ARCA para importar las facturas automáticamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Selector de empresa */}
            <div className="space-y-2">
              <Label>Empresa destino</Label>
              <Select value={empresa} onValueChange={(value: 'MSA' | 'PAM') => setEmpresa(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MSA">MSA</SelectItem>
                  <SelectItem value="PAM">PAM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selector de archivo */}
            <div className="space-y-2">
              <Label>Archivo Excel de ARCA</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  setArchivoImportacion(file || null)
                  setResultadoImportacion(null)
                }}
              />
              {archivoImportacion && (
                <div className="text-sm text-gray-600">
                  Archivo seleccionado: {archivoImportacion.name}
                </div>
              )}
            </div>

            {/* Información */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="text-sm space-y-1">
                  <p><strong>Formato esperado:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Fila 1: Información general (se ignora)</li>
                    <li>Fila 2: Headers de columnas</li>
                    <li>Fila 3+: Datos de facturas</li>
                    <li>Extensiones soportadas: .xlsx, .xls</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            {/* Resultado de importación */}
            {resultadoImportacion && (
              <Alert className={resultadoImportacion.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                <div className="flex items-center gap-2">
                  {resultadoImportacion.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">
                      {resultadoImportacion.success ? 'Importación exitosa' : 'Error en importación'}
                    </p>
                    <p className="text-sm">
                      {resultadoImportacion.message || resultadoImportacion.error}
                    </p>
                    
                    {resultadoImportacion.summary && (
                      <div className="text-xs bg-white p-2 rounded border">
                        <div>Total facturas procesadas: {resultadoImportacion.summary.totalFilas}</div>
                        <div>Facturas importadas: {resultadoImportacion.insertedCount}</div>
                        <div>Facturas duplicadas: {resultadoImportacion.ignoredCount || 0}</div>
                        {resultadoImportacion.errores?.length > 0 && (
                          <div className="text-red-600">Errores: {resultadoImportacion.errores.length}</div>
                        )}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarImportador(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={manejarImportacionExcel} 
              disabled={!archivoImportacion || importandoExcel}
            >
              {importandoExcel ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        {/* Tab Content: Subdiarios */}
        <TabsContent value="subdiarios" className="space-y-6">
          <SubdiariosContent />
        </TabsContent>
      </Tabs>

      {/* Modal Imputación */}
      <Dialog open={mostrarModalImputar} onOpenChange={setMostrarModalImputar}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Imputar Facturas a Período
            </DialogTitle>
            <DialogDescription>
              Selecciona las facturas y asigna un período contable MM/AAAA
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Controles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Período destino */}
              <div className="space-y-2">
                <Label>Período MM/AAAA</Label>
                <Select 
                  value={periodoImputacion} 
                  onValueChange={async (valor) => {
                    // Validar si período está declarado
                    const estaDeclarado = await validarPeriodoDeclarado(valor)
                    if (estaDeclarado) {
                      alert(`❌ El período ${valor} ya está declarado (DDJJ OK) y no se puede modificar.`)
                      return
                    }
                    setPeriodoImputacion(valor)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    {generarPeriodos().map(periodo => (
                      <SelectItem key={periodo} value={periodo}>
                        {periodo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {periodoImputacion && (
                  <p className="text-xs text-gray-500">
                    ⚠️ Se validará que el período no esté declarado
                  </p>
                )}
              </div>

              {/* Filtros estado */}
              <div className="space-y-2">
                <Label>Mostrar</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sin-imputar"
                      checked={mostrarSinImputar}
                      onCheckedChange={setMostrarSinImputar}
                    />
                    <Label htmlFor="sin-imputar" className="text-sm">Sin imputar</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="imputadas"
                      checked={mostrarImputadas}
                      onCheckedChange={setMostrarImputadas}
                    />
                    <Label htmlFor="imputadas" className="text-sm">Imputadas</Label>
                  </div>
                </div>
              </div>

              {/* Selección masiva */}
              <div className="space-y-2">
                <Label>Selección</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nuevasSelecciones = new Set(facturasImputacion.map(f => f.id))
                      setFacturasSeleccionadas(nuevasSelecciones)
                    }}
                  >
                    Todas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFacturasSeleccionadas(new Set())}
                  >
                    Ninguna
                  </Button>
                </div>
              </div>
            </div>

            {/* Indicador de carga automática */}
            {periodoImputacion && (
              <div className="text-sm text-gray-600 text-center py-2">
                Mostrando facturas para período {periodoImputacion} ({mostrarSinImputar ? 'Sin imputar' : ''} {mostrarImputadas ? 'Imputadas' : ''})
              </div>
            )}

            {/* Tabla facturas para imputar */}
            {facturasImputacion.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {facturasSeleccionadas.size} de {facturasImputacion.length} facturas seleccionadas
                </p>
                <div className="overflow-auto max-h-64 border rounded">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-white border-b">
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={facturasSeleccionadas.size === facturasImputacion.length && facturasImputacion.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFacturasSeleccionadas(new Set(facturasImputacion.map(f => f.id)))
                              } else {
                                setFacturasSeleccionadas(new Set())
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facturasImputacion.map(factura => (
                        <TableRow key={factura.id}>
                          <TableCell>
                            <Checkbox
                              checked={facturasSeleccionadas.has(factura.id)}
                              onCheckedChange={(checked) => {
                                const nuevas = new Set(facturasSeleccionadas)
                                if (checked) {
                                  nuevas.add(factura.id)
                                } else {
                                  nuevas.delete(factura.id)
                                }
                                setFacturasSeleccionadas(nuevas)
                              }}
                            />
                          </TableCell>
                          <TableCell>{formatearFecha(factura.fecha_emision)}</TableCell>
                          <TableCell className="max-w-48 truncate">{factura.denominacion_emisor}</TableCell>
                          <TableCell>${Number(factura.imp_total).toLocaleString('es-AR')}</TableCell>
                          <TableCell>
                            <Badge variant={
                              factura.ddjj_iva === 'Imputado' ? 'secondary' : 'outline'
                            }>
                              {factura.ddjj_iva}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarModalImputar(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={ejecutarImputacion}
              disabled={facturasSeleccionadas.size === 0 || !periodoImputacion}
            >
              Imputar {facturasSeleccionadas.size} Facturas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal SICORE - Retenciones Ganancias */}
      <Dialog open={mostrarModalSicore} onOpenChange={setMostrarModalSicore}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>🏛️ Retención SICORE - Ganancias</DialogTitle>
            <DialogDescription>
              {facturaEnProceso && (
                <>Factura: {facturaEnProceso.denominacion_emisor} - ${facturaEnProceso.imp_neto_gravado?.toLocaleString('es-AR')}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* PASO 1: Selección de tipo */}
          {pasoSicore === 'tipo' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700 mb-4">
                  Esta factura supera el mínimo para retención SICORE.
                  <br />
                  Seleccione el tipo de operación:
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {tiposSicore.map((tipo) => (
                  <Button
                    key={tipo.id}
                    variant="outline" 
                    className="h-auto p-4 flex items-center justify-between hover:bg-gray-50"
                    onClick={() => calcularRetencionSicore(facturaEnProceso!, tipo)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{tipo.emoji}</span>
                      <div className="text-left">
                        <div className="font-medium">{tipo.tipo}</div>
                        <div className="text-sm text-gray-500">
                          Mín: ${tipo.minimo_no_imponible.toLocaleString('es-AR')} ({(tipo.porcentaje_retencion * 100).toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1 bg-green-50 hover:bg-green-100 border-green-300"
                  onClick={() => {
                    setMostrarModalSicore(false)
                    // Estado ya se cambió a "Pagar" automáticamente
                  }}
                >
                  ✅ Continuar sin Retención
                </Button>
                <Button 
                  variant="outline" 
                  onClick={cancelarGuardadoPendiente}
                >
                  ❌ Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* PASO 2: Mostrar cálculo + opciones */}
          {pasoSicore === 'calculo' && facturaEnProceso && tipoSeleccionado && datosSicoreCalculo && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-3">Cálculo de retención: <span className="text-blue-600">{tipoSeleccionado.emoji} {tipoSeleccionado.tipo}</span></h3>
                {datosSicoreCalculo.esRetencionAdicional && (
                  <div className="bg-yellow-100 text-yellow-800 text-xs p-2 rounded mb-3">
                    ⚠️ Retención adicional en quincena - No se aplica mínimo no imponible
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Neto de la Factura:</span>
                    <span className="font-medium">${datosSicoreCalculo.netoFactura.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">No Imponible:</span>
                    <span className="font-medium">${datosSicoreCalculo.minimoAplicado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Imponible:</span>
                    <span className="font-medium">${datosSicoreCalculo.baseImponible.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">% Retención:</span>
                    <span className="font-medium">{(tipoSeleccionado.porcentaje_retencion * 100).toFixed(2)}%</span>
                  </div>
                  <hr className="my-2 border-gray-300" />
                  <div className="flex justify-between">
                    <span className="font-semibold">Monto Total Retención:</span>
                    <span className="font-bold text-red-600">${montoRetencion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {descuentoAdicional > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Descuento adicional:</span>
                      <span className="font-medium text-red-600">-${descuentoAdicional.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monto Total Factura:</span>
                    <span className="font-medium">${(facturaEnProceso.imp_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <hr className="my-2 border-gray-300" />
                  <div className="flex justify-between text-lg">
                    <span className="font-bold">Saldo a Pagar:</span>
                    <span className="font-bold text-green-600">${((facturaEnProceso.imp_total || 0) - montoRetencion - descuentoAdicional).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={finalizarProcesoSicore}
                  className="bg-green-600 hover:bg-green-700"
                >
                  ✅ Confirmar
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    const monto = prompt('Ingrese monto descuento adicional:', '0')
                    if (monto !== null) {
                      const descuento = parseFloat(monto) || 0
                      setDescuentoAdicional(descuento)
                    }
                  }}
                >
                  💰 Descuento Adicional
                </Button>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    const monto = prompt('Ingrese nuevo monto retención:', montoRetencion.toString())
                    if (monto !== null) {
                      const nuevaRetencion = parseFloat(monto) || 0
                      setMontoRetencion(nuevaRetencion)
                    }
                  }}
                >
                  📝 Cambiar Monto Retención
                </Button>
                <Button 
                  variant="outline"
                  onClick={cancelarGuardadoPendiente}
                >
                  ❌ Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Cierre Quincena SICORE */}
      <Dialog open={mostrarModalCierreQuincena} onOpenChange={setMostrarModalCierreQuincena}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📅 Cierre de Quincena SICORE</DialogTitle>
            <DialogDescription>
              Selecciona la quincena para generar el reporte y actualizar template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selector de quincena */}
            <div className="space-y-2">
              <Label>Quincena SICORE</Label>
              <Select value={quincenaSeleccionada} onValueChange={setQuincenaSeleccionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una quincena..." />
                </SelectTrigger>
                <SelectContent>
                  {generarQuincenasDisponibles().map((quincena) => (
                    <SelectItem key={quincena} value={quincena}>
                      {quincena}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Información del proceso */}
            <div className="bg-blue-50 p-3 rounded-lg space-y-2 text-sm">
              <p className="font-medium">El proceso incluirá:</p>
              <ul className="space-y-1 text-gray-700">
                <li>• Buscar todas las retenciones SICORE de la quincena</li>
                <li>• Generar reportes PDF + Excel con detalles</li>
                <li>• Calcular total y actualizar template correspondiente</li>
                <li>• Usar carpeta configurada para guardar archivos</li>
              </ul>
            </div>

            {/* Ejemplo de quincena */}
            {quincenaSeleccionada && (
              <div className="bg-orange-50 p-3 rounded-lg text-sm">
                <p className="font-medium">Ejemplo: 2ª quincena septiembre 2024</p>
                <p className="text-gray-600">
                  Se procesarán todas las facturas con retención SICORE de la quincena "{quincenaSeleccionada}"
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => quincenaSeleccionada && procesarCierreQuincena(quincenaSeleccionada)}
              disabled={!quincenaSeleccionada || procesandoCierre}
              className="bg-orange-600 hover:bg-orange-700 flex-1"
            >
              {procesandoCierre ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Procesar Cierre
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setMostrarModalCierreQuincena(false)
                setQuincenaSeleccionada('')
              }}
              disabled={procesandoCierre}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Vista de Pagos */}
      <Dialog open={mostrarModalPagos} onOpenChange={setMostrarModalPagos}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>💰 Vista de Pagos</DialogTitle>
            <DialogDescription>
              Gestión de facturas pendientes de pago
            </DialogDescription>
          </DialogHeader>

          {/* Selector de Fecha de Pago */}
          {(() => {
            // Determinar rol para mostrar/habilitar selector fecha
            const pathArray = typeof window !== 'undefined' ? window.location.pathname.split('/') : []
            const accessRoute = pathArray[1] || ''
            const esAdminFecha = accessRoute === 'adminjms1320'
            // Ulises solo puede cambiar fecha cuando hay facturas en 'pendiente' (no en pagar/preparado)
            const hayFacturasEnProceso = facturasPagos.some(f => f.estado === 'pagar' || f.estado === 'preparado')
            const puedeEditarFecha = esAdminFecha || !hayFacturasEnProceso

            return (
              <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">📅 Fecha de Pago:</span>
                  <input
                    type="date"
                    value={fechaPagoSeleccionada}
                    onChange={(e) => setFechaPagoSeleccionada(e.target.value)}
                    disabled={!puedeEditarFecha}
                    className={`border rounded px-2 py-1 text-sm ${!puedeEditarFecha ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                  {fechaPagoSeleccionada && puedeEditarFecha && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFechaPagoSeleccionada('')}
                      className="h-7 px-2 text-gray-500"
                    >
                      ✕
                    </Button>
                  )}
                </div>
                {!puedeEditarFecha && !esAdminFecha && (
                  <span className="text-xs text-orange-600">
                    ⚠️ No se puede cambiar fecha con facturas en proceso
                  </span>
                )}
                {fechaPagoSeleccionada && (
                  <span className="text-xs text-blue-700">
                    → Quincena SICORE: {(() => {
                      // Parsear fecha sin timezone issues
                      const [año, mes, dia] = fechaPagoSeleccionada.split('-')
                      return `${año.slice(-2)}-${mes} - ${parseInt(dia) <= 15 ? '1ra' : '2da'}`
                    })()}
                  </span>
                )}
              </div>
            )
          })()}

          {/* Filtros de Origen */}
          <div className="flex items-center gap-6 p-3 bg-gray-50 rounded-lg border mb-2">
            <span className="text-sm font-medium text-gray-700">Mostrar:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filtroOrigenPagos.arca}
                  onCheckedChange={(checked) => setFiltroOrigenPagos(prev => ({ ...prev, arca: !!checked }))}
                />
                <span className="text-sm flex items-center gap-1">
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">ARCA</Badge>
                  ({facturasPagos.length})
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filtroOrigenPagos.template}
                  onCheckedChange={(checked) => setFiltroOrigenPagos(prev => ({ ...prev, template: !!checked }))}
                />
                <span className="text-sm flex items-center gap-1">
                  <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">Templates</Badge>
                  ({templatesPagos.length})
                </span>
              </label>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (filtroOrigenPagos.arca) {
                    setFacturasSeleccionadasPagos(new Set(facturasPagos.map(f => f.id)))
                  }
                  if (filtroOrigenPagos.template) {
                    setTemplatesSeleccionadosPagos(new Set(templatesPagos.map(t => t.id)))
                  }
                }}
                className="text-xs"
              >
                Seleccionar todo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFacturasSeleccionadasPagos(new Set())
                  setTemplatesSeleccionadosPagos(new Set())
                }}
                className="text-xs"
              >
                Deseleccionar
              </Button>
            </div>
          </div>

          {cargandoPagos ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Cargando facturas...</span>
            </div>
          ) : (() => {
            // Determinar rol del usuario
            const pathArray = typeof window !== 'undefined' ? window.location.pathname.split('/') : []
            const accessRoute = pathArray[1] || ''
            const esAdmin = accessRoute === 'adminjms1320'

            // Función para ordenar por fecha (próximas a vencer primero)
            const ordenarPorFecha = (facturas: FacturaArca[]) => {
              return [...facturas].sort((a, b) => {
                const fechaA = a.fecha_vencimiento || a.fecha_estimada || '9999-12-31'
                const fechaB = b.fecha_vencimiento || b.fecha_estimada || '9999-12-31'
                return fechaA.localeCompare(fechaB)
              })
            }

            // Filtrar facturas por estado y ordenar por fecha
            const facturasPreparado = ordenarPorFecha(facturasPagos.filter(f => f.estado === 'preparado'))
            const facturasPagar = ordenarPorFecha(facturasPagos.filter(f => f.estado === 'pagar'))
            const facturasPendiente = ordenarPorFecha(facturasPagos.filter(f => f.estado === 'pendiente'))

            // Calcular subtotales
            const subtotalPreparado = facturasPreparado.reduce((sum, f) => sum + (f.monto_a_abonar || f.imp_total || 0), 0)
            const subtotalPagar = facturasPagar.reduce((sum, f) => sum + (f.monto_a_abonar || f.imp_total || 0), 0)
            const subtotalPendiente = facturasPendiente.reduce((sum, f) => sum + (f.monto_a_abonar || f.imp_total || 0), 0)

            // Función para cambiar estado de facturas seleccionadas
            const cambiarEstadoSeleccionadas = async (nuevoEstado: string) => {
              if (facturasSeleccionadasPagos.size === 0) {
                alert('Selecciona al menos una factura')
                return
              }

              const ids = Array.from(facturasSeleccionadasPagos)
              const facturasACambiar = facturasPagos.filter(f => ids.includes(f.id))

              // Preparar datos de actualización (incluye fecha si está seleccionada)
              const datosUpdate: { estado: string; fecha_vencimiento?: string; fecha_estimada?: string } = { estado: nuevoEstado }
              if (fechaPagoSeleccionada) {
                // Actualizar ambas fechas (misma lógica que en templates)
                datosUpdate.fecha_vencimiento = fechaPagoSeleccionada
                datosUpdate.fecha_estimada = fechaPagoSeleccionada
                console.log(`🔄 Vista Pagos: fecha_vencimiento + fecha_estimada = ${fechaPagoSeleccionada}`)
              }

              // SICORE: Detectar cambio pendiente → pagar
              // Usar suma de gravado + no_gravado + exento para evaluar
              const minimoSicore = 67170
              const calcularNetoFactura = (f: FacturaArca) => (f.imp_neto_gravado || 0) + (f.imp_neto_no_gravado || 0) + (f.imp_op_exentas || 0)

              if (nuevoEstado === 'pagar') {
                const facturasDesdePendiente = facturasACambiar.filter(f => f.estado === 'pendiente')
                const facturasCalificanSicore = facturasDesdePendiente.filter(f => calcularNetoFactura(f) > minimoSicore)
                const facturasNoCalifican = facturasACambiar.filter(f =>
                  f.estado !== 'pendiente' || calcularNetoFactura(f) <= minimoSicore
                )

                if (facturasCalificanSicore.length > 0) {
                  // Confirmar proceso SICORE (mostrar fecha de pago si está seleccionada)
                  // Usar split/reverse para evitar problema timezone con new Date()
                  const mensajeFecha = fechaPagoSeleccionada
                    ? `\n📅 Fecha de pago: ${fechaPagoSeleccionada.split('-').reverse().join('/')}`
                    : ''
                  const confirmar = window.confirm(
                    `${facturasCalificanSicore.length} factura(s) califican para retención SICORE:\n\n` +
                    facturasCalificanSicore.map(f => `• ${f.denominacion_emisor}`).join('\n') +
                    mensajeFecha +
                    `\n\n¿Procesar SICORE una por una?`
                  )
                  if (!confirmar) return

                  // Primero cambiar las que NO califican para SICORE (con fecha si aplica)
                  if (facturasNoCalifican.length > 0) {
                    const idsNoSicore = facturasNoCalifican.map(f => f.id)
                    await supabase
                      .schema('msa')
                      .from('comprobantes_arca')
                      .update(datosUpdate)
                      .in('id', idsNoSicore)

                    setFacturasPagos(prev => prev.map(f =>
                      idsNoSicore.includes(f.id)
                        ? { ...f, estado: 'pagar', ...(fechaPagoSeleccionada && { fecha_vencimiento: fechaPagoSeleccionada, fecha_estimada: fechaPagoSeleccionada }) }
                        : f
                    ))
                  }

                  // Iniciar cola SICORE
                  setFacturasSeleccionadasPagos(new Set())
                  setProcesandoColaSicore(true)

                  // Tomar la primera y poner el resto en cola (con fecha actualizada)
                  const facturasConFecha = facturasCalificanSicore.map(f => ({
                    ...f,
                    ...(fechaPagoSeleccionada && { fecha_vencimiento: fechaPagoSeleccionada, fecha_estimada: fechaPagoSeleccionada })
                  }))
                  const [primera, ...resto] = facturasConFecha
                  setColaSicore(resto)

                  // Procesar la primera (actualizar BD con fecha)
                  const { error } = await supabase
                    .schema('msa')
                    .from('comprobantes_arca')
                    .update(datosUpdate)
                    .eq('id', primera.id)

                  if (error) {
                    alert('Error al cambiar estado')
                    return
                  }

                  setFacturasPagos(prev => prev.map(f =>
                    f.id === primera.id
                      ? { ...f, estado: 'pagar', ...(fechaPagoSeleccionada && { fecha_vencimiento: fechaPagoSeleccionada, fecha_estimada: fechaPagoSeleccionada }) }
                      : f
                  ))

                  setGuardadoPendiente({
                    facturaId: primera.id,
                    columna: 'estado',
                    valor: 'pagar',
                    estadoAnterior: 'pendiente'
                  })

                  // SICORE usará la fecha_vencimiento actualizada para calcular quincena
                  await evaluarRetencionSicore({ ...primera, estado: 'pagar' })
                  return
                }
              }

              // Cambio normal (sin SICORE) - incluye fecha si está seleccionada
              const mensajeFecha = fechaPagoSeleccionada
                ? `\n📅 Fecha de pago: ${fechaPagoSeleccionada.split('-').reverse().join('/')}`
                : ''
              const confirmar = window.confirm(
                `¿Cambiar ${facturasSeleccionadasPagos.size} factura(s) a estado "${nuevoEstado}"?${mensajeFecha}`
              )
              if (!confirmar) return

              try {
                const { error } = await supabase
                  .schema('msa')
                  .from('comprobantes_arca')
                  .update(datosUpdate)
                  .in('id', ids)

                if (error) throw error

                // Actualizar estado local (incluye fecha si aplica)
                setFacturasPagos(prev => prev.map(f =>
                  ids.includes(f.id)
                    ? { ...f, estado: nuevoEstado, ...(fechaPagoSeleccionada && { fecha_vencimiento: fechaPagoSeleccionada, fecha_estimada: fechaPagoSeleccionada }) }
                    : f
                ))
                setFacturasSeleccionadasPagos(new Set())

                // También actualizar facturas principales
                cargarFacturas()
              } catch (error) {
                console.error('Error cambiando estado:', error)
                alert('Error al cambiar estado')
              }
            }

            // Función para renderizar tabla de facturas
            const renderTablaFacturas = (facturas: FacturaArca[], titulo: string, subtotal: number, estadoActual: string, mostrarCheckbox: boolean = true, accionBoton?: { label: string, estado: string }) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{titulo} ({facturas.length})</h3>
                  <div className="flex items-center gap-4">
                    {accionBoton && facturasSeleccionadasPagos.size > 0 && facturas.some(f => facturasSeleccionadasPagos.has(f.id)) && (
                      <Button
                        size="sm"
                        onClick={() => cambiarEstadoSeleccionadas(accionBoton.estado)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {accionBoton.label} ({Array.from(facturasSeleccionadasPagos).filter(id => facturas.some(f => f.id === id)).length})
                      </Button>
                    )}
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                </div>

                {facturas.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-2">No hay facturas en este estado</p>
                ) : (
                  <div className="border rounded-md max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-white border-b">
                        <TableRow>
                          {mostrarCheckbox && <TableHead className="w-10"></TableHead>}
                          <TableHead>Fecha Vto.</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>CUIT</TableHead>
                          <TableHead>Cuenta</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {facturas.map(f => (
                          <TableRow key={f.id} className="hover:bg-muted/50">
                            {mostrarCheckbox && (
                              <TableCell>
                                <Checkbox
                                  checked={facturasSeleccionadasPagos.has(f.id)}
                                  onCheckedChange={(checked) => {
                                    setFacturasSeleccionadasPagos(prev => {
                                      const next = new Set(prev)
                                      if (checked) next.add(f.id)
                                      else next.delete(f.id)
                                      return next
                                    })
                                  }}
                                />
                              </TableCell>
                            )}
                            <TableCell>{f.fecha_vencimiento || f.fecha_estimada || '-'}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{f.denominacion_emisor}</TableCell>
                            <TableCell>{f.cuit}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{f.cuenta_contable || '-'}</TableCell>
                            <TableCell className="text-right font-medium">
                              ${(f.monto_a_abonar || f.imp_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )

            // Función para renderizar tabla de templates
            const renderTablaTemplates = (templates: any[], titulo: string, subtotal: number, mostrarCheckbox: boolean = true) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700">Template</Badge>
                    {titulo} ({templates.length})
                  </h3>
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Badge>
                </div>

                {templates.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-2">No hay templates en este estado</p>
                ) : (
                  <div className="border rounded-md max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-white border-b">
                        <TableRow>
                          {mostrarCheckbox && <TableHead className="w-10"></TableHead>}
                          <TableHead>Fecha Vto.</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Cuenta</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.map(t => (
                          <TableRow key={t.id} className="hover:bg-muted/50">
                            {mostrarCheckbox && (
                              <TableCell>
                                <Checkbox
                                  checked={templatesSeleccionadosPagos.has(t.id)}
                                  onCheckedChange={(checked) => {
                                    setTemplatesSeleccionadosPagos(prev => {
                                      const next = new Set(prev)
                                      if (checked) next.add(t.id)
                                      else next.delete(t.id)
                                      return next
                                    })
                                  }}
                                />
                              </TableCell>
                            )}
                            <TableCell>{t.fecha_vencimiento || t.fecha_estimada || '-'}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{t.egreso?.nombre_referencia || t.descripcion || '-'}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{t.egreso?.nombre_quien_cobra || '-'}</TableCell>
                            <TableCell className="max-w-[100px] truncate">{t.egreso?.categ || '-'}</TableCell>
                            <TableCell className="text-right font-medium">
                              ${(t.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )

            // Filtrar templates por estado
            const templatesPreparado = templatesPagos.filter(t => t.estado === 'preparado')
            const templatesPagar = templatesPagos.filter(t => t.estado === 'pagar')
            const templatesPendiente = templatesPagos.filter(t => t.estado === 'pendiente')

            // Calcular subtotales templates
            const subtotalTemplatesPreparado = templatesPreparado.reduce((sum, t) => sum + (t.monto || 0), 0)
            const subtotalTemplatesPagar = templatesPagar.reduce((sum, t) => sum + (t.monto || 0), 0)
            const subtotalTemplatesPendiente = templatesPendiente.reduce((sum, t) => sum + (t.monto || 0), 0)

            return (
              <div className="space-y-6">
                {/* Checkboxes de filtro solo para Admin */}
                {esAdmin && (
                  <div className="flex gap-4 p-3 bg-muted/50 rounded-md">
                    <Label className="font-medium">Mostrar:</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={filtrosPagos.preparado}
                        onCheckedChange={(checked) => setFiltrosPagos(prev => ({ ...prev, preparado: !!checked }))}
                      />
                      <span className="text-sm">Preparado ({facturasPreparado.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={filtrosPagos.pagar}
                        onCheckedChange={(checked) => setFiltrosPagos(prev => ({ ...prev, pagar: !!checked }))}
                      />
                      <span className="text-sm">Pagar ({facturasPagar.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={filtrosPagos.pendiente}
                        onCheckedChange={(checked) => setFiltrosPagos(prev => ({ ...prev, pendiente: !!checked }))}
                      />
                      <span className="text-sm">Pendiente ({facturasPendiente.length})</span>
                    </div>
                  </div>
                )}

                {/* Vista diferenciada por rol */}
                {esAdmin ? (
                  // ADMIN: Preparado > Pagar > Pendiente (con filtros)
                  <>
                    {filtrosPagos.preparado && (
                      <>
                        {filtroOrigenPagos.arca && renderTablaFacturas(
                          facturasPreparado,
                          '✅ ARCA Preparado',
                          subtotalPreparado,
                          'preparado',
                          true,
                          { label: 'Marcar como Pagado', estado: 'pagado' }
                        )}
                        {filtroOrigenPagos.template && renderTablaTemplates(
                          templatesPreparado,
                          '✅ Preparado',
                          subtotalTemplatesPreparado,
                          true
                        )}
                      </>
                    )}
                    {filtrosPagos.pagar && (
                      <>
                        {filtroOrigenPagos.arca && renderTablaFacturas(
                          facturasPagar,
                          '📋 ARCA Pagar',
                          subtotalPagar,
                          'pagar',
                          true,
                          { label: 'Marcar como Preparado', estado: 'preparado' }
                        )}
                        {filtroOrigenPagos.template && renderTablaTemplates(
                          templatesPagar,
                          '📋 Pagar',
                          subtotalTemplatesPagar,
                          true
                        )}
                      </>
                    )}
                    {filtrosPagos.pendiente && (
                      <>
                        {filtroOrigenPagos.arca && renderTablaFacturas(
                          facturasPendiente,
                          '⏳ ARCA Pendiente',
                          subtotalPendiente,
                          'pendiente',
                          true,
                          { label: 'Marcar como Pagar', estado: 'pagar' }
                        )}
                        {filtroOrigenPagos.template && renderTablaTemplates(
                          templatesPendiente,
                          '⏳ Pendiente',
                          subtotalTemplatesPendiente,
                          true
                        )}
                      </>
                    )}
                  </>
                ) : (
                  // ULISES (contable): Pagar > Preparado
                  <>
                    {filtroOrigenPagos.arca && renderTablaFacturas(
                      facturasPagar,
                      '📋 ARCA Por Pagar',
                      subtotalPagar,
                      'pagar',
                      true,
                      { label: 'Marcar como Preparado', estado: 'preparado' }
                    )}
                    {filtroOrigenPagos.template && renderTablaTemplates(
                      templatesPagar,
                      '📋 Por Pagar',
                      subtotalTemplatesPagar,
                      true
                    )}
                    {filtroOrigenPagos.arca && renderTablaFacturas(
                      facturasPreparado,
                      '✅ ARCA Preparado',
                      subtotalPreparado,
                      'preparado',
                      false // Ulises no puede cambiar estado de preparado
                    )}
                    {filtroOrigenPagos.template && renderTablaTemplates(
                      templatesPreparado,
                      '✅ Preparado',
                      subtotalTemplatesPreparado,
                      false
                    )}
                  </>
                )}

                {/* Total general */}
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      {filtroOrigenPagos.arca && filtroOrigenPagos.template
                        ? 'ARCA + Templates'
                        : filtroOrigenPagos.arca
                        ? 'Solo ARCA'
                        : filtroOrigenPagos.template
                        ? 'Solo Templates'
                        : 'Sin datos'}
                    </div>
                    <Badge className="text-xl px-4 py-2 bg-green-600">
                      Total General: ${(
                        (filtroOrigenPagos.arca ? subtotalPreparado + subtotalPagar + (esAdmin ? subtotalPendiente : 0) : 0) +
                        (filtroOrigenPagos.template ? subtotalTemplatesPreparado + subtotalTemplatesPagar + (esAdmin ? subtotalTemplatesPendiente : 0) : 0)
                      ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                </div>
              </div>
            )
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setMostrarModalPagos(false)
              setFacturasSeleccionadasPagos(new Set())
            }}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}