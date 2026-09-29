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
import {
  armarStockInsumos, desdeStockInsumo, PAPELES_SIN_ORIGEN, type StockInsumos,
} from "@/lib/balance/stock-insumos"
import {
  cuadrarGranos, valuarGranos, armarSementeras,
  type CuadreGranos, type ValuacionGranos, type Sementeras,
} from "@/lib/balance/granos-sementeras"
import { pesosAlCierre, type PesoCategoria } from "@/lib/balance/pesos-hacienda"

/**
 * es-AR: coma decimal, punto de miles. **Vacío devuelve `null`, no 0** — «no lo sé» y «cero»
 * son cosas distintas, y confundirlas haría que el cuadre se declarara cerrado sin datos.
 */
const tn = (s: string): number | null => {
  if (!s.trim()) return null
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ent = (n: number) => Math.round(n).toLocaleString("es-AR")

export interface DatosHacienda {
  existencias: ExistenciaHacienda[]
  valuacion: ValuacionHacienda
  mag: PrecioMag[]
  mercado: PrecioMercado[]
  /** El mes que se usó para los precios, para que quede dicho en el papel. */
  mesPrecios: string
  /** Los insumos viajan acá porque se traen en la misma pasada del sector productivo. */
  insumos: StockInsumos
  /** Los kilos por categoría, de las pesadas de la app. */
  pesos: PesoCategoria[]
  /** Toneladas vendidas en el ejercicio: la única entrada del cuadre de granos que la app sabe. */
  ventasGranosTn: number
  sementeras: Sementeras
  /** Lo que el Excel necesita de granos y sementeras, ya armado con lo que el usuario escribió. */
  campo: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras }
}

