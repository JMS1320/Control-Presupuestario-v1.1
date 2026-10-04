/**
 * 💳 **EL PAGO DE CADA RESUMEN DE TARJETA — y el control que da gratis.** A-DEC-1002 · 2026-10-03.
 *
 * Pedido del usuario: emparejar la tarjeta con la cuenta corriente — *«el débito se ata al resumen que
 * paga, el SU PAGO del resumen siguiente se concilia contra ese mismo débito, y si hay diferencias debe
 * dar warnings»*.
 *
 * El mismo número llega por **tres caminos independientes** (pieza 4 del norte administrativo):
 *   1. el **total a pagar** que imprime el resumen;
 *   2. el **débito** en la cuenta corriente («Pago Visa Empresa»), vinculado por `nro_resumen`;
 *   3. el **«SU PAGO»** que trae el resumen siguiente.
 * Si no coinciden, se avisa y se dice cuánto; no frena (un pago parcial es posible — § 🚦).
 *
 * Lógica pura, probada en `lib/pruebas/casos.ts`.
 */

export interface ResumenTarjeta { nr: string; cierre: string; vencimiento: string | null; total: number }
export interface DebitoCtaCte { id: string; tabla: string; fecha: string; debitos: number; nro_resumen: string | null; descripcion: string | null }
export interface SuPago { id: string; nr: string; creditos: number; estado: string | null }

export type EstadoPago = "pagado" | "con_diferencia" | "propuesto" | "vencido_sin_pago" | "por_vencer" | "sin_saldo"

export interface PagoDelResumen {
  nr: string
  estado: EstadoPago
  vinculados: DebitoCtaCte[]
  /** Un único débito que coincide en importe y fecha, todavía sin vincular. */
  propuesto: DebitoCtaCte | null
  /** Los «SU PAGO» del resumen siguiente. */
  suPagos: SuPago[]
  avisos: string[]
}

const r2 = (n: number) => Math.round(n * 100) / 100
const f2 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const masDias = (iso: string, d: number) => {
  const [a, m, dd] = iso.split("-").map(Number)
  return new Date(Date.UTC(a, m - 1, dd + d)).toISOString().slice(0, 10)
}

/** Tolerancia: un peso (el banco redondea centavos al debitar). */
const TOL = 1

export function pagosDeResumenes(
  resumenes: ResumenTarjeta[], debitos: DebitoCtaCte[], suPagos: SuPago[], hoy: string,
): Map<string, PagoDelResumen> {
  const orden = [...resumenes].sort((a, b) => a.cierre.localeCompare(b.cierre))
  const usados = new Set(debitos.filter(d => d.nro_resumen).map(d => d.id))
  const out = new Map<string, PagoDelResumen>()
  orden.forEach((r, i) => {
    const siguiente = orden[i + 1]
    const suDelSiguiente = siguiente ? suPagos.filter(s => s.nr === siguiente.nr) : []
    const vinculados = debitos.filter(d => d.nro_resumen === r.nr)
    const avisos: string[] = []
    let propuesto: DebitoCtaCte | null = null
    let estado: EstadoPago

    if (r.total <= TOL) {
      estado = "sin_saldo"
    } else if (vinculados.length) {
      const pagado = r2(vinculados.reduce((a, d) => a + d.debitos, 0))
      const suTotal = r2(suDelSiguiente.reduce((a, s) => a + s.creditos, 0))
      if (Math.abs(pagado - r.total) > TOL)
        avisos.push(`Lo pagado desde la cuenta corriente ($${f2(pagado)}) no es el total del resumen ($${f2(r.total)}): diferencia $${f2(r2(pagado - r.total))}`)
      if (siguiente && suDelSiguiente.length && Math.abs(suTotal - pagado) > TOL)
        avisos.push(`El «SU PAGO» del resumen siguiente ($${f2(suTotal)}) no coincide con el débito ($${f2(pagado)})`)
      if (siguiente && !suDelSiguiente.length)
        avisos.push("El resumen siguiente no trae «SU PAGO»: revisar si el pago entró")
      estado = avisos.length ? "con_diferencia" : "pagado"
    } else {
      const hasta = masDias(r.vencimiento ?? masDias(r.cierre, 15), 15)
      const cands = debitos.filter(d => !usados.has(d.id) && !d.nro_resumen && Math.abs(d.debitos - r.total) <= TOL
        && d.fecha >= r.cierre && d.fecha <= hasta)
      if (cands.length === 1) {
        propuesto = cands[0]
        usados.add(cands[0].id)
        estado = "propuesto"
      } else {
        if (cands.length > 1) avisos.push(`${cands.length} débitos del mismo importe: elegí a mano cuál paga este resumen`)
        const vence = r.vencimiento ?? r.cierre
        estado = vence < hoy ? "vencido_sin_pago" : "por_vencer"
        if (estado === "vencido_sin_pago" && !cands.length)
          avisos.push(`Venció el ${vence} y no aparece un débito de $${f2(r.total)} en la cuenta corriente`)
      }
    }
    out.set(r.nr, { nr: r.nr, estado, vinculados, propuesto, suPagos: suDelSiguiente, avisos })
  })
  return out
}

export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, string> = {
  pagado: "✓ pagado",
  con_diferencia: "⚠ pagado con diferencia",
  propuesto: "pago encontrado — vincular",
  vencido_sin_pago: "⚠ vencido, sin pago",
  por_vencer: "por vencer",
  sin_saldo: "sin saldo a pagar",
}
