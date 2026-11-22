"use client"

import { useState, useEffect } from "react"
import { supabase, type CuentaContable } from "@/lib/supabase"
import { traerTodo } from "@/lib/supabase-paginado"
import { avisarSiIncompleta } from "@/lib/ui/avisar-lectura"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { canalesDelDashboard, type CanalDashboard } from "@/lib/dashboard/canales"
import { armarResumenFinanciero, type InfoTemplate, type ResumenFinanciero, type Clasificacion } from "@/lib/dashboard/resumen"
import { controlDelDashboard, type CanalLeido, type ControlDashboard } from "@/lib/dashboard/control"

// El tipo y el cálculo viven en `lib/dashboard/resumen.ts` (A-FEAT-1637); se re-exporta para quien lo importaba de acá.
export type { ResumenFinanciero } from "@/lib/dashboard/resumen"

/** Un movimiento leído, con de qué canal y empresa vino (para el detalle del Excel). */
export type MovimientoDashboard = Record<string, any> & { _canal: string; _empresa: string }

/**
 * Los datos del Dashboard.
 *
 * 📊 A-FEAT-1637 (JMS 22/11): `empresas` = las empresas de los chips. Cada una suma **todos sus canales en pesos** del registro
 * único (`CUENTAS_BANCARIAS`): bancos, cajas, tarjetas y echeqs — ver `lib/dashboard/canales.ts`. Sin el parámetro = MSA, que
 * era lo que mostraba antes (ahora con todos sus canales, no sólo el banco).
 */
export function useFinancialData(año: number, semestre?: number, empresas: readonly string[] = ["MSA"]) {
  const [cuentas, setCuentas] = useState<CuentaContable[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoDashboard[]>([])
  const [resumen, setResumen] = useState<ResumenFinanciero[]>([])
  const [fuera, setFuera] = useState<Array<{ mov: MovimientoDashboard; clasificacion: Clasificacion }>>([])
  const [control, setControl] = useState<ControlDashboard | null>(null)
  const [canales, setCanales] = useState<CanalDashboard[]>([])
  const [templates, setTemplates] = useState<Map<string, InfoTemplate>>(new Map())
  const [loading, setLoading] = useState(true)
  const claveEmpresas = [...empresas].sort().join(",")

  useEffect(() => {
    let vigente = true
    async function fetchData() {
      setLoading(true)

      try {
        const { data: cuentasData, error: cuentasError } = await supabase.from("cuentas_contables").select("*")
        if (cuentasError) {
          console.error("Error al obtener cuentas contables:", cuentasError)
          return
        }

        let fechaInicio = `${año}-01-01`
        let fechaFin = `${año}-12-31`
        if (semestre === 1) fechaFin = `${año}-06-30`
        else if (semestre === 2) fechaInicio = `${año}-07-01`

        // Templates con su agrupadora, tipo y flag multi-cuenta.
        // Sin filtrar por `activo`: un movimiento histórico de un template dado de baja igual
        // tiene que clasificar bien (si no, cae al plan de cuentas o al signo del monto).
        const { data: allTemplates, error: templatesError } = await supabase
          .from("egresos_sin_factura")
          .select("id, nombre_referencia, cuenta_agrupadora, es_multi_cuenta, tipo")
        if (templatesError) console.error("Error al obtener templates:", templatesError)

        const templateMap = new Map<string, InfoTemplate>()
        ;(allTemplates || []).forEach((t: any) => templateMap.set(t.id, {
          nombre: t.nombre_referencia,
          agrupadora: t.cuenta_agrupadora || null,
          esMulti: !!t.es_multi_cuenta,
          tipo: t.tipo || null,
        }))

        // 🏦 Todos los canales en pesos de las empresas elegidas. Cada uno se lee de a tandas (A-BUG-1379: la base corta en
        // 1.000) y, si no llega entero o falla, se avisa y se marca en el control: el resto sigue.
        const elegidos = canalesDelDashboard(CUENTAS_BANCARIAS, claveEmpresas ? claveEmpresas.split(",") : [])
        const leidos = await Promise.all(elegidos.map(async (canal): Promise<{ canal: CanalDashboard; movs: MovimientoDashboard[]; leido: CanalLeido }> => {
          const cli = () => (canal.schema !== "public" ? supabase.schema(canal.schema) : supabase)
          const r = await traerTodo<any>((d, h) => cli()
            .from(canal.tabla)
            .select("*", { count: "exact" })
            .gte("fecha", fechaInicio)
            .lte("fecha", fechaFin)
            .not("categ", "is", null)
            .order("id").range(d, h))
          avisarSiIncompleta(`Dashboard · ${canal.nombre}`, r)
          // Los del período SIN categoría: no entran en la tabla, pero se cuentan (nada se descarta en silencio).
          const sc = await cli().from(canal.tabla).select("id", { count: "exact", head: true })
            .gte("fecha", fechaInicio).lte("fecha", fechaFin).is("categ", null)
          if (sc.error) console.error(`Dashboard · ${canal.nombre} (sin categoría):`, sc.error.message)
          const movs = (r.data || []).map((m: any) => ({ ...m, _canal: canal.nombre, _empresa: canal.empresa }))
          return {
            canal, movs,
            leido: {
              nombre: canal.nombre, empresa: canal.empresa, movimientos: movs,
              sinCateg: sc.error ? null : (sc.count ?? 0),
              incompleta: !!r.error || (r.esperadas != null && r.esperadas !== r.data.length),
            },
          }
        }))
        if (!vigente) return

        const todos = leidos.flatMap(l => l.movs)
        const armado = armarResumenFinanciero(todos, cuentasData || [], templateMap)
        setCuentas(cuentasData || [])
        setTemplates(templateMap)
        setCanales(elegidos)
        setMovimientos(todos)
        setResumen(armado.resumen)
        setFuera(armado.fuera as Array<{ mov: MovimientoDashboard; clasificacion: Clasificacion }>)
        setControl(controlDelDashboard(armado.resumen, leidos.map(l => l.leido), armado.fuera.map(f => f.clasificacion.monto)))
      } catch (error) {
        console.error("Error general en fetchData:", error)
      } finally {
        if (vigente) setLoading(false)
      }
    }

    fetchData()
    return () => { vigente = false }
  }, [año, semestre, claveEmpresas])

  return { cuentas, movimientos, resumen, fuera, control, canales, templates, loading }
}
