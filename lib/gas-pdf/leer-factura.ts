/**
 * 📄 LEER UNA FACTURA DEL TEXTO DE SU PDF — A-FEAT-1318 (usuario 2026-10-23: «seguí con cargar la
 * factura desde el PDF»).
 *
 * El texto ya lo tiene la app: es el que guardó el registro del archivo digital al leer la carpeta
 * («Vincular PDFs» de Subdiarios). Con eso se precarga el alta de una factura **No Informada** sin
 * armar un Excel.
 *
 * ## Las reglas del importador (CLAUDE.md § 📄), aplicadas acá
 * - **Nunca rechaza**: devuelve lo que pudo leer y en `noLeido` lo que no. Los PDF son de todo tipo
 *   —fotos de tiques, facturas de sistemas propios, OCR con letras cambiadas— y ninguno es «el formato».
 * - **Todo se corrige** en la pantalla de carga; lo leído queda al lado de lo cargado (la huella).
 *
 * ## Lo que NO intenta
 * - El número «4+4 pegado» (Río Tala `00132220`): sin guion no se distingue de cualquier otro número de
 *   8 cifras. Queda sin leer y se escribe a mano.
 * - El detalle por ítem: alcanza con los totales, que es lo que va al subdiario y al balance.
 *
 * Los casos salen de PDFs reales del registro (marzo 2026, MSA) → `lib/pruebas/casos.ts`.
 */
import { DATOS_FISCALES } from "@/lib/empresas"
import type { DatosCargaManual } from "@/lib/facturas/alta-factura"

export type Letra = "A" | "B" | "C" | "M"
export type Clase = "FC" | "ND" | "NC"

/** Los códigos de comprobante de ARCA que se pueden cargar a mano, con su letra y su clase. */
export const TIPOS_CARGABLES: Record<number, { letra: Letra; clase: Clase; desc: string }> = {
  1: { letra: "A", clase: "FC", desc: "Factura A" },
  2: { letra: "A", clase: "ND", desc: "Nota de Débito A" },
  3: { letra: "A", clase: "NC", desc: "Nota de Crédito A" },
  6: { letra: "B", clase: "FC", desc: "Factura B" },
  7: { letra: "B", clase: "ND", desc: "Nota de Débito B" },
  8: { letra: "B", clase: "NC", desc: "Nota de Crédito B" },
  11: { letra: "C", clase: "FC", desc: "Factura C" },
  12: { letra: "C", clase: "ND", desc: "Nota de Débito C" },
  13: { letra: "C", clase: "NC", desc: "Nota de Crédito C" },
  51: { letra: "M", clase: "FC", desc: "Factura M" },
  52: { letra: "M", clase: "ND", desc: "Nota de Débito M" },
  53: { letra: "M", clase: "NC", desc: "Nota de Crédito M" },
  81: { letra: "A", clase: "FC", desc: "Tique Factura A" },
  82: { letra: "B", clase: "FC", desc: "Tique Factura B" },
  111: { letra: "C", clase: "FC", desc: "Tique Factura C" },
}

/** El código de ARCA para una letra y una clase (Factura B → 6). */
export function codigoDeTipo(letra: Letra, clase: Clase): number {
  const e = Object.entries(TIPOS_CARGABLES).find(([c, t]) => t.letra === letra && t.clase === clase && Number(c) < 80)
  return e ? Number(e[0]) : 1
}

/** ¿Discrimina IVA? Sólo A y M. En B y C ARCA guarda únicamente el total (así están las de la base). */
export const discriminaIva = (tipo: number | null | undefined): boolean => {
  const t = tipo != null ? TIPOS_CARGABLES[tipo] : undefined
  return !t || t.letra === "A" || t.letra === "M"
}

export interface FacturaLeida {
  cuit: string | null
  denominacion: string | null
  tipo: number | null
  puntoVenta: number | null
  numero: number | null
  /** AAAA-MM-DD */
  fecha: string | null
  /** Siempre en positivo: el signo lo pone la clase (una NC se guarda en negativo al grabar). */
  total: number | null
  neto: number | null
  iva21: number | null
  iva105: number | null
  cae: string | null
  /** Si el PDF nombra a una de las empresas propias como receptora (para avisar si no es la elegida). */
  receptorCuit: string | null
  /** Los datos obligatorios que no se pudieron leer, en el lenguaje de la pantalla. */
  noLeido: string[]
}

// ── CUIT ────────────────────────────────────────────────────────────────────────────────────────
/** Dígito verificador de ARCA. Un número de 11 cifras que no lo cumple no es un CUIT (es un código de barras, un teléfono…). */
export function cuitValido(cuit: string): boolean {
  const d = cuit.replace(/\D/g, "")
  if (d.length !== 11) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0)
  let dv = 11 - (suma % 11)
  if (dv === 11) dv = 0
  if (dv === 10) dv = 9
  return dv === Number(d[10])
}

