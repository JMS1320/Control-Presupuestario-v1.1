"use client"

import { useEffect, useState } from "react"
import { Calendar, AlertCircle, TrendingUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfiguradorIPC } from "@/components/configurador-ipc"

type UltimoIPC = { anio: number; mes: number; valor_ipc: number; fuente: string }

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

/**
 * ÚLTIMO IPC (A-FEAT-88, extraído de `vista-principal`).
 *
 * El botón de gestión viaja **con** el widget y no se quedó en la barra de la pantalla: un número
 * suelto sin forma de llegar a lo que lo compone es justo lo que la § 🧮 prohíbe. Acá el camino al
 * detalle es el modal de índices — donde se ve la serie entera y de dónde salió cada valor.
 */
export function WidgetUltimoIPC() {
  const [ultimo, setUltimo] = useState<UltimoIPC | null>(null)
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const { data } = await supabase
        .from("indices_ipc")
        .select("anio, mes, valor_ipc, fuente")
        .order("anio", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1)
      if (cancelado) return
      if (data && data.length > 0) setUltimo(data[0])
      setCargando(false)
    })()
    return () => { cancelado = true }
  }, [])

  return (
    <>
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          {cargando ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
              <span className="text-sm text-muted-foreground">Cargando último IPC…</span>
            </div>
          ) : ultimo ? (
            <>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 shrink-0 text-orange-600" />
                <div>
                  <div className="text-sm font-medium">
                    {MESES[ultimo.mes - 1]} {ultimo.anio}
                  </div>
                  <div className="text-xs text-muted-foreground">Último IPC registrado</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-600">
                  {ultimo.valor_ipc.toFixed(2).replace(".", ",")}%
                </div>
                <div className="text-xs uppercase text-muted-foreground">{ultimo.fuente}</div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">No hay índices IPC registrados</span>
            </div>
          )}

          <Button size="sm" variant="secondary" onClick={() => setAbierto(true)} className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Ver serie
          </Button>
        </CardContent>
      </Card>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestión de Índices IPC</DialogTitle>
          </DialogHeader>
          <ConfiguradorIPC />
        </DialogContent>
      </Dialog>
    </>
  )
}
