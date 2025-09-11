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
        f.denominacion_emisor.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por CUIT
    if (busquedaCUIT.trim()) {
      facturasFiltradas = facturasFiltradas.filter(f => 
        f.cuit.includes(busquedaCUIT)
      )
    }
    
    // Filtro por detalle
    if (busquedaDetalle.trim()) {
      const busqueda = busquedaDetalle.toLowerCase()
      facturasFiltradas = facturasFiltradas.filter(f => 
        f.detalle?.toLowerCase().includes(busqueda)
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
        f.cuenta_contable?.toLowerCase().includes(busqueda)
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
      
      // DESCARGA AUTOMÁTICA: Generar PDF + Excel con facturas confirmadas
      if (facturasPeriodo.length > 0) {
        const facturasConfirmadas = facturasPeriodo.filter(f => f.ddjj_iva === 'DDJJ OK')
        
        console.log('📥 Iniciando descarga automática...', {
          periodo: periodoConsulta,
          totalFacturas: facturasConfirmadas.length
        })
        
        // Generar archivos automáticamente
        descargarExcelDDJJ(facturasConfirmadas, periodoConsulta)
        setTimeout(() => descargarPDFDDJJ(facturasConfirmadas, periodoConsulta), 500)
        
        alert(`✅ DDJJ confirmada para período ${periodoConsulta}\n\n📥 Descargando automáticamente:\n• Excel con datos detallados\n• PDF con resumen y totales`)
      } else {
        alert(`✅ DDJJ confirmada para período ${periodoConsulta}`)
      }
    } catch (error) {
      console.error('Error confirmando DDJJ:', error)
      alert('Error al confirmar DDJJ')
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
      
      // Preparar datos para Excel
      const datosExcel = facturas.map((f, index) => {
        console.log(`📋 Procesando factura ${index + 1}:`, f)
        return {
          'Fecha Factura': f.fecha_factura || '',
          'Tipo Comprobante': f.tipo_comprobante || '',
          'Punto Venta': f.punto_venta || '',
          'Número Factura': f.numero_factura || '',
          'CUIT Emisor': f.cuit_emisor || '',
          'Razón Social': f.razon_social || '',
          'Neto Gravado': f.imp_neto_gravado || 0,
          'Neto No Gravado': f.imp_neto_no_gravado || 0,
          'Op. Exentas': f.imp_op_exentas || 0,
          'Total IVA': f.imp_total_iva || 0,
          'Otros Tributos': f.imp_otros_tributos || 0,
          'Importe Total': f.imp_total || 0,
          'Estado DDJJ': f.ddjj_iva || '',
          'Mes Contable': f.mes_contable || '',
          'Año Contable': f.año_contable || ''
        }
      })

      console.log('📊 Datos Excel preparados:', datosExcel)

      // Crear libro Excel
      const ws = XLSX.utils.json_to_sheet(datosExcel)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `DDJJ ${periodo}`)
      
      // Descargar archivo
      const filename = `DDJJ_IVA_${periodo.replace('/', '-')}_${new Date().toISOString().split('T')[0]}.xlsx`
      console.log('💾 Descargando Excel:', filename)
      XLSX.writeFile(wb, filename)
      
      console.log('✅ Excel generado exitosamente:', filename)
    } catch (error) {
      console.error('❌ Error detallado generando Excel:', error)
      console.error('📊 Facturas recibidas:', facturas)
      alert('Error al generar archivo Excel: ' + (error as Error).message)
    }
  }

  // Generar y descargar PDF DDJJ
  const descargarPDFDDJJ = (facturas: FacturaArca[], periodo: string) => {
    try {
      const doc = new jsPDF()
      
      // Título
      doc.setFontSize(16)
      doc.text(`DECLARACIÓN JURADA IVA - PERÍODO ${periodo}`, 20, 20)
      
      // Información general
      doc.setFontSize(10)
      doc.text(`Fecha generación: ${new Date().toLocaleDateString('es-AR')}`, 20, 35)
      doc.text(`Total facturas: ${facturas.length}`, 20, 42)
      
      // Calcular totales
      const totales = facturas.reduce((acc, f) => ({
        neto_gravado: acc.neto_gravado + (f.imp_neto_gravado || 0),
        neto_no_gravado: acc.neto_no_gravado + (f.imp_neto_no_gravado || 0),
        op_exentas: acc.op_exentas + (f.imp_op_exentas || 0),
        total_iva: acc.total_iva + (f.imp_total_iva || 0),
        otros_tributos: acc.otros_tributos + (f.imp_otros_tributos || 0),
        importe_total: acc.importe_total + (f.imp_total || 0)
      }), {
        neto_gravado: 0, neto_no_gravado: 0, op_exentas: 0, 
        total_iva: 0, otros_tributos: 0, importe_total: 0
      })

      doc.text(`Total Neto Gravado: $${totales.neto_gravado.toLocaleString('es-AR')}`, 20, 49)
      doc.text(`Total IVA: $${totales.total_iva.toLocaleString('es-AR')}`, 20, 56)
      doc.text(`Total General: $${totales.importe_total.toLocaleString('es-AR')}`, 20, 63)
      
      // Tabla con facturas (solo primeras 100 por límites de página)
      const datosTabla = facturas.slice(0, 100).map(f => [
        f.fecha_factura || '',
        f.tipo_comprobante || '',
        `${f.punto_venta || ''}-${f.numero_factura || ''}`,
        f.razon_social?.substring(0, 25) || '',
        (f.imp_total || 0).toLocaleString('es-AR'),
        f.ddjj_iva || ''
      ])

      // Usar autoTable importado
      autoTable(doc, {
        head: [['Fecha', 'Tipo', 'Número', 'Razón Social', 'Total', 'Estado']],
        body: datosTabla,
        startY: 75,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] }
      })

      // Descargar archivo
      const filename = `DDJJ_IVA_${periodo.replace('/', '-')}_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(filename)
      
      console.log('📥 PDF generado:', filename)
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

    // TODO: Verificar permisos por rol (admin vs contable)
    const rolUsuario = 'admin' // Temporal - obtener del contexto/localStorage real
    
    // Validar permisos por factura seleccionada
    const facturasArray = Array.from(facturasSeleccionadasGestion)
    const facturasProhibidas = facturasPeriodo.filter(f => 
      facturasArray.includes(f.id) && 
      f.ddjj_iva === 'DDJJ OK' && 
      rolUsuario !== 'admin'
    )

    if (facturasProhibidas.length > 0) {
      alert(`❌ Sin permisos: ${facturasProhibidas.length} facturas tienen estado "DDJJ OK" y requieren permisos de administrador`)
      return
    }

    const confirmar = window.confirm(
      `¿Confirmar cambios masivos?\n\n` +
      `• ${facturasSeleccionadasGestion.size} facturas seleccionadas\n` +
      `• Nuevo estado DDJJ: ${nuevoEstadoDDJJ || '(sin cambios)'}\n` +
      `• Nuevo período: ${nuevoPeriodo || '(sin cambios)'}\n\n` +
      `⚠️ Esta acción modificará múltiples registros.`
    )

    if (!confirmar) return

    try {
      // Preparar datos de actualización
      const updateData: any = {}
      
      if (nuevoEstadoDDJJ) {
        updateData.ddjj_iva = nuevoEstadoDDJJ
      }
      
      if (nuevoPeriodo) {
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
                {periodoConsulta && facturasPeriodo.length > 0 && (
                  <Button 
                    onClick={() => {
                      console.log('🔧 DEBUG: Click Gestionar Facturas')
                      console.log('Estado actual mostrarGestionMasiva:', mostrarGestionMasiva)
                      setMostrarGestionMasiva(true)
                      console.log('Después de setMostrarGestionMasiva(true)')
                    }}
                    variant="outline"
                    className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
                  >
                    🔧 Gestionar Facturas ({facturasPeriodo.length})
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
                      <TableCell>{formatearFecha(factura.fecha_emision)}</TableCell>
                      <TableCell className="max-w-48 truncate">{factura.denominacion_emisor}</TableCell>
                      <TableCell>{factura.cuit}</TableCell>
                      <TableCell>{factura.tipo_comprobante}</TableCell>
                      <TableCell className="text-right">${Number(factura.imp_neto_gravado || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">${Number(factura.imp_neto_no_gravado || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">${Number(factura.imp_op_exentas || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">${Number(factura.imp_otros_tributos || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">${Number(factura.imp_total_iva || 0).toLocaleString('es-AR')}</TableCell>
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

      {/* Modal Gestión Masiva de Facturas */}
      {console.log('🔍 DEBUG: Renderizando modal gestión masiva, open:', mostrarGestionMasiva)}
      <Dialog open={mostrarGestionMasiva} onOpenChange={setMostrarGestionMasiva}>
        <DialogContent 
          className="max-w-4xl max-h-[80vh] overflow-y-auto" 
          style={{
            zIndex: 99999,
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            boxShadow: '0 10px 50px rgba(0, 0, 0, 0.5)'
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🔧 Gestionar Facturas Masivamente
            </DialogTitle>
            <DialogDescription>
              Selecciona facturas y modifica estado DDJJ o período contable
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Controles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
              {/* Cambiar Estado DDJJ */}
              <div className="space-y-2">
                <Label>Cambiar Estado DDJJ</Label>
                <Select value={nuevoEstadoDDJJ} onValueChange={setNuevoEstadoDDJJ}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin cambios</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Imputado">Imputado</SelectItem>
                    <SelectItem value="DDJJ OK">DDJJ OK</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cambiar Período */}
              <div className="space-y-2">
                <Label>Cambiar Período MM/AAAA</Label>
                <Select value={nuevoPeriodo} onValueChange={setNuevoPeriodo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin cambios</SelectItem>
                    {generarPeriodos().map(periodo => (
                      <SelectItem key={periodo} value={periodo}>{periodo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabla facturas con checkboxes */}
            {facturasPeriodo.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Seleccionar Facturas</Label>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFacturasSeleccionadasGestion(new Set(facturasPeriodo.map(f => f.id)))}
                    >
                      Todas
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFacturasSeleccionadasGestion(new Set())}
                    >
                      Ninguna
                    </Button>
                  </div>
                </div>
                
                <div className="border rounded max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={facturasSeleccionadasGestion.size === facturasPeriodo.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFacturasSeleccionadasGestion(new Set(facturasPeriodo.map(f => f.id)))
                              } else {
                                setFacturasSeleccionadasGestion(new Set())
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Razón Social</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado DDJJ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facturasPeriodo.map((factura) => (
                        <TableRow key={factura.id}>
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
                          <TableCell>{factura.fecha_factura}</TableCell>
                          <TableCell>{factura.tipo_comprobante}</TableCell>
                          <TableCell>{factura.punto_venta}-{factura.numero_factura}</TableCell>
                          <TableCell>{factura.razon_social?.substring(0, 30)}...</TableCell>
                          <TableCell>${(factura.imp_total || 0).toLocaleString('es-AR')}</TableCell>
                          <TableCell>
                            <Badge variant={factura.ddjj_iva === 'DDJJ OK' ? 'default' : 'secondary'}>
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

            {/* Botones de acción */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setMostrarGestionMasiva(false)
                  setFacturasSeleccionadasGestion(new Set())
                  setNuevoEstadoDDJJ('')
                  setNuevoPeriodo('')
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={ejecutarGestionMasiva}
                disabled={facturasSeleccionadasGestion.size === 0 || (!nuevoEstadoDDJJ && !nuevoPeriodo)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                🔧 Aplicar Cambios ({facturasSeleccionadasGestion.size} facturas)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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