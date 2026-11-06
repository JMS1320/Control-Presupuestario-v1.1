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

/**
 * 🛒 **A-FEAT-1557 etapa 3 — al llegar la factura, proponer las COMPRAS SIN FACTURA de ese proveedor.**
 *
 * La compra es el primer registro (renglones con el mismo `compra_id`); cuando entra la factura, el modal
 * propone la compra que mejor encaja: agrupa los renglones libres (sin factura propia ni de otra) por
 * compra, suma cantidad × precio pactado y ordena por cercanía al neto. `coincide` = la diferencia es de
 * hasta 0,5 % del neto (o un centavo): el proveedor suele redondear. **No tilda solo** — el usuario lo
 * pidió (*«no sabemos cómo van a facturar»*): propone, y un click tilda la compra entera.
 */
export interface RenglonDeCompra {
  id: string
  compra_id: string | null
  fecha: string
  cantidad: number
  precioPactado: number | null
  /** Ya vinculado a alguna factura (ésta u otra): no se propone. */
  conFactura: boolean
}

export interface CompraPropuesta {
  compra_id: string
  fecha: string
  ids: string[]
  monto: number
  sinPrecio: number
  /** neto − monto */
  dif: number
  coincide: boolean
}

export function proponerCompras(neto: number, renglones: RenglonDeCompra[]): CompraPropuesta[] {
  const grupos = new Map<string, RenglonDeCompra[]>()
  for (const r of renglones) {
    if (!r.compra_id || r.conFactura) continue
    grupos.set(r.compra_id, [...(grupos.get(r.compra_id) ?? []), r])
  }
  const n = Number(neto) || 0
  const tol = Math.max(TOLERANCIA_VINCULO, Math.abs(n) * 0.005)
  return [...grupos.entries()].map(([compra_id, rs]) => {
    const monto = r2(rs.reduce((s, r) => s + (r.precioPactado != null && r.precioPactado > 0 ? r.cantidad * r.precioPactado : 0), 0))
    const sinPrecio = rs.filter(r => !(r.precioPactado != null && r.precioPactado > 0)).length
    const dif = r2(n - monto)
    return { compra_id, fecha: rs.map(r => r.fecha).sort()[0], ids: rs.map(r => r.id), monto, sinPrecio, dif, coincide: sinPrecio === 0 && Math.abs(dif) <= tol }
  }).sort((a, b) => Number(b.coincide) - Number(a.coincide) || Math.abs(a.dif) - Math.abs(b.dif) || a.fecha.localeCompare(b.fecha))
}

/**
 * El aviso en la lista de facturas: cuántas compras sin factura tiene el proveedor de ESTA factura.
 * Sólo si la factura todavía no está vinculada a nada y no es anterior a la primera compra libre en más
 * de 30 días (una factura vieja no puede ser de una compra nueva).
 */
export function comprasSinFacturaDelProveedor(
  factura: { id: string; cuit: string | null; fecha: string },
  porCuit: Map<string, { n: number; desde: string }>,
  facturasVinculadas: Set<string>,
): number {
  if (!factura.cuit || facturasVinculadas.has(factura.id)) return 0
  const p = porCuit.get(String(factura.cuit).replace(/\D/g, ''))
  if (!p || !p.n) return 0
  const limite = new Date(p.desde + 'T12:00:00'); limite.setDate(limite.getDate() - 30)
  return factura.fecha >= limite.toISOString().slice(0, 10) ? p.n : 0
}
