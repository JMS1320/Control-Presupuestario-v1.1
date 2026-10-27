"use client"

import { Permisable } from "@/components/modo-permisos"
import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, AlertTriangle, CheckCircle, Search, AlertCircle, X, RefreshCw, FileCheck } from "lucide-react"
import { toast } from "sonner"
/**
 * 📎 El link a la factura sale del MISMO módulo que el subdiario y el Cash Flow
 * (§ ♻️ *Centralizar, no duplicar*): si mañana cambia el criterio, cambia en las tres.
 */
import { estadoArchivoDigital, PRESENTACION_ARCHIVO } from "@/lib/facturas/archivo-digital"
import { opcionesFcManual } from "@/lib/gas-pdf/lote"
import { pedirAsignacionDeCuenta, mensajeDePropagacion, type RespuestaAsignacion } from "@/lib/conciliacion/asignar-cuenta-cliente"
import { cargarMovimientosVinculados, diagnosticarVinculos, TITULO_PROBLEMA, type Diagnostico } from "@/lib/conciliacion/revisar-vinculos"
import type { ClienteParaPropagar } from "@/lib/conciliacion/propagar-cuenta"
import { toggleChip, esSoloEste, tituloChip, PISTA_CTRL_CLICK } from "@/lib/ui/chips"
import { cuentasQueCoinciden } from "@/lib/facturas/buscar-cuenta"
import { traerTodo } from "@/lib/supabase-paginado"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { armarHistorialPorCuit, matchPorHistorial, type EstadoMatch, type ResultadoMatch } from "@/lib/facturas/match-historial"
import { TestsDelProceso } from "@/components/tests-del-proceso"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CuentaSistema {
  categ: string
  nro_cuenta: string | null        // hay cuentas del plan sin número (Consumos, FCI…)
  cuenta_contable: string | null
  imputable: boolean
  nombre_totalizadora: string | null
  tipo?: string | null
}

interface ComprobanteArca {
  id: string
  fecha_emision: string | null
  cuit: string | null
  denominacion_emisor: string | null
  imp_neto_gravado: number
  iva: number
  imp_total: number
  cuenta_contable: string | null   // categoría actual (asignada o vacía)
  nro_cuenta: string | null        // asignado manualmente
  año_contable: number | null
  mes_contable: number | null
  fc: string | null
  ddjj_iva: string | null
  numero_desde: string | null
  tipo_comprobante: number | null
  /** 📎 Para poder abrir la factura desde acá. Pedido del usuario 2026-09-30. */
  pdf_drive_url: string | null
}

// El estado («Match» / «Ambiguo» / «Sin match») sale del HISTORIAL del proveedor: ver lib/facturas/match-historial.ts.

