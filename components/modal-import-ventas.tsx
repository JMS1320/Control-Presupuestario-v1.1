"use client"

import { useState } from "react"
import type { UserRole } from "@/lib/auth/roles"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, FileSpreadsheet, Download } from "lucide-react"
import { toast } from "sonner"
import { hoyArgentina } from "@/lib/fechas"
import { TestsDelProceso } from "@/components/tests-del-proceso"

/**
 * Modal para importar facturas de venta (ARCA "Mis Comprobantes Emitidos" o Excel del mismo formato)
 * a <empresa>.comprobantes_venta vía /api/import-ventas.
 *
 * `empresa` decide DOS cosas: el schema donde se insertan y con qué CUIT se entra a ARCA.
 *
 * A-FEAT-1433 (nota de JMS 30/10: «ventas no tiene el mismo formato que compras»): mismo formato que
 * «Importar desde ARCA» de compras — empresa fija a la vista, atajos de fecha, la clave en su campo, y
 * una vista previa con cada venta y su estado.
 * A-BUG-1432: la fecha de cobro es POR VENTA (vacía = la de emisión, que es lo que ya usa el Cash Flow), y
 * las que parecen ya cargadas a mano se muestran para que decidas, en vez de duplicarse.
 */

interface FilaPreview {
  clave: string
  estado: "nueva" | "duplicada" | "posible"
  fecha: string | null
  tipo: number | null
  numero: string | null
  cliente: string | null
  cuit: string | null
  total: number | null
  ya_cargada: { id: string; numero: string | null; tipo: number | null; fecha: string | null; total: number | null } | null
}

