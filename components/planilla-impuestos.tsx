"use client"

/**
 * 🧾 PLANILLA DE IMPUESTOS — A-FEAT-1320.
 *
 * Botón en Egresos sin Factura → modal de pantalla completa. Un año calendario (abre en el actual,
 * flechas al anterior y al siguiente), una fila por impuesto y empresa, cada cuota en su mes con el
 * color de su estado (conciliada · pagada · sin pagar/presupuestada · vencida), totales pagado /
 * adeudado / futuro, los mismos avisos que Principal arriba, y export a Excel.
 *
 * Las filas se ordenan arrastrándolas y el orden se guarda en las preferencias de la cuenta: *«si veo
 * algo muy poco importante arriba lo arrastro hacia abajo y eso ya lo recuerda»*.
 *
 * La lógica vive en `lib/impuestos/planilla.ts` (con sus casos). Sólo lectura: no escribe ninguna
 * cuota — salvo el orden de las filas, que es una preferencia personal.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"
import { hoyArgentina } from "@/lib/fechas"
import { leerPreferencias } from "@/lib/auth/preferencias"
import { guardarPreferencias } from "@/lib/auth/guardar-preferencias"
import { armarPlanilla, ordenarFilas, moverFila, type CuotaPlanilla, type CeldaCuota, type FilaPlanilla } from "@/lib/impuestos/planilla"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertaImpuestos } from "@/components/alerta-impuestos"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { PapelInmobiliario } from "@/components/papel-inmobiliario"
import { cuentasRedVialDe, hectareasDe, papelDeTemplate, type TipoPapel } from "@/lib/impuestos/papel-inmobiliario"
import type { TipoCambio } from "@/lib/arrendamientos/calculo"
import { ChevronDown, ChevronLeft, ChevronRight, Download, GripVertical, Loader2 } from "lucide-react"
import { toast } from "sonner"

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const plata = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const corto = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`
  : n >= 1000 ? `${Math.round(n / 1000).toLocaleString("es-AR")} k` : n.toLocaleString("es-AR", { maximumFractionDigits: 0 })
const fecha = (iso: string) => iso.split("-").reverse().join("/")

/** Color y estilo de cada cuota según su estado (definición del usuario, punto 3). */
function claseCuota(c: CeldaCuota): string {
  // programado / echeq: cuenta como pagada, pero en un impuesto es raro → que salte a la vista.
  if (c.rara) return "bg-amber-100 text-amber-900 border-amber-500 ring-2 ring-amber-400 font-semibold"
  if (c.estado === "conciliada") return "bg-green-600 text-white border-green-700"
  if (c.estado === "pagada") return "bg-green-100 text-green-800 border-green-300"
  if (c.vencida) return "bg-red-50 text-red-700 border-red-400 border-dashed font-semibold"
  return "bg-white text-slate-500 border-slate-300 border-dashed italic"
}
const ROTULO: Record<string, string> = { conciliada: "conciliada", pagada: "pagada", "sin-pagar": "sin pagar (presupuestada)" }
const rotulo = (c: CeldaCuota) => c.rara ? `pagada, pero en ${c.estadoOriginal} — raro en un impuesto, revisar` : c.vencida ? "vencida sin pagar" : ROTULO[c.estado]

const SELECT = "id,estado,fecha_vencimiento,fecha_estimada,fecha_pago,monto,numero_cuota,detalle,template:egresos_sin_factura!inner(id,nombre_referencia,responsable,cuenta_agrupadora,categ,solo_conciliacion,activo,partida_arba)"

async function cargarCuotas(): Promise<CuotaPlanilla[]> {
  const todas: CuotaPlanilla[] = []
  // De a 1000: el límite por consulta de Supabase. Sin esto, el día que haya más cuotas la planilla
  // mostraría menos sin avisar.
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from("cuotas_egresos_sin_factura").select(SELECT)
      .ilike("template.cuenta_agrupadora", "impuesto%").order("id").range(desde, desde + 999)
    if (error) throw new Error(error.message)
    todas.push(...((data ?? []) as unknown as CuotaPlanilla[]))
    if (!data || data.length < 1000) break
  }
  return todas
}

