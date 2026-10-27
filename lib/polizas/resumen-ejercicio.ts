/**
 * 🧾 Seguros — el resumen POR EJERCICIO y POR PÓLIZA: lo emitido contra lo pagado, y qué hay que reclamar.
 * A-FEAT-1383.
 *
 * Pedido de JMS (2026-10-27): *«hay una cantidad de pólizas emitidas y una cantidad de débitos y créditos en la
 * cuenta corriente: entre esas dos informaciones me tenés que poder decir si me faltan o no pólizas… si está mal
 * cargada en la aplicación, se contabiliza como fue emitida»* y *«el apartado de la app debe dar este dato como lo
 * principal; por ejercicio (incluyendo el presente), tomando los datos aunque no estén conciliados»*.
 *
 * Se arma sobre el control por cuota de `control-debitos.ts`, que ya trabaja con lo EMITIDO (las cuotas de los
 * PDF de los endosos, nunca la carga de la factura) y con los movimientos del banco por leyenda, conciliados o no.
 *
 * Las reglas del resumen:
 * - Una cuota cae en el ejercicio de su VENCIMIENTO (jul → jun), y lo pagado se cuenta contra su cuota, no por
 *   la fecha del débito: así un débito de días después no salta de ejercicio.
 * - «Se esperaba en el banco» es la cuota MENOS lo que la cubrió una nota de crédito: Federación no devuelve
 *   la NC, la descuenta de las cuotas siguientes (lo dice su «pago consolidado», con el saldo de cada cuota).
 *   Por eso cuotas + NC de un ejercicio no tienen que dar lo esperado: el saldo a favor pasa al siguiente.
 * - La diferencia es sólo de lo VENCIDO a la fecha del último extracto.
 * - Los reintegros del banco que ninguna NC explica van como un renglón más: «reintegros sin facturar».
 * - Los débitos de una póliza ANTERIOR que no está cargada (la flota 32436252, la AP 9536537) SÍ se cuentan:
 *   van a la cuenta corriente y a «a reclamar» como «póliza anterior sin cargar», con saldo de inicio 0.
 *   Se reconocen porque caen antes de que empiece una póliza cargada cuya anterior NO está cargada.
 *   ⚠️ Cambió 2026-10-27: hasta acá se descartaban como «del balance anterior», y el papel 14 perdía
 *   $720.690,98 pagados DENTRO del ejercicio. JMS: «esto va a seguros, sólo que no fueron procesadas… hay que
 *   incluirlas en el cálculo para que se modifique sólo el resultado». Su frase anterior («anterior a julio 25
 *   no hace falta poner nada») habla de lo anterior al 1/7/2025, que ya no está en el extracto. Si esa deuda
 *   venía del balance anterior, se compensa cargando la deuda al 30/06 (A-FEAT-1386) o el PDF de la póliza.
 */
import type { CuotaControlada, CuotaEsperada, MovimientoControlado } from "./control-debitos"

export interface PolizaParaResumen {
  poliza: string
  seccion: string | null
  poliza_anterior: string | null
  vigencia_desde: string | null
}

export type MotivoDiferencia = "baja-sin-nc" | "falta-endoso" | "reintegro-sin-facturar" | "nc-sin-aplicar" | "debito-sin-poliza" | "poliza-anterior-sin-cargar"

export interface RenglonResumen {
  /** null en el renglón de reintegros. */
  poliza: string | null
  seccion: string | null
  /** Cuotas que vencen en el ejercicio, tal como se emitieron (los PDF). */
  cuotas: number
  /** Notas de crédito del ejercicio (en negativo). No se reintegran: se descuentan de las cuotas siguientes. */
  notasCredito: number
  /** Lo que se esperaba debitado de lo ya vencido. */
  esperadoVencido: number
  /** Lo que el banco debitó por esas cuotas (o acreditó, en el renglón de reintegros, en negativo). */
  pagado: number
  aVencer: number
  /** esperadoVencido − pagado. Positivo = falta un papel a favor nuestro (o se debitó de menos). */
  diferencia: number
  motivo: MotivoDiferencia | null
  /** Cuotas o movimientos que explican la diferencia (para el detalle). */
  casos: { fecha: string; esperado: number; debitado: number | null }[]
  /** Si el renglón viene ARRASTRADO de un ejercicio anterior (sigue sin resolverse), de cuál. */
  ejercicioOrigen?: string
  /**
   * La cuenta desde el monto de la PÓLIZA, para poder controlarlo (JMS 27/10: «falta partir del monto de la póliza para
   * poder uno entender y controlar»): facturado − NC = neto; pagado; diferencia.
   */
  explicacion?: { facturado: number; notasCredito: number; neto: number; pagado: number }
}

