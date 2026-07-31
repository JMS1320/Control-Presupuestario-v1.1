"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronDown, Loader2, TrendingDown, TrendingUp, Scale, Wallet } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  tonsCuota,
  tonsFijadas,
  estadoDerivado,
  resolverPrecioCuota,
  modoPrecioSegunFecha,
  montoVenta,
  puedeMoverCuota,
  fechaMinimaDisponible,
  ALICUOTA_IIBB_ARRENDAMIENTO,
  type PrecioGrano,
  type TipoCambio,
  type EstadoCuota,
} from "@/lib/arrendamientos/calculo"
import {
  calcularGanaderia,
  type PresupuestoGanaderia,
  type PrecioHacienda,
} from "@/lib/ganaderia/calculo"
import { ModalPresupuestarVenta, type DatosPresupuestar } from "@/components/modal-presupuestar-venta"
import {
  valuarLoteConPrecios, calcularLineaTiempo, fechaDestete, pesoDestete,
  type LoteStock, type VentaStock, type CicloStock,
} from "@/lib/ganaderia/ciclo"
import {
  disponiblePorDiferencia, existenciasDePesada, existenciasDeCiclos,
  type DisponibleCategoria,
} from "@/lib/ganaderia/disponibilidad"
import {
  curvaDeLote, tramosParaCosto, type TramoLote, type LoteCurva,
} from "@/lib/productivo/tramos"
import {
  consumoMensual, type Actividad, type InsumoActividad,
} from "@/lib/productivo/actividades"
import {
  calcularCuenta, sugerirModo, esProduccion, netearExcluidos,
  type ConfigCuenta, type PuntoHistorico, type PuntoProveedor, type CeldaPresupuesto,
} from "@/lib/presupuesto/modos"
import {
  proyectarTemplate, avisoFaltaGenerar,
  ETIQUETA_METODO,
  type TemplateInfo, type CuotaMes, type CeldaTemplate, type ConfigTemplate,
  type MetodoResuelto, type TipoCuenta,
} from "@/lib/presupuesto/templates"
import type { PuntoSerie } from "@/lib/precios/serie"

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

function fmt(n: number) {
  if (n === 0) return <span className="text-gray-300">—</span>
  return <span>${Math.round(n).toLocaleString("es-AR")}</span>
}