export function PlanillaImpuestos({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const hoy = hoyArgentina()
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)))
  const [cuotas, setCuotas] = useState<CuotaPlanilla[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [orden, setOrden] = useState<string[]>([])
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  // 🏛️ Punto (5): el detalle de inmobiliario / Red Vial / automotores con el formato de su planilla.
  const [papel, setPapel] = useState<TipoPapel | null>(null)
  const [tcs, setTcs] = useState<TipoCambio[]>([])
  const [hectareas, setHectareas] = useState<Record<string, number>>({})
  const [cuentasRedVial, setCuentasRedVial] = useState<Record<string, string>>({})

  const cargar = useCallback(async () => {
    setError(null)
    try { setCuotas(await cargarCuotas()) } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => {
    if (!open) return
    void cargar()
    supabase.auth.getUser().then(({ data }) => setOrden(leerPreferencias(data.user).ordenImpuestos ?? []))
    // Para el detalle: TC (columna U$S) y hectáreas (columnas por ha). Si no se pueden leer, el detalle
    // sale igual sin esas columnas.
    supabase.from("tipos_cambio").select("anio, mes, tc_presupuestado, tc_real").then(({ data }) => setTcs((data ?? []) as TipoCambio[]))
    Promise.all([
      supabase.from("partidas").select("campo, partida_inmobiliario, partida_red_vial, has_totales, has_productivas"),
      supabase.from("campo_partidas").select("nombre_partida, nro_partida, has"),
    ]).then(([p, c]) => {
      setHectareas(hectareasDe((p.data ?? []) as any[], (c.data ?? []) as any[]))
      setCuentasRedVial(cuentasRedVialDe((p.data ?? []) as any[]))
    })
  }, [open, cargar])

  /** El total de las filas de un papel en la Planilla de un año: el control del detalle. */
  const totalEnPlanilla = useCallback((tipo: TipoPapel, a: number) => {
    if (!cuotas) return 0
    const deTipo = (cuotas.filter(c => papelDeTemplate(c.template.categ)?.papel === tipo))
    return armarPlanilla(deTipo, a, hoy).totales.total
  }, [cuotas, hoy])

  const planilla = useMemo(() => cuotas ? armarPlanilla(cuotas, anio, hoy) : null, [cuotas, anio, hoy])
  const filas = useMemo(() => planilla ? ordenarFilas(planilla.filas, orden) : [], [planilla, orden])

  const soltar = async (destino: string) => {
    if (!arrastrando || arrastrando === destino) { setArrastrando(null); return }
    // El orden completo de lo que se ve ahora, para que mover una fila no desordene las otras.
    const nuevo = moverFila(filas.map(f => f.clave), arrastrando, destino, "antes")
    setArrastrando(null)
    setOrden(nuevo)
    const { error: e } = await guardarPreferencias({ ordenImpuestos: nuevo })
    if (e) toast.error(`El orden se ve, pero no se pudo guardar: ${e}`)
  }
  const restablecerOrden = async () => {
    setOrden([])
    const { error: e } = await guardarPreferencias({ ordenImpuestos: null })
    if (e) toast.error(`No se pudo guardar: ${e}`)
  }

  const exportar = () => {
    if (!planilla) return
    const resumen: Array<Record<string, string | number>> = filas.map(f => {
      const r: Record<string, string | number> = { Impuesto: f.impuesto, Empresa: f.empresa }
      MESES.forEach((m, i) => { r[m] = Math.round(f.meses[i].reduce((s, c) => s + c.monto, 0) * 100) / 100 })
      return { ...r, Pagado: f.pagado, Adeudado: f.adeudado, "Compromisos futuros": f.futuro, Total: f.total }
    })
    for (const e of planilla.porEmpresa) resumen.push({ Impuesto: "TOTAL", Empresa: e.empresa, Pagado: e.pagado, Adeudado: e.adeudado, "Compromisos futuros": e.futuro, Total: e.total })
    resumen.push({ Impuesto: "TOTAL GENERAL", Empresa: "", Pagado: planilla.totales.pagado, Adeudado: planilla.totales.adeudado, "Compromisos futuros": planilla.totales.futuro, Total: planilla.totales.total })
    const detalle = filas.flatMap(f => f.meses.flat().map(c => ({
      Impuesto: f.impuesto, Empresa: f.empresa, Template: c.template, Cuota: c.numero_cuota ?? "", Vencimiento: fecha(c.vencimiento),
      Monto: c.monto, Estado: rotulo(c), "Estado en la app": c.estadoOriginal,
    })))
    // Las de templates dados de baja van al final, marcadas: no suman en el resumen.
    for (const f of planilla.desactivadas) for (const c of f.meses.flat()) detalle.push({
      Impuesto: f.impuesto, Empresa: f.empresa, Template: c.template, Cuota: c.numero_cuota ?? "", Vencimiento: fecha(c.vencimiento),
      Monto: c.monto, Estado: "template dado de baja — no suma", "Estado en la app": c.estadoOriginal,
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), `Impuestos ${anio}`)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), "Cuotas")
    XLSX.writeFile(wb, `Impuestos_${anio}_al_${hoy}.xlsx`)
  }

  const anios = planilla?.aniosConDatos ?? []
  const sinDatos = planilla && planilla.filas.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[99vw] w-[99vw] h-[96vh] max-h-[96vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            🧾 Planilla de impuestos
            <span className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setAnio(a => a - 1)} title="Año anterior"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-[3.5rem] text-center text-xl font-bold">{anio}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setAnio(a => a + 1)} title="Año siguiente"><ChevronRight className="h-4 w-4" /></Button>
            </span>
            <span className="ml-auto flex gap-2">
              {orden.length > 0 && <Button size="sm" variant="ghost" onClick={restablecerOrden}>Orden de siempre</Button>}
              <Button size="sm" variant="outline" onClick={() => setPapel("inmobiliario")} disabled={!cuotas}>🏛️ Inmobiliario · Red Vial · Automotores</Button>
              <Button size="sm" variant="outline" onClick={exportar} disabled={!planilla || !!sinDatos}><Download className="mr-1 h-4 w-4" />Excel</Button>
            </span>
          </DialogTitle>
          <DialogDescription>
            Año calendario: cada cuota cae en el mes de su vencimiento. Una fila por impuesto y empresa; arrastrá las filas para ordenarlas (queda guardado).
          </DialogDescription>
        </DialogHeader>
        <TestsDelProceso proceso="egresos/impuestos" pantalla="egresos" />

        <AlertaImpuestos />

        {error && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">No se pudo leer las cuotas de impuestos: {error}</div>}
        {!planilla && !error && <p className="flex items-center gap-2 py-8 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Leyendo las cuotas…</p>}

        {planilla && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-medium text-gray-600">Referencias:</span>
              <span className="rounded border px-1.5 bg-green-600 text-white border-green-700">conciliada</span>
              <span className="rounded border px-1.5 bg-green-100 text-green-800 border-green-300">pagada</span>
              <span className="rounded border px-1.5 bg-white text-slate-500 border-slate-300 border-dashed italic">sin pagar (presupuestada)</span>
              <span className="rounded border px-1.5 bg-red-50 text-red-700 border-red-400 border-dashed font-semibold">vencida sin pagar</span>
              <span className="rounded border px-1.5 bg-amber-100 text-amber-900 border-amber-500 ring-2 ring-amber-400 font-semibold">programado / echeq: revisar</span>
              <span className="ml-auto">
                {planilla.control.cierra
                  ? <span className="text-green-700" title="Las cuotas mes a mes suman el total de cada fila, y las empresas el total general">✓ control: los meses suman los totales</span>
                  : <span className="font-semibold text-red-700" title={planilla.control.diferencias.join("\n")}>⚠️ los totales no cierran: {planilla.control.diferencias.length} diferencia(s)</span>}
              </span>
            </div>

            {planilla.raras > 0 && (
              <div className="rounded border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900">
                ⚠️ <b>{planilla.raras}</b> cuota(s) de {anio} en <b>programado</b> o <b>echeq</b>: cuentan como pagadas, pero en un impuesto es raro
                (suele ser un pago que no se terminó de cerrar). Están marcadas en naranja.
              </div>
            )}

            {sinDatos ? (
              <p className="rounded border bg-gray-50 p-6 text-center text-sm text-gray-600">
                No hay cuotas de impuestos con vencimiento en {anio}.
                {anios.length > 0 && <> Hay datos de: {anios.join(", ")}.</>}
              </p>
            ) : (
              <div className="overflow-x-auto rounded border">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100">
                    <tr>
                      <th className="w-5" />
                      <th className="px-2 py-1 text-left">Impuesto</th>
                      <th className="px-2 py-1 text-left">Empresa</th>
                      {MESES.map(m => <th key={m} className="px-1 py-1 text-center">{m}</th>)}
                      <th className="px-2 py-1 text-right">Pagado</th>
                      <th className="px-2 py-1 text-right">Adeudado</th>
                      <th className="px-2 py-1 text-right">Futuro</th>
                      <th className="px-2 py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map(f => (
                      <FilaImpuesto key={f.clave} f={f} abierta={abiertas.has(f.clave)} arrastrada={arrastrando === f.clave}
                        abrirPapel={PAPEL_DE_IMPUESTO[f.impuesto] ? () => setPapel(PAPEL_DE_IMPUESTO[f.impuesto]) : undefined}
                        alternar={() => setAbiertas(s => { const n = new Set(s); if (n.has(f.clave)) n.delete(f.clave); else n.add(f.clave); return n })}
                        alEmpezar={() => setArrastrando(f.clave)} alSoltar={() => void soltar(f.clave)} />
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold">
                    {planilla.porEmpresa.map(e => (
                      <tr key={e.empresa} className="border-t">
                        <td /><td className="px-2 py-1">Total</td><td className="px-2 py-1">{e.empresa}</td>
                        <td colSpan={12} />
                        <td className="px-2 py-1 text-right">{plata(e.pagado)}</td>
                        <td className={`px-2 py-1 text-right ${e.adeudado > 0 ? "text-red-700" : ""}`}>{plata(e.adeudado)}</td>
                        <td className="px-2 py-1 text-right">{plata(e.futuro)}</td>
                        <td className="px-2 py-1 text-right">{plata(e.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-400 text-sm">
                      <td /><td className="px-2 py-1" colSpan={2}>TOTAL {anio}</td>
                      <td colSpan={12} />
                      <td className="px-2 py-1 text-right">{plata(planilla.totales.pagado)}</td>
                      <td className={`px-2 py-1 text-right ${planilla.totales.adeudado > 0 ? "text-red-700" : ""}`}>{plata(planilla.totales.adeudado)}</td>
                      <td className="px-2 py-1 text-right">{plata(planilla.totales.futuro)}</td>
                      <td className="px-2 py-1 text-right">{plata(planilla.totales.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {planilla.desactivadas.length > 0 && (
              <details className="rounded border border-dashed bg-gray-50/60">
                <summary className="cursor-pointer px-3 py-2 text-xs text-gray-600">
                  Templates dados de baja: {planilla.desactivadas.reduce((n, f) => n + f.meses.flat().length, 0)} cuota(s) sin pagar
                  por {plata(planilla.desactivadas.reduce((s, f) => s + f.total, 0))} — <b>no suman</b> en los totales; están para poder chequearlas.
                </summary>
                <div className="overflow-x-auto opacity-70">
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      {planilla.desactivadas.map(f => {
                        const k = `baja:${f.clave}`
                        return <FilaImpuesto key={k} f={f} abierta={abiertas.has(k)} arrastrada={false}
                          alternar={() => setAbiertas(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })}
                          alEmpezar={() => {}} alSoltar={() => {}} />
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </DialogContent>
      {cuotas && (
        <PapelInmobiliario open={papel !== null} onOpenChange={v => { if (!v) setPapel(null) }} tipoInicial={papel ?? "inmobiliario"}
          anioInicial={anio} cuotas={cuotas} tcs={tcs} hectareas={hectareas} cuentasRedVial={cuentasRedVial} totalEnPlanilla={totalEnPlanilla} />
      )}
    </Dialog>
  )
}

const PAPEL_DE_IMPUESTO: Record<string, TipoPapel> = {
  "Inmobiliario": "inmobiliario", "Inmobiliario Complementario": "inmobiliario", "Red Vial": "red-vial", "Automotores": "automotores",
}

function Cuotas({ cuotas }: { cuotas: CeldaCuota[] }) {
  return (
    <div className="flex flex-col items-stretch gap-0.5">
      {cuotas.map(c => (
        <span key={c.id} className={`rounded border px-1 text-center leading-4 ${claseCuota(c)}`}
          title={`${c.template}${c.numero_cuota ? ` · cuota ${c.numero_cuota}` : ""}\nVence ${fecha(c.vencimiento)} · $${plata(c.monto)}\n${rotulo(c)} (${c.estadoOriginal})`}>
          {corto(c.monto)}
        </span>
      ))}
    </div>
  )
}

function FilaImpuesto({ f, abierta, arrastrada, alternar, alEmpezar, alSoltar, abrirPapel }: {
  f: FilaPlanilla; abierta: boolean; arrastrada: boolean; alternar: () => void; alEmpezar: () => void; alSoltar: () => void; abrirPapel?: () => void
}) {
  // El desglose por template (partida, vehículo…): lo mismo, una fila por cada uno.
  const porTemplate = abierta ? f.templates.map(t => ({ t, meses: f.meses.map(m => m.filter(c => c.template === t)) })) : []
  return (
    <>
      <tr className={`border-t align-top hover:bg-slate-50 ${arrastrada ? "opacity-40" : ""}`}
        draggable onDragStart={alEmpezar} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); alSoltar() }}>
        <td className="cursor-grab px-0.5 py-1 text-slate-400" title="Arrastrá para ordenar"><GripVertical className="h-4 w-4" /></td>
        <td className="px-2 py-1 font-medium">
          <button className="flex items-center gap-1 text-left" onClick={alternar} title={`${f.templates.length} template(s): ${f.templates.join(", ")}`}>
            {abierta ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{f.impuesto}
            {f.templates.length > 1 && <span className="text-[10px] text-gray-400">({f.templates.length})</span>}
          </button>
          {abrirPapel && <button className="ml-1 text-[11px] text-blue-700 hover:underline" onClick={abrirPapel} title="Ver el detalle con el formato de la planilla">🏛️ detalle</button>}
        </td>
        <td className="px-2 py-1">{f.empresa}</td>
        {f.meses.map((m, i) => <td key={i} className="min-w-[3.5rem] px-0.5 py-1"><Cuotas cuotas={m} /></td>)}
        <td className="px-2 py-1 text-right">{plata(f.pagado)}</td>
        <td className={`px-2 py-1 text-right ${f.adeudado > 0 ? "font-semibold text-red-700" : ""}`}>{plata(f.adeudado)}</td>
        <td className="px-2 py-1 text-right">{plata(f.futuro)}</td>
        <td className="px-2 py-1 text-right font-semibold">{plata(f.total)}</td>
      </tr>
      {porTemplate.map(({ t, meses }) => (
        <tr key={t} className="bg-slate-50/60 align-top text-[11px] text-gray-600">
          <td /><td className="py-0.5 pl-6 pr-2" colSpan={2}>{t}</td>
          {meses.map((m, i) => <td key={i} className="px-0.5 py-0.5"><Cuotas cuotas={m} /></td>)}
          <td colSpan={4} className="px-2 text-right">{plata(meses.flat().reduce((s, c) => s + c.monto, 0))}</td>
        </tr>
      ))}
    </>
  )
}
