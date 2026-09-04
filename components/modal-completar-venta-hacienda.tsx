"use client"

/**
 * 💰 Completar la venta de un movimiento de hacienda — A-FEAT-87.
 *
 * ## Por qué existe
 * Un movimiento de tipo **venta** da de baja los animales. Pero hasta el 2026-09-04 no creaba la
 * venta comercial, así que esos animales salían del stock y **no entraban a facturación, cobro ni
 * presupuesto**. Quedaron tres así: las 7 vacas y los 3 toros a Arrebeef del 03/09, y 4 vacas de
 * marzo.
 *
 * Esta ventana es **la línea entera**: trae lo que el movimiento ya tiene y deja cargar lo que le
 * falta para ser una venta de verdad. Al guardar, si la venta no existía, **se crea**.
 *
 * ## Lo que se carga acá, y lo que NO
 * Del usuario, textual: *"desde mov de hacienda sólo kilos de carga nuestra"*. O sea **kilos vivos
 * de cuando se cargó el camión**, con su desbaste y su CZ.
 *
 * La cadena completa de pesadas —directo de campo, después del encierre (con horas), neto de
 * desbaste, kilos de carne y rinde— **no entra acá**: llega después, con el romaneo del
 * frigorífico. Por eso el importe puede quedar en blanco a propósito (ver abajo).
 *
 * ## 🔑 El precio no dice si es a la res o al vivo: lo dice el DESTINO
 * `destinos_venta.compra_en` ya lo sabe (`Arrebeef` = res, `Cañuelas` = vivo). Agregar un campo
 * "tipo de precio" en la venta sería un segundo lugar diciendo lo mismo — exactamente lo que este
 * audit vino a eliminar.
 *
 * Y de ahí sale una consecuencia honesta: **si el destino compra a la res y todavía no llegó el
 * romaneo, el importe no se puede calcular** — falta saber cuántos kilos de carne dieron. En ese
 * caso se deja vacío y se dice por qué, en vez de inventar un número con un rinde estimado que
 * después no va a coincidir con la liquidación.
 */

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"

/** es-AR: coma decimal y punto de miles. Nunca `type="number"` para montos (§ CLAUDE.md). */
const num = (v: string): number | null => {
  const s = String(v ?? "").trim()
  if (!s) return null
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."))
  return isNaN(n) ? null : n
}
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface MovimientoVenta {
  id: string
  fecha: string
  cantidad: number
  categoria_id: string | null
  categoria_nombre?: string
  peso_total_kg: number | null
  precio_por_kg: number | null
  monto_total: number | null
  proveedor_cliente: string | null
  cuit: string | null
  stock_venta_id: string | null
  observaciones: string | null
}

interface Destino { id: string; nombre: string; compra_en: string }
interface Animal {
  id: string
  caravana: string
  /**
   * La observación del animal — y para muchos **es su única identificación**.
   *
   * Las vacas de descarte entran por un cambio de categoría con su razón (*"Vaca Dura que
   * malparió. Robocop"*) y sin caravana. Sin mostrarla, la lista era una fila de «(sin número)»
   * indistinguibles y no se podía elegir cuál se vendió. Lo reportó el usuario el 2026-09-04.
   */
  observaciones: string | null
  /** La última pesada registrada, si tiene. Precarga el kilo, no lo impone. */
  ultimoPeso: number | null
  fechaPeso: string | null
}

