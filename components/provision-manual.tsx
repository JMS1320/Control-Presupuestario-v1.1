"use client"

/**
 * ✍️ Provisionar A MANO una factura de fecha POSTERIOR al cierre — A-FEAT-1331 (2026-10-23).
 *
 * La regla automática ya provisiona la factura con fecha del ejercicio que entró en un subdiario
 * posterior. Esto es para el otro caso, que el usuario quiere decidir uno por uno: *«poder decir a la
 * app que quiero registrar facturas a provisionar de fechas post balance… me deberá pedir por qué… está
 * destinado a cosas muy específicas y no todos los servicios brindados en junio facturados en julio»*.
 *
 * Se guarda en `public.ajustes_balance` con `accion = 'incluir'`, apuntando a la factura (`tabla` +
 * `registro_id`), con el motivo obligatorio. No se borra: se anula con motivo, como los saldos del
 * ejercicio anterior. No toca la factura.
 */

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ahoraISO } from "@/lib/fechas"
import type { AjusteBalance } from "@/lib/balance/ajustes-balance"

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dmy = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "")

/** El valor de `tabla` con que se guarda: el schema de la empresa + la tabla de facturas. */
export const tablaFacturas = (schema: string) => `${schema}.comprobantes_arca`

/** Total en pesos de una factura (las de dólares, con su cotización — igual que el libro diario). */
function totalEnPesos(f: Record<string, unknown>): number {
  const t = Number(f.imp_total) || 0
  const m = String(f.moneda ?? "")
  return m === "USD" || m === "DOL" ? t * (Number(f.tipo_cambio) || 1) : t
}

interface Factura {
  id: string
  fecha_emision: string
  denominacion_emisor: string
  punto_venta: number | null
  numero_desde: number | null
  imp_total: number
  moneda: string | null
  tipo_cambio: number | null
  cuenta_contable: string | null
  "año_contable": number | null
  mes_contable: number | null
}

