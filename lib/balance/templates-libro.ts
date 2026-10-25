/**
 * 🧾 EL LIBRO DIARIO DE LOS TEMPLATES — A-FEAT-1184.
 *
 * Pedido del usuario 2026-09-28: *«los templates deberían generar su propio libro diario ya que yo
 * lo daba en los excels… así que replicar formato de libro diario con los templates sería bueno»*.
 *
 * ## Por qué van APARTE y no adentro del libro diario de compras
 *
 * Porque **no entran por subdiario**: no tienen factura de ARCA. Son los impuestos, los seguros,
 * el inmobiliario, los sueldos — lo que él venía informando en planillas separadas. Es justamente
 * la razón de ser de la distinción `cuenta contable` / `template` en la app.
 *
 * ## ⚠️ Y por eso el CORTE DEL PERÍODO es distinto, que es lo que hay que tener presente
 *
 * Las compras se cortan por **el subdiario en el que entraron**. Un template **no tiene subdiario**,
 * así que se corta por **fecha de pago, y si no la tiene, por fecha estimada**. Son dos criterios
 * distintos conviviendo en el mismo ejercicio — no está mal, pero **tiene que decirse**, porque un
 * lector que asume un solo criterio saca conclusiones equivocadas cuando los números no atan.
 *
 * ## Dos vistas, porque él usaba las dos
 *
 * 1. **Detalle**, fila por cuota, con el formato del libro diario.
 * 2. **Por mes**: `concepto × los 12 meses`, con débitos y créditos y subtotales — que es
 *    **literalmente** la forma de su planilla *«detalle completo gastos bancarios e impuestos por
 *    mes»* (verificada 2026-09-28: filas de concepto, columnas jul→jun, «Suma de Débitos / Suma de
 *    Créditos» y un total del ejercicio al final).
 */
import type { Ejercicio } from "./ejercicio"
import { resolverTipo, type TipoCuenta } from "@/lib/presupuesto/templates"

/**
 * 🗂️ **QUÉ ES cada cuota: egreso, ingreso, distribución, financiero…** (A-FEAT-1342, 2026-10-24).
 *
 * Usuario: *«el reporte de templates habría que separarlo entre egresos, ingresos, financiero, etc.,
 * así es más fácil procesarlos»*. Hasta acá la solapa sumaba todo junto, y en 25/26 eso metía como
 * «gasto» $784 M de FCI, $121 M de plazo fijo, la caja y el pago de las tarjetas (que además duplica
 * los consumos) → A-BUG-1340.
 *
 * El tipo sale con **la misma regla que el presupuesto** (`resolverTipo`): manda el `tipo` del template
 * y, si no lo tiene, el de su categoría en el plan de cuentas. **No se adivina por el signo**: si no hay
 * ninguno de los dos, la cuota va a «sin clasificar», a la vista, para que alguien le ponga el tipo.
 *
 * Por ahora se muestran **todos los responsables** (usuario: *«ayudará a ver tema de aportes y
 * retiros… más adelante sólo reportaremos el responsable en cuestión»*).
 */
export type TipoTemplate = TipoCuenta | "sin clasificar"
/** El orden en que se presentan los grupos. */
export const ORDEN_TIPOS: TipoTemplate[] = ["egreso", "ingreso", "distribucion", "financiero", "NO", "sin clasificar"]
export const NOMBRE_TIPO: Record<TipoTemplate, string> = {
  egreso: "EGRESOS — gasto del ejercicio",
  ingreso: "INGRESOS",
  distribucion: "DISTRIBUCIONES — retiros y aportes de socios",
  financiero: "FINANCIERO — no es gasto: FCI, plazo fijo, caja, pago de tarjeta, transferencias",
  NO: "NO — fuera del resultado",
  "sin clasificar": "SIN CLASIFICAR — el template no tiene tipo y su categoría no está en el plan",
}
const tipoDe = (c: { tipo?: TipoTemplate }): TipoTemplate => c.tipo ?? "sin clasificar"

