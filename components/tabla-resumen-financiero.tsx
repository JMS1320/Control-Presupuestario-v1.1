"use client"

import React, { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatNumber, getMonthName } from "@/lib/format"
import type { ResumenFinanciero } from "@/hooks/useFinancialData"
import { moverAgrupadora, ordenarAgrupadoras, rotuloAgrupadora } from "@/lib/dashboard/orden"

interface TablaResumenFinancieroProps {
  resumen?: ResumenFinanciero[]
  mostrarDecimales: boolean
  /**
   * 🖨️ JMS 22/11: «el print debe salir con un formato preestablecido y no depender de lo que tengo colapsado o abierto…
   * poder ver cada cuenta que integra ventas y compras». Con esto, todo abierto: cada grupo con su total y debajo sus cuentas.
   */
  todoAbierto?: boolean
  /** 🔀 El orden de los grupos que dejó el usuario (`seccion:agrupadora`). */
  orden?: string[] | null
  /** Si viene, los grupos se reordenan arrastrándolos y esto recibe el orden nuevo (lo guarda quien llama). */
  onReordenar?: (orden: string[]) => void
}

type SeccionKey = "ingresos" | "egresos" | "financieros" | "distribuciones"

const SECCIONES: Array<{
  key: SeccionKey
  titulo: string
  totalKey: "totalIngresos" | "totalEgresos" | "totalFinancieros" | "totalDistribuciones"
  claseTitulo: string
  claseTextoTitulo: string
  claseSubtotal: string
}> = [
  { key: "ingresos", titulo: "INGRESOS", totalKey: "totalIngresos", claseTitulo: "bg-green-50", claseTextoTitulo: "text-green-800", claseSubtotal: "bg-green-100" },
  { key: "egresos", titulo: "EGRESOS", totalKey: "totalEgresos", claseTitulo: "bg-red-50", claseTextoTitulo: "text-red-800", claseSubtotal: "bg-red-100" },
  { key: "financieros", titulo: "FINANCIEROS", totalKey: "totalFinancieros", claseTitulo: "bg-yellow-50", claseTextoTitulo: "text-yellow-800", claseSubtotal: "bg-yellow-100" },
  { key: "distribuciones", titulo: "DISTRIBUCIONES", totalKey: "totalDistribuciones", claseTitulo: "bg-purple-50", claseTextoTitulo: "text-purple-800", claseSubtotal: "bg-purple-100" },
]