export function ProvisionManual({ empresa, schema, anioCierre, fechaCierre, etiqueta, onCambio }: {
  empresa: string
  schema: string
  anioCierre: number
  /** `AAAA-MM-DD`: sólo se ofrecen facturas POSTERIORES a esta fecha. */
  fechaCierre: string
  etiqueta: string
  onCambio?: () => void
}) {
  const [lista, setLista] = useState<AjusteBalance[]>([])
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<Factura[]>([])
  const [elegida, setElegida] = useState<Factura | null>(null)
  const [motivo, setMotivo] = useState("")
  const [anulando, setAnulando] = useState<string | null>(null)
  const [motivoAnular, setMotivoAnular] = useState("")
  const motivoPorDefecto = `Facturación de un servicio brindado en el ejercicio ${etiqueta}`

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("ajustes_balance").select("*")
      .eq("empresa", empresa).eq("anio_cierre", anioCierre).eq("accion", "incluir")
      .eq("tabla", tablaFacturas(schema)).order("created_at")
    if (error) { setError(error.message); setLista([]); return }
    setError(null)
    setLista((data || []) as AjusteBalance[])
  }, [empresa, schema, anioCierre])
  useEffect(() => { cargar() }, [cargar])

  const buscar = async () => {
    const q = busqueda.trim()
    let consulta = supabase.schema(schema).from("comprobantes_arca")
      .select("id, fecha_emision, denominacion_emisor, punto_venta, numero_desde, imp_total, moneda, tipo_cambio, cuenta_contable, año_contable, mes_contable")
      .gt("fecha_emision", fechaCierre).order("fecha_emision").limit(40)
    if (q) {
      consulta = /^\d+$/.test(q)
        ? consulta.or(`numero_desde.eq.${q},denominacion_emisor.ilike.%${q}%`)
        : consulta.ilike("denominacion_emisor", `%${q}%`)
    }
    const { data, error } = await consulta
    if (error) { toast.error("No se pudo buscar: " + error.message); return }
    const ya = new Set(lista.filter(a => !a.anulado_at).map(a => a.registro_id))
    setResultados(((data || []) as unknown as Factura[]).filter(f => !ya.has(String(f.id))))
  }

  const provisionar = async () => {
    if (!elegida) return
    const m = motivo.trim() || motivoPorDefecto
    const total = Math.round(totalEnPesos(elegida as unknown as Record<string, unknown>) * 100) / 100
    const { error } = await supabase.from("ajustes_balance").insert({
      empresa, anio_cierre: anioCierre, accion: "incluir",
      concepto: `Provisión: ${elegida.denominacion_emisor} ${elegida.punto_venta ?? ""}-${elegida.numero_desde ?? ""} del ${dmy(elegida.fecha_emision)}`,
      categ: elegida.cuenta_contable || null, monto: total, valor_sistema: total, motivo: m,
      tabla: tablaFacturas(schema), registro_id: String(elegida.id),
    })
    if (error) { toast.error("No se pudo provisionar: " + error.message); return }
    toast.success("Factura provisionada. Volvé a armar el libro para verla en el papel 05.")
    setElegida(null); setMotivo(""); setResultados([]); setBusqueda(""); setAbierto(false)
    await cargar()
    onCambio?.()
  }

  const anular = async (id: string) => {
    if (!motivoAnular.trim()) { toast.error("Escribí por qué se anula"); return }
    const { error } = await supabase.from("ajustes_balance")
      .update({ anulado_at: ahoraISO(), anulado_motivo: motivoAnular.trim() }).eq("id", id)
    if (error) { toast.error("No se pudo anular: " + error.message); return }
    setAnulando(null); setMotivoAnular("")
    await cargar()
    onCambio?.()
  }

  const vigentes = lista.filter(a => !a.anulado_at)
  const anulados = lista.filter(a => !!a.anulado_at)
  const total = vigentes.reduce((s, a) => s + Number(a.monto), 0)

  return (
    <div className="rounded border border-gray-200 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
        <b>✍️ Provisión puesta a mano — {empresa} {etiqueta}</b>
        <span className="text-xs text-gray-500">facturas de fecha posterior al cierre que son de este ejercicio · salen en el papel 05</span>
      </div>
      {error && <p className="text-red-700">No se pudieron leer: {error}</p>}
      {!error && vigentes.length === 0 && <p className="text-xs text-gray-500">No hay facturas provisionadas a mano.</p>}
      {vigentes.map(a => (
        <div key={a.id} className="flex flex-wrap items-start gap-2 border-b border-gray-100 py-1">
          <span className="flex-1">{a.concepto} <span className="text-xs text-gray-500">· {a.motivo}</span></span>
          <span className="font-mono">${fmt(Number(a.monto))}</span>
          {anulando === a.id ? (
            <span className="flex items-center gap-1">
              <Input value={motivoAnular} onChange={e => setMotivoAnular(e.target.value)} placeholder="por qué se anula" className="h-7 w-56 text-xs" />
              <Button size="sm" className="h-7 text-xs" onClick={() => anular(a.id)}>Anular</Button>
              <button type="button" className="text-xs text-gray-500 underline" onClick={() => { setAnulando(null); setMotivoAnular("") }}>cancelar</button>
            </span>
          ) : (
            <button type="button" className="text-xs text-blue-700 underline" onClick={() => { setAnulando(a.id); setMotivoAnular("") }}>anular</button>
          )}
        </div>
      ))}
      {vigentes.length > 0 && (
        <div className="flex justify-end gap-2 pt-1 font-semibold"><span>Total</span><span className="font-mono">${fmt(total)}</span></div>
      )}

      {abierto ? (
        <div className="mt-2 space-y-2">
          {!elegida ? (
            <>
              <div className="flex gap-2">
                <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} onKeyDown={e => { if (e.key === "Enter") buscar() }}
                  placeholder={`Proveedor o número — facturas posteriores al ${dmy(fechaCierre)}`} className="h-8 text-sm" />
                <Button size="sm" onClick={buscar}>Buscar</Button>
                <button type="button" className="text-xs text-gray-500 underline" onClick={() => { setAbierto(false); setResultados([]) }}>cancelar</button>
              </div>
              {resultados.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded border">
                  {resultados.map(f => (
                    <button key={f.id} type="button" onClick={() => setElegida(f)}
                      className="flex w-full justify-between gap-2 border-b px-2 py-1 text-left text-xs hover:bg-blue-50">
                      <span>{dmy(f.fecha_emision)} · {f.denominacion_emisor} · {f.punto_venta}-{f.numero_desde}
                        <span className="text-gray-500"> · {f["año_contable"] && f.mes_contable ? `subdiario ${String(f.mes_contable).padStart(2, "0")}/${f["año_contable"]}` : "sin subdiario"}</span>
                      </span>
                      <span className="font-mono">${fmt(totalEnPesos(f as unknown as Record<string, unknown>))}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 rounded border border-blue-200 bg-blue-50/50 p-2">
              <div className="text-xs">
                <b>{elegida.denominacion_emisor}</b> {elegida.punto_venta}-{elegida.numero_desde} del {dmy(elegida.fecha_emision)} ·
                <span className="font-mono"> ${fmt(totalEnPesos(elegida as unknown as Record<string, unknown>))}</span>
              </div>
              <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={`¿Por qué? (por defecto: ${motivoPorDefecto})`} className="h-8 text-sm" autoFocus />
              <div className="flex gap-2">
                <Button size="sm" onClick={provisionar}>Provisionar</Button>
                <button type="button" className="text-xs text-gray-500 underline" onClick={() => setElegida(null)}>elegir otra</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-2" onClick={() => setAbierto(true)} disabled={!!error}>+ Provisionar una factura posterior al cierre</Button>
      )}
      {anulados.length > 0 && <p className="mt-2 text-xs text-gray-500">{anulados.length} anulada(s): no suman.</p>}
    </div>
  )
}
