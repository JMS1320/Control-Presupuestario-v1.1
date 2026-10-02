/**
 * 🐂 **LA VENTA DE HACIENDA VISTA DESDE INGRESOS — y su liquidación.** A-BUG-1232 · A-FEAT-1225.
 *
 * La venta se carga en Productivo (`productivo.stock_ventas`) y la solapa Ventas de Ingresos no la
 * veía: miraba sólo el circuito de granos. Este archivo junta lo que Ingresos necesita saber de una
 * venta de hacienda, con **las mismas cuentas** que usa Productivo, para que el número de una
 * pantalla y el de la otra no puedan diferir.
 *
 * ## ⚠️ El desbaste se guarda como FRACCIÓN, no como porcentaje
 * `stock_ventas.pct_desbaste = 0.03` quiere decir 3 %. Así lo usan `lib/presupuesto/margen.ts` y
 * `lib/ganaderia/ciclo.ts` (`kg * (1 - pct_desbaste)`). Tratarlo como 3 (porcentaje) daría kilos
 * negativos sin avisar.
 *
 * ## 🔑 El neto de la venta se LEE, no se recalcula
 * `monto_neto` es lo que Productivo guardó al cerrar la venta (kilos desbastados × precio, menos CZ
 * y flete — `netoDeVenta()` en `lib/ganaderia/confirmar-venta.ts`). Recalcularlo acá sería una
 * segunda versión de la misma cuenta: el día que Productivo cambie la suya, las dos dejan de
 * coincidir y nadie se entera (§ ♻️ de `CLAUDE.md`).
 */

import { netoDeVenta } from '@/lib/ganaderia/confirmar-venta'

/** Kilos que se venden después del desbaste. `pctDesbaste` es FRACCIÓN (0.03 = 3 %). */
export function kgNetosDeVenta(kgTotales: number | null | undefined, pctDesbaste: number | null | undefined): number {
  const kg = Number(kgTotales) || 0
  const d = Number(pctDesbaste) || 0
  return kg * (1 - d)
}

/**
 * 🥩 **Los kilos que se COBRAN** de una venta. Pedido del usuario 2026-10-02 al ir a liquidar Arre Beef.
 *
 * - Venta **al gancho** (a frigorífico, por kilo de carne): `kg_carne`. Arre Beef: 1.748 kg de carne
 *   × $5.949,49 ≈ $10.399.700, cuando los kilos vivos eran 3.640.
 * - Venta **en pie**: kilos vivos menos el desbaste.
 *
 * 🧨 Usar los vivos en una venta al gancho duplicaba el importe esperado y llenaba la liquidación de
 * avisos falsos: 3.640 × $5.949,49 = $21,6 M contra un neto real de $10,4 M.
 */
export function kgQueSeCobran(v: { kgTotales: number | null | undefined; pctDesbaste: number | null | undefined; kgCarne?: number | null }): number {
  const carne = Number(v.kgCarne) || 0
  return carne > 0 ? carne : kgNetosDeVenta(v.kgTotales, v.pctDesbaste)
}

/**
 * Varias ventas que se liquidan en UN solo papel (Arre Beef: 7 vacas y 3 toros, una liquidación).
 * Para comparar contra la liquidación se suman: cabezas, kilos que se cobran y neto; el precio es el
 * promedio ponderado, que es el que da el neto total sobre los kilos totales.
 */
export function ventaParaComparar(ventas: { cabezas: number; kgTotales: number; pctDesbaste: number; kgCarne?: number | null; neto: number }[]): VentaParaLiquidar | null {
  if (!ventas.length) return null
  const cabezas = ventas.reduce((s, v) => s + (Number(v.cabezas) || 0), 0)
  const kgNetos = ventas.reduce((s, v) => s + kgQueSeCobran(v), 0)
  const neto = ventas.reduce((s, v) => s + (Number(v.neto) || 0), 0)
  return { cabezas, kgNetos, neto, precioKg: kgNetos > 0 ? neto / kgNetos : 0 }
}

