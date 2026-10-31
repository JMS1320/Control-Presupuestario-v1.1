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
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ahoraISO } from "@/lib/fechas"
import type { PendienteBalance } from "@/lib/balance/pendientes-balance"
import { GRUPOS, conciliacionPorCuenta, progreso, textoPendienteDe, fuenteDe, sinTresVistas, type GrupoTema, type Tema } from "@/lib/balance/recorrido"
import { armarPapelDeTrabajo, vinculoDe } from "@/lib/cuaderno/papel-de-trabajo"
import { linkExtracto } from "@/lib/extracto/link"
import { PISTA_CTRL_CLICK, esSoloEste, tituloChip, toggleChip } from "@/lib/ui/chips"
import { COLOR, DetalleTema, ICONO } from "@/components/recorrido-tema-detalle"

/** Preferencias de este navegador (si el navegador no deja guardar, se usa el default). */
const leerPref = (k: string, def: boolean) => { try { const v = localStorage.getItem(k); return v == null ? def : v === "1" } catch { return def } }
const guardarPref = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? "1" : "0") } catch { /* sin preferencia guardada */ } }
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })


export function RecorridoBalance({ empresa, anioCierre, etiqueta, temas, onCerrar, onPendientes, conciliacion, enCamino = [] }: {
  empresa: string
  anioCierre: number
  /** «25/26», para el título. */
  etiqueta: string
  temas: Tema[]
  onCerrar: () => void
  /** Después de responder: la lista al día, para que el export y el cuadro de pendientes la lleven. */
  onPendientes: (lista: PendienteBalance[]) => void
  /** 🏦 El estado de las propuestas de conciliación (se calculan aparte, tardan unos segundos). */
  /** ⏳ Lo que todavía se está trayendo (vacío = están todos los temas). */
  enCamino?: string[]
  conciliacion?: { cargando: string | null; historicos: number; avisos: string[]; calculado: string | null; recalcular: () => void }
}) {
  const [filtro, setFiltro] = useState<Set<GrupoTema>>(new Set())
  const [ocultarRespondidos, setOcultarRespondidos] = useState(false)
  /** 🏦 Filtro por tipo (sólo los temas que traen etiqueta: la conciliación). */
  const [etiquetas, setEtiquetas] = useState<Set<string>>(new Set())
  /** 🏦 Filtro por cuenta (los chips de «Sin conciliar, por cuenta»: JMS 31/10 «son links pero no filtran el panel izquierdo»). */
  const [cuentas, setCuentas] = useState<Set<string>>(new Set())
  const [claveActual, setClaveActual] = useState<string | null>(null)
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)
  /** 📓 El papel de trabajo del tema abierto: su id si ya existe (`null` = no hay; `undefined` = buscando). */
  const [papelId, setPapelId] = useState<string | null | undefined>(undefined)

  const visibles = useMemo(() => temas.filter(t =>
    (!filtro.size || filtro.has(t.grupo)) && (!ocultarRespondidos || !t.respondido)
    && (!etiquetas.size || (t.etiqueta != null && etiquetas.has(t.etiqueta)))
    && (!cuentas.size || (t.cuenta != null && cuentas.has(t.cuenta.id)))), [temas, filtro, ocultarRespondidos, etiquetas, cuentas])
  /** Los tipos que hay entre los temas filtrados por grupo (para los chips de tipo). */
  const tiposPresentes = useMemo(() => {
    const m = new Map<string, number>()
    // El número de cada tipo cuenta sobre lo filtrado por lo demás (grupo y cuenta), como todos los chips.
    for (const t of temas) if (t.etiqueta && (!filtro.size || filtro.has(t.grupo)) && (!cuentas.size || (t.cuenta != null && cuentas.has(t.cuenta.id))))
      m.set(t.etiqueta, (m.get(t.etiqueta) ?? 0) + 1)
    return [...m.entries()]
  }, [temas, filtro, cuentas])
  // Si el tema abierto desaparece (se concilió y se recalculó al volver a la pestaña), se queda en la misma posición en vez
  // de saltar al primero.
  const ultimoIdx = useRef(0)
  const hallado = visibles.findIndex(t => t.clave === claveActual)
  const idx = hallado >= 0 ? hallado : Math.max(0, Math.min(ultimoIdx.current, visibles.length - 1))
  ultimoIdx.current = idx
  const actual = visibles[idx] ?? null
  const prog = progreso(temas)
  /** 🧮 A-FEAT-1439: cuántos temas abiertos no tienen fuente (lo objetivo) o no tienen dónde verlos en la app. */
  const tres = useMemo(() => sinTresVistas(temas), [temas])
  /** 🧱 La base (nivel 1): cuántos abiertos le quedan — si tiene, se recomienda terminarla antes. */
  const baseFalta = GRUPOS.filter(g => g.nivel === 1).map(g => ({ g, n: prog.porGrupo[g.id].total - prog.porGrupo[g.id].respondidos })).filter(x => x.n > 0)
  /** 🏦 Lo pendiente de conciliar, por cuenta (se ve al elegir «Conciliar movimientos»). */
  const porCuenta = useMemo(() => conciliacionPorCuenta(temas), [temas])
  // Los tipos (nivel 3) dependen del grupo elegido: al cambiar de grupo, el filtro de tipo arranca de cero.
  useEffect(() => { setEtiquetas(new Set()); setCuentas(new Set()) }, [filtro])
  /**
   * 🪟 Los tres paneles se pliegan (JMS 31/10: «tenerlos como están o colapsados, o del tipo de menú que se abre de la
   * izquierda como es la app, así cuando estoy dentro del tema lo veo grande»). Se recuerda en este navegador.
   */
  const [verFiltros, setVerFiltros] = useState(() => leerPref("recorrido-ver-filtros", true))
  const [verLista, setVerLista] = useState(() => leerPref("recorrido-ver-lista", true))
  const [listaFlotante, setListaFlotante] = useState(false)
  useEffect(() => { guardarPref("recorrido-ver-filtros", verFiltros) }, [verFiltros])
  useEffect(() => { guardarPref("recorrido-ver-lista", verLista) }, [verLista])
  /** ↗ El tema solo, en otra pestaña: una foto de cómo está ahora (sólo lectura). */
  const abrirAparte = () => {
    if (!actual) return
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    try {
      // Las fotos viejas se van (quedan las últimas 20): son para mirar ahora, no un archivo.
      const viejas = Object.keys(localStorage).filter(k => k.startsWith("recorrido-tema:")).sort()
      for (const k of viejas.slice(0, Math.max(0, viejas.length - 19))) localStorage.removeItem(k)
      localStorage.setItem(`recorrido-tema:${id}`, JSON.stringify({ tema: actual, empresa, etiqueta, foto: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }))
    } catch { toast.error("El navegador no dejó guardar la foto del tema para abrirla aparte"); return }
    window.open(`/recorrido-tema?id=${id}`, "_blank", "noopener")
  }

  /**
   * 💾 Lo escrito y no confirmado se guarda solo como nota al pasar a otro tema o al cerrar (JMS 31/10: «prefiero
   * guardar cada dato o cada modal por tema, que tener que hacer guardados totales»). No cierra el tema: queda abierto
   * con la nota, igual que «📝 Guardar nota».
   */
  const borrador = useRef<{ tema: Tema | null; texto: string }>({ tema: null, texto: "" })
  useEffect(() => { borrador.current.texto = nota }, [nota])
  const guardarBorrador = async (t: Tema | null, texto: string) => {
    const limpio = texto.trim()
    if (!t || !limpio || limpio === (t.pendiente?.resolucion ?? "").trim()) return
    const cambios = { estado: "abierto", resolucion: limpio, resuelto_at: null }
    const r = t.pendiente
      ? await supabase.from("balance_pendientes").update(cambios).eq("id", t.pendiente.id)
      : await supabase.from("balance_pendientes").insert({ empresa, anio_cierre: anioCierre, texto: textoPendienteDe(t), creado_por: "recorrido del balance", ...cambios })
    if (r.error) { toast.error(`No se pudo guardar la nota de «${t.titulo}»: ${r.error.message}`); return }
    toast.success(`📝 Nota guardada: ${t.titulo}`)
    await recargar()
  }
  // Al cambiar de tema: lo escrito en el anterior se guarda, y la nota arranca con lo que ya se había escrito (si lo hay).
  useEffect(() => {
    const { tema, texto } = borrador.current
    if (tema && tema.clave !== actual?.clave) void guardarBorrador(tema, texto)
    borrador.current = { tema: actual ?? null, texto: actual?.pendiente?.resolucion ?? "" }
    setNota(actual?.pendiente?.resolucion ?? "")
  }, [actual?.clave]) // eslint-disable-line react-hooks/exhaustive-deps
  const cerrar = useCallback(() => {
    const { tema, texto } = borrador.current
    void guardarBorrador(tema, texto).finally(onCerrar)
  }, [onCerrar]) // eslint-disable-line react-hooks/exhaustive-deps
  // 📓 ¿Ya hay un papel de trabajo atado a este tema? (los cuadernos son personales: se busca entre los propios)
  useEffect(() => {
    if (!actual) return
    let vivo = true
    setPapelId(undefined)
    supabase.from("cuadernos").select("id").eq("vinculo", vinculoDe(empresa, anioCierre, actual.clave)).limit(1)
      .then(({ data, error }) => { if (vivo) setPapelId(error ? null : (data?.[0]?.id as string | undefined) ?? null) })
    return () => { vivo = false }
  }, [actual?.clave, empresa, anioCierre]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Abre el papel de trabajo del tema en otra pestaña; si no existe, lo arma con el texto y la comparación. */
  const abrirPapel = async () => {
    if (!actual) return
    // La pestaña se abre YA (en el click): abrirla después de esperar a la base la bloquea el navegador.
    const pestana = window.open("about:blank", "_blank")
    try {
      let idPapel = papelId ?? null
      if (!idPapel) {
        const { titulo, bloques } = armarPapelDeTrabajo(actual, empresa, etiqueta, actual.comparacion)
        const { data, error } = await supabase.from("cuadernos")
          .insert({ titulo, bloques, vinculo: vinculoDe(empresa, anioCierre, actual.clave) }).select("id").single()
        if (error) throw error
        idPapel = String(data.id)
        setPapelId(idPapel)
        toast.success("Papel de trabajo armado en tu Cuaderno")
      }
      const url = `/cuaderno?id=${encodeURIComponent(idPapel)}`
      if (pestana) pestana.location.href = url; else window.open(url, "_blank")
    } catch (e) {
      pestana?.close()
      toast.error("No se pudo armar el papel de trabajo: " + (e as Error).message)
    }
  }
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
      else if (e.key === "Escape") cerrar()
    }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [ir, cerrar])

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
      borrador.current.texto = ""   // ya quedó guardado: al pasar de tema no se vuelve a guardar como nota
      toast.success(tipo === "nota" ? "Nota guardada" : "Respondido")
      await recargar()
      if (tipo !== "nota") ir(1)
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally { setGuardando(false) }
  }
  /**
   * ⚡ La acción de un clic que propone el tema (p. ej. marcar un echeq cobrado con la fecha de su débito). La dispara el
   * usuario; queda escrita como respuesta del tema y se recalcula, así el tema resuelto desaparece.
   */
  const aplicar = async () => {
    const a = actual?.accion
    if (!actual || !a) return
    setGuardando(true)
    try {
      if (a.tipo === "cheque-cobrado") {
        const cambios: Record<string, unknown> = { estado: "cobrado", fecha_estado: a.fecha }
        if (a.numero) cambios.numero = a.numero
        const { error } = await supabase.schema("msa").from("cheques").update(cambios).eq("id", a.chequeId).eq("estado", "vigente")
        if (error) throw error
      }
      const resolucion = `⚡ Aplicado desde el recorrido: ${a.texto}${nota.trim() ? ` — ${nota.trim()}` : ""}`
      const cambiosP = { estado: "resuelto", resolucion, resuelto_at: ahoraISO() }
      const r = actual.pendiente
        ? await supabase.from("balance_pendientes").update(cambiosP).eq("id", actual.pendiente.id)
        : await supabase.from("balance_pendientes").insert({ empresa, anio_cierre: anioCierre, texto: textoPendienteDe(actual), creado_por: "recorrido del balance", ...cambiosP })
      if (r.error) throw r.error
      borrador.current.texto = ""
      toast.success(`Hecho: ${a.texto}`)
      await recargar()
      ir(1)
      conciliacion?.recalcular()
    } catch (e) {
      toast.error("No se pudo aplicar: " + (e as Error).message)
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
          {(tres.sinFuente > 0 || tres.sinLink > 0) && (
            <span className="text-xs text-amber-800" data-test="recorrido-control-tres-vistas"
              title="Cada tema debería mostrar la fuente (lo objetivo), dónde verlo en la app y la propuesta. Éstos todavía no la tienen completa.">
              ⚠️ Abiertos {tres.sinFuente > 0 ? `· ${tres.sinFuente} sin fuente` : ""}{tres.sinLink > 0 ? ` · ${tres.sinLink} sin link a la app` : ""}
            </span>
          )}
          {enCamino.length > 0
            ? <span className="text-xs text-amber-800" data-test="recorrido-cargando">⏳ Todavía llega: {enCamino.join(", ")} — la lista puede crecer y reordenarse</span>
            : <span className="text-xs text-emerald-700" data-test="recorrido-listo">✓ Están todos los temas</span>}
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:inline text-xs text-muted-foreground">↑ ↓ para moverse · Esc cierra</span>
            <Button variant="outline" size="sm" onClick={() => { setVerLista(v => !v); setListaFlotante(false) }} aria-pressed={verLista}
              title={verLista ? "Ocultar la lista de temas (se abre con ☰ desde la izquierda)" : "Mostrar la lista de temas fija a la izquierda"}>☰ {verLista ? "Ocultar lista" : "Fijar lista"}</Button>
            <Button variant="outline" size="sm" onClick={() => setVerFiltros(v => !v)} aria-pressed={verFiltros}
              title={verFiltros ? "Plegar los grupos y filtros para ver el tema más grande" : "Mostrar los grupos y filtros"}>{verFiltros ? "▴ Plegar filtros" : "▾ Filtros"}</Button>
            <Button variant="outline" size="sm" onClick={cerrar}>Cerrar</Button>
          </div>
        </div>
        {/* Plegados: una línea con lo que está filtrado, para no perder de vista dónde se está. */}
        {!verFiltros && (
          <div className="text-xs text-muted-foreground" data-test="recorrido-filtros-plegados">
            Mostrando: {filtro.size ? GRUPOS.filter(g => filtro.has(g.id)).map(g => `${g.icono} ${g.titulo}`).join(" · ") : "todos los grupos"}
            {etiquetas.size ? ` · tipo ${[...etiquetas].join(", ")}` : ""}{cuentas.size ? ` · cuenta ${porCuenta.filter(c => cuentas.has(c.cuentaId)).map(c => c.nombre).join(", ")}` : ""}{ocultarRespondidos ? " · sin los respondidos" : ""} · {visibles.length} tema(s)
          </div>
        )}
        {/* 🧱 Nivel 1 — la base · nivel 2 — el resto. Los tipos (nivel 3) sólo con un grupo elegido (JMS 31/10). */}
        {verFiltros && ([1, 2] as const).map(nivel => {
          const gs = GRUPOS.filter(g => g.nivel === nivel && prog.porGrupo[g.id].total)
          if (!gs.length) return null
          return (
            <div key={nivel} className="flex flex-wrap items-center gap-1.5" data-test={`recorrido-nivel-${nivel}`}>
              <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{nivel === 1 ? "🧱 La base" : "El resto"}</span>
              {gs.map(g => (
                <button key={g.id} type="button" onClick={() => alternar(g.id)} aria-pressed={filtro.has(g.id)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${filtro.has(g.id) ? COLOR[g.id] : "bg-background hover:bg-muted"}`}>
                  {g.icono} {g.titulo} <span className="tabular-nums text-muted-foreground">{prog.porGrupo[g.id].respondidos}/{prog.porGrupo[g.id].total}</span>
                </button>
              ))}
              {nivel === 1 && baseFalta.length > 0 && (
                <span className="w-full pl-16 text-xs text-amber-800" data-test="recorrido-base-recomendacion">
                  ⚠️ La base todavía no está completa — falta: {baseFalta.map(x => `«${x.g.titulo}» ${x.n}`).join(" · ")}.
                  {" "}Conviene terminarla antes que «El resto»: los otros números salen de ahí y pueden cambiar.
                </span>
              )}
              {nivel === 2 && (
                <label className="ml-2 flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={ocultarRespondidos} onChange={e => setOcultarRespondidos(e.target.checked)} /> ocultar los respondidos
                </label>
              )}
            </div>
          )
        })}
        {/* 🏦 Con «Conciliar movimientos» elegido: lo pendiente por cuenta, con su link para ir a trabajarlo. */}
        {verFiltros && filtro.has("conciliacion") && conciliacion && !conciliacion.cargando && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs" data-test="recorrido-conciliacion-por-cuenta">
            <span className="text-muted-foreground">🏦 Sin conciliar, por cuenta:</span>
            {/* El nombre FILTRA la lista de la izquierda (mismo gesto que todos los chips: ctrl+click = sólo ésa); la ↗ abre el extracto. */}
            {porCuenta.map(c => (
              <span key={c.cuentaId} className={`inline-flex items-stretch overflow-hidden rounded border ${cuentas.has(c.cuentaId) ? "border-blue-500 bg-blue-200" : "border-blue-300 bg-blue-50"} text-blue-900`}>
                <button type="button" aria-pressed={cuentas.has(c.cuentaId)} onClick={e => toggleChip(setCuentas, c.cuentaId, esSoloEste(e))}
                  className="px-2 py-0.5 hover:bg-blue-100" title={tituloChip(c.nombre)}>
                  {c.nombre}: <strong className="tabular-nums">{c.abiertos}</strong> · −{fmt(c.debitos)} / +{fmt(c.creditos)}
                </button>
                <a href={linkExtracto({ cuenta: c.cuentaId, movs: c.movs, desde: c.desde, hasta: c.hasta })} target="_blank" rel="noreferrer"
                  className="border-l border-blue-300 px-1.5 py-0.5 hover:bg-blue-100"
                  title={`Abre en el extracto de ${c.nombre} exactamente estos ${c.abiertos} movimientos sin conciliar (${c.desde ?? "?"} al ${c.hasta ?? "?"})`}>↗</a>
              </span>
            ))}
            {cuentas.size > 0 && <button type="button" className="underline text-muted-foreground" onClick={() => setCuentas(new Set())}>todas las cuentas</button>}
            <span className="text-muted-foreground">{PISTA_CTRL_CLICK}</span>
            {porCuenta.length === 0 && <span className="text-emerald-700">✓ nada pendiente</span>}
            <span className="ml-2 text-muted-foreground">calculada {conciliacion.calculado ? `a las ${conciliacion.calculado}` : ""}{conciliacion.historicos ? ` · ${conciliacion.historicos} del histórico jul–nov no entran` : ""}{conciliacion.avisos.length ? ` · ⚠️ ${conciliacion.avisos.length} lectura(s) fallaron` : ""}</span>
            <button type="button" className="rounded border px-2 py-0.5 hover:bg-muted" onClick={conciliacion.recalcular}
              title="Después de conciliar en el extracto, para que los temas resueltos desaparezcan">↻ Recalcular</button>
          </div>
        )}
        {/* Nivel 3 — los tipos, sólo los del grupo elegido */}
        {verFiltros && filtro.size > 0 && tiposPresentes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Tipo:</span>
            {tiposPresentes.map(([e, c]) => (
              <button key={e} type="button" aria-pressed={etiquetas.has(e)}
                onClick={() => setEtiquetas(s => { const n = new Set(s); if (n.has(e)) n.delete(e); else n.add(e); return n })}
                className={`rounded-full border px-2 py-0.5 ${etiquetas.has(e) ? "bg-muted font-medium" : "hover:bg-muted"}`}>{e} <span className="text-muted-foreground tabular-nums">{c}</span></button>
            ))}
          </div>
        )}
      </div>

      <div className={`relative flex-1 min-h-0 grid grid-cols-1 ${verLista ? "md:grid-cols-[340px_1fr]" : ""}`}>
        {/* ☰ Con la lista oculta: un botón a la izquierda la abre flotando, como el menú de la app. */}
        {!verLista && (
          <button type="button" onClick={() => setListaFlotante(v => !v)} data-test="recorrido-lista-flotante"
            className="absolute left-0 top-2 z-20 rounded-r border border-l-0 bg-background px-2 py-1 text-sm shadow hover:bg-muted"
            title="Abrir la lista de temas">☰</button>
        )}
        {!verLista && listaFlotante && <div className="absolute inset-0 z-10 bg-black/20" onClick={() => setListaFlotante(false)} aria-hidden />}
        {/* La cola */}
        <nav className={verLista ? "border-r overflow-y-auto max-h-[30vh] md:max-h-none"
          : listaFlotante ? "absolute inset-y-0 left-0 z-20 w-[340px] max-w-[90vw] overflow-y-auto border-r bg-background shadow-xl" : "hidden"} aria-label="Temas">
          {visibles.length === 0 && <p className="p-4 text-sm text-muted-foreground">No hay temas con estos filtros.</p>}
          {visibles.map((t, i) => (
            <button key={t.clave} id={`tema-${t.clave}`} type="button" onClick={() => { setClaveActual(t.clave); setListaFlotante(false) }}
              className={`w-full text-left px-3 py-2 border-b text-sm flex gap-2 items-start ${i === idx ? "bg-muted" : "hover:bg-muted/50"}`}>
              <span aria-hidden>{t.respondido ? "✅" : ICONO[t.grupo]}</span>
              <span className="min-w-0">
                <span className={`block truncate ${t.respondido ? "text-muted-foreground line-through" : ""}`}>{t.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.etiqueta ? `${t.etiqueta} · ` : ""}{t.papel.replace(/ · .*$/, "")}{!t.respondido && !fuenteDe(t) ? " · sin fuente" : ""}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* El tema abierto */}
        <section className={`overflow-y-auto p-4 md:p-6 ${verLista ? "" : "pl-10 md:pl-12"}`} aria-live="polite">
          {!actual ? <p className="text-sm text-muted-foreground">Elegí un tema.</p> : (
            <div className={`${verLista ? "max-w-3xl" : "max-w-5xl"} space-y-4`}>
              <DetalleTema tema={actual}
                arriba={<span className="ml-auto flex items-center gap-2 text-muted-foreground tabular-nums">
                  {idx + 1} de {visibles.length}
                  <button type="button" onClick={abrirAparte} className="rounded border px-2 py-0.5 hover:bg-muted" data-test="recorrido-abrir-aparte"
                    title="Abre este tema solo, en otra pestaña (una foto de cómo está ahora; para responder, volvé acá)">↗ Abrir en otra pestaña</button>
                </span>}
                enAppExtra={<button type="button" onClick={abrirPapel} disabled={papelId === undefined}
                    className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                    title="Un documento del Cuaderno atado a este tema: la fuente, lo que dice la app, la propuesta y la cuenta, para pensar y anotar sin tocar datos">
                    📓 {papelId ? "Abrir el papel de trabajo" : actual.comparacion ? "Armar papel de trabajo (con la cuenta)" : "Armar papel de trabajo"}
                  </button>}
                propuestaExtra={actual.accion && !actual.respondido
                  ? <Button size="sm" onClick={aplicar} disabled={guardando} data-test="recorrido-aplicar">⚡ Aplicar: {actual.accion.texto}</Button> : null}
                resolucionExtra={actual.respondido
                  ? <button type="button" className="ml-2 text-xs underline text-muted-foreground" onClick={reabrir}>reabrir</button> : null} />

              <div className="space-y-2 border-t pt-4">
                <label htmlFor="recorrido-nota" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tu respuesta</label>
                <textarea id="recorrido-nota" value={nota} onChange={e => setNota(e.target.value)} rows={3}
                  placeholder="Qué es, qué hacer, o a quién preguntarle… (si pasás a otro tema sin apretar un botón, se guarda solo como nota)"
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
