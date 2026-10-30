"use client"

/**
 * 🧭 **EL RECORRIDO DEL BALANCE** — pantalla completa para viajar por los temas a resolver (A-FEAT-1430, JMS 30/10).
 *
 * *«Que alcance para evaluar y decidir… para ver el detalle y editar, el link hacia esa info en su lugar donde vive,
 * con los filtros para mostrar sólo eso.»* Un tema por vez: qué pasa, la propuesta, los links (pestaña nueva), y la
 * respuesta ahí mismo. Las respuestas van a «Pendientes a revisar» (`public.balance_pendientes`): salen en el export.
 *
 * Teclado: ↓ / j siguiente · ↑ / k anterior · Esc cierra (fuera de un campo de texto).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ahoraISO } from "@/lib/fechas"
import type { PendienteBalance } from "@/lib/balance/pendientes-balance"
import { GRUPOS, progreso, textoPendienteDe, type GrupoTema, type Tema } from "@/lib/balance/recorrido"

const ICONO = Object.fromEntries(GRUPOS.map(g => [g.id, g.icono])) as Record<GrupoTema, string>
const TITULO = Object.fromEntries(GRUPOS.map(g => [g.id, g.titulo])) as Record<GrupoTema, string>
const COLOR: Record<GrupoTema, string> = {
  "error": "border-red-300 bg-red-50 text-red-900",
  "decision": "border-amber-300 bg-amber-50 text-amber-900",
  "pregunta": "border-sky-300 bg-sky-50 text-sky-900",
  "falta inicio": "border-violet-300 bg-violet-50 text-violet-900",
  "sin informacion": "border-slate-300 bg-slate-50 text-slate-800",
  "pendiente desarrollo": "border-teal-300 bg-teal-50 text-teal-900",
}

export function RecorridoBalance({ empresa, anioCierre, etiqueta, temas, onCerrar, onPendientes }: {
  empresa: string
  anioCierre: number
  /** «25/26», para el título. */
  etiqueta: string
  temas: Tema[]
  onCerrar: () => void
  /** Después de responder: la lista al día, para que el export y el cuadro de pendientes la lleven. */
  onPendientes: (lista: PendienteBalance[]) => void
}) {
  const [filtro, setFiltro] = useState<Set<GrupoTema>>(new Set())
  const [ocultarRespondidos, setOcultarRespondidos] = useState(false)
  const [claveActual, setClaveActual] = useState<string | null>(null)
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)

  const visibles = useMemo(() => temas.filter(t =>
    (!filtro.size || filtro.has(t.grupo)) && (!ocultarRespondidos || !t.respondido)), [temas, filtro, ocultarRespondidos])
  const idx = Math.max(0, visibles.findIndex(t => t.clave === claveActual))
  const actual = visibles[idx] ?? null
  const prog = progreso(temas)

  // Al cambiar de tema, la nota arranca con lo que ya se había escrito (si lo hay).
  useEffect(() => { setNota(actual?.pendiente?.resolucion ?? "") }, [actual?.clave]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!claveActual && visibles[0]) setClaveActual(visibles[0].clave) }, [claveActual, visibles])

  const ir = useCallback((delta: number) => {
    if (!visibles.length) return
    const n = Math.min(visibles.length - 1, Math.max(0, idx + delta))
    setClaveActual(visibles[n].clave)
    document.getElementById(`tema-${visibles[n].clave}`)?.scrollIntoView({ block: "nearest" })
  }, [visibles, idx])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); ir(1) }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); ir(-1) }
      else if (e.key === "Escape") onCerrar()
    }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [ir, onCerrar])

  const recargar = async () => {
    const { data, error } = await supabase.from("balance_pendientes").select("*")
      .eq("empresa", empresa).eq("anio_cierre", anioCierre).order("created_at")
    if (!error) onPendientes((data ?? []) as PendienteBalance[])
  }

  /** «resuelto» y «bien» cierran el tema; «nota» lo deja abierto con lo escrito. */
  const responder = async (tipo: "resuelto" | "bien" | "nota") => {
    if (!actual) return
    const texto = nota.trim()
    if (tipo === "nota" && !texto) { toast.error("Escribí la nota"); return }
    const resolucion = tipo === "resuelto" ? `✓ Resuelto${texto ? `: ${texto}` : ""}`
      : tipo === "bien" ? `👍 Está bien así${texto ? `: ${texto}` : ""}` : texto
    const estado = tipo === "nota" ? "abierto" : "resuelto"
    setGuardando(true)
    try {
      const cambios = { estado, resolucion, resuelto_at: estado === "resuelto" ? ahoraISO() : null }
      const r = actual.pendiente
        ? await supabase.from("balance_pendientes").update(cambios).eq("id", actual.pendiente.id)
        : await supabase.from("balance_pendientes").insert({ empresa, anio_cierre: anioCierre, texto: textoPendienteDe(actual), creado_por: "recorrido del balance", ...cambios })
      if (r.error) throw r.error
      toast.success(tipo === "nota" ? "Nota guardada" : "Respondido")
      await recargar()
      if (tipo !== "nota") ir(1)
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally { setGuardando(false) }
  }
  const reabrir = async () => {
    if (!actual?.pendiente) return
    const { error } = await supabase.from("balance_pendientes").update({ estado: "abierto", resuelto_at: null }).eq("id", actual.pendiente.id)
    if (error) { toast.error("No se pudo reabrir: " + error.message); return }
    await recargar()
  }

  const alternar = (g: GrupoTema) => setFiltro(f => { const n = new Set(f); if (n.has(g)) n.delete(g); else n.add(g); return n })

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-label="Recorrido del balance" data-test="recorrido-balance">
      {/* Encabezado: dónde estoy y cuánto falta */}
      <div className="border-b px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">🧭 Recorrido del balance — {empresa} {etiqueta}</h2>
          <span className="text-sm text-muted-foreground tabular-nums">{prog.respondidos} de {prog.total} respondidos</span>
          <div className="h-2 w-40 rounded bg-muted overflow-hidden" aria-hidden>
            <div className="h-full bg-emerald-500" style={{ width: `${prog.total ? (prog.respondidos / prog.total) * 100 : 0}%` }} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:inline text-xs text-muted-foreground">↑ ↓ para moverse · Esc cierra</span>
            <Button variant="outline" size="sm" onClick={onCerrar}>Cerrar</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {GRUPOS.filter(g => prog.porGrupo[g.id].total).map(g => (
            <button key={g.id} type="button" onClick={() => alternar(g.id)} aria-pressed={filtro.has(g.id)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${filtro.has(g.id) ? COLOR[g.id] : "bg-background hover:bg-muted"}`}>
              {g.icono} {g.titulo} <span className="tabular-nums text-muted-foreground">{prog.porGrupo[g.id].respondidos}/{prog.porGrupo[g.id].total}</span>
            </button>
          ))}
          <label className="ml-2 flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={ocultarRespondidos} onChange={e => setOcultarRespondidos(e.target.checked)} /> ocultar los respondidos
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[340px_1fr]">
        {/* La cola */}
        <nav className="border-r overflow-y-auto max-h-[30vh] md:max-h-none" aria-label="Temas">
          {visibles.length === 0 && <p className="p-4 text-sm text-muted-foreground">No hay temas con estos filtros.</p>}
          {visibles.map((t, i) => (
            <button key={t.clave} id={`tema-${t.clave}`} type="button" onClick={() => setClaveActual(t.clave)}
              className={`w-full text-left px-3 py-2 border-b text-sm flex gap-2 items-start ${i === idx ? "bg-muted" : "hover:bg-muted/50"}`}>
              <span aria-hidden>{t.respondido ? "✅" : ICONO[t.grupo]}</span>
              <span className="min-w-0">
                <span className={`block truncate ${t.respondido ? "text-muted-foreground line-through" : ""}`}>{t.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.papel}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* El tema abierto */}
        <section className="overflow-y-auto p-4 md:p-6" aria-live="polite">
          {!actual ? <p className="text-sm text-muted-foreground">Elegí un tema.</p> : (
            <div className="max-w-3xl space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded border px-2 py-0.5 ${COLOR[actual.grupo]}`}>{ICONO[actual.grupo]} {TITULO[actual.grupo]}</span>
                <span className="text-muted-foreground">{actual.papel}{actual.solapa ? ` · solapa ${actual.solapa}` : ""}{actual.idPendiente ? ` · ${actual.idPendiente}` : ""}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">{idx + 1} de {visibles.length}</span>
              </div>
              <h3 className="text-xl font-semibold leading-snug">{actual.titulo}</h3>
              {actual.valor2425 && <p className="text-sm"><span className="text-muted-foreground">El año pasado:</span> <span className="tabular-nums">{actual.valor2425}</span></p>}

              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Qué pasa</div>
                <p className="text-sm">{actual.que}</p>
              </div>

              {actual.propuesta && (
                <div className="rounded border border-emerald-300 bg-emerald-50 p-3 space-y-1">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-800">Propuesta</div>
                  <p className="text-sm text-emerald-950">{actual.propuesta}</p>
                </div>
              )}

              {actual.links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {actual.links.map(l => (
                    <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                      className="rounded border px-3 py-1.5 text-sm hover:bg-muted">↗ {l.texto}</a>
                  ))}
                </div>
              )}

              {actual.pendiente?.resolucion && (
                <div className="rounded border bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">{actual.respondido ? "Respondido" : "Nota"}: </span>{actual.pendiente.resolucion}
                  {actual.respondido && <button type="button" className="ml-2 text-xs underline text-muted-foreground" onClick={reabrir}>reabrir</button>}
                </div>
              )}

              <div className="space-y-2 border-t pt-4">
                <label htmlFor="recorrido-nota" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tu respuesta</label>
                <textarea id="recorrido-nota" value={nota} onChange={e => setNota(e.target.value)} rows={3}
                  placeholder="Qué es, qué hacer, o a quién preguntarle…"
                  className="w-full rounded border bg-background p-2 text-sm" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => responder("resuelto")} disabled={guardando}>✓ Resuelto</Button>
                  <Button size="sm" variant="outline" onClick={() => responder("bien")} disabled={guardando}>👍 Está bien así</Button>
                  <Button size="sm" variant="outline" onClick={() => responder("nota")} disabled={guardando}>📝 Guardar nota (sigue abierto)</Button>
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => ir(-1)} disabled={idx === 0}>← Anterior</Button>
                    <Button size="sm" variant="ghost" onClick={() => ir(1)} disabled={idx >= visibles.length - 1}>Siguiente →</Button>
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
