"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { CentroCostoCombobox } from "@/components/ui/centro-costo-combobox"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export interface ComprobanteVenta {
  id: string
  fecha_liquidacion: string | null   // re-uso de la columna como "fecha emisión"
  tipo_comprobante: number | null
  punto_venta: number | null
  numero_desde: number | null
  cuit_cliente: string | null
  denominacion_cliente: string | null
  imp_neto_gravado: number | null
  imp_neto_no_gravado: number | null
  imp_op_exentas: number | null
  alicuota_iva: number | null
  iva: number | null
  imp_total: number | null
  ddjj_iva: string | null
  año_contable: number | null
  mes_contable: number | null
  datos_adicionales: string | null
  cuenta_contable: string | null
  nro_cuenta: string | null
  centro_costo: string | null
}

interface TipoComp {
  codigo: number
  descripcion: string
  es_nota_credito: boolean
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  empresa: 'MSA' | 'MA'
  comprobanteInicial?: ComprobanteVenta | null
  onGuardado?: () => void
}

const parsearAR = (s: string): number => {
  if (!s) return 0
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0
}
const parsearStd = (s: string): number => {
  if (!s) return 0
  return parseFloat(String(s).replace(',', '.')) || 0
}
const fmtAR = (n: number, dec = 2) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const ALICUOTAS_IVA = ['0', '10.5', '21'] as const