export interface ResumenEjercicio {
  ejercicio: string // «25/26»
  renglones: RenglonResumen[]
  total: { cuotas: number; notasCredito: number; esperadoVencido: number; pagado: number; aVencer: number; diferencia: number }
  /** Lo que hay que reclamar: los renglones con diferencia. */
  aReclamar: RenglonResumen[]
  /** Débitos de pólizas anteriores al ejercicio — no se cuentan, se informan. */
  anteriores: { total: number; cantidad: number; polizas: string[] }
  /** Débitos sin póliza que NO son de una póliza anterior: falta cargar una póliza. */
  sinPoliza: { total: number; cantidad: number }
}

const r2 = (n: number) => Math.round(n * 100) / 100
const TOL = 0.01

/** «25/26» para una fecha ISO: el ejercicio va de julio a junio. */
export function ejercicioDe(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number)
  const a = m >= 7 ? y : y - 1
  return `${String(a % 100).padStart(2, "0")}/${String((a + 1) % 100).padStart(2, "0")}`
}

/** El débito sin póliza, ¿es de una póliza anterior que no está cargada? Devuelve su número, o null. */
export function polizaAnteriorDe(fecha: string, polizas: PolizaParaResumen[]): string | null {
  const cargadas = new Set(polizas.map(p => p.poliza))
  const candidatas = polizas
    .filter(p => p.poliza_anterior && !cargadas.has(p.poliza_anterior) && p.vigencia_desde && fecha < p.vigencia_desde)
    .sort((a, b) => a.vigencia_desde!.localeCompare(b.vigencia_desde!))
  return candidatas[0]?.poliza_anterior ?? null
}

