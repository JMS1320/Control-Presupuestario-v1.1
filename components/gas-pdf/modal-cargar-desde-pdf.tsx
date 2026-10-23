"use client"

/**
 * 📄➡️🧾 Cargar como factura un PDF sin vincular — A-FEAT-1318 (usuario 2026-10-23: «seguí con cargar
 * la factura desde el PDF»).
 *
 * Desde «PDFs sin vincular» de Subdiarios. Para los que no están en ARCA (Colomac): la pantalla trae
 * lo que la app leyó del PDF, el PDF al lado, y el usuario corrige y graba como **No Informada** —
 * a 📒 Asientos Contables o sin imputar. Sin armar un Excel.
 *
 * El control se ve mientras se carga (CLAUDE.md § 🧮): las partes contra el total, y si no cierra no
 * deja grabar — pero ofrece mandar la diferencia a «otros tributos», que es casi siempre lo que es
 * (percepciones).
 */
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { DATOS_FISCALES } from "@/lib/empresas"
import { leerFacturaDelTexto, precargaDesdeLectura, TIPOS_CARGABLES, discriminaIva, cuitValido, type FacturaLeida } from "@/lib/gas-pdf/leer-factura"
import { controlDeLaCarga, type DatosCargaManual } from "@/lib/facturas/alta-factura"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export interface ArchivoACargar {
  nombre: string
  url: string
  file_id: string | null
  /** El texto que la app leyó del PDF (registro del archivo digital). `null` = no se leyó: se carga a mano. */
  texto: string | null
}

interface Props {
  archivo: ArchivoACargar | null
  empresa: 'MSA' | 'PAM' | 'MA'
  onClose: () => void
  onCargada: (id: string, destino: 'asientos' | 'sin_imputar') => void
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const aTexto = (n: number | null | undefined) => (n ? fmt(n) : '')
const aNumero = (s: string) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0

type CampoMonto = 'neto21' | 'iva21' | 'neto105' | 'iva105' | 'noGravado' | 'exento' | 'otrosTributos' | 'total'
const MONTOS: Array<{ k: CampoMonto; rotulo: string; soloA?: boolean }> = [
  { k: 'neto21', rotulo: 'Neto gravado 21 %', soloA: true },
  { k: 'iva21', rotulo: 'IVA 21 %', soloA: true },
  { k: 'neto105', rotulo: 'Neto gravado 10,5 %', soloA: true },
  { k: 'iva105', rotulo: 'IVA 10,5 %', soloA: true },
  { k: 'noGravado', rotulo: 'No gravado', soloA: true },
  { k: 'exento', rotulo: 'Exento', soloA: true },
  { k: 'otrosTributos', rotulo: 'Otros tributos (percepciones)', soloA: true },
  { k: 'total', rotulo: 'TOTAL' },
]

export function ModalCargarDesdePdf({ archivo, empresa, onClose, onCargada }: Props) {
  const [leida, setLeida] = useState<FacturaLeida | null>(null)
  const [leidoBase, setLeidoBase] = useState<DatosCargaManual | null>(null)
  const [cuit, setCuit] = useState('')
  const [denominacion, setDenominacion] = useState('')
  const [delMaestro, setDelMaestro] = useState(false)
  const [tipo, setTipo] = useState<number>(0)
  const [pv, setPv] = useState('')
  const [numero, setNumero] = useState('')
  const [fecha, setFecha] = useState('')
  const [cae, setCae] = useState('')
  const [montos, setMontos] = useState<Record<CampoMonto, string>>({ neto21: '', iva21: '', neto105: '', iva105: '', noGravado: '', exento: '', otrosTributos: '', total: '' })
  const [destino, setDestino] = useState<'asientos' | 'sin_imputar'>('asientos')
  const [grabando, setGrabando] = useState(false)

  // Al abrir: leer el PDF y precargar.
  useEffect(() => {
    if (!archivo) return
    const l = leerFacturaDelTexto(archivo.texto)
    const p = precargaDesdeLectura(l)
    setLeida(l); setLeidoBase(p)
    setCuit(p.cuit); setDenominacion(p.denominacion); setDelMaestro(false)
    setTipo(p.tipo); setPv(p.puntoVenta ? String(p.puntoVenta) : ''); setNumero(p.numero ? String(p.numero) : '')
    setFecha(p.fecha); setCae(p.cae ?? '')
    setMontos({ neto21: aTexto(p.neto21), iva21: aTexto(p.iva21), neto105: aTexto(p.neto105), iva105: aTexto(p.iva105), noGravado: '', exento: '', otrosTributos: '', total: aTexto(p.total) })
    setDestino('asientos')
  }, [archivo])

  // El nombre del proveedor sale del maestro si el CUIT ya está (manda sobre lo leído).
  useEffect(() => {
    const c = cuit.replace(/\D/g, '')
    if (c.length !== 11) return
    let vivo = true
    supabase.from('proveedores').select('razon_social').eq('cuit', c).maybeSingle().then(({ data }) => {
      if (vivo && data?.razon_social) { setDenominacion(data.razon_social); setDelMaestro(true) }
    })
    return () => { vivo = false }
  }, [cuit])

  const discrimina = discriminaIva(tipo)
  const datos: DatosCargaManual = useMemo(() => ({
    cuit: cuit.replace(/\D/g, ''), denominacion: denominacion.trim(), tipo,
    puntoVenta: parseInt(pv) || 0, numero: parseInt(numero) || 0, fecha,
    neto21: aNumero(montos.neto21), iva21: aNumero(montos.iva21), neto105: aNumero(montos.neto105), iva105: aNumero(montos.iva105),
    noGravado: aNumero(montos.noGravado), exento: aNumero(montos.exento), otrosTributos: aNumero(montos.otrosTributos),
    total: aNumero(montos.total), cae: cae.trim() || null,
  }), [cuit, denominacion, tipo, pv, numero, fecha, montos, cae])
  const control = controlDeLaCarga(datos, discrimina)
  const cuitOk = cuitValido(datos.cuit)
  const receptorOtro = leida?.receptorCuit && leida.receptorCuit !== DATOS_FISCALES[empresa].cuit
    ? Object.entries(DATOS_FISCALES).find(([, d]) => d.cuit === leida.receptorCuit)?.[0] : null
  const faltan = [
    !cuitOk && 'CUIT válido', !datos.denominacion && 'proveedor', !TIPOS_CARGABLES[tipo] && 'tipo',
    (!datos.puntoVenta || !datos.numero) && 'punto de venta y número', !fecha && 'fecha',
  ].filter(Boolean) as string[]
  const puedeGrabar = faltan.length === 0 && control.cierra && !grabando

  const grabar = async () => {
    if (!archivo || !leidoBase) return
    setGrabando(true)
    try {
      const r = await fetch('/api/facturas/cargar-desde-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa, destino, datos, leido: leidoBase, archivo: { nombre: archivo.nombre, url: archivo.url, file_id: archivo.file_id } }),
      })
      const d = await r.json().catch(() => ({ ok: false, error: `Respuesta inválida (${r.status})` }))
      if (!d.ok) { toast.error(d.error || 'No se grabó la factura.'); return }
      toast.success(`Factura cargada${destino === 'asientos' ? ' en 📒 Asientos Contables' : ' (sin imputar)'}${d.correcciones ? ` · ${d.correcciones} dato(s) corregido(s) a mano` : ''}`)
      for (const a of (d.avisos || []) as string[]) toast.warning(a)
      onCargada(d.id, destino)
    } catch (e) {
      toast.error('No se grabó la factura: ' + (e as Error).message)
    } finally {
      setGrabando(false)
    }
  }

  const fid = archivo?.file_id
  const campo = 'text-sm border rounded px-2 py-1 w-full'
  return (
    <Dialog open={!!archivo} onOpenChange={o => { if (!o && !grabando) onClose() }}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📄 Cargar como factura No Informada</DialogTitle>
          <DialogDescription>
            {archivo?.nombre} — {archivo?.texto ? 'los datos vienen de lo que la app leyó del PDF; corregí lo que haga falta.' : 'la app todavía no leyó este PDF: cargalo a mano mirando el archivo.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            {fid
              ? <iframe src={`https://drive.google.com/file/d/${fid}/preview`} className="w-full h-[560px] rounded border bg-gray-50" />
              : <a href={archivo?.url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">Abrir el archivo</a>}
          </div>

          <div className="space-y-3 text-sm">
            {leida && leida.noLeido.length > 0 && archivo?.texto && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">No se pudo leer: {leida.noLeido.join(', ')}. Completalo mirando el PDF.</p>
            )}
            {receptorOtro && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">⚠️ El PDF está a nombre de <strong>{receptorOtro}</strong> y estás cargando en <strong>{empresa}</strong>. Si es de la otra empresa, cargalo desde su subdiario.</p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-1">CUIT
                <input value={cuit} onChange={e => setCuit(e.target.value)} className={`${campo} ${cuit && !cuitOk ? 'border-red-400' : ''}`} placeholder="30-12345678-9" />
                {cuit && !cuitOk && <span className="text-[11px] text-red-600">no cumple el dígito verificador</span>}
              </label>
              <label className="col-span-2">Proveedor {delMaestro && <span className="text-[11px] text-green-700">(del maestro de proveedores)</span>}
                <input value={denominacion} onChange={e => { setDenominacion(e.target.value); setDelMaestro(false) }} className={campo} />
              </label>
              <label>Tipo
                <select value={tipo || ''} onChange={e => setTipo(parseInt(e.target.value) || 0)} className={campo}>
                  <option value="">— elegir —</option>
                  {Object.entries(TIPOS_CARGABLES).map(([c, t]) => <option key={c} value={c}>{t.desc} ({c})</option>)}
                </select>
              </label>
              <label>Punto de venta<input value={pv} onChange={e => setPv(e.target.value.replace(/\D/g, ''))} className={campo} /></label>
              <label>Número<input value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, ''))} className={campo} /></label>
              <label>Fecha de emisión<input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={campo} /></label>
              <label className="col-span-2">CAE (opcional)<input value={cae} onChange={e => setCae(e.target.value.replace(/\D/g, ''))} className={campo} /></label>
            </div>

            {!discrimina && <p className="text-xs text-gray-500">Factura {TIPOS_CARGABLES[tipo]?.letra}: no discrimina IVA — como en ARCA, se guarda sólo el total.</p>}
            <div className="grid grid-cols-2 gap-2">
              {MONTOS.filter(m => discrimina || !m.soloA).map(m => (
                <label key={m.k} className={m.k === 'total' ? 'col-span-2 font-semibold' : ''}>{m.rotulo}
                  <input type="text" placeholder="0,00" value={montos[m.k]} onChange={e => setMontos(prev => ({ ...prev, [m.k]: e.target.value }))} className={`${campo} text-right`} />
                </label>
              ))}
            </div>

            {/* 🧮 El control, a la vista mientras se carga */}
            {control.aplica ? (
              control.cierra
                ? <p className="text-xs text-green-700">✓ Las partes suman {fmt(control.suma)} = total {fmt(datos.total)}</p>
                : <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                    Las partes suman {fmt(control.suma)} y el total es {fmt(datos.total)}: diferencia <strong>{fmt(control.diferencia)}</strong>. No se puede grabar una factura que no suma su total.
                    {control.diferencia > 0 && (
                      <Button size="sm" variant="outline" className="h-6 text-xs ml-2"
                        onClick={() => setMontos(prev => ({ ...prev, otrosTributos: fmt(aNumero(prev.otrosTributos) + control.diferencia) }))}>
                        Poner la diferencia en otros tributos
                      </Button>
                    )}
                  </div>
            ) : !control.cierra && <p className="text-xs text-red-700">Falta el total.</p>}

            <div className="border rounded p-2 space-y-1">
              <div className="font-medium">¿A dónde va?</div>
              <label className="flex items-start gap-2"><input type="radio" checked={destino === 'asientos'} onChange={() => setDestino('asientos')} className="mt-1" />
                <span><strong>📒 Asientos Contables</strong> — no va al subdiario de IVA; el contador la registra con un asiento. Sale en los Papeles del balance del ejercicio de su fecha.</span></label>
              <label className="flex items-start gap-2"><input type="radio" checked={destino === 'sin_imputar'} onChange={() => setDestino('sin_imputar')} className="mt-1" />
                <span><strong>Sin imputar</strong> — queda para imputarla a un subdiario desde «Imputar Facturas».</span></label>
            </div>

            {faltan.length > 0 && <p className="text-xs text-gray-500">Falta: {faltan.join(', ')}.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={grabando}>Cancelar</Button>
              <Button onClick={grabar} disabled={!puedeGrabar}>
                {grabando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Grabar factura
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
