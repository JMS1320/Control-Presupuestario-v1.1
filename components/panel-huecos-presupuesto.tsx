"use client"

/**
 * 🧭 EL TABLERO DE HUECOS — lo que le falta al presupuesto, ordenado por plata.
 *
 * ## La decisión que lo define
 * 🔴 **Grita de más y el usuario lo calla.** Es lo que él eligió cuando le planteé la alternativa:
 * *«dale con lo primero, que grite de más y yo lo callo»*.
 *
 * O sea: el padrón usa **toda la existencia**, no sólo las categorías que históricamente se venden.
 * Con 340 vacas CUT el tablero marca $180 M el primer día. Es incómodo a propósito — **es preferible
 * que grite de más y uno lo calle, a que se calle solo**. Un hueco que nadie ve no se resuelve
 * nunca; uno que molesta se resuelve o se explica, y las dos cosas sirven.
 *
 * ## Lo que este panel NO hace
 * ⚠️ **No escribe el dato que falta.** Dice dónde se resuelve y ahí termina su trabajo. Si escribiera
 * la venta por su cuenta habría dos maneras de cargar una venta que validan distinto, y el día que
 * una cambie la otra queda vieja sin que nadie se entere. Lo único que este panel guarda es
 * **la decisión de callar un hueco** — que es lo único que el sistema no puede deducir solo.
 */

import { useState, useMemo, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { marcador, porPrioridad, vigente, type Hueco, type Padron } from "@/lib/presupuesto/padron"
import { ponerFoco, soltarFoco } from "@/lib/recorrido/foco"
import { comprimir, imagenPegada } from "@/lib/captura-imagen"
import { arrancar, irAlHueco, EVENTO_VOLVI } from "@/lib/recorrido/recorrido"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash2, ImageOff } from "lucide-react"
import { toast } from "sonner"

