"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { normalizarBusqueda } from "@/lib/normalizar-texto"

export interface LiquidacionMsa {
  id: string
  fecha_liquidacion: string | null
  nro_comprobante: string | null
  coe: string | null
  tipo_operacion: string | null
  actividad: string | null
  total_operacion: number | null
  total_percepciones: number | null
  total_retenciones_afip: number | null
  total_otras_retenciones: number | null
  total_deducciones: number | null
  ret_iva: number | null
  ret_iibb: number | null
  importe_neto_a_pagar: number | null
  iva_rg_2300: number | null
  pago_segun_condiciones: number | null
  fecha_acreditacion: string | null
  puerto: string | null
  procedencia: string | null
  cosecha: string | null
  peso_kg: number | null
  datos_adicionales: string | null
}

interface VentaResumen {
  id: string
  fecha_operacion: string
  cuit_cliente: string
  denominacion_cliente: string
  grano: string | null
  toneladas: number | null
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  liquidacionInicial?: LiquidacionMsa | null
  onGuardado?: () => void
}

const parsearAR = (s: string): number => {
  if (!s) return 0
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0
}
const fmtAR = (n: number, dec = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

export function ModalLiquidacionMsa({ open, onOpenChange, liquidacionInicial, onGuardado }: Props) {
  const esEdicion = !!liquidacionInicial?.id

  const [fechaLiq, setFechaLiq] = useState('')
  const [nroComp, setNroComp] = useState('')
  const [coe, setCoe] = useState('')
  const [tipoOperacion, setTipoOperacion] = useState('')
  const [actividad, setActividad] = useState('')

  const [totalOp, setTotalOp] = useState('')
  const [totalPercep, setTotalPercep] = useState('')
  const [totalRetAfip, setTotalRetAfip] = useState('')
  const [totalOtrasRet, setTotalOtrasRet] = useState('')
  const [totalDeducciones, setTotalDeducciones] = useState('')
  const [retIva, setRetIva] = useState('')
  const [retIibb, setRetIibb] = useState('')
  const [importeNeto, setImporteNeto] = useState('')
  const [ivaRg2300, setIvaRg2300] = useState('')
  const [pagoCond, setPagoCond] = useState('')

  const [fechaAcred, setFechaAcred] = useState('')
  const [puerto, setPuerto] = useState('')
  const [procedencia, setProcedencia] = useState('')
  const [cosecha, setCosecha] = useState('')
  const [pesoKg, setPesoKg] = useState('')
  const [datosAdic, setDatosAdic] = useState('')

  // Ventas a vincular
  const [ventas, setVentas] = useState<VentaResumen[]>([])
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [busquedaVenta, setBusquedaVenta] = useState('')

  const [guardando, setGuardando] = useState(false)

  // Cargar lista de ventas + datos iniciales cada vez que se abre
  useEffect(() => {
    if (!open) return

    const cargar = async () => {
      const { data: vData } = await supabase
        .schema('msa')
        .from('ventas')
        .select('id, fecha_operacion, cuit_cliente, denominacion_cliente, grano, toneladas')
        .order('fecha_operacion', { ascending: false })
      setVentas((vData || []) as VentaResumen[])

      if (esEdicion && liquidacionInicial) {
        // Cargar vínculos existentes
        const { data: pData } = await supabase
          .schema('msa')
          .from('ventas_liquidaciones')
          .select('venta_id')
          .eq('liquidacion_id', liquidacionInicial.id)
        setSeleccionadas(new Set((pData || []).map((p: any) => p.venta_id)))

        const l = liquidacionInicial
        setFechaLiq(l.fecha_liquidacion || '')
        setNroComp(l.nro_comprobante || '')
        setCoe(l.coe || '')
        setTipoOperacion(l.tipo_operacion || '')
        setActividad(l.actividad || '')
        setTotalOp(l.total_operacion != null ? fmtAR(Number(l.total_operacion)) : '')
        setTotalPercep(l.total_percepciones != null ? fmtAR(Number(l.total_percepciones)) : '')
        setTotalRetAfip(l.total_retenciones_afip != null ? fmtAR(Number(l.total_retenciones_afip)) : '')
        setTotalOtrasRet(l.total_otras_retenciones != null ? fmtAR(Number(l.total_otras_retenciones)) : '')
        setTotalDeducciones(l.total_deducciones != null ? fmtAR(Number(l.total_deducciones)) : '')
        setRetIva(l.ret_iva != null ? fmtAR(Number(l.ret_iva)) : '')
        setRetIibb(l.ret_iibb != null ? fmtAR(Number(l.ret_iibb)) : '')
        setImporteNeto(l.importe_neto_a_pagar != null ? fmtAR(Number(l.importe_neto_a_pagar)) : '')
        setIvaRg2300(l.iva_rg_2300 != null ? fmtAR(Number(l.iva_rg_2300)) : '')
        setPagoCond(l.pago_segun_condiciones != null ? fmtAR(Number(l.pago_segun_condiciones)) : '')
        setFechaAcred(l.fecha_acreditacion || '')
        setPuerto(l.puerto || '')
        setProcedencia(l.procedencia || '')
        setCosecha(l.cosecha || '')
        setPesoKg(l.peso_kg != null ? fmtAR(Number(l.peso_kg)) : '')
        setDatosAdic(l.datos_adicionales || '')
      } else {
        // Alta — reset
        setSeleccionadas(new Set())
        setFechaLiq(new Date().toISOString().slice(0, 10))
        setNroComp(''); setCoe(''); setTipoOperacion(''); setActividad('')
        setTotalOp(''); setTotalPercep(''); setTotalRetAfip(''); setTotalOtrasRet('')
        setTotalDeducciones(''); setRetIva(''); setRetIibb('')
        setImporteNeto(''); setIvaRg2300(''); setPagoCond('')
        setFechaAcred(''); setPuerto(''); setProcedencia(''); setCosecha(''); setPesoKg(''); setDatosAdic('')
      }
      setBusquedaVenta('')
    }
    cargar()
  }, [open, esEdicion, liquidacionInicial])

  const ventasFiltradas = busquedaVenta.trim()
    ? ventas.filter(v => {
        const q = normalizarBusqueda(busquedaVenta)
        return normalizarBusqueda(v.denominacion_cliente).includes(q)
          || v.cuit_cliente?.includes(q)
          || normalizarBusqueda(v.grano || '').includes(q)
      })
    : ventas

  const toggleVenta = (id: string) => {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const guardar = async () => {
    if (!fechaLiq) return toast.error('Falta fecha de liquidación')
    if (seleccionadas.size === 0) {
      if (!window.confirm('No vinculaste ninguna venta. ¿Querés guardar la liquidación igual?')) return
    }
    setGuardando(true)
    try {
      const payload = {
        fecha_liquidacion: fechaLiq,
        nro_comprobante: nroComp || null,
        coe: coe || null,
        tipo_operacion: tipoOperacion || null,
        actividad: actividad || null,
        total_operacion: totalOp ? parsearAR(totalOp) : null,
        total_percepciones: totalPercep ? parsearAR(totalPercep) : 0,
        total_retenciones_afip: totalRetAfip ? parsearAR(totalRetAfip) : 0,
        total_otras_retenciones: totalOtrasRet ? parsearAR(totalOtrasRet) : 0,
        total_deducciones: totalDeducciones ? parsearAR(totalDeducciones) : 0,
        ret_iva: retIva ? parsearAR(retIva) : 0,
        ret_iibb: retIibb ? parsearAR(retIibb) : 0,
        importe_neto_a_pagar: importeNeto ? parsearAR(importeNeto) : null,
        iva_rg_2300: ivaRg2300 ? parsearAR(ivaRg2300) : null,
        pago_segun_condiciones: pagoCond ? parsearAR(pagoCond) : null,
        fecha_acreditacion: fechaAcred || null,
        puerto: puerto || null,
        procedencia: procedencia || null,
        cosecha: cosecha || null,
        peso_kg: pesoKg ? parsearAR(pesoKg) : null,
        datos_adicionales: datosAdic || null,
      }

      let liqId = liquidacionInicial?.id
      if (esEdicion) {
        const { error } = await supabase
          .schema('msa')
          .from('liquidaciones_venta')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', liqId!)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .schema('msa')
          .from('liquidaciones_venta')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        liqId = data.id
      }

      // Reemplazar vínculos en pivot: borrar los actuales e insertar los seleccionados
      await supabase
        .schema('msa')
        .from('ventas_liquidaciones')
        .delete()
        .eq('liquidacion_id', liqId!)

      if (seleccionadas.size > 0) {
        const rows = Array.from(seleccionadas).map(venta_id => ({ venta_id, liquidacion_id: liqId! }))
        const { error: errPivot } = await supabase
          .schema('msa')
          .from('ventas_liquidaciones')
          .insert(rows)
        if (errPivot) throw errPivot
      }

      toast.success(esEdicion ? 'Liquidación actualizada' : 'Liquidación registrada')
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
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar liquidación' : 'Nueva liquidación'}</DialogTitle>
          <DialogDescription>
            Cargá los datos de la liquidación AFIP y vinculala a una o varias ventas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          {/* Identificación */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="font-semibold text-sm">Identificación</div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha liquidación *</Label>
                <Input type="date" value={fechaLiq} onChange={e => setFechaLiq(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº Comprobante</Label>
                <Input value={nroComp} onChange={e => setNroComp(e.target.value)} placeholder="332020133474" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">COE</Label>
                <Input value={coe} onChange={e => setCoe(e.target.value)} placeholder="330228588180" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha acreditación</Label>
                <Input type="date" value={fechaAcred} onChange={e => setFechaAcred(e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Tipo de operación</Label>
                <Input value={tipoOperacion} onChange={e => setTipoOperacion(e.target.value)} placeholder="2 - Consignación de granos" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Actividad</Label>
                <Input value={actividad} onChange={e => setActividad(e.target.value)} placeholder="ACOPIADOR - CONSIGNATARIO" />
              </div>
            </div>
          </div>

          {/* Importes principales */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="font-semibold text-sm">Importes</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Total operación</Label>
                <Input value={totalOp} onChange={e => setTotalOp(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total percepciones</Label>
                <Input value={totalPercep} onChange={e => setTotalPercep(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total deducciones</Label>
                <Input value={totalDeducciones} onChange={e => setTotalDeducciones(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Retenciones AFIP</Label>
                <Input value={totalRetAfip} onChange={e => setTotalRetAfip(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Otras retenciones</Label>
                <Input value={totalOtrasRet} onChange={e => setTotalOtrasRet(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ret. IVA</Label>
                <Input value={retIva} onChange={e => setRetIva(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ret. IIBB</Label>
                <Input value={retIibb} onChange={e => setRetIibb(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Importe neto a pagar</Label>
                <Input value={importeNeto} onChange={e => setImporteNeto(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IVA RG 2300/2007</Label>
                <Input value={ivaRg2300} onChange={e => setIvaRg2300(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1 col-span-3">
                <Label className="text-xs">Pago según condiciones</Label>
                <Input value={pagoCond} onChange={e => setPagoCond(e.target.value)} placeholder="0,00" />
              </div>
            </div>
          </div>

          {/* Metadata operativa */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="font-semibold text-sm">Metadata (opcional)</div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Puerto</Label>
                <Input value={puerto} onChange={e => setPuerto(e.target.value)} placeholder="ROSARIO" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Procedencia</Label>
                <Input value={procedencia} onChange={e => setProcedencia(e.target.value)} placeholder="SAN PEDRO" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cosecha</Label>
                <Input value={cosecha} onChange={e => setCosecha(e.target.value)} placeholder="25" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Peso (kg)</Label>
                <Input value={pesoKg} onChange={e => setPesoKg(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1 col-span-4">
                <Label className="text-xs">Datos adicionales</Label>
                <Textarea rows={2} value={datosAdic} onChange={e => setDatosAdic(e.target.value)}
                  placeholder="Acreditación 11/06/2025 - CCP ARRECIFES - Cosecha 25" />
              </div>
            </div>
          </div>

          {/* Vincular ventas */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-sm">Ventas vinculadas</div>
              <span className="text-xs text-gray-500">
                Seleccionadas: {seleccionadas.size}
              </span>
            </div>
            <Input
              placeholder="Buscar venta por cliente, CUIT, grano..."
              value={busquedaVenta}
              onChange={e => setBusquedaVenta(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="border rounded max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 w-8"></th>
                    <th className="px-2 py-1 text-left">Fecha</th>
                    <th className="px-2 py-1 text-left">Cliente</th>
                    <th className="px-2 py-1 text-left">Grano</th>
                    <th className="px-2 py-1 text-right">Ton</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasFiltradas.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-3 text-gray-400">No hay ventas.</td></tr>
                  ) : ventasFiltradas.map(v => {
                    const checked = seleccionadas.has(v.id)
                    return (
                      <tr key={v.id} className={`border-t cursor-pointer ${checked ? 'bg-green-50' : 'hover:bg-gray-50'}`} onClick={() => toggleVenta(v.id)}>
                        <td className="px-2 py-1 text-center">
                          <Checkbox checked={checked} onCheckedChange={() => toggleVenta(v.id)} />
                        </td>
                        <td className="px-2 py-1">{v.fecha_operacion}</td>
                        <td className="px-2 py-1">{v.denominacion_cliente}</td>
                        <td className="px-2 py-1">{v.grano || '—'}</td>
                        <td className="px-2 py-1 text-right">{v.toneladas != null ? fmtAR(Number(v.toneladas), 2) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando} className="bg-blue-600 hover:bg-blue-700">
            {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar liquidación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
