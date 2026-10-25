/**
 * 🗄️ La parte PURA de `datos-usuario.ts` (A-FEAT-1337): sin base ni React, para los casos de `npm run probar`.
 */

export const TABLA_DATOS_USUARIO = "balance_datos_usuario"

/** Los papeles que guardan datos del usuario. La clave dentro de cada uno la pone la pantalla. */
export type PapelConDatos = "hacienda.precio" | "granos" | "fci"

export interface CambioHistorial { texto: string | null; valor: number | null; at: string | null; por: string | null }

export interface FilaDatoUsuario {
  empresa: string
  anio_cierre: number
  papel: string
  clave: string
  texto: string | null
  valor: number | null
  historial: CambioHistorial[]
  actualizado_por: string | null
  updated_at: string
}

/** es-AR: punto de miles, coma decimal (§ 💰). Vacío o ilegible = null («no lo sé», no cero). */
export function leerNumero(texto: string | null | undefined): number | null {
  const t = String(texto ?? "").trim()
  if (!t) return null
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

/**
 * La fila a guardar cuando la casilla cambia. Pura, para poder probarla.
 * Devuelve `null` si no cambió nada (no se escribe de más).
 */
export function armarFilaDato(
  base: { empresa: string; anio_cierre: number; papel: string; clave: string },
  texto: string,
  anterior: Pick<FilaDatoUsuario, "texto" | "valor" | "historial" | "actualizado_por" | "updated_at"> | null,
  por: string | null,
  ahora: string,
): Omit<FilaDatoUsuario, never> | null {
  const limpio = texto.trim()
  if ((anterior?.texto ?? "").trim() === limpio) return null
  const historial = anterior
    ? [...(anterior.historial ?? []), { texto: anterior.texto, valor: anterior.valor, at: anterior.updated_at, por: anterior.actualizado_por }]
    : []
  return {
    ...base, texto: limpio || null, valor: leerNumero(limpio), historial,
    actualizado_por: por, updated_at: ahora,
  }
}

export type EstadoGuardado = "leyendo" | "guardado" | "guardando" | "sin tabla" | "error"

/** Un renglón chico que dice si lo cargado se está guardando. */
export function textoEstadoGuardado(estado: EstadoGuardado, error: string | null): string {
  switch (estado) {
    case "leyendo": return "leyendo lo que cargaste…"
    case "guardando": return "guardando…"
    case "guardado": return "✓ lo que cargás queda guardado"
    case "sin tabla": return "⚠️ todavía NO se guarda (falta correr el script 100): si recargás, se pierde"
    case "error": return `🛑 no se pudo guardar: ${error ?? "error desconocido"}`
  }
}
