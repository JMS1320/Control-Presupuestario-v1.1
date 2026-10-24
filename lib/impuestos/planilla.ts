/**
 * 🧾 PLANILLA DE IMPUESTOS — un año calendario, una fila por impuesto y empresa (A-FEAT-1320).
 *
 * Pedido del usuario 2026-10-23: *«si alguien me dice dame el reporte de los impuestos, le tengo que
 * poder dar un export… ver lo pagado, lo pendiente y los compromisos futuros en una sola vista»*.
 *
 * El dato son las CUOTAS de los templates de impuestos — el mismo criterio que el aviso de Principal
 * (`esImpuesto` de `vencimientos.ts`), para que los dos den lo mismo.
 *
 * | Pregunta | Respuesta |
 * |---|---|
 * | ¿qué fila? | **impuesto + empresa**. Los impuestos que van por partida o por vehículo (inmobiliario, complementario, Red Vial, automotores, ABL) se juntan por su `categ`: una fila «Inmobiliario · MSA», no una por campo. El resto, por el nombre del template sin «Cuota» / «Anual» (UATRE, Cargas Sociales, Autónomos MA, IIBB Mensual MSA…) |
 * | ¿en qué mes cae? | el del vencimiento de la cuota; si falta, el de la estimada |
 * | ¿qué año? | **calendario** (aunque el template sea de campaña 25/26): el del vencimiento |
 * | ¿cómo está? | `conciliado` → **conciliada** · `pagado` / `debito` / `anterior` / `echeq` / `programado` → **pagada** · `pendiente` / `pagar` / `preparado` → **sin pagar** (presupuestada). `desactivado` no entra |
 * | ¿adeudado o futuro? | una cuota sin pagar con vencimiento **anterior a hoy** es adeudada; desde hoy, compromiso futuro |
 *
 * ⚠️ Las cuotas SIN PAGAR de un template **inactivo** no suman (igual que en el aviso): un template
 * que se dio de baja dejó cuotas que ya no se van a pagar. Las pagadas sí, porque son historia.
 * ⚠️ cambió 2026-10-23 (usuario: *«podrían mostrarse pero colapsadas las desactivadas para poder
 * chequear»*): ya no se descartan — van aparte en `desactivadas`, fuera de los totales.
 *
 * 🟠 `programado` y `echeq` cuentan como pagadas pero se MARCAN (`rara`). Usuario 2026-10-23: *«si algo
 * la app lo encuentra en programado o echeq lo muestre así para llamar la atención ya que es raro»*.
 *
 * 🏢 El ABL compartido (responsable «PAM/MA/Duhau») se muestra en **MA** (usuario 2026-10-23).
 */
import { esImpuesto } from "./vencimientos"
import { ordenarColumnas } from "@/lib/cashflow/columnas-usuario"

export type EstadoPlanilla = "conciliada" | "pagada" | "sin-pagar"

export interface CuotaPlanilla {
  id: string
  estado: string
  fecha_vencimiento: string | null
  fecha_estimada: string | null
  fecha_pago?: string | null
  monto: number | null
  numero_cuota?: number | null
  detalle?: string | null
  template: {
    id?: string
    nombre_referencia: string | null
    responsable: string | null
    cuenta_agrupadora: string | null
    categ: string | null
    solo_conciliacion?: boolean | null
    activo?: boolean | null
  }
}

export interface CeldaCuota {
  id: string
  template: string
  vencimiento: string
  monto: number
  estado: EstadoPlanilla
  estadoOriginal: string
  vencida: boolean
  /** `programado` o `echeq`: cuenta como pagada pero es raro en un impuesto → se marca. */
  rara: boolean
  numero_cuota: number | null
}

export interface FilaPlanilla {
  clave: string
  impuesto: string
  empresa: string
  /** Los 12 meses (0 = enero), con las cuotas que vencen en cada uno. */
  meses: CeldaCuota[][]
  pagado: number
  adeudado: number
  futuro: number
  total: number
  /** Los templates que forman la fila (para el detalle). */
  templates: string[]
}

