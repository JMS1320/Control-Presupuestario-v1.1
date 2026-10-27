/**
 * 🧾 **EL COBRO AGRUPADO — varias ventas del mismo cliente cobradas juntas** (A-FEAT-167, 2026-10-27).
 *
 * Espejo del pago agrupado de compras (`lib/pagos/agrupar.ts`), con una diferencia: un grupo de cobro
 * admite **VARIOS movimientos**. El caso que lo hizo falta: Sáenz Valiente liquidó 209-32006 y 209-32007
 * el 27/01/2026 y las cobró en 3 transferencias (28/01, 29/01 y 09/03), **cada una paga una cuota de
 * LAS DOS**. Ningún movimiento es de una sola venta, así que el vínculo 1 a 1 no alcanza.
 *
 * ## Cómo se guarda (script 114)
 * `{msa,pam,ma}.grupos_cobro` + `comprobantes_venta.grupo_cobro_id`. Cada movimiento queda atado a UNA
 * venta del grupo (`comprobante_venta_id`, como el pago agrupado ata el suyo al primer ítem). Por eso el
 * detalle del cobro de una venta agrupada **se arma con el grupo entero**: lo que entró a cualquiera de
 * sus ventas cuenta para todas. Una pantalla que todavía no sepa de grupos ve el cobro en la primera
 * venta: el total del cliente le da bien, sólo lo reparte mal.
 *
 * ## Las dos miradas, que tienen que dar lo mismo
 * JMS: *«pueden ser las dos juntas, deben dar lo mismo»* — y *«se expresa siempre saldo de la misma, no
 * qué factura se debe»*. El **grupo** es cómo se concilia (cada venta queda cobrada y el Cash Flow deja
 * de esperarla); la **cuenta corriente del cliente** es cómo se mira (ventas contra cobros y retenciones,
 * con un saldo). `controlDosCaminos` compara las dos: es el «mismo número por dos caminos» del norte
 * administrativo. Si no coinciden **avisa y no frena** (§ 🚦 de CLAUDE.md): la diferencia casi siempre
 * tiene explicación — un cobro que todavía no se imputó a una venta, un echeq endosado, una compensación.
 */
import { armarDetalleCobro, lineasDeCobro, type DetalleCobro, type FuentesCobro } from './detalle-cobro'

const r2 = (x: number) => Math.round(x * 100) / 100
const VACIAS: FuentesCobro = { movimientos: [], anticipos: [], compensaciones: [], retenciones: [] }

/**
 * Junta las fuentes de varias ventas en una sola. **Lo que aparece dos veces cuenta una**: un mismo
 * movimiento o certificado no puede sumar doble aunque se haya leído desde dos ventas.
 */
export function juntarFuentes(lista: (FuentesCobro | undefined)[]): FuentesCobro {
  const salida: FuentesCobro = { movimientos: [], anticipos: [], compensaciones: [], retenciones: [] }
  const vistos = new Set<string>()
  for (const f of lista) {
    if (!f) continue
    for (const clave of ['movimientos', 'anticipos', 'compensaciones', 'retenciones'] as const) {
      for (const x of f[clave] as { id: string }[]) {
        const k = `${clave}|${x.id}`
        if (vistos.has(k)) continue
        vistos.add(k)
        ;(salida[clave] as { id: string }[]).push(x)
      }
    }
  }
  return salida
}

/** Una venta, con lo que hace falta para el cobro agrupado. `esperado` = lo que el papel dice que se cobra. */
export interface VentaDelGrupo {
  id: string
  esperado: number
  grupo_cobro_id?: string | null
}

/** Las ventas que se cobran JUNTO con ésta (ella incluida). Sin grupo: sólo ella. */
export function ventasDelMismoGrupo<T extends { id: string; grupo_cobro_id?: string | null }>(v: T, todas: T[]): T[] {
  if (!v.grupo_cobro_id) return [v]
  const del = todas.filter(x => x.grupo_cobro_id === v.grupo_cobro_id)
  return del.some(x => x.id === v.id) ? del : [v, ...del]
}

