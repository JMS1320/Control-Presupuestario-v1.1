"use client"

// VENTAS → Arrendamiento. Contratos → cuotas → FIJAR (= vender).
// La fijación ES la venta: "Venta origina Factura/Liquidación que origina Cobro".
// Precio y TC se fijan en MOMENTOS DISTINTOS (salvo pizarra, que cierra en un acto).
// Fijar PARCIAL parte la cuota: una cuota se fija entera o se parte.
// Ver DISEÑO_PRESUPUESTO.md § INGRESOS — Arrendamientos agrícolas.

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
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
import {
  copiarEsquemaCuotas, validarCuotas, planificarCuotas, aplicarPlanCuotas, filaDesdeGuardada, partirCuota, DECIMALES_QQ,
  camposDeVenta, tonsMaximasEdicion,
  type FilaCuota, type CuotaGuardada,
} from "@/lib/arrendamientos/cuotas"
import { altaContraparte } from "@/lib/proveedores/alta"
import { TestsDelProceso } from "@/components/tests-del-proceso"

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
  // Con `venta` es EDITAR una venta ya hecha (A-BUG-100); sin ella, fijar una nueva.
  const [modalFijar, setModalFijar] = useState<{ cuota: Cuota; contrato: Contrato; venta?: Venta } | null>(null)
  const [modalTC, setModalTC] = useState<Venta | null>(null)

  // ⚠️ Cada carga lleva un número y sólo la ÚLTIMA escribe en pantalla. Sin esto, al pasar de MSA a
  // PAM mientras MSA todavía cargaba, la respuesta de MSA (más lenta: tiene ventas) llegaba después
  // y pisaba la lista: la solapa decía PAM y abajo estaban los contratos de MSA, editables y
  // fijables. Lo agarró la prueba de pantalla de A-BUG-101 (2026-09-21).
  const cargaVigente = useRef(0)

  const cargar = useCallback(async () => {
    const miCarga = ++cargaVigente.current
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

      if (miCarga !== cargaVigente.current) return   // llegó tarde: ya se pidió otra empresa
      setContratos((cs || []) as Contrato[])
      setCuotas((qs || []) as Cuota[])
      setVentas((vs || []) as Venta[])
      setPrecios((ps || []) as PrecioGrano[])
      setTcs((ts || []) as TipoCambio[])
    } finally { if (miCarga === cargaVigente.current) setCargando(false) }
  }, [empresa])

  useEffect(() => { cargar() }, [cargar])

  const cuotasDe = (contratoId: string) => cuotas.filter(q => q.contrato_id === contratoId)
  const ventasDe = (cuotaId: string) => ventas.filter(v => v.cuota_id === cuotaId)

  // ── Guardar contrato (con sus cuotas — A-BUG-101) ───────────────────────────
  // Devuelve el error para mostrarlo en el modal, o null si salió todo.
  const guardarContrato = async (
    c: Partial<Contrato>, filas: FilaCuota[], originales: CuotaGuardada[],
  ): Promise<string | null> => {
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
    const { data: guardado, error } = c.id
      ? await supabase.from("contratos_arrendamiento").update(payload).eq("id", c.id).select("id").single()
      : await supabase.from("contratos_arrendamiento").insert(payload).select("id").single()
    if (error || !guardado) return "No se pudo guardar el contrato: " + (error?.message ?? "sin respuesta")

    const errCuotas = await aplicarPlanCuotas(supabase, guardado.id, planificarCuotas(originales, filas))

    // § Contrapartes: el cliente del contrato tiene que quedar en el maestro (find-or-create).
    // Si esto falla el contrato ya está guardado: se avisa y no se deshace nada.
    let aviso: string | null = null
    if (c.cliente_cuit) {
      const alta = await altaContraparte(supabase, {
        cuit: c.cliente_cuit, razon_social: c.cliente_nombre || "", como: "cliente",
      })
      if (!alta.ok) aviso = `El contrato se guardó, pero el cliente no quedó en el maestro: ${alta.error}`
    }

    await cargar()
    if (errCuotas) return `El contrato se guardó, pero las cuotas no: ${errCuotas}`
    if (aviso) alert(aviso)
    setModalContrato(null)
    return null
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

              {qs.length === 0 ? (
                <p className="flex items-center gap-1 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Este contrato no tiene cuotas: no proyecta ingresos ni se puede fijar.
                  <button className="ml-1 font-medium underline" onClick={() => setModalContrato(c)}>
                    Cargar cuotas
                  </button>
                </p>
              ) : !guard.ok && (
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
                              {vendido > 0 ? fmtAR(vendido, 3) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-amber-700">
                              {disp > 0.001 ? fmtAR(disp, 3) : "—"}
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
                                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                  {ev === "sin_tc" && (
                                    <Button size="sm" variant="ghost" className="h-6 text-xs"
                                      onClick={() => setModalTC(v)}>
                                      Fijar TC
                                    </Button>
                                  )}
                                  {/* Siempre, abierta o cerrada (A-BUG-100): una venta cerrada con un
                                      TC puesto por error no tenía forma de corregirse. */}
                                  <Button size="sm" variant="ghost" className="h-6 text-xs"
                                    onClick={() => setModalFijar({ cuota: q, contrato: c, venta: v })}>
                                    Editar
                                  </Button>
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

      <ModalContrato
        datos={modalContrato}
        cuotas={modalContrato?.id ? (cuotasDe(modalContrato.id) as unknown as CuotaGuardada[]) : []}
        vendidoPorCuota={Object.fromEntries(
          (modalContrato?.id ? cuotasDe(modalContrato.id) : []).map(q => [q.id, tonsFijadas(ventasDe(q.id))]))}
        onCerrar={() => setModalContrato(null)} onGuardar={guardarContrato} />
      <ModalFijar datos={modalFijar} ventas={ventas} precios={precios} tcs={tcs}
        onCerrar={() => setModalFijar(null)} onListo={cargar} />
      <ModalFijarTC venta={modalTC} tcs={tcs} onCerrar={() => setModalTC(null)} onListo={cargar} />
    </div>
  )
}

// ── Modal contrato (con sus cuotas — A-BUG-101) ───────────────────────────────
// Crear y editar son el MISMO modal: el contrato se define entero de una vez, cuotas incluidas.
// Cada contrato es independiente — cantidad de cuotas, qq/ha y fechas son libres. "Copiar cuotas
// de…" trae el esquema de otro contrato como punto de partida, corrido a esta campaña.

/** Fila del editor mientras se tipea: los qq van como texto es-AR. */
interface FilaEdit {
  id?: string
  qq: string
  fecha: string
  posMes: number
  posAnio: string
  /** La posición la puso el usuario: deja de seguir a la fecha de cobro. */
  posManual: boolean
}

interface FuenteCopia {
  id: string; empresa: string; campania: string; centro_costo: string; cliente_nombre: string
  cuotas: CuotaGuardada[]
}

const mesDe = (fecha: string) => Number(fecha.slice(5, 7)) || 0
const anioDe = (fecha: string) => fecha.slice(0, 4)

function aFilaEdit(c: FilaCuota): FilaEdit {
  return {
    id: c.id,
    // Todos los decimales que tenga (hasta 6): una cuota partida tiene qq/ha como 4,667769, y
    // mostrarla con 2 la redondearía al guardar — volviendo a meter el error de A-BUG-183.
    qq: Number(c.qq_ha_cuota).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: DECIMALES_QQ }),
    fecha: c.fecha_cobro,
    posMes: c.posicion_mes,
    posAnio: String(c.posicion_anio),
    posManual: mesDe(c.fecha_cobro) !== c.posicion_mes || anioDe(c.fecha_cobro) !== String(c.posicion_anio),
  }
}

