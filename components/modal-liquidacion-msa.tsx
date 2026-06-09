"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { normalizarBusqueda } from "@/lib/normalizar-texto"

export interface LiquidacionMsa {
  id: string
  // Identificación
  fecha_liquidacion: string | null
  nro_comprobante: string | null
  coe: string | null
  tipo_operacion: string | null
  actividad: string | null
  // Cliente / comprador
  cuit_cliente: string | null
  denominacion_cliente: string | null
  // Operación física
  grano: string | null
  grado: string | null
  factor: number | null
  toneladas: number | null
  // Precio (lleno + final)
  modo_precio: 'usd' | 'pesos' | null
  precio_usd: number | null
  tc: number | null
  precio_pesos: number | null
  precio_final_pesos: number | null
  // Importes operación (persistidos)
  subtotal_neto: number | null
  alicuota_iva: number | null
  iva: number | null
  // Deducciones
  comision_neto: number | null
  comision_alicuota_iva: number | null
  comision_iva: number | null
  almacenaje_neto: number | null
  almacenaje_alicuota_iva: number | null
  almacenaje_iva: number | null
  // Retenciones (inputs)
  ret_iva: number | null
  ret_iibb: number | null
  // Metadata
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

// ─── Helpers de formato ───────────────────────────────────────────
// Para INPUTS del usuario en formato es-AR (punto miles, coma decimal)
const parsearAR = (s: string): number => {
  if (!s) return 0
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0
}
// Para valores con FORMATO STANDARD (punto decimal, sin miles) — alícuotas del código
const parsearStd = (s: string): number => {
  if (!s) return 0
  return parseFloat(String(s).replace(',', '.')) || 0
}
const fmtAR = (n: number, dec = 2) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtMoney = (n: number) => `$${fmtAR(n)}`

// Alícuotas IVA permitidas (decisión usuario: solo 0 / 10.5 / 21)
const ALICUOTAS_IVA = ['0', '10.5', '21'] as const

export function ModalLiquidacionMsa({ open, onOpenChange, liquidacionInicial, onGuardado }: Props) {
  const esEdicion = !!liquidacionInicial?.id

  // ─── Identificación ────────────────────────────────────────────
  const [fechaLiq, setFechaLiq] = useState('')
  const [nroComp, setNroComp] = useState('')
  const [coe, setCoe] = useState('')
  const [tipoOperacion, setTipoOperacion] = useState('')
  const [actividad, setActividad] = useState('')

  // ─── Cliente ──────────────────────────────────────────────────
  const [cliente, setCliente] = useState({ cuit: '', nombre: '' })

  // ─── Operación física ──────────────────────────────────────────
  const [grano, setGrano] = useState('')
  const [grado, setGrado] = useState('')
  const [factor, setFactor] = useState('')
  const [toneladas, setToneladas] = useState('')

  // ─── Precio lleno (USD + TC + Pesos con reactividad) ──────────
  const [modoPrecio, setModoPrecio] = useState<'usd' | 'pesos'>('pesos')
  const [precioUsd, setPrecioUsd] = useState('')
  const [tc, setTc] = useState('')
  const [precioPesos, setPrecioPesos] = useState('')

  // ─── Precio final + subtotal (con reactividad cruzada) ────────
  const [precioFinal, setPrecioFinal] = useState('')
  const [subtotal, setSubtotal] = useState('')

  // ─── IVA venta ────────────────────────────────────────────────
  const [alicuotaIva, setAlicuotaIva] = useState('10.5')
  const [iva, setIva] = useState('')

  // ─── Comisión (doble vía: monto ↔ %) ──────────────────────────
  const [comisionNeto, setComisionNeto] = useState('')
  const [comisionPct, setComisionPct] = useState('')
  const [comisionAlicIva, setComisionAlicIva] = useState('10.5')
  const [comisionIva, setComisionIva] = useState('')

  // ─── Almacenaje (mismo formato) ──────────────────────────────
  const [almacenajeNeto, setAlmacenajeNeto] = useState('')
  const [almacenajePct, setAlmacenajePct] = useState('')
  const [almacenajeAlicIva, setAlmacenajeAlicIva] = useState('10.5')
  const [almacenajeIva, setAlmacenajeIva] = useState('')

  // ─── Retenciones (inputs) ─────────────────────────────────────
  const [retIva, setRetIva] = useState('')
  const [retIibb, setRetIibb] = useState('')

  // ─── Metadata ────────────────────────────────────────────────
  const [fechaAcred, setFechaAcred] = useState('')
  const [puerto, setPuerto] = useState('')
  const [procedencia, setProcedencia] = useState('')
  const [cosecha, setCosecha] = useState('')
  const [pesoKg, setPesoKg] = useState('')
  const [datosAdic, setDatosAdic] = useState('')

  // ─── Vinculación con ventas ──────────────────────────────────
  const [ventas, setVentas] = useState<VentaResumen[]>([])
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [busquedaVenta, setBusquedaVenta] = useState('')

  const [guardando, setGuardando] = useState(false)

  // ════════════════════════════════════════════════════════════
  // CARGA INICIAL al abrir (alta o edición)
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!open) return

