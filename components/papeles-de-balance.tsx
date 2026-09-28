"use client"

/**
 * 📒 PAPELES DE TRABAJO DEL BALANCE — A-FEAT-1184.
 *
 * Arma el libro diario del ejercicio y lo baja en Excel para el contador.
 *
 * ## Lo que hay que entender antes de tocar esto
 *
 * **El período NO se corta por la fecha de las facturas**, sino por **el subdiario en el que
 * entraron** (regla del usuario, 2026-09-28). Toda la lógica vive en `lib/balance/` y está probada
 * en `lib/pruebas/casos.ts`; acá sólo se traen los datos y se muestra el resultado.
 *
 * ## 🔴 Las compras salen de DOS tablas, y no es un detalle
 *
 * `comprobantes_historico` trae lo del sistema anterior (jul–dic 2025) y `comprobantes_arca` lo
 * nuevo. **Diciembre está en las dos** y no coincide, porque *«sin querer entró 2 veces»* → `A-DAT-61`.
 * El control lo detecta y lo muestra; **no se elige una fuente en silencio**.
 *
 * ## ⚠️ Sólo LEE
 * Esta pantalla no escribe una sola fila. Genera un archivo y nada más.
 */
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { toast } from "sonner"
import { armarEjercicio, nombreSubdiario } from "@/lib/balance/ejercicio"
import { armarLibroDiario, desdeArca, desdeHistorico, desdeVenta, type LibroDiario } from "@/lib/balance/libro-diario"
import { descargarLibroDiario } from "@/lib/balance/export-libro-diario"

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Empresas y su mes de cierre. MSA cierra en junio; PAM y MA en diciembre. */
const EMPRESAS = [
  { id: "MSA", schema: "msa", mesCierre: 6 },
  { id: "PAM", schema: "pam", mesCierre: 12 },
  { id: "MA", schema: "ma", mesCierre: 12 },
] as const

export function PapelesDeBalance() {
  const [empresa, setEmpresa] = useState<(typeof EMPRESAS)[number]>(EMPRESAS[0])
  const [anioCierre, setAnioCierre] = useState(2026)
  const [cargando, setCargando] = useState(false)
  const [libro, setLibro] = useState<LibroDiario | null>(null)

  const generar = async () => {
    setCargando(true)
    setLibro(null)
    try {
      const ej = armarEjercicio(anioCierre, empresa.mesCierre)
      // Se traen los DOS años que puede tocar el ejercicio y se filtra en la lógica pura: el corte
      // por subdiario vive en un solo lugar y no se puede aplicar distinto en cada fuente.
      const anios = [anioCierre - 1, anioCierre, anioCierre + 1]

      const [arca, historico, ventas] = await Promise.all([
        supabase.schema(empresa.schema).from("comprobantes_arca")
          .select("*").in("año_contable", anios),
        // El histórico es sólo de MSA (es lo que migró del sistema anterior) y usa `anio_contable`.
        empresa.id === "MSA"
          ? supabase.schema("msa").from("comprobantes_historico").select("*").in("anio_contable", anios)
          : Promise.resolve({ data: [], error: null }),
        supabase.schema(empresa.schema).from("comprobantes_venta")
          .select("*").in("año_contable", anios),
      ])

      for (const r of [arca, historico, ventas]) {
        if (r.error) throw new Error(r.error.message)
      }

      const compras = [
        ...(arca.data ?? []).map(desdeArca),
        ...(historico.data ?? []).map(desdeHistorico),
      ]
      const armado = armarLibroDiario(compras, (ventas.data ?? []).map(desdeVenta), ej)
      setLibro(armado)

      if (armado.compras.length === 0 && armado.ventas.length === 0) {
        toast.warning(`No hay comprobantes en los 12 subdiarios del ejercicio ${ej.etiqueta}.`)
      }
    } catch (e) {
      toast.error("No se pudo armar el libro: " + (e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  const c = libro?.controles

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Papeles de trabajo del balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Empresa</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={empresa.id}
              onChange={e => setEmpresa(EMPRESAS.find(x => x.id === e.target.value) ?? EMPRESAS[0])}
            >
              {EMPRESAS.map(e => (
                <option key={e.id} value={e.id}>
                  {e.id} — cierra el {e.mesCierre === 6 ? "30/06" : "31/12"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Año de cierre</label>
            {/* Texto, no `number`: es la convención de la app para todo input numérico. */}
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm w-24"
              value={anioCierre}
              onChange={e => setAnioCierre(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
            />
          </div>
          <Button onClick={generar} disabled={cargando}>
            {cargando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Armar el libro
          </Button>
          {libro && (
            <Button variant="outline" onClick={() => descargarLibroDiario(libro, empresa.id)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Bajar el Excel
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          El período se corta por <strong className="mx-1">el subdiario en el que entró</strong> cada
          comprobante, no por la fecha de la factura. Esta pantalla sólo lee: no modifica nada.
        </p>

        {libro && c && (
          <div className="space-y-3 border-t pt-3">
            <div className="text-sm">
              Ejercicio <strong>{libro.ejercicio.etiqueta}</strong> · cierre {libro.ejercicio.fechaCierre} ·
              subdiarios de {nombreSubdiario(libro.ejercicio.subdiarios[0])} a{" "}
              {nombreSubdiario(libro.ejercicio.subdiarios[11])}
            </div>

            {/* 🧮 El control, proporcional: un ✓ discreto si cierra, una alerta grande si no. */}
            {c.sePuedeEntregar ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                <CheckCircle2 className="h-4 w-4" />
                El libro cierra: se puede entregar.
              </div>
            ) : (
              <div className="text-sm text-red-800 bg-red-50 border-2 border-red-300 rounded px-3 py-2 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Todavía no se puede entregar
                </div>
                <ul className="list-disc pl-5">
                  {c.motivos.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
                <p className="text-xs">
                  El Excel se baja igual, para poder ver dónde está el problema.
                </p>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">Compras del ejercicio</div>
                <div className="font-mono">{c.compras.cantidad} · ${fmt(c.compras.totalGeneral)}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">Ventas del ejercicio</div>
                <div className="font-mono">{c.ventas.cantidad} · ${fmt(c.ventas.totalGeneral)}</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Provisión (del ejercicio, entraron después): <strong>{libro.provisiones.length}</strong></div>
              <div>Sin subdiario (no se sabe a qué período van): <strong>{libro.sinSubdiario.length}</strong></div>
              {c.vacios.length > 0 && (
                <div className="text-amber-700">
                  Subdiarios sin ningún comprobante: {c.vacios.map(nombreSubdiario).join(", ")}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
