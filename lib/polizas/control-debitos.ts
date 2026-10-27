/**
 * 🔁 «¿Tenemos todas las pólizas?» — el mismo seguro por dos caminos (A-FEAT-1309 / A-AUTO-05).
 *
 * Camino 1: las **cuotas de las pólizas procesadas** (sumando sus endosos).
 * Camino 2: los **movimientos de la aseguradora en el extracto**, encontrados por las LEYENDAS
 * ADICIONALES (`FEDERACION PATRO` / `SEGUROS`), **estén o no conciliados** — indicación del usuario
 * 2026-10-20: ahí están todos los débitos y reintegros completos.
 *
 * El usuario: *«si la póliza existe, se debita»*. Entonces:
 * - 🛑 **un débito que no es cuota de ninguna póliza procesada = una póliza que falta cargar**;
 * - 🛑 **una cuota vencida sin débito** = no se debitó, o la póliza se dio de baja sin su nota de crédito.
 *
 * ## Las notas de crédito no se reintegran: se COMPENSAN
 * Federación no devuelve la plata de una NC: la descuenta de las cuotas siguientes de la misma póliza
 * (Vida colectivo 670821: −47.481,60 se comió entera la cuota de 42.300,55 de febrero). Por eso lo que
 * se espera en el banco no es la cuota sino **la cuota menos el saldo a favor que venga arrastrando**.
 *
 * Avisa, no frena (§ 🚦): es una discrepancia contra el hecho del negocio.
 */

export interface CuotaEsperada {
  poliza: string
  vencimiento: string // ISO
  importe: number // suma de los endosos que vencen ese día (puede ser negativa: una NC)
  /** Lo que la aseguradora dice que falta cobrar de esta cuota, según el último pago consolidado… */
  saldo?: number | null
  /** …y la fecha de ese consolidado. */
  saldoAl?: string | null
  /** De qué endoso sale (para ir a su PDF desde la cuenta corriente). Si vino del consolidado, el endoso que lo trae. */
  endoso?: number
}

export interface MovimientoAseguradora {
  id: string
  fecha: string // ISO
  debitos: number
  creditos: number
  estado?: string | null
}

export type ResultadoCuota =
  | "ok"
  | "compensada" // la cubrió el saldo a favor de una NC: no hay débito y está bien
  | "nc" // la NC misma: suma saldo a favor
  | "importe-distinto"
  | "falta-debito"
  | "a-vencer"
  | "anterior-al-extracto"

export interface CuotaControlada extends CuotaEsperada {
  esperadoEnBanco: number
  resultado: ResultadoCuota
  movimientoId: string | null
  debitado: number | null
}

export interface MovimientoControlado extends MovimientoAseguradora {
  poliza: string | null
  vencimiento: string | null
  /** «sin-poliza» = débito que no es de ninguna póliza procesada → falta cargar una. */
  resultado: "cuota" | "sin-poliza" | "reintegro-sin-nc"
}

const r2 = (n: number) => Math.round(n * 100) / 100
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5)

/**
 * Junta en una sola cuota los vencimientos de una póliza que caen a pocos días (el plan del endoso y el
 * consolidado a veces difieren: «29-01-2026» vs «01/02/2026»).
 */
export function cuotasDeLaPoliza(cuotas: CuotaEsperada[], margenDias = 7): CuotaEsperada[] {
  const out: CuotaEsperada[] = []
  for (const c of [...cuotas].sort((a, b) => a.poliza.localeCompare(b.poliza) || a.vencimiento.localeCompare(b.vencimiento))) {
    const prev = out[out.length - 1]
    if (prev && prev.poliza === c.poliza && Math.abs(dias(c.vencimiento, prev.vencimiento)) <= margenDias) {
      prev.importe = r2(prev.importe + c.importe)
      if (c.vencimiento > prev.vencimiento) prev.vencimiento = c.vencimiento
    } else out.push({ ...c })
  }
  return out
}