export function TablaResumenFinanciero({ resumen, mostrarDecimales, todoAbierto = false, orden = null, onReordenar }: TablaResumenFinancieroProps) {
  const [arrastrando, setArrastrando] = useState<{ seccion: SeccionKey; agrupadora: string } | null>(null)
  const [encima, setEncima] = useState<{ clave: string; lado: "antes" | "despues" } | null>(null)
  const reordenable = !!onReordenar && !todoAbierto
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // Para cada sección, calcular las agrupadoras presentes (orden alfabético, con "(Sin agrupar)" y "(Sin clasificar)" al final)
  const agrupadorasPorSeccion = useMemo(() => {
    const out: Record<SeccionKey, string[]> = { ingresos: [], egresos: [], financieros: [], distribuciones: [] }
    if (!resumen) return out
    SECCIONES.forEach(s => {
      const set = new Set<string>()
      resumen.forEach(mes => {
        Object.keys(mes[s.key]).forEach(a => set.add(a))
      })
      // 🔀 El orden del usuario (lo que no ordenó, por nombre; «(Sin agrupar)» / «(Sin clasificar)» al final)
      out[s.key] = ordenarAgrupadoras(s.key, set, orden)
    })
    return out
  }, [resumen, orden])

  // Todas las claves expandibles (para botón "Expandir todo")
  const todasLasClavesExpandibles = useMemo(() => {
    if (!resumen) return new Set<string>()
    const set = new Set<string>()
    SECCIONES.forEach(s => {
      agrupadorasPorSeccion[s.key].forEach(agrup => {
        // Solo expandible si tiene >1 sub-categoría o la sub-categoría no coincide con el nombre
        const subsSet = new Set<string>()
        resumen.forEach(mes => Object.keys(mes.subCategorias?.[agrup] || {}).forEach(d => subsSet.add(d)))
        // Sólo se despliega con más de una cuenta: con una sola, va «Agrupadora (cuenta)» en un renglón (JMS 22/11)
        if (subsSet.size > 1) {
          set.add(`${s.key}:${agrup}`)
        }
      })
    })
    return set
  }, [resumen, agrupadorasPorSeccion])

  const expandirTodo = () => setExpandidos(new Set(todasLasClavesExpandibles))
  const colapsarTodo = () => setExpandidos(new Set())

  const toggleExpand = (clave: string) => {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(clave)) next.delete(clave)
      else next.add(clave)
      return next
    })
  }

  if (!resumen || resumen.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Resumen Financiero Mensual</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">No hay datos para mostrar</p></CardContent>
      </Card>
    )
  }

  // Totales del período + promedios
  const totalesPeriodo = resumen.reduce(
    (acc, mes) => ({
      ingresos: acc.ingresos + mes.totalIngresos,
      egresos: acc.egresos + mes.totalEgresos,
      financieros: acc.financieros + mes.totalFinancieros,
      distribuciones: acc.distribuciones + mes.totalDistribuciones,
      saldo: acc.saldo + mes.saldoMensual,
    }),
    { ingresos: 0, egresos: 0, financieros: 0, distribuciones: 0, saldo: 0 },
  )

  const promedios = {
    ingresos: totalesPeriodo.ingresos / resumen.length,
    egresos: totalesPeriodo.egresos / resumen.length,
    financieros: totalesPeriodo.financieros / resumen.length,
    distribuciones: totalesPeriodo.distribuciones / resumen.length,
    saldo: totalesPeriodo.saldo / resumen.length,
  }

  let saldoAcumulado = 0

  const getColorClass = (value: number) => {
    if (value > 0) return "text-green-600"
    if (value < 0) return "text-red-600"
    return ""
  }

  // Render una agrupadora + sus sub-categorías expandidas si corresponde
  const renderAgrupadora = (seccion: SeccionKey, agrupadora: string) => {
    const clave = `${seccion}:${agrupadora}`
    const expandible = todasLasClavesExpandibles.has(clave)
    const expandido = todoAbierto || expandidos.has(clave)

    // Calcular sub-categorías para esta agrupadora
    const subsSet = new Set<string>()
    resumen.forEach(mes => Object.keys(mes.subCategorias?.[agrupadora] || {}).forEach(d => subsSet.add(d)))
    const subs = Array.from(subsSet).sort((a, b) => a.localeCompare(b, "es"))

    const totalPeriodo = resumen.reduce((s, mes) => s + (mes[seccion][agrupadora] || 0), 0)
    const promPeriodo = totalPeriodo / resumen.length
    const rotulo = rotuloAgrupadora(agrupadora, subs)
    const movible = reordenable && !agrupadora.startsWith("(")
    const marca = encima?.clave === clave && arrastrando?.agrupadora !== agrupadora ? encima.lado : null

    return (
      <React.Fragment key={`${seccion}-${agrupadora}`}>
        <TableRow suppressHydrationWarning
          draggable={movible}
          onDragStart={movible ? (e) => { e.dataTransfer.setData("text/plain", clave); e.dataTransfer.effectAllowed = "move"; setArrastrando({ seccion, agrupadora }) } : undefined}
          onDragEnd={() => { setArrastrando(null); setEncima(null) }}
          onDragOver={(e) => {
            if (!arrastrando || arrastrando.seccion !== seccion || !movible) return // sólo dentro de la misma sección
            e.preventDefault()
            const r = e.currentTarget.getBoundingClientRect()
            const lado = e.clientY < r.top + r.height / 2 ? "antes" : "despues"
            if (encima?.clave !== clave || encima.lado !== lado) setEncima({ clave, lado })
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (arrastrando && arrastrando.seccion === seccion && onReordenar && arrastrando.agrupadora !== agrupadora) {
              onReordenar(moverAgrupadora(orden, seccion, agrupadorasPorSeccion[seccion], arrastrando.agrupadora, agrupadora, encima?.clave === clave ? encima.lado : "despues"))
            }
            setArrastrando(null); setEncima(null)
          }}
          className={[arrastrando?.agrupadora === agrupadora && arrastrando.seccion === seccion ? "opacity-40" : "",
            marca === "antes" ? "border-t-2 border-t-primary" : marca === "despues" ? "border-b-2 border-b-primary" : ""].join(" ")}
        >
          <TableCell
            className={`pl-4 ${expandible ? "cursor-pointer select-none" : ""}`}
            onClick={expandible ? () => toggleExpand(clave) : undefined}
          >
            {movible && <span className="mr-1 cursor-grab text-gray-300 print:hidden" title="Arrastrá para cambiar el orden (se guarda)">⠿</span>}
            {expandible && (
              <span className="mr-1 text-gray-400 text-[10px]">{expandido ? "▼" : "▶"}</span>
            )}
            <span className={agrupadora.startsWith("(") ? "italic text-gray-500" : ""}>{rotulo.texto}</span>
            {expandible && (
              <span className="ml-1 text-[10px] text-gray-400">({subs.length})</span>
            )}
          </TableCell>
          {resumen.map(mes => {
            const valor = mes[seccion][agrupadora]
            return (
              <TableCell key={`${seccion}-${agrupadora}-${mes.año}-${mes.mes}`} className="text-center">
                {valor !== undefined ? <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span> : "-"}
              </TableCell>
            )
          })}
          <TableCell className="text-center bg-blue-50">
            <span className={getColorClass(totalPeriodo)}>{formatNumber(totalPeriodo, mostrarDecimales)}</span>
          </TableCell>
          <TableCell className="text-center bg-green-50">
            <span className={getColorClass(promPeriodo)}>{formatNumber(promPeriodo, mostrarDecimales)}</span>
          </TableCell>
        </TableRow>

        {expandible && expandido && subs.map(sub => {
          const totalSub = resumen.reduce((s, mes) => s + (mes.subCategorias?.[agrupadora]?.[sub] || 0), 0)
          const promSub = totalSub / resumen.length
          return (
            <TableRow suppressHydrationWarning key={`${seccion}-${agrupadora}-${sub}`} className="bg-gray-50/50">
              <TableCell className="pl-10 text-xs text-gray-600">↳ {sub}</TableCell>
              {resumen.map(mes => {
                const valor = mes.subCategorias?.[agrupadora]?.[sub]
                return (
                  <TableCell key={`sub-${sub}-${mes.año}-${mes.mes}`} className="text-center text-xs">
                    {valor !== undefined ? <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span> : "-"}
                  </TableCell>
                )
              })}
              <TableCell className="text-center bg-blue-50 text-xs">
                <span className={getColorClass(totalSub)}>{formatNumber(totalSub, mostrarDecimales)}</span>
              </TableCell>
              <TableCell className="text-center bg-green-50 text-xs">
                <span className={getColorClass(promSub)}>{formatNumber(promSub, mostrarDecimales)}</span>
              </TableCell>
            </TableRow>
          )
        })}
      </React.Fragment>
    )
  }

  const renderSeccion = (s: typeof SECCIONES[number]) => {
    const totalSeccion = totalesPeriodo[s.key]
    const promSeccion = promedios[s.key]
    return (
      <React.Fragment key={s.key}>
        <TableRow suppressHydrationWarning className={s.claseTitulo}>
          <TableCell className={`font-semibold ${s.claseTextoTitulo}`}>{s.titulo}</TableCell>
          {resumen.map(mes => (
            <TableCell key={`titulo-${s.key}-${mes.año}-${mes.mes}`} className="text-center" />
          ))}
          <TableCell className="text-center" />
          <TableCell className="text-center" />
        </TableRow>
        {agrupadorasPorSeccion[s.key].map(a => renderAgrupadora(s.key, a))}
        <TableRow suppressHydrationWarning className={`font-semibold ${s.claseSubtotal}`}>
          <TableCell>Subtotal {s.titulo.charAt(0) + s.titulo.slice(1).toLowerCase()}</TableCell>
          {resumen.map(mes => (
            <TableCell key={`subtotal-${s.key}-${mes.año}-${mes.mes}`} className="text-center">
              <span className={getColorClass(mes[s.totalKey])}>{formatNumber(mes[s.totalKey], mostrarDecimales)}</span>
            </TableCell>
          ))}
          <TableCell className="text-center bg-blue-50">
            <span className={getColorClass(totalSeccion)}>{formatNumber(totalSeccion, mostrarDecimales)}</span>
          </TableCell>
          <TableCell className="text-center bg-green-50">
            <span className={getColorClass(promSeccion)}>{formatNumber(promSeccion, mostrarDecimales)}</span>
          </TableCell>
        </TableRow>
      </React.Fragment>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Resumen Financiero Mensual</CardTitle>
        {todasLasClavesExpandibles.size > 0 && !todoAbierto && (
          <div className="flex gap-2 print:hidden">
            <Button size="sm" variant="outline" onClick={expandirTodo}>Expandir todo</Button>
            <Button size="sm" variant="outline" onClick={colapsarTodo}>Colapsar todo</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table suppressHydrationWarning>
            <TableHeader>
              <TableRow suppressHydrationWarning>
                <TableHead className="font-semibold">Concepto</TableHead>
                {resumen.map(mes => (
                  <TableHead key={`${mes.año}-${mes.mes}`} className="text-center font-semibold">
                    {getMonthName(mes.mes)} {mes.año}
                  </TableHead>
                ))}
                <TableHead className="text-center font-semibold bg-blue-50">Total Período</TableHead>
                <TableHead className="text-center font-semibold bg-green-50">Promedio Mensual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SECCIONES.map(renderSeccion)}

              {/* Ingresos - Egresos */}
              <TableRow suppressHydrationWarning className="font-semibold bg-blue-100 border-t-2">
                <TableCell>Ingresos - Egresos</TableCell>
                {resumen.map(mes => {
                  const valor = mes.totalIngresos + mes.totalEgresos
                  return (
                    <TableCell key={`ing-egr-${mes.año}-${mes.mes}`} className="text-center">
                      <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span>
                    </TableCell>
                  )
                })}
                <TableCell className="text-center bg-blue-50">
                  {(() => {
                    const v = totalesPeriodo.ingresos + totalesPeriodo.egresos
                    return <span className={getColorClass(v)}>{formatNumber(v, mostrarDecimales)}</span>
                  })()}
                </TableCell>
                <TableCell className="text-center bg-green-50">
                  {(() => {
                    const v = promedios.ingresos + promedios.egresos
                    return <span className={getColorClass(v)}>{formatNumber(v, mostrarDecimales)}</span>
                  })()}
                </TableCell>
              </TableRow>

              {/* Saldo Total */}
              <TableRow suppressHydrationWarning className="font-semibold bg-gray-100">
                <TableCell>Saldo Total</TableCell>
                {resumen.map(mes => (
                  <TableCell key={`saldo-${mes.año}-${mes.mes}`} className="text-center">
                    <span className={getColorClass(mes.saldoMensual)}>{formatNumber(mes.saldoMensual, mostrarDecimales)}</span>
                  </TableCell>
                ))}
                <TableCell className="text-center bg-blue-50">
                  <span className={getColorClass(totalesPeriodo.saldo)}>{formatNumber(totalesPeriodo.saldo, mostrarDecimales)}</span>
                </TableCell>
                <TableCell className="text-center bg-green-50">
                  <span className={getColorClass(promedios.saldo)}>{formatNumber(promedios.saldo, mostrarDecimales)}</span>
                </TableCell>
              </TableRow>

              {/* Saldo Acumulado */}
              <TableRow suppressHydrationWarning className="font-semibold bg-gray-200">
                <TableCell>Saldo Acumulado</TableCell>
                {resumen.map(mes => {
                  saldoAcumulado += mes.saldoMensual
                  return (
                    <TableCell key={`acum-${mes.año}-${mes.mes}`} className="text-center">
                      <span className={getColorClass(saldoAcumulado)}>{formatNumber(saldoAcumulado, mostrarDecimales)}</span>
                    </TableCell>
                  )
                })}
                <TableCell className="text-center bg-blue-50">
                  <span className={getColorClass(saldoAcumulado)}>{formatNumber(saldoAcumulado, mostrarDecimales)}</span>
                </TableCell>
                <TableCell className="text-center bg-green-50">-</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
