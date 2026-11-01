/**
 * 📚 **EL SET DE LIBROS DEL BALANCE — A, B, C, D y E, en un .zip** — A-FEAT-1505 (JMS 01/11).
 *
 * JMS renombró las solapas del Excel con una letra: *«las A quiero que sean un Excel, las B un segundo Excel, la C es un
 * tercer Excel que no está hoy, y el resto iría al libro D… y el de saldos [stocks] un Excel aparte: sería el libro E. La
 * descarga vía .rar(zip), así tengo siempre todo el set parejo»*.
 *
 * | Libro | Qué es (JMS) | Qué lleva |
 * |---|---|---|
 * | **A** | terminado, a último chequeo | los subdiarios: Compras, Ventas y sus «por cuenta» |
 * | **B** | bien encaminado, confirmar datos de José | 03 y 04 (con 03.1, 04.1, 04.2) y 14 Cuentas corrientes |
 * | **C** | lo que precisa para trabajar ahora | templates por responsable (listado, cuotas, por mes) + el detalle de impuestos y gastos bancarios, intereses e inversiones |
 * | **D** | el resto, que se va viendo | todas las demás solapas |
 * | **E** | los saldos | «00 Stocks inicio y cierre» |
 *
 * 🔑 **Se arma UNA vez y se reparte**: el mismo `armarWorkbook` de siempre (más las hojas del C) y cada solapa va al libro
 * de su letra, con su formato. Así los cinco no pueden dar números distintos al Excel completo. Ninguna fórmula apunta a
 * otra solapa (verificado al armarlo), así que repartir no rompe nada.
 */
import XLSX from "xlsx-js-style"
import type { CuentaDelPlan, MovimientoExtracto } from "./papeles-bancarios"
import { buscarCuenta } from "./papeles-bancarios"
import type { CuotaTemplate, TemplatesDelEjercicio } from "./templates-libro"
import { armarTemplatesDelEjercicio } from "./templates-libro"

export type LetraLibro = "A" | "B" | "C" | "D" | "E"

export const LIBROS: Record<LetraLibro, string> = {
  A: "A - Subdiarios (terminado)",
  B: "B - Deudas, créditos y cuentas corrientes (confirmar)",
  C: "C - Templates y detalle bancario (para trabajar)",
  D: "D - El resto",
  E: "E - Stocks inicio y cierre",
}

const DE_A = new Set(["Compras", "Ventas", "Compras por cuenta", "Ventas por cuenta"])
const DE_B = new Set(["04 Cuentas a pagar", "04.1 Cheques dados", "04.2 Anticipos", "03 Cuentas a cobrar", "03.1 Provision cobros", "14 Cuentas corrientes"])
const DE_E = new Set(["00 Stocks inicio y cierre"])

/** A qué libro va una solapa (por su nombre en el Excel completo). Las del C empiezan con «C · ». */
export function libroDeSolapa(nombre: string): LetraLibro {
  if (DE_A.has(nombre)) return "A"
  if (DE_B.has(nombre)) return "B"
  if (DE_E.has(nombre)) return "E"
  if (nombre.startsWith("C · ")) return "C"
  return "D"
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// El detalle bancario del libro C
// ══════════════════════════════════════════════════════════════════════════════════════════

export type GrupoDetalle = "Impuestos bancarios" | "Gastos bancarios" | "Intereses" | "Inversiones"

export interface MovimientoDelDetalle {
  grupo: GrupoDetalle
  cuenta: string
  fecha: string
  descripcion: string
  categ: string
  /** El concepto del plan de cuentas, si se encontró. */
  concepto: string
  debitos: number
  creditos: number
  moneda: "ARS" | "USD"
}

const INVERSIONES = /^(plazo fijo|fci|moneda extranjera)$/i

/**
 * Pura: cada movimiento del extracto que es impuesto o gasto bancario (por la totalizadora del plan), interés (categoría
 * INTERESES) o inversión (FCI, plazo fijo, compraventa de dólares), con su grupo. Los de las cuentas en dólares, en dólares.
 */
export function detalleBancarioDelLibroC(
  pesos: Array<MovimientoExtracto & { donde: string }>,
  dolares: Array<MovimientoExtracto & { donde: string }>,
  plan: CuentaDelPlan[],
  esFCI: (m: MovimientoExtracto) => boolean,
): MovimientoDelDetalle[] {
  const out: MovimientoDelDetalle[] = []
  const uno = (m: MovimientoExtracto & { donde: string }, moneda: "ARS" | "USD") => {
    const cta = buscarCuenta(m, plan)
    const tot = cta?.nombre_totalizadora ?? ""
    const categ = String(m.categ ?? "")
    const grupo: GrupoDetalle | null =
      tot === "IMPUESTOS BANCARIOS" ? "Impuestos bancarios"
      : tot === "GASTOS BANCARIOS" ? "Gastos bancarios"
      : /^intereses$/i.test(categ.trim()) ? "Intereses"
      : esFCI(m) || INVERSIONES.test(categ.trim()) ? "Inversiones"
      // 💵 en la cuenta en dólares, lo que va al broker es compraventa de dólares
      : moneda === "USD" && /securities|gsec/i.test(String(m.descripcion ?? "")) ? "Inversiones"
      : null
    if (!grupo) return
    out.push({ grupo, cuenta: m.donde, fecha: String(m.fecha ?? "").slice(0, 10), descripcion: String(m.descripcion ?? ""),
      categ, concepto: cta?.cuenta_contable ?? "", debitos: Number(m.debitos ?? 0) || 0, creditos: Number(m.creditos ?? 0) || 0, moneda })
  }
  for (const m of pesos) uno(m, "ARS")
  for (const m of dolares) uno(m, "USD")
  return out.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.cuenta.localeCompare(b.cuenta) || a.fecha.localeCompare(b.fecha))
}

