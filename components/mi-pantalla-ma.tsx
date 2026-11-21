"use client"

/**
 * 👤 LA PANTALLA DE MA (Mercedes Areco) — A-FEAT-1634. Tres bloques del Principal, SÓLO LECTURA:
 *   · 🧾 Mis impuestos del año (MA; MSA y PAM para mirar)
 *   · 🌾 Mis arrendamientos
 *   · 📈 Lo que viene (próximos 12 meses)
 *
 * Cada uno lee de `/api/mi-pantalla` (servidor, filtrado a MA) y dibuja lo que arma `lib/ma/mi-pantalla.ts`. Ninguno
 * escribe nada. Se muestran donde el rol los tiene prendidos (`vista-inicio.tsx`, con el candado del modo permisos).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { hoyArgentina } from "@/lib/fechas"
import {
  EMPRESAS_MI_PANTALLA, type BloqueMiPantalla, type ContratoMA, type EmpresaMiPantalla, type EstadoCuotaMA, type EstadoImpuesto,
  type LoQueViene, type MesDeImpuestos, type MisArrendamientos, type MisImpuestos,
} from "@/lib/ma/mi-pantalla"

const plata = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/")
const diaMes = (iso: string) => fecha(iso).slice(0, 5)
const num = (n: number, d = 2) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })

/** Lee un bloque. `clave` cambia → vuelve a leer (año, empresa). */
function useBloque<T>(que: BloqueMiPantalla, params: Record<string, string> = {}) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const query = new URLSearchParams({ que, ...params }).toString()
  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const r = await fetch(`/api/mi-pantalla?${query}`)
      const j = await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))
      if (!j.ok) throw new Error(j.error ?? `Error ${r.status}`)
      setDatos(j.datos as T)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [query])
  useEffect(() => { void cargar() }, [cargar])
  return { datos, error, cargando }
}

/** El ✓ discreto o la alerta grande del control (§ 🧮). */
function Control({ control }: { control: { cierra: boolean; diferencias: string[] } }) {
  if (control.cierra) return <p className="text-right text-[11px] text-muted-foreground" title="Las partes suman el total que muestra el bloque">✓ los números cierran</p>
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
      ⚠️ Los números de este bloque no cierran entre sí — avisale a JMS:
      <ul className="mt-1 list-disc pl-4">{control.diferencias.map(d => <li key={d}>{d}</li>)}</ul>
    </div>
  )
}

