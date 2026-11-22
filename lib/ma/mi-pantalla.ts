/**
 * 👤 LA PANTALLA DE MA (Mercedes Areco) — A-FEAT-1634.
 *
 * JMS 21/11: *«que MA tenga en su Principal sus impuestos (después los de MSA y PAM), sus arrendamientos y algún tipo de
 * presupuesto… primera prueba que puede tener errores de datos pero no de estética, formato, presentación, y la
 * estructura de datos funcionando bien»*.
 *
 * Pieza PURA (sin base, la prueba `npm run probar`). Los datos los lee `app/api/mi-pantalla/route.ts` con el servidor
 * —el rol `ma` no tiene secciones— y la pantalla sólo dibuja lo que esto devuelve. Tres bloques, sólo lectura:
 *
 *   · 🧾 Mis impuestos del año — la MISMA cuenta que la Planilla de impuestos (`armarPlanilla`), filtrada a una empresa y
 *     dada vuelta: por mes, un renglón por impuesto (las 7 partidas del inmobiliario en un renglón, con su detalle).
 *   · 🌾 Mis arrendamientos — por contrato (campaña): lo esperado de sus cuotas (mismo cálculo que Ingresos →
 *     Arrendamientos), lo facturado, lo cobrado y lo que falta cobrar, con sus fechas.
 *   · 📈 Lo que viene — los próximos 12 meses: lo que falta cobrar de arrendamientos contra los impuestos sin pagar.
 *
 * Cada bloque trae su CONTROL (§ 🧮): las partes suman el todo que el propio bloque muestra.
 */
import { armarPlanilla, empresaDePlanilla, impuestoDeTemplate, resumenMes, type CeldaCuota, type CuotaPlanilla } from "@/lib/impuestos/planilla"
import { esImpuesto } from "@/lib/impuestos/vencimientos"
import {
  calcularMontoCuota, montoVenta, tonsCuota, tonsFijadas, tonsTotales,
  type ContratoArrendamiento, type CuotaArrendamiento, type PrecioGrano, type TipoCambio, type VentaArrendamiento,
} from "@/lib/arrendamientos/calculo"

/** Las empresas que se pueden mirar, en el orden que pidió JMS (primero lo de ella). */
export const EMPRESAS_MI_PANTALLA = ["MA", "MSA", "PAM"] as const
export type EmpresaMiPantalla = (typeof EMPRESAS_MI_PANTALLA)[number]
export const esEmpresaMiPantalla = (x: string | null | undefined): x is EmpresaMiPantalla =>
  (EMPRESAS_MI_PANTALLA as readonly string[]).includes(String(x ?? ""))

/**
 * Los bloques son recursos del Principal (`lib/auth/recursos.ts`): JMS los prende con el candado en «Ver como lo ve
 * él». La ruta del servidor pregunta por el MISMO id, así que prender el candado es lo único que habilita el dato.
 */
export const RECURSO_BLOQUE = {
  impuestos: "principal.ma-impuestos",
  arrendamientos: "principal.ma-arrendamientos",
  "lo-que-viene": "principal.ma-lo-que-viene",
} as const
export type BloqueMiPantalla = keyof typeof RECURSO_BLOQUE

/**
 * 🔒 Los chips de empresa del bloque de impuestos (JMS 22/11: «ok con los candados a los chips»): MA va siempre (es lo
 * suyo); MSA y PAM tienen candado propio. En un rol cerrado nacen apagados. La ruta del servidor pregunta lo mismo.
 */
export const RECURSO_EMPRESA: Partial<Record<EmpresaMiPantalla, string>> = {
  MSA: "principal.ma-impuestos-msa",
  PAM: "principal.ma-impuestos-pam",
}
export function puedeVerEmpresa(rol: string | null, niveles: Record<string, string>, empresa: EmpresaMiPantalla): boolean {
  if (rol === "admin") return true
  const r = RECURSO_EMPRESA[empresa]
  if (!r) return true
  const n = niveles[r]
  return n === "lectura" || n === "escritura"
}

