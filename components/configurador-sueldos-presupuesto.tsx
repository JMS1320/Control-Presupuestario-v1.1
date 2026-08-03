"use client"

// Presupuesto → Sueldos.
//
// Acá el usuario pone el sueldo mensual de cada empleado y el sistema arma el resto: francos,
// premio anual, aguinaldo y cargas sociales.
//
// Por qué existe esta pantalla: el presupuesto tomaba los sueldos de `sueldos_periodos` (los
// períodos de liquidación). Los futuros estaban generados con el monto congelado y TRES empleados
// en $0, así que el bloque mostraba ~la mitad de lo que cuesta la plantilla. El usuario lo
// resolvió de la manera más simple: *"yo pongo cuánto de SUSS y de sueldos presupuestar y listo,
// doy el punto de arranque"*.
//
// No se liquida con estos números: son sólo proyección.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Users, AlertTriangle, TrendingUp } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import {
  proyectarEmpleado, proyectarSuss, faltantesSueldos, valorFranco,
  type EmpleadoPresupuesto, type ParametrosSueldos,
} from "@/lib/presupuesto/sueldos"

const MESES_TXT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

/** Los 12 meses que se proyectan, desde el actual. Mismo criterio que el resto del presupuesto. */
function mesesDesdeHoy(cantidad = 12) {
  const hoy = new Date()
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
  })
}

