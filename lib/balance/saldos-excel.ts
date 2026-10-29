/**
 * 📗 Las tablas de SALDOS (Sistema · SENASA · Campo · Balance) en el Excel de papeles — A-FEAT-1386.
 *
 * Las mismas que se ven en pantalla (`tres-saldos-hacienda.ts`, `saldos-productivos.ts`), con las diferencias como
 * FÓRMULAS (pedido del usuario: «si son fórmulas deben quedar las fórmulas en el excel y no los datos»).
 * Se agregan a una hoja ya armada: reciben el arreglo de filas y empujan las suyas, calculando el número de fila.
 */
import { conFormula, ENTERO, MONEDA } from "@/lib/balance/formato-excel"
import type { TresSaldos } from "@/lib/balance/tres-saldos-hacienda"
import type { FilaSaldoProductivo } from "@/lib/balance/saldos-productivos"
import { agruparStockInicio, valuarPastura, type RenglonStockInicio, type Pastura } from "@/lib/balance/stock-inicio"

export interface SaldosParaExcel {
  hacienda?: { inicio: TresSaldos; cierre: TresSaldos; leyenda?: string }
  productivos?: {
    inicio: { filas: FilaSaldoProductivo[]; total: FilaSaldoProductivo }
    cierre: { filas: FilaSaldoProductivo[]; total: FilaSaldoProductivo }
    fechaInicio: string; fechaCierre: string
  }
}

const v = (n: number | null | undefined) => n == null ? "" : n
/** `=X-Y` si las dos celdas tienen dato; vacío si falta alguna (una fórmula sobre vacío daría 0, y 0 se lee «cierra»). */
const resta = (a: number | null, b: number | null, ca: string, cb: string, fila: number, z: string) =>
  a == null || b == null ? "" : conFormula(`${ca}${fila}-${cb}${fila}`, a - b, z)

export function agregarSaldosHacienda(f: unknown[][], s: NonNullable<SaldosParaExcel["hacienda"]>, fechaInicio: string, fechaCierre: string) {
  f.push(["LOS SALDOS DE LA HACIENDA (cabezas) — Sistema = movimientos de la app · Campo = planilla de campo · Balance = contador"])
  if (s.leyenda) f.push(["", s.leyenda])
  for (const [titulo, t] of [[`Al INICIO (${fechaInicio})`, s.inicio], [`Al CIERRE (${fechaCierre})`, s.cierre]] as const) {
    f.push([])
    f.push([titulo, "Sistema", "SENASA", "Campo", "Balance", "Sist. − Campo", "SENASA − Campo", "Campo − Balance"])
    for (const x of [...t.filas, t.total]) {
      const n = f.length + 1
      f.push([x.nombre, x.sistema, v(x.senasa), v(x.campo), v(x.balance),
        resta(x.sistema, x.campo, "B", "D", n, ENTERO), resta(x.senasa, x.campo, "C", "D", n, ENTERO),
        resta(x.campo, x.balance, "D", "E", n, ENTERO)])
    }
    if (t.sinUbicar.length) f.push(["", `Categorías de la app sin lugar en la planilla (en el total del sistema): ${t.sinUbicar.map(u => `${u.categoria} ${u.cabezas}`).join(" · ")}`])
  }
  f.push(["", "Sistema y SENASA contra Campo: suelen ser mortandades sin registrar. Campo contra Balance: tratamiento contable."])
  f.push([])
}

export function agregarSaldosProductivos(f: unknown[][], s: NonNullable<SaldosParaExcel["productivos"]>) {
  f.push(["SALDOS DE INSUMOS, GAS OIL Y SEMENTERAS ($) — Sistema = stock valuado de la app (sólo al cierre) · Campo y Balance = foto del Balance propio (JMS / contador)"])
  for (const [titulo, t] of [[`Al INICIO (${s.fechaInicio})`, s.inicio], [`Al CIERRE (${s.fechaCierre})`, s.cierre]] as const) {
    f.push([])
    f.push([titulo, "Sistema", "Campo", "Balance", "Sist. − Campo", "Campo − Balance"])
    for (const x of [...t.filas, t.total]) {
      const n = f.length + 1
      f.push([x.nombre, v(x.sistema), v(x.campo), v(x.balance),
        resta(x.sistema, x.campo, "B", "C", n, MONEDA), resta(x.campo, x.balance, "C", "D", n, MONEDA)])
    }
  }
  f.push([])
}

/**
 * 📦 La hoja «Stock al inicio» (A-FEAT-1420): el stock DECLARADO al inicio producto por producto, en sus unidades, con
 * su fuente y cómo se emparejó con la app; y las pasturas valuadas por antigüedad. El total de cada grupo es fórmula.
 */
export function hojaStockInicio(renglones: RenglonStockInicio[], pasturas: Pastura[], fecha: string): unknown[][] {
  const f: unknown[][] = []
  const g = agruparStockInicio(renglones)
  f.push([`STOCK DECLARADO AL ${fecha.split("-").reverse().join("/")} — producto por producto (no es la existencia de la app)`])
  f.push([`${renglones.length} renglones · total $ ${g.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })} · ${g.aConfirmar} a confirmar con la app · ${g.sinValor} sin valor en la planilla`])
  for (const gr of g.grupos) {
    f.push([])
    f.push([gr.grupo.toUpperCase()])
    f.push(["Producto (planilla)", "Producto en la app", "Emparejado", "Cantidad", "Unidad", "Precio unitario", "Moneda", "Valor $", "Fuente", "Nota"])
    const desde = f.length + 1
    for (const r of gr.renglones) {
      f.push([r.producto_planilla, r.producto_app ?? "", r.emparejado ?? "", r.cantidad ?? "", r.unidad ?? "", r.precio_unitario ?? "", r.moneda,
        r.valor_pesos ?? "", r.fuente, r.nota ?? ""])
    }
    const hasta = f.length
    f.push(["Total " + gr.grupo, "", "", "", "", "", "", conFormula(`SUM(H${desde}:H${hasta})`, gr.valor, MONEDA)])
  }
  if (pasturas.length) {
    f.push([])
    f.push([`PASTURAS PERMANENTES al ${fecha.split("-").reverse().join("/")} — amortización por antigüedad (vida útil en años)`])
    f.push(["Lotes", "Año de siembra", "Hectáreas", "US$/ha", "Valor inicial US$", "Años", "% amortizado", "Valor actual US$", "Baja", "Fuente"])
    for (const p of pasturas.map(x => valuarPastura(x, fecha))) {
      f.push([p.lotes, p.anio_siembra, p.hectareas, p.usd_por_ha ?? "", p.valorInicialUsd ?? "", p.anios, Math.round(p.amortizado * 100) / 100,
        p.valorActualUsd ?? "", p.dadaDeBaja ? `${p.baja_fecha} ${p.baja_motivo ?? ""}` : "", p.fuente])
    }
  }
  return f
}

/** Una celda de texto con hipervínculo (A-FEAT-1422 nota 14: «poner los links a las cotizaciones para el contador»). */
export const conLink = (texto: string, url: string) => ({ t: "s" as const, v: texto, l: { Target: url, Tooltip: url } })
