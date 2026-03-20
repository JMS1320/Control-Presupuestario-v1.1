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
import { Loader2, Settings2, Receipt, Info, Eye, EyeOff, Filter, X, Edit3, Save, Check, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Calendar, RefreshCw, Trash2, MoreHorizontal, Search, Download, FileText } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CategCombobox } from "@/components/ui/categ-combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCuentasContables } from "@/hooks/useCuentasContables"
import useInlineEditor, { type CeldaEnEdicion } from "@/hooks/useInlineEditor"
import { supabase } from "@/lib/supabase"
import { VistaHistoricoFacturas } from "@/components/vista-historico-facturas"
import { VistaAsignacionArca } from "@/components/vista-asignacion-arca"
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
  tipo_sicore: string | null
  descuento_aplicado: number | null
  // Agrupación de pagos
  grupo_pago_id: string | null
  // TC de pago (editable, solo USD)
  tc_pago: number | null
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

function TablaRegistrosV2({ registros, onCertificado }: { registros: any[], onCertificado?: (registro: any) => void }) {
  const fmt = (n: any) => `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  const fmtFecha = (f: string | null) => {
    if (!f) return '-'
    const d = new Date(f + 'T12:00:00')
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
  }
  const origenColor: Record<string, string> = {
    directo: 'bg-blue-100 text-blue-700',
    anticipo: 'bg-purple-100 text-purple-700',
    agrupacion: 'bg-orange-100 text-orange-700',
  }
  const totRet   = registros.reduce((s, r) => s + (Number(r.retencion) || 0), 0)
  const totPago  = registros.reduce((s, r) => s + (Number(r.pago) || 0), 0)
  const totTotal = registros.reduce((s, r) => s + (Number(r.total_pagado) || 0), 0)
  const totBase  = registros.reduce((s, r) => s + (Number(r.base_imponible) || 0), 0)
  const totNeto  = registros.reduce((s, r) => s + (Number(r.neto_gravado_pagado) || 0), 0)

  return (
    <div className="overflow-x-auto rounded border border-green-200 max-h-[350px] overflow-y-auto">
      <table className="w-full text-xs border-collapse min-w-[900px]">
        <thead className="bg-green-100 sticky top-0">
          <tr>
            <th className="border border-green-200 px-2 py-1.5 text-left">Origen</th>
            <th className="border border-green-200 px-2 py-1.5 text-left">Tipo</th>
            <th className="border border-green-200 px-2 py-1.5 text-left">Fecha Pago</th>
            <th className="border border-green-200 px-2 py-1.5 text-left">CUIT</th>
            <th className="border border-green-200 px-2 py-1.5 text-left">Denominación</th>
            <th className="border border-green-200 px-2 py-1.5 text-right">Neto Grav.Pag.</th>
            <th className="border border-green-200 px-2 py-1.5 text-right">Total Pagado</th>
            <th className="border border-green-200 px-2 py-1.5 text-right">Base Imp.</th>
            <th className="border border-green-200 px-2 py-1.5 text-right">Alíc.%</th>
            <th className="border border-green-200 px-2 py-1.5 text-right">Retención</th>
            <th className="border border-green-200 px-2 py-1.5 text-right">Pago</th>
            {onCertificado && <th className="border border-green-200 px-2 py-1.5 text-center">Cert.</th>}
          </tr>
        </thead>
        <tbody>
          {registros.map((r, i) => (
            <tr key={r.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}>
              <td className="border border-green-100 px-2 py-1">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${origenColor[r.origen] || 'bg-gray-100 text-gray-700'}`}>
                  {r.origen || '-'}
                </span>
              </td>
              <td className="border border-green-100 px-2 py-1">{r.tipo_sicore || '-'}</td>
              <td className="border border-green-100 px-2 py-1 whitespace-nowrap">{fmtFecha(r.fecha_pago)}</td>
              <td className="border border-green-100 px-2 py-1 whitespace-nowrap">{r.cuit_emisor || '-'}</td>
              <td className="border border-green-100 px-2 py-1 max-w-[150px] truncate" title={r.denominacion_emisor || ''}>{r.denominacion_emisor || '-'}</td>
              <td className="border border-green-100 px-2 py-1 text-right">{fmt(r.neto_gravado_pagado)}</td>
              <td className="border border-green-100 px-2 py-1 text-right">{fmt(r.total_pagado)}</td>
              <td className="border border-green-100 px-2 py-1 text-right">{fmt(r.base_imponible)}</td>
              <td className="border border-green-100 px-2 py-1 text-right">
                {r.alicuota != null ? `${(Number(r.alicuota) * 100).toFixed(2)}%` : '-'}
              </td>
              <td className="border border-green-100 px-2 py-1 text-right font-medium text-red-700">{fmt(r.retencion)}</td>
              <td className="border border-green-100 px-2 py-1 text-right font-medium text-green-700">{fmt(r.pago)}</td>
              {onCertificado && (
                <td className="border border-green-100 px-2 py-1 text-center">
                  <button
                    onClick={() => onCertificado(r)}
                    title="Descargar Certificado de Retención"
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-green-100 font-semibold sticky bottom-0">
          <tr>
            <td colSpan={5} className="border border-green-200 px-2 py-1.5 text-right text-xs">
              TOTALES — {registros.length} registro{registros.length !== 1 ? 's' : ''}
            </td>
            <td className="border border-green-200 px-2 py-1.5 text-right">{fmt(totNeto)}</td>
            <td className="border border-green-200 px-2 py-1.5 text-right">{fmt(totTotal)}</td>
            <td className="border border-green-200 px-2 py-1.5 text-right">{fmt(totBase)}</td>
            <td className="border border-green-200 px-2 py-1.5"></td>
            <td className="border border-green-200 px-2 py-1.5 text-right text-red-700">{fmt(totRet)}</td>
            <td className="border border-green-200 px-2 py-1.5 text-right text-green-700">{fmt(totPago)}</td>
            {onCertificado && <td className="border border-green-200 px-2 py-1.5"></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function VistaFacturasArca() {
  const [facturas, setFacturas] = useState<FacturaArca[]>([])
  const [facturasOriginales, setFacturasOriginales] = useState<FacturaArca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Hook para validación de categorías
  const { cuentas, validarCateg, buscarSimilares, crearCuentaContable } = useCuentasContables()
  
  // Estados para filtros
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [busquedaRapida, setBusquedaRapida] = useState('')
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
  const [tabActivo, setTabActivo] = useState<'facturas' | 'subdiarios' | 'historico' | 'asignacion'>('facturas')
  
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
  // Descuento en SICORE
  const [descuentoTipoInput, setDescuentoTipoInput] = useState<'pct' | 'monto'>('pct')
  const [descuentoInputValor, setDescuentoInputValor] = useState('')
  const [descuentoDesglose, setDescuentoDesglose] = useState<{
    gravado: number, iva: number, noGravado: number, exento: number, total: number
  } | null>(null)

  // Estado para guardado pendiente - permite cancelar SICORE sin guardar estado
  const [guardadoPendiente, setGuardadoPendiente] = useState<{facturaId: string, columna: string, valor: any, estadoAnterior: string} | null>(null)

  // Estado para confirmación actualización quincena SICORE al pagar
  const [confirmCambioQuincena, setConfirmCambioQuincena] = useState<{
    facturaId: string
    quincenaAnterior: string
    quincenahNueva: string
  } | null>(null)
  
  // Estados para cierre de quincena SICORE
  const [mostrarModalCierreQuincena, setMostrarModalCierreQuincena] = useState(false)
  const [quincenaSeleccionada, setQuincenaSeleccionada] = useState('')
  const [procesandoCierre, setProcesandoCierre] = useState(false)

  // Estados para panel SICORE (botón unificado)
  const [mostrarModalPanelSicore, setMostrarModalPanelSicore] = useState(false)
  const [tabPanelSicore, setTabPanelSicore] = useState<'ver' | 'cerrar' | 'v2'>('ver')
  const [procesandoCierreV2, setProcesandoCierreV2] = useState(false)
  const [quincenaSeleccionadaV2, setQuincenaSeleccionadaV2] = useState(() => {
    const hoy = new Date()
    const yy = hoy.getFullYear().toString().slice(-2)
    const mm = (hoy.getMonth() + 1).toString().padStart(2, '0')
    const mitad = hoy.getDate() <= 15 ? '1ra' : '2da'
    return `${yy}-${mm} - ${mitad}`
  })
  const [conteoV2, setConteoV2] = useState<{ cantidad: number; totalRetencion: number; totalPago: number } | null>(null)
  const [registrosV2, setRegistrosV2] = useState<any[]>([])
  const [cargandoV2, setCargandoV2] = useState(false)
  const [quincenaVerRetenciones, setQuincenaVerRetenciones] = useState('')
  const [retencionesVer, setRetencionesVer] = useState<any[]>([])
  const [cargandoRetencionesVer, setCargandoRetencionesVer] = useState(false)

  // Estados SICORE para anticipos (desde Vista de Pagos)
  const [anticipoSicoreEnProceso, setAnticipoSicoreEnProceso] = useState<any | null>(null)
  const [mostrarModalSicoreAnt, setMostrarModalSicoreAnt] = useState(false)
  const [pasoSicoreAnt, setPasoSicoreAnt] = useState<'montos' | 'tipo' | 'calculo'>('montos')
  const [tipoSicoreAnt, setTipoSicoreAnt] = useState<TipoSicore | null>(null)
  const [montoSicoreAnt, setMontoSicoreAnt] = useState(0)
  const [descuentoAnt, setDescuentoAnt] = useState(0)
  const [datosSicoreAnt, setDatosSicoreAnt] = useState<{
    baseImponible: number, minimoAplicado: number, esAdicional: boolean
  } | null>(null)
  // Desglose de montos ingresado manualmente para el anticipo
  const [netoGravadoAnt, setNetoGravadoAnt] = useState('')
  const [netoNoGravadoAnt, setNetoNoGravadoAnt] = useState('')
  const [exentoAnt, setExentoAnt] = useState('')
  const [ivaAnt, setIvaAnt] = useState('')

  // Estados para Vista de Pagos
  const [mostrarModalPagos, setMostrarModalPagos] = useState(false)
  const [facturasPagos, setFacturasPagos] = useState<FacturaArca[]>([])
  const [templatesPagos, setTemplatesPagos] = useState<any[]>([])
  const [anticiposPagos, setAnticiposPagos] = useState<any[]>([])

  // Estados para edición masiva en tab Facturas principal
  const [modoEdicionMasiva, setModoEdicionMasiva] = useState(false)
  const [facturasSeleccionadasMasiva, setFacturasSeleccionadasMasiva] = useState<Set<string>>(new Set())
  const [nuevoEstadoMasivo, setNuevoEstadoMasivo] = useState('')
  const [facturasSeleccionadasPagos, setFacturasSeleccionadasPagos] = useState<Set<string>>(new Set())
  const [templatesSeleccionadosPagos, setTemplatesSeleccionadosPagos] = useState<Set<string>>(new Set())
  const [anticiposSeleccionadosPagos, setAnticiposSeleccionadosPagos] = useState<Set<string>>(new Set())
  const [filtrosPagos, setFiltrosPagos] = useState({ pendiente: true, pagar: true, preparado: true })
  const [filtroOrigenPagos, setFiltroOrigenPagos] = useState({ arca: true, template: true, anticipo: true })
  const [filtroBusquedaPagos, setFiltroBusquedaPagos] = useState('')
  const [cargandoPagos, setCargandoPagos] = useState(false)
  const [fechaPagoSeleccionada, setFechaPagoSeleccionada] = useState<string>('')

  // ECHEQ — estado del modal y datos del cheque pendiente
  const [mostrarModalEcheq, setMostrarModalEcheq] = useState(false)
  const [echeqForm, setEcheqForm] = useState({ banco: '', numero: '', fechaEmision: '', fechaCobro: '' })
  // Ref para acceso síncrono desde funciones (evita stale closure)
  const echeqPendienteRef = useRef<{ banco: string; numero: string; fechaEmision: string; fechaCobro: string } | null>(null)
  const [echeqPendiente, setEcheqPendiente] = useState<{ banco: string; numero: string; fechaEmision: string; fechaCobro: string } | null>(null)
  // Ref para exponer cambiarEstadoSeleccionadas (definida en IIFE) al modal ECHEQ
  const cambiarEstadoSeleccionadasRef = useRef<((estado: string, echeqFecha?: string) => void) | null>(null)
  const [echeqEstadoDestino, setEcheqEstadoDestino] = useState<string>('pagar')

  // Cola de facturas pendientes de procesar SICORE (para múltiples selecciones)
  const [colaSicore, setColaSicore] = useState<FacturaArca[]>([])
  const [procesandoColaSicore, setProcesandoColaSicore] = useState(false)

  // TC de pago modal - Vista Pagos
  const [modalTcPagoPagos, setModalTcPagoPagos] = useState<{ factura: FacturaArca } | null>(null)
  const [tcPagoInputPagos, setTcPagoInputPagos] = useState('')
  const [colaUSDSinTC, setColaUSDSinTC] = useState<FacturaArca[]>([])
  
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

      const [arcaResult, historicoResult] = await Promise.all([
        supabase.schema('msa').from('comprobantes_arca').select('*').order('fecha_emision', { ascending: false }),
        supabase.schema('msa').from('comprobantes_historico').select('*').order('fecha', { ascending: false }),
      ])

      if (arcaResult.error) {
        console.error('Error al cargar facturas:', arcaResult.error)
        setError(`Error al cargar facturas: ${arcaResult.error.message}`)
        return
      }

      // Mapear registros históricos al formato FacturaArca
      const historicas: FacturaArca[] = (historicoResult.data || []).map(h => ({
        id: h.id,
        fecha_emision: h.fecha,
        tipo_comprobante: 0,
        punto_venta: h.punto_de_venta ?? null,
        numero_desde: h.numero_desde ?? null,
        numero_hasta: null,
        codigo_autorizacion: null,
        tipo_doc_emisor: null,
        cuit: h.nro_doc_emisor ?? '',
        denominacion_emisor: h.denominacion_emisor ?? '',
        tipo_cambio: 1,
        moneda: 'PES',
        imp_neto_gravado: h.imp_neto_gravado ?? 0,
        imp_neto_no_gravado: h.imp_neto_no_gravado ?? 0,
        imp_op_exentas: h.imp_op_exentas ?? 0,
        otros_tributos: h.otros_tributos ?? 0,
        iva: h.iva ?? 0,
        imp_total: h.imp_total ?? 0,
        campana: null,
        año_contable: h.anio_contable ?? null,
        mes_contable: h.mes_contable ?? null,
        fc: h.fc ?? null,
        cuenta_contable: h.cuenta_contable ?? null,
        centro_costo: null,
        estado: 'historico',
        observaciones_pago: null,
        detalle: null,
        archivo_origen: null,
        fecha_importacion: null,
        fecha_modificacion: null,
        fecha_estimada: null,
        fecha_vencimiento: null,
        monto_a_abonar: null,
        ddjj_iva: 'No',
        created_at: h.created_at ?? '',
        iva_2_5: null, iva_5: null, iva_10_5: null, iva_21: null, iva_27: null,
        neto_grav_iva_0: null, neto_grav_iva_2_5: null, neto_grav_iva_5: null,
        neto_grav_iva_10_5: null, neto_grav_iva_21: null, neto_grav_iva_27: null,
        sicore: null, monto_sicore: null, tipo_sicore: null, descuento_aplicado: null,
        grupo_pago_id: null,
      }))

      const facturasCargadas = [...(arcaResult.data || []), ...historicas]
        .sort((a, b) => (b.fecha_emision ?? '').localeCompare(a.fecha_emision ?? ''))

      setFacturas(facturasCargadas)
      setFacturasOriginales(facturasCargadas)
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al cargar las facturas')
    } finally {
      setLoading(false)
    }
  }

  // Actualizar valor localmente sin recargar desde BD
  const actualizarFacturaLocal = (filaId: string, campo: string, valor: any) => {
    setFacturas(prev => prev.map(f =>
      f.id === filaId ? { ...f, [campo]: valor } : f
    ))
  }

  // Hook unificado (DESPUÉS de cargarFacturas para evitar error inicialización)
  const hookEditor = useInlineEditor({
    onLocalUpdate: (filaId, campo, valor, updateData) => {
      Object.entries(updateData).forEach(([key, val]) => {
        actualizarFacturaLocal(filaId, key, val)
      })
    },
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

      // HOOK SICORE - Al pasar a "pagado": verificar si quincena cambió
      if (datosEdicion.columna === 'estado' && valorFinal === 'pagado') {
        const facturaActual = nuevasFacturas.find(f => f.id === datosEdicion.facturaId)
        if (facturaActual?.sicore && facturaActual?.fecha_estimada) {
          const quincenahNueva = generarQuincenaSicore(facturaActual.fecha_vencimiento || facturaActual.fecha_estimada)
          if (quincenahNueva !== facturaActual.sicore) {
            setConfirmCambioQuincena({
              facturaId: datosEdicion.facturaId,
              quincenaAnterior: facturaActual.sicore,
              quincenahNueva
            })
            return // No mostrar el alert genérico
          }
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

  // Colores por estado (usado en badges)
  const colorEstado = (estado: string): string => {
    const mapa: Record<string, string> = {
      pendiente:  'bg-gray-100 text-gray-600 border-gray-200',
      debito:     'bg-violet-100 text-violet-800 border-violet-200',
      pagar:      'bg-yellow-100 text-yellow-800 border-yellow-200',
      preparado:  'bg-orange-100 text-orange-800 border-orange-200',
      pagado:     'bg-green-100 text-green-800 border-green-200',
      programado: 'bg-violet-100 text-violet-800 border-violet-200',
      credito:    'bg-gray-100 text-gray-600 border-gray-200',
      conciliado: 'bg-gray-100 text-gray-600 border-gray-200',
      anterior:   'bg-gray-100 text-gray-600 border-gray-200',
      historico:  'bg-slate-200 text-slate-600 border-slate-300',
    }
    return mapa[estado] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  }

  // Renderizar valor de celda según el tipo de columna
  const renderizarCelda = (factura: FacturaArca, columna: keyof FacturaArca) => {
    const valor = factura[columna]
    const esEditable = camposEditables.includes(columna as string) && factura.estado !== 'historico'
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
                  <SelectItem value="preparado">Preparado</SelectItem>
                  <SelectItem value="pagado">Pagado</SelectItem>
                  <SelectItem value="programado">Programado</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="conciliado">Conciliado</SelectItem>
                  <SelectItem value="anterior">Anterior</SelectItem>
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

      case 'imp_total': {
        const tcImpTotal = Number(factura.tipo_cambio) || 1
        const esUSDImpTotal = factura.moneda === 'USD' || tcImpTotal > 1.01
        const contenidoImpTotal = formatearNumero(valor as number)
        const celda = esEditable && modoEdicion ? (
          <div
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => iniciarEdicion(factura.id, columna, valor, e)}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoImpTotal}
          </div>
        ) : contenidoImpTotal
        if (!esUSDImpTotal) return celda
        return (
          <div>
            {celda}
            <div className="text-xs text-amber-600 font-normal whitespace-nowrap">
              USD {(Number(valor) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} · TC {tcImpTotal.toLocaleString('es-AR')}
            </div>
          </div>
        )
      }
      
      case 'moneda':
        const esUSDCol = (valor as string) === 'USD' || (Number(factura.tipo_cambio) > 1.01)
        return (
          <Badge className={esUSDCol
            ? 'bg-amber-100 text-amber-800 border-amber-300 font-semibold'
            : 'bg-gray-100 text-gray-600 border-gray-200 font-normal'
          }>
            {esUSDCol ? '💵 USD' : 'ARS'}
          </Badge>
        )

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
          <Badge className={colorEstado(valor as string)}>
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
      
      // Calcular subtotales (todos los importes en pesos: siempre TC de la factura, nunca tc_pago)
      const tcFactura = (f: any) => Number(f.tipo_cambio) || 1
      const totales = facturas.reduce((acc, f) => {
        const tc = tcFactura(f)
        acc.imp_total += (Number(f.imp_total) || 0) * tc
        acc.iva += (Number(f.iva) || 0) * tc
        acc.imp_neto_gravado += (Number(f.imp_neto_gravado) || 0) * tc
        acc.imp_neto_no_gravado += (Number(f.imp_neto_no_gravado) || 0) * tc
        acc.imp_op_exentas += (Number(f.imp_op_exentas) || 0) * tc
        acc.otros_tributos += (Number(f.otros_tributos) || 0) * tc
        return acc
      }, {
        imp_total: 0, iva: 0, imp_neto_gravado: 0,
        imp_neto_no_gravado: 0, imp_op_exentas: 0, otros_tributos: 0
      })

      // Facturas C (tipo 11) por separado
      const facturasC = facturas.filter(f => f.tipo_comprobante === 11)
      const totalFacturasC = facturasC.reduce((sum, f) => {
        return sum + (Number(f.imp_total) || 0) * tcFactura(f)
      }, 0)

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

        const tc = Number(f.tipo_cambio) || 1
        const esUSD = f.moneda === 'USD' || (tc > 1.01)

        // Calcular IVA Diferencial (todo lo que NO es 21%)
        const ivaDiferencial = ((f.iva_2_5 || 0) + (f.iva_5 || 0) + (f.iva_10_5 || 0) + (f.iva_27 || 0)) * tc

        return {
          'Fecha': f.fecha_emision || '',
          'Tipo-N° Comp.': f.tipo_comprobante || '',
          'Razón Social': f.denominacion_emisor || '',
          'C.U.I.T.': f.cuit || '',
          ...(esUSD ? { 'TC': formatearNumeroExcel(tc) } : {}),
          'Neto Gravado': formatearNumeroExcel((f.imp_neto_gravado || 0) * tc),
          'Neto No Gravado': formatearNumeroExcel((f.imp_neto_no_gravado || 0) * tc),
          'Op. Exentas': formatearNumeroExcel((f.imp_op_exentas || 0) * tc),
          'Otros Tributos': formatearNumeroExcel((f.otros_tributos || 0) * tc),
          'IVA 21%': formatearNumeroExcel((f.iva_21 || 0) * tc),
          'IVA Diferencial': formatearNumeroExcel(ivaDiferencial),
          'Total IVA': formatearNumeroExcel((f.iva || 0) * tc),
          'Imp. Total': formatearNumeroExcel((f.imp_total || 0) * tc)
        }
      })

      // Calcular totales para Excel (en pesos)
      const totales = facturas.reduce((acc, f) => {
        const tc = Number(f.tipo_cambio) || 1
        return {
          neto_gravado: acc.neto_gravado + (f.imp_neto_gravado || 0) * tc,
          neto_no_gravado: acc.neto_no_gravado + (f.imp_neto_no_gravado || 0) * tc,
          op_exentas: acc.op_exentas + (f.imp_op_exentas || 0) * tc,
          otros_tributos: acc.otros_tributos + (f.otros_tributos || 0) * tc,
          iva_diferencial: acc.iva_diferencial + ((f.iva_2_5 || 0) + (f.iva_5 || 0) + (f.iva_10_5 || 0) + (f.iva_27 || 0)) * tc,
          total_iva: acc.total_iva + (f.iva || 0) * tc,
          importe_total: acc.importe_total + (f.imp_total || 0) * tc,
          // Alícuotas separadas
          iva_2_5: acc.iva_2_5 + (f.iva_2_5 || 0) * tc,
          iva_5: acc.iva_5 + (f.iva_5 || 0) * tc,
          iva_10_5: acc.iva_10_5 + (f.iva_10_5 || 0) * tc,
          iva_21: acc.iva_21 + (f.iva_21 || 0) * tc,
          iva_27: acc.iva_27 + (f.iva_27 || 0) * tc,
          neto_0: acc.neto_0 + (f.neto_grav_iva_0 || 0) * tc,
          neto_2_5: acc.neto_2_5 + (f.neto_grav_iva_2_5 || 0) * tc,
          neto_5: acc.neto_5 + (f.neto_grav_iva_5 || 0) * tc,
          neto_10_5: acc.neto_10_5 + (f.neto_grav_iva_10_5 || 0) * tc,
          neto_21: acc.neto_21 + (f.neto_grav_iva_21 || 0) * tc,
          neto_27: acc.neto_27 + (f.neto_grav_iva_27 || 0) * tc
        }
      }, {
        neto_gravado: 0, neto_no_gravado: 0, op_exentas: 0, otros_tributos: 0,
        iva_diferencial: 0, total_iva: 0, importe_total: 0,
        iva_2_5: 0, iva_5: 0, iva_10_5: 0, iva_21: 0, iva_27: 0,
        neto_0: 0, neto_2_5: 0, neto_5: 0, neto_10_5: 0, neto_21: 0, neto_27: 0
      })

      // Calcular Monotributista (facturas tipo C)
      const monotributista = facturas
        .filter(f => f.tipo_comprobante === 11) // Tipo 11 = Factura C (MONOTRIBUTISTA)
        .reduce((acc, f) => {
          const tc = Number(f.tipo_cambio) || 1
          return acc + (f.imp_total || 0) * tc
        }, 0)

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
      
      // Calcular totales igual que Excel (todos en pesos via tipo_cambio)
      console.log('🔍 DEBUG PDF: Calculando totales...')
      const totales = facturas.reduce((acc, f) => {
        const tc = Number(f.tipo_cambio) || 1
        return {
          neto_gravado: acc.neto_gravado + (f.imp_neto_gravado || 0) * tc,
          neto_no_gravado: acc.neto_no_gravado + (f.imp_neto_no_gravado || 0) * tc,
          op_exentas: acc.op_exentas + (f.imp_op_exentas || 0) * tc,
          otros_tributos: acc.otros_tributos + (f.otros_tributos || 0) * tc,
          iva_diferencial: acc.iva_diferencial + ((f.iva_2_5 || 0) + (f.iva_5 || 0) + (f.iva_10_5 || 0) + (f.iva_27 || 0)) * tc,
          total_iva: acc.total_iva + (f.iva || 0) * tc,
          importe_total: acc.importe_total + (f.imp_total || 0) * tc,
          iva_2_5: acc.iva_2_5 + (f.iva_2_5 || 0) * tc,
          iva_5: acc.iva_5 + (f.iva_5 || 0) * tc,
          iva_10_5: acc.iva_10_5 + (f.iva_10_5 || 0) * tc,
          iva_21: acc.iva_21 + (f.iva_21 || 0) * tc,
          iva_27: acc.iva_27 + (f.iva_27 || 0) * tc,
          neto_0: acc.neto_0 + (f.neto_grav_iva_0 || 0) * tc,
          neto_2_5: acc.neto_2_5 + (f.neto_grav_iva_2_5 || 0) * tc,
          neto_5: acc.neto_5 + (f.neto_grav_iva_5 || 0) * tc,
          neto_10_5: acc.neto_10_5 + (f.neto_grav_iva_10_5 || 0) * tc,
          neto_21: acc.neto_21 + (f.neto_grav_iva_21 || 0) * tc,
          neto_27: acc.neto_27 + (f.neto_grav_iva_27 || 0) * tc
        }
      }, {
        neto_gravado: 0, neto_no_gravado: 0, op_exentas: 0, otros_tributos: 0,
        iva_diferencial: 0, total_iva: 0, importe_total: 0,
        iva_2_5: 0, iva_5: 0, iva_10_5: 0, iva_21: 0, iva_27: 0,
        neto_0: 0, neto_2_5: 0, neto_5: 0, neto_10_5: 0, neto_21: 0, neto_27: 0
      })

      // Calcular Monotributista (facturas tipo C)
      const monotributista = facturas
        .filter(f => f.tipo_comprobante === 11)
        .reduce((acc, f) => {
          const tc = Number(f.tipo_cambio) || 1
          return acc + (f.imp_total || 0) * tc
        }, 0)

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
        if (index < 3) {
          console.log(`🔍 DEBUG PDF: Procesando factura ${index + 1}:`, {
            fecha: f.fecha_emision,
            proveedor: f.denominacion_emisor,
            cuit: f.cuit,
            total: f.imp_total
          })
        }

        const tc = Number(f.tipo_cambio) || 1
        const esUSD = f.moneda === 'USD' || tc > 1.01
        const ivaDiferencial = ((f.iva_2_5 || 0) + (f.iva_5 || 0) + (f.iva_10_5 || 0) + (f.iva_27 || 0)) * tc

        return [
          f.fecha_emision || '',
          `${esUSD ? '💵 ' : ''}${f.tipo_comprobante || ''}`,
          (f.denominacion_emisor || '').substring(0, 18),
          f.cuit || '',
          formatearNumeroPDF((f.imp_neto_gravado || 0) * tc).trim(),
          formatearNumeroPDF((f.imp_neto_no_gravado || 0) * tc).trim(),
          formatearNumeroPDF((f.imp_op_exentas || 0) * tc).trim(),
          formatearNumeroPDF((f.otros_tributos || 0) * tc).trim(),
          formatearNumeroPDF((f.iva_21 || 0) * tc).trim(),
          formatearNumeroPDF(ivaDiferencial).trim(),
          formatearNumeroPDF((f.iva || 0) * tc).trim(),
          formatearNumeroPDF((f.imp_total || 0) * tc).trim()
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

        // Si se cambia a "No", limpiar año_contable y mes_contable
        if (nuevoEstadoDDJJ === 'No') {
          updateData.año_contable = null
          updateData.mes_contable = null
          console.log('🧹 Limpiando año_contable y mes_contable por cambio a "No"')
        }
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

  // Función edición masiva tab Facturas principal (cambio de estado)
  const ejecutarEdicionMasivaFacturas = async () => {
    if (facturasSeleccionadasMasiva.size === 0) {
      alert('Selecciona al menos una factura')
      return
    }

    if (!nuevoEstadoMasivo) {
      alert('Selecciona un estado para aplicar')
      return
    }

    try {
      const facturasIds = Array.from(facturasSeleccionadasMasiva)
      const LOTE_SIZE = 20

      console.log('🔄 Ejecutando edición masiva facturas:', {
        facturas: facturasIds.length,
        nuevoEstado: nuevoEstadoMasivo
      })

      for (let i = 0; i < facturasIds.length; i += LOTE_SIZE) {
        const lote = facturasIds.slice(i, i + LOTE_SIZE)

        const { error } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({ estado: nuevoEstadoMasivo })
          .in('id', lote)

        if (error) {
          throw new Error(`Error en lote ${Math.floor(i/LOTE_SIZE) + 1}: ${error.message}`)
        }
      }

      // Limpiar selecciones y recargar
      setFacturasSeleccionadasMasiva(new Set())
      setNuevoEstadoMasivo('')
      setModoEdicionMasiva(false)

      await cargarFacturas()

      alert(`✅ Edición masiva completada: ${facturasIds.length} facturas actualizadas a estado "${nuevoEstadoMasivo}"`)
    } catch (error) {
      console.error('Error en edición masiva facturas:', error)
      alert('Error en edición masiva: ' + (error as Error).message)
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

  // Nombre de carpeta: mismo formato de quincena '26-02 - 1ra' / '26-02 - 2da'
  const quincenaACarpeta = (quincena: string): string => quincena

  // Guardar TC de pago en Vista Pagos (individual o cola USD)
  const guardarTcPagoPagos = async () => {
    if (!modalTcPagoPagos) return
    const tc = parseFloat(tcPagoInputPagos.replace(/\./g, '').replace(',', '.'))
    if (!tc || tc <= 1) { toast.error('TC inválido (debe ser mayor a 1)'); return }

    const { error } = await supabase.schema('msa').from('comprobantes_arca')
      .update({ tc_pago: tc }).eq('id', modalTcPagoPagos.factura.id)
    if (error) { toast.error('Error guardando TC de pago'); return }

    setFacturasPagos(prev => prev.map(f =>
      f.id === modalTcPagoPagos.factura.id ? { ...f, tc_pago: tc } : f
    ))
    setModalTcPagoPagos(null)
    setTcPagoInputPagos('')

    if (colaUSDSinTC.length > 0) {
      const [siguiente, ...resto] = colaUSDSinTC
      setColaUSDSinTC(resto)
      setTimeout(() => {
        setModalTcPagoPagos({ factura: siguiente })
        setTcPagoInputPagos('')
      }, 100)
    } else {
      toast.success('TCs guardados. Puede proceder con el cambio de estado.')
    }
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
      // Facturas C (tipo 11 = monotributista): no corresponde retención ganancias
      if (factura.tipo_comprobante === 11) {
        console.log('✅ SICORE: Factura C (tipo 11) - no corresponde retención')
        await ejecutarGuardadoPendiente()
        return
      }

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
  
  // ─── HELPER: insertar en msa.sicore_retenciones (tabla nueva, paralela) ───
  // No toca el flujo viejo. Si falla el insert, solo loguea — no interrumpe el proceso.
  const registrarEnSicoreRetenciones = async (params: {
    origen: 'directo' | 'anticipo' | 'agrupacion'
    quincena: string
    fecha_pago: string
    factura_id?: string | null
    anticipo_id?: string | null
    // Datos de la FC (opcionales para anticipo sin FC vinculada aún)
    fecha_emision?: string | null
    tipo_comprobante?: number | null
    punto_venta?: number | null
    numero_desde?: number | null
    cuit_emisor?: string | null
    denominacion_emisor?: string | null
    // SICORE
    tipo_sicore: string
    alicuota: number
    // Valores ajustados por descuento
    neto_gravado_pagado: number
    total_pagado: number
    descuento_aplicado: number
    // Cálculo
    minimo_no_imponible: number
    base_imponible: number
    retencion: number
    pago: number
  }) => {
    try {
      const { error } = await supabase
        .schema('msa')
        .from('sicore_retenciones')
        .insert(params)
      if (error) console.error('⚠️ sicore_retenciones insert error (no interrumpe flujo):', error)
      else console.log('✅ sicore_retenciones registrado:', params.quincena, params.denominacion_emisor, params.origen)
    } catch (err) {
      console.error('⚠️ sicore_retenciones excepción (no interrumpe flujo):', err)
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
      setDescuentoDesglose(null)
      setDescuentoInputValor('')
      setPasoSicore('calculo')

    } catch (error) {
      console.error('Error calculando retención SICORE:', error)
      alert('Error calculando retención: ' + (error as Error).message)
    }
  }

  // Aplicar descuento al cálculo SICORE, desglosa gravado/IVA con la alícuota de la factura
  const aplicarDescuentoSicore = () => {
    if (!facturaEnProceso || !tipoSeleccionado || !datosSicoreCalculo) return

    const impTotal = facturaEnProceso.imp_total || 0
    const impGravado = facturaEnProceso.imp_neto_gravado || 0
    const impNoGravado = facturaEnProceso.imp_neto_no_gravado || 0
    const impExento = facturaEnProceso.imp_op_exentas || 0
    const impIva = facturaEnProceso.iva || 0

    const inputNum = parseFloat(descuentoInputValor.replace(',', '.')) || 0
    const pct = descuentoTipoInput === 'pct'
      ? inputNum / 100
      : (impTotal > 0 ? inputNum / impTotal : 0)

    const descGravado = impGravado * pct
    const descIva = impIva * pct
    const descNoGravado = impNoGravado * pct
    const descExento = impExento * pct
    const descTotal = descGravado + descIva + descNoGravado + descExento

    setDescuentoDesglose({ gravado: descGravado, iva: descIva, noGravado: descNoGravado, exento: descExento, total: descTotal })
    setDescuentoAdicional(descTotal)

    // Recalcular base SICORE sobre neto ajustado
    const netoAjustado = (impGravado - descGravado) + (impNoGravado - descNoGravado) + (impExento - descExento)
    const minimoAplicado = datosSicoreCalculo.minimoAplicado
    const baseAjustada = Math.max(0, netoAjustado - minimoAplicado)
    const nuevaRetencion = baseAjustada * tipoSeleccionado.porcentaje_retencion

    setMontoRetencion(nuevaRetencion)
    setDatosSicoreCalculo({ ...datosSicoreCalculo, netoFactura: netoAjustado, baseImponible: baseAjustada })
  }

  // Limpiar descuento y restaurar cálculo SICORE original
  const limpiarDescuentoSicore = () => {
    if (!facturaEnProceso || !tipoSeleccionado) return
    setDescuentoAdicional(0)
    setDescuentoDesglose(null)
    setDescuentoInputValor('')
    calcularRetencionSicore(facturaEnProceso, tipoSeleccionado)
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
    setDescuentoDesglose(null)
    setDescuentoInputValor('')
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
  // ── Guardar registros de cheque en msa.cheques ───────────────────────────
  const guardarCheques = async (
    facturasACambiar: FacturaArca[],
    datos: { banco: string; numero: string; fechaEmision: string; fechaCobro: string },
    sicore?: { monto: number; tipo: string; quincena: string } | null
  ) => {
    try {
      const registros = facturasACambiar.map(f => ({
        numero:              datos.numero || null,
        banco:               datos.banco,
        monto:               sicore
                               ? (f.imp_total || 0) - sicore.monto
                               : (f.monto_a_abonar ?? f.imp_total ?? 0),
        moneda:              'ARS',
        fecha_emision:       datos.fechaEmision,
        fecha_cobro:         datos.fechaCobro,
        beneficiario_nombre: f.denominacion_emisor || null,
        beneficiario_cuit:   f.cuit || null,
        factura_id:          f.id,
        sicore:              sicore?.quincena  ?? null,
        monto_sicore:        sicore?.monto     ?? null,
        tipo_sicore:         sicore?.tipo      ?? null,
        concepto:            `Pago ${f.denominacion_emisor}`,
      }))
      const { error } = await supabase.schema('msa').from('cheques').insert(registros)
      if (error) console.error('Error guardando cheque(s):', error)
    } catch (e) {
      console.error('Error guardarCheques:', e)
    }
  }

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
          monto_sicore: montoRetencion,
          tipo_sicore: tipoSeleccionado.tipo,
          descuento_aplicado: descuentoAdicional > 0 ? descuentoAdicional : null
        })
        .eq('id', facturaEnProceso.id)

      if (error) {
        throw new Error(error.message)
      }

      // ── Registrar en tabla nueva sicore_retenciones (paralelo, no interrumpe) ──
      const minimoAplicado = datosSicoreCalculo?.minimoAplicado ?? tipoSeleccionado.minimo_no_imponible
      const descPct = (facturaEnProceso.imp_total || 0) > 0
        ? descuentoAdicional / (facturaEnProceso.imp_total || 1)
        : 0
      const netoGravadoPagado = Math.round(((facturaEnProceso.imp_neto_gravado || 0) * (1 - descPct)) * 100) / 100
      const totalPagado = Math.round(((facturaEnProceso.imp_total || 0) - descuentoAdicional) * 100) / 100
      const baseImpNueva = Math.max(0, netoGravadoPagado - minimoAplicado)
      await registrarEnSicoreRetenciones({
        origen: procesandoColaSicore ? 'agrupacion' : 'directo',
        quincena,
        fecha_pago: facturaEnProceso.fecha_estimada || facturaEnProceso.fecha_vencimiento || new Date().toISOString().split('T')[0],
        factura_id: facturaEnProceso.id,
        fecha_emision: facturaEnProceso.fecha_emision,
        tipo_comprobante: facturaEnProceso.tipo_comprobante,
        punto_venta: facturaEnProceso.punto_venta,
        numero_desde: facturaEnProceso.numero_desde,
        cuit_emisor: facturaEnProceso.cuit,
        denominacion_emisor: facturaEnProceso.denominacion_emisor,
        tipo_sicore: tipoSeleccionado.tipo,
        alicuota: tipoSeleccionado.porcentaje_retencion,
        neto_gravado_pagado: netoGravadoPagado,
        total_pagado: totalPagado,
        descuento_aplicado: descuentoAdicional,
        minimo_no_imponible: minimoAplicado,
        base_imponible: baseImpNueva,
        retencion: montoRetencion,
        pago: saldoFinal,
      })

      // Actualizar estado local con datos SICORE
      const nuevasFacturas = facturas.map(f =>
        f.id === facturaEnProceso.id
          ? { ...f, monto_a_abonar: saldoFinal, sicore: quincena, monto_sicore: montoRetencion, descuento_aplicado: descuentoAdicional > 0 ? descuentoAdicional : null }
          : f
      )
      setFacturas(nuevasFacturas)

      const nuevasFacturasOriginales = facturasOriginales.map(f =>
        f.id === facturaEnProceso.id
          ? { ...f, monto_a_abonar: saldoFinal, sicore: quincena, monto_sicore: montoRetencion, descuento_aplicado: descuentoAdicional > 0 ? descuentoAdicional : null }
          : f
      )
      setFacturasOriginales(nuevasFacturasOriginales)
      
      // Si el pago fue por ECHEQ, registrar el cheque en msa.cheques
      if (echeqPendienteRef.current && facturaEnProceso) {
        await guardarCheques(
          [facturaEnProceso],
          echeqPendienteRef.current,
          { monto: montoRetencion, tipo: tipoSeleccionado.tipo, quincena }
        )
        echeqPendienteRef.current = null
        setEcheqPendiente(null)
      }

      // Cerrar modal y limpiar estados
      setMostrarModalSicore(false)
      setFacturaEnProceso(null)
      setTipoSeleccionado(null)
      setMontoRetencion(0)
      setDescuentoAdicional(0)
      setDescuentoDesglose(null)
      setDescuentoInputValor('')
      setPasoSicore('tipo')

      const descMsg = descuentoDesglose ? `\nDescuento: $${descuentoDesglose.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''
      alert(`✅ Retención SICORE aplicada exitosamente\n\nQuincena: ${quincena}${descMsg}\nRetención: $${montoRetencion.toLocaleString('es-AR')}\nSaldo a pagar: $${saldoFinal.toLocaleString('es-AR')}`)

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

  // ============= SICORE ANTICIPOS (Vista de Pagos) =============

  const recargarAnticiposPagos = async () => {
    const { data } = await supabase.from('anticipos_proveedores').select('*')
      .in('estado_pago', ['pendiente', 'pagar', 'preparado', 'programado'])
      .neq('estado', 'conciliado')
      .order('fecha_pago', { ascending: true })
    if (data) setAnticiposPagos(data)
  }

  // Eliminar un anticipo (y limpiar SICORE en factura vinculada si corresponde)
  const eliminarAnticipo = async (anticipo: any) => {
    const confirmar = window.confirm(
      `¿Eliminar anticipo de ${anticipo.nombre_proveedor} por $${(anticipo.monto || 0).toLocaleString('es-AR')}?\n\nSi tiene SICORE aplicado, también se limpiará de la factura vinculada.`
    )
    if (!confirmar) return
    try {
      // Si tiene factura vinculada, limpiar SICORE de esa factura
      if (anticipo.factura_id) {
        await supabase.schema('msa').from('comprobantes_arca')
          .update({ sicore: null, monto_sicore: null, tipo_sicore: null })
          .eq('id', anticipo.factura_id)
      }
      const { error } = await supabase.from('anticipos_proveedores').delete().eq('id', anticipo.id)
      if (error) throw error
      toast.success('Anticipo eliminado')
      await recargarAnticiposPagos()
    } catch (err) {
      toast.error('Error al eliminar: ' + (err as Error).message)
    }
  }

  // Cambiar estado de un anticipo en Vista de Pagos
  // — Si pasa a 'pagar' y YA tiene sicore: aplica retención automáticamente
  // — Si pasa a 'pagar' y NO tiene sicore: abre modal SICORE
  // — Cualquier otro estado: cambio directo
  const cambiarEstadoAnticipoPago = async (anticipo: any, nuevoEstado: string) => {
    if (nuevoEstado === 'pagar') {
      if (anticipo.sicore && anticipo.monto_sicore) {
        // SICORE ya fue procesado: solo actualizar estado + monto_restante
        const saldo = (anticipo.monto || 0) - (anticipo.monto_sicore || 0)
        const { error } = await supabase.from('anticipos_proveedores')
          .update({ estado_pago: 'pagar', monto_restante: saldo })
          .eq('id', anticipo.id)
        if (error) { toast.error('Error: ' + error.message); return }
        toast.success('Anticipo pasado a "Pagar". Retención SICORE ya aplicada.')
        await recargarAnticiposPagos()
      } else {
        // Sin SICORE aún: abrir modal (primer paso: ingresar montos)
        setAnticipoSicoreEnProceso(anticipo)
        setPasoSicoreAnt('montos')
        setNetoGravadoAnt('')
        setNetoNoGravadoAnt('')
        setExentoAnt('')
        setIvaAnt('')
        setTipoSicoreAnt(null)
        setMontoSicoreAnt(0)
        setDescuentoAnt(0)
        setDatosSicoreAnt(null)
        setMostrarModalSicoreAnt(true)
      }
    } else {
      const { error } = await supabase.from('anticipos_proveedores')
        .update({ estado_pago: nuevoEstado })
        .eq('id', anticipo.id)
      if (error) { toast.error('Error: ' + error.message); return }
      toast.success(`Anticipo → ${nuevoEstado}`)
      await recargarAnticiposPagos()
    }
  }

  // Calcular retención al seleccionar tipo SICORE para un anticipo (usa neto gravado ingresado)
  const calcularSicoreAnt = async (tipo: TipoSicore) => {
    if (!anticipoSicoreEnProceso) return
    const neto = parseFloat(netoGravadoAnt.replace(/\./g, '').replace(',', '.')) || 0
    const fecha = anticipoSicoreEnProceso.fecha_pago || new Date().toISOString()
    const quincena = generarQuincenaSicore(fecha)
    const cuit = anticipoSicoreEnProceso.cuit_proveedor

    // Verificar retención previa en ambas tablas
    const [{ data: d1 }, { data: d2 }] = await Promise.all([
      supabase.schema('msa').from('comprobantes_arca').select('id').eq('cuit', cuit).eq('sicore', quincena).limit(1),
      supabase.from('anticipos_proveedores').select('id').eq('cuit_proveedor', cuit).eq('sicore', quincena).neq('id', anticipoSicoreEnProceso.id).limit(1)
    ])
    const yaRetuvo = (d1 && d1.length > 0) || (d2 && d2.length > 0)

    let baseImponible = neto
    let minimoAplicado = 0

    if (!yaRetuvo) {
      if (neto <= tipo.minimo_no_imponible) {
        alert(`El neto gravado $${neto.toLocaleString('es-AR')} no supera el mínimo no imponible ($${tipo.minimo_no_imponible.toLocaleString('es-AR')}).`)
        return
      }
      baseImponible = neto - tipo.minimo_no_imponible
      minimoAplicado = tipo.minimo_no_imponible
    }

    setTipoSicoreAnt(tipo)
    setDatosSicoreAnt({ baseImponible, minimoAplicado, esAdicional: yaRetuvo })
    setMontoSicoreAnt(baseImponible * tipo.porcentaje_retencion)
    setDescuentoAnt(0)
    setPasoSicoreAnt('calculo')
  }

  // Confirmar SICORE para anticipo
  const confirmarSicoreAnt = async () => {
    console.log('[SICORE ANT] confirmar - anticipoSicoreEnProceso:', anticipoSicoreEnProceso?.id, 'tipoSicoreAnt:', tipoSicoreAnt?.tipo)
    if (!anticipoSicoreEnProceso || !tipoSicoreAnt) {
      toast.error('Error: estado interno incompleto (tipoSicoreAnt o anticipo nulo)')
      return
    }
    const quincena = generarQuincenaSicore(anticipoSicoreEnProceso.fecha_pago || new Date().toISOString())
    const neto = parseFloat(netoGravadoAnt.replace(/\./g, '').replace(',', '.')) || 0
    const saldoFinal = Math.round(((anticipoSicoreEnProceso.monto || 0) - montoSicoreAnt - descuentoAnt) * 100) / 100

    console.log('[SICORE ANT] update:', { quincena, montoSicoreAnt, saldoFinal, id: anticipoSicoreEnProceso.id })

    const { error } = await supabase.from('anticipos_proveedores').update({
      estado_pago: 'pagar',
      sicore: quincena,
      monto_sicore: Math.round(montoSicoreAnt * 100) / 100,
      tipo_sicore: tipoSicoreAnt.tipo,
      monto_restante: saldoFinal,
      neto_gravado: neto,
    }).eq('id', anticipoSicoreEnProceso.id)

    if (error) {
      console.error('[SICORE ANT] DB error:', error)
      toast.error('Error BD: ' + error.message + ' | code: ' + error.code)
      return
    }

    // ── Registrar en tabla nueva sicore_retenciones (paralelo, no interrumpe) ──
    const totalPagadoAnt = Math.round(((anticipoSicoreEnProceso.monto || 0) - descuentoAnt) * 100) / 100
    const baseImpAnt = Math.max(0, neto - (tipoSicoreAnt.minimo_no_imponible || 0))
    await registrarEnSicoreRetenciones({
      origen: 'anticipo',
      quincena,
      fecha_pago: anticipoSicoreEnProceso.fecha_pago || new Date().toISOString().split('T')[0],
      anticipo_id: anticipoSicoreEnProceso.id,
      factura_id: anticipoSicoreEnProceso.factura_id || null,
      cuit_emisor: anticipoSicoreEnProceso.cuit_proveedor,
      denominacion_emisor: anticipoSicoreEnProceso.nombre_proveedor,
      tipo_sicore: tipoSicoreAnt.tipo,
      alicuota: tipoSicoreAnt.porcentaje_retencion,
      neto_gravado_pagado: neto,
      total_pagado: totalPagadoAnt,
      descuento_aplicado: descuentoAnt,
      minimo_no_imponible: tipoSicoreAnt.minimo_no_imponible,
      base_imponible: baseImpAnt,
      retencion: Math.round(montoSicoreAnt * 100) / 100,
      pago: saldoFinal,
    })

    // Cerrar modal primero, luego recargar lista
    setMostrarModalSicoreAnt(false)
    setAnticipoSicoreEnProceso(null)
    setTipoSicoreAnt(null)
    setDatosSicoreAnt(null)
    toast.success(`SICORE aplicado. Quincena: ${quincena} | Retención: $${Math.round(montoSicoreAnt * 100) / 100} | Saldo: $${saldoFinal.toLocaleString('es-AR')}`)
    recargarAnticiposPagos()
  }

  // ============= FUNCIONES CIERRE QUINCENA SICORE =============

  // Generar lista de quincenas disponibles (últimos 6 meses)
  const generarQuincenasDisponibles = () => {
    const quincenas = []
    const ahora = new Date()

    // Iterar quincenas reales hacia atrás (evita saltear quincenas en meses cortos)
    let año = ahora.getFullYear()
    let mes = ahora.getMonth() // 0-based
    let mitad = ahora.getDate() <= 15 ? '1ra' : '2da'

    for (let i = 0; i < 12; i++) {
      const añoStr = año.toString().slice(-2)
      const mesStr = (mes + 1).toString().padStart(2, '0')
      quincenas.push(`${añoStr}-${mesStr} - ${mitad}`)

      // Retroceder una quincena
      if (mitad === '2da') {
        mitad = '1ra'
      } else {
        mitad = '2da'
        mes--
        if (mes < 0) {
          mes = 11
          año--
        }
      }
    }

    return quincenas // Ya vienen en orden descendente (más reciente primero)
  }

  // Buscar todas las retenciones SICORE de una quincena
  const buscarRetencionesQuincena = async (quincena: string) => {
    try {
      console.log('🔍 SICORE: Buscando retenciones para quincena', quincena)

      // Traer todos los campos necesarios para el export completo
      const [{ data, error }, { data: tiposData }] = await Promise.all([
        supabase.schema('msa').from('comprobantes_arca').select('*')
          .eq('sicore', quincena)
          .not('monto_sicore', 'is', null)
          .gt('monto_sicore', 0)
          .order('fecha_estimada', { ascending: true }),
        supabase.from('tipos_sicore_config').select('tipo, minimo_no_imponible, porcentaje_retencion')
      ])

      if (error) throw new Error(error.message)

      // Enriquecer facturas con datos del tipo SICORE
      const tiposMap = Object.fromEntries((tiposData || []).map(t => [t.tipo, t]))
      const facturasEnriquecidas = (data || []).map(f => ({
        ...f,
        _tipoConfig: tiposMap[f.tipo_sicore] || null
      }))

      const totalRetenciones = facturasEnriquecidas.reduce((sum, f) => sum + (f.monto_sicore || 0), 0)

      return {
        facturas: facturasEnriquecidas,
        totalRetenciones,
        cantidad: facturasEnriquecidas.length
      }

    } catch (error) {
      console.error('Error buscando retenciones quincena:', error)
      throw error
    }
  }

  // Cargar retenciones para vista "Ver Retenciones"
  const cargarRetencionesVer = async (quincena: string) => {
    if (!quincena) { setRetencionesVer([]); return }
    setCargandoRetencionesVer(true)
    try {
      const [{ data: facturas }, { data: anticipos }] = await Promise.all([
        supabase
          .schema('msa')
          .from('comprobantes_arca')
          .select('id, denominacion_emisor, cuit, monto_sicore, imp_total, imp_neto_gravado, fecha_vencimiento, estado')
          .eq('sicore', quincena)
          .not('monto_sicore', 'is', null)
          .gt('monto_sicore', 0)
          .order('fecha_vencimiento', { ascending: true }),
        supabase
          .from('anticipos_proveedores')
          .select('id, nombre_proveedor, cuit_proveedor, monto_sicore, monto, fecha_pago, estado')
          .eq('sicore', quincena)
          .not('monto_sicore', 'is', null)
          .gt('monto_sicore', 0)
          .order('fecha_pago', { ascending: true })
      ])
      const merged = [
        ...(facturas || []).map(f => ({ ...f, _tipo: 'factura' as const })),
        ...(anticipos || []).map(a => ({
          id: a.id,
          denominacion_emisor: a.nombre_proveedor,
          cuit: a.cuit_proveedor,
          monto_sicore: a.monto_sicore,
          imp_total: a.monto,
          imp_neto_gravado: null,
          fecha_vencimiento: a.fecha_pago,
          estado: a.estado,
          _tipo: 'anticipo' as const
        }))
      ]
      merged.sort((a, b) => (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''))
      setRetencionesVer(merged)
    } catch (e) {
      console.error('Error cargando retenciones SICORE:', e)
    } finally {
      setCargandoRetencionesVer(false)
    }
  }

  // Procesar cierre completo de quincena
  const procesarCierreQuincena = async (quincena: string) => {
    try {
      setProcesandoCierre(true)

      // VALIDACIÓN: anticipos con SICORE sin vincular en esta quincena
      const { data: anticiposSinVincular } = await supabase
        .from('anticipos_proveedores')
        .select('id, nombre_proveedor, monto_sicore')
        .eq('sicore', quincena)
        .is('factura_id', null)

      if (anticiposSinVincular && anticiposSinVincular.length > 0) {
        const lista = anticiposSinVincular
          .map(a => `• ${a.nombre_proveedor} — $${(a.monto_sicore || 0).toLocaleString('es-AR')}`)
          .join('\n')
        alert(`⚠️ No se puede cerrar la quincena ${quincena}.\n\nExisten ${anticiposSinVincular.length} anticipo(s) con retención SICORE pendiente de vincular a una factura:\n\n${lista}\n\nVinculá los anticipos desde la Vista Principal antes de cerrar la quincena.`)
        return
      }

      // VALIDACIÓN: facturas con SICORE asignado pero aún en estado 'pendiente'
      const { data: facturasPendientes } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('id, denominacion_emisor, imp_total')
        .eq('sicore', quincena)
        .eq('estado', 'pendiente')

      if (facturasPendientes && facturasPendientes.length > 0) {
        const lista = facturasPendientes
          .map(f => `• ${f.denominacion_emisor} — $${(f.imp_total || 0).toLocaleString('es-AR')}`)
          .join('\n')
        alert(`⚠️ No se puede cerrar la quincena ${quincena}.\n\nExisten ${facturasPendientes.length} factura(s) con SICORE asignado pero en estado "pendiente" (sin pagar):\n\n${lista}\n\nCambiá el estado de estas facturas a "pagar" o "pagado" antes de cerrar la quincena.`)
        return
      }

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
      // 1. Obtener carpeta base (pedir si no hay handle real)
      let carpetaBase = carpetaPorDefecto
      if (!carpetaBase || carpetaBase.isFromStorage) {
        carpetaBase = await (window as any).showDirectoryPicker({ startIn: 'downloads' })
        setCarpetaPorDefecto(carpetaBase)
      } else {
        await carpetaBase.requestPermission({ mode: 'readwrite' })
      }

      // 2. Crear subcarpeta con nombre de quincena: '26-02-01' o '26-02-02'
      const nombreCarpeta = quincenaACarpeta(quincena)
      const subcarpeta = await carpetaBase.getDirectoryHandle(nombreCarpeta, { create: true })

      // 3. Generar ambos archivos dentro de la subcarpeta
      await generarExcelCierreQuincena(facturas, quincena, totalRetenciones, subcarpeta)
      await generarPDFCierreQuincena(facturas, quincena, totalRetenciones, subcarpeta)

      console.log(`✅ Reportes SICORE guardados en ${carpetaBase.name}/${nombreCarpeta}`)

    } catch (error) {
      console.error('Error generando reportes cierre quincena:', error)
      throw error
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  CIERRE QUINCENA V2 — lee de msa.sicore_retenciones
  // ══════════════════════════════════════════════════════════════

  const buscarRetencionesV2 = async (quincena: string) => {
    const { data, error } = await supabase
      .schema('msa')
      .from('sicore_retenciones')
      .select('*')
      .eq('quincena', quincena)
      .order('denominacion_emisor', { ascending: true })
    if (error) throw error
    return data || []
  }

  const generarExcelCierreV2 = async (registros: any[], quincena: string, directorio: any = null) => {
    const XLSX = await import('xlsx')
    const mesesNombre = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const partes = quincena.match(/(\d+)-(\d+)\s*-\s*(1ra|2da)/)
    const tituloQ = partes ? `SICORE ${mesesNombre[parseInt(partes[2])-1]} 20${partes[1]} ${partes[3]} Quincena — v2` : `SICORE ${quincena} v2`

    const fmt = (f: string | null) => {
      if (!f) return '-'
      const d = new Date(f + 'T12:00:00')
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
    }
    const num = (v: any) => (v === null || v === undefined || v === '') ? '' : Number(v)

    const COLS = [
      'Origen','Tipo','Fecha Pago','Fecha FC','Tipo Comp.','PV','Número','CUIT Emisor','Denominación Emisor',
      'Neto Grav. Pagado','Total Pagado','Descuento','Mínimo no imp','Base imp','Alícuota','Retención','Pago'
    ]

    const filas = registros.map(r => ({
      'Origen':              r.origen || '',
      'Tipo':                r.tipo_sicore || '',
      'Fecha Pago':          fmt(r.fecha_pago),
      'Fecha FC':            fmt(r.fecha_emision),
      'Tipo Comp.':          r.tipo_comprobante ?? '',
      'PV':                  num(r.punto_venta),
      'Número':              num(r.numero_desde),
      'CUIT Emisor':         r.cuit_emisor || '',
      'Denominación Emisor': r.denominacion_emisor || '',
      'Neto Grav. Pagado':   num(r.neto_gravado_pagado),
      'Total Pagado':        num(r.total_pagado),
      'Descuento':           num(r.descuento_aplicado),
      'Mínimo no imp':       num(r.minimo_no_imponible),
      'Base imp':            num(r.base_imponible),
      'Alícuota':            r.alicuota ? Number(r.alicuota) : '',
      'Retención':           num(r.retencion),
      'Pago':                num(r.pago),
    }))

    // Totales
    const tot: any = {}; COLS.forEach(c => { tot[c] = '' })
    tot['Denominación Emisor'] = 'TOTALES'
    tot['Neto Grav. Pagado']   = registros.reduce((s, r) => s + (Number(r.neto_gravado_pagado) || 0), 0)
    tot['Total Pagado']        = registros.reduce((s, r) => s + (Number(r.total_pagado) || 0), 0)
    tot['Descuento']           = registros.reduce((s, r) => s + (Number(r.descuento_aplicado) || 0), 0)
    tot['Retención']           = registros.reduce((s, r) => s + (Number(r.retencion) || 0), 0)
    tot['Pago']                = registros.reduce((s, r) => s + (Number(r.pago) || 0), 0)
    filas.push(tot)

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([[tituloQ], []])
    XLSX.utils.sheet_add_json(ws, filas, { origin: 'A3', header: COLS })
    ws['!cols'] = [
      {wch:10},{wch:14},{wch:12},{wch:12},{wch:8},{wch:6},{wch:10},{wch:16},{wch:28},
      {wch:16},{wch:16},{wch:12},{wch:14},{wch:14},{wch:8},{wch:14},{wch:14}
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'SICORE v2')
    const nombre = `SICORE_v2_${quincenaACarpeta(quincena)}.xlsx`
    if (directorio) {
      const h = await directorio.getFileHandle(nombre, { create: true })
      const w = await h.createWritable()
      await w.write(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
      await w.close()
    } else {
      XLSX.writeFile(wb, nombre)
    }
  }

  const generarPDFCierreV2 = async (registros: any[], quincena: string, directorio: any = null) => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape' })
    const mesesNombre = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const partes = quincena.match(/(\d+)-(\d+)\s*-\s*(1ra|2da)/)
    const tituloQ = partes ? `SICORE ${mesesNombre[parseInt(partes[2])-1]} 20${partes[1]} ${partes[3]} Quincena — v2` : `SICORE ${quincena} v2`

    const fmt = (f: string | null) => {
      if (!f) return '-'
      const d = new Date(f + 'T12:00:00')
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
    }
    const fNum = (v: any) => {
      if (v === null || v === undefined || v === '') return ''
      const n = Number(v)
      return n === 0 ? '' : n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const totalRetencion = registros.reduce((s, r) => s + (Number(r.retencion) || 0), 0)
    doc.setFontSize(13); doc.text(tituloQ, 10, 14)
    doc.setFontSize(8); doc.text(
      `Fecha: ${new Date().toLocaleDateString('es-AR')}   |   Registros: ${registros.length}   |   Total retenciones: $${totalRetencion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      10, 21
    )

    const cabeceras = ['Origen','Tipo','F.Pago','F.FC','Comp','PV','Nro','CUIT','Denominación','Neto Grav\nPagado','Total\nPagado','Desc.','Mínimo','Base imp','%','Retención','Pago']

    const body = registros.map(r => [
      r.origen || '',
      r.tipo_sicore || '',
      fmt(r.fecha_pago),
      fmt(r.fecha_emision),
      r.tipo_comprobante ?? '',
      r.punto_venta || '',
      r.numero_desde || '',
      r.cuit_emisor || '',
      r.denominacion_emisor || '',
      fNum(r.neto_gravado_pagado),
      fNum(r.total_pagado),
      fNum(r.descuento_aplicado),
      fNum(r.minimo_no_imponible),
      fNum(r.base_imponible),
      r.alicuota ? `${(Number(r.alicuota)*100).toFixed(2)}%` : '',
      fNum(r.retencion),
      fNum(r.pago),
    ])

    body.push([
      '','','','','','','','TOTALES','',
      fNum(registros.reduce((s,r)=>s+(Number(r.neto_gravado_pagado)||0),0)),
      fNum(registros.reduce((s,r)=>s+(Number(r.total_pagado)||0),0)),
      fNum(registros.reduce((s,r)=>s+(Number(r.descuento_aplicado)||0),0)),
      '','','',
      fNum(totalRetencion),
      fNum(registros.reduce((s,r)=>s+(Number(r.pago)||0),0)),
    ])

    // 17 columnas. Landscape = 277mm usables
    autoTable(doc, {
      head: [cabeceras], body,
      startY: 26,
      margin: { left: 10, right: 10 },
      styles: { fontSize: 5.5, cellPadding: 1.5, halign: 'right', overflow: 'ellipsize' },
      headStyles: { fillColor: [39, 174, 96], textColor: 255, fontStyle: 'bold', fontSize: 5.5, halign: 'center', valign: 'middle', minCellHeight: 12 },
      columnStyles: {
        0:  { cellWidth: 13, halign: 'left'  },  // Origen
        1:  { cellWidth: 16, halign: 'left'  },  // Tipo
        2:  { cellWidth: 16 },                    // F.Pago
        3:  { cellWidth: 16 },                    // F.FC
        4:  { cellWidth:  7 },                    // Comp
        5:  { cellWidth:  6 },                    // PV
        6:  { cellWidth: 10 },                    // Nro
        7:  { cellWidth: 16 },                    // CUIT
        8:  { cellWidth: 24, halign: 'left'  },   // Denominación
        9:  { cellWidth: 17 },                    // Neto Grav Pagado
        10: { cellWidth: 17 },                    // Total Pagado
        11: { cellWidth: 12 },                    // Descuento
        12: { cellWidth: 14 },                    // Mínimo
        13: { cellWidth: 17 },                    // Base imp
        14: { cellWidth:  7 },                    // %
        15: { cellWidth: 14 },                    // Retención
        16: { cellWidth: 17 },                    // Pago (12ch)
      },                                          // Total: 13+16+16+16+7+6+10+16+24+17+17+12+14+17+7+14+17 = 237... need to recheck
      didParseCell: (data: any) => {
        if (data.row.index === body.length - 1 && data.section === 'body') {
          data.cell.styles.fillColor = [230, 230, 230]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    const nombre = `SICORE_v2_${quincenaACarpeta(quincena)}.pdf`
    if (directorio) {
      const h = await directorio.getFileHandle(nombre, { create: true })
      const w = await h.createWritable()
      await w.write(doc.output('blob'))
      await w.close()
    } else {
      doc.save(nombre)
    }
  }

  const procesarCierreV2 = async (quincena: string) => {
    try {
      setProcesandoCierreV2(true)
      const registros = await buscarRetencionesV2(quincena)
      if (registros.length === 0) {
        alert(`No hay registros en sicore_retenciones para la quincena ${quincena}`)
        return
      }
      // Usar carpeta configurada (misma lógica que v1)
      const carpetaGuardada = localStorage.getItem('sicore_carpeta_default')
      let subcarpeta = null
      if (carpetaGuardada) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({ id: 'sicore', mode: 'readwrite', startIn: 'documents' }).catch(() => null)
          if (dirHandle) subcarpeta = dirHandle
        } catch { /* sin carpeta, descarga directa */ }
      }
      await generarExcelCierreV2(registros, quincena, subcarpeta)
      await generarPDFCierreV2(registros, quincena, subcarpeta)
      const totalRet = registros.reduce((s: number, r: any) => s + (Number(r.retencion) || 0), 0)
      const totalPago = registros.reduce((s: number, r: any) => s + (Number(r.pago) || 0), 0)
      alert(`✅ Cierre v2 generado — quincena ${quincena}\n\n• ${registros.length} registros\n• Total retenciones: $${totalRet.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n• Total pagos netos: $${totalPago.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
    } catch (error) {
      console.error('Error cierre v2:', error)
      alert('Error: ' + (error as Error).message)
    } finally {
      setProcesandoCierreV2(false)
    }
  }

  // Previsualizar conteo v2 al seleccionar quincena
  const previsualizarV2 = async (quincena: string) => {
    setQuincenaSeleccionadaV2(quincena)
    setConteoV2(null)
    setRegistrosV2([])
    if (!quincena) return
    setCargandoV2(true)
    try {
      const { data } = await supabase.schema('msa').from('sicore_retenciones')
        .select('*')
        .eq('quincena', quincena)
        .order('fecha_pago', { ascending: true })
      if (data) {
        setRegistrosV2(data)
        setConteoV2({
          cantidad: data.length,
          totalRetencion: data.reduce((s: number, r: any) => s + (Number(r.retencion) || 0), 0),
          totalPago: data.reduce((s: number, r: any) => s + (Number(r.pago) || 0), 0),
        })
      }
    } finally {
      setCargandoV2(false)
    }
  }

  // Auto-cargar al abrir tab v2 o al abrir el modal con tab v2 activo
  useEffect(() => {
    if (tabPanelSicore === 'v2' && quincenaSeleccionadaV2 && registrosV2.length === 0 && !cargandoV2) {
      previsualizarV2(quincenaSeleccionadaV2)
    }
  }, [tabPanelSicore, mostrarModalPanelSicore]) // eslint-disable-line react-hooks/exhaustive-deps

  // Generar Excel para cierre de quincena
  const generarExcelCierreQuincena = async (facturas: any[], quincena: string, totalRetenciones: number, directorio: any = null) => {
    try {
      console.log('📊 Generando Excel cierre quincena SICORE')
      const XLSX = await import('xlsx')

      // Formatear quincena como título: "26-01 - 2da" → "Enero 2026 2da Quincena"
      const mesesNombre = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
      const partes = quincena.match(/(\d+)-(\d+)\s*-\s*(1ra|2da)/)
      const tituloQuincena = partes
        ? `SICORE ${mesesNombre[parseInt(partes[2]) - 1]} 20${partes[1]} ${partes[3]} Quincena`
        : `SICORE ${quincena}`

      const formatFecha = (f: string | null) => {
        if (!f) return '-'
        const d = new Date(f + 'T12:00:00')
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
      }
      const num = (v: any) => (v === null || v === undefined || v === '') ? '' : Number(v)

      // Columnas del Excel según screenshot
      const COLS = [
        'Tipo','Fecha Pago','Fecha FC','Tipo Comp.','Punto de Venta',
        'Número Desde','Nro. Doc. Emisor','Denominación Emisor',
        'Imp. Neto Gravado','Imp. Neto No Gravado','Imp. Op. Exentas',
        'Otros Tributos','IVA','Imp. Total',
        'Mínimo no imp','Base imp','% de Retención','Retención','Descuento','PAGO'
      ]

      const filas = facturas.map(f => {
        const tipoConfig = f._tipoConfig
        const minimo = tipoConfig?.minimo_no_imponible ?? 0
        // Derivar base imponible a partir del resultado almacenado (correcto para retenciones
        // adicionales y con descuento, ya que el código de cálculo ya conocía el contexto real)
        const baseImp = tipoConfig && tipoConfig.porcentaje_retencion > 0
          ? (f.monto_sicore || 0) / tipoConfig.porcentaje_retencion
          : 0
        const pct = tipoConfig ? tipoConfig.porcentaje_retencion * 100 : 0

        return {
          'Tipo': f.tipo_sicore || '',
          'Fecha Pago': formatFecha(f.fecha_estimada || f.fecha_vencimiento),
          'Fecha FC': formatFecha(f.fecha_emision),
          'Tipo Comp.': f.tipo_comprobante ? `${f.tipo_comprobante} - Factura` : '',
          'Punto de Venta': num(f.punto_venta),
          'Número Desde': num(f.numero_desde),
          'Nro. Doc. Emisor': f.cuit || '',
          'Denominación Emisor': f.denominacion_emisor || '',
          'Imp. Neto Gravado': num(f.imp_neto_gravado),
          'Imp. Neto No Gravado': num(f.imp_neto_no_gravado),
          'Imp. Op. Exentas': num(f.imp_op_exentas),
          'Otros Tributos': num(f.otros_tributos),
          'IVA': num(f.iva),
          'Imp. Total': num(f.imp_total),
          'Mínimo no imp': num(minimo),
          'Base imp': num(baseImp),
          '% de Retención': pct ? pct / 100 : '',  // como decimal para formato %
          'Retención': num(f.monto_sicore),
          'Descuento': num(f.descuento_aplicado),
          'PAGO': num(f.monto_a_abonar)
        }
      })

      // Fila de totales
      const totales: any = {}
      COLS.forEach(c => { totales[c] = '' })
      totales['Denominación Emisor'] = 'TOTALES'
      totales['Imp. Neto Gravado'] = facturas.reduce((s, f) => s + (f.imp_neto_gravado || 0), 0)
      totales['Imp. Neto No Gravado'] = facturas.reduce((s, f) => s + (f.imp_neto_no_gravado || 0), 0)
      totales['Imp. Op. Exentas'] = facturas.reduce((s, f) => s + (f.imp_op_exentas || 0), 0)
      totales['Otros Tributos'] = facturas.reduce((s, f) => s + (f.otros_tributos || 0), 0)
      totales['IVA'] = facturas.reduce((s, f) => s + (f.iva || 0), 0)
      totales['Imp. Total'] = facturas.reduce((s, f) => s + (f.imp_total || 0), 0)
      totales['Retención'] = totalRetenciones
      totales['Descuento'] = facturas.reduce((s, f) => s + (f.descuento_aplicado || 0), 0)
      totales['PAGO'] = facturas.reduce((s, f) => s + (f.monto_a_abonar || 0), 0)
      filas.push(totales)

      const wb = XLSX.utils.book_new()

      // Hoja con título en A1, fila vacía, luego headers y datos
      const ws = XLSX.utils.aoa_to_sheet([[tituloQuincena], []])
      XLSX.utils.sheet_add_json(ws, filas, { origin: 'A3', header: COLS })

      // Anchos de columna
      ws['!cols'] = [
        { wch: 12 }, // Tipo
        { wch: 12 }, // Fecha Pago
        { wch: 12 }, // Fecha FC
        { wch: 14 }, // Tipo Comp
        { wch: 8  }, // PV
        { wch: 10 }, // Nro
        { wch: 16 }, // CUIT
        { wch: 28 }, // Denominación
        { wch: 16 }, // Neto Grav
        { wch: 16 }, // Neto No Grav
        { wch: 16 }, // Op Exentas
        { wch: 14 }, // Otros Trib
        { wch: 14 }, // IVA
        { wch: 14 }, // Imp Total
        { wch: 12 }, // Mínimo
        { wch: 14 }, // Base imp
        { wch: 8  }, // %
        { wch: 14 }, // Retención
        { wch: 14 }, // Descuento
        { wch: 14 }, // PAGO
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'SICORE')
      const nombreArchivo = `SICORE_${quincenaACarpeta(quincena)}.xlsx`

      if (directorio) {
        const archivoHandle = await directorio.getFileHandle(nombreArchivo, { create: true })
        const writableStream = await archivoHandle.createWritable()
        const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
        await writableStream.write(buffer)
        await writableStream.close()
      } else {
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

      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'landscape' })

      // Formatear quincena como título
      const mesesNombre = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
      const partes = quincena.match(/(\d+)-(\d+)\s*-\s*(1ra|2da)/)
      const tituloQuincena = partes
        ? `SICORE ${mesesNombre[parseInt(partes[2]) - 1]} 20${partes[1]} ${partes[3]} Quincena`
        : `SICORE ${quincena}`

      const formatFecha = (f: string | null) => {
        if (!f) return '-'
        const d = new Date(f + 'T12:00:00')
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
      }
      const formatNum = (v: any) => {
        if (v === null || v === undefined || v === '') return ''
        const n = Number(v)
        return n === 0 ? '' : n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }

      // Header (mismo margen 10mm que la tabla)
      doc.setFontSize(13)
      doc.text(tituloQuincena, 10, 14)
      doc.setFontSize(8)
      doc.text(
        `Fecha generación: ${new Date().toLocaleDateString('es-AR')}   |   Total facturas: ${facturas.length}   |   Total retenciones: $${totalRetenciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        10, 21
      )

      // Cabeceras (con saltos de línea para ajustar al espacio)
      const columnas = [
        'Tipo','Fecha\nPago','Fecha FC','Tipo\nComp.','PV',
        'Nro\nDesde','Nro. Doc.\nEmisor','Denominación Emisor',
        'Neto\nGravado','Neto No\nGravado','Op.\nExentas',
        'Otros\nTrib.','IVA','Imp.\nTotal',
        'Mínimo\nno imp','Base\nimp','%\nRet.','Retención','Descuento','PAGO'
      ]

      const filasDatos = facturas.map(f => {
        const tipoConfig = f._tipoConfig
        const minimo = tipoConfig?.minimo_no_imponible ?? 0
        // Derivar base imponible a partir del resultado almacenado
        const baseImp = tipoConfig && tipoConfig.porcentaje_retencion > 0
          ? (f.monto_sicore || 0) / tipoConfig.porcentaje_retencion
          : 0
        const pct = tipoConfig ? tipoConfig.porcentaje_retencion * 100 : 0

        return [
          f.tipo_sicore || '',
          formatFecha(f.fecha_estimada || f.fecha_vencimiento),
          formatFecha(f.fecha_emision),
          f.tipo_comprobante ? String(f.tipo_comprobante) : '',
          f.punto_venta || '',
          f.numero_desde || '',
          f.cuit || '',
          f.denominacion_emisor || '',
          formatNum(f.imp_neto_gravado),
          formatNum(f.imp_neto_no_gravado),
          formatNum(f.imp_op_exentas),
          formatNum(f.otros_tributos),
          formatNum(f.iva),
          formatNum(f.imp_total),
          formatNum(minimo),
          formatNum(baseImp),
          pct ? `${pct}%` : '',
          formatNum(f.monto_sicore),
          formatNum(f.descuento_aplicado),
          formatNum(f.monto_a_abonar),
        ]
      })

      // Fila de totales
      const filaTotales = [
        '', '', '', '', '', '', '',
        'TOTALES',
        formatNum(facturas.reduce((s, f) => s + (f.imp_neto_gravado || 0), 0)),
        formatNum(facturas.reduce((s, f) => s + (f.imp_neto_no_gravado || 0), 0)),
        formatNum(facturas.reduce((s, f) => s + (f.imp_op_exentas || 0), 0)),
        formatNum(facturas.reduce((s, f) => s + (f.otros_tributos || 0), 0)),
        formatNum(facturas.reduce((s, f) => s + (f.iva || 0), 0)),
        formatNum(facturas.reduce((s, f) => s + (f.imp_total || 0), 0)),
        '', '',
        '',
        formatNum(totalRetenciones),
        formatNum(facturas.reduce((s, f) => s + (f.descuento_aplicado || 0), 0)),
        formatNum(facturas.reduce((s, f) => s + (f.monto_a_abonar || 0), 0)),
      ]
      const filas = [...filasDatos, filaTotales]

      // Página landscape = 297mm. Con margin 10 c/lado → 277mm usables.
      // Suma exacta de cellWidths = 277mm para que todo entre en una sola línea.
      autoTable(doc, {
        head: [columnas],
        body: filas,
        startY: 26,
        margin: { left: 10, right: 10 },
        styles: {
          fontSize: 5.5,
          cellPadding: 1.5,
          halign: 'right',
          overflow: 'ellipsize',    // corta con "…" en vez de wrapear
          cellWidth: 'wrap',
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 5.5,
          halign: 'center',
          valign: 'middle',
          minCellHeight: 12,
        },
        columnStyles: {
          0:  { cellWidth: 17, halign: 'left'  },  // Tipo (Arrendamiento=13ch)
          1:  { cellWidth: 16 },                    // Fecha Pago (dd/mm/aaaa=10ch)
          2:  { cellWidth: 16 },                    // Fecha FC
          3:  { cellWidth: 7  },                    // Tipo Comp
          4:  { cellWidth: 7  },                    // PV
          5:  { cellWidth: 10 },                    // Nro Desde
          6:  { cellWidth: 16 },                    // CUIT (11ch)
          7:  { cellWidth: 22, halign: 'left'  },   // Denominación (ellipsize)
          8:  { cellWidth: 17 },                    // Neto Grav (12ch)
          9:  { cellWidth: 14 },                    // Neto No Grav
          10: { cellWidth: 10 },                    // Op Exentas
          11: { cellWidth: 10 },                    // Otros Trib
          12: { cellWidth: 16 },                    // IVA
          13: { cellWidth: 17 },                    // Imp Total (12ch)
          14: { cellWidth: 14 },                    // Mínimo no imp
          15: { cellWidth: 17 },                    // Base imp (12ch)
          16: { cellWidth: 7  },                    // % Ret
          17: { cellWidth: 14 },                    // Retención
          18: { cellWidth: 12 },                    // Descuento
          19: { cellWidth: 17 },                    // PAGO (12ch)
        },                                          // Total: 276mm ✓
        didParseCell: function(data: any) {
          if (data.row.index === filas.length - 1 && data.section === 'body') {
            data.cell.styles.fillColor = [230, 230, 230]
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      const nombreArchivo = `SICORE_${quincenaACarpeta(quincena)}.pdf`

      if (directorio) {
        const archivoHandle = await directorio.getFileHandle(nombreArchivo, { create: true })
        const writableStream = await archivoHandle.createWritable()
        const pdfBlob = doc.output('blob')
        await writableStream.write(pdfBlob)
        await writableStream.close()
        console.log('📄 PDF guardado en:', nombreArchivo)
      } else {
        doc.save(nombreArchivo)
      }

    } catch (error) {
      console.error('Error generando PDF cierre quincena:', error)
      throw error
    }
  }

  // Generar PDF detalle de pago (grupos ARCA o Templates)
  const generarPDFDetallePago = async (
    tipo: 'arca' | 'template',
    proveedor: string,
    cuit: string,
    items: Array<{
      comprobante: string
      fecha: string
      imp_total: number
      monto_sicore?: number | null
      descuento_aplicado?: number | null
      monto_a_abonar: number
    }>,
    anticipo?: {
      monto: number
      monto_sicore: number | null
      descuento_aplicado: number | null
      tipo_sicore: string | null
      sicore: string | null
      fecha_pago: string
    } | null
  ) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
      const fmtFechaStr = (f: string) => {
        const d = new Date(f + 'T12:00:00')
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
      }

      // Fecha de pago: del anticipo si existe, si no fecha actual
      const fechaPago = anticipo ? fmtFechaStr(anticipo.fecha_pago) : new Date().toLocaleDateString('es-AR')

      // ── Header ────────────────────────────────────────────────────────────
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('COMPROBANTE DE PAGO', pageW / 2, 18, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('MARTINEZ SOBRADO AGRO SRL — CUIT 30-61778601-6', pageW / 2, 25, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.text(`Fecha de Pago: ${fechaPago}`, pageW / 2, 31, { align: 'center' })

      // ── Datos proveedor ────────────────────────────────────────────────────
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Beneficiario:', 15, 42)
      doc.setFont('helvetica', 'normal')
      doc.text(proveedor, 45, 42)
      doc.setFont('helvetica', 'bold')
      doc.text('CUIT:', 15, 48)
      doc.setFont('helvetica', 'normal')
      doc.text(cuit, 30, 48)

      // ── Construir columnas y filas ─────────────────────────────────────────
      // Si hay anticipo, las columnas de retención/descuento vienen del anticipo
      const hayRetencion = anticipo
        ? (anticipo.monto_sicore || 0) > 0
        : items.some(i => (i.monto_sicore || 0) > 0)
      const hayDescuento = anticipo
        ? (anticipo.descuento_aplicado || 0) > 0
        : items.some(i => (i.descuento_aplicado || 0) > 0)

      const head: string[][] = [[
        'Comprobante',
        'Fecha',
        'Total Factura',
        ...(hayRetencion ? ['Retención Ganancias'] : []),
        ...(hayDescuento ? ['Descuento'] : []),
        'Monto Transferido',
        'Total Cancelado',
      ]]

      let body: string[][]
      if (anticipo) {
        const montoTransferido = anticipo.monto - (anticipo.monto_sicore || 0) - (anticipo.descuento_aplicado || 0)
        const totalCancelado = montoTransferido + (anticipo.monto_sicore || 0)
        body = items.map(i => [
          i.comprobante,
          i.fecha,
          fmt(i.imp_total),
          ...(hayRetencion ? [fmt(anticipo.monto_sicore || 0)] : []),
          ...(hayDescuento ? [fmt(anticipo.descuento_aplicado || 0)] : []),
          fmt(montoTransferido),
          fmt(totalCancelado),
        ])
        const totalBruto = items.reduce((s, i) => s + i.imp_total, 0)
        body.push([
          'TOTAL', '',
          fmt(totalBruto),
          ...(hayRetencion ? [fmt(anticipo.monto_sicore || 0)] : []),
          ...(hayDescuento ? [fmt(anticipo.descuento_aplicado || 0)] : []),
          fmt(montoTransferido),
          fmt(totalCancelado),
        ])
      } else {
        body = items.map(i => {
          const montoTransferido = i.monto_a_abonar
          const totalCancelado = i.monto_a_abonar + (i.monto_sicore || 0)
          return [
            i.comprobante,
            i.fecha,
            fmt(i.imp_total),
            ...(hayRetencion ? [i.monto_sicore ? fmt(i.monto_sicore) : '-'] : []),
            ...(hayDescuento ? [i.descuento_aplicado ? fmt(i.descuento_aplicado) : '-'] : []),
            fmt(montoTransferido),
            fmt(totalCancelado),
          ]
        })
        const totalBruto = items.reduce((s, i) => s + i.imp_total, 0)
        const totalRet = items.reduce((s, i) => s + (i.monto_sicore || 0), 0)
        const totalDesc = items.reduce((s, i) => s + (i.descuento_aplicado || 0), 0)
        const totalTransferido = items.reduce((s, i) => s + i.monto_a_abonar, 0)
        const totalCancelado = totalTransferido + totalRet
        body.push([
          'TOTAL', '',
          fmt(totalBruto),
          ...(hayRetencion ? [fmt(totalRet)] : []),
          ...(hayDescuento ? [fmt(totalDesc)] : []),
          fmt(totalTransferido),
          fmt(totalCancelado),
        ])
      }

      const ncols = head[0].length
      autoTable(doc, {
        startY: 56,
        head,
        body,
        theme: 'striped',
        headStyles: { fillColor: [40, 80, 40], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'right' },
          [ncols - 3]: { halign: 'right' },
          [ncols - 2]: { halign: 'right' },
          [ncols - 1]: { halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data: any) => {
          if (data.row.index === body.length - 1 && data.section === 'body') {
            data.cell.styles.fillColor = [220, 220, 220]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      })

      const nombreArchivo = `ComprobantePago_${proveedor.replace(/\s+/g, '_').substring(0, 30)}_${fechaPago.replace(/\//g, '-')}.pdf`
      doc.save(nombreArchivo)

    } catch (error) {
      console.error('Error generando PDF comprobante de pago:', error)
      alert('Error al generar PDF: ' + (error as Error).message)
    }
  }

  // ── Certificado de Retención Ganancias ────────────────────────────────────
  const generarCertificadoRetencion = async (registro: {
    id?: string | number
    cuit_emisor: string
    denominacion_emisor: string
    fecha_pago: string
    fecha_emision?: string | null
    tipo_comprobante?: number | null
    punto_venta?: number | null
    numero_desde?: number | null
    total_pagado: number
    retencion: number
    tipo_sicore: string
  }, returnBytes = false): Promise<ArrayBuffer | null> => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const mL = 15

      const fmt = (n: any) => `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
      const fmtFecha = (f: string | null) => {
        if (!f) return ''
        const d = new Date(f + 'T12:00:00')
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
      }
      const cuitFmt = (c: string) => {
        const clean = c.replace(/\D/g, '')
        if (clean.length === 11) return `${clean.slice(0,2)}-${clean.slice(2,10)}-${clean.slice(10)}`
        return c
      }
      const regimen = (() => {
        const t = (registro.tipo_sicore || '').toLowerCase()
        if (t.includes('arrendamiento')) return 'ARRENDAMIENTO'
        if (t.includes('bien')) return 'COMPRA DE BS. DE CAMBIO'
        if (t.includes('servicio')) return 'LOCACIÓN DE SERVICIOS'
        if (t.includes('transporte')) return 'TRANSPORTE'
        return (registro.tipo_sicore || '').toUpperCase()
      })()

      // Letra según tipo AFIP
      const letraComprobante = (tipo: number | null | undefined) => {
        const mapa: Record<number, string> = {
          1: 'A', 2: 'A', 3: 'A',
          6: 'B', 7: 'B', 8: 'B',
          11: 'C', 12: 'C', 13: 'C',
          51: 'M', 52: 'M', 53: 'M',
          201: 'A', 202: 'A', 203: 'A',
          206: 'B', 207: 'B', 208: 'B',
          211: 'C', 212: 'C', 213: 'C',
        }
        return tipo != null ? (mapa[tipo] || String(tipo)) : ''
      }

      // Comprobante que origina la retención
      const letra = letraComprobante(registro.tipo_comprobante)
      const pv = String(registro.punto_venta || 0).padStart(4, '0')
      const nro = String(registro.numero_desde || 0).padStart(8, '0')
      const fechaEmision = fmtFecha(registro.fecha_emision || null)
      const comprobanteOrigen = letra
        ? `Factura ${letra}  ${pv}-${nro}   (${fechaEmision})`
        : `Factura — ${fechaEmision}`

      // ── Borde exterior ────────────────────────────────────────────────────
      doc.setDrawColor(0)
      doc.setLineWidth(0.5)
      doc.rect(8, 8, pageW - 16, pageH - 16)

      // ── Título ────────────────────────────────────────────────────────────
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('CERTIFICADO DE RETENCIÓN Ganancias', pageW / 2, 20, { align: 'center' })
      doc.setLineWidth(0.3)
      doc.line(8, 25, pageW - 8, 25)

      // ── N° comprobante y Fecha ────────────────────────────────────────────
      const año = new Date(registro.fecha_pago + 'T12:00:00').getFullYear()
      const nroComp = `${año}-${String(registro.id || '').replace(/-/g,'').substring(0, 8).toUpperCase()}`
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Comprobante N°', mL, 33)
      doc.setFont('helvetica', 'italic')
      doc.text(nroComp, mL + 38, 33)
      doc.setFont('helvetica', 'bold')
      doc.text('Fecha:', pageW - mL - 35, 33)
      doc.setFont('helvetica', 'normal')
      doc.text(fmtFecha(registro.fecha_pago), pageW - mL, 33, { align: 'right' })
      doc.line(8, 38, pageW - 8, 38)

      // ── Agente de Retención ───────────────────────────────────────────────
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bolditalic')
      doc.text('Agente de Retención', mL, 46)
      doc.line(8, 49, pageW - 8, 49)

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bolditalic')
      doc.text('MARTINEZ SOBRADO AGRO SRL', mL + 8, 58)

      const agente: [string, string][] = [
        ['Domicilio Fiscal :', 'LIBERTAD 1366 - 9 PISO'],
        ['Localidad:', 'Capital Federal'],
        ['Provincia:', 'Capital Federal'],
        ['C.U.I.T. Nro :', '30-61778601-6'],
        ['Ingresos Brutos:', '30617786016'],
      ]
      let y = 67
      agente.forEach(([k, v]) => {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(k, mL + 8, y)
        doc.setFont('helvetica', 'normal')
        doc.text(v, mL + 52, y)
        y += 7
      })

      doc.line(8, y + 1, pageW - 8, y + 1)

      // ── Sujeto Pasible de Retención ───────────────────────────────────────
      y += 8
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bolditalic')
      doc.text('Sujeto Pasible de Retención', mL, y)
      doc.line(8, y + 3, pageW - 8, y + 3)
      y += 11

      const sujeto: [string, string][] = [
        ['Apellido y Nombre o Razón Social:', registro.denominacion_emisor || ''],
        ['C.U.I.T. Nro :', cuitFmt(registro.cuit_emisor || '')],
      ]
      sujeto.forEach(([k, v]) => {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(k, mL + 8, y)
        doc.setFont('helvetica', 'normal')
        doc.text(v, mL + 78, y)
        y += 8
      })

      doc.line(8, y + 1, pageW - 8, y + 1)

      // ── Datos de la Retención ─────────────────────────────────────────────
      y += 8
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bolditalic')
      doc.text('Datos de la Retención', mL, y)
      doc.line(8, y + 3, pageW - 8, y + 3)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [['Comprob. que origina la retención', 'Monto del comprobante', 'Monto Ret. Practicada', 'Régimen']],
        body: [[
          comprobanteOrigen,
          fmt(registro.total_pagado),
          fmt(registro.retencion),
          regimen,
        ]],
        theme: 'plain',
        styles: { fontSize: 9, lineColor: [180, 180, 180], lineWidth: 0.1 },
        headStyles: { fontStyle: 'normal', textColor: 0, fillColor: false as any, fontSize: 9 },
        margin: { left: mL, right: mL },
      })

      const afterTable = (doc as any).lastAutoTable?.finalY ?? y + 20

      // ── Total ─────────────────────────────────────────────────────────────
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Total de la Retención en $', pageW - mL - 65, afterTable + 15)
      doc.text(fmt(registro.retencion), pageW - mL, afterTable + 15, { align: 'right' })

      // ── Secciones firma ───────────────────────────────────────────────────
      const footerY = pageH - 48
      doc.setLineWidth(0.3)
      doc.line(8, footerY, pageW - 8, footerY)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Firma Autorizada Gcia.', mL, footerY + 8)

      doc.rect(pageW / 2 + 5, footerY + 2, pageW / 2 - 16, 16)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text('Recibí el original del presente comprobante', pageW / 2 + 7, footerY + 10)

      doc.setLineWidth(0.3)
      doc.line(mL, footerY + 24, mL + 55, footerY + 24)
      doc.line(mL + 65, footerY + 24, mL + 100, footerY + 24)
      doc.setFontSize(8)
      doc.text('Firma y Aclaración', mL, footerY + 29)
      doc.text('Fecha', mL + 65, footerY + 29)

      // ── Disclaimer ────────────────────────────────────────────────────────
      const disc = 'Declaro que los datos consignados en este formulario son correctos y completos y que he confeccionado la presente utilizando sistema informático propio sin omitir ni falsear dato alguno que deba contener, siendo fiel expresión de la verdad.'
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(disc, pageW - 20)
      doc.text(lines, 10, pageH - 13)

      const cuitClean = (registro.cuit_emisor || '').replace(/\D/g, '')
      const nombreArchivo = `CertRet_${cuitClean}_${(registro.denominacion_emisor || '').replace(/\s+/g, '_').substring(0, 20)}_${fmtFecha(registro.fecha_pago).replace(/\//g, '-')}.pdf`

      if (returnBytes) {
        return doc.output('arraybuffer')
      }
      doc.save(nombreArchivo)
      return null

    } catch (error) {
      console.error('Error generando certificado de retención:', error)
      alert('Error al generar certificado: ' + (error as Error).message)
      return null
    }
  }

  // ── Descargar todos los certificados de una quincena ──────────────────────
  const [descargandoCerts, setDescargandoCerts] = useState(false)

  const descargarTodosLosCertificados = async () => {
    if (registrosV2.length === 0) return
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
      setDescargandoCerts(true)
      let count = 0
      const fmtNombre = (f: string) => {
        const d = new Date(f + 'T12:00:00')
        return `${d.getDate().toString().padStart(2,'0')}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getFullYear()}`
      }
      for (const registro of registrosV2) {
        const bytes = await generarCertificadoRetencion(registro, true)
        if (!bytes) continue
        const cuitClean = (registro.cuit_emisor || '').replace(/\D/g, '')
        const nombre = `CertRet_${cuitClean}_${(registro.denominacion_emisor || '').replace(/\s+/g, '_').substring(0, 20)}_${fmtNombre(registro.fecha_pago)}.pdf`
        const fileHandle = await dirHandle.getFileHandle(nombre, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(bytes)
        await writable.close()
        count++
      }
      alert(`✅ ${count} certificado${count !== 1 ? 's' : ''} guardado${count !== 1 ? 's' : ''} correctamente.`)
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert('Error: ' + (err?.message || 'Error desconocido'))
      }
    } finally {
      setDescargandoCerts(false)
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
                  {facturasPeriodo.map(factura => {
                    const tc = Number(factura.tipo_cambio) || 1
                    const esUSD = factura.moneda === 'USD' || tc > 1.01
                    const p = (v: any) => (Number(v) || 0) * tc // pesos
                    return (
                    <TableRow key={factura.id} className={esUSD ? 'bg-amber-50' : ''}>
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
                      <TableCell className="max-w-48 truncate">
                        {esUSD && <span className="text-xs mr-1 text-amber-600">💵</span>}
                        {factura.denominacion_emisor}
                      </TableCell>
                      <TableCell>{factura.cuit}</TableCell>
                      <TableCell>{factura.tipo_comprobante}</TableCell>
                      {mostrarColumnasDetalladas ? (
                        <>
                          {/* Columnas detalladas de Netos por Alícuota */}
                          <TableCell className="text-right text-xs">${p(factura.neto_grav_iva_0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.neto_grav_iva_2_5).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.neto_grav_iva_5).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.neto_grav_iva_10_5).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.neto_grav_iva_21).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.neto_grav_iva_27).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.imp_neto_no_gravado).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.imp_op_exentas).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.otros_tributos).toLocaleString('es-AR')}</TableCell>
                          {/* Columnas detalladas de IVAs por Alícuota */}
                          <TableCell className="text-right text-xs">${Number(0).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.iva_2_5).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.iva_5).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.iva_10_5).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.iva_21).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right text-xs">${p(factura.iva_27).toLocaleString('es-AR')}</TableCell>
                        </>
                      ) : (
                        <>
                          {/* Columnas básicas */}
                          <TableCell className="text-right">${p(factura.imp_neto_gravado).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right">${p(factura.imp_neto_no_gravado).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right">${p(factura.imp_op_exentas).toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right">${p(factura.otros_tributos).toLocaleString('es-AR')}</TableCell>
                        </>
                      )}
                      <TableCell className="text-right">${p(factura.iva).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">
                        <span>${p(factura.imp_total).toLocaleString('es-AR')}</span>
                        {esUSD && (
                          <div className="text-xs text-amber-600 font-normal">
                            USD {(Number(factura.imp_total) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} · TC {tc.toLocaleString('es-AR')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          factura.ddjj_iva === 'DDJJ OK' ? 'default' :
                          factura.ddjj_iva === 'Imputado' ? 'secondary' : 'outline'
                        }>
                          {factura.ddjj_iva}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                  })}
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
      <Tabs value={tabActivo} onValueChange={(value) => setTabActivo(value as 'facturas' | 'subdiarios' | 'historico' | 'asignacion')}>
        <TabsList>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="subdiarios">Subdiarios</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="asignacion">Asignación Cuentas</TabsTrigger>
        </TabsList>

        {/* Tab Content: Facturas */}
        <TabsContent value="facturas" className="space-y-6">
          <div className="flex items-center gap-3">
            {/* Búsqueda rápida */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar emisor, CUIT, cuenta..."
                value={busquedaRapida}
                onChange={e => setBusquedaRapida(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex gap-2 ml-auto">
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
          
          {/* Botón actualizar */}
          <Button
            variant="outline"
            onClick={() => cargarFacturas()}
            title="Recargar datos desde BD"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>

          {/* Botón modo edición */}
          <Button
            variant={modoEdicion ? "default" : "outline"}
            onClick={() => setModoEdicion(!modoEdicion)}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {modoEdicion ? 'Salir Edición' : 'Modo Edición'}
          </Button>

          {/* Botón edición masiva */}
          <Button
            variant={modoEdicionMasiva ? "default" : "outline"}
            onClick={() => {
              setModoEdicionMasiva(!modoEdicionMasiva)
              if (modoEdicionMasiva) {
                setFacturasSeleccionadasMasiva(new Set())
                setNuevoEstadoMasivo('')
              }
            }}
            className={modoEdicionMasiva ? "bg-purple-600 hover:bg-purple-700" : ""}
          >
            <Check className="mr-2 h-4 w-4" />
            {modoEdicionMasiva ? 'Cancelar Masiva' : 'Edición Masiva'}
          </Button>

          {/* Botón Panel SICORE */}
          <Button
            variant="outline"
            className="bg-orange-50 hover:bg-orange-100 border-orange-300"
            onClick={() => {
              const quincenaActual = generarQuincenaSicore(new Date().toISOString())
              setQuincenaVerRetenciones(quincenaActual)
              cargarRetencionesVer(quincenaActual)
              setTabPanelSicore('ver')
              setMostrarModalPanelSicore(true)
            }}
          >
            <Calendar className="mr-2 h-4 w-4" />
            SICORE
          </Button>

          {/* Botón Vista de Pagos */}
          <Button
            variant="outline"
            className="bg-green-50 hover:bg-green-100 border-green-300"
            onClick={async () => {
              setCargandoPagos(true)
              setMostrarModalPagos(true)
              setFiltroOrigenPagos({ arca: true, template: true, anticipo: true })
              setFacturasSeleccionadasPagos(new Set())
              setTemplatesSeleccionadosPagos(new Set())

              // Cargar en paralelo las 3 fuentes
              const [arcaResult, templatesResult, anticiposResult] = await Promise.all([
                supabase.schema('msa').from('comprobantes_arca').select('*')
                  .in('estado', ['pendiente', 'pagar', 'preparado'])
                  .order('fecha_vencimiento', { ascending: true }),
                supabase.from('cuotas_egresos_sin_factura').select(`*, grupo_pago_id, egreso:egresos_sin_factura!inner(*)`)
                  .in('estado', ['pendiente', 'pagar', 'preparado'])
                  .eq('egreso.activo', true)
                  .order('fecha_vencimiento', { ascending: true }),
                supabase.from('anticipos_proveedores').select('*')
                  .in('estado_pago', ['pendiente', 'pagar', 'preparado'])
                  .neq('estado', 'conciliado')
                  .order('fecha_pago', { ascending: true })
              ])

              if (!arcaResult.error && arcaResult.data) setFacturasPagos(arcaResult.data)
              if (!templatesResult.error && templatesResult.data) setTemplatesPagos(templatesResult.data)
              if (!anticiposResult.error && anticiposResult.data) setAnticiposPagos(anticiposResult.data)

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
              
              {/* Búsqueda por detalle */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📝 Detalle</Label>
                <Input
                  placeholder="Buscar en detalle..."
                  value={busquedaDetalle}
                  onChange={(e) => setBusquedaDetalle(e.target.value)}
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
                    onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                    className="text-xs"
                  />
                  <Input
                    type="number"
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
                      {modoEdicionMasiva && (
                        <TableHead style={{ width: '50px', minWidth: '50px' }}>
                          <Checkbox
                            checked={facturasSeleccionadasMasiva.size === facturas.length && facturas.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFacturasSeleccionadasMasiva(new Set(facturas.map(f => f.id)))
                              } else {
                                setFacturasSeleccionadasMasiva(new Set())
                              }
                            }}
                          />
                        </TableHead>
                      )}
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
                      <TableHead style={{ width: '40px', minWidth: '40px' }}></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const q = busquedaRapida.trim().toLowerCase()
                      const facturasDisplay = q
                        ? facturas.filter(f =>
                            f.denominacion_emisor?.toLowerCase().includes(q) ||
                            f.cuit?.includes(q) ||
                            (f.cuenta_contable ?? '').toLowerCase().includes(q)
                          )
                        : facturas
                      return facturasDisplay.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={columnasVisiblesArray.length + (modoEdicionMasiva ? 1 : 0)}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No hay facturas para mostrar
                        </TableCell>
                      </TableRow>
                    ) : (
                      facturasDisplay.map(factura => {
                        const esUSD = factura.moneda === 'USD' || (Number(factura.tipo_cambio) > 1.01)
                        return (
                        <TableRow key={factura.id} className={
                          facturasSeleccionadasMasiva.has(factura.id)
                            ? 'bg-purple-50'
                            : esUSD ? 'bg-amber-50' : ''
                        }>
                          {modoEdicionMasiva && (
                            <TableCell style={{ width: '50px', minWidth: '50px' }}>
                              <Checkbox
                                checked={facturasSeleccionadasMasiva.has(factura.id)}
                                onCheckedChange={(checked) => {
                                  const nuevaSeleccion = new Set(facturasSeleccionadasMasiva)
                                  if (checked) {
                                    nuevaSeleccion.add(factura.id)
                                  } else {
                                    nuevaSeleccion.delete(factura.id)
                                  }
                                  setFacturasSeleccionadasMasiva(nuevaSeleccion)
                                }}
                              />
                            </TableCell>
                          )}
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
                          <TableCell style={{ width: '40px', padding: '0 4px' }}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(factura.estado === 'pagado' || factura.estado === 'conciliado') && (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      // Si pertenece a un grupo, buscar todas las facturas del grupo
                                      if (factura.grupo_pago_id) {
                                        const { data: grupoFacs } = await supabase
                                          .schema('msa').from('comprobantes_arca')
                                          .select('*')
                                          .eq('grupo_pago_id', factura.grupo_pago_id)
                                        if (grupoFacs && grupoFacs.length > 0) {
                                          await generarPDFDetallePago(
                                            'arca',
                                            grupoFacs[0].denominacion_emisor,
                                            grupoFacs[0].cuit,
                                            grupoFacs.map((f: any) => ({
                                              comprobante: `FC ${f.tipo_comprobante}-${String(f.punto_venta || 0).padStart(5,'0')}-${String(f.numero_desde || 0).padStart(8,'0')}`,
                                              fecha: f.fecha_emision || '',
                                              imp_total: f.imp_total || 0,
                                              monto_sicore: f.monto_sicore,
                                              descuento_aplicado: f.descuento_aplicado,
                                              monto_a_abonar: f.monto_a_abonar ?? f.imp_total ?? 0,
                                            }))
                                          )
                                          return
                                        }
                                      }
                                      // Buscar anticipo vinculado a esta factura
                                      const { data: anticipoVinc } = await supabase
                                        .from('anticipos_proveedores')
                                        .select('monto, monto_sicore, descuento_aplicado, tipo_sicore, sicore, fecha_pago')
                                        .eq('factura_id', factura.id)
                                        .eq('tipo', 'pago')
                                        .limit(1)
                                      const anticipo = anticipoVinc && anticipoVinc.length > 0 ? anticipoVinc[0] : null

                                      // Factura individual
                                      await generarPDFDetallePago(
                                        'arca', factura.denominacion_emisor, factura.cuit,
                                        [{
                                          comprobante: `FC ${factura.tipo_comprobante}-${String(factura.punto_venta || 0).padStart(5,'0')}-${String(factura.numero_desde || 0).padStart(8,'0')}`,
                                          fecha: factura.fecha_emision || '',
                                          imp_total: factura.imp_total || 0,
                                          monto_sicore: anticipo ? null : factura.monto_sicore,
                                          descuento_aplicado: anticipo ? null : factura.descuento_aplicado,
                                          monto_a_abonar: factura.monto_a_abonar ?? factura.imp_total ?? 0,
                                        }],
                                        anticipo
                                      )
                                    }}
                                  >
                                    📄 Detalle de pago
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        )
                      })
                    )})()}
                  </TableBody>
                </Table>
            </div>

            {/* Panel de control edición masiva */}
            {modoEdicionMasiva && facturasSeleccionadasMasiva.size > 0 && (
              <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-purple-900">
                    ✏️ Edición Masiva - {facturasSeleccionadasMasiva.size} facturas seleccionadas
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFacturasSeleccionadasMasiva(new Set())}
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
                        <SelectItem value="anterior">Anterior</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Botón aplicar */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-purple-900">Acción</Label>
                    <Button
                      onClick={ejecutarEdicionMasivaFacturas}
                      disabled={facturasSeleccionadasMasiva.size === 0 || !nuevoEstadoMasivo}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      ✅ Aplicar Estado a {facturasSeleccionadasMasiva.size} facturas
                    </Button>
                  </div>
                </div>
              </div>
            )}
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

        {/* Tab Content: Histórico */}
        <TabsContent value="historico" className="space-y-6">
          <VistaHistoricoFacturas />
        </TabsContent>

        {/* Tab Content: Asignación Cuentas */}
        <TabsContent value="asignacion" className="space-y-6">
          <VistaAsignacionArca />
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
      {/* Modal confirmación cambio quincena SICORE al pagar */}
      <Dialog open={!!confirmCambioQuincena} onOpenChange={(open) => { if (!open) setConfirmCambioQuincena(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🗓️ Quincena SICORE</DialogTitle>
            <DialogDescription>
              La fecha de pago corresponde a una quincena distinta a la registrada.
            </DialogDescription>
          </DialogHeader>
          {confirmCambioQuincena && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Quincena registrada:</span>
                  <span className="font-medium line-through text-red-500">{confirmCambioQuincena.quincenaAnterior}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quincena según fecha de pago:</span>
                  <span className="font-semibold text-green-700">{confirmCambioQuincena.quincenahNueva}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">¿Actualizar la quincena SICORE a <strong>{confirmCambioQuincena.quincenahNueva}</strong>?</p>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    const { error } = await supabase
                      .schema('msa')
                      .from('comprobantes_arca')
                      .update({ sicore: confirmCambioQuincena.quincenahNueva })
                      .eq('id', confirmCambioQuincena.facturaId)
                    if (!error) {
                      setFacturas(prev => prev.map(f =>
                        f.id === confirmCambioQuincena.facturaId
                          ? { ...f, sicore: confirmCambioQuincena.quincenahNueva }
                          : f
                      ))
                      setFacturasOriginales(prev => prev.map(f =>
                        f.id === confirmCambioQuincena.facturaId
                          ? { ...f, sicore: confirmCambioQuincena.quincenahNueva }
                          : f
                      ))
                    }
                    setConfirmCambioQuincena(null)
                  }}
                >
                  ✅ Sí, actualizar
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setConfirmCambioQuincena(null)}>
                  No, mantener {confirmCambioQuincena.quincenaAnterior}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
          {pasoSicore === 'calculo' && facturaEnProceso && tipoSeleccionado && datosSicoreCalculo && (() => {
            const impTotal = facturaEnProceso.imp_total || 0
            const impGravado = facturaEnProceso.imp_neto_gravado || 0
            const impIva = facturaEnProceso.iva || 0
            const impNoGravado = facturaEnProceso.imp_neto_no_gravado || 0
            const impExento = facturaEnProceso.imp_op_exentas || 0
            const saldoGravado = impGravado - (descuentoDesglose?.gravado || 0)
            const saldoIva = impIva - (descuentoDesglose?.iva || 0)
            const transferencia = impTotal - (descuentoDesglose?.total || 0) - montoRetencion
            const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            return (
            <div className="space-y-3">
              {datosSicoreCalculo.esRetencionAdicional && (
                <div className="bg-yellow-100 text-yellow-800 text-xs p-2 rounded">
                  ⚠️ Retención adicional en quincena - No se aplica mínimo no imponible
                </div>
              )}

              {/* Tabla desglose gravado / IVA */}
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-xs font-semibold text-green-800 mb-2">{tipoSeleccionado.emoji} {tipoSeleccionado.tipo} — Desglose</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b">
                      <th className="text-left pb-1">Concepto</th>
                      <th className="text-right pb-1">Gravado</th>
                      <th className="text-right pb-1">IVA</th>
                      <th className="text-right pb-1">Total</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    <tr>
                      <td className="py-0.5 text-gray-600">Factura</td>
                      <td className="text-right">${fmt(impGravado)}</td>
                      <td className="text-right">${fmt(impIva)}</td>
                      <td className="text-right font-medium">${fmt(impTotal)}</td>
                    </tr>
                    {descuentoDesglose && descuentoDesglose.total > 0 && (
                      <tr className="text-orange-700">
                        <td className="py-0.5">Descuento</td>
                        <td className="text-right">-${fmt(descuentoDesglose.gravado)}</td>
                        <td className="text-right">-${fmt(descuentoDesglose.iva)}</td>
                        <td className="text-right font-medium">-${fmt(descuentoDesglose.total)}</td>
                      </tr>
                    )}
                    <tr className="border-t font-semibold">
                      <td className="py-0.5">Saldo pagar</td>
                      <td className="text-right">${fmt(saldoGravado)}</td>
                      <td className="text-right">${fmt(saldoIva)}</td>
                      <td className="text-right">${fmt(impTotal - (descuentoDesglose?.total || 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Cálculo SICORE */}
              <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Monto no imponible:</span>
                  <span>${fmt(datosSicoreCalculo.minimoAplicado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Base imponible:</span>
                  <span className="font-medium">${fmt(datosSicoreCalculo.baseImponible)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Retención {(tipoSeleccionado.porcentaje_retencion * 100).toFixed(2)}%:</span>
                  <span className="font-bold text-red-600">${fmt(montoRetencion)}</span>
                </div>
                <hr className="border-gray-300" />
                <div className="flex justify-between text-sm">
                  <span className="font-bold">Transferencia:</span>
                  <span className="font-bold text-green-700">${fmt(transferencia)}</span>
                </div>
              </div>

              {/* Sección descuento */}
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-orange-800">Descuento (genera NC posterior)</p>
                <div className="flex gap-2 items-center">
                  <select
                    value={descuentoTipoInput}
                    onChange={(e) => setDescuentoTipoInput(e.target.value as 'pct' | 'monto')}
                    className="border rounded px-2 py-1 text-xs w-16 bg-white"
                  >
                    <option value="pct">%</option>
                    <option value="monto">$</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step={descuentoTipoInput === 'pct' ? '0.5' : '100'}
                    placeholder={descuentoTipoInput === 'pct' ? 'ej: 5' : 'ej: 21438'}
                    value={descuentoInputValor}
                    onChange={(e) => setDescuentoInputValor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') aplicarDescuentoSicore() }}
                    className="border rounded px-2 py-1 text-xs flex-1 bg-white"
                  />
                  <button
                    onClick={aplicarDescuentoSicore}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1 rounded"
                  >
                    Aplicar
                  </button>
                  {descuentoDesglose && descuentoDesglose.total > 0 && (
                    <button
                      onClick={limpiarDescuentoSicore}
                      className="text-gray-400 hover:text-red-500 text-xs px-2 py-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {descuentoDesglose && descuentoDesglose.total > 0 && (
                  <p className="text-xs text-orange-700">
                    Desc: Grav ${fmt(descuentoDesglose.gravado)} + IVA ${fmt(descuentoDesglose.iva)} = ${fmt(descuentoDesglose.total)}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={finalizarProcesoSicore} className="flex-1 bg-green-600 hover:bg-green-700">
                  ✅ Confirmar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const nuevo = prompt('Cambiar monto retención:', montoRetencion.toFixed(2))
                    if (nuevo !== null) setMontoRetencion(parseFloat(nuevo.replace(',', '.')) || 0)
                  }}
                >
                  📝
                </Button>
                <Button variant="outline" onClick={cancelarGuardadoPendiente}>
                  ❌
                </Button>
              </div>
            </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Panel SICORE - Modal combinado */}
      <Dialog open={mostrarModalPanelSicore} onOpenChange={setMostrarModalPanelSicore}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📊 SICORE - Retenciones Ganancias</DialogTitle>
            <DialogDescription>
              Visualización y cierre de quincenas SICORE
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tabPanelSicore} onValueChange={(v) => setTabPanelSicore(v as 'ver' | 'cerrar' | 'v2')}>
            <TabsList className="w-full">
              <TabsTrigger value="ver" className="flex-1">🔍 Ver Retenciones</TabsTrigger>
              <TabsTrigger value="cerrar" className="flex-1">📅 Cerrar Quincena</TabsTrigger>
              <TabsTrigger value="v2" className="flex-1">🆕 Cierre v2</TabsTrigger>
            </TabsList>

            {/* TAB: Ver Retenciones */}
            <TabsContent value="ver" className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <Label className="whitespace-nowrap">Quincena:</Label>
                <Select
                  value={quincenaVerRetenciones}
                  onValueChange={(v) => {
                    setQuincenaVerRetenciones(v)
                    cargarRetencionesVer(v)
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {generarQuincenasDisponibles().map((q) => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {quincenaVerRetenciones && (() => {
                  const actual = generarQuincenaSicore(new Date().toISOString())
                  const esActual = quincenaVerRetenciones === actual
                  return (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${esActual ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {esActual ? '● En curso' : '● Histórico'}
                    </span>
                  )
                })()}
              </div>

              {cargandoRetencionesVer ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-orange-500" />
                  <span className="text-sm text-gray-500">Cargando retenciones...</span>
                </div>
              ) : retencionesVer.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  {quincenaVerRetenciones ? 'Sin retenciones SICORE para esta quincena' : 'Selecciona una quincena para ver las retenciones'}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>CUIT</TableHead>
                        <TableHead className="text-right">Fecha Venc.</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Neto Gravado</TableHead>
                        <TableHead className="text-right">Retención</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retencionesVer.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="text-sm font-medium">
                            <div className="flex items-center gap-1">
                              {f.denominacion_emisor}
                              {f._tipo === 'anticipo' && (
                                <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-300">Anticipo</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">{f.cuit}</TableCell>
                          <TableCell className="text-right text-xs">
                            {f.fecha_vencimiento ? new Date(f.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR') : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${colorEstado(f.estado)}`}>{f.estado}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {f.imp_neto_gravado != null ? `$${Number(f.imp_neto_gravado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-orange-700">
                            ${Number(f.monto_sicore).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-bold">
                        <td colSpan={5} className="pt-2 pr-2 text-right text-sm">Total retenciones ({retencionesVer.length} registros):</td>
                        <td className="pt-2 text-right text-sm text-orange-700">
                          ${retencionesVer.reduce((s, f) => s + (Number(f.monto_sicore) || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </>
              )}
            </TabsContent>

            {/* TAB: Cerrar Quincena */}
            <TabsContent value="cerrar" className="space-y-4 mt-4">

              {/* Carpeta por defecto */}
              <div className="flex items-center justify-between bg-gray-50 border rounded-lg px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">📁 Carpeta destino: </span>
                  <span className={carpetaPorDefecto ? 'text-green-700 font-medium' : 'text-red-500'}>
                    {carpetaPorDefecto ? carpetaPorDefecto.name : 'No configurada'}
                  </span>
                  {carpetaPorDefecto && quincenaSeleccionada && (
                    <span className="text-gray-400 ml-1">/ {quincenaACarpeta(quincenaSeleccionada)}/</span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={async () => {
                    try {
                      const carpeta = await (window as any).showDirectoryPicker({ startIn: 'downloads' })
                      setCarpetaPorDefecto(carpeta)
                    } catch (e) { /* cancelado */ }
                  }}
                >
                  {carpetaPorDefecto ? 'Cambiar' : 'Configurar'}
                </Button>
              </div>

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

              <div className="bg-blue-50 p-3 rounded-lg space-y-2 text-sm">
                <p className="font-medium">El proceso incluirá:</p>
                <ul className="space-y-1 text-gray-700">
                  <li>• Buscar todas las retenciones SICORE de la quincena</li>
                  <li>• Generar reportes PDF + Excel con detalles</li>
                  <li>• Calcular total y actualizar template correspondiente</li>
                  <li>• Usar carpeta configurada para guardar archivos</li>
                </ul>
              </div>

              {quincenaSeleccionada && (
                <div className="bg-orange-50 p-3 rounded-lg text-sm">
                  <p className="text-gray-600">
                    Se procesarán todas las facturas con retención SICORE de la quincena <strong>"{quincenaSeleccionada}"</strong>
                  </p>
                </div>
              )}

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
                  onClick={() => setQuincenaSeleccionada('')}
                  disabled={procesandoCierre}
                >
                  Limpiar
                </Button>
              </div>
            </TabsContent>

            {/* TAB: Cierre v2 — lee de msa.sicore_retenciones */}
            <TabsContent value="v2" className="space-y-4 mt-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                <p className="font-semibold mb-1">🆕 Retenciones desde tabla sicore_retenciones</p>
                <p className="text-green-700">Valores autocontenidos: retención + pago = total pagado. Refleja descuentos, anticipos y agrupaciones.</p>
              </div>

              <div>
                <Label className="mb-2 block">Quincena:</Label>
                <Select value={quincenaSeleccionadaV2} onValueChange={previsualizarV2}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar quincena..." />
                  </SelectTrigger>
                  <SelectContent>
                    {generarQuincenasDisponibles().map(q => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {cargandoV2 && (
                <div className="flex items-center gap-2 py-4 justify-center text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Cargando...</span>
                </div>
              )}

              {/* Tabla de registros */}
              {registrosV2.length > 0 && (
                <TablaRegistrosV2 registros={registrosV2} onCertificado={generarCertificadoRetencion} />
              )}

              {conteoV2 !== null && conteoV2.cantidad === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  ⚠️ Sin registros para esta quincena en sicore_retenciones
                </div>
              )}

              {/* Botones acción */}
              <div className="flex gap-2">
                <Button
                  onClick={() => quincenaSeleccionadaV2 && procesarCierreV2(quincenaSeleccionadaV2)}
                  disabled={!quincenaSeleccionadaV2 || procesandoCierreV2 || registrosV2.length === 0}
                  className="bg-green-600 hover:bg-green-700 flex-1"
                >
                  {procesandoCierreV2 ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generando...</>
                  ) : (
                    <><Calendar className="mr-2 h-4 w-4" />Generar Export v2</>
                  )}
                </Button>
                <Button
                  onClick={descargarTodosLosCertificados}
                  disabled={registrosV2.length === 0 || descargandoCerts}
                  variant="outline"
                  className="flex-1 border-blue-400 text-blue-700 hover:bg-blue-50"
                >
                  {descargandoCerts ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generando...</>
                  ) : (
                    <><FileText className="mr-2 h-4 w-4" />Certificados de Retención ({registrosV2.length})</>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
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
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filtroOrigenPagos.anticipo}
                  onCheckedChange={(checked) => setFiltroOrigenPagos(prev => ({ ...prev, anticipo: !!checked }))}
                />
                <span className="text-sm flex items-center gap-1">
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">Anticipos</Badge>
                  ({anticiposPagos.length})
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

          {/* Barra de búsqueda */}
          <div className="flex items-center gap-2 mb-2">
            <Input
              placeholder="Buscar por proveedor, CUIT, cuenta, monto..."
              value={filtroBusquedaPagos}
              onChange={e => setFiltroBusquedaPagos(e.target.value)}
              className="text-sm"
            />
            {filtroBusquedaPagos && (
              <Button size="sm" variant="ghost" onClick={() => setFiltroBusquedaPagos('')} className="h-9 px-2 text-gray-400">
                ✕
              </Button>
            )}
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

            // Función de búsqueda full-text sobre los campos relevantes
            const matchBusqueda = (f: FacturaArca) => {
              if (!filtroBusquedaPagos.trim()) return true
              const q = filtroBusquedaPagos.toLowerCase()
              return [
                f.denominacion_emisor,
                f.cuit,
                f.cuenta_contable,
                f.centro_costo,
                f.detalle,
                f.observaciones_pago,
                String(f.monto_a_abonar ?? f.imp_total ?? ''),
                f.fecha_vencimiento,
                f.fecha_estimada,
              ].some(v => v && String(v).toLowerCase().includes(q))
            }

            // Filtrar facturas por estado, búsqueda y ordenar por fecha
            const facturasPreparado = ordenarPorFecha(facturasPagos.filter(f => f.estado === 'preparado' && matchBusqueda(f)))
            const facturasPagar = ordenarPorFecha(facturasPagos.filter(f => f.estado === 'pagar' && matchBusqueda(f)))
            const facturasPendiente = ordenarPorFecha(facturasPagos.filter(f => f.estado === 'pendiente' && matchBusqueda(f)))

            // Calcular subtotales (convertir a pesos con TC de pago)
            const montoEnPesos = (f: FacturaArca) => {
              const tc = f.tc_pago ?? f.tipo_cambio ?? 1
              return (f.monto_a_abonar || f.imp_total || 0) * tc
            }
            const subtotalPreparado = facturasPreparado.reduce((sum, f) => sum + montoEnPesos(f), 0)
            const subtotalPagar = facturasPagar.reduce((sum, f) => sum + montoEnPesos(f), 0)
            const subtotalPendiente = facturasPendiente.reduce((sum, f) => sum + montoEnPesos(f), 0)

            // ── Agrupar / Desagrupar pagos ────────────────────────────────

            // Facturas seleccionadas que están en estado 'pagar' y pertenecen a este grupo de facturas
            const seleccionadasEnPagar = facturas.filter(
              f => facturasSeleccionadasPagos.has(f.id) && f.estado === 'pagar'
            )
            // Hay agrupación posible si hay 2+ del mismo proveedor sin grupo asignado
            const puedeAgrupar = seleccionadasEnPagar.length >= 2
              && new Set(seleccionadasEnPagar.map(f => f.cuit)).size === 1
              && seleccionadasEnPagar.every(f => !f.grupo_pago_id)

            // Hay desagrupación posible si todas las seleccionadas tienen el mismo grupo
            const gruposSeleccionados = new Set(
              seleccionadasEnPagar.filter(f => f.grupo_pago_id).map(f => f.grupo_pago_id)
            )
            const puedeDesagrupar = gruposSeleccionados.size === 1

            const agruparPagos = async () => {
              if (!puedeAgrupar) return
              const primeraF = seleccionadasEnPagar[0]
              const monto_total = seleccionadasEnPagar.reduce(
                (s, f) => s + (f.monto_a_abonar ?? f.imp_total ?? 0) * (f.tc_pago ?? f.tipo_cambio ?? 1), 0
              )
              // 1. Crear grupo
              const { data: grupo, error: errGrupo } = await supabase
                .schema('msa')
                .from('grupos_pago')
                .insert({
                  cuit: primeraF.cuit,
                  proveedor: primeraF.denominacion_emisor,
                  monto_total,
                  estado: 'pagar',
                })
                .select('id')
                .single()
              if (errGrupo || !grupo) { alert('Error al crear grupo'); return }
              // 2. Asignar grupo a las facturas
              const ids = seleccionadasEnPagar.map(f => f.id)
              const { error: errUpd } = await supabase
                .schema('msa')
                .from('comprobantes_arca')
                .update({ grupo_pago_id: grupo.id })
                .in('id', ids)
              if (errUpd) { alert('Error al asignar grupo'); return }
              // 3. Actualizar estado local
              setFacturasPagos(prev => prev.map(f =>
                ids.includes(f.id) ? { ...f, grupo_pago_id: grupo.id } : f
              ))
              setFacturasSeleccionadasPagos(new Set())
              alert(`✅ ${ids.length} facturas agrupadas en un pago`)
            }

            const desagruparPago = async () => {
              if (!puedeDesagrupar) return
              const grupoId = Array.from(gruposSeleccionados)[0] as string
              const ids = seleccionadasEnPagar.filter(f => f.grupo_pago_id === grupoId).map(f => f.id)
              // Verificar si quedarán facturas en el grupo
              const todasDelGrupo = facturas.filter(f => f.grupo_pago_id === grupoId)
              const quedan = todasDelGrupo.filter(f => !ids.includes(f.id))
              // Quitar grupo de las seleccionadas
              await supabase
                .schema('msa')
                .from('comprobantes_arca')
                .update({ grupo_pago_id: null })
                .in('id', ids)
              // Si el grupo queda con 0 o 1 factura, eliminar el grupo
              if (quedan.length <= 1) {
                if (quedan.length === 1) {
                  await supabase.schema('msa').from('comprobantes_arca')
                    .update({ grupo_pago_id: null }).eq('grupo_pago_id', grupoId)
                }
                await supabase.schema('msa').from('grupos_pago').delete().eq('id', grupoId)
              }
              // Actualizar estado local
              setFacturasPagos(prev => prev.map(f =>
                ids.includes(f.id) ? { ...f, grupo_pago_id: null } : f
              ))
              setFacturasSeleccionadasPagos(new Set())
            }

            // ── Agrupar / Desagrupar templates (cualquier estado) ─────────────
            const seleccionadasTemplatesActivas = templatesPagos.filter(
              t => templatesSeleccionadosPagos.has(t.id)
            )
            const puedeAgruparTemplates = seleccionadasTemplatesActivas.length >= 2
              && new Set(seleccionadasTemplatesActivas.map(t => t.egreso?.cuit_quien_cobra)).size === 1
              && new Set(seleccionadasTemplatesActivas.map(t => t.egreso?.responsable)).size === 1
              && seleccionadasTemplatesActivas.every(t => !t.grupo_pago_id)

            const gruposTemplatesSeleccionados = new Set(
              seleccionadasTemplatesActivas.filter(t => t.grupo_pago_id).map(t => t.grupo_pago_id)
            )
            const puedeDesagruparTemplates = gruposTemplatesSeleccionados.size === 1

            const agruparTemplates = async () => {
              if (!puedeAgruparTemplates) return
              const primero = seleccionadasTemplatesActivas[0]
              const monto_total = seleccionadasTemplatesActivas.reduce((s, t) => s + (t.monto || 0), 0)
              const { data: grupo, error: errGrupo } = await supabase
                .schema('msa')
                .from('grupos_pago')
                .insert({
                  cuit: primero.egreso?.cuit_quien_cobra,
                  proveedor: primero.egreso?.nombre_quien_cobra || primero.egreso?.proveedor,
                  monto_total,
                  estado: primero.estado || 'pendiente',
                })
                .select('id')
                .single()
              if (errGrupo || !grupo) { alert('Error al crear grupo'); return }
              const ids = seleccionadasTemplatesActivas.map(t => t.id)
              const { error: errUpd } = await supabase
                .from('cuotas_egresos_sin_factura')
                .update({ grupo_pago_id: grupo.id })
                .in('id', ids)
              if (errUpd) { alert('Error al asignar grupo'); return }
              setTemplatesPagos(prev => prev.map(t =>
                ids.includes(t.id) ? { ...t, grupo_pago_id: grupo.id } : t
              ))
              setTemplatesSeleccionadosPagos(new Set())
              alert(`✅ ${ids.length} templates agrupados en un pago`)
            }

            const desagruparTemplates = async () => {
              if (!puedeDesagruparTemplates) return
              const grupoId = Array.from(gruposTemplatesSeleccionados)[0] as string
              const ids = seleccionadasTemplatesActivas.filter(t => t.grupo_pago_id === grupoId).map(t => t.id)
              const todasDelGrupo = templatesPagos.filter(t => t.grupo_pago_id === grupoId)
              const quedan = todasDelGrupo.filter(t => !ids.includes(t.id))
              await supabase
                .from('cuotas_egresos_sin_factura')
                .update({ grupo_pago_id: null })
                .in('id', ids)
              if (quedan.length <= 1) {
                if (quedan.length === 1) {
                  await supabase.from('cuotas_egresos_sin_factura')
                    .update({ grupo_pago_id: null }).eq('grupo_pago_id', grupoId)
                }
                await supabase.schema('msa').from('grupos_pago').delete().eq('id', grupoId)
              }
              setTemplatesPagos(prev => prev.map(t =>
                ids.includes(t.id) ? { ...t, grupo_pago_id: null } : t
              ))
              setTemplatesSeleccionadosPagos(new Set())
            }

            // Función para cambiar estado de facturas seleccionadas
            const cambiarEstadoSeleccionadas = async (nuevoEstado: string, echeqFecha?: string) => {
              if (facturasSeleccionadasPagos.size === 0) {
                alert('Selecciona al menos una factura')
                return
              }

              const ids = Array.from(facturasSeleccionadasPagos)
              const facturasACambiar = facturasPagos.filter(f => ids.includes(f.id))

              // Para ECHEQ: echeqFecha sobreescribe fechaPagoSeleccionada (evita stale closure)
              const fechaEfectiva = echeqFecha || fechaPagoSeleccionada

              // Preparar datos de actualización (incluye fecha si está seleccionada)
              const datosUpdate: { estado: string; fecha_vencimiento?: string; fecha_estimada?: string } = { estado: nuevoEstado }
              if (fechaEfectiva) {
                // Actualizar ambas fechas (misma lógica que en templates)
                datosUpdate.fecha_vencimiento = fechaEfectiva
                datosUpdate.fecha_estimada = fechaEfectiva
                console.log(`🔄 Vista Pagos: fecha_vencimiento + fecha_estimada = ${fechaEfectiva}`)
              }

              // Interceptar USD sin TC de pago al cambiar a 'pagar'
              if (nuevoEstado === 'pagar') {
                const usdSinTC = facturasACambiar.filter(f => {
                  const tc = Number(f.tipo_cambio) || 1
                  return (f.moneda === 'USD' || tc > 1.01) && !f.tc_pago
                })
                if (usdSinTC.length > 0) {
                  const [primera, ...resto] = usdSinTC
                  setColaUSDSinTC(resto)
                  setModalTcPagoPagos({ factura: primera })
                  setTcPagoInputPagos('')
                  return
                }
              }

              // SICORE: Detectar cambio pendiente → pagar
              // Usar suma de gravado + no_gravado + exento para evaluar
              const minimoSicore = 67170
              // SICORE se calcula sobre lo pagado → convertir a pesos con TC de pago
              const calcularNetoFactura = (f: FacturaArca) => {
                const tc = f.tc_pago ?? f.tipo_cambio ?? 1
                return ((f.imp_neto_gravado || 0) + (f.imp_neto_no_gravado || 0) + (f.imp_op_exentas || 0)) * tc
              }

              if (nuevoEstado === 'pagar') {
                const facturasDesdePendiente = facturasACambiar.filter(f => f.estado === 'pendiente')
                const facturasCalificanSicore = facturasDesdePendiente.filter(f => calcularNetoFactura(f) > minimoSicore)
                const facturasNoCalifican = facturasACambiar.filter(f =>
                  f.estado !== 'pendiente' || calcularNetoFactura(f) <= minimoSicore
                )

                if (facturasCalificanSicore.length > 0) {
                  // Confirmar proceso SICORE (mostrar fecha de pago si está seleccionada)
                  // Usar split/reverse para evitar problema timezone con new Date()
                  const mensajeFecha = fechaEfectiva
                    ? `\n📅 Fecha de pago: ${fechaEfectiva.split('-').reverse().join('/')}`
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
                        ? { ...f, estado: 'pagar', ...(fechaEfectiva && { fecha_vencimiento: fechaEfectiva, fecha_estimada: fechaEfectiva }) }
                        : f
                    ))
                  }

                  // Iniciar cola SICORE
                  setFacturasSeleccionadasPagos(new Set())
                  setProcesandoColaSicore(true)

                  // Tomar la primera y poner el resto en cola (con fecha actualizada)
                  const facturasConFecha = facturasCalificanSicore.map(f => ({
                    ...f,
                    ...(fechaEfectiva && { fecha_vencimiento: fechaEfectiva, fecha_estimada: fechaEfectiva })
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
                      ? { ...f, estado: 'pagar', ...(fechaEfectiva && { fecha_vencimiento: fechaEfectiva, fecha_estimada: fechaEfectiva }) }
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
              const mensajeFecha = fechaEfectiva
                ? `\n📅 Fecha de pago: ${fechaEfectiva.split('-').reverse().join('/')}`
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

                // Si se marcó como pagado: corregir quincena SICORE para facturas cuya fecha cambió
                if (nuevoEstado === 'pagado') {
                  for (const f of facturasACambiar) {
                    if (!f.sicore) continue
                    const fechaFinal = fechaEfectiva || f.fecha_vencimiento || f.fecha_estimada
                    if (!fechaFinal) continue
                    const quincenahNueva = generarQuincenaSicore(fechaFinal)
                    if (quincenahNueva !== f.sicore) {
                      await supabase
                        .schema('msa')
                        .from('comprobantes_arca')
                        .update({ sicore: quincenahNueva })
                        .eq('id', f.id)
                      console.log(`🔄 SICORE quincena corregida: ${f.sicore} → ${quincenahNueva} (${f.denominacion_emisor})`)
                    }
                  }
                }

                // Actualizar estado local (incluye fecha si aplica)
                setFacturasPagos(prev => prev.map(f =>
                  ids.includes(f.id)
                    ? { ...f, estado: nuevoEstado, ...(fechaEfectiva && { fecha_vencimiento: fechaEfectiva, fecha_estimada: fechaEfectiva }) }
                    : f
                ))
                setFacturasSeleccionadasPagos(new Set())

                // Guardar cheque ECHEQ si aplica (path sin SICORE)
                if (echeqPendienteRef.current && (nuevoEstado === 'pagar' || nuevoEstado === 'pagado')) {
                  await guardarCheques(facturasACambiar, echeqPendienteRef.current, null)
                  echeqPendienteRef.current = null
                  setEcheqPendiente(null)
                }

                // También actualizar facturas principales
                cargarFacturas()
              } catch (error) {
                console.error('Error cambiando estado:', error)
                alert('Error al cambiar estado')
              }
            }
            // Exponer al modal ECHEQ que vive fuera de este IIFE
            cambiarEstadoSeleccionadasRef.current = cambiarEstadoSeleccionadas

            // Función para renderizar tabla de facturas
            const renderTablaFacturas = (facturas: FacturaArca[], titulo: string, subtotal: number, estadoActual: string, mostrarCheckbox: boolean = true, accionBoton?: { label: string, estado: string }, accionSecundaria?: { label: string, estado: string }) => {
              // Colapsar facturas agrupadas: una sola fila por grupo
              type GrupoRow = {
                esGrupo: true
                grupoPagoId: string
                ids: string[]
                proveedor: string
                cuit: string
                montoTotal: number
                fecha: string
                cuentaContable: string
                cantFacturas: number
              }
              type IndividualRow = { esGrupo: false; factura: FacturaArca }
              type DisplayRow = IndividualRow | GrupoRow

              const grupoMap = new Map<string, FacturaArca[]>()
              const individuales: FacturaArca[] = []
              for (const f of facturas) {
                if (f.grupo_pago_id) {
                  if (!grupoMap.has(f.grupo_pago_id)) grupoMap.set(f.grupo_pago_id, [])
                  grupoMap.get(f.grupo_pago_id)!.push(f)
                } else {
                  individuales.push(f)
                }
              }

              const rows: DisplayRow[] = [
                ...individuales.map(f => ({ esGrupo: false as const, factura: f })),
                ...Array.from(grupoMap.entries()).map(([grupoId, facs]) => ({
                  esGrupo: true as const,
                  grupoPagoId: grupoId,
                  ids: facs.map(f => f.id),
                  proveedor: facs[0].denominacion_emisor,
                  cuit: facs[0].cuit,
                  montoTotal: facs.reduce((sum, f) => sum + (f.monto_a_abonar || f.imp_total || 0) * (f.tc_pago ?? f.tipo_cambio ?? 1), 0),
                  fecha: [...facs.map(f => f.fecha_vencimiento || f.fecha_estimada || '')].sort().reverse()[0] || '',
                  cuentaContable: facs[0].cuenta_contable || '-',
                  cantFacturas: facs.length
                }))
              ]
              rows.sort((a, b) => {
                const fa = a.esGrupo ? a.fecha : (a.factura.fecha_vencimiento || a.factura.fecha_estimada || '')
                const fb = b.esGrupo ? b.fecha : (b.factura.fecha_vencimiento || b.factura.fecha_estimada || '')
                return fa.localeCompare(fb)
              })

              const toggleGroup = (ids: string[], checked: boolean) => {
                setFacturasSeleccionadasPagos(prev => {
                  const next = new Set(prev)
                  for (const id of ids) {
                    if (checked) next.add(id)
                    else next.delete(id)
                  }
                  return next
                })
              }
              const isGroupChecked = (ids: string[]) => ids.length > 0 && ids.every(id => facturasSeleccionadasPagos.has(id))

              const seleccionadasEnEsteBloque = Array.from(facturasSeleccionadasPagos).filter(id => facturas.some(f => f.id === id)).length

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{titulo} ({rows.length})</h3>
                    <div className="flex items-center gap-2">
                      {accionBoton && facturasSeleccionadasPagos.size > 0 && facturas.some(f => facturasSeleccionadasPagos.has(f.id)) && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => cambiarEstadoSeleccionadas(accionBoton.estado)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {accionBoton.label} ({seleccionadasEnEsteBloque})
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEcheqForm({ banco: '', numero: '', fechaEmision: new Date().toISOString().split('T')[0], fechaCobro: '' })
                              setEcheqEstadoDestino(accionBoton.estado)
                              setMostrarModalEcheq(true)
                            }}
                            className="border-amber-500 text-amber-700 hover:bg-amber-50"
                            title="Pagar con ECHEQ"
                          >
                            📝 ECHEQ ({seleccionadasEnEsteBloque})
                          </Button>
                        </>
                      )}
                      {accionSecundaria && facturasSeleccionadasPagos.size > 0 && facturas.some(f => facturasSeleccionadasPagos.has(f.id)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cambiarEstadoSeleccionadas(accionSecundaria.estado)}
                          className="border-green-500 text-green-700 hover:bg-green-50"
                        >
                          {accionSecundaria.label} ({seleccionadasEnEsteBloque})
                        </Button>
                      )}
                      {puedeAgrupar && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={agruparPagos}
                          className="border-purple-500 text-purple-700 hover:bg-purple-50"
                          title="Agrupar en un solo pago"
                        >
                          🔗 Agrupar ({seleccionadasEnPagar.length})
                        </Button>
                      )}
                      {puedeDesagrupar && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={desagruparPago}
                          className="border-orange-500 text-orange-700 hover:bg-orange-50"
                          title="Desagrupar pagos"
                        >
                          🔓 Desagrupar
                        </Button>
                      )}
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </Badge>
                    </div>
                  </div>

                  {rows.length === 0 ? (
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
                          {rows.map(row => {
                            if (row.esGrupo) {
                              const checked = isGroupChecked(row.ids)
                              const facsGrupo = grupoMap.get(row.grupoPagoId) || []
                              return (
                                <TableRow key={row.grupoPagoId} className="bg-purple-50 hover:bg-purple-100">
                                  {mostrarCheckbox && (
                                    <TableCell>
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(c) => toggleGroup(row.ids, !!c)}
                                      />
                                    </TableCell>
                                  )}
                                  <TableCell>{row.fecha || '-'}</TableCell>
                                  <TableCell className="max-w-[200px] truncate">
                                    <span className="font-medium">{row.proveedor}</span>
                                    <span className="ml-2 text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-semibold">
                                      🔗 {row.cantFacturas} FC
                                    </span>
                                  </TableCell>
                                  <TableCell>{row.cuit}</TableCell>
                                  <TableCell className="max-w-[150px] truncate">{row.cuentaContable}</TableCell>
                                  <TableCell className="text-right font-bold text-purple-700">
                                    ${row.montoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm" variant="ghost"
                                      title="Generar PDF detalle de pago"
                                      onClick={() => generarPDFDetallePago(
                                        'arca', row.proveedor, row.cuit,
                                        facsGrupo.map(f => {
                                          const tc = f.tc_pago ?? f.tipo_cambio ?? 1
                                          return {
                                            comprobante: `FC ${f.tipo_comprobante}-${String(f.punto_venta || 0).padStart(5,'0')}-${String(f.numero_desde || 0).padStart(8,'0')}`,
                                            fecha: f.fecha_emision || '',
                                            imp_total: (f.imp_total || 0) * tc,
                                            monto_sicore: f.monto_sicore,
                                            descuento_aplicado: f.descuento_aplicado,
                                            monto_a_abonar: (f.monto_a_abonar ?? f.imp_total ?? 0) * tc,
                                          }
                                        })
                                      )}
                                    >📄</Button>
                                  </TableCell>
                                </TableRow>
                              )
                            } else {
                              const f = row.factura
                              return (
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
                                    {(() => {
                                      const tc = f.tc_pago ?? f.tipo_cambio ?? 1
                                      const esUSD = f.moneda === 'USD' || tc > 1.01
                                      const montoPesos = (f.monto_a_abonar || f.imp_total || 0) * tc
                                      return (
                                        <span className={esUSD ? 'text-amber-700' : ''}>
                                          {esUSD && (
                                            <span
                                              className="text-xs mr-1 cursor-pointer hover:opacity-70"
                                              title={f.tc_pago ? `TC pago: $${Number(f.tc_pago).toLocaleString('es-AR')} — click para editar` : 'Click para asignar TC de pago'}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setModalTcPagoPagos({ factura: f })
                                                setTcPagoInputPagos(f.tc_pago ? String(f.tc_pago).replace('.', ',') : '')
                                              }}
                                            >💵</span>
                                          )}
                                          ${montoPesos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                      )
                                    })()}
                                  </TableCell>
                                  {estadoActual !== 'pendiente' && (
                                    <TableCell>
                                      <Button
                                        size="sm" variant="ghost"
                                        title="Generar PDF detalle de pago"
                                        onClick={() => {
                                          const tc = f.tc_pago ?? f.tipo_cambio ?? 1
                                          generarPDFDetallePago(
                                            'arca', f.denominacion_emisor, f.cuit,
                                            [{
                                              comprobante: `FC ${f.tipo_comprobante}-${String(f.punto_venta || 0).padStart(5,'0')}-${String(f.numero_desde || 0).padStart(8,'0')}`,
                                              fecha: f.fecha_emision || '',
                                              imp_total: (f.imp_total || 0) * tc,
                                              monto_sicore: f.monto_sicore,
                                              descuento_aplicado: f.descuento_aplicado,
                                              monto_a_abonar: (f.monto_a_abonar ?? f.imp_total ?? 0) * tc,
                                            }]
                                          )
                                        }}
                                      >📄</Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              )
                            }
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )
            }

            // Función para cambiar estado de templates seleccionados
            const cambiarEstadoTemplatesSeleccionados = async (nuevoEstado: string) => {
              if (templatesSeleccionadosPagos.size === 0) {
                alert('Selecciona al menos un template')
                return
              }
              const ids = Array.from(templatesSeleccionadosPagos)
              const confirmar = window.confirm(`¿Cambiar ${ids.length} template(s) a estado "${nuevoEstado}"?`)
              if (!confirmar) return
              try {
                const { error } = await supabase
                  .from('cuotas_egresos_sin_factura')
                  .update({ estado: nuevoEstado })
                  .in('id', ids)
                if (error) throw error
                setTemplatesPagos(prev => prev.map(t =>
                  ids.includes(t.id) ? { ...t, estado: nuevoEstado } : t
                ))
                setTemplatesSeleccionadosPagos(new Set())
              } catch (error) {
                console.error('Error cambiando estado templates:', error)
                alert('Error al cambiar estado')
              }
            }

            // Función para cambiar estado de anticipos seleccionados
            const cambiarEstadoAnticiposSeleccionados = async (nuevoEstado: string) => {
              if (anticiposSeleccionadosPagos.size === 0) {
                alert('Selecciona al menos un anticipo')
                return
              }
              const ids = Array.from(anticiposSeleccionadosPagos)

              // "pagar" → delegar a cambiarEstadoAnticipoPago para que active SICORE
              if (nuevoEstado === 'pagar') {
                const seleccionados = anticiposPagos.filter(a => ids.includes(a.id))
                setAnticiposSeleccionadosPagos(new Set())
                for (const anticipo of seleccionados) {
                  await cambiarEstadoAnticipoPago(anticipo, 'pagar')
                }
                return
              }

              const confirmar = window.confirm(`¿Cambiar ${ids.length} anticipo(s) a estado "${nuevoEstado}"?`)
              if (!confirmar) return
              try {
                const { error } = await supabase
                  .from('anticipos_proveedores')
                  .update({ estado_pago: nuevoEstado })
                  .in('id', ids)
                if (error) throw error
                await recargarAnticiposPagos()
                setAnticiposSeleccionadosPagos(new Set())
              } catch (err) {
                console.error('Error cambiando estado anticipos:', err)
                toast.error('Error al cambiar estado: ' + (err as Error).message)
              }
            }

            // Función para renderizar tabla de templates
            const renderTablaTemplates = (templates: any[], titulo: string, subtotal: number, mostrarCheckbox: boolean = true, accionBoton?: { label: string, estado: string }, accionSecundaria?: { label: string, estado: string }, estadoActual: string = 'pendiente') => {
              // Colapsar templates agrupados: una sola fila por grupo
              type GrupoTRow = {
                esGrupo: true; grupoPagoId: string; ids: string[]
                proveedor: string; referencia: string; categ: string
                montoTotal: number; fecha: string; cantTemplates: number
              }
              type IndivTRow = { esGrupo: false; t: any }
              type DisplayTRow = IndivTRow | GrupoTRow

              const grupoTMap = new Map<string, any[]>()
              const individualesT: any[] = []
              for (const t of templates) {
                if (t.grupo_pago_id) {
                  if (!grupoTMap.has(t.grupo_pago_id)) grupoTMap.set(t.grupo_pago_id, [])
                  grupoTMap.get(t.grupo_pago_id)!.push(t)
                } else {
                  individualesT.push(t)
                }
              }

              const tRows: DisplayTRow[] = [
                ...individualesT.map(t => ({ esGrupo: false as const, t })),
                ...Array.from(grupoTMap.entries()).map(([grupoId, ts]) => ({
                  esGrupo: true as const,
                  grupoPagoId: grupoId,
                  ids: ts.map(t => t.id),
                  proveedor: ts[0].egreso?.nombre_quien_cobra || ts[0].egreso?.proveedor || '-',
                  referencia: ts[0].egreso?.categ || '-',
                  categ: ts[0].egreso?.categ || '-',
                  montoTotal: ts.reduce((s: number, t: any) => s + (t.monto || 0), 0),
                  fecha: [...ts.map((t: any) => t.fecha_vencimiento || t.fecha_estimada || '')].sort().reverse()[0] || '',
                  cantTemplates: ts.length,
                }))
              ]
              tRows.sort((a, b) => {
                const fa = a.esGrupo ? a.fecha : (a.t.fecha_vencimiento || a.t.fecha_estimada || '9999-12-31')
                const fb = b.esGrupo ? b.fecha : (b.t.fecha_vencimiento || b.t.fecha_estimada || '9999-12-31')
                return fa.localeCompare(fb)
              })

              const toggleTGroup = (ids: string[], checked: boolean) => {
                setTemplatesSeleccionadosPagos(prev => {
                  const next = new Set(prev)
                  for (const id of ids) { if (checked) next.add(id); else next.delete(id) }
                  return next
                })
              }
              const isTGroupChecked = (ids: string[]) => ids.length > 0 && ids.every(id => templatesSeleccionadosPagos.has(id))
              const seleccionadasEnEsteBloque = Array.from(templatesSeleccionadosPagos).filter(id => templates.some(t => t.id === id)).length

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700">Template</Badge>
                      {titulo} ({tRows.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      {accionBoton && templatesSeleccionadosPagos.size > 0 && templates.some(t => templatesSeleccionadosPagos.has(t.id)) && (
                        <Button size="sm" onClick={() => cambiarEstadoTemplatesSeleccionados(accionBoton.estado)} className="bg-blue-600 hover:bg-blue-700">
                          {accionBoton.label} ({seleccionadasEnEsteBloque})
                        </Button>
                      )}
                      {accionSecundaria && templatesSeleccionadosPagos.size > 0 && templates.some(t => templatesSeleccionadosPagos.has(t.id)) && (
                        <Button size="sm" variant="outline" onClick={() => cambiarEstadoTemplatesSeleccionados(accionSecundaria.estado)} className="border-green-500 text-green-700 hover:bg-green-50">
                          {accionSecundaria.label} ({seleccionadasEnEsteBloque})
                        </Button>
                      )}
                      {puedeAgruparTemplates && (
                        <Button size="sm" variant="outline" onClick={agruparTemplates} className="border-purple-500 text-purple-700 hover:bg-purple-50" title="Agrupar en un solo pago">
                          🔗 Agrupar ({seleccionadasTemplatesActivas.length})
                        </Button>
                      )}
                      {puedeDesagruparTemplates && (
                        <Button size="sm" variant="outline" onClick={desagruparTemplates} className="border-orange-500 text-orange-700 hover:bg-orange-50" title="Desagrupar">
                          🔓 Desagrupar
                        </Button>
                      )}
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </Badge>
                    </div>
                  </div>

                  {tRows.length === 0 ? (
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
                          {tRows.map(row => {
                            if (row.esGrupo) {
                              const checked = isTGroupChecked(row.ids)
                              const tsGrupo = grupoTMap.get(row.grupoPagoId) || []
                              return (
                                <TableRow key={row.grupoPagoId} className="bg-purple-50 hover:bg-purple-100">
                                  {mostrarCheckbox && (
                                    <TableCell>
                                      <Checkbox checked={checked} onCheckedChange={(c) => toggleTGroup(row.ids, !!c)} />
                                    </TableCell>
                                  )}
                                  <TableCell>{row.fecha || '-'}</TableCell>
                                  <TableCell className="max-w-[150px] truncate">
                                    <span className="font-medium">{row.proveedor}</span>
                                    <span className="ml-2 text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-semibold">
                                      🔗 {row.cantTemplates} items
                                    </span>
                                  </TableCell>
                                  <TableCell className="max-w-[150px] truncate">{row.proveedor}</TableCell>
                                  <TableCell className="max-w-[100px] truncate">{row.categ}</TableCell>
                                  <TableCell className="text-right font-bold text-purple-700">
                                    ${row.montoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm" variant="ghost"
                                      title="Generar PDF detalle de pago"
                                      onClick={() => generarPDFDetallePago(
                                        'template', row.proveedor,
                                        tsGrupo[0]?.egreso?.cuit_quien_cobra || '',
                                        tsGrupo.map(t => ({
                                          comprobante: t.egreso?.nombre_referencia || t.descripcion || '-',
                                          fecha: t.fecha_vencimiento || t.fecha_estimada || '',
                                          imp_total: t.monto || 0,
                                          monto_a_abonar: t.monto || 0,
                                        }))
                                      )}
                                    >📄</Button>
                                  </TableCell>
                                </TableRow>
                              )
                            } else {
                              const t = row.t
                              return (
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
                                  {estadoActual !== 'pendiente' && (
                                    <TableCell>
                                      <Button
                                        size="sm" variant="ghost"
                                        title="Generar PDF detalle de pago"
                                        onClick={() => generarPDFDetallePago(
                                          'template',
                                          t.egreso?.nombre_quien_cobra || '-',
                                          t.egreso?.cuit_quien_cobra || '',
                                          [{
                                            comprobante: t.egreso?.nombre_referencia || t.descripcion || '-',
                                            fecha: t.fecha_vencimiento || t.fecha_estimada || '',
                                            imp_total: t.monto || 0,
                                            monto_a_abonar: t.monto || 0,
                                          }]
                                        )}
                                      >📄</Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              )
                            }
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )
            }

            // Búsqueda para templates
            const matchTemplate = (t: any) => {
              if (!filtroBusquedaPagos.trim()) return true
              const q = filtroBusquedaPagos.toLowerCase()
              return [
                t.egreso?.nombre_referencia,
                t.descripcion,
                t.egreso?.nombre_quien_cobra,
                t.egreso?.categ,
                t.egreso?.centro_costo,
                String(t.monto ?? ''),
                t.fecha_vencimiento,
                t.fecha_estimada,
              ].some(v => v && String(v).toLowerCase().includes(q))
            }

            // Búsqueda para anticipos
            const matchAnticipo = (a: any) => {
              if (!filtroBusquedaPagos.trim()) return true
              const q = filtroBusquedaPagos.toLowerCase()
              return [
                a.descripcion,
                a.nombre_proveedor,
                a.cuit_proveedor,
                String(a.monto ?? ''),
                a.fecha_pago,
              ].some(v => v && String(v).toLowerCase().includes(q))
            }

            const ordenarTemplatesPorFecha = (lista: any[]) =>
              [...lista].sort((a, b) => {
                const fa = a.fecha_vencimiento || a.fecha_estimada || '9999-12-31'
                const fb = b.fecha_vencimiento || b.fecha_estimada || '9999-12-31'
                return fa.localeCompare(fb)
              })

            // Filtrar templates por estado + búsqueda + ordenar por fecha
            const templatesPreparado = ordenarTemplatesPorFecha(templatesPagos.filter(t => t.estado === 'preparado' && matchTemplate(t)))
            const templatesPagar = ordenarTemplatesPorFecha(templatesPagos.filter(t => t.estado === 'pagar' && matchTemplate(t)))
            const templatesPendiente = ordenarTemplatesPorFecha(templatesPagos.filter(t => t.estado === 'pendiente' && matchTemplate(t)))

            // Calcular subtotales templates
            const subtotalTemplatesPreparado = templatesPreparado.reduce((sum, t) => sum + (t.monto || 0), 0)
            const subtotalTemplatesPagar = templatesPagar.reduce((sum, t) => sum + (t.monto || 0), 0)
            const subtotalTemplatesPendiente = templatesPendiente.reduce((sum, t) => sum + (t.monto || 0), 0)

            // Anticipos filtrados por estado + búsqueda
            const anticiposPagar = anticiposPagos.filter(a => a.estado_pago === 'pagar' && matchAnticipo(a))
            const anticiposPreparado = anticiposPagos.filter(a => a.estado_pago === 'preparado' && matchAnticipo(a))
            const anticiposPendiente = anticiposPagos.filter(a => a.estado_pago === 'pendiente' && matchAnticipo(a))
            const montoNetoAnticipo = (a: any) => (a.monto || 0) - (a.monto_sicore || 0)
            const subtotalAnticiposPagar = anticiposPagar.reduce((s, a) => s + montoNetoAnticipo(a), 0)
            const subtotalAnticiposPreparado = anticiposPreparado.reduce((s, a) => s + montoNetoAnticipo(a), 0)
            const subtotalAnticiposPendiente = anticiposPendiente.reduce((s, a) => s + montoNetoAnticipo(a), 0)

            const renderTablaAnticipos = (lista: any[], titulo: string, subtotal: number, mostrarCheckbox: boolean = true, accionBoton?: { label: string, estado: string }, accionSecundaria?: { label: string, estado: string }) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Badge variant="outline" className="bg-purple-50 text-purple-700">Anticipo</Badge>
                    {titulo} ({lista.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    {accionBoton && anticiposSeleccionadosPagos.size > 0 && lista.some(a => anticiposSeleccionadosPagos.has(a.id)) && (
                      <Button
                        size="sm"
                        onClick={() => cambiarEstadoAnticiposSeleccionados(accionBoton.estado)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {accionBoton.label} ({Array.from(anticiposSeleccionadosPagos).filter(id => lista.some(a => a.id === id)).length})
                      </Button>
                    )}
                    {accionSecundaria && anticiposSeleccionadosPagos.size > 0 && lista.some(a => anticiposSeleccionadosPagos.has(a.id)) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cambiarEstadoAnticiposSeleccionados(accionSecundaria.estado)}
                        className="border-green-500 text-green-700 hover:bg-green-50"
                      >
                        {accionSecundaria.label} ({Array.from(anticiposSeleccionadosPagos).filter(id => lista.some(a => a.id === id)).length})
                      </Button>
                    )}
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                </div>

                {lista.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-2">No hay anticipos en este estado</p>
                ) : (
                  <div className="border rounded-md max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-white border-b">
                        <TableRow>
                          {mostrarCheckbox && <TableHead className="w-10"></TableHead>}
                          <TableHead>Fecha Pago</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>CUIT</TableHead>
                          <TableHead className="text-right">A Pagar</TableHead>
                          <TableHead>SICORE</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lista.map(a => (
                          <TableRow key={a.id} className="hover:bg-muted/50">
                            {mostrarCheckbox && (
                              <TableCell>
                                <Checkbox
                                  checked={anticiposSeleccionadosPagos.has(a.id)}
                                  onCheckedChange={(checked) => {
                                    setAnticiposSeleccionadosPagos(prev => {
                                      const next = new Set(prev)
                                      if (checked) next.add(a.id)
                                      else next.delete(a.id)
                                      return next
                                    })
                                  }}
                                />
                              </TableCell>
                            )}
                            <TableCell>{a.fecha_pago ? new Date(a.fecha_pago + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{a.descripcion || '-'}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{a.nombre_proveedor}</TableCell>
                            <TableCell>{a.cuit_proveedor}</TableCell>
                            <TableCell className="text-right font-medium">
                              ${montoNetoAnticipo(a).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              {a.monto_sicore > 0 && (
                                <div className="text-xs text-gray-400 font-normal">orig ${(a.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                              )}
                            </TableCell>
                            <TableCell>{a.sicore ? <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{a.sicore}</span> : <span className="text-gray-400">—</span>}</TableCell>
                            <TableCell>
                              <button
                                onClick={() => eliminarAnticipo(a)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                                title="Eliminar anticipo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )

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
                  // ADMIN: Preparado > Pagar > Pendiente, cada estado muestra Anticipo + ARCA + Template
                  <>
                    {filtrosPagos.preparado && (
                      <>
                        {filtroOrigenPagos.anticipo && renderTablaAnticipos(
                          anticiposPreparado,
                          '✅ Preparado',
                          subtotalAnticiposPreparado,
                          true,
                          { label: 'Marcar como Programado', estado: 'programado' },
                          { label: 'Marcar como Pagado', estado: 'pagado' }
                        )}
                        {filtroOrigenPagos.arca && renderTablaFacturas(
                          facturasPreparado,
                          '✅ ARCA Preparado',
                          subtotalPreparado,
                          'preparado',
                          true,
                          { label: 'Marcar como Programado', estado: 'programado' },
                          { label: 'Marcar como Pagado', estado: 'pagado' }
                        )}
                        {filtroOrigenPagos.template && renderTablaTemplates(
                          templatesPreparado,
                          '✅ Preparado',
                          subtotalTemplatesPreparado,
                          true,
                          { label: 'Marcar como Programado', estado: 'programado' },
                          { label: 'Marcar como Pagado', estado: 'pagado' },
                          'preparado'
                        )}
                      </>
                    )}
                    {filtrosPagos.pagar && (
                      <>
                        {filtroOrigenPagos.anticipo && renderTablaAnticipos(
                          anticiposPagar,
                          '📋 Pagar',
                          subtotalAnticiposPagar,
                          true,
                          { label: 'Marcar como Preparado', estado: 'preparado' }
                        )}
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
                          true,
                          { label: 'Marcar como Preparado', estado: 'preparado' },
                          undefined,
                          'pagar'
                        )}
                      </>
                    )}
                    {filtrosPagos.pendiente && (
                      <>
                        {filtroOrigenPagos.anticipo && renderTablaAnticipos(
                          anticiposPendiente,
                          '⏳ Pendiente',
                          subtotalAnticiposPendiente,
                          true,
                          { label: 'Marcar como Pagar', estado: 'pagar' }
                        )}
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
                          true,
                          { label: 'Marcar como Pagar', estado: 'pagar' },
                          undefined,
                          'pendiente'
                        )}
                      </>
                    )}
                  </>
                ) : (
                  // ULISES (contable): Pagar > Preparado, cada estado muestra Anticipo + ARCA + Template
                  <>
                    {filtroOrigenPagos.anticipo && renderTablaAnticipos(
                      anticiposPagar,
                      '📋 Pagar',
                      subtotalAnticiposPagar,
                      false
                    )}
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
                      true,
                      { label: 'Marcar como Preparado', estado: 'preparado' },
                      undefined,
                      'pagar'
                    )}
                    {filtroOrigenPagos.anticipo && renderTablaAnticipos(
                      anticiposPreparado,
                      '✅ Preparado',
                      subtotalAnticiposPreparado,
                      false
                    )}
                    {filtroOrigenPagos.arca && renderTablaFacturas(
                      facturasPreparado,
                      '✅ ARCA Preparado',
                      subtotalPreparado,
                      'preparado',
                      false
                    )}
                    {filtroOrigenPagos.template && renderTablaTemplates(
                      templatesPreparado,
                      '✅ Preparado',
                      subtotalTemplatesPreparado,
                      false,
                      undefined,
                      undefined,
                      'preparado'
                    )}
                  </>
                )}

                {/* Total general */}
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      {[filtroOrigenPagos.anticipo && 'Anticipos', filtroOrigenPagos.arca && 'ARCA', filtroOrigenPagos.template && 'Templates'].filter(Boolean).join(' + ') || 'Sin datos'}
                    </div>
                    <Badge className="text-xl px-4 py-2 bg-green-600">
                      Total General: ${(
                        (filtroOrigenPagos.anticipo ? subtotalAnticiposPagar + subtotalAnticiposPreparado + (esAdmin ? subtotalAnticiposPendiente : 0) : 0) +
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

      {/* Modal ECHEQ */}
      <Dialog open={mostrarModalEcheq} onOpenChange={setMostrarModalEcheq}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>📝 Pago con ECHEQ</DialogTitle>
            <DialogDescription>Completar datos del cheque electrónico</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium block mb-1">Banco emisor *</label>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={echeqForm.banco}
                onChange={e => setEcheqForm(prev => ({ ...prev, banco: e.target.value }))}
              >
                <option value="">Seleccionar banco...</option>
                {['Banco Galicia', 'Banco Santander', 'Banco Nación', 'Banco Provincia', 'BBVA', 'Banco HSBC',
                  'Banco Macro', 'Banco ICBC', 'Banco Ciudad', 'Banco Comafi', 'Banco Supervielle',
                  'Banco Patagonia', 'Banco Credicoop', 'Banco Industrial', 'Otro'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Número de ECHEQ</label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="Ej: 000012345"
                value={echeqForm.numero}
                onChange={e => setEcheqForm(prev => ({ ...prev, numero: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Fecha de emisión *</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={echeqForm.fechaEmision}
                onChange={e => setEcheqForm(prev => ({ ...prev, fechaEmision: e.target.value }))}
              />
              {echeqForm.fechaEmision && (
                <p className="text-xs text-blue-600 mt-1">
                  → Quincena SICORE: {(() => {
                    const [a, m, d] = echeqForm.fechaEmision.split('-')
                    return `${a.slice(-2)}-${m} - ${parseInt(d) <= 15 ? '1ra' : '2da'}`
                  })()}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Fecha de cobro *</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={echeqForm.fechaCobro}
                onChange={e => setEcheqForm(prev => ({ ...prev, fechaCobro: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setMostrarModalEcheq(false)
              echeqPendienteRef.current = null
              setEcheqPendiente(null)
            }}>
              Cancelar
            </Button>
            <Button
              disabled={!echeqForm.banco || !echeqForm.fechaEmision || !echeqForm.fechaCobro}
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                const datos = { ...echeqForm }
                echeqPendienteRef.current = datos
                setEcheqPendiente(datos)
                setMostrarModalEcheq(false)
                cambiarEstadoSeleccionadasRef.current?.(echeqEstadoDestino, datos.fechaEmision)
              }}
            >
              Confirmar ECHEQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal SICORE para anticipos (desde Vista de Pagos) */}
      <Dialog open={mostrarModalSicoreAnt} onOpenChange={(open) => { if (!open) { setMostrarModalSicoreAnt(false); setAnticipoSicoreEnProceso(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🏛️ Retención SICORE — Anticipo</DialogTitle>
            <DialogDescription>
              {anticipoSicoreEnProceso && (
                <span>{anticipoSicoreEnProceso.nombre_proveedor} · Monto: ${(anticipoSicoreEnProceso.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {pasoSicoreAnt === 'montos' && anticipoSicoreEnProceso && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Ingresá el desglose de la factura correspondiente:</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-700 block mb-1">Neto Gravado *</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                    value={netoGravadoAnt}
                    onChange={e => setNetoGravadoAnt(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Neto No Gravado</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                    value={netoNoGravadoAnt}
                    onChange={e => setNetoNoGravadoAnt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Exento</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                    value={exentoAnt}
                    onChange={e => setExentoAnt(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-700 block mb-1">IVA</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                    value={ivaAnt}
                    onChange={e => setIvaAnt(e.target.value)}
                  />
                </div>
              </div>
              <div className="bg-gray-50 rounded p-2 text-xs text-gray-500">
                El SICORE se calcula sobre el <strong>Neto Gravado</strong>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={!netoGravadoAnt.trim()}
                  onClick={() => setPasoSicoreAnt('tipo')}
                >
                  Siguiente → Tipo de operación
                </Button>
                <Button variant="outline" onClick={() => {
                  if (anticipoSicoreEnProceso) {
                    supabase.from('anticipos_proveedores').update({ estado_pago: 'pagar' }).eq('id', anticipoSicoreEnProceso.id)
                      .then(({ error }) => {
                        if (!error) { toast.success('Anticipo → pagar (sin SICORE)'); recargarAnticiposPagos() }
                      })
                  }
                  setMostrarModalSicoreAnt(false)
                  setAnticipoSicoreEnProceso(null)
                }}>
                  Sin SICORE
                </Button>
                <Button variant="outline" onClick={() => { setMostrarModalSicoreAnt(false); setAnticipoSicoreEnProceso(null) }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {pasoSicoreAnt === 'tipo' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs flex justify-between">
                <span className="text-gray-600">Neto gravado:</span>
                <span className="font-semibold">${(parseFloat(netoGravadoAnt.replace(/\./g, '').replace(',', '.')) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-sm text-gray-600">Seleccioná el tipo de operación:</p>
              <div className="grid grid-cols-2 gap-2">
                {tiposSicore.map(tipo => (
                  <Button
                    key={tipo.tipo}
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-start text-left"
                    onClick={() => calcularSicoreAnt(tipo)}
                  >
                    <span className="font-semibold text-sm">{tipo.tipo}</span>
                    <span className="text-xs text-gray-500">{(tipo.porcentaje_retencion * 100).toFixed(2)}% · mín ${tipo.minimo_no_imponible.toLocaleString('es-AR')}</span>
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPasoSicoreAnt('montos')}>← Montos</Button>
                <Button variant="outline" className="flex-1" onClick={() => {
                  // Continuar sin SICORE: solo cambiar estado
                  if (anticipoSicoreEnProceso) {
                    supabase.from('anticipos_proveedores').update({ estado_pago: 'pagar' }).eq('id', anticipoSicoreEnProceso.id)
                      .then(({ error }) => {
                        if (!error) { toast.success('Anticipo → pagar (sin SICORE)'); recargarAnticiposPagos() }
                      })
                  }
                  setMostrarModalSicoreAnt(false)
                  setAnticipoSicoreEnProceso(null)
                }}>
                  Continuar sin SICORE
                </Button>
              </div>
            </div>
          )}

          {pasoSicoreAnt === 'calculo' && tipoSicoreAnt && datosSicoreAnt && anticipoSicoreEnProceso && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Monto anticipo:</span><span className="font-medium">${(anticipoSicoreEnProceso.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Neto gravado:</span><span>${(parseFloat(netoGravadoAnt.replace(/\./g, '').replace(',', '.')) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                {!datosSicoreAnt.esAdicional && <div className="flex justify-between"><span className="text-gray-600">Mínimo no imponible:</span><span>-${datosSicoreAnt.minimoAplicado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>}
                <div className="flex justify-between"><span className="text-gray-600">Base imponible:</span><span>${datosSicoreAnt.baseImponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between font-semibold text-red-700 border-t pt-1 mt-1">
                  <span>{tipoSicoreAnt.tipo} {(tipoSicoreAnt.porcentaje_retencion * 100).toFixed(2)}%:</span>
                  <span>-${montoSicoreAnt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                {descuentoAnt > 0 && <div className="flex justify-between text-orange-700"><span>Descuento adicional:</span><span>-${descuentoAnt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>}
                <div className="flex justify-between font-bold text-green-700 border-t pt-1 mt-1">
                  <span>Saldo a pagar:</span>
                  <span>${((anticipoSicoreEnProceso.monto || 0) - montoSicoreAnt - descuentoAnt).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={confirmarSicoreAnt}
                >
                  ✅ Confirmar SICORE
                </Button>
                <Button variant="outline" onClick={() => setPasoSicoreAnt('tipo')}>← Tipo</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal TC de pago — Vista Pagos */}
      {modalTcPagoPagos && (
        <Dialog open={true} onOpenChange={() => { setModalTcPagoPagos(null); setColaUSDSinTC([]); setTcPagoInputPagos('') }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>💵 TC de pago</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-700 font-medium">
                {modalTcPagoPagos.factura.denominacion_emisor}
                {colaUSDSinTC.length > 0 && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">+{colaUSDSinTC.length} factura(s) más</span>
                )}
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs flex justify-between">
                <span className="text-gray-600">Total USD:</span>
                <span className="font-semibold">${(modalTcPagoPagos.factura.imp_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">TC de pago (pesos por dólar)</label>
                <Input
                  autoFocus
                  value={tcPagoInputPagos}
                  onChange={(e) => setTcPagoInputPagos(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') guardarTcPagoPagos()
                    if (e.key === 'Escape') { setModalTcPagoPagos(null); setColaUSDSinTC([]); setTcPagoInputPagos('') }
                  }}
                  placeholder="Ej: 1250"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={guardarTcPagoPagos}>
                  {colaUSDSinTC.length > 0 ? 'Guardar y siguiente' : 'Guardar TC'}
                </Button>
                <Button variant="outline" onClick={() => { setModalTcPagoPagos(null); setColaUSDSinTC([]); setTcPagoInputPagos('') }}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}