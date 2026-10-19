"use client"

/**
 * 📌 Pendientes a revisar de los papeles de trabajo — A-FEAT-1258.
 *
 * Cuadro a la vista en *Reportes → Papeles de trabajo*: se agregan, se resuelven con una nota (no se
 * borran) y salen en el export. La solapa del Excel la arma `lib/balance/pendientes-balance.ts`.
 */

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ahoraISO } from "@/lib/fechas"
import type { PendienteBalance } from "@/lib/balance/pendientes-balance"

const dmy = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

export function PendientesBalance({ empresa, anioCierre, onCambio }: {
  empresa: string
  anioCierre: number
  /** Para que el export lleve la lista al día. */
  onCambio?: (lista: PendienteBalance[]) => void
}) {
  const [lista, setLista] = useState<PendienteBalance[]>([])
  const [nuevo, setNuevo] = useState('')
  const [resolviendo, setResolviendo] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [verResueltos, setVerResueltos] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('balance_pendientes').select('*')
      .eq('empresa', empresa).eq('anio_cierre', anioCierre).order('created_at')
    if (error) { setError(error.message); return }
    setError(null)
    const l = (data || []) as PendienteBalance[]
    setLista(l)
    onCambio?.(l)
  }, [empresa, anioCierre, onCambio])
  useEffect(() => { cargar() }, [cargar])

  const agregar = async () => {
    const texto = nuevo.trim()
    if (!texto) return
    const { error } = await supabase.from('balance_pendientes').insert({ empresa, anio_cierre: anioCierre, texto })
    if (error) { toast.error('No se pudo anotar: ' + error.message); return }
    setNuevo('')
    await cargar()
  }
  const resolver = async (id: string) => {
    if (!nota.trim()) { toast.error('Escribí cómo se resolvió'); return }
    const { error } = await supabase.from('balance_pendientes')
      .update({ estado: 'resuelto', resolucion: nota.trim(), resuelto_at: ahoraISO() }).eq('id', id)
    if (error) { toast.error('No se pudo resolver: ' + error.message); return }
    setResolviendo(null); setNota('')
    await cargar()
  }
  const reabrir = async (id: string) => {
    const { error } = await supabase.from('balance_pendientes').update({ estado: 'abierto', resuelto_at: null }).eq('id', id)
    if (error) { toast.error('No se pudo reabrir: ' + error.message); return }
    await cargar()
  }

  const abiertos = lista.filter(p => p.estado === 'abierto')
  const resueltos = lista.filter(p => p.estado === 'resuelto')
  return (
    <div className={`rounded border p-3 text-sm ${abiertos.length ? 'border-amber-300 bg-amber-50/60' : 'border-gray-200'}`}>
      <div className="mb-2 flex items-center justify-between">
        <b>📌 Pendientes a revisar — {empresa} {anioCierre}</b>
        <span className="text-xs text-gray-500">salen en el export, en la solapa «Pendientes a revisar»</span>
      </div>
      {error && <p className="text-red-700">No se pudieron leer los pendientes: {error}</p>}
      {abiertos.length === 0 && !error && <p className="text-xs text-emerald-700">✓ Sin pendientes abiertos.</p>}
      {abiertos.map(p => (
        <div key={p.id} className="flex flex-wrap items-start gap-2 border-b border-amber-100 py-1">
          <span className="flex-1">{p.texto} <span className="text-[10px] text-gray-500">· {dmy(p.created_at)}</span></span>
          {resolviendo === p.id ? (
            <span className="flex items-center gap-1">
              <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="cómo se resolvió" className="h-7 w-64 text-xs" />
              <Button size="sm" className="h-7 text-xs" onClick={() => resolver(p.id)}>✓ Resolver</Button>
              <button type="button" className="text-xs text-gray-500 underline" onClick={() => { setResolviendo(null); setNota('') }}>cancelar</button>
            </span>
          ) : (
            <button type="button" className="text-xs text-blue-700 underline" onClick={() => { setResolviendo(p.id); setNota('') }}>resolver</button>
          )}
        </div>
      ))}
      <div className="mt-2 flex items-center gap-2">
        <Input value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder="Anotar un pendiente a revisar…"
          className="h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter') agregar() }} />
        <Button size="sm" variant="outline" onClick={agregar} disabled={!nuevo.trim()}>+ Anotar</Button>
      </div>
      {resueltos.length > 0 && (
        <div className="mt-2">
          <button type="button" className="text-xs text-gray-500 underline" onClick={() => setVerResueltos(v => !v)}>
            {verResueltos ? 'ocultar' : 'ver'} los {resueltos.length} resueltos
          </button>
          {verResueltos && resueltos.map(p => (
            <div key={p.id} className="flex items-start gap-2 py-0.5 text-xs text-gray-600">
              <span className="flex-1">✓ {p.texto} — <i>{p.resolucion}</i> ({dmy(p.resuelto_at)})</span>
              <button type="button" className="underline" onClick={() => reabrir(p.id)}>reabrir</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
