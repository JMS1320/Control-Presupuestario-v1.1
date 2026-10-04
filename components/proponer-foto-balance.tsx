"use client"

/**
 * 📸 PASAR LOS PAPELES A LA FOTO DEL BALANCE PROPIO — A-FEAT-1190 (2026-10-03).
 *
 * Pedido del usuario: *«que la foto del 30/6/26 se arme sola»*. Toma lo que YA calcularon los papeles
 * de trabajo (bancos, cuentas a pagar y a cobrar, cheques, anticipos, hacienda, insumos, granos,
 * sementeras) y lo guarda como la versión **Sistema** de la foto de ese cierre. La versión JMS toma
 * esos valores en los renglones que deja vacíos (default del dato real) y los pisa donde escribe.
 *
 * 🔔 Si la foto ya tenía valores del sistema y hoy el sistema dice otra cosa, **se muestra la
 * diferencia y no se pisa sola**: se actualiza sólo si el usuario aprieta el botón.
 */
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import {
  RENGLONES, propuestaDelSistema, cambiosContraLoGuardado, deudaDeTarjeta, parsearMonto,
  type DatosDeLosPapeles, type ValorFoto,
} from "@/lib/balance/balance-propio"

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const etiqueta = (id: string) => RENGLONES.find(r => r.id === id)?.etiqueta ?? id
const fmtFecha = (f: string) => f.split("-").reverse().join("/")

