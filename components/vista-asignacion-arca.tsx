"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, AlertTriangle, CheckCircle, Search, AlertCircle, X, RefreshCw } from "lucide-react"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CuentaSistema {
  categ: string
  nro_cuenta: string
  cuenta_contable: string
  imputable: boolean
  nombre_totalizadora: string | null
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
}

type EstadoMatch = "asignado" | "unico" | "ambiguo" | "sin_match"

interface Sugerencia {
  categ: string
  nro_cuenta: string
  cuenta_contable: string
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

function calcularEstado(
  row: ComprobanteArca,
  matchMap: Map<string, CuentaSistema[]>
): EstadoMatch {
  if (row.nro_cuenta) return "asignado"
  const key = normalize(row.cuenta_contable ?? "")
  if (!key) return "sin_match"
  const matches = matchMap.get(key) ?? []
  if (matches.length === 0) return "sin_match"
  if (matches.length === 1) return "unico"
  return "ambiguo"
}

const ESTADO_CONFIG: Record<EstadoMatch, { label: string; color: string; bg: string; rowBg: string }> = {
  asignado: { label: "Asignado",  color: "text-green-700",  bg: "bg-green-100 text-green-700 border-green-300",   rowBg: "" },
  unico:    { label: "Match",     color: "text-blue-700",   bg: "bg-blue-100 text-blue-700 border-blue-300",      rowBg: "" },
  ambiguo:  { label: "Ambiguo",   color: "text-amber-700",  bg: "bg-amber-100 text-amber-700 border-amber-300",   rowBg: "bg-amber-50" },
  sin_match:{ label: "Sin match", color: "text-orange-700", bg: "bg-orange-100 text-orange-700 border-orange-300", rowBg: "bg-orange-50" },
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function VistaAsignacionArca({ empresa = 'MSA' }: { empresa?: 'MSA' | 'PAM' } = {}) {
  const schemaName = empresa === 'PAM' ? 'pam' : 'msa'
  const [comprobantes, setComprobantes] = useState<ComprobanteArca[]>([])
  const [cuentasSistema, setCuentasSistema] = useState<CuentaSistema[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<EstadoMatch | "todos">("todos")
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos")
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
  const [cuentaElegida, setCuentaElegida] = useState<CuentaSistema | null>(null)
  const [guardando, setGuardando] = useState(false)

  // ── Carga de datos ────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: arca, error: e1 }, { data: ctas, error: e2 }] = await Promise.all([
        supabase.schema(schemaName).from("comprobantes_arca")
          .select("id,fecha_emision,cuit,denominacion_emisor,imp_neto_gravado,iva,imp_total,cuenta_contable,nro_cuenta,año_contable,mes_contable")
          .order("fecha_emision", { ascending: false }),
        supabase.from("cuentas_contables")
          .select("categ,nro_cuenta,cuenta_contable,imputable,nombre_totalizadora")
          .order("nro_cuenta"),
      ])
      if (e1) throw new Error(e1.message)
      if (e2) throw new Error(e2.message)
      setComprobantes((arca ?? []) as ComprobanteArca[])
      setCuentasSistema((ctas ?? []) as CuentaSistema[])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Map normalizado: normalize(categ) → CuentaSistema[] ──────────────────

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

  const conEstado = useMemo(() =>
    comprobantes.map(c => ({ ...c, _estado: calcularEstado(c, matchMap) })),
    [comprobantes, matchMap]
  )

  // ── Resumen estados ───────────────────────────────────────────────────────

  const resumen = useMemo(() => {
    const r: Record<EstadoMatch, number> = { asignado: 0, unico: 0, ambiguo: 0, sin_match: 0 }
    conEstado.forEach(c => r[c._estado]++)
    return r
  }, [conEstado])

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

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return conEstado.filter(c => {
      if (filtroEstado !== "todos" && c._estado !== filtroEstado) return false
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
  }, [conEstado, filtroEstado, filtroPeriodo, filtroCuenta, busqueda])

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

  async function guardarAsignacion() {
    if (!cuentaElegida) return
    setGuardando(true)
    try {
      const res = await fetch("/api/arca-asignar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: modalIds,
          nro_cuenta: cuentaElegida.nro_cuenta,
          cuenta_contable: cuentaElegida.categ,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setModalAbierto(false)
      setSeleccionados(new Set())
      await cargar()
    } catch (err: any) {
      alert("Error al guardar: " + err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function quitarAsignacion(ids: string[]) {
    if (!confirm(`¿Quitar la asignación de ${ids.length} comprobante(s)?`)) return
    await fetch("/api/arca-asignar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, nro_cuenta: null, cuenta_contable: null }),
    })
    setSeleccionados(new Set())
    await cargar()
  }

  // ── Auto-asignar únicos ───────────────────────────────────────────────────

  async function autoAsignarUnicos() {
    const unicos = conEstado.filter(c => c._estado === "unico")
    if (unicos.length === 0) return
    if (!confirm(`¿Auto-asignar ${unicos.length} comprobantes con match único?`)) return
    const updates = unicos.map(c => {
      const cta = matchMap.get(normalize(c.cuenta_contable ?? ""))![0]
      return fetch("/api/arca-asignar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [c.id], nro_cuenta: cta.nro_cuenta, cuenta_contable: cta.categ }),
      })
    })
    await Promise.all(updates)
    await cargar()
  }

  // ── Sugerencias filtradas en modal ────────────────────────────────────────

  const sugerenciasFiltradas = useMemo(() => {
    if (!busquedaModal) return sugerencias
    const q = normalize(busquedaModal)
    return cuentasSistema
      .filter(c => normalize(c.categ).includes(q) || normalize(c.cuenta_contable).includes(q) || c.nro_cuenta.includes(busquedaModal))
      .map(c => ({ ...c, score: fuzzyScore(busquedaModal, c.categ), fuente: "nombre_similar" as const }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
  }, [busquedaModal, sugerencias, cuentasSistema])

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

      {/* ── Resumen chips ── */}
      <div className="flex flex-wrap gap-3">
        {(["sin_match","ambiguo","unico","asignado"] as EstadoMatch[]).map(est => (
          <button
            key={est}
            onClick={() => setFiltroEstado(filtroEstado === est ? "todos" : est)}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all
              ${filtroEstado === est ? "ring-2 ring-offset-1 ring-gray-400" : "opacity-80 hover:opacity-100"}
              ${ESTADO_CONFIG[est].bg}`}
          >
            <span>{ESTADO_CONFIG[est].label}</span>
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold">{resumen[est]}</span>
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-gray-400">{comprobantes.length} total</span>
        {resumen.unico > 0 && (
          <Button size="sm" variant="outline" onClick={autoAsignarUnicos} className="text-blue-700 border-blue-300">
            Auto-asignar {resumen.unico} con match único
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={cargar}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* ── Filtros + acciones bulk ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar emisor, CUIT, cuenta..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)} className="pl-8 h-8 text-sm" />
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

        {(busqueda || filtroPeriodo !== "todos" || filtroEstado !== "todos" || filtroCuenta !== "todas") && (
          <Button size="sm" variant="ghost" onClick={() => { setBusqueda(""); setFiltroPeriodo("todos"); setFiltroEstado("todos"); setFiltroCuenta("todas") }}>
            <X className="h-3.5 w-3.5 mr-1" />Limpiar
          </Button>
        )}

        {/* Acciones bulk */}
        {seleccionados.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500">{seleccionados.size} selec.</span>
            <Button size="sm" onClick={() => {
              const uniq = [...new Set(seleccionadosArray.map(id => filtrados.find(c=>c.id===id)?.cuenta_contable ?? ""))]
              const cuits = [...new Set(seleccionadosArray.map(id => filtrados.find(c=>c.id===id)?.cuit ?? null).filter(Boolean))]
              const emisores = [...new Set(seleccionadosArray.map(id => filtrados.find(c=>c.id===id)?.denominacion_emisor ?? null).filter(Boolean))]
              abrirModal(seleccionadosArray, uniq.length === 1 ? uniq[0] : "(múltiples cuentas)", cuits.length === 1 ? cuits[0] : null, emisores.length === 1 ? emisores[0] : null)
            }}>
              Asignar cuenta a seleccionadas
            </Button>
            <Button size="sm" variant="outline" onClick={() => quitarAsignacion(seleccionadosArray)}>
              Quitar asignación
            </Button>
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
                  <th className="px-3 py-2 text-left">Emisor</th>
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
                  <tr><td colSpan={10} className="py-8 text-center text-gray-400">Sin resultados</td></tr>
                ) : filtrados.map(c => (
                  <tr key={c.id} className={`${ESTADO_CONFIG[c._estado].rowBg} hover:brightness-95 transition-all`}>
                    <td className="px-2 py-1.5 text-center">
                      <Checkbox checked={seleccionados.has(c.id)} onCheckedChange={() => toggleUno(c.id)} />
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">
                      {c.fecha_emision ? new Date(c.fecha_emision+"T00:00:00").toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td className="px-3 py-1.5 max-w-[150px] truncate" title={c.denominacion_emisor ?? ""}>
                      {c.denominacion_emisor ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-400">{c.cuit ?? "—"}</td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate font-medium" title={c.cuenta_contable ?? ""}>
                      {c.cuenta_contable ?? <span className="text-gray-300">—</span>}
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
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap font-medium">
                      ${fmt(c.imp_total)}
                    </td>
                    <td className="px-3 py-1.5 text-center whitespace-nowrap text-gray-400">
                      {c.mes_contable && c.año_contable ? `${MESES[c.mes_contable-1]} ${c.año_contable}` : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                        onClick={() => abrirModal([c.id], c.cuenta_contable ?? "", c.cuit, c.denominacion_emisor)}>
                        {c._estado === "asignado" ? "Cambiar" : "Asignar"}
                      </Button>
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
                const elegida = cuentaElegida?.nro_cuenta === sug.nro_cuenta
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
                        <span className="shrink-0 font-mono text-xs text-gray-400 bg-gray-100 rounded px-1">{sug.nro_cuenta}</span>
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

          {/* Footer */}
          <div className="flex items-center gap-3 border-t pt-3">
            {cuentaElegida && (
              <div className="flex-1 text-xs text-gray-600">
                Seleccionada: <strong>{cuentaElegida.categ}</strong> · {cuentaElegida.nro_cuenta}
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
    </div>
  )
}
