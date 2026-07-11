"use client"

// Panel de revisión de la cola de mails de detalle (public.mails_pago).
// Ver/editar destinatario, asunto y cuerpo; toggle del adjunto de retención; borrar; ver estado.
// El envío lo hace el GAS (gas-mail-detalle/EnviarMailsDetalle.gs) → crea borradores en Gmail.

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface MailPago {
  id: string
  creado_at: string
  proveedor?: string | null
  email_destino: string
  asunto: string
  cuerpo: string
  tiene_sicore?: boolean | null
  adjuntar_retencion?: boolean | null
  adjuntar_detalle?: boolean | null
  estado: string
  error?: string | null
  enviado_at?: string | null
}

const SEL = "id,creado_at,proveedor,cuit,email_destino,asunto,cuerpo,tiene_sicore,adjuntar_retencion,adjuntar_detalle,estado,error,enviado_at"

const estadoColor: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-300",
  borrador: "bg-blue-100 text-blue-800 border-blue-300",
  enviado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  error: "bg-red-100 text-red-800 border-red-300",
}

export function PanelMailsPago() {
  const [open, setOpen] = useState(false)
  const [mails, setMails] = useState<MailPago[]>([])
  const [loading, setLoading] = useState(false)
  const [filtro, setFiltro] = useState("pendiente")

  const cargar = async () => {
    setLoading(true)
    let q = supabase.from("mails_pago").select(SEL).order("creado_at", { ascending: false })
    if (filtro !== "todos") q = q.eq("estado", filtro)
    const { data, error } = await q
    setLoading(false)
    if (error) { toast.error("Error cargando: " + error.message); return }
    setMails((data as MailPago[]) ?? [])
  }

  const abrir = () => { setOpen(true); cargar() }
  const setCampo = (id: string, campo: keyof MailPago, val: string | boolean) =>
    setMails(ms => ms.map(m => m.id === id ? { ...m, [campo]: val } : m))

  const guardar = async (m: MailPago, silent = false) => {
    const { error } = await supabase.from("mails_pago").update({
      email_destino: m.email_destino, asunto: m.asunto, cuerpo: m.cuerpo,
      adjuntar_retencion: m.adjuntar_retencion, adjuntar_detalle: m.adjuntar_detalle,
    }).eq("id", m.id)
    if (error) { toast.error("Error guardando: " + error.message); return false }
    if (!silent) toast.success("Guardado")
    return true
  }

  // URL del GAS desplegado como Web App (se pide una vez y queda en el navegador)
  const getGasUrl = (): string | null => {
    let u = localStorage.getItem("gas_mails_url")
    if (!u) {
      u = prompt("Pegá la URL del GAS desplegado como Web App (Apps Script → Deploy → Web app → URL):") || ""
      if (u) localStorage.setItem("gas_mails_url", u)
    }
    return u || null
  }
  const enviarBorrador = async (m: MailPago) => {
    if (!(await guardar(m, true))) return // persiste tus ediciones primero
    const url = getGasUrl(); if (!url) return
    try {
      await fetch(`${url}?id=${m.id}`, { method: "GET", mode: "no-cors" })
      toast.success("Preparando borrador… revisá Gmail. El estado se actualiza en unos segundos.")
      setTimeout(cargar, 3000)
    } catch (e) { toast.error("Error disparando el GAS: " + (e as Error).message) }
  }
  const enviarTodos = async () => {
    const pend = mails.filter(m => m.estado === "pendiente")
    if (pend.length === 0) { toast.info("No hay mails pendientes."); return }
    if (!confirm(`¿Preparar borradores de los ${pend.length} mails pendientes?`)) return
    const url = getGasUrl(); if (!url) return
    await Promise.all(pend.map(m => guardar(m, true))) // persiste ediciones de todos
    try {
      await fetch(url, { method: "GET", mode: "no-cors" })
      toast.success(`Preparando ${pend.length} borradores… revisá Gmail. El estado se actualiza en unos segundos.`)
      setTimeout(cargar, 4000)
    } catch (e) { toast.error("Error disparando el GAS: " + (e as Error).message) }
  }
  const borrar = async (m: MailPago) => {
    if (!confirm(`¿Borrar el mail encolado para ${m.proveedor || "?"}?`)) return
    const { error } = await supabase.from("mails_pago").delete().eq("id", m.id)
    if (error) { toast.error("Error: " + error.message); return }
    setMails(ms => ms.filter(x => x.id !== m.id)); toast.success("Borrado")
  }

  const pendientes = mails.filter(m => m.estado === "pendiente").length

  return (
    <>
      <Button variant="outline" size="sm" onClick={abrir} className="border-indigo-400 text-indigo-700">✉ Mails de detalle</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[92vh] h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>✉ Mails de detalle de pago — cola</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">Estado:</span>
            {["pendiente", "borrador", "enviado", "error", "todos"].map(e => (
              <button key={e} type="button" onClick={() => { setFiltro(e) }} onDoubleClick={cargar}
                className={`px-2 py-0.5 rounded-full border text-xs ${filtro === e ? "bg-slate-700 text-white border-slate-700" : "bg-white border-gray-300 text-gray-600"}`}>{e}</button>
            ))}
            <Button size="sm" variant="outline" onClick={cargar} disabled={loading}>{loading ? "…" : "↻ Refrescar"}</Button>
            <Button size="sm" onClick={enviarTodos} disabled={pendientes === 0} className="bg-blue-600 hover:bg-blue-700 text-white">✉ Enviar todos los pendientes</Button>
            <span className="text-xs text-gray-400 ml-2">Crea borradores en Gmail (los revisás y enviás vos). {pendientes > 0 && <b className="text-amber-700">{pendientes} pendiente(s)</b>}</span>
          </div>

          {mails.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">Sin mails en "{filtro}".</p>
          ) : (
            <div className="space-y-2 mt-2">
              {mails.map(m => (
                <div key={m.id} className="border rounded-lg p-2 bg-white text-sm">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded-full border text-xs ${estadoColor[m.estado] || "bg-gray-100"}`}>{m.estado}</span>
                    <span className="font-medium">{m.proveedor || "—"}</span>
                    {m.tiene_sicore && <span className="text-xs text-purple-700">con retención</span>}
                    <span className="text-xs text-gray-400">{new Date(m.creado_at).toLocaleString("es-AR")}</span>
                    {m.error && <span className="text-xs text-red-600">⚠ {m.error}</span>}
                    <span className="ml-auto flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={m.adjuntar_detalle !== false} onChange={e => setCampo(m.id, "adjuntar_detalle", e.target.checked)} /> adjuntar detalle</label>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!m.adjuntar_retencion} disabled={!m.tiene_sicore} onChange={e => setCampo(m.id, "adjuntar_retencion", e.target.checked)} /> adjuntar retención</label>
                      <Button size="sm" variant="outline" onClick={() => guardar(m)}>Guardar</Button>
                      <Button size="sm" onClick={() => enviarBorrador(m)} className="bg-blue-600 hover:bg-blue-700 text-white">Enviar Borrador</Button>
                      <Button size="sm" variant="ghost" onClick={() => borrar(m)} className="text-red-600">✕</Button>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-gray-500">Para</span>
                    <Input value={m.email_destino} onChange={e => setCampo(m.id, "email_destino", e.target.value)} placeholder="email…" className="h-7 w-64" />
                    <span className="text-gray-500">Asunto</span>
                    <Input value={m.asunto} onChange={e => setCampo(m.id, "asunto", e.target.value)} className="h-7 flex-1 min-w-[240px]" />
                  </div>
                  <textarea value={m.cuerpo} onChange={e => setCampo(m.id, "cuerpo", e.target.value)} rows={3} className="w-full border rounded px-2 py-1 mt-1 text-sm" />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
