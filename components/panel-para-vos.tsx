"use client"

/**
 * 🏠 «🚩 PARA VOS» — arriba del Principal de CADA usuario (A-FEAT-1411).
 *
 * JMS 2026-10-28: «a él no le llega la campanita: los flags le llegan a su Principal. Cada usuario debe tener su
 * Principal… un flag es algo urgente… la flag incluye la creación de una tarea para ese usuario».
 * Trae SÓLO lo de quien mira (`/api/revisiones?mias=1`: el servidor filtra por la sesión, nadie pide las de otro):
 * arriba lo que le asignaron (las tareas vencidas en rojo), abajo lo que mandó y espera respuesta. Se contesta o se
 * cierra acá mismo, por el mismo camino que la campanita (PATCH /api/revisiones).
 */
import { imagenPegada } from "@/lib/captura-imagen"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Flag, Loader2, CalendarClock } from "lucide-react"
import { paraVos, estaVencida, type MarcaParaVos } from "@/lib/revisiones/para-vos"
import { linkTemaBalance } from "@/lib/balance/recorrido"
import { nivelDeTarea, NIVELES } from "@/lib/revisiones/nivel"
import { cuotaDeTarea, linkPagar } from "@/lib/revisiones/avisos"
import { hoyArgentina } from "@/lib/fechas"

interface Marca extends MarcaParaVos {
  descripcion_ref: string
  motivo: string
  pantalla: string | null
  subpantalla?: string | null
  seguimiento?: { fecha: string; texto: string; autor: string | null; imagen?: string }[] | null
  resolucion?: string | null
  cierre_auto?: string | null
  tabla_ref?: string | null
  registro_id?: string | null
}

const dm = (f: string) => f.slice(0, 10).split("-").reverse().slice(0, 2).join("/")

