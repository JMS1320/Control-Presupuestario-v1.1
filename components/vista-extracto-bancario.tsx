"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { CategCombobox } from "@/components/ui/categ-combobox"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useCuentasContables } from "@/hooks/useCuentasContables"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Banknote,
  Settings,
  Play,
  FileSpreadsheet,
  Upload,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Edit,
  Save,
  X,
  Search,
  Check,
  ChevronsUpDown,
  Filter,
  RefreshCw,
  Plus,
  Columns,
  DollarSign,
  Loader2,
  Info,
  ChevronDown
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { ConfiguradorReglas } from "./configurador-reglas"
import { ConfiguradorReglasContable } from "./configurador-reglas-contable"
import { useMotorConciliacion, CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { useMovimientosBancarios } from "@/hooks/useMovimientosBancarios"
import { supabase } from "@/lib/supabase"

// ─── Helpers para scoring de propuestas ARCA ────────────────────────────────

const STOP_WORDS_ARCA = new Set(['s.a', 'sa', 'srl', 'sas', 'de', 'del', 'la', 'el', 'los', 'las', 'por', 'con', 'cta', 'cte', 'deb', 'aut', 'hno', 'hnos', 'ltda', 'and'])

function extraerCuitDeTexto(texto: string | null | undefined): string | null {
  if (!texto) return null
  const match = texto.match(/\b(\d{2}-?\d{8}-?\d)\b/)
  return match ? match[1].replace(/-/g, '') : null
}

function palabrasSignificativas(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length > 3 && !STOP_WORDS_ARCA.has(p))
}

function diasDiferencia(f1: string, f2: string): number {
  return Math.abs((new Date(f1 + 'T12:00:00').getTime() - new Date(f2 + 'T12:00:00').getTime()) / 86400000)
}

interface PropuestaArca { factura: any; score: number; badges: { texto: string; color: string }[] }

function generarPropuestasArca(movimiento: any, facturas: any[]): PropuestaArca[] {
  const cuitLeyenda = extraerCuitDeTexto(movimiento.leyendas_adicionales_2)
  const leyenda1    = movimiento.leyendas_adicionales_1 || ''
  const descripcion = movimiento.descripcion || ''
  const fechaMov    = movimiento.fecha
  const monto       = movimiento.debitos > 0 ? movimiento.debitos : movimiento.creditos

  // Si es compra débito, comparar contra fecha_emision (pago inmediato al generar la FC)
  const esCompraDebito = /d[eé]bito/i.test(descripcion)

  const arcas = facturas.filter(f => f.tipo === 'ARCA')

  const resultados = arcas
    .map(f => {
      const montoFactura  = f.display_monto || 0
      const diffAbs       = Math.abs(montoFactura - monto)
      const diffRel       = monto > 0 ? diffAbs / monto : 1
      const cuitFactura   = (f.cuit || '').replace(/-/g, '')
      const cuitMatch     = !!(cuitLeyenda && cuitFactura && cuitFactura === cuitLeyenda)

      // Filtro: monto muy diferente (>15%) sin CUIT → excluir
      if (diffRel > 0.15 && !cuitMatch) return null

      let score = 0
      const matchMonto  = diffAbs <= 2 || diffRel <= 0.001   // ±$2 ó ±0.1%
      const matchMontoCercano = diffRel <= 0.05              // ±5%

      // ── 1. MONTO (prioridad máxima) ────────────────────────────────────────
      if (matchMonto)        score += 80
      else if (matchMontoCercano) score += 50

      // ── 2. CUIT ─────────────────────────────────────────────────────────────
      if (cuitMatch) score += matchMonto ? 100 : 30   // 100 extra si también hay monto

      // ── 3. FECHA (terciario) ─────────────────────────────────────────────────
      const fechaRef = esCompraDebito && f.fecha_emision ? f.fecha_emision : f.fecha_estimada
      let matchFecha = false
      let diasDiff   = Infinity
      if (fechaRef) {
        diasDiff   = diasDiferencia(fechaMov, fechaRef)
        matchFecha = diasDiff <= 5
        if      (diasDiff <= 1) score += 20
        else if (diasDiff <= 5) score += 10
      }

      // ── 4. NOMBRE/LEYENDA (cuaternario) ─────────────────────────────────────
      const palNombre = palabrasSignificativas(f.display_nombre || '')
      let   matchNombre = false
      for (const fuente of [descripcion, leyenda1]) {
        if (!fuente) continue
        const pal = palabrasSignificativas(fuente)
        if (!pal.length || !palNombre.length) continue
        const coinc = pal.filter(p => palNombre.some(n => n.includes(p) || p.includes(n))).length
        const sim   = coinc / Math.max(pal.length, palNombre.length)
        if (sim >= 0.4) { matchNombre = true; score += 15; break }
        else if (sim > 0) score += Math.round(sim * 15)
      }

      // ── Badges combinados ───────────────────────────────────────────────────
      const badges: { texto: string; color: string }[] = []

      if (matchMonto && cuitMatch && matchFecha) {
        badges.push({ texto: 'Monto + CUIT + Fecha', color: 'bg-green-100 text-green-800' })
      } else if (matchMonto && cuitMatch) {
        badges.push({ texto: 'Monto + CUIT', color: 'bg-green-100 text-green-800' })
      } else if (matchMonto && matchFecha) {
        badges.push({ texto: 'Monto + Fecha', color: 'bg-blue-100 text-blue-800' })
      } else if (matchMonto) {
        const label = matchMontoCercano || diffAbs <= 2 ? 'Monto exacto' : 'Monto ≈'
        badges.push({ texto: label, color: 'bg-purple-100 text-purple-700' })
      } else if (cuitMatch) {
        badges.push({ texto: 'CUIT (monto distinto)', color: 'bg-yellow-100 text-yellow-700' })
      }

      if (matchNombre && !badges.find(b => b.texto.includes('CUIT'))) {
        badges.push({ texto: 'Nombre similar', color: 'bg-orange-100 text-orange-700' })
      }

      return { factura: f, score: Math.round(score), badges }
    })
    .filter((p): p is PropuestaArca => p !== null && p.score > 0)
    .sort((a, b) => b.score - a.score)

  return resultados
}

// ────────────────────────────────────────────────────────────────────────────