export interface Planilla {
  anio: number
  filas: FilaPlanilla[]
  porEmpresa: Array<{ empresa: string; pagado: number; adeudado: number; futuro: number; total: number }>
  totales: { pagado: number; adeudado: number; futuro: number; total: number }
  /** Años en los que hay alguna cuota, para las flechas (y para decir «no hay datos»). */
  aniosConDatos: number[]
  /** § 🧮 — los meses suman el total de cada fila y las filas el total general. */
  control: { cierra: boolean; diferencias: string[] }
  /** Cuotas sin pagar de templates dados de baja: se muestran colapsadas y NO suman. */
  desactivadas: FilaPlanilla[]
  /** Cuántas cuotas del año están en `programado` o `echeq` (para el aviso). */
  raras: number
}

/** Estados que cuentan como pagados pero en un impuesto llaman la atención. */
const ESTADOS_RAROS = new Set(["programado", "echeq"])

/** La empresa de la fila: la del template, salvo el ABL compartido («PAM/MA/Duhau»), que va a MA. */
export function empresaDePlanilla(t: CuotaPlanilla["template"], impuesto: string): string {
  const r = (t.responsable ?? "").trim()
  if (impuesto === "ABL" && r.includes("/") && /\bMA\b/.test(r)) return "MA"
  return r || "—"
}

const ESTADO: Record<string, EstadoPlanilla | null> = {
  conciliado: "conciliada",
  pagado: "pagada", debito: "pagada", anterior: "pagada", echeq: "pagada", programado: "pagada",
  pendiente: "sin-pagar", pagar: "sin-pagar", preparado: "sin-pagar",
  desactivado: null,
}

export function estadoDePlanilla(estado: string | null | undefined): EstadoPlanilla | null {
  const e = String(estado ?? "").trim().toLowerCase()
  return e in ESTADO ? ESTADO[e] : "sin-pagar"
}

/** Los impuestos que se cargan por partida o por vehículo: se juntan por su `categ`. */
const POR_CATEG: Array<[RegExp, string]> = [
  [/complementario/i, "Inmobiliario Complementario"],
  [/inmobiliario/i, "Inmobiliario"],
  [/red\s*vial/i, "Red Vial"],
  [/automotor/i, "Automotores"],
  [/^abl\b/i, "ABL"],
]

/** El nombre de la fila: «Inmobiliario», «Red Vial», «UATRE», «Cargas Sociales»… */
export function impuestoDeTemplate(t: CuotaPlanilla["template"]): string {
  for (const [re, nombre] of POR_CATEG) if (re.test(t.categ ?? "")) return nombre
  const nombre = (t.nombre_referencia ?? t.categ ?? "Impuesto")
    .replace(/\b(cuota|anual)\b/gi, " ").replace(/\s+/g, " ").trim()
  return nombre || "Impuesto"
}

const redondear = (n: number) => Math.round(n * 100) / 100

