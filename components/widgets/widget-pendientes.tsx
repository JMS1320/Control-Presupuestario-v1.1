"use client"

import { useState } from "react"
import { ClipboardList } from "lucide-react"
import { usePendientesPorPantalla } from "@/hooks/usePendientesPorPantalla"
import { SOLAPAS } from "@/components/layout-app"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ModalPendientes } from "@/components/modal-pendientes"

/**
 * PENDIENTES POR PANTALLA (A-FEAT-88).
 *
 * Usa **el mismo hook que los badges del menú** (`usePendientesPorPantalla`) y no una consulta
 * propia. Es la § «centralizar, no duplicar» aplicada donde más duele: dos lecturas paralelas del
 * mismo dato terminan mostrando números distintos en dos lugares de la misma pantalla, y el
 * usuario —con razón— deja de creerle a los dos.
 *
 * El camino al detalle es el modal: el número dice *cuántos*, el modal dice *cuáles* (§ 🧮).
 */
export function WidgetPendientes() {
  const conteo = usePendientesPorPantalla(true)
  const [abierto, setAbierto] = useState(false)

  const filas = SOLAPAS.map((s) => ({
    id: s.id,
    label: s.label,
    ...(conteo[s.id] ?? { total: 0, urgentes: 0 }),
  })).filter((f) => f.total > 0)

  const total = filas.reduce((a, f) => a + f.total, 0)

  // Las tres con más trabajo. La lista completa está en el modal: una tarjeta de inicio que
  // enumera 12 secciones deja de ser un vistazo y pasa a ser una tabla.
  const top = [...filas].sort((a, b) => b.total - a.total).slice(0, 3)
  const urgentes = filas.reduce((a, f) => a + f.urgentes, 0)

  return (
    <>
      <Card className="h-full">
        <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                Pendientes
                {total > 0 && <span className="ml-1.5 text-muted-foreground">({total})</span>}
                {urgentes > 0 && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {urgentes} urgente{urgentes > 1 ? "s" : ""}
                  </span>
                )}
              </p>
              {top.length === 0 ? (
                // El hook se traga los errores a propósito, así que «vacío» y «no cargó» se ven
                // igual. No se afirma que no hay: se dice que no hay nada que mostrar.
                <p className="text-xs text-muted-foreground">Nada que mostrar.</p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {top.map((f) => (
                    <li key={f.id} className="flex justify-between gap-2">
                      <span className="truncate">{f.label}</span>
                      <span className="tabular-nums">{f.total}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <Button size="sm" variant="secondary" className="self-start" onClick={() => setAbierto(true)}>
            Ver el detalle
          </Button>
        </CardContent>
      </Card>

      <ModalPendientes open={abierto} onClose={() => setAbierto(false)} />
    </>
  )
}
