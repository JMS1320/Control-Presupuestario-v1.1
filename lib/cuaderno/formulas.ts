/**
 * 🧮 **Las fórmulas de las tablas del cuaderno** — A-FEAT-1410 (piloto).
 *
 * Lo mínimo de una planilla, con el idioma de acá: números con coma decimal y punto de miles
 * («1.234,56»), y funciones en castellano o inglés — `SUMA`/`SUM`, `PROMEDIO`/`AVERAGE`, `MIN`, `MAX`,
 * `CONTAR`/`COUNT`. Referencias tipo `B3`, rangos `B2:B5`, + − × ÷ y paréntesis.
 * Una celda que empieza con «=» es fórmula; si no, se muestra tal cual (y si es número, cuenta como número).
 * Un error no rompe la tabla: la celda muestra «#ERROR» o «#CICLO».
 */
import { parseNumeroAR } from "@/lib/format/numero"

export type Valor = number | string

const esNumeroAR = (s: string) => /^-?[\d.]+(,\d+)?$/.test(s.trim()) || /^-?\d+(\.\d+)?$/.test(s.trim())

/** «B3» → { fila: 2, col: 1 } (base 0) */
export function referencia(ref: string): { fila: number; col: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase())
  if (!m) return null
  let col = 0
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { fila: Number(m[2]) - 1, col: col - 1 }
}

/** 0 → «A», 26 → «AA» */
export function letraColumna(c: number): string {
  let s = ""
  let n = c + 1
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}

const FUNCIONES: Record<string, (xs: number[]) => number> = {
  SUMA: xs => xs.reduce((a, b) => a + b, 0), SUM: xs => xs.reduce((a, b) => a + b, 0),
  PROMEDIO: xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0), AVERAGE: xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0),
  MIN: xs => (xs.length ? Math.min(...xs) : 0), MAX: xs => (xs.length ? Math.max(...xs) : 0),
  CONTAR: xs => xs.length, COUNT: xs => xs.length,
}

/** Calcula toda la tabla: devuelve los valores a mostrar. */
export function calcularTabla(celdas: string[][]): Valor[][] {
  const memo = new Map<string, Valor>()
  const enCurso = new Set<string>()

  const valorDe = (f: number, c: number): Valor => {
    const k = `${f},${c}`
    if (memo.has(k)) return memo.get(k)!
    if (enCurso.has(k)) return "#CICLO"
    const crudo = (celdas[f]?.[c] ?? "").trim()
    let v: Valor
    if (crudo.startsWith("=")) {
      enCurso.add(k)
      try { v = evaluar(crudo.slice(1)) } catch (e) { v = (e as Error).message === "#CICLO" ? "#CICLO" : "#ERROR" }
      enCurso.delete(k)
    } else if (crudo !== "" && esNumeroAR(crudo)) {
      v = parseNumeroAR(crudo)
    } else v = crudo
    memo.set(k, v)
    return v
  }

  const numeroDe = (f: number, c: number): number | null => {
    const v = valorDe(f, c)
    if (v === "#CICLO") throw new Error("#CICLO")
    if (typeof v === "number") return v
    if (typeof v === "string" && v.startsWith("#")) throw new Error(v)
    return null
  }

  function evaluar(expr: string): number {
    let i = 0
    const s = expr.replace(/\s+/g, "")
    const ver = () => s[i]
    const exp = (): number => {
      let v = term()
      while (ver() === "+" || ver() === "-") { const op = s[i++]; const w = term(); v = op === "+" ? v + w : v - w }
      return v
    }
    const term = (): number => {
      let v = factor()
      while (ver() === "*" || ver() === "/") {
        const op = s[i++]; const w = factor()
        if (op === "/" && w === 0) throw new Error("#ERROR")
        v = op === "*" ? v * w : v / w
      }
      return v
    }
    const factor = (): number => {
      if (ver() === "-") { i++; return -factor() }
      if (ver() === "+") { i++; return factor() }
      if (ver() === "(") { i++; const v = exp(); if (s[i++] !== ")") throw new Error("#ERROR"); return v }
      const num = /^\d+([.,]\d+)?/.exec(s.slice(i))
      if (num) { i += num[0].length; return Number(num[0].replace(",", ".")) }
      const id = /^[A-Za-z]+\d*/.exec(s.slice(i))
      if (!id) throw new Error("#ERROR")
      const nombre = id[0].toUpperCase()
      i += id[0].length
      if (ver() === "(") {
        i++
        const fn = FUNCIONES[nombre]
        if (!fn) throw new Error("#ERROR")
        const xs: number[] = []
        while (ver() !== ")") {
          const rango = /^([A-Za-z]+\d+):([A-Za-z]+\d+)/.exec(s.slice(i))
          if (rango) {
            i += rango[0].length
            const a = referencia(rango[1]), b = referencia(rango[2])
            if (!a || !b) throw new Error("#ERROR")
            for (let f = Math.min(a.fila, b.fila); f <= Math.max(a.fila, b.fila); f++)
              for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) { const n = numeroDe(f, c); if (n !== null) xs.push(n) }
          } else xs.push(exp())
          if (ver() === ";" || ver() === ",") i++
          else if (ver() !== ")") throw new Error("#ERROR")
        }
        i++
        return fn(xs)
      }
      const r = referencia(nombre)
      if (!r) throw new Error("#ERROR")
      return numeroDe(r.fila, r.col) ?? 0
    }
    const v = exp()
    if (i !== s.length) throw new Error("#ERROR")
    return v
  }

  return celdas.map((fila, f) => fila.map((_, c) => valorDe(f, c)))
}

/** Cómo se muestra un valor: números en es-AR con hasta 2 decimales. */
export const mostrarValor = (v: Valor) =>
  typeof v === "number" ? v.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : v
