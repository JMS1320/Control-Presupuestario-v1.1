/**
 * 🐄 EXISTENCIA DE HACIENDA AL CIERRE, Y SU VALUACIÓN — A-FEAT-1184.
 *
 * ## De dónde sale la existencia
 *
 * De `productivo.movimientos_hacienda`, sumando **cantidades con signo** hasta la fecha de cierre.
 * El modelo es limpio: el stock inicial entró como `ajuste_stock`, los destetes y tactos como pares
 * `cambio_categoria` `+/−`, y las bajas como `mortandad` y `venta`. **No hace falta una tabla de
 * fotos**: la existencia a cualquier fecha es la suma hasta esa fecha.
 *
 * ⚠️ **`productivo.stock_hacienda` está vacía y NO se usa.** Queda dicho porque yo me guié por ella
 * el 2026-09-28 y concluí —mal— que la app no tenía stock de hacienda. El usuario lo cortó:
 * *«la app ya tiene el stock capaz estás mirando mal, tiene kg y precio»*. Tenía razón.
 *
 * ## Los criterios de valuación son DEL USUARIO, no inventados
 *
 * Están escritos, renglón por renglón, en su planilla `2 - HACIENDA` del balance 2025 — cada
 * categoría dice contra qué precio de mercado se valúa y con qué castigo. Acá se transcriben tal
 * cual, con el texto original a la vista, para que al cambiar uno se vea qué se está cambiando.
 *
 * ## 🕳️ Y lo que NO se puede resolver solo se declara HUECO — no se rellena con un supuesto
 *
 * *«para lo que no tiene precio yo lo llenaría aparte»* · *«debés reconocer los huecos que debemos
 * llenar»*. Una categoría cuyo precio no aparece en el mercado **no se valúa en cero ni con el de
 * al lado**: sale listada, con su criterio, esperando el precio. Valuar con un supuesto silencioso
 * es peor que no valuar (§ 🧮 de `CLAUDE.md`).
 */

import { pesoParaValuar, type PesoCategoria } from "./pesos-hacienda"

/** Una categoría con sus cabezas a la fecha de cierre. */
export interface ExistenciaHacienda {
  categoria: string
  cabezas: number
}

/** De dónde sale el precio de referencia. */
export type FuentePrecio = "mag" | "entresurcos" | "manual"

/**
 * Cómo se valúa una categoría. Transcripto de la planilla del usuario.
 *
 * 📌 `porCabeza` distingue los dos modos que él usa: la hacienda de cría se valúa **por cabeza**
 * (una vaca preñada vale lo que vale, no sus kilos) y la de recría **por kilo × peso**.
 */
export interface CriterioValuacion {
  /** Categoría de `productivo.categorias_hacienda`. */
  categoria: string
  /** El texto tal como está en su planilla. Se muestra, no se interpreta. */
  criterio: string
  fuente: FuentePrecio
  /** MAG: `VACAS`, `NOVILLOS`, `MEJ`… */
  magFamilia?: string
  /** MAG: `Regular`, `Esp.Joven`… */
  magCalidad?: string
  /**
   * MAG: el corte de peso, `+ 430` · `h 430`. **Cuando está, es lo que manda** — la vaca de
   * descarte se define por el peso, no por la calidad (ver el criterio de `Vaca CUT/Descarte`).
   */
  magCorte?: string
  /** Qué columna del mercado usa: él escribe «máximo», «medio»… */
  magCampo?: "maximo" | "minimo" | "promedio" | "mediana"
  /** Entresurcos: sexo y rango de kilos. */
  sexo?: "macho" | "hembra"
  pesoDesde?: number
  pesoHasta?: number
  /** El castigo o la prima: 0,9 · 0,8 · 0,7 · 1,5 · 1,1. */
  factor: number
  /**
   * Kilos por cabeza cuando se valúa por kilo.
   *
   * ⚠️ **Es el FALLBACK, no el valor**: desde A-FEAT-1187 el peso sale de las pesadas de la app y
   * esto se usa sólo si no hay ninguna. `null` = **no se estima**: se dice que falta el dato.
   *
   * 🔑 La distinción es del usuario y no es un detalle: para la vaca de descarte dijo *«sino poner
   * estimado de 500 kg»* y para el toro *«sino poner que no hay dato de pesada»*. **Un estimado
   * declarado sirve; un número inventado en silencio, no.**
   */
  pesoKg?: number | null
  /** true = el precio ya es por cabeza y no se multiplica por kilos. */
  porCabeza?: boolean
  /** Si se deriva de otra categoría (el ternero sale de la ternera + 10 %). */
  derivaDe?: string
}

