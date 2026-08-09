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
}

/** tipo_movimiento → reglas. La clave `*` es el comodín para lo no contemplado. */
export type MapaReglas = Record<string, ReglaParseo[]>

/** Grupo que se asigna cuando ningún set de reglas aplica. Es la marca de "sin desglosar". */
export const GRUPO_SIN_REGLA = "Otros"

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

  // El match del tipo es EXACTO (ignorando mayúsculas). Por eso `COMPRA DEBITO` no encuentra
  // la regla de `COMPRA CON DEBITO`: para el sistema son dos tipos distintos.
  const claveExacta = Object.keys(mapaReglas).find((k) => k.toUpperCase() === tipoLinea1)
  const reglas = claveExacta ? mapaReglas[claveExacta] : mapaReglas["*"] ?? []

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
  const { data, error } = await supabase
    .from("config_parseo_extracto")
    .select("tipo_movimiento, campo_destino, tipo_regla, numero_linea, grupo_de_conceptos")
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
    })
  }
  return mapa
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
