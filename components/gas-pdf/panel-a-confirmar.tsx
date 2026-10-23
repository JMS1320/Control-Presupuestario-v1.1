'use client'

/**
 * 👀 «A confirmar» — en Subdiarios desde 2026-10-23 (antes en Buscar PDFs, retirada) (usuario 2026-10-21: «un filtro de las que están a confirmar…
 * para ver sólo esas y ya verlas y decir sí o no»).
 *
 * Dos clases, las dos esperan el sí del usuario:
 *   - **VER**: hay uno o más candidatos y la app no eligió. Cada uno con su link, lo que dice el archivo
 *     al lado de lo que dice ARCA, y **✓ Es ésta** / **✗ No es ésta**.
 *   - **APP**: la app ya vinculó un archivo; **✓ Confirmar** la deja Confirmada (mismo archivo).
 * Los candidatos salen del historial de búsquedas (`candidatosDelLog`), igual que el ✓ de la grilla.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { candidatosDelLog, type FilaLogCandidato } from '@/lib/gas-pdf/lote'

export interface FacturaAConfirmar {
  id: string
  rotulo: string
  proveedor: string
  fc: string | null
  fecha_emision?: string | null
  imp_total?: number | null
  pdf_drive_url?: string | null
}

interface Props {
  facturas: FacturaAConfirmar[]
  onElegir: (facturaId: string, url: string) => Promise<boolean>
  onDescartar: (facturaId: string, url: string) => Promise<number | null>
  onConfirmarApp: (facturaId: string, url: string) => Promise<boolean>
}

const pesos = (n?: number | null) => n == null ? '—' : '$ ' + Math.abs(Number(n)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaAR = (iso?: string | null) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—'

export function PanelAConfirmar({ facturas, onElegir, onDescartar, onConfirmarApp }: Props) {
  const [candidatos, setCandidatos] = useState<Map<string, FilaLogCandidato[]> | null>(null)
  const [hechas, setHechas] = useState<Map<string, string>>(new Map())       // factura → «Confirmada» / «sin candidatos»
  const [descartados, setDescartados] = useState<Set<string>>(new Set())    // factura|url
  const [ocupado, setOcupado] = useState<string | null>(null)
  const ver = facturas.filter(f => f.fc === 'VER' && !f.pdf_drive_url)
  const app = facturas.filter(f => f.fc === 'APP' && f.pdf_drive_url)
  const clave = ver.map(f => f.id).join(',')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const ids = clave ? clave.split(',') : []
      const filas: any[] = []
      for (let i = 0; i < ids.length; i += 50) {
        const { data } = await supabase.from('arca_pdf_busqueda_log')
          .select('factura_id, resultado, drive_url, lote_id, observaciones, fecha_hora, gmail_message_id, monto_pdf')
          .in('factura_id', ids.slice(i, i + 50)).in('resultado', ['revisar', 'descartado'])
          .order('fecha_hora', { ascending: false }).limit(2000)
        if (data) filas.push(...data)
      }
      const por = new Map<string, FilaLogCandidato[]>()
      for (const id of ids) por.set(id, candidatosDelLog(filas.filter(f => f.factura_id === id)))
      if (vivo) setCandidatos(por)
    })()
    return () => { vivo = false }
  }, [clave])

  const hacer = async (facturaId: string, fn: () => Promise<void>) => {
    setOcupado(facturaId)
    try { await fn() } finally { setOcupado(null) }
  }

  if (ver.length === 0 && app.length === 0) {
    return <p className="text-sm text-gray-500 py-6 text-center">No hay facturas a confirmar en ese subdiario o rango.</p>
  }
  return (
    <div className="space-y-4 text-xs">
      {ver.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">⚠️ VER — elegí el archivo <span className="text-gray-400 font-normal">({ver.length})</span></h3>
          <p className="text-[11px] text-gray-500 mb-1">Abrí cada candidato. <b>Es ésta</b> la deja Confirmada con ese archivo; <b>No es ésta</b> queda registrado y no se vuelve a ofrecer (sin candidatos, pasa a NO Mail).</p>
          <table className="w-full">
            <tbody>
              {ver.map(f => {
                const hecho = hechas.get(f.id)
                const cs = (candidatos?.get(f.id) || []).filter(c => !descartados.has(`${f.id}|${c.drive_url}`))
                return (
                  <tr key={f.id} className="border-b align-top">
                    <td className="p-1 whitespace-nowrap">{f.rotulo}</td>
                    <td className="p-1 max-w-[200px] truncate" title={f.proveedor}>{f.proveedor}</td>
                    <td className="p-1 whitespace-nowrap text-gray-500">ARCA: {fechaAR(f.fecha_emision)} · {pesos(f.imp_total)}</td>
                    <td className="p-1">
                      {hecho ? <span className="text-emerald-700 font-medium">{hecho}</span>
                        : candidatos === null ? <span className="text-gray-400">cargando candidatos…</span>
                          : cs.length === 0 ? <span className="text-gray-400">sin candidatos en el historial</span>
                            : cs.map(c => (
                              <div key={c.drive_url} className="mb-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  <a href={c.drive_url} target="_blank" rel="noreferrer" className="text-blue-700 underline">{c.deCarpeta ? '🗂️ archivo de la carpeta' : '📧 archivo del mail'}</a>
                                  <button type="button" disabled={!!ocupado}
                                    className="text-emerald-700 border border-emerald-300 rounded px-1.5 hover:bg-emerald-50 disabled:opacity-40"
                                    onClick={() => hacer(f.id, async () => { if (await onElegir(f.id, c.drive_url)) setHechas(p => new Map(p).set(f.id, 'Confirmada ✓')) })}>✓ Es ésta</button>
                                  <button type="button" disabled={!!ocupado}
                                    className="text-red-700 border border-red-200 rounded px-1.5 hover:bg-red-50 disabled:opacity-40"
                                    onClick={() => hacer(f.id, async () => {
                                      const quedan = await onDescartar(f.id, c.drive_url)
                                      if (quedan === null) return
                                      setDescartados(p => new Set(p).add(`${f.id}|${c.drive_url}`))
                                      if (quedan === 0) setHechas(p => new Map(p).set(f.id, 'Sin candidatos: pasó a NO Mail'))
                                    })}>✗ No es ésta</button>
                                  {c.monto_pdf != null && (
                                    <span className={Math.abs(Math.abs(Number(c.monto_pdf)) - Math.abs(Number(f.imp_total ?? 0))) > 1 ? 'text-red-700' : 'text-emerald-700'}>
                                      importe leído {pesos(Number(c.monto_pdf))}
                                    </span>
                                  )}
                                </div>
                                {c.observaciones && <div className="text-gray-500 break-words">{c.observaciones.replace(/^\[(carpeta|reenvío)\]\s*/, '')}</div>}
                              </div>
                            ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
      {app.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">✅ APP — la app ya vinculó un archivo <span className="text-gray-400 font-normal">({app.length})</span></h3>
          <p className="text-[11px] text-gray-500 mb-1">Abrí el PDF: si es ésa, <b>Confirmar</b> la deja Confirmada con el mismo archivo.</p>
          <table className="w-full">
            <tbody>
              {app.map(f => (
                <tr key={f.id} className="border-b align-top">
                  <td className="p-1 whitespace-nowrap">{f.rotulo}</td>
                  <td className="p-1 max-w-[200px] truncate" title={f.proveedor}>{f.proveedor}</td>
                  <td className="p-1 whitespace-nowrap text-gray-500">ARCA: {fechaAR(f.fecha_emision)} · {pesos(f.imp_total)}</td>
                  <td className="p-1">
                    {hechas.get(f.id) ? <span className="text-emerald-700 font-medium">{hechas.get(f.id)}</span> : (
                      <div className="flex items-center gap-1">
                        <a href={f.pdf_drive_url!} target="_blank" rel="noreferrer" className="text-blue-700 underline">PDF</a>
                        <button type="button" disabled={!!ocupado}
                          className="text-emerald-700 border border-emerald-300 rounded px-1.5 hover:bg-emerald-50 disabled:opacity-40"
                          onClick={() => hacer(f.id, async () => { if (await onConfirmarApp(f.id, f.pdf_drive_url!)) setHechas(p => new Map(p).set(f.id, 'Confirmada ✓')) })}>✓ Confirmar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
