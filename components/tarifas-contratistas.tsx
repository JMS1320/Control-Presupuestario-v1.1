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
  UNIDADES_TARIFA, aPesosHa, equivalencias, precioAFecha, controlFacturaContratista, esUnidadTarifa, mejorCombinacion,
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

/**
 * Los precios de los índices a una fecha: dólar y soja (y maíz) de las cotizaciones que guarda la app, el cultivo de cada
 * lote para el % de cosecha, y gasoil y rinde a mano (guardados en el navegador). Lo usan el comparador y la factura.
 */
export function usePreciosIndices() {
  const [series, setSeries] = useState<{ usd: Serie; soja: Serie; maiz: Serie } | null>(null)
  const [cultivoDeLote, setCultivoDeLote] = useState<Map<string, string>>(new Map())
  const [gasoil, setGasoil] = useState(() => leerLocal('tarifas.gasoil'))
  const [rinde, setRinde] = useState(() => leerLocal('tarifas.rinde'))
  useEffect(() => {
    ;(async () => {
      const [usd, soja, maiz] = await Promise.all([leerSerie('dolar_bna_divisas'), leerSerie('soja_pizarra_rosario'), leerSerie('maiz_pizarra_rosario')])
      setSeries({ usd, soja, maiz })
      const { data: lotes } = await supabase.schema('productivo').from('lotes_agricolas').select('id, cultivo')
      setCultivoDeLote(new Map((lotes || []).map((l: any) => [l.id, String(l.cultivo || '').toLowerCase()])))
    })()
  }, [])
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
  const cambiarGasoil = (v: string) => { setGasoil(v); grabarLocal('tarifas.gasoil', v) }
  const cambiarRinde = (v: string) => { setRinde(v); grabarLocal('tarifas.rinde', v) }
  return { listo: !!series, version: `${!!series}|${cultivoDeLote.size}|${gasoil}|${rinde}`, precios, gasoil, rinde, cambiarGasoil, cambiarRinde }
}

/** El $/ha pactado de una orden: la suma de sus labores con tarifa; `null` si alguna no se puede pasar a pesos o no hay. */
export function pesosHaDeOrden(o: OrdenParaTarifa, p: PreciosIndices): number | null {
  const ls = (o.labores_det || []).filter(l => l.tarifa != null && esUnidadTarifa(l.tarifa_unidad))
  const vals = ls.map(l => aPesosHa(l.tarifa, l.tarifa_unidad as UnidadTarifa, p))
  return ls.length && vals.every(v => v != null) ? Math.round(vals.reduce((s, v) => s + (v as number), 0) * 100) / 100 : null
}

