"use client"

/**
 * 🕰️ **VENTA HISTÓRICA DE HACIENDA** — A-FEAT-1226 (2026-10-02).
 *
 * Para las ventas anteriores al stock de la app (la de enero: 70 novillos a Rioplatense). Esa
 * hacienda nunca estuvo en el stock, así que la venta **no puede descontarla**: se guarda sin
 * movimiento de stock y marcada `historica`, para que la falta del movimiento se lea como lo que es
 * —a propósito— y no como un error.
 *
 * 🔑 **Misma tabla, misma cuenta**: va a `productivo.stock_ventas` como cualquier venta de hacienda,
 * y el neto sale de `armarVentaHistorica` → `netoDeVenta`, la cuenta de Productivo. Regla del
 * usuario: *«no podemos crear dos fuentes de almacenamiento paralelas y desvinculadas»*.
 *
 * Después se liquida igual que cualquier otra, desde la lista de Ventas.
 */

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
import { supabase } from "@/lib/supabase"
import { altaContraparte } from "@/lib/proveedores/alta"
import { toast } from "sonner"
import { AlertTriangle, Loader2 } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { armarVentaHistorica } from "@/lib/ventas/hacienda"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onGuardado: () => void
}

const vacio = {
  fecha: '', categoriaId: '', cabezas: '', kgTotales: '', desbaste: '', kgCarne: '',
  precioKg: '', cz: '', flete: '', plazo: '', notas: '',
}
type Clave = keyof typeof vacio

