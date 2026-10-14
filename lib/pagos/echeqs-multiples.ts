/**
 * 📝 PAGAR CON VARIOS ECHEQS y el EXCEL DE EMISIÓN del banco — A-FEAT-1282 (2026-10-14).
 *
 * Pedido del usuario: *«poder hacer el export de pagos vía echeq desde la aplicación como lo hacemos
 * para transferencias… tres echeqs por un tercio cada uno»*, precisado el mismo día:
 *   · *«no pongas por defecto 15, 30 y 60 porque eso varía. Mejor poner cantidad de echeqs y si son de
 *     igual monto, o por %, o tales montos»*;
 *   · los montos y % son **partes del TOTAL** del pago;
 *   · la retención SICORE *«descontarla equitativamente de cada echeq»* → se reparte en la MISMA
 *     proporción que las partes (con partes iguales, en partes iguales);
 *   · vale para facturas, templates y anticipos, y se opera desde el Cash Flow.
 *
 * Lo que se reparte es el **neto a librar** (total − retención − descuento), con los mismos pesos que
 * las partes del total: así cada echeq lleva su parte del total menos su parte de la retención. El
 * centavo que sobra por redondeo va al ÚLTIMO echeq, para que la suma cierre exacta.
 *
 * Esto es pura cuenta (sin base): la usan el modal del Cash Flow, el registro de los cheques
 * (`lib/pagos/echeq.ts`) y los casos.
 */

export type ModoReparto = 'iguales' | 'porcentaje' | 'montos'

/** Un echeq del plan, como lo carga el usuario. `parte` = % (modo porcentaje) o monto (modo montos). */
export interface EcheqPlan {
  fechaCobro: string
  parte?: number
  numero?: string
}

export interface PlanEcheqs {
  modo: ModoReparto
  echeqs: EcheqPlan[]
}

export const MAX_ECHEQS_POR_ARCHIVO = 250

const r2 = (n: number) => Math.round(n * 100) / 100

/** Los pesos de cada echeq (suman 1). */
export function pesosDelPlan(plan: PlanEcheqs): number[] {
  const n = plan.echeqs.length
  if (!n) return []
  if (plan.modo === 'iguales') return plan.echeqs.map(() => 1 / n)
  const partes = plan.echeqs.map(e => Number(e.parte) || 0)
  const suma = partes.reduce((s, p) => s + p, 0)
  return suma > 0 ? partes.map(p => p / suma) : plan.echeqs.map(() => 1 / n)
}

/** Reparte un monto según los pesos; lo que sobra por redondeo va al último. */
export function repartirMonto(monto: number, pesos: number[]): number[] {
  if (!pesos.length) return []
  const partes = pesos.map(p => r2(monto * p))
  const resto = r2(monto - partes.reduce((s, x) => s + x, 0))
  partes[partes.length - 1] = r2(partes[partes.length - 1] + resto)
  return partes
}

/**
 * 🛑 Lo que impide confirmar el plan (§ 🚦 integridad: el plan se contradice a sí mismo). Devuelve la
 * lista de problemas; vacía = se puede confirmar.
 *   · cada echeq con su fecha de cobro;
 *   · por % → suman 100; por montos → suman el TOTAL del pago (son partes del total).
 */
