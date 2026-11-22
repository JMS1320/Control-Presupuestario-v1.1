/**
 * 👥 EL DASHBOARD «POR RESPONSABLE» — A-FEAT-1637 (JMS 22/11/2026). Lógica pura (sin base): la usan la pantalla, el Excel, el PDF
 * y los casos de `npm run probar`.
 *
 * JMS: *«la realidad de cómo viene el año y cuánto debo / me deben entre socios»*. El «Por caja» de siempre muestra lo que salió de
 * las cuentas de cada empresa; éste muestra **de quién es** cada peso. Cambia sólo quién se lleva cada movimiento: sumando las tres
 * empresas, el total es el mismo que «Por caja» (es el control).
 *
 * ── DE QUIÉN ES cada movimiento (`atribuir`) ─────────────────────────────────────────────────────────────────────────────
 * `pagador` = la empresa del canal. `responsable`, en este orden:
 *   1. El **código interno** cuando nombra a alguien («DIST MA», «CTA PAM», «RET 3 MA», «GASTO MSA», «AP 3 MSA»; «LIB» = MA).
 *      Si el interno está VACÍO manda el **contable** — es la regla 1 de la capa interna (`lib/balance/capa-interna.ts`: «interno
 *      vacío = lo real es igual al contable»); se leen con `destinoDeCodigo`, no hay otra interpretación de los códigos. Un interno
 *      que no nombra a nadie («DESGLOSAR», «VER») NO deja pasar al contable: se sigue con 2-5 y queda listado como «sin resolver».
 *      Un código de alguien que no es socio («DIST MECHI», «CTA TRABUCCO») no cuenta.
 *   2. **Libertad** (template de Libertad, sin la cochera ni Duhau): entera de MA en esta vista — el 50/50 es sólo del balance.
 *   3. El **responsable del template** (`egresos_sin_factura.responsable`; «MSA/PAM» → el primero, como el Excel de la cuenta).
 *   4. La **factura**: si el movimiento paga un comprobante de otra empresa (está en `pam.comprobantes_arca`…), es de esa empresa.
 *   5. El **sueldo**: el pago de un empleado es de la empresa del empleado.
 *   6. Si nada lo dice: de quien pagó.
 *
 * ── DÓNDE VA ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · De quien pagó (responsable = pagador) → en sus Ingresos / Egresos / Financieros / Distribuciones, igual que hoy.
 *   · Un gasto (o ingreso) de otro → en el responsable, en su sección y con «(pagó MSA)»; y en «Financiado por los socios ▸ MSA».
 *     En el que pagó → «Pagado por cuenta de socios ▸ el responsable ▸ agrupadora ▸ cuenta» (Libertad, un renglón con su detalle).
 *   · Una TRANSFERENCIA entre socios (movimiento financiero o distribución con otro socio en la otra punta) se cuenta UNA vez de cada
 *     lado, en el lado de cada canal: el que la manda la ve en «Pagado por cuenta de socios ▸ X ▸ Retiros directos», el que la recibe
 *     en «Financiado por los socios ▸ MSA ▸ canal ▸ Transferencias». Nunca se espeja.
 * Así, por empresa: secciones + financiado + pagado por cuenta = lo que se movió en SUS canales (su «Por caja»). Y entre todas, lo
 * mismo que «Por caja».
 *
 * ── LA CUENTA ENTRE SOCIOS (`cuentaEntreSocios`) ─────────────────────────────────────────────────────────────────────────
 * CLAUDE.md § 🧮 «la cuenta entre socios»: saldo inicial 31/12/2024 = 0, mes por mes, agrupada como en el balance (retiros directos ·
 * pagos por su cuenta por agrupadora → template · Libertad un renglón · aportes). Toma TODO lo «pagado por cuenta» de cada lado (lo
 * que sale de una caja para el otro); lo recibido es el espejo y no se suma (se compara en el control de pares).
 */