/** Roles (además de admin) que pueden pedir estos datos, siempre que tengan el bloque prendido. */
export const ROLES_MI_PANTALLA = ["ma"] as const

/**
 * ¿Esta sesión puede ver este bloque? Admin siempre (es quien lo configura y lo mira «como lo ve ella»). Otro rol: tiene
 * que estar en `ROLES_MI_PANTALLA`, tener la sección Principal y el bloque DADO de forma explícita (no heredado).
 */
export function puedeVerBloque(rol: string | null, secciones: string[], niveles: Record<string, string>, bloque: BloqueMiPantalla): boolean {
  if (rol === "admin") return true
  if (!rol || !(ROLES_MI_PANTALLA as readonly string[]).includes(rol)) return false
  if (!secciones.includes("principal")) return false
  const n = niveles[RECURSO_BLOQUE[bloque]]
  return n === "lectura" || n === "escritura"
}

const redondear = (n: number) => Math.round(n * 100) / 100
export const NOMBRE_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

// ═══════════════════════════════════════ 🧾 MIS IMPUESTOS DEL AÑO ═══════════════════════════════════════

/** El estado como lo lee ella. `revisar` = figura pagada pero en programado/echeq (raro en un impuesto). */
export type EstadoImpuesto = "pagado" | "vencido" | "a-vencer" | "parcial" | "revisar"

export interface CuotaDeImpuesto {
  id: string
  template: string
  vencimiento: string
  monto: number
  estado: EstadoImpuesto
  numero_cuota: number | null
}

export interface RenglonImpuesto {
  clave: string
  impuesto: string
  monto: number
  estado: EstadoImpuesto
  /** El vencimiento más próximo del renglón en ese mes. */
  vencimiento: string
  cuotas: CuotaDeImpuesto[]
}

export interface MesDeImpuestos {
  mes: number // 1-12
  nombre: string
  renglones: RenglonImpuesto[]
  total: number
  pagado: number
  pendiente: number
}

export interface MisImpuestos {
  empresa: string
  anio: number
  meses: MesDeImpuestos[]
  totales: { pagado: number; vencido: number; aVencer: number; total: number }
  /** Años con alguna cuota de esta empresa (para las flechas). */
  aniosConDatos: number[]
  control: { cierra: boolean; diferencias: string[] }
}

function estadoDeCuota(c: CeldaCuota): EstadoImpuesto {
  if (c.rara) return "revisar"
  if (c.estado !== "sin-pagar") return "pagado"
  return c.vencida ? "vencido" : "a-vencer"
}

/** Las cuotas de impuestos de UNA empresa, con el mismo criterio de empresa que la Planilla (el ABL compartido va a MA). */
export function cuotasDeEmpresa(cuotas: CuotaPlanilla[], empresa: string): CuotaPlanilla[] {
  return cuotas.filter(c => esImpuesto(c.template) && empresaDePlanilla(c.template, impuestoDeTemplate(c.template)) === empresa)
}

