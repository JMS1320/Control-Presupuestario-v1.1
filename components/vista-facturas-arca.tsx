"use client"

import { useState, useEffect } from "react"
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
import { Loader2, Settings2, Receipt, Info, Eye, EyeOff, Filter, X, Edit3, Save, Check, Upload, FileSpreadsheet, AlertTriangle, CheckCircle } from "lucide-react"
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
              className="h-6 text-xs p-1 w-full"
              disabled={guardandoCambio}
            />
          ) : (['monto_a_abonar', 'imp_total'].includes(columna as string)) ? (
            <Input
              type="number"
              step="0.01"
              value={String(celdaEnEdicion.valor)}
              onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
              className="h-6 text-xs p-1 w-full text-right"
              disabled={guardandoCambio}
            />
          ) : (columna === 'estado') ? (
            <Select 
              value={String(celdaEnEdicion.valor)} 
              onValueChange={(value) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: value } : null)}
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
          ) : (
            <Input
              type="text"
              value={String(celdaEnEdicion.valor)}
              onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
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
            <CardTitle>📋 Facturas del Período {periodoConsulta}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {facturasPeriodo.length} facturas encontradas
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <Table>
                <TableHeader>
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
                    <TableHead>Neto Gravado</TableHead>
                    <TableHead>Neto No Gravado</TableHead>
                    <TableHead>Op. Exentas</TableHead>
                    <TableHead>Otros Tributos</TableHead>
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
                      <TableCell className="text-right">${Number(factura.imp_neto_gravado || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">${Number(factura.imp_neto_no_gravado || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">${Number(factura.imp_op_exentas || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">${Number(factura.otros_tributos || 0).toLocaleString('es-AR')}</TableCell>
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
            {/* Scroll horizontal simple */}
            <div className="w-full overflow-auto max-h-[600px] border rounded-md">
              <div style={{ minWidth: 'fit-content' }}>
                <Table>
                  <TableHeader>
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
                    <TableHeader>
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
    </div>
  )
}