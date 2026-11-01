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
import { agregarAlHilo, hiloDelTema, mensajesDelTema } from "@/lib/balance/hilo-tema"
import { imagenPegada } from "@/lib/captura-imagen"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ahoraISO } from "@/lib/fechas"
import type { PendienteBalance } from "@/lib/balance/pendientes-balance"
import { GRUPOS, conciliacionPorCuenta, linksAlExtracto, progreso, textoPendienteDe, fuenteDe, sinTresVistas, type GrupoTema, type Tema } from "@/lib/balance/recorrido"
import { armarPapelDeTrabajo, vinculoDe } from "@/lib/cuaderno/papel-de-trabajo"
import { linkExtracto } from "@/lib/extracto/link"
import type { ConteoCuenta } from "@/lib/conciliacion/propuestas-ejercicio"
import { PISTA_CTRL_CLICK, esSoloEste, tituloChip, toggleChip } from "@/lib/ui/chips"
import { COLOR, DetalleTema, ICONO } from "@/components/recorrido-tema-detalle"
import { PasarTarea, quienMarca, useRevisionesDe } from "@/components/boton-revision"
import { vincularPagoTarjeta } from "@/lib/conciliacion/vincular-pago-tarjeta"
import type { TandaTema } from "@/lib/balance/recorrido"

/** Preferencias de este navegador (si el navegador no deja guardar, se usa el default). */
const leerPref = (k: string, def: boolean) => { try { const v = localStorage.getItem(k); return v == null ? def : v === "1" } catch { return def } }
const guardarPref = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? "1" : "0") } catch { /* sin preferencia guardada */ } }
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })


export function RecorridoBalance({ empresa, anioCierre, etiqueta, temas, onCerrar, onPendientes, conciliacion, enCamino = [], claveInicial = null }: {
  empresa: string
  anioCierre: number
  /** «25/26», para el título. */
  etiqueta: string
  temas: Tema[]
  onCerrar: () => void
  /** Después de responder: la lista al día, para que el export y el cuadro de pendientes la lleven. */
  onPendientes: (lista: PendienteBalance[]) => void
  /** 🏦 El estado de las propuestas de conciliación (se calculan aparte, tardan unos segundos). */
  /** 🔗 A-FEAT-1466 — abrir parado en este tema (llegó por un link desde una tarea). */
  claveInicial?: string | null
  /** ⏳ Lo que todavía se está trayendo (vacío = están todos los temas). */
  enCamino?: string[]
  conciliacion?: { cargando: string | null; historicos: number; avisos: string[]; calculado: string | null; recalcular: () => void
    /** 🏦 Por cuenta: total del ejercicio y sin conciliar 3 meses antes / después. */
    porCuenta?: Record<string, ConteoCuenta> }
}) {
  const [filtro, setFiltro] = useState<Set<GrupoTema>>(new Set())
  const [ocultarRespondidos, setOcultarRespondidos] = useState(false)
  /** 🏦 Filtro por tipo (sólo los temas que traen etiqueta: la conciliación). */
  const [etiquetas, setEtiquetas] = useState<Set<string>>(new Set())
  /**
   * 👤 A-FEAT-1454 — las tareas atadas a temas del recorrido («Pasarle a…»: a JMS, a otro usuario o a Claude, con foto).
   * Viven en las tareas de siempre (`public.revisiones`, A-FEAT-1449), ancladas a «recorrido_balance» por empresa, año y
   * clave del tema: le llegan a la persona en su 🔔 y se cierran desde ahí.
   */
  const { porRegistro: tareas, recargar: recargarTareas } = useRevisionesDe("public", "recorrido_balance")
  const registroDe = (t: Tema) => `${empresa}:${anioCierre}:${t.clave}`
  /**
   * ✔ A-FEAT-1487 — confirmar o devolver desde el tema lo que resolvió Claude (la misma acción que «Para vos» en
   * Principal: una sola tarea, las dos listas quedan iguales). Al confirmar, el tema sale en el próximo cálculo.
   */
  const decidirVisto = async (id: string, confirmar: boolean) => {
    // ⚠️ 01/11 (JMS: «devuelvo estos mensajes, después pongo devolver para mandarte de nuevo la pelota, pero no me lo
    // toma»): si ya escribiste en el hilo, devolver no te pide escribirlo de nuevo — el motivo son tus mensajes de arriba.
    const t = nota.trim() || (confirmar ? "" : "↩ Devuelto: el motivo está en mis mensajes de arriba")
    setGuardando(true)
    try {
      const r = await fetch("/api/revisiones", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmar ? { id, confirmar: true } : { id, devolver: true, seguimiento: t, ...(imagen ? { imagen } : {}) }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error ?? `error ${r.status}`)
      toast.success(confirmar ? "✔ Confirmado: sale del recorrido y se cerró en Principal" : "↩ Devuelto: vuelve a quien lo resolvió")
      setNota(""); setImagen(null)
      await recargarTareas()
      conciliacion?.recalcular()
    } catch (e) { toast.error("No se pudo: " + (e as Error).message) } finally { setGuardando(false) }
  }
  /** 🏦 Filtro por cuenta (los chips de «Sin conciliar, por cuenta»: JMS 31/10 «son links pero no filtran el panel izquierdo»). */
  const [cuentas, setCuentas] = useState<Set<string>>(new Set())
  const [claveActual, setClaveActual] = useState<string | null>(claveInicial)
  const [nota, setNota] = useState("")
  /** 🧵 Quién escribe (para el hilo del tema). */
  const [yo, setYo] = useState<string | null>(null)
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      setYo((u?.user_metadata?.full_name as string | undefined) || (u?.user_metadata?.name as string | undefined) || u?.email || null)
    })
  }, [])
  /** 📷 A-FEAT-1472 — la captura pegada en «Tu respuesta» (Win+Shift+S → Ctrl+V), sin tener que pasarse el tema a uno mismo. */
  const [imagen, setImagen] = useState<string | null>(null)
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
  /**
   * 🔗 A-BUG-1473 — el tema que pidió un link («↗ Ir al tema del balance» de una tarea). Si todavía no llegó se dice que se
   * lo está buscando; si ya no existe (se resolvió: p. ej. el movimiento se concilió) se dice eso, en vez de dejarte en el
   * primer tema como si fuera el pedido (JMS 01/11: «el link debe llevar a ese tema en el balance y no a cualquier lugar»).
   */
  const [pedido, setPedido] = useState<string | null>(claveInicial)
  // ⚡ un link nuevo del Principal en la MISMA pestaña (sin recargar): ir a ese tema, sin filtros que lo escondan
  const claveAnterior = useRef(claveInicial)
  useEffect(() => {
    if (!claveInicial || claveInicial === claveAnterior.current) return
    claveAnterior.current = claveInicial
    setPedido(claveInicial); setClaveActual(claveInicial)
    setFiltro(new Set()); setEtiquetas(new Set()); setCuentas(new Set()); setOcultarRespondidos(false)
  }, [claveInicial])
  const pedidoEnTemas = !!pedido && temas.some(t => t.clave === pedido)
  const pedidoVisible = !!pedido && visibles.some(t => t.clave === pedido)
  /** Mientras se busca el tema del link no se muestra otro en su lugar (era Parra: el primero de la lista). */
  const buscandoPedido = !!pedido && !pedidoEnTemas && enCamino.length > 0
  /** Terminó de cargar y el tema del link no está (se resolvió): tampoco se muestra otro en su lugar (JMS 01/11, Manuel). */
  const pedidoNoEsta = !!pedido && !pedidoEnTemas && enCamino.length === 0
  const actual = buscandoPedido || pedidoNoEsta ? null : visibles[idx] ?? null
  useEffect(() => { if (pedido && claveActual !== pedido) setPedido(null) }, [claveActual]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pedido && pedidoVisible) document.getElementById(`tema-${pedido}`)?.scrollIntoView({ block: "center" })
  }, [pedido, pedidoVisible])
  const mostrarPedido = () => { setFiltro(new Set()); setEtiquetas(new Set()); setCuentas(new Set()); setOcultarRespondidos(false) }
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
  const borrador = useRef<{ tema: Tema | null; texto: string; imagen: string | null }>({ tema: null, texto: "", imagen: null })
  useEffect(() => { borrador.current.texto = nota }, [nota])
  useEffect(() => { borrador.current.imagen = imagen }, [imagen])
  /**
   * 🧵 A-BUG-1478 — un mensaje nuevo va AL FINAL del hilo (nunca pisa al anterior). Si el tema está pasado a alguien y sigue
   * abierto, va al hilo de la tarea (lo ve la otra persona en su 🔔); si no, al del tema. `resolucion` lleva el último
   * mensaje, que es lo que usan el export y el papel.
   */
  const escribir = async (t: Tema, texto: string, img: string | null, estado: "abierto" | "resuelto") => {
    const msg = texto || "📷 (captura)"
    const tarea = tareas[registroDe(t)]
    const aLaTarea = !!tarea && estado === "abierto"
    if (aLaTarea) {
      const r = await fetch("/api/revisiones", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tarea.id, seguimiento: msg, ...(img ? { imagen: img } : {}) }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error ?? `error ${r.status}`)
    }
    const cambios: Record<string, unknown> = { estado, resolucion: msg, resuelto_at: estado === "resuelto" ? ahoraISO() : null }
    if (img) cambios.imagen = img
    if (!aLaTarea) cambios.hilo = agregarAlHilo(t.pendiente, { fecha: ahoraISO(), autor: yo, texto: msg, imagen: img })
    // Una respuesta vieja (de antes del hilo) no se pierde aunque el mensaje nuevo vaya a la tarea.
    else if (!t.pendiente?.hilo?.length && (t.pendiente?.resolucion ?? "").trim()) cambios.hilo = mensajesDelTema(t.pendiente).map(({ de: _de, ...m }) => m)
    const r = t.pendiente
      ? await supabase.from("balance_pendientes").update(cambios).eq("id", t.pendiente.id)
      : await supabase.from("balance_pendientes").insert({ empresa, anio_cierre: anioCierre, texto: textoPendienteDe(t), creado_por: "recorrido del balance", ...cambios })
    if (r.error) throw r.error
    if (aLaTarea) await recargarTareas()
  }
  const guardarBorrador = async (t: Tema | null, texto: string, img: string | null = null) => {
    const limpio = texto.trim()
    if (!t || (!limpio && !img)) return
    try {
      await escribir(t, limpio, img, "abierto")
      toast.success(`📝 Mensaje guardado: ${t.titulo}`)
      await recargar()
    } catch (e) { toast.error(`No se pudo guardar el mensaje de «${t.titulo}»: ${(e as Error).message}`) }
  }
  // Al cambiar de tema: lo escrito en el anterior se guarda como mensaje, y el cuadro arranca vacío (el hilo se ve arriba).
  useEffect(() => {
    const { tema, texto, imagen: img } = borrador.current
    if (tema && tema.clave !== actual?.clave) void guardarBorrador(tema, texto, img)
    borrador.current = { tema: actual ?? null, texto: "", imagen: null }
    setNota("")
    setImagen(null)
  }, [actual?.clave]) // eslint-disable-line react-hooks/exhaustive-deps
  const cerrar = useCallback(() => {
    const { tema, texto, imagen: img } = borrador.current
    void guardarBorrador(tema, texto, img).finally(onCerrar)
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
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT")) return
      // Con un modal abierto encima (p. ej. «Pasarle a…»), las teclas son del modal: Esc no cierra el recorrido.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return
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
    if (tipo === "nota" && !texto && !imagen) { toast.error("Escribí la nota o pegá una captura"); return }
    const mensaje = tipo === "resuelto" ? `✓ Resuelto${texto ? `: ${texto}` : ""}`
      : tipo === "bien" ? `👍 Está bien así${texto ? `: ${texto}` : ""}` : texto
    const estado = tipo === "nota" ? "abierto" : "resuelto"
    setGuardando(true)
    try {
      await escribir(actual, mensaje, imagen, estado)
      borrador.current.texto = ""   // ya quedó guardado: al pasar de tema no se vuelve a guardar
      borrador.current.imagen = null
      setNota(""); setImagen(null)
      toast.success(tipo === "nota" ? "Mensaje guardado" : "Respondido")
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
      // ⚡ A-FEAT-1489 — un grupo de movimientos: sólo los que siguen pendientes o a auditar (nunca pisa uno ya conciliado)
      if (a.tipo === "estado-movimientos") {
        const cambios: Record<string, unknown> = { estado: a.estado, ...(a.detalle ? { detalle: a.detalle } : {}) }
        const db = a.schema === "public" ? supabase : supabase.schema(a.schema)
        const { error } = await db.from(a.tabla).update(cambios).in("id", a.ids).in("estado", ["pendiente", "auditar"])
        if (error) throw error
      }
      await escribir(actual, `⚡ Aplicado desde el recorrido: ${a.texto}${nota.trim() ? ` — ${nota.trim()}` : ""}`, imagen, "resuelto")
      borrador.current.texto = ""; borrador.current.imagen = null
      setNota(""); setImagen(null)
      toast.success(`Hecho: ${a.texto}`)
      await recargar()
      ir(1)
      conciliacion?.recalcular()
    } catch (e) {
      toast.error("No se pudo aplicar: " + (e as Error).message)
    } finally { setGuardando(false) }
  }

  /**
   * ⚡ A-FEAT-1489 — «Aplicá vos»: lo que no es de un clic (crear una regla, vincular, cargar en Sueldos) queda como TAREA
   * para Claude, anclada al tema, con la propuesta y lo que escribiste. Cuando Claude la resuelve, vuelve a «Para tu
   * visto» y confirma quien la pidió. Así se resuelve desde el tema, no desde el chat (A-FEAT-1484).
   */
  const aplicaVos = async () => {
    if (!actual) return
    setGuardando(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const yo = u?.user?.email ?? null
      const { error } = await supabase.from("revisiones").insert({
        id: crypto.randomUUID(), schema_ref: "public", tabla_ref: "recorrido_balance", registro_id: registroDe(actual),
        descripcion_ref: `Balance ${empresa} ${etiqueta} · ${actual.titulo}`.slice(0, 300),
        motivo: `⚡ Aplicá la propuesta${actual.propuesta ? `: ${actual.propuesta}` : ""}${nota.trim() ? `\n\nJMS: ${nota.trim()}` : ""}`,
        imagen: imagen || null, pantalla: "Reporte Detallado", subpantalla: "Recorrido del balance",
        creado_por: await quienMarca(), asignado_a: "claude", es_tarea: true, origen: "manual", confirma: yo,
      })
      if (error) throw error
      borrador.current.texto = ""; borrador.current.imagen = null
      setNota(""); setImagen(null)
      toast.success("⚡ Pedido a Claude: cuando lo aplique, vuelve a «Para tu visto»")
      await recargarTareas()
    } catch (e) { toast.error("No se pudo pedir: " + (e as Error).message) } finally { setGuardando(false) }
  }

  /**
   * 🧺 A-FEAT-1491 — aplicar la tanda a los renglones tildados. Uno por uno (si uno falla, se dice cuál y los demás
   * siguen hechos), y queda escrito en el tema cuántos de cuántos.
   */
  const aplicarTanda = async (ids: string[]) => {
    const t = actual?.tanda
    if (!actual || !t || !ids.length) return
    setGuardando(true)
    const hechos: string[] = [], fallos: string[] = []
    try {
      const elegidos = t.items.filter(x => ids.includes(x.id))
      if (t.accion.tipo === "estado-movimientos") {
        const a = t.accion
        const db = a.schema === "public" ? supabase : supabase.schema(a.schema)
        const { error } = await db.from(a.tabla).update({ estado: a.estado, ...(a.detalle ? { detalle: a.detalle } : {}) }).in("id", ids).in("estado", ["pendiente", "auditar"])
        if (error) throw error
        hechos.push(...elegidos.map(x => x.celdas.join(" · ")))
      } else {
        for (const x of elegidos) {
          if (!x.pago) { fallos.push(`${x.celdas[0]}: sin datos para vincular`); continue }
          try { await vincularPagoTarjeta(supabase, x.pago); hechos.push(x.celdas[0]) }
          catch (e) { fallos.push(`${x.celdas[0]}: ${(e as Error).message}`) }
        }
      }
      const todos = hechos.length === t.items.length && !fallos.length
      await escribir(actual, `⚡ Aplicado desde el recorrido (${t.accion.texto}) a ${hechos.length} de ${t.items.length}: ${hechos.join(" | ")}${fallos.length ? `\n❌ No se pudo: ${fallos.join(" | ")}` : ""}${nota.trim() ? `\n${nota.trim()}` : ""}`,
        imagen, todos ? "resuelto" : "abierto")
      borrador.current.texto = ""; borrador.current.imagen = null
      setNota(""); setImagen(null)
      if (fallos.length) toast.error(`Hecho ${hechos.length}; no se pudo ${fallos.length}: ${fallos[0]}`)
      else toast.success(`⚡ Hecho: ${hechos.length} de ${t.items.length}`)
      await recargar()
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
          {/* ✔ A-FEAT-1487 — lo visto sólo por Claude, a la vista: un clic lo filtra. */}
          {prog.porGrupo.visto.total > 0 && (
            <button type="button" onClick={() => { setFiltro(new Set(["visto"])); setEtiquetas(new Set()); setCuentas(new Set()) }}
              className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-900 hover:bg-emerald-100" data-test="recorrido-sin-visto"
              title="Temas que resolvió Claude y esperan tu visto. Hasta que los confirmes, en el export figuran «Resuelto por Claude — sin tu visto».">
              ✔ {prog.porGrupo.visto.total} resuelto(s) por Claude sin tu visto
            </button>
          )}
          {enCamino.length > 0
            ? <span className="text-xs text-amber-800" data-test="recorrido-cargando">⏳ Todavía llega: {enCamino.join(", ")} — la lista puede crecer y reordenarse</span>
            : <span className="text-xs text-emerald-700" data-test="recorrido-listo">✓ Están todos los temas</span>}
          {pedido && !pedidoEnTemas && enCamino.length > 0 && (
            <span className="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-900" data-test="recorrido-pedido-buscando">🔎 Buscando el tema del link… (todavía llega {enCamino.join(", ")})</span>
          )}
          {pedido && !pedidoEnTemas && enCamino.length === 0 && (
            <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900" data-test="recorrido-pedido-no-esta">
              ℹ️ El tema del link <b>ya no está en el recorrido</b>: se resolvió (p. ej. el movimiento quedó conciliado o el dato se corrigió). Lo de abajo es otro tema.
              <button type="button" className="ml-2 underline" onClick={() => setPedido(null)}>entendido</button>
            </span>
          )}
          {pedido && pedidoEnTemas && !pedidoVisible && (
            <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900" data-test="recorrido-pedido-oculto">
              El tema del link está oculto por los filtros. <button type="button" className="underline" onClick={mostrarPedido}>Mostrarlo</button>
            </span>
          )}
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
        {verFiltros && ([0, 1, 2] as const).map(nivel => {
          const gs = GRUPOS.filter(g => g.nivel === nivel && prog.porGrupo[g.id].total)
          if (!gs.length) return null
          return (
            <div key={nivel} className="flex flex-wrap items-center gap-1.5" data-test={`recorrido-nivel-${nivel}`}>
              <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{nivel === 0 ? "✔ Tu visto" : nivel === 1 ? "🧱 La base" : "El resto"}</span>
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
                  {c.nombre}: <strong className="tabular-nums">{c.abiertos}</strong>
                  {conciliacion.porCuenta?.[c.cuentaId]?.totalEjercicio != null && <span className="tabular-nums"> de {conciliacion.porCuenta[c.cuentaId].totalEjercicio}</span>}
                  {" "}sin conciliar · −{fmt(c.debitos)} / +{fmt(c.creditos)}
                  {!!conciliacion.porCuenta?.[c.cuentaId]?.historicosEjercicio && <span className="text-muted-foreground"> · 🗄️ {conciliacion.porCuenta[c.cuentaId].historicosEjercicio} históricos (no van)</span>}
                </button>
                <a href={linkExtracto({ cuenta: c.cuentaId, movs: c.movs, desde: c.desde, hasta: c.hasta })} target="_blank" rel="noreferrer"
                  className="border-l border-blue-300 px-1.5 py-0.5 hover:bg-blue-100"
                  title={`Abre en el extracto de ${c.nombre} exactamente estos ${c.abiertos} movimientos sin conciliar (${c.desde ?? "?"} al ${c.hasta ?? "?"})`}>↗</a>
              </span>
            ))}
            {/* Cuentas sin nada pendiente en el ejercicio: se dicen igual, con su total (un 0 que no se ve no es un control). */}
            {Object.entries(conciliacion.porCuenta ?? {}).filter(([id]) => !porCuenta.some(c => c.cuentaId === id)).map(([id, k]) => (
              <span key={id} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-900">✓ {k.nombre}: 0{k.totalEjercicio != null ? ` de ${k.totalEjercicio}` : ""} sin conciliar{k.historicosEjercicio ? ` · 🗄️ ${k.historicosEjercicio} históricos (no van)` : ""}</span>
            ))}
            {cuentas.size > 0 && <button type="button" className="underline text-muted-foreground" onClick={() => setCuentas(new Set())}>todas las cuentas</button>}
            <span className="text-muted-foreground">{PISTA_CTRL_CLICK}</span>
            {porCuenta.length === 0 && <span className="text-emerald-700">✓ nada pendiente</span>}
            <span className="ml-2 text-muted-foreground">calculada {conciliacion.calculado ? `a las ${conciliacion.calculado}` : ""}{conciliacion.historicos ? ` · ${conciliacion.historicos} históricos sin pareja de template no entran (el histórico no se concilia contra facturas)` : ""}{conciliacion.avisos.length ? ` · ⚠️ ${conciliacion.avisos.length} lectura(s) fallaron` : ""}</span>
            <button type="button" className="rounded border px-2 py-0.5 hover:bg-muted" onClick={conciliacion.recalcular}
              title="Después de conciliar en el extracto, para que los temas resueltos desaparezcan">↻ Recalcular</button>
          </div>
        )}
        {/* ⚠️ Alertas secundarias: lo sin conciliar en los 3 meses de antes y de después del ejercicio (JMS 31/10). */}
        {verFiltros && filtro.has("conciliacion") && conciliacion?.porCuenta && !conciliacion.cargando && (() => {
          const ks = Object.entries(conciliacion.porCuenta)
          const lado = (cual: "antes" | "despues") => ks.filter(([, k]) => (cual === "antes" ? k.sinConciliarAntes : k.sinConciliarDespues))
          const dm = (iso: string) => iso.split("-").reverse().join("/")
          const fila = (cual: "antes" | "despues", rotulo: string) => {
            const con = lado(cual)
            const v = ks[0]?.[1][cual]
            return (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground">{rotulo}{v ? ` (${dm(v.desde)}–${dm(v.hasta)})` : ""}:</span>
                {con.length === 0 ? <span className="text-emerald-700">✓ nada</span> : con.map(([id, k]) => (
                  <a key={id} href={linkExtracto({ cuenta: id, desde: k[cual].desde, hasta: k[cual].hasta })} target="_blank" rel="noreferrer"
                    className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-900 hover:bg-amber-100"
                    title={`Abre ${k.nombre} en esas fechas (los «pendiente» y «auditar» son los sin conciliar)`}>
                    {k.nombre}: {cual === "antes" ? k.sinConciliarAntes : k.sinConciliarDespues} ↗
                  </a>
                ))}
              </span>
            )
          }
          return (
            <div className="flex flex-wrap items-center gap-3 text-xs" data-test="recorrido-conciliacion-alrededor">
              <span className="text-muted-foreground">⚠️ Sin conciliar alrededor del ejercicio —</span>
              {fila("antes", "3 meses antes")}
              {fila("despues", "3 meses después")}
            </div>
          )
        })()}
        {/* Nivel 3 — los tipos, sólo los del grupo elegido */}
        {verFiltros && filtro.size > 0 && tiposPresentes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Tipo:</span>
            {/* Cada tipo es FILTRO (click; ctrl+click = sólo ése) y, si sus movimientos son de una sola cuenta, LINK (↗) al extracto con esos. */}
            {tiposPresentes.map(([e, c]) => {
              const delTipo = linksAlExtracto(temas.filter(t => t.etiqueta === e && (!filtro.size || filtro.has(t.grupo)) && (!ocultarRespondidos || !t.respondido)
                && (!cuentas.size || (t.cuenta != null && cuentas.has(t.cuenta.id)))))
              return (
                <span key={e} className={`inline-flex items-stretch overflow-hidden rounded-full border ${etiquetas.has(e) ? "bg-muted font-medium" : ""}`}>
                  <button type="button" aria-pressed={etiquetas.has(e)} title={tituloChip(e)}
                    onClick={ev => toggleChip(setEtiquetas, e, esSoloEste(ev))}
                    className="px-2 py-0.5 hover:bg-muted">{e} <span className="text-muted-foreground tabular-nums">{c}</span></button>
                  {delTipo.length === 1 && (
                    <a href={delTipo[0].href} target="_blank" rel="noreferrer" className="border-l px-1.5 py-0.5 hover:bg-muted"
                      title={`Abre en el extracto de ${delTipo[0].nombre} estos ${delTipo[0].n} movimientos («${e}»)`}>↗</a>
                  )}
                </span>
              )
            })}
          </div>
        )}
        {/* ↗ Lo que se está mirando, al extracto: un link por cuenta con exactamente esos movimientos. */}
        {verFiltros && filtro.has("conciliacion") && (etiquetas.size > 0 || cuentas.size > 0) && (() => {
          const ls = linksAlExtracto(visibles)
          if (!ls.length) return null
          return (
            <div className="flex flex-wrap items-center gap-1.5 text-xs" data-test="recorrido-abrir-filtrado">
              <span className="text-muted-foreground">↗ Abrir lo filtrado en el extracto:</span>
              {ls.map(l => (
                <a key={l.cuentaId} href={l.href} target="_blank" rel="noreferrer"
                  className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-blue-900 hover:bg-blue-100">{l.nombre}: {l.n} ↗</a>
              ))}
            </div>
          )
        })()}
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
              <span aria-hidden>{t.respondido ? "✅" : ICONO[t.grupo]}{!t.respondido && tareas[registroDe(t)] ? "👤" : ""}</span>
              <span className="min-w-0">
                <span className={`block truncate ${t.respondido ? "text-muted-foreground line-through" : ""}`}>{t.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.etiqueta ? `${t.etiqueta} · ` : ""}{t.papel.replace(/ · .*$/, "")}{!t.respondido && !fuenteDe(t) ? " · sin fuente" : ""}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* El tema abierto */}
        <section className={`overflow-y-auto p-4 md:p-6 ${verLista ? "" : "pl-10 md:pl-12"}`} aria-live="polite">
          {!actual ? (pedidoNoEsta ? (
            <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" data-test="recorrido-pedido-resuelto">
              <p><b>El tema del link ya no está en el recorrido: se resolvió.</b> Por ejemplo, el movimiento quedó conciliado o el dato se corrigió.</p>
              <p className="text-xs">Si la tarea que te trajo acá sigue abierta, se cierra desde «Para vos» (✔ Confirmar, cerrar).</p>
              <Button size="sm" variant="outline" onClick={() => setPedido(null)}>Ir al primer tema</Button>
            </div>
          ) : <p className="text-sm text-muted-foreground">{buscandoPedido ? `🔎 Buscando el tema del link… llega con ${enCamino.join(", ")}; en cuanto aparezca, se abre solo.` : "Elegí un tema."}</p>) : (
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
                propuestaExtra={actual.respondido || actual.grupo === "visto" || actual.tanda ? null
                  : actual.accion
                    ? <Button size="sm" onClick={aplicar} disabled={guardando} data-test="recorrido-aplicar">⚡ Aplicar: {actual.accion.texto}</Button>
                    : actual.propuesta && !tareas[registroDe(actual)]
                      ? <Button size="sm" variant="outline" onClick={() => void aplicaVos()} disabled={guardando} data-test="recorrido-aplica-vos"
                          title="Lo que no es de un clic: queda como tarea para Claude, con la propuesta y lo que escribas en «Tu respuesta». Vuelve a «Para tu visto».">⚡ Aplicá vos (Claude)</Button>
                      : null}
                sinRespuesta
                resolucionExtra={actual.respondido
                  ? <button type="button" className="ml-2 text-xs underline text-muted-foreground" onClick={reabrir}>reabrir</button> : null} />

              {/* 🧺 A-FEAT-1491 — la tanda: renglón por renglón, se aplica a los tildados */}
              {actual.tanda && !actual.respondido && actual.grupo !== "visto" && (
                <TandaTabla key={actual.clave} tanda={actual.tanda} disabled={guardando} onAplicar={ids => void aplicarTanda(ids)} />
              )}

              {/* 🧵 A-BUG-1478 — la conversación del tema, en orden: lo respondido acá + el pedido de la tarea y sus respuestas. */}
              {(() => {
                const tarea = tareas[registroDe(actual)] as (typeof tareas)[string] & { asignado_a?: string | null } | undefined
                const hilo = hiloDelTema(actual.pendiente, tarea)
                if (!hilo.length && !tarea) return null
                const cuando = (f: string) => f ? new Date(f).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""
                return (
                  <div className={`rounded border p-3 text-sm space-y-2 ${tarea ? "border-amber-300 bg-amber-50" : "bg-muted/30"}`} data-test="recorrido-hilo">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {tarea ? `👤 Pasado a ${tarea.asignado_a ?? "alguien"} · lo que escribas acá le llega a su 🔔` : "🧵 Conversación del tema"}
                    </div>
                    <ul className="space-y-1.5">
                      {hilo.map((m, i) => (
                        <li key={i} className="whitespace-pre-wrap border-l-2 pl-2" style={{ borderColor: m.de === "tarea" ? "#f59e0b" : "#94a3b8" }}>
                          <span className="text-xs text-muted-foreground">{m.autor ?? "—"} · {cuando(m.fecha)}</span><br />{m.texto}
                          {m.imagen && <a href={m.imagen} target="_blank" rel="noreferrer"><img src={m.imagen} alt="captura" className="mt-1 max-h-48 rounded border bg-white object-contain" /></a>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}

              {/* ✔ A-FEAT-1487 — resuelto por Claude: tu visto se da ACÁ, con los links de arriba a la vista. */}
              {(() => {
                const tarea = tareas[registroDe(actual)] as ((typeof tareas)[string] & { resolucion?: string | null; resuelto_por?: string | null }) | undefined
                if (!tarea || tarea.estado !== "por_confirmar") return null
                return (
                  <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm space-y-2" data-test="recorrido-visto">
                    <div className="text-xs font-medium uppercase tracking-wide text-emerald-900">✔ Hecho por {tarea.resuelto_por || "Claude"} — falta tu visto</div>
                    {tarea.resolucion && <p className="whitespace-pre-wrap">{tarea.resolucion}</p>}
                    <p className="text-xs text-muted-foreground">Auditalo con los links de arriba. «Confirmar» lo saca del recorrido y lo cierra en Principal; «Devolver» necesita el motivo en «Tu respuesta».</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={guardando} onClick={() => void decidirVisto(tarea.id, true)}>✔ Confirmar</Button>
                      <Button size="sm" variant="outline" disabled={guardando} onClick={() => void decidirVisto(tarea.id, false)}>↩ Devolver</Button>
                    </div>
                  </div>
                )
              })()}

              <div className="space-y-2 border-t pt-4">
                <label htmlFor="recorrido-nota" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tu respuesta</label>
                <textarea id="recorrido-nota" value={nota} onChange={e => setNota(e.target.value)} rows={3}
                  onPaste={e => { void imagenPegada(e.nativeEvent).then(img => { if (img) setImagen(img) }) }}
                  placeholder="Escribí abajo de todo: se agrega como último mensaje (no pisa lo anterior). Podés pegar una captura (Win+Shift+S → Ctrl+V). Si pasás a otro tema sin apretar un botón, se guarda solo."
                  className="w-full rounded border bg-background p-2 text-sm" />
                {imagen && (
                  <div className="relative inline-block" data-test="recorrido-captura">
                    <img src={imagen} alt="captura pegada" className="max-h-48 rounded border bg-white object-contain" />
                    <button type="button" onClick={() => setImagen(null)} title="Sacar la captura"
                      className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-xs text-red-700 shadow hover:bg-white">✕ sacar</button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => responder("resuelto")} disabled={guardando}>✓ Resuelto</Button>
                  <Button size="sm" variant="outline" onClick={() => responder("bien")} disabled={guardando}>👍 Está bien así</Button>
                  <Button size="sm" variant="outline" onClick={() => responder("nota")} disabled={guardando}>📝 Guardar mensaje (sigue abierto)</Button>
                  <PasarTarea key={actual.clave} etiqueta="👤 Pasarle a…"
                    className="inline-flex h-8 items-center rounded-md border border-amber-300 bg-amber-50 px-3 text-sm text-amber-900 hover:bg-amber-100"
                    ancla={{ schema: "public", tabla: "recorrido_balance", registroId: registroDe(actual), descripcion: `Balance ${empresa} ${etiqueta} · ${actual.titulo}`.slice(0, 300) }}
                    inicial={{ esTarea: true, motivo: nota.trim() || `${actual.titulo}
${actual.propuesta ? `Propuesta: ${actual.propuesta}` : actual.que}` }}
                    onGuardada={() => void recargarTareas()} />
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

/**
 * 🧺 A-FEAT-1491 — la tabla de una tanda: cada renglón con su contexto y sus links; los que traen aviso arrancan
 * destildados (y dicen por qué). Se aplica sólo a los tildados.
 */
function TandaTabla({ tanda, disabled, onAplicar }: { tanda: TandaTema; disabled: boolean; onAplicar: (ids: string[]) => void }) {
  const [tildados, setTildados] = useState<Set<string>>(() => new Set(tanda.items.filter(x => !x.aviso).map(x => x.id)))
  const alternar = (id: string) => setTildados(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const todos = tildados.size === tanda.items.length
  return (
    <div className="rounded border border-blue-300 bg-blue-50/40 p-3 text-sm space-y-2" data-test="recorrido-tanda">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-blue-900">🧺 Tanda · {tanda.items.length} renglones · {tildados.size} tildados</span>
        <button type="button" className="text-xs underline" onClick={() => setTildados(todos ? new Set() : new Set(tanda.items.map(x => x.id)))}>{todos ? "destildar todos" : "tildar todos"}</button>
        <Button size="sm" className="ml-auto" disabled={disabled || !tildados.size} onClick={() => onAplicar([...tildados])} data-test="recorrido-tanda-aplicar">
          ⚡ {tanda.accion.texto} los {tildados.size} tildados
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="w-6"></th>{tanda.columnas.map(c => <th key={c} className="px-1.5 py-1 font-medium">{c}</th>)}<th className="px-1.5 py-1 font-medium">Ver</th></tr></thead>
          <tbody>
            {tanda.items.map(x => (
              <tr key={x.id} className={`border-t ${x.aviso ? "bg-amber-50" : ""}`}>
                <td className="px-1"><input type="checkbox" checked={tildados.has(x.id)} onChange={() => alternar(x.id)} aria-label={`incluir ${x.celdas[0]}`} /></td>
                {x.celdas.map((c, i) => <td key={i} className="px-1.5 py-1 tabular-nums">{c}</td>)}
                <td className="px-1.5 py-1 whitespace-nowrap">
                  {x.links.map(l => <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="mr-2 text-blue-700 underline">{l.texto}</a>)}
                  {x.aviso && <span className="block text-amber-800">⚠️ {x.aviso}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
