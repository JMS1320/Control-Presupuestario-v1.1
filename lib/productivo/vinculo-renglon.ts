/**
 * ✨ La factura de insumos se VINCULA SOLA con su entrada al stock, renglón por renglón — A-FEAT-1663 (stock, paso 1).
 *
 * JMS 26/11: *«que la factura se vincule sola tiene algo de riesgo, pero si fuera muy riguroso el control podría funcionar… igual me
 * debería aparecer algo bastante visual para revisarlo»* · *«los kilos de la compra registrada pueden variar con los de la factura: se
 * corrige»* · y el distintivo NO es 🔗 (*«ese ícono ya se usa para otra cosa»*) → **✨ vinculada sola — revisá**.
 *
 * El MOMENTO del flujo (CLAUDE.md § ⏸️): JMS registra la compra cuando la confirma; llega la factura; al abrir su 🧾 (o al leerse el
 * PDF) la app busca la entrada de ese renglón. Si el caso es inequívoco la vincula sola y lo marca; si no, propone; si no hay entrada,
 * ofrece cargarla con los datos de la factura.
 *
 * ## Cuándo se vincula SOLA (las seis condiciones, todas)
 * 1. la lectura del PDF **cierra** con el papel (renglones = neto del pie);
 * 2. la factura es en **pesos** (en dólares hace falta el TC: propone);
 * 3. el insumo del renglón es **conocido**: ya se vinculó antes ese mismo artículo de ese proveedor (aprendido del uso) o alguien lo
 *    eligió en el renglón — un parecido de nombre NO alcanza para vincular solo;
 * 4. hay **una sola** entrada libre de ese insumo y ese proveedor entre 120 días antes y 60 después de la factura, y ningún otro renglón
 *    de la factura pide el mismo insumo;
 * 5. la **unidad** se convierte con certeza (toneladas ↔ kg, litros ↔ ml…);
 * 6. la cantidad difiere **hasta 30 %** (el caso de Longo: se pidieron 20 t y se facturaron 25,56); más que eso, propone.
 * Y el renglón no fue rechazado antes («no es ésta» apaga el vínculo solo de ese renglón).
 *
 * Pura: no lee ni escribe la base. Casos en `npm run probar`.
 */

export type Unidad = "kg" | "t" | "l" | "ml" | "un" | "dosis"

const UNIDADES: Array<[RegExp, Unidad]> = [
  [/^(kg|kgs|kilo|kilos|kilogramos?)$/, "kg"],
  [/^(t|tn|tns|ton|tons|toneladas?)$/, "t"],
  [/^(l|lt|lts|litros?)$/, "l"],
  [/^(ml|cc|mililitros?)$/, "ml"],
  [/^(u|un|und|unid|unidad|unidades|bolsas?|pack)$/, "un"],
  [/^(dosis|ds)$/, "dosis"],
]

export function unidadNormal(u: string | null | undefined): Unidad | null {
  const s = String(u ?? "").trim().toLowerCase().replace(/\.$/, "")
  if (!s) return null
  for (const [re, x] of UNIDADES) if (re.test(s)) return x
  return null
}

/** Cuánto de la unidad del stock es una unidad de la factura (t → kg = 1000). `null` si no hay conversión segura. */
export function factorUnidad(uFactura: string | null | undefined, uStock: string | null | undefined): number | null {
  const a = unidadNormal(uFactura), b = unidadNormal(uStock)
  if (!a || !b) return null
  if (a === b) return 1
  if (a === "t" && b === "kg") return 1000
  if (a === "kg" && b === "t") return 0.001
  if (a === "l" && b === "ml") return 1000
  if (a === "ml" && b === "l") return 0.001
  return null
}

const SIN_PESO = new Set(["granel", "granulada", "granulado", "bolsa", "bolsas", "por", "con", "sin", "lts", "litros", "kgs", "x", "de", "del", "la", "el", "s", "bo25", "sa"])
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")

/** La descripción para comparar: sin tildes, minúsculas, sin puntuación. «Maíz quebrado.» → «maiz quebrado». */
export function normalizarDescripcion(s: string | null | undefined): string {
  return sinTildes(String(s ?? "")).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}
const palabras = (s: string) => normalizarDescripcion(s).split(" ").filter(w => w.length >= 3 && !SIN_PESO.has(w) && !/^\d+$/.test(w))

export interface RenglonFactura {
  n: number
  descripcion: string
  cantidad: number | null
  unidad: string | null
  neto: number | null
  /** Elegido a mano (o guardado al vincular): manda. */
  insumoStockId: string | null
  /** «No es ésta» de una vez anterior: no se vuelve a vincular solo. */
  noVincularSolo?: boolean
}

