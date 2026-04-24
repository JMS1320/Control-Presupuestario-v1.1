"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface CicloCria {
  id: string
  anio_servicio: number
  rodeo: string
  fecha_servicio: string | null
  cabezas_servicio: number | null
  fecha_tacto: string | null
  cabezas_prenadas: number | null
  cabezas_vacias: number | null
  fecha_paricion: string | null
  terneros_nacidos: number | null
  fecha_destete: string | null
  terneros_destetados: number | null
  pesada_destete_fecha: string | null
  kg_totales: number | null
  kg_promedio: number | null
  machos_destetados: number | null
  hembras_destetados: number | null
  orden_destete_id: string | null
  observaciones: string | null
}

const formatoPct = (valor: number | null): string => {
  if (valor === null || isNaN(valor) || !isFinite(valor)) return '-'
  return `${valor.toFixed(1).replace(".", ",")}%`
}

const formatoFecha = (fecha: string | null): string => {
  if (!fecha) return '-'
  const d = new Date(fecha + 'T00:00:00')
  return d.toLocaleDateString('es-AR')
}

const etapaActual = (c: CicloCria): { label: string; color: string } => {
  if (c.fecha_destete) return { label: 'Completado', color: 'bg-green-100 text-green-800' }
  if (c.fecha_paricion) return { label: 'Parición', color: 'bg-purple-100 text-purple-800' }
  if (c.fecha_tacto) return { label: 'Tacto', color: 'bg-blue-100 text-blue-800' }
  if (c.fecha_servicio) return { label: 'Servicio', color: 'bg-yellow-100 text-yellow-800' }
  return { label: 'Iniciado', color: 'bg-gray-100 text-gray-800' }
}

