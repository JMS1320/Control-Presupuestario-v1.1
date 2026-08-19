"use client"

// Cuántos pendientes vivos tiene cada solapa (P-46, etapa 4).
//
// Alimenta el contador del `TabsList` de `dashboard.tsx`. Vive en un hook y no en el componente
// porque `dashboard.tsx` es el ESQUELETO de la app: si esto falla, no puede llevarse la navegación
// puesta. Por eso todo error se traga y devuelve un mapa vacío → los badges simplemente no aparecen.

import { useEffect, useState } from "react"

/** `{ cashflow: 25, extracto: 50, … }`. Vacío = no se pudo leer, y no se muestra nada. */
export type ConteoPantallas = Record<string, { total: number; urgentes: number }>

export function usePendientesPorPantalla(activo: boolean): ConteoPantallas {
  const [conteo, setConteo] = useState<ConteoPantallas>({})

  useEffect(() => {
    if (!activo) return
    let vivo = true
    ;(async () => {
      try {
        const r = await fetch('/api/pendientes?rol=admin')
        if (!r.ok) return
        const d = await r.json()
        const out: ConteoPantallas = {}
        for (const p of (d.pendientes ?? [])) {
          // El contador de la solapa cuenta SÓLO los que tienen esa marca — decisión del usuario.
          // Los `@general` (aplican a todas) y los sin revisar no se suman: inflarían las 12 por
          // igual y el número dejaría de decir dónde hay trabajo.
          // Tampoco los hechos, ni los de las secciones C/D (dudosos e histórico).
          if (['hecho', 'auditar', 'obsoleto'].includes(p.grupo)) continue
          for (const s of (p.pantallas ?? [])) {
            out[s] ??= { total: 0, urgentes: 0 }
            out[s].total++
            if (p.grupo === 'urgente') out[s].urgentes++
          }
        }
        if (vivo) setConteo(out)
      } catch {
        // Silencio a propósito: un contador que no carga no puede romper la navegación.
      }
    })()
    return () => { vivo = false }
  }, [activo])

  return conteo
}
