/**
 * 🔁 **LA CUENTA CORRIENTE A HOY de una contraparte que opera en cuenta corriente** (A-FEAT-140, JMS 03/11).
 *
 * Es la MISMA cuenta que el papel 14 del balance (`armarCuentasCorrientes`, A-FEAT-1499), sin el corte del ejercicio:
 * compras (ARCA + histórico, sin repetir la que está en los dos) · ventas · sus retenciones como cobradas · y todo
 * movimiento del banco con su CUIT o con la marca «CTA <clave>». No se escribe otra cuenta: se llama a la misma función,
 * para que la pantalla y el balance den el mismo saldo.
 *
 * 🧮 Control: el saldo tiene que dar lo que dice el resumen que manda la contraparte (AFA al 27/10/26: $ 2.807.101,38).
 *
 * ⚠️ Por ahora lee el banco de MSA (`msa_galicia`), que es el único extracto con el CUIT de la contraparte
 * (`leyendas_adicionales_2`) — AFA es de MSA. Las cuentas de PAM y MA no informan el CUIT.
 */
import { armarCuentasCorrientes, type CompraParaCC, type VentaParaCC, type MovimientoParaCC, type ContraparteDelBalance, type CuentaCorrienteDelBalance } from "@/lib/balance/cuentas-corrientes"
import { soloDigitos, claveDeContraparte } from "./opera-cuenta-corriente"
export { claveDeContraparte }

type Cliente = any

const r2 = (x: number) => Math.round(x * 100) / 100

/** Pura: arma la cuenta a hoy con lo ya leído. La compra que está en ARCA y en el histórico (mismo número) va una vez. */
export function armarCuentaCorrienteAHoy(
  contraparte: ContraparteDelBalance,
  compras: (CompraParaCC & { fuente: "arca" | "historico" })[],
  ventas: VentaParaCC[],
  movimientos: MovimientoParaCC[],
): CuentaCorrienteDelBalance {
  const deArca = new Set(compras.filter(c => c.fuente === "arca").map(c => c.numero))
  const sinRepetir = compras.filter(c => c.fuente === "arca" || !deArca.has(c.numero))
  return armarCuentasCorrientes(sinRepetir, ventas, movimientos, {}, [contraparte]).cuentas[0]
}

/** Lee y arma la cuenta corriente a hoy de un CUIT. */
export async function cuentaCorrienteAHoy(sb: Cliente, cuit: string): Promise<CuentaCorrienteDelBalance & { nombre: string }> {
  const c = soloDigitos(cuit)
  const { data: prov } = await sb.from("proveedores").select("razon_social, nombre_fantasia").eq("cuit", c).maybeSingle()
  const clave = claveDeContraparte(prov?.nombre_fantasia, prov?.razon_social)
  const contraparte: ContraparteDelBalance = { clave, nombre: prov?.razon_social ?? c, cuit: c, aliasHistorico: [], etiquetasContable: [`CTA ${clave}`], porCuit: true }

  const compras: (CompraParaCC & { fuente: "arca" | "historico" })[] = []
  const num = (pv: unknown, n: unknown) => `${Number(pv ?? 0)}-${Number(n ?? 0)}`
  for (const sch of ["msa", "pam", "ma"]) {
    const { data, error } = await sb.schema(sch).from("comprobantes_arca").select("id, fecha_emision, punto_venta, numero_desde, imp_total, tipo_comprobante").eq("cuit", c)
    if (error) throw error
    for (const f of data ?? []) {
      // Las notas de crédito restan (tipo 3, 8, 13, 113…: las que la app ya trata como NC)
      const nc = [3, 8, 13, 53, 113, 203, 208, 213].includes(Number(f.tipo_comprobante))
      compras.push({ id: f.id, fecha: f.fecha_emision, numero: num(f.punto_venta, f.numero_desde), total: (nc ? -1 : 1) * Number(f.imp_total), cuit: c, fuente: "arca" })
    }
  }
  const { data: hist, error: eH } = await sb.schema("msa").from("comprobantes_historico").select("id, fecha, punto_de_venta, numero_desde, imp_total, nro_doc_emisor").eq("nro_doc_emisor", c)
  if (eH) throw eH
  for (const f of hist ?? []) compras.push({ id: f.id, fecha: f.fecha, numero: num(f.punto_de_venta, f.numero_desde), total: Number(f.imp_total), cuit: c, fuente: "historico" })

  const ventas: VentaParaCC[] = []
  for (const sch of ["msa", "pam", "ma"]) {
    const { data, error } = await sb.schema(sch).from("comprobantes_venta").select("id, fecha_liquidacion, nro_comprobante, punto_venta, numero_desde, imp_total, ret_iva, ret_iibb").eq("cuit_cliente", c)
    if (error) throw error
    for (const v of data ?? []) ventas.push({ id: v.id, fecha: v.fecha_liquidacion, numero: v.nro_comprobante || num(v.punto_venta, v.numero_desde), total: Number(v.imp_total), cuit: c,
      retenciones: r2(Number(v.ret_iva ?? 0) + Number(v.ret_iibb ?? 0)) })
  }

  const cols = "id, fecha, debitos, creditos, descripcion, detalle, contable, comprobantes_pagados, estado, cuit:leyendas_adicionales_2"
  const [{ data: porCuit, error: e1 }, { data: porMarca, error: e2 }] = await Promise.all([
    sb.from("msa_galicia").select(cols).ilike("leyendas_adicionales_2", `%${c}%`),
    sb.from("msa_galicia").select(cols).eq("contable", `CTA ${clave}`),
  ])
  if (e1) throw e1
  if (e2) throw e2
  const vistos = new Set<string>()
  const movimientos = [...(porCuit ?? []), ...(porMarca ?? [])].filter((m: any) => !vistos.has(m.id) && vistos.add(m.id)) as MovimientoParaCC[]

  return { ...armarCuentaCorrienteAHoy(contraparte, compras, ventas, movimientos), nombre: contraparte.nombre }
}

