"use client"

/**
 * 🧭 LA BARRA DEL RECORRIDO — te acompaña mientras resolvés.
 *
 * Va montada a nivel app, como las notas y las marcas, por la misma razón: **el viaje cruza
 * pantallas**. Si viviera dentro del Presupuesto, desaparecería justo al dar el primer paso.
 *
 * ## Lo que muestra, y por qué eso
 * - **Dónde estás** — el hueco actual y por qué el sistema cree que falta. Se llega a otra pantalla
 *   habiendo perdido el hilo; el recordatorio evita volver al tablero sólo para releerlo.
 * - **Cuánto falta** — *«3 de 9 · $42 M»*. El avance **se deriva del estado**, no de un contador
 *   propio: si el usuario resuelve algo por otro lado, la barra se entera igual.
 * - **Siguiente** — el botón que convierte la lista en viaje. Sin él son cinco pasos por hueco y
 *   tres son navegación.
 * - **Anotar** — porque las cosas se ven mientras se trabaja, no después.
 */

import { useSyncExternalStore, useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  suscribir, mirar, avance, siguiente, alTablero, terminar, refrescar,
} from "@/lib/recorrido/recorrido"
import { vigente, type Hueco } from "@/lib/presupuesto/padron"
import { ponerFoco, soltarFoco } from "@/lib/recorrido/foco"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

const $ = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

/** Sigue abierto = hay que resolverlo. Un callado vencido cuenta como abierto otra vez. */
const abierto = (h: Hueco) => h.estado === "abierto" || !vigente(h)