export function resumenPorEjercicio(
  cuotas: CuotaControlada[],
  movimientos: MovimientoControlado[],
  polizas: PolizaParaResumen[],
  hasta: string,
  desdeEjercicio?: string,
  /** Las cuotas tal como vienen de los endosos, ANTES de juntar las del mismo vencimiento. Si se pasan, las
   *  columnas «cuotas» y «notas de crédito» salen de acá: el control junta una NC con la cuota de la misma
   *  semana (Vida 670821, abril: 34.888,08 − 82.166,70 = −47.278,62) y la columna mostraría un neto que no
   *  está en ningún PDF. */
  emitidas?: CuotaEsperada[],
): ResumenEjercicio[] {
  const seccion = new Map(polizas.map(p => [p.poliza, p.seccion]))
  const porEj = new Map<string, Map<string, RenglonResumen>>()
  const renglon = (ej: string, poliza: string) => {
    const m = porEj.get(ej) ?? new Map<string, RenglonResumen>()
    porEj.set(ej, m)
    let r = m.get(poliza)
    if (!r) {
      r = { poliza, seccion: seccion.get(poliza) ?? null, cuotas: 0, notasCredito: 0, esperadoVencido: 0, pagado: 0, aVencer: 0, diferencia: 0, motivo: null, casos: [] }
      m.set(poliza, r)
    }
    return r
  }

  for (const c of cuotas) {
    if (c.resultado === "anterior-al-extracto") continue
    const r = renglon(ejercicioDe(c.vencimiento), c.poliza)
    if (!emitidas) { if (c.importe < 0) r.notasCredito += c.importe; else r.cuotas += c.importe }
    if (c.importe < 0) continue // la NC: se descuenta de las cuotas siguientes
    // «Compensada» = Federación la da por cobrada sin débito (la cubrió una NC, a veces de endosos que no
    // tenemos: el consolidado trae su saldo en 0). No se espera nada en el banco.
    if (c.resultado === "compensada") continue
    if (c.vencimiento > hasta || c.resultado === "a-vencer") { r.aVencer += c.esperadoEnBanco; continue }
    r.esperadoVencido += c.esperadoEnBanco
    r.pagado += c.debitado ?? 0
    const falta = c.esperadoEnBanco - (c.debitado ?? 0)
    if (Math.abs(falta) > TOL) {
      r.casos.push({ fecha: c.vencimiento, esperado: c.esperadoEnBanco, debitado: c.debitado })
      // Sin débito = la póliza dejó de cobrarse (baja sin su NC). Otro importe = un endoso sin cargar.
      const motivo: MotivoDiferencia = c.resultado === "falta-debito" ? "baja-sin-nc" : "falta-endoso"
      if (!r.motivo || motivo === "baja-sin-nc") r.motivo = motivo
    }
  }
  if (emitidas) for (const c of emitidas) {
    if (desdeEjercicio && ejercicioDe(c.vencimiento) < desdeEjercicio) continue
    const r = renglon(ejercicioDe(c.vencimiento), c.poliza)
    if (c.importe < 0) r.notasCredito += c.importe; else r.cuotas += c.importe
  }

  const sueltos = new Map<string, { reint: MovimientoControlado[]; anteriores: { m: MovimientoControlado; poliza: string }[]; sinPoliza: MovimientoControlado[] }>()
  for (const m of movimientos) {
    if (m.resultado === "cuota") continue
    const ej = ejercicioDe(m.fecha)
    const s = sueltos.get(ej) ?? { reint: [], anteriores: [], sinPoliza: [] }
    sueltos.set(ej, s)
    if (m.resultado === "reintegro-sin-nc") { s.reint.push(m); continue }
    const ant = polizaAnteriorDe(m.fecha, polizas)
    if (ant) s.anteriores.push({ m, poliza: ant })
    else s.sinPoliza.push(m)
  }

  // 🧾 NC sin aplicar: una póliza que ya terminó (no le quedan cuotas por vencer) y cuya cuenta corriente quedó
  // a nuestro favor. Caso: Vida 670821 — sus NC (−129.648,30) superaron las cuotas que quedaban: la aseguradora
  // nos debe 24.341,09. Lo destapó la cuenta corriente (JMS 27/10); el control por cuota sólo veía «compensada».
  const ncSinAplicar: { poliza: string; ejercicio: string; saldo: number; explicacion: NonNullable<RenglonResumen["explicacion"]> }[] = []
  if (emitidas) {
    const desdeFecha = desdeEjercicio ? "20" + desdeEjercicio.slice(0, 2) + "-07-01" : "1900-01-01"
    const cc = cuentaCorriente(emitidas, cuotas, movimientos, polizas, desdeFecha, hasta)
    for (const [pol, saldo] of cc.porPoliza) {
      const suyas = emitidas.filter(c => c.poliza === pol)
      // Una póliza anterior sin cargar no tiene cuotas emitidas: no es «NC sin aplicar», ya tiene su renglón.
      if (!suyas.length || saldo >= -TOL || suyas.some(c => c.vencimiento > hasta)) continue
      const ultima = suyas.map(c => c.vencimiento).sort().at(-1)!
      // Lo que ya explican los renglones de esa póliza (bajas, endosos) no se cuenta dos veces.
      const yaExplicado = [...porEj.values()].flatMap(m => [...m.values()]).filter(r => r.poliza === pol)
        .reduce((t, r) => t + (r.esperadoVencido - r.pagado), 0)
      const resto = r2(saldo - yaExplicado)
      const facturado = r2(suyas.filter(c => c.importe > 0).reduce((t, c) => t + c.importe, 0))
      const notasCredito = r2(suyas.filter(c => c.importe < 0).reduce((t, c) => t + c.importe, 0))
      const pagado = r2(movimientos.filter(m => m.poliza === pol).reduce((t, m) => t + m.debitos - m.creditos, 0))
      if (resto < -TOL) ncSinAplicar.push({ poliza: pol, ejercicio: ejercicioDe(ultima), saldo: resto,
        explicacion: { facturado, notasCredito, neto: r2(facturado + notasCredito), pagado } })
    }
  }

  const ejercicios = [...new Set([...porEj.keys(), ...sueltos.keys(), ...ncSinAplicar.map(x => x.ejercicio)])]
    .filter(e => !desdeEjercicio || e >= desdeEjercicio)
    .sort()

  // 📌 Lo que quedó sin resolver en un ejercicio SE ARRASTRA al siguiente (JMS 27/10, mirando 26/27: «acá falta la
  // diferencia de los reintegros recibidos sin factura»). Así el ejercicio en curso dice lo que falta reclamar HOY,
  // y su total es el saldo de la cuenta corriente. Cuando llega el papel, el renglón desaparece solo (de los dos).
  const arrastre: RenglonResumen[] = []
  return ejercicios.map(ej => {
    const renglones: RenglonResumen[] = [...(porEj.get(ej)?.values() ?? [])].map(r => ({
      ...r,
      cuotas: r2(r.cuotas), notasCredito: r2(r.notasCredito), esperadoVencido: r2(r.esperadoVencido), pagado: r2(r.pagado), aVencer: r2(r.aVencer),
      diferencia: r2(r.esperadoVencido - r.pagado),
    }))
    renglones.sort((a, b) => (Math.abs(b.diferencia) > TOL ? 1 : 0) - (Math.abs(a.diferencia) > TOL ? 1 : 0) || (a.seccion ?? "").localeCompare(b.seccion ?? "") || a.poliza!.localeCompare(b.poliza!))
    const s = sueltos.get(ej)
    if (s?.reint.length) {
      const total = r2(s.reint.reduce((t, m) => t + m.creditos, 0))
      renglones.push({
        poliza: null, seccion: null, cuotas: 0, notasCredito: 0, esperadoVencido: 0, pagado: -total, aVencer: 0,
        diferencia: total, motivo: "reintegro-sin-facturar",
        casos: s.reint.map(m => ({ fecha: m.fecha, esperado: 0, debitado: -m.creditos })),
      })
    }
    if (s?.sinPoliza.length) {
      const total = r2(s.sinPoliza.reduce((t, m) => t + m.debitos, 0))
      renglones.push({
        poliza: null, seccion: null, cuotas: 0, notasCredito: 0, esperadoVencido: 0, pagado: total, aVencer: 0,
        diferencia: -total, motivo: "debito-sin-poliza",
        casos: s.sinPoliza.map(m => ({ fecha: m.fecha, esperado: 0, debitado: m.debitos })),
      })
    }
    // Los débitos de una póliza anterior sin cargar: un renglón por póliza (se pagó sin el papel en la app).
    for (const pol of [...new Set((s?.anteriores ?? []).map(x => x.poliza))].sort()) {
      const suyos = s!.anteriores.filter(x => x.poliza === pol).map(x => x.m)
      const total = r2(suyos.reduce((t, m) => t + m.debitos - m.creditos, 0))
      renglones.push({
        poliza: pol, seccion: null, cuotas: 0, notasCredito: 0, esperadoVencido: 0, pagado: total, aVencer: 0,
        diferencia: -total, motivo: "poliza-anterior-sin-cargar",
        casos: suyos.map(m => ({ fecha: m.fecha, esperado: 0, debitado: m.debitos })),
      })
    }
    for (const x of ncSinAplicar.filter(x => x.ejercicio === ej)) renglones.push({
      poliza: x.poliza, seccion: seccion.get(x.poliza) ?? null, cuotas: 0, notasCredito: 0, esperadoVencido: 0, pagado: 0, aVencer: 0,
      diferencia: x.saldo, motivo: "nc-sin-aplicar", casos: [], explicacion: x.explicacion,
    })
    // Lo de este ejercicio que queda abierto pasa al siguiente (con su origen); lo arrastrado sigue arrastrándose.
    const arrastrados = arrastre.map(r => ({ ...r }))
    const abiertos = renglones.filter(r => Math.abs(r.diferencia) > TOL)
      .map(r => ({ ...r, cuotas: 0, notasCredito: 0, esperadoVencido: 0, pagado: 0, aVencer: 0, ejercicioOrigen: ej }))
    renglones.push(...arrastrados)
    arrastre.push(...abiertos)
    const suma = (k: keyof RenglonResumen) => r2(renglones.reduce((t, r) => t + (r[k] as number), 0))
    return {
      ejercicio: ej,
      renglones,
      total: { cuotas: suma("cuotas"), notasCredito: suma("notasCredito"), esperadoVencido: suma("esperadoVencido"), pagado: suma("pagado"), aVencer: suma("aVencer"), diferencia: suma("diferencia") },
      aReclamar: renglones.filter(r => Math.abs(r.diferencia) > TOL),
      anteriores: {
        total: r2((s?.anteriores ?? []).reduce((t, x) => t + x.m.debitos, 0)),
        cantidad: s?.anteriores.length ?? 0,
        polizas: [...new Set((s?.anteriores ?? []).map(x => x.poliza))],
      },
      sinPoliza: { total: r2((s?.sinPoliza ?? []).reduce((t, m) => t + m.debitos, 0)), cantidad: s?.sinPoliza.length ?? 0 },
    }
  })
}