const fmtMonto = (n: number | null) => n == null ? "—" : `$ ${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtFecha = (f: string | null) => f ? f.split("-").reverse().join("/") : "—"
const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
function mesAnterior(): [string, string] {
  const [a, m] = hoyArgentina().split("-").map(Number)
  return [isoDe(new Date(a, m - 2, 1)), isoDe(new Date(a, m - 1, 0))]
}

const NOMBRE_EMPRESA: Record<string, string> = { MSA: "MSA — Martinez Sobrado Agro", PAM: "PAM — CUIT 20044390222", MA: "MA — Mercedes Areco" }

export function ModalImportVentas({ open, onClose, onImportado, userRole = 'admin', empresa = 'MSA' }: { open: boolean; onClose: () => void; onImportado: () => void; userRole?: UserRole; empresa?: 'MSA' | 'PAM' | 'MA' }) {
  const [file, setFile] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [preview, setPreview] = useState<{ total: number; nuevas: number; duplicadas: number; posibles: number; filas: FilaPreview[] } | null>(null)
  // A-BUG-1432: fecha de cobro por venta (clave → fecha) y las «posible ya cargada» que se importan igual
  const [fechas, setFechas] = useState<Record<string, string>>({})
  const [fechaTodas, setFechaTodas] = useState("")
  const [incluir, setIncluir] = useState<Set<string>>(new Set())
  // Descarga directa de ARCA (emitidos)
  const [arcaPassword, setArcaPassword] = useState('')
  const [arcaDesde, setArcaDesde] = useState(() => mesAnterior()[0])
  const [arcaHasta, setArcaHasta] = useState(() => mesAnterior()[1])
  const [descargando, setDescargando] = useState(false)

  const reset = () => {
    setFile(null); setPreview(null); setFechas({}); setFechaTodas(''); setIncluir(new Set()); setArcaPassword('')
    const [d, h] = mesAnterior(); setArcaDesde(d); setArcaHasta(h)
  }

  const atajo = (cual: 'mes' | '30' | 'este') => {
    const hoy = new Date(hoyArgentina() + "T12:00:00")
    if (cual === 'mes') { const [d, h] = mesAnterior(); setArcaDesde(d); setArcaHasta(h) }
    else if (cual === '30') { const d = new Date(hoy); d.setDate(d.getDate() - 30); setArcaDesde(isoDe(d)); setArcaHasta(isoDe(hoy)) }
    else { const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1); const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1); setArcaDesde(isoDe(ini)); setArcaHasta(isoDe(ayer)) }
  }

  // Baja "Mis Comprobantes Emitidos" de ARCA y lo previsualiza directo.
  const descargarDeArca = async () => {
    if (!arcaPassword.trim()) { toast.error('Ingresá tu clave fiscal de ARCA'); return }
    if (!arcaDesde || !arcaHasta) { toast.error('Completá ambas fechas'); return }
    if (arcaDesde > arcaHasta) { toast.error('«Desde» tiene que ser anterior o igual a «hasta»'); return }
    setDescargando(true)
    try {
      const r = await fetch('/api/arca/descargar-comprobantes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa, password: arcaPassword, fechaDesde: arcaDesde, fechaHasta: arcaHasta, tipo: 'emitidos', userRole }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error('ARCA: ' + (d.error || `Error ${r.status}`)); return }
      const blob = new Blob([d.csvText], { type: 'text/csv;charset=utf-8' })
      const f = new File([blob], `arca-emitidos-${arcaDesde}-a-${arcaHasta}.csv`, { type: 'text/csv' })
      setArcaPassword('') // borrar clave de memoria
      setFile(f)
      await previsualizar(f)
    } catch (e) {
      toast.error('Error de red: ' + (e as Error).message)
    } finally {
      setDescargando(false)
    }
  }

  const enviar = async (f: File, modoPreview: boolean) => {
    const fd = new FormData()
    fd.append('file', f)
    fd.append('empresa', empresa)
    if (modoPreview) fd.append('preview', 'true')
    else {
      const conFecha = Object.fromEntries(Object.entries(fechas).filter(([, v]) => v))
      fd.append('fechas_cobro', JSON.stringify(conFecha))
      fd.append('incluir_posibles', JSON.stringify([...incluir]))
    }
    const r = await fetch('/api/import-ventas', { method: 'POST', body: fd })
    return r.json()
  }

  const previsualizar = async (f: File | null = file) => {
    if (!f) { toast.error('Elegí un archivo'); return }
    setCargando(true)
    try {
      const d = await enviar(f, true)
      if (!d.ok) { toast.error('Error: ' + (d.error || 'desconocido')); return }
      setPreview(d); setFechas({}); setIncluir(new Set())
    } catch (e) {
      toast.error('Error de red: ' + (e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  const importar = async () => {
    if (!file) return
    setCargando(true)
    try {
      const d = await enviar(file, false)
      if (!d.ok) { toast.error('Error: ' + (d.error || 'desconocido')); console.error('[import-ventas] respuesta:', d); return }
      toast.success(`Importadas ${d.insertadas} · ya estaban ${d.duplicadas}${d.posibles_salteadas ? ` · ${d.posibles_salteadas} parecían ya cargadas y no se importaron` : ''} · retenciones vinculadas ${d.retenciones_vinculadas ?? 0}`)
      reset()
      onImportado()
      onClose()
    } catch (e) {
      toast.error('Error de red: ' + (e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  const aImportar = preview ? preview.filas.filter(f => f.estado === 'nueva' || (f.estado === 'posible' && incluir.has(f.clave))).length : 0
  const aplicarATodas = () => {
    if (!preview) return
    setFechas(Object.fromEntries(preview.filas.filter(f => f.estado !== 'duplicada').map(f => [f.clave, fechaTodas])))
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !cargando && !descargando && (reset(), onClose())}>
      {/* Igual que compras (A-FEAT-1434): Escape o un click afuera no cierran el asistente */}
      <DialogContent className={`${preview ? 'max-w-5xl' : 'max-w-lg'} max-h-[88vh] flex flex-col`}
        onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />Importar facturas de venta — {empresa}
          </DialogTitle>
          <DialogDescription>
            «Mis Comprobantes Emitidos» de ARCA (o un Excel/CSV del mismo formato). Nacen como <b>a cobrar</b> en el subdiario de <b>{empresa}</b>. Antes de importar ves cada venta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto flex-1">
          <TestsDelProceso proceso="ingresos/importar-ventas" pantalla="ingresos" />
          {!preview && (
            <>
              {/* Empresa fija, como en compras */}
              <div className="space-y-1">
                <Label className="text-xs">Empresa</Label>
                <div className="border rounded-md bg-blue-50 border-blue-200 px-3 py-2 text-sm font-medium text-blue-900">🏛️ {NOMBRE_EMPRESA[empresa]}</div>
              </div>

              <div className="rounded border p-3 space-y-3">
                <div className="text-xs font-medium text-blue-800 flex items-center gap-1"><Download className="h-3.5 w-3.5" />Descargar de ARCA</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => atajo('mes')}>Mes anterior</Button>
                  <Button size="sm" variant="outline" onClick={() => atajo('30')}>Últimos 30 días</Button>
                  <Button size="sm" variant="outline" onClick={() => atajo('este')}>Este mes hasta ayer</Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Fecha desde *</Label><Input type="date" value={arcaDesde} onChange={e => setArcaDesde(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Fecha hasta *</Label><Input type="date" value={arcaHasta} onChange={e => setArcaHasta(e.target.value)} /></div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Clave fiscal de ARCA *</Label>
                  <Input type="password" placeholder="Ingresá tu clave fiscal" autoComplete="current-password" value={arcaPassword} onChange={e => setArcaPassword(e.target.value)} />
                  <p className="text-[10px] text-gray-500">La clave se usa una sola vez para esta descarga. No se guarda.</p>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={descargarDeArca} disabled={descargando || !arcaPassword}>
                  {descargando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Descargando… (10-20 s)</> : '📥 Descargar de ARCA y ver'}
                </Button>
              </div>

              <div className="text-center text-[11px] text-gray-400">— o subí un archivo —</div>
              <div>
                <Label className="text-xs">Archivo (.xlsx / .xls / .csv)</Label>
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0] || null; setFile(f); setPreview(null); if (f) previsualizar(f) }} />
              </div>
              {cargando && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Analizando archivo…</div>}
            </>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="text-gray-600 truncate max-w-[260px]" title={file?.name}>{file?.name}</span>
                <span>Total: <b>{preview.total}</b></span>
                <span className="text-green-700">✅ Nuevas: <b>{preview.nuevas}</b></span>
                {preview.duplicadas > 0 && <span className="text-amber-600">⚠️ Ya existen: <b>{preview.duplicadas}</b></span>}
                {preview.posibles > 0 && <span className="text-purple-700">🔗 Parecen ya cargadas: <b>{preview.posibles}</b></span>}
              </div>
              {preview.posibles > 0 && (
                <div className="text-xs bg-purple-50 border border-purple-200 rounded p-2 text-purple-900">
                  🔗 Hay ventas del archivo con el mismo cliente y total que una ya cargada (con otro tipo o número). <b>No se importan</b> salvo que tildes «importar igual»: así no se duplican.
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded border text-xs">
                <span className="font-medium">Fecha de cobro estimada:</span>
                <span className="text-gray-500">vacía = la de emisión de cada venta.</span>
                <span className="ml-2">Misma para todas:</span>
                <Input type="date" className="h-7 w-[150px] text-xs" value={fechaTodas} onChange={e => setFechaTodas(e.target.value)} />
                <button type="button" className="px-2 py-0.5 border rounded hover:bg-blue-50" onClick={aplicarATodas}>Aplicar</button>
                <button type="button" className="px-2 py-0.5 border rounded hover:bg-blue-50" onClick={() => setFechas({})}>Vaciar</button>
              </div>
              <div className="border rounded-md overflow-y-auto max-h-[45vh]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-600">Estado</th>
                      <th className="text-left p-2 font-medium text-gray-600">Fecha</th>
                      <th className="text-left p-2 font-medium text-gray-600">Cliente</th>
                      <th className="text-left p-2 font-medium text-gray-600">Comprobante</th>
                      <th className="text-right p-2 font-medium text-gray-600">Total</th>
                      <th className="text-left p-2 font-medium text-gray-600 w-[150px]">Fecha de cobro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.filas.map(f => (
                      <tr key={f.clave} className={f.estado === 'duplicada' ? 'bg-amber-50' : f.estado === 'posible' ? 'bg-purple-50/60' : ''}>
                        <td className="p-2 align-top">
                          {f.estado === 'nueva' && <span className="text-green-700 font-medium">✅ Nueva</span>}
                          {f.estado === 'duplicada' && <span className="text-amber-600">⚠️ Ya existe</span>}
                          {f.estado === 'posible' && (
                            <div className="space-y-1">
                              <span className="text-purple-700">🔗 Ya cargada?</span>
                              {f.ya_cargada && <div className="text-[10px] text-gray-600">{f.ya_cargada.numero || 'sin número'} · tipo {f.ya_cargada.tipo ?? '—'} · {fmtFecha(f.ya_cargada.fecha)} · {fmtMonto(f.ya_cargada.total)}</div>}
                              <label className="flex items-center gap-1 text-[11px]">
                                <input type="checkbox" checked={incluir.has(f.clave)}
                                  onChange={e => setIncluir(prev => { const n = new Set(prev); if (e.target.checked) n.add(f.clave); else n.delete(f.clave); return n })} />
                                importar igual
                              </label>
                            </div>
                          )}
                        </td>
                        <td className="p-2 align-top text-gray-700">{fmtFecha(f.fecha)}</td>
                        <td className="p-2 align-top text-gray-700 max-w-[220px] truncate" title={`${f.cliente} · ${f.cuit}`}>{f.cliente}</td>
                        <td className="p-2 align-top text-gray-700">{f.tipo ?? '—'} · {f.numero ?? '—'}</td>
                        <td className="p-2 align-top text-right text-gray-700">{fmtMonto(f.total)}</td>
                        <td className="p-2 align-top">
                          {f.estado !== 'duplicada' && (
                            <Input type="date" className="h-7 text-xs" title="Vacía = la fecha de emisión"
                              value={fechas[f.clave] ?? ''} onChange={e => { const v = e.target.value; setFechas(prev => ({ ...prev, [f.clave]: v })) }} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          {preview && <Button variant="outline" onClick={() => { setPreview(null); setFile(null) }} disabled={cargando}>Atrás</Button>}
          <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={cargando || descargando}>Cancelar</Button>
          {preview && (
            <Button onClick={importar} disabled={cargando || aImportar === 0} className="bg-blue-600 hover:bg-blue-700">
              {cargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Importar {aImportar}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
