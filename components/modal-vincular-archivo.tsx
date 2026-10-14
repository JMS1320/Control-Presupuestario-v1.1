"use client"

/**
 * 📎 Vincular el PDF archivado de UNA factura, desde el Cash Flow (A-DEC-1008 → A-FEAT-1276).
 *
 * Pedido del usuario 2026-10-14 (prioridad): *«que en cash flow yo pudiera buscar esa factura que ya
 * la tengo archivada, que use el mismo motor de búsqueda»*. Es el panel «PDFs sin vincular» de
 * Subdiarios, pero para una sola factura:
 *   1. mira la carpeta de su período contable (o la del mes de emisión si no está imputada) — se
 *      puede elegir otro mes;
 *   2. lista los archivos de esa carpeta que ninguna factura usa, con ⭐ los que se parecen;
 *   3. se ve el archivo acá mismo y se vincula con un click.
 *
 * 🔑 Vincular es independiente del audit del subdiario (usuario): el link queda en la factura. Si
 * después se imputa a otro mes, el usuario mueve el PDF a esa carpeta; Drive conserva la identidad
 * del archivo, así que el link sigue valiendo y el audit del mes nuevo lo encuentra vinculado.
 */
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { empresaDeSchema } from "@/lib/empresas"
import { archivosParaFactura, datosDelVinculo, periodoDeArchivo, type ArchivoDeCarpeta } from "@/lib/facturas/vincular-archivo"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

const fileIdDe = (u?: string | null) => { const m = String(u || '').match(/[-\w]{25,}/); return m ? m[0] : null }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

interface Props {
  /** La factura: su id y su schema (`msa` / `pam` / `ma`). `null` = cerrado. */
  factura: { id: string; schema: string; titulo: string } | null
  onClose: () => void
  /** Se llama con el link guardado, para que la grilla se actualice sin recargar todo. */
  onVinculado: (facturaId: string, url: string) => void
}

export function ModalVincularArchivo({ factura, onClose, onVinculado }: Props) {
  const [datos, setDatos] = useState<Record<string, any> | null>(null)
  const [periodo, setPeriodo] = useState<{ anio: number; mes: number } | null>(null)
  const [imputada, setImputada] = useState(false)
  const [archivos, setArchivos] = useState<ArchivoDeCarpeta[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verUrl, setVerUrl] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  // 1) La factura: hace falta su período contable, que la fila del Cash Flow no trae.
  useEffect(() => {
    setDatos(null); setPeriodo(null); setArchivos(null); setError(null); setVerUrl(null)
    if (!factura) return
    ;(async () => {
      // '*' a propósito: `año_contable` lleva ñ y supabase-js no la acepta en un select con nombre.
      const { data, error } = await supabase.schema(factura.schema as any).from('comprobantes_arca')
        .select('*').eq('id', factura.id).maybeSingle()
      if (error || !data) { setError('No se pudo leer la factura: ' + (error?.message ?? 'no existe')); return }
      setDatos(data)
      const p = periodoDeArchivo(data)
      setImputada(p.imputada)
      setPeriodo({ anio: p.anio, mes: p.mes })
    })()
  }, [factura])

  // 2) Los archivos de la carpeta de ese mes que ninguna factura usa (el «Contar» de Subdiarios).
  useEffect(() => {
    if (!factura || !periodo?.anio || !periodo?.mes) return
    let vigente = true
    setCargando(true); setError(null); setArchivos(null)
    fetch('/api/gas/conciliar-archivo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa: empresaDeSchema(factura.schema), anio: periodo.anio, mes: periodo.mes }),
    })
      .then(r => r.json())
      .then(d => {
        if (!vigente) return
        if (!d.ok) { setError(d.error || 'No se pudo leer la carpeta'); return }
        if (d.existe === false) { setArchivos([]); setError('Esa carpeta no existe en Drive todavía.'); return }
        setArchivos(d.huerfanos || [])
      })
      .catch(e => vigente && setError('No se pudo leer la carpeta: ' + (e as Error).message))
      .finally(() => vigente && setCargando(false))
    return () => { vigente = false }
  }, [factura, periodo])

  const vincular = async (a: ArchivoDeCarpeta) => {
    if (!factura) return
    setGuardando(a.url)
    try {
      const { error, count } = await supabase.schema(factura.schema as any).from('comprobantes_arca')
        .update(datosDelVinculo(a, 'Cash Flow'), { count: 'exact' }).eq('id', factura.id)
      if (error) throw error
      if (count === 0) throw new Error('no se encontró la factura: el vínculo NO se guardó')
      toast.success(`Vinculado: ${a.archivo}`)
      onVinculado(factura.id, a.url)
      onClose()
    } catch (e) {
      toast.error('No se pudo vincular: ' + (e as Error).message)
    } finally {
      setGuardando(null)
    }
  }

  const lista = archivos && datos ? archivosParaFactura(archivos, datos) : []
  const valorMes = periodo ? `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}` : ''

  return (
    <Dialog open={!!factura} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📎 Vincular el PDF archivado</DialogTitle>
          <DialogDescription>{factura?.titulo}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600">Carpeta del mes:</span>
          <input
            type="month"
            className="border rounded px-2 py-1 text-sm"
            value={valorMes}
            onChange={e => {
              const [a, m] = e.target.value.split('-').map(Number)
              if (a && m) setPeriodo({ anio: a, mes: m })
            }}
          />
          {datos && periodo && (() => {
            const base = periodoDeArchivo(datos)
            const esLaPropia = base.anio === periodo.anio && base.mes === periodo.mes
            return (
              <span className="text-xs text-gray-500">
                {esLaPropia
                  ? (imputada
                    ? `es el subdiario donde está imputada (${MESES[periodo.mes - 1]} ${periodo.anio})`
                    : 'todavía no está imputada: se busca en el mes de emisión')
                  : 'otro mes, elegido a mano'}
              </span>
            )
          })()}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {cargando && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Leyendo la carpeta…</p>}

        {archivos && !cargando && (
          lista.length === 0 ? (
            <p className="text-sm text-gray-500">
              En esa carpeta no hay archivos sin vincular. Probá con otro mes, o fijate que el PDF esté subido.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              <li className="text-xs text-gray-500">
                {lista.length} archivo(s) sin vincular · ⭐ = el nombre coincide con el proveedor (y con la fecha, si la trae). Mirá el archivo antes de vincular.
              </li>
              {lista.map(a => {
                const fid = fileIdDe(a.url)
                return (
                  <li key={a.url} className="border-b pb-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-4">{a.sugerido ? '⭐' : ''}</span>
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-blue-600 underline truncate max-w-[340px]">{a.archivo}</a>
                      <button
                        type="button"
                        className={`text-xs rounded border px-1.5 py-0.5 ${verUrl === a.url ? 'bg-blue-50 border-blue-300 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setVerUrl(verUrl === a.url ? null : a.url)}
                      >
                        {verUrl === a.url ? '👁 ocultar' : '👁 ver'}
                      </button>
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2 ml-auto"
                        disabled={guardando !== null}
                        onClick={() => vincular(a)}>
                        {guardando === a.url ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Vincular'}
                      </Button>
                    </div>
                    {verUrl === a.url && fid && (
                      <iframe
                        src={`https://drive.google.com/file/d/${fid}/preview`}
                        className="w-full h-[420px] rounded border bg-gray-50 mt-1.5"
                        title={`Vista previa de ${a.archivo}`}
                        loading="lazy"
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
