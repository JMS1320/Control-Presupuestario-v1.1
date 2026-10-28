'use client'

/**
 * ❌ LAS FACTURAS SIN PDF — la lista con la que se piden y se buscan (A-FEAT-1287, 2026-10-23).
 *
 * Una sola pieza para los dos lugares que reemplazan a la pantalla «Buscar PDFs» (retirada a pedido del
 * usuario 2026-10-23, opción 1): **Subdiarios** (las del mes contable) y **Facturas sin comprobante** de
 * Facturas ARCA (todas, también las sin imputar). Si cada lugar tuviera su lista, el día que una cambie
 * la otra queda vieja (CLAUDE.md § ♻️).
 *
 * Tildar → 📋 copiar pedido · 📮 pedir al proveedor · 📨 ¿llegaron? · buscar. En cada fila: el pedido
 * («pedida hace N días»), la última búsqueda en el mail, el mail del proveedor (ver / cargar / usar el de
 * pagos) y → Portal. Las filas que no se buscan (No, OK, VER) se ven en gris y vienen sin tildar.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Save, Search } from 'lucide-react'
import { toast } from 'sonner'
import { textoPedidoFacturas } from '@/lib/gas-pdf/lote'
import type { FilaFaltante } from '@/lib/gas-pdf/faltantes'
import { ordenarYFiltrarFaltantes } from '@/lib/gas-pdf/orden-faltantes'

export interface ProveedorMail {
  id: string
  email_facturacion: string | null
  email_pagos: string | null
  gas_habilitado: boolean | null
  fc_modo: string | null
}

interface Props {
  /** Las filas que se ven (ya filtradas por el buscador de la pantalla, si lo hay) */
  filas: FilaFaltante[]
  /** El pie de cada fila: «sin imputar», «03/2026»… (opcional) */
  rotuloDe?: (id: string) => string | null
  /** Qué hace «Buscar»: sólo mail (Subdiarios: la carpeta es «Vincular PDFs») o carpeta y mail */
  dondeBusca: 'mail' | 'ambos'
  buscando: boolean
  proveedores: Record<string, ProveedorMail>
  onGuardarMail: (cuit: string, mail: string) => Promise<boolean>
  onPortal: (cuit: string, proveedor: string) => Promise<void>
  onPedir: (ids: string[]) => void
  onLlegaron: (ids: string[]) => void
  onBuscar: (ids: string[]) => void
  /** Algo más en cada fila (en «sin comprobante»: pegar el link o elegir el candidato) */
  accionFila?: (id: string) => ReactNode
}

