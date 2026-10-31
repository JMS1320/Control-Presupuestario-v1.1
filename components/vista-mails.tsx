"use client"

/**
 * 📬 MAILS — el registro de todo lo que pasa por la casilla, con link a cada mail (A-FEAT-1425, JMS 30/10).
 *
 * Lo escribe el GAS `gas-buscar-pdf/RegistroMails.gs`; acá se consulta y se trabaja:
 *   · Registro: período, chips por grupo y por seguimiento, filtros por columna tipo Excel (A-FEAT-1441), el CONTROL
 *     de que los grupos suman el total, y por cada mail:
 *       – el TIPO, que se crea ahí mismo y se reasigna eligiendo el alcance: sólo éste / todos los del remitente /
 *         los del remitente con ese asunto (A-FEAT-1440, CLAUDE.md § 🧩);
 *       – el SEGUIMIENTO: pendiente (qué falta y para cuándo) o terminado. Los pendientes se ven siempre, arriba,
 *         aunque sean de antes del período (A-FEAT-1437).
 *   · Reglas: de quién viene → tipo y qué se hace; los tipos se renombran ahí.
 * 🔒 Sólo admin: tiene mails de la familia y de la sucesión (ver `vista-egresos.tsx`).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { ahoraISO, hoyArgentina } from "@/lib/fechas"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { FiltroColumna } from "@/components/ui/filtro-columna"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { LotesMails } from "@/components/mails-lotes"
import { AlertTriangle, CheckCircle2, ExternalLink, Paperclip, RefreshCw } from "lucide-react"
import { toggleChip, esSoloEste, tituloChip, PISTA_CTRL_CLICK } from "@/lib/ui/chips"
import { opcionesDeColumna, filtrarPorColumnas } from "@/lib/ui/filtro-columna"
import {
  TIPOS_MAIL, NOMBRE_GRUPO_MAIL, NOMBRE_SEGUIMIENTO, linkGmail, tipoDeMail, grupoDeMail, filtrarMails, contarMails,
  contarPorTipo, problemaDeRegla, procesadoDeMail, cambiosAlReaplicar, nombresDeTipos, claveDeTipoMail, problemaDeTipoNuevo,
  contraparteDeMail, asuntoBase, reglaParaAlcance, mailsQueAlcanza, estadoSeguimiento, ordenarPendientesArriba,
  juntarConPendientes, problemaDeSeguimiento, claseDeProcesado, gravedadDeMail,
  type BusquedaConMail, type InventarioConMail, type MailRegistrado, type ReglaMail, type GrupoMail, type AccionMail,
  type TipoMailFila, type AlcanceTipo, type EstadoSeguimiento, type SeguimientoMail,
} from "@/lib/mails/registro"

const COLUMNAS = "id, regla_id, casilla, mensaje_id, sentido, fecha, remitente, remitente_nombre, destinatarios, asunto, extracto, adjuntos, tipo, tipo_manual, accion, estado, procesado_por, vinculos, seguimiento, seguimiento_nota, seguimiento_fecha, seguimiento_at"
const GRUPOS: GrupoMail[] = ["mirar", "sin_regla", "guardado", "archivado", "enviado"]
const SEGUIMIENTOS: EstadoSeguimiento[] = ["vencido", "pendiente", "terminado", "sin_marcar"]
const PERIODOS = [{ dias: 1, nombre: "Último día" }, { dias: 7, nombre: "7 días" }, { dias: 30, nombre: "30 días" }, { dias: 90, nombre: "90 días" }]
const NOMBRE_ACCION: Record<AccionMail, string> = { avisar: "Avisar", guardar: "Guardar", archivar: "Archivar" }
const NUEVO = "__nuevo__"

const fmtFecha = (iso: string) => new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
}).format(new Date(iso))
const fmtDia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

function Chip({ activo, onClick, titulo, children, tono }: { activo: boolean; onClick: (e: React.MouseEvent) => void; titulo: string; children: React.ReactNode; tono?: "rojo" }) {
  return (
    <button type="button" title={titulo} onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${activo
        ? (tono === "rojo" ? "border-red-600 bg-red-600 text-white" : "border-primary bg-primary text-primary-foreground")
        : "border-border bg-background hover:bg-muted"}`}>
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos (maestro editable, script 147)
// ─────────────────────────────────────────────────────────────────────────────

function useTiposMail() {
  const [tipos, setTipos] = useState<TipoMailFila[]>(TIPOS_MAIL.map((t, i) => ({ ...t, orden: (i + 1) * 10 })))
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("mails_tipos").select("id, nombre, orden").order("orden").order("nombre")
    if (error) { toast.error("No se pudieron leer los tipos: " + error.message); return }
    if (data?.length) setTipos(data as TipoMailFila[])
  }, [])
  useEffect(() => { cargar() }, [cargar])
  /** Crea el tipo en el maestro y devuelve su clave (o null si no se pudo). */
  const crear = async (nombre: string): Promise<string | null> => {
    const problema = problemaDeTipoNuevo(nombre, tipos)
    if (problema) { toast.error(problema); return null }
    const id = claveDeTipoMail(nombre, tipos.map(t => t.id))
    const orden = Math.max(0, ...tipos.map(t => t.orden)) + 10
    const { error } = await supabase.from("mails_tipos").insert({ id, nombre: nombre.trim(), orden, nota: "creado desde la app" })
    if (error) { toast.error("No se pudo crear el tipo: " + error.message); return null }
    setTipos(prev => [...prev, { id, nombre: nombre.trim(), orden }])
    toast.success(`Tipo «${nombre.trim()}» creado`)
    return id
  }
  const renombrar = async (id: string, nombre: string) => {
    const n = nombre.trim()
    const actual = tipos.find(t => t.id === id)
    if (!actual || actual.nombre === n) return
    const problema = problemaDeTipoNuevo(n, tipos.filter(t => t.id !== id))
    if (problema) { toast.error(problema); return }
    const { error } = await supabase.from("mails_tipos").update({ nombre: n, updated_at: ahoraISO() }).eq("id", id)
    if (error) { toast.error("No se pudo renombrar: " + error.message); return }
    setTipos(prev => prev.map(t => t.id === id ? { ...t, nombre: n } : t))
    toast.success(`Renombrado a «${n}»`)
  }
  return { tipos, nombres: nombresDeTipos(tipos), crear, renombrar }
}

