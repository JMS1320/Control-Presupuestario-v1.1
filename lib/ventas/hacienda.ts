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
  // Al gancho sólo si TODAS lo son: mezclado, los kilos no se pueden comparar en una sola unidad.
  const alGancho = ventas.every(v => (Number(v.kgCarne) || 0) > 0)
  return { cabezas, kgNetos, neto, precioKg: kgNetos > 0 ? neto / kgNetos : 0, alGancho }
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
  /**
   * 🥩 Los **kilos gancho** de la línea, cuando la venta fue al gancho (A-FEAT-1234, 2026-10-03). El papel
   * del frigorífico expresa la plata en kilo VIVO (Arre Beef: 3.000 kg pie × $2.689,58) pero el precio se
   * pacta por kilo GANCHO (1.606 kg × $5.024,12): con este dato la comparación con la venta se hace en la
   * misma unidad. Vacío en una venta en pie.
   */
  kgGancho?: number | null
  /**
   * 🥩 **El precio por kilo GANCHO — el dato real** (usuario 2026-10-04: *«el kg al gancho es nuestro dato
   * real, el otro dato es una conversión pero no puede faltar el dato real»*). Con kilos y precio gancho
   * cargados, el importe de la línea es **kg gancho × precio gancho** y el precio por kilo vivo se deriva
   * (importe ÷ kg pie), que es como lo expresa el papel del frigorífico.
   */
  precioGancho?: number | null
  /**
   * 🥩 **Manda el precio por kilo VIVO** (usuario 2026-10-05: *«liquidar las ventas a Arre Beef me tiene
   * que permitir poner el precio del kilo vivo, que es como ellos lo liquidan, y lógicamente el precio kg
   * carne se deberá modificar solo»*). Con esto el importe es **kg pie × $/kg pie** —el papel— y el precio
   * gancho se deriva (importe ÷ kg gancho). El que se carga a mano manda; el otro se calcula.
   */
  mandaPie?: boolean
}

type LineaPrecio = { kilos: number; precio: number; kgGancho?: number | null; precioGancho?: number | null; mandaPie?: boolean }

/** ¿La línea es al gancho? Kilos gancho y un precio que mande (el gancho, o el vivo con `mandaPie`). */
export const lineaAlGancho = (l: { kgGancho?: number | null; precioGancho?: number | null; mandaPie?: boolean; precio?: number }) =>
  (Number(l.kgGancho) || 0) > 0 && ((Number(l.precioGancho) || 0) > 0 || (!!l.mandaPie && (Number(l.precio) || 0) > 0))

/** El importe de una línea: manda el precio cargado a mano — vivo (kg pie × $/kg pie) o gancho (kg gancho × $/kg gancho). */
export function importeDeLinea(l: LineaPrecio): number {
  if (l.mandaPie || !lineaAlGancho(l)) return (Number(l.kilos) || 0) * (Number(l.precio) || 0)
  return Number(l.kgGancho) * Number(l.precioGancho)
}

/** El precio por kilo VIVO de una línea al gancho: el cargado si manda, si no la conversión (importe ÷ kg pie). */
export function precioPieDerivado(l: LineaPrecio): number {
  const k = Number(l.kilos) || 0
  if (l.mandaPie) return Number(l.precio) || 0
  return lineaAlGancho(l) && k > 0 ? importeDeLinea(l) / k : Number(l.precio) || 0
}