import { destinoDeCodigo, marcaDeLaNota } from "@/lib/balance/capa-interna"
import type { CuentaContable } from "@/lib/supabase"
import { EMPRESAS_DASHBOARD } from "./canales"
import { armarResumenFinanciero, clasificadorDashboard, type Clasificacion, type InfoTemplate, type ResumenFinanciero } from "./resumen"

/** Los socios que pueden ser responsables, en el orden del grupo (el de más arriba es el «acreedor» de la cuenta del par). */
export const SOCIOS_RESPONSABLES = ["MSA", "PAM", "MA", "JMS", "AMS", "COTITULARES"] as const
const RANGO = new Map<string, number>(SOCIOS_RESPONSABLES.map((s, i) => [s, i]))
const esEmpresa = (q: string) => (EMPRESAS_DASHBOARD as readonly string[]).includes(q)
const r2 = (n: number) => Math.round(n * 100) / 100

export type PorQue = "interno" | "contable" | "libertad" | "template" | "factura" | "sueldo" | "pagador"
export const RAZON: Record<PorQue, string> = {
  interno: "código interno", contable: "código contable (interno vacío)", libertad: "Libertad (entera de MA)",
  template: "responsable del template", factura: "la factura es de esa empresa", sueldo: "empleado de esa empresa", pagador: "quien pagó",
}

export interface ContextoResponsable {
  /** id del template → su responsable («MA», «MSA/PAM»…). */
  responsableTemplate: Map<string, string | null | undefined>
  /** id del comprobante → la empresa dueña («MSA», «PAM», «MA»). */
  empresaFactura: Map<string, string>
  /** id del pago de sueldo (o de su grupo) → la empresa del empleado. */
  empresaSueldo: Map<string, string>
}

const vacio = (x: string) => !x || /^no\s*lleva$/i.test(x) || x === "-"

/** El socio que nombra un código, o null. `soloPlata`: sólo CTA/DIST/RET/AP (para saber quién está en la otra punta de una transferencia). */
export function quienDelCodigo(codigo: string, soloPlata = false): string | null {
  if (vacio(String(codigo ?? "").trim())) return null
  const d = destinoDeCodigo(codigo)
  if (!d) return null
  if (d.tipo === "LIB") return soloPlata ? null : "MA"
  if (d.tipo === "CTA" || d.tipo === "DIST" || d.tipo === "RET" || d.tipo === "AP" || (d.tipo === "GASTO" && !soloPlata)) {
    const q = d.quien.toUpperCase()
    return RANGO.has(q) ? q : null
  }
  return null
}

export const esLibertadTemplate = (nombre?: string | null) => !!nombre && /libertad/i.test(nombre) && !/cochera|duhau/i.test(nombre)

export interface Atribucion {
  pagador: string
  responsable: string
  por: PorQue
  interno: string
  contable: string
  /** El otro socio que nombran los códigos (para una transferencia en la que el responsable es el propio pagador). */
  contraparte: string | null
  /** El interno dice «DESGLOSAR» / «VER»: no dice de quién es. Se atribuye por los pasos siguientes y se lista. */
  sinResolver: boolean
  esLibertad: boolean
}

