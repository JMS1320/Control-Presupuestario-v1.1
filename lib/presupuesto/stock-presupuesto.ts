/**
 * 🌽 EL STOCK EN EL PRESUPUESTO — lo que hay se usa primero; la compra aparece el mes en que no alcanza (A-FEAT-1663 stock paso 3).
 *
 * JMS 25/11 (objetivo 3): *«atado al stock: consumo cargado + stock medido → cuándo se termina → en ese mes aparece la compra»* ·
 * 26/11: *«la cantidad que falta para cumplir con el objetivo»*.
 *
 * ## El stock con que arranca el presupuesto (al 1° del mes en curso)
 *     stock al inicio = última medición + entradas posteriores − consumo estimado desde la medición
 * El consumo estimado es el MISMO que calcula la grilla para la ración (kg por mes, de los tramos y la curva de peso), prorrateado por
 * días en el mes de la medición. Cada medición nueva lo corrige (es el control: si lo estimado se aleja de lo medido, se ve).
 * Las entradas con fecha futura (compras registradas que todavía no llegaron) NO se suman: su plata va por la compra o la factura.
 *
 * ## El neteo
 * Mes por mes desde el mes en curso, el consumo de cada insumo se cubre primero con el stock; lo cubierto NO es plata del presupuesto
 * (ya se compró). Si en un mes comen varias actividades del mismo insumo, el stock se reparte en proporción. Lo que falta es lo que se
 * presupuesta como compra, en el mes en que falta.
 *
 * Pura; casos en `npm run probar`.
 */

export interface AporteConsumo {
  /** Quién consume: actividad | lote | concepto de la receta. */
  clave: string
  insumoStockId: string
  mes: string            // YYYY-MM
  kg: number
  costo: number          // lo que la grilla presupuesta para ese consumo (con IVA)
}

export interface StockParaPresupuesto {
  id: string
  producto: string
  unidad: string | null
  medicion: { fecha: string; cantidad: number } | null
  entradas: { fecha: string; cantidad: number }[]
}

export interface StockAlInicio {
  kg: number | null
  explicacion: string
  aviso: string | null
}

const diasDelMes = (mes: string) => { const [a, m] = mes.split("-").map(Number); return new Date(Date.UTC(a!, m!, 0)).getUTCDate() }
const ms = (f: string) => Date.parse(f + "T00:00:00Z")
const nf = (n: number) => Math.round(n).toLocaleString("es-AR")
const dmy = (f: string) => f.split("-").reverse().join("/")

/** Consumo estimado entre dos fechas [a, b) con los kg por mes, prorrateado por días. */
export function consumoEntre(kgPorMes: Record<string, number>, a: string, b: string): number {
  if (ms(b) <= ms(a)) return 0
  let total = 0
  for (const [mes, kg] of Object.entries(kgPorMes)) {
    if (!kg) continue
    const ini = ms(`${mes}-01`), fin = ini + diasDelMes(mes) * 86_400_000
    const desde = Math.max(ini, ms(a)), hasta = Math.min(fin, ms(b))
    if (hasta > desde) total += kg * ((hasta - desde) / (fin - ini))
  }
  return total
}

/**
 * `hoy` (A-FEAT-1677 B11): las ENTRADAS del mes en curso que ya ocurrieron (hasta hoy) también están disponibles para el mes — ya se compraron
 * (y si se pagaron, están en el saldo): sin esto la ración del mes las volvía a presupuestar como compra. Sin `hoy`, como antes.
 */