export function HaciendaAlCierre({
  ejercicio, onDatos,
}: { ejercicio: Ejercicio; onDatos: (d: DatosHacienda | null) => void }) {
  const [cargando, setCargando] = useState(false)
  const [datos, setDatos] = useState<DatosHacienda | null>(null)
  const [manuales, setManuales] = useState<Record<string, string>>({})
  /**
   * Las tres entradas del cuadre de granos que **hoy no están en ninguna tabla**. Van como texto
   * (§ 💰 es-AR) y vacías significan «no lo sé», no «cero» — por eso el cuadre no se declara
   * cerrado mientras falten.
   */
  const [granos, setGranos] = useState({ inicio: "", cosecha: "", cierre: "", precio: "" })

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
      /**
       * ⚖️ Las pesadas hasta el cierre. Se traen con su categoría porque el peso se proyecta
       * **por categoría**, no por animal (A-FEAT-1187).
       */
      const { data: pes } = await supabase
        .schema("productivo").from("pesadas_terneros")
        .select("ternero_id, fecha, peso_kg, ternero:terneros(categoria:categorias_hacienda(nombre))")
        .lte("fecha", ejercicio.fechaCierre)

      // La ganancia diaria CARGADA, para poder compararla con la medida y avisar si difieren.
      const { data: lotesGan } = await supabase
        .schema("productivo").from("stock_lotes")
        .select("categoria, ganancia_diaria_kg")

      // Granos: las toneladas vendidas en el ejercicio. Es lo único del cuadre que la app sabe.
      const { data: vg } = await supabase
        .schema("msa").from("comprobantes_venta")
        .select("toneladas, fecha_liquidacion")
        .gte("fecha_liquidacion", `${Number(ejercicio.fechaCierre.slice(0, 4)) - 1}-07-01`)
        .lte("fecha_liquidacion", ejercicio.fechaCierre)

      // Sementeras: las órdenes agrícolas con sus líneas de insumo.
      const { data: ord } = await supabase
        .schema("productivo").from("ordenes_agricolas")
        .select("id, fecha, lote_nombre, hectareas, estado, lineas:lineas_orden_agricola(insumo_nombre, cantidad_total_l, unidad_dosis)")

      const { data: ins, error: errIns } = await supabase
        .schema("productivo")
        .from("stock_insumos")
        .select("*, categoria:categorias_insumo(nombre, ambito, unidad_medida)")
      if (errIns) throw new Error(errIns.message)

      const [mag, hembras] = await Promise.all([
        pedir<PrecioMag>(`/api/precios-mag?desde=${desde}&hasta=${hasta}`),
        pedir<PrecioMercado>(`/api/precios-mercado?desde=${desde}&hasta=${hasta}&sexo=hembra`),
      ])

      const ganConfig: Record<string, number> = {}
      for (const l of (lotesGan ?? []) as Array<Record<string, unknown>>) {
        const cat = String(l.categoria ?? "")
        const g = Number(l.ganancia_diaria_kg ?? 0)
        // Si hay varios lotes de la misma categoría se toma el mayor: es el que más se aleja de
        // la medida, o sea el que hace más visible la diferencia si la hay.
        if (cat && g > 0) ganConfig[cat] = Math.max(ganConfig[cat] ?? 0, g)
      }
      const pesos = pesosAlCierre(
        (pes ?? []).map((p: Record<string, unknown>) => ({
          categoria: String(
            ((p.ternero as { categoria?: { nombre?: string } } | null)?.categoria?.nombre) ?? "",
          ),
          animalId: String(p.ternero_id ?? ""),
          fecha: String(p.fecha ?? "").slice(0, 10),
          pesoKg: Number(p.peso_kg ?? 0),
        })).filter(p => p.categoria && p.pesoKg > 0),
        ganConfig,
        ejercicio.fechaCierre,
      )

      const numericos: Record<string, number> = {}
      for (const [k, v] of Object.entries(manuales)) {
        const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."))
        if (Number.isFinite(n) && n > 0) numericos[k] = n
      }

      const sementeras = armarSementeras(
        (ord ?? []).map((o: Record<string, unknown>) => ({
          id: String(o.id), fecha: o.fecha ? String(o.fecha).slice(0, 10) : null,
          lote: String(o.lote_nombre ?? ""), hectareas: Number(o.hectareas ?? 0),
          estado: String(o.estado ?? ""),
          lineas: ((o.lineas ?? []) as Array<Record<string, unknown>>).map(l => ({
            insumo: String(l.insumo_nombre ?? ""),
            cantidad: l.cantidad_total_l == null ? null : Number(l.cantidad_total_l),
            unidad: String(l.unidad_dosis ?? ""),
            // Los insumos no tienen precio cargado: por eso cada línea nace como hueco.
            precioUnitario: null,
          })),
        })),
        ejercicio.fechaCierre,
      )
      const ventasGranosTn = Math.round(
        (vg ?? []).reduce((s, x: Record<string, unknown>) => s + Number(x.toneladas ?? 0), 0) * 1000,
      ) / 1000

      const d: DatosHacienda = {
        existencias, mag, mercado: hembras,
        valuacion: valuarHacienda(existencias, mag, hembras, numericos, pesos),
        pesos,
        mesPrecios: etiqueta,
        insumos: armarStockInsumos((ins ?? []).map(desdeStockInsumo), numericos),
        ventasGranosTn, sementeras,
        campo: {
          granos: cuadrarGranos({
            stockInicioTn: tn(granos.inicio), cosechaTn: tn(granos.cosecha),
            ventasTn: ventasGranosTn, stockEmpresaTn: tn(granos.cierre),
          }),
          valuacionGranos: valuarGranos(tn(granos.cierre) ?? 0, tn(granos.precio)),
          sementeras,
        },
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

  const cuadreGranos: CuadreGranos = cuadrarGranos({
    stockInicioTn: tn(granos.inicio),
    cosechaTn: tn(granos.cosecha),
    ventasTn: datos?.ventasGranosTn ?? 0,
    stockEmpresaTn: tn(granos.cierre),
  })

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

          {/* ⚖️ De dónde salió cada kilo, y el aviso si la ganancia cargada no coincide. */}
          {datos && datos.pesos.length > 0 && (
            <div className="border-t pt-3 space-y-1 text-xs" data-test="pesos">
              <div className="text-sm font-medium">⚖️ Los kilos, de las pesadas</div>
              {datos.pesos.map(p => (
                <div key={p.categoria}>
                  <strong>{p.categoria}</strong>: {p.pesoProyectado} kg — {p.origen}
                  {p.difiereDeLaConfigurada && (
                    <span className="text-amber-700">
                      {" "}⚠️ medida {p.gananciaMedida} vs cargada {p.gananciaConfigurada} kg/día
                    </span>
                  )}
                </div>
              ))}
              {datos.pesos.some(p => p.difiereDeLaConfigurada) && (
                <p className="text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1">
                  Se usa la <strong>medida</strong> porque es el dato real. La diferencia con la
                  cargada se muestra para que decidas, no se elige en silencio.
                </p>
              )}
            </div>
          )}

          {/* 🧪 Los stocks de insumos: misma lógica de huecos que la hacienda. */}
          {datos && (
            <div className="border-t pt-3 space-y-2" data-test="stock-insumos">
              <div className="text-sm font-medium">🧪 Stock de insumos</div>
              <div className="text-sm">
                <strong>{ent(datos.insumos.productos)}</strong> productos con existencia ·
                valuado <strong>${fmt(datos.insumos.valuado)}</strong>
                {datos.insumos.huecos.length > 0 && (
                  <span className="text-amber-700"> · <strong>{datos.insumos.huecos.length}</strong> sin precio</span>
                )}
              </div>

              {datos.insumos.grupos.map(g => (
                <div key={g.ambito} className="text-xs">
                  <div className="font-medium">{g.papel}</div>
                  <div className="text-muted-foreground">
                    {g.filas.length} producto(s) · valuado ${fmt(g.valuado)}
                    {g.huecos > 0 && <span className="text-amber-700"> · {g.huecos} sin precio, no incluidos</span>}
                  </div>
                </div>
              ))}

              {datos.insumos.huecos.length > 0 && (
                <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded px-2 py-1.5">
                  <strong>{datos.insumos.huecos.length} productos están contados pero sin precio.</strong>{" "}
                  El inventario existe; la valuación no. El total de arriba no los incluye.
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                <div className="font-medium">🕳️ Lo que todavía le falta a cada papel:</div>
                <ul className="list-disc pl-5">
                  {PAPELES_SIN_ORIGEN.map(p => (
                    <li key={p.papel}><strong>{p.papel}</strong> — {p.falta}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 🌾 Granos: el cuadre de kilos. La app sabe las ventas; las otras dos las cargás vos. */}
          {datos && (
            <div className="border-t pt-3 space-y-2" data-test="granos">
              <div className="text-sm font-medium">🌾 Granos — cuadre de kilos (toneladas)</div>
              <div className="flex flex-wrap items-end gap-2 text-xs">
                <label className="block">
                  <span className="block text-muted-foreground">Stock al inicio</span>
                  <Input type="text" placeholder="0,00" className="h-6 w-24 text-xs"
                    value={granos.inicio} onChange={e => setGranos(g => ({ ...g, inicio: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="block text-muted-foreground">Cosecha</span>
                  <Input type="text" placeholder="0,00" className="h-6 w-24 text-xs"
                    value={granos.cosecha} onChange={e => setGranos(g => ({ ...g, cosecha: e.target.value }))} />
                </label>
                <div>
                  <span className="block text-muted-foreground">Ventas (de la app)</span>
                  <span className="font-mono">{fmt(datos.ventasGranosTn)}</span>
                </div>
                <label className="block">
                  <span className="block text-muted-foreground">Existencia al cierre</span>
                  <Input type="text" placeholder="0,00" className="h-6 w-24 text-xs"
                    value={granos.cierre} onChange={e => setGranos(g => ({ ...g, cierre: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="block text-muted-foreground">Precio por tonelada</span>
                  <Input type="text" placeholder="0,00" className="h-6 w-28 text-xs"
                    value={granos.precio} onChange={e => setGranos(g => ({ ...g, precio: e.target.value }))} />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Cargá lo que falte y apretá <strong>Recalcular</strong> para que entre al Excel.
                Vacío significa <strong>«no lo sé»</strong>, no cero — por eso el cuadre no se declara
                cerrado mientras falte algo.
              </p>
              {(() => {
                const c = cuadreGranos
                return (
                  <div className="text-xs">
                    Saldo: <strong className="font-mono">{c.saldoTn ?? "—"}</strong>
                    {c.diferenciaTn != null && (
                      <> · Diferencia: <strong className={`font-mono ${c.cierra ? "text-emerald-700" : "text-amber-700"}`}>
                        {c.diferenciaTn}
                      </strong> {c.cierra ? "✓ cierra" : "⚠️ no cierra — hay que explicarla"}</>
                    )}
                    {c.faltan.length > 0 && (
                      <div className="text-muted-foreground">Falta cargar: {c.faltan.join(" · ")}</div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* 🌱 Sementeras: lo ejecutado hasta el cierre. */}
          {datos && (
            <div className="border-t pt-3 space-y-1 text-xs" data-test="sementeras">
              <div className="text-sm font-medium">🌱 Sementeras</div>
              <div>
                <strong>{datos.sementeras.ordenesEjecutadas}</strong> orden(es) ejecutada(s) ·
                <strong> {datos.sementeras.hectareas}</strong> ha · costo{" "}
                <strong>${fmt(datos.sementeras.costo)}</strong>
              </div>
              <div className="text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1">
                <strong>El costo está incompleto.</strong> Falta: {datos.sementeras.faltan.join(" · ")}
              </div>
              {datos.sementeras.ordenesNoContadas.length > 0 && (
                <div className="text-muted-foreground">
                  {datos.sementeras.ordenesNoContadas.length} orden(es) no se contaron:{" "}
                  {[...new Set(datos.sementeras.ordenesNoContadas.map(o => o.motivo))].join(" · ")}
                </div>
              )}
            </div>
          )}
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