export function VistaExtractoBancario() {
  const [configuradorAbierto, setConfiguradorAbierto] = useState(false)
  const [cuentaConfig, setCuentaConfig] = useState('msa_galicia')
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("msa_galicia")
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'conciliado' | 'pendiente' | 'auditar'>('Todos')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState("")
  
  // Hook para validación de categorías
  const { cuentas, validarCateg, buscarSimilares, crearCuentaContable } = useCuentasContables()
  const [editData, setEditData] = useState({
    categ: '',
    nro_cuenta: '' as string | null,
    centro_de_costo: '',
    estado: '',
    contable: '',
    interno: '',
    detalle: ''
  })
  const [facturasDisponibles, setFacturasDisponibles] = useState<any[]>([])
  const [vinculaciones, setVinculaciones] = useState<{[key: string]: string}>({}) // movimiento_id -> factura_id
  
  // Edición inline detalle
  const [editandoDetalleId, setEditandoDetalleId] = useState<string | null>(null)
  const [editandoDetalleVal, setEditandoDetalleVal] = useState('')

  // Estados para Combobox avanzado
  const [comboboxAbierto, setComboboxAbierto] = useState<{[key: string]: boolean}>({})
  const [busquedaCombobox, setBusquedaCombobox] = useState<{[key: string]: string}>({})
  
  // Estados para filtros avanzados extracto bancario
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false)
  const [fechaMovDesde, setFechaMovDesde] = useState('')
  const [fechaMovHasta, setFechaMovHasta] = useState('')
  const [montoDesde, setMontoDesde] = useState('')
  const [montoHasta, setMontoHasta] = useState('')
  const [busquedaCateg, setBusquedaCategExtracto] = useState('')
  const [busquedaDetalle, setBusquedaDetalleExtracto] = useState('')
  const [limiteRegistros, setLimiteRegistros] = useState<number>(200)
  const [filtroCategEspecial, setFiltroCategEspecial] = useState<'invalida' | 'sin_categ' | null>(null)

  // Multi-select categ (filtro client-side tipo Excel)
  const [categsFiltro, setCategsFiltro] = useState<Set<string> | null>(null) // null = sin filtro (mostrar todas)
  const [categFiltroAbierto, setCategFiltroAbierto] = useState(false)
  const [categFiltroBusqueda, setCategFiltroBusqueda] = useState('')
  const [soloSinRevisar, setSoloSinRevisar] = useState(false)
  const [editandoNotaId, setEditandoNotaId] = useState<string | null>(null)
  const [editandoNotaVal, setEditandoNotaVal] = useState('')

  // Columnas opcionales — selector
  const COLUMNAS_OPCIONALES: { key: string; label: string; defaultVisible: boolean }[] = [
    { key: 'saldo',               label: 'Saldo',            defaultVisible: true  },
    { key: 'categ',               label: 'CATEG',            defaultVisible: true  },
    { key: 'detalle',             label: 'Detalle',          defaultVisible: true  },
    { key: 'proveedor_nombre',    label: 'Proveedor',        defaultVisible: true  },
    { key: 'comprobantes_pagados', label: 'Comprobantes',    defaultVisible: true  },
    { key: 'motivo_revision',     label: 'Motivo Revisión',  defaultVisible: true  },
    { key: 'centro_de_costo',     label: 'Centro de Costo',  defaultVisible: false },
    { key: 'contable',            label: 'Contable',         defaultVisible: false },
    { key: 'interno',             label: 'Interno',          defaultVisible: false },
    { key: 'nro_cuenta',          label: 'Nro Cuenta',       defaultVisible: false },
    { key: 'template_id',         label: 'Template ID',      defaultVisible: false },
    { key: 'template_cuota_id',   label: 'Cuota ID',         defaultVisible: false },
    { key: 'comprobante_arca_id', label: 'Factura ARCA ID',  defaultVisible: false },
    { key: 'leyenda1',             label: 'Leyenda Adic. 1',  defaultVisible: false },
    { key: 'leyenda2',             label: 'Leyenda Adic. 2',  defaultVisible: false },
    { key: 'origen',              label: 'Origen',           defaultVisible: false },
    { key: 'control',             label: 'Control',          defaultVisible: false },
    { key: 'orden',               label: 'Orden',            defaultVisible: false },
  ]

  const defaultColVis = Object.fromEntries(COLUMNAS_OPCIONALES.map(c => [c.key, c.defaultVisible]))

  const [columnasVisibles, setColumnasVisibles] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return defaultColVis
    try {
      const saved = localStorage.getItem('extracto_columnas_visibles')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Filtrar solo claves conocidas
        return Object.fromEntries(COLUMNAS_OPCIONALES.map(c => [c.key, parsed[c.key] ?? c.defaultVisible]))
      }
    } catch {}
    return defaultColVis
  })
  const [selectorColumnasAbierto, setSelectorColumnasAbierto] = useState(false)

  const toggleColumna = (key: string) => {
    const nuevo = { ...columnasVisibles, [key]: !columnasVisibles[key] }
    setColumnasVisibles(nuevo)
    localStorage.setItem('extracto_columnas_visibles', JSON.stringify(nuevo))
  }

  const col = (key: string) => columnasVisibles[key] ?? false

  // Estados modal Asignar Manualmente
  const [modalAsignar, setModalAsignar] = useState(false)
  const [movimientoAsignando, setMovimientoAsignando] = useState<any>(null)
  const [tabAsignar, setTabAsignar] = useState<'arca' | 'template' | 'sueldo'>('template')
  const [busquedaAsignarArca, setBusquedaAsignarArca] = useState('')
  const [busquedaAsignarTemplate, setBusquedaAsignarTemplate] = useState('')
  const [busquedaAsignarSueldo, setBusquedaAsignarSueldo] = useState('')
  const [templatesParaAsignar, setTemplatesParaAsignar] = useState<any[]>([])
  const [sueldosParaAsignar, setSueldosParaAsignar] = useState<any[]>([])
  const [templateElegido, setTemplateElegido] = useState<any>(null)
  const [arcaElegida, setArcaElegida] = useState<any>(null)
  const [sueldoElegido, setSueldoElegido] = useState<any>(null)
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false)
  const [contableManual, setContableManual] = useState('')
  const [internoManual, setInternoManual] = useState('')
  const [categManualAsignar, setCategManualAsignar] = useState('')
  const [subcategsDisponibles, setSubcategsDisponibles] = useState<string[]>([])
  const [cuotasExistentes, setCuotasExistentes] = useState<any[]>([])
  const [cuotaElegida, setCuotaElegida] = useState<any>(null) // null = crear nueva

  // Estados importador
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [importSaldoInicial, setImportSaldoInicial] = useState('')
  const [importMostrarSaldo, setImportMostrarSaldo] = useState(false)
  const [importVerificando, setImportVerificando] = useState(false)

  const { procesoEnCurso, error, resultados, ejecutarConciliacion, cuentasDisponibles } = useMotorConciliacion()
  const tablaActiva = cuentaSeleccionada || 'msa_galicia'
  const schemaActivo = CUENTAS_BANCARIAS.find(c => c.id === (cuentaSeleccionada || 'msa_galicia'))?.schema_bd || 'public'
  const { movimientos, estadisticas, loading, cargarMovimientos, actualizarMasivo, actualizarLocal, recargar } = useMovimientosBancarios(tablaActiva, schemaActivo)

  // Set de categs de templates (para validación de categ en extracto)
  const [templateCategSet, setTemplateCategSet] = useState<Set<string>>(new Set())
  useEffect(() => {
    supabase
      .from('egresos_sin_factura')
      .select('categ')
      .then(({ data }) => {
        setTemplateCategSet(new Set((data || []).map(t => (t.categ || '').toUpperCase().trim()).filter(Boolean)))
      })
  }, [])

  // Movimientos con categ que no existe en cuentas_contables ni en templates
  const cuentasCategSet = useMemo(
    () => new Set(cuentas.map(c => c.categ.toUpperCase().trim())),
    [cuentas]
  )
  // Categs propias del sistema de sueldos — siempre válidas
  const CATEGS_SISTEMA = new Set(['SUELDOS', 'ANTICIPO', 'ANTICIPO COBRO'])

  const movimientosCategInvalida = useMemo(
    () => movimientos.filter(m => {
      if (!m.categ || m.categ.trim() === '') return false
      const cu = m.categ.toUpperCase().trim()
      if (CATEGS_SISTEMA.has(cu)) return false
      return !cuentasCategSet.has(cu) && !templateCategSet.has(cu)
    }),
    [movimientos, cuentasCategSet, templateCategSet]
  )

  // Categs únicas de los movimientos cargados (para multi-select)
  const categsUnicas = useMemo(() => {
    const set = new Set<string>()
    movimientos.forEach(m => {
      set.add(m.categ || '(sin categ)')
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [movimientos])

  // Movimientos visibles (filtro client-side de categ multi-select)
  const movimientosVisibles = useMemo(() => {
    if (!categsFiltro) return movimientos // null = sin filtro
    return movimientos.filter(m => {
      const cat = m.categ || '(sin categ)'
      return categsFiltro.has(cat)
    })
  }, [movimientos, categsFiltro])

  // Cargar facturas cuando se activa modo edición
  useEffect(() => {
    if (modoEdicion) {
      cargarFacturasDisponibles()
    }
  }, [modoEdicion])

  // Iniciar proceso de conciliación
  const iniciarConciliacion = async () => {
    if (!cuentaSeleccionada) {
      setSelectorAbierto(true)
      return
    }
    
    const cuenta = cuentasDisponibles.find(c => c.id === cuentaSeleccionada)
    if (cuenta) {
      await ejecutarConciliacion(cuenta)
      recargar()
    }
  }

  // Seleccionar cuenta — solo cambia la cuenta activa, NO ejecuta conciliación.
  // El useEffect([tabla]) del hook dispara la recarga automáticamente al cambiar tablaActiva.
  const ejecutarConCuenta = (cuentaId: string) => {
    const cuenta = cuentasDisponibles.find(c => c.id === cuentaId)
    if (!cuenta) return
    setCuentaSeleccionada(cuentaId)
    setSelectorAbierto(false)
  }

  // Aplicar filtros
  const aplicarFiltros = () => {
    cargarMovimientos({
      estado: filtroEstado,
      busqueda: busqueda.trim() || undefined,
      limite: limiteRegistros,
      categEspecial: filtroCategEspecial || undefined,
      soloSinRevisar: soloSinRevisar || undefined
    })
  }

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount)
  }

  // Manejar selección de movimientos
  const toggleSeleccion = (id: string) => {
    const nuevaSeleccion = new Set(seleccionados)
    if (nuevaSeleccion.has(id)) {
      nuevaSeleccion.delete(id)
    } else {
      nuevaSeleccion.add(id)
    }
    setSeleccionados(nuevaSeleccion)
  }

  // Seleccionar todos los movimientos visibles
  const seleccionarTodos = () => {
    if (seleccionados.size === movimientosVisibles.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(movimientosVisibles.map(m => m.id)))
    }
  }

  // Aplicar ediciones masivas
  const aplicarEdicionMasiva = async () => {
    if (seleccionados.size === 0) return
    
    try {
      const ids = Array.from(seleccionados)
      const exito = await actualizarMasivo(ids, editData)
      
      if (exito) {
        // Si se marcaron como "Conciliado", actualizar facturas vinculadas y limpiar motivo_revision
        if (editData.estado === 'conciliado') {
          // Limpiar motivo_revision para movimientos marcados como Conciliado
          const { error: errorLimpiar } = await supabase
            .from(tablaActiva)
            .update({ motivo_revision: null })
            .in('id', ids)
          
          if (errorLimpiar) {
            console.error('Error limpiando motivo_revision:', errorLimpiar)
          }
          
          // Actualizar facturas ARCA y templates vinculados con valores del extracto bancario
          for (const movimientoId of ids) {
            const opcionId = vinculaciones[movimientoId]
            if (opcionId) {
              // Encontrar el movimiento bancario y la opción vinculada
              const movimiento = movimientos.find(m => m.id === movimientoId)
              const opcionVinculada = facturasDisponibles.find(opt => opt.id === opcionId)
              
              if (!opcionVinculada) {
                console.warn(`No se encontró opción vinculada con ID: ${opcionId}`)
                continue
              }

              if (!movimiento) {
                console.warn(`No se encontró movimiento con ID: ${movimientoId}`)
                continue
              }

              if (opcionVinculada.tipo === 'ARCA') {
                console.log(`Actualizando factura ARCA ${opcionId} con valores del extracto bancario`)
                
                // Preparar datos de actualización: estado + valores editados del extracto
                const updateData: any = { estado: 'conciliado' }
                
                // Propagar monto del extracto bancario con validación de diferencia
                if (movimiento.debitos) {
                  const montoOriginal = opcionVinculada.display_monto
                  const montoExtracto = movimiento.debitos
                  const diferenciaPorcentaje = Math.abs((montoExtracto - montoOriginal) / montoOriginal) * 100
                  
                  if (diferenciaPorcentaje > 10) {
                    const confirmar = window.confirm(
                      `⚠️ DIFERENCIA DE MONTO SIGNIFICATIVA\n\n` +
                      `Factura original: $${montoOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
                      `Extracto bancario: $${montoExtracto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
                      `Diferencia: ${diferenciaPorcentaje.toFixed(1).replace('.', ',')}%\n\n` +
                      `¿Confirmas actualizar la factura con el monto del extracto?`
                    )
                    
                    if (!confirmar) {
                      console.log(`❌ Usuario canceló actualización de factura ${opcionId} por diferencia de monto`)
                      continue // Saltar esta factura
                    }
                  }
                  
                  updateData.monto_a_abonar = montoExtracto
                  console.log(`💰 Monto actualizado: ${montoOriginal} → ${montoExtracto} (${diferenciaPorcentaje.toFixed(1)}% diff)`)
                }
                
                // Propagar CATEG + nro_cuenta si fue editada (con validación)
                if (editData.categ?.trim()) {
                  const categIngresado = editData.categ.trim().toUpperCase()
                  const categExiste = validarCateg(categIngresado)

                  if (categExiste) {
                    updateData.cuenta_contable = categIngresado
                    // Buscar nro_cuenta desde editData o cuentas_contables
                    const nroCta = editData.nro_cuenta || cuentas.find(c => c.categ === categIngresado)?.nro_cuenta
                    if (nroCta) updateData.nro_cuenta = nroCta
                  } else {
                    // Si no existe, mostrar alerta y NO propagar
                    alert(`⚠️ La categoría "${categIngresado}" no existe en el sistema.\nNo se propagará este valor. Use una categoría válida.`)
                    console.warn(`❌ Categoría "${categIngresado}" no válida - no se propaga`)
                    // No agregamos cuenta_contable al updateData
                  }
                }
                
                // Propagar centro de costo si fue editado
                if (editData.centro_de_costo?.trim()) {
                  updateData.centro_costo = editData.centro_de_costo.trim()
                }
                
                const { error } = await supabase
                  .schema('msa')
                  .from('comprobantes_arca')
                  .update(updateData)
                  .eq('id', opcionId)

                if (error) {
                  console.error('Error actualizando factura ARCA:', error)
                } else {
                  console.log(`✅ Factura ARCA ${opcionId} actualizada:`, updateData)
                  // Guardar vínculo persistente en el movimiento bancario
                  await supabase
                    .from(tablaActiva)
                    .update({ comprobante_arca_id: opcionId })
                    .eq('id', movimientoId)
                }
                
              } else if (opcionVinculada.tipo === 'TEMPLATE') {
                console.log(`Actualizando template ${opcionId} con valores del extracto bancario`)
                
                // Actualizar cuota del template
                const updateCuotaData: any = { estado: 'conciliado' }
                
                // Propagar monto del extracto bancario con validación de diferencia
                if (movimiento.debitos) {
                  const montoOriginal = opcionVinculada.display_monto
                  const montoExtracto = movimiento.debitos
                  const diferenciaPorcentaje = Math.abs((montoExtracto - montoOriginal) / montoOriginal) * 100
                  
                  if (diferenciaPorcentaje > 10) {
                    const confirmar = window.confirm(
                      `⚠️ DIFERENCIA DE MONTO SIGNIFICATIVA\n\n` +
                      `Template original: $${montoOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
                      `Extracto bancario: $${montoExtracto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
                      `Diferencia: ${diferenciaPorcentaje.toFixed(1).replace('.', ',')}%\n\n` +
                      `¿Confirmas actualizar el template con el monto del extracto?`
                    )
                    
                    if (!confirmar) {
                      console.log(`❌ Usuario canceló actualización de template ${opcionId} por diferencia de monto`)
                      continue // Saltar este template
                    }
                  }
                  
                  updateCuotaData.monto = montoExtracto
                  console.log(`💰 Monto template actualizado: ${montoOriginal} → ${montoExtracto} (${diferenciaPorcentaje.toFixed(1)}% diff)`)
                }
                
                const { error: errorCuota } = await supabase
                  .from('cuotas_egresos_sin_factura')
                  .update(updateCuotaData)
                  .eq('id', opcionId)
                
                if (errorCuota) {
                  console.error('Error actualizando cuota template:', errorCuota)
                } else {
                  console.log(`✅ Cuota template ${opcionId} actualizada:`, updateCuotaData)
                  
                  // Actualizar egreso padre con CATEG y centro de costo si fueron editados
                  if (editData.categ?.trim() || editData.centro_de_costo?.trim()) {
                    const updateEgresoData: any = {}
                    
                    if (editData.categ?.trim()) {
                      const categIngresado = editData.categ.trim().toUpperCase()
                      const categExiste = validarCateg(categIngresado)
                      
                      if (categExiste) {
                        updateEgresoData.categ = categIngresado
                      } else {
                        alert(`⚠️ La categoría "${categIngresado}" no existe en el sistema.\nNo se propagará este valor al template. Use una categoría válida.`)
                        console.warn(`❌ Categoría "${categIngresado}" no válida - no se propaga a template`)
                      }
                    }
                    
                    if (editData.centro_de_costo?.trim()) {
                      updateEgresoData.centro_costo = editData.centro_de_costo.trim()
                    }
                    
                    // Necesitamos el egreso_id para actualizar el egreso padre
                    const { data: cuotaData } = await supabase
                      .from('cuotas_egresos_sin_factura')
                      .select('egreso_id')
                      .eq('id', opcionId)
                      .single()
                    
                    if (cuotaData?.egreso_id) {
                      const { error: errorEgreso } = await supabase
                        .from('egresos_sin_factura')
                        .update(updateEgresoData)
                        .eq('id', cuotaData.egreso_id)
                      
                      if (errorEgreso) {
                        console.error('Error actualizando egreso padre:', errorEgreso)
                      } else {
                        console.log(`✅ Egreso padre ${cuotaData.egreso_id} actualizado:`, updateEgresoData)
                      }
                    }
                  }
                }
              }
            }
          }

          // Propagar conciliado a orígenes ya vinculados (movimientos que el motor dejó en auditar con IDs)
          for (const movimientoId of ids) {
            // Si ya se procesó arriba con vinculación nueva, saltar
            if (vinculaciones[movimientoId]) continue

            const movimiento = movimientos.find(m => m.id === movimientoId) as any
            if (!movimiento) continue

            // Factura ARCA ya vinculada
            if (movimiento.comprobante_arca_id) {
              await supabase
                .schema('msa')
                .from('comprobantes_arca')
                .update({ estado: 'conciliado' })
                .eq('id', movimiento.comprobante_arca_id)
            }

            // Cuota template ya vinculada
            if (movimiento.template_cuota_id) {
              await supabase
                .from('cuotas_egresos_sin_factura')
                .update({ estado: 'conciliado' })
                .eq('id', movimiento.template_cuota_id)
            }

            // Pago sueldo ya vinculado
            if (movimiento.sueldo_pago_id) {
              await supabase
                .from('sueldos_pagos')
                .update({ estado: 'conciliado' })
                .eq('id', movimiento.sueldo_pago_id)
            }
          }
        }

        // Resetear después de aplicar exitosamente
        setSeleccionados(new Set())
        setModoEdicion(false)
        setVinculaciones({})
        setEditData({
          categ: '',
          nro_cuenta: '',
          centro_de_costo: '',
          estado: '',
          contable: '',
          interno: '',
          detalle: ''
        })
        // Propagar categ a facturas ARCA vinculadas (para movimientos ya conciliados, edición posterior de categ)
        // Solo cuando NO se está cambiando estado a 'conciliado' (ese caso ya lo maneja el bloque anterior)
        if (editData.categ?.trim() && editData.estado !== 'conciliado') {
          const categIngresado = editData.categ.trim().toUpperCase()
          const categExiste = validarCateg(categIngresado)

          if (categExiste) {
            // Buscar nro_cuenta para propagar junto con categ
            const nroCta = editData.nro_cuenta || cuentas.find(c => c.categ === categIngresado)?.nro_cuenta || null
            const updateArcaPropag: Record<string, any> = { cuenta_contable: categIngresado }
            if (nroCta) updateArcaPropag.nro_cuenta = nroCta

            for (const movimientoId of ids) {
              const movimiento = movimientos.find(m => m.id === movimientoId)
              const arcaId = movimiento?.comprobante_arca_id

              if (arcaId) {
                const { error } = await supabase
                  .schema('msa')
                  .from('comprobantes_arca')
                  .update(updateArcaPropag)
                  .eq('id', arcaId)

                if (error) {
                  console.error(`Error propagando categ a factura ARCA ${arcaId}:`, error)
                } else {
                  console.log(`✅ categ+nro_cuenta propagada a factura ARCA vinculada ${arcaId}: ${categIngresado}`)
                }
              }
            }
          }
        }

        // Actualizar localmente sin recargar — preserva filtros y contexto de trabajo
        const camposLocales: Record<string, any> = {}
        if (editData.categ?.trim()) camposLocales.categ = editData.categ.trim().toUpperCase()
        if (editData.nro_cuenta) camposLocales.nro_cuenta = editData.nro_cuenta
        if (editData.centro_de_costo?.trim()) camposLocales.centro_de_costo = editData.centro_de_costo.trim()
        if (editData.estado?.trim()) camposLocales.estado = editData.estado.trim()
        if (editData.contable?.trim()) camposLocales.contable = editData.contable.trim()
        if (editData.interno?.trim()) camposLocales.interno = editData.interno.trim()
        if (editData.detalle?.trim()) camposLocales.detalle = editData.detalle.trim()
        if (editData.estado === 'conciliado') camposLocales.motivo_revision = null
        if (Object.keys(camposLocales).length > 0) actualizarLocal(ids, camposLocales)
      }
    } catch (error) {
      console.error('Error aplicando edición masiva:', error)
    }
  }

  // Cargar facturas y templates disponibles para vincular
  const cargarFacturasDisponibles = async () => {
    try {
      // Cargar facturas ARCA NO conciliadas (cualquier estado excepto conciliado)
      const { data: facturasArca, error: errorArca } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('id, tipo_comprobante, numero_desde, denominacion_emisor, monto_a_abonar, fecha_estimada, fecha_emision, cuit, estado')
        .neq('estado', 'conciliado')
        .order('fecha_estimada', { ascending: false })

      if (errorArca) {
        console.error('Error cargando facturas ARCA:', errorArca)
        return
      }

      // Cargar templates egresos NO conciliados (cualquier estado excepto conciliado)
      const { data: templatesEgresos, error: errorTemplates } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select(`
          id,
          monto,
          descripcion,
          fecha_estimada,
          estado,
          egreso:egresos_sin_factura(
            nombre_referencia,
            nombre_quien_cobra,
            cuit_quien_cobra,
            responsable
          )
        `)
        .neq('estado', 'conciliado')
        .order('fecha_estimada', { ascending: false })

      if (errorTemplates) {
        console.error('Error cargando templates egresos:', errorTemplates)
        return
      }

      console.log('🔍 DEBUG Templates cargados:', templatesEgresos?.length || 0)
      console.log('🔍 DEBUG Templates raw data:', templatesEgresos)

      // Combinar facturas ARCA y templates en formato unificado
      const facturasFormateadas = (facturasArca || []).map(f => ({
        id: f.id,
        tipo: 'ARCA' as const,
        origen_tabla: 'msa.comprobantes_arca' as const,
        tipo_comprobante: f.tipo_comprobante,
        numero_desde: f.numero_desde,
        denominacion_emisor: f.denominacion_emisor,
        monto_a_abonar: f.monto_a_abonar,
        fecha_estimada: f.fecha_estimada,
        cuit: f.cuit,
        // Campos para mostrar en UI
        display_nombre: f.denominacion_emisor,
        display_referencia: `${f.tipo_comprobante}-${f.numero_desde}`,
        display_monto: f.monto_a_abonar,
        fecha_emision: f.fecha_emision
      }))

      const templatesFormateados = (templatesEgresos || []).map(t => ({
        id: t.id,
        tipo: 'TEMPLATE' as const,
        origen_tabla: 'cuotas_egresos_sin_factura' as const,
        descripcion: t.descripcion,
        denominacion_emisor: t.egreso?.nombre_quien_cobra || t.egreso?.responsable || 'Template Sin Factura',
        monto_a_abonar: t.monto,
        fecha_estimada: t.fecha_estimada,
        cuit: t.egreso?.cuit_quien_cobra || '',
        // Campos para mostrar en UI
        display_nombre: t.egreso?.nombre_quien_cobra || t.egreso?.responsable || 'Template Sin Factura',
        display_referencia: t.egreso?.nombre_referencia || t.descripcion || 'Template',
        display_monto: t.monto
      }))

      // Combinar y ordenar por fecha
      const todasLasOpciones = [...facturasFormateadas, ...templatesFormateados]
        .sort((a, b) => new Date(b.fecha_estimada).getTime() - new Date(a.fecha_estimada).getTime())

      setFacturasDisponibles(todasLasOpciones)
      
      console.log(`✅ Cargadas ${facturasFormateadas.length} facturas ARCA + ${templatesFormateados.length} templates = ${todasLasOpciones.length} total`)
      console.log('📄 Facturas ARCA (NO conciliadas):', facturasArca?.map(f => `${f.denominacion_emisor} - ${f.monto_a_abonar} [${f.estado}]`) || [])
      console.log('📋 Templates (NO conciliados):', templatesEgresos?.map(t => `${t.egreso?.nombre_quien_cobra || t.egreso?.responsable} - ${t.monto} [${t.estado}]`) || [])
    } catch (error) {
      console.error('Error cargando facturas y templates:', error)
    }
  }

  // Abrir modal asignar manualmente
  const abrirModalAsignar = async (movimiento: any) => {
    setMovimientoAsignando(movimiento)
    setTemplateElegido(null)
    setArcaElegida(null)
    setSueldoElegido(null)
    setBusquedaAsignarArca('')
    setBusquedaAsignarTemplate('')
    setBusquedaAsignarSueldo('')
    setTabAsignar('template')
    setContableManual(movimiento.contable || '')
    setInternoManual(movimiento.interno || '')
    setCategManualAsignar('')
    setCuotaElegida(null)
    setCuotasExistentes([])

    // Cargar templates abiertos para asignación
    const { data } = await supabase
      .from('egresos_sin_factura')
      .select('id, nombre_referencia, categ, cuenta_agrupadora, responsable, es_bidireccional, es_multi_cuenta')
      .eq('activo', true)
      .order('cuenta_agrupadora')
      .order('nombre_referencia')
    setTemplatesParaAsignar(data || [])

    // Cargar pagos de sueldos no conciliados
    const { data: sueldosData } = await supabase
      .from('sueldos_pagos')
      .select('*, empleado:sueldos_empleados(id, nombre, cuit_empleado)')
      .neq('estado', 'conciliado')
      .eq('medio_pago', 'banco')
      .order('fecha', { ascending: false })
    setSueldosParaAsignar(sueldosData || [])

    // Asegurar facturas ARCA cargadas
    if (facturasDisponibles.length === 0) await cargarFacturasDisponibles()

    setModalAsignar(true)
  }

  // Ejecutar asignación manual
  const ejecutarAsignacion = async () => {
    if (!movimientoAsignando) return
    setGuardandoAsignacion(true)
    try {
      const monto = movimientoAsignando.debitos > 0 ? movimientoAsignando.debitos : movimientoAsignando.creditos
      const tipoMovimiento = movimientoAsignando.debitos > 0 ? 'egreso' : 'ingreso'

      // Buscar códigos contable/interno en reglas_contable_interno (misma lógica que el motor)
      const buscarCodigos = async (templateId?: string | null, responsable?: string | null) => {
        if (templateId) {
          const { data } = await supabase
            .from('reglas_contable_interno')
            .select('codigo_contable, codigo_interno')
            .eq('cuenta_bancaria_id', tablaActiva)
            .eq('tipo_regla', 'especifica')
            .eq('template_id', templateId)
            .eq('activo', true)
            .maybeSingle()
          if (data && (data.codigo_contable || data.codigo_interno)) {
            return { contable: data.codigo_contable, interno: data.codigo_interno }
          }
        }
        if (responsable) {
          const { data } = await supabase
            .from('reglas_contable_interno')
            .select('codigo_contable, codigo_interno')
            .eq('cuenta_bancaria_id', tablaActiva)
            .eq('tipo_regla', 'responsable')
            .eq('responsable', responsable)
            .eq('activo', true)
            .maybeSingle()
          if (data && (data.codigo_contable || data.codigo_interno)) {
            return { contable: data.codigo_contable, interno: data.codigo_interno }
          }
        }
        return {}
      }

      if (tabAsignar === 'template' && templateElegido) {
        // Si es re-asignación, limpiar cuota anterior
        if (movimientoAsignando.template_cuota_id) {
          await supabase.from('cuotas_egresos_sin_factura')
            .delete().eq('id', movimientoAsignando.template_cuota_id)
        }
        // Limpiar vínculo ARCA anterior si existía
        if (movimientoAsignando.comprobante_arca_id) {
          await supabase.from(tablaActiva)
            .update({ comprobante_arca_id: null }).eq('id', movimientoAsignando.id)
        }

        // Buscar códigos contable/interno: Tipo A (template específico) → Tipo B (responsable)
        const codigos = await buscarCodigos(templateElegido.id, templateElegido.responsable)

        let cuotaId: string

        if (cuotaElegida) {
          // Usar cuota existente: actualizar estado, monto y fechas según extracto
          const updateCuota: Record<string, any> = { estado: 'conciliado' }
          if (parseFloat(cuotaElegida.monto) !== monto) {
            updateCuota.monto = monto
          }
          // Actualizar fechas a la fecha real de débito bancario
          const fechaExtracto = movimientoAsignando.fecha
          if (fechaExtracto) {
            updateCuota.fecha_vencimiento = fechaExtracto
            updateCuota.fecha_estimada = fechaExtracto
          }
          const { error: errUpd } = await supabase
            .from('cuotas_egresos_sin_factura')
            .update(updateCuota)
            .eq('id', cuotaElegida.id)
          if (errUpd) throw errUpd
          cuotaId = cuotaElegida.id
        } else {
          // Crear cuota nueva en el template
          const cuotaInsert: Record<string, any> = {
              egreso_id: templateElegido.id,
              fecha_vencimiento: movimientoAsignando.fecha,
              fecha_estimada: movimientoAsignando.fecha,
              monto,
              estado: 'conciliado',
              tipo_movimiento: tipoMovimiento,
              descripcion: templateElegido.nombre_referencia
          }
          // Multi-cuenta: guardar categ en la cuota
          if (templateElegido.es_multi_cuenta && categManualAsignar) {
            cuotaInsert.categ = categManualAsignar
          }
          const { data: cuota, error: errCuota } = await supabase
            .from('cuotas_egresos_sin_factura')
            .insert(cuotaInsert)
            .select('id')
            .single()

          if (errCuota) throw errCuota
          cuotaId = cuota.id
        }

        // Actualizar extracto con todos los campos incluyendo contable/interno
        // Multi-cuenta: usar categ específico si fue seleccionado
        const categFinal = cuotaElegida?.categ || ((templateElegido.es_multi_cuenta && categManualAsignar) ? categManualAsignar : templateElegido.categ)
        // Buscar nombre oficial del proveedor en BBDD proveedores
        const cuitTemplate = templateElegido.cuit?.replace(/[-\s]/g, '') || ''
        const { data: provTemplate } = cuitTemplate ? await supabase
          .from('proveedores').select('razon_social').eq('cuit', cuitTemplate).maybeSingle() : { data: null }
        const updateTemplate: Record<string, any> = {
          template_id: templateElegido.id,
          template_cuota_id: cuotaId,
          categ: categFinal,
          detalle: templateElegido.nombre_referencia,
          estado: 'conciliado',
          proveedor_nombre: provTemplate?.razon_social || null,
          comprobantes_pagados: templateElegido.display_referencia || templateElegido.nombre_referencia || null
        }
        updateTemplate.contable = contableManual.trim() || codigos.contable || ''
        updateTemplate.interno  = internoManual.trim()  || codigos.interno  || ''

        const { error: errExt } = await supabase
          .from(tablaActiva)
          .update(updateTemplate)
          .eq('id', movimientoAsignando.id)

        if (errExt) throw errExt

        // Actualizar localmente — preserva filtros y contexto de trabajo
        actualizarLocal(movimientoAsignando.id, updateTemplate)

      } else if (tabAsignar === 'arca' && arcaElegida) {
        // Obtener cuenta_contable y nro_cuenta de la factura ARCA (igual que el motor)
        const { data: facturaCompleta } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .select('cuenta_contable, nro_cuenta')
          .eq('id', arcaElegida.id)
          .maybeSingle()
        const cuentaContable = facturaCompleta?.cuenta_contable || null  // nombre descriptivo → categ
        const nroCuenta = facturaCompleta?.nro_cuenta || null              // código numérico → nro_cuenta

        // Buscar nombre oficial del proveedor en BBDD proveedores
        const cuitArca = arcaElegida.cuit?.replace(/[-\s]/g, '') || ''
        const { data: provArca } = cuitArca ? await supabase
          .from('proveedores').select('razon_social').eq('cuit', cuitArca).maybeSingle() : { data: null }
        const updateArca: Record<string, any> = {
          comprobante_arca_id: arcaElegida.id,
          detalle: arcaElegida.display_nombre || '',
          estado: 'conciliado',
          proveedor_nombre: provArca?.razon_social || null,
          comprobantes_pagados: arcaElegida.display_referencia || null
        }
        if (cuentaContable) updateArca.categ = cuentaContable
        if (nroCuenta) updateArca.nro_cuenta = nroCuenta
        if (contableManual.trim()) updateArca.contable = contableManual.trim()
        if (internoManual.trim()) updateArca.interno = internoManual.trim()

        const { error: errExt } = await supabase
          .from(tablaActiva)
          .update(updateArca)
          .eq('id', movimientoAsignando.id)

        if (errExt) throw errExt

        // Actualizar factura ARCA: conciliado + fecha_vencimiento = fecha real + monto = lo pagado
        await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({
            estado: 'conciliado',
            fecha_vencimiento: movimientoAsignando.fecha,
            monto_a_abonar: monto   // ajusta al monto exacto del débito (ej: redondeo terminal)
          })
          .eq('id', arcaElegida.id)

        // Quitar de la lista local para que no vuelva a aparecer como opción
        setFacturasDisponibles(prev => prev.filter(f => f.id !== arcaElegida.id))

        // Actualizar localmente — preserva filtros y contexto de trabajo
        actualizarLocal(movimientoAsignando.id, updateArca)

      } else if (tabAsignar === 'sueldo' && sueldoElegido) {
        // Limpiar vínculos anteriores si existían
        if (movimientoAsignando.template_cuota_id) {
          await supabase.from('cuotas_egresos_sin_factura')
            .delete().eq('id', movimientoAsignando.template_cuota_id)
        }
        if (movimientoAsignando.comprobante_arca_id) {
          await supabase.from(tablaActiva)
            .update({ comprobante_arca_id: null }).eq('id', movimientoAsignando.id)
        }

        const nombreEmpleado = sueldoElegido.empleado?.nombre || ''
        const tipoLabel = sueldoElegido.tipo === 'anticipo' ? 'Anticipo' : 'Pago Saldo'
        const detalleSueldo = `${tipoLabel} ${nombreEmpleado} - ${sueldoElegido.descripcion || ''}`

        const updateSueldo: Record<string, any> = {
          sueldo_pago_id: sueldoElegido.id,
          categ: 'Sueldos',
          detalle: detalleSueldo,
          estado: 'conciliado',
          proveedor_nombre: nombreEmpleado,
          // Limpiar IDs de otros orígenes
          template_id: null,
          template_cuota_id: null,
          comprobante_arca_id: null
        }
        if (contableManual.trim()) updateSueldo.contable = contableManual.trim()
        if (internoManual.trim()) updateSueldo.interno = internoManual.trim()

        const { error: errExt } = await supabase
          .from(tablaActiva)
          .update(updateSueldo)
          .eq('id', movimientoAsignando.id)

        if (errExt) throw errExt

        // Marcar el pago de sueldo como conciliado
        await supabase
          .from('sueldos_pagos')
          .update({ estado: 'conciliado' })
          .eq('id', sueldoElegido.id)

        // Quitar de la lista local
        setSueldosParaAsignar(prev => prev.filter(s => s.id !== sueldoElegido.id))

        // Actualizar localmente — preserva filtros y contexto de trabajo
        actualizarLocal(movimientoAsignando.id, updateSueldo)
      }

      setModalAsignar(false)
    } catch (err) {
      console.error('Error en asignación manual:', err)
    } finally {
      setGuardandoAsignacion(false)
    }
  }

  // Generar propuestas inteligentes para un movimiento (funciona con ARCA y Templates)
  const generarPropuestasInteligentes = (movimiento: any) => {
    const opcionesDisponibles = facturasDisponibles
    const propuestas = []
    
    // 1. Mismo monto exacto (cualquier fecha)
    const mismoMonto = opcionesDisponibles.filter(f => 
      Math.abs(f.display_monto - movimiento.debitos) < 0.01
    )
    propuestas.push(...mismoMonto.map(f => ({
      ...f, 
      tipo_match: f.tipo === 'ARCA' ? 'factura_mismo_monto' : 'template_mismo_monto', 
      prioridad: f.tipo === 'ARCA' ? 1 : 2 // Priorizar facturas ARCA
    })))
    
    // 2. Monto similar ±10% + mismo proveedor (buscar en descripción)
    const montoSimilar = opcionesDisponibles.filter(f => {
      const diferenciaMonto = Math.abs(f.display_monto - movimiento.debitos) / movimiento.debitos
      const proveedorEnDescripcion = movimiento.descripcion.toLowerCase().includes(f.display_nombre.toLowerCase().split(' ')[0])
      return diferenciaMonto <= 0.10 && proveedorEnDescripcion && !propuestas.find(p => p.id === f.id)
    })
    propuestas.push(...montoSimilar.map(f => ({
      ...f, 
      tipo_match: f.tipo === 'ARCA' ? 'factura_similar_proveedor' : 'template_similar_proveedor', 
      prioridad: f.tipo === 'ARCA' ? 3 : 4
    })))
    
    // 3. Mismo proveedor (cualquier monto)
    const mismoProveedor = opcionesDisponibles.filter(f => {
      const proveedorEnDescripcion = movimiento.descripcion.toLowerCase().includes(f.display_nombre.toLowerCase().split(' ')[0])
      return proveedorEnDescripcion && !propuestas.find(p => p.id === f.id)
    })
    propuestas.push(...mismoProveedor.map(f => ({
      ...f, 
      tipo_match: f.tipo === 'ARCA' ? 'factura_mismo_proveedor' : 'template_mismo_proveedor', 
      prioridad: f.tipo === 'ARCA' ? 5 : 6
    })))
    
    // Ordenar por prioridad (facturas ARCA primero, luego templates)
    return propuestas.sort((a, b) => a.prioridad - b.prioridad)
  }

  // Filtrar facturas con búsqueda avanzada
  const filtrarFacturasConBusqueda = (opciones: any[], termino: string) => {
    if (!termino.trim()) return opciones
    
    const busqueda = termino.toLowerCase()
    return opciones.filter(opcion => {
      // Buscar en múltiples campos - compatible con ARCA y Templates
      const campos = [
        opcion.display_nombre?.toLowerCase() || '',
        opcion.display_referencia?.toLowerCase() || '',
        opcion.cuit || '',
        opcion.display_monto?.toString() || '',
        opcion.tipo?.toLowerCase() || '', // 'arca' o 'template'
        // Campos específicos ARCA (retrocompatibilidad)
        opcion.denominacion_emisor?.toLowerCase() || '',
        opcion.tipo_comprobante?.toString() || '',
        opcion.numero_desde?.toString() || '',
        // Campos específicos Templates
        opcion.descripcion?.toLowerCase() || '',
        // Formatear fecha para búsqueda
        opcion.fecha_estimada ? new Date(opcion.fecha_estimada + 'T12:00:00').toLocaleDateString('es-AR') : ''
      ]
      
      return campos.some(campo => campo.includes(busqueda))
    })
  }

  // Obtener información del límite seleccionado
  const obtenerInfoLimite = (limite: number) => {
    if (limite <= 500) return { color: 'text-green-600', mensaje: 'Carga rápida' }
    if (limite <= 1000) return { color: 'text-yellow-600', mensaje: 'Carga moderada' }
    if (limite <= 2000) return { color: 'text-orange-600', mensaje: 'Puede ser lento' }
    return { color: 'text-red-600', mensaje: 'Carga pesada - usar filtros' }
  }

  // Marcar movimientos como revisados
  const marcarComoRevisado = async (ids: string[], valor: boolean = true) => {
    try {
      for (const id of ids) {
        const { error: err } = await (schemaActivo && schemaActivo !== 'public' ? supabase.schema(schemaActivo) : supabase)
          .from(tablaActiva)
          .update({ revisado: valor })
          .eq('id', id)
        if (err) throw err
      }
      actualizarLocal(ids, { revisado: valor })
    } catch (err) {
      console.error('Error marcando revisado:', err)
      alert('Error al marcar como revisado')
    }
  }

  // Marcar visibles como revisados (excepto seleccionados si hay selección)
  const marcarVisiblesComoRevisados = async () => {
    const sinRevisar = movimientosVisibles.filter(m => !m.revisado)
    if (sinRevisar.length === 0) return

    let idsAMarcar: string[]
    if (seleccionados.size > 0) {
      // Si hay selección, el usuario eligió cuáles EXCLUIR
      idsAMarcar = sinRevisar.filter(m => !seleccionados.has(m.id)).map(m => m.id)
    } else {
      idsAMarcar = sinRevisar.map(m => m.id)
    }

    if (idsAMarcar.length === 0) return

    const msg = seleccionados.size > 0
      ? `¿Marcar ${idsAMarcar.length} movimientos como revisados? (${seleccionados.size} excluidos)`
      : `¿Marcar ${idsAMarcar.length} movimientos como revisados?`

    if (!window.confirm(msg)) return

    await marcarComoRevisado(idsAMarcar, true)
    setSeleccionados(new Set())
  }

  // Guardar nota operador
  const guardarNotaOperador = async (id: string, nota: string) => {
    try {
      const { error: err } = await (schemaActivo && schemaActivo !== 'public' ? supabase.schema(schemaActivo) : supabase)
        .from(tablaActiva)
        .update({ nota_operador: nota.trim() || null })
        .eq('id', id)
      if (err) throw err
      actualizarLocal(id, { nota_operador: nota.trim() || null })
      setEditandoNotaId(null)
      setEditandoNotaVal('')
    } catch (err) {
      console.error('Error guardando nota:', err)
      alert('Error al guardar nota')
    }
  }

  // Aplicar filtros avanzados extracto bancario
  const aplicarFiltrosAvanzados = () => {
    const filtros: any = {
      estado: filtroEstado,
      busqueda: busqueda.trim() || undefined,
      limite: limiteRegistros
    }

    // Agregar filtros adicionales
    if (fechaMovDesde) filtros.fechaDesde = fechaMovDesde
    if (fechaMovHasta) filtros.fechaHasta = fechaMovHasta
    if (montoDesde) filtros.montoDesde = parseFloat(montoDesde.replace(/\./g, '').replace(',', '.'))
    if (montoHasta) filtros.montoHasta = parseFloat(montoHasta.replace(/\./g, '').replace(',', '.'))
    if (filtroCategEspecial) filtros.categEspecial = filtroCategEspecial
    // categ multi-select se aplica client-side via movimientosVisibles
    if (busquedaDetalle.trim()) filtros.detalle = busquedaDetalle.trim()
    if (soloSinRevisar) filtros.soloSinRevisar = true

    cargarMovimientos(filtros)
  }

  // Limpiar filtros avanzados
  const limpiarFiltrosAvanzados = () => {
    setFechaMovDesde('')
    setFechaMovHasta('')
    setMontoDesde('')
    setMontoHasta('')
    setBusquedaCategExtracto('')
    setBusquedaDetalleExtracto('')
    setBusqueda('')
    setFiltroEstado('Todos')
    setFiltroCategEspecial(null)
    setSoloSinRevisar(false)
    setCategsFiltro(null)
    setCategFiltroBusqueda('')

    cargarMovimientos({
      estado: 'Todos',
      limite: limiteRegistros
    })
  }

  // Cancelar modo edición
  const cancelarEdicion = () => {
    setModoEdicion(false)
    setSeleccionados(new Set())
    setVinculaciones({})
    setComboboxAbierto({})
    setBusquedaCombobox({})
    setEditData({
      categ: '',
      nro_cuenta: null,
      centro_de_costo: '',
      estado: '',
      contable: '',
      interno: ''
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6" />
            Extracto Bancario
          </h2>
          <p className="text-gray-600">Conciliación automática de movimientos bancarios</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSelectorAbierto(true)}
            className="flex items-center gap-2"
          >
            <Banknote className="h-4 w-4" />
            {cuentaSeleccionada
              ? cuentasDisponibles.find(c => c.id === cuentaSeleccionada)?.nombre
              : 'Seleccionar cuenta'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setConfiguradorAbierto(true)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Configuración
          </Button>

          <Button
            onClick={iniciarConciliacion}
            disabled={procesoEnCurso}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            {procesoEnCurso ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Conciliación Bancaria
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Estado del Proceso */}
      {procesoEnCurso && (
        <Alert>
          <RotateCcw className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Procesando conciliación bancaria automática...
          </AlertDescription>
        </Alert>
      )}

      {/* Error del Proceso */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Error en conciliación: {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Resultados del Proceso */}
      {resultados && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Conciliación Completada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {resultados.automaticos}
                </div>
                <div className="text-sm text-gray-600">Automáticos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {resultados.revision_manual}
                </div>
                <div className="text-sm text-gray-600">Revisión Manual</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {resultados.sin_match}
                </div>
                <div className="text-sm text-gray-600">Sin Match</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {resultados.total_movimientos}
                </div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs del contenido */}
      <Tabs defaultValue="movimientos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="movimientos" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Movimientos
          </TabsTrigger>
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </TabsTrigger>
          <TabsTrigger value="reportes" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movimientos" className="space-y-4">
          {/* Estadísticas */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{estadisticas.total}</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  Total Movimientos
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{estadisticas.conciliados}</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Conciliados
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">{estadisticas.auditar || 0}</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Para Auditar
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">{estadisticas.pendientes}</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Pendientes
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{estadisticas.sin_categ}</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Sin CATEG
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Alerta CATEG inválida — valores que no corresponden a ninguna cuenta contable ni template */}
          {movimientosCategInvalida.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <span className="font-semibold">
                  {movimientosCategInvalida.length} movimiento{movimientosCategInvalida.length > 1 ? 's' : ''} con CATEG inválida
                </span>
                {' '}— el valor asignado no corresponde a ninguna cuenta contable ni template registrado.{' '}
                <span className="text-amber-700 text-xs font-mono">
                  ({[...new Set(movimientosCategInvalida.map(m => m.categ))].join(', ')})
                </span>
                {' '}— usá el botón <span className="font-semibold">Re-asignar</span> en cada fila para corregirlo.
              </AlertDescription>
            </Alert>
          )}

          {/* Filtros */}
          <Card>
            <CardContent className="pt-4 pb-3">
              {/* Fila 1: Búsqueda + Estado + Límite + Acciones */}
              <div className="flex gap-3 items-center mb-3">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar en descripción, categ, detalle, contable, proveedor..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                    className="h-9 text-sm"
                  />
                </div>
                <Select value={filtroEstado} onValueChange={(value: any) => setFiltroEstado(value)}>
                  <SelectTrigger className="w-44 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos los estados</SelectItem>
                    <SelectItem value="conciliado">Conciliados</SelectItem>
                    <SelectItem value="pendiente">Pendientes</SelectItem>
                    <SelectItem value="auditar">Para Auditar</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={limiteRegistros.toString()} onValueChange={(value) => setLimiteRegistros(parseInt(value))}>
                  <SelectTrigger className="w-24 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1.000</SelectItem>
                    <SelectItem value="2000">2.000</SelectItem>
                    <SelectItem value="5000">5.000</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={aplicarFiltros} size="sm">
                  Filtrar
                </Button>
                <Button
                  onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)}
                  variant={mostrarFiltrosAvanzados ? "default" : "outline"}
                  size="sm"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Avanzados
                </Button>
                <Button
                  variant="outline"
                  onClick={() => recargar()}
                  title="Recargar datos desde BD"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
                <Button
                  onClick={() => setModoEdicion(!modoEdicion)}
                  variant={modoEdicion ? "destructive" : "outline"}
                  className="flex items-center gap-2"
                >
                  {modoEdicion ? (
                    <>
                      <X className="h-4 w-4" />
                      Cancelar
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4" />
                      Editar
                    </>
                  )}
                </Button>
              </div>

              {/* Fila 2: Filtros rápidos (chips) */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 mr-1">Filtros rápidos:</span>
                <Button
                  variant={filtroEstado === 'pendiente' && !filtroCategEspecial ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => {
                    setFiltroEstado('pendiente')
                    setFiltroCategEspecial(null)
                    cargarMovimientos({ estado: 'pendiente', busqueda: busqueda.trim() || undefined, limite: limiteRegistros })
                  }}
                >
                  Pendientes ({estadisticas.pendientes})
                </Button>
                <Button
                  variant={filtroEstado === 'auditar' && !filtroCategEspecial ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => {
                    setFiltroEstado('auditar')
                    setFiltroCategEspecial(null)
                    cargarMovimientos({ estado: 'auditar', busqueda: busqueda.trim() || undefined, limite: limiteRegistros })
                  }}
                >
                  Auditar ({estadisticas.auditar})
                </Button>
                <Button
                  variant={filtroCategEspecial === 'invalida' ? "default" : "outline"}
                  size="sm"
                  className={`h-7 text-xs px-2 ${filtroCategEspecial === 'invalida' ? 'bg-red-600 hover:bg-red-700' : 'border-red-300 text-red-600 hover:bg-red-50'}`}
                  onClick={() => {
                    setFiltroCategEspecial(filtroCategEspecial === 'invalida' ? null : 'invalida')
                    setFiltroEstado('Todos')
                    cargarMovimientos({ estado: 'Todos', categEspecial: filtroCategEspecial === 'invalida' ? undefined : 'invalida', busqueda: busqueda.trim() || undefined, limite: limiteRegistros })
                  }}
                >
                  CATEG Inválida
                </Button>
                <Button
                  variant={filtroCategEspecial === 'sin_categ' ? "default" : "outline"}
                  size="sm"
                  className={`h-7 text-xs px-2 ${filtroCategEspecial === 'sin_categ' ? 'bg-orange-600 hover:bg-orange-700' : 'border-orange-300 text-orange-600 hover:bg-orange-50'}`}
                  onClick={() => {
                    setFiltroCategEspecial(filtroCategEspecial === 'sin_categ' ? null : 'sin_categ')
                    setFiltroEstado('Todos')
                    cargarMovimientos({ estado: 'Todos', categEspecial: filtroCategEspecial === 'sin_categ' ? undefined : 'sin_categ', busqueda: busqueda.trim() || undefined, limite: limiteRegistros })
                  }}
                >
                  Sin CATEG ({estadisticas.sin_categ})
                </Button>
                <Button
                  variant={filtroEstado === 'conciliado' && !filtroCategEspecial ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => {
                    setFiltroEstado('conciliado')
                    setFiltroCategEspecial(null)
                    cargarMovimientos({ estado: 'conciliado', busqueda: busqueda.trim() || undefined, limite: limiteRegistros })
                  }}
                >
                  Conciliados ({estadisticas.conciliados})
                </Button>
                <span className="text-gray-300">|</span>
                <Button
                  variant={soloSinRevisar ? "default" : "outline"}
                  size="sm"
                  className={`h-7 text-xs px-2 ${soloSinRevisar ? 'bg-rose-600 hover:bg-rose-700' : 'border-rose-300 text-rose-600 hover:bg-rose-50'}`}
                  onClick={() => {
                    const nuevo = !soloSinRevisar
                    setSoloSinRevisar(nuevo)
                    cargarMovimientos({ estado: filtroEstado, busqueda: busqueda.trim() || undefined, limite: limiteRegistros, categEspecial: filtroCategEspecial || undefined, soloSinRevisar: nuevo || undefined })
                  }}
                >
                  Sin revisar ({estadisticas.sin_revisar})
                </Button>
                {(filtroEstado !== 'Todos' || filtroCategEspecial || soloSinRevisar) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-gray-500"
                    onClick={() => {
                      setFiltroEstado('Todos')
                      setFiltroCategEspecial(null)
                      setSoloSinRevisar(false)
                      cargarMovimientos({ estado: 'Todos', busqueda: busqueda.trim() || undefined, limite: limiteRegistros })
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Limpiar
                  </Button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  {movimientos.some(m => !m.revisado) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 border-green-400 text-green-700 hover:bg-green-50"
                      onClick={marcarVisiblesComoRevisados}
                    >
                      ✓ {seleccionados.size > 0
                        ? `Revisar visibles excepto ${seleccionados.size} seleccionados`
                        : `Marcar ${movimientosVisibles.filter(m => !m.revisado).length} como revisados`}
                    </Button>
                  )}
                  <span className="text-xs text-gray-400">
                    {movimientosVisibles.length}{categsFiltro ? `/${movimientos.length}` : ''} mov.
                    {movimientos.length === limiteRegistros && ' (límite)'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Panel de Filtros Avanzados */}
          {mostrarFiltrosAvanzados && (
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="text-purple-800 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    🔍 Filtros Avanzados Extracto Bancario
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMostrarFiltrosAvanzados(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {/* Filtros de fecha de movimiento */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-700">📅 Rango de Fechas Movimiento</label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        placeholder="Desde"
                        value={fechaMovDesde}
                        onChange={(e) => setFechaMovDesde(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && aplicarFiltrosAvanzados()}
                        className="text-xs"
                      />
                      <Input
                        type="date"
                        placeholder="Hasta"
                        value={fechaMovHasta}
                        onChange={(e) => setFechaMovHasta(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && aplicarFiltrosAvanzados()}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  
                  {/* Filtros de monto */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-700">💵 Rango de Montos</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Monto desde"
                        value={montoDesde}
                        onChange={(e) => setMontoDesde(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && aplicarFiltrosAvanzados()}
                        className="text-xs"
                      />
                      <Input
                        type="text"
                        placeholder="Monto hasta"
                        value={montoHasta}
                        onChange={(e) => setMontoHasta(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && aplicarFiltrosAvanzados()}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  
                  {/* Multi-select CATEG tipo Excel */}
                  <div className="space-y-2 relative">
                    <label className="text-sm font-medium text-purple-700">💰 CATEG</label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between text-xs h-9"
                      onClick={() => setCategFiltroAbierto(!categFiltroAbierto)}
                    >
                      <span className="truncate">
                        {!categsFiltro ? 'Todas las categorías' :
                          categsFiltro.size === 0 ? 'Ninguna seleccionada' :
                          categsFiltro.size === 1 ? Array.from(categsFiltro)[0] :
                          `${categsFiltro.size} categorías`}
                      </span>
                      <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
                    </Button>
                    {categFiltroAbierto && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-72 flex flex-col">
                        {/* Buscar */}
                        <div className="p-2 border-b">
                          <Input
                            autoFocus
                            placeholder="Buscar categoría..."
                            value={categFiltroBusqueda}
                            onChange={e => setCategFiltroBusqueda(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        {/* Acciones rápidas */}
                        <div className="flex gap-1 p-2 border-b text-[10px]">
                          <button
                            className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                            onClick={() => { setCategsFiltro(null); setCategFiltroAbierto(false) }}
                          >Todas</button>
                          <button
                            className="px-2 py-0.5 rounded bg-gray-50 text-gray-700 hover:bg-gray-100"
                            onClick={() => setCategsFiltro(new Set(categsUnicas))}
                          >Seleccionar todas</button>
                          <button
                            className="px-2 py-0.5 rounded bg-gray-50 text-gray-700 hover:bg-gray-100"
                            onClick={() => setCategsFiltro(new Set())}
                          >Ninguna</button>
                        </div>
                        {/* Lista con checkboxes */}
                        <div className="overflow-y-auto flex-1 p-1">
                          {categsUnicas
                            .filter(c => !categFiltroBusqueda || c.toLowerCase().includes(categFiltroBusqueda.toLowerCase()))
                            .map(cat => {
                              const checked = !categsFiltro || categsFiltro.has(cat)
                              const count = movimientos.filter(m => (m.categ || '(sin categ)') === cat).length
                              return (
                                <label key={cat} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-xs">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const nuevo = new Set(categsFiltro ?? categsUnicas)
                                      if (nuevo.has(cat)) nuevo.delete(cat)
                                      else nuevo.add(cat)
                                      // Si todas seleccionadas → null (sin filtro)
                                      setCategsFiltro(nuevo.size === categsUnicas.length ? null : nuevo)
                                    }}
                                    className="rounded"
                                  />
                                  <span className="truncate flex-1">{cat}</span>
                                  <span className="text-gray-400 text-[10px]">{count}</span>
                                </label>
                              )
                            })}
                        </div>
                        {/* Cerrar */}
                        <div className="p-2 border-t">
                          <Button size="sm" className="w-full h-7 text-xs" onClick={() => setCategFiltroAbierto(false)}>
                            Aplicar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Búsqueda por detalle */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-700">📝 Detalle Movimiento</label>
                    <Input
                      placeholder="Buscar en detalle..."
                      value={busquedaDetalle}
                      onChange={(e) => setBusquedaDetalleExtracto(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && aplicarFiltrosAvanzados()}
                      className="text-xs"
                    />
                  </div>
                  
                  {/* Estadísticas */}
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="text-sm font-medium text-purple-700">📊 Info de Filtrado</label>
                    <div className="text-xs text-gray-600">
                      Mostrando {movimientosVisibles.length}{categsFiltro ? `/${movimientos.length}` : ''} de {limiteRegistros} movimientos máximo
                      {movimientos.length === limiteRegistros && (
                        <div className="text-orange-600 font-medium">
                          ⚠️ Límite alcanzado - puede haber más registros
                        </div>
                      )}
                      {(fechaMovDesde || fechaMovHasta || montoDesde || montoHasta || busquedaCateg || busquedaDetalle) && (
                        <span className="text-purple-600"> (filtros aplicados)</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={aplicarFiltrosAvanzados}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Aplicar Filtros Avanzados
                  </Button>
                  <Button
                    onClick={limpiarFiltrosAvanzados}
                    variant="outline"
                    size="sm"
                  >
                    Limpiar Todos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Panel de Edición Masiva */}
          {modoEdicion && seleccionados.size > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800 flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  Edición Masiva - {seleccionados.size} seleccionados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">CATEG</label>
                    <SelectorCuentaContable
                      value={editData.categ}
                      onSelect={(cuenta) => setEditData({...editData, categ: cuenta?.categ || '', nro_cuenta: cuenta?.nro_cuenta || ''})}
                      autoFocus={false}
                      mostrarSinAsignar={false}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Centro de Costo</label>
                    <Input
                      placeholder="Centro de costo"
                      value={editData.centro_de_costo}
                      onChange={(e) => setEditData({...editData, centro_de_costo: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Estado</label>
                    <Select value={editData.estado} onValueChange={(value) => setEditData({...editData, estado: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conciliado">Conciliado</SelectItem>
                        <SelectItem value="auditar">Auditar</SelectItem>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Contable</label>
                    <Input
                      placeholder="Código contable"
                      value={editData.contable}
                      onChange={(e) => setEditData({...editData, contable: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Interno</label>
                    <Input
                      placeholder="Código interno"
                      value={editData.interno}
                      onChange={(e) => setEditData({...editData, interno: e.target.value})}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">Detalle</label>
                  <Input
                    placeholder="Agregar o modificar detalle del movimiento"
                    value={editData.detalle}
                    onChange={(e) => setEditData({...editData, detalle: e.target.value})}
                  />
                </div>

                {/* Sección de Vinculación con Facturas */}
                {editData.estado === 'conciliado' && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-lg font-medium mb-3 text-blue-800">
                      💡 Vincular con Facturas ARCA (Opcional)
                    </h4>
                    <div className="space-y-3">
                      {Array.from(seleccionados).map(movimientoId => {
                        const movimiento = movimientos.find(m => m.id === movimientoId)
                        if (!movimiento) return null
                        
                        const propuestasInteligentes = generarPropuestasInteligentes(movimiento)
                        const todasLasFacturas = facturasDisponibles.filter(f => 
                          !propuestasInteligentes.find(p => p.id === f.id)
                        )
                        
                        return (
                          <div key={movimientoId} className="border rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">
                                {formatCurrency(movimiento.debitos)} - {movimiento.descripcion}
                              </span>
                            </div>
                            <Popover 
                              open={comboboxAbierto[movimientoId] || false} 
                              onOpenChange={(open) => setComboboxAbierto({...comboboxAbierto, [movimientoId]: open})}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={comboboxAbierto[movimientoId] || false}
                                  className="w-full justify-between"
                                >
                                  {vinculaciones[movimientoId] ? (
                                    (() => {
                                      const opcionSeleccionada = facturasDisponibles.find(f => f.id === vinculaciones[movimientoId])
                                      if (!opcionSeleccionada) return "Sin vincular"
                                      
                                      const tipoIcon = opcionSeleccionada.tipo === 'ARCA' ? '📄' : '📋'
                                      return `${tipoIcon} ${opcionSeleccionada.display_nombre} - ${formatCurrency(opcionSeleccionada.display_monto)}`
                                    })()
                                  ) : "Sin vincular"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0">
                                <Command>
                                  <div className="flex items-center border-b px-3">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <CommandInput 
                                      placeholder="Buscar por empresa, monto, CUIT, fecha..." 
                                      value={busquedaCombobox[movimientoId] || ''}
                                      onValueChange={(value) => setBusquedaCombobox({...busquedaCombobox, [movimientoId]: value})}
                                    />
                                  </div>
                                  <CommandList>
                                    <CommandEmpty>No se encontraron facturas.</CommandEmpty>
                                    
                                    {/* Opción Sin vincular */}
                                    <CommandGroup>
                                      <CommandItem
                                        value="sin_vincular"
                                        onSelect={() => {
                                          setVinculaciones({...vinculaciones, [movimientoId]: ''})
                                          setComboboxAbierto({...comboboxAbierto, [movimientoId]: false})
                                          setBusquedaCombobox({...busquedaCombobox, [movimientoId]: ''})
                                        }}
                                      >
                                        <Check className={`mr-2 h-4 w-4 ${!vinculaciones[movimientoId] ? "opacity-100" : "opacity-0"}`} />
                                        Sin vincular
                                      </CommandItem>
                                    </CommandGroup>
                                    
                                    {/* Propuestas inteligentes filtradas */}
                                    {(() => {
                                      const propuestasFiltradas = filtrarFacturasConBusqueda(propuestasInteligentes, busquedaCombobox[movimientoId] || '')
                                      return propuestasFiltradas.length > 0 && (
                                        <CommandGroup heading="⭐ PROPUESTAS INTELIGENTES">
                                          {propuestasFiltradas.map(opcion => (
                                            <CommandItem
                                              key={opcion.id}
                                              value={`${opcion.display_nombre} ${opcion.cuit} ${opcion.display_monto} ${opcion.display_referencia || ''}`}
                                              onSelect={() => {
                                                setVinculaciones({...vinculaciones, [movimientoId]: opcion.id})
                                                setComboboxAbierto({...comboboxAbierto, [movimientoId]: false})
                                                setBusquedaCombobox({...busquedaCombobox, [movimientoId]: ''})
                                              }}
                                            >
                                              <Check className={`mr-2 h-4 w-4 ${vinculaciones[movimientoId] === opcion.id ? "opacity-100" : "opacity-0"}`} />
                                              <div className="flex flex-col">
                                                <span className="font-medium">
                                                  ⭐ {opcion.tipo === 'ARCA' ? '📄' : '📋'} {opcion.display_nombre} - {formatCurrency(opcion.display_monto)}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                  {new Date(opcion.fecha_estimada + 'T12:00:00').toLocaleDateString('es-AR')} • 
                                                  {opcion.tipo === 'ARCA' ? 'Factura ARCA' : 'Template'} • 
                                                  {opcion.display_referencia} • CUIT: {opcion.cuit}
                                                </span>
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      )
                                    })()}
                                    
                                    {/* Todas las facturas filtradas */}
                                    {(() => {
                                      const todasFiltradas = filtrarFacturasConBusqueda(todasLasFacturas, busquedaCombobox[movimientoId] || '')
                                      return todasFiltradas.length > 0 && (
                                        <CommandGroup heading="📋 TODAS LAS OPCIONES">
                                          {todasFiltradas.slice(0, 20).map(opcion => ( // Limitar a 20 para performance
                                            <CommandItem
                                              key={opcion.id}
                                              value={`${opcion.display_nombre} ${opcion.cuit} ${opcion.display_monto} ${opcion.display_referencia || ''}`}
                                              onSelect={() => {
                                                setVinculaciones({...vinculaciones, [movimientoId]: opcion.id})
                                                setComboboxAbierto({...comboboxAbierto, [movimientoId]: false})
                                                setBusquedaCombobox({...busquedaCombobox, [movimientoId]: ''})
                                              }}
                                            >
                                              <Check className={`mr-2 h-4 w-4 ${vinculaciones[movimientoId] === opcion.id ? "opacity-100" : "opacity-0"}`} />
                                              <div className="flex flex-col">
                                                <span className="font-medium">
                                                  {opcion.tipo === 'ARCA' ? '📄' : '📋'} {opcion.display_nombre} - {formatCurrency(opcion.display_monto)}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                  {new Date(opcion.fecha_estimada + 'T12:00:00').toLocaleDateString('es-AR')} • 
                                                  {opcion.tipo === 'ARCA' ? 'Factura ARCA' : 'Template'} • 
                                                  {opcion.display_referencia} • CUIT: {opcion.cuit}
                                                </span>
                                              </div>
                                            </CommandItem>
                                          ))}
                                          {todasFiltradas.length > 20 && (
                                            <div className="px-2 py-1 text-xs text-gray-500 text-center">
                                              ... y {todasFiltradas.length - 20} más. Refina tu búsqueda.
                                            </div>
                                          )}
                                        </CommandGroup>
                                      )
                                    })()}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={aplicarEdicionMasiva} className="bg-green-600 hover:bg-green-700">
                    <Save className="h-4 w-4 mr-2" />
                    Aplicar Cambios
                  </Button>
                  <Button onClick={cancelarEdicion} variant="outline">
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla de Movimientos */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Movimientos Bancarios</CardTitle>
                <Popover open={selectorColumnasAbierto} onOpenChange={setSelectorColumnasAbierto}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Columns className="h-4 w-4" />
                      Columnas
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="end">
                    <p className="text-xs font-medium text-gray-500 mb-2">Columnas visibles</p>
                    <div className="space-y-1">
                      {COLUMNAS_OPCIONALES.map(c => (
                        <label key={c.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <Checkbox
                            checked={col(c.key)}
                            onCheckedChange={() => toggleColumna(c.key)}
                          />
                          <span className="text-sm">{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center text-gray-500 py-8">
                  <RotateCcw className="h-8 w-8 mx-auto mb-4 animate-spin text-gray-300" />
                  <p>Cargando movimientos...</p>
                </div>
              ) : movimientosVisibles.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg mb-2">No se encontraron movimientos</p>
                  <p className="text-sm">
                    Ajusta los filtros o importa datos de extracto bancario.
                  </p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-white border-b">
                      <TableRow>
                        {modoEdicion && (
                          <TableHead className="w-12">
                            <Checkbox
                              checked={seleccionados.size === movimientosVisibles.length && movimientosVisibles.length > 0}
                              onCheckedChange={seleccionarTodos}
                            />
                          </TableHead>
                        )}
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Débitos</TableHead>
                        <TableHead className="text-right">Créditos</TableHead>
                        {col('saldo') && <TableHead className="text-right">Saldo</TableHead>}
                        {col('categ') && <TableHead>CATEG</TableHead>}
                        <TableHead>Estado</TableHead>
                        {col('detalle') && <TableHead>Detalle</TableHead>}
                        {col('proveedor_nombre') && <TableHead>Proveedor</TableHead>}
                        {col('comprobantes_pagados') && <TableHead>Comprobantes</TableHead>}
                        {col('motivo_revision') && <TableHead>Motivo Revisión</TableHead>}
                        {col('centro_de_costo') && <TableHead>Centro Costo</TableHead>}
                        {col('contable') && <TableHead>Contable</TableHead>}
                        {col('interno') && <TableHead>Interno</TableHead>}
                        {col('nro_cuenta') && <TableHead>Nro Cuenta</TableHead>}
                        {col('template_id') && <TableHead>Template</TableHead>}
                        {col('template_cuota_id') && <TableHead>Cuota</TableHead>}
                        {col('comprobante_arca_id') && <TableHead>Factura ARCA</TableHead>}
                        {col('leyenda1') && <TableHead>Leyenda Adic. 1</TableHead>}
                        {col('leyenda2') && <TableHead>Leyenda Adic. 2</TableHead>}
                        {col('origen') && <TableHead>Origen</TableHead>}
                        {col('control') && <TableHead className="text-right">Control</TableHead>}
                        {col('orden') && <TableHead className="text-right">Orden</TableHead>}
                        <TableHead className="w-8 text-center">📝</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientosVisibles.map((movimiento) => (
                        <TableRow key={movimiento.id} className={!movimiento.revisado ? 'bg-red-50/60' : ''}>
                          {modoEdicion && (
                            <TableCell>
                              <Checkbox
                                checked={seleccionados.has(movimiento.id)}
                                onCheckedChange={() => toggleSeleccion(movimiento.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-mono text-sm">
                            {new Date(movimiento.fecha + 'T12:00:00').toLocaleDateString('es-AR')}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {movimiento.descripcion}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {movimiento.debitos > 0 ? formatCurrency(movimiento.debitos) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {movimiento.creditos > 0 ? formatCurrency(movimiento.creditos) : '-'}
                          </TableCell>
                          {col('saldo') && (
                            <TableCell className="text-right font-mono">
                              {formatCurrency(movimiento.saldo)}
                            </TableCell>
                          )}
                          {col('categ') && (
                            <TableCell>
                              {movimiento.categ ? (
                                <Badge variant={movimiento.categ.startsWith('INVALIDA:') ? 'destructive' : 'default'}>
                                  {movimiento.categ}
                                </Badge>
                              ) : (
                                <Badge variant="outline">Sin CATEG</Badge>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant={
                              movimiento.estado === 'conciliado' ? 'default' :
                              movimiento.estado === 'auditar' ? 'secondary' :
                              'outline'
                            }>
                              {movimiento.estado}
                            </Badge>
                          </TableCell>
                          {col('detalle') && (
                            <TableCell className="max-w-xs text-sm text-gray-600">
                              {editandoDetalleId === movimiento.id ? (
                                <input
                                  autoFocus
                                  type="text"
                                  className="border rounded px-1 py-0.5 text-xs w-full"
                                  value={editandoDetalleVal}
                                  onChange={(e) => setEditandoDetalleVal(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      await (schemaActivo && schemaActivo !== 'public' ? supabase.schema(schemaActivo) : supabase)
                                        .from(tablaActiva).update({ detalle: editandoDetalleVal }).eq('id', movimiento.id)
                                      actualizarLocal(movimiento.id, { detalle: editandoDetalleVal })
                                      setEditandoDetalleId(null)
                                    }
                                    if (e.key === 'Escape') setEditandoDetalleId(null)
                                  }}
                                  onBlur={async () => {
                                    if (editandoDetalleVal !== (movimiento.detalle || '')) {
                                      await (schemaActivo && schemaActivo !== 'public' ? supabase.schema(schemaActivo) : supabase)
                                        .from(tablaActiva).update({ detalle: editandoDetalleVal }).eq('id', movimiento.id)
                                      actualizarLocal(movimiento.id, { detalle: editandoDetalleVal })
                                    }
                                    setEditandoDetalleId(null)
                                  }}
                                />
                              ) : (
                                <span
                                  className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded truncate block"
                                  title={movimiento.detalle ? `${movimiento.detalle} — click para editar` : 'Click para agregar detalle'}
                                  onClick={() => { setEditandoDetalleId(movimiento.id); setEditandoDetalleVal(movimiento.detalle || '') }}
                                >
                                  {movimiento.detalle || <span className="text-gray-300">—</span>}
                                </span>
                              )}
                            </TableCell>
                          )}
                          {col('proveedor_nombre') && (
                            <TableCell className="text-sm truncate max-w-[180px]" title={movimiento.proveedor_nombre || ''}>
                              {movimiento.proveedor_nombre || <span className="text-gray-300">—</span>}
                            </TableCell>
                          )}
                          {col('comprobantes_pagados') && (
                            <TableCell className="text-sm truncate max-w-[200px]" title={movimiento.comprobantes_pagados || ''}>
                              {movimiento.comprobantes_pagados || <span className="text-gray-300">—</span>}
                            </TableCell>
                          )}
                          {col('motivo_revision') && (
                            <TableCell className="max-w-xs truncate text-xs text-orange-600">
                              {movimiento.motivo_revision || '-'}
                            </TableCell>
                          )}
                          {col('centro_de_costo') && (
                            <TableCell className="text-sm">{movimiento.centro_de_costo || '-'}</TableCell>
                          )}
                          {col('contable') && (
                            <TableCell className="text-sm">{movimiento.contable || '-'}</TableCell>
                          )}
                          {col('interno') && (
                            <TableCell className="text-sm">{movimiento.interno || '-'}</TableCell>
                          )}
                          {col('nro_cuenta') && (
                            <TableCell className="text-sm font-mono">{movimiento.nro_cuenta || '-'}</TableCell>
                          )}
                          {col('template_id') && (
                            <TableCell className="text-xs font-mono">
                              {movimiento.template_id
                                ? <span className="text-green-700" title={movimiento.template_id}>✓ {movimiento.template_id.slice(0, 8)}…</span>
                                : <span className="text-gray-400">-</span>}
                            </TableCell>
                          )}
                          {col('template_cuota_id') && (
                            <TableCell className="text-xs font-mono">
                              {movimiento.template_cuota_id
                                ? <span className="text-green-700" title={movimiento.template_cuota_id}>✓ {movimiento.template_cuota_id.slice(0, 8)}…</span>
                                : <span className="text-gray-400">-</span>}
                            </TableCell>
                          )}
                          {col('comprobante_arca_id') && (
                            <TableCell className="text-xs font-mono">
                              {movimiento.comprobante_arca_id
                                ? <span className="text-blue-700" title={movimiento.comprobante_arca_id}>✓ {movimiento.comprobante_arca_id.slice(0, 8)}…</span>
                                : <span className="text-gray-400">-</span>}
                            </TableCell>
                          )}
                          {col('leyenda1') && (
                            <TableCell className="text-sm truncate max-w-xs">{movimiento.leyendas_adicionales_1 || '-'}</TableCell>
                          )}
                          {col('leyenda2') && (
                            <TableCell className="text-sm truncate max-w-xs">{movimiento.leyendas_adicionales_2 || '-'}</TableCell>
                          )}
                          {col('origen') && (
                            <TableCell className="text-sm">{movimiento.origen || '-'}</TableCell>
                          )}
                          {col('control') && (
                            <TableCell className="text-right font-mono text-sm">
                              {movimiento.control !== undefined && movimiento.control !== null ? formatCurrency(movimiento.control) : '-'}
                            </TableCell>
                          )}
                          {col('orden') && (
                            <TableCell className="text-right text-sm font-mono">{movimiento.orden ?? '-'}</TableCell>
                          )}
                          <TableCell>
                            {(() => {
                              const categInvalida = !!movimiento.categ && !cuentasCategSet.has(movimiento.categ.toUpperCase().trim()) && !templateCategSet.has(movimiento.categ.toUpperCase().trim())
                              const sinVincular = movimiento.estado === 'conciliado' && !movimiento.comprobante_arca_id && !movimiento.template_id
                              const esConciliado = movimiento.estado === 'conciliado'
                              const mostrar = !esConciliado || sinVincular || categInvalida
                              const label = categInvalida && esConciliado ? 'Re-asignar'
                                : esConciliado && !sinVincular ? 'Re-asignar'
                                : esConciliado ? 'Vincular' : 'Asignar'
                              // Conciliados con vínculo: mostrar botón discreto de re-asignar
                              if (esConciliado && !sinVincular && !categInvalida) {
                                return (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] text-gray-400 hover:text-gray-700 gap-0.5 px-1"
                                    onClick={() => {
                                      if (window.confirm('Este movimiento ya está conciliado. ¿Desea re-asignarlo a otro template/factura?')) {
                                        abrirModalAsignar(movimiento)
                                      }
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                    Re-asignar
                                  </Button>
                                )
                              }
                              if (!mostrar) return null
                              return (
                                <Button
                                  size="sm"
                                  variant={categInvalida ? 'destructive' : 'outline'}
                                  className="h-7 text-xs gap-1"
                                  onClick={() => abrirModalAsignar(movimiento)}
                                >
                                  <Plus className="h-3 w-3" />
                                  {label}
                                </Button>
                              )
                            })()}
                          </TableCell>
                          {/* Nota operador */}
                          <TableCell className="text-center px-1">
                            {editandoNotaId === movimiento.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editandoNotaVal}
                                  onChange={e => setEditandoNotaVal(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') guardarNotaOperador(movimiento.id, editandoNotaVal)
                                    if (e.key === 'Escape') { setEditandoNotaId(null); setEditandoNotaVal('') }
                                  }}
                                  className="h-6 text-xs w-40"
                                  autoFocus
                                  placeholder="Escribir nota..."
                                />
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => guardarNotaOperador(movimiento.id, editandoNotaVal)}>
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditandoNotaId(null); setEditandoNotaVal('') }}>
                                  <X className="h-3 w-3 text-gray-400" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                className={`text-sm cursor-pointer hover:scale-110 transition-transform ${movimiento.nota_operador ? '' : 'opacity-30 hover:opacity-70'}`}
                                title={movimiento.nota_operador || 'Agregar nota'}
                                onClick={() => { setEditandoNotaId(movimiento.id); setEditandoNotaVal(movimiento.nota_operador || '') }}
                              >
                                {movimiento.nota_operador ? '📝' : '💬'}
                              </button>
                            )}
                          </TableCell>
                          {/* Revisado toggle */}
                          <TableCell className="text-center px-1">
                            <button
                              className={`text-sm cursor-pointer hover:scale-110 transition-transform ${movimiento.revisado ? 'opacity-70' : ''}`}
                              title={movimiento.revisado ? 'Marcado como revisado — click para desmarcar' : 'Sin revisar — click para marcar'}
                              onClick={() => marcarComoRevisado([movimiento.id], !movimiento.revisado)}
                            >
                              {movimiento.revisado ? '✅' : '⬜'}
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importar" className="space-y-4">
          {(() => {
            // Configuración por cuenta
            const CONFIG_IMPORTADORES: Record<string, { endpoint: string; formato: string; accept: string }> = {
              msa_galicia:     { endpoint: '/api/import-excel',    formato: 'Excel MSA Galicia CC (.xlsx)',  accept: '.xlsx,.xls' },
              pam_galicia_cc:  { endpoint: '/api/import-excel',    formato: 'Excel PAM Galicia CC (.xlsx)',  accept: '.xlsx,.xls' },
              pam_galicia:     { endpoint: '/api/import-excel-ca', formato: 'Excel PAM Galicia CA (.xlsx)',  accept: '.xlsx,.xls' },
              ma_galicia:      { endpoint: '/api/import-excel-ca', formato: 'Excel MA Galicia CA (.xlsx)',   accept: '.xlsx,.xls' },
            }

            const cuenta = CUENTAS_BANCARIAS.find(c => c.id === tablaActiva)
            const config = CONFIG_IMPORTADORES[tablaActiva]

            if (!config) {
              return (
                <Card>
                  <CardHeader><CardTitle>Importar Extracto Bancario</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-center text-gray-400 py-10">
                      <Upload className="h-12 w-12 mx-auto mb-4 text-gray-200" />
                      <p className="text-base font-medium mb-1">{cuenta?.nombre ?? tablaActiva}</p>
                      <p className="text-sm">Importador no disponible aún para esta cuenta.</p>
                    </div>
                  </CardContent>
                </Card>
              )
            }

            const verificarSaldo = async () => {
              setImportVerificando(true)
              try {
                const { data } = await supabase.from(tablaActiva).select('id').limit(1).maybeSingle()
                setImportMostrarSaldo(data === null)
              } catch { setImportMostrarSaldo(false) }
              finally { setImportVerificando(false) }
            }

            const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              const f = e.target.files?.[0] ?? null
              setImportFile(f)
              setImportResult(null)
              if (f) verificarSaldo()
            }

            const handleImport = async () => {
              if (!importFile) return
              setImportLoading(true)
              setImportResult(null)
              try {
                const fd = new FormData()
                fd.append('file', importFile)
                fd.append('tabla', tablaActiva)
                if (importMostrarSaldo && importSaldoInicial.trim()) {
                  fd.append('saldo_inicial', importSaldoInicial)
                }
                const res = await fetch(config.endpoint, { method: 'POST', body: fd })
                const data = await res.json()
                setImportResult({ ...data, ok: res.ok })
              } catch {
                setImportResult({ ok: false, message: 'Error de conexión al procesar el archivo' })
              } finally {
                setImportLoading(false)
              }
            }

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Importar — {cuenta?.nombre ?? tablaActiva}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Selector archivo */}
                  <div className="space-y-2">
                    <Label htmlFor="import-file-input">{config.formato}</Label>
                    <Input
                      id="import-file-input"
                      type="file"
                      accept={config.accept}
                      onChange={handleFileChange}
                      disabled={importLoading}
                    />
                    {importFile && (
                      <p className="text-sm text-muted-foreground">✅ {importFile.name}</p>
                    )}
                  </div>

                  {/* Saldo inicial (solo primer import) */}
                  {importVerificando && (
                    <Alert><Loader2 className="h-4 w-4 animate-spin inline mr-2" /><AlertDescription>Verificando registros existentes…</AlertDescription></Alert>
                  )}
                  {importMostrarSaldo && !importVerificando && (
                    <div className="space-y-2">
                      <Label htmlFor="import-saldo" className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Saldo Inicial
                      </Label>
                      <Input
                        id="import-saldo"
                        type="text"
                        placeholder="Ej: 1.234.567,89"
                        value={importSaldoInicial}
                        onChange={e => setImportSaldoInicial(e.target.value)}
                        disabled={importLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Primera importación detectada. Ingresá el saldo inicial de la cuenta (punto = miles, coma = decimal).
                      </p>
                    </div>
                  )}

                  {/* Botón */}
                  <Button onClick={handleImport} disabled={!importFile || importLoading} className="w-full">
                    {importLoading
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando…</>
                      : <><Upload className="mr-2 h-4 w-4" />Importar movimientos</>
                    }
                  </Button>

                  {/* Resultado */}
                  {importResult && (
                    <div className="space-y-3">
                      <Alert variant={importResult.ok ? 'default' : 'destructive'}>
                        <div className="flex items-center gap-2">
                          {importResult.ok ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                          <AlertDescription>{importResult.message}</AlertDescription>
                        </div>
                      </Alert>

                      {importResult.summary && (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>Total filas: <strong>{importResult.summary.totalFilas}</strong></div>
                              <div>Insertadas: <strong>{importResult.summary.filasInsertadas}</strong></div>
                              <div>Errores categoría: <strong>{importResult.summary.erroresCategoria}</strong></div>
                              <div>Errores control: <strong>{importResult.summary.erroresControl}</strong></div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {importResult.controlErrors?.length > 0 && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <p className="font-semibold mb-1">Errores de control ({importResult.controlErrors.length} filas):</p>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {importResult.controlErrors.map((e: any, i: number) => (
                                <div key={i} className="text-xs bg-red-50 p-2 rounded">
                                  <strong>Fila {e.fila}:</strong> {e.fecha} — {e.descripcion}
                                  <br /><span className="text-red-700">Control: {e.control}</span>
                                </div>
                              ))}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {importResult.errores?.length > 0 && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <p className="font-semibold mb-1">Errores de categoría ({importResult.errores.length} filas):</p>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {importResult.errores.map((e: any, i: number) => (
                                <div key={i} className="text-xs bg-red-50 p-2 rounded">
                                  <strong>Fila {e.fila}:</strong> {e.descripcion}
                                  <br /><span className="text-red-700">{e.error} — "{e.categ}"</span>
                                </div>
                              ))}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {importResult.ok && importResult.insertedCount > 0 && (
                        <Button variant="outline" className="w-full" onClick={() => { recargar(); setImportFile(null); setImportResult(null) }}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Ver movimientos importados
                        </Button>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Se filtran automáticamente movimientos de hoy y fechas futuras. Se calculan orden y control automáticamente.
                  </p>
                </CardContent>
              </Card>
            )
          })()}
        </TabsContent>

        <TabsContent value="reportes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reportes de Conciliación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">Reportes y Análisis</p>
                <p className="text-sm">
                  Genera reportes detallados del proceso de conciliación y análisis de movimientos.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Configurador */}
      <Dialog open={configuradorAbierto} onOpenChange={setConfiguradorAbierto}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuración de Reglas</DialogTitle>
          </DialogHeader>

          {/* Selector cuenta — compartido entre ambas tabs */}
          <div className="flex items-center gap-3 pb-2 border-b">
            <span className="text-sm font-medium whitespace-nowrap">Cuenta bancaria:</span>
            <Select value={cuentaConfig} onValueChange={setCuentaConfig}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUENTAS_BANCARIAS.filter(c => c.activa).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="conciliacion" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="conciliacion">Reglas Conciliación</TabsTrigger>
              <TabsTrigger value="contable-interno">Contable e Interno</TabsTrigger>
            </TabsList>

            <TabsContent value="conciliacion" className="mt-4">
              <ConfiguradorReglas cuentaBancariaId={cuentaConfig} />
            </TabsContent>

            <TabsContent value="contable-interno" className="mt-4">
              <ConfiguradorReglasContable cuentaBancariaId={cuentaConfig} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal Selector de Cuenta / Caja */}
      <Dialog open={selectorAbierto} onOpenChange={setSelectorAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Cuenta / Caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cuentas bancarias */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cuentas Bancarias</p>
              <div className="space-y-2">
                {cuentasDisponibles.filter(c => c.tipo !== 'caja').map((cuenta) => (
                  <Button
                    key={cuenta.id}
                    variant="outline"
                    className={`w-full justify-start ${cuentaSeleccionada === cuenta.id ? 'border-blue-500 bg-blue-50' : ''}`}
                    onClick={() => ejecutarConCuenta(cuenta.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Banknote className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium">{cuenta.nombre}</div>
                        <div className="text-sm text-gray-500">{cuenta.empresa}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
            {/* Cajas */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cajas</p>
              <div className="space-y-2">
                {cuentasDisponibles.filter(c => c.tipo === 'caja').map((cuenta) => (
                  <Button
                    key={cuenta.id}
                    variant="outline"
                    className={`w-full justify-start ${cuentaSeleccionada === cuenta.id ? 'border-green-500 bg-green-50' : ''}`}
                    onClick={() => { setCuentaSeleccionada(cuenta.id); setSelectorAbierto(false) }}
                  >
                    <div className="flex items-center gap-3">
                      <Banknote className="h-4 w-4 text-green-600" />
                      <div className="text-left">
                        <div className="font-medium">{cuenta.nombre}</div>
                        <div className="text-sm text-gray-500">{cuenta.empresa}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Asignar Manualmente */}
      <Dialog open={modalAsignar} onOpenChange={setModalAsignar}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar Manualmente</DialogTitle>
            {movimientoAsignando && (
              <DialogDescription className="font-mono text-xs">
                {movimientoAsignando.fecha} · {movimientoAsignando.descripcion} ·{' '}
                <span className="font-semibold">
                  {movimientoAsignando.debitos > 0
                    ? `Débito $${movimientoAsignando.debitos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : `Crédito $${movimientoAsignando.creditos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                </span>
              </DialogDescription>
            )}
          </DialogHeader>

          <Tabs value={tabAsignar} onValueChange={(v) => setTabAsignar(v as 'arca' | 'template' | 'sueldo')}>
            <TabsList className="w-full">
              <TabsTrigger value="template" className="flex-1">Template</TabsTrigger>
              <TabsTrigger value="arca" className="flex-1">Factura ARCA</TabsTrigger>
              <TabsTrigger value="sueldo" className="flex-1">Sueldo</TabsTrigger>
            </TabsList>

            {/* Tab Template */}
            <TabsContent value="template" className="space-y-3 mt-3">
              <Input
                placeholder="Buscar template por nombre o agrupadora..."
                value={busquedaAsignarTemplate}
                onChange={e => setBusquedaAsignarTemplate(e.target.value)}
                autoFocus
              />
              <div className="max-h-72 overflow-y-auto space-y-1">
                {templatesParaAsignar
                  .filter(t => {
                    const q = busquedaAsignarTemplate.toLowerCase()
                    return !q || t.nombre_referencia?.toLowerCase().includes(q) || t.cuenta_agrupadora?.toLowerCase().includes(q) || t.categ?.toLowerCase().includes(q)
                  })
                  .map(t => (
                    <div
                      key={t.id}
                      onClick={async () => {
                        const nuevo = templateElegido?.id === t.id ? null : t
                        setTemplateElegido(nuevo)
                        setCategManualAsignar('')
                        setCuotaElegida(null)
                        setCuotasExistentes([])
                        if (nuevo) {
                          // Cargar cuotas existentes no conciliadas de este template
                          const { data: cuotas } = await supabase
                            .from('cuotas_egresos_sin_factura')
                            .select('id, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, categ, tipo_movimiento')
                            .eq('egreso_id', nuevo.id)
                            .not('estado', 'eq', 'conciliado')
                            .order('fecha_vencimiento', { ascending: true })
                          setCuotasExistentes(cuotas || [])
                          if (nuevo.es_multi_cuenta) {
                            const { data } = await supabase
                              .from('cuotas_egresos_sin_factura')
                              .select('categ')
                              .eq('egreso_id', nuevo.id)
                              .not('categ', 'is', null)
                            const unicas = [...new Set((data || []).map((r: any) => r.categ).filter(Boolean))]
                            setSubcategsDisponibles(unicas as string[])
                          } else {
                            setSubcategsDisponibles([])
                          }
                        }
                      }}
                      className={`p-2.5 border rounded-lg cursor-pointer transition-colors ${
                        templateElegido?.id === t.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      {t.cuenta_agrupadora && (
                        <div className="text-[10px] text-gray-400 mb-0.5">{t.cuenta_agrupadora}</div>
                      )}
                      <div className="font-medium text-sm">{t.nombre_referencia}</div>
                      <div className="text-xs text-gray-500">
                        {t.categ}
                        {t.responsable && <span className="ml-2 text-blue-600">· {t.responsable}</span>}
                      </div>
                    </div>
                  ))}
              </div>
              {templateElegido && (
                <div className="space-y-2">
                  {/* Selector: cuota existente o crear nueva */}
                  {cuotasExistentes.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Cuotas existentes del template</label>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {cuotasExistentes.map(c => {
                          const fmtFecha = (f: string | null) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR') : '—'
                          const fechaVenc = fmtFecha(c.fecha_vencimiento)
                          const fechaEst = fmtFecha(c.fecha_estimada)
                          const montoStr = parseFloat(c.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          const fechaExtracto = movimientoAsignando?.fecha
                          const fechasDifieren = fechaExtracto && (c.fecha_vencimiento !== fechaExtracto || c.fecha_estimada !== fechaExtracto)
                          return (
                            <div
                              key={c.id}
                              onClick={() => setCuotaElegida(cuotaElegida?.id === c.id ? null : c)}
                              className={`p-2 border rounded cursor-pointer text-xs transition-colors ${
                                cuotaElegida?.id === c.id
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="font-medium">Venc: {fechaVenc}</span>
                                  {c.fecha_estimada !== c.fecha_vencimiento && (
                                    <span className="ml-2 text-gray-400">Est: {fechaEst}</span>
                                  )}
                                </div>
                                <span className="font-mono">${montoStr}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  c.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                                  c.estado === 'pagado' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>{c.estado}</span>
                              </div>
                              {cuotaElegida?.id === c.id && fechasDifieren && (
                                <div className="text-orange-600 mt-1 text-[10px]">⚠ Fechas se actualizarán al {fmtFecha(fechaExtracto)} (fecha real de débito)</div>
                              )}
                              {c.descripcion && <div className="text-gray-500 mt-0.5">{c.descripcion}</div>}
                              {c.categ && <div className="text-gray-400 mt-0.5">categ: {c.categ}</div>}
                            </div>
                          )
                        })}
                      </div>
                      <div
                        onClick={() => setCuotaElegida(null)}
                        className={`mt-1 p-2 border rounded cursor-pointer text-xs text-center transition-colors ${
                          cuotaElegida === null
                            ? 'border-blue-500 bg-blue-50 font-medium text-blue-700'
                            : 'border-dashed border-gray-300 text-gray-500 hover:border-blue-300'
                        }`}
                      >
                        + Crear cuota nueva
                      </div>
                    </div>
                  )}
                  {templateElegido.es_multi_cuenta && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Sub-categoría</label>
                      {/* Texto libre */}
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 mb-1"
                        placeholder="Escribir nombre o elegir abajo..."
                        value={categManualAsignar}
                        onChange={(e) => setCategManualAsignar(e.target.value)}
                      />
                      {/* Sub-categorías ya usadas en este template */}
                      {subcategsDisponibles.length > 0 && (
                        <div className="mb-1">
                          <div className="text-[10px] text-green-700 font-semibold mb-0.5">Usadas en este template:</div>
                          <div className="flex flex-wrap gap-1">
                            {subcategsDisponibles.map(s => (
                              <button
                                key={s}
                                type="button"
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${categManualAsignar === s ? 'bg-green-100 border-green-400 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                onClick={() => setCategManualAsignar(s)}
                              >{s}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Templates existentes agrupados por cuenta_agrupadora */}
                      {(() => {
                        const filtrados = templatesParaAsignar
                          .filter(t => t.id !== templateElegido.id && t.nombre_referencia)
                          .filter(t => !categManualAsignar.trim() || t.nombre_referencia.toLowerCase().includes(categManualAsignar.toLowerCase()) || (t.cuenta_agrupadora || '').toLowerCase().includes(categManualAsignar.toLowerCase()))
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
                                      className={`w-full text-left px-2 py-1 text-xs hover:bg-blue-50 ${categManualAsignar === t.nombre_referencia ? 'bg-blue-50 font-semibold text-blue-700' : ''}`}
                                      onClick={() => setCategManualAsignar(t.nombre_referencia)}
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
                      {/* Plan de cuentas contables completo */}
                      <div className="text-[10px] text-gray-500 font-semibold mb-0.5">Cuentas contables:</div>
                      <SelectorCuentaContable
                        value={categManualAsignar}
                        onSelect={(cuenta) => setCategManualAsignar(cuenta?.categ || '')}
                        autoFocus={false}
                        mostrarSinAsignar={false}
                        className="w-full"
                      />
                    </div>
                  )}
                  <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                    {cuotaElegida ? (
                      <>Se usará cuota existente de <strong>{templateElegido.nombre_referencia}</strong> — monto y fechas se actualizarán desde el extracto.</>
                    ) : (
                      <>Se creará cuota nueva en <strong>{templateElegido.nombre_referencia}</strong> con monto del extracto y estado <em>conciliado</em>.</>
                    )}
                    {templateElegido.es_multi_cuenta && categManualAsignar && (
                      <span className="block mt-1 text-blue-600">Categoría: <strong>{categManualAsignar}</strong></span>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab ARCA */}
            <TabsContent value="arca" className="space-y-3 mt-3">
              <Input
                placeholder="Buscar por proveedor, CUIT o monto..."
                value={busquedaAsignarArca}
                onChange={e => setBusquedaAsignarArca(e.target.value)}
                autoFocus
              />
              <div className="max-h-72 overflow-y-auto space-y-1">
                {(() => {
                  const propuestas = movimientoAsignando
                    ? generarPropuestasArca(movimientoAsignando, facturasDisponibles)
                    : []
                  const conScore   = propuestas.filter(p => p.score > 0)
                  const sinScore   = propuestas.filter(p => p.score === 0)
                  const busqueda   = busquedaAsignarArca.toLowerCase().trim()

                  // Helper fechas: muestra emision siempre; estimada solo si difiere
                  const fmtFecha = (iso: string | null | undefined) =>
                    iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '-'

                  const fechasRow = (f: any) => {
                    const emStr  = fmtFecha(f.fecha_emision)
                    const estStr = fmtFecha(f.fecha_estimada)
                    const difieren = f.fecha_emision && f.fecha_estimada && f.fecha_emision !== f.fecha_estimada
                    return difieren
                      ? <><span>Em: {emStr}</span><span className="text-gray-400">Est: {estStr}</span></>
                      : <span>{emStr}</span>
                  }

                  const montoRow = (f: any) =>
                    <span className="font-mono">${(f.display_monto ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>

                  // Con búsqueda activa: filtrar todo
                  if (busqueda) {
                    return propuestas
                      .filter(({ factura: f }) =>
                        f.display_nombre?.toLowerCase().includes(busqueda) ||
                        (f.cuit || '').includes(busqueda) ||
                        String(f.display_monto).includes(busqueda)
                      )
                      .map(({ factura: f }) => (
                        <div
                          key={f.id}
                          onClick={() => setArcaElegida(arcaElegida?.id === f.id ? null : f)}
                          className={`p-2.5 border rounded-lg cursor-pointer transition-colors ${arcaElegida?.id === f.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                        >
                          <div className="font-medium text-sm">{f.display_nombre}</div>
                          <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                            <span>{f.cuit}</span>
                            {fechasRow(f)}
                            {montoRow(f)}
                          </div>
                        </div>
                      ))
                  }

                  // Sin búsqueda: sugerencias primero, luego el resto
                  const renderFila = ({ factura: f, badges }: PropuestaArca, sugerida: boolean) => (
                    <div
                      key={f.id}
                      onClick={() => setArcaElegida(arcaElegida?.id === f.id ? null : f)}
                      className={`p-2.5 border rounded-lg cursor-pointer transition-colors ${arcaElegida?.id === f.id ? 'border-blue-500 bg-blue-50' : sugerida ? 'border-green-200 hover:border-green-400 hover:bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm">{f.display_nombre}</div>
                        {sugerida && badges.length > 0 && (
                          <div className="flex gap-1 flex-wrap justify-end shrink-0">
                            {badges.map((b, i) => (
                              <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${b.color}`}>{b.texto}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                        <span>{f.cuit}</span>
                        {fechasRow(f)}
                        {montoRow(f)}
                      </div>
                    </div>
                  )

                  return (
                    <>
                      {conScore.length > 0 && (
                        <>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-0.5">Sugerencias</p>
                          {conScore.map(p => renderFila(p, true))}
                          {sinScore.length > 0 && (
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-0.5 pt-1">Otras facturas</p>
                          )}
                        </>
                      )}
                      {sinScore.map(p => renderFila(p, false))}
                    </>
                  )
                })()}
              </div>
              {arcaElegida && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                  Se vinculará factura <strong>{arcaElegida.display_nombre}</strong>. Cuenta contable y nro_cuenta se completarán desde la factura.
                </div>
              )}
            </TabsContent>

            {/* Tab Sueldo */}
            <TabsContent value="sueldo" className="space-y-3 mt-3">
              <Input
                placeholder="Buscar por empleado, descripción o monto..."
                value={busquedaAsignarSueldo}
                onChange={e => setBusquedaAsignarSueldo(e.target.value)}
                autoFocus
              />
              <div className="max-h-72 overflow-y-auto space-y-1">
                {(() => {
                  const busqueda = busquedaAsignarSueldo.toLowerCase().trim()
                  const montoMov = movimientoAsignando?.debitos > 0 ? movimientoAsignando.debitos : movimientoAsignando?.creditos || 0

                  // Separar: sugerencias (mismo monto) y resto
                  const sugerencias = sueldosParaAsignar.filter(s =>
                    Math.abs(parseFloat(s.monto) - montoMov) < 0.01
                  )
                  const resto = sueldosParaAsignar.filter(s =>
                    Math.abs(parseFloat(s.monto) - montoMov) >= 0.01
                  )

                  const filtrar = (lista: any[]) => busqueda
                    ? lista.filter(s =>
                        (s.empleado?.nombre || '').toLowerCase().includes(busqueda) ||
                        (s.descripcion || '').toLowerCase().includes(busqueda) ||
                        String(s.monto).includes(busqueda)
                      )
                    : lista

                  const renderSueldo = (s: any, sugerido: boolean) => (
                    <div
                      key={s.id}
                      onClick={() => setSueldoElegido(sueldoElegido?.id === s.id ? null : s)}
                      className={`p-2.5 border rounded-lg cursor-pointer transition-colors ${
                        sueldoElegido?.id === s.id ? 'border-blue-500 bg-blue-50'
                        : sugerido ? 'border-green-200 hover:border-green-400 hover:bg-green-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{s.empleado?.nombre || 'Sin nombre'}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          s.tipo === 'anticipo' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {s.tipo === 'anticipo' ? 'Anticipo' : 'Pago Saldo'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                        <span>{new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                        <span className="font-mono">${parseFloat(s.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        <span className="text-gray-400">{s.descripcion}</span>
                        {sugerido && <span className="text-green-600 font-medium">Mismo monto</span>}
                      </div>
                    </div>
                  )

                  const sugFiltradas = filtrar(sugerencias)
                  const restoFiltradas = filtrar(resto)

                  if (sugFiltradas.length === 0 && restoFiltradas.length === 0) {
                    return <p className="text-sm text-gray-400 text-center py-4">No hay pagos de sueldos pendientes{busqueda ? ' para esta búsqueda' : ' (medio_pago=banco)'}</p>
                  }

                  return (
                    <>
                      {sugFiltradas.length > 0 && (
                        <>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-0.5">Sugerencias</p>
                          {sugFiltradas.map(s => renderSueldo(s, true))}
                          {restoFiltradas.length > 0 && (
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-0.5 pt-1">Otros pagos</p>
                          )}
                        </>
                      )}
                      {restoFiltradas.map(s => renderSueldo(s, false))}
                    </>
                  )
                })()}
              </div>
              {sueldoElegido && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                  Se vinculará pago <strong>{sueldoElegido.tipo === 'anticipo' ? 'Anticipo' : 'Pago Saldo'} {sueldoElegido.empleado?.nombre}</strong> y se marcará como conciliado. Categ = SUELD.
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Códigos contable/interno — opcionales, aplican a cualquier asignación */}
          <div className="border-t pt-3 mt-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Contable / Interno <span className="normal-case font-normal">(opcional — sobreescribe reglas automáticas)</span>
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-0.5 block">Contable</label>
                <Input
                  className="h-7 text-xs"
                  placeholder="Ej: AP i"
                  value={contableManual}
                  onChange={e => setContableManual(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-0.5 block">Interno</label>
                <Input
                  className="h-7 text-xs"
                  placeholder="Ej: DIST MA"
                  value={internoManual}
                  onChange={e => setInternoManual(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAsignar(false)}>Cancelar</Button>
            <Button
              onClick={ejecutarAsignacion}
              disabled={guardandoAsignacion || (tabAsignar === 'template' ? !templateElegido : tabAsignar === 'arca' ? !arcaElegida : !sueldoElegido)}
            >
              {guardandoAsignacion ? 'Guardando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}