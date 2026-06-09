"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, RefreshCw, Search, Pencil, Trash2, Link2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { ModalLiquidacionMsa, type LiquidacionMsa } from "./modal-liquidacion-msa"
import { normalizarBusqueda } from "@/lib/normalizar-texto"

interface Props {
  userRole?: 'admin' | 'contable'
}

const fmtAR = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtMoney = (n: number) => `$${fmtAR(n)}`
const fmtFecha = (s: string | null) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function VistaLiquidacionesMsa({ userRole = 'admin' }: Props) {
  const esAdmin = userRole === 'admin'
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionMsa[]>([])
  const [ventasPorLiq, setVentasPorLiq] = useState<Map<string, { count: number, clientes: string[] }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [liqEditando, setLiqEditando] = useState<LiquidacionMsa | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .schema('msa')
        .from('liquidaciones_venta')
        .select('*')
        .order('fecha_liquidacion', { ascending: false })
      if (error) throw error
      setLiquidaciones((data || []) as LiquidacionMsa[])

      // Cargar ventas vinculadas por cada liquidación
      const { data: pivot } = await supabase
        .schema('msa')
        .from('ventas_liquidaciones')
        .select('liquidacion_id, venta:msa_ventas:ventas(denominacion_cliente)') as any
      // Si el join falla por nombres, hacemos query separada
      let map = new Map<string, { count: number, clientes: string[] }>()
      if (pivot && Array.isArray(pivot) && pivot.length > 0 && pivot[0].venta) {
        for (const row of pivot as any[]) {
          const lid = row.liquidacion_id
          const nom = row.venta?.denominacion_cliente || '?'
          const cur = map.get(lid) || { count: 0, clientes: [] }
          cur.count += 1
          if (!cur.clientes.includes(nom)) cur.clientes.push(nom)
          map.set(lid, cur)
        }
      } else {
        // Fallback: dos queries
        const { data: pivot2 } = await supabase
          .schema('msa')
          .from('ventas_liquidaciones')
          .select('venta_id, liquidacion_id')
        const ventaIds = new Set((pivot2 || []).map((p: any) => p.venta_id))
        const { data: ventas2 } = await supabase
          .schema('msa')
          .from('ventas')
          .select('id, denominacion_cliente')
          .in('id', Array.from(ventaIds))
        const ventasMap = new Map((ventas2 || []).map((v: any) => [v.id, v.denominacion_cliente]))
        for (const row of (pivot2 || []) as any[]) {
          const nom = ventasMap.get(row.venta_id) || '?'
          const cur = map.get(row.liquidacion_id) || { count: 0, clientes: [] }
          cur.count += 1
          if (!cur.clientes.includes(nom)) cur.clientes.push(nom)
          map.set(row.liquidacion_id, cur)
        }
      }
      setVentasPorLiq(map)
    } catch (err) {
      toast.error('Error cargando liquidaciones: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const filtradas = busqueda.trim()
    ? liquidaciones.filter(l => {
        const q = normalizarBusqueda(busqueda)
        return normalizarBusqueda(l.nro_comprobante || '').includes(q)
          || normalizarBusqueda(l.coe || '').includes(q)
          || normalizarBusqueda(l.puerto || '').includes(q)
      })
    : liquidaciones

  const abrirAlta = () => {
    setLiqEditando(null)
    setModalAbierto(true)
  }
  const abrirEdicion = (l: LiquidacionMsa) => {
    setLiqEditando(l)
    setModalAbierto(true)
  }

  const eliminar = async (l: LiquidacionMsa) => {
    const v = ventasPorLiq.get(l.id)
    let mensaje = `¿Eliminar la liquidación ${l.nro_comprobante || ''} del ${fmtFecha(l.fecha_liquidacion)}?`
    if (v && v.count > 0) {
      mensaje += `\n\nEstá vinculada a ${v.count} venta(s). Los vínculos se borran pero las ventas quedan intactas.`
    }
    if (!window.confirm(mensaje)) return
    try {
      const { error } = await supabase
        .schema('msa')
        .from('liquidaciones_venta')
        .delete()
        .eq('id', l.id)
      if (error) throw error
      toast.success('Liquidación eliminada')
      await cargar()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nro comprobante, COE, puerto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={cargar}>
            <RefreshCw className="mr-2 h-4 w-4" />Actualizar
          </Button>
          {esAdmin && (
            <Button onClick={abrirAlta} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />Nueva liquidación
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha liq.</TableHead>
                  <TableHead>Nº Comp.</TableHead>
                  <TableHead>COE</TableHead>
                  <TableHead>Puerto</TableHead>
                  <TableHead className="text-right">Total operación</TableHead>
                  <TableHead className="text-right">Importe neto</TableHead>
                  <TableHead className="text-right">Pago s/cond.</TableHead>
                  <TableHead>Acreditación</TableHead>
                  <TableHead>Ventas vinculadas</TableHead>
                  <TableHead className="text-right" style={{ width: 110 }}>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-gray-500">Cargando…</TableCell></TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-gray-500">
                    {liquidaciones.length === 0 ? 'No hay liquidaciones cargadas todavía.' : 'No hay resultados para la búsqueda.'}
                  </TableCell></TableRow>
                ) : filtradas.map(l => {
                  const v = ventasPorLiq.get(l.id)
                  return (
                    <TableRow key={l.id} className="hover:bg-gray-50">
                      <TableCell className="whitespace-nowrap">{fmtFecha(l.fecha_liquidacion)}</TableCell>
                      <TableCell className="text-xs">{l.nro_comprobante || '—'}</TableCell>
                      <TableCell className="text-xs">{l.coe || '—'}</TableCell>
                      <TableCell>{l.puerto || '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{l.total_operacion != null ? fmtMoney(Number(l.total_operacion)) : '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{l.importe_neto_a_pagar != null ? fmtMoney(Number(l.importe_neto_a_pagar)) : '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{l.pago_segun_condiciones != null ? fmtMoney(Number(l.pago_segun_condiciones)) : '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtFecha(l.fecha_acreditacion)}</TableCell>
                      <TableCell>
                        {v && v.count > 0 ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            <Link2 className="h-3 w-3 mr-1" />
                            {v.count} ({v.clientes.slice(0, 2).join(', ')}{v.clientes.length > 2 ? '…' : ''})
                          </Badge>
                        ) : <span className="text-xs text-gray-400">sin vincular</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {esAdmin && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => abrirEdicion(l)} title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => eliminar(l)} title="Eliminar" className="text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ModalLiquidacionMsa
        open={modalAbierto}
        onOpenChange={setModalAbierto}
        liquidacionInicial={liqEditando}
        onGuardado={cargar}
      />
    </div>
  )
}
