"use client"

// PRESUPUESTAR una venta desde las cabezas que todavía no la tienen.
//
// La capa 2 de *Ingresos → Ganadería* muestra lo que existe y nadie decidió cuándo vender. Este
// modal es el paso que faltaba: decidirlo ahí mismo, sin ir a buscar otra pantalla.
//
// ⚠️ Es el CUARTO camino que crea un lote —hay alta manual, generación desde el rodeo y carga
// desde una pesada—. Por eso los campos y sus defaults viven en `lib/ganaderia/lote-venta.ts` y no
// acá: la tabla ya era una sola, lo que hay que asegurar es que **ninguno de los cuatro escriba un
// lote a medias**. Un lote sin desbaste o sin ciclo se proyecta mal y nadie se entera.

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { useNormasComercializacion } from "@/components/selector-comercializacion"
import {
  DEFAULTS_LOTE, desbasteSugerido, payloadLoteVenta, faltantesDeLote,
} from "@/lib/ganaderia/lote-venta"

export interface DisponibleAPresupuestar {
  categoria: string
  /** Cabezas que quedan sin venta. Es el techo. */
  cabezas: number
  pesoProm: number
  /** Mes en que quedaron disponibles, `YYYY-MM`. */
  mes: string
  detalle?: string
  empresa: string
  cicloId: string | null
  cicloRecriaId: string | null
}

