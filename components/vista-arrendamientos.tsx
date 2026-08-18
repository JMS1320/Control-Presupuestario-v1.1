"use client"

// VENTAS → Arrendamiento. Contratos → cuotas → FIJAR (= vender).
// La fijación ES la venta: "Venta origina Factura/Liquidación que origina Cobro".
// Precio y TC se fijan en MOMENTOS DISTINTOS (salvo pizarra, que cierra en un acto).
// Fijar PARCIAL parte la cuota: una cuota se fija entera o se parte.
// Ver DISEÑO_PRESUPUESTO.md § INGRESOS — Arrendamientos agrícolas.

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CentroCostoCombobox } from "@/components/ui/centro-costo-combobox"
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2, Handshake, AlertTriangle } from "lucide-react"
import {
  tonsCuota, tonsTotales, pctCuota, tonsFijadas, estadoDerivado,
  resolverPrecio, resolverTC, estadoVenta, montoVenta, fechaCobroPizarra,
  validarGuardarrailQq,
  type PrecioGrano, type TipoCambio,
} from "@/lib/arrendamientos/calculo"

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

const parseAR = (v: string) => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0
const fmtAR = (n: number | null | undefined, dec = 2) =>
  n == null ? "—" : Number(n).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtPesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

interface Contrato {
  id: string; empresa: string; campania: string; centro_costo: string
  cliente_cuit: string | null; cliente_nombre: string
  has: number; qq_ha_total: number; grano: string; activo: boolean
  /** Días corridos entre fijación y cobro al vender disponible. Sanpa 15, default 20. */
  dias_cobro_disponible: number
}
interface Cuota {
  id: string; contrato_id: string; numero_cuota: number; qq_ha_cuota: number
  fecha_cobro_estimada: string; posicion_anio: number; posicion_mes: number
  estado: string; cuota_padre_id: string | null
}
interface Venta {
  id: string; cuota_id: string; tons: number; modo: "matba" | "pizarra"
  fecha_fijacion_precio: string | null; precio_usd: number | null
  fecha_fijacion_tc: string | null; tc: number | null
  precio_pesos: number | null; monto_pesos: number | null; fecha_cobro: string | null
}

/**
 * @param empresa filtra los contratos de esa empresa. Los contratos viven en `public` con una
 *   columna `empresa` (no hay una tabla por schema), así que acá es un filtro, no un cambio de
 *   schema. Sin `empresa` se muestran todos — que es como venía funcionando.
 */
