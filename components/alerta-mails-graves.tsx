"use client"

/**
 * 🚨 Aviso en Principal: MAILS GRAVES sin terminar — A-FEAT-1438.
 *
 * JMS 31/10: *«detecte palabras clave: Mora, Deuda, Intimación, y si está relacionado con impuestos es doblemente
 * grave… todo esto debería ir al reporte como cosas de gravedad a atender, más allá de las boletas… y generar una
 * alerta de las importantes en mi principal»*. Motivo: el aviso de mora del Complementario PAM cuota 3 (21/10)
 * estaba sin leer diez días después.
 *
 * La regla (qué palabra, qué pesa doble, qué se excluye) vive en `lib/mails/registro.ts` → `gravedadDeMail`.
 * Agrupa por remitente + asunto y cada grupo se cierra con un clic (pasa a «terminado» en el seguimiento).
 * 🔒 Los mails son sólo admin: si esta sesión no puede leer el maestro de tipos, el aviso no se dibuja (no dice
 * «nada grave» a quien no puede ver).
 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { ahoraISO } from "@/lib/fechas"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Siren } from "lucide-react"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { agruparGraves, gravedadDeMail, linkGmail, tipoDeMail, type GrupoGrave, type MailRegistrado } from "@/lib/mails/registro"
import { PasarTarea } from "@/components/boton-revision"
import { senalesDeMail } from "@/lib/revisiones/nivel"

const COLS = "id, casilla, mensaje_id, sentido, fecha, remitente, remitente_nombre, destinatarios, asunto, extracto, adjuntos, tipo, tipo_manual, accion, estado, procesado_por, vinculos, seguimiento, seguimiento_nota, seguimiento_fecha, seguimiento_at"
const MOSTRAR = 6
const dia = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit" }).format(new Date(iso))

export function AlertaMailsGraves() {
  const [grupos, setGrupos] = useState<GrupoGrave[] | null>(null)
  const [puede, setPuede] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(true)
  const [todos, setTodos] = useState(false)

  const cargar = useCallback(async () => {
    setError(null)
    // ¿Esta sesión ve los mails? (sólo admin). El maestro de tipos nunca está vacío.
    const { data: t } = await supabase.from("mails_tipos").select("id").limit(1)
    if (!t?.length) { setPuede(false); return }
    setPuede(true)
    const filas: MailRegistrado[] = []
    for (let i = 0; ; i += 1000) {
      const { data, error: e } = await supabase.from("mails_registro").select(COLS)
        .eq("sentido", "recibido").or("seguimiento.is.null,seguimiento.eq.pendiente")
        .order("fecha", { ascending: false }).range(i, i + 999)
      if (e) { setError(e.message); return }
      filas.push(...((data ?? []) as MailRegistrado[]))
      if (!data || data.length < 1000) break
    }
    setGrupos(agruparGraves(filas))
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const terminar = async (g: GrupoGrave) => {
    const { error: e } = await supabase.from("mails_registro")
      .update({ seguimiento: "terminado", seguimiento_at: ahoraISO(), updated_at: ahoraISO() }).in("id", g.ids)
    if (e) { toast.error("No se pudo marcar: " + e.message); return }
    setGrupos(prev => (prev ?? []).filter(x => x.clave !== g.clave))
    toast.success(`Terminado: ${g.asunto}${g.ids.length > 1 ? ` (${g.ids.length} mails)` : ""}`)
  }

  if (puede === false) return null
  if (error) return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">No se pudieron revisar los mails graves: {error}</div>
  if (!grupos) return null
  if (!grupos.length) {
    return <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /> Mails: nada grave sin terminar.</p>
  }

  const dobles = grupos.filter(g => g.nivel === 2).length
  const visibles = todos ? grupos : grupos.slice(0, MOSTRAR)
  return (
    <Card className={dobles ? "border-2 border-red-500 bg-red-50" : "border-2 border-amber-400 bg-amber-50"}>
      <CardContent className="space-y-3 pt-4">
        <button className="flex w-full items-start gap-3 text-left" onClick={() => setAbierto(!abierto)}>
          <Siren className={`mt-0.5 h-6 w-6 shrink-0 ${dobles ? "text-red-600" : "text-amber-600"}`} />
          <div className="flex-1">
            <p className={`text-lg font-bold ${dobles ? "text-red-800" : "text-amber-800"}`}>
              🚨 {grupos.length} {grupos.length === 1 ? "aviso grave" : "avisos graves"} en el mail sin terminar
              {dobles > 0 && <span className="ml-2 text-base">· {dobles} de impuestos o legales</span>}
            </p>
            <p className="text-sm text-gray-600">
              Mails que dicen mora, deuda, intimación, saldo negativo, rechazo… Los de impuestos o legales van primero. Cuando lo
              resolviste, «Terminado» lo saca de acá (queda en <b>Egresos → Mails</b> con su seguimiento).
            </p>
          </div>
          {abierto ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
        </button>
        {abierto && (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded border bg-white">
              <table className="w-full text-sm">
                <tbody>
                  {visibles.map(g => (
                    <tr key={g.clave} className="border-b last:border-0">
                      <td className="w-6 px-2 py-1.5">{g.nivel === 2 ? "🔴" : "🟠"}</td>
                      <td className="px-2 py-1.5">
                        <a href={linkGmail(g.ultimo.casilla, g.ultimo.mensaje_id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                          {g.asunto}<ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                        {g.ids.length > 1 && <span className="ml-1 text-xs font-semibold text-gray-600">×{g.ids.length}</span>}
                        <div className="text-xs text-gray-500">{g.remitente} · último {dia(g.ultimo.fecha)} · «{g.palabras.join("», «")}»
                          {g.ultimo.seguimiento_nota ? <> · <i>{g.ultimo.seguimiento_nota}</i></> : null}</div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <PasarTarea ancla={{ schema: "public", tabla: "mails_registro", registroId: g.ultimo.id, descripcion: `Mail: ${g.asunto} — ${g.remitente}${g.ids.length > 1 ? ` (×${g.ids.length})` : ""}`.slice(0, 280) }}
                            inicial={{ motivo: g.asunto, origen: "mail", senales: senalesDeMail(gravedadDeMail(g.ultimo), tipoDeMail(g.ultimo)) }} />
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => terminar(g)}>✔ Terminado{g.ids.length > 1 ? ` (${g.ids.length})` : ""}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {grupos.length > MOSTRAR && <button className="text-blue-700 hover:underline" onClick={() => setTodos(!todos)}>{todos ? "Ver menos" : `Ver los ${grupos.length}`}</button>}
              <a href="/?seccion=egresos&tab=mails" className="text-blue-700 hover:underline">Abrir Egresos → Mails</a>
            </div>
            <TestsDelProceso proceso="principal/mails-graves" pantalla="principal" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
