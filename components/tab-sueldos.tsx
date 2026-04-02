"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Users, DollarSign, ArrowDownCircle, Clock,
  ChevronLeft, ChevronRight, Plus, History, Loader2, Pencil, Trash2,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Empleado {
  id: string
  nombre: string
  tipo_empleado: 'ab_francos' | 'por_dia' | 'plano_ipc' | 'por_hora_ipc'
  empresa: string
  cuit_empleado: string | null
  francos_dias_promedio: number
  dias_promedio: number
  horas_promedio: number
  activo: boolean
  fecha_ingreso?: string | null
  fecha_egreso?: string | null
}

interface Periodo {
  id: string
  empleado_id: string
  anio: number
  mes: number
  fecha_fin_periodo: string
  bruto_calculado: number
  sueldo_x_ipc: number | null
  sueldo_pagado: number | null
  anticipos_descontados: number
  saldo_pendiente: number
  estado: string
  empleado: Empleado
  // Parámetros del período
  monto_a: number | null
  monto_b: number | null
  francos_cantidad: number | null
  valor_por_dia: number | null
  dias_trabajados: number | null
  valor_por_hora: number | null
  horas_mes: number | null
  varios: number | null
  valor_franco: number | null
  vacaciones: number | null
  premio: number | null
  observaciones: string | null
}

interface Pago {
  id: string
  periodo_id: string | null
  empleado_id: string
  tipo: string
  fecha: string
  monto: number
  descripcion: string | null
  cuenta_destino_id: string | null
  medio_pago?: string | null
  empleado?: { nombre: string }
}

interface CuentaEmpleado {
  id: string
  empleado_id: string
  banco: string
  alias: string | null
}

// ── Utilidades ────────────────────────────────────────────────────────────────

const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_LONG  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const MES_MIN = { anio: 2026, mes: 1 }  // Ene 2026
const MES_MAX = { anio: 2026, mes: 6 }  // Jun 2026

function formatoMoneda(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(v)
}

function tipoLabel(tipo: string | undefined): string {
  const map: Record<string, string> = {
    'ab_francos':   'A+B Francos',
    'por_dia':      'Por Día',
    'plano_ipc':    'Plano IPC',
    'por_hora_ipc': 'Por Hora IPC',
  }
  return map[tipo ?? ''] ?? (tipo ?? '—')
}

function estadoBadge(estado: string) {
  const styles: Record<string, string> = {
    'proyectado': 'bg-gray-100 text-gray-600',
    'abierto':    'bg-blue-100 text-blue-700',
    'cerrado':    'bg-green-100 text-green-700',
    'historico':  'bg-gray-100 text-gray-400',
  }
  const cls = styles[estado] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${cls}`}>
      {estado}
    </span>
  )
}

function empresaBadge(empresa: string) {
  const cls = empresa === 'MSA'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : empresa === 'PAM'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : 'bg-yellow-50 text-yellow-700 border-yellow-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${cls}`}>{empresa}</span>
  )
}

