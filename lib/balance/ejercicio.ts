/**
 * 📅 EL EJERCICIO CONTABLE — y el corte que de verdad importa (A-FEAT-1184).
 *
 * ## 🔑 La regla, y es del usuario, no una convención que inventamos
 *
 * *«si la factura no entró no entra en el balance, por eso se provisiona. o sea que **gasto es los
 * 12 subdiarios y no las fechas de las facturas**»* (JMS, 2026-09-28).
 *
 * Es decir: el ejercicio **no** es *«los comprobantes fechados entre el 1/7 y el 30/6»*. Es
 * **el conjunto de los 12 subdiarios** de julio a junio. Una factura de mayo que entró al subdiario
 * de julio **no está en el balance de este ejercicio**: está en el siguiente, y en éste va como
 * **provisión**.
 *
 * ## ✅ Y el dato ya existe: `año_contable` + `mes_contable` ES el subdiario
 *
 * Verificado contra la base el 2026-09-28: el subdiario de enero 2026 contiene una factura del
 * **17/09/2025**, y el de julio 2026 una del **23/06/2026** — que es justamente una a provisionar.
 * O sea que las dos columnas no son una etiqueta de ejercicio: dicen **en qué subdiario entró el
 * comprobante**, que es el corte que hace falta.
 *
 * ⚠️ **Esto corrige un diagnóstico viejo.** El relevamiento del 2026-08-31 había concluido que
 * *«no existe el ejercicio como filtro»* y que `año_contable` **no servía** porque «cruzaba el
 * corte». La columna estaba bien; la pregunta estaba mal — se le preguntó *«¿esto etiqueta el
 * ejercicio?»* en vez de *«¿esto dice en qué subdiario entró?»*. Un dato descartado por la pregunta
 * equivocada es indistinguible de un dato que no existe, y así estuvo anotado un mes.
 *
 * ## Alcance
 * MSA cierra el **30/06**; PAM y MA el **31/12**. Por eso el mes de cierre es un parámetro y no
 * está clavado en 6.
 */

/** Un subdiario: el mes calendario en el que se registró el comprobante. */
export interface Subdiario {
  anio: number
  /** 1-12. */
  mes: number
}

export interface Ejercicio {
  /** Año en que CIERRA. El ejercicio 25/26 de MSA cierra en 2026. */
  anioCierre: number
  /** Mes de cierre: 6 para MSA (30/06), 12 para PAM y MA (31/12). */
  mesCierre: number
  /** Los 12 subdiarios, en orden. */
  subdiarios: Subdiario[]
  /** Último día del ejercicio, `YYYY-MM-DD`. Es la fecha del corte patrimonial. */
  fechaCierre: string
  /** Cómo lo nombra el usuario: `25/26`, `2025` … */
  etiqueta: string
}

const ultimoDiaDe = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate()

/** `2026-06-30`. Se arma a mano y no con `toISOString()` para no depender del huso. */
const iso = (anio: number, mes: number, dia: number) =>
  `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`

/**
 * Arma el ejercicio que cierra en `anioCierre`/`mesCierre`.
 *
 * MSA 25/26 → `armarEjercicio(2026, 6)` → subdiarios **julio 2025 … junio 2026**, cierre 30/06/2026.
 * PAM 2025  → `armarEjercicio(2025, 12)` → **enero … diciembre 2025**, cierre 31/12/2025.
 */
export function armarEjercicio(anioCierre: number, mesCierre = 6): Ejercicio {
  if (!Number.isInteger(mesCierre) || mesCierre < 1 || mesCierre > 12) {
    throw new Error(`Mes de cierre inválido: ${mesCierre}`)
  }
  const subdiarios: Subdiario[] = []
  // Se recorre hacia atrás desde el mes de cierre y se da vuelta: así el primero es el más viejo
  // sin tener que hacer cuentas de módulo en los dos sentidos.
  for (let i = 0; i < 12; i++) {
    const total = mesCierre - i
    const mes = ((total - 1 + 12) % 12) + 1
    const anio = total >= 1 ? anioCierre : anioCierre - 1
    subdiarios.unshift({ anio, mes })
  }
  const primero = subdiarios[0]
  // El ejercicio calendario (cierre en diciembre) se nombra por su único año; el partido, `25/26`.
  const etiqueta = primero.anio === anioCierre
    ? String(anioCierre)
    : `${String(primero.anio).slice(-2)}/${String(anioCierre).slice(-2)}`

  return {
    anioCierre,
    mesCierre,
    subdiarios,
    fechaCierre: iso(anioCierre, mesCierre, ultimoDiaDe(anioCierre, mesCierre)),
    etiqueta,
  }
}

/** Clave comparable de un subdiario: `2026-06`. */
export const claveSubdiario = (anio: number | null | undefined, mes: number | null | undefined): string =>
  anio == null || mes == null ? "" : `${anio}-${String(mes).padStart(2, "0")}`

/** ¿El comprobante entró en alguno de los 12 subdiarios del ejercicio? */
export function esDelEjercicio(
  anioContable: number | null | undefined,
  mesContable: number | null | undefined,
  ej: Ejercicio,
): boolean {
  const k = claveSubdiario(anioContable, mesContable)
  if (!k) return false
  return ej.subdiarios.some(s => claveSubdiario(s.anio, s.mes) === k)
}

/**
 * ¿Es una PROVISIÓN? O sea: **económicamente es del ejercicio, pero no entró en sus subdiarios**.
 *
 * Las dos condiciones, y las dos hacen falta:
 * 1. la **fecha del comprobante** es del ejercicio o anterior (`<= fechaCierre`), y
 * 2. el **subdiario** en el que entró es **posterior** al cierre.
 *
 * 📌 Por eso la app puede calcular el papel `05 - PROVISION FC` **sola**, sin que nadie marque
 * nada a mano: la marca ya está, es el subdiario.
 *
 * ⚠️ Una factura **sin subdiario** (`null`) **no se cuenta como provisión**: no se sabe si entró
 * tarde o si todavía no se imputó. Va al montón de «sin clasificar», que se muestra aparte — nada
 * se descarta en silencio (§ 🧮 de `CLAUDE.md`).
 */
export function esProvision(
  fechaComprobante: string | null | undefined,
  anioContable: number | null | undefined,
  mesContable: number | null | undefined,
  ej: Ejercicio,
): boolean {
  if (!fechaComprobante) return false
  if (fechaComprobante.slice(0, 10) > ej.fechaCierre) return false
  const k = claveSubdiario(anioContable, mesContable)
  if (!k) return false
  const ultimo = ej.subdiarios[ej.subdiarios.length - 1]
  return k > claveSubdiario(ultimo.anio, ultimo.mes)
}

/**
 * Los subdiarios del ejercicio que **no tienen ni un comprobante**.
 *
 * 🔑 Vale la pena aunque suene obvio: un mes faltante **no se nota mirando el total**, y es la
 * forma más silenciosa de entregar un libro diario incompleto. Doce meses tienen que tener doce
 * subdiarios; si uno viene vacío, es un dato que falta cargar, no un mes sin movimiento.
 */
export function subdiariosVacios(
  ej: Ejercicio,
  presentes: Array<{ anio: number | null | undefined; mes: number | null | undefined }>,
): Subdiario[] {
  const hay = new Set(presentes.map(p => claveSubdiario(p.anio, p.mes)).filter(Boolean))
  return ej.subdiarios.filter(s => !hay.has(claveSubdiario(s.anio, s.mes)))
}

/** `julio 2025`, para mostrar. */
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
export const nombreSubdiario = (s: Subdiario): string => `${MESES[s.mes - 1]} ${s.anio}`
