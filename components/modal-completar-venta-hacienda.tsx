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

  useEffect(() => {
    if (!abierto || !movimiento) return
    supabase.schema("productivo").from("destinos_venta").select("id, nombre, compra_en")
      .then(({ data }) => setDestinos(data ?? []))
    setCliente({ cuit: movimiento.cuit ?? "", nombre: movimiento.proveedor_cliente ?? "" })
    setKgCarga(movimiento.peso_total_kg != null ? String(movimiento.peso_total_kg).replace(".", ",") : "")
    setPrecio(movimiento.precio_por_kg != null ? String(movimiento.precio_por_kg).replace(".", ",") : "")
    setDesbaste(""); setCz(""); setKgCarne(""); setDestinoId(""); setNotas("")

    // Si la venta ya existe, se traen SUS valores: la ventana edita la venta, no la duplica.
    if (movimiento.stock_venta_id) {
      supabase.schema("productivo").from("stock_ventas")
        .select("destino_id, pct_desbaste, pct_cz, kg_totales, precio_kg, kg_carne, cliente_cuit, cliente_nombre, notas")
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
        })
    }
  }, [abierto, movimiento])

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