const fechaAR = (iso?: string | null) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—'
const pesos = (n?: number | null) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function PanelFacturasSinPdf({ filas: filasTodas, rotuloDe, dondeBusca, buscando, proveedores, onGuardarMail, onPortal, onPedir, onLlegaron, onBuscar, accionFila }: Props) {
  // A-FEAT-1399 (notas 🌙 de JMS 27/10): ordenada por FECHA y con filtro de PROVEEDOR.
  // «Siempre que haya datos se debe pensar el orden lógico en que lo quiere ver el usuario.»
  const [filtroProv, setFiltroProv] = useState('')
  const [masNuevasPrimero, setMasNuevasPrimero] = useState(false)
  const filas = ordenarYFiltrarFaltantes(filasTodas, filtroProv, masNuevasPrimero)
  // null = las que se buscan (el default); se vuelve al default cuando cambian las filas
  const [sel, setSel] = useState<Set<string> | null>(null)
  const [editMail, setEditMail] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const claveFilas = filas.map(f => f.id).join(',')
  useEffect(() => { setSel(null) }, [claveFilas])

  const porDefecto = () => new Set(filas.filter(f => f.buscable).map(f => f.id))
  const tildadas = sel ?? porDefecto()
  const elegidas = filas.filter(f => tildadas.has(f.id))
  const ids = elegidas.map(f => f.id)
  const pedidas = elegidas.filter(f => f.pedido).map(f => f.id)
  const buscables = elegidas.filter(f => f.buscable).map(f => f.id)
  const todas = filas.length > 0 && filas.every(f => tildadas.has(f.id))
  const alternar = (id: string) => setSel(prev => { const n = new Set(prev ?? porDefecto()); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const alternarTodas = () => setSel(todas ? new Set() : new Set(filas.map(f => f.id)))

  const copiarPedido = async () => {
    try {
      await navigator.clipboard.writeText(textoPedidoFacturas(elegidas.map(f => ({
        fecha_emision: f.fecha_emision, imp_total: f.imp_total, proveedor: f.proveedor, comprobante: f.comprobante }))))
      toast.success(`Pedido copiado (${elegidas.length} factura${elegidas.length === 1 ? '' : 's'}). Pegalo donde quieras.`)
    } catch {
      toast.error('El navegador no dejó copiar al portapapeles.')
    }
  }
  const guardarMail = async (cuit: string, mail: string) => {
    setGuardando(cuit)
    const ok = await onGuardarMail(cuit, mail)
    setGuardando(null)
    if (ok) setEditMail(prev => { const n = { ...prev }; delete n[cuit]; return n })
  }

  const celdaMail = (f: FilaFaltante) => {
    const prov = proveedores[f.cuit]
    if (!prov) return <span className="text-[10px] text-gray-400 italic" title="El proveedor no está en el maestro: cargalo en Config PDFs">sin proveedor</span>
    const editando = f.cuit in editMail
    const valor = editando ? editMail[f.cuit] : (prov.email_facturacion ?? '')
    const cambiado = editando && valor.trim() !== (prov.email_facturacion ?? '')
    return (
      <div className="flex items-center gap-1 min-w-[180px]">
        {!valor && !editando && prov.email_pagos ? (
          <>
            <span className="text-[10px] text-gray-500 truncate flex-1" title="Es el mail de PAGOS de este proveedor. Si lo usás, queda guardado como mail de facturas.">
              💡 {prov.email_pagos} <span className="text-gray-400">(de pagos)</span>
            </span>
            <button type="button" disabled={guardando === f.cuit} onClick={() => guardarMail(f.cuit, prov.email_pagos!)}
              className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50">
              {guardando === f.cuit ? <Loader2 className="h-3 w-3 animate-spin" /> : 'usar'}
            </button>
            <button type="button" title="Escribir otro mail" onClick={() => setEditMail(prev => ({ ...prev, [f.cuit]: '' }))}
              className="shrink-0 text-[10px] text-gray-500 underline">otro</button>
          </>
        ) : (
          <input type="email" value={valor} disabled={guardando === f.cuit} placeholder="⚠ sin mail — agregar"
            onChange={e => setEditMail(prev => ({ ...prev, [f.cuit]: e.target.value }))}
            className={`w-full text-[11px] border rounded px-1 py-0.5 ${!valor ? 'border-orange-300 placeholder-orange-500' : 'border-gray-200'}`} />
        )}
        {cambiado && (
          <button type="button" title="Guardar mail" disabled={guardando === f.cuit} onClick={() => guardarMail(f.cuit, valor.trim())}
            className="shrink-0 text-blue-600 hover:text-blue-800">
            {guardando === f.cuit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </button>
        )}
        {!cambiado && prov.email_facturacion && !prov.gas_habilitado && (
          <span className="shrink-0 text-[9px] text-orange-500" title="Tiene mail pero la búsqueda está apagada para este proveedor (no se busca por su mail). Prendela en Config PDFs.">GAS off</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" value={filtroProv} onChange={e => setFiltroProv(e.target.value)}
          placeholder="Filtrar proveedor (nombre o CUIT)"
          className="h-8 w-56 rounded border border-gray-300 px-2 text-xs" />
        {filtroProv && (
          <span className="text-xs text-gray-500">
            {filas.length} de {filasTodas.length}{' '}
            <button type="button" className="underline" onClick={() => setFiltroProv('')}>limpiar</button>
          </span>)}
        <Button variant="outline" size="sm" disabled={elegidas.length === 0} onClick={copiarPedido}
          title="Copia la lista de facturas que faltan (fecha, proveedor, comprobante, importe) para pegarla en un mail o un mensaje">
          📋 Copiar pedido ({elegidas.length})
        </Button>
        <Button variant="outline" size="sm" disabled={elegidas.length === 0 || buscando} onClick={() => onPedir(ids)}
          title="Un mail por proveedor pidiéndole sus facturas: elegís si queda como borrador en Gmail o se envía">
          📮 Pedir al proveedor ({elegidas.length})
        </Button>
        <Button variant="outline" size="sm" disabled={pedidas.length === 0 || buscando} onClick={() => onLlegaron(pedidas)}
          title="Nos mandaron las facturas pedidas: buscarlas en el mail desde el día de cada pedido">
          📨 ¿Llegaron? ({pedidas.length})
        </Button>
        <Button size="sm" disabled={buscables.length === 0 || buscando} onClick={() => onBuscar(buscables)}
          title={dondeBusca === 'mail'
            ? 'Buscar el PDF en el mail (del proveedor y en los reenvíos). La carpeta la mira «🔗 Vincular PDFs»'
            : 'Buscar el PDF: primero la carpeta de su subdiario (sin imputar: su mes de emisión y el siguiente), después el mail'}>
          {buscando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
          {dondeBusca === 'mail' ? '📧 Buscar en el mail' : '🔎 Buscar (carpeta y mail)'} ({buscables.length})
        </Button>
        {buscando && <span className="text-xs text-blue-700">Hay una búsqueda corriendo: el avance está en el cartel de arriba a la derecha.</span>}
      </div>
      <div className="overflow-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-1 w-8"><input type="checkbox" checked={todas} onChange={alternarTodas} title="Tildar / destildar todas las que se ven" /></th>
              <th className="p-1 text-left">
                <button type="button" className="hover:underline" onClick={() => setMasNuevasPrimero(v => !v)}
                  title={masNuevasPrimero ? 'Ahora: las más nuevas primero. Tocá para ver las más viejas primero' : 'Ahora: las más viejas primero. Tocá para ver las más nuevas primero'}>
                  Fecha {masNuevasPrimero ? '▼' : '▲'}
                </button>
              </th>
              <th className="p-1 text-left">Proveedor</th>
              <th className="p-1 text-left">Comprobante</th>
              <th className="p-1 text-right">Total</th>
              <th className="p-1 text-left">Pedido</th>
              <th className="p-1 text-left">Último mail</th>
              <th className="p-1 text-left">Mail del proveedor</th>
              {accionFila && <th className="p-1"></th>}
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id} className={`border-b align-top ${f.buscable ? '' : 'text-gray-400'}`}>
                <td className="p-1"><input type="checkbox" checked={tildadas.has(f.id)} onChange={() => alternar(f.id)} /></td>
                <td className="p-1 whitespace-nowrap">{fechaAR(f.fecha_emision)}</td>
                <td className="p-1">
                  {f.proveedor}
                  {proveedores[f.cuit] && (
                    <button type="button" disabled={buscando} onClick={() => onPortal(f.cuit, f.proveedor)}
                      title="Este proveedor factura por portal: queda como Portal con todas sus facturas sin 📎, y no se busca"
                      className="ml-1 text-[10px] px-1 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100">→ Portal</button>
                  )}
                </td>
                <td className="p-1 whitespace-nowrap">
                  {f.comprobante}
                  {!f.buscable && <span className="ml-1 text-[10px] px-1 rounded border border-gray-300"
                    title={f.fc === 'VER' ? 'Tiene candidatos para confirmar: se resuelve en «👀 A confirmar»' : `FC «${f.fc}»: no se busca`}>FC {f.fc}</span>}
                  {rotuloDe?.(f.id) && <span className="block text-[10px] text-gray-500">{rotuloDe(f.id)}</span>}
                </td>
                <td className="p-1 text-right whitespace-nowrap">{pesos(f.imp_total)}</td>
                <td className="p-1 whitespace-nowrap text-xs">
                  {f.pedido ? (
                    <span className="text-amber-700" title={f.pedido.borrador ? 'Se armó el borrador del pedido (en Gmail): fijate si lo mandaste' : 'Se le pidió la factura al proveedor por mail'}>
                      📮 {f.pedido.borrador ? 'borrador' : 'pedida'} {f.pedido.hace}{' '}
                      <button type="button" className="underline text-blue-700" disabled={buscando}
                        title="Nos mandó la factura: buscarla en el mail desde el día del pedido"
                        onClick={() => onLlegaron([f.id])}>📨 ¿llegó?</button>
                    </span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="p-1 whitespace-nowrap text-xs text-gray-500">{f.ultimoMail ? fechaAR(f.ultimoMail) : 'nunca'}</td>
                <td className="p-1">{celdaMail(f)}</td>
                {accionFila && <td className="p-1 text-right">{accionFila(f.id)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