export function TarifasContratistas({ ordenes, onCambio }: { ordenes: OrdenParaTarifa[]; onCambio: () => void }) {
  const { precios, version, gasoil, rinde, cambiarGasoil, cambiarRinde } = usePreciosIndices()
  const [facturas, setFacturas] = useState<Map<string, FacturaContratista>>(new Map())
  const [vincular, setVincular] = useState<OrdenParaTarifa | null>(null)

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
    [ordenes, version])

  // Cada factura de contratista contra lo pactado en las órdenes que cobra
  const controles = useMemo(() => [...facturas.values()].map(f => {
    const os = ordenes.filter(o => o.factura_contratista_id === f.id)
    const ctrl = controlFacturaContratista(f.netoPesos, os.map(o => ({ ha: Number(o.hectareas) || 0, pesosHaPactado: pesosHaDeOrden(o, precios(o)) })))
    return { f, os, ctrl, eq: equivalencias(ctrl.realPesosHa, precios({ fecha: f.fecha, lotes_orden: os.flatMap(o => o.lotes_orden || []) })) }
  }).sort((a, b) => b.f.fecha.localeCompare(a.f.fecha)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facturas, ordenes, version])

  const faltaFactura = ordenes.filter(o => o.estado === 'ejecutada' && o.contratista_cuit && !o.factura_contratista_id)

  return (
    <div className="space-y-3 rounded-lg border bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">💲 Tarifas de los contratistas — en todos los índices</span>
        <label className="flex items-center gap-1 text-xs">Gasoil $/l
          <Input type="text" className="h-7 w-24 text-right" placeholder="0,00" value={gasoil}
            onChange={e => cambiarGasoil(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs">Rinde de referencia kg/ha
          <Input type="text" className="h-7 w-24 text-right" placeholder="3.000" value={rinde}
            onChange={e => cambiarRinde(e.target.value)} />
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

/**
 * 🚜 Llega la factura del contratista → qué órdenes cobra (A-FEAT-1557, JMS 06/11: «seguí con la factura que propone sola
 * sus órdenes»). Se abre desde la fila de la factura en Egresos (🚜N). Lista las órdenes ejecutadas (o marcadas «se hizo»)
 * de ese CUIT sin factura, con lo que deberían costar (ha × tarifa pactada en $ a su fecha), y PROPONE la combinación
 * que da el neto — no la tilda sola: «Tildar las que cierran». Al atar, las órdenes quedan con su factura y el
 * comparador 💲 Tarifas muestra la tarifa real.
 */
export function ModalOrdenesDeFactura({ facturaId, empresa, onCerrar, onGuardado }: {
  facturaId: string; empresa: string; onCerrar: () => void; onGuardado?: () => void
}) {
  const { precios, version, gasoil, rinde, cambiarGasoil, cambiarRinde } = usePreciosIndices()
  const [factura, setFactura] = useState<(FacturaContratista & { cuit: string }) | null>(null)
  const [ordenes, setOrdenes] = useState<OrdenParaTarifa[]>([])
  const [tildadas, setTildadas] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    ;(async () => {
      setCargando(true)
      try {
        const { data: f } = await supabase.schema(SCHEMA[empresa] || 'msa').from('comprobantes_arca').select(COLS_FC + ', cuit').eq('id', facturaId).single()
        if (!f) return
        const fc = { ...aFactura(f, empresa), cuit: soloDigitos((f as any).cuit) }
        setFactura(fc)
        const { data: os } = await supabase.schema('productivo').from('ordenes_agricolas')
          .select('id, fecha, hectareas, estado, lote_nombre, contratista_cuit, contratista_nombre, factura_contratista_id, factura_contratista_empresa, lotes_orden:ordenes_agricolas_lotes(lote_id), lineas_labores:lineas_orden_agricola_labores(labor_id, tarifa, tarifa_unidad, labores(nombre))')
          .in('estado', ['ejecutada', 'a_confirmar']).order('fecha', { ascending: false })
        const lista: OrdenParaTarifa[] = (os || [])
          .filter((o: any) => soloDigitos(o.contratista_cuit) === fc.cuit && (!o.factura_contratista_id || o.factura_contratista_id === facturaId))
          .map((o: any) => ({
            ...o, hectareas: Number(o.hectareas) || 0,
            labores_det: (o.lineas_labores || []).map((ll: any) => ({ labor_id: ll.labor_id, nombre: ll.labores?.nombre || '', tarifa: ll.tarifa != null ? Number(ll.tarifa) : null, tarifa_unidad: ll.tarifa_unidad ?? null })),
          }))
        setOrdenes(lista)
        setTildadas(new Set(lista.filter(o => o.factura_contratista_id === facturaId).map(o => o.id)))
      } finally { setCargando(false) }
    })()
  }, [facturaId, empresa])

  const filas = useMemo(() => ordenes.map(o => {
    const pesosHa = pesosHaDeOrden(o, precios(o))
    return { o, pesosHa, esperado: pesosHa == null ? null : Math.round(pesosHa * (Number(o.hectareas) || 0) * 100) / 100 }
  }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordenes, version])
  const propuesta = useMemo(() => factura ? mejorCombinacion(factura.netoPesos, filas.map(f => ({ id: f.o.id, esperado: f.esperado }))) : null, [factura, filas])
  const ctrl = factura ? controlFacturaContratista(factura.netoPesos, filas.filter(f => tildadas.has(f.o.id)).map(f => ({ ha: Number(f.o.hectareas) || 0, pesosHaPactado: f.pesosHa }))) : null
  const pideGasoilORinde = ordenes.some(o => (o.labores_det || []).some(l => l.tarifa_unidad === 'l_gasoil_ha' || l.tarifa_unidad === 'pct_cosecha'))
  const yaAtadas = ordenes.filter(o => o.factura_contratista_id === facturaId)

  const guardar = async () => {
    if (!factura) return
    setGuardando(true)
    try {
      const atar = [...tildadas]
      const soltar = yaAtadas.filter(o => !tildadas.has(o.id)).map(o => o.id)
      if (atar.length) {
        const { error } = await supabase.schema('productivo').from('ordenes_agricolas')
          .update({ factura_contratista_id: facturaId, factura_contratista_empresa: empresa }).in('id', atar)
        if (error) throw error
      }
      if (soltar.length) {
        const { error } = await supabase.schema('productivo').from('ordenes_agricolas')
          .update({ factura_contratista_id: null, factura_contratista_empresa: null }).in('id', soltar)
        if (error) throw error
      }
      toast.success(`FC ${factura.numero} atada a ${atar.length} orden(es)${soltar.length ? ` · ${soltar.length} desatada(s)` : ''}`)
      onGuardado?.()
      onCerrar()
    } catch (e) { toast.error('No se pudo guardar: ' + (e as Error).message) } finally { setGuardando(false) }
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onCerrar() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>🚜 ¿Qué órdenes cobra esta factura?</DialogTitle></DialogHeader>
        <TestsDelProceso proceso="productivo/factura-contratista" pantalla="egresos" />
        {cargando && <p className="text-sm text-gray-500">Cargando…</p>}
        {factura && !cargando && (
          <div className="space-y-3 text-sm">
            <div className="rounded bg-gray-50 p-2">
              <b>FC {factura.numero}</b> · {factura.proveedor} · {fecha(factura.fecha)} ({factura.empresa}) · neto <b>$ {fmt(factura.netoPesos)}</b>
            </div>
            {ordenes.length === 0 ? (
              <p className="text-amber-700">Este contratista no tiene órdenes ejecutadas sin factura. Si la orden existe, fijate que tenga cargado el contratista (Productivo → Órdenes agrícolas → editar).</p>
            ) : (
              <>
                {pideGasoilORinde && (
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1">Gasoil $/l <Input type="text" className="h-7 w-24 text-right" value={gasoil} onChange={e => cambiarGasoil(e.target.value)} /></label>
                    <label className="flex items-center gap-1">Rinde kg/ha <Input type="text" className="h-7 w-24 text-right" value={rinde} onChange={e => cambiarRinde(e.target.value)} /></label>
                    <span className="text-muted-foreground">hay tarifas en gasoil o % de cosecha: sin estos precios no tienen valor en pesos</span>
                  </div>
                )}
                {propuesta && (
                  <div className={`flex flex-wrap items-center gap-2 rounded border p-2 text-xs ${propuesta.cierra ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-sky-300 bg-sky-50 text-sky-900'}`}>
                    <span>{propuesta.cierra
                      ? <b>✓ {propuesta.ids.length === 1 ? 'Esta orden cierra' : `Estas ${propuesta.ids.length} órdenes cierran`} con el neto</b>
                      : <b>Lo más parecido al neto</b>}
                      {' '}(pactado $ {fmt(propuesta.esperado)} · dif. $ {fmt(propuesta.dif)})</span>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setTildadas(new Set(propuesta.ids))}>
                      {propuesta.cierra ? 'Tildar las que cierran' : 'Tildar ésas'}
                    </Button>
                  </div>
                )}
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="w-6 p-1"></th><th className="p-1 text-left">Fecha</th><th className="p-1 text-left">Lote</th><th className="p-1 text-right">Ha</th>
                      <th className="p-1 text-left">Labores y tarifa</th><th className="p-1 text-right">$/ha</th><th className="p-1 text-right">Debería costar</th><th className="p-1 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map(({ o, pesosHa, esperado }) => (
                      <tr key={o.id} className={`border-t ${propuesta?.ids.includes(o.id) ? 'bg-emerald-50/50' : ''}`}>
                        <td className="p-1"><input type="checkbox" checked={tildadas.has(o.id)}
                          onChange={e => setTildadas(s => { const n = new Set(s); if (e.target.checked) n.add(o.id); else n.delete(o.id); return n })} /></td>
                        <td className="p-1">{fecha(o.fecha)}</td>
                        <td className="p-1">{o.lote_nombre || '—'}</td>
                        <td className="p-1 text-right tabular-nums">{fmt(Number(o.hectareas), 0)}</td>
                        <td className="p-1">{(o.labores_det || []).map(l => `${l.nombre}${l.tarifa != null ? ` ${fmt(l.tarifa)} ${corto(l.tarifa_unidad)}` : ' (sin tarifa)'}`).join(' · ') || '—'}</td>
                        <td className="p-1 text-right tabular-nums">{fmt(pesosHa)}</td>
                        <td className="p-1 text-right tabular-nums">{esperado != null ? `$ ${fmt(esperado)}` : '—'}</td>
                        <td className="p-1">{o.estado === 'a_confirmar' ? 'a confirmar' : o.estado}{o.factura_contratista_id === facturaId && <span className="ml-1 text-emerald-700">✓ ya atada</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* 🧮 El control: lo tildado contra el neto. Avisa, no frena (puede haber un extra o un ajuste). */}
                {ctrl && tildadas.size > 0 && (
                  <div className={`rounded p-2 text-xs ${ctrl.cierra ? 'bg-emerald-50 text-emerald-800' : ctrl.cierra === false ? 'border border-amber-300 bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-700'}`}>
                    {tildadas.size} orden(es) · {fmt(ctrl.haTotales, 0)} ha · tarifa real <b>$ {fmt(ctrl.realPesosHa)}/ha</b> ·{' '}
                    {ctrl.cierra == null ? 'alguna orden no tiene tarifa pactada: no hay con qué comparar'
                      : ctrl.cierra ? <b>✓ cierra con lo pactado ($ {fmt(ctrl.esperado)})</b>
                      : <b>pactado $ {fmt(ctrl.esperado)} · diferencia $ {fmt(ctrl.dif)}</b>}
                    {ctrl.cierra === false && <span className="block">Podés atarla igual: es un aviso.</span>}
                  </div>
                )}
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
              <Button disabled={guardando || !factura || (!tildadas.size && !yaAtadas.length)} onClick={guardar}>
                {guardando ? 'Guardando…' : `Atar la factura a ${tildadas.size} orden(es)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
