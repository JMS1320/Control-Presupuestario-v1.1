"use client"

/**
 * 🐂 **CARGAR o EDITAR UNA LIQUIDACIÓN DE HACIENDA** — «Cuenta de Venta y Líquido Producto A» (tipo 60).
 * A-FEAT-1225. Pedido del usuario 2026-10-01: *«es como las de granos pero con sus propios tipos
 * de datos… debe estar lista para chupar los datos de la venta… y debe dar alert en caso de cosas
 * que no coincidan»*.
 *
 * - Las cuentas y los avisos viven en `lib/ventas/hacienda.ts`, con casos verificados al centavo
 *   contra papeles reales. Esta pantalla sólo junta lo que se tipea y muestra lo que da.
 * - **Abierta desde una o varias ventas, viene PRECARGADA** (§ Default del dato real): una línea por
 *   venta. Arre Beef (2026-10-02): 7 vacas y 3 toros, dos ventas, **un solo papel**.
 * - 🔑 **EDITAR, nunca duplicar** (2026-10-02). El usuario creía que volver a apretar *Liquidar*
 *   editaba la liquidación — creaba otra. Ahora, con `comprobanteId`, esta pantalla abre la que ya
 *   existe y GUARDA ENCIMA; y *Liquidar* sobre una venta ya liquidada abre ésa. Lo mismo desde
 *   Comprobantes → Editar, que antes abría el modal de granos (A-BUG-1233).
 * - **Avisa, no frena** (§ 🚦): una diferencia con la venta o con el papel puede tener explicación.
 * - Las retenciones van igual que en granos: lo impreso en el papel acá; un certificado suelto,
 *   después, con el botón % de la solapa Comprobantes.
 */

import { useEffect, useMemo, useState } from "react"
import { propagarImputacionDeVenta } from "@/lib/ventas/detalle-cobro-db"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { CentroCostoCombobox } from "@/components/ui/centro-costo-combobox"
import { supabase } from "@/lib/supabase"
import { registrarContrapartes } from "@/lib/contrapartes/registrar"
import { toast } from "sonner"
import { Plus, Trash2, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import {
  calcularLiqHacienda, retencionSugerida, compararConVenta, controlContraPapel, controlPlazos,
  plazosDesdeVenta, kgQueSeCobran, ventaParaComparar, precargaDesdeVenta, huellaLiquidacion,
  lineaAlGancho, importeDeLinea, precioPieDerivado, precioGanchoDerivado,
  type AvisoLiq, type PlazoCobro, type HuellaLiq,
} from "@/lib/ventas/hacienda"
import { cargarVentasHacienda, type VentaHaciendaDatos } from "@/lib/ventas/hacienda-db"

/** Una venta de Productivo desde la que se liquida. */
export type VentaOrigen = VentaHaciendaDatos

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Las ventas que liquida este papel (una, varias, o ninguna = liquidación suelta). */
  ventas: VentaOrigen[]
  /** Con id: se EDITA esa liquidación (sus ventas se buscan solas). Sin id: se crea una nueva. */
  comprobanteId?: string | null
  onGuardado?: () => void
}

