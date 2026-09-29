"use client"

/**
 * 🐄 HACIENDA AL CIERRE — existencia y valuación (A-FEAT-1184).
 *
 * Vive aparte de `papeles-de-balance.tsx` porque tiene su propio ciclo: trae precios de **dos
 * mercados externos** y acepta que el usuario los pise a mano. Mezclarlo con el libro diario haría
 * que un mercado caído impidiera bajar las compras, que no tienen nada que ver.
 *
 * ## De dónde sale cada cosa
 * - **Existencia**: `productivo.movimientos_hacienda`, sumando cantidades con signo hasta el cierre.
 * - **Precios**: `/api/precios-mag` (Cañuelas, categorías comerciales) y `/api/precios-mercado`
 *   (Entresurcos, por rango de kilos). **Todo el mes del cierre**, como pidió el usuario:
 *   *«se debería tomar todo el mes de junio para tomar algo representativo»*.
 * - **Criterios**: `lib/balance/hacienda-stock.ts`, transcriptos de su planilla.
 *
 * ## 🕳️ Los huecos se muestran, no se rellenan
 * Una categoría sin precio **no se valúa en cero**: sale listada con su criterio. Y el campo de
 * precio a mano está **siempre** disponible (§ 🎚️): vacío = usá el mercado, lleno = acá mando yo.
 *
 * ⚠️ Sólo lee de la base. Los precios a mano viven en la pantalla, no se guardan todavía.
 */
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import type { Ejercicio } from "@/lib/balance/ejercicio"
import {
  valuarHacienda, CRITERIOS,
  type ValuacionHacienda, type PrecioMag, type PrecioMercado, type ExistenciaHacienda,
} from "@/lib/balance/hacienda-stock"

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ent = (n: number) => Math.round(n).toLocaleString("es-AR")

export interface DatosHacienda {
  existencias: ExistenciaHacienda[]
  valuacion: ValuacionHacienda
  mag: PrecioMag[]
  mercado: PrecioMercado[]
  /** El mes que se usó para los precios, para que quede dicho en el papel. */
  mesPrecios: string
}

