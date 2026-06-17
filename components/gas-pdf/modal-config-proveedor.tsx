'use client'

/**
 * Modal "Configurar proveedores GAS"
 *
 * Lista todos los proveedores que tienen al menos 1 factura cargada en alguno
 * de los schemas (msa/pam/ma). Por cada uno, permite editar:
 *   - fc_modo: 'mail' / 'portal' / 'sin_config'
 *   - email_facturacion
 *   - patron_asunto
 *   - dias_busqueda
 *   - gas_habilitado (toggle)
 *
 * Muestra estadísticas de FC por estado para cada proveedor.
 */

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

interface Proveedor {
  id: string
  cuit: string
  razon_social: string
  email_facturacion: string | null
  fc_modo: string | null
  patron_asunto: string | null
  dias_busqueda: number | null
  gas_habilitado: boolean | null
  pdf_ultimo_intento: string | null
  stats?: { total: number; por_estado: Record<string, number> }
}

interface Props {
  open: boolean
  onClose: () => void
  cuitInicial?: string | null
}

export function ModalConfigProveedor({ open, onClose, cuitInicial }: Props) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cargando, setCargando] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [guardandoId, setGuardandoId] = useState<string | null>(null)

  // Estados locales por proveedor para edición
  const [edits, setEdits] = useState<Record<string, Partial<Proveedor>>>({})

  useEffect(() => {
    if (!open) return
    setCargando(true)
    fetch('/api/gas/config-proveedor')
      .then(r => r.json())
      .then(d => {
        if (d.ok) setProveedores(d.proveedores)
        else toast.error('Error: ' + d.error)
      })
      .catch(e => toast.error('Error de red: ' + e.message))
      .finally(() => setCargando(false))
  }, [open])

  useEffect(() => {
    if (cuitInicial && proveedores.length > 0) {
      setFiltro(cuitInicial)
    }
  }, [cuitInicial, proveedores.length])

  const proveedoresFiltrados = proveedores.filter(p => {
    if (!filtro) return true
    const f = filtro.toLowerCase()
    return (p.razon_social || '').toLowerCase().includes(f)
        || (p.cuit || '').includes(f)
        || (p.email_facturacion || '').toLowerCase().includes(f)
  })

  function setEditField(id: string, field: keyof Proveedor, val: any) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }))
  }

  function getValue(p: Proveedor, field: keyof Proveedor): any {
    return edits[p.id]?.[field] !== undefined ? edits[p.id][field] : p[field]
  }

  async function guardar(p: Proveedor) {
    const cambios = edits[p.id]
    if (!cambios || Object.keys(cambios).length === 0) {
      toast.info('Sin cambios para guardar')
      return
    }
    setGuardandoId(p.id)
    try {
      const r = await fetch('/api/gas/config-proveedor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedor_id: p.id, ...cambios })
      })
      const d = await r.json()
      if (d.ok) {
        toast.success(`${p.razon_social}: configuración guardada`)
        // Actualizar local
        setProveedores(prev => prev.map(x => x.id === p.id ? { ...x, ...cambios } : x))
        setEdits(prev => { const next = { ...prev }; delete next[p.id]; return next })
      } else {
        toast.error('Error: ' + d.error)
      }
    } catch (e) {
      toast.error('Error de red: ' + (e as Error).message)
    } finally {
      setGuardandoId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-7xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>⚙️ Configurar proveedores — búsqueda automática de PDFs</DialogTitle>
          <DialogDescription>
            Configurá el email, patrón de asunto y modo de descarga para cada proveedor.
            Solo proveedores con <b>gas_habilitado = TRUE</b> y email cargado son buscados automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          <Input
            placeholder="Buscar por nombre, CUIT o email…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="max-w-md"
          />
          <span className="text-xs text-gray-500">
            {proveedoresFiltrados.length} de {proveedores.length}
          </span>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-8 text-gray-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Cargando proveedores…</span>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border px-2 py-1.5 text-left w-[220px]">Proveedor</th>
                  <th className="border px-2 py-1.5 text-left w-[120px]">CUIT</th>
                  <th className="border px-2 py-1.5 text-left">FCs (por estado)</th>
                  <th className="border px-2 py-1.5 text-left w-[110px]">Modo</th>
                  <th className="border px-2 py-1.5 text-left w-[200px]">Email facturación</th>
                  <th className="border px-2 py-1.5 text-left w-[130px]">Patrón asunto</th>
                  <th className="border px-2 py-1.5 text-center w-[60px]">Días</th>
                  <th className="border px-2 py-1.5 text-center w-[70px]">GAS</th>
                  <th className="border px-2 py-1.5 text-center w-[70px]"></th>
                </tr>
              </thead>
              <tbody>
                {proveedoresFiltrados.map((p) => {
                  const hasEdits = !!edits[p.id] && Object.keys(edits[p.id]).length > 0
                  return (
                    <tr key={p.id} className={hasEdits ? 'bg-yellow-50' : 'hover:bg-blue-50'}>
                      <td className="border px-2 py-1 truncate" title={p.razon_social}>{p.razon_social}</td>
                      <td className="border px-2 py-1 font-mono">{p.cuit}</td>
                      <td className="border px-2 py-1 text-[10px]">
                        {p.stats?.total ?? 0} total
                        {p.stats && Object.entries(p.stats.por_estado).length > 0 && (
                          <span className="ml-1 text-gray-600">
                            ({Object.entries(p.stats.por_estado).map(([k, v]) => `${k}:${v}`).join(', ')})
                          </span>
                        )}
                      </td>
                      <td className="border px-1 py-0.5">
                        <select
                          value={String(getValue(p, 'fc_modo') ?? 'sin_config')}
                          onChange={(e) => setEditField(p.id, 'fc_modo', e.target.value)}
                          className="w-full text-xs border rounded px-1 py-0.5"
                        >
                          <option value="sin_config">sin_config</option>
                          <option value="mail">mail</option>
                          <option value="portal">portal</option>
                        </select>
                      </td>
                      <td className="border px-1 py-0.5">
                        <input
                          type="email"
                          value={String(getValue(p, 'email_facturacion') ?? '')}
                          onChange={(e) => setEditField(p.id, 'email_facturacion', e.target.value)}
                          placeholder="email@proveedor.com"
                          className="w-full text-xs border rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="border px-1 py-0.5">
                        <input
                          type="text"
                          value={String(getValue(p, 'patron_asunto') ?? '')}
                          onChange={(e) => setEditField(p.id, 'patron_asunto', e.target.value)}
                          placeholder="Factura"
                          className="w-full text-xs border rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="border px-1 py-0.5 text-center">
                        <input
                          type="number"
                          min={1} max={30}
                          value={Number(getValue(p, 'dias_busqueda') ?? 7)}
                          onChange={(e) => setEditField(p.id, 'dias_busqueda', parseInt(e.target.value) || 7)}
                          className="w-12 text-xs border rounded px-1 py-0.5 text-center"
                        />
                      </td>
                      <td className="border px-1 py-0.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!getValue(p, 'gas_habilitado')}
                          onChange={(e) => setEditField(p.id, 'gas_habilitado', e.target.checked)}
                        />
                      </td>
                      <td className="border px-1 py-0.5 text-center">
                        {hasEdits && (
                          <Button
                            size="sm" variant="default" className="h-6 text-[10px] px-2"
                            onClick={() => guardar(p)}
                            disabled={guardandoId === p.id}
                          >
                            {guardandoId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
