/**
 * 🔁 LOS PASES ENTRE CAJAS — cada salida con su entrada (A-FEAT-1585, pieza 5: el control). Lógica pura, sin base.
 *
 * El circuito (JMS 15/11): la extracción del banco va SIEMPRE primero a la Caja General, y de ahí a la Caja AMS o a la Caja Sigot.
 * Cada pase deja dos puntas. Hoy no están atadas (eso necesita un cambio de estructura que se avisa antes); este control las UNE
 * por importe y fecha y lista las que no tienen pareja, con su ficha. Avisa, no frena: un pase puede tardar días.
 *
 * - **Banco → caja**: un débito del Galicia que es una extracción ↔ una entrada de una caja «Pase desde el banco».
 *   El cajero tiene tope: una entrada a la caja puede ser la suma de 2 o 3 extracciones de días seguidos.
 * - **Caja → caja**: una salida «Pase a otra caja» ↔ una entrada «Pase desde otra caja» de OTRA caja (si el texto dice a cuál,
 *   sólo esa: «a caja AMS», «a Sigot»).
 */
import type { TablaCaja } from "./caja-excel"

export type CuentaPase = "banco" | TablaCaja
export interface MovPase {
  id: string
  cuenta: CuentaPase
  fecha: string
  /** Lo que se lee: el detalle (texto de AMS o tuyo) y, si no hay, la descripción. */
  texto: string
  descripcion: string
  debitos: number
  creditos: number
  /** Sólo del banco: cómo quedó conciliada la extracción. Si va a un gasto (no a CAJA), el efectivo fue directo a pagar algo. */
  categ?: string | null
  estado?: string | null
}
export type TipoPase = "banco→caja" | "caja→caja"
export interface ParPase { tipo: TipoPase; sale: MovPase[]; entra: MovPase; dias: number; /** Del banco directo a AMS o Sigot, sin pasar por la General. */ directo?: boolean }
export interface ResumenTipo { tipo: TipoPase; pares: number; importe: number; salenSinPar: number; importeSalen: number; entranSinPar: number; importeEntran: number }
export interface ControlPases { pares: ParPase[]; salenSinPar: (MovPase & { tipo: TipoPase })[]; entranSinPar: (MovPase & { tipo: TipoPase })[]; resumen: ResumenTipo[]
  /** Extracciones que no entraron a ninguna caja pero ya están conciliadas a un pago (24/04/26: $ 1 M en efectivo a Penino, FC 223 de MA): tienen destino, no son «sin pareja». */
  aUnPago: MovPase[] }

const r2 = (x: number) => Math.round(x * 100) / 100
const dias = (a: string, b: string) => Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 864e5)
const t = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Un débito del banco que es plata que salió en efectivo (no la comisión ni el impuesto de la extracción). */
export function esExtraccionDelBanco(descripcion: string, categ: string | null | undefined): boolean {
  const d = t(descripcion)
  if (/comision|impuesto|imp\.|iva|percep/.test(d)) return false
  return /^extracc/.test(d) || t(categ ?? "") === "caja"
}
/** Las cajas que nombra un texto («Caja gral a caja Sigot» nombra las dos; «(da andres)» es quién la llevó, no la caja AMS). */
export function cajasQueNombra(texto: string): Set<TablaCaja> {
  const x = t(texto).replace(/\((da|de|orden)[^)]*\)/g, " ")
  const out = new Set<TablaCaja>()
  if (/sigot/.test(x)) out.add("caja_sigot")
  if (/caja ams|caja andres|\bams\b/.test(x)) out.add("caja_ams")
  if (/gral|general/.test(x)) out.add("caja_general")
  return out
}

/** Una extracción ya conciliada a un gasto (categoría que no es CAJA): el efectivo fue a pagar algo, no a una caja. */
export function esExtraccionAUnPago(m: Pick<MovPase, "categ" | "estado">): boolean {
  const c = t(m.categ ?? "").trim()
  return t(m.estado ?? "") === "conciliado" && !!c && c !== "caja"
}