function aFilaCuota(e: FilaEdit): FilaCuota {
  return {
    id: e.id,
    qq_ha_cuota: parseAR(e.qq),
    fecha_cobro: e.fecha,
    posicion_anio: Number(e.posAnio) || 0,
    posicion_mes: e.posMes,
  }
}

function ModalContrato({ datos, cuotas, vendidoPorCuota, onCerrar, onGuardar }: {
  datos: Partial<Contrato> | null
  /** Cuotas guardadas del contrato (vacío si es nuevo). */
  cuotas: CuotaGuardada[]
  /** Toneladas ya vendidas (fijadas) de cada cuota, por id. */
  vendidoPorCuota: Record<string, number>
  onCerrar: () => void
  onGuardar: (c: Partial<Contrato>, filas: FilaCuota[], originales: CuotaGuardada[]) => Promise<string | null>
}) {
  const [f, setF] = useState<any>({})
  const [filas, setFilas] = useState<FilaEdit[]>([])
  const [fuentes, setFuentes] = useState<FuenteCopia[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Las cuotas guardadas se congelan al abrir: la prop se recalcula en cada render del padre.
  const [originales, setOriginales] = useState<CuotaGuardada[]>([])

  useEffect(() => {
    if (!datos) return
    setF({
      ...datos,
      has: datos.has != null ? fmtAR(Number(datos.has)) : "",
      qq_ha_total: datos.qq_ha_total != null ? fmtAR(Number(datos.qq_ha_total)) : "",
    })
    const orden = [...cuotas].sort((a, b) => a.numero_cuota - b.numero_cuota)
    setOriginales(orden)
    setFilas(orden.map(c => aFilaEdit(filaDesdeGuardada(c))))
    setError(null)

    // Contratos de los que se puede copiar el esquema: de CUALQUIER empresa (el de MSA sirve de
    // ejemplo para PAM y MA), menos éste, y sólo los que tienen cuotas.
    ;(async () => {
      const { data: cs } = await supabase.from("contratos_arrendamiento")
        .select("id, empresa, campania, centro_costo, cliente_nombre").eq("activo", true)
      const otros = (cs || []).filter((c: any) => c.id !== datos.id)
      if (!otros.length) { setFuentes([]); return }
      const { data: qs } = await supabase.from("cuotas_arrendamiento")
        .select("id, contrato_id, numero_cuota, qq_ha_cuota, fecha_cobro_estimada, posicion_anio, posicion_mes, fecha_cobro_original, posicion_orig_anio, posicion_orig_mes")
        .in("contrato_id", otros.map((c: any) => c.id))
      setFuentes(otros
        .map((c: any) => ({ ...c, cuotas: (qs || []).filter((q: any) => q.contrato_id === c.id) }))
        .filter((c: FuenteCopia) => c.cuotas.length > 0))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos])

  if (!datos) return null

  const has = parseAR(f.has || "0")
  const qqTotal = parseAR(f.qq_ha_total || "0")
  const tons = has * qqTotal / 10
  const filasCuota = filas.map(aFilaCuota)
  const val = validarCuotas(filasCuota, has, qqTotal, vendidoPorCuota, originales.map(o => o.id))

  const cambiarFila = (i: number, cambio: Partial<FilaEdit>) => setFilas(prev => prev.map((r, j) => {
    if (j !== i) return r
    const n = { ...r, ...cambio }
    // Default del dato real: la posición sigue al mes de cobro hasta que el usuario la pise.
    if (cambio.fecha !== undefined && !r.posManual && cambio.fecha) {
      n.posMes = mesDe(cambio.fecha); n.posAnio = anioDe(cambio.fecha)
    }
    return n
  }))

  const agregarFila = () => setFilas(prev => {
    const ult = prev[prev.length - 1]
    return [...prev, {
      qq: "", fecha: ult?.fecha ?? "", posMes: ult?.posMes ?? 1,
      posAnio: ult?.posAnio ?? String(new Date().getFullYear()), posManual: ult?.posManual ?? false,
    }]
  })

  const copiarDe = (id: string) => {
    const fuente = fuentes.find(x => x.id === id)
    if (!fuente) return
    if (filas.length && !confirm("Esto reemplaza las cuotas que tiene el contrato en pantalla. ¿Seguir?")) return
    setFilas(copiarEsquemaCuotas(fuente.cuotas, fuente.campania, f.campania || fuente.campania).map(aFilaEdit))
  }

  const submit = async () => {
    setError(null)
    if (!f.campania || !f.centro_costo || !f.cliente_nombre || !f.has || !f.qq_ha_total) {
      return setError("Campaña, campo, cliente, hectáreas y qq/ha son obligatorios")
    }
    if (val.frenos.length) return setError("Hay cuotas que corregir antes de guardar (ver arriba)")
    setGuardando(true)
    try {
      const err = await onGuardar({ ...f, has, qq_ha_total: qqTotal }, filasCuota, originales)
      if (err) setError(err)
    } finally { setGuardando(false) }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{datos.id ? "Editar contrato" : "Nuevo contrato"}</DialogTitle></DialogHeader>
        {/* Los A-TEST de este proceso, a la vista donde se corre (§ 🧪 CLAUDE.md, A-FEAT-129) */}
        <TestsDelProceso proceso="ingresos/contrato-arrendamiento" pantalla="ingresos" />
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
          {/* El cliente sale del maestro (2026-09-04): escrito a mano el CUIT quedaba vacío o mal
              tipeado, y es la clave con la que después se busca la factura. */}
          <div className="col-span-2">
            <ProveedorCombobox
              label="Cliente"
              value={{ cuit: f.cliente_cuit || "", nombre: f.cliente_nombre || "" }}
              onChange={sel => setF({ ...f, cliente_nombre: sel.nombre, cliente_cuit: sel.cuit })}
            />
            {f.cliente_nombre && !f.cliente_cuit && (
              <p className="mt-1 text-[11px] text-amber-700">
                Falta el CUIT del cliente: sin él no se va a encontrar su factura. Elegilo de la lista.
              </p>
            )}
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

        {/* ── Cuotas ── */}
        <div className="mt-2 space-y-2 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-700">Cuotas</h4>
            {fuentes.length > 0 && (
              <Select value="" onValueChange={copiarDe}>
                <SelectTrigger className="h-8 w-auto min-w-[220px] text-xs">
                  <SelectValue placeholder="Copiar cuotas de otro contrato…" />
                </SelectTrigger>
                <SelectContent>
                  {fuentes.map(x => (
                    <SelectItem key={x.id} value={x.id} className="text-xs">
                      {x.empresa} · {x.centro_costo} {x.campania} · {x.cliente_nombre} ({x.cuotas.length} cuotas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {filas.length === 0 ? (
            <p className="rounded bg-gray-50 px-3 py-3 text-center text-xs text-gray-500">
              Sin cuotas. Agregalas una por una o copiá el esquema de otro contrato y ajustalo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="px-1 py-1 text-left">#</th>
                    <th className="px-1 py-1 text-right">qq/ha</th>
                    <th className="px-1 py-1 text-right">Tons</th>
                    <th className="px-1 py-1 text-right">%</th>
                    <th className="px-1 py-1 text-left">Fecha de cobro</th>
                    <th className="px-1 py-1 text-left">Posición</th>
                    <th className="px-1 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((r, i) => {
                    const vendido = r.id ? vendidoPorCuota[r.id] ?? 0 : 0
                    const qq = parseAR(r.qq)
                    return (
                      <tr key={r.id ?? `nueva-${i}`} className="border-t">
                        <td className="px-1 py-1 text-gray-500">{i + 1}</td>
                        <td className="px-1 py-1">
                          <Input className="h-7 w-20 text-right" placeholder="0,00" value={r.qq}
                            onChange={e => cambiarFila(i, { qq: e.target.value })} />
                        </td>
                        <td className="px-1 py-1 text-right text-gray-600">{fmtAR(tonsCuota(has, qq), 2)}</td>
                        <td className="px-1 py-1 text-right text-gray-400">
                          {qqTotal > 0 ? fmtAR(pctCuota(qq, qqTotal) * 100, 1) + "%" : "—"}
                        </td>
                        <td className="px-1 py-1">
                          <Input type="date" className="h-7 w-36" value={r.fecha}
                            onChange={e => cambiarFila(i, { fecha: e.target.value })} />
                        </td>
                        <td className="px-1 py-1">
                          <div className="flex items-center gap-1">
                            <Select value={String(r.posMes)}
                              onValueChange={v => cambiarFila(i, { posMes: Number(v), posManual: true })}>
                              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {MESES.map((m, k) => <SelectItem key={m} value={String(k + 1)}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input className="h-7 w-16 text-xs" value={r.posAnio}
                              onChange={e => cambiarFila(i, { posAnio: e.target.value, posManual: true })} />
                            <span className="text-[10px] text-gray-400"
                              title="La posición es el mes del precio del grano (Matba). Por default sigue a la fecha de cobro.">
                              {r.posManual ? "a mano" : "= cobro"}
                            </span>
                          </div>
                        </td>
                        <td className="px-1 py-1 text-right">
                          {vendido > 0 ? (
                            <span className="text-[10px] text-emerald-700" title="Tiene una venta fijada: no se puede borrar">
                              vendido {fmtAR(vendido, 2)} tn
                            </span>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 px-2"
                              onClick={() => setFilas(prev => prev.filter((_, j) => j !== i))}>
                              <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={agregarFila}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar cuota
          </Button>

          {/* Control: frena lo que rompería ventas; avisa lo que el contrato puede explicar */}
          {val.frenos.map((m, k) => (
            <p key={`f${k}`} className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700">🛑 {m}</p>
          ))}
          {val.avisos.map((m, k) => (
            <p key={`a${k}`} className="flex items-center gap-1 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> {m}. Es sólo un aviso.
            </p>
          ))}
          {filas.length > 0 && !val.avisos.length && !val.frenos.length && (
            <p className="text-xs text-emerald-700">✓ Las cuotas suman los {fmtAR(qqTotal)} qq/ha del contrato</p>
          )}
          <p className="text-[11px] text-gray-400">
            Las cuotas ya cobradas se registran después con <strong>Fijar</strong>, con su fecha y precio reales.
          </p>
        </div>

        {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={submit} disabled={guardando || val.frenos.length > 0}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal FIJAR (= vender) ────────────────────────────────────────────────────

function ModalFijar({ datos, ventas, precios, tcs, onCerrar, onListo }: {
  datos: { cuota: Cuota; contrato: Contrato; venta?: Venta } | null
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
  const [tcSugerido, setTcSugerido] = useState<number | null>(null)
  const [fechaCobro, setFechaCobro] = useState("")
  // La fecha de fijación ES la fecha de la venta, y desde ahí se cuentan los días
  // de cobro del disponible. No siempre es hoy.
  const [fechaFijacion, setFechaFijacion] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** La fecha de cobro se muestra como dato (de la cuota o de la venta) hasta que se pide cambiarla. */
  const [cambiarCobro, setCambiarCobro] = useState(false)
  /** Lo facturado de la venta que se edita: si cambia el monto, hay que revisar ese vínculo. */
  const [facturado, setFacturado] = useState(0)

  const hoy = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!datos) return
    const { cuota, contrato } = datos
    const vs = ventas.filter(v => v.cuota_id === cuota.id)
    const disp = Math.max(0, tonsCuota(Number(contrato.has), Number(cuota.qq_ha_cuota)) - tonsFijadas(vs))
    const p = resolverPrecio(precios, contrato.grano, cuota.posicion_anio, cuota.posicion_mes)
    const t = resolverTC(tcs, cuota.posicion_anio, cuota.posicion_mes)
    setCambiarCobro(false)
    setError(null)
    setTcSugerido(t.tc || null)

    // ── Editar una venta ya hecha: arranca con lo que tiene guardado ──
    const v = datos.venta
    if (v) {
      setTons(fmtAR(Number(v.tons), 3))
      setModo(v.modo)
      setPrecio(fmtAR(Number(v.modo === "pizarra" ? v.precio_pesos : v.precio_usd) || 0))
      setTc(v.tc ? fmtAR(Number(v.tc)) : "")
      setFechaCobro(v.fecha_cobro || cuota.fecha_cobro_estimada)
      setFechaFijacion(v.fecha_fijacion_precio || hoy)
      setFacturado(0)
      supabase.from("ventas_facturas").select("monto_asignado")
        .eq("venta_tipo", "arrendamiento").eq("venta_id", v.id).eq("vinculado", true)
        .then(({ data }) => setFacturado((data || []).reduce((a: number, r: any) => a + (Number(r.monto_asignado) || 0), 0)))
      return
    }

    // 3 decimales (A-BUG-184): con 2, 66,154 tn se proponía 66,15 y la fijación salía PARCIAL por
    // 0,004 tn, dejando una cuota de saldo basura si el usuario no lo notaba.
    setTons(fmtAR(disp, 3))
    setModo("matba")
    setPrecio(p.precio_usd ? fmtAR(p.precio_usd) : "")
    // El TC arranca VACÍO (A-FEAT-164, decidido por el usuario): proponer el del presupuesto hacía
    // fácil fijarlo sin querer, y una venta con TC queda cerrada (así nació A-BUG-100). El del
    // presupuesto se ofrece al lado, para ponerlo con un clic si corresponde.
    setTc("")
    setTcSugerido(t.tc || null)
    setFechaCobro(cuota.fecha_cobro_estimada)
    setFechaFijacion(new Date().toISOString().slice(0, 10))
    setError(null)
  }, [datos, ventas, precios, tcs])

  if (!datos) return null
  const { cuota, contrato } = datos
  const venta = datos.venta
  const editando = !!venta

  const vs = ventas.filter(v => v.cuota_id === cuota.id)
  const tonsTotal = tonsCuota(Number(contrato.has), Number(cuota.qq_ha_cuota))
  // Al editar, el tope es la cuota menos las OTRAS ventas (la propia se está reemplazando)
  const disponible = editando
    ? tonsMaximasEdicion(tonsTotal, tonsFijadas(vs.filter(v => v.id !== venta!.id)))
    : Math.max(0, tonsTotal - tonsFijadas(vs))
  const tonsAFijar = parseAR(tons)
  // Editar no parte la cuota: si se bajan las tn, lo que sobra queda disponible en la misma cuota
  const esParcial = !editando && tonsAFijar > 0 && tonsAFijar < disponible - 0.001
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
    if (tonsAFijar > disponible + 0.001) return setError(editando
      ? `La cuota tiene lugar para ${fmtAR(disponible, 3)} tn en esta venta`
      : `Sólo hay ${fmtAR(disponible, 3)} tn disponibles`)
    if (!precio.trim()) return setError("Falta el precio")
    if (!fechaFijacion) return setError("Falta la fecha de fijación (es la fecha de la venta)")

    setGuardando(true)
    try {
      let cuotaDestino = cuota.id

      // Fijar PARCIAL parte la cuota: la original queda con lo que se vende y el saldo
      // pasa a una cuota nueva, que después se puede mover y valorizar por su cuenta.
      if (esParcial) {
        // Mandan las TONELADAS (A-BUG-183): la original se queda con lo ya vendido + lo de ahora.
        const { qqOriginal: qqRestante, qqSaldo } =
          partirCuota(Number(contrato.has), Number(cuota.qq_ha_cuota), tonsTotal - saldo)

        const { data: maxQ } = await supabase
          .from("cuotas_arrendamiento").select("numero_cuota")
          .eq("contrato_id", contrato.id).order("numero_cuota", { ascending: false }).limit(1).maybeSingle()

        const { error: e1 } = await supabase.from("cuotas_arrendamiento").insert({
          contrato_id: contrato.id,
          numero_cuota: ((maxQ?.numero_cuota as number) ?? 0) + 1,
          qq_ha_cuota: qqSaldo,
          fecha_cobro_estimada: cuota.fecha_cobro_estimada,
          posicion_anio: cuota.posicion_anio,
          posicion_mes: cuota.posicion_mes,
          fecha_cobro_original: cuota.fecha_cobro_estimada,
          posicion_orig_anio: cuota.posicion_anio,
          posicion_orig_mes: cuota.posicion_mes,
          estado: "presupuestado",
          cuota_padre_id: cuota.id,
          notas: `Saldo de la cuota #${cuota.numero_cuota} al fijar ${fmtAR(tonsAFijar, 3)} tn`,
        })
        if (e1) throw new Error(e1.message)

        const { error: e2 } = await supabase.from("cuotas_arrendamiento")
          .update({ qq_ha_cuota: qqRestante, updated_at: new Date().toISOString() })
          .eq("id", cuota.id)
        if (e2) throw new Error(e2.message)
      }

      // El TC es un momento aparte: vacío = queda pendiente («falta TC»), también al editar.
      const campos = camposDeVenta({
        tons: tonsAFijar, modo, precio: parseAR(precio), tc: tc.trim() ? parseAR(tc) : null,
        fechaFijacion: fechaFijacion || hoy,
        tcAnterior: venta?.tc ?? null, fechaTcAnterior: venta?.fecha_fijacion_tc ?? null,
      })
      const fila = { ...campos, fecha_fijacion_precio: fechaFijacion || hoy, fecha_cobro: fechaCobroEfectiva }

      const { error: e3 } = editando
        ? await supabase.from("ventas_arrendamiento").update(fila).eq("id", venta!.id)
        : await supabase.from("ventas_arrendamiento").insert({ ...fila, cuota_id: cuotaDestino })
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
            {editando ? "Editar venta" : "Fijar"} — {contrato.centro_costo} cuota #{cuota.numero_cuota}
          </DialogTitle>
        </DialogHeader>

        {/* Los A-TEST de este proceso, a la vista donde se corre (§ 🧪 CLAUDE.md) */}
        <TestsDelProceso proceso="ingresos/fijar-arrendamiento" pantalla="ingresos" />
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            {editando ? "Máximo para esta venta" : "Disponible"}: <strong>{fmtAR(disponible, 3)} tn</strong> de {fmtAR(tonsTotal, 3)} tn ·
            posición {MESES[cuota.posicion_mes - 1]} {cuota.posicion_anio}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500">Fecha de fijación (fecha de la venta)</label>
              <Input type="date" className="h-8" value={fechaFijacion}
                onChange={e => setFechaFijacion(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{editando ? "Toneladas" : "Toneladas a fijar"}</label>
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
                  {tcSugerido && !tc.trim() && (
                    <>
                      {" · "}
                      <button type="button" className="underline"
                        onClick={() => setTc(fmtAR(tcSugerido))}>
                        usar el del presupuesto ({fmtAR(tcSugerido)})
                      </button>
                    </>
                  )}
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
                {/* A-FEAT-164: la fecha de cobro ya viene de la cuota; mostrarla como campo a
                    completar dejaba la duda de si estaba bien. Se ve como dato y se cambia si hace falta. */}
                {cambiarCobro ? (
                  <>
                    <label className="text-xs text-gray-500">Fecha de cobro</label>
                    <Input type="date" className="h-8" value={fechaCobro}
                      onChange={e => setFechaCobro(e.target.value)} />
                  </>
                ) : (
                  <p className="text-xs text-gray-600">
                    Cobro: <strong>{fechaCobro ? new Date(fechaCobro + "T00:00:00").toLocaleDateString("es-AR") : "—"}</strong>{" "}
                    <span className="text-gray-400">({editando ? "de la venta" : "de la cuota"})</span>{" · "}
                    <button type="button" className="underline" onClick={() => setCambiarCobro(true)}>cambiar</button>
                  </p>
                )}
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

          {/* Aviso, no freno: la factura puede haberse emitido por otro monto a propósito */}
          {editando && facturado > 0 && Math.abs(montoPreview - facturado) > 0.01 && (
            <p className="flex items-start gap-1 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Esta venta tiene factura vinculada por {fmtPesos(facturado)}. Si cambiás el monto,
              revisá ese vínculo.
            </p>
          )}

          {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button onClick={confirmar} disabled={guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : editando ? "Guardar cambios" : "Fijar (vender)"}
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
