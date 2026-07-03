"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, RefreshCw, Search, Pencil, Trash2, Link2, FileSpreadsheet, Percent } from "lucide-react"
import { ModalImportVentas } from "./modal-import-ventas"
import { ModalRetencionesVenta } from "./modal-retenciones-venta"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { ModalLiquidacionMsa, type LiquidacionMsa } from "./modal-liquidacion-msa"
import { normalizarBusqueda } from "@/lib/normalizar-texto"

interface Props {
  userRole?: 'admin' | 'contable'
}

const fmtAR = (n: number, dec = 2) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtMoney = (n: number) => `$${fmtAR(n)}`
const fmtFecha = (s: string | null) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

// Tipo de comprobante: FC/ND/NC (factura de venta) o Liq (liquidación de granos u otros)
const CODS_FC = [1, 6, 11, 51, 201, 206, 211]
const CODS_ND = [2, 7, 12, 52, 202, 207, 212]
const CODS_NC = [3, 8, 13, 53, 203, 208, 213]
function tipoLabel(t: number | null | undefined): string {
  if (t == null) return 'Liq'
  if (CODS_FC.includes(t)) return 'FC'
  if (CODS_ND.includes(t)) return 'ND'
  if (CODS_NC.includes(t)) return 'NC'
  return 'Liq' // 332 = Liquidación Primaria de Granos, y demás
}
const esFactura = (t: number | null | undefined) =>
  t != null && (CODS_FC.includes(t) || CODS_ND.includes(t) || CODS_NC.includes(t))

// Cálculos derivados. Usa los valores ABSOLUTOS persistidos (imp_total, retenciones) — igual para
// facturas y liquidaciones. Neto equivalente: subtotal_neto (granos) o imp_neto_gravado (factura).
// retRecibidas = suma de retenciones_recibidas imputadas aparte (sobre todo facturas).
function calcular(l: LiquidacionMsa, retRecibidas = 0) {
  const neto = Number(l.subtotal_neto) || Number(l.imp_neto_gravado) || 0
  const ivaV = Number(l.iva) || 0
  const comNeto = Number(l.comision_neto) || 0
  const comIva = Number(l.comision_iva) || 0
  const almNeto = Number(l.almacenaje_neto) || 0
  const almIva = Number(l.almacenaje_iva) || 0
  const ri = Number(l.ret_iva) || 0
  const rii = Number(l.ret_iibb) || 0
  const totalOp = Number(l.imp_total) || (neto + ivaV) // absoluto; fallback al calculado
  const totalDed = comNeto + comIva + almNeto + almIva
  const retenciones = ri + rii + (Number(retRecibidas) || 0) // en la liq + imputadas aparte
  const importeNeto = totalOp - totalDed - retenciones
  const ivaTotal = ivaV - comIva - almIva
  const ivaRg2300 = ivaTotal - ri
  const pagoCond = importeNeto - ivaRg2300
  return { neto, totalOp, retenciones, importeNeto, pagoCond }
}