export function ModalCompletarVentaHacienda({
  movimiento, abierto, onCerrar, onGuardado,
}: {
  movimiento: MovimientoVenta | null
  abierto: boolean
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [destinos, setDestinos] = useState<Destino[]>([])
  const [destinoId, setDestinoId] = useState("")
  const [cliente, setCliente] = useState({ cuit: "", nombre: "" })
  const [kgCarga, setKgCarga] = useState("")
  const [desbaste, setDesbaste] = useState("")
  const [cz, setCz] = useState("")
  const [precio, setPrecio] = useState("")
  const [kgCarne, setKgCarne] = useState("")
  const [notas, setNotas] = useState("")
  const [guardando, setGuardando] = useState(false)

  /**
   * Las caravanas de la venta — pedido del usuario (2026-09-04).
   *
   * Se ofrecen **sólo las de la categoría del movimiento**: una venta de Vaca CUT/Descarte no
   * puede mostrar animales de recría. *"Esto va a su lugar. No puede ir a recría algo que es de
   * cría."*
   *
   * El kilo de cada animal se **precarga con su última pesada y se puede pisar** — a veces se pesa
   * en el campo el día de la carga y no queda registrado como pesada formal. *"Indistinto a mano o
   * por pesada."*
   */
  const [animales, setAnimales] = useState<Animal[]>([])
  const [elegidos, setElegidos] = useState<Record<string, { sel: boolean; kg: string }>>({})
  /** Animales sin caravana, identificados por una observación. No se les inventa una caravana. */
  const [sueltos, setSueltos] = useState<{ descripcion: string; kg: string }[]>([])
  const [brutoCamion, setBrutoCamion] = useState("")
  const [taraCamion, setTaraCamion] = useState("")

  useEffect(() => {
    if (!abierto || !movimiento) return
    supabase.schema("productivo").from("destinos_venta").select("id, nombre, compra_en")
      .then(({ data }) => setDestinos(data ?? []))
    setCliente({ cuit: movimiento.cuit ?? "", nombre: movimiento.proveedor_cliente ?? "" })
    setKgCarga(movimiento.peso_total_kg != null ? String(movimiento.peso_total_kg).replace(".", ",") : "")
    setPrecio(movimiento.precio_por_kg != null ? String(movimiento.precio_por_kg).replace(".", ",") : "")
    setDesbaste(""); setCz(""); setKgCarne(""); setDestinoId(""); setNotas("")
    setElegidos({}); setSueltos([]); setBrutoCamion(""); setTaraCamion("")

    /**
     * Los animales que se pueden adjudicar: **sólo los de la categoría de este movimiento**, y
     * sólo los activos o los que ya son de esta venta. Sin ese filtro una venta de vacas de descarte
     * ofrecería terneros de recría, que es justo lo que el usuario pidió que no pase.
     */
    if (movimiento.categoria_id) {
      const prod = supabase.schema("productivo")
      prod.from("terneros")
        .select("id, caravana_interna, caravana_oficial, observaciones, activo, stock_venta_id")
        .eq("categoria_id", movimiento.categoria_id)
        .then(async ({ data: ts }) => {
          const propios = (ts ?? []).filter(t =>
            t.activo || (movimiento.stock_venta_id && t.stock_venta_id === movimiento.stock_venta_id))
          if (propios.length === 0) { setAnimales([]); return }
          const { data: ps } = await prod.from("pesadas_terneros")
            .select("ternero_id, fecha, peso_kg")
            .in("ternero_id", propios.map(t => t.id))
            .order("fecha", { ascending: false })
          const ultima = new Map<string, { peso: number; fecha: string }>()
          for (const x of ps ?? []) {
            if (!ultima.has(x.ternero_id)) ultima.set(x.ternero_id, { peso: Number(x.peso_kg), fecha: x.fecha })
          }
          setAnimales(propios.map(t => {
            const u = ultima.get(t.id)
            return {
              id: t.id,
              caravana: t.caravana_interna || t.caravana_oficial || "",
              observaciones: t.observaciones ?? null,
              ultimoPeso: u?.peso ?? null,
              fechaPeso: u?.fecha ?? null,
            }
          }))
          // Los que ya estaban en esta venta arrancan tildados.
          const yaEran: Record<string, { sel: boolean; kg: string }> = {}
          for (const t of propios) {
            if (movimiento.stock_venta_id && t.stock_venta_id === movimiento.stock_venta_id) {
              const u = ultima.get(t.id)
              yaEran[t.id] = { sel: true, kg: u ? String(u.peso).replace(".", ",") : "" }
            }
          }
          setElegidos(yaEran)
        })
    }

    // Si la venta ya existe, se traen SUS valores: la ventana edita la venta, no la duplica.
    if (movimiento.stock_venta_id) {
      supabase.schema("productivo").from("stock_ventas")
        .select("destino_id, pct_desbaste, pct_cz, kg_totales, precio_kg, kg_carne, cliente_cuit, cliente_nombre, notas, peso_bruto_camion, peso_tara_camion, animales_sueltos")
        .eq("id", movimiento.stock_venta_id).single()
        .then(({ data: v }) => {
          if (!v) return
          setDestinoId(v.destino_id ?? "")
          setDesbaste(v.pct_desbaste != null ? String(v.pct_desbaste).replace(".", ",") : "")
          setCz(v.pct_cz != null ? String(v.pct_cz).replace(".", ",") : "")
          if (v.kg_totales != null) setKgCarga(String(v.kg_totales).replace(".", ","))
          if (v.precio_kg != null) setPrecio(String(v.precio_kg).replace(".", ","))
          if (v.kg_carne != null) setKgCarne(String(v.kg_carne).replace(".", ","))
          if (v.cliente_cuit || v.cliente_nombre) {
            setCliente({ cuit: v.cliente_cuit ?? "", nombre: v.cliente_nombre ?? "" })
          }
          setNotas(v.notas ?? "")
          if (v.peso_bruto_camion != null) setBrutoCamion(String(v.peso_bruto_camion).replace(".", ","))
          if (v.peso_tara_camion != null) setTaraCamion(String(v.peso_tara_camion).replace(".", ","))
          setSueltos((v.animales_sueltos ?? []).map((x: any) => ({
            descripcion: x.descripcion ?? "", kg: x.kg != null ? String(x.kg).replace(".", ",") : "",
          })))
        })
    }
  }, [abierto, movimiento])

  /**
   * 🔑 De dónde salen los kilos — y por qué se muestran los TRES.
   *
   * Hay tres formas de saber cuánto pesó la carga y **no tienen por qué coincidir**:
   *  1. la suma de los animales (caravanas + sueltos),
   *  2. el pesaje del camión (bruto − tara),
   *  3. lo que el usuario escribe.
   *
   * El campo de kilos se **precarga** con (2) y si no con (1), y **se puede pisar** — regla del
   * dato real siempre editable. Pero la diferencia entre los tres **se muestra**: es el control
   * gratis del "mismo número por dos caminos". Taparla sería perder justo el aviso de que algo no
   * cierra.
   */
  const elegidosArr = Object.entries(elegidos).filter(([, v]) => v.sel)
  const kgAnimales = elegidosArr.reduce((t, [, v]) => t + (num(v.kg) ?? 0), 0)
    + sueltos.reduce((t, x) => t + (num(x.kg) ?? 0), 0)
  const cabezas = elegidosArr.length + sueltos.length
  const netoCamion = num(brutoCamion) != null && num(taraCamion) != null
    ? num(brutoCamion)! - num(taraCamion)! : null

  /**
   * Precarga de los kilos: camión primero, si no la suma de los animales. **Sin pisar lo escrito.**
   * El camión manda sobre la suma porque es la balanza contra la que se factura; la suma de los
   * animales es el detalle de quién pesó qué.
   */
  useEffect(() => {
    if (kgCarga.trim()) return
    const sugerido = netoCamion ?? (kgAnimales > 0 ? kgAnimales : null)
    if (sugerido != null) setKgCarga(String(sugerido).replace(".", ","))
  }, [netoCamion, kgAnimales]) // eslint-disable-line react-hooks/exhaustive-deps

  const destino = destinos.find(d => d.id === destinoId)
  const alaRes = destino?.compra_en === "res"

  // ── El cálculo, a la vista ────────────────────────────────────────────────
  const kg = num(kgCarga)
  const desb = num(desbaste)
  const neto = kg != null ? kg * (1 - (desb ?? 0) / 100) : null
  const carne = num(kgCarne)
  const p = num(precio)
  const rindeReal = carne != null && neto ? carne / neto : null

  /**
   * El bruto. Si el destino compra a la RES hacen falta los kilos de carne — y sin romaneo no
   * están. Ahí devuelve `null` a propósito: es mejor un importe vacío que uno inventado con un
   * rinde estimado que después no va a coincidir con la liquidación.
   */
  const bruto = p == null ? null
    : alaRes ? (carne != null ? carne * p : null)
    : (neto != null ? neto * p : null)
  const czMonto = bruto != null && num(cz) != null ? bruto * (num(cz)! / 100) : null
  const netoFinal = bruto != null ? bruto - (czMonto ?? 0) : null

  const porQueNoHayImporte = p == null ? "falta el precio"
    : alaRes && carne == null ? `${destino?.nombre} compra a la res: falta el kilaje de carne del romaneo`
    : kg == null ? "faltan los kilos de carga"
    : null

  const guardar = async () => {
    if (!movimiento) return
    setGuardando(true)
    try {
      const prod = supabase.schema("productivo")
      const datosVenta = {
        categoria_id: movimiento.categoria_id,
        fecha_venta: movimiento.fecha,
        cantidad: movimiento.cantidad,
        kg_totales: kg,
        peso_kg: kg != null && movimiento.cantidad > 0 ? kg / movimiento.cantidad : null,
        pct_desbaste: desb,
        pct_cz: num(cz),
        precio_kg: p,
        kg_carne: carne,
        monto_neto: netoFinal,
        destino_id: destinoId || null,
        cliente_nombre: cliente.nombre || null,
        cliente_cuit: cliente.cuit || null,
        notas: notas || null,
        peso_bruto_camion: num(brutoCamion),
        peso_tara_camion: num(taraCamion),
        animales_sueltos: sueltos
          .filter(x => x.descripcion.trim() || x.kg.trim())
          .map(x => ({ descripcion: x.descripcion.trim(), kg: num(x.kg) })),
      }

      let ventaId = movimiento.stock_venta_id
      if (ventaId) {
        const { error } = await prod.from("stock_ventas").update(datosVenta).eq("id", ventaId)
        if (error) throw error
      } else {
        const { data, error } = await prod.from("stock_ventas")
          .insert({ ...datosVenta, lote_id: null }).select("id").single()
        if (error || !data) throw error ?? new Error("no se pudo crear la venta")
        ventaId = data.id
      }

      // El movimiento queda colgado de SU venta, y con los mismos números: una sola verdad.
      const { error: eMov } = await prod.from("movimientos_hacienda").update({
        stock_venta_id: ventaId,
        peso_total_kg: kg,
        precio_por_kg: p,
        monto_total: netoFinal,
        proveedor_cliente: cliente.nombre || null,
        cuit: cliente.cuit || null,
      }).eq("id", movimiento.id)
      if (eMov) throw eMov

      /**
       * Adjudicar las caravanas: quedan colgadas de la venta y dadas de baja del rodeo.
       * Se hace en dos pasos — primero se sueltan las que ya no están tildadas — para que
       * **desmarcar** funcione igual que marcar. Si no, una caravana mal adjudicada no se podía
       * sacar nunca.
       */
      const idsElegidos = elegidosArr.map(([id]) => id)
      const idsSoltar = animales.map(a => a.id).filter(id => !idsElegidos.includes(id))
      if (idsSoltar.length) {
        await prod.from("terneros")
          .update({ activo: true, fecha_baja: null, motivo_baja: null, stock_venta_id: null })
          .in("id", idsSoltar).eq("stock_venta_id", ventaId)
      }
      if (idsElegidos.length) {
        await prod.from("terneros").update({
          activo: false, fecha_baja: movimiento.fecha, motivo_baja: "Vendido",
          stock_venta_id: ventaId,
        }).in("id", idsElegidos)

        /**
         * El kilo cargado a mano se guarda como PESADA del día de la venta, si difiere de la
         * última que tenía. Así el peso individual vive en su lugar de siempre
         * (`pesadas_terneros`) y no en un rincón nuevo de la venta — el dato en un solo lado.
         */
        const nuevas = elegidosArr
          .map(([id, v]) => ({ id, kg: num(v.kg), animal: animales.find(a => a.id === id) }))
          .filter(x => x.kg != null && x.kg !== x.animal?.ultimoPeso)
          .map(x => ({
            ternero_id: x.id, fecha: movimiento.fecha, peso_kg: x.kg,
            observaciones: "Peso de carga — venta",
          }))
        if (nuevas.length) await prod.from("pesadas_terneros").insert(nuevas)
      }

      toast.success(
        movimiento.stock_venta_id
          ? "Venta actualizada."
          : "Venta creada. Ya aparece en Ingresos → Ganadería y en el Cash Flow.",
        { duration: 7000 },
      )
      onGuardado(); onCerrar()
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  if (!movimiento) return null

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            💰 {movimiento.stock_venta_id ? "Editar la venta" : "Completar la venta"} — {movimiento.cantidad}{" "}
            {movimiento.categoria_nombre ?? "cab"} · {movimiento.fecha}
          </DialogTitle>
        </DialogHeader>

        {!movimiento.stock_venta_id && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
            ⚠️ Este movimiento <b>dio de baja los animales pero no tiene venta</b>: hoy no entra a
            facturación, cobro ni presupuesto. Al guardar, la venta se crea.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <ProveedorCombobox
              label="Cliente"
              value={cliente}
              onChange={setCliente}
            />
          </div>

          <div>
            <Label className="text-xs">Destino</Label>
            <select
              className="mt-1 h-9 w-full rounded border px-2 text-sm"
              value={destinoId} onChange={e => setDestinoId(e.target.value)}
            >
              <option value="">— elegir —</option>
              {destinos.map(d => (
                <option key={d.id} value={d.id}>{d.nombre} (compra {d.compra_en})</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] leading-3 text-gray-500">
              Define si el precio es <b>a la res</b> o <b>al vivo</b>.
            </p>
          </div>

          <div>
            <Label className="text-xs">Kilos de carga (vivos)</Label>
            <Input className="mt-1" type="text" placeholder="0,00" value={kgCarga}
              onChange={e => setKgCarga(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Desbaste %</Label>
            <Input className="mt-1" type="text" placeholder="0,00" value={desbaste}
              onChange={e => setDesbaste(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">CZ % <span className="text-gray-400">(comisión + flete + otros)</span></Label>
            <Input className="mt-1" type="text" placeholder="0,00" value={cz}
              onChange={e => setCz(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">
              Precio $/kg {destino ? <b>{alaRes ? "res" : "vivo"}</b> : <span className="text-gray-400">(elegí el destino)</span>}
            </Label>
            <Input className="mt-1" type="text" placeholder="0,00" value={precio}
              onChange={e => setPrecio(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">
              Kg de carne <span className="text-gray-400">(del romaneo)</span>
            </Label>
            <Input className="mt-1" type="text" placeholder="cuando llegue" value={kgCarne}
              onChange={e => setKgCarne(e.target.value)} />
          </div>
        </div>

        {/* ── Caravanas ───────────────────────────────────────────────────── */}
        {(animales.length > 0 || sueltos.length > 0) && (
          <div className="rounded border">
            <div className="flex items-center justify-between border-b bg-gray-50 px-3 py-1.5">
              <span className="text-xs font-medium">
                🐮 Animales — {cabezas} de {movimiento.cantidad}
                {cabezas !== movimiento.cantidad && (
                  <span className="ml-2 text-amber-700">
                    ⚠ el movimiento dice {movimiento.cantidad}
                  </span>
                )}
              </span>
              <span className="text-xs tabular-nums text-gray-600">{fmt(kgAnimales || null)} kg</span>
            </div>

            {animales.length > 0 && (
              <ul className="max-h-44 divide-y overflow-auto">
                {animales.map(a => {
                  const e = elegidos[a.id]
                  return (
                    <li key={a.id} className="flex items-center gap-2 px-3 py-1 text-xs">
                      <input
                        type="checkbox" checked={!!e?.sel}
                        onChange={ev => setElegidos(prev => ({
                          ...prev,
                          [a.id]: {
                            sel: ev.target.checked,
                            // El kilo se precarga con la última pesada; se puede pisar.
                            kg: prev[a.id]?.kg ?? (a.ultimoPeso != null ? String(a.ultimoPeso).replace(".", ",") : ""),
                          },
                        }))}
                      />
                      {/*
                        La caravana si la tiene; si no, la observación — que para las vacas de
                        descarte ES su identificación. Sin esto la lista eran varios «(sin número)»
                        indistinguibles y no se podía elegir cuál se vendió.
                      */}
                      <span className="min-w-0 flex-1">
                        {a.caravana
                          ? <>
                              <span className="font-mono">{a.caravana}</span>
                              {a.observaciones && (
                                <span className="ml-2 text-[10px] text-gray-500">{a.observaciones}</span>
                              )}
                            </>
                          : <span className="text-gray-700">
                              {a.observaciones || <span className="italic text-gray-400">sin identificar</span>}
                            </span>}
                      </span>
                      <span className="whitespace-nowrap text-[10px] text-gray-400">
                        {a.ultimoPeso != null ? `última: ${fmt(a.ultimoPeso)} kg` : "sin pesada"}
                      </span>
                      <Input
                        className="h-6 w-24 text-xs" type="text" placeholder="kg"
                        value={e?.kg ?? ""}
                        disabled={!e?.sel}
                        onChange={ev => setElegidos(prev => ({
                          ...prev, [a.id]: { sel: prev[a.id]?.sel ?? false, kg: ev.target.value },
                        }))}
                      />
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Animales sin caravana: se identifican con una observación, no se les inventa un número. */}
            {sueltos.map((x, i) => (
              <div key={i} className="flex items-center gap-2 border-t px-3 py-1 text-xs">
                <Input
                  className="h-6 flex-1 text-xs" placeholder="ej: vaca overa sin caravana"
                  value={x.descripcion}
                  onChange={ev => setSueltos(prev => prev.map((y, j) => j === i ? { ...y, descripcion: ev.target.value } : y))}
                />
                <Input
                  className="h-6 w-24 text-xs" placeholder="kg" value={x.kg}
                  onChange={ev => setSueltos(prev => prev.map((y, j) => j === i ? { ...y, kg: ev.target.value } : y))}
                />
                <button type="button" className="text-gray-400 hover:text-red-600"
                  onClick={() => setSueltos(prev => prev.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <div className="border-t px-3 py-1">
              <button type="button" className="text-[11px] text-blue-600 hover:underline"
                onClick={() => setSueltos(prev => [...prev, { descripcion: "", kg: "" }])}>
                + agregar un animal sin caravana
              </button>
            </div>
          </div>
        )}

        {/* ── Pesaje del camión ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Camión bruto</Label>
            <Input className="mt-1" type="text" placeholder="0,00" value={brutoCamion}
              onChange={e => setBrutoCamion(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Tara</Label>
            <Input className="mt-1" type="text" placeholder="0,00" value={taraCamion}
              onChange={e => setTaraCamion(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Neto del camión</Label>
            <div className="mt-1 flex h-9 items-center justify-between rounded border bg-gray-50 px-2 text-sm tabular-nums">
              <span>{fmt(netoCamion)}</span>
              {netoCamion != null && (
                <button type="button" className="text-[10px] text-blue-600 hover:underline"
                  onClick={() => setKgCarga(String(netoCamion).replace(".", ","))}>usar</button>
              )}
            </div>
          </div>
        </div>

        {/* El mismo número por dos caminos: si no coinciden, se muestra la diferencia. */}
        {kg != null && (kgAnimales > 0 || netoCamion != null) && (() => {
          const difAnim = kgAnimales > 0 ? kg - kgAnimales : null
          const difCam = netoCamion != null ? kg - netoCamion : null
          const hayDif = (difAnim != null && Math.abs(difAnim) > 0.5) || (difCam != null && Math.abs(difCam) > 0.5)
          return (
            <div className={`rounded border px-3 py-1.5 text-[11px] ${hayDif ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              {hayDif ? "⚠️ " : "✓ "}
              Kilos de carga <b>{fmt(kg)}</b>
              {difAnim != null && <> · animales {fmt(kgAnimales)} <b>({difAnim >= 0 ? "+" : ""}{fmt(difAnim)})</b></>}
              {difCam != null && <> · camión {fmt(netoCamion)} <b>({difCam >= 0 ? "+" : ""}{fmt(difCam)})</b></>}
              {!hayDif && " — cierran"}
            </div>
          )
        })()}

        {/* El control a la vista: los números que salen de lo cargado. */}
        <div className="rounded border bg-gray-50 px-3 py-2 text-xs">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <span className="text-gray-600">Neto de desbaste</span>
            <span className="text-right font-medium tabular-nums">{fmt(neto)} kg</span>
            {rindeReal != null && (
              <>
                <span className="text-gray-600">Rinde real <span className="text-gray-400">(carne ÷ neto)</span></span>
                <span className="text-right font-medium tabular-nums">{(rindeReal * 100).toFixed(1)} %</span>
              </>
            )}
            <span className="text-gray-600">Bruto</span>
            <span className="text-right font-medium tabular-nums">{bruto == null ? "—" : "$" + fmt(bruto)}</span>
            {czMonto != null && (
              <>
                <span className="text-gray-600">− CZ</span>
                <span className="text-right tabular-nums text-red-600">−${fmt(czMonto)}</span>
              </>
            )}
            <span className="font-semibold text-gray-800">Neto de la venta</span>
            <span className="text-right font-semibold tabular-nums">{netoFinal == null ? "—" : "$" + fmt(netoFinal)}</span>
          </div>
          {porQueNoHayImporte && (
            <p className="mt-1.5 border-t pt-1.5 text-[11px] text-amber-700">
              ⚠️ El importe queda vacío porque <b>{porQueNoHayImporte}</b>. Se guarda igual: la venta
              se completa a medida que llegan los datos.
            </p>
          )}
        </div>

        <div>
          <Label className="text-xs">Notas</Label>
          <Textarea className="mt-1" rows={2} value={notas} onChange={e => setNotas(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {movimiento.stock_venta_id ? "Guardar" : "Crear la venta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
