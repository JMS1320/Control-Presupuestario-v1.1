/**
 * 🏛️ EL PAPEL DEL INMOBILIARIO, RED VIAL Y AUTOMOTORES — A-FEAT-1320 punto (5), con A-FEAT-1201.
 *
 * El formato es el de la planilla del usuario (`- INMOBILIARIO RED VIAL AUTOMOTOR 2026 - v2.xlsx`):
 * por empresa, una fila por campo (partida) con el total del año anterior, el pago anual, el total
 * en cuotas, el % de aumento, cada cuota con su vencimiento y, a la derecha, el costo anual en $ y en
 * U$S; abajo el complementario y los totales de la empresa y general.
 *
 * 🗄️ **De dónde sale hoy**: de los templates y sus cuotas (el template ya guarda la partida en
 * `partida_arba`, y el campo en el nombre). Las **hectáreas** no las tiene el template: viven en el
 * maestro de partidas (`public.partidas`, A-DEC-36), que se carga con `scripts/96` desde la planilla del
 * usuario (⚠️ cambió 2026-10-23: antes estaba vacío y las columnas por hectárea salían en blanco). El
 * template de inmobiliario se cruza por partida; el de Red Vial, que no la tiene, por el nombre del campo. Cuando entren las boletas de ARBA
 * (A-FEAT-1204) llegarán también valuación y base imponible.
 *
 * 🧮 **Control**: el total del papel tiene que ser igual a la suma de esas mismas filas en la Planilla
 * de impuestos (mismo criterio de qué cuota entra: `estadoDePlanilla` y templates dados de baja).
 */
import { esImpuesto } from "./vencimientos"
import { estadoDePlanilla, type CuotaPlanilla } from "./planilla"
import { resolverTC, type TipoCambio } from "@/lib/arrendamientos/calculo"
import { ordenarColumnas, moverColumna } from "@/lib/cashflow/columnas-usuario"

export type TipoPapel = "inmobiliario" | "red-vial" | "automotores"

export const TITULO_PAPEL: Record<TipoPapel, string> = {
  inmobiliario: "Inmobiliario (con complementario)",
  "red-vial": "Red Vial",
  automotores: "Automotores",
}

/** ¿A qué papel va este template? `null` = a ninguno. */
export function papelDeTemplate(categ: string | null | undefined): { papel: TipoPapel; complementario: boolean } | null {
  const c = categ ?? ""
  if (/complementario/i.test(c)) return { papel: "inmobiliario", complementario: true }
  if (/inmobiliario/i.test(c)) return { papel: "inmobiliario", complementario: false }
  if (/red\s*vial/i.test(c)) return { papel: "red-vial", complementario: false }
  if (/automotor/i.test(c)) return { papel: "automotores", complementario: false }
  return null
}

/** «Inmobiliario Cuota Tango Parra 1» → «Tango Parra 1» · «Red Vial Lima Cuota» → «Lima» · «Imp Automotores Gol 2012 Anual» → «Gol 2012». */
export function campoDeTemplate(nombre: string | null | undefined): string {
  return (nombre ?? "")
    .replace(/^\s*(imp(uesto)?\.?\s+)?(inmobiliario\s+complementario|inmobiliario|red\s*vial|automotores)\s*/i, "")
    .replace(/\b(cuota|anual)\b/gi, " ")
    .replace(/\s+/g, " ").trim() || (nombre ?? "—")
}

const esAnual = (nombre: string | null | undefined) => /\banual\b/i.test(nombre ?? "")

export interface CuotaDelPapel { vencimiento: string; monto: number; estado: string }

export interface FilaPapel {
  campo: string
  partida: string | null
  complementario: boolean
  /** Hectáreas: del maestro de partidas. Vacío hasta que se cargue. */
  has: number | null
  totalAnterior: number
  /**
   * El año anterior tiene MENOS cuotas en la app que este año (el histórico arranca en jul-2025):
   * comparar daría un aumento falso, así que no se calcula y se dice.
   */
  anteriorIncompleto: boolean
  pagoAnual: number | null
  totalCuotas: number
  /** Lo que cuesta en el año: lo que entró de verdad (cuotas del año, o el pago anual si se eligió). */
  costoAnual: number
  aumento: number | null
  cuotas: CuotaDelPapel[]
  costoUsd: number | null
  costoHa: number | null
  costoHaUsd: number | null
}

export interface BloquePapel { empresa: string; filas: FilaPapel[]; total: number; totalAnterior: number; totalUsd: number | null }