/** De quién es un movimiento. `mov._empresa` = la empresa del canal. */
export function atribuir(mov: any, ctx: ContextoResponsable, nombreTemplate?: string | null): Atribucion {
  const pagador = String(mov._empresa ?? "").toUpperCase()
  const nota = mov.nota_operador as string | null | undefined
  const interno = String(mov.interno ?? "").trim() || marcaDeLaNota(nota, "Interno")
  const contable = String(mov.contable ?? "").trim() || marcaDeLaNota(nota, "Contable")
  const esLibertad = /^LIB/i.test(interno) || /^LIB/i.test(contable) || esLibertadTemplate(nombreTemplate)
  let responsable: string | null = null
  let por: PorQue = "pagador"
  let sinResolver = false
  if (!vacio(interno)) {
    responsable = quienDelCodigo(interno)
    if (responsable) por = "interno"
    else { const t = destinoDeCodigo(interno)?.tipo; sinResolver = t === "DESGLOSAR" || t === "VER" }
  } else if (!vacio(contable)) {
    responsable = quienDelCodigo(contable)
    if (responsable) por = "contable"
  }
  if (!responsable && esLibertadTemplate(nombreTemplate)) { responsable = "MA"; por = "libertad" }
  if (!responsable && mov.template_id) {
    const t = String(ctx.responsableTemplate.get(String(mov.template_id)) ?? "").split("/")[0].trim().toUpperCase()
    if (RANGO.has(t)) { responsable = t; por = "template" }
  }
  if (!responsable && mov.comprobante_arca_id) {
    const e = ctx.empresaFactura.get(String(mov.comprobante_arca_id))
    if (e) { responsable = e.toUpperCase(); por = "factura" }
  }
  if (!responsable && mov.sueldo_pago_id) {
    const e = ctx.empresaSueldo.get(String(mov.sueldo_pago_id))
    if (e && RANGO.has(e.toUpperCase())) { responsable = e.toUpperCase(); por = "sueldo" }
  }
  if (!responsable) responsable = pagador
  const contraparte = [contable, interno].map(c => quienDelCodigo(c, true)).find(q => q && q !== pagador) ?? null
  return { pagador, responsable, por, interno, contable, contraparte, sinResolver, esLibertad }
}

/** Un movimiento atribuido, con su ficha completa (§ ♻️ «la ficha completa»). */
export interface MovSocio {
  id: string
  fecha: string
  mes: string
  canal: string
  pagador: string
  responsable: string
  por: PorQue
  /** propio = de quien pagó · porCuenta = gasto/ingreso de otro · transferencia = plata entre socios. */
  tipo: "propio" | "porCuenta" | "transferencia"
  /** El socio de la otra punta (porCuenta: el responsable; transferencia: a quién / de quién). */
  socio: string | null
  /** Créditos − débitos, en el canal. */
  importe: number
  descripcion: string
  detalle: string
  template: string
  categ: string
  agrupadora: string
  cuenta: string
  seccion: Clasificacion["seccion"]
  contable: string
  interno: string
  esLibertad: boolean
  sinResolver: boolean
  /** El movimiento crudo (para la clasificación del responsable). */
  mov: any
}

export interface Atribuidos {
  movs: MovSocio[]
  /** Sin sección (cuenta con tipo «NO» o vacío): no entran en ninguna vista, igual que en «Por caja», y se listan. */
  fuera: Array<{ mov: any; clasificacion: Clasificacion }>
}

const esPlata = (s: Clasificacion["seccion"]) => s === "financieros" || s === "distribuciones"

/** Atribuye y clasifica TODOS los movimientos una vez. */
export function atribuirTodo(movs: any[], cuentas: CuentaContable[], templates: Map<string, InfoTemplate>, ctx: ContextoResponsable): Atribuidos {
  const clasificar = clasificadorDashboard(cuentas, templates)
  const out: MovSocio[] = [], fuera: Atribuidos["fuera"] = []
  for (const mov of movs) {
    const c = clasificar(mov)
    if (!c.seccion) { fuera.push({ mov, clasificacion: c }); continue }
    const tpl = mov.template_id ? templates.get(String(mov.template_id))?.nombre ?? "" : ""
    const a = atribuir(mov, ctx, tpl)
    let tipo: MovSocio["tipo"] = "propio", socio: string | null = null
    if (a.responsable !== a.pagador) { tipo = esPlata(c.seccion) ? "transferencia" : "porCuenta"; socio = a.responsable }
    else if (esPlata(c.seccion) && a.contraparte) { tipo = "transferencia"; socio = a.contraparte }
    const fecha = String(mov.fecha).slice(0, 10)
    out.push({
      id: String(mov.id ?? ""), fecha, mes: fecha.slice(0, 7), canal: String(mov._canal ?? ""), pagador: a.pagador, responsable: a.responsable,
      por: a.por, tipo, socio, importe: r2(c.monto), descripcion: String(mov.descripcion ?? ""), detalle: String(mov.detalle ?? "").trim(),
      template: tpl, categ: String(mov.categ ?? ""), agrupadora: c.agrupadora, cuenta: c.detalle, seccion: c.seccion,
      contable: a.contable, interno: a.interno, esLibertad: a.esLibertad, sinResolver: a.sinResolver, mov,
    })
  }
  return { movs: out, fuera }
}

