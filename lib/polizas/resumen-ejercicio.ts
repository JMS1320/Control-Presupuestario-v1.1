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
 * - Los débitos de pólizas ANTERIORES al ejercicio (la flota anterior, la AP anterior) no se cuentan: son del
 *   balance anterior (JMS 27/10: «anterior a julio 25 no hace falta poner nada»). Se reconocen porque caen
 *   antes de que empiece una póliza cargada cuya anterior NO está cargada. Se informan en una línea, no se
 *   esconden.
 */
import type { CuotaControlada, CuotaEsperada, MovimientoControlado } from "./control-debitos"

export interface PolizaParaResumen {
  poliza: string
  seccion: string | null
  poliza_anterior: string | null
  vigencia_desde: string | null
}

export type MotivoDiferencia = "baja-sin-nc" | "falta-endoso" | "reintegro-sin-facturar"

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

  const ejercicios = [...new Set([...porEj.keys(), ...sueltos.keys()])]
    .filter(e => !desdeEjercicio || e >= desdeEjercicio)
    .sort()

  return ejercicios.map(ej => {
    const renglones = [...(porEj.get(ej)?.values() ?? [])].map(r => ({
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

export const TEXTO_MOTIVO: Record<MotivoDiferencia, string> = {
  "baja-sin-nc": "Dejó de debitarse: ¿baja sin su nota de crédito? — reclamar la NC",
  "falta-endoso": "Se debitó otro importe: falta un endoso — reclamarlo",
  "reintegro-sin-facturar": "Reintegros sin facturar: ninguna nota de crédito los explica — pedir el papel",
}