export function ModalPresupuestarLote({ disponible, onCerrar, onCreado }: {
  disponible: DisponibleAPresupuestar | null
  onCerrar: () => void
  onCreado: () => void
}) {
  const normas = useNormasComercializacion()
  const [guardando, setGuardando] = useState(false)

  const [cabezas, setCabezas] = useState("")
  const [peso, setPeso] = useState("")
  const [fechaVenta, setFechaVenta] = useState("")
  const [ganancia, setGanancia] = useState("")
  const [precio, setPrecio] = useState("")
  const [desbaste, setDesbaste] = useState("")
  const [cz, setCz] = useState("")
  const [plazo, setPlazo] = useState("")
  const [iva, setIva] = useState("")
  const [iibb, setIibb] = useState("")
  const [notas, setNotas] = useState("")

  useEffect(() => {
    if (!disponible) return
    setCabezas(String(Math.round(disponible.cabezas)))
    setPeso(fmtNumeroAR(disponible.pesoProm, 1))
    setFechaVenta("")
    setGanancia(fmtNumeroAR(DEFAULTS_LOTE.ganancia_diaria_kg, 3))
    setPrecio("")
    setCz(fmtNumeroAR(DEFAULTS_LOTE.pct_cz * 100, 2))
    setPlazo(DEFAULTS_LOTE.plazo_cobro)
    setIva(fmtNumeroAR(DEFAULTS_LOTE.alicuota_iva * 100, 2))
    setIibb(fmtNumeroAR(DEFAULTS_LOTE.alicuota_iibb * 100, 2))
    setNotas("")
  }, [disponible?.categoria, disponible?.mes])

  // El desbaste sale de las NORMAS según categoría y peso, no de un 5 % fijo. Se precarga cuando
  // llegan las normas y queda editable.
  useEffect(() => {
    if (!disponible || normas.desbaste.length === 0) return
    setDesbaste(fmtNumeroAR(
      desbasteSugerido(normas.desbaste, disponible.categoria, disponible.pesoProm) * 100, 2))
  }, [disponible?.categoria, disponible?.pesoProm, normas.desbaste.length])

  if (!disponible) return null

  const nCab = Math.round(parseNumeroAR(cabezas))
  const nPeso = parseNumeroAR(peso)
  const excede = nCab > disponible.cabezas + 0.01

  const datos = {
    empresa: disponible.empresa,
    categoria: disponible.categoria,
    cantidad: nCab,
    peso_base_kg: nPeso,
    fecha_peso: `${disponible.mes}-01`,
    fecha_disponible: `${disponible.mes}-01`,
    fecha_venta_estimada: fechaVenta || null,
    ganancia_diaria_kg: parseNumeroAR(ganancia),
    // Vacío = lo resuelve la tabla de precios por banda de peso, que es lo habitual.
    precio_kg_override: precio.trim() ? parseNumeroAR(precio) : null,
    pct_desbaste: parseNumeroAR(desbaste) / 100,
    pct_cz: parseNumeroAR(cz) / 100,
    plazo_cobro: plazo || "0",
    alicuota_iva: parseNumeroAR(iva) / 100,
    alicuota_iibb: parseNumeroAR(iibb) / 100,
    ciclo_id: disponible.cicloId,
    ciclo_recria_id: disponible.cicloRecriaId,
    origen: "presupuestado",
    notas: [notas.trim(), `Presupuestado desde Ingresos · ${disponible.detalle ?? ""}`.trim()]
      .filter(Boolean).join(" — "),
  }

  const faltantes = faltantesDeLote(datos)
  const puede = faltantes.length === 0 && !excede && !guardando

  const guardar = async () => {
    setGuardando(true)
    try {
      const { error } = await supabase.schema("productivo").from("stock_lotes")
        .insert(payloadLoteVenta(datos))
      if (error) { alert("Error: " + error.message); return }
      onCreado(); onCerrar()
    } finally { setGuardando(false) }
  }

  const inp = "h-7 rounded border px-1 text-right text-[11px]"

  return (
    <Dialog open onOpenChange={o => { if (!o && !guardando) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Presupuestar venta — {disponible.categoria}
            <Badge variant="outline" className="text-[10px]">
              {Math.round(disponible.cabezas)} cab sin venta
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-900">
            Queda como <strong>presupuestada</strong> y entra al Presupuesto. Cuando se venda de
            verdad se confirma desde acá mismo, con las caravanas.
          </p>

          <div className="grid gap-2 sm:grid-cols-3">
            <Campo label="Cabezas" ayuda={`Máximo ${Math.round(disponible.cabezas)}`}>
              <input type="text" className={`${inp} w-20 ${excede ? "border-red-400 bg-red-50" : ""}`}
                value={cabezas} onChange={e => setCabezas(e.target.value)} />
            </Campo>
            <Campo label="Peso hoy" ayuda={disponible.detalle}>
              <input type="text" className={`${inp} w-24`} value={peso}
                onChange={e => setPeso(e.target.value)} />
            </Campo>
            <Campo label="Ganancia kg/día" ayuda="Para proyectar el peso a la venta">
              <input type="text" className={`${inp} w-20`} value={ganancia}
                onChange={e => setGanancia(e.target.value)} />
            </Campo>
            <Campo label="Fecha de venta">
              <input type="date" className="h-7 rounded border px-1 text-[11px]"
                value={fechaVenta} onChange={e => setFechaVenta(e.target.value)} />
            </Campo>
            <Campo label="Desbaste %" ayuda="Sugerido por las normas según categoría y peso">
              <input type="text" className={`${inp} w-16`} value={desbaste}
                onChange={e => setDesbaste(e.target.value)} />
            </Campo>
            <Campo label="CZ %">
              <input type="text" className={`${inp} w-16`} value={cz}
                onChange={e => setCz(e.target.value)} />
            </Campo>
            <Campo label="$/kg" ayuda="Vacío = lo toma de Precios y TC por banda de peso">
              <input type="text" className={`${inp} w-24`} value={precio} placeholder="de la tabla"
                onChange={e => setPrecio(e.target.value)} />
            </Campo>
            <Campo label="Plazo de cobro">
              <input type="text" className="h-7 w-24 rounded border px-1 text-[11px]"
                value={plazo} placeholder="30/60/90" onChange={e => setPlazo(e.target.value)} />
            </Campo>
            <div className="flex gap-2">
              <Campo label="IVA %">
                <input type="text" className={`${inp} w-16`} value={iva}
                  onChange={e => setIva(e.target.value)} />
              </Campo>
              <Campo label="IIBB %">
                <input type="text" className={`${inp} w-16`} value={iibb}
                  onChange={e => setIibb(e.target.value)} />
              </Campo>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-500">Notas</label>
            <textarea className="mt-0.5 h-12 w-full rounded border px-1 py-1 text-[11px]"
              value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Por qué se vende en esa fecha, con quién se está hablando…" />
          </div>

          {excede && (
            <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-800">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              Estás presupuestando <strong>{nCab}</strong> cabezas y sólo quedan{" "}
              <strong>{Math.round(disponible.cabezas)}</strong> sin venta.
            </p>
          )}
          {faltantes.length > 0 && (
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
              Falta {faltantes.join(" · ")}.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button size="sm" disabled={!puede} onClick={guardar}>
            {guardando && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Presupuestar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Campo({ label, ayuda, children }: {
  label: string; ayuda?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500" title={ayuda}>{label}</label>
      <div className="mt-0.5">{children}</div>
      {ayuda && <p className="text-[9px] leading-tight text-gray-400">{ayuda}</p>}
    </div>
  )
}
