"use client"

// Entregas de un insumo y las facturas que las respaldan.
//
// ── Los tres momentos ────────────────────────────────────────────────────────
//
//     "compré tanto"   →   "recibí este día"   →   llegó la factura
//                          MUEVE EL STOCK          TRAE EL PRECIO
//
// Acá se une el segundo con el tercero. El primero todavía no existe en la app.
//
// ⚠️ El vínculo es MUCHOS A MUCHOS y tiene que serlo: la FC de Longo del 13/07 facturó 25 t de
// las que se habían entregado 20,1, y la del 14/08 facturó 20,1 de las 25 entregadas. Un
// `factura_id` en el movimiento obligaría a inventar una correspondencia que no existe.
//
// El cálculo vive en `lib/productivo/entregas-facturas.ts` y lo verifica
// `scripts/verificar-entregas-facturas.mts` con ese mismo caso.

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, Trash2, AlertTriangle, Check, X, Link2 } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import {
  conciliarEntregasFacturas, traerRespaldos,
  type EntregaInsumo, type FacturaCompra, type Vinculo,
} from "@/lib/productivo/entregas-facturas"

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const dmy = (f: string) => f.split("-").reverse().join("/")

export function PanelEntregasFacturas({ insumo, onCerrar }: {
  insumo: { id: string; producto: string; unidad_medida: string | null } | null
  onCerrar: () => void
}) {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [entregas, setEntregas] = useState<EntregaInsumo[]>([])
  const [facturas, setFacturas] = useState<FacturaCompra[]>([])
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  /** La entrega que se está vinculando. */
  const [vinculando, setVinculando] = useState<string | null>(null)
  const [busca, setBusca] = useState("")
  const [cant, setCant] = useState("")
  const [precio, setPrecio] = useState("")
  const [facElegida, setFacElegida] = useState("")

  const um = insumo?.unidad_medida || "kg"

  const cargar = useCallback(async () => {
    if (!insumo) return
    setCargando(true)
    try {
      const p = supabase.schema("productivo")
      const [{ data: movs }, { data: vs }] = await Promise.all([
        p.from("movimientos_insumos")
          .select("id, fecha, cantidad, costo_unitario, proveedor")
          .eq("insumo_stock_id", insumo.id).eq("tipo", "compra").order("fecha"),
        p.from("entrega_factura").select("*"),
      ])
      const es: EntregaInsumo[] = ((movs || []) as any[]).map(m => ({
        id: String(m.id), fecha: String(m.fecha),
        cantidad: Number(m.cantidad) || 0,
        proveedor: m.proveedor,
        costoUnitarioManual: m.costo_unitario == null ? null : Number(m.costo_unitario),
      }))
      setEntregas(es)
      const ids = new Set(es.map(e => e.id))
      setVinculos(((vs || []) as any[]).filter(v => ids.has(String(v.movimiento_id))).map(v => ({
        id: String(v.id), movimientoId: String(v.movimiento_id), facturaId: String(v.factura_id),
        cantidad: Number(v.cantidad) || 0,
        precioUnitario: v.precio_unitario == null ? null : Number(v.precio_unitario),
        origen: v.origen ?? 'arca',
      })))

      // Los respaldos: comprobantes de ARCA **y** cuotas de template. No todo gasto es una
      // factura — el maíz del 16/03 entró por template (A-FEAT-61).
      setFacturas(await traerRespaldos(supabase as never))
    } finally { setCargando(false) }
  }, [insumo])

  useEffect(() => { cargar() }, [cargar])

  const vincular = async () => {
    if (!vinculando || !facElegida || cant.trim() === "") return
    setGuardando(true)
    const { error } = await supabase.schema("productivo").from("entrega_factura").insert({
      movimiento_id: vinculando,
      factura_id: facElegida,
      cantidad: parseNumeroAR(cant),
      precio_unitario: precio.trim() === "" ? null : parseNumeroAR(precio),
      origen: facturas.find(f => f.id === facElegida)?.origen ?? "arca",
    })
    setGuardando(false)
    if (error) {
      alert(error.message.includes("duplicate")
        ? "Esa factura ya está vinculada a esta entrega. Editá la que está en vez de duplicarla."
        : "Error: " + error.message)
      return
    }
    setVinculando(null); setFacElegida(""); setCant(""); setPrecio(""); setBusca("")
    await cargar()
  }

  const desvincular = async (id: string) => {
    const { error } = await supabase.schema("productivo").from("entrega_factura").delete().eq("id", id)
    if (error) { alert("Error: " + error.message); return }
    await cargar()
  }

  const c = conciliarEntregasFacturas(entregas, facturas, vinculos)
  const candidatas = busca.trim() === "" ? [] : facturas.filter(f =>
    `${f.proveedor} ${f.numero}`.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 12)

  if (!insumo) return null

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Entregas y facturas — {insumo.producto}
          </DialogTitle>
        </DialogHeader>

        <p className="-mt-2 text-[11px] text-gray-500">
          La <strong>entrega mueve el stock</strong>; la <strong>factura trae el precio</strong>. No
          coinciden ni en fecha ni en cantidad, así que una factura puede cubrir parte de dos
          entregas y una entrega la pueden cubrir dos facturas.
          {" "}<strong>El respaldo también puede ser un template</strong> — no todo gasto entra
          por una factura de ARCA.
        </p>

        {cargando ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo…
          </div>
        ) : entregas.length === 0 ? (
          <p className="py-8 text-center text-[11px] text-gray-400">
            Este insumo no tiene entregas cargadas. Se cargan como movimientos de <strong>compra</strong>.
          </p>
        ) : (
          <div className="space-y-3">
            {c.entregas.map(e => (
              <div key={e.entrega.id} className="rounded border">
                <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-2 py-1.5">
                  <span className="text-[11px] font-medium text-gray-800">
                    {dmy(e.entrega.fecha)} · {fmtNumeroAR(e.entrega.cantidad, 0)} {um}
                  </span>
                  {e.entrega.proveedor && (
                    <span className="text-[10px] text-gray-500">{e.entrega.proveedor}</span>
                  )}
                  <span className="ml-auto text-[11px] text-gray-700">
                    {e.precioUnitario == null ? "sin precio" : `${pesos(e.precioUnitario)}/${um}`}
                    <span className={`ml-1 text-[9px] ${
                      e.origenPrecio === "facturas" ? "text-emerald-700"
                      : e.origenPrecio === "manual" ? "text-amber-700" : "text-gray-400"}`}>
                      {e.origenPrecio === "facturas" ? "de las facturas"
                        : e.origenPrecio === "manual" ? "a mano" : "sin dato"}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]"
                    onClick={() => {
                      setVinculando(vinculando === e.entrega.id ? null : e.entrega.id)
                      setCant(fmtNumeroAR(e.sinFacturar > 0 ? e.sinFacturar : e.entrega.cantidad, 0))
                    }}>
                    <Link2 className="mr-1 h-3 w-3" /> vincular
                  </Button>
                </div>

                <div className="px-2 py-1">
                  {e.vinculos.length === 0 ? (
                    <p className="py-1 text-[10px] text-gray-400">Sin facturas vinculadas.</p>
                  ) : e.vinculos.map(v => (
                    <div key={v.id} className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0">
                      <span className={`text-[10px] ${
                        v.origen === "template" ? "text-sky-700" : "text-gray-600"}`}>
                        {v.origen === "template" ? "Template" : "FC"}{" "}
                        {v.factura?.numero ?? "?"} · {v.factura ? dmy(v.factura.fecha) : "—"}
                      </span>
                      <span className="text-[10px] text-gray-500">{v.factura?.proveedor}</span>
                      <span className="ml-auto text-[11px] text-gray-700">
                        {fmtNumeroAR(v.cantidad, 0)} {um}
                        {v.precioUnitario != null && ` × ${pesos(v.precioUnitario)}`}
                      </span>
                      <button type="button" className="text-gray-300 hover:text-red-500"
                        onClick={() => desvincular(v.id)}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {e.faltantes.map((f, i) => (
                    <p key={i} className="py-0.5 text-[10px] text-amber-700">
                      <AlertTriangle className="mr-0.5 inline h-3 w-3" />{f}
                    </p>
                  ))}
                </div>

                {vinculando === e.entrega.id && (
                  <div className="space-y-1.5 border-t bg-slate-50 px-2 py-2">
                    <Input className="h-7 text-[11px]" placeholder="buscar factura por proveedor o número…"
                      value={busca} onChange={ev => setBusca(ev.target.value)} />
                    {candidatas.length > 0 && (
                      <div className="max-h-32 overflow-y-auto rounded border bg-white">
                        {candidatas.map(f => (
                          <button key={f.id} type="button"
                            onClick={() => { setFacElegida(f.id); setBusca(`${f.proveedor} · ${f.numero}`) }}
                            className={`flex w-full items-center gap-2 px-2 py-1 text-left text-[10px] hover:bg-gray-50
                              ${facElegida === f.id ? "bg-blue-50" : ""}`}>
                            <span className={f.origen === "template"
                              ? "font-medium text-sky-700" : "text-gray-700"}>
                              {f.origen === "template" ? "TEMPLATE" : f.proveedor}
                            </span>
                            <span className="text-gray-400">{f.numero}</span>
                            <span className="ml-auto text-gray-600">{dmy(f.fecha)} · {pesos(f.neto)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 text-[10px] text-gray-500">
                        cuánto cubre
                        <Input className="h-7 w-24 text-right text-[11px]" value={cant}
                          onChange={ev => setCant(ev.target.value)} />
                        {um}
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-gray-500">
                        $/{um}
                        <Input className="h-7 w-24 text-right text-[11px]" placeholder="0,00" value={precio}
                          onChange={ev => setPrecio(ev.target.value)} />
                      </label>
                      <Button size="sm" className="h-7 text-[11px]"
                        disabled={guardando || !facElegida || cant.trim() === ""}
                        onClick={vincular}>
                        {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="mr-1 h-3 w-3" /> vincular</>}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                        onClick={() => { setVinculando(null); setBusca(""); setFacElegida("") }}>
                        cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* ── Los controles: se ven cierren o no ─────────────────────── */}
            <div className="rounded border bg-white">
              <p className="border-b px-2 py-1 text-[9px] uppercase tracking-wide text-gray-500">
                Controles
              </p>
              {c.controles.map((ctl, i) => (
                <div key={i} className={`flex flex-wrap items-baseline gap-2 border-b px-2 py-1 last:border-0
                  ${ctl.cierra ? "" : "bg-amber-50"}`}>
                  {ctl.cierra
                    ? <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                    : <X className="h-3 w-3 shrink-0 text-amber-600" />}
                  <span className="text-[11px] font-medium text-gray-700">{ctl.nombre}</span>
                  <span className="ml-auto text-[10px] text-gray-600">{ctl.detalle}</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-gray-400">
              Lo que una factura tiene <strong>de más</strong> sobre lo entregado es un{" "}
              <strong>anticipo</strong>: mercadería pagada y todavía no recibida. Lo que una entrega
              tiene de más es mercadería recibida <strong>sin factura todavía</strong>. Las dos
              cosas son normales — lo que no es normal es no verlas.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