/** Lista de tipos con «＋ Nuevo tipo…» al final (§ 🧩: se crea ahí mismo). */
function SelectTipo({ valor, tipos, onElegir, onNuevo, className, title, vacio, marcaManual }: {
  valor: string; tipos: TipoMailFila[]; onElegir: (v: string) => void; onNuevo: () => void
  className?: string; title?: string; vacio?: string; marcaManual?: string | null
}) {
  return (
    <select value={valor} title={title} className={className}
      onChange={e => e.target.value === NUEVO ? onNuevo() : onElegir(e.target.value)}>
      {vacio !== undefined && <option value="">{vacio}</option>}
      {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}{marcaManual === t.id ? " ✎" : ""}</option>)}
      <option value={NUEVO}>＋ Nuevo tipo…</option>
    </select>
  )
}

function DialogoTipoNuevo({ abierto, onCerrar, onCrear }: { abierto: boolean; onCerrar: () => void; onCrear: (nombre: string) => Promise<void> }) {
  const [nombre, setNombre] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  useEffect(() => { if (abierto) setNombre("") }, [abierto])
  const crear = async () => { setTrabajando(true); await onCrear(nombre); setTrabajando(false) }
  return (
    <Dialog open={abierto} onOpenChange={a => { if (!a) onCerrar() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nuevo tipo de mail</DialogTitle></DialogHeader>
        <Input autoFocus placeholder="Ej.: Cuenta corriente, Arrendatarios…" value={nombre} onChange={e => setNombre(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && nombre.trim()) crear() }} />
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={crear} disabled={!nombre.trim() || trabajando}>Crear y usar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reasignar el tipo con ALCANCE (A-FEAT-1440)
// ─────────────────────────────────────────────────────────────────────────────

function DialogoAlcance({ mail, tipo, nombres, onCerrar, onHecho }: {
  mail: MailRegistrado | null; tipo: string; nombres: Record<string, string>
  onCerrar: () => void; onHecho: (cambios: { ids: string[]; tipo: string; manualDe?: string }) => void
}) {
  const [alcance, setAlcance] = useState<AlcanceTipo>("este")
  const [asunto, setAsunto] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  useEffect(() => { if (mail) { setAlcance("este"); setAsunto(asuntoBase(mail.asunto)) } }, [mail])
  if (!mail) return null
  const quien = contraparteDeMail(mail)

  const aplicar = async () => {
    setTrabajando(true)
    try {
      if (alcance === "este") {
        const valor = tipo === mail.tipo ? null : tipo
        const { error } = await supabase.from("mails_registro").update({ tipo_manual: valor, updated_at: ahoraISO() }).eq("id", mail.id)
        if (error) throw error
        onHecho({ ids: [mail.id], tipo, manualDe: mail.id })
        toast.success(`Sólo este mail pasa a «${nombres[tipo] ?? tipo}»`)
        return
      }
      if (alcance === "remitente_asunto" && !asunto.trim()) { toast.error("Escribí qué tiene que decir el asunto."); return }
      // 1 · La regla: se crea, o se actualiza la que ya había con el mismo remitente y asunto
      const { data: rs, error: eR } = await supabase.from("mails_reglas").select("id, orden, activa, remitente_patron, asunto_patron, tipo, accion, nota")
      if (eR) throw eR
      const reglas = (rs ?? []) as ReglaMail[]
      const { existente, regla } = reglaParaAlcance(reglas, mail, alcance, tipo, asunto)
      if (problemaDeRegla(regla, Object.keys(nombres))) throw new Error(problemaDeRegla(regla, Object.keys(nombres))!)
      let reglaId: string
      if (existente) {
        const { error } = await supabase.from("mails_reglas").update({ tipo, orden: regla.orden, activa: true, updated_at: ahoraISO() }).eq("id", existente.id)
        if (error) throw error
        reglaId = existente.id
      } else {
        const { data, error } = await supabase.from("mails_reglas").insert({ ...regla, nota: "creada desde un mail (alcance)" }).select("id").single()
        if (error) throw error
        reglaId = data.id
      }
      const reglasDespues: ReglaMail[] = existente
        ? reglas.map(r => r.id === reglaId ? { ...r, tipo, orden: regla.orden, activa: true } : r)
        : [...reglas, { id: reglaId, activa: true, nota: null, ...regla }]
      // 2 · Hacia atrás: todos los mails de esa contraparte (recibidos de él o enviados a él)
      const { data: cand, error: eC } = await supabase.from("mails_registro").select("id, sentido, remitente, destinatarios, asunto, tipo_manual")
        .or(`remitente.eq.${quien},destinatarios.ilike.${quien}%`)
      if (eC) throw eC
      const { alcanza, ganaOtra } = mailsQueAlcanza(cand ?? [], regla, reglasDespues, tipo, mail.id)
      for (let i = 0; i < alcanza.length; i += 100) {
        const { error } = await supabase.from("mails_registro")
          .update({ tipo, regla_id: reglaId, tipo_manual: null, updated_at: ahoraISO() }).in("id", alcanza.slice(i, i + 100))
        if (error) throw error
      }
      onHecho({ ids: alcanza, tipo })
      toast.success(`Regla ${existente ? "actualizada" : "creada"}: ${alcanza.length} mail${alcanza.length === 1 ? "" : "s"} pasan a «${nombres[tipo] ?? tipo}», y los que lleguen también`)
      // Control: si otra regla anterior le gana a ésta en algunos, se dice (no se pisa en silencio)
      if (ganaOtra.length) toast.warning(`${ganaOtra.length} mail${ganaOtra.length === 1 ? "" : "s"} de ${quien} siguen con otra regla que va antes. Revisalas en «Reglas».`)
      const manuales = (cand ?? []).filter(c => c.tipo_manual && c.id !== mail.id).length
      if (manuales) toast.info(`${manuales} mail${manuales === 1 ? "" : "s"} con el tipo puesto a mano no se tocaron.`)
    } catch (e) {
      toast.error("No se pudo reasignar: " + (e as Error).message)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Dialog open={!!mail} onOpenChange={a => { if (!a) onCerrar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Pasar a «{nombres[tipo] ?? tipo}»</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{mail.asunto || "(sin asunto)"} · {quien}</p>
        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2"><input type="radio" checked={alcance === "este"} onChange={() => setAlcance("este")} className="mt-1" />
            <span><b>Sólo este mail</b><br /><span className="text-xs text-muted-foreground">Queda marcado ✎ y ninguna regla lo vuelve a cambiar.</span></span></label>
          <label className="flex items-start gap-2"><input type="radio" checked={alcance === "remitente"} onChange={() => setAlcance("remitente")} className="mt-1" />
            <span><b>Todos los de {quien}</b><br /><span className="text-xs text-muted-foreground">Los que ya llegaron y los que lleguen (crea la regla).</span></span></label>
          <label className="flex items-start gap-2"><input type="radio" checked={alcance === "remitente_asunto"} onChange={() => setAlcance("remitente_asunto")} className="mt-1" />
            <span className="flex-1"><b>Los de {quien} cuyo asunto dice…</b>
              <Input value={asunto} onChange={e => { setAsunto(e.target.value); setAlcance("remitente_asunto") }} className="mt-1 h-8 text-xs" />
              <span className="text-xs text-muted-foreground">Hacia atrás y hacia adelante. Sirve cuando el mismo remitente manda cosas distintas.</span></span></label>
        </div>
        <p className="text-xs text-muted-foreground">Los mails que corregiste a mano uno por uno no se tocan.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={aplicar} disabled={trabajando}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Seguimiento de un mail (A-FEAT-1437)
// ─────────────────────────────────────────────────────────────────────────────

function CeldaSeguimiento({ mail, hoy, onGuardado }: { mail: MailRegistrado; hoy: string; onGuardado: (m: Partial<MailRegistrado>) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<SeguimientoMail | null>(mail.seguimiento ?? null)
  const [nota, setNota] = useState(mail.seguimiento_nota ?? "")
  const [fecha, setFecha] = useState(mail.seguimiento_fecha ?? "")
  useEffect(() => {
    if (abierto) { setEstado(mail.seguimiento ?? null); setNota(mail.seguimiento_nota ?? ""); setFecha(mail.seguimiento_fecha ?? "") }
  }, [abierto, mail])
  const e = estadoSeguimiento(mail, hoy)

  const guardar = async (cambio?: { estado: SeguimientoMail | null }) => {
    const s = cambio ? cambio.estado : estado
    const problema = problemaDeSeguimiento({ fecha })
    if (problema) { toast.error(problema); return }
    const datos = { seguimiento: s, seguimiento_nota: nota.trim() || null, seguimiento_fecha: fecha || null, seguimiento_at: ahoraISO() }
    const { error } = await supabase.from("mails_registro").update({ ...datos, updated_at: ahoraISO() }).eq("id", mail.id)
    if (error) { toast.error("No se pudo guardar el seguimiento: " + error.message); return }
    onGuardado(datos)
    setAbierto(false)
    toast.success(s === "terminado" ? "Terminado ✔" : s === "pendiente" ? "Queda pendiente" : "Sin marcar")
  }

  const etiqueta = e === "terminado" ? <span className="text-green-700 dark:text-green-400">✔ terminado</span>
    : e === "vencido" ? <span className="font-semibold text-red-600">📌 vencido {mail.seguimiento_fecha ? fmtDia(mail.seguimiento_fecha) : ""}</span>
    : e === "pendiente" ? <span className="text-amber-700 dark:text-amber-400">📌 pendiente{mail.seguimiento_fecha ? " · " + fmtDia(mail.seguimiento_fecha) : ""}</span>
    : <span className="text-muted-foreground">—</span>

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button type="button" className="w-full rounded px-1 text-left text-xs hover:bg-muted" title={mail.seguimiento_nota ?? "Marcar seguimiento"}>
          {etiqueta}
          {mail.seguimiento_nota && e !== "terminado" && <span className="block truncate text-[11px] text-muted-foreground">{mail.seguimiento_nota}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2">
        <div className="flex gap-1">
          {([["pendiente", "📌 Pendiente"], ["terminado", "✔ Terminado"], [null, "Sin marcar"]] as [SeguimientoMail | null, string][]).map(([v, n]) => (
            <Button key={String(v)} size="sm" variant={estado === v ? "default" : "outline"} className="h-7 flex-1 text-xs" onClick={() => setEstado(v)}>{n}</Button>
          ))}
        </div>
        <Textarea placeholder="Qué falta, quién tiene que hacer qué…" value={nota} onChange={e => setNota(e.target.value)} className="min-h-[60px] text-xs" />
        <label className="flex items-center gap-2 text-xs">Volver a mirarlo el
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-7 w-40 text-xs" />
        </label>
        <div className="flex justify-between">
          {mail.seguimiento !== "terminado" && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => guardar({ estado: "terminado" })}>Terminado ya</Button>}
          <Button size="sm" className="ml-auto h-7 text-xs" onClick={() => guardar()}>Guardar</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Registro
// ─────────────────────────────────────────────────────────────────────────────

type Columna = "dePara" | "tipo" | "hizo"

function RegistroMails() {
  const { tipos, nombres, crear } = useTiposMail()
  const [dias, setDias] = useState(7)
  const [mails, setMails] = useState<MailRegistrado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [grupos, setGrupos] = useState<Set<GrupoMail>>(new Set())
  const [seguimientos, setSeguimientos] = useState<Set<EstadoSeguimiento>>(new Set())
  const [tiposChip, setTiposChip] = useState<Set<string>>(new Set())
  const [columnas, setColumnas] = useState<Record<Columna, Set<string> | null>>({ dePara: null, tipo: null, hizo: null })
  const [texto, setTexto] = useState("")
  const [soloGraves, setSoloGraves] = useState(false)  // 🚨 A-FEAT-1438
  const [busquedas, setBusquedas] = useState<BusquedaConMail[]>([])
  const [inventario, setInventario] = useState<InventarioConMail[]>([])
  // Reasignar: el mail y el tipo elegido abren el diálogo de alcance; «nuevo» abre antes el de crear tipo
  const [reasignar, setReasignar] = useState<{ mail: MailRegistrado; tipo: string } | null>(null)
  const [nuevoPara, setNuevoPara] = useState<MailRegistrado | null>(null)
  const hoy = hoyArgentina()

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    const desde = new Date(Date.now() - dias * 86400000).toISOString()
    const delPeriodo: MailRegistrado[] = []
    // La API corta en 1000 filas: se pide de a tramos
    for (let i = 0; ; i += 1000) {
      const { data, error: e } = await supabase.from("mails_registro").select(COLUMNAS)
        .gte("fecha", desde).order("fecha", { ascending: false }).range(i, i + 999)
      if (e) { setError(e.message); break }
      delPeriodo.push(...((data ?? []) as MailRegistrado[]))
      if (!data || data.length < 1000) break
    }
    // Los pendientes se ven SIEMPRE, aunque sean de antes del período
    const { data: pend, error: eP } = await supabase.from("mails_registro").select(COLUMNAS).eq("seguimiento", "pendiente")
    if (eP) setError(eP.message)
    const todos = juntarConPendientes(delPeriodo, (pend ?? []) as MailRegistrado[])
    setMails(todos); setCargando(false)
    // Qué hizo el sistema con cada mail: el historial del buscador de facturas y el inventario de reenvíos, por id
    const ids = todos.map(m => m.mensaje_id)
    const bs: BusquedaConMail[] = [], inv: InventarioConMail[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const tramo = ids.slice(i, i + 200)
      const [{ data: b }, { data: v }] = await Promise.all([
        supabase.from("arca_pdf_busqueda_log").select("gmail_message_id, resultado, numero_comprobante, factura_schema, drive_url").in("gmail_message_id", tramo).order("fecha_hora"),
        supabase.from("arca_pdf_inventario").select("gmail_message_id, estado, nombre_archivo").in("gmail_message_id", tramo),
      ])
      bs.push(...((b ?? []) as BusquedaConMail[])); inv.push(...((v ?? []) as InventarioConMail[]))
    }
    setBusquedas(bs); setInventario(inv)
  }, [dias])
  useEffect(() => { cargar() }, [cargar])

  const procesado = useCallback((m: MailRegistrado) => procesadoDeMail(m, busquedas, inventario), [busquedas, inventario])
  const valores: Record<Columna, (m: MailRegistrado) => string> = useMemo(() => ({
    dePara: (m: MailRegistrado) => contraparteDeMail(m),
    tipo: (m: MailRegistrado) => tipoDeMail(m) ?? "",
    hizo: (m: MailRegistrado) => { const p = procesado(m); return p ? claseDeProcesado(p.texto) : NOMBRE_GRUPO_MAIL[grupoDeMail(m)] },
  }), [procesado])

  // Todos los filtros juntos; cada barra de chips y cada lista de columna cuenta sobre lo filtrado por lo DEMÁS
  const aplicar = useCallback((excepto: "grupo" | "seguimiento" | "tipoChip" | "graves" | Columna | null) => {
    const cols = { ...columnas }
    if (excepto === "dePara" || excepto === "tipo" || excepto === "hizo") cols[excepto] = null
    let r = filtrarPorColumnas(mails, cols, valores)
    r = filtrarMails(r, { grupos: excepto === "grupo" ? new Set() : grupos, tipos: excepto === "tipoChip" ? new Set() : tiposChip, texto })
    if (excepto !== "seguimiento" && seguimientos.size) r = r.filter(m => seguimientos.has(estadoSeguimiento(m, hoy)))
    if (excepto !== "graves" && soloGraves) r = r.filter(m => gravedadDeMail(m).nivel > 0)
    return r
  }, [mails, columnas, valores, grupos, tiposChip, texto, seguimientos, soloGraves, hoy])

  const visibles = useMemo(() => ordenarPendientesArriba(aplicar(null), hoy), [aplicar, hoy])
  const conteo = useMemo(() => contarMails(aplicar("grupo")), [aplicar])
  const porTipo = useMemo(() => contarPorTipo(aplicar("tipoChip")), [aplicar])
  const porSeguimiento = useMemo(() => {
    const r: Record<EstadoSeguimiento, number> = { vencido: 0, pendiente: 0, terminado: 0, sin_marcar: 0 }
    for (const m of aplicar("seguimiento")) r[estadoSeguimiento(m, hoy)]++
    return r
  }, [aplicar, hoy])
  const cuantosGraves = useMemo(() => aplicar("graves").filter(m => gravedadDeMail(m).nivel > 0 && m.seguimiento !== "terminado").length, [aplicar])
  const opciones = useMemo(() => ({
    dePara: opcionesDeColumna(aplicar("dePara"), valores.dePara, (v, m) => m.sentido === "enviado" ? `→ ${v}` : (m.remitente_nombre ? `${m.remitente_nombre} <${v}>` : v)),
    tipo: opcionesDeColumna(aplicar("tipo"), valores.tipo, v => nombres[v] ?? v),
    hizo: opcionesDeColumna(aplicar("hizo"), valores.hizo),
  }), [aplicar, valores, nombres])

  const actualizar = (ids: string[], cambio: Partial<MailRegistrado>) => {
    const s = new Set(ids)
    setMails(prev => prev.map(x => s.has(x.id) ? { ...x, ...cambio } : x))
  }
  const elegirTipo = (m: MailRegistrado, v: string) => {
    if (v === "") {  // volver al tipo de la regla: sólo este mail
      supabase.from("mails_registro").update({ tipo_manual: null, updated_at: ahoraISO() }).eq("id", m.id).then(({ error: e }) => {
        if (e) { toast.error("No se pudo: " + e.message); return }
        actualizar([m.id], { tipo_manual: null }); toast.success("Vuelve al tipo de la regla")
      })
      return
    }
    if (v === tipoDeMail(m)) return
    setReasignar({ mail: m, tipo: v })
  }
  const filtrosActivos = (soloGraves ? 1 : 0) + grupos.size + seguimientos.size + tiposChip.size + Object.values(columnas).filter(Boolean).length + (texto ? 1 : 0)

  return (
    <div className="space-y-4">
      <TestsDelProceso proceso="egresos/mails" pantalla="egresos" />
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map(p => (
          <Button key={p.dias} size="sm" variant={dias === p.dias ? "default" : "outline"} onClick={() => setDias(p.dias)}>{p.nombre}</Button>
        ))}
        <Input placeholder="Buscar en asunto, remitente o destinatario" value={texto} onChange={e => setTexto(e.target.value)} className="h-8 max-w-xs" />
        <Button size="sm" variant="ghost" onClick={cargar} title="Volver a leer"><RefreshCw className="h-4 w-4" /></Button>
        {filtrosActivos > 0 && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
            setSoloGraves(false); setGrupos(new Set()); setSeguimientos(new Set()); setTiposChip(new Set()); setColumnas({ dePara: null, tipo: null, hizo: null }); setTexto("")
          }}>Sacar todos los filtros</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip activo={soloGraves} tono="rojo" titulo="Sólo los mails graves: mora, deuda, intimación, saldo negativo, rechazo… (los de impuestos o legales pesan doble)"
          onClick={() => setSoloGraves(v => !v)}>🚨 Graves sin terminar {cuantosGraves}</Chip>
        {SEGUIMIENTOS.map(s => (
          <Chip key={s} activo={seguimientos.has(s)} tono={s === "vencido" || s === "pendiente" ? "rojo" : undefined} titulo={tituloChip(NOMBRE_SEGUIMIENTO[s])}
            onClick={e => toggleChip(setSeguimientos, s, esSoloEste(e))}>
            {s === "vencido" ? "📌 " : s === "pendiente" ? "📌 " : s === "terminado" ? "✔ " : ""}{NOMBRE_SEGUIMIENTO[s]} {porSeguimiento[s]}
          </Chip>
        ))}
        {seguimientos.size > 0 && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSeguimientos(new Set())}>todos</Button>}
        <span className="text-xs text-muted-foreground">los pendientes se muestran aunque sean de antes del período</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {GRUPOS.map(g => (
          <Chip key={g} activo={grupos.has(g)} tono={g === "mirar" ? "rojo" : undefined} titulo={tituloChip(NOMBRE_GRUPO_MAIL[g])}
            onClick={e => toggleChip(setGrupos, g, esSoloEste(e))}>
            {NOMBRE_GRUPO_MAIL[g]} {conteo.porGrupo[g]}
          </Chip>
        ))}
        {grupos.size > 0 && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setGrupos(new Set())}>todos</Button>}
        <span className="text-xs text-muted-foreground">{PISTA_CTRL_CLICK}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tipos.filter(t => porTipo[t.id]).map(t => (
          <Chip key={t.id} activo={tiposChip.has(t.id)} titulo={tituloChip(t.nombre)} onClick={e => toggleChip(setTiposChip, t.id, esSoloEste(e))}>
            {t.nombre} {porTipo[t.id]}
          </Chip>
        ))}
        {porTipo["sin_tipo"] ? (
          <Chip activo={tiposChip.has("sin_tipo")} titulo={tituloChip("Sin tipo")} onClick={e => toggleChip(setTiposChip, "sin_tipo", esSoloEste(e))}>Sin tipo {porTipo["sin_tipo"]}</Chip>
        ) : null}
        {tiposChip.size > 0 && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setTiposChip(new Set())}>todos</Button>}
      </div>

      {/* Control: cada mail cae en un solo grupo */}
      <p className={`flex items-center gap-1 text-xs ${conteo.cierra ? "text-muted-foreground" : "font-semibold text-red-600"}`}>
        {conteo.cierra ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-4 w-4" />}
        {GRUPOS.map(g => `${NOMBRE_GRUPO_MAIL[g].toLowerCase()} ${conteo.porGrupo[g]}`).join(" + ")} = {conteo.total}
        {!conteo.cierra && " — NO CIERRA: hay mails que no caen en ningún grupo"}
      </p>

      {error && <p className="text-sm text-red-600">No se pudo leer el registro: {error}</p>}
      {!cargando && !error && mails.length === 0 && (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Todavía no hay mails registrados en este período. El registro lo carga el GAS de la casilla cada 15 minutos
          (si todavía no está instalado: A-TEST-1290).
        </p>
      )}

      {mails.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Fecha</TableHead>
                <TableHead><FiltroColumna titulo="De / Para" opciones={opciones.dePara} seleccion={columnas.dePara} onChange={s => setColumnas(c => ({ ...c, dePara: s }))} /></TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead className="w-44"><FiltroColumna titulo="Tipo" opciones={opciones.tipo} seleccion={columnas.tipo} onChange={s => setColumnas(c => ({ ...c, tipo: s }))} /></TableHead>
                <TableHead className="w-36"><FiltroColumna titulo="Qué se hizo" opciones={opciones.hizo} seleccion={columnas.hizo} onChange={s => setColumnas(c => ({ ...c, hizo: s }))} /></TableHead>
                <TableHead className="w-40">Seguimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.slice(0, 500).map(m => {
                const grupo = grupoDeMail(m)
                const p = procesado(m)
                const est = estadoSeguimiento(m, hoy)
                const grave = gravedadDeMail(m)
                return (
                  <TableRow key={m.id} className={est === "vencido" ? "bg-red-50 dark:bg-red-950/30" : est === "pendiente" ? "bg-amber-50/60 dark:bg-amber-950/20" : undefined}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">{fmtFecha(m.fecha)}</TableCell>
                    <TableCell className="max-w-[220px] text-xs">
                      {m.sentido === "enviado"
                        ? <span title={m.destinatarios ?? ""}>→ {m.destinatarios}</span>
                        : <span title={m.remitente ?? ""}>{m.remitente_nombre || m.remitente}</span>}
                    </TableCell>
                    <TableCell className="max-w-[420px]">
                      <a href={linkGmail(m.casilla, m.mensaje_id)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 text-sm hover:underline" title={m.extracto ?? "Abrir en Gmail"}>
                        {grave.nivel > 0 && <span title={`${grave.nivel === 2 ? "Doblemente grave (impuestos / legal)" : "Grave"}: «${grave.palabras.join("», «")}»`}>{grave.nivel === 2 ? "🔴" : "🟠"}</span>}
                        <span className="line-clamp-2">{m.asunto || "(sin asunto)"}</span>
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                      </a>
                      {m.adjuntos?.length ? (
                        // 📎 abre el archivo ya archivado (Drive) si lo hay; si no, el mail, donde están los adjuntos
                        <a href={p?.link ?? linkGmail(m.casilla, m.mensaje_id)} target="_blank" rel="noopener noreferrer"
                          className={`ml-1 inline-flex items-center gap-0.5 text-xs hover:underline ${p?.link ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}
                          title={(p?.link ? "Abrir el archivo archivado\n" : "Abrir el mail (todavía no está archivado)\n") + m.adjuntos.map(a => a.nombre).join("\n")}>
                          <Paperclip className="h-3 w-3" />{m.adjuntos.length}
                        </a>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <SelectTipo valor={tipoDeMail(m) ?? ""} tipos={tipos} vacio="— sin tipo —" marcaManual={m.tipo_manual}
                        className="h-7 w-full rounded border bg-background px-1 text-xs"
                        title={m.tipo_manual ? `Puesto a mano (la regla decía: ${m.tipo ? nombres[m.tipo] ?? m.tipo : "sin tipo"})` : "Según la regla"}
                        onElegir={v => elegirTipo(m, v)} onNuevo={() => setNuevoPara(m)} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {(() => {
                        if (!p) return <span className="text-muted-foreground">{NOMBRE_GRUPO_MAIL[grupo]}</span>
                        const t = <span className={p.ok ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>{p.ok ? "✔" : "•"} {p.texto}</span>
                        return p.link ? <a href={p.link} target="_blank" rel="noopener noreferrer" className="hover:underline">{t}</a> : t
                      })()}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {m.sentido === "recibido"
                        ? <CeldaSeguimiento mail={m} hoy={hoy} onGuardado={c => actualizar([m.id], c)} />
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {visibles.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Ningún mail con estos filtros.</p>}
          {visibles.length > 500 && <p className="p-2 text-xs text-muted-foreground">Se muestran los 500 primeros de {visibles.length}: filtrá para ver el resto.</p>}
        </div>
      )}

      <DialogoTipoNuevo abierto={!!nuevoPara} onCerrar={() => setNuevoPara(null)} onCrear={async nombre => {
        const id = await crear(nombre)
        if (id && nuevoPara) { const m = nuevoPara; setNuevoPara(null); setReasignar({ mail: m, tipo: id }) }
      }} />
      <DialogoAlcance mail={reasignar?.mail ?? null} tipo={reasignar?.tipo ?? ""} nombres={nombres} onCerrar={() => setReasignar(null)}
        onHecho={({ ids, tipo, manualDe }) => {
          if (manualDe) {
            const m = mails.find(x => x.id === manualDe)
            actualizar([manualDe], { tipo_manual: m && tipo === m.tipo ? null : tipo })
          } else actualizar(ids, { tipo, tipo_manual: null })
          setReasignar(null)
        }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reglas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reaplicar las reglas a lo ya registrado: primero muestra qué cambiaría, después aplica, y al final vuelve a calcular
 * (camino inverso: tiene que dar 0 cambios). Nunca toca un mail con el tipo puesto a mano.
 */
function ReaplicarReglas({ reglas, nombres }: { reglas: ReglaMail[]; nombres: Record<string, string> }) {
  type Cambio = ReturnType<typeof cambiosAlReaplicar>[number]
  const [cambios, setCambios] = useState<Cambio[] | null>(null)
  const [asuntos, setAsuntos] = useState<Record<string, string>>({})
  const [trabajando, setTrabajando] = useState(false)

  const leerTodo = async () => {
    const todos: any[] = []
    for (let i = 0; ; i += 1000) {
      const { data, error } = await supabase.from("mails_registro").select("id, sentido, remitente, destinatarios, asunto, tipo, accion, tipo_manual, regla_id").range(i, i + 999)
      if (error) throw error
      todos.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return todos
  }
  const calcular = async () => {
    setTrabajando(true)
    try {
      const todos = await leerTodo()
      setAsuntos(Object.fromEntries(todos.map(m => [m.id, m.asunto ?? "(sin asunto)"])))
      setCambios(cambiosAlReaplicar(todos, reglas))
    } catch (e) { toast.error("No se pudo leer el registro: " + (e as Error).message) } finally { setTrabajando(false) }
  }
  const aplicar = async () => {
    if (!cambios?.length) return
    setTrabajando(true)
    let fallas = 0
    for (let i = 0; i < cambios.length; i += 20) {
      const r = await Promise.all(cambios.slice(i, i + 20).map(c =>
        supabase.from("mails_registro").update({ regla_id: c.regla_id, tipo: c.tipo, accion: c.accion, updated_at: ahoraISO() }).eq("id", c.id).is("tipo_manual", null)))
      fallas += r.filter(x => x.error).length
    }
    // Lo que ahora es «avisar» y nadie marcó nace pendiente, igual que lo que entra nuevo (trigger del script 147)
    const { error: eP } = await supabase.from("mails_registro").update({ seguimiento: "pendiente", seguimiento_at: ahoraISO() })
      .eq("accion", "avisar").eq("sentido", "recibido").is("seguimiento", null)
    if (eP) fallas++
    // Control por el camino inverso: recalculado sobre la base, no tiene que quedar nada por cambiar
    const despues = cambiosAlReaplicar(await leerTodo(), reglas)
    setTrabajando(false); setCambios(despues)
    if (fallas || despues.length) toast.error(`Quedaron ${despues.length} sin aplicar${fallas ? ` (${fallas} con error)` : ""}`)
    else toast.success("Reglas reaplicadas: el registro coincide con las reglas")
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Reaplicar a lo ya registrado</span>
        <Button size="sm" variant="outline" onClick={calcular} disabled={trabajando}>Ver qué cambiaría</Button>
        {cambios && cambios.length > 0 && <Button size="sm" onClick={aplicar} disabled={trabajando}>Aplicar {cambios.length} cambio{cambios.length > 1 ? "s" : ""}</Button>}
        {cambios && cambios.length === 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />El registro coincide con las reglas</span>}
      </div>
      <p className="text-xs text-muted-foreground">No toca los mails con el tipo puesto a mano.</p>
      {cambios && cambios.length > 0 && (
        <ul className="max-h-60 space-y-0.5 overflow-y-auto text-xs">
          {cambios.slice(0, 100).map(c => (
            <li key={c.id}><span className="text-muted-foreground">{c.antes}</span> → <b>{c.tipo ? nombres[c.tipo] ?? c.tipo : "sin tipo"}/{c.accion ?? "-"}</b> · {asuntos[c.id]}</li>
          ))}
          {cambios.length > 100 && <li className="text-muted-foreground">… y {cambios.length - 100} más</li>}
        </ul>
      )}
    </div>
  )
}

function ReglasMails() {
  const { tipos, nombres, crear, renombrar } = useTiposMail()
  const [reglas, setReglas] = useState<ReglaMail[]>([])
  const [nueva, setNueva] = useState({ remitente_patron: "", asunto_patron: "", tipo: "otro", accion: "guardar" as AccionMail, orden: "50" })
  const [creandoTipo, setCreandoTipo] = useState(false)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("mails_reglas").select("id, orden, activa, remitente_patron, asunto_patron, tipo, accion, nota").order("orden").order("remitente_patron")
    if (error) toast.error("No se pudieron leer las reglas: " + error.message)
    setReglas((data ?? []) as ReglaMail[])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const alternar = async (r: ReglaMail) => {
    const { error } = await supabase.from("mails_reglas").update({ activa: !r.activa, updated_at: ahoraISO() }).eq("id", r.id)
    if (error) { toast.error(error.message); return }
    setReglas(prev => prev.map(x => x.id === r.id ? { ...x, activa: !r.activa } : x))
  }
  const cambiarTipoRegla = async (r: ReglaMail, tipo: string) => {
    const { error } = await supabase.from("mails_reglas").update({ tipo, updated_at: ahoraISO() }).eq("id", r.id)
    if (error) { toast.error(error.message); return }
    setReglas(prev => prev.map(x => x.id === r.id ? { ...x, tipo } : x))
    toast.success("Regla cambiada: vale para lo que llegue; para lo ya registrado, «Reaplicar»")
  }

  const agregar = async () => {
    const problema = problemaDeRegla(nueva, tipos.map(t => t.id))
    if (problema) { toast.error(problema); return }
    const { error } = await supabase.from("mails_reglas").insert({
      remitente_patron: nueva.remitente_patron.trim().toLowerCase(), asunto_patron: nueva.asunto_patron.trim() || null,
      tipo: nueva.tipo, accion: nueva.accion, orden: parseInt(nueva.orden, 10) || 50, nota: "agregada desde la app",
    })
    if (error) { toast.error("No se pudo guardar: " + error.message); return }
    toast.success("Regla agregada: vale para lo que llegue desde ahora (para lo ya registrado: Reaplicar)")
    setNueva({ remitente_patron: "", asunto_patron: "", tipo: "otro", accion: "guardar", orden: "50" })
    cargar()
  }
  const usoPorTipo = useMemo(() => {
    const r: Record<string, number> = {}
    for (const x of reglas) r[x.tipo] = (r[x.tipo] ?? 0) + 1
    return r
  }, [reglas])

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gana la primera regla que coincide, por orden (menor primero). Una regla con «asunto contiene» va antes que la general del mismo
        remitente. Valen para los mails que llegan desde que se guardan; para pasarlas a lo ya registrado, «Reaplicar» (abajo).
        Desde el Registro, al cambiar el tipo de un mail podés elegir que valga para todos los de ese remitente: crea la regla y la aplica sola.
      </p>
      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <Input placeholder="De quién viene: x@y.com o @y.com" value={nueva.remitente_patron} onChange={e => setNueva({ ...nueva, remitente_patron: e.target.value })} className="h-8 w-64" />
        <Input placeholder="Asunto contiene (opcional)" value={nueva.asunto_patron} onChange={e => setNueva({ ...nueva, asunto_patron: e.target.value })} className="h-8 w-48" />
        <SelectTipo valor={nueva.tipo} tipos={tipos} onElegir={v => setNueva({ ...nueva, tipo: v })} onNuevo={() => setCreandoTipo(true)}
          className="h-8 rounded border bg-background px-2 text-sm" />
        <select value={nueva.accion} onChange={e => setNueva({ ...nueva, accion: e.target.value as AccionMail })} className="h-8 rounded border bg-background px-2 text-sm">
          {(["avisar", "guardar", "archivar"] as AccionMail[]).map(a => <option key={a} value={a}>{NOMBRE_ACCION[a]}</option>)}
        </select>
        <Input title="Orden: menor se evalúa primero" value={nueva.orden} onChange={e => setNueva({ ...nueva, orden: e.target.value })} className="h-8 w-16" />
        <Button size="sm" onClick={agregar}>Agregar regla</Button>
      </div>
      <ReaplicarReglas reglas={reglas} nombres={nombres} />

      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">Tipos de mail ({tipos.length}) — renombrar</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {tipos.map(t => (
            <label key={t.id} className="flex items-center gap-2 text-xs">
              <Input defaultValue={t.nombre} className="h-7 text-xs" onBlur={e => renombrar(t.id, e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }} />
              <span className="w-20 shrink-0 text-muted-foreground">{usoPorTipo[t.id] ?? 0} regla{(usoPorTipo[t.id] ?? 0) === 1 ? "" : "s"}</span>
            </label>
          ))}
        </div>
        <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setCreandoTipo(true)}>＋ Nuevo tipo</Button>
      </details>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Activa</TableHead><TableHead className="w-16">Orden</TableHead>
              <TableHead>De quién viene</TableHead><TableHead>Asunto contiene</TableHead>
              <TableHead>Tipo</TableHead><TableHead>Qué se hace</TableHead><TableHead>Nota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reglas.map(r => (
              <TableRow key={r.id} className={r.activa ? undefined : "opacity-50"}>
                <TableCell><input type="checkbox" checked={r.activa} onChange={() => alternar(r)} aria-label="Activa" /></TableCell>
                <TableCell className="tabular-nums">{r.orden}</TableCell>
                <TableCell className="font-mono text-xs">{r.remitente_patron}</TableCell>
                <TableCell className="text-xs">{r.asunto_patron ?? ""}</TableCell>
                <TableCell className="text-xs">
                  <SelectTipo valor={r.tipo} tipos={tipos} onElegir={v => cambiarTipoRegla(r, v)} onNuevo={() => setCreandoTipo(true)}
                    className="h-7 rounded border bg-background px-1 text-xs" />
                </TableCell>
                <TableCell className={`text-xs ${r.accion === "avisar" ? "font-semibold text-red-600" : ""}`}>{NOMBRE_ACCION[r.accion]}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(r.nota ?? "").replace(/^\[script 140\]\s*/, "")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DialogoTipoNuevo abierto={creandoTipo} onCerrar={() => setCreandoTipo(false)} onCrear={async nombre => {
        const id = await crear(nombre)
        if (id) { setNueva(n => ({ ...n, tipo: id })); setCreandoTipo(false) }
      }} />
    </div>
  )
}

export function VistaMails() {
  return (
    <Card>
      <CardHeader><CardTitle>Mails de la casilla</CardTitle></CardHeader>
      <CardContent>
        <Tabs defaultValue="registro">
          <TabsList><TabsTrigger value="registro">Registro</TabsTrigger><TabsTrigger value="guardar">📦 Para guardar</TabsTrigger><TabsTrigger value="reglas">Reglas</TabsTrigger></TabsList>
          <TabsContent value="registro" className="pt-4"><RegistroMails /></TabsContent>
          <TabsContent value="guardar" className="pt-4"><LotesMails /></TabsContent>
          <TabsContent value="reglas" className="pt-4"><ReglasMails /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
