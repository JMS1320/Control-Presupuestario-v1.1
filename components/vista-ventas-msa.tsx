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
import { ModalVentaMsa, type VentaMsa } from "./modal-venta-msa"
import { normalizarBusqueda } from "@/lib/normalizar-texto"

interface Props {
  userRole?: 'admin' | 'contable'
}

const fmtAR = (n: number, dec = 2) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtMoney = (n: number) => `$${fmtAR(n)}`
const fmtFecha = (s: string) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

// Cálculos derivados para mostrar en la tabla (mismos que el modal)
function calcDerivados(v: VentaMsa) {
  const ton = Number(v.toneladas) || 0
  const pPesos = Number(v.precio_pesos) || 0
  const aliq = Number(v.alicuota_iva) || 0
  const subtotal = ton * pPesos
  const iva = subtotal * aliq / 100
  const total = subtotal + iva
  const comNeto = Number(v.comision_neto) || 0
  const comIva = comNeto * (Number(v.comision_alicuota_iva) || 0) / 100
  const almNeto = Number(v.almacenaje_neto) || 0
  const almIva = almNeto * (Number(v.almacenaje_alicuota_iva) || 0) / 100
  return {
    subtotal,
    iva,
    total,
    gravadoNeto: subtotal - comNeto - almNeto,
    ivaTotal: iva - comIva - almIva,
  }
}

export function VistaVentasMsa({ userRole = 'admin' }: Props) {
  const esAdmin = userRole === 'admin'
  const [ventas, setVentas] = useState<VentaMsa[]>([])
  const [conteoLiq, setConteoLiq] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [ventaEditando, setVentaEditando] = useState<VentaMsa | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .schema('msa')
        .from('ventas')
        .select('*')
        .order('fecha_operacion', { ascending: false })
      if (error) throw error
      setVentas((data || []) as VentaMsa[])

      // Conteo de liquidaciones por venta (vía pivot)
      const { data: pivot } = await supabase
        .schema('msa')
        .from('ventas_comprobantes')
        .select('venta_id')
      const conteo = new Map<string, number>()
      for (const row of (pivot || []) as { venta_id: string }[]) {
        conteo.set(row.venta_id, (conteo.get(row.venta_id) || 0) + 1)
      }
      setConteoLiq(conteo)
    } catch (err) {
      toast.error('Error cargando ventas: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const filtradas = busqueda.trim()
    ? ventas.filter(v => {
        const q = normalizarBusqueda(busqueda)
        return normalizarBusqueda(v.denominacion_cliente).includes(q)
          || v.cuit_cliente?.includes(q)
          || normalizarBusqueda(v.grano || '').includes(q)
      })
    : ventas

  const abrirAlta = () => {
    setVentaEditando(null)
    setModalAbierto(true)
  }
  const abrirEdicion = (v: VentaMsa) => {
    setVentaEditando(v)
    setModalAbierto(true)
  }

  const eliminar = async (v: VentaMsa) => {
    const nLiq = conteoLiq.get(v.id) || 0
    let mensaje = `¿Eliminar la venta de ${v.denominacion_cliente} del ${fmtFecha(v.fecha_operacion)}?`
    if (nLiq > 0) {
      mensaje += `\n\nEsta venta tiene ${nLiq} liquidación(es) vinculada(s). Si confirmás, se desvinculan automáticamente (la liquidación no se borra; queda sin esta venta).`
    }
    if (!window.confirm(mensaje)) return
    try {
      // Cascade desde el pivot está ON DELETE CASCADE → la liquidación queda intacta,
      // solo se quitan los vínculos de esta venta.
      const { error } = await supabase
        .schema('msa')
        .from('ventas')
        .delete()
        .eq('id', v.id)
      if (error) throw error
      toast.success('Venta eliminada')
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
            placeholder="Buscar cliente, CUIT, grano..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={cargar} title="Recargar">
            <RefreshCw className="mr-2 h-4 w-4" />Actualizar
          </Button>
          {esAdmin && (
            <Button onClick={abrirAlta} className="bg-green-600 hover:bg-green-700">
              <Plus className="mr-2 h-4 w-4" />Nueva venta
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
                  <TableHead>Fecha op.</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead>Grano</TableHead>
                  <TableHead className="text-right">Toneladas</TableHead>
                  <TableHead className="text-right">Precio/TN</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total op.</TableHead>
                  <TableHead className="text-right">Gravado Neto</TableHead>
                  <TableHead className="text-right">IVA Total</TableHead>
                  <TableHead className="text-center">Liq.</TableHead>
                  <TableHead className="text-right" style={{ width: 110 }}>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={13} className="text-center py-8 text-gray-500">Cargando…</TableCell></TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow><TableCell colSpan={13} className="text-center py-8 text-gray-500">
                    {ventas.length === 0 ? 'No hay ventas cargadas todavía.' : 'No hay resultados para la búsqueda.'}
                  </TableCell></TableRow>
                ) : filtradas.map(v => {
                  const c = calcDerivados(v)
                  const nLiq = conteoLiq.get(v.id) || 0
                  return (
                    <TableRow key={v.id} className="hover:bg-gray-50">
                      <TableCell className="whitespace-nowrap">{fmtFecha(v.fecha_operacion)}</TableCell>
                      <TableCell>{v.denominacion_cliente}</TableCell>
                      <TableCell className="text-xs">{v.cuit_cliente}</TableCell>
                      <TableCell>
                        {v.grano || '—'}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtAR(Number(v.toneladas) || 0, 2)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtMoney(Number(v.precio_pesos) || 0)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtMoney(c.subtotal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtMoney(c.iva)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap font-semibold">{fmtMoney(c.total)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtMoney(c.gravadoNeto)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtMoney(c.ivaTotal)}</TableCell>
                      <TableCell className="text-center">
                        {nLiq > 0
                          ? <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              <Link2 className="h-3 w-3 mr-1" />{nLiq}
                            </Badge>
                          : <span className="text-xs text-gray-400">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {esAdmin && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => abrirEdicion(v)} title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => eliminar(v)} title="Eliminar" className="text-red-600 hover:bg-red-50">
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

      <ModalVentaMsa
        open={modalAbierto}
        onOpenChange={setModalAbierto}
        ventaInicial={ventaEditando}
        onGuardado={cargar}
      />
    </div>
  )
}
