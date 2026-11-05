"use client"

/**
 * ✍️ Provisionar A MANO una factura de fecha POSTERIOR al cierre — A-FEAT-1331 (2026-10-23), compras y ventas desde A-FEAT-1564.
 *
 * La regla automática ya provisiona la factura con fecha del ejercicio que entró en un subdiario
 * posterior. Esto es para el otro caso, que el usuario quiere decidir uno por uno: *«poder decir a la
 * app que quiero registrar facturas a provisionar de fechas post balance… me deberá pedir por qué… está
 * destinado a cosas muy específicas y no todos los servicios brindados en junio facturados en julio»*.
 *
 * 🧾 A-FEAT-1564 (JMS 05/11): *«debería provisionar una venta de julio… eso en el panel de trabajo de la app debería tenerlo muy
 * a mano: poder recorrer subdiarios para elegir FC, o todas ordenadas por fecha y listo; buscadores, etc.»* → dos pestañas
 * (compras → papel 05 · ventas → papel 03.1), la lista ordenada por fecha apenas se abre, filtro por subdiario y buscador
 * por nombre, número o importe.
 *
 * Se guarda en `public.ajustes_balance` con `accion = 'incluir'`, apuntando a la factura (`tabla` +
 * `registro_id`), con el motivo obligatorio. No se borra: se anula con motivo, como los saldos del
 * ejercicio anterior. No toca la factura.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ahoraISO } from "@/lib/fechas"
import type { AjusteBalance } from "@/lib/balance/ajustes-balance"
import { filtrarComprobantes, type ComprobanteElegible } from "@/lib/balance/provision-manual-filtro"

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dmy = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "")

/** El valor de `tabla` con que se guarda: el schema de la empresa + la tabla de facturas. */
export const tablaFacturas = (schema: string) => `${schema}.comprobantes_arca`
/** 🧾 A-FEAT-1564: las ventas provisionadas a mano apuntan a esta tabla. */
export const tablaVentas = (schema: string) => `${schema}.comprobantes_venta`

type Lado = "compras" | "ventas"

/** Total en pesos de una factura (las de dólares, con su cotización — igual que el libro diario). */
function totalEnPesos(f: Record<string, unknown>): number {
  const t = Number(f.imp_total) || 0
  const m = String(f.moneda ?? "")
  return m === "USD" || m === "DOL" ? t * (Number(f.tipo_cambio) || 1) : t
}

/** Lo que distingue a compras y ventas: tabla, columnas y a qué papel van. */
const LADOS: Record<Lado, { tabla: string; select: string; fecha: string; nombre: string; papel: string; quien: string }> = {
  compras: {
    tabla: "comprobantes_arca", fecha: "fecha_emision", nombre: "denominacion_emisor", papel: "05 Provisión", quien: "Proveedor",
    select: "id, fecha_emision, denominacion_emisor, punto_venta, numero_desde, imp_total, moneda, tipo_cambio, cuenta_contable, año_contable, mes_contable",
  },
  ventas: {
    tabla: "comprobantes_venta", fecha: "fecha_liquidacion", nombre: "denominacion_cliente", papel: "03.1 Provisión de cobros", quien: "Cliente",
    // las ventas se registran en pesos (el libro diario usa `imp_total` tal cual)
    select: "id, fecha_liquidacion, denominacion_cliente, punto_venta, numero_desde, nro_comprobante, imp_total, cuenta_contable, año_contable, mes_contable",
  },
}