// ── Árbol con meses (financiado / pagado por cuenta / la cuenta del par) ─────────────────────────────────────────────────────

export interface NodoSocios {
  nombre: string
  porMes: Record<string, number>
  total: number
  hijos: NodoSocios[]
  /** Los movimientos (sólo en las hojas). */
  movs: Array<{ m: MovSocio; importe: number }>
}

export const nodoVacio = (nombre: string): NodoSocios => ({ nombre, porMes: {}, total: 0, hijos: [], movs: [] })

export function agregarAlArbol(raiz: NodoSocios, camino: string[], m: MovSocio, importe: number): void {
  let n = raiz
  const sumar = (x: NodoSocios) => { x.porMes[m.mes] = r2((x.porMes[m.mes] ?? 0) + importe); x.total = r2(x.total + importe) }
  sumar(n)
  for (const nombre of camino) {
    let h = n.hijos.find(x => x.nombre === nombre)
    if (!h) { h = nodoVacio(nombre); n.hijos.push(h) }
    sumar(h)
    n = h
  }
  n.movs.push({ m, importe })
}

const especial = (a: string) => a.startsWith("(")
/** Socios en el orden del grupo; el resto por nombre, con «(…)» al final. Recursivo. */
export function ordenarArbol(n: NodoSocios): NodoSocios {
  n.hijos.sort((a, b) => {
    const ra = RANGO.get(a.nombre), rb = RANGO.get(b.nombre)
    if (ra !== undefined || rb !== undefined) return (ra ?? 99) - (rb ?? 99)
    if (especial(a.nombre) !== especial(b.nombre)) return especial(a.nombre) ? 1 : -1
    return a.nombre.localeCompare(b.nombre, "es")
  })
  n.hijos.forEach(ordenarArbol)
  n.movs.sort((a, b) => a.m.fecha.localeCompare(b.m.fecha))
  return n
}

export const RETIROS_DIRECTOS = "Retiros directos (transferencias)"
export const TRANSFERENCIAS_RECIBIDAS = "Transferencias"
export const LIBERTAD = "Libertad"

// ── La vista de una o varias empresas ─────────────────────────────────────────────────────────────────────────────────────

export interface VistaResponsable {
  empresas: string[]
  /** Sus Ingresos / Egresos / Financieros / Distribuciones (lo suyo, pague quien pague). */
  resumen: ResumenFinanciero[]
  financiado: NodoSocios
  porCuenta: NodoSocios
  totalSecciones: number
  totalFinanciado: number
  totalPorCuenta: number
  /** Lo que se movió en sus canales (su «Por caja»). */
  totalCaja: number
  /** secciones + financiado + pagado por cuenta = su «Por caja». */
  cierra: boolean
  /** Cada renglón de la vista, con su sección y su grupo (para el Excel: el mismo armado que la pantalla). */
  renglones: RenglonVista[]
}

export type SeccionVista = "Ingresos" | "Egresos" | "Financieros" | "Distribuciones" | "Financiado por los socios" | "Pagado por cuenta de socios"
export const SECCIONES_VISTA: SeccionVista[] = ["Ingresos", "Egresos", "Financieros", "Distribuciones", "Financiado por los socios", "Pagado por cuenta de socios"]
export interface RenglonVista { seccion: SeccionVista; grupo: string; detalle: string; importe: number; m: MovSocio }
const TITULO_SECCION: Record<string, SeccionVista> = { ingresos: "Ingresos", egresos: "Egresos", financieros: "Financieros", distribuciones: "Distribuciones" }

const enPeriodo = (m: MovSocio, desde: string, hasta: string) => m.fecha >= desde && m.fecha <= hasta

