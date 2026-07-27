"use client"

// VENTAS → Ganadería. Presupuesto de venta de destete por campaña.
// Modelo: solapa "Ganadería" de `- Desarrollo Presuesto..xlsx`.
// Igual que arrendamiento: la venta vive acá y Presupuesto la LEE.
// Los precios ($/kg por categoría) se cargan en Presupuesto → "Precios y TC".

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CentroCostoCombobox } from "@/components/ui/centro-costo-combobox"
import { Loader2, Plus, Trash2, Beef, Info } from "lucide-react"
import {
  calcularGanaderia, referenciaHistorica,
  type PresupuestoGanaderia, type PrecioHacienda, type CicloCria,
} from "@/lib/ganaderia/calculo"

const parseAR = (v: string) => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0
const fmtAR = (n: number | null | undefined, dec = 2) =>
  n == null ? "—" : Number(n).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtPesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const fmtPct = (n: number) => `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`

export function VistaGanaderia() {
  const [cargando, setCargando] = useState(true)
  const [filas, setFilas] = useState<PresupuestoGanaderia[]>([])
  const [precios, setPrecios] = useState<PrecioHacienda[]>([])
  const [ciclos, setCiclos] = useState<CicloCria[]>([])
  const [modal, setModal] = useState<Partial<PresupuestoGanaderia> | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [{ data: ps }, { data: pr }, { data: cc }] = await Promise.all([
        supabase.from("presupuesto_ganaderia").select("*").eq("activo", true)
          .order("campania"),
        supabase.from("precios_hacienda").select("categoria, anio, mes, precio_pesos_kg"),
        supabase.schema("productivo").from("ciclos_cria")
          .select("anio_servicio, cabezas_servicio, cabezas_prenadas, terneros_destetados, machos_destetados, hembras_destetados, kg_promedio"),
      ])
      setFilas((ps || []) as PresupuestoGanaderia[])
      setPrecios((pr || []) as PrecioHacienda[])
      setCiclos((cc || []) as CicloCria[])
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const ref = referenciaHistorica(ciclos)

  const guardar = async (p: any) => {
    const payload = {
      empresa: p.empresa || "MSA",
      campania: p.campania,
      centro_costo: p.centro_costo || null,
      descripcion: p.descripcion || null,
      stock_vientres: Math.round(parseAR(String(p.stock_vientres))),
      pct_destete: parseAR(String(p.pct_destete)) / 100,
      pct_machos: parseAR(String(p.pct_machos)) / 100,
      pct_reposicion: parseAR(String(p.pct_reposicion)) / 100,
      peso_macho_kg: parseAR(String(p.peso_macho_kg)),
      peso_hembra_kg: parseAR(String(p.peso_hembra_kg)),
      precio_kg_override: p.precio_kg_override ? parseAR(String(p.precio_kg_override)) : null,
      fecha_cobro_estimada: p.fecha_cobro_estimada,
      alicuota_iva: parseAR(String(p.alicuota_iva)) / 100,
      alicuota_iibb: parseAR(String(p.alicuota_iibb)) / 100,
      updated_at: new Date().toISOString(),
    }
    const { error } = p.id
      ? await supabase.from("presupuesto_ganaderia").update(payload).eq("id", p.id)
      : await supabase.from("presupuesto_ganaderia").insert(payload)
    if (error) { alert("Error: " + error.message); return }
    setModal(null)
    await cargar()
  }

  const baja = async (id: string) => {
    if (!confirm("¿Desactivar esta proyección?")) return
    await supabase.from("presupuesto_ganaderia").update({ activo: false }).eq("id", id)
    await cargar()
  }

  const nuevo = () => setModal({
    empresa: "MSA", campania: "", stock_vientres: ref?.vientres ?? 200,
    pct_destete: 0.85, pct_machos: 0.5, pct_reposicion: 0.2,
    peso_macho_kg: 200, peso_hembra_kg: 170,
    alicuota_iva: 0.105, alicuota_iibb: 0.01,
    fecha_cobro_estimada: "",
  } as any)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Ganadería — venta de destete</h3>
          <p className="text-sm text-gray-500">
            Proyección por campaña. Los precios <strong>$/kg</strong> se cargan en
            Presupuesto → “Precios y TC”.
          </p>
        </div>
        <Button size="sm" onClick={nuevo}><Plus className="mr-1 h-4 w-4" /> Nueva proyección</Button>
      </div>

      {ref && (
        <p className="flex items-start gap-2 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Referencia del ciclo {ref.anio} (real, de Productivo):</strong>{" "}
            {ref.vientres} vientres a servicio ·
            {ref.pct_destete != null && ` destete ${fmtPct(ref.pct_destete)} ·`}
            {ref.pct_machos != null && ` machos ${fmtPct(ref.pct_machos)} ·`}
            {ref.kg_promedio != null && ` ${fmtAR(ref.kg_promedio)} kg promedio`}.
            Es sólo referencia: no pisa lo que cargues.
          </span>
        </p>
      )}

      {cargando ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
        </div>
      ) : filas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          No hay proyecciones de ganadería cargadas.
        </CardContent></Card>
      ) : filas.map(p => {
        const r = calcularGanaderia(p, precios)
        return (
          <Card key={p.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Beef className="h-4 w-4" />
                  {p.descripcion || "Venta destete"}
                  <Badge variant="outline">{p.empresa}</Badge>
                  <Badge variant="outline">{p.campania}</Badge>
                  {p.centro_costo && <Badge variant="outline">{p.centro_costo}</Badge>}
                  <span className="text-sm font-normal text-gray-500">
                    cobro {new Date(p.fecha_cobro_estimada + "T00:00:00").toLocaleDateString("es-AR")}
                  </span>
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setModal({
                    ...p,
                    pct_destete: (Number(p.pct_destete) * 100) as any,
                    pct_machos: (Number(p.pct_machos) * 100) as any,
                    pct_reposicion: (Number(p.pct_reposicion) * 100) as any,
                    alicuota_iva: (Number(p.alicuota_iva) * 100) as any,
                    alicuota_iibb: (Number(p.alicuota_iibb) * 100) as any,
                  })}>Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => baja(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              </CardTitle>
              <p className="text-xs text-gray-500">
                {p.stock_vientres} vientres × {fmtPct(Number(p.pct_destete))} destete ={" "}
                <strong>{fmtAR(r.terneros, 0)} terneros</strong> · reposición{" "}
                {fmtPct(Number(p.pct_reposicion))} sobre vientres
              </p>
            </CardHeader>

            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600">
                  <tr className="border-y">
                    <th className="px-3 py-2 text-left">Categoría</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                    <th className="px-3 py-2 text-right">Reposición</th>
                    <th className="px-3 py-2 text-right">Venta</th>
                    <th className="px-3 py-2 text-right">Peso</th>
                    <th className="px-3 py-2 text-right">Kg totales</th>
                    <th className="px-3 py-2 text-right">Precio $/kg</th>
                    <th className="px-3 py-2 text-right">Neto</th>
                    <th className="px-3 py-2 text-right">IVA</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lineas.map(l => (
                    <tr key={l.categoria} className="border-b">
                      <td className="px-3 py-2">{l.categoria}</td>
                      <td className="px-3 py-2 text-right">{fmtAR(l.cabezas_destete, 0)}</td>
                      <td className="px-3 py-2 text-right text-amber-700">
                        {l.reposicion > 0 ? `−${fmtAR(l.reposicion, 0)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{fmtAR(l.cabezas_venta, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmtAR(l.peso_kg, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmtAR(l.kg_totales, 0)}</td>
                      <td className="px-3 py-2 text-right">
                        {l.precio_kg > 0 ? fmtAR(l.precio_kg) : <span className="text-red-500">sin precio</span>}
                        {l.precio_manual && <span className="ml-1 text-blue-500" title="Precio manual de la fila">m</span>}
                        {l.precio_arrastrado && <span className="ml-1 text-amber-500" title="Arrastrado de otro mes">*</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{fmtPesos(l.neto)}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{fmtPesos(l.iva)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtPesos(l.total)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 bg-gray-50 font-semibold">
                    <td className="px-3 py-2">Venta Destete</td>
                    <td className="px-3 py-2 text-right">{fmtAR(r.terneros, 0)}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right">{fmtAR(r.cabezas_venta, 0)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {r.cabezas_venta > 0 ? fmtAR(r.kg_totales / r.cabezas_venta, 1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{fmtAR(r.kg_totales, 0)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {r.kg_totales > 0 ? fmtAR(r.neto / r.kg_totales) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{fmtPesos(r.neto)}</td>
                    <td className="px-3 py-2 text-right">{fmtPesos(r.iva)}</td>
                    <td className="px-3 py-2 text-right">{fmtPesos(r.total)}</td>
                  </tr>
                </tbody>
              </table>

              <p className="px-3 py-2 text-xs text-gray-500">
                IIBB {fmtPct(Number(p.alicuota_iibb))} sobre el neto ={" "}
                <strong>{fmtPesos(r.iibb)}</strong>, a pagar en <strong>{r.mes_pago_iibb}</strong>{" "}
                (mes siguiente al cobro).
                {r.estimado && <span className="ml-2 text-amber-600">⚠ falta cargar algún precio $/kg</span>}
              </p>
            </CardContent>
          </Card>
        )
      })}

      <ModalGanaderia datos={modal} referencia={ref} onCerrar={() => setModal(null)} onGuardar={guardar} />
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ModalGanaderia({ datos, referencia, onCerrar, onGuardar }: {
  datos: any
  referencia: ReturnType<typeof referenciaHistorica>
  onCerrar: () => void
  onGuardar: (p: any) => Promise<void>
}) {
  const [f, setF] = useState<any>({})
  useEffect(() => { if (datos) setF({ ...datos }) }, [datos])
  if (!datos) return null

  const campo = (k: string, label: string, ayuda?: string, tipo = "text") => (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <Input type={tipo} className="h-8 text-right" value={f[k] ?? ""}
        onChange={e => setF({ ...f, [k]: e.target.value })} />
      {ayuda && <p className="mt-1 text-[10px] text-gray-400">{ayuda}</p>}
    </div>
  )

  const submit = () => {
    if (!f.campania || !f.fecha_cobro_estimada || !f.stock_vientres) {
      alert("Campaña, fecha de cobro y stock de vientres son obligatorios")
      return
    }
    onGuardar(f)
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{datos.id ? "Editar proyección" : "Nueva proyección de ganadería"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500">Campaña</label>
            <Input className="h-8" placeholder="26/27" value={f.campania || ""}
              onChange={e => setF({ ...f, campania: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Descripción</label>
            <Input className="h-8" placeholder="Venta destete" value={f.descripcion || ""}
              onChange={e => setF({ ...f, descripcion: e.target.value })} />
          </div>

          <div className="col-span-2">
            <label className="text-xs text-gray-500">Campo (centro de costo)</label>
            <CentroCostoCombobox value={f.centro_costo || ""} onValueChange={v => setF({ ...f, centro_costo: v })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Fecha de cobro</label>
            <Input type="date" className="h-8" value={f.fecha_cobro_estimada || ""}
              onChange={e => setF({ ...f, fecha_cobro_estimada: e.target.value })} />
          </div>

          {campo("stock_vientres", "Stock vientres",
            referencia ? `Real ciclo ${referencia.anio}: ${referencia.vientres}` : undefined)}
          {campo("pct_destete", "% Destete",
            referencia?.pct_destete != null ? `Real: ${fmtPct(referencia.pct_destete)}` : undefined)}
          {campo("pct_machos", "% Machos",
            referencia?.pct_machos != null ? `Real: ${fmtPct(referencia.pct_machos)}` : undefined)}

          {campo("pct_reposicion", "% Reposición", "sobre vientres, sale de hembras")}
          {campo("peso_macho_kg", "Peso macho (kg)",
            referencia?.kg_promedio != null ? `Prom. real: ${fmtAR(referencia.kg_promedio)}` : undefined)}
          {campo("peso_hembra_kg", "Peso hembra (kg)")}

          {campo("precio_kg_override", "Precio $/kg (opcional)", "vacío = usa Precios y TC")}
          {campo("alicuota_iva", "% IVA", "ganadería 10,5")}
          {campo("alicuota_iibb", "% IIBB", "ganadería 1 — mes siguiente")}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={submit}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
