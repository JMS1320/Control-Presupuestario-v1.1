// El costo de alimentación MEDIDO, listo para el margen de cada actividad.
//
// ── Qué junta ────────────────────────────────────────────────────────────────
// Es el último eslabón de la cadena. Cada pieza ya existe y está verificada:
//
//   mediciones + entregas  →  consumo.ts   →  cuánto se consumió y a qué precio, por tramo
//   lotes + mortandades    →  rodeo.ts     →  cuánto animal-kilo hubo cada día
//                             ↓
//                        ACÁ: quién paga cuánto, por actividad y por campaña
//
// ── Lo que NO hace ───────────────────────────────────────────────────────────
// No estima nada. Si no hay medición, devuelve vacío y el margen sigue diciendo que falta —
// que es mejor que un número inventado con cara de exacto.

import {
  calcularConsumo, type Medicion, type Entrega, type ConsumoDeclarado, type GrupoConsumidor,
} from './consumo'

/** Un insumo con todo lo suyo, ya leído de la base. */
export interface InsumoConDatos {
  id: string
  producto: string
  unidad: string | null
  mediciones: Medicion[]
  entregas: Entrega[]
  declaraciones: ConsumoDeclarado[]
}

export interface CostoAlimentacion {
  actividad: string
  producto: string
  /** Cantidad física imputada a esa actividad en la campaña. */
  cantidad: number
  unidad: string | null
  /** `null` si a algún tramo le falta el precio. Nunca cero. */
  monto: number | null
  /**
   * Cómo se llegó al número, tramo por tramo. Es lo que se despliega en la fila del margen.
   *
   * Va estructurado y no como texto ya armado: el que muestra necesita el monto para poder
   * acumular, y sacarlo de vuelta del string formateado es la clase de cosa que se rompe en
   * silencio el día que cambia el formato.
   */
  detalle: { texto: string; monto: number | null }[]
  /** Lo que impide confiar en el número. */
  faltantes: string[]
}

const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
const dmy = (f: string) => f.split('-').reverse().join('/')

/**
 * Reparte el consumo medido de cada insumo entre las actividades, por campaña.
 *
 * `actividadDe(grupoId)` dice a qué actividad pertenece cada grupo del rodeo — para los lotes
 * sale de la categoría, y para las declaraciones ya viene la actividad puesta.
 *
 * `campanaDe(fecha)` decide en qué campaña cae cada tramo. Se pasa como función para no
 * duplicar la regla de julio-a-junio, que ya vive en `lib/presupuesto/margen.ts`.
 *
 * ⚠️ **Un tramo cae entero en la campaña de su fecha de INICIO.** Partirlo por mes sería más
 * fino, pero el consumo se midió sobre el tramo completo: repartirlo por días inventaría una
 * precisión que la medición no tiene.
 */
export function costoAlimentacion(
  insumos: InsumoConDatos[],
  gruposDe: (desde: string, hasta: string) => GrupoConsumidor[],
  actividadDe: (grupoId: string) => string | null,
  campanaDe: (fecha: string) => string | null,
  campana: string,
): CostoAlimentacion[] {
  const acc = new Map<string, CostoAlimentacion>()

  for (const ins of insumos) {
    const r = calcularConsumo(ins.mediciones, ins.entregas, gruposDe, ins.declaraciones)

    for (const t of r.tramos) {
      if (campanaDe(t.desde) !== campana) continue

      for (const g of t.reparto) {
        const act = actividadDe(g.grupoId)
        if (!act || g.cantidad <= 0) continue
        const k = `${act}|${ins.producto}`
        const prev = acc.get(k) ?? {
          actividad: act, producto: ins.producto, cantidad: 0, unidad: ins.unidad,
          monto: 0, detalle: [], faltantes: [],
        }
        prev.cantidad += g.cantidad
        // Un solo tramo sin precio deja el total en `null`: no se suma "lo que se pudo".
        prev.monto = prev.monto == null || g.costo == null ? null : prev.monto + g.costo
        prev.detalle.push({
          texto: `${dmy(t.desde)}→${dmy(t.hasta)} · ${g.nombre}: ${num(g.cantidad)} ${ins.unidad ?? ''}`
            + (g.costo == null ? ' — sin precio' : ` = ${pesos(g.costo)}`),
          monto: g.costo,
        })
        acc.set(k, prev)
      }

      for (const f of t.faltantes) {
        // El faltante viaja a TODAS las actividades del tramo: cualquiera de ellas está
        // mirando un número incompleto, no sólo la que tuvo el problema.
        for (const g of t.reparto) {
          const act = actividadDe(g.grupoId)
          if (!act) continue
          const k = `${act}|${ins.producto}`
          const e = acc.get(k)
          if (e && !e.faltantes.includes(f)) e.faltantes.push(`${ins.producto}: ${f}`)
        }
      }
    }
  }

  return Array.from(acc.values()).sort((a, b) =>
    a.actividad.localeCompare(b.actividad) || a.producto.localeCompare(b.producto))
}

