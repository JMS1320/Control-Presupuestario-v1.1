/**
 * 🗄️ La parte PURA de `datos-usuario.ts` (A-FEAT-1337): sin base ni React, para los casos de `npm run probar`.
 */

export const TABLA_DATOS_USUARIO = "balance_datos_usuario"

/**
 * Los papeles que guardan datos del usuario. La clave dentro de cada uno la pone la pantalla.
 * `cc.saldo-inicio` (A-FEAT-1388): el saldo de inicio de cada cuenta corriente del papel 14, por clave
 * de contraparte (JMS, AMS, MA…).
 */
export type PapelConDatos = "hacienda.precio" | "granos" | "fci" | "cc.saldo-inicio"

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

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 🤖 TENTATIVO — un dato que puso Claude y espera el OK de JMS (A-FEAT-1386)
// ════════════════════════════════════════════════════════════════════════════════════════════════
/**
 * JMS 27/10: *«yo dejaría datos puestos por vos pero con la marca de que los pusiste vos, o sea tentativos, obligatorio
 * yo revisar y dar ok»*. La marca vive en `actualizado_por` (no hace falta columna nueva):
 * `Claude · TENTATIVO · <fuente>`. Deja de ser tentativo cuando JMS toca ✓ OK o escribe otro valor (el historial
 * guarda lo de Claude). En la pantalla y en el Excel sale «TENTATIVO» con la fuente.
 */
export const MARCA_TENTATIVO = "Claude · TENTATIVO · "

export const esTentativo = (actualizadoPor: string | null | undefined) => !!actualizadoPor?.startsWith(MARCA_TENTATIVO)

/** La fuente escrita después de la marca, o null si no es tentativo. */
export const fuenteTentativo = (actualizadoPor: string | null | undefined) =>
  esTentativo(actualizadoPor) ? actualizadoPor!.slice(MARCA_TENTATIVO.length) : null

/** El texto que acompaña al dato en el Excel mientras no tiene el OK. */
export const leyendaTentativo = (fuente: string | null | undefined) =>
  fuente ? `TENTATIVO (lo puso Claude, falta tu OK) · ${fuente}` : ""

/**
 * La fila que confirma un dato tentativo: mismo valor, `actualizado_por` = quien da el OK, y lo de Claude al historial.
 * `null` si no era tentativo (no hay nada que confirmar).
 */
export function confirmarFila(fila: FilaDatoUsuario, por: string | null, ahora: string): FilaDatoUsuario | null {
  if (!esTentativo(fila.actualizado_por)) return null
  return {
    ...fila,
    historial: [...(fila.historial ?? []), { texto: fila.texto, valor: fila.valor, at: fila.updated_at, por: fila.actualizado_por }],
    actualizado_por: por, updated_at: ahora,
  }
}
