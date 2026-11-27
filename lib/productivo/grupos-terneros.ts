/**
 * 🐄 Los chips de grupo del Registro de Terneros (machos · hembras · toritos · terneras rep).
 *
 * ⚠️ cambió 27/11 (JMS: «estos chips no andan como deberían según protocolo»): eran de a UNO (prender uno apagaba el otro).
 * Ahora siguen el gesto de toda la app (`lib/ui/chips.ts`, CLAUDE.md § ♻️): click prende/apaga, Ctrl+click deja sólo ése,
 * «ver todos» vuelve. Varios prendidos = la UNIÓN (un torito es también macho: se ve una sola vez). Vacío = todos.
 */

export type GrupoTernero = 'machos' | 'hembras' | 'toritos' | 'terneras_rep'

export const NOMBRE_GRUPO: Record<GrupoTernero, string> = {
  machos: 'machos', hembras: 'hembras', toritos: 'toritos', terneras_rep: 'terneras rep',
}

interface TerneroGrupo { sexo?: string | null; es_torito?: boolean | null }

/** Pura: si el ternero es de ese grupo. */
export function enGrupo(t: TerneroGrupo, g: GrupoTernero): boolean {
  if (g === 'machos') return t.sexo === 'Macho'
  if (g === 'hembras') return t.sexo === 'Hembra'
  if (g === 'toritos') return !!t.es_torito && t.sexo === 'Macho'
  return !!t.es_torito && t.sexo === 'Hembra'
}

/** Pura: con chips prendidos, pasa si es de ALGUNO; sin ninguno, pasan todos. */
export function pasaGrupos(t: TerneroGrupo, grupos: Set<GrupoTernero>): boolean {
  if (grupos.size === 0) return true
  for (const g of grupos) if (enGrupo(t, g)) return true
  return false
}
