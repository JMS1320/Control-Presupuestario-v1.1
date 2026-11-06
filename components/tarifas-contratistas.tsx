"use client"

/**
 * 💲 Tarifas de los contratistas, comparadas en todos los índices — A-FEAT-1557 etapa 4 / A-FEAT-1556.
 *
 * JMS 06/11: *«el tema es convertir la tarifa en pesos de cada contratista a su equivalente en los otros índices para
 * poder comparar»*. Cada labor de cada orden con su tarifa pactada se muestra en $/ha, USD/ha, kg soja/ha, l gasoil/ha
 * y % de la cosecha, con los precios A LA FECHA DE LA ORDEN; y si la orden tiene la factura del contratista, la tarifa
 * real (neto ÷ ha) al lado, con el control contra lo pactado (avisa, no frena). La cuenta vive en
 * `lib/productivo/tarifa-contratista.ts`.
 *
 * También acá: atar la factura del contratista a sus órdenes (`ordenes_agricolas.factura_contratista_id`, script 221).
 */

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import {
  UNIDADES_TARIFA, aPesosHa, equivalencias, precioAFecha, controlFacturaContratista, esUnidadTarifa,
  type PreciosIndices, type UnidadTarifa,
} from "@/lib/productivo/tarifa-contratista"

export interface LaborConTarifa { labor_id: number; nombre: string; tarifa: number | null; tarifa_unidad: string | null }
export interface OrdenParaTarifa {
  id: string; fecha: string; hectareas: number; estado: string; lote_nombre: string | null
  contratista_cuit?: string | null; contratista_nombre?: string | null
  factura_contratista_id?: string | null; factura_contratista_empresa?: string | null
  lotes_orden?: { lote_id: string | null }[]
  labores_det?: LaborConTarifa[]
}

interface FacturaContratista { id: string; empresa: string; fecha: string; numero: string; netoPesos: number; proveedor: string }

type Serie = { fecha: string; valor: number }[]
const fmt = (n: number | null | undefined, d = 2) => n == null ? '—' : n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })
const parse = (v: string) => parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0
const fecha = (f: string) => f.split('-').reverse().join('/')
const soloDigitos = (c: string | null | undefined) => (c || '').replace(/\D/g, '')
const corto = (u: string | null) => UNIDADES_TARIFA.find(x => x.id === u)?.corto || ''
const leerLocal = (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const grabarLocal = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento: sólo esta vez */ } }

const SCHEMA: Record<string, string> = { MSA: 'msa', PAM: 'pam', MA: 'ma' }
const COLS_FC = 'id, fecha_emision, denominacion_emisor, punto_venta, numero_desde, imp_neto_gravado, imp_neto_no_gravado, imp_op_exentas, moneda, tipo_cambio'
const aFactura = (f: any, empresa: string): FacturaContratista => {
  const neto = (Number(f.imp_neto_gravado) || 0) + (Number(f.imp_neto_no_gravado) || 0) + (Number(f.imp_op_exentas) || 0)
  const usd = f.moneda && f.moneda !== 'PES' && f.moneda !== 'ARS'
  return {
    id: f.id, empresa, fecha: f.fecha_emision, proveedor: f.denominacion_emisor || '',
    numero: `${Number(f.punto_venta || 0)}-${Number(f.numero_desde || 0)}`,
    netoPesos: Math.round(neto * (usd ? Number(f.tipo_cambio) || 0 : 1) * 100) / 100,
  }
}

async function leerSerie(serie: string): Promise<Serie> {
  const { data } = await supabase.from('cotizaciones').select('fecha, valor, venta').eq('serie', serie).order('fecha')
  return (data || []).map((c: any) => ({ fecha: c.fecha, valor: Number(c.venta ?? c.valor) || 0 }))
}

