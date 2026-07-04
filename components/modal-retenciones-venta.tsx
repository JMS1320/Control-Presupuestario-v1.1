"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { Loader2, Plus, Trash2, Save } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface Comprobante {
  id: string
  nro_comprobante: string | null
  cuit_cliente: string | null
  denominacion_cliente: string | null
  imp_total: number | null
}
interface Retencion {
  id: string
  tipo: string
  monto: number
  cuenta_contable: string | null
  fecha: string | null
  nro_certificado: string | null
}

const TIPOS = [
  { value: 'iva', label: 'Ret. IVA' },
  { value: 'iibb', label: 'Ret. IIBB' },
  { value: 'ganancias', label: 'Ret. Ganancias' },
]

const fmtAR = (n: number) => `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const parseAR = (v: string) => parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0

export function ModalRetencionesVenta({ open, onClose, comprobante, onGuardado }: {
  open: boolean
  onClose: () => void
  comprobante: Comprobante | null
  onGuardado?: () => void
}) {
  const [retenciones, setRetenciones] = useState<Retencion[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // Form nueva retención
  const [tipo, setTipo] = useState('iva')
  const [monto, setMonto] = useState('')
  const [cuenta, setCuenta] = useState('')
  const [pickingCuenta, setPickingCuenta] = useState(false)
  const [fecha, setFecha] = useState('')
  const [nroCert, setNroCert] = useState('')

  const cargar = async () => {
    if (!comprobante) return
    setCargando(true)
    const { data, error } = await supabase.schema('msa').from('retenciones_recibidas')
      .select('id, tipo, monto, cuenta_contable, fecha, nro_certificado')
      .eq('comprobante_venta_id', comprobante.id)
      .order('created_at', { ascending: true })
    if (error) toast.error('Error al cargar retenciones: ' + error.message)
    setRetenciones((data as Retencion[]) || [])
    setCargando(false)
  }

  useEffect(() => {
    if (open && comprobante) { cargar(); setTipo('iva'); setMonto(''); setCuenta(''); setPickingCuenta(false); setFecha(''); setNroCert('') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, comprobante?.id])

  // Default por tipo: prefijar la cuenta usada por última vez para ese tipo
  const onCambiarTipo = async (nuevoTipo: string) => {
    setTipo(nuevoTipo)
    const { data } = await supabase.schema('msa').from('retenciones_recibidas')
      .select('cuenta_contable').eq('tipo', nuevoTipo).not('cuenta_contable', 'is', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (data?.cuenta_contable) setCuenta(data.cuenta_contable)
  }

  const agregar = async () => {
    if (!comprobante) return
    const m = parseAR(monto)
    if (!m) { toast.error('Ingresá el monto'); return }
    if (!cuenta) { toast.error('Elegí la cuenta contable'); return }
    setGuardando(true)
    const { error } = await supabase.schema('msa').from('retenciones_recibidas').insert({
      tipo,
      monto: m,
      cuenta_contable: cuenta,
      comprobante_venta_id: comprobante.id,
      cuit_cliente: comprobante.cuit_cliente,
      denominacion_cliente: comprobante.denominacion_cliente,
      fecha: fecha || null,
      nro_certificado: nroCert.trim() || null,
    })
    setGuardando(false)
    if (error) { toast.error('Error al guardar: ' + error.message); return }
    toast.success('Retención agregada')
    setMonto(''); setNroCert('')
    cargar()
    onGuardado?.()
  }

  const borrar = async (r: Retencion) => {
    if (!window.confirm('¿Borrar esta retención?')) return
    const { error } = await supabase.schema('msa').from('retenciones_recibidas').delete().eq('id', r.id)
    if (error) { toast.error('Error al borrar: ' + error.message); return }
    toast.success('Retención borrada')
    cargar()
    onGuardado?.()
  }

  const totalRet = retenciones.reduce((s, r) => s + (Number(r.monto) || 0), 0)
  const total = Number(comprobante?.imp_total) || 0
  const netoACobrar = total - totalRet

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Retenciones recibidas</DialogTitle>
          <DialogDescription>
            {comprobante ? `${comprobante.nro_comprobante || ''} · ${comprobante.denominacion_cliente || ''} · Total ${fmtAR(total)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Resumen */}
        <div className="flex gap-4 text-sm bg-gray-50 border rounded p-2">
          <span>Total factura: <b>{fmtAR(total)}</b></span>
          <span>Retenciones: <b className="text-orange-700">{fmtAR(totalRet)}</b></span>
          <span>Neto a cobrar (banco): <b className="text-green-700">{fmtAR(netoACobrar)}</b></span>
        </div>

        {/* Alta de retención */}
        <div className="border rounded-lg p-3 space-y-2 bg-white">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={onCambiarTipo}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Monto</Label>
              <Input type="text" placeholder="0,00" value={monto} onChange={e => setMonto(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Cuenta contable *</Label>
            {cuenta && !pickingCuenta ? (
              <div className="flex items-center gap-2 border rounded px-2 py-1.5 text-sm bg-gray-50">
                <span className="flex-1 truncate" title={cuenta}>{cuenta}</span>
                <button type="button" className="text-blue-600 text-xs shrink-0" onClick={() => setPickingCuenta(true)}>Cambiar</button>
              </div>
            ) : (
              <SelectorCuentaContable
                value={cuenta}
                onSelect={(c: any) => { setCuenta(c?.categ || ''); setPickingCuenta(false) }}
                placeholder="Buscar cuenta del plan..."
                mostrarSinAsignar={false}
                className="w-full"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fecha (opcional)</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Nro. certificado (opcional)</Label>
              <Input type="text" value={nroCert} onChange={e => setNroCert(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={agregar} disabled={guardando} className="bg-blue-600 hover:bg-blue-700">
              {guardando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}Agregar
            </Button>
          </div>
        </div>

        {/* Lista */}
        {cargando ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Cuenta</TableHead>
                  <TableHead className="text-xs text-right">Monto</TableHead>
                  <TableHead className="text-xs">Cert.</TableHead>
                  <TableHead className="text-xs w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retenciones.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground text-sm">Sin retenciones</TableCell></TableRow>
                ) : retenciones.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{TIPOS.find(t => t.value === r.tipo)?.label || r.tipo}</TableCell>
                    <TableCell className="text-sm">{r.cuenta_contable || '—'}</TableCell>
                    <TableCell className="text-sm text-right">{fmtAR(r.monto)}</TableCell>
                    <TableCell className="text-sm">{r.nro_certificado || '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => borrar(r)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