export function BarraRecorrido() {
  const estado = useSyncExternalStore(suscribir, mirar, mirar)
  const [idea, setIdea] = useState<{ titulo: string; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  const a = avance(abierto)

  /**
   * Las marcas se releen cada vez que la barra se muestra, no una sola vez.
   *
   * 🔑 Es lo que hace que **callar un hueco desde otra pantalla** se vea acá: sin esto, el avance
   * se quedaría contando algo que ya no está.
   */
  const releer = useCallback(async () => {
    if (!estado.activo) return
    const { data } = await supabase.from("presupuesto_huecos_marcas")
      .select("clave, estado, motivo, vence_el")
    const marcas = Object.fromEntries(
      ((data ?? []) as { clave: string; estado: string; motivo: string | null; vence_el: string | null }[])
        .map(m => [m.clave, m]))
    refrescar(estado.huecos.map(h => {
      const m = marcas[h.clave]
      return m ? { ...h, estado: m.estado as Hueco["estado"], motivo: m.motivo, venceEl: m.vence_el } : h
    }))
  }, [estado.activo, estado.huecos])

  useEffect(() => { if (estado.activo) releer() }, [estado.indice])

  if (!estado.activo) return null

  const guardarIdea = async () => {
    if (!idea?.titulo.trim()) return
    setGuardando(true)
    try {
      const { data, error } = await supabase.from("notas_para_claude")
        .insert({ titulo: idea.titulo.trim().slice(0, 200), estado: "finalizada" })
        .select("id").single()
      if (error) throw error
      // Se guarda DÓNDE estaba parado en el recorrido: una idea que se te ocurre resolviendo las
      // vacas CUT casi siempre habla de eso, aunque el texto no lo diga.
      await supabase.from("notas_capturas").insert({
        nota_id: (data as { id: string }).id, orden: 1,
        texto: idea.texto.trim() || idea.titulo.trim(),
        pantalla: "Presupuesto", subpantalla: "Recorrido",
        foco_tipo: a.hueco ? "hueco" : "recorrido",
        foco_clave: a.hueco?.clave ?? "recorrido:presupuesto",
        foco_texto: a.hueco?.que ?? "El recorrido del presupuesto",
        diagnostico: [{ tipo: "res", donde: "recorrido",
          msg: `paso ${a.posicion} de ${a.total} · ${a.hechos} hechos · falta ${$(a.faltaPlata)}`,
          t: Date.now() }],
      })
      setIdea(null)
      toast.success("Anotado — sigo con el recorrido")
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally { setGuardando(false) }
  }

  const pct = a.total > 0 ? Math.round((a.hechos / a.total) * 100) : 0

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-700 bg-gray-900 text-white shadow-2xl">
        {/* La barra de avance, fina y arriba de todo: se lee sin leer. */}
        <div className="h-1 w-full bg-gray-700">
          <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            {a.terminado ? (
              <div className="text-[13px] font-medium text-emerald-300">
                ✓ No queda ningún hueco abierto — recorriste los {a.total}. Podés cerrar.
              </div>
            ) : a.hueco ? (
              <>
                <div className="truncate text-[13px] font-medium">
                  <span className="mr-2 rounded bg-white/15 px-1.5 py-0.5 text-[11px] tabular-nums">
                    {a.posicion}/{a.total}
                  </span>
                  {a.hueco.que}
                </div>
                <div className="truncate text-[11px] text-gray-400">
                  {a.hueco.porque} · se resuelve en <b className="text-gray-300">{a.hueco.donde.pantalla}</b>
                </div>
              </>
            ) : (
              <div className="text-[13px]">
                <b>{a.hechos} de {a.total}</b> resueltos · falta cubrir <b>{$(a.faltaPlata)}</b>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-white/10"
              onClick={() => { ponerFoco({ tipo: a.hueco ? "hueco" : "recorrido",
                clave: a.hueco?.clave ?? "recorrido:presupuesto",
                texto: a.hueco?.que ?? "El recorrido del presupuesto" })
                setIdea({ titulo: "", texto: "" }) }}
              title="Algo que viste mientras resolvías — queda vinculado a este paso">
              💡 Anotar
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-white/10"
              onClick={alTablero} title="Volver al tablero — el presupuesto se recalcula">
              ↩ Al tablero
            </Button>
            {!a.terminado && (
              <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500"
                onClick={() => siguiente(abierto)}
                title="Al próximo que siga abierto. Si no queda ninguno adelante, vuelve al principio">
                Siguiente →
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 text-gray-400 hover:bg-white/10"
              onClick={terminar} title="Salir del recorrido">✕</Button>
          </div>
        </div>
      </div>
      {/* El alto de la barra, para que no tape el pie de la pantalla que estés mirando. */}
      <div className="h-16" />

      <Dialog open={!!idea} onOpenChange={o => { if (!o) { soltarFoco(a.hueco?.clave ?? "recorrido:presupuesto"); setIdea(null) } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>💡 Anotar sin perder el hilo</DialogTitle></DialogHeader>
          <p className="text-[12px] leading-4 text-gray-600">
            {a.hueco
              ? <>Queda vinculado a <b>{a.hueco.que}</b>. Si es algo del recorrido en general,
                  escribilo igual — se entiende por dónde ibas.</>
              : <>Queda vinculado al recorrido.</>}
          </p>
          <label className="text-[11px] font-medium">En una línea</label>
          <Input autoFocus value={idea?.titulo ?? ""}
            onChange={e => setIdea(v => ({ ...v!, titulo: e.target.value }))}
            placeholder="ej.: acá no me deja cargar la venta sin elegir un lote" />
          <label className="text-[11px] font-medium">Con todo el detalle que quieras</label>
          <textarea rows={6} className="w-full rounded border px-2 py-1.5 text-[13px] leading-5"
            value={idea?.texto ?? ""}
            onChange={e => setIdea(v => ({ ...v!, texto: e.target.value }))}
            placeholder={"Qué esperabas…\nQué pasó…\nPor qué te importa…"} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIdea(null)}>Cancelar</Button>
            <Button size="sm" disabled={guardando || !(idea?.titulo ?? "").trim()}
              onClick={guardarIdea}>Guardar y seguir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