export function armarPlanilla(cuotas: CuotaPlanilla[], anio: number, hoy: string): Planilla {
  const filas = new Map<string, FilaPlanilla>()
  const bajas = new Map<string, FilaPlanilla>()
  const anios = new Set<number>()
  let raras = 0

  for (const c of cuotas) {
    if (!esImpuesto(c.template)) continue
    const estado = estadoDePlanilla(c.estado)
    if (!estado) continue
    const deBaja = estado === "sin-pagar" && c.template.activo === false
    const venc = (c.fecha_vencimiento ?? c.fecha_estimada ?? "").slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(venc)) continue
    const a = Number(venc.slice(0, 4))
    if (!deBaja) anios.add(a)
    if (a !== anio) continue

    const impuesto = impuestoDeTemplate(c.template)
    const empresa = empresaDePlanilla(c.template, impuesto)
    const clave = `${impuesto}|${empresa}`
    const destino = deBaja ? bajas : filas
    let fila = destino.get(clave)
    if (!fila) {
      fila = { clave, impuesto, empresa, meses: Array.from({ length: 12 }, () => []), pagado: 0, adeudado: 0, futuro: 0, total: 0, templates: [] }
      destino.set(clave, fila)
    }
    const rara = ESTADOS_RAROS.has(String(c.estado ?? "").trim().toLowerCase())
    if (rara) raras++
    const nombreTpl = c.template.nombre_referencia ?? impuesto
    if (!fila.templates.includes(nombreTpl)) fila.templates.push(nombreTpl)
    const monto = Number(c.monto ?? 0)
    const vencida = estado === "sin-pagar" && venc < hoy
    fila.meses[Number(venc.slice(5, 7)) - 1].push({
      id: c.id, template: nombreTpl, vencimiento: venc, monto, estado, estadoOriginal: c.estado, vencida, rara, numero_cuota: c.numero_cuota ?? null,
    })
    if (estado !== "sin-pagar") fila.pagado += monto
    else if (vencida) fila.adeudado += monto
    else fila.futuro += monto
  }

  const cerrar = (f: FilaPlanilla) => {
    f.pagado = redondear(f.pagado); f.adeudado = redondear(f.adeudado); f.futuro = redondear(f.futuro)
    f.total = redondear(f.pagado + f.adeudado + f.futuro)
    f.meses.forEach(m => m.sort((x, y) => x.vencimiento.localeCompare(y.vencimiento)))
    f.templates.sort()
    return f
  }
  const porNombre = (x: FilaPlanilla, y: FilaPlanilla) => x.empresa.localeCompare(y.empresa) || x.impuesto.localeCompare(y.impuesto)
  const lista = [...filas.values()].map(cerrar).sort(porNombre)
  const desactivadas = [...bajas.values()].map(cerrar).sort(porNombre)

  const empresas = new Map<string, { empresa: string; pagado: number; adeudado: number; futuro: number; total: number }>()
  for (const f of lista) {
    const e = empresas.get(f.empresa) ?? { empresa: f.empresa, pagado: 0, adeudado: 0, futuro: 0, total: 0 }
    e.pagado += f.pagado; e.adeudado += f.adeudado; e.futuro += f.futuro; e.total += f.total
    empresas.set(f.empresa, e)
  }
  const porEmpresa = [...empresas.values()].map(e => ({ empresa: e.empresa, pagado: redondear(e.pagado), adeudado: redondear(e.adeudado), futuro: redondear(e.futuro), total: redondear(e.total) }))
  const totales = {
    pagado: redondear(lista.reduce((s, f) => s + f.pagado, 0)),
    adeudado: redondear(lista.reduce((s, f) => s + f.adeudado, 0)),
    futuro: redondear(lista.reduce((s, f) => s + f.futuro, 0)),
    total: redondear(lista.reduce((s, f) => s + f.total, 0)),
  }

  // § 🧮 — el camino inverso: sumar celda por celda y comparar con los totales de cada fila.
  const diferencias: string[] = []
  for (const f of lista) {
    const porMeses = redondear(f.meses.flat().reduce((s, c) => s + c.monto, 0))
    if (Math.abs(porMeses - f.total) > 0.01) diferencias.push(`${f.impuesto} · ${f.empresa}: meses ${porMeses} ≠ total ${f.total}`)
  }
  const porEmpresas = redondear(porEmpresa.reduce((s, e) => s + e.total, 0))
  if (Math.abs(porEmpresas - totales.total) > 0.01) diferencias.push(`empresas ${porEmpresas} ≠ total ${totales.total}`)

  return {
    anio, filas: lista, porEmpresa, totales,
    aniosConDatos: [...anios].sort((a, b) => a - b),
    control: { cierra: diferencias.length === 0, diferencias },
    desactivadas, raras,
  }
}

/**
 * El orden de las filas que dejó el usuario arrastrándolas (`preferencias.ordenImpuestos`).
 * Una clave guardada que ya no existe se ignora; una fila nueva entra en su lugar natural. Es el
 * mismo mecanismo que las columnas del Cash Flow (`ordenarColumnas`), que pide `key`.
 */
export function ordenarFilas(filas: FilaPlanilla[], orden: readonly string[]): FilaPlanilla[] {
  return ordenarColumnas(filas.map(f => ({ key: f.clave, fila: f })), orden).map(x => x.fila)
}

export { moverColumna as moverFila } from "@/lib/cashflow/columnas-usuario"