/** El precio por kilo GANCHO: el cargado si manda, si no se deriva del vivo (importe ÷ kg gancho). */
export function precioGanchoDerivado(l: LineaPrecio): number {
  const kg = Number(l.kgGancho) || 0
  if (!l.mandaPie) return Number(l.precioGancho) || 0
  return kg > 0 ? importeDeLinea(l) / kg : 0
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
  // Al gancho manda el dato real (kg gancho × precio gancho) — ver `importeDeLinea`.
  const bruto = r2(e.lineas.reduce((s, l) => s + importeDeLinea(l), 0))
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
  /** true = las ventas son al gancho: `kgNetos` son kilos de CARNE y `precioKg` es por kilo gancho. */
  alGancho?: boolean
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
export function compararConVenta(venta: VentaParaLiquidar, calc: LiqHaciendaCalculo, kgGanchoLiq?: number): AvisoLiq[] {
  const avisos: AvisoLiq[] = []
  /**
   * 🥩 **Venta al gancho** (A-FEAT-1234): el papel viene en kilo vivo, la venta en kilo gancho. Se compara
   * en GANCHO: kilos gancho del papel contra los de carne de la venta, y el precio por kilo gancho. La
   * plata (subtotal) se compara igual, y la diferencia salta (usuario: *«sí, debe saltar la diferencia»*).
   */
  if (venta.alGancho) {
    avisos.push(venta.cabezas === calc.cabezas
      ? { nivel: 'ok', tema: 'Cabezas', mensaje: 'Cabezas: ' + calc.cabezas + ', igual que la venta' }
      : { nivel: 'aviso', tema: 'Cabezas', diferencia: calc.cabezas - venta.cabezas,
          mensaje: 'Cabezas: la liquidación trae ' + calc.cabezas + ' y la venta ' + venta.cabezas })
    const kgG = Number(kgGanchoLiq) || 0
    if (kgG <= 0) {
      avisos.push({ nivel: 'aviso', tema: 'Kilos',
        mensaje: 'La venta es al gancho: cargá los kilos gancho de cada línea para comparar kilos y precio en la misma unidad' })
    } else {
      const difKgG = r2(kgG - venta.kgNetos)
      avisos.push(Math.abs(difKgG) < 0.5
        ? { nivel: 'ok', tema: 'Kilos', mensaje: 'Kilos gancho: coinciden con los de la venta (' + fmt2(kgG) + ')' }
        : { nivel: 'aviso', tema: 'Kilos', diferencia: difKgG,
            mensaje: 'Kilos gancho: la liquidación trae ' + (difKgG > 0 ? 'más' : 'menos') + ' que la venta' })
    }
    const difSubG = r2(calc.netoGravado - venta.neto)
    const precioG = kgG > 0 ? calc.netoGravado / kgG : null
    const tol = 0.5 * (precioG ?? venta.precioKg)
    avisos.push(Math.abs(difSubG) <= tol
      ? { nivel: 'ok', tema: 'Subtotal', mensaje: 'Subtotal después de comisión: igual al neto de la venta' }
      : { nivel: 'aviso', tema: 'Subtotal', diferencia: difSubG,
          mensaje: 'Subtotal después de comisión: ' + (difSubG > 0 ? 'más' : 'menos') + ' que el neto de la venta'
            + (precioG != null ? ' (precio por kg gancho ' + fmt2(precioG) + ' contra ' + fmt2(venta.precioKg) + ' de la venta: '
              + (precioG - venta.precioKg > 0 ? '+' : '') + fmt2(r2(precioG - venta.precioKg)) + ' $/kg)' : '') })
    return avisos
  }

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
      /**
       * ⚠️ Cambió 2026-10-03 (A-FEAT-1234): al gancho se precargan los kilos VIVOS —el papel del
       * frigorífico viene en kilo vivo— con el precio vivo equivalente (misma plata), y los de carne van
       * en `kgGancho` para comparar. En pie, los vivos menos desbaste, como siempre.
       */
      ...((Number(v.kgCarne) || 0) > 0 && (Number(v.kgTotales) || 0) > 0
        ? {
            kilos: Math.round(Number(v.kgTotales)),
            precio: Number(v.kgCarne) * (Number(v.precioKg) || 0) / Math.round(Number(v.kgTotales)),
            kgGancho: Number(v.kgCarne),
            precioGancho: Number(v.precioKg) || 0,
          }
        : { kilos: Math.round(kgQueSeCobran(v)), precio: Number(v.precioKg) || 0 }),
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

/** Algo que ya cancela parte de una liquidación: una retención con su fecha, un anticipo. */
export interface Imputacion { monto: number; fecha?: string | null }

/** Una cuota con lo que se le imputó: `importe` es la del papel, `aCobrar` lo que tiene que entrar al banco. */
export interface CuotaDetalle {
  n: number
  de: number
  vencimiento: string
  importe: number
  imputado: number
  aCobrar: number
  estado?: string
}

const diasEntre = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000

/**
 * 🧾 **Reparte lo imputado (retenciones, anticipos) entre las CUOTAS, cada cosa en la cuota de su
 * fecha.** Pedido del usuario 2026-10-02, al cargar la retención de Ganancias que Genta le hizo en el
 * pago del 03/09: *«no se adjudica a cuotas, quedó como general»*.
 *
 * - Con fecha → a la cuota cuyo vencimiento está **más cerca** de esa fecha (empate: la anterior).
 *   La retención del 03/09 cae en la cuota del 03/09, y la del 2º pago caerá en la 2ª — antes todo
 *   se descontaba de la primera cuota, y la del 2º pago la habría dejado en negativo.
 * - Sin fecha → a la primera cuota todavía no cobrada (es lo más probable: lo próximo que se paga).
 * - Si excede su cuota, el sobrante pasa a las siguientes, en orden — no se pierde.
 *
 * Devuelve TODAS las cuotas, también las canceladas del todo (`aCobrar` 0): el que llama decide si
 * mostrarlas. Sin plazos, una sola cuota por el cobro entero, en `fechaSinPlazos`.
 */
export function repartirEnCuotas(
  plazos: { vencimiento?: string; importe?: number | string; estado?: string }[] | null | undefined,
  cobroTotal: number,
  imputaciones: Imputacion[],
  fechaSinPlazos: string,
): CuotaDetalle[] {
  const crudas = (Array.isArray(plazos) ? plazos : []).filter(q => Number(q?.importe) > 0)
  if (!crudas.length) {
    // Sin plazos, `cobroTotal` ya viene neto de lo imputado (es `cobroEsperado`).
    return [{ n: 1, de: 1, vencimiento: fechaSinPlazos, importe: r2(cobroTotal), imputado: 0, aCobrar: r2(cobroTotal) }]
  }
  const cuotas: CuotaDetalle[] = crudas.map((q, i) => ({
    n: i + 1, de: crudas.length, vencimiento: q.vencimiento || fechaSinPlazos,
    importe: Number(q.importe) || 0, imputado: 0, aCobrar: Number(q.importe) || 0,
    ...(q.estado ? { estado: q.estado } : {}),
  }))
  const destino = (im: Imputacion): number => {
    if (im.fecha) {
      let mejor = 0
      cuotas.forEach((q, i) => { if (diasEntre(q.vencimiento, im.fecha!) < diasEntre(cuotas[mejor].vencimiento, im.fecha!)) mejor = i })
      return mejor
    }
    const abierta = cuotas.findIndex(q => q.estado !== 'cobrado' && q.aCobrar > 0.01)
    return abierta >= 0 ? abierta : 0
  }
  for (const im of imputaciones) {
    let resto = Math.max(Number(im.monto) || 0, 0)
    for (let i = destino(im); i < cuotas.length && resto > 0.001; i++) {
      const toma = Math.min(resto, cuotas[i].aCobrar)
      cuotas[i].imputado = r2(cuotas[i].imputado + toma)
      cuotas[i].aCobrar = r2(cuotas[i].aCobrar - toma)
      resto -= toma
    }
  }
  return cuotas
}

/**
 * Las cuotas que el Cash Flow todavía espera cobrar (las que tienen algo por entrar). `imputado`
 * acepta un número —se reparte como si no tuviera fecha, como antes— o la lista con fechas.
 */
export function cuotasPorCobrar(
  plazos: { vencimiento?: string; importe?: number | string; estado?: string }[] | null | undefined,
  cobroTotal: number,
  imputado: number | Imputacion[],
  fechaSinPlazos: string,
): { n: number; de: number; vencimiento: string; importe: number; estado?: string }[] {
  const lista = Array.isArray(imputado) ? imputado : (Number(imputado) > 0 ? [{ monto: Number(imputado) }] : [])
  // Menos de $1 por cobrar es redondeo del emisor (Genta: $0,02 en la venta de enero): no se espera.
  return repartirEnCuotas(plazos, cobroTotal, lista, fechaSinPlazos)
    .filter(q => q.aCobrar > 0.99)
    .map(q => ({ n: q.n, de: q.de, vencimiento: q.vencimiento, importe: q.aCobrar, ...(q.estado ? { estado: q.estado } : {}) }))
}

/**
 * 🧮 **El control de las cuotas contra el papel** — pedido del usuario: *«marcar un descuadre entre
 * las 3 fechas de cobro con sus montos vs el total»*. Dos identidades:
 *   1. Las cuotas del papel suman el importe neto de la liquidación (total − retenciones impresas).
 *   2. Lo que queda por cobrar en las cuotas + lo imputado aparte = lo mismo, menos nada: si no, se
 *      perdió algo al repartir.
 * Devuelve la diferencia de cada una (0 = cierra, tolerancia 1 centavo por cuota).
 */
export function controlCuotas(cuotas: CuotaDetalle[], importeNetoPapel: number, imputadoTotal: number) {
  const sumaCuotas = r2(cuotas.reduce((s, q) => s + q.importe, 0))
  const sumaACobrar = r2(cuotas.reduce((s, q) => s + q.aCobrar, 0))
  const sumaImputada = r2(cuotas.reduce((s, q) => s + q.imputado, 0))
  const tol = 0.01 * Math.max(cuotas.length, 1)
  const difPapel = r2(sumaCuotas - importeNetoPapel)
  const sinRepartir = r2(imputadoTotal - sumaImputada)
  return {
    sumaCuotas, sumaACobrar, sumaImputada,
    difPapel, sinRepartir,
    cierra: Math.abs(difPapel) <= tol && Math.abs(sinRepartir) <= tol,
  }
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
  // Una cuota conciliada contra el banco no se toca con una marca: la decide la conciliación.
  if (plazos[indice]?.movimiento_id) return { plazos, estadoComprobante: estadoComprobante || 'a cobrar' }
  const nuevos = plazos.map((p, i) => (i === indice ? { ...p, estado } : p))
  if (estadoComprobante === 'conciliado') return { plazos: nuevos, estadoComprobante: 'conciliado' }
  const todas = nuevos.length > 0 && nuevos.every(p => p.estado === 'cobrado')
  return { plazos: nuevos, estadoComprobante: todas ? 'cobrado' : 'a cobrar' }
}

/**
 * 🏦 **Concilia UNA cuota contra el movimiento del banco que la cobró** — A-BUG-1234 (2026-10-02).
 *
 * Antes la conciliación sólo conocía el comprobante entero: asignar el cobro de la cuota 1 marcaba
 * cobrada la liquidación completa, y las cuotas 2 y 3 desaparecían del Cash Flow y de Cobros.
 *
 * - Con `movimientoId`: la cuota queda `cobrado` y guarda el movimiento.
 * - Con `null`: se suelta (la cuota que tenía `movimientoId` vuelve a «a cobrar»). Para eso se
 *   busca por movimiento, no por índice: el que desconcilia sabe el movimiento, no la cuota.
 * - El comprobante: **conciliado** cuando TODAS las cuotas tienen su movimiento; **cobrado** si
 *   todas están cobradas (alguna sin banco); si no, **a cobrar**.
 */
export function conciliarCuota(
  plazos: PlazoCobro[], indice: number | null, movimientoId: string | null, soltarMovimientoId?: string | null,
): { plazos: PlazoCobro[]; estadoComprobante: string; cambio: boolean } {
  let cambio = false
  const nuevos = plazos.map((p, i) => {
    if (movimientoId && i === indice) { cambio = true; return { ...p, estado: 'cobrado' as const, movimiento_id: movimientoId } }
    if (soltarMovimientoId && p.movimiento_id === soltarMovimientoId) {
      cambio = true
      const { movimiento_id: _fuera, ...resto } = p
      return { ...resto, estado: 'a cobrar' as const }
    }
    return p
  })
  const todasConBanco = nuevos.length > 0 && nuevos.every(p => !!p.movimiento_id)
  const todasCobradas = nuevos.length > 0 && nuevos.every(p => p.estado === 'cobrado')
  return { plazos: nuevos, estadoComprobante: todasConBanco ? 'conciliado' : todasCobradas ? 'cobrado' : 'a cobrar', cambio }
}

/** Plazos de cobro: la suma de las cuotas tiene que dar el importe neto. */
export interface PlazoCobro {
  dias: number; pct: number; vencimiento: string; importe: number
  /** `cobrado` = el usuario sabe que se cobró (verde en el Cash Flow), aunque no esté conciliado. */
  estado?: 'a cobrar' | 'cobrado'
  /**
   * El movimiento del banco que cobró ESTA cuota (A-BUG-1234). Con él, la cuota está conciliada:
   * no se desmarca a mano — se suelta desconciliando el movimiento.
   */
  movimiento_id?: string | null
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
  /**
   * Kilos NETOS de desbaste, si el usuario los tiene (2026-10-02: *«es el dato que tengo»*). Vacío =
   * se calculan de vivos y desbaste. Lleno = manda: con los vivos, el desbaste sale de ahí; sin los
   * vivos, los netos son los kilos de la venta y el desbaste queda en 0.
   */
  kgNetos: number | null
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
  /** Cuenta contable (categ del plan). Pedido del usuario 2026-10-02: «ya cargarle la cuenta ya que estamos». */
  cuentaContable?: string | null
  /** Centro de costo. Vacío = el de la categoría (lo resuelve `ventas_unificadas`). */
  centroCosto?: string | null
  /**
   * La venta es HISTÓRICA: no descuenta stock. Es una opción de *Nueva venta → Hacienda*, y elegirla
   * ES la confirmación (2026-10-02: *«histórico quiere decir que no afecta stock, no hace falta
   * ponerlo 2 veces»*). Sin ella, la hacienda que está en el stock se vende desde Productivo.
   */
  historica: boolean
}

export interface VentaHistoricaArmada {
  /** Lo que impide guardar. Vacío = se puede. */
  faltan: string[]
  /** Lo que se advierte y deja seguir (§ 🚦 de CLAUDE.md). */
  avisos: string[]
  kgQueSeCobran: number
  /** Kilos netos de desbaste: los tipeados, o vivos × (1 − desbaste). */
  kgNetos: number
  /** El desbaste que se guarda (FRACCIÓN): el tipeado, o el que sale de vivos y netos. */
  pctDesbaste: number
  /** Los kilos que se guardan como vivos (sin vivos, son los netos). */
  kgTotales: number
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
  // Los netos tipeados mandan (§ 🎚️ default del dato real, siempre editable).
  const netosTipeados = Number(e.kgNetos) > 0 ? Number(e.kgNetos) : null
  const kgTotales = e.kgTotales > 0 ? e.kgTotales : (netosTipeados ?? 0)
  const pctDesbaste = netosTipeados && e.kgTotales > 0 ? 1 - netosTipeados / e.kgTotales
    : netosTipeados ? 0 : e.pctDesbaste
  const kgNetos = kgNetosDeVenta(kgTotales, pctDesbaste)
  const kg = kgQueSeCobran({ kgTotales, pctDesbaste, kgCarne: e.kgCarne })
  const cuenta = netoDeVenta(kg, e.precioKg, e.pctCz, e.flete)

  const faltan: string[] = []
  if (!e.historica) faltan.push('la hacienda que está en el stock se vende desde Productivo → Movimientos')
  if (!e.fecha) faltan.push('fecha')
  if (!e.categoriaId) faltan.push('categoría')
  if (!(e.cabezas > 0)) faltan.push('cabezas')
  if (!(kgTotales > 0)) faltan.push('kilos (vivos o netos)')
  if (!(e.precioKg > 0)) faltan.push('precio por kilo')
  if (!e.cuit) faltan.push('cliente (con CUIT)')
  if (pctDesbaste < 0 || pctDesbaste >= 1) {
    faltan.push(netosTipeados ? 'kilos netos menores que los vivos' : 'desbaste entre 0 y 100 %')
  }
  if (e.pctCz < 0 || e.pctCz >= 1) faltan.push('CZ entre 0 y 100 %')

  const avisos: string[] = []
  if (e.fecha && e.fecha >= INICIO_STOCK_APP) {
    avisos.push('La fecha es posterior a febrero de 2026: para entonces la app ya lleva el stock. ' +
      'Si la hacienda está en el stock, cargala desde Productivo → Movimientos, que la descuenta.')
  }
  if (e.kgCarne && kgTotales > 0 && e.kgCarne > kgTotales) {
    avisos.push('Los kilos de carne superan a los kilos vivos.')
  }

  const fila = {
    lote_id: null,
    categoria_id: e.categoriaId,
    fecha_venta: e.fecha,
    cantidad: e.cabezas,
    kg_totales: kgTotales,
    kg_carne: e.kgCarne && e.kgCarne > 0 ? e.kgCarne : null,
    peso_kg: e.cabezas > 0 ? kgTotales / e.cabezas : null,
    precio_kg: e.precioKg,
    pct_desbaste: pctDesbaste,
    pct_cz: e.pctCz,
    flete: e.flete || null,
    monto_neto: cuenta.neto,
    plazo_cobro: e.plazo.trim() || null,
    cliente_nombre: e.cliente || null,
    cliente_cuit: e.cuit || null,
    empresa: 'MSA',
    cuenta_contable: e.cuentaContable || null,
    centro_costo: e.centroCosto || null,
    historica: true,
    notas: ['Venta histórica, cargada desde Ingresos → Ventas: NO descuenta stock (anterior al stock de la app).',
      e.notas.trim()].filter(Boolean).join(' — '),
  }
  return { faltan, avisos, kgQueSeCobran: kg, kgNetos, pctDesbaste, kgTotales, bruto: cuenta.bruto, cz: cuenta.cz, neto: cuenta.neto, fila }
}