export default function CiclosCriaPanel() {
  const [ciclos, setCiclos] = useState<CicloCria[]>([])
  const [añosDisponibles, setAñosDisponibles] = useState<number[]>([])
  const [añoSeleccionado, setAñoSeleccionado] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const cargarAños = useCallback(async () => {
    const { data } = await supabase.schema('productivo')
      .from('ciclos_cria')
      .select('anio_servicio')
    if (data) {
      const años = [...new Set(data.map(d => d.anio_servicio))].sort((a, b) => b - a)
      setAñosDisponibles(años)
      if (años.length > 0 && !añoSeleccionado) {
        setAñoSeleccionado(String(años[0]))
      }
    }
    setLoading(false)
  }, [])

  const cargarCiclos = useCallback(async () => {
    if (!añoSeleccionado) return
    const { data } = await supabase.schema('productivo')
      .from('ciclos_cria')
      .select('*')
      .eq('anio_servicio', parseInt(añoSeleccionado))
      .order('rodeo')
    if (data) setCiclos(data)
  }, [añoSeleccionado])

  useEffect(() => { cargarAños() }, [cargarAños])
  useEffect(() => { cargarCiclos() }, [cargarCiclos])

  // Calcular KPIs por rodeo
  const calcularKPIs = (lista: CicloCria[]) => {
    const servicio = lista.reduce((s, c) => s + (c.cabezas_servicio || 0), 0)
    const prenadas = lista.reduce((s, c) => s + (c.cabezas_prenadas || 0), 0)
    const vacias = lista.reduce((s, c) => s + (c.cabezas_vacias || 0), 0)
    const nacidos = lista.reduce((s, c) => s + (c.terneros_nacidos || 0), 0)
    const destetados = lista.reduce((s, c) => s + (c.terneros_destetados || 0), 0)
    const kgTotales = lista.reduce((s, c) => s + (c.kg_totales || 0), 0)
    const conKg = lista.filter(c => c.kg_promedio != null)
    const kgPromedio = conKg.length > 0 ? conKg.reduce((s, c) => s + (c.kg_promedio || 0), 0) / conKg.length : null
    const machosDestetados = lista.reduce((s, c) => s + (c.machos_destetados || 0), 0)
    const hembrasDestetados = lista.reduce((s, c) => s + (c.hembras_destetados || 0), 0)

    return {
      servicio,
      prenadas,
      vacias,
      pctPrenez: servicio > 0 ? (prenadas / servicio) * 100 : null,
      nacidos,
      pctParicion: prenadas > 0 ? (nacidos / prenadas) * 100 : null,
      destetados,
      pctDesteteNac: nacidos > 0 ? (destetados / nacidos) * 100 : null,
      pctDesteteEnt: servicio > 0 ? (destetados / servicio) * 100 : null,
      kgTotales,
      kgPromedio,
      machosDestetados,
      hembrasDestetados,
    }
  }

  // Agrupar por rodeo
  const rodeos = [...new Set(ciclos.map(c => c.rodeo))]
  const kpisPorRodeo = rodeos.map(rodeo => {
    const ciclosRodeo = ciclos.filter(c => c.rodeo === rodeo)
    return {
      rodeo,
      prorrateado: ciclosRodeo.some(esProrrateado),
      ...calcularKPIs(ciclosRodeo)
    }
  })
  const kpiTotal = calcularKPIs(ciclos)

  // Detectar ciclos con datos prorrateados (comparten orden_destete_id)
  const ordenDesteteCount = new Map<string, number>()
  ciclos.forEach(c => {
    if (c.orden_destete_id) ordenDesteteCount.set(c.orden_destete_id, (ordenDesteteCount.get(c.orden_destete_id) || 0) + 1)
  })
  const esProrrateado = (c: CicloCria) =>
    c.orden_destete_id != null && (ordenDesteteCount.get(c.orden_destete_id) || 0) > 1
  const hayProrrateados = ciclos.some(esProrrateado)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">Cargando ciclos...</span>
      </div>
    )
  }

  if (añosDisponibles.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ciclos de Cria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sin ciclos registrados. Cree una orden con labor "Servicio/Entore" para iniciar un ciclo.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Ciclos de Cria</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={añoSeleccionado} onValueChange={setAñoSeleccionado}>
              <SelectTrigger className="w-[120px] h-8 text-sm">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {añosDisponibles.map(a => (
                  <SelectItem key={a} value={String(a)}>Campaña {a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8" onClick={cargarCiclos}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rodeo</TableHead>
              <TableHead className="text-right">Entoradas</TableHead>
              <TableHead className="text-right">Preñadas</TableHead>
              <TableHead className="text-right">Vacias</TableHead>
              <TableHead className="text-right">% Preñez</TableHead>
              <TableHead className="text-right">Nacidos</TableHead>
              <TableHead className="text-right">% Paricion</TableHead>
              <TableHead className="text-right">Destetados</TableHead>
              <TableHead className="text-right">% Dest s/Nac</TableHead>
              <TableHead className="text-right">% Dest s/Ent</TableHead>
              <TableHead className="text-right">♂</TableHead>
              <TableHead className="text-right">♀</TableHead>
              <TableHead className="text-right">Kg Prom.</TableHead>
              <TableHead className="text-right">Kg Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kpisPorRodeo.map(k => (
              <TableRow key={k.rodeo}>
                <TableCell className="font-medium">{k.rodeo}</TableCell>
                <TableCell className="text-right">{k.servicio || '-'}</TableCell>
                <TableCell className="text-right">{k.prenadas || '-'}</TableCell>
                <TableCell className="text-right">{k.vacias || '-'}</TableCell>
                <TableCell className="text-right font-semibold">{formatoPct(k.pctPrenez)}</TableCell>
                <TableCell className="text-right">{k.nacidos || '-'}</TableCell>
                <TableCell className="text-right font-semibold">{formatoPct(k.pctParicion)}</TableCell>
                <TableCell className="text-right">{k.destetados || '-'}</TableCell>
                <TableCell className="text-right font-semibold">{formatoPct(k.pctDesteteNac)}</TableCell>
                <TableCell className="text-right font-semibold">{formatoPct(k.pctDesteteEnt)}</TableCell>
                <TableCell className="text-right text-sky-700">{k.machosDestetados || '-'}{k.prorrateado && k.machosDestetados ? '*' : ''}</TableCell>
                <TableCell className="text-right text-pink-700">{k.hembrasDestetados || '-'}{k.prorrateado && k.hembrasDestetados ? '*' : ''}</TableCell>
                <TableCell className="text-right">{k.kgPromedio != null ? `${k.kgPromedio.toFixed(1).replace('.', ',')}` : '-'}</TableCell>
                <TableCell className="text-right font-semibold text-green-700">{k.kgTotales ? `${k.kgTotales.toLocaleString('es-AR', { maximumFractionDigits: 0 })}${k.prorrateado ? '*' : ''}` : '-'}</TableCell>
              </TableRow>
            ))}
            {kpisPorRodeo.length > 1 && (
              <TableRow className="font-bold border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{kpiTotal.servicio || '-'}</TableCell>
                <TableCell className="text-right">{kpiTotal.prenadas || '-'}</TableCell>
                <TableCell className="text-right">{kpiTotal.vacias || '-'}</TableCell>
                <TableCell className="text-right">{formatoPct(kpiTotal.pctPrenez)}</TableCell>
                <TableCell className="text-right">{kpiTotal.nacidos || '-'}</TableCell>
                <TableCell className="text-right">{formatoPct(kpiTotal.pctParicion)}</TableCell>
                <TableCell className="text-right">{kpiTotal.destetados || '-'}</TableCell>
                <TableCell className="text-right">{formatoPct(kpiTotal.pctDesteteNac)}</TableCell>
                <TableCell className="text-right">{formatoPct(kpiTotal.pctDesteteEnt)}</TableCell>
                <TableCell className="text-right text-sky-700">{kpiTotal.machosDestetados || '-'}</TableCell>
                <TableCell className="text-right text-pink-700">{kpiTotal.hembrasDestetados || '-'}</TableCell>
                <TableCell className="text-right">{kpiTotal.kgPromedio != null ? `${kpiTotal.kgPromedio.toFixed(1).replace('.', ',')}` : '-'}</TableCell>
                <TableCell className="text-right font-semibold text-green-700">{kpiTotal.kgTotales ? kpiTotal.kgTotales.toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '-'}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Detalle por ciclo */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-muted-foreground">Detalle por Rodeo</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rodeo</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Tacto</TableHead>
                <TableHead>Paricion</TableHead>
                <TableHead>Destete</TableHead>
                <TableHead>Kg Destete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ciclos.map(c => {
                const etapa = etapaActual(c)
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.rodeo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={etapa.color}>{etapa.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.fecha_servicio ? `${formatoFecha(c.fecha_servicio)} - ${c.cabezas_servicio} cab.` : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.fecha_tacto ? `${formatoFecha(c.fecha_tacto)} - ${c.cabezas_prenadas}P / ${c.cabezas_vacias}V` : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.fecha_paricion ? `${formatoFecha(c.fecha_paricion)} - ${c.terneros_nacidos} nac.` : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.fecha_destete ? `${formatoFecha(c.fecha_destete)} - ${c.terneros_destetados} dest.` : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.kg_totales ? (
                        <span className="text-green-700 font-medium">
                          {c.kg_totales.toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg
                          <span className="text-gray-400 font-normal"> (prom {c.kg_promedio?.toFixed(1).replace('.', ',')})</span>
                          {esProrrateado(c) && <span className="text-amber-500">*</span>}
                        </span>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {hayProrrateados && (
          <p className="text-xs text-amber-600 mt-1">* Datos prorrateados del total general (machos, hembras, kg). Los valores reales corresponden a la fila TOTAL.</p>
        )}
      </CardContent>
    </Card>
  )
}
