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
import { toggleChip, esSoloEste, tituloChip, PISTA_CTRL_CLICK } from "@/lib/ui/chips"
import { armarPlanilla, ordenarFilas, moverFilaPlanilla, resumenMes, linkTemplates, type EstadoCelda, type CuotaPlanilla, type CeldaCuota, type FilaPlanilla } from "@/lib/impuestos/planilla"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertaImpuestos } from "@/components/alerta-impuestos"
import { PapelInmobiliario } from "@/components/papel-inmobiliario"
import { cuentasRedVialDe, hectareasDe, papelDeTemplate, type TipoPapel } from "@/lib/impuestos/papel-inmobiliario"
import type { TipoCambio } from "@/lib/arrendamientos/calculo"
import { ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, GripVertical, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const plata = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** Planilla tipo Excel (usuario 2026-10-24): número completo, sin decimales. El tooltip lleva el exacto. */
const entero = (n: number) => Math.round(n).toLocaleString("es-AR")
const fecha = (iso: string) => iso.split("-").reverse().join("/")

/** Color de la celda según su estado (definición del usuario, punto 3). Fondo suave, como una planilla. */
const CLASE_CELDA: Record<EstadoCelda, string> = {
  // programado / echeq: cuenta como pagada, pero en un impuesto es raro → que salte a la vista.
  rara: "bg-amber-200 text-amber-950 font-semibold outline outline-2 -outline-offset-2 outline-amber-500",
  vencida: "bg-red-100 text-red-800 font-semibold",
  futura: "text-slate-500 italic",
  pagada: "bg-green-50 text-green-900",
  conciliada: "bg-green-200 text-green-950",
  vacia: "",
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
  // Chips de empresa: null = todas. Click prende/apaga, Ctrl+click deja sólo ésa (el gesto del Cash Flow).
  const [empresasVer, setEmpresasVer] = useState<Set<string> | null>(null)
  // 🏛️ Punto (5): el detalle de inmobiliario / Red Vial / automotores con el formato de su planilla.
  const [papel, setPapel] = useState<TipoPapel | null>(null)
  const [tcs, setTcs] = useState<TipoCambio[]>([])
  const [hectareas, setHectareas] = useState<Record<string, number>>({})
  const [cuentasRedVial, setCuentasRedVial] = useState<Record<string, string>>({})

  const cargar = useCallback(async () => {
    setError(null)
    try { setCuotas(await cargarCuotas()) } catch (e) { setError((e as Error).message) }
  }, [])
  // 🔄 Al volver a esta pestaña (ej. después de editar en Egresos sin Factura), recarga sola.
  useEffect(() => {
    if (!open) return
    const alVolver = () => { if (document.visibilityState === "visible") void cargar() }
    document.addEventListener("visibilitychange", alVolver)
    return () => document.removeEventListener("visibilitychange", alVolver)
  }, [open, cargar])
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
  const empresas = useMemo(() => planilla ? planilla.porEmpresa.map(e => e.empresa) : [], [planilla])
  const seVe = (empresa: string) => !empresasVer || empresasVer.has(empresa)
  const filasVisibles = filas.filter(f => seVe(f.empresa))
  const empresasVisibles = planilla ? planilla.porEmpresa.filter(e => seVe(e.empresa)) : []
  const filtrado = !!empresasVer && empresasVisibles.length < empresas.length
  const verEmpresa = (empresa: string, soloEsta: boolean) =>
    toggleChip<string>(upd => setEmpresasVer(prev => {
      const n = upd(prev ?? new Set(empresas))
      return n.size === empresas.length ? null : n
    }), empresa, soloEsta)
  // El total de abajo es el de lo que se ve: con todas, el de la planilla; filtrado, la suma de las empresas elegidas.
  const totalVisible = planilla && filtrado
    ? {
        porMes: MESES.map((_, i) => filasVisibles.reduce((s, f) => s + f.meses[i].reduce((t, c) => t + c.monto, 0), 0)),
        pagado: empresasVisibles.reduce((s, e) => s + e.pagado, 0),
        adeudado: empresasVisibles.reduce((s, e) => s + e.adeudado, 0),
        futuro: empresasVisibles.reduce((s, e) => s + e.futuro, 0),
        total: empresasVisibles.reduce((s, e) => s + e.total, 0),
      }
    : planilla ? { porMes: planilla.porMes, ...planilla.totales } : null

  const soltar = async (destino: string) => {
    if (!arrastrando || arrastrando === destino) { setArrastrando(null); return }
    // El orden completo (también las empresas ocultas por las chips), para que mover una fila no desordene las otras.
    // Entre empresas se mueve el bloque entero.
    const nuevo = moverFilaPlanilla(filas, arrastrando, destino)
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
      <DialogContent className="flex max-w-[99vw] w-[99vw] h-[96vh] max-h-[96vh] flex-col gap-2 overflow-hidden p-3">
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
              <Button size="sm" variant="outline" onClick={() => void cargar()} title="Vuelve a leer las cuotas (también lo hace solo al volver a esta pestaña)"><RefreshCw className="mr-1 h-4 w-4" />Actualizar</Button>
              <Button size="sm" variant="outline" onClick={() => setPapel("inmobiliario")} disabled={!cuotas}>🏛️ Inmobiliario · Red Vial · Automotores</Button>
              <Button size="sm" variant="outline" onClick={exportar} disabled={!planilla || !!sinDatos}><Download className="mr-1 h-4 w-4" />Excel</Button>
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Año calendario: cada cuota cae en el mes de su vencimiento; la celda suma las del mes (pasá el mouse para verlas). Arrastrá las filas para ordenarlas (sobre otra empresa, se mueve la empresa entera).
          </DialogDescription>
        </DialogHeader>

        <AlertaImpuestos compacta />

        {error && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">No se pudo leer las cuotas de impuestos: {error}</div>}
        {!planilla && !error && <p className="flex items-center gap-2 py-8 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Leyendo las cuotas…</p>}

        {planilla && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {empresas.length > 1 && (
                <span className="flex items-center gap-1" title={PISTA_CTRL_CLICK}>
                  {empresas.map(e => (
                    <button key={e} title={tituloChip(e)} onClick={ev => verEmpresa(e, esSoloEste(ev))}
                      className={`rounded-full border px-2 py-0.5 font-medium ${seVe(e) ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-500"}`}>{e}</button>
                  ))}
                  {filtrado && <button className="px-1 text-blue-700 hover:underline" onClick={() => setEmpresasVer(null)}>todas</button>}
                  <span className="mx-1 text-gray-300">|</span>
                </span>
              )}
              <span className="font-medium text-gray-600">Referencias:</span>
              <span className={`border px-1.5 ${CLASE_CELDA.conciliada}`}>conciliada</span>
              <span className={`border px-1.5 ${CLASE_CELDA.pagada}`}>pagada</span>
              <span className={`border px-1.5 ${CLASE_CELDA.futura}`}>sin pagar (presupuestada)</span>
              <span className={`border px-1.5 ${CLASE_CELDA.vencida}`}>vencida sin pagar</span>
              <span className={`border px-1.5 ${CLASE_CELDA.rara}`}>programado / echeq: revisar</span>
              <span className="text-gray-500"><span className="text-red-600">◢</span> en la esquina: el mes tiene cuotas pagadas y sin pagar</span>
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
              <div className="min-h-0 flex-1 overflow-auto rounded border">
                <table className="w-full border-collapse text-xs tabular-nums">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_0_#cbd5e1]">
                    <tr>
                      <th className="w-5" />
                      <th className="px-2 py-1 text-left">Impuesto</th>
                      <th className="px-2 py-1 text-left">Empresa</th>
                      {MESES.map(m => <th key={m} className="border-l px-1.5 py-1 text-right">{m}</th>)}
                      <th className="px-2 py-1 text-right">Pagado</th>
                      <th className="px-2 py-1 text-right">Adeudado</th>
                      <th className="px-2 py-1 text-right">Futuro</th>
                      <th className="px-2 py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasVisibles.map((f, i) => (
                      <FilaImpuesto key={f.clave} f={f} separa={i > 0 && filasVisibles[i - 1].empresa !== f.empresa} abierta={abiertas.has(f.clave)} arrastrada={arrastrando === f.clave}
                        abrirPapel={PAPEL_DE_IMPUESTO[f.impuesto] ? () => setPapel(PAPEL_DE_IMPUESTO[f.impuesto]) : undefined}
                        alternar={() => setAbiertas(s => { const n = new Set(s); if (n.has(f.clave)) n.delete(f.clave); else n.add(f.clave); return n })}
                        alEmpezar={() => setArrastrando(f.clave)} alSoltar={() => void soltar(f.clave)} />
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold">
                    {empresasVisibles.map(e => (
                      <tr key={e.empresa} className="border-t">
                        <td /><td className="px-2 py-1">Total</td><td className="px-2 py-1">{e.empresa}</td>
                        {MESES.map((_, i) => {
                          const n = filas.filter(f => f.empresa === e.empresa).reduce((s, f) => s + f.meses[i].reduce((t, c) => t + c.monto, 0), 0)
                          return <td key={i} className="whitespace-nowrap border-l px-1.5 py-1 text-right">{n ? entero(n) : ""}</td>
                        })}
                        <td className="whitespace-nowrap px-2 py-1 text-right">{entero(e.pagado)}</td>
                        <td className={`whitespace-nowrap px-2 py-1 text-right ${e.adeudado > 0 ? "text-red-700" : ""}`}>{entero(e.adeudado)}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right">{entero(e.futuro)}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right">{entero(e.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-400 text-sm">
                      <td /><td className="px-2 py-1" colSpan={2}>TOTAL {anio}{filtrado && <span className="font-normal text-gray-500"> · {empresasVisibles.map(e => e.empresa).join(", ")}</span>}</td>
                      {totalVisible!.porMes.map((n, i) => <td key={i} className="whitespace-nowrap border-l px-1.5 py-1 text-right">{n ? entero(n) : ""}</td>)}
                      <td className="whitespace-nowrap px-2 py-1 text-right">{entero(totalVisible!.pagado)}</td>
                      <td className={`whitespace-nowrap px-2 py-1 text-right ${totalVisible!.adeudado > 0 ? "text-red-700" : ""}`}>{entero(totalVisible!.adeudado)}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-right">{entero(totalVisible!.futuro)}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-right">{entero(totalVisible!.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {planilla.desactivadas.length > 0 && (
              <details className="rounded border border-dashed bg-gray-50/60">
                <summary className="cursor-pointer px-3 py-2 text-xs text-gray-600">
                  Templates dados de baja: {planilla.desactivadas.reduce((n, f) => n + f.meses.flat().length, 0)} cuota(s) sin pagar
                  por {entero(planilla.desactivadas.reduce((s, f) => s + f.total, 0))} — <b>no suman</b> en los totales; están para poder chequearlas.
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

/** 🔗 Abre Egresos sin Factura en una pestaña NUEVA, filtrado por esos templates (la planilla queda a la vista). */
function AbrirTemplates({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return (
    <button className="ml-1 inline-flex align-middle text-blue-700 hover:text-blue-900" title={`Abrir ${ids.length > 1 ? `sus ${ids.length} templates` : "el template"} en Egresos sin Factura (pestaña nueva)`}
      onClick={e => { e.stopPropagation(); window.open(linkTemplates(ids), "_blank", "noopener") }}>
      <ExternalLink className="h-3 w-3" />
    </button>
  )
}

/** Una celda = un número: la suma de las cuotas del mes. El detalle de cada cuota va en el tooltip. */
function CeldaMes({ cuotas }: { cuotas: CeldaCuota[] }) {
  const r = resumenMes(cuotas)
  if (r.estado === "vacia") return <td className="border-l" />
  const titulo = cuotas.map(c => `${c.template}${c.numero_cuota ? ` · cuota ${c.numero_cuota}` : ""} · vence ${fecha(c.vencimiento)} · $${plata(c.monto)} · ${rotulo(c)} (${c.estadoOriginal})`).join("\n")
    + (r.cantidad > 1 ? `\n— ${r.cantidad} cuotas · total $${plata(r.monto)}` : "")
  return (
    <td className={`relative whitespace-nowrap border-l px-1.5 py-1 text-right ${CLASE_CELDA[r.estado]}`} title={titulo}>
      {r.mixta && <span className="absolute right-0 top-0 text-[8px] leading-none text-red-600">◢</span>}
      {entero(r.monto)}
    </td>
  )
}

function FilaImpuesto({ f, separa, abierta, arrastrada, alternar, alEmpezar, alSoltar, abrirPapel }: {
  f: FilaPlanilla; separa?: boolean; abierta: boolean; arrastrada: boolean; alternar: () => void; alEmpezar: () => void; alSoltar: () => void; abrirPapel?: () => void
}) {
  // El desglose por template (partida, vehículo…): lo mismo, una fila por cada uno.
  const porTemplate = abierta ? f.templates.map(t => ({ t, meses: f.meses.map(m => m.filter(c => c.template === t)) })) : []
  return (
    <>
      <tr className={`${separa ? "border-t-2 border-t-slate-500" : "border-t"} hover:bg-slate-50 ${arrastrada ? "opacity-40" : ""}`}
        draggable onDragStart={alEmpezar} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); alSoltar() }}>
        <td className="cursor-grab px-0.5 py-1 text-slate-400" title="Arrastrá para ordenar"><GripVertical className="h-4 w-4" /></td>
        <td className="whitespace-nowrap px-2 py-1 font-medium">
          <button className="inline-flex items-center gap-1 text-left" onClick={alternar} title={`${f.templates.length} template(s): ${f.templates.join(", ")}`}>
            {abierta ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{f.impuesto}
            {f.templates.length > 1 && <span className="text-[10px] text-gray-400">({f.templates.length})</span>}
          </button>
          <AbrirTemplates ids={Object.values(f.ids)} />
          {abrirPapel && <button className="ml-1 text-[11px] text-blue-700 hover:underline" onClick={abrirPapel} title="Ver el detalle con el formato de la planilla">🏛️</button>}
        </td>
        <td className="px-2 py-1">{f.empresa}</td>
        {f.meses.map((m, i) => <CeldaMes key={i} cuotas={m} />)}
        <td className="whitespace-nowrap border-l px-2 py-1 text-right">{entero(f.pagado)}</td>
        <td className={`whitespace-nowrap px-2 py-1 text-right ${f.adeudado > 0 ? "font-semibold text-red-700" : ""}`}>{entero(f.adeudado)}</td>
        <td className="whitespace-nowrap px-2 py-1 text-right">{entero(f.futuro)}</td>
        <td className="whitespace-nowrap px-2 py-1 text-right font-semibold">{entero(f.total)}</td>
      </tr>
      {porTemplate.map(({ t, meses }) => (
        <tr key={t} className="bg-slate-50/60 text-[11px] text-gray-600">
          <td /><td className="whitespace-nowrap py-0.5 pl-6 pr-2" colSpan={2}>{t}{f.ids[t] && <AbrirTemplates ids={[f.ids[t]]} />}</td>
          {meses.map((m, i) => <CeldaMes key={i} cuotas={m} />)}
          <td colSpan={4} className="border-l px-2 text-right">{entero(meses.flat().reduce((s, c) => s + c.monto, 0))}</td>
        </tr>
      ))}
    </>
  )
}
