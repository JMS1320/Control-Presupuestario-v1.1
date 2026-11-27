/**
 * 🐄 Los chips de grupo del Registro de Terneros (machos · hembras · toritos · terneras rep).
 *
 * ⚠️ cambió 27/11 (JMS: «estos chips no andan como deberían según protocolo»): eran de a UNO (prender uno apagaba el otro).
 * Siguen el gesto de toda la app (`lib/ui/chips.ts`, CLAUDE.md § ♻️): click prende/apaga, Ctrl+click deja sólo ése, «ver
 * todos» vuelve. Vacío = todos.
 *
 * ⚠️ y cambió otra vez el 27/11 (JMS: «si yo selecciono hembras se debería activar solo las de rep. y si aprieto las de rep
 * se debería deseleccionar quedando solo para ver las que no son de rep»): son PADRE e HIJO. Lo que se filtra son 4 hojas
 * (machos sin torito · toritos · hembras sin rep · terneras rep); el chip padre prende o apaga sus dos hojas, el hijo sólo la
 * suya. Hembras + apagar rep = las hembras que NO son de reposición.
 */

export type GrupoTernero = 'machos' | 'hembras' | 'toritos' | 'terneras_rep'
export type HojaGrupo = 'machos_resto' | 'toritos' | 'hembras_resto' | 'terneras_rep'

export const NOMBRE_GRUPO: Record<GrupoTernero, string> = {
  machos: 'machos', hembras: 'hembras', toritos: 'toritos', terneras_rep: 'terneras rep',
}
const NOMBRE_HOJA: Record<HojaGrupo, string> = {
  machos_resto: 'machos sin toritos', toritos: 'toritos', hembras_resto: 'hembras sin rep', terneras_rep: 'terneras rep',
}
const HOJAS: Record<GrupoTernero, HojaGrupo[]> = {
  machos: ['machos_resto', 'toritos'], hembras: ['hembras_resto', 'terneras_rep'], toritos: ['toritos'], terneras_rep: ['terneras_rep'],
}

interface TerneroGrupo { sexo?: string | null; es_torito?: boolean | null }

/** Pura: la hoja del ternero (null si no tiene sexo cargado). */
export function hojaDe(t: TerneroGrupo): HojaGrupo | null {
  if (t.sexo === 'Macho') return t.es_torito ? 'toritos' : 'machos_resto'
  if (t.sexo === 'Hembra') return t.es_torito ? 'terneras_rep' : 'hembras_resto'
  return null
}

/** Pura: si el ternero es de ese grupo (para contar el chip: «hembras» cuenta todas). */
export function enGrupo(t: TerneroGrupo, g: GrupoTernero): boolean {
  const h = hojaDe(t)
  return !!h && HOJAS[g].includes(h)
}

/** Pura: sin chips prendidos pasan todos; si no, pasa si su hoja está prendida. */
export function pasaGrupos(t: TerneroGrupo, hojas: Set<HojaGrupo>): boolean {
  if (hojas.size === 0) return true
  const h = hojaDe(t)
  return !!h && hojas.has(h)
}

/** Pura: si el chip se ve prendido. El padre, por su hoja propia (hembras = «hembras sin rep» prendida). */
export function chipPrendido(hojas: Set<HojaGrupo>, g: GrupoTernero): boolean {
  return hojas.has(HOJAS[g][0])
}

/** Pura: el click. Padre: prende o apaga sus dos hojas · hijo: la suya · Ctrl+click: sólo las de ese chip. */
export function clickChipGrupo(hojas: Set<HojaGrupo>, g: GrupoTernero, soloEste = false): Set<HojaGrupo> {
  if (soloEste) return new Set(HOJAS[g])
  const n = new Set(hojas)
  if (chipPrendido(hojas, g)) HOJAS[g].forEach(h => n.delete(h)); else HOJAS[g].forEach(h => n.add(h))
  return n
}

/** Pura: lo que está filtrado, en palabras («hembras sin rep + toritos»). */
export function describirHojas(hojas: Set<HojaGrupo>): string {
  return (Object.keys(NOMBRE_HOJA) as HojaGrupo[]).filter(h => hojas.has(h)).map(h => NOMBRE_HOJA[h]).join(' + ')
}
