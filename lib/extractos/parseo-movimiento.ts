/**
 * Desglose de la columna "Movimiento" de un extracto de Caja de Ahorro.
 *
 * El banco manda todo apilado en varias líneas dentro de una sola celda:
 *
 *     TRANSFERENCIA A TERCEROS      ← el tipo de movimiento (línea 1)
 *     CU  20208914880               ← CUIT
 *     0170017620000000448154        ← CBU
 *     FNCS                          ← beneficiario
 *     VARIOS                        ← concepto
 *
 * Las reglas de `config_parseo_extracto` dicen, por cuenta y por tipo, qué línea va a qué
 * columna. Así la conciliación puede después buscar por CUIT o por beneficiario en vez de
 * contra un bloque de texto.
 *
 * ⚠️ **Esta lógica es UNA SOLA a propósito.** La usan el importador (al entrar el Excel) y el
 * re-parseo (sobre lo ya guardado en `concepto`). Si fueran dos copias podrían divergir, y un
 * movimiento quedaría desglosado distinto según por dónde entró — sin forma de notarlo mirando
 * la grilla. Compartir el código es lo que vuelve verificable al re-parseo: correrlo sobre algo
 * ya importado tiene que dar exactamente lo mismo.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export interface ReglaParseo {
  campo_destino: string | null
  tipo_regla: string
  numero_linea: number | null
  grupo_de_conceptos: string
  /**
   * Forma del movimiento a la que aplica (ver `firmaDeMovimiento`).
   * `null` / ausente = vale para **todas** las formas del tipo.
   */
  firma_forma?: string | null
}

/** tipo_movimiento → reglas. La clave `*` es el comodín para lo no contemplado. */
export type MapaReglas = Record<string, ReglaParseo[]>

/** Grupo que se asigna cuando ningún set de reglas aplica. Es la marca de "sin desglosar". */
export const GRUPO_SIN_REGLA = "Otros"

/**
 * Grupo que se asigna cuando el tipo TIENE reglas por forma pero **ninguna es de esta forma**.
 *
 * Decisión del usuario (2026-08-10): en ese caso **no se parsea**. Preferimos un movimiento sin
 * desglosar y señalado a uno desglosado con las reglas de otra forma — que se vería correcto y
 * estaría mal. Además así una forma nueva del banco **se ve**, en vez de pasar de largo.
 */
export const GRUPO_FORMA_NUEVA = "Forma nueva"