export interface Papel {
  tipo: TipoPapel
  anio: number
  bloques: BloquePapel[]
  total: number
  totalAnterior: number
  /** TC promedio de los meses en que vencen las cuotas del año (de la tabla de tipos de cambio). */
  tcPromedio: number | null
  maxCuotas: number
  faltaHas: boolean
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** ¿La cuota entra al papel? El mismo criterio que la Planilla (para que el control cierre). */
function entra(c: CuotaPlanilla): string | null {
  if (!esImpuesto(c.template)) return null
  const e = estadoDePlanilla(c.estado)
  if (!e) return null
  if (e === "sin-pagar" && c.template.activo === false) return null
  const venc = (c.fecha_vencimiento ?? c.fecha_estimada ?? "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(venc) ? venc : null
}

export function armarPapel(
  tipo: TipoPapel,
  cuotas: Array<CuotaPlanilla & { template: CuotaPlanilla["template"] & { partida_arba?: string | null } }>,
  anio: number,
  tcs: TipoCambio[] = [],
  /** Hectáreas por número de partida o por `campo:<nombre en minúsculas>` (ver `hectareasDe`). */
  hectareas: Record<string, number> = {},
  /**
   * Red Vial: el número con el que identifica la MUNICIPALIDAD (la «cuenta» de su planilla), por
   * `campo:<nombre>`. Los templates de Red Vial no guardan partida; ésta es la que se muestra.
   */
  cuentasRedVial: Record<string, string> = {},
): Papel {
  type Acum = { empresa: string; campo: string; complementario: boolean; partida: string | null; anterior: number; nAnterior: number; anual: number | null; enCuotas: number; cuotas: CuotaDelPapel[] }
  const filas = new Map<string, Acum>()
  const mesesDelAnio: Array<{ anio: number; mes: number }> = []

  for (const c of cuotas) {
    const p = papelDeTemplate(c.template.categ)
    if (!p || p.papel !== tipo) continue
    const venc = entra(c)
    if (!venc) continue
    const a = Number(venc.slice(0, 4))
    if (a !== anio && a !== anio - 1) continue
    const empresa = c.template.responsable ?? "—"
    const campo = p.complementario ? "Complementario" : campoDeTemplate(c.template.nombre_referencia)
    const clave = `${empresa}|${p.complementario ? "~comp" : campo.toLowerCase()}`
    const f = filas.get(clave) ?? { empresa, campo, complementario: p.complementario, partida: null, anterior: 0, nAnterior: 0, anual: null, enCuotas: 0, cuotas: [] }
    f.partida = f.partida ?? c.template.partida_arba ?? null
    const monto = Number(c.monto ?? 0)
    if (a === anio - 1) { f.anterior += monto; f.nAnterior++ }
    else if (esAnual(c.template.nombre_referencia)) { f.anual = (f.anual ?? 0) + monto; mesesDelAnio.push({ anio: a, mes: Number(venc.slice(5, 7)) }) }
    else { f.enCuotas += monto; f.cuotas.push({ vencimiento: venc, monto, estado: c.estado }); mesesDelAnio.push({ anio: a, mes: Number(venc.slice(5, 7)) }) }
    filas.set(clave, f)
  }

  const tcsMeses = mesesDelAnio.map(m => resolverTC(tcs, m.anio, m.mes).tc).filter(t => t > 0)
  const tcPromedio = tcsMeses.length ? redondear(tcsMeses.reduce((s, t) => s + t, 0) / tcsMeses.length) : null

  const porEmpresa = new Map<string, FilaPapel[]>()
  for (const f of filas.values()) {
    const costoAnual = redondear(f.enCuotas + (f.anual ?? 0))
    if (costoAnual === 0 && f.anterior === 0) continue
    const has = (f.partida && hectareas[f.partida]) || hectareas[`campo:${f.campo.toLowerCase()}`] || null
    const costoUsd = tcPromedio ? redondear(costoAnual / tcPromedio) : null
    const nActual = f.cuotas.length + (f.anual !== null ? 1 : 0)
    // Un pago anual del año anterior vale por todas sus cuotas: sólo es incompleto si había cuotas sueltas de menos.
    const anteriorIncompleto = f.nAnterior > 0 && f.nAnterior < nActual && !(f.nAnterior === 1 && nActual > 1 && f.anterior >= costoAnual * 0.5)
    const partida = tipo === "red-vial" && !f.complementario ? (cuentasRedVial[`campo:${f.campo.toLowerCase()}`] ?? f.partida) : f.partida
    const fila: FilaPapel = {
      campo: f.campo, partida, complementario: f.complementario, has,
      totalAnterior: redondear(f.anterior), pagoAnual: f.anual === null ? null : redondear(f.anual), totalCuotas: redondear(f.enCuotas),
      anteriorIncompleto, costoAnual, aumento: f.anterior > 0 && !anteriorIncompleto ? costoAnual / f.anterior - 1 : null,
      cuotas: f.cuotas.sort((x, y) => x.vencimiento.localeCompare(y.vencimiento)),
      costoUsd, costoHa: has ? redondear(costoAnual / has) : null, costoHaUsd: has && costoUsd ? redondear(costoUsd / has) : null,
    }
    porEmpresa.set(f.empresa, [...(porEmpresa.get(f.empresa) ?? []), fila])
  }

  const bloques: BloquePapel[] = [...porEmpresa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([empresa, fs]) => {
    // Las partidas por nombre de campo; el complementario al final, como en la planilla.
    fs.sort((x, y) => Number(x.complementario) - Number(y.complementario) || x.campo.localeCompare(y.campo))
    const total = redondear(fs.reduce((s, f) => s + f.costoAnual, 0))
    return { empresa, filas: fs, total, totalAnterior: redondear(fs.reduce((s, f) => s + f.totalAnterior, 0)), totalUsd: tcPromedio ? redondear(total / tcPromedio) : null }
  })

  return {
    tipo, anio, bloques,
    total: redondear(bloques.reduce((s, b) => s + b.total, 0)),
    totalAnterior: redondear(bloques.reduce((s, b) => s + b.totalAnterior, 0)),
    tcPromedio,
    maxCuotas: Math.max(0, ...bloques.flatMap(b => b.filas.map(f => f.cuotas.length))),
    faltaHas: bloques.some(b => b.filas.some(f => !f.complementario && f.has == null)),
  }
}

/**
 * Red Vial se identifica en la municipalidad con su propio número (la «cuenta»: Tango Parra 1 → 52948),
 * no con la partida inmobiliaria — aclaración del usuario 2026-10-23. Vive en `partidas.partida_red_vial`.
 */
export function cuentasRedVialDe(partidas: Array<{ campo?: string | null; partida_red_vial?: string | null }>): Record<string, string> {
  const r: Record<string, string> = {}
  for (const p of partidas) if (p.campo && p.partida_red_vial) r[`campo:${p.campo.toLowerCase()}`] = p.partida_red_vial
  return r
}

/**
 * Las hectáreas de cada partida, de los dos maestros que existen (A-DEC-36 `partidas` por número de
 * partida, y `campo_partidas` por nombre de partida). ⚠️ cambió 2026-10-23: `partidas` estaba VACÍO (no
 * «con filas sin hectáreas») y lo llena `scripts/96`; `campo_partidas` sigue sin hectáreas.
 */
export function hectareasDe(
  partidas: Array<{ campo?: string | null; partida_inmobiliario?: string | null; partida_red_vial?: string | null; has_totales?: number | null; has_productivas?: number | null }>,
  campoPartidas: Array<{ nombre_partida?: string | null; nro_partida?: string | null; has?: number | null }>,
): Record<string, number> {
  const r: Record<string, number> = {}
  for (const c of campoPartidas) {
    const h = Number(c.has ?? 0)
    if (h > 0) { if (c.nro_partida) r[c.nro_partida] = h; if (c.nombre_partida) r[`campo:${c.nombre_partida.toLowerCase()}`] = h }
  }
  // El maestro de partidas manda sobre el de campos: es el que va a llenar el circuito de boletas.
  for (const p of partidas) {
    const h = Number(p.has_totales ?? p.has_productivas ?? 0)
    if (h > 0) {
      if (p.partida_inmobiliario) r[p.partida_inmobiliario] = h
      if (p.partida_red_vial) r[p.partida_red_vial] = h
      // Por nombre también: los templates de Red Vial no tienen partida, y se encuentran por el campo.
      if (p.campo) r[`campo:${p.campo.toLowerCase()}`] = h
    }
  }
  return r
}

/**
 * ↕️ El orden de las partidas que deja el usuario arrastrándolas (usuario 2026-10-24: *«que se puedan
 * reorganizar las filas como el general… el orden que pongo en inmo o red se aplica para los dos ya que
 * son las mismas partidas»*). Por eso la clave es el CAMPO (no la partida, que en Red Vial es otro número)
 * y la lista es UNA para los dos papeles (`preferencias.ordenPartidas`). El complementario queda al final.
 */
export const clavePartida = (f: { campo: string }) => f.campo.trim().toLowerCase()

export function ordenarPapel(p: Papel, orden: readonly string[]): Papel {
  if (!orden.length) return p
  return {
    ...p,
    bloques: p.bloques.map(b => {
      const normales = ordenarColumnas(b.filas.filter(f => !f.complementario).map(f => ({ key: clavePartida(f), f })), orden).map(x => x.f)
      return { ...b, filas: [...normales, ...b.filas.filter(f => f.complementario)] }
    }),
  }
}

/**
 * Mueve `desde` antes de `hasta`. Parte de lo guardado y le suma lo que se ve y no estaba, para no
 * perder el lugar de las partidas que sólo están en el otro papel (o en otro año).
 */
export function moverPartida(orden: readonly string[], visibles: readonly string[], desde: string, hasta: string): string[] {
  const base = [...orden, ...visibles.filter(k => !orden.includes(k))]
  return moverColumna(base, desde, hasta, "antes")
}
