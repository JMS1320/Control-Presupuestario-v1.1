/**
 * 💵 **LAS OPERACIONES EN DÓLARES — cuántos dólares, a qué TC, cuántos pesos** (A-FEAT-1530, JMS 03/11: *«tenemos que poder
 * exportar en el Excel las operaciones en dólares: tantos dólares se transformaron en tantos pesos a tal TC»*).
 *
 * Una solapa del set del balance («07.2 Operaciones en dólares») con tres partes:
 *  1 · **Resumen por cuenta contable y por mes, en PESOS**, con Nro que lleva al detalle (regla de los resúmenes, A-FEAT-1513).
 *  2 · **Detalle**: cada movimiento de cada cuenta en dólares de la empresa con US$ (débito/crédito), TC, de dónde sale el TC, pesos y
 *      un CONTROL por renglón (US$ × TC − pesos = 0). Lo que no tiene TC se muestra «sin TC», nunca un cero inventado.
 *  3 · **Compra / venta de dólares**: cada salida (o entrada) de US$ que es compraventa, con su otra punta en pesos (la cuenta
 *      «Compra / Venta de dólares» en un extracto en pesos, hasta 10 días después) y el TC que resulta. Si la otra punta no está, se dice.
 *
 * Pura. Los datos los junta la pantalla de papeles (`components/papeles-de-balance.tsx`).
 */
import { hojaResumenPorMes } from "./resumen-por-mes"
import type { MovimientoExtracto } from "./papeles-bancarios"

export interface MovimientoEnDolares extends MovimientoExtracto {
  tipo_cambio?: number | null
  importe_pesos?: number | null
  comprobantes_pagados?: string | null
  nota_operador?: string | null
}
export interface CuentaEnDolares { cuenta: string; tipo: string; movs: MovimientoEnDolares[] }
/** Un movimiento en PESOS imputado a «Compra / Venta de dólares» (la otra punta de una compraventa). */
export interface PuntaEnPesos { fecha: string; cuenta: string; descripcion?: string | null; debitos?: number | null; creditos?: number | null }

const n = (x: unknown) => Number(x ?? 0) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const r4 = (x: number) => Math.round(x * 10000) / 10000
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
export const esCompraVenta = (categ?: string | null, descripcion?: string | null) =>
  /compra\s*\/\s*venta de d[oó]lares/i.test(String(categ ?? "")) || /securities|gsec/i.test(String(descripcion ?? ""))

export interface OperacionEnDolares {
  cuenta: string; fecha: string; descripcion: string; cuentaContable: string; template: string
  usdDebito: number; usdCredito: number; tc: number | null; origenTc: string; pesos: number | null
  /** US$ × TC − pesos, al centavo (null sin TC). */
  control: number | null
}

/** De dónde sale el TC del movimiento: lo que dice su nota (BNA del día), la operación, o «sin TC». */
function origenDelTc(m: MovimientoEnDolares): string {
  if (m.tipo_cambio == null || !(n(m.tipo_cambio) > 0)) return m.importe_pesos != null ? "pesos escritos a mano" : "sin TC"
  if (/TC BNA/i.test(String(m.nota_operador ?? ""))) return "BNA divisas vendedor del día"
  return "cargado en el movimiento"
}

export function operacionesEnDolares(cuentas: CuentaEnDolares[]): OperacionEnDolares[] {
  const out: OperacionEnDolares[] = []
  for (const c of cuentas) for (const m of c.movs) {
    const deb = n(m.debitos), cred = n(m.creditos), usd = deb || cred
    const tc = m.tipo_cambio != null && n(m.tipo_cambio) > 0 ? n(m.tipo_cambio) : null
    const pesos = m.importe_pesos != null ? Math.abs(n(m.importe_pesos)) : tc != null ? r2(usd * tc) : null
    out.push({
      cuenta: c.cuenta, fecha: String(m.fecha ?? "").slice(0, 10), descripcion: String(m.descripcion ?? ""), cuentaContable: String(m.categ ?? "") || "(sin cuenta)",
      template: String(m.comprobantes_pagados ?? "").replace(/\s+-\s+\S+\s+\d{4}$/, ""), usdDebito: deb, usdCredito: cred, tc, origenTc: origenDelTc(m), pesos,
      control: tc != null && pesos != null ? r2(usd * tc - pesos) : null,
    })
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cuenta.localeCompare(b.cuenta))
}

export interface CompraVentaDeDolares {
  tipo: "venta" | "compra"; fechaUsd: string; cuentaUsd: string; descripcion: string; usd: number
  fechaPesos: string | null; cuentaPesos: string | null; pesos: number | null; tcImplicito: number | null; estado: string
}

/**
 * Empareja cada movimiento de compraventa en US$ con su otra punta en pesos: venta = sale US$ y entra pesos; compra = al revés.
 * La punta en pesos es la más cercana (0 a 10 días después) del sentido contrario; cada una se usa una sola vez.
 */