function mesKey(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2,'0')}`
}

// ── Componente principal ──────────────────────────────────────────────────────

export function TabSueldos() {
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [cuentas, setCuentas] = useState<CuentaEmpleado[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [cargando, setCargando] = useState(true)
  const [mesActual, setMesActual] = useState<{ anio: number; mes: number }>(() => {
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes  = hoy.getMonth() + 1
    // Clamp dentro del rango disponible
    if (anio < MES_MIN.anio || (anio === MES_MIN.anio && mes < MES_MIN.mes)) return MES_MIN
    if (anio > MES_MAX.anio || (anio === MES_MAX.anio && mes > MES_MAX.mes)) return MES_MAX
    return { anio, mes }
  })

  // Modal anticipo / pago saldo
  const [modalAnticipo, setModalAnticipo] = useState(false)
  const [antEmpId, setAntEmpId] = useState('')
  const [antTipo, setAntTipo] = useState<'anticipo' | 'sueldo'>('anticipo')
  const [antMonto, setAntMonto] = useState('')
  const [antFecha, setAntFecha] = useState(new Date().toISOString().split('T')[0])
  const [antCuenta, setAntCuenta] = useState('')
  const [antDesc, setAntDesc] = useState('')
  const [antEstado, setAntEstado] = useState('pagar')
  const [antMedioPago, setAntMedioPago] = useState('banco')
  const [antMesAplicado, setAntMesAplicado] = useState<{ anio: number; mes: number }>({ anio: 2026, mes: 3 })
  const [guardando, setGuardando] = useState(false)

  // Modal historial
  const [modalHistorial, setModalHistorial] = useState(false)
  const [historial, setHistorial] = useState<Periodo[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  // Modal edición parámetros
  const [modalEdicion, setModalEdicion] = useState(false)
  const [edPeriodo, setEdPeriodo] = useState<Periodo | null>(null)
  const [edMontoA, setEdMontoA] = useState('')
  const [edMontoB, setEdMontoB] = useState('')
  const [edFrancos, setEdFrancos] = useState('')
  const [edValorDia, setEdValorDia] = useState('')
  const [edDias, setEdDias] = useState('')
  const [edValorHora, setEdValorHora] = useState('')
  const [edHoras, setEdHoras] = useState('')
  const [edVarios, setEdVarios] = useState('')
  const [edValorFranco, setEdValorFranco] = useState('')
  const [francoAutoSync, setFrancoAutoSync] = useState(true)
  const [edVacaciones, setEdVacaciones] = useState('')
  const [edPremio, setEdPremio] = useState('')
  const [edObservaciones, setEdObservaciones] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  // Modal propagar
  const [modalPropagar, setModalPropagar] = useState(false)
  const [propagarData, setPropagandoData] = useState<{ updateData: Record<string, any>; nuevoBruto: number } | null>(null)

  // Modal edición pago
  const [editandoPago, setEditandoPago] = useState<Pago | null>(null)

  // ── Cargar datos del mes seleccionado ──────────────────────────────────────

  const cargar = async () => {
    setCargando(true)

    // Primero cargamos los períodos del mes para obtener sus IDs
    const { data: pdata } = await supabase
      .from('sueldos_periodos')
      .select('*, empleado:sueldos_empleados(*)')
      .eq('anio', mesActual.anio)
      .eq('mes', mesActual.mes)
      .order('empleado(nombre)')

    const periodoIds = (pdata ?? []).map((p: any) => p.id)

    // Cuentas y pagos en paralelo; pagos filtrados por periodo_id (mes asignado, no fecha de pago)
    const [{ data: cdata }, { data: pagoData }] = await Promise.all([
      supabase
        .from('sueldos_cuentas_empleado')
        .select('*')
        .eq('activo', true),

      periodoIds.length > 0
        ? supabase
            .from('sueldos_pagos')
            .select('*, empleado:sueldos_empleados(nombre)')
            .in('periodo_id', periodoIds)
            .order('fecha', { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null }),
    ])

    // Filtrar empleados según fecha_ingreso/fecha_egreso
    const primerDiaMes = new Date(mesActual.anio, mesActual.mes - 1, 1)
    const ultimoDiaMes = new Date(mesActual.anio, mesActual.mes, 0)
    const periodosFiltrados = (pdata ?? []).filter((p: any) => {
      const emp = p.empleado
      if (!emp) return true
      if (emp.fecha_ingreso && new Date(emp.fecha_ingreso) > ultimoDiaMes) return false
      if (emp.fecha_egreso && new Date(emp.fecha_egreso) < primerDiaMes) return false
      return true
    })
    setPeriodos(periodosFiltrados as Periodo[])
    setCuentas((cdata ?? []) as CuentaEmpleado[])
    setPagos((pagoData ?? []) as Pago[])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [mesActual])

  // ── Navegación de mes ──────────────────────────────────────────────────────

  const puedeRetroceder = !(mesActual.anio === MES_MIN.anio && mesActual.mes === MES_MIN.mes)
  const puedeAvanzar    = !(mesActual.anio === MES_MAX.anio && mesActual.mes === MES_MAX.mes)

  const navMes = (delta: number) => {
    const d = new Date(mesActual.anio, mesActual.mes - 1 + delta, 1)
    setMesActual({ anio: d.getFullYear(), mes: d.getMonth() + 1 })
  }

  // ── Totales ───────────────────────────────────────────────────────────────

  const totalBruto    = periodos.reduce((s, p) => s + (p.bruto_calculado ?? 0), 0)
  const totalAnticipos= periodos.reduce((s, p) => s + (p.anticipos_descontados ?? 0), 0)
  const totalSaldo    = periodos.reduce((s, p) => s + (p.saldo_pendiente ?? 0), 0)

  // ── Registrar anticipo ────────────────────────────────────────────────────

  const abrirAnticipo = (empleadoId?: string, tipo: 'anticipo' | 'sueldo' = 'anticipo') => {
    if (empleadoId) setAntEmpId(empleadoId)
    else setAntEmpId('')
    setAntTipo(tipo)
    // Pago Saldo: pre-llenar con el saldo pendiente del empleado
    if (tipo === 'sueldo' && empleadoId) {
      const periodo = periodos.find(p => p.empleado_id === empleadoId)
      const saldo = periodo?.saldo_pendiente ?? 0
      setAntMonto(saldo > 0 ? saldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
    } else {
      setAntMonto('')
    }
    setAntFecha(new Date().toISOString().split('T')[0])
    setAntCuenta('__none__')
    setAntDesc('')
    setAntMedioPago('banco')
    setModalAnticipo(true)
  }

  const registrarAnticipo = async () => {
    const monto = parseFloat(antMonto.replace(/\./g, '').replace(',', '.')) || 0
    if (!antEmpId || !monto || monto <= 0 || !antFecha) return
    setGuardando(true)

    const periodo = periodos.find(p => p.empleado_id === antEmpId)

    if (editandoPago) {
      // MODO EDICIÓN
      // Período viejo: el que tiene asignado el pago actualmente
      let periodoViejo: any = periodos.find(p => p.id === editandoPago.periodo_id) ?? null
      if (!periodoViejo && editandoPago.periodo_id) {
        const { data } = await supabase.from('sueldos_periodos').select('*').eq('id', editandoPago.periodo_id).maybeSingle()
        periodoViejo = data
      }

      // Período nuevo: el mes seleccionado por el usuario
      let periodoNuevo: any = null
      if (antMesAplicado.anio === mesActual.anio && antMesAplicado.mes === mesActual.mes) {
        periodoNuevo = periodos.find(p => p.empleado_id === antEmpId) ?? null
      } else {
        const { data } = await supabase.from('sueldos_periodos').select('*')
          .eq('empleado_id', antEmpId)
          .eq('anio', antMesAplicado.anio)
          .eq('mes', antMesAplicado.mes)
          .maybeSingle()
        periodoNuevo = data
      }

      const cambioPeriodo = periodoViejo?.id !== periodoNuevo?.id

      // Actualizar el pago (incluye periodo_id si cambió)
      await supabase.from('sueldos_pagos').update({
        fecha: antFecha,
        monto,
        cuenta_destino_id: antCuenta && antCuenta !== '__none__' ? antCuenta : null,
        descripcion: antDesc || null,
        estado: antEstado,
        medio_pago: antMedioPago,
        ...(cambioPeriodo && periodoNuevo ? { periodo_id: periodoNuevo.id } : {}),
      }).eq('id', editandoPago.id)

      if (cambioPeriodo) {
        // Revertir del período viejo
        if (periodoViejo) {
          const antSinViejo = Math.max(0, (periodoViejo.anticipos_descontados ?? 0) - editandoPago.monto)
          await supabase.from('sueldos_periodos').update({
            anticipos_descontados: antSinViejo,
            saldo_pendiente: (periodoViejo.bruto_calculado ?? 0) - antSinViejo,
          }).eq('id', periodoViejo.id)
        }
        // Aplicar al período nuevo
        if (periodoNuevo) {
          const antNuevo = (periodoNuevo.anticipos_descontados ?? 0) + monto
          await supabase.from('sueldos_periodos').update({
            anticipos_descontados: antNuevo,
            saldo_pendiente: (periodoNuevo.bruto_calculado ?? 0) - antNuevo,
          }).eq('id', periodoNuevo.id)
        }
      } else {
        // Mismo período, ajustar por cambio de monto
        if (periodoNuevo) {
          const antSinViejo = (periodoNuevo.anticipos_descontados ?? 0) - editandoPago.monto
          const antNuevo    = antSinViejo + monto
          await supabase.from('sueldos_periodos').update({
            anticipos_descontados: antNuevo,
            saldo_pendiente: (periodoNuevo.bruto_calculado ?? 0) - antNuevo,
          }).eq('id', periodoNuevo.id)
        }
      }
    } else {
      // MODO CREACIÓN
      const { error: errPago } = await supabase
        .from('sueldos_pagos')
        .insert({
          periodo_id:        periodo?.id ?? null,
          empleado_id:       antEmpId,
          tipo:              antTipo,
          fecha:             antFecha,
          monto,
          cuenta_destino_id: antCuenta && antCuenta !== '__none__' ? antCuenta : null,
          descripcion:       antDesc || `${antTipo === 'sueldo' ? 'Pago Saldo' : 'Anticipo'} ${MESES_SHORT[mesActual.mes - 1]} ${mesActual.anio}`,
          estado:            antEstado,
          medio_pago:        antMedioPago,
        })

      if (!errPago && periodo) {
        const nuevosAnticipos = (periodo.anticipos_descontados ?? 0) + monto
        const nuevoSaldo      = (periodo.saldo_pendiente ?? 0) - monto
        await supabase
          .from('sueldos_periodos')
          .update({ anticipos_descontados: nuevosAnticipos, saldo_pendiente: nuevoSaldo })
          .eq('id', periodo.id)
      }
    }

    setGuardando(false)
    setModalAnticipo(false)
    setEditandoPago(null)
    setAntEmpId('')
    setAntTipo('anticipo')
    setAntMonto('')
    setAntFecha(new Date().toISOString().split('T')[0])
    setAntCuenta('__none__')
    setAntDesc('')
    setAntEstado('pagar')
    setAntMedioPago('banco')
    setAntMesAplicado(mesActual)
    await cargar()
  }

  // ── Editar / Eliminar pago ────────────────────────────────────────────────

  const abrirEdicionPago = (pago: Pago) => {
    setEditandoPago(pago)
    setAntEmpId(pago.empleado_id)
    setAntMonto(pago.monto ? pago.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
    setAntFecha(pago.fecha)
    setAntCuenta(pago.cuenta_destino_id ?? '__none__')
    setAntDesc(pago.descripcion ?? '')
    setAntEstado((pago as any).estado ?? 'pagar')
    // Mes al que pertenece el pago: buscarlo en los períodos cargados
    const periodoPago = periodos.find(p => p.id === pago.periodo_id)
    setAntMesAplicado(periodoPago ? { anio: periodoPago.anio, mes: periodoPago.mes } : mesActual)
    setModalAnticipo(true)
  }

  const eliminarPago = async (pago: Pago) => {
    if (!window.confirm(`¿Eliminar este ${pago.tipo} de ${formatoMoneda(pago.monto)}? Esta acción no se puede deshacer.`)) return

    // Revertir anticipos_descontados y saldo_pendiente en el período vinculado
    if (pago.periodo_id) {
      const periodo = periodos.find(p => p.id === pago.periodo_id)
      if (periodo) {
        const nuevosAnticipos = Math.max(0, (periodo.anticipos_descontados ?? 0) - pago.monto)
        const nuevoSaldo = (periodo.bruto_calculado ?? 0) - nuevosAnticipos
        await supabase
          .from('sueldos_periodos')
          .update({ anticipos_descontados: nuevosAnticipos, saldo_pendiente: nuevoSaldo })
          .eq('id', periodo.id)
      }
    }

    await supabase.from('sueldos_pagos').delete().eq('id', pago.id)
    await cargar()
  }

  // ── Edición parámetros del período ────────────────────────────────────────

  const num = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0

  const calcularBruto = (tipo: string, a: number, b: number, francos: number, valorFranco: number, vdia: number, dias: number, vhora: number, horas: number, varios: number, vacaciones = 0, premio = 0) => {
    const extras = varios + vacaciones + premio
    switch (tipo) {
      case 'ab_francos':   return (a + b) + (valorFranco * francos) + extras
      case 'por_dia':      return vdia * dias + extras
      case 'por_hora_ipc': return vhora * horas + extras
      case 'plano_ipc':    return a + extras
      default:             return (edPeriodo?.bruto_calculado ?? 0) + extras
    }
  }

  const abrirEdicion = (p: Periodo) => {
    setEdPeriodo(p)
    const fmt = (v: number | null, decimales = 2) =>
      v !== null && v !== 0 ? v.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) : ''
    setEdMontoA(p.empleado?.tipo_empleado === 'plano_ipc'
      ? fmt(p.bruto_calculado)
      : (p.monto_a !== null ? fmt(p.monto_a) : '')
    )
    setEdMontoB(p.monto_b !== null ? fmt(p.monto_b) : '')
    setEdFrancos(p.francos_cantidad !== null ? String(p.francos_cantidad).replace('.', ',') : '')
    setEdValorDia(p.valor_por_dia !== null ? fmt(p.valor_por_dia) : '')
    setEdDias(p.dias_trabajados !== null ? String(p.dias_trabajados) : '')
    setEdValorHora(p.valor_por_hora !== null ? fmt(p.valor_por_hora) : '')
    setEdHoras(p.horas_mes !== null ? String(p.horas_mes) : '')
    setEdVarios(p.varios !== null && p.varios !== 0 ? fmt(p.varios) : '')
    setEdVacaciones(p.vacaciones !== null && p.vacaciones !== 0 ? fmt(p.vacaciones) : '')
    setEdPremio(p.premio !== null && p.premio !== 0 ? fmt(p.premio) : '')
    setEdObservaciones(p.observaciones ?? '')
    // Valor franco: si tiene uno guardado, usarlo; sino calcular de A+B
    if (p.valor_franco !== null && p.valor_franco !== undefined) {
      setEdValorFranco(fmt(p.valor_franco))
      setFrancoAutoSync(false)
    } else {
      const vf = p.monto_a !== null && p.monto_b !== null ? (p.monto_a + p.monto_b) / 25 : 0
      setEdValorFranco(fmt(vf))
      setFrancoAutoSync(true)
    }
    setModalEdicion(true)
  }

  // Sincronizar valor franco cuando cambia A o B (solo si no fue editado manualmente)
  const fmtFranco = (v: number) =>
    v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const onChangeA = (v: string) => {
    setEdMontoA(v)
    if (francoAutoSync) {
      const vf = (num(v) + num(edMontoB)) / 25
      setEdValorFranco(fmtFranco(vf))
    }
  }
  const onChangeB = (v: string) => {
    setEdMontoB(v)
    if (francoAutoSync) {
      const vf = (num(edMontoA) + num(v)) / 25
      setEdValorFranco(fmtFranco(vf))
    }
  }
  const onChangeFrancoManual = (v: string) => {
    setEdValorFranco(v)
    setFrancoAutoSync(false)
  }
  const resetFrancoAuto = () => {
    const vf = (num(edMontoA) + num(edMontoB)) / 25
    setEdValorFranco(fmtFranco(vf))
    setFrancoAutoSync(true)
  }

  const guardarEdicion = async () => {
    if (!edPeriodo) return
    setGuardandoEdicion(true)
    const tipo      = edPeriodo.empleado?.tipo_empleado
    const a         = num(edMontoA)
    const b         = num(edMontoB)
    const francos   = num(edFrancos)
    const vf        = num(edValorFranco)
    const vdia      = num(edValorDia)
    const dias      = parseInt(edDias) || 0
    const vhora     = num(edValorHora)
    const horas     = parseInt(edHoras) || 0
    const varios    = num(edVarios)
    const vacaciones = num(edVacaciones)
    const premio    = num(edPremio)

    const nuevoBruto = calcularBruto(tipo, a, b, francos, vf, vdia, dias, vhora, horas, varios, vacaciones, premio)
    const nuevoSaldo = nuevoBruto - (edPeriodo.anticipos_descontados ?? 0)

    const updateData: Record<string, any> = {
      varios,
      vacaciones: vacaciones || null,
      premio: premio || null,
      observaciones: edObservaciones.trim() || null,
      bruto_calculado: nuevoBruto,
      saldo_pendiente: nuevoSaldo,
    }
    if (tipo === 'ab_francos') {
      updateData.monto_a = a
      updateData.monto_b = b
      updateData.francos_cantidad = francos
      updateData.valor_franco = francoAutoSync ? null : vf
    } else if (tipo === 'por_dia') {
      updateData.valor_por_dia = vdia
      updateData.dias_trabajados = dias
    } else if (tipo === 'por_hora_ipc') {
      updateData.valor_por_hora = vhora
      updateData.horas_mes = horas
    } else if (tipo === 'plano_ipc') {
      updateData.monto_a = a
    }

    await supabase.from('sueldos_periodos').update(updateData).eq('id', edPeriodo.id)

    setGuardandoEdicion(false)
    setModalEdicion(false)
    // Mostrar modal para propagar (sin bloquear el cierre del modal de edición)
    setPropagandoData({ updateData, nuevoBruto })
    setModalPropagar(true)
  }

  const ejecutarPropagar = async (propagar: boolean) => {
    setModalPropagar(false)
    if (propagar && edPeriodo && propagarData) {
      const { data: siguientes } = await supabase
        .from('sueldos_periodos')
        .select('id, anticipos_descontados')
        .eq('empleado_id', edPeriodo.empleado_id)
        .or(`anio.gt.${edPeriodo.anio},and(anio.eq.${edPeriodo.anio},mes.gt.${edPeriodo.mes})`)

      if (siguientes && siguientes.length > 0) {
        await Promise.all(siguientes.map((sig: any) => {
          const sigSaldo = propagarData.nuevoBruto - (sig.anticipos_descontados ?? 0)
          return supabase
            .from('sueldos_periodos')
            .update({ ...propagarData.updateData, saldo_pendiente: sigSaldo })
            .eq('id', sig.id)
        }))
      }
    }
    setPropagandoData(null)
    await cargar()
  }

  // Bruto preview en tiempo real
  const brutoPreview = edPeriodo
    ? calcularBruto(
        edPeriodo.empleado?.tipo_empleado,
        num(edMontoA), num(edMontoB), num(edFrancos),
        num(edValorFranco),
        num(edValorDia), parseInt(edDias) || 0,
        num(edValorHora), parseInt(edHoras) || 0,
        num(edVarios), num(edVacaciones), num(edPremio),
      )
    : 0

  // ── Historial ─────────────────────────────────────────────────────────────

  const abrirHistorial = async () => {
    setCargandoHistorial(true)
    setModalHistorial(true)
    const { data } = await supabase
      .from('sueldos_periodos')
      .select('*, empleado:sueldos_empleados(id, nombre, tipo_empleado, empresa)')
      .gte('fecha_inicio_periodo', '2026-02-01')
      .order('mes')
    setHistorial((data ?? []) as Periodo[])
    setCargandoHistorial(false)
  }

  // empleados únicos (para filas del pivot)
  const empleadosUnicos: Empleado[] = [
    ...new Map(
      historial
        .filter(p => p.empleado)
        .map(p => [p.empleado_id, p.empleado])
    ).values()
  ]
  const mesesHistorial = [2, 3, 4, 5, 6]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 p-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sueldos</h2>
          <p className="text-sm text-gray-500">Campaña 25/26 · {periodos.length} empleados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={abrirHistorial}>
            <History className="h-4 w-4 mr-2" />
            Historial
          </Button>
          <Button onClick={() => abrirAnticipo()}>
            <Plus className="h-4 w-4 mr-2" />
            Registrar Anticipo
          </Button>
        </div>
      </div>

      {/* Navegación de mes */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navMes(-1)} disabled={!puedeRetroceder}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold min-w-[150px] text-center">
          {MESES_LONG[mesActual.mes - 1]} {mesActual.anio}
        </span>
        <Button variant="ghost" size="icon" onClick={() => navMes(1)} disabled={!puedeAvanzar}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Users className="h-4 w-4" /> Empleados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodos.length}</div>
            <p className="text-xs text-gray-400">activos en campaña</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Bruto Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-700">{formatoMoneda(totalBruto)}</div>
            <p className="text-xs text-gray-400">calculado del mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4" /> Anticipos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-600">{formatoMoneda(totalAnticipos)}</div>
            <p className="text-xs text-gray-400">descontados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Saldo Pendiente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-700">{formatoMoneda(totalSaldo)}</div>
            <p className="text-xs text-gray-400">a pagar fin de mes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de empleados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {MESES_LONG[mesActual.mes - 1]} {mesActual.anio}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cargando ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Empleado</TableHead>
                  <TableHead>Emp.</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Anticipos</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">IPC Ref.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-400 py-10">
                      No hay períodos para este mes
                    </TableCell>
                  </TableRow>
                )}
                {periodos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <div>{p.empleado?.nombre}</div>
                      {/* Indicadores extras del período */}
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {p.vacaciones ? (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0 rounded">
                            Vac +{formatoMoneda(p.vacaciones)}
                          </span>
                        ) : null}
                        {p.premio ? (
                          <span className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0 rounded">
                            Premio +{formatoMoneda(p.premio)}
                          </span>
                        ) : null}
                        {p.observaciones ? (
                          <span className="text-xs text-gray-400 italic" title={p.observaciones}>
                            {p.observaciones.length > 40 ? p.observaciones.slice(0, 40) + '…' : p.observaciones}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{empresaBadge(p.empleado?.empresa ?? '')}</TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">{tipoLabel(p.empleado?.tipo_empleado)}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatoMoneda(p.bruto_calculado)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-orange-600">
                      {(p.anticipos_descontados ?? 0) > 0 ? formatoMoneda(p.anticipos_descontados) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-green-700">
                      {formatoMoneda(p.saldo_pendiente)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-gray-400">
                      {p.sueldo_x_ipc && p.sueldo_x_ipc !== p.bruto_calculado
                        ? formatoMoneda(p.sueldo_x_ipc)
                        : '—'}
                    </TableCell>
                    <TableCell>{estadoBadge(p.estado)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2"
                          onClick={() => abrirEdicion(p)}
                          title="Editar parámetros del mes"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2"
                          onClick={() => abrirAnticipo(p.empleado_id, 'anticipo')}
                        >
                          + Anticipo
                        </Button>
                        {(p.saldo_pendiente ?? 0) > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2 text-green-700"
                            onClick={() => abrirAnticipo(p.empleado_id, 'sueldo')}
                            title="Registrar pago del saldo restante"
                          >
                            + Saldo
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagos del mes */}
      {pagos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Pagos registrados — {MESES_LONG[mesActual.mes - 1]} {mesActual.anio}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...pagos].sort((a, b) => (a.empleado?.nombre ?? '').localeCompare(b.empleado?.nombre ?? '')).map(pago => (
                  <TableRow key={pago.id}>
                    <TableCell className="text-sm tabular-nums">
                      {pago.fecha.split('-').reverse().join('/')}
                    </TableCell>
                    <TableCell>{pago.empleado?.nombre}</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs capitalize ${
                        pago.tipo === 'anticipo' ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'
                      }`}>
                        {pago.tipo}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{pago.descripcion}</TableCell>
                    <TableCell>
                      {(() => {
                        const mp = (pago as any).medio_pago ?? 'banco'
                        const esBanco = mp === 'banco'
                        const label = mp === 'banco' ? 'Banco' : mp === 'caja_general' ? 'Caja' : mp === 'caja_ams' ? 'Caja AMS' : mp === 'caja_sigot' ? 'Caja Sigot' : mp
                        return (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${esBanco ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {label}
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatoMoneda(pago.monto)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => abrirEdicionPago(pago)}
                          className="text-gray-300 hover:text-blue-500 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => eliminarPago(pago)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Modal Edición Parámetros ── */}
      <Dialog open={modalEdicion} onOpenChange={setModalEdicion}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {edPeriodo?.empleado?.nombre} — {MESES_LONG[(edPeriodo?.mes ?? 1) - 1]} {edPeriodo?.anio}
            </DialogTitle>
          </DialogHeader>

          {edPeriodo && (
            <div className="space-y-4 py-2">

              {/* ab_francos */}
              {edPeriodo.empleado?.tipo_empleado === 'ab_francos' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Categoría A</Label>
                      <Input
                        type="text"
                        placeholder="0,00"
                        value={edMontoA}
                        onChange={e => onChangeA(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Categoría B</Label>
                      <Input
                        type="text"
                        placeholder="0,00"
                        value={edMontoB}
                        onChange={e => onChangeB(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Cant. francos trabajados</Label>
                      <Input
                        type="text"
                        placeholder="0"
                        value={edFrancos}
                        onChange={e => setEdFrancos(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Valor franco</Label>
                        {!francoAutoSync && (
                          <button
                            onClick={resetFrancoAuto}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            ↺ Recalcular de A+B
                          </button>
                        )}
                      </div>
                      <Input
                        type="text"
                        placeholder="0,00"
                        value={francoAutoSync ? formatoMoneda(num(edValorFranco)).replace('$','').trim() : edValorFranco}
                        onChange={e => onChangeFrancoManual(e.target.value)}
                        className={francoAutoSync ? 'bg-gray-50 text-gray-500' : ''}
                      />
                      {francoAutoSync && (
                        <p className="text-xs text-gray-400 mt-0.5">Calculado de (A+B)/25 · editar para fijar valor</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* por_dia */}
              {edPeriodo.empleado?.tipo_empleado === 'por_dia' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor día</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={edValorDia}
                      onChange={e => setEdValorDia(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Días trabajados</Label>
                    <Input
                      type="text"
                      placeholder="0"
                      value={edDias}
                      onChange={e => setEdDias(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* por_hora_ipc */}
              {edPeriodo.empleado?.tipo_empleado === 'por_hora_ipc' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor hora</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={edValorHora}
                      onChange={e => setEdValorHora(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Horas del mes</Label>
                    <Input
                      type="text"
                      placeholder="0"
                      value={edHoras}
                      onChange={e => setEdHoras(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* plano_ipc */}
              {edPeriodo.empleado?.tipo_empleado === 'plano_ipc' && (
                <div>
                  <Label>Sueldo</Label>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={edMontoA}
                    onChange={e => setEdMontoA(e.target.value)}
                  />
                </div>
              )}

              {/* Varios — todos los tipos */}
              <div>
                <Label>Varios (combustible, reintegros, etc.)</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={edVarios}
                  onChange={e => setEdVarios(e.target.value)}
                />
              </div>

              {/* Vacaciones y Premio — opcionales */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vacaciones</Label>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={edVacaciones}
                    onChange={e => setEdVacaciones(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Premio</Label>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={edPremio}
                    onChange={e => setEdPremio(e.target.value)}
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <Label>Observaciones</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={2}
                  placeholder="Notas del mes (se muestra en el resumen)..."
                  value={edObservaciones}
                  onChange={e => setEdObservaciones(e.target.value)}
                />
              </div>

              {/* Preview bruto */}
              <div className="rounded-md bg-gray-50 px-4 py-3 flex justify-between items-center border">
                <span className="text-sm text-gray-500">Bruto calculado</span>
                <span className="text-lg font-bold text-blue-700 font-mono">
                  {formatoMoneda(brutoPreview)}
                </span>
              </div>

            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEdicion(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarEdicion} disabled={guardandoEdicion}>
              {guardandoEdicion ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Anticipo / Pago Saldo ── */}
      <Dialog open={modalAnticipo} onOpenChange={v => { setModalAnticipo(v); if (!v) { setEditandoPago(null); setAntTipo('anticipo') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editandoPago ? 'Editar Pago' : antTipo === 'sueldo' ? 'Registrar Pago Saldo' : 'Registrar Anticipo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Selector tipo — solo en creación */}
            {!editandoPago && (
              <div>
                <Label>Tipo de pago</Label>
                <Select value={antTipo} onValueChange={(v: 'anticipo' | 'sueldo') => {
                  setAntTipo(v)
                  if (v === 'sueldo' && antEmpId) {
                    const periodo = periodos.find(p => p.empleado_id === antEmpId)
                    const saldo = periodo?.saldo_pendiente ?? 0
                    setAntMonto(saldo > 0 ? saldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anticipo">Anticipo (pago parcial)</SelectItem>
                    <SelectItem value="sueldo">Pago Saldo (cierre del mes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Empleado *</Label>
              <Select value={antEmpId} onValueChange={setAntEmpId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado..." />
                </SelectTrigger>
                <SelectContent>
                  {periodos.map(p => (
                    <SelectItem key={p.empleado_id} value={p.empleado_id}>
                      {p.empleado?.nombre}
                      {(p.saldo_pendiente ?? 0) > 0 && (
                        <span className="ml-2 text-xs text-gray-400">
                          (saldo: {formatoMoneda(p.saldo_pendiente)})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selector mes aplicado — solo en edición */}
            {editandoPago && (
              <div>
                <Label>Mes al que se imputa</Label>
                <Select
                  value={`${antMesAplicado.anio}-${antMesAplicado.mes}`}
                  onValueChange={v => {
                    const [a, m] = v.split('-').map(Number)
                    setAntMesAplicado({ anio: a, mes: m })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const opts = []
                      let a = MES_MIN.anio, m = MES_MIN.mes
                      while (a < MES_MAX.anio || (a === MES_MAX.anio && m <= MES_MAX.mes)) {
                        opts.push({ anio: a, mes: m })
                        m++; if (m > 12) { m = 1; a++ }
                      }
                      return opts.map(o => (
                        <SelectItem key={`${o.anio}-${o.mes}`} value={`${o.anio}-${o.mes}`}>
                          {MESES_LONG[o.mes - 1]} {o.anio}
                        </SelectItem>
                      ))
                    })()}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Monto *</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={antMonto}
                onChange={e => setAntMonto(e.target.value)}
              />
            </div>

            <div>
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={antFecha}
                onChange={e => setAntFecha(e.target.value)}
              />
            </div>

            {antEmpId && cuentas.filter(c => c.empleado_id === antEmpId).length > 0 && (
              <div>
                <Label>Cuenta destino</Label>
                <Select value={antCuenta} onValueChange={setAntCuenta}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin especificar</SelectItem>
                    {cuentas
                      .filter(c => c.empleado_id === antEmpId)
                      .map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.alias ?? c.banco}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Descripción</Label>
              <Input
                placeholder={`${antTipo === 'sueldo' ? 'Pago Saldo' : 'Anticipo'} ${MESES_SHORT[mesActual.mes - 1]} ${mesActual.anio}`}
                value={antDesc}
                onChange={e => setAntDesc(e.target.value)}
              />
            </div>

            <div>
              <Label>Estado en Cash Flow</Label>
              <Select value={antEstado} onValueChange={setAntEstado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagar">pagar</SelectItem>
                  <SelectItem value="programado">programado</SelectItem>
                  <SelectItem value="pendiente">pendiente</SelectItem>
                  <SelectItem value="pagado">pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Medio de Pago</Label>
              <Select value={antMedioPago} onValueChange={setAntMedioPago}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banco">Banco</SelectItem>
                  <SelectItem value="caja_general">Caja General</SelectItem>
                  <SelectItem value="caja_ams">Caja AMS</SelectItem>
                  <SelectItem value="caja_sigot">Caja Sigot</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalAnticipo(false); setEditandoPago(null) }}>
              Cancelar
            </Button>
            <Button
              onClick={registrarAnticipo}
              disabled={guardando || !antEmpId || !antMonto}
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editandoPago ? 'Guardar cambios' : antTipo === 'sueldo' ? 'Registrar Pago Saldo' : 'Registrar Anticipo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Propagar parámetros ── */}
      <Dialog open={modalPropagar} onOpenChange={setModalPropagar}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Propagar parámetros?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            ¿Querés aplicar los mismos valores a todos los meses siguientes de{' '}
            <span className="font-semibold">{edPeriodo?.empleado?.nombre}</span>?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => ejecutarPropagar(false)}>
              No, solo este mes
            </Button>
            <Button onClick={() => ejecutarPropagar(true)}>
              Sí, propagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Historial (pivot) ── */}
      <Dialog open={modalHistorial} onOpenChange={setModalHistorial}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Historial Campaña 25/26 — Feb a Jun 2026</DialogTitle>
          </DialogHeader>

          {cargandoHistorial ? (
            <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="min-w-[140px]">Empleado</TableHead>
                    <TableHead>Emp.</TableHead>
                    {mesesHistorial.map(m => (
                      <TableHead key={m} className="text-right min-w-[110px]">
                        {MESES_SHORT[m - 1]} 2026
                      </TableHead>
                    ))}
                    <TableHead className="text-right min-w-[110px] font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empleadosUnicos.map(emp => {
                    const perMes: Record<number, Periodo> = {}
                    historial
                      .filter(p => p.empleado_id === emp.id)
                      .forEach(p => { perMes[p.mes] = p })

                    const totalEmp = Object.values(perMes).reduce(
                      (s, p) => s + (p.saldo_pendiente ?? 0), 0
                    )

                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.nombre}</TableCell>
                        <TableCell>{empresaBadge(emp.empresa)}</TableCell>
                        {mesesHistorial.map(m => {
                          const p = perMes[m]
                          return (
                            <TableCell key={m} className="text-right">
                              {p ? (
                                <div>
                                  <div className="font-mono text-sm font-semibold text-green-700">
                                    {formatoMoneda(p.saldo_pendiente)}
                                  </div>
                                  {(p.anticipos_descontados ?? 0) > 0 && (
                                    <div className="font-mono text-xs text-orange-500">
                                      −{formatoMoneda(p.anticipos_descontados)}
                                    </div>
                                  )}
                                  <div className="text-xs mt-0.5">{estadoBadge(p.estado)}</div>
                                </div>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right font-mono font-bold text-blue-700">
                          {formatoMoneda(totalEmp)}
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {/* Fila totales */}
                  <TableRow className="bg-gray-50 border-t-2">
                    <TableCell colSpan={2} className="font-bold text-sm">TOTAL</TableCell>
                    {mesesHistorial.map(m => {
                      const totalMes = historial
                        .filter(p => p.mes === m)
                        .reduce((s, p) => s + (p.saldo_pendiente ?? 0), 0)
                      return (
                        <TableCell key={m} className="text-right font-mono font-bold text-blue-700">
                          {formatoMoneda(totalMes)}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-right font-mono font-bold text-blue-700">
                      {formatoMoneda(historial.reduce((s, p) => s + (p.saldo_pendiente ?? 0), 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
