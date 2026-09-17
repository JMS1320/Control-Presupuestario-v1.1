"use client"

import { useState } from "react"
import { ClipboardList } from "lucide-react"
import { usePendientesPorPantalla } from "@/hooks/usePendientesPorPantalla"
import { SOLAPAS } from "@/components/layout-app"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-slate-600" />
            Pendientes por pantalla
            {total > 0 && (
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {total}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filas.length === 0 ? (
            // Sin datos y sin pendientes se ven igual, así que no se afirma «no hay»: el hook se
            // traga los errores a propósito y devolvería un mapa vacío también si falló.
            <p className="text-sm text-muted-foreground">Sin pendientes para mostrar.</p>
          ) : (
            <ul className="divide-y text-sm">
              {filas.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-1.5">
                  <span>{f.label}</span>
                  <span className="flex items-center gap-2">
                    {f.urgentes > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        {f.urgentes} urgente{f.urgentes > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="tabular-nums text-muted-foreground">{f.total}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="mt-3 gap-2"
            onClick={() => setAbierto(true)}
          >
            Ver el detalle
          </Button>
        </CardContent>
      </Card>

      <ModalPendientes open={abierto} onClose={() => setAbierto(false)} />
    </>
  )
}