const $ = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("es-AR")}`

interface Marca {
  clave: string
  estado: "a_proposito" | "todavia_no"
  motivo: string | null
  vence_el: string | null
}

/** Dentro de 6 meses: lo bastante lejos para no molestar, lo bastante cerca para volver a mirarlo. */
const vencePorDefecto = () => {
  const d = new Date()
  d.setMonth(d.getMonth() + 6)
  return d.toISOString().slice(0, 10)
}

export function PanelHuecosPresupuesto({ padrones }: { padrones: Padron[] }) {
  const [abierto, setAbierto] = useState(false)
  const [marcas, setMarcas] = useState<Record<string, Marca>>({})
  const [callando, setCallando] = useState<Hueco | null>(null)
  const [motivo, setMotivo] = useState("")
  const [vence, setVence] = useState(vencePorDefecto())
  const [guardando, setGuardando] = useState(false)
  /** La idea sobre el recorrido en sí — otra cosa que el motivo de un hueco, y se pide distinto. */
  const [idea, setIdea] = useState<{ titulo: string; texto: string; imagen: string } | null>(null)

  useEffect(() => { if (abierto) cargarMarcas() }, [abierto])

  const cargarMarcas = async () => {
    const { data } = await supabase.from("presupuesto_huecos_marcas")
      .select("clave, estado, motivo, vence_el")
    const m: Record<string, Marca> = {}
    for (const x of (data ?? []) as Marca[]) m[x.clave] = x
    setMarcas(m)
  }

  /**
   * Los huecos con la decisión del usuario aplicada encima.
   *
   * 🔑 El hueco se detecta **cada vez**; la marca sólo lo pinta. Por eso si mañana se carga la
   * venta, el hueco desaparece solo aunque la marca siga guardada — y si vuelve a faltar, vuelve
   * a aparecer con su marca puesta.
   */
  const huecos = useMemo(() => {
    const todos = padrones.flatMap(p => p.huecos).map(h => {
      const m = marcas[h.clave]
      return m ? { ...h, estado: m.estado, motivo: m.motivo, venceEl: m.vence_el } : h
    })
    return porPrioridad(todos)
  }, [padrones, marcas])

  const m = useMemo(() => marcador(huecos), [huecos])

  const callar = async (estado: "a_proposito" | "todavia_no") => {
    if (!callando) return
    // ⚠️ El motivo es obligatorio: sin él, dentro de tres meses nadie sabe por qué se calló.
    if (estado === "a_proposito" && !motivo.trim()) {
      toast.error("Escribí por qué no va: sin motivo la marca no se puede auditar después")
      return
    }
    setGuardando(true)
    try {
      const { error } = await supabase.from("presupuesto_huecos_marcas").upsert({
        clave: callando.clave, estado, motivo: motivo.trim() || null,
        // «Todavía no» no vence: no depende del usuario, así que reconfirmarlo no tendría sentido.
        vence_el: estado === "a_proposito" ? vence : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "clave" })
      if (error) throw error
      await cargarMarcas()
      setCallando(null); setMotivo("")
      toast.success("Anotado")
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally { setGuardando(false) }
  }

  /**
   * Guarda la idea en **el mismo sistema de notas de siempre** (`notas_para_claude` +
   * `notas_capturas`), no en una tabla nueva.
   *
   * 🔑 Es una nota como cualquier otra: lo único distinto es **cómo se pide** y que llega con el
   * foco puesto en el recorrido. Inventarle una tabla propia habría partido en dos la bandeja de
   * entrada, y la mitad nueva no la miraría nadie.
   *
   * Se inserta directo en vez de reusar el widget flotante porque acá **no hay grabación**: es una
   * idea escrita, no una secuencia de capturas. Duplicar la máquina de grabar para eso sería peor.
   */
  /**
   * ↩ «Al tablero» tiene que REABRIR el tablero — A-BUG-131.
   *
   * `alTablero()` navega a la solapa y avisa que hay que recalcular, pero el diálogo es estado
   * local de acá: sin esto el usuario volvía a la grilla del presupuesto —justo donde ya estaba—
   * y tenía que apretar «N hueco(s)» de nuevo para ver la lista. **Volver significa volver a VER
   * el tablero**, no navegar a la pantalla que lo contiene.
   *
   * `EVENTO_VOLVI` lo dispara **únicamente** `alTablero()`, así que escucharlo acá no abre el
   * cartel por ningún otro camino.
   */
  useEffect(() => {
    const volver = () => setAbierto(true)
    window.addEventListener(EVENTO_VOLVI, volver)
    return () => window.removeEventListener(EVENTO_VOLVI, volver)
  }, [])

  /**
   * Pegar la captura — A-FEAT-125.
   *
   * Va sobre `document` porque recién salido de `Win+Shift+S` el foco no está en ningún campo, y
   * exigir un click previo es el paso que hace que la captura no se saque. Sólo con el cartel
   * abierto: fuera de acá, pegar sigue haciendo lo de siempre.
   */
  const pegarIdea = useCallback(async (e: ClipboardEvent) => {
    try {
      const img = await imagenPegada(e)
      if (!img) return
      setIdea(v => (v ? { ...v, imagen: img } : v))
      toast.success("Captura pegada")
    } catch { toast.error("No se pudo procesar la imagen") }
  }, [])

  useEffect(() => {
    if (!idea) return
    document.addEventListener("paste", pegarIdea as unknown as EventListener)
    return () => document.removeEventListener("paste", pegarIdea as unknown as EventListener)
  }, [!!idea, pegarIdea])

  const guardarIdea = async () => {
    if (!idea?.titulo.trim()) return
    setGuardando(true)
    try {
      /**
       * 🧨 El id se genera ACÁ y NO se pide de vuelta — A-BUG-130.
       *
       * Igual que en `barra-recorrido.tsx`: `anon` tiene sobre `notas_para_claude` una sola
       * política, de INSERT. Un `INSERT … RETURNING` necesita **además** permiso de lectura, así
       * que esto devolvía `42501` y **la idea se perdía**. Los dos botones de anotar del recorrido
       * tenían el mismo bug, escrito el mismo día, copiándose uno al otro.
       */
      const notaId = crypto.randomUUID()
      const { error } = await supabase.from("notas_para_claude").insert({
        id: notaId,
        titulo: idea.titulo.trim().slice(0, 200),
        estado: "finalizada",
        finalizada_at: new Date().toISOString(),
      })
      if (error) throw error
      const { error: e2 } = await supabase.from("notas_capturas").insert({
        nota_id: notaId, orden: 1,
        texto: idea.texto.trim() || idea.titulo.trim(),
        imagen: idea.imagen || null,
        pantalla: "Presupuesto", subpantalla: "Recorrido — lo que falta",
        modal: "Lo que le falta al presupuesto",
        foco_tipo: "recorrido", foco_clave: "recorrido:presupuesto",
        foco_texto: "El recorrido del presupuesto",
        // 📸 Se guarda el estado del tablero en ese momento: sin eso, dentro de dos semanas la idea
        // se lee sin saber contra qué se le ocurrió.
        diagnostico: [{ tipo: "res", donde: "recorrido",
          msg: `${m.abiertos} huecos abiertos · ${$(m.plata)} · ${m.aProposito} callados`, t: Date.now() }],
      })
      if (e2) throw e2
      soltarFoco("recorrido:presupuesto")
      setIdea(null)
      toast.success(idea.imagen
        ? "Guardada con la captura — la voy a leer con el tablero al lado"
        : "Guardada — la voy a leer con el tablero al lado")
    } catch (e) {
      toast.error("No se pudo guardar la idea: " + (e as Error).message)
    } finally { setGuardando(false) }
  }

  const reabrir = async (h: Hueco) => {
    setGuardando(true)
    try {
      await supabase.from("presupuesto_huecos_marcas").delete().eq("clave", h.clave)
      await cargarMarcas()
    } finally { setGuardando(false) }
  }

  const color = (h: Hueco) =>
    h.estado === "abierto" || !vigente(h) ? "border-l-rose-500 bg-rose-50/60"
      : h.estado === "todavia_no" ? "border-l-slate-400 bg-slate-50/60"
        : "border-l-emerald-500 bg-emerald-50/40"

  return (
    <>
      <Button variant="outline" size="sm"
        className={m.cerrado ? "border-emerald-400 text-emerald-800" : "border-rose-400 text-rose-800"}
        onClick={() => setAbierto(true)}
        title="Lo que le falta al presupuesto, comparado contra lo que debería haber">
        {m.cerrado ? "✓ Sin huecos" : `⚠ ${m.abiertos} hueco(s)`}
      </Button>

      <Dialog open={abierto} onOpenChange={o => !o && setAbierto(false)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-auto">
          <DialogHeader><DialogTitle>🧭 Lo que le falta al presupuesto</DialogTitle></DialogHeader>

          {/* 🎯 El marcador. La meta es CERO, no cien: «te faltan 7 cosas» se puede accionar,
              «estás al 82 %» no. Se muestran el conteo Y la plata — un hueco de $180 M y uno de
              $20.000 no son el mismo, y quedarse con uno solo de los dos números miente. */}
          <div className="rounded-lg bg-gray-900 px-5 py-4 text-white">
            <div className="flex flex-wrap items-baseline gap-4">
              <span className="text-4xl font-bold tabular-nums">{m.abiertos}</span>
              <div className="text-[13px] leading-5 opacity-85">
                {m.abiertos === 0 ? "No queda ningún hueco abierto." : <>
                  huecos abiertos · <b>{$(m.plata)}</b> sin cubrir
                  {m.sinValorizar > 0 && <> · {m.sinValorizar} sin poder valorizar</>}
                </>}
                <br />
                {m.aProposito > 0 && <>{m.aProposito} callado(s) a propósito · </>}
                {m.vencidos > 0 && <span className="text-rose-300">{m.vencidos} con la decisión VENCIDA · </span>}
                {m.todaviaNo > 0 && <>{m.todaviaNo} que todavía no dependen de vos</>}
              </div>
            </div>
          </div>

          {/* 🧭 ARRANCAR EL VIAJE. Camina SOLO los que siguen abiertos y en el orden en que estan
              -- por plata. Meter los ya callados obligaria a saltearlos de a uno. */}
          {m.abiertos > 0 && (
            <Button className="w-full" onClick={() => {
              arrancar(huecos.filter(h => h.estado === "abierto" || !vigente(h)))
              setAbierto(false)
            }}>
              🧭 Empezar el recorrido — {m.abiertos} paso(s), empezando por el que más mueve
            </Button>
          )}

          {/* 💡 LA OTRA NOTA — **arriba, no al fondo** (A-FEAT-126).
              El usuario lo pidió con captura: *«este boton debe estar arriba no abajo»*. Con 53
              huecos, al fondo hay que scrollear la lista entera para encontrarlo — y la idea sobre
              el recorrido se te ocurre **mirando la lista**, no después de recorrerla. Un botón que
              hay que buscar es un botón que no se usa.

              Pedido original: *«el recorrido me debería permitir ir anotando
              temas que tal vez no tienen que ver con el paso en sí, sino con algo que me doy cuenta
              del funcionamiento del mismo… merece una interfaz diferenciada»*.
              Son dos cosas distintas y por eso se ven distinto: **una habla del dato que falta, la
              otra del camino**. Mezclarlas en un solo botón obliga a explicar cuál es cuál en el
              texto — justo el trabajo que esto viene a ahorrar. */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50/70 px-4 py-3">
            <div className="text-[12px] leading-4 text-violet-900">
              <b>¿Se te ocurrió algo del recorrido en sí?</b><br />
              <span className="text-[11px] text-violet-700">
                Cómo está ordenado, qué le falta, qué te confundió. No de un hueco puntual.
              </span>
            </div>
            <Button size="sm" variant="outline" className="border-violet-400 text-violet-800"
              onClick={() => { setIdea({ titulo: "", texto: "", imagen: "" }); ponerFoco({ tipo: "recorrido", clave: "recorrido:presupuesto", texto: "El recorrido del presupuesto" }) }}>
              💡 Anotar una idea
            </Button>
          </div>

          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900">
            Esto <b>grita de más a propósito</b>: parte de todo lo que existe, no de lo que se suele
            vender. Si algo no va, <b>calalo con su motivo</b> — es mejor que grite y lo calles a que
            se calle solo.
          </div>

          {padrones.map(p => {
            const suyos = huecos.filter(h => h.dominio === p.dominio)
            const mp = marcador(suyos)
            return (
              <div key={p.dominio} className="rounded border">
                <div className={`flex items-baseline justify-between border-b px-3 py-1.5 text-[12px] font-medium
                  ${mp.cerrado ? "bg-emerald-50 text-emerald-900" : "bg-gray-50"}`}>
                  <span>{mp.cerrado ? "✓" : "⚠"} {p.pregunta}</span>
                  <span className="text-[11px] font-normal text-gray-600">
                    {mp.abiertos === 0 ? "todo cubierto" : `${mp.abiertos} sin resolver · ${$(mp.plata)}`}
                  </span>
                </div>
                {suyos.length === 0 && (
                  <div className="px-3 py-2 text-[11px] text-gray-500">Nada que reclamar acá.</div>
                )}
                {suyos.map(h => {
                  const callado = h.estado !== "abierto" && vigente(h)
                  return (
                    <div key={h.clave} className={`border-l-4 border-b px-3 py-2 last:border-b-0 ${color(h)}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium">{h.que}</span>
                        <span className="shrink-0 text-[13px] tabular-nums">{$(h.plata)}</span>
                      </div>
                      <div className="text-[11px] leading-4 text-gray-600">{h.porque}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                        <button className="rounded bg-blue-600 px-2 py-0.5 font-medium text-white hover:bg-blue-700"
                          onClick={() => { arrancar(huecos.filter(x => x.estado === "abierto" || !vigente(x)))
                            irAlHueco(h.clave); setAbierto(false) }}
                          title={`Ir a ${h.donde.pantalla}`}>ir →</button>
                        <span className="text-gray-500">
                          Se resuelve en <b>{h.donde.pantalla}</b>
                          {h.donde.detalle && <> — {h.donde.detalle}</>}
                        </span>
                        {callado ? (
                          <>
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
                              {h.estado === "todavia_no" ? "todavía no depende de vos" : `callado: ${h.motivo}`}
                              {h.venceEl && ` · hasta ${h.venceEl.split("-").reverse().join("/")}`}
                            </span>
                            <button className="text-blue-700 underline" disabled={guardando}
                              onClick={() => reabrir(h)}>reabrir</button>
                          </>
                        ) : (
                          <>
                            {h.estado !== "abierto" && !vigente(h) && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 font-medium text-rose-800">
                                la decisión venció — hay que reconfirmarla
                              </span>
                            )}
                            <button className="text-blue-700 underline"
                              onClick={() => { setCallando(h); setMotivo(h.motivo ?? ""); setVence(vencePorDefecto())
                                ponerFoco({ tipo: "hueco", clave: h.clave, texto: h.que }) }}>
                              no va / todavía no
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          <p className="text-[10px] leading-4 text-muted-foreground">
            El hueco se vuelve a calcular cada vez: si cargás lo que falta, <b>desaparece solo</b>.
            Lo que queda guardado es tu decisión de callarlo — y esa <b>vence</b>, para que no se
            convierta en un olvido con permiso.
          </p>
        </DialogContent>
      </Dialog>

      {/* 💡 La idea sobre el recorrido — interfaz aparte, con lugar para escribir de verdad.
          El diálogo de callar un hueco es un input de una línea porque el motivo es corto («quedan
          de reposición»). Éste es lo contrario: pide contexto, y un campo chico invita a una
          respuesta chica. */}
      <Dialog open={!!idea} onOpenChange={o => { if (!o) { soltarFoco("recorrido:presupuesto"); setIdea(null) } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>💡 Una idea sobre el recorrido</DialogTitle></DialogHeader>
          <p className="text-[12px] leading-4 text-gray-600">
            Contame qué viste. No hace falta que esté prolijo — <b>lo que sirve es el detalle</b>:
            qué esperabas, qué pasó, y por qué te importa. Queda vinculada al recorrido, así que no
            hace falta que expliques dónde estabas.
          </p>

          <label className="text-[11px] font-medium">En una línea</label>
          <Input value={idea?.titulo ?? ""} autoFocus
            onChange={e => setIdea(v => ({ ...v!, titulo: e.target.value }))}
            placeholder="ej.: el orden de los pasos no me sirve cuando sólo cambió un precio" />

          <label className="text-[11px] font-medium">Y con todo el detalle que quieras</label>
          <textarea rows={7}
            className="w-full rounded border px-2 py-1.5 text-[13px] leading-5"
            value={idea?.texto ?? ""}
            onChange={e => setIdea(v => ({ ...v!, texto: e.target.value }))}
            placeholder={"Qué esperabas que pasara…\nQué pasó en cambio…\nPor qué te importa / qué te costó…"} />

          {/* 📷 La captura — A-FEAT-125. Acá vale doble: una idea sobre el recorrido casi siempre
              es sobre algo que se VE, y describirlo con palabras cuesta más que mostrarlo. */}
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
              onClick={guardarIdea}>Guardar la idea</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Callar un hueco es una decisión, y una decisión sin motivo no se puede auditar. */}
      <Dialog open={!!callando} onOpenChange={o => { if (!o) { if (callando) soltarFoco(callando.clave); setCallando(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>¿Por qué no va?</DialogTitle></DialogHeader>
          <div className="text-[13px]"><b>{callando?.que}</b> — {$(callando?.plata)}</div>
          <div className="text-[11px] text-gray-600">{callando?.porque}</div>

          <label className="text-[11px] font-medium">El motivo</label>
          <Input value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="ej.: quedan de reposición, no se venden este año" />

          <label className="text-[11px] font-medium">Hasta cuándo vale esta decisión</label>
          <Input type="date" value={vence} onChange={e => setVence(e.target.value)} />
          <p className="text-[10px] leading-4 text-muted-foreground">
            Pasada esa fecha el hueco <b>vuelve a aparecer</b>. Una marca para siempre es un olvido
            con permiso.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCallando(null)}>Cancelar</Button>
            <Button variant="outline" size="sm" disabled={guardando}
              onClick={() => callar("todavia_no")}
              title="No es un error: es algo que todavía no depende de vos (un precio sin publicar)">
              Todavía no depende de mí
            </Button>
            <Button size="sm" disabled={guardando} onClick={() => callar("a_proposito")}>
              No va — callar hasta esa fecha
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