export function VistaLiquidacionesMsa({ userRole = 'admin' }: Props) {
  const esAdmin = userRole === 'admin'
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionMsa[]>([])
  const [ventasPorLiq, setVentasPorLiq] = useState<Map<string, { count: number, clientes: string[] }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [liqEditando, setLiqEditando] = useState<LiquidacionMsa | null>(null)
  const [modalImport, setModalImport] = useState(false)
  const [retencionesDe, setRetencionesDe] = useState<any | null>(null)
  // Suma de retenciones_recibidas imputadas por comprobante (para el neto a cobrar)
  const [retMap, setRetMap] = useState<Map<string, number>>(new Map())

  const cargar = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .schema('msa')
        .from('comprobantes_venta')
        .select('*')
        .order('fecha_liquidacion', { ascending: false })
      if (error) throw error
      setLiquidaciones((data || []) as LiquidacionMsa[])

      // Retenciones imputadas aparte (retenciones_recibidas) por comprobante
      const compIds = (data || []).map((c: any) => c.id)
      const rMap = new Map<string, number>()
      if (compIds.length > 0) {
        const { data: rets } = await supabase
          .schema('msa').from('retenciones_recibidas')
          .select('comprobante_venta_id, monto').in('comprobante_venta_id', compIds)
        ;(rets || []).forEach((r: any) => {
          if (!r.comprobante_venta_id) return
          rMap.set(r.comprobante_venta_id, (rMap.get(r.comprobante_venta_id) || 0) + (Number(r.monto) || 0))
        })
      }
      setRetMap(rMap)

      // Conteo de ventas por liquidación
      const { data: pivot2 } = await supabase
        .schema('msa')
        .from('ventas_comprobantes')
        .select('venta_id, comprobante_id')
      const ventaIds = new Set((pivot2 || []).map((p: any) => p.venta_id))
      const { data: ventas2 } = ventaIds.size > 0 ? await supabase
        .schema('msa')
        .from('ventas')
        .select('id, denominacion_cliente')
        .in('id', Array.from(ventaIds)) : { data: [] }
      const ventasMap = new Map((ventas2 || []).map((v: any) => [v.id, v.denominacion_cliente]))
      const map = new Map<string, { count: number, clientes: string[] }>()
      for (const row of (pivot2 || []) as any[]) {
        const nom = ventasMap.get(row.venta_id) || '?'
        const cur = map.get(row.comprobante_id) || { count: 0, clientes: [] }
        cur.count += 1
        if (!cur.clientes.includes(nom)) cur.clientes.push(nom)
        map.set(row.comprobante_id, cur)
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
          || normalizarBusqueda(l.denominacion_cliente || '').includes(q)
          || l.cuit_cliente?.includes(q)
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

  // Marcar cobrado / volver a cobrar (igual que compras pagado). Conciliado lo controla el motor.
  const toggleCobrado = async (l: LiquidacionMsa) => {
    if (l.estado === 'conciliado') { toast.error('Ya está conciliado (lo controla el motor de conciliación)'); return }
    const nuevo = l.estado === 'cobrado' ? 'a cobrar' : 'cobrado'
    const { error } = await supabase.schema('msa').from('comprobantes_venta')
      .update({ estado: nuevo }).eq('id', l.id)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success(nuevo === 'cobrado' ? 'Marcado como cobrado' : 'Vuelto a "a cobrar"')
    cargar()
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
        .from('comprobantes_venta')
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
            placeholder="Buscar por comprador, CUIT, nro comp, COE..."
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
            <Button variant="outline" onClick={() => setModalImport(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />Importar ventas
            </Button>
          )}
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Grano</TableHead>
                  <TableHead className="text-right">Ton</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">Total op.</TableHead>
                  <TableHead className="text-right">Retenc.</TableHead>
                  <TableHead className="text-right">Importe neto</TableHead>
                  <TableHead className="text-right">Pago s/cond.</TableHead>
                  <TableHead>Acreditación</TableHead>
                  <TableHead>Ventas vinc.</TableHead>
                  <TableHead className="text-right" style={{ width: 110 }}>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-8 text-gray-500">Cargando…</TableCell></TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-8 text-gray-500">
                    {liquidaciones.length === 0 ? 'No hay liquidaciones cargadas todavía.' : 'No hay resultados para la búsqueda.'}
                  </TableCell></TableRow>
                ) : filtradas.map(l => {
                  const c = calcular(l, retMap.get(l.id) || 0)
                  const v = ventasPorLiq.get(l.id)
                  const esFac = esFactura(l.tipo_comprobante)
                  return (
                    <TableRow key={l.id} className="hover:bg-gray-50">
                      <TableCell className="whitespace-nowrap">{fmtFecha(l.fecha_liquidacion)}</TableCell>
                      <TableCell className="text-xs">{l.nro_comprobante || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${esFac ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'}`}>
                          {tipoLabel(l.tipo_comprobante)}
                        </Badge>
                      </TableCell>
                      <TableCell>{l.denominacion_cliente || '—'}</TableCell>
                      <TableCell>{l.grano || '—'}{l.grado ? <span className="text-xs text-gray-500 ml-1">({l.grado})</span> : null}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{l.toneladas != null ? fmtAR(Number(l.toneladas), 2) : '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{c.neto ? fmtMoney(c.neto) : '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtMoney(c.totalOp)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap text-orange-700">{c.retenciones ? fmtMoney(c.retenciones) : '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap font-semibold">{fmtMoney(c.importeNeto)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtMoney(c.pagoCond)}</TableCell>
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
                        <div className="flex justify-end items-center gap-1">
                          {/* Estado / marcar cobrado (conciliado = bloqueado, lo pone el motor) */}
                          {l.estado === 'conciliado' ? (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800">conciliado</Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => esAdmin && toggleCobrado(l)}
                              disabled={!esAdmin}
                              title={l.estado === 'cobrado' ? 'Cobrado — clic para volver a "a cobrar"' : 'Clic para marcar cobrado'}
                              className={`text-[11px] px-2 py-0.5 rounded border ${l.estado === 'cobrado' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                            >
                              {l.estado === 'cobrado' ? '✓ cobrado' : 'a cobrar'}
                            </button>
                          )}
                          {esAdmin && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setRetencionesDe(l as any)} title="Retenciones recibidas">
                                <Percent className="h-3.5 w-3.5 text-orange-600" />
                              </Button>
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
      <ModalImportVentas
        open={modalImport}
        onClose={() => setModalImport(false)}
        onImportado={cargar}
        userRole={userRole}
      />
      <ModalRetencionesVenta
        open={!!retencionesDe}
        comprobante={retencionesDe}
        onClose={() => setRetencionesDe(null)}
        onGuardado={cargar}
      />
    </div>
  )
}
