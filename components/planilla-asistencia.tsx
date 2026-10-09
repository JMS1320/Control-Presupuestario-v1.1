"use client"

/**
 * 🗓️ **Planilla de asistencia** (A-FEAT-1259, 2026-10-09) — Sueldos.
 *
 * Una fila por empleado con los días del mes. Se marcan sólo las excepciones (F · ½ · V · L) y «Llenar con P»
 * —por empleado— completa lo vacío con presente. Al lado, los francos trabajados que salen del cálculo
 * (`lib/sueldos/asistencia.ts`) y los que tiene hoy el sueldo: el mismo número por dos caminos.
 * «Pasar al sueldo» escribe en el período lo que corresponde a cada tipo —los FRANCOS trabajados a los de A + B +
 * francos; los DÍAS trabajados (admite ½) a los de jornal— y recalcula el bruto con la MISMA fórmula que el modal ✏️
 * (`lib/sueldos/bruto.ts`). Sólo en el mes de trabajo, como todo lo que modifica sueldos.
 */

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  MARCAS, etiquetaMarca, diasDelMes, tipoDia, enContrato, resumirMes, llenarCon, fmtFrancos,
  type Marca, type TipoDia,
} from "@/lib/sueldos/asistencia"
import { brutoDelPeriodo, type ParamsPeriodo } from "@/lib/sueldos/bruto"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

export interface PeriodoAsistencia extends ParamsPeriodo {
  id: string
  empleado_id: string
  bruto_calculado: number
  anticipos_descontados: number
  empleado: { nombre: string; tipo_empleado: string; fecha_ingreso?: string | null; fecha_egreso?: string | null }
}

interface Feriado { fecha: string; nombre: string; tipo: string; cuenta: boolean }

