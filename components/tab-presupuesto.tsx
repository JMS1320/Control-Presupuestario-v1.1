"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronDown, Loader2, TrendingDown } from "lucide-react"

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

// ── Componente principal ──────────────────────────────────────────────────────

export function TabPresupuesto() {
  const [cargando, setCargando] = useState(true)
  const [agrupadores, setAgrupadores] = useState<Agrupador[]>([])
  const [sueldoFilas, setSueldoFilas] = useState<FilaSueldo[]>([])
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  const meses = useMemo(() => getMeses(13), []) // mes actual + 12 siguientes

  // ── Carga de datos ──────────────────────────────────────────────────────────

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    try {
      await Promise.all([cargarTemplates(), cargarSueldos()])
    } finally {
      setCargando(false)
    }
  }

  const cargarTemplates = async () => {
    // Traer templates activos MSA (responsable contiene MSA)
    const { data: templates } = await supabase
      .from("egresos_sin_factura")
      .select("id, nombre_referencia, categ, cuenta_agrupadora, responsable")
      .eq("activo", true)
      .or("responsable.ilike.%MSA%,responsable.eq.ambas")
      .not("cuenta_agrupadora", "is", null)
      .order("cuenta_agrupadora")

    if (!templates || templates.length === 0) return

    const templateIds = templates.map(t => t.id)

    // Rango de fechas: primer día del mes actual → último día del mes 12
    const primerMes = meses[0]
    const ultimoMes = meses[meses.length - 1]
    const fechaDesde = `${primerMes.anio}-${String(primerMes.mes).padStart(2,"0")}-01`
    const fechaHasta = `${ultimoMes.anio}-${String(ultimoMes.mes).padStart(2,"0")}-31`

    // Traer cuotas del período
    const { data: cuotas } = await supabase
      .from("cuotas_egresos_sin_factura")
      .select("egreso_id, fecha_estimada, fecha_vencimiento, monto, estado")
      .in("egreso_id", templateIds)
      .gte("fecha_estimada", fechaDesde)
      .lte("fecha_estimada", fechaHasta)
      .neq("estado", "desactivado")
      .neq("estado", "conciliado")

    // Armar mapa egreso_id → { "YYYY-MM": suma_montos }
    const mapaMontos: Record<string, Record<string, number>> = {}
    for (const c of cuotas || []) {
      const fecha = c.fecha_estimada || c.fecha_vencimiento
      if (!fecha) continue
      const clave = fecha.slice(0, 7) // "YYYY-MM"
      if (!mapaMontos[c.egreso_id]) mapaMontos[c.egreso_id] = {}
      mapaMontos[c.egreso_id][clave] = (mapaMontos[c.egreso_id][clave] || 0) + Number(c.monto || 0)
    }

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
      totales[clave] = suma
    }
    return totales
  }, [agrupadores, sueldoFilas, meses])

  const totalSueldosPorMes = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      totales[clave] = sueldoFilas.reduce((s, f) => s + (f.montos[clave] || 0), 0)
    }
    return totales
  }, [sueldoFilas, meses])

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
          <p className="text-sm text-gray-500">Proyección por templates · {meses[0].label} – {meses[meses.length-1].label}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toggleTodos(true)}>Expandir todo</Button>
          <Button variant="outline" size="sm" onClick={() => toggleTodos(false)}>Colapsar todo</Button>
        </div>
      </div>

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

                      {/* Filas de templates hijos */}
                      {expandido && ag.templates.map(t => (
                        <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-gray-600 text-xs">
                            {t.nombre}
                            <span className="ml-2 text-gray-400">{t.categ}</span>
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
                                {fmt(t.montos[clave] || 0)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
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
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-blue-100 border border-blue-300 rounded-sm"></span>
          Mes actual
        </span>
        <span>· Montos en pesos · Solo templates activos con responsable MSA</span>
        <Badge variant="outline" className="text-xs">Fase 1 — solo templates + sueldos</Badge>
      </div>
    </div>
  )
}
