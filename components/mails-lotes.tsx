"use client"

/**
 * 📦 Mails → «Para guardar»: archivar POR LOTES los documentos que llegan por mail — A-FEAT-1442 etapa 2.
 *
 * JMS 31/10: *«también desde la vista de mails, para trabajar de a lotes ahí»*. Un grupo por regla (de quién viene +
 * asunto); cada grupo con su carpeta (📁, o 📁❗ rojo si falta — se elige ahí mismo, existente o «＋ nuevo destino»).
 * Se tildan los mails y «Archivar»: el GAS guarda los adjuntos en la carpeta → la del año del mail, sin pisar ni
 * duplicar. Lo archivado queda en el registro (link al archivo) y sale de esta lista.
 * La lógica pura: `lib/mails/lotes.ts`. Los destinos: `components/destino-archivo.tsx`.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { ahoraISO } from "@/lib/fechas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { IconoDestinoArchivo, useDestinoArchivo } from "@/components/destino-archivo"
import { PasarACuota } from "@/components/mails-a-cuota"
import { ExternalLink, Paperclip, RefreshCw } from "lucide-react"
import { claveDeTipoMail, linkGmail, type MailRegistrado } from "@/lib/mails/registro"
import {
  mailsParaArchivar, mailsParaCuota, agruparPorRegla, anioDeMail, vinculosConArchivos, controlArchivado, esDocumento,
  type GrupoLote, type ReglaConDestino, type ResultadoArchivo,
} from "@/lib/mails/lotes"

const COLS = "id, regla_id, casilla, mensaje_id, sentido, fecha, remitente, remitente_nombre, destinatarios, asunto, extracto, adjuntos, tipo, tipo_manual, accion, estado, procesado_por, vinculos, seguimiento, seguimiento_nota, seguimiento_fecha, seguimiento_at"
const PERIODOS = [{ dias: 30, nombre: "30 días" }, { dias: 90, nombre: "90 días" }, { dias: 400, nombre: "Todo" }]
const fmt = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(iso))

interface Destino { clave: string; nombre: string; drive_folder_id: string | null }

export function LotesMails() {
  const [dias, setDias] = useState(90)
  const [mails, setMails] = useState<MailRegistrado[]>([])
  const [reglas, setReglas] = useState<ReglaConDestino[]>([])
  const [destinos, setDestinos] = useState<Destino[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    const desde = new Date(Date.now() - dias * 86400000).toISOString()
    const todos: MailRegistrado[] = []
    for (let i = 0; ; i += 1000) {
      const { data, error: e } = await supabase.from("mails_registro").select(COLS)
        .eq("sentido", "recibido").eq("accion", "guardar").gte("fecha", desde).order("fecha", { ascending: false }).range(i, i + 999)
      if (e) { setError(e.message); break }
      todos.push(...((data ?? []) as MailRegistrado[]))
      if (!data || data.length < 1000) break
    }
    const [{ data: rs, error: eR }, { data: ds }] = await Promise.all([
      supabase.from("mails_reglas").select("id, orden, activa, remitente_patron, asunto_patron, tipo, accion, nota, archivo_destino"),
      supabase.from("archivo_destinos").select("clave, nombre, drive_folder_id").order("nombre"),
    ])
    if (eR) setError("No se pudieron leer las reglas: " + eR.message + (/archivo_destino/.test(eR.message) ? " (falta correr el script 149)" : ""))
    setMails(todos); setReglas((rs ?? []) as ReglaConDestino[]); setDestinos((ds ?? []) as Destino[]); setCargando(false)
  }, [dias])
  useEffect(() => { void cargar() }, [cargar])

  const grupos = useMemo(() => agruparPorRegla(mailsParaArchivar(mails), reglas), [mails, reglas])
  const total = grupos.reduce((a, g) => a + g.mails.length, 0)

  const quitarArchivados = (ids: string[], vinculos: Record<string, MailRegistrado["vinculos"]>) =>
    setMails(prev => prev.map(m => ids.includes(m.id) ? { ...m, vinculos: vinculos[m.id] ?? m.vinculos } : m))
  const ponerDestino = (reglaId: string, clave: string) => setReglas(prev => prev.map(r => r.id === reglaId ? { ...r, archivo_destino: clave } : r))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map(p => <Button key={p.dias} size="sm" variant={dias === p.dias ? "default" : "outline"} onClick={() => setDias(p.dias)}>{p.nombre}</Button>)}
        <Button size="sm" variant="ghost" onClick={() => void cargar()} title="Volver a leer"><RefreshCw className="h-4 w-4" /></Button>
        <span className="text-sm text-muted-foreground">{cargando ? "Cargando…" : `${total} mail${total === 1 ? "" : "s"} con documentos para guardar, en ${grupos.length} grupo${grupos.length === 1 ? "" : "s"}`}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Cada grupo es una regla (de quién viene). Elegí su carpeta una vez (el 📁) y archivá los mails tildados: los adjuntos van a la carpeta del
        <b> año del mail</b>, como «fecha - nombre del archivo». Nada se pisa ni se duplica: lo que ya está queda como estaba. Las <b>facturas</b> las
        archiva el buscador de facturas, y las <b>boletas de ARBA</b> se bajan desde Cash Flow → Boletas ARBA.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <PasarACuota mails={mailsParaCuota(mails)} todosLosMails={mails}
        onCambio={(id, v) => setMails(prev => prev.map(m => m.id === id ? { ...m, vinculos: v } : m))} />
      {!cargando && !error && grupos.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No hay documentos pendientes de guardar en este período.</p>}
      {grupos.map(g => (
        <GrupoParaGuardar key={g.clave} grupo={g} destinos={destinos} setDestinos={setDestinos}
          onDestino={clave => g.regla && ponerDestino(g.regla.id, clave)} onArchivados={quitarArchivados} />
      ))}
    </div>
  )
}

function GrupoParaGuardar({ grupo, destinos, setDestinos, onDestino, onArchivados }: {
  grupo: GrupoLote; destinos: Destino[]; setDestinos: (d: Destino[]) => void
  onDestino: (clave: string) => void; onArchivados: (ids: string[], vinculos: Record<string, MailRegistrado["vinculos"]>) => void
}) {
  const clave = grupo.regla?.archivo_destino ?? ""
  const { destino, setDestino } = useDestinoArchivo(clave)
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(grupo.mails.map(m => m.id)))
  const [trabajando, setTrabajando] = useState(false)
  const [pendiente, setPendiente] = useState(false)
  const [resultados, setResultados] = useState<Record<string, string>>({})
  const [nuevo, setNuevo] = useState(false)
  useEffect(() => { setMarcados(new Set(grupo.mails.map(m => m.id))) }, [grupo.mails])

  /** Elegir (o crear) el destino de la regla — § 🧩: ahí mismo. */
  const elegirDestino = async (c: string) => {
    if (!grupo.regla) return
    const { error } = await supabase.from("mails_reglas").update({ archivo_destino: c, updated_at: ahoraISO() }).eq("id", grupo.regla.id)
    if (error) { toast.error("No se pudo guardar el destino de la regla: " + error.message); return }
    onDestino(c)
    toast.success("Listo: los documentos de esta regla van a «" + (destinos.find(d => d.clave === c)?.nombre ?? c) + "»")
  }
  const crearDestino = async (nombre: string) => {
    const n = nombre.trim()
    if (!n) return
    if (destinos.some(d => d.nombre.toLowerCase() === n.toLowerCase())) { toast.error(`Ya existe el destino «${n}»: elegilo de la lista.`); return }
    const c = claveDeTipoMail(n, destinos.map(d => d.clave))
    const { error } = await supabase.from("archivo_destinos").insert({ clave: c, nombre: n, por_anio: true, nota: "creado desde Mails → Para guardar" })
    if (error) { toast.error("No se pudo crear el destino: " + error.message); return }
    setDestinos([...destinos, { clave: c, nombre: n, drive_folder_id: null }].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNuevo(false)
    await elegirDestino(c)
  }

  const archivar = async (carpetaId?: string) => {
    const carpeta = carpetaId ?? destino?.drive_folder_id
    if (!carpeta) { setPendiente(true); toast.warning("Falta la carpeta: click en el 📁❗ y decime dónde va. Apenas la guardes, archivo solo."); return }
    const lista = grupo.mails.filter(m => marcados.has(m.id))
    if (!lista.length) { toast.info("No hay mails tildados."); return }
    setTrabajando(true)
    const hechos: string[] = [], vinculos: Record<string, MailRegistrado["vinculos"]> = {}
    let fallas = 0, noCierran = 0
    for (const m of lista) {
      setResultados(r => ({ ...r, [m.id]: "archivando…" }))
      try {
        const res = await fetch("/api/gas/archivar-mail", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: m.mensaje_id, carpeta_id: carpeta, anio: anioDeMail(m.fecha) }) })
        const j = (await res.json()) as ResultadoArchivo
        if (!j.ok) throw new Error(j.error ?? "el GAS no dijo por qué")
        const ctl = controlArchivado((m.adjuntos ?? []).length, j)
        if (!ctl.cierra) noCierran++
        const v = vinculosConArchivos(m.vinculos, j)
        const { error } = await supabase.from("mails_registro").update({
          vinculos: v, procesado_por: `archivado en ${j.carpeta?.nombre ?? "su carpeta"}`, estado: "procesado", updated_at: ahoraISO(),
        }).eq("id", m.id)
        if (error) throw new Error("se archivó pero no se pudo anotar en el registro: " + error.message)
        hechos.push(m.id); vinculos[m.id] = v
        setResultados(r => ({ ...r, [m.id]: `${ctl.cierra ? "✔" : "⚠️"} ${ctl.texto}` }))
      } catch (e) {
        fallas++
        setResultados(r => ({ ...r, [m.id]: "✗ " + (e as Error).message }))
      }
    }
    setTrabajando(false); setPendiente(false)
    if (hechos.length) onArchivados(hechos, vinculos)
    if (fallas) toast.error(`${fallas} mail${fallas > 1 ? "s" : ""} no se pudieron archivar (ver el motivo en cada uno)`)
    else toast.success(`${hechos.length} mail${hechos.length > 1 ? "s" : ""} archivado${hechos.length > 1 ? "s" : ""}`)
    if (noCierran) toast.warning(`${noCierran} mail${noCierran > 1 ? "s" : ""} con adjuntos que no se pudieron contar: revisalos`)
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{grupo.titulo}</span>
        <span className="text-xs text-muted-foreground">{grupo.mails.length} mail{grupo.mails.length > 1 ? "s" : ""}</span>
        {!grupo.regla ? (
          <span className="text-xs text-amber-700">Sin regla: en «Registro», cambiale el tipo eligiendo «todos los de este remitente» y vuelve acá con su regla.</span>
        ) : clave ? (
          <IconoDestinoArchivo clave={clave} nombre={destinos.find(d => d.clave === clave)?.nombre ?? clave} anio={anioDeMail(grupo.mails[0].fecha)}
            destino={destino} setDestino={setDestino}
            onListo={d => { if (pendiente && d.drive_folder_id) void archivar(d.drive_folder_id) }} />
        ) : (
          <select className="h-7 rounded border border-red-500 bg-red-50 px-2 text-xs font-semibold text-red-700" value=""
            onChange={e => e.target.value === "__nuevo" ? setNuevo(true) : void elegirDestino(e.target.value)}>
            <option value="">📁❗ ¿A qué carpeta van?</option>
            {destinos.map(d => <option key={d.clave} value={d.clave}>{d.nombre}</option>)}
            <option value="__nuevo">＋ Nuevo destino…</option>
          </select>
        )}
        {grupo.regla && (
          <Button size="sm" className="ml-auto h-7 text-xs" disabled={trabajando} variant={destino?.drive_folder_id ? "default" : "destructive"} onClick={() => void archivar()}>
            {trabajando ? "Archivando…" : `Archivar ${marcados.size}`}{pendiente && !destino?.drive_folder_id ? " (pendiente: falta la carpeta)" : ""}
          </Button>
        )}
      </div>
      <ul className="space-y-0.5 text-xs">
        {grupo.mails.map(m => (
          <li key={m.id} className="flex items-center gap-2">
            <input type="checkbox" checked={marcados.has(m.id)} disabled={!grupo.regla}
              onChange={() => setMarcados(s => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n })} />
            <span className="w-16 tabular-nums text-muted-foreground">{fmt(m.fecha)}</span>
            <a href={linkGmail(m.casilla, m.mensaje_id)} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center gap-1 truncate hover:underline">
              {m.asunto || "(sin asunto)"}<ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
            <span className="inline-flex items-center gap-0.5 text-muted-foreground" title={(m.adjuntos ?? []).map(a => a.nombre).join("\n")}>
              <Paperclip className="h-3 w-3" />{(m.adjuntos ?? []).filter(esDocumento).length}
            </span>
            {resultados[m.id] && <span className={resultados[m.id].startsWith("✗") ? "text-red-600" : resultados[m.id].startsWith("⚠") ? "text-amber-700" : "text-green-700"}>{resultados[m.id]}</span>}
          </li>
        ))}
      </ul>
      <DialogoDestinoNuevo abierto={nuevo} onCerrar={() => setNuevo(false)} onCrear={crearDestino} />
    </div>
  )
}

function DialogoDestinoNuevo({ abierto, onCerrar, onCrear }: { abierto: boolean; onCerrar: () => void; onCrear: (n: string) => Promise<void> }) {
  const [nombre, setNombre] = useState("")
  useEffect(() => { if (abierto) setNombre("") }, [abierto])
  return (
    <Dialog open={abierto} onOpenChange={a => { if (!a) onCerrar() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nuevo destino de archivo</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Un nombre para este tipo de documento (ej. «Expensas Libertad», «Red Vial Rojas»). Después elegís su carpeta con el 📁.</p>
        <Input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && nombre.trim()) void onCrear(nombre) }} />
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button disabled={!nombre.trim()} onClick={() => void onCrear(nombre)}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