export function stockAlInicio(s: StockParaPresupuesto, kgPorMes: Record<string, number>, inicioMes: string, hoy?: string): StockAlInicio {
  const inicio = `${inicioMes}-01`
  if (!s.medicion) return { kg: null, explicacion: `${s.producto}: sin medición del stock — no se descuenta (medilo desde Productivo → Insumos)`, aviso: "sin medición" }
  const m = s.medicion
  let kg: number, partes: string[]
  if (m.fecha < inicio) {
    const ent = s.entradas.filter(e => e.fecha > m.fecha && (e.fecha < inicio || (!!hoy && e.fecha <= hoy)))
    const sumE = ent.reduce((t, e) => t + (Number(e.cantidad) || 0), 0)
    const cons = consumoEntre(kgPorMes, m.fecha, inicio)
    kg = m.cantidad + sumE - cons
    partes = [`medición ${dmy(m.fecha)}: ${nf(m.cantidad)}`]
    if (ent.length) partes.push(`+ entradas ${ent.map(e => `${dmy(e.fecha)} ${nf(e.cantidad)}`).join(", ")}`)
    partes.push(`− consumo estimado hasta el ${dmy(inicio)}: ${nf(cons)}`)
  } else {
    // Medido en el mes en curso: se lleva hacia atrás al 1° (lo comido desde el 1° vuelve, lo que entró antes de medir se saca).
    // Medido en el mes en curso: lo disponible para el mes = lo medido + lo que se comió desde el 1° hasta la medición (vuelve) + lo que entró
    // DESPUÉS de medir hasta hoy (B11). Lo que entró antes de medir ya está en lo medido.
    const despues = hoy ? s.entradas.filter(e => e.fecha > m.fecha && e.fecha <= hoy) : []
    const sumD = despues.reduce((t, e) => t + (Number(e.cantidad) || 0), 0)
    const cons = consumoEntre(kgPorMes, inicio, m.fecha)
    kg = m.cantidad + cons + sumD
    partes = [`medición ${dmy(m.fecha)}: ${nf(m.cantidad)}`, `+ consumo estimado desde el ${dmy(inicio)}: ${nf(cons)}`]
    if (despues.length) partes.push(`+ entradas ${despues.map(e => `${dmy(e.fecha)} ${nf(e.cantidad)}`).join(", ")}`)
  }
  const u = s.unidad ? ` ${s.unidad}` : ""
  if (kg < 0) return { kg: 0, explicacion: `${s.producto}: ${partes.join(" ")} = ${nf(kg)}${u} → se toma 0`, aviso: "el consumo estimado supera lo medido + lo que entró: conviene medir de nuevo" }
  return { kg, explicacion: `${s.producto} al ${dmy(inicio)}: ${partes.join(" ")} = ${nf(kg)}${u}`, aviso: null }
}

export interface ResultadoNeteo {
  /** `${clave}|${mes}` → lo que cubre el stock (kg y su costo). */
  cubierto: Map<string, { kg: number; costo: number }>
  porInsumo: Record<string, { inicial: number; ultimoMesCubierto: string | null; primerMesCompra: string | null; kgComprar: number; costoComprar: number }>
}

export function netearStock(aportes: AporteConsumo[], stockInicial: Record<string, number | null>, desdeMes: string): ResultadoNeteo {
  const cubierto = new Map<string, { kg: number; costo: number }>()
  const porInsumo: ResultadoNeteo["porInsumo"] = {}
  const insumos = [...new Set(aportes.map(a => a.insumoStockId))]
  for (const id of insumos) {
    const ini = stockInicial[id]
    if (ini == null) continue
    let resto = Math.max(0, ini)
    const r = (porInsumo[id] = { inicial: resto, ultimoMesCubierto: null as string | null, primerMesCompra: null as string | null, kgComprar: 0, costoComprar: 0 })
    const meses = [...new Set(aportes.filter(a => a.insumoStockId === id && a.mes >= desdeMes).map(a => a.mes))].sort()
    for (const mes of meses) {
      const delMes = aportes.filter(a => a.insumoStockId === id && a.mes === mes && a.kg > 0)
      const kgMes = delMes.reduce((t, a) => t + a.kg, 0)
      if (!(kgMes > 0)) continue
      const cubre = Math.min(resto, kgMes)
      const frac = cubre / kgMes
      for (const a of delMes) {
        const k = `${a.clave}|${mes}`
        const prev = cubierto.get(k) ?? { kg: 0, costo: 0 }
        cubierto.set(k, { kg: prev.kg + a.kg * frac, costo: prev.costo + a.costo * frac })
        r.costoComprar += a.costo * (1 - frac)
      }
      resto -= cubre
      if (frac >= 1 - 1e-9) r.ultimoMesCubierto = mes
      else { r.primerMesCompra ??= mes; r.kgComprar += kgMes - cubre }
    }
  }
  return { cubierto, porInsumo }
}