/**
 * El detalle del cobro de un GRUPO: lo esperado es la suma de sus ventas, y las líneas son todo lo que
 * se cobró a cualquiera de ellas. Con una sola venta es exactamente `armarDetalleCobro` de esa venta.
 */
export function detalleDelGrupo(ventas: VentaDelGrupo[], fuentes: Map<string, FuentesCobro>): DetalleCobro {
  const esperado = r2(ventas.reduce((s, v) => s + (Number(v.esperado) || 0), 0))
  return armarDetalleCobro(juntarFuentes(ventas.map(v => fuentes.get(v.id) ?? VACIAS)), esperado)
}

/**
 * La parte del saldo del grupo que le toca a CADA venta, a prorrata de lo que espera cobrar cada una.
 * Las partes suman exacto el saldo del grupo (el centavo de redondeo va a la última), así la columna
 * «Saldo» de la pantalla de Cobros suma lo mismo con o sin grupo.
 */
export function repartirSaldoDelGrupo(ventas: VentaDelGrupo[], saldoGrupo: number): Map<string, number> {
  const salida = new Map<string, number>()
  const base = ventas.reduce((s, v) => s + (Number(v.esperado) || 0), 0)
  let acum = 0
  ventas.forEach((v, i) => {
    const parte = i === ventas.length - 1
      ? r2(saldoGrupo - acum)
      : r2(base ? saldoGrupo * (Number(v.esperado) || 0) / base : saldoGrupo / ventas.length)
    acum = r2(acum + parte)
    salida.set(v.id, parte)
  })
  return salida
}

/**
 * Las unidades de cobro de una lista de ventas: cada grupo una vez, y cada venta sin grupo sola.
 * Es lo que se suma para el saldo «comprobante por comprobante» sin contar un grupo dos veces.
 */
export function unidadesDeCobro<T extends VentaDelGrupo>(ventas: T[]): T[][] {
  const salida: T[][] = []
  const grupos = new Map<string, T[]>()
  for (const v of ventas) {
    if (!v.grupo_cobro_id) { salida.push([v]); continue }
    const g = grupos.get(v.grupo_cobro_id)
    if (g) g.push(v)
    else { const nuevo = [v]; grupos.set(v.grupo_cobro_id, nuevo); salida.push(nuevo) }
  }
  return salida
}

export interface ControlDosCaminos {
  /** Lo que falta cobrar, sumando el detalle de cada venta o grupo (la pantalla de Cobros). */
  porComprobante: number
  /** Lo que falta cobrar según la cuenta corriente: ventas − cobros − retenciones. */
  porCuentaCorriente: number
  /** porCuentaCorriente − porComprobante. */
  diferencia: number
  cierra: boolean
}

/**
 * 🔁 **El mismo saldo por dos caminos.** El de la cuenta corriente no sabe a qué venta fue cada cobro;
 * el de los comprobantes sí. Si coinciden, todo lo cobrado está imputado; si no, la diferencia es lo
 * que la cuenta corriente vio entrar y ninguna venta tiene asignado (o al revés).
 */
export function controlDosCaminos(
  ventas: VentaDelGrupo[], fuentes: Map<string, FuentesCobro>,
  cuentaCorriente: { ventas: number; cobros: number; retenciones: number },
): ControlDosCaminos {
  const porComprobante = r2(unidadesDeCobro(ventas).reduce((s, u) => s + detalleDelGrupo(u, fuentes).saldo, 0))
  const porCuentaCorriente = r2(cuentaCorriente.ventas - cuentaCorriente.cobros - cuentaCorriente.retenciones)
  const diferencia = r2(porCuentaCorriente - porComprobante)
  return { porComprobante, porCuentaCorriente, diferencia, cierra: Math.abs(diferencia) < 0.01 }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Etapa 2 (27/10): armar el grupo desde Cobros y conciliar un crédito contra el grupo desde el Extracto.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Una venta candidata a agrupar, con lo que hace falta para decidir si se puede. */
export interface VentaAgrupable {
  id: string
  nro_comprobante?: string | null
  cuit_cliente?: string | null
  grupo_cobro_id?: string | null
  estado?: string | null
}

const soloDigitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '')

