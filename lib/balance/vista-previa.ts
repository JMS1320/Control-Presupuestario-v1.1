/**
 * 👁️ La parte pura de la VISTA PREVIA DEL BALANCE (A-FEAT-1427): pasar el WorkBook a filas por solapa y reconocer
 * las filas que los papeles ya marcaron como problema. La pantalla es `components/vista-previa-balance.tsx`.
 */
import * as XLSX from "xlsx"

/** Los textos con los que los papeles marcan un problema. Una fila con cualquiera de éstos es una alerta. */
const MARCAS_DE_ALERTA = [/⚠️/, /\bNO CIERRA\b/i, /\bNO CUADRA\b/i, /\bNO COINCIDE\b/i, /FALTA EL PRECIO/i, /\bFALTA\b/, /sin dato/i, /SIN MOVIMIENTOS CARGADOS/i, /ABIERTO/]
/** Una fila con alguna marca de problema. Las que arrancan con ✓ (un control que cerró) no cuentan. */
export function esFilaDeAlerta(fila: unknown[]): boolean {
  const texto = fila.map(c => (c == null ? "" : String(c))).join(" · ").trim()
  if (!texto) return false
  if (/^(CONTROL )?✓/.test(texto) && !/⚠️|NO CIERRA|NO CUADRA/i.test(texto)) return false
  return MARCAS_DE_ALERTA.some(r => r.test(texto))
}

export interface SolapaPrevia {
  nombre: string
  filas: unknown[][]
  alertas: number
}

/** De un WorkBook a filas por solapa, con sus alertas contadas. Pura: la usa también el caso de prueba. */
export function solapasDelLibro(wb: XLSX.WorkBook): SolapaPrevia[] {
  return wb.SheetNames.map(nombre => {
    const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], { header: 1, raw: false, defval: "" })
    return { nombre, filas, alertas: filas.filter(esFilaDeAlerta).length }
  })
}

