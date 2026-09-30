import { hoyArgentina } from "@/lib/fechas"
export function convertExcelNumber(value: string | number): number {
  if (typeof value === "number") return value

  let stringValue = value.toString().trim()

  // Verificar si está entre paréntesis (número negativo)
  const isNegative = stringValue.startsWith("(") && stringValue.endsWith(")")
  if (isNegative) {
    stringValue = stringValue.slice(1, -1) // Remover paréntesis
  }

  // Convertir formato argentino: coma decimal, punto miles
  // Ejemplo: "1.234,56" -> 1234.56
  stringValue = stringValue.replace(/\./g, "") // Remover puntos (separadores de miles)
  stringValue = stringValue.replace(",", ".") // Convertir coma a punto decimal

  const number = Number.parseFloat(stringValue) || 0
  return isNegative ? -number : number
}

export function convertExcelDate(value: any): string | null {
  if (!value) return null

  let date: Date

  if (typeof value === "number") {
    // Excel almacena fechas como números (días desde 1900-01-01)
    date = new Date((value - 25569) * 86400 * 1000)
  } else if (typeof value === "string") {
    date = new Date(value)
  } else if (value instanceof Date) {
    date = value
  } else {
    return null
  }

  if (isNaN(date.getTime())) return null

  // Formato YYYY-MM-DD para Supabase
  return date.toISOString().split("T")[0]
}

/**
 * ⚠️ **Hoy nadie la llama** (verificado 2026-09-30), pero se arregló igual: comparaba contra el día
 * en **UTC**, así que después de las 21:00 hora argentina decía que «hoy» era mañana. Dejarla con el
 * bug es dejar una trampa armada para el primero que la use (A-OP-23).
 */
export function isToday(dateString: string): boolean {
  return dateString === hoyArgentina()
}
