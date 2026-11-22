/**
 * 👤 Las tarjetas «dadas por el rol» (A-FEAT-1634, JMS 22/11: los bloques de MA pasan a la grilla de Principal).
 *
 * La grilla es la lista que cada persona arma con «Configurar mi inicio». Una tarjeta que se da por PERMISO (los bloques
 * de MA) tiene que aparecer sola cuando el rol la tiene —aunque la persona ya haya configurado su inicio antes— y
 * quedarse afuera si la persona la sacó. Pieza pura: la prueba `npm run probar`.
 *
 * @param elegidos  lo que la persona eligió y en qué orden (`null` = nunca configuró → `porDefecto`)
 * @param quitados  las dadas que la persona sacó a mano
 * @param dadas     las dadas que su rol tiene HOY, en su orden
 * @returns la lista a mostrar: primero las dadas nuevas (ni elegidas ni quitadas), después lo elegido, en su orden
 */
export function conLasDadas(elegidos: string[] | null, porDefecto: string[], quitados: string[], dadas: string[]): string[] {
  const base = elegidos ?? porDefecto
  const nuevas = dadas.filter(id => !base.includes(id) && !quitados.includes(id))
  return [...nuevas, ...base]
}