export function problemasDelPlan(plan: PlanEcheqs, totalDelPago: number): string[] {
  const p: string[] = []
  const n = plan.echeqs.length
  if (n < 1) p.push('Indicá cuántos echeqs')
  if (n > MAX_ECHEQS_POR_ARCHIVO) p.push(`El banco acepta hasta ${MAX_ECHEQS_POR_ARCHIVO} echeqs por archivo`)
  plan.echeqs.forEach((e, i) => { if (!e.fechaCobro) p.push(`Falta la fecha de cobro del echeq ${i + 1}`) })
  if (plan.modo === 'porcentaje') {
    const suma = r2(plan.echeqs.reduce((s, e) => s + (Number(e.parte) || 0), 0))
    if (Math.abs(suma - 100) > 0.001) p.push(`Los porcentajes suman ${suma.toLocaleString('es-AR')} % y tienen que sumar 100 %`)
  }
  if (plan.modo === 'montos') {
    const suma = r2(plan.echeqs.reduce((s, e) => s + (Number(e.parte) || 0), 0))
    if (Math.abs(suma - r2(totalDelPago)) > 0.005) {
      p.push(`Los montos suman $${suma.toLocaleString('es-AR', { minimumFractionDigits: 2 })} y tienen que sumar el total del pago, $${r2(totalDelPago).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
    }
  }
  if (plan.echeqs.some(e => plan.modo !== 'iguales' && !(Number(e.parte) > 0))) p.push('Cada echeq tiene que tener su parte mayor a cero')
  return p
}

export interface EcheqCalculado {
  fechaCobro: string
  numero?: string
  /** Lo que va escrito en el echeq (el neto a librar de su parte). */
  monto: number
  /** Su parte de la retención SICORE y del descuento (para el registro del cheque). */
  retencion: number
  descuento: number
}

/**
 * Los echeqs con su monto: el NETO (total − retención − descuento) repartido con los pesos del plan, y
 * la retención y el descuento repartidos igual. 🧮 Identidad: Σ monto + Σ retención + Σ descuento = total.
 */
export function calcularEcheqs(plan: PlanEcheqs, neto: number, retencion = 0, descuento = 0): EcheqCalculado[] {
  const pesos = pesosDelPlan(plan)
  const montos = repartirMonto(neto, pesos)
  const rets = repartirMonto(retencion, pesos)
  const descs = repartirMonto(descuento, pesos)
  return plan.echeqs.map((e, i) => ({
    fechaCobro: e.fechaCobro, numero: e.numero?.trim() || undefined,
    monto: montos[i], retencion: rets[i], descuento: descs[i],
  }))
}

/** La fecha del último echeq: hasta ahí el pago no termina de salir del banco. */
export function ultimaFechaCobro(plan: PlanEcheqs): string {
  return plan.echeqs.map(e => e.fechaCobro).filter(Boolean).sort().pop() || ''
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🏦 EL EXCEL DE EMISIÓN — formato del banco (`Plantilla_Emision250.xlsx`, hoja «Plantilla para emision»)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * La cláusula del echeq, con la explicación para elegir (pedido del usuario: *«opciones para elegir
 * con la explicación de qué es cada cosa»*). Texto del banco en `valor`.
 */
export const CLAUSULAS = [
  { valor: 'A la orden', explicacion: 'El proveedor puede ENDOSARLO: pagar con este echeq a un tercero, como si fuera plata.' },
  { valor: 'No a la orden', explicacion: 'El proveedor NO puede endosarlo; sólo puede CEDERLO (un trámite formal). Más control sobre quién lo cobra.' },
] as const

/** Los motivos que acepta el banco. */
export const MOTIVOS_ECHEQ = ['Varios', 'Factura', 'Orden de pago', 'Alquiler', 'Expensas', 'Servicios'] as const

/** Motivo por default (usuario: *«si es pago de factura, Factura; si no es factura, Orden de pago»*). */
export const motivoPorDefecto = (esFactura: boolean) => (esFactura ? 'Factura' : 'Orden de pago')

export const ENCABEZADO_EMISION = ['Tipo de documento', 'Nro. de documento', 'Monto', 'Fecha de pago', 'Motivo de pago', 'Descripcion 1', 'Descripcion 2', 'Mail', 'Clausula', 'Nro de cheque']

export interface EcheqAEmitir {
  cuit: string
  monto: number
  /** AAAA-MM-DD */
  fechaCobro: string
  motivo: string
  descripcion1?: string
  descripcion2?: string
  mail?: string
  clausula: string
  numero?: string
}

/**
 * Las filas del Excel y los problemas que harían que el banco lo rechace. Reglas de la hoja
 * «Instrucciones»: CUIT de 11 dígitos sin separadores; monto > 0; fecha DD/MM/AAAA como TEXTO;
 * descripción 1 ≤ 100 y 2 ≤ 50 (si va una, van las dos); un solo mail; cláusula y motivo de la lista;
 * nro de cheque opcional, hasta 8 dígitos; máximo 250 filas.
 */
export function filasEmision(echeqs: EcheqAEmitir[]): { filas: (string | number)[][]; problemas: string[] } {
  const problemas: string[] = []
  if (echeqs.length > MAX_ECHEQS_POR_ARCHIVO) problemas.push(`Son ${echeqs.length} echeqs: el banco acepta hasta ${MAX_ECHEQS_POR_ARCHIVO} por archivo`)
  const filas = echeqs.map((e, i) => {
    const n = `Echeq ${i + 1}`
    const cuit = String(e.cuit || '').replace(/\D/g, '')
    if (cuit.length !== 11) problemas.push(`${n}: el CUIT del beneficiario tiene que tener 11 dígitos (tiene ${cuit.length})`)
    if (!(e.monto > 0)) problemas.push(`${n}: el monto tiene que ser mayor a cero`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.fechaCobro || '')) problemas.push(`${n}: falta la fecha de pago`)
    if (!(MOTIVOS_ECHEQ as readonly string[]).includes(e.motivo)) problemas.push(`${n}: motivo «${e.motivo}» no es de la lista del banco`)
    if (!CLAUSULAS.some(c => c.valor === e.clausula)) problemas.push(`${n}: cláusula «${e.clausula}» no es de la lista del banco`)
    let d1 = (e.descripcion1 || '').trim().slice(0, 100)
    let d2 = (e.descripcion2 || '').trim().slice(0, 50)
    // El banco exige las dos o ninguna: si hay una sola, la otra repite un texto mínimo.
    if (d1 && !d2) d2 = d1.slice(0, 50)
    if (d2 && !d1) d1 = d2
    const mail = (e.mail || '').split(/[;,\s]+/).filter(Boolean)[0] || ''
    if (mail && (mail.length < 6 || mail.length > 100)) problemas.push(`${n}: el mail tiene que tener entre 6 y 100 caracteres`)
    const numero = String(e.numero || '').replace(/\D/g, '')
    if (numero.length > 8) problemas.push(`${n}: el número de cheque tiene hasta 8 dígitos`)
    const [a, m, d] = (e.fechaCobro || '').split('-')
    return ['CUIT', cuit ? Number(cuit) : '', r2(e.monto), d ? `${d}/${m}/${a}` : '', e.motivo, d1, d2, mail, e.clausula, numero]
  })
  return { filas: [ENCABEZADO_EMISION, ...filas], problemas }
}

/** Nombre del archivo: `Galicia MSA Echeqs 20261014.xlsx` (mismo criterio que el lote de transferencias). */
export const nombreArchivoEmision = (empresa: string, fechaISO: string) =>
  `Galicia ${empresa} Echeqs ${fechaISO.replace(/-/g, '')}.xlsx`

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🧭 Qué hace la barra de PAGOS con cada fila al elegir ECHEQ — A-BUG-1283 (2026-10-14)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Antes todo lo que no era factura de MSA pendiente pasaba a «echeq» directo, sin modal ni cheque —
 * un ANTICIPO incluido (usuario: *«simplemente lo pasa, no me da ningún modal»*). Ahora:
 *   · un anticipo SOLO → abre el modal (de a uno: cada uno tiene su retención y sus echeqs);
 *   · anticipos junto con otras cosas, o varios → no se tocan, y se avisa;
 *   · facturas de MSA no en echeq → modal; ya en echeq → no se tocan, y se avisa;
 *   · facturas de PAM/MA → no se tocan (echeq es sólo MSA);
 *   · templates → se marcan como antes, avisando que sin cheque (falta A-FEAT-1282 para templates).
 */
export function clasificarLoteEcheq<T extends { id: string; origen: string; estado: string }>(filas: T[], esMsa: (f: T) => boolean) {
  const facturasPamMa = filas.filter(f => f.origen === 'ARCA' && !esMsa(f))
  const facturasModal = filas.filter(f => f.origen === 'ARCA' && f.estado !== 'echeq' && esMsa(f))
  const facturasYaEnEcheq = filas.filter(f => f.origen === 'ARCA' && f.estado === 'echeq' && esMsa(f))
  const anticipos = filas.filter(f => f.origen === 'ANTICIPO')
  const templates = filas.filter(f => f.origen === 'TEMPLATE')
  const abrirAnticipo = anticipos.length === 1 && facturasModal.length === 0 ? anticipos[0] : null
  return { facturasPamMa, facturasModal, facturasYaEnEcheq, anticiposSinTocar: abrirAnticipo ? [] : anticipos, abrirAnticipo, templates }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 📅 Plazo en DÍAS como alternativa a la fecha — pedido del usuario 2026-10-14
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * La fecha de cobro a N días de la emisión (*«agregame ponerle el plazo en días como opción a poner la
 * fecha manualmente»*). Se cuenta en días de calendario y se calcula en UTC sobre la fecha pelada,
 * para que el huso horario no la corra un día (§ 🕐 de CLAUDE.md: es un DÍA, no un instante).
 */
export function fechaMasDias(fechaISO: string, dias: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO || '') || !Number.isFinite(dias)) return ''
  const [a, m, d] = fechaISO.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + Math.trunc(dias))).toISOString().slice(0, 10)
}

// La cuenta inversa (los días entre emisión y cobro) NO se repite acá: es `diasEntre` de
// `lib/templates/editar-campana.ts`, que ya la hace en UTC.
