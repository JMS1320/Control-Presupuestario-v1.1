"use client"

/**
 * 🔓 PROPUESTAS DE CAMBIO SOBRE UNA FACTURA — A-FEAT-1400 (+ A-DEC-1023/1024).
 *
 * JMS 2026-10-28: «le marco a Ulises un flag rojo y le dejo habilitada esa factura para modificar. Él la modifica
 * y la confirma; eso queda pendiente de mi confirmación, así que no impacta en la base… como Enrique».
 *
 * Un botón en la columna de la 🚩 que cambia según quién mira:
 *  · admin, factura habilitable sin nada abierto → 🔓 «Habilitar a…» (persona, plazo, nota; deja también la 🚩 asignada)
 *  · la persona habilitada                     → ✏️ «Proponer cambio» (sus cambios quedan en la propuesta, NO en la factura)
 *  · admin, con propuesta                       → 📝 «Ver propuesta» (antes / propuesto → Aceptar aplica por el camino de
 *                                                 siempre; Rechazar la cierra sin tocar la factura)
 */
import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Unlock, PencilLine, FileDiff } from "lucide-react"
import { CAMPOS_PROPONIBLES, diferencias, esHabilitable, estadoVisible, normalizar } from "@/lib/propuestas/factura"
import { pedirAsignacionDeCuenta, mensajeDePropagacion } from "@/lib/conciliacion/asignar-cuenta-cliente"
import { esColumnaFiscal } from "@/lib/subdiarios/rectificacion"
import { estaProtegido } from "@/lib/subdiarios/estado-ddjj"

export interface PropuestaCambio {
  id: string; empresa: string; tabla: string; registro_id: string; persona: string; habilitada_por: string | null
  nota: string | null; vence_at: string | null; estado: string; antes: Record<string, unknown> | null
  cambios: Record<string, unknown> | null; created_at: string; propuesta_at: string | null
}

/** Las habilitaciones abiertas de las facturas de una empresa (una consulta por pantalla) y quién soy. */
export function usePropuestasFactura(empresa: string) {
  const [porFactura, setPorFactura] = useState<Record<string, PropuestaCambio>>({})
  const [yo, setYo] = useState<string | null>(null)
  const recargar = useCallback(async () => {
    const { data } = await supabase.from("propuestas_cambio").select("*")
      .eq("empresa", empresa).eq("tabla", "comprobantes_arca").in("estado", ["habilitada", "propuesta"])
    const m: Record<string, PropuestaCambio> = {}
    for (const p of (data ?? []) as PropuestaCambio[]) m[p.registro_id] = p
    setPorFactura(m)
  }, [empresa])
  useEffect(() => { recargar(); supabase.auth.getUser().then(({ data }) => setYo(data.user?.email?.toLowerCase() ?? null)) }, [recargar])
  return { porFactura, yo, recargar }
}