export interface InsumoStock { id: string; producto: string; unidad: string | null }

export interface EntradaLibre {
  id: string
  fecha: string
  insumoStockId: string
  cantidad: number
  costoUnitario: number | null
  proveedor: string | null
  cuit: string | null
}

/** Lo aprendido del uso: este artículo (descripción normalizada) de este proveedor es este insumo. */
export interface Aprendido { cuit: string; descripcion: string; insumoStockId: string }

export type EstadoRenglon = "auto" | "propuesta" | "sin-entrada" | "sin-insumo"

export interface PropuestaRenglon {
  n: number
  estado: EstadoRenglon
  insumoStockId: string | null
  /** De dónde salió el insumo: elegido en el renglón, aprendido de un vínculo anterior, o por el nombre (sólo propone). */
  fuenteInsumo: "renglon" | "aprendido" | "nombre" | null
  entrada: EntradaLibre | null
  /** Otras entradas posibles (si hay más de una, no se vincula solo). */
  otras: EntradaLibre[]
  factor: number | null
  /** Lo que dice la factura, en la unidad del stock. */
  cantidadStock: number | null
  precioStock: number | null
  /** Por qué no se vinculó sola (vacío si es «auto»). */
  motivos: string[]
}

const cuitDe = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "")
const primera = (s: string | null | undefined) => normalizarDescripcion(s).split(" ")[0] || ""
const dias = (a: string, b: string) => Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86_400_000)
const r2 = (n: number) => Math.round(n * 100) / 100
const r6 = (n: number) => Math.round(n * 1e6) / 1e6

export const TOLERANCIA_CANTIDAD = 0.3
export const VENTANA_ANTES = 120
export const VENTANA_DESPUES = 60

/** ¿La entrada es de este proveedor? Por CUIT; si la entrada no tiene CUIT, por la primera palabra del nombre. */
export function esDelProveedor(e: { cuit: string | null; proveedor: string | null }, f: { cuit: string | null; proveedor: string }): boolean {
  const ce = cuitDe(e.cuit), cf = cuitDe(f.cuit)
  if (ce && cf) return ce === cf
  const pe = primera(e.proveedor), pf = normalizarDescripcion(f.proveedor)
  return !!pe && pe.length >= 3 && (` ${pf} `).includes(` ${pe} `)
}

/** El insumo del stock cuyo nombre más se parece al artículo (palabras en común). `null` si no hay o hay empate. */
export function insumoPorNombre(descripcion: string, insumos: InsumoStock[]): string | null {
  const ws = new Set(palabras(descripcion))
  let mejor: string | null = null, puntos = 0, empate = false
  for (const i of insumos) {
    const p = palabras(i.producto).filter(w => ws.has(w)).length
    if (p > puntos) { mejor = i.id; puntos = p; empate = false } else if (p === puntos && p > 0) empate = true
  }
  return puntos > 0 && !empate ? mejor : null
}

