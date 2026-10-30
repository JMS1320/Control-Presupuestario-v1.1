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
  /**
   * La existencia de HOY (la de `stock_insumos`) cuando `cantidad` es la reconstruida a una fecha
   * con `existenciaAlCierre`. Ausente = `cantidad` es la de hoy.
   */
  cantidadHoy?: number
}

/** Un movimiento de `productivo.movimientos_insumos`, lo mínimo para reconstruir la existencia. */
export interface MovimientoInsumo {
  insumoId: string
  fecha: string
  tipo: string
  cantidad: number
}

/** Cómo mueve la existencia cada tipo: la compra suma, el uso resta, el ajuste va con su signo. */
export function efectoMovimiento(m: Pick<MovimientoInsumo, "tipo" | "cantidad">): number {
  const c = Number(m.cantidad) || 0
  const t = String(m.tipo ?? "").toLowerCase()
  if (t === "compra") return Math.abs(c)
  if (t === "uso") return -Math.abs(c)
  return c
}

/** Un producto cuya existencia de hoy no es la suma de sus movimientos: el dato está roto, no se adivina. */
export interface DescuadreInsumo {
  producto: string
  unidad: string
  hoy: number
  sumaMovimientos: number
}

export interface ExistenciaAlCierre {
  lineas: LineaInsumo[]
  /** Movimientos posteriores al cierre que se descontaron para llegar a la existencia al cierre. */
  posteriores: number
  descuadres: DescuadreInsumo[]
}

/**
 * 📅 **LA EXISTENCIA AL CIERRE, no la de hoy** — A-FEAT-1427 (JMS 30/10: «tenés siempre el stock previo y
 * el actual de cada cosa, y de lo que no hay salta la alerta»).
 *
 * Hasta acá el papel valuaba `stock_insumos.cantidad`, que es la existencia **del día en que se baja el
 * Excel**: con compras y usos de julio a octubre de 2026 cargados, el stock «al 30/06/2026» cambiaba cada
 * semana. La existencia es la suma de sus movimientos (medido 30/10: 114 de 115 productos cuadran), así que
 * la del cierre es **la suma de los movimientos hasta esa fecha**.
 *
 * 🧮 **El control, por el camino inverso**: existencia de hoy − suma de TODOS sus movimientos = 0. El
 * producto que no cumple sale en `descuadres` —su existencia se cargó o se tocó por fuera de los
 * movimientos— y para él se usa igual la reconstruida, avisando: la de hoy no es «al cierre» en ningún caso.
 */
export function existenciaAlCierre(lineas: LineaInsumo[], movimientos: MovimientoInsumo[], fechaCierre: string): ExistenciaAlCierre {
  const r = (x: number) => Math.round(x * 1e6) / 1e6
  const total = new Map<string, number>()
  const alCierre = new Map<string, number>()
  let posteriores = 0
  for (const m of movimientos) {
    const e = efectoMovimiento(m)
    total.set(m.insumoId, (total.get(m.insumoId) ?? 0) + e)
    if (String(m.fecha).slice(0, 10) <= fechaCierre) alCierre.set(m.insumoId, (alCierre.get(m.insumoId) ?? 0) + e)
    else posteriores++
  }
  const descuadres: DescuadreInsumo[] = []
  const nuevas = lineas.map(l => {
    const suma = r(total.get(l.id) ?? 0)
    if (Math.abs(suma - l.cantidad) > 0.0005) descuadres.push({ producto: l.producto, unidad: l.unidad, hoy: l.cantidad, sumaMovimientos: suma })
    return { ...l, cantidadHoy: l.cantidad, cantidad: r(alCierre.get(l.id) ?? 0) }
  })
  return { lineas: nuevas, posteriores, descuadres }
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
  /** 📅 Si la existencia es la reconstruida al cierre: a qué fecha, y su control. Ausente = es la de hoy. */
  alCierre?: { fecha: string; posteriores: number; descuadres: DescuadreInsumo[] }
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
 * 🕳️ LO QUE LE FALTA A CADA PAPEL — se declara, no se omite.
 *
 * ⚠️ **Corregido el 2026-09-28 (tarde).** Esta lista decía que **granos y sementeras «no tienen de
 * dónde salir»**, y era quedarse corto: los dos salen **en parte** (ver `granos-sementeras.ts`).
 * Dejarlo como estaba habría hecho que la app **se contradijera a sí misma** — una solapa con los
 * números al lado de un cartel diciendo que no se pueden calcular.
 *
 * 📌 Lo que queda acá es **lo que de verdad falta**, con nombre. Omitirlo daría un export que
 * *parece* completo.
 */
export const PAPELES_SIN_ORIGEN = [
  {
    papel: "1 - Granos",
    falta: "Sale el cuadre de kilos, pero de sus cinco entradas la app sólo sabe las ventas: " +
      "el stock al inicio, la cosecha y la existencia al cierre se cargan a mano.",
  },
  {
    papel: "3 - Sementeras",
    falta: "Sale el detalle físico de las órdenes ejecutadas, pero el costo queda incompleto: " +
      "los insumos no tienen precio y las labores no tienen dónde cargar su tarifa.",
  },
  {
    papel: "6 - Gas oil",
    falta: "El producto «Gas oil» existe (29/10) pero no tiene compras ni usos cargados: su existencia al cierre sale 0. " +
      "El stock declarado al inicio (2.700 L) está en «Stock al inicio».",
  },
]
