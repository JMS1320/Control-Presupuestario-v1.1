/**
 * 📍 **A-FEAT-1660 — el presupuesto con la conciliación atrasada: arranque A UNA FECHA, puente y lo impago.**
 *
 * Acordado con JMS el 25/11/2026:
 *   1. El arranque es SIEMPRE con fecha, de una de dos fuentes: **la que declara JMS** (saldo + fecha, con su
 *      composición: cuenta corriente + FCI + otros) o **el último saldo conciliado del extracto** (con su fecha).
 *   2. Si arranca del extracto, entre esa fecha y hoy se resta **lo PAGADO según el sistema** y se suma lo
 *      **COBRADO** (lo que el banco todavía no muestra), renglón por renglón: es el **puente** → saldo estimado de
 *      hoy. Desde hoy, lo **impago** + lo proyectado. Si arranca de su fecha, lo pagado ya está en el saldo.
 *   3. Las impagas **vencidas** (fecha anterior a hoy) se restan en el mes actual, marcadas.
 *   4. **Control** con las dos fuentes: saldo del extracto ± puente vs. saldo declarado; la diferencia es lo que
 *      el banco movió y el sistema no tiene (comisiones, impuestos al débito, débitos automáticos).
 *
 * Las filas «reales» son las MISMAS del Cash Flow (`useMultiCashFlowData`): facturas, cuotas, sueldos,
 * anticipos y ventas que no están conciliadas, ya en pesos. Sin base de datos: se prueba con números.
 */

/** Lo mínimo de una fila del Cash Flow que hace falta para clasificarla. */
export interface FilaReal {
  id: string
  origen: string
  fecha_estimada: string            // YYYY-MM-DD (en un echeq, la fecha de cobro)
  fecha_pago?: string | null
  estado: string
  medio_pago?: string | null
  debitos: number
  creditos: number
  nombre_proveedor?: string
  detalle?: string
  nro_cuenta?: string | null
  /** La tabla de origen (como en el Cash Flow): con el id, identifica la marca del presupuesto. */
  origen_tabla?: string
}

/** 🏷️ Etapa 2 — lo que JMS dice de un renglón no conciliado (tabla `presupuesto_marcas`). */
export type MarcaPresupuesto = 'pagado' | 'cobrado' | 'impago' | 'no_concretado' | 'impacta'
/** La clave de una marca: tabla de origen + id. */
export const claveMarca = (f: Pick<FilaReal, 'id' | 'origen_tabla'>) => `${f.origen_tabla || ''}|${f.id}`
/** Marcas que dicen «esto ya no se mueve»: el renglón sale de lo impago. */
export const MARCAS_QUE_SACAN: ReadonlySet<string> = new Set(['pagado', 'cobrado', 'no_concretado'])

/**
 * ¿La grilla del presupuesto ya trae este renglón en su mes? Una venta registrada de **hacienda** (liquidación en
 * `comprobantes_venta`) NO: la grilla proyecta hacienda sobre el stock que queda, no las ventas ya hechas. El resto sí
 * (cuotas, sueldos, arrendamientos; las facturas, por la proyección de su cuenta).
 * 🐞 25/11: marcar «cobrada» la cuota 3 de Genta ($ 32,3 M) la restaba del mes aunque el mes nunca la había sumado.
 */
export function estaEnLaGrilla(f: Pick<FilaReal, 'origen' | 'origen_tabla' | 'detalle'>): boolean {
  return !esLiquidacionHacienda(f)
}

/**
 * Una liquidación de hacienda registrada (el Cash Flow la arma con detalle «Liquidación hacienda…», cuota por cuota).
 * Las demás ventas registradas (p. ej. la factura del arrendamiento) ya están en la grilla, en lo «fijado» del campo.
 */
export function esLiquidacionHacienda(f: Pick<FilaReal, 'origen' | 'origen_tabla' | 'detalle'>): boolean {
  return f.origen === 'VENTA' && String(f.origen_tabla || '').endsWith('comprobantes_venta')
    && String(f.detalle || '').startsWith('Liquidación hacienda')
}

export type ClaseArranque =
  | 'en_saldo'      // ya está adentro del saldo de arranque: no se resta
  | 'puente'        // pagado/cobrado entre el arranque y hoy: se resta/suma para llegar al saldo de hoy
  | 'vencido'       // impago de un mes anterior al actual: se resta en el mes actual
  | 'impago'        // impago del mes actual en adelante: va en su mes (ya lo trae el presupuesto)
  | 'otra_cuenta'   // se paga desde otra cuenta (cajas, cotitulares…): no mueve este saldo