export function proponerPorRenglon(args: {
  factura: { fecha: string; cuit: string | null; proveedor: string; moneda: string; tipoCambio: number | null; estadoLectura: string | null }
  renglones: RenglonFactura[]
  entradas: EntradaLibre[]
  aprendidos: Aprendido[]
  insumos: InsumoStock[]
}): PropuestaRenglon[] {
  const { factura: f, renglones, entradas, aprendidos, insumos } = args
  const usd = !["ARS", "PES", "$"].includes(String(f.moneda || "ARS"))
  const tc = usd ? (Number(f.tipoCambio) || 0) : 1
  const cuitF = cuitDe(f.cuit)
  const delProv = entradas.filter(e => esDelProveedor(e, f) && dias(e.fecha, f.fecha) >= -VENTANA_ANTES && dias(e.fecha, f.fecha) <= VENTANA_DESPUES)

  const base = renglones.map(r => {
    let insumo: string | null = null, fuente: PropuestaRenglon["fuenteInsumo"] = null
    if (r.insumoStockId) { insumo = r.insumoStockId; fuente = "renglon" }
    else {
      const d = normalizarDescripcion(r.descripcion)
      const a = aprendidos.filter(x => cuitDe(x.cuit) === cuitF && x.descripcion === d)
      const ids = [...new Set(a.map(x => x.insumoStockId))]
      if (cuitF && ids.length === 1) { insumo = ids[0]!; fuente = "aprendido" }
      else {
        const pn = insumoPorNombre(r.descripcion, insumos)
        if (pn) { insumo = pn; fuente = "nombre" }
      }
    }
    return { r, insumo, fuente }
  })
  // Un insumo pedido por dos renglones de la misma factura: ninguno se vincula solo (no se sabe cuál es cuál).
  const pedidos = new Map<string, number>()
  for (const b of base) if (b.insumo) pedidos.set(b.insumo, (pedidos.get(b.insumo) ?? 0) + 1)
  const tomadas = new Set<string>()

  return base.map(({ r, insumo, fuente }) => {
    const motivos: string[] = []
    const ins = insumos.find(i => i.id === insumo) ?? null
    const factor = ins ? factorUnidad(r.unidad, ins.unidad) : null
    const cantidadStock = factor != null && r.cantidad != null ? r6(r.cantidad * factor) : null
    const precioStock = cantidadStock && r.neto != null && (!usd || tc > 0) ? r6((r.neto * tc) / cantidadStock) : null
    if (!insumo || !ins) {
      return { n: r.n, estado: "sin-insumo" as const, insumoStockId: null, fuenteInsumo: null, entrada: null, otras: [], factor: null, cantidadStock: null, precioStock: null, motivos: ["no sé qué insumo del stock es: elegilo"] }
    }
    const candidatas = delProv.filter(e => e.insumoStockId === insumo && !tomadas.has(e.id))
      .sort((a, b) => Math.abs((a.cantidad || 0) - (cantidadStock ?? 0)) - Math.abs((b.cantidad || 0) - (cantidadStock ?? 0)) || Math.abs(dias(a.fecha, f.fecha)) - Math.abs(dias(b.fecha, f.fecha)))
    const entrada = candidatas[0] ?? null
    if (!entrada) {
      return { n: r.n, estado: "sin-entrada" as const, insumoStockId: insumo, fuenteInsumo: fuente, entrada: null, otras: [], factor, cantidadStock, precioStock, motivos: ["no hay ninguna entrada al stock de este insumo y proveedor sin factura"] }
    }
    if (f.estadoLectura !== "cierra") motivos.push("la lectura del PDF no cierra con el papel")
    if (usd) motivos.push("factura en dólares: confirmá el tipo de cambio")
    if (fuente === "nombre") motivos.push("el insumo sale sólo del parecido del nombre (la primera vez se confirma)")
    if (candidatas.length > 1) motivos.push(`hay ${candidatas.length} entradas posibles`)
    if ((pedidos.get(insumo) ?? 0) > 1) motivos.push("dos renglones de la factura son del mismo insumo")
    if (factor == null) motivos.push(`no sé convertir «${r.unidad ?? "?"}» a «${ins.unidad ?? "?"}»`)
    if (cantidadStock != null && entrada.cantidad > 0 && Math.abs(cantidadStock - entrada.cantidad) / cantidadStock > TOLERANCIA_CANTIDAD)
      motivos.push(`la cantidad difiere más de ${TOLERANCIA_CANTIDAD * 100} %`)
    if (r.noVincularSolo) motivos.push("ya dijiste una vez que no era ésta")
    tomadas.add(entrada.id)
    return {
      n: r.n, estado: motivos.length ? "propuesta" as const : "auto" as const, insumoStockId: insumo, fuenteInsumo: fuente,
      entrada, otras: candidatas.slice(1), factor, cantidadStock, precioStock, motivos,
    }
  })
}

/** La HUELLA del vínculo (va en la nota): lo que tenía la entrada y lo que dice la factura. */
export function notaDelVinculo(p: { cantidadStock: number | null; precioStock: number | null }, antes: { cantidad: number; costoUnitario: number | null } | null, unidad: string | null, automatico: boolean, factura: string): string {
  const nf = (n: number | null, d = 2) => n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })
  const u = unidad ? ` ${unidad}` : ""
  const quien = automatico ? "✨ vinculada sola" : "vinculada"
  if (!antes) return `${quien} · entrada cargada desde la factura ${factura}: ${nf(p.cantidadStock, 0)}${u} a $ ${nf(p.precioStock)}`
  const cambioC = p.cantidadStock != null && Math.abs(p.cantidadStock - antes.cantidad) > 1e-6
  const cambioP = p.precioStock != null && (antes.costoUnitario == null || Math.abs(p.precioStock - antes.costoUnitario) > 0.005)
  return `${quien} a la factura ${factura} · la entrada decía ${nf(antes.cantidad, 0)}${u} a $ ${nf(antes.costoUnitario)}` +
    (cambioC || cambioP ? ` → la factura dice ${nf(p.cantidadStock, 0)}${u} a $ ${nf(p.precioStock)}: se corrigió` : " · coincide")
}

/** Cuánto se mueve el stock al corregir la entrada con la factura (o al cargarla). */
export const deltaStock = (antes: number | null, despues: number | null) => r2((Number(despues) || 0) - (Number(antes) || 0))