export function TarifasContratistas({ ordenes, onCambio }: { ordenes: OrdenParaTarifa[]; onCambio: () => void }) {
  const [series, setSeries] = useState<{ usd: Serie; soja: Serie; maiz: Serie } | null>(null)
  const [cultivoDeLote, setCultivoDeLote] = useState<Map<string, string>>(new Map())
  const [facturas, setFacturas] = useState<Map<string, FacturaContratista>>(new Map())
  const [gasoil, setGasoil] = useState(() => leerLocal('tarifas.gasoil'))
  const [rinde, setRinde] = useState(() => leerLocal('tarifas.rinde'))
  const [vincular, setVincular] = useState<OrdenParaTarifa | null>(null)

  useEffect(() => {
    ;(async () => {
      const [usd, soja, maiz] = await Promise.all([leerSerie('dolar_bna_divisas'), leerSerie('soja_pizarra_rosario'), leerSerie('maiz_pizarra_rosario')])
      setSeries({ usd, soja, maiz })
      const { data: lotes } = await supabase.schema('productivo').from('lotes_agricolas').select('id, cultivo')
      setCultivoDeLote(new Map((lotes || []).map((l: any) => [l.id, String(l.cultivo || '').toLowerCase()])))
    })()
  }, [])

  // Las facturas de contratista ya atadas a órdenes
  const idsFactura = ordenes.filter(o => o.factura_contratista_id).map(o => `${o.factura_contratista_empresa || 'MSA'}:${o.factura_contratista_id}`)
  useEffect(() => {
    ;(async () => {
      const porEmpresa = new Map<string, string[]>()
      for (const k of new Set(idsFactura)) { const [e, id] = k.split(':'); porEmpresa.set(e, [...(porEmpresa.get(e) || []), id]) }
      const m = new Map<string, FacturaContratista>()
      for (const [e, ids] of porEmpresa) {
        const { data } = await supabase.schema(SCHEMA[e] || 'msa').from('comprobantes_arca').select(COLS_FC).in('id', ids)
        for (const f of data || []) m.set(f.id, aFactura(f, e))
      }
      setFacturas(m)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsFactura.join(',')])

  const precios = (o: { fecha: string; lotes_orden?: { lote_id: string | null }[] }): PreciosIndices & { fechaUsd?: string; fechaSoja?: string } => {
    const usd = series ? precioAFecha(series.usd, o.fecha) : null
    const soja = series ? precioAFecha(series.soja, o.fecha) : null
    const esMaiz = (o.lotes_orden || []).some(l => l.lote_id && /ma[ií]z/.test(cultivoDeLote.get(l.lote_id) || ''))
    const grano = esMaiz && series ? precioAFecha(series.maiz, o.fecha) : soja
    return {
      usd: usd?.valor ?? null, sojaKg: soja ? soja.valor / 1000 : null,
      gasoilL: parse(gasoil) || null, granoKg: grano ? grano.valor / 1000 : null, rindeKgHa: parse(rinde) || null,
      fechaUsd: usd?.fecha, fechaSoja: soja?.fecha,
    }
  }

  // Una fila por labor con tarifa, ordenadas por labor y $/ha: así se comparan los contratistas de la misma labor
  const filas = useMemo(() => ordenes
    .filter(o => o.estado !== 'eliminada')
    .flatMap(o => (o.labores_det || []).filter(l => l.tarifa != null && esUnidadTarifa(l.tarifa_unidad)).map(l => {
      const p = precios(o)
      const pesosHa = aPesosHa(l.tarifa, l.tarifa_unidad as UnidadTarifa, p)
      return { o, l, p, pesosHa, eq: equivalencias(pesosHa, p) }
    }))
    .sort((a, b) => a.l.nombre.localeCompare(b.l.nombre) || (a.pesosHa ?? 0) - (b.pesosHa ?? 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordenes, series, cultivoDeLote, gasoil, rinde])

  // Cada factura de contratista contra lo pactado en las órdenes que cobra
  const controles = useMemo(() => [...facturas.values()].map(f => {
    const os = ordenes.filter(o => o.factura_contratista_id === f.id)
    const ctrl = controlFacturaContratista(f.netoPesos, os.map(o => {
      const p = precios(o)
      const ls = (o.labores_det || []).filter(l => l.tarifa != null && esUnidadTarifa(l.tarifa_unidad))
      const vals = ls.map(l => aPesosHa(l.tarifa, l.tarifa_unidad as UnidadTarifa, p))
      return { ha: Number(o.hectareas) || 0, pesosHaPactado: ls.length && vals.every(v => v != null) ? vals.reduce((s, v) => s + (v as number), 0) : null }
    }))
    return { f, os, ctrl, eq: equivalencias(ctrl.realPesosHa, precios({ fecha: f.fecha, lotes_orden: os.flatMap(o => o.lotes_orden || []) })) }
  }).sort((a, b) => b.f.fecha.localeCompare(a.f.fecha)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facturas, ordenes, series, cultivoDeLote, gasoil, rinde])

  const faltaFactura = ordenes.filter(o => o.estado === 'ejecutada' && o.contratista_cuit && !o.factura_contratista_id)

  return (
    <div className="space-y-3 rounded-lg border bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">💲 Tarifas de los contratistas — en todos los índices</span>
        <label className="flex items-center gap-1 text-xs">Gasoil $/l
          <Input type="text" className="h-7 w-24 text-right" placeholder="0,00" value={gasoil}
            onChange={e => { setGasoil(e.target.value); grabarLocal('tarifas.gasoil', e.target.value) }} />
        </label>
        <label className="flex items-center gap-1 text-xs">Rinde de referencia kg/ha
          <Input type="text" className="h-7 w-24 text-right" placeholder="3.000" value={rinde}
            onChange={e => { setRinde(e.target.value); grabarLocal('tarifas.rinde', e.target.value) }} />
        </label>
        <span className="text-xs text-muted-foreground">Dólar BNA divisas y soja pizarra Rosario: los de la fecha de cada orden (la app los guarda día por día). Sin gasoil o sin rinde, esa columna queda vacía.</span>
      </div>
      <TestsDelProceso proceso="productivo/tarifas-contratista" pantalla="productivo" />

      {faltaFactura.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          <b>🧾 {faltaFactura.length} orden{faltaFactura.length > 1 ? 'es ejecutadas esperan' : ' ejecutada espera'} la factura del contratista:</b>{' '}
          {faltaFactura.map(o => (
            <button key={o.id} type="button" className="mr-2 underline" onClick={() => setVincular(o)}>
              {fecha(o.fecha)} · {o.contratista_nombre || o.contratista_cuit} · {o.lote_nombre || ''} ({fmt(Number(o.hectareas), 0)} ha)
            </button>
          ))}
        </div>
      )}

      {filas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Todavía no hay labores con tarifa. Cargala al crear o editar la orden: en cada labor elegida, el valor y la unidad (dólares, kg de soja, litros de gasoil, % de la cosecha o pesos).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-1 text-left">Labor</th><th className="p-1 text-left">Contratista</th><th className="p-1 text-left">Fecha</th>
                <th className="p-1 text-left">Lote</th><th className="p-1 text-right">Ha</th><th className="p-1 text-right">Pactado</th>
                {UNIDADES_TARIFA.map(u => <th key={u.id} className="p-1 text-right">{u.corto}</th>)}
                <th className="p-1 text-left">Factura</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ o, l, p, eq }) => (
                <tr key={o.id + ':' + l.labor_id} className="border-t">
                  <td className="p-1">{l.nombre}</td>
                  <td className="p-1">{o.contratista_nombre || o.contratista_cuit || <span className="text-muted-foreground">sin contratista</span>}</td>
                  <td className="p-1">{fecha(o.fecha)}</td>
                  <td className="p-1">{o.lote_nombre || '—'}</td>
                  <td className="p-1 text-right tabular-nums">{fmt(Number(o.hectareas), 0)}</td>
                  <td className="p-1 text-right tabular-nums font-medium">{fmt(l.tarifa)} {corto(l.tarifa_unidad)}</td>
                  {UNIDADES_TARIFA.map(u => (
                    <td key={u.id} className={`p-1 text-right tabular-nums ${u.id === l.tarifa_unidad ? 'font-semibold' : ''}`}
                      title={u.id === 'usd_ha' && p.fechaUsd ? `dólar ${fmt(p.usd)} del ${fecha(p.fechaUsd)}` : u.id === 'kg_soja_ha' && p.fechaSoja ? `soja $ ${fmt((p.sojaKg ?? 0) * 1000, 0)}/tn del ${fecha(p.fechaSoja)}` : undefined}>
                      {fmt(eq[u.id])}
                    </td>
                  ))}
                  <td className="p-1">
                    <button type="button" className="text-blue-700 underline" onClick={() => setVincular(o)}>
                      {o.factura_contratista_id ? (facturas.get(o.factura_contratista_id)?.numero ? `FC ${facturas.get(o.factura_contratista_id)!.numero}` : 'FC ✓') : (o.contratista_cuit ? 'atar' : '')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {controles.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold text-xs">🧾 Según la factura (lo real) contra lo pactado</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-1 text-left">Factura</th><th className="p-1 text-left">Contratista</th><th className="p-1 text-right">Órdenes</th>
                  <th className="p-1 text-right">Ha</th><th className="p-1 text-right">Neto $</th>
                  {UNIDADES_TARIFA.map(u => <th key={u.id} className="p-1 text-right">{u.corto} real</th>)}
                  <th className="p-1 text-left">Control</th>
                </tr>
              </thead>
              <tbody>
                {controles.map(({ f, os, ctrl, eq }) => (
                  <tr key={f.id} className="border-t">
                    <td className="p-1">FC {f.numero} · {fecha(f.fecha)} <span className="text-muted-foreground">({f.empresa})</span></td>
                    <td className="p-1">{f.proveedor}</td>
                    <td className="p-1 text-right">{os.length}</td>
                    <td className="p-1 text-right tabular-nums">{fmt(ctrl.haTotales, 0)}</td>
                    <td className="p-1 text-right tabular-nums">{fmt(f.netoPesos)}</td>
                    {UNIDADES_TARIFA.map(u => <td key={u.id} className="p-1 text-right tabular-nums">{fmt(eq[u.id])}</td>)}
                    <td className={`p-1 ${ctrl.cierra === false ? 'text-amber-700' : ctrl.cierra ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                      {ctrl.cierra == null ? 'sin tarifa pactada en alguna orden'
                        : ctrl.cierra ? `✓ cierra con lo pactado ($ ${fmt(ctrl.esperado)})`
                        : `⚠️ pactado $ ${fmt(ctrl.esperado)} · diferencia $ ${fmt(ctrl.dif)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">Es un aviso, no frena: la diferencia puede ser un extra o un ajuste que conocés vos. La tarifa real se reparte por igual entre las ha de las órdenes que cobra la factura.</p>
        </div>
      )}

      {vincular && <ModalFacturaContratista orden={vincular} ordenes={ordenes} onCerrar={() => setVincular(null)} onGuardado={() => { setVincular(null); onCambio() }} />}
    </div>
  )
}

/** 🧾 Atar la factura del contratista a la orden (y a sus otras órdenes ejecutadas sin factura, si las cobra juntas). */
function ModalFacturaContratista({ orden, ordenes, onCerrar, onGuardado }: {
  orden: OrdenParaTarifa; ordenes: OrdenParaTarifa[]; onCerrar: () => void; onGuardado: () => void
}) {
  const [candidatas, setCandidatas] = useState<FacturaContratista[]>([])
  const [elegida, setElegida] = useState<string>(orden.factura_contratista_id ? `${orden.factura_contratista_empresa || 'MSA'}:${orden.factura_contratista_id}` : '')
  const otras = ordenes.filter(o => o.id !== orden.id && o.estado !== 'eliminada' && soloDigitos(o.contratista_cuit) === soloDigitos(orden.contratista_cuit)
    && (!o.factura_contratista_id || (orden.factura_contratista_id && o.factura_contratista_id === orden.factura_contratista_id)))
  const [conOtras, setConOtras] = useState<Set<string>>(new Set(otras.filter(o => orden.factura_contratista_id && o.factura_contratista_id === orden.factura_contratista_id).map(o => o.id)))
  const [guardando, setGuardando] = useState(false)
  const cuit = soloDigitos(orden.contratista_cuit)

  useEffect(() => {
    if (!cuit) return
    ;(async () => {
      const desde = new Date(orden.fecha + 'T12:00:00'); desde.setDate(desde.getDate() - 30)
      const lista: FacturaContratista[] = []
      for (const e of ['MSA', 'PAM', 'MA']) {
        const { data } = await supabase.schema(SCHEMA[e]).from('comprobantes_arca').select(COLS_FC)
          .eq('cuit', cuit).gte('fecha_emision', desde.toISOString().slice(0, 10)).order('fecha_emision')
        for (const f of data || []) lista.push(aFactura(f, e))
      }
      setCandidatas(lista)
    })()
  }, [cuit, orden.fecha])

  const guardar = async (quitar = false) => {
    setGuardando(true)
    try {
      const [empresa, id] = quitar ? [null, null] : elegida.split(':')
      const ids = [orden.id, ...conOtras]
      const { error } = await supabase.schema('productivo').from('ordenes_agricolas')
        .update({ factura_contratista_id: id, factura_contratista_empresa: empresa }).in('id', ids)
      if (error) throw error
      toast.success(quitar ? 'Factura del contratista desatada' : `Factura atada a ${ids.length} orden(es)`)
      onGuardado()
    } catch (e) { toast.error('No se pudo guardar: ' + (e as Error).message) } finally { setGuardando(false) }
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>🧾 Factura del contratista — {orden.contratista_nombre || orden.contratista_cuit || 'sin contratista'}</DialogTitle></DialogHeader>
        {!cuit ? <p className="text-sm text-amber-700">La orden no tiene contratista: cargalo al editarla para poder buscar su factura.</p> : (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">Facturas de este CUIT desde 30 días antes de la orden del {fecha(orden.fecha)} (MSA, PAM y MA):</p>
            {candidatas.length === 0 && <p className="text-amber-700 text-xs">No hay facturas de este contratista todavía. Cuando entre por ARCA, la atás desde acá.</p>}
            {candidatas.map(f => (
              <label key={f.empresa + f.id} className="flex items-center gap-2 rounded border px-2 py-1 hover:bg-blue-50">
                <input type="radio" name="fc-contratista" checked={elegida === `${f.empresa}:${f.id}`} onChange={() => setElegida(`${f.empresa}:${f.id}`)} />
                {fecha(f.fecha)} · FC {f.numero} · {f.empresa} · neto $ {fmt(f.netoPesos)}
              </label>
            ))}
            {otras.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">¿La misma factura cobra otras órdenes de este contratista? Tildalas (las ha se suman para la tarifa real):</p>
                {otras.map(o => (
                  <label key={o.id} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={conOtras.has(o.id)} onChange={e => setConOtras(s => { const n = new Set(s); e.target.checked ? n.add(o.id) : n.delete(o.id); return n })} />
                    {fecha(o.fecha)} · {o.lote_nombre || '—'} · {fmt(Number(o.hectareas), 0)} ha · {(o.labores_det || []).map(l => l.nombre).join(', ')} · {o.estado}
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              {orden.factura_contratista_id && <Button variant="outline" disabled={guardando} onClick={() => guardar(true)}>Desatar</Button>}
              <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
              <Button disabled={!elegida || guardando} onClick={() => guardar(false)}>{guardando ? 'Guardando…' : 'Atar la factura'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
