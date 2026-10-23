/**
 * 🔢 **LOS CÓDIGOS CONTABLE / INTERNO PARA ELEGIR** (A-BUG-1301, 2026-10-20).
 *
 * El Asignar y la edición masiva ofrecen los códigos ya usados (A-FEAT-03), pero se leían **sólo de la
 * cuenta abierta**: en la VISA MSA, que todavía no tenía ninguno, la lista salía vacía y el usuario
 * tuvo que tipear «RET 3 MA / DIST MA» (*«no me da a elegir entre existentes»*). Ahora se juntan los
 * de todos los extractos y los de las reglas de contable/interno: el vocabulario es uno solo.
 */
export function unirCodigos(listas: (string | null | undefined)[][]): string[] {
  const vistos = new Map<string, string>()
  for (const l of listas) for (const v of l) {
    const s = (v ?? "").trim()
    // «VER» y «Ver» son el mismo código: se queda la primera forma vista (la de la cuenta abierta va primero).
    if (s && !vistos.has(s.toLowerCase())) vistos.set(s.toLowerCase(), s)
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "es"))
}