export function ModalVentaHistoricaHacienda({ open, onOpenChange, onGuardado }: Props) {
  const [f, setF] = useState(vacio)
  const [cliente, setCliente] = useState({ cuit: '', nombre: '' })
  const [confirmada, setConfirmada] = useState(false)
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([])
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setF(vacio); setCliente({ cuit: '', nombre: '' }); setConfirmada(false)
    supabase.schema('productivo').from('categorias_hacienda').select('id, nombre').order('nombre')
      .then(({ data, error }) => {
        if (error) toast.error('No se pudieron leer las categorías: ' + error.message)
        setCategorias((data || []) as { id: string; nombre: string }[])
      })
  }, [open])

  const set = (k: Clave) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value
    setF(prev => ({ ...prev, [k]: v }))
  }
  /** Al salir del campo, el número queda escrito en es-AR (1.234,5). */
  const formatear = (k: Clave, dec: number) => () =>
    setF(prev => prev[k] ? { ...prev, [k]: fmtNumeroAR(parseNumeroAR(prev[k]), dec) } : prev)

  const armada = useMemo(() => armarVentaHistorica({
    fecha: f.fecha,
    categoriaId: f.categoriaId || null,
    cabezas: parseNumeroAR(f.cabezas),
    kgTotales: parseNumeroAR(f.kgTotales),
    pctDesbaste: parseNumeroAR(f.desbaste) / 100,
    kgCarne: parseNumeroAR(f.kgCarne) || null,
    precioKg: parseNumeroAR(f.precioKg),
    pctCz: parseNumeroAR(f.cz) / 100,
    flete: parseNumeroAR(f.flete),
    plazo: f.plazo,
    cliente: cliente.nombre,
    cuit: cliente.cuit,
    notas: f.notas,
    confirmada,
  }), [f, cliente, confirmada])

  const guardar = async () => {
    if (armada.faltan.length) { toast.error('Falta: ' + armada.faltan.join(', ')); return }
    setGuardando(true)
    try {
      // Sin movimiento de stock, a propósito: eso es lo que la hace histórica.
      const { error } = await supabase.schema('productivo').from('stock_ventas').insert(armada.fila)
      if (error) { toast.error('No se pudo guardar la venta: ' + error.message); return }
      // § Contrapartes: el comprador queda en el maestro como cliente (find-or-create).
      const r = await altaContraparte(supabase, { cuit: cliente.cuit, razon_social: cliente.nombre, como: 'cliente' })
      if (!r.ok) toast.error('La venta se guardó, pero el cliente no quedó en el maestro: ' + r.error)
      toast.success('Venta histórica guardada. Ya se puede liquidar desde la lista.')
      onGuardado(); onOpenChange(false)
    } finally { setGuardando(false) }
  }

  const campo = (label: string, k: Clave, ph: string, dec: number, ayuda?: string) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="text" placeholder={ph} value={f[k]} onChange={set(k)} onBlur={formatear(k, dec)} />
      {ayuda && <div className="text-[10px] text-gray-500 mt-0.5">{ayuda}</div>}
    </div>
  )

  const flete = parseNumeroAR(f.flete)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🕰️ Venta histórica de hacienda</DialogTitle>
          <DialogDescription>
            Para una venta anterior al stock de la app. Se guarda junto a las demás ventas de hacienda,
            pero <strong>no descuenta animales del stock</strong>. Después se liquida desde la lista, como cualquier otra.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Fecha de venta</Label>
            <Input type="date" value={f.fecha} onChange={set('fecha')} />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <Label className="text-xs">Categoría</Label>
            <select className="h-9 w-full rounded-md border px-2 text-sm" value={f.categoriaId} onChange={set('categoriaId')}>
              <option value="">— elegir —</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          {campo('Cabezas', 'cabezas', '0', 0)}
          {campo('Kg vivos', 'kgTotales', '0', 0)}
          {campo('Desbaste %', 'desbaste', '0', 2)}
          {campo('Kg de carne', 'kgCarne', 'sólo al gancho', 0, 'Si fue al gancho: son los kilos que se cobran')}
          {campo('Precio por kg $', 'precioKg', '0,00', 2)}
          {campo('CZ %', 'cz', '0', 2, 'Comisión, flete y otros, en %')}
          {campo('Flete $', 'flete', '0,00', 2, 'Monto, no %')}
          <div>
            <Label className="text-xs">Plazo de cobro</Label>
            <Input type="text" placeholder="30/60/90" value={f.plazo} onChange={set('plazo')} />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <ProveedorCombobox label="Cliente" rol="cliente" value={cliente}
              onChange={sel => setCliente({ cuit: sel.cuit, nombre: sel.nombre })} />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <Label className="text-xs">Notas</Label>
            <textarea className="h-14 w-full rounded-md border px-2 py-1 text-sm" value={f.notas} onChange={set('notas')}
              placeholder="Lo que haga falta recordar de esta venta" />
          </div>
        </div>

        {/* La cuenta, a la vista: es la misma que hace Productivo. */}
        <div className="rounded border bg-gray-50 p-3 text-sm grid gap-1">
          <div className="flex justify-between">
            <span>Kg que se cobran {parseNumeroAR(f.kgCarne) > 0 ? '(carne)' : '(vivos − desbaste)'}</span>
            <span className="font-mono">{fmtNumeroAR(armada.kgQueSeCobran, 1)}</span>
          </div>
          <div className="flex justify-between"><span>Bruto</span><span className="font-mono">$ {fmtNumeroAR(armada.bruto)}</span></div>
          <div className="flex justify-between"><span>− CZ</span><span className="font-mono">$ {fmtNumeroAR(armada.cz)}</span></div>
          {flete > 0 && <div className="flex justify-between"><span>− Flete</span><span className="font-mono">$ {fmtNumeroAR(flete)}</span></div>}
          <div className="flex justify-between font-semibold border-t pt-1">
            <span>Neto de la venta</span><span className="font-mono">$ {fmtNumeroAR(armada.neto)}</span>
          </div>
        </div>

        {armada.avisos.map(a => (
          <div key={a} className="flex gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />{a}
          </div>
        ))}

        <label className="flex gap-2 rounded border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 cursor-pointer">
          <input type="checkbox" checked={confirmada} onChange={e => setConfirmada(e.target.checked)} className="mt-0.5" />
          <span><strong>Esta venta NO descuenta stock.</strong> Confirmo que es histórica: la hacienda no está en el stock de la app.</span>
        </label>

        <DialogFooter className="items-center gap-2">
          {armada.faltan.length > 0 && <span className="text-xs text-gray-500 mr-auto">Falta: {armada.faltan.join(', ')}</span>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || armada.faltan.length > 0}>
            {guardando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar venta histórica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