    const cargar = async () => {
      // Ventas disponibles para vincular
      const { data: vData } = await supabase
        .schema('msa')
        .from('ventas')
        .select('id, fecha_operacion, cuit_cliente, denominacion_cliente, grano, toneladas')
        .order('fecha_operacion', { ascending: false })
      setVentas((vData || []) as VentaResumen[])

      if (esEdicion && liquidacionInicial) {
        // Vínculos existentes
        const { data: pData } = await supabase
          .schema('msa')
          .from('ventas_comprobantes')
          .select('venta_id')
          .eq('comprobante_id', liquidacionInicial.id)
        setSeleccionadas(new Set((pData || []).map((p: any) => p.venta_id)))

        const l = liquidacionInicial
        setFechaLiq(l.fecha_liquidacion || '')
        setNroComp(l.nro_comprobante || '')
        setCoe(l.coe || '')
        setTipoOperacion(l.tipo_operacion || '')
        setActividad(l.actividad || '')
        setCliente({ cuit: l.cuit_cliente || '', nombre: l.denominacion_cliente || '' })
        setGrano(l.grano || '')
        setGrado(l.grado || '')
        setFactor(l.factor != null ? String(l.factor) : '')
        setToneladas(l.toneladas != null ? fmtAR(Number(l.toneladas), 4) : '')
        setModoPrecio((l.modo_precio as 'usd' | 'pesos') || 'pesos')
        setPrecioUsd(l.precio_usd != null ? fmtAR(Number(l.precio_usd), 4) : '')
        setTc(l.tc != null ? fmtAR(Number(l.tc), 4) : '')
        setPrecioPesos(l.precio_pesos != null ? fmtAR(Number(l.precio_pesos), 4) : '')
        setPrecioFinal(l.precio_final_pesos != null ? fmtAR(Number(l.precio_final_pesos), 4) : '')
        setSubtotal(l.subtotal_neto != null ? fmtAR(Number(l.subtotal_neto)) : '')
        setAlicuotaIva(l.alicuota_iva != null ? String(l.alicuota_iva) : '10.5')
        setIva(l.iva != null ? fmtAR(Number(l.iva)) : '')
        setComisionNeto(l.comision_neto ? fmtAR(Number(l.comision_neto)) : '')
        setComisionAlicIva(l.comision_alicuota_iva != null ? String(l.comision_alicuota_iva) : '10.5')
        setComisionIva(l.comision_iva ? fmtAR(Number(l.comision_iva)) : '')
        setAlmacenajeNeto(l.almacenaje_neto ? fmtAR(Number(l.almacenaje_neto)) : '')
        setAlmacenajeAlicIva(l.almacenaje_alicuota_iva != null ? String(l.almacenaje_alicuota_iva) : '10.5')
        setAlmacenajeIva(l.almacenaje_iva ? fmtAR(Number(l.almacenaje_iva)) : '')
        setRetIva(l.ret_iva ? fmtAR(Number(l.ret_iva)) : '')
        setRetIibb(l.ret_iibb ? fmtAR(Number(l.ret_iibb)) : '')
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
        setCliente({ cuit: '', nombre: '' })
        setGrano(''); setGrado(''); setFactor(''); setToneladas('')
        setModoPrecio('pesos')
        setPrecioUsd(''); setTc(''); setPrecioPesos('')
        setPrecioFinal(''); setSubtotal('')
        setAlicuotaIva('10.5'); setIva('')
        setComisionNeto(''); setComisionPct(''); setComisionAlicIva('10.5'); setComisionIva('')
        setAlmacenajeNeto(''); setAlmacenajePct(''); setAlmacenajeAlicIva('10.5'); setAlmacenajeIva('')
        setRetIva(''); setRetIibb('')
        setFechaAcred(''); setPuerto(''); setProcedencia(''); setCosecha(''); setPesoKg(''); setDatosAdic('')
      }
      setBusquedaVenta('')
    }
    cargar()
  }, [open, esEdicion, liquidacionInicial])

  // ════════════════════════════════════════════════════════════
  // REACTIVIDAD DE PRECIO LLENO (USD / TC / Pesos)
  // Cambio USD o TC → recalcula pesos.
  // Cambio pesos → recalcula USD manteniendo TC.
  // Si precio_final está vacío, también se propaga el precio_pesos a precio_final.
  // ════════════════════════════════════════════════════════════

  const onChangeUsd = (v: string) => {
    setPrecioUsd(v)
    const u = parsearAR(v), t = parsearAR(tc)
    if (t > 0 && u > 0) {
      const pPesos = u * t
      setPrecioPesos(fmtAR(pPesos, 4))
      // Propaga a precio_final SOLO si está vacío (no piso un override manual)
      if (!precioFinal) propagarPrecioYRecalcSubtotal(pPesos)
    }
  }
  const onChangeTc = (v: string) => {
    setTc(v)
    const u = parsearAR(precioUsd), t = parsearAR(v)
    if (t > 0 && u > 0) {
      const pPesos = u * t
      setPrecioPesos(fmtAR(pPesos, 4))
      if (!precioFinal) propagarPrecioYRecalcSubtotal(pPesos)
    }
  }
  const onChangePesos = (v: string) => {
    setPrecioPesos(v)
    const p = parsearAR(v), t = parsearAR(tc)
    if (t > 0 && p > 0) setPrecioUsd(fmtAR(p / t, 4))
    if (!precioFinal) propagarPrecioYRecalcSubtotal(p)
  }

  // Helper: tomar un precio pesos y recalcular el subtotal con la ton actual.
  // No setea precio_final (mantiene la "regla" de que precio_final es input opcional).
  const propagarPrecioYRecalcSubtotal = (pPesos: number) => {
    const ton = parsearAR(toneladas)
    if (ton > 0 && pPesos > 0) {
      setSubtotal(fmtAR(ton * pPesos, 2))
    }
  }

  // ════════════════════════════════════════════════════════════
  // REACTIVIDAD ton ↔ precio_final ↔ subtotal
  // - Cambio ton → recalcula subtotal = ton × precio_efectivo
  // - Cambio precio_final → recalcula subtotal = ton × precio_final. No toca precio_lleno.
  // - Cambio subtotal → recalcula precio_final = subtotal / ton. No toca precio_lleno.
  // precio_efectivo = precio_final si tiene valor, sino precio_pesos (lleno).
  // ════════════════════════════════════════════════════════════

  const precioEfectivo = (): number => {
    const pf = parsearAR(precioFinal)
    if (pf > 0) return pf
    return parsearAR(precioPesos)
  }

  const onChangeTon = (v: string) => {
    setToneladas(v)
    const ton = parsearAR(v)
    const pEf = precioEfectivo()
    if (ton > 0 && pEf > 0) setSubtotal(fmtAR(ton * pEf, 2))
  }

  const onChangePrecioFinal = (v: string) => {
    setPrecioFinal(v)
    const ton = parsearAR(toneladas)
    const pf = parsearAR(v)
    if (ton > 0 && pf > 0) setSubtotal(fmtAR(ton * pf, 2))
  }

  const onChangeSubtotal = (v: string) => {
    setSubtotal(v)
    const sub = parsearAR(v)
    const ton = parsearAR(toneladas)
    if (ton > 0 && sub > 0) setPrecioFinal(fmtAR(sub / ton, 4))
  }

  // ════════════════════════════════════════════════════════════
  // IVA venta: cambiar alicuota o subtotal → recalcula iva
  // (editable manualmente como override)
  // ════════════════════════════════════════════════════════════

  const recalcIvaVenta = (subStr = subtotal, alicStr = alicuotaIva) => {
    const sub = parsearAR(subStr), alic = parsearStd(alicStr)
    setIva(fmtAR(sub * alic / 100, 2))
  }

  // Recalcular IVA cuando cambia subtotal o alícuota (auto-update)
  useEffect(() => {
    recalcIvaVenta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, alicuotaIva])

  // ════════════════════════════════════════════════════════════
  // COMISIÓN: doble vía monto ↔ % sobre subtotal
  // + alícuota IVA → recalcula comision_iva
  // ════════════════════════════════════════════════════════════

  const onChangeComisionNeto = (v: string) => {
    setComisionNeto(v)
    const m = parsearAR(v), sub = parsearAR(subtotal)
    if (sub > 0 && m > 0) setComisionPct(fmtAR(m / sub * 100, 4))
    else setComisionPct('')
  }
  const onChangeComisionPct = (v: string) => {
    setComisionPct(v)
    const p = parsearAR(v), sub = parsearAR(subtotal)
    if (sub > 0 && p > 0) setComisionNeto(fmtAR(sub * p / 100, 2))
    else setComisionNeto('')
  }
  // Recalcular comision_iva cuando cambia neto o alic
  useEffect(() => {
    const m = parsearAR(comisionNeto), a = parsearStd(comisionAlicIva)
    setComisionIva(fmtAR(m * a / 100, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comisionNeto, comisionAlicIva])

  // ════════════════════════════════════════════════════════════
  // ALMACENAJE: misma estructura que comisión
  // ════════════════════════════════════════════════════════════

  const onChangeAlmacenajeNeto = (v: string) => {
    setAlmacenajeNeto(v)
    const m = parsearAR(v), sub = parsearAR(subtotal)
    if (sub > 0 && m > 0) setAlmacenajePct(fmtAR(m / sub * 100, 4))
    else setAlmacenajePct('')
  }
  const onChangeAlmacenajePct = (v: string) => {
    setAlmacenajePct(v)
    const p = parsearAR(v), sub = parsearAR(subtotal)
    if (sub > 0 && p > 0) setAlmacenajeNeto(fmtAR(sub * p / 100, 2))
    else setAlmacenajeNeto('')
  }
  useEffect(() => {
    const m = parsearAR(almacenajeNeto), a = parsearStd(almacenajeAlicIva)
    setAlmacenajeIva(fmtAR(m * a / 100, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacenajeNeto, almacenajeAlicIva])

  // ════════════════════════════════════════════════════════════
  // CÁLCULOS DERIVADOS (read-only)
  // ════════════════════════════════════════════════════════════

  const calc = useMemo(() => {
    const sub = parsearAR(subtotal)
    const ivaV = parsearAR(iva)
    const totalOp = sub + ivaV
    const comNeto = parsearAR(comisionNeto)
    const comIva = parsearAR(comisionIva)
    const almNeto = parsearAR(almacenajeNeto)
    const almIva = parsearAR(almacenajeIva)
    const gravadoNeto = sub - comNeto - almNeto
    const ivaTotal = ivaV - comIva - almIva
    const totalDeducciones = comNeto + comIva + almNeto + almIva
    const totalOpMenosDed = totalOp - totalDeducciones
    const ri = parsearAR(retIva)
    const rii = parsearAR(retIibb)
    const importeNeto = totalOpMenosDed - ri - rii
    const ivaRg2300 = ivaTotal - ri
    const pagoCond = importeNeto - ivaRg2300
    return { totalOp, gravadoNeto, ivaTotal, totalDeducciones, totalOpMenosDed, importeNeto, ivaRg2300, pagoCond }
  }, [subtotal, iva, comisionNeto, comisionIva, almacenajeNeto, almacenajeIva, retIva, retIibb])

  // ════════════════════════════════════════════════════════════
  // FILTRO DE VENTAS PARA VINCULAR
  // ════════════════════════════════════════════════════════════

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

  // ════════════════════════════════════════════════════════════
  // GUARDAR
  // ════════════════════════════════════════════════════════════

  const guardar = async () => {
    if (!fechaLiq) return toast.error('Falta fecha de liquidación')
    if (!cliente.cuit || !cliente.nombre) return toast.error('Falta seleccionar comprador')
    if (parsearAR(subtotal) <= 0) return toast.error('Subtotal debe ser > 0')
    if (seleccionadas.size === 0) {
      if (!window.confirm('No vinculaste ninguna venta. ¿Querés guardar la liquidación igual?')) return
    }
    setGuardando(true)
    try {
      // Derivados neteados para el Libro IVA Ventas (decisión usuario T6):
      // Neto Gravado del Libro = subtotal − comisión − almacenaje
      // IVA del Libro          = iva venta − iva comisión − iva almacenaje
      // Total del Libro        = Neto Gravado + IVA
      const subN = parsearAR(subtotal)
      const ivaN = parsearAR(iva)
      const comN = parsearAR(comisionNeto)
      const comI = parsearAR(comisionIva)
      const almN = parsearAR(almacenajeNeto)
      const almI = parsearAR(almacenajeIva)
      const ivaGravadoLibro = subN - comN - almN
      const ivaLibro = ivaN - comI - almI
      const totalLibro = ivaGravadoLibro + ivaLibro
      // Período contable derivado de fecha_liquidacion
      const [añoLiq, mesLiq] = fechaLiq.split('-').map(Number)

      const payload = {
        fecha_liquidacion: fechaLiq,
        nro_comprobante: nroComp || null,
        coe: coe || null,
        tipo_operacion: tipoOperacion || null,
        actividad: actividad || null,
        cuit_cliente: cliente.cuit,
        denominacion_cliente: cliente.nombre,
        grano: grano || null,
        grado: grado || null,
        factor: factor ? parsearAR(factor) : null,
        toneladas: toneladas ? parsearAR(toneladas) : null,
        modo_precio: modoPrecio,
        precio_usd: precioUsd ? parsearAR(precioUsd) : null,
        tc: tc ? parsearAR(tc) : null,
        precio_pesos: precioPesos ? parsearAR(precioPesos) : null,
        precio_final_pesos: precioFinal ? parsearAR(precioFinal) : null,
        subtotal_neto: subN,
        alicuota_iva: alicuotaIva ? parsearStd(alicuotaIva) : null,
        iva: ivaN,
        comision_neto: comN,
        comision_alicuota_iva: comisionAlicIva ? parsearStd(comisionAlicIva) : null,
        comision_iva: comI,
        almacenaje_neto: almN,
        almacenaje_alicuota_iva: almacenajeAlicIva ? parsearStd(almacenajeAlicIva) : null,
        almacenaje_iva: almI,
        ret_iva: retIva ? parsearAR(retIva) : 0,
        ret_iibb: retIibb ? parsearAR(retIibb) : 0,
        fecha_acreditacion: fechaAcred || null,
        puerto: puerto || null,
        procedencia: procedencia || null,
        cosecha: cosecha || null,
        peso_kg: pesoKg ? parsearAR(pesoKg) : null,
        datos_adicionales: datosAdic || null,
        // Campos para Subdiario IVA Ventas
        tipo_comprobante: 332,                  // Liquidación primaria de granos
        imp_neto_gravado: ivaGravadoLibro,
        imp_neto_no_gravado: 0,
        imp_op_exentas: 0,
        imp_total: totalLibro,
        año_contable: añoLiq || null,
        mes_contable: mesLiq || null,
      }

      let liqId = liquidacionInicial?.id
      if (esEdicion) {
        const { error } = await supabase
          .schema('msa')
          .from('comprobantes_venta')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', liqId!)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .schema('msa')
          .from('comprobantes_venta')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        liqId = data.id
      }

      // Pivot: reemplazar vínculos
      await supabase
        .schema('msa')
        .from('ventas_comprobantes')
        .delete()
        .eq('comprobante_id', liqId!)
      if (seleccionadas.size > 0) {
        const rows = Array.from(seleccionadas).map(venta_id => ({ venta_id, comprobante_id: liqId! }))
        const { error: errPivot } = await supabase
          .schema('msa')
          .from('ventas_comprobantes')
          .insert(rows)
        if (errPivot) throw errPivot
      }

      // Asegurar es_cliente=true en proveedores
      await supabase
        .from('proveedores')
        .update({ es_cliente: true })
        .eq('cuit', cliente.cuit)
        .eq('es_cliente', false)

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
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar liquidación' : 'Nueva liquidación'}</DialogTitle>
          <DialogDescription>
            Inputs en el orden del Excel. Las celdas con fondo gris son calculadas automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-1">

          {/* ════ 1. IDENTIFICACIÓN ════ */}
          <Section title="1. Identificación">
            <div className="grid grid-cols-4 gap-3">
              <Field label="Fecha liquidación *">
                <Input type="date" value={fechaLiq} onChange={e => setFechaLiq(e.target.value)} />
              </Field>
              <Field label="Nº Comprobante">
                <Input value={nroComp} onChange={e => setNroComp(e.target.value)} placeholder="332020133474" />
              </Field>
              <Field label="COE">
                <Input value={coe} onChange={e => setCoe(e.target.value)} placeholder="330228588180" />
              </Field>
              <Field label="Fecha acreditación">
                <Input type="date" value={fechaAcred} onChange={e => setFechaAcred(e.target.value)} />
              </Field>
              <Field label="Tipo de operación" wide>
                <Input value={tipoOperacion} onChange={e => setTipoOperacion(e.target.value)} placeholder="2 - Consignación de granos" />
              </Field>
              <Field label="Actividad" wide>
                <Input value={actividad} onChange={e => setActividad(e.target.value)} placeholder="ACOPIADOR - CONSIGNATARIO" />
              </Field>
            </div>
          </Section>

          {/* ════ 2. COMPRADOR ════ */}
          <Section title="2. Comprador">
            <ProveedorCombobox
              label="Comprador"
              required
              value={{ cuit: cliente.cuit, nombre: cliente.nombre }}
              onChange={(sel) => setCliente({ cuit: sel.cuit, nombre: sel.nombre })}
            />
          </Section>

          {/* ════ 3. OPERACIÓN FÍSICA ════ */}
          <Section title="3. Operación">
            <div className="grid grid-cols-4 gap-3">
              <Field label="Grano">
                <Input placeholder="SOJA" value={grano} onChange={e => setGrano(e.target.value)} />
              </Field>
              <Field label="Grado">
                <Input placeholder="G2" value={grado} onChange={e => setGrado(e.target.value)} />
              </Field>
              <Field label="Factor">
                <Input value={factor} onChange={e => setFactor(e.target.value)} placeholder="100" />
              </Field>
              <Field label="Toneladas">
                <Input value={toneladas} onChange={e => onChangeTon(e.target.value)} placeholder="0,00" />
              </Field>
            </div>
          </Section>

          {/* ════ 4. PRECIO LLENO ════ */}
          <Section title="4. Precio lleno (referencia)" subtitle="Modo USD × TC o Pesos directo. Al cambiar USD/TC se recalcula pesos.">
            <div className="flex items-center gap-4 mb-2 text-xs">
              <Label className="text-xs">Modo:</Label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="modo-precio-liq" value="pesos" checked={modoPrecio === 'pesos'} onChange={() => setModoPrecio('pesos')} />
                Pesos directo
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="modo-precio-liq" value="usd" checked={modoPrecio === 'usd'} onChange={() => setModoPrecio('usd')} />
                USD × TC
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Precio USD / TN">
                <Input value={precioUsd} onChange={e => onChangeUsd(e.target.value)}
                  disabled={modoPrecio === 'pesos'} className={modoPrecio === 'pesos' ? 'bg-gray-100' : ''} placeholder="0,00" />
              </Field>
              <Field label="Tipo de cambio">
                <Input value={tc} onChange={e => onChangeTc(e.target.value)}
                  disabled={modoPrecio === 'pesos'} className={modoPrecio === 'pesos' ? 'bg-gray-100' : ''} placeholder="0,00" />
              </Field>
              <Field label="Precio lleno Pesos / TN">
                <Input value={precioPesos} onChange={e => onChangePesos(e.target.value)} placeholder="0,00" />
              </Field>
            </div>
          </Section>

          {/* ════ 5. PRECIO FINAL Y SUBTOTAL ════ */}
          <Section title="5. Precio final y Subtotal" subtitle="Precio final default = precio lleno. Editar precio final o subtotal: se recalculan entre sí. No toca precio lleno.">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Precio final Pesos / TN">
                <Input value={precioFinal} onChange={e => onChangePrecioFinal(e.target.value)}
                  placeholder={precioPesos ? `default: ${precioPesos}` : 'opcional'} />
              </Field>
              <Field label="Subtotal (Neto Venta) *" wide>
                <Input value={subtotal} onChange={e => onChangeSubtotal(e.target.value)} placeholder="0,00" />
              </Field>
            </div>
          </Section>

          {/* ════ 6. IVA VENTA ════ */}
          <Section title="6. IVA Venta">
            <div className="grid grid-cols-4 gap-3 items-end">
              <Field label="Alícuota IVA">
                <select className="w-full border rounded h-9 px-2 text-sm"
                  value={alicuotaIva} onChange={e => setAlicuotaIva(e.target.value)}>
                  {ALICUOTAS_IVA.map(a => <option key={a} value={a}>{a.replace('.', ',')}%</option>)}
                </select>
              </Field>
              <Field label="IVA (editable)">
                <Input value={iva} onChange={e => setIva(e.target.value)} placeholder="0,00" />
              </Field>
              <Calc label="Total Operación" value={calc.totalOp} />
            </div>
          </Section>

          {/* ════ 7. COMISIÓN ════ */}
          <Section title="7. Comisión" subtitle="Doble vía: cargá monto y se calcula el %, o cargá el % y se calcula el monto.">
            <div className="grid grid-cols-5 gap-3 items-end">
              <Field label="Monto comisión (neto)">
                <Input value={comisionNeto} onChange={e => onChangeComisionNeto(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="% sobre subtotal">
                <Input value={comisionPct} onChange={e => onChangeComisionPct(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Alícuota IVA">
                <select className="w-full border rounded h-9 px-2 text-sm"
                  value={comisionAlicIva} onChange={e => setComisionAlicIva(e.target.value)}>
                  {ALICUOTAS_IVA.map(a => <option key={a} value={a}>{a.replace('.', ',')}%</option>)}
                </select>
              </Field>
              <Field label="IVA comisión (editable)">
                <Input value={comisionIva} onChange={e => setComisionIva(e.target.value)} placeholder="0,00" />
              </Field>
              <Calc label="Total comisión" value={parsearAR(comisionNeto) + parsearAR(comisionIva)} />
            </div>
          </Section>

          {/* ════ 8. ALMACENAJE ════ */}
          <Section title="8. Almacenaje" subtitle="Mismo formato que comisión.">
            <div className="grid grid-cols-5 gap-3 items-end">
              <Field label="Monto almacenaje (neto)">
                <Input value={almacenajeNeto} onChange={e => onChangeAlmacenajeNeto(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="% sobre subtotal">
                <Input value={almacenajePct} onChange={e => onChangeAlmacenajePct(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Alícuota IVA">
                <select className="w-full border rounded h-9 px-2 text-sm"
                  value={almacenajeAlicIva} onChange={e => setAlmacenajeAlicIva(e.target.value)}>
                  {ALICUOTAS_IVA.map(a => <option key={a} value={a}>{a.replace('.', ',')}%</option>)}
                </select>
              </Field>
              <Field label="IVA almacenaje (editable)">
                <Input value={almacenajeIva} onChange={e => setAlmacenajeIva(e.target.value)} placeholder="0,00" />
              </Field>
              <Calc label="Total almacenaje" value={parsearAR(almacenajeNeto) + parsearAR(almacenajeIva)} />
            </div>
          </Section>

          {/* ════ 9. RESUMEN CALCULADO ════ */}
          <Section title="9. Resumen calculado">
            <div className="grid grid-cols-4 gap-3">
              <Calc label="Gravado Neto" value={calc.gravadoNeto} hint="subtotal − comisión − almacén" />
              <Calc label="IVA Total" value={calc.ivaTotal} hint="iva − iva com − iva alm" />
              <Calc label="Total Deducciones" value={calc.totalDeducciones} />
              <Calc label="Total op − total deducciones" value={calc.totalOpMenosDed} />
            </div>
          </Section>

          {/* ════ 10. RETENCIONES ════ */}
          <Section title="10. Retenciones (inputs del documento)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ret. IVA RG 2300/2007">
                <Input value={retIva} onChange={e => setRetIva(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Ret. IIBB">
                <Input value={retIibb} onChange={e => setRetIibb(e.target.value)} placeholder="0,00" />
              </Field>
            </div>
          </Section>

          {/* ════ 11. RESULTADO ════ */}
          <Section title="11. Resultado">
            <div className="grid grid-cols-3 gap-3">
              <Calc label="Importe Neto a Pagar" value={calc.importeNeto} hint="total op − deduc − ret iva − ret iibb" />
              <Calc label="IVA RG 2300/2007 cobrado" value={calc.ivaRg2300} hint="iva total − ret iva" />
              <Calc label="Pago Según Condiciones" value={calc.pagoCond} hint="importe neto − iva cobrado" />
            </div>
          </Section>

          {/* ════ 12. METADATA ════ */}
          <Section title="12. Metadata (opcional)">
            <div className="grid grid-cols-4 gap-3">
              <Field label="Puerto"><Input value={puerto} onChange={e => setPuerto(e.target.value)} placeholder="ROSARIO" /></Field>
              <Field label="Procedencia"><Input value={procedencia} onChange={e => setProcedencia(e.target.value)} placeholder="SAN PEDRO" /></Field>
              <Field label="Cosecha"><Input value={cosecha} onChange={e => setCosecha(e.target.value)} placeholder="25" /></Field>
              <Field label="Peso (kg)"><Input value={pesoKg} onChange={e => setPesoKg(e.target.value)} placeholder="0,00" /></Field>
              <Field label="Datos adicionales" wide>
                <Textarea rows={2} value={datosAdic} onChange={e => setDatosAdic(e.target.value)}
                  placeholder="Acreditación 11/06/2025 - CCP ARRECIFES - Cosecha 25" />
              </Field>
            </div>
          </Section>

          {/* ════ 13. VINCULACIÓN CON VENTAS ════ */}
          <Section title="13. Ventas vinculadas" subtitle={`Seleccionadas: ${seleccionadas.size}`}>
            <Input
              placeholder="Buscar venta por cliente, CUIT, grano..."
              value={busquedaVenta}
              onChange={e => setBusquedaVenta(e.target.value)}
              className="h-8 text-sm mb-2"
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
          </Section>
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

// ─── Sub-componentes auxiliares ───────────────────────────────────

function Section({ title, subtitle, children }: { title: string, subtitle?: string, children: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div>
        <div className="font-semibold text-sm">{title}</div>
        {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children, wide }: { label: string, children: React.ReactNode, wide?: boolean }) {
  return (
    <div className={`space-y-1 ${wide ? 'col-span-2' : ''}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function Calc({ label, value, hint }: { label: string, value: number, hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="h-9 px-2 flex items-center bg-gray-100 border rounded text-sm font-medium">
        {fmtMoney(value)}
      </div>
      {hint && <div className="text-[10px] text-gray-400 leading-tight">{hint}</div>}
    </div>
  )
}