export function misImpuestosDelAnio(cuotas: CuotaPlanilla[], empresa: string, anio: number, hoy: string): MisImpuestos {
  const planilla = armarPlanilla(cuotasDeEmpresa(cuotas, empresa), anio, hoy)
  const meses: MesDeImpuestos[] = []
  for (let i = 0; i < 12; i++) {
    const renglones: RenglonImpuesto[] = []
    for (const f of planilla.filas) {
      const celdas = f.meses[i]
      if (!celdas.length) continue
      const r = resumenMes(celdas)
      const estado: EstadoImpuesto = r.estado === "rara" ? "revisar"
        : r.estado === "vencida" ? "vencido"
        : r.estado === "futura" ? (r.mixta ? "parcial" : "a-vencer")
        : "pagado"
      renglones.push({
        clave: f.clave, impuesto: f.impuesto, monto: r.monto, estado,
        vencimiento: celdas.map(c => c.vencimiento).sort()[0],
        cuotas: celdas.map(c => ({ id: c.id, template: c.template, vencimiento: c.vencimiento, monto: redondear(c.monto), estado: estadoDeCuota(c), numero_cuota: c.numero_cuota })),
      })
    }
    if (!renglones.length) continue
    renglones.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.impuesto.localeCompare(b.impuesto))
    const todas = renglones.flatMap(r => r.cuotas)
    const pagado = redondear(todas.filter(c => c.estado === "pagado" || c.estado === "revisar").reduce((s, c) => s + c.monto, 0))
    const total = redondear(renglones.reduce((s, r) => s + r.monto, 0))
    meses.push({ mes: i + 1, nombre: NOMBRE_MES[i], renglones, total, pagado, pendiente: redondear(total - pagado) })
  }
  const todas = meses.flatMap(m => m.renglones.flatMap(r => r.cuotas))
  const suma = (pred: (c: CuotaDeImpuesto) => boolean) => redondear(todas.filter(pred).reduce((s, c) => s + c.monto, 0))
  const totales = {
    pagado: suma(c => c.estado === "pagado" || c.estado === "revisar"),
    vencido: suma(c => c.estado === "vencido"),
    aVencer: suma(c => c.estado === "a-vencer"),
    total: redondear(meses.reduce((s, m) => s + m.total, 0)),
  }
  // § 🧮 — el mismo número por dos caminos: lo que suman los meses de acá contra el total de la Planilla, y el reparto
  // por estado contra el total.
  const diferencias: string[] = [...planilla.control.diferencias]
  if (Math.abs(totales.total - planilla.totales.total) > 0.01) diferencias.push(`meses ${totales.total} ≠ planilla ${planilla.totales.total}`)
  const porEstado = redondear(totales.pagado + totales.vencido + totales.aVencer)
  if (Math.abs(porEstado - totales.total) > 0.01) diferencias.push(`pagado + vencido + a vencer ${porEstado} ≠ total ${totales.total}`)
  return { empresa, anio, meses, totales, aniosConDatos: planilla.aniosConDatos, control: { cierra: diferencias.length === 0, diferencias } }
}

// ═══════════════════════════════════════ 🌾 MIS ARRENDAMIENTOS ═══════════════════════════════════════

/** Un comprobante de venta (factura, FCE, NC) con lo cobrado: banco + retenciones que le hicieron. */
export interface ComprobanteArrendamiento {
  id: string
  fecha: string
  tipo: number
  numero: string | null
  cliente_cuit: string | null
  total: number
  cobradoBanco: number
  retenciones: number
  /** Si el comprobante está vinculado a una venta (fijación) de un contrato: ése manda sobre la fecha. */
  contratoId?: string | null
}

/** Notas de crédito (A, B, C, M, FCE A/B/C): restan. */
const TIPOS_NC = new Set([3, 8, 13, 53, 203, 208, 213])
const TIPO_ROTULO: Record<number, string> = { 1: "Factura A", 6: "Factura B", 11: "Factura C", 201: "FCE A", 206: "FCE B", 211: "FCE C", 3: "NC A", 8: "NC B", 13: "NC C", 203: "NC FCE A", 208: "NC FCE B", 213: "NC FCE C" }
export const rotuloComprobante = (tipo: number) => TIPO_ROTULO[tipo] ?? `Comprobante ${tipo}`

/** La campaña de una fecha: julio a junio («2026-06-17» → «25/26», «2026-09-30» → «26/27»). */
export function campaniaDeFecha(fecha: string): string {
  const a = Number(fecha.slice(0, 4)), m = Number(fecha.slice(5, 7))
  const desde = m >= 7 ? a : a - 1
  const yy = (n: number) => String(n % 100).padStart(2, "0")
  return `${yy(desde)}/${yy(desde + 1)}`
}