function Cifra({ titulo, monto, tono }: { titulo: string; monto: number; tono: "verde" | "rojo" | "gris" | "azul" | "ambar" }) {
  const t = {
    verde: "border-green-200 bg-green-50 text-green-900",
    rojo: "border-red-200 bg-red-50 text-red-900",
    gris: "border-slate-200 bg-slate-50 text-slate-800",
    azul: "border-sky-200 bg-sky-50 text-sky-900",
    ambar: "border-amber-200 bg-amber-50 text-amber-900",
  }[tono]
  return (
    <div className={`rounded-lg border px-3 py-2 ${t}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-75">{titulo}</p>
      <p className="text-sm font-semibold tabular-nums sm:text-base">$ {plata(monto)}</p>
    </div>
  )
}

function Cabecera({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-base font-semibold">{titulo}</p>
        {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
      </div>
      {children}
    </div>
  )
}

const Cargando = () => <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
const Falla = ({ texto }: { texto: string }) => <p className="py-2 text-sm text-red-700">⚠️ {texto}</p>

// ═══════════════════════════════════════ 🧾 MIS IMPUESTOS DEL AÑO ═══════════════════════════════════════

const CHIP_IMPUESTO: Record<EstadoImpuesto, { texto: string; clase: string }> = {
  pagado: { texto: "Pagado", clase: "bg-green-100 text-green-800 border-green-200" },
  vencido: { texto: "Vencido", clase: "bg-red-100 text-red-800 border-red-200" },
  "a-vencer": { texto: "A vencer", clase: "bg-slate-100 text-slate-700 border-slate-200" },
  parcial: { texto: "Parte pagado", clase: "bg-amber-100 text-amber-900 border-amber-200" },
  revisar: { texto: "Pagado · revisar", clase: "bg-amber-100 text-amber-900 border-amber-300" },
}
const Chip = ({ clase, texto }: { clase: string; texto: string }) => (
  <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${clase}`}>{texto}</span>
)

function MesImpuestos({ mes, abiertoInicial }: { mes: MesDeImpuestos; abiertoInicial: boolean }) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  const [detalle, setDetalle] = useState<string | null>(null)
  const vencidos = mes.renglones.filter(r => r.estado === "vencido").length
  const resumen = mes.pendiente <= 0.01 ? <Chip {...CHIP_IMPUESTO.pagado} texto="Todo pagado" />
    : vencidos ? <Chip {...CHIP_IMPUESTO.vencido} texto={`${vencidos} vencido${vencidos > 1 ? "s" : ""}`} />
    : <Chip {...CHIP_IMPUESTO["a-vencer"]} texto={`Falta $ ${plata(mes.pendiente)}`} />
  return (
    <div className="rounded-lg border">
      <button type="button" onClick={() => setAbierto(a => !a)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40">
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? "" : "-rotate-90"}`} />
        <span className="font-medium">{mes.nombre}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">{mes.renglones.length} impuesto{mes.renglones.length > 1 ? "s" : ""}</span>
        <span className="ml-auto flex items-center gap-2">
          {resumen}
          <span className="font-semibold tabular-nums">$ {plata(mes.total)}</span>
        </span>
      </button>
      {abierto && (
        <ul className="divide-y border-t">
          {mes.renglones.map(r => {
            const varias = r.cuotas.length > 1
            const ve = detalle === r.clave
            return (
              <li key={r.clave} className="px-3 py-2 text-sm">
                <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${varias ? "cursor-pointer" : ""}`} onClick={() => varias && setDetalle(ve ? null : r.clave)}>
                  <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{diaMes(r.vencimiento)}</span>
                  <span className="min-w-0 flex-1 font-medium">
                    {r.impuesto}
                    {varias && <span className="ml-1 text-xs font-normal text-muted-foreground">({r.cuotas.length}) {ve ? "▴" : "▾"}</span>}
                  </span>
                  <Chip {...CHIP_IMPUESTO[r.estado]} />
                  <span className="w-32 text-right font-semibold tabular-nums">$ {plata(r.monto)}</span>
                </div>
                {ve && (
                  <ul className="mt-1 space-y-0.5 border-l-2 border-muted pl-3 text-xs sm:ml-14">
                    {r.cuotas.map(c => (
                      <li key={c.id} className="flex flex-wrap items-center gap-x-2">
                        <span className="tabular-nums text-muted-foreground">{diaMes(c.vencimiento)}</span>
                        <span className="min-w-0 flex-1">{c.template}{c.numero_cuota ? ` · cuota ${c.numero_cuota}` : ""}</span>
                        <span className={c.estado === "vencido" ? "text-red-700" : c.estado === "a-vencer" ? "text-slate-500" : "text-green-700"}>{CHIP_IMPUESTO[c.estado].texto}</span>
                        <span className="w-28 text-right tabular-nums">$ {plata(c.monto)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function MisImpuestosMA() {
  const hoy = hoyArgentina()
  const [empresa, setEmpresa] = useState<EmpresaMiPantalla>("MA")
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)))
  const { datos, error, cargando } = useBloque<MisImpuestos>("impuestos", { empresa, anio: String(anio) })
  const mesHoy = Number(hoy.slice(5, 7))
  const esteAnio = anio === Number(hoy.slice(0, 4))
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Cabecera titulo="🧾 Mis impuestos del año" subtitulo={empresa === "MA" ? "Lo tuyo, mes por mes: lo pagado, lo vencido y lo que viene." : `Los de ${empresa}, sólo para mirar.`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border">
              {EMPRESAS_MI_PANTALLA.map(e => (
                <button key={e} type="button" onClick={() => setEmpresa(e)}
                  className={`px-3 py-1 text-xs font-medium ${empresa === e ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>{e}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setAnio(a => a - 1)} aria-label="Año anterior"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="w-12 text-center text-sm font-semibold tabular-nums">{anio}</span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setAnio(a => a + 1)} aria-label="Año siguiente"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </Cabecera>
        {cargando && !datos && <Cargando />}
        {error && <Falla texto={error} />}
        {datos && !error && (
          datos.meses.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No hay impuestos de {datos.empresa} cargados para {datos.anio}.
              {datos.aniosConDatos.length > 0 && <> Hay datos de {datos.aniosConDatos.join(", ")}.</>}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Cifra titulo="Pagado" monto={datos.totales.pagado} tono="verde" />
                <Cifra titulo="Vencido sin pagar" monto={datos.totales.vencido} tono={datos.totales.vencido > 0 ? "rojo" : "gris"} />
                <Cifra titulo="A vencer" monto={datos.totales.aVencer} tono="gris" />
                <Cifra titulo={`Total ${datos.anio}`} monto={datos.totales.total} tono="azul" />
              </div>
              <div className={`space-y-2 ${cargando ? "opacity-60" : ""}`}>
                {datos.meses.map(m => (
                  <MesImpuestos key={`${datos.empresa}-${datos.anio}-${m.mes}`} mes={m}
                    abiertoInicial={esteAnio ? m.mes === mesHoy || m.mes === mesHoy + 1 || m.renglones.some(r => r.estado === "vencido") : false} />
                ))}
              </div>
              <Control control={datos.control} />
            </>
          )
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════ 🌾 MIS ARRENDAMIENTOS ═══════════════════════════════════════

const CHIP_CUOTA: Record<EstadoCuotaMA, { texto: string; clase: string }> = {
  cobrada: { texto: "Cobrada", clase: "bg-green-100 text-green-800 border-green-200" },
  parcial: { texto: "Cobrada en parte", clase: "bg-amber-100 text-amber-900 border-amber-200" },
  "a-cobrar": { texto: "A cobrar", clase: "bg-slate-100 text-slate-700 border-slate-200" },
  vencida: { texto: "Atrasada", clase: "bg-red-100 text-red-800 border-red-200" },
}

function Contrato({ k }: { k: ContratoMA }) {
  const [verFacturas, setVerFacturas] = useState(false)
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold">Campaña {k.campania} · {k.cliente}</p>
        <p className="text-xs text-muted-foreground">{num(k.has)} ha · {num(k.qqHa)} qq/ha · {k.grano} · {num(k.tons, 1)} t en total</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra titulo="Esperado" monto={k.esperado} tono="gris" />
        <Cifra titulo="Facturado" monto={k.facturado} tono="azul" />
        <Cifra titulo="Cobrado" monto={k.cobrado} tono="verde" />
        <Cifra titulo="Falta cobrar" monto={k.faltaCobrar} tono={k.faltaCobrar > 0 ? "ambar" : "verde"} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Cuota</th><th className="py-1 pr-2 font-medium">Cobro</th>
              <th className="py-1 pr-2 text-right font-medium">qq/ha</th><th className="py-1 pr-2 text-right font-medium">Tons</th>
              <th className="py-1 pr-2 text-right font-medium">Importe</th><th className="py-1 text-right font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {k.cuotas.map(c => (
              <tr key={c.numero} className="border-b last:border-0">
                <td className="py-1.5 pr-2">{c.numero}</td>
                <td className="py-1.5 pr-2 tabular-nums">{fecha(c.fecha)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{num(c.qqHa)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums" title={c.tonsFijadas > 0 ? `${num(c.tonsFijadas, 3)} t ya vendidas (fijadas)` : "Sin vender todavía"}>
                  {num(c.tons, 1)}{c.tonsFijadas > 0 && c.tonsFijadas < c.tons - 0.001 ? <span className="text-xs text-muted-foreground"> ({num(c.tonsFijadas, 1)} fij.)</span> : null}
                </td>
                <td className="py-1.5 pr-2 text-right font-medium tabular-nums" title={c.estimado ? "Estimado: falta fijar precio o tipo de cambio" : "Firme"}>
                  {c.estimado ? "≈ " : ""}$ {plata(c.monto)}
                </td>
                <td className="py-1.5 text-right"><Chip {...CHIP_CUOTA[c.estado]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {k.porCobrar.length > 0 && (
        <div className="rounded-md bg-amber-50/60 p-2 text-sm">
          <p className="mb-1 text-xs font-medium text-amber-900">Lo que falta cobrar</p>
          <ul className="space-y-0.5">
            {k.porCobrar.map(p => (
              <li key={`${p.concepto}-${p.fecha}`} className="flex flex-wrap items-center gap-x-3">
                <span className={`w-20 tabular-nums ${p.vencido ? "text-red-700" : "text-muted-foreground"}`}>{fecha(p.fecha)}</span>
                <span className="min-w-0 flex-1">{p.concepto}{p.vencido ? " · atrasado" : ""}</span>
                <span className="font-semibold tabular-nums">$ {plata(p.monto)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {k.comprobantes.length > 0 ? (
        <div>
          <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setVerFacturas(v => !v)}>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verFacturas ? "" : "-rotate-90"}`} />
            {k.comprobantes.length} comprobante{k.comprobantes.length > 1 ? "s" : ""} de esta campaña
          </button>
          {verFacturas && (
            <ul className="mt-1 space-y-0.5 text-xs">
              {k.comprobantes.map(c => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 rounded px-1 py-0.5 hover:bg-muted/40">
                  <span className="w-20 tabular-nums text-muted-foreground">{fecha(c.fecha)}</span>
                  <span className="min-w-0 flex-1">{c.rotulo} {c.numero ?? ""}{c.porFecha ? <span className="text-muted-foreground" title="No está vinculado a una venta: se ubicó en la campaña por su fecha"> · por fecha</span> : null}</span>
                  <span className="tabular-nums">$ {plata(c.total)}</span>
                  <span className="w-36 text-right tabular-nums text-green-800">cobrado $ {plata(c.cobrado)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : <p className="text-xs text-muted-foreground">Todavía no hay comprobantes de esta campaña.</p>}
    </div>
  )
}

export function MisArrendamientosMA() {
  const { datos, error, cargando } = useBloque<MisArrendamientos>("arrendamientos")
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Cabecera titulo="🌾 Mis arrendamientos" subtitulo="Tus contratos: lo que se espera cobrar, lo facturado, lo cobrado y lo que falta, con sus fechas." />
        {cargando && !datos && <Cargando />}
        {error && <Falla texto={error} />}
        {datos && !error && (
          datos.contratos.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No hay contratos de arrendamiento activos a tu nombre.</p>
          ) : (
            <>
              {datos.contratos.length > 1 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Cifra titulo="Esperado (todas)" monto={datos.totales.esperado} tono="gris" />
                  <Cifra titulo="Facturado" monto={datos.totales.facturado} tono="azul" />
                  <Cifra titulo="Cobrado" monto={datos.totales.cobrado} tono="verde" />
                  <Cifra titulo="Falta cobrar" monto={datos.totales.faltaCobrar} tono={datos.totales.faltaCobrar > 0 ? "ambar" : "verde"} />
                </div>
              )}
              <div className="space-y-3">{datos.contratos.map(k => <Contrato key={k.id} k={k} />)}</div>
              {datos.sinContrato.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  ℹ️ {datos.sinContrato.length} comprobante{datos.sinContrato.length > 1 ? "s" : ""} sin contrato que le corresponda (otro cliente u otra campaña):{" "}
                  {datos.sinContrato.map(c => `${c.rotulo} ${fecha(c.fecha)} $ ${plata(c.total)}`).join(" · ")}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">≈ = estimado con el precio de la posición y el tipo de cambio proyectado, hasta que se fija la venta. Lo cobrado incluye las retenciones que te hicieron.</p>
              <Control control={datos.control} />
            </>
          )
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════ 📈 LO QUE VIENE ═══════════════════════════════════════

export function LoQueVieneMA() {
  const { datos, error, cargando } = useBloque<LoQueViene>("lo-que-viene")
  const [abierto, setAbierto] = useState<string | null>(null)
  const maximo = useMemo(() => datos ? Math.max(1, ...datos.meses.flatMap(m => [m.ingresos, m.egresos])) : 1, [datos])
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Cabecera titulo="📈 Lo que viene" subtitulo="Los próximos 12 meses: lo que entra de tus arrendamientos y lo que sale en impuestos." />
        {cargando && !datos && <Cargando />}
        {error && <Falla texto={error} />}
        {datos && !error && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Cifra titulo="Entra" monto={datos.totales.ingresos} tono="verde" />
              <Cifra titulo="Sale" monto={datos.totales.egresos} tono="rojo" />
              <Cifra titulo="Queda" monto={datos.totales.neto} tono={datos.totales.neto >= 0 ? "azul" : "ambar"} />
            </div>
            {(datos.atrasado.ingresos > 0 || datos.atrasado.egresos > 0) && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Atrasado (ya tendría que haber pasado): entra $ {plata(datos.atrasado.ingresos)} · sale $ {plata(datos.atrasado.egresos)}. Está sumado en los totales.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">Mes</th>
                    <th className="py-1 pr-2 text-right font-medium">Entra</th>
                    <th className="py-1 pr-2 text-right font-medium">Sale</th>
                    <th className="py-1 pr-2 text-right font-medium">Queda</th>
                    <th className="py-1 text-right font-medium">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.meses.map(m => {
                    const ve = abierto === m.mes
                    const hay = m.detalleIngresos.length + m.detalleEgresos.length > 0
                    return (
                      <FilaMes key={m.mes} m={m} ve={ve} hay={hay} maximo={maximo} alternar={() => setAbierto(ve ? null : m.mes)} />
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">Es una proyección: los arrendamientos van estimados hasta que se fija la venta, y los impuestos con lo que tienen cargado sus cuotas.</p>
            <Control control={datos.control} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function FilaMes({ m, ve, hay, maximo, alternar }: { m: LoQueViene["meses"][number]; ve: boolean; hay: boolean; maximo: number; alternar: () => void }) {
  return (
    <>
      <tr className={`border-b ${hay ? "cursor-pointer hover:bg-muted/40" : ""}`} onClick={() => hay && alternar()}>
        <td className="py-1.5 pr-2">
          <span className="flex items-center gap-1">
            {hay ? <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${ve ? "" : "-rotate-90"}`} /> : <span className="w-3.5" />}
            {m.nombre}
          </span>
        </td>
        <td className="py-1.5 pr-2 text-right tabular-nums text-green-800">
          {m.ingresos ? plata(m.ingresos) : "—"}
          {m.ingresos > 0 && <div className="ml-auto mt-0.5 h-1 rounded bg-green-400" style={{ width: `${Math.max(4, (m.ingresos / maximo) * 100)}%` }} />}
        </td>
        <td className="py-1.5 pr-2 text-right tabular-nums text-red-800">
          {m.egresos ? plata(m.egresos) : "—"}
          {m.egresos > 0 && <div className="ml-auto mt-0.5 h-1 rounded bg-red-300" style={{ width: `${Math.max(4, (m.egresos / maximo) * 100)}%` }} />}
        </td>
        <td className={`py-1.5 pr-2 text-right font-medium tabular-nums ${m.neto < 0 ? "text-red-700" : ""}`}>{plata(m.neto)}</td>
        <td className={`py-1.5 text-right tabular-nums ${m.acumulado < 0 ? "text-red-700" : "text-muted-foreground"}`}>{plata(m.acumulado)}</td>
      </tr>
      {ve && (
        <tr className="border-b bg-muted/20">
          <td colSpan={5} className="px-3 py-2 text-xs">
            {[...m.detalleIngresos.map(d => ({ ...d, entra: true })), ...m.detalleEgresos.map(d => ({ ...d, entra: false }))]
              .sort((a, b) => a.fecha.localeCompare(b.fecha))
              .map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-12 tabular-nums text-muted-foreground">{diaMes(d.fecha)}</span>
                  <span className="min-w-0 flex-1">{d.concepto}</span>
                  <span className={`tabular-nums ${d.entra ? "text-green-800" : "text-red-800"}`}>{d.entra ? "+" : "−"} $ {plata(d.monto)}</span>
                </div>
              ))}
          </td>
        </tr>
      )}
    </>
  )
}
