"use client"

import { useEffect, useMemo, useState } from "react"
import type { UserRole } from "@/lib/auth/roles"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Search, Pencil, Trash2, FileText, CheckCircle, FileSpreadsheet } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { ModalComprobanteVentaMsa, type ComprobanteVenta } from "./modal-comprobante-venta-msa"
import { verificarCuadratura, TIPOS_SIN_CREDITO_VENTAS } from "@/lib/subdiarios/cuadratura"
import { calcularSubtotalesSubdiario, desglosePorAlicuotaVentas } from "@/lib/subdiarios/subtotales"
import { elegirCarpetaDestino, generarNombreUnico, guardarEnCarpeta } from "@/lib/subdiarios/carpeta-destino"
import { useCarpetaPorDefecto } from "@/hooks/useCarpetaPorDefecto"
import { DATOS_FISCALES, cuitFormateado } from "@/lib/empresas"
import { ControlCuadraturaSubdiario } from "@/components/control-cuadratura-subdiario"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { hojaRetenciones, tablaRetencionesPdf } from "@/lib/ventas/retenciones-export"
import { cargarRetencionesSubdiario } from "@/lib/ventas/retenciones-export-db"
import {
  evaluarCambioDDJJ, confirmarDecision, consultarEstadoPeriodo, consultarEstadoDeLosMeses, type EstadoMes,
} from "@/lib/subdiarios/estado-ddjj"
import { EstadoMesesDDJJ } from "@/components/estado-meses-ddjj"
import { RectificacionDelMes, consultarMesesARectificar } from "@/components/rectificacion-del-mes"
import type { MesARectificar } from "@/lib/subdiarios/rectificacion"
import { ivaDelLibroVenta } from "@/lib/ventas/libro-iva"

type RetencionesDelSubdiario = Awaited<ReturnType<typeof cargarRetencionesSubdiario>>

interface Props {
  /** PAM incluida para cuando exista `pam.comprobantes_venta` (hoy la tabla no está creada). */
  empresa: 'MSA' | 'PAM' | 'MA'
  userRole?: UserRole
}

const fmtAR = (n: number, dec = 2) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtMoney = (n: number) => `$${fmtAR(n)}`
const fmtFecha = (s: string | null) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

