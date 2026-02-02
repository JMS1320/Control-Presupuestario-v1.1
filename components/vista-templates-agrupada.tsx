"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, ChevronRight, ChevronDown, FolderOpen, Folder, FileText, Calendar } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Cuota {
  id: string
  numero_cuota: number
  fecha_estimada: string
  fecha_vencimiento: string | null
  monto: number
  estado: string
}

interface Template {
  id: string
  nombre_referencia: string
  categ: string
  cuenta_agrupadora: string
  activo: boolean
  cuotas: number
  monto_total: number
  cuotas_detalle: Cuota[]
}

interface CategoriaAgrupada {
  categ: string
  templates: Template[]
  totalTemplates: number
  totalMonto: number
}

interface CuentaAgrupadora {
  cuenta_agrupadora: string
  categorias: CategoriaAgrupada[]
  totalTemplates: number
  totalMonto: number
}

type FiltroActivo = 'activos' | 'desactivados' | 'todos'

export function VistaTemplatesAgrupada() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<CuentaAgrupadora[]>([])
  const [filtro, setFiltro] = useState<FiltroActivo>('activos')

  // Estados de expansión
  const [cuentasExpandidas, setCuentasExpandidas] = useState<Set<string>>(new Set())
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Set<string>>(new Set())
  const [templatesExpandidos, setTemplatesExpandidos] = useState<Set<string>>(new Set())

  // Cargar datos
  useEffect(() => {
    cargarDatos()
  }, [filtro])

  const cargarDatos = async () => {
    setLoading(true)
    setError(null)

    try {
      // Consultar templates con sus cuotas
      let query = supabase
        .from('egresos_sin_factura')
        .select(`
          id,
          nombre_referencia,
          categ,
          cuenta_agrupadora,
          activo,
          cuotas_egresos_sin_factura (
            id,
            numero_cuota,
            fecha_estimada,
            fecha_vencimiento,
            monto,
            estado
          )
        `)
        .order('cuenta_agrupadora')
        .order('categ')
        .order('nombre_referencia')

      // Aplicar filtro
      if (filtro === 'activos') {
        query = query.eq('activo', true)
      } else if (filtro === 'desactivados') {
        query = query.eq('activo', false)
      }

      const { data, error: queryError } = await query

      if (queryError) throw queryError

      // Agrupar datos jerárquicamente
      const agrupado = agruparDatos(data || [])
      setDatos(agrupado)

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const agruparDatos = (templates: any[]): CuentaAgrupadora[] => {
    const mapa = new Map<string, Map<string, Template[]>>()

    templates.forEach(t => {
      const cuenta = t.cuenta_agrupadora || 'Sin Cuenta Agrupadora'
      const categ = t.categ || 'Sin Categoría'

      if (!mapa.has(cuenta)) {
        mapa.set(cuenta, new Map())
      }

      const categMap = mapa.get(cuenta)!
      if (!categMap.has(categ)) {
        categMap.set(categ, [])
      }

      const cuotasDetalle = (t.cuotas_egresos_sin_factura || [])
        .sort((a: Cuota, b: Cuota) => a.numero_cuota - b.numero_cuota)

      categMap.get(categ)!.push({
        id: t.id,
        nombre_referencia: t.nombre_referencia,
        categ: t.categ,
        cuenta_agrupadora: t.cuenta_agrupadora,
        activo: t.activo,
        cuotas: cuotasDetalle.length,
        monto_total: cuotasDetalle.reduce((sum: number, c: Cuota) => sum + (c.monto || 0), 0),
        cuotas_detalle: cuotasDetalle
      })
    })

    // Convertir a array estructurado
    const resultado: CuentaAgrupadora[] = []

    mapa.forEach((categMap, cuenta) => {
      const categorias: CategoriaAgrupada[] = []

      categMap.forEach((templates, categ) => {
        categorias.push({
          categ,
          templates,
          totalTemplates: templates.length,
          totalMonto: templates.reduce((sum, t) => sum + t.monto_total, 0)
        })
      })

      resultado.push({
        cuenta_agrupadora: cuenta,
        categorias,
        totalTemplates: categorias.reduce((sum, c) => sum + c.totalTemplates, 0),
        totalMonto: categorias.reduce((sum, c) => sum + c.totalMonto, 0)
      })
    })

    return resultado.sort((a, b) => a.cuenta_agrupadora.localeCompare(b.cuenta_agrupadora))
  }

  const toggleCuenta = (cuenta: string) => {
    setCuentasExpandidas(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(cuenta)) {
        nuevo.delete(cuenta)
      } else {
        nuevo.add(cuenta)
      }
      return nuevo
    })
  }

  const toggleCategoria = (key: string) => {
    setCategoriasExpandidas(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(key)) {
        nuevo.delete(key)
      } else {
        nuevo.add(key)
      }
      return nuevo
    })
  }

  const toggleTemplate = (id: string) => {
    setTemplatesExpandidos(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) {
        nuevo.delete(id)
      } else {
        nuevo.add(id)
      }
      return nuevo
    })
  }

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(monto)
  }

  const formatearFecha = (fecha: string | null) => {
    if (!fecha) return '-'
    try {
      return format(new Date(fecha), 'dd/MM/yyyy', { locale: es })
    } catch {
      return fecha
    }
  }

  // Calcular totales
  const totales = {
    templates: datos.reduce((sum, c) => sum + c.totalTemplates, 0),
    monto: datos.reduce((sum, c) => sum + c.totalMonto, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Cargando vista agrupada...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros y resumen */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Vista Agrupada de Templates</CardTitle>
            <div className="text-sm text-muted-foreground">
              {totales.templates} templates | {formatearMonto(totales.monto)} total
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={filtro}
            onValueChange={(v) => setFiltro(v as FiltroActivo)}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="activos" id="activos" />
              <Label htmlFor="activos" className="cursor-pointer">Solo Activos</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="desactivados" id="desactivados" />
              <Label htmlFor="desactivados" className="cursor-pointer">Solo Desactivados</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="todos" id="todos" />
              <Label htmlFor="todos" className="cursor-pointer">Todos</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Vista jerárquica */}
      <Card>
        <CardContent className="pt-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-1">
              {datos.map(cuenta => (
                <div key={cuenta.cuenta_agrupadora} className="border rounded-lg">
                  {/* Nivel 1: Cuenta Agrupadora */}
                  <div
                    className="flex items-center gap-2 p-3 bg-slate-100 hover:bg-slate-200 cursor-pointer rounded-t-lg"
                    onClick={() => toggleCuenta(cuenta.cuenta_agrupadora)}
                  >
                    {cuentasExpandidas.has(cuenta.cuenta_agrupadora) ? (
                      <ChevronDown className="h-5 w-5 text-slate-600" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-600" />
                    )}
                    <FolderOpen className="h-5 w-5 text-amber-600" />
                    <span className="font-semibold text-slate-800">{cuenta.cuenta_agrupadora}</span>
                    <Badge variant="secondary" className="ml-2">
                      {cuenta.totalTemplates} templates
                    </Badge>
                    <span className="ml-auto text-sm font-medium text-slate-600">
                      {formatearMonto(cuenta.totalMonto)}
                    </span>
                  </div>

                  {/* Contenido expandido de Cuenta */}
                  {cuentasExpandidas.has(cuenta.cuenta_agrupadora) && (
                    <div className="pl-6 pb-2">
                      {cuenta.categorias.map(categoria => {
                        const categKey = `${cuenta.cuenta_agrupadora}|${categoria.categ}`
                        return (
                          <div key={categKey} className="border-l-2 border-slate-200 ml-2">
                            {/* Nivel 2: Categoría */}
                            <div
                              className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer ml-2"
                              onClick={() => toggleCategoria(categKey)}
                            >
                              {categoriasExpandidas.has(categKey) ? (
                                <ChevronDown className="h-4 w-4 text-slate-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-500" />
                              )}
                              <Folder className="h-4 w-4 text-blue-500" />
                              <span className="font-medium text-slate-700">{categoria.categ}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {categoria.totalTemplates}
                              </Badge>
                              <span className="ml-auto text-sm text-slate-500">
                                {formatearMonto(categoria.totalMonto)}
                              </span>
                            </div>

                            {/* Contenido expandido de Categoría */}
                            {categoriasExpandidas.has(categKey) && (
                              <div className="pl-6">
                                {categoria.templates.map(template => (
                                  <div key={template.id} className="border-l-2 border-slate-100 ml-2">
                                    {/* Nivel 3: Template */}
                                    <div
                                      className="flex items-center gap-2 p-2 hover:bg-blue-50 cursor-pointer ml-2"
                                      onClick={() => toggleTemplate(template.id)}
                                    >
                                      {templatesExpandidos.has(template.id) ? (
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-slate-400" />
                                      )}
                                      <FileText className="h-4 w-4 text-green-500" />
                                      <span className="text-slate-700">{template.nombre_referencia}</span>
                                      {!template.activo && (
                                        <Badge variant="destructive" className="text-xs">Desactivado</Badge>
                                      )}
                                      <Badge variant="outline" className="ml-2 text-xs">
                                        {template.cuotas} cuotas
                                      </Badge>
                                      <span className="ml-auto text-sm text-slate-600">
                                        {formatearMonto(template.monto_total)}
                                      </span>
                                    </div>

                                    {/* Nivel 4: Cuotas */}
                                    {templatesExpandidos.has(template.id) && template.cuotas_detalle.length > 0 && (
                                      <div className="pl-10 pb-2">
                                        <div className="bg-slate-50 rounded p-2 text-xs">
                                          <table className="w-full">
                                            <thead>
                                              <tr className="text-slate-500">
                                                <th className="text-left py-1 w-16">#</th>
                                                <th className="text-left py-1">Fecha Est.</th>
                                                <th className="text-left py-1">Fecha Venc.</th>
                                                <th className="text-right py-1">Monto</th>
                                                <th className="text-center py-1">Estado</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {template.cuotas_detalle.map(cuota => (
                                                <tr key={cuota.id} className="border-t border-slate-200">
                                                  <td className="py-1 text-slate-600">
                                                    Cuota {cuota.numero_cuota}
                                                  </td>
                                                  <td className="py-1">
                                                    {formatearFecha(cuota.fecha_estimada)}
                                                  </td>
                                                  <td className="py-1">
                                                    {formatearFecha(cuota.fecha_vencimiento)}
                                                  </td>
                                                  <td className="py-1 text-right font-medium">
                                                    {formatearMonto(cuota.monto)}
                                                  </td>
                                                  <td className="py-1 text-center">
                                                    <Badge
                                                      variant={cuota.estado === 'conciliado' ? 'secondary' : 'default'}
                                                      className="text-xs"
                                                    >
                                                      {cuota.estado}
                                                    </Badge>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