export interface TotalPorTipo {
  tipo: TipoTemplate
  cuotas: number
  totalDebitos: number
  totalCreditos: number
  totalNeto: number
}

/** Una cuota de template, ya normalizada desde `cuotas_egresos_sin_factura` + su egreso. */
export interface CuotaTemplate {
  id: string
  /** La que manda para el período: `fecha_pago` y, si falta, `fecha_estimada`. */
  fecha: string | null
  /** Qué es. Sale de `nombre_referencia` del template. */
  concepto: string
  proveedor: string
  /** La categoría contable. Es el eje del resumen por mes. */
  categ: string
  cuenta_contable: string
  nro_cuenta: string
  centro_costo: string
  responsable: string
  estado: string
  /** Positivo = egreso. Negativo = devolución o ajuste a favor. */
  monto: number
  /** Qué es (A-FEAT-1342). Sin dato = «sin clasificar». */
  tipo?: TipoTemplate
}

export interface FilaPorMes {
  /** Qué es: el primer eje de la solapa (A-FEAT-1342). */
  tipo: TipoTemplate
  /**
   * 🔑 **Quién responde por el gasto** (MSA · PAM · MA · MSA/PAM).
   *
   * Pedido del usuario 2026-09-29, revisando el export: *«templates sin desglosar por responsable»*.
   * Es el eje que le falta al resumen: **un mismo concepto lo puede pagar cualquiera de las tres
   * empresas**, y el papel que él informa aparte va separado por quién lo pagó.
   */
  responsable: string
  categ: string
  /** 12 posiciones, en el orden de los subdiarios del ejercicio. */
  debitos: number[]
  creditos: number[]
  /**
   * 🧾 **El SALDO del mes: débito − crédito, en una sola columna.**
   *
   * Pedido del usuario el mismo día: *«template x mes siguen con 2 columnas deb y cred en vez de
   * saldado»*. Con dos columnas por mes la tabla tiene 24 columnas de importes y **hay que restar a
   * ojo** para saber cuánto costó cada concepto. Los débitos y créditos se conservan acá abajo porque
   * el detalle los necesita, pero **la vista por mes va saldada**.
   */
  neto: number[]
  totalDebitos: number
  totalCreditos: number
  totalNeto: number
}

export interface TemplatesDelEjercicio {
  detalle: CuotaTemplate[]
  porMes: FilaPorMes[]
  /** Etiquetas de las 12 columnas: `jul-25`, `ago-25`… */
  columnas: string[]
  totalDebitos: number
  totalCreditos: number
  /** Cuotas del ejercicio **sin categoría contable**: no se pueden ubicar en el balance. */
  sinCategoria: CuotaTemplate[]
  /** Cuotas **sin fecha de ningún tipo**: no se pueden asignar a un período. */
  sinFecha: CuotaTemplate[]
  /**
   * 🛑 **Las DESACTIVADAS del ejercicio: NO son gasto** (A-BUG-1289).
   *
   * Un impuesto que se puede pagar anual o en cuotas tiene dos templates; el que no se usa queda
   * `desactivado` — y su importe suele ser una estimación (`$20.941.123`). Hasta el 2026-10-18 el
   * libro las sumaba igual: **35 cuotas por $57,7 M** en el 25/26 de MSA, el inmobiliario de Rojas
   * contado dos veces. Ahora quedan afuera del gasto **y se listan** (§ 🧮 nada se descarta en silencio).
   */
  noIncluidas: CuotaTemplate[]
  totalNoIncluidas: number
  /**
   * 💳 **Las IMPAGAS del ejercicio: son gasto Y deuda al cierre**, igual que una factura impaga
   * (usuario 2026-10-18: *«las cuotas pendientes deberán figurar como deuda al igual que las
   * facturas»*). Siguen dentro del gasto —venció en el ejercicio— y además van al papel 04.
   */
  impagasAlCierre: CuotaTemplate[]
  totalImpagas: number
  /**
   * 🧮 Los totales por tipo, en `ORDEN_TIPOS` (sólo los que tienen cuotas). **Control**: la suma de
   * los grupos tiene que dar el total general — si no, una cuota quedó afuera o contada dos veces.
   */
  porTipo: TotalPorTipo[]
}

