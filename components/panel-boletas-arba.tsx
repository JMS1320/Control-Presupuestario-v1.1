"use client"

/**
 * 🏛️ BOLETAS DE ARBA — comparar contra el template y decidir cuál aplicar. A-FEAT-95 / A-FEAT-104.
 *
 * ## La regla que manda todo
 * 🔴 **La boleta NUNCA pisa al template sola.** Textual del usuario: *«no reemplazar los templates,
 * ya que yo debo ver y decidir: cambiar éste sí, éste no, todos»*. Acá se muestran los dos números
 * uno al lado del otro y **aplicar es un acto explícito**, fila por fila o con «aplicar todas».
 *
 * ## Para qué sirve de verdad
 * Las cuotas 1 y 2 del año ya están conciliadas con su boleta. **Las 3 y 4 están proyectadas
 * repitiendo el monto de la 2**, así que cuando llega la boleta real el presupuesto puede pasar de
 * una estimación a un número. Eso es lo que esta pantalla vuelca — con tu visto bueno.
 *
 * Los PDFs se pueden subir a mano acá; el GAS (`accion: boletas_arba`) hace lo mismo desde el mail.
 */

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { parsearBoletaArba, type BoletaArba } from "@/lib/arba/parsear-boleta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Comparacion {
  archivo: string
  boleta: BoletaArba
  /** El template activo de esa partida, y la cuota que corresponde. */
  lote: string | null
  egresoId: string | null
  cuotaId: string | null
  montoTemplate: number | null
  estadoCuota: string | null
  aplicar: boolean
  aplicada: boolean
  problema: string | null
}

