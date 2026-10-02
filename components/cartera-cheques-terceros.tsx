"use client"

/**
 * 🧾 **Cheques de terceros en cartera** — A-FEAT-1229 (2026-10-02). Vive en el **Cash Flow**, dentro
 * del botón **ECHEQs**, junto a los emitidos (pedido del usuario: *«los cheques en cartera no se pueden
 * tener para entrar a ver desde cobros, deben estar en cash flow… que muestre cheques emitidos, en
 * cartera o endosados según se quiera»*). `modo` elige cuáles se listan.
 *
 * Lista los cheques que mandaron los clientes y todavía no se usaron (*en cartera*), y los que se
 * endosaron sin decir a quién. Para cada uno, **Endosar**: se elige el pago al proveedor que se
 * cancela con ese cheque (o se crea). Lógica en `lib/ventas/cheques-terceros*.ts`.
 */

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { cargarChequesTerceros, pagosParaEndosar, endosarCheque, type ChequeTercero } from "@/lib/ventas/cheques-terceros-db"
import { estadoCheque, chequePendienteDeEndoso, candidatosEndoso, ETIQUETA_ESTADO_CHEQUE } from "@/lib/ventas/cheques-terceros"

const fmt = (n: number) => `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtFecha = (s: string | null) => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }

export function CarteraChequesTerceros({ modo, recargar }: { modo: 'cartera' | 'endosados'; recargar?: number }) {
  const [cheques, setCheques] = useState<ChequeTercero[]>([])
  const [endosando, setEndosando] = useState<ChequeTercero | null>(null)
  const [pagos, setPagos] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ cuit: string; nombre: string; fecha: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    try { setCheques(await cargarChequesTerceros(supabase)) }
    catch (err) { toast.error('No se pudieron leer los cheques de terceros: ' + (err as Error).message) }
  }
  useEffect(() => { void cargar() }, [recargar])

  const abrirEndoso = async (c: ChequeTercero) => {
    setEndosando(c); setElegido(null); setNuevo(null); setBusqueda('')
    try { setPagos(await pagosParaEndosar(supabase)) }
    catch (err) { toast.error('No se pudieron leer los pagos: ' + (err as Error).message) }
  }

  const candidatos = useMemo(() => endosando
    ? candidatosEndoso(pagos, { monto: endosando.monto, fecha: endosando.fecha_pago }, busqueda).slice(0, 8)
    : [], [pagos, endosando, busqueda])

  const confirmar = async () => {
    if (!endosando) return
    if (!elegido && !(nuevo?.cuit && nuevo.fecha)) { toast.error('Elegí el pago al que va, o cargá el proveedor y la fecha'); return }
    setGuardando(true)
    try {
      await endosarCheque(supabase, endosando, elegido ? { pagoId: elegido } : { nuevo: nuevo! })
      toast.success('Cheque endosado')
      setEndosando(null); await cargar()
    } catch (err) {
      toast.error('No se pudo endosar: ' + (err as Error).message)
    } finally { setGuardando(false) }
  }

  const pendientes = cheques.filter(chequePendienteDeEndoso)
  // En cartera: los disponibles y los endosados sin decir a quién (hay algo que hacer). Endosados: los completos.
  const visibles = modo === 'cartera' ? pendientes : cheques.filter(c => estadoCheque(c) === 'endosado')
  const disponible = cheques.filter(c => estadoCheque(c) === 'en_cartera').reduce((s, c) => s + c.monto, 0)

  return (
    <div className="p-3 text-xs space-y-1">
      <div className="flex items-center gap-3">
        {modo === 'cartera'
          ? <span className="text-gray-600">Disponible en cartera: <b className="text-green-700">{fmt(disponible)}</b></span>
          : <span className="text-gray-600">Cheques de clientes que se endosaron a proveedores</span>}
        {modo === 'cartera' && pendientes.length > 0 && <Badge variant="outline" className="bg-amber-50 text-amber-800">{pendientes.length} por endosar o completar</Badge>}
      </div>
      {visibles.length === 0 && (
        <p className="py-4 text-center text-gray-500">{modo === 'cartera' ? 'No hay cheques de terceros en cartera.' : 'No hay cheques endosados.'}</p>
      )}
      {visibles.map(c => {
        const e = estadoCheque(c)
        return (
          <div key={c.id} className="border-t pt-1">
            <div className="flex items-center gap-3">
              <span className="w-20">{fmtFecha(c.fecha_pago)}</span>
              <span className="flex-1 truncate" title={c.descripcion || ''}>{c.nombre_proveedor} · {c.descripcion || 'Echeq'}</span>
              <span className="w-32 text-right tabular-nums">{fmt(c.monto)}</span>
              <span className={'w-56 ' + (e === 'en_cartera' ? 'text-green-700' : e === 'endosado' ? 'text-gray-500' : 'text-amber-700')}>
                {ETIQUETA_ESTADO_CHEQUE[e]}{c.endosadoA ? ` a ${c.endosadoA}` : ''}
              </span>
              {chequePendienteDeEndoso(c) && (
                <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => void abrirEndoso(c)}>
                  {e === 'en_cartera' ? 'Endosar…' : 'Decir a quién…'}
                </Button>
              )}
            </div>
            {endosando?.id === c.id && (
              <div className="mt-1 ml-20 rounded bg-gray-50 border p-2 space-y-1">
                <div className="text-gray-600">¿A qué pago va este cheque? Arriba, los del mismo importe.</div>
                <Input className="h-7 text-xs w-64" placeholder="Buscar proveedor…" value={busqueda} onChange={ev => setBusqueda(ev.target.value)} />
                {candidatos.map(p => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name={'endoso-' + c.id} checked={elegido === p.id} onChange={() => { setElegido(p.id); setNuevo(null) }} />
                    <span className="w-20">{fmtFecha(p.fecha_pago)}</span>
                    <span className="flex-1 truncate">{p.nombre_proveedor}{p.descripcion ? ` · ${p.descripcion}` : ''}</span>
                    <span className="w-32 text-right tabular-nums">{fmt(Number(p.monto))}</span>
                    <span className={'w-28 ' + (p.exacto ? 'text-green-700' : 'text-gray-400')}>{p.exacto ? 'mismo importe' : `dif. ${fmt(Math.abs(p.diferencia))}`}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={'endoso-' + c.id} checked={!!nuevo} onChange={() => { setElegido(null); setNuevo({ cuit: '', nombre: '', fecha: c.fecha_pago || '' }) }} />
                  <span>No está: crear el pago a un proveedor</span>
                </label>
                {nuevo && (
                  <div className="flex flex-wrap items-end gap-2 ml-6">
                    <div className="w-72"><ProveedorCombobox label="Proveedor" value={{ cuit: nuevo.cuit, nombre: nuevo.nombre }} onChange={sel => setNuevo({ ...nuevo, cuit: sel.cuit, nombre: sel.nombre })} /></div>
                    <label className="grid gap-0.5">Fecha del endoso<Input type="date" className="h-7 text-xs w-36" value={nuevo.fecha} onChange={ev => setNuevo({ ...nuevo, fecha: ev.target.value })} /></label>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="h-7 text-xs" disabled={guardando} onClick={() => void confirmar()}>{guardando ? 'Guardando…' : 'Endosar'}</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEndosando(null)}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