/** Divide el texto multilínea en líneas limpias, descartando las vacías. */
export function splitMovimiento(raw: string): string[] {
  return raw
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

/** ¿La línea es un CUIT? 11 dígitos, con posible prefijo `CU ` o `NO `. */
export function esCuit(linea: string): boolean {
  const limpio = linea.replace(/^(CU|NO)\s+/, "").trim()
  return /^\d{11}$/.test(limpio)
}

/** Primer CUIT que aparezca, sin el prefijo. */
export function extraerCuit(lineas: string[]): string {
  for (const l of lineas) {
    const c = l.replace(/^(CU|NO)\s+/, "").trim()
    if (/^\d{11}$/.test(c)) return c
  }
  return ""
}

/** Aplica una regla a las líneas del movimiento y devuelve el valor extraído. */
export function aplicarRegla(lineas: string[], regla: ReglaParseo): string {
  switch (regla.tipo_regla) {
    case "linea":
      return lineas[(regla.numero_linea ?? 1) - 1]?.trim() ?? ""

    case "cuit":
      return extraerCuit(lineas)

    case "pre_cuit":
      // La línea ANTERIOR al CUIT — típicamente el nombre. Sólo si el CUIT no viene pegado
      // al tipo: si está en la posición 1 no hay nombre que rescatar.
      for (let i = 1; i < lineas.length; i++) {
        if (esCuit(lineas[i])) {
          return i >= 2 ? lineas[i - 1]?.trim() ?? "" : ""
        }
      }
      return ""

    case "post_cuit":
      for (let i = 0; i < lineas.length - 1; i++) {
        if (esCuit(lineas[i])) return lineas[i + 1]?.trim() ?? ""
      }
      return ""

    case "nro_operacion":
      for (const l of lineas) {
        const m1 = l.match(/OPERACION\s+(\S+)/i)
        if (m1) return m1[1]
        const m2 = l.match(/OP:(\S+)/i)
        if (m2) return m2[1]
      }
      // Fallback: último segmento numérico que no sea un CUIT
      for (let i = lineas.length - 1; i >= 1; i--) {
        const l = lineas[i].trim()
        if (/^\d+$/.test(l) && !/^\d{11}$/.test(l)) return l
      }
      return ""
  }
  return ""
}

/**
 * Desglosa un movimiento según las reglas. Devuelve un objeto `campo_destino → valor`.
 *
 * Si no hay regla para el tipo (ni comodín), sólo se llena `descripcion` con la primera línea
 * y `grupo_de_conceptos` con `"Otros"`. **El texto completo no se pierde**: el importador lo
 * guarda aparte en `concepto`, y de ahí lo lee el re-parseo.
 */
export function parsearMovimiento(raw: string, mapaReglas: MapaReglas): Record<string, string> {
  const lineas = splitMovimiento(raw)
  const tipoLinea1 = (lineas[0] ?? "").toUpperCase()
  const resultado: Record<string, string> = {}

  const { reglas, formaNueva } = resolverReglas(lineas, mapaReglas)

  if (formaNueva) {
    // No se parsea a propósito. El texto crudo sigue entero en `concepto`, así que un re-parseo
    // posterior lo resuelve apenas se escriba la regla de esta forma.
    resultado["grupo_de_conceptos"] = GRUPO_FORMA_NUEVA
    resultado["descripcion"] = tipoLinea1 || raw.substring(0, 100)
    return resultado
  }

  resultado["grupo_de_conceptos"] = reglas.length > 0 ? reglas[0].grupo_de_conceptos : GRUPO_SIN_REGLA

  for (const regla of reglas) {
    if (!regla.campo_destino) continue
    resultado[regla.campo_destino] = aplicarRegla(lineas, regla)
  }

  // La descripción siempre tiene al menos el tipo
  if (!resultado["descripcion"]) {
    resultado["descripcion"] = tipoLinea1 || raw.substring(0, 100)
  }

  return resultado
}

/**
 * Qué reglas se aplican a este movimiento, y si su forma es desconocida.
 *
 * Las reglas de un tipo son de dos clases:
 * - **genéricas** (`firma_forma` vacío): valen para todas las formas. Son las de los modos que
 *   buscan — el CUIT y el nombre están donde estén.
 * - **por forma**: valen sólo para esa forma. Son las que cuentan líneas, porque contar sólo
 *   tiene sentido dentro de una forma.
 *
 * Se aplican las genéricas y encima las de la forma, así que ante el mismo `campo_destino` **manda
 * la específica**.
 *
 * ⚠️ **Y si el tipo tiene reglas por forma pero ninguna es de ESTA forma → no se parsea**
 * (`formaNueva`). Ver `GRUPO_FORMA_NUEVA`.
 */
export function resolverReglas(
  lineas: string[],
  mapaReglas: MapaReglas,
): { reglas: ReglaParseo[]; formaNueva: boolean } {
  const tipoLinea1 = (lineas[0] ?? "").toUpperCase()
  // El match del tipo es EXACTO (ignorando mayúsculas). Por eso `COMPRA DEBITO` no encuentra
  // la regla de `COMPRA CON DEBITO`: para el sistema son dos tipos distintos.
  const claveExacta = Object.keys(mapaReglas).find((k) => k.toUpperCase() === tipoLinea1)
  const delTipo = claveExacta ? mapaReglas[claveExacta] : mapaReglas["*"] ?? []

  const firma = firmaDeMovimiento(lineas)
  const genericas = delTipo.filter((r) => !r.firma_forma)
  const propias = delTipo.filter((r) => r.firma_forma === firma)
  const tieneReglasPorForma = delTipo.some((r) => !!r.firma_forma)

  if (tieneReglasPorForma && propias.length === 0) {
    return { reglas: [], formaNueva: true }
  }
  return { reglas: [...genericas, ...propias], formaNueva: false }
}

/** ¿Este movimiento quedó sin parsear por ser de una forma no contemplada? */
export function esFormaNueva(raw: string | null | undefined, mapaReglas: MapaReglas): boolean {
  const lineas = splitMovimiento(String(raw ?? ""))
  if (lineas.length === 0) return false
  return resolverReglas(lineas, mapaReglas).formaNueva
}

/** El tipo de movimiento de un texto crudo: su primera línea, normalizada. */
export function tipoDeMovimiento(raw: string | null | undefined): string {
  return splitMovimiento(String(raw ?? ""))[0]?.toUpperCase() ?? ""
}

/** ¿Existe una regla propia para este tipo? (el comodín `*` no cuenta como propia) */
export function tieneReglaPropia(raw: string | null | undefined, mapaReglas: MapaReglas): boolean {
  const tipo = tipoDeMovimiento(raw)
  if (!tipo) return false
  return Object.keys(mapaReglas).some((k) => k !== "*" && k.toUpperCase() === tipo)
}

/** Carga las reglas activas de una cuenta, agrupadas por tipo de movimiento. */
export async function cargarReglasParseo(
  supabase: SupabaseClient,
  cuentaBancariaId: string,
): Promise<MapaReglas> {
  // `select("*")` a propósito: `firma_forma` es una columna nueva y con el listado explícito la
  // consulta fallaría en cualquier entorno donde el ALTER TABLE todavía no se corrió. Así, hasta
  // que exista, `firma_forma` llega `undefined` y todas las reglas se tratan como genéricas —
  // exactamente el comportamiento anterior.
  const { data, error } = await supabase
    .from("config_parseo_extracto")
    .select("*")
    .eq("cuenta_bancaria_id", cuentaBancariaId)
    .eq("activo", true)
    .order("orden", { ascending: true })

  if (error || !data) {
    console.error("Error cargando reglas de parseo:", error)
    return {}
  }

  const mapa: MapaReglas = {}
  for (const r of data as any[]) {
    const tipo = r.tipo_movimiento
    if (!mapa[tipo]) mapa[tipo] = []
    mapa[tipo].push({
      campo_destino: r.campo_destino,
      tipo_regla: r.tipo_regla,
      numero_linea: r.numero_linea,
      grupo_de_conceptos: r.grupo_de_conceptos ?? "",
      firma_forma: r.firma_forma ?? null,
    })
  }
  return mapa
}

// ────────────────────────────────────────────────────────────────────────────
// PROPUESTA DE MAPEO — qué es cada línea y a qué columna va
//
// El extracto del Galicia no es texto libre: el mismo tipo de dato aparece siempre de la misma
// forma. Un CUIT son 11 dígitos con prefijo `CU`/`NO`; un CBU son 22; el nombre del beneficiario
// va justo antes del CUIT. Eso ya lo sabemos, así que **no tiene por qué preguntarse**.
//
// La convención de columnas, que es la que respetan las 49 reglas ya cargadas:
//
//   descripcion            el tipo de movimiento (línea 1)
//   leyendas_adicionales_1 el nombre / beneficiario / comercio
//   leyendas_adicionales_2 EL CUIT — de acá lo lee el motor de conciliación
//   leyendas_adicionales_3 el concepto
//   numero_de_comprobante  el número de operación o el código de autorización
//   numero_de_terminal     identificadores largos del banco
//
// Lo que NO sabemos se propone **sin asignar**, nunca adivinando: un dato creíble en la columna
// equivocada es peor que un dato ausente, porque nadie lo va a revisar.
// ────────────────────────────────────────────────────────────────────────────

/** Qué contenido reconocimos en una línea. `""` = no lo sabemos. */
export type ContenidoLinea =
  | "tipo" | "cuit" | "nombre" | "concepto" | "operacion"
  | "cbu" | "tarjeta" | "autorizacion" | "identificador" | ""

export interface LineaPropuesta {
  /** La línea tal cual vino del banco. */
  texto: string
  /** Qué reconocimos, para mostrarlo. */
  contenido: ContenidoLinea
  /** Columna propuesta. `""` = sin asignar. */
  campo: string
  /** Modo con el que conviene extraerlo. */
  modo: string
  /** Nº de línea (1-based), sólo relevante con modo `linea`. */
  numero: number
  /** `true` cuando el formato del banco no deja lugar a dudas. */
  seguro: boolean
  /** Por qué se propuso esto. Se muestra al usuario. */
  motivo: string
}

export const esCbu = (l: string) => /^\d{22}$/.test(l.trim())
export const esTarjeta = (l: string) => /X{4,}/i.test(l) && /\d/.test(l)
const esAutorizacion = (l: string) => /^[A-Z]\d{3,4}$/.test(l.trim())
const esIdentificador = (l: string) => /^\d{8,}$/.test(l.trim()) && !esCbu(l) && !/^\d{11}$/.test(l.trim())

// ────────────────────────────────────────────────────────────────────────────
// FIRMA DE FORMA — qué hace que dos movimientos sean "el mismo tipo"
//
// Hasta 2026-08-10 el tipo era **sólo la primera línea**. Alcanzaba hasta que apareció
// `TRANSFERENCIA A TERCEROS`, que llega de dos formas: 16 movimientos de 6 líneas con el CUIT en
// la 2, y 7 de 5 líneas con el CUIT en la 3 y con nombre. Mostrados como un tipo homogéneo, las
// reglas por número de línea se escribieron para la forma que estaba a la vista y fallan en la
// otra — sin decir nada (ver PENDIENTES § A-BUG-17).
//
// La firma es **cantidad de líneas + qué clase de dato hay en cada una**. Dos movimientos con la
// misma cantidad de líneas pueden ser formas distintas si en uno la línea 3 es un CUIT y en el
// otro un texto, así que contar líneas solo no alcanza.
// ────────────────────────────────────────────────────────────────────────────

/** La clase de dato de una línea, para comparar formas. */
export function claseDeLinea(l: string, indice: number): string {
  if (indice === 0) return "tipo"
  if (esCuit(l)) return "cuit"
  if (esCbu(l)) return "cbu"
  if (esTarjeta(l)) return "tarjeta"
  if (/^\d+$/.test(l.trim())) return "num"
  return "texto"
}

/** Firma de la forma del movimiento. Dos movimientos con la misma firma son intercambiables. */
export function firmaDeMovimiento(lineas: string[]): string {
  return `${lineas.length}:${lineas.map(claseDeLinea).join(",")}`
}

/** Cuántas líneas describe una firma. */
export function lineasDeFirma(firma: string): number {
  return Number(firma.split(":")[0]) || 0
}

/** ¿La línea trae un número de operación, y lo agarra el modo `nro_operacion`? */
function operacionEnLinea(l: string): { hay: boolean; loAgarra: boolean } {
  const loAgarra = /OPERACION\s+\S/i.test(l) || /OP:\S/i.test(l)
  const hay = loAgarra || /OPERACION/i.test(l)
  return { hay, loAgarra }
}

/**
 * Propone, para cada línea del movimiento, qué es y dónde debería guardarse.
 * Es una **propuesta**: la pantalla la muestra editable y el usuario decide.
 */
export function proponerMapeo(lineas: string[]): LineaPropuesta[] {
  const idxCuit = lineas.findIndex((l) => esCuit(l))

  return lineas.map((texto, i) => {
    const base = { texto, numero: i + 1 }

    if (i === 0)
      return { ...base, contenido: "tipo" as const, campo: "descripcion", modo: "linea",
        seguro: true, motivo: "La primera línea es siempre el tipo de movimiento" }

    if (esCuit(texto))
      return { ...base, contenido: "cuit" as const, campo: "leyendas_adicionales_2", modo: "cuit",
        seguro: true, motivo: "11 dígitos: es el CUIT. Va donde el motor lo busca, y con el modo que lo encuentra aunque cambie de línea" }

    if (esCbu(texto))
      return { ...base, contenido: "cbu" as const, campo: "", modo: "linea",
        seguro: true, motivo: "22 dígitos: es un CBU. No hay columna para el CBU — asignarlo a la del CUIT la ensucia" }

    if (esTarjeta(texto))
      return { ...base, contenido: "tarjeta" as const, campo: "", modo: "linea",
        seguro: true, motivo: "Tarjeta enmascarada. No hay columna propia; elegí una si te sirve" }

    const op = operacionEnLinea(texto)
    if (op.hay)
      return { ...base, contenido: "operacion" as const, campo: "numero_de_comprobante",
        modo: op.loAgarra ? "nro_operacion" : "linea", seguro: true,
        motivo: op.loAgarra
          ? "Número de operación"
          : "Dice «Operacion» pero el modo no lo sabe leer (los dos puntos) — se guarda la línea entera" }

    if (idxCuit >= 0 && i === idxCuit - 1 && i >= 1)
      return { ...base, contenido: "nombre" as const, campo: "leyendas_adicionales_1", modo: "pre_cuit",
        seguro: true, motivo: "La línea antes del CUIT es el nombre de la contraparte" }

    if (idxCuit >= 0 && i === idxCuit + 1)
      return { ...base, contenido: "concepto" as const, campo: "leyendas_adicionales_3", modo: "post_cuit",
        seguro: false, motivo: "Después del CUIT suele venir el concepto — conviene mirarlo" }

    if (idxCuit < 0 && i === 1 && !/^\d+$/.test(texto.trim()))
      return { ...base, contenido: "nombre" as const, campo: "leyendas_adicionales_1", modo: "linea",
        seguro: false, motivo: "Sin CUIT en el texto, la línea 2 suele ser el comercio o la contraparte" }

    if (esAutorizacion(texto))
      return { ...base, contenido: "autorizacion" as const, campo: "numero_de_comprobante", modo: "linea",
        seguro: false, motivo: "Parece un código de autorización" }

    if (esIdentificador(texto))
      return { ...base, contenido: "identificador" as const, campo: "numero_de_terminal", modo: "linea",
        seguro: false, motivo: "Número largo del banco" }

    return { ...base, contenido: "" as const, campo: "", modo: "linea",
      seguro: false, motivo: "No lo reconocimos — decidilo vos" }
  })
}

/** Los campos que escribe el desglose. Todo lo demás del movimiento no se toca. */
export const CAMPOS_DEL_PARSEO = [
  "descripcion",
  "grupo_de_conceptos",
  "tipo_de_movimiento",
  "numero_de_comprobante",
  "numero_de_terminal",
  "observaciones_cliente",
  "leyendas_adicionales_1",
  "leyendas_adicionales_2",
  "leyendas_adicionales_3",
  "leyendas_adicionales_4",
] as const
