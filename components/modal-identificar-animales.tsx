"use client"

/**
 * 🐄 Identificar los animales de un cambio de categoría YA guardado — A-FEAT-84.
 *
 * ## Por qué existe
 * El usuario movió 5 vacas al CUT de a una, cada una con su observación —*"Vaca Dura que malparió.
 * Robocop"*, *"Cursienta Colorada Conserva"*— pero **ninguna quedó como individuo**: el código sólo
 * creaba el animal si además se escribían caravanas en el cuadro de texto. La observación se guardó
 * en el movimiento y ahí murió: no aparece en la planilla del CUT ni se puede adjudicar a una venta.
 *
 * Y editar el movimiento no lo arregla —la edición sólo toca esa fila— así que la única salida era
 * **borrar y recrear**, perdiendo la fecha y el registro original. Esta ventana evita eso: identifica
 * los animales *contra el movimiento que ya existe*.
 *
 * ## El descuadre que cierra
 * En vacas CUT entraron 17 cabezas y se crearon 12 individuos (faltan 5); salieron 11 y se dieron de
 * baja 4 (faltan 7). Saldo 6 contra 8 individuos activos = **2 de diferencia**, que es exactamente
 * 7 − 5. Identificar estas 5 cierra la mitad; adjudicar las 7 caravanas a la venta cierra la otra.
 */

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export interface MovimientoAIdentificar {
  id: string
  fecha: string
  cantidad: number
  categoria_id: string | null
  categoria_nombre?: string
  observaciones: string | null
}

interface Fila { caravana: string; pelo: string; razon: string }

export function ModalIdentificarAnimales({
  movimiento, abierto, onCerrar, onGuardado,
}: {
  movimiento: MovimientoAIdentificar | null
  abierto: boolean
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [yaHay, setYaHay] = useState(0)
  const [filas, setFilas] = useState<Fila[]>([])
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!abierto || !movimiento) return
    setCargando(true)
    const prod = supabase.schema("productivo")
    // Cuántos ya están identificados: por el vínculo nuevo, o —para los cargados antes— por
    // categoría + fecha de alta, que es como se guardaron.
    Promise.all([
      prod.from("terneros").select("id", { count: "exact", head: true })
        .eq("movimiento_alta_id", movimiento.id),
      prod.from("terneros").select("id", { count: "exact", head: true })
        .is("movimiento_alta_id", null)
        .eq("categoria_id", movimiento.categoria_id ?? "")
        .eq("fecha_alta", movimiento.fecha),
    ]).then(([a, b]) => {
      const n = (a.count ?? 0) + (b.count ?? 0)
      setYaHay(n)
      const faltan = Math.max(0, movimiento.cantidad - n)
      // La observación del movimiento entra como razón de la primera fila: es el dato que el
      // usuario ya escribió, y volver a tipearlo sería justo lo que esto viene a evitar.
      setFilas(Array.from({ length: faltan }, (_, i) => ({
        caravana: "", pelo: "",
        razon: i === 0 ? (movimiento.observaciones ?? "") : "",
      })))
      setCargando(false)
    })
  }, [abierto, movimiento])

  const guardar = async () => {
    if (!movimiento) return
    const cargadas = filas.filter(f => f.caravana.trim() || f.razon.trim() || f.pelo.trim())
    if (cargadas.length === 0) { toast.error("Cargá al menos un animal"); return }
    setGuardando(true)
    try {
      const esMacho = /toro|torito|novillo/.test((movimiento.categoria_nombre || "").toLowerCase())
      const { error } = await supabase.schema("productivo").from("terneros").insert(
        cargadas.map(f => ({
          caravana_oficial: f.caravana.trim() || null,
          pelo: f.pelo.trim() || null,
          observaciones: f.razon.trim() || movimiento.observaciones || null,
          sexo: esMacho ? "Macho" : "Hembra",
          categoria_id: movimiento.categoria_id,
          // La fecha del MOVIMIENTO, no la de hoy: la planilla filtra por acá y con la fecha de
          // carga el animal aparecería en el mes equivocado (A-BUG-47).
          fecha_alta: movimiento.fecha,
          movimiento_alta_id: movimiento.id,
          activo: true,
          es_torito: false,
        }))
      )
      if (error) throw error
      toast.success(`${cargadas.length} animal(es) identificado(s). Ya figuran en la planilla.`)
      onGuardado(); onCerrar()
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  if (!movimiento) return null
  const faltan = Math.max(0, movimiento.cantidad - yaHay)

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            🐄 Identificar animales — {movimiento.cantidad} {movimiento.categoria_nombre ?? "cab"} · {movimiento.fecha}
          </DialogTitle>
        </DialogHeader>

        {movimiento.observaciones && (
          <div className="rounded border bg-gray-50 px-3 py-2 text-[11px] leading-4 text-gray-600">
            <span className="font-medium">Lo que anotaste en el movimiento:</span> «{movimiento.observaciones}»
          </div>
        )}

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Cargando…</span>
          </div>
        ) : faltan === 0 ? (
          <p className="py-6 text-center text-sm text-gray-600">
            Este movimiento ya tiene sus {yaHay} animal(es) identificado(s). No falta ninguno.
          </p>
        ) : (
          <>
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
              ⚠️ Faltan identificar <b>{faltan}</b> de {movimiento.cantidad}
              {yaHay > 0 && <> (ya hay {yaHay})</>}. Mientras no estén, no figuran en la planilla ni se
              pueden adjudicar a una venta.
            </div>

            <div className="rounded border">
              <div className="grid grid-cols-[1fr_90px_1.6fr] gap-1 border-b bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600">
                <span>Caravana</span><span>Pelo</span><span>Razón</span>
              </div>
              <div className="max-h-64 overflow-auto">
                {filas.map((f, i) => (
                  <div key={i} className="grid grid-cols-[1fr_90px_1.6fr] items-center gap-1 border-b px-2 py-1 last:border-b-0">
                    <Input className="h-7 text-xs" placeholder="B079" value={f.caravana}
                      onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, caravana: e.target.value } : x))} />
                    <Input className="h-7 text-xs" placeholder="Negra" value={f.pelo}
                      onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, pelo: e.target.value } : x))} />
                    <Input className="h-7 text-xs" placeholder="Machorra / Diarrea / Vacía tacto" value={f.razon}
                      onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, razon: e.target.value } : x))} />
                  </div>
                ))}
              </div>
              <p className="px-2 py-1 text-[10px] leading-3 text-muted-foreground">
                Sin caravana se guarda igual — queda identificado por su razón, y la caravana se
                completa después desde la pantalla de Cría.
              </p>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          {faltan > 0 && (
            <Button onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Identificar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