function getMeses(cantidad: number): { anio: number; mes: number; label: string }[] {
  const hoy = new Date()
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    return {
      anio: d.getFullYear(),
      mes: d.getMonth() + 1,
      label: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
    }
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FilaTemplate {
  id: string
  nombre: string                       // nombre_referencia
  agrupador: string                    // cuenta_agrupadora
  categ: string
  montos: Record<string, number>       // clave: "YYYY-MM"
  /** De dónde salió cada mes: cuota cargada o proyección. */
  celdas: Record<string, CeldaTemplate>
  /** Es de los que el usuario carga a mano (aplica_generacion). */
  cargaManual: boolean
  /** Con qué método se completaron los meses sin cuota, y si lo eligió el usuario. */
  metodo: MetodoResuelto
  /** Declara más cuotas de las que hay en la historia. */
  avisoCuotas: string | null
}

interface FilaSueldo {
  id: string
  nombre: string
  montos: Record<string, number>
}

interface Agrupador {
  nombre: string
  expandido: boolean
  templates: FilaTemplate[]
}

/**
 * INGRESOS — arrendamientos agrícolas. Tres filas por campo (centro de costo):
 *   fijado        → precio cerrado, con factura. Plata comprometida.
 *   presupuestado → tons sin fijar × Matba(posición) × TC. Proyección.
 *   disponible    → tons cuya fecha de cobro ya pasó sin fijar.
 * Ver DISEÑO_PRESUPUESTO.md § INGRESOS — Arrendamientos agrícolas.
 */
interface FilaCampo {
  campo: string
  empresa: string
  fijado: Record<string, number>
  presupuestado: Record<string, number>
  disponible: Record<string, number>
  /** Tons sin fijar por mes — para el badge del "disponible a fijar". */
  tonsDisponibles: Record<string, number>
  /** Meses cuyo precio o TC se arrastró de otro mes (celda estimada). */
  estimado: Record<string, boolean>
}

/** Cuota individual detrás de una celda — para poder moverla y valorizarla. */
interface CuotaDetalle {
  id: string
  campo: string
  campania: string
  numeroCuota: number
  tonsPend: number
  fechaCobro: string
  posicionAnio: number
  posicionMes: number
  /** ARS/ton ya resuelto (pizarra directa o Matba × TC). */
  pesosPorTon: number
  modo: "pizarra" | "matba"
  precioUsd: number | null
  precioManual: boolean
  precioArrastrado: boolean
  tc: number | null
  monto: number
  estado: EstadoCuota
  /** Días de cobro del disponible del contrato (Sanpa 15, resto 20). */
  diasCobro: number
  fechaOriginal: string | null
  posOrigAnio: number | null
  posOrigMes: number | null
}

/**
 * Con qué método se completaron los meses sin cuota. Sólo aparece si hubo que proyectar
 * algo: si el template tiene todas sus cuotas cargadas, no hay método que mostrar.
 */
function EtiquetaMetodo({ t }: { t: FilaTemplate }) {
  const hayProyeccion = Object.values(t.celdas).some(c => c.origen === "proyectado")
  if (!hayProyeccion || !t.metodo) return null
  return (
    <span className={`ml-2 text-[10px] ${t.metodo.manual ? "text-blue-600" : "text-gray-400"}`}
      title={`${ETIQUETA_METODO[t.metodo.metodo]} — ${t.metodo.motivo}`
        + (t.avisoCuotas ? `\n\n⚠ ${t.avisoCuotas}` : "")}>
      {ETIQUETA_METODO[t.metodo.metodo]}
      {!t.metodo.manual && " (auto)"}
      {t.avisoCuotas && <span className="ml-0.5 text-amber-500">⚠</span>}
    </span>
  )
}

/**
 * Celda de un template. Distingue la cuota CARGADA (dato firme) de la PROYECTADA, que es una
 * estimación del presupuesto y no está escrita en ningún lado.
 */
function CeldaTpl({ t, clave, esActual }: { t: FilaTemplate; clave: string; esActual: boolean }) {
  const celda = t.celdas[clave]
  const proyectado = celda?.origen === "proyectado"
  return (
    <td title={celda?.explicacion}
      className={`px-3 py-1.5 text-right text-xs ${
        proyectado ? "italic text-gray-400" : "text-gray-600"
      } ${esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
      {fmt(t.montos[clave] || 0)}
      {proyectado && celda.faltaGenerar && <span className="ml-0.5 text-amber-500">◦</span>}
    </td>
  )
}

/** Templates de un agrupador, juntados por su categoria y en orden alfabetico. */
function porCateg(templates: FilaTemplate[]): [string, FilaTemplate[]][] {
  const acc: Record<string, FilaTemplate[]> = {}
  for (const t of templates) (acc[t.categ || "(sin categoria)"] ??= []).push(t)
  return Object.entries(acc).sort((a, b) => a[0].localeCompare(b[0]))
}

/**
 * Conviene abrir un nivel de sub-agrupacion en este agrupador?
 *
 * Si cuando hay varias categorias Y alguna junta mas de un template: ahi el nivel extra
 * ordena de verdad (Impuestos Rurales = 11 inmobiliarios + 10 red vial).
 * No cuando hay una sola categoria, o cuando hay tantas como templates (Gastos Bancarios,
 * una categoria por template): seria anidado vacio, mas clics para ver lo mismo.
 */
function subAgrupa(ag: Agrupador): boolean {
  const categs = new Set(ag.templates.map(t => t.categ || "(sin categoria)")).size
  return categs >= 2 && categs < ag.templates.length
}

// -- Componente principal ------------------------------------------------------

export function TabPresupuesto() {
  const [cargando, setCargando] = useState(true)
  const [agrupadores, setAgrupadores] = useState<Agrupador[]>([])
  const [sueldoFilas, setSueldoFilas] = useState<FilaSueldo[]>([])
  const [campos, setCampos] = useState<FilaCampo[]>([])
  // Ganadería: una fila por proyección, con su IIBB derivado el mes siguiente al cobro
  const [ganaderia, setGanaderia] = useState<{
    nombre: string; montos: Record<string, number>; iibb: Record<string, number>; estimado: boolean
  }[]>([])
  /**
   * Hacienda: UNA FILA POR CATEGORÍA, y cada fila lleva las dos capas.
   *  · montos     → lote con fecha de venta → plata en el mes de cobro
   *  · disponible → cabezas que existen y NO tienen venta presupuestada, en el mes en
   *                 que se disponibilizan. Sin plata: cabezas y peso promedio, igual que
   *                 las toneladas de soja a fijar.
   * Se listan sólo las categorías que tienen algo (venta o disponible).
   */
  const [hacienda, setHacienda] = useState<{
    categorias: {
      categoria: string
      montos: Record<string, number>
      estimado: Record<string, boolean>
      disponible: Record<string, DisponibleCategoria>
    }[]
    iibb: Record<string, number>
  }>({ categorias: [], iibb: {} })
  /** Total por mes de la venta de hacienda — es la suma de las categorías. */
  const haciendaTotal = useMemo(() => {
    const t: Record<string, number> = {}
    for (const c of hacienda.categorias) {
      for (const [m, v] of Object.entries(c.montos)) t[m] = (t[m] || 0) + v
    }
    return t
  }, [hacienda])
  // Cuotas detrás de cada celda: clave `${campo}|${YYYY-MM}|${presupuestado|disponible}`
  const [detalleCeldas, setDetalleCeldas] = useState<Record<string, CuotaDetalle[]>>({})
  const [modalCuotas, setModalCuotas] = useState<{ titulo: string; cuotas: CuotaDetalle[] } | null>(null)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  /**
   * Saldo de arranque, a mano por ahora. Sin esto el presupuesto sólo dice el resultado
   * de cada mes, que no alcanza para saber si la caja da: un mes malo después de varios
   * buenos no es lo mismo que el mismo mes con la caja en cero.
   */
  const [saldoInicial, setSaldoInicial] = useState(0)
  const [mesInicial, setMesInicial] = useState<string | null>(null)
  const [editandoSaldo, setEditandoSaldo] = useState(false)
  const [saldoTxt, setSaldoTxt] = useState("")
  /** Presupuesto de cuentas contables — se configura en su panel, acá sólo se muestra y suma. */
  const [cuentas, setCuentas] = useState<{ nro: string; nombre: string; celdas: CeldaPresupuesto[] }[]>([])
  /** Costo de los tramos de actividad de cada lote, por mes. */
  const [costoProd, setCostoProd] = useState<{ nombre: string; montos: Record<string, number> }[]>([])
  const [ipcSerie, setIpcSerie] = useState<PuntoSerie[]>([])
  const [avisoGen, setAvisoGen] = useState<{ templates: number; meses: string[]; monto: number; nombres: string[] } | null>(null)
  /** Celda de hacienda disponible sobre la que se está presupuestando una venta. */
  const [presupuestando, setPresupuestando] = useState<DatosPresupuestar | null>(null)
  const [preciosHac, setPreciosHac] = useState<PrecioHacienda[]>([])

  // 24 meses: las cuotas de arrendamiento llegan hasta may-2028 (campaña 27/28)
  const meses = useMemo(() => getMeses(24), [])

  // ── Carga de datos ──────────────────────────────────────────────────────────

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    try {
      // `cargarGanaderia` (tabla presupuesto_ganaderia) quedó OBSOLETA: la reemplazan la
      // línea de tiempo del rodeo + los lotes, que es lo que lee `cargarHacienda`.
      // Se dejó de llamar porque mostraba un ingreso fantasma en abr-27 desde una fila
      // con los porcentajes corruptos (IVA 105%). La fila sigue en la BD sin usarse.
      // El IPC se carga primero: lo usan la proyección de templates y las cuentas contables.
      const ipc = await cargarIpc()
      await Promise.all([
        cargarTemplates(ipc), cargarSueldos(), cargarIngresos(), cargarHacienda(),
        cargarConfig(), cargarCuentas(ipc), cargarCostosProduccion(),
      ])
    } finally {
      setCargando(false)
    }
  }

  const cargarIpc = async (): Promise<PuntoSerie[]> => {
    const { data } = await supabase.from("indices_ipc").select("anio, mes, valor_ipc")
    const serie = ((data || []) as any[]).map(r => ({
      anio: Number(r.anio), mes: Number(r.mes), valor: Number(r.valor_ipc) || 0,
    }))
    setIpcSerie(serie)
    return serie
  }

  /**
   * Presupuesto de cuentas contables. El modo de cada cuenta se configura en su panel
   * (botón "Cuentas contables"); acá se lee la configuración y se muestra el resultado.
   */
  const cargarCuentas = async (ipc: PuntoSerie[]) => {
    const [{ data: hist }, { data: conf }, { data: prov }, { data: cfgGen }] = await Promise.all([
      supabase.from("presupuesto_historia_cuentas")
        .select("nro_cuenta, cuenta_contable, anio, mes, monto, facturas, proveedores"),
      supabase.from("presupuesto_cuenta_config").select("*").eq("empresa", "MSA"),
      supabase.from("presupuesto_historia_cuenta_proveedor").select("nro_cuenta, cuit, anio, mes, monto"),
      supabase.from("presupuesto_config").select("inflacion_mensual").eq("empresa", "MSA").maybeSingle(),
    ])
    const historia: PuntoHistorico[] = ((hist || []) as any[]).map(r => ({
      nro_cuenta: String(r.nro_cuenta), anio: Number(r.anio), mes: Number(r.mes),
      monto: Number(r.monto) || 0, facturas: Number(r.facturas) || 0,
      proveedores: Number(r.proveedores) || 0,
    }))
    const nombres: Record<string, string> = {}
    for (const r of ((hist || []) as any[])) {
      if (r.cuenta_contable) nombres[String(r.nro_cuenta)] = String(r.cuenta_contable)
    }
    const guardadas: Record<string, ConfigCuenta> = {}
    for (const c of ((conf || []) as any[])) {
      guardadas[String(c.nro_cuenta)] = {
        nro_cuenta: String(c.nro_cuenta), modo: c.modo,
        meses_promedio: c.meses_promedio,
        monto_manual: c.monto_manual == null ? null : Number(c.monto_manual),
        cabezas_referencia: c.cabezas_referencia == null ? null : Number(c.cabezas_referencia),
        cabezas_proyectadas: c.cabezas_proyectadas == null ? null : Number(c.cabezas_proyectadas),
        inflacion_mensual: c.inflacion_mensual == null ? null : Number(c.inflacion_mensual),
        cuits_excluidos: (c.cuits_excluidos as string[] | null) ?? [],
        motivo_exclusion: c.motivo_exclusion,
      }
    }
    const nros = Array.from(new Set(historia.map(h => h.nro_cuenta)))
    const cfgDe = (nro: string): ConfigCuenta => guardadas[nro] ?? {
      nro_cuenta: nro, modo: sugerirModo(nro, historia).modo, meses_promedio: 3,
      motivo_exclusion: esProduccion(nro),
    }
    const excluidos: Record<string, string[]> = {}
    for (const nro of nros) {
      const l = cfgDe(nro).cuits_excluidos ?? []
      if (l.length > 0) excluidos[nro] = l
    }
    const porProveedor: PuntoProveedor[] = ((prov || []) as any[]).map(r => ({
      nro_cuenta: String(r.nro_cuenta), cuit: String(r.cuit ?? ""),
      anio: Number(r.anio), mes: Number(r.mes), monto: Number(r.monto) || 0,
    }))
    const neta = netearExcluidos(historia, porProveedor, excluidos)

    const ctx = {
      meses: meses.map(m => ({ anio: m.anio, mes: m.mes })),
      inflacionMensual: Number(cfgGen?.inflacion_mensual) || 0,
      ipc: ipc.length > 0 ? ipc : undefined,
    }
    const filas = nros
      .map(nro => ({ nro, nombre: nombres[nro] || nro, celdas: calcularCuenta(cfgDe(nro), neta, ctx) }))
      .filter(f => f.celdas.some(c => c.monto > 0))
      .sort((a, b) => b.celdas.reduce((s, c) => s + c.monto, 0) - a.celdas.reduce((s, c) => s + c.monto, 0))
    setCuentas(filas)
  }

  /**
   * Costo de producción: sale de los tramos de actividad de cada lote. Es una línea DERIVADA
   * (decisión del usuario: los costos directos no se registran, se calculan) — por eso no hay
   * nada que leer más que la actividad y el tramo.
   */
  const cargarCostosProduccion = async () => {
    const [{ data: lotes }, { data: tra }, { data: acts }, { data: ins }, { data: tc }] = await Promise.all([
      supabase.schema("productivo").from("stock_lotes").select("*").eq("empresa", "MSA"),
      supabase.schema("productivo").from("lote_tramos").select("*").order("orden"),
      supabase.schema("productivo").from("actividades").select("*"),
      supabase.schema("productivo").from("actividad_insumos").select("*").order("orden"),
      supabase.from("tipos_cambio").select("anio, mes, tc_presupuestado"),
    ])
    const listaTramos = (tra || []) as TramoLote[]
    if (listaTramos.length === 0) { setCostoProd([]); return }
    const listaActs = (acts || []) as Actividad[]
    const listaIns = (ins || []) as InsumoActividad[]
    const tcs: PuntoSerie[] = ((tc || []) as any[]).map(r => ({
      anio: Number(r.anio), mes: Number(r.mes), valor: Number(r.tc_presupuestado) || 0,
    }))

    // Una fila por ACTIVIDAD, no por lote: en el presupuesto interesa "cuánto cuesta la
    // recría", no cuánto cuesta cada lote por separado.
    const porActividad: Record<string, Record<string, number>> = {}
    for (const l of ((lotes || []) as LoteStock[])) {
      const mios = listaTramos.filter(t => t.lote_id === l.id)
      if (mios.length === 0) continue
      for (const t of tramosParaCosto(l as unknown as LoteCurva, mios, listaActs, listaIns)) {
        const nombre = t.actividad.nombre
        for (const m of consumoMensual({ ...t, tiposCambio: tcs })) {
          ;(porActividad[nombre] ??= {})[m.mes] = (porActividad[nombre]?.[m.mes] || 0) + m.costo_total
        }
      }
    }
    setCostoProd(Object.entries(porActividad)
      .map(([nombre, montos]) => ({ nombre, montos }))
      .sort((a, b) => Object.values(b.montos).reduce((x, y) => x + y, 0)
        - Object.values(a.montos).reduce((x, y) => x + y, 0)))
  }

  const cargarConfig = async () => {
    const { data } = await supabase.from("presupuesto_config")
      .select("saldo_inicial, mes_inicial").eq("empresa", "MSA").maybeSingle()
    setSaldoInicial(Number(data?.saldo_inicial) || 0)
    setMesInicial(data?.mes_inicial ?? null)
  }

  const guardarSaldoInicial = async (monto: number, mes: string) => {
    const { error } = await supabase.from("presupuesto_config")
      .upsert({ empresa: "MSA", saldo_inicial: monto, mes_inicial: mes, updated_at: new Date().toISOString() },
        { onConflict: "empresa" })
    if (error) { alert("Error: " + error.message); return }
    setSaldoInicial(monto); setMesInicial(mes); setEditandoSaldo(false)
  }

  const cargarTemplates = async (ipc: PuntoSerie[]) => {
    // Traer templates activos MSA (responsable contiene MSA)
    const { data: templates } = await supabase
      .from("egresos_sin_factura")
      .select("id, nombre_referencia, categ, cuenta_agrupadora, responsable, periodicidad, aplica_generacion, cuotas, tipo_recurrencia")
      .eq("activo", true)
      .or("responsable.ilike.%MSA%,responsable.eq.ambas")
      .not("cuenta_agrupadora", "is", null)
      .order("cuenta_agrupadora")

    if (!templates || templates.length === 0) return

    const templateIds = templates.map(t => t.id)

    // Rango: primer día del primer mes → primer día del mes SIGUIENTE al último (exclusivo).
    // Ojo: no armar el tope con "-31" fijo — si el último mes no tiene 31 días
    // (p.ej. "2028-06-31") Postgres rechaza la fecha y la query falla ENTERA, con lo que
    // los templates desaparecen de la vista sin ningún aviso.
    const primerMes = meses[0]
    const ultimoMes = meses[meses.length - 1]
    // Se pide desde 18 meses ANTES del presupuesto: las cuotas pasadas son la base para
    // proyectar los meses donde la campaña todavía no se generó.
    const inicioHistoria = new Date(primerMes.anio, primerMes.mes - 1 - 18, 1)
    const fechaDesde = `${inicioHistoria.getFullYear()}-${String(inicioHistoria.getMonth()+1).padStart(2,"0")}-01`
    const finExclusivo = new Date(ultimoMes.anio, ultimoMes.mes, 1) // mes es 1-based → mes siguiente
    const fechaHasta = `${finExclusivo.getFullYear()}-${String(finExclusivo.getMonth()+1).padStart(2,"0")}-01`

    // Traer cuotas del período
    const { data: cuotas, error: errorCuotas } = await supabase
      .from("cuotas_egresos_sin_factura")
      .select("egreso_id, fecha_estimada, fecha_vencimiento, monto, estado")
      .in("egreso_id", templateIds)
      .gte("fecha_estimada", fechaDesde)
      .lt("fecha_estimada", fechaHasta)
      .neq("estado", "desactivado")

    if (errorCuotas) console.error("Error cargando cuotas de templates:", errorCuotas)

    // Toda la historia de cuotas por template: la pasada sirve para proyectar, la futura
    // es el dato firme que manda donde existe.
    const historiaCuotas: Record<string, CuotaMes[]> = {}
    for (const c of cuotas || []) {
      const fecha = c.fecha_estimada || c.fecha_vencimiento
      if (!fecha) continue
      ;(historiaCuotas[c.egreso_id] ??= []).push({
        egreso_id: c.egreso_id, mes: fecha.slice(0, 7), monto: Number(c.monto || 0),
      })
    }

    // Naturaleza contable de cada categoría: decide si el template es un GASTO o un
    // movimiento financiero (colocaciones, transferencias entre cuentas propias, tarjeta).
    const { data: ctas } = await supabase
      .from("cuentas_contables").select("categ, tipo").not("categ", "is", null)
    const tipoPorCateg: Record<string, TipoCuenta> = {}
    for (const c of ((ctas || []) as any[])) {
      if (c.tipo) tipoPorCateg[String(c.categ).trim().toUpperCase()] = c.tipo as TipoCuenta
    }

    // Métodos elegidos a mano. Sin fila, el método se hereda de `cuotas`.
    const { data: cfgs } = await supabase
      .from("presupuesto_template_config").select("template_id, metodo, monto_manual")
      .eq("empresa", "MSA")
    const cfgPorTemplate: Record<string, ConfigTemplate> = {}
    for (const c of ((cfgs || []) as any[])) {
      cfgPorTemplate[String(c.template_id)] = {
        metodo: c.metodo,
        monto_manual: c.monto_manual == null ? null : Number(c.monto_manual),
      }
    }

    const mesesCtx = meses.map(m => ({ anio: m.anio, mes: m.mes }))
    const proyeccion: Record<string, { info: TemplateInfo; celdas: CeldaTemplate[] }> = {}
    const mapaMontos: Record<string, Record<string, number>> = {}
    const mapaCeldas: Record<string, Record<string, CeldaTemplate>> = {}
    const metodos: Record<string, MetodoResuelto> = {}
    const avisos: Record<string, string | null> = {}

    for (const t of templates) {
      const info: TemplateInfo = {
        id: t.id, nombre: t.nombre_referencia,
        agrupador: t.cuenta_agrupadora ?? null,
        tipo_contable: tipoPorCateg[String(t.categ ?? "").trim().toUpperCase()] ?? null,
        cuotas: t.cuotas ?? null,
        tipo_recurrencia: t.tipo_recurrencia ?? null,
        periodicidad: t.periodicidad ?? null,
        aplica_generacion: t.aplica_generacion ?? null,
      }
      const r = proyectarTemplate(info, historiaCuotas[t.id] || [], mesesCtx,
        { ipc, config: cfgPorTemplate[t.id] })
      proyeccion[t.id] = { info, celdas: r.celdas }
      metodos[t.id] = r.metodo
      avisos[t.id] = r.avisoCuotas
      mapaMontos[t.id] = {}
      mapaCeldas[t.id] = {}
      for (const c of r.celdas) {
        mapaMontos[t.id]![c.mes] = c.monto
        mapaCeldas[t.id]![c.mes] = c
      }
    }

    const aviso = avisoFaltaGenerar(proyeccion)
    setAvisoGen(aviso.templates > 0 ? aviso : null)

    // Construir filas por agrupador
    const mapaAgrupadores: Record<string, FilaTemplate[]> = {}
    for (const t of templates) {
      const agrupador = t.cuenta_agrupadora || "Sin agrupador"
      if (!mapaAgrupadores[agrupador]) mapaAgrupadores[agrupador] = []
      mapaAgrupadores[agrupador].push({
        id: t.id,
        nombre: t.nombre_referencia,
        agrupador,
        categ: t.categ,
        montos: mapaMontos[t.id] || {},
        celdas: mapaCeldas[t.id] || {},
        cargaManual: t.aplica_generacion === true,
        metodo: metodos[t.id]!,
        avisoCuotas: avisos[t.id] ?? null,
      })
    }

    // Filtrar agrupadores que tienen al menos algún monto en el período
    const listaAgrupadores: Agrupador[] = Object.entries(mapaAgrupadores)
      .filter(([, filas]) => filas.some(f => Object.values(f.montos).some(m => m > 0)))
      .map(([nombre, filas]) => ({ nombre, expandido: false, templates: filas }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))

    setAgrupadores(listaAgrupadores)

    // Inicializar todos colapsados
    const initExpand: Record<string, boolean> = {}
    listaAgrupadores.forEach(a => { initExpand[a.nombre] = false })
    setExpandidos(initExpand)
  }

  // ── INGRESOS: arrendamientos agrícolas ──────────────────────────────────────
  const cargarIngresos = async () => {
    const { data: contratos } = await supabase
      .from("contratos_arrendamiento")
      .select("id, empresa, campania, centro_costo, has, qq_ha_total, grano, dias_cobro_disponible")
      .eq("empresa", "MSA")
      .eq("activo", true)

    if (!contratos || contratos.length === 0) { setCampos([]); return }

    const contratoIds = contratos.map(c => c.id)

    const [{ data: cuotas }, { data: precios }, { data: tcs }] = await Promise.all([
      supabase
        .from("cuotas_arrendamiento")
        .select("id, contrato_id, numero_cuota, qq_ha_cuota, fecha_cobro_estimada, posicion_anio, posicion_mes, estado, precio_usd_override, precio_pesos_override, fecha_cobro_original, posicion_orig_anio, posicion_orig_mes")
        .in("contrato_id", contratoIds),
      supabase.from("precios_granos").select("grano, anio, mes, precio_usd"),
      supabase.from("tipos_cambio").select("anio, mes, tc_presupuestado, tc_real"),
    ])

    const cuotaIds = (cuotas || []).map(c => c.id)
    const { data: fijaciones } = cuotaIds.length
      ? await supabase
          .from("ventas_arrendamiento")
          .select("cuota_id, tons, modo, precio_usd, tc, precio_pesos, monto_pesos, fecha_cobro")
          .in("cuota_id", cuotaIds)
      : { data: [] as any[] }

    const listaPrecios = (precios || []) as PrecioGrano[]
    const listaTC = (tcs || []) as TipoCambio[]

    // Fijaciones por cuota
    const fijPorCuota: Record<string, any[]> = {}
    for (const f of fijaciones || []) {
      if (!fijPorCuota[f.cuota_id]) fijPorCuota[f.cuota_id] = []
      fijPorCuota[f.cuota_id].push(f)
    }

    const nuevaFila = (campo: string, empresa: string): FilaCampo => ({
      campo, empresa,
      fijado: {}, presupuestado: {}, disponible: {}, tonsDisponibles: {}, estimado: {},
    })

    const mapaCampos: Record<string, FilaCampo> = {}
    const mapaDetalle: Record<string, CuotaDetalle[]> = {}
    const hoy = new Date()
    const claveMesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`

    for (const contrato of contratos) {
      const clave = contrato.centro_costo
      if (!mapaCampos[clave]) mapaCampos[clave] = nuevaFila(clave, contrato.empresa)
      const fila = mapaCampos[clave]

      for (const cuota of (cuotas || []).filter(q => q.contrato_id === contrato.id)) {
        const fijs = fijPorCuota[cuota.id] || []

        // 1) Vendido (fijado). Si el precio está fijado pero el TC todavía no, el monto
        //    en pesos se estima con el TC del mes de cobro y la celda queda marcada.
        for (const f of fijs) {
          const k = String(f.fecha_cobro ?? cuota.fecha_cobro_estimada).slice(0, 7)
          const m = montoVenta(f as any, listaTC)
          fila.fijado[k] = (fila.fijado[k] || 0) + m.monto
          if (m.estimado) fila.estimado[k] = true
        }

        // 2) Lo que queda sin fijar
        const tonsTot = tonsCuota(Number(contrato.has), Number(cuota.qq_ha_cuota))
        const tonsPend = tonsTot - tonsFijadas(fijs)
        if (tonsPend <= 0.001) continue

        // Precio ARS/ton: pizarra en pesos (mes actual) o Matba USD × TC (meses futuros)
        const p = resolverPrecioCuota(contrato as any, cuota as any, listaPrecios, listaTC)
        const monto = tonsPend * p.pesos_por_ton

        // El estado se DERIVA (fijaciones + fecha), no se lee de la columna: la columna
        // se desactualiza sola cuando pasa la fecha de cobro. Si no se fijó y ya venció,
        // las tons quedan DISPONIBLES y se muestran en el mes actual hasta que el usuario
        // les asigne fecha nueva (el selector propone el mes siguiente por default).
        const est = estadoDerivado(
          Number(contrato.has), Number(cuota.qq_ha_cuota), fijs, cuota.fecha_cobro_estimada, hoy,
        )
        const vencida = est === 'disponible'
        const k = vencida ? claveMesActual : String(cuota.fecha_cobro_estimada).slice(0, 7)

        if (vencida) {
          fila.disponible[k] = (fila.disponible[k] || 0) + monto
          fila.tonsDisponibles[k] = (fila.tonsDisponibles[k] || 0) + tonsPend
        } else {
          fila.presupuestado[k] = (fila.presupuestado[k] || 0) + monto
        }
        if (p.arrastrado) fila.estimado[k] = true

        // Detalle clickeable: qué cuotas hay detrás de esta celda
        const claveDetalle = `${clave}|${k}|${vencida ? "disponible" : "presupuestado"}`
        if (!mapaDetalle[claveDetalle]) mapaDetalle[claveDetalle] = []
        mapaDetalle[claveDetalle].push({
          id: cuota.id,
          campo: clave,
          campania: contrato.campania,
          numeroCuota: cuota.numero_cuota,
          tonsPend,
          fechaCobro: String(cuota.fecha_cobro_estimada),
          posicionAnio: cuota.posicion_anio,
          posicionMes: cuota.posicion_mes,
          pesosPorTon: p.pesos_por_ton,
          modo: p.modo,
          precioUsd: p.precio_usd,
          precioManual: p.manual,
          precioArrastrado: p.arrastrado,
          tc: p.tc,
          monto,
          estado: est,
          diasCobro: Number(contrato.dias_cobro_disponible ?? 20),
          fechaOriginal: cuota.fecha_cobro_original,
          posOrigAnio: cuota.posicion_orig_anio,
          posOrigMes: cuota.posicion_orig_mes,
        })
      }
    }

    setCampos(Object.values(mapaCampos).sort((a, b) => a.campo.localeCompare(b.campo)))
    setDetalleCeldas(mapaDetalle)
  }

  // ── Guardar cambios de una cuota (mover fecha / poner precio) ────────────────
  const guardarCuota = async (
    cuota: CuotaDetalle,
    nuevaFecha: string,
    nuevoPrecio: number | null,
  ): Promise<string | null> => {
    // Al mover, la posición pasa a ser el mes destino (regla R1 del diseño)
    const check = puedeMoverCuota(
      { estado: cuota.estado, fecha_cobro_estimada: cuota.fechaCobro },
      nuevaFecha, new Date(), cuota.diasCobro,
    )
    if (!check.permitido) return check.motivo ?? "No se puede mover"

    const [anio, mes] = nuevaFecha.split("-").map(Number)

    // El modo lo decide la fecha destino: mes actual = pizarra (ARS directo, sin TC),
    // meses siguientes = Matba (USD × TC). Los dos overrides son excluyentes.
    const modo = modoPrecioSegunFecha(nuevaFecha)

    const { error } = await supabase
      .from("cuotas_arrendamiento")
      .update({
        fecha_cobro_estimada: nuevaFecha,
        posicion_anio: anio,
        posicion_mes: mes,
        precio_pesos_override: modo === "pizarra" ? nuevoPrecio : null,
        precio_usd_override:   modo === "matba"   ? nuevoPrecio : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cuota.id)

    if (error) return error.message
    await cargarIngresos()
    return null
  }

  /** Vuelve la cuota a la fecha y posición originales del contrato y limpia el precio manual. */
  const volverADefault = async (cuota: CuotaDetalle): Promise<string | null> => {
    if (!cuota.fechaOriginal) return "Esta cuota no tiene fecha original guardada"
    const { error } = await supabase
      .from("cuotas_arrendamiento")
      .update({
        fecha_cobro_estimada: cuota.fechaOriginal,
        posicion_anio: cuota.posOrigAnio,
        posicion_mes: cuota.posOrigMes,
        precio_usd_override: null,
        precio_pesos_override: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cuota.id)
    if (error) return error.message
    await cargarIngresos()
    return null
  }

  // ── INGRESOS: ganadería (venta de destete) ──────────────────────────────────
  const cargarGanaderia = async () => {
    const [{ data: proyecciones }, { data: preciosHac }] = await Promise.all([
      supabase.from("presupuesto_ganaderia").select("*").eq("activo", true).eq("empresa", "MSA"),
      supabase.from("precios_hacienda").select("categoria, anio, mes, precio_pesos_kg"),
    ])
    if (!proyecciones || proyecciones.length === 0) { setGanaderia([]); return }

    const out = (proyecciones as PresupuestoGanaderia[]).map(p => {
      const r = calcularGanaderia(p, (preciosHac || []) as PrecioHacienda[])
      const mesCobro = String(p.fecha_cobro_estimada).slice(0, 7)
      return {
        nombre: p.descripcion || `Ganadería ${p.campania}`,
        // El total COBRADO incluye IVA: es lo que entra al banco
        montos: { [mesCobro]: r.total },
        // El IIBB es un EGRESO derivado, el mes siguiente al cobro
        iibb: { [r.mes_pago_iibb]: r.iibb },
        estimado: r.estimado,
      }
    })
    setGanaderia(out)
  }

  // ── INGRESOS: venta de hacienda (lotes de Productivo) ───────────────────────
  const cargarHacienda = async () => {
    const [{ data: lotes }, { data: precios }, { data: ciclos }, { data: tra }, { data: acts }, { data: pes }] = await Promise.all([
      supabase.schema("productivo").from("stock_lotes").select("*").eq("empresa", "MSA"),
      supabase.from("precios_hacienda").select("categoria, anio, mes, precio_pesos_kg, peso_desde, peso_hasta"),
      supabase.schema("productivo").from("stock_ciclos").select("*").eq("empresa", "MSA"),
      // Tramos y actividades: la curva de peso del lote es quebrada si cambia de actividad,
      // y el peso a la venta define la banda de precio -> tiene que ser la MISMA que en Productivo.
      supabase.schema("productivo").from("lote_tramos").select("*").order("orden"),
      supabase.schema("productivo").from("actividades").select("*"),
      // Pesada viva: es la fuente real de cuántas cabezas hay hoy. El lote es un recorte
      // de esto, no el total — por eso lo disponible se calcula por diferencia.
      supabase.schema("productivo").from("pesadas_terneros")
        .select("ternero_id, fecha, peso_kg, ternero:terneros!inner(sexo, es_torito)"),
    ])

    const listaLotes = ((lotes || []) as LoteStock[])
    const ids = listaLotes.map(l => l.id)
    const { data: vs } = ids.length
      ? await supabase.schema("productivo").from("stock_ventas").select("lote_id, cantidad").in("lote_id", ids)
      : { data: [] as any[] }

    const listaVentas = ((vs || []) as VentaStock[])
    const ventasDe = (id: string) => listaVentas.filter(v => v.lote_id === id)
    const listaPrecios = (precios || []) as PrecioHacienda[]
    setPreciosHac(listaPrecios)
    const listaTramos = (tra || []) as TramoLote[]
    const listaActs = (acts || []) as Actividad[]
    const curvaDe = (l: LoteStock) =>
      curvaDeLote(l as unknown as LoteCurva, listaTramos.filter(t => t.lote_id === l.id), listaActs)

    // ── Capa 1: ventas presupuestadas, agrupadas POR CATEGORÍA
    const porCat: Record<string, {
      montos: Record<string, number>
      estimado: Record<string, boolean>
      disponible: Record<string, DisponibleCategoria>
    }> = {}
    const fila = (cat: string) => (porCat[cat] ??= { montos: {}, estimado: {}, disponible: {} })
    const iibbPorMes: Record<string, number> = {}

    for (const l of listaLotes) {
      const v = valuarLoteConPrecios(l, ventasDe(l.id), listaPrecios, curvaDe(l))
      if (!v.proyectado || v.cuotas.length === 0) continue
      const f = fila(l.categoria)
      // El cobro puede venir en varias cuotas: cada una cae en su mes
      for (const q of v.cuotas) {
        f.montos[q.mes] = (f.montos[q.mes] || 0) + q.monto
        if (v.estimado) f.estimado[q.mes] = true
      }
      // El IIBB de la venta se paga el mes SIGUIENTE al cobro
      if (v.mes_iibb) iibbPorMes[v.mes_iibb] = (iibbPorMes[v.mes_iibb] || 0) + v.iibb
    }

    // ── Capa 2: lo que existe y no tiene venta, por diferencia contra la fuente
    const mesActual = new Date().toISOString().slice(0, 7)
    const primero = `${meses[0].anio}-${String(meses[0].mes).padStart(2, "0")}`
    const mesBase = mesActual < primero ? primero : mesActual

    // Última pesada de cada animal: es el stock de hoy
    const ultima: Record<string, any> = {}
    for (const r of ((pes || []) as any[])) {
      const prev = ultima[r.ternero_id]
      if (!prev || String(r.fecha) > String(prev.fecha)) ultima[r.ternero_id] = r
    }
    const filasPesada = Object.values(ultima)
      .filter((r: any) => r.ternero)
      .map((r: any) => ({
        peso_kg: r.peso_kg,
        sexo: String(r.ternero.sexo ?? ""),
        es_torito: Boolean(r.ternero.es_torito),
      }))

    // Destetes que todavía no ocurrieron: los pasados ya están en la pesada
    const linea = calcularLineaTiempo((ciclos || []) as CicloStock[])
    const existenciasCiclos = existenciasDeCiclos(
      linea.map(c => ({
        id: c.ciclo.id,
        campania: c.ciclo.campania,
        fecha_destete: fechaDestete(c.ciclo),
        terneros_venta: c.terneros_venta,
        terneras_venta: c.terneras_venta,
        peso_macho: pesoDestete(c.ciclo, "macho"),
        peso_hembra: pesoDestete(c.ciclo, "hembra"),
        descarte: c.descarte,
        peso_descarte: Number(c.ciclo.peso_descarte_kg ?? 0),
      })),
      mesBase,
    )

    const disponibles = disponiblePorDiferencia(
      [...existenciasDePesada(filasPesada, mesBase, "stock de hoy"), ...existenciasCiclos],
      listaLotes,
      listaVentas,
    )
    for (const d of disponibles) fila(d.categoria).disponible[d.mes] = d

    setHacienda({
      iibb: iibbPorMes,
      categorias: Object.entries(porCat)
        .map(([categoria, v]) => ({ categoria, ...v }))
        .filter(c => Object.keys(c.montos).length > 0 || Object.keys(c.disponible).length > 0)
        .sort((a, b) => a.categoria.localeCompare(b.categoria)),
    })
  }

  const cargarSueldos = async () => {
    const primerMes = meses[0]
    const ultimoMes = meses[meses.length - 1]

    const { data: periodos } = await supabase
      .from("sueldos_periodos")
      .select("id, anio, mes, saldo_pendiente, bruto_calculado, estado, empleado:sueldos_empleados(nombre, empresa)")
      .gte("anio", primerMes.anio)
      .lte("anio", ultimoMes.anio)
      .neq("estado", "historico")
      .order("anio").order("mes")

    if (!periodos) return

    // Agrupar por empleado
    const mapaEmpleados: Record<string, FilaSueldo> = {}
    for (const p of periodos) {
      const emp = p.empleado as any
      if (!emp) continue
      // Filtrar solo MSA o ambas
      const empresa: string = emp.empresa || ""
      if (!empresa.toLowerCase().includes("msa") && empresa.toLowerCase() !== "ambas") continue

      const nombre: string = emp.nombre
      const clave = `${p.anio}-${String(p.mes).padStart(2, "0")}`
      const monto = Number(p.saldo_pendiente ?? p.bruto_calculado ?? 0)

      if (!mapaEmpleados[nombre]) {
        mapaEmpleados[nombre] = { id: nombre, nombre, montos: {} }
      }
      mapaEmpleados[nombre].montos[clave] = monto
    }

    setSueldoFilas(Object.values(mapaEmpleados))
  }

  // ── Toggle agrupador ────────────────────────────────────────────────────────

  const toggleAgrupador = (nombre: string) => {
    setExpandidos(prev => ({ ...prev, [nombre]: !prev[nombre] }))
  }

  const toggleTodos = (expandir: boolean) => {
    const nuevo: Record<string, boolean> = {}
    agrupadores.forEach(a => { nuevo[a.nombre] = expandir })
    nuevo["__sueldos__"] = expandir
    setExpandidos(nuevo)
  }

  // ── Totales por mes ─────────────────────────────────────────────────────────

  const totalesPorMes = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      let suma = 0
      for (const ag of agrupadores) {
        for (const f of ag.templates) {
          suma += f.montos[clave] || 0
        }
      }
      for (const s of sueldoFilas) {
        suma += s.montos[clave] || 0
      }
      suma += ganaderia.reduce((acc, g) => acc + (g.iibb[clave] || 0), 0)
      suma += hacienda.iibb[clave] || 0
      // IIBB del arrendamiento: 5 % de la venta del mes anterior
      const ant = new Date(m.anio, m.mes - 2, 1)
      const claveAnt = `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2,"0")}`
      const ventaAnt = campos.reduce(
        (a, c) => a + (c.fijado[claveAnt] || 0) + (c.presupuestado[claveAnt] || 0) + (c.disponible[claveAnt] || 0), 0)
      suma += ventaAnt * ALICUOTA_IIBB_ARRENDAMIENTO
      // Cuentas contables (lo que llega por factura) y costos de producción (derivados de
      // las actividades). Los tres bloques no se pisan: verificado que templates y cuentas
      // no comparten conceptos, y las cuentas de producción salen `excluida`.
      for (const c of cuentas) suma += c.celdas.find(x => x.mes === clave)?.monto || 0
      for (const c of costoProd) suma += c.montos[clave] || 0
      totales[clave] = suma
    }
    return totales
  }, [agrupadores, sueldoFilas, ganaderia, hacienda, campos, cuentas, costoProd, meses])

  const totalCuentasPorMes = useMemo(() => {
    const t: Record<string, number> = {}
    for (const c of cuentas) for (const x of c.celdas) t[x.mes] = (t[x.mes] || 0) + x.monto
    return t
  }, [cuentas])

  const totalCostoProdPorMes = useMemo(() => {
    const t: Record<string, number> = {}
    for (const c of costoProd) {
      for (const [m, v] of Object.entries(c.montos)) t[m] = (t[m] || 0) + v
    }
    return t
  }, [costoProd])

  const totalSueldosPorMes = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      totales[clave] = sueldoFilas.reduce((s, f) => s + (f.montos[clave] || 0), 0)
    }
    return totales
  }, [sueldoFilas, meses])

  const totalIngresosPorMes = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      totales[clave] = campos.reduce(
        (s, c) => s + (c.fijado[clave] || 0) + (c.presupuestado[clave] || 0) + (c.disponible[clave] || 0),
        0,
      ) + ganaderia.reduce((s, g) => s + (g.montos[clave] || 0), 0)
        + (haciendaTotal[clave] || 0)
    }
    return totales
  }, [campos, ganaderia, hacienda, meses])

  // IIBB de ganadería: egreso derivado, se suma al total de egresos
  const totalIibbGanaderiaPorMes = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      totales[clave] = ganaderia.reduce((s, g) => s + (g.iibb[clave] || 0), 0)
    }
    return totales
  }, [ganaderia, meses])

  /**
   * IIBB del arrendamiento: 5 % de la venta, el mes SIGUIENTE al cobro. Es derivado igual
   * que el de hacienda — no se registra en ningún lado, sale de la venta.
   */
  const iibbArrendamientoPorMes = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      const venta = campos.reduce(
        (s, c) => s + (c.fijado[clave] || 0) + (c.presupuestado[clave] || 0) + (c.disponible[clave] || 0), 0)
      if (venta <= 0) continue
      const sig = new Date(m.anio, m.mes, 1)   // mes + 1
      const claveSig = `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2,"0")}`
      totales[claveSig] = (totales[claveSig] || 0) + venta * ALICUOTA_IIBB_ARRENDAMIENTO
    }
    return totales
  }, [campos, meses])

  /** Las tres fuentes de IIBB, para la fila colapsable. */
  const iibbFilas = useMemo(() => [
    { nombre: "IIBB venta hacienda", datos: hacienda.iibb },
    { nombre: "IIBB arrendamiento", datos: iibbArrendamientoPorMes },
    { nombre: "IIBB ganadería", datos: totalIibbGanaderiaPorMes },
  ].filter(f => Object.values(f.datos).some(v => v > 0)),
  [hacienda.iibb, iibbArrendamientoPorMes, totalIibbGanaderiaPorMes])

  const iibbTotalPorMes = useMemo(() => {
    const t: Record<string, number> = {}
    for (const f of iibbFilas) {
      for (const [k, v] of Object.entries(f.datos)) t[k] = (t[k] || 0) + v
    }
    return t
  }, [iibbFilas])

  /**
   * Saldo acumulado: arrastra el resultado mes a mes desde el saldo de arranque.
   * Los meses ANTERIORES a `mesInicial` quedan vacíos — no se puede acumular hacia atrás
   * desde un saldo que corresponde a otro momento.
   */
  const saldoAcumuladoPorMes = useMemo(() => {
    const primero = meses[0] ? `${meses[0].anio}-${String(meses[0].mes).padStart(2,"0")}` : ""
    const arranque = mesInicial || primero
    const salida: Record<string, number | null> = {}
    let acum = saldoInicial
    let empezo = false
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      if (!empezo && clave < arranque) { salida[clave] = null; continue }
      empezo = true
      acum += (totalIngresosPorMes[clave] || 0) - (totalesPorMes[clave] || 0)
      salida[clave] = acum
    }
    return salida
  }, [meses, saldoInicial, mesInicial, totalIngresosPorMes, totalesPorMes])

  const hayIngresos = campos.length > 0 || ganaderia.length > 0
    || hacienda.categorias.length > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
        <span className="text-gray-400">Cargando presupuesto...</span>
      </div>
    )
  }

  const mesActualClave = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Presupuesto MSA</h2>
          <p className="text-sm text-gray-500">
            Ingresos (arrendamientos y hacienda) + egresos (templates, sueldos, cuentas
            contables y costos de producción) · {meses[0].label} – {meses[meses.length-1].label}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toggleTodos(true)}>Expandir todo</Button>
          <Button variant="outline" size="sm" onClick={() => toggleTodos(false)}>Colapsar todo</Button>
        </div>
      </div>

      {/* Aviso: hay templates proyectados que el usuario suele cargar a mano.
          El aviso ES el punto: son los que le recuerdan un compromiso de pago
          (Cargas Sociales, SICORE, UATRE…) y sin campaña generada quedarían invisibles. */}
      {avisoGen && (
        <div className="rounded border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs">
          <p className="text-amber-900">
            <strong>Falta generar la campaña de {avisoGen.templates}{" "}
            {avisoGen.templates === 1 ? "template" : "templates"}.</strong>{" "}
            El presupuesto los estimó ({avisoGen.meses.length}{" "}
            {avisoGen.meses.length === 1 ? "mes" : "meses"}, ${Math.round(avisoGen.monto).toLocaleString("es-AR")}),
            pero como son compromisos de pago conviene cargarles las cuotas.
          </p>
          <p className="mt-0.5 text-[11px] text-amber-800">
            {avisoGen.nombres.slice(0, 8).join(" · ")}
            {avisoGen.nombres.length > 8 ? ` · y ${avisoGen.nombres.length - 8} más` : ""}
          </p>
        </div>
      )}

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-left font-semibold text-gray-700 min-w-[220px]">
                    Concepto
                  </th>
                  {meses.map(m => {
                    const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                    const esActual = clave === mesActualClave
                    return (
                      <th
                        key={clave}
                        className={`px-3 py-2 text-right font-medium text-xs whitespace-nowrap min-w-[90px] ${
                          esActual ? "bg-blue-50 text-blue-700 border-l-2 border-blue-300" : "text-gray-500"
                        }`}
                      >
                        {m.label}
                        {esActual && <div className="text-[10px] font-normal">← hoy</div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {/* ══ INGRESOS — Arrendamientos agrícolas ══ */}
                {hayIngresos && (
                  <>
                    <tr className="border-b-2 border-emerald-300 bg-emerald-50">
                      <td className="sticky left-0 z-10 bg-emerald-50 px-4 py-2 font-bold text-emerald-800 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        INGRESOS — Arrendamientos
                      </td>
                      {meses.map(m => {
                        const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                        const esActual = clave === mesActualClave
                        return (
                          <td
                            key={clave}
                            className={`px-3 py-2 text-right font-bold text-emerald-800 ${
                              esActual ? "bg-emerald-100 border-l-2 border-blue-300" : ""
                            }`}
                          >
                            {fmt(totalIngresosPorMes[clave] || 0)}
                          </td>
                        )
                      })}
                    </tr>

                    {campos.map(c => {
                      const claveCampo = `__campo_${c.campo}__`
                      const expandido = expandidos[claveCampo] ?? true

                      const totalCampo: Record<string, number> = {}
                      for (const m of meses) {
                        const k = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                        totalCampo[k] = (c.fijado[k] || 0) + (c.presupuestado[k] || 0) + (c.disponible[k] || 0)
                      }

                      // Las 3 filas del campo: fijado / presupuestado / disponible
                      const subFilas: { label: string; tipo: string | null; datos: Record<string, number>; clase: string }[] = [
                        { label: "Fijado",             tipo: null,             datos: c.fijado,        clase: "text-emerald-700 font-medium" },
                        { label: "Presupuestado",      tipo: "presupuestado",  datos: c.presupuestado, clase: "text-gray-600" },
                        { label: "Disponible a fijar", tipo: "disponible",     datos: c.disponible,    clase: "text-amber-700" },
                      ]

                      return (
                        <>
                          <tr
                            key={`campo-${c.campo}`}
                            className="border-b bg-emerald-50/40 cursor-pointer hover:bg-emerald-50 transition-colors"
                            onClick={() => toggleAgrupador(claveCampo)}
                          >
                            <td className="sticky left-0 z-10 bg-emerald-50/40 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                              {expandido
                                ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                              }
                              {c.campo}
                              <span className="ml-2 text-xs text-gray-400">{c.empresa}</span>
                            </td>
                            {meses.map(m => {
                              const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                              const esActual = clave === mesActualClave
                              return (
                                <td
                                  key={clave}
                                  className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                    esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                                  }`}
                                >
                                  {fmt(totalCampo[clave] || 0)}
                                </td>
                              )
                            })}
                          </tr>

                          {expandido && subFilas.map(sf => (
                            <tr key={`${c.campo}-${sf.label}`} className="border-b hover:bg-gray-50 transition-colors">
                              <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-xs text-gray-600">
                                {sf.label}
                              </td>
                              {meses.map(m => {
                                const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                                const esActual = clave === mesActualClave
                                const valor = sf.datos[clave] || 0
                                const tons = sf.label === "Disponible a fijar" ? c.tonsDisponibles[clave] : undefined
                                const estimado = valor > 0 && sf.label !== "Fijado" && c.estimado[clave]
                                const cuotasCelda = sf.tipo ? detalleCeldas[`${c.campo}|${clave}|${sf.tipo}`] : undefined
                                const clickeable = !!cuotasCelda?.length
                                return (
                                  <td
                                    key={clave}
                                    onClick={clickeable
                                      ? () => setModalCuotas({
                                          titulo: `${c.campo} — ${sf.label} — ${MESES[m.mes-1]} ${m.anio}`,
                                          cuotas: cuotasCelda!,
                                        })
                                      : undefined}
                                    title={
                                      clickeable
                                        ? `${tons ? `${tons.toLocaleString("es-AR", { maximumFractionDigits: 2 })} tn sin fijar · ` : ""}Click para mover la cuota o ponerle precio`
                                        : estimado
                                          ? "Precio o TC arrastrado de otro mes (estimado)"
                                          : undefined
                                    }
                                    className={`px-3 py-1.5 text-right text-xs ${sf.clase} ${
                                      esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                                    } ${clickeable ? "cursor-pointer hover:bg-amber-50 hover:underline" : ""}`}
                                  >
                                    {/* Sin precio cargado el monto da 0: mostrar las tn para que
                                        el disponible no quede invisible. */}
                                    {valor === 0 && tons
                                      ? <span className="text-amber-600">{tons.toLocaleString("es-AR", { maximumFractionDigits: 1 })} tn</span>
                                      : fmt(valor)}
                                    {estimado && <span className="ml-0.5 text-amber-500">*</span>}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </>
                      )
                    })}

                    {/* Hacienda — una fila por categoría. Cada fila lleva la plata de las
                        ventas presupuestadas y, en el mes en que se disponibilizan, las
                        cabezas que todavía no tienen venta (calculadas por diferencia
                        contra la pesada / el destete, no contra los lotes). */}
                    {hacienda.categorias.length > 0 && (
                      <tr className="border-b bg-emerald-100/60 cursor-pointer hover:bg-emerald-100 transition-colors"
                        onClick={() => toggleAgrupador("__hacienda__")}>
                        <td className="sticky left-0 z-10 bg-emerald-100/60 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                          {(expandidos["__hacienda__"] ?? true)
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          }
                          🐄 Venta de hacienda
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            {hacienda.categorias.length} {hacienda.categorias.length === 1 ? "categoría" : "categorías"}
                            {" · con IVA, neto de comercialización"}
                          </span>
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          return (
                            <td key={clave}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                              {fmt(haciendaTotal[clave] || 0)}
                            </td>
                          )
                        })}
                      </tr>
                    )}

                    {(expandidos["__hacienda__"] ?? true) && hacienda.categorias.map(c => (
                      <tr key={`hac-${c.categoria}`} className="border-b bg-emerald-50/30 hover:bg-emerald-50">
                        <td className="sticky left-0 z-10 bg-emerald-50/30 px-4 py-1.5 pl-8 text-xs text-gray-600">
                          {c.categoria}
                          {Object.keys(c.montos).length === 0 && (
                            <span className="ml-2 text-[10px] text-amber-600">sin venta presupuestada</span>
                          )}
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          const esActual = clave === mesActualClave
                          const valor = c.montos[clave] || 0
                          const disp = c.disponible[clave]
                          return (
                            <td key={clave}
                              className={`px-3 py-1.5 text-right text-xs ${
                                esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                              {valor > 0 ? (
                                <>
                                  {fmt(valor)}
                                  {c.estimado[clave] && <span className="ml-0.5 text-amber-500">*</span>}
                                </>
                              ) : disp ? (
                                /* Sin venta no hay plata: se informan cabezas y peso promedio,
                                   igual que las toneladas de soja disponibles a fijar.
                                   Se puede presupuestar la venta acá mismo, sin salir. */
                                <button type="button"
                                  className="text-amber-700 underline decoration-dotted hover:text-amber-900"
                                  title={`${Math.round(disp.existentes)} cab. existentes − ${Math.round(disp.comprometidas)} con venta presupuestada${disp.detalle ? ` · ${disp.detalle}` : ""}
Clic para presupuestar la venta`}
                                  onClick={() => setPresupuestando({
                                    clave: disp.clave, categoria: disp.categoria, mes: disp.mes,
                                    cabezas: disp.cabezas, pesoProm: disp.peso_prom,
                                  })}>
                                  <strong>{Math.round(disp.cabezas).toLocaleString("es-AR")}</strong> cab
                                  <span className="block text-[10px] text-amber-600">
                                    {disp.peso_prom.toLocaleString("es-AR", { maximumFractionDigits: 0 })} kg prom
                                  </span>
                                </button>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}

                    {/* Ganadería — venta de destete */}
                    {ganaderia.map(g => (
                      <tr key={`gan-${g.nombre}`} className="border-b bg-emerald-50/40 hover:bg-emerald-50">
                        <td className="sticky left-0 z-10 bg-emerald-50/40 px-4 py-2 font-semibold text-gray-700">
                          🐄 {g.nombre}
                          <span className="ml-2 text-xs font-normal text-gray-400">ganadería</span>
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          const esActual = clave === mesActualClave
                          const valor = g.montos[clave] || 0
                          return (
                            <td
                              key={clave}
                              title={valor > 0 ? "Total cobrado (neto + IVA)" : undefined}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                              }`}
                            >
                              {fmt(valor)}
                              {valor > 0 && g.estimado && <span className="ml-0.5 text-amber-500">*</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </>
                )}

                {/* ── Agrupadores / Templates ── */}
                {agrupadores.map(ag => {
                  const expandido = expandidos[ag.nombre] ?? false

                  // Total del agrupador por mes
                  const totalesAg: Record<string, number> = {}
                  for (const m of meses) {
                    const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                    totalesAg[clave] = ag.templates.reduce((s, f) => s + (f.montos[clave] || 0), 0)
                  }
                  const tieneAlgo = Object.values(totalesAg).some(v => v > 0)
                  if (!tieneAlgo) return null

                  return (
                    <>
                      {/* Fila agrupador */}
                      <tr
                        key={`ag-${ag.nombre}`}
                        className="border-b bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => toggleAgrupador(ag.nombre)}
                      >
                        <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                          {expandido
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          }
                          {ag.nombre}
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          const esActual = clave === mesActualClave
                          return (
                            <td
                              key={clave}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                              }`}
                            >
                              {fmt(totalesAg[clave] || 0)}
                            </td>
                          )
                        })}
                      </tr>

                      {/* Filas hijas: sub-agrupadas por categoria cuando eso ordena algo.
                          "Impuestos Rurales" mezcla 11 inmobiliarios con 10 de red vial y
                          leerlo es imposible; "Gastos Bancarios" tiene una categoria por
                          template y sub-agruparlo seria puro anidado vacio. Por eso solo se
                          sub-agrupa si hay 2+ categorias y alguna junta mas de un template.
                          Sale todo de datos que YA existen: no se creo ninguna categoria. */}
                      {expandido && (subAgrupa(ag)
                        ? porCateg(ag.templates).map(([categ, hijos]) => {
                          const claveSub = `${ag.nombre}||${categ}`
                          const subAbierto = expandidos[claveSub] ?? false
                          const totalesSub: Record<string, number> = {}
                          for (const m of meses) {
                            const k = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                            totalesSub[k] = hijos.reduce((x, f) => x + (f.montos[k] || 0), 0)
                          }
                          return (
                            <>
                              <tr key={`sub-${claveSub}`}
                                className="border-b bg-gray-50 cursor-pointer hover:bg-gray-100"
                                onClick={() => toggleAgrupador(claveSub)}>
                                <td className="sticky left-0 z-10 bg-gray-50 px-4 py-1.5 pl-8 text-xs font-medium text-gray-600 flex items-center gap-1">
                                  {subAbierto
                                    ? <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
                                    : <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
                                  }
                                  {categ}
                                  <span className="ml-1 text-gray-400">({hijos.length})</span>
                                </td>
                                {meses.map(m => {
                                  const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                                  return (
                                    <td key={clave}
                                      className={`px-3 py-1.5 text-right text-xs font-medium text-gray-600 ${
                                        clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                                      {fmt(totalesSub[clave] || 0)}
                                    </td>
                                  )
                                })}
                              </tr>
                              {subAbierto && hijos.map(t => (
                                <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                                  <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-14 text-gray-600 text-xs">
                                    {t.nombre}
                                    <EtiquetaMetodo t={t} />
                                  </td>
                                  {meses.map(m => {
                                    const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                                    return <CeldaTpl key={clave} t={t} clave={clave} esActual={clave === mesActualClave} />
                                  })}
                                </tr>
                              ))}
                            </>
                          )
                        })
                        : ag.templates.map(t => (
                          <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-gray-600 text-xs">
                              {t.nombre}
                              <span className="ml-2 text-gray-400">{t.categ}</span>
                              <EtiquetaMetodo t={t} />
                            </td>
                            {meses.map(m => {
                              const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                              return <CeldaTpl key={clave} t={t} clave={clave} esActual={clave === mesActualClave} />
                            })}
                          </tr>
                        ))
                      )}
                    </>
                  )
                })}

                {/* ── Sueldos ── */}
                {sueldoFilas.length > 0 && (() => {
                  const expandidoSueldos = expandidos["__sueldos__"] ?? false
                  return (
                    <>
                      <tr
                        className="border-b bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => toggleAgrupador("__sueldos__")}
                      >
                        <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                          {expandidoSueldos
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          }
                          Sueldos
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          const esActual = clave === mesActualClave
                          return (
                            <td
                              key={clave}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                              }`}
                            >
                              {fmt(totalSueldosPorMes[clave] || 0)}
                            </td>
                          )
                        })}
                      </tr>
                      {expandidoSueldos && sueldoFilas.map(s => (
                        <tr key={s.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-gray-600 text-xs">
                            {s.nombre}
                          </td>
                          {meses.map(m => {
                            const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                            const esActual = clave === mesActualClave
                            return (
                              <td
                                key={clave}
                                className={`px-3 py-1.5 text-right text-xs text-gray-600 ${
                                  esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                                }`}
                              >
                                {fmt(s.montos[clave] || 0)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  )
                })()}

                {/* ── Cuentas contables (lo que llega por factura) ──
                    El modo de cada cuenta se configura en el panel "Cuentas contables"; acá
                    se muestra el resultado y suma al total. */}
                {cuentas.length > 0 && (() => {
                  const abierto = expandidos["__cuentas__"] ?? false
                  return (
                    <>
                      <tr className="border-b bg-sky-50 cursor-pointer hover:bg-sky-100 transition-colors"
                        onClick={() => toggleAgrupador("__cuentas__")}>
                        <td className="sticky left-0 z-10 bg-sky-50 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                          {abierto
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />}
                          📒 Cuentas contables
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            {cuentas.length} cuentas · lo que llega por factura
                          </span>
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          return (
                            <td key={clave}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                              {fmt(totalCuentasPorMes[clave] || 0)}
                            </td>
                          )
                        })}
                      </tr>
                      {abierto && cuentas.map(c => (
                        <tr key={`cta-${c.nro}`} className="border-b hover:bg-gray-50">
                          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-xs text-gray-600">
                            {c.nombre}
                          </td>
                          {meses.map(m => {
                            const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                            const celda = c.celdas.find(x => x.mes === clave)
                            return (
                              <td key={clave} title={celda?.explicacion}
                                className={`px-3 py-1.5 text-right text-xs text-gray-600 ${
                                  clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                                {fmt(celda?.monto || 0)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  )
                })()}

                {/* ── Costos de producción (derivados de las actividades del lote) ── */}
                {costoProd.length > 0 && (() => {
                  const abierto = expandidos["__costoprod__"] ?? false
                  return (
                    <>
                      <tr className="border-b bg-violet-50 cursor-pointer hover:bg-violet-100 transition-colors"
                        onClick={() => toggleAgrupador("__costoprod__")}>
                        <td className="sticky left-0 z-10 bg-violet-50 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                          {abierto
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />}
                          🌾 Costos de producción
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            derivado de las actividades — no se registra, se calcula
                          </span>
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          return (
                            <td key={clave}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                              {fmt(totalCostoProdPorMes[clave] || 0)}
                            </td>
                          )
                        })}
                      </tr>
                      {abierto && costoProd.map(c => (
                        <tr key={`cp-${c.nombre}`} className="border-b hover:bg-gray-50">
                          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-xs text-gray-600">
                            {c.nombre}
                          </td>
                          {meses.map(m => {
                            const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                            return (
                              <td key={clave}
                                className={`px-3 py-1.5 text-right text-xs text-gray-600 ${
                                  clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                                {fmt(c.montos[clave] || 0)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  )
                })()}

                {/* ── IIBB: un solo renglón que se abre en sus fuentes ──
                    Todos son derivados (5 % arrendamiento, 1 % ganadería): no se registran
                    en ningún template, salen de la venta. */}
                {iibbFilas.length > 0 && (() => {
                  const abierto = expandidos["__iibb__"] ?? false
                  return (
                    <>
                      <tr className="border-b bg-amber-50/40 cursor-pointer hover:bg-amber-50 transition-colors"
                        onClick={() => toggleAgrupador("__iibb__")}>
                        <td className="sticky left-0 z-10 bg-amber-50/40 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                          {abierto
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          }
                          IIBB total
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            {iibbFilas.length} {iibbFilas.length === 1 ? "origen" : "orígenes"} · mes siguiente al cobro
                          </span>
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          return (
                            <td key={clave}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                              {fmt(iibbTotalPorMes[clave] || 0)}
                            </td>
                          )
                        })}
                      </tr>

                      {abierto && iibbFilas.map(f => (
                        <tr key={`iibb-${f.nombre}`} className="border-b hover:bg-gray-50">
                          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-xs text-gray-600">
                            {f.nombre}
                          </td>
                          {meses.map(m => {
                            const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                            return (
                              <td key={clave}
                                className={`px-3 py-1.5 text-right text-xs text-gray-600 ${
                                  clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                                {fmt(f.datos[clave] || 0)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  )
                })()}

                {/* ── Total general ── */}
                <tr className="border-t-2 border-gray-400 bg-gray-800">
                  <td className="sticky left-0 z-10 bg-gray-800 px-4 py-3 font-bold text-white flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    TOTAL EGRESOS MSA
                  </td>
                  {meses.map(m => {
                    const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                    const esActual = clave === mesActualClave
                    return (
                      <td
                        key={clave}
                        className={`px-3 py-3 text-right font-bold text-white text-sm ${
                          esActual ? "bg-blue-900 border-l-2 border-blue-400" : ""
                        }`}
                      >
                        ${Math.round(totalesPorMes[clave] || 0).toLocaleString("es-AR")}
                      </td>
                    )
                  })}
                </tr>

                {/* ── RESULTADO (Ingresos − Egresos) ── */}
                {hayIngresos && (
                  <tr className="border-t-2 border-gray-400 bg-slate-700">
                    <td className="sticky left-0 z-10 bg-slate-700 px-4 py-3 font-bold text-white flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      RESULTADO
                    </td>
                    {meses.map(m => {
                      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                      const esActual = clave === mesActualClave
                      const resultado = (totalIngresosPorMes[clave] || 0) - (totalesPorMes[clave] || 0)
                      return (
                        <td
                          key={clave}
                          className={`px-3 py-3 text-right font-bold text-sm ${
                            resultado < 0 ? "text-red-300" : "text-emerald-300"
                          } ${esActual ? "bg-slate-900 border-l-2 border-blue-400" : ""}`}
                        >
                          ${Math.round(resultado).toLocaleString("es-AR")}
                        </td>
                      )
                    })}
                  </tr>
                )}

                {/* ── SALDO ACUMULADO ──
                    El resultado mes a mes no dice si la caja alcanza: un mes malo después
                    de varios buenos no es lo mismo que ese mes con la caja en cero. */}
                {hayIngresos && (
                  <tr className="border-t-2 border-gray-400 bg-slate-900">
                    <td className="sticky left-0 z-10 bg-slate-900 px-4 py-3 font-bold text-white">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        SALDO ACUMULADO
                      </div>
                      {editandoSaldo ? (
                        <div className="mt-1 flex items-center gap-1">
                          <Input className="h-6 w-32 text-right text-xs text-gray-800"
                            value={saldoTxt} placeholder="0,00"
                            onChange={e => setSaldoTxt(e.target.value)} />
                          <Button size="sm" className="h-6 text-[10px]"
                            onClick={() => guardarSaldoInicial(
                              parseNumeroAR(saldoTxt),
                              mesInicial || (meses[0] ? `${meses[0].anio}-${String(meses[0].mes).padStart(2,"0")}` : ""),
                            )}>OK</Button>
                          <button type="button" className="text-[10px] text-gray-400 underline"
                            onClick={() => setEditandoSaldo(false)}>cancelar</button>
                        </div>
                      ) : (
                        <button type="button"
                          className="mt-0.5 block text-[10px] font-normal text-gray-400 underline hover:text-gray-200"
                          onClick={() => { setSaldoTxt(fmtNumeroAR(saldoInicial)); setEditandoSaldo(true) }}>
                          arranca en ${Math.round(saldoInicial).toLocaleString("es-AR")}
                          {mesInicial ? ` (${mesInicial})` : ""} — editar
                        </button>
                      )}
                    </td>
                    {meses.map(m => {
                      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                      const esActual = clave === mesActualClave
                      const saldo = saldoAcumuladoPorMes[clave]
                      return (
                        <td key={clave}
                          className={`px-3 py-3 text-right font-bold text-sm ${
                            saldo == null ? "text-gray-600"
                              : saldo < 0 ? "text-red-300" : "text-emerald-300"
                          } ${esActual ? "border-l-2 border-blue-400" : ""}`}
                          title={saldo == null ? "El saldo de arranque corresponde a un mes posterior" : undefined}>
                          {saldo == null ? "—" : `$${Math.round(saldo).toLocaleString("es-AR")}`}
                        </td>
                      )
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2 text-[11px] text-gray-500">
            <span className="italic text-gray-400">En cursiva</span>: mes sin cuota cargada, el
            presupuesto lo proyectó (respetando en qué meses paga cada template).
            {" "}<span className="text-amber-500">◦</span> además es un template que se suele
            cargar a mano. Las <span className="text-amber-700 underline decoration-dotted">cabezas
            disponibles</span> se pueden presupuestar con un clic. Pasá el mouse por cualquier
            celda para ver de dónde salió.
          </div>
        </CardContent>
      </Card>

      {/* Presupuestar una venta de hacienda desde la celda de disponible */}
      <ModalPresupuestarVenta
        datos={presupuestando}
        precios={preciosHac}
        onCerrar={() => setPresupuestando(null)}
        onGuardado={cargarHacienda}
      />

      {/* Modal: mover cuota / ponerle precio */}
      <ModalCuotas
        datos={modalCuotas}
        onCerrar={() => setModalCuotas(null)}
        onGuardar={guardarCuota}
        onDefault={volverADefault}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-blue-100 border border-blue-300 rounded-sm"></span>
          Mes actual
        </span>
        <span className="flex items-center gap-1">
          <span className="text-amber-500">*</span>
          Precio o TC arrastrado de otro mes
        </span>
        <span>· Montos en pesos · Solo MSA</span>
        <Badge variant="outline" className="text-xs">Ingresos: arrendamientos · Egresos: templates + sueldos</Badge>
      </div>
    </div>
  )
}

// ── Modal: mover una cuota y/o ponerle precio ─────────────────────────────────
// Escribe sobre `cuotas_arrendamiento` (Ventas es la fuente): Presupuesto es sólo
// la interfaz. Reglas de movimiento en lib/arrendamientos/calculo.ts.

interface ModalCuotasProps {
  datos: { titulo: string; cuotas: CuotaDetalle[] } | null
  onCerrar: () => void
  onGuardar: (cuota: CuotaDetalle, nuevaFecha: string, nuevoPrecio: number | null) => Promise<string | null>
  onDefault: (cuota: CuotaDetalle) => Promise<string | null>
}

function ModalCuotas({ datos, onCerrar, onGuardar, onDefault }: ModalCuotasProps) {
  const [edits, setEdits] = useState<Record<string, { fecha: string; precio: string }>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!datos) { setEdits({}); setError(null); return }
    const init: Record<string, { fecha: string; precio: string }> = {}
    for (const c of datos.cuotas) {
      // El input arranca con el valor del modo que corresponde a la fecha actual de la cuota
      const valor = c.modo === "pizarra" ? c.pesosPorTon : c.precioUsd
      init[c.id] = {
        fecha: c.fechaCobro,
        precio: valor ? valor.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
      }
    }
    setEdits(init)
  }, [datos])

  if (!datos) return null


  const guardar = async (c: CuotaDetalle) => {
    const e = edits[c.id]
    if (!e) return
    setGuardando(c.id); setError(null)
    const precio = e.precio.trim() === ""
      ? null
      : parseFloat(e.precio.replace(/\./g, "").replace(",", ".")) || 0
    const err = await onGuardar(c, e.fecha, precio)
    setGuardando(null)
    if (err) setError(err); else onCerrar()
  }

  const restaurar = async (c: CuotaDetalle) => {
    setGuardando(c.id); setError(null)
    const err = await onDefault(c)
    setGuardando(null)
    if (err) setError(err); else onCerrar()
  }

  return (
    <Dialog open={!!datos} onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{datos.titulo}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          {datos.cuotas.map(c => {
            const e = edits[c.id] ?? { fecha: c.fechaCobro, precio: "" }
            const esDisponible = c.estado === "disponible" || c.estado === "parcial"
            // El modo lo manda la fecha ELEGIDA en el input, no la guardada:
            // mes actual → pizarra en pesos · mes posterior → Matba en USD.
            const modoEdit = modoPrecioSegunFecha(e.fecha)
            const minimaDisponible = fechaMinimaDisponible(new Date(), c.diasCobro)
            return (
              <div key={c.id} className="rounded border p-3 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    Campaña {c.campania} · cuota {c.numeroCuota}
                  </span>
                  <Badge variant="outline" className="text-xs">{c.estado}</Badge>
                </div>

                <div className="text-xs text-gray-500">
                  {c.tonsPend.toLocaleString("es-AR", { maximumFractionDigits: 2 })} tn sin fijar ·
                  {modoEdit === "pizarra"
                    ? " pizarra Rosario (ARS, sin TC)"
                    : ` Matba × TC ${c.tc ? c.tc.toLocaleString("es-AR") : "— sin cargar"}`} ·
                  {c.precioManual ? " precio manual" : c.precioArrastrado ? " precio arrastrado de otra posición" : " precio de la posición"}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Fecha de cobro</label>
                    <Input
                      type="date"
                      className="h-8"
                      value={e.fecha}
                      min={esDisponible ? minimaDisponible : c.fechaCobro}
                      onChange={ev => {
                        const nueva = ev.target.value
                        // Si el cambio de fecha cambia la unidad (USD ↔ pesos), limpiar el
                        // precio: dejarlo sería guardar 343 pesos donde había 343 dólares.
                        const cambiaModo = nueva && modoPrecioSegunFecha(nueva) !== modoEdit
                        setEdits(p => ({ ...p, [c.id]: { fecha: nueva, precio: cambiaModo ? "" : e.precio } }))
                      }}
                    />
                    <p className="mt-1 text-[10px] text-gray-400">
                      {esDisponible
                        ? `Lo antes posible: ${new Date(minimaDisponible + "T00:00:00").toLocaleDateString("es-AR")} (hoy + ${c.diasCobro} días)`
                        : "Una cuota presupuestada sólo se mueve hacia adelante"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">
                      {modoEdit === "pizarra" ? "Precio $/ton (pizarra)" : "Precio USD/ton (Matba)"}
                    </label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      className={`h-8 text-right ${modoEdit === "pizarra" ? "border-amber-400 bg-amber-50" : ""}`}
                      value={e.precio}
                      onChange={ev => setEdits(p => ({ ...p, [c.id]: { ...e, precio: ev.target.value } }))}
                    />
                    <p className="mt-1 text-[10px] text-gray-400">
                      {modoEdit === "pizarra"
                        ? "Se cobra este mes → disponible: pesos directos, sin TC"
                        : `Vacío = usa el Matba de la posición ${MESES[Number(e.fecha.split("-")[1]) - 1]} ${e.fecha.split("-")[0]}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="text-xs"
                    disabled={guardando === c.id || !c.fechaOriginal}
                    onClick={() => restaurar(c)}>
                    Volver a default
                  </Button>
                  <Button size="sm" disabled={guardando === c.id} onClick={() => guardar(c)}>
                    {guardando === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                  </Button>
                </div>
              </div>
            )
          })}

          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <p className="text-[11px] text-gray-400">
            Al mover la cuota, la posición pasa a ser el mes destino. Los cambios se guardan en
            Ventas — Presupuesto es sólo la interfaz.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