/**
 * LOS CRITERIOS, transcriptos de `2 - HACIENDA` (balance 2025).
 *
 * 🔑 Cada `criterio` es **literal**: si mañana él cambia el castigo, se cambia acá y queda a la
 * vista en el papel. No hay un número mágico escondido en una fórmula.
 */
export const CRITERIOS: CriterioValuacion[] = [
  {
    categoria: "Vaca",
    criterio: "vaca con gtía de preñez MEDIO × 90 % — por cabeza",
    // El mercado de vacas con garantía de preñez no se publica en MAG ni en Entresurcos:
    // es un precio que consigue él. Por eso nace como hueco y no como un supuesto.
    fuente: "manual", factor: 0.9, porCabeza: true,
  },
  {
    categoria: "Vaquillona Preñada",
    criterio: "vaca con gtía de preñez NUEVA × 90 % — por cabeza",
    fuente: "manual", factor: 0.9, porCabeza: true,
  },
  {
    categoria: "Vaca CUT/Descarte",
    /**
     * ⚠️ **Corregido por el usuario 2026-09-29**, sobre el papel devuelto: *«lo de vaca regular es
     * para nuestra vaca CUT. Está bien tomar MAG en ese caso, pero no la de Regular sino la de
     * categoría **+ de 430** y el **promedio**, no el máximo»*.
     *
     * 🔑 O sea que lo que manda **no es la calidad sino el CORTE DE PESO**: una vaca de descarte de
     * más de 430 kg. Yo había leído *«vaca regular máximo»* de su planilla 2025 y traducido
     * `calidad = Regular` + `campo = máximo`. Las dos mitades estaban mal.
     *
     * 📌 Y aplica **sólo a esta categoría**: el resto sigue como estaba.
     */
    criterio: "vaca + de 430 kg, PROMEDIO × 80 % × el peso de la pesada",
    fuente: "mag", magFamilia: "VACAS", magCorte: "+ 430", magCampo: "promedio",
    // *«poner datos si hay, sino poner estimado de 500 kg»* (JMS 2026-09-29).
    factor: 0.8, pesoKg: 500,
  },
  {
    categoria: "Toro",
    criterio: "novillo regular +490 × 70 % × el peso de la pesada",
    fuente: "mag", magFamilia: "NOVILLOS", magCalidad: "Regular", magCampo: "promedio",
    // *«poner dato de pesada si hay, sino poner que no hay dato de pesada»* — NO se estima.
    factor: 0.7, pesoKg: null,
  },
  {
    categoria: "Torito",
    criterio: "MEJ especial × 1,5 × el peso de la pesada",
    fuente: "mag", magFamilia: "MEJ", magCalidad: "Esp", magCampo: "promedio",
    // *«traer kg de app»* (JMS). Sin pesadas no se estima.
    factor: 1.5, pesoKg: null,
  },
  {
    categoria: "Ternera Recria",
    criterio: "vaquillona 250-290 kg a precio MÁXIMO × el peso de la pesada",
    fuente: "entresurcos", sexo: "hembra", pesoDesde: 250, pesoHasta: 290,
    factor: 1, pesoKg: null,
  },
  {
    categoria: "Ternero Recria",
    criterio: "10 % más que la hembra × el peso de la pesada",
    fuente: "entresurcos", derivaDe: "Ternera Recria", factor: 1.1, pesoKg: null,
  },
]

/** Fila del MAG que necesitamos (subconjunto de `FilaMag`). */
export interface PrecioMag {
  familia: string
  calidad: string
  corte: string | null
  minimo: number
  maximo: number
  promedio: number
  mediana: number
}

/** Fila de Entresurcos (subconjunto de `FilaMercado`). */
export interface PrecioMercado {
  categoria: string
  pesoLo: number
  pesoHi: number | null
  promKilo: number
  kiloMax: number
  kiloMin: number
}