/** Peso promedio por cabeza. Sin cabezas, cero (no se divide por cero ni se inventa). */
export function promedioKg(kg: number | null | undefined, cabezas: number | null | undefined): number {
  const c = Number(cabezas) || 0
  return c > 0 ? (Number(kg) || 0) / c : 0
}

/**
 * La categoría productiva de una venta. Una venta **con lote** la toma del lote; una **suelta**, de
 * su `categoria_id`. Mirar sólo `categoria_id` hace parecer «sin categoría» a las ventas por lote —
 * pasó el 2026-10-01 con los 55 de Pedro Genta, que son *Ternero Recría* por su lote.
 */
export function categoriaDeVenta(categoriaDelLote: string | null | undefined, categoriaDirecta: string | null | undefined): string | null {
  return (categoriaDelLote || categoriaDirecta || '').trim() || null
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 🧾 LA LIQUIDACIÓN DE HACIENDA — tipo 60, «Cuenta de Venta y Líquido Producto A» (A-FEAT-1225)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Es la liquidación del consignatario. Se parece a la de granos, pero NO es la misma:
//   · el IVA se cobra ENTERO (en granos el comprador lo retiene por RG 2300);
//   · Ingresos Brutos se retiene sobre el BRUTO, no sobre el neto;
//   · trae datos productivos: cabezas, kilos, promedio, clasificación, guía y DTe.
//
// 🧮 Las cuentas, verificadas al centavo con dos liquidaciones reales (27/01 y 04/08/2026):
//     bruto          = suma de kilos × precio de cada línea
//     comisión       = bruto × % de comisión
//     neto gravado   = bruto − comisión + ajuste por redondeo (el redondeo viene impreso, con signo)
//     IVA            = neto gravado × alícuota
//     importe neto   = neto gravado + IVA − retenciones impresas
//
// 🔑 El redondeo NO se calcula: se copia del papel. En los dos papeles reales deja el precio
// después de comisión en un número redondo (4.515,75 y 5.675,00 $/kg), pero eso es una regla del
// consignatario, no nuestra — inferirla de dos casos sería inventarla.

/** Una fila de la tabla del papel: un comprador y una clasificación. */
export interface LineaLiqHacienda {
  razonSocial: string
  cuit: string
  cabezas: number
  clasificacion: string
  kilos: number
  /** $ por kilo. */
  precio: number
}

/** Una retención impresa en el papel (IIBB, Ganancias…). `importe` en positivo: se descuenta. */
export interface RetencionImpresa {
  concepto: string
  /** Alícuota en PORCENTAJE (0,75 = 0,75 %), como en el papel. */
  alicuota: number
  importe: number
}

export interface LiqHaciendaEntrada {
  lineas: LineaLiqHacienda[]
  /** Comisión en PORCENTAJE sobre el bruto (2,319 = 2,319 %). */
  comisionPct: number
  /** Ajuste por redondeo, con el signo del papel (−1.193,64). */
  redondeo: number
  /** IVA en PORCENTAJE (10,5). */
  ivaPct: number
  retenciones: RetencionImpresa[]
  /**
   * 🎚️ Montos tipeados a mano (§ Default del dato real, siempre editable). Pedido del usuario
   * 2026-10-01: *«cosas como comisión deben poder tipearse el monto, por si se calcula sobre otra
   * cosa»*. Vacío (null/undefined) = se calcula con el %; con valor = manda el tipeado, y el % que
   * se muestra pasa a ser el que resulta.
   */
  comisionMonto?: number | null
  ivaMonto?: number | null
}

export interface LiqHaciendaCalculo {
  cabezas: number
  kilos: number
  promedio: number
  bruto: number
  comision: number
  netoGravado: number
  iva: number
  totalRetenciones: number
  /** Lo que se cobra: neto gravado + IVA − retenciones impresas. */
  importeNeto: number
  /** El «TOTAL» del papel: la columna de gastos, IVA y retenciones sumada con su signo. */
  columnaGastos: number
  /** Neto gravado / kilos: el precio por kilo que queda después de la comisión. */
  precioPostComision: number
  /** El % que resulta del monto de comisión (si se tipeó el monto, es el que corresponde a ése). */
  comisionPctEfectivo: number
  /** Ídem para el IVA. */
  ivaPctEfectivo: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** El importe que sugiere la app para una retención: alícuota sobre el BRUTO. */
export function retencionSugerida(bruto: number, alicuotaPct: number): number {
  return r2(bruto * (Number(alicuotaPct) || 0) / 100)
}

export function calcularLiqHacienda(e: LiqHaciendaEntrada): LiqHaciendaCalculo {
  const cabezas = e.lineas.reduce((s, l) => s + (Number(l.cabezas) || 0), 0)
  const kilos = e.lineas.reduce((s, l) => s + (Number(l.kilos) || 0), 0)
  const bruto = r2(e.lineas.reduce((s, l) => s + (Number(l.kilos) || 0) * (Number(l.precio) || 0), 0))
  const tipeado = (x: number | null | undefined) => x !== null && x !== undefined && Number.isFinite(Number(x))
  const comision = tipeado(e.comisionMonto) ? r2(Number(e.comisionMonto)) : r2(bruto * (Number(e.comisionPct) || 0) / 100)
  const redondeo = Number(e.redondeo) || 0
  const netoGravado = r2(bruto - comision + redondeo)
  const iva = tipeado(e.ivaMonto) ? r2(Number(e.ivaMonto)) : r2(netoGravado * (Number(e.ivaPct) || 0) / 100)
  const totalRetenciones = r2(e.retenciones.reduce((s, x) => s + (Number(x.importe) || 0), 0))
  const importeNeto = r2(netoGravado + iva - totalRetenciones)
  return {
    cabezas, kilos, promedio: promedioKg(kilos, cabezas),
    bruto, comision, netoGravado, iva, totalRetenciones, importeNeto,
    columnaGastos: r2(iva - comision + redondeo - totalRetenciones),
    precioPostComision: kilos > 0 ? netoGravado / kilos : 0,
    comisionPctEfectivo: bruto > 0 ? comision / bruto * 100 : 0,
    ivaPctEfectivo: netoGravado > 0 ? iva / netoGravado * 100 : 0,
  }
}

// ── Los avisos ──────────────────────────────────────────────────────────────────────────────
// § 🚦 de CLAUDE.md: son de DISCREPANCIA — avisan y dejan guardar. Un papel puede traer algo que
// sólo el usuario sabe explicar, y frenar ahí le saca la herramienta.

export interface AvisoLiq {
  /** `ok` se muestra como ✓ discreto; `aviso` como alerta. Nunca se esconde ninguno. */
  nivel: 'ok' | 'aviso'
  tema: string
  mensaje: string
  diferencia?: number
}

/** Un centavo de diferencia es cero: los papeles redondean al centavo. */
const CENTAVO = 0.015

/**
 * Lo que la app calcula contra lo que dice el papel. Si no coinciden, casi siempre es un número
 * mal tipeado — el aviso dice cuál, para no tener que buscarlo.
 */
export function controlContraPapel(
  calc: LiqHaciendaCalculo,
  papel: { bruto?: number | null; netoGravado?: number | null; importeNeto?: number | null },
): AvisoLiq[] {
  const filas: [string, number, number | null | undefined][] = [
    ['Importe bruto', calc.bruto, papel.bruto],
    ['Neto gravado', calc.netoGravado, papel.netoGravado],
    ['Importe neto', calc.importeNeto, papel.importeNeto],
  ]
  return filas
    .filter(([, , p]) => p !== null && p !== undefined && Number(p) !== 0)
    .map(([tema, c, p]): AvisoLiq => {
      const dif = r2(c - Number(p))
      return Math.abs(dif) < CENTAVO
        ? { nivel: 'ok', tema, mensaje: tema + ': coincide con el papel' }
        : { nivel: 'aviso', tema, diferencia: dif,
            mensaje: tema + ': la cuenta da ' + (dif > 0 ? 'más' : 'menos') + ' que el papel — revisá lo cargado' }
    })
}

/** Lo que Ingresos sabe de la venta, para compararla con su liquidación. */
export interface VentaParaLiquidar {
  cabezas: number
  /** Kilos DESPUÉS del desbaste: los que se cobran. */
  kgNetos: number
  precioKg: number
  /** El neto que guardó Productivo (kilos netos × precio, menos CZ y flete). */
  neto: number
}

const fmt2 = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * 🔑 **La paridad que pidió el usuario — subtotal contra subtotal.** Él pacta el precio DESPUÉS de
 * comisión: la venta dice comisión 0 y la liquidación trae comisión, pero también un precio más
 * alto. Lo que tiene que coincidir es lo que queda después de la comisión:
 *
 *     venta:        kg netos × precio pactado                       = neto de la venta
 *     liquidación:  kg × precio del papel − comisión (+ redondeo)   = neto gravado
 *
 * Tolerancia: medio kilo al precio después de comisión — el papel redondea los kilos a enteros, y
 * ésa es la única diferencia que se explica sola. Más que eso se avisa, con el monto y con la
 * diferencia por kilo, que es como se pacta.
 */
export function compararConVenta(venta: VentaParaLiquidar, calc: LiqHaciendaCalculo): AvisoLiq[] {
  const avisos: AvisoLiq[] = []

  avisos.push(venta.cabezas === calc.cabezas
    ? { nivel: 'ok', tema: 'Cabezas', mensaje: 'Cabezas: ' + calc.cabezas + ', igual que la venta' }
    : { nivel: 'aviso', tema: 'Cabezas', diferencia: calc.cabezas - venta.cabezas,
        mensaje: 'Cabezas: la liquidación trae ' + calc.cabezas + ' y la venta ' + venta.cabezas })

  const difKg = r2(calc.kilos - venta.kgNetos)
  avisos.push(Math.abs(difKg) < 0.5
    ? { nivel: 'ok', tema: 'Kilos', mensaje: 'Kilos: coinciden con los kilos netos de la venta' }
    : { nivel: 'aviso', tema: 'Kilos', diferencia: difKg,
        mensaje: 'Kilos: la liquidación trae ' + (difKg > 0 ? 'más' : 'menos') + ' kilos que la venta después del desbaste' })

  const tolerancia = 0.5 * Math.max(calc.precioPostComision, 0)
  const difSub = r2(calc.netoGravado - venta.neto)
  const difPorKg = r2(calc.precioPostComision - venta.precioKg)
  avisos.push(Math.abs(difSub) <= tolerancia
    ? { nivel: 'ok', tema: 'Subtotal', mensaje: 'Subtotal después de comisión: igual al neto de la venta' }
    : { nivel: 'aviso', tema: 'Subtotal', diferencia: difSub,
        mensaje: 'Subtotal después de comisión: ' + (difSub > 0 ? 'más' : 'menos') + ' que el neto de la venta' +
          ' (precio después de comisión ' + (difPorKg > 0 ? '+' : '') + fmt2(difPorKg) + ' $/kg contra el pactado)' })

  return avisos
}

/**
 * 🎚️ **La precarga desde la venta — «chupar los datos»** (A-FEAT-1225, paso 3).
 *
 * De la venta salen: cabezas, kilos NETOS (después del desbaste, redondeados como en el papel),
 * precio pactado, clasificación, comprador y fecha; la comisión, del % de CZ de la venta.
 *
 * 📌 Con lo precargado tal cual, la liquidación da EXACTO la venta —es la misma cuenta—, así que no
 * hay avisos. Cuando el usuario tipea lo que dice su papel (otro precio, otra comisión), recién ahí
 * aparece la diferencia. Por eso la comparación se hace siempre contra la venta ORIGINAL.
 */
export function precargaDesdeVenta(v: {
  fecha: string; cliente: string; cuit: string; categoria: string | null
  cabezas: number; kgTotales: number; pctDesbaste: number; precioKg: number; pctCz?: number | null; kgCarne?: number | null
}): { fecha: string; linea: LineaLiqHacienda; comisionPct: number } {
  return {
    fecha: v.fecha || '',
    linea: {
      razonSocial: v.cliente || '', cuit: v.cuit || '',
      cabezas: Number(v.cabezas) || 0,
      clasificacion: v.categoria || '',
      // Al gancho, los kilos de carne; en pie, los vivos menos desbaste (kgQueSeCobran).
      kilos: Math.round(kgQueSeCobran(v)),
      precio: Number(v.precioKg) || 0,
    },
    // pct_cz es FRACCIÓN en la venta; la comisión del papel va en PORCENTAJE.
    comisionPct: Math.round((Number(v.pctCz) || 0) * 100 * 1000) / 1000,
  }
}

/**
 * 🐾 **LA HUELLA de una liquidación** — § 📄 de `CLAUDE.md`: *«cada corrección deja huella: lo que
 * leyó el parser junto a lo que puso el usuario»*. Acá no hay parser: lo que **propone la app** es
 * la precarga desde la venta y las cuentas con porcentaje. Se guarda, al lado, lo que el usuario
 * dejó. Pedido del usuario 2026-10-01 (*«sí»* a guardar las marcas y lo tipeado a mano).
 *
 * Sin las dos puntas no sirve: saber que se tocó la comisión no dice nada; saber que la app
 * calculó 0 y el usuario puso 1.050.807,25 dice dónde falla y cuánto.
 *
 * Devuelve `null` cuando no hay nada que registrar, para no llenar la tabla de objetos vacíos.
 */
export interface HuellaLiq {
  version: 1
  /** Montos tipeados a mano: lo que daba el %, y lo que se puso. */
  montosAMano: { comision?: { calculado: number; tipeado: number }; iva?: { calculado: number; tipeado: number } }
  /** Las marcas ✓ / ✗ contra el papel, por total. */
  contraElPapel: Partial<Record<'bruto' | 'neto' | 'importe', { estado: 'coincide'; app: number } | { estado: 'distinto'; app: number; papel: number }>>
  /** Qué cambió el usuario de lo que se precargó desde la venta. */
  precarga: { ventaId: string; cambios: { campo: string; precargado: string | number; guardado: string | number }[] } | null
}

export function huellaLiquidacion(a: {
  calc: LiqHaciendaCalculo
  /** La misma cuenta con los montos a mano sacados: lo que habría dado el %. */
  calcSinAMano: LiqHaciendaCalculo
  comisionAMano: boolean
  ivaAMano: boolean
  marcas: Partial<Record<'bruto' | 'neto' | 'importe', { estado: 'ok' | 'distinto'; papel?: number | null }>>
  precarga: { ventaId: string; linea: LineaLiqHacienda; comisionPct: number } | null
  guardado: { linea: LineaLiqHacienda | null; comisionPct: number }
}): HuellaLiq | null {
  const montosAMano: HuellaLiq['montosAMano'] = {}
  if (a.comisionAMano) montosAMano.comision = { calculado: a.calcSinAMano.comision, tipeado: a.calc.comision }
  if (a.ivaAMano) montosAMano.iva = { calculado: a.calcSinAMano.iva, tipeado: a.calc.iva }

  const valorApp = { bruto: a.calc.bruto, neto: a.calc.netoGravado, importe: a.calc.importeNeto }
  const contraElPapel: HuellaLiq['contraElPapel'] = {}
  for (const id of ['bruto', 'neto', 'importe'] as const) {
    const m = a.marcas[id]
    if (!m) continue
    if (m.estado === 'ok') contraElPapel[id] = { estado: 'coincide', app: valorApp[id] }
    else if (m.papel !== null && m.papel !== undefined) contraElPapel[id] = { estado: 'distinto', app: valorApp[id], papel: Number(m.papel) }
  }

  let precarga: HuellaLiq['precarga'] = null
  if (a.precarga && a.guardado.linea) {
    const p = a.precarga.linea, g = a.guardado.linea
    const cambios: { campo: string; precargado: string | number; guardado: string | number }[] = []
    const comparar = (campo: string, x: string | number, y: string | number) => { if (String(x) !== String(y)) cambios.push({ campo, precargado: x, guardado: y }) }
    comparar('cabezas', p.cabezas, g.cabezas)
    comparar('kilos', p.kilos, g.kilos)
    comparar('precio', p.precio, g.precio)
    comparar('clasificacion', p.clasificacion, g.clasificacion)
    comparar('comprador', p.razonSocial, g.razonSocial)
    comparar('comisionPct', a.precarga.comisionPct, a.guardado.comisionPct)
    precarga = { ventaId: a.precarga.ventaId, cambios }
  }

  const hayAlgo = Object.keys(montosAMano).length > 0 || Object.keys(contraElPapel).length > 0 || (precarga !== null && precarga.cambios.length > 0)
  return hayAlgo ? { version: 1, montosAMano, contraElPapel, precarga } : null
}

/**
 * 📅 **Las cuotas que el Cash Flow espera cobrar** de una liquidación con plazos.
 * Lo imputado aparte (anticipos, certificados) cancela primero las cuotas más viejas; una cuota
 * cancelada entera no aparece. Sin plazos, una sola fila por el cobro entero.
 */
export function cuotasPorCobrar(
  plazos: { vencimiento?: string; importe?: number | string; estado?: string }[] | null | undefined,
  cobroTotal: number,
  imputado: number,
  fechaSinPlazos: string,
): { n: number; de: number; vencimiento: string; importe: number; estado?: string }[] {
  const cuotas = (Array.isArray(plazos) ? plazos : []).filter(q => Number(q?.importe) > 0)
  if (!cuotas.length) return [{ n: 1, de: 1, vencimiento: fechaSinPlazos, importe: r2(cobroTotal) }]
  let porCancelar = Math.max(Number(imputado) || 0, 0)
  const salida: { n: number; de: number; vencimiento: string; importe: number; estado?: string }[] = []
  cuotas.forEach((q, i) => {
    const importe = Number(q.importe) || 0
    const cancelado = Math.min(porCancelar, importe)
    porCancelar -= cancelado
    const resta = r2(importe - cancelado)
    if (resta > 0.01) salida.push({ n: i + 1, de: cuotas.length, vencimiento: q.vencimiento || fechaSinPlazos, importe: resta, ...(q.estado ? { estado: q.estado } : {}) })
  })
  return salida
}

/**
 * ✅ **MARCAR UNA CUOTA COMO COBRADA** — el mismo cambio desde Cobros y desde el Cash Flow.
 *
 * Pedido del usuario 2026-10-02: *«cobros debería mostrar los 3 plazos y ahí poder poner cobrado
 * cada uno. Poner cobrado dijimos que es un ídem de que en cash flow esté como cobrado en verde, y
 * puede no estar conciliado»*. Y su regla de siempre: *«son 2 lugares donde se puede marcar como
 * cobrado, pero el cambio en BBDD debe ser el mismo»*. Por eso es UNA función y la usan los dos.
 *
 * - Se marca la cuota (`plazos[i].estado`); el comprobante pasa a `cobrado` recién cuando lo están
 *   **todas**, y vuelve a `a cobrar` si se desmarca una.
 * - `conciliado` no se toca: lo decide la conciliación con el banco, no esta marca.
 */
export function marcarCuota(
  plazos: PlazoCobro[], indice: number, estado: 'cobrado' | 'a cobrar', estadoComprobante: string | null,
): { plazos: PlazoCobro[]; estadoComprobante: string } {
  const nuevos = plazos.map((p, i) => (i === indice ? { ...p, estado } : p))
  if (estadoComprobante === 'conciliado') return { plazos: nuevos, estadoComprobante: 'conciliado' }
  const todas = nuevos.length > 0 && nuevos.every(p => p.estado === 'cobrado')
  return { plazos: nuevos, estadoComprobante: todas ? 'cobrado' : 'a cobrar' }
}

/** Plazos de cobro: la suma de las cuotas tiene que dar el importe neto. */
export interface PlazoCobro {
  dias: number; pct: number; vencimiento: string; importe: number
  /** `cobrado` = el usuario sabe que se cobró (verde en el Cash Flow), aunque no esté conciliado. */
  estado?: 'a cobrar' | 'cobrado'
}

export function controlPlazos(plazos: PlazoCobro[], importeNeto: number): AvisoLiq | null {
  if (!plazos.length) return null
  const suma = r2(plazos.reduce((s, p) => s + (Number(p.importe) || 0), 0))
  const dif = r2(suma - importeNeto)
  return Math.abs(dif) < CENTAVO
    ? { nivel: 'ok', tema: 'Plazos', mensaje: 'Las cuotas suman el importe neto' }
    : { nivel: 'aviso', tema: 'Plazos', diferencia: dif, mensaje: 'Las cuotas suman ' + (dif > 0 ? 'más' : 'menos') + ' que el importe neto' }
}

/**
 * Reparte el importe neto en cuotas según los días de la venta ("30/60/90"). Porcentajes iguales;
 * lo que sobra va a la cuota del medio, que es como lo hacen los dos papeles reales (33 / 34 / 33).
 * Es una PRECARGA: el usuario corrige lo que diga su papel. La última cuota absorbe los centavos,
 * así la suma da exacto.
 */
export function plazosDesdeVenta(plazoVenta: string | null | undefined, fecha: string, importeNeto: number): PlazoCobro[] {
  const dias = String(plazoVenta || '').split(/[\/,;\s]+/).map(Number).filter(n => Number.isFinite(n) && n > 0)
  if (!dias.length) return []
  const n = dias.length
  const base = Math.floor(100 / n)
  const pcts = dias.map(() => base)
  pcts[Math.floor(n / 2)] += 100 - base * n
  const venc = (d: number) => {
    if (!fecha) return ''
    const [y, m, dd] = fecha.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, dd + d)).toISOString().slice(0, 10)
  }
  let acumulado = 0
  return dias.map((d, i) => {
    const importe = i === n - 1 ? r2(importeNeto - acumulado) : r2(importeNeto * pcts[i] / 100)
    acumulado = r2(acumulado + importe)
    return { dias: d, pct: pcts[i], vencimiento: venc(d), importe }
  })
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🕰️ LA VENTA HISTÓRICA — A-FEAT-1226 (2026-10-02)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Desde cuándo la app lleva el stock de hacienda. Una venta anterior no tiene animales que
 * descontar: es el caso de la venta histórica (la de enero, 70 novillos). Una histórica con fecha
 * POSTERIOR se puede cargar igual —puede haber motivo— pero se avisa: lo normal ahí es que la
 * hacienda esté en el stock y se venda desde Productivo, que la descuenta.
 */
export const INICIO_STOCK_APP = '2026-02-01'

export interface VentaHistoricaEntrada {
  fecha: string
  categoriaId: string | null
  cabezas: number
  kgTotales: number
  /** FRACCIÓN (0.03 = 3 %), como la guarda Productivo. */
  pctDesbaste: number
  /** Sólo al gancho: si está, son los kilos que se cobran. */
  kgCarne: number | null
  precioKg: number
  /** FRACCIÓN, como `stock_ventas.pct_cz`. */
  pctCz: number
  flete: number
  plazo: string
  cliente: string
  cuit: string
  notas: string
  /** El usuario confirmó que la venta NO descuenta stock. */
  confirmada: boolean
}

export interface VentaHistoricaArmada {
  /** Lo que impide guardar. Vacío = se puede. */
  faltan: string[]
  /** Lo que se advierte y deja seguir (§ 🚦 de CLAUDE.md). */
  avisos: string[]
  kgQueSeCobran: number
  bruto: number
  cz: number
  neto: number
  /** La fila de `productivo.stock_ventas`, lista para insertar. */
  fila: Record<string, unknown>
}

/**
 * Arma la venta histórica con **la misma cuenta del neto que Productivo** (`netoDeVenta`): kilos que
 * se cobran × precio, menos CZ y flete. Así la venta cargada acá y una cargada allá no pueden dar
 * distinto por la misma hacienda.
 *
 * 🔑 Va a la MISMA tabla que el resto de las ventas (`stock_ventas`), sin lote y SIN movimiento de
 * stock, y con `historica = true`, que es lo que dice que la falta del movimiento es a propósito.
 */
export function armarVentaHistorica(e: VentaHistoricaEntrada): VentaHistoricaArmada {
  const kg = kgQueSeCobran({ kgTotales: e.kgTotales, pctDesbaste: e.pctDesbaste, kgCarne: e.kgCarne })
  const cuenta = netoDeVenta(kg, e.precioKg, e.pctCz, e.flete)

  const faltan: string[] = []
  if (!e.fecha) faltan.push('fecha')
  if (!e.categoriaId) faltan.push('categoría')
  if (!(e.cabezas > 0)) faltan.push('cabezas')
  if (!(e.kgTotales > 0)) faltan.push('kilos')
  if (!(e.precioKg > 0)) faltan.push('precio por kilo')
  if (!e.cuit) faltan.push('cliente (con CUIT)')
  if (e.pctDesbaste < 0 || e.pctDesbaste >= 1) faltan.push('desbaste entre 0 y 100 %')
  if (e.pctCz < 0 || e.pctCz >= 1) faltan.push('CZ entre 0 y 100 %')
  if (!e.confirmada) faltan.push('confirmar que no descuenta stock')

  const avisos: string[] = []
  if (e.fecha && e.fecha >= INICIO_STOCK_APP) {
    avisos.push('La fecha es posterior a febrero de 2026: para entonces la app ya lleva el stock. ' +
      'Si la hacienda está en el stock, cargala desde Productivo → Movimientos, que la descuenta.')
  }
  if (e.kgCarne && e.kgTotales > 0 && e.kgCarne > e.kgTotales) {
    avisos.push('Los kilos de carne superan a los kilos vivos.')
  }

  const fila = {
    lote_id: null,
    categoria_id: e.categoriaId,
    fecha_venta: e.fecha,
    cantidad: e.cabezas,
    kg_totales: e.kgTotales,
    kg_carne: e.kgCarne && e.kgCarne > 0 ? e.kgCarne : null,
    peso_kg: e.cabezas > 0 ? e.kgTotales / e.cabezas : null,
    precio_kg: e.precioKg,
    pct_desbaste: e.pctDesbaste,
    pct_cz: e.pctCz,
    flete: e.flete || null,
    monto_neto: cuenta.neto,
    plazo_cobro: e.plazo.trim() || null,
    cliente_nombre: e.cliente || null,
    cliente_cuit: e.cuit || null,
    empresa: 'MSA',
    historica: true,
    notas: ['Venta histórica, cargada desde Ingresos → Ventas: NO descuenta stock (anterior al stock de la app).',
      e.notas.trim()].filter(Boolean).join(' — '),
  }
  return { faltan, avisos, kgQueSeCobran: kg, bruto: cuenta.bruto, cz: cuenta.cz, neto: cuenta.neto, fila }
}
