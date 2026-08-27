"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
import { supabase } from "@/lib/supabase"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronDown, Loader2, TrendingDown, TrendingUp, Scale, Wallet, AlertTriangle, Download, FileText, RefreshCw } from "lucide-react"
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
  calcularVariable, repartirEnMeses, avisoCupoAnual, AVISO_CUPO_ANUAL_SIN_VALIDAR,
  type Variable, type Ajuste, type ContextoVariable,
} from "@/lib/presupuesto/variables"
import {
  proyectarEmpleado, proyectarSuss,
  type EmpleadoPresupuesto, type ParametrosSueldos,
} from "@/lib/presupuesto/sueldos"
import {
  exportarExcel, exportarPDF,
  type DatosExport, type BloqueExport, type FilaExport,
} from "@/lib/presupuesto/export"
import {
  proyectarTemplate, avisoFaltaGenerar,
  ETIQUETA_METODO,
  type TemplateInfo, type CuotaMes, type CeldaTemplate, type ConfigTemplate,
  type MetodoResuelto, type TipoCuenta,
  tipoEfectivo,
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
  /** Naturaleza ya resuelta (template → plan → default). Decide en qué sección cae. */
  tipo: TipoCuenta
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
  /** Sección en la que cae. Una misma agrupadora puede aparecer en dos si mezcla tipos. */
  tipo: TipoCuenta
  /** `tipo||nombre` — identifica la fila, porque el nombre solo puede repetirse entre secciones. */
  clave: string
  expandido: boolean
  templates: FilaTemplate[]
}

/**
 * Las secciones de la grilla, en el mismo orden y con los mismos colores que el dashboard
 * (`tabla-resumen-financiero.tsx`). Que las dos pantallas se lean igual no es cosmético: el
 * presupuesto se compara contra el dashboard mes a mes.
 *
 * `financiero` e `ingreso` no aparecen: no se proyectan como salida (`noEsGasto`), así que sus
 * agrupadoras quedan en cero y se filtran solas. Están igual por si eso cambia.
 */
const SECCIONES_EGRESO: Array<{ tipo: TipoCuenta; titulo: string; fondo: string; texto: string; subtotal: string }> = [
  { tipo: "egreso",       titulo: "EGRESOS",       fondo: "bg-red-50",    texto: "text-red-800",    subtotal: "bg-red-100" },
  { tipo: "distribucion", titulo: "DISTRIBUCIONES", fondo: "bg-purple-50", texto: "text-purple-800", subtotal: "bg-purple-100" },
  { tipo: "financiero",   titulo: "FINANCIEROS",   fondo: "bg-yellow-50", texto: "text-yellow-800", subtotal: "bg-yellow-100" },
]

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

/**
 * `recargarToken` — cualquier cambio de este número vuelve a leer todo.
 *
 * El panel de Cuentas contables es un componente HERMANO (los monta `dashboard.tsx` uno al lado
 * del otro), así que no tenía forma de avisar acá cuando el usuario cambiaba el modo o el monto
 * de una cuenta: había que salir de la pestaña y volver a entrar. El token es el aviso.
 */
