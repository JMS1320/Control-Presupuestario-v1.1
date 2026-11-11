/**
 * 🔎 BUSCAR EN TODAS LAS CUENTAS A LA VEZ — la lógica (A-FEAT-1594, JMS 11/11: «que en extractos bancarios yo pueda buscar,
 * por ejemplo, Inmobiliario Lima y me muestre el pago de MA que le hizo de su cuenta, como así el pago de MSA… como yo puedo
 * buscar lo que se le pagó a Alcorta y me muestre desde todas las cuentas que se le pagó… para auditar»).
 *
 * Varias palabras = TODAS tienen que aparecer en el movimiento, en cualquier campo y en cualquier orden («inmobiliario lima»,
 * «alcorta 10») — es también lo que pedía A-FEAT-1599 («Ministerio + Débito»): «débito» / «crédito» como palabra se leen como
 * el lado del movimiento.
 *
 * El componente es `components/buscador-todas-las-cuentas.tsx`. Acá lo que se puede probar sin base.
 */

/** Sin mayúsculas, sin acentos, con los espacios repetidos reducidos a uno. */
export function normalizarParaBuscar(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

const ES_LADO = /^(debitos?|creditos?)$/

/** Las palabras de la búsqueda. Se aceptan espacios o «+» como separador. */
export function palabrasDeBusqueda(texto: string): string[] {
  return normalizarParaBuscar(texto.replace(/\+/g, " ")).split(" ").filter(Boolean)
}

/**
 * La palabra que se le manda a la BASE para traer candidatos (la más larga que sea texto: un número o «débito» no sirven
 * para un `ilike` sobre la descripción). `null` = no hay ninguna → hay que escribir algún texto.
 */
export function palabraParaLaBase(palabras: string[]): string | null {
  const texto = palabras.filter(p => !ES_LADO.test(p) && !/^[\d.,$-]+$/.test(p) && p.length >= 2)
  if (!texto.length) return null
  return [...texto].sort((a, b) => b.length - a.length)[0]
}

/** Las columnas de texto de un movimiento donde se busca. */
export const CAMPOS_DE_TEXTO = ["descripcion", "detalle", "categ", "proveedor_nombre", "leyendas_adicionales_1", "leyendas_adicionales_2",
  "comprobantes_pagados", "concepto", "contable", "interno", "nota_operador"] as const

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** ¿El movimiento tiene TODAS las palabras? Mira el texto, los importes (como 1234,5 · 1.234,50 · 1234.5) y el lado. */
export function coincideConTodas(mov: Record<string, unknown>, palabras: string[]): boolean {
  if (!palabras.length) return false
  const deb = Number(mov.debitos) || 0, cre = Number(mov.creditos) || 0
  const importes = [deb, cre].filter(n => n).flatMap(n => [String(n), fmt(n), fmt(n).replace(/\./g, "")])
  const texto = normalizarParaBuscar([...CAMPOS_DE_TEXTO.map(k => mov[k]), ...importes].filter(x => x != null && x !== "").join(" | "))
  return palabras.every(p => {
    if (/^debitos?$/.test(p)) return deb > 0
    if (/^creditos?$/.test(p)) return cre > 0
    return texto.includes(p)
  })
}

/** Limpia una palabra para meterla en un filtro `or()` de la base (sin comas, paréntesis ni comodines). */
export function palabraSegura(p: string): string {
  return p.replace(/[,()%*\\]/g, " ").trim()
}