// Lista de últimos 24 meses para el selector
const generarPeriodos = (): string[] => {
  const periodos: string[] = []
  const hoy = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    periodos.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`)
  }
  return periodos
}

interface TipoComp { codigo: number; descripcion: string; es_nota_credito: boolean }

export function VistaSubdiariosVenta({ empresa, userRole = 'admin' }: Props) {
  const esAdmin = userRole === 'admin'
  const schemaName = empresa.toLowerCase()

  const [periodos] = useState<string[]>(generarPeriodos())
  const [periodoConsulta, setPeriodoConsulta] = useState('')
  const [comprobantes, setComprobantes] = useState<any[]>([])
  const [tipos, setTipos] = useState<TipoComp[]>([])
  const [cargando, setCargando] = useState(false)
  const [retPreview, setRetPreview] = useState<RetencionesDelSubdiario | null>(null)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  // Modal alta/edición
  const [modalAbierto, setModalAbierto] = useState(false)
  const [compEditando, setCompEditando] = useState<ComprobanteVenta | null>(null)

  // Imputar masivo
  const [mostrarModalImputar, setMostrarModalImputar] = useState(false)
  const [periodoImputacion, setPeriodoImputacion] = useState('')

  // Carpeta destino de los exports — la misma que recuerda el Libro IVA Compras
  const { carpetaPorDefecto, setCarpetaPorDefecto } = useCarpetaPorDefecto()
  const [generandoReportes, setGenerandoReportes] = useState(false)

  // 📨 A-FEAT-1295: el estado de cada mes del subdiario (Imputado / Enviado / DDJJ OK).
  const [estadoMeses, setEstadoMeses] = useState<EstadoMes[] | null>([])
  // 🔁 A-FEAT-1394: los meses que cambiaron después de enviarlos o presentarlos.
  const [mesesARectificar, setMesesARectificar] = useState<Map<string, MesARectificar> | null>(null)
  const recargarMesesEnviados = () => {
    consultarEstadoDeLosMeses(supabase, schemaName, 'comprobantes_venta').then(setEstadoMeses)
    consultarMesesARectificar(empresa, 'ventas').then(setMesesARectificar)
  }
  useEffect(() => { recargarMesesEnviados() }, [schemaName]) // eslint-disable-line react-hooks/exhaustive-deps


  // Cargar tipos de comprobante al montar
  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('tipos_comprobante_afip')
        .select('codigo, descripcion, es_nota_credito')
      setTipos((data || []) as TipoComp[])
    }
    cargar()
  }, [])

  // Mapa de tipos para lookup rápido
  const tiposMap = useMemo(() => {
    const m = new Map<number, TipoComp>()
    tipos.forEach(t => m.set(t.codigo, t))
    return m
  }, [tipos])

  const cargarPeriodo = async () => {
    if (!periodoConsulta) { setComprobantes([]); setRetPreview(null); return }
    setCargando(true)
    recargarMesesEnviados()
    try {
      const [mes, año] = periodoConsulta.split('/')
      const { data, error } = await supabase
        .schema(schemaName)
        .from('comprobantes_venta')
        .select('*')
        .eq('año_contable', parseInt(año))
        .eq('mes_contable', parseInt(mes))
        .order('fecha_liquidacion', { ascending: false })
      if (error) throw error
      // 🧾 El subdiario muestra y exporta el IVA del LIBRO: el de la venta menos el de los gastos (regla de JMS 27/10).
      setComprobantes((data || []).map((c: any) => ({ ...c, iva: ivaDelLibroVenta(c) })))
      setSeleccionados(new Set())
      // 🧾 A-FEAT-1278: vista previa de las retenciones (el aviso de «sin fecha» se ve antes de exportar).
      setRetPreview(null)
      cargarRetencionesSubdiario(supabase, empresa, parseInt(año), parseInt(mes), data || [])
        .then(setRetPreview).catch(() => setRetPreview(null))
    } catch (err) {
      toast.error('Error cargando período: ' + (err as Error).message)
    } finally {
      setCargando(false)
    }
  }

  // ════════════════════════════════════════════════════════════
  // Subtotales del período — estilo ARCA (FC / NC / Total Neto)
  // Sin Otros Tributos (decisión usuario para Ventas)
  // ════════════════════════════════════════════════════════════

  // MISMA función que el Excel y el PDF (`lib/subdiarios/subtotales`) → pantalla = Excel = PDF.
  // Antes había tres copias del cálculo, una por lugar, que podían desincronizarse.
  // `usarTipoCambio = false`: `comprobantes_venta` guarda todo en pesos, no tiene `tipo_cambio`.
  const subtotales = useMemo(() => {
    if (comprobantes.length === 0) return null
    const sub = calcularSubtotalesSubdiario(comprobantes, TIPOS_SIN_CREDITO_VENTAS, false)
    return { ivaVentas: sub.libro, monotributo: sub.sinCredito }
  }, [comprobantes])

  // ════════════════════════════════════════════════════════════
  // Acciones
  // ════════════════════════════════════════════════════════════

  const abrirAlta = () => {
    setCompEditando(null)
    setModalAbierto(true)
  }
  const abrirEdicion = (c: any) => {
    // El aviso de «enviado / presentado» lo da el modal al guardar (mira también el mes destino).
    setCompEditando(c as ComprobanteVenta)
    setModalAbierto(true)
  }
  const eliminar = async (c: any) => {
    if (!confirmarDecision(evaluarCambioDDJJ({ estadosAfectados: [c.ddjj_iva], esAdmin }))) return
    if (!window.confirm(`¿Eliminar comprobante ${c.numero_desde || '(s/n)'} de ${c.denominacion_cliente || ''}?`)) return
    try {
      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_venta')
        .delete()
        .eq('id', c.id)
      if (error) throw error
      toast.success('Comprobante eliminado')
      await cargarPeriodo()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    }
  }

  // Imputar masivamente al período
  const aplicarImputacion = async () => {
    if (!periodoImputacion) return toast.error('Falta período de imputación')
    if (seleccionados.size === 0) return toast.error('Sin selección')
    const [mes, año] = periodoImputacion.split('/')
    // 📨 A-FEAT-1295: comprobantes o mes destino enviados al contador / presentados → advertir.
    const decision = evaluarCambioDDJJ({
      estadosAfectados: comprobantes.filter(c => seleccionados.has(c.id)).map(c => c.ddjj_iva),
      periodoDestino: periodoImputacion,
      estadoPeriodoDestino: await consultarEstadoPeriodo(supabase, schemaName, 'comprobantes_venta', periodoImputacion),
      esAdmin,
    })
    if (!confirmarDecision(decision)) return
    try {
      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_venta')
        .update({
          año_contable: parseInt(año),
          mes_contable: parseInt(mes),
          ddjj_iva: 'Imputado',
        })
        .in('id', Array.from(seleccionados))
      if (error) throw error
      toast.success(`${seleccionados.size} comprobante(s) imputados al período ${periodoImputacion}`)
      setMostrarModalImputar(false)
      setSeleccionados(new Set())
      await cargarPeriodo()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    }
  }

  // 📨 A-FEAT-1295: el subdiario se le mandó al contador. No es presentarlo, pero desde acá el mes
  // no se mueve sin advertencia.
  const marcarEnviado = async () => {
    if (!confirmarDecision(evaluarCambioDDJJ({ estadosAfectados: [], estadoNuevo: 'Enviado', esAdmin }))) return
    const imputadas = comprobantes.filter(c => c.ddjj_iva === 'Imputado')
    if (imputadas.length === 0) return toast.error('No hay comprobantes con estado "Imputado" en el período')
    if (!window.confirm(
      `¿Marcar el período ${periodoConsulta} como ENVIADO AL CONTADOR?\n\n` +
      `${imputadas.length} comprobante(s) pasan a "Enviado". Desde ahí, moverlos o imputar otros a este mes ` +
      `te va a pedir confirmación.\n\n` +
      `Cuando el contador te avise que lo presentó, apretá "Confirmar DDJJ".`
    )) return
    try {
      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_venta')
        .update({ ddjj_iva: 'Enviado' })
        .in('id', imputadas.map(c => c.id))
      if (error) throw error
      toast.success(`📨 ${periodoConsulta} marcado como enviado al contador (${imputadas.length} comprobantes)`)
      await cargarPeriodo()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    }
  }

  // Confirmar DDJJ del período (todas las imputadas o enviadas → DDJJ OK)
  const confirmarDDJJ = async () => {
    if (!confirmarDecision(evaluarCambioDDJJ({ estadosAfectados: [], estadoNuevo: 'DDJJ OK', esAdmin }))) return
    const imputadas = comprobantes.filter(c => c.ddjj_iva === 'Imputado' || c.ddjj_iva === 'Enviado')
    if (imputadas.length === 0) return toast.error('No hay comprobantes con estado "Imputado" o "Enviado" en el período')
    if (!window.confirm(
      `¿Confirmar DDJJ IVA del período ${periodoConsulta}?\n\n` +
      `${imputadas.length} comprobante(s) pasarán a estado "DDJJ OK" (no editables después).\n\n` +
      `Esta acción es difícil de revertir.`
    )) return
    try {
      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_venta')
        .update({ ddjj_iva: 'DDJJ OK' })
        .in('id', imputadas.map(c => c.id))
      if (error) throw error
      toast.success(`DDJJ IVA ${periodoConsulta} confirmada (${imputadas.length} comprobantes)`)
      await cargarPeriodo()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    }
  }

  const toggleSel = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ════════════════════════════════════════════════════════════
  // Export del Libro IVA Ventas — MISMO flujo que el Libro IVA Compras
  //
  // Un solo botón genera Excel + PDF, pregunta la carpeta destino (File System Access API,
  // recordándola entre sesiones) y nunca sobrescribe: si el archivo existe, agrega " (1)".
  // Los datos se RE-CONSULTAN a la BD, no se toma lo que está pintado en pantalla, para que el
  // export no dependa de cuándo se apretó "Consultar período".
  //
  // Diferencias inevitables con Compras, por lo que la tabla NO tiene:
  //   · sin columna "Otros Tributos"    → `comprobantes_venta` no la tiene.
  //   · sin conversión por tipo de cambio → los importes ya están en pesos.
  //   · el desglose por alícuota se AGRUPA por `alicuota_iva`, porque no hay columnas por tasa
  //     (`iva_21`, `neto_grav_iva_21`, …) como en compras.
  // ════════════════════════════════════════════════════════════

  const fmtNum = (v: any) => {
    if (v === 0 || v === null || v === undefined) return 0
    return parseFloat(Number(v).toFixed(2))
  }

  /** Formato de los PDF de Compras: miles con punto, y el cero como " -   ". */
  const fmtPDF = (valor: any) => {
    const n = Number(valor) || 0
    if (n === 0) return '-'
    return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  /** `07/2026` → `{ mes: '07', año: '2026', fechaInicio: '01/07/2026', fechaFin: '31/07/2026' }` */
  const rangoDelPeriodo = (periodo: string) => {
    const [mes, año] = periodo.split('/')
    const ultimoDia = new Date(parseInt(año), parseInt(mes), 0).getDate()
    return {
      mes, año,
      fechaInicio: `01/${mes.padStart(2, '0')}/${año}`,
      fechaFin: `${String(ultimoDia).padStart(2, '0')}/${mes.padStart(2, '0')}/${año}`,
    }
  }

  const encabezadoPdf = (doc: jsPDF, titulo: string, periodo: string) => {
    const { fechaInicio, fechaFin } = rangoDelPeriodo(periodo)
    const datos = DATOS_FISCALES[empresa]
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(datos.razonSocial, 20, 15)
    doc.text(cuitFormateado(datos.cuit), 180, 15)
    doc.text(titulo, 250, 15)
    return { fechaInicio, fechaFin }
  }

  // ── Botón único: Excel + PDF, con carpeta ──────────────────────────────────
  const generarReportesPeriodo = async () => {
    if (!periodoConsulta) {
      alert('Selecciona un período para generar reportes')
      return
    }

    setGenerandoReportes(true)
    try {
      const [mes, año] = periodoConsulta.split('/')

      // Re-consulta a la BD (igual que Compras): el export no depende de la pantalla
      const { data, error } = await supabase
        .schema(schemaName)
        .from('comprobantes_venta')
        .select('*')
        .eq('año_contable', parseInt(año))
        .eq('mes_contable', parseInt(mes))
        .order('fecha_liquidacion', { ascending: true })

      if (error) {
        alert('Error obteniendo datos para reporte: ' + error.message)
        return
      }

      const filas = data || []
      if (filas.length === 0) {
        alert(`⚠️ No hay comprobantes registrados para el período ${periodoConsulta}`)
        return
      }

      // 🧾 A-FEAT-1278: los certificados sin fecha se avisan ANTES de exportar. Avisa y deja seguir —
      // salen con la fecha del cobro o del comprobante, marcados (§ 🚦: discrepancia, no contradicción).
      const retenciones = await cargarRetencionesSubdiario(supabase, empresa, parseInt(año), parseInt(mes), filas)
      setRetPreview(retenciones)
      const sinFecha = retenciones.avisos.length + retenciones.sinUbicar.length
      if (sinFecha > 0 && !confirm(
        `⚠️ Hay ${sinFecha} certificado(s) de retención SIN FECHA:\n\n` +
        [...retenciones.avisos, ...retenciones.sinUbicar.map(r => `Ret. ${r.tipo} de ${r.cliente || 'cliente sin nombre'} — ${r.aviso}`)].map(a => '• ' + a).join('\n') +
        `\n\nSalen marcados en la solapa RETENCIONES. ¿Exportar igual?`
      )) return

      const destino = await elegirCarpetaDestino(carpetaPorDefecto, setCarpetaPorDefecto)
      if (destino.cancelado) {
        alert('📁 Descarga cancelada')
        return
      }

      await generarExcelConCarpeta(filas, periodoConsulta, destino.directorio, retenciones)
      await generarPDFConCarpeta(filas, periodoConsulta, destino.directorio, retenciones)

      alert(
        `📊 Reportes generados para período ${periodoConsulta}\n\n📥 Descargando:\n` +
        `• Excel con ${filas.length} comprobantes\n• PDF con resumen detallado\n\n` +
        `📁 Archivos guardados en ${destino.ubicacion || 'carpeta Descargas'}`
      )
    } catch (err) {
      console.error('Error generando reportes:', err)
      alert('Error al generar reportes: ' + (err as Error).message)
    } finally {
      setGenerandoReportes(false)
    }
  }

  /** Nombre base: `LIBRO IVA VENTAS MSA 26-07` (año corto-mes, como en Compras). */
  const nombreBaseReporte = (periodo: string) => {
    const { mes, año } = rangoDelPeriodo(periodo)
    return `LIBRO IVA VENTAS ${empresa} ${año.slice(-2)}-${mes.padStart(2, '0')}`
  }

  // ── Excel ──────────────────────────────────────────────────────────────────
  const generarExcelConCarpeta = async (filas: any[], periodo: string, directorio: any = null, retenciones: RetencionesDelSubdiario | null = null) => {
    try {
      const { mes, año } = rangoDelPeriodo(periodo)

      const datosExcel = filas.map(c => ({
        'Fecha': c.fecha_liquidacion || '',
        'Tipo': c.tipo_comprobante != null ? String(c.tipo_comprobante).padStart(3, '0') : '',
        'Tipo Desc.': tiposMap.get(c.tipo_comprobante)?.descripcion || '',
        'Pto Vta': c.punto_venta || '',
        'Número': c.numero_desde || '',
        'Razón Social': c.denominacion_cliente || '',
        'C.U.I.T.': c.cuit_cliente || '',
        'Neto Gravado': fmtNum(c.imp_neto_gravado),
        'Neto No Gravado': fmtNum(c.imp_neto_no_gravado),
        'Op. Exentas': fmtNum(c.imp_op_exentas),
        'Alícuota IVA': c.alicuota_iva != null ? Number(c.alicuota_iva) : '',
        'IVA': fmtNum(c.iva),
        'Imp. Total': fmtNum(c.imp_total),
      }))

      // MISMA función que la pantalla y el PDF
      const sub = calcularSubtotalesSubdiario(filas, TIPOS_SIN_CREDITO_VENTAS, false)
      const bIva = sub.libro, bSin = sub.sinCredito
      const alicuotas = desglosePorAlicuotaVentas(filas, TIPOS_SIN_CREDITO_VENTAS)

      const filasExtras: any[] = [
        {},
        { 'Fecha': '📒 LIBRO IVA VENTAS', 'Neto Gravado': 'Neto Gravado', 'Neto No Gravado': 'Exento/No Grav.', 'IVA': 'IVA', 'Imp. Total': 'Total' },
        { 'Fecha': `Facturas (${bIva.fc.cantidad})`, 'Neto Gravado': fmtNum(bIva.fc.imp_neto_gravado), 'Neto No Gravado': fmtNum(bIva.fc.exento_no_gravado), 'IVA': fmtNum(bIva.fc.iva), 'Imp. Total': fmtNum(bIva.fc.imp_total) },
        { 'Fecha': `Notas de Crédito (${bIva.nc.cantidad})`, 'Neto Gravado': fmtNum(bIva.nc.imp_neto_gravado), 'Neto No Gravado': fmtNum(bIva.nc.exento_no_gravado), 'IVA': fmtNum(bIva.nc.iva), 'Imp. Total': fmtNum(bIva.nc.imp_total) },
        { 'Fecha': 'Total Neto (FC − NC)', 'Neto Gravado': fmtNum(bIva.neto.imp_neto_gravado), 'Neto No Gravado': fmtNum(bIva.neto.exento_no_gravado), 'IVA': fmtNum(bIva.neto.iva), 'Imp. Total': fmtNum(bIva.neto.imp_total) },
      ]

      if (bSin.fc.cantidad > 0 || bSin.nc.cantidad > 0) {
        filasExtras.push(
          {},
          { 'Fecha': '📋 Comprobantes que no generan débito fiscal (Fac C)', 'Imp. Total': 'Total' },
          { 'Fecha': `Comprobantes Fac C (${bSin.fc.cantidad})`, 'Imp. Total': fmtNum(bSin.fc.total) },
          { 'Fecha': `Notas de crédito C (${bSin.nc.cantidad})`, 'Imp. Total': fmtNum(bSin.nc.total) },
          { 'Fecha': 'Total Neto (FC − NC)', 'Imp. Total': fmtNum(bSin.neto) },
        )
      }

      filasExtras.push(
        {},
        { 'Fecha': 'Detalle por Alícuotas', 'Tipo': 'Neto $', 'Tipo Desc.': 'Alíc.', 'Pto Vta': 'IVA $' },
        ...alicuotas.map(a => ({
          'Fecha': `Al ${String(a.alicuota).replace('.', ',')}%`,
          'Tipo': fmtNum(a.neto),
          'Tipo Desc.': a.alicuota.toFixed(2),
          'Pto Vta': fmtNum(a.iva),
        })),
        // Los TOTALES son la suma de las bandas listadas — no el neto del bloque 1: un comprobante
        // exento no tiene alícuota y por eso no aparece en ninguna banda.
        {
          'Fecha': 'TOTALES',
          'Tipo': fmtNum(alicuotas.reduce((s, a) => s + a.neto, 0)),
          'Tipo Desc.': '----',
          'Pto Vta': fmtNum(alicuotas.reduce((s, a) => s + a.iva, 0)),
        },
      )

      const ws = XLSX.utils.json_to_sheet([...datosExcel, ...filasExtras])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `LIBRO IVA VENTAS ${mes}-${año}`)

      /**
       * 🧾 A-FEAT-1227 / A-FEAT-1278 — segunda hoja: las RETENCIONES RECIBIDAS en dos apartados (de las
       * ventas del subdiario · sufridas en el mes), agrupadas por tipo, con el control contra ARCA.
       * La lectura es la misma que la de la vista previa (`cargarRetencionesSubdiario`).
       */
      const ret = retenciones ?? await cargarRetencionesSubdiario(supabase, empresa, parseInt(año), parseInt(mes), filas)
      const wsRet = XLSX.utils.aoa_to_sheet(hojaRetenciones(ret, `${mes.padStart(2, '0')}/${año}`, ret.notas) as any[][])
      wsRet['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 60 }]
      XLSX.utils.book_append_sheet(wb, wsRet, `RETENCIONES ${mes}-${año}`)

      const filename = await generarNombreUnico(directorio, nombreBaseReporte(periodo), 'xlsx')
      if (directorio) {
        await guardarEnCarpeta(directorio, filename, XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))
      } else {
        XLSX.writeFile(wb, filename)
      }
    } catch (err) {
      console.error('Error generando Excel:', err)
      alert('Error al generar archivo Excel: ' + (err as Error).message)
    }
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  const generarPDFConCarpeta = async (filas: any[], periodo: string, directorio: any = null, retenciones: RetencionesDelSubdiario | null = null) => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      const { fechaInicio, fechaFin } = encabezadoPdf(doc, 'VENTAS', periodo)

      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`LIBRO DE IVA VENTAS - Movimientos desde el ${fechaInicio} hasta el ${fechaFin}`, 20, 25)
      doc.setFontSize(10)
      doc.text(`Fecha generación: ${new Date().toLocaleDateString('es-AR')}`, 20, 35)
      doc.text(`Total comprobantes: ${filas.length}`, 150, 35)

      const sub = calcularSubtotalesSubdiario(filas, TIPOS_SIN_CREDITO_VENTAS, false)
      const bIva = sub.libro, bSin = sub.sinCredito
      const alicuotas = desglosePorAlicuotaVentas(filas, TIPOS_SIN_CREDITO_VENTAS)

      // Página 1 — detalle por comprobante + fila TOTALES
      const datosTabla = filas.map(c => [
        c.fecha_liquidacion || '',
        c.tipo_comprobante != null ? String(c.tipo_comprobante).padStart(3, '0') : '',
        `${c.punto_venta || ''}-${c.numero_desde || ''}`,
        (c.denominacion_cliente || '').substring(0, 24),
        c.cuit_cliente || '',
        fmtPDF(c.imp_neto_gravado),
        fmtPDF((Number(c.imp_neto_no_gravado) || 0) + (Number(c.imp_op_exentas) || 0)),
        c.alicuota_iva != null ? `${String(c.alicuota_iva).replace('.', ',')}%` : '-',
        fmtPDF(c.iva),
        fmtPDF(c.imp_total),
      ])

      // Fila TOTALES GENERALES: suma TODOS los comprobantes con su signo (las NC restan),
      // mismo criterio que la fila homónima del Libro IVA Compras.
      const sumaCol = (campo: string) => filas.reduce((s, c) => s + (Number(c[campo]) || 0), 0)
      datosTabla.push([
        '', '', '', 'TOTALES GENERALES', '',
        fmtPDF(sumaCol('imp_neto_gravado')),
        fmtPDF(sumaCol('imp_neto_no_gravado') + sumaCol('imp_op_exentas')),
        '',
        fmtPDF(sumaCol('iva')),
        fmtPDF(sumaCol('imp_total')),
      ])

      autoTable(doc, {
        head: [['Fecha', 'Tipo', 'Pto-Nro', 'Razón Social', 'C.U.I.T.', 'Neto Gravado', 'Exento/No Grav.', 'Alíc.', 'IVA', 'Imp. Total']],
        body: datosTabla,
        startY: 45,
        styles: { fontSize: 6, cellPadding: 1 },
        headStyles: { fillColor: [66, 139, 202], fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 14 },
          2: { cellWidth: 26 },
          3: { cellWidth: 46 },
          4: { cellWidth: 26 },
          5: { cellWidth: 28, halign: 'right' },
          6: { cellWidth: 28, halign: 'right' },
          7: { cellWidth: 14, halign: 'center' },
          8: { cellWidth: 26, halign: 'right' },
          9: { cellWidth: 30, halign: 'right' },
        },
      })

      // Página 2 — desglose por alícuotas + los 2 bloques
      doc.addPage('a4', 'landscape')
      encabezadoPdf(doc, 'DESGLOSE IVA POR ALÍCUOTAS', periodo)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`Período: ${fechaInicio} al ${fechaFin}`, 20, 30)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Detalle por Alícuotas:', 20, 50)

      autoTable(doc, {
        head: [['Detalle', 'Neto $', 'Alíc.', 'IVA $']],
        body: [
          ...alicuotas.map(a => [
            `Al ${String(a.alicuota).replace('.', ',')}%`,
            fmtPDF(a.neto),
            a.alicuota.toFixed(2),
            fmtPDF(a.iva),
          ]),
          ['TOTALES', fmtPDF(alicuotas.reduce((s, a) => s + a.neto, 0)), '----', fmtPDF(alicuotas.reduce((s, a) => s + a.iva, 0))],
        ],
        startY: 55,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 40, halign: 'right' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 40, halign: 'right' } },
      })

      const yTotales = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('LIBRO IVA VENTAS (generan débito fiscal):', 20, yTotales)
      autoTable(doc, {
        head: [['Concepto', 'Neto Gravado', 'Exento/No Grav.', 'IVA', 'Total']],
        body: [
          [`Facturas (${bIva.fc.cantidad})`, fmtPDF(bIva.fc.imp_neto_gravado), fmtPDF(bIva.fc.exento_no_gravado), fmtPDF(bIva.fc.iva), fmtPDF(bIva.fc.imp_total)],
          [`Notas de Crédito (${bIva.nc.cantidad})`, fmtPDF(bIva.nc.imp_neto_gravado), fmtPDF(bIva.nc.exento_no_gravado), fmtPDF(bIva.nc.iva), fmtPDF(bIva.nc.imp_total)],
          ['Total Neto (FC - NC)', fmtPDF(bIva.neto.imp_neto_gravado), fmtPDF(bIva.neto.exento_no_gravado), fmtPDF(bIva.neto.iva), fmtPDF(bIva.neto.imp_total)],
        ],
        startY: yTotales + 5,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      })

      if (bSin.fc.cantidad > 0 || bSin.nc.cantidad > 0) {
        const ySin = (doc as any).lastAutoTable.finalY + 10
        doc.setFont('helvetica', 'bold')
        doc.text('Comprobantes que no generan débito fiscal (Fac C):', 20, ySin)
        autoTable(doc, {
          head: [['Concepto', 'Total']],
          body: [
            [`Comprobantes Fac C (${bSin.fc.cantidad})`, fmtPDF(bSin.fc.total)],
            [`Notas de crédito C (${bSin.nc.cantidad})`, fmtPDF(bSin.nc.total)],
            ['Total Neto (FC - NC)', fmtPDF(bSin.neto)],
          ],
          startY: ySin + 5,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [66, 139, 202] },
          columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 50, halign: 'right' } },
        })
      }

      /**
       * 🧾 A-FEAT-1281 — página de RETENCIONES RECIBIDAS, con el detalle de cada una (comprobante de venta,
       * cliente, CUIT, fecha, certificado): los mismos dos apartados que la solapa del Excel.
       */
      const ret = retenciones ?? await cargarRetencionesSubdiario(supabase, empresa, parseInt(rangoDelPeriodo(periodo).año), parseInt(rangoDelPeriodo(periodo).mes), filas)
      doc.addPage('a4', 'landscape')
      encabezadoPdf(doc, 'RETENCIONES RECIBIDAS', periodo)
      let y = 30
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      for (const n of ret.notas) { doc.text(n, 20, y); y += 5 }
      const sinFecha = [...ret.avisos, ...ret.sinUbicar.map(r => `Ret. ${r.tipo} de ${r.cliente || 'cliente sin nombre'} — ${r.aviso}`)]
      if (sinFecha.length) {
        doc.setTextColor(180, 90, 0)
        doc.text(`ATENCIÓN: ${sinFecha.length} certificado(s) SIN FECHA (cargá la fecha real en Comprobantes > Retenciones):`, 20, y); y += 4
        for (const a of sinFecha) { doc.text('• ' + a, 22, y); y += 4 }
        doc.setTextColor(0, 0, 0)
      }
      const apartadoPdf = (titulo: string, ap: typeof ret.delMes) => {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(titulo, 20, y + 4)
        const t = tablaRetencionesPdf(ap)
        autoTable(doc, {
          head: [['Fecha', 'Cliente', 'C.U.I.T.', 'Comprobante de venta', 'Certificado', 'Origen', 'Importe', 'Observación']],
          // Título de tipo, subtotal y total: el texto ocupa las 6 primeras columnas (no se parte en dos renglones).
          body: t.filas.map((r, i) => t.negritas.includes(i) ? [{ content: r[0], colSpan: 6 }, r[6], r[7]] : r) as any,
          startY: y + 7,
          styles: { fontSize: 7, cellPadding: 1 },
          headStyles: { fillColor: [66, 139, 202], fontSize: 7 },
          columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 48 }, 2: { cellWidth: 22 }, 3: { cellWidth: 30 }, 4: { cellWidth: 28 }, 5: { cellWidth: 32 }, 6: { cellWidth: 26, halign: 'right' }, 7: { cellWidth: 40 } },
          didParseCell: (d: any) => { if (d.section === 'body' && t.negritas.includes(d.row.index)) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [235, 241, 250] } },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      }
      apartadoPdf('RETENCIONES DE LAS VENTAS DEL SUBDIARIO — aunque la retención sea de otro mes', ret.deLasVentas)
      apartadoPdf('RETENCIONES SUFRIDAS EN EL MES — aunque la venta sea de otro mes', ret.delMes)

      const filename = await generarNombreUnico(directorio, nombreBaseReporte(periodo), 'pdf')
      if (directorio) {
        await guardarEnCarpeta(directorio, filename, doc.output('arraybuffer'))
      } else {
        doc.save(filename)
      }
    } catch (err) {
      console.error('Error generando PDF:', err)
      alert('Error al generar archivo PDF: ' + (err as Error).message)
    }
  }


  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Subdiario IVA Ventas — {empresa}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 📨 A-FEAT-1295: el estado de cada mes */}
          <div className="mb-3">
            <EstadoMesesDDJJ
              meses={estadoMeses}
              aRectificar={mesesARectificar}
              onElegir={setPeriodoConsulta}
              ayuda="Tocá un mes y «Consultar período». Cuando el contador te avise que presentó uno enviado, apretá «Confirmar DDJJ»."
            />
            {periodoConsulta && (
              <div className="mt-2">
                <RectificacionDelMes empresa={empresa} lado="ventas" periodo={periodoConsulta} esAdmin={esAdmin} onCambio={recargarMesesEnviados} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <select
                className="border rounded h-9 px-2 text-sm min-w-[140px]"
                value={periodoConsulta}
                onChange={e => setPeriodoConsulta(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {periodos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Button onClick={cargarPeriodo} disabled={!periodoConsulta || cargando}>
              <Search className="mr-2 h-4 w-4" />Consultar período
            </Button>
            <div className="ml-auto flex gap-2 flex-wrap">
              {/* Un solo botón genera los dos archivos y pregunta la carpeta — igual que Compras */}
              {comprobantes.length > 0 && (
                <Button
                  variant="outline"
                  onClick={generarReportesPeriodo}
                  disabled={generandoReportes}
                  className="border-green-500 text-green-600 hover:bg-green-50"
                  title="Genera Excel + PDF del Libro IVA Ventas y pregunta en qué carpeta guardarlos"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {generandoReportes ? 'Generando…' : `📊 Generar PDF + Excel (${comprobantes.length})`}
                </Button>
              )}
              <Button variant="outline" onClick={() => setMostrarModalImputar(true)}>
                Imputar período…
              </Button>
              {/* El importador vive en COMPROBANTES, no acá: el subdiario es la DDJJ por mes
                  contable, no el lugar donde se cargan facturas (criterio del usuario). */}
              {esAdmin && (
                <Button onClick={abrirAlta} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />Nuevo comprobante
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subtotales estilo ARCA */}
      {subtotales && (() => {
        const fc = subtotales.ivaVentas.fc
        const nc = subtotales.ivaVentas.nc
        const neto = subtotales.ivaVentas.neto
        const m = subtotales.monotributo
        return (
        <Card>
          <CardHeader>
            <CardTitle>📈 Subtotales Período {periodoConsulta}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Libro IVA Ventas */}
            <div>
              <h4 className="font-medium mb-2 text-sm">📒 Libro IVA Ventas</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Concepto</th>
                      <th className="px-3 py-2 text-right font-medium">Neto Gravado</th>
                      <th className="px-3 py-2 text-right font-medium">Exento / No Gravado</th>
                      <th className="px-3 py-2 text-right font-medium">IVA</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-3 py-2">Facturas{fc.cantidad > 0 && <span className="text-gray-500 text-xs ml-1">({fc.cantidad})</span>}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(fc.imp_neto_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(fc.exento_no_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(fc.iva)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(fc.imp_total)}</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2">Notas de Crédito{nc.cantidad > 0 && <span className="text-gray-500 text-xs ml-1">({nc.cantidad})</span>}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(nc.imp_neto_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(nc.exento_no_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(nc.iva)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(nc.imp_total)}</td>
                    </tr>
                    <tr className="border-t bg-blue-50 font-semibold">
                      <td className="px-3 py-2">Total Neto (FC − NC)</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(neto.imp_neto_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(neto.exento_no_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(neto.iva)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(neto.imp_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monotributo */}
            {(m.fc.cantidad > 0 || m.nc.cantidad > 0) && (
              <div>
                <h4 className="font-medium mb-2 text-sm">📋 Monotributo — Facturas C (Tipo 11) y NC C (Tipo 13)</h4>
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
                        <td className="px-3 py-2">Facturas C{m.fc.cantidad > 0 && <span className="text-gray-500 text-xs ml-1">({m.fc.cantidad})</span>}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(m.fc.total)}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-3 py-2">NC C{m.nc.cantidad > 0 && <span className="text-gray-500 text-xs ml-1">({m.nc.cantidad})</span>}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(m.nc.total)}</td>
                      </tr>
                      <tr className="border-t bg-red-50 font-semibold">
                        <td className="px-3 py-2">Total Neto (FC − NC)</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(m.neto)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Control: Total general − Neto − Exento/NG − IVA − (Fac C) = 0
                Ventas no tiene columna Otros Tributos ni conversión por TC. */}
            <ControlCuadraturaSubdiario
              resultado={verificarCuadratura(comprobantes, TIPOS_SIN_CREDITO_VENTAS, false)}
              etiquetaSinCredito="Monotributo (Fac C)"
              mostrarOtrosTributos={false}
            />

            {/* 🧾 A-FEAT-1278 — vista previa de la solapa RETENCIONES del Excel: los dos apartados por
                tipo, y los certificados sin fecha avisados ANTES de exportar. */}
            {retPreview && (
              <div className="border rounded p-3 text-sm space-y-2">
                <div className="font-semibold">🧾 Retenciones recibidas <span className="font-normal text-gray-500">— salen en la solapa RETENCIONES del Excel</span></div>
                {retPreview.notas.map((n, i) => <div key={i} className="text-xs text-gray-600">{n}</div>)}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([['De las ventas del subdiario', 'aunque la retención sea de otro mes', retPreview.deLasVentas],
                     ['Sufridas en el mes', 'aunque la venta sea de otro mes — es lo que se cruza con ARCA', retPreview.delMes]] as const).map(([titulo, sub, ap]) => (
                    <div key={titulo} className="bg-gray-50 rounded p-2">
                      <div className="font-medium">{titulo}</div>
                      <div className="text-xs text-gray-500 mb-1">{sub}</div>
                      {ap.grupos.length === 0
                        ? <div className="text-xs text-gray-500">Sin retenciones</div>
                        : <>
                            {ap.grupos.map(g => (
                              <div key={g.tipo} className="flex justify-between">
                                <span>Ret. {g.tipo} <span className="text-gray-500 text-xs">({g.filas.length})</span></span>
                                <span className="whitespace-nowrap">{fmtMoney(g.total)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between border-t mt-1 pt-1 font-semibold">
                              <span>Total</span><span className="whitespace-nowrap">{fmtMoney(ap.total)}</span>
                            </div>
                          </>}
                    </div>
                  ))}
                </div>
                {(retPreview.avisos.length > 0 || retPreview.sinUbicar.length > 0) && (
                  <div className="bg-amber-50 border border-amber-300 rounded p-2 text-xs space-y-0.5">
                    <div className="font-semibold text-amber-800">
                      ⚠️ {retPreview.avisos.length + retPreview.sinUbicar.length} certificado(s) sin fecha — cargá la fecha real en Comprobantes → Retenciones
                    </div>
                    {retPreview.avisos.map((a, i) => <div key={i}>• {a}</div>)}
                    {retPreview.sinUbicar.map((r, i) => (
                      <div key={`s${i}`}>• Ret. {r.tipo} {fmtMoney(r.importe)} de {r.cliente || 'cliente sin nombre'} — {r.aviso}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {esAdmin && <TestsDelProceso proceso="subdiarios/estado-ddjj" pantalla="subdiarios" />}
            {/* 📨 Enviado al contador (A-FEAT-1295) y Confirmar DDJJ */}
            {esAdmin && comprobantes.some(c => c.ddjj_iva === 'Imputado' || c.ddjj_iva === 'Enviado') && (
              <div className="border-t pt-3 flex flex-wrap gap-2">
                {comprobantes.some(c => c.ddjj_iva === 'Imputado') && (
                  <Button onClick={marcarEnviado} variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-50">
                    📨 Marcar enviado al contador {periodoConsulta}
                  </Button>
                )}
                <Button onClick={confirmarDDJJ} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar DDJJ IVA Ventas {periodoConsulta}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        )
      })()}

      {/* Tabla comprobantes del período */}
      {comprobantes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📋 Comprobantes del Período {periodoConsulta} ({comprobantes.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {esAdmin && <TableHead className="w-10"></TableHead>}
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead className="text-right">Neto Gravado</TableHead>
                    <TableHead className="text-right">Exento/NG</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Cuenta contable</TableHead>
                    <TableHead>Centro costo</TableHead>
                    <TableHead>Estado</TableHead>
                    {esAdmin && <TableHead className="text-right" style={{ width: 110 }}>Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprobantes.map(c => {
                    const tipo = tiposMap.get(c.tipo_comprobante)
                    return (
                      <TableRow key={c.id} className={c.ddjj_iva === 'DDJJ OK' ? 'bg-gray-50' : ''}>
                        {esAdmin && (
                          <TableCell>
                            <Checkbox
                              checked={seleccionados.has(c.id)}
                              onCheckedChange={() => toggleSel(c.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap">{fmtFecha(c.fecha_liquidacion)}</TableCell>
                        <TableCell className="text-xs">
                          {c.tipo_comprobante != null ? (
                            <span title={tipo?.descripcion || ''}>
                              {String(c.tipo_comprobante).padStart(3, '0')}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>{c.denominacion_cliente || '—'}</TableCell>
                        <TableCell className="text-xs">{c.cuit_cliente || '—'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{c.imp_neto_gravado != null ? fmtMoney(Number(c.imp_neto_gravado)) : '—'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtMoney((Number(c.imp_neto_no_gravado) || 0) + (Number(c.imp_op_exentas) || 0))}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{c.iva != null ? fmtMoney(Number(c.iva)) : '—'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium">{c.imp_total != null ? fmtMoney(Number(c.imp_total)) : '—'}</TableCell>
                        <TableCell className="text-xs">{c.cuenta_contable || <span className="text-gray-400 italic">—</span>}</TableCell>
                        <TableCell className="text-xs">{c.centro_costo || <span className="text-gray-400 italic">—</span>}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            c.ddjj_iva === 'DDJJ OK' ? 'bg-green-50 text-green-700' :
                            c.ddjj_iva === 'Enviado' ? 'bg-blue-50 text-blue-700 border-blue-400' :
                            c.ddjj_iva === 'Imputado' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-gray-50 text-gray-600'
                          }>
                            {c.ddjj_iva === 'Enviado' ? '📨 Enviado' : (c.ddjj_iva || 'No')}
                          </Badge>
                        </TableCell>
                        {esAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => abrirEdicion(c)} title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => eliminar(c)} title="Eliminar"
                                className="text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal alta/edición */}
      <ModalComprobanteVentaMsa
        open={modalAbierto}
        onOpenChange={setModalAbierto}
        empresa={empresa}
        comprobanteInicial={compEditando}
        onGuardado={cargarPeriodo}
      />

      {/* Modal imputar masivo */}
      {mostrarModalImputar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-4 space-y-3">
            <h3 className="font-semibold">Imputar al período</h3>
            <p className="text-sm text-gray-600">
              Vas a imputar <strong>{seleccionados.size}</strong> comprobante(s) al período seleccionado. Pasarán a estado <em>Imputado</em>.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Período destino</Label>
              <select className="border rounded h-9 px-2 text-sm w-full"
                value={periodoImputacion}
                onChange={e => setPeriodoImputacion(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {periodos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMostrarModalImputar(false)}>Cancelar</Button>
              <Button onClick={aplicarImputacion} disabled={!periodoImputacion || seleccionados.size === 0} className="bg-blue-600 hover:bg-blue-700">
                Imputar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
