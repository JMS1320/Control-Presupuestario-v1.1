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
import { abrirTablero } from "@/lib/recorrido/tablero"
import { vigente, type Hueco } from "@/lib/presupuesto/padron"
import { ponerFoco, soltarFoco } from "@/lib/recorrido/foco"
import { comprimir, imagenPegada } from "@/lib/captura-imagen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash2, ImageOff } from "lucide-react"
import { toast } from "sonner"

const $ = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

/** Sigue abierto = hay que resolverlo. Un callado vencido cuenta como abierto otra vez. */
const abierto = (h: Hueco) => h.estado === "abierto" || !vigente(h)

export function BarraRecorrido() {
  const estado = useSyncExternalStore(suscribir, mirar, mirar)
  const [idea, setIdea] = useState<{ titulo: string; texto: string; imagen: string } | null>(null)
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

  /**
   * Pegar la captura — A-FEAT-125.
   *
   * Va sobre `document` y no sobre el textarea a propósito: cuando uno acaba de hacer
   * `Win+Shift+S` no tiene el foco puesto en ningún lado, y exigirle que primero clickee el campo
   * es la clase de paso que hace que la captura no se saque. Se engancha **sólo con el diálogo
   * abierto**, así que fuera de acá pegar sigue haciendo lo de siempre.
   */
  const pegar = useCallback(async (e: ClipboardEvent) => {
    try {
      const img = await imagenPegada(e)
      if (!img) return
      setIdea(v => (v ? { ...v, imagen: img } : v))
      toast.success("Captura pegada")
    } catch { toast.error("No se pudo procesar la imagen") }
  }, [])

  useEffect(() => {
    if (!idea) return
    document.addEventListener("paste", pegar as unknown as EventListener)
    return () => document.removeEventListener("paste", pegar as unknown as EventListener)
  }, [!!idea, pegar])

  if (!estado.activo) return null

  const guardarIdea = async () => {
    if (!idea?.titulo.trim()) return
    setGuardando(true)
    try {
      /**
       * 🧨 El id se genera ACÁ y NO se pide de vuelta — A-BUG-130, que es A-SEC-04 otra vez.
       *
       * Esto era `.insert(...).select("id").single()` y **nunca guardó una sola nota**: `anon`
       * tiene política de INSERT y nada más (`notas_anon_insert`, sin SELECT), y un
       * `INSERT … RETURNING` necesita **además** permiso de lectura para devolver la fila —
       * devolvía `42501` y la idea se perdía con un cartel de error.
       *
       * 🔑 El arreglo ya estaba escrito, en `notas-para-claude.tsx`, desde el 2026-08-31. Lo que
       * falló no fue no saberlo: fue que **el fix de un bug conocido no viajó al código nuevo que
       * hace exactamente lo mismo**.
       */
      const notaId = crypto.randomUUID()
      const { error } = await supabase.from("notas_para_claude").insert({
        id: notaId,
        titulo: idea.titulo.trim().slice(0, 200),
        estado: "finalizada",
        finalizada_at: new Date().toISOString(),
      })
      if (error) throw error
      // Se guarda DÓNDE estaba parado en el recorrido: una idea que se te ocurre resolviendo las
      // vacas CUT casi siempre habla de eso, aunque el texto no lo diga.
      const { error: e2 } = await supabase.from("notas_capturas").insert({
        nota_id: notaId, orden: 1,
        texto: idea.texto.trim() || idea.titulo.trim(),
        imagen: idea.imagen || null,
        pantalla: "Presupuesto", subpantalla: "Recorrido",
        foco_tipo: a.hueco ? "hueco" : "recorrido",
        foco_clave: a.hueco?.clave ?? "recorrido:presupuesto",
        foco_texto: a.hueco?.que ?? "El recorrido del presupuesto",
        diagnostico: [{ tipo: "res", donde: "recorrido",
          msg: `paso ${a.posicion} de ${a.total} · ${a.hechos} hechos · falta ${$(a.faltaPlata)}`,
          t: Date.now() }],
      })
      if (e2) throw e2
      setIdea(null)
      toast.success(idea.imagen
        ? "Anotado con la captura — sigo con el recorrido"
        : "Anotado — sigo con el recorrido")
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
                {/* Dos líneas, no `truncate` — A-BUG-136. El porqué pasó a decir contra qué
                    ventana cuenta (A-BUG-133) y ese dato quedaba **justo del lado cortado**: el
                    texto que existe para que el número no parezca roto, invisible. */}
                <div className="line-clamp-2 text-[11px] leading-4 text-gray-400">
                  {a.hueco.porque} · se resuelve en <b className="text-gray-300">{a.hueco.donde.pantalla}</b>
                </div>
              </>
            ) : (
              <div className="text-[13px]">
                <b>{a.hechos} de {a.total}</b> resueltos
                {/* A-BUG-136: un 0 que significa «no pude medir» no se dice como 0. */}
                {a.sinValorizar === a.total - a.hechos
                  ? <> · lo que falta <b>no se pudo valorizar</b></>
                  : a.sinValorizar > 0
                    ? <> · falta cubrir <b>{$(a.faltaPlata)}</b> y <b>{a.sinValorizar}</b> sin valorizar</>
                    : <> · falta cubrir <b>{$(a.faltaPlata)}</b></>}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-white/10"
              onClick={() => { ponerFoco({ tipo: a.hueco ? "hueco" : "recorrido",
                clave: a.hueco?.clave ?? "recorrido:presupuesto",
                texto: a.hueco?.que ?? "El recorrido del presupuesto" })
                setIdea({ titulo: "", texto: "", imagen: "" }) }}
              title="Algo que viste mientras resolvías — queda vinculado a este paso">
              💡 Anotar
            </Button>
            {/* 🔁 Las DOS cosas — A-BUG-144. «Volver al tablero» significa **volver a verlo**:
                `alTablero()` reposiciona el viaje y pide el recálculo, `abrirTablero()` lo muestra.
                Con una sola, el usuario volvía a la grilla donde ya estaba y tenía que apretar
                «N hueco(s)» otra vez. */}
            <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-white/10"
              onClick={() => { alTablero(); abrirTablero() }}
              title="Volver al tablero — el presupuesto se recalcula">
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
          <textarea rows={5} className="w-full rounded border px-2 py-1.5 text-[13px] leading-5"
            value={idea?.texto ?? ""}
            onChange={e => setIdea(v => ({ ...v!, texto: e.target.value }))}
            placeholder={"Qué esperabas…\nQué pasó…\nPor qué te importa…"} />
          {/*
            📷 La captura — A-FEAT-125.

            Una pantalla dice en un segundo lo que un párrafo no termina de explicar, y acá importa
            el doble: la idea se anota **mientras se trabaja**, así que cuanto menos haya que
            escribir, más probable es que se anote.
          */}
          <label className="text-[11px] font-medium">Captura de pantalla — opcional</label>
          {idea?.imagen ? (
            <div className="relative">
              <img src={idea.imagen} alt="captura"
                className="max-h-52 w-full rounded border bg-gray-50 object-contain" />
              <button onClick={() => setIdea(v => ({ ...v!, imagen: "" }))} title="Quitar"
                className="absolute right-1 top-1 rounded bg-white/90 p-1 text-gray-500 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="rounded border border-dashed bg-gray-50 p-3 text-center">
              <ImageOff className="mx-auto mb-1 h-5 w-5 text-gray-300" />
              <p className="text-[12px] text-gray-600">
                Sacala con <strong>Win + Shift + S</strong> y pegala acá con <strong>Ctrl + V</strong>
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                No hace falta clickear nada primero — con este cartel abierto, pegar la trae.
              </p>
              <input type="file" accept="image/*" className="mx-auto mt-2 block text-[11px]"
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try { const img = await comprimir(f); setIdea(v => ({ ...v!, imagen: img })) }
                  catch { toast.error("No se pudo leer la imagen") }
                }} />
            </div>
          )}

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
