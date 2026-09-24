"use client"

/**
 * 🚚 El FLETE de una carga, y su compromiso de pago — A-FEAT-98.
 *
 * ## Por qué acá y no en la pantalla de anticipos
 * Textual del usuario: *«probablemente sería bueno usar el script de anticipo (porque como no llega
 * factura ésa es nuestra vía) pero no generarlo desde el anticipo sino desde la venta, que tiene los
 * campos de la CZ para dar el total a registrarse como anticipo»*.
 *
 * O sea: **la fila vive en `anticipos_proveedores`** —porque el anticipo es el camino por el que un
 * pago sin factura entra al Cash Flow— pero **se crea y se edita desde acá**, que es donde están los
 * datos que lo determinan. Cargar el flete en la pantalla de anticipos obligaría a saber el total de
 * memoria; acá sale del seteo.
 *
 * ## Por qué de la CARGA y no de la venta
 * Un camión, un flete — aunque lleve varias ventas. Es la misma razón por la que el romaneo cuelga
 * de la carga (`MODULO_HACIENDA` § 19.4): repartirlo por venta antes de tiempo obliga a inventar un
 * criterio de reparto que nadie pidió.
 *
 * ## El seteo
 * *«El arranque km, camino elegido, editable»*. El **arranque** son los km mínimos que se cobran
 * igual aunque el viaje sea más corto: sin eso, un flete corto se subestima siempre.
 */

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

const aNum = (v: string): number | null => {
  const t = String(v ?? "").trim()
  if (!t) return null
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."))
  return isNaN(n) ? null : n
}
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface CargaOpcion {
  id: string; fecha: string | null; cliente_nombre: string | null
  peso_bruto: number | null; peso_tara: number | null
}

