"use client"

/**
 * 📬 MAILS — el registro de todo lo que pasa por la casilla, con link a cada mail (A-FEAT-1425, JMS 30/10).
 *
 * Lo escribe el GAS `gas-buscar-pdf/RegistroMails.gs`; acá se consulta y se corrige:
 *   · Registro: período, chips por grupo (para mirar / sin regla / guardados / archivados / enviados) y por tipo,
 *     buscador, el CONTROL de que los grupos suman el total, y el tipo a mano (§ Default del dato real).
 *   · Reglas: de quién viene → tipo y qué se hace. Valen para lo que llega desde que se guardan.
 * 🔒 Sólo admin: tiene mails de la familia y de la sucesión (ver `vista-egresos.tsx`).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { ahoraISO } from "@/lib/fechas"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, CheckCircle2, ExternalLink, Paperclip, RefreshCw } from "lucide-react"
import { toggleChip, esSoloEste, tituloChip, PISTA_CTRL_CLICK } from "@/lib/ui/chips"
import {
  TIPOS_MAIL, NOMBRE_TIPO_MAIL, NOMBRE_GRUPO_MAIL, linkGmail, tipoDeMail, grupoDeMail, filtrarMails, contarMails,
  contarPorTipo, problemaDeRegla, type MailRegistrado, type ReglaMail, type GrupoMail, type TipoMail, type AccionMail,
} from "@/lib/mails/registro"

const COLUMNAS = "id, casilla, mensaje_id, sentido, fecha, remitente, remitente_nombre, destinatarios, asunto, extracto, adjuntos, tipo, tipo_manual, accion, estado, procesado_por, vinculos"
const GRUPOS: GrupoMail[] = ["mirar", "sin_regla", "guardado", "archivado", "enviado"]
const PERIODOS = [{ dias: 1, nombre: "Último día" }, { dias: 7, nombre: "7 días" }, { dias: 30, nombre: "30 días" }, { dias: 90, nombre: "90 días" }]
const NOMBRE_ACCION: Record<AccionMail, string> = { avisar: "Avisar", guardar: "Guardar", archivar: "Archivar" }

const fmtFecha = (iso: string) => new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
}).format(new Date(iso))

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
// Registro
// ─────────────────────────────────────────────────────────────────────────────

function RegistroMails() {
  const [dias, setDias] = useState(7)
  const [mails, setMails] = useState<MailRegistrado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [grupos, setGrupos] = useState<Set<GrupoMail>>(new Set())
  const [tipos, setTipos] = useState<Set<string>>(new Set())
  const [texto, setTexto] = useState("")

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    const desde = new Date(Date.now() - dias * 86400000).toISOString()
    const todos: MailRegistrado[] = []
    // La API corta en 1000 filas: se pide de a tramos
    for (let i = 0; ; i += 1000) {
      const { data, error: e } = await supabase.from("mails_registro").select(COLUMNAS)
        .gte("fecha", desde).order("fecha", { ascending: false }).range(i, i + 999)
      if (e) { setError(e.message); break }
      todos.push(...((data ?? []) as MailRegistrado[]))
      if (!data || data.length < 1000) break
    }
    setMails(todos); setCargando(false)
  }, [dias])
  useEffect(() => { cargar() }, [cargar])

  // Los números de cada barra de chips cuentan sobre lo filtrado por lo DEMÁS (regla de los chips)
  const sinFiltroGrupo = useMemo(() => filtrarMails(mails, { grupos: new Set(), tipos, texto }), [mails, tipos, texto])
  const sinFiltroTipo = useMemo(() => filtrarMails(mails, { grupos, tipos: new Set(), texto }), [mails, grupos, texto])
  const visibles = useMemo(() => filtrarMails(mails, { grupos, tipos, texto }), [mails, grupos, tipos, texto])
  const conteo = useMemo(() => contarMails(sinFiltroGrupo), [sinFiltroGrupo])
  const porTipo = useMemo(() => contarPorTipo(sinFiltroTipo), [sinFiltroTipo])

  const corregirTipo = async (m: MailRegistrado, nuevo: string) => {
    const valor = nuevo === "" || nuevo === m.tipo ? null : nuevo
    const { error: e } = await supabase.from("mails_registro").update({ tipo_manual: valor, updated_at: ahoraISO() }).eq("id", m.id)
    if (e) { toast.error("No se pudo guardar el tipo: " + e.message); return }
    setMails(prev => prev.map(x => x.id === m.id ? { ...x, tipo_manual: valor } : x))
    toast.success(valor ? `Tipo cambiado a «${NOMBRE_TIPO_MAIL[valor]}»` : "Vuelve al tipo de la regla")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map(p => (
          <Button key={p.dias} size="sm" variant={dias === p.dias ? "default" : "outline"} onClick={() => setDias(p.dias)}>{p.nombre}</Button>
        ))}
        <Input placeholder="Buscar en asunto, remitente o destinatario" value={texto} onChange={e => setTexto(e.target.value)} className="h-8 max-w-xs" />
        <Button size="sm" variant="ghost" onClick={cargar} title="Volver a leer"><RefreshCw className="h-4 w-4" /></Button>
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
        {TIPOS_MAIL.filter(t => porTipo[t.id]).map(t => (
          <Chip key={t.id} activo={tipos.has(t.id)} titulo={tituloChip(t.nombre)} onClick={e => toggleChip(setTipos, t.id, esSoloEste(e))}>
            {t.nombre} {porTipo[t.id]}
          </Chip>
        ))}
        {porTipo["sin_tipo"] ? (
          <Chip activo={tipos.has("sin_tipo")} titulo={tituloChip("Sin tipo")} onClick={e => toggleChip(setTipos, "sin_tipo", esSoloEste(e))}>Sin tipo {porTipo["sin_tipo"]}</Chip>
        ) : null}
        {tipos.size > 0 && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setTipos(new Set())}>todos</Button>}
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

      {visibles.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Fecha</TableHead>
                <TableHead>De / Para</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead className="w-44">Tipo</TableHead>
                <TableHead className="w-32">Qué se hizo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.slice(0, 500).map(m => {
                const grupo = grupoDeMail(m)
                return (
                  <TableRow key={m.id} className={grupo === "mirar" ? "bg-red-50 dark:bg-red-950/30" : undefined}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">{fmtFecha(m.fecha)}</TableCell>
                    <TableCell className="max-w-[220px] text-xs">
                      {m.sentido === "enviado"
                        ? <span title={m.destinatarios ?? ""}>→ {m.destinatarios}</span>
                        : <span title={m.remitente ?? ""}>{m.remitente_nombre || m.remitente}</span>}
                    </TableCell>
                    <TableCell className="max-w-[420px]">
                      <a href={linkGmail(m.casilla, m.mensaje_id)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 text-sm hover:underline" title={m.extracto ?? "Abrir en Gmail"}>
                        <span className="line-clamp-2">{m.asunto || "(sin asunto)"}</span>
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                      </a>
                      {m.adjuntos?.length ? (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={m.adjuntos.map(a => a.nombre).join("\n")}>
                          <Paperclip className="h-3 w-3" />{m.adjuntos.length}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <select value={tipoDeMail(m) ?? ""} onChange={e => corregirTipo(m, e.target.value)}
                        className="h-7 w-full rounded border bg-background px-1 text-xs"
                        title={m.tipo_manual ? `Puesto a mano (la regla decía: ${m.tipo ? NOMBRE_TIPO_MAIL[m.tipo] : "sin tipo"})` : "Según la regla"}>
                        <option value="">— sin tipo —</option>
                        {TIPOS_MAIL.map(t => <option key={t.id} value={t.id}>{t.nombre}{m.tipo_manual === t.id ? " ✎" : ""}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.procesado_por ? <span className="text-green-700 dark:text-green-400">✔ {m.procesado_por}</span>
                        : <span className="text-muted-foreground">{NOMBRE_GRUPO_MAIL[grupo]}</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {visibles.length > 500 && <p className="p-2 text-xs text-muted-foreground">Se muestran los 500 más recientes de {visibles.length}: filtrá para ver el resto.</p>}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reglas
// ─────────────────────────────────────────────────────────────────────────────

function ReglasMails() {
  const [reglas, setReglas] = useState<ReglaMail[]>([])
  const [nueva, setNueva] = useState({ remitente_patron: "", asunto_patron: "", tipo: "otro" as TipoMail, accion: "guardar" as AccionMail, orden: "50" })

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

  const agregar = async () => {
    const problema = problemaDeRegla(nueva)
    if (problema) { toast.error(problema); return }
    const { error } = await supabase.from("mails_reglas").insert({
      remitente_patron: nueva.remitente_patron.trim().toLowerCase(), asunto_patron: nueva.asunto_patron.trim() || null,
      tipo: nueva.tipo, accion: nueva.accion, orden: parseInt(nueva.orden, 10) || 50, nota: "agregada desde la app",
    })
    if (error) { toast.error("No se pudo guardar: " + error.message); return }
    toast.success("Regla agregada: vale para los mails que lleguen desde ahora")
    setNueva({ remitente_patron: "", asunto_patron: "", tipo: "otro", accion: "guardar", orden: "50" })
    cargar()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gana la primera regla que coincide, por orden (menor primero). Una regla con «asunto contiene» va antes que la general del mismo
        remitente. Valen para los mails que llegan desde que se guardan; a uno ya registrado se le cambia el tipo a mano en el Registro.
      </p>
      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <Input placeholder="De quién viene: x@y.com o @y.com" value={nueva.remitente_patron} onChange={e => setNueva({ ...nueva, remitente_patron: e.target.value })} className="h-8 w-64" />
        <Input placeholder="Asunto contiene (opcional)" value={nueva.asunto_patron} onChange={e => setNueva({ ...nueva, asunto_patron: e.target.value })} className="h-8 w-48" />
        <select value={nueva.tipo} onChange={e => setNueva({ ...nueva, tipo: e.target.value as TipoMail })} className="h-8 rounded border bg-background px-2 text-sm">
          {TIPOS_MAIL.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <select value={nueva.accion} onChange={e => setNueva({ ...nueva, accion: e.target.value as AccionMail })} className="h-8 rounded border bg-background px-2 text-sm">
          {(["avisar", "guardar", "archivar"] as AccionMail[]).map(a => <option key={a} value={a}>{NOMBRE_ACCION[a]}</option>)}
        </select>
        <Input title="Orden: menor se evalúa primero" value={nueva.orden} onChange={e => setNueva({ ...nueva, orden: e.target.value })} className="h-8 w-16" />
        <Button size="sm" onClick={agregar}>Agregar regla</Button>
      </div>
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
                <TableCell className="text-xs">{NOMBRE_TIPO_MAIL[r.tipo] ?? r.tipo}</TableCell>
                <TableCell className={`text-xs ${r.accion === "avisar" ? "font-semibold text-red-600" : ""}`}>{NOMBRE_ACCION[r.accion]}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(r.nota ?? "").replace(/^\[script 140\]\s*/, "")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function VistaMails() {
  return (
    <Card>
      <CardHeader><CardTitle>Mails de la casilla</CardTitle></CardHeader>
      <CardContent>
        <Tabs defaultValue="registro">
          <TabsList><TabsTrigger value="registro">Registro</TabsTrigger><TabsTrigger value="reglas">Reglas</TabsTrigger></TabsList>
          <TabsContent value="registro" className="pt-4"><RegistroMails /></TabsContent>
          <TabsContent value="reglas" className="pt-4"><ReglasMails /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
