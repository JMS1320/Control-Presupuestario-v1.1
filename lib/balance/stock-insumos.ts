/**
 * 🧪 STOCK DE INSUMOS AL CIERRE — A-FEAT-1184.
 *
 * Cubre los papeles `2 - STOCK INSUMOS AGRICOLAS`, `5 - FORRAJEROS` y `6 - GAS OIL`, que en la
 * planilla del usuario tienen **la misma forma**: `categoría · producto · cantidad · unidad ·
 * precio unitario · valor total`.
 *
 * ## 🗂️ Y el ÁMBITO ya los separa solo
 *
 * `productivo.categorias_insumo.ambito` vale `agricola`, `ganadero` o `ambos` — que es exactamente
 * el corte de sus tres papeles. No hay que inventar una clasificación nueva: la que existe alcanza.
 *
 * ## 🕳️ El hueco que hay que reconocer, y es el grande
 *
 * Medido el 2026-09-28: **32 productos con stock y NINGUNO con precio** (`costo_unitario` en cero o
 * nulo). Es el mismo estado de su Excel, donde muchas filas tienen la columna de precio vacía y el
 * total da 0. O sea que **el inventario está y la valuación no**.
 *
 * 🛑 Por eso las filas sin precio **no se valúan en cero**: salen contadas, con su cantidad y su
 * unidad, esperando el precio. Un total que suma sólo lo que tiene precio y se presenta como «el
 * stock de insumos» es un número falso con cara de completo (§ 🧮 de `CLAUDE.md`).
 */

/** Una línea de `productivo.stock_insumos` con su categoría. */
export interface LineaInsumo {
  id: string
  categoria: string
  /** `agricola` · `ganadero` · `ambos`. Es el que separa los tres papeles. */
  ambito: string
  producto: string
  cantidad: number
  unidad: string
  /** `null` o 0 = falta el precio. */
  costoUnitario: number | null
  observaciones: string
}

export interface FilaInsumoValuada extends LineaInsumo {
  valorTotal: number | null
  esHueco: boolean
}

export interface GrupoInsumos {
  /** Cómo se llama el papel del usuario. */
  papel: string
  ambito: string
  filas: FilaInsumoValuada[]
  valuado: number
  huecos: number
}

export interface StockInsumos {
  grupos: GrupoInsumos[]
  productos: number
  valuado: number
  /** Productos con stock y sin precio: el trabajo que falta. */
  huecos: FilaInsumoValuada[]
}

/** Cómo llama el usuario a cada ámbito en sus papeles. */
export const PAPEL_POR_AMBITO: Record<string, string> = {
  agricola: "2 - Stock insumos agrícolas",
  ganadero: "5 - Forrajeros y veterinarios",
  ambos: "6 - Gas oil y otros",
}

const n = (v: unknown): number => {
  const x = typeof v === "string" ? parseFloat(v) : (v as number)
  return Number.isFinite(x) ? x : 0
}
const s = (v: unknown): string => (v == null ? "" : String(v))

/** Fila cruda (stock + categoría embebida) → línea normalizada. */
export function desdeStockInsumo(f: Record<string, unknown>): LineaInsumo {
  const c = (f.categoria ?? {}) as Record<string, unknown>
  const costo = n(f.costo_unitario)
  return {
    id: s(f.id),
    categoria: s(c.nombre) || "(sin categoría)",
    ambito: s(c.ambito) || "ambos",
    producto: s(f.producto),
    cantidad: n(f.cantidad),
    unidad: s(f.unidad_medida) || s(c.unidad_medida),
    // 0 se trata como «no cargado»: un insumo que vale cero no existe, y dejarlo pasar como precio
    // válido haría desaparecer el hueco.
    costoUnitario: costo > 0 ? costo : null,
    observaciones: s(f.observaciones),
  }
}