export function VistaArrendamientos({ empresa }: { empresa?: 'MSA' | 'PAM' | 'MA' } = {}) {
  const [cargando, setCargando] = useState(true)
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [precios, setPrecios] = useState<PrecioGrano[]>([])
  const [tcs, setTcs] = useState<TipoCambio[]>([])
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})

  const [modalContrato, setModalContrato] = useState<Partial<Contrato> | null>(null)
  const [modalFijar, setModalFijar] = useState<{ cuota: Cuota; contrato: Contrato } | null>(null)
  const [modalTC, setModalTC] = useState<Venta | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      let q = supabase
        .from("contratos_arrendamiento").select("*").eq("activo", true)
      if (empresa) q = q.eq("empresa", empresa)
      const { data: cs } = await q.order("campania").order("centro_costo")
      const ids = (cs || []).map((c: any) => c.id)

      const [{ data: qs }, { data: ps }, { data: ts }] = await Promise.all([
        ids.length
          ? supabase.from("cuotas_arrendamiento").select("*").in("contrato_id", ids)
              .order("numero_cuota")
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("precios_granos").select("grano, anio, mes, precio_usd"),
        supabase.from("tipos_cambio").select("anio, mes, tc_presupuestado, tc_real"),
      ])

      const cuotaIds = (qs || []).map((q: any) => q.id)
      const { data: vs } = cuotaIds.length
        ? await supabase.from("ventas_arrendamiento").select("*").in("cuota_id", cuotaIds)
        : { data: [] as any[] }

      setContratos((cs || []) as Contrato[])
      setCuotas((qs || []) as Cuota[])
      setVentas((vs || []) as Venta[])
      setPrecios((ps || []) as PrecioGrano[])
      setTcs((ts || []) as TipoCambio[])
    } finally { setCargando(false) }
  }, [empresa])

  useEffect(() => { cargar() }, [cargar])

  const cuotasDe = (contratoId: string) => cuotas.filter(q => q.contrato_id === contratoId)
  const ventasDe = (cuotaId: string) => ventas.filter(v => v.cuota_id === cuotaId)

  // ── Guardar contrato ────────────────────────────────────────────────────────
  const guardarContrato = async (c: Partial<Contrato>) => {
    const payload = {
      empresa: c.empresa || "MSA",
      campania: c.campania,
      centro_costo: c.centro_costo,
      cliente_nombre: c.cliente_nombre,
      cliente_cuit: c.cliente_cuit || null,
      has: c.has, qq_ha_total: c.qq_ha_total,
      grano: c.grano || "soja",
      dias_cobro_disponible: c.dias_cobro_disponible ?? 20,
      updated_at: new Date().toISOString(),
    }
    const { error } = c.id
      ? await supabase.from("contratos_arrendamiento").update(payload).eq("id", c.id)
      : await supabase.from("contratos_arrendamiento").insert(payload)
    if (error) { alert("Error: " + error.message); return }
    setModalContrato(null)
    await cargar()
  }

  const bajaContrato = async (id: string) => {
    if (!confirm("¿Desactivar este contrato? Las cuotas y ventas quedan guardadas.")) return
    await supabase.from("contratos_arrendamiento").update({ activo: false }).eq("id", id)
    await cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Arrendamientos</h3>
          <p className="text-sm text-gray-500">
            Contratos cobrados en qq/ha. <strong>Fijar = vender</strong>: genera la venta y
            después la factura.
          </p>
        </div>
        {/* Un contrato nuevo nace en la empresa que estás mirando */}
        <Button size="sm" onClick={() => setModalContrato({ empresa: empresa || "MSA", grano: "soja" })}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo contrato
        </Button>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
        </div>
      ) : contratos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          No hay contratos cargados.
        </CardContent></Card>
      ) : contratos.map(c => {
        const qs = cuotasDe(c.id)
        const abierto = abiertos[c.id] ?? true
        const guard = validarGuardarrailQq(Number(c.qq_ha_total), qs)

        return (
          <Card key={c.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <button className="flex items-center gap-2 text-left"
                  onClick={() => setAbiertos(p => ({ ...p, [c.id]: !abierto }))}>
                  {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span>{c.centro_costo}</span>
                  <Badge variant="outline">{c.empresa}</Badge>
                  <Badge variant="outline">{c.campania}</Badge>
                  <span className="text-sm font-normal text-gray-500">
                    {c.cliente_nombre} · {fmtAR(c.has)} ha × {fmtAR(c.qq_ha_total)} qq/ha ={" "}
                    <strong>{fmtAR(tonsTotales(Number(c.has), Number(c.qq_ha_total)), 3)} tn</strong>
                  </span>
                </button>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setModalContrato(c)}>Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => bajaContrato(c.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              </CardTitle>

              {!guard.ok && (
                <p className="flex items-center gap-1 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Las cuotas suman {fmtAR(guard.suma)} qq/ha y el contrato dice {fmtAR(Number(c.qq_ha_total))}
                  {" "}(diferencia {fmtAR(guard.diferencia)}). Es sólo un aviso.
                </p>
              )}
            </CardHeader>

            {abierto && (
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600">
                    <tr className="border-y">
                      <th className="px-3 py-2 text-left">Cuota</th>
                      <th className="px-3 py-2 text-right">qq/ha</th>
                      <th className="px-3 py-2 text-right">Tons</th>
                      <th className="px-3 py-2 text-right">%</th>
                      <th className="px-3 py-2 text-left">Cobro</th>
                      <th className="px-3 py-2 text-left">Posición</th>
                      <th className="px-3 py-2 text-right">Vendido</th>
                      <th className="px-3 py-2 text-right">Disponible</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {qs.map(q => {
                      const vs = ventasDe(q.id)
                      const tons = tonsCuota(Number(c.has), Number(q.qq_ha_cuota))
                      const vendido = tonsFijadas(vs)
                      const disp = Math.max(0, tons - vendido)
                      const est = estadoDerivado(Number(c.has), Number(q.qq_ha_cuota), vs, q.fecha_cobro_estimada)

                      return (
                        <>
                          <tr key={q.id} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2">
                              #{q.numero_cuota}
                              {q.cuota_padre_id && (
                                <span className="ml-1 text-[10px] text-gray-400">(saldo)</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">{fmtAR(Number(q.qq_ha_cuota))}</td>
                            <td className="px-3 py-2 text-right">{fmtAR(tons, 3)}</td>
                            <td className="px-3 py-2 text-right text-gray-500">
                              {fmtAR(pctCuota(Number(q.qq_ha_cuota), Number(c.qq_ha_total)) * 100, 1)}%
                            </td>
                            <td className="px-3 py-2">
                              {new Date(q.fecha_cobro_estimada + "T00:00:00").toLocaleDateString("es-AR")}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {MESES[q.posicion_mes - 1]} {String(q.posicion_anio).slice(-2)}
                            </td>
                            <td className="px-3 py-2 text-right text-emerald-700">
                              {vendido > 0 ? fmtAR(vendido, 2) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-amber-700">
                              {disp > 0.001 ? fmtAR(disp, 2) : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-[10px]">{est}</Badge>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {disp > 0.001 && (
                                <Button size="sm" variant="outline"
                                  onClick={() => setModalFijar({ cuota: q, contrato: c })}>
                                  <Handshake className="mr-1 h-3.5 w-3.5" /> Fijar
                                </Button>
                              )}
                            </td>
                          </tr>

                          {/* Ventas ya hechas sobre esta cuota */}
                          {vs.map(v => {
                            const ev = estadoVenta(v)
                            const m = montoVenta(v, tcs)
                            return (
                              <tr key={v.id} className="border-b bg-emerald-50/30 text-xs">
                                <td className="px-3 py-1.5 pl-8 text-gray-500" colSpan={3}>
                                  Venta · {fmtAR(Number(v.tons), 2)} tn · {v.modo}
                                </td>
                                <td className="px-3 py-1.5 text-gray-600" colSpan={3}>
                                  {v.modo === "pizarra"
                                    ? `$${fmtAR(v.precio_pesos)}/tn`
                                    : `USD ${fmtAR(v.precio_usd)} × TC ${v.tc ? fmtAR(v.tc) : "sin fijar"}`}
                                </td>
                                <td className="px-3 py-1.5 text-right font-medium" colSpan={2}>
                                  {fmtPesos(m.monto)}{m.estimado && <span className="text-amber-500">*</span>}
                                </td>
                                <td className="px-3 py-1.5">
                                  <Badge variant={ev === "cerrada" ? "default" : "outline"} className="text-[10px]">
                                    {ev === "cerrada" ? "cerrada" : ev === "sin_tc" ? "falta TC" : "falta precio"}
                                  </Badge>
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  {ev === "sin_tc" && (
                                    <Button size="sm" variant="ghost" className="h-6 text-xs"
                                      onClick={() => setModalTC(v)}>
                                      Fijar TC
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        )
      })}

      <p className="text-xs text-gray-400">
        <span className="text-amber-500">*</span> monto en pesos estimado: falta fijar el TC.
      </p>

      <ModalContrato datos={modalContrato} onCerrar={() => setModalContrato(null)} onGuardar={guardarContrato} />
      <ModalFijar datos={modalFijar} ventas={ventas} precios={precios} tcs={tcs}
        onCerrar={() => setModalFijar(null)} onListo={cargar} />
      <ModalFijarTC venta={modalTC} tcs={tcs} onCerrar={() => setModalTC(null)} onListo={cargar} />
    </div>
  )
}

// ── Modal contrato ────────────────────────────────────────────────────────────

function ModalContrato({ datos, onCerrar, onGuardar }: {
  datos: Partial<Contrato> | null
  onCerrar: () => void
  onGuardar: (c: Partial<Contrato>) => Promise<void>
}) {
  const [f, setF] = useState<any>({})
  useEffect(() => {
    if (!datos) return
    setF({
      ...datos,
      has: datos.has != null ? fmtAR(Number(datos.has)) : "",
      qq_ha_total: datos.qq_ha_total != null ? fmtAR(Number(datos.qq_ha_total)) : "",
    })
  }, [datos])

  if (!datos) return null

  const submit = () => {
    if (!f.campania || !f.centro_costo || !f.cliente_nombre || !f.has || !f.qq_ha_total) {
      alert("Campaña, campo, cliente, hectáreas y qq/ha son obligatorios")
      return
    }
    onGuardar({ ...f, has: parseAR(f.has), qq_ha_total: parseAR(f.qq_ha_total) })
  }

  const tons = parseAR(f.has || "0") * parseAR(f.qq_ha_total || "0") / 10

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{datos.id ? "Editar contrato" : "Nuevo contrato"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Empresa</label>
            <Select value={f.empresa || "MSA"} onValueChange={v => setF({ ...f, empresa: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MSA">MSA</SelectItem>
                <SelectItem value="PAM">PAM</SelectItem>
                <SelectItem value="MA">MA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Campaña</label>
            <Input className="h-8" placeholder="26/27" value={f.campania || ""}
              onChange={e => setF({ ...f, campania: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Campo (centro de costo)</label>
            <CentroCostoCombobox value={f.centro_costo || ""} onValueChange={v => setF({ ...f, centro_costo: v })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Cliente</label>
            <Input className="h-8" placeholder="Sanpa / Provinvest" value={f.cliente_nombre || ""}
              onChange={e => setF({ ...f, cliente_nombre: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">CUIT (opcional)</label>
            <Input className="h-8" value={f.cliente_cuit || ""}
              onChange={e => setF({ ...f, cliente_cuit: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Hectáreas</label>
            <Input className="h-8 text-right" placeholder="0,00" value={f.has || ""}
              onChange={e => setF({ ...f, has: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Arrendamiento (qq/ha)</label>
            <Input className="h-8 text-right" placeholder="0,00" value={f.qq_ha_total || ""}
              onChange={e => setF({ ...f, qq_ha_total: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Días de cobro del disponible</label>
            <Input className="h-8 text-right" type="number" value={f.dias_cobro_disponible ?? 20}
              onChange={e => setF({ ...f, dias_cobro_disponible: Number(e.target.value) })} />
            <p className="mt-1 text-[10px] text-gray-400">
              Días corridos entre la fijación y el cobro al vender disponible. Sanpa 15, resto 20.
            </p>
          </div>
          <p className="col-span-2 text-xs text-gray-500">
            Total: <strong>{fmtAR(tons, 3)} tn</strong> (has × qq/ha ÷ 10)
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={submit}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal FIJAR (= vender) ────────────────────────────────────────────────────

function ModalFijar({ datos, ventas, precios, tcs, onCerrar, onListo }: {
  datos: { cuota: Cuota; contrato: Contrato } | null
  ventas: Venta[]
  precios: PrecioGrano[]
  tcs: TipoCambio[]
  onCerrar: () => void
  onListo: () => Promise<void>
}) {
  const [tons, setTons] = useState("")
  const [modo, setModo] = useState<"matba" | "pizarra">("matba")
  const [precio, setPrecio] = useState("")
  const [tc, setTc] = useState("")
  const [fechaCobro, setFechaCobro] = useState("")
  // La fecha de fijación ES la fecha de la venta, y desde ahí se cuentan los días
  // de cobro del disponible. No siempre es hoy.
  const [fechaFijacion, setFechaFijacion] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hoy = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!datos) return
    const { cuota, contrato } = datos
    const vs = ventas.filter(v => v.cuota_id === cuota.id)
    const disp = Math.max(0, tonsCuota(Number(contrato.has), Number(cuota.qq_ha_cuota)) - tonsFijadas(vs))
    const p = resolverPrecio(precios, contrato.grano, cuota.posicion_anio, cuota.posicion_mes)
    const t = resolverTC(tcs, cuota.posicion_anio, cuota.posicion_mes)

    setTons(fmtAR(disp, 2))
    setModo("matba")
    setPrecio(p.precio_usd ? fmtAR(p.precio_usd) : "")
    setTc(t.tc ? fmtAR(t.tc) : "")
    setFechaCobro(cuota.fecha_cobro_estimada)
    setFechaFijacion(new Date().toISOString().slice(0, 10))
    setError(null)
  }, [datos, ventas, precios, tcs])

  if (!datos) return null
  const { cuota, contrato } = datos

  const vs = ventas.filter(v => v.cuota_id === cuota.id)
  const tonsTotal = tonsCuota(Number(contrato.has), Number(cuota.qq_ha_cuota))
  const disponible = Math.max(0, tonsTotal - tonsFijadas(vs))
  const tonsAFijar = parseAR(tons)
  const esParcial = tonsAFijar > 0 && tonsAFijar < disponible - 0.001
  const saldo = Math.max(0, disponible - tonsAFijar)

  // En pizarra el cobro sale de la FECHA DE FIJACIÓN + los días del contrato
  const diasCobro = Number(contrato.dias_cobro_disponible ?? 20)
  const fechaCobroEfectiva = modo === "pizarra" && fechaFijacion
    ? fechaCobroPizarra(fechaFijacion, diasCobro)
    : fechaCobro

  const montoPreview = modo === "pizarra"
    ? tonsAFijar * parseAR(precio)
    : tonsAFijar * parseAR(precio) * (tc.trim() ? parseAR(tc) : 0)

  const confirmar = async () => {
    setError(null)
    if (tonsAFijar <= 0) return setError("Indicá cuántas toneladas fijás")
    if (tonsAFijar > disponible + 0.001) return setError(`Sólo hay ${fmtAR(disponible, 2)} tn disponibles`)
    if (!precio.trim()) return setError("Falta el precio")
    if (!fechaFijacion) return setError("Falta la fecha de fijación (es la fecha de la venta)")

    setGuardando(true)
    try {
      let cuotaDestino = cuota.id

      // Fijar PARCIAL parte la cuota: la original queda con lo que se vende y el saldo
      // pasa a una cuota nueva, que después se puede mover y valorizar por su cuenta.
      if (esParcial) {
        const qqSaldo = (saldo * 10) / Number(contrato.has)
        const qqRestante = Number(cuota.qq_ha_cuota) - qqSaldo

        const { data: maxQ } = await supabase
          .from("cuotas_arrendamiento").select("numero_cuota")
          .eq("contrato_id", contrato.id).order("numero_cuota", { ascending: false }).limit(1).maybeSingle()

        const { error: e1 } = await supabase.from("cuotas_arrendamiento").insert({
          contrato_id: contrato.id,
          numero_cuota: ((maxQ?.numero_cuota as number) ?? 0) + 1,
          qq_ha_cuota: Number(qqSaldo.toFixed(4)),
          fecha_cobro_estimada: cuota.fecha_cobro_estimada,
          posicion_anio: cuota.posicion_anio,
          posicion_mes: cuota.posicion_mes,
          fecha_cobro_original: cuota.fecha_cobro_estimada,
          posicion_orig_anio: cuota.posicion_anio,
          posicion_orig_mes: cuota.posicion_mes,
          estado: "presupuestado",
          cuota_padre_id: cuota.id,
          notas: `Saldo de la cuota #${cuota.numero_cuota} al fijar ${fmtAR(tonsAFijar, 2)} tn`,
        })
        if (e1) throw new Error(e1.message)

        const { error: e2 } = await supabase.from("cuotas_arrendamiento")
          .update({ qq_ha_cuota: Number(qqRestante.toFixed(4)), updated_at: new Date().toISOString() })
          .eq("id", cuota.id)
        if (e2) throw new Error(e2.message)
      }

      const tcNum = tc.trim() ? parseAR(tc) : null
      const precioNum = parseAR(precio)
      const monto = modo === "pizarra"
        ? tonsAFijar * precioNum
        : (tcNum ? tonsAFijar * precioNum * tcNum : null)

      const { error: e3 } = await supabase.from("ventas_arrendamiento").insert({
        cuota_id: cuotaDestino,
        tons: tonsAFijar,
        modo,
        fecha_fijacion_precio: fechaFijacion || hoy,
        precio_usd: modo === "matba" ? precioNum : null,
        precio_pesos: modo === "pizarra" ? precioNum : null,
        // El TC es un momento aparte: si no lo fijás ahora queda pendiente
        fecha_fijacion_tc: modo === "matba" && tcNum ? (fechaFijacion || hoy) : null,
        tc: modo === "matba" ? tcNum : null,
        monto_pesos: monto,
        fecha_cobro: fechaCobroEfectiva,
      })
      if (e3) throw new Error(e3.message)

      await onListo()
      onCerrar()
    } catch (err: any) {
      setError(err.message ?? String(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Fijar — {contrato.centro_costo} cuota #{cuota.numero_cuota}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Disponible: <strong>{fmtAR(disponible, 2)} tn</strong> de {fmtAR(tonsTotal, 2)} tn ·
            posición {MESES[cuota.posicion_mes - 1]} {cuota.posicion_anio}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500">Fecha de fijación (fecha de la venta)</label>
              <Input type="date" className="h-8" value={fechaFijacion}
                onChange={e => setFechaFijacion(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Toneladas a fijar</label>
              <Input className="h-8 text-right" value={tons} onChange={e => setTons(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Modo</label>
              <Select value={modo} onValueChange={(v: any) => setModo(v)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="matba">Matba (USD × TC)</SelectItem>
                  <SelectItem value="pizarra">Pizarra disponible (pesos)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-gray-500">
                {modo === "pizarra" ? "Precio $/ton" : "Precio USD/ton"}
              </label>
              <Input className="h-8 text-right" placeholder="0,00" value={precio}
                onChange={e => setPrecio(e.target.value)} />
            </div>

            {modo === "matba" ? (
              <div>
                <label className="text-xs text-gray-500">TC (opcional)</label>
                <Input className="h-8 text-right" placeholder="dejar vacío = fijar después"
                  value={tc} onChange={e => setTc(e.target.value)} />
                <p className="mt-1 text-[10px] text-gray-400">
                  Precio y TC son momentos distintos
                </p>
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-500">Cobro (calculado)</label>
                <Input className="h-8" value={fechaCobroEfectiva} disabled />
                <p className="mt-1 text-[10px] text-gray-400">
                  Fijación + {diasCobro} días corridos ({contrato.cliente_nombre})
                </p>
              </div>
            )}

            {modo === "matba" && (
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Fecha de cobro</label>
                <Input type="date" className="h-8" value={fechaCobro}
                  onChange={e => setFechaCobro(e.target.value)} />
              </div>
            )}
          </div>

          {esParcial && (
            <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Fijación parcial.</strong> Se parte la cuota: quedan{" "}
              <strong>{fmtAR(saldo, 2)} tn</strong> en una cuota nueva de saldo, que después podés
              mover y valorizar por su cuenta.
            </div>
          )}

          <div className="rounded bg-gray-50 px-3 py-2 text-sm">
            Monto de la venta:{" "}
            <strong>{montoPreview > 0 ? fmtPesos(montoPreview) : "— falta el TC"}</strong>
            {modo === "matba" && !tc.trim() && (
              <span className="block text-xs text-gray-500">
                Se registra la venta con el precio fijado; el monto en pesos queda estimado
                hasta que fijes el TC.
              </span>
            )}
          </div>

          {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button onClick={confirmar} disabled={guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fijar (vender)"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal fijar TC de una venta ya hecha ──────────────────────────────────────

function ModalFijarTC({ venta, tcs, onCerrar, onListo }: {
  venta: Venta | null
  tcs: TipoCambio[]
  onCerrar: () => void
  onListo: () => Promise<void>
}) {
  const [tc, setTc] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!venta) return
    const [anio, mes] = (venta.fecha_cobro ?? "").split("-").map(Number)
    const sug = anio && mes ? resolverTC(tcs, anio, mes) : { tc: 0 }
    setTc(sug.tc ? fmtAR(sug.tc) : "")
  }, [venta, tcs])

  if (!venta) return null

  const valor = parseAR(tc)
  const monto = Number(venta.tons) * Number(venta.precio_usd ?? 0) * valor

  const confirmar = async () => {
    if (valor <= 0) return
    setGuardando(true)
    const { error } = await supabase.from("ventas_arrendamiento").update({
      tc: valor,
      fecha_fijacion_tc: new Date().toISOString().slice(0, 10),
      monto_pesos: monto,
    }).eq("id", venta.id)
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    await onListo()
    onCerrar()
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Fijar TC</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            {fmtAR(Number(venta.tons), 2)} tn × USD {fmtAR(venta.precio_usd)} — el precio ya está
            fijado, falta cerrar el tipo de cambio.
          </p>
          <div>
            <label className="text-xs text-gray-500">Tipo de cambio</label>
            <Input className="h-8 text-right" placeholder="0,00" value={tc}
              onChange={e => setTc(e.target.value)} />
          </div>
          <div className="rounded bg-gray-50 px-3 py-2 text-sm">
            Monto final: <strong>{fmtPesos(monto)}</strong>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button onClick={confirmar} disabled={guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fijar TC"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