interface Props {
  abierto: boolean
  onCerrar: () => void
  anio: number
  mes: number
  periodos: PeriodoAsistencia[]
  /** Sólo el mes de trabajo modifica sueldos; la planilla se puede llenar igual. */
  esMesDeTrabajo: boolean
  onAplicado: () => void | Promise<void>
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const LETRA_DIA = ["D", "L", "M", "M", "J", "V", "S"]
/** Orden del clic sobre una celda: vacío → F → ½ → P → V → L → vacío. Las excepciones primero, que es lo que se marca. */
const CICLO: (Marca | undefined)[] = [undefined, "F", "M", "P", "V", "L"]
const fondoDia: Record<TipoDia, string> = { habil: "", sabado: "bg-amber-50", domingo: "bg-gray-100", feriado: "bg-rose-50" }
const colorMarca: Record<Marca, string> = {
  P: "text-gray-400", F: "text-red-700 font-bold", M: "text-orange-600 font-bold", V: "text-blue-700 font-bold", L: "text-purple-700 font-bold",
}
const fmtMoneda = (v: number) => v.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (n: number) => Math.round(n * 100) / 100

export function PlanillaAsistencia({ abierto, onCerrar, anio, mes, periodos, esMesDeTrabajo, onAplicado }: Props) {
  const dias = useMemo(() => diasDelMes(anio, mes), [anio, mes])
  const desde = dias[0], hasta = dias[dias.length - 1]
  const [marcas, setMarcas] = useState<Record<string, Record<string, Marca | undefined>>>({})
  const [guardadas, setGuardadas] = useState<Record<string, Record<string, Marca | undefined>>>({})
  const [feriados, setFeriados] = useState<Feriado[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarPase, setConfirmarPase] = useState(false)
  const [nuevoFeriado, setNuevoFeriado] = useState({ fecha: "", nombre: "" })

  const cargar = async () => {
    setCargando(true); setError(null)
    const ids = periodos.map(p => p.empleado_id)
    const [{ data: m, error: e1 }, { data: f, error: e2 }] = await Promise.all([
      ids.length ? supabase.from("sueldos_asistencia").select("empleado_id, fecha, marca").in("empleado_id", ids).gte("fecha", desde).lte("fecha", hasta)
                 : Promise.resolve({ data: [], error: null } as any),
      supabase.from("feriados").select("fecha, nombre, tipo, cuenta").gte("fecha", desde).lte("fecha", hasta).order("fecha"),
    ])
    if (e1 || e2) setError("No se pudo leer la planilla: " + (e1?.message || e2?.message))
    const porEmp: Record<string, Record<string, Marca | undefined>> = {}
    for (const r of (m || []) as { empleado_id: string; fecha: string; marca: Marca }[]) (porEmp[r.empleado_id] ||= {})[r.fecha] = r.marca
    setMarcas(structuredClone(porEmp)); setGuardadas(porEmp)
    setFeriados((f || []) as Feriado[])
    setCargando(false)
  }
  useEffect(() => { if (abierto) { setConfirmarPase(false); cargar() } }, [abierto, anio, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFeriadosQueCuentan = useMemo(() => new Set(feriados.filter(f => f.cuenta).map(f => f.fecha)), [feriados])
  const nombreFeriado = (fecha: string) => feriados.find(f => f.fecha === fecha)

  const cambios = useMemo(() => {
    const c: { empleado_id: string; fecha: string; marca?: Marca }[] = []
    for (const p of periodos) for (const d of dias) {
      const ahora = marcas[p.empleado_id]?.[d], antes = guardadas[p.empleado_id]?.[d]
      if (ahora !== antes) c.push({ empleado_id: p.empleado_id, fecha: d, marca: ahora })
    }
    return c
  }, [marcas, guardadas, periodos, dias])

  const marcar = (empId: string, fecha: string, m: Marca | undefined) =>
    setMarcas(prev => ({ ...prev, [empId]: { ...(prev[empId] || {}), [fecha]: m } }))
  const ciclar = (empId: string, fecha: string) => {
    const actual = marcas[empId]?.[fecha]
    marcar(empId, fecha, CICLO[(CICLO.indexOf(actual) + 1) % CICLO.length])
  }
  const tecla = (e: React.KeyboardEvent, empId: string, fecha: string) => {
    const k = e.key.toUpperCase()
    const m: Record<string, Marca | undefined> = { P: "P", F: "F", M: "M", "½": "M", "1": "M", V: "V", L: "L", DELETE: undefined, BACKSPACE: undefined }
    if (k in m) { e.preventDefault(); marcar(empId, fecha, m[k]) }
  }
  const llenar = (p: PeriodoAsistencia, marca: Marca) =>
    setMarcas(prev => ({ ...prev, [p.empleado_id]: { ...(prev[p.empleado_id] || {}), ...llenarCon(anio, mes, prev[p.empleado_id] || {}, p.empleado, marca) } }))
  const limpiar = (p: PeriodoAsistencia) => setMarcas(prev => ({ ...prev, [p.empleado_id]: {} }))

  const guardar = async () => {
    setGuardando(true); setError(null)
    const poner = cambios.filter(c => c.marca).map(c => ({ empleado_id: c.empleado_id, fecha: c.fecha, marca: c.marca, updated_at: new Date().toISOString() }))
    const sacar = cambios.filter(c => !c.marca)
    if (poner.length) {
      const { error: e } = await supabase.from("sueldos_asistencia").upsert(poner, { onConflict: "empleado_id,fecha" })
      if (e) { setError("No se guardó la planilla: " + e.message); setGuardando(false); return }
    }
    for (const c of sacar) {
      const { error: e } = await supabase.from("sueldos_asistencia").delete().eq("empleado_id", c.empleado_id).eq("fecha", c.fecha)
      if (e) { setError("No se pudo borrar una marca: " + e.message); setGuardando(false); return }
    }
    setGuardadas(structuredClone(marcas)); setGuardando(false)
  }

  // ── Resumen por empleado y lo que se pasaría al sueldo ──
  const filas = periodos.map(p => {
    const res = resumirMes(anio, mes, marcas[p.empleado_id] || {}, setFeriadosQueCuentan, p.empleado)
    // Qué va al sueldo según cómo cobra: francos (A + B + francos) o días (jornal). Los demás, sólo registro.
    const campo = p.empleado.tipo_empleado === "ab_francos" ? "francos_cantidad" as const
                : p.empleado.tipo_empleado === "por_dia" ? "dias_trabajados" as const : null
    const valor = campo === "francos_cantidad" ? res.francosTrabajados : res.diasTrabajados
    const enSueldo = !campo || p[campo] == null ? null : Number(p[campo])
    const distinto = !!campo && res.completo && (enSueldo == null || Math.abs(enSueldo - valor) > 0.001)
    const brutoNuevo = distinto ? brutoDelPeriodo(p.empleado.tipo_empleado, p, { [campo!]: valor }) : null
    return { p, res, campo, valor, enSueldo, distinto, brutoNuevo }
  })
  const aPasar = filas.filter(f => f.distinto && f.brutoNuevo != null)

  const pasarAlSueldo = async () => {
    setGuardando(true); setError(null)
    for (const f of aPasar) {
      const bruto = r2(f.brutoNuevo!)
      const { error: e } = await supabase.from("sueldos_periodos").update({
        [f.campo!]: f.valor, bruto_calculado: bruto, saldo_pendiente: r2(bruto - (f.p.anticipos_descontados ?? 0)),
      }).eq("id", f.p.id)
      if (e) { setError(`No se pasó el sueldo de ${f.p.empleado.nombre}: ${e.message}`); setGuardando(false); return }
    }
    setGuardando(false); setConfirmarPase(false)
    await onAplicado()
  }

  // ── Feriados del mes ──
  const alternarFeriado = async (f: Feriado) => {
    const { error: e } = await supabase.from("feriados").update({ cuenta: !f.cuenta }).eq("fecha", f.fecha)
    if (e) return setError("No se pudo cambiar el feriado: " + e.message)
    setFeriados(prev => prev.map(x => x.fecha === f.fecha ? { ...x, cuenta: !x.cuenta } : x))
  }
  const agregarFeriado = async () => {
    if (!nuevoFeriado.fecha || nuevoFeriado.fecha < desde || nuevoFeriado.fecha > hasta) return setError("El feriado tiene que ser una fecha de este mes.")
    const { error: e } = await supabase.from("feriados").upsert({ fecha: nuevoFeriado.fecha, nombre: nuevoFeriado.nombre.trim() || "Feriado", tipo: "manual", cuenta: true })
    if (e) return setError("No se pudo agregar el feriado: " + e.message)
    setNuevoFeriado({ fecha: "", nombre: "" }); await cargar()
  }
  const quitarFeriado = async (f: Feriado) => {
    const { error: e } = await supabase.from("feriados").delete().eq("fecha", f.fecha)
    if (e) return setError("No se pudo quitar el feriado: " + e.message)
    setFeriados(prev => prev.filter(x => x.fecha !== f.fecha))
  }

  const hayCambios = cambios.length > 0

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-[98vw] w-[98vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🗓️ Planilla de asistencia — {MESES[mes - 1]} {anio}</DialogTitle>
        </DialogHeader>
        <TestsDelProceso proceso="sueldos/asistencia" pantalla="sueldos" />

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span>Marcá sólo las excepciones (clic en la celda para cambiarla, o tecleá la letra):</span>
          {MARCAS.map(m => <span key={m.marca} title={m.titulo}><b className={colorMarca[m.marca]}>{m.etiqueta}</b> {m.titulo.split(" (")[0].toLowerCase()}</span>)}
          <span className="ml-2"><span className="inline-block w-3 h-3 bg-amber-50 border align-middle" /> sábado (medio día)</span>
          <span><span className="inline-block w-3 h-3 bg-gray-100 border align-middle" /> domingo</span>
          <span><span className="inline-block w-3 h-3 bg-rose-50 border align-middle" /> feriado</span>
        </div>

        {error && <div className="p-2 rounded bg-red-50 border border-red-300 text-sm text-red-700">⚠ {error}</div>}
        {cargando ? <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /> Cargando…</div> : (
          <div className="overflow-x-auto border rounded">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 bg-gray-50 px-2 py-1 text-left min-w-[150px]">Empleado</th>
                  {dias.map(d => {
                    const t = tipoDia(d, setFeriadosQueCuentan), fer = nombreFeriado(d)
                    return (
                      <th key={d} className={`px-0.5 py-1 w-7 text-center font-normal ${fondoDia[t]}`} title={fer ? `${fer.nombre}${fer.cuenta ? "" : " (no cuenta)"}` : undefined}>
                        <div className="text-[10px] text-gray-500">{LETRA_DIA[new Date(d + "T00:00:00Z").getUTCDay()]}</div>
                        <div className={fer ? "text-rose-700 font-bold" : ""}>{Number(d.slice(8))}</div>
                      </th>
                    )
                  })}
                  <th className="px-2 py-1 text-right" title="Francos que le correspondían por los sábados, domingos y feriados del mes">Corresp.</th>
                  <th className="px-2 py-1 text-right" title="Francos que se tomó (F = 1, ½ = medio)">Tomados</th>
                  <th className="px-2 py-1 text-right bg-green-50" title="Lo que va al sueldo: francos trabajados (corresponden − tomados; negativo resta) o, en los de jornal, los días trabajados">Va al sueldo</th>
                  <th className="px-2 py-1 text-right" title="Lo que tiene hoy el período de sueldo">En el sueldo</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ p, res, campo, enSueldo, distinto }) => (
                  <tr key={p.id} className="border-t">
                    <td className="sticky left-0 bg-white px-2 py-1">
                      <div className="font-medium">{p.empleado.nombre}</div>
                      <div className="flex gap-1 mt-0.5">
                        <button className="text-[10px] px-1.5 rounded bg-green-100 hover:bg-green-200 text-green-800" onClick={() => llenar(p, "P")} title="Pone P en los días vacíos de este empleado">Llenar con P</button>
                        <button className="text-[10px] px-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700" onClick={() => llenar(p, "F")} title="Al revés: marcaste los días que vino y el resto es franco — pone F en los vacíos">Llenar con F</button>
                        <button className="text-[10px] px-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600" onClick={() => limpiar(p)} title="Vacía la fila (no se guarda hasta «Guardar»)">Limpiar</button>
                      </div>
                    </td>
                    {dias.map(d => {
                      const t = tipoDia(d, setFeriadosQueCuentan)
                      if (!enContrato(d, p.empleado)) return <td key={d} className="text-center text-gray-300 bg-gray-50" title="Fuera de su contrato">—</td>
                      const m = marcas[p.empleado_id]?.[d]
                      const cambiada = m !== guardadas[p.empleado_id]?.[d]
                      return (
                        <td key={d} className={`p-0 text-center border-l ${fondoDia[t]}`}>
                          <button onClick={() => ciclar(p.empleado_id, d)} onKeyDown={e => tecla(e, p.empleado_id, d)}
                            className={`w-7 h-7 focus:outline focus:outline-2 focus:outline-blue-500 ${m ? colorMarca[m] : ""} ${cambiada ? "underline decoration-blue-500" : ""}`}
                            title={MARCAS.find(x => x.marca === m)?.titulo ?? "Sin marcar"}>
                            {etiquetaMarca(m) || <span className="text-gray-200">·</span>}
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-2 text-right">{fmtFrancos(res.corresponden)}</td>
                    <td className="px-2 text-right">{fmtFrancos(res.tomados)}</td>
                    <td className={`px-2 text-right font-bold bg-green-50 ${campo === "francos_cantidad" && res.francosTrabajados < 0 ? "text-red-700" : ""}`}>
                      {!res.completo ? <span className="text-amber-600 font-normal" title="Hay días sin marcar">faltan {res.sinMarcar} días</span>
                        : campo === "dias_trabajados" ? <span title="Cobra por jornal: van los DÍAS trabajados (no francos)">{fmtFrancos(res.diasTrabajados)} días</span>
                        : campo === "francos_cantidad" ? fmtFrancos(res.francosTrabajados)
                        : <span className="font-normal text-gray-400" title="Su sueldo no usa francos ni días: sólo registro">{fmtFrancos(res.diasTrabajados)} días</span>}
                    </td>
                    <td className="px-2 text-right">
                      {!campo ? <span className="text-gray-400" title="Su sueldo no usa francos ni días">—</span>
                        : <>{enSueldo == null ? "vacío" : fmtFrancos(enSueldo)}{campo === "dias_trabajados" ? " días" : ""} {res.completo && (distinto ? <span className="text-amber-600" title="La planilla y el sueldo no coinciden">≠</span> : <span className="text-green-600">✓</span>)}</>}
                    </td>
                    <td className="px-2 text-gray-500 whitespace-nowrap">{res.vacaciones ? `V ${res.vacaciones} ` : ""}{res.licencias ? `L ${res.licencias}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={guardar} disabled={!hayCambios || guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Guardar planilla{hayCambios ? ` (${cambios.length} cambios)` : ""}
          </Button>
          <Button variant="outline" onClick={() => setConfirmarPase(true)}
            disabled={!aPasar.length || hayCambios || !esMesDeTrabajo || guardando}
            title={!esMesDeTrabajo ? "Sólo en el mes de trabajo de sueldos" : hayCambios ? "Primero guardá la planilla" : !aPasar.length ? "No hay nada distinto para pasar (o el mes está incompleto)" : undefined}>
            Pasar al sueldo{aPasar.length ? ` (${aPasar.length})` : ""}
          </Button>
          {!esMesDeTrabajo && <span className="text-xs text-gray-500">La planilla se puede llenar; pasar al sueldo sólo en el mes de trabajo.</span>}
        </div>

        {confirmarPase && (
          <div className="p-3 rounded border border-blue-300 bg-blue-50 text-sm space-y-1">
            <div className="font-semibold">Se van a cambiar estos sueldos:</div>
            {aPasar.map(f => (
              <div key={f.p.id}>
                <b>{f.p.empleado.nombre}</b>: {f.campo === "dias_trabajados" ? "días trabajados" : "francos"} {f.enSueldo == null ? "vacío" : fmtFrancos(f.enSueldo)} → <b>{fmtFrancos(f.valor)}</b>
                {" · "}bruto {fmtMoneda(Number(f.p.bruto_calculado) || 0)} → <b>{fmtMoneda(r2(f.brutoNuevo!))}</b>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={pasarAlSueldo} disabled={guardando}>Confirmar</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmarPase(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="border-t pt-2">
          <div className="text-sm font-semibold mb-1">Feriados de {MESES[mes - 1].toLowerCase()}</div>
          {feriados.length === 0 && <div className="text-xs text-gray-500">Ninguno cargado.</div>}
          <div className="space-y-1">
            {feriados.map(f => (
              <div key={f.fecha} className="flex items-center gap-2 text-xs">
                <span className="w-20">{f.fecha.split("-").reverse().join("/")}</span>
                <span className={f.cuenta ? "" : "line-through text-gray-400"}>{f.nombre}</span>
                <span className="text-gray-400">({f.tipo})</span>
                <button className="underline text-blue-700" onClick={() => alternarFeriado(f)}>{f.cuenta ? "no contarlo" : "contarlo como feriado"}</button>
                {f.tipo === "manual" && <button className="underline text-red-700" onClick={() => quitarFeriado(f)}>quitar</button>}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Input type="date" className="h-8 w-40" value={nuevoFeriado.fecha} min={desde} max={hasta} onChange={e => setNuevoFeriado(v => ({ ...v, fecha: e.target.value }))} />
            <Input className="h-8 w-60" placeholder="Nombre (opcional)" value={nuevoFeriado.nombre} onChange={e => setNuevoFeriado(v => ({ ...v, nombre: e.target.value }))} />
            <Button size="sm" variant="outline" onClick={agregarFeriado}>Agregar feriado</Button>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Los puentes turísticos vienen cargados pero <b>no cuentan</b>: si se dio el día, tocá «contarlo como feriado».</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