/**
 * 🎯 **Qué comprobantes EXPLICAN el saldo** (A-FEAT-140 + la propuesta automática de A-FEAT-1208).
 *
 * En una cuenta corriente lo que se debe es el saldo, no cada comprobante. Para que las pantallas sigan mostrando la
 * plata que falta pagar (o cobrar) —y el presupuesto la vea— se dejan abiertos los comprobantes MÁS NUEVOS del lado del
 * saldo hasta cubrirlo: le debo → las compras; me debe → las ventas. Todo lo demás está cancelado por la cuenta corriente.
 * Si el último que entra lo cubre de más, queda abierto y se informa cuánto de él sigue debiéndose (`parcial`).
 *
 * Ej. AFA al 27/10/26: saldo $ 2.807.101,37 = la FC 1772-6954 entera → queda sólo ella; las 8 facturas y las 3 ventas del
 * 13/05 (compensadas al liquidar la soja) dejan de figurar como pendientes.
 */
export function comprobantesQueExplicanElSaldo(cc: Pick<CuentaCorrienteDelBalance, "saldoAlCierre" | "resumen">): {
  abiertos: Set<string>; cancelados: Set<string>; parcial: { id: string; resta: number } | null
} {
  const saldo = cc.saldoAlCierre
  const docs = cc.resumen.asientos.filter(a => a.tipo === "compra" || a.tipo === "venta")
  const lado = saldo > 0.005 ? "compra" : saldo < -0.005 ? "venta" : null
  const abiertos = new Set<string>()
  let parcial: { id: string; resta: number } | null = null
  if (lado) {
    let falta = Math.abs(saldo)
    const candidatos = docs.filter(a => a.tipo === lado && Math.abs(a.importe) > 0).sort((a, b) => b.fecha.localeCompare(a.fecha))
    for (const a of candidatos) {
      if (falta <= 0.005) break
      abiertos.add(a.id)
      const imp = Math.abs(a.importe)
      if (imp - falta > 0.015) parcial = { id: a.id, resta: r2(falta) }
      falta = r2(falta - imp)
    }
  }
  return { abiertos, cancelados: new Set(docs.filter(a => !abiertos.has(a.id)).map(a => a.id)), parcial }
}

export interface CuentaCorrienteOperativa {
  cuit: string; nombre: string; clave: string; saldo: number
  /** Comprobantes que siguen figurando (explican el saldo). */
  abiertos: number
  /** Comprobantes que dejan de figurar como pendientes: los canceló la cuenta corriente. */
  cancelados: number
  parcial: { id: string; resta: number } | null
}

/**
 * Para las pantallas: de todas las contrapartes con la marca, los ids de comprobantes (compras y ventas) que ya NO se
 * listan como pendientes, y el resumen de cada cuenta para mostrarlo. Nunca rompe: si algo falla, no oculta nada.
 */
export async function canceladosPorCuentaCorriente(sb: Cliente, cuits: Set<string>): Promise<{ ocultos: Set<string>; cuentas: CuentaCorrienteOperativa[] }> {
  const ocultos = new Set<string>(), cuentas: CuentaCorrienteOperativa[] = []
  for (const cuit of cuits) {
    try {
      const cc = await cuentaCorrienteAHoy(sb, cuit)
      const e = comprobantesQueExplicanElSaldo(cc)
      for (const id of e.cancelados) ocultos.add(id)
      cuentas.push({ cuit, nombre: cc.nombre, clave: cc.contraparte.clave, saldo: cc.saldoAlCierre, abiertos: e.abiertos.size, cancelados: e.cancelados.size, parcial: e.parcial })
    } catch (err) {
      console.error(`Cuenta corriente de ${cuit}: no se pudo armar, se listan sus comprobantes como siempre`, err)
    }
  }
  return { ocultos, cuentas }
}

/** Atajo para las pantallas: los ids de compras y ventas que la cuenta corriente ya canceló (vacío si no hay marcadas). */
export async function idsCanceladosPorCuentaCorriente(sb: Cliente): Promise<Set<string>> {
  const { cuitsEnCuentaCorriente } = await import("./opera-cuenta-corriente")
  const cuits = await cuitsEnCuentaCorriente(sb)
  if (!cuits.size) return new Set()
  return (await canceladosPorCuentaCorriente(sb, cuits)).ocultos
}
