// Confirmar una venta de hacienda: de presupuestada a hecha.
//
// ── Un solo paso ─────────────────────────────────────────────────────────────
// Lo pidió así el usuario (2026-08-05): *"debe ser un solo paso para el usuario: confirmar todos
// los datos reales y decir cuáles son las caravanas"*. De ese único acto salen tres efectos:
//
//   · la venta comercial      → `stock_ventas`         → Cash Flow y Presupuesto
//   · la baja de stock        → `movimientos_hacienda` → planillas de hacienda
//   · las caravanas que se fueron → `terneros`         → el segmentador deja de contarlas
//
// ── Los kg NO se prorratean a los individuos ─────────────────────────────────
// La pesada de venta es **grupal**. Repartirla por animal exigiría asumir que todos ganaron lo
// mismo por día — que es justo lo que el segmentador existe para desmentir— y ese peso inventado
// entraría a `pesadas_terneros`, donde quedaría **indistinguible de uno medido**.
//
// Lo que sí sale del total, y es un dato real, es la **ganancia diaria del grupo** desde la última
// pesada. Medida, no supuesta.

import { normalizarCaravana } from '../productivo/caravanas'

/** Un animal candidato a matchear. */
export interface TerneroRef {
  id: string
  caravana_oficial: string | null
  caravana_interna: string | null
  sexo: string | null
  activo: boolean
}

export interface EntradaCaravana {
  /** Tal como lo escribió o pegó el usuario. */
  original: string
  /** Peso individual, si el archivo lo trae. Opcional. */
  peso?: number | null
}

export interface MatchCaravana {
  original: string
  peso?: number | null
  estado: 'ok' | 'no_encontrada' | 'duplicada' | 'ya_vendida'
  ternero?: TerneroRef
  candidatos?: TerneroRef[]
}

/**
 * IDV numérico → caravana oficial. `32010012326455` → `"032 010012326455"`.
 *
 * Misma conversión que el importador de pesadas: si diera distinto, el mismo animal se
 * encontraría al pesarlo y no al venderlo.
 */
export function idvACaravana(idv: unknown): string | null {
  if (idv === null || idv === undefined || idv === '') return null
  const digits = String(idv).replace(/\D/g, '')
  if (!digits || Number(digits) === 0) return null
  const padded = digits.padStart(15, '0')
  return `${padded.slice(0, 3)} ${padded.slice(3)}`
}

/**
 * Interpreta lo pegado desde Excel.
 *
 * Acepta una caravana por línea, y opcionalmente su peso separado por tab, `;` o coma. Las líneas
 * vacías se ignoran; los encabezados también, porque una línea sin dígitos no es una caravana.
 */
export function parsearPegado(texto: string): EntradaCaravana[] {
  const out: EntradaCaravana[] = []
  for (const linea of texto.split(/\r?\n/)) {
    const l = linea.trim()
    if (!l) continue
    const partes = l.split(/[\t;]|\s{2,}/).map(s => s.trim()).filter(Boolean)
    const cara = partes[0] ?? ''
    if (!/\d/.test(cara)) continue          // encabezado o texto suelto
    const pesoTxt = partes[1]
    const peso = pesoTxt ? parseFloat(pesoTxt.replace(/\./g, '').replace(',', '.')) : null
    out.push({ original: cara, peso: Number.isFinite(peso as number) ? peso : null })
  }
  return out
}

/**
 * Matchea las caravanas contra el rodeo.
 *
 * Prueba, en orden: el texto exacto contra `caravana_oficial` e `interna`, y después el IDV
 * convertido. Lo mismo que hace el importador de pesadas — un animal se identifica igual al
 * pesarlo que al venderlo.
 *
 * **Un animal ya dado de baja se marca aparte** (`ya_vendida`): venderlo dos veces es un error
 * distinto de no encontrarlo, y confundirlos haría que una doble venta pase por un típeo.
 */