/**
 * ¿Este costo de la actividad se corresponde con ese producto del stock?
 *
 * El vínculo bueno es `actividad_insumos.producto`, que existe justamente para esto. Cuando
 * está vacío se cae al nombre del concepto, que en la práctica coincide ("Maíz" con "Maíz") —
 * pero es un match por texto y por eso el que manda es el campo explícito.
 */
export function mismoInsumo(
  costo: { concepto: string; producto?: string | null }, producto: string,
): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  return norm(costo.producto || costo.concepto) === norm(producto)
}

// ── Por GRUPO, no por actividad ──────────────────────────────────────────────
//
// El corte por actividad contesta *"¿cuánto le costó la comida a recría?"*. Éste contesta
// *"¿cuánto le costó a los 55 que vendimos?"* — que es la pregunta del margen por grupo y,
// además, la que hace falta para **activar**: los costos de lo que todavía no se vendió no son
// gasto del período, son mayor valor del animal.

export interface CostoGrupoTramo {
  grupoId: string
  grupo: string
  producto: string
  desde: string
  hasta: string
  cantidad: number
  costo: number | null
}

/**
 * El costo de cada grupo, tramo por tramo, **sin filtrar por campaña**.
 *
 * Se devuelve crudo a propósito: el que llama lo agrega como necesita —por campaña para el
 * gasto, acumulado hasta una fecha para la existencia—. Filtrar acá obligaría a llamar dos
 * veces con criterios distintos, que es como se terminan teniendo dos números.
 */
export function costoPorGrupo(
  insumos: InsumoConDatos[],
  gruposDe: (desde: string, hasta: string) => GrupoConsumidor[],
): CostoGrupoTramo[] {
  const out: CostoGrupoTramo[] = []
  for (const ins of insumos) {
    const r = calcularConsumo(ins.mediciones, ins.entregas, gruposDe, ins.declaraciones)
    for (const t of r.tramos) {
      for (const g of t.reparto) {
        if (g.cantidad <= 0) continue
        out.push({
          grupoId: g.grupoId, grupo: g.nombre, producto: ins.producto,
          desde: t.desde, hasta: t.hasta, cantidad: g.cantidad, costo: g.costo,
        })
      }
    }
  }
  return out
}

/**
 * Lo acumulado por un grupo **hasta** una fecha. Es el ladrillo de la activación.
 *
 * ⚠️ Un tramo cuenta entero si **empezó** antes del corte. Prorratear por días le daría al
 * número una precisión que la medición no tiene: el consumo se midió sobre el tramo completo.
 */
export function acumuladoHasta(
  filas: CostoGrupoTramo[], grupoId: string, hasta: string,
): { costo: number | null; cantidad: number } {
  let costo: number | null = 0
  let cantidad = 0
  for (const f of filas) {
    if (f.grupoId !== grupoId || f.desde >= hasta) continue
    cantidad += f.cantidad
    costo = costo == null || f.costo == null ? null : costo + f.costo
  }
  return { costo, cantidad }
}
