"use client"

/**
 * 🌾 **Nuevo lote agrícola — UN solo modal** para Lotes Agrícolas y para la orden agrícola.
 *
 * JMS 2026-10-28, al querer crear ER1 desde la orden: *«nuevo lote ahí debería darte el mismo panel
 * que nuevo lote desde lotes agrícolas, así no partimos los modales de input; debería ser el mismo
 * modal»* (§ ♻️ Centralizar, no duplicar). Incluye «Dentro de (lote madre)» — A-FEAT-1397.
 */
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { arbolLotes } from "@/lib/productivo/filtro-ordenes-agricolas"
import { parseNumeroAR } from "@/lib/format/numero"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface LoteAgricolaBasico {
  id: string
  nombre_lote: string
  campo: string | null
  hectareas: number
  lote_padre_id?: string | null
  /** A-FEAT-1408 (script 122): creado por alguien que no es admin, pendiente del OK */
  a_confirmar?: boolean | null
}

const VACIO = { nombre_lote: "", campo: "", hectareas: "", observaciones: "", lote_padre_id: "" }

export function ModalNuevoLoteAgricola({ open, onOpenChange, lotes, onCreado, padreSugerido, aConfirmar, yo }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** los lotes existentes, para elegir el madre */
  lotes: LoteAgricolaBasico[]
  /** se llama con el lote recién creado (ya guardado) */
  onCreado: (lote: LoteAgricolaBasico) => void
  /** madre preelegido (ej. el lote que estaba elegido en la fila de la orden) */
  padreSugerido?: string | null
  /** A-DEC-1024: si quien crea no es admin, el lote nace «a confirmar» */
  aConfirmar?: boolean
  /** quién lo crea (queda escrito en el lote) */
  yo?: string | null
}) {
  const [nuevo, setNuevo] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const arbol = arbolLotes(lotes)

  useEffect(() => {
    if (!open) return
    const madre = padreSugerido ? lotes.find(l => l.id === padreSugerido) : undefined
    setNuevo({ ...VACIO, lote_padre_id: madre?.id || "", campo: madre?.campo || "" })
  }, [open, padreSugerido]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    const ha = parseNumeroAR(nuevo.hectareas)
    if (!nuevo.nombre_lote.trim() || !(ha > 0)) {
      toast.error("Nombre y hectáreas son obligatorios")
      return
    }
    const datos: Record<string, unknown> = { nombre_lote: nuevo.nombre_lote.trim(), hectareas: ha }
    if (nuevo.campo) datos.campo = nuevo.campo
    if (nuevo.observaciones) datos.observaciones = nuevo.observaciones
    if (nuevo.lote_padre_id) datos.lote_padre_id = nuevo.lote_padre_id
    datos.a_confirmar = !!aConfirmar
    if (yo) datos.creado_por = yo
    setGuardando(true)
    const { data, error } = await supabase.schema("productivo").from("lotes_agricolas")
      .insert(datos).select("id, nombre_lote, campo, hectareas, lote_padre_id, a_confirmar").single()
    setGuardando(false)
    if (error || !data) {
      console.error("Error guardando lote:", error)
      toast.error(`Error al guardar lote${error ? `: ${error.message}` : ""}`)
      return
    }
    toast.success(aConfirmar ? `Lote «${data.nombre_lote}» creado: queda a confirmar por JMS (ya lo podés usar en la orden)` : `Lote «${data.nombre_lote}» registrado`)
    onCreado(data as LoteAgricolaBasico)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Lote Agrícola</DialogTitle>
          <DialogDescription>El lote es una entidad física permanente. Los cultivos y campañas se registran en cada orden de aplicación.</DialogDescription>
          {aConfirmar && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">🔒 Queda <b>a confirmar</b>: lo podés usar en tu orden, y JMS lo confirma o lo rechaza.</p>}
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Nombre Lote *</Label>
            <Input value={nuevo.nombre_lote} placeholder="Ej: Lote 1, Potrero Norte..."
              onChange={e => setNuevo(p => ({ ...p, nombre_lote: e.target.value }))} />
          </div>
          <div>
            <Label>Dentro de (lote madre)</Label>
            <Select value={nuevo.lote_padre_id || "__ninguno__"}
              onValueChange={v => {
                const madre = lotes.find(l => l.id === v)
                setNuevo(p => ({ ...p, lote_padre_id: v === "__ninguno__" ? "" : v, campo: madre?.campo && !p.campo ? madre.campo : p.campo }))
              }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent position="popper" className="z-[9999]">
                <SelectItem value="__ninguno__">Ninguno — lote suelto</SelectItem>
                {arbol.map(({ lote: l, nivel }) => (
                  <SelectItem key={l.id} value={l.id}>{nivel > 0 ? `${"  ".repeat(nivel)}↳ ` : ""}{l.nombre_lote} ({l.hectareas} ha)</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Para un sub-lote que se midió aparte (ej. ER1 dentro de «Entre Rios 1, 2, 3»). El lote madre muestra cuánto lleva medido.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Campo</Label>
              <Input value={nuevo.campo} placeholder="Ej: La Esperanza"
                onChange={e => setNuevo(p => ({ ...p, campo: e.target.value }))} />
            </div>
            <div>
              <Label>Hectáreas *</Label>
              <Input type="text" inputMode="decimal" value={nuevo.hectareas} placeholder="0,00"
                onChange={e => setNuevo(p => ({ ...p, hectareas: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Observaciones</Label>
            <Input value={nuevo.observaciones} placeholder="Descripción, ubicación, etc."
              onChange={e => setNuevo(p => ({ ...p, observaciones: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar Lote"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
