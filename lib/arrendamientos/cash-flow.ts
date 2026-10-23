/**
 * 🌾 Los cobros de ARRENDAMIENTO en el Cash Flow, con lo que todavía no tiene pesos (nota 🌙 del
 * usuario 2026-10-23, A-FEAT-1328).
 *
 * *«Filtro Sanpa y no veo el cobro del 10/11. Es una cuota de arrendamiento ya fijada pero se
 * pesifica al día anterior a su cobro. El Cash Flow lo debe mostrar con algún TC estimado que puede
 * tomarlo de la BBDD. Debe decir que TC es estimado a tanto.»* — y — *«las que no están fijadas en
 * precio las debe mostrar pero con alguna transparencia en el renglón… con dato de precio de soja y
 * de TC de la BBDD»*.
 *
 * **Por qué no aparecía**: la venta fijada en dólares no tiene pesos hasta que se fija el TC, y el
 * Cash Flow tomaba `monto_pesos` (vacío) → 0 → la descartaba como «ya facturada».
 *
 * 🔑 **No se inventa ningún cálculo**: son las funciones del módulo de arrendamientos que ya usa el
 * Presupuesto (`montoVenta`, `resolverTC`, `resolverPrecioCuota`, `tonsDisponibles`), para que la
 * misma cuota valga lo mismo en las dos pantallas.
 */
import {
  montoVenta, resolverTC, resolverPrecioCuota, tonsDisponibles,
  type ContratoArrendamiento, type CuotaArrendamiento, type PrecioGrano, type TipoCambio,
} from "./calculo"

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const plata = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 })
const tn = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** De qué mes salió un valor de una serie (el TC arrastrado dice desde cuándo). */
function mesDeSerie(puntos: Array<{ anio: number; mes: number }>, anio: number, mes: number): string | null {
  const previos = puntos.filter(p => p.anio < anio || (p.anio === anio && p.mes <= mes))
    .sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes))
  const p = previos[0] ?? [...puntos].sort((a, b) => (a.anio - b.anio) || (a.mes - b.mes))[0]
  return p ? `${MES[p.mes - 1]}-${String(p.anio).slice(2)}` : null
}

function mesDelTc(tcs: TipoCambio[], anio: number, mes: number): string | null {
  return mesDeSerie(tcs.filter(t => Number(t.tc_real ?? t.tc_presupuestado) > 0), anio, mes)
}

export interface VentaParaCashFlow {
  modo: string | null
  cantidad: number
  precio_usd: number | null
  tc: number | null
  precio_pesos: number | null
  monto_pesos: number | null
  fecha_cobro: string | null
}

/**
 * El importe de una venta de arrendamiento para el Cash Flow. Con los pesos cerrados, ésos. Si
 * falta el TC, el del mes de cobro de la tabla de tipos de cambio (con arrastre), y lo dice.
 */
export function importeDeVenta(v: VentaParaCashFlow, tcs: TipoCambio[]): { monto: number; estimado: boolean; aviso: string | null } {
  if (v.monto_pesos != null && Number(v.monto_pesos) > 0) return { monto: Number(v.monto_pesos), estimado: false, aviso: null }
  const r = montoVenta({ modo: (v.modo ?? "matba") as "matba" | "pizarra", tons: Number(v.cantidad), precio_usd: v.precio_usd, tc: v.tc, precio_pesos: v.precio_pesos, fecha_cobro: v.fecha_cobro }, tcs)
  if (!r.estimado) return { monto: r.monto, estimado: false, aviso: null }
  const [anio, mes] = (v.fecha_cobro ?? "").split("-").map(Number)
  const t = anio && mes ? resolverTC(tcs, anio, mes) : { tc: 0, arrastrado: false }
  if (v.precio_usd == null || !t.tc) {
    return { monto: r.monto, estimado: true, aviso: v.precio_usd == null ? "⚠ sin precio fijado" : "⚠ sin TC en la tabla de tipos de cambio: no se puede estimar" }
  }
  const desde = anio && mes ? mesDelTc(tcs, anio, mes) : null
  return {
    monto: r.monto, estimado: true,
    aviso: `TC estimado a $${plata(t.tc)}${t.arrastrado && desde ? ` (último cargado: ${desde})` : ""} · U$S ${plata(Number(v.precio_usd))}/tn`,
  }
}

export interface CuotaNoFijada {
  id: string
  contrato: ContratoArrendamiento
  cuota: CuotaArrendamiento
  tons: number
  monto: number
  precio_usd: number | null
  tc: number | null
  detalle: string
}

/**
 * Las cuotas (o lo que queda de cada una) que todavía NO tienen precio fijado, valorizadas con el
 * precio de la posición y el TC del mes de cobro. Lo fijado ya está en las ventas: acá va sólo el
 * saldo en toneladas, para no contar dos veces.
 *
 * ⚠️ Sólo las que se cobran **de hoy en adelante**: una cuota sin fijar con la fecha ya pasada (hay de
 * la campaña 25/26) no es una proyección sino un dato a revisar — puede haberse cobrado por fuera del
 * módulo. Mostrarla como «a cobrar» inflaría el Cash Flow con plata que quizás ya entró.
 */
export function cuotasNoFijadas(
  contratos: ContratoArrendamiento[],
  cuotas: CuotaArrendamiento[],
  ventas: Array<{ cuota_id: string; tons: number }>,
  precios: PrecioGrano[],
  tcs: TipoCambio[],
  hoy: string,
): CuotaNoFijada[] {
  const porId = new Map(contratos.filter(c => c.activo !== false).map(c => [c.id, c]))
  const salida: CuotaNoFijada[] = []
  for (const q of cuotas) {
    const contrato = porId.get(q.contrato_id)
    if (!contrato) continue
    if ((q.fecha_cobro_estimada ?? "") < hoy) continue
    const tons = tonsDisponibles(Number(contrato.has), Number(q.qq_ha_cuota), ventas.filter(v => v.cuota_id === q.id))
    if (tons <= 0.0005) continue
    const p = resolverPrecioCuota(contrato, q, precios, tcs)
    const monto = Math.round(tons * p.pesos_por_ton * 100) / 100
    const grano = contrato.grano || "soja"
    const precio = p.modo === "pizarra"
      ? `$${plata(p.pesos_por_ton)}/tn (precio a mano)`
      : `U$S ${plata(p.precio_usd ?? 0)} (${grano} ${MES[q.posicion_mes - 1]}-${String(q.posicion_anio).slice(2)}${p.manual ? ", a mano" : ""}) × TC ${plata(p.tc ?? 0)} estimado`
    salida.push({
      id: q.id, contrato, cuota: q, tons, monto, precio_usd: p.precio_usd, tc: p.tc,
      detalle: `Arrendamiento ${contrato.centro_costo || ""} ${contrato.campania} — cuota ${q.numero_cuota} NO FIJADA: ${tn(tons)} tn × ${precio}`
        + (p.pesos_por_ton > 0 ? "" : " ⚠ sin precio o sin TC en la base"),
    })
  }
  return salida.sort((a, b) => a.cuota.fecha_cobro_estimada.localeCompare(b.cuota.fecha_cobro_estimada))
}