export function PanelParaVos() {
  const [marcas, setMarcas] = useState<Marca[] | null>(null)
  const [yo, setYo] = useState<{ mail: string | null; etiqueta: string | null }>({ mail: null, etiqueta: null })
  const [abierta, setAbierta] = useState<string | null>(null)
  const [texto, setTexto] = useState("")
  /** 📷 A-FEAT-1474 — la captura pegada en la respuesta. */
  const [imagen, setImagen] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch("/api/revisiones?mias=1")).json()
      setMarcas((j.revisiones ?? []) as Marca[])
      setYo({ mail: j.yo?.mail ?? null, etiqueta: j.yo?.etiqueta ?? null })
    } catch { setMarcas([]) }
  }, [])
  // 📅 Tanda 3: antes de cargar, se crean (si faltan) las tareas del mes de las obligaciones recurrentes
  useEffect(() => {
    fetch("/api/obligaciones", { method: "POST" }).catch(() => {}).finally(() => { void cargar() })
  }, [cargar])

  /**
   * 📷 A-FEAT-1474 — la captura de la respuesta va como entrada del hilo (con el texto, si lo hay). Al cerrar o confirmar
   * se manda primero como respuesta y después se cierra, así la foto queda en la historia de la tarea.
   */
  const mandarFoto = async (id: string, t: string) => {
    if (!imagen) return
    const r = await fetch("/api/revisiones", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, seguimiento: t || "📷 (captura)", imagen }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j?.error ?? `error ${r.status}`)
  }
  const responder = async (id: string, cerrar: boolean) => {
    const t = texto.trim()
    if (!t && !(imagen && !cerrar)) { toast.error(cerrar ? "Escribí qué se hizo antes de cerrarla" : "Escribí la respuesta o pegá una captura"); return }
    setEnviando(true)
    try {
      if (!cerrar && imagen) {
        await mandarFoto(id, t)
        toast.success("Respuesta enviada"); setTexto(""); setImagen(null); setAbierta(null); cargar(); return
      }
      if (cerrar && imagen) await mandarFoto(id, "📷 Captura al cerrar")
      const r = await fetch("/api/revisiones", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cerrar ? { id, estado: "resuelta", resolucion: t } : { id, seguimiento: t }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error ?? `error ${r.status}`)
      toast.success(cerrar ? (j?.estado === "por_confirmar" ? "Lista: queda esperando que la confirmen" : "Cerrada") : "Respuesta enviada")
      setTexto(""); setImagen(null); setAbierta(null); cargar()
    } catch (e) { toast.error("No se pudo: " + (e as Error).message) } finally { setEnviando(false) }
  }

  /** ✔ / ↩ A-FEAT-1449: quien confirma acepta el cierre o lo devuelve con un motivo. */
  const decidir = async (id: string, confirmar: boolean) => {
    // ⚠️ 01/11: si el motivo ya está en los mensajes de la tarea, devolver no obliga a escribirlo otra vez (JMS: «después
    // pongo devolver para mandarte de nuevo la pelota, pero no me lo toma»).
    const t = texto.trim() || (confirmar ? "" : "↩ Devuelta: el motivo está en mis mensajes de arriba")
    setEnviando(true)
    try {
      if (confirmar && imagen) await mandarFoto(id, t || "📷 Captura al confirmar")
      const r = await fetch("/api/revisiones", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmar ? { id, confirmar: true } : { id, devolver: true, seguimiento: t, ...(imagen ? { imagen } : {}) }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error ?? `error ${r.status}`)
      toast.success(confirmar ? "Confirmada: cerrada" : "Devuelta: vuelve a quien la tenía")
      setTexto(""); setImagen(null); setAbierta(null); cargar()
    } catch (e) { toast.error("No se pudo: " + (e as Error).message) } finally { setEnviando(false) }
  }

  if (marcas === null) return null
  const hoy = hoyArgentina()
  const { paraMi, aConfirmar, esperanConfirmacion, mandadas, vencidas } = paraVos(marcas, yo, hoy)
  if (paraMi.length === 0 && mandadas.length === 0 && aConfirmar.length === 0 && esperanConfirmacion.length === 0) {
    return <div className="rounded-lg border bg-white px-4 py-3 text-sm text-muted-foreground">🚩 Para vos: no tenés nada pendiente.</div>
  }

  const tarjeta = (m: Marca, mia: boolean, modo: "normal" | "confirmar" | "esperando" = "normal") => {
    const venc = estaVencida(m, hoy)
    const hilo = m.seguimiento ?? []
    const nv = nivelDeTarea(m, hoy)
    return (
      <li key={m.id} className={`rounded-md border p-3 ${mia ? (venc ? "border-red-400 bg-red-50" : "border-red-200 bg-red-50/40") : "bg-white"}`}>
        <div className="flex flex-wrap items-start gap-2">
          <Flag className={`mt-0.5 h-4 w-4 shrink-0 ${mia ? "text-red-600" : "text-amber-600"}`} fill="currentColor" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {(nv.nivel > 1 || nv.senales.length > 0) && (
                <span title={nv.senales.map(x => `${x.nombre} (+${x.peso})`).join(" · ") || "sin señales"}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${nv.nivel === 4 ? "bg-red-600 text-white" : nv.nivel === 3 ? "bg-orange-100 text-orange-800" : nv.nivel === 2 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-600"}`}>
                  {NIVELES[nv.nivel].emoji} {NIVELES[nv.nivel].etiqueta}
                </span>)}
              <span className="whitespace-pre-wrap">{m.motivo}</span>
              {cuotaDeTarea(m.cierre_auto) && mia && <a href={linkPagar({ cuotaId: cuotaDeTarea(m.cierre_auto) })} className="rounded px-1.5 py-0.5 text-[11px] font-normal text-green-700 hover:bg-green-50" title="Abrir el Cash Flow con la cuota seleccionada, para sacar el pago">💸 Pagar</a>}
              {/* 🔗 A-FEAT-1466 — una tarea del recorrido del balance lleva a su tema (y de ahí a su papel de trabajo). */}
              {m.tabla_ref === "recorrido_balance" && m.registro_id && <a href={linkTemaBalance(m.registro_id)} target="_blank" rel="noreferrer"
                onClick={e => irAlTemaBalance(e, m.registro_id as string)}
                className="rounded px-1.5 py-0.5 text-[11px] font-normal text-blue-700 hover:bg-blue-50" title="Abre el recorrido del balance parado en este tema (y desde ahí, su papel de trabajo)">↗ Ir al tema del balance</a>}
              {m.cierre_auto?.startsWith("cuota_conciliada:") && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-normal text-gray-600" title="Se cierra sola cuando el pago de su cuota queda conciliado">🔒 se cierra sola al conciliar</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              {m.descripcion_ref}{m.pantalla ? ` · ${m.pantalla}${m.subpantalla ? ` → ${m.subpantalla}` : ""}` : ""} · {mia ? `de ${m.creado_por ?? "—"}` : `para ${m.asignado_a}`} · {dm(m.created_at)}
            </div>
            {m.es_tarea && (
              <div className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${venc ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"}`}>
                <CalendarClock className="h-3 w-3" /> Tarea{m.tarea_hasta ? ` · para el ${dm(m.tarea_hasta)}${venc ? " — VENCIDA" : ""}` : ""}
              </div>)}
            {hilo.length > 0 && (
              <ul className="mt-2 space-y-1 border-l-2 pl-2 text-xs">
                {/* Renglones como se escribieron (JMS 31/10: «renglones en vez de todo de corrido»). */}
                {hilo.map((h, i) => <li key={i} className="whitespace-pre-wrap"><b>{h.autor ?? "—"}</b>: {h.texto}
                  {h.imagen && <a href={h.imagen} target="_blank" rel="noreferrer" title="Ver la captura grande"><img src={h.imagen} alt="captura" className="mt-1 max-h-48 rounded border bg-white object-contain" /></a>}</li>)}
              </ul>)}
          </div>
          {modo === "esperando" && <span className="text-xs text-muted-foreground">Esperando que confirme {m.confirma}{m.resolucion ? ` · «${m.resolucion}»` : ""}</span>}
          {modo === "confirmar" && m.resolucion && <span className="w-full text-xs">Dice que está hecha: <b>«{m.resolucion}»</b></span>}
          {modo !== "esperando" && abierta !== m.id && <Button size="sm" variant="outline" onClick={() => { setAbierta(m.id); setTexto(""); setImagen(null) }}>{modo === "confirmar" ? "Confirmar / devolver" : mia ? "Responder / cerrar" : "Escribir"}</Button>}
        </div>
        {abierta === m.id && (
          <div className="mt-2 space-y-2">
            <Textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)}
              onPaste={e => { void imagenPegada(e.nativeEvent).then(img => { if (img) setImagen(img) }) }}
              placeholder={`${mia ? "Qué hiciste, o tu pregunta" : "Tu mensaje"} — podés pegar una captura (Win+Shift+S → Ctrl+V)`} />
            {imagen && (
              <div className="relative inline-block" data-test="para-vos-captura">
                <img src={imagen} alt="captura pegada" className="max-h-48 rounded border bg-white object-contain" />
                <button type="button" onClick={() => setImagen(null)} title="Sacar la captura"
                  className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-xs text-red-700 shadow hover:bg-white">✕ sacar</button>
              </div>)}
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setAbierta(null); setImagen(null) }}>Cancelar</Button>
              {modo === "confirmar" ? (<>
                <Button size="sm" variant="outline" disabled={enviando} onClick={() => decidir(m.id, false)}>↩ Devolver</Button>
                <Button size="sm" disabled={enviando} onClick={() => decidir(m.id, true)}>✔ Confirmar, cerrar</Button>
              </>) : (<>
                <Button size="sm" variant="outline" disabled={enviando} onClick={() => responder(m.id, false)}>Responder</Button>
                {mia && <Button size="sm" disabled={enviando} onClick={() => responder(m.id, true)}>{enviando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Listo, cerrar</Button>}
              </>)}
            </div>
          </div>)}
      </li>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border-2 border-red-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-red-600" fill="currentColor" />
        <h2 className="text-base font-semibold">Para vos</h2>
        {paraMi.length > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{paraMi.length}</span>}
        {vencidas > 0 && <span className="text-xs font-medium text-red-700">{vencidas} vencida(s)</span>}
      </div>
      {aConfirmar.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold text-red-700">✔ Para que confirmes que están hechas ({aConfirmar.length})</div>
          <ul className="space-y-2">{aConfirmar.map(m => tarjeta(m, true, "confirmar"))}</ul>
        </div>)}
      {paraMi.length > 0 && <ul className="space-y-2">{paraMi.map(m => tarjeta(m, true))}</ul>}
      {esperanConfirmacion.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Las que diste por hechas, esperando confirmación</div>
          <ul className="space-y-2">{esperanConfirmacion.map(m => tarjeta(m, true, "esperando"))}</ul>
        </div>)}
      {mandadas.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Lo que mandaste, esperando respuesta</div>
          <ul className="space-y-2">{mandadas.map(m => tarjeta(m, false))}</ul>
        </div>)}
    </div>
  )
}

/**
 * ⚡ Nota 🌙 JMS 01/11 — el link al tema reusa la pestaña del recorrido si ya está abierta y armada: salta al tema sin
 * recargar. Si no hay, abre la pestaña «recorrido-balance» con el link (la próxima vez ya la encuentra).
 */
function irAlTemaBalance(e: { preventDefault: () => void }, registro: string) {
  try {
    const w = window.open("", "recorrido-balance")
    if (!w) return
    e.preventDefault()
    const ir = (w as unknown as { __irATemaBalance?: (r: string) => boolean }).__irATemaBalance
    if (ir && ir(registro)) { w.focus(); return }
    w.location.href = linkTemaBalance(registro)
  } catch { /* si el navegador no deja, sigue el link normal */ }
}