export type EstadoCuotaMA = "cobrada" | "parcial" | "a-cobrar" | "vencida"

export interface CuotaMA {
  numero: number
  fecha: string
  qqHa: number
  tons: number
  monto: number
  /** El monto todavía no es firme (falta fijar precio o TC, o se usa un precio arrastrado). */
  estimado: boolean
  /** Tons ya fijadas (vendidas) de la cuota. */
  tonsFijadas: number
  restante: number
  estado: EstadoCuotaMA
}

export interface PorCobrar { fecha: string; concepto: string; monto: number; vencido: boolean }

export interface ContratoMA {
  id: string
  campania: string
  cliente: string
  has: number
  qqHa: number
  grano: string
  tons: number
  cuotas: CuotaMA[]
  comprobantes: Array<{ id: string; fecha: string; rotulo: string; numero: string | null; total: number; cobrado: number; saldo: number; porFecha: boolean }>
  esperado: number
  facturado: number
  cobrado: number
  faltaFacturar: number
  faltaCobrar: number
  porCobrar: PorCobrar[]
}

export interface MisArrendamientos {
  contratos: ContratoMA[]
  /** Comprobantes de la empresa que no se pudieron ubicar en ningún contrato (otro cliente u otra campaña). */
  sinContrato: ContratoMA["comprobantes"]
  totales: { esperado: number; facturado: number; cobrado: number; faltaCobrar: number }
  control: { cierra: boolean; diferencias: string[] }
}

export interface EntradaArrendamientos {
  contratos: Pick<ContratoArrendamiento, "id" | "campania" | "cliente_nombre" | "cliente_cuit" | "has" | "qq_ha_total" | "grano">[]
  cuotas: Pick<CuotaArrendamiento, "id" | "contrato_id" | "numero_cuota" | "qq_ha_cuota" | "fecha_cobro_estimada" | "posicion_anio" | "posicion_mes" | "precio_usd_override" | "precio_pesos_override">[]
  ventas: Pick<VentaArrendamiento, "cuota_id" | "tons" | "modo" | "precio_usd" | "tc" | "precio_pesos" | "fecha_cobro">[]
  precios: PrecioGrano[]
  tcs: TipoCambio[]
  comprobantes: ComprobanteArrendamiento[]
}

/** Lo esperado de una cuota: lo fijado (ventas) + lo que falta fijar a precio de la posición. Mismo cálculo que Ingresos. */
function montoDeCuota(
  contrato: EntradaArrendamientos["contratos"][number], cuota: EntradaArrendamientos["cuotas"][number],
  ventas: EntradaArrendamientos["ventas"], precios: PrecioGrano[], tcs: TipoCambio[],
): { monto: number; estimado: boolean; tons: number; fijadas: number } {
  const tons = tonsCuota(Number(contrato.has), Number(cuota.qq_ha_cuota))
  const fijadas = Math.min(tons, tonsFijadas(ventas))
  let monto = 0, estimado = false
  for (const v of ventas) {
    const m = montoVenta(v, tcs)
    monto += m.monto
    if (m.estimado) estimado = true
  }
  const resto = tons - fijadas
  if (resto > 0.0005) {
    const p = calcularMontoCuota(contrato, cuota, precios, tcs)
    const porTon = p.tons > 0 ? p.monto_pesos / p.tons : 0
    monto += resto * porTon
    estimado = true
  }
  return { monto: redondear(monto), estimado, tons: Math.round(tons * 1000) / 1000, fijadas: Math.round(fijadas * 1000) / 1000 }
}