export function HaciendaAlCierre({
  ejercicio, onDatos,
}: { ejercicio: Ejercicio; onDatos: (d: DatosHacienda | null) => void }) {
  const [cargando, setCargando] = useState(false)
  const [datos, setDatos] = useState<DatosHacienda | null>(null)
  const [manuales, setManuales] = useState<Record<string, string>>({})

  /** El mes del cierre completo: `2026-06-01` … `2026-06-30`. */
  const mesDelCierre = () => {
    const fin = ejercicio.fechaCierre
    return { desde: `${fin.slice(0, 8)}01`, hasta: fin, etiqueta: fin.slice(0, 7) }
  }

  const traer = async () => {
    setCargando(true)
    try {
      const { desde, hasta, etiqueta } = mesDelCierre()

      // La existencia: suma de movimientos hasta el cierre, por categoría.
      const { data: movs, error } = await supabase
        .schema("productivo")
        .from("movimientos_hacienda")
        .select("cantidad, fecha, categoria:categorias_hacienda(nombre)")
        .lte("fecha", ejercicio.fechaCierre)
      if (error) throw new Error(error.message)

      const porCat = new Map<string, number>()
      for (const m of (movs ?? []) as Array<Record<string, unknown>>) {
        const nombre = ((m.categoria as { nombre?: string } | null)?.nombre) ?? ""
        if (!nombre) continue
        porCat.set(nombre, (porCat.get(nombre) ?? 0) + Number(m.cantidad ?? 0))
      }
      const existencias: ExistenciaHacienda[] = [...porCat.entries()]
        .filter(([, n]) => n !== 0)
        .map(([categoria, cabezas]) => ({ categoria, cabezas }))
        .sort((a, b) => b.cabezas - a.cabezas)

      // Los precios. Si un mercado falla NO se corta: se sigue con el otro y los que falten
      // quedan como huecos, que es la información útil.
      const pedir = async <T,>(url: string): Promise<T[]> => {
        try {
          const r = await fetch(url)
          const j = await r.json()
          if (!r.ok || j?.error) { toast.warning(`${url.split("?")[0]}: ${j?.error ?? r.status}`); return [] }
          return (j.filas ?? j.datos ?? j.precios ?? []) as T[]
        } catch (e) {
          toast.warning("No se pudo traer precios: " + (e as Error).message)
          return []
        }
      }
      const [mag, hembras] = await Promise.all([
        pedir<PrecioMag>(`/api/precios-mag?desde=${desde}&hasta=${hasta}`),
        pedir<PrecioMercado>(`/api/precios-mercado?desde=${desde}&hasta=${hasta}&sexo=hembra`),
      ])

      const numericos: Record<string, number> = {}
      for (const [k, v] of Object.entries(manuales)) {
        const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."))
        if (Number.isFinite(n) && n > 0) numericos[k] = n
      }

      const d: DatosHacienda = {
        existencias, mag, mercado: hembras,
        valuacion: valuarHacienda(existencias, mag, hembras, numericos),
        mesPrecios: etiqueta,
      }
      setDatos(d)
      onDatos(d)
    } catch (e) {
      toast.error("No se pudo armar la hacienda: " + (e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  const v = datos?.valuacion

  return (
    <div className="border-t pt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">🐄 Hacienda al cierre</span>
        <Button size="sm" variant="outline" onClick={traer} disabled={cargando}>
          {cargando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          {datos ? "Recalcular" : "Traer stock y precios"}
        </Button>
        {datos && (
          <span className="text-xs text-muted-foreground">
            Precios de <strong>{datos.mesPrecios}</strong> (el mes entero) · Cañuelas {datos.mag.length} categorías · Entresurcos {datos.mercado.length}
          </span>
        )}
      </div>

      {v && (
        <>
          <div className="text-sm">
            <strong>{ent(v.cabezas)}</strong> cabezas al {ejercicio.fechaCierre} ·
            valuado <strong>${fmt(v.valuado)}</strong>
            {v.cabezasSinValuar > 0 && (
              <span className="text-amber-700"> · faltan valuar {ent(v.cabezasSinValuar)} cabezas</span>
            )}
          </div>

          {v.huecos.length > 0 && (
            <div className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {v.huecos.length} categoría(s) sin precio — cargalo y se valúan solas
              </div>
              <p className="text-xs">
                No se valúan en cero: el total de arriba <strong>no las incluye</strong>.
              </p>
            </div>
          )}

          <div className="overflow-x-auto border rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-1.5">Categoría</th>
                  <th className="text-right p-1.5">Cabezas</th>
                  <th className="text-left p-1.5">Criterio (tuyo)</th>
                  <th className="text-left p-1.5">Precio de referencia</th>
                  <th className="text-right p-1.5">$/cabeza</th>
                  <th className="text-right p-1.5">Total</th>
                  <th className="text-left p-1.5">Precio a mano</th>
                </tr>
              </thead>
              <tbody>
                {v.filas.map(f => (
                  <tr key={f.categoria} className={f.esHueco ? "bg-amber-50" : ""}>
                    <td className="p-1.5 font-medium">{f.categoria}</td>
                    <td className="p-1.5 text-right font-mono">{ent(f.cabezas)}</td>
                    <td className="p-1.5 text-muted-foreground">{f.criterio}</td>
                    <td className="p-1.5 text-muted-foreground">
                      {f.precioReferencia != null ? `$${fmt(f.precioReferencia)} · ` : ""}{f.origenPrecio}
                    </td>
                    <td className="p-1.5 text-right font-mono">{f.valorPorCabeza != null ? fmt(f.valorPorCabeza) : "—"}</td>
                    <td className="p-1.5 text-right font-mono">{f.valorTotal != null ? fmt(f.valorTotal) : "—"}</td>
                    <td className="p-1.5">
                      {/* § 💰 es-AR: texto, nunca `number`. Vacío = usá el mercado. */}
                      <Input
                        type="text" placeholder="0,00" className="h-6 text-xs w-28"
                        value={manuales[f.categoria] ?? ""}
                        onChange={e => setManuales(m => ({ ...m, [f.categoria]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Cargá un precio y apretá <strong>Recalcular</strong>. El que ponés a mano manda sobre el
            del mercado{v.sinCriterio.length > 0 && (
              <> · ⚠️ sin criterio definido: <strong>{v.sinCriterio.join(", ")}</strong></>
            )}
          </p>
        </>
      )}

      {!datos && !cargando && (
        <p className="text-xs text-muted-foreground">
          Trae la existencia al cierre y los precios del mes, y aplica tus {CRITERIOS.length} criterios
          de valuación. No modifica nada.
        </p>
      )}
    </div>
  )
}
