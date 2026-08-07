'use client'

/**
 * Ficha de proveedor — la pantalla para MIRAR los datos de un proveedor.
 *
 * Es un modal a propósito: la consulta es puntual y en medio de otra cosa
 * (una factura, un pago, un movimiento del extracto), así que tiene que
 * devolverte a donde estabas. Editar es la excepción y por eso vive detrás de
 * un botón: se entra en lectura.
 *
 * Se abre de dos formas:
 *   - sin `cuitInicial` → arranca en el buscador
 *   - con `cuitInicial` → abre directo en esa ficha (desde el contexto)
 *
 * Lee de GET /api/proveedores/ficha y escribe por PATCH /api/gas/config-proveedor,
 * que es la única vía de escritura del maestro.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Loader2, Search, ArrowLeft, Pencil, Save, X, AlertCircle, Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { normalizarBusqueda } from '@/lib/normalizar-texto'

interface ProveedorLista {
  id: string
  cuit: string
  razon_social: string
  nombre_fantasia: string | null
  es_cliente: boolean | null
  es_proveedor: boolean | null
  activo: boolean | null
}

interface Ficha {
  proveedor: Record<string, any>
  facturas: any[]
  facturasTotales: number
  pagos: any[]
  pagosTotales: number
  anticipos: any[]
  resumen: any
}

interface Props {
  open: boolean
  onClose: () => void
  cuitInicial?: string | null
}

const pesos = (n: number | null | undefined) =>
  `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fecha = (f: string | null) => (f ? new Date(f + 'T00:00:00').toLocaleDateString('es-AR') : '—')

/** Cómo se supo que un movimiento del extracto es de este proveedor */
const ETIQUETA_VIA: Record<string, { texto: string; clase: string }> = {
  factura: { texto: 'por factura', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  template: { texto: 'por template', clase: 'bg-violet-50 text-violet-700 border-violet-200' },
  anticipo: { texto: 'por anticipo', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  nombre: { texto: 'sólo por nombre', clase: 'bg-gray-100 text-gray-600 border-gray-200' },
}

/** Campos editables, agrupados como se muestran. `tipo` define el input. */
const SECCIONES: Array<{
  titulo: string
  campos: Array<{ campo: string; label: string; tipo?: 'texto' | 'bool' | 'tags' | 'largo' }>
}> = [
  {
    titulo: 'Identidad',
    campos: [
      { campo: 'razon_social', label: 'Razón social' },
      { campo: 'nombre_fantasia', label: 'Nombre conocido' },
      { campo: 'empresa_principal', label: 'Empresa principal' },
      { campo: 'es_proveedor', label: 'Es proveedor', tipo: 'bool' },
      { campo: 'es_cliente', label: 'Es cliente', tipo: 'bool' },
      { campo: 'activo', label: 'Activo', tipo: 'bool' },
    ],
  },
  {
    titulo: 'Datos bancarios',
    campos: [
      { campo: 'cbu', label: 'CBU' },
      { campo: 'alias_cbu', label: 'Alias' },
      { campo: 'banco', label: 'Banco' },
      { campo: 'tipo_cuenta', label: 'Tipo de cuenta' },
      { campo: 'moneda_cuenta', label: 'Moneda' },
      { campo: 'mensaje_transferencia', label: 'Mensaje de transferencia' },
    ],
  },
  {
    titulo: 'Contacto',
    campos: [
      { campo: 'email_pagos', label: 'Mail de pagos' },
      { campo: 'email_facturacion', label: 'Mail de facturación' },
      { campo: 'telefono', label: 'Teléfono' },
      { campo: 'contacto_nombre', label: 'Contacto' },
      { campo: 'tags', label: 'Tags', tipo: 'tags' },
      { campo: 'notas', label: 'Notas', tipo: 'largo' },
    ],
  },
  {
    titulo: 'Búsqueda de PDFs',
    campos: [
      { campo: 'fc_modo', label: 'Modo FC' },
      { campo: 'patron_asunto', label: 'Patrón de asunto' },
      { campo: 'dias_busqueda', label: 'Días de búsqueda' },
      { campo: 'gas_habilitado', label: 'Búsqueda habilitada', tipo: 'bool' },
    ],
  },
]

export function ModalFichaProveedor({ open, onClose, cuitInicial }: Props) {
  const [lista, setLista] = useState<ProveedorLista[]>([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const [cuit, setCuit] = useState<string | null>(null)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [cargandoFicha, setCargandoFicha] = useState(false)

  const [editando, setEditando] = useState(false)
  const [edits, setEdits] = useState<Record<string, any>>({})
  const [guardando, setGuardando] = useState(false)

  // Al abrir: la lista siempre (el buscador se usa también para saltar de uno a otro)
  useEffect(() => {
    if (!open) return
    setCuit(cuitInicial ? cuitInicial.replace(/\D/g, '') : null)
    setBusqueda('')
    setCargandoLista(true)
    fetch('/api/proveedores/ficha')
      .then(r => r.json())
      .then(d => { if (d.ok) setLista(d.proveedores); else toast.error('Error: ' + d.error) })
      .catch(e => toast.error('Error de red: ' + e.message))
      .finally(() => setCargandoLista(false))
  }, [open, cuitInicial])

  const cargarFicha = useCallback((c: string) => {
    setCargandoFicha(true)
    setFicha(null)
    fetch(`/api/proveedores/ficha?cuit=${encodeURIComponent(c)}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setFicha(d)
        else { toast.error(d.error); setCuit(null) }
      })
      .catch(e => toast.error('Error de red: ' + e.message))
      .finally(() => setCargandoFicha(false))
  }, [])

  useEffect(() => {
    if (!open || !cuit) return
    setEditando(false)
    setEdits({})
    cargarFicha(cuit)
  }, [open, cuit, cargarFicha])

  const filtrados = useMemo(() => {
    const q = normalizarBusqueda(busqueda)
    if (!q) return lista
    return lista.filter(p =>
      normalizarBusqueda(p.razon_social).includes(q)
      || normalizarBusqueda(p.nombre_fantasia).includes(q)
      || (p.cuit || '').includes(q.replace(/\D/g, '')))
  }, [lista, busqueda])

  const valor = (campo: string) =>
    (edits[campo] !== undefined ? edits[campo] : ficha?.proveedor?.[campo])

  async function guardar() {
    if (!ficha || Object.keys(edits).length === 0) { setEditando(false); return }
    setGuardando(true)
    try {
      const r = await fetch('/api/gas/config-proveedor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedor_id: ficha.proveedor.id, ...edits }),
      })
      const d = await r.json()
      if (!d.ok) { toast.error('Error: ' + d.error); return }
      toast.success('Proveedor actualizado')
      setFicha({ ...ficha, proveedor: { ...ficha.proveedor, ...edits } })
      setEdits({})
      setEditando(false)
      // La lista puede haber cambiado de nombre o de flags
      fetch('/api/proveedores/ficha').then(r2 => r2.json())
        .then(d2 => { if (d2.ok) setLista(d2.proveedores) })
    } catch (e) {
      toast.error('Error de red: ' + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const p = ficha?.proveedor

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {cuit && p ? p.razon_social : 'Proveedores'}
          </DialogTitle>
          <DialogDescription>
            {cuit && p
              ? `CUIT ${p.cuit}`
              : 'Buscá un proveedor para ver su ficha, sus facturas y sus pagos.'}
          </DialogDescription>
        </DialogHeader>

        {/* ─────────────── BUSCADOR ─────────────── */}
        {!cuit && (
          <>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                autoFocus
                className="pl-8"
                placeholder="Buscar por nombre o CUIT…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {cargandoLista ? (
                <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando proveedores…
                </div>
              ) : filtrados.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">
                  Ningún proveedor coincide con «{busqueda}».
                </p>
              ) : (
                <ul className="divide-y">
                  {filtrados.map(pr => (
                    <li key={pr.id}>
                      <button
                        className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => setCuit(pr.cuit)}
                      >
                        <span className="flex-1 truncate text-gray-800">
                          {pr.razon_social}
                          {pr.nombre_fantasia && (
                            <span className="ml-1 text-gray-400">({pr.nombre_fantasia})</span>
                          )}
                        </span>
                        {pr.es_cliente && <Badge variant="outline" className="text-[10px]">cliente</Badge>}
                        {!pr.activo && <Badge variant="outline" className="text-[10px] text-gray-400">inactivo</Badge>}
                        <span className="w-28 text-right font-mono text-xs text-gray-500">{pr.cuit}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-[11px] text-gray-500">{filtrados.length} de {lista.length} proveedores</p>
          </>
        )}

        {/* ─────────────── FICHA ─────────────── */}
        {cuit && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setCuit(null); setFicha(null) }}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Todos
              </Button>
              {p?.es_proveedor && <Badge variant="outline">proveedor</Badge>}
              {p?.es_cliente && <Badge variant="outline">cliente</Badge>}
              {p && !p.activo && <Badge variant="outline" className="text-gray-400">inactivo</Badge>}
              <div className="ml-auto flex gap-2">
                {editando ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => { setEdits({}); setEditando(false) }}>
                      <X className="mr-1 h-3.5 w-3.5" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={guardar} disabled={guardando}>
                      {guardando
                        ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        : <Save className="mr-1 h-3.5 w-3.5" />}
                      Guardar
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setEditando(true)} disabled={!p}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                  </Button>
                )}
              </div>
            </div>

            {cargandoFicha && (
              <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando la ficha…
              </div>
            )}

            {ficha && p && (
              <>
                {/* Resumen */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Chip titulo="Compras" valor={pesos(ficha.resumen.compras.total)}
                    pie={`${ficha.resumen.compras.cantidad} facturas`} />
                  <Chip titulo="Ventas" valor={pesos(ficha.resumen.ventas.total)}
                    pie={`${ficha.resumen.ventas.cantidad} comprobantes`} />
                  <Chip titulo="Pagos" valor={pesos(ficha.resumen.pagos.total)}
                    pie={`${ficha.resumen.pagos.cantidad} movimientos`} />
                  <Chip titulo="Anticipos" valor={pesos(ficha.resumen.anticipos.pendiente)}
                    pie={`${ficha.resumen.anticipos.cantidad} · sin aplicar`} />
                </div>

                {/* Datos */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {SECCIONES.map(sec => (
                    <div key={sec.titulo} className="rounded border p-3">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {sec.titulo}
                      </h4>
                      <dl className="space-y-1.5">
                        {sec.campos.map(c => (
                          <div key={c.campo} className="grid grid-cols-[130px_1fr] items-center gap-2">
                            <Label className="text-xs font-normal text-gray-500">{c.label}</Label>
                            {editando ? (
                              <CampoEditable
                                tipo={c.tipo}
                                valor={valor(c.campo)}
                                onChange={v => setEdits(e => ({ ...e, [c.campo]: v }))}
                              />
                            ) : (
                              <dd className="truncate text-xs text-gray-800" title={mostrar(valor(c.campo))}>
                                {mostrar(valor(c.campo))}
                              </dd>
                            )}
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>

                {/* Facturas */}
                <Bloque titulo="Últimas facturas" total={ficha.facturasTotales} mostradas={ficha.facturas.length}>
                  {ficha.facturas.length === 0 ? (
                    <Vacio texto="No hay facturas cargadas a nombre de este CUIT." />
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-gray-50 text-[10px] text-gray-500">
                          <th className="px-2 py-1 text-left font-medium">Fecha</th>
                          <th className="px-2 py-1 text-left font-medium">Número</th>
                          <th className="px-2 py-1 text-left font-medium">Detalle</th>
                          <th className="px-2 py-1 text-left font-medium">Cuenta</th>
                          <th className="px-2 py-1 text-left font-medium">Estado</th>
                          <th className="px-2 py-1 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ficha.facturas.map(f => (
                          <tr key={`${f.tipo}-${f.id}`} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="whitespace-nowrap px-2 py-1 text-gray-600">{fecha(f.fecha)}</td>
                            <td className="whitespace-nowrap px-2 py-1">
                              <Badge variant="outline" className={`mr-1 text-[9px] ${
                                f.tipo === 'venta'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-gray-200 text-gray-500'}`}>
                                {f.tipo === 'venta' ? 'venta' : f.empresa}
                              </Badge>
                              <span className="font-mono text-gray-700">{f.numero}</span>
                            </td>
                            <td className="max-w-[180px] truncate px-2 py-1 text-gray-600" title={f.descripcion || ''}>
                              {f.descripcion || '—'}
                            </td>
                            <td className="max-w-[140px] truncate px-2 py-1 text-gray-500" title={f.cuenta_contable || ''}>
                              {f.cuenta_contable || '—'}
                            </td>
                            <td className="px-2 py-1 text-gray-500">{f.estado || '—'}</td>
                            <td className="whitespace-nowrap px-2 py-1 text-right text-gray-800">{pesos(f.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Bloque>

                {/* Pagos */}
                <Bloque titulo="Últimos pagos" total={ficha.pagosTotales} mostradas={ficha.pagos.length}>
                  {ficha.pagos.length === 0 ? (
                    <Vacio texto="No hay movimientos del extracto vinculados a este proveedor." />
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-gray-50 text-[10px] text-gray-500">
                          <th className="px-2 py-1 text-left font-medium">Fecha</th>
                          <th className="px-2 py-1 text-left font-medium">Movimiento</th>
                          <th className="px-2 py-1 text-left font-medium">Paga</th>
                          <th className="px-2 py-1 text-left font-medium">Vínculo</th>
                          <th className="px-2 py-1 text-right font-medium">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ficha.pagos.map(pg => (
                          <tr key={pg.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="whitespace-nowrap px-2 py-1 text-gray-600">{fecha(pg.fecha)}</td>
                            <td className="max-w-[220px] truncate px-2 py-1 text-gray-700"
                              title={pg.detalle || pg.descripcion || ''}>
                              {pg.detalle || pg.descripcion || '—'}
                            </td>
                            <td className="max-w-[150px] truncate px-2 py-1 text-gray-500"
                              title={pg.comprobantes_pagados || ''}>
                              {pg.comprobantes_pagados || '—'}
                            </td>
                            <td className="px-2 py-1">
                              <Badge variant="outline" className={`text-[9px] ${ETIQUETA_VIA[pg.via]?.clase || ''}`}>
                                {ETIQUETA_VIA[pg.via]?.texto || pg.via}
                              </Badge>
                            </td>
                            <td className={`whitespace-nowrap px-2 py-1 text-right ${
                              pg.monto < 0 ? 'text-emerald-700' : 'text-gray-800'}`}>
                              {pesos(pg.monto)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <p className="mt-2 flex items-start gap-1.5 rounded bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
                    <AlertCircle className="mt-px h-3 w-3 shrink-0" />
                    <span>
                      Los pagos salen de los <strong>extractos bancarios</strong> (Galicia MSA y PAM),
                      porque el pago queda registrado recién al conciliar el movimiento — la fecha de
                      pago de la factura casi nunca está cargada. Todavía <strong>no se ven</strong> los
                      pagos por caja, cheque o tarjeta, ni los <strong>cobros</strong> de una venta.
                      Los marcados <em>sólo por nombre</em> coinciden por el nombre del proveedor en el
                      movimiento, sin comprobante vinculado.
                    </span>
                  </p>
                </Bloque>

                {/* Anticipos */}
                {ficha.anticipos.length > 0 && (
                  <Bloque titulo="Anticipos" total={ficha.anticipos.length} mostradas={ficha.anticipos.length}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-gray-50 text-[10px] text-gray-500">
                          <th className="px-2 py-1 text-left font-medium">Fecha</th>
                          <th className="px-2 py-1 text-left font-medium">Descripción</th>
                          <th className="px-2 py-1 text-left font-medium">Estado</th>
                          <th className="px-2 py-1 text-right font-medium">Monto</th>
                          <th className="px-2 py-1 text-right font-medium">Sin aplicar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ficha.anticipos.map(a => (
                          <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="whitespace-nowrap px-2 py-1 text-gray-600">{fecha(a.fecha_pago)}</td>
                            <td className="max-w-[240px] truncate px-2 py-1 text-gray-700" title={a.descripcion || ''}>
                              {a.descripcion || '—'}
                            </td>
                            <td className="px-2 py-1 text-gray-500">{a.estado || '—'}</td>
                            <td className="whitespace-nowrap px-2 py-1 text-right text-gray-800">{pesos(a.monto)}</td>
                            <td className="whitespace-nowrap px-2 py-1 text-right text-gray-600">{pesos(a.monto_restante)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Bloque>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────── piezas ───────────────────────────

function mostrar(v: any): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  return String(v)
}

function CampoEditable({ tipo, valor, onChange }: {
  tipo?: 'texto' | 'bool' | 'tags' | 'largo'
  valor: any
  onChange: (v: any) => void
}) {
  if (tipo === 'bool') {
    return (
      <input type="checkbox" className="h-3.5 w-3.5 justify-self-start"
        checked={!!valor} onChange={e => onChange(e.target.checked)} />
    )
  }
  if (tipo === 'tags') {
    return (
      <Input className="h-7 text-xs" placeholder="separados por coma"
        value={Array.isArray(valor) ? valor.join(', ') : (valor ?? '')}
        onChange={e => onChange(
          e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
    )
  }
  return (
    <Input className="h-7 text-xs" value={valor ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : e.target.value)} />
  )
}

function Chip({ titulo, valor, pie }: { titulo: string; valor: string; pie: string }) {
  return (
    <div className="rounded border bg-gray-50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{titulo}</div>
      <div className="truncate text-sm font-semibold text-gray-800" title={valor}>{valor}</div>
      <div className="text-[10px] text-gray-500">{pie}</div>
    </div>
  )
}

function Bloque({ titulo, total, mostradas, children }: {
  titulo: string; total: number; mostradas: number; children: React.ReactNode
}) {
  return (
    <div className="rounded border p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {titulo}
        {total > mostradas && (
          <span className="ml-1 font-normal normal-case text-gray-400">
            — se muestran {mostradas} de {total}
          </span>
        )}
      </h4>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="py-4 text-center text-xs text-gray-400">{texto}</p>
}
