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
import { armarTemplatesDelEjercicio, desdeCuota, type TemplatesDelEjercicio } from "@/lib/balance/templates-libro"
import { HaciendaAlCierre, type DatosHacienda } from "./hacienda-al-cierre"
import { descargarLibroDiario } from "@/lib/balance/export-libro-diario"
import { armarCuentasAlCierre, type CuentasAlCierre, type ComprobanteConPago } from "@/lib/balance/cuentas-al-cierre"
import { buscarFechasDePagoBancarias, type ClienteMinimo } from "@/lib/balance/fechas-de-pago"

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
  /**
   * 💳 Papeles 03 y 04. Se arman junto con el libro porque necesitan **lo mismo** que él más una
   * consulta: cuándo se pagó cada comprobante. Ver `lib/balance/cuentas-al-cierre.ts`.
   */
  const [cuentas, setCuentas] = useState<{ pagar: CuentasAlCierre; cobrar: CuentasAlCierre } | null>(null)
  const [templates, setTemplates] = useState<TemplatesDelEjercicio | null>(null)
  const [hacienda, setHacienda] = useState<DatosHacienda | null>(null)

  const generar = async () => {
    setCargando(true)
    setLibro(null)
    setTemplates(null)
    setHacienda(null)
    setCuentas(null)
    try {
      const ej = armarEjercicio(anioCierre, empresa.mesCierre)
      // Se traen los DOS años que puede tocar el ejercicio y se filtra en la lógica pura: el corte
      // por subdiario vive en un solo lugar y no se puede aplicar distinto en cada fuente.
      const anios = [anioCierre - 1, anioCierre, anioCierre + 1]

      const [arca, historico, ventas, cuotas] = await Promise.all([
        supabase.schema(empresa.schema).from("comprobantes_arca")
          .select("*").in("año_contable", anios),
        // El histórico es sólo de MSA (es lo que migró del sistema anterior) y usa `anio_contable`.
        empresa.id === "MSA"
          ? supabase.schema("msa").from("comprobantes_historico").select("*").in("anio_contable", anios)
          : Promise.resolve({ data: [], error: null }),
        supabase.schema(empresa.schema).from("comprobantes_venta")
          .select("*").in("año_contable", anios),
        /**
         * 🧾 Los templates viven en `public`, no en el schema de la empresa, y **no tienen
         * subdiario**: se traen por fecha y el corte se hace en `armarTemplatesDelEjercicio`.
         * Se pide un año extra de cada lado para no recortar antes de tiempo.
         */
        supabase.from("cuotas_egresos_sin_factura")
          .select("*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable)")
          .gte("fecha_estimada", `${anioCierre - 2}-01-01`),
      ])

      for (const r of [arca, historico, ventas, cuotas]) {
        if (r.error) throw new Error(r.error.message)
      }

      const compras = [
        ...(arca.data ?? []).map(desdeArca),
        ...(historico.data ?? []).map(desdeHistorico),
      ]
      const armado = armarLibroDiario(compras, (ventas.data ?? []).map(desdeVenta), ej)
      setLibro(armado)

      /**
       * 💳 **Cuentas a pagar y a cobrar al cierre.**
       *
       * 🔑 Manda **cuándo se pagó**, no el estado de hoy: una factura que hoy figura paga pero se
       * pagó después del cierre, al cierre era deuda. La fecha sale de `fecha_pago` o, mejor, del
       * movimiento bancario conciliado — y se busca en **las diez** tablas que llevan el vínculo,
       * no en tres (§ 🔁 La propagación del dato).
       *
       * ⚠️ Si la búsqueda de fechas falla, **el libro ya está en pantalla igual**: estos dos papeles
       * son un agregado, no pueden tirar abajo el resto del export.
       */
      try {
        const porId = new Map<string, { estado: string; fechaPago: string | null }>()
        for (const f of [...(arca.data ?? []), ...(ventas.data ?? [])]) {
          const r = f as Record<string, unknown>
          if (!r.id) continue
          porId.set(String(r.id), {
            estado: String(r.estado ?? "pendiente"),
            fechaPago: r.fecha_pago ? String(r.fecha_pago).slice(0, 10) : null,
          })
        }

        const { porComprobante, tablasQueFallaron } = await buscarFechasDePagoBancarias(
          supabase as unknown as ClienteMinimo,
          [...armado.compras, ...armado.ventas].map(a => a.id),
        )
        if (tablasQueFallaron.length > 0) {
          // Nada en silencio: una tabla que no se pudo leer puede hacer parecer impago algo pagado.
          toast.warning(`No se pudieron leer ${tablasQueFallaron.join(", ")}: puede faltar alguna fecha de pago.`)
        }

        const conPago = (asientos: typeof armado.compras): ComprobanteConPago[] =>
          asientos.map(a => {
            const propia = porId.get(a.id)?.fechaPago ?? null
            const banco = porComprobante.get(a.id) ?? null
            return {
              asiento: a,
              estado: porId.get(a.id)?.estado ?? "pendiente",
              fechaPago: propia ?? banco,
              origenFecha: propia ? "fecha_pago" : banco ? "movimiento bancario" : "sin dato",
            }
          })

        setCuentas({
          pagar: armarCuentasAlCierre(conPago(armado.compras), ej.fechaCierre),
          cobrar: armarCuentasAlCierre(conPago(armado.ventas), ej.fechaCierre),
        })
      } catch (e) {
        toast.warning("No se pudieron armar las cuentas a pagar y a cobrar; el resto del libro salió igual.")
      }
      setTemplates(armarTemplatesDelEjercicio((cuotas.data ?? []).map(desdeCuota), ej))

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
            <Button variant="outline" onClick={() => descargarLibroDiario(
                libro, empresa.id, templates ?? undefined, hacienda ?? undefined,
                hacienda?.insumos, hacienda?.campo, cuentas ?? undefined,
              )}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Bajar el Excel{hacienda ? " completo" : " — sin el sector productivo"}
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

                {/* 🔑 Saber que un mes está duplicado no alcanza para decidir: hay que saber si una
                    fuente CONTIENE a la otra. Eso se dice acá, sin tener que abrir el Excel. */}
                {c.subdiariosDuplicados.map(d => (
                  <div key={d.subdiario} className="text-xs bg-white/60 border border-red-200 rounded p-2 mt-1">
                    <div className="font-semibold">{d.subdiario}</div>
                    <div>
                      {d.porFuente.map(p =>
                        `${p.fuente === "historico" ? "sistema anterior" : p.fuente === "arca" ? "ARCA" : p.fuente}: ${p.comprobantes} por $${fmt(p.total)}`,
                      ).join(" · ")}
                    </div>
                    <div className="mt-1">
                      {d.enComun} está(n) en las dos.{" "}
                      {d.soloEn.length === 0
                        ? "Son idénticas: quedate con una."
                        : d.soloEn.length === 1
                          ? `Sólo «${d.soloEn[0].fuente === "historico" ? "sistema anterior" : "ARCA"}» tiene ${d.soloEn[0].asientos.length} que la otra no, así que la contiene: quedate con ésa.`
                          : "Cada una tiene lo suyo: hay que fusionarlas, no elegir."}
                    </div>
                    {d.soloEn.map(u => (
                      <ul key={u.fuente} className="list-disc pl-5 mt-1">
                        {u.asientos.map((a, i) => (
                          <li key={i}>{a.fecha} · {a.denominacion} · ${fmt(a.total)}</li>
                        ))}
                      </ul>
                    ))}
                  </div>
                ))}

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
              {templates && (
                <div className="border rounded p-2 sm:col-span-2 bg-slate-50">
                  <div className="text-xs text-muted-foreground">
                    Templates — van <strong>aparte</strong>, no entran por subdiario
                  </div>
                  <div className="font-mono">
                    {templates.detalle.length} cuota(s) · ${fmt(templates.totalDebitos)}
                    {templates.totalCreditos > 0 && <> · créditos ${fmt(templates.totalCreditos)}</>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Se cortan por <strong>fecha de pago</strong> (o estimada), porque no tienen subdiario.
                    {templates.sinCategoria.length > 0 && (
                      <span className="text-amber-700"> · {templates.sinCategoria.length} sin categoría contable</span>
                    )}
                    {templates.sinFecha.length > 0 && (
                      <span className="text-amber-700"> · {templates.sinFecha.length} sin fecha</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Provisión (del ejercicio, entraron después): <strong>{libro.provisiones.length}</strong></div>
              <div>
                Sin subdiario: <strong>{libro.sinSubdiario.length}</strong>
                {libro.sinSubdiario.length > 0 && (c.sinSubdiarioQueAfectan.length === 0
                  ? <span> — todos posteriores al cierre, no tocan este balance</span>
                  : <span className="text-amber-700"> — <strong>{c.sinSubdiarioQueAfectan.length}</strong> con fecha del ejercicio: ésos sí hay que imputar</span>)}
              </div>
              {c.vacios.length > 0 && (
                <div className="text-amber-700">
                  Subdiarios sin ningún comprobante: {c.vacios.map(nombreSubdiario).join(", ")}
                </div>
              )}
            </div>

            {/**
              * ⚠️ **Lo que falta si no se trae el sector productivo.** El Excel arma sus solapas con
              * lo que haya en memoria: sin apretar «Traer stock y precios», salen 6 y no 12 —
              * **y antes no lo decía**, así que se podía entregar un papel incompleto creyendo que
              * estaba entero. Ahora el botón lo dice y este cartel también (§ 🧮).
              */}
            {!hacienda && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1.5">
                El Excel te va a salir <strong>sólo con el libro diario</strong> (compras, ventas,
                provisión y templates). Para que traiga también <strong>hacienda, insumos, granos y
                sementeras</strong>, apretá primero «Traer stock y precios» acá abajo.
              </p>
            )}

            {/* 🐄 Aparte del libro diario: trae precios de dos mercados y puede fallar sola sin
                impedir que se bajen las compras. */}
            <HaciendaAlCierre ejercicio={libro.ejercicio} onDatos={setHacienda} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