export function vistaPorResponsable(at: Atribuidos, empresas: readonly string[], desde: string, hasta: string,
  cuentas: CuentaContable[], templates: Map<string, InfoTemplate>): VistaResponsable {
  const S = new Set(empresas.map(e => e.toUpperCase()))
  const movs = at.movs.filter(m => enPeriodo(m, desde, hasta))
  const base = clasificadorDashboard(cuentas, templates)
  const propios: any[] = []
  const financiado = nodoVacio("Financiado por los socios"), porCuenta = nodoVacio("Pagado por cuenta de socios")
  const renglones: RenglonVista[] = []
  const rotular = (mov: any): Clasificacion => {
    const c = base(mov)
    return mov._responsableVista && mov._empresa !== mov._responsableVista ? { ...c, detalle: `${c.detalle} (pagó ${mov._empresa})` } : c
  }
  const propio = (m: MovSocio, mov: any) => {
    propios.push(mov)
    const c = rotular(mov)
    if (c.seccion) renglones.push({ seccion: TITULO_SECCION[c.seccion], grupo: c.agrupadora, detalle: c.detalle, importe: c.monto, m })
  }
  const arbol = (raiz: NodoSocios, sec: SeccionVista, camino: string[], m: MovSocio, imp: number) => {
    agregarAlArbol(raiz, camino, m, imp)
    renglones.push({ seccion: sec, grupo: camino.slice(0, 2).join(" ▸ "), detalle: camino.slice(2).join(" ▸ "), importe: imp, m })
  }
  let totalCaja = 0
  for (const m of movs) {
    if (S.has(m.pagador)) totalCaja = r2(totalCaja + m.importe)
    if (m.tipo === "propio") { if (S.has(m.pagador)) propio(m, m.mov); continue }
    if (m.tipo === "porCuenta") {
      if (S.has(m.responsable)) {
        propio(m, { ...m.mov, _responsableVista: m.responsable })
        arbol(financiado, "Financiado por los socios", [m.pagador, m.canal, m.esLibertad ? LIBERTAD : m.agrupadora, m.template || m.cuenta], m, r2(-m.importe))
      }
      if (S.has(m.pagador)) arbol(porCuenta, "Pagado por cuenta de socios", [m.responsable, m.esLibertad ? LIBERTAD : m.agrupadora, m.template || m.cuenta], m, m.importe)
      continue
    }
    // transferencia: sólo del lado del canal
    if (!S.has(m.pagador)) continue
    if (m.importe < 0) arbol(porCuenta, "Pagado por cuenta de socios", [m.socio!, RETIROS_DIRECTOS, m.canal], m, m.importe)
    else arbol(financiado, "Financiado por los socios", [m.socio!, m.canal, TRANSFERENCIAS_RECIBIDAS], m, m.importe)
  }
  const resumen = armarResumenFinanciero(propios, cuentas, templates, rotular).resumen
  const totalSecciones = r2(resumen.reduce((t, x) => t + x.totalIngresos + x.totalEgresos + x.totalFinancieros + x.totalDistribuciones, 0))
  ordenarArbol(financiado); ordenarArbol(porCuenta)
  const suma = r2(totalSecciones + financiado.total + porCuenta.total)
  return { empresas: [...S], resumen, financiado, porCuenta, totalSecciones, totalFinanciado: financiado.total, totalPorCuenta: porCuenta.total,
    totalCaja, cierra: Math.abs(suma - totalCaja) < 0.005, renglones }
}

/** Los meses que tienen algo (en las secciones o en los socios), completos: la tabla y los socios van con las mismas columnas. */
export function completarMeses(v: VistaResponsable): ResumenFinanciero[] {
  const claves = new Set(v.resumen.map(m => `${m.año}-${String(m.mes).padStart(2, "0")}`))
  for (const n of [v.financiado, v.porCuenta]) Object.keys(n.porMes).forEach(k => claves.add(k))
  const de = new Map(v.resumen.map(m => [`${m.año}-${String(m.mes).padStart(2, "0")}`, m]))
  return [...claves].sort().map(k => de.get(k) ?? { mes: Number(k.slice(5, 7)), año: Number(k.slice(0, 4)), ingresos: {}, egresos: {}, financieros: {}, distribuciones: {},
    subCategorias: {}, totalIngresos: 0, totalEgresos: 0, totalFinancieros: 0, totalDistribuciones: 0, saldoMensual: 0 })
}

