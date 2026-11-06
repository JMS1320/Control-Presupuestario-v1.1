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
 * | **B** | bien encaminado, confirmar datos de José | 03 y 04 (con 04.1, 04.2, 04.3) y 14 · 14.1 Cuentas corrientes — la provisión de cobros (03.1) va al D, junto al 05 (JMS 04/11) |
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
import { hojaResumenPorMes } from "./resumen-por-mes"

export type LetraLibro = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"

export const LIBROS: Record<LetraLibro, string> = {
  A: "A - Subdiarios (terminado)",
  B: "B - Deudas, créditos y cuentas corrientes (confirmar)",
  C: "C - Templates y detalle bancario (para trabajar)",
  D: "D - El resto",
  E: "E - Stocks inicio y cierre",
  F: "F - Balance en linea",
  G: "G - Grupos de templates (propuesta)",
  H: "H - Egresos con boleta, extracto y demás liquidaciones",
  // 👥 JMS 04/11: «cuentas con socios y Libertad también van a próximo excel: salen de deudas y se van a otros».
  I: "I - Socios y Libertad (próximo)",
}

const DE_A = new Set(["Compras", "Ventas", "Compras por cuenta", "Ventas por cuenta"])
const DE_B = new Set(["04 Cuentas a pagar", "04.1 Cheques dados", "04.2 Anticipos", "04.3 Respaldo cuentas a pagar", "03 Cuentas a cobrar", "14 Cuentas corrientes"])
const DE_E = new Set(["00 Stocks inicio y cierre"])
/** 👥 Lo que se manda después: las cuentas con los socios y Libertad (JMS 04/11). */
const DE_I = new Set(["14.1 Cuentas con socios", "Gastos Libertad"])

/** A qué libro va una solapa (por su nombre en el Excel completo). Las del C empiezan con «C · ». */
export function libroDeSolapa(nombre: string): LetraLibro {
  if (DE_A.has(nombre)) return "A"
  if (DE_B.has(nombre)) return "B"
  if (DE_E.has(nombre)) return "E"
  if (DE_I.has(nombre) || nombre.startsWith("I · ")) return "I"
  if (nombre.startsWith("C · ")) return "C"
  if (nombre.startsWith("F · ")) return "F"
  if (nombre.startsWith("G · ")) return "G"
  if (nombre.startsWith("H · ")) return "H"
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
export function hojaDeDetalle(grupo: GrupoDetalle, movs: MovimientoDelDetalle[], etiqueta: string, empresa = "", meses: { clave: string; rotulo: string }[] = []): unknown[][] {
  // 🧮 A-FEAT-1511 + A-FEAT-1513 (JMS: «cada empresa toma el gasto de lo que pasa por sus resúmenes»; «por categ y por mes
  // siempre, con un Nro que referencia a la tabla de abajo»): resumen categoría × mes en pesos y en dólares, detalle con su Nro.
  const deEste = movs.filter(m => m.grupo === grupo)
  return hojaResumenPorMes(deEste.map(m => ({
    categoria: m.concepto || m.categ || "(sin categoría)", mes: m.fecha.slice(0, 7), importe: m.debitos - m.creditos, moneda: m.moneda,
    columnas: [m.cuenta, m.fecha, m.descripcion, m.categ, m.debitos || "", m.creditos || ""],
  })), {
    titulo: `${grupo.toUpperCase()}${empresa ? ` — ${empresa}` : ""} — ejercicio ${etiqueta}`,
    notas: [`Cuánto se pagó de cada concepto, mes por mes, sumando todos los resúmenes${empresa ? ` de ${empresa}` : ""} (cada empresa toma lo que pasa por sus resúmenes). Neto = débitos − créditos. Cada celda es fórmula sobre el detalle.`],
    meses, porMoneda: true, rotuloImporte: "Neto",
    encabezadoDetalle: ["Cuenta", "Fecha", "Descripción", "Categoría del extracto", "Débito", "Crédito"],
  })
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
    // JMS 06/11: «a este libro [I] hay que sacarle las filas inmovilizadas» — sus solapas son listas largas con varios bloques
    const v = vistas[i] as V & { congelarFilas?: number }
    l.vistas.push(letra === "I" && v && typeof v === "object" ? ({ ...v, congelarFilas: undefined } as V) : vistas[i])
    l.solapas.push(nombre)
    out.set(letra, l)
  })
  return (["A", "B", "C", "D", "E", "F", "G", "H", "I"] as LetraLibro[]).filter(k => out.has(k)).map(letra => ({ letra, ...out.get(letra)! }))
}

/** 🔎 A-FEAT-1506: el nombre del canal de pago (la tabla donde se encontró el movimiento) en palabras de la app. */
export function canalDePago(tabla: string | undefined | null): string | undefined {
  if (!tabla) return undefined
  const t = tabla.replace(/^public\./, "")
  const NOMBRES: Record<string, string> = {
    msa_galicia: "Banco Galicia (extracto)", "msa.santander": "Banco Santander (extracto)", "msa.provincia": "Banco Provincia (extracto)",
    "msa.tarjeta_visa_business": "Tarjeta Visa MSA (resumen)", "msa.caja_general": "Caja general", "msa.caja_ams": "Caja AMS",
    "msa.caja_sigot": "Caja Sigot", "msa.echeqs_terceros": "Echeqs de terceros", "msa.cc_usd": "Cuenta en dólares",
    pam_galicia: "PAM Galicia (extracto)", pam_galicia_cc: "PAM Galicia cta cte (extracto)", "ma.ma_galicia": "MA Galicia (extracto)",
  }
  return NOMBRES[t] ?? t
}

/**
 * 📒 A-FEAT-1509: la cuenta y la caja en dólares para el libro F. Pura: de los movimientos del ejercicio, el saldo en US$
 * antes del primero (saldo + débito − crédito), el neto y el saldo del último.
 */
export function dolaresParaBalance(cuentas: { cuenta: string; tipo: string; movs: MovimientoExtracto[] }[] | undefined, tc: { tc: number; fuente: string } | null) {
  if (!cuentas) return { dolares: null, cajaUsd: null }
  const banco = cuentas.find(c => c.tipo === "banco")
  const caja = cuentas.filter(c => c.tipo !== "banco")
  const n = (v: unknown) => Number(v ?? 0) || 0
  let dolares = null
  if (banco) {
    const ms = [...banco.movs].sort((a, b) => a.fecha.localeCompare(b.fecha) || n(a.orden) - n(b.orden))
    const pri = ms[0], ult = ms[ms.length - 1]
    dolares = {
      cuenta: banco.cuenta,
      usdInicio: pri && pri.saldo != null ? Math.round((n(pri.saldo) + n(pri.debitos) - n(pri.creditos)) * 100) / 100 : null,
      netoUsd: Math.round(ms.reduce((t, m) => t + n(m.creditos) - n(m.debitos), 0) * 100) / 100,
      usdCierre: ult && ult.saldo != null ? n(ult.saldo) : null,
      desde: pri?.fecha ?? null, hasta: ult?.fecha ?? null,
      tcCierre: tc?.tc ?? null, fuenteTc: tc?.fuente ?? "sin dólar al cierre",
    }
  }
  const movsCaja = caja.flatMap(c => c.movs)
  return { dolares, cajaUsd: { movimientos: movsCaja.length, netoUsd: movsCaja.reduce((t, m) => t + n(m.creditos) - n(m.debitos), 0) } }
}
