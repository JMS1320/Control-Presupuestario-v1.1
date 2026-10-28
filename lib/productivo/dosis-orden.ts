/**
 * 🧪 **Dosis y total de una línea de insumo de la orden agrícola: el último que se escribe MANDA.**
 * A-FEAT-1397 · nota 🌙 de JMS 2026-10-28: *«hay algo con los redondeos o el 3er decimal. Cuando cambio
 * valores cruzados se me pone sí o sí un decimal en el tercer puesto que no puedo borrar»*.
 *
 * Antes el total se mostraba SIEMPRE recalculado desde la dosis redondeada: escribir 50 L en 19,5 ha
 * daba dosis 2,564 → total 49,998, y al borrar un dígito se volvía a recalcular. Ahora:
 * - si el usuario escribió el **total**, ése queda tal cual y la dosis se deriva (`fuente: 'total'`);
 * - si escribió la **dosis**, el total se deriva (`fuente: 'dosis'`).
 * Si cambian las hectáreas, se mueve el que NO escribió.
 */
export interface LineaDosis {
  dosis: string
  unidad_dosis: string
  /** el total en litros escrito a mano; vacío/undefined = se deriva de la dosis */
  total?: string
}

const num = (s: string | undefined) => {
  const n = parseFloat(String(s ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

export function dosisYTotal(l: LineaDosis, hectareas: number): { dosis: number; total: number; fuente: "dosis" | "total" } {
  const enCc = l.unidad_dosis === "cc"
  if (String(l.total ?? "").trim() !== "") {
    const total = num(l.total)
    const dosisL = hectareas > 0 ? total / hectareas : 0
    return { dosis: Number((enCc ? dosisL * 1000 : dosisL).toFixed(4)), total, fuente: "total" }
  }
  const dosis = num(l.dosis)
  const total = (enCc ? dosis / 1000 : dosis) * hectareas
  return { dosis, total: Number(total.toFixed(3)), fuente: "dosis" }
}