// ── El control ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FilaPar {
  a: string
  b: string
  /** Gastos de B pagados por A (en A: pagado por cuenta de B) — y lo que B muestra como financiado por A (el mismo número, con signo opuesto). */
  pagosAporB: number
  financiadoEnB: number | null
  pagosBporA: number
  financiadoEnA: number | null
  /** Transferencias vistas desde A (− mandó / + recibió) y desde B: tienen que ser espejo. null = ese socio no tiene canales. */
  transfLadoA: number
  transfLadoB: number | null
  diferenciaTransf: number | null
  mesesConDiferencia: Array<{ mes: string; ladoA: number; ladoB: number }>
}

export interface ControlResponsable {
  porCaja: number
  porResponsable: number
  diferencia: number
  cierra: boolean
  porEmpresa: Array<{ empresa: string; caja: number; secciones: number; financiado: number; porCuenta: number; cierra: boolean }>
  pares: FilaPar[]
  sinResolver: MovSocio[]
  fuera: Atribuidos["fuera"]
}

const parOrdenado = (x: string, y: string): [string, string] => ((RANGO.get(x) ?? 99) <= (RANGO.get(y) ?? 99) ? [x, y] : [y, x])

export function controlPorResponsable(at: Atribuidos, movsCrudosDelPeriodo: any[], desde: string, hasta: string,
  cuentas: CuentaContable[], templates: Map<string, InfoTemplate>): ControlResponsable {
  // «Por caja», con la misma función de la vista de siempre
  const caja = armarResumenFinanciero(movsCrudosDelPeriodo, cuentas, templates).resumen
  const porCaja = r2(caja.reduce((t, x) => t + x.totalIngresos + x.totalEgresos + x.totalFinancieros + x.totalDistribuciones, 0))
  const porEmpresa = EMPRESAS_DASHBOARD.map(e => {
    const v = vistaPorResponsable(at, [e], desde, hasta, cuentas, templates)
    return { empresa: e, caja: v.totalCaja, secciones: v.totalSecciones, financiado: v.totalFinanciado, porCuenta: v.totalPorCuenta, cierra: v.cierra }
  })
  const porResponsable = r2(porEmpresa.reduce((t, x) => t + x.secciones + x.financiado + x.porCuenta, 0))
  const movs = at.movs.filter(m => enPeriodo(m, desde, hasta))
  const pares = new Map<string, FilaPar>()
  const par = (x: string, y: string) => {
    const [a, b] = parOrdenado(x, y), k = `${a}|${b}`
    if (!pares.has(k)) pares.set(k, { a, b, pagosAporB: 0, financiadoEnB: esEmpresa(b) ? 0 : null, pagosBporA: 0, financiadoEnA: esEmpresa(a) ? 0 : null,
      transfLadoA: 0, transfLadoB: esEmpresa(b) ? 0 : null, diferenciaTransf: null, mesesConDiferencia: [] })
    return pares.get(k)!
  }
  const porMes = new Map<string, Map<string, { a: number; b: number }>>()
  for (const m of movs) {
    if (m.tipo === "propio" || !m.socio) continue
    const p = par(m.pagador, m.socio), pagoA = p.a === m.pagador
    if (m.tipo === "porCuenta") {
      if (pagoA) { p.pagosAporB = r2(p.pagosAporB + m.importe); if (p.financiadoEnB !== null) p.financiadoEnB = r2(p.financiadoEnB - m.importe) }
      else { p.pagosBporA = r2(p.pagosBporA + m.importe); if (p.financiadoEnA !== null) p.financiadoEnA = r2(p.financiadoEnA - m.importe) }
      continue
    }
    if (pagoA) p.transfLadoA = r2(p.transfLadoA + m.importe)
    else if (p.transfLadoB !== null) p.transfLadoB = r2(p.transfLadoB + m.importe)
    const k = `${p.a}|${p.b}`
    if (!porMes.has(k)) porMes.set(k, new Map())
    const x = porMes.get(k)!.get(m.mes) ?? { a: 0, b: 0 }
    if (pagoA) x.a = r2(x.a + m.importe); else x.b = r2(x.b + m.importe)
    porMes.get(k)!.set(m.mes, x)
  }
  for (const [k, p] of pares) {
    if (p.transfLadoB === null) continue
    p.diferenciaTransf = r2(p.transfLadoA + p.transfLadoB)
    p.mesesConDiferencia = [...(porMes.get(k) ?? new Map<string, { a: number; b: number }>())]
      .filter(([, x]) => Math.abs(x.a + x.b) >= 0.005).map(([mes, x]) => ({ mes, ladoA: x.a, ladoB: x.b })).sort((x, y) => x.mes.localeCompare(y.mes))
  }
  const lista = [...pares.values()].sort((x, y) => ((RANGO.get(x.a) ?? 99) - (RANGO.get(y.a) ?? 99)) || ((RANGO.get(x.b) ?? 99) - (RANGO.get(y.b) ?? 99)))
  const fuera = at.fuera.filter(f => String(f.mov.fecha).slice(0, 10) >= desde && String(f.mov.fecha).slice(0, 10) <= hasta)
  return { porCaja, porResponsable, diferencia: r2(porResponsable - porCaja), cierra: Math.abs(porResponsable - porCaja) < 0.005,
    porEmpresa, pares: lista, sinResolver: movs.filter(m => m.sinResolver), fuera }
}

