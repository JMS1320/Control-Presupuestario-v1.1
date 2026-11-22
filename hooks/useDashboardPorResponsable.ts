"use client"

/**
 * 👥 Los datos de la vista «Por responsable» y de la cuenta entre socios — A-FEAT-1637. SÓLO LEE.
 *
 * ⚠️ cambió 22/11 noche (etapa B3, JMS: «ella debería ver todas sus cuentas»): antes leía los canales de las tres empresas desde el
 * navegador (sólo servía para admin). Ahora pide todo ARMADO a `/api/dashboard-responsable`: admin recibe las empresas de los chips
 * y todas las cuentas; cualquier otro rol (o admin en «Ver como lo ve ella», `comoMA`) recibe sólo lo de MA. Un solo cálculo, en el
 * servidor (`lib/dashboard/responsable.ts`).
 */
import { useEffect, useState } from "react"
import type { ResultadoPorResponsable } from "@/lib/dashboard/responsable"

export function periodoDashboard(año: number, semestre?: number): { desde: string; hasta: string } {
  return { desde: semestre === 2 ? `${año}-07-01` : `${año}-01-01`, hasta: semestre === 1 ? `${año}-06-30` : `${año}-12-31` }
}

export function useDashboardPorResponsable(año: number, semestre: number | undefined, empresas: readonly string[], comoMA: boolean, habilitado = true) {
  const [resultado, setResultado] = useState<ResultadoPorResponsable | null>(null)
  const [problemas, setProblemas] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clave = [...empresas].sort().join(",")

  useEffect(() => {
    if (!habilitado || !clave) return
    let vigente = true
    setLoading(true); setError(null)
    const q = new URLSearchParams({ anio: String(año), empresas: clave })
    if (semestre) q.set("semestre", String(semestre))
    if (comoMA) q.set("como", "ma")
    fetch(`/api/dashboard-responsable?${q}`)
      .then(async r => {
        const j = await r.json().catch(() => null)
        if (!r.ok || !j?.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
        if (vigente) { setResultado(j.datos as ResultadoPorResponsable); setProblemas(j.problemas ?? []) }
      })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (vigente) setLoading(false) })
    return () => { vigente = false }
  }, [año, semestre, clave, comoMA, habilitado])

  return { resultado, problemas, loading, error }
}
