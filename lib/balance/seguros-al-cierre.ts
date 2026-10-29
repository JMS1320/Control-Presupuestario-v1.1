/**
 * 🛡️ LA CUENTA CORRIENTE CON LA ASEGURADORA, al cierre del ejercicio — para el papel 14 del balance (A-FEAT-1385).
 *
 * Pedido de JMS (2026-10-27): *«esto está en condiciones de arrojar el saldo de cuenta corriente a la app de balance,
 * con warnings porque hay evidencia de falta de comprobantes»*.
 *
 * Es el MISMO cálculo que Egresos → Seguros (cuotas de los PDF, NC compensadas, débitos y reintegros del banco estén
 * o no conciliados), cortado en la fecha de cierre: sólo lo vencido y lo movido hasta ese día. El saldo:
 *   > 0 → nos debitaron o acreditaron algo que ningún papel cierra (faltan NC / endosos / el papel del reintegro);
 *   < 0 → la aseguradora nos debe (una NC sin aplicar).
 * Cada cosa que lo explica va como un renglón «a reclamar»: es el WARNING del papel.
 *
 * Pura: se le pasa lo leído. La lectura es la misma de la pantalla de Seguros.
 */
import { controlarDebitos, cuotasEsperadas, type EndosoParaControl, type MovimientoAseguradora } from "@/lib/polizas/control-debitos"
import {
  resumenPorEjercicio, cuentaCorriente, ejercicioDe, TEXTO_MOTIVO, CATEGORIA_MOTIVO,
  type PolizaParaResumen, type RenglonResumen, type LineaCtaCte,
} from "@/lib/polizas/resumen-ejercicio"

export interface AseguradoraAlCierre {
  nombre: string
  fechaCierre: string
  /** Cargos − créditos al cierre. 0 = papeles y plata coinciden. */
  saldo: number
  /** Lo que explica el saldo: lo que falta reclamar (con lo arrastrado de ejercicios anteriores). */
  aReclamar: { categoria: string; que: string; poliza: string | null; importe: number; desde: string | null; explicacion?: RenglonResumen["explicacion"] }[]
  lineas: LineaCtaCte[]
  /** El control: el saldo de la cuenta corriente = la suma de «a reclamar». */
  cierra: boolean
  /** Las cuotas ya controladas contra el banco (para el desglose de la flota, `reparto-flota.ts`). */
  cuotas?: import("@/lib/polizas/control-debitos").CuotaControlada[]
  /** 🚗 El desglose de la flota por responsable (A-FEAT-1422 nota 9). Lo agrega la pantalla si pudo leer las pólizas. */
  repartoFlota?: import("./reparto-flota").RepartoFlota
}

export function aseguradoraAlCierre(
  nombre: string,
  polizas: PolizaParaResumen[],
  endosos: EndosoParaControl[],
  movimientos: MovimientoAseguradora[],
  desdeExtracto: string,
  fechaCierre: string,
): AseguradoraAlCierre {
  const movs = movimientos.filter(m => m.fecha <= fechaCierre)
  const emitidas = cuotasEsperadas(endosos)
  const ctl = controlarDebitos(emitidas, movs, { desde: desdeExtracto, hasta: fechaCierre })
  const resumen = resumenPorEjercicio(ctl.cuotas, ctl.movimientos, polizas, fechaCierre, ejercicioDe(desdeExtracto), emitidas)
  const delCierre = resumen.find(r => r.ejercicio === ejercicioDe(fechaCierre)) ?? resumen[resumen.length - 1]
  const cc = cuentaCorriente(emitidas, ctl.cuotas, ctl.movimientos, polizas, desdeExtracto, fechaCierre)
  const aReclamar = (delCierre?.aReclamar ?? []).map((r: RenglonResumen) => ({
    categoria: r.motivo ? CATEGORIA_MOTIVO[r.motivo] : "Diferencia",
    que: r.motivo ? TEXTO_MOTIVO[r.motivo] : "diferencia",
    poliza: r.poliza,
    importe: r.diferencia,
    desde: r.ejercicioOrigen ?? null,
    explicacion: r.explicacion,
  }))
  const suma = Math.round(aReclamar.reduce((t, x) => t + x.importe, 0) * 100) / 100
  return { nombre, fechaCierre, saldo: cc.saldo, aReclamar, lineas: cc.lineas, cierra: Math.abs(suma - cc.saldo) < 0.01, cuotas: ctl.cuotas }
}
