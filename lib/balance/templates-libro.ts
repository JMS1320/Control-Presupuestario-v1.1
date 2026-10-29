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
import { normalizar } from "./cuentas-corrientes"

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
  /**
   * 💳 De ese neto, lo que todavía NO se pagó al cierre (A-FEAT-1388). Usuario 27/10, en la solapa:
   * *«¿muestran lo pagado o lo pendiente también?»* — las dos cosas, y ahora se dice cuánto es cada una.
   */
  totalPendiente: number
}

/**
 * 🏢 **El orden de los responsables: primero la empresa del balance** (A-FEAT-1388). Usuario 27/10:
 * *«si es MSA primero MSA, luego MA, luego PAM»*. Después las combinadas (MSA/PAM…) y al final las
 * que no tienen responsable.
 */
export function ordenDeResponsables(empresa?: string): (r: string) => number {
  const base = ["MSA", "MA", "PAM"]
  const lista = empresa && base.includes(empresa) ? [empresa, ...base.filter(x => x !== empresa)] : base
  return (r: string) => {
    const i = lista.indexOf(r)
    if (i >= 0) return i
    return !r || r.startsWith("(sin") ? 99 : 50
  }
}

/** Lo que el armado necesita saber de afuera. Todo opcional: sin esto, sale como antes. */
export interface OpcionesTemplates {
  /** La empresa del balance: sus cuotas van primero. */
  empresa?: string
  /**
   * 🗂️ El plan de cuentas, para **agrupar por totalizadora** (usuario 27/10: *«mejorar orden,
   * agrupadoras»*) y para **unir la misma cuenta escrita distinto** (`SEGUROS ESTRUCTURA` y
   * `Seguros Estructura` salían en dos filas).
   */
  plan?: Array<{ categ: string; nro_cuenta?: string | null; nombre_totalizadora?: string | null }>
  /**
   * 🛡️ Los templates vinculados a una PÓLIZA (`polizas_seguro.template_id`). Usuario 27/10, sobre
   * SEGUROS ESTRUCTURA: *«esto lo tenemos en facturas y cta cte así que acá no entraría, porque es a
   * fines de conciliar esta cuenta por tema cuotas… MA deberá ser igual que MSA con las pólizas de
   * Chubb»*. Sus cuotas no son gasto acá: ya lo son por la factura de la aseguradora.
   * 🔑 Se decide por el VÍNCULO con la póliza, no por el nombre de la categoría: un seguro cuyas
   * facturas todavía no están cargadas (el Chalet de MA, Chubb) sigue contando hasta que se cargue.
   */
  templatesConPoliza?: Iterable<string>
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
  /**
   * Positivo = plata que SALIÓ (débito). Negativo = plata que ENTRÓ (crédito): un ingreso, un rescate,
   * una devolución del banco.
   * ⚠️ cambió 2026-10-27 (A-FEAT-1388): hasta acá el importe se tomaba siempre como salida, aunque la
   * cuota dijera que fue un ingreso — ver `desdeCuota`.
   */
  monto: number
  /** Qué es (A-FEAT-1342). Sin dato = «sin clasificar». */
  tipo?: TipoTemplate
  /** El template del que sale la cuota (`egreso_id`). Hace falta para saber si es de una póliza. */
  egresoId?: string
  /** La agrupadora del TEMPLATE («Impuestos General», «Gastos Bancarios»…), no la del plan. Ver `esImpuesto`. */
  agrupadoraTemplate?: string
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
  /**
   * 🗂️ La totalizadora del plan de cuentas (A-FEAT-1388). Las que no están en el plan van juntas en
   * `SIN_AGRUPADORA`, al final y a la vista.
   */
  agrupadora: string
  /** El número del plan (`nro_cuenta`), para ordenar como el plan. Vacío si no está en el plan. */
  nroCuenta: string
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
  /**
   * 🛡️ Las cuotas de templates vinculados a una póliza (A-FEAT-1388): **fuera del gasto** porque ya
   * están en las facturas de la aseguradora y en su cuenta corriente (papel 14). Se listan.
   */
  enFacturas: CuotaTemplate[]
  totalEnFacturas: number
  /** Con qué se armó (para partirlo en Impuestos / Otros sin volver a leer). */
  entrada?: { cuotas: CuotaTemplate[]; ej: Ejercicio; opciones: OpcionesTemplates }
}

/** Donde van las categorías que no están en el plan de cuentas. */
export const SIN_AGRUPADORA = "(sin agrupadora en el plan de cuentas)"

/**
 * Compara dos números del plan (`422113`, `4221`) como texto, que respeta la jerarquía: `4221` va
 * antes que `422113` y los dos antes que `5…`. `"~"` = sin número: va al final.
 */