const fmtValor = (tipo: string, v: unknown) =>
  v === null || v === undefined || v === "" ? "—"
    : tipo === "monto" ? Number(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : tipo === "fecha" ? String(v).slice(0, 10).split("-").reverse().join("/") : String(v)

export function BotonPropuestaFactura({ factura, empresa, schema, esAdmin, propuesta, yo, onCambio }: {
  factura: Record<string, any>
  empresa: string
  schema: string
  esAdmin: boolean
  propuesta?: PropuestaCambio
  yo: string | null
  /** recargar propuestas y facturas */
  onCambio: () => void
}) {
  const [modal, setModal] = useState<null | "habilitar" | "proponer" | "revisar">(null)
  const estado = propuesta ? estadoVisible(propuesta) : null
  const esMia = !!propuesta && !!yo && propuesta.persona.toLowerCase() === yo

  let boton: React.ReactNode = null
  if (esAdmin && !propuesta && esHabilitable(factura.archivo_origen, factura.origen_factura)) {
    boton = <button type="button" title="Habilitar a alguien para que proponga cambios en esta factura" onClick={() => setModal("habilitar")}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:bg-blue-50 hover:text-blue-600"><Unlock className="h-3.5 w-3.5" /></button>
  } else if (esAdmin && propuesta) {
    const prop = estado === "propuesta"
    boton = <button type="button" onClick={() => setModal("revisar")}
      title={prop ? `Propuesta de ${propuesta.persona}: ver y aceptar` : `Habilitada a ${propuesta.persona}${estado === "vencida" ? " (venció)" : ""}`}
      className={`inline-flex h-6 w-6 items-center justify-center rounded ${prop ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300" : estado === "vencida" ? "text-gray-400" : "bg-blue-50 text-blue-600"}`}>
      {prop ? <FileDiff className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</button>
  } else if (esMia && (estado === "habilitada" || estado === "propuesta")) {
    boton = <button type="button" onClick={() => setModal("proponer")}
      title={estado === "propuesta" ? "Ya propusiste cambios: podés corregirlos hasta que JMS los acepte" : "Esta factura está habilitada para vos: proponé el cambio"}
      className="inline-flex h-6 items-center gap-1 rounded bg-blue-50 px-1 text-[10px] text-blue-700 ring-1 ring-blue-200"><PencilLine className="h-3.5 w-3.5" />{estado === "propuesta" ? "propuesto" : "proponer"}</button>
  }

  return (
    <>
      {boton}
      {modal === "habilitar" && <ModalHabilitar factura={factura} empresa={empresa} onClose={() => setModal(null)} onListo={onCambio} />}
      {modal === "proponer" && propuesta && <ModalProponer factura={factura} propuesta={propuesta} onClose={() => setModal(null)} onListo={onCambio} />}
      {modal === "revisar" && propuesta && <ModalRevisar factura={factura} propuesta={propuesta} empresa={empresa} schema={schema} onClose={() => setModal(null)} onListo={onCambio} />}
    </>
  )
}

const tituloFactura = (f: Record<string, any>) =>
  `${f.denominacion_emisor || "s/proveedor"} · ${f.punto_venta}-${f.numero_desde} · ${String(f.fecha_emision ?? "").slice(0, 10).split("-").reverse().join("/")} · $${(Number(f.imp_total) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`

function ModalHabilitar({ factura, empresa, onClose, onListo }: { factura: Record<string, any>; empresa: string; onClose: () => void; onListo: () => void }) {
  const [personas, setPersonas] = useState<{ mail: string; nombre: string }[]>([])
  const [yoMail, setYoMail] = useState<string | null>(null)
  const [persona, setPersona] = useState("")
  const [plazo, setPlazo] = useState<"1dia" | "hasta-aceptar">("1dia")
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    fetch("/api/sesion/personas").then(r => (r.ok ? r.json() : null)).then(j => { if (j?.personas) { setPersonas(j.personas); setYoMail(j.yo ?? null) } }).catch(() => {})
  }, [])
  const habilitar = async () => {
    if (!persona) { toast.error("Elegí a quién"); return }
    setGuardando(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const revisionId = crypto.randomUUID()
      const { error: eR } = await supabase.from("revisiones").insert({
        id: revisionId, schema_ref: empresa.toLowerCase(), tabla_ref: "comprobantes_arca", registro_id: String(factura.id),
        descripcion_ref: tituloFactura(factura).slice(0, 300),
        motivo: `🔓 Habilitada para que propongas el cambio${nota.trim() ? `: ${nota.trim()}` : ""}. Abrí la factura y tocá «proponer».`,
        pantalla: "Egresos", subpantalla: `Facturas ${empresa}`, creado_por: u.user?.email ?? null, asignado_a: persona,
      })
      if (eR) throw eR
      const { error } = await supabase.from("propuestas_cambio").insert({
        empresa, tabla: "comprobantes_arca", registro_id: factura.id, persona, habilitada_por: u.user?.email ?? null,
        nota: nota.trim() || null, vence_at: plazo === "1dia" ? new Date(Date.now() + 86400000).toISOString() : null, revision_id: revisionId,
      })
      if (error) throw error
      toast.success(`Habilitada. Le aparece en su Principal (🚩); lo que proponga queda pendiente de tu OK.`)
      onClose(); onListo()
    } catch (e) { toast.error("No se pudo habilitar: " + (e as Error).message) } finally { setGuardando(false) }
  }
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>🔓 Habilitar para proponer un cambio</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{tituloFactura(factura)}</p>
        <div><Label className="text-xs">A quién</Label>
          <select className="mt-1 h-9 w-full rounded border px-2 text-sm" value={persona} onChange={e => setPersona(e.target.value)}>
            <option value="">Elegí…</option>
            {personas.filter(p => p.mail !== yoMail).map(p => <option key={p.mail} value={p.mail}>{p.nombre}</option>)}
          </select></div>
        <div className="space-y-1 text-sm">
          <Label className="text-xs">Por cuánto tiempo</Label>
          <label className="flex items-center gap-2"><input type="radio" checked={plazo === "1dia"} onChange={() => setPlazo("1dia")} /> 1 día</label>
          <label className="flex items-center gap-2"><input type="radio" checked={plazo === "hasta-aceptar"} onChange={() => setPlazo("hasta-aceptar")} /> Hasta que yo acepte o rechace</label>
        </div>
        <div><Label className="text-xs">Qué hay que corregir (opcional)</Label>
          <Input className="mt-1" value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej.: el total está mal cargado" /></div>
        <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Lo que proponga <b>no toca la factura</b> hasta que lo aceptes.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={habilitar} disabled={guardando}>{guardando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Habilitar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ModalProponer({ factura, propuesta, onClose, onListo }: { factura: Record<string, any>; propuesta: PropuestaCambio; onClose: () => void; onListo: () => void }) {
  const inicial = () => {
    const v: Record<string, string> = {}
    for (const { campo, tipo } of CAMPOS_PROPONIBLES) {
      const base = propuesta.cambios && campo in propuesta.cambios ? propuesta.cambios[campo] : factura[campo]
      v[campo] = base === null || base === undefined ? "" : tipo === "monto" ? Number(base).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(base).slice(0, tipo === "fecha" ? 10 : undefined)
    }
    return v
  }
  const [valores, setValores] = useState<Record<string, string>>(inicial)
  const [guardando, setGuardando] = useState(false)
  const d = diferencias(factura, valores)
  const proponer = async () => {
    if (!d.hayCambios) { toast.error("No cambiaste nada"); return }
    setGuardando(true)
    const { error } = await supabase.from("propuestas_cambio").update({
      estado: "propuesta", antes: d.antes, cambios: d.cambios, propuesta_at: new Date().toISOString(),
    }).eq("id", propuesta.id)
    setGuardando(false)
    if (error) { toast.error("No se pudo guardar la propuesta: " + error.message); return }
    toast.success("Propuesta enviada: la factura no cambia hasta que JMS la acepte.")
    onClose(); onListo()
  }
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>✏️ Proponer cambio</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{tituloFactura(factura)}{propuesta.nota ? ` · «${propuesta.nota}»` : ""}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CAMPOS_PROPONIBLES.map(({ campo, etiqueta, tipo }) => {
            const cambiado = campo in d.cambios
            return (
              <div key={campo}>
                <Label className={`text-xs ${cambiado ? "text-blue-700 font-semibold" : ""}`}>{etiqueta}{cambiado ? " · cambiado" : ""}</Label>
                <Input className={`mt-0.5 h-8 text-sm ${tipo === "monto" ? "text-right" : ""} ${cambiado ? "border-blue-400 bg-blue-50" : ""}`}
                  type={tipo === "fecha" ? "date" : "text"} value={valores[campo]}
                  onChange={e => setValores(v => ({ ...v, [campo]: e.target.value }))} />
              </div>
            )
          })}
        </div>
        <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Queda como <b>propuesta</b>: la factura sigue igual hasta que JMS la acepte. Podés corregirla mientras tanto.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={proponer} disabled={guardando || !d.hayCambios}>{guardando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Proponer ({Object.keys(d.cambios).length})</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ModalRevisar({ factura, propuesta, empresa, schema, onClose, onListo }: { factura: Record<string, any>; propuesta: PropuestaCambio; empresa: string; schema: string; onClose: () => void; onListo: () => void }) {
  const [trabajando, setTrabajando] = useState(false)
  const [motivo, setMotivo] = useState("")
  const estado = estadoVisible(propuesta)
  // JMS 28/10: «también lo puedo editar antes de confirmar yo» → los valores propuestos se editan acá
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const { campo, tipo } of CAMPOS_PROPONIBLES) {
      const base = propuesta.cambios && campo in propuesta.cambios ? propuesta.cambios[campo] : factura[campo]
      v[campo] = base === null || base === undefined ? "" : tipo === "monto" ? Number(base).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(base).slice(0, tipo === "fecha" ? 10 : undefined)
    }
    return v
  })
  const cambios = diferencias(factura, valores).cambios
  const cerrar = async (nuevo: "aceptada" | "revertida" | "cancelada", resolucion: string) => {
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from("propuestas_cambio").update({
      estado: nuevo, resuelta_at: new Date().toISOString(), resuelta_por: u.user?.email ?? null, resolucion,
    }).eq("id", propuesta.id)
    if (error) throw error
  }
  const aceptar = async () => {
    const campos = Object.keys(cambios)
    const fiscales = campos.filter(c => esColumnaFiscal(c))
    if (fiscales.length && estaProtegido(factura.ddjj_iva) &&
      !window.confirm(`La factura es de un mes ${factura.ddjj_iva}: cambiar ${fiscales.join(", ")} deja el mes «a rectificar». ¿Aceptar igual?`)) return
    setTrabajando(true)
    try {
      // la cuenta contable por su camino único (con la propagación a los extractos)
      if ("cuenta_contable" in cambios) {
        const r = await pedirAsignacionDeCuenta({ empresa: empresa as any, ids: [factura.id], cuenta_contable: (cambios.cuenta_contable as string) || null, nro_cuenta: null })
        const m = mensajeDePropagacion(r)
        if (m.tipo) toast.info(m.texto)
      }
      const resto: Record<string, unknown> = {}
      for (const c of campos) if (c !== "cuenta_contable") resto[c] = cambios[c]
      if (Object.keys(resto).length) {
        const { error } = await supabase.schema(schema).from("comprobantes_arca").update(resto).eq("id", factura.id)
        if (error) throw error
      }
      // si JMS retocó la propuesta, queda registrado lo que se aplicó de verdad
      await supabase.from("propuestas_cambio").update({ cambios }).eq("id", propuesta.id)
      await cerrar("aceptada", "Aceptada" + (motivo.trim() ? `: ${motivo.trim()}` : ""))
      toast.success("Aceptada: los cambios ya están en la factura.")
      onClose(); onListo()
    } catch (e) { toast.error("No se pudo aceptar: " + (e as Error).message) } finally { setTrabajando(false) }
  }
  const rechazar = async (tipo: "revertida" | "cancelada") => {
    setTrabajando(true)
    try {
      await cerrar(tipo, (tipo === "cancelada" ? "Habilitación cancelada" : "Rechazada") + (motivo.trim() ? `: ${motivo.trim()}` : ""))
      toast.success(tipo === "cancelada" ? "Habilitación cancelada." : "Rechazada: la factura queda como estaba.")
      onClose(); onListo()
    } catch (e) { toast.error("No se pudo: " + (e as Error).message) } finally { setTrabajando(false) }
  }
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{estado === "propuesta" ? "📝 Propuesta de cambio" : "🔓 Factura habilitada"}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{tituloFactura(factura)}<br />
          Habilitada a <b>{propuesta.persona}</b>{propuesta.vence_at ? ` hasta ${new Date(propuesta.vence_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}` : " hasta que aceptes"}{estado === "vencida" ? " — venció" : ""}{propuesta.nota ? ` · «${propuesta.nota}»` : ""}</p>
        {estado === "propuesta" ? (
          <>
            <p className="text-[11px] text-muted-foreground">En azul lo que cambia (debajo, lo que tiene hoy la factura). Podés corregir cualquier valor antes de aceptar.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CAMPOS_PROPONIBLES.map(({ campo, etiqueta, tipo }) => {
                const cambiado = campo in cambios
                return (
                  <div key={campo}>
                    <Label className={`text-xs ${cambiado ? "font-semibold text-blue-700" : ""}`}>{etiqueta}</Label>
                    <Input className={`mt-0.5 h-8 text-sm ${tipo === "monto" ? "text-right" : ""} ${cambiado ? "border-blue-400 bg-blue-50" : ""}`}
                      type={tipo === "fecha" ? "date" : "text"} value={valores[campo]}
                      onChange={e => setValores(v => ({ ...v, [campo]: e.target.value }))} />
                    {cambiado && <div className="mt-0.5 text-[10px] text-muted-foreground line-through">{fmtValor(tipo, normalizar(tipo, factura[campo]))}</div>}
                  </div>
                )
              })}
            </div>
          </>
        ) : <p className="text-sm text-muted-foreground">Todavía no propuso cambios.</p>}
        <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Comentario (opcional)" />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {estado !== "propuesta" && <Button variant="outline" onClick={() => rechazar("cancelada")} disabled={trabajando}>Cancelar la habilitación</Button>}
          {estado === "propuesta" && <Button variant="outline" className="text-red-700" onClick={() => rechazar("revertida")} disabled={trabajando}>Rechazar</Button>}
          {estado === "propuesta" && <Button onClick={aceptar} disabled={trabajando || Object.keys(cambios).length === 0}>{trabajando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Aceptar y aplicar</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