export function misArrendamientos(e: EntradaArrendamientos, hoy: string): MisArrendamientos {
  const cuit = (x: string | null | undefined) => String(x ?? "").replace(/\D/g, "")
  // ¿A qué contrato va cada comprobante? Primero el vínculo con la venta; si no hay, el del mismo cliente en la campaña
  // de la fecha (julio a junio). Lo que no encaja queda aparte, a la vista.
  const destino = new Map<string, { contratoId: string; porFecha: boolean }>()
  for (const c of e.comprobantes) {
    if (c.contratoId && e.contratos.some(k => k.id === c.contratoId)) { destino.set(c.id, { contratoId: c.contratoId, porFecha: false }); continue }
    const camp = campaniaDeFecha(c.fecha)
    const k = e.contratos.find(k => k.campania === camp && cuit(k.cliente_cuit) && cuit(k.cliente_cuit) === cuit(c.cliente_cuit))
    if (k) destino.set(c.id, { contratoId: k.id, porFecha: true })
  }
  const filaComprobante = (c: ComprobanteArrendamiento) => {
    const signo = TIPOS_NC.has(c.tipo) ? -1 : 1
    const total = redondear(signo * Math.abs(c.total))
    const cobrado = redondear(c.cobradoBanco + c.retenciones)
    return { id: c.id, fecha: c.fecha, rotulo: rotuloComprobante(c.tipo), numero: c.numero, total, cobrado, saldo: redondear(total - cobrado), porFecha: destino.get(c.id)?.porFecha ?? false }
  }

  const diferencias: string[] = []
  const contratos: ContratoMA[] = [...e.contratos]
    .sort((a, b) => a.campania.localeCompare(b.campania))
    .map(k => {
      const cuotasK = e.cuotas.filter(q => q.contrato_id === k.id).sort((a, b) => a.fecha_cobro_estimada.localeCompare(b.fecha_cobro_estimada) || a.numero_cuota - b.numero_cuota)
      const base = cuotasK.map(q => ({ q, ...montoDeCuota(k, q, e.ventas.filter(v => v.cuota_id === q.id), e.precios, e.tcs) }))
      const comprobantes = e.comprobantes.filter(c => destino.get(c.id)?.contratoId === k.id).map(filaComprobante).sort((a, b) => a.fecha.localeCompare(b.fecha))
      const esperado = redondear(base.reduce((s, x) => s + x.monto, 0))
      const facturado = redondear(comprobantes.reduce((s, c) => s + c.total, 0))
      const cobrado = redondear(comprobantes.reduce((s, c) => s + c.cobrado, 0))

      // Lo cobrado se aplica a las cuotas por orden de fecha. Si se facturó más que lo estimado, la diferencia también se
      // espera cobrar: va como un renglón más, después de las cuotas.
      const items: Array<{ fecha: string; concepto: string; monto: number }> = base.map(x => ({ fecha: x.q.fecha_cobro_estimada, concepto: `Cuota ${x.q.numero_cuota}`, monto: x.monto }))
      if (facturado - esperado > 0.01) items.push({ fecha: comprobantes[comprobantes.length - 1]?.fecha ?? hoy, concepto: "Facturado por encima de lo estimado", monto: redondear(facturado - esperado) })
      let aplicar = cobrado
      const restantes = items.map(it => {
        const usado = Math.max(0, Math.min(it.monto, aplicar))
        aplicar = redondear(aplicar - usado)
        return redondear(it.monto - usado)
      })
      const cuotas: CuotaMA[] = base.map((x, i) => {
        const restante = restantes[i]
        const estado: EstadoCuotaMA = restante <= 0.01 ? "cobrada" : restante < x.monto - 0.01 ? "parcial" : x.q.fecha_cobro_estimada < hoy ? "vencida" : "a-cobrar"
        return { numero: x.q.numero_cuota, fecha: x.q.fecha_cobro_estimada, qqHa: Number(x.q.qq_ha_cuota), tons: x.tons, monto: x.monto, estimado: x.estimado, tonsFijadas: x.fijadas, restante, estado }
      })
      const porCobrar: PorCobrar[] = items
        .map((it, i) => ({ fecha: it.fecha, concepto: it.concepto, monto: restantes[i], vencido: it.fecha < hoy }))
        .filter(p => p.monto > 0.01)
      const faltaCobrar = redondear(porCobrar.reduce((s, p) => s + p.monto, 0))
      // § 🧮 — lo que falta cobrar renglón por renglón contra el total: lo mayor entre lo esperado y lo facturado, menos lo cobrado.
      const esperadoFalta = redondear(Math.max(0, Math.max(esperado, facturado) - cobrado))
      if (Math.abs(faltaCobrar - esperadoFalta) > 0.01) diferencias.push(`${k.campania}: por cobrar ${faltaCobrar} ≠ ${esperadoFalta}`)
      return {
        id: k.id, campania: k.campania, cliente: k.cliente_nombre, has: Number(k.has), qqHa: Number(k.qq_ha_total), grano: k.grano,
        tons: Math.round(tonsTotales(Number(k.has), Number(k.qq_ha_total)) * 1000) / 1000,
        cuotas, comprobantes, esperado, facturado, cobrado,
        faltaFacturar: redondear(Math.max(0, esperado - facturado)), faltaCobrar, porCobrar,
      }
    })
  const sinContrato = e.comprobantes.filter(c => !destino.has(c.id)).map(filaComprobante)
  const totales = {
    esperado: redondear(contratos.reduce((s, k) => s + k.esperado, 0)),
    facturado: redondear(contratos.reduce((s, k) => s + k.facturado, 0)),
    cobrado: redondear(contratos.reduce((s, k) => s + k.cobrado, 0)),
    faltaCobrar: redondear(contratos.reduce((s, k) => s + k.faltaCobrar, 0)),
  }
  return { contratos, sinContrato, totales, control: { cierra: diferencias.length === 0, diferencias } }
}