export interface FilaValuada {
  categoria: string
  cabezas: number
  criterio: string
  /** Precio de referencia encontrado, antes del factor. `null` = no se encontró. */
  precioReferencia: number | null
  /** De dónde salió, en palabras: `MAG · VACAS Regular · máximo`. */
  origenPrecio: string
  factor: number
  pesoKg: number | null
  /** De dónde salió el peso: la pesada proyectada, un estimado declarado, o nada. */
  origenPeso: string
  /** Valor por cabeza ya con el factor aplicado. */
  valorPorCabeza: number | null
  /** cabezas × valorPorCabeza. */
  valorTotal: number | null
  /** true = falta el precio y hay que ponerlo a mano. */
  esHueco: boolean
}

export interface ValuacionHacienda {
  filas: FilaValuada[]
  cabezas: number
  /** Suma de lo que SÍ se pudo valuar. */
  valuado: number
  /** Las categorías sin precio: hay que conseguirlo. */
  huecos: FilaValuada[]
  /** Cabezas que quedaron sin valuar por falta de precio. */
  cabezasSinValuar: number
  /** Categorías con existencia y SIN criterio escrito: hay que definirlo con el usuario. */
  sinCriterio: string[]
}

const redondear = (x: number) => Math.round(x * 100) / 100
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

/** Busca en el MAG la fila que pide el criterio. */
function precioDeMag(c: CriterioValuacion, mag: PrecioMag[]): { precio: number; origen: string } | null {
  const fam = norm(c.magFamilia ?? "")
  const cal = norm(c.magCalidad ?? "")
  const corte = norm(c.magCorte ?? "").replace(/\s+/g, "")

  const candidatas = mag.filter(m =>
    norm(m.familia).startsWith(fam) &&
    (!cal || norm(m.calidad).startsWith(cal)) &&
    // El corte se compara sin espacios: el mercado publica `+ 430` y `+430` indistintamente.
    (!corte || norm(m.corte ?? "").replace(/\s+/g, "") === corte))
  if (candidatas.length === 0) return null

  const campo = c.magCampo ?? "promedio"
  const valores = candidatas.map(m => m[campo]).filter(v => v > 0)
  if (valores.length === 0) return null
  const precio = valores.reduce((a, b) => a + b, 0) / valores.length

  /**
   * 📌 **Si quedó más de una fila, se promedian — y se DICE cuáles.** Elegir una sin que el
   * criterio lo indique sería inventar una precisión que no está escrita; promediarlas en silencio
   * sería peor, porque el número saldría de algo que nadie puede reconstruir.
   */
  const detalle = candidatas.length > 1
    ? ` (promedio de ${candidatas.length}: ${candidatas.map(m => `${m.calidad} ${m.corte ?? ""}`.trim()).join(" · ")})`
    : candidatas[0].corte ? ` ${candidatas[0].corte}` : ""

  return {
    precio,
    origen: `MAG · ${c.magFamilia} ${c.magCalidad ?? c.magCorte ?? ""}`.trim() + ` · ${campo}` + detalle,
  }
}

/** Busca en Entresurcos el rango de kilos que pide el criterio. */
function precioDeMercado(c: CriterioValuacion, filas: PrecioMercado[]): { precio: number; origen: string } | null {
  const desde = c.pesoDesde ?? 0
  const hasta = c.pesoHasta ?? Infinity
  // Se toma el rango que SOLAPA con el pedido; si hay varios, el promedio de sus máximos.
  const candidatas = filas.filter(f => f.pesoLo <= hasta && (f.pesoHi ?? Infinity) >= desde)
  if (candidatas.length === 0) return null
  const valores = candidatas.map(f => f.kiloMax || f.promKilo).filter(v => v > 0)
  if (valores.length === 0) return null
  return {
    precio: valores.reduce((a, b) => a + b, 0) / valores.length,
    origen: `Entresurcos · ${c.sexo === "hembra" ? "terneras" : "terneros"} ${desde}-${hasta === Infinity ? "+" : hasta} kg · máximo`,
  }
}

/**
 * Valúa la existencia.
 *
 * 📌 `preciosManuales` es el override del usuario, por categoría: **si lo cargó, manda** — es la
 * § 🎚️ *default del dato real, siempre editable* de `CLAUDE.md` aplicada acá. Vacío = usá el de
 * mercado; lleno = acá mando yo.
 */
