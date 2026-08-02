"use client"

// Presupuestar una venta de hacienda SIN salir del presupuesto.
//
// El usuario ve una celda ámbar ("43 cab · 207 kg prom") y quiere convertirla en plata ahí
// mismo: *"así no salgo de él para ir haciendo ese trabajo"*.
//
// Es a propósito un formulario chico, no el editor completo de lotes. Acá se decide lo mínimo
// —cuántas, cuándo y a cuánto— con los defaults de la tabla; el ajuste fino (ganancia diaria,
// tramos de actividad, desbaste por fuera de la tabla) sigue estando en Productivo → Evolución
// Rodeo, y desde ahí se edita el mismo lote.

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import {
  pctDesbaste, pctCz, categoriaPrecio, resolverPrecioHacienda, type PrecioHacienda,
} from "@/lib/ganaderia/calculo"

export interface DatosPresupuestar {
  /** `ciclo:<uuid>|tropa` o `pesada|tropa` — de ahí sale a qué ciclo pertenece. */
  clave: string
  categoria: string
  /** Mes en que están disponibles, `YYYY-MM`. */
  mes: string
  cabezas: number
  pesoProm: number
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

/** Último día del mes, sin armarlo concatenando "-31" (ver KNOWLEDGE.md). */
function finDeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number)
  const d = new Date(a!, m!, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function ModalPresupuestarVenta({ datos, precios, onCerrar, onGuardado }: {
  datos: DatosPresupuestar | null
  precios: PrecioHacienda[]
  onCerrar: () => void
  onGuardado: () => Promise<void>
}) {
  const [cabezas, setCabezas] = useState("")
  const [fecha, setFecha] = useState("")
  const [precio, setPrecio] = useState("")
  const [plazo, setPlazo] = useState("0")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!datos) return
    setCabezas(fmtNumeroAR(datos.cabezas, 0))
    // Por defecto se vende cuando se disponibiliza: es el escenario más simple y el usuario
    // corre la fecha si quiere retenerlas.
    setFecha(finDeMes(datos.mes))
    setPlazo("0")
    const banda = categoriaPrecio(datos.categoria, datos.pesoProm)
    const [a, m] = datos.mes.split("-").map(Number)
    const p = resolverPrecioHacienda(precios, banda, a!, m!, null)
    setPrecio(p.precio_pesos_kg > 0 ? fmtNumeroAR(p.precio_pesos_kg) : "")
  }, [datos, precios])

  if (!datos) return null

  const cab = parseNumeroAR(cabezas)
  const pr = parseNumeroAR(precio)
  const banda = categoriaPrecio(datos.categoria, datos.pesoProm)
  const desb = pctDesbaste(datos.categoria, datos.pesoProm)
  const cz = pctCz(datos.categoria, datos.pesoProm)

  const kgBrutos = cab * datos.pesoProm
  const kgNetos = kgBrutos * (1 - desb)
  const ventaNeta = kgNetos * pr
  const iva = ventaNeta * 0.105
  const comision = ventaNeta * cz
  const ingresa = ventaNeta + iva - comision

  const excede = cab > datos.cabezas + 0.01

  const guardar = async () => {
    if (cab <= 0 || !fecha) { alert("Poné cuántas cabezas y cuándo se venden."); return }
    setGuardando(true)
    // La clave dice de qué tropa salen: si vienen de un ciclo hay que guardar el `ciclo_id`
    // para que el neteo por diferencia las descuente de la existencia correcta.
    const cicloId = datos.clave.startsWith("ciclo:")
      ? datos.clave.slice("ciclo:".length).split("|")[0]
      : null
    const disponible = `${datos.mes}-01`
    const { error } = await supabase.schema("productivo").from("stock_lotes").insert({
      empresa: "MSA",
      ciclo_id: cicloId,
      categoria: datos.categoria,
      origen: cicloId ? "destete" : "stock_inicial",
      cantidad: cab,
      fecha_disponible: disponible,
      peso_base_kg: datos.pesoProm,
      fecha_peso: disponible,
      // Sin ganancia diaria el peso no crece: es lo honesto para una venta cargada al toque.
      // Se le pone actividad en Productivo si se la va a retener.
      ganancia_diaria_kg: 0,
      fecha_venta_estimada: fecha,
      precio_kg_override: pr > 0 ? pr : null,
      plazo_cobro: plazo.trim() || "0",
      pct_desbaste: desb,
      pct_cz: cz,
      alicuota_iva: 0.105,
      alicuota_iibb: 0.01,
      notas: "Presupuestada desde el Presupuesto",
    })
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    await onGuardado()
    onCerrar()
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Presupuestar venta — {datos.categoria}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Hay <strong>{Math.round(datos.cabezas).toLocaleString("es-AR")} cabezas</strong> de{" "}
            <strong>{fmtNumeroAR(datos.pesoProm, 1)} kg</strong> promedio disponibles desde{" "}
            {datos.mes}. Banda de precio: <strong>{banda}</strong>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Cabezas a vender</label>
              <Input className="h-8 text-right" value={cabezas}
                onChange={e => setCabezas(e.target.value)} />
              {excede && (
                <p className="mt-0.5 text-[10px] text-amber-600">
                  Más de las disponibles ({Math.round(datos.cabezas)})
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500">Fecha de venta</label>
              <Input type="date" className="h-8" value={fecha}
                onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Precio $/kg bruto</label>
              <Input className="h-8 text-right" value={precio} placeholder="de la banda"
                onChange={e => setPrecio(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Plazo de cobro</label>
              <Input className="h-8 text-right" value={plazo} placeholder="0/30/60"
                onChange={e => setPlazo(e.target.value)} />
            </div>
          </div>

          {pr > 0 && cab > 0 && (
            <table className="w-full text-[11px]">
              <tbody>
                {[
                  ["Kg brutos", `${Math.round(kgBrutos).toLocaleString("es-AR")} kg`, ""],
                  [`− Desbaste ${(desb * 100).toFixed(0)} %`, `−${Math.round(kgBrutos - kgNetos).toLocaleString("es-AR")} kg`, "text-amber-700"],
                  ["Kg netos", `${Math.round(kgNetos).toLocaleString("es-AR")} kg`, "font-medium"],
                  ["Venta neta", pesos(ventaNeta), "font-medium"],
                  ["+ IVA 10,5 %", pesos(iva), "text-gray-500"],
                  [`− Comisión ${(cz * 100).toFixed(0)} %`, `−${pesos(comision)}`, "text-amber-700"],
                  ["INGRESA", pesos(ingresa), "font-bold text-emerald-800"],
                ].map(([l, v, c]) => (
                  <tr key={l as string} className="border-b border-gray-100 last:border-0">
                    <td className={`py-0.5 ${c}`}>{l}</td>
                    <td className={`py-0.5 text-right ${c}`}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="text-[10px] text-gray-400">
            El desbaste y la comisión salen de la tabla según el peso. Para retenerlas y que
            engorden, asignale una actividad en Productivo → Evolución Rodeo.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onCerrar}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando || cab <= 0}
              className="bg-emerald-700 hover:bg-emerald-800">
              {guardando && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Presupuestar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
