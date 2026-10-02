"use client"

import { useEffect, useState, Fragment } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, Search, ChevronRight, ChevronDown, Landmark, Percent } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { normalizarBusqueda } from "@/lib/normalizar-texto"
import { toast } from "sonner"
import { TIPOS_LIQ_HACIENDA } from "@/lib/ventas/cobro-esperado"
import { marcarCuota, repartirEnCuotas, controlCuotas, type PlazoCobro } from "@/lib/ventas/hacienda"
import { armarDetalleCobro, imputacionesDeCobro, ETIQUETA_MEDIO, type FuentesCobro } from "@/lib/ventas/detalle-cobro"
import { cargarFuentesCobro, pagosACuentaSinVincular, vincularPagoACuenta } from "@/lib/ventas/detalle-cobro-db"
import { parseNumeroAR } from "@/lib/format/numero"

/**
 * Control de cobros de ventas: cada factura/liquidación de venta contra sus cobros.
 *   ⚠️ Cambió 2026-10-02 (A-FEAT-1228): el cobro de un comprobante es su DETALLE DEL COBRO
 *   (`lib/ventas/detalle-cobro.ts`) — banco directo, pagos a cuenta vinculados (transferencia o
 *   echeq, también endosado), compensaciones con facturas del cliente y retenciones. Antes sólo
 *   contaba el banco, y los pagos a cuenta vinculados no restaban.
 *   Saldo = imp_total − retenciones impresas (hacienda) − Σ detalle. Saldo 0 = cobrada.
 *   Con cuotas (plazos), el saldo es lo que queda por entrar en las cuotas no cobradas.
 */

interface Factura {
  id: string
  nro_comprobante: string | null
  cuit_cliente: string | null
  denominacion_cliente: string | null
  imp_total: number | null
  estado: string | null
  fecha_liquidacion: string | null
  fecha_cobro_estimada: string | null
  tipo_comprobante: number | null
  ret_iva: number | null
  ret_iibb: number | null
  plazos: PlazoCobro[] | null
}
interface Cobro { id: string; fecha: string | null; creditos: number; concepto: string | null; detalle: string | null }
interface Ret { id: string; tipo: string; monto: number; cuenta_contable: string | null; fecha: string | null }