export function comprasVentasDeDolares(cuentas: CuentaEnDolares[], puntas: PuntaEnPesos[]): CompraVentaDeDolares[] {
  const usadas = new Set<number>()
  const out: CompraVentaDeDolares[] = []
  const movs = cuentas.flatMap(c => c.movs.map(m => ({ ...m, cuenta: c.cuenta }))).filter(m => esCompraVenta(m.categ, m.descripcion))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  for (const m of movs) {
    const venta = n(m.debitos) > 0, usd = venta ? n(m.debitos) : n(m.creditos)
    if (!usd) continue
    const cand = puntas.map((p, i) => ({ p, i })).filter(({ p, i }) => !usadas.has(i) && (venta ? n(p.creditos) > 0 : n(p.debitos) > 0)
      && dias(p.fecha, String(m.fecha)) >= 0 && dias(p.fecha, String(m.fecha)) <= 10)
      .sort((a, b) => dias(a.p.fecha, String(m.fecha)) - dias(b.p.fecha, String(m.fecha)))
    // La otra punta pueden ser varios créditos del mismo día (p. ej. el rescate y sus centavos): se toman todos los de esa fecha
    const fecha = cand[0]?.p.fecha
    const delDia = fecha ? cand.filter(c => c.p.fecha === fecha) : []
    for (const c of delDia) usadas.add(c.i)
    const pesos = delDia.length ? r2(delDia.reduce((t, c) => t + (venta ? n(c.p.creditos) : n(c.p.debitos)), 0)) : null
    out.push({
      tipo: venta ? "venta" : "compra", fechaUsd: String(m.fecha).slice(0, 10), cuentaUsd: m.cuenta, descripcion: String(m.descripcion ?? ""), usd,
      fechaPesos: fecha ?? null, cuentaPesos: delDia[0]?.p.cuenta ?? null, pesos, tcImplicito: pesos != null ? r4(pesos / usd) : null,
      estado: pesos != null ? `con su otra punta en pesos (${delDia.length} movimiento${delDia.length > 1 ? "s" : ""})` : "SIN su otra punta en pesos (hasta 10 días después)",
    })
  }
  return out
}

/** La solapa «07.2 Operaciones en dólares». */
export function hojaOperacionesEnDolares(cuentas: CuentaEnDolares[], puntas: PuntaEnPesos[], etiqueta: string, empresa: string,
  meses: { clave: string; rotulo: string }[]): unknown[][] {
  const ops = operacionesEnDolares(cuentas)
  const sinTc = ops.filter(o => o.tc == null && o.pesos == null).length
  const h = hojaResumenPorMes(ops.map(o => ({
    categoria: o.cuentaContable, mes: o.fecha.slice(0, 7), importe: o.pesos == null ? 0 : (o.usdDebito ? o.pesos : -o.pesos),
    columnas: [o.cuenta, o.fecha, o.descripcion, o.template, o.usdDebito || "", o.usdCredito || "", o.tc ?? "sin TC", o.origenTc, o.control ?? "sin TC"],
  })), {
    titulo: `OPERACIONES EN DÓLARES — ${empresa} — ejercicio ${etiqueta}`,
    notas: [
      "Cada movimiento de las cuentas en dólares con su conversión: US$ × TC = pesos. El resumen suma los PESOS por cuenta contable y mes (débito +, crédito −); filtrá el detalle por Nro para ver cómo se compone.",
      `Control por renglón: US$ × TC − pesos tiene que dar 0.${sinTc ? ` ⚠️ ${sinTc} movimiento(s) SIN TC: van en 0 al resumen y dicen «sin TC» — hay que cargarles el cambio.` : " ✓ Todos los movimientos tienen TC."}`,
    ],
    meses, rotuloImporte: "Pesos (neto)",
    encabezadoDetalle: ["Cuenta", "Fecha", "Descripción", "Template", "US$ débito", "US$ crédito", "TC", "De dónde sale el TC", "Control (US$×TC − pesos)"],
  })
  const cv = comprasVentasDeDolares(cuentas, puntas)
  h.push([], ["COMPRA / VENTA DE DÓLARES — los dólares que se transformaron en pesos (o al revés), con el TC que resulta"],
    ["Tipo", "Fecha US$", "Cuenta US$", "Descripción", "US$", "Fecha pesos", "Cuenta pesos", "Pesos", "TC que resulta", "Estado"])
  if (!cv.length) h.push(["", "", "", "No hubo compraventas de dólares en el ejercicio"])
  for (const c of cv) h.push([c.tipo, c.fechaUsd, c.cuentaUsd, c.descripcion, c.usd, c.fechaPesos ?? "", c.cuentaPesos ?? "", c.pesos ?? "", c.tcImplicito ?? "", c.estado])
  return h
}