export function valuarHacienda(
  existencias: ExistenciaHacienda[],
  mag: PrecioMag[],
  mercado: PrecioMercado[],
  preciosManuales: Record<string, number> = {},
  /** Los kilos medidos por categoría. Vacío = se cae al fallback de cada criterio. */
  pesos: PesoCategoria[] = [],
): ValuacionHacienda {
  const porCategoria = new Map(CRITERIOS.map(c => [c.categoria, c]))
  const sinCriterio = existencias
    .filter(e => e.cabezas > 0 && !porCategoria.has(e.categoria))
    .map(e => e.categoria)

  // Primera pasada: las que no dependen de otra.
  const resueltas = new Map<string, number>()
  const filas: FilaValuada[] = []

  const resolverPrecio = (c: CriterioValuacion): { precio: number; origen: string } | null => {
    const manual = preciosManuales[c.categoria]
    if (Number.isFinite(manual) && manual > 0) {
      return { precio: manual, origen: "cargado a mano" }
    }
    if (c.derivaDe) {
      const base = resueltas.get(c.derivaDe)
      return base == null ? null : { precio: base, origen: `derivado de «${c.derivaDe}»` }
    }
    if (c.fuente === "mag") return precioDeMag(c, mag)
    if (c.fuente === "entresurcos") return precioDeMercado(c, mercado)
    return null // manual y sin carga = hueco
  }

  // Se ordena para que las derivadas se calculen después de su base.
  const orden = [...existencias].sort((a, b) => {
    const ca = porCategoria.get(a.categoria), cb = porCategoria.get(b.categoria)
    return (ca?.derivaDe ? 1 : 0) - (cb?.derivaDe ? 1 : 0)
  })

  for (const e of orden) {
    const c = porCategoria.get(e.categoria)
    if (!c) continue
    const p = resolverPrecio(c)
    if (p) resueltas.set(c.categoria, p.precio)

    // ⚖️ El peso sale de las pesadas; el del criterio es sólo el fallback (A-FEAT-1187).
    const peso = c.porCabeza
      ? { kg: null, origen: "se valúa por cabeza, no por kilo" }
      : pesoParaValuar(e.categoria, pesos, c.pesoKg)

    // 🔑 Sin precio NO se valúa; sin kilos tampoco, cuando la categoría se valúa por kilo.
    //    Poner 0 en cualquiera de los dos daría un valor que se lee como real y no lo es.
    const faltaPeso = !c.porCabeza && peso.kg == null
    const valorPorCabeza = p == null || faltaPeso ? null
      : redondear(c.porCabeza ? p.precio * c.factor : p.precio * c.factor * (peso.kg ?? 0))

    filas.push({
      categoria: e.categoria, cabezas: e.cabezas, criterio: c.criterio,
      precioReferencia: p ? redondear(p.precio) : null,
      origenPrecio: p ? p.origen : "— falta el precio —",
      factor: c.factor, pesoKg: peso.kg, origenPeso: peso.origen,
      valorPorCabeza,
      valorTotal: valorPorCabeza == null ? null : redondear(valorPorCabeza * e.cabezas),
      esHueco: valorPorCabeza == null,
    })
  }

  // Las que tienen existencia pero ningún criterio: se muestran igual, como hueco.
  for (const cat of sinCriterio) {
    const e = existencias.find(x => x.categoria === cat)!
    filas.push({
      categoria: cat, cabezas: e.cabezas,
      criterio: "— sin criterio de valuación definido —",
      precioReferencia: null, origenPrecio: "— falta definirlo con el usuario —",
      factor: 1, pesoKg: null, origenPeso: "—", valorPorCabeza: null, valorTotal: null, esHueco: true,
    })
  }

  filas.sort((a, b) => (b.valorTotal ?? -1) - (a.valorTotal ?? -1))
  const huecos = filas.filter(f => f.esHueco)

  return {
    filas,
    cabezas: filas.reduce((s, f) => s + f.cabezas, 0),
    valuado: redondear(filas.reduce((s, f) => s + (f.valorTotal ?? 0), 0)),
    huecos,
    cabezasSinValuar: huecos.reduce((s, f) => s + f.cabezas, 0),
    sinCriterio,
  }
}
