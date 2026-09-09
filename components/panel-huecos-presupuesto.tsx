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

import { useState, useMemo, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { marcador, porPrioridad, vigente, type Hueco, type Padron } from "@/lib/presupuesto/padron"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
                              onClick={() => { setCallando(h); setMotivo(h.motivo ?? ""); setVence(vencePorDefecto()) }}>
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

      {/* Callar un hueco es una decisión, y una decisión sin motivo no se puede auditar. */}
      <Dialog open={!!callando} onOpenChange={o => !o && setCallando(null)}>
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