/** Junta varias vistas de una empresa (chips) en la suma — se usa sólo si hiciera falta mostrarlas por separado. */
export function sumaVistas(v: VistaResponsable[]): number { return r2(v.reduce((t, x) => t + x.totalSecciones + x.totalFinanciado + x.totalPorCuenta, 0)) }

// ── La cuenta entre socios ────────────────────────────────────────────────────────────────────────────────────────────────

export const SALDO_INICIAL_FECHA = "2024-12-31"
export const CUENTA_DESDE = "2025-01-01"

export const CAT_RETIROS = "Retiros directos"
export const CAT_PAGOS = "Pagos por su cuenta"
export const CAT_LIBERTAD = "Libertad"
export const CAT_APORTES = "Aportes (pagó por la otra punta)"
export const CATEGORIAS_CUENTA = [CAT_RETIROS, CAT_PAGOS, CAT_LIBERTAD, CAT_APORTES] as const

export interface MesCuenta {
  mes: string
  porCategoria: Record<(typeof CATEGORIAS_CUENTA)[number], number>
  movimiento: number
  saldo: number
  /** categoría → agrupadora → template / canal → movimientos. */
  arbol: NodoSocios
  /** Canales de la pareja que todavía no tienen datos ese mes: lo de antes no se sabe (no se inventa). */
  sinDatos: string[]
}

export interface CuentaPar {
  /** El de más arriba del grupo: el saldo es «b le debe a a» (+) / «a le debe a b» (−). */
  a: string
  b: string
  saldoInicial: number
  meses: MesCuenta[]
  saldoFinal: number
}

export interface CanalDesde { canal: string; empresa: string; desde: string | null }

const mesesEntre = (desde: string, hasta: string) => {
  const out: string[] = []
  let [y, m] = desde.slice(0, 7).split("-").map(Number)
  const [yh, mh] = hasta.slice(0, 7).split("-").map(Number)
  while (y < yh || (y === yh && m <= mh)) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++ } }
  return out
}
const finDeMes = (mes: string) => { const [y, m] = mes.split("-").map(Number); return `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` }

/**
 * Las cuentas de cada par de socios, desde el 31/12/2024 (saldo 0) hasta `hasta`, mes por mes. Toma lo «pagado por cuenta» de los
 * dos lados: lo que A paga por B (gasto o transferencia) suma a lo que B le debe a A; lo que B paga por A, resta.
 */