function compararNro(a: string, b: string): number {
  if (a === b) return 0
  if (a === "~") return 1
  if (b === "~") return -1
  return a < b ? -1 : 1
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
  /**
   * 🔑 **¿La plata entró o salió?** Lo dice la cuota (`tipo_movimiento`), y la conciliación lo carga
   * igual que el banco: las 127 cuotas de MSA atadas a un crédito del extracto dicen «ingreso».
   * 🧨 Hasta el 2026-10-27 el importe se tomaba siempre como salida: en 25/26 eran **195 cuotas por
   * $659,5 M** del lado equivocado (rescates de FCI, Promoción Galicia en la columna Débito) y **10
   * devoluciones de egresos sumando como gasto** — las 3 del impuesto al cheque ($14.872,34) eran la
   * diferencia entre Templates, el papel 08 y el 08.1 (A-FEAT-1388).
   */
  const entro = s(f.tipo_movimiento).trim().toLowerCase() === "ingreso"
  return {
    tipo: r.origen === "signo" ? "sin clasificar" : r.tipo,
    egresoId: s(f.egreso_id) || undefined,
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
    monto: entro ? -n(f.monto) : n(f.monto),
    agrupadoraTemplate: s(e.cuenta_agrupadora) || undefined,
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
  opciones: OpcionesTemplates = {},
): TemplatesDelEjercicio {
  const columnas = ej.subdiarios.map(x => `${MES_CORTO[x.mes - 1]}-${String(x.anio).slice(-2)}`)
  // `2025-07` → 0, `2026-06` → 11. Así la columna se ubica sin pensar en el cruce de año.
  const posicion = new Map(
    ej.subdiarios.map((x, i) => [`${x.anio}-${String(x.mes).padStart(2, "0")}`, i]),
  )
  const conPoliza = new Set(opciones.templatesConPoliza ?? [])
  const ordenResp = ordenDeResponsables(opciones.empresa)
  /** La cuenta del plan por categoría NORMALIZADA: `Seguros Estructura` = `SEGUROS ESTRUCTURA`. */
  const delPlan = new Map((opciones.plan ?? []).map(p => [normalizar(p.categ), p]))

  const detalle: CuotaTemplate[] = []
  const sinFecha: CuotaTemplate[] = []
  const noIncluidas: CuotaTemplate[] = []
  const enFacturas: CuotaTemplate[] = []
  const excluida = (c: CuotaTemplate) => ESTADOS_TEMPLATE_EXCLUIDOS.includes((c.estado || "").toLowerCase())
  const impaga = (c: CuotaTemplate) => ESTADOS_TEMPLATE_IMPAGOS.includes((c.estado || "").toLowerCase())
  for (const c of cuotas) {
    // Una desactivada sin fecha no es un hueco: no se iba a usar igual.
    if (!c.fecha) { if (!excluida(c)) sinFecha.push(c); continue }
    if (!posicion.has(c.fecha.slice(0, 7))) continue
    // Lo que cae fuera del ejercicio es de otro período: no se reporta, no es un hueco.
    if (excluida(c)) { noIncluidas.push(c); continue }      // A-BUG-1289: no es gasto, pero se ve
    // 🛡️ A-FEAT-1388: ya es gasto por la factura de la aseguradora. Fuera del total, pero se lista.
    if (c.egresoId && conPoliza.has(c.egresoId)) { enFacturas.push(c); continue }
    detalle.push(c)
  }
  // Mismo orden en las dos solapas: tipo → responsable (la empresa del balance primero) → fecha.
  detalle.sort((a, b) =>
    ORDEN_TIPOS.indexOf(tipoDe(a)) - ORDEN_TIPOS.indexOf(tipoDe(b))
    || ordenResp(a.responsable) - ordenResp(b.responsable)
    || (a.responsable || "").localeCompare(b.responsable || "", "es")
    || (a.fecha ?? "").localeCompare(b.fecha ?? "")
    || a.concepto.localeCompare(b.concepto, "es"))
  /**
   * 💳 La deuda al cierre: lo que salía y no salió. 🔑 Un ingreso pendiente (monto negativo) NO es
   * deuda — es plata a cobrar — y por eso no va al papel 04 (en 25/26 no hay ninguno).
   */
  const impagasAlCierre = detalle.filter(c => impaga(c) && c.monto > 0)

  const sinCategoria = detalle.filter(c => !c.categ)

  /** La clave es **responsable + categoría**: el mismo concepto lo puede pagar más de una empresa. */
  const filas = new Map<string, FilaPorMes>()
  for (const c of detalle) {
    const cuenta = c.categ ? delPlan.get(normalizar(c.categ)) : undefined
    // 🔑 Con la categoría escrita como en el plan, las dos grafías de la misma cuenta van a una fila.
    const categ = cuenta?.categ || c.categ || "(sin categoría)"
    const responsable = c.responsable || "(sin responsable)"
    const tipo = tipoDe(c)
    const clave = `${tipo}|${responsable}|${normalizar(categ)}`
    if (!filas.has(clave)) {
      filas.set(clave, {
        tipo, responsable, categ,
        agrupadora: cuenta?.nombre_totalizadora?.trim() || SIN_AGRUPADORA,
        nroCuenta: cuenta?.nro_cuenta?.trim() || "",
        debitos: new Array(12).fill(0), creditos: new Array(12).fill(0),
        neto: new Array(12).fill(0),
        totalDebitos: 0, totalCreditos: 0, totalNeto: 0,
      })
    }
    const fila = filas.get(clave)!
    const i = posicion.get(c.fecha!.slice(0, 7))!
    // Positivo = salió = débito. Negativo = entró (ingreso, rescate, devolución) = crédito, y se
    // guarda en positivo para que la columna de créditos se lea como en su planilla.
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
  /**
   * 🗂️ El orden de las agrupadoras: el del plan (por el número más chico de sus cuentas). Las que no
   * están en el plan, al final.
   */
  const ordenAgrupadora = new Map<string, string>()
  for (const f of porMes) {
    if (f.agrupadora === SIN_AGRUPADORA || !f.nroCuenta) continue
    const ya = ordenAgrupadora.get(f.agrupadora)
    if (!ya || compararNro(f.nroCuenta, ya) < 0) ordenAgrupadora.set(f.agrupadora, f.nroCuenta)
  }
  const claveAgrupadora = (a: string) => a === SIN_AGRUPADORA ? "~" : (ordenAgrupadora.get(a) ?? "~")
  // Tipo → responsable (la empresa del balance primero) → agrupadora (orden del plan) → cuenta.
  porMes.sort((a, b) => ORDEN_TIPOS.indexOf(a.tipo) - ORDEN_TIPOS.indexOf(b.tipo)
    || ordenResp(a.responsable) - ordenResp(b.responsable)
    || a.responsable.localeCompare(b.responsable, "es")
    || compararNro(claveAgrupadora(a.agrupadora), claveAgrupadora(b.agrupadora))
    || a.agrupadora.localeCompare(b.agrupadora, "es")
    // Adentro de la agrupadora: el orden del plan; sin número (fuera del plan), lo que más pesa.
    || compararNro(a.nroCuenta || "~", b.nroCuenta || "~")
    || b.totalNeto - a.totalNeto)

  const porTipo: TotalPorTipo[] = ORDEN_TIPOS.map(tipo => {
    const del = porMes.filter(f => f.tipo === tipo)
    return {
      tipo, cuotas: detalle.filter(c => tipoDe(c) === tipo).length,
      totalDebitos: redondear(del.reduce((x, f) => x + f.totalDebitos, 0)),
      totalCreditos: redondear(del.reduce((x, f) => x + f.totalCreditos, 0)),
      totalNeto: redondear(del.reduce((x, f) => x + f.totalNeto, 0)),
      totalPendiente: redondear(detalle.filter(c => tipoDe(c) === tipo && impaga(c)).reduce((x, c) => x + c.monto, 0)),
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
    enFacturas, totalEnFacturas: redondear(enFacturas.reduce((x, c) => x + c.monto, 0)),
    entrada: { cuotas, ej, opciones },
  }
}

/**
 * 🧾 ¿Es un IMPUESTO? JMS 29/10 (A-FEAT-1422 nota 10): *«las pestañas que se llamen impuestos y otros»*.
 * Manda la agrupadora del template: todas las «Impuestos …» (General, Rurales, Urbanos, Automotores, Buenos Aires,
 * Bancarios); sin agrupadora, la categoría («Impuesto IIBB», «Impuestos Laborales ARCA»). Todo lo demás —gastos
 * bancarios, inversiones, retiros, fijos, seguros, tarjetas— va a «Otros».
 */
export function esImpuesto(c: CuotaTemplate): boolean {
  const ag = (c.agrupadoraTemplate ?? "").trim().toLowerCase()
  if (ag) return ag.startsWith("impuesto")
  return /^impuesto/i.test(c.categ.trim())
}

/**
 * Parte el ejercicio en IMPUESTOS y OTROS: las mismas cuotas, el mismo armado, en dos. **Control**: los dos totales
 * suman el del ejercicio entero. `null` si el armado no guardó su entrada.
 */
export function partirEnImpuestosYOtros(t: TemplatesDelEjercicio): { impuestos: TemplatesDelEjercicio; otros: TemplatesDelEjercicio } | null {
  if (!t.entrada) return null
  const { cuotas, ej, opciones } = t.entrada
  return {
    impuestos: armarTemplatesDelEjercicio(cuotas.filter(esImpuesto), ej, opciones),
    otros: armarTemplatesDelEjercicio(cuotas.filter(c => !esImpuesto(c)), ej, opciones),
  }
}