/** Medios de pago que mueven la cuenta corriente (el saldo de arranque). */
const MEDIOS_DE_LA_CUENTA = new Set(['', 'banco', 'msa_galicia'])
/** Estados que dicen que la plata YA salió (o entró). */
const YA_SALIO = new Set(['pagado', 'debito', 'cobrado', 'conciliado'])

/** El día en que la plata se mueve: un echeq, cuando se cobra; lo demás, la fecha de pago o la estimada. */
export function fechaDeCaja(f: FilaReal): string {
  if (norm(f.estado) === 'echeq') return f.fecha_estimada
  return f.fecha_pago || f.fecha_estimada
}

/** ¿La plata de esta fila ya se movió al día `hoy`? */
export function yaSeMovio(f: FilaReal, hoy: string): boolean {
  const e = norm(f.estado)
  if (YA_SALIO.has(e)) return true
  if (e === 'echeq') return !!f.fecha_estimada && f.fecha_estimada <= hoy
  return false
}

export function clasificarFila(f: FilaReal, fechaArranque: string, hoy: string): ClaseArranque {
  if (!MEDIOS_DE_LA_CUENTA.has(norm(f.medio_pago))) return 'otra_cuenta'
  if (yaSeMovio(f, hoy)) {
    const fc = fechaDeCaja(f)
    if (!fc || fc <= fechaArranque) return 'en_saldo'
    if (fc <= hoy) return 'puente'
    return 'impago'   // registrado como pagado con fecha futura: todavía no salió
  }
  // Vencido = impago de un mes ANTERIOR al actual. Lo impago del mes actual (aunque su día ya pasó) ya está en
  // la columna del mes actual del presupuesto: sumarlo también como vencido lo contaría dos veces.
  if (f.fecha_estimada && f.fecha_estimada < `${hoy.slice(0, 7)}-01`) return 'vencido'
  return 'impago'
}

/** Efecto de la fila en la caja: lo cobrado suma, lo pagado resta. */
export const efecto = (f: FilaReal) => (Number(f.creditos) || 0) - (Number(f.debitos) || 0)

export const mesDe = (fecha: string) => fecha.slice(0, 7)

export interface ResultadoArranque {
  fuente: 'declarado' | 'extracto'
  fechaArranque: string
  saldoArranque: number
  puente: { filas: FilaReal[]; egresos: number; ingresos: number; neto: number }
  /** Saldo de arranque + neto del puente. Con fuente «declarado» y fecha = hoy, es el mismo saldo. */
  saldoHoy: number
  vencidos: { filas: FilaReal[]; egresos: number; ingresos: number; neto: number }
  /** Lo impago del mes en curso con fecha de hoy o anterior: sigue en la columna del mes, pero se puede marcar. */
  mesEnCurso: { filas: FilaReal[]; egresos: number; ingresos: number; neto: number; fueraDeGrillaNeto: number }
  /** Lo dado por pagado/cobrado/no concretado (marcas): de vencidos (sale) y del mes en curso (se devuelve al mes). */
  marcados: { vencidos: FilaReal[]; mesEnCurso: FilaReal[] }
  /** Impagos de hoy en adelante, por mes (neto: ingresos − egresos). Informativo: el mes los trae del presupuesto. */
  impagosPorMes: Record<string, number>
  otraCuenta: { cantidad: number; neto: number }
  enSaldo: number
}