export function cuentaEntreSocios(at: Atribuidos, hasta: string, desdeCanal: CanalDesde[] = []): CuentaPar[] {
  const meses = mesesEntre(CUENTA_DESDE, hasta)
  const pares = new Map<string, { a: string; b: string; items: Array<{ m: MovSocio; cat: (typeof CATEGORIAS_CUENTA)[number]; camino: string[]; imp: number }> }>()
  for (const m of at.movs) {
    if (m.tipo === "propio" || !m.socio || m.fecha < CUENTA_DESDE || m.fecha > hasta) continue
    // Sólo lo que SALE de una caja para el otro (lo recibido es el espejo: se compara en el control de pares, no se suma dos veces)
    if (m.tipo === "transferencia" && m.importe > 0) continue
    const [a, b] = parOrdenado(m.pagador, m.socio), k = `${a}|${b}`
    if (!pares.has(k)) pares.set(k, { a, b, items: [] })
    const pagoA = m.pagador === a
    // «b le debe a a»: si a pagó, suma (−importe); si b pagó, resta (+importe)
    const imp = pagoA ? r2(-m.importe) : m.importe
    let cat: (typeof CATEGORIAS_CUENTA)[number], camino: string[]
    if (!pagoA) { cat = CAT_APORTES; camino = [m.tipo === "transferencia" ? `Transferencias de ${b}` : m.esLibertad ? LIBERTAD : m.agrupadora, m.tipo === "transferencia" ? m.canal : m.template || m.cuenta] }
    else if (m.tipo === "transferencia") { cat = CAT_RETIROS; camino = [m.canal] }
    else if (m.esLibertad) { cat = CAT_LIBERTAD; camino = [m.template || m.cuenta] }
    else { cat = CAT_PAGOS; camino = [m.agrupadora, m.template || m.cuenta] }
    pares.get(k)!.items.push({ m, cat, camino, imp })
  }
  const out: CuentaPar[] = []
  for (const { a, b, items } of pares.values()) {
    let saldo = 0
    const ms: MesCuenta[] = meses.map(mes => {
      const arbol = nodoVacio(mes)
      const porCategoria = { [CAT_RETIROS]: 0, [CAT_PAGOS]: 0, [CAT_LIBERTAD]: 0, [CAT_APORTES]: 0 } as MesCuenta["porCategoria"]
      for (const it of items.filter(x => x.m.mes === mes)) {
        porCategoria[it.cat] = r2(porCategoria[it.cat] + it.imp)
        agregarAlArbol(arbol, [it.cat, ...it.camino], it.m, it.imp)
      }
      ordenarArbol(arbol)
      const movimiento = r2(Object.values(porCategoria).reduce((t, x) => t + x, 0))
      saldo = r2(saldo + movimiento)
      const fin = finDeMes(mes)
      const sinDatos = desdeCanal.filter(c => (c.empresa === a || c.empresa === b) && (!c.desde || c.desde > fin)).map(c => c.canal)
      return { mes, porCategoria, movimiento, saldo, arbol, sinDatos }
    })
    out.push({ a, b, saldoInicial: 0, meses: ms, saldoFinal: saldo })
  }
  return out.sort((x, y) => ((RANGO.get(x.a) ?? 99) - (RANGO.get(y.a) ?? 99)) || ((RANGO.get(x.b) ?? 99) - (RANGO.get(y.b) ?? 99)))
}

/** El saldo de `empresa` con `socio` al final: + = el socio le debe a la empresa · − = la empresa le debe al socio. */
export function saldoCon(cuentas: CuentaPar[], empresa: string, socio: string): number {
  const c = cuentas.find(x => (x.a === empresa && x.b === socio) || (x.a === socio && x.b === empresa))
  if (!c) return 0
  return c.a === empresa ? c.saldoFinal : r2(-c.saldoFinal)
}

/** El saldo de un par en un mes dado (el último mes ≤ `mes`). */
export function saldoAl(c: CuentaPar, mes: string): number {
  const ms = c.meses.filter(x => x.mes <= mes)
  return ms.length ? ms[ms.length - 1].saldo : 0
}