const m = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PanelBoletasArba() {
  const [abierto, setAbierto] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [filas, setFilas] = useState<Comparacion[]>([])

  const subir = async (archivos: FileList) => {
    setLeyendo(true)
    const nuevas: Comparacion[] = []
    try {
      for (const f of Array.from(archivos)) {
        const boleta = await parsearBoletaArba(await f.arrayBuffer())
        const fila: Comparacion = {
          archivo: f.name, boleta, lote: null, egresoId: null, cuotaId: null,
          montoTemplate: null, estadoCuota: null, aplicar: false, aplicada: false, problema: null,
        }

        if (!boleta.partida) {
          fila.problema = "sin partida — no se puede casar con ningún template"
        } else {
          // El template ACTIVO de esa partida. Los «Anual» están desactivados y no proyectan:
          // buscar sin filtrar por `activo` haría comparar contra algo apagado (A-BUG-110).
          const { data: egs } = await supabase.from("egresos_sin_factura")
            .select("id, nombre_referencia, activo")
            .eq("partida_arba", boleta.partida).eq("activo", true)
          const eg = (egs ?? [])[0] as { id: string; nombre_referencia: string } | undefined
          if (!eg) {
            fila.problema = "la partida no tiene ningún template ACTIVO"
          } else {
            fila.lote = eg.nombre_referencia
            fila.egresoId = eg.id
            const nro = boleta.cuota && /^\d$/.test(boleta.cuota) ? parseInt(boleta.cuota) : null
            if (nro == null) {
              fila.problema = "boleta anual: no corresponde a una cuota puntual"
            } else {
              const { data: cs } = await supabase.from("cuotas_egresos_sin_factura")
                .select("id, monto, estado, numero_cuota")
                .eq("egreso_id", eg.id).eq("numero_cuota", nro)
              const c = (cs ?? [])[0] as { id: string; monto: number; estado: string } | undefined
              if (!c) fila.problema = `el template no tiene cuota ${nro}`
              else {
                fila.cuotaId = c.id
                fila.montoTemplate = Number(c.monto)
                fila.estadoCuota = c.estado
                // Propuesta: se tilda sola si el monto DIFIERE y la cuota todavía no se pagó.
                // Una cuota conciliada ya se pagó por ese importe: cambiarla reescribiría el pasado.
                const diff = Math.abs(Number(c.monto) - (boleta.importe ?? 0)) > 1
                fila.aplicar = diff && c.estado !== "conciliado" && boleta.importe != null
                if (c.estado === "conciliado" && diff) {
                  fila.problema = "ya conciliada con otro importe — revisá antes de tocarla"
                }
              }
            }
          }
        }
        nuevas.push(fila)
      }
      setFilas(f => [...f, ...nuevas])
      toast.success(`${nuevas.length} boleta(s) leída(s)`)
    } catch (e) {
      toast.error("Error leyendo: " + (e as Error).message)
    } finally { setLeyendo(false) }
  }

  const aplicar = async () => {
    const sel = filas.filter(f => f.aplicar && f.cuotaId && f.boleta.importe != null && !f.aplicada)
    if (!sel.length) { toast.error("No hay ninguna tildada"); return }
    const conciliadas = sel.filter(f => f.estadoCuota === "conciliado").length
    if (!window.confirm(
      `¿Aplicar ${sel.length} boleta(s) al presupuesto?\n\n` +
      sel.map(f => `${f.lote} c${f.boleta.cuota}: ${m(f.montoTemplate)} → ${m(f.boleta.importe)}`).join("\n") +
      (conciliadas ? `\n\n⚠️ ${conciliadas} ya está(n) CONCILIADA(S): cambiarlas reescribe un pago que ya ocurrió.` : "")
    )) return

    setAplicando(true)
    try {
      for (const f of sel) {
        // Se escribe SOLO el monto de la cuota. Nada más del template se toca.
        const { error } = await supabase.from("cuotas_egresos_sin_factura")
          .update({ monto: f.boleta.importe }).eq("id", f.cuotaId!)
        if (error) throw error

        // Y queda registrado de dónde salió: la boleta guarda su propio dato, aparte.
        await supabase.from("boletas_arba").upsert({
          partida: f.boleta.partida, anio: f.boleta.anio ?? new Date().getFullYear(),
          cuota: f.boleta.cuota ?? "?", impuesto: f.boleta.impuesto,
          importe: f.boleta.importe, importe_anual: f.boleta.importeAnual,
          vencimiento: f.boleta.vencimiento, valuacion_fiscal: f.boleta.valuacionFiscal,
          base_imponible: f.boleta.baseImponible,
          codigo_pago_electronico: f.boleta.codigoPagoElectronico,
          archivo_nombre: f.archivo, egreso_id: f.egresoId, cuota_id: f.cuotaId,
          aplicada: true, aplicada_at: new Date().toISOString(), origen: "pdf",
        }, { onConflict: "partida,anio,cuota,impuesto" })
      }
      setFilas(fs => fs.map(x => sel.includes(x) ? { ...x, aplicada: true, aplicar: false, montoTemplate: x.boleta.importe } : x))
      toast.success(`${sel.length} cuota(s) actualizada(s) con el importe de la boleta`)
    } catch (e) {
      toast.error("No se pudo aplicar: " + (e as Error).message)
    } finally { setAplicando(false) }
  }

  const pendientes = filas.filter(f => f.aplicar).length
  const difDe = (f: Comparacion) =>
    f.montoTemplate != null && f.boleta.importe != null ? f.boleta.importe - f.montoTemplate : null

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAbierto(true)}
        className="border-amber-400 text-amber-800">🏛️ Boletas ARBA</Button>

      <Dialog open={abierto} onOpenChange={o => { if (!o) setAbierto(false) }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>🏛️ Boletas de ARBA — comparar y decidir</DialogTitle>
          </DialogHeader>

          <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-4 text-blue-900">
            Subí los PDFs de las boletas. Se comparan contra <b>el template activo</b> de esa partida y
            vos decidís cuál aplicar. <b>Nada se cambia hasta que lo confirmes.</b>
          </div>

          <div className="flex items-center gap-2">
            <Input type="file" accept="application/pdf" multiple disabled={leyendo}
              onChange={e => { if (e.target.files?.length) subir(e.target.files) }} />
            {leyendo && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
            {filas.length > 0 && <Button variant="ghost" size="sm" onClick={() => setFilas([])}>Limpiar</Button>}
          </div>

          {filas.length > 0 && (
            <>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50 text-[10px] text-gray-600">
                    <tr>
                      <th className="w-8 px-2 py-1"></th>
                      <th className="px-2 py-1 text-left">Lote / partida</th>
                      <th className="px-2 py-1 text-left">Cuota</th>
                      <th className="px-2 py-1 text-right">Template</th>
                      <th className="px-2 py-1 text-right">Boleta</th>
                      <th className="px-2 py-1 text-right">Diferencia</th>
                      <th className="px-2 py-1 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => {
                      const d = difDe(f)
                      return (
                        <tr key={i} className={`border-t ${f.aplicada ? "bg-emerald-50" : f.problema ? "bg-amber-50" : ""}`}>
                          <td className="px-2 py-1 text-center">
                            <input type="checkbox" disabled={!f.cuotaId || f.aplicada || f.boleta.importe == null}
                              checked={f.aplicar}
                              onChange={e => setFilas(fs => fs.map((x, j) => j === i ? { ...x, aplicar: e.target.checked } : x))} />
                          </td>
                          <td className="px-2 py-1">
                            <div className="font-medium">{f.lote ?? f.archivo}</div>
                            <div className="text-[10px] text-gray-500">{f.boleta.partida ?? "sin partida"}</div>
                          </td>
                          <td className="px-2 py-1">
                            {f.boleta.cuota ?? "?"}
                            {f.boleta.vencimiento && <div className="text-[10px] text-gray-500">vence {f.boleta.vencimiento.split("-").reverse().join("/")}</div>}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">{m(f.montoTemplate)}</td>
                          <td className="px-2 py-1 text-right font-medium tabular-nums">{m(f.boleta.importe)}</td>
                          <td className={`px-2 py-1 text-right tabular-nums ${d == null || Math.abs(d) <= 1 ? "text-gray-400" : d > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                            {d == null ? "—" : Math.abs(d) <= 1 ? "coincide" : (d > 0 ? "+" : "−") + m(Math.abs(d)).slice(1)}
                          </td>
                          <td className="px-2 py-1 text-[10px]">
                            {f.aplicada ? <span className="font-medium text-emerald-700">✓ aplicada</span>
                              : f.problema ? <span className="text-amber-800">⚠ {f.problema}</span>
                              : <span className="text-gray-500">{f.estadoCuota}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filas.some(f => f.boleta.avisos.length) && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
                  {filas.filter(f => f.boleta.avisos.length).map((f, i) => (
                    <div key={i}><b>{f.archivo}:</b> {f.boleta.avisos.join(" · ")}</div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <button type="button" className="text-[11px] text-blue-700 underline"
                  onClick={() => setFilas(fs => fs.map(x =>
                    x.cuotaId && !x.aplicada && x.boleta.importe != null ? { ...x, aplicar: true } : x))}>
                  Tildar todas las que se pueden
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">{pendientes} tildada(s)</span>
                  <Button onClick={aplicar} disabled={aplicando || pendientes === 0}>
                    {aplicando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    Aplicar al presupuesto
                  </Button>
                </div>
              </div>

              <p className="text-[10px] leading-4 text-muted-foreground">
                Se tildan solas las que <b>difieren</b> y todavía <b>no están conciliadas</b>. Una cuota
                conciliada ya se pagó por ese importe: cambiarla reescribe el pasado, así que ésas quedan
                sin tildar y con un aviso — se pueden tildar a mano si de verdad hace falta.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