interface Sugerencia {
  categ: string
  nro_cuenta: string | null
  cuenta_contable: string | null
  nombre_totalizadora: string | null
  score: number
  fuente: "historial_historico" | "historial_arca" | "nombre_similar" | "exacto"
  usos?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizarCuit(s: string | null | undefined): string {
  return (s ?? "").replace(/[-\s]/g, "").trim()
}

function fuzzyScore(query: string, target: string): number {
  const nq = normalize(query)
  const nt = normalize(target)
  if (!nq || !nt) return 0
  if (nq === nt) return 100
  if (nt.includes(nq) || nq.includes(nt)) return 82
  const wq = new Set(nq.split(" ").filter(w => w.length > 2))
  const wt = new Set(nt.split(" ").filter(w => w.length > 2))
  let common = 0
  wq.forEach(w => { if (wt.has(w)) common++ })
  const total = wq.size + wt.size
  return total > 0 ? Math.round((2 * common / total) * 65) : 0
}

const ESTADO_CONFIG: Record<EstadoMatch, { label: string; color: string; bg: string; rowBg: string }> = {
  asignado: { label: "Asignado",  color: "text-green-700",  bg: "bg-green-100 text-green-700 border-green-300",   rowBg: "" },
  unico:    { label: "Match",     color: "text-blue-700",   bg: "bg-blue-100 text-blue-700 border-blue-300",      rowBg: "" },
  ambiguo:  { label: "Ambiguo",   color: "text-amber-700",  bg: "bg-amber-100 text-amber-700 border-amber-300",   rowBg: "bg-amber-50" },
  sin_match:{ label: "Sin match", color: "text-orange-700", bg: "bg-orange-100 text-orange-700 border-orange-300", rowBg: "bg-orange-50" },
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function VistaAsignacionArca({ empresa = 'MSA', esAdmin = false }: { empresa?: 'MSA' | 'PAM' | 'MA'; esAdmin?: boolean } = {}) {
  const schemaName = empresa === 'PAM' ? 'pam' : empresa === 'MA' ? 'ma' : 'msa'
  const [comprobantes, setComprobantes] = useState<ComprobanteArca[]>([])
  const [cuentasSistema, setCuentasSistema] = useState<CuentaSistema[]>([])
  // 🔎 Lo que cada proveedor ya tiene imputado en el histórico del contador (para el match por historial).
  const [historico, setHistorico] = useState<Array<{ cuit: string | null; cuenta: string | null; nro_cuenta: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 🩺 A-DEC-1021 (6): el estado de los movimientos ya conciliados, mirado ANTES de actuar.
  const [diag, setDiag] = useState<Diagnostico | null>(null)
  const [extractosSinLeer, setExtractosSinLeer] = useState<string[]>([])
  const [soloConciliadas, setSoloConciliadas] = useState(false)

  // Filtros
  // 🖱️ Chips de estado con el gesto de toda la app (lib/ui/chips.ts): el conjunto es LO QUE SE MUESTRA;
  // por defecto todos prendidos. Click prende/apaga, Ctrl+click deja sólo ése.
  const [estadosVisibles, setEstadosVisibles] = useState<Set<EstadoMatch>>(() => new Set<EstadoMatch>(["sin_match", "ambiguo", "unico", "asignado"]))
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos")
  // 📅 A-FEAT-1373: rango de fechas de emisión (ej. el ejercicio 01/07/2025 → 30/06/2026). Vacío = sin límite.
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [filtroCuenta, setFiltroCuenta] = useState("todas")
  const [busqueda, setBusqueda] = useState("")

  // Selección para edición masiva
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  // Modal de asignación
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalIds, setModalIds] = useState<string[]>([])
  const [modalCuentaOriginal, setModalCuentaOriginal] = useState("")
  const [modalCuit, setModalCuit] = useState<string | null>(null)
  const [modalEmisor, setModalEmisor] = useState<string | null>(null)
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [loadingSugerencias, setLoadingSugerencias] = useState(false)
  const [busquedaModal, setBusquedaModal] = useState("")
  // 📚 26/10: poder RECORRER el plan de cuentas entero en el modal (usuario: «no puedo recorrer el plan de cuentas
  // y creo que eso es fundamental»). Usa el selector común de la app (CLAUDE.md § ♻️: para asignar cuenta va
  // siempre SelectorCuentaContable), agrupado por rubro.
  const [verPlan, setVerPlan] = useState(false)
  const [cuentaElegida, setCuentaElegida] = useState<CuentaSistema | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Modal Actualizar Archivo Facturas
  const [modalArchivoAbierto, setModalArchivoAbierto] = useState(false)
  const [archivoPeriodo, setArchivoPeriodo] = useState("")
  const [archivoFacturas, setArchivoFacturas] = useState<Array<ComprobanteArca & { fcLocal: string }>>([])
  const [archivoGuardando, setArchivoGuardando] = useState(false)

  // ── Carga de datos ────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: arca, error: e1 }, { data: ctas, error: e2 }, { data: hist }] = await Promise.all([
        // 📄 Por tandas (A-BUG-1379): las facturas de MSA llegan a 1000 hacia 2027; el histórico también crece.
        traerTodo((d, h) => supabase.schema(schemaName).from("comprobantes_arca")
          .select("id,fecha_emision,cuit,denominacion_emisor,imp_neto_gravado,iva,imp_total,cuenta_contable,nro_cuenta,año_contable,mes_contable,fc,ddjj_iva,numero_desde,tipo_comprobante,pdf_drive_url")
          .order("fecha_emision", { ascending: false }).order("id").range(d, h)),
        supabase.from("cuentas_contables")
          .select("categ,nro_cuenta,cuenta_contable,imputable,nombre_totalizadora,tipo")
          .order("nro_cuenta"),
        traerTodo((d, h) => supabase.schema(schemaName).from("comprobantes_historico")
          .select("nro_doc_emisor,cuenta_asignada,cuenta_contable,nro_cuenta").order("id").range(d, h)),
      ])
      if (e1) throw new Error(e1.message)
      if (e2) throw new Error(e2.message)
      setComprobantes((arca ?? []) as ComprobanteArca[])
      setCuentasSistema((ctas ?? []) as CuentaSistema[])
      setHistorico((hist ?? []).map((h: any) => ({ cuit: h.nro_doc_emisor, cuenta: h.cuenta_asignada ?? h.cuenta_contable, nro_cuenta: h.nro_cuenta })))
      try {
        const { movs, fallaron } = await cargarMovimientosVinculados(supabase as unknown as ClienteParaPropagar)
        setDiag(diagnosticarVinculos(movs, (arca ?? []) as unknown as ComprobanteArca[], (ctas ?? []) as CuentaSistema[]))
        setExtractosSinLeer(fallaron)
      } catch (e: any) {
        setDiag(null)
        setExtractosSinLeer([`(no se pudo revisar: ${e?.message ?? e})`])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [schemaName])

  useEffect(() => { cargar() }, [cargar])

  // ── Map normalizado: normalize(categ) → CuentaSistema[] ──────────────────

  /**
   * 🧾 Para FACTURAS sólo se ofrecen las cuentas del plan CON NÚMERO (usuario 26/10: «ok lo de las cuentas sólo de
   * facturas para facturas»). Las sin número (IIBB Bancario, Percepción IVA, Consumos…) son de templates y cargos
   * del banco: ninguna factura de las tres empresas las usó nunca.
   */
  const cuentasDeFacturas = useMemo(() => cuentasSistema.filter(c => c.nro_cuenta), [cuentasSistema])

  const matchMap = useMemo(() => {
    const m = new Map<string, CuentaSistema[]>()
    for (const c of cuentasSistema) {
      const k = normalize(c.categ)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(c)
    }
    return m
  }, [cuentasSistema])

  // ── Estado de cada comprobante ────────────────────────────────────────────

  /**
   * 🔎 El match sale de TODO el historial del proveedor (usuario 26/10: «el match es sobre todo el historial,
   * el filtro es para trabajar tandas»): facturas de esta empresa ya imputadas + el histórico del contador.
   * Los filtros de la pantalla no lo cambian. Notas de crédito y débito: toman la cuenta de su proveedor.
   */
  const historial = useMemo(() => armarHistorialPorCuit([
    ...comprobantes.filter(c => c.nro_cuenta).map(c => ({ cuit: c.cuit, cuenta: c.cuenta_contable, nro_cuenta: c.nro_cuenta })),
    ...historico,
  ], cuentasSistema), [comprobantes, historico, cuentasSistema])

  const conEstado = useMemo(() =>
    comprobantes.map(c => {
      const m: ResultadoMatch = matchPorHistorial(c, historial, cuentasSistema)
      return { ...c, _estado: m.estado, _match: m }
    }),
    [comprobantes, historial, cuentasSistema]
  )

  // ── Resumen estados ───────────────────────────────────────────────────────

  // (el resumen se calcula más abajo, sobre lo filtrado sin el estado)

  // ── Períodos disponibles ──────────────────────────────────────────────────

  const periodos = useMemo(() => Array.from(new Set(
    comprobantes.filter(c => c.año_contable && c.mes_contable)
      .map(c => `${c.año_contable}-${String(c.mes_contable).padStart(2, "0")}`)
  )).sort(), [comprobantes])

  // ── Cuentas disponibles para filtro ──────────────────────────────────────