/** Una solapa de detalle: un renglón por movimiento, subtotal por cuenta y moneda. */
export function hojaDeDetalle(grupo: GrupoDetalle, movs: MovimientoDelDetalle[], etiqueta: string): unknown[][] {
  const f: unknown[][] = [[`${grupo.toUpperCase()} — detalle movimiento por movimiento, ejercicio ${etiqueta}`],
    ["Sale del extracto de cada cuenta. Las cuentas en dólares, EN DÓLARES (no se suman a los pesos)."], [],
    ["Cuenta", "Moneda", "Fecha", "Descripción", "Categoría", "Concepto del plan", "Débito", "Crédito"]]
  const deEste = movs.filter(m => m.grupo === grupo)
  if (!deEste.length) { f.push(["(no hay movimientos de este tipo en el ejercicio)"]); return f }
  const cuentas = [...new Set(deEste.map(m => `${m.cuenta}|${m.moneda}`))]
  for (const k of cuentas) {
    const [cuenta, moneda] = k.split("|")
    const ms = deEste.filter(m => m.cuenta === cuenta && m.moneda === moneda)
    const desde = f.length + 1
    for (const m of ms) f.push([m.cuenta, m.moneda, m.fecha, m.descripcion, m.categ, m.concepto, m.debitos || "", m.creditos || ""])
    const hasta = f.length
    const s = (k2: "debitos" | "creditos") => Math.round(ms.reduce((t, m) => t + m[k2], 0) * 100) / 100
    f.push([`Subtotal ${cuenta} (${moneda})`, "", "", `${ms.length} movimiento(s)`, "", "",
      { t: "n", f: `SUM(G${desde}:G${hasta})`, v: s("debitos") }, { t: "n", f: `SUM(H${desde}:H${hasta})`, v: s("creditos") }])
    f.push([])
  }
  return f
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// Los templates por responsable del libro C
// ══════════════════════════════════════════════════════════════════════════════════════════

/** El responsable al que va cada cuota: el primero nombrado («MSA/PAM» → MSA). */
export const responsablePrincipal = (r: string) => (r || "").split("/")[0].trim().toUpperCase() || "(sin responsable)"

/** Los templates de un responsable, re-armados con la misma función que el libro (mismos números). */
export function templatesDeResponsable(t: TemplatesDelEjercicio, responsable: string): TemplatesDelEjercicio | null {
  if (!t.entrada) return null
  const { cuotas, ej, opciones } = t.entrada
  const suyas = cuotas.filter(c => responsablePrincipal(c.responsable) === responsable)
  return suyas.length ? armarTemplatesDelEjercicio(suyas, ej, opciones) : null
}

/** El LISTADO: un renglón por template de la campaña, con sus cuotas del ejercicio y el total. */
export function hojaListadoTemplates(t: TemplatesDelEjercicio, responsable: string, etiqueta: string): unknown[][] {
  const f: unknown[][] = [[`TEMPLATES DE ${responsable} — la lista de la campaña, ejercicio ${etiqueta}`],
    ["Un renglón por template. Cuotas = las del ejercicio (las desactivadas no cuentan, como en el resto del libro)."], [],
    ["Concepto", "Proveedor", "Tipo", "Agrupadora", "Categoría", "Cuenta contable", "Responsable", "Cuotas", "Pagadas", "Pendientes", "Total (débito − crédito)"]]
  const porTemplate = new Map<string, CuotaTemplate[]>()
  for (const c of t.detalle) {
    const k = c.egresoId || `${c.concepto}|${c.proveedor}`
    porTemplate.set(k, [...(porTemplate.get(k) ?? []), c])
  }
  const filas = [...porTemplate.values()].map(cs => {
    const c = cs[0]
    const pagadas = cs.filter(x => /pagad|conciliad/i.test(x.estado || "")).length
    return [c.concepto, c.proveedor, c.tipo ?? "", c.agrupadoraTemplate ?? "", c.categ, c.cuenta_contable, c.responsable,
      cs.length, pagadas, cs.length - pagadas, Math.round(cs.reduce((s, x) => s + x.monto, 0) * 100) / 100]
  }).sort((a, b) => String(a[3]).localeCompare(String(b[3])) || String(a[0]).localeCompare(String(b[0])))
  const desde = f.length + 1
  f.push(...filas)
  f.push(["TOTAL", "", "", "", "", "", "", "", "", "", { t: "n", f: `SUM(K${desde}:K${f.length})`, v: Math.round(filas.reduce((s, x) => s + Number(x[10]), 0) * 100) / 100 }])
  return f
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// El reparto y el .zip
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Reparte las solapas de un libro armado en los cinco libros, con la vista (formato) de cada una. */
export function repartirEnLibros<V>(wb: XLSX.WorkBook, vistas: V[]): { letra: LetraLibro; wb: XLSX.WorkBook; vistas: V[]; solapas: string[] }[] {
  const out = new Map<LetraLibro, { wb: XLSX.WorkBook; vistas: V[]; solapas: string[] }>()
  wb.SheetNames.forEach((nombre, i) => {
    const letra = libroDeSolapa(nombre)
    const l = out.get(letra) ?? { wb: XLSX.utils.book_new(), vistas: [], solapas: [] }
    XLSX.utils.book_append_sheet(l.wb, wb.Sheets[nombre], nombre)
    l.vistas.push(vistas[i])
    l.solapas.push(nombre)
    out.set(letra, l)
  })
  return (["A", "B", "C", "D", "E"] as LetraLibro[]).filter(k => out.has(k)).map(letra => ({ letra, ...out.get(letra)! }))
}