function cuitsDelTexto(texto: string): string[] {
  const vistos: string[] = []
  for (const m of texto.matchAll(/(?<!\d)(\d{2})[-.\s]?(\d{8})[-.\s]?(\d)(?!\d)/g)) {
    const c = m[1] + m[2] + m[3]
    if (cuitValido(c) && !vistos.includes(c)) vistos.push(c)
  }
  return vistos
}

// ── Importes ────────────────────────────────────────────────────────────────────────────────────
const IMPORTE = String.raw`-?\d{1,3}(?:[.,]\d{3})+[.,]\d{2}(?!\d)|-?\d+[.,]\d{2}(?!\d)`

/** «1.234,56», «1,234.56», «1234,56» y «1234.56» → 1234.56. El separador decimal es el que deja 2 cifras al final. */
export function parsearImporte(s: string): number | null {
  const t = s.replace(/\s/g, "")
  if (!/^-?[\d.,]+$/.test(t) || t.length < 4) return null
  const neg = t.startsWith("-")
  const sin = t.replace(/^-/, "")
  const entero = sin.slice(0, -3).replace(/[.,]/g, "")
  const n = parseFloat(`${entero || "0"}.${sin.slice(-2)}`)
  return isNaN(n) ? null : (neg ? -n : n)
}

function importesTras(texto: string, etiqueta: string): number[] {
  const re = new RegExp(`${etiqueta}\\s*:?\\s*\\$?\\s*(?<![\\d.,])(${IMPORTE})`, "gi")
  return [...texto.matchAll(re)].map(m => parsearImporte(m[1])).filter((n): n is number => n != null)
}

const mayorAbs = (ns: number[]): number | null =>
  ns.length ? ns.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)) : null

// ── Fecha ───────────────────────────────────────────────────────────────────────────────────────
function armarFecha(d: string, m: string, a: string): string | null {
  let anio: number
  // «30-03-2617:27:56» (Hernández): el año de 2 cifras pegado a la hora se lee como «2617».
  if (a.length === 4 && +a >= 2000 && +a <= 2099) anio = +a
  else if (a.length >= 2) anio = 2000 + Number(a.slice(0, 2))
  else return null
  const dia = +d, mes = +m
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

function fechaDelTexto(texto: string): string | null {
  const SEP = "[\\/\\-.∕]"
  const rotulada = texto.match(new RegExp(`Fecha(?:\\s+de\\s+Emisi[oó]n)?\\s*:?\\s*(\\d{1,2})${SEP}(\\d{1,2})${SEP}(\\d{2,4})`, "i"))
  if (rotulada) {
    const f = armarFecha(rotulada[1], rotulada[2], rotulada[3])
    if (f) return f
  }
  // Sin rótulo: la primera fecha que no sea de inicio de actividades ni un vencimiento.
  for (const m of texto.matchAll(new RegExp(`(?<!\\d)(\\d{1,2})${SEP}(\\d{1,2})${SEP}(\\d{4})(?!\\d)`, "g"))) {
    const antes = texto.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0)
    if (/inicio|vto|venc|hasta/i.test(antes)) continue
    const f = armarFecha(m[1], m[2], m[3])
    if (f) return f
  }
  return null
}

// ── Tipo y número ───────────────────────────────────────────────────────────────────────────────
function tipoDelTexto(texto: string): number | null {
  for (const m of texto.matchAll(/C[oó]d(?:igo|\.)?\s*(?:N[°ºo]?\s*)?:?\s*(?:[ABCM]\s+)?0*(\d{1,3})(?!\d)/gi)) {
    const c = Number(m[1])
    if (TIPOS_CARGABLES[c]) return c
  }
  const clase: Clase = /NOTA\s+DE\s+CR[EÉ]DITO|N\.\s*CR[EÉ]DITO/i.test(texto) ? "NC"
    : /NOTA\s+DE\s+D[EÉ]BITO|N\.\s*D[EÉ]BITO/i.test(texto) ? "ND" : "FC"
  const enFactura = texto.match(/FACTURA\s*"?([ABCM])"?(?![A-Za-z])/i)
  const sola = texto.split(/\r?\n/).map(l => l.trim()).find(l => /^[ABCM]$/.test(l))
  const letra = (enFactura?.[1]?.toUpperCase() || sola) as Letra | undefined
  return letra ? codigoDeTipo(letra, clase) : null
}

function numeroDelTexto(texto: string): { pv: number; nro: number } | null {
  const afip = texto.match(/Punto\s+de\s+Venta:?\s*(\d{1,5})\s*Comp\.?\s*Nro:?\s*(\d{1,8})/i)
  if (afip) return { pv: +afip[1], nro: +afip[2] }
  for (const m of texto.matchAll(/(?:^|[^\d-])(?:[ABCM]\s*-\s*)?(\d{4,5})\s*-\s*(\d{8})(?!\d)/gm)) {
    if (+m[1] === 0 && +m[2] === 0) continue
    return { pv: +m[1], nro: +m[2] }
  }
  return null
}

