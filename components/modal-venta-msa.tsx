"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export interface VentaMsa {
  id: string
  cuit_cliente: string
  denominacion_cliente: string
  fecha_operacion: string
  grano: string | null
  grado: string | null
  factor: number | null
  toneladas: number | null
  modo_precio: 'usd' | 'pesos'
  precio_usd: number | null
  tc: number | null
  precio_pesos: number | null
  alicuota_iva: number | null
  comision_neto: number | null
  comision_alicuota: number | null
  almacenaje_neto: number | null
  almacenaje_alicuota: number | null
  observaciones: string | null
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  ventaInicial?: VentaMsa | null    // null = alta, objeto = edición
  onGuardado?: () => void
}

// Parser argentino: "1.234,56" → 1234.56
const parsearAR = (s: string): number => {
  if (!s) return 0
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0
}

// Formato argentino — con decimales fijos
const fmtAR = (n: number, dec = 2) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const fmtMoney = (n: number) => `$${fmtAR(n)}`

export function ModalVentaMsa({ open, onOpenChange, ventaInicial, onGuardado }: Props) {
  const esEdicion = !!ventaInicial?.id

  // Estado del form. Todos los montos como string para inputs es-AR.
  const [cliente, setCliente] = useState({ cuit: '', nombre: '' })
  const [fechaOperacion, setFechaOperacion] = useState('')
  const [grano, setGrano] = useState('')
  const [grado, setGrado] = useState('')
  const [factor, setFactor] = useState('')
  const [toneladas, setToneladas] = useState('')
  const [modoPrecio, setModoPrecio] = useState<'usd' | 'pesos'>('pesos')
  const [precioUsd, setPrecioUsd] = useState('')
  const [tc, setTc] = useState('')
  const [precioPesos, setPrecioPesos] = useState('')
  const [alicuotaIva, setAlicuotaIva] = useState('21')
  const [comisionNeto, setComisionNeto] = useState('')
  const [comisionAlicuota, setComisionAlicuota] = useState('')
  const [almacenajeNeto, setAlmacenajeNeto] = useState('')
  const [almacenajeAlicuota, setAlmacenajeAlicuota] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Cargar datos al abrir (alta o edición)
  useEffect(() => {
    if (!open) return
    if (ventaInicial) {
      setCliente({ cuit: ventaInicial.cuit_cliente, nombre: ventaInicial.denominacion_cliente })
      setFechaOperacion(ventaInicial.fecha_operacion || '')
      setGrano(ventaInicial.grano || '')
      setGrado(ventaInicial.grado || '')
      setFactor(ventaInicial.factor != null ? String(ventaInicial.factor) : '')
      setToneladas(ventaInicial.toneladas != null ? fmtAR(ventaInicial.toneladas, 4) : '')
      setModoPrecio(ventaInicial.modo_precio || 'pesos')
      setPrecioUsd(ventaInicial.precio_usd != null ? fmtAR(ventaInicial.precio_usd, 4) : '')
      setTc(ventaInicial.tc != null ? fmtAR(ventaInicial.tc, 4) : '')
      setPrecioPesos(ventaInicial.precio_pesos != null ? fmtAR(ventaInicial.precio_pesos, 4) : '')
      setAlicuotaIva(ventaInicial.alicuota_iva != null ? String(ventaInicial.alicuota_iva) : '21')
      setComisionNeto(ventaInicial.comision_neto ? fmtAR(ventaInicial.comision_neto) : '')
      setComisionAlicuota(ventaInicial.comision_alicuota != null ? String(ventaInicial.comision_alicuota) : '')
      setAlmacenajeNeto(ventaInicial.almacenaje_neto ? fmtAR(ventaInicial.almacenaje_neto) : '')
      setAlmacenajeAlicuota(ventaInicial.almacenaje_alicuota != null ? String(ventaInicial.almacenaje_alicuota) : '')
      setObservaciones(ventaInicial.observaciones || '')
    } else {
      // Reset para alta
      setCliente({ cuit: '', nombre: '' })
      setFechaOperacion(new Date().toISOString().slice(0, 10))
      setGrano(''); setGrado(''); setFactor('')
      setToneladas('')
      setModoPrecio('pesos')
      setPrecioUsd(''); setTc(''); setPrecioPesos('')
      setAlicuotaIva('21')
      setComisionNeto(''); setComisionAlicuota('')
      setAlmacenajeNeto(''); setAlmacenajeAlicuota('')
      setObservaciones('')
    }
  }, [open, ventaInicial])

  // ════════════════════════════════════════════════════════════
  // REACTIVIDAD DE PRECIO (Q1)
  // Cambio USD o TC → recalcula pesos.
  // Cambio pesos → recalcula USD manteniendo TC.
  // ════════════════════════════════════════════════════════════

  const onChangeUsd = (v: string) => {
    setPrecioUsd(v)
    const u = parsearAR(v), t = parsearAR(tc)
    if (t > 0 && u > 0) setPrecioPesos(fmtAR(u * t, 4))
  }
  const onChangeTc = (v: string) => {
    setTc(v)
    const u = parsearAR(precioUsd), t = parsearAR(v)
    if (t > 0 && u > 0) setPrecioPesos(fmtAR(u * t, 4))
  }
  const onChangePesos = (v: string) => {
    setPrecioPesos(v)
    const p = parsearAR(v), t = parsearAR(tc)
    if (t > 0 && p > 0) setPrecioUsd(fmtAR(p / t, 4))
  }

  // ════════════════════════════════════════════════════════════
  // CÁLCULOS DERIVADOS — preview vivo
  // ════════════════════════════════════════════════════════════

  const calc = useMemo(() => {
    const ton = parsearAR(toneladas)
    const pPesos = parsearAR(precioPesos)
    const aliq = parsearAR(alicuotaIva)
    const subtotal = ton * pPesos
    const iva = subtotal * aliq / 100
    const total = subtotal + iva

    const comNeto = parsearAR(comisionNeto)
    const comAliq = parsearAR(comisionAlicuota)
    const comIva = comNeto * comAliq / 100
    const comTotal = comNeto + comIva

    const almNeto = parsearAR(almacenajeNeto)
    const almAliq = parsearAR(almacenajeAlicuota)
    const almIva = almNeto * almAliq / 100
    const almTotal = almNeto + almIva

    const gravadoNeto = subtotal - comNeto - almNeto
    const ivaTotal = iva - comIva - almIva

    return { subtotal, iva, total, comIva, comTotal, almIva, almTotal, gravadoNeto, ivaTotal }
  }, [toneladas, precioPesos, alicuotaIva, comisionNeto, comisionAlicuota, almacenajeNeto, almacenajeAlicuota])

  const guardar = async () => {
    if (!cliente.cuit || !cliente.nombre) return toast.error('Falta seleccionar cliente')
    if (!fechaOperacion) return toast.error('Falta fecha de operación')
    if (parsearAR(toneladas) <= 0) return toast.error('Toneladas debe ser > 0')
    if (parsearAR(precioPesos) <= 0) return toast.error('Precio en pesos debe ser > 0')

    setGuardando(true)
    try {
      const payload = {
        cuit_cliente: cliente.cuit,
        denominacion_cliente: cliente.nombre,
        fecha_operacion: fechaOperacion,
        grano: grano || null,
        grado: grado || null,
        factor: factor ? parsearAR(factor) : null,
        toneladas: parsearAR(toneladas),
        modo_precio: modoPrecio,
        precio_usd: precioUsd ? parsearAR(precioUsd) : null,
        tc: tc ? parsearAR(tc) : null,
        precio_pesos: parsearAR(precioPesos),
        alicuota_iva: alicuotaIva ? parsearAR(alicuotaIva) : null,
        comision_neto: comisionNeto ? parsearAR(comisionNeto) : 0,
        comision_alicuota: comisionAlicuota ? parsearAR(comisionAlicuota) : null,
        almacenaje_neto: almacenajeNeto ? parsearAR(almacenajeNeto) : 0,
        almacenaje_alicuota: almacenajeAlicuota ? parsearAR(almacenajeAlicuota) : null,
        observaciones: observaciones || null,
      }

      if (esEdicion) {
        const { error } = await supabase
          .schema('msa')
          .from('ventas')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', ventaInicial!.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .schema('msa')
          .from('ventas')
          .insert(payload)
        if (error) throw error
      }

      // Asegurar es_cliente=true en proveedores
      await supabase
        .from('proveedores')
        .update({ es_cliente: true })
        .eq('cuit', cliente.cuit)
        .eq('es_cliente', false)

      toast.success(esEdicion ? 'Venta actualizada' : 'Venta registrada')
      onOpenChange(false)
      onGuardado?.()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar venta' : 'Nueva venta'}</DialogTitle>
          <DialogDescription>
            Datos de la operación. Los totales y deducciones se calculan automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          {/* Cliente y fecha */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <ProveedorCombobox
                label="Cliente"
                required
                value={{ cuit: cliente.cuit, nombre: cliente.nombre }}
                onChange={(sel) => setCliente({ cuit: sel.cuit, nombre: sel.nombre })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de operación *</Label>
              <Input type="date" value={fechaOperacion} onChange={e => setFechaOperacion(e.target.value)} />
            </div>
          </div>

          {/* Grano / grado / factor / toneladas */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Grano</Label>
              <Input placeholder="SOJA" value={grano} onChange={e => setGrano(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Grado</Label>
              <Input placeholder="G2" value={grado} onChange={e => setGrado(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Factor</Label>
              <Input type="text" placeholder="100" value={factor} onChange={e => setFactor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Toneladas *</Label>
              <Input type="text" placeholder="0,00" value={toneladas} onChange={e => setToneladas(e.target.value)} />
            </div>
          </div>

          {/* Precio */}
          <div className="border rounded-md p-3 space-y-3 bg-blue-50/30">
            <div className="flex items-center gap-4">
              <Label className="font-semibold">Modo precio *</Label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="modo-precio"
                  value="pesos"
                  checked={modoPrecio === 'pesos'}
                  onChange={() => setModoPrecio('pesos')}
                />
                Pesos directo
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="modo-precio"
                  value="usd"
                  checked={modoPrecio === 'usd'}
                  onChange={() => setModoPrecio('usd')}
                />
                USD × TC
              </label>
              <span className="text-xs text-gray-500 ml-auto">
                Cambiá USD/TC → recalcula pesos. Cambiá pesos → recalcula USD manteniendo TC.
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Precio USD / TN</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={precioUsd}
                  onChange={e => onChangeUsd(e.target.value)}
                  disabled={modoPrecio === 'pesos'}
                  className={modoPrecio === 'pesos' ? 'bg-gray-100' : ''}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de cambio</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={tc}
                  onChange={e => onChangeTc(e.target.value)}
                  disabled={modoPrecio === 'pesos'}
                  className={modoPrecio === 'pesos' ? 'bg-gray-100' : ''}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Precio Pesos / TN *</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={precioPesos}
                  onChange={e => onChangePesos(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* IVA */}
          <div className="grid grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Alícuota IVA (%) *</Label>
              <Input type="text" placeholder="10,5" value={alicuotaIva} onChange={e => setAlicuotaIva(e.target.value)} />
            </div>
            <div className="col-span-2 grid grid-cols-3 gap-2 text-sm bg-gray-50 rounded p-2">
              <div>Subtotal: <strong>{fmtMoney(calc.subtotal)}</strong></div>
              <div>IVA: <strong>{fmtMoney(calc.iva)}</strong></div>
              <div>Total op: <strong>{fmtMoney(calc.total)}</strong></div>
            </div>
          </div>

          {/* Comisión */}
          <div className="border rounded-md p-3 space-y-2">
            <Label className="font-semibold">Comisión (opcional)</Label>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Neto</Label>
                <Input type="text" placeholder="0,00" value={comisionNeto} onChange={e => setComisionNeto(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alícuota (%)</Label>
                <Input type="text" placeholder="10,5" value={comisionAlicuota} onChange={e => setComisionAlicuota(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IVA</Label>
                <Input type="text" value={fmtAR(calc.comIva)} disabled className="bg-gray-100" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total</Label>
                <Input type="text" value={fmtAR(calc.comTotal)} disabled className="bg-gray-100" />
              </div>
            </div>
          </div>

          {/* Almacenaje */}
          <div className="border rounded-md p-3 space-y-2">
            <Label className="font-semibold">Almacenaje (opcional)</Label>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Neto</Label>
                <Input type="text" placeholder="0,00" value={almacenajeNeto} onChange={e => setAlmacenajeNeto(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alícuota (%)</Label>
                <Input type="text" placeholder="10,5" value={almacenajeAlicuota} onChange={e => setAlmacenajeAlicuota(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IVA</Label>
                <Input type="text" value={fmtAR(calc.almIva)} disabled className="bg-gray-100" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total</Label>
                <Input type="text" value={fmtAR(calc.almTotal)} disabled className="bg-gray-100" />
              </div>
            </div>
          </div>

          {/* Totales finales */}
          <div className="bg-green-50 border border-green-300 rounded p-3 space-y-1 text-sm">
            <div className="font-semibold text-green-900 mb-1">Totales finales</div>
            <div className="grid grid-cols-2 gap-3">
              <div>Gravado Neto (= subtotal − comisión − almacén): <strong>{fmtMoney(calc.gravadoNeto)}</strong></div>
              <div>IVA Total (= iva − iva com. − iva alm.): <strong>{fmtMoney(calc.ivaTotal)}</strong></div>
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              placeholder="Notas sobre la operación..."
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando} className="bg-green-600 hover:bg-green-700">
            {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