  const cuentasDisponibles = useMemo(() => {
    const map = new Map<string, { categ: string; nro_cuenta: string; count: number; total: number }>()
    for (const c of comprobantes) {
      const key = c.cuenta_contable ?? "(sin cuenta)"
      const nro = c.nro_cuenta ?? "—"
      if (!map.has(key)) map.set(key, { categ: key, nro_cuenta: nro, count: 0, total: 0 })
      const entry = map.get(key)!
      entry.count++
      entry.total += c.imp_total ?? 0
    }
    return Array.from(map.values()).sort((a, b) => a.categ.localeCompare(b.categ))
  }, [comprobantes])

  // ── Filtrado ──────────────────────────────────────────────────────────────

  /** Todo lo filtrado MENOS el estado: de acá salen los números de los chips (cuánto queda en la tanda). */
  const filtradosSinEstado = useMemo(() => {
    const q = busqueda.toLowerCase()
    return conEstado.filter(c => {
      // 🐛 26/10: filtraba «tiene movimientos» y mostraba también las que ya tenían cuenta; el chip cuenta las SIN cuenta.
      if (soloConciliadas && !diag?.pendientesConciliadas.has(c.id)) return false
      if (fechaDesde && (!c.fecha_emision || c.fecha_emision < fechaDesde)) return false
      if (fechaHasta && (!c.fecha_emision || c.fecha_emision > fechaHasta)) return false
      if (filtroPeriodo !== "todos") {
        const p = `${c.año_contable}-${String(c.mes_contable).padStart(2, "0")}`
        if (p !== filtroPeriodo) return false
      }
      if (filtroCuenta !== "todas") {
        const cuentaEfectiva = c.cuenta_contable ?? "(sin cuenta)"
        if (cuentaEfectiva !== filtroCuenta) return false
      }
      if (q && !c.denominacion_emisor?.toLowerCase().includes(q) &&
               !c.cuit?.includes(q) &&
               !(c.cuenta_contable ?? "").toLowerCase().includes(q)) return false
      return true
    })
  }, [conEstado, filtroPeriodo, filtroCuenta, busqueda, soloConciliadas, diag, fechaDesde, fechaHasta])

  const filtrados = useMemo(() => filtradosSinEstado.filter(c => estadosVisibles.has(c._estado)),
    [filtradosSinEstado, estadosVisibles])

  const resumen = useMemo(() => {
    const r: Record<EstadoMatch, number> = { asignado: 0, unico: 0, ambiguo: 0, sin_match: 0 }
    filtradosSinEstado.forEach(c => r[c._estado]++)
    return r
  }, [filtradosSinEstado])
  const todosLosEstados = estadosVisibles.size === 4

  // ── Selección ─────────────────────────────────────────────────────────────

  const todosVisible = filtrados.length > 0 && filtrados.every(c => seleccionados.has(c.id))

  function toggleTodos() {
    if (todosVisible) {
      setSeleccionados(prev => {
        const n = new Set(prev)
        filtrados.forEach(c => n.delete(c.id))
        return n
      })
    } else {
      setSeleccionados(prev => {
        const n = new Set(prev)
        filtrados.forEach(c => n.add(c.id))
        return n
      })
    }
  }

