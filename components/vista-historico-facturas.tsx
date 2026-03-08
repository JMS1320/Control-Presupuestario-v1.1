"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertTriangle, CheckCircle, Search, Archive } from "lucide-react"

interface ComprobantHistorico {
  id: string
  fecha: string | null
  tipo: string | null
  punto_de_venta: number | null
  numero_desde: number | null
  nro_doc_emisor: string | null
  denominacion_emisor: string | null
  imp_neto_gravado: number
  imp_neto_no_gravado: number
  imp_op_exentas: number
  percepcion_iibb: number
  percepcion_iva: number
  otros_tributos: number
  iva: number
  imp_total: number
  fc: string | null
  cuenta_contable: string | null
  anio_contable: number | null
  mes_contable: number | null
  empresa: string | null
}

interface ResumenCuenta {
  cuenta_contable: string
  facturas: number
  total_importe: number
  existe_en_sistema: boolean
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

function formatMoneda(n: number): string {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function VistaHistoricoFacturas() {
  const [comprobantes, setComprobantes] = useState<ComprobantHistorico[]>([])
  const [resumenCuentas, setResumenCuentas] = useState<ResumenCuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filtroCuenta, setFiltroCuenta] = useState<string>("todas")
  const [filtroMatch, setFiltroMatch] = useState<"todas" | "sin_match" | "con_match">("todas")
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("todos")
  const [busqueda, setBusqueda] = useState("")

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Cargar resumen de cuentas con match
      const { data: resumen, error: errResumen } = await supabase
        .schema("msa")
        .rpc("resumen_historico_cuentas" as any)

      // Si no existe la función RPC, hacemos la query manualmente
      // Primero traemos cuentas contables del sistema
      const { data: cuentasSistema } = await supabase
        .from("cuentas_contables")
        .select("categ")

      const categsSistema = new Set((cuentasSistema ?? []).map((c: any) => c.categ?.toUpperCase().trim()))

      // 2. Cargar todos los comprobantes históricos
      const { data: rows, error: errRows } = await supabase
        .schema("msa")
        .from("comprobantes_historico")
        .select("*")
        .order("fecha", { ascending: false })

      if (errRows) throw new Error(errRows.message)

      const data = (rows ?? []) as ComprobantHistorico[]
      setComprobantes(data)

      // Construir resumen de cuentas
      const mapaResumen: Record<string, ResumenCuenta> = {}
      for (const row of data) {
        const key = row.cuenta_contable ?? "(sin cuenta)"
        if (!mapaResumen[key]) {
          mapaResumen[key] = {
            cuenta_contable: key,
            facturas: 0,
            total_importe: 0,
            existe_en_sistema: categsSistema.has(key.toUpperCase().trim()),
          }
        }
        mapaResumen[key].facturas++
        mapaResumen[key].total_importe += row.imp_total ?? 0
      }

      // Ordenar: primero las que NO existen, luego por cantidad de facturas desc
      const resumenOrdenado = Object.values(mapaResumen).sort((a, b) => {
        if (a.existe_en_sistema !== b.existe_en_sistema) return a.existe_en_sistema ? 1 : -1
        return b.facturas - a.facturas
      })
      setResumenCuentas(resumenOrdenado)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // Períodos disponibles
  const periodosDisponibles = Array.from(
    new Set(
      comprobantes
        .filter((c) => c.anio_contable && c.mes_contable)
        .map((c) => `${c.anio_contable}-${String(c.mes_contable).padStart(2, "0")}`)
    )
  ).sort()

  // Cuentas disponibles para filtro
  const cuentasDisponibles = Array.from(
    new Set(comprobantes.map((c) => c.cuenta_contable ?? "(sin cuenta)"))
  ).sort()

  // Cuentas sin match (para el resumen superior)
  const cuentasSinMatch = resumenCuentas.filter((r) => !r.existe_en_sistema)
  const cuentasConMatch = resumenCuentas.filter((r) => r.existe_en_sistema)

  // Filtrar comprobantes
  const cuentasConMatchSet = new Set(resumenCuentas.filter((r) => r.existe_en_sistema).map((r) => r.cuenta_contable))

  const comprobantesFiltrados = comprobantes.filter((c) => {
    const cuenta = c.cuenta_contable ?? "(sin cuenta)"
    const tieneMatch = cuentasConMatchSet.has(cuenta)

    if (filtroMatch === "sin_match" && tieneMatch) return false
    if (filtroMatch === "con_match" && !tieneMatch) return false
    if (filtroCuenta !== "todas" && cuenta !== filtroCuenta) return false
    if (filtroPeriodo !== "todos") {
      const periodo = `${c.anio_contable}-${String(c.mes_contable).padStart(2, "0")}`
      if (periodo !== filtroPeriodo) return false
    }
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (
        !c.denominacion_emisor?.toLowerCase().includes(q) &&
        !c.nro_doc_emisor?.includes(q) &&
        !cuenta.toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  const totalFiltrado = comprobantesFiltrados.reduce((s, c) => s + (c.imp_total ?? 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span>Cargando histórico...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Panel principal: cuentas sin match */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            Cuentas sin match en el sistema ({cuentasSinMatch.length})
            <span className="ml-auto text-sm font-normal text-orange-600">
              {cuentasSinMatch.reduce((s, c) => s + c.facturas, 0)} facturas ·{" "}
              ${formatMoneda(cuentasSinMatch.reduce((s, c) => s + c.total_importe, 0))}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cuentasSinMatch.length === 0 ? (
            <p className="text-sm text-green-700">Todas las cuentas coinciden con el sistema.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cuentasSinMatch.map((c) => (
                <button
                  key={c.cuenta_contable}
                  onClick={() => {
                    setFiltroCuenta(c.cuenta_contable)
                    setFiltroMatch("todas")
                  }}
                  className="flex items-center justify-between rounded border border-orange-300 bg-white px-3 py-2 text-left text-sm hover:bg-orange-100 transition-colors"
                >
                  <span className="font-medium text-orange-900 truncate pr-2">{c.cuenta_contable}</span>
                  <div className="flex shrink-0 gap-2 text-xs text-orange-700">
                    <span>{c.facturas} fc</span>
                    <span>${formatMoneda(c.total_importe)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen cuentas con match (colapsado) */}
      <details className="rounded border border-green-200">
        <summary className="flex cursor-pointer items-center gap-2 bg-green-50 px-4 py-2 text-sm text-green-800 font-medium">
          <CheckCircle className="h-4 w-4" />
          Cuentas con match en el sistema ({cuentasConMatch.length}) —{" "}
          {cuentasConMatch.reduce((s, c) => s + c.facturas, 0)} facturas
        </summary>
        <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {cuentasConMatch.map((c) => (
            <button
              key={c.cuenta_contable}
              onClick={() => setFiltroCuenta(c.cuenta_contable)}
              className="flex items-center justify-between rounded border border-green-200 bg-white px-3 py-1.5 text-left text-sm hover:bg-green-50 transition-colors"
            >
              <span className="text-green-900 truncate pr-2">{c.cuenta_contable}</span>
              <span className="shrink-0 text-xs text-green-700">{c.facturas} fc</span>
            </button>
          ))}
        </div>
      </details>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar emisor, CUIT, cuenta..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Match */}
            <Select value={filtroMatch} onValueChange={(v) => setFiltroMatch(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Match sistema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las cuentas</SelectItem>
                <SelectItem value="sin_match">Sin match</SelectItem>
                <SelectItem value="con_match">Con match</SelectItem>
              </SelectContent>
            </Select>

            {/* Período */}
            <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los períodos</SelectItem>
                {periodosDisponibles.map((p) => {
                  const [a, m] = p.split("-")
                  return (
                    <SelectItem key={p} value={p}>
                      {MESES[parseInt(m) - 1]} {a}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {/* Cuenta específica */}
            <Select value={filtroCuenta} onValueChange={setFiltroCuenta}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Cuenta contable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las cuentas</SelectItem>
                {cuentasDisponibles.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reset */}
            {(filtroCuenta !== "todas" || filtroMatch !== "todas" || filtroPeriodo !== "todos" || busqueda) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFiltroCuenta("todas"); setFiltroMatch("todas"); setFiltroPeriodo("todos"); setBusqueda("") }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          <p className="mt-2 text-xs text-gray-500">
            {comprobantesFiltrados.length} comprobante{comprobantesFiltrados.length !== 1 ? "s" : ""} ·
            Total: ${formatMoneda(totalFiltrado)}
          </p>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Fecha</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Tipo</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Emisor</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">CUIT</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Cuenta Contable</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">FC</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Neto Gravado</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">IVA</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Total</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">Período</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comprobantesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-400">
                      No hay comprobantes con los filtros aplicados
                    </td>
                  </tr>
                ) : (
                  comprobantesFiltrados.map((c) => {
                    const cuenta = c.cuenta_contable ?? "(sin cuenta)"
                    const tieneMatch = cuentasConMatchSet.has(cuenta)
                    return (
                      <tr
                        key={c.id}
                        className={tieneMatch ? "hover:bg-gray-50" : "bg-orange-50 hover:bg-orange-100"}
                      >
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">
                          {c.fecha
                            ? new Date(c.fecha + "T00:00:00").toLocaleDateString("es-AR")
                            : "—"}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600 max-w-[120px] truncate">
                          {c.tipo ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 max-w-[180px] truncate" title={c.denominacion_emisor ?? ""}>
                          {c.denominacion_emisor ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">
                          {c.nro_doc_emisor ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 max-w-[200px] truncate">
                          {tieneMatch ? (
                            <span className="text-gray-700">{cuenta}</span>
                          ) : (
                            <span className="font-semibold text-orange-700 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {cuenta}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {c.fc ? (
                            <Badge
                              variant="outline"
                              className={
                                c.fc === "SI"
                                  ? "border-green-300 text-green-700 text-[10px]"
                                  : c.fc === "PEAJE"
                                  ? "border-blue-300 text-blue-700 text-[10px]"
                                  : "border-gray-300 text-gray-500 text-[10px]"
                              }
                            >
                              {c.fc}
                            </Badge>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap text-gray-700">
                          {c.imp_neto_gravado ? `$${formatMoneda(c.imp_neto_gravado)}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap text-gray-700">
                          {c.iva ? `$${formatMoneda(c.iva)}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap font-medium">
                          {c.imp_total ? `$${formatMoneda(c.imp_total)}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-center whitespace-nowrap text-gray-500">
                          {c.mes_contable && c.anio_contable
                            ? `${MESES[c.mes_contable - 1]} ${c.anio_contable}`
                            : "—"}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