export function controlarPases(movs: MovPase[], tolerancia = 7): ControlPases {
  const usados = new Set<string>()
  const pares: ParPase[] = []
  const salidasBanco = movs.filter(m => m.cuenta === "banco" && m.debitos > 0)
  const entradasDesdeBanco = movs.filter(m => m.cuenta !== "banco" && m.creditos > 0 && /desde el banco/i.test(m.descripcion))
  const salidasCaja = movs.filter(m => m.cuenta !== "banco" && m.debitos > 0 && /a otra caja/i.test(m.descripcion))
  const entradasCaja = movs.filter(m => m.cuenta !== "banco" && m.creditos > 0 && /desde otra caja/i.test(m.descripcion))

  // 1 · uno a uno, el más cercano en fecha primero
  const unir = (tipo: TipoPase, salen: MovPase[], entran: MovPase[], compatible: (s: MovPase, e: MovPase) => boolean) => {
    const cand: { s: MovPase; e: MovPase; d: number }[] = []
    for (const s of salen) for (const e of entran) {
      if (Math.abs(s.debitos - e.creditos) > 0.01 || !compatible(s, e)) continue
      const d = dias(s.fecha, e.fecha); if (d <= tolerancia) cand.push({ s, e, d })
    }
    cand.sort((a, b) => a.d - b.d || a.s.fecha.localeCompare(b.s.fecha))
    for (const c of cand) if (!usados.has(c.s.id) && !usados.has(c.e.id)) { usados.add(c.s.id); usados.add(c.e.id); pares.push({ tipo, sale: [c.s], entra: c.e, dias: c.d }) }
  }
  unir("banco→caja", salidasBanco, entradasDesdeBanco, () => true)
  unir("caja→caja", salidasCaja, entradasCaja, (s, e) => {
    if (s.cuenta === e.cuenta) return false
    // la salida dice a dónde va; la entrada, de dónde viene (sin contarse a sí misma)
    const destino = [...cajasQueNombra(s.texto)].filter(c => c !== s.cuenta), origen = [...cajasQueNombra(e.texto)].filter(c => c !== e.cuenta)
    return (!destino.length || destino.includes(e.cuenta as TablaCaja)) && (!origen.length || origen.includes(s.cuenta as TablaCaja))
  })
  // 2 · banco → caja partido (el cajero tiene tope): una entrada = 2 o 3 extracciones de días cercanos …
  const sumaDe = <T,>(libres: T[], valor: (x: T) => number, objetivo: number): T[] | null => {
    for (let i = 0; i < libres.length; i++) for (let j = i + 1; j < libres.length; j++) {
      if (Math.abs(valor(libres[i]) + valor(libres[j]) - objetivo) < 0.01) return [libres[i], libres[j]]
      for (let k = j + 1; k < libres.length; k++) if (Math.abs(valor(libres[i]) + valor(libres[j]) + valor(libres[k]) - objetivo) < 0.01) return [libres[i], libres[j], libres[k]]
    }
    return null
  }
  const VENTANA_PARTIDO = 5
  for (const e of entradasDesdeBanco.filter(e => !usados.has(e.id))) {
    const hallado = sumaDe(salidasBanco.filter(s => !usados.has(s.id) && dias(s.fecha, e.fecha) <= VENTANA_PARTIDO && s.debitos < e.creditos), s => s.debitos, e.creditos)
    if (hallado) { hallado.forEach(s => usados.add(s.id)); usados.add(e.id); pares.push({ tipo: "banco→caja", sale: hallado, entra: e, dias: Math.max(...hallado.map(s => dias(s.fecha, e.fecha))) }) }
  }
  // … o al revés: una extracción que entra a la caja en 2 o 3 partes (p. ej. 15/05/26: $ 900.000 = 500.000 + 400.000)
  for (const s of salidasBanco.filter(s => !usados.has(s.id))) {
    const partes = sumaDe(entradasDesdeBanco.filter(e => !usados.has(e.id) && dias(s.fecha, e.fecha) <= VENTANA_PARTIDO && e.creditos < s.debitos), e => e.creditos, s.debitos)
    if (partes) { usados.add(s.id); partes.forEach(e => { usados.add(e.id); pares.push({ tipo: "banco→caja", sale: [s], entra: e, dias: dias(s.fecha, e.fecha) }) }) }
  }
  // 3 · la extracción que fue DIRECTO a AMS o Sigot sin pasar por la General (21/02/26: «orden extracción josé» $ 1.020.000):
  //     se une igual, marcada, porque rompe el circuito acordado (P4: siempre primero a la General)
  const directas = entradasCaja.filter(e => !usados.has(e.id) && /extracc/i.test(e.texto))
  const cand3: { s: MovPase; e: MovPase; d: number }[] = []
  for (const e of directas) for (const s of salidasBanco) {
    if (usados.has(s.id) || Math.abs(s.debitos - e.creditos) > 0.01) continue
    const d = dias(s.fecha, e.fecha); if (d <= tolerancia) cand3.push({ s, e, d })
  }
  cand3.sort((a, b) => a.d - b.d)
  for (const c of cand3) if (!usados.has(c.s.id) && !usados.has(c.e.id)) { usados.add(c.s.id); usados.add(c.e.id); pares.push({ tipo: "banco→caja", sale: [c.s], entra: c.e, dias: c.d, directo: true }) }

  // 4 · la extracción que no entró a ninguna caja pero ya está conciliada a un gasto: fue directo a pagar algo (JMS 15/11, Penino)
  const aUnPago = salidasBanco.filter(s => !usados.has(s.id) && esExtraccionAUnPago(s))
  aUnPago.forEach(s => usados.add(s.id))

  const sin = (xs: MovPase[], tipo: TipoPase) => xs.filter(m => !usados.has(m.id)).map(m => ({ ...m, tipo }))
  const salenSinPar = [...sin(salidasBanco, "banco→caja"), ...sin(salidasCaja, "caja→caja")].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const entranSinPar = [...sin(entradasDesdeBanco, "banco→caja"), ...sin(entradasCaja, "caja→caja")].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const resumen = (["banco→caja", "caja→caja"] as TipoPase[]).map(tipo => {
    const p = pares.filter(x => x.tipo === tipo), s = salenSinPar.filter(x => x.tipo === tipo), e = entranSinPar.filter(x => x.tipo === tipo)
    return { tipo, pares: p.length, importe: r2(p.reduce((a, x) => a + x.entra.creditos, 0)), salenSinPar: s.length, importeSalen: r2(s.reduce((a, x) => a + x.debitos, 0)),
      entranSinPar: e.length, importeEntran: r2(e.reduce((a, x) => a + x.creditos, 0)) }
  })
  return { pares, salenSinPar, entranSinPar, resumen, aUnPago }
}