  function toggleUno(id: string) {
    setSeleccionados(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // ── Abrir modal ───────────────────────────────────────────────────────────

  async function abrirModal(ids: string[], cuentaOriginal: string, cuit: string | null, emisor?: string | null) {
    setModalIds(ids)
    setModalCuentaOriginal(cuentaOriginal)
    setModalCuit(cuit)
    setModalEmisor(emisor ?? null)
    setCuentaElegida(null)
    setBusquedaModal("")
    setVerPlan(false)
    setModalAbierto(true)
    await cargarSugerencias(cuentaOriginal, cuit, emisor ?? null, ids)
  }

  async function cargarSugerencias(cuentaOriginal: string, cuit: string | null, emisor: string | null, ids: string[]) {
    setLoadingSugerencias(true)
    setSugerencias([])
    try {
      const sugs: Sugerencia[] = []
      const vistas = new Set<string>()
      const cuitNorm = normalizarCuit(cuit)

      // ── PRIORIDAD 1: Historial en comprobantes_historico (mismo CUIT, ya asignados) ──
      if (cuitNorm) {
        const { data: histRows } = await supabase
          .schema(schemaName)
          .from("comprobantes_historico")
          .select("cuenta_asignada,nro_cuenta")
          .eq("nro_doc_emisor", cuit!)
          .not("nro_cuenta", "is", null)
          .limit(200)

        const freq: Record<string, { categ: string; nro_cuenta: string; usos: number }> = {}
        ;(histRows ?? []).forEach((r: any) => {
          if (r.cuenta_asignada && r.nro_cuenta) {
            if (!freq[r.cuenta_asignada]) freq[r.cuenta_asignada] = { categ: r.cuenta_asignada, nro_cuenta: r.nro_cuenta, usos: 0 }
            freq[r.cuenta_asignada].usos++
          }
        })

        for (const [categ, info] of Object.entries(freq).sort((a, b) => b[1].usos - a[1].usos)) {
          const cuenta = cuentasSistema.find(c => c.categ === categ) ?? cuentasSistema.find(c => c.nro_cuenta === info.nro_cuenta)
          if (cuenta && !vistas.has(categ)) {
            vistas.add(categ)
            sugs.push({ ...cuenta, score: 100, fuente: "historial_historico", usos: info.usos })
          }
        }
      }

      // ── PRIORIDAD 2: Historial en comprobantes_arca (mismo CUIT, ya asignados) ──
      if (cuitNorm) {
        const { data: arcaRows } = await supabase
          .schema(schemaName)
          .from("comprobantes_arca")
          .select("cuenta_contable,nro_cuenta")
          .eq("cuit", cuit!)
          .not("nro_cuenta", "is", null)
          .not("id", "in", `(${ids.join(",")})`)
          .limit(200)

        const freq: Record<string, number> = {}
        ;(arcaRows ?? []).forEach((r: any) => {
          if (r.cuenta_contable) freq[r.cuenta_contable] = (freq[r.cuenta_contable] ?? 0) + 1
        })

        for (const [categ, usos] of Object.entries(freq).sort((a, b) => b[1] - a[1])) {
          const cuenta = cuentasSistema.find(c => c.categ === categ)
          if (cuenta && !vistas.has(categ)) {
            vistas.add(categ)
            sugs.push({ ...cuenta, score: 90, fuente: "historial_arca", usos })
          }
        }
      }

      // ── PRIORIDAD 3: Match exacto por cuenta_contable actual ──
      const kOrig = normalize(cuentaOriginal)
      if (kOrig) {
        const exactas = matchMap.get(kOrig) ?? []
        for (const c of exactas) {
          if (!vistas.has(c.categ)) {
            vistas.add(c.categ)
            sugs.push({ ...c, score: 80, fuente: "exacto" })
          }
        }
      }

      sugs.sort((a, b) => b.score - a.score || (b.usos ?? 0) - (a.usos ?? 0) || a.categ.localeCompare(b.categ))
      setSugerencias(sugs)
    } finally {
      setLoadingSugerencias(false)
    }
  }

  // ── Guardar asignación ────────────────────────────────────────────────────

  /**
   * 🧮 Muestra qué pasó con los movimientos conciliados. **Nada en silencio**: si propagó, lo dice
   * en verde; si algo quedó sin tocar o falló, en ámbar y con el detalle.
   */
  function mostrarPropagacion(r: RespuestaAsignacion) {
    const m = mensajeDePropagacion(r)
    if (m.tipo === "aviso") toast.warning(m.texto)
    else if (m.tipo === "ok") toast.success(m.texto)
  }


  /**
   * ⚡ 26/10: después de asignar/quitar se actualizan SÓLO esas filas con el par que devolvió la ruta, en vez
   * de recargar todo (facturas + histórico + 11 extractos). Usuario: «recarga la página cuando termina,
   * no sé si hará falta». El ⟳ sigue para refrescar todo a mano.
   */
  function aplicarLocal(ids: string[], par: { cuenta_contable: string | null; nro_cuenta: string | null }) {
    const set = new Set(ids)
    setComprobantes(prev => prev.map(c => set.has(c.id) ? { ...c, cuenta_contable: par.cuenta_contable, nro_cuenta: par.nro_cuenta } : c))
    setDiag(d => {
      if (!d) return d
      const pend = new Map(d.pendientesConciliadas)
      for (const id of ids) {
        const n = d.movimientosPorFactura.get(id) ?? 0
        if (par.cuenta_contable || par.nro_cuenta) pend.delete(id)
        else if (n > 0) pend.set(id, n)
      }
      return { ...d, pendientesConciliadas: pend }
    })
  }
  const parDe = (r: RespuestaAsignacion) => ({ cuenta_contable: r.cuenta?.cuenta_contable ?? null, nro_cuenta: r.cuenta?.nro_cuenta ?? null })

  async function guardarAsignacion() {
    if (!cuentaElegida) return
    setGuardando(true)
    try {
      // 🏢 Una empresa por vez (A-DEC-1021): la de esta pestaña.
      const data = await pedirAsignacionDeCuenta({
        empresa, ids: modalIds, nro_cuenta: cuentaElegida.nro_cuenta, cuenta_contable: cuentaElegida.categ,
      })
      /**
       * 🔗 **Lo que pasó con el extracto SE VE** (A-BUG-1221).
       *
       * La asignación no termina en la factura: si ya está conciliada, la cuenta viaja a sus
       * movimientos. Antes eso ocurría en silencio —y los errores iban a `console.error` mientras
       * acá salía «Cuenta asignada»—, así que **no había forma de saber si había llegado**.
       *
       * Ahora la ruta devuelve cuántos movimientos recibió la cuenta y cuáles **no se tocaron** por
       * estar clasificados en otro sistema (`FCI`, `CAJA`, `Sueldos`…): § 🚦 avisa y deja seguir.
       */
      mostrarPropagacion(data)
      aplicarLocal(modalIds, parDe(data))
      setModalAbierto(false)
      setSeleccionados(new Set())
    } catch (err: any) {
      alert("Error al guardar: " + err.message)
    } finally {
      setGuardando(false)
    }
  }

  /**
   * 🔑 Y al QUITAR la cuenta también se propaga: antes el movimiento del extracto se quedaba con la
   * cuenta vieja, imputado a algo que la factura ya no tenía (A-BUG-1221, hueco 3).
   */
  async function quitarAsignacion(ids: string[]) {
    if (!confirm(`¿Quitar la asignación de ${ids.length} comprobante(s)?`)) return
    // Antes un error acá se tragaba (`.catch(() => {})`) y la pantalla recargaba como si nada.
    try {
      const r = await pedirAsignacionDeCuenta({ empresa, ids, nro_cuenta: null, cuenta_contable: null })
      mostrarPropagacion(r)
      aplicarLocal(ids, parDe(r))
    } catch (err: any) {
      toast.error(`No se quitó la cuenta: ${err.message}`)
    }
    setSeleccionados(new Set())
  }

  /**
   * 📎 **El link a la factura.** Pedido del usuario 2026-09-30: *«para la pantalla debés ponerle el
   * link a la factura así yo lo puedo ver en caso de dudas»* — y tiene todo el sentido acá, porque la
   * decisión que se toma en esta pantalla es **qué cuenta lleva esa factura**, y a veces eso no se
   * puede saber sin mirarla.
   *
   * 🔑 Sale del **mismo** módulo que el subdiario y el Cash Flow, así que los cinco estados son los
   * mismos: 📎 la tiene · 🌐 es de Portal (no llega por mail) · ❌ falta y debería estar.
   */
  function celdaFactura(c: ComprobanteArca) {
    const estado = estadoArchivoDigital({ pdf_drive_url: c.pdf_drive_url, fc: c.fc, origen: "ARCA" })
    const { icono, clase, titulo } = PRESENTACION_ARCHIVO[estado]
    if (estado !== "con") return <span className={clase} title={titulo}>{icono}</span>
    return (
      <a href={c.pdf_drive_url!} target="_blank" rel="noreferrer" title={titulo} className={clase}>
        {icono}
      </a>
    )
  }

  // ── Auto-asignar únicos ───────────────────────────────────────────────────

  /**
   * Asigna su «Match» a las facturas SELECCIONADAS (usuario 26/10: «el primer botón debe ser sobre las
   * seleccionadas y no sobre el total filtrado»), con la cuenta que dice el historial de cada proveedor.
   * Una llamada por cuenta, en paralelo. Las seleccionadas que no son Match se dejan como están.
   */
  const unicosFiltrados = filtrados.filter(c => seleccionados.has(c.id) && c._estado === "unico" && c._match.sugerida)
  async function autoAsignarUnicos() {
    if (unicosFiltrados.length === 0) return
    const porCuenta = new Map<string, { nro: string | null; ids: string[] }>()
    for (const c of unicosFiltrados) {
      const s = c._match.sugerida!
      const g = porCuenta.get(s.categ) ?? { nro: s.nro_cuenta, ids: [] }
      g.ids.push(c.id); porCuenta.set(s.categ, g)
    }
    const detalle = [...porCuenta].map(([cta, g]) => `· ${cta}: ${g.ids.length}`).join("\n")
    if (!confirm(`¿Asignar la cuenta del historial a ${unicosFiltrados.length} seleccionada(s)?${seleccionados.size > unicosFiltrados.length ? ` (${seleccionados.size - unicosFiltrados.length} sin match quedan como están)` : ""}\n\n${detalle}`)) return
    let ok = 0, propagados = 0
    const errores: string[] = []
    // ⚡ En paralelo, una llamada por cuenta (antes, una detrás de otra).
    await Promise.all([...porCuenta].map(async ([cta, g]) => {
      try {
        const r = await pedirAsignacionDeCuenta({ empresa, ids: g.ids, nro_cuenta: g.nro, cuenta_contable: cta })
        aplicarLocal(g.ids, parDe(r))
        ok += g.ids.length; propagados += r.propagacion?.propagados ?? 0
        if (r.propagacion?.aviso) errores.push(r.propagacion.aviso)
      } catch (e: any) { errores.push(`${cta}: ${e.message}`) }
    }))
    toast.success(`${ok} comprobante(s) asignados${propagados ? ` · la cuenta llegó a ${propagados} movimiento(s)` : ""}`)
    for (const e of errores) toast.warning(e)
    setSeleccionados(new Set())
  }

  // ── Sugerencias filtradas en modal ────────────────────────────────────────

  const sugerenciasFiltradas = useMemo(() => {
    if (!busquedaModal) return sugerencias
    // 🐛 A-BUG-1377: hay cuentas del plan SIN número; la búsqueda vive en lib para poder probarla.
    return cuentasQueCoinciden(cuentasDeFacturas, busquedaModal)
      .map(c => ({ ...c, score: fuzzyScore(busquedaModal, c.categ), fuente: "nombre_similar" as const }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
  }, [busquedaModal, sugerencias, cuentasDeFacturas])

  // ── Actualizar Archivo Facturas ────────────────────────────────────────────

  async function cargarFacturasArchivo(periodo: string) {
    const [año, mes] = periodo.split("-").map(Number)
    const { data, error } = await supabase.schema(schemaName).from("comprobantes_arca")
      .select("id,fecha_emision,cuit,denominacion_emisor,imp_neto_gravado,iva,imp_total,cuenta_contable,nro_cuenta,año_contable,mes_contable,fc,ddjj_iva,numero_desde,tipo_comprobante,pdf_drive_url")
      .eq("año_contable", año)
      .eq("mes_contable", mes)
      .order("denominacion_emisor")
    if (error) { toast.error("Error cargando facturas: " + error.message); return }
    setArchivoFacturas((data ?? []).map((f: any) => ({ ...f, fcLocal: f.fc || 'Buscar' })))
  }

  async function guardarArchivoFC() {
    setArchivoGuardando(true)
    try {
      let actualizadas = 0
      for (const f of archivoFacturas) {
        // A-FEAT-1287: lo que no se marcó queda en «Buscar» (antes se guardaba «Sí» y decía que la
        // factura estaba cuando nadie la había visto).
        const fcFinal = f.fcLocal || 'Buscar'
        if (fcFinal !== (f.fc || '')) {
          const { error } = await supabase.schema(schemaName).from("comprobantes_arca")
            .update({ fc: fcFinal }).eq("id", f.id)
          if (error) throw new Error(error.message)
          actualizadas++
        }
      }
      toast.success(`${actualizadas} factura(s) actualizadas`)
      setModalArchivoAbierto(false)
      setArchivoFacturas([])
      await cargar()
    } catch (err: any) {
      toast.error("Error: " + err.message)
    } finally {
      setArchivoGuardando(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="mr-2 h-6 w-6 animate-spin" /><span>Cargando comprobantes ARCA...</span>
    </div>
  )
  if (error) return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">Error: {error}</div>

  const seleccionadosArray = Array.from(seleccionados)

  return (
    <div className="space-y-4">

      {/* 🧪 La prueba pendiente de esta pantalla aparece acá (A-TEST-1170). */}
      <TestsDelProceso proceso="egresos/asignar-cuenta" pantalla="egresos" />

      {/* 🩺 A-DEC-1021 (6) — errores de datos, ANTES de actuar. Sólo errores: lo que falta asignar no va acá. */}
      {(diag && diag.errores.length > 0 || extractosSinLeer.length > 0) && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 space-y-1">
          {diag && diag.errores.length > 0 && (
            <>
              <p className="font-semibold">⛔ {diag.errores.length} movimiento(s) conciliado(s) no coinciden con su factura — revisalos antes de asignar</p>
              <ul className="text-xs space-y-0.5">
                {diag.errores.slice(0, 15).map((p, i) => {
                  const f = comprobantes.find(c => c.id === p.mov.facturaId)
                  return (
                    <li key={i}>
                      <strong>{TITULO_PROBLEMA[p.tipo]}</strong> · {p.mov.que}: el movimiento {p.detalle}
                      {f && <> — factura de {f.denominacion_emisor ?? "?"} del {f.fecha_emision ?? "?"} por ${fmt(f.imp_total)}</>}
                    </li>
                  )
                })}
                {diag.errores.length > 15 && <li>… y {diag.errores.length - 15} más</li>}
              </ul>
            </>
          )}
          {extractosSinLeer.length > 0 && (
            <p className="text-xs">⚠️ No se pudieron revisar: {extractosSinLeer.join(", ")}. Lo que se vea abajo puede estar incompleto.</p>
          )}
        </div>
      )}

      {/* ── Resumen chips ── */}
      <div className="flex flex-wrap gap-3">
        {(["sin_match","ambiguo","unico","asignado"] as EstadoMatch[]).map(est => (
          <button
            key={est}
            onClick={e => toggleChip(setEstadosVisibles, est, esSoloEste(e))}
            title={tituloChip(ESTADO_CONFIG[est].label)}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all
              ${estadosVisibles.has(est) ? ESTADO_CONFIG[est].bg : "bg-white text-gray-400 border-gray-200 line-through"}`}
          >
            <span>{ESTADO_CONFIG[est].label}</span>
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold">{resumen[est]}</span>
          </button>
        ))}
        {!todosLosEstados && (
          <button className="self-center text-xs text-blue-600 underline" onClick={() => setEstadosVisibles(new Set<EstadoMatch>(["sin_match", "ambiguo", "unico", "asignado"]))}>todos</button>
        )}
        <span className="self-center text-[10px] text-gray-400">{PISTA_CTRL_CLICK}</span>
        {diag && diag.pendientesConciliadas.size > 0 && (
          <button
            onClick={() => setSoloConciliadas(v => !v)}
            title="Facturas sin cuenta que ya están conciliadas: al asignarles la cuenta, viaja también a sus movimientos"
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium bg-purple-100 text-purple-700 border-purple-300
              ${soloConciliadas ? "ring-2 ring-offset-1 ring-gray-400" : "opacity-80 hover:opacity-100"}`}
          >
            <span>🔗 Conciliadas sin cuenta</span>
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold">{diag.pendientesConciliadas.size}</span>
          </button>
        )}
        <span className="ml-auto self-center text-xs text-gray-400">{comprobantes.length} total</span>
        {/* 🗂️ Desactivado 26/10 a pedido del usuario: quedó atrás de lo desarrollado (📎, estados automáticos) → A-FEAT-1374. */}
        <Button size="sm" variant="outline" disabled className="text-gray-400"
          title="En revisión (A-FEAT-1374): quedó desactualizado respecto del 📎 y los estados automáticos. Mientras tanto, usá la columna 📎.">
          <FileCheck className="h-4 w-4 mr-1" />Actualizar Archivo Facturas
        </Button>
        <Button size="sm" variant="ghost" onClick={cargar}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* ── Filtros + acciones bulk ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar emisor, CUIT, cuenta..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        {/* 📅 Fechas de emisión: desde / hasta (A-FEAT-1373) */}
        <div className="flex items-center gap-1 text-xs text-gray-500" title="Fecha de emisión de la factura">
          <span>Emisión</span>
          <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="h-8 w-[140px] text-sm" />
          <span>→</span>
          <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="h-8 w-[140px] text-sm" />
        </div>
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los períodos</SelectItem>
            {periodos.map(p => {
              const [a,m] = p.split("-")
              return <SelectItem key={p} value={p}>{MESES[parseInt(m)-1]} {a}</SelectItem>
            })}
          </SelectContent>
        </Select>

        <Select value={filtroCuenta} onValueChange={setFiltroCuenta}>
          <SelectTrigger className="w-[230px] h-8 text-sm">
            <SelectValue placeholder="Cuenta contable" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="todas">Todas las cuentas</SelectItem>
            {cuentasDisponibles.map(c => (
              <SelectItem key={c.categ} value={c.categ}>
                <span className="flex items-center gap-2 w-full">
                  <span className="flex-1 truncate">{c.categ}</span>
                  <span className="shrink-0 text-xs text-gray-400">{c.count}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(busqueda || filtroPeriodo !== "todos" || !todosLosEstados || filtroCuenta !== "todas" || soloConciliadas || fechaDesde || fechaHasta) && (
          <Button size="sm" variant="ghost" onClick={() => { setBusqueda(""); setFiltroPeriodo("todos"); setEstadosVisibles(new Set<EstadoMatch>(["sin_match", "ambiguo", "unico", "asignado"])); setFiltroCuenta("todas"); setSoloConciliadas(false); setFechaDesde(""); setFechaHasta("") }}>
            <X className="h-3.5 w-3.5 mr-1" />Limpiar
          </Button>
        )}

        {/* Acciones bulk */}
        {seleccionados.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500">{seleccionados.size} selec.</span>
            {unicosFiltrados.length > 0 && (
              <Permisable recurso="egresos.asignar-cuenta"><Button size="sm" variant="outline" onClick={autoAsignarUnicos} className="text-blue-700 border-blue-300"
                title="A cada seleccionada le pone la cuenta que dice el historial de su proveedor (sólo las que son Match)">
                Asignar su match ({unicosFiltrados.length})
              </Button></Permisable>
            )}
            <Permisable recurso="egresos.asignar-cuenta"><Button size="sm" onClick={() => {
              const uniq = [...new Set(seleccionadosArray.map(id => filtrados.find(c=>c.id===id)?.cuenta_contable ?? ""))]
              const cuits = [...new Set(seleccionadosArray.map(id => filtrados.find(c=>c.id===id)?.cuit ?? null).filter(Boolean))]
              const emisores = [...new Set(seleccionadosArray.map(id => filtrados.find(c=>c.id===id)?.denominacion_emisor ?? null).filter(Boolean))]
              abrirModal(seleccionadosArray, uniq.length === 1 ? uniq[0] : "(múltiples cuentas)", cuits.length === 1 ? cuits[0] : null, emisores.length === 1 ? emisores[0] : null)
            }}>
              Asignar cuenta a seleccionadas
            </Button></Permisable>
            <Permisable recurso="egresos.asignar-cuenta"><Button size="sm" variant="outline" onClick={() => quitarAsignacion(seleccionadosArray)}>
              Quitar asignación
            </Button></Permisable>
            <Button size="sm" variant="ghost" onClick={() => setSeleccionados(new Set())}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">{filtrados.length} comprobante(s) · Total: ${fmt(filtrados.reduce((s,c)=>s+(c.imp_total??0),0))}</p>

      {/* ── Tabla ── */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-2 py-2">
                    <Checkbox checked={todosVisible} onCheckedChange={toggleTodos} />
                  </th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Nro. Factura</th>
                  <th className="px-3 py-2 text-left">Emisor</th>
                  <th className="px-3 py-2 text-center" title="Ver la factura">📎</th>
                  <th className="px-3 py-2 text-left">CUIT</th>
                  <th className="px-3 py-2 text-left">Cuenta Contable</th>
                  <th className="px-3 py-2 text-center">Cód.</th>
                  <th className="px-3 py-2 text-center">Estado</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-center">Período</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.length === 0 ? (
                  <tr><td colSpan={12} className="py-8 text-center text-gray-400">Sin resultados</td></tr>
                ) : filtrados.map(c => (
                  <tr key={c.id} className={`${ESTADO_CONFIG[c._estado].rowBg} hover:brightness-95 transition-all`}>
                    <td className="px-2 py-1.5 text-center">
                      <Checkbox checked={seleccionados.has(c.id)} onCheckedChange={() => toggleUno(c.id)} />
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">
                      {c.fecha_emision ? new Date(c.fecha_emision+"T00:00:00").toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-400 font-mono text-[11px]">
                      {c.numero_desde ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 max-w-[150px] truncate" title={c.denominacion_emisor ?? ""}>
                      {c.denominacion_emisor ?? "—"}
                    </td>
                    {/* 📎 La factura, para poder mirarla antes de decidir la cuenta. */}
                    <td className="px-3 py-1.5 text-center">{celdaFactura(c)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-400">{c.cuit ?? "—"}</td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate font-medium" title={c.cuenta_contable ?? ""}>
                      {c.cuenta_contable
                        ?? (c._match.sugerida
                          ? <span className="italic font-normal text-blue-600" title="Sale del historial del proveedor">→ {c._match.sugerida.categ}</span>
                          : c._match.candidatas.length > 1
                            ? <Permisable recurso="egresos.asignar-cuenta"><button type="button" className="italic font-normal text-amber-700 underline decoration-dotted"
                                title={`${c._match.candidatas.map(x => `${x.categ} (${x.usos}×)`).join(" · ")} — click para elegir`}
                                onClick={() => abrirModal([c.id], c.cuenta_contable ?? "", c.cuit, c.denominacion_emisor)}>
                                → {c._match.candidatas.length} opciones</button></Permisable>
                            : <span className="text-gray-300">—</span>)}
                    </td>
                    <td className="px-3 py-1.5 text-center text-gray-400 font-mono">
                      {c.nro_cuenta ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ESTADO_CONFIG[c._estado].bg}`}>
                        {c._estado === "sin_match" && <AlertTriangle className="h-3 w-3" />}
                        {c._estado === "ambiguo"   && <AlertCircle className="h-3 w-3" />}
                        {c._estado === "asignado"  && <CheckCircle className="h-3 w-3" />}
                        {ESTADO_CONFIG[c._estado].label}
                      </span>
                      {(diag?.movimientosPorFactura.get(c.id) ?? 0) > 0 && (
                        <span className="ml-1 text-[10px] text-purple-700" title={`Conciliada: la cuenta viaja a ${diag!.movimientosPorFactura.get(c.id)} movimiento(s)`}>
                          🔗{diag!.movimientosPorFactura.get(c.id)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap font-medium">
                      ${fmt(c.imp_total)}
                    </td>
                    <td className="px-3 py-1.5 text-center whitespace-nowrap text-gray-400">
                      {c.mes_contable && c.año_contable ? `${MESES[c.mes_contable-1]} ${c.año_contable}` : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <Permisable recurso="egresos.asignar-cuenta"><Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                        onClick={() => abrirModal([c.id], c.cuenta_contable ?? "", c.cuit, c.denominacion_emisor)}>
                        {c._estado === "asignado" ? "Cambiar" : "Asignar"}
                      </Button></Permisable>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Modal asignación ── */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Asignar cuenta contable
              {modalIds.length > 1 && <span className="ml-2 text-sm font-normal text-gray-500">({modalIds.length} comprobantes)</span>}
            </DialogTitle>
            {modalEmisor && (
              <p className="text-xs text-gray-500">
                Proveedor: <span className="font-semibold text-gray-700">{modalEmisor}</span>
                {modalCuit && <span className="ml-1 text-gray-400">({modalCuit})</span>}
              </p>
            )}
            {modalCuentaOriginal && (
              <p className="text-xs text-gray-500">
                Cuenta actual: <span className="font-semibold text-gray-700">"{modalCuentaOriginal}"</span>
              </p>
            )}
          </DialogHeader>

          <div className="flex items-center gap-2 text-xs">
            <button type="button" onClick={() => setVerPlan(false)}
              className={`rounded px-2 py-1 border ${!verPlan ? "bg-blue-50 border-blue-300 text-blue-700 font-medium" : "border-gray-200 text-gray-500"}`}>
              Propuestas
            </button>
            <button type="button" onClick={() => setVerPlan(true)}
              className={`rounded px-2 py-1 border ${verPlan ? "bg-blue-50 border-blue-300 text-blue-700 font-medium" : "border-gray-200 text-gray-500"}`}>
              📚 Plan de cuentas completo
            </button>
          </div>

          {verPlan ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              <SelectorCuentaContable
                modo="modal-list"
                cuentasPrecargadas={cuentasDeFacturas.map(c => ({ categ: c.categ, nro_cuenta: c.nro_cuenta as string, cuenta_contable: c.cuenta_contable ?? c.categ, nombre_totalizadora: c.nombre_totalizadora }))}
                cuitProveedor={modalCuit}
                schemaName={schemaName}
                value={cuentaElegida?.categ ?? null}
                onSelect={c => {
                  if (!c) { setCuentaElegida(null); return }
                  const delPlan = cuentasSistema.find(x => x.categ === c.categ)
                  setCuentaElegida(delPlan ?? { categ: c.categ, nro_cuenta: c.nro_cuenta ?? null, cuenta_contable: c.cuenta_contable ?? null, imputable: true, nombre_totalizadora: c.nombre_totalizadora ?? null })
                }}
              />
            </div>
          ) : (
          <>
          {/* Buscador libre */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar por nombre o código de cuenta..."
              value={busquedaModal} onChange={e => setBusquedaModal(e.target.value)}
              className="pl-8" autoFocus />
          </div>

          {/* Lista sugerencias */}
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {loadingSugerencias ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando sugerencias...
              </div>
            ) : sugerenciasFiltradas.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">Sin coincidencias</p>
            ) : (
              sugerenciasFiltradas.map((sug, i) => {
                // Por nombre: varias cuentas sin número compartían «null» y se marcaban todas juntas.
                const elegida = cuentaElegida?.categ === sug.categ
                const fuenteLabel: Record<string, string> = {
                  historial_historico: "Historial histórico",
                  historial_arca: "Historial ARCA",
                  exacto: "Match exacto",
                  nombre_similar: "Nombre similar",
                }
                return (
                  <button key={i} onClick={() => setCuentaElegida(sug)}
                    className={`w-full text-left flex items-center gap-3 rounded-lg border px-3 py-2 transition-all
                      ${elegida ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300" : "border-gray-200 hover:bg-gray-50"}`}>
                    <div className="flex-1 min-w-0">
                      {sug.nombre_totalizadora && (
                        <p className="text-[10px] text-gray-400 mb-0.5 truncate">{sug.nombre_totalizadora}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{sug.categ}</span>
                        <span className="shrink-0 font-mono text-xs text-gray-400 bg-gray-100 rounded px-1">{sug.nro_cuenta ?? "s/n"}</span>
                        <span className={`shrink-0 text-[10px] rounded px-1.5 py-0.5 font-medium
                          ${sug.fuente === "historial_historico" || sug.fuente === "historial_arca" ? "bg-green-100 text-green-700" :
                            sug.fuente === "exacto" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                          {fuenteLabel[sug.fuente]}{sug.usos ? ` (${sug.usos}x)` : ""}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{sug.cuenta_contable}</p>
                    </div>
                    {elegida && <CheckCircle className="h-4 w-4 text-blue-500 shrink-0" />}
                  </button>
                )
              })
            )}
          </div>

          </>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 border-t pt-3">
            {cuentaElegida && (
              <div className="flex-1 text-xs text-gray-600">
                Seleccionada: <strong>{cuentaElegida.categ}</strong> · {cuentaElegida.nro_cuenta ?? "sin número"}
              </div>
            )}
            <Button variant="ghost" onClick={() => setModalAbierto(false)}>Cancelar</Button>
            <Button disabled={!cuentaElegida || guardando} onClick={guardarAsignacion}>
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar asignación
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Actualizar Archivo Facturas ── */}
      <Dialog open={modalArchivoAbierto} onOpenChange={(open) => { setModalArchivoAbierto(open); if (!open) { setArchivoFacturas([]); setArchivoPeriodo("") } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Actualizar Archivo Facturas</DialogTitle>
            <p className="text-xs text-gray-500">Marcar si se recibió el comprobante físico (FC) para cada factura del período</p>
          </DialogHeader>

          {/* Selector de período */}
          <div className="flex items-center gap-3">
            <Select value={archivoPeriodo} onValueChange={(val) => { setArchivoPeriodo(val); cargarFacturasArchivo(val) }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Seleccionar período..." />
              </SelectTrigger>
              <SelectContent>
                {periodos.map(p => {
                  const [a, m] = p.split("-")
                  return <SelectItem key={p} value={p}>{MESES[parseInt(m) - 1]} {a}</SelectItem>
                })}
              </SelectContent>
            </Select>
            {archivoFacturas.length > 0 && (
              <span className="text-xs text-gray-400">{archivoFacturas.length} factura(s)</span>
            )}
          </div>

          {/* Tabla facturas */}
          {archivoFacturas.length > 0 && (
            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Proveedor</th>
                    <th className="px-3 py-2 text-right">Imp. Total</th>
                    <th className="px-3 py-2 text-center w-[120px]">FC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {archivoFacturas.map((f, idx) => (
                    <tr key={f.id} className={f.fcLocal === 'Buscar' ? 'bg-amber-50' : ''}>
                      <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">
                        {f.fecha_emision ? new Date(f.fecha_emision + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                      </td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate" title={f.denominacion_emisor ?? ""}>
                        {f.denominacion_emisor ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap font-medium">${fmt(f.imp_total)}</td>
                      <td className="px-3 py-1.5 text-center">
                        <select
                          className={`border rounded px-2 py-1 text-xs w-[100px] ${f.fcLocal === 'Buscar' ? 'border-amber-300 bg-amber-50' : ''}`}
                          value={f.fcLocal}
                          onChange={(e) => {
                            setArchivoFacturas(prev => prev.map((x, i) => i === idx ? { ...x, fcLocal: e.target.value } : x))
                          }}
                        >
                          {opcionesFcManual(f.fc, esAdmin).map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {archivoPeriodo && archivoFacturas.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">No hay facturas imputadas a este período</p>
          )}

          {/* Footer */}
          {archivoFacturas.length > 0 && (
            <div className="flex items-center gap-3 border-t pt-3">
              <p className="flex-1 text-xs text-gray-500">
                Las que no marques quedan en <strong>Buscar</strong> (no la tengo)
              </p>
              <Button variant="ghost" onClick={() => setModalArchivoAbierto(false)}>Cancelar</Button>
              <Button disabled={archivoGuardando} onClick={guardarArchivoFC}>
                {archivoGuardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