// ═══════════════════════════════════════ 📈 LO QUE VIENE ═══════════════════════════════════════

export interface MesQueViene {
  mes: string // 'YYYY-MM'
  nombre: string
  ingresos: number
  egresos: number
  neto: number
  acumulado: number
  detalleIngresos: MovimientoQueViene[]
  detalleEgresos: MovimientoQueViene[]
}

export interface LoQueViene {
  desde: string
  hasta: string
  /** Lo que ya tendría que haber pasado y no pasó (cobros atrasados, impuestos vencidos sin pagar). */
  atrasado: { ingresos: number; egresos: number }
  meses: MesQueViene[]
  totales: { ingresos: number; egresos: number; neto: number }
  control: { cierra: boolean; diferencias: string[] }
}

/**
 * Un renglón de «Lo que viene». Además del `concepto` (el texto entero), lo que hace falta para mostrarlo PROLIJO (CLAUDE.md
 * § ♻️, JMS 22/11): el `grupo` (el impuesto: «Red Vial»), el `lugar` (el establecimiento: «Nazarenas», «Lima»), la `partida`
 * («Tapera 2») y la `cuota` («cuota 4 de 4»). Los arrendamientos no los llevan (van por su concepto).
 */
export interface MovimientoQueViene { fecha: string; concepto: string; monto: number; grupo?: string; lugar?: string | null; partida?: string | null; cuota?: string | null }

/** Los nombres como se escriben (las partidas vienen sin tildes en los templates). */
const TILDES: Record<string, string> = { "entre rios": "Entre Ríos", "ombu": "Ombú", "porteria nuevo": "Portería Nuevo", "porteria viejo": "Portería Viejo", "sanchez": "Sánchez", "domesticas": "Domésticas", "autonomos": "Autónomos" }
export const prolijo = (s: string) => s.split(/\s+/).filter(Boolean).join(" ")
  .replace(/\b(entre rios|ombu|domesticas|autonomos|sanchez|porteria nuevo|porteria viejo)\b/gi, w => TILDES[w.toLowerCase()] ?? w)

/**
 * 🏷️ Cómo se muestra la cuota de un impuesto: impuesto → lugar → partida, y «cuota N de M» (M = las cuotas de ese template
 * con vencimiento en el mismo año). `establecimientoDe` sale de la tabla de partidas (campo → establecimiento); si la partida
 * no está ahí (Lima), el lugar es la partida misma.
 */
