"use client"

import { useState, useRef, useEffect } from "react"
import { useMultiCashFlowData, type CashFlowRow, type CashFlowFilters } from "@/hooks/useMultiCashFlowData"
import { calcularSubtotales } from "@/lib/pagos/subtotales"
import { generarPDFDetallePago } from "@/lib/pagos/pdf-detalle-pago"
import { encolarMailDetalle } from "@/lib/pagos/encolar-mail-detalle"
import { ModalExportarLote } from "@/components/lotes-galicia/modal-exportar-lote"
import { PanelMailsPago } from "@/components/panel-mails-pago"
import type { ItemSeleccionado } from "@/lib/lotes-galicia/types"
import { agruparPagos } from "@/lib/pagos/agrupar"
import { desagruparPago } from "@/lib/pagos/desagrupar"
import { resetearRetencionFactura, estadoQuincenaDeFactura, anticiposVinculadosAFactura } from "@/lib/sicore/resetear-retencion"
import { generarQuincenaSicore } from "@/lib/sicore/quincena"
import { registrarEnSicoreRetenciones } from "@/lib/sicore/registrar-retencion"
import { guardarChequeFactura, guardarChequeAnticipo, type EcheqDatos } from "@/lib/pagos/echeq"
import { obtenerMediosPagoFactura } from "@/lib/pagos/medios-pago"
import { EMPRESAS, COLOR_EMPRESA, schemaDeFila, esFilaMsa, type Empresa } from "@/lib/empresas"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Receipt, Calendar, TrendingUp, TrendingDown, DollarSign, Filter, Edit3, Save, X, Plus, Search, Link2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { normalizarBusqueda } from "@/lib/normalizar-texto"
import { toast } from "sonner"
import { ModalValidarCateg } from "./modal-validar-categ"
import { useCuentasContables } from "@/hooks/useCuentasContables"
import useInlineEditor, { type CeldaEnEdicion as CeldaEnEdicionHook } from "@/hooks/useInlineEditor"
import { CategCombobox } from "@/components/ui/categ-combobox"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { CentroCostoCombobox } from "@/components/ui/centro-costo-combobox"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
import { ModalVinculacionAnticipo } from "./modal-vinculacion-anticipo"
import { useVinculacionAnticipo, buscarFacturasCandidatas, type AnticipoVinculable } from "@/hooks/useVinculacionAnticipo"