/**
 * 📂 Las dos familias de reclamo (JMS 27/10): o falta el PAPEL (la plata ya se movió) o falta la PLATA (el papel ya está).
 *   · «Notas de crédito pendientes»: bajas sin su NC y reintegros sin facturar — se pide el comprobante.
 *   · «Saldo a favor pendiente»: una NC que ya tenemos y que nadie devolvió ni aplicó — se pide la plata.
 */
export const CATEGORIA_MOTIVO: Record<MotivoDiferencia, string> = {
  "baja-sin-nc": "Notas de crédito pendientes",
  "reintegro-sin-facturar": "Notas de crédito pendientes",
  "falta-endoso": "Endosos pendientes",
  "nc-sin-aplicar": "Saldo a favor pendiente",
  "debito-sin-poliza": "Pólizas sin cargar",
  "poliza-anterior-sin-cargar": "Pólizas sin cargar",
}

export const TEXTO_MOTIVO: Record<MotivoDiferencia, string> = {
  "baja-sin-nc": "NC pendiente: dejó de debitarse (baja) y falta su nota de crédito — pedirla",
  "falta-endoso": "Endoso pendiente: se debitó otro importe — pedir el endoso",
  "reintegro-sin-facturar": "NC pendiente: la aseguradora nos reintegró plata sin nota de crédito — pedirla",
  "nc-sin-aplicar": "Saldo a favor pendiente: tenemos las NC, pero superaron las cuotas y el sobrante no se devolvió ni se aplicó — pedir el reintegro o que lo descuenten de la póliza nueva",
  "debito-sin-poliza": "Póliza sin cargar: se pagó algo que ninguna póliza cargada explica — cargarla",
  "poliza-anterior-sin-cargar": "Póliza anterior sin cargar: se pagaron cuotas de una póliza cuyo PDF no está en la app — cargarla (o la deuda al 30/06 si venía del balance anterior)",
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 📒 LA CUENTA CORRIENTE con la aseguradora — todo lo que entra, en orden (A-FEAT-1383, JMS 27/10).
//
// *«Sería lógico poder con un botón abrir una cuenta corriente donde entre todo. Si tenemos una acreditación
// sin contra documento, lleva la cta cte fuera de cero; con las cuotas de las pólizas y los débitos se mantiene
// en cero; con las notas de crédito se va ajustando contra distintos débitos. Eso nos daría el neto a favor o
// en contra en cuanto a documentación.»*
//
//   · CARGO   = una cuota emitida (el PDF) o un reintegro que nos hizo la aseguradora.
//   · CRÉDITO = un débito del banco (le pagamos) o una nota de crédito emitida.
//   · SALDO   = cargos − créditos. En cero, papeles y plata coinciden.
//       > 0 → nos cobraron o acreditaron algo que ningún papel cierra: falta una NC (baja sin NC, reintegro sin
//             facturar) o un endoso.
//       < 0 → pagamos de más o hay una NC sin aplicar: la aseguradora nos debe.
//
// Es el CAMINO INVERSO del resumen por ejercicio: la suma de la columna «a reclamar» de todos los ejercicios
// tiene que dar el saldo final. Si no da, uno de los dos está mal (§ 🧮 Todo desarrollo termina con su control).
//
// Saldo inicial: una póliza que viene de antes del primer extracto (Vida 644709) trae NC que se descontaron de
// cuotas de este ejercicio; ese saldo a favor sale de lo que dice el consolidado de la aseguradora (cuotas en
// saldo 0) y entra como primer renglón, para que la cuenta no arranque falsamente en contra.
// Los débitos de una póliza anterior sin cargar SÍ entran, con saldo de inicio 0 (⚠️ cambió 2026-10-27: antes no).
// ════════════════════════════════════════════════════════════════════════════════════════════════

export type TipoLinea = "saldo-inicial" | "cuota" | "nc" | "debito" | "reintegro"

export interface LineaCtaCte {
  fecha: string
  poliza: string | null
  tipo: TipoLinea
  concepto: string
  cargo: number
  credito: number
  saldo: number
  endoso?: number
  /** El movimiento del banco, si la línea es un débito o un reintegro. */
  movimientoId?: string
  estado?: string | null
}

export interface CuentaCorriente {
  lineas: LineaCtaCte[]
  saldo: number
  porPoliza: Map<string, number>
}

export function cuentaCorriente(
  emitidas: CuotaEsperada[],
  cuotas: CuotaControlada[],
  movimientos: MovimientoControlado[],
  polizas: PolizaParaResumen[],
  desde: string,
  hasta: string,
): CuentaCorriente {
  const enVentana = (f: string) => f >= desde && f <= hasta
  const lineas: Omit<LineaCtaCte, "saldo">[] = []

  // Saldo inicial de las pólizas con historia anterior al extracto (lo que el consolidado ya compensó).
  const conHistoria = new Set(emitidas.filter(c => c.vencimiento < desde).map(c => c.poliza))
  for (const pol of conHistoria) {
    const bruto = emitidas.filter(c => c.poliza === pol && enVentana(c.vencimiento)).reduce((t, c) => t + c.importe, 0)
    const esperado = cuotas.filter(c => c.poliza === pol && c.importe > 0 && enVentana(c.vencimiento) && c.resultado !== "a-vencer" && c.resultado !== "compensada")
      .reduce((t, c) => t + c.esperadoEnBanco, 0)
    const inicial = r2(esperado - bruto)
    if (Math.abs(inicial) > TOL) lineas.push({
      fecha: desde, poliza: pol, tipo: "saldo-inicial",
      concepto: inicial < 0
        ? "Saldo a favor que trae de antes (NC anteriores, según el consolidado de la aseguradora)"
        : "Saldo que trae de antes (según el consolidado de la aseguradora)",
      cargo: inicial > 0 ? inicial : 0, credito: inicial < 0 ? -inicial : 0,
    })
  }
  for (const c of emitidas) {
    if (!enVentana(c.vencimiento)) continue
    const de = c.endoso != null ? " (endoso " + c.endoso + ")" : ""
    if (c.importe >= 0) lineas.push({ fecha: c.vencimiento, poliza: c.poliza, tipo: "cuota", concepto: "Cuota" + de, cargo: c.importe, credito: 0, endoso: c.endoso })
    else lineas.push({ fecha: c.vencimiento, poliza: c.poliza, tipo: "nc", concepto: "Nota de crédito" + de, cargo: 0, credito: -c.importe, endoso: c.endoso })
  }
  for (const m of movimientos) {
    if (!enVentana(m.fecha)) continue
    const anterior = m.resultado === "sin-poliza" ? polizaAnteriorDe(m.fecha, polizas) : null
    if (m.debitos > 0) lineas.push({
      fecha: m.fecha, poliza: m.poliza ?? anterior, tipo: "debito", movimientoId: m.id, estado: m.estado ?? null,
      concepto: m.poliza ? "Débito del banco" : anterior ? "Débito del banco — póliza anterior SIN cargar (falta su PDF)" : "Débito del banco SIN póliza cargada",
      cargo: 0, credito: m.debitos,
    })
    if (m.creditos > 0) lineas.push({
      fecha: m.fecha, poliza: m.poliza, tipo: "reintegro", movimientoId: m.id, estado: m.estado ?? null,
      concepto: m.poliza ? "Reintegro del banco" : "Reintegro del banco SIN nota de crédito",
      cargo: m.creditos, credito: 0,
    })
  }
  const orden: Record<TipoLinea, number> = { "saldo-inicial": 0, cuota: 1, reintegro: 2, nc: 3, debito: 4 }
  lineas.sort((a, b) => a.fecha.localeCompare(b.fecha) || orden[a.tipo] - orden[b.tipo] || (a.poliza ?? "").localeCompare(b.poliza ?? ""))
  let saldo = 0
  const porPoliza = new Map<string, number>()
  const conSaldo = lineas.map(l => {
    saldo = r2(saldo + l.cargo - l.credito)
    if (l.poliza) porPoliza.set(l.poliza, r2((porPoliza.get(l.poliza) ?? 0) + l.cargo - l.credito))
    return { ...l, saldo }
  })
  return { lineas: conSaldo, saldo, porPoliza }
}
