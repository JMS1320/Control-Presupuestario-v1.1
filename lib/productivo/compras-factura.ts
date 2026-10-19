/**
 * 🧾 **Vincular una factura con sus compras de insumos — con descuento pactado y moneda** (A-BUG-1244).
 *
 * El circuito que pidió el usuario (2026-10-05): *«vincular la FC con insumos, desde la vista de la FC
 * o desde la de la compra; un modal para elegir la contraparte y ver el control; seleccionar insumos
 * para poner un % de descuento; si doy el OK, eso tiene que cambiar el precio comprado»*.
 *
 * ## La cuenta, por renglón
 *     precio real = precio pactado × (1 − % descuento)        (en la moneda de la factura)
 *     subtotal    = cantidad × precio real
 *     en pesos    = precio real × TC                          (TC = 1 si la factura es en pesos)
 *
 * ## El control
 * Σ subtotales contra el **neto** de la factura, en su moneda. Es una **discrepancia**, no una
 * contradicción interna: puede faltar un renglón o haber un flete — se **avisa y se deja seguir**
 * (§ 🚦 *un control que frena vs. uno que avisa*). Caso testigo, Agro Centros FC 6447: con los precios
 * pactados daba USD 3.874,00 contra 3.831,02; con el 2 % en los agroquímicos cierra al centavo.
 *
 * ## Qué se guarda al confirmar (lo hace el modal; acá sólo se arma)
 * - el vínculo (`productivo.entrega_factura`) con el precio **en pesos** — es lo que lee el consumo;
 * - la compra: `moneda`, `costo_unitario_moneda` = precio real, `tipo_cambio`, y `costo_unitario` en
 *   pesos (toda la app lo lee como pesos: consumo, margen, stock del balance);
 * - el pactado y el % quedan en la **nota del vínculo** — la huella de por qué cambió el precio.
 *
 * Pura: no lee ni escribe la base.
 */

export interface CompraParaVincular {
  id: string
  fecha: string
  producto: string
  unidad: string | null
  cantidad: number
  /** El precio cargado en la compra (el pactado), en la moneda de la factura. */
  precioPactado: number | null
}

export interface RenglonVinculo {
  compraId: string
  incluir: boolean
  /** % de descuento como número: 2 = 2 %. */
  pctDescuento: number
}

export interface RenglonCalculado {
  compra: CompraParaVincular
  pctDescuento: number
  precioReal: number | null
  subtotal: number | null
  precioPesos: number | null
  /** El texto que va a la nota del vínculo: de dónde sale el precio. */
  nota: string
}

export interface CalculoVinculo {
  renglones: RenglonCalculado[]
  total: number
  /** neto de la factura − total (en la moneda de la factura). */
  dif: number
  cierra: boolean
  /** Renglones tildados sin precio: no se pueden valuar. */
  sinPrecio: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const r6 = (n: number) => Math.round(n * 1e6) / 1e6
const nf = (n: number, d = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: Math.max(d, 4) })

/** Un centavo de la moneda de la factura es cero. */
export const TOLERANCIA_VINCULO = 0.01

export function calcularVinculo(
  factura: { moneda: string; neto: number; tc: number },
  compras: CompraParaVincular[],
  renglones: RenglonVinculo[],
): CalculoVinculo {
  const usd = factura.moneda !== 'ARS' && factura.moneda !== 'PES'
  const tc = usd ? (Number(factura.tc) || 0) : 1
  const sim = usd ? factura.moneda : '$'
  const calc: RenglonCalculado[] = []
  let sinPrecio = 0
  for (const r of renglones) {
    if (!r.incluir) continue
    const c = compras.find(x => x.id === r.compraId)
    if (!c) continue
    const pct = Number(r.pctDescuento) || 0
    if (c.precioPactado == null || !(c.precioPactado > 0)) {
      sinPrecio++
      calc.push({ compra: c, pctDescuento: pct, precioReal: null, subtotal: null, precioPesos: null, nota: 'sin precio pactado' })
      continue
    }
    const precioReal = r6(c.precioPactado * (1 - pct / 100))
    const subtotal = r2(c.cantidad * precioReal)
    const precioPesos = tc > 0 ? r6(precioReal * tc) : null
    const nota = `Pactado ${sim} ${nf(c.precioPactado)}`
      + (pct ? ` −${nf(pct, 0)}% = ${sim} ${nf(precioReal)}` : '')
      + (usd ? ` · TC ${nf(tc)}` : '')
    calc.push({ compra: c, pctDescuento: pct, precioReal, subtotal, precioPesos, nota })
  }
  const total = r2(calc.reduce((s, x) => s + (x.subtotal ?? 0), 0))
  const dif = r2((Number(factura.neto) || 0) - total)
  return { renglones: calc, total, dif, cierra: sinPrecio === 0 && Math.abs(dif) <= TOLERANCIA_VINCULO, sinPrecio }
}

/**
 * El descuento que hace cerrar, para sugerirlo: el % que aplicado a los renglones elegidos lleva el
 * total al neto. Con Agro Centros: elegidos los agroquímicos (USD 2.149), falta 42,98 → 2 %.
 * `null` si no hay base para calcularlo.
 */
export function pctQueCierra(
  factura: { neto: number },
  compras: CompraParaVincular[],
  renglones: RenglonVinculo[],
  elegidos: Set<string>,
): number | null {
  let base = 0, resto = 0
  for (const r of renglones) {
    if (!r.incluir) continue
    const c = compras.find(x => x.id === r.compraId)
    if (!c || c.precioPactado == null) continue
    const bruto = c.cantidad * c.precioPactado
    if (elegidos.has(r.compraId)) base += bruto
    else resto += c.cantidad * c.precioPactado * (1 - (Number(r.pctDescuento) || 0) / 100)
  }
  if (base <= 0) return null
  const pct = (1 - ((Number(factura.neto) || 0) - resto) / base) * 100
  return Math.round(pct * 100) / 100
}