export function controlarDebitos(
  cuotas: CuotaEsperada[],
  movimientos: MovimientoAseguradora[],
  ventana: { desde: string; hasta: string },
  opciones: { antes?: number; despues?: number; tolerancia?: number } = {},
): { cuotas: CuotaControlada[]; movimientos: MovimientoControlado[] } {
  const antes = opciones.antes ?? 10, despues = opciones.despues ?? 25, tol = opciones.tolerancia ?? 0.01
  const libres = new Set(movimientos.map(m => m.id))
  const porId = new Map(movimientos.map(m => [m.id, m]))
  const asignado = new Map<string, { poliza: string; vencimiento: string }>()

  const buscar = (monto: number, venc: string, campo: "debitos" | "creditos", tolerancia: number) => {
    let mejor: MovimientoAseguradora | null = null
    for (const id of libres) {
      const m = porId.get(id)!
      if (Math.abs(m[campo] - monto) > tolerancia) continue
      const d = dias(m.fecha, venc)
      if (d < -antes || d > despues) continue
      if (!mejor || Math.abs(dias(m.fecha, venc)) < Math.abs(dias(mejor.fecha, venc))) mejor = m
    }
    return mejor
  }

  const salida: CuotaControlada[] = []
  const porPoliza = new Map<string, CuotaEsperada[]>()
  for (const c of cuotasDeLaPoliza(cuotas)) porPoliza.set(c.poliza, [...(porPoliza.get(c.poliza) ?? []), c])

  for (const [, lista] of porPoliza) {
    let aFavor = 0
    for (const c of lista) {
      const base = { ...c, esperadoEnBanco: 0, movimientoId: null as string | null, debitado: null as number | null }
      if (c.importe < 0) {
        // La NC: si apareció un reintegro en el banco se toma; si no, queda como saldo a favor.
        const m = buscar(-c.importe, c.vencimiento, "creditos", tol)
        if (m) { libres.delete(m.id); asignado.set(m.id, { poliza: c.poliza, vencimiento: c.vencimiento }); salida.push({ ...base, resultado: "nc", movimientoId: m.id, debitado: -m.creditos }) }
        else { aFavor = r2(aFavor - c.importe); salida.push({ ...base, resultado: "nc" }) }
        continue
      }
      let esperado = r2(Math.max(0, c.importe - aFavor))
      aFavor = r2(Math.max(0, aFavor - c.importe))
      // Si el consolidado dice que de esta cuota queda MENOS por cobrar, la diferencia ya la compensó la
      // aseguradora con algo que no tenemos cargado (endosos viejos): se espera el saldo. Caso: Vida 644709,
      // cuota 7/7 de 21.574,03 con saldo 6.598,75 — y el banco debitó 6.598,75 (el consolidado es del mismo día).
      if (c.saldo != null && c.saldo > 0 && c.saldo < esperado) esperado = r2(c.saldo)
      base.esperadoEnBanco = esperado
      if (c.vencimiento < ventana.desde) { salida.push({ ...base, resultado: "anterior-al-extracto" }); continue }
      if (esperado === 0) { salida.push({ ...base, resultado: "compensada" }); continue }
      let m = buscar(esperado, c.vencimiento, "debitos", tol)
      let resultado: ResultadoCuota = "ok"
      if (!m) { m = buscar(esperado, c.vencimiento, "debitos", Math.max(5, esperado * 0.01)); resultado = "importe-distinto" }
      if (m) {
        libres.delete(m.id); asignado.set(m.id, { poliza: c.poliza, vencimiento: c.vencimiento })
        salida.push({ ...base, resultado, movimientoId: m.id, debitado: m.debitos })
      } else if (c.saldo === 0 && c.saldoAl && c.saldoAl >= c.vencimiento) {
        // Sin débito, pero la aseguradora la da por cobrada después de vencida: se compensó.
        salida.push({ ...base, resultado: "compensada" })
      } else salida.push({ ...base, resultado: c.vencimiento > ventana.hasta ? "a-vencer" : "falta-debito" })
    }
  }

  const movs: MovimientoControlado[] = movimientos.map(m => {
    const a = asignado.get(m.id)
    if (a) return { ...m, poliza: a.poliza, vencimiento: a.vencimiento, resultado: "cuota" }
    return { ...m, poliza: null, vencimiento: null, resultado: m.creditos > 0 ? "reintegro-sin-nc" : "sin-poliza" }
  })
  return { cuotas: salida, movimientos: movs }
}

