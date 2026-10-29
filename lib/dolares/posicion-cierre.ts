/**
 * 📒 LA POSICIÓN EN MONEDA EXTRANJERA AL CIERRE — A-FEAT-1398 etapa 4 (para los papeles del balance).
 *
 * Lo que el balance necesita de una cuenta en dólares: el **saldo en US$ a la fecha de cierre**, valuado al **TC de
 * cierre**, y la **diferencia de cambio** contra lo que costó en pesos (la suma de los pesos de cada movimiento,
 * a su TC). Si algún movimiento hasta el cierre no tiene TC, la diferencia NO se calcula: se dice cuántos faltan
 * (§ «nada se descarta en silencio»).
 *
 * Sólo las cuentas de una EMPRESA entran a su balance: las de Cotitulares no son de MSA/PAM/MA (lo que pagaron por
 * una empresa va por la cuenta corriente, no como disponibilidad).
 *
 * ✅ Va al Excel del balance (JMS 28/10: «que entre a balance»): `saldosEnDolaresParaBalance` suma una línea por
 * cuenta al papel 07 Bancos. ⚠️ cambió 29/10: la cta USD de MSA tiene su saldo de inicio 25/26 (script 128), así que
 * desde ahí sale en el 07 de 25/26; sin los movimientos del año, el saldo al cierre es el de inicio.
 */
import { CUENTAS_DOLARES_Y_COTITULARES, importeConSigno, pesosDe, type MovimientoMoneda } from "@/lib/dolares/cuentas"

const r2 = (n: number) => Math.round(n * 100) / 100

/** Las cuentas en dólares de cada empresa, para su balance (sin las de Cotitulares). */
export const CUENTAS_EN_MONEDA_EXTRANJERA: Record<string, typeof CUENTAS_DOLARES_Y_COTITULARES> = {
  MSA: CUENTAS_DOLARES_Y_COTITULARES.filter(c => c.empresa === "MSA" && c.moneda === "USD"),
  PAM: CUENTAS_DOLARES_Y_COTITULARES.filter(c => c.empresa === "PAM" && c.moneda === "USD"),
  MA: CUENTAS_DOLARES_Y_COTITULARES.filter(c => c.empresa === "MA" && c.moneda === "USD"),
}

export interface PosicionCierre {
  usd: number
  /** valuado al TC de cierre (null si no se dio el TC) */
  pesosAlCierre: number | null
  /** lo que costó en pesos: suma de los pesos de cada movimiento (null si alguno no tiene TC) */
  pesosHistoricos: number | null
  /** pesosAlCierre − pesosHistoricos: ganancia (+) o pérdida (−) por diferencia de cambio */
  diferenciaDeCambio: number | null
  sinTC: number
  movimientos: number
}

export function posicionAlCierre(movs: MovimientoMoneda[], fechaCierre: string, tcCierre: number | null): PosicionCierre {
  const hasta = movs.filter(m => m.fecha && m.fecha <= fechaCierre)
  let usd = 0, hist = 0, sinTC = 0
  for (const m of hasta) {
    usd += importeConSigno(m)
    const p = pesosDe(m)
    if (p == null) sinTC++
    else hist += p
  }
  usd = r2(usd)
  const pesosAlCierre = tcCierre && tcCierre > 0 ? r2(usd * tcCierre) : null
  const pesosHistoricos = sinTC > 0 ? null : r2(hist)
  const diferenciaDeCambio = pesosAlCierre != null && pesosHistoricos != null ? r2(pesosAlCierre - pesosHistoricos) : null
  return { usd, pesosAlCierre, pesosHistoricos, diferenciaDeCambio, sinTC, movimientos: hasta.length }
}

/**
 * 📒 Lo que va al papel **07 Bancos** del balance: una línea por cuenta en dólares de la empresa, con su saldo en
 * PESOS al TC de cierre (dólar BNA divisas del día del cierre o el anterior más cercano, el mismo que usa la foto
 * del balance). **Una cuenta sin movimientos hasta el cierre no aparece**: así el ejercicio 25/26 sale igual que
 * antes. Lo que no se puede valuar (sin TC de cierre) va con saldo vacío y un aviso — nunca un cero inventado.
 */
export async function saldosEnDolaresParaBalance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, empresa: string, finDelEjercicio: string,
): Promise<{ saldos: { nombre: string; saldo: number | null; fecha: string | null }[]; avisos: string[] }> {
  const cuentas = CUENTAS_EN_MONEDA_EXTRANJERA[empresa] ?? []
  const saldos: { nombre: string; saldo: number | null; fecha: string | null }[] = []
  const avisos: string[] = []
  if (cuentas.length === 0) return { saldos, avisos }
  const { data: cot } = await supabase.from("cotizaciones").select("valor, fecha")
    .eq("serie", "dolar_bna_divisas").lte("fecha", finDelEjercicio).order("fecha", { ascending: false }).limit(1).maybeSingle()
  const tc = cot?.valor != null ? Number(cot.valor) : null
  for (const c of cuentas) {
    const q = c.schema_bd === "public" ? supabase.from(c.tabla_bd) : supabase.schema(c.schema_bd).from(c.tabla_bd)
    const { data, error } = await q.select("fecha, debitos, creditos, moneda, tipo_cambio, importe_pesos")
      .lte("fecha", finDelEjercicio).limit(10000)
    if (error) { avisos.push(`No se pudo leer ${c.nombre}`); saldos.push({ nombre: c.nombre, saldo: null, fecha: null }); continue }
    const movs = (data ?? []) as MovimientoMoneda[]
    if (movs.length === 0) continue
    const p = posicionAlCierre(movs, finDelEjercicio, tc)
    const dif = p.diferenciaDeCambio != null ? ` · dif. de cambio $ ${p.diferenciaDeCambio.toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : ""
    saldos.push({
      nombre: `${c.nombre} — US$ ${p.usd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}${tc ? ` × TC ${tc.toLocaleString("es-AR")} (BNA ${cot.fecha})` : ""}${dif}`,
      saldo: p.pesosAlCierre, fecha: finDelEjercicio,
    })
    if (tc == null) avisos.push(`${c.nombre}: no hay dólar BNA a la fecha de cierre, el saldo en pesos va vacío`)
    if (p.sinTC > 0) avisos.push(`${c.nombre}: ${p.sinTC} movimiento(s) sin tipo de cambio, la diferencia de cambio no se calcula`)
  }
  return { saldos, avisos }
}
