"use client"

/**
 * 👥 Los datos de la vista «Por responsable» y de la cuenta entre socios — A-FEAT-1637. SÓLO LEE.
 *
 * Lee una sola vez, desde el 01/01/2025 (la cuenta entre socios arranca el 31/12/2024 en 0) hasta el fin del período elegido,
 * todos los canales en pesos de las TRES empresas (`lib/dashboard/leer-responsable.ts`), y atribuye cada movimiento
 * (`lib/dashboard/responsable.ts`). La vista toma el período; la cuenta, todo hasta el fin del período.
 *
 * ⚠️ Lee canales de las tres empresas desde el navegador: hoy es para admin (candado `dashboard.por-responsable`). Para un rol que
 * sólo ve su empresa (MA) hará falta una ruta del servidor — próxima etapa, anotada en A-FEAT-1637.
 */
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { leerDatosPorResponsable, type DatosPorResponsable } from "@/lib/dashboard/leer-responsable"
import { atribuirTodo, controlPorResponsable, cuentaEntreSocios, CUENTA_DESDE, type Atribuidos, type ControlResponsable, type CuentaPar } from "@/lib/dashboard/responsable"

export function periodoDashboard(año: number, semestre?: number): { desde: string; hasta: string } {
  return { desde: semestre === 2 ? `${año}-07-01` : `${año}-01-01`, hasta: semestre === 1 ? `${año}-06-30` : `${año}-12-31` }
}

export function useDashboardPorResponsable(año: number, semestre: number | undefined, habilitado: boolean) {
  const { desde, hasta } = periodoDashboard(año, semestre)
  const [datos, setDatos] = useState<DatosPorResponsable | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!habilitado) return
    let vigente = true
    setLoading(true); setError(null)
    leerDatosPorResponsable(supabase, CUENTAS_BANCARIAS, desde < CUENTA_DESDE ? desde : CUENTA_DESDE, hasta)
      .then(d => { if (vigente) setDatos(d) })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (vigente) setLoading(false) })
    return () => { vigente = false }
  }, [desde, hasta, habilitado])

  const calculo = useMemo((): { at: Atribuidos; control: ControlResponsable; cuentas: CuentaPar[] } | null => {
    if (!datos) return null
    const at = atribuirTodo(datos.movs, datos.cuentas, datos.templates, datos.ctx)
    const delPeriodo = datos.movs.filter(m => { const f = String(m.fecha).slice(0, 10); return f >= desde && f <= hasta })
    return {
      at,
      control: controlPorResponsable(at, delPeriodo, desde, hasta, datos.cuentas, datos.templates),
      cuentas: cuentaEntreSocios(at, hasta, datos.desdeCanal),
    }
  }, [datos, desde, hasta])

  return { datos, calculo, loading, error, desde, hasta }
}