/** ¿Es de la aseguradora este movimiento? Por las leyendas adicionales, esté o no conciliado. */
export interface EndosoParaControl {
  poliza: string
  endoso: number
  cuotas: { vencimiento: string; importe: number }[]
  consolidado?: { fecha: string | null; cuotas: { vencimiento: string; importe: number; saldo?: number | null }[] } | null
}

/**
 * Las cuotas que se esperan de cada póliza.
 * - Si están TODOS sus endosos (del 0 al último), se suman los endosos — es lo más fiel: cada endoso con lo suyo.
 * - Si falta alguno (endosos de antes de lo cargado), se usa el ÚLTIMO PAGO CONSOLIDADO de la aseguradora,
 *   que ya trae todo sumado. Caso: Vida colectivo 644709, cargados sólo los endosos 7 y 8.
 * En los dos casos se adjunta el saldo que informa el consolidado más nuevo.
 */
export function cuotasEsperadas(endosos: EndosoParaControl[]): CuotaEsperada[] {
  const out: CuotaEsperada[] = []
  const porPoliza = new Map<string, EndosoParaControl[]>()
  for (const e of endosos) porPoliza.set(e.poliza, [...(porPoliza.get(e.poliza) ?? []), e])
  for (const [poliza, lista] of porPoliza) {
    const nros = new Set(lista.map(e => e.endoso))
    const completa = [...Array(Math.max(...nros) + 1).keys()].every(n => nros.has(n))
    const conConsolidado = lista.filter(e => e.consolidado?.cuotas.length).sort((a, b) => b.endoso - a.endoso)[0]
    const ultimo = conConsolidado?.consolidado ?? null
    const saldoDe = (venc: string) => {
      const c = ultimo?.cuotas.find(x => Math.abs(dias(x.vencimiento, venc)) <= 7)
      return c ? { saldo: c.saldo ?? null, saldoAl: ultimo?.fecha ?? null } : {}
    }
    if (completa || !ultimo) {
      for (const e of lista) for (const c of e.cuotas) out.push({ poliza, vencimiento: c.vencimiento, importe: c.importe, endoso: e.endoso })
      // el saldo se adjunta después de juntar los endosos del mismo vencimiento
      for (const c of out.filter(x => x.poliza === poliza)) Object.assign(c, saldoDe(c.vencimiento))
    } else {
      for (const c of ultimo.cuotas) out.push({ poliza, vencimiento: c.vencimiento, importe: c.importe, saldo: c.saldo ?? null, saldoAl: ultimo.fecha, endoso: conConsolidado!.endoso })
    }
  }
  return out
}

export const LEYENDA_FEDERACION = /FEDERACI|PATRONAL/i

// 🧨 Un solo parámetro a propósito: usada como `movs.filter(esDeLaAseguradora)`, el segundo argumento
// que pasa `filter` es el NÚMERO DE FILA — con un `patron` opcional ahí, se rompía. Otra aseguradora → `esDeAseguradora`.
export function esDeLaAseguradora(m: { leyendas_adicionales_1?: string | null; leyendas_adicionales_2?: string | null }): boolean {
  return esDeAseguradora(m, LEYENDA_FEDERACION)
}
export function esDeAseguradora(m: { leyendas_adicionales_1?: string | null; leyendas_adicionales_2?: string | null }, patron: RegExp): boolean {
  return patron.test(m.leyendas_adicionales_1 ?? "") || patron.test(m.leyendas_adicionales_2 ?? "")
}