export function partidaDeCuota(impuesto: string, template: string, numero: number | null, deCuantas: number, establecimientoDe?: (partida: string) => string | null | undefined) {
  const sinPalabras = template
    .replace(new RegExp(impuesto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ")
    .replace(/\b(inmobiliario|complementario|red vial|cuota|anual|mensual)\b/gi, " ")
    .replace(/\bMA\b/g, " ").replace(/\s+/g, " ").trim()
  const partida = sinPalabras ? prolijo(sinPalabras) : null
  const est = partida ? (establecimientoDe?.(partida) ?? null) : null
  const lugar = est ? prolijo(est) : partida
  return {
    grupo: prolijo(impuesto),
    lugar,
    partida: partida && lugar !== partida ? partida : null,
    cuota: deCuantas > 1 && numero ? `cuota ${numero} de ${deCuantas}` : null,
  }
}

/** El detalle de un mes agrupado: impuesto → lugar → renglones, con sus totales (los arrendamientos quedan sueltos, cada uno su grupo). */
export interface GrupoDetalle { grupo: string; entra: boolean; fecha: string; total: number; lugares: Array<{ lugar: string | null; total: number; renglones: MovimientoQueViene[] }> }
export function agruparDetalle(ingresos: MovimientoQueViene[], egresos: MovimientoQueViene[]): GrupoDetalle[] {
  const grupos = new Map<string, GrupoDetalle>()
  const meter = (x: MovimientoQueViene, entra: boolean) => {
    const g = x.grupo ?? x.concepto
    const k = `${entra ? "+" : "-"}${g}`
    let G = grupos.get(k)
    if (!G) { G = { grupo: g, entra, fecha: x.fecha, total: 0, lugares: [] }; grupos.set(k, G) }
    G.total = redondear(G.total + x.monto)
    if (x.fecha < G.fecha) G.fecha = x.fecha
    let L = G.lugares.find(l => l.lugar === (x.lugar ?? null))
    if (!L) { L = { lugar: x.lugar ?? null, total: 0, renglones: [] }; G.lugares.push(L) }
    L.total = redondear(L.total + x.monto)
    L.renglones.push(x)
  }
  ingresos.forEach(x => meter(x, true))
  egresos.forEach(x => meter(x, false))
  const out = [...grupos.values()]
  for (const G of out) {
    G.lugares.sort((a, b) => String(a.lugar ?? "").localeCompare(String(b.lugar ?? "")))
    for (const L of G.lugares) L.renglones.sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.partida ?? "").localeCompare(String(b.partida ?? "")))
  }
  return out.sort((a, b) => Number(b.entra) - Number(a.entra) || a.fecha.localeCompare(b.fecha) || a.grupo.localeCompare(b.grupo))
}

const sumarMes = (ym: string, n: number) => {
  const [a, m] = ym.split("-").map(Number)
  const d = a * 12 + (m - 1) + n
  return `${Math.floor(d / 12)}-${String((d % 12) + 1).padStart(2, "0")}`
}

