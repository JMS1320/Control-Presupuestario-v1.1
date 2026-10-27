"use client"


import { ModalVincularCompras } from "./modal-vincular-compras"
import { conversionDe } from "@/lib/pagos/moneda-factura"
import { toggleChip, esSoloEste, tituloChip } from "@/lib/ui/chips"
import { hoyArgentina } from "@/lib/fechas"
import { useState, useEffect, useRef } from "react"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { facturasRestringidas, type UserRole } from "@/lib/auth/roles"
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
import { TabsVivos, TabsContentVivo } from "@/components/ui/tabs-vivos"
import { esNotaCredito as esNotaCreditoArca } from "@/lib/pagos/notas-credito"
import { agruparEnCertificados } from "@/lib/sicore/clave-certificado"
import { tomarEncargoCancelacionNC, type EncargoCancelacionNC } from "@/lib/pagos/encargo-cancelacion-nc"
import { ModalCancelacionNC } from "@/components/modal-cancelacion-nc"
import { facturasConDescuentoParaNC, type DatosCancelacionNC } from "@/lib/pagos/cancelacion-nc"
// Icons importados para funcionalidad Excel import + UI
import { Loader2, Settings2, Receipt, Info, Eye, EyeOff, Filter, X, Edit3, Save, Check, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Calendar, RefreshCw, Trash2, MoreHorizontal, Search, Download, FileText, RotateCcw, BarChart3, Copy } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { encolarMailDetalle as encolarMailDetalleLib } from "@/lib/pagos/encolar-mail-detalle"
import { deduplicarFilasSicore } from "@/lib/sicore/dedup"
import { estadoArchivoDigital } from "@/lib/facturas/archivo-digital"
import { generarPDFDetallePago } from "@/lib/pagos/pdf-detalle-pago"
import { CategCombobox } from "@/components/ui/categ-combobox"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { CentroCostoCombobox } from "@/components/ui/centro-costo-combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCuentasContables } from "@/hooks/useCuentasContables"
import useInlineEditor, { type CeldaEnEdicion } from "@/hooks/useInlineEditor"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { normalizarBusqueda } from "@/lib/normalizar-texto"
import { VistaHistoricoFacturas } from "@/components/vista-historico-facturas"
import { VistaAsignacionArca } from "@/components/vista-asignacion-arca"
import { ModalReglasImport } from "@/components/modal-reglas-import"
import { NotificacionProgresoLote } from "@/components/gas-pdf/notificacion-progreso-lote"
import { ModalHistorialPdf } from "@/components/gas-pdf/modal-historial-pdf"
import { ModalConfigProveedor } from "@/components/gas-pdf/modal-config-proveedor"
import { ModalAuditarPeriodo } from "@/components/gas-pdf/modal-auditar-periodo"
import { buscarPdfLote, type ProgresoLote } from "@/lib/gas-pdf/client"
import { idsParaBuscarTrasImportar, opcionesFcManual, subdiarioDe, faltaComprobante, linkParaConfirmar, sePuedeConfirmarApp, ultimasBusquedas, type UltimaBusqueda, type FacturaParaCarpeta } from "@/lib/gas-pdf/lote"
import { estadoInventario, type EstadoInventario } from "@/lib/gas-pdf/barrido"
import { ModalPedirFacturas } from "@/components/gas-pdf/modal-pedir-facturas"
import { faltantesDelSubdiario } from "@/lib/gas-pdf/faltantes"
import { PanelFacturasSinPdf } from "@/components/gas-pdf/panel-facturas-sin-pdf"
import { PanelAConfirmar } from "@/components/gas-pdf/panel-a-confirmar"
import { diaArgentino } from "@/lib/fechas"
import { ESTADO_ASIENTO_CONTABLE, NOMBRE_ASIENTOS_CONTABLES, CAMBIO_A_ASIENTO_CONTABLE, CAMBIO_DESDE_ASIENTO_CONTABLE } from "@/lib/balance/asientos-contables"
import { colorFc, ayudaFc } from "@/lib/gas-pdf/estados-fc"
import { LeyendaEstadosFc } from "@/components/gas-pdf/leyenda-estados-fc"
import { ModalElegirCandidato } from "@/components/gas-pdf/modal-elegir-candidato"
import { InformeLote } from "@/components/gas-pdf/informe-lote"
import { historicoAFactura, filasDelSubdiario } from "@/lib/facturas/historico-como-factura"
import { ControlContraPresentado } from "@/components/control-contra-presentado"
import { verificarCuadratura, TIPOS_SIN_CREDITO_COMPRAS } from "@/lib/subdiarios/cuadratura"
import { calcularSubtotalesSubdiario as calcularSubtotalesSubdiarioLib } from "@/lib/subdiarios/subtotales"
import { elegirCarpetaDestino, generarNombreUnico as generarNombreUnicoLib, guardarEnCarpeta, LS_CARPETA_POR_DEFECTO } from "@/lib/subdiarios/carpeta-destino"
import { DATOS_FISCALES, cuitFormateado } from "@/lib/empresas"
import { ControlCuadraturaSubdiario } from "@/components/control-cuadratura-subdiario"
import { ModalArchivosArca } from "@/components/modal-archivos-arca"
import {
  estaProtegido, evaluarCambioDDJJ, confirmarDecision, consultarEstadoPeriodo, consultarEstadoDeLosMeses, type EstadoMes,
} from "@/lib/subdiarios/estado-ddjj"
import { EstadoMesesDDJJ } from "@/components/estado-meses-ddjj"
import { BotonRevision, useRevisionesDe } from "@/components/boton-revision"
import { Paperclip, Banknote } from "lucide-react"
import { ModalExportarLote } from "@/components/lotes-galicia/modal-exportar-lote"
import { coincidenciasDeNombre, fechaDelNombreCoincide, datosDelVinculo, subcarpetasDelMes } from "@/lib/facturas/vincular-archivo"
import { VEREDICTOS, etiquetaVeredicto, veredictoResuelve, coincideBusqueda, type Veredicto } from "@/lib/gas-pdf/veredicto"
import { ModalCargarDesdePdf, type ArchivoACargar } from "@/components/gas-pdf/modal-cargar-desde-pdf"
import type { ItemSeleccionado } from "@/lib/lotes-galicia/types"
import { quincenasDelMes } from "@/lib/sicore/quincena"   // A-BUG-193 — el minimo es MENSUAL
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { usePuedeVer, useNivelDeclarado } from "@/components/contexto-permisos"
import { Permisable } from "@/components/modo-permisos"
import { pedirAsignacionDeCuenta, mensajeDePropagacion, type RespuestaAsignacion } from "@/lib/conciliacion/asignar-cuenta-cliente"
import { contarMovimientosDeFactura, type ClienteParaPropagar } from "@/lib/conciliacion/propagar-cuenta"

interface FacturaArca {
  id: string
  /**
   * Visible para el rol contable (Ulises). La columna existe en las 3 empresas y la consulta la
   * trae porque hace `select('*')` — pero el tipo no la declaraba y se leía con `(f as any)`.
   * Declararla saca ese `as any`: si algún día la consulta pasa a lista explícita de columnas y se
   * la olvidan, el compilador avisa en vez de devolver `undefined` en silencio (auditoría A-OP-07).
   */
  visible_contable?: boolean | null
  fecha_emision: string
  tipo_comprobante: number
  tipo_comprobante_desc?: string | null
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
  fecha_pago: string | null
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
  // Origen de la factura
  origen_factura: string | null
  // Búsqueda automática de PDF (módulo GAS)
  pdf_drive_url?: string | null
  pdf_estado?: string | null
  pdf_ultimo_intento?: string | null
  pdf_observaciones?: string | null
}

// Monto a pagar en pesos (Vista Pagos). Fuente única usada por display, subtotales y PDF.
// ARS: usa monto_a_abonar (ya refleja SICORE, descuento y anticipos vinculados).
// USD: recalcula imp_total*tc − sicore − descuento (evita el doble redondeo de monto_a_abonar × TC).
function montoPagoEnPesos(f: FacturaArca): number {
  const tc = f.tc_pago ?? f.tipo_cambio ?? 1
  if (f.moneda === 'USD') {
    return (f.imp_total || 0) * tc - (f.monto_sicore || 0) - (f.descuento_aplicado || 0)
  }
  return f.monto_a_abonar ?? f.imp_total ?? 0
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
  origen_factura: { label: "Origen", visible: false, width: "120px" },
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
  fecha_pago: { label: "Fecha Pago", visible: true, width: "130px" },
  monto_a_abonar: { label: "Monto a Abonar", visible: true, width: "140px" },
  ddjj_iva: { label: "DDJJ IVA", visible: true, width: "100px" },
  medio_pago: { label: "Medio Pago", visible: false, width: "120px" },
  created_at: { label: "Created At", visible: false, width: "150px" }
} as const

function TablaRegistrosV2({ registros, onCertificado, mostrarAnulados = false }: { registros: any[], onCertificado?: (registros: any[]) => void, mostrarAnulados?: boolean }) {
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
  // Filas visibles según toggle; filas vigentes (no anuladas) para totales
  const filasVisibles = mostrarAnulados ? registros : registros.filter(r => !r.anulado)
  const vigentes = registros.filter(r => !r.anulado)
  const cantAnuladas = registros.length - vigentes.length
  const totRet   = vigentes.reduce((s, r) => s + (Number(r.retencion) || 0), 0)
  const totPago  = vigentes.reduce((s, r) => s + (Number(r.pago) || 0), 0)
  const totTotal = vigentes.reduce((s, r) => s + (Number(r.total_pagado) || 0), 0)
  const totBase  = vigentes.reduce((s, r) => s + (Number(r.base_imponible) || 0), 0)
  const totNeto  = vigentes.reduce((s, r) => s + (Number(r.neto_gravado_pagado) || 0), 0)

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
          {filasVisibles.map((r, i) => {
            const tachado = r.anulado ? 'line-through opacity-50' : ''
            const rowBg = r.anulado ? 'bg-gray-100' : (i % 2 === 0 ? 'bg-white' : 'bg-green-50/30')
            return (
            <tr key={r.id || i} className={rowBg}>
              <td className={`border border-green-100 px-2 py-1 ${tachado}`}>
                {r.anulado ? (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium bg-orange-200 text-orange-800"
                    title={`Anulado el ${r.fecha_anulacion ? new Date(r.fecha_anulacion).toLocaleString('es-AR') : '?'}\nMotivo: ${r.motivo_anulacion || '-'}`}
                  >
                    ANULADO
                  </span>
                ) : (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${origenColor[r.origen] || 'bg-gray-100 text-gray-700'}`}>
                    {r.origen || '-'}
                  </span>
                )}
              </td>
              <td className={`border border-green-100 px-2 py-1 ${tachado}`}>{r.tipo_sicore || '-'}</td>
              <td className={`border border-green-100 px-2 py-1 whitespace-nowrap ${tachado}`}>{fmtFecha(r.fecha_pago)}</td>
              <td className={`border border-green-100 px-2 py-1 whitespace-nowrap ${tachado}`}>{r.cuit_emisor || '-'}</td>
              <td className={`border border-green-100 px-2 py-1 max-w-[150px] truncate ${tachado}`} title={r.denominacion_emisor || ''}>{r.denominacion_emisor || '-'}</td>
              <td className={`border border-green-100 px-2 py-1 text-right ${tachado}`}>{fmt(r.neto_gravado_pagado)}</td>
              <td className={`border border-green-100 px-2 py-1 text-right ${tachado}`}>{fmt(r.total_pagado)}</td>
              <td className={`border border-green-100 px-2 py-1 text-right ${tachado}`}>{fmt(r.base_imponible)}</td>
              <td className={`border border-green-100 px-2 py-1 text-right ${tachado}`}>
                {r.alicuota != null ? `${(Number(r.alicuota) * 100).toFixed(2).replace(".", ",")}%` : '-'}
              </td>
              <td className={`border border-green-100 px-2 py-1 text-right font-medium text-red-700 ${tachado}`}>{fmt(r.retencion)}</td>
              <td className={`border border-green-100 px-2 py-1 text-right font-medium text-green-700 ${tachado}`}>{fmt(r.pago)}</td>
              {onCertificado && (
                <td className="border border-green-100 px-2 py-1 text-center">
                  {r.anulado ? (
                    <span className="text-gray-400 text-xs">—</span>
                  ) : (
                    <button
                      onClick={() => {
                        /**
                         * 🧾 **ACÁ SE VEÍA EL BUG** (A-BUG-1222). Este botón es el que el usuario
                         * aprieta para bajar el certificado de una fila.
                         *
                         * Antes juntaba todas las filas con el mismo `nro_certificado`. Y como el
                         * número se estaba reusando **por quincena** en vez de por pago, el
                         * certificado del pago de hoy salía **sumado al pago anterior**: BIOFARMA
                         * informaba $178.983,20 cuando el pago del 29/09 retuvo $69.213,15.
                         *
                         * 🔑 Se agrupa por el **número**, que es la identidad real del certificado
                         * —es lo que el proveedor recibió y lo que ARCA ve—, y que **ya está bien
                         * asignado** porque la corrección está en el registro, no acá. Los dos
                         * números repetidos que existían se renumeraron (A-DAT-64).
                         *
                         * 🧮 Y que sigan estando bien lo verifica un control aparte:
                         * `certificadosConVariosPagos`. Agrupar acá por la regla, en vez de por el
                         * número, escondería el problema en lugar de mostrarlo.
                         */
                        const mismoPago = registros.filter(
                          x => !x.anulado && r.nro_certificado && x.nro_certificado === r.nro_certificado,
                        )
                        onCertificado(mismoPago.length > 0 ? mismoPago : [r])
                      }}
                      title="Descargar Certificado de Retención"
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              )}
            </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-green-100 font-semibold sticky bottom-0">
          <tr>
            <td colSpan={5} className="border border-green-200 px-2 py-1.5 text-right text-xs">
              TOTALES — {vigentes.length} vigente{vigentes.length !== 1 ? 's' : ''}{cantAnuladas > 0 ? ` (+ ${cantAnuladas} anulado${cantAnuladas !== 1 ? 's' : ''} excluido${cantAnuladas !== 1 ? 's' : ''})` : ''}
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

// Resumen del subdiario en 2 bloques (compartido por el display en vivo y por el Excel/PDF → siempre iguales).
// La función se mudó a `lib/subdiarios/subtotales.ts` para que el Libro IVA VENTAS use la misma
// (antes tenía 3 copias propias del cálculo). Sigue devolviendo `.ivaCompras` / `.monotributo`.
const calcularSubtotalesSubdiario = (facturas: any[]) =>
  calcularSubtotalesSubdiarioLib(facturas, TIPOS_SIN_CREDITO_COMPRAS)

export function VistaFacturasArca({ empresa = 'MSA', userRole = 'admin' }: { empresa?: 'MSA' | 'PAM' | 'MA'; userRole?: UserRole } = {}) {
  // Modo restringido (lo que ve Ulises). Sólo admin tiene el modo completo — ver `facturasRestringidas`.
  const esContable = facturasRestringidas(userRole)
  const nivelDeclarado = useNivelDeclarado()
  // Las solapas y botones de Facturas que se pueden apagar desde Configuración → Roles (A-FEAT-1322,
  // etapa 1). Sin excepción cargada se ven, igual que antes: registrarlas no le cambia nada a nadie.
  const puedeVer = usePuedeVer()
  const schemaName = empresa === 'PAM' ? 'pam' : empresa === 'MA' ? 'ma' : 'msa'
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
  const [filtroTipoComprobante, setFiltroTipoComprobante] = useState('todos')
  const [montoMinimo, setMontoMinimo] = useState('')
  const [montoMaximo, setMontoMaximo] = useState('')
  const [busquedaCateg, setBusquedaCateg] = useState('')
  // Filtro por Estado FC (usuario 2026-10-20: «ver las de Portal solas, en cada subdiario»)
  const [filtroEstadoFc, setFiltroEstadoFc] = useState('todos')
  const [filtroFcPendiente, setFiltroFcPendiente] = useState(false)
  const [mostrarModalMarcarFC, setMostrarModalMarcarFC] = useState(false)
  const [linksAVincular, setLinksAVincular] = useState<Record<string, string>>({})

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
  /** El período abierto viene del histórico del contador: sólo consulta (A-FEAT-1382). */
  const periodoHistorico = facturasPeriodo.length > 0 && facturasPeriodo.every(f => f.estado === 'historico')
  const [facturasImputacion, setFacturasImputacion] = useState<FacturaArca[]>([])
  // 📒 «Asientos Contables» (A-FEAT-1318): la lista abierta (null = cerrada)
  const [asientosContables, setAsientosContables] = useState<FacturaArca[] | null>(null)
  const [subtotales, setSubtotales] = useState<any>(null)
  const [cargandoSubdiarios, setCargandoSubdiarios] = useState(false)
  
  // Estados para gestión masiva de facturas
  const [mostrarGestionMasiva, setMostrarGestionMasiva] = useState(false)
  // 📨 A-FEAT-1295: el estado de cada mes del subdiario (Imputado / Enviado / DDJJ OK).
  const [estadoMeses, setEstadoMeses] = useState<EstadoMes[] | null>([])
  const recargarMesesEnviados = () => {
    consultarEstadoDeLosMeses(supabase, schemaName, 'comprobantes_arca').then(setEstadoMeses)
  }
  useEffect(() => { recargarMesesEnviados() }, [schemaName]) // eslint-disable-line react-hooks/exhaustive-deps
  const [facturasSeleccionadasGestion, setFacturasSeleccionadasGestion] = useState<Set<string>>(new Set())
  const [nuevoEstadoDDJJ, setNuevoEstadoDDJJ] = useState('')
  
  // Estado para mostrar columnas detalladas en Subdiarios
  const [mostrarColumnasDetalladas, setMostrarColumnasDetalladas] = useState(false)
  // Subdiarios: filtro por estado de archivo digital (PDF). Chips 'con' / 'falta' / 'portal'.
  const [filtroArchivoPdf, setFiltroArchivoPdf] = useState<Set<'con' | 'falta' | 'portal'>>(new Set())
  // Categoría de archivo digital de una factura (para íconos, chips y filtro del subdiario).
  // 'con' = tiene PDF · 'portal' = sin PDF pero es de Portal (esperable) · 'falta' = sin PDF y debería tenerlo.
  //
  // 📌 La regla vive en `lib/facturas/archivo-digital.ts` desde A-FEAT-1185, porque el Cash Flow
  // ahora muestra lo mismo y no puede haber dos criterios (§ ♻️). Acá **sólo pueden salir estos
  // tres**: el helper devuelve además `sin-factura` y `grupo`, y ninguno aplica en el subdiario —
  // todas sus filas SON facturas sueltas, así que no manda `origen` ni `facturas_agrupadas`.
  const categoriaArchivo = (f: FacturaArca): 'con' | 'falta' | 'portal' =>
    estadoArchivoDigital(f) as 'con' | 'falta' | 'portal'
  /** 🔎 Dónde busca el buscador de Subdiarios en una factura. */
  const textosDeFactura = (f: FacturaArca): unknown[] => [
    f.denominacion_emisor, f.cuit, `${f.punto_venta}-${f.numero_desde}`, f.numero_desde, f.tipo_comprobante_desc,
    f.imp_total, (Number(f.imp_total) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    f.detalle, f.cuenta_contable,
  ]
  // Supervisión del archivo digital del período (corre la auditoría OCR en 2do plano, no bloquea).
  const [supervisandoArchivo, setSupervisandoArchivo] = useState(false)
  /**
   * ⏳ A-FEAT-1262 — mientras vincula, cerrar o recargar la pestaña del navegador SÍ corta el
   * proceso (corre acá, tanda por tanda). Cambiar de pantalla adentro de la app no lo corta.
   * El navegador pregunta antes de cerrar; es el único caso en que el proceso se pierde.
   */
  useEffect(() => {
    if (!supervisandoArchivo) return
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [supervisandoArchivo])

  /**
   * De qué botón salió el listado de "PDFs sin vincular".
   *
   * Importa porque el mismo panel significa dos cosas MUY distintas: si salió de «Contar», los
   * archivos están sin vincular porque **nadie los miró todavía**; si salió de «Vincular PDFs»,
   * están sin vincular porque **el contenido no matcheó**. El texto decía siempre lo segundo, y
   * eso hizo que un inventario normal se leyera como una falla del sistema (2026-09-03).
   */
  const [origenListado, setOrigenListado] = useState<'contar' | 'ocr' | null>(null)

  /**
   * 🚩 Marcas «para revisar» de las facturas de este período.
   *
   * Se cargan UNA vez por pantalla y no por fila: una grilla de 40 facturas dispararía 40 consultas
   * para pintar 40 banderitas que casi siempre están apagadas.
   */
  const { porRegistro: revisionesFactura, recargar: recargarRevisiones } = useRevisionesDe(schemaName, 'comprobantes_arca')
  // 📜 Las 🚩 de las filas del histórico (Subdiarios jul–nov, A-FEAT-1382) quedan ancladas a SU tabla.
  const { porRegistro: revisionesHistorico, recargar: recargarRevisionesHistorico } = useRevisionesDe(schemaName, 'comprobantes_historico')
  // PDFs de la carpeta que NO matchearon ninguna factura (huérfanos) — resultado de la última supervisión.
  const [huerfanosSupervision, setHuerfanosSupervision] = useState<{ archivo: string; url: string; chars?: number }[]>([])
  /**
   * 🔎 Buscador de Subdiarios (usuario 2026-10-22: «así yo busco rápido colomac»): filtra la tabla del
   * período y los PDF sin vincular — en éstos busca también en lo que dice el PDF, si ya se leyó.
   */
  const [buscarSubdiario, setBuscarSubdiario] = useState('')
  /**
   * 🗂️ Lo que el registro del archivo digital sabe de cada PDF sin vincular (clave = file_id): lo leído
   * y el VEREDICTO a mano (A-FEAT-1287, script 93). Sin el script 93 no hay veredicto, y el panel lo dice.
   */
  const [registroHuerfanos, setRegistroHuerfanos] = useState<Record<string, {
    file_id: string; estado?: string; texto?: string | null
    veredicto?: string | null; veredicto_nota?: string | null; veredicto_at?: string | null; veredicto_por?: string | null
  }>>({})
  const [veredictoDisponible, setVeredictoDisponible] = useState(true)
  const [notaVeredicto, setNotaVeredicto] = useState<Record<string, string>>({})
  // 📄➡️🧾 Cargar un PDF sin vincular como factura No Informada (A-FEAT-1318, 2026-10-23)
  const [cargarPdf, setCargarPdf] = useState<ArchivoACargar | null>(null)
  const fileIdDeUrl = (url?: string | null) => { const m = String(url || '').match(/[-\w]{25,}/); return m ? m[0] : null }
  useEffect(() => {
    const ids = huerfanosSupervision.map(h => fileIdDeUrl(h.url)).filter(Boolean) as string[]
    if (ids.length === 0) { setRegistroHuerfanos({}); return }
    let vigente = true
    ;(async () => {
      const filas: any[] = []
      let conVeredicto = true
      for (let i = 0; i < ids.length; i += 100) {
        const lote = ids.slice(i, i + 100)
        let r: any = await supabase.from('arca_pdf_archivo_digital')
          .select('file_id, estado, texto, veredicto, veredicto_nota, veredicto_at, veredicto_por').in('file_id', lote)
        if (r.error) {   // sin el script 93: se lee lo que haya, sin veredicto
          conVeredicto = false
          r = await supabase.from('arca_pdf_archivo_digital').select('file_id, estado, texto').in('file_id', lote)
        }
        filas.push(...(r.data || []))
      }
      if (!vigente) return
      setVeredictoDisponible(conVeredicto)
      setRegistroHuerfanos(Object.fromEntries(filas.map(f => [f.file_id, f])))
    })()
    return () => { vigente = false }
  }, [huerfanosSupervision])
  // Capa 2: factura elegida por el usuario para vincular cada huérfano (clave = url del PDF).
  const [vinculoHuerfanoSel, setVinculoHuerfanoSel] = useState<Record<string, string>>({})
  /**
   * Qué huérfano está mostrando su vista previa (clave = url del PDF) — 2026-09-03.
   *
   * Pedido del usuario: *"ya que tenemos posibilidad de ver imágenes, que cuando están las
   * proposiciones se pueda ver la foto del pdf propuesto"*. Antes había que abrir el archivo en otra
   * pestaña, mirarlo, volver y recién ahí elegir — con 20 archivos eso son 40 cambios de pestaña.
   * Se ve acá mismo, al lado del desplegable donde elegís la factura.
   */
  const [previewHuerfano, setPreviewHuerfano] = useState<string | null>(null)
  // Debug de conciliación: cada archivo de la carpeta + su file_id + a qué factura está vinculado.
  const [detalleConciliacion, setDetalleConciliacion] = useState<{ archivo: string; file_id: string; factura: string | null }[]>([])
  // Renombrar huérfano: url del PDF en edición + valor del nombre nuevo + flag guardando.
  const [editNombreUrl, setEditNombreUrl] = useState<string | null>(null)
  const [editNombreVal, setEditNombreVal] = useState('')
  const [guardandoNombreUrl, setGuardandoNombreUrl] = useState<string | null>(null)

  // Renombra un PDF huérfano en Drive (para los mal nombrados) vía /api/gas/renombrar-pdf.
  const renombrarHuerfano = async (h: { archivo: string; url: string }) => {
    const nuevo = editNombreVal.trim()
    if (!nuevo || nuevo === h.archivo) { setEditNombreUrl(null); return }
    setGuardandoNombreUrl(h.url)
    try {
      const r = await fetch('/api/gas/renombrar-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: h.url, nombre: nuevo }),
      })
      const d = await r.json()
      if (!d.ok) { toast.error('No se pudo renombrar: ' + (d.error || '')); return }
      // Actualiza el nombre en el panel (con el nuevo nombre puede aparecer una sugerencia).
      setHuerfanosSupervision(prev => prev.map(x => x.url === h.url ? { ...x, archivo: d.nombre || nuevo } : x))
      setEditNombreUrl(null)
      toast.success('Archivo renombrado.')
    } catch (e) {
      toast.error('Error al renombrar: ' + (e as Error).message)
    } finally {
      setGuardandoNombreUrl(null)
    }
  }

  // Sugiere qué factura "falta" del período corresponde a un PDF huérfano, por NOMBRE de archivo
  // (sin OCR): coincide palabras del proveedor + desempata por la fecha del nombre (MM-DD).
  const sugerirFacturasHuerfano = (nombreArchivo: string): FacturaArca[] => {
    // Candidatas = TODA factura sin PDF, incluidas las de Portal (2026-09-03).
    // Las `fc=No` ya entraban (`categoriaArchivo` sólo aparta las de Portal), y las de Portal se
    // sumaron porque nada impide que alguien haya bajado esa factura del sitio y la haya dejado en
    // la carpeta: excluirlas hacía que el archivo correcto no apareciera nunca como sugerencia.
    const faltantes = facturasPeriodo.filter(f => !f.pdf_drive_url)
    // La cuenta del parecido vive en `lib/facturas/vincular-archivo.ts`: la usa también el Cash Flow.
    const conScore = faltantes.map(f => ({ f, hits: coincidenciasDeNombre(nombreArchivo, f.denominacion_emisor) }))
      .filter(x => x.hits > 0)
    if (conScore.length === 0) return []
    const maxHits = Math.max(...conScore.map(x => x.hits))
    let candidatos = conScore.filter(x => x.hits === maxHits).map(x => x.f)
    // Si el nombre trae fecha (MM-DD al inicio), EXIGIR que coincida con la emisión del candidato.
    // Evita sugerir una factura de otra fecha (ej. un duplicado "04-01" contra la única faltante,
    // que es del 04-09). Si ninguna coincide la fecha → sin sugerencia (probable duplicado).
    candidatos = candidatos.filter(f => fechaDelNombreCoincide(nombreArchivo, f.fecha_emision) !== false)
    return candidatos
  }

  // Desvincula el PDF de una factura (para re-asignar uno mal puesto). NO borra el archivo de Drive,
  // solo limpia el link → el archivo vuelve a quedar disponible como huérfano en la próxima conciliación.
  const desvincularPdf = async (factura: FacturaArca) => {
    if (!confirm(`¿Desvincular el PDF de ${factura.denominacion_emisor || ''} ${factura.punto_venta}-${factura.numero_desde}?\n\nEl archivo NO se borra de Drive; queda disponible para re-asignar: corré «Vincular sólo los que faltan».`)) return
    try {
      const { error } = await supabase.schema(schemaName).from('comprobantes_arca')
        .update({ pdf_drive_url: null, pdf_estado: null, pdf_observaciones: 'Desvinculado manualmente para re-asignar' })
        .eq('id', factura.id)
      if (error) { toast.error('No se pudo desvincular: ' + error.message); return }
      await cargarFacturasPeriodo(periodoConsulta)
      toast.success('PDF desvinculado. Corré «Vincular sólo los que faltan» para re-asignarlo.')
    } catch (e) {
      toast.error('Error al desvincular: ' + (e as Error).message)
    }
  }

  // Vincula un PDF huérfano a la factura elegida (solo enlaza: setea pdf_drive_url; no toca el archivo).
  const vincularHuerfano = async (factura: FacturaArca, h: { archivo: string; url: string }) => {
    try {
      const { error } = await supabase.schema(schemaName).from('comprobantes_arca')
        .update(datosDelVinculo(h, 'supervisión'))
        .eq('id', factura.id)
      if (error) { toast.error('No se pudo vincular: ' + error.message); return }
      setHuerfanosSupervision(prev => prev.filter(x => x.url !== h.url))
      await cargarFacturasPeriodo(periodoConsulta) // refresca íconos/chips
      toast.success(`Vinculado: ${factura.denominacion_emisor} ${factura.punto_venta}-${factura.numero_desde}`)
    } catch (e) {
      toast.error('Error al vincular: ' + (e as Error).message)
    }
  }
  
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
    sinRetencion?: boolean  // true cuando no aplica retención (neto < mínimo del tipo)
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
  const [modalAsignarCuotaSicore, setModalAsignarCuotaSicore] = useState<{
    quincena: string
    totalRet: number
    cuotas: Array<{ id: string; label: string; template: string }>
    cuotaIdSugerida: string
    cuotaIdSeleccionada: string
    estadoSeleccionado: string
  } | null>(null)
  const [cargandoV2, setCargandoV2] = useState(false)
  const [mostrarAnulados, setMostrarAnulados] = useState(false)
  const [mostrarModalExport, setMostrarModalExport] = useState(false)
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
  const [sueldosPagos, setSueldosPagos] = useState<any[]>([])

  // Estados para edición masiva en tab Facturas principal
  const [modoEdicionMasiva, setModoEdicionMasiva] = useState(false)
  const [facturasSeleccionadasMasiva, setFacturasSeleccionadasMasiva] = useState<Set<string>>(new Set())
  const [nuevoEstadoMasivo, setNuevoEstadoMasivo] = useState('')
  const [facturasSeleccionadasPagos, setFacturasSeleccionadasPagos] = useState<Set<string>>(new Set())
  const [templatesSeleccionadosPagos, setTemplatesSeleccionadosPagos] = useState<Set<string>>(new Set())
  const [anticiposSeleccionadosPagos, setAnticiposSeleccionadosPagos] = useState<Set<string>>(new Set())
  const [sueldosSeleccionadosPagos, setSueldosSeleccionadosPagos] = useState<Set<string>>(new Set())
  const [filtrosPagos, setFiltrosPagos] = useState({ pendiente: true, pagar: true, preparado: true })
  const [filtroOrigenPagos, setFiltroOrigenPagos] = useState({ arca: true, template: true, anticipo: true, sueldo: true })
  const [filtroBusquedaPagos, setFiltroBusquedaPagos] = useState('')
  const [filtroSoloNCPagos, setFiltroSoloNCPagos] = useState(false)
  const [cargandoPagos, setCargandoPagos] = useState(false)
  const [fechaPagoSeleccionada, setFechaPagoSeleccionada] = useState<string>('')

  // Cancelación FC/NC
  const [modalCancelacionNC, setModalCancelacionNC] = useState<{
    tipo: 'fc_con_nc' | 'nc_con_descuento'
    facturas: FacturaArca[]        // FCs o NCs seleccionadas por el usuario
    disponibles: FacturaArca[]     // NCs disponibles (escenario A) o FCs con descuento (escenario B)
    seleccionadas: Set<string>     // IDs elegidos por el usuario en el modal
    restoCambioEstado: FacturaArca[] // Facturas que NO son parte de la cancelación y siguen flujo normal
  } | null>(null)

  // ECHEQ — estado del modal y datos del cheque pendiente
  const [mostrarModalEcheq, setMostrarModalEcheq] = useState(false)
  const [echeqForm, setEcheqForm] = useState({ banco: '', numero: '', fechaEmision: '', fechaCobro: '' })
  // Ref para acceso síncrono desde funciones (evita stale closure)
  const echeqPendienteRef = useRef<{ banco: string; numero: string; fechaEmision: string; fechaCobro: string } | null>(null)
  const [echeqPendiente, setEcheqPendiente] = useState<{ banco: string; numero: string; fechaEmision: string; fechaCobro: string } | null>(null)
  // Ref para exponer funciones definidas en IIFE al modal ECHEQ
  const cambiarEstadoSeleccionadasRef = useRef<((estado: string, echeqFecha?: string) => void) | null>(null)
  const cambiarEstadoAnticiposRef = useRef<((estado: string, echeqFecha?: string) => void) | null>(null)
  const [echeqEstadoDestino, setEcheqEstadoDestino] = useState<string>('pagar')
  const [echeqOrigen, setEcheqOrigen] = useState<'facturas' | 'anticipos'>('facturas')

  // Cola de facturas pendientes de procesar SICORE (para múltiples selecciones)
  const [colaSicore, setColaSicore] = useState<FacturaArca[]>([])
  const [procesandoColaSicore, setProcesandoColaSicore] = useState(false)

  // Edición cuenta contable inline — Vista Pagos
  const [editandoCuentaPagosId, setEditandoCuentaPagosId] = useState<string | null>(null)
  const [editandoCuentaPagosVal, setEditandoCuentaPagosVal] = useState<string>('')
  const [editandoCuentaBusqueda, setEditandoCuentaBusqueda] = useState('')
  const [cuentasContablesPagos, setCuentasContablesPagos] = useState<any[]>([])

  // Edición detalle inline — Vista Pagos
  const [editandoDetallePagosId, setEditandoDetallePagosId] = useState<string | null>(null)
  const [editandoDetallePagosVal, setEditandoDetallePagosVal] = useState('')

  // Edición fecha pago inline — Vista Pagos
  const [editandoFechaPagosId, setEditandoFechaPagosId] = useState<string | null>(null)
  const [editandoFechaPagosVal, setEditandoFechaPagosVal] = useState('')

  // TC de pago modal - Vista Pagos
  const [modalTcPagoPagos, setModalTcPagoPagos] = useState<{ factura: FacturaArca } | null>(null)
  const [tcPagoInputPagos, setTcPagoInputPagos] = useState('')
  const [colaUSDSinTC, setColaUSDSinTC] = useState<FacturaArca[]>([])
  
  // 📤 Archivos para ARCA (Libro IVA Compras en texto para IVA Simple) — A-FEAT-1286, sólo MSA
  const [mostrarArchivosArca, setMostrarArchivosArca] = useState(false)

  // Estados para configuración de carpetas con persistencia
  const [carpetaPorDefecto, setCarpetaPorDefectoState] = useState<any>(null)
  
  // Función para persistir carpeta por defecto
  const setCarpetaPorDefecto = (carpeta: any) => {
    setCarpetaPorDefectoState(carpeta)
    if (carpeta) {
      localStorage.setItem(LS_CARPETA_POR_DEFECTO, JSON.stringify({
        name: carpeta.name,
        // No podemos serializar el handle completo, solo el nombre para mostrar
      }))
    }
  }

  // Cargar carpeta por defecto al inicio (solo nombre para mostrar)
  useEffect(() => {
    try {
      const carpetaGuardada = localStorage.getItem(LS_CARPETA_POR_DEFECTO)
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
    
    // Hasta jul-2025 como mínimo, para que se vea el ejercicio 25/26 entero (con el histórico, A-FEAT-1382).
    const meses = Math.max(12, (hoy.getFullYear() - 2025) * 12 + hoy.getMonth() - 6 + 1)
    for (let i = 0; i < meses; i++) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const mes = String(fecha.getMonth() + 1).padStart(2, '0')
      const año = fecha.getFullYear()
      periodos.push(`${mes}/${año}`)
    }
    return periodos
  }
  
  // Estados para importador Excel
  const [mostrarImportador, setMostrarImportador] = useState(false)
  const [mostrarReglasImport, setMostrarReglasImport] = useState(false)
  const [archivoImportacion, setArchivoImportacion] = useState<File | null>(null)
  const [importandoExcel, setImportandoExcel] = useState(false)
  const [resultadoImportacion, setResultadoImportacion] = useState<any>(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [origenFactura, setOrigenFactura] = useState<string>('')  // 'ARCA' | 'No Informada'
  const [pasoImportacion, setPasoImportacion] = useState<'origen' | 'archivo' | 'imputacion'>('origen')
  // buscar_pdf (A-FEAT-1287): al terminar la importación se busca el PDF de las tildadas — todas por default
  const [imputacionData, setImputacionData] = useState<Array<{ fila: number, fc: string, cuenta_contable: string | null, buscar_pdf: boolean }>>([])
  const [cuentasContablesImport, setCuentasContablesImport] = useState<any[]>([])
  
  // Estados para edición inline
  const [modoEdicion, setModoEdicion] = useState(false)
  // Modo edición/eliminación admin: habilita edición libre de todos los campos + delete real
  const [modoEdicionAdmin, setModoEdicionAdmin] = useState(false)
  // Módulo búsqueda PDFs vía GAS
  const [progresoPdf, setProgresoPdf] = useState<ProgresoLote | null>(null)
  const [buscandoPdfs, setBuscandoPdfs] = useState(false)
  const [modalHistorialPdf, setModalHistorialPdf] = useState<{ open: boolean; loteId?: string; facturaId?: string }>({ open: false })
  const [modalConfigProveedorPdf, setModalConfigProveedorPdf] = useState<{ open: boolean; cuit?: string | null }>({ open: false })
  const [auditarPeriodoOpen, setAuditarPeriodoOpen] = useState(false)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  // 🔎 La pantalla «Buscar PDFs» se RETIRÓ el 2026-10-23 (usuario, opción 1): lo imputado se pide y se
  // busca desde Subdiarios y todo lo demás desde «Facturas sin comprobante» (PanelFacturasSinPdf).
  // ✓ de VER: elegir entre los candidatos · 📋 informe del último lote
  const [elegirCandidato, setElegirCandidato] = useState<{ id: string; rotulo: string; fecha_emision?: string | null; imp_total?: number | null } | null>(null)
  const [verInformeLote, setVerInformeLote] = useState(false)
  // Hasta dónde se leyeron los reenvíos (inventario permanente, A-FEAT-1287 2026-10-20)
  const [inventarioPdf, setInventarioPdf] = useState<EstadoInventario | { error: string } | null>(null)
  // 📮 Pedir la factura al proveedor (A-FEAT-1313): las facturas elegidas, o null si está cerrado
  const [pedirFacturas, setPedirFacturas] = useState<string[] | null>(null)
  const cancelarPdfRef = useRef(false)
  // Mail del proveedor por CUIT (varias FC comparten proveedor): lo usan la imputación de la importación
  // (provEditMail = lo que se carga ahí) y la lista de facturas sin PDF.
  /** 🧾 A-BUG-1244 — la factura que se está vinculando con sus compras de insumos. */
  const [facturaVincularCompras, setFacturaVincularCompras] = useState<string | null>(null)
  const [provPorCuit, setProvPorCuit] = useState<Record<string, { id: string; email_facturacion: string | null; email_pagos: string | null; gas_habilitado: boolean | null; fc_modo: string | null }>>({})
  const [provEditMail, setProvEditMail] = useState<Record<string, string>>({})
  const [guardandoMailCuit, setGuardandoMailCuit] = useState<string | null>(null)

  /**
   * ❌ FACTURAS SIN PDF — pedirlas y buscarlas (A-FEAT-1287). Desde 2026-10-23 viven en dos lugares con
   * la MISMA lista (`PanelFacturasSinPdf`): **Subdiarios** (las del mes contable) y **Facturas sin
   * comprobante** (todas, también las sin imputar). El pedido y la última búsqueda de cada una salen del
   * historial de búsquedas; el mail de cada proveedor, del maestro.
   */
  const [ultimasSinPdf, setUltimasSinPdf] = useState<Map<string, UltimaBusqueda>>(new Map())
  const [recargaUltimasSinPdf, setRecargaUltimasSinPdf] = useState(0)
  const idsFaltantesPeriodo = facturasPeriodo.filter(f => categoriaArchivo(f) === 'falta').map(f => f.id)
  const idsSinComprobante = mostrarModalMarcarFC ? facturasOriginales.filter(faltaComprobante).map(f => f.id) : []
  const claveSinPdf = Array.from(new Set([...idsFaltantesPeriodo, ...idsSinComprobante])).sort().join(',')
  useEffect(() => {
    const ids = claveSinPdf ? claveSinPdf.split(',') : []
    if (ids.length === 0) { setUltimasSinPdf(new Map()); return }
    let vivo = true
    ;(async () => {
      const logs: Array<{ factura_id: string; fecha_hora: string; resultado: string | null; observaciones: string | null }> = []
      for (let i = 0; i < ids.length; i += 50) {
        const { data } = await supabase.from('arca_pdf_busqueda_log')
          .select('factura_id, fecha_hora, resultado, observaciones')
          .eq('factura_schema', schemaName).in('factura_id', ids.slice(i, i + 50))
          .order('fecha_hora', { ascending: false }).limit(1000)
        if (data) logs.push(...(data as typeof logs))
      }
      if (vivo) setUltimasSinPdf(ultimasBusquedas(logs))
    })()
    return () => { vivo = false }
  }, [claveSinPdf, schemaName, recargaUltimasSinPdf])
  const idsSinPdf = new Set(claveSinPdf ? claveSinPdf.split(',') : [])
  const claveCuitsSinPdf = Array.from(new Set([...facturasPeriodo, ...facturasOriginales]
    .filter(f => idsSinPdf.has(f.id)).map(f => String(f.cuit || '').replace(/\D/g, '')).filter(Boolean))).sort().join(',')
  useEffect(() => {
    const cuits = claveCuitsSinPdf ? claveCuitsSinPdf.split(',') : []
    if (cuits.length === 0) return
    let vivo = true
    ;(async () => {
      const { data } = await supabase.from('proveedores')
        .select('id, cuit, email_facturacion, email_pagos, gas_habilitado, fc_modo').in('cuit', cuits)
      if (!vivo || !data) return
      // Se SUMA a lo cargado: la imputación de la importación usa el mismo mapa
      setProvPorCuit(prev => {
        const n = { ...prev }
        ;(data as any[]).forEach(p => { n[p.cuit] = { id: p.id, email_facturacion: p.email_facturacion, email_pagos: p.email_pagos, gas_habilitado: p.gas_habilitado, fc_modo: p.fc_modo } })
        return n
      })
    })()
    return () => { vivo = false }
  }, [claveCuitsSinPdf])
  // Lo ya leído de los reenvíos, para mostrarlo con la lista
  const haySinPdf = claveSinPdf !== ''
  useEffect(() => {
    if (!haySinPdf) return
    let vivo = true
    estadoInventario().then(inv => { if (vivo) setInventarioPdf(inv) }).catch(() => {})
    return () => { vivo = false }
  }, [haySinPdf, recargaUltimasSinPdf])

  // Módulo lotes de transferencias Galicia
  const [modalExportarLote, setModalExportarLote] = useState<{ open: boolean; items: ItemSeleccionado[] }>({ open: false, items: [] })

  // Modal de descarga automática desde ARCA (solo admin)
  const [mostrarImportadorArca, setMostrarImportadorArca] = useState(false)
  const [arcaEmpresa, setArcaEmpresa] = useState<'MSA' | 'PAM' | 'MA'>('MSA')
  const [arcaPassword, setArcaPassword] = useState('')         // se ingresa cada vez, no se guarda
  const [arcaFechaDesde, setArcaFechaDesde] = useState('')
  const [arcaFechaHasta, setArcaFechaHasta] = useState('')
  const [arcaCargando, setArcaCargando] = useState(false)
  const [arcaError, setArcaError] = useState<string | null>(null)
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false)
  const [textoConfirmarEliminar, setTextoConfirmarEliminar] = useState('')
  const [depsParaEliminar, setDepsParaEliminar] = useState<Map<string, any>>(new Map())
  const [eliminandoFacturas, setEliminandoFacturas] = useState(false)
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
    const defaults = Object.fromEntries(
      Object.entries(COLUMNAS_CONFIG).map(([key, config]) => [key, config.visible])
    )
    // Mergear sobre defaults para que columnas nuevas (ej. fecha_pago) aparezcan aunque haya config guardada.
    // Guarda de SSR: el inicializador de useState corre también en el servidor, donde no hay
    // localStorage. Sin esto la pantalla tira 500 al renderizarse (rompía la ruta del contable).
    if (typeof window === 'undefined') return defaults
    const saved = localStorage.getItem('facturas-arca-columnas-visibles')
    if (saved) {
      try {
        return { ...defaults, ...JSON.parse(saved) }
      } catch {
        // Si hay error, usar valores por defecto
      }
    }
    return defaults
  })

  // Estado para anchos de columnas personalizables con persistencia
  const [anchosColumnas, setAnchosColumnas] = useState<Record<string, string>>(() => {
    // Guarda de SSR: mismo caso que columnasVisibles (arriba) — sin esto, 500 al renderizar.
    if (typeof window === 'undefined') return {}
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

  // Chequeo de dependencias de una factura (admin: aviso antes de editar/eliminar)
  // Retorna lo que está vinculado a la FC para que el usuario decida.
  const chequearDependenciasFC = async (facturaId: string) => {
    try {
      // 🔗 A-BUG-1227 (3): los movimientos se cuentan en los 11 extractos (bancos, tarjetas, cajas,
      // echeqs). Antes miraba 4 y concluía «sin conciliaciones» teniendo movimientos de tarjeta atados:
      // dejaba pasar un borrado. Una tabla que no se pudo leer NO cuenta como cero.
      const [anticiposRes, sicoreRes, movs, fcRes] = await Promise.all([
        supabase.from('anticipos_proveedores').select('id, monto').eq('factura_id', facturaId),
        supabase.schema('msa').from('sicore_retenciones').select('id, ddjj_confirmada').eq('factura_id', facturaId),
        contarMovimientosDeFactura(supabase as unknown as ClienteParaPropagar, facturaId),
        supabase.schema(schemaName).from('comprobantes_arca').select('ddjj_iva, estado').eq('id', facturaId).maybeSingle(),
      ])
      const conciliaciones = movs.total
      const extractosConMovs = movs.porTabla.map(t => `${t.n} en ${t.que}`)
      const extractosSinLeer = movs.fallaron
      const sicoreCount = sicoreRes.data?.length || 0
      const sicoreDdjjConfirmada = (sicoreRes.data || []).some((s: any) => s.ddjj_confirmada)
      return {
        anticipos: anticiposRes.data?.length || 0,
        sicore: sicoreCount,
        sicoreDdjjConfirmada,
        conciliaciones,
        extractosConMovs,
        extractosSinLeer,
        ddjjIva: fcRes.data?.ddjj_iva || null,
        estado: fcRes.data?.estado || null,
      }
    } catch (err) {
      console.warn('chequearDependenciasFC error:', err)
      // 🛑 Si el chequeo falla no se dice «sin dependencias»: se avisa que no se pudo verificar.
      return { anticipos: 0, sicore: 0, sicoreDdjjConfirmada: false, conciliaciones: 0, extractosConMovs: [] as string[], extractosSinLeer: ['(no se pudo verificar)'], ddjjIva: null, estado: null }
    }
  }

  // Formato texto resumen de dependencias para alertas
  const formatearDependencias = (deps: Awaited<ReturnType<typeof chequearDependenciasFC>>) => {
    const items: string[] = []
    if (deps.anticipos > 0) items.push(`• ${deps.anticipos} anticipo(s) vinculado(s)`)
    if (deps.sicore > 0) items.push(`• ${deps.sicore} retención(es) SICORE${deps.sicoreDdjjConfirmada ? ' (¡DDJJ ya confirmada!)' : ''}`)
    if (deps.conciliaciones > 0) items.push(`• ${deps.conciliaciones} movimiento(s) conciliado(s): ${deps.extractosConMovs.join(', ')}`)
    if (deps.extractosSinLeer.length > 0) items.push(`• ⚠️ No se pudo verificar: ${deps.extractosSinLeer.join(', ')}`)
    if (deps.ddjjIva === 'DDJJ OK') items.push('• DDJJ IVA ya cerrada (estado "DDJJ OK")')
    else if (deps.ddjjIva === 'Enviado') items.push('• Su período ya se envió al contador (estado "Enviado")')
    else if (deps.ddjjIva === 'Imputado') items.push('• Imputada en un período de DDJJ IVA')
    return items
  }

  // Abre el modal de eliminación: pre-carga las dependencias de cada FC seleccionada
  const abrirModalEliminarSeleccionadas = async () => {
    if (facturasSeleccionadasMasiva.size === 0) return
    const ids = Array.from(facturasSeleccionadasMasiva)
    const deps = new Map<string, any>()
    for (const id of ids) {
      deps.set(id, await chequearDependenciasFC(id))
    }
    setDepsParaEliminar(deps)
    setTextoConfirmarEliminar('')
    setMostrarModalEliminar(true)
  }

  // Ejecuta el DELETE real de las facturas seleccionadas
  const ejecutarEliminacionMasiva = async () => {
    const ids = Array.from(facturasSeleccionadasMasiva)
    if (ids.length === 0) return
    setEliminandoFacturas(true)
    try {
      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_arca')
        .delete()
        .in('id', ids)
      if (error) throw error
      alert(`✅ ${ids.length} factura(s) eliminada(s) permanentemente.`)
      setFacturasSeleccionadasMasiva(new Set())
      setMostrarModalEliminar(false)
      setTextoConfirmarEliminar('')
      setDepsParaEliminar(new Map())
      await cargarFacturas()
    } catch (err) {
      alert('❌ Error al eliminar: ' + (err as Error).message)
    } finally {
      setEliminandoFacturas(false)
    }
  }

  // Cargar facturas ARCA desde Supabase
  const cargarFacturas = async () => {
    try {
      setLoading(true)
      setError(null)

      const [arcaResult, historicoResult] = await Promise.all([
        supabase.schema(schemaName).from('comprobantes_arca').select('*').order('fecha_emision', { ascending: false }),
        supabase.schema(schemaName).from('comprobantes_historico').select('*').order('fecha', { ascending: false }),
      ])

      if (arcaResult.error) {
        console.error('Error al cargar facturas:', arcaResult.error)
        setError(`Error al cargar facturas: ${arcaResult.error.message}`)
        return
      }

      // Mapear registros históricos al formato FacturaArca
      // En la lista general el tipo del histórico queda en 0, como estaba (no cambia filtros ni chips).
      const historicas: FacturaArca[] = (historicoResult.data || []).map(h => ({ ...historicoAFactura(h), tipo_comprobante: 0 }) as unknown as FacturaArca)

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

  // Re-aplicar filtros cuando cambia el filtro FC o el tipo de comprobante
  useEffect(() => {
    aplicarFiltros()
  }, [filtroFcPendiente, filtroTipoComprobante, filtroEstadoFc])

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
      const busqueda = normalizarBusqueda(busquedaProveedor)
      facturasFiltradas = facturasFiltradas.filter(f =>
        f.denominacion_emisor && normalizarBusqueda(f.denominacion_emisor).includes(busqueda)
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
      const busqueda = normalizarBusqueda(busquedaDetalle)
      facturasFiltradas = facturasFiltradas.filter(f =>
        f.detalle && normalizarBusqueda(f.detalle).includes(busqueda)
      )
    }
    
    // Filtro por estado
    if (estadoSeleccionado && estadoSeleccionado !== 'todos') {
      facturasFiltradas = facturasFiltradas.filter(f => f.estado === estadoSeleccionado)
    }

    // Filtro por tipo de comprobante
    if (filtroTipoComprobante && filtroTipoComprobante !== 'todos') {
      facturasFiltradas = facturasFiltradas.filter(f => String(f.tipo_comprobante) === filtroTipoComprobante)
    }
    
    // Filtro por rango de montos
    if (montoMinimo) {
      const minimo = parseFloat(montoMinimo.replace(/\./g, '').replace(',', '.'))
      facturasFiltradas = facturasFiltradas.filter(f => f.imp_total >= minimo)
    }
    if (montoMaximo) {
      const maximo = parseFloat(montoMaximo.replace(/\./g, '').replace(',', '.'))
      facturasFiltradas = facturasFiltradas.filter(f => f.imp_total <= maximo)
    }
    
    // Filtro por cuenta contable (CATEG)
    if (busquedaCateg.trim()) {
      const busqueda = normalizarBusqueda(busquedaCateg)
      facturasFiltradas = facturasFiltradas.filter(f =>
        f.cuenta_contable && normalizarBusqueda(f.cuenta_contable).includes(busqueda)
      )
    }

    // Filtro por FC pendiente
    if (filtroFcPendiente) {
      facturasFiltradas = facturasFiltradas.filter(faltaComprobante)
    }

    // Filtro por Estado FC (Portal, VER, NO Mail…)
    if (filtroEstadoFc !== 'todos') {
      facturasFiltradas = facturasFiltradas.filter(f => (f.fc ?? '(sin estado)') === filtroEstadoFc)
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
    setFiltroTipoComprobante('todos')
    setMontoMinimo('')
    setMontoMaximo('')
    setBusquedaCateg('')
    setFiltroEstadoFc('todos')
    setFacturas(facturasOriginales)
  }
  
  // Funciones para edición inline
  const iniciarEdicion = (facturaId: string, columna: string, valor: any, event: React.MouseEvent) => {
    // En modo admin: click simple alcanza. En modo normal: requiere Ctrl+Click.
    if (modoEdicionAdmin) {
      // sin verificación de Ctrl ni modoEdicion
    } else {
      if (!event.ctrlKey || !modoEdicion) return
    }
    
    event.preventDefault()
    event.stopPropagation()
    
    // TESTING: Usar hook solo para fechas (approach gradual)
    if (['fecha_estimada', 'fecha_vencimiento', 'fecha_pago'].includes(columna)) {
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
      // Para campos monetarios, mostrar valor formateado con coma decimal (es-AR)
      const valorFormateado = ['monto_a_abonar', 'imp_total', 'imp_neto_gravado', 'imp_neto_no_gravado', 'imp_op_exentas', 'otros_tributos', 'iva', 'tipo_cambio'].includes(columna) && typeof valor === 'number' && valor !== 0
        ? valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : (valor || '')
      setCeldaEnEdicion({
        facturaId,
        columna,
        valor: valorFormateado
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

    // Confirmación adicional en MODO ADMIN — pide "aceptar" y avisa dependencias relevantes
    if (modoEdicionAdmin) {
      const facturaActual = facturas.find(f => f.id === celdaEnEdicion.facturaId)
      const valorAnterior = facturaActual ? (facturaActual as any)[celdaEnEdicion.columna] : '(?)'
      const deps = await chequearDependenciasFC(celdaEnEdicion.facturaId)
      const depsTexto = formatearDependencias(deps)
      const camposCriticos = ['imp_total', 'monto_a_abonar', 'cuit', 'tipo_comprobante', 'punto_venta', 'numero_desde']
      const esCampoCritico = camposCriticos.includes(celdaEnEdicion.columna)
      const advertencia = (esCampoCritico && depsTexto.length > 0)
        ? '\n\n⚠️ Esta FC tiene elementos vinculados que pueden quedar inconsistentes:\n' + depsTexto.join('\n')
        : (depsTexto.length > 0 ? '\n\nInformación: la FC tiene vinculados:\n' + depsTexto.join('\n') : '')
      const txt = window.prompt(
        `MODO ADMIN — Cambiar campo "${celdaEnEdicion.columna}" en FC ${facturaActual?.denominacion_emisor || ''}\n\n` +
        `De: ${valorAnterior ?? '(vacío)'}\n` +
        `A:  ${celdaEnEdicion.valor ?? '(vacío)'}` +
        advertencia +
        `\n\nEscribí "aceptar" para confirmar:`
      )
      if (txt?.trim().toLowerCase() !== 'aceptar') {
        setCeldaEnEdicion(null)
        return
      }
    }

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

  /** 🧮 Lo que pasó con los movimientos conciliados, igual que en Asignación de cuentas. */
  const avisarAsignacion = (r: RespuestaAsignacion) => {
    const m = mensajeDePropagacion(r)
    if (m.tipo) alert(m.texto)
  }

  const ejecutarGuardadoReal = async (datosEdicion: {facturaId: string, columna: string, valor: any}) => {
    setGuardandoCambio(true)
    
    try {
      /**
       * 🧾 **La cuenta va por el camino único** (A-DEC-1021 / A-BUG-1227 (1)). Antes acá se guardaba el
       * nombre, se buscaba el número aparte, y se propagaba a 3 de los 11 extractos sin esperar ni
       * avisar si fallaba. Ahora: par número + nombre del plan, en esta empresa, a los 11 extractos.
       */
      if (datosEdicion.columna === 'cuenta_contable') {
        let r: RespuestaAsignacion
        try {
          r = await pedirAsignacionDeCuenta({
            empresa, ids: [datosEdicion.facturaId], cuenta_contable: String(datosEdicion.valor ?? '').trim() || null, nro_cuenta: null,
          })
        } catch (err: any) {
          alert('La cuenta NO se guardó: ' + err.message)
          return
        }
        const par = { cuenta_contable: r.cuenta?.cuenta_contable ?? null, nro_cuenta: r.cuenta?.nro_cuenta ?? null }
        setFacturas(prev => prev.map(f => f.id === datosEdicion.facturaId ? { ...f, ...par } : f))
        setFacturasOriginales(prev => prev.map(f => f.id === datosEdicion.facturaId ? { ...f, ...par } : f))
        setCeldaEnEdicion(null)
        avisarAsignacion(r)
        return
      }

      let valorFinal: any = datosEdicion.valor
      
      // Convertir valores según el tipo de campo
      if (['monto_a_abonar', 'imp_total', 'imp_neto_gravado', 'imp_neto_no_gravado', 'imp_op_exentas', 'otros_tributos', 'iva', 'tipo_cambio'].includes(datosEdicion.columna)) {
        valorFinal = parseFloat(String(valorFinal).replace(/\./g, '').replace(',', '.')) || 0
      }
      
      // Si cambia a estado 'debito', fecha_estimada = fecha_emision (pago inmediato)
      let camposUpdate: any = { [datosEdicion.columna]: valorFinal }
      if (datosEdicion.columna === 'estado' && valorFinal === 'debito') {
        const facturaActual = facturas.find(f => f.id === datosEdicion.facturaId)
        if (facturaActual?.fecha_emision) {
          camposUpdate.fecha_estimada = facturaActual.fecha_emision
          console.log(`🔄 Auto-ajuste fecha_estimada = fecha_emision (${facturaActual.fecha_emision}) por estado debito`)
        }
      }

      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_arca')
        .update(camposUpdate)
        .eq('id', datosEdicion.facturaId)

      if (error) {
        console.error('Error actualizando factura:', error)
        alert('Error al guardar cambio: ' + error.message)
        return
      }

      // Actualizar estado local (incluir fecha_estimada si aplica)
      const nuevasFacturas = facturas.map(f =>
        f.id === datosEdicion.facturaId
          ? { ...f, ...camposUpdate }
          : f
      )
      setFacturas(nuevasFacturas)

      const nuevasFacturasOriginales = facturasOriginales.map(f =>
        f.id === datosEdicion.facturaId
          ? { ...f, ...camposUpdate }
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

  // Tipos de comprobante presentes en los datos (solo los que existen, no la lista AFIP completa)
  const tiposComprobantePresentes = (() => {
    const map = new Map<number, string>()
    const esPlaceholder = (d: string) => !d || /^Código\s/i.test(d)
    for (const f of facturasOriginales) {
      const t = f.tipo_comprobante
      if (t == null) continue
      const desc = f.tipo_comprobante_desc || ''
      const existente = map.get(t)
      if (existente === undefined || (esPlaceholder(existente) && !esPlaceholder(desc))) {
        map.set(t, desc || `Tipo ${t}`)
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  })()

  // Obtener columnas visibles
  const columnasVisiblesArray = Object.entries(columnasVisibles)
    .filter(([_, visible]) => visible)
    .map(([key]) => key as keyof FacturaArca)

  // Campos editables en ARCA
  const camposEditables = [
    'fecha_estimada', 'fecha_vencimiento', 'fecha_pago', 'monto_a_abonar', 'cuenta_contable',
    'centro_costo', 'estado', 'observaciones_pago', 'detalle', 'campana'
  ]

  // Colores por estado (usado en badges)
  const colorEstado = (estado: string): string => {
    const mapa: Record<string, string> = {
      pendiente:  'bg-gray-100 text-gray-600 border-gray-200',
      debito:     'bg-violet-100 text-violet-800 border-violet-200',
      pagar:      'bg-yellow-100 text-yellow-800 border-yellow-200',
      echeq:      'bg-amber-100 text-amber-800 border-amber-300',
      preparado:  'bg-orange-100 text-orange-800 border-orange-200',
      pagado:     'bg-green-100 text-green-800 border-green-200',
      programado: 'bg-violet-100 text-violet-800 border-violet-200',
      credito:    'bg-gray-100 text-gray-600 border-gray-200',
      conciliado: 'bg-gray-100 text-gray-600 border-gray-200',
      anterior:   'bg-gray-100 text-gray-600 border-gray-200',
      cuotas:     'bg-blue-100 text-blue-800 border-blue-200',
      historico:  'bg-slate-200 text-slate-600 border-slate-300',
    }
    return mapa[estado] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  }

  // ✓ de una factura en VER: abre la lista de candidatos y el usuario elige (A-FEAT-1287). Antes
  // confirmaba a ciegas el último del log y la dejaba en «Sí», que es el estado de Ulises: ahora
  // queda en «Confirmada».
  const confirmarVer = (factura: FacturaArca) => {
    setElegirCandidato({ id: factura.id, rotulo: `${factura.denominacion_emisor || ''} ${factura.punto_venta}-${factura.numero_desde}`, fecha_emision: factura.fecha_emision, imp_total: factura.imp_total })
  }
  const alConfirmarCandidato = (facturaId: string, driveUrl: string) => {
    setFacturas(prev => prev.map(x => x.id === facturaId ? { ...x, fc: 'Confirmada', pdf_drive_url: driveUrl } : x))
    setFacturasOriginales(prev => prev.map(x => x.id === facturaId ? { ...x, fc: 'Confirmada', pdf_drive_url: driveUrl } : x))
    setFacturasPeriodo(prev => prev.map(x => x.id === facturaId ? { ...x, fc: 'Confirmada', pdf_drive_url: driveUrl } : x))
    toast.success('Confirmada: la factura quedó vinculada a ese archivo.')
  }
  // 📨 Lo ya leído de los reenvíos (no se vuelve a leer) y los adjuntos ilegibles — con la lista de sin PDF
  const renglonReenvios = () => {
    if (!inventarioPdf) return null
    if ('error' in inventarioPdf) return <p className="text-[11px] text-gray-400">📨 Reenvíos: no se pudo leer lo ya leído ({inventarioPdf.error})</p>
    const d = (iso: string) => iso.split('-').reverse().map((x, k) => k === 2 ? x.slice(2) : x).join('/')
    return (
      <div className="text-[11px] text-gray-600">
        <span className="text-gray-500">📨 Ya leído de los reenvíos (no se vuelve a leer):</span>{' '}
        {inventarioPdf.reenviadores.map((rv, i) => {
          const b = rv.bloques[0]
          return <span key={rv.clave}>{i > 0 ? ' · ' : ''}{rv.nombre} <b>{b ? `${d(b.desde)} → ${d(b.hasta)}` : 'nunca'}</b>{rv.bloques.length > 1 ? <span className="text-gray-400"> (+{rv.bloques.length - 1} tramo{rv.bloques.length > 2 ? 's' : ''} más viejo{rv.bloques.length > 2 ? 's' : ''})</span> : null}</span>
        })}
        {' · '}{inventarioPdf.adjuntos} adjunto{inventarioPdf.adjuntos === 1 ? '' : 's'} guardado{inventarioPdf.adjuntos === 1 ? '' : 's'}
        {inventarioPdf.ilegibles > 0 && (
          <details className="inline-block ml-1">
            <summary className="inline cursor-pointer text-amber-700 underline">{inventarioPdf.ilegibles} ilegible{inventarioPdf.ilegibles === 1 ? '' : 's'}</summary>
            <ul className="mt-1 ml-3 list-disc">
              {inventarioPdf.ilegiblesLista.map(x => (
                <li key={x.gmail_message_id + (x.nombre_archivo || '')}>
                  <a className="text-blue-600 underline" href={`https://mail.google.com/mail/u/0/#all/${x.gmail_message_id}`} target="_blank" rel="noreferrer">{x.nombre_archivo || 'adjunto'}</a>
                  {' '}<span className="text-gray-400">{(x.fecha_mail || '').slice(0, 10).split('-').reverse().join('/')} · {x.chars ?? 0} caracteres</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    )
  }
  // ❌ Las facturas sin PDF, de Subdiarios o de «sin comprobante», por id
  const facturaSinPdf = (id: string) => facturasPeriodo.find(f => f.id === id) ?? facturasOriginales.find(f => f.id === id)
  const refrescarTrasBuscar = async () => {
    if (periodoConsulta) await cargarFacturasPeriodo(periodoConsulta)
    await cargarFacturas()
  }
  /**
   * ❌ Buscar el PDF de facturas sin PDF. Desde Subdiarios, sólo el MAIL (la carpeta es «🔗 Vincular
   * PDFs»); desde «sin comprobante», CARPETA Y MAIL (la sin imputar: su mes de emisión y el siguiente).
   * Corre en 2do plano: el avance y el informe, en el cartel flotante.
   */
  const buscarSinPdf = async (ids: string[], donde: 'mail' | 'ambos') => {
    if (ids.length === 0) return
    const comoBusca = donde === 'mail'
      ? 'La carpeta no se mira (eso es «🔗 Vincular PDFs»): primero lo ya leído de los reenvíos, después el mail de cada proveedor, y al final los reenvíos y los mails con «factura / FC / fac» en el asunto que todavía no se leyeron.'
      : 'Primero la carpeta de su subdiario en Drive (sin imputar: su mes de emisión y el siguiente); después lo ya leído de los reenvíos, el mail de cada proveedor, y al final los reenvíos y los mails con «factura / FC / fac» en el asunto que todavía no se leyeron.'
    if (!window.confirm(`Vas a buscar el PDF de ${ids.length} factura(s).\n${comoBusca}\nCorre en segundo plano: el avance y el informe quedan en el cartel de arriba a la derecha.\n\n¿Continuar?`)) return
    cancelarPdfRef.current = false
    setBuscandoPdfs(true)
    try {
      const res = await buscarPdfLote({
        empresa: empresa as 'MSA' | 'PAM' | 'MA', facturaIds: ids, donde,
        facturas: ids.map(facturaSinPdf).filter(Boolean) as FacturaArca[], onProgreso: setProgresoPdf, delayMs: 1500,
        isCancelled: () => cancelarPdfRef.current,
      })
      await refrescarTrasBuscar()
      if (res.resumenError) toast.error('Búsqueda lista, pero el mail resumen NO se envió: ' + res.resumenError)
      else if (res.resumenEnviado) toast.success('Búsqueda lista. Mail resumen enviado.')
    } catch (err) {
      toast.error('Error en la búsqueda: ' + (err as Error).message)
    } finally {
      setBuscandoPdfs(false)
      setRecargaUltimasSinPdf(n => n + 1)
    }
  }
  // 📨 «Nos mandó la factura» (A-FEAT-1313): la respuesta al pedido, sólo en el mail y desde el día del pedido
  const buscarRespuestasSinPdf = async (ids: string[]) => {
    const pedidoDe: Record<string, string> = {}
    for (const id of ids) { const p = ultimasSinPdf.get(id)?.pedido; if (p) pedidoDe[id] = diaArgentino(new Date(p)) }
    const conPedido = ids.filter(id => pedidoDe[id])
    if (conPedido.length === 0) { toast.error('Ninguna de éstas tiene un pedido al proveedor registrado.'); return }
    cancelarPdfRef.current = false
    setBuscandoPdfs(true)
    try {
      await buscarPdfLote({
        empresa: empresa as 'MSA' | 'PAM' | 'MA', facturaIds: conPedido, respuesta: { pedidoDe },
        facturas: conPedido.map(facturaSinPdf).filter(Boolean) as FacturaArca[], onProgreso: setProgresoPdf, delayMs: 1000,
        isCancelled: () => cancelarPdfRef.current, enviarResumen: false,
      })
      await refrescarTrasBuscar()
    } catch (err) {
      toast.error('Error buscando las respuestas: ' + (err as Error).message)
    } finally {
      setBuscandoPdfs(false)
      setRecargaUltimasSinPdf(n => n + 1)
    }
  }

  // «Es ésta» / «No es ésta» sobre un candidato, desde el informe o desde «A confirmar» (A-FEAT-1287)
  const elegirCandidatoUrl = async (facturaId: string, url: string): Promise<boolean> => {
    const r = await fetch('/api/gas/confirmar-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factura_id: facturaId, empresa, drive_url: url }) })
    const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
    if (!d.ok) { toast.error('No se pudo confirmar: ' + (d.error || '')); return false }
    alConfirmarCandidato(facturaId, d.drive_url || url)
    return true
  }
  const descartarCandidatoUrl = async (facturaId: string, url: string, motivo: string): Promise<number | null> => {
    const r = await fetch('/api/gas/descartar-candidato', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factura_id: facturaId, empresa, drive_url: url, motivo }) })
    const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
    if (!d.ok) { toast.error('No se pudo descartar: ' + (d.error || '')); return null }
    if (d.fc_nuevo) {
      setFacturas(prev => prev.map(x => x.id === facturaId ? { ...x, fc: d.fc_nuevo } : x))
      setFacturasOriginales(prev => prev.map(x => x.id === facturaId ? { ...x, fc: d.fc_nuevo } : x))
      setFacturasPeriodo(prev => prev.map(x => x.id === facturaId ? { ...x, fc: d.fc_nuevo } : x))
    }
    toast.success(d.fc_nuevo ? `Descartado. No quedan candidatos: pasó a ${d.fc_nuevo}.` : 'Descartado.')
    return Number(d.quedan ?? 0)
  }
  // «Confirmada» es el sí del administrador y siempre con archivo (usuario 2026-10-21): desde una APP
  // (mismo archivo) o pegando el link de Drive en el aviso «sin comprobante». Sin link no se confirma.
  const confirmarConLink = async (factura: Pick<FacturaArca, 'id'>, link: string | null | undefined, preguntar: string): Promise<boolean> => {
    const url = linkParaConfirmar(link)
    if (!url) { toast.error('Hace falta el link del PDF en Google Drive para dejarla Confirmada.'); return false }
    if (!window.confirm(preguntar)) return false
    const { error } = await supabase.schema(schemaName).from('comprobantes_arca')
      .update({ fc: 'Confirmada', pdf_drive_url: url, pdf_estado: 'descargado' }).eq('id', factura.id)
    if (error) { toast.error('No se pudo guardar: ' + error.message); return false }
    alConfirmarCandidato(factura.id, url)
    return true
  }

  // «Proveedor Portal» (A-FEAT-1287, 2026-10-20) — desde la lista de facturas sin PDF (Subdiarios o «sin
  // comprobante»; antes, Buscar PDFs): se marca el PROVEEDOR (las próximas búsquedas lo saltean) y sus
  // facturas cargadas que siguen sin 📎 pasan a Portal.
  const marcarProveedorPortal = async (cuit: string, proveedor: string): Promise<void> => {
    const porId = new Map<string, FacturaArca>()
    ;[...facturasOriginales, ...facturasPeriodo].forEach(f => porId.set(f.id, f))
    const suyas = Array.from(porId.values())
      .filter(f => String(f.cuit || '').replace(/\D/g, '') === cuit && f.estado !== 'historico' && !f.pdf_drive_url && !['Confirmada', 'APP', 'OK', 'No', 'Portal'].includes(f.fc || ''))
    if (!window.confirm(`¿${proveedor || 'Este proveedor'} manda sus facturas por portal?\n\nQueda marcado como Portal: la búsqueda deja de intentarlo y ${suyas.length} factura(s) suya(s) sin 📎 pasan a Portal.`)) return
    const r = await fetch('/api/gas/config-proveedor', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuit, fc_modo: 'portal' }),
    })
    const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
    if (!d.ok) { toast.error('No se pudo marcar el proveedor: ' + (d.error || '')); return }
    if (suyas.length > 0) {
      const ids = suyas.map(f => f.id)
      const { error } = await supabase.schema(schemaName).from('comprobantes_arca').update({ fc: 'Portal' }).in('id', ids)
      if (error) { toast.error('El proveedor quedó en Portal, pero sus facturas no: ' + error.message); return }
      const aPortal = (prev: FacturaArca[]) => prev.map(f => ids.includes(f.id) ? { ...f, fc: 'Portal' } : f)
      setFacturas(aPortal); setFacturasOriginales(aPortal); setFacturasPeriodo(aPortal)
    }
    setProvPorCuit(prev => prev[cuit] ? { ...prev, [cuit]: { ...prev[cuit], fc_modo: 'portal' } } : prev)
    toast.success(`${proveedor || 'Proveedor'} quedó como Portal`)
  }

  // Renderizar valor de celda según el tipo de columna
  const renderizarCelda = (factura: FacturaArca, columna: keyof FacturaArca) => {
    const valor = factura[columna]

    // Columna FC: mostrar valor + ícono PDF si tiene URL
    if (columna === 'fc') {
      // Colores y significado: el glosario único de estados FC (A-FEAT-1287)
      const v = (valor as string | null) ?? ''
      const cls = colorFc(v)
      return (
        <div className="flex items-center gap-1.5">
          {v && (
            <span title={ayudaFc(v)} className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${cls}`}>
              {v}
            </span>
          )}
          {factura.pdf_drive_url && (
            <a
              href={factura.pdf_drive_url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Ver PDF en Drive${factura.pdf_observaciones ? ' — ' + factura.pdf_observaciones : ''}`}
              onClick={(e) => e.stopPropagation()}
              className="text-blue-600 hover:text-blue-800"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </a>
          )}
          {v === 'VER' && (
            <button
              type="button"
              title="Ver los candidatos y elegir cuál es esta factura → queda Confirmada"
              onClick={(e) => { e.stopPropagation(); confirmarVer(factura) }}
              disabled={confirmandoId === factura.id}
              className="text-green-600 hover:text-green-800 disabled:opacity-40 text-xs font-bold leading-none"
            >
              {confirmandoId === factura.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '✓'}
            </button>
          )}
          {sePuedeConfirmarApp(factura) && (
            <button
              type="button"
              title="Revisé el archivo y es ésta → queda Confirmada"
              onClick={(e) => {
                e.stopPropagation()
                confirmarConLink(factura, factura.pdf_drive_url, `¿Confirmás que el archivo vinculado es el de ${factura.denominacion_emisor || 'esta factura'} ${factura.punto_venta}-${factura.numero_desde}? Pasa de APP a Confirmada.`)
              }}
              className="text-emerald-600 hover:text-emerald-800 text-xs font-bold leading-none"
            >
              ✓
            </button>
          )}
        </div>
      )
    }

    // En modo admin TODOS los campos son editables (incluso facturas históricas)
    const esEditable = modoEdicionAdmin
      ? true
      : (camposEditables.includes(columna as string) && factura.estado !== 'historico')
    const esCeldaEnEdicion = celdaEnEdicion?.facturaId === factura.id && celdaEnEdicion?.columna === columna
    
    if (columna === 'cuenta_contable') {
      console.log('🔍 DEBUG cuenta_contable:', { valor, esEditable, modoEdicion, camposEditables })
    }

    // Si esta celda está en edición (hook) para fechas, mostrar input del hook
    const esCeldaHookEnEdicion = (['fecha_estimada', 'fecha_vencimiento', 'fecha_pago'].includes(columna as string)) &&
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
              type="text"
              placeholder="0,00"
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
                  <SelectItem value="cuotas">Cuotas</SelectItem>
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
          ) : (columna === 'centro_costo') ? (
            <CentroCostoCombobox
              value={String(celdaEnEdicion.valor || '')}
              onValueChange={(v) => {
                setCeldaEnEdicion(prev => prev ? { ...prev, valor: v } : null)
                setTimeout(() => guardarCambio(), 50)
              }}
              autoFocus
              disabled={guardandoCambio}
              className="h-6 text-xs w-full"
            />
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
      case 'fecha_pago':
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
  const previsualizarImportacion = async (file: File) => {
    setCargandoPreview(true)
    setPreviewData(null)
    setResultadoImportacion(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('empresa', empresa)
      formData.append('preview', 'true')
      const res = await fetch('/api/import-facturas-arca', { method: 'POST', body: formData })
      const data = await res.json()
      setPreviewData(data)
    } catch {
      setPreviewData({ error: 'Error al previsualizar el archivo' })
    } finally {
      setCargandoPreview(false)
    }
  }

  // Cargar cuentas contables para el paso de imputación
  const cargarCuentasParaImport = async () => {
    const { data } = await supabase
      .from('cuentas_contables')
      .select('categ, nro_cuenta, cuenta_contable, nombre_totalizadora')
      .eq('imputable', true)
      .order('nombre_totalizadora')
      .order('categ')
    setCuentasContablesImport(data || [])
  }

  // Avanzar al paso de imputación después del preview
  const avanzarAImputacion = async () => {
    if (!previewData?.facturas) return
    // Cargar cuentas contables si no están cargadas
    if (cuentasContablesImport.length === 0) await cargarCuentasParaImport()
    // Inicializar datos de imputación para cada factura nueva
    const nuevas = (previewData.facturas as any[]).filter((f: any) => f.estado === 'nueva')
    setImputacionData(nuevas.map((f: any) => ({
      fila: f.fila,
      fc: '',   // Sin valor por defecto
      cuenta_contable: f.cuenta_contable_sugerida || null,
      buscar_pdf: true,  // A-FEAT-1287: por default se buscan todas (usuario 2026-10-16)
    })))
    // El mail de cada proveedor, para ofrecer cargar el que falta en la misma pantalla
    if (!esContable) await cargarMailesProveedores(nuevas.map((f: any) => cuitLimpio(f.cuit)))
    setPasoImportacion('imputacion')
  }

  // Búsqueda de PDFs después del import: la piden las filas tildadas «Buscar PDF» en la imputación
  // (A-FEAT-1287 — antes dependía de NEXT_PUBLIC_GAS_AUTODISPARO_IMPORT, que nunca se prendió).
  // Busca SOLO las facturas recién importadas, primero en la carpeta del mes y después en el mail.
  // También el «🔁 Volver a buscar las con error» del informe, con la misma opción de dónde buscar.
  const dispararBusquedaPostImport = async (ids: string[], donde?: 'ambos' | 'carpeta' | 'mail') => {
    try {
      if (!ids || ids.length === 0) return
      cancelarPdfRef.current = false
      setBuscandoPdfs(true)
      // A-FEAT-1287: el período de cada una, para mirar primero su carpeta. Si no se puede leer,
      // el lote sigue igual y va directo al mail (como antes).
      const { data: conPeriodo } = await supabase.schema(empresa.toLowerCase())
        .from('comprobantes_arca')
        .select('id, año_contable, mes_contable, fecha_emision, pdf_drive_url, denominacion_emisor, tipo_comprobante_desc, punto_venta, numero_desde')
        .in('id', ids)
      await buscarPdfLote({
        empresa: empresa as 'MSA' | 'PAM' | 'MA',
        facturaIds: ids,
        donde,
        // la «ñ» de `año_contable` confunde al tipado del select: se declara a mano
        facturas: (conPeriodo as unknown as FacturaParaCarpeta[] | null) || undefined,
        onProgreso: setProgresoPdf,
        delayMs: 1500,
        isCancelled: () => cancelarPdfRef.current,
      })
      await cargarFacturas()
    } catch (e) {
      console.error('Auto-disparo de búsqueda de PDFs falló (import OK igual):', e)
    } finally {
      setBuscandoPdfs(false)
    }
  }

  // Carga el mail (y estado GAS) de los proveedores de las facturas visibles, indexado por CUIT.
  // Se llama al importar, para mostrar/editar el mail en la imputación.
  const cargarMailesProveedores = async (cuits: string[]) => {
    const unicos = Array.from(new Set(cuits.filter(Boolean)))
    if (unicos.length === 0) { setProvPorCuit({}); return }
    const { data } = await supabase
      .from('proveedores')
      .select('id, cuit, email_facturacion, email_pagos, gas_habilitado, fc_modo')
      .in('cuit', unicos)
    const mapa: Record<string, { id: string; email_facturacion: string | null; email_pagos: string | null; gas_habilitado: boolean | null; fc_modo: string | null }> = {}
    ;(data || []).forEach((p: any) => { mapa[p.cuit] = { id: p.id, email_facturacion: p.email_facturacion, email_pagos: p.email_pagos, gas_habilitado: p.gas_habilitado, fc_modo: p.fc_modo } })
    setProvPorCuit(mapa)
    setProvEditMail({})
  }

  const cuitLimpio = (c: unknown) => String(c ?? '').replace(/[-\s]/g, '')

  /**
   * A-FEAT-1287: los mails de proveedor cargados en la imputación de la importación. Se guardan
   * DESPUÉS de importar porque un proveedor nuevo recién existe entonces. Mismo criterio que el
   * buscador: si no tenía mail, se lo habilita para búsqueda. Nada en silencio: si uno falla, se dice.
   */
  const guardarMailsDeImportacion = async (mails: Record<string, string>) => {
    const conMail = Object.entries(mails).map(([c, m]) => [cuitLimpio(c), m.trim()] as const).filter(([, m]) => m)
    if (conMail.length === 0) return
    const { data: provs, error } = await supabase.from('proveedores')
      .select('id, cuit, email_facturacion').in('cuit', conMail.map(([c]) => c))
    if (error) { toast.error('No se pudieron guardar los mails de proveedor: ' + error.message); return }
    let guardados = 0
    const fallas: string[] = []
    for (const [cuit, mail] of conMail) {
      const p = (provs || []).find((x: any) => cuitLimpio(x.cuit) === cuit)
      if (!p) { fallas.push(`${cuit} (el proveedor no se creó)`); continue }
      const payload: any = { proveedor_id: p.id, email_facturacion: mail }
      if (!p.email_facturacion) { payload.gas_habilitado = true; payload.fc_modo = 'mail' }
      try {
        const r = await fetch('/api/gas/config-proveedor', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const d = await r.json()
        if (d.ok) guardados++; else fallas.push(`${cuit} (${d.error || 'error'})`)
      } catch (e) {
        fallas.push(`${cuit} (${(e as Error).message})`)
      }
    }
    setProvEditMail({})
    if (guardados > 0) toast.success(`Mail de ${guardados} proveedor(es) guardado: sus facturas ya se pueden buscar.`)
    if (fallas.length > 0) toast.error('No se guardó el mail de: ' + fallas.join(' · '), { duration: 20000 })
  }

  // Guarda el mail del proveedor (por CUIT) desde la lista de facturas sin PDF vía el endpoint de config.
  // Si el proveedor no tenía mail, además lo habilita para búsqueda (gas_habilitado + fc_modo='mail')
  // para que el mail recién cargado se use de verdad; si no, quedaría cosmético.
  // `valor` = la sugerencia aceptada con «usar» (A-FEAT-1287): se guarda directo, sin pasar por el input.
  const guardarMailProveedor = async (cuit: string, valor: string): Promise<boolean> => {
    const prov = provPorCuit[cuit]
    if (!prov) { toast.error('No existe el proveedor para ese CUIT (cargalo en Config PDFs)'); return false }
    const nuevo = valor.trim()
    const eraVacio = !prov.email_facturacion
    setGuardandoMailCuit(cuit)
    try {
      const payload: any = { proveedor_id: prov.id, email_facturacion: nuevo || null }
      if (nuevo && eraVacio) { payload.gas_habilitado = true; payload.fc_modo = 'mail' }
      const r = await fetch('/api/gas/config-proveedor', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!d.ok) { toast.error('Error guardando mail: ' + (d.error || '')); return false }
      setProvPorCuit(prev => ({ ...prev, [cuit]: { ...prev[cuit], email_facturacion: nuevo || null, ...(nuevo && eraVacio ? { gas_habilitado: true, fc_modo: 'mail' } : {}) } }))
      toast.success(nuevo && eraVacio ? 'Mail guardado y proveedor habilitado para búsqueda.' : 'Mail del proveedor guardado.')
      return true
    } catch (e) {
      toast.error('Error de red: ' + (e as Error).message)
      return false
    } finally {
      setGuardandoMailCuit(null)
    }
  }

  const manejarImportacionExcel = async () => {
    if (!archivoImportacion) return

    setImportandoExcel(true)
    setResultadoImportacion(null)

    try {
      const formData = new FormData()
      formData.append('file', archivoImportacion)
      formData.append('empresa', empresa)
      formData.append('origen_factura', origenFactura)
      // Enviar datos de imputación (fc + cuenta_contable por fila)
      formData.append('imputacion', JSON.stringify(imputacionData))

      const response = await fetch('/api/import-facturas-arca', {
        method: 'POST',
        body: formData
      })

      const resultado = await response.json()
      setResultadoImportacion(resultado)

      if (resultado.success) {
        cargarFacturas()
        setMostrarImportador(false)
        setArchivoImportacion(null)
        setOrigenFactura('')
        setPasoImportacion('origen')
        setImputacionData([])
        // A-FEAT-1287: se busca el PDF de las filas tildadas en la imputación (reemplaza el
        // interruptor NEXT_PUBLIC_GAS_AUTODISPARO_IMPORT, que dejaba la búsqueda siempre apagada).
        // Primero se guardan los mails que se cargaron ahí: los proveedores nuevos recién existen
        // ahora (el import los crea al final), y sin el mail esa factura no tendría dónde buscarse.
        if (!esContable) {
          const tildadas = idsParaBuscarTrasImportar(imputacionData, resultado.idsPorFila)
          await guardarMailsDeImportacion({ ...provEditMail })
          if (tildadas.length > 0) dispararBusquedaPostImport(tildadas)
        }
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

  // Extrae el file_id de Drive de una URL (mismo criterio que el GAS).
  const extraerFileIdDrive = (url?: string | null): string | null => {
    if (!url) return null
    const m = String(url).match(/[-\w]{25,}/)
    return m ? m[0] : null
  }

  // Supervisión del archivo digital del período (Subdiarios): corre la auditoría OCR por tandas
  // EN 2DO PLANO (no bloquea: avance por toast, refresca la tabla al terminar). Reusa /api/gas/auditar-periodo.
  // soloNoAdjudicados=true → saltea los archivos YA vinculados a una factura (re-corrida rápida).
  const supervisarArchivoPeriodo = async (soloNoAdjudicados = false) => {
    if (!periodoConsulta || supervisandoArchivo) return
    const [mesStr, anioStr] = periodoConsulta.split('/') // formato MM/YYYY
    const mes = parseInt(mesStr), anio = parseInt(anioStr)
    if (!mes || !anio) { toast.error('Período inválido'); return }
    setSupervisandoArchivo(true)
    setOrigenListado('ocr')
    setHuerfanosSupervision([])
    const tId = toast.loading(soloNoAdjudicados ? 'Re-supervisando solo los sin adjudicar… (podés seguir trabajando)' : 'Supervisando archivo digital del período… (podés seguir trabajando)')
    const skip = new Set<string>()
    // Modo rápido: pre-cargar como "ya procesados" los archivos cuyos links ya están en una factura.
    if (soloNoAdjudicados) {
      facturasPeriodo.forEach(f => { const fid = extraerFileIdDrive(f.pdf_drive_url); if (fid) skip.add(fid) })
    }
    const matchedAcc: any[] = [], huerfanosAcc: any[] = []
    let sinPdf: any[] = [], links = 0, tanda = 0
    try {
      for (let guard = 0; guard < 500; guard++) {
        tanda++
        toast.loading(`Supervisando… (tanda ${tanda}, ${skip.size} archivos revisados) · podés seguir trabajando`, { id: tId })
        /**
         * Una tanda, con reintento en tanda chica.
         *
         * Se mantiene en 4 archivos porque **así venía funcionando**; no se baja a 1 "por las
         * dudas", que cuadruplicaría las vueltas para todos. Pero si una tanda falla, se reintenta
         * UNA vez con 1 solo archivo: si con 1 pasa, el problema era el volumen de la tanda; si con
         * 1 también falla, el problema es otro y el mensaje lo va a decir.
         */
        const pedirTanda = async (cuantos: number) => {
          const r = await fetch('/api/gas/auditar-periodo', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empresa, anio, mes, skip_file_ids: [...skip], max_files: cuantos }),
          })
          // El cuerpo se lee como texto: ante un error de plataforma no viene JSON, y un
          // `Unexpected token <` taparía el motivo real.
          const txt = await r.text()
          try {
            return JSON.parse(txt)
          } catch {
            return { ok: false, error: `HTTP ${r.status} — la respuesta no es JSON: ${txt.slice(0, 160)}` }
          }
        }

        let data = await pedirTanda(4)
        if (!data.ok) {
          toast.loading('La tanda falló; reintento con 1 archivo…', { id: tId })
          const reintento = await pedirTanda(1)
          if (reintento.ok) {
            toast.loading('Con 1 archivo por vuelta sí anda — sigo así (más lento)', { id: tId })
            data = reintento
          } else {
            toast.error(`Supervisión: ${reintento.error || 'error'}`, { id: tId, duration: 30000 })
            console.error('[supervisión OCR] tanda de 4:', data.error, '| tanda de 1:', reintento.error)
            return
          }
        }
        if (data.existe === false) { toast.warning(data.observaciones || 'La carpeta del período no existe', { id: tId }); return }
        links += data.links_agregados || 0
        for (const m of (data.matched || [])) { matchedAcc.push(m); if (m.file_id) skip.add(m.file_id) }
        for (const h of (data.huerfanos || [])) { huerfanosAcc.push(h); if (h.file_id) skip.add(h.file_id) }
        sinPdf = data.sin_pdf || sinPdf
        if (data.completo) break
      }
      // Enriquecer las vinculadas con proveedor·nº·monto (para que el mail muestre QUÉ vinculó, no solo el nombre de archivo).
      const matchedMail = matchedAcc.map((m: any) => {
        const f = facturasPeriodo.find(x => x.id === m.factura_id)
        return { ...m, numero: f ? `${f.punto_venta}-${f.numero_desde}` : '', proveedor: f?.denominacion_emisor || '', monto: f?.imp_total ?? null }
      })
      /**
       * Enriquecer las DOS listas que quedan abiertas, para que el mail sirva para ACTUAR y no sólo
       * para informar (pedido del usuario, 2026-09-03: *"que nombre las que hay en pdf pero no se
       * vincularon, y las que quedaron sin vincular. puede ser con sugerencias. así sería un buen
       * audit"*).
       *
       * - A cada **huérfano** se le pega su candidata ⭐, con la MISMA función que usa el panel
       *   (`sugerirFacturasHuerfano`) — no una segunda lógica que después se desincronice.
       * - A cada **factura sin PDF** se le pega el MOTIVO, que es lo que decide qué hacer con ella:
       *   una de Portal se baja del sitio, una de mail se busca, y una marcada «No» no se toca.
       *   Sin el motivo, la lista de 17 parecía 17 pendientes cuando en realidad eran 8.
       */
      // El resumen lo arma `armarResumenMail`, el mismo que usa el botón "Enviar estado
      // actualizado": dos armadores distintos se desincronizan y el mail termina dependiendo de
      // cuál botón tocaste.
      setHuerfanosSupervision(huerfanosAcc.map(h => ({ archivo: h.archivo, url: h.url, chars: h.chars })))
      await cargarFacturasPeriodo(periodoConsulta)

      // Cierre: log + mail con el acumulado
      await fetch('/api/gas/auditar-periodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa, anio, mes, finalizar: true, resumen: armarResumenMail(huerfanosAcc) }),
      })
      await cargarFacturasPeriodo(periodoConsulta) // refresca íconos/chips con los links nuevos
      toast.success(`Supervisión lista: ${links} PDF vinculados · ${matchedAcc.length} con archivo · ${huerfanosAcc.length} huérfano(s). Mail enviado.`, { id: tId })
    } catch (e) {
      toast.error('Error en supervisión: ' + (e as Error).message, { id: tId })
    } finally {
      setSupervisandoArchivo(false)
    }
  }

  /**
   * 🗂️ El veredicto a mano de un PDF sin vincular (A-FEAT-1287, usuario 2026-10-22). Se guarda en el
   * registro del archivo digital; si el PDF todavía no se leyó (salió de «Contar»), se registra ahí
   * mismo como «sin leer». `null` = sacar el veredicto.
   */
  const guardarVeredicto = async (h: { archivo: string; url: string }, v: Veredicto | null) => {
    const fid = fileIdDeUrl(h.url)
    if (!fid) { toast.error('No se pudo sacar el identificador del archivo de su link.'); return }
    const { data: u } = await supabase.auth.getUser()
    const nota = (notaVeredicto[h.url] ?? registroHuerfanos[fid]?.veredicto_nota ?? '').trim() || null
    const fila = {
      veredicto: v, veredicto_nota: v ? nota : null,
      veredicto_at: v ? new Date().toISOString() : null, veredicto_por: v ? (u.user?.email || null) : null,
    }
    const up = await supabase.from('arca_pdf_archivo_digital').update(fila).eq('file_id', fid).select('file_id')
    if (up.error) { toast.error('No se guardó el veredicto: ' + up.error.message); return }
    if ((up.data || []).length === 0) {
      const [mesStr, anioStr] = (periodoConsulta || '').split('/')
      const ins = await supabase.from('arca_pdf_archivo_digital').insert({
        file_id: fid, empresa,
        carpeta: (parseInt(anioStr) && parseInt(mesStr)) ? subcarpetasDelMes(empresa as 'MSA' | 'PAM' | 'MA', parseInt(anioStr), parseInt(mesStr)).join('/') : null,
        nombre_archivo: h.archivo, url: h.url, estado: 'sin_leer', ...fila,
      })
      if (ins.error) { toast.error('No se guardó el veredicto: ' + ins.error.message); return }
    }
    setRegistroHuerfanos(prev => ({ ...prev, [fid]: { ...(prev[fid] || { file_id: fid, estado: 'sin_leer' }), ...fila } }))
    setNotaVeredicto(prev => { const n = { ...prev }; delete n[h.url]; return n })
    toast.success(v ? `Veredicto: ${etiquetaVeredicto(v)}` : 'Veredicto sacado.')
  }

  /**
   * El motivo por el que una factura no tiene PDF. Es lo que decide QUE HACER con ella, y por eso
   * el mail las agrupa asi: de 17 faltantes, 7 se bajan del portal y 2 no se buscan -- el trabajo
   * real eran 8. Sin el motivo, una lista de 17 parece 17 pendientes.
   */
  const motivoSinPdf = (fc?: string | null) => {
    const v = String(fc || '').trim().toLowerCase()
    if (v === 'portal') return 'Se baja del portal del proveedor — no llega por mail'
    if (v === 'no') return 'Marcada para NO buscar — revisar si sigue valiendo'
    return 'Debería llegar por mail — correr el buscador de PDFs'
  }

  /**
   * Arma el resumen que viaja al mail, SIEMPRE desde el estado actual de la pantalla.
   *
   * Esta factorizado para que la corrida automatica y el boton "Enviar estado actualizado" manden
   * exactamente lo mismo: dos armadores distintos se desincronizan y el mail empieza a depender de
   * cual boton tocaste.
   */
  const armarResumenMail = (huerfanos: { archivo: string; url: string; chars?: number }[]) => {
    const conPdf = facturasPeriodo.filter(f => f.pdf_drive_url)
    const sinPdf = facturasPeriodo.filter(f => !f.pdf_drive_url)
    return {
      matched: conPdf.map(f => ({
        archivo: '', drive_url: f.pdf_drive_url,
        numero: `${f.punto_venta}-${f.numero_desde}`,
        proveedor: f.denominacion_emisor || '', monto: f.imp_total ?? null,
      })),
      sin_pdf: sinPdf.map(f => ({
        factura_id: f.id, denominacion: f.denominacion_emisor,
        numero: `${f.punto_venta}-${f.numero_desde}`, fc: f.fc, motivo: motivoSinPdf(f.fc),
      })),
      huerfanos: huerfanos.map(h => {
        const cand = sugerirFacturasHuerfano(h.archivo || '')
        const c = cand[0]
        return {
          ...h,
          sugerencia: c ? `${c.denominacion_emisor} · ${c.punto_venta}-${c.numero_desde} · ${formatearFecha(c.fecha_emision)}` : null,
          sugerencias_n: cand.length,
        }
      }),
    }
  }

  /**
   * Reenviar el reporte con el estado de AHORA — pedido del usuario (2026-09-04).
   *
   * El mail automatico sale al terminar la corrida, y apenas vinculas una factura a mano **queda
   * viejo**, igual que el registro archivado en la carpeta. La alternativa obvia —esperar a que el
   * usuario termine de vincular— la descarto el propio usuario: si no vincula nada, o cierra la
   * pantalla, el mail no saldria nunca y se perderia hasta la constancia de que la corrida se hizo.
   *
   * Entonces son las dos cosas: el automatico queda como constancia, y este boton manda el estado
   * al dia cuando vos decis que terminaste. Relee la carpeta (rapido, sin OCR) para que los
   * huerfanos sean los de verdad y no los que quedaron en pantalla.
   */
  const enviarEstadoActualizado = async () => {
    if (!periodoConsulta || supervisandoArchivo) return
    const [mesStr, anioStr] = periodoConsulta.split('/')
    const mes = parseInt(mesStr), anio = parseInt(anioStr)
    if (!mes || !anio) { toast.error('Período inválido'); return }
    setSupervisandoArchivo(true)
    const tId = toast.loading('Recalculando el estado y enviando el reporte…')
    try {
      await cargarFacturasPeriodo(periodoConsulta)  // los links de lo vinculado a mano
      const r = await fetch('/api/gas/conciliar-archivo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa, anio, mes }),
      })
      const d = await r.json()
      if (!d.ok) { toast.error('No se pudo releer la carpeta: ' + (d.error || 'error'), { id: tId }); return }
      const huerfanos = (d.huerfanos || []).map((h: any) => ({ archivo: h.archivo, url: h.url }))
      setHuerfanosSupervision(huerfanos)
      setOrigenListado('contar')

      const env = await fetch('/api/gas/auditar-periodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa, anio, mes, finalizar: true, resumen: armarResumenMail(huerfanos) }),
      })
      const je = await env.json()
      if (!je.ok) { toast.error('El reporte no se envió: ' + (je.error || 'error'), { id: tId }); return }
      toast.success('Reporte actualizado enviado, con el estado de ahora.', { id: tId })
    } catch (e) {
      toast.error('Error: ' + (e as Error).message, { id: tId })
    } finally {
      setSupervisandoArchivo(false)
    }
  }

  // Conciliar saldos del archivo (RÁPIDO, SIN OCR): lista la carpeta y la cruza contra los links
  // de las facturas → huérfanos (archivos sin factura) + cuántas facturas no-Portal quedan sin PDF.
  const conciliarSaldos = async () => {
    if (!periodoConsulta || supervisandoArchivo) return
    const [mesStr, anioStr] = periodoConsulta.split('/')
    const mes = parseInt(mesStr), anio = parseInt(anioStr)
    if (!mes || !anio) { toast.error('Período inválido'); return }
    setSupervisandoArchivo(true)
    setOrigenListado('contar')
    setHuerfanosSupervision([])
    setDetalleConciliacion([])
    const tId = toast.loading('Conciliando saldos del archivo…')
    try {
      const r = await fetch('/api/gas/conciliar-archivo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa, anio, mes }),
      })
      const d = await r.json()
      if (!d.ok) { toast.error('Conciliación: ' + (d.error || 'error'), { id: tId }); return }
      if (d.existe === false) { toast.warning('La carpeta del período no existe', { id: tId }); return }
      setHuerfanosSupervision((d.huerfanos || []).map((h: any) => ({ archivo: h.archivo, url: h.url })))
      setDetalleConciliacion(d.detalle || [])
      toast.success(`Saldos: ${d.total_archivos} archivos · ${d.con_link} vinculados · ${(d.huerfanos || []).length} sin vincular · ${d.faltantes} facturas sin PDF.`, { id: tId })
    } catch (e) {
      toast.error('Error al conciliar: ' + (e as Error).message, { id: tId })
    } finally {
      setSupervisandoArchivo(false)
    }
  }

  // Funciones para Subdiarios
  const cargarFacturasPeriodo = async (periodo: string) => {
    if (!periodo) {
      setFacturasPeriodo([])
      setSubtotales(null)
      return
    }
    recargarMesesEnviados()

    setCargandoSubdiarios(true)
    try {
      const [mes, año] = periodo.split('/') // FIX: formato es MM/YYYY
      console.log('🔍 DEBUG cargarFacturasSubdiarios:', { periodo, mes, año })
      const { data, error } = await supabase
        .schema(schemaName)
        .from('comprobantes_arca')
        .select('*')
        .eq('año_contable', parseInt(año))
        .eq('mes_contable', parseInt(mes))
        .order('fecha_emision', { ascending: false })

      if (error) throw error

      let facturas: FacturaArca[] = data || []
      // 📜 A-FEAT-1382 (JMS 27/10: «si Subdiarios permitiera ver los históricos —ya tiene los datos— deberíamos
      // poder vincular todas las facturas y ver cuántas faltan»). Si la app no tiene el mes, se muestra el del
      // histórico del contador. Si la app SÍ lo tiene, manda la app (diciembre: A-DAT-61) y no se mezcla.
      if (!facturas.length) {
        const h = await supabase.schema(schemaName).from('comprobantes_historico').select('*')
          .eq('anio_contable', parseInt(año)).eq('mes_contable', parseInt(mes))
          .order('fecha', { ascending: false }).order('id')
        if (h.error) throw h.error
        facturas = filasDelSubdiario([], h.data || []) as unknown as FacturaArca[]
      }
      setFacturasPeriodo(facturas)
      
      // Subtotales en 2 bloques (misma función que usa el Excel/PDF → siempre coinciden).
      setSubtotales(calcularSubtotalesSubdiario(facturas))
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
      if (mostrarImputadas) filtrosEstado.push('Imputado', 'Enviado')

      if (filtrosEstado.length === 0) {
        console.log('❌ No hay filtros de estado seleccionados')
        setFacturasImputacion([])
        return
      }

      let query = supabase.schema(schemaName).from('comprobantes_arca').select('*')

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
          query = query.in('ddjj_iva', ['Imputado', 'Enviado'])
               .eq('año_contable', parseInt(año))
               .eq('mes_contable', parseInt(mes))
          console.log('🔍 Filtro aplicado: fecha <= período Y Imputado del período')
        } else if (mostrarSinImputar && mostrarImputadas) {
          // Ambos: Sin imputar + Imputadas del período (CON filtro fecha ya aplicado arriba)
          query = query.or(`ddjj_iva.eq.No,and(ddjj_iva.in.(Imputado,Enviado),año_contable.eq.${parseInt(año)},mes_contable.eq.${parseInt(mes)})`)
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
      // 📨 A-FEAT-1295: una factura ya Enviada o presentada EN ESTE MISMO MES no se re-imputa —
      // re-imputarla la bajaría a «Imputado» sin que nadie lo pidiera.
      const yaEnElMes = new Set(facturasImputacion
        .filter(f => estaProtegido(f.ddjj_iva) && f.año_contable === parseInt(año) && f.mes_contable === parseInt(mes))
        .map(f => f.id))
      const facturasIds = Array.from(facturasSeleccionadas).filter(id => !yaEnElMes.has(id))
      if (facturasIds.length === 0) { alert('Las facturas elegidas ya están en ese mes.'); return }
      
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
          .schema(schemaName)
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

  /**
   * 📒 Mandar facturas a «Asientos Contables» (A-FEAT-1318, usuario 2026-10-22): las no informadas en
   * ARCA que no van al subdiario de IVA. Quedan sin mes contable (no entran en ningún subdiario ni en
   * el Libro IVA) y salen en la solapa «Asientos Contables» de los Papeles del balance.
   */
  const mandarAAsientosContables = async (ids: string[]) => {
    if (ids.length === 0) return
    const sel = [...facturasImputacion, ...facturasPeriodo].filter(f => ids.includes(f.id))
    const deArca = new Set(sel.filter(f => f.origen_factura === 'ARCA').map(f => f.id)).size
    // Sacarla de un subdiario enviado al contador o presentado pasa por la MISMA regla que cualquier
    // otro cambio (A-FEAT-1295, al mergear 2026-10-23): sólo admin, y con advertencia.
    const porId = new Map(sel.map(f => [f.id, f]))
    if (!confirmarDecision(evaluarCambioDDJJ({ estadosAfectados: Array.from(porId.values()).map(f => f.ddjj_iva),
      estadoNuevo: ESTADO_ASIENTO_CONTABLE, esAdmin: userRole === 'admin' }))) return
    const ok = window.confirm(
      `¿Mandar ${ids.length} factura(s) a «${NOMBRE_ASIENTOS_CONTABLES}»?

` +
      `No entran en ningún subdiario ni en el Libro IVA: salen en la solapa «${NOMBRE_ASIENTOS_CONTABLES}» de los ` +
      `Papeles del balance, en el ejercicio de su fecha de emisión, para que el contador las registre con asientos.` +
      (deArca > 0 ? `

⚠️ ${deArca} vienen de ARCA (están informadas): esas normalmente van al subdiario.` : '')
    )
    if (!ok) return
    try {
      for (let i = 0; i < ids.length; i += 20) {
        const { error } = await supabase.schema(schemaName).from('comprobantes_arca')
          .update(CAMBIO_A_ASIENTO_CONTABLE).in('id', ids.slice(i, i + 20))
        if (error) throw error
      }
      toast.success(`${ids.length} factura(s) en «${NOMBRE_ASIENTOS_CONTABLES}».`)
      setFacturasSeleccionadas(new Set())
      setFacturasSeleccionadasGestion(new Set())
      setFacturasImputacion(prev => prev.filter(f => !ids.includes(f.id)))
      if (periodoConsulta) await cargarFacturasPeriodo(periodoConsulta)
      if (asientosContables) await verAsientosContables()
    } catch (e) {
      toast.error('No se pudieron mover: ' + (e as Error).message)
    }
  }

  /** La lista de «Asientos Contables» de la empresa (todas, la más nueva primero). */
  const verAsientosContables = async () => {
    const { data, error } = await supabase.schema(schemaName).from('comprobantes_arca')
      .select('*').eq('ddjj_iva', ESTADO_ASIENTO_CONTABLE).order('fecha_emision', { ascending: false })
    if (error) { toast.error('No se pudo leer «Asientos Contables»: ' + error.message); return }
    setAsientosContables((data || []) as FacturaArca[])
  }

  /** Devolver una factura de «Asientos Contables» a sin imputar (para imputarla a un subdiario). */
  const sacarDeAsientosContables = async (f: FacturaArca) => {
    if (!window.confirm(`¿Sacar ${f.denominacion_emisor} ${f.punto_venta}-${f.numero_desde} de «${NOMBRE_ASIENTOS_CONTABLES}»?

Queda sin imputar, para imputarla a un subdiario.`)) return
    const { error } = await supabase.schema(schemaName).from('comprobantes_arca')
      .update(CAMBIO_DESDE_ASIENTO_CONTABLE).eq('id', f.id).eq('ddjj_iva', ESTADO_ASIENTO_CONTABLE)
    if (error) { toast.error('No se pudo: ' + error.message); return }
    toast.success('Quedó sin imputar.')
    await verAsientosContables()
  }

  // 📨 A-FEAT-1295: el subdiario se le mandó al contador. No es presentarlo, pero desde acá el mes
  // no se mueve sin advertencia, y el rol contable ya no lo toca.
  const marcarEnviado = async () => {
    if (!periodoConsulta) return
    if (!confirmarDecision(evaluarCambioDDJJ({ estadosAfectados: [], estadoNuevo: 'Enviado', esAdmin: userRole === 'admin' }))) return
    const imputadas = facturasPeriodo.filter(f => f.ddjj_iva === 'Imputado')
    if (imputadas.length === 0) return
    if (!window.confirm(
      `¿Marcar el período ${periodoConsulta} como ENVIADO AL CONTADOR?\n\n` +
      `${imputadas.length} factura(s) pasan a "Enviado". Desde ahí, moverlas o imputar otras a este mes ` +
      `te va a pedir confirmación, y el rol contable ya no las puede modificar.\n\n` +
      `Cuando el contador te avise que lo presentó, apretá "Confirmar DDJJ".`
    )) return
    const { error } = await supabase
      .schema(schemaName)
      .from('comprobantes_arca')
      .update({ ddjj_iva: 'Enviado' })
      .in('id', imputadas.map(f => f.id))
    if (error) {
      alert('Error al marcar enviado: ' + error.message)
      return
    }
    await cargarFacturasPeriodo(periodoConsulta)
    toast.success(`📨 ${periodoConsulta} marcado como enviado al contador (${imputadas.length} facturas)`)
  }

  const confirmarDDJJ = async () => {
    if (!periodoConsulta) return
    if (!confirmarDecision(evaluarCambioDDJJ({ estadosAfectados: [], estadoNuevo: 'DDJJ OK', esAdmin: userRole === 'admin' }))) return

    // Confirmar acción
    const confirmar = window.confirm(
      `¿Confirmar DDJJ para el período ${periodoConsulta}?\n\n` +
      `Esto cambiará TODAS las facturas "Imputado" y "Enviado" a "DDJJ OK" y el período quedará cerrado.\n\n` +
      `⚠️ Esta acción NO se puede deshacer.`
    )
    
    if (!confirmar) return

    try {
      const [mes, año] = periodoConsulta.split('/')
      
      // Actualizar todas las facturas imputadas del período a DDJJ OK
      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_arca')
        .update({ ddjj_iva: 'DDJJ OK' })
        .eq('mes_contable', parseInt(mes))
        .eq('año_contable', parseInt(año))
        .in('ddjj_iva', ['Imputado', 'Enviado'])

      if (error) {
        console.error('Error confirmando DDJJ:', error)
        alert('Error al confirmar DDJJ: ' + error.message)
        return
      }

      // Recargar facturas del período para mostrar cambios
      await cargarFacturasPeriodo(periodoConsulta)
      
      // DESCARGA AUTOMÁTICA: Obtener facturas actualizadas directamente de BD
      const { data: facturasActualizadas, error: errorFetch } = await supabase
        .schema(schemaName)
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
        .schema(schemaName)
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

      // Selección de carpeta — mismo flujo que usa ahora el Libro IVA Ventas (lib compartido)
      const destino = await elegirCarpetaDestino(carpetaPorDefecto, setCarpetaPorDefecto)
      if (destino.cancelado) {
        alert('📁 Descarga cancelada')
        return // Salir sin generar archivos
      }
      const directorioDestino = destino.directorio
      const ubicacionFinal = destino.ubicacion || 'carpeta Descargas'

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

  // Nombres únicos (nunca sobrescribe): implementación compartida con el Libro IVA Ventas.
  const generarNombreUnico = generarNombreUnicoLib

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

      // Resumen del subdiario en 2 bloques — MISMA función que el display en vivo (pantalla = Excel = PDF).
      const sub = calcularSubtotalesSubdiario(facturas)
      const bIva = sub.ivaCompras, bMono = sub.monotributo

      // Agregar filas de totales: Bloque 1 (crédito fiscal) + Bloque 2 (no crédito fiscal) + Detalle por Alícuotas.
      const filasExtras = [
        {},
        { 'Fecha': '📒 LIBRO IVA COMPRAS (generan crédito fiscal)', 'Neto Gravado': 'Neto Gravado', 'Neto No Gravado': 'Exento/No Grav.', 'Total IVA': 'IVA', 'Otros Tributos': 'Otros Trib.', 'Imp. Total': 'Total' },
        { 'Fecha': `Facturas (${bIva.fc.cantidad})`, 'Neto Gravado': formatearNumeroExcel(bIva.fc.imp_neto_gravado), 'Neto No Gravado': formatearNumeroExcel(bIva.fc.exento_no_gravado), 'Total IVA': formatearNumeroExcel(bIva.fc.iva), 'Otros Tributos': formatearNumeroExcel(bIva.fc.otros_tributos), 'Imp. Total': formatearNumeroExcel(bIva.fc.imp_total) },
        { 'Fecha': `Notas de Crédito (${bIva.nc.cantidad})`, 'Neto Gravado': formatearNumeroExcel(bIva.nc.imp_neto_gravado), 'Neto No Gravado': formatearNumeroExcel(bIva.nc.exento_no_gravado), 'Total IVA': formatearNumeroExcel(bIva.nc.iva), 'Otros Tributos': formatearNumeroExcel(bIva.nc.otros_tributos), 'Imp. Total': formatearNumeroExcel(bIva.nc.imp_total) },
        { 'Fecha': 'Total Neto (FC − NC)', 'Neto Gravado': formatearNumeroExcel(bIva.neto.imp_neto_gravado), 'Neto No Gravado': formatearNumeroExcel(bIva.neto.exento_no_gravado), 'Total IVA': formatearNumeroExcel(bIva.neto.iva), 'Otros Tributos': formatearNumeroExcel(bIva.neto.otros_tributos), 'Imp. Total': formatearNumeroExcel(bIva.neto.imp_total) },
        {},
        { 'Fecha': '📋 Comprobantes que no generan crédito fiscal (Fac C y B)', 'Imp. Total': 'Total' },
        { 'Fecha': `Comprobantes Fac B y C (${bMono.fc.cantidad})`, 'Imp. Total': formatearNumeroExcel(bMono.fc.total) },
        { 'Fecha': `Notas de crédito B y C (${bMono.nc.cantidad})`, 'Imp. Total': formatearNumeroExcel(bMono.nc.total) },
        { 'Fecha': 'Total Neto (FC − NC)', 'Imp. Total': formatearNumeroExcel(bMono.neto) },
        {},
        { 'Fecha': 'Detalle por Alícuotas', 'Tipo-N° Comp.': 'Neto $', 'Razón Social': 'Alíc.', 'C.U.I.T.': 'IVA $' },
        { 'Fecha': 'Al 0%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_0), 'Razón Social': '0.00', 'C.U.I.T.': formatearNumeroExcel(0) },
        { 'Fecha': 'Al 2.5%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_2_5), 'Razón Social': '2.50', 'C.U.I.T.': formatearNumeroExcel(totales.iva_2_5) },
        { 'Fecha': 'Al 5%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_5), 'Razón Social': '5.00', 'C.U.I.T.': formatearNumeroExcel(totales.iva_5) },
        { 'Fecha': 'Al 10.5%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_10_5), 'Razón Social': '10.50', 'C.U.I.T.': formatearNumeroExcel(totales.iva_10_5) },
        { 'Fecha': 'Al 21%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_21), 'Razón Social': '21.00', 'C.U.I.T.': formatearNumeroExcel(totales.iva_21) },
        { 'Fecha': 'Al 27%', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_27), 'Razón Social': '27.00', 'C.U.I.T.': formatearNumeroExcel(totales.iva_27) },
        { 'Fecha': 'TOTALES', 'Tipo-N° Comp.': formatearNumeroExcel(totales.neto_gravado), 'Razón Social': '----', 'C.U.I.T.': formatearNumeroExcel(totales.total_iva) },
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
        await guardarEnCarpeta(directorio, filename, XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))
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
      
      // Header profesional — la empresa sale de la vista, no hardcodeada (antes PAM y MA
      // salían con la razón social y el CUIT de MSA impresos en su propio Libro IVA).
      const datosEmp = DATOS_FISCALES[empresa]
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text(datosEmp.razonSocial, 20, 15)
      doc.text(cuitFormateado(datosEmp.cuit), 180, 15)
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
      doc.text(datosEmp.razonSocial, 20, 15)
      doc.text(cuitFormateado(datosEmp.cuit), 180, 15)
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
      
      // Resumen del subdiario en 2 bloques — MISMA función que el display en vivo (pantalla = Excel = PDF).
      const subPdf = calcularSubtotalesSubdiario(facturas)
      const pIva = subPdf.ivaCompras, pMono = subPdf.monotributo
      const yTotales = doc.lastAutoTable.finalY + 15
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      doc.text('LIBRO IVA COMPRAS (generan crédito fiscal):', 20, yTotales)
      autoTable(doc, {
        head: [['Concepto', 'Neto Gravado', 'Exento/No Grav.', 'IVA', 'Otros Trib.', 'Total']],
        body: [
          [`Facturas (${pIva.fc.cantidad})`, formatearNumeroPDF(pIva.fc.imp_neto_gravado).trim(), formatearNumeroPDF(pIva.fc.exento_no_gravado).trim(), formatearNumeroPDF(pIva.fc.iva).trim(), formatearNumeroPDF(pIva.fc.otros_tributos).trim(), formatearNumeroPDF(pIva.fc.imp_total).trim()],
          [`Notas de Crédito (${pIva.nc.cantidad})`, formatearNumeroPDF(pIva.nc.imp_neto_gravado).trim(), formatearNumeroPDF(pIva.nc.exento_no_gravado).trim(), formatearNumeroPDF(pIva.nc.iva).trim(), formatearNumeroPDF(pIva.nc.otros_tributos).trim(), formatearNumeroPDF(pIva.nc.imp_total).trim()],
          ['Total Neto (FC - NC)', formatearNumeroPDF(pIva.neto.imp_neto_gravado).trim(), formatearNumeroPDF(pIva.neto.exento_no_gravado).trim(), formatearNumeroPDF(pIva.neto.iva).trim(), formatearNumeroPDF(pIva.neto.otros_tributos).trim(), formatearNumeroPDF(pIva.neto.imp_total).trim()],
        ],
        startY: yTotales + 5,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
      })
      const yMono = doc.lastAutoTable.finalY + 10
      doc.setFont(undefined, 'bold')
      doc.text('Comprobantes que no generan crédito fiscal (Fac C y B):', 20, yMono)
      autoTable(doc, {
        head: [['Concepto', 'Total']],
        body: [
          [`Comprobantes Fac B y C (${pMono.fc.cantidad})`, formatearNumeroPDF(pMono.fc.total).trim()],
          [`Notas de crédito B y C (${pMono.nc.cantidad})`, formatearNumeroPDF(pMono.nc.total).trim()],
          ['Total Neto (FC - NC)', formatearNumeroPDF(pMono.neto).trim()],
        ],
        startY: yMono + 5,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
        columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 50, halign: 'right' } },
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
        await guardarEnCarpeta(directorio, filename, doc.output('arraybuffer'))
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
        .schema(schemaName)
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

    // El rol sale de la SESIÓN (prop userRole), no de la URL: desde el login real la URL ya no
    // dice quién sos. Ver MODULO_USUARIOS.md § Cambio de rumbo (2026-09-03).
    const rolUsuario = userRole
    
    // Validar permisos según rol y cambios de estado
    const facturasArray = Array.from(facturasSeleccionadasGestion)
    
    // 📨 A-FEAT-1295: lo enviado al contador o presentado (las facturas, o el mes al que van) sólo
    // lo toca el admin, con advertencia. La regla vive en lib/subdiarios/estado-ddjj.ts.
    const cambiaEstado = !!nuevoEstadoDDJJ && nuevoEstadoDDJJ !== 'sin-cambios'
    const cambiaPeriodo = !!nuevoPeriodo && nuevoPeriodo !== 'sin-cambios'
    const decision = evaluarCambioDDJJ({
      estadosAfectados: facturasPeriodo.filter(f => facturasArray.includes(f.id)).map(f => f.ddjj_iva),
      periodoDestino: cambiaPeriodo ? nuevoPeriodo : null,
      estadoPeriodoDestino: cambiaPeriodo ? await consultarEstadoPeriodo(supabase, schemaName, 'comprobantes_arca', nuevoPeriodo) : null,
      estadoNuevo: cambiaEstado ? nuevoEstadoDDJJ : null,
      esAdmin: rolUsuario === 'admin',
    })
    if (!confirmarDecision(decision)) return

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

        // Si se cambia a "No" o a «Asientos Contables» (A-FEAT-1318), limpiar año_contable y mes_contable
        if (nuevoEstadoDDJJ === 'No' || nuevoEstadoDDJJ === ESTADO_ASIENTO_CONTABLE) {
          updateData.año_contable = null
          updateData.mes_contable = null
          console.log('🧹 Limpiando año_contable y mes_contable por cambio a "No"')
        }
      }

      // «Asientos Contables» no tiene período: si además se eligió uno, manda el destino (A-FEAT-1318)
      if (nuevoPeriodo && nuevoPeriodo !== 'sin-cambios' && nuevoEstadoDDJJ !== ESTADO_ASIENTO_CONTABLE) {
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
          .schema(schemaName)
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
          .schema(schemaName)
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
    // Parsear la fecha como LOCAL desde el string (evita el corrimiento de zona horaria:
    // new Date("2026-07-16") es UTC medianoche → en Argentina cae al 15/07 → quincena mal).
    const [a, m, d] = (fechaVencimiento || '').slice(0, 10).split('-')
    const año = (a ?? '').slice(-2)
    const mes = (m ?? '01').padStart(2, '0')
    const dia = parseInt(d ?? '01', 10) || 1
    return `${año}-${mes} - ${dia <= 15 ? '1ra' : '2da'}`
  }

  // Nombre de carpeta: mismo formato de quincena '26-02 - 1ra' / '26-02 - 2da'
  const quincenaACarpeta = (quincena: string): string => quincena

  // Guardar TC de pago en Vista Pagos (individual o cola USD)
  const guardarTcPagoPagos = async () => {
    if (!modalTcPagoPagos) return
    const tc = parseFloat(tcPagoInputPagos.replace(/\./g, '').replace(',', '.'))
    if (!tc || tc <= 1) { toast.error('TC inválido (debe ser mayor a 1)'); return }

    const { error } = await supabase.schema(schemaName).from('comprobantes_arca')
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

  /**
   * ¿Ya se le retuvo a este proveedor **en el mes**, por **este régimen**?
   *
   * **A-BUG-193** — el período del mínimo es el **mes**, no la quincena.
   * **A-BUG-196** — y el mínimo es **por régimen**: el de Bienes no consume el de Servicios.
   * Palabras del usuario: *«un mínimo no aplica para otro tipo de facturación»*.
   *
   * 📌 `tipoSicore` es **opcional**: los portones que deciden si abrir el modal corren **antes** de
   * que se elija el régimen. Sin él responde lo de antes (¿retuvo por cualquiera?), que para abrir
   * una puerta alcanza — el cálculo de adentro, que sí sabe el tipo, decide el monto.
   */
  const verificarRetencionPrevia = async (
    cuit: string, quincena: string, tipoSicore?: string,
  ): Promise<boolean> => {
    try {
      const q = supabase
        .schema(schemaName)
        .from('comprobantes_arca')
        .select('id')
        .eq('cuit', cuit)
        .in('sicore', quincenasDelMes(quincena))
      const { data, error } = await (tipoSicore ? q.eq('tipo_sicore', tipoSicore) : q).limit(1)

      if (error) {
        console.error('Error verificando retención previa:', error)
        return false
      }

      return !!(data && data.length > 0)
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

      const tc = (factura.tc_pago ?? factura.tipo_cambio ?? 1) as number
      const netoGravado = (factura.imp_neto_gravado || 0) * tc
      const netoNoGravado = (factura.imp_neto_no_gravado || 0) * tc
      const opExentas = (factura.imp_op_exentas || 0) * tc
      const netoFactura = netoGravado + netoNoGravado + opExentas
      const minimoServicios = 67170 // Mínimo más bajo (Servicios/Transporte)
      const quincena = generarQuincenaSicore(factura.fecha_vencimiento || factura.fecha_estimada || new Date().toISOString())

      console.log('🔍 SICORE: Evaluando factura', {
        id: factura.id,
        proveedor: factura.denominacion_emisor,
        tc,
        netoGravado,
        netoNoGravado,
        opExentas,
        netoFactura,
        minimoServicios,
        esNegativa: netoFactura < 0
      })

      // Chequear estado_quincena ANTES de abrir el modal SICORE
      const { data: qChk } = await supabase
        .schema(schemaName)
        .from('sicore_retenciones')
        .select('estado_quincena')
        .eq('quincena', quincena)
        .eq('anulado', false)
        .order('estado_quincena', { ascending: false })
        .limit(1)
        .maybeSingle()
      const estadoQ = (qChk?.estado_quincena as string | undefined) ?? null
      if (estadoQ === 'declarada') {
        alert(`🔒 La quincena ${quincena} ya fue declarada a AFIP. No se pueden agregar nuevas retenciones.\nDebés rectificar la DDJJ con tu contadora antes de poder modificar.`)
        await cancelarGuardadoPendiente()
        return
      }
      if (estadoQ === 'cerrada') {
        const okWarn = window.confirm(
          `⚠️ La quincena ${quincena} ya está cerrada (TXT generado).\nAl agregar esta retención tendrás que regenerar el TXT y enviarlo de nuevo a tu contadora.\n\n¿Continuar?`
        )
        if (!okWarn) {
          await cancelarGuardadoPendiente()
          return
        }
      }

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

      /**
       * 🚪 **A-BUG-195 — el portón tiene que mirar si YA se retuvo en el mes.**
       *
       * El mínimo se consume una sola vez por período ([A-BUG-193](../PENDIENTES.md#a-bug-193)):
       * si al proveedor **ya se le retuvo este mes**, una factura por debajo del mínimo **sí
       * retiene**, sobre el neto completo. Cortar sólo por importe la dejaba afuera y se retenía
       * de menos.
       *
       * ✅ **El Cash Flow ya lo hacía así** (`califica = yaRetuvo || hayNegativa || …`). Era otra
       * vez un camino de dos: se arregló uno y el otro quedó vivo (§ `MODULO_CONCILIACION.md` 30.9.5).
       *
       * 📈 Y A-BUG-193 lo volvió más frecuente: con el período mensual hay **más** casos de «ya
       * retuvo» que con el quincenal.
       */
      const yaRetuvoEnElMes = await verificarRetencionPrevia(factura.cuit, quincena)

      // CASO NORMAL: Facturas positivas - aplicar filtro de mínimo, salvo que el mínimo ya esté consumido
      if (netoFactura <= minimoServicios && !yaRetuvoEnElMes) {
        console.log('✅ SICORE: No corresponde (menor a mínimo servicios)')
        // Ofrecer descuento pronto pago aunque no haya retención
        const aplicarDescuento = window.confirm(
          'No corresponde retención SICORE (monto menor al mínimo).\n\n¿Desea aplicar un descuento pronto pago?'
        )
        if (aplicarDescuento) {
          setFacturaEnProceso(factura)
          setMostrarModalSicore(true)
          setMontoRetencion(0)
          setDescuentoAdicional(0)
          setDescuentoDesglose(null)
          setDescuentoInputValor('')
          setDatosSicoreCalculo({ netoFactura, minimoAplicado: 0, baseImponible: netoFactura, esRetencionAdicional: false, sinRetencion: true })
          setPasoSicore('calculo')
        } else {
          await ejecutarGuardadoPendiente()
        }
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
    /** De qué PAGO salió. `null` = pago directo. Define qué comparte certificado (A-BUG-1222). */
    grupo_pago_id?: string | null
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
      // Asignar nro_comprobante y nro_certificado al insertar (no esperar al cierre TXT)
      const anoActual = new Date().getFullYear()

      // Detectar estado actual de la quincena (mira registros NO anulados de esa quincena)
      const { data: qInfo } = await supabase
        .schema(schemaName)
        .from('sicore_retenciones')
        .select('estado_quincena')
        .eq('quincena', params.quincena)
        .eq('anulado', false)
        .order('estado_quincena', { ascending: false }) // 'declarada' > 'cerrada' > 'abierta' alfabéticamente
        .limit(1)
        .maybeSingle()
      const estadoQ = (qInfo?.estado_quincena as string | undefined) ?? null

      // Defensivo: si la quincena ya fue declarada, no insertar nada.
      // El confirm interactivo (cerrada→confirm, declarada→bloqueo) corre antes en el modal SICORE.
      if (estadoQ === 'declarada') {
        console.error('🔒 registrarEnSicoreRetenciones: quincena DECLARADA, insert bloqueado por seguridad', params.quincena)
        return
      }

      // El nuevo registro hereda el estado actual de la quincena (cerrada o abierta)
      const nuevoEstadoQ = estadoQ === 'cerrada' ? 'cerrada' : 'abierta'

      // ── A-BUG-1222 — UN CERTIFICADO = UN PAGO ──────────────────────────────────────────
      //
      // 🧨 **Este es el camino GEMELO** del de `lib/sicore/registrar-retencion.ts`, con el mismo
      // bug y arreglado el mismo día. Es § 🗺️ *«se arregló un camino de los dos»* en su forma pura:
      // dos copias de la numeración, y tocar una sola dejaba el bug vivo en la mitad de los pagos
      // según desde qué pantalla se cobrara.
      //
      // La regla —un certificado = un PAGO, y lo que define el pago es la transferencia— vive en
      // `lib/sicore/clave-certificado.ts`. Acá: se reusa el número **sólo dentro del mismo grupo de
      // pago**; un pago directo estrena número siempre, aunque sea el mismo día y el mismo proveedor.
      const { data: mismoGrupo } = params.grupo_pago_id
        ? await supabase
            .schema(schemaName)
            .from('sicore_retenciones')
            .select('nro_comprobante, nro_certificado')
            .eq('cuit_emisor', params.cuit_emisor ?? '')
            .eq('tipo_sicore', params.tipo_sicore)
            .eq('quincena', params.quincena)
            .eq('grupo_pago_id', params.grupo_pago_id)
            .eq('anulado', false)
            .not('nro_comprobante', 'is', null)
            .limit(1)
            .maybeSingle()
        : { data: null }

      let nroComp: number
      let nroCert: string

      if (mismoGrupo?.nro_comprobante) {
        // Reutilizar números del grupo existente
        nroComp = mismoGrupo.nro_comprobante as number
        nroCert = mismoGrupo.nro_certificado as string
      } else {
        // Nuevo grupo — asignar siguiente número perpetuo
        // (incluye anulados para preservar cronología: el cert anulado conserva su nro)
        const { data: maxComp } = await supabase
          .schema(schemaName)
          .from('sicore_retenciones')
          .select('nro_comprobante')
          .not('nro_comprobante', 'is', null)
          .order('nro_comprobante', { ascending: false })
          .limit(1)
          .maybeSingle()
        nroComp = ((maxComp?.nro_comprobante as number | null) ?? 0) + 1

        const prefijoCert = `0000${anoActual}`
        const { data: maxCert } = await supabase
          .schema(schemaName)
          .from('sicore_retenciones')
          .select('nro_certificado')
          .like('nro_certificado', `${prefijoCert}%`)
          .order('nro_certificado', { ascending: false })
          .limit(1)
          .maybeSingle()
        const seqActual = maxCert?.nro_certificado
          ? parseInt((maxCert.nro_certificado as string).slice(-6), 10)
          : 0
        nroCert = `${prefijoCert}${String(seqActual + 1).padStart(6, '0')}`
      }

      const { error } = await supabase
        .schema(schemaName)
        .from('sicore_retenciones')
        .insert({
          ...params,
          nro_comprobante: nroComp,
          nro_certificado: nroCert,
          estado_quincena: nuevoEstadoQ,
        })
      if (error) console.error('⚠️ sicore_retenciones insert error (no interrumpe flujo):', error)
      else console.log('✅ sicore_retenciones registrado:', params.quincena, params.denominacion_emisor, `comp=${nroComp} cert=${nroCert} estado=${nuevoEstadoQ}`)
    } catch (err) {
      console.error('⚠️ sicore_retenciones excepción (no interrumpe flujo):', err)
    }
  }

  // Calcular retención según tipo seleccionado
  // FÓRMULA: (gravado + no_gravado + exento) - minimo_no_imponible = base_imponible * porcentaje
  const calcularRetencionSicore = async (factura: FacturaArca, tipo: TipoSicore) => {
    try {
      const tc = (factura.tc_pago ?? factura.tipo_cambio ?? 1) as number
      const netoGravado = (factura.imp_neto_gravado || 0) * tc
      const netoNoGravado = (factura.imp_neto_no_gravado || 0) * tc
      const opExentas = (factura.imp_op_exentas || 0) * tc
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

      // PRIMERO: ¿ya se retuvo a este proveedor en el MES? (A-BUG-193 — antes miraba sólo la quincena)
      // A-BUG-196: por régimen — acá el usuario ya eligió cuál.
      const yaRetuvo = await verificarRetencionPrevia(factura.cuit, quincena, tipo.tipo)
      console.log('🔍 SICORE: Verificación previa', { yaRetuvo, cuit: factura.cuit, quincena })

      let baseImponible = netoFactura
      let minimoAplicado = 0

      if (!yaRetuvo) {
        // Primera retención DEL MES: verificar si supera el mínimo específico del tipo
        if (netoFactura <= tipo.minimo_no_imponible) {
          // No corresponde retención pero dar opción de aplicar descuento pronto pago
          setDatosSicoreCalculo({ netoFactura, minimoAplicado: 0, baseImponible: netoFactura, esRetencionAdicional: false, sinRetencion: true })
          setTipoSeleccionado(tipo)
          setMontoRetencion(0)
          setDescuentoAdicional(0)
          setDescuentoDesglose(null)
          setDescuentoInputValor('')
          setPasoSicore('calculo')
          return
        }
        // Descontar mínimo no imponible: es la primera retención del mes
        baseImponible = netoFactura - tipo.minimo_no_imponible
        minimoAplicado = tipo.minimo_no_imponible
        console.log('📋 SICORE: Primera retención del MES - descuenta mínimo')
      } else {
        // Retención adicional: retener sobre monto completo (sin aplicar mínimo)
        baseImponible = netoFactura
        minimoAplicado = 0
        console.log('📋 SICORE: Retención adicional del MES - sin descuento mínimo')
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
    if (!facturaEnProceso || !datosSicoreCalculo) return

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

    // Recalcular base SICORE sobre neto ajustado (solo si aplica retención)
    const netoAjustado = (impGravado - descGravado) + (impNoGravado - descNoGravado) + (impExento - descExento)
    if (!datosSicoreCalculo.sinRetencion && tipoSeleccionado) {
      const minimoAplicado = datosSicoreCalculo.minimoAplicado
      const baseAjustada = Math.max(0, netoAjustado - minimoAplicado)
      const nuevaRetencion = baseAjustada * tipoSeleccionado.porcentaje_retencion
      setMontoRetencion(nuevaRetencion)
      setDatosSicoreCalculo({ ...datosSicoreCalculo, netoFactura: netoAjustado, baseImponible: baseAjustada })
    } else {
      // Sin retención: mantener montoRetencion en 0, solo actualizar neto
      setDatosSicoreCalculo({ ...datosSicoreCalculo, netoFactura: netoAjustado })
    }
  }

  // Limpiar descuento y restaurar cálculo SICORE original
  const limpiarDescuentoSicore = () => {
    if (!facturaEnProceso) return
    setDescuentoAdicional(0)
    setDescuentoDesglose(null)
    setDescuentoInputValor('')
    if (tipoSeleccionado && !datosSicoreCalculo?.sinRetencion) {
      calcularRetencionSicore(facturaEnProceso, tipoSeleccionado)
    } else {
      setMontoRetencion(0)
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
          .schema(schemaName)
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
          .schema(schemaName)
          .from('comprobantes_arca')
          .select('*')
          .in('estado', ['pendiente', 'pagar', 'preparado', 'echeq'])
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
    sicore?: { monto: number; tipo: string; quincena: string } | null,
    anticipoId?: string,   // cuando el pago es de un anticipo (no factura)
    anticipoObj?: any      // anticipo object cuando anticipoSicoreEnProceso no está disponible
  ) => {
    try {
      let registros: any[]

      if (anticipoId) {
        // Evitar duplicados: verificar si ya existe cheque para este anticipo
        const { data: existente } = await supabase.schema(schemaName).from('cheques')
          .select('id').eq('anticipo_id', anticipoId).limit(1)
        if (existente && existente.length > 0) return

        // Pago de anticipo via ECHEQ
        const ant = anticipoObj || anticipoSicoreEnProceso
        registros = [{
          numero:              datos.numero || null,
          banco:               datos.banco,
          monto:               sicore
                                 ? (ant?.monto || 0) - sicore.monto
                                 : (ant?.monto || 0),
          moneda:              'ARS',
          fecha_emision:       datos.fechaEmision,
          fecha_cobro:         datos.fechaCobro,
          beneficiario_nombre: ant?.nombre_proveedor || null,
          beneficiario_cuit:   ant?.cuit_proveedor || null,
          anticipo_id:         anticipoId,
          factura_id:          null,
          sicore:              sicore?.quincena  ?? null,
          monto_sicore:        sicore?.monto     ?? null,
          tipo_sicore:         sicore?.tipo      ?? null,
          concepto:            `Anticipo ${ant?.nombre_proveedor || ''}`,
        }]
      } else {
        // Pago de facturas via ECHEQ — filtrar las que ya tienen cheque registrado
        const idsFacturas = facturasACambiar.map(f => f.id)
        const { data: existentes } = await supabase.schema(schemaName).from('cheques')
          .select('factura_id').in('factura_id', idsFacturas)
        const yaExisten = new Set((existentes || []).map((e: any) => e.factura_id))
        const facturasNuevas = facturasACambiar.filter(f => !yaExisten.has(f.id))
        if (facturasNuevas.length === 0) return

        registros = facturasNuevas.map(f => ({
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
          anticipo_id:         null,
          sicore:              sicore?.quincena  ?? null,
          monto_sicore:        sicore?.monto     ?? null,
          tipo_sicore:         sicore?.tipo      ?? null,
          concepto:            `Pago ${f.denominacion_emisor}`,
        }))
      }

      const { error } = await supabase.schema(schemaName).from('cheques').insert(registros)
      if (error) console.error('Error guardando cheque(s):', error)
    } catch (e) {
      console.error('Error guardarCheques:', e)
    }
  }

  const resetearFactura = async (factura: FacturaArca) => {
    const esUSD = factura.moneda && factura.moneda !== 'PES' && factura.moneda !== 'ARS'
    const msg = esUSD
      ? `¿Resetear FC ${factura.numero_desde} a estado importado?\n\nEsto borrará:\n- Retención SICORE (v1 y v2)\n- TC de pago\n- Descuento aplicado\n- monto_a_abonar (vuelve a imp_total en ${factura.moneda})\n- Estado → pendiente`
      : `¿Resetear FC ${factura.numero_desde} a estado importado?\n\nEsto borrará:\n- Retención SICORE (v1 y v2)\n- Descuento aplicado\n- monto_a_abonar (vuelve a imp_total)\n- Estado → pendiente`
    if (!window.confirm(msg)) return

    try {
      // 1. Verificar estado_quincena del registro v2 (declarada→bloqueo, cerrada→confirm)
      if (factura.sicore || factura.monto_sicore) {
        const { data: retRows } = await supabase
          .schema(schemaName)
          .from('sicore_retenciones')
          .select('estado_quincena')
          .eq('factura_id', factura.id)
          .eq('anulado', false)
          .limit(1)
        const estado = retRows?.[0]?.estado_quincena as string | undefined
        if (estado === 'declarada') {
          alert('🔒 Esta retención ya fue declarada a AFIP. Para modificar debe rectificar la DDJJ.')
          return
        }
        if (estado === 'cerrada') {
          const okWarn = window.confirm(
            '⚠️ Esta quincena ya fue cerrada (TXT generado). Al anular tendrás que regenerar el TXT y enviarlo de nuevo a tu contadora.\n\n¿Continuar?'
          )
          if (!okWarn) return
        }
      }

      // 2. Anular registro v2 (conserva nro_comprobante/nro_certificado para cronología)
      const { error: errAnul } = await supabase
        .schema(schemaName)
        .from('sicore_retenciones')
        .update({
          anulado: true,
          fecha_anulacion: new Date().toISOString(),
          motivo_anulacion: `Reset FC ${factura.numero_desde}`,
        })
        .eq('factura_id', factura.id)
        .eq('anulado', false)
      if (errAnul) console.error('Error anulando sicore_retenciones:', errAnul)

      // 2. Resetear factura — monto_a_abonar = imp_total (siempre en moneda original).
      // fecha_pago se vacía; si hay vencimiento, fecha_estimada vuelve a ese venc (sino queda como está).
      const updateData: any = {
        estado: 'pendiente',
        sicore: null,
        monto_sicore: null,
        tipo_sicore: null,
        descuento_aplicado: null,
        tc_pago: null,
        monto_a_abonar: factura.imp_total,
        fecha_pago: null,
      }
      if (factura.fecha_vencimiento) updateData.fecha_estimada = factura.fecha_vencimiento
      const { error: errUpd } = await supabase
        .schema(schemaName)
        .from('comprobantes_arca')
        .update(updateData)
        .eq('id', factura.id)
      if (errUpd) throw errUpd

      // 3. Actualizar estado local
      const updated: FacturaArca = {
        ...factura,
        ...updateData,
      }
      setFacturas(prev => prev.map(f => f.id === factura.id ? updated : f))
      setFacturasOriginales(prev => prev.map(f => f.id === factura.id ? updated : f))
      setFacturasPagos(prev => prev.map(f => f.id === factura.id ? updated : f))
      setFacturasSeleccionadasPagos(prev => { const next = new Set(prev); next.delete(factura.id); return next })

      toast.success(`FC ${factura.numero_desde} reseteada a estado importado`)
    } catch (e: any) {
      toast.error('Error al resetear: ' + (e.message ?? e))
    }
  }

  // Confirmar DDJJ SICORE — bloquea modificaciones de la quincena
  const confirmarDDJJSicore = async (quincena: string) => {
    const registros = await buscarRetencionesV2(quincena) // excluye anulados
    if (registros.length === 0) return

    const sinTXT = registros.some((r: any) => r.nro_comprobante == null)
    if (sinTXT) {
      alert('⚠️ Esta quincena aún no fue exportada (faltan números de comprobante). Generá el Export v2 antes de confirmar la DDJJ.')
      return
    }

    // Requiere que la quincena esté CERRADA antes de poder declararla
    const todasCerradas = registros.every((r: any) => r.estado_quincena === 'cerrada' || r.estado_quincena === 'declarada')
    if (!todasCerradas) {
      alert('⚠️ Primero tenés que cerrar la quincena. Usá "Generar Export v2" y elegí "Descargar y cerrar".')
      return
    }

    const totalRet = registros.reduce((s: number, r: any) => s + (Number(r.retencion) || 0), 0)
    const ok = window.confirm(
      `¿Confirmar DDJJ SICORE quincena ${quincena}?\n\n` +
      `• ${registros.length} retenciones\n` +
      `• Total: $${totalRet.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n\n` +
      `⚠️ Una vez confirmada, no se podrán modificar ni resetear las retenciones de esta quincena.`
    )
    if (!ok) return

    const ids = registros.map((r: any) => r.id)
    const ahora = new Date().toISOString()
    const { error } = await supabase
      .schema(schemaName)
      .from('sicore_retenciones')
      .update({
        estado_quincena: 'declarada',
        fecha_declarada: ahora,
        ddjj_confirmada: true, // compat hasta cleanup
      })
      .in('id', ids)

    if (error) {
      alert('Error al confirmar DDJJ: ' + error.message)
      return
    }

    // Actualizar estado local en registrosV2
    setRegistrosV2(prev => prev.map((r: any) => ids.includes(r.id)
      ? { ...r, estado_quincena: 'declarada', fecha_declarada: ahora, ddjj_confirmada: true }
      : r
    ))
    alert(`✅ DDJJ SICORE confirmada — quincena ${quincena}`)
  }

  // Solo Admin — Resetear anticipo a estado pendiente (limpia SICORE si existe)
  const resetearAnticipo = async (anticipo: any) => {
    const tieneSicore = anticipo.sicore || anticipo.monto_sicore
    const msg = tieneSicore
      ? `¿Resetear anticipo a estado pendiente?\n\nEsto borrará:\n- Retención SICORE (v1 y v2)\n- monto_restante\n- Estado → pendiente`
      : `¿Volver anticipo a estado pendiente?`
    if (!window.confirm(msg)) return
    try {
      if (tieneSicore) {
        // Verificar estado_quincena del registro v2 (declarada→bloqueo, cerrada→confirm)
        const { data: retRows } = await supabase
          .schema(schemaName)
          .from('sicore_retenciones')
          .select('estado_quincena')
          .eq('anticipo_id', anticipo.id)
          .eq('anulado', false)
          .limit(1)
        const estado = retRows?.[0]?.estado_quincena as string | undefined
        if (estado === 'declarada') {
          alert('🔒 Esta retención ya fue declarada a AFIP. Para modificar debe rectificar la DDJJ.')
          return
        }
        if (estado === 'cerrada') {
          const okWarn = window.confirm(
            '⚠️ Esta quincena ya fue cerrada (TXT generado). Al anular tendrás que regenerar el TXT y enviarlo de nuevo a tu contadora.\n\n¿Continuar?'
          )
          if (!okWarn) return
        }

        // Anular registro v2 solo si aún no está vinculado a una FC
        const { error: errAnul } = await supabase
          .schema(schemaName)
          .from('sicore_retenciones')
          .update({
            anulado: true,
            fecha_anulacion: new Date().toISOString(),
            motivo_anulacion: 'Reset anticipo',
          })
          .eq('anticipo_id', anticipo.id)
          .is('factura_id', null)
          .eq('anulado', false)
        if (errAnul) console.error('Error anulando sicore_retenciones anticipo:', errAnul)
      }
      const { error } = await supabase
        .from('anticipos_proveedores')
        .update({
          estado_pago: 'pendiente',
          sicore: null,
          monto_sicore: null,
          tipo_sicore: null,
          monto_restante: null,
        })
        .eq('id', anticipo.id)
      if (error) throw error
      setAnticiposSeleccionadosPagos(prev => { const next = new Set(prev); next.delete(anticipo.id); return next })
      toast.success('Anticipo revertido a pendiente')
      await recargarAnticiposPagos()
    } catch (e: any) {
      toast.error('Error al revertir: ' + (e.message ?? e))
    }
  }

  const finalizarProcesoSicore = async () => {
    if (!facturaEnProceso) return
    // Permitir continuar si hay descuento aunque no haya retención SICORE
    if (!tipoSeleccionado && montoRetencion === 0 && descuentoAdicional === 0) return
    
    try {
      // PRIMERO: Ejecutar el cambio de estado pendiente (estado → 'pagar')
      await ejecutarGuardadoPendiente()
      
      // Retención y descuento están en ARS; imp_total puede ser USD → convertir retención a moneda original
      const tc = ((facturaEnProceso.tc_pago ?? facturaEnProceso.tipo_cambio ?? 1) as number)
      const retencionEnMoneda = tc > 1.01 ? montoRetencion / tc : montoRetencion
      const descuentoEnMoneda = tc > 1.01 && descuentoAdicional > 0 ? descuentoAdicional / tc : descuentoAdicional
      const saldoFinal = (facturaEnProceso.imp_total || 0) - retencionEnMoneda - descuentoEnMoneda
      const quincena = generarQuincenaSicore(facturaEnProceso.fecha_vencimiento || facturaEnProceso.fecha_estimada || new Date().toISOString())
      
      console.log('💾 SICORE: Finalizando proceso', {
        facturaId: facturaEnProceso.id,
        montoRetencion,
        descuentoAdicional,
        saldoFinal,
        quincena
      })
      
      // SEGUNDO: Actualizar factura con datos SICORE
      const esEcheqFactura = !!echeqPendienteRef.current
      const updateFactura: any = {
        monto_a_abonar: saldoFinal,
        sicore: quincena,
        monto_sicore: montoRetencion,
        tipo_sicore: tipoSeleccionado?.tipo || null,
        descuento_aplicado: descuentoAdicional > 0 ? descuentoAdicional : null,
      }
      if (esEcheqFactura) {
        updateFactura.estado = 'echeq'
        updateFactura.metodo_pago = 'echeq'
        updateFactura.fecha_cobro_echeq = echeqPendienteRef.current!.fechaCobro
      }
      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_arca')
        .update(updateFactura)
        .eq('id', facturaEnProceso.id)

      if (error) {
        throw new Error(error.message)
      }

      // ── Registrar en tabla nueva sicore_retenciones solo si hay retención real ──
      if (tipoSeleccionado && montoRetencion > 0) {
      // Usar los valores que ya calculó el modal (todos en ARS, con tc aplicado)
      const minimoAplicado = datosSicoreCalculo?.minimoAplicado ?? tipoSeleccionado.minimo_no_imponible
      const netoGravadoPagado = datosSicoreCalculo?.netoFactura ?? 0
      const baseImpNueva = datosSicoreCalculo?.baseImponible ?? Math.max(0, netoGravadoPagado - minimoAplicado)
      // totalPagado = imp_total en ARS menos descuento en ARS
      const totalPagado = Math.round(((facturaEnProceso.imp_total || 0) * tc - descuentoAdicional) * 100) / 100
      await registrarEnSicoreRetenciones({
        origen: procesandoColaSicore ? 'agrupacion' : 'directo',
        quincena,
        fecha_pago: facturaEnProceso.fecha_estimada || facturaEnProceso.fecha_vencimiento || hoyArgentina(),
        factura_id: facturaEnProceso.id,
        // 🔑 De qué PAGO salió: si la factura va en un grupo, todas las del grupo comparten
        //    certificado; si es un pago directo queda `null` y estrena número (A-BUG-1222).
        grupo_pago_id: facturaEnProceso.grupo_pago_id || null,
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
        pago: Math.round((totalPagado - montoRetencion) * 100) / 100,
      })
      } // fin if (tipoSeleccionado && montoRetencion > 0)

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
      // saldoFinalARS: calcular en ARS para el mensaje (tc puede ser >1 para USD)
      const saldoFinalARS = (facturaEnProceso.imp_total || 0) * tc - montoRetencion - descuentoAdicional
      alert(`✅ Retención SICORE aplicada exitosamente\n\nQuincena: ${quincena}${descMsg}\nRetención: $${montoRetencion.toLocaleString('es-AR')}\nSaldo a pagar: $${saldoFinalARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)

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
          .schema(schemaName)
          .from('comprobantes_arca')
          .select('*')
          .in('estado', ['pendiente', 'pagar', 'preparado', 'echeq'])
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
      .schema(schemaName)
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
      .in('estado_pago', ['pendiente', 'pagar', 'preparado', 'programado', 'echeq'])
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
        await supabase.schema(schemaName).from('comprobantes_arca')
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
        // SICORE ya fue procesado: actualizar estado + monto_restante
        const saldo = (anticipo.monto || 0) - (anticipo.monto_sicore || 0)
        const esEcheq = !!echeqPendienteRef.current
        const updateData: any = {
          estado_pago: esEcheq ? 'echeq' : 'pagar',
          monto_restante: saldo
        }
        if (esEcheq) {
          updateData.metodo_pago = 'echeq'
          updateData.fecha_cobro_echeq = echeqPendienteRef.current!.fechaCobro
          updateData.fecha_pago = echeqPendienteRef.current!.fechaEmision
          await guardarCheques([], echeqPendienteRef.current!, null, anticipo.id, anticipo)
          echeqPendienteRef.current = null
        }
        const { error } = await supabase.from('anticipos_proveedores')
          .update(updateData)
          .eq('id', anticipo.id)
        if (error) { toast.error('Error: ' + error.message); return }
        toast.success(esEcheq ? 'Anticipo → ECHEQ emitido. SICORE ya aplicado.' : 'Anticipo pasado a "Pagar". Retención SICORE ya aplicada.')
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
    // 🐞 A-BUG-193 — las dos quincenas del MES (ver `verificarRetencionPrevia` arriba).
    const delMes = quincenasDelMes(quincena)
    // 🐞 A-BUG-196 — y por **régimen**: el mínimo de Bienes no consume el de Servicios.
    const qF = supabase.schema(schemaName).from('comprobantes_arca')
      .select('id').eq('cuit', cuit).in('sicore', delMes)
    const qA = supabase.from('anticipos_proveedores')
      .select('id').eq('cuit_proveedor', cuit).in('sicore', delMes).neq('id', anticipoSicoreEnProceso.id)
    const [{ data: d1 }, { data: d2 }] = await Promise.all([
      qF.eq('tipo_sicore', tipo.tipo).limit(1),
      qA.eq('tipo_sicore', tipo.tipo).limit(1),
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

    // Si viene de ECHEQ: usar fechaEmision del cheque para la quincena
    const fechaParaQuincena = echeqPendienteRef.current?.fechaEmision
      || anticipoSicoreEnProceso.fecha_pago
      || new Date().toISOString()
    const quincena = generarQuincenaSicore(fechaParaQuincena)
    const neto = parseFloat(netoGravadoAnt.replace(/\./g, '').replace(',', '.')) || 0
    const saldoFinal = Math.round(((anticipoSicoreEnProceso.monto || 0) - montoSicoreAnt - descuentoAnt) * 100) / 100

    // Chequear estado_quincena antes de confirmar la retención
    const { data: qChkAnt } = await supabase
      .schema(schemaName)
      .from('sicore_retenciones')
      .select('estado_quincena')
      .eq('quincena', quincena)
      .eq('anulado', false)
      .order('estado_quincena', { ascending: false })
      .limit(1)
      .maybeSingle()
    const estadoQAnt = (qChkAnt?.estado_quincena as string | undefined) ?? null
    if (estadoQAnt === 'declarada') {
      alert(`🔒 La quincena ${quincena} ya fue declarada a AFIP. No se pueden agregar nuevas retenciones.\nDebés rectificar la DDJJ con tu contadora antes de poder modificar.`)
      return
    }
    if (estadoQAnt === 'cerrada') {
      const okWarn = window.confirm(
        `⚠️ La quincena ${quincena} ya está cerrada (TXT generado).\nAl agregar esta retención tendrás que regenerar el TXT y enviarlo de nuevo a tu contadora.\n\n¿Continuar?`
      )
      if (!okWarn) return
    }

    console.log('[SICORE ANT] update:', { quincena, montoSicoreAnt, saldoFinal, id: anticipoSicoreEnProceso.id, echeq: !!echeqPendienteRef.current })

    // Si viene de ECHEQ: estado 'echeq', guardar fechas y metodo_pago
    const esEcheq = !!echeqPendienteRef.current
    const updateData: any = {
      estado_pago: esEcheq ? 'echeq' : 'pagar',
      sicore: quincena,
      monto_sicore: Math.round(montoSicoreAnt * 100) / 100,
      tipo_sicore: tipoSicoreAnt.tipo,
      monto_restante: saldoFinal,
      neto_gravado: neto,
    }
    if (esEcheq) {
      updateData.fecha_pago = echeqPendienteRef.current!.fechaEmision
      updateData.fecha_cobro_echeq = echeqPendienteRef.current!.fechaCobro
      updateData.metodo_pago = 'echeq'
    }

    const { error } = await supabase.from('anticipos_proveedores')
      .update(updateData)
      .eq('id', anticipoSicoreEnProceso.id)

    if (error) {
      console.error('[SICORE ANT] DB error:', error)
      toast.error('Error BD: ' + error.message + ' | code: ' + error.code)
      return
    }

    // ── Registrar en sicore_retenciones ──
    const totalPagadoAnt = Math.round(((anticipoSicoreEnProceso.monto || 0) - descuentoAnt) * 100) / 100
    /**
     * 🐞 **A-BUG-194 — lo que se GRABA tiene que ser lo que se CALCULÓ.**
     *
     * Acá se recalculaba la base restando **siempre** el mínimo del régimen, ignorando
     * `datosSicoreAnt`, que es donde vive el cálculo real: cuando ya se retuvo en el período, el
     * modal **no** aplica mínimo (`minimoAplicado: 0`) y retiene sobre el neto completo.
     *
     * 🧨 **La retención se guardaba bien y la base no**, así que el registro quedaba
     * contradiciéndose: `base × alícuota ≠ retención`. Y esa base es la que viaja al **TXT de
     * ARCA**.
     *
     * 📌 **Hasta [A-BUG-193](../PENDIENTES.md#a-bug-193) esto no se notaba**, porque el mínimo se
     * reiniciaba cada quincena y casi nunca había retención adicional: los dos números coincidían
     * por accidente. **Arreglar el período habría destapado esto**, no al revés.
     */
    const baseImpAnt = datosSicoreAnt?.baseImponible ?? Math.max(0, neto - (tipoSicoreAnt.minimo_no_imponible || 0))
    const minimoAnt = datosSicoreAnt?.minimoAplicado ?? (tipoSicoreAnt.minimo_no_imponible || 0)
    await registrarEnSicoreRetenciones({
      origen: 'anticipo',
      quincena,
      fecha_pago: fechaParaQuincena.split('T')[0],
      anticipo_id: anticipoSicoreEnProceso.id,
      factura_id: anticipoSicoreEnProceso.factura_id || null,
      // Un anticipo se paga solo: no hay grupo, así que su certificado es propio (A-BUG-1222).
      grupo_pago_id: null,
      cuit_emisor: anticipoSicoreEnProceso.cuit_proveedor,
      denominacion_emisor: anticipoSicoreEnProceso.nombre_proveedor,
      tipo_sicore: tipoSicoreAnt.tipo,
      alicuota: tipoSicoreAnt.porcentaje_retencion,
      neto_gravado_pagado: neto,
      total_pagado: totalPagadoAnt,
      descuento_aplicado: descuentoAnt,
      minimo_no_imponible: minimoAnt,   // A-BUG-194: el del cálculo, no el del régimen
      base_imponible: baseImpAnt,
      retencion: Math.round(montoSicoreAnt * 100) / 100,
      pago: saldoFinal,
    })

    // ── Guardar ECHEQ si aplica ──
    if (echeqPendienteRef.current) {
      await guardarCheques(
        [],  // no hay facturas, pasamos anticipo_id manualmente
        echeqPendienteRef.current,
        { monto: Math.round(montoSicoreAnt * 100) / 100, tipo: tipoSicoreAnt.tipo, quincena },
        anticipoSicoreEnProceso.id  // anticipo_id
      )
      echeqPendienteRef.current = null
      setEcheqPendiente(null)
    }

    // Cerrar modal primero, luego recargar lista
    setMostrarModalSicoreAnt(false)
    setAnticipoSicoreEnProceso(null)
    setTipoSicoreAnt(null)
    setDatosSicoreAnt(null)
    toast.success(`SICORE aplicado. Quincena: ${quincena} | Retención: $${(Math.round(montoSicoreAnt * 100) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Saldo: $${saldoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
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
        supabase.schema(schemaName).from('comprobantes_arca').select('*')
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
          .schema(schemaName)
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
        .schema(schemaName)
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

  const buscarRetencionesV2 = async (quincena: string, incluirAnulados = false) => {
    let query = supabase
      .schema(schemaName)
      .from('sicore_retenciones')
      .select('*')
      .eq('quincena', quincena)
    if (!incluirAnulados) {
      query = query.eq('anulado', false)
    }
    const { data, error } = await query.order('denominacion_emisor', { ascending: true })
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
      r.alicuota ? `${(Number(r.alicuota)*100).toFixed(2).replace(".", ",")}%` : '',
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
      await w.write(doc.output('arraybuffer'))
      await w.close()
    } else {
      doc.save(nombre)
    }
  }

  const generarTXTCierreV2 = async (registros: any[], quincena: string, directorio: any = null) => {
    // Cargar codigos de regimen desde BD
    const { data: tiposSicore } = await supabase.from('tipos_sicore_config').select('tipo, codigo_regimen')
    const regimenesMap: Record<string, string> = {}
    tiposSicore?.forEach((t: any) => { regimenesMap[t.tipo] = t.codigo_regimen || '000' })

    // Defensivo: filtrar anulados (no deberían venir, pero protegemos por si)
    const registrosAnuladosFuera = registros.filter((r: any) => !r.anulado)

    // ── Dedup de filas repetidas (A-BUG-146) ──────────────────────────────────────────────────
    //
    // 🐞 La FC 10-6337 de ALCORTA quedó con dos filas vigentes idénticas (doble click en
    // «Confirmar»). Como este agrupador **suma fila por fila** (`pago`, `neto_gravado_pagado`), el
    // renglón del certificado salía con **$170.358,89 de pago y $140.792,49 de base de más** — y
    // eso es lo que se le declara a ARCA.
    //
    // 🔑 **Hacen falta los dos arreglos.** La causa se tapó en `registrarEnSicoreRetenciones`, pero
    // eso sólo evita filas NUEVAS: **las que ya están en la base siguen ahí**, y el TXT las leería
    // igual. Por eso esta red, que además protege contra cualquier otra vía de duplicado.
    //
    // La clave incluye los importes a propósito: dos pagos parciales legítimos de la misma factura
    // en la misma quincena tienen distinto `total_pagado` y **no se colapsan**. El detalle y los
    // casos viven en `lib/sicore/dedup.ts` — acá no, porque adentro del componente no se prueba.
    const { vigentes: registrosVigentes, descartados } = deduplicarFilasSicore(registrosAnuladosFuera)
    // ⚠️ Nada se descarta en silencio (§ CLAUDE.md 🧮): si hubo duplicados, se dicen cuáles.
    if (descartados.length > 0) {
      console.warn(`🔁 TXT SICORE: ${descartados.length} fila(s) duplicada(s) descartada(s) del cálculo`,
        descartados.map((r: any) => ({ id: r.id, factura_id: r.factura_id, comp: r.numero_desde, pago: r.pago })))
      toast.warning(
        `${descartados.length} fila(s) duplicada(s) de SICORE quedaron fuera del TXT`,
        { description: 'El renglón se calculó sin ellas. Revisá A-BUG-146: siguen en la base y hay que limpiarlas.' }
      )
    }

    // Agrupar por cuit_emisor + tipo_sicore, guardando los IDs de cada grupo
    const grupos: Record<string, any> = {}
    for (const r of registrosVigentes) {
      const key = `${r.cuit_emisor}||${r.tipo_sicore}`
      if (!grupos[key]) {
        grupos[key] = {
          cuit_emisor: r.cuit_emisor,
          tipo_sicore: r.tipo_sicore,
          fecha_pago: r.fecha_pago,
          pago: 0,
          neto_gravado_pagado: 0,
          retencion: 0,
          ids: [] as string[],
        }
      }
      grupos[key].pago += Number(r.pago) || 0
      grupos[key].neto_gravado_pagado += Number(r.neto_gravado_pagado) || 0
      grupos[key].retencion += Number(r.retencion) || 0
      if (r.fecha_pago > grupos[key].fecha_pago) grupos[key].fecha_pago = r.fecha_pago
      grupos[key].ids.push(r.id)
    }

    // Un grupo cuya retención suma 0 NO es un certificado: es una factura que consumió parte del
    // mínimo y se pagó sin retener. Deja fila en `sicore_retenciones` para que el renglón del
    // certificado declare el pago y la base completos (ver `registrarConsumoDeMinimoCF` en el Cash
    // Flow), pero **no se le manda un renglón a AFIP con retención 0,00**.
    const gruposConRetencion = (Object.values(grupos) as any[]).filter(g => (Number(g.retencion) || 0) > 0)

    const gruposOrdenados = gruposConRetencion.sort((a: any, b: any) =>
      a.cuit_emisor.localeCompare(b.cuit_emisor)
    )

    // Las filas que sí forman parte de un certificado. El guard de idempotencia se mide sobre
    // éstas: las de retención 0 nunca reciben número, y mirándolas a todas `yaAsignados` daría
    // siempre `false` y **renumeraría una quincena ya cerrada**.
    const idsConCertificado = new Set(gruposOrdenados.flatMap((g: any) => g.ids as string[]))

    // Parsear quincena "26-03 - 1ra" → yy=26, mm=03, q=1
    const partes = quincena.split(' - ')
    const [yy, mm] = partes[0].split('-')
    const q = partes[1]?.startsWith('1') ? '1' : '2'
    const anoCompleto = '20' + yy

    // Verificar si esta quincena ya fue cerrada (guard idempotencia)
    // Si todos los registros ya tienen nro_comprobante asignado → reutilizar sin recalcular
    const yaAsignados = registrosVigentes
      .filter((r: any) => idsConCertificado.has(r.id))
      .every((r: any) => r.nro_comprobante != null)

    const padLeft  = (s: string, n: number) => s.padStart(n, ' ')
    const padRight = (s: string, n: number) => s.padEnd(n, ' ')
    // ARCA/SICORE 9.0 importa con separador decimal PUNTO (default de la config de importación).
    // Antes se convertía a coma; con v9.0 daba "el campo debería ser Numérico Positivo". Ver KNOWLEDGE #sicore.
    // Esto es SOLO para el TXT de SICORE (Excel/PDF siguen es-AR con coma, no van a ARCA).
    const formatMonto = (n: number, largo: number) =>
      padLeft(n.toFixed(2), largo)
    const formatFecha = (iso: string) => {
      const [a, m, d] = iso.split('-')
      return `${d}/${m}/${a}`
    }

    const CUIT_RETENEDOR = '30617786016'
    const lineas: string[] = []
    const asignaciones: Array<{ ids: string[], nroComp: number, nroCert: string }> = []

    if (yaAsignados) {
      // Quincena ya cerrada: usar números guardados en BD, no sobreescribir
      for (const g of gruposOrdenados) {
        // Tomar nro_comprobante/nro_certificado del primer registro del grupo (todos iguales)
        const primerReg = registrosVigentes.find((r: any) => g.ids.includes(r.id))
        const nroCompNum = Number(primerReg?.nro_comprobante ?? 0)
        const nroCert    = primerReg?.nro_certificado ?? ''
        const codigoRegimen = regimenesMap[g.tipo_sicore] || '000'
        const nroComp = padLeft(String(nroCompNum), 16)
        const fecha   = formatFecha(g.fecha_pago)

        const linea =
          '06'                              +
          fecha                             +
          nroComp                           +
          formatMonto(g.pago, 16)           +
          '0217'                            +
          codigoRegimen                     +
          '1'                               +
          formatMonto(g.neto_gravado_pagado, 14) +
          fecha                             +
          '01'                              +
          '0'                               +
          formatMonto(g.retencion, 14)      +
          '      '                          +
          '          '                      +
          '80'                              +
          padRight(g.cuit_emisor, 20)       +
          nroCert

        lineas.push(linea)
      }
    } else {
      // Quincena nueva: calcular próximos números y guardar en BD
      const MAX_NRO_COMP = 9999999999999999n
      const { data: maxCompRow } = await supabase
        .schema('msa').from('sicore_retenciones')
        .select('nro_comprobante')
        .not('nro_comprobante', 'is', null)
        .order('nro_comprobante', { ascending: false })
        .limit(1)
        .single()
      const maxComp = maxCompRow ? BigInt(maxCompRow.nro_comprobante) : 0n
      let nextComp = maxComp >= MAX_NRO_COMP ? 1n : maxComp + 1n

      // cert seq = mismo valor que nro_comprobante (siempre sincronizados)
      // pero reinicia por año: buscar MAX del seq interno del año actual
      const { data: maxCertRow } = await supabase
        .schema('msa').from('sicore_retenciones')
        .select('nro_certificado')
        .like('nro_certificado', `0000${anoCompleto}%`)
        .not('nro_certificado', 'is', null)
        .order('nro_certificado', { ascending: false })
        .limit(1)
        .single()
      const maxCertSeq = maxCertRow
        ? parseInt(maxCertRow.nro_certificado.slice(-6), 10)
        : 0
      let nextCertSeq = maxCertSeq + 1

      for (const g of gruposOrdenados) {
        const codigoRegimen = regimenesMap[g.tipo_sicore] || '000'
        const nroCompNum = Number(nextComp)
        const nroComp = padLeft(String(nroCompNum), 16)
        const nroCert = '0000' + anoCompleto + String(nextCertSeq).padStart(6, '0')
        const fecha   = formatFecha(g.fecha_pago)

        const linea =
          '06'                              +  // 1-2:   código comprobante
          fecha                             +  // 3-12:  fecha emisión comprobante
          nroComp                           +  // 13-28: nro comprobante (16, right)
          formatMonto(g.pago, 16)           +  // 29-44: importe comprobante (16, right)
          '0217'                            +  // 45-48: código impuesto
          codigoRegimen                     +  // 49-51: código régimen (3)
          '1'                               +  // 52:    código operación
          formatMonto(g.neto_gravado_pagado, 14) +  // 53-66: base de cálculo (14, right)
          fecha                             +  // 67-76: fecha emisión retención
          '01'                              +  // 77-78: código condición
          '0'                               +  // 79:    ret. sujetos suspendidos
          formatMonto(g.retencion, 14)      +  // 80-93: importe retención (14, right)
          '      '                          +  // 94-99: porcentaje exclusión (6 blancos)
          '          '                      +  // 100-109: fecha publicación (10 blancos)
          '80'                              +  // 110-111: tipo doc
          padRight(g.cuit_emisor, 20)       +  // 112-131: nro doc retenido (20, left)
          nroCert                              // 132-145: nro certificado (14)

        lineas.push(linea)
        asignaciones.push({ ids: g.ids, nroComp: nroCompNum, nroCert })

        nextComp = nextComp >= MAX_NRO_COMP ? 1n : nextComp + 1n
        nextCertSeq++
      }

      // Guardar en BD
      for (const asig of asignaciones) {
        for (const id of asig.ids) {
          await supabase.schema('msa').from('sicore_retenciones')
            .update({ nro_comprobante: asig.nroComp, nro_certificado: asig.nroCert })
            .eq('id', id)
        }
      }
    }

    const contenido = lineas.join('\r\n') + '\r\n'
    const nombreArchivo = `GE_${yy}_${mm}${q}_${CUIT_RETENEDOR}.TXT`
    const blob = new Blob([contenido], { type: 'text/plain' })

    const descargarBlob = () => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = nombreArchivo; a.click()
      URL.revokeObjectURL(url)
    }

    if (directorio) {
      try {
        const h = await directorio.getFileHandle(nombreArchivo, { create: true })
        const w = await h.createWritable()
        await w.write(blob); await w.close()
      } catch { descargarBlob() }
    } else {
      descargarBlob()
    }

    return { nombreArchivo, grupos: gruposOrdenados.length }
  }

  // Raíces de los templates SICORE: la campaña **25/26**, que es la primera. NO son "los" templates
  // SICORE — son el **arranque del linaje**.
  //
  // 🐞 **A-BUG-63** — hasta 2026-08-27 acá decía "IDs fijos de los templates SICORE" y se consultaba
  // `.in('egreso_id', [1RA, 2DA])` a secas. Al renovar la campaña, el clon es una fila **con otro
  // id** (Modelo A, § A-FEAT-42), así que al cerrar una quincena el modal ofrecía **sólo las cuotas
  // de 25/26** — que eran 2 y ya vencidas — y las 24 de 26/27 **no existían para la pantalla**.
  // Mismo patrón que tenían las reglas contable/interno: *un id hardcodeado no sobrevive a una
  // campaña nueva*. Cada campaña que se genere vuelve a romperlo, así que se resuelve por linaje.
  const RAIZ_SICORE_1RA = '19b879c7-d8c1-4633-8910-55e567e7394d'
  const RAIZ_SICORE_2DA = '2f0f8552-74ef-496a-9dbf-92ff97f6aca1'

  /**
   * Todos los templates de un linaje: la raíz más todos sus clones, generación por generación
   * (`template_origen_id` → hijo). Recorre en anchura porque el linaje crece **una campaña por año**:
   * 25/26 → 26/27 → 27/28… Con esto, generar la campaña siguiente **no vuelve a romper esto**.
   */
  const linajeTemplates = async (raizId: string): Promise<string[]> => {
    const ids = [raizId]
    let frontera = [raizId]
    // Cota de seguridad: si algún día un `template_origen_id` apunta en círculo, no cuelga la UI.
    for (let vuelta = 0; vuelta < 20 && frontera.length > 0; vuelta++) {
      const { data } = await supabase
        .from('egresos_sin_factura')
        .select('id')
        .in('template_origen_id', frontera)
      const hijos = (data ?? []).map((d: any) => d.id).filter((id: string) => !ids.includes(id))
      if (hijos.length === 0) break
      ids.push(...hijos)
      frontera = hijos
    }
    return ids
  }

  // Devuelve la fecha de corte para buscar la primera cuota venciente después de la quincena cerrada
  // 1ra quincena de MM → primer vencimiento posterior al 15/MM
  // 2da quincena de MM → primer vencimiento posterior al último día de MM
  const parsearCuotaSicore = (quincena: string): { cutoffDate: string } | null => {
    const match = quincena.match(/^(\d{2})-(\d{2}) - (1ra|2da)$/)
    if (!match) return null
    const [, yy, mm, tipo] = match
    const year = 2000 + parseInt(yy)
    const month = parseInt(mm)
    if (tipo === '1ra') {
      return { cutoffDate: `${year}-${String(month).padStart(2, '0')}-15` }
    } else {
      const ultimoDia = new Date(year, month, 0).getDate()
      return { cutoffDate: `${year}-${String(month).padStart(2, '0')}-${ultimoDia}` }
    }
  }

  const confirmarAsignacionCuotaSicore = async (cuotaId: string, totalRet: number, estado: string) => {
    const { error } = await supabase
      .from('cuotas_egresos_sin_factura')
      .update({ monto: totalRet, estado })
      .eq('id', cuotaId)
    if (error) { alert('Error actualizando cuota: ' + error.message); return }
    setModalAsignarCuotaSicore(null)
    alert(`✅ Cuota SICORE actualizada: $${totalRet.toLocaleString('es-AR', { minimumFractionDigits: 2 })} — estado: ${estado}`)
  }

  const abrirModalAsignarCuota = async (quincena: string, totalRet: number) => {
    // Los dos linajes completos: la campaña vieja Y todas las renovadas (A-BUG-63).
    const [linaje1ra, linaje2da] = await Promise.all([
      linajeTemplates(RAIZ_SICORE_1RA),
      linajeTemplates(RAIZ_SICORE_2DA),
    ])
    const esPrimeraQuincena = new Set(linaje1ra)
    const todosLosIds = [...linaje1ra, ...linaje2da]

    // De qué campaña es cada template. Sin esto, dos cuotas de campañas distintas se ven idénticas
    // en la lista y elegir bien es cuestión de suerte.
    // ⚠️ Va en consulta aparte y con `select('*')` **a propósito**: el parser de tipos de supabase-js
    // no sabe leer la `ñ` de `año` dentro del string de un select (falla con `ParserError`), así que
    // nombrar la columna —o embeberla— rompe el type-check. Con `*` no aparece en el string.
    const { data: tmplsLinaje } = await supabase
      .from('egresos_sin_factura')
      .select('*')
      .in('id', todosLosIds)
    const campanaDe = new Map<string, string>(
      (tmplsLinaje ?? []).map((t: any) => [t.id as string, (t.año ?? '') as string])
    )

    // Traer todas las cuotas pendientes de ambos linajes SICORE, ordenadas por fecha
    const { data: cuotas } = await supabase
      .from('cuotas_egresos_sin_factura')
      .select('id, fecha_estimada, monto, estado, egreso_id')
      .in('egreso_id', todosLosIds)
      .neq('estado', 'conciliado')
      .order('fecha_estimada', { ascending: true })

    const opciones = (cuotas ?? []).map((c: any) => {
      const template = esPrimeraQuincena.has(c.egreso_id) ? '1er Quincena' : '2da Quincena'
      const fecha = c.fecha_estimada
        ? new Date(c.fecha_estimada + 'T12:00:00').toLocaleDateString('es-AR')
        : 'sin fecha'
      const monto = Number(c.monto) !== 0
        ? ` — $${Number(c.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
        : ' — $0'
      const campana = campanaDe.get(c.egreso_id) ? ` · ${campanaDe.get(c.egreso_id)}` : ''
      return { id: c.id, label: `${template}${campana} | ${fecha}${monto}`, template }
    })

    // Cuota sugerida: la **primera que vence después** del cierre de la quincena (cualquier template
    // SICORE). Con los dos linajes cargados, esa cuota cae sola en la campaña vigente — que es lo
    // que se espera al cerrar una quincena de hoy.
    const info = parsearCuotaSicore(quincena)
    const sugerida = info
      ? (cuotas ?? []).find((c: any) => c.fecha_estimada > info.cutoffDate)
      : null

    // Si NINGUNA vence después del cierre (campaña sin renovar, o todas ya usadas), se cae a la
    // **última** disponible, no a la primera: `opciones` viene ordenada por fecha ascendente, así
    // que `[0]` es la más VIEJA — proponer una cuota vencida hace meses es la peor sugerencia posible.
    const respaldo = opciones.at(-1)?.id ?? ''
    const preseleccion = sugerida?.id ?? respaldo

    setModalAsignarCuotaSicore({
      quincena,
      totalRet,
      cuotas: opciones,
      cuotaIdSugerida: preseleccion,
      cuotaIdSeleccionada: preseleccion,
      estadoSeleccionado: 'pagar',
    })
  }

  const procesarCierreV2 = async (quincena: string, opciones: { cerrar?: boolean } = {}) => {
    try {
      setProcesandoCierreV2(true)
      const registros = await buscarRetencionesV2(quincena) // excluye anulados por defecto
      if (registros.length === 0) {
        alert(`No hay registros en sicore_retenciones para la quincena ${quincena}`)
        return
      }
      // Usar carpetaPorDefecto (mismo handle que usa el subdiario IVA)
      let subcarpeta: any = (carpetaPorDefecto && !carpetaPorDefecto.isFromStorage) ? carpetaPorDefecto : null
      if (!subcarpeta) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({ startIn: 'downloads' }).catch(() => null)
          if (dirHandle) {
            setCarpetaPorDefecto(dirHandle)
            subcarpeta = dirHandle
          }
        } catch { /* sin carpeta, descarga directa */ }
      }
      await generarExcelCierreV2(registros, quincena, subcarpeta)
      await generarPDFCierreV2(registros, quincena, subcarpeta)
      const txtInfo = await generarTXTCierreV2(registros, quincena, subcarpeta)
      const totalRet = registros.reduce((s: number, r: any) => s + (Number(r.retencion) || 0), 0)
      const totalPago = registros.reduce((s: number, r: any) => s + (Number(r.pago) || 0), 0)

      // Si la opción "cerrar" fue elegida → marcar la quincena como cerrada
      let mensajeCerrada = ''
      if (opciones.cerrar) {
        const { error: errCerrar } = await supabase
          .schema(schemaName)
          .from('sicore_retenciones')
          .update({
            estado_quincena: 'cerrada',
            fecha_cerrada: new Date().toISOString(),
          })
          .eq('quincena', quincena)
          .eq('anulado', false)
          .neq('estado_quincena', 'declarada') // no tocar registros ya declarados
        if (errCerrar) {
          console.error('Error marcando quincena como cerrada:', errCerrar)
          mensajeCerrada = '\n\n⚠️ Error marcando como cerrada — revisar consola.'
        } else {
          mensajeCerrada = '\n\n🔒 Quincena marcada como CERRADA.'
          // Refrescar registros locales
          setRegistrosV2(prev => prev.map((r: any) =>
            r.quincena === quincena && !r.anulado && r.estado_quincena !== 'declarada'
              ? { ...r, estado_quincena: 'cerrada', fecha_cerrada: new Date().toISOString() }
              : r
          ))
        }
      }

      alert(`✅ Cierre v2 generado — quincena ${quincena}\n\n• ${registros.length} registros (${txtInfo?.grupos} líneas TXT agrupadas)\n• Total retenciones: $${totalRet.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n• Total pagos netos: $${totalPago.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n• TXT ARCA: ${txtInfo?.nombreArchivo}${mensajeCerrada}`)

      // Proponer actualizar cuota del template SICORE (abre modal con selector)
      await abrirModalAsignarCuota(quincena, totalRet)
    } catch (error) {
      console.error('Error cierre v2:', error)
      alert('Error: ' + (error as Error).message)
    } finally {
      setProcesandoCierreV2(false)
    }
  }

  // Previsualizar conteo v2 al seleccionar quincena
  // incluirAnuladosOverride: si se pasa, gana sobre el state mostrarAnulados (resuelve stale closure)
  const previsualizarV2 = async (quincena: string, incluirAnuladosOverride?: boolean) => {
    setQuincenaSeleccionadaV2(quincena)
    setConteoV2(null)
    setRegistrosV2([])
    if (!quincena) return
    setCargandoV2(true)
    try {
      const incluirAnulados = incluirAnuladosOverride !== undefined ? incluirAnuladosOverride : mostrarAnulados
      let q = supabase.schema(schemaName).from('sicore_retenciones')
        .select('*')
        .eq('quincena', quincena)
      if (!incluirAnulados) {
        q = q.eq('anulado', false)
      }
      const { data } = await q.order('fecha_pago', { ascending: true })
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
  // El comprobante de pago en PDF vive en `lib/pagos/pdf-detalle-pago.ts` — ÚNICA implementación.
  // Acá había una copia inline con el mismo bug del Total Cancelado (A-BUG-24) y sin soporte
  // para el desglose por medios de pago. Se borró: Egresos y Cash Flow usan la misma función.

  // ── Certificado de Retención Ganancias ────────────────────────────────────
  const generarCertificadoRetencion = async (registros: Array<{
    id?: string | number
    cuit_emisor: string
    denominacion_emisor: string
    fecha_pago: string
    total_pagado: number
    retencion: number
    tipo_sicore: string
    nro_comprobante?: number | null
    nro_certificado?: string | null
  }>, returnBytes = false): Promise<ArrayBuffer | null> => {
    if (!registros.length) return null
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const mL = 15

      // Agregar montos del grupo
      const totalPagado = registros.reduce((s, r) => s + (Number(r.total_pagado) || 0), 0)
      const totalRetencion = registros.reduce((s, r) => s + (Number(r.retencion) || 0), 0)
      const registro = registros[0]

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
        if (t.includes('bien')) return 'ADQUISICIÓN DE BIENES'
        if (t.includes('servicio')) return 'LOCACIÓN DE SERVICIOS'
        if (t.includes('transporte')) return 'TRANSPORTE'
        return (registro.tipo_sicore || '').toUpperCase()
      })()

      // Nro comprobante (Orden de Pago) y Nro certificado
      const nroOP = registro.nro_comprobante
        ? String(registro.nro_comprobante).padStart(10, '0')
        : '----------'
      const nroCert = (() => {
        const raw = registro.nro_certificado || ''
        // formato BD: 0000YYYY000001 → mostrar YYYY-XXXXXX
        if (raw.length === 14) return `${raw.slice(4, 8)}-${raw.slice(8)}`
        return raw
      })()
      const comprobanteOrigen = `Orden de Pago Nro: ${nroOP}`

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
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Comprobante N°', mL, 33)
      doc.setFont('helvetica', 'italic')
      doc.text(nroCert, mL + 38, 33)
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
          fmt(totalPagado),
          fmt(totalRetencion),
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
      doc.text(fmt(totalRetencion), pageW - mL, afterTable + 15, { align: 'right' })

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
      const nombreArchivo = `CertRet_${nroCert}_${cuitClean}_${(registro.denominacion_emisor || '').replace(/\s+/g, '_').substring(0, 20)}.pdf`

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
    // Excluir anulados de la descarga masiva — no se emite certificado de algo anulado
    const registrosVigentes = registrosV2.filter((r: any) => !r.anulado)
    if (registrosVigentes.length === 0) {
      alert('No hay certificados vigentes para descargar (todos están anulados).')
      return
    }
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
      setDescargandoCerts(true)
      let count = 0

      /**
       * 🧾 **Se agrupa por la REGLA, no por el número guardado** (A-BUG-1222).
       *
       * Antes se agrupaba por `nro_certificado`, que parecía lo más directo — y era circular: si el
       * número estaba mal asignado, la descarga heredaba el error y juntaba en un PDF dos pagos
       * distintos. Pasó con BIOFARMA ($178.983,20 en un certificado que eran $69.213,15) y con LONGO.
       *
       * `agruparEnCertificados` aplica **un certificado = un pago**, así que la descarga sale bien
       * incluso sobre filas viejas cuyo número quedó repetido.
       */
      const grupos = agruparEnCertificados(registrosVigentes as Array<Record<string, unknown>>) as unknown as Array<typeof registrosVigentes>

      for (const grupo of grupos) {
        const bytes = await generarCertificadoRetencion(grupo, true)
        if (!bytes) continue
        const r0 = grupo[0]
        const nroCertKey = r0.nro_certificado
          ? (r0.nro_certificado.length === 14
              ? `${r0.nro_certificado.slice(4,8)}-${r0.nro_certificado.slice(8)}`
              : r0.nro_certificado)
          : String(r0.id || '')
        const cuitClean = (r0.cuit_emisor || '').replace(/\D/g, '')
        const nombre = `CertRet_${nroCertKey}_${cuitClean}_${(r0.denominacion_emisor || '').replace(/\s+/g, '_').substring(0, 20)}.pdf`
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

  // ── Encolar mail de Detalle de pago (cola public.mails_pago → GAS crea borradores) ──
  const abToBase64 = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf); let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }
  // Mapea un grupo de facturas ARCA a los items del detalle (reusado por el botón PDF y el de mail)
  const mapFacsAItems = (facs: Array<Record<string, unknown>>) => facs.map((f) => {
    const tc = (f.tc_pago ?? f.tipo_cambio ?? 1) as number
    return {
      comprobante: `FC ${f.tipo_comprobante}-${String((f.punto_venta as number) || 0).padStart(5, '0')}-${String((f.numero_desde as number) || 0).padStart(8, '0')}`,
      fecha: (f.fecha_emision as string) || '',
      fecha_estimada: (f.fecha_estimada as string) || (f.fecha_vencimiento as string) || null,
      fecha_pago: (f.fecha_pago as string) || null,   // A-BUG-152
      imp_total: ((f.imp_total as number) || 0) * tc,
      monto_sicore: f.monto_sicore as number | null,
      descuento_aplicado: f.descuento_aplicado as number | null,
      monto_a_abonar: montoPagoEnPesos(f as never),
      conversion: conversionDe(f as never),   // 💵 A-BUG-1245 — mismo renglón de conversión que el Cash Flow
    }
  })
  // Mapea un grupo de templates (egresos sin factura) a los items del detalle
  const mapTemplatesAItems = (ts: Array<Record<string, unknown>>) => ts.map((t) => ({
    comprobante: ((t.egreso as Record<string, unknown> | undefined)?.nombre_referencia as string) || (t.descripcion as string) || '-',
    fecha: (t.fecha_vencimiento as string) || (t.fecha_estimada as string) || '',
    imp_total: (t.monto as number) || 0,
    monto_a_abonar: (t.monto as number) || 0,
  }))
  // Wrapper de UI: delega en la lib compartida (lib/pagos/encolar-mail-detalle) y muestra el alert.
  // La lógica vive en la lib para que Cash Flow y cualquier otra vista la reusen (regla DRY).
  const encolarMailDetalle = async (
    tipo: 'arca' | 'template', proveedor: string, cuit: string,
    items: Parameters<typeof generarPDFDetallePago>[3],
    anticipo?: Parameters<typeof generarPDFDetallePago>[4],
    facturaIds?: string[]
  ) => {
    const r = await encolarMailDetalleLib({
      tipo, proveedor, cuit, items, schemaName, anticipo, facturaIds,
      registrosFallback: registrosV2 as Array<{ anulado?: boolean; cuit_emisor?: string }>,
    })
    if (!r.ok) { alert('Error encolando mail: ' + (r.error || '')); return }
    alert(r.email
      ? `✉ Mail de detalle encolado para ${proveedor} (${r.email})${r.conCertificado ? ' + certificado' : ''}`
      : `✉ Encolado para ${proveedor} — SIN email (cargá email_pagos del proveedor o completalo en el panel)`)
  }

  // Componente SubdiariosContent
  const SubdiariosContent = () => (
    <div className="space-y-6">
      {/* Controles principales */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Subdiarios DDJJ IVA</CardTitle>
          <p data-ayuda className="text-sm text-muted-foreground">
            Consulta períodos y gestión de imputaciones contables
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <TestsDelProceso proceso="subdiarios/estado-ddjj" pantalla="subdiarios" />
          {/* 📨 A-FEAT-1295: el estado de cada mes */}
          <EstadoMesesDDJJ
            meses={estadoMeses}
            onElegir={m => { setPeriodoConsulta(m); cargarFacturasPeriodo(m) }}
            ayuda="Tocá un mes para abrirlo. Cuando el contador te avise que presentó uno enviado, apretá «Confirmar DDJJ»."
          />
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
                <Permisable recurso="egresos.imputar">
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
                </Permisable>
                {/* 📒 A-FEAT-1318 */}
                <Button variant="outline" className="w-full" onClick={verAsientosContables}
                  title="Las facturas no informadas en ARCA que no van al subdiario: se exportan en los Papeles del balance para registrarlas con asientos">
                  📒 {NOMBRE_ASIENTOS_CONTABLES}
                </Button>
                
                {/* 📨 A-FEAT-1295: Enviado al contador — sólo admin, si hay facturas "Imputado" */}
                {userRole === 'admin' && periodoConsulta && facturasPeriodo.some(f => f.ddjj_iva === 'Imputado') && (
                  <Button
                    onClick={marcarEnviado}
                    variant="outline"
                    className="w-full border-blue-500 text-blue-700 hover:bg-blue-50"
                  >
                    📨 Marcar enviado al contador {periodoConsulta}
                  </Button>
                )}

                {/* Botón Confirmar DDJJ - sólo admin, si hay facturas "Imputado" o "Enviado" */}
                {userRole === 'admin' && periodoConsulta && facturasPeriodo.some(f => f.ddjj_iva === 'Imputado' || f.ddjj_iva === 'Enviado') && (
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
                {periodoConsulta && facturasPeriodo.length > 0 && !periodoHistorico && (
                  <Permisable recurso="egresos.gestionar-subdiario">
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
                  </Permisable>
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

                {/* Archivos de texto para IVA Simple — sólo MSA (PAM y MA no están inscriptas en IVA) */}
                {empresa === 'MSA' && periodoConsulta && facturasPeriodo.length > 0 && !periodoHistorico && (
                  <Permisable recurso="egresos.archivos-arca">
                  <Button
                    onClick={() => setMostrarArchivosArca(true)}
                    variant="outline"
                    className="w-full border-sky-600 text-sky-700 hover:bg-sky-50"
                  >
                    📤 Archivos para ARCA ({facturasPeriodo.length} facturas)
                  </Button>
                  </Permisable>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subtotales del período — estilo ARCA: 3 filas FC / NC / Total */}
      {subtotales && (() => {
        const fmt = (n: number) => `$${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        const fc = subtotales.ivaCompras?.fc
        const nc = subtotales.ivaCompras?.nc
        const neto = subtotales.ivaCompras?.neto
        const cantFC = fc?.cantidad || 0
        const cantNC = nc?.cantidad || 0
        return (
        <Card>
          <CardHeader>
            <CardTitle>📈 Subtotales Período {periodoConsulta}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Bloque 1: Libro IVA Compras */}
            <div>
              <h4 className="font-medium mb-2 text-sm">📒 Libro IVA Compras</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Concepto</th>
                      <th className="px-3 py-2 text-right font-medium">Neto Gravado</th>
                      <th className="px-3 py-2 text-right font-medium">Exento / No Gravado</th>
                      <th className="px-3 py-2 text-right font-medium">IVA</th>
                      <th className="px-3 py-2 text-right font-medium">Otros Tributos</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-3 py-2">Facturas{cantFC > 0 && <span className="text-gray-500 text-xs ml-1">({cantFC})</span>}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(fc?.imp_neto_gravado || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(fc?.exento_no_gravado || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(fc?.iva || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(fc?.otros_tributos || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(fc?.imp_total || 0)}</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2">Notas de Crédito{cantNC > 0 && <span className="text-gray-500 text-xs ml-1">({cantNC})</span>}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(nc?.imp_neto_gravado || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(nc?.exento_no_gravado || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(nc?.iva || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(nc?.otros_tributos || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(nc?.imp_total || 0)}</td>
                    </tr>
                    <tr className="border-t bg-blue-50 font-semibold">
                      <td className="px-3 py-2">Total Neto (FC − NC)</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(neto?.imp_neto_gravado || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(neto?.exento_no_gravado || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(neto?.iva || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(neto?.otros_tributos || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(neto?.imp_total || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bloque 2: Monotributo — FC C (tipo 11) y NC C (tipo 13) con 3 filas */}
            {(subtotales.monotributo?.fc?.cantidad > 0 || subtotales.monotributo?.nc?.cantidad > 0) && (() => {
              const mfc = subtotales.monotributo.fc
              const mnc = subtotales.monotributo.nc
              const mneto = subtotales.monotributo.neto
              return (
              <div>
                <h4 className="font-medium mb-2 text-sm">📋 Comprobantes que no generan crédito fiscal (Fac C y B)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Concepto</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-3 py-2">Comprobantes (Fac B y C){mfc.cantidad > 0 && <span className="text-gray-500 text-xs ml-1">({mfc.cantidad})</span>}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(mfc.total || 0)}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-3 py-2">Notas de crédito (B y C){mnc.cantidad > 0 && <span className="text-gray-500 text-xs ml-1">({mnc.cantidad})</span>}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(mnc.total || 0)}</td>
                      </tr>
                      <tr className="border-t bg-red-50 font-semibold">
                        <td className="px-3 py-2">Total Neto (FC − NC)</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(mneto || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              )
            })()}

            {/* Control: Total general − Neto − Exento/NG − IVA − Otros Trib. − (Fac B y C) = 0 */}
            <ControlCuadraturaSubdiario
              resultado={verificarCuadratura(facturasPeriodo, TIPOS_SIN_CREDITO_COMPRAS)}
              etiquetaSinCredito="Fac B y C (sin crédito fiscal)"
            />
            {/* 📥 A-AUTO-09: lo que devolvió el contador (zip del libro IVA de ARCA) contra este subdiario */}
            {periodoConsulta && facturasPeriodo.length > 0 && (
              <ControlContraPresentado facturas={facturasPeriodo as any} periodo={periodoConsulta} schemaName={schemaName} />
            )}
            {empresa === 'MSA' && (
              <ModalArchivosArca
                abierto={mostrarArchivosArca}
                onCerrar={() => setMostrarArchivosArca(false)}
                periodo={periodoConsulta}
                schemaName={schemaName}
                carpetaPorDefecto={carpetaPorDefecto}
                setCarpetaPorDefecto={setCarpetaPorDefecto}
              />
            )}
          </CardContent>
        </Card>
        )
      })()}

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
                {periodoHistorico && (
                  <p className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    📜 <b>Histórico del contador</b>: la app no tiene facturas de este mes, así que se muestran las que cargó el
                    contador. Son <b>de consulta</b>: no se imputan ni se editan acá. La 🚩 de cada fila sirve para pasarle una
                    corrección a alguien. Vincular sus PDF es el paso siguiente (A-FEAT-1382).
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!periodoHistorico && <>
                {/* 🔗 El botón de todos los días (JMS 27/10: «vincular con la carpeta sería una»). Lee cada PDF de la
                    carpeta del mes y lo pega a su factura; saltea las que ya tienen PDF. */}
                <Permisable recurso="egresos.vincular-pdf">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => supervisarArchivoPeriodo(true)}
                  disabled={supervisandoArchivo}
                  title="Lee los PDF de la carpeta del mes y pega cada uno a su factura (por CUIT, número e importe). Las que ya tienen PDF no se tocan."
                  className="flex items-center gap-2 border-blue-400 text-blue-700"
                >
                  {supervisandoArchivo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {supervisandoArchivo ? 'Vinculando…' : '🔗 Vincular con la carpeta'}
                </Button>
                </Permisable>
                <Permisable recurso="egresos.archivo-digital-mas"><span className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={conciliarSaldos}
                  disabled={supervisandoArchivo}
                  title="Cuenta los PDF de la carpeta contra los ya vinculados. No vincula nada."
                  className="flex items-center gap-2"
                >
                  {supervisandoArchivo ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  📊 Contar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => supervisarArchivoPeriodo(false)}
                  disabled={supervisandoArchivo}
                  title="Como «Vincular con la carpeta», pero vuelve a leer también las que ya tienen PDF."
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  🔁 Re-vincular todo
                </Button>
                {/* El mail automático sale al terminar la corrida y queda viejo apenas se vincula
                    algo a mano. Esto lo manda con el estado de AHORA. */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={enviarEstadoActualizado}
                  disabled={supervisandoArchivo}
                  title="Manda por mail el estado de ahora del archivo digital del mes."
                  className="flex items-center gap-2"
                >
                  📧 Mandar el estado
                </Button>
                </span></Permisable>
                <QueBotonUso />
                </>}
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
            </div>

            {/* 🔎 Buscador de Subdiarios (A-FEAT-1287, usuario 2026-10-22) */}
            <div className="mt-2 flex items-center gap-2">
              <Input value={buscarSubdiario} onChange={e => setBuscarSubdiario(e.target.value)}
                placeholder="🔎 Buscar: proveedor, CUIT, número, importe… (también en lo que dice cada PDF sin vincular)"
                className="h-8 text-sm max-w-xl" />
              {buscarSubdiario.trim() && (
                <>
                  <span className="text-xs text-muted-foreground">
                    {facturasPeriodo.filter(f => coincideBusqueda(buscarSubdiario, textosDeFactura(f))).length} factura(s)
                    {huerfanosSupervision.length > 0 && <> · {huerfanosSupervision.filter(h => coincideBusqueda(buscarSubdiario, [h.archivo, registroHuerfanos[fileIdDeUrl(h.url) || '']?.texto])).length} PDF sin vincular</>}
                  </span>
                  <button type="button" className="text-xs text-blue-600 underline" onClick={() => setBuscarSubdiario('')}>limpiar</button>
                </>
              )}
            </div>
            <TestsDelProceso proceso="egresos/archivo-digital" pantalla="egresos" />
            {/* ⏳ A-FEAT-1262 — nota del usuario 2026-10-13: «¿corre por detrás y puedo seguir trabajando
                en otra cosa? Debería avisar si es así porque me dio miedo abortar el proceso». */}
            {supervisandoArchivo && (
              <div className="mt-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                <strong>⏳ Está trabajando en segundo plano: podés seguir en otra pantalla de la app.</strong>{' '}
                El avance y el resultado te siguen en el cartel de arriba a la derecha, cada PDF queda vinculado
                en el momento en que lo encuentra, y al terminar te llega el mail con el resumen.{' '}
                <strong>Lo único que lo corta es cerrar o recargar la pestaña del navegador.</strong>{' '}
                Si te vas de esta pantalla, al volver la lista de «PDFs sin vincular» la recuperás con «📊 Contar».
              </div>
            )}

            {/* 🗂️ Resumen de archivo digital (PDF) — chips clickeables que filtran la tabla */}
            {(() => {
              const con = facturasPeriodo.filter(f => categoriaArchivo(f) === 'con').length
              const falta = facturasPeriodo.filter(f => categoriaArchivo(f) === 'falta').length
              const portal = facturasPeriodo.filter(f => categoriaArchivo(f) === 'portal').length
              // Ctrl+click = ver SOLO esa categoria (A-FEAT-1221, el gesto del Cash Flow).
              const chip = (cat: 'con' | 'falta' | 'portal', label: string, color: string) => {
                const activo = filtroArchivoPdf.has(cat)
                return (
                  <button type="button" title={tituloChip(label)}
                    onClick={(ev) => toggleChip(setFiltroArchivoPdf, cat, esSoloEste(ev))}
                    className={`px-2 py-0.5 rounded-full text-xs border transition ${activo ? color + ' ring-2 ring-offset-1' : color + ' opacity-80 hover:opacity-100'}`}>
                    {label}
                  </button>
                )
              }
              return (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">🗂️ Archivo digital:</span>
                  {chip('con', `📎 ${con} con PDF`, 'bg-green-100 text-green-800 border-green-300')}
                  {chip('falta', `❌ ${falta} faltantes`, 'bg-red-100 text-red-800 border-red-300')}
                  {chip('portal', `🌐 ${portal} Portal`, 'bg-gray-100 text-gray-700 border-gray-300')}
                  {huerfanosSupervision.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs border bg-amber-100 text-amber-800 border-amber-300"
                      title="PDFs en la carpeta del período que no están asociados a ninguna factura (ver panel abajo)">
                      🖼️ {huerfanosSupervision.length} PDF sin adjudicar
                    </span>
                  )}
                  {filtroArchivoPdf.size > 0 && (
                    <button type="button" className="text-xs text-blue-600 underline ml-1" onClick={() => setFiltroArchivoPdf(new Set())}>
                      limpiar filtro
                    </button>
                  )}
                </div>
              )
            })()}
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white border-b">
                  <TableRow>
                    {mostrarGestionMasiva && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={(() => {
                            const esAdminGestion = userRole === 'admin'
                            const seleccionables = esAdminGestion ? facturasPeriodo : facturasPeriodo.filter(f => !estaProtegido(f.ddjj_iva))
                            return seleccionables.length > 0 && facturasSeleccionadasGestion.size === seleccionables.length
                          })()}
                          onCheckedChange={(checked) => {
                            const esAdminGestion = userRole === 'admin'
                            if (checked) {
                              const seleccionables = esAdminGestion ? facturasPeriodo : facturasPeriodo.filter(f => !estaProtegido(f.ddjj_iva))
                              setFacturasSeleccionadasGestion(new Set(seleccionables.map(f => f.id)))
                            } else {
                              setFacturasSeleccionadasGestion(new Set())
                            }
                          }}
                        />
                      </TableHead>
                    )}
                    <TableHead className="w-28 text-center">Archivo / FC</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nº Comp.</TableHead>
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
                    {/* 🚩 Al final y PEGADA al borde derecho.
                        Va a la derecha porque el usuario pidió no cargar la parte izquierda, que es
                        la que se lee. Pero va **fija** (`sticky`) porque esta tabla scrollea
                        horizontal: sin eso la bandera queda más allá del borde y hay que ir a
                        buscarla scrolleando, que es lo contrario de "marco y sigo". */}
                    <TableHead
                      className="w-10 sticky right-0 z-20 bg-white text-center shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]"
                      title="Marcar para revisar"
                    >🚩</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facturasPeriodo
                    .filter(factura => filtroArchivoPdf.size === 0 || filtroArchivoPdf.has(categoriaArchivo(factura)))
                    .filter(factura => coincideBusqueda(buscarSubdiario, textosDeFactura(factura)))
                    .map(factura => {
                    const tc = Number(factura.tipo_cambio) || 1
                    const esUSD = factura.moneda === 'USD' || tc > 1.01
                    const p = (v: any) => (Number(v) || 0) * tc // pesos
                    return (
                    <TableRow key={factura.id} className={`${esUSD ? 'bg-amber-50' : ''} ${estaProtegido(factura.ddjj_iva) && mostrarGestionMasiva ? 'opacity-50' : ''}`}>
                      {mostrarGestionMasiva && (
                        <TableCell>
                          {estaProtegido(factura.ddjj_iva) && !(userRole === 'admin') ? (
                            <span title="Enviada al contador o presentada — sólo el admin puede modificar" className="text-xs">🔒</span>
                          ) : (
                            <Checkbox
                              checked={facturasSeleccionadasGestion.has(factura.id)}
                              onCheckedChange={(checked) => {
                                if (estaProtegido(factura.ddjj_iva) && checked) {
                                  toast.warning(factura.ddjj_iva === 'Enviado'
                                    ? 'Ya enviada al contador — al aplicar te va a pedir confirmación'
                                    : 'DDJJ ya presentada — al aplicar te va a pedir confirmación', { duration: 3000 })
                                }
                                const nuevaSeleccion = new Set(facturasSeleccionadasGestion)
                                if (checked) {
                                  nuevaSeleccion.add(factura.id)
                                } else {
                                  nuevaSeleccion.delete(factura.id)
                                }
                                setFacturasSeleccionadasGestion(nuevaSeleccion)
                              }}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(() => {
                            const cat = categoriaArchivo(factura)
                            if (cat === 'con') return (
                              <a href={factura.pdf_drive_url!} target="_blank" rel="noreferrer" title="Ver PDF en Drive" className="text-green-600">📎</a>
                            )
                            if (cat === 'portal') return <span title="De Portal — no se archiva por mail" className="text-gray-400">🌐</span>
                            return <span title="Falta el PDF en el archivo digital" className="text-red-600">❌</span>
                          })()}
                          {factura.fc && (
                            <span title={ayudaFc(factura.fc)} className={`px-1 rounded text-[9px] ${colorFc(factura.fc)}`}>{factura.fc}</span>
                          )}
                          {categoriaArchivo(factura) === 'con' && (
                            <button type="button" onClick={() => desvincularPdf(factura)}
                              title="Desvincular PDF (para re-asignar)" className="text-gray-300 hover:text-red-600">
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatearFecha(factura.fecha_emision)}</TableCell>
                      <TableCell className="max-w-48 truncate">
                        {esUSD && <span className="text-xs mr-1 text-amber-600">💵</span>}
                        {factura.denominacion_emisor}
                      </TableCell>
                      <TableCell>{factura.cuit}</TableCell>
                      <TableCell>{factura.tipo_comprobante}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{factura.punto_venta}-{factura.numero_desde}</TableCell>
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
                        } className={factura.ddjj_iva === 'Enviado' ? 'border-blue-400 text-blue-700 bg-blue-50' : ''}>
                          {factura.ddjj_iva === 'Enviado' ? '📨 Enviado' : factura.ddjj_iva}
                        </Badge>
                      </TableCell>
                      <TableCell className={`sticky right-0 z-10 text-center shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)] ${esUSD ? 'bg-amber-50' : 'bg-white'}`}>
                        <BotonRevision
                          schema={schemaName}
                          tabla={factura.estado === 'historico' ? 'comprobantes_historico' : 'comprobantes_arca'}
                          registroId={factura.id}
                          descripcion={`${factura.denominacion_emisor || 's/proveedor'} · ${factura.punto_venta}-${factura.numero_desde} · ${formatearFecha(factura.fecha_emision)} · $${(Number(factura.imp_total) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                          abierta={(factura.estado === 'historico' ? revisionesHistorico : revisionesFactura)[String(factura.id)]}
                          onCambio={() => { recargarRevisiones(); recargarRevisionesHistorico() }}
                        />
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
                        <SelectItem value="Enviado">📨 Enviado al contador</SelectItem>
                        <SelectItem value="DDJJ OK">DDJJ OK</SelectItem>
                        <SelectItem value={ESTADO_ASIENTO_CONTABLE}>📒 {NOMBRE_ASIENTOS_CONTABLES} (sale del subdiario)</SelectItem>
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

      {/* 👀 A confirmar del período: VER (elegir el archivo) y APP (confirmar el que vinculó la app) —
          venía de Buscar PDFs, retirada 2026-10-23 */}
      {(() => {
        const aConfirmar = facturasPeriodo.filter(f => ((f.fc === 'VER' && !f.pdf_drive_url) || (f.fc === 'APP' && !!f.pdf_drive_url))
          && coincideBusqueda(buscarSubdiario, textosDeFactura(f)))
        if (aConfirmar.length === 0) return null
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">👀 A confirmar ({aConfirmar.length})</CardTitle>
              <p data-ayuda className="text-sm text-muted-foreground">
                Esperan tu sí: <strong>VER</strong> tiene uno o más archivos posibles y la app no eligió; <strong>APP</strong> ya tiene
                el archivo que vinculó la app. Abrí el PDF y decí si es ésa: queda <strong>Confirmada</strong>.
              </p>
            </CardHeader>
            <CardContent>
              <PanelAConfirmar
                facturas={aConfirmar.map(f => ({ id: f.id, rotulo: `${f.tipo_comprobante_desc || 'FC'} ${f.punto_venta}-${f.numero_desde}`, proveedor: f.denominacion_emisor || '',
                  fc: f.fc ?? null, fecha_emision: f.fecha_emision, imp_total: f.imp_total, pdf_drive_url: f.pdf_drive_url }))}
                onElegir={elegirCandidatoUrl}
                onDescartar={(id, url) => descartarCandidatoUrl(id, url, 'desde Subdiarios')}
                onConfirmarApp={(id, url) => confirmarConLink({ id }, url, '¿Abriste el PDF y es ésta? Pasa de APP a Confirmada con el mismo archivo.')} />
            </CardContent>
          </Card>
        )
      })()}

      {/* ❌ Facturas sin PDF del período: pedirlas y buscarlas en el mail desde acá (2026-10-23) */}
      {facturasPeriodo.length > 0 && (!esContable || nivelDeclarado('egresos.faltantes-pdf') === 'escritura') && !periodoHistorico && <Permisable recurso="egresos.faltantes-pdf">{(() => {
        const { filas, pedidas } = faltantesDelSubdiario(facturasPeriodo, ultimasSinPdf, hoyArgentina())
        if (filas.length === 0) return null
        const visibles = filas.filter(f => coincideBusqueda(buscarSubdiario, [f.proveedor, f.cuit, f.comprobante, f.imp_total,
          (Number(f.imp_total) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]))
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                ❌ Facturas sin PDF ({filas.length})
                {pedidas.length > 0 && <span className="ml-2 text-sm font-normal text-amber-700">· {pedidas.length} pedida(s) al proveedor</span>}
              </CardTitle>
              <p data-ayuda className="text-sm text-muted-foreground">
                Las que están en el subdiario y les falta el PDF (las mismas del chip «❌ faltantes»). Tildá las que quieras y
                pedilas — <strong>📋 copiar</strong> arma el texto para mandárselo a quien sea, <strong>📮</strong> le escribe a cada
                proveedor desde el mail — o buscalas en el mail. Lo encontrado queda en APP para confirmar.
              </p>
              {buscarSubdiario.trim() && (
                <p className="text-xs text-blue-700">🔎 Filtrado por «{buscarSubdiario.trim()}»: {visibles.length} de {filas.length}. Los botones actúan sobre lo que se ve.</p>
              )}
              {renglonReenvios()}
            </CardHeader>
            <CardContent>
              <PanelFacturasSinPdf filas={visibles} dondeBusca="mail" buscando={buscandoPdfs} proveedores={provPorCuit}
                onGuardarMail={guardarMailProveedor} onPortal={marcarProveedorPortal}
                onPedir={ids => setPedirFacturas(ids)} onLlegaron={buscarRespuestasSinPdf} onBuscar={ids => buscarSinPdf(ids, 'mail')} />
            </CardContent>
          </Card>
        )
      })()}</Permisable>}

      {/* PDFs en la carpeta que no matchearon ninguna factura (huérfanos) — última supervisión */}
      {huerfanosSupervision.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              🖼️ PDFs sin vincular ({huerfanosSupervision.length})
              {veredictoDisponible && (() => {
                const abiertos = huerfanosSupervision.filter(h => !veredictoResuelve(registroHuerfanos[fileIdDeUrl(h.url) || '']?.veredicto)).length
                return <span className={`ml-2 text-sm font-normal ${abiertos ? 'text-amber-700' : 'text-green-700'}`}>{abiertos ? `· ${abiertos} sin resolver` : '· todos con veredicto ✓'}</span>
              })()}
            </CardTitle>
            {!veredictoDisponible && (
              <p className="text-xs text-amber-700">⚠️ El veredicto a mano todavía no está habilitado en la base (falta el script 93).</p>
            )}
            {buscarSubdiario.trim() && (
              <p className="text-xs text-blue-700">🔎 Filtrado por «{buscarSubdiario.trim()}» (nombre del archivo y lo que dice el PDF, si ya se leyó).</p>
            )}
            {origenListado === 'contar' ? (
              <p className="text-sm text-amber-700">
                ⚠️ Estos archivos <strong>todavía no se intentaron vincular</strong>: «Contar» no abre
                ningún PDF. Para vincularlos corré <strong>«🔗 Vincular PDFs»</strong>.
                La sugerencia ⭐ sale del <em>nombre y la fecha</em> del archivo, no de su contenido.
              </p>
            ) : (
              <p data-ayuda className="text-sm text-muted-foreground">
                Archivos que se leyeron pero <strong>no matchearon</strong> ninguna factura — hace falta
                que coincidan CUIT, número y monto (típicamente fotos: el OCR no leyó el contenido).
                El nombre suele tener el proveedor.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm max-h-80 overflow-auto">
              {huerfanosSupervision.filter(h => coincideBusqueda(buscarSubdiario, [h.archivo, registroHuerfanos[fileIdDeUrl(h.url) || '']?.texto])).map((h, i) => {
                const candidatos = sugerirFacturasHuerfano(h.archivo)
                const reg = registroHuerfanos[fileIdDeUrl(h.url) || '']
                const faltantes = facturasPeriodo.filter(f => !f.pdf_drive_url)
                const sugeridosIds = new Set(candidatos.map(c => c.id))
                const selId = vinculoHuerfanoSel[h.url] ?? candidatos[0]?.id ?? ''
                const sel = faltantes.find(f => f.id === selId)
                return (
                  <li key={i} className="flex items-center gap-2 flex-wrap border-b pb-1.5">
                    {editNombreUrl === h.url ? (
                      <>
                        <input
                          value={editNombreVal}
                          onChange={e => setEditNombreVal(e.target.value)}
                          className="text-xs border rounded px-1 py-0.5 w-[280px]"
                          disabled={guardandoNombreUrl === h.url}
                          autoFocus
                        />
                        <button type="button" title="Guardar nombre" className="text-green-600"
                          disabled={guardandoNombreUrl === h.url}
                          onClick={() => renombrarHuerfano(h)}>
                          {guardandoNombreUrl === h.url ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" title="Cancelar" className="text-gray-400" onClick={() => setEditNombreUrl(null)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <a href={h.url} target="_blank" rel="noreferrer" className="text-blue-600 underline truncate max-w-[280px]">{h.archivo}</a>
                        <button type="button" title="Renombrar archivo (si está mal nombrado)" className="text-gray-400 hover:text-gray-600"
                          onClick={() => { setEditNombreUrl(h.url); setEditNombreVal(h.archivo) }}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Ver el archivo acá mismo, sin cambiar de pestaña"
                          className={`text-xs rounded border px-1.5 py-0.5 ${previewHuerfano === h.url ? 'bg-blue-50 border-blue-300 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                          onClick={() => setPreviewHuerfano(previewHuerfano === h.url ? null : h.url)}
                        >
                          {previewHuerfano === h.url ? '👁 ocultar' : '👁 ver'}
                        </button>
                      </>
                    )}
                    {typeof h.chars === 'number' && (
                      <span className={`text-xs ${h.chars === 0 ? 'text-red-500' : 'text-gray-400'}`}>(OCR: {h.chars})</span>
                    )}
                    <span className="text-xs text-gray-500">{candidatos.length > 0 ? '→ sugerida:' : '→ elegir:'}</span>
                    {faltantes.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">no quedan facturas sin PDF</span>
                    ) : (
                      <>
                        <select
                          value={selId}
                          onChange={e => setVinculoHuerfanoSel(prev => ({ ...prev, [h.url]: e.target.value }))}
                          className="text-xs border rounded px-1 py-0.5 max-w-[280px]"
                        >
                          <option value="">— elegir factura —</option>
                          {faltantes.map(f => (
                            <option key={f.id} value={f.id}>
                              {sugeridosIds.has(f.id) ? '⭐ ' : ''}{f.denominacion_emisor} · {f.punto_venta}-{f.numero_desde} · {formatearFecha(f.fecha_emision)} · ${(Number(f.imp_total) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                          disabled={!sel}
                          onClick={() => sel && vincularHuerfano(sel, h)}>
                          Vincular
                        </Button>
                      </>
                    )}
                    {/* 🗂️ Veredicto a mano (A-FEAT-1287): queda en el registro del archivo digital */}
                    {veredictoDisponible && (
                      <span className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs text-gray-500">· veredicto:</span>
                        <select value={reg?.veredicto || ''}
                          onChange={e => guardarVeredicto(h, (e.target.value || null) as Veredicto | null)}
                          className={`text-xs border rounded px-1 py-0.5 ${reg?.veredicto ? 'bg-amber-50 border-amber-300' : ''}`}>
                          <option value="">— sin veredicto —</option>
                          {VEREDICTOS.map(v => <option key={v.valor} value={v.valor} title={v.ayuda}>{v.etiqueta}</option>)}
                        </select>
                        <input value={notaVeredicto[h.url] ?? reg?.veredicto_nota ?? ''}
                          onChange={e => setNotaVeredicto(prev => ({ ...prev, [h.url]: e.target.value }))}
                          onBlur={() => { if (reg?.veredicto && notaVeredicto[h.url] !== undefined) guardarVeredicto(h, reg.veredicto as Veredicto) }}
                          placeholder="nota (ej. va en 02/2026)" className="text-xs border rounded px-1 py-0.5 w-[180px]" />
                        {reg?.veredicto_at && (
                          <span className="text-[11px] text-gray-400">{reg.veredicto_por ? `${String(reg.veredicto_por).split('@')[0]} · ` : ''}{formatearFecha(diaArgentino(new Date(reg.veredicto_at)))}</span>
                        )}
                      </span>
                    )}
                    {/* 📄➡️🧾 Cargarlo como factura No Informada (A-FEAT-1318): para los que no están en ARCA */}
                    <Button size="sm" variant="outline"
                      className={`h-6 text-xs px-2 ${reg?.veredicto === 'no_informada' ? 'border-amber-400 bg-amber-50' : ''}`}
                      title="Cargarlo como factura No Informada con los datos que la app leyó del PDF (sin armar un Excel)"
                      onClick={() => setCargarPdf({ nombre: h.archivo, url: h.url, file_id: fileIdDeUrl(h.url), texto: reg?.texto ?? null })}>
                      📄 Cargar como factura
                    </Button>
                    {reg?.veredicto && (
                      <p className="w-full text-[11px] text-amber-800">{VEREDICTOS.find(v => v.valor === reg.veredicto)?.ayuda}</p>
                    )}
                    {/*
                      Vista previa del archivo, acá mismo. Se usa el visor de Drive por file_id
                      (`/preview`), que muestra igual un PDF que una foto — que es justo lo que hace
                      falta, porque los huérfanos suelen ser fotos. Sólo se monta el iframe del que
                      está abierto: montar 20 visores de Drive a la vez haría inusable la pantalla.
                    */}
                    {previewHuerfano === h.url && (() => {
                      const fid = extraerFileIdDrive(h.url)
                      return (
                        <div className="w-full mt-1.5">
                          {fid ? (
                            <>
                              <iframe
                                src={`https://drive.google.com/file/d/${fid}/preview`}
                                className="w-full h-[420px] rounded border bg-gray-50"
                                title={`Vista previa de ${h.archivo}`}
                                loading="lazy"
                              />
                              <p className="text-[11px] text-gray-500 mt-1">
                                Compará el <b>CUIT</b>, el <b>número</b> y el <b>monto</b> con la factura elegida
                                arriba — son los tres datos que la vinculación automática exige.
                                {sel && <> Elegida: <b>{sel.denominacion_emisor} · {sel.punto_venta}-{sel.numero_desde} · ${(Number(sel.imp_total) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</b></>}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-amber-700">
                              No se pudo sacar el identificador del archivo de su link.{' '}
                              <a href={h.url} target="_blank" rel="noreferrer" className="underline">Abrirlo en Drive</a>
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 🔧 Detalle técnico de la conciliación (para diagnóstico): todos los archivos de la carpeta */}
      {detalleConciliacion.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-gray-600">🔧 Detalle de archivos en la carpeta ({detalleConciliacion.length})</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => {
                  const txt = detalleConciliacion.map(d => `${d.factura ? '✓ ' + d.factura : '— SIN VINCULAR'}\t${d.archivo}\t${d.file_id}`).join('\n')
                  navigator.clipboard?.writeText(txt)
                  toast.success('Detalle copiado al portapapeles')
                }}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
            </div>
            <p data-ayuda className="text-xs text-muted-foreground">Cada archivo con su file_id y la factura a la que está vinculado (o "sin vincular"). Pegámelo para diagnosticar.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-0.5 text-[11px] font-mono max-h-80 overflow-auto">
              {detalleConciliacion.map((d, i) => (
                <li key={i} className={d.factura ? 'text-green-700' : 'text-red-600'}>
                  {d.factura ? `✓ ${d.factura}` : '— SIN VINCULAR'} · {d.archivo} · <span className="text-gray-400">{d.file_id}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )


  /**
   * 💰 Abre la **Vista de Pagos** con sus cuatro fuentes cargadas.
   *
   * Se sacó del `onClick` del botón el 2026-09-29 para poder llamarla también desde un **encargo**
   * del Cash Flow (A-FEAT-1192): el aviso de notas de crédito deja dicho qué proveedor y esta
   * pantalla abre **su** modal de cancelación, el de siempre. La lógica de cancelar no se copió a
   * ningún lado — ver `lib/pagos/encargo-cancelacion-nc.ts`.
   *
   * @param encargo si viene, además de abrir la vista se abre el modal de cancelación de ese CUIT
   */
  const abrirVistaPagos = async (encargo?: EncargoCancelacionNC | null) => {
      setCargandoPagos(true)
      setMostrarModalPagos(true)
      setFiltroOrigenPagos({ arca: true, template: true, anticipo: true, sueldo: true })
      setFacturasSeleccionadasPagos(new Set())
      setTemplatesSeleccionadosPagos(new Set())
      setSueldosSeleccionadosPagos(new Set())

      // Cargar en paralelo las 4 fuentes + cuentas contables
      // Si el rol es contable, solo se ven los marcados como visible_contable=true
      const filtroVisible = (q: any) => esContable ? q.eq('visible_contable', true) : q
      const [arcaResult, templatesResult, anticiposResult, sueldosResult, cuentasResult] = await Promise.all([
        filtroVisible(supabase.schema(schemaName).from('comprobantes_arca').select('*')
          .in('estado', ['pendiente', 'pagar', 'preparado', 'echeq']))
          .order('fecha_vencimiento', { ascending: true }),
        filtroVisible(supabase.from('cuotas_egresos_sin_factura').select(`*, grupo_pago_id, egreso:egresos_sin_factura!inner(*)`)
          .in('estado', ['pendiente', 'pagar', 'preparado', 'echeq'])
          .eq('egreso.activo', true))
          .order('fecha_vencimiento', { ascending: true }),
        filtroVisible(supabase.from('anticipos_proveedores').select('*')
          .in('estado_pago', ['pendiente', 'pagar', 'preparado', 'echeq'])
          .neq('estado', 'conciliado'))
          .order('fecha_pago', { ascending: true }),
        filtroVisible(supabase.from('sueldos_pagos').select('*, empleado:sueldos_empleados(id, nombre, cuit_empleado)')
          .in('estado', ['pendiente', 'pagar', 'preparado'])
          .gte('fecha', '2026-01-01'))
          .order('fecha', { ascending: true }),
        supabase.from('cuentas_contables').select('nro_cuenta, cuenta_contable, nombre_totalizadora')
          .eq('imputable', true)
          .order('nombre_totalizadora').order('nro_cuenta')
      ])

      if (!arcaResult.error && arcaResult.data) setFacturasPagos(arcaResult.data)
      if (!templatesResult.error && templatesResult.data) setTemplatesPagos(templatesResult.data)
      if (!anticiposResult.error && anticiposResult.data) setAnticiposPagos(anticiposResult.data)
      if (!sueldosResult.error && sueldosResult.data) setSueldosPagos(sueldosResult.data)
      if (!cuentasResult.error && cuentasResult.data) setCuentasContablesPagos(cuentasResult.data)

    setCargandoPagos(false)

    if (!encargo) return
    /**
     * 🔗 El encargo del Cash Flow. Se arma con lo que ACABA de traerse de la base, no con lo que
     * el aviso había visto: entre el click y la llegada alguien pudo pagar una factura.
     *
     * ⚠️ Si no queda ninguna de las dos puntas, **se avisa y no se abre nada**. Un modal vacío
     * haría pensar que la app se rompió, cuando lo que pasó es que el dato cambió.
     */
    const delProveedor = (arcaResult.data ?? []).filter((f: FacturaArca) => f.cuit === encargo.cuit)
    const ncs = delProveedor.filter((f: FacturaArca) => esNotaCreditoArca(f.tipo_comprobante))
    const fcs = delProveedor.filter((f: FacturaArca) => !esNotaCreditoArca(f.tipo_comprobante))
    if (ncs.length === 0 || fcs.length === 0) {
      toast.info(`Ya no quedan notas de crédito para aplicar en ${encargo.proveedor}.`)
      return
    }
    setModalCancelacionNC({
      tipo: 'fc_con_nc',
      facturas: fcs,
      disponibles: ncs,
      // Vienen todas tildadas, como cuando el flujo normal lo propone: es lo más frecuente.
      seleccionadas: new Set(ncs.map((n: FacturaArca) => n.id)),
      restoCambioEstado: [],
    })
  }

  /** El encargo del Cash Flow, una sola vez al entrar. Si no hay, no pasa nada. */
  useEffect(() => {
    const encargo = tomarEncargoCancelacionNC()
    if (encargo) void abrirVistaPagos(encargo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Facturas ARCA - MSA</h2>
        <p data-ayuda className="text-muted-foreground">
          Gestión de comprobantes recibidos importados desde ARCA
        </p>
      </div>

      {/* Tabs principales */}
      {/* 🧠 A-FEAT-1378: ir del listado a Asignación y volver no recarga. */}
      <TabsVivos maxVivas={3} value={tabActivo} onValueChange={(value) => {
        // Auto-OFF del modo admin al cambiar de tab (decisión A5)
        if (modoEdicionAdmin) {
          setModoEdicionAdmin(false)
          setFacturasSeleccionadasMasiva(new Set())
        }
        setTabActivo(value as 'facturas' | 'subdiarios' | 'historico' | 'asignacion')
      }}>
        <TabsList>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <Permisable recurso="egresos.subdiarios"><TabsTrigger value="subdiarios">Subdiarios</TabsTrigger></Permisable>
          <Permisable recurso="egresos.historico"><TabsTrigger value="historico">Histórico</TabsTrigger></Permisable>
          <Permisable recurso="egresos.asignacion"><TabsTrigger value="asignacion">Asignación Cuentas</TabsTrigger></Permisable>
        </TabsList>

        {/* Tab Content: Facturas */}
        <TabsContentVivo value="facturas" className="space-y-6">
          {modoEdicionAdmin && (
            <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3 flex items-center justify-between sticky top-0 z-30 shadow">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-2xl">🔧</span>
                <div>
                  <div className="font-bold text-red-800">MODO EDICIÓN / ELIMINACIÓN ACTIVO</div>
                  <div className="text-xs text-red-700">
                    Click en cualquier campo para editarlo. Seleccioná facturas con los checkboxes para eliminarlas.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {facturasSeleccionadasMasiva.size > 0 && (
                  <Button
                    size="sm"
                    onClick={abrirModalEliminarSeleccionadas}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    🗑️ Eliminar {facturasSeleccionadasMasiva.size} factura(s)
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setModoEdicionAdmin(false)
                    setFacturasSeleccionadasMasiva(new Set())
                  }}
                  className="border-red-400 text-red-700 hover:bg-red-100"
                >
                  Salir del modo
                </Button>
              </div>
            </div>
          )}
          {/* ───────────── Fila 0: Búsqueda (ancho completo) ───────────── */}
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar emisor, CUIT, cuenta..."
              value={busquedaRapida}
              onChange={e => setBusquedaRapida(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          {/* ───────────── Fila 1: Datos (importar / reglas / actualizar / filtros) ───────────── */}
          <div className="flex flex-wrap gap-2">
            {/* Importar FC (dropdown: ARCA solo admin, Excel para todos) */}
            <Permisable recurso="egresos.importar-fc">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Importar FC
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {!esContable && (empresa === 'MSA' || empresa === 'PAM' || empresa === 'MA') && (
                  <DropdownMenuItem onClick={() => {
                    // Pre-llenar empresa según la tab activa ANTES de abrir el modal
                    // (no podemos confiar en onOpenChange del Dialog porque no se dispara
                    // cuando seteamos open=true desde fuera del componente)
                    setArcaEmpresa(empresa as 'MSA' | 'PAM' | 'MA')
                    setArcaError(null)
                    setArcaPassword('')
                    // Atajo por defecto: mes anterior
                    const hoy = new Date()
                    const mesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
                    const finMesAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
                    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    setArcaFechaDesde(fmt(mesAnt))
                    setArcaFechaHasta(fmt(finMesAnt))
                    setMostrarImportadorArca(true)
                  }}>
                    📥 Importar desde ARCA ({empresa})
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setMostrarImportador(true)}>
                  📂 Importar Excel manual
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </Permisable>

            {/* Búsqueda de PDFs vía GAS (solo admin) */}
            {!esContable && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setModalHistorialPdf({ open: true })}
                  title="Historial de búsquedas de PDFs"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Historial PDFs
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setModalConfigProveedorPdf({ open: true })}
                  title="Configurar proveedores para descarga automática"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Config PDFs
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAuditarPeriodoOpen(true)}
                  title="Auditar el registro digital de un período contable (agrega links + marca incongruencias)"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Auditar período
                </Button>
              </>
            )}
            <LeyendaEstadosFc flotante />

            <Permisable recurso="egresos.reglas-import">
            <Button variant="outline" onClick={() => setMostrarReglasImport(true)}
              title="Reglas que asignan cuenta contable y estado por CUIT al importar">
              <Settings2 className="mr-2 h-4 w-4" />
              Reglas Import
            </Button>
            </Permisable>

            <Button variant="outline" onClick={() => cargarFacturas()} title="Recargar datos desde BD">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>

            <Button variant={mostrarFiltros ? "default" : "outline"} onClick={() => setMostrarFiltros(!mostrarFiltros)}>
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
          </div>

          {/* ───────────── Fila 2: Acciones (edición + SICORE + Pagos) ───────────── */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Grupo edición */}
            <Permisable recurso="egresos.modo-edicion">
            <Button variant={modoEdicion ? "default" : "outline"} onClick={() => setModoEdicion(!modoEdicion)}>
              <Edit3 className="mr-2 h-4 w-4" />
              {modoEdicion ? 'Salir Edición' : 'Modo Edición'}
            </Button>
            </Permisable>

            <Permisable recurso="egresos.edicion-masiva">
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
            </Permisable>

            {!esContable && (
              <Button
                variant={modoEdicionAdmin ? "default" : "outline"}
                onClick={() => {
                  if (modoEdicionAdmin) {
                    setModoEdicionAdmin(false)
                    setFacturasSeleccionadasMasiva(new Set())
                    return
                  }
                  const ok = window.confirm(
                    '⚠️ MODO EDICIÓN / ELIMINACIÓN ADMIN\n\n' +
                    'Vas a habilitar la posibilidad de modificar TODOS los campos de las facturas y de ELIMINARLAS permanentemente.\n\n' +
                    'Las facturas son la fuente de verdad fiscal y contable. Modificarlas o borrarlas puede romper:\n' +
                    '  • Vinculaciones con anticipos\n' +
                    '  • Retenciones SICORE\n' +
                    '  • Conciliación bancaria\n' +
                    '  • Declaraciones de IVA ya cerradas\n\n' +
                    '¿Confirmás activar el modo?'
                  )
                  if (ok) setModoEdicionAdmin(true)
                }}
                className={modoEdicionAdmin ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-300 text-red-700 hover:bg-red-50"}
                title="Solo admin — modifica o elimina facturas"
              >
                {modoEdicionAdmin ? '🔧 Salir Modo Admin' : '🔧 Modo Admin'}
              </Button>
            )}

            {/* Separador visual */}
            <div className="w-px h-6 bg-gray-300 mx-1"></div>

          {/* Botón Panel SICORE */}
          <Permisable recurso="egresos.sicore">
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
          </Permisable>

          {/* Botón Vista de Pagos */}
          <Permisable recurso="egresos.pagos">
          <Button
            variant="outline"
            className="bg-green-50 hover:bg-green-100 border-green-300"
            onClick={() => abrirVistaPagos()}
          >
            💰 Pagos
          </Button>
          </Permisable>

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
                <p data-ayuda className="text-sm text-muted-foreground">
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

              {/* Selector de tipo de comprobante (solo los presentes en los datos) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">🧾 Tipo Comprobante</Label>
                <Select value={filtroTipoComprobante} onValueChange={setFiltroTipoComprobante}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    {tiposComprobantePresentes.map(([tipo, desc]) => (
                      <SelectItem key={tipo} value={String(tipo)}>
                        {tipo} - {desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Estado FC (Portal, VER, NO Mail…) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📎 Estado FC</Label>
                <Select value={filtroEstadoFc} onValueChange={setFiltroEstadoFc}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {Array.from(new Set(facturasOriginales.map(f => f.fc ?? '(sin estado)'))).sort().map(fc => (
                      <SelectItem key={fc} value={fc}>
                        {fc} ({facturasOriginales.filter(f => (f.fc ?? '(sin estado)') === fc).length})
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

      {/* Alert FC pendientes */}
      {!loading && !error && (() => {
        // Sin 📎 y no en Portal / No (usuario 2026-10-21). Antes contaba las «No», que desde el
        // 2026-10-20 son «no corresponde»: el aviso decía lo contrario de lo que había.
        const fcPendientes = facturasOriginales.filter(faltaComprobante)
        if (fcPendientes.length === 0) return null
        return (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-amber-800 font-medium">
                    {fcPendientes.length} factura{fcPendientes.length !== 1 ? 's' : ''} sin comprobante (sin 📎)
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <Checkbox
                      checked={filtroFcPendiente}
                      onCheckedChange={(checked) => setFiltroFcPendiente(!!checked)}
                    />
                    <span>Mostrar solo FC pendientes</span>
                  </label>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-100"
                  onClick={() => setMostrarModalMarcarFC(true)}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Ver detalle
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )
      })()}

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
                      {(modoEdicionMasiva || modoEdicionAdmin) && (
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
                      const q = normalizarBusqueda(busquedaRapida.trim())
                      const facturasDisplay = q
                        ? facturas.filter(f =>
                            normalizarBusqueda(f.denominacion_emisor).includes(q) ||
                            f.cuit?.includes(q) ||
                            normalizarBusqueda(f.cuenta_contable ?? '').includes(q)
                          )
                        : facturas
                      return facturasDisplay.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={columnasVisiblesArray.length + ((modoEdicionMasiva || modoEdicionAdmin) ? 1 : 0)}
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
                            ? (modoEdicionAdmin ? 'bg-red-50' : 'bg-purple-50')
                            : esUSD ? 'bg-amber-50' : ''
                        }>
                          {(modoEdicionMasiva || modoEdicionAdmin) && (
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
                                {/* 🧾 A-BUG-1244 — vincular la factura con las compras de insumos (precio, descuento, moneda) */}
                                {schemaName === 'msa' && (
                                  <DropdownMenuItem onClick={() => setFacturaVincularCompras(factura.id)}>
                                    🧾 Vincular con compras de insumos
                                  </DropdownMenuItem>
                                )}
                                {(factura.sicore || factura.tc_pago || factura.descuento_aplicado || factura.estado === 'pagar' || factura.estado === 'preparado' || factura.estado === 'echeq') && (
                                  <DropdownMenuItem
                                    className="text-orange-600"
                                    onClick={() => resetearFactura(factura)}
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Resetear a estado importado
                                  </DropdownMenuItem>
                                )}
                                {(factura.estado === 'pagado' || factura.estado === 'conciliado') && (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      // Si pertenece a un grupo, buscar todas las facturas del grupo
                                      if (factura.grupo_pago_id) {
                                        const { data: grupoFacs } = await supabase
                                          .schema(schemaName).from('comprobantes_arca')
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
                                              fecha_estimada: f.fecha_estimada || f.fecha_vencimiento || null,
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
                                          fecha_estimada: factura.fecha_estimada || factura.fecha_vencimiento || null,
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
                        <SelectItem value="cuotas">Cuotas</SelectItem>
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

      {/* Modal de confirmación — eliminación masiva (modo admin) */}
      <Dialog open={mostrarModalEliminar} onOpenChange={(v) => {
        if (eliminandoFacturas) return
        setMostrarModalEliminar(v)
        if (!v) { setTextoConfirmarEliminar(''); setDepsParaEliminar(new Map()) }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-red-700">⚠️ Eliminar facturas permanentemente</DialogTitle>
            <DialogDescription>
              Esta acción NO se puede deshacer. La factura desaparece de la BD junto con su vínculo a anticipos, SICORE y conciliaciones.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 my-3">
            <div className="text-sm font-semibold">
              Vas a eliminar {facturasSeleccionadasMasiva.size} factura(s):
            </div>

            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Fecha</th>
                    <th className="px-2 py-1 text-left">Proveedor</th>
                    <th className="px-2 py-1 text-right">Importe</th>
                    <th className="px-2 py-1 text-left">Dependencias vinculadas</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(facturasSeleccionadasMasiva).map(id => {
                    const fc = facturas.find(f => f.id === id)
                    const deps = depsParaEliminar.get(id)
                    const depsTexto = deps ? formatearDependencias(deps) : []
                    return (
                      <tr key={id} className="border-t">
                        <td className="px-2 py-1 whitespace-nowrap">{fc?.fecha_emision || ''}</td>
                        <td className="px-2 py-1">{fc?.denominacion_emisor || ''}</td>
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          ${Number(fc?.imp_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1 text-xs">
                          {depsTexto.length === 0
                            ? <span className="text-gray-400 italic">— sin dependencias —</span>
                            : <ul className="list-none">{depsTexto.map((d, i) => <li key={i} className="text-orange-700">{d}</li>)}</ul>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-red-50 border border-red-300 rounded p-3 text-xs text-red-900 space-y-1">
              <div>• El DELETE es <strong>físico</strong> (no se puede deshacer).</div>
              <div>• Si la FC tiene SICORE confirmado o DDJJ cerrada, vas a romper esos reportes.</div>
              <div>• Anticipos vinculados quedarán huérfanos (factura_id apuntando a nada) — revisalos manualmente después.</div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-semibold">
                Para confirmar, escribí <code className="bg-gray-100 px-1 rounded">aceptar</code>:
              </label>
              <Input
                value={textoConfirmarEliminar}
                onChange={(e) => setTextoConfirmarEliminar(e.target.value)}
                placeholder="aceptar"
                disabled={eliminandoFacturas}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMostrarModalEliminar(false)}
              disabled={eliminandoFacturas}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={ejecutarEliminacionMasiva}
              disabled={eliminandoFacturas || textoConfirmarEliminar.trim().toLowerCase() !== 'aceptar'}
            >
              {eliminandoFacturas ? 'Eliminando...' : `🗑️ Eliminar ${facturasSeleccionadasMasiva.size} factura(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Importar desde ARCA (descarga automática) — solo admin */}
      <Dialog open={mostrarImportadorArca} onOpenChange={(v) => {
        if (arcaCargando) return  // no cerrar mientras descarga
        setMostrarImportadorArca(v)
        // Al cerrar, descartar clave y error de memoria.
        // El pre-llenado de empresa/fechas se hace en el onClick del DropdownMenuItem
        // porque onOpenChange NO se dispara cuando seteamos open=true desde fuera.
        if (!v) { setArcaError(null); setArcaPassword('') }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📥 Importar desde ARCA</DialogTitle>
            <DialogDescription>
              Descarga automática de Mis Comprobantes. Después revisás e imputás antes del INSERT final.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Empresa — fija, viene de la tab activa para evitar errores de selección */}
            <div className="space-y-1">
              <Label className="text-xs">Empresa</Label>
              <div className="border rounded-md bg-blue-50 border-blue-200 px-3 py-2 text-sm font-medium text-blue-900 flex items-center gap-2">
                <span className="text-blue-600">🏛️</span>
                <span>{arcaEmpresa === 'MA' ? 'MA — Otro CUIT' : arcaEmpresa === 'PAM' ? 'PAM — CUIT 20044390222' : 'MSA — Martinez Sobrado Agro'}</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Para descargar de otra empresa, salí del modal y cambiá de tab.</p>
            </div>

            {/* Atajos de fecha */}
            <div className="space-y-1">
              <Label className="text-xs">Atajos rápidos</Label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  const hoy = new Date()
                  const mes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
                  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
                  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  setArcaFechaDesde(fmt(mes)); setArcaFechaHasta(fmt(fin))
                }}>Mes anterior</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const hoy = new Date()
                  const hace30 = new Date(hoy); hace30.setDate(hace30.getDate() - 30)
                  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  setArcaFechaDesde(fmt(hace30)); setArcaFechaHasta(fmt(hoy))
                }}>Últimos 30 días</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const hoy = new Date()
                  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
                  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
                  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  setArcaFechaDesde(fmt(inicio)); setArcaFechaHasta(fmt(ayer))
                }}>Este mes hasta ayer</Button>
              </div>
            </div>

            {/* Fechas custom */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha desde *</Label>
                <Input type="date" value={arcaFechaDesde} onChange={e => setArcaFechaDesde(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha hasta *</Label>
                <Input type="date" value={arcaFechaHasta} onChange={e => setArcaFechaHasta(e.target.value)} />
              </div>
            </div>

            {/* Clave fiscal (input password, no se ve, no se guarda) */}
            <div className="space-y-1">
              <Label className="text-xs">Clave fiscal de ARCA *</Label>
              <Input
                type="password"
                value={arcaPassword}
                onChange={e => setArcaPassword(e.target.value)}
                placeholder="Ingresá tu clave fiscal"
                autoComplete="current-password"
              />
              <p className="text-[10px] text-gray-500">
                La clave se usa una sola vez para esta descarga. No se guarda en el servidor.
              </p>
            </div>

            {arcaError && (
              <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-900">
                ❌ {arcaError}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-900">
              ℹ️ La descarga puede tardar 10-20 segundos (login + SSO + consulta + descarga).
              Después vas al wizard de imputación para revisar antes de importar a BD.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarImportadorArca(false)} disabled={arcaCargando}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                setArcaError(null)
                if (!arcaPassword || arcaPassword.trim().length === 0) { setArcaError('Ingresá tu clave fiscal'); return }
                if (!arcaFechaDesde || !arcaFechaHasta) { setArcaError('Completá ambas fechas'); return }
                if (arcaFechaDesde > arcaFechaHasta) { setArcaError('Fecha desde debe ser anterior o igual a fecha hasta'); return }
                setArcaCargando(true)
                try {
                  const resp = await fetch('/api/arca/descargar-comprobantes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      empresa: arcaEmpresa,
                      password: arcaPassword,
                      fechaDesde: arcaFechaDesde,
                      fechaHasta: arcaFechaHasta,
                      tipo: 'recibidos',
                      userRole,
                    }),
                  })
                  const data = await resp.json()
                  if (!resp.ok) {
                    setArcaError(data.error || `Error ${resp.status}`)
                    return
                  }
                  // Crear File con el CSV adaptado y delegar al wizard de Excel
                  const csvBlob = new Blob([data.csvText], { type: 'text/csv;charset=utf-8' })
                  const fileName = `arca-${arcaEmpresa}-${arcaFechaDesde}-a-${arcaFechaHasta}.csv`
                  const csvFile = new File([csvBlob], fileName, { type: 'text/csv' })
                  setArchivoImportacion(csvFile)
                  setOrigenFactura('ARCA')
                  setPasoImportacion('archivo')
                  setArcaPassword('')  // borrar la clave de memoria
                  setMostrarImportadorArca(false)
                  setMostrarImportador(true)  // abre el wizard existente en paso 2 con el File precargado
                  // Disparar preview automáticamente — el input file no se puede setear programáticamente
                  await previsualizarImportacion(csvFile)
                } catch (err) {
                  setArcaError((err as Error).message || 'Error de red')
                } finally {
                  setArcaCargando(false)
                }
              }}
              disabled={arcaCargando || !arcaPassword}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {arcaCargando ? '⏳ Descargando...' : '📥 Descargar de ARCA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para importación de Excel — 3 pasos */}
      <Dialog open={mostrarImportador} onOpenChange={(v) => {
        setMostrarImportador(v)
        if (!v) {
          setArchivoImportacion(null); setPreviewData(null); setResultadoImportacion(null)
          setOrigenFactura(''); setPasoImportacion('origen'); setImputacionData([])
        }
      }}>
        <DialogContent className={`${pasoImportacion === 'imputacion' ? 'max-w-5xl' : 'max-w-3xl'} max-h-[85vh] flex flex-col`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Facturas — {pasoImportacion === 'origen' ? 'Paso 1: Tipo' : pasoImportacion === 'archivo' ? 'Paso 2: Archivo' : 'Paso 3: Imputación'}
            </DialogTitle>
            <DialogDescription>
              {pasoImportacion === 'origen' && 'Seleccioná el origen de las facturas a importar.'}
              {pasoImportacion === 'archivo' && `Subí el archivo Excel (${origenFactura}). El sistema mostrará un preview.`}
              {pasoImportacion === 'imputacion' && 'Asigná FC y cuenta contable a cada factura antes de importar.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1">
            {/* ── PASO 1: Selector de origen ──────────────────── */}
            {pasoImportacion === 'origen' && (
              <div className="space-y-4 py-4">
                <Label className="text-sm font-medium">Origen de las facturas *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => { setOrigenFactura('ARCA'); setPasoImportacion('archivo') }}
                    className="border-2 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <div className="text-2xl mb-2">🏛️</div>
                    <div className="font-semibold">ARCA</div>
                    <div className="text-xs text-gray-500 mt-1">Descargado de Mis Comprobantes</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOrigenFactura('No Informada'); setPasoImportacion('archivo') }}
                    className="border-2 rounded-lg p-6 text-center hover:border-orange-500 hover:bg-orange-50 transition-colors cursor-pointer"
                  >
                    <div className="text-2xl mb-2">📄</div>
                    <div className="font-semibold">No Informada</div>
                    <div className="text-xs text-gray-500 mt-1">Factura no registrada en ARCA</div>
                  </button>
                </div>
              </div>
            )}

            {/* ── PASO 2: Archivo + Preview ──────────────────── */}
            {pasoImportacion === 'archivo' && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className={origenFactura === 'ARCA' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}>
                    {origenFactura === 'ARCA' ? '🏛️ ARCA' : '📄 No Informada'}
                  </Badge>
                  <button type="button" onClick={() => { setPasoImportacion('origen'); setArchivoImportacion(null); setPreviewData(null) }} className="text-xs text-blue-600 hover:underline">Cambiar</button>
                </div>

                <div className="space-y-2">
                  <Label>{origenFactura === 'ARCA' ? 'Archivo descargado de ARCA' : 'Archivo Excel (.xlsx / .xls)'}</Label>
                  {origenFactura === 'ARCA' && archivoImportacion ? (
                    <div className="border rounded-md bg-blue-50 border-blue-200 px-3 py-2 text-sm text-blue-900 flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span className="font-medium truncate flex-1" title={archivoImportacion.name}>{archivoImportacion.name}</span>
                      <span className="text-xs text-blue-700">{(archivoImportacion.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ) : (
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setArchivoImportacion(file)
                        setPreviewData(null)
                        setResultadoImportacion(null)
                        if (file) previsualizarImportacion(file)
                      }}
                    />
                  )}
                </div>

                {cargandoPreview && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analizando archivo...
                  </div>
                )}

                {previewData && !previewData.error && (
                  <div className="space-y-3">
                    <div className="flex gap-4 text-sm">
                      <span className="font-medium">Total: <strong>{previewData.total}</strong></span>
                      <span className="text-green-700">✅ Nuevas: <strong>{previewData.nuevas}</strong></span>
                      {previewData.duplicadas > 0 && (
                        <span className="text-amber-600">⚠️ Ya existen: <strong>{previewData.duplicadas}</strong></span>
                      )}
                      {previewData.errores_parse > 0 && (
                        <span className="text-red-600">❌ Sin datos: <strong>{previewData.errores_parse}</strong></span>
                      )}
                    </div>

                    <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium text-gray-600">Estado</th>
                            <th className="text-left p-2 font-medium text-gray-600">Fecha</th>
                            <th className="text-left p-2 font-medium text-gray-600">Proveedor</th>
                            <th className="text-right p-2 font-medium text-gray-600">Monto Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(previewData.facturas as any[]).map((f: any) => (
                            <tr key={f.fila} className={
                              f.estado === 'nueva' ? 'bg-white' :
                              f.estado === 'duplicado' ? 'bg-amber-50' : 'bg-red-50'
                            }>
                              <td className="p-2">
                                {f.estado === 'nueva'     && <span className="text-green-700 font-medium">✅ Nueva</span>}
                                {f.estado === 'duplicado' && <span className="text-amber-600">⚠️ Ya existe</span>}
                                {f.estado === 'error'     && <span className="text-red-600">❌ Sin datos</span>}
                              </td>
                              <td className="p-2 text-gray-700">{f.fecha_emision ?? '—'}</td>
                              <td className="p-2 text-gray-700 max-w-[200px] truncate" title={f.razon_social}>{f.razon_social}</td>
                              <td className="p-2 text-right text-gray-700">
                                {f.imp_total ? `$${Number(f.imp_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {previewData?.error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">{previewData.error}</AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* ── PASO 3: Imputación FC + Cuenta Contable ──── */}
            {pasoImportacion === 'imputacion' && (
              <>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <Badge variant="outline" className={origenFactura === 'ARCA' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}>
                    {origenFactura === 'ARCA' ? '🏛️ ARCA' : '📄 No Informada'}
                  </Badge>
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-600">{previewData?.nuevas} facturas nuevas</span>
                </div>

                {/* Acciones masivas */}
                <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border text-xs">
                  <span className="font-medium">Asignar a todas:</span>
                  <div className="flex items-center gap-1">
                    <span>FC:</span>
                    {['Sí', 'No', 'Portal'].map(val => (
                      <button
                        key={val}
                        type="button"
                        // «No» y «Portal» = no llega por mail: se destilda la búsqueda (se puede volver a tildar)
                        onClick={() => setImputacionData(prev => prev.map(d => ({ ...d, fc: val, buscar_pdf: val === 'No' || val === 'Portal' ? false : d.buscar_pdf })))}
                        className="px-2 py-0.5 border rounded hover:bg-blue-50 text-xs"
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  {!esContable && (
                    <div className="flex items-center gap-1 ml-4" title="Al terminar de importar se busca el PDF de las tildadas: primero en la carpeta del mes en Drive, después en el mail">
                      <span>Buscar PDF:</span>
                      <button type="button" className="px-2 py-0.5 border rounded hover:bg-blue-50 text-xs"
                        onClick={() => setImputacionData(prev => prev.map(d => ({ ...d, buscar_pdf: true })))}>Todas</button>
                      <button type="button" className="px-2 py-0.5 border rounded hover:bg-blue-50 text-xs"
                        onClick={() => setImputacionData(prev => prev.map(d => ({ ...d, buscar_pdf: false })))}>Ninguna</button>
                    </div>
                  )}
                  <div className="flex items-center gap-1 ml-4">
                    <span>Cuenta:</span>
                    <select
                      className="border rounded px-1 py-0.5 text-xs max-w-[250px]"
                      value=""
                      onChange={(e) => {
                        const val = e.target.value || null
                        setImputacionData(prev => prev.map(d => ({ ...d, cuenta_contable: val })))
                      }}
                    >
                      <option value="">— Asignar a todas —</option>
                      {(() => {
                        const grupos = new Map<string, typeof cuentasContablesImport>()
                        cuentasContablesImport.forEach(c => {
                          const g = c.nombre_totalizadora || 'Sin grupo'
                          if (!grupos.has(g)) grupos.set(g, [])
                          grupos.get(g)!.push(c)
                        })
                        return Array.from(grupos.entries()).map(([grupo, cuentas]) => (
                          <optgroup key={grupo} label={grupo}>
                            {cuentas.map((c: any) => (
                              <option key={c.nro_cuenta} value={c.categ}>
                                {c.categ}
                              </option>
                            ))}
                          </optgroup>
                        ))
                      })()}
                    </select>
                  </div>
                </div>

                <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-2 font-medium text-gray-600">Fecha</th>
                        <th className="text-left p-2 font-medium text-gray-600">Proveedor</th>
                        <th className="text-left p-2 font-medium text-gray-600 w-[100px]">CUIT</th>
                        <th className="text-right p-2 font-medium text-gray-600 w-[100px]">Monto</th>
                        <th className="text-center p-2 font-medium text-gray-600 w-[90px]">FC</th>
                        <th className="text-left p-2 font-medium text-gray-600 w-[250px]">Cuenta Contable</th>
                        {!esContable && (
                          <th className="text-left p-2 font-medium text-gray-600 w-[230px]" title="Tildada = al importar se busca su PDF (carpeta del mes y después el mail). Sin mail del proveedor sólo se busca en la carpeta y en los reenvíos">
                            Buscar PDF · mail del proveedor
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(previewData?.facturas as any[] || [])
                        .filter((f: any) => f.estado === 'nueva')
                        .map((f: any, idx: number) => {
                          const imp = imputacionData.find(d => d.fila === f.fila)
                          return (
                            <tr key={f.fila} className="hover:bg-gray-50">
                              <td className="p-2 text-gray-700">{f.fecha_emision ?? '—'}</td>
                              <td className="p-2 text-gray-700 max-w-[180px] truncate" title={f.razon_social}>{f.razon_social}</td>
                              <td className="p-2 text-gray-500">{f.cuit || '—'}</td>
                              <td className="p-2 text-right text-gray-700">
                                {f.imp_total ? `$${Number(f.imp_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                              <td className="p-2">
                                <select
                                  className="border rounded px-1 py-0.5 text-xs w-full"
                                  value={imp?.fc || ''}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setImputacionData(prev => prev.map(d =>
                                      d.fila === f.fila ? { ...d, fc: v, buscar_pdf: v === 'No' || v === 'Portal' ? false : d.buscar_pdf } : d
                                    ))
                                  }}
                                >
                                  <option value="">— (Buscar)</option>
                                  {opcionesFcManual(null, !esContable).filter(o => o.valor !== 'Buscar').map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                                </select>
                              </td>
                              <td className="p-2">
                                <select
                                  className="border rounded px-1 py-0.5 text-xs w-full"
                                  value={imp?.cuenta_contable || ''}
                                  onChange={(e) => {
                                    setImputacionData(prev => prev.map(d =>
                                      d.fila === f.fila ? { ...d, cuenta_contable: e.target.value || null } : d
                                    ))
                                  }}
                                >
                                  <option value="">— Sin asignar —</option>
                                  {(() => {
                                    const grupos = new Map<string, typeof cuentasContablesImport>()
                                    cuentasContablesImport.forEach(c => {
                                      const g = c.nombre_totalizadora || 'Sin grupo'
                                      if (!grupos.has(g)) grupos.set(g, [])
                                      grupos.get(g)!.push(c)
                                    })
                                    return Array.from(grupos.entries()).map(([grupo, cuentas]) => (
                                      <optgroup key={grupo} label={grupo}>
                                        {cuentas.map((c: any) => (
                                          <option key={c.nro_cuenta} value={c.categ}>
                                            {c.categ}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))
                                  })()}
                                </select>
                              </td>
                              {!esContable && (() => {
                                const cuit = cuitLimpio(f.cuit)
                                const prov = provPorCuit[cuit]
                                return (
                                  <td className="p-2">
                                    <div className="flex items-center gap-2">
                                      <input type="checkbox" className="h-3.5 w-3.5"
                                        checked={imp?.buscar_pdf ?? true}
                                        onChange={(e) => setImputacionData(prev => prev.map(d =>
                                          d.fila === f.fila ? { ...d, buscar_pdf: e.target.checked } : d))} />
                                      {prov?.email_facturacion ? (
                                        <span className="text-[11px] text-gray-500 truncate" title={prov.email_facturacion}>{prov.email_facturacion}</span>
                                      ) : prov?.email_pagos && provEditMail[cuit] === undefined ? (
                                        // 💡 Sugerencia (mail de PAGOS): sólo cuenta si se acepta con «usar».
                                        <span className="flex items-center gap-1 min-w-0">
                                          <span className="text-[10px] text-gray-500 truncate" title="Es el mail de PAGOS de este proveedor. Si lo usás, se guarda como mail de facturas al importar.">
                                            💡 {prov.email_pagos} <span className="text-gray-400">(de pagos)</span>
                                          </span>
                                          <button type="button"
                                            onClick={() => setProvEditMail(prev => ({ ...prev, [cuit]: prov.email_pagos! }))}
                                            className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50">usar</button>
                                          <button type="button" title="Escribir otro mail"
                                            onClick={() => setProvEditMail(prev => ({ ...prev, [cuit]: '' }))}
                                            className="shrink-0 text-[10px] text-gray-500 underline">otro</button>
                                        </span>
                                      ) : (
                                        <input type="text" placeholder="mail del proveedor (opcional)"
                                          className="border rounded px-1 py-0.5 text-[11px] w-full"
                                          value={provEditMail[cuit] ?? ''}
                                          onChange={(e) => { const v = e.target.value; setProvEditMail(prev => ({ ...prev, [cuit]: v })) }}
                                          title={prov ? 'Este proveedor no tiene mail: si lo cargás, se guarda en su ficha y su factura se busca en el mail' : 'Proveedor nuevo: se crea al importar, y con el mail que pongas acá'} />
                                      )}
                                    </div>
                                  </td>
                                )
                              })()}
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Resultado de importación */}
                {resultadoImportacion && (
                  <Alert className={resultadoImportacion.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                    <div className="flex items-center gap-2">
                      {resultadoImportacion.success
                        ? <CheckCircle className="h-4 w-4 text-green-600" />
                        : <AlertTriangle className="h-4 w-4 text-red-600" />}
                    </div>
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {resultadoImportacion.success ? 'Importación exitosa' : 'Error en importación'}
                        </p>
                        <p className="text-sm">{resultadoImportacion.message || resultadoImportacion.error}</p>
                        {resultadoImportacion.summary && (
                          <div className="text-xs mt-1 space-y-0.5">
                            <div>Importadas: <strong>{resultadoImportacion.insertedCount}</strong></div>
                            <div>Ya existían: <strong>{resultadoImportacion.ignoredCount || 0}</strong></div>
                            {resultadoImportacion.errores?.length > 0 && (
                              <div className="text-red-600">Errores: {resultadoImportacion.errores.length}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            {pasoImportacion !== 'origen' && (
              <Button variant="outline" onClick={() => {
                if (pasoImportacion === 'imputacion') setPasoImportacion('archivo')
                else { setPasoImportacion('origen'); setArchivoImportacion(null); setPreviewData(null) }
              }}>
                Atrás
              </Button>
            )}
            <Button variant="outline" onClick={() => setMostrarImportador(false)}>
              Cancelar
            </Button>
            {pasoImportacion === 'archivo' && previewData && !previewData.error && previewData.nuevas > 0 && (
              <Button onClick={avanzarAImputacion}>
                Siguiente: Imputación
              </Button>
            )}
            {pasoImportacion === 'imputacion' && (
              <Button
                onClick={manejarImportacionExcel}
                disabled={importandoExcel}
              >
                {importandoExcel ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />
                    Importar {previewData?.nuevas} factura{previewData?.nuevas !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de facturas sin comprobante: se vinculan con su link y quedan Confirmada (usuario
          2026-10-21: «yo no podría poner confirmado sin linkear»). Antes «Marcar recibida» ponía «Sí»
          sin archivo, que es el estado de Ulises, y listaba las «No», que ahora son «no corresponde». */}
      <Dialog open={mostrarModalMarcarFC} onOpenChange={setMostrarModalMarcarFC}>
        <DialogContent className="max-w-none w-[96vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Facturas sin comprobante (sin 📎)</DialogTitle>
            <DialogDescription>
              Todas las que no tienen PDF, de cualquier mes y estén o no imputadas. Tildá y pedilas o buscalas (primero la carpeta de su subdiario —sin imputar: su mes de emisión y el siguiente— y después el mail), o pegá el link del PDF en Google Drive y tocá Vincular: queda Confirmada con su 📎. Las que están en VER se resuelven eligiendo el candidato.
            </DialogDescription>
            {renglonReenvios()}
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {(() => {
              const pendientes = facturasOriginales.filter(faltaComprobante)
              if (pendientes.length === 0) {
                return <div className="text-center text-gray-500 py-8">No quedan facturas sin comprobante 🎉</div>
              }
              const { filas } = faltantesDelSubdiario(pendientes, ultimasSinPdf, hoyArgentina())
              const porId = new Map(pendientes.map(f => [f.id, f]))
              return (
                <PanelFacturasSinPdf filas={filas} dondeBusca="ambos" buscando={buscandoPdfs} proveedores={provPorCuit}
                  rotuloDe={id => { const f = porId.get(id); return f ? subdiarioDe(f).rotulo : null }}
                  onGuardarMail={guardarMailProveedor} onPortal={marcarProveedorPortal}
                  onPedir={ids => setPedirFacturas(ids)}
                  onLlegaron={ids => { setMostrarModalMarcarFC(false); buscarRespuestasSinPdf(ids) }}
                  onBuscar={ids => { setMostrarModalMarcarFC(false); buscarSinPdf(ids, 'ambos') }}
                  accionFila={id => {
                    const f = porId.get(id)
                    if (!f) return null
                    return f.fc === 'VER' ? (
                      <Button size="sm" variant="outline" className="border-green-400 text-green-700 hover:bg-green-50"
                        onClick={() => confirmarVer(f)}>
                        Elegir candidato
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        <Input
                          type="text"
                          placeholder="https://drive.google.com/…"
                          value={linksAVincular[f.id] ?? ''}
                          onChange={e => setLinksAVincular(prev => ({ ...prev, [f.id]: e.target.value }))}
                          className="h-7 text-xs w-52"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-400 text-green-700 hover:bg-green-50"
                          disabled={!linkParaConfirmar(linksAVincular[f.id])}
                          title={linkParaConfirmar(linksAVincular[f.id]) ? 'Vincular este archivo → Confirmada' : 'Pegá primero el link de Google Drive'}
                          onClick={async () => {
                            const monto = (f.imp_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, style: 'currency', currency: 'ARS' })
                            await confirmarConLink(f, linksAVincular[f.id], `¿Vincular ese archivo a ${f.denominacion_emisor || f.cuit || 'esta factura'} por ${monto}? Queda Confirmada.`)
                          }}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Vincular
                        </Button>
                      </div>
                    )
                  }} />
              )
            })()}
          </div>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setMostrarModalMarcarFC(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContentVivo>

        {/* Tab Content: Subdiarios */}
        {puedeVer('egresos.subdiarios') && <TabsContentVivo value="subdiarios" className="space-y-6">
          {/* Se LLAMA, no se monta como <SubdiariosContent />: es una función nueva en cada render, y montada
              React la desarmaba entera cada vez (el buscador perdía el cursor y las listas sus tildes). No usa hooks. */}
          {SubdiariosContent()}
        </TabsContentVivo>}

        {/* Tab Content: Histórico */}
        {puedeVer('egresos.historico') && <TabsContentVivo value="historico" className="space-y-6">
          <VistaHistoricoFacturas empresa={empresa} />
        </TabsContentVivo>}

        {/* Tab Content: Asignación Cuentas */}
        {puedeVer('egresos.asignacion') && <TabsContentVivo value="asignacion" className="space-y-6">
          <VistaAsignacionArca empresa={empresa} esAdmin={userRole === 'admin'} />
        </TabsContentVivo>}
      </TabsVivos>

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
                    // 📨 A-FEAT-1295: un mes enviado al contador o presentado → sólo admin, con advertencia.
                    const estadoMes = await consultarEstadoPeriodo(supabase, schemaName, 'comprobantes_arca', valor)
                    const decision = evaluarCambioDDJJ({
                      estadosAfectados: [], periodoDestino: valor, estadoPeriodoDestino: estadoMes, esAdmin: userRole === 'admin',
                    })
                    if (!confirmarDecision(decision)) return
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
                    ⚠️ Si el período ya se envió al contador o se presentó, te va a pedir confirmación
                  </p>
                )}
              </div>

              {/* Filtros estado */}
              <div className="space-y-2">
                <Label>Mostrar</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`sin-imputar-${empresa}`}
                      checked={mostrarSinImputar}
                      onCheckedChange={setMostrarSinImputar}
                    />
                    <Label htmlFor={`sin-imputar-${empresa}`} className="text-sm">Sin imputar</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`imputadas-${empresa}`}
                      checked={mostrarImputadas}
                      onCheckedChange={setMostrarImputadas}
                    />
                    <Label htmlFor={`imputadas-${empresa}`} className="text-sm">Imputadas</Label>
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
                            } className={factura.ddjj_iva === 'Enviado' ? 'border-blue-400 text-blue-700 bg-blue-50' : ''}>
                              {factura.ddjj_iva === 'Enviado' ? '📨 Enviado' : factura.ddjj_iva}
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
            <Button variant="outline" disabled={facturasSeleccionadas.size === 0}
              title="No informadas en ARCA que no van al subdiario de IVA: salen en los Papeles del balance para registrarlas con asientos"
              onClick={() => mandarAAsientosContables(Array.from(facturasSeleccionadas))}>
              📒 A {NOMBRE_ASIENTOS_CONTABLES} ({facturasSeleccionadas.size})
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

      {/* 📒 «Asientos Contables» (A-FEAT-1318) */}
      <Dialog open={asientosContables !== null} onOpenChange={(o) => { if (!o) setAsientosContables(null) }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📒 {NOMBRE_ASIENTOS_CONTABLES} — {empresa}</DialogTitle>
            <DialogDescription>
              Facturas no informadas en ARCA que no van al subdiario de IVA. No están en ningún subdiario ni en el
              Libro IVA: salen en la solapa «{NOMBRE_ASIENTOS_CONTABLES}» de los Papeles del balance (del ejercicio de su
              fecha de emisión) para que el contador las registre con asientos. Se mandan acá desde «Imputar Facturas»
              o desde «Gestionar Facturas».
            </DialogDescription>
          </DialogHeader>
          {asientosContables && asientosContables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay ninguna todavía.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead><TableHead>Proveedor</TableHead><TableHead>Comprobante</TableHead>
                  <TableHead className="text-right">Total</TableHead><TableHead>PDF</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(asientosContables || []).map(f => (
                  <TableRow key={f.id}>
                    <TableCell>{formatearFecha(f.fecha_emision)}</TableCell>
                    <TableCell className="max-w-56 truncate">{f.denominacion_emisor}</TableCell>
                    <TableCell className="whitespace-nowrap">{f.tipo_comprobante_desc || f.tipo_comprobante} {f.punto_venta}-{f.numero_desde}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">${(Number(f.imp_total) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>{f.pdf_drive_url ? <a href={f.pdf_drive_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">📎</a> : '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => sacarDeAsientosContables(f)}>↩ Sacar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsientosContables(null)}>Cerrar</Button>
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
                      .schema(schemaName)
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
                          Mín: ${tipo.minimo_no_imponible.toLocaleString('es-AR')} ({(tipo.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}%)
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

          {/* PASO 2: Mostrar cálculo + opciones (tipoSeleccionado puede ser null para flujo solo-descuento) */}
          {pasoSicore === 'calculo' && facturaEnProceso && datosSicoreCalculo && (() => {
            const tcModal = ((facturaEnProceso.tc_pago ?? facturaEnProceso.tipo_cambio ?? 1) as number)
            const impTotal = (facturaEnProceso.imp_total || 0) * tcModal
            const impGravado = (facturaEnProceso.imp_neto_gravado || 0) * tcModal
            const impIva = (facturaEnProceso.iva || 0) * tcModal
            const impNoGravado = (facturaEnProceso.imp_neto_no_gravado || 0) * tcModal
            const impExento = (facturaEnProceso.imp_op_exentas || 0) * tcModal
            const saldoGravado = impGravado - (descuentoDesglose?.gravado || 0)
            const saldoIva = impIva - (descuentoDesglose?.iva || 0)
            const transferencia = impTotal - (descuentoDesglose?.total || 0) - montoRetencion
            const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            return (
            <div className="space-y-3">
              {datosSicoreCalculo.esRetencionAdicional && (
                <div className="bg-yellow-100 text-yellow-800 text-xs p-2 rounded">
                  ⚠️ Retención adicional en el mes — el mínimo no imponible ya está consumido
                </div>
              )}

              {/* Tabla desglose gravado / IVA */}
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-xs font-semibold text-green-800 mb-2">{tipoSeleccionado ? `${tipoSeleccionado.emoji} ${tipoSeleccionado.tipo} — Desglose` : 'Desglose'}</p>
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
                  <span className="text-gray-500">Retención {tipoSeleccionado ? `${(tipoSeleccionado.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}%` : ''}:</span>
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
                    type="text"
                    placeholder={descuentoTipoInput === 'pct' ? 'ej: 5' : 'ej: 21.438'}
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

              <div className="flex gap-2 flex-wrap">
                <Button onClick={finalizarProcesoSicore} className="flex-1 bg-green-600 hover:bg-green-700">
                  ✅ Confirmar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const nuevo = prompt('Cambiar monto retención:', montoRetencion.toFixed(2).replace('.', ','))
                    if (nuevo !== null) setMontoRetencion(parseFloat(nuevo.replace(/\./g, '').replace(',', '.')) || 0)
                  }}
                  title="Modificar monto retención"
                >
                  📝
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setDescuentoAdicional(0)
                    setDescuentoDesglose(null)
                    setDescuentoInputValor('')
                    await ejecutarGuardadoPendiente()
                    setMostrarModalSicore(false)
                    setFacturaEnProceso(null)
                    setPasoSicore('tipo')
                  }}
                  title="Continuar sin descuento ni retención"
                >
                  ➡️ Sin descuento
                </Button>
                <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={cancelarGuardadoPendiente} title="Abortar — revierte el cambio de estado">
                  🚫 Abortar
                </Button>
              </div>
            </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal: Asignar cuota SICORE post-cierre quincena */}
      {modalAsignarCuotaSicore && (
        <Dialog open={true} onOpenChange={() => setModalAsignarCuotaSicore(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Actualizar cuota SICORE</DialogTitle>
              <DialogDescription>
                Quincena <strong>{modalAsignarCuotaSicore.quincena}</strong> — Total retenciones:{' '}
                <strong>${modalAsignarCuotaSicore.totalRet.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Cuota a actualizar</label>
                {modalAsignarCuotaSicore.cuotas.length === 0 ? (
                  <p className="text-sm text-red-600">No hay cuotas pendientes en los templates SICORE.</p>
                ) : (
                  <select
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    value={modalAsignarCuotaSicore.cuotaIdSeleccionada}
                    onChange={e => setModalAsignarCuotaSicore(prev => prev ? { ...prev, cuotaIdSeleccionada: e.target.value } : null)}
                  >
                    {modalAsignarCuotaSicore.cuotas.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.id === modalAsignarCuotaSicore.cuotaIdSugerida ? '⭐ ' : ''}{c.label}
                      </option>
                    ))}
                  </select>
                )}
                {modalAsignarCuotaSicore.cuotaIdSugerida && modalAsignarCuotaSicore.cuotaIdSeleccionada !== modalAsignarCuotaSicore.cuotaIdSugerida && (
                  <p className="text-xs text-amber-600">⚠️ Estás seleccionando una cuota distinta a la sugerida</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Estado de la cuota</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={modalAsignarCuotaSicore.estadoSeleccionado}
                  onChange={e => setModalAsignarCuotaSicore(prev => prev ? { ...prev, estadoSeleccionado: e.target.value } : null)}
                >
                  <option value="pagar">pagar</option>
                  <option value="pendiente">pendiente</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setModalAsignarCuotaSicore(null)}>
                Cancelar (no llenar template)
              </Button>
              <Button
                size="sm"
                disabled={!modalAsignarCuotaSicore.cuotaIdSeleccionada}
                onClick={() => confirmarAsignacionCuotaSicore(
                  modalAsignarCuotaSicore.cuotaIdSeleccionada,
                  modalAsignarCuotaSicore.totalRet,
                  modalAsignarCuotaSicore.estadoSeleccionado
                )}
                className="bg-green-700 hover:bg-green-800"
              >
                Actualizar cuota
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

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

              {/* Toggle "Mostrar anulados" + recargar */}
              {quincenaSeleccionadaV2 && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mostrarAnulados}
                      onChange={e => {
                        const v = e.target.checked
                        setMostrarAnulados(v)
                        // Pasar el valor nuevo como override — sin esto, previsualizarV2
                        // leería el state viejo (stale closure)
                        if (quincenaSeleccionadaV2) previsualizarV2(quincenaSeleccionadaV2, v)
                      }}
                    />
                    Mostrar registros anulados (tachados, no entran al TXT ni a totales)
                  </label>
                </div>
              )}

              {/* Tabla de registros */}
              {registrosV2.length > 0 && (
                <TablaRegistrosV2 registros={registrosV2} onCertificado={generarCertificadoRetencion} mostrarAnulados={mostrarAnulados} />
              )}

              {conteoV2 !== null && conteoV2.cantidad === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  ⚠️ Sin registros para esta quincena en sicore_retenciones
                </div>
              )}

              {/* Estado quincena (abierta / cerrada / declarada) */}
              {registrosV2.length > 0 && (() => {
                const vigentes = registrosV2.filter((r: any) => !r.anulado)
                if (vigentes.length === 0) return null
                const todasDeclaradas = vigentes.every((r: any) => r.estado_quincena === 'declarada')
                const todasCerradas = vigentes.every((r: any) => r.estado_quincena === 'cerrada' || r.estado_quincena === 'declarada')
                const algunaCerrada = vigentes.some((r: any) => r.estado_quincena === 'cerrada' || r.estado_quincena === 'declarada')
                const fechasCerrada = vigentes.map((r: any) => r.fecha_cerrada).filter(Boolean).sort()
                const fechaCerradaMin = fechasCerrada[0]
                const fechasDeclarada = vigentes.map((r: any) => r.fecha_declarada).filter(Boolean).sort()
                const fechaDeclaradaMin = fechasDeclarada[0]
                // ¿Hay registros agregados después de la primera fecha_cerrada?
                const modificadaTrasCierre = fechaCerradaMin && vigentes.some((r: any) =>
                  r.estado_quincena === 'abierta' || (r.created_at && r.created_at > fechaCerradaMin)
                )
                const fmtFC = (s: string | null) => s ? new Date(s).toLocaleString('es-AR') : ''

                if (todasDeclaradas) {
                  return (
                    <div className="flex items-center gap-2 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700">
                      <span>🔒</span>
                      <span className="font-medium">DDJJ Confirmada</span>
                      <span className="text-gray-500">— declarada a AFIP{fechaDeclaradaMin ? ` el ${fmtFC(fechaDeclaradaMin)}` : ''}</span>
                    </div>
                  )
                }
                if (todasCerradas || algunaCerrada) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                        <span className="text-sm text-yellow-800 flex-1">
                          📤 Quincena cerrada{fechaCerradaMin ? ` el ${fmtFC(fechaCerradaMin)}` : ''} — pendiente confirmar DDJJ
                        </span>
                        <Button
                          size="sm"
                          onClick={() => quincenaSeleccionadaV2 && confirmarDDJJSicore(quincenaSeleccionadaV2)}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          ✅ Confirmar DDJJ
                        </Button>
                      </div>
                      {modificadaTrasCierre && (
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-800">
                          ⚠️ Hay registros modificados después del cierre — regenerá el TXT antes de declarar.
                        </div>
                      )}
                    </div>
                  )
                }
                // Todo abierta
                return (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700">
                    🟢 Quincena abierta — modificable libremente. Cuando termines, generá el Export v2 y cerrá.
                  </div>
                )
              })()}

              {/* Botones acción */}
              <div className="flex gap-2">
                <Button
                  onClick={() => quincenaSeleccionadaV2 && setMostrarModalExport(true)}
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
            // Determinar rol para mostrar/habilitar selector fecha (desde la sesión, no la URL)
            const esAdminFecha = userRole === 'admin'
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
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filtroOrigenPagos.sueldo}
                  onCheckedChange={(checked) => setFiltroOrigenPagos(prev => ({ ...prev, sueldo: !!checked }))}
                />
                <span className="text-sm flex items-center gap-1">
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 text-xs">Sueldos</Badge>
                  ({sueldosPagos.length})
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
                  if (filtroOrigenPagos.sueldo) {
                    setSueldosSeleccionadosPagos(new Set(sueldosPagos.map(s => s.id)))
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
                  setSueldosSeleccionadosPagos(new Set())
                }}
                className="text-xs"
              >
                Deseleccionar
              </Button>
              {/* Exportar lote a Excel banco Galicia */}
              {!esContable && (
                <Button
                  size="sm"
                  onClick={() => {
                    const items: ItemSeleccionado[] = []
                    const schema = empresa.toLowerCase()
                    // FCs sueltas — pero si una FC tiene grupo_pago_id y el grupo está seleccionado, NO la agregamos como suelta
                    const facturasIds = Array.from(facturasSeleccionadasPagos)
                    const facturasObj = facturasPagos.filter(f => facturasIds.includes(f.id))
                    // Detectar grupos: si varias FCs tienen mismo grupo_pago_id y están todas seleccionadas → grupo
                    const gruposDetectados = new Set<string>()
                    for (const f of facturasObj) {
                      if (f.grupo_pago_id) {
                        const todasDelGrupo = facturasPagos.filter((x: any) => x.grupo_pago_id === f.grupo_pago_id)
                        const todasSeleccionadas = todasDelGrupo.every((x: any) => facturasSeleccionadasPagos.has(x.id))
                        if (todasSeleccionadas) gruposDetectados.add(f.grupo_pago_id)
                      }
                    }
                    // Agregar grupos
                    gruposDetectados.forEach(gid => items.push({ tipo: 'grupo', id: gid, schema }))
                    // FCs sueltas (que no estén en un grupo agregado)
                    facturasObj.forEach(f => {
                      if (!f.grupo_pago_id || !gruposDetectados.has(f.grupo_pago_id)) {
                        items.push({ tipo: 'fc', id: f.id, schema })
                      }
                    })
                    // Templates (cuotas) — igual lógica de grupo
                    const templatesIds = Array.from(templatesSeleccionadosPagos)
                    const templatesObj = templatesPagos.filter((t: any) => templatesIds.includes(t.id))
                    templatesObj.forEach((t: any) => {
                      if (!t.grupo_pago_id || !gruposDetectados.has(t.grupo_pago_id)) {
                        items.push({ tipo: 'cuota_template', id: t.id })
                      }
                    })
                    // Anticipos
                    Array.from(anticiposSeleccionadosPagos).forEach(id => items.push({ tipo: 'anticipo', id }))
                    // Sueldos
                    Array.from(sueldosSeleccionadosPagos).forEach(id => items.push({ tipo: 'sueldo', id }))

                    if (items.length === 0) {
                      toast.error('Seleccioná al menos un ítem para exportar')
                      return
                    }
                    setModalExportarLote({ open: true, items })
                  }}
                  className="text-xs bg-blue-600 hover:bg-blue-700"
                >
                  <Banknote className="mr-1 h-3.5 w-3.5" />
                  Exportar lote Galicia
                </Button>
              )}
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
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap px-2">
              <Checkbox
                checked={filtroSoloNCPagos}
                onCheckedChange={(checked) => setFiltroSoloNCPagos(!!checked)}
              />
              <span className="text-sm flex items-center gap-1">
                <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">Solo NC</Badge>
              </span>
            </label>
          </div>

          {cargandoPagos ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Cargando facturas...</span>
            </div>
          ) : (() => {
            // Determinar rol del usuario (desde la sesión, no la URL)
            const esAdmin = userRole === 'admin'

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
              // Filtro "Solo NC": solo Notas de Crédito (por tipo_comprobante AFIP)
              if (filtroSoloNCPagos && ![3, 8, 13, 53, 203, 208, 213].includes(f.tipo_comprobante)) return false
              if (!filtroBusquedaPagos.trim()) return true
              const q = normalizarBusqueda(filtroBusquedaPagos)
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
              ].some(v => v && normalizarBusqueda(String(v)).includes(q))
            }

            // Filtrar facturas por estado, búsqueda y ordenar por fecha
            const facturasPreparado = ordenarPorFecha(facturasPagos.filter(f => f.estado === 'preparado' && matchBusqueda(f)))
            const facturasPagar = ordenarPorFecha(facturasPagos.filter(f => f.estado === 'pagar' && matchBusqueda(f)))
            const facturasPendiente = ordenarPorFecha(facturasPagos.filter(f => f.estado === 'pendiente' && matchBusqueda(f)))
            const facturasEcheq = ordenarPorFecha(facturasPagos.filter(f => f.estado === 'echeq' && matchBusqueda(f)))

            // Subtotales: misma fuente única que el display y el PDF (montoPagoEnPesos)
            const montoEnPesos = (f: FacturaArca) => montoPagoEnPesos(f)
            const subtotalPreparado = facturasPreparado.reduce((sum, f) => sum + montoEnPesos(f), 0)
            const subtotalPagar = facturasPagar.reduce((sum, f) => sum + montoEnPesos(f), 0)
            const subtotalPendiente = facturasPendiente.reduce((sum, f) => sum + montoEnPesos(f), 0)

            // ── Agrupar / Desagrupar pagos ────────────────────────────────

            // Facturas seleccionadas que están en estado 'pagar' y pertenecen a este grupo de facturas
            const seleccionadasEnPagar = facturas.filter(
              f => facturasSeleccionadasPagos.has(f.id) && f.estado === 'pagar'
            )
            // Hay agrupación posible si hay 2+ del mismo proveedor sin grupo asignado
            const cuitsUnicos = new Set(seleccionadasEnPagar.map(f => f.cuit))
            const esMultiCuit = cuitsUnicos.size > 1
            const puedeAgrupar = seleccionadasEnPagar.length >= 2
              && seleccionadasEnPagar.every(f => !f.grupo_pago_id)

            // Hay desagrupación posible si todas las seleccionadas tienen el mismo grupo
            const gruposSeleccionados = new Set(
              seleccionadasEnPagar.filter(f => f.grupo_pago_id).map(f => f.grupo_pago_id)
            )
            const puedeDesagrupar = gruposSeleccionados.size === 1

            const agruparPagos = async () => {
              if (!puedeAgrupar) return
              // Alerta si CUITs distintos
              if (esMultiCuit) {
                const proveedores = [...new Set(seleccionadasEnPagar.map(f => f.denominacion_emisor))].join(', ')
                if (!window.confirm(`⚠️ ATENCIÓN: Las facturas seleccionadas tienen CUITs diferentes:\n\n${proveedores}\n\nEsto es inusual. ¿Confirmar agrupación?`)) return
              }
              const primeraF = seleccionadasEnPagar[0]
              const monto_total = seleccionadasEnPagar.reduce(
                (s, f) => s + montoEnPesos(f), 0
              )
              // Proveedor: combinar nombres si multi-CUIT
              const proveedoresUnicos = [...new Set(seleccionadasEnPagar.map(f => f.denominacion_emisor).filter(Boolean))]
              const proveedorGrupo = proveedoresUnicos.length <= 2
                ? proveedoresUnicos.join(' + ')
                : `${proveedoresUnicos[0]} + ${proveedoresUnicos.length - 1} más`
              // 1. Crear grupo
              const { data: grupo, error: errGrupo } = await supabase
                .schema(schemaName)
                .from('grupos_pago')
                .insert({
                  cuit: primeraF.cuit,
                  proveedor: proveedorGrupo,
                  monto_total,
                  estado: 'pagar',
                  observaciones: esMultiCuit ? `Multi-CUIT: ${[...cuitsUnicos].join(', ')}` : null,
                })
                .select('id')
                .single()
              if (errGrupo || !grupo) { alert('Error al crear grupo'); return }
              // 2. Asignar grupo a las facturas
              const ids = seleccionadasEnPagar.map(f => f.id)
              const { error: errUpd } = await supabase
                .schema(schemaName)
                .from('comprobantes_arca')
                .update({ grupo_pago_id: grupo.id })
                .in('id', ids)
              if (errUpd) { alert('Error al asignar grupo'); return }
              // 3. Actualizar estado local
              setFacturasPagos(prev => prev.map(f =>
                ids.includes(f.id) ? { ...f, grupo_pago_id: grupo.id } : f
              ))
              setFacturasSeleccionadasPagos(new Set())
              alert(`✅ ${ids.length} facturas agrupadas en un pago${esMultiCuit ? ' (multi-CUIT)' : ''}`)
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
                .schema(schemaName)
                .from('comprobantes_arca')
                .update({ grupo_pago_id: null })
                .in('id', ids)
              // Si el grupo queda con 0 o 1 factura, eliminar el grupo
              if (quedan.length <= 1) {
                if (quedan.length === 1) {
                  await supabase.schema(schemaName).from('comprobantes_arca')
                    .update({ grupo_pago_id: null }).eq('grupo_pago_id', grupoId)
                }
                await supabase.schema(schemaName).from('grupos_pago').delete().eq('id', grupoId)
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
                .schema(schemaName)
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
                await supabase.schema(schemaName).from('grupos_pago').delete().eq('id', grupoId)
              }
              setTemplatesPagos(prev => prev.map(t =>
                ids.includes(t.id) ? { ...t, grupo_pago_id: null } : t
              ))
              setTemplatesSeleccionadosPagos(new Set())
            }

            // ── Agrupar / Desagrupar sueldos ─────────────────────────────────
            const seleccionadasSueldosActivas = sueldosPagos.filter(
              s => sueldosSeleccionadosPagos.has(s.id)
            )
            const puedeAgruparSueldos = seleccionadasSueldosActivas.length >= 2
              && seleccionadasSueldosActivas.every(s => !s.grupo_pago_id)

            const gruposSueldosSeleccionados = new Set(
              seleccionadasSueldosActivas.filter(s => s.grupo_pago_id).map(s => s.grupo_pago_id)
            )
            const puedeDesagruparSueldos = gruposSueldosSeleccionados.size === 1

            const agruparSueldos = async () => {
              if (!puedeAgruparSueldos) return
              const primero = seleccionadasSueldosActivas[0]
              const monto_total = seleccionadasSueldosActivas.reduce((s, p) => s + (p.monto || 0), 0)
              const nombresUnicos = [...new Set(seleccionadasSueldosActivas.map(p => p.empleado?.nombre).filter(Boolean))]
              const proveedorGrupo = nombresUnicos.length <= 2
                ? nombresUnicos.join(' + ')
                : `${nombresUnicos[0]} + ${nombresUnicos.length - 1} más`
              // Crear grupo
              const { data: grupo, error: errGrupo } = await supabase
                .schema(schemaName)
                .from('grupos_pago')
                .insert({
                  cuit: primero.empleado?.cuit_empleado || 'SUELDO',
                  proveedor: proveedorGrupo,
                  monto_total,
                  estado: 'pagar',
                  observaciones: `Sueldos agrupados: ${nombresUnicos.join(', ')}`,
                })
                .select('id')
                .single()
              if (errGrupo || !grupo) { alert('Error al crear grupo'); return }
              // Asignar grupo a los pagos
              const ids = seleccionadasSueldosActivas.map(s => s.id)
              const { error: errUpd } = await supabase
                .from('sueldos_pagos')
                .update({ grupo_pago_id: grupo.id })
                .in('id', ids)
              if (errUpd) { alert('Error al asignar grupo a sueldos'); return }
              setSueldosPagos(prev => prev.map(s =>
                ids.includes(s.id) ? { ...s, grupo_pago_id: grupo.id } : s
              ))
              setSueldosSeleccionadosPagos(new Set())
              alert(`✅ ${ids.length} pagos de sueldo agrupados`)
            }

            const desagruparSueldos = async () => {
              if (!puedeDesagruparSueldos) return
              const grupoId = Array.from(gruposSueldosSeleccionados)[0] as string
              const ids = seleccionadasSueldosActivas.filter(s => s.grupo_pago_id === grupoId).map(s => s.id)
              const todasDelGrupo = sueldosPagos.filter(s => s.grupo_pago_id === grupoId)
              const quedan = todasDelGrupo.filter(s => !ids.includes(s.id))
              await supabase
                .from('sueldos_pagos')
                .update({ grupo_pago_id: null })
                .in('id', ids)
              if (quedan.length <= 1) {
                if (quedan.length === 1) {
                  await supabase.from('sueldos_pagos')
                    .update({ grupo_pago_id: null }).eq('grupo_pago_id', grupoId)
                }
                await supabase.schema(schemaName).from('grupos_pago').delete().eq('id', grupoId)
              }
              setSueldosPagos(prev => prev.map(s =>
                ids.includes(s.id) ? { ...s, grupo_pago_id: null } : s
              ))
              setSueldosSeleccionadosPagos(new Set())
            }

            // Filtrar sueldos por búsqueda
            const matchBusquedaSueldo = (s: any) => {
              if (filtroSoloNCPagos) return false  // "Solo NC" oculta sueldos
              if (!filtroBusquedaPagos.trim()) return true
              const q = normalizarBusqueda(filtroBusquedaPagos)
              return [
                s.empleado?.nombre,
                s.empleado?.cuit_empleado,
                s.descripcion,
                s.tipo,
                String(s.monto ?? ''),
                s.fecha,
              ].some(v => v && normalizarBusqueda(String(v)).includes(q))
            }

            const sueldosPagar = sueldosPagos.filter(s => s.estado === 'pagar' && matchBusquedaSueldo(s))
              .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
            const sueldosPreparado = sueldosPagos.filter(s => s.estado === 'preparado' && matchBusquedaSueldo(s))
              .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
            const sueldosPendiente = sueldosPagos.filter(s => s.estado === 'pendiente' && matchBusquedaSueldo(s))
              .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

            // Helper para identificar Notas de Crédito por tipo_comprobante AFIP
            const esNotaCredito = (f: FacturaArca) => [3, 8, 13, 53, 203, 208, 213].includes(f.tipo_comprobante)
            const esNotaDebito = (f: FacturaArca) => [2, 7, 12, 52, 202, 207, 212].includes(f.tipo_comprobante)
            const abrevTipoComp = (f: FacturaArca) => esNotaCredito(f) ? 'NC' : esNotaDebito(f) ? 'ND' : 'FC'

            // Toggle visible_contable (Visible para Ulises) — solo admin
            const toggleVisibleContable = async (
              origen: 'facturas' | 'templates' | 'anticipos' | 'sueldos',
              ids: string[]
            ) => {
              if (ids.length === 0) return
              const items: any[] =
                origen === 'facturas' ? facturasPagos.filter(f => ids.includes(f.id))
                : origen === 'templates' ? templatesPagos.filter(t => ids.includes(t.id))
                : origen === 'anticipos' ? anticiposPagos.filter(a => ids.includes(a.id))
                : sueldosPagos.filter(s => ids.includes(s.id))
              if (items.length === 0) return
              const todasVisibles = items.every(i => i.visible_contable === true)
              const nuevoValor = !todasVisibles
              try {
                if (origen === 'facturas') {
                  const { error } = await supabase.schema(schemaName).from('comprobantes_arca')
                    .update({ visible_contable: nuevoValor }).in('id', ids)
                  if (error) throw error
                  setFacturasPagos(prev => prev.map(f => ids.includes(f.id) ? { ...f, visible_contable: nuevoValor } as any : f))
                } else if (origen === 'templates') {
                  const { error } = await supabase.from('cuotas_egresos_sin_factura')
                    .update({ visible_contable: nuevoValor }).in('id', ids)
                  if (error) throw error
                  setTemplatesPagos(prev => prev.map(t => ids.includes(t.id) ? { ...t, visible_contable: nuevoValor } : t))
                } else if (origen === 'anticipos') {
                  const { error } = await supabase.from('anticipos_proveedores')
                    .update({ visible_contable: nuevoValor }).in('id', ids)
                  if (error) throw error
                  setAnticiposPagos(prev => prev.map(a => ids.includes(a.id) ? { ...a, visible_contable: nuevoValor } : a))
                } else {
                  const { error } = await supabase.from('sueldos_pagos')
                    .update({ visible_contable: nuevoValor }).in('id', ids)
                  if (error) throw error
                  setSueldosPagos(prev => prev.map(s => ids.includes(s.id) ? { ...s, visible_contable: nuevoValor } : s))
                }
                toast.success(nuevoValor ? `${ids.length} marcado(s) como visibles para Ulises` : `${ids.length} oculto(s) de Ulises`)
              } catch (err: any) {
                toast.error(`Error al actualizar visible_contable: ${err?.message || 'desconocido'}`)
              }
            }

            // Función para cambiar estado de facturas seleccionadas
            const cambiarEstadoSeleccionadas = async (nuevoEstado: string, echeqFecha?: string) => {
              if (facturasSeleccionadasPagos.size === 0) {
                alert('Selecciona al menos una factura')
                return
              }

              const ids = Array.from(facturasSeleccionadasPagos)
              const facturasACambiar = facturasPagos.filter(f => ids.includes(f.id))

              // Warning FC: avisar si se paga sin comprobante físico recibido
              if (nuevoEstado === 'pagar' || nuevoEstado === 'preparado') {
                const sinFC = facturasACambiar.filter(f => f.fc !== 'Sí')
                if (sinFC.length > 0) {
                  toast.warning(`${sinFC.length} factura(s) sin comprobante físico recibido (FC ≠ Sí)`, { duration: 5000 })
                }
              }

              // ── INTERCEPTAR CANCELACIÓN FC/NC ──────────────────────────────────
              if (nuevoEstado === 'pagar') {
                const fcsSeleccionadas = facturasACambiar.filter(f => !esNotaCredito(f))
                const ncsSeleccionadas = facturasACambiar.filter(f => esNotaCredito(f))

                // ESCENARIO A: Usuario seleccionó FCs → buscar NCs pendientes del mismo CUIT
                if (fcsSeleccionadas.length > 0 && ncsSeleccionadas.length === 0) {
                  const cuitsFC = [...new Set(fcsSeleccionadas.map(f => f.cuit))]
                  const ncsDisponibles = facturasPagos.filter(f =>
                    esNotaCredito(f) &&
                    cuitsFC.includes(f.cuit) &&
                    (f.estado === 'pendiente' || f.estado === 'pagar') &&
                    !ids.includes(f.id)
                  )
                  if (ncsDisponibles.length > 0) {
                    const opcion = window.confirm(
                      `Hay ${ncsDisponibles.length} Nota(s) de Crédito pendiente(s) del mismo proveedor:\n\n` +
                      ncsDisponibles.map(nc => `• NC ${nc.numero_desde || ''} — ${nc.denominacion_emisor} — $${Math.abs(nc.imp_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`).join('\n') +
                      `\n\n¿Desea aplicar las NC para cancelar?` +
                      `\n\n[Aceptar] = Seleccionar NC a aplicar\n[Cancelar] = Continuar sin aplicar NC`
                    )
                    if (opcion) {
                      setModalCancelacionNC({
                        tipo: 'fc_con_nc',
                        facturas: fcsSeleccionadas,
                        disponibles: ncsDisponibles,
                        seleccionadas: new Set(ncsDisponibles.map(nc => nc.id)),
                        restoCambioEstado: [] // se determinará al procesar
                      })
                      return
                    }
                    // Si dice No → continúa flujo normal de pagar
                  }
                }

                // ESCENARIO B: Usuario seleccionó NCs → buscar FCs conciliadas con descuento_aplicado
                if (ncsSeleccionadas.length > 0 && fcsSeleccionadas.length === 0) {
                  const cuitsNC = [...new Set(ncsSeleccionadas.map(f => f.cuit))]
                  // Buscar en BD FCs del mismo CUIT con descuento aplicado y todavía no cubierto
                  // (consulta mudada a lib/pagos/cancelacion-nc.ts — A-FEAT-1232).
                  const fcsDisponibles = await facturasConDescuentoParaNC(supabase, schemaName, cuitsNC as string[])

                  if (fcsDisponibles.length > 0) {
                    const opcion = window.confirm(
                      `Hay ${fcsDisponibles.length} Factura(s) pagada(s) del mismo proveedor con descuento aplicado:\n\n` +
                      fcsDisponibles.map((fc: any) => `• FC ${fc.numero_desde || ''} — ${fc.denominacion_emisor} — Descuento: $${fc.descuento_aplicado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`).join('\n') +
                      `\n\n¿Desea aplicar las NC contra estos descuentos?` +
                      `\n\n[Aceptar] = Seleccionar FC con descuento\n[Cancelar] = Continuar sin aplicar`
                    )
                    if (opcion) {
                      setModalCancelacionNC({
                        tipo: 'nc_con_descuento',
                        facturas: ncsSeleccionadas,
                        disponibles: fcsDisponibles as unknown as FacturaArca[],
                        seleccionadas: new Set(),
                        restoCambioEstado: []
                      })
                      return
                    }
                  }
                }
              }

              // Para ECHEQ: echeqFecha sobreescribe fechaPagoSeleccionada (evita stale closure)
              const fechaEfectiva = echeqFecha || fechaPagoSeleccionada

              // Si viene de ECHEQ y el destino es 'pagar', usar estado 'echeq'
              const estadoEfectivo = (echeqFecha || echeqPendienteRef.current) && nuevoEstado === 'pagar'
                ? 'echeq'
                : nuevoEstado

              // Preparar datos de actualización (incluye fecha si está seleccionada)
              const datosUpdate: any = { estado: estadoEfectivo }
              if (echeqPendienteRef.current && estadoEfectivo === 'echeq') {
                datosUpdate.metodo_pago = 'echeq'
                datosUpdate.fecha_cobro_echeq = echeqPendienteRef.current.fechaCobro
              }
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
                      .schema(schemaName)
                      .from('comprobantes_arca')
                      .update(datosUpdate)
                      .in('id', idsNoSicore)

                    setFacturasPagos(prev => prev.map(f =>
                      idsNoSicore.includes(f.id)
                        ? { ...f, estado: estadoEfectivo, ...(fechaEfectiva && { fecha_vencimiento: fechaEfectiva, fecha_estimada: fechaEfectiva }) }
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
                    .schema(schemaName)
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
                `¿Cambiar ${facturasSeleccionadasPagos.size} factura(s) a estado "${estadoEfectivo}"?${mensajeFecha}`
              )
              if (!confirmar) return

              try {
                const { error } = await supabase
                  .schema(schemaName)
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
                        .schema(schemaName)
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
                    ? { ...f, estado: estadoEfectivo, ...(fechaEfectiva && { fecha_vencimiento: fechaEfectiva, fecha_estimada: fechaEfectiva }) }
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

            // ── Helpers revertir estado (solo Admin) ──────────────────────────
            const revertirFacturaAPendiente = async (f: FacturaArca) => {
              if (f.sicore || f.monto_sicore) {
                await resetearFactura(f)
              } else {
                if (!window.confirm(`¿Volver FC de ${f.denominacion_emisor} a estado pendiente?`)) return
                const { error } = await supabase.schema(schemaName).from('comprobantes_arca')
                  .update({ estado: 'pendiente' })
                  .eq('id', f.id)
                if (error) { toast.error('Error: ' + error.message); return }
                setFacturasPagos(prev => prev.map(x => x.id === f.id ? { ...x, estado: 'pendiente' } : x))
                setFacturasSeleccionadasPagos(prev => { const next = new Set(prev); next.delete(f.id); return next })
                cargarFacturas()
              }
            }

            const revertirTemplateAPendiente = async (t: any) => {
              if (!window.confirm(`¿Volver "${t.nombre_referencia || t.descripcion || 'template'}" a estado pendiente?`)) return
              const { error } = await supabase
                .from('cuotas_egresos_sin_factura')
                .update({ estado: 'pendiente' })
                .eq('id', t.id)
              if (error) { toast.error('Error: ' + error.message); return }
              setTemplatesPagos(prev => prev.map(x => x.id === t.id ? { ...x, estado: 'pendiente' } : x))
              setTemplatesSeleccionadosPagos(prev => { const next = new Set(prev); next.delete(t.id); return next })
            }

            // Función para renderizar tabla de facturas
            const renderTablaFacturas = (facturas: FacturaArca[], titulo: string, subtotal: number, estadoActual: string, mostrarCheckbox: boolean = true, accionBoton?: { label: string, estado: string }, accionSecundaria?: { label: string, estado: string }, onRevertir?: (f: FacturaArca) => void) => {
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
                  montoTotal: facs.reduce((sum, f) => sum + montoEnPesos(f), 0),
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
                          {accionBoton.estado !== 'pagado' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEcheqForm({ banco: '', numero: '', fechaEmision: hoyArgentina(), fechaCobro: '' })
                              setEcheqEstadoDestino('pagar')
                              setEcheqOrigen('facturas')
                              setMostrarModalEcheq(true)
                            }}
                            className="border-amber-500 text-amber-700 hover:bg-amber-50"
                            title="Pagar con ECHEQ"
                          >
                            📝 ECHEQ ({seleccionadasEnEsteBloque})
                          </Button>
                          )}
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
                      {!esContable && facturasSeleccionadasPagos.size > 0 && facturas.some(f => facturasSeleccionadasPagos.has(f.id)) && (() => {
                        const sel = facturas.filter(f => facturasSeleccionadasPagos.has(f.id))
                        const todasVisibles = sel.every(f => f.visible_contable === true)
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-cyan-500 text-cyan-700 hover:bg-cyan-50"
                            onClick={() => toggleVisibleContable('facturas', sel.map(f => f.id))}
                            title="Hacer visible/oculto para Ulises (rol contable)"
                          >
                            {todasVisibles ? '🚫 Ocultar Ulises' : '👁 Visible Ulises'} ({sel.length})
                          </Button>
                        )
                      })()}
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
                            <TableHead className="w-[30px]">FC</TableHead>
                            <TableHead>F. Emisión</TableHead>
                            <TableHead>Fecha Vto.</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>CUIT</TableHead>
                            <TableHead>Cuenta</TableHead>
                            <TableHead className="max-w-[200px]">Detalle</TableHead>
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
                                  <TableCell></TableCell>
                                  <TableCell></TableCell>
                                  <TableCell className="min-w-[110px]">
                                    {editandoFechaPagosId === row.grupoPagoId ? (
                                      <Input
                                        type="date"
                                        value={editandoFechaPagosVal}
                                        onChange={e => setEditandoFechaPagosVal(e.target.value)}
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter' && editandoFechaPagosVal) {
                                            await supabase.schema(schemaName).from('comprobantes_arca')
                                              .update({ fecha_estimada: editandoFechaPagosVal, fecha_vencimiento: editandoFechaPagosVal })
                                              .in('id', row.ids)
                                            setFacturasPagos(prev => prev.map(x => row.ids.includes(x.id) ? { ...x, fecha_estimada: editandoFechaPagosVal, fecha_vencimiento: editandoFechaPagosVal } : x))
                                            setEditandoFechaPagosId(null)
                                          }
                                          if (e.key === 'Escape') setEditandoFechaPagosId(null)
                                        }}
                                        onBlur={async () => {
                                          if (editandoFechaPagosVal) {
                                            await supabase.schema(schemaName).from('comprobantes_arca')
                                              .update({ fecha_estimada: editandoFechaPagosVal, fecha_vencimiento: editandoFechaPagosVal })
                                              .in('id', row.ids)
                                            setFacturasPagos(prev => prev.map(x => row.ids.includes(x.id) ? { ...x, fecha_estimada: editandoFechaPagosVal, fecha_vencimiento: editandoFechaPagosVal } : x))
                                          }
                                          setEditandoFechaPagosId(null)
                                        }}
                                        className="h-7 text-xs w-[120px]"
                                        autoFocus
                                      />
                                    ) : (
                                      <span
                                        className="cursor-pointer hover:bg-purple-100 px-1 py-0.5 rounded text-xs font-medium"
                                        title="Click para cambiar fecha de pago del grupo (propaga a todas las FC)"
                                        onClick={() => {
                                          setEditandoFechaPagosId(row.grupoPagoId)
                                          setEditandoFechaPagosVal(row.fecha || facsGrupo[0]?.fecha_vencimiento || facsGrupo[0]?.fecha_estimada || '')
                                        }}
                                      >
                                        {row.fecha || '-'}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate">
                                    <span className="font-medium">{row.proveedor}</span>
                                    <span className="ml-2 text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-semibold">
                                      🔗 {row.cantFacturas} FC
                                    </span>
                                  </TableCell>
                                  <TableCell>{row.cuit}</TableCell>
                                  <TableCell className="max-w-[150px] truncate">{row.cuentaContable}</TableCell>
                                  <TableCell className="text-xs text-gray-400">—</TableCell>
                                  <TableCell className="text-right font-bold text-purple-700">
                                    ${row.montoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button size="sm" variant="ghost" title="Generar PDF detalle de pago"
                                        onClick={() => generarPDFDetallePago('arca', row.proveedor, row.cuit, mapFacsAItems(facsGrupo))}
                                      >📄</Button>
                                      <Button size="sm" variant="ghost" title="Encolar mail de detalle al proveedor"
                                        onClick={() => encolarMailDetalle('arca', row.proveedor, row.cuit, mapFacsAItems(facsGrupo), undefined, facsGrupo.map((f) => (f as { id: string }).id))}
                                      >✉</Button>
                                    </div>
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
                                  <TableCell>
                                    {/* El glosario único de estados FC (A-FEAT-1287): antes sólo pintaba Sí / No / Portal y APP o Confirmada salían «—» */}
                                    {f.fc ? <Badge title={ayudaFc(f.fc)} className={`${colorFc(f.fc)} text-[10px] px-1`}>{f.fc === 'Portal' ? 'P' : f.fc}</Badge>
                                      : <span className="text-gray-300 text-xs">—</span>}
                                  </TableCell>
                                  <TableCell className="text-xs text-gray-500">{f.fecha_emision?.split('-').reverse().join('/') || '-'}</TableCell>
                                  <TableCell className="min-w-[110px]">
                                    {editandoFechaPagosId === f.id ? (
                                      <Input
                                        type="date"
                                        value={editandoFechaPagosVal}
                                        onChange={e => setEditandoFechaPagosVal(e.target.value)}
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter' && editandoFechaPagosVal) {
                                            await supabase.schema(schemaName).from('comprobantes_arca')
                                              .update({ fecha_estimada: editandoFechaPagosVal, fecha_vencimiento: editandoFechaPagosVal })
                                              .eq('id', f.id)
                                            setFacturasPagos(prev => prev.map(x => x.id === f.id ? { ...x, fecha_estimada: editandoFechaPagosVal, fecha_vencimiento: editandoFechaPagosVal } : x))
                                            setEditandoFechaPagosId(null)
                                          }
                                          if (e.key === 'Escape') setEditandoFechaPagosId(null)
                                        }}
                                        onBlur={async () => {
                                          if (editandoFechaPagosVal) {
                                            await supabase.schema(schemaName).from('comprobantes_arca')
                                              .update({ fecha_estimada: editandoFechaPagosVal, fecha_vencimiento: editandoFechaPagosVal })
                                              .eq('id', f.id)
                                            setFacturasPagos(prev => prev.map(x => x.id === f.id ? { ...x, fecha_estimada: editandoFechaPagosVal, fecha_vencimiento: editandoFechaPagosVal } : x))
                                          }
                                          setEditandoFechaPagosId(null)
                                        }}
                                        className="h-7 text-xs w-[120px]"
                                        autoFocus
                                      />
                                    ) : (
                                      <span
                                        className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs"
                                        title="Click para cambiar fecha de pago"
                                        onClick={() => {
                                          setEditandoFechaPagosId(f.id)
                                          setEditandoFechaPagosVal(f.fecha_estimada || f.fecha_vencimiento || '')
                                        }}
                                      >
                                        {(f.fecha_vencimiento || f.fecha_estimada || '-')}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate">{f.denominacion_emisor}</TableCell>
                                  <TableCell>{f.cuit}</TableCell>
                                  <TableCell className="max-w-[220px]">
                                    {editandoCuentaPagosId === f.id ? (
                                      <div className="relative" onBlur={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                          setTimeout(() => setEditandoCuentaPagosId(null), 100)
                                        }
                                      }}>
                                        <SelectorCuentaContable
                                          value={f.cuenta_contable}
                                          cuitProveedor={f.cuit}
                                          schemaName={schemaName}
                                          onSelect={async (cuenta) => {
                                            // 🧾 Camino único (A-DEC-1021): par del plan, su empresa, 11 extractos, y
                                            // también al QUITAR la cuenta (antes no propagaba nada al desasignar).
                                            try {
                                              const r = await pedirAsignacionDeCuenta({
                                                empresa, ids: [f.id], nro_cuenta: cuenta?.nro_cuenta ?? null, cuenta_contable: cuenta?.categ ?? null,
                                              })
                                              avisarAsignacion(r)
                                              const par = { cuenta_contable: r.cuenta?.cuenta_contable ?? null, nro_cuenta: r.cuenta?.nro_cuenta ?? null }
                                              setFacturasPagos(prev => prev.map(x => x.id === f.id ? { ...x, ...par } : x))
                                            } catch (err: any) {
                                              alert('La cuenta NO se guardó: ' + err.message)
                                            }
                                            setEditandoCuentaPagosId(null)
                                          }}
                                          onCancel={() => setEditandoCuentaPagosId(null)}
                                        />
                                      </div>
                                    ) : (
                                      <span
                                        className={`cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded truncate block text-xs ${f.cuenta_contable ? '' : 'text-gray-400 italic'}`}
                                        title={f.cuenta_contable ? `${f.cuenta_contable} — click para editar` : 'Click para asignar cuenta'}
                                        onClick={() => {
                                          setEditandoCuentaPagosId(f.id)
                                        }}
                                      >
                                        {f.cuenta_contable || 'Sin cuenta'}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="max-w-[200px]">
                                    {editandoDetallePagosId === f.id ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        className="border rounded px-1 py-0.5 text-xs w-full"
                                        value={editandoDetallePagosVal}
                                        onChange={(e) => setEditandoDetallePagosVal(e.target.value)}
                                        onBlur={async () => {
                                          const val = editandoDetallePagosVal.trim() || null
                                          if (val !== (f.detalle || null)) {
                                            await supabase.schema(schemaName).from('comprobantes_arca')
                                              .update({ detalle: val }).eq('id', f.id)
                                            setFacturasPagos(prev => prev.map(x => x.id === f.id ? { ...x, detalle: val } : x))
                                          }
                                          setEditandoDetallePagosId(null)
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                          if (e.key === 'Escape') setEditandoDetallePagosId(null)
                                        }}
                                      />
                                    ) : (
                                      <span
                                        className={`cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded truncate block text-xs ${f.detalle ? '' : 'text-gray-400 italic'}`}
                                        title={f.detalle ? `${f.detalle} — click para editar` : 'Click para agregar detalle'}
                                        onClick={() => {
                                          setEditandoDetallePagosId(f.id)
                                          setEditandoDetallePagosVal(f.detalle || '')
                                        }}
                                      >
                                        {f.detalle || 'Sin detalle'}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {(() => {
                                      const tc = f.tc_pago ?? f.tipo_cambio ?? 1
                                      const esUSD = f.moneda === 'USD' || tc > 1.01
                                      const montoPesos = montoPagoEnPesos(f)
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
                                      <div className="flex items-center gap-1">
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
                                                fecha_estimada: f.fecha_estimada || f.fecha_vencimiento || null,
                                                imp_total: (f.imp_total || 0) * tc,
                                                monto_sicore: f.monto_sicore,
                                                descuento_aplicado: f.descuento_aplicado,
                                                monto_a_abonar: (f.monto_sicore || f.descuento_aplicado)
                                                  ? (f.imp_total || 0) * tc - (f.monto_sicore || 0) - (f.descuento_aplicado || 0)
                                                  : (f.monto_a_abonar ?? f.imp_total ?? 0) * tc,
                                              }]
                                            )
                                          }}
                                        >📄</Button>
                                        <Button size="sm" variant="ghost" title="Encolar mail de detalle al proveedor"
                                          onClick={() => {
                                            const tc = f.tc_pago ?? f.tipo_cambio ?? 1
                                            encolarMailDetalle('arca', f.denominacion_emisor, f.cuit, [{
                                              comprobante: `FC ${f.tipo_comprobante}-${String(f.punto_venta || 0).padStart(5,'0')}-${String(f.numero_desde || 0).padStart(8,'0')}`,
                                              fecha: f.fecha_emision || '',
                                              fecha_estimada: f.fecha_estimada || f.fecha_vencimiento || null,
                                              imp_total: (f.imp_total || 0) * tc,
                                              monto_sicore: f.monto_sicore,
                                              descuento_aplicado: f.descuento_aplicado,
                                              monto_a_abonar: (f.monto_sicore || f.descuento_aplicado)
                                                ? (f.imp_total || 0) * tc - (f.monto_sicore || 0) - (f.descuento_aplicado || 0)
                                                : (f.monto_a_abonar ?? f.imp_total ?? 0) * tc,
                                            }], undefined, [f.id])
                                          }}
                                        >✉</Button>
                                        {onRevertir && (
                                          <Button
                                            size="sm" variant="ghost"
                                            title="Volver a Pendiente"
                                            className="text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                                            onClick={() => onRevertir(f)}
                                          >↩</Button>
                                        )}
                                      </div>
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
            const cambiarEstadoAnticiposSeleccionados = async (nuevoEstado: string, echeqFecha?: string) => {
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
                  // Si viene de ECHEQ: sobrescribir fecha_pago con fechaEmision del ECHEQ
                  const anticipoConFecha = echeqFecha
                    ? { ...anticipo, fecha_pago: echeqFecha }
                    : anticipo
                  await cambiarEstadoAnticipoPago(anticipoConFecha, 'pagar')
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
            // Exponer al modal ECHEQ
            cambiarEstadoAnticiposRef.current = cambiarEstadoAnticiposSeleccionados

            // Función para renderizar tabla de templates
            const renderTablaTemplates = (templates: any[], titulo: string, subtotal: number, mostrarCheckbox: boolean = true, accionBoton?: { label: string, estado: string }, accionSecundaria?: { label: string, estado: string }, estadoActual: string = 'pendiente', onRevertir?: (t: any) => void) => {
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
                      {!esContable && templatesSeleccionadosPagos.size > 0 && templates.some(t => templatesSeleccionadosPagos.has(t.id)) && (() => {
                        const sel = templates.filter(t => templatesSeleccionadosPagos.has(t.id))
                        const todasVisibles = sel.every(t => t.visible_contable === true)
                        return (
                          <Button size="sm" variant="outline" className="border-cyan-500 text-cyan-700 hover:bg-cyan-50"
                            onClick={() => toggleVisibleContable('templates', sel.map(t => t.id))}
                            title="Hacer visible/oculto para Ulises (rol contable)">
                            {todasVisibles ? '🚫 Ocultar Ulises' : '👁 Visible Ulises'} ({sel.length})
                          </Button>
                        )
                      })()}
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
                            <TableHead>Fecha Pago</TableHead>
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
                                  <TableCell className="min-w-[110px]">
                                    {editandoFechaPagosId === row.grupoPagoId ? (
                                      <Input
                                        type="date"
                                        value={editandoFechaPagosVal}
                                        onChange={e => setEditandoFechaPagosVal(e.target.value)}
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter' && editandoFechaPagosVal) {
                                            await supabase.from('cuotas_egresos_sin_factura')
                                              .update({ fecha_estimada: editandoFechaPagosVal, fecha_pago: editandoFechaPagosVal })
                                              .in('id', row.ids)
                                            setTemplatesPagos(prev => prev.map(x => row.ids.includes(x.id) ? { ...x, fecha_estimada: editandoFechaPagosVal, fecha_pago: editandoFechaPagosVal } : x))
                                            setEditandoFechaPagosId(null)
                                          }
                                          if (e.key === 'Escape') setEditandoFechaPagosId(null)
                                        }}
                                        onBlur={async () => {
                                          if (editandoFechaPagosVal) {
                                            await supabase.from('cuotas_egresos_sin_factura')
                                              .update({ fecha_estimada: editandoFechaPagosVal, fecha_pago: editandoFechaPagosVal })
                                              .in('id', row.ids)
                                            setTemplatesPagos(prev => prev.map(x => row.ids.includes(x.id) ? { ...x, fecha_estimada: editandoFechaPagosVal, fecha_pago: editandoFechaPagosVal } : x))
                                          }
                                          setEditandoFechaPagosId(null)
                                        }}
                                        className="h-7 text-xs w-[120px]"
                                        autoFocus
                                      />
                                    ) : (
                                      <span
                                        className="cursor-pointer hover:bg-purple-100 px-1 py-0.5 rounded text-xs font-medium"
                                        title="Click para cambiar fecha de pago del grupo (propaga a todas las cuotas)"
                                        onClick={() => {
                                          setEditandoFechaPagosId(row.grupoPagoId)
                                          setEditandoFechaPagosVal(row.fecha || tsGrupo[0]?.fecha_pago || tsGrupo[0]?.fecha_estimada || '')
                                        }}
                                      >
                                        {row.fecha || '-'}
                                      </span>
                                    )}
                                  </TableCell>
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
                                    <div className="flex items-center gap-1">
                                      <Button size="sm" variant="ghost" title="Generar PDF detalle de pago"
                                        onClick={() => generarPDFDetallePago('template', row.proveedor, tsGrupo[0]?.egreso?.cuit_quien_cobra || '', mapTemplatesAItems(tsGrupo))}
                                      >📄</Button>
                                      <Button size="sm" variant="ghost" title="Encolar mail de detalle al proveedor"
                                        onClick={() => encolarMailDetalle('template', row.proveedor, tsGrupo[0]?.egreso?.cuit_quien_cobra || '', mapTemplatesAItems(tsGrupo))}
                                      >✉</Button>
                                    </div>
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
                                  <TableCell className="min-w-[110px]">
                                    {editandoFechaPagosId === t.id ? (
                                      <Input
                                        type="date"
                                        value={editandoFechaPagosVal}
                                        onChange={e => setEditandoFechaPagosVal(e.target.value)}
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter' && editandoFechaPagosVal) {
                                            await supabase.from('cuotas_egresos_sin_factura')
                                              .update({ fecha_estimada: editandoFechaPagosVal, fecha_pago: editandoFechaPagosVal })
                                              .eq('id', t.id)
                                            setTemplatesPagos(prev => prev.map(x => x.id === t.id ? { ...x, fecha_estimada: editandoFechaPagosVal, fecha_pago: editandoFechaPagosVal } : x))
                                            setEditandoFechaPagosId(null)
                                          }
                                          if (e.key === 'Escape') setEditandoFechaPagosId(null)
                                        }}
                                        onBlur={async () => {
                                          if (editandoFechaPagosVal) {
                                            await supabase.from('cuotas_egresos_sin_factura')
                                              .update({ fecha_estimada: editandoFechaPagosVal, fecha_pago: editandoFechaPagosVal })
                                              .eq('id', t.id)
                                            setTemplatesPagos(prev => prev.map(x => x.id === t.id ? { ...x, fecha_estimada: editandoFechaPagosVal, fecha_pago: editandoFechaPagosVal } : x))
                                          }
                                          setEditandoFechaPagosId(null)
                                        }}
                                        className="h-7 text-xs w-[120px]"
                                        autoFocus
                                      />
                                    ) : (
                                      <span
                                        className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs"
                                        title="Click para cambiar fecha de pago"
                                        onClick={() => {
                                          setEditandoFechaPagosId(t.id)
                                          setEditandoFechaPagosVal(t.fecha_pago || t.fecha_estimada || '')
                                        }}
                                      >
                                        {t.fecha_pago || t.fecha_estimada || '-'}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="max-w-[150px] truncate">{t.egreso?.nombre_referencia || t.descripcion || '-'}</TableCell>
                                  <TableCell className="max-w-[150px] truncate">{t.egreso?.nombre_quien_cobra || '-'}</TableCell>
                                  <TableCell className="max-w-[100px] truncate">{t.egreso?.categ || '-'}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    ${(t.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  {estadoActual !== 'pendiente' && (
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        <Button size="sm" variant="ghost" title="Generar PDF detalle de pago"
                                          onClick={() => generarPDFDetallePago('template', t.egreso?.nombre_quien_cobra || '-', t.egreso?.cuit_quien_cobra || '', mapTemplatesAItems([t as unknown as Record<string, unknown>]))}
                                        >📄</Button>
                                        <Button size="sm" variant="ghost" title="Encolar mail de detalle al proveedor"
                                          onClick={() => encolarMailDetalle('template', t.egreso?.nombre_quien_cobra || '-', t.egreso?.cuit_quien_cobra || '', mapTemplatesAItems([t as unknown as Record<string, unknown>]))}
                                        >✉</Button>
                                        {onRevertir && (
                                          <Button
                                            size="sm" variant="ghost"
                                            title="Volver a Pendiente"
                                            className="text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                                            onClick={() => onRevertir(t)}
                                          >↩</Button>
                                        )}
                                      </div>
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
              if (filtroSoloNCPagos) return false  // "Solo NC" oculta templates
              if (!filtroBusquedaPagos.trim()) return true
              const q = normalizarBusqueda(filtroBusquedaPagos)
              return [
                t.egreso?.nombre_referencia,
                t.descripcion,
                t.egreso?.nombre_quien_cobra,
                t.egreso?.categ,
                t.egreso?.centro_costo,
                String(t.monto ?? ''),
                t.fecha_vencimiento,
                t.fecha_estimada,
              ].some(v => v && normalizarBusqueda(String(v)).includes(q))
            }

            // Búsqueda para anticipos
            const matchAnticipo = (a: any) => {
              if (filtroSoloNCPagos) return false  // "Solo NC" oculta anticipos
              if (!filtroBusquedaPagos.trim()) return true
              const q = normalizarBusqueda(filtroBusquedaPagos)
              return [
                a.descripcion,
                a.nombre_proveedor,
                a.cuit_proveedor,
                String(a.monto ?? ''),
                a.fecha_pago,
              ].some(v => v && normalizarBusqueda(String(v)).includes(q))
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
            const anticiposEcheq = anticiposPagos.filter(a => a.estado_pago === 'echeq' && matchAnticipo(a))
            const montoNetoAnticipo = (a: any) => (a.monto || 0) - (a.monto_sicore || 0)
            const subtotalAnticiposPagar = anticiposPagar.reduce((s, a) => s + montoNetoAnticipo(a), 0)
            const subtotalAnticiposPreparado = anticiposPreparado.reduce((s, a) => s + montoNetoAnticipo(a), 0)
            const subtotalAnticiposPendiente = anticiposPendiente.reduce((s, a) => s + montoNetoAnticipo(a), 0)

            const renderTablaAnticipos = (lista: any[], titulo: string, subtotal: number, mostrarCheckbox: boolean = true, accionBoton?: { label: string, estado: string }, accionSecundaria?: { label: string, estado: string }, onRevertir?: (a: any) => void) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Badge variant="outline" className="bg-purple-50 text-purple-700">Anticipo</Badge>
                    {titulo} ({lista.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    {accionBoton && anticiposSeleccionadosPagos.size > 0 && lista.some(a => anticiposSeleccionadosPagos.has(a.id)) && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => cambiarEstadoAnticiposSeleccionados(accionBoton.estado)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {accionBoton.label} ({Array.from(anticiposSeleccionadosPagos).filter(id => lista.some(a => a.id === id)).length})
                        </Button>
                        {accionBoton.estado !== 'pagado' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEcheqForm({ banco: '', numero: '', fechaEmision: hoyArgentina(), fechaCobro: '' })
                              setEcheqEstadoDestino('pagar') // Siempre 'pagar' para activar flujo SICORE → echeq
                              setEcheqOrigen('anticipos')
                              setMostrarModalEcheq(true)
                            }}
                            className="border-amber-500 text-amber-700 hover:bg-amber-50"
                            title="Pagar con ECHEQ"
                          >
                            📝 ECHEQ ({Array.from(anticiposSeleccionadosPagos).filter(id => lista.some(a => a.id === id)).length})
                          </Button>
                        )}
                      </>
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
                    {!esContable && anticiposSeleccionadosPagos.size > 0 && lista.some(a => anticiposSeleccionadosPagos.has(a.id)) && (() => {
                      const sel = lista.filter(a => anticiposSeleccionadosPagos.has(a.id))
                      const todasVisibles = sel.every(a => a.visible_contable === true)
                      return (
                        <Button size="sm" variant="outline" className="border-cyan-500 text-cyan-700 hover:bg-cyan-50"
                          onClick={() => toggleVisibleContable('anticipos', sel.map(a => a.id))}
                          title="Hacer visible/oculto para Ulises (rol contable)">
                          {todasVisibles ? '🚫 Ocultar Ulises' : '👁 Visible Ulises'} ({sel.length})
                        </Button>
                      )
                    })()}
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
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => eliminarAnticipo(a)}
                                  className="text-gray-300 hover:text-red-500 transition-colors"
                                  title="Eliminar anticipo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                {onRevertir && (
                                  <Button
                                    size="sm" variant="ghost"
                                    title="Volver a Pendiente"
                                    className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 h-6 w-6 p-0"
                                    onClick={() => onRevertir(a)}
                                  >↩</Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )

            // Sueldos subtotals
            const subtotalSueldosPagar = sueldosPagar.reduce((s, p) => s + (p.monto || 0), 0)
            const subtotalSueldosPreparado = sueldosPreparado.reduce((s, p) => s + (p.monto || 0), 0)
            const subtotalSueldosPendiente = sueldosPendiente.reduce((s, p) => s + (p.monto || 0), 0)

            const renderTablaSueldos = (lista: any[], titulo: string, subtotal: number, mostrarCheckbox: boolean = true, accionBoton?: { label: string, estado: string }, accionSecundaria?: { label: string, estado: string }) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">Sueldo</Badge>
                    {titulo} ({lista.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    {accionBoton && sueldosSeleccionadosPagos.size > 0 && lista.some(s => sueldosSeleccionadosPagos.has(s.id)) && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          const ids = Array.from(sueldosSeleccionadosPagos).filter(id => lista.some(s => s.id === id))
                          await supabase.from('sueldos_pagos').update({ estado: accionBoton.estado }).in('id', ids)
                          setSueldosPagos(prev => prev.map(s => ids.includes(s.id) ? { ...s, estado: accionBoton.estado } : s))
                          setSueldosSeleccionadosPagos(new Set())
                        }}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {accionBoton.label} ({Array.from(sueldosSeleccionadosPagos).filter(id => lista.some(s => s.id === id)).length})
                      </Button>
                    )}
                    {accionSecundaria && sueldosSeleccionadosPagos.size > 0 && lista.some(s => sueldosSeleccionadosPagos.has(s.id)) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const ids = Array.from(sueldosSeleccionadosPagos).filter(id => lista.some(s => s.id === id))
                          await supabase.from('sueldos_pagos').update({ estado: accionSecundaria.estado }).in('id', ids)
                          setSueldosPagos(prev => prev.map(s => ids.includes(s.id) ? { ...s, estado: accionSecundaria.estado } : s))
                          setSueldosSeleccionadosPagos(new Set())
                        }}
                        className="border-green-500 text-green-700 hover:bg-green-50"
                      >
                        {accionSecundaria.label} ({Array.from(sueldosSeleccionadosPagos).filter(id => lista.some(s => s.id === id)).length})
                      </Button>
                    )}
                    {!esContable && sueldosSeleccionadosPagos.size > 0 && lista.some(s => sueldosSeleccionadosPagos.has(s.id)) && (() => {
                      const sel = lista.filter(s => sueldosSeleccionadosPagos.has(s.id))
                      const todasVisibles = sel.every(s => s.visible_contable === true)
                      return (
                        <Button size="sm" variant="outline" className="border-cyan-500 text-cyan-700 hover:bg-cyan-50"
                          onClick={() => toggleVisibleContable('sueldos', sel.map(s => s.id))}
                          title="Hacer visible/oculto para Ulises (rol contable)">
                          {todasVisibles ? '🚫 Ocultar Ulises' : '👁 Visible Ulises'} ({sel.length})
                        </Button>
                      )
                    })()}
                    {puedeAgruparSueldos && lista.some(s => sueldosSeleccionadosPagos.has(s.id)) && (
                      <Button size="sm" variant="outline" onClick={agruparSueldos} className="border-blue-500 text-blue-700 hover:bg-blue-50" title="Agrupar en un solo pago">
                        🔗 Agrupar ({seleccionadasSueldosActivas.length})
                      </Button>
                    )}
                    {puedeDesagruparSueldos && (
                      <Button size="sm" variant="outline" onClick={desagruparSueldos} className="border-orange-500 text-orange-700 hover:bg-orange-50" title="Desagrupar">
                        ✂️ Desagrupar
                      </Button>
                    )}
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      Subtotal: ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                </div>
                {lista.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-2">No hay sueldos en este estado</p>
                ) : (
                  <div className="border rounded-md max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-white border-b">
                        <TableRow>
                          {mostrarCheckbox && <TableHead className="w-10"></TableHead>}
                          <TableHead>Fecha</TableHead>
                          <TableHead>Empleado</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead>Grupo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lista.map(s => (
                          <TableRow key={s.id} className={`hover:bg-muted/50 ${s.grupo_pago_id ? 'bg-blue-50/50' : ''}`}>
                            {mostrarCheckbox && (
                              <TableCell>
                                <Checkbox
                                  checked={sueldosSeleccionadosPagos.has(s.id)}
                                  onCheckedChange={(checked) => {
                                    setSueldosSeleccionadosPagos(prev => {
                                      const next = new Set(prev)
                                      if (checked) next.add(s.id)
                                      else next.delete(s.id)
                                      return next
                                    })
                                  }}
                                />
                              </TableCell>
                            )}
                            <TableCell>{s.fecha ? new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</TableCell>
                            <TableCell className="max-w-[150px] truncate font-medium">{s.empleado?.nombre || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={s.tipo === 'sueldo' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}>
                                {s.tipo === 'sueldo' ? 'Pago Saldo' : 'Anticipo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">{s.descripcion || '-'}</TableCell>
                            <TableCell className="text-right font-medium">
                              ${(s.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {s.grupo_pago_id ? <span className="text-blue-600 text-xs">🔗 Agrupado</span> : <span className="text-gray-400">—</span>}
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
                    {/* ── PREPARADO ─────────────────────────────────────────── */}
                    {filtrosPagos.preparado && (() => {
                      const tieneVisible = (filtroOrigenPagos.anticipo && anticiposPreparado.length > 0) ||
                        (filtroOrigenPagos.arca && facturasPreparado.length > 0) ||
                        (filtroOrigenPagos.template && templatesPreparado.length > 0) ||
                        (filtroOrigenPagos.sueldo && sueldosPreparado.length > 0)
                      const totalVisible =
                        (filtroOrigenPagos.anticipo ? subtotalAnticiposPreparado : 0) +
                        (filtroOrigenPagos.arca ? subtotalPreparado : 0) +
                        (filtroOrigenPagos.template ? subtotalTemplatesPreparado : 0) +
                        (filtroOrigenPagos.sueldo ? subtotalSueldosPreparado : 0)
                      const ocultos: { label: string; total: number }[] = [
                        ...(!filtroOrigenPagos.anticipo && anticiposPreparado.length > 0 ? [{ label: 'Anticipos', total: subtotalAnticiposPreparado }] : []),
                        ...(!filtroOrigenPagos.arca && facturasPreparado.length > 0 ? [{ label: 'ARCA', total: subtotalPreparado }] : []),
                        ...(!filtroOrigenPagos.template && templatesPreparado.length > 0 ? [{ label: 'Templates', total: subtotalTemplatesPreparado }] : []),
                        ...(!filtroOrigenPagos.sueldo && sueldosPreparado.length > 0 ? [{ label: 'Sueldos', total: subtotalSueldosPreparado }] : []),
                      ]
                      if (!tieneVisible) {
                        return (
                          <div className="py-2 px-3 text-sm text-muted-foreground border rounded-md bg-muted/30 flex items-center gap-3">
                            <span>✅ No hay pagos preparados</span>
                            {ocultos.length > 0 && (
                              <span className="text-yellow-600 text-xs">
                                ⚠️ ${ocultos.reduce((s, o) => s + o.total, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} en {ocultos.map(o => o.label).join(', ')} ocultos por filtro
                              </span>
                            )}
                          </div>
                        )
                      }
                      return (
                        <>
                          <div className="flex items-center justify-between px-1 py-1 border-b mb-1">
                            <span className="font-semibold text-sm">✅ PREPARADO</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <Badge variant="outline" className="text-sm px-3 py-1">
                                Total Preparado: ${totalVisible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </Badge>
                              {ocultos.map(o => (
                                <span key={o.label} className="text-xs text-yellow-600">
                                  ⚠️ ${o.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })} en {o.label} ocultos por filtro
                                </span>
                              ))}
                            </div>
                          </div>
                          {filtroOrigenPagos.anticipo && anticiposPreparado.length > 0 && renderTablaAnticipos(
                            anticiposPreparado,
                            '✅ Preparado',
                            subtotalAnticiposPreparado,
                            true,
                            { label: 'Marcar como Programado', estado: 'programado' },
                            { label: 'Marcar como Pagado', estado: 'pagado' }
                          )}
                          {filtroOrigenPagos.arca && facturasPreparado.length > 0 && renderTablaFacturas(
                            facturasPreparado,
                            '✅ ARCA Preparado',
                            subtotalPreparado,
                            'preparado',
                            true,
                            { label: 'Marcar como Programado', estado: 'programado' },
                            { label: 'Marcar como Pagado', estado: 'pagado' }
                          )}
                          {filtroOrigenPagos.template && templatesPreparado.length > 0 && renderTablaTemplates(
                            templatesPreparado,
                            '✅ Preparado',
                            subtotalTemplatesPreparado,
                            true,
                            { label: 'Marcar como Programado', estado: 'programado' },
                            { label: 'Marcar como Pagado', estado: 'pagado' },
                            'preparado'
                          )}
                          {filtroOrigenPagos.sueldo && sueldosPreparado.length > 0 && renderTablaSueldos(
                            sueldosPreparado,
                            '✅ Preparado',
                            subtotalSueldosPreparado,
                            true,
                            { label: 'Marcar como Pagado', estado: 'conciliado' }
                          )}
                        </>
                      )
                    })()}

                    {/* ── PAGAR ─────────────────────────────────────────────── */}
                    {filtrosPagos.pagar && (() => {
                      const tieneVisible = (filtroOrigenPagos.anticipo && anticiposPagar.length > 0) ||
                        (filtroOrigenPagos.arca && facturasPagar.length > 0) ||
                        (filtroOrigenPagos.template && templatesPagar.length > 0) ||
                        (filtroOrigenPagos.sueldo && sueldosPagar.length > 0)
                      const totalVisible =
                        (filtroOrigenPagos.anticipo ? subtotalAnticiposPagar : 0) +
                        (filtroOrigenPagos.arca ? subtotalPagar : 0) +
                        (filtroOrigenPagos.template ? subtotalTemplatesPagar : 0) +
                        (filtroOrigenPagos.sueldo ? subtotalSueldosPagar : 0)
                      const ocultos: { label: string; total: number }[] = [
                        ...(!filtroOrigenPagos.anticipo && anticiposPagar.length > 0 ? [{ label: 'Anticipos', total: subtotalAnticiposPagar }] : []),
                        ...(!filtroOrigenPagos.arca && facturasPagar.length > 0 ? [{ label: 'ARCA', total: subtotalPagar }] : []),
                        ...(!filtroOrigenPagos.template && templatesPagar.length > 0 ? [{ label: 'Templates', total: subtotalTemplatesPagar }] : []),
                        ...(!filtroOrigenPagos.sueldo && sueldosPagar.length > 0 ? [{ label: 'Sueldos', total: subtotalSueldosPagar }] : []),
                      ]
                      if (!tieneVisible) {
                        return (
                          <div className="py-2 px-3 text-sm text-muted-foreground border rounded-md bg-muted/30 flex items-center gap-3">
                            <span>📋 No hay pagos para pagar</span>
                            {ocultos.length > 0 && (
                              <span className="text-yellow-600 text-xs">
                                ⚠️ ${ocultos.reduce((s, o) => s + o.total, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} en {ocultos.map(o => o.label).join(', ')} ocultos por filtro
                              </span>
                            )}
                          </div>
                        )
                      }
                      return (
                        <>
                          <div className="flex items-center justify-between px-1 py-1 border-b mb-1">
                            <span className="font-semibold text-sm">📋 PAGAR</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <Badge variant="outline" className="text-sm px-3 py-1">
                                Total Pagar: ${totalVisible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </Badge>
                              {ocultos.map(o => (
                                <span key={o.label} className="text-xs text-yellow-600">
                                  ⚠️ ${o.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })} en {o.label} ocultos por filtro
                                </span>
                              ))}
                            </div>
                          </div>
                          {filtroOrigenPagos.anticipo && anticiposPagar.length > 0 && renderTablaAnticipos(
                            anticiposPagar,
                            '📋 Pagar',
                            subtotalAnticiposPagar,
                            true,
                            { label: 'Marcar como Preparado', estado: 'preparado' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'pagado' } : undefined,
                            (a) => resetearAnticipo(a)
                          )}
                          {filtroOrigenPagos.arca && facturasPagar.length > 0 && renderTablaFacturas(
                            facturasPagar,
                            '📋 ARCA Pagar',
                            subtotalPagar,
                            'pagar',
                            true,
                            { label: 'Marcar como Preparado', estado: 'preparado' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'pagado' } : undefined,
                            (f) => revertirFacturaAPendiente(f)
                          )}
                          {filtroOrigenPagos.template && templatesPagar.length > 0 && renderTablaTemplates(
                            templatesPagar,
                            '📋 Pagar',
                            subtotalTemplatesPagar,
                            true,
                            { label: 'Marcar como Preparado', estado: 'preparado' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'pagado' } : undefined,
                            'pagar',
                            (t) => revertirTemplateAPendiente(t)
                          )}
                          {filtroOrigenPagos.sueldo && sueldosPagar.length > 0 && renderTablaSueldos(
                            sueldosPagar,
                            '📋 Pagar',
                            subtotalSueldosPagar,
                            true,
                            { label: 'Marcar como Preparado', estado: 'preparado' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'conciliado' } : undefined
                          )}
                        </>
                      )
                    })()}

                    {/* ECHEQs emitidos — siempre visibles si existen */}
                    {(anticiposEcheq.length > 0 || facturasEcheq.length > 0) && (
                      <>
                        {filtroOrigenPagos.anticipo && anticiposEcheq.length > 0 && renderTablaAnticipos(
                          anticiposEcheq,
                          '📝 ECHEQ Emitidos',
                          anticiposEcheq.reduce((s, a) => s + montoNetoAnticipo(a), 0),
                          true,
                          { label: '✅ Marcar Pagado', estado: 'pagado' }
                        )}
                        {filtroOrigenPagos.arca && facturasEcheq.length > 0 && renderTablaFacturas(
                          facturasEcheq,
                          '📝 ARCA ECHEQ Emitidos',
                          facturasEcheq.reduce((s, f) => s + montoEnPesos(f), 0),
                          'echeq',
                          true,
                          { label: '✅ Marcar Pagado', estado: 'pagado' }
                        )}
                      </>
                    )}

                    {/* ── PENDIENTE ─────────────────────────────────────────── */}
                    {filtrosPagos.pendiente && (() => {
                      const tieneVisible = (filtroOrigenPagos.anticipo && anticiposPendiente.length > 0) ||
                        (filtroOrigenPagos.arca && facturasPendiente.length > 0) ||
                        (filtroOrigenPagos.template && templatesPendiente.length > 0) ||
                        (filtroOrigenPagos.sueldo && sueldosPendiente.length > 0)
                      const totalVisible =
                        (filtroOrigenPagos.anticipo ? subtotalAnticiposPendiente : 0) +
                        (filtroOrigenPagos.arca ? subtotalPendiente : 0) +
                        (filtroOrigenPagos.template ? subtotalTemplatesPendiente : 0) +
                        (filtroOrigenPagos.sueldo ? subtotalSueldosPendiente : 0)
                      const ocultos: { label: string; total: number }[] = [
                        ...(!filtroOrigenPagos.anticipo && anticiposPendiente.length > 0 ? [{ label: 'Anticipos', total: subtotalAnticiposPendiente }] : []),
                        ...(!filtroOrigenPagos.arca && facturasPendiente.length > 0 ? [{ label: 'ARCA', total: subtotalPendiente }] : []),
                        ...(!filtroOrigenPagos.template && templatesPendiente.length > 0 ? [{ label: 'Templates', total: subtotalTemplatesPendiente }] : []),
                        ...(!filtroOrigenPagos.sueldo && sueldosPendiente.length > 0 ? [{ label: 'Sueldos', total: subtotalSueldosPendiente }] : []),
                      ]
                      if (!tieneVisible) {
                        return (
                          <div className="py-2 px-3 text-sm text-muted-foreground border rounded-md bg-muted/30 flex items-center gap-3">
                            <span>⏳ No hay pagos pendientes</span>
                            {ocultos.length > 0 && (
                              <span className="text-yellow-600 text-xs">
                                ⚠️ ${ocultos.reduce((s, o) => s + o.total, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} en {ocultos.map(o => o.label).join(', ')} ocultos por filtro
                              </span>
                            )}
                          </div>
                        )
                      }
                      return (
                        <>
                          <div className="flex items-center justify-between px-1 py-1 border-b mb-1">
                            <span className="font-semibold text-sm">⏳ PENDIENTE</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <Badge variant="outline" className="text-sm px-3 py-1">
                                Total Pendiente: ${totalVisible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </Badge>
                              {ocultos.map(o => (
                                <span key={o.label} className="text-xs text-yellow-600">
                                  ⚠️ ${o.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })} en {o.label} ocultos por filtro
                                </span>
                              ))}
                            </div>
                          </div>
                          {filtroOrigenPagos.anticipo && anticiposPendiente.length > 0 && renderTablaAnticipos(
                            anticiposPendiente,
                            '⏳ Pendiente',
                            subtotalAnticiposPendiente,
                            true,
                            { label: 'Marcar como Pagar', estado: 'pagar' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'pagado' } : undefined
                          )}
                          {filtroOrigenPagos.arca && facturasPendiente.length > 0 && renderTablaFacturas(
                            facturasPendiente,
                            '⏳ ARCA Pendiente',
                            subtotalPendiente,
                            'pendiente',
                            true,
                            { label: 'Marcar como Pagar', estado: 'pagar' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'pagado' } : undefined
                          )}
                          {filtroOrigenPagos.template && templatesPendiente.length > 0 && renderTablaTemplates(
                            templatesPendiente,
                            '⏳ Pendiente',
                            subtotalTemplatesPendiente,
                            true,
                            { label: 'Marcar como Pagar', estado: 'pagar' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'pagado' } : undefined,
                            'pendiente'
                          )}
                          {filtroOrigenPagos.sueldo && sueldosPendiente.length > 0 && renderTablaSueldos(
                            sueldosPendiente,
                            '⏳ Pendiente',
                            subtotalSueldosPendiente,
                            true,
                            { label: 'Marcar como Pagar', estado: 'pagar' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'conciliado' } : undefined
                          )}
                        </>
                      )
                    })()}
                  </>
                ) : (
                  // ULISES (contable): Pagar > Preparado, cada estado muestra Anticipo + ARCA + Template + Sueldos
                  <>
                    {/* ── PAGAR ─────────────────────────────────────────────── */}
                    {(() => {
                      const tieneVisible = (filtroOrigenPagos.anticipo && anticiposPagar.length > 0) ||
                        (filtroOrigenPagos.arca && facturasPagar.length > 0) ||
                        (filtroOrigenPagos.template && templatesPagar.length > 0) ||
                        (filtroOrigenPagos.sueldo && sueldosPagar.length > 0)
                      const totalVisible =
                        (filtroOrigenPagos.anticipo ? subtotalAnticiposPagar : 0) +
                        (filtroOrigenPagos.arca ? subtotalPagar : 0) +
                        (filtroOrigenPagos.template ? subtotalTemplatesPagar : 0) +
                        (filtroOrigenPagos.sueldo ? subtotalSueldosPagar : 0)
                      const ocultos: { label: string; total: number }[] = [
                        ...(!filtroOrigenPagos.anticipo && anticiposPagar.length > 0 ? [{ label: 'Anticipos', total: subtotalAnticiposPagar }] : []),
                        ...(!filtroOrigenPagos.arca && facturasPagar.length > 0 ? [{ label: 'ARCA', total: subtotalPagar }] : []),
                        ...(!filtroOrigenPagos.template && templatesPagar.length > 0 ? [{ label: 'Templates', total: subtotalTemplatesPagar }] : []),
                        ...(!filtroOrigenPagos.sueldo && sueldosPagar.length > 0 ? [{ label: 'Sueldos', total: subtotalSueldosPagar }] : []),
                      ]
                      if (!tieneVisible) {
                        return (
                          <div className="py-2 px-3 text-sm text-muted-foreground border rounded-md bg-muted/30 flex items-center gap-3">
                            <span>📋 No hay pagos para pagar</span>
                            {ocultos.length > 0 && (
                              <span className="text-yellow-600 text-xs">
                                ⚠️ ${ocultos.reduce((s, o) => s + o.total, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} en {ocultos.map(o => o.label).join(', ')} ocultos por filtro
                              </span>
                            )}
                          </div>
                        )
                      }
                      return (
                        <>
                          <div className="flex items-center justify-between px-1 py-1 border-b mb-1">
                            <span className="font-semibold text-sm">📋 PAGAR</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <Badge variant="outline" className="text-sm px-3 py-1">
                                Total Pagar: ${totalVisible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </Badge>
                              {ocultos.map(o => (
                                <span key={o.label} className="text-xs text-yellow-600">
                                  ⚠️ ${o.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })} en {o.label} ocultos por filtro
                                </span>
                              ))}
                            </div>
                          </div>
                          {filtroOrigenPagos.anticipo && anticiposPagar.length > 0 && renderTablaAnticipos(
                            anticiposPagar,
                            '📋 Pagar',
                            subtotalAnticiposPagar,
                            false
                          )}
                          {filtroOrigenPagos.arca && facturasPagar.length > 0 && renderTablaFacturas(
                            facturasPagar,
                            '📋 ARCA Por Pagar',
                            subtotalPagar,
                            'pagar',
                            true,
                            { label: 'Marcar como Preparado', estado: 'preparado' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'pagado' } : undefined
                          )}
                          {filtroOrigenPagos.template && templatesPagar.length > 0 && renderTablaTemplates(
                            templatesPagar,
                            '📋 Por Pagar',
                            subtotalTemplatesPagar,
                            true,
                            { label: 'Marcar como Preparado', estado: 'preparado' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'pagado' } : undefined,
                            'pagar'
                          )}
                          {filtroOrigenPagos.sueldo && sueldosPagar.length > 0 && renderTablaSueldos(
                            sueldosPagar,
                            '📋 Pagar',
                            subtotalSueldosPagar,
                            true,
                            { label: 'Marcar como Preparado', estado: 'preparado' },
                            !esContable ? { label: '✅ Marcar como Pagado', estado: 'conciliado' } : undefined
                          )}
                        </>
                      )
                    })()}

                    {/* ── PREPARADO ─────────────────────────────────────────── */}
                    {(() => {
                      const tieneVisible = (filtroOrigenPagos.anticipo && anticiposPreparado.length > 0) ||
                        (filtroOrigenPagos.arca && facturasPreparado.length > 0) ||
                        (filtroOrigenPagos.template && templatesPreparado.length > 0) ||
                        (filtroOrigenPagos.sueldo && sueldosPreparado.length > 0)
                      const totalVisible =
                        (filtroOrigenPagos.anticipo ? subtotalAnticiposPreparado : 0) +
                        (filtroOrigenPagos.arca ? subtotalPreparado : 0) +
                        (filtroOrigenPagos.template ? subtotalTemplatesPreparado : 0) +
                        (filtroOrigenPagos.sueldo ? subtotalSueldosPreparado : 0)
                      const ocultos: { label: string; total: number }[] = [
                        ...(!filtroOrigenPagos.anticipo && anticiposPreparado.length > 0 ? [{ label: 'Anticipos', total: subtotalAnticiposPreparado }] : []),
                        ...(!filtroOrigenPagos.arca && facturasPreparado.length > 0 ? [{ label: 'ARCA', total: subtotalPreparado }] : []),
                        ...(!filtroOrigenPagos.template && templatesPreparado.length > 0 ? [{ label: 'Templates', total: subtotalTemplatesPreparado }] : []),
                        ...(!filtroOrigenPagos.sueldo && sueldosPreparado.length > 0 ? [{ label: 'Sueldos', total: subtotalSueldosPreparado }] : []),
                      ]
                      if (!tieneVisible) {
                        return (
                          <div className="py-2 px-3 text-sm text-muted-foreground border rounded-md bg-muted/30 flex items-center gap-3">
                            <span>✅ No hay pagos preparados</span>
                            {ocultos.length > 0 && (
                              <span className="text-yellow-600 text-xs">
                                ⚠️ ${ocultos.reduce((s, o) => s + o.total, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} en {ocultos.map(o => o.label).join(', ')} ocultos por filtro
                              </span>
                            )}
                          </div>
                        )
                      }
                      return (
                        <>
                          <div className="flex items-center justify-between px-1 py-1 border-b mb-1">
                            <span className="font-semibold text-sm">✅ PREPARADO</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <Badge variant="outline" className="text-sm px-3 py-1">
                                Total Preparado: ${totalVisible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </Badge>
                              {ocultos.map(o => (
                                <span key={o.label} className="text-xs text-yellow-600">
                                  ⚠️ ${o.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })} en {o.label} ocultos por filtro
                                </span>
                              ))}
                            </div>
                          </div>
                          {filtroOrigenPagos.anticipo && anticiposPreparado.length > 0 && renderTablaAnticipos(
                            anticiposPreparado,
                            '✅ Preparado',
                            subtotalAnticiposPreparado,
                            false
                          )}
                          {filtroOrigenPagos.arca && facturasPreparado.length > 0 && renderTablaFacturas(
                            facturasPreparado,
                            '✅ ARCA Preparado',
                            subtotalPreparado,
                            'preparado',
                            false
                          )}
                          {filtroOrigenPagos.template && templatesPreparado.length > 0 && renderTablaTemplates(
                            templatesPreparado,
                            '✅ Preparado',
                            subtotalTemplatesPreparado,
                            false,
                            undefined,
                            undefined,
                            'preparado'
                          )}
                          {filtroOrigenPagos.sueldo && sueldosPreparado.length > 0 && renderTablaSueldos(
                            sueldosPreparado,
                            '✅ Preparado',
                            subtotalSueldosPreparado,
                            false
                          )}
                        </>
                      )
                    })()}
                  </>
                )}

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

      {/* Modal Reglas de Importación */}
      <ModalReglasImport open={mostrarReglasImport} onClose={() => setMostrarReglasImport(false)} />

      {/* 📄➡️🧾 Cargar un PDF sin vincular como factura No Informada (A-FEAT-1318) */}
      <ModalCargarDesdePdf
        archivo={cargarPdf}
        empresa={empresa as 'MSA' | 'PAM' | 'MA'}
        onClose={() => setCargarPdf(null)}
        onCargada={async () => {
          const url = cargarPdf?.url
          setCargarPdf(null)
          if (url) setHuerfanosSupervision(prev => prev.filter(x => x.url !== url))
          if (periodoConsulta) await cargarFacturasPeriodo(periodoConsulta)
        }}
      />

      {/* Modal Cancelación FC/NC — mudado a su propio componente (A-FEAT-1232) */}
      {modalCancelacionNC && (
        <ModalCancelacionNC
          inicial={modalCancelacionNC as unknown as DatosCancelacionNC}
          schemaName={schemaName}
          onCerrar={() => setModalCancelacionNC(null)}
          onAplicado={(ids) => {
            const todosIdsAfectados = new Set([...ids, ...Array.from(modalCancelacionNC.seleccionadas)])
            setFacturasPagos(prev => prev.map(f =>
              todosIdsAfectados.has(f.id) ? { ...f, estado: 'conciliado', monto_a_abonar: 0 } : f
            ))
            setFacturasSeleccionadasPagos(new Set())
            setModalCancelacionNC(null)
            cargarFacturas()
          }}
        />
      )}

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
                if (echeqOrigen === 'anticipos') {
                  cambiarEstadoAnticiposRef.current?.(echeqEstadoDestino, datos.fechaEmision)
                } else {
                  cambiarEstadoSeleccionadasRef.current?.(echeqEstadoDestino, datos.fechaEmision)
                }
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
              <div data-ayuda className="bg-gray-50 rounded p-2 text-xs text-gray-500">
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
                <Button variant="outline" onClick={async () => {
                  if (anticipoSicoreEnProceso) {
                    const esEcheq = !!echeqPendienteRef.current
                    const updateData: any = { estado_pago: esEcheq ? 'echeq' : 'pagar' }
                    if (esEcheq) {
                      updateData.metodo_pago = 'echeq'
                      updateData.fecha_cobro_echeq = echeqPendienteRef.current!.fechaCobro
                      updateData.fecha_pago = echeqPendienteRef.current!.fechaEmision
                      await guardarCheques([], echeqPendienteRef.current!, null, anticipoSicoreEnProceso.id, anticipoSicoreEnProceso)
                      echeqPendienteRef.current = null
                    }
                    supabase.from('anticipos_proveedores').update(updateData).eq('id', anticipoSicoreEnProceso.id)
                      .then(({ error }) => {
                        if (!error) { toast.success(esEcheq ? 'Anticipo → ECHEQ emitido (sin SICORE)' : 'Anticipo → pagar (sin SICORE)'); recargarAnticiposPagos() }
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
                    <span className="text-xs text-gray-500">{(tipo.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}% · mín ${tipo.minimo_no_imponible.toLocaleString('es-AR')}</span>
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
                  <span>{tipoSicoreAnt.tipo} {(tipoSicoreAnt.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}%:</span>
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

      {/* Notificación flotante de progreso de búsqueda PDF */}
      <NotificacionProgresoLote
        progreso={progresoPdf}
        onCerrar={() => setProgresoPdf(null)}
        onCancelar={() => { cancelarPdfRef.current = true }}
        onVerInforme={() => setVerInformeLote(true)}
        onVerDetalle={(loteId) => {
          setProgresoPdf(null)
          setModalHistorialPdf({ open: true, loteId })
        }}
      />

      {/* 📋 Informe por factura del último lote (A-FEAT-1287) */}
      <InformeLote open={verInformeLote} informe={progresoPdf?.informe || []} onClose={() => setVerInformeLote(false)}
        onConfirmar={(it, url) => confirmarConLink({ id: it.factura_id }, url, `¿Confirmás que el archivo es el de ${it.proveedor || 'esta factura'} ${it.factura}? Pasa de APP a Confirmada.`)}
        datosDe={(id) => { const f = facturas.find(x => x.id === id) ?? facturasPeriodo.find(x => x.id === id); return f ? { fecha_emision: f.fecha_emision, imp_total: f.imp_total } : undefined }}
        onPedirProveedor={(ids) => setPedirFacturas(ids)}
        archivosNoLeidos={progresoPdf?.archivosNoLeidos}
        onElegirCandidato={(it, url) => elegirCandidatoUrl(it.factura_id, url)}
        onDescartarCandidato={(it, url) => descartarCandidatoUrl(it.factura_id, url, 'desde el informe')}
        onReintentar={(ids) => {
          const donde = progresoPdf?.donde
          setVerInformeLote(false)
          dispararBusquedaPostImport(ids, donde)
        }} />

      {/* 📮 Pedir la factura al proveedor (A-FEAT-1313) — desde la lista de sin PDF o desde el informe */}
      <ModalPedirFacturas open={!!pedirFacturas} empresa={empresa as 'MSA' | 'PAM' | 'MA'} facturaIds={pedirFacturas || []}
        onClose={() => setPedirFacturas(null)} onHecho={() => setRecargaUltimasSinPdf(n => n + 1)} />

      {/* ✓ de VER: elegir entre los candidatos (A-FEAT-1287) */}
      <ModalElegirCandidato
        open={!!elegirCandidato}
        empresa={empresa as 'MSA' | 'PAM' | 'MA'}
        factura={elegirCandidato}
        onClose={() => setElegirCandidato(null)}
        onConfirmada={alConfirmarCandidato}
        onDescartada={(id, fcNuevo) => {
          if (fcNuevo) {
            setFacturas(prev => prev.map(x => x.id === id ? { ...x, fc: fcNuevo } : x))
            setFacturasOriginales(prev => prev.map(x => x.id === id ? { ...x, fc: fcNuevo } : x))
          }
          toast.success(fcNuevo ? `Descartado. No quedan candidatos: la factura pasó a ${fcNuevo} y se puede volver a buscar.` : 'Descartado. Quedan otros candidatos.')
        }}
      />

      {/* Modal historial búsquedas PDF */}
      <ModalHistorialPdf
        open={modalHistorialPdf.open}
        onClose={() => setModalHistorialPdf({ open: false })}
        loteId={modalHistorialPdf.loteId}
        facturaId={modalHistorialPdf.facturaId}
      />

      {/* Modal config proveedores PDF */}
      <ModalConfigProveedor
        open={modalConfigProveedorPdf.open}
        onClose={() => setModalConfigProveedorPdf({ open: false })}
        cuitInicial={modalConfigProveedorPdf.cuit}
      />

      {/* Modal auditar registro digital de un período */}
      <ModalAuditarPeriodo
        empresa={empresa as 'MSA' | 'PAM' | 'MA'}
        open={auditarPeriodoOpen}
        onClose={() => setAuditarPeriodoOpen(false)}
      />

      {/* Modal exportar lote a Excel banco Galicia */}
      <ModalExportarLote
        open={modalExportarLote.open}
        onClose={() => setModalExportarLote({ open: false, items: [] })}
        empresa={empresa as 'MSA' | 'PAM' | 'MA'}
        items={modalExportarLote.items}
        userRole={userRole}
      />

      {/* Modal Generar Export v2 — elegir si cerrar la quincena */}
      <Dialog open={mostrarModalExport} onOpenChange={setMostrarModalExport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📤 Generar Export v2 — {quincenaSeleccionadaV2}</DialogTitle>
            <DialogDescription>
              Se generarán Excel, PDF y TXT en la carpeta elegida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="bg-gray-50 rounded p-3 space-y-1">
              <p>• <b>{conteoV2?.cantidad ?? registrosV2.filter((r:any)=>!r.anulado).length}</b> retenciones</p>
              <p>• Total: <b>${(conteoV2?.totalRetencion ?? registrosV2.filter((r:any)=>!r.anulado).reduce((s:number,r:any)=>s+(Number(r.retencion)||0),0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</b></p>
            </div>
            <hr />
            <p className="font-medium">¿Querés cerrar la quincena al descargar?</p>
            <ul className="text-xs text-gray-600 list-disc ml-5 space-y-0.5">
              <li><b>Cerrar</b> = la quincena queda bloqueada — modificaciones piden confirmación y obligan a regenerar TXT.</li>
              <li><b>Sin cerrar</b> = podés seguir editando libremente.</li>
            </ul>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={async () => {
                setMostrarModalExport(false)
                if (quincenaSeleccionadaV2) await procesarCierreV2(quincenaSeleccionadaV2, { cerrar: false })
              }}
            >
              Solo descargar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={async () => {
                setMostrarModalExport(false)
                if (quincenaSeleccionadaV2) await procesarCierreV2(quincenaSeleccionadaV2, { cerrar: true })
              }}
            >
              Descargar y cerrar
            </Button>
            <Button variant="ghost" onClick={() => setMostrarModalExport(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ModalVincularCompras abierto={!!facturaVincularCompras} facturaId={facturaVincularCompras}
        onCerrar={() => setFacturaVincularCompras(null)} />
    </div>
  )
}

/**
 * ❓ «¿Qué botón uso?» — el glosario corto del archivo digital (JMS 27/10: «debe ser conciso el pop up… cada botón
 * hace una cosa y debe ser muy claro qué usar»). Una línea por botón, nada más. Es un <span> y no un <button>
 * para que se pueda abrir también en sólo lectura.
 */
function QueBotonUso() {
  const [ver, setVer] = useState(false)
  return (
    <span className="relative inline-block self-center text-[11px]">
      <span role="button" tabIndex={0} className="cursor-pointer text-blue-600 underline whitespace-nowrap"
        onClick={() => setVer(v => !v)} onKeyDown={e => { if (e.key === 'Enter') setVer(v => !v) }}>
        ¿Qué botón uso?
      </span>
      {ver && (
        <span className="absolute right-0 z-40 mt-1 block w-[380px] rounded border bg-white p-2 text-xs shadow-lg">
          <span className="block"><b>🔗 Vincular con la carpeta</b> — el de siempre: pega los PDF de la carpeta del mes a sus facturas.</span>
          <span className="block"><b>📊 Contar</b> — sólo cuenta cuántos PDF hay y cuántos están pegados. No cambia nada.</span>
          <span className="block"><b>🔁 Re-vincular todo</b> — como Vincular, pero revisa también los ya pegados.</span>
          <span className="block"><b>📧 Mandar el estado</b> — manda por mail cómo quedó el mes.</span>
        </span>
      )}
    </span>
  )
}
