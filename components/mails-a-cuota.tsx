"use client"

/**
 * 💲 Mails → «Para guardar» → «Pasar el monto a su cuota» — A-FEAT-1442 etapa 3.
 *
 * Los documentos ya archivados (expensas, ABL, Red Vial, VEP del contador, sueldos domésticas…) se LEEN (el OCR del
 * buscador de facturas) y se propone: importe y vencimiento (editables, es-AR), el template (el de la última vez para
 * esa regla, o el que más se parece) y la cuota sin pagar más cercana. «Aplicar» cambia SÓLO el monto y el vencimiento
 * de esa cuota —como Boletas ARBA: `fecha_estimada` no se toca— y deja la HUELLA en el mail: lo leído, lo aplicado y
 * lo que tenía la cuota (CLAUDE.md § Importar un documento). Nada se aplica sin el click.
 * La lógica: `lib/mails/leer-documento.ts`.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { ahoraISO } from "@/lib/fechas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExternalLink } from "lucide-react"
import { linkGmail, type MailRegistrado } from "@/lib/mails/registro"
import { linkDeArchivo } from "@/lib/mails/lotes"
import {
  leerDocumento, templateSugerido, cuotaSugerida, huellaCuota, diferenciaCuota, montoAr,
  type Lectura, type TemplateSimple, type CuotaSimple,
} from "@/lib/mails/leer-documento"

const pesos = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dia = (f: string | null | undefined) => f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(2, 4)}` : "—"
/** 'dd/mm/aaaa' o 'AAAA-MM-DD' → 'AAAA-MM-DD' (o null) */
const aIso = (t: string) => {
  const s = t.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  return m ? `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null
}

/** El nombre del template usado la última vez para esta regla (de la huella de otro mail). */
function templateUsadoAntes(mails: MailRegistrado[], reglaId: string | null | undefined): string | null {
  if (!reglaId) return null
  for (const m of mails) {
    if (m.regla_id !== reglaId) continue
    const h = (m.vinculos ?? []).find(v => v.tabla === "cuotas_egresos_sin_factura")
    if (h?.que) { try { return JSON.parse(h.que).template ?? null } catch { /* huella vieja */ } }
  }
  return null
}

export function PasarACuota({ mails, todosLosMails, onCambio }: {
  mails: MailRegistrado[]; todosLosMails: MailRegistrado[]
  onCambio: (id: string, vinculos: MailRegistrado["vinculos"]) => void
}) {
  const [templates, setTemplates] = useState<TemplateSimple[]>([])
  useEffect(() => {
    supabase.from("egresos_sin_factura").select("id, nombre_referencia, responsable").eq("activo", true).order("nombre_referencia")
      .then(({ data, error }) => { if (error) toast.error("No se pudieron leer los templates: " + error.message); setTemplates((data ?? []) as TemplateSimple[]) })
  }, [])
  if (!mails.length) return null
  return (
    <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50/40 p-3">
      <p className="text-sm font-medium">💲 Pasar el monto a su cuota ({mails.length})</p>
      <p className="text-xs text-muted-foreground">
        Documentos ya archivados. «Leer» propone el importe, el vencimiento, el template y la cuota: todo se puede cambiar. «Aplicar» cambia sólo el
        monto y el vencimiento de esa cuota, y queda anotado lo que se leyó y lo que pusiste. «No va» lo saca de esta lista sin tocar nada.
      </p>
      {mails.map(m => <FilaCuota key={m.id} mail={m} templates={templates} usadoAntes={templateUsadoAntes(todosLosMails, m.regla_id)} onCambio={onCambio} />)}
    </div>
  )
}

function FilaCuota({ mail, templates, usadoAntes, onCambio }: {
  mail: MailRegistrado; templates: TemplateSimple[]; usadoAntes: string | null
  onCambio: (id: string, vinculos: MailRegistrado["vinculos"]) => void
}) {
  const [lectura, setLectura] = useState<Lectura | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [importe, setImporte] = useState("")
  const [venc, setVenc] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [cuotas, setCuotas] = useState<CuotaSimple[]>([])
  const [cuotaId, setCuotaId] = useState("")
  const [aplicando, setAplicando] = useState(false)
  const archivo = (mail.vinculos ?? []).find(v => v.schema === "drive")

  const cargarCuotas = useCallback(async (tid: string, vencLeido: string | null) => {
    setTemplateId(tid); setCuotas([]); setCuotaId("")
    if (!tid) return
    const { data, error } = await supabase.from("cuotas_egresos_sin_factura")
      .select("id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, grupo_pago_id").eq("egreso_id", tid).order("fecha_vencimiento")
    if (error) { toast.error("No se pudieron leer las cuotas: " + error.message); return }
    const cs = (data ?? []) as CuotaSimple[]
    setCuotas(cs)
    setCuotaId(cuotaSugerida(cs, vencLeido, mail.fecha)?.id ?? "")
  }, [mail.fecha])

  const leer = async () => {
    if (!archivo) return
    setLeyendo(true)
    try {
      const r = await fetch("/api/gas/leer-archivo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: archivo.id }) })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error ?? "el GAS no dijo por qué")
      const l = leerDocumento(String(j.texto ?? ""))
      setLectura(l)
      setImporte(l.importe != null ? pesos(l.importe) : "")
      setVenc(l.vencimiento ? dia(l.vencimiento).replace(/\/(\d{2})$/, "/20$1") : "")
      const t = templateSugerido(templates, usadoAntes, [mail.asunto ?? "", mail.remitente_nombre ?? "", mail.procesado_por ?? ""])
      await cargarCuotas(t?.id ?? "", l.vencimiento)
    } catch (e) {
      toast.error("No se pudo leer el documento: " + (e as Error).message)
    } finally { setLeyendo(false) }
  }

  const cuota = cuotas.find(c => c.id === cuotaId) ?? null
  const montoNuevo = importe.trim() ? montoAr(importe) : null
  const dif = useMemo(() => cuota && montoNuevo ? diferenciaCuota(cuota.monto, montoNuevo) : null, [cuota, montoNuevo])

  const aplicar = async () => {
    if (!cuota || !montoNuevo || !lectura) { toast.error("Falta el importe o la cuota."); return }
    const vIso = venc.trim() ? aIso(venc) : null
    if (venc.trim() && !vIso) { toast.error("El vencimiento tiene que ser dd/mm/aaaa."); return }
    const t = templates.find(x => x.id === templateId)
    if (!window.confirm(`${t?.nombre_referencia ?? "Template"} · cuota ${cuota.numero_cuota ?? ""}\n\n` +
      `Monto: ${pesos(cuota.monto)} → ${pesos(montoNuevo)}${dif ? ` (${dif.texto})` : ""}\n` +
      (vIso && vIso !== cuota.fecha_vencimiento ? `Vence: ${dia(cuota.fecha_vencimiento)} → ${dia(vIso)}\n` : "") +
      (String(cuota.estado).toLowerCase() === "conciliado" ? "\n⚠️ Ya está CONCILIADA." : "") + "\n¿Aplicar?")) return
    setAplicando(true)
    try {
      // Sólo monto y vencimiento (como Boletas ARBA): fecha_estimada mueve la proyección y no es lo que dice el papel
      const cambios: Record<string, unknown> = { monto: montoNuevo, updated_at: ahoraISO() }
      if (vIso) cambios.fecha_vencimiento = vIso
      const { error } = await supabase.from("cuotas_egresos_sin_factura").update(cambios).eq("id", cuota.id)
      if (error) throw error
      const huella = huellaCuota({ cuota_id: cuota.id, template: t?.nombre_referencia ?? "", leido: lectura,
        aplicado: { monto: montoNuevo, vencimiento: vIso }, antes: { monto: cuota.monto, vencimiento: cuota.fecha_vencimiento } })
      const vinculos = [...(mail.vinculos ?? []), huella]
      const { error: e2 } = await supabase.from("mails_registro").update({
        vinculos, procesado_por: `${mail.procesado_por ?? "archivado"} · cuota ${cuota.numero_cuota ?? ""} de ${t?.nombre_referencia ?? ""} actualizada`, updated_at: ahoraISO(),
      }).eq("id", mail.id)
      if (e2) throw new Error("la cuota se cambió pero no se pudo anotar en el mail: " + e2.message)
      toast.success(`Cuota ${cuota.numero_cuota ?? ""} de ${t?.nombre_referencia ?? ""}: ${pesos(montoNuevo)}`)
      onCambio(mail.id, vinculos)
    } catch (e) {
      toast.error("No se pudo aplicar: " + (e as Error).message)
    } finally { setAplicando(false) }
  }

  const noVa = async () => {
    const vinculos = [...(mail.vinculos ?? []), { schema: "ninguna", tabla: "cuota", id: "-", que: "no va a una cuota (marcado a mano)" }]
    const { error } = await supabase.from("mails_registro").update({ vinculos, updated_at: ahoraISO() }).eq("id", mail.id)
    if (error) { toast.error(error.message); return }
    onCambio(mail.id, vinculos)
  }

  return (
    <div className="space-y-1 rounded border bg-white p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <a href={linkGmail(mail.casilla, mail.mensaje_id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
          {mail.asunto || "(sin asunto)"}<ExternalLink className="h-3 w-3 opacity-60" />
        </a>
        <span className="text-muted-foreground">{mail.remitente_nombre || mail.remitente}</span>
        {linkDeArchivo(mail.vinculos) && <a href={linkDeArchivo(mail.vinculos)!} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">📎 ver el documento</a>}
        <div className="ml-auto flex gap-1">
          {!lectura && <Button size="sm" variant="outline" className="h-6 text-xs" disabled={leyendo} onClick={() => void leer()}>{leyendo ? "Leyendo…" : "📄 Leer"}</Button>}
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => void noVa()}>No va</Button>
        </div>
      </div>
      {lectura && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">Importe <Input type="text" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0,00" className="h-6 w-32 text-right text-xs tabular-nums" /></label>
          {lectura.importes.length > 1 && (
            <select className="h-6 rounded border px-1 text-xs" value="" onChange={e => e.target.value && setImporte(pesos(Number(e.target.value)))} title="Otros importes que se leyeron">
              <option value="">otros…</option>
              {lectura.importes.map(c => <option key={c.monto} value={c.monto}>{pesos(c.monto)}{c.etiqueta ? ` (${c.etiqueta})` : ""}</option>)}
            </select>
          )}
          <label className="flex items-center gap-1">Vence <Input type="text" value={venc} onChange={e => setVenc(e.target.value)} placeholder="dd/mm/aaaa" className="h-6 w-24 text-xs" /></label>
          <select className="h-6 max-w-[220px] rounded border px-1 text-xs" value={templateId} onChange={e => void cargarCuotas(e.target.value, aIso(venc))}>
            <option value="">— template —</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.nombre_referencia}{t.responsable ? ` (${t.responsable})` : ""}</option>)}
          </select>
          <select className="h-6 rounded border px-1 text-xs" value={cuotaId} onChange={e => setCuotaId(e.target.value)} disabled={!cuotas.length}>
            <option value="">— cuota —</option>
            {cuotas.map(c => <option key={c.id} value={c.id}>c{c.numero_cuota ?? "?"} · vence {dia(c.fecha_vencimiento ?? c.fecha_estimada)} · {pesos(c.monto)} · {c.estado}{c.grupo_pago_id ? " · en un pago agrupado" : ""}</option>)}
          </select>
          {dif && <span className={dif.grande ? "font-semibold text-amber-700" : "text-muted-foreground"}>{dif.texto}</span>}
          <Button size="sm" className="h-6 text-xs" disabled={aplicando || !cuota || !montoNuevo} onClick={() => void aplicar()}>Aplicar</Button>
          {lectura.aviso && <span className="w-full text-amber-700">⚠️ {lectura.aviso}{lectura.periodo ? ` · período ${lectura.periodo}` : ""}</span>}
          {!lectura.aviso && lectura.periodo && <span className="text-muted-foreground">período {lectura.periodo}</span>}
        </div>
      )}
    </div>
  )
}