export function ModalComprobanteVentaMsa({ open, onOpenChange, empresa, comprobanteInicial, onGuardado }: Props) {
  const esEdicion = !!comprobanteInicial?.id
  const schemaName = empresa === 'MA' ? 'ma' : 'msa'

  // Estados del form
  const [fechaEmision, setFechaEmision] = useState('')
  const [tipoComp, setTipoComp] = useState<string>('')      // codigo como string
  const [puntoVenta, setPuntoVenta] = useState('')
  const [numero, setNumero] = useState('')
  const [cliente, setCliente] = useState({ cuit: '', nombre: '' })
  const [netoGravado, setNetoGravado] = useState('')
  const [netoNoGravado, setNetoNoGravado] = useState('')
  const [opExentas, setOpExentas] = useState('')
  const [alicuotaIva, setAlicuotaIva] = useState('21')
  const [iva, setIva] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cuentaContable, setCuentaContable] = useState<string | null>(null)
  const [nroCuenta, setNroCuenta] = useState<string | null>(null)
  const [centroCosto, setCentroCosto] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Tipos de comprobante (cargar 1 vez)
  const [tipos, setTipos] = useState<TipoComp[]>([])

  useEffect(() => {
    const cargarTipos = async () => {
      const { data } = await supabase
        .from('tipos_comprobante_afip')
        .select('codigo, descripcion, es_nota_credito')
        .order('codigo')
      setTipos((data || []) as TipoComp[])
    }
    cargarTipos()
  }, [])

  // Carga inicial al abrir (alta o edición)
  useEffect(() => {
    if (!open) return
    if (comprobanteInicial) {
      const c = comprobanteInicial
      setFechaEmision(c.fecha_liquidacion || '')
      setTipoComp(c.tipo_comprobante != null ? String(c.tipo_comprobante) : '')
      setPuntoVenta(c.punto_venta != null ? String(c.punto_venta) : '')
      setNumero(c.numero_desde != null ? String(c.numero_desde) : '')
      setCliente({ cuit: c.cuit_cliente || '', nombre: c.denominacion_cliente || '' })
      // Mostrar siempre como positivos (la BD guarda con signo según es NC o no)
      setNetoGravado(c.imp_neto_gravado != null ? fmtAR(Math.abs(Number(c.imp_neto_gravado))) : '')
      setNetoNoGravado(c.imp_neto_no_gravado != null ? fmtAR(Math.abs(Number(c.imp_neto_no_gravado))) : '')
      setOpExentas(c.imp_op_exentas != null ? fmtAR(Math.abs(Number(c.imp_op_exentas))) : '')
      setAlicuotaIva(c.alicuota_iva != null ? String(c.alicuota_iva) : '21')
      setIva(c.iva != null ? fmtAR(Math.abs(Number(c.iva))) : '')
      setObservaciones(c.datos_adicionales || '')
      setCuentaContable(c.cuenta_contable || null)
      setNroCuenta(c.nro_cuenta || null)
      setCentroCosto(c.centro_costo || '')
    } else {
      setFechaEmision(new Date().toISOString().slice(0, 10))
      setTipoComp('')
      setPuntoVenta('')
      setNumero('')
      setCliente({ cuit: '', nombre: '' })
      setNetoGravado('')
      setNetoNoGravado('')
      setOpExentas('')
      setAlicuotaIva('21')
      setIva('')
      setObservaciones('')
      setCuentaContable(null)
      setNroCuenta(null)
      setCentroCosto('')
    }
  }, [open, comprobanteInicial])

  // Recalc IVA al cambiar alícuota o neto gravado
  useEffect(() => {
    const ng = parsearAR(netoGravado)
    const a = parsearStd(alicuotaIva)
    setIva(fmtAR(ng * a / 100))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netoGravado, alicuotaIva])

  // Datos del tipo seleccionado
  const tipoSel = useMemo(() => {
    const cod = parseInt(tipoComp)
    return tipos.find(t => t.codigo === cod) || null
  }, [tipoComp, tipos])

  // Cálculo Imp Total (siempre positivo en el preview; el signo se aplica al persistir)
  const impTotalCalc = useMemo(() => {
    const ng = parsearAR(netoGravado)
    const nng = parsearAR(netoNoGravado)
    const oe = parsearAR(opExentas)
    const i = parsearAR(iva)
    return ng + nng + oe + i
  }, [netoGravado, netoNoGravado, opExentas, iva])

  const guardar = async () => {
    if (!fechaEmision) return toast.error('Falta fecha de emisión')
    if (!tipoComp) return toast.error('Falta tipo de comprobante')
    if (!cliente.cuit || !cliente.nombre) return toast.error('Falta cliente')
    if (impTotalCalc <= 0) return toast.error('El importe total debe ser > 0')

    setGuardando(true)
    try {
      const esNC = tipoSel?.es_nota_credito || false
      const signo = esNC ? -1 : 1
      const ng = parsearAR(netoGravado) * signo
      const nng = parsearAR(netoNoGravado) * signo
      const oe = parsearAR(opExentas) * signo
      const i = parsearAR(iva) * signo
      const total = impTotalCalc * signo
      const [añoEm, mesEm] = fechaEmision.split('-').map(Number)

      const payload = {
        fecha_liquidacion: fechaEmision,       // reuso como fecha emisión
        tipo_comprobante: parseInt(tipoComp),
        punto_venta: puntoVenta ? parseInt(puntoVenta) : null,
        numero_desde: numero ? parseInt(numero) : null,
        cuit_cliente: cliente.cuit,
        denominacion_cliente: cliente.nombre,
        imp_neto_gravado: ng,
        imp_neto_no_gravado: nng,
        imp_op_exentas: oe,
        alicuota_iva: alicuotaIva ? parsearStd(alicuotaIva) : null,
        iva: i,
        imp_total: total,
        // Para que el subdiario no se confunda con el formato de liquidación,
        // ponemos también subtotal_neto = imp_neto_gravado (FC sin deducciones)
        subtotal_neto: ng,
        datos_adicionales: observaciones || null,
        año_contable: añoEm || null,
        mes_contable: mesEm || null,
        cuenta_contable: cuentaContable || null,
        nro_cuenta: nroCuenta || null,
        centro_costo: centroCosto || null,
      }

      if (esEdicion) {
        const { error } = await supabase
          .schema(schemaName)
          .from('comprobantes_venta')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', comprobanteInicial!.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .schema(schemaName)
          .from('comprobantes_venta')
          .insert(payload)
        if (error) throw error
      }

      // Marcar es_cliente=true en proveedores
      await supabase
        .from('proveedores')
        .update({ es_cliente: true })
        .eq('cuit', cliente.cuit)
        .eq('es_cliente', false)

      toast.success(esEdicion ? 'Comprobante actualizado' : 'Comprobante registrado')
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
          <DialogTitle>{esEdicion ? 'Editar comprobante de venta' : 'Nuevo comprobante de venta'} ({empresa})</DialogTitle>
          <DialogDescription>
            Para FC, NC, ND y otros comprobantes de venta normales. Para liquidaciones primarias de granos usá el módulo "Liquidaciones".
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-1">

          {/* 1. Identificación */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="font-semibold text-sm">Identificación</div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha emisión *</Label>
                <Input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Tipo de comprobante *</Label>
                <select
                  className="w-full border rounded h-9 px-2 text-sm"
                  value={tipoComp}
                  onChange={e => setTipoComp(e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  {tipos.map(t => (
                    <option key={t.codigo} value={String(t.codigo)}>
                      {String(t.codigo).padStart(3, '0')} — {t.descripcion}{t.es_nota_credito ? ' (NC)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pto Venta</Label>
                <Input type="number" value={puntoVenta} onChange={e => setPuntoVenta(e.target.value)} placeholder="1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Número</Label>
                <Input type="number" value={numero} onChange={e => setNumero(e.target.value)} placeholder="0" />
              </div>
              <div className="col-span-3" />
            </div>
          </div>

          {/* 2. Cliente */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="font-semibold text-sm">Cliente</div>
            <ProveedorCombobox
              label="Cliente"
              required
              value={{ cuit: cliente.cuit, nombre: cliente.nombre }}
              onChange={(sel) => setCliente({ cuit: sel.cuit, nombre: sel.nombre })}
            />
          </div>

          {/* 3. Importes */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="font-semibold text-sm">Importes</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Neto Gravado</Label>
                <Input value={netoGravado} onChange={e => setNetoGravado(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Neto No Gravado</Label>
                <Input value={netoNoGravado} onChange={e => setNetoNoGravado(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Op. Exentas</Label>
                <Input value={opExentas} onChange={e => setOpExentas(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alícuota IVA</Label>
                <select className="w-full border rounded h-9 px-2 text-sm"
                  value={alicuotaIva} onChange={e => setAlicuotaIva(e.target.value)}>
                  {ALICUOTAS_IVA.map(a => <option key={a} value={a}>{a.replace('.', ',')}%</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IVA (editable)</Label>
                <Input value={iva} onChange={e => setIva(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Imp. Total</Label>
                <div className="h-9 px-2 flex items-center bg-gray-100 border rounded text-sm font-medium">
                  ${fmtAR(impTotalCalc)}
                </div>
              </div>
            </div>
            {tipoSel?.es_nota_credito && impTotalCalc > 0 && (
              <div className="bg-orange-50 border border-orange-300 rounded p-2 text-xs text-orange-900">
                ⚠️ Es una <strong>Nota de Crédito</strong> ({tipoSel.descripcion}). Los importes se guardan en <strong>negativo</strong> en BD.
              </div>
            )}
          </div>

          {/* 4. Imputación contable */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="font-semibold text-sm">Imputación contable</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cuenta contable</Label>
                <SelectorCuentaContable
                  value={cuentaContable}
                  onSelect={(cta) => {
                    setCuentaContable(cta?.categ || null)
                    setNroCuenta(cta?.nro_cuenta || null)
                  }}
                  cuitProveedor={cliente.cuit || null}
                  mostrarSinAsignar={true}
                  placeholder="Sin cuenta — clic para asignar"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Centro de costo</Label>
                <CentroCostoCombobox
                  value={centroCosto}
                  onValueChange={setCentroCosto}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* 5. Observaciones */}
          <div className="space-y-2">
            <Label className="text-xs">Observaciones</Label>
            <Textarea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)}
              placeholder="Notas opcionales..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando} className="bg-blue-600 hover:bg-blue-700">
            {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar comprobante'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