export function ProponerFotoBalance({ empresa, fechaInicio, fechaCierre, datos, iva, fciMovimientos }: {
  empresa: string
  /** Primer día del ejercicio: las retenciones se cuentan desde acá. */
  fechaInicio: string
  fechaCierre: string
  datos: DatosDeLosPapeles
  /** Crédito y débito fiscal del ejercicio, del libro diario (con signo). */
  iva: { creditoFiscal: number; debitoFiscal: number } | null
  /** Suscripciones y rescates del fondo común en el ejercicio (papel 07). */
  fciMovimientos: { suscripciones: number; rescates: number } | null
}) {
  /**
   * Lo que no sale de los papeles y se lee acá: retenciones que nos hicieron, echeqs en cartera, la
   * tarjeta y el saldo técnico de IVA de la foto anterior. Son tablas de MSA; para otra empresa que
   * no las tenga, cada una se omite y se dice.
   */
  const [extra, setExtra] = useState<Partial<DatosDeLosPapeles>>({})
  const [noLeidas, setNoLeidas] = useState<string[]>([])
  const [cuotapartes, setCuotapartes] = useState("")
  const [valorCuota, setValorCuota] = useState("")

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const sch = empresa.toLowerCase()
      const fallas: string[] = []
      const e: Partial<DatosDeLosPapeles> = {}
      const suma = (xs: any[], f: (x: any) => unknown) => xs.reduce((a, x) => a + (Number(f(x)) || 0), 0)
      try {
        const [rr, cv] = await Promise.all([
          supabase.schema(sch).from("retenciones_recibidas").select("tipo, monto, fecha").gte("fecha", fechaInicio).lte("fecha", fechaCierre),
          supabase.schema(sch).from("comprobantes_venta").select("ret_iva, ret_iibb, fecha_liquidacion").gte("fecha_liquidacion", fechaInicio).lte("fecha_liquidacion", fechaCierre),
        ])
        if (rr.error) throw rr.error
        if (cv.error) throw cv.error
        const rec = (rr.data ?? []) as any[], liq = (cv.data ?? []) as any[]
        e.retenciones = {
          ganancias: suma(rec.filter(x => x.tipo === "ganancias"), x => x.monto),
          iibb: suma(rec.filter(x => x.tipo === "iibb"), x => x.monto) + suma(liq, x => x.ret_iibb),
          iva: suma(rec.filter(x => x.tipo === "iva"), x => x.monto) + suma(liq, x => x.ret_iva),
          detalle: `${rec.length} retención(es) cargadas en cobros + ${liq.length} liquidación(es) de venta del sistema`,
        }
      } catch { fallas.push("retenciones") }
      try {
        const { data, error } = await supabase.schema(sch).from("echeqs_terceros").select("debitos, creditos").lte("fecha", fechaCierre)
        if (error) throw error
        e.echeqsCartera = suma((data ?? []) as any[], x => (Number(x.creditos) || 0) - (Number(x.debitos) || 0))
      } catch { fallas.push("echeqs de terceros") }
      try {
        const { data, error } = await supabase.schema(sch).from("tarjeta_visa_business")
          .select("tipo_fila, fecha, debitos, creditos, fecha_cierre, fecha_vencimiento")
        if (error) throw error
        const filas = (data ?? []) as any[]
        e.tarjeta = deudaDeTarjeta(
          filas.filter(f => f.tipo_fila === "resumen" && f.fecha_cierre && f.fecha_vencimiento)
            .map(f => ({ cierre: f.fecha_cierre, vencimiento: f.fecha_vencimiento, total: Number(f.debitos) || 0 })),
          filas.filter(f => f.tipo_fila === "movimiento")
            .map(f => ({ fecha: f.fecha, importe: (Number(f.debitos) || 0) - (Number(f.creditos) || 0), cierreResumen: f.fecha_cierre ?? null })),
          fechaCierre)
      } catch { fallas.push("tarjeta") }
      try {
        // Anticipos de Ganancias: las cuotas pagadas en el ejercicio del template de la empresa.
        const { data, error } = await supabase.from("cuotas_egresos_sin_factura")
          .select("monto, estado, fecha_estimada, egreso:egresos_sin_factura!inner(nombre_referencia, responsable)")
          .gte("fecha_estimada", fechaInicio).lte("fecha_estimada", fechaCierre)
          .ilike("egreso.nombre_referencia", "%anticipo%ganancia%").eq("egreso.responsable", empresa)
        if (error) throw error
        const pagadas = ((data ?? []) as any[]).filter(c => ["pagado", "conciliado", "debitado"].includes(String(c.estado)))
        e.anticiposGanancias = {
          total: suma(pagadas, c => c.monto), cuotas: pagadas.length,
          detalle: `anticipos de Ganancias pagados en el ejercicio: ${pagadas.length} cuota(s) del template «Anticipo Ganancias ${empresa}»`,
        }
      } catch { fallas.push("anticipos de Ganancias") }
      // El saldo técnico de IVA al inicio sale de la foto ANTERIOR (contador primero, si no JMS).
      let tecnicoInicio: number | null = null
      const { data: ant } = await supabase.from("balance_fotos").select("id")
        .eq("empresa", empresa).lt("fecha_cierre", fechaCierre).order("fecha_cierre", { ascending: false }).limit(1).maybeSingle()
      if (ant) {
        const { data: vs } = await supabase.from("balance_foto_valores").select("version, importe")
          .eq("foto_id", ant.id).eq("renglon", "iva_saldo_tecnico")
        const v = (vs ?? []) as any[]
        const c = v.find(x => x.version === "contador") ?? v.find(x => x.version === "jms")
        tecnicoInicio = c ? Number(c.importe) : null
      }
      if (iva) e.iva = { ...iva, tecnicoInicio }
      if (vivo) { setExtra(e); setNoLeidas(fallas) }
    })()
    return () => { vivo = false }
  }, [empresa, fechaInicio, fechaCierre, iva])

  const datosCompletos = useMemo<DatosDeLosPapeles>(() => ({
    ...datos, ...extra,
    fci: fciMovimientos ? { ...fciMovimientos, cuotapartes: parsearMonto(cuotapartes), valorCuotaparte: parsearMonto(valorCuota) } : undefined,
  }), [datos, extra, fciMovimientos, cuotapartes, valorCuota])
  const { valores: propuesta, faltan } = useMemo(() => propuestaDelSistema(datosCompletos), [datosCompletos])
  const [guardado, setGuardado] = useState<ValorFoto[] | null>(null)
  const [fotoId, setFotoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const leer = async () => {
    const { data: f } = await supabase.from("balance_fotos").select("id")
      .eq("empresa", empresa).eq("fecha_cierre", fechaCierre).maybeSingle()
    setFotoId(f?.id ?? null)
    if (!f) { setGuardado([]); return }
    const { data: vs } = await supabase.from("balance_foto_valores").select("renglon, version, importe")
      .eq("foto_id", f.id).eq("version", "sistema")
    setGuardado(((vs || []) as any[]).map(v => ({ ...v, importe: Number(v.importe) })))
  }
  useEffect(() => { void leer() }, [empresa, fechaCierre]) // eslint-disable-line react-hooks/exhaustive-deps

  const cambios = guardado ? cambiosContraLoGuardado(guardado, propuesta) : []
  const yaGuardada = !!guardado && guardado.length > 0

  const guardar = async () => {
    setGuardando(true)
    try {
      let id = fotoId
      if (!id) {
        // El TC se propone del dólar BNA importado a la fecha (o el anterior más cercano).
        const { data: cot } = await supabase.from("cotizaciones").select("valor, fecha")
          .eq("serie", "dolar_bna_divisas").lte("fecha", fechaCierre)
          .order("fecha", { ascending: false }).limit(1).maybeSingle()
        const { data: nueva, error } = await supabase.from("balance_fotos").insert({
          empresa, fecha_cierre: fechaCierre, tc: cot?.valor ?? null,
          tc_fuente: cot ? `dolar_bna_divisas del ${fmtFecha(cot.fecha)}` : null,
          notas: "Armada desde los papeles de trabajo (versión Sistema).",
        }).select("id").single()
        if (error) throw error
        id = nueva.id
      }
      const filas = propuesta.map(p => ({
        foto_id: id, renglon: p.renglon, version: "sistema", importe: p.importe,
        origen: "sistema", valor_sistema: p.importe, detalle: p.detalle, updated_at: new Date().toISOString(),
      }))
      if (filas.length) {
        const { error } = await supabase.from("balance_foto_valores").upsert(filas, { onConflict: "foto_id,renglon,version" })
        if (error) throw error
      }
      // Un renglón que el sistema ya no propone sale de la versión Sistema (no toca las otras).
      const sobran = cambios.filter(c => c.hoy === null).map(c => c.renglon)
      if (sobran.length) {
        const { error } = await supabase.from("balance_foto_valores").delete()
          .eq("foto_id", id).eq("version", "sistema").in("renglon", sobran)
        if (error) throw error
      }
      toast.success(`Foto del ${fmtFecha(fechaCierre)}: ${filas.length} renglón(es) del sistema guardados. Miralos en «📸 Balance propio».`)
      await leer()
    } catch (err) { toast.error("No se pudo guardar en la foto: " + (err as Error).message) }
    finally { setGuardando(false) }
  }

  return (
    <div className="rounded border border-sky-200 bg-sky-50 p-3 text-xs space-y-2">
      <div className="font-semibold text-sm">📸 Pasar a la foto del balance propio — {empresa} al {fmtFecha(fechaCierre)}</div>
      {propuesta.length === 0 ? (
        <p className="text-gray-600">Todavía no hay nada para proponer: armá el libro y traé stock y precios.</p>
      ) : (
        <>
          <table className="w-full">
            <tbody>
              {propuesta.map(p => {
                const c = cambios.find(x => x.renglon === p.renglon)
                return (
                  <tr key={p.renglon} className="border-b border-sky-100">
                    <td className="py-0.5">{etiqueta(p.renglon)}<div className="text-gray-500">{p.detalle}</div></td>
                    <td className="text-right align-top">{fmt(p.importe)}
                      {yaGuardada && c && <div className="text-amber-700">en la foto: {c.guardado == null ? "—" : fmt(c.guardado)}</div>}
                    </td>
                  </tr>
                )
              })}
              {cambios.filter(c => c.hoy === null).map(c => (
                <tr key={c.renglon} className="text-amber-700">
                  <td>{etiqueta(c.renglon)} — el sistema ya no lo propone</td><td className="text-right">en la foto: {fmt(c.guardado ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fciMovimientos && (
            <div className="flex flex-wrap items-center gap-2">
              <span>Fondo común al cierre:</span>
              <Input type="text" className="h-7 w-36 text-right text-xs" placeholder="cuotapartes" value={cuotapartes} onChange={e => setCuotapartes(e.target.value)} />
              <span>×</span>
              <Input type="text" className="h-7 w-32 text-right text-xs" placeholder="valor cuotaparte" value={valorCuota} onChange={e => setValorCuota(e.target.value)} />
            </div>
          )}
          {faltan.length > 0 && (
            <ul className="list-disc pl-5 text-amber-800">{faltan.map((f, i) => <li key={i}>{f}</li>)}</ul>
          )}
          {noLeidas.length > 0 && <p className="text-amber-800">No se pudieron leer: {noLeidas.join(", ")}.</p>}
          <p className="text-gray-600">
            No se proponen (el sistema no los sabe; van a mano): percepciones de Ganancias, IVA de libre disponibilidad, deudas sociales, impuesto diferido.
          </p>
          {yaGuardada && cambios.length === 0 ? (
            <p className="text-emerald-700">✓ La foto ya tiene exactamente estos valores del sistema.</p>
          ) : (
            <div className="flex items-center gap-2">
              {yaGuardada && <span className="text-amber-700">⚠️ {cambios.length} renglón(es) cambiaron desde que se guardó la foto.</span>}
              <Button size="sm" onClick={() => void guardar()} disabled={guardando || guardado === null}>
                {guardando && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {yaGuardada ? "Actualizar la versión Sistema de la foto" : "Guardar en la foto (versión Sistema)"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
