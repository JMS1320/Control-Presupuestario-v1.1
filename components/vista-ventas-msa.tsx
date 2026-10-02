"use client"

import { useEffect, useState } from "react"
import type { UserRole } from "@/lib/auth/roles"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, RefreshCw, Search, Pencil, Trash2, Link2, CheckCircle2, AlertTriangle, FileText } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { ModalVentaMsa, type VentaMsa } from "./modal-venta-msa"
import { normalizarBusqueda } from "@/lib/normalizar-texto"
import { kgQueSeCobran, promedioKg } from "@/lib/ventas/hacienda"
import { cargarVentasHacienda, liquidacionDeVenta, type VentaHaciendaDatos } from "@/lib/ventas/hacienda-db"
import { ModalLiquidacionHacienda } from "./modal-liquidacion-hacienda"
import { ModalVentaHistoricaHacienda } from "./modal-venta-historica-hacienda"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Props {
  userRole?: UserRole
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

/** Una venta de hacienda tal como la muestra esta solapa (A-BUG-1232). La forma vive en lib. */
type VentaHaciendaFila = VentaHaciendaDatos

export function VistaVentasMsa({ userRole = 'admin' }: Props) {
  const esAdmin = userRole === 'admin'
  const [ventas, setVentas] = useState<VentaMsa[]>([])
  const [conteoLiq, setConteoLiq] = useState<Map<string, number>>(new Map())
  // Agregado de facturas vinculadas por venta (para el control Venta↔Factura)
  const [aggLiq, setAggLiq] = useState<Map<string, { count: number; ton: number; total: number }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [ventaEditando, setVentaEditando] = useState<VentaMsa | null>(null)
  /**
   * 🐂 A-BUG-1232 — las ventas de HACIENDA, que se cargan en Productivo. Esta solapa sólo miraba
   * granos, y la venta de 55 novillos del 04/08 no aparecía en Ingresos aunque estaba en la base.
   * Se leen de `ventas_unificadas` —la vista que ya junta todas las ventas y usan otras cinco
   * pantallas— y se completan con los kilos y el desbaste de `stock_ventas`. Sólo lectura: se
   * siguen cargando y editando en Productivo.
   */
  const [ventasHacienda, setVentasHacienda] = useState<VentaHaciendaFila[]>([])
  const [errorHacienda, setErrorHacienda] = useState<string | null>(null)
  /** 🧾 A-FEAT-1225 — la liquidación de hacienda: abierta desde una venta (precargada) o suelta. */
  const [liqAbierta, setLiqAbierta] = useState(false)
  /** Las ventas que liquida el papel: una, varias (Arre Beef: vacas y toros en una sola), o ninguna. */
  const [liqVentas, setLiqVentas] = useState<VentaHaciendaFila[]>([])
  /** Con id: se EDITA esa liquidación en vez de crear otra (2026-10-02 — no duplicar). */
  const [liqEditarId, setLiqEditarId] = useState<string | null>(null)
  /** Ventas tildadas para liquidar juntas. */
  const [tildadas, setTildadas] = useState<Set<string>>(new Set())
  /** 🕰️ A-FEAT-1226 — alta de una venta anterior al stock de la app (no descuenta stock). */
  const [historicaAbierta, setHistoricaAbierta] = useState(false)

  const abrirLiquidacion = (vs: VentaHaciendaFila[]) => { setLiqEditarId(null); setLiqVentas(vs); setLiqAbierta(true) }
  /**
   * 🔑 *Liquidar* sobre una venta YA liquidada abre ESA liquidación para editarla. El usuario creía
   * que volver a liquidar era editar, y en realidad creaba otra (2026-10-02).
   */
  const liquidarOEditar = async (h: VentaHaciendaFila) => {
    if (h.liquidado > 0) {
      try {
        const id = await liquidacionDeVenta(supabase, h.id)
        if (id) { setLiqVentas([]); setLiqEditarId(id); setLiqAbierta(true); return }
      } catch (err) {
        toast.error('No se pudo buscar la liquidación de la venta: ' + (err as Error).message); return
      }
    }
    abrirLiquidacion([h])
  }

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
        .select('venta_id, comprobante_id')
      // Traer datos de las facturas vinculadas para el control (toneladas + total)
      const compIds = [...new Set((pivot || []).map((r: any) => r.comprobante_id).filter(Boolean))]
      const { data: comps } = compIds.length
        ? await supabase.schema('msa').from('comprobantes_venta').select('id, toneladas, imp_total').in('id', compIds)
        : { data: [] }
      const compMap = new Map<string, any>((comps || []).map((c: any) => [c.id, c]))
      const conteo = new Map<string, number>()
      const agg = new Map<string, { count: number; ton: number; total: number }>()
      for (const row of (pivot || []) as { venta_id: string; comprobante_id: string }[]) {
        conteo.set(row.venta_id, (conteo.get(row.venta_id) || 0) + 1)
        const a = agg.get(row.venta_id) || { count: 0, ton: 0, total: 0 }
        const comp = compMap.get(row.comprobante_id)
        a.count += 1
        a.ton += Number(comp?.toneladas) || 0
        a.total += Number(comp?.imp_total) || 0
        agg.set(row.venta_id, a)
      }
      setConteoLiq(conteo)
      setAggLiq(agg)
    } catch (err) {
      toast.error('Error cargando ventas: ' + (err as Error).message)
    }

    // 🐂 Hacienda, aparte: si falla, no se lleva puestas las de granos — y se dice, no se calla.
    try {
      setErrorHacienda(null)
      // Mismo lector que usa la liquidación (lib/ventas/hacienda-db.ts): una sola lectura de la venta.
      setVentasHacienda(await cargarVentasHacienda(supabase))
      setTildadas(new Set())
    } catch (err) {
      setErrorHacienda((err as Error).message)
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

  const haciendaFiltrada = busqueda.trim()
    ? ventasHacienda.filter(h => {
        const q = normalizarBusqueda(busqueda)
        return normalizarBusqueda(h.cliente).includes(q) || h.cuit.includes(q)
          || normalizarBusqueda(h.categoria || '').includes(q)
      })
    : ventasHacienda

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
            placeholder="Buscar cliente, CUIT, grano, categoría..."
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
            /* Un solo botón para toda venta (2026-10-02, «estamos perdiendo consistencia»): adentro se
               elige granos o hacienda, y en hacienda, si es histórica. */
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" />Nueva venta
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={abrirAlta}>🌾 Agrícola (granos)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setHistoricaAbierta(true)}>🐂 Ganadera (hacienda)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  <TableHead className="text-center">Control fact.</TableHead>
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
                        {(() => {
                          const agg = aggLiq.get(v.id)
                          if (!agg || agg.count === 0) return <span className="text-xs text-gray-400" title="Venta sin facturar">— sin facturar</span>
                          const ventaTon = Number(v.toneladas) || 0
                          const ventaTotal = c.total
                          const difTon = Math.abs(ventaTon - agg.ton)
                          const difTotal = Math.abs(ventaTotal - agg.total)
                          const tonOk = difTon < 0.5
                          const totalOk = difTotal < Math.max(ventaTotal * 0.01, 100)
                          const cuadra = tonOk && totalOk
                          const tip = `Venta: ${fmtAR(ventaTon)} tn · ${fmtMoney(ventaTotal)}\nFacturado: ${fmtAR(agg.ton)} tn · ${fmtMoney(agg.total)}` +
                            (cuadra ? '' : `\n${!tonOk ? `Δ ton ${fmtAR(difTon)} ` : ''}${!totalOk ? `Δ total ${fmtMoney(difTotal)}` : ''}`)
                          return (
                            <Badge variant="outline" className={cuadra ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'} title={tip}>
                              {cuadra ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                              {nLiq} {cuadra ? 'cuadra' : 'revisar'}
                            </Badge>
                          )
                        })()}
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

      {/* 🐂 A-BUG-1232 — las ventas de hacienda de Productivo, vistas desde Ingresos. */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-3">
          <h3 className="text-base font-semibold">🐂 Ventas de hacienda</h3>
          <span className="text-xs text-gray-500">Las del stock se cargan en Productivo → Movimientos; las históricas, con Nueva venta → Ganadera. Acá se liquidan: tildá varias si vienen en un solo papel.</span>
          {esAdmin && (
            <div className="ml-auto flex gap-2">
              {tildadas.size > 0 && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700"
                  onClick={() => abrirLiquidacion(ventasHacienda.filter(v => tildadas.has(v.id)))}
                  title="Un solo papel para varias ventas: una línea por cada una">
                  <FileText className="mr-1 h-3.5 w-3.5" />Liquidar las {tildadas.size} juntas
                </Button>
              )}
            </div>
          )}
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" title="Tildá varias para liquidarlas en un solo papel" />
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Cabezas</TableHead>
                    <TableHead className="text-right">Kg</TableHead>
                    <TableHead className="text-right" title="Desbaste: los kilos que se descuentan antes de pagar">Desbaste</TableHead>
                    <TableHead className="text-right" title="Los kilos que se cobran: después del desbaste, o los de carne si la venta es al gancho">Kg que se cobran</TableHead>
                    <TableHead className="text-right">Prom.</TableHead>
                    <TableHead className="text-right">Precio/kg</TableHead>
                    <TableHead className="text-right">Neto venta</TableHead>
                    <TableHead>Plazo</TableHead>
                    <TableHead className="text-center">Liquidación</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorHacienda ? (
                    <TableRow><TableCell colSpan={14} className="text-center py-6 text-red-600">
                      No se pudieron leer las ventas de hacienda: {errorHacienda}
                    </TableCell></TableRow>
                  ) : loading ? (
                    <TableRow><TableCell colSpan={14} className="text-center py-6 text-gray-500">Cargando…</TableCell></TableRow>
                  ) : haciendaFiltrada.length === 0 ? (
                    <TableRow><TableCell colSpan={14} className="text-center py-6 text-gray-500">
                      {ventasHacienda.length === 0 ? 'No hay ventas de hacienda cargadas en Productivo.' : 'No hay resultados para la búsqueda.'}
                    </TableCell></TableRow>
                  ) : haciendaFiltrada.map(h => {
                    const kgNetos = kgQueSeCobran(h)
                    const desbaste = h.pctDesbaste ? fmtAR(h.pctDesbaste * 100, 1) + ' %' : '—'
                    return (
                      <TableRow key={h.id} className="hover:bg-gray-50">
                        <TableCell>
                          {esAdmin && h.liquidado <= 0 && (
                            <input type="checkbox" aria-label="Liquidar junto con otras" checked={tildadas.has(h.id)}
                              onChange={e => setTildadas(t => { const n = new Set(t); e.target.checked ? n.add(h.id) : n.delete(h.id); return n })} />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fmtFecha(h.fecha)}</TableCell>
                        <TableCell>
                          {h.cliente}
                          {h.cuit && <div className="text-xs text-gray-400">{h.cuit}</div>}
                          {h.historica && <Badge variant="outline" className="mt-0.5 bg-amber-50 text-amber-800" title="Anterior al stock de la app: no descontó stock">histórica</Badge>}
                        </TableCell>
                        <TableCell>{h.categoria || <span className="text-amber-600 text-xs">sin categoría</span>}</TableCell>
                        <TableCell className="text-right">{fmtAR(h.cabezas, 0)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtAR(h.kgTotales, 0)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{desbaste}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtAR(kgNetos, 1)}{h.kgCarne ? <span className="text-xs text-gray-500"> carne</span> : null}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtAR(promedioKg(h.kgTotales, h.cabezas), 0)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtMoney(h.precioKg)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-semibold">{fmtMoney(h.neto)}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{h.plazo || '—'}</TableCell>
                        <TableCell className="text-center">
                          {h.liquidado > 0
                            ? <Badge variant="outline" className="bg-green-50 text-green-700" title={'Vinculado: ' + fmtMoney(h.liquidado)}><CheckCircle2 className="h-3 w-3 mr-1" />liquidada</Badge>
                            : <span className="text-xs text-gray-400">— sin liquidar</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {esAdmin && (
                            <Button size="sm" variant="ghost" onClick={() => liquidarOEditar(h)}
                              title={h.liquidado > 0 ? 'Abrir la liquidación de esta venta para verla o corregirla' : 'Cargar la liquidación de esta venta — viene precargada con sus datos'}>
                              <FileText className="h-3.5 w-3.5 mr-1" />{h.liquidado > 0 ? 'Ver / editar' : 'Liquidar'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ModalVentaHistoricaHacienda open={historicaAbierta} onOpenChange={setHistoricaAbierta} onGuardado={cargar} />
      <ModalLiquidacionHacienda open={liqAbierta} onOpenChange={setLiqAbierta} ventas={liqVentas} comprobanteId={liqEditarId} onGuardado={cargar} />

      <ModalVentaMsa
        open={modalAbierto}
        onOpenChange={setModalAbierto}
        ventaInicial={ventaEditando}
        onGuardado={cargar}
      />
    </div>
  )
}
