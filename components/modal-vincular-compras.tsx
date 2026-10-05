"use client"

/**
 * 🧾 Vincular una factura con sus compras de insumos — A-BUG-1244.
 *
 * Se abre desde la FACTURA (Egresos → menú ⋯) o desde una o varias COMPRAS (Productivo → Insumos →
 * movimientos). Lista las compras del proveedor cerca de la fecha, cada una con su % de descuento, muestra
 * el control contra el neto de la factura, y al confirmar:
 *   · crea / actualiza los vínculos (`productivo.entrega_factura`) con el precio EN PESOS,
 *   · reescribe el precio de la compra (moneda, precio en esa moneda, TC y `costo_unitario` en pesos),
 *   · si el insumo no tenía costo en el stock, le carga éste (default del dato real; no pisa uno cargado).
 * El pactado y el % quedan en la nota del vínculo. La cuenta vive en `lib/productivo/compras-factura.ts`.
 */

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { calcularVinculo, pctQueCierra, type CompraParaVincular, type RenglonVinculo } from "@/lib/productivo/compras-factura"

interface FacturaLeida {
  id: string; fecha: string; proveedor: string; cuit: string; numero: string
  moneda: string; tcFactura: number; neto: number
}
interface CompraLeida extends CompraParaVincular {
  stockId: string
  /** Vinculada a OTRA factura (no a ésta). */
  otraFactura: boolean
  /** Ya vinculada a esta factura: el id del vínculo. */
  vinculoId: string | null
}

const sumarDias = (f: string, d: number) => { const x = new Date(f + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }
const parse = (v: string) => parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0
const fmt = (n: number, d = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })
const primeraPalabra = (s: string) => (s || '').trim().split(/\s+/)[0] || ''