/**
 * ¿Se pueden agrupar? `null` = sí; si no, el motivo en palabras del usuario.
 * - Al menos 2 ventas: un grupo de una es una venta sola.
 * - **El mismo cliente** (CUIT): un cobro agrupado es un cliente que paga varias juntas. Mezclar
 *   clientes haría que la plata de uno cancele la deuda del otro.
 * - Ninguna en otro grupo: una venta pertenece a un solo grupo.
 * - Ninguna anulada.
 */
export function validarAgrupacion(ventas: VentaAgrupable[]): string | null {
  if (ventas.length < 2) return 'Elegí al menos 2 ventas para agrupar'
  const cuits = new Set(ventas.map(v => soloDigitos(v.cuit_cliente)))
  if (cuits.has('')) return 'Hay una venta sin CUIT del cliente: cargalo antes de agrupar'
  if (cuits.size > 1) return 'Las ventas son de clientes distintos: un cobro agrupado es de un solo cliente'
  const enGrupo = ventas.filter(v => v.grupo_cobro_id)
  if (enGrupo.length) return `${enGrupo.map(v => v.nro_comprobante || v.id).join(', ')} ya está en otro grupo: desagrupalo primero`
  const anuladas = ventas.filter(v => String(v.estado || '').toLowerCase() === 'anulado')
  if (anuladas.length) return `${anuladas.map(v => v.nro_comprobante || v.id).join(', ')} está anulada`
  return null
}

/**
 * 🏦 **Cuánto le falta cobrar al grupo EN EL BANCO** — lo que el Extracto compara contra el crédito.
 *
 * `pagoCondiciones` de cada venta es lo que el banco tiene que acreditar (`cobroEsperado`, ya sin las
 * retenciones). Lo cobrado es todo lo que no es retención, de cualquiera de sus ventas, sin repetir.
 * `excluir` saca referencias que no se cuentan contra sí mismas (el movimiento que se está asignando).
 */
export function faltaCobrarDelGrupo(
  ventas: { id: string; pagoCondiciones: number }[],
  fuentes: Map<string, FuentesCobro>,
  excluir: (string | null | undefined)[] = [],
): { esperado: number; cobrado: number; falta: number } {
  const fuera = new Set(excluir.filter(Boolean) as string[])
  const esperado = r2(ventas.reduce((s, v) => s + (Number(v.pagoCondiciones) || 0), 0))
  const cobrado = r2(lineasDeCobro(juntarFuentes(ventas.map(v => fuentes.get(v.id) ?? VACIAS)))
    .filter(l => l.medio !== 'retencion' && !fuera.has(l.ref))
    .reduce((s, l) => s + l.monto, 0))
  return { esperado, cobrado, falta: r2(esperado - cobrado) }
}

/** Cómo se nombra el grupo en una lista: «Grupo 209-32006 + 209-32007». */
export function nombreDelGrupo(nros: (string | null | undefined)[]): string {
  return `Grupo ${nros.map(n => n || '—').join(' + ')}`
}

/** Una cuota, con lo que importa para cerrarla o reabrirla desde el grupo. */
export interface CuotaDelGrupo { estado?: 'a cobrar' | 'cobrado'; movimiento_id?: string | null; por_grupo?: string | null }

/** Al completarse el grupo: las cuotas abiertas (sin movimiento propio) pasan a cobradas, con la marca del grupo. */
export function cuotasAlCerrarGrupo<T extends CuotaDelGrupo>(plazos: T[], grupoId: string): T[] {
  return plazos.map(q => (q.estado !== 'cobrado' && !q.movimiento_id ? { ...q, estado: 'cobrado' as const, por_grupo: grupoId } : q))
}

/** Si al grupo le quitan un cobro: se reabren SÓLO las cuotas que cerró él. Lo marcado a mano no se toca. */
export function cuotasAlReabrirGrupo<T extends CuotaDelGrupo>(plazos: T[], grupoId: string): T[] {
  return plazos.map(q => {
    if (q.por_grupo !== grupoId) return q
    const { por_grupo: _fuera, ...resto } = q
    return { ...resto, estado: 'a cobrar' as const } as T
  })
}