export function calcularArranque(p: {
  fuente: 'declarado' | 'extracto'
  fechaArranque: string
  saldoArranque: number
  hoy: string
  filas: FilaReal[]
  /** Marcas del presupuesto por `claveMarca`. Sin marcas, se comporta como la etapa 1. */
  marcas?: Record<string, MarcaPresupuesto>
}): ResultadoArranque {
  const puente: FilaReal[] = []
  const vencidos: FilaReal[] = []
  const enCurso: FilaReal[] = []
  const marcVenc: FilaReal[] = [], marcCurso: FilaReal[] = []
  const mesHoy = p.hoy.slice(0, 7)
  const saca = (f: FilaReal) => MARCAS_QUE_SACAN.has(String(p.marcas?.[claveMarca(f)] ?? ''))
  const impagosPorMes: Record<string, number> = {}
  let otraCant = 0, otraNeto = 0, enSaldo = 0
  for (const f of p.filas) {
    const c = clasificarFila(f, p.fechaArranque, p.hoy)
    if (c === 'puente') puente.push(f)
    else if (c === 'vencido') (saca(f) ? marcVenc : vencidos).push(f)
    else if (c === 'impago') {
      const fc = fechaDeCaja(f), m = mesDe(fc)
      if (m === mesHoy && fc <= p.hoy) { (saca(f) ? marcCurso : enCurso).push(f); if (saca(f)) continue }
      impagosPorMes[m] = r2((impagosPorMes[m] || 0) + efecto(f))
    }
    else if (c === 'otra_cuenta') { otraCant++; otraNeto += efecto(f) }
    else enSaldo++
  }
  const sumar = (fs: FilaReal[]) => {
    const egresos = r2(fs.reduce((s, f) => s + (Number(f.debitos) || 0), 0))
    const ingresos = r2(fs.reduce((s, f) => s + (Number(f.creditos) || 0), 0))
    return { egresos, ingresos, neto: r2(ingresos - egresos) }
  }
  const ordenar = (fs: FilaReal[]) => fs.slice().sort((a, b) => fechaDeCaja(a).localeCompare(fechaDeCaja(b)))
  const pu = { filas: ordenar(puente), ...sumar(puente) }
  const ve = { filas: ordenar(vencidos), ...sumar(vencidos) }
  // Lo del mes en curso sin marcar que la grilla NO trae (ventas de hacienda registradas): se suma en el mes, como un vencido.
  const mc = { filas: ordenar(enCurso), ...sumar(enCurso), fueraDeGrillaNeto: r2(enCurso.filter(f => !estaEnLaGrilla(f)).reduce((s, f) => s + efecto(f), 0)) }
  return {
    fuente: p.fuente, fechaArranque: p.fechaArranque, saldoArranque: r2(p.saldoArranque),
    puente: pu, saldoHoy: r2(p.saldoArranque + pu.neto),
    vencidos: ve, mesEnCurso: mc, marcados: { vencidos: ordenar(marcVenc), mesEnCurso: ordenar(marcCurso) }, impagosPorMes, otraCuenta: { cantidad: otraCant, neto: r2(otraNeto) }, enSaldo,
  }
}

/**
 * La línea de saldo del presupuesto, desde el mes actual. Los meses anteriores quedan vacíos: lo que pasó
 * entre el arranque y hoy ya está en el saldo de hoy (por el puente).
 *
 *   mes actual = saldo de hoy + vencidos + flujo del mes según el presupuesto + ajuste
 *   meses siguientes = anterior + flujo del mes
 *
 * `ajusteMesActual` devuelve al mes actual lo que el presupuesto resta pero ya salió y está en el saldo
 * (cuotas del mes ya pagadas, facturas del mes ya pagadas contra la proyección de su cuenta). Positivo.
 */
export function lineaDeSaldo(p: {
  meses: string[]                       // claves YYYY-MM en orden
  mesActual: string
  saldoHoy: number
  vencidosNeto: number                  // negativo si son egresos
  flujoPorMes: Record<string, number>   // ingresos − egresos del presupuesto
  ajusteMesActual: number
}): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  let acum: number | null = null
  for (const m of p.meses) {
    if (m < p.mesActual) { out[m] = null; continue }
    if (acum === null) acum = p.saldoHoy + p.vencidosNeto + p.ajusteMesActual
    acum += p.flujoPorMes[m] || 0
    out[m] = r2(acum)
  }
  return out
}

/** Control de las dos fuentes: lo que da el extracto llevado a hoy contra lo que declaró JMS. */
export function controlDosFuentes(saldoHoyDesdeExtracto: number, saldoDeclarado: number) {
  const diferencia = r2(saldoDeclarado - saldoHoyDesdeExtracto)
  return { diferencia, cierra: Math.abs(diferencia) < 1 }
}

/** La suma de la composición (cuenta corriente + FCI + otros). */
export function totalComposicion(c: Array<{ cuenta: string; monto: number }> | null | undefined): number {
  return r2((c || []).reduce((s, x) => s + (Number(x.monto) || 0), 0))
}

const r2 = (n: number) => Math.round(n * 100) / 100
function norm(s: string | null | undefined) { return String(s ?? '').trim().toLowerCase() }