/** Los impuestos SIN PAGAR de las cuotas, con el mismo criterio que la Planilla (sin los de templates dados de baja). */
export function impuestosSinPagar(cuotas: CuotaPlanilla[], anios: number[], hoy: string, establecimientoDe?: (partida: string) => string | null | undefined): MovimientoQueViene[] {
  return anios.flatMap(a => armarPlanilla(cuotas, a, hoy).filas.flatMap(f => {
    // «de cuántas»: las cuotas de cada template que vencen en el año (pagadas o no)
    const todas = f.meses.flat()
    const deCuantas = new Map<string, number>()
    for (const c of todas) deCuantas.set(c.template, (deCuantas.get(c.template) ?? 0) + 1)
    const orden = new Map<string, number>()
    ;[...todas].sort((x, y) => x.vencimiento.localeCompare(y.vencimiento)).forEach(c => {
      const n = (orden.get(`#${c.template}`) ?? 0) + 1
      orden.set(`#${c.template}`, n); orden.set(c.id, n)
    })
    return todas
      .filter(c => c.estado === "sin-pagar")
      .map(c => {
        const p = partidaDeCuota(f.impuesto, c.template, c.numero_cuota ?? orden.get(c.id) ?? null, deCuantas.get(c.template) ?? 1, establecimientoDe)
        const concepto = [p.grupo, p.lugar, p.partida].filter(Boolean).join(" · ") + (p.cuota ? ` · ${p.cuota}` : "")
        return { fecha: c.vencimiento, concepto, monto: redondear(c.monto), ...p }
      })
  }))
}

/** Los próximos 12 meses, desde el mes de `hoy`. Lo anterior a hoy va a «atrasado»; lo posterior al mes 12 no entra. */
export function loQueViene(ingresos: MovimientoQueViene[], egresos: MovimientoQueViene[], hoy: string): LoQueViene {
  const primero = hoy.slice(0, 7)
  const ultimo = sumarMes(primero, 11)
  const meses: MesQueViene[] = Array.from({ length: 12 }, (_, i) => {
    const mes = sumarMes(primero, i)
    return { mes, nombre: `${NOMBRE_MES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`, ingresos: 0, egresos: 0, neto: 0, acumulado: 0, detalleIngresos: [], detalleEgresos: [] }
  })
  const atrasado = { ingresos: 0, egresos: 0 }
  let dentro = 0
  const ubicar = (lista: MovimientoQueViene[], lado: "ingresos" | "egresos") => {
    for (const x of lista) {
      if (x.fecha < hoy) { atrasado[lado] = redondear(atrasado[lado] + x.monto); dentro += x.monto; continue }
      const ym = x.fecha.slice(0, 7)
      if (ym > ultimo) continue
      const m = meses.find(k => k.mes === ym)
      if (!m) continue
      m[lado] = redondear(m[lado] + x.monto)
      ;(lado === "ingresos" ? m.detalleIngresos : m.detalleEgresos).push({ ...x })
      dentro += x.monto
    }
  }
  ubicar(ingresos, "ingresos")
  ubicar(egresos, "egresos")
  let acumulado = redondear(atrasado.ingresos - atrasado.egresos)
  for (const m of meses) {
    m.detalleIngresos.sort((a, b) => a.fecha.localeCompare(b.fecha))
    m.detalleEgresos.sort((a, b) => a.fecha.localeCompare(b.fecha))
    m.neto = redondear(m.ingresos - m.egresos)
    acumulado = redondear(acumulado + m.neto)
    m.acumulado = acumulado
  }
  const totales = {
    ingresos: redondear(atrasado.ingresos + meses.reduce((s, m) => s + m.ingresos, 0)),
    egresos: redondear(atrasado.egresos + meses.reduce((s, m) => s + m.egresos, 0)),
    neto: 0,
  }
  totales.neto = redondear(totales.ingresos - totales.egresos)
  // § 🧮 — lo repartido en los meses (más lo atrasado) contra la suma de lo que entró al horizonte, y el acumulado final
  // contra el neto total.
  const diferencias: string[] = []
  if (Math.abs(totales.ingresos + totales.egresos - redondear(dentro)) > 0.01) diferencias.push(`repartido ${redondear(totales.ingresos + totales.egresos)} ≠ entró ${redondear(dentro)}`)
  if (Math.abs((meses[11]?.acumulado ?? 0) - totales.neto) > 0.01) diferencias.push(`acumulado ${meses[11]?.acumulado} ≠ neto ${totales.neto}`)
  return { desde: `${primero}-01`, hasta: ultimo, atrasado, meses, totales, control: { cierra: diferencias.length === 0, diferencias } }
}