// ── Formato es-AR (§ 💰 de CLAUDE.md) ────────────────────────────────────────────────────────
// Montos: punto de miles, coma decimal. Porcentajes: coma o punto decimal, sin miles (2,319).
const parsearAR = (s: string): number => (s ? parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0 : 0)
const parsearPct = (s: string): number => (s ? parseFloat(String(s).replace(',', '.')) || 0 : 0)
const fmtAR = (n: number, dec = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtPct = (n: number) => String(n).replace('.', ',')
/** Al salir de un campo de monto, se reescribe en formato es-AR (1.234.567,89). Vacío queda vacío. */
const reformatear = (v: string, dec = 2) => (v.trim() ? fmtAR(parsearAR(v), dec) : '')
const r2 = (n: number) => Math.round(n * 100) / 100
type TotalId = 'bruto' | 'neto' | 'importe'
type Verificacion = 'ok' | 'distinto' | null

/** `mandaPie`: el usuario cargó el $/kg VIVO y el gancho se deriva (A-FEAT-1234, 2026-10-05). */
interface LineaUI { razonSocial: string; cuit: string; cabezas: string; clasificacion: string; kilos: string; precio: string; kgGancho: string; precioGancho: string; mandaPie?: boolean }
interface RetUI { concepto: string; alicuota: string; importe: string }
interface PlazoUI { dias: string; pct: string; vencimiento: string; importe: string; estado?: 'a cobrar' | 'cobrado' }

const lineaVacia = (): LineaUI => ({ razonSocial: '', cuit: '', cabezas: '', clasificacion: '', kilos: '', precio: '', kgGancho: '', precioGancho: '' })
const RET_IIBB: RetUI = { concepto: 'INGRESOS BRUTOS Pcia BS AS', alicuota: '0,75', importe: '' }

const lineaParaPantalla = (l: { razonSocial: string; cuit: string; cabezas: number; clasificacion: string; kilos: number; precio: number; kgGancho?: number | null; precioGancho?: number | null; mandaPie?: boolean }): LineaUI => ({
  mandaPie: !!l.mandaPie,
  razonSocial: l.razonSocial || '', cuit: l.cuit || '',
  cabezas: l.cabezas ? String(l.cabezas) : '',
  clasificacion: l.clasificacion || '',
  kilos: l.kilos ? fmtAR(l.kilos, 0) : '',
  precio: l.precio ? fmtAR(l.precio, 2) : '',
  kgGancho: l.kgGancho ? fmtAR(l.kgGancho, 1) : '',
  precioGancho: l.precioGancho ? fmtAR(l.precioGancho, 2) : '',
})

export function ModalLiquidacionHacienda({ open, onOpenChange, ventas, comprobanteId, onGuardado }: Props) {
  const esEdicion = !!comprobanteId
  const [cargando, setCargando] = useState(false)
  /** Las ventas de este papel: las que vienen por props, o las que se encuentran al editar. */
  const [ventasCtx, setVentasCtx] = useState<VentaOrigen[]>([])
  const [fecha, setFecha] = useState('')
  const [consignatario, setConsignatario] = useState({ cuit: '', nombre: '' })
  const [nroComp, setNroComp] = useState('')
  const [nroGuia, setNroGuia] = useState('')
  const [dte, setDte] = useState('')
  const [procedencia, setProcedencia] = useState('')
  const [lineas, setLineas] = useState<LineaUI[]>([lineaVacia()])
  const [comisionPct, setComisionPct] = useState('')
  const [redondeo, setRedondeo] = useState('')
  const [ivaPct, setIvaPct] = useState('10,5')
  /** 🎚️ Montos a mano: vacío = se calcula con el %; con valor = manda el tipeado. */
  const [comisionMonto, setComisionMonto] = useState('')
  const [ivaMonto, setIvaMonto] = useState('')
  const [rets, setRets] = useState<RetUI[]>([RET_IIBB])
  const [plazos, setPlazos] = useState<PlazoUI[]>([])
  /** ✓ / ✗ contra el papel, por total («mejor que yo le dé check si es así y tipee si no»). */
  const [verif, setVerif] = useState<Record<TotalId, Verificacion>>({ bruto: null, neto: null, importe: null })
  const [papel, setPapel] = useState<Record<TotalId, string>>({ bruto: '', neto: '', importe: '' })
  const [cuentaContable, setCuentaContable] = useState<string | null>(null)
  const [nroCuenta, setNroCuenta] = useState<string | null>(null)
  const [centroCosto, setCentroCosto] = useState('')
  const [pickCuenta, setPickCuenta] = useState(false)
  const [guardando, setGuardando] = useState(false)
  /** 🐾 Lo que propuso la app al abrir (para la huella): la precarga desde la PRIMERA venta. */
  const [precargado, setPrecargado] = useState<ReturnType<typeof precargaDesdeVenta> | null>(null)
  /** 🐾 Al editar: la huella de la precarga original se conserva, no se pisa. */
  const [huellaAnterior, setHuellaAnterior] = useState<HuellaLiq | null>(null)
  const [estadoComprobante, setEstadoComprobante] = useState<string>('a cobrar')

  const limpiar = () => {
    setConsignatario({ cuit: '', nombre: '' })
    setNroComp(''); setNroGuia(''); setDte(''); setProcedencia('')
    setRedondeo(''); setIvaPct('10,5'); setRets([RET_IIBB]); setPlazos([])
    setComisionMonto(''); setIvaMonto('')
    setVerif({ bruto: null, neto: null, importe: null }); setPapel({ bruto: '', neto: '', importe: '' })
    setCuentaContable(null); setNroCuenta(null); setCentroCosto(''); setPickCuenta(false)
    setPrecargado(null); setHuellaAnterior(null); setEstadoComprobante('a cobrar')
  }

  // ── Al abrir: editar la existente, o precargar desde las ventas ─────────────────────────────
  useEffect(() => {
    if (!open) return
    limpiar()
    if (comprobanteId) { void cargarParaEditar(comprobanteId); return }
    setVentasCtx(ventas)
    if (ventas.length) {
      const pre = ventas.map(v => precargaDesdeVenta(v))
      setFecha(ventas.map(v => v.fecha).sort().slice(-1)[0] || '')
      setLineas(pre.map(p => lineaParaPantalla(p.linea)))
      // La comisión: la de la venta si todas tienen la misma; si no, 0 y que mande el papel.
      const comisiones = Array.from(new Set(pre.map(p => p.comisionPct)))
      setComisionPct(fmtPct(comisiones.length === 1 ? comisiones[0] : 0))
      setCentroCosto(ventas[0].centroCosto || '')
      // La cuenta de la venta viaja a su liquidación (§ 🔁 propagación): se carga una sola vez.
      // La venta guarda el nombre; el número se busca en el plan para no dejarlo a medias.
      const cta = ventas[0].cuentaContable
      if (cta) {
        setCuentaContable(cta)
        void supabase.from('cuentas_contables').select('nro_cuenta').eq('categ', cta).maybeSingle()
          .then(({ data }) => setNroCuenta((data as { nro_cuenta?: string } | null)?.nro_cuenta || null))
      }
      setPrecargado(pre[0])
    } else {
      setFecha(''); setLineas([lineaVacia()]); setComisionPct('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, comprobanteId, ventas])

  const cargarParaEditar = async (id: string) => {
    setCargando(true)
    try {
      const { data: c, error } = await supabase.schema('msa').from('comprobantes_venta').select('*').eq('id', id).single()
      if (error) throw error
      const { data: links } = await supabase.from('ventas_facturas')
        .select('venta_id').eq('venta_tipo', 'ganaderia').eq('comprobante_id', id).eq('vinculado', true)
      const ids = ((links || []) as any[]).map(l => l.venta_id)
      setVentasCtx(ids.length ? await cargarVentasHacienda(supabase, ids) : [])

      setFecha(c.fecha_liquidacion || '')
      setConsignatario({ cuit: c.cuit_cliente || '', nombre: c.denominacion_cliente || '' })
      setNroComp(c.nro_comprobante || ''); setNroGuia(c.nro_guia || ''); setDte(c.dte || ''); setProcedencia(c.procedencia || '')
      const ls = (c.hacienda_lineas || []) as any[]
      setLineas(ls.length ? ls.map(l => lineaParaPantalla(l)) : [lineaVacia()])
      setRedondeo(c.redondeo ? fmtAR(Number(c.redondeo)) : '')

      // La comisión y el IVA vuelven como % si el % los reproduce al centavo; si no, como monto a mano.
      const bruto = Number(c.subtotal_neto) || 0
      const com = Number(c.comision_neto) || 0
      const comPct = bruto > 0 ? Math.round(com / bruto * 100 * 1000) / 1000 : 0
      const huella = (c.correcciones || null) as HuellaLiq | null
      if (huella?.montosAMano?.comision || r2(bruto * comPct / 100) !== r2(com)) { setComisionPct(fmtPct(comPct)); setComisionMonto(fmtAR(com)) }
      else { setComisionPct(fmtPct(comPct)); setComisionMonto('') }
      const neto = Number(c.imp_neto_gravado) || 0
      const iva = Number(c.iva) || 0
      const alic = Number(c.alicuota_iva) || 0
      setIvaPct(fmtPct(alic))
      setIvaMonto(huella?.montosAMano?.iva || r2(neto * alic / 100) !== r2(iva) ? fmtAR(iva) : '')

      const retsL: RetUI[] = []
      if (Number(c.ret_iibb)) retsL.push({ concepto: 'INGRESOS BRUTOS Pcia BS AS', alicuota: fmtPct(bruto > 0 ? Math.round(Number(c.ret_iibb) / bruto * 100 * 1000) / 1000 : 0), importe: fmtAR(Number(c.ret_iibb)) })
      if (Number(c.ret_iva)) retsL.push({ concepto: 'RETENCIÓN IVA', alicuota: '', importe: fmtAR(Number(c.ret_iva)) })
      setRets(retsL.length ? retsL : [RET_IIBB])

      setPlazos(((c.plazos || []) as any[]).map(p => ({
        dias: String(p.dias ?? ''), pct: fmtPct(Number(p.pct) || 0), vencimiento: p.vencimiento || '',
        importe: fmtAR(Number(p.importe) || 0), estado: p.estado,
      })))
      const marcas = huella?.contraElPapel || {}
      setVerif({
        bruto: marcas.bruto ? (marcas.bruto.estado === 'coincide' ? 'ok' : 'distinto') : null,
        neto: marcas.neto ? (marcas.neto.estado === 'coincide' ? 'ok' : 'distinto') : null,
        importe: marcas.importe ? (marcas.importe.estado === 'coincide' ? 'ok' : 'distinto') : null,
      })
      setPapel({
        bruto: marcas.bruto?.estado === 'distinto' ? fmtAR(marcas.bruto.papel) : '',
        neto: marcas.neto?.estado === 'distinto' ? fmtAR(marcas.neto.papel) : '',
        importe: marcas.importe?.estado === 'distinto' ? fmtAR(marcas.importe.papel) : '',
      })
      setCuentaContable(c.cuenta_contable || null); setNroCuenta(c.nro_cuenta || null); setCentroCosto(c.centro_costo || '')
      setHuellaAnterior(huella)
      setEstadoComprobante(c.estado || 'a cobrar')
    } catch (err) {
      toast.error('No se pudo abrir la liquidación: ' + (err as Error).message)
      onOpenChange(false)
    } finally {
      setCargando(false)
    }
  }

  // ── Las cuentas: todas en lib/ventas/hacienda.ts ────────────────────────────────────────────
  const entrada = useMemo(() => ({
    lineas: lineas.map(l => ({
      razonSocial: l.razonSocial, cuit: l.cuit, clasificacion: l.clasificacion,
      cabezas: parsearAR(l.cabezas), kilos: parsearAR(l.kilos), precio: parsearAR(l.precio),
      ...(l.kgGancho.trim() ? { kgGancho: parsearAR(l.kgGancho) } : {}),
      ...(!l.mandaPie && l.precioGancho.trim() ? { precioGancho: parsearAR(l.precioGancho) } : {}),
      ...(l.mandaPie ? { mandaPie: true } : {}),
    })).map(l => !lineaAlGancho(l) ? l
      // El que manda queda como se cargó; el otro se guarda derivado, para que la comparación y la huella lo tengan.
      : l.mandaPie ? { ...l, precioGancho: precioGanchoDerivado(l) } : { ...l, precio: precioPieDerivado(l) }),
    comisionPct: parsearPct(comisionPct),
    redondeo: parsearAR(redondeo),
    ivaPct: parsearPct(ivaPct),
    retenciones: rets.map(r => ({ concepto: r.concepto, alicuota: parsearPct(r.alicuota), importe: parsearAR(r.importe) })),
    comisionMonto: comisionMonto.trim() ? parsearAR(comisionMonto) : null,
    ivaMonto: ivaMonto.trim() ? parsearAR(ivaMonto) : null,
  }), [lineas, comisionPct, redondeo, ivaPct, rets, comisionMonto, ivaMonto])

  const calc = useMemo(() => calcularLiqHacienda(entrada), [entrada])

  const plazosNum: PlazoCobro[] = plazos.map(p => ({
    dias: parsearAR(p.dias), pct: parsearPct(p.pct), vencimiento: p.vencimiento, importe: parsearAR(p.importe),
    ...(p.estado ? { estado: p.estado } : {}),
  }))

  /** Las ventas del papel, sumadas: contra eso se compara la liquidación. */
  const ventaRef = useMemo(() => ventaParaComparar(ventasCtx), [ventasCtx])
  /** 🥩 Kilos gancho del papel (A-FEAT-1234): se muestran si la venta es al gancho o si alguna línea los trae. */
  const kgGanchoTotal = entrada.lineas.reduce((s, l) => s + (Number((l as { kgGancho?: number }).kgGancho) || 0), 0)
  const verGancho = !!ventaRef?.alGancho || kgGanchoTotal > 0

  const avisos: AvisoLiq[] = useMemo(() => {
    const a: AvisoLiq[] = []
    if (calc.kilos > 0 && ventaRef) a.push(...compararConVenta(ventaRef, calc, kgGanchoTotal))
    const delPapel = (id: TotalId) => (verif[id] === 'distinto' ? parsearAR(papel[id]) || null : null)
    a.push(...controlContraPapel(calc, { bruto: delPapel('bruto'), netoGravado: delPapel('neto'), importeNeto: delPapel('importe') }))
    const nombres: Record<TotalId, string> = { bruto: 'Importe bruto', neto: 'Neto gravado', importe: 'Importe neto' }
    for (const id of ['bruto', 'neto', 'importe'] as TotalId[]) {
      if (verif[id] === 'ok') a.push({ nivel: 'ok', tema: nombres[id], mensaje: nombres[id] + ': verificado contra el papel' })
    }
    const p = controlPlazos(plazosNum, calc.importeNeto)
    if (p) a.push(p)
    return a
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc, verif, papel, plazos, ventaRef])

  const plazoVenta = ventasCtx.find(v => v.plazo)?.plazo || null
  const repartirPlazos = () => {
    const base = plazosDesdeVenta(plazoVenta ?? (plazos.map(p => p.dias).join('/') || '30'), fecha, calc.importeNeto)
    setPlazos(base.map(p => ({ dias: String(p.dias), pct: fmtPct(p.pct), vencimiento: p.vencimiento, importe: fmtAR(p.importe) })))
  }

  const setLinea = (i: number, campo: keyof LineaUI, v: string) =>
    setLineas(ls => ls.map((l, k) => (k === i ? { ...l, [campo]: v } : l)))
  /** 🥩 Cargar un precio en una línea al gancho: el que se escribe pasa a mandar y el otro se deriva. */
  const setPrecioQueManda = (i: number, cual: 'pie' | 'gancho', v: string) =>
    setLineas(ls => ls.map((l, k) => (k !== i ? l
      : cual === 'pie' ? { ...l, precio: v, mandaPie: true } : { ...l, precioGancho: v, mandaPie: false })))
  const setRet = (i: number, campo: keyof RetUI, v: string) =>
    setRets(rs => rs.map((r, k) => (k === i ? { ...r, [campo]: v } : r)))
  const setPlazo = (i: number, campo: keyof PlazoUI, v: string) =>
    setPlazos(ps => ps.map((p, k) => (k === i ? { ...p, [campo]: v } : p)))

  const faltan: string[] = []
  if (!fecha) faltan.push('la fecha')
  if (!consignatario.cuit || !consignatario.nombre) faltan.push('el consignatario')
  if (!(calc.kilos > 0 && calc.bruto > 0)) faltan.push('al menos una línea con kilos y precio')

  const guardar = async () => {
    if (faltan.length) { toast.error('Falta ' + faltan.join(', ')); return }
    setGuardando(true)
    try {
      const [anio, mes] = fecha.split('-').map(Number)
      const esIibb = (c: string) => /bruto|iibb/i.test(c)
      const esRetIva = (c: string) => /\biva\b/i.test(c) && /ret/i.test(c)
      const retIibb = entrada.retenciones.filter(r => esIibb(r.concepto)).reduce((s, r) => s + r.importe, 0)
      const retIva = entrada.retenciones.filter(r => esRetIva(r.concepto)).reduce((s, r) => s + r.importe, 0)
      const otras = entrada.retenciones.filter(r => !esIibb(r.concepto) && !esRetIva(r.concepto) && r.importe > 0)
      const unaLinea = entrada.lineas.length === 1 ? entrada.lineas[0] : null

      // 🐾 La huella (§ 📄 de CLAUDE.md): lo que propuso la app al lado de lo que quedó.
      let huella = huellaLiquidacion({
        calc,
        calcSinAMano: calcularLiqHacienda({ ...entrada, comisionMonto: null, ivaMonto: null }),
        comisionAMano: !!comisionMonto.trim(),
        ivaAMano: !!ivaMonto.trim(),
        marcas: Object.fromEntries((['bruto', 'neto', 'importe'] as TotalId[])
          .filter(id => verif[id])
          .map(id => [id, { estado: verif[id] as 'ok' | 'distinto', papel: verif[id] === 'distinto' ? parsearAR(papel[id]) || null : null }])),
        precarga: !esEdicion && precargado && ventasCtx[0] ? { ventaId: ventasCtx[0].id, linea: precargado.linea, comisionPct: precargado.comisionPct } : null,
        guardado: { linea: entrada.lineas[0] ?? null, comisionPct: comisionMonto.trim() ? calc.comisionPctEfectivo : entrada.comisionPct },
      })
      // Al editar, la huella de la precarga ORIGINAL se conserva: es lo que la app propuso la primera vez.
      if (esEdicion && huellaAnterior?.precarga) {
        huella = huella ? { ...huella, precarga: huellaAnterior.precarga }
          : { version: 1, montosAMano: {}, contraElPapel: {}, precarga: huellaAnterior.precarga }
      }

      const payload = {
        tipo_comprobante: 60,                      // Cta. de Venta y Líquido Producto A
        fecha_liquidacion: fecha,
        nro_comprobante: nroComp || null,
        actividad: 'ganaderia',
        cuit_cliente: consignatario.cuit,
        denominacion_cliente: consignatario.nombre,
        cabezas: calc.cabezas,
        peso_kg: calc.kilos,
        precio_pesos: unaLinea ? unaLinea.precio : null,
        subtotal_neto: calc.bruto,
        comision_neto: calc.comision,
        comision_alicuota_iva: 0,
        comision_iva: 0,
        alicuota_iva: entrada.ivaPct,
        iva: calc.iva,
        ret_iibb: retIibb,
        ret_iva: retIva,
        redondeo: entrada.redondeo,
        procedencia: procedencia || null,
        nro_guia: nroGuia || null,
        dte: dte || null,
        hacienda_lineas: entrada.lineas,
        plazos: plazosNum.length ? plazosNum : null,
        correcciones: huella,
        // Para el libro de IVA, igual que la liquidación de granos: neto gravado + IVA.
        imp_neto_gravado: calc.netoGravado,
        imp_neto_no_gravado: 0,
        imp_op_exentas: 0,
        imp_total: r2(calc.netoGravado + calc.iva),
        año_contable: anio || null,
        mes_contable: mes || null,
        cuenta_contable: cuentaContable,
        nro_cuenta: nroCuenta,
        centro_costo: centroCosto || null,
        fecha_cobro_estimada: plazosNum[0]?.vencimiento || fecha,
      }

      let compId: string
      if (esEdicion && comprobanteId) {
        // 🔑 Se guarda ENCIMA. El estado no se toca: lo deciden las marcas de cobrado y la conciliación.
        const { error, count } = await supabase.schema('msa').from('comprobantes_venta')
          .update(payload, { count: 'exact' }).eq('id', comprobanteId)
        if (error) throw error
        if (count === 0) throw new Error('No se encontró la liquidación: el cambio NO se guardó')
        compId = comprobanteId
        // 🏷️ La cuenta viaja a sus cobros ya conciliados en el banco.
        await propagarImputacionDeVenta(supabase, compId, payload as any)
      } else {
        const { data: comp, error } = await supabase.schema('msa').from('comprobantes_venta')
          .insert({ ...payload, estado: 'a cobrar' }).select('id').single()
        if (error) throw error
        compId = comp.id

        // Retenciones impresas que no son IVA ni IIBB (Ganancias…): van donde van los certificados.
        if (otras.length) {
          const { error: eR } = await supabase.schema('msa').from('retenciones_recibidas').insert(otras.map(r => ({
            tipo: r.concepto, monto: r.importe, comprobante_venta_id: compId,
            cuit_cliente: consignatario.cuit, denominacion_cliente: consignatario.nombre, fecha,
            observaciones: 'Impresa en la liquidación de hacienda (alícuota ' + fmtPct(r.alicuota) + ' %)',
          })))
          if (eR) toast.warning('La liquidación se guardó, pero no las retenciones extra', { description: eR.message })
        }

        // Un vínculo POR VENTA, con el mismo criterio que el resto de la app: lo menor entre lo que
        // trae la venta y lo que le falta facturar.
        if (ventasCtx.length) {
          const { error: eV } = await supabase.from('ventas_facturas').insert(ventasCtx.map(v => ({
            venta_tipo: 'ganaderia', venta_id: v.id, empresa: 'MSA', comprobante_id: compId,
            monto_asignado: r2(Math.max(v.neto - (v.liquidado || 0), 0)), vinculado: true,
          })))
          if (eV) toast.warning('La liquidación se guardó, pero no quedó vinculada a la venta', { description: eV.message })
        }
      }

      // 👥 La contraparte queda registrada (upsert, nunca sólo UPDATE).
      const rc = await registrarContrapartes(supabase, [{ cuit: consignatario.cuit, razon_social: consignatario.nombre || null }], 'cliente')
      if (rc.error) toast.warning('La liquidación se guardó, pero el consignatario no quedó registrado en Proveedores', { description: rc.error.slice(0, 120) })

      const n = avisos.filter(a => a.nivel === 'aviso').length
      toast.success((esEdicion ? 'Liquidación actualizada' : 'Liquidación de hacienda registrada') + (n ? ` — con ${n} aviso(s)` : ''))
      onOpenChange(false)
      onGuardado?.()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const avisosActivos = avisos.filter(a => a.nivel === 'aviso')
  const fmtF = (s: string) => s ? s.split('-').reverse().join('/') : '—'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🐂 {esEdicion ? 'Editar liquidación de hacienda' : 'Liquidación de hacienda'} — Cuenta de Venta y Líquido Producto</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? <>Estás editando la liquidación que ya está cargada: al guardar se actualiza ésta, no se crea otra.{estadoComprobante !== 'a cobrar' && <> Estado: <b>{estadoComprobante}</b>.</>}</>
              : ventasCtx.length
                ? <>Precargada de {ventasCtx.length === 1 ? 'la venta' : `las ${ventasCtx.length} ventas`} — una línea por venta. Cambiá lo que diga distinto tu papel: la comparación se hace siempre contra las ventas originales.</>
                : <>Liquidación sin venta asociada. Cargala como figura en el papel.</>}
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center justify-center py-12 text-gray-500"><Loader2 className="h-5 w-5 mr-2 animate-spin" />Abriendo la liquidación…</div>
        ) : (<>

        {/* 🎚️ Lo que se tiene que cobrar según las ventas — chiquito, siempre a la vista. Pedido del
            usuario 2026-10-01: «son tantos kg × tal precio menos tanto de CZ = tanto a cobrar». */}
        {ventasCtx.length > 0 && (
          <div className="rounded bg-slate-50 border px-3 py-1.5 text-xs text-slate-700 tabular-nums space-y-0.5">
            {ventasCtx.map(v => {
              const kg = kgQueSeCobran(v)
              const cz = kg * v.precioKg * (Number(v.pctCz) || 0)
              return (
                <div key={v.id}>
                  <b>Según la venta del {fmtF(v.fecha)}</b> ({v.cliente}{v.categoria ? ' · ' + v.categoria : ''}): {fmtAR(kg, 1)} kg{v.kgCarne ? ' de carne' : ''} × ${fmtAR(v.precioKg)} − CZ ${fmtAR(cz)} = <b>${fmtAR(v.neto)}</b> a cobrar
                </div>
              )
            })}
            {ventasCtx.length > 1 && ventaRef && <div className="pt-0.5 border-t"><b>Total de las ventas: ${fmtAR(ventaRef.neto)}</b> a cobrar</div>}
            <div className="text-slate-500">neto, antes de IVA</div>
          </div>
        )}

        {/* ── Datos del papel ── */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label htmlFor="lh-fecha">Fecha</Label><Input id="lh-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
          <div className="col-span-2">
            <ProveedorCombobox value={consignatario} onChange={setConsignatario} label="Consignatario (quien liquida y paga)" rol="cliente" />
          </div>
          <div><Label htmlFor="lh-nro">Nº de comprobante</Label><Input id="lh-nro" value={nroComp} onChange={e => setNroComp(e.target.value)} /></div>
          <div><Label htmlFor="lh-guia">Nº de guía</Label><Input id="lh-guia" value={nroGuia} onChange={e => setNroGuia(e.target.value)} /></div>
          <div><Label htmlFor="lh-dte">DTe Nº</Label><Input id="lh-dte" value={dte} onChange={e => setDte(e.target.value)} /></div>
          <div><Label htmlFor="lh-proc">Procedencia (partido de la guía)</Label><Input id="lh-proc" value={procedencia} onChange={e => setProcedencia(e.target.value)} placeholder="San Pedro" /></div>
        </section>

        {/* ── La tabla del papel ── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Hacienda liquidada</h4>
            <Button size="sm" variant="outline" onClick={() => setLineas(ls => [...ls, lineaVacia()])}><Plus className="h-3.5 w-3.5 mr-1" />Línea</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="text-left p-1">Comprador (razón social)</th><th className="text-left p-1">CUIT</th>
                  <th className="text-right p-1">Cabezas</th><th className="text-left p-1">Clasificación</th>
                  <th className="text-right p-1">{verGancho ? 'Kg pie' : 'Kilos'}</th><th className="text-right p-1">Prom.</th>
                  {verGancho && <th className="text-right p-1" title="El dato real: kilos gancho del frigorífico">Kg gancho</th>}
                  {verGancho && <th className="text-right p-1" title="El dato real: precio por kilo gancho">$/kg gancho</th>}
                  <th className="text-right p-1">{verGancho ? '$/kg pie' : 'Precio $/kg'}</th><th className="text-right p-1">Importe</th><th />
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => {
                  const e = entrada.lineas[i]
                  return (
                    <tr key={i}>
                      <td className="p-1"><Input value={l.razonSocial} onChange={ev => setLinea(i, 'razonSocial', ev.target.value)} /></td>
                      <td className="p-1 w-36"><Input value={l.cuit} onChange={ev => setLinea(i, 'cuit', ev.target.value)} /></td>
                      <td className="p-1 w-20"><Input type="text" className="text-right" value={l.cabezas} onChange={ev => setLinea(i, 'cabezas', ev.target.value)} /></td>
                      <td className="p-1"><Input value={l.clasificacion} onChange={ev => setLinea(i, 'clasificacion', ev.target.value)} /></td>
                      <td className="p-1 w-28"><Input type="text" className="text-right" placeholder="0" value={l.kilos} onChange={ev => setLinea(i, 'kilos', ev.target.value)} onBlur={ev => setLinea(i, 'kilos', reformatear(ev.target.value, 0))} /></td>
                      <td className="p-1 text-right tabular-nums text-gray-500">{e.cabezas > 0 ? fmtAR(e.kilos / e.cabezas, 0) : '—'}</td>
                      {verGancho && <td className="p-1 w-24"><Input type="text" className="text-right" placeholder="0" value={l.kgGancho} onChange={ev => setLinea(i, 'kgGancho', ev.target.value)} onBlur={ev => setLinea(i, 'kgGancho', reformatear(ev.target.value, 1))} /></td>}
                      {/* 🥩 Los dos precios se pueden cargar: el que escribís manda (negro) y el otro se calcula solo (gris). */}
                      {verGancho && (l.mandaPie && lineaAlGancho(e)
                        ? <td className="p-1 w-28"><Input type="text" className="text-right text-gray-500" title="Calculado: importe ÷ kg gancho. Escribí acá para que mande el precio gancho." value={fmtAR(precioGanchoDerivado(e), 2)} onChange={ev => setPrecioQueManda(i, 'gancho', ev.target.value)} /></td>
                        : <td className="p-1 w-28"><Input type="text" className="text-right" placeholder="0,00" value={l.precioGancho} onChange={ev => setPrecioQueManda(i, 'gancho', ev.target.value)} onBlur={ev => setLinea(i, 'precioGancho', reformatear(ev.target.value))} /></td>)}
                      {lineaAlGancho(e) && !l.mandaPie
                        ? <td className="p-1 w-28"><Input type="text" className="text-right text-gray-500" title="Calculado: importe ÷ kg pie. Escribí acá el precio del kilo vivo (como liquida el frigorífico) y el gancho se recalcula." value={fmtAR(e.precio, 3)} onChange={ev => setPrecioQueManda(i, 'pie', ev.target.value)} /></td>
                        : <td className="p-1 w-28"><Input type="text" className="text-right" placeholder="0,00" value={l.precio} onChange={ev => verGancho ? setPrecioQueManda(i, 'pie', ev.target.value) : setLinea(i, 'precio', ev.target.value)} onBlur={ev => setLinea(i, 'precio', reformatear(ev.target.value))} /></td>}
                      <td className="p-1 text-right tabular-nums">{fmtAR(importeDeLinea(e))}</td>
                      <td className="p-1">{lineas.length > 1 && <Button size="sm" variant="ghost" onClick={() => setLineas(ls => ls.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="font-semibold">
                <tr>
                  <td className="p-1" colSpan={2}>Total</td>
                  <td className="p-1 text-right tabular-nums">{fmtAR(calc.cabezas, 0)}</td><td />
                  <td className="p-1 text-right tabular-nums">{fmtAR(calc.kilos, 0)}</td>
                  <td className="p-1 text-right tabular-nums">{calc.cabezas ? fmtAR(calc.promedio, 0) : '—'}</td>
                  {verGancho && <td className="p-1 text-right tabular-nums">{fmtAR(kgGanchoTotal, 1)}</td>}
                  {verGancho && <td />}<td />
                  <td className="p-1 text-right tabular-nums">{fmtAR(calc.bruto)}</td><td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ── Gastos, IVA y retenciones ── */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Gastos e IVA</h4>
            <div className="grid grid-cols-[1fr_5rem_9rem] gap-2 items-center text-sm">
              <span className="text-xs text-gray-400" /><span className="text-xs text-gray-400 text-right">%</span><span className="text-xs text-gray-400 text-right">monto</span>
              <span>Comisión venta y garantía{comisionMonto.trim() && <span className="ml-1 text-[10px] text-amber-700" title="Monto tipeado a mano: manda sobre el %">✎ manual · {fmtAR(calc.comisionPctEfectivo, 3)} %</span>}</span>
              <Input type="text" className="text-right" value={comisionPct} onChange={e => { setComisionPct(e.target.value); setComisionMonto('') }} placeholder="0" disabled={!!comisionMonto.trim()} />
              <Input type="text" className="text-right" value={comisionMonto} onChange={e => setComisionMonto(e.target.value)}
                onBlur={e => setComisionMonto(reformatear(e.target.value))} placeholder={fmtAR(calc.comision)}
                title="Vacío: se calcula con el %. Si la comisión del papel se calcula sobre otra cosa, tipeá el monto." />
              <span>Ajuste por redondeo (con signo)</span>
              <span />
              <Input type="text" className="text-right" value={redondeo} onChange={e => setRedondeo(e.target.value)} onBlur={e => setRedondeo(reformatear(e.target.value))} placeholder="-0,00" />
              <span className="font-medium">Neto gravado</span><span />
              <span className="text-right tabular-nums font-medium pr-3">{fmtAR(calc.netoGravado)}</span>
              <span>I.V.A.{ivaMonto.trim() && <span className="ml-1 text-[10px] text-amber-700">✎ manual · {fmtAR(calc.ivaPctEfectivo, 3)} %</span>}</span>
              <Input type="text" className="text-right" value={ivaPct} onChange={e => { setIvaPct(e.target.value); setIvaMonto('') }} disabled={!!ivaMonto.trim()} />
              <Input type="text" className="text-right" value={ivaMonto} onChange={e => setIvaMonto(e.target.value)}
                onBlur={e => setIvaMonto(reformatear(e.target.value))} placeholder={fmtAR(calc.iva)}
                title="Vacío: se calcula con el %. Con valor, manda el tipeado." />
            </div>
            <p className="text-xs text-gray-500">Precio después de comisión: <b>{calc.kilos ? fmtAR(calc.precioPostComision) : '—'} $/kg</b></p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Retenciones impresas</h4>
              <Button size="sm" variant="outline" onClick={() => setRets(rs => [...rs, { concepto: '', alicuota: '', importe: '' }])}><Plus className="h-3.5 w-3.5 mr-1" />Retención</Button>
            </div>
            {rets.map((r, i) => {
              const sug = retencionSugerida(calc.bruto, parsearPct(r.alicuota))
              return (
                <div key={i} className="grid grid-cols-[1fr_4.5rem_8rem_auto] gap-2 items-center">
                  <Input value={r.concepto} onChange={e => setRet(i, 'concepto', e.target.value)} placeholder="Concepto" />
                  <Input type="text" className="text-right" value={r.alicuota} onChange={e => setRet(i, 'alicuota', e.target.value)} placeholder="%" />
                  <Input type="text" className="text-right" value={r.importe} onChange={e => setRet(i, 'importe', e.target.value)} onBlur={e => setRet(i, 'importe', reformatear(e.target.value))}
                    placeholder={sug ? fmtAR(sug) : '0,00'} title={sug ? 'Sugerido: ' + fmtAR(sug) + ' (alícuota sobre el bruto)' : ''} />
                  <div className="flex gap-1">
                    {!r.importe && sug > 0 && <Button size="sm" variant="ghost" className="text-xs px-1" onClick={() => setRet(i, 'importe', fmtAR(sug))} title="Usar el sugerido">usar</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setRets(rs => rs.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )
            })}
            <p className="text-xs text-gray-500">La retención de Ingresos Brutos se calcula sobre el <b>bruto</b>. Un certificado que llegue aparte se carga después con el botón % de Comprobantes.</p>
          </div>
        </section>

        {/* ── Totales, con ✓ / ✗ contra el papel ── */}
        <section className="rounded border p-3 grid md:grid-cols-3 gap-3 text-sm">
          {([['bruto', 'Importe bruto', calc.bruto, ''], ['neto', 'Neto gravado', calc.netoGravado, ''], ['importe', 'Importe neto (lo que se cobra)', calc.importeNeto, 'text-green-700']] as const).map(([id, rotulo, valor, color]) => (
            <div key={id}>
              <span className="text-gray-500">{rotulo}</span>
              <div className={'text-lg font-semibold tabular-nums ' + color}>{fmtAR(valor)}</div>
              <div className="mt-1 flex gap-1">
                <Button type="button" size="sm" variant={verif[id] === 'ok' ? 'default' : 'outline'}
                  className={'h-7 px-2 text-xs ' + (verif[id] === 'ok' ? 'bg-green-600 hover:bg-green-700' : '')}
                  onClick={() => setVerif(v => ({ ...v, [id]: v[id] === 'ok' ? null : 'ok' }))} title="El papel dice lo mismo">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Coincide
                </Button>
                <Button type="button" size="sm" variant={verif[id] === 'distinto' ? 'default' : 'outline'}
                  className={'h-7 px-2 text-xs ' + (verif[id] === 'distinto' ? 'bg-amber-600 hover:bg-amber-700' : '')}
                  onClick={() => setVerif(v => ({ ...v, [id]: v[id] === 'distinto' ? null : 'distinto' }))} title="El papel dice otro número">
                  ✗ Distinto
                </Button>
              </div>
              {verif[id] === 'distinto' && (
                <Input type="text" className="mt-1 h-7 text-right text-xs" value={papel[id]} placeholder="lo que dice el papel"
                  onChange={e => setPapel(pp => ({ ...pp, [id]: e.target.value }))}
                  onBlur={e => setPapel(pp => ({ ...pp, [id]: reformatear(e.target.value) }))} />
              )}
            </div>
          ))}
          <p className="md:col-span-3 text-xs text-gray-500">Si el papel dice otra cosa, buscá el dato que difiere —kilos, precio, comisión, IVA o una retención— y tipealo: todos se pueden escribir a mano, y la cuenta se rehace sola.</p>
        </section>

        {/* ── Plazos ── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Operaciones con plazo</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={repartirPlazos} title={plazoVenta ? 'Repartir según el plazo de la venta (' + plazoVenta + ')' : 'Repartir el importe neto'}>Repartir{plazoVenta ? ' ' + plazoVenta : ''}</Button>
              <Button size="sm" variant="outline" onClick={() => setPlazos(ps => [...ps, { dias: '', pct: '', vencimiento: '', importe: '' }])}><Plus className="h-3.5 w-3.5 mr-1" />Cuota</Button>
            </div>
          </div>
          {plazos.map((p, i) => (
            <div key={i} className="grid grid-cols-[5rem_5rem_10rem_10rem_6rem_auto] gap-2 items-center">
              <Input type="text" className="text-right" value={p.dias} onChange={e => setPlazo(i, 'dias', e.target.value)} placeholder="días" />
              <Input type="text" className="text-right" value={p.pct} onChange={e => setPlazo(i, 'pct', e.target.value)} placeholder="%" />
              <Input type="date" value={p.vencimiento} onChange={e => setPlazo(i, 'vencimiento', e.target.value)} />
              <Input type="text" className="text-right" value={p.importe} onChange={e => setPlazo(i, 'importe', e.target.value)} onBlur={e => setPlazo(i, 'importe', reformatear(e.target.value))} placeholder="0,00" />
              <span className={'text-xs ' + (p.estado === 'cobrado' ? 'text-green-700 font-medium' : 'text-gray-400')} title="Se marca en Ingresos → Cobros o en el Cash Flow">{p.estado === 'cobrado' ? '✓ cobrada' : 'a cobrar'}</span>
              <Button size="sm" variant="ghost" onClick={() => setPlazos(ps => ps.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </section>

        {/* ── Imputación contable ── */}
        <section className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cuenta contable</Label>
            {cuentaContable && !pickCuenta ? (
              <div className="flex items-center gap-2 border rounded px-2 py-1.5 text-sm bg-gray-50">
                <span className="flex-1 truncate" title={cuentaContable}>{cuentaContable}</span>
                <button type="button" className="text-blue-600 text-xs shrink-0" onClick={() => setPickCuenta(true)}>Cambiar</button>
              </div>
            ) : (
              <SelectorCuentaContable
                value={cuentaContable}
                onSelect={(cta) => { setCuentaContable(cta?.categ || null); setNroCuenta(cta?.nro_cuenta || null); setPickCuenta(false) }}
                cuitProveedor={consignatario.cuit || null}
                mostrarSinAsignar={true}
                placeholder="Sin cuenta — clic para asignar"
              />
            )}
          </div>
          <div>
            <Label>Centro de costo</Label>
            <CentroCostoCombobox value={centroCosto} onValueChange={setCentroCosto} className="h-9" />
          </div>
        </section>

        {/* ── Los avisos: se ven todos, los que cierran y los que no ── */}
        {avisos.length > 0 && (
          <section className={`rounded p-3 space-y-1 text-sm ${avisosActivos.length ? 'bg-amber-50 border border-amber-300' : 'bg-green-50 border border-green-200'}`}>
            {avisos.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 ${a.nivel === 'ok' ? 'text-green-700' : 'text-amber-800'}`}>
                {a.nivel === 'ok' ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{a.mensaje}{a.diferencia !== undefined && a.nivel === 'aviso' && <> — diferencia <b className="tabular-nums">{fmtAR(a.diferencia)}</b></>}</span>
              </div>
            ))}
            {avisosActivos.length > 0 && <p className="text-xs text-amber-700 pt-1">Podés guardar igual: es un aviso, no un error. Si la diferencia tiene explicación —un precio pactado distinto, un papel con otro dato—, la decisión es tuya.</p>}
          </section>
        )}
        </>)}

        <DialogFooter className="gap-2">
          {!cargando && faltan.length > 0 && <span className="text-xs text-gray-500 mr-auto">Falta {faltan.join(', ')}.</span>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={cargando || guardando || faltan.length > 0} className="bg-green-600 hover:bg-green-700">
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Guardar liquidación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