export function ModalVincularCompras({
  abierto, onCerrar, onGuardado, facturaId, compraIds,
}: {
  abierto: boolean
  onCerrar: () => void
  onGuardado?: () => void
  /** Abierto desde la factura. */
  facturaId?: string | null
  /**
   * Abierto desde una o varias compras: se elige la factura acá adentro.
   * ⚠️ Sólo esas vienen tildadas. Usuario 2026-10-05: *«¿por qué si toco en 1 se abriría con las 7? No
   * sabemos cómo van a facturar; tal vez hacen 3 facturas para los 7 insumos»*.
   */
  compraIds?: string[] | null
}) {
  const [factura, setFactura] = useState<FacturaLeida | null>(null)
  const [candidatas, setCandidatas] = useState<FacturaLeida[]>([])
  const [compras, setCompras] = useState<CompraLeida[]>([])
  const [renglones, setRenglones] = useState<RenglonVinculo[]>([])
  const [pctMasivo, setPctMasivo] = useState('')
  const [tc, setTc] = useState('')
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const arca = () => supabase.schema('msa').from('comprobantes_arca')
  const COLS = 'id, fecha_emision, denominacion_emisor, cuit, punto_venta, numero_desde, imp_neto_gravado, imp_neto_no_gravado, imp_op_exentas, moneda, tipo_cambio'
  const aFactura = (f: any): FacturaLeida => ({
    id: f.id, fecha: f.fecha_emision, proveedor: f.denominacion_emisor || '', cuit: f.cuit || '',
    numero: `${Number(f.punto_venta || 0)}-${Number(f.numero_desde || 0)}`,
    moneda: !f.moneda || f.moneda === 'PES' ? 'ARS' : f.moneda,
    tcFactura: Number(f.tipo_cambio) || 1,
    neto: (Number(f.imp_neto_gravado) || 0) + (Number(f.imp_neto_no_gravado) || 0) + (Number(f.imp_op_exentas) || 0),
  })

  // ── Abrir: la factura (o las candidatas, si se abrió desde una compra) ──
  useEffect(() => {
    if (!abierto) return
    setFactura(null); setCandidatas([]); setCompras([]); setRenglones([]); setPctMasivo('')
    ;(async () => {
      setCargando(true)
      try {
        if (facturaId) {
          const { data } = await arca().select(COLS).eq('id', facturaId).single()
          if (data) elegirFactura(aFactura(data))
        } else if (compraIds?.length) {
          const { data: m } = await supabase.schema('productivo').from('movimientos_insumos')
            .select('fecha, proveedor, cuit').eq('id', compraIds[0]).single()
          if (m) {
            const q = arca().select(COLS).gte('fecha_emision', sumarDias(m.fecha, -60)).lte('fecha_emision', sumarDias(m.fecha, 90))
            const { data } = m.cuit ? await q.eq('cuit', m.cuit) : await q.ilike('denominacion_emisor', `%${primeraPalabra(m.proveedor || '')}%`)
            const lista = (data || []).map(aFactura).sort((a, b) => a.fecha.localeCompare(b.fecha))
            setCandidatas(lista)
            if (lista.length === 1) elegirFactura(lista[0])
          }
        }
      } finally { setCargando(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, facturaId, (compraIds || []).join(',')])

  // ── Elegida la factura: sus compras candidatas ──
  const elegirFactura = async (f: FacturaLeida) => {
    setFactura(f)
    setTc(f.moneda === 'ARS' ? '' : fmt(f.tcFactura))
    const prod = supabase.schema('productivo')
    const desde = sumarDias(f.fecha, -120), hasta = sumarDias(f.fecha, 60)
    const SEL = 'id, fecha, cantidad, costo_unitario, costo_unitario_moneda, moneda, proveedor, cuit, insumo_stock_id, stock_insumos(producto, unidad_medida)'
    const [porCuit, porNombre] = await Promise.all([
      f.cuit ? prod.from('movimientos_insumos').select(SEL).eq('tipo', 'compra').eq('cuit', f.cuit).gte('fecha', desde).lte('fecha', hasta) : Promise.resolve({ data: [] as any[] }),
      prod.from('movimientos_insumos').select(SEL).eq('tipo', 'compra').ilike('proveedor', `%${primeraPalabra(f.proveedor)}%`).gte('fecha', desde).lte('fecha', hasta),
    ])
    const vistos = new Map<string, any>()
    for (const m of [...(porCuit.data || []), ...(porNombre.data || [])]) vistos.set(m.id, m)
    const movs = [...vistos.values()]
    const ids = movs.map(m => m.id)
    const { data: vincs } = ids.length
      ? await prod.from('entrega_factura').select('id, movimiento_id, factura_id').in('movimiento_id', ids)
      : { data: [] as any[] }
    const lista: CompraLeida[] = movs.map(m => {
      const deEsta = (vincs || []).find(v => v.movimiento_id === m.id && v.factura_id === f.id)
      return {
        id: m.id, fecha: m.fecha, stockId: m.insumo_stock_id,
        producto: m.stock_insumos?.producto || '(insumo)', unidad: m.stock_insumos?.unidad_medida || null,
        cantidad: Number(m.cantidad) || 0,
        // El pactado: el precio en la moneda de compra si ya se cargó; si no, el que tiene (el usuario
        // lo cargó en la moneda de la factura).
        precioPactado: m.costo_unitario_moneda != null ? Number(m.costo_unitario_moneda) : (m.costo_unitario != null ? Number(m.costo_unitario) : null),
        otraFactura: (vincs || []).some(v => v.movimiento_id === m.id && v.factura_id !== f.id),
        vinculoId: deEsta?.id ?? null,
      }
    }).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.producto.localeCompare(b.producto))
    setCompras(lista)
    // Tildadas: SÓLO las que eligió el usuario y las ya vinculadas a esta factura. No se adivina por
    // fecha: un proveedor puede facturar 7 entregas en 3 facturas.
    const elegidas = new Set(compraIds || [])
    setRenglones(lista.map(c => ({
      compraId: c.id,
      incluir: !!c.vinculoId || elegidas.has(c.id),
      pctDescuento: 0,
    })))
  }

  const facturaParaCalculo = factura ? { moneda: factura.moneda, neto: factura.neto, tc: factura.moneda === 'ARS' ? 1 : parse(tc) } : null
  const calc = useMemo(() => facturaParaCalculo ? calcularVinculo(facturaParaCalculo, compras, renglones) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [factura, compras, renglones, tc])

  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const setRenglon = (id: string, cambio: Partial<RenglonVinculo>) =>
    setRenglones(rs => rs.map(r => r.compraId === id ? { ...r, ...cambio } : r))
  const aplicarPctMasivo = (pct: number) =>
    setRenglones(rs => rs.map(r => marcadas.has(r.compraId) ? { ...r, pctDescuento: pct } : r))
  const sugerido = factura && marcadas.size ? pctQueCierra({ neto: factura.neto }, compras, renglones, marcadas) : null

  const usd = factura && factura.moneda !== 'ARS'
  const tcNum = parse(tc)
  const tcDistinto = usd && factura && Math.abs(tcNum - factura.tcFactura) > 0.001
  const puedeGuardar = !!calc && calc.renglones.length > 0 && calc.sinPrecio === 0 && (!usd || tcNum > 0)

  const guardar = async () => {
    if (!factura || !calc || !puedeGuardar) return
    setGuardando(true)
    try {
      const prod = supabase.schema('productivo')
      let stockConPrecio = 0
      for (const r of calc.renglones) {
        const c = compras.find(x => x.id === r.compra.id)!
        const pesos = r.precioPesos!
        const vinculo = {
          movimiento_id: c.id, factura_id: factura.id, empresa: 'MSA', origen: 'arca',
          cantidad: c.cantidad, precio_unitario: pesos, notas: r.nota,
        }
        const e1 = c.vinculoId
          ? (await prod.from('entrega_factura').update(vinculo).eq('id', c.vinculoId)).error
          : (await prod.from('entrega_factura').insert(vinculo)).error
        if (e1) throw new Error(`vínculo de ${c.producto}: ${e1.message}`)
        const e2 = (await prod.from('movimientos_insumos').update({
          moneda: factura.moneda === 'ARS' ? 'ARS' : 'USD',
          costo_unitario_moneda: r.precioReal,
          tipo_cambio: factura.moneda === 'ARS' ? null : tcNum,
          costo_unitario: pesos,
          monto_total: Math.round(c.cantidad * pesos * 100) / 100,
        }).eq('id', c.id)).error
        if (e2) throw new Error(`precio de ${c.producto}: ${e2.message}`)
        // Default del dato real: el stock sin costo toma el de esta compra. Uno ya cargado no se pisa.
        const { data: st } = await prod.from('stock_insumos').select('costo_unitario').eq('id', c.stockId).single()
        if (st && !(Number(st.costo_unitario) > 0)) {
          await prod.from('stock_insumos').update({ costo_unitario: pesos }).eq('id', c.stockId)
          stockConPrecio++
        }
      }
      // Destildadas que estaban vinculadas a esta factura: se desvinculan (el precio de la compra no se toca).
      const quitar = compras.filter(c => c.vinculoId && !renglones.find(r => r.compraId === c.id)?.incluir).map(c => c.vinculoId!)
      if (quitar.length) await prod.from('entrega_factura').delete().in('id', quitar)
      toast.success(`Factura ${factura.numero} vinculada a ${calc.renglones.length} compra(s)` +
        (stockConPrecio ? ` · ${stockConPrecio} insumo(s) del stock tomaron este costo` : '') +
        (quitar.length ? ` · ${quitar.length} desvinculada(s)` : ''))
      onGuardado?.()
      onCerrar()
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e as Error).message)
    } finally { setGuardando(false) }
  }

  const sim = usd ? factura!.moneda : '$'
  return (
    <Dialog open={abierto} onOpenChange={v => { if (!v) onCerrar() }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>🧾 Vincular factura con compras de insumos</DialogTitle></DialogHeader>
        <TestsDelProceso proceso="productivo/vincular-compras" pantalla="productivo" />
        {cargando && <p className="text-sm text-gray-500">Cargando…</p>}

        {!factura && !cargando && !!compraIds?.length && (
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">Elegí la factura de este proveedor:</p>
            {candidatas.length === 0 && <p className="text-amber-700">No encontré facturas de este proveedor entre 60 días antes y 90 después de la compra.</p>}
            {candidatas.map(f => (
              <button key={f.id} type="button" onClick={() => elegirFactura(f)}
                className="block w-full rounded border px-2 py-1 text-left hover:bg-blue-50">
                {f.fecha.split('-').reverse().join('/')} · FC {f.numero} · {f.proveedor} · neto {f.moneda === 'ARS' ? '$' : f.moneda + ' '}{fmt(f.neto)}
              </button>
            ))}
          </div>
        )}

        {factura && calc && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-4 rounded bg-gray-50 p-2">
              <span><b>FC {factura.numero}</b> · {factura.proveedor} · {factura.fecha.split('-').reverse().join('/')}</span>
              {/* Abierta desde compras, la factura se pudo haber elegido sola (era la única candidata): se puede cambiar. */}
              {!!compraIds?.length && (
                <button type="button" className="text-xs text-blue-700 underline"
                  onClick={() => { setFactura(null); setCompras([]); setRenglones([]); setMarcadas(new Set()) }}>
                  cambiar factura{candidatas.length > 1 ? ` (${candidatas.length} posibles)` : ''}
                </button>
              )}
              <span>Neto: <b>{sim} {fmt(factura.neto)}</b></span>
              {usd && (
                <label className="flex items-center gap-1">TC
                  <Input type="text" value={tc} onChange={e => setTc(e.target.value)} className="h-7 w-24 text-right" />
                  <span className="text-xs text-gray-500">(factura: {fmt(factura.tcFactura)})</span>
                </label>
              )}
            </div>
            {tcDistinto && (
              <p className="text-xs text-amber-700">⚠️ El TC es distinto al de la factura: el costo en pesos sale con el tuyo, pero el control del panel de entregas compara con el de la factura y va a mostrar la diferencia.</p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="p-1 w-6"></th><th className="p-1 text-left">Fecha</th><th className="p-1 text-left">Insumo</th>
                    <th className="p-1 text-right">Cantidad</th><th className="p-1 text-right">Pactado ({sim})</th>
                    <th className="p-1 text-right">% desc.</th><th className="p-1 text-right">Precio real</th>
                    <th className="p-1 text-right">Subtotal</th>{usd && <th className="p-1 text-right">$ unit.</th>}
                    <th className="p-1 w-6" title="Marcar para aplicar un % a varios">%</th>
                  </tr>
                </thead>
                <tbody>
                  {compras.map(c => {
                    const r = renglones.find(x => x.compraId === c.id)!
                    const rc = calc.renglones.find(x => x.compra.id === c.id)
                    return (
                      <tr key={c.id} className={r?.incluir ? '' : 'text-gray-400'}>
                        <td className="p-1"><input type="checkbox" checked={!!r?.incluir} onChange={e => setRenglon(c.id, { incluir: e.target.checked })} /></td>
                        <td className="p-1">{c.fecha.split('-').reverse().join('/')}</td>
                        <td className="p-1">{c.producto}{c.otraFactura && <span className="ml-1 text-[10px] text-amber-700">(ya vinculada a otra FC)</span>}</td>
                        <td className="p-1 text-right tabular-nums">{fmt(c.cantidad, 2)} {c.unidad || ''}</td>
                        <td className="p-1 text-right tabular-nums">{c.precioPactado != null ? fmt(c.precioPactado) : <span className="text-red-600">sin precio</span>}</td>
                        <td className="p-1 text-right">
                          <Input type="text" className="h-7 w-16 text-right" disabled={!r?.incluir}
                            value={r?.pctDescuento ? String(r.pctDescuento).replace('.', ',') : ''} placeholder="0"
                            onChange={e => setRenglon(c.id, { pctDescuento: parse(e.target.value) })} />
                        </td>
                        <td className="p-1 text-right tabular-nums">{rc?.precioReal != null ? fmt(rc.precioReal, 4) : '—'}</td>
                        <td className="p-1 text-right tabular-nums">{rc?.subtotal != null ? fmt(rc.subtotal) : '—'}</td>
                        {usd && <td className="p-1 text-right tabular-nums text-gray-600">{rc?.precioPesos != null ? fmt(rc.precioPesos) : '—'}</td>}
                        <td className="p-1"><input type="checkbox" checked={marcadas.has(c.id)} disabled={!r?.incluir}
                          onChange={e => setMarcadas(m => { const n = new Set(m); e.target.checked ? n.add(c.id) : n.delete(c.id); return n })} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* % de descuento a varios renglones a la vez — con el que hace cerrar como sugerencia */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-600">Descuento a los marcados en la columna «%» ({marcadas.size}):</span>
              <Input type="text" value={pctMasivo} onChange={e => setPctMasivo(e.target.value)} className="h-7 w-16 text-right" placeholder="2" />
              <Button size="sm" variant="outline" disabled={!marcadas.size || !pctMasivo} onClick={() => aplicarPctMasivo(parse(pctMasivo))}>Aplicar</Button>
              {sugerido != null && Math.abs(calc.dif) > 0.01 && (
                <button type="button" className="text-blue-700 underline" onClick={() => { setPctMasivo(String(sugerido).replace('.', ',')); aplicarPctMasivo(sugerido) }}>
                  el % que hace cerrar con esos: {String(sugerido).replace('.', ',')} %
                </button>
              )}
            </div>

            {/* 🧮 El control: contra el neto de la factura. Avisa, no frena (puede faltar un renglón o haber un flete). */}
            <div className={`rounded p-2 ${calc.cierra ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800 border border-amber-300'}`}>
              Compras vinculadas: <b>{sim} {fmt(calc.total)}</b> · Neto de la factura: <b>{sim} {fmt(factura.neto)}</b> ·{' '}
              {calc.cierra ? <b>✓ cierra</b> : <b>diferencia {sim} {fmt(calc.dif)}</b>}
              {calc.sinPrecio > 0 && <span className="ml-2 text-red-700">· {calc.sinPrecio} compra(s) sin precio: cargalo antes de vincular</span>}
              {!calc.cierra && calc.sinPrecio === 0 && <span className="block text-xs">Podés guardar igual: es un aviso. Si falta un renglón, un flete o un descuento, la decisión es tuya.</span>}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
              <Button disabled={!puedeGuardar || guardando} onClick={guardar}>
                {guardando ? 'Guardando…' : `Vincular ${calc.renglones.length} compra(s) y actualizar precios`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
