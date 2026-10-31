"use client"

/**
 * 🙅 «No se consigue — pedir que la saquen» y el tablero de faltantes — A-FEAT-1451.
 *
 * JMS 31/10: «Ulises también siempre un control sobre las facturas históricas que faltan vincular. Sólo desaparecen
 * faltando si yo confirmo, pero él antes debe dejar pidiendo sacarla con motivos: pedí a tal, pedido a tal y a tal, y
 * nadie la tiene. Sumar eso como cosa principal de él».
 *
 * · En cada factura sin PDF: el botón abre «¿a quién se la pediste y qué te dijeron?» (obligatorio) y crea la tarea
 *   (🚩, tipo 'sin_pdf') ya en «por confirmar» para quien recibe «confirmar_sin_pdf» (hoy JMS). Al confirmar, la
 *   factura queda fc = 'No se consigue' y sale de faltantes (/api/revisiones); si la devuelve, vuelve a quien la pidió.
 * · El tablero va en el Principal de quien recibe «facturas_sin_vincular» (Ulises) o «confirmar_sin_pdf» (JMS).
 */
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { etiquetaPersona } from "@/lib/auth/identidad"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const pesos = (n: number | null | undefined) => (Number(n) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function BotonNoSeConsigue({ schema, factura, pendiente, onPedido }: {
  schema: "msa" | "pam" | "ma"
  factura: { id: string; denominacion_emisor?: string | null; punto_venta?: number | null; numero_desde?: number | null; imp_total?: number | null; fecha_emision?: string | null }
  /** La tarea abierta que ya pide sacarla, si hay. */
  pendiente?: { estado: string; confirma?: string | null } | null
  onPedido?: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState("")
  const [guardando, setGuardando] = useState(false)
  if (pendiente) {
    return <span className="text-[11px] text-amber-700" title="Ya se pidió sacarla: espera la confirmación">⏳ esperando que la confirmen</span>
  }
  const rotulo = `${factura.denominacion_emisor ?? ""} ${factura.punto_venta ?? ""}-${factura.numero_desde ?? ""} · $ ${pesos(factura.imp_total)}`.trim()

  const pedir = async () => {
    const t = texto.trim()
    if (t.length < 10) { toast.error("Escribí a quién se la pediste y qué te dijeron (es lo que JMS mira para confirmar)."); return }
    setGuardando(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const yo = u.user?.email ?? null
      const { data: av } = await supabase.from("avisos_destinatarios").select("destinatarios").eq("tipo", "confirmar_sin_pdf").maybeSingle()
      const confirma = (av?.destinatarios as string[] | undefined)?.[0] ?? null
      if (!confirma) { toast.error("No hay nadie configurado para confirmar (Egresos → Mails → Reglas → «Quién confirma que una factura no se consigue»)."); return }
      const quien = etiquetaPersona(u.user) ?? yo
      const ahora = new Date().toISOString()
      const { error } = await supabase.from("revisiones").insert({
        id: crypto.randomUUID(), tipo: "sin_pdf", origen: "control",
        schema_ref: schema, tabla_ref: "comprobantes_arca", registro_id: factura.id,
        descripcion_ref: `Factura sin PDF: ${rotulo}`.slice(0, 300),
        motivo: `Sacar de faltantes — no se consigue: ${rotulo}`.slice(0, 500),
        pantalla: "Egresos", subpantalla: "Facturas sin comprobante",
        creado_por: quien, asignado_a: yo, es_tarea: true, confirma,
        estado: confirma === yo ? "resuelta" : "por_confirmar", resolucion: t,
        seguimiento: [{ fecha: ahora, texto: `Pedidos hechos: ${t}`, autor: quien }],
      })
      if (error) throw error
      toast.success("Pedido: le llega a quien confirma; hasta que confirme, sigue en faltantes.")
      setAbierto(false); setTexto(""); onPedido?.()
    } catch (e) {
      toast.error("No se pudo pedir: " + (e as Error).message)
    } finally { setGuardando(false) }
  }

  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-600" title="Ya la pediste y nadie la tiene: pedí que la saquen de faltantes" onClick={() => setAbierto(true)}>🙅 No se consigue</Button>
      <Dialog open={abierto} onOpenChange={a => { if (!a) setAbierto(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>🙅 Pedir que la saquen de faltantes</DialogTitle></DialogHeader>
          <p className="text-sm">{rotulo}{factura.fecha_emision ? ` · ${factura.fecha_emision.slice(8, 10)}/${factura.fecha_emision.slice(5, 7)}/${factura.fecha_emision.slice(0, 4)}` : ""}</p>
          <p className="text-xs text-muted-foreground">Sale de faltantes <b>sólo cuando JMS lo confirma</b>. Escribí a quién se la pediste, cuándo, y qué te dijeron.</p>
          <Textarea autoFocus rows={4} value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Ej.: la pedí al proveedor por mail el 15/10 y por WhatsApp el 22/10; a Andrés el 23/10; nadie la tiene" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button disabled={guardando} onClick={() => void pedir()}>Pedir que la saquen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * 🧾 El tablero de faltantes en el Principal: cuántas facturas siguen sin PDF (por empresa) y cuántas esperan la
 * confirmación. Lo ve quien recibe «facturas_sin_vincular» o «confirmar_sin_pdf».
 */
export function TableroFaltantes() {
  const [datos, setDatos] = useState<{ porEmpresa: Record<string, number>; esperan: number; soyConfirmador: boolean } | null>(null)
  useEffect(() => {
    void (async () => {
      const { data: u } = await supabase.auth.getUser()
      const yo = (u.user?.email ?? "").toLowerCase()
      if (!yo) return
      const { data: av } = await supabase.from("avisos_destinatarios").select("tipo, destinatarios").in("tipo", ["facturas_sin_vincular", "confirmar_sin_pdf"])
      const es = (tipo: string) => (av ?? []).some(a => a.tipo === tipo && (a.destinatarios as string[]).some(d => d.toLowerCase() === yo))
      if (!es("facturas_sin_vincular") && !es("confirmar_sin_pdf")) return
      const porEmpresa: Record<string, number> = {}
      for (const s of ["msa", "pam", "ma"] as const) {
        const { count } = await supabase.schema(s).from("comprobantes_arca").select("id", { count: "exact", head: true })
          .is("pdf_drive_url", null).neq("estado", "historico").not("fc", "in", '("Portal","No","OK","No se consigue")')
        porEmpresa[s.toUpperCase()] = count ?? 0
      }
      const j = await (await fetch("/api/revisiones")).json().catch(() => ({ revisiones: [] }))
      const esperan = ((j.revisiones ?? []) as { tipo?: string; estado: string }[]).filter(r => r.tipo === "sin_pdf" && r.estado === "por_confirmar").length
      setDatos({ porEmpresa, esperan, soyConfirmador: es("confirmar_sin_pdf") })
    })()
  }, [])
  if (!datos) return null
  const total = Object.values(datos.porEmpresa).reduce((a, b) => a + b, 0)
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-amber-200 bg-white px-4 py-3 text-sm">
      <span className="font-semibold">🧾 Facturas sin comprobante: {total} faltan</span>
      <span className="text-muted-foreground">{Object.entries(datos.porEmpresa).filter(([, n]) => n).map(([e, n]) => `${e} ${n}`).join(" · ")}</span>
      {datos.esperan > 0 && <span className="font-medium text-amber-700">· {datos.esperan} esperando {datos.soyConfirmador ? "que las confirmes (abajo, en «Para vos»)" : "que JMS confirme"}</span>}
      <a href="/?seccion=egresos&tab=facturas-msa" className="ml-auto text-blue-700 hover:underline" title="En Egresos → Facturas, el botón «Facturas sin comprobante» abre la lista entera">Ir a las facturas →</a>
    </div>
  )
}