const fmt = (n: number) => `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtFecha = (s: string | null) => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }

export function VistaCobrosVenta() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [cobrosPorFac, setCobrosPorFac] = useState<Map<string, Cobro[]>>(new Map())
  const [retsPorFac, setRetsPorFac] = useState<Map<string, Ret[]>>(new Map())
  /** 💰 Las fuentes del detalle del cobro de cada comprobante (A-FEAT-1228). */
  const [fuentes, setFuentes] = useState<Map<string, FuentesCobro>>(new Map())
  /** Pagos a cuenta del cliente del comprobante abierto, todavía sin vincular. */
  const [sinVincular, setSinVincular] = useState<Awaited<ReturnType<typeof pagosACuentaSinVincular>>>([])
  const [vinculando, setVinculando] = useState<string | null>(null)
  /** Alta de un echeq del cliente que se endosó (no pasa por el banco). */
  const [echeqForm, setEcheqForm] = useState<{ fecha: string; monto: string; numero: string; endosadoA: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [expandida, setExpandida] = useState<string | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data: facs } = await supabase.schema('msa').from('comprobantes_venta')
        .select('id, nro_comprobante, cuit_cliente, denominacion_cliente, imp_total, estado, fecha_liquidacion, fecha_cobro_estimada, tipo_comprobante, ret_iva, ret_iibb, plazos')
        .neq('estado', 'anterior')
        .order('fecha_liquidacion', { ascending: false, nullsFirst: false })
      const lista = (facs as Factura[]) || []
      setFacturas(lista)
      const ids = lista.map(f => f.id)

      const cMap = new Map<string, Cobro[]>()
      const rMap = new Map<string, Ret[]>()
      if (ids.length > 0) {
        const [{ data: cobros }, { data: rets }] = await Promise.all([
          supabase.from('msa_galicia')
            .select('id, fecha, creditos, concepto, detalle, comprobante_venta_id')
            .in('comprobante_venta_id', ids),
          supabase.schema('msa').from('retenciones_recibidas')
            .select('id, tipo, monto, cuenta_contable, comprobante_venta_id, fecha')
            .in('comprobante_venta_id', ids),
        ])
        ;(cobros || []).forEach((c: any) => {
          const arr = cMap.get(c.comprobante_venta_id) || []; arr.push(c); cMap.set(c.comprobante_venta_id, arr)
        })
        ;(rets || []).forEach((r: any) => {
          const arr = rMap.get(r.comprobante_venta_id) || []; arr.push(r); rMap.set(r.comprobante_venta_id, arr)
        })
      }
      setCobrosPorFac(cMap)
      setRetsPorFac(rMap)
      setFuentes(await cargarFuentesCobro(supabase, lista.map(f => ({ id: f.id, cuit_cliente: f.cuit_cliente }))))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  /**
   * 🐂 A-FEAT-1225 — en una liquidación de HACIENDA la retención viene IMPRESA en el papel
   * (`ret_iibb`, `ret_iva`), no como certificado aparte. El usuario lo vio el 2026-10-02: el saldo
   * decía $98.421.383,13 con «Retenc. $0», cuando lo que se cobra es $97.745.477,95. Para ese tipo se
   * suman las impresas, que es la misma cuenta que `cobroEsperado()`. (Para el resto de los
   * comprobantes no cambia nada: es el tema aparte de A-BUG-1231.)
   */
  const impresas = (f: Factura) => (TIPOS_LIQ_HACIENDA.has(Number(f.tipo_comprobante)) ? (Number(f.ret_iibb) || 0) + (Number(f.ret_iva) || 0) : 0)
  /**
   * 📅 Las cuotas de una liquidación con plazos, con las retenciones cargadas aparte repartidas en la
   * cuota de SU FECHA (`repartirEnCuotas`, la misma cuenta que usa el Cash Flow). Pedido del usuario
   * 2026-10-02: la retención de Ganancias del 03/09 «quedó como general» y las cuotas no bajaban.
   */
  const derivados = (f: Factura) => {
    const total = Number(f.imp_total) || 0
    // Lo que el papel dice que se cobra: el total menos la retención impresa (hacienda).
    const esperado = total - impresas(f)
    const detalle = armarDetalleCobro(fuentes.get(f.id) || { movimientos: [], anticipos: [], compensaciones: [], retenciones: [] }, esperado)
    const retAparte = detalle.porMedio.retencion || 0
    const retenido = retAparte + impresas(f)
    /**
     * 📅 Con cuotas: lo imputado (pagos a cuenta, compensaciones, retenciones) va a la cuota de su
     * fecha; el saldo es lo que queda por entrar en las cuotas no cobradas ni conciliadas.
     * Sin cuotas: el saldo del detalle.
     */
    const imputaciones = imputacionesDeCobro(detalle.lineas)
    const cuotas = (f.plazos || []).length ? repartirEnCuotas(f.plazos, 0, imputaciones, '') : []
    const saldo = cuotas.length
      ? cuotas.filter(q => q.estado !== 'cobrado' && !(f.plazos || [])[q.n - 1]?.movimiento_id).reduce((s, q) => s + q.aCobrar, 0)
      : detalle.saldo
    // Lo cobrado es lo que cierra la cuenta: total − retenido − saldo. Así las tres columnas siempre suman.
    const cobrado = total - retenido - saldo
    const control = cuotas.length
      ? controlCuotas(cuotas, esperado, imputaciones.reduce((s, i) => s + i.monto, 0))
      : null
    return { total, cobrado, retenido, saldo, cuotas, control, detalle }
  }

  /** Al abrir un comprobante, se buscan los pagos a cuenta de ese cliente todavía sin vincular. */
  const abrir = async (f: Factura | null) => {
    setExpandida(f ? f.id : null)
    setSinVincular([]); setEcheqForm(null)
    if (!f?.cuit_cliente) return
    try { setSinVincular(await pagosACuentaSinVincular(supabase, f.cuit_cliente)) }
    catch (err) { toast.error('No se pudieron leer los pagos a cuenta: ' + (err as Error).message) }
  }

  /** 🔗 Vincular un pago a cuenta a este comprobante — el MISMO camino que el asistente del Cash Flow. */
  const vincular = async (f: Factura, a: Awaited<ReturnType<typeof pagosACuentaSinVincular>>[number]) => {
    setVinculando(a.id)
    try {
      const d = derivados(f)
      const saldada = d.detalle.saldo - (Number(a.monto) || 0) <= 0.01
      const r = await vincularPagoACuenta(supabase, { ...a, monto: Number(a.monto) || 0 }, { id: f.id },
        { saldada, movimientoConciliado: a.estado_pago === 'conciliado' })
      toast.success(`Pago a cuenta de ${fmt(Number(a.monto))} vinculado a ${f.nro_comprobante}.` + (r.extractoActualizado ? ' Movimiento del banco atado.' : ''))
      await cargar(); await abrir(f)
    } catch (err) {
      toast.error('No se pudo vincular: ' + (err as Error).message)
    } finally { setVinculando(null) }
  }

  /**
   * 🔁 Registrar un echeq del cliente que se ENDOSÓ a un tercero: un cobro que nunca pasa por el
   * banco. Queda como pago a cuenta (echeq, `endosado`) vinculado a este comprobante — así no se
   * espera en el Cash Flow ni se busca en el extracto (scripts/71).
   */
  const registrarEcheq = async (f: Factura) => {
    if (!echeqForm) return
    const monto = parseNumeroAR(echeqForm.monto)
    if (!echeqForm.fecha || !(monto > 0)) { toast.error('Falta la fecha o el monto del echeq'); return }
    setVinculando('echeq')
    try {
      const { data, error } = await supabase.from('anticipos_proveedores').insert({
        tipo: 'cobro', cuit_proveedor: f.cuit_cliente, nombre_proveedor: f.denominacion_cliente,
        monto, monto_restante: monto, fecha_pago: echeqForm.fecha, metodo_pago: 'echeq', estado_pago: 'endosado',
        estado: 'pendiente_vincular', empresa: 'MSA',
        descripcion: `Echeq${echeqForm.numero ? ' Nº ' + echeqForm.numero : ''} endosado${echeqForm.endosadoA ? ' a ' + echeqForm.endosadoA : ''}`,
      }).select('id, fecha_pago, monto, metodo_pago, estado_pago, descripcion, cuit_proveedor, nro_cuenta').single()
      if (error) throw error
      await vincular(f, data as any)
      setEcheqForm(null)
    } catch (err) {
      toast.error('No se pudo registrar el echeq: ' + (err as Error).message)
    } finally { setVinculando(null) }
  }

  /**
   * ✅ Marcar una cuota cobrada — EL MISMO cambio que marcarla en el Cash Flow (`marcarCuota`).
   * «Son 2 lugares donde se puede marcar como cobrado, pero el cambio en BBDD debe ser el mismo.»
   */
  const [marcando, setMarcando] = useState<string | null>(null)
  const cambiarCuota = async (f: Factura, i: number, estado: 'cobrado' | 'a cobrar') => {
    setMarcando(f.id + '#' + i)
    try {
      const r = marcarCuota(f.plazos || [], i, estado, f.estado)
      const { error, count } = await supabase.schema('msa').from('comprobantes_venta')
        .update({ plazos: r.plazos, estado: r.estadoComprobante }, { count: 'exact' }).eq('id', f.id)
      if (error) throw error
      if (count === 0) throw new Error('No se encontró el comprobante: el cambio NO se guardó')
      toast.success(estado === 'cobrado' ? `Cuota ${i + 1} marcada cobrada` : `Cuota ${i + 1} vuelta a «a cobrar»`)
      await cargar()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    } finally {
      setMarcando(null)
    }
  }

  const filtradas = facturas.filter(f => {
    const q = normalizarBusqueda(busqueda)
    if (!q) return true
    return [f.nro_comprobante, f.denominacion_cliente, f.cuit_cliente].some(x => normalizarBusqueda(x || '').includes(q))
  })

  // Totales
  const tot = filtradas.reduce((acc, f) => {
    const d = derivados(f)
    acc.total += d.total; acc.cobrado += d.cobrado; acc.retenido += d.retenido; acc.saldo += d.saldo
    return acc
  }, { total: 0, cobrado: 0, retenido: 0, saldo: 0 })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar por cliente, CUIT, nro..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Button variant="outline" onClick={cargar}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="rounded border bg-gray-50 p-2">Facturado<br /><b>{fmt(tot.total)}</b></div>
        <div className="rounded border bg-green-50 p-2">Cobrado<br /><b className="text-green-700">{fmt(tot.cobrado)}</b></div>
        <div className="rounded border bg-orange-50 p-2">Retenciones<br /><b className="text-orange-700">{fmt(tot.retenido)}</b></div>
        <div className="rounded border bg-blue-50 p-2">Saldo a cobrar<br /><b className="text-blue-700">{fmt(tot.saldo)}</b></div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="text-xs">Comprobante</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs text-right">Total</TableHead>
              <TableHead className="text-xs text-right">Cobrado</TableHead>
              <TableHead className="text-xs text-right">Retenc.</TableHead>
              <TableHead className="text-xs text-right">Saldo</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="h-20 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-20 text-center text-muted-foreground text-sm">Sin facturas de venta</TableCell></TableRow>
            ) : filtradas.map(f => {
              const d = derivados(f)
              const abierta = expandida === f.id
              const rets = retsPorFac.get(f.id) || []
              const saldado = Math.abs(d.saldo) < 0.01
              return (
                <Fragment key={f.id}>
                  <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => void abrir(abierta ? null : f)}>
                    <TableCell>{abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                    <TableCell className="text-sm font-mono">{f.nro_comprobante || '—'}</TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate" title={f.denominacion_cliente || ''}>{f.denominacion_cliente || '—'}</TableCell>
                    <TableCell className="text-sm text-right">{fmt(d.total)}</TableCell>
                    <TableCell className="text-sm text-right text-green-700">{fmt(d.cobrado)}</TableCell>
                    <TableCell className="text-sm text-right text-orange-700">{fmt(d.retenido)}</TableCell>
                    <TableCell className={`text-sm text-right font-medium ${saldado ? 'text-gray-400' : 'text-blue-700'}`}>{fmt(d.saldo)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${f.estado === 'conciliado' ? 'bg-green-100 text-green-800' : f.estado === 'cobrado' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{f.estado}</Badge>
                    </TableCell>
                  </TableRow>
                  {abierta && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-gray-50/60 p-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            {/* 💰 Cómo se fue cobrando (A-FEAT-1228): todo menos las retenciones, que van a la derecha. */}
                            {(() => {
                              const lineas = d.detalle.lineas.filter(l => l.medio !== 'retencion')
                              return (<>
                                <div className="text-xs font-medium text-green-700 flex items-center gap-1 mb-1"><Landmark className="h-3.5 w-3.5" />Detalle del cobro ({lineas.length})</div>
                                {lineas.length === 0 ? <div className="text-xs text-gray-400">Sin cobros registrados aún</div> : lineas.map(l => (
                                  <div key={l.medio + l.ref} className="text-xs flex justify-between gap-2 border-b py-0.5">
                                    <span>{fmtFecha(l.fecha)} · <b className="font-medium">{ETIQUETA_MEDIO[l.medio]}</b>{l.descripcion && l.descripcion !== ETIQUETA_MEDIO[l.medio] ? ` · ${l.descripcion}` : ''}</span>
                                    <span className="text-green-700 whitespace-nowrap">{fmt(l.monto)}</span>
                                  </div>
                                ))}
                              </>)
                            })()}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-orange-700 flex items-center gap-1 mb-1"><Percent className="h-3.5 w-3.5" />Retenciones ({rets.length + (impresas(f) > 0 ? 1 : 0)})</div>
                            {impresas(f) > 0 && (
                              <div className="text-xs flex justify-between border-b py-0.5">
                                <span>IMPRESA EN LA LIQUIDACIÓN{Number(f.ret_iibb) ? ' · IIBB' : ''}{Number(f.ret_iva) ? ' · IVA' : ''}</span>
                                <span className="text-orange-700">{fmt(impresas(f))}</span>
                              </div>
                            )}
                            {rets.length === 0 && impresas(f) === 0 ? <div className="text-xs text-gray-400">Sin retenciones</div> : rets.map(r => (
                              <div key={r.id} className="text-xs flex justify-between border-b py-0.5">
                                <span>{fmtFecha(r.fecha)} · {r.tipo?.toUpperCase()} · {r.cuenta_contable || 's/cuenta'}</span>
                                <span className="text-orange-700">{fmt(r.monto)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* 🧮 El control del detalle: lo cobrado + lo retenido contra lo que dice el papel. */}
                        <div className={'mt-2 text-[11px] ' + (d.detalle.cierra ? 'text-green-700' : 'text-blue-800')}>
                          {d.detalle.cierra
                            ? <>✓ El detalle cierra: {fmt(d.detalle.total)} cobrados y retenidos = lo que dice el papel ({fmt(d.detalle.esperado)})</>
                            : d.detalle.saldo > 0
                              ? <>Detalle: {fmt(d.detalle.total)} de {fmt(d.detalle.esperado)} que dice el papel — <b>faltan {fmt(d.detalle.saldo)}</b> (por cobrar, o algo sin cargar: una retención, un echeq, una factura del cliente descontada)</>
                              : <>⚠️ El detalle suma {fmt(d.detalle.total)}, <b>{fmt(-d.detalle.saldo)} más</b> de lo que dice el papel ({fmt(d.detalle.esperado)}): revisá si hay algo cargado dos veces</>}
                        </div>

                        {/* 🔗 Pagos a cuenta del cliente que todavía no están vinculados a ningún comprobante. */}
                        {sinVincular.length > 0 && (
                          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2">
                            <div className="text-xs font-medium text-amber-900 mb-1">Pagos a cuenta de este cliente sin vincular ({sinVincular.length})</div>
                            {sinVincular.map(a => (
                              <div key={a.id} className="text-xs flex items-center gap-3 border-b border-amber-100 py-1">
                                <span className="w-24">{fmtFecha(a.fecha_pago)}</span>
                                <span className="flex-1 truncate">{a.estado_pago === 'endosado' ? 'Echeq endosado' : a.metodo_pago === 'echeq' ? 'Echeq' : 'Transferencia'}{a.descripcion ? ` · ${a.descripcion}` : ''}</span>
                                <span className="w-32 text-right tabular-nums">{fmt(Number(a.monto))}</span>
                                <Button size="sm" variant="outline" className="h-6 text-xs px-2" disabled={!!vinculando}
                                  onClick={(e) => { e.stopPropagation(); void vincular(f, a) }}>
                                  {vinculando === a.id ? 'Vinculando…' : 'Vincular'}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 🔁 Un echeq del cliente que se endosó: no pasa por el banco. */}
                        <div className="mt-2" onClick={e => e.stopPropagation()}>
                          {echeqForm ? (
                            <div className="flex flex-wrap items-end gap-2 rounded border bg-white p-2 text-xs">
                              <label className="grid gap-0.5">Fecha<Input type="date" className="h-7 text-xs w-36" value={echeqForm.fecha} onChange={e => setEcheqForm({ ...echeqForm, fecha: e.target.value })} /></label>
                              <label className="grid gap-0.5">Monto<Input type="text" placeholder="0,00" className="h-7 text-xs w-32" value={echeqForm.monto} onChange={e => setEcheqForm({ ...echeqForm, monto: e.target.value })} /></label>
                              <label className="grid gap-0.5">Número<Input type="text" className="h-7 text-xs w-28" value={echeqForm.numero} onChange={e => setEcheqForm({ ...echeqForm, numero: e.target.value })} /></label>
                              <label className="grid gap-0.5">Endosado a<Input type="text" className="h-7 text-xs w-48" value={echeqForm.endosadoA} onChange={e => setEcheqForm({ ...echeqForm, endosadoA: e.target.value })} /></label>
                              <Button size="sm" className="h-7 text-xs" disabled={!!vinculando} onClick={() => void registrarEcheq(f)}>{vinculando === 'echeq' ? 'Guardando…' : 'Registrar y vincular'}</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEcheqForm(null)}>Cancelar</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-gray-600"
                              onClick={() => setEcheqForm({ fecha: '', monto: '', numero: '', endosadoA: '' })}>
                              + Registrar un echeq del cliente que endosaste
                            </Button>
                          )}
                        </div>

                        {/* 📅 Las cuotas del papel, con «cobrada» por cuota — lo mismo que el verde del Cash Flow. */}
                        {(f.plazos || []).length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-gray-700 mb-1">Cuotas ({(f.plazos || []).filter(q => q.estado === 'cobrado').length} de {(f.plazos || []).length} cobradas)</div>
                            <div className="text-[10px] text-gray-500 flex gap-3 pb-0.5">
                              <span className="w-24">Vence</span><span className="w-16" />
                              <span className="w-32 text-right">Cuota del papel</span>
                              <span className="w-28 text-right">− Retenciones</span>
                              <span className="w-32 text-right">= Entra al banco</span>
                            </div>
                            {(f.plazos || []).map((q, i) => (
                              <div key={i} className="text-xs flex items-center gap-3 border-b py-1">
                                <span className="w-24">{fmtFecha(q.vencimiento)}</span>
                                <span className="w-16 text-gray-500">{q.dias} días</span>
                                <span className="w-32 text-right tabular-nums">{fmt(q.importe)}</span>
                                <span className="w-28 text-right tabular-nums text-orange-700">{d.cuotas[i]?.imputado ? '− ' + fmt(d.cuotas[i].imputado) : '—'}</span>
                                <span className="w-32 text-right tabular-nums font-medium">{fmt(d.cuotas[i]?.aCobrar ?? Number(q.importe))}</span>
                                <span className={'w-20 ' + (q.estado === 'cobrado' ? 'text-green-700 font-medium' : 'text-gray-500')}>{q.movimiento_id ? '✓ conciliada' : q.estado === 'cobrado' ? '✓ cobrada' : 'a cobrar'}</span>
                                {/* Conciliada contra el banco: se suelta desconciliando el movimiento, no desde acá (A-BUG-1234). */}
                                {f.estado !== 'conciliado' && !q.movimiento_id && (
                                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" disabled={marcando === f.id + '#' + i}
                                    onClick={(e) => { e.stopPropagation(); void cambiarCuota(f, i, q.estado === 'cobrado' ? 'a cobrar' : 'cobrado') }}>
                                    {q.estado === 'cobrado' ? 'Volver a a cobrar' : 'Marcar cobrada'}
                                  </Button>
                                )}
                              </div>
                            ))}
                            {/* 🧮 El control: las cuotas contra el papel, y que no quede retención sin repartir. */}
                            {d.control && (d.control.cierra
                              ? <div className="mt-1 text-[11px] text-green-700">✓ Las cuotas suman el importe neto del papel ({fmt(d.control.sumaCuotas)}) y las retenciones quedaron repartidas</div>
                              : <div className="mt-1 rounded border border-red-300 bg-red-50 p-1.5 text-[11px] text-red-800">
                                  ⚠️ Descuadre:
                                  {Math.abs(d.control.difPapel) > 0.01 && <> las cuotas suman {fmt(d.control.sumaCuotas)} y el importe neto del papel es {fmt(d.total - impresas(f))} (dif. {fmt(d.control.difPapel)}).</>}
                                  {Math.abs(d.control.sinRepartir) > 0.01 && <> Hay {fmt(d.control.sinRepartir)} de retenciones que superan lo que queda en las cuotas.</>}
                                </div>)}
                          </div>
                        )}
                        {!saldado && (
                          <div className="mt-2 text-xs text-blue-700">⚠️ Saldo pendiente: {fmt(d.saldo)} (Total {fmt(d.total)} − Cobrado {fmt(d.cobrado)} − Retenc. {fmt(d.retenido)})</div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