export function matchearCaravanas(
  entradas: EntradaCaravana[],
  terneros: TerneroRef[],
): MatchCaravana[] {
  const porOficial = new Map<string, TerneroRef[]>()
  const porInterna = new Map<string, TerneroRef[]>()
  for (const t of terneros) {
    const o = normalizarCaravana(t.caravana_oficial)
    const i = normalizarCaravana(t.caravana_interna)
    if (o) (porOficial.get(o) ?? porOficial.set(o, []).get(o)!).push(t)
    if (i) (porInterna.get(i) ?? porInterna.set(i, []).get(i)!).push(t)
  }

  const buscar = (txt: string): TerneroRef[] => {
    const n = normalizarCaravana(txt)
    const directos = [...(porOficial.get(n) ?? []), ...(porInterna.get(n) ?? [])]
    if (directos.length > 0) return dedup(directos)
    const conv = idvACaravana(txt)
    return conv ? dedup(porOficial.get(normalizarCaravana(conv)) ?? []) : []
  }

  return entradas.map(e => {
    const c = buscar(e.original)
    if (c.length === 0) return { ...e, estado: 'no_encontrada' as const }
    if (c.length > 1) return { ...e, estado: 'duplicada' as const, candidatos: c }
    const t = c[0]!
    return t.activo
      ? { ...e, estado: 'ok' as const, ternero: t }
      : { ...e, estado: 'ya_vendida' as const, ternero: t }
  })
}

const dedup = (ts: TerneroRef[]) => {
  const v = new Set<string>()
  return ts.filter(t => (v.has(t.id) ? false : (v.add(t.id), true)))
}

/**
 * La ganancia diaria REAL del grupo, entre la última pesada y la venta.
 *
 * Es el único número honesto que sale de una pesada grupal: medido, del grupo, sin repartir.
 * Sirve para corregir la proyección de los lotes que quedan.
 *
 * Devuelve `null` cuando falta un dato — no cero.
 */
export function gananciaRealDelGrupo(
  kgVenta: number, cabezas: number,
  pesoPromUltimaPesada: number | null, fechaPesada: string | null, fechaVenta: string | null,
): { kgPorDia: number; dias: number; pesoVenta: number } | null {
  if (!kgVenta || !cabezas || pesoPromUltimaPesada == null || !fechaPesada || !fechaVenta) return null
  const d = Math.round(
    (new Date(fechaVenta + 'T00:00:00').getTime() - new Date(fechaPesada + 'T00:00:00').getTime())
    / 86400000)
  if (d <= 0) return null
  const pesoVenta = kgVenta / cabezas
  return { kgPorDia: (pesoVenta - pesoPromUltimaPesada) / d, dias: d, pesoVenta }
}

/** Lo que hay que escribir al confirmar. Se arma acá para poder revisarlo antes de ejecutar. */
export interface PlanConfirmacion {
  venta: {
    lote_id: string
    fecha_venta: string
    cantidad: number
    kg_totales: number
    peso_kg: number
    precio_kg: number
    monto_neto: number
    pct_desbaste: number | null
    pct_cz: number | null
    flete: number | null
    plazo_cobro: string | null
    fecha_cobro: string | null
    destino_id: string | null
    intermediario_id: string | null
    cliente_nombre: string | null
    cliente_cuit: string | null
    empresa: string
  }
  /** Ids de los animales que se dan de baja. */
  ternerosBaja: string[]
  /** Categoría del movimiento de stock. */
  categoriaId: string | null
}

/**
 * El neto de la venta: kg × precio, menos la CZ porcentual y el flete.
 *
 * El flete se resta **como monto**, no como %: no cambia si sube el precio de la hacienda.
 */
export function netoDeVenta(
  kgTotales: number, precioKg: number, pctCz: number, flete: number,
): { bruto: number; cz: number; flete: number; neto: number } {
  const bruto = kgTotales * precioKg
  const cz = bruto * (pctCz || 0)
  return { bruto, cz, flete: flete || 0, neto: bruto - cz - (flete || 0) }
}