export function TabPresupuesto({ recargarToken = 0 }: { recargarToken?: number } = {}) {
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
  const [arranqueModo, setArranqueModo] = useState<"manual" | "ultimo_conciliado">("manual")
  /** Fecha del movimiento del que salió el saldo, cuando el modo es `ultimo_conciliado`. */
  const [arranqueFecha, setArranqueFecha] = useState<string | null>(null)
  const [mesInicial, setMesInicial] = useState<string | null>(null)
  const [editandoSaldo, setEditandoSaldo] = useState(false)
  const [saldoTxt, setSaldoTxt] = useState("")
  /** Presupuesto de cuentas contables — se configura en su panel, acá sólo se muestra y suma. */
  const [cuentas, setCuentas] = useState<{ nro: string; nombre: string; celdas: CeldaPresupuesto[] }[]>([])
  /** Variables de costo (P-37) — cantidad × precio × ajustes, repartido en los meses. */
  const [variables, setVariables] = useState<
    { id: string; concepto: string; nroCuenta: string | null; montos: Record<string, number>;
      faltantes: string[]; pendienteAProposito: boolean; aviso: string | null; ejecutado: number;
      esCupoAnual: boolean }[]>([])
  /** Inversiones (P-36) — bloque propio: no son gasto operativo. */
  const [inversiones, setInversiones] = useState<
    { id: string; nombre: string; montos: Record<string, number>; sinJustificar: boolean }[]>([])
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
  }, [recargarToken])

  const cargarDatos = async () => {
    setCargando(true)
    try {
      // `cargarGanaderia` (tabla presupuesto_ganaderia) quedó OBSOLETA: la reemplazan la
      // línea de tiempo del rodeo + los lotes, que es lo que lee `cargarHacienda`.
      // Se dejó de llamar porque mostraba un ingreso fantasma en abr-27 desde una fila
      // con los porcentajes corruptos (IVA 105%). La fila sigue en la BD sin usarse.
      // El IPC se carga primero: lo usan la proyección de templates y las cuentas contables.
      const ipc = await cargarIpc()
      // Las variables se leen ANTES que las cuentas: `cargarCuentas` necesita saber cuáles
      // tienen variable para no proyectarlas también por historia (regla A de P-37).
      const conVariable = await cargarVariables(ipc)
      await Promise.all([
        cargarTemplates(ipc), cargarSueldos(), cargarIngresos(), cargarHacienda(),
        cargarConfig(), cargarCuentas(ipc, conVariable), cargarCostosProduccion(),
        cargarInversiones(),
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
  /**
   * Variables de costo (P-37). Devuelve el set de cuentas que quedan cubiertas por una
   * variable: ésas NO se proyectan además por historia, o se contarían dos veces.
   */
  const cargarVariables = async (ipc: PuntoSerie[]): Promise<Set<string>> => {
    const [{ data: vs }, { data: ajs }, { data: hist }] = await Promise.all([
      supabase.from("presupuesto_variables").select("*")
        .eq("empresa", "MSA").eq("escenario", "base").eq("activo", true),
      supabase.from("presupuesto_variable_ajustes").select("*").order("orden"),
      supabase.from("presupuesto_historia_cuentas").select("nro_cuenta, anio, mes, monto"),
    ])

    // Lo EJECUTADO de cada cuenta en la campaña en curso (1/7 → 30/6). Es lo que permite que el
    // cupo anual se cierre contra la realidad y no contra el calendario: si ya se compró el
    // gasoil, deja de figurar aunque el mes elegido esté por venir.
    const hoy = new Date()
    const anioCampana = hoy.getMonth() + 1 >= 7 ? hoy.getFullYear() : hoy.getFullYear() - 1
    const desde = anioCampana * 12 + 6          // julio del año de la campaña
    const ejecutadoPorCuenta: Record<string, number> = {}
    for (const h of ((hist || []) as any[])) {
      const km = Number(h.anio) * 12 + (Number(h.mes) - 1)
      if (km < desde) continue
      const nro = String(h.nro_cuenta)
      ejecutadoPorCuenta[nro] = (ejecutadoPorCuenta[nro] || 0) + (Number(h.monto) || 0)
    }
    const porVar: Record<string, Ajuste[]> = {}
    for (const a of ((ajs || []) as any[])) {
      (porVar[a.variable_id] ||= []).push({
        orden: a.orden, tipo: a.tipo, valor: a.valor == null ? null : Number(a.valor),
        referencia: a.referencia, nota: a.nota,
      })
    }
    // Mismo criterio de IPC que el panel de cuentas: acumulado de los últimos 12 cargados.
    const serie = [...ipc].sort((x, y) => (x.anio * 12 + x.mes) - (y.anio * 12 + y.mes)).slice(-12)
    const factor = serie.reduce((f, p) => f * (1 + (Number(p.valor) || 0) / 100), 1)
    const ctxVar: ContextoVariable = { ipcAcumulado: serie.length > 0 ? factor - 1 : null }

    const mm = meses.map(m => ({ anio: m.anio, mes: m.mes }))
    const filas = ((vs || []) as any[]).map(v => {
      const r = calcularVariable(v as Variable, porVar[v.id] ?? [], ctxVar)
      const nro = v.nro_cuenta ? String(v.nro_cuenta) : null
      const ejecutado = nro ? (ejecutadoPorCuenta[nro] ?? 0) : 0
      // Si falta un dato NO se inventa cero: se muestra en 0 pero queda listado en `faltantes`,
      // que es lo que levanta el control. Un cero silencioso es indistinguible de un cero real.
      const montos = r.faltantes.length > 0
        ? {} as Record<string, number>
        : repartirEnMeses(v as Variable, r.monto, mm, { ejecutado })
      return {
        id: String(v.id), concepto: String(v.concepto),
        nroCuenta: nro,
        montos, faltantes: r.faltantes,
        pendienteAProposito: Boolean(v.pendiente_a_proposito),
        // Sólo tiene sentido avisar sobre cupos: en los otros modos "lo ejecutado" no cierra nada.
        aviso: v.distribucion === "cupo_anual" && r.faltantes.length === 0
          ? avisoCupoAnual(String(v.concepto), r.monto, ejecutado)
          : null,
        ejecutado,
        esCupoAnual: v.distribucion === "cupo_anual",
      }
    })
    setVariables(filas)
    return new Set(filas.filter(f => f.nroCuenta && f.faltantes.length === 0).map(f => f.nroCuenta!))
  }

  /** Inversiones (P-36). Se reparten en su plazo desde el mes de arranque. */
  const cargarInversiones = async () => {
    const { data } = await supabase.from("presupuesto_inversiones").select("*")
      .eq("empresa", "MSA").eq("escenario", "base").eq("activo", true).neq("estado", "descartada")
    const filas = ((data || []) as any[]).map(i => {
      const montos: Record<string, number> = {}
      const total = Number(i.monto) || 0
      const plazo = Math.max(1, Number(i.plazo_meses) || 1)
      const arranque = meses.findIndex(m => m.mes === Number(i.mes))
      const desde = arranque >= 0 ? arranque : 0
      for (let k = 0; k < plazo; k++) {
        const m = meses[desde + k]
        if (!m) break                       // lo que cae fuera del horizonte no se muestra
        montos[`${m.anio}-${String(m.mes).padStart(2, "0")}`] = total / plazo
      }
      return {
        id: String(i.id), nombre: String(i.nombre), montos,
        sinJustificar: !String(i.justificacion ?? "").trim(),
      }
    })
    setInversiones(filas)
  }

  const cargarCuentas = async (ipc: PuntoSerie[], cubiertasPorVariable: Set<string> = new Set()) => {
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
      // ── Regla A (P-37): si una cuenta ya la cubre una variable, NO se proyecta también por
      // historia. Es el doble conteo evitado por construcción, y reemplaza la lista hardcodeada
      // de `esProduccion()`: la cuenta queda afuera PORQUE tiene variable, no porque alguien la
      // escribió en el código. Sólo cuentan las variables completas: una a medias no tapa nada.
      .filter(nro => !cubiertasPorVariable.has(nro))
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

  /**
   * De dónde arranca el saldo del presupuesto. Dos modos, y los dos hacen falta:
   *
   *  · `ultimo_conciliado` — el saldo del último movimiento **conciliado** del extracto. Es un
   *    número verificable contra el banco, y es el que contesta "¿me alcanza la plata?".
   *  · `manual` — el usuario declara el saldo de hoy. Es la válvula para cuando la conciliación
   *    está atrasada (el 2026-08-03 el extracto llegaba al 18/06, mes y medio atrás).
   *
   * El modo se elige, no se adivina: un saldo viejo presentado como actual es más peligroso que
   * uno declarado a mano, porque parece confiable.
   */
  const cargarConfig = async () => {
    const { data } = await supabase.from("presupuesto_config")
      .select("saldo_inicial, mes_inicial, arranque_modo").eq("empresa", "MSA").maybeSingle()
    const modo = (data?.arranque_modo ?? "manual") as "manual" | "ultimo_conciliado"
    setArranqueModo(modo)

    if (modo === "ultimo_conciliado") {
      const { data: ult } = await supabase.from("msa_galicia")
        .select("fecha, saldo")
        .eq("estado", "conciliado").not("saldo", "is", null)
        .order("fecha", { ascending: false }).order("orden", { ascending: false })
        .limit(1).maybeSingle()
      if (ult?.saldo != null) {
        const f = new Date(String(ult.fecha) + "T00:00:00")
        setSaldoInicial(Number(ult.saldo))
        setMesInicial(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`)
        setArranqueFecha(String(ult.fecha))
        return
      }
      // Sin extracto conciliado no se inventa nada: se avisa y se cae al manual.
      setArranqueFecha(null)
    }
    setSaldoInicial(Number(data?.saldo_inicial) || 0)
    setMesInicial(data?.mes_inicial ?? null)
  }

  const guardarArranqueModo = async (modo: "manual" | "ultimo_conciliado") => {
    const { error } = await supabase.from("presupuesto_config")
      .upsert({ empresa: "MSA", arranque_modo: modo, updated_at: new Date().toISOString() },
        { onConflict: "empresa" })
    if (error) { alert("Error: " + error.message); return }
    setArranqueModo(modo)
    await cargarConfig()
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
      .select("id, nombre_referencia, categ, cuenta_agrupadora, responsable, periodicidad, aplica_generacion, cuotas, tipo_recurrencia, tipo")
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
        tipo: t.tipo ?? null,
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

    // Construir filas por TIPO + agrupador. Se parte por tipo igual que el dashboard: una
    // agrupadora que mezclara gasto con retiro aparece en las dos secciones con su parte, en
    // vez de que una de las dos se coma a la otra.
    const mapaAgrupadores: Record<string, { nombre: string; tipo: TipoCuenta; filas: FilaTemplate[] }> = {}
    for (const t of templates) {
      const agrupador = t.cuenta_agrupadora || "Sin agrupador"
      const info = proyeccion[t.id]?.info
      const resuelto = (info && tipoEfectivo(info)) || "egreso"
      // Si el tipo no tiene sección, cae en EGRESOS. Nunca dejarlo afuera: seguiría sumando
      // en el TOTAL sin aparecer en ninguna fila, y el subtotal dejaría de cerrar en silencio.
      const tipo: TipoCuenta = SECCIONES_EGRESO.some(s => s.tipo === resuelto) ? resuelto : "egreso"
      const clave = `${tipo}||${agrupador}`
      if (!mapaAgrupadores[clave]) mapaAgrupadores[clave] = { nombre: agrupador, tipo, filas: [] }
      mapaAgrupadores[clave].filas.push({
        id: t.id,
        nombre: t.nombre_referencia,
        agrupador,
        tipo,
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
      .filter(([, g]) => g.filas.some(f => Object.values(f.montos).some(m => m > 0)))
      .map(([clave, g]) => ({ nombre: g.nombre, tipo: g.tipo, clave, expandido: false, templates: g.filas }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))

    setAgrupadores(listaAgrupadores)

    // Inicializar todos colapsados
    const initExpand: Record<string, boolean> = {}
    listaAgrupadores.forEach(a => { initExpand[a.clave] = false })
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
        .select("ternero_id, fecha, peso_kg, ternero:terneros!inner(sexo, es_torito, activo)"),
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
      // ⚠️ Un lote con destino interno NO entra al presupuesto: pasa a otra actividad y no
      // genera caja. Aparece en el Margen como traspaso —ingreso de una, costo de la otra—,
      // pero acá sería plata que nunca llega.
      if ((l as any).destino_actividad_id) continue
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
        // ⚠️ Sin esto el presupuesto proyectaba la venta de animales YA VENDIDOS o muertos:
        // las pesadas de un animal no desaparecen cuando se lo da de baja.
        activo: r.ternero.activo !== false,
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

  /**
   * Sueldos. Cascada: **sueldo de presupuesto → período liquidado → nada**.
   *
   * El sueldo de presupuesto manda porque los períodos futuros venían con el monto congelado y
   * tres empleados en $0 — el bloque mostraba la mitad de lo que cuesta la plantilla. Lo que el
   * usuario carga en "Sueldos del presupuesto" pisa a los períodos hacia adelante.
   *
   * Los que NO tienen sueldo de presupuesto siguen saliendo del período liquidado, así no se
   * pierde nada de lo que ya andaba.
   */
  const cargarSueldos = async () => {
    const primerMes = meses[0]
    const ultimoMes = meses[meses.length - 1]

    // 1) Lo que el usuario presupuestó a mano, más las cargas sociales.
    const [{ data: emps }, { data: cfgS }] = await Promise.all([
      supabase.from("sueldos_empleados")
        .select("id, nombre, empresa, sueldo_presupuesto, francos_dias_promedio, premio_mes, premio_multiplo")
        .neq("activo", false),
      supabase.from("presupuesto_config")
        .select("inflacion_mensual, ipc_escalon_meses, suss_base").eq("empresa", "MSA").maybeSingle(),
    ])
    const paramsS: ParametrosSueldos = {
      ipcEscalonMeses: cfgS?.ipc_escalon_meses ?? null,
      inflacionMensual: Number(cfgS?.inflacion_mensual) || 0,
      sussBase: cfgS?.suss_base == null ? null : Number(cfgS.suss_base),
    }
    const mm = meses.map(m => ({ anio: m.anio, mes: m.mes }))
    const presupuestados: Record<string, FilaSueldo> = {}
    const conSueldoPropio = new Set<string>()
    for (const e of ((emps || []) as any[])) {
      const emp: EmpleadoPresupuesto = {
        id: String(e.id), nombre: String(e.nombre), empresa: e.empresa,
        sueldo_presupuesto: e.sueldo_presupuesto == null ? null : Number(e.sueldo_presupuesto),
        francos_dias_promedio: e.francos_dias_promedio == null ? null : Number(e.francos_dias_promedio),
        premio_mes: e.premio_mes == null ? null : Number(e.premio_mes),
        premio_multiplo: e.premio_multiplo == null ? null : Number(e.premio_multiplo),
      }
      const empresa = String(e.empresa || "")
      if (!empresa.toLowerCase().includes("msa") && empresa.toLowerCase() !== "ambas") continue
      const lineas = proyectarEmpleado(emp, mm, paramsS)
      if (lineas.length === 0) continue          // sin sueldo de presupuesto → cae al período
      conSueldoPropio.add(emp.nombre)
      const montos: Record<string, number> = {}
      for (const l of lineas) montos[l.clave] = l.total
      presupuestados[emp.nombre] = { id: emp.nombre, nombre: emp.nombre, montos }
    }

    const { data: periodos } = await supabase
      .from("sueldos_periodos")
      .select("id, anio, mes, saldo_pendiente, bruto_calculado, estado, empleado:sueldos_empleados(nombre, empresa)")
      .gte("anio", primerMes.anio)
      .lte("anio", ultimoMes.anio)
      .neq("estado", "historico")
      .order("anio").order("mes")

    // 2) Los que NO tienen sueldo de presupuesto: siguen saliendo del período liquidado.
    const mapaEmpleados: Record<string, FilaSueldo> = {}
    for (const p of (periodos || [])) {
      const emp = p.empleado as any
      if (!emp) continue
      const empresa: string = emp.empresa || ""
      if (!empresa.toLowerCase().includes("msa") && empresa.toLowerCase() !== "ambas") continue

      const nombre: string = emp.nombre
      if (conSueldoPropio.has(nombre)) continue   // el presupuestado manda

      const clave = `${p.anio}-${String(p.mes).padStart(2, "0")}`
      const monto = Number(p.saldo_pendiente ?? p.bruto_calculado ?? 0)

      if (!mapaEmpleados[nombre]) {
        mapaEmpleados[nombre] = { id: nombre, nombre, montos: {} }
      }
      mapaEmpleados[nombre].montos[clave] = monto
    }

    // 3) Cargas sociales: una fila propia. No sale de ningún empleado — es el punto de arranque
    //    que carga el usuario, con el +50 % de enero y julio.
    const suss = proyectarSuss(mm, paramsS)
    const filaSuss: FilaSueldo | null = suss.length > 0
      ? { id: "__suss__", nombre: "Cargas sociales (SUSS)", montos: Object.fromEntries(suss.map(s => [s.clave, s.monto])) }
      : null

    setSueldoFilas([
      ...Object.values(presupuestados),
      ...Object.values(mapaEmpleados),
      ...(filaSuss ? [filaSuss] : []),
    ])
  }

  // ── Toggle agrupador ────────────────────────────────────────────────────────

  const toggleAgrupador = (nombre: string) => {
    setExpandidos(prev => ({ ...prev, [nombre]: !prev[nombre] }))
  }

  const toggleTodos = (expandir: boolean) => {
    const nuevo: Record<string, boolean> = {}
    agrupadores.forEach(a => { nuevo[a.clave] = expandir })
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
      // Variables de costo (P-37). No se pisan con las cuentas: la cuenta que tiene variable
      // quedó afuera de `cuentas` por la regla A, así que cada peso entra una sola vez.
      for (const v of variables) suma += v.montos[clave] || 0
      // Las INVERSIONES no entran acá a propósito: no son gasto operativo. Tienen su propio
      // bloque y su propio total, igual que las distribuciones (C-22).
      totales[clave] = suma
    }
    return totales
  }, [agrupadores, sueldoFilas, ganaderia, hacienda, campos, cuentas, costoProd, variables, meses])

  /**
   * Subtotal por sección (tipo), como en el dashboard.
   *
   * Los bloques que NO son templates —sueldos, cuentas contables, costos de producción,
   * IIBB— son todos gasto operativo, así que se suman a `egreso`. Si algún día alguno deja
   * de serlo, hay que sacarlo de acá y no sólo de la grilla.
   */
  const subtotalPorSeccion = useMemo(() => {
    const out: Record<string, Record<string, number>> = {}
    for (const s of SECCIONES_EGRESO) out[s.tipo] = {}

    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      for (const s of SECCIONES_EGRESO) {
        let suma = 0
        for (const ag of agrupadores) {
          if (ag.tipo !== s.tipo) continue
          for (const f of ag.templates) suma += f.montos[clave] || 0
        }
        out[s.tipo]![clave] = suma
      }

      // Todo lo que no viene de un template va a EGRESOS.
      let extra = 0
      for (const s of sueldoFilas) extra += s.montos[clave] || 0
      extra += ganaderia.reduce((acc, g) => acc + (g.iibb[clave] || 0), 0)
      extra += hacienda.iibb[clave] || 0
      const ant = new Date(m.anio, m.mes - 2, 1)
      const claveAnt = `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2,"0")}`
      const ventaAnt = campos.reduce(
        (a, c) => a + (c.fijado[claveAnt] || 0) + (c.presupuestado[claveAnt] || 0) + (c.disponible[claveAnt] || 0), 0)
      extra += ventaAnt * ALICUOTA_IIBB_ARRENDAMIENTO
      for (const c of cuentas) extra += c.celdas.find(x => x.mes === clave)?.monto || 0
      for (const c of costoProd) extra += c.montos[clave] || 0
      for (const v of variables) extra += v.montos[clave] || 0
      out["egreso"]![clave] = (out["egreso"]![clave] || 0) + extra
    }
    return out
  }, [agrupadores, sueldoFilas, ganaderia, hacienda, campos, cuentas, costoProd, variables, meses])

  /** Secciones que tienen algo que mostrar, en el orden del dashboard. */
  const seccionesVisibles = useMemo(
    () => SECCIONES_EGRESO.filter(s =>
      agrupadores.some(a => a.tipo === s.tipo) ||
      Object.values(subtotalPorSeccion[s.tipo] || {}).some(v => v > 0)),
    [agrupadores, subtotalPorSeccion])

  const totalCuentasPorMes = useMemo(() => {
    const t: Record<string, number> = {}
    for (const c of cuentas) for (const x of c.celdas) t[x.mes] = (t[x.mes] || 0) + x.monto
    return t
  }, [cuentas])

  const totalVariablesPorMes = useMemo(() => {
    const t: Record<string, number> = {}
    for (const v of variables) for (const [k, n] of Object.entries(v.montos)) t[k] = (t[k] || 0) + n
    return t
  }, [variables])

  const totalInversionesPorMes = useMemo(() => {
    const t: Record<string, number> = {}
    for (const i of inversiones) for (const [k, n] of Object.entries(i.montos)) t[k] = (t[k] || 0) + n
    return t
  }, [inversiones])

  /**
   * Control de cobertura (P-32) — el que pidió el usuario: *"todo debe estar en algún lugar,
   * si no, advertencia"*.
   *
   * Avisa en las DOS direcciones, porque los agujeros aparecieron de los dos lados:
   *   · lo que no está en ninguna fuente (HONORARIOS AMS, Cargas Sociales, las 4 de P-33)
   *   · lo que está en dos a la vez (el doble conteo de C-24)
   *
   * Es prerrequisito de la regla A: esa regla apaga la proyección histórica de las cuentas con
   * variable, así que sin este aviso una variable a medias dejaría la cuenta en cero y callada.
   */
  /**
   * Los datos del export (P-38). Se arman desde los MISMOS estados que pinta la grilla, no desde
   * una consulta aparte: si el documento que se le presenta a los socios pudiera diferir de lo que
   * el usuario ve en pantalla, el export dejaría de ser confiable.
   */
  const datosExport = (): DatosExport => {
    const mm = meses.map(m => ({ anio: m.anio, mes: m.mes, label: m.label }))
    const bloque = (titulo: string, filas: FilaExport[], sumaAlTotal = true): BloqueExport =>
      ({ titulo, filas, sumaAlTotal })

    const egresos: BloqueExport[] = []
    for (const ag of agrupadores) {
      egresos.push(bloque(ag.nombre, ag.templates.map(t => ({ concepto: t.nombre, montos: t.montos }))))
    }
    if (sueldoFilas.length > 0) {
      egresos.push(bloque("Sueldos", sueldoFilas.map(s => ({ concepto: s.nombre, montos: s.montos }))))
    }
    if (cuentas.length > 0) {
      egresos.push(bloque("Cuentas contables", cuentas.map(c => ({
        concepto: c.nombre,
        montos: Object.fromEntries(c.celdas.map(x => [x.mes, x.monto])),
      }))))
    }
    if (variables.length > 0) {
      egresos.push(bloque("Variables de costo", variables.map(v => ({ concepto: v.concepto, montos: v.montos }))))
    }
    if (costoProd.length > 0) {
      egresos.push(bloque("Costos de producción", costoProd.map(c => ({ concepto: c.nombre, montos: c.montos }))))
    }

    const ingresos: BloqueExport[] = []
    if (totalIngresosPorMes && Object.keys(totalIngresosPorMes).length > 0) {
      ingresos.push(bloque("Ingresos", [{ concepto: "Total de ingresos", montos: totalIngresosPorMes }]))
    }

    return {
      empresa: "MSA",
      campana: null,
      meses: mm,
      ingresos,
      egresos,
      inversiones: inversiones.length > 0
        ? { titulo: "Inversiones", sumaAlTotal: false,
            filas: inversiones.map(i => ({ concepto: i.nombre, montos: i.montos })) }
        : null,
      saldoInicial,
      origenSaldo: arranqueModo === "ultimo_conciliado"
        ? `último conciliado${arranqueFecha ? ` al ${new Date(arranqueFecha + "T00:00:00").toLocaleDateString("es-AR")}` : ""}`
        : "declarado a mano",
      advertencias: cobertura.avisos.map(a => a.texto),
    }
  }

  const nombreArchivoExport = () =>
    `Presupuesto_MSA_${new Date().toISOString().slice(0, 10)}`

  const cobertura = useMemo(() => {
    const avisos: { nivel: "alta" | "media"; texto: string }[] = []

    const incompletas = variables.filter(v => v.faltantes.length > 0 && !v.pendienteAProposito)
    for (const v of incompletas) {
      avisos.push({
        nivel: v.nroCuenta ? "alta" : "media",
        texto: v.nroCuenta
          ? `“${v.concepto}” está sin terminar y es la única fuente de la cuenta ${v.nroCuenta}: esa cuenta quedó en cero (${v.faltantes.join(" · ")})`
          : `“${v.concepto}” está sin terminar (${v.faltantes.join(" · ")})`,
      })
    }

    // Doble conteo: dos variables completas apuntando a la misma cuenta.
    const porCuenta: Record<string, string[]> = {}
    for (const v of variables) {
      if (v.nroCuenta && v.faltantes.length === 0) (porCuenta[v.nroCuenta] ||= []).push(v.concepto)
    }
    for (const [nro, conceptos] of Object.entries(porCuenta)) {
      if (conceptos.length > 1) {
        avisos.push({
          nivel: "alta",
          texto: `La cuenta ${nro} la alimentan ${conceptos.length} variables a la vez (${conceptos.join(", ")}): se está contando dos veces`,
        })
      }
    }

    // Avisos de cupo anual: "se gastó cero y seguís presupuestando", o el cupo quedó corto.
    for (const v of variables) {
      if (v.aviso) avisos.push({ nivel: "media", texto: v.aviso })
    }

    const sinJustificar = inversiones.filter(i => i.sinJustificar).length
    if (sinJustificar > 0) {
      avisos.push({
        nivel: "media",
        texto: `${sinJustificar} ${sinJustificar === 1 ? "inversión" : "inversiones"} sin justificar`,
      })
    }

    const aProposito = variables.filter(v => v.pendienteAProposito).length
    // ⚠️ No es un error: es un recordatorio de que esa forma de presupuestar sigue a prueba.
    const hayCupos = variables.some(v => v.esCupoAnual)
    return { avisos, aProposito, hayCupos }
  }, [variables, inversiones])

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

  /**
   * Una agrupadora con sus templates. Extraido a funcion porque ahora se llama una vez
   * por seccion (EGRESOS / DISTRIBUCIONES), en vez de un unico map sobre todo.
   */
  const renderAgrupador = (ag: Agrupador) => {
    const expandido = expandidos[ag.clave] ?? false

    // Total del agrupador por mes
    const totalesAg: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      totalesAg[clave] = ag.templates.reduce((s, f) => s + (f.montos[clave] || 0), 0)
    }
    const tieneAlgo = Object.values(totalesAg).some(v => v > 0)
    if (!tieneAlgo) return null

    return (
      <Fragment key={ag.clave}>
        {/* Fila agrupador */}
        <tr
          key={`ag-${ag.nombre}`}
          className="border-b bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
          onClick={() => toggleAgrupador(ag.clave)}
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
            const claveSub = `${ag.clave}||${categ}`
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
      </Fragment>
    )
  }

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
          <Button variant="outline" size="sm" className="gap-1" onClick={() => cargarDatos()} disabled={cargando}
            title="Volver a leer todo: templates, sueldos, cuentas, variables e inversiones">
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => toggleTodos(true)}>Expandir todo</Button>
          <Button variant="outline" size="sm" onClick={() => toggleTodos(false)}>Colapsar todo</Button>
          <Button variant="outline" size="sm" className="gap-1"
            onClick={() => exportarExcel(datosExport(), nombreArchivoExport())}
            title="Resumen + una hoja por bloque, con el detalle de cada subtotal">
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
          {/* El PDF es el documento de la REUNIÓN: se imprime y se muestra. Por eso el completo
              es el botón principal — si en la reunión preguntan de dónde sale un número, la
              respuesta tiene que estar ahí y no en otro archivo. */}
          <Button variant="outline" size="sm" className="gap-1"
            onClick={() => exportarPDF(datosExport(), nombreArchivoExport())}
            title="Resumen + el detalle de cada bloque, una página por bloque. Para imprimir y presentar">
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-gray-500"
            onClick={() => exportarPDF(datosExport(), `${nombreArchivoExport()}_resumen`, true)}
            title="Sólo la primera página, cuando alcanza con la síntesis">
            sólo resumen
          </Button>
        </div>
      </div>

      {/* ── Control de cobertura (P-32) ──
          "Todo debe estar en algún lugar, si no, advertencia."
          Avisa en las dos direcciones —lo que falta y lo que está contado dos veces— porque
          los agujeros aparecieron de los dos lados. Y es lo que hace segura a la regla A: sin
          este aviso, una variable a medias dejaría su cuenta en cero y en silencio. */}
      {cobertura.avisos.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs">
          <p className="font-medium text-amber-900">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            Control de cobertura — {cobertura.avisos.length}{" "}
            {cobertura.avisos.length === 1 ? "aviso" : "avisos"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {cobertura.avisos.map((a, i) => (
              <li key={i} className={`text-[11px] ${a.nivel === "alta" ? "text-red-800" : "text-amber-800"}`}>
                {a.nivel === "alta" ? "🔴" : "🟡"} {a.texto}
              </li>
            ))}
          </ul>
          {cobertura.aProposito > 0 && (
            <p className="mt-1 text-[10px] text-gray-500">
              (Hay {cobertura.aProposito} {cobertura.aProposito === 1 ? "variable marcada" : "variables marcadas"} como
              pendientes a propósito: no cuentan como aviso.)
            </p>
          )}
        </div>
      )}

      {/* ⚠️ El cupo anual está implementado pero NO validado como forma de presupuestar.
          El usuario pidió que quede a la vista y no como comentario: una decisión pendiente que
          sólo vive en el código es una decisión que se olvida. */}
      {cobertura.hayCupos && (
        <div className="rounded border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-900">
          ⚠️ <strong>Cupo anual — forma de presupuestar sin validar.</strong>{" "}
          {AVISO_CUPO_ANUAL_SIN_VALIDAR}
        </div>
      )}

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
          {/* `sticky top-0` se pega al CONTENEDOR DE SCROLL más cercano, no a la ventana. Y
              `overflow-x-auto` crea contenedor en los DOS ejes (si un eje deja de ser `visible`,
              el otro pasa a `auto`). Como este div crecía con el contenido, nunca scrolleaba
              vertical y el encabezado parecía no pegarse. Con `max-h` el scroll vertical pasa a
              ocurrir acá adentro y el `sticky` funciona. */}
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              {/* Encabezado pegado arriba: la grilla es larga (templates + sueldos + cuentas +
                  costos) y al scrollear se perdía contra qué mes se está mirando el número.
                  La esquina (Concepto) se pega arriba Y a la izquierda, por eso lleva z mayor. */}
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="sticky left-0 top-0 z-30 bg-gray-50 px-4 py-2 text-left font-semibold text-gray-700 min-w-[220px]">
                    Concepto
                  </th>
                  {meses.map(m => {
                    const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                    const esActual = clave === mesActualClave
                    return (
                      <th
                        key={clave}
                        className={`sticky top-0 z-20 px-3 py-2 text-right font-medium text-xs whitespace-nowrap min-w-[90px] ${
                          esActual ? "bg-blue-50 text-blue-700 border-l-2 border-blue-300" : "bg-gray-50 text-gray-500"
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

                {/* ══ EGRESOS ─ la seccion grande: templates + sueldos + cuentas + costos + IIBB ══
                    Mismo orden y colores que el dashboard (`tabla-resumen-financiero.tsx`),
                    para poder comparar las dos pantallas mes a mes sin traducir nada. */}
                {seccionesVisibles.filter(s => s.tipo === "egreso").map(s => (
                  <tr key={`sec-${s.tipo}`} className={`border-t-2 border-gray-300 ${s.fondo}`}>
                    <td className={`sticky left-0 z-10 ${s.fondo} px-4 py-2 font-bold text-xs tracking-wide ${s.texto}`}>
                      {s.titulo}
                    </td>
                    {meses.map(m => <td key={`${m.anio}-${m.mes}`} className={s.fondo} />)}
                  </tr>
                ))}

                {agrupadores.filter(ag => ag.tipo === "egreso").map(renderAgrupador)}

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

                {/* ── Variables de costo (P-37) ──
                    Cantidad × precio × ajustes. La cuenta que alimenta una variable NO está en
                    el bloque de arriba: la regla A la sacó, así que cada peso entra una vez. */}
                {variables.length > 0 && (() => {
                  const abierto = expandidos["__variables__"] ?? false
                  const conProblema = variables.filter(v => v.faltantes.length > 0 && !v.pendienteAProposito).length
                  return (
                    <>
                      <tr className="border-b bg-violet-50 cursor-pointer hover:bg-violet-100 transition-colors"
                        onClick={() => toggleAgrupador("__variables__")}>
                        <td className="sticky left-0 z-10 bg-violet-50 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                          {abierto
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />}
                          🧮 Variables de costo
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            {variables.length} · cantidad × precio
                            {conProblema > 0 && (
                              <span className="ml-1 text-amber-600">· {conProblema} sin terminar</span>
                            )}
                          </span>
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          return (
                            <td key={clave}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                              {fmt(totalVariablesPorMes[clave] || 0)}
                            </td>
                          )
                        })}
                      </tr>
                      {abierto && variables.map(v => (
                        <tr key={`var-${v.id}`} className="border-b hover:bg-gray-50">
                          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-xs text-gray-600">
                            {v.concepto}
                            {v.faltantes.length > 0 && (
                              <span className={`ml-2 text-[10px] ${v.pendienteAProposito ? "text-blue-500" : "text-amber-600"}`}
                                title={v.faltantes.join(" · ")}>
                                {v.pendienteAProposito ? "pendiente a propósito" : "sin terminar"}
                              </span>
                            )}
                          </td>
                          {meses.map(m => {
                            const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                            return (
                              <td key={clave}
                                className={`px-3 py-1.5 text-right text-xs text-gray-600 ${
                                  clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                                {fmt(v.montos[clave] || 0)}
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


                {/* ── Subtotal EGRESOS ── */}
                {seccionesVisibles.filter(s => s.tipo === "egreso").map(s => (
                  <tr key={`sub-${s.tipo}`} className={`border-t ${s.subtotal}`}>
                    <td className={`sticky left-0 z-10 ${s.subtotal} px-4 py-2 font-bold ${s.texto}`}>
                      Subtotal {s.titulo.toLowerCase()}
                    </td>
                    {meses.map(m => {
                      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                      const esActual = clave === mesActualClave
                      return (
                        <td key={clave} className={`px-3 py-2 text-right font-bold ${s.texto} ${esActual ? "border-l-2 border-blue-300" : ""}`}>
                          {fmt(subtotalPorSeccion[s.tipo]?.[clave] || 0)}
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {/* ══ DISTRIBUCIONES (y financieros, si alguna vez se proyectan) ══
                    Los retiros de socios SI son salida de caja — por eso se presupuestan y
                    entran en el TOTAL — pero no son gasto operativo: verlos aparte es la unica
                    forma de saber cuanto del egreso es estructura y cuanto es reparto. */}
                {seccionesVisibles.filter(s => s.tipo !== "egreso").map(s => (
                  <Fragment key={`sec-${s.tipo}`}>
                    <tr className={`border-t-2 border-gray-300 ${s.fondo}`}>
                      <td className={`sticky left-0 z-10 ${s.fondo} px-4 py-2 font-bold text-xs tracking-wide ${s.texto}`}>
                        {s.titulo}
                      </td>
                      {meses.map(m => <td key={`${m.anio}-${m.mes}`} className={s.fondo} />)}
                    </tr>

                    {agrupadores.filter(ag => ag.tipo === s.tipo).map(renderAgrupador)}

                    <tr className={`border-t ${s.subtotal}`}>
                      <td className={`sticky left-0 z-10 ${s.subtotal} px-4 py-2 font-bold ${s.texto}`}>
                        Subtotal {s.titulo.toLowerCase()}
                      </td>
                      {meses.map(m => {
                        const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                        const esActual = clave === mesActualClave
                        return (
                          <td key={clave} className={`px-3 py-2 text-right font-bold ${s.texto} ${esActual ? "border-l-2 border-blue-300" : ""}`}>
                            {fmt(subtotalPorSeccion[s.tipo]?.[clave] || 0)}
                          </td>
                        )
                      })}
                    </tr>
                  </Fragment>
                ))}

                {/* ── INVERSIONES (P-36) ──
                    Fuera del total de egresos a propósito: no son gasto operativo. Se muestran
                    igual porque la plata sale, pero mezclarlas con el gasto del año infla el
                    egreso y le saca a la inversión lo único que la hace discutible. */}
                {(() => {
                  const abierto = expandidos["__inversiones__"] ?? false
                  const sinJust = inversiones.filter(i => i.sinJustificar).length
                  return (
                    <>
                      <tr className="border-b border-t-2 border-gray-300 bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors"
                        onClick={() => toggleAgrupador("__inversiones__")}>
                        <td className="sticky left-0 z-10 bg-orange-50 px-4 py-2 font-semibold text-orange-900 flex items-center gap-1">
                          {abierto
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />}
                          🏗️ INVERSIONES
                          <span className="ml-2 text-xs font-normal text-orange-700">
                            {inversiones.length === 0
                              ? "sin inversiones cargadas — se cargan en el botón «Inversiones»"
                              : `${inversiones.length} · fuera del total de egresos`}
                            {sinJust > 0 && <span className="ml-1 text-amber-700">· {sinJust} sin justificar</span>}
                          </span>
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          return (
                            <td key={clave}
                              className={`px-3 py-2 text-right font-semibold text-orange-900 ${
                                clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                              {fmt(totalInversionesPorMes[clave] || 0)}
                            </td>
                          )
                        })}
                      </tr>
                      {abierto && inversiones.map(i => (
                        <tr key={`inv-${i.id}`} className="border-b hover:bg-gray-50">
                          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-xs text-gray-600">
                            {i.nombre}
                            {i.sinJustificar && (
                              <span className="ml-2 text-[10px] text-amber-600">sin justificar</span>
                            )}
                          </td>
                          {meses.map(m => {
                            const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                            return (
                              <td key={clave}
                                className={`px-3 py-1.5 text-right text-xs text-gray-600 ${
                                  clave === mesActualClave ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                                {fmt(i.montos[clave] || 0)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  )
                })()}

                {/* ── Total general ──
                    Suma TODAS las secciones. Los retiros van adentro a propósito: el
                    presupuesto es de caja y esa plata sale. La separación de arriba es para
                    poder leerlo, no para excluirlo. */}
                <tr className="border-t-2 border-gray-400 bg-gray-800">
                  <td className="sticky left-0 z-10 bg-gray-800 px-4 py-3 font-bold text-white flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    TOTAL EGRESOS MSA
                    {seccionesVisibles.some(s => s.tipo !== "egreso") && (
                      <span className="font-normal text-[10px] text-gray-300">
                        (incluye distribuciones)
                      </span>
                    )}
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
                        <>
                          {/* De dónde sale el saldo de arranque. Se ELIGE, no se adivina: un saldo
                              viejo presentado como actual es más peligroso que uno declarado a
                              mano, porque parece confiable. */}
                          <div className="mt-1 flex items-center gap-1">
                            {([
                              ["manual", "Saldo a mano"],
                              ["ultimo_conciliado", "Último conciliado"],
                            ] as const).map(([modo, txt]) => (
                              <button key={modo} type="button"
                                onClick={() => guardarArranqueModo(modo)}
                                className={`rounded border px-1.5 py-0.5 text-[9px] font-normal transition-colors ${
                                  arranqueModo === modo
                                    ? "border-gray-300 bg-white text-gray-800"
                                    : "border-gray-600 text-gray-400 hover:text-gray-200"}`}>
                                {txt}
                              </button>
                            ))}
                          </div>
                          {arranqueModo === "manual" ? (
                            <button type="button"
                              className="mt-0.5 block text-[10px] font-normal text-gray-400 underline hover:text-gray-200"
                              onClick={() => { setSaldoTxt(fmtNumeroAR(saldoInicial)); setEditandoSaldo(true) }}>
                              arranca en ${Math.round(saldoInicial).toLocaleString("es-AR")}
                              {mesInicial ? ` (${mesInicial})` : ""} — editar
                            </button>
                          ) : arranqueFecha ? (
                            <span className="mt-0.5 block text-[10px] font-normal text-gray-400">
                              ${Math.round(saldoInicial).toLocaleString("es-AR")} al{" "}
                              {new Date(arranqueFecha + "T00:00:00").toLocaleDateString("es-AR")}
                              {(() => {
                                // Si el extracto está atrasado hay que decirlo: el saldo es real,
                                // pero de hace rato, y todo lo posterior es proyección pura.
                                const dias = Math.floor(
                                  (Date.now() - new Date(arranqueFecha + "T00:00:00").getTime()) / 86400000)
                                return dias > 40
                                  ? <span className="text-amber-400"> · extracto atrasado {dias} días</span>
                                  : null
                              })()}
                            </span>
                          ) : (
                            <span className="mt-0.5 block text-[10px] font-normal text-amber-400">
                              no hay extracto conciliado — se usa el saldo a mano
                            </span>
                          )}
                        </>
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