/**
 * Agrupa por papel y valúa.
 *
 * 📌 `preciosManuales` es el override por **producto** (§ 🎚️): vacío = usá lo cargado, lleno =
 * acá mando yo. Se busca primero por id y después por nombre, para que sirva aunque el producto
 * se haya recreado.
 */
export function armarStockInsumos(
  lineas: LineaInsumo[],
  preciosManuales: Record<string, number> = {},
): StockInsumos {
  const redondear = (x: number) => Math.round(x * 100) / 100

  const valuar = (l: LineaInsumo): FilaInsumoValuada => {
    const manual = preciosManuales[l.id] ?? preciosManuales[l.producto]
    /**
     * 🔑 **Un precio en CERO es un precio que falta, no un precio válido.**
     *
     * La guarda vivía sólo en `desdeStockInsumo` —el borde de la base— y un caso la encontró:
     * un `0` que entrara por cualquier otro camino se tomaba como bueno, valuaba el producto en
     * cero y **el hueco desaparecía**. La regla tiene que estar donde se toma la decisión, no
     * donde entra el dato: es el mismo patrón de *«se arregló un camino de los dos»*.
     */
    const cargado = l.costoUnitario != null && l.costoUnitario > 0 ? l.costoUnitario : null
    const precio = Number.isFinite(manual) && manual > 0 ? manual : cargado
    return {
      ...l,
      costoUnitario: precio,
      valorTotal: precio == null ? null : redondear(l.cantidad * precio),
      esHueco: precio == null,
    }
  }

  const porAmbito = new Map<string, FilaInsumoValuada[]>()
  for (const l of lineas) {
    // Sólo interesa lo que TIENE existencia: un producto en cero no es stock.
    if (l.cantidad === 0) continue
    const v = valuar(l)
    porAmbito.set(v.ambito, [...(porAmbito.get(v.ambito) ?? []), v])
  }

  const grupos: GrupoInsumos[] = [...porAmbito.entries()]
    .map(([ambito, filas]) => ({
      papel: PAPEL_POR_AMBITO[ambito] ?? `Otros (${ambito})`,
      ambito,
      filas: filas.sort((a, b) =>
        a.categoria.localeCompare(b.categoria) || a.producto.localeCompare(b.producto)),
      valuado: redondear(filas.reduce((x, f) => x + (f.valorTotal ?? 0), 0)),
      huecos: filas.filter(f => f.esHueco).length,
    }))
    .sort((a, b) => a.papel.localeCompare(b.papel))

  const todas = grupos.flatMap(g => g.filas)
  return {
    grupos,
    productos: todas.length,
    valuado: redondear(todas.reduce((x, f) => x + (f.valorTotal ?? 0), 0)),
    huecos: todas.filter(f => f.esHueco),
  }
}

/**
 * 🕳️ LOS PAPELES QUE NO TIENEN DÓNDE SALIR — se declaran, no se omiten.
 *
 * Medido contra la base el 2026-09-28: no existe ninguna tabla de **granos** (la que parecía,
 * `productivo.stock_lotes`, es de hacienda: tiene desbaste y ganancia diaria) ni de **sementeras**.
 * Y **gas oil** tiene su categoría de insumo creada pero **cero productos cargados**.
 *
 * 📌 Se listan en el papel para que el hueco tenga nombre. Omitirlos daría un export que **parece
 * completo** y le faltan tres stocks.
 */
export const PAPELES_SIN_ORIGEN = [
  {
    papel: "1 - Granos",
    falta: "No hay tabla de stock de granos. En su planilla se valúa por toneladas × precio × % calidad − % CZ, " +
      "y lleva además un cuadre de kilos (inicio + cosecha − ventas = saldo) que tampoco tiene de dónde salir.",
  },
  {
    papel: "3 - Sementeras",
    falta: "No hay tabla. Es el costo sembrado y todavía no cosechado al cierre.",
  },
  {
    papel: "6 - Gas oil",
    falta: "La categoría de insumo «Combustible» existe pero no tiene ningún producto con stock cargado.",
  },
]