export function ModalFleteCarga({
  abierto, onCerrar, cargaId: cargaFija, onGuardado,
}: {
  abierto: boolean
  onCerrar: () => void
  cargaId?: string | null
  onGuardado?: () => void
}) {
  const [cargas, setCargas] = useState<CargaOpcion[]>([])
  const [cargaSel, setCargaSel] = useState("")
  const cargaId = cargaFija ?? (cargaSel || null)

  const [km, setKm] = useState("")
  const [arranque, setArranque] = useState("")
  const [precioKm, setPrecioKm] = useState("")
  const [camino, setCamino] = useState("")
  const [totalManual, setTotalManual] = useState("")
  const [cuit, setCuit] = useState("")
  const [nombre, setNombre] = useState("")
  const [fechaPago, setFechaPago] = useState("")
  const [notas, setNotas] = useState("")
  const [anticipoId, setAnticipoId] = useState<string | null>(null)
  const [sugerencias, setSugerencias] = useState<{ cuit: string; razon_social: string }[]>([])
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    supabase.schema("productivo").from("cargas")
      .select("id, fecha, cliente_nombre, peso_bruto, peso_tara")
      .order("fecha", { ascending: false }).limit(50)
      .then(({ data }) => setCargas((data ?? []) as CargaOpcion[]))
  }, [abierto])

  // Al elegir la carga se trae lo que ya tenga: esto se EDITA, no se recarga de cero.
  useEffect(() => {
    if (!cargaId) return
    setCargando(true)
    supabase.schema("productivo").from("cargas")
      .select("flete, flete_km, flete_km_arranque, flete_precio_km, flete_camino, flete_transportista_cuit, flete_transportista_nombre, flete_fecha_pago, flete_notas, flete_anticipo_id")
      .eq("id", cargaId).maybeSingle()
      .then(({ data }) => {
        const d = (data ?? {}) as Record<string, unknown>
        setKm(d.flete_km != null ? String(d.flete_km) : "")
        setArranque(d.flete_km_arranque != null ? String(d.flete_km_arranque) : "")
        setPrecioKm(d.flete_precio_km != null ? String(d.flete_precio_km) : "")
        setCamino((d.flete_camino as string) ?? "")
        setCuit((d.flete_transportista_cuit as string) ?? "")
        setNombre((d.flete_transportista_nombre as string) ?? "")
        setFechaPago((d.flete_fecha_pago as string) ?? "")
        setNotas((d.flete_notas as string) ?? "")
        setAnticipoId((d.flete_anticipo_id as string) ?? null)
        setCargando(false)
      })
  }, [cargaId])

  // Sugerencias del maestro para no tipear el CUIT: el transportista casi siempre ya existe.
  useEffect(() => {
    if (!abierto) return
    supabase.from("proveedores").select("cuit, razon_social").eq("es_proveedor", true)
      .order("razon_social").limit(400)
      .then(({ data }) => setSugerencias((data ?? []) as { cuit: string; razon_social: string }[]))
  }, [abierto])

  // Si el nombre coincide con uno del maestro, se completa el CUIT solo (y no se pisa si ya hay uno).
  const buscarCuit = () => {
    if (cuit.trim()) return
    const p = sugerencias.find(x => (x.razon_social ?? "").toLowerCase() === nombre.trim().toLowerCase())
    if (p?.cuit) setCuit(p.cuit)
  }

  // Km facturables: el ARRANQUE es un mínimo, no un extra. Si el viaje es más corto se cobra igual.
  const kmReal = aNum(km)
  const kmMin = aNum(arranque)
  const kmFacturables = kmReal == null ? null : (kmMin != null && kmMin > kmReal ? kmMin : kmReal)
  const pk = aNum(precioKm)
  const calculado = kmFacturables != null && pk != null ? Math.round(kmFacturables * pk * 100) / 100 : null
  // Igual que en el resto de la app: el campo vacío usa el dato real; escrito, manda el usuario.
  const total = aNum(totalManual) ?? calculado

  const guardar = async () => {
    if (!cargaId) { toast.error("Elegí la carga"); return }
    if (total == null || total <= 0) { toast.error("Falta el total del flete"); return }
    if (!cuit && !nombre) { toast.error("Falta el transportista: sin él no se puede comprometer el pago"); return }
    setGuardando(true)
    try {
      const cuitLimpio = (cuit || "").replace(/\D/g, "")

      // 1) La contraparte va al maestro. Upsert, nunca sólo UPDATE (regla 👥 de CLAUDE.md):
      //    un UPDATE que no matchea no falla, y el hueco queda invisible aguas abajo.
      if (cuitLimpio) {
        const { data: ex } = await supabase.from("proveedores").select("cuit").eq("cuit", cuitLimpio).maybeSingle()
        if (!ex) await supabase.from("proveedores").insert({ cuit: cuitLimpio, razon_social: nombre || "SIN NOMBRE", es_proveedor: true })
        else await supabase.from("proveedores").update({ es_proveedor: true }).eq("cuit", cuitLimpio)
      }

      // 2) El compromiso de pago. Se ACTUALIZA si ya existe: volver a guardar el flete no puede
      //    dejar dos compromisos por el mismo viaje en el Cash Flow.
      const filaAnticipo = {
        cuit_proveedor: cuitLimpio || null,
        nombre_proveedor: nombre || null,
        monto: total,
        monto_restante: total,
        fecha_pago: fechaPago || null,
        descripcion: `Flete hacienda${camino ? ` — ${camino}` : ""}${kmFacturables ? ` (${kmFacturables} km)` : ""}`,
        tipo: "pago",
        estado: "pendiente_vincular",
        estado_pago: "pendiente",
        empresa: "MSA",
      }
      let idAnt = anticipoId
      if (idAnt) {
        const { error } = await supabase.from("anticipos_proveedores").update(filaAnticipo).eq("id", idAnt)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from("anticipos_proveedores").insert(filaAnticipo).select("id").single()
        if (error) throw error
        idAnt = (data as { id: string }).id
        setAnticipoId(idAnt)
      }

      // 3) El seteo queda en la carga, para poder recalcular y auditar de dónde salió el número.
      const { error: e3 } = await supabase.schema("productivo").from("cargas").update({
        flete: total, flete_km: kmReal, flete_km_arranque: kmMin, flete_precio_km: pk,
        flete_camino: camino || null, flete_transportista_cuit: cuitLimpio || null,
        flete_transportista_nombre: nombre || null, flete_fecha_pago: fechaPago || null,
        flete_notas: notas || null, flete_anticipo_id: idAnt,
      }).eq("id", cargaId)
      if (e3) throw e3

      toast.success(`Flete ${fmt(total)} guardado · compromiso ${anticipoId ? "actualizado" : "creado"} en el Cash Flow`)
      onGuardado?.()
      onCerrar()
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally { setGuardando(false) }
  }

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>🚚 Flete de la carga</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!cargaFija && (
            <div>
              <Label className="text-[10px] text-gray-500">
                ¿De qué carga? <span className="text-gray-400">— un camión, un flete, aunque lleve varias ventas</span>
              </Label>
              <select className="mt-1 h-8 w-full rounded border px-2 text-xs" value={cargaSel}
                onChange={e => setCargaSel(e.target.value)}>
                <option value="">— elegir la carga —</option>
                {cargas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.fecha ?? "sin fecha"} · {c.cliente_nombre ?? "sin cliente"}
                    {c.peso_bruto != null && c.peso_tara != null ? ` · ${(c.peso_bruto - c.peso_tara).toLocaleString("es-AR")} kg` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {cargando ? (
            <p className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
          ) : (
            <>
              <div className="rounded border p-2">
                <div className="mb-2 text-xs font-medium">El seteo</div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Label className="text-[10px] text-gray-500">Camino elegido</Label>
                    <Input className="h-7 text-xs" placeholder="Ruta 8 / camino viejo…" value={camino} onChange={e => setCamino(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">Km del recorrido</Label>
                    <Input type="text" className="h-7 text-xs" value={km} onChange={e => setKm(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500" title="Km mínimos: si el viaje es más corto, se cobran igual">
                      Arranque (km mín.)
                    </Label>
                    <Input type="text" className="h-7 text-xs" value={arranque} onChange={e => setArranque(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">$ por km</Label>
                    <Input type="text" placeholder="0,00" className="h-7 text-xs" value={precioKm} onChange={e => setPrecioKm(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">Total (si lo acordaste a monto)</Label>
                    <Input type="text" placeholder={calculado != null ? calculado.toLocaleString("es-AR", { minimumFractionDigits: 2 }) : "0,00"}
                      className="h-7 text-xs" value={totalManual} onChange={e => setTotalManual(e.target.value)} />
                  </div>
                </div>
                <div className={`mt-2 rounded px-2 py-1.5 text-[11px] ${total != null ? "bg-emerald-50 text-emerald-800" : "bg-gray-50 text-gray-500"}`}>
                  {kmFacturables != null && pk != null ? (
                    <>
                      {kmFacturables} km {kmMin != null && kmReal != null && kmMin > kmReal && <b>(arranque, el viaje fue de {kmReal})</b>}
                      {" × "}{fmt(pk)}/km = <b>{fmt(calculado)}</b>
                      {aNum(totalManual) != null && <> · <b>a mano: {fmt(aNum(totalManual))}</b></>}
                    </>
                  ) : total != null ? <>Total del flete: <b>{fmt(total)}</b></>
                    : "Cargá km + $/km, o el total acordado."}
                </div>
              </div>

              <div className="rounded border p-2">
                <div className="mb-2 text-xs font-medium">
                  El compromiso de pago
                  <span className="ml-2 font-normal text-gray-400">se registra como anticipo — es la vía cuando no llega factura</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label className="text-[10px] text-gray-500">Transportista</Label>
                    <Input className="h-7 text-xs" list="transportistas-flete" placeholder="Razón social"
                      value={nombre} onChange={e => setNombre(e.target.value)} onBlur={buscarCuit} />
                    <datalist id="transportistas-flete">
                      {sugerencias.map(p2 => <option key={p2.cuit} value={p2.razon_social} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">CUIT</Label>
                    <Input className="h-7 text-xs" value={cuit} onChange={e => setCuit(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">Fecha estimada de pago</Label>
                    <Input type="date" className="h-7 text-xs" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px] text-gray-500">Notas</Label>
                    <Input className="h-7 text-xs" value={notas} onChange={e => setNotas(e.target.value)} />
                  </div>
                </div>
                {anticipoId && (
                  <p className="mt-2 text-[10px] text-amber-700">
                    ⚠️ Ya hay un compromiso creado para esta carga: al guardar <b>se actualiza</b>, no se duplica.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
                <Button onClick={guardar} disabled={guardando || !cargaId}>
                  {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Guardar y comprometer el pago
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