function aElegible(lado: Lado, f: Record<string, unknown>): ComprobanteElegible {
  const L = LADOS[lado]
  const anio = f["año_contable"] as number | null, mes = f.mes_contable as number | null
  return {
    id: String(f.id), fecha: String(f[L.fecha] ?? "").slice(0, 10), nombre: String(f[L.nombre] ?? ""),
    numero: lado === "ventas" && f.nro_comprobante ? String(f.nro_comprobante) : `${f.punto_venta ?? ""}-${f.numero_desde ?? ""}`,
    total: lado === "ventas" ? Number(f.imp_total) || 0 : totalEnPesos(f),
    subdiario: anio && mes ? `${anio}-${String(mes).padStart(2, "0")}` : null,
    cuenta: (f.cuenta_contable as string | null) ?? null,
  }
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
  const [lado, setLado] = useState<Lado>("compras")
  const [todos, setTodos] = useState<ComprobanteElegible[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [subdiario, setSubdiario] = useState<string>("")
  const [elegida, setElegida] = useState<ComprobanteElegible | null>(null)
  const [motivo, setMotivo] = useState("")
  const [anulando, setAnulando] = useState<string | null>(null)
  const [motivoAnular, setMotivoAnular] = useState("")
  const motivoPorDefecto = lado === "ventas"
    ? `Venta de algo entregado en el ejercicio ${etiqueta}, facturada después del cierre`
    : `Facturación de un servicio brindado en el ejercicio ${etiqueta}`
  const tablaDe = (l: Lado) => (l === "ventas" ? tablaVentas(schema) : tablaFacturas(schema))

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("ajustes_balance").select("*")
      .eq("empresa", empresa).eq("anio_cierre", anioCierre).eq("accion", "incluir")
      .in("tabla", [tablaFacturas(schema), tablaVentas(schema)]).order("created_at")
    if (error) { setError(error.message); setLista([]); return }
    setError(null)
    setLista((data || []) as AjusteBalance[])
  }, [empresa, schema, anioCierre])
  useEffect(() => { cargar() }, [cargar])

  /** Al abrir (o cambiar de pestaña) se traen TODAS las posteriores al cierre, ordenadas por fecha: se recorren sin buscar. */
  const traer = useCallback(async (l: Lado) => {
    const L = LADOS[l]
    setCargando(true)
    const { data, error } = await supabase.schema(schema).from(L.tabla).select(L.select)
      .gt(L.fecha, fechaCierre).order(L.fecha).limit(1000)
    setCargando(false)
    if (error) { toast.error("No se pudieron traer las facturas: " + error.message); setTodos([]); return }
    setTodos(((data || []) as unknown as Record<string, unknown>[]).map(f => aElegible(l, f)))
  }, [schema, fechaCierre])
  useEffect(() => { if (abierto) traer(lado) }, [abierto, lado, traer])

  const yaProvisionadas = useMemo(() => new Set(lista.filter(a => !a.anulado_at && a.tabla === tablaDe(lado)).map(a => a.registro_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lista, lado, schema])
  const subdiarios = useMemo(() => [...new Set(todos.map(t => t.subdiario ?? "sin"))].sort(), [todos])
  const visibles = useMemo(() => filtrarComprobantes(todos.filter(t => !yaProvisionadas.has(t.id)), busqueda, subdiario || null),
    [todos, yaProvisionadas, busqueda, subdiario])

  const provisionar = async () => {
    if (!elegida) return
    const m = motivo.trim() || motivoPorDefecto
    const total = Math.round(elegida.total * 100) / 100
    const { error } = await supabase.from("ajustes_balance").insert({
      empresa, anio_cierre: anioCierre, accion: "incluir",
      concepto: `Provisión${lado === "ventas" ? " de venta" : ""}: ${elegida.nombre} ${elegida.numero} del ${dmy(elegida.fecha)}`,
      categ: elegida.cuenta || null, monto: total, valor_sistema: total, motivo: m,
      tabla: tablaDe(lado), registro_id: elegida.id,
    })
    if (error) { toast.error("No se pudo provisionar: " + error.message); return }
    toast.success(`${lado === "ventas" ? "Venta" : "Factura"} provisionada. Volvé a armar el libro para verla en el papel ${LADOS[lado].papel}.`)
    setElegida(null); setMotivo(""); setBusqueda(""); setAbierto(false)
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
  const esVenta = (a: AjusteBalance) => a.tabla === tablaVentas(schema)
  const totalDe = (ventas: boolean) => vigentes.filter(a => esVenta(a) === ventas).reduce((s, a) => s + Number(a.monto), 0)

  return (
    <div className="rounded border border-gray-200 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
        <b>✍️ Provisión puesta a mano — {empresa} {etiqueta}</b>
        <span className="text-xs text-gray-500">facturas de fecha posterior al cierre que son de este ejercicio · compras al papel 05, ventas al 03.1</span>
      </div>
      {error && <p className="text-red-700">No se pudieron leer: {error}</p>}
      {!error && vigentes.length === 0 && <p className="text-xs text-gray-500">No hay facturas provisionadas a mano.</p>}
      {vigentes.map(a => (
        <div key={a.id} className="flex flex-wrap items-start gap-2 border-b border-gray-100 py-1">
          <span className={`rounded px-1.5 text-[10px] font-semibold ${esVenta(a) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
            {esVenta(a) ? "VENTA" : "COMPRA"}
          </span>
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
        <div className="flex flex-wrap justify-end gap-4 pt-1 font-semibold">
          {totalDe(false) !== 0 && <span>Compras <span className="font-mono">${fmt(totalDe(false))}</span></span>}
          {totalDe(true) !== 0 && <span>Ventas <span className="font-mono">${fmt(totalDe(true))}</span></span>}
        </div>
      )}

      {abierto ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {(["compras", "ventas"] as const).map(l => (
              <button key={l} type="button" onClick={() => { setLado(l); setElegida(null); setSubdiario(""); setBusqueda("") }}
                className={`rounded px-3 py-1 text-xs font-medium ${lado === l ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                {l === "compras" ? "🧾 Compras (papel 05)" : "💰 Ventas (papel 03.1)"}
              </button>
            ))}
            <button type="button" className="ml-auto text-xs text-gray-500 underline" onClick={() => { setAbierto(false); setElegida(null) }}>cerrar</button>
          </div>
          {!elegida ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder={`${LADOS[lado].quien}, número o importe (1.234,56)`} className="h-8 w-72 text-sm" />
                <select value={subdiario} onChange={e => setSubdiario(e.target.value)} className="h-8 rounded border px-2 text-xs">
                  <option value="">Todos los subdiarios</option>
                  {subdiarios.map(s => <option key={s} value={s}>{s === "sin" ? "Sin subdiario" : `Subdiario ${s.split("-").reverse().join("/")}`}</option>)}
                </select>
                <span className="self-center text-xs text-gray-500">
                  {cargando ? "trayendo…" : `${visibles.length} de ${todos.length} posteriores al ${dmy(fechaCierre)}, por fecha`}
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto rounded border">
                {!cargando && visibles.length === 0 && <p className="p-2 text-xs text-gray-500">No hay {lado} posteriores al cierre con ese filtro.</p>}
                {visibles.map(f => (
                  <button key={f.id} type="button" onClick={() => setElegida(f)}
                    className="flex w-full justify-between gap-2 border-b px-2 py-1 text-left text-xs hover:bg-blue-50">
                    <span>{dmy(f.fecha)} · {f.nombre} · {f.numero}
                      <span className="text-gray-500"> · {f.subdiario ? `subdiario ${f.subdiario.split("-").reverse().join("/")}` : "sin subdiario"}</span>
                    </span>
                    <span className="font-mono">${fmt(f.total)}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2 rounded border border-blue-200 bg-blue-50/50 p-2">
              <div className="text-xs">
                <b>{lado === "ventas" ? "Venta" : "Compra"}: {elegida.nombre}</b> {elegida.numero} del {dmy(elegida.fecha)} ·
                <span className="font-mono"> ${fmt(elegida.total)}</span> → papel {LADOS[lado].papel}
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
        <Button size="sm" variant="outline" className="mt-2" onClick={() => setAbierto(true)} disabled={!!error}>+ Provisionar una compra o venta posterior al cierre</Button>
      )}
      {anulados.length > 0 && <p className="mt-2 text-xs text-gray-500">{anulados.length} anulada(s): no suman.</p>}
    </div>
  )
}