// Definición de columnas Cash Flow (10 columnas finales + editabilidad)
const columnasDefinicion = [
  // Empresa primero, a la izquierda: el Cash Flow es de las tres y hay que ver de quién es
  // cada fila sin buscarla. Puede traer varias (`MSA/PAM`). Ver lib/empresas y A-FEAT-13.
  { key: 'empresas', label: 'Empresa', type: 'empresas', width: 'w-28', editable: false },
  { key: 'fecha_estimada', label: 'FECHA Estimada', type: 'date', width: 'w-32', editable: true },
  { key: 'fecha_vencimiento', label: 'Fecha Vencimiento', type: 'date', width: 'w-32', editable: true },
  { key: 'fecha_pago', label: 'Fecha Pago', type: 'date', width: 'w-32', editable: true },
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
/**
 * 🔑 **SICORE se calcula SIEMPRE desde `fecha_pago`. Nunca desde otra fecha.**
 *
 * Regla del usuario (2026-08-10). Antes había una cadena de respaldo
 * `fecha_pago || fecha_vencimiento || fecha_estimada || hoy` que producía en silencio una quincena
 * plausible pero equivocada — y la quincena **se presenta a ARCA**.
 *
 * Devuelve `''` cuando no hay fecha de pago. Quien la llame **no debe calcular ni registrar
 * SICORE** en ese caso: hay que pedir la fecha primero.
 */
const quincenaDePago = (fila: { fecha_pago?: string | null }): string =>
  fila.fecha_pago ? generarQuincenaSicore(fila.fecha_pago) : ''

/**
 * Comprobantes **C**: los emite un monotributista, así que **nunca llevan retención SICORE**.
 * 11 Factura C · 12 Nota de Débito C · 13 Nota de Crédito C.
 * (Hoy en la BD sólo hay tipo 11, 40 comprobantes; los otros dos se incluyen porque es la misma
 * razón — quien emite es monotributista — y así no hay que acordarse el día que aparezcan.)
 */
const TIPOS_COMPROBANTE_C = [11, 12, 13]

/**
 * ¿A esta factura se le puede retener SICORE?
 *
 * 🔑 **Una sola definición, usada por los dos caminos** — el lote y la fila individual. Antes el
 * filtro de Fac C estaba sólo en `evaluarRetencionSicoreCF`, así que por el lote pasaban igual.
 */
const admiteSicore = (f: { tipo_comprobante?: number | null }): boolean =>
  !TIPOS_COMPROBANTE_C.includes(Number(f.tipo_comprobante))

/** Estados que significan que la plata sale: exigen fecha de pago antes de seguir. */
const ESTADOS_QUE_PAGAN = ['pagar', 'preparado', 'programado', 'pagado', 'debito']

/**
 * Completa el año cuando se escribe sólo día y mes (`10/8` → `10/08/2026`) y devuelve `YYYY-MM-DD`.
 * El día y el mes los escribió el usuario; **el año se completa, no se adivina**.
 */
const fechaTipeadaAISO = (texto: string): string => {
  const t = String(texto ?? '').trim()
  if (!t) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const partes = t.split(/[\/\-.]/).filter(Boolean)
  if (partes.length < 2) return t
  const [d, m, a] = partes
  const anio = a === undefined || a === ''
    ? String(new Date().getFullYear())
    : a.length <= 2 ? `20${a.padStart(2, '0')}` : a
  return `${anio}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

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

export function VistaCashFlow({ userRole }: { userRole?: string } = {}) {
  // Empresa: DOS filtros, con defaults distintos y a propósito (A-FEAT-13).
  //  · Facturas → MA APAGADA: las paga MA de su propia cuenta y se concilian cada tanto,
  //    así que por default serían 92 filas de ruido.
  //  · Templates → las tres: son impuestos que paga el usuario siempre; no verlos es perder trabajo.
  const [empresasFacturas, setEmpresasFacturas] = useState<Empresa[]>(['MSA', 'PAM'])
  const [empresasTemplates, setEmpresasTemplates] = useState<Empresa[]>(['MSA', 'PAM', 'MA'])

  const [filtros, setFiltros] = useState<CashFlowFilters | undefined>({ empresasFacturas: ['MSA', 'PAM'], empresasTemplates: ['MSA', 'PAM', 'MA'] })
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
  const [medioPagoFiltro, setMedioPagoFiltro] = useState('banco')
  
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
  // Paso 1 del lote: confirmar la FECHA DE PAGO. Va antes de SICORE porque la quincena sale de ahí.
  const [modalFechaPago, setModalFechaPago] = useState<{ open: boolean; fecha: string }>({ open: false, fecha: '' })
  // Paso 2: qué hacer con las que califican para SICORE. Tres salidas, no dos (A-BUG-20).
  const [modalSicoreLote, setModalSicoreLote] = useState<{
    facturas: CashFlowRow[]
    actualizaciones: Array<{ id: string; origen: CashFlowRow['origen']; campo: string; valor: any }>
    sinFecha: number
  } | null>(null)
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
  const [templatesAbiertos, setTemplatesAbiertos] = useState<{id: string, nombre_referencia: string, categ: string | null, cuenta_agrupadora: string | null, es_bidireccional: boolean, es_multi_cuenta: boolean, responsable: string, solo_conciliacion: boolean}[]>([])
  const [mostrarBancarios, setMostrarBancarios] = useState(false)
  const [togglingSoloConciliacion, setTogglingSoloConciliacion] = useState<string | null>(null)
  const [templateSeleccionado, setTemplateSeleccionado] = useState<string | null>(null)
  const [pasoModal, setPasoModal] = useState<'seleccionar' | 'datos'>('seleccionar')
  const [tipoMovimiento, setTipoMovimiento] = useState<'egreso' | 'ingreso'>('egreso')
  const [nuevaCuota, setNuevaCuota] = useState({ fecha: '', monto: '', descripcion: '', categ: '', estado: 'pendiente' })
  const [busquedaTemplatesPM, setBusquedaTemplatesPM] = useState('')
  const [cuentasContablesOpciones, setCuentasContablesOpciones] = useState<{categ: string, nombre_totalizadora: string | null}[]>([])
  const [guardandoNuevaCuota, setGuardandoNuevaCuota] = useState(false)
  const [subcategsDisponiblesCF, setSubcategsDisponiblesCF] = useState<string[]>([])

  // Estado para modal Anticipos (crear + ver existentes)
  const [modalAnticipo, setModalAnticipo] = useState(false)
  const [tabAnticipo, setTabAnticipo] = useState<string>('nuevo')
  const [nuevoAnticipo, setNuevoAnticipo] = useState({
    tipo: 'pago' as 'pago' | 'cobro',
    cuit: '',
    nombre: '',
    monto: '',
    fecha: '',
    descripcion: '',
    estado_pago: 'pagado',
    nro_cuenta: null as string | null,
    categ: null as string | null,
    // De qué empresa sale el anticipo. Arranca vacío A PROPÓSITO: no se hereda en silencio.
    // Vacío es un valor válido y significa "no se sabe" — pero hay que confirmarlo. A-FEAT-13.
    empresa: null as Empresa | null,
  })
  const [guardandoAnticipo, setGuardandoAnticipo] = useState(false)
  const [anticiposExistentes, setAnticiposExistentes] = useState<any[]>([])
  const [cargandoAnticipos, setCargandoAnticipos] = useState(false)
  const [mostrarAnticiposExternos, setMostrarAnticiposExternos] = useState(false)
  const [editandoCuentaAnticipoId, setEditandoCuentaAnticipoId] = useState<string | null>(null)

  // Wizard de vinculación anticipo → factura (lógica compartida con Vista Principal)
  const vincAnticipo = useVinculacionAnticipo(async () => {
    await cargarAnticiposExistentes()
    await cargarDatos()
  })

  // Estados modal SICORE - facturas ARCA
  const [mostrarModalSicore, setMostrarModalSicore] = useState(false)
  const [facturaEnProceso, setFacturaEnProceso] = useState<CashFlowRow | null>(null)
  const [pasoSicore, setPasoSicore] = useState<'tipo' | 'calculo'>('tipo')
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoSicore | null>(null)
  const [montoRetencion, setMontoRetencion] = useState(0)
  const [descuentoAdicional, setDescuentoAdicional] = useState(0)
  // Descuento en SICORE (paridad con el Modal): % o monto + desglose gravado/IVA
  const [descuentoTipoInput, setDescuentoTipoInput] = useState<'pct' | 'monto'>('pct')
  const [descuentoInputValor, setDescuentoInputValor] = useState('')
  const [descuentoDesglose, setDescuentoDesglose] = useState<{ gravado: number; iva: number; noGravado: number; exento: number; total: number } | null>(null)
  const [datosSicoreCalculo, setDatosSicoreCalculo] = useState<{
    netoFactura: number, minimoAplicado: number, baseImponible: number, esRetencionAdicional: boolean, sinRetencion?: boolean, netoPrevio?: number, minimoTipo?: number, ignorarPrevios?: boolean
  } | null>(null)
  const [guardadoPendienteCF, setGuardadoPendienteCF] = useState<{
    filaId: string, nuevoEstado: string, estadoAnterior: string
  } | null>(null)
  // Cola SICORE para lote (y para below-minimum auto-advance)
  const [colaLoteSicore, setColaLoteSicore] = useState<CashFlowRow[]>([])

  // ── ECHEQ (paridad con el Modal de Pagos) ──────────────────────────────────
  // El echeq pasa por el MISMO flujo SICORE que "pagar"; el pending lleva nuevoEstado='echeq'.
  // Al finalizar, si hay echeq pendiente → estampa metodo_pago/fecha_cobro_echeq + registra el cheque (neto).
  const [mostrarModalEcheqCF, setMostrarModalEcheqCF] = useState(false)
  const [echeqFormCF, setEcheqFormCF] = useState<EcheqDatos>({ banco: '', numero: '', fechaEmision: '', fechaCobro: '' })
  const [echeqOrigenCF, setEcheqOrigenCF] = useState<'factura' | 'anticipo'>('factura')
  const echeqFilaCF = useRef<CashFlowRow | null>(null)       // factura en proceso de echeq (single)
  const echeqAnticipoCF = useRef<any | null>(null)           // anticipo en proceso de echeq
  const echeqPendienteCF = useRef<EcheqDatos | null>(null)   // datos del cheque a registrar al finalizar
  const echeqLoteActivo = useRef<boolean>(false)             // echeq de varias FC vía lote (usa la cola SICORE)
  const echeqLoteFacturas = useRef<CashFlowRow[]>([])        // FC ARCA a procesar como echeq en lote
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

  // E1: vista operativa — chips estado/origen (siempre visibles). Default = impagos (todo menos 'pagado'), todos los orígenes.
  const [chipsEstados, setChipsEstados] = useState<Set<string>>(new Set())
  const [chipsOrigenes, setChipsOrigenes] = useState<Set<string>>(new Set())
  const [chipsInit, setChipsInit] = useState(false)
  const [verDebitosVencidos, setVerDebitosVencidos] = useState(false) // débitos auto: ocultar los ya vencidos (se asumen pagados)
  const [modalExportarLote, setModalExportarLote] = useState<{ open: boolean; items: ItemSeleccionado[] }>({ open: false, items: [] })
  useEffect(() => {
    if (chipsInit || !data || data.length === 0) return
    setChipsEstados(new Set(data.map(f => f.estado).filter(e => e !== 'pagado')))
    setChipsOrigenes(new Set(data.map(f => f.origen)))
    setChipsInit(true)
  }, [data, chipsInit])

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
        if (['fecha_estimada', 'fecha_vencimiento', 'fecha_pago'].includes(celda.columna)) {
          // A-FEAT-23: `10/8` completa el año actual. Antes `split('/')` dejaba el año en
          // `undefined` y salía una fecha inválida sin decir nada.
          valorFinal = fechaTipeadaAISO(String(valorFinal))
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
      const { error, count } = await supabase.schema(schemaDeFila(filaCapturada)).from('comprobantes_arca')
        .update({ tc_pago: tc }, { count: 'exact' })
        .eq('id', modalTcPago.filaId)
      if (error) throw error
      if (count === 0) throw new Error('No se encontró la factura: el TC NO se guardó')
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
    let esEditable = columna.editable
    // La fecha de vencimiento de templates es de solo-lectura acá:
    // solo se edita desde "Egresos sin Factura" (el guardián de BD lo bloquea igual si se intenta).
    if (columna.key === 'fecha_vencimiento' && fila.origen !== 'ARCA') {
      esEditable = false
    }
    // fecha_pago editable para templates y FC (ARCA). El hook escribe fecha_pago en
    // comprobantes_arca (schema msa) + arrastra a fecha_estimada. Otros orígenes (anticipos)
    // no tienen la columna directa → bloqueado.
    if (columna.key === 'fecha_pago' && fila.origen !== 'TEMPLATE' && fila.origen !== 'ARCA') {
      esEditable = false
    }

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

      // HOOK ECHEQ (facturas ARCA) - abrir modal para capturar banco/número/fechas.
      // El echeq pasa por el MISMO flujo SICORE que "pagar" (la retención sale igual); al finalizar
      // se estampa estado='echeq' + metodo_pago + fecha_cobro_echeq + se registra el cheque (neto).
      // ── BLINDAJE POR EMPRESA (A-FEAT-13 paso 5) ─────────────────────────────
      // ECHEQ existe sólo en MSA: `msa.cheques` no tiene equivalente en `pam` ni `ma`.
      if (filaParaCambioEstado.origen === 'ARCA' && nuevoEstado === 'echeq' && !esFilaMsa(filaParaCambioEstado)) {
        const empresa = (filaParaCambioEstado.empresas || []).join('/') || 'esta empresa'
        setFilaParaCambioEstado(null)
        setGuardandoCambio(false)
        toast.error(`ECHEQ está disponible sólo para MSA (esta factura es de ${empresa}).`)
        return
      }

      if (filaParaCambioEstado.origen === 'ARCA' && nuevoEstado === 'echeq' && filaParaCambioEstado.estado !== 'echeq') {
        echeqFilaCF.current = filaParaCambioEstado
        echeqAnticipoCF.current = null
        setEcheqOrigenCF('factura')
        setEcheqFormCF({ banco: '', numero: '', fechaEmision: filaParaCambioEstado.fecha_pago || new Date().toISOString().split('T')[0], fechaCobro: '' })
        setMostrarModalEcheqCF(true)
        setFilaParaCambioEstado(null)
        setGuardandoCambio(false)
        return
      }

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

      // PAM y MA no tienen SICORE (decisión del usuario, no una tabla que falte) → pasan
      // derecho a 'pagar', sin evaluación de retención y sin exigir fecha_pago (esa exigencia
      // existe sólo porque de esa fecha sale la quincena SICORE). A-FEAT-13 paso 5.
      // Va DESPUÉS del hook de TC para que una FC en dólares siga preguntando el tipo de cambio.
      if (filaParaCambioEstado.origen === 'ARCA' && nuevoEstado === 'pagar' && !esFilaMsa(filaParaCambioEstado)) {
        const empresa = (filaParaCambioEstado.empresas || []).join('/') || 'la empresa'
        const ok = await actualizarRegistro(filaParaCambioEstado.id, 'estado', 'pagar', 'ARCA')
        setFilaParaCambioEstado(null)
        setGuardandoCambio(false)
        if (ok) {
          cargarDatos()
          toast.success(`Factura de ${empresa} marcada para pagar (sin SICORE)`)
        }
        return
      }

      // ENFORCE fecha_pago - para pagar una FC hay que tener la Fecha de Pago cargada
      // (la quincena SICORE sale de esa fecha). Bloquea el paso a pagar si falta.
      if (
        filaParaCambioEstado.origen === 'ARCA' &&
        nuevoEstado === 'pagar' &&
        filaParaCambioEstado.estado !== 'pagar' &&
        !filaParaCambioEstado.fecha_pago
      ) {
        setFilaParaCambioEstado(null)
        setGuardandoCambio(false)
        toast.error('Cargá la Fecha de Pago de la FC antes de pasarla a pagar (la retención SICORE se calcula por esa fecha).')
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
        // La quincena sale de la fecha de PAGO, no de la estimada (ver `quincenaDePago`)
        const quincenahNueva = quincenaDePago(filaParaCambioEstado)
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

      // Barrera: conciliación manual de cuotas TEMPLATE con monto real
      if (nuevoEstado === 'conciliado' && filaParaCambioEstado.origen === 'TEMPLATE') {
        const monto = Math.abs(filaParaCambioEstado.debitos ?? 0)

        if (monto > 0) {
          toast.error(`Esta cuota tiene monto $${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}. La conciliación debe realizarse desde el extracto bancario.`)
          setFilaParaCambioEstado(null)
          setGuardandoCambio(false)
          return
        }

        // Monto = 0: confirmación explícita
        const confirmar = window.confirm('Esta cuota es de $0.\n¿Confirmar como conciliada sin movimiento bancario?')
        if (!confirmar) {
          setFilaParaCambioEstado(null)
          setGuardandoCambio(false)
          return
        }
      }

      // Revertir FC (ARCA) a 'pendiente' = RESET completo (anula SICORE v2 + limpia sicore/tc/descuento +
      // restaura monto_a_abonar), igual que "Resetear" del Modal. Sin esto quedaba pendiente con datos SICORE.
      if (nuevoEstado === 'pendiente' && filaParaCambioEstado.origen === 'ARCA' && filaParaCambioEstado.estado !== 'pendiente') {
        const fila = filaParaCambioEstado
        // Miembros a resetear: si es fila-grupo, todos; si es individual, ella sola.
        const ids = (fila.facturas_agrupadas && fila.facturas_agrupadas > 1 && fila.ids_grupo?.length) ? fila.ids_grupo : [fila.id]
        // Chequeo estado_quincena (declarada bloquea / cerrada confirma) si hay retención
        if (fila.sicore) {
          const estadoQ = await estadoQuincenaDeFactura('msa', ids[0])
          if (estadoQ === 'declarada') {
            toast.error('🔒 Esta retención ya fue declarada a AFIP. Rectificá la DDJJ para modificar.')
            setFilaParaCambioEstado(null); setGuardandoCambio(false); return
          }
          if (estadoQ === 'cerrada' && !window.confirm('⚠️ Quincena cerrada (TXT generado). Al anular tendrás que regenerar el TXT. ¿Continuar?')) {
            setFilaParaCambioEstado(null); setGuardandoCambio(false); return
          }
        }

        // Anticipos vinculados (sobre todos los miembros) → decidir cómo tratarlos
        const antsPorFactura: { id: string; ants: Awaited<ReturnType<typeof anticiposVinculadosAFactura>> }[] = []
        for (const id of ids) antsPorFactura.push({ id, ants: await anticiposVinculadosAFactura(id) })
        const totalAnts = antsPorFactura.reduce((s, x) => s + x.ants.length, 0)
        const montoAnts = antsPorFactura.reduce((s, x) => s + x.ants.reduce((a, b) => a + (b.monto || 0), 0), 0)

        // ADVERTENCIA SIEMPRE: qué va a pasar (más allá del estado de la quincena)
        let msg = `¿Resetear ${ids.length > 1 ? `${ids.length} FC` : 'la FC'} a pendiente?\n\nSe hará:\n• Se anula la retención SICORE${fila.sicore ? ` (quincena ${fila.sicore})` : ''}\n• Se borra el descuento aplicado\n• El monto vuelve al importe original`
        let modoAnticipo: 'mantener' | 'eliminar' = 'mantener'
        if (totalAnts > 0) {
          msg += `\n\n⚠️ Hay ${totalAnts} anticipo(s) vinculado(s) por $${montoAnts.toLocaleString('es-AR', { minimumFractionDigits: 2 })}.`
          if (!window.confirm(msg + `\n\n¿Continuar con el reset?`)) { setFilaParaCambioEstado(null); setGuardandoCambio(false); return }
          // Segunda elección: mantener o eliminar el anticipo
          const mantener = window.confirm(
            `¿Cómo trato el/los anticipo(s)?\n\n• ACEPTAR = MANTENER el anticipo (la FC recuerda el saldo: monto = total − $${montoAnts.toLocaleString('es-AR', { minimumFractionDigits: 2 })}). El anticipo sigue vinculado.\n\n• CANCELAR = ELIMINAR el anticipo (se BORRA la fila del anticipo y sus datos; el monto vuelve al total).`
          )
          modoAnticipo = mantener ? 'mantener' : 'eliminar'
        } else {
          if (!window.confirm(msg + `\n\n¿Continuar?`)) { setFilaParaCambioEstado(null); setGuardandoCambio(false); return }
        }

        try {
          for (const id of ids) {
            await resetearRetencionFactura('msa', id, { modoAnticipo })
          }
          const sufijo = totalAnts > 0 ? (modoAnticipo === 'eliminar' ? ' (anticipo eliminado)' : ' (anticipo mantenido)') : ''
          toast.success((ids.length > 1 ? `${ids.length} FC reseteadas a pendiente` : 'FC reseteada a pendiente') + sufijo)
        } catch (e: any) {
          toast.error('Error al resetear: ' + (e?.message ?? e))
        }
        setFilaParaCambioEstado(null)
        setGuardandoCambio(false)
        await cargarAnticiposExistentes()
        await cargarDatos()
        return
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

    // BLOQUEO: No permitir editar monto en filas agrupadas (grupo de cuotas/facturas)
    if (celdaEnEdicion.columna === 'debitos' || celdaEnEdicion.columna === 'creditos') {
      const filaEdit = data.find(f => f.id === celdaEnEdicion.filaId)
      if (filaEdit && (filaEdit.facturas_agrupadas ?? 0) > 1) {
        toast.error('Para cambiar el total de un grupo, modifique los montos de sus componentes individuales desde Templates.')
        setCeldaEnEdicion(null)
        return
      }
    }

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

    // La empresa siempre viaja: es un filtro de contexto, no uno de búsqueda
    nuevosFiltros.empresasFacturas = empresasFacturas
    nuevosFiltros.empresasTemplates = empresasTemplates

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
    // "Limpiar" vuelve a los DEFAULTS de empresa, no a "todo": ver las 92 FC de MA no es el
    // estado limpio, es el estado ruidoso. Para verlas hay que tildar MA a propósito.
    setEmpresasFacturas(['MSA', 'PAM'])
    setEmpresasTemplates(['MSA', 'PAM', 'MA'])
    setFiltros({ empresasFacturas: ['MSA', 'PAM'], empresasTemplates: ['MSA', 'PAM', 'MA'] })
    toast.success('Filtros limpiados')
  }

  // El filtro de empresa se aplica al toque, sin pasar por "Aplicar filtros": es un
  // interruptor de contexto (qué empresas estoy mirando), no un criterio de búsqueda.
  useEffect(() => {
    setFiltros(prev => ({ ...(prev || {}), empresasFacturas, empresasTemplates }))
  }, [empresasFacturas, empresasTemplates])

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
        const q = normalizarBusqueda(busquedaRapida).replace(/\./g, '')
        const normalizarMonto = (n: number) => n > 0
          ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '')
          : ''
        return (
          normalizarBusqueda(fila.nombre_proveedor).includes(q) ||
          normalizarBusqueda(fila.cuit_proveedor).includes(q) ||
          normalizarBusqueda(fila.categ).includes(q) ||
          normalizarBusqueda(fila.detalle).includes(q) ||
          normalizarMonto(fila.debitos).includes(q) ||
          normalizarMonto(fila.creditos).includes(q)
        )
      })
    : data

  // E1: valores disponibles para los chips + filtro operativo (siempre activo tras inicializar)
  const estadosDisponibles = Array.from(new Set(data.map(f => f.estado))).sort()
  const origenesDisponibles = Array.from(new Set(data.map(f => f.origen))).sort()
  // Débitos automáticos: los anteriores a hoy se asumen pagados. Ocultar los previos a (hoy − 7 días) salvo que se pidan.
  const corteDebitoStr = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0] })()
  const datosOperativos = !chipsInit
    ? datosConBusqueda
    : datosConBusqueda.filter(fila => {
        if (!chipsOrigenes.has(fila.origen) || !chipsEstados.has(fila.estado)) return false
        if (!verDebitosVencidos && fila.estado === 'debito' && (fila.fecha_estimada || '') < corteDebitoStr) return false
        return true
      })
  /**
   * Click normal = prende/apaga ese chip.
   * **Ctrl+click (o ⌘+click) = dejar SÓLO ése.**
   *
   * Motivo: con todos los chips prendidos, ir a "ver sólo uno" obligaba a apretar *ninguno* y
   * después el que se quería. Dos pasos para lo que se hace todo el tiempo.
   */
  const toggleChip = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    val: string,
    soloEste = false,
  ) => {
    if (soloEste) { setter(new Set([val])); return }
    setter(prev => { const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n })
  }
  const verTodo = () => {
    setChipsEstados(new Set(estadosDisponibles))
    setChipsOrigenes(new Set(origenesDisponibles))
  }
  // E2.1: subtotales de lo que se está viendo (respeta chips/búsqueda) — usa lib/pagos/subtotales
  const subtotales = calcularSubtotales(datosOperativos)
  const fmtMonto = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Los chips de origen (siempre visibles) ya filtran; en Modo Pagos usamos el mismo set operativo.
  const datosFiltradosPagos = datosOperativos

  /**
   * Si hay UNA sola fila seleccionada y es un grupo, el botón "Agrupar" pasa a ser "Desagrupar".
   *
   * Antes deshacer un grupo era una ✕ de 8 píxeles dentro de la celda Detalle, sin rótulo: estaba
   * pero no se encontraba. Acá la acción aparece donde el usuario ya está mirando, y sólo cuando
   * tiene sentido — con 0, con 2+, o con una fila que no es grupo, sigue siendo "Agrupar".
   */
  const filaGrupoSeleccionada = (() => {
    if (filasSeleccionadas.size !== 1) return null
    const fila = datosOperativos.find(f => filasSeleccionadas.has(f.id))
    return fila && (fila.facturas_agrupadas ?? 0) > 1 && fila.grupo_pago_id ? fila : null
  })()

  // Seleccionar/Deseleccionar todas las filas visibles
  const seleccionarTodasVisibles = () => {
    const idsVisibles = new Set(datosFiltradosPagos.map(f => f.id))
    setFilasSeleccionadas(idsVisibles)
    toast.success(`${idsVisibles.size} filas seleccionadas`)
  }

  const deseleccionarTodas = () => {
    setFilasSeleccionadas(new Set())
  }

  // E2.3: Comprobante de pago PDF sobre las filas seleccionadas (agrupa por proveedor). Reusa lib/pagos/pdf-detalle-pago.
  const generarPDFPagosSeleccionados = async () => {
    const filas = datosOperativos.filter(f => filasSeleccionadas.has(f.id))
    if (filas.length === 0) { toast.error('Seleccioná al menos una fila'); return }
    const fmtFecha = (s?: string | null) => {
      if (!s) return ''
      const d = new Date(s + 'T12:00:00')
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
    }
    const grupos = new Map<string, CashFlowRow[]>()
    for (const f of filas) {
      const k = `${f.cuit_proveedor || ''}||${f.nombre_proveedor || ''}`
      const arr = grupos.get(k) || []
      arr.push(f)
      grupos.set(k, arr)
    }
    const tareas = Array.from(grupos.entries()).map(async ([k, fs]) => {
      const [cuit, proveedor] = k.split('||')
      const tipo = fs.some(f => f.origen === 'ARCA') ? 'arca' : 'template'
      const items = fs.map(f => {
        const fa = f as any
        return {
          comprobante: f.detalle || fa.comprobante_display || '-',
          fecha: fmtFecha(f.fecha_estimada),
          fecha_estimada: f.fecha_estimada,
          imp_total: fa.imp_total ?? f.debitos ?? 0,
          monto_sicore: fa.monto_sicore ?? null,
          descuento_aplicado: fa.descuento_aplicado ?? null,
          monto_a_abonar: fa.monto_a_abonar ?? f.debitos ?? 0,
        }
      })
      // Medios de pago reales (anticipo/echeq/transferencia) para el desglose multimedio — solo ARCA (MSA)
      let mediosPago: Awaited<ReturnType<typeof obtenerMediosPagoFactura>> = []
      if (tipo === 'arca') {
        const ids = fs.flatMap(f => (f.facturas_agrupadas && f.ids_grupo?.length) ? f.ids_grupo : [f.id])
        mediosPago = await obtenerMediosPagoFactura(schemaDeFila(fs[0]), ids)
      }
      await generarPDFDetallePago(tipo as 'arca' | 'template', proveedor, cuit, items, null, { mediosPago })
    })
    await Promise.all(tareas)
    toast.success(`${grupos.size} comprobante(s) PDF generado(s)`)
  }

  // E2.3b: Encolar mail de "Detalle de pago" sobre las filas seleccionadas (agrupa por proveedor).
  // Reusa lib/pagos/encolar-mail-detalle (misma lógica que el modal de pagos). Cash Flow = schema 'msa'.
  // Sirve para mandar el detalle a proveedores YA pagados (el modal de pagos no muestra pagadas).
  const encolarMailsSeleccionados = async () => {
    const filas = datosOperativos.filter(f => filasSeleccionadas.has(f.id))
    if (filas.length === 0) { toast.error('Seleccioná al menos una fila'); return }
    const fmtFecha = (s?: string | null) => {
      if (!s) return ''
      const d = new Date(s + 'T12:00:00')
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
    }
    const grupos = new Map<string, CashFlowRow[]>()
    for (const f of filas) {
      const k = `${f.cuit_proveedor || ''}||${f.nombre_proveedor || ''}`
      const arr = grupos.get(k) || []
      arr.push(f)
      grupos.set(k, arr)
    }
    const t = toast.loading(`Encolando ${grupos.size} mail(s)…`)
    let ok = 0, sinMail = 0, err = 0
    for (const [k, fs] of grupos) {
      const [cuit, proveedor] = k.split('||')
      // 'arca' si CUALQUIER fila del grupo es ARCA (sino el cert SICORE se saltea al mezclar con transferencias/anticipos)
      const tipo = fs.some(f => f.origen === 'ARCA') ? 'arca' : 'template'
      const items = fs.map(f => {
        const fa = f as unknown as { comprobante_display?: string; imp_total?: number; monto_sicore?: number | null; descuento_aplicado?: number | null; monto_a_abonar?: number }
        return {
          comprobante: f.detalle || fa.comprobante_display || '-',
          fecha: fmtFecha(f.fecha_estimada),
          fecha_estimada: f.fecha_estimada,
          imp_total: fa.imp_total ?? f.debitos ?? 0,
          monto_sicore: fa.monto_sicore ?? null,
          descuento_aplicado: fa.descuento_aplicado ?? null,
          monto_a_abonar: fa.monto_a_abonar ?? f.debitos ?? 0,
        }
      })
      // factura_id para el certificado SICORE: si es grupo, las FC individuales; si no, el id de la fila.
      const facturaIds: string[] = []
      for (const f of fs) {
        if (f.origen !== 'ARCA') continue
        if (f.ids_grupo && f.ids_grupo.length) facturaIds.push(...f.ids_grupo)
        else facturaIds.push(f.id)
      }
      const r = await encolarMailDetalle({ tipo: tipo as 'arca' | 'template', proveedor, cuit, items, schemaName: schemaDeFila(fs[0]), facturaIds })
      if (!r.ok) err++
      else if (!r.email) sinMail++
      else ok++
    }
    toast.dismiss(t)
    toast.success(`✉ ${ok} mail(s) encolado(s)${sinMail ? ` · ${sinMail} sin email` : ''}${err ? ` · ${err} error(es)` : ''}. Revisá "✉ Mails de detalle".`)
  }

  // E2.4: Exportar lote Galicia sobre las filas seleccionadas. Reusa el módulo lotes-galicia (CBU/mail/agendar proveedores).
  const exportarLoteSeleccionados = () => {
    const filas = datosOperativos.filter(f => filasSeleccionadas.has(f.id))
    if (filas.length === 0) { toast.error('Seleccioná al menos una fila'); return }
    const items: ItemSeleccionado[] = []
    for (const f of filas) {
      const schema = (f.origen_tabla?.split('.')[0]) || 'msa'
      if ((f.facturas_agrupadas ?? 0) > 1) {
        items.push({ tipo: 'grupo', id: (f.grupo_pago_id || f.id) as string, schema })
      } else if (f.origen === 'ARCA') {
        items.push({ tipo: 'fc', id: f.id, schema })
      } else if (f.origen === 'TEMPLATE') {
        items.push({ tipo: 'cuota_template', id: f.id })
      } else if (f.origen === 'ANTICIPO') {
        items.push({ tipo: 'anticipo', id: f.id, schema })
      } else if (f.origen === 'SUELDO') {
        items.push({ tipo: 'sueldo', id: f.id })
      }
      // VENTA: es ingreso, no se exporta como pago
    }
    if (items.length === 0) { toast.error('Ninguna fila seleccionada es exportable como pago'); return }
    setModalExportarLote({ open: true, items })
  }

  // E2.2: Agrupar filas seleccionadas en un grupo de pago (mismo origen + mismo proveedor). Reusa lib/pagos/agrupar.
  const agruparSeleccionados = async () => {
    const filas = datosOperativos.filter(f => filasSeleccionadas.has(f.id) && (f.facturas_agrupadas ?? 0) <= 1)
    if (filas.length < 2) { toast.error('Seleccioná al menos 2 filas individuales del mismo proveedor'); return }
    const origenes = new Set(filas.map(f => f.origen))
    if (origenes.size > 1) { toast.error('Agrupá filas del mismo origen (todas FC o todas templates)'); return }
    const origen = filas[0].origen
    if (origen !== 'ARCA' && origen !== 'TEMPLATE') { toast.error('Agrupar disponible para FC (ARCA) y templates'); return }
    if (filas.some(f => f.grupo_pago_id)) { toast.error('Alguna fila ya pertenece a un grupo (desagrupá primero desde el Modal)'); return }
    // El grupo y las facturas tienen que vivir en el MISMO schema (hay FK), así que no se pueden
    // mezclar empresas en un grupo. Desde 2026-08-08 existe `grupos_pago` en pam y ma (A-FEAT-13-B).
    if (origen === 'ARCA' && new Set(filas.map(f => schemaDeFila(f))).size > 1) {
      toast.error('No se pueden agrupar facturas de empresas distintas: un grupo de pago vive en una sola empresa')
      return
    }
    const cuits = new Set(filas.map(f => f.cuit_proveedor || ''))
    if (cuits.size > 1) {
      if (!window.confirm('⚠️ Las filas seleccionadas tienen CUITs diferentes. ¿Agrupar igual?')) return
    }
    // Templates: exigir mismo responsable (paridad con el Modal)
    if (origen === 'TEMPLATE' && new Set(filas.map(f => f.responsable || '')).size > 1) {
      toast.error('Los templates a agrupar deben tener el mismo responsable'); return
    }
    // Nombre del grupo: combinar proveedores ("A + B" / "A + N más")
    const proveedoresUnicos = [...new Set(filas.map(f => f.nombre_proveedor).filter(Boolean))] as string[]
    const proveedorGrupo = proveedoresUnicos.length <= 2
      ? proveedoresUnicos.join(' + ')
      : `${proveedoresUnicos[0]} + ${proveedoresUnicos.length - 1} más`
    // monto_total en pesos (para USD: debitos × TC de la fila ARCA; templates ya en ARS)
    const monto_total = filas.reduce((s, f) => s + (f.debitos || 0) * (origen === 'ARCA' ? (f.tc_pago ?? f.tipo_cambio ?? 1) : 1), 0)
    try {
      await agruparPagos({
        // ARCA: el schema de la empresa de las facturas. TEMPLATE: siempre msa, porque el
        // grupo_pago_id de las cuotas tiene FK a msa.grupos_pago.
        schema: origen === 'ARCA' ? schemaDeFila(filas[0]) : 'msa',
        origen: origen as 'ARCA' | 'TEMPLATE',
        ids: filas.map(f => f.id),
        cuit: filas[0].cuit_proveedor || null,
        proveedor: proveedorGrupo || (filas[0].nombre_proveedor || ''),
        monto_total,
        estado: origen === 'ARCA' ? 'pagar' : (filas[0].estado || 'pendiente'),
        observaciones: cuits.size > 1 ? `Multi-CUIT: ${[...cuits].join(', ')}` : null,
      })
      toast.success(`${filas.length} pagos agrupados`)
      setFilasSeleccionadas(new Set())
      await cargarDatos()
    } catch (e: any) {
      toast.error(e?.message || 'Error al agrupar')
    }
  }

  // Deshacer un grupo (fila consolidada) → vuelven las FCs/cuotas individuales. Paridad con el Modal.
  const desagruparFilaGrupo = async (fila: CashFlowRow) => {
    if (!fila.grupo_pago_id || !(fila.facturas_agrupadas && fila.facturas_agrupadas > 1)) return
    const origen = fila.origen === 'ARCA' ? 'ARCA' : 'TEMPLATE'
    if (!window.confirm(`¿Deshacer el grupo (${fila.facturas_agrupadas} comprobantes)? Vuelven a ser individuales.`)) return
    try {
      // Mismo criterio que al agrupar: ARCA en el schema de su empresa, templates siempre en msa.
      // La fila de grupo trae `origen_tabla = '{schema}.grupos_pago'`, así que sale de ahí.
      await desagruparPago(origen === 'ARCA' ? schemaDeFila(fila) : 'msa', origen, fila.grupo_pago_id)
      toast.success('Grupo deshecho')
      setFilasSeleccionadas(new Set())
      await cargarDatos()
    } catch (e: any) {
      toast.error(e?.message || 'Error al desagrupar')
    }
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

    // A-FEAT-22 · Si el estado implica que la plata sale, primero se confirma la FECHA DE PAGO.
    // Antes se asumía la estimada, que casi nunca es la real porque el registro se hace el día en
    // que se paga. Y no es cosmético: la quincena de SICORE sale de esta fecha.
    if (cambiarEstadoLote && ESTADOS_QUE_PAGAN.includes(valorEstadoLote)) {
      setModalFechaPago({ open: true, fecha: new Date().toISOString().split('T')[0] })
      return
    }

    await ejecutarLote('ninguna', '')
  }

  /**
   * Fase 2 del lote, ya con la fecha de pago decidida.
   *
   * `modoFecha`:
   *  - `elegida`   → se registra `fechaElegida` como fecha de pago en todas
   *  - `estimadas` → cada fila usa su propia `fecha_estimada` como fecha de pago
   *  - `ninguna`   → no se toca la fecha de pago (cambios que no son de pago)
   *
   * ⚠️ **Nada se escribe hasta que las preguntas estén contestadas.** Antes se guardaba una parte y
   * recién después se preguntaba por SICORE: si el usuario cancelaba, el lote quedaba aplicado a
   * medias (A-BUG-20).
   */
  const ejecutarLote = async (modoFecha: 'elegida' | 'estimadas' | 'ninguna', fechaElegida: string) => {
    setProcesandoLote(true)

    try {
      const minimoSicore = 67170
      const calcularNetoLote = (f: CashFlowRow) => {
        const tc = f.tc_pago ?? f.tipo_cambio ?? 1
        return ((f.imp_neto_gravado || 0) + (f.imp_neto_no_gravado || 0) + (f.imp_op_exentas || 0)) * tc
      }

      // Separar filas: las ARCA→'pagar' necesitan evaluación SICORE; el resto va directo
      const todasFilas = Array.from(filasSeleccionadas).map(id => data.find(f => f.id === id)!).filter(Boolean)

      /** La fecha de pago que le corresponde a cada fila según lo elegido en el paso 1. */
      const fechaPagoDe = (f: CashFlowRow): string =>
        modoFecha === 'elegida' ? fechaElegida
        : modoFecha === 'estimadas' ? (f.fecha_pago || f.fecha_estimada || '')
        : (f.fecha_pago || '')

      let facturasParaSicore: CashFlowRow[] = []
      // Califican por monto pero no tienen fecha de pago: sin quincena no se puede retener
      let sinFechaParaSicore = 0
      // ⚠️ Antes decía `'ARCA' | 'TEMPLATE'` y acá se empujan filas de CUALQUIER origen. TypeScript
      // marcaba el error en las 4 líneas de abajo y estaba en el baseline sin mirar: los sueldos,
      // anticipos y ventas se descartaban al guardar (A-BUG-19).
      const actualizaciones: Array<{id: string, origen: CashFlowRow['origen'], campo: string, valor: any}> = []

      // La fecha de pago decidida en el paso 1 se guarda en todas las filas del lote
      if (modoFecha !== 'ninguna') {
        todasFilas.forEach(f => {
          const fp = fechaPagoDe(f)
          if (fp && fp !== f.fecha_pago) {
            actualizaciones.push({ id: f.id, origen: f.origen, campo: 'fecha_pago', valor: fp })
          }
        })
      }

      // Cambio de fecha de vencimiento: siempre directo para todas
      todasFilas.forEach(fila => {
        if (cambiarFechaVenc && valorFechaLote) {
          actualizaciones.push({ id: fila.id, origen: fila.origen, campo: 'fecha_vencimiento', valor: valorFechaLote })
          actualizaciones.push({ id: fila.id, origen: fila.origen, campo: 'fecha_estimada', valor: valorFechaLote })
        }
      })

      // ECHEQ en lote: las FC ARCA pasan por el flujo echeq+SICORE (modal + cheque); el resto va directo.
      if (cambiarEstadoLote && valorEstadoLote === 'echeq') {
        // ECHEQ es sólo MSA (`msa.cheques`): una FC de PAM/MA en la selección se avisa y no entra
        const arcaNoMsa = todasFilas.filter(f => f.origen === 'ARCA' && !esFilaMsa(f))
        if (arcaNoMsa.length > 0) {
          toast.error(`${arcaNoMsa.length} factura(s) de PAM/MA no pueden pagarse por ECHEQ (es sólo de MSA). Quedan sin tocar.`)
        }
        const arcaFacturas = todasFilas.filter(f => f.origen === 'ARCA' && f.estado !== 'echeq' && esFilaMsa(f))
        const noArca = todasFilas.filter(f => !(f.origen === 'ARCA' && f.estado !== 'echeq') && !arcaNoMsa.includes(f))
        noArca.forEach(f => actualizaciones.push({ id: f.id, origen: f.origen as 'ARCA' | 'TEMPLATE', campo: 'estado', valor: 'echeq' }))
        if (actualizaciones.length > 0) await actualizarBatch(actualizaciones)
        if (arcaFacturas.length > 0) {
          // Abrir el modal echeq UNA vez; al confirmar, confirmarEcheqCF procesa la cola (cada FC calcula su SICORE).
          echeqLoteActivo.current = true
          echeqLoteFacturas.current = arcaFacturas
          echeqFilaCF.current = null
          echeqAnticipoCF.current = null
          setEcheqOrigenCF('factura')
          const hoy = new Date().toISOString().split('T')[0]
          setEcheqFormCF({ banco: '', numero: '', fechaEmision: (cambiarFechaVenc && valorFechaLote) || arcaFacturas[0].fecha_pago || hoy, fechaCobro: '' })
          setMostrarModalEcheqCF(true)
        } else {
          toast.success(`${noArca.length} registros → echeq`)
          desactivarModoPagos()
        }
        setProcesandoLote(false)
        return
      }

      if (cambiarEstadoLote) {
        // Sólo las FC de MSA pasan por SICORE; las de PAM/MA van por el camino directo (paso 5)
        // Las Fac C quedan afuera acá mismo: van por el camino directo, sin pasar por SICORE.
        const esArcaAPagar = (f: CashFlowRow) =>
          valorEstadoLote === 'pagar' && f.origen === 'ARCA' && f.estado !== 'pagar'
          && esFilaMsa(f) && admiteSicore(f)
        // Lo que no es ARCA→pagar: estado directo
        todasFilas.filter(f => !esArcaAPagar(f)).forEach(f =>
          actualizaciones.push({ id: f.id, origen: f.origen, campo: 'estado', valor: valorEstadoLote })
        )
        // ARCA→pagar: decidir SICORE por PROVEEDOR (acumulado de quincena), no por factura individual.
        const porCuit = new Map<string, CashFlowRow[]>()
        todasFilas.filter(esArcaAPagar).forEach(f => {
          const k = f.cuit_proveedor || ''
          porCuit.set(k, [...(porCuit.get(k) || []), f])
        })
        for (const grupo of porCuit.values()) {
          const g0 = grupo[0]
          const quincena = quincenaDePago({ fecha_pago: fechaPagoDe(g0) })
          if (!quincena) {
            // Sin fecha de pago no hay quincena posible: va por el camino directo y se avisa.
            sinFechaParaSicore += grupo.length
            grupo.forEach(f => actualizaciones.push({ id: f.id, origen: f.origen, campo: 'estado', valor: valorEstadoLote }))
            continue
          }
          const totalNeto = grupo.reduce((s, f) => s + calcularNetoLote(f), 0)
          const hayNegativa = grupo.some(f => calcularNetoLote(f) < 0)
          const yaRetuvo = await verificarRetencionPreviaFactura(g0.cuit_proveedor, quincena)
          const netoPrevio = yaRetuvo ? 0 : await netoPagosPreviosSinRetencion(g0.cuit_proveedor, quincena)
          const califica = yaRetuvo || hayNegativa || (totalNeto + netoPrevio) > minimoSicore
          if (califica) {
            // Todas las del proveedor a la cola, ordenadas de mayor a menor neto
            // (la grande aplica el mínimo; las NC negativas quedan al final).
            const ordenado = [...grupo].sort((a, b) => calcularNetoLote(b) - calcularNetoLote(a))
            facturasParaSicore.push(...ordenado)
          } else {
            grupo.forEach(f => actualizaciones.push({ id: f.id, origen: f.origen, campo: 'estado', valor: valorEstadoLote }))
          }
        }
      }

      // ⚠️ Si hay facturas para SICORE **no se escribe nada todavía**: primero se pregunta.
      // Así «Cancelar» puede abortar de verdad en vez de dejar medio lote aplicado (A-BUG-20).
      if (facturasParaSicore.length > 0) {
        // Las filas llevan ya la fecha de pago elegida, para que la cola de SICORE calcule bien
        const conFecha = facturasParaSicore.map(f => ({ ...f, fecha_pago: fechaPagoDe(f) }))
        setModalSicoreLote({ facturas: conFecha, actualizaciones, sinFecha: sinFechaParaSicore })
        setProcesandoLote(false)
        return
      }

      // `actualizarBatch` ya avisa qué falló; acá sólo se recuerda para no cantar éxito después.
      let loteOk = true
      if (actualizaciones.length > 0) {
        loteOk = await actualizarBatch(actualizaciones)
      }

      if (sinFechaParaSicore > 0) {
        toast.warning(
          `${sinFechaParaSicore} factura(s) califican por monto pero NO tienen fecha de pago: ` +
          `se guardaron sin retención. SICORE necesita la fecha de pago para saber la quincena.`
        )
      }

      if (loteOk) {
        const cambiosTexto = []
        if (cambiarFechaVenc) cambiosTexto.push('fecha vencimiento')
        if (cambiarEstadoLote) cambiosTexto.push('estado')
        toast.success(`${filasSeleccionadas.size} registros actualizados: ${cambiosTexto.join(' y ')}`)
        desactivarModoPagos()
      } else {
        // Algo no se guardó: el detalle ya lo dijo `actualizarBatch`. El modo PAGOS queda ABIERTO
        // con la selección puesta, para poder ver qué pasó y reintentar sin volver a marcar todo.
        console.warn('Lote con fallos: se mantiene la selección para reintentar')
      }
    } catch (error) {
      console.error('Error en aplicarCambiosLote:', error)
      toast.error('Error al aplicar cambios por lote')
    } finally {
      setProcesandoLote(false)
    }
  }

  /**
   * Las tres salidas del cartel de SICORE (A-BUG-20). Antes eran dos, y «Cancelar» **no cancelaba**:
   * marcaba todo en `pagar` y seguía. El usuario lo apretaba esperando volver atrás.
   */
  const resolverSicoreLote = async (accion: 'retener' | 'sin_retencion' | 'cancelar') => {
    const pendiente = modalSicoreLote
    if (!pendiente) return
    setModalSicoreLote(null)

    // Cancelar = no tocar NADA. Ni las de SICORE ni el resto del lote.
    if (accion === 'cancelar') {
      toast.info('Cancelado: no se modificó ningún registro. La selección quedó como estaba.')
      return
    }

    setProcesandoLote(true)
    try {
      const extras = accion === 'sin_retencion'
        ? pendiente.facturas.map(f => ({ id: f.id, origen: 'ARCA' as CashFlowRow['origen'], campo: 'estado', valor: valorEstadoLote }))
        : []
      const ok = await actualizarBatch([...pendiente.actualizaciones, ...extras])
      if (!ok) return

      if (pendiente.sinFecha > 0) {
        toast.warning(`${pendiente.sinFecha} factura(s) califican por monto pero NO tienen fecha de pago: van sin retención`)
      }

      if (accion === 'sin_retencion') {
        toast.success(`${pendiente.facturas.length} factura(s) guardadas sin retención SICORE`)
        desactivarModoPagos()
        return
      }

      // Retener: arranca la cola, una factura por vez
      const [primera, ...resto] = pendiente.facturas
      setColaLoteSicore(resto)
      const firstPending: PendingSicore = { filaId: primera.id, nuevoEstado: valorEstadoLote, estadoAnterior: primera.estado }
      setGuardadoPendienteCF(firstPending)
      await evaluarRetencionSicoreCF(primera, firstPending, resto)
    } catch (e) {
      console.error('Error resolviendo SICORE del lote:', e)
      toast.error('Error al procesar el lote')
    } finally {
      setProcesandoLote(false)
    }
  }

  // Funciones para Pago Manual (templates abiertos)
  const cargarTemplatesAbiertos = async () => {
    try {
      const { data, error } = await supabase
        .from('egresos_sin_factura')
        .select('id, nombre_referencia, categ, cuenta_agrupadora, es_bidireccional, es_multi_cuenta, responsable, solo_conciliacion')
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
    // Cargar cuentas contables para selector de categ
    const { data: cuentas } = await supabase
      .from('cuentas_contables')
      .select('categ, nombre_totalizadora')
      .order('nombre_totalizadora')
      .order('categ')
    setCuentasContablesOpciones(cuentas || [])
    setTemplateSeleccionado(null)
    setPasoModal('seleccionar')
    setTipoMovimiento('egreso')
    setNuevaCuota({ fecha: '', monto: '', descripcion: '', categ: '', estado: 'pendiente' })
    setBusquedaTemplatesPM('')
    setMostrarBancarios(false)
    setModalPagoManual(true)
  }

  const toggleSoloConciliacion = async (templateId: string, valorActual: boolean) => {
    setTogglingSoloConciliacion(templateId)
    const { error } = await supabase
      .from('egresos_sin_factura')
      .update({ solo_conciliacion: !valorActual })
      .eq('id', templateId)
    if (!error) {
      setTemplatesAbiertos(prev => prev.map(t =>
        t.id === templateId ? { ...t, solo_conciliacion: !valorActual } : t
      ))
    }
    setTogglingSoloConciliacion(null)
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
      const categCuota = nuevaCuota.categ.trim() || null
      const { error } = await supabase
        .from('cuotas_egresos_sin_factura')
        .insert({
          egreso_id: templateSeleccionado,
          fecha_estimada: nuevaCuota.fecha,
          fecha_vencimiento: nuevaCuota.fecha,
          monto: parseFloat(nuevaCuota.monto.replace(/\./g, '').replace(',', '.')),
          descripcion: descripcionFinal,
          estado: nuevaCuota.estado || 'pendiente',
          tipo_movimiento: template?.es_bidireccional ? tipoMovimiento : 'egreso',
          ...(categCuota ? { categ: categCuota } : {})
        })

      if (error) throw error

      const tipoMsg = template?.es_bidireccional
        ? (tipoMovimiento === 'egreso' ? 'Suscripción' : 'Rescate')
        : 'Pago manual'
      toast.success(`${tipoMsg} agregado exitosamente`)
      setModalPagoManual(false)
      setTemplateSeleccionado(null)
      setTipoMovimiento('egreso')
      setNuevaCuota({ fecha: '', monto: '', descripcion: '', categ: '', estado: 'pendiente' })
      setBusquedaTemplatesPM('')
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
    setNuevoAnticipo({ tipo: 'pago', cuit: '', nombre: '', monto: '', fecha: '', descripcion: '', estado_pago: 'pagado', nro_cuenta: null, categ: null, empresa: null })
    setTabAnticipo('nuevo')
    setModalAnticipo(true)
    cargarAnticiposExistentes()
  }

  // Cargar tipos SICORE
  useEffect(() => {
    supabase.from('tipos_sicore_config').select('*').eq('activo', true).order('minimo_no_imponible')
      .then(({ data }) => { if (data) setTiposSicore(data) })
  }, [])

  // Quincena SICORE: usa el helper único de lib/sicore/quincena (E4 — centralizado)

  // Verificar retención previa (solo facturas ARCA, para el flujo de facturas)
  const verificarRetencionPreviaFactura = async (cuit: string, quincena: string): Promise<boolean> => {
    try {
      const { data } = await supabase.schema('msa').from('comprobantes_arca')
        .select('id').eq('cuit', cuit).eq('sicore', quincena).limit(1)
      return !!(data && data.length > 0)
    } catch { return false }
  }

  // Neto ya pagado en la quincena SIN retención (facturas bajo mínimo / NC negativas) → consumió parte del mínimo.
  // Solo se usa cuando NO hubo retención previa (si la hubo, el mínimo ya está consumido → ver capa 1).
  // Filtra sicore vacío para no doble-contar los que sí retuvieron. Las NC entran negativas y restan.
  const netoPagosPreviosSinRetencion = async (cuit: string, quincena: string): Promise<number> => {
    try {
      const { data } = await supabase.schema('msa').from('comprobantes_arca')
        .select('imp_neto_gravado, imp_neto_no_gravado, imp_op_exentas, tipo_cambio, tc_pago, fecha_pago')
        .eq('cuit', cuit)
        .is('sicore', null)
        .not('fecha_pago', 'is', null)
        .in('estado', ['pagar', 'pagado', 'echeq', 'conciliado'])
      let suma = 0
      for (const c of (data ?? []) as any[]) {
        if (!c.fecha_pago || generarQuincenaSicore(c.fecha_pago) !== quincena) continue
        const tc = c.tc_pago ?? c.tipo_cambio ?? 1
        suma += ((c.imp_neto_gravado || 0) + (c.imp_neto_no_gravado || 0) + (c.imp_op_exentas || 0)) * tc
      }
      return Math.round(suma * 100) / 100
    } catch { return 0 }
  }

  // Tipo para datos pendientes de guardado
  type PendingSicore = { filaId: string, nuevoEstado: string, estadoAnterior: string }

  // Evaluar si corresponde SICORE para una fila ARCA
  // freshPending y freshCola se pasan explícitamente para evitar stale closures
  /**
   * Abre el modal SÓLO para cargar un descuento pronto pago, cuando la factura no lleva retención.
   * Se llega desde la acción del aviso, nunca de forma obligatoria: para entonces la FC **ya está
   * en 'pagar'**, así que el pendiente sólo le dice a "Confirmar" sobre qué fila escribir, y
   * `estadoAnterior: 'pagar'` hace que Cancelar no cambie nada.
   */
  const abrirDescuentoSinRetencion = (fila: CashFlowRow, neto: number, netoPrevio: number) => {
    setFacturaEnProceso(fila)
    setTipoSeleccionado(null)
    setMontoRetencion(0)
    setDescuentoAdicional(0)
    setDescuentoInputValor('')
    setDescuentoDesglose(null)
    setDatosSicoreCalculo({ netoFactura: neto, minimoAplicado: 0, baseImponible: neto, esRetencionAdicional: false, sinRetencion: true, netoPrevio })
    setGuardadoPendienteCF({ filaId: fila.id, nuevoEstado: 'pagar', estadoAnterior: 'pagar' })
    setPasoSicore('calculo')
    setMostrarModalSicore(true)
  }

  const evaluarRetencionSicoreCF = async (
    fila: CashFlowRow,
    freshPending?: PendingSicore | null,
    freshCola?: CashFlowRow[]
  ) => {
    // Fac C (monotributista): NUNCA se le retiene → guardar estado sin SICORE.
    if (!admiteSicore(fila)) {
      await cancelarSicoreCF(true, freshPending, freshCola)
      return
    }
    const tc = fila.tc_pago ?? fila.tipo_cambio ?? 1
    const netoGravado = fila.imp_neto_gravado || 0
    const netoNoGravado = fila.imp_neto_no_gravado || 0
    const opExentas = fila.imp_op_exentas || 0
    const netoFactura = netoGravado + netoNoGravado + opExentas
    // SICORE se calcula sobre lo pagado: convertir a pesos con TC de pago
    const netoFacturaPesos = netoFactura * tc
    const minimoServicios = 67170
    const quincena = quincenaDePago(fila)
    if (!quincena) {
      // Sin fecha de pago no hay quincena, y sin quincena no puede haber retención.
      toast.error(`${fila.nombre_proveedor || 'La factura'} no tiene fecha de pago: cargala antes de retener SICORE`)
      setGuardadoPendienteCF(null)
      setGuardandoCambio(false)
      return
    }

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

    // Guarda de estado_quincena ANTES de estampar — igual que el Modal (evaluarRetencionSicore).
    // Sin esto, si la quincena está 'declarada' el Cash Flow estampaba la FC + estado 'pagar' pero
    // el insert en sicore_retenciones se salteaba en silencio → estado inconsistente.
    const { data: qChk } = await supabase
      .schema('msa')
      .from('sicore_retenciones')
      .select('estado_quincena')
      .eq('quincena', quincena)
      .eq('anulado', false)
      .order('estado_quincena', { ascending: false }) // 'declarada' > 'cerrada' > 'abierta'
      .limit(1)
      .maybeSingle()
    const estadoQ = (qChk?.estado_quincena as string | undefined) ?? null
    if (estadoQ === 'declarada') {
      alert(`🔒 La quincena ${quincena} ya fue declarada a AFIP. No se pueden agregar nuevas retenciones.\nRectificá la DDJJ con tu contadora antes de modificar.`)
      await cancelarSicoreCF(false, freshPending, freshCola)
      return
    }
    if (estadoQ === 'cerrada') {
      const okWarn = window.confirm(
        `⚠️ La quincena ${quincena} ya está cerrada (TXT generado).\nAl agregar esta retención tendrás que regenerar el TXT y reenviarlo a tu contadora.\n\n¿Continuar?`
      )
      if (!okWarn) {
        await cancelarSicoreCF(false, freshPending, freshCola)
        return
      }
    }

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

    // Caso normal: positivos.
    // Capa 1: si YA hubo retención en la quincena → adicional (cualquier positivo califica, sin mínimo).
    // Capa 2: si NO hubo retención → ver pagos previos que consumieron parte del mínimo (usa el mínimo más bajo como gate).
    const yaRetuvoPos = await verificarRetencionPreviaFactura(fila.cuit_proveedor, quincena)
    if (!yaRetuvoPos) {
      const netoPrevio = await netoPagosPreviosSinRetencion(fila.cuit_proveedor, quincena)
      const minimoDisponible = Math.max(0, minimoServicios - netoPrevio)
      if (netoFacturaPesos <= minimoDisponible) {
        // NO corresponde retención → no hay nada que decidir sobre SICORE: la factura pasa
        // derecho a 'pagar'. No se abre ninguna pantalla.
        //
        // Historia, para no volver atrás: acá hubo un `confirm` "¿Desea aplicar un descuento
        // pronto pago?" cuyo **Cancelar pasaba la factura a pagar** — un botón que decía cancelar
        // y confirmaba. Al sacarlo lo reemplacé por "abrir siempre el modal", y eso metió un paso
        // extra en el caso más común (factura chica, sin descuento). Las dos cosas estaban mal.
        // El descuento pronto pago queda como **acción opcional** del aviso, no como un cartel
        // que hay que contestar para poder pagar.
        const sinCola = (freshCola !== undefined ? freshCola : colaLoteSicore).length === 0
        await cancelarSicoreCF(true, freshPending, freshCola)
        if (sinCola) {
          const fmt = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
          toast.info(
            `Sin retención SICORE: el neto (${fmt(netoFacturaPesos)}) no llega al mínimo disponible (${fmt(minimoDisponible)})`,
            {
              duration: 8000,
              action: {
                label: 'Aplicar descuento',
                onClick: () => abrirDescuentoSinRetencion(fila, netoFacturaPesos, netoPrevio),
              },
            },
          )
        }
        return
      }
    }

    console.log('⚡ SICORE CF: Corresponde evaluación - abriendo modal')
    setFacturaEnProceso(fila)
    setPasoSicore('tipo')
    setMostrarModalSicore(true)
  }

  // Calcular retención según tipo seleccionado. ignorarPrevios = override (no restar pagos previos del mínimo).
  const calcularRetencionSicoreCF = async (fila: CashFlowRow, tipo: TipoSicore, ignorarPrevios = false) => {
    // SICORE se calcula sobre lo pagado: usar TC de pago para convertir a pesos
    const tc = fila.tc_pago ?? fila.tipo_cambio ?? 1
    const netoGravado = fila.imp_neto_gravado || 0
    const netoNoGravado = fila.imp_neto_no_gravado || 0
    const opExentas = fila.imp_op_exentas || 0
    const netoFactura = netoGravado + netoNoGravado + opExentas
    const netoFacturaPesos = netoFactura * tc  // ← pesos al TC de pago
    const quincena = quincenaDePago(fila)
    if (!quincena) throw new Error('No se puede calcular SICORE sin fecha de pago')

    // Capa 1: ¿ya hubo retención en la quincena? → mínimo ya consumido → adicional (sin mínimo).
    const yaRetuvo = await verificarRetencionPreviaFactura(fila.cuit_proveedor, quincena)

    let baseImponible = netoFacturaPesos
    let minimoAplicado = 0
    let netoPrevio = 0

    if (!yaRetuvo) {
      // Capa 2: pagos previos (sin retención) que consumieron parte del mínimo (override = ignorarlos).
      netoPrevio = await netoPagosPreviosSinRetencion(fila.cuit_proveedor, quincena) // real, para mostrar
      const minimoDisponible = Math.max(0, tipo.minimo_no_imponible - (ignorarPrevios ? 0 : netoPrevio))
      if (netoFacturaPesos <= minimoDisponible) {
        alert(`No corresponde retención para ${tipo.tipo}.\nNeto: $${netoFacturaPesos.toLocaleString('es-AR')}\nMínimo disponible: $${minimoDisponible.toLocaleString('es-AR')}${netoPrevio > 0 ? ` (mínimo $${tipo.minimo_no_imponible.toLocaleString('es-AR')} − $${netoPrevio.toLocaleString('es-AR')} ya pagados)` : ''}`)
        setMostrarModalSicore(false)
        return
      }
      baseImponible = netoFacturaPesos - minimoDisponible
      minimoAplicado = minimoDisponible
    }

    const retencionCalculada = Math.round(baseImponible * tipo.porcentaje_retencion * 100) / 100

    // Guardar netoFacturaPesos (ya en pesos) para mostrar en modal
    setDatosSicoreCalculo({ netoFactura: netoFacturaPesos, minimoAplicado, baseImponible, esRetencionAdicional: yaRetuvo, netoPrevio, minimoTipo: tipo.minimo_no_imponible, ignorarPrevios })
    setTipoSeleccionado(tipo)
    setMontoRetencion(retencionCalculada)
    setDescuentoAdicional(0)
    setDescuentoDesglose(null)
    setDescuentoInputValor('')
    setPasoSicore('calculo')
  }

  // Aplicar descuento (% o monto) — desglosa en gravado/IVA y recalcula la retención sobre el neto ajustado.
  // Todo en ARS (× TC de pago), igual que el cálculo del Cash Flow. Paridad con el Modal.
  const aplicarDescuentoSicoreCF = () => {
    if (!facturaEnProceso || !datosSicoreCalculo) return
    const tc = facturaEnProceso.tc_pago ?? facturaEnProceso.tipo_cambio ?? 1
    const impTotal = (facturaEnProceso.imp_total || 0) * tc
    const impGravado = (facturaEnProceso.imp_neto_gravado || 0) * tc
    const impNoGravado = (facturaEnProceso.imp_neto_no_gravado || 0) * tc
    const impExento = (facturaEnProceso.imp_op_exentas || 0) * tc
    const impIva = (facturaEnProceso.iva || 0) * tc

    const inputNum = parseFloat(descuentoInputValor.replace(/\./g, '').replace(',', '.')) || 0
    const pct = descuentoTipoInput === 'pct' ? inputNum / 100 : (impTotal > 0 ? inputNum / impTotal : 0)
    const r2 = (n: number) => Math.round(n * 100) / 100
    const descGravado = r2(impGravado * pct)
    const descIva = r2(impIva * pct)
    const descNoGravado = r2(impNoGravado * pct)
    const descExento = r2(impExento * pct)
    const descTotal = r2(descGravado + descIva + descNoGravado + descExento)

    setDescuentoDesglose({ gravado: descGravado, iva: descIva, noGravado: descNoGravado, exento: descExento, total: descTotal })
    setDescuentoAdicional(descTotal)

    // Recalcular base SICORE sobre el neto ajustado (solo si aplica retención)
    const netoAjustado = r2((impGravado - descGravado) + (impNoGravado - descNoGravado) + (impExento - descExento))
    if (!datosSicoreCalculo.sinRetencion && tipoSeleccionado) {
      const baseAjustada = Math.max(0, r2(netoAjustado - datosSicoreCalculo.minimoAplicado))
      setMontoRetencion(r2(baseAjustada * tipoSeleccionado.porcentaje_retencion))
      setDatosSicoreCalculo({ ...datosSicoreCalculo, netoFactura: netoAjustado, baseImponible: baseAjustada })
    } else {
      setDatosSicoreCalculo({ ...datosSicoreCalculo, netoFactura: netoAjustado })
    }
  }

  const limpiarDescuentoSicoreCF = () => {
    if (!facturaEnProceso) return
    setDescuentoAdicional(0)
    setDescuentoDesglose(null)
    setDescuentoInputValor('')
    if (tipoSeleccionado && !datosSicoreCalculo?.sinRetencion) {
      calcularRetencionSicoreCF(facturaEnProceso, tipoSeleccionado) // restaura cálculo original
    } else {
      setMontoRetencion(0)
    }
  }

  // Finalizar SICORE para factura ARCA desde Cash Flow
  const finalizarProcesoSicoreCF = async () => {
    if (!facturaEnProceso || !guardadoPendienteCF) return
    // Permitir finalizar sin retención si hay descuento (paridad con el Modal).
    // Pagar SIN retención y SIN descuento no pasa por acá: tiene su propio botón
    // "Seguir sin retención", que no estampa la quincena en la factura. Ver el modal.
    if (!tipoSeleccionado && montoRetencion === 0 && descuentoAdicional === 0) return

    try {
      // SICORE se calcula sobre lo pagado: usar TC de pago
      const tc = facturaEnProceso.tc_pago ?? facturaEnProceso.tipo_cambio ?? 1
      const impTotalPesos = (facturaEnProceso.imp_total || 0) * tc
      const saldoPesos = impTotalPesos - montoRetencion - descuentoAdicional
      // monto_a_abonar se guarda en la moneda de la factura:
      // - ARS (tc=1): saldoPesos / 1 = saldoPesos ✓
      // - USD: saldoPesos / tc → número "funcional" que × tc = pesos reales ✓
      const montoAAbona = saldoPesos / tc
      // Quincena desde fecha_pago (fecha real de pago); fallback venc/estimada
      const fechaSicore = facturaEnProceso.fecha_pago || facturaEnProceso.fecha_vencimiento || facturaEnProceso.fecha_estimada || new Date().toISOString().split('T')[0]
      const quincena = generarQuincenaSicore(fechaSicore)

      // 1. Cambiar estado a 'pagar' en BD
      await actualizarRegistro(guardadoPendienteCF.filaId, 'estado', guardadoPendienteCF.nuevoEstado, 'ARCA')

      // 2. Estampar datos SICORE en la FC (compat con v1) + descuento en la propia FC (paridad con el Modal)
      await supabase.schema('msa').from('comprobantes_arca')
        .update({ monto_a_abonar: montoAAbona, sicore: quincena, monto_sicore: montoRetencion, tipo_sicore: tipoSeleccionado?.tipo ?? null, descuento_aplicado: descuentoAdicional > 0 ? descuentoAdicional : null })
        .eq('id', guardadoPendienteCF.filaId)

      // 3. Registrar en SICORE v2 (sicore_retenciones) SOLO si hay retención real (paridad con el Modal).
      //    "Sin retención + descuento" no genera registro SICORE (solo estampa el descuento en la FC).
      if (tipoSeleccionado && montoRetencion > 0) {
        const totalPagado = Math.round((impTotalPesos - descuentoAdicional) * 100) / 100
        const fa = facturaEnProceso as any
        await registrarEnSicoreRetenciones('msa', {
          origen: colaLoteSicore.length > 0 ? 'agrupacion' : 'directo',
          quincena,
          fecha_pago: fechaSicore,
          factura_id: guardadoPendienteCF.filaId,
          fecha_emision: fa.fecha_emision ?? null,
          tipo_comprobante: fa.tipo_comprobante ?? null,
          punto_venta: fa.punto_venta ?? null,
          numero_desde: fa.numero_desde ?? null,
          cuit_emisor: facturaEnProceso.cuit_proveedor ?? null,
          denominacion_emisor: facturaEnProceso.nombre_proveedor ?? null,
          tipo_sicore: tipoSeleccionado.tipo,
          alicuota: tipoSeleccionado.porcentaje_retencion,
          neto_gravado_pagado: datosSicoreCalculo?.netoFactura ?? 0,
          total_pagado: totalPagado,
          descuento_aplicado: descuentoAdicional,
          minimo_no_imponible: datosSicoreCalculo?.minimoAplicado ?? 0,
          base_imponible: datosSicoreCalculo?.baseImponible ?? 0,
          retencion: montoRetencion,
          pago: Math.round((totalPagado - montoRetencion) * 100) / 100,
        })
      }

      // 4. ECHEQ: si el pago es con echeq (single o lote), estampar método/fecha de cobro + registrar el cheque (neto en ARS).
      //    El estado ya se escribió como 'echeq' (guardadoPendienteCF.nuevoEstado). saldoPesos = neto real a librar.
      const aplicaEcheq = !!echeqPendienteCF.current && (echeqLoteActivo.current || echeqFilaCF.current?.id === guardadoPendienteCF.filaId)
      if (aplicaEcheq) {
        const datos = echeqPendienteCF.current!
        await supabase.schema('msa').from('comprobantes_arca')
          .update({ metodo_pago: 'echeq', fecha_cobro_echeq: datos.fechaCobro, fecha_pago: datos.fechaEmision })
          .eq('id', guardadoPendienteCF.filaId)
        await guardarChequeFactura('msa', {
          id: guardadoPendienteCF.filaId,
          nombre_proveedor: facturaEnProceso.nombre_proveedor,
          cuit_proveedor: facturaEnProceso.cuit_proveedor,
        }, datos, saldoPesos, montoRetencion > 0 ? { quincena, monto: montoRetencion, tipo: tipoSeleccionado?.tipo ?? null } : null, descuentoAdicional)
        if (!echeqLoteActivo.current) { echeqPendienteCF.current = null; echeqFilaCF.current = null }
      }

      toast.success(
        tipoSeleccionado && montoRetencion > 0
          ? `✅ SICORE aplicado. Quincena: ${quincena} | Retención: $${montoRetencion.toLocaleString('es-AR')}`
          : `✅ Pago aplicado${descuentoAdicional > 0 ? ` con descuento $${descuentoAdicional.toLocaleString('es-AR')}` : ''} (sin retención)`
      )

      // Limpiar modal
      setMostrarModalSicore(false)
      setFacturaEnProceso(null)
      setTipoSeleccionado(null)
      setMontoRetencion(0)
      setDescuentoAdicional(0)
      setDescuentoDesglose(null)
      setDescuentoInputValor('')
      setGuardadoPendienteCF(null)
      setPasoSicore('tipo')

      // Procesar siguiente en cola (lote) o recargar
      const siguiente = colaLoteSicore[0]
      if (siguiente) {
        const resto = colaLoteSicore.slice(1)
        setColaLoteSicore(resto)
        const nextPending: PendingSicore = { filaId: siguiente.id, nuevoEstado: echeqLoteActivo.current ? 'echeq' : 'pagar', estadoAnterior: siguiente.estado }
        setGuardadoPendienteCF(nextPending)
        await evaluarRetencionSicoreCF(siguiente, nextPending, resto)
      } else {
        // Fin de cola: limpiar refs del echeq lote
        if (echeqLoteActivo.current) { echeqLoteActivo.current = false; echeqLoteFacturas.current = []; echeqPendienteCF.current = null }
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
      // Restaurar estado anterior en BD y limpiar cola entera (aborta también el echeq lote)
      await actualizarRegistro(pending.filaId, 'estado', pending.estadoAnterior, 'ARCA')
      setColaLoteSicore([])
      echeqLoteActivo.current = false; echeqLoteFacturas.current = []; echeqPendienteCF.current = null; echeqFilaCF.current = null
    } else if (pending && continuarSinSicore) {
      // Guardar el cambio de estado sin SICORE
      await actualizarRegistro(pending.filaId, 'estado', pending.nuevoEstado, 'ARCA')
      // ECHEQ sin retención (single o lote): estampar método/fecha de cobro + registrar el cheque por el total (imp_total ARS).
      const fila = echeqLoteActivo.current ? facturaEnProceso : echeqFilaCF.current
      const aplicaEcheq = !!echeqPendienteCF.current && !!fila && (echeqLoteActivo.current || fila.id === pending.filaId)
      if (aplicaEcheq && fila) {
        const datos = echeqPendienteCF.current!
        const tc = fila.tc_pago ?? fila.tipo_cambio ?? 1
        const neto = (fila.imp_total || 0) * tc
        await supabase.schema('msa').from('comprobantes_arca')
          .update({ metodo_pago: 'echeq', fecha_cobro_echeq: datos.fechaCobro, fecha_pago: datos.fechaEmision })
          .eq('id', pending.filaId)
        await guardarChequeFactura('msa', { id: pending.filaId, nombre_proveedor: fila.nombre_proveedor, cuit_proveedor: fila.cuit_proveedor }, datos, neto, null)
        if (!echeqLoteActivo.current) { echeqPendienteCF.current = null; echeqFilaCF.current = null }
      }
      if (cola.length === 0) toast.success('Estado cambiado sin retención SICORE')
    }
    setMostrarModalSicore(false)
    setFacturaEnProceso(null)
    setTipoSeleccionado(null)
    setMontoRetencion(0)
    setDescuentoAdicional(0)
    setDescuentoDesglose(null)
    setDescuentoInputValor('')
    setGuardadoPendienteCF(null)
    setPasoSicore('tipo')

    // Si hay más en cola (lote) y continuamos sin SICORE, avanzar
    if (continuarSinSicore && cola.length > 0) {
      const [siguiente, ...resto] = cola
      setColaLoteSicore(resto)
      const nextPending: PendingSicore = { filaId: siguiente.id, nuevoEstado: echeqLoteActivo.current ? 'echeq' : 'pagar', estadoAnterior: siguiente.estado }
      setGuardadoPendienteCF(nextPending)
      await evaluarRetencionSicoreCF(siguiente, nextPending, resto)
    } else {
      // Fin de cola: limpiar refs del echeq lote
      if (echeqLoteActivo.current) { echeqLoteActivo.current = false; echeqLoteFacturas.current = []; echeqPendienteCF.current = null }
      cargarDatos()
    }
  }

  // ECHEQ directo (la FC YA tiene SICORE aplicado, p.ej. saldo con anticipo): no recalcula nada,
  // solo registra el cheque por el saldo real (monto_a_abonar en ARS) + estado='echeq' + método/fecha de cobro.
  const registrarEcheqDirecto = async (facturaId: string, datos: EcheqDatos) => {
    const { data: fc } = await supabase.schema('msa').from('comprobantes_arca')
      .select('monto_a_abonar, imp_total, tc_pago, tipo_cambio, sicore, monto_sicore, tipo_sicore, denominacion_emisor, cuit')
      .eq('id', facturaId).single()
    if (!fc) return
    const tc = (fc.tc_pago as number) ?? (fc.tipo_cambio as number) ?? 1
    const neto = (((fc.monto_a_abonar as number) ?? (fc.imp_total as number) ?? 0)) * tc  // saldo real a librar (ARS)
    await supabase.schema('msa').from('comprobantes_arca')
      .update({ estado: 'echeq', metodo_pago: 'echeq', fecha_cobro_echeq: datos.fechaCobro, fecha_pago: datos.fechaEmision })
      .eq('id', facturaId)
    await guardarChequeFactura('msa', { id: facturaId, denominacion_emisor: fc.denominacion_emisor as string | null, cuit: fc.cuit as string | null },
      datos, neto, fc.sicore ? { quincena: fc.sicore as string, monto: (fc.monto_sicore as number) ?? null, tipo: (fc.tipo_sicore as string) ?? null } : null)
  }

  // Confirmar el modal ECHEQ → arranca el MISMO flujo SICORE que "pagar", con el pending en 'echeq'.
  // La retención se calcula igual; el cheque + método de pago se estampan al finalizar (finalize/cancelar).
  const confirmarEcheqCF = async () => {
    if (!echeqFormCF.banco || !echeqFormCF.fechaEmision || !echeqFormCF.fechaCobro) {
      toast.error('Completá banco, fecha de emisión y fecha de cobro.'); return
    }
    const datos: EcheqDatos = { ...echeqFormCF }
    echeqPendienteCF.current = datos
    setMostrarModalEcheqCF(false)

    // ECHEQ en LOTE: partir en las que YA tienen SICORE (echeq directo, sin recalcular) y las que no (flujo SICORE)
    if (echeqLoteActivo.current && echeqLoteFacturas.current.length > 0) {
      const yaSicore = echeqLoteFacturas.current.filter(f => !!f.sicore)
      const sinSicore = echeqLoteFacturas.current.filter(f => !f.sicore)
      for (const f of yaSicore) await registrarEcheqDirecto(f.id, datos)
      if (sinSicore.length === 0) {
        echeqLoteActivo.current = false; echeqLoteFacturas.current = []; echeqPendienteCF.current = null
        toast.success('ECHEQ registrado')
        await cargarDatos()
        return
      }
      // fecha_pago = emisión del echeq (define la quincena) para las que sí necesitan SICORE
      await supabase.schema('msa').from('comprobantes_arca')
        .update({ fecha_pago: datos.fechaEmision }).in('id', sinSicore.map(f => f.id))
      const conFecha = sinSicore.map(f => ({ ...f, fecha_pago: datos.fechaEmision }) as CashFlowRow)
      const [primera, ...resto] = conFecha
      setColaLoteSicore(resto)
      const pending: PendingSicore = { filaId: primera.id, nuevoEstado: 'echeq', estadoAnterior: primera.estado }
      setGuardadoPendienteCF(pending)
      await evaluarRetencionSicoreCF(primera, pending, resto)
      return
    }

    if (echeqOrigenCF === 'factura' && echeqFilaCF.current) {
      const fila = echeqFilaCF.current
      // Si la FC YA tiene SICORE aplicado (p.ej. saldo con anticipo vinculado) → echeq directo por el saldo, sin recalcular.
      if (fila.sicore) {
        await registrarEcheqDirecto(fila.id, datos)
        echeqPendienteCF.current = null; echeqFilaCF.current = null
        toast.success('ECHEQ registrado')
        await cargarDatos()
        return
      }
      // Sin SICORE: la quincena sale de la fecha de emisión del echeq → setear fecha_pago = fechaEmisión
      const filaF = { ...fila, fecha_pago: datos.fechaEmision } as CashFlowRow
      echeqFilaCF.current = filaF
      await supabase.schema('msa').from('comprobantes_arca').update({ fecha_pago: datos.fechaEmision }).eq('id', filaF.id)
      const pending: PendingSicore = { filaId: filaF.id, nuevoEstado: 'echeq', estadoAnterior: filaF.estado }
      setGuardadoPendienteCF(pending)
      await evaluarRetencionSicoreCF(filaF, pending, [])
    } else if (echeqOrigenCF === 'anticipo' && echeqAnticipoCF.current) {
      // Anticipo: fecha del echeq manda la quincena. Reutiliza el flujo SICORE de anticipos.
      const ant = echeqAnticipoCF.current
      await supabase.from('anticipos_proveedores').update({ fecha_pago: datos.fechaEmision }).eq('id', ant.id)
      await cambiarEstadoPagoAnticipo(ant.id, 'pagar', true)   // esEcheq = true
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
    const quincena = generarQuincenaSicore(anticipoSicoreFecha || new Date().toISOString())

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
    const quincena = generarQuincenaSicore(anticipoSicoreFecha || new Date().toISOString())
    const anticipo = anticiposExistentes.find(a => a.id === anticipoSicoreId)
    const saldoFinal = (anticipo?.monto || 0) - montoSicoreAnticipo - descuentoSicoreAnticipo
    // Si el pago del anticipo es con ECHEQ, cierra en estado 'echeq' + registra el cheque (neto)
    const esEcheq = !!(echeqPendienteCF.current && echeqAnticipoCF.current?.id === anticipoSicoreId)
    const { error } = await supabase.from('anticipos_proveedores').update({
      estado_pago: esEcheq ? 'echeq' : 'pagar',
      sicore: quincena,
      monto_sicore: montoSicoreAnticipo,
      tipo_sicore: tipoSicoreAnticipo.tipo,
      monto_restante: saldoFinal,
      ...(esEcheq ? { metodo_pago: 'echeq', fecha_cobro_echeq: echeqPendienteCF.current!.fechaCobro, fecha_pago: echeqPendienteCF.current!.fechaEmision } : {}),
    }).eq('id', anticipoSicoreId)

    if (error) { toast.error('Error guardando SICORE: ' + error.message); return }
    if (esEcheq && anticipo) {
      await guardarChequeAnticipo('msa', { id: anticipo.id, nombre_proveedor: anticipo.nombre_proveedor, cuit_proveedor: anticipo.cuit_proveedor }, echeqPendienteCF.current!, saldoFinal, { quincena, monto: montoSicoreAnticipo, tipo: tipoSicoreAnticipo.tipo })
      echeqPendienteCF.current = null
      echeqAnticipoCF.current = null
    }
    toast.success(`Retención SICORE aplicada: $${montoSicoreAnticipo.toLocaleString('es-AR', { minimumFractionDigits: 2 })} — Quincena ${quincena}${esEcheq ? ' (echeq)' : ''}`)
    cerrarModalSicoreAnticipo()
    await cargarAnticiposExistentes()
    await cargarDatos()
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

    // La empresa se elige. Puede quedar vacía, pero con confirmación explícita: un anticipo sin
    // empresa NO es "es de MSA", es "todavía no se sabe" — y así se ve en el Cash Flow, con `—`
    // y visible en cualquier filtro hasta que se resuelva. A-FEAT-13.
    if (!nuevoAnticipo.empresa) {
      const seguir = window.confirm(
        '⚠️ No elegiste de qué empresa sale este anticipo.\n\n' +
        'Puede quedar sin empresa: eso significa "no se sabe todavía", y se va a resolver cuando ' +
        'vincules el anticipo con su factura.\n\n' +
        '¿Guardarlo sin empresa?'
      )
      if (!seguir) return
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
          estado: 'pendiente_vincular',
          estado_pago: nuevoAnticipo.estado_pago,
          nro_cuenta: nuevoAnticipo.nro_cuenta || null,
          empresa: nuevoAnticipo.empresa,   // null = no se sabe (confirmado arriba)
        })
        .select('id')

      if (error) throw error

      // Capturar datos del anticipo recién creado (antes de resetear el form)
      const esPago = nuevoAnticipo.tipo === 'pago'
      const cuitLimpio = nuevoAnticipo.cuit.replace(/-/g, '')
      const anticipoNuevo: AnticipoVinculable | null = data?.[0]?.id ? {
        id: data[0].id,
        nombre_proveedor: nuevoAnticipo.nombre,
        cuit_proveedor: cuitLimpio,
        monto,
        monto_sicore: null,
        descuento_aplicado: null,
        sicore: null,
        tipo_sicore: null,
        fecha_pago: nuevoAnticipo.fecha,
        factura_id: null,
        descripcion: nuevoAnticipo.descripcion || null,
        nro_cuenta: nuevoAnticipo.nro_cuenta || null,
      } : null

      const tipoLabel = nuevoAnticipo.tipo === 'cobro' ? 'Anticipo de Cobro' : 'Anticipo'
      toast.success(`${tipoLabel} registrado con estado "${nuevoAnticipo.estado_pago}".`)

      setNuevoAnticipo({ tipo: 'pago', cuit: '', nombre: '', monto: '', fecha: '', descripcion: '', estado_pago: 'pagado', nro_cuenta: null, categ: null, empresa: null })
      await cargarDatos()
      await cargarAnticiposExistentes()

      // Auto-ofrecer vinculación si hay facturas pendientes del mismo CUIT.
      // Vale para las DOS puntas: un anticipo de pago busca facturas de compra y uno de cobro
      // busca facturas de venta. Antes sólo se ofrecía para `pago` y los de cobro quedaban
      // colgados en "pendiente_vincular" sin que nada los reclamara.
      if (anticipoNuevo) {
        const tipoAnt = esPago ? 'pago' : 'cobro'
        const candidatos = await buscarFacturasCandidatas(cuitLimpio, tipoAnt)
        if (candidatos.length > 0) {
          const ok = window.confirm(
            `Se encontraron ${candidatos.length} factura(s) pendiente(s) de ${anticipoNuevo.nombre_proveedor}.\n\n¿Querés vincular este ${esPago ? 'anticipo' : 'cobro'} a una factura ahora?`
          )
          if (ok) {
            setModalAnticipo(false)
            await vincAnticipo.abrirVinculacion(anticipoNuevo, candidatos)
          }
        }
      }
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

  // Vincular un anticipo ya existente a una factura (desde la pestaña "Anticipos Existentes")
  const vincularDesdeExistente = async (a: any) => {
    const candidatos = await buscarFacturasCandidatas(a.cuit_proveedor, a.tipo === 'cobro' ? 'cobro' : 'pago')
    if (candidatos.length === 0) {
      toast.info(a.tipo === 'cobro'
        ? `No hay facturas de venta pendientes de cobro de ${a.nombre_proveedor}`
        : `No hay facturas pendientes de ${a.nombre_proveedor}`)
      return
    }
    setModalAnticipo(false)
    await vincAnticipo.abrirVinculacion(a as AnticipoVinculable, candidatos)
  }

  // Actualizar cuenta contable de un anticipo
  const actualizarCuentaAnticipo = async (anticipoId: string, nroCuenta: string | null) => {
    try {
      const { error } = await supabase
        .from('anticipos_proveedores')
        .update({ nro_cuenta: nroCuenta })
        .eq('id', anticipoId)
      if (error) throw error
      toast.success(nroCuenta ? 'Cuenta contable actualizada' : 'Cuenta contable removida')
      setEditandoCuentaAnticipoId(null)
      await cargarAnticiposExistentes()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    }
  }

  // Revertir un anticipo marcado como 'externo' a 'pendiente_vincular'
  const revertirAnticipoExterno = async (a: any) => {
    if (!window.confirm(`¿Volver el anticipo de ${a.nombre_proveedor} a "pendiente de vincular"?\n\nSe usa cuando lo marcaste como externo por error.`)) return
    try {
      const { error } = await supabase
        .from('anticipos_proveedores')
        .update({ estado: 'pendiente_vincular' })
        .eq('id', a.id)
      if (error) throw error
      toast.success('Anticipo revertido a pendiente de vincular')
      await cargarAnticiposExistentes()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    }
  }

  // Estampa el echeq en un anticipo ya con SICORE resuelto: estado='echeq' + método/fechas + registra cheque (neto).
  const finalizarEcheqAnticipo = async (anticipo: any, saldoNeto: number, sicore: { quincena: string | null; monto: number | null; tipo: string | null } | null) => {
    const datos = echeqPendienteCF.current
    if (!datos) return
    await supabase.from('anticipos_proveedores')
      .update({ estado_pago: 'echeq', metodo_pago: 'echeq', fecha_cobro_echeq: datos.fechaCobro, fecha_pago: datos.fechaEmision, monto_restante: saldoNeto })
      .eq('id', anticipo.id)
    await guardarChequeAnticipo('msa', { id: anticipo.id, nombre_proveedor: anticipo.nombre_proveedor, cuit_proveedor: anticipo.cuit_proveedor }, datos, saldoNeto, sicore)
    echeqPendienteCF.current = null
    echeqAnticipoCF.current = null
  }

  const cambiarEstadoPagoAnticipo = async (anticipoId: string, nuevoEstado: string, esEcheq = false) => {
    // Obtener el anticipo completo para saber si tiene SICORE
    const anticipo = anticiposExistentes.find(a => a.id === anticipoId)

    // Intercept ECHEQ desde la UI → abrir modal (banco/número/fechas); el resto lo hace confirmarEcheqCF.
    if (nuevoEstado === 'echeq' && !esEcheq) {
      if (!anticipo) return
      echeqAnticipoCF.current = anticipo
      echeqFilaCF.current = null
      setEcheqOrigenCF('anticipo')
      setEcheqFormCF({ banco: '', numero: '', fechaEmision: anticipo.fecha_pago || new Date().toISOString().split('T')[0], fechaCobro: '' })
      setMostrarModalEcheqCF(true)
      return
    }

    // esEcheq viene con nuevoEstado='pagar' (pasa por el flujo SICORE, cierra en 'echeq')
    if (nuevoEstado === 'pagar') {
      if (anticipo?.sicore && anticipo?.monto_sicore) {
        // Ya tiene SICORE: actualizar estado + recalcular saldo
        const saldo = (anticipo.monto || 0) - (anticipo.monto_sicore || 0)
        if (esEcheq) {
          await finalizarEcheqAnticipo(anticipo, saldo, { quincena: anticipo.sicore, monto: anticipo.monto_sicore, tipo: anticipo.tipo_sicore })
          toast.success('Anticipo → echeq (SICORE ya aplicado)')
        } else {
          const { error } = await supabase.from('anticipos_proveedores')
            .update({ estado_pago: 'pagar', monto_restante: saldo }).eq('id', anticipoId)
          if (error) { toast.error('Error: ' + error.message); return }
          toast.success('Anticipo → pagar (SICORE ya aplicado)')
        }
      } else if (anticipo) {
        // Sin SICORE: abrir modal (si es echeq, el ref echeqAnticipoCF/echeqPendienteCF persiste → confirmarSicoreAnticipo cierra en echeq)
        setAnticipoSicoreId(anticipo.id)
        setAnticipoSicoreCuit(anticipo.cuit_proveedor)
        setAnticipoSicoreFecha(esEcheq && echeqPendienteCF.current ? echeqPendienteCF.current.fechaEmision : anticipo.fecha_pago)
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

    // Empresa: no se edita acá (sale de dónde vive la factura o del responsable del template).
    // Se muestran TODAS las que tiene, incluidas las que no son empresa (`Duhau`): esconder una
    // sería perder el dato. Cada empresa con su color, para distinguirlas sin leer.
    if (columna.type === 'empresas') {
      const empresas = (fila.empresas || [])
      return (
        <div className={`${columna.width} flex flex-wrap items-center gap-0.5`}>
          {empresas.length === 0 ? (
            <span className="text-xs text-gray-300">—</span>
          ) : empresas.map(e => (
            <span
              key={e}
              className={`rounded border px-1 text-[10px] leading-4 ${
                COLOR_EMPRESA[e as Empresa] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
              title={COLOR_EMPRESA[e as Empresa] ? `Empresa ${e}` : `${e} — no es una empresa: se muestra pero no filtra`}
            >
              {e}
            </span>
          ))}
        </div>
      )
    }

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
            ) : columna.key === 'centro_costo' ? (
              <CentroCostoCombobox
                value={String(hookEditor.celdaEnEdicion?.valor || '')}
                onValueChange={(v) => hookEditor.guardarCambio(v)}
                autoFocus
                disabled={hookEditor.guardandoCambio}
                className="h-6 text-xs w-full"
              />
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
          // Badge ECHEQ en columna nombre_proveedor (distintivo visual claro)
          if (columna.key === 'nombre_proveedor' && fila.estado === 'echeq') {
            return (
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-600 text-white shrink-0" title="Pago con ECHEQ">📝 ECHEQ</span>
                <span className="truncate" title={valor as string}>{(valor as string) || '-'}</span>
              </div>
            )
          }
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
          // Fila-grupo: ✕ para deshacer el grupo (en la columna Detalle)
          if (columna.key === 'detalle' && (fila.facturas_agrupadas ?? 0) > 1 && fila.grupo_pago_id) {
            return (
              <div className="flex items-center gap-1">
                <button
                  title="Deshacer grupo (vuelven a ser individuales)"
                  className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded px-1 text-xs font-bold leading-none"
                  onClick={(e) => { e.stopPropagation(); desagruparFilaGrupo(fila) }}
                >✕</button>
                <span className="truncate" title={valor as string}>🔗 {(valor as string) || '-'}</span>
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
          {/* Empresa — SIEMPRE visible: es el contexto de lo que estás mirando, no un criterio
              de búsqueda. Son dos selecciones porque los defaults difieren (A-FEAT-13). */}
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-gray-50 px-3 py-2">
            <SelectorEmpresas
              titulo="Facturas"
              seleccionadas={empresasFacturas}
              onCambio={setEmpresasFacturas}
              ayuda="Las facturas de MA las paga MA de su propia cuenta, por eso vienen apagadas."
            />
            <div className="h-6 w-px bg-gray-300" />
            <SelectorEmpresas
              titulo="Templates y demás"
              seleccionadas={empresasTemplates}
              onCambio={setEmpresasTemplates}
              ayuda="Impuestos y servicios: los pagás vos, por eso se ven los de las tres."
            />
            <span className="text-[11px] text-gray-500">
              Una fila de varias empresas (ej. <strong>MSA/PAM</strong>) aparece en cualquiera de ellas.
            </span>
          </div>

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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generarPDFPagosSeleccionados}
                      className="text-xs border-green-500 text-green-700 hover:bg-green-50"
                      disabled={filasSeleccionadas.size === 0}
                    >
                      📄 Detalle PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={encolarMailsSeleccionados}
                      className="text-xs border-indigo-500 text-indigo-700 hover:bg-indigo-50"
                      disabled={filasSeleccionadas.size === 0}
                    >
                      ✉ Encolar mail detalle
                    </Button>
                    <PanelMailsPago />
                    <Button
                      size="sm"
                      onClick={exportarLoteSeleccionados}
                      className="text-xs bg-blue-600 hover:bg-blue-700"
                      disabled={filasSeleccionadas.size === 0}
                    >
                      🏦 Exportar lote Galicia
                    </Button>
                    {/* Un solo grupo seleccionado → el mismo botón deshace. Ver filaGrupoSeleccionada. */}
                    {filaGrupoSeleccionada ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => desagruparFilaGrupo(filaGrupoSeleccionada)}
                        className="text-xs border-red-500 text-red-700 hover:bg-red-50"
                        title={`Deshacer el grupo de ${filaGrupoSeleccionada.facturas_agrupadas} comprobantes`}
                      >
                        ✕ Desagrupar ({filaGrupoSeleccionada.facturas_agrupadas})
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={agruparSeleccionados}
                        className="text-xs border-purple-500 text-purple-700 hover:bg-purple-50"
                        disabled={filasSeleccionadas.size < 2}
                        title="Seleccioná 2 o más filas del mismo proveedor"
                      >
                        🔗 Agrupar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Filtro por origen: ahora está en la barra de chips (siempre visible), arriba de la tabla. */}

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

          {/* E1: barra de chips operativos (siempre visible) — Estado + Origen */}
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 p-3 bg-white rounded-lg border">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-600 mr-1">Estado:</span>
              {estadosDisponibles.map(e => (
                <button
                  key={e}
                  onClick={(ev) => toggleChip(setChipsEstados, e, ev.ctrlKey || ev.metaKey)}
                  title={`Click: prender/apagar «${e}» · Ctrl+click: ver SÓLO «${e}»`}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${chipsEstados.has(e) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-400 border-gray-300'}`}
                >
                  {e} ({data.filter(f => f.estado === e).length})
                </button>
              ))}
              <button onClick={() => setChipsEstados(new Set(estadosDisponibles))} className="text-[10px] underline text-gray-400 ml-1">todos</button>
              <button onClick={() => setChipsEstados(new Set())} className="text-[10px] underline text-gray-400">ninguno</button>
              <span className="ml-1 text-[10px] text-gray-400" title="Sirve en los chips de Estado y de Origen">ctrl+click = sólo ése</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-600 mr-1">Origen:</span>
              {origenesDisponibles.map(o => (
                <button
                  key={o}
                  onClick={(ev) => toggleChip(setChipsOrigenes, o, ev.ctrlKey || ev.metaKey)}
                  title={`Click: prender/apagar «${o}» · Ctrl+click: ver SÓLO «${o}»`}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${chipsOrigenes.has(o) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-400 border-gray-300'}`}
                >
                  {o} ({data.filter(f => f.origen === o).length})
                </button>
              ))}
              <button onClick={() => setChipsOrigenes(new Set(origenesDisponibles))} className="text-[10px] underline text-gray-400 ml-1">todos</button>
              <button onClick={() => setChipsOrigenes(new Set())} className="text-[10px] underline text-gray-400">ninguno</button>
            </div>
            <label className="flex items-center gap-1 text-xs text-gray-500 ml-auto cursor-pointer" title="Los débitos automáticos anteriores a hoy se asumen pagados y se ocultan">
              <input type="checkbox" checked={verDebitosVencidos} onChange={e => setVerDebitosVencidos(e.target.checked)} />
              ver débitos vencidos
            </label>
            <button onClick={verTodo} className="text-xs px-2.5 py-0.5 rounded border bg-gray-100 hover:bg-gray-200 text-gray-700">Ver todo</button>
          </div>

          {/* E2.1: barra de subtotales (respeta chips/filtros) */}
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 p-3 bg-slate-50 rounded-lg border text-sm">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-gray-500">{subtotales.cantidad} filas</span>
              <span>Débitos: <b className="text-red-700">${fmtMonto(subtotales.totalDebitos)}</b></span>
              <span>Créditos: <b className="text-green-700">${fmtMonto(subtotales.totalCreditos)}</b></span>
              <span>Neto: <b className={subtotales.neto >= 0 ? 'text-green-700' : 'text-red-700'}>${fmtMonto(subtotales.neto)}</b></span>
            </div>
            {subtotales.porEstado.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <span className="text-xs font-semibold text-gray-500">por estado:</span>
                {subtotales.porEstado.map(s => (
                  <span key={s.clave} className="text-xs bg-white border rounded px-2 py-0.5">
                    {s.clave}: <b>${fmtMonto(s.debitos + s.creditos)}</b> ({s.cantidad})
                  </span>
                ))}
              </div>
            )}
          </div>

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
                  {(modoPagos ? datosFiltradosPagos : datosOperativos).length === 0 ? (
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
                    (modoPagos ? datosFiltradosPagos : datosOperativos).map((fila, index) => {
                      const esUSD = fila.origen === 'ARCA' && (fila.moneda === 'USD' || (fila.tipo_cambio ?? 1) > 1.01)
                      return (
                      <tr
                        key={fila.id}
                        className={`group hover:bg-gray-50 ${
                          filasSeleccionadas.has(fila.id) ? 'bg-blue-50' :
                          fila.estado === 'echeq' ? 'bg-emerald-100 border-l-4 border-emerald-500' :
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
          {pasoModal === 'seleccionar' && (() => {
            const matchTemplate = (t: typeof templatesAbiertos[number]) => {
              if (!busquedaTemplatesPM.trim()) return true
              const q = normalizarBusqueda(busquedaTemplatesPM)
              const texto = normalizarBusqueda(
                `${t.nombre_referencia} ${t.categ || ''} ${t.cuenta_agrupadora || ''} ${t.responsable || ''}`
              )
              return texto.includes(q)
            }
            const templatesUso = templatesAbiertos.filter(t => !t.solo_conciliacion && matchTemplate(t))
            const templatesBancarios = templatesAbiertos.filter(t => t.solo_conciliacion && matchTemplate(t))
            return (
              <div className="py-4 space-y-3">
                <Input
                  placeholder="Buscar por nombre, categ, agrupadora o responsable..."
                  value={busquedaTemplatesPM}
                  onChange={(e) => setBusquedaTemplatesPM(e.target.value)}
                  className="text-sm"
                  autoFocus
                />
                {templatesUso.length === 0 ? (
                  <div className="text-center text-gray-500 py-6">
                    <p>{busquedaTemplatesPM.trim() ? 'Sin resultados para la búsqueda.' : 'No hay templates disponibles.'}</p>
                    {!busquedaTemplatesPM.trim() && <p className="text-xs mt-2">Cree un template con tipo "abierto" primero.</p>}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto">
                    {templatesUso.map(template => (
                      <div
                        key={template.id}
                        onClick={async () => {
                          setTemplateSeleccionado(template.id)
                          if (template.es_multi_cuenta) {
                            const { data } = await supabase
                              .from('cuotas_egresos_sin_factura')
                              .select('categ')
                              .eq('egreso_id', template.id)
                              .not('categ', 'is', null)
                            const unicas = [...new Set((data || []).map((r: any) => r.categ).filter(Boolean))]
                            setSubcategsDisponiblesCF(unicas as string[])
                          } else {
                            setSubcategsDisponiblesCF([])
                          }
                        }}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors relative group ${
                          templateSeleccionado === template.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                        }`}
                      >
                        {template.cuenta_agrupadora && (
                          <div className="text-xs text-gray-400 mb-0.5">{template.cuenta_agrupadora}</div>
                        )}
                        <div className="font-medium pr-6">{template.nombre_referencia}</div>
                        <div className="text-xs text-gray-500">
                          {template.categ}
                          {template.responsable && <span className="ml-2 text-blue-600">• {template.responsable}</span>}
                        </div>
                        <button
                          type="button"
                          disabled={togglingSoloConciliacion === template.id}
                          onClick={(e) => { e.stopPropagation(); toggleSoloConciliacion(template.id, template.solo_conciliacion) }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-gray-600 transition-opacity disabled:opacity-30"
                          title="Mover a solo conciliación"
                        >
                          {togglingSoloConciliacion === template.id ? '...' : '↓'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sección bancarios / motor */}
                {templatesBancarios.length > 0 && (
                  <div className="border-t pt-2">
                    <button
                      type="button"
                      onClick={() => setMostrarBancarios(p => !p)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 w-full"
                    >
                      <span>{mostrarBancarios ? '▾' : '▸'}</span>
                      <span>Solo conciliación bancaria ({templatesBancarios.length})</span>
                    </button>
                    {mostrarBancarios && (
                      <div className="mt-2 space-y-1 max-h-[180px] overflow-y-auto">
                        {templatesBancarios.map(template => (
                          <div key={template.id} className="flex items-center justify-between px-3 py-2 border border-gray-100 rounded-lg bg-gray-50">
                            <div>
                              {template.cuenta_agrupadora && (
                                <div className="text-xs text-gray-400">{template.cuenta_agrupadora}</div>
                              )}
                              <div className="text-sm text-gray-600">{template.nombre_referencia}</div>
                            </div>
                            <button
                              type="button"
                              disabled={togglingSoloConciliacion === template.id}
                              onClick={() => toggleSoloConciliacion(template.id, template.solo_conciliacion)}
                              className="ml-3 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-white transition-colors disabled:opacity-50"
                              title="Mover a lista principal"
                            >
                              {togglingSoloConciliacion === template.id ? '...' : '↑ Habilitar'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

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

              {/* Categ por cuota: solo para templates multi-cuenta */}
              {(() => {
                const template = templatesAbiertos.find(t => t.id === templateSeleccionado)
                if (template?.es_multi_cuenta) {
                  return (
                    <div className="space-y-2">
                      <Label htmlFor="categ-pago-cf">
                        Sub-categoría
                        <span className="ml-1 text-xs text-gray-400">(opcional — se puede asignar después)</span>
                      </Label>
                      {/* Texto libre */}
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400 mb-1"
                        placeholder="Escribir nombre o elegir abajo..."
                        value={nuevaCuota.categ}
                        onChange={(e) => setNuevaCuota(prev => ({ ...prev, categ: e.target.value }))}
                      />
                      {/* Sub-categorías ya usadas */}
                      {subcategsDisponiblesCF.length > 0 && (
                        <div className="mb-1">
                          <div className="text-[10px] text-green-700 font-semibold mb-0.5">Usadas en este template:</div>
                          <div className="flex flex-wrap gap-1">
                            {subcategsDisponiblesCF.map(s => (
                              <button
                                key={s}
                                type="button"
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${nuevaCuota.categ === s ? 'bg-green-100 border-green-400 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                onClick={() => setNuevaCuota(prev => ({ ...prev, categ: s }))}
                              >{s}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Templates existentes — colapsado hasta que el usuario escriba (no auto-desplegar) */}
                      {(() => {
                        if (!nuevaCuota.categ.trim()) return null
                        const filtrados = templatesAbiertos
                          .filter(t => t.id !== templateSeleccionado && t.nombre_referencia)
                          .filter(t => t.nombre_referencia.toLowerCase().includes(nuevaCuota.categ.toLowerCase()) || (t.cuenta_agrupadora || '').toLowerCase().includes(nuevaCuota.categ.toLowerCase()))
                        if (filtrados.length === 0) return null
                        const grupos = new Map<string, typeof filtrados>()
                        filtrados.forEach(t => {
                          const g = t.cuenta_agrupadora || 'Sin grupo'
                          if (!grupos.has(g)) grupos.set(g, [])
                          grupos.get(g)!.push(t)
                        })
                        return (
                          <div className="mb-1">
                            <div className="text-[10px] text-blue-600 font-semibold mb-0.5">Templates:</div>
                            <div className="max-h-40 overflow-y-auto border rounded bg-white">
                              {Array.from(grupos.entries()).map(([grupo, items]) => (
                                <div key={grupo}>
                                  <div className="px-2 py-0.5 text-[10px] font-semibold text-gray-400 bg-gray-50 sticky top-0">{grupo}</div>
                                  {items.map(t => (
                                    <button
                                      key={t.id}
                                      type="button"
                                      className={`w-full text-left px-2 py-1 text-xs hover:bg-blue-50 ${nuevaCuota.categ === t.nombre_referencia ? 'bg-blue-50 font-semibold text-blue-700' : ''}`}
                                      onClick={() => setNuevaCuota(prev => ({ ...prev, categ: t.nombre_referencia }))}
                                    >
                                      {t.nombre_referencia}
                                      {t.responsable && <span className="ml-1 text-[10px] text-gray-400">· {t.responsable}</span>}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                      {/* Plan de cuentas contables */}
                      <div className="text-[10px] text-gray-500 font-semibold mb-0.5">Cuentas contables:</div>
                      <SelectorCuentaContable
                        value={nuevaCuota.categ}
                        onSelect={(cuenta) => setNuevaCuota(prev => ({ ...prev, categ: cuenta?.categ || '' }))}
                        autoFocus={false}
                        mostrarSinAsignar={false}
                      />
                    </div>
                  )
                }
                return null
              })()}

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

              {/* Estado al crear la cuota */}
              <div className="space-y-2">
                <Label htmlFor="estado-pago-cf">Estado</Label>
                <Select
                  value={nuevaCuota.estado}
                  onValueChange={(v) => setNuevaCuota(prev => ({ ...prev, estado: v }))}
                >
                  <SelectTrigger id="estado-pago-cf">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagar">Pagar</SelectItem>
                    <SelectItem value="preparado">Preparado</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="echeq">ECHEQ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

                {/* De qué empresa sale. Sin default: se elige. Puede quedar vacío, pero al
                    guardar pide confirmación — vacío significa "no se sabe", no "es de MSA". */}
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {EMPRESAS.map(e => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setNuevoAnticipo(prev => ({ ...prev, empresa: prev.empresa === e ? null : e }))}
                        className={`rounded border px-3 py-1 text-sm transition-colors ${
                          nuevoAnticipo.empresa === e ? COLOR_EMPRESA[e] : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-100'}`}
                      >
                        {e}
                      </button>
                    ))}
                    {!nuevoAnticipo.empresa && (
                      <span className="text-xs text-amber-700">
                        sin elegir — se puede guardar así, pero queda como “no se sabe”
                      </span>
                    )}
                  </div>
                </div>

                <ProveedorCombobox
                  label={nuevoAnticipo.tipo === 'cobro' ? 'Cliente' : 'Proveedor'}
                  required
                  value={{ cuit: nuevoAnticipo.cuit, nombre: nuevoAnticipo.nombre }}
                  onChange={(sel) => setNuevoAnticipo(prev => ({ ...prev, cuit: sel.cuit, nombre: sel.nombre }))}
                />

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

                <div className="space-y-2">
                  <Label>Cuenta contable (opcional)</Label>
                  <SelectorCuentaContable
                    value={nuevoAnticipo.categ}
                    onSelect={(cuenta) => setNuevoAnticipo(prev => ({
                      ...prev,
                      categ: cuenta?.categ || null,
                      nro_cuenta: cuenta?.nro_cuenta || null,
                    }))}
                    cuitProveedor={nuevoAnticipo.cuit || null}
                    autoFocus={false}
                    mostrarSinAsignar={true}
                    placeholder="Sin cuenta — se hereda de la FC al vincular"
                  />
                  <p className="text-xs text-gray-500">
                    Si lo dejás sin cuenta, al vincular a una FC el anticipo hereda la cuenta de la FC.
                    Si lo cargás con cuenta y la FC no tiene, la FC la hereda del anticipo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={nuevoAnticipo.estado_pago}
                    onValueChange={(v) => setNuevoAnticipo(prev => ({ ...prev, estado_pago: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pagado">pagado</SelectItem>
                      <SelectItem value="pagar">pagar</SelectItem>
                      <SelectItem value="preparado">preparado</SelectItem>
                      <SelectItem value="pendiente">pendiente</SelectItem>
                    </SelectContent>
                  </Select>
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
                ) : (() => {
                  const externosCount = anticiposExistentes.filter(a => a.estado === 'externo').length
                  const visibles = mostrarAnticiposExternos
                    ? anticiposExistentes
                    : anticiposExistentes.filter(a => a.estado !== 'externo')
                  return (
                  <div className="overflow-x-auto">
                    <div className="flex items-center justify-end mb-2 gap-2 text-xs">
                      <label className="flex items-center gap-1 cursor-pointer text-gray-600 select-none">
                        <input
                          type="checkbox"
                          checked={mostrarAnticiposExternos}
                          onChange={(e) => setMostrarAnticiposExternos(e.target.checked)}
                          className="rounded"
                        />
                        Mostrar externos {externosCount > 0 && <span className="text-gray-500">({externosCount})</span>}
                      </label>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-2 py-2 text-left">Fecha</th>
                          <th className="px-2 py-2 text-left">Tipo</th>
                          <th className="px-2 py-2 text-left">Proveedor</th>
                          <th className="px-2 py-2 text-left">CUIT</th>
                          <th className="px-2 py-2 text-left">Cuenta</th>
                          <th className="px-2 py-2 text-right">Monto</th>
                          <th className="px-2 py-2 text-right">Restante</th>
                          <th className="px-2 py-2 text-center">Pago</th>
                          <th className="px-2 py-2 text-center">Vinculación</th>
                          <th className="px-2 py-2 text-left">Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibles.map((a) => (
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
                            <td className="px-2 py-2 text-xs min-w-[160px]">
                              {editandoCuentaAnticipoId === a.id ? (
                                <SelectorCuentaContable
                                  value={null}
                                  onSelect={(cuenta) => actualizarCuentaAnticipo(a.id, cuenta?.nro_cuenta || null)}
                                  onCancel={() => setEditandoCuentaAnticipoId(null)}
                                  cuitProveedor={a.cuit_proveedor}
                                  autoFocus={true}
                                  mostrarSinAsignar={true}
                                  placeholder="Buscar cuenta..."
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditandoCuentaAnticipoId(a.id)}
                                  className="text-left hover:bg-gray-100 px-1 py-0.5 rounded w-full"
                                  title="Click para editar cuenta contable"
                                >
                                  {a.nro_cuenta || <span className="text-gray-400 italic">— sin cuenta —</span>}
                                </button>
                              )}
                            </td>
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
                              <div className="flex items-center justify-center gap-1">
                                <Badge variant="outline" className={
                                  a.estado === 'vinculado' ? 'bg-green-50 text-green-700' :
                                  a.estado === 'parcial' ? 'bg-blue-50 text-blue-700' :
                                  a.estado === 'externo' ? 'bg-gray-100 text-gray-700' :
                                  'bg-yellow-50 text-yellow-700'
                                }>
                                  {a.estado === 'vinculado' ? 'Vinculado' :
                                   a.estado === 'parcial' ? 'Parcial' :
                                   a.estado === 'externo' ? 'Externo' : 'Pendiente'}
                                </Badge>
                                {/* También para `cobro`: se vincula contra facturas de VENTA.
                                    Antes la condición era `a.tipo === 'pago'` y los anticipos de
                                    cobro no tenían botón, así que no había forma de imputarlos. */}
                                {a.estado !== 'vinculado' && a.estado !== 'externo' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                                    onClick={() => vincularDesdeExistente(a)}
                                  >
                                    <Link2 className="h-3 w-3 mr-0.5" />Vincular
                                  </Button>
                                )}
                                {a.estado === 'externo' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2 text-gray-600 border-gray-200 hover:bg-gray-50"
                                    onClick={() => revertirAnticipoExterno(a)}
                                    title="Volver a pendiente de vincular"
                                  >
                                    ↩ Revertir
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-xs text-gray-600 max-w-[200px] truncate">
                              {a.descripcion || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )
                })()}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Wizard vinculación anticipo → factura (compartido con Vista Principal) */}
      <ModalVinculacionAnticipo controller={vincAnticipo} />

      {/* Modal ECHEQ (facturas y anticipos) — paridad con el Modal de Pagos */}
      <Dialog open={mostrarModalEcheqCF} onOpenChange={(open) => { if (!open) { setMostrarModalEcheqCF(false); echeqPendienteCF.current = null; echeqFilaCF.current = null; echeqAnticipoCF.current = null; echeqLoteActivo.current = false; echeqLoteFacturas.current = []} }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>📝 Pago con ECHEQ</DialogTitle>
            <DialogDescription>Completar datos del cheque electrónico ({echeqOrigenCF === 'anticipo' ? 'anticipo' : 'factura'})</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium block mb-1">Banco emisor *</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={echeqFormCF.banco} onChange={e => setEcheqFormCF(prev => ({ ...prev, banco: e.target.value }))}>
                <option value="">Seleccionar banco...</option>
                {['Banco Galicia', 'Banco Santander', 'Banco Nación', 'Banco Provincia', 'BBVA', 'Banco HSBC', 'Banco Macro', 'Banco ICBC', 'Banco Ciudad', 'Banco Comafi', 'Banco Supervielle', 'Banco Patagonia', 'Banco Credicoop', 'Banco Industrial', 'Otro'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Número de ECHEQ</label>
              <input type="text" className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Ej: 000012345" value={echeqFormCF.numero} onChange={e => setEcheqFormCF(prev => ({ ...prev, numero: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Fecha de emisión *</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={echeqFormCF.fechaEmision} onChange={e => setEcheqFormCF(prev => ({ ...prev, fechaEmision: e.target.value }))} />
              {echeqFormCF.fechaEmision && (
                <p className="text-xs text-blue-600 mt-1">→ Quincena SICORE: {generarQuincenaSicore(echeqFormCF.fechaEmision)}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Fecha de cobro *</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={echeqFormCF.fechaCobro} onChange={e => setEcheqFormCF(prev => ({ ...prev, fechaCobro: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setMostrarModalEcheqCF(false); echeqPendienteCF.current = null; echeqFilaCF.current = null; echeqAnticipoCF.current = null; echeqLoteActivo.current = false; echeqLoteFacturas.current = []}}>Cancelar</Button>
            <Button disabled={!echeqFormCF.banco || !echeqFormCF.fechaEmision || !echeqFormCF.fechaCobro} className="bg-amber-600 hover:bg-amber-700" onClick={confirmarEcheqCF}>Confirmar ECHEQ</Button>
          </DialogFooter>
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
                <Button variant="outline" className="flex-1" onClick={() => {
                  // Sin retención pero permitir aplicar descuento (paridad con el Modal)
                  setTipoSeleccionado(null)
                  setMontoRetencion(0)
                  setDescuentoAdicional(0)
                  setDatosSicoreCalculo({ netoFactura: 0, minimoAplicado: 0, baseImponible: 0, esRetencionAdicional: false, sinRetencion: true })
                  setPasoSicore('calculo')
                }}>
                  Sin retención (aplicar descuento)
                </Button>
                <Button variant="outline" onClick={() => cancelarSicoreCF(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {pasoSicore === 'calculo' && facturaEnProceso && datosSicoreCalculo && (() => {
            const tc = facturaEnProceso.tc_pago ?? facturaEnProceso.tipo_cambio ?? 1
            const esUSD = facturaEnProceso.moneda === 'USD' || (facturaEnProceso.tipo_cambio ?? 1) > 1.01
            const impTotal = (facturaEnProceso.imp_total || 0) * tc
            const impGravado = (facturaEnProceso.imp_neto_gravado || 0) * tc
            const impIva = (facturaEnProceso.iva || 0) * tc
            const saldoGravado = impGravado - (descuentoDesglose?.gravado || 0)
            const saldoIva = impIva - (descuentoDesglose?.iva || 0)
            const transferencia = impTotal - (descuentoDesglose?.total || 0) - montoRetencion
            const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            return (
            <div className="space-y-3">
              {esUSD && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">💵 Factura USD · TC de pago: <strong>${fmt(tc)}</strong> · Montos en ARS</div>
              )}
              {datosSicoreCalculo.esRetencionAdicional && (
                <div className="bg-yellow-100 text-yellow-800 text-xs p-2 rounded">⚠️ Retención adicional en quincena - No se aplica mínimo no imponible</div>
              )}

              {/* Desglose Gravado / IVA / Total */}
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-xs font-semibold text-green-800 mb-2">{tipoSeleccionado ? `${tipoSeleccionado.emoji} ${tipoSeleccionado.tipo} — Desglose` : 'Desglose'}</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b">
                      <th className="text-left pb-1">Concepto</th><th className="text-right pb-1">Gravado</th><th className="text-right pb-1">IVA</th><th className="text-right pb-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
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

              {/* Cálculo SICORE (solo si hay retención) */}
              {tipoSeleccionado && (
                <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Monto no imponible:</span><span>${fmt(datosSicoreCalculo.minimoAplicado)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Base imponible:</span><span className="font-medium">${fmt(datosSicoreCalculo.baseImponible)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Retención {(tipoSeleccionado.porcentaje_retencion * 100).toFixed(2).replace(".", ",")}%:</span><span className="font-bold text-red-600">${fmt(montoRetencion)}</span></div>
                  {(datosSicoreCalculo.netoPrevio ?? 0) > 0 && !datosSicoreCalculo.esRetencionAdicional && (
                    <div className="mt-1 pt-1 border-t border-gray-200 space-y-0.5">
                      <div className="flex justify-between text-amber-700"><span>Pagos previos en la quincena (sin retención):</span><span>${fmt(datosSicoreCalculo.netoPrevio ?? 0)}</span></div>
                      <div className="text-[11px] text-gray-500">Mínimo ${fmt(datosSicoreCalculo.minimoTipo ?? 0)} − previos → mínimo aplicado ${fmt(datosSicoreCalculo.minimoAplicado)}</div>
                      <label className="flex items-center gap-1 cursor-pointer text-[11px] text-gray-600">
                        <input type="checkbox" checked={!!datosSicoreCalculo.ignorarPrevios}
                          onChange={() => facturaEnProceso && tipoSeleccionado && calcularRetencionSicoreCF(facturaEnProceso, tipoSeleccionado, !datosSicoreCalculo.ignorarPrevios)} />
                        Ignorar pagos previos (usar mínimo completo)
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Transferencia */}
              <div className="bg-gray-50 p-3 rounded-lg text-sm flex justify-between">
                <span className="font-bold">Transferencia{esUSD ? ' (ARS)' : ''}:</span>
                <span className="font-bold text-green-700">${fmt(transferencia)}{esUSD ? ` · ≈ USD ${fmt(transferencia / tc)}` : ''}</span>
              </div>

              {/* Descuento pronto pago (% o monto) */}
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-orange-800">Descuento pronto pago (genera NC posterior)</p>
                <div className="flex gap-2 items-center">
                  <select value={descuentoTipoInput} onChange={e => setDescuentoTipoInput(e.target.value as 'pct' | 'monto')} className="border rounded px-2 py-1 text-xs w-16 bg-white">
                    <option value="pct">%</option>
                    <option value="monto">$</option>
                  </select>
                  <input
                    type="text"
                    placeholder={descuentoTipoInput === 'pct' ? 'ej: 5' : 'ej: 21.438'}
                    value={descuentoInputValor}
                    onChange={e => setDescuentoInputValor(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') aplicarDescuentoSicoreCF() }}
                    className="border rounded px-2 py-1 text-xs flex-1 bg-white"
                  />
                  <button onClick={aplicarDescuentoSicoreCF} className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1 rounded">Aplicar</button>
                  {descuentoDesglose && descuentoDesglose.total > 0 && (
                    <button onClick={limpiarDescuentoSicoreCF} className="text-gray-400 hover:text-red-500 text-xs px-2 py-1">✕</button>
                  )}
                </div>
                {descuentoDesglose && descuentoDesglose.total > 0 && (
                  <p className="text-xs text-orange-700">Desc: Grav ${fmt(descuentoDesglose.gravado)} + IVA ${fmt(descuentoDesglose.iva)} = ${fmt(descuentoDesglose.total)}</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={finalizarProcesoSicoreCF}>
                  ✅ Confirmar y pasar a Pagar
                </Button>
                {/* Sin retención y sin descuento: pasa a pagar sin estampar la quincena en la FC.
                    Es la salida que antes estaba escondida en el "Cancelar" de un confirm. */}
                {datosSicoreCalculo?.sinRetencion && (
                  <Button variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-50"
                    onClick={() => cancelarSicoreCF(true)}>
                    Seguir sin retención
                  </Button>
                )}
                {!datosSicoreCalculo?.sinRetencion && (
                  <Button variant="outline" onClick={() => setPasoSicore('tipo')}>← Tipo</Button>
                )}
                <Button variant="outline" onClick={() => cancelarSicoreCF(false)}>Cancelar</Button>
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

      {/* E2.4: Export lote Galicia (módulo reusado) */}
      <ModalExportarLote
        open={modalExportarLote.open}
        onClose={() => setModalExportarLote({ open: false, items: [] })}
        empresa="MSA"
        items={modalExportarLote.items}
        userRole={userRole}
      />

      {/* ── A-FEAT-22 · Paso 1 del lote: la fecha de pago ────────────────────
          Va ANTES de SICORE porque la quincena se calcula desde esta fecha. */}
      <Dialog open={modalFechaPago.open} onOpenChange={v => !v && setModalFechaPago({ open: false, fecha: '' })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Con qué fecha se pagaron?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {filasSeleccionadas.size} registro(s) pasan a <strong>{ESTADOS_DISPONIBLES.find(e => e.value === valorEstadoLote)?.label ?? valorEstadoLote}</strong>.
          </p>
          <div>
            <Label className="text-xs">Fecha de pago</Label>
            <Input type="date" className="mt-1" value={modalFechaPago.fecha}
              onChange={e => setModalFechaPago(m => ({ ...m, fecha: e.target.value }))} />
            <p className="mt-1.5 text-[11px] leading-4 text-gray-500">
              Viene propuesta la de <strong>hoy</strong>, que es cuando normalmente se registra el pago.
              La <strong>quincena de SICORE sale de esta fecha</strong>, así que conviene que sea la real.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <Button
              disabled={!modalFechaPago.fecha}
              onClick={() => { const f = modalFechaPago.fecha; setModalFechaPago({ open: false, fecha: '' }); ejecutarLote('elegida', f) }}>
              Registrar con esta fecha
            </Button>
            <Button variant="outline"
              onClick={() => { setModalFechaPago({ open: false, fecha: '' }); ejecutarLote('estimadas', '') }}>
              Dejar las fechas que ya tienen
            </Button>
            <Button variant="ghost" className="text-gray-500"
              onClick={() => setModalFechaPago({ open: false, fecha: '' })}>
              Cancelar — no tocar nada
            </Button>
          </div>
          <p className="text-[11px] leading-4 text-gray-400">
            «Dejar las fechas que ya tienen» usa la fecha estimada de cada registro como fecha de pago.
          </p>
        </DialogContent>
      </Dialog>

      {/* ── A-BUG-20 · Paso 2: SICORE, con TRES salidas ──────────────────────
          Antes era un confirm de dos botones donde «Cancelar» marcaba todo en pagar y seguía. */}
      <Dialog open={!!modalSicoreLote} onOpenChange={v => !v && resolverSicoreLote('cancelar')}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{modalSicoreLote?.facturas.length} factura(s) califican para retención SICORE</DialogTitle>
          </DialogHeader>

          <div className="max-h-48 overflow-y-auto rounded border bg-gray-50 p-2 text-xs">
            {modalSicoreLote?.facturas.map(f => (
              <div key={f.id} className="flex justify-between gap-3 border-b py-0.5 last:border-0">
                <span className="truncate">{f.nombre_proveedor || f.cuit_proveedor}</span>
                <span className="shrink-0 font-mono text-gray-500">
                  {f.fecha_pago ? f.fecha_pago.split('-').reverse().join('/') : 'sin fecha'}
                </span>
              </div>
            ))}
          </div>

          {(modalSicoreLote?.sinFecha ?? 0) > 0 && (
            <p className="rounded border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
              Otras {modalSicoreLote?.sinFecha} califican por monto pero <strong>no tienen fecha de
              pago</strong>: sin fecha no hay quincena, así que van sin retención.
            </p>
          )}

          <p className="text-xs text-gray-600">
            Todavía <strong>no se guardó nada</strong>. Elegí qué hacer:
          </p>

          <div className="flex flex-col gap-2">
            <Button onClick={() => resolverSicoreLote('retener')}>
              Retener SICORE — una factura por vez
            </Button>
            <Button variant="outline" onClick={() => resolverSicoreLote('sin_retencion')}>
              Pagar sin retener
            </Button>
            <Button variant="ghost" className="text-gray-500" onClick={() => resolverSicoreLote('cancelar')}>
              Cancelar — no tocar nada
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
/**
 * Selector de empresas del Cash Flow: tres tildes, sin "todas" ni "ninguna".
 *
 * Se separa de la barra de filtros a propósito. La empresa no es un criterio de búsqueda que
 * uno aplica y limpia: es **qué estás mirando**, y tiene que estar a la vista siempre para que
 * un total nunca se lea sin saber de quién es.
 */
function SelectorEmpresas({ titulo, seleccionadas, onCambio, ayuda }: {
  titulo: string
  seleccionadas: Empresa[]
  onCambio: (e: Empresa[]) => void
  ayuda: string
}) {
  const alternar = (empresa: Empresa) => {
    onCambio(
      seleccionadas.includes(empresa)
        ? seleccionadas.filter(e => e !== empresa)
        : [...seleccionadas, empresa],
    )
  }
  return (
    <div className="flex items-center gap-2" title={ayuda}>
      <span className="text-xs font-medium text-gray-600">{titulo}:</span>
      {EMPRESAS.map(empresa => {
        const activa = seleccionadas.includes(empresa)
        return (
          <button
            key={empresa}
            onClick={() => alternar(empresa)}
            className={`rounded border px-2 py-0.5 text-xs transition-colors ${
              activa ? COLOR_EMPRESA[empresa] : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-100'}`}
            title={activa ? `Ocultar ${empresa}` : `Mostrar ${empresa}`}
          >
            {empresa}
          </button>
        )
      })}
      {seleccionadas.length === 0 && (
        <span className="text-[11px] text-amber-700">nada seleccionado</span>
      )}
    </div>
  )
}
