"use client"

/**
 * 📍 **A-FEAT-1660 — el arranque del presupuesto, el PUENTE hasta hoy y lo impago vencido**, a la vista.
 *
 * Acordado con JMS el 25/11: el arranque es siempre con fecha (la que declara él, con su composición: cuenta
 * corriente + FCI + otros; o el último saldo conciliado del extracto). Si arranca del extracto, lo pagado y
 * cobrado según el sistema entre esa fecha y hoy se muestra renglón por renglón (el puente). Toda la cuenta
 * vive en `lib/presupuesto/arranque.ts`; acá sólo se muestra.
 */
import { Fragment, useState } from "react"
import { hoyArgentina } from "@/lib/fechas"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fechaDeCaja, mesDe, type FilaReal, type ResultadoArranque } from "@/lib/presupuesto/arranque"

const $ = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`
const fecha = (f: string) => f ? f.split("-").reverse().join("/") : "—"
const parseAR = (t: string) => parseFloat(String(t).replace(/\./g, "").replace(",", ".")) || 0
const fmtAR = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface ComposicionItem { cuenta: string; monto: number }

export function PresupuestoArranque(p: {
  modo: "manual" | "ultimo_conciliado"
  resultado: ResultadoArranque | null
  /** Saldo del último movimiento conciliado (para el control de las dos fuentes), aunque el modo sea manual. */
  extracto: { saldo: number; fecha: string } | null
  /** Con modo manual: lo declarado. */
  declarado: { saldo: number; fecha: string | null; composicion: ComposicionItem[] | null }
  /** Lo que se devuelve al mes actual (ya pagado y contado en el saldo). */
  ajusteMesActual: { total: number; cuotas: number; facturas: number }
  /** Control: el extracto llevado a hoy contra lo declarado (sólo si hay las dos fuentes y lo declarado es de hoy). */
  control: { diferencia: number; cierra: boolean; desdeExtracto: number; puenteNeto: number } | null
  onGuardarDeclarado: (d: { fecha: string; composicion: ComposicionItem[] }) => Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState(false)
  const [fechaTxt, setFechaTxt] = useState("")
  const [filas, setFilas] = useState<{ cuenta: string; monto: string }[]>([])
  const [guardando, setGuardando] = useState(false)

  const empezarEdicion = () => {
    const comp = p.declarado.composicion?.length
      ? p.declarado.composicion
      : [{ cuenta: "Cuenta corriente Galicia", monto: p.declarado.saldo || 0 }, { cuenta: "FCI", monto: 0 }]
    setFilas(comp.map(c => ({ cuenta: c.cuenta, monto: fmtAR(Number(c.monto) || 0) })))
    setFechaTxt(p.declarado.fecha || hoyArgentina())
    setEditando(true)
  }
  const totalEdicion = filas.reduce((s, f) => s + parseAR(f.monto), 0)

  const r = p.resultado
  // Con el extracto atrasado, el control de las dos fuentes es información, no alarma (JMS 25/11: la diferencia de
  // $ 173,8 M era casi toda FCI y transferencias propias que el sistema no registra).
  const diasAtraso = p.extracto ? Math.floor((Date.parse(hoyArgentina() + "T00:00:00") - Date.parse(p.extracto.fecha + "T00:00:00")) / 86400000) : 0
  const extractoAtrasado = diasAtraso > 7
  return (
    <div className="mb-3 rounded-lg border border-slate-300 bg-slate-50 text-sm">
      <button type="button" onClick={() => setAbierto(a => !a)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left">
        {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-semibold">📍 Arranque del saldo</span>
        {r ? (
          <span className="text-gray-600">
            {r.fuente === "extracto" ? "del extracto" : "declarado"} · {$(r.saldoArranque)} al {fecha(r.fechaArranque)}
            {r.puente.filas.length > 0 && <> · puente {$(r.puente.neto)}</>}
            {" "}→ <strong>saldo de hoy {$(r.saldoHoy)}</strong>
            {r.vencidos.egresos > 0 && <span className="text-amber-700"> · pagos vencidos {$(r.vencidos.egresos)}</span>}
            {r.vencidos.ingresos > 0 && <span className="text-emerald-700"> · cobros vencidos {$(r.vencidos.ingresos)}</span>}
            {p.control && !p.control.cierra && !extractoAtrasado && <span className="text-red-700"> · ⚠️ las dos fuentes difieren {$(p.control.diferencia)}</span>}
            {p.control?.cierra && <span className="text-emerald-700"> · ✓ las dos fuentes coinciden</span>}
          </span>
        ) : (
          <span className="text-amber-700">
            {p.modo === "manual" ? "falta la FECHA del saldo declarado: cargala para que el presupuesto no reste dos veces lo ya pagado" : "no hay extracto conciliado"}
          </span>
        )}
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-slate-200 px-3 py-3">
          {/* Lo declarado: fecha + composición */}
          {p.modo === "manual" && (
            <div>
              <div className="mb-1 font-medium">Saldo declarado {p.declarado.fecha ? `al ${fecha(p.declarado.fecha)}` : "(sin fecha)"}</div>
              {!editando ? (
                <div className="flex flex-wrap items-center gap-3">
                  {(p.declarado.composicion?.length ? p.declarado.composicion : [{ cuenta: "Total", monto: p.declarado.saldo }]).map((c, i) => (
                    <span key={i} className="rounded bg-white px-2 py-0.5 shadow-sm">{c.cuenta}: <strong>{$(c.monto)}</strong></span>
                  ))}
                  <Button size="sm" variant="outline" className="h-7" onClick={empezarEdicion}>Editar fecha y composición</Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-28 text-xs text-gray-600">Fecha del saldo</span>
                    <Input type="date" className="h-7 w-40" value={fechaTxt} onChange={e => setFechaTxt(e.target.value)} />
                  </div>
                  {filas.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="h-7 w-56" value={f.cuenta} placeholder="Cuenta (ej. FCI Galicia)"
                        onChange={e => setFilas(fs => fs.map((x, j) => j === i ? { ...x, cuenta: e.target.value } : x))} />
                      <Input type="text" className="h-7 w-40 text-right" value={f.monto} placeholder="0,00"
                        onChange={e => setFilas(fs => fs.map((x, j) => j === i ? { ...x, monto: e.target.value } : x))} />
                      <button type="button" className="text-xs text-gray-500 underline" onClick={() => setFilas(fs => fs.filter((_, j) => j !== i))}>quitar</button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <button type="button" className="text-xs text-blue-700 underline" onClick={() => setFilas(fs => [...fs, { cuenta: "", monto: "" }])}>＋ otra cuenta</button>
                    <span className="text-xs">Total: <strong>{$(totalEdicion)}</strong></span>
                    <Button size="sm" className="h-7" disabled={!fechaTxt || guardando} onClick={async () => {
                      setGuardando(true)
                      try {
                        await p.onGuardarDeclarado({
                          fecha: fechaTxt,
                          composicion: filas.filter(f => f.cuenta.trim() || parseAR(f.monto)).map(f => ({ cuenta: f.cuenta.trim() || "Sin nombre", monto: parseAR(f.monto) })),
                        })
                        setEditando(false)
                      } finally { setGuardando(false) }
                    }}>Guardar</Button>
                    <button type="button" className="text-xs text-gray-500 underline" onClick={() => setEditando(false)}>cancelar</button>
                  </div>
                  <p className="text-xs text-gray-500">Los fondos comunes van sumados: la plata está disponible. Si alguno es en dólares, cargalo en pesos.</p>
                </div>
              )}
            </div>
          )}

          {r && (
            <>
              {/* La cuenta, en escalones */}
              <table className="text-xs">
                <tbody>
                  <tr><td className="pr-4">Saldo de arranque ({r.fuente === "extracto" ? "extracto" : "declarado"}) al {fecha(r.fechaArranque)}</td><td className="text-right">{$(r.saldoArranque)}</td></tr>
                  {r.fuente === "extracto" && <>
                    <tr><td className="pr-4">− Pagado según el sistema desde el {fecha(r.fechaArranque)} ({r.puente.filas.filter(f => f.debitos).length})</td><td className="text-right text-red-700">− {$(r.puente.egresos)}</td></tr>
                    <tr><td className="pr-4">+ Cobrado según el sistema ({r.puente.filas.filter(f => f.creditos).length})</td><td className="text-right text-emerald-700">+ {$(r.puente.ingresos)}</td></tr>
                  </>}
                  <tr className="font-semibold"><td className="pr-4">= Saldo estimado de hoy</td><td className="text-right">{$(r.saldoHoy)}</td></tr>
                  <tr><td className="pr-4">− Pagos vencidos de meses anteriores, impagos ({r.vencidos.filas.filter(f => f.debitos).length}) — se restan en el mes actual</td><td className="text-right text-amber-700">− {$(r.vencidos.egresos)}</td></tr>
                  <tr><td className="pr-4">+ Cobros vencidos de meses anteriores, sin cobrar ({r.vencidos.filas.filter(f => f.creditos).length}) — se suman en el mes actual</td><td className="text-right text-emerald-700">+ {$(r.vencidos.ingresos)}</td></tr>
                  <tr><td className="pr-4">+ Ya pagado este mes que el presupuesto igual restaba ({p.ajusteMesActual.cuotas} cuotas, {p.ajusteMesActual.facturas} facturas)</td><td className="text-right">+ {$(p.ajusteMesActual.total)}</td></tr>
                </tbody>
              </table>
              {p.control && (
                <div className={`rounded px-2 py-1 text-xs ${p.control.cierra ? "bg-emerald-50 text-emerald-800" : extractoAtrasado ? "bg-slate-100 text-slate-700" : "bg-red-50 text-red-800"}`}>
                  {p.control.cierra ? "✓ El extracto llevado a hoy coincide con el saldo declarado." : <>
                    {extractoAtrasado ? "ℹ️" : "⚠️"} Control de las dos fuentes: extracto {$(p.extracto ? p.extracto.saldo : 0)} al {fecha(p.extracto ? p.extracto.fecha : "")}
                    {" "}{p.control.puenteNeto < 0 ? "−" : "+"} {$(Math.abs(p.control.puenteNeto))} de puente (lo pagado y cobrado según el sistema) = {$(p.control.desdeExtracto)} estimado hoy,
                    {" "}contra {$(p.declarado.saldo)} declarado → diferencia <strong>{$(p.control.diferencia)}</strong>.
                    {extractoAtrasado
                      ? <> Con el extracto atrasado {diasAtraso} días no sirve como alarma: la diferencia es sobre todo plata que entró desde el FCI y transferencias entre cuentas propias, que el sistema no registra. Se vuelve un control cuando el extracto esté al día.</>
                      : <> Es lo que el banco movió y el sistema no tiene (comisiones, impuestos al débito, débitos automáticos, movimientos con el FCI) — lo que falta conciliar.</>}
                  </>}
                </div>
              )}
              {r.otraCuenta.cantidad > 0 && (
                <p className="text-xs text-gray-500">{r.otraCuenta.cantidad} renglones se pagan desde otra cuenta (cajas, cotitulares): no mueven este saldo ({$(r.otraCuenta.neto)}).</p>
              )}
              <Detalle titulo="Puente: lo pagado y cobrado desde el arranque" filas={r.puente.filas} />
              <Detalle titulo="Pagos vencidos de meses anteriores (impagos)" filas={r.vencidos.filas.filter(f => Number(f.debitos) > 0)} />
              <Detalle titulo="Cobros vencidos de meses anteriores (sin cobrar)" filas={r.vencidos.filas.filter(f => Number(f.creditos) > 0)} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Detalle de renglones; con 15 o más, agrupado por mes, cada grupo con cantidad y subtotal. */
function Detalle({ titulo, filas }: { titulo: string; filas: FilaReal[] }) {
  const [abierto, setAbierto] = useState(false)
  const [grupos, setGrupos] = useState<Record<string, boolean>>({})
  if (filas.length === 0) return null
  const total = filas.reduce((s, f) => s + (Number(f.creditos) || 0) - (Number(f.debitos) || 0), 0)
  const porMes: Record<string, FilaReal[]> = {}
  for (const f of filas) (porMes[mesDe(fechaDeCaja(f))] ??= []).push(f)
  const agrupar = filas.length >= 15
  const Renglon = ({ f }: { f: FilaReal }) => (
    <tr className="border-t border-slate-100">
      <td className="pr-3">{fecha(fechaDeCaja(f))}</td>
      <td className="pr-3">{f.origen}</td>
      <td className="pr-3">{f.nombre_proveedor || "—"}</td>
      <td className="max-w-[28rem] truncate pr-3" title={f.detalle}>{f.detalle}</td>
      <td className="pr-3">{f.estado}</td>
      <td className="text-right">{$((Number(f.creditos) || 0) - (Number(f.debitos) || 0))}</td>
    </tr>
  )
  return (
    <div>
      <button type="button" className="flex items-center gap-1 text-xs font-medium" onClick={() => setAbierto(a => !a)}>
        {abierto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {titulo}: {filas.length} · {$(total)}
      </button>
      {abierto && (
        <table className="mt-1 w-full text-xs">
          <thead><tr className="text-left text-gray-500"><th>Fecha</th><th>Origen</th><th>Proveedor</th><th>Detalle</th><th>Estado</th><th className="text-right">Importe</th></tr></thead>
          <tbody>
            {agrupar
              ? Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b)).map(([mes, fs]) => (
                  <Fragment key={mes}>
                    <tr className="cursor-pointer bg-slate-100 font-medium" onClick={() => setGrupos(g => ({ ...g, [mes]: !g[mes] }))}>
                      <td colSpan={5}>{grupos[mes] ? "▾" : "▸"} {mes.split("-").reverse().join("/")} · {fs.length}</td>
                      <td className="text-right">{$(fs.reduce((s, f) => s + (Number(f.creditos) || 0) - (Number(f.debitos) || 0), 0))}</td>
                    </tr>
                    {grupos[mes] && fs.map(f => <Renglon key={f.id} f={f} />)}
                  </Fragment>
                ))
              : filas.map(f => <Renglon key={f.id} f={f} />)}
          </tbody>
        </table>
      )}
    </div>
  )
}