// ── Razón social ────────────────────────────────────────────────────────────────────────────────
const SOCIEDAD = /\b(S\.?\s?R\.?\s?L|S\.?\s?A\b|S\.?\s?H\b|S\.?A\.?I\.?C|SOCIEDAD|COOP)/i
const PROPIOS = ["martinez sobrado", "martinezsobrado", "mercedes areco", "placido"]

function denominacionDelTexto(texto: string): string | null {
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const linea = lineas.find(l => SOCIEDAD.test(l) && l.length <= 60
    && !/^(cliente|raz[oó]n social|se[nñ]or)/i.test(l)
    && !PROPIOS.some(p => l.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(p)))
  return linea ? linea.replace(/\s+/g, " ") : null
}

/**
 * Lo que dice el PDF de una factura. `cuitsPropios`: los de las empresas (se excluyen como emisor y
 * se informan como receptor).
 */
export function leerFacturaDelTexto(
  texto: string | null | undefined,
  cuitsPropios: readonly string[] = Object.values(DATOS_FISCALES).map(d => d.cuit).filter((c): c is string => !!c),
): FacturaLeida {
  const t = String(texto ?? "")
  const cuits = cuitsDelTexto(t)
  const cuit = cuits.find(c => !cuitsPropios.includes(c)) ?? null
  const receptorCuit = cuits.find(c => cuitsPropios.includes(c)) ?? null
  const tipo = tipoDelTexto(t)
  const num = numeroDelTexto(t)
  const fecha = fechaDelTexto(t)

  const rotulados = importesTras(t, "(?<![A-Za-zÀ-ÿ])TOTAL(?![A-Za-z])")
  const todos = [...t.matchAll(new RegExp(`(?<![\\d.,])(${IMPORTE})`, "g"))].map(m => parsearImporte(m[1])).filter((n): n is number => n != null)
  const totalCrudo = mayorAbs(rotulados) ?? mayorAbs(todos)
  const total = totalCrudo == null ? null : Math.abs(totalCrudo)

  let neto: number | null = null, iva21: number | null = null, iva105: number | null = null
  if (discriminaIva(tipo)) {
    neto = importesTras(t, "(?:SUBTOTAL|Importe\\s+Neto\\s+Gravado|Neto\\s+Gravado)").map(Math.abs)[0] ?? null
    iva21 = importesTras(t, "IVA\\s*21(?:[.,]0+)?\\s*%?").map(Math.abs)[0] ?? null
    iva105 = importesTras(t, "IVA\\s*10[.,]5\\s*%?").map(Math.abs)[0] ?? null
    if (iva21 == null && iva105 == null) {
      // «IVA: 61958,69» sin alícuota: se deduce del neto (21 % o 10,5 %); si no cierra con ninguna, va a 21 % y se corrige.
      const generico = mayorAbs(importesTras(t, "(?<![A-Za-z])IVA\\s*:"))
      if (generico != null) {
        const g = Math.abs(generico)
        if (neto != null && Math.abs(neto * 0.105 - g) <= Math.max(1, g * 0.005)) iva105 = g
        else iva21 = g
      }
    }
  }

  const cae = t.match(/C\.?A\.?E\.?[^\d]{0,30}(\d{14})(?!\d)/i)?.[1] ?? null
  const noLeido = [
    !cuit && "CUIT del proveedor",
    tipo == null && "tipo de comprobante",
    !num && "punto de venta y número",
    !fecha && "fecha",
    total == null && "total",
  ].filter((x): x is string => !!x)

  return {
    cuit, denominacion: denominacionDelTexto(t), tipo,
    puntoVenta: num?.pv ?? null, numero: num?.nro ?? null, fecha, total, neto, iva21, iva105, cae, receptorCuit, noLeido,
  }
}

/**
 * La precarga de la pantalla a partir de lo leído — y es también **lo leído** que viaja en la huella,
 * en la misma forma que lo cargado, para poder compararlos campo por campo.
 * El neto se reparte por alícuota con el IVA leído: si hay IVA de las dos, el de 10,5 % sale de su IVA.
 */
export function precargaDesdeLectura(l: FacturaLeida): DatosCargaManual {
  const neto = l.neto ?? 0
  const iva21 = l.iva21 ?? 0
  const iva105 = l.iva105 ?? 0
  let neto21 = 0, neto105 = 0
  if (iva105 > 0 && iva21 > 0) { neto105 = Math.round((iva105 / 0.105) * 100) / 100; neto21 = Math.round((neto - neto105) * 100) / 100 }
  else if (iva105 > 0) neto105 = neto
  else neto21 = neto
  return {
    cuit: l.cuit ?? "", denominacion: l.denominacion ?? "", tipo: l.tipo ?? 0,
    puntoVenta: l.puntoVenta ?? 0, numero: l.numero ?? 0, fecha: l.fecha ?? "",
    neto21, iva21, neto105, iva105, noGravado: 0, exento: 0, otrosTributos: 0,
    total: l.total ?? 0, cae: l.cae,
  }
}
