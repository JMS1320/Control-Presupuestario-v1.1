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
 *
 * ⚠️ cambió 05/11 — A-BUG-1238 (nota 🌙 JMS: *«la idea es que la orden pueda salir en cualquier unidad y se registre
 * en la unidad de la BBDD independiente»*): la dosis puede ir en **L, cc, kg o g por ha**, y el **total va SIEMPRE en
 * la unidad del insumo** (`stock_insumos.unidad_medida`), que es en la que se descuenta el stock al ejecutar. Antes el
 * total era «en litros» y la ejecución lo descontaba en la unidad del insumo: un insumo en **ml** con 256 cc/ha en
 * 19,5 ha descontaba **5 ml** en vez de 5.000. La columna se sigue llamando `cantidad_total_l` (no se renombra).
 * Si la unidad de la dosis y la del insumo no se pueden convertir (litros contra kilos), `incompatible` y no se guarda.
 */
export interface LineaDosis {
  dosis: string
  unidad_dosis: string
  /** el total escrito a mano, EN LA UNIDAD DEL INSUMO; vacío/undefined = se deriva de la dosis */
  total?: string
}

/** Las unidades de dosis (por hectárea) que ofrece la orden. `cc` = ml. */
export const UNIDADES_DOSIS = [
  { id: "L", rotulo: "L/ha" },
  { id: "cc", rotulo: "cc/ha" },
  { id: "kg", rotulo: "kg/ha" },
  { id: "g", rotulo: "g/ha" },
] as const

/** Familia y factor a la unidad base (volumen → L, masa → kg). Lo que no está (dosis, u, cof…) no se convierte. */
const FACTOR: Record<string, { familia: "volumen" | "masa"; base: number }> = {
  l: { familia: "volumen", base: 1 }, lt: { familia: "volumen", base: 1 }, litro: { familia: "volumen", base: 1 }, litros: { familia: "volumen", base: 1 },
  cc: { familia: "volumen", base: 0.001 }, ml: { familia: "volumen", base: 0.001 },
  kg: { familia: "masa", base: 1 }, g: { familia: "masa", base: 0.001 }, gr: { familia: "masa", base: 0.001 }, t: { familia: "masa", base: 1000 },
}
const factorDe = (u: string | null | undefined) => FACTOR[String(u ?? "").trim().toLowerCase()] ?? null

/** Pura: convierte una cantidad de una unidad a otra de la misma familia; `null` si no se puede (L ↔ kg, «dosis»…). */
export function convertir(cantidad: number, de: string, a: string): number | null {
  if (String(de).trim().toLowerCase() === String(a).trim().toLowerCase()) return cantidad
  const fd = factorDe(de), fa = factorDe(a)
  if (!fd || !fa || fd.familia !== fa.familia) return null
  return (cantidad * fd.base) / fa.base
}

/**
 * Pura: las unidades de dosis para un insumo — las 4 de siempre y, si el insumo está en algo que no es volumen ni masa
 * («unidad», «dosis», «cof»…), también ésa («unidad/ha»), que es la única con la que se puede descontar.
 */
export function unidadesParaInsumo(unidadInsumo: string | null | undefined): { id: string; rotulo: string }[] {
  const u = unidadDelInsumo(unidadInsumo)
  return factorDe(u) ? [...UNIDADES_DOSIS] : [...UNIDADES_DOSIS, { id: u, rotulo: `${u}/ha` }]
}

/**
 * Pura: la unidad de dosis que corresponde al elegir un insumo — se conserva la que estaba si se puede convertir; si no,
 * la «natural» del insumo (ml → cc, L → L, kg → kg, g → g, t → kg, «unidad» → unidad). § Default del dato real.
 */
export function unidadDosisParaInsumo(actual: string, unidadInsumo: string | null | undefined): string {
  const u = unidadDelInsumo(unidadInsumo)
  if (convertir(1, actual, u) !== null) return actual
  const f = factorDe(u)
  if (!f) return u
  if (f.familia === "volumen") return f.base < 1 ? "cc" : "L"
  return f.base < 1 ? "g" : "kg"
}

/** El rótulo de la unidad del insumo para mostrar el total («L», «ml», «kg»…). Sin dato = L (como antes). */
export const unidadDelInsumo = (u: string | null | undefined) => String(u ?? "").trim() || "L"

const num = (s: string | undefined) => {
  const n = parseFloat(String(s ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

/**
 * Pura: dosis (en su unidad, por ha) y total (en la unidad del insumo). `unidadInsumo` vacía = «L» (lo de antes).
 * `incompatible` = la dosis no se puede pasar a la unidad del insumo: el total sale en la unidad de la dosis y NO
 * hay que guardarlo (descontaría otra magnitud del stock).
 */
export function dosisYTotal(l: LineaDosis, hectareas: number, unidadInsumo?: string | null):
  { dosis: number; total: number; fuente: "dosis" | "total"; unidadTotal: string; incompatible: boolean } {
  const uIns = unidadDelInsumo(unidadInsumo)
  const uDosis = l.unidad_dosis || "L"
  const unaUnidad = convertir(1, uDosis, uIns)
  const incompatible = unaUnidad === null
  const k = unaUnidad ?? 1 // de «1 unidad de dosis» a la unidad del total
  const unidadTotal = incompatible ? uDosis : uIns
  if (String(l.total ?? "").trim() !== "") {
    const total = num(l.total)
    const dosis = hectareas > 0 ? total / k / hectareas : 0
    return { dosis: Number(dosis.toFixed(4)), total, fuente: "total", unidadTotal, incompatible }
  }
  const dosis = num(l.dosis)
  return { dosis, total: Number((dosis * k * hectareas).toFixed(3)), fuente: "dosis", unidadTotal, incompatible }
}