/** Estados que dicen «esta cuota no se usa»: no es gasto. */
export const ESTADOS_TEMPLATE_EXCLUIDOS = ["desactivado"]
/** Estados que dicen «esta cuota no se pagó»: gasto del ejercicio y deuda al cierre. */
export const ESTADOS_TEMPLATE_IMPAGOS = ["pendiente", "pagar", "preparado", "programado"]

const n = (v: unknown): number => {
  const x = typeof v === "string" ? parseFloat(v) : (v as number)
  return Number.isFinite(x) ? x : 0
}
const s = (v: unknown): string => (v == null ? "" : String(v))

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

/**
 * Fila cruda (cuota + egreso embebido) → cuota normalizada.
 * @param tipoDeCateg el `tipo` del plan de cuentas por categoría (el respaldo si el template no lo tiene).
 */
export function desdeCuota(f: Record<string, unknown>, tipoDeCateg?: Record<string, TipoCuenta | null | undefined>): CuotaTemplate {
  const e = (f.egreso ?? {}) as Record<string, unknown>
  const categ = s(f.categ) || s(e.categ)
  const r = resolverTipo((e.tipo as TipoCuenta | null) || null, tipoDeCateg?.[categ] ?? null)
  return {
    tipo: r.origen === "signo" ? "sin clasificar" : r.tipo,
    id: s(f.id),
    // 🔑 El orden importa: lo pagado manda sobre lo estimado. Ver el § del encabezado.
    fecha: f.fecha_pago ? s(f.fecha_pago).slice(0, 10)
         : f.fecha_estimada ? s(f.fecha_estimada).slice(0, 10) : null,
    concepto: s(e.nombre_referencia) || s(f.descripcion) || s(f.detalle),
    proveedor: s(e.proveedor) || s(e.nombre_quien_cobra),
    categ: s(f.categ) || s(e.categ),
    cuenta_contable: s(f.cuenta_contable) || s(e.codigo_contable),
    nro_cuenta: s(f.nro_cuenta),
    centro_costo: s(f.centro_costo) || s(e.centro_costo),
    responsable: s(e.responsable),
    estado: s(f.estado),
    monto: n(f.monto),
  }
}

/**
 * Arma las dos vistas del ejercicio.
 *
 * 📌 **Los que no entran no se tiran**: una cuota sin categoría o sin fecha va a su propia lista,
 * no desaparece del reporte (§ 🧮 *nada se descarta en silencio*).
 */