export function ConfiguradorSueldosPresupuesto({ onCambio }: { onCambio?: () => void } = {}) {
  const [cargando, setCargando] = useState(true)
  const [empleados, setEmpleados] = useState<EmpleadoPresupuesto[]>([])
  const [params, setParams] = useState<ParametrosSueldos>({
    ipcEscalonMeses: null, inflacionMensual: 0, sussBase: null,
  })
  const meses = useMemo(() => mesesDesdeHoy(12), [])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [emp, cfg] = await Promise.all([
        supabase.from("sueldos_empleados")
          .select("id, nombre, empresa, sueldo_presupuesto, francos_dias_promedio, premio_mes, premio_multiplo")
          .neq("activo", false).order("nombre"),
        supabase.from("presupuesto_config")
          .select("inflacion_mensual, ipc_escalon_meses, suss_base").eq("empresa", "MSA").maybeSingle(),
      ])
      setEmpleados(((emp.data || []) as any[]).map(e => ({
        id: String(e.id), nombre: String(e.nombre), empresa: e.empresa,
        sueldo_presupuesto: e.sueldo_presupuesto == null ? null : Number(e.sueldo_presupuesto),
        francos_dias_promedio: e.francos_dias_promedio == null ? null : Number(e.francos_dias_promedio),
        premio_mes: e.premio_mes == null ? null : Number(e.premio_mes),
        premio_multiplo: e.premio_multiplo == null ? null : Number(e.premio_multiplo),
      })))
      setParams({
        ipcEscalonMeses: cfg.data?.ipc_escalon_meses ?? null,
        inflacionMensual: Number(cfg.data?.inflacion_mensual) || 0,
        sussBase: cfg.data?.suss_base == null ? null : Number(cfg.data.suss_base),
      })
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardarEmpleado = async (id: string, cambios: Partial<EmpleadoPresupuesto>) => {
    setEmpleados(prev => prev.map(e => (e.id === id ? { ...e, ...cambios } : e)))
    const { error } = await supabase.from("sueldos_empleados").update(cambios).eq("id", id)
    if (error) { alert("Error: " + error.message); await cargar() }
  }

  const guardarParam = async (cambios: Partial<{ ipc_escalon_meses: number | null; suss_base: number | null }>) => {
    const { error } = await supabase.from("presupuesto_config")
      .upsert({ empresa: "MSA", ...cambios, updated_at: new Date().toISOString() }, { onConflict: "empresa" })
    if (error) { alert("Error: " + error.message) }
    await cargar()
    onCambio?.()
  }

  const proyeccion = useMemo(() => {
    const porMes: Record<string, number> = {}
    for (const e of empleados) {
      for (const l of proyectarEmpleado(e, meses, params)) {
        porMes[l.clave] = (porMes[l.clave] || 0) + l.total
      }
    }
    const suss = proyectarSuss(meses, params)
    for (const s of suss) porMes[s.clave] = (porMes[s.clave] || 0) + s.monto
    return { porMes, suss }
  }, [empleados, meses, params])

  const faltantes = useMemo(() => faltantesSueldos(empleados, params), [empleados, params])
  const totalAnual = Object.values(proyeccion.porMes).reduce((a, b) => a + b, 0)

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo la plantilla…
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Sueldos del presupuesto
        </CardTitle>
        <p className="mt-1 text-xs text-gray-500">
          El presupuesto representa <strong>la plantilla completa</strong>: no se ajusta por altas
          ni bajas. Se pone el sueldo de cada uno y el resto sale solo — francos, premio, aguinaldo
          y cargas sociales. <strong>No se liquida con estos números</strong>: son proyección.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {faltantes.length > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-medium text-amber-900">
              <AlertTriangle className="mr-1 inline h-3 w-3" /> Falta para que el número cierre
            </p>
            <ul className="mt-0.5 space-y-0.5 text-[11px] text-amber-800">
              {faltantes.map((f, i) => <li key={i}>· {f}</li>)}
            </ul>
          </div>
        )}

        {/* Parámetros generales */}
        <div className="flex flex-wrap items-end gap-4 rounded border bg-gray-50 px-3 py-2">
          <div>
            <label className="block text-[10px] text-gray-500"
              title="Cada cuántos meses se actualizan los sueldos. Aplica a toda la plantilla.">
              Actualizar cada (meses) <span className="text-gray-300">ⓘ</span>
            </label>
            <Input className="h-7 w-20 text-right text-xs" placeholder="—"
              defaultValue={params.ipcEscalonMeses != null ? String(params.ipcEscalonMeses) : ""}
              onBlur={e => guardarParam({
                ipc_escalon_meses: e.target.value.trim() === "" ? null : Math.round(parseNumeroAR(e.target.value)),
              })} />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500"
              title="Cargas sociales del primer mes proyectado. De ahí sube igual que los sueldos.">
              Cargas sociales — 1er mes <span className="text-gray-300">ⓘ</span>
            </label>
            <Input className="h-7 w-32 text-right text-xs" placeholder="0,00"
              defaultValue={params.sussBase != null ? fmtNumeroAR(params.sussBase) : ""}
              onBlur={e => guardarParam({
                suss_base: e.target.value.trim() === "" ? null : parseNumeroAR(e.target.value),
              })} />
          </div>
          <p className="text-[10px] text-gray-500">
            Inflación mensual en uso: <strong>{(params.inflacionMensual * 100).toFixed(1)} %</strong>
            {params.ipcEscalonMeses
              ? ` · sube en escalones cada ${params.ipcEscalonMeses} meses`
              : " · sin escalón definido, los sueldos quedan quietos"}
          </p>
        </div>

        {/* Plantilla */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50 text-[10px] text-gray-500">
                <th className="px-2 py-1.5 text-left font-medium">Empleado</th>
                <th className="px-2 py-1.5 text-right font-medium">Sueldo mensual (A+B)</th>
                <th className="px-2 py-1.5 text-right font-medium">Francos (días)</th>
                <th className="px-2 py-1.5 text-center font-medium">Premio: mes</th>
                <th className="px-2 py-1.5 text-right font-medium">× sueldos</th>
                <th className="px-2 py-1.5 text-right font-medium">Costo del 1er mes</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map(e => {
                const lineas = proyectarEmpleado(e, meses, params)
                const primera = lineas[0]
                return (
                  <tr key={e.id} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1.5">
                      {e.nombre}
                      {e.empresa && (
                        <Badge variant="outline" className="ml-1 text-[9px] text-gray-500">{e.empresa}</Badge>
                      )}
                      {(e.sueldo_presupuesto ?? 0) <= 0 && (
                        <span className="ml-1 text-[10px] text-amber-600">sin sueldo</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input className="h-6 w-28 text-right text-xs" placeholder="0,00"
                        defaultValue={e.sueldo_presupuesto != null ? fmtNumeroAR(e.sueldo_presupuesto) : ""}
                        onBlur={ev => guardarEmpleado(e.id, {
                          sueldo_presupuesto: ev.target.value.trim() === "" ? null : parseNumeroAR(ev.target.value),
                        })} />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input className="h-6 w-16 text-right text-xs" placeholder="0"
                        defaultValue={e.francos_dias_promedio != null ? String(e.francos_dias_promedio) : ""}
                        onBlur={ev => guardarEmpleado(e.id, {
                          francos_dias_promedio: ev.target.value.trim() === "" ? null : Math.round(parseNumeroAR(ev.target.value)),
                        })} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <select className="h-6 rounded border px-1 text-xs"
                        defaultValue={e.premio_mes != null ? String(e.premio_mes) : ""}
                        onChange={ev => guardarEmpleado(e.id, {
                          premio_mes: ev.target.value === "" ? null : Number(ev.target.value),
                        })}>
                        <option value="">—</option>
                        {MESES_TXT.map((t, i) => <option key={i} value={i + 1}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input className="h-6 w-16 text-right text-xs" placeholder="—"
                        defaultValue={e.premio_multiplo != null ? fmtNumeroAR(e.premio_multiplo, 2) : ""}
                        onBlur={ev => guardarEmpleado(e.id, {
                          premio_multiplo: ev.target.value.trim() === "" ? null : parseNumeroAR(ev.target.value),
                        })} />
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-700" title={primera?.detalle}>
                      {primera ? pesos(primera.total) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Cómo evoluciona */}
        <div className="rounded border border-blue-200 bg-blue-50/50 px-2 py-2">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-blue-900">
            <TrendingUp className="h-3 w-3" /> Cómo evoluciona en los 12 meses
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-blue-700">
                  <th className="px-1 py-0.5 text-left">Mes</th>
                  {meses.map(m => (
                    <th key={`${m.anio}-${m.mes}`} className="px-1 py-0.5 text-right">
                      {MESES_TXT[m.mes - 1]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="text-blue-900">
                  <td className="px-1 py-0.5 font-medium">Sueldos + SUSS</td>
                  {meses.map(m => {
                    const k = `${m.anio}-${String(m.mes).padStart(2, "0")}`
                    const conAguinaldo = m.mes === 6 || m.mes === 12
                    const conSac = m.mes === 1 || m.mes === 7
                    return (
                      <td key={k} className={`px-1 py-0.5 text-right ${conAguinaldo || conSac ? "font-semibold" : ""}`}
                        title={conAguinaldo ? "Lleva aguinaldo" : conSac ? "Lleva el +50 % de cargas por el aguinaldo" : undefined}>
                        {pesos(proyeccion.porMes[k] || 0)}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[10px] text-blue-700">
            Los meses en negrita son los que llevan algo extra: <strong>junio y diciembre</strong> el
            aguinaldo, <strong>enero y julio</strong> el +50 % de cargas sociales (un mes después).
            Total de los 12 meses: <strong>{pesos(totalAnual)}</strong>.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