export function armarTemplatesDelEjercicio(
  cuotas: CuotaTemplate[],
  ej: Ejercicio,
): TemplatesDelEjercicio {
  const columnas = ej.subdiarios.map(x => `${MES_CORTO[x.mes - 1]}-${String(x.anio).slice(-2)}`)
  // `2025-07` → 0, `2026-06` → 11. Así la columna se ubica sin pensar en el cruce de año.
  const posicion = new Map(
    ej.subdiarios.map((x, i) => [`${x.anio}-${String(x.mes).padStart(2, "0")}`, i]),
  )

  const detalle: CuotaTemplate[] = []
  const sinFecha: CuotaTemplate[] = []
  const noIncluidas: CuotaTemplate[] = []
  const excluida = (c: CuotaTemplate) => ESTADOS_TEMPLATE_EXCLUIDOS.includes((c.estado || "").toLowerCase())
  for (const c of cuotas) {
    // Una desactivada sin fecha no es un hueco: no se iba a usar igual.
    if (!c.fecha) { if (!excluida(c)) sinFecha.push(c); continue }
    if (!posicion.has(c.fecha.slice(0, 7))) continue
    // Lo que cae fuera del ejercicio es de otro período: no se reporta, no es un hueco.
    if (excluida(c)) { noIncluidas.push(c); continue }      // A-BUG-1289: no es gasto, pero se ve
    detalle.push(c)
  }
  const impagasAlCierre = detalle.filter(c => ESTADOS_TEMPLATE_IMPAGOS.includes((c.estado || "").toLowerCase()))

  const sinCategoria = detalle.filter(c => !c.categ)

  /** La clave es **responsable + categoría**: el mismo concepto lo puede pagar más de una empresa. */
  const filas = new Map<string, FilaPorMes>()
  for (const c of detalle) {
    const categ = c.categ || "(sin categoría)"
    const responsable = c.responsable || "(sin responsable)"
    const tipo = tipoDe(c)
    const clave = `${tipo}|${responsable}|${categ}`
    if (!filas.has(clave)) {
      filas.set(clave, {
        tipo, responsable, categ,
        debitos: new Array(12).fill(0), creditos: new Array(12).fill(0),
        neto: new Array(12).fill(0),
        totalDebitos: 0, totalCreditos: 0, totalNeto: 0,
      })
    }
    const fila = filas.get(clave)!
    const i = posicion.get(c.fecha!.slice(0, 7))!
    // Positivo = egreso = débito. Negativo = devolución = crédito, y se guarda en positivo para
    // que la columna de créditos se lea como en su planilla.
    if (c.monto >= 0) { fila.debitos[i] += c.monto; fila.totalDebitos += c.monto }
    else { fila.creditos[i] += -c.monto; fila.totalCreditos += -c.monto }
    // El saldado: lo que el concepto costó ese mes, de una sola pasada.
    fila.neto[i] += c.monto
    fila.totalNeto += c.monto
  }

  const redondear = (x: number) => Math.round(x * 100) / 100
  const porMes = [...filas.values()]
    .map(f => ({
      ...f,
      debitos: f.debitos.map(redondear), creditos: f.creditos.map(redondear),
      neto: f.neto.map(redondear),
      totalDebitos: redondear(f.totalDebitos), totalCreditos: redondear(f.totalCreditos),
      totalNeto: redondear(f.totalNeto),
    }))
    // Ordenado por tipo, después por responsable y, dentro de cada uno, por lo que más pesa.
    .sort((a, b) => ORDEN_TIPOS.indexOf(a.tipo) - ORDEN_TIPOS.indexOf(b.tipo)
      || a.responsable.localeCompare(b.responsable, "es") || b.totalNeto - a.totalNeto)

  const porTipo: TotalPorTipo[] = ORDEN_TIPOS.map(tipo => {
    const del = porMes.filter(f => f.tipo === tipo)
    return {
      tipo, cuotas: detalle.filter(c => tipoDe(c) === tipo).length,
      totalDebitos: redondear(del.reduce((x, f) => x + f.totalDebitos, 0)),
      totalCreditos: redondear(del.reduce((x, f) => x + f.totalCreditos, 0)),
      totalNeto: redondear(del.reduce((x, f) => x + f.totalNeto, 0)),
    }
  }).filter(t => t.cuotas > 0)

  return {
    detalle, porMes, columnas,
    totalDebitos: redondear(porMes.reduce((x, f) => x + f.totalDebitos, 0)),
    totalCreditos: redondear(porMes.reduce((x, f) => x + f.totalCreditos, 0)),
    sinCategoria, sinFecha,
    noIncluidas, totalNoIncluidas: redondear(noIncluidas.reduce((x, c) => x + c.monto, 0)),
    impagasAlCierre, totalImpagas: redondear(impagasAlCierre.reduce((x, c) => x + c.monto, 0)),
    porTipo,
  }
}
