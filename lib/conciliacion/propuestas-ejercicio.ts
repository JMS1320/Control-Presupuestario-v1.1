/**
 * 🏦 **PROPUESTAS DE CONCILIACIÓN DEL EJERCICIO** — A-FEAT-1430 paso 4 (JMS 30/10: *«muchas cosas quedaron sin conciliar
 * pero están pagadas, por ahí quedó mal registrado el pago… dale tiempo, vas a poder ver qué correcciones hace falta
 * hacerle a cada cosa para que pueda conciliar… si no conciliamos, no podemos entregar»*; y: *«andá al 4 que es de los
 * medulares»*).
 *
 * El motor de la app busca la pareja **sólo entre lo que sigue en el Cash Flow** (pendiente) y por importe exacto ±5
 * días. Esto busca en **todo** lo registrado —facturas, cuotas, sueldos, anticipos, cobros, cheques— aunque figure
 * pagado, por las dos puntas:
 *  - **movimiento sin conciliar → qué lo explica** y qué hay que corregir para que concilie;
 *  - **deuda del ejercicio sin pago → qué movimiento la pagó** (la que pega en el balance: una factura «pendiente» al
 *    cierre sale como cuenta a pagar).
 *
 * Criterios, del más firme al más flojo — ninguno escribe, todo es propuesta:
 *  1. EXACTO        mismo importe (±$1), misma empresa, una sola pareja libre.
 *  2. AGRUPADO      mismo CUIT, 2 a 5 comprobantes libres que suman el importe.
 *  3. CON_DIF       mismo CUIT, una pareja libre con diferencia ≤ 3 % (retención, descuento, redondeo).
 *  4. VARIOS        más de una pareja exacta: elegir sería adivinar.
 *  5. OTRA_EMPRESA  la pareja exacta es de otra empresa → pagado por cuenta y orden (aporte / retiro).
 *  6. YA_USADA      la pareja exacta ya tiene otro movimiento → ¿duplicado o vínculo equivocado?
 *  7. CUIT_SIN_CIERRE el proveedor tiene comprobantes libres, ninguno (ni sumados) da el importe.
 *  8. SIN_PAREJA    nada; la pista dice qué es probablemente.
 *  —  HISTORICO_FACTURA  histórico de MSA jul–nov 2025: por decisión NO se concilian las facturas (A-FEAT-1315).
 *
 * Una sola implementación: la usan la app (el recorrido del balance) y `scripts/propuestas-conciliacion-2526.mts`.
 */
import { TABLAS_CON_VINCULO_ARCA } from "./tablas-con-vinculo-arca"

export type TipoPropuesta = "EXACTO" | "AGRUPADO" | "CON_DIF" | "VARIOS" | "OTRA_EMPRESA" | "YA_USADA" | "CUIT_SIN_CIERRE" | "SIN_PAREJA" | "HISTORICO_FACTURA"

export const TIPOS_PROPUESTA: Record<TipoPropuesta, string> = {
  EXACTO: "Pareja exacta", AGRUPADO: "Pago de varios comprobantes", CON_DIF: "Con diferencia",
  VARIOS: "Varias parejas posibles", OTRA_EMPRESA: "La pareja es de otra empresa", YA_USADA: "La pareja ya está usada",
  CUIT_SIN_CIERRE: "El proveedor tiene comprobantes que no cierran", SIN_PAREJA: "Sin pareja", HISTORICO_FACTURA: "Histórico jul–nov (no se concilia)",
}
/** El orden en que conviene recorrerlas: primero lo que se resuelve en un clic. */
export const ORDEN_PROPUESTA: TipoPropuesta[] = ["EXACTO", "AGRUPADO", "CON_DIF", "VARIOS", "YA_USADA", "OTRA_EMPRESA", "CUIT_SIN_CIERRE", "SIN_PAREJA", "HISTORICO_FACTURA"]

/** Una cuenta cuyos movimientos se proponen conciliar. `cuentaId` = el id de CUENTAS_BANCARIAS (para el link). */
export interface CuentaConciliable { empresa: "MSA" | "PAM" | "MA"; schema: string; tabla: string; cuentaId: string; nombre: string; leyendas: boolean }

/** Las cuentas en pesos de cada empresa (las de dólares no: sus importes no se comparan contra comprobantes en pesos). */
export const CUENTAS_CONCILIABLES: CuentaConciliable[] = [
  { empresa: "MSA", schema: "public", tabla: "msa_galicia", cuentaId: "msa_galicia", nombre: "MSA Galicia", leyendas: true },
  { empresa: "MSA", schema: "msa", tabla: "tarjeta_visa_business", cuentaId: "tarjeta_visa_business_msa", nombre: "MSA Visa", leyendas: false },
  { empresa: "MSA", schema: "msa", tabla: "caja_general", cuentaId: "caja_general", nombre: "MSA Caja general", leyendas: false },
  { empresa: "MSA", schema: "msa", tabla: "caja_ams", cuentaId: "caja_ams", nombre: "MSA Caja AMS", leyendas: false },
  { empresa: "MSA", schema: "msa", tabla: "caja_sigot", cuentaId: "caja_sigot", nombre: "MSA Caja Sigot", leyendas: false },
  { empresa: "MSA", schema: "msa", tabla: "santander", cuentaId: "msa_santander", nombre: "MSA Santander", leyendas: false },
  { empresa: "MSA", schema: "msa", tabla: "provincia", cuentaId: "msa_provincia", nombre: "MSA Provincia", leyendas: false },
  { empresa: "PAM", schema: "public", tabla: "pam_galicia", cuentaId: "pam_galicia", nombre: "PAM Galicia CA", leyendas: true },
  { empresa: "PAM", schema: "public", tabla: "pam_galicia_cc", cuentaId: "pam_galicia_cc", nombre: "PAM Galicia CC", leyendas: true },
  { empresa: "PAM", schema: "pam", tabla: "tarjeta_visa", cuentaId: "tarjeta_visa_pam", nombre: "PAM Visa", leyendas: false },
  { empresa: "MA", schema: "ma", tabla: "ma_galicia", cuentaId: "ma_galicia", nombre: "MA Galicia", leyendas: true },
  { empresa: "MA", schema: "ma", tabla: "tarjeta_visa", cuentaId: "tarjeta_visa_ma", nombre: "MA Visa", leyendas: false },
]

/** De `tabla:id` (cómo se anota un vínculo) a la cuenta, para poder abrir el OTRO movimiento. */
export const cuentaDeTabla = (tabla: string, empresa?: string) =>
  CUENTAS_CONCILIABLES.find(c => c.tabla === tabla && (!empresa || c.empresa === empresa)) ?? CUENTAS_CONCILIABLES.find(c => c.tabla === tabla)

export type OrigenObligacion = "factura" | "factura-neta-sicore" | "NC" | "cuota" | "anticipo" | "sueldo" | "venta" | "echeq"
export const ORIGEN_TEXTO: Record<OrigenObligacion, string> = {
  factura: "Factura", "factura-neta-sicore": "Factura (neta de SICORE)", NC: "Nota de crédito", cuota: "Cuota de template",
  anticipo: "Anticipo", sueldo: "Sueldo", venta: "Venta", echeq: "Cheque / echeq",
}

/** Algo registrado que espera un movimiento del banco. */
export interface Obligacion {
  empresa: string
  origen: OrigenObligacion
  /** El id que se vincula (para el cheque: el de su factura o anticipo). */
  id: string
  fecha: string | null
  importe: number
  estado: string
  quien: string
  cuit: string
  grupo?: string | null
  signo: "D" | "C"
  /** Para describirla: tipo-PV-número, el template, el número de cheque… */
  ref?: string
  /** Para el link: el template de la cuota. */
  egresoId?: string | null
}

export interface MovimientoSinConciliar {
  cuenta: CuentaConciliable
  id: string
  fecha: string
  importe: number
  lado: "D" | "C"
  estado: string
  descripcion: string
  quienBanco?: string
  cuitBanco?: string
  detalle?: string
  categ?: string
}

export interface Pareja extends Obligacion {
  dias?: number
  diferencia?: number
  /** Si ya está usada: por qué movimientos (`tabla:id`). */
  vinculadaA?: string[]
}

export interface PropuestaMovimiento {
  mov: MovimientoSinConciliar
  tipo: TipoPropuesta
  propuesta: string
  pista: string
  parejas: Pareja[]
}

export interface PropuestaDeuda {
  obligacion: Obligacion
  /** Movimientos sin conciliar del mismo importe, cerca de la fecha: probablemente el pago. */
  candidatos: MovimientoSinConciliar[]
  /** Movimientos YA conciliados del mismo importe: quizás conciliados contra otra cosa. */
  yaConciliados: Array<{ tabla: string; id: string; fecha: string; descripcion: string }>
}

export interface DatosConciliacion {
  movimientos: MovimientoSinConciliar[]
  obligaciones: Obligacion[]
  /** id de obligación (o de su grupo de pago) → movimientos que la usan (`tabla:id`). */
  usadoPor: Map<string, string[]>
  conciliados: Array<{ tabla: string; id: string; fecha: string; debitos: number; creditos: number; descripcion: string }>
  /** Lo que no se pudo leer: se dice, no se calla. */
  avisos: string[]
}

const n = (x: unknown) => Number(x) || 0
const cuitDe = (x: unknown) => String(x ?? "").replace(/\D/g, "")
const dias = (a?: string | null, b?: string | null) => (!a || !b) ? 9999 : Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86400000)
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const CORTE_HIST_FACTURAS = "2025-12-01"
const CUIT_PROPIOS: Record<string, string> = { "30617786016": "MSA", "20044390222": "PAM", "27066824611": "MA" }
const COLS_VINC = ["comprobante_arca_id", "template_cuota_id", "sueldo_pago_id", "anticipo_id", "comprobante_venta_id"]

/** Qué es PROBABLEMENTE un movimiento sin pareja, por lo que dice el banco. Orienta qué corrección buscar. */
export function pistaDe(desc: string, quien: string | undefined, cuit: string | undefined, lado: "D" | "C"): string {
  const d = `${desc ?? ""} ${quien ?? ""}`
  if (cuit && CUIT_PROPIOS[cuit]) return `Transferencia con ${CUIT_PROPIOS[cuit]}: retiro / aporte entre empresas (cuenta corriente del socio)`
  if (/haber/i.test(d)) return "Sueldos: buscar el pago en Sueldos (puede ser un pago repartido en varios)"
  if (/echeq|cheque/i.test(d)) return "Echeq / cheque: va contra el cheque emitido y su factura"
  if (/pago visa|tarjeta|visa empresa/i.test(d)) return "Pago de la tarjeta: va contra el resumen (template de la tarjeta)"
  if (/extracci|cajero|autoservicio/i.test(d)) return "Extracción de efectivo: pasa a caja (template Caja / fondo fijo)"
  if (/afip|arca|vep|arba|agip|munic|rentas|imp\.? ?ley|iibb|ingresos brutos|ganancias/i.test(d)) return "Impuesto: cuota de un template de impuestos (o VEP de un plan)"
  if (/comisi|mantenim|servicio|imp\.? ?deb|imp\.? ?cre|percep|sellos|iva |interes|gasto/i.test(d)) return "Gasto o impuesto del banco: template bancario del mes"
  if (/deb\.? ?autom|debito automatico/i.test(d)) return "Débito automático: template del servicio (luz, gas, seguro…)"
  if (lado === "C") return "Crédito: buscar el cobro de una venta, un reintegro o un aporte"
  if (/trf|transf/i.test(d)) return quien ? `Transferencia a ${quien}: falta su factura, su template o su sueldo` : "Transferencia: falta su factura, su template o su sueldo"
  return "Sin pista: mirar el detalle de la planilla"
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
 * LECTURA (la usan la app, con su cliente, y el script, con el de servicio)
 * ══════════════════════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any
type Fila = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

async function todo(sb: Cliente, schema: string, tabla: string, cols: string, filtro?: (q: Cliente) => Cliente): Promise<Fila[]> {
  const out: Fila[] = []
  for (let desde = 0; ; desde += 1000) {
    let q = (schema === "public" ? sb.from(tabla) : sb.schema(schema).from(tabla)).select(cols).order("id").range(desde, desde + 999)
    if (filtro) q = filtro(q)
    const { data, error } = await q
    if (error) throw new Error(`${schema}.${tabla}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

/**
 * Lee todo lo necesario para proponer las conciliaciones de UNA empresa en el ejercicio [desde, hasta].
 * Las obligaciones se leen de las TRES empresas: una pareja de otra empresa es información (pagado por cuenta y orden).
 */
export async function leerDatosConciliacion(sb: Cliente, empresa: string, desde: string, hasta: string,
  progreso?: (texto: string) => void): Promise<DatosConciliacion> {
  const avisos: string[] = []
  const usadoPor = new Map<string, string[]>()
  const conciliados: DatosConciliacion["conciliados"] = []
  const margenDesde = new Date(Date.parse(desde) - 120 * 86400000).toISOString().slice(0, 10)
  const margenHasta = new Date(Date.parse(hasta) + 60 * 86400000).toISOString().slice(0, 10)

  // 1 · Vínculos existentes en todas las tablas que pueden llevarlos
  progreso?.("leyendo los vínculos ya hechos…")
  for (const t of TABLAS_CON_VINCULO_ARCA) {
    try {
      const prueba = await (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("*").limit(1)
      if (prueba.error) { avisos.push(`${t.tabla}: ${prueba.error.message}`); continue }
      if (!prueba.data?.length) continue
      const cv = COLS_VINC.filter(c => c in prueba.data[0])
      const filas = await todo(sb, t.schema, t.tabla, ["id", "fecha", "debitos", "creditos", "estado", "descripcion", ...cv].join(","))
      for (const f of filas) {
        for (const c of cv) if (f[c]) { const k = String(f[c]); usadoPor.set(k, [...(usadoPor.get(k) ?? []), `${t.tabla}:${f.id}`]) }
        if (String(f.estado).toLowerCase() === "conciliado" && f.fecha >= margenDesde && f.fecha <= margenHasta)
          conciliados.push({ tabla: t.tabla, id: String(f.id), fecha: f.fecha, debitos: n(f.debitos), creditos: n(f.creditos), descripcion: f.descripcion ?? "" })
      }
    } catch (e) { avisos.push(`${t.tabla}: ${(e as Error).message}`) }
  }

  // 2 · Obligaciones (todo lo registrado, cualquier estado)
  progreso?.("leyendo facturas, cuotas, sueldos y cobros…")
  const obligaciones: Obligacion[] = []
  for (const [emp, s] of [["MSA", "msa"], ["PAM", "pam"], ["MA", "ma"]] as const) {
    try {
      const fs = await todo(sb, s, "comprobantes_arca", "id,fecha_emision,fecha_estimada,fecha_pago,tipo_comprobante,punto_venta,numero_desde,cuit,denominacion_emisor,imp_total,monto_a_abonar,monto_sicore,estado,grupo_pago_id",
        q => q.gte("fecha_emision", margenDesde).lte("fecha_emision", margenHasta))
      for (const f of fs) {
        const nc = [3, 8, 13, 53, 113].includes(n(f.tipo_comprobante))
        const imp = Math.abs(n(f.monto_a_abonar) || n(f.imp_total))
        const ref = `${f.tipo_comprobante}-${f.punto_venta}-${f.numero_desde} del ${String(f.fecha_emision).split("-").reverse().join("/")}`
        obligaciones.push({ empresa: emp, origen: nc ? "NC" : "factura", id: String(f.id), fecha: f.fecha_pago ?? f.fecha_emision, importe: imp, estado: String(f.estado ?? ""),
          quien: f.denominacion_emisor ?? "?", cuit: cuitDe(f.cuit), grupo: f.grupo_pago_id, signo: nc ? "C" : "D", ref: `${ref}${n(f.monto_sicore) ? ` · SICORE ${plata(n(f.monto_sicore))}` : ""}` })
        if (n(f.monto_sicore) > 0)
          obligaciones.push({ empresa: emp, origen: "factura-neta-sicore", id: String(f.id), fecha: f.fecha_pago ?? f.fecha_emision, importe: imp - n(f.monto_sicore), estado: String(f.estado ?? ""),
            quien: f.denominacion_emisor ?? "?", cuit: cuitDe(f.cuit), grupo: f.grupo_pago_id, signo: "D", ref: `${ref} · neta de SICORE ${plata(n(f.monto_sicore))}` })
      }
    } catch (e) { avisos.push(`facturas ${emp}: ${(e as Error).message}`) }
    try {
      const vs = await todo(sb, s, "comprobantes_venta", "id,fecha_liquidacion,fecha_acreditacion,fecha_cobro_estimada,cuit_cliente,denominacion_cliente,imp_total,ret_iva,ret_iibb,estado,tipo_comprobante,numero_desde,grupo_cobro_id",
        q => q.gte("fecha_liquidacion", margenDesde).lte("fecha_liquidacion", margenHasta))
      for (const v of vs) {
        const neto = n(v.imp_total) - n(v.ret_iva) - n(v.ret_iibb)
        obligaciones.push({ empresa: emp, origen: "venta", id: String(v.id), fecha: v.fecha_acreditacion ?? v.fecha_cobro_estimada ?? v.fecha_liquidacion, importe: neto, estado: String(v.estado ?? ""),
          quien: v.denominacion_cliente ?? "?", cuit: cuitDe(v.cuit_cliente), grupo: v.grupo_cobro_id, signo: "C",
          ref: `venta ${v.tipo_comprobante}-${v.numero_desde} liq. ${String(v.fecha_liquidacion).split("-").reverse().join("/")}${neto !== n(v.imp_total) ? ` · total ${plata(n(v.imp_total))} menos retenciones` : ""}` })
      }
    } catch (e) { avisos.push(`ventas ${emp}: ${(e as Error).message}`) }
  }
  try {
    const egresos = await todo(sb, "public", "egresos_sin_factura", "id,nombre_referencia,responsable,cuit_quien_cobra,categ")
    const egr = new Map(egresos.map(e => [String(e.id), e]))
    const cuotas = await todo(sb, "public", "cuotas_egresos_sin_factura", "id,egreso_id,fecha_estimada,fecha_vencimiento,fecha_pago,monto,estado,tipo_movimiento,grupo_pago_id",
      q => q.gte("fecha_estimada", margenDesde).lte("fecha_estimada", margenHasta))
    for (const c of cuotas) {
      if (!n(c.monto)) continue
      const e = egr.get(String(c.egreso_id)) ?? {}
      const ingreso = /ingreso|credito|crédito/i.test(String(c.tipo_movimiento ?? ""))
      obligaciones.push({ empresa: String(e.responsable ?? "?").split("/")[0], origen: "cuota", id: String(c.id), fecha: c.fecha_pago ?? c.fecha_estimada ?? c.fecha_vencimiento,
        importe: Math.abs(n(c.monto)), estado: String(c.estado ?? ""), quien: e.nombre_referencia ?? "?", cuit: cuitDe(e.cuit_quien_cobra), grupo: c.grupo_pago_id,
        signo: ingreso || n(c.monto) < 0 ? "C" : "D", ref: `template ${e.nombre_referencia ?? "?"} (${e.categ ?? "sin categ"})`, egresoId: c.egreso_id ? String(c.egreso_id) : null })
    }
  } catch (e) { avisos.push(`cuotas de templates: ${(e as Error).message}`) }
  try {
    const anticipos = await todo(sb, "public", "anticipos_proveedores", "id,cuit_proveedor,nombre_proveedor,monto,fecha_pago,estado,empresa,tipo")
    for (const a of anticipos) obligaciones.push({ empresa: a.empresa ?? "MSA", origen: "anticipo", id: String(a.id), fecha: a.fecha_pago, importe: Math.abs(n(a.monto)), estado: String(a.estado ?? ""),
      quien: a.nombre_proveedor ?? "?", cuit: cuitDe(a.cuit_proveedor), signo: /cobro|cliente|venta/i.test(String(a.tipo)) ? "C" : "D", ref: `anticipo ${a.tipo ?? ""}` })
  } catch (e) { avisos.push(`anticipos: ${(e as Error).message}`) }
  try {
    const empleados = new Map((await todo(sb, "sueldos", "empleados", "id,nombre,empresa,cuit_empleado")).map(e => [String(e.id), e]))
    const pagos = await todo(sb, "sueldos", "pagos", "id,empleado_id,fecha,monto,estado,tipo", q => q.gte("fecha", margenDesde).lte("fecha", margenHasta))
    for (const p of pagos) { const e = empleados.get(String(p.empleado_id)) ?? {}
      obligaciones.push({ empresa: e.empresa ?? "MSA", origen: "sueldo", id: String(p.id), fecha: p.fecha, importe: Math.abs(n(p.monto)), estado: String(p.estado ?? ""),
        quien: e.nombre ?? "?", cuit: cuitDe(e.cuit_empleado), signo: "D", ref: `sueldo ${p.tipo ?? ""}` }) }
  } catch (e) { avisos.push(`sueldos: ${(e as Error).message}`) }
  try {
    const cheques = await todo(sb, "msa", "cheques", "id,numero,monto,fecha_cobro,fecha_emision,beneficiario_nombre,beneficiario_cuit,estado,factura_id,anticipo_id")
    for (const ch of cheques) obligaciones.push({ empresa: "MSA", origen: "echeq", id: String(ch.factura_id ?? ch.anticipo_id ?? ch.id), fecha: ch.fecha_cobro ?? ch.fecha_emision,
      importe: Math.abs(n(ch.monto)), estado: String(ch.estado ?? ""), quien: ch.beneficiario_nombre ?? "?", cuit: cuitDe(ch.beneficiario_cuit), signo: "D",
      ref: `cheque Nº ${ch.numero ?? "(sin número)"} · cobro ${ch.fecha_cobro ?? "?"} · ${ch.estado}` })
  } catch (e) { avisos.push(`cheques: ${(e as Error).message}`) }

  // 3 · Movimientos sin conciliar de las cuentas de la empresa
  progreso?.("leyendo los movimientos sin conciliar…")
  const movimientos: MovimientoSinConciliar[] = []
  for (const c of CUENTAS_CONCILIABLES.filter(x => x.empresa === empresa)) {
    try {
      const cols = ["id", "fecha", "debitos", "creditos", "estado", "descripcion", "categ", "detalle", ...(c.leyendas ? ["leyendas_adicionales_1", "leyendas_adicionales_2"] : [])].join(",")
      // ⚠️ medido 30/10: msa.santander se cargó con «Pendiente» (mayúscula) — el motor del extracto busca «pendiente» y no
      // los toma. Acá se leen igual y se AVISA, para que se corrija el dato (no se adivina en silencio).
      const filas = await todo(sb, c.schema, c.tabla, cols, q => q.gte("fecha", desde).lte("fecha", hasta).in("estado", ["pendiente", "Pendiente", "PENDIENTE", "auditar", "Auditar", "historico"]))
      const mal = filas.filter(f => String(f.estado ?? "") !== String(f.estado ?? "").toLowerCase()).length
      if (mal) avisos.push(`${c.nombre}: ${mal} movimiento(s) con el estado en mayúscula («${filas.find(f => String(f.estado) !== String(f.estado).toLowerCase())?.estado}»): el motor de conciliación del extracto no los toma`)
      for (const m of filas) {
        const lado: "D" | "C" = n(m.debitos) > 0 ? "D" : "C"
        const imp = lado === "D" ? n(m.debitos) : n(m.creditos)
        if (imp < 0.005) continue
        const cuit = cuitDe(m.leyendas_adicionales_2)
        movimientos.push({ cuenta: c, id: String(m.id), fecha: m.fecha, importe: imp, lado, estado: String(m.estado ?? "").toLowerCase(), descripcion: m.descripcion ?? "",
          quienBanco: m.leyendas_adicionales_1 ?? undefined, cuitBanco: cuit.length === 11 ? cuit : undefined, detalle: m.detalle ?? undefined, categ: m.categ ?? undefined })
      }
    } catch (e) { avisos.push(`${c.nombre}: ${(e as Error).message}`) }
  }
  return { movimientos, obligaciones, usadoPor, conciliados, avisos }
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
 * CÁLCULO (puro)
 * ══════════════════════════════════════════════════════════════════════════════════════════ */

export function proponerConciliaciones(d: DatosConciliacion, empresa: string, desde: string, hasta: string): { movimientos: PropuestaMovimiento[]; deudas: PropuestaDeuda[] } {
  const usada = (o: Obligacion) => d.usadoPor.get(o.id) ?? (o.grupo ? d.usadoPor.get(o.grupo) : undefined)
  const libre = (o: Obligacion) => !usada(o)
  const unicos = (l: Obligacion[]) => [...new Map(l.map(o => [o.id, o])).values()]

  const movimientos: PropuestaMovimiento[] = d.movimientos.map(m => {
    const imp = m.importe
    /**
     * 🛡️ Coincidencias de importe que NO son parejas (revisado con datos reales 30/10: «Pago Elvio jornales $ 300.000»
     * contra una cuota de PAM, «alimento gatos $ 4.200» contra el impuesto a los débitos):
     * - si el banco informa un CUIT, una pareja con OTRO CUIT queda afuera (el banco dice a quién se pagó);
     * - la ventana es de 60 días sólo si el CUIT coincide; sin esa confirmación, 20;
     * - un importe REDONDO (múltiplo de $ 1.000) sin CUIT que lo confirme no alcanza para decir «otra empresa» ni
     *   «ya usada»: es probablemente coincidencia, y se dice así.
     */
    const confirmaCuit = (o: Obligacion) => !!m.cuitBanco && o.cuit === m.cuitBanco
    const compatible = (o: Obligacion) => !(m.cuitBanco && o.cuit && o.cuit !== m.cuitBanco)
    const cerca = (o: Obligacion) => o.signo === m.lado && compatible(o) && dias(o.fecha, m.fecha) <= (confirmaCuit(o) ? 60 : 20)
    const exactas = d.obligaciones.filter(o => cerca(o) && Math.abs(o.importe - imp) < 1)
    const redondo = Math.abs(imp % 1000) < 0.005
    const debil = (o: Obligacion) => redondo && !confirmaCuit(o)
    const exLibreMia = unicos(exactas.filter(o => libre(o) && o.empresa === m.cuenta.empresa))
    const exLibreOtra = unicos(exactas.filter(o => libre(o) && o.empresa !== m.cuenta.empresa && !debil(o)))
    const exUsadas = unicos(exactas.filter(o => !libre(o) && !debil(o)))
    const coincidencias = unicos(exactas.filter(o => debil(o) && (o.empresa !== m.cuenta.empresa || !libre(o))))
    const delCuit = m.cuitBanco ? d.obligaciones.filter(o => o.cuit === m.cuitBanco && o.signo === m.lado && libre(o) && o.origen !== "factura-neta-sicore" && dias(o.fecha, m.fecha) <= 150) : []
    const histFactura = m.cuenta.empresa === "MSA" && m.estado === "historico" && m.fecha < CORTE_HIST_FACTURAS
    const pista = pistaDe(m.descripcion, m.quienBanco, m.cuitBanco, m.lado)
    const con = (o: Obligacion, extra: Partial<Pareja> = {}): Pareja => ({ ...o, dias: dias(o.fecha, m.fecha), ...extra })

    let r: Omit<PropuestaMovimiento, "mov" | "pista">
    if (exLibreMia.length === 1) {
      const o = exLibreMia[0]
      r = { tipo: "EXACTO", parejas: [con(o)],
        propuesta: `Conciliar con ${ORIGEN_TEXTO[o.origen].toLowerCase()} ${o.quien} (${o.ref ?? ""}).${o.estado === "pagado" ? " Figura «pagado» sin movimiento: es su pago." : ""}` }
    } else if (exLibreMia.length > 1) {
      r = { tipo: "VARIOS", parejas: exLibreMia.map(o => con(o)), propuesta: `${exLibreMia.length} comprobantes del mismo importe: elegir cuál es (la fecha y el detalle suelen decidirlo).` }
    } else {
      // pago agrupado: 2 a 5 comprobantes libres del mismo CUIT que suman el importe
      let agrupado: Obligacion[] | null = null
      if (delCuit.length >= 2) {
        const cand = delCuit.filter(o => o.importe <= imp + 1).sort((a, b) => dias(a.fecha, m.fecha) - dias(b.fecha, m.fecha)).slice(0, 18)
        const rec = (i: number, suma: number, sel: Obligacion[]) => {
          if (agrupado) return
          if (sel.length >= 2 && Math.abs(suma - imp) < 1) { agrupado = [...sel]; return }
          if (i >= cand.length || sel.length >= 5 || suma > imp + 1) return
          rec(i + 1, suma + cand[i].importe, [...sel, cand[i]]); rec(i + 1, suma, sel)
        }
        rec(0, 0, [])
      }
      // el % es sobre lo registrado (la factura), igual que lo que se muestra
      const cercana = delCuit.filter(o => o.importe > 0 && Math.abs(o.importe - imp) / o.importe <= 0.03).sort((a, b) => Math.abs(a.importe - imp) - Math.abs(b.importe - imp))[0]
      if (agrupado) {
        const g = agrupado as Obligacion[]
        r = { tipo: "AGRUPADO", parejas: g.map(o => con(o)), propuesta: `Pago agrupado: ${g.length} comprobantes de ${g[0].quien} suman exactamente ${plata(imp)}. Conciliar el movimiento contra los ${g.length} (grupo de pago).` }
      } else if (cercana) {
        const dif = Math.round((imp - cercana.importe) * 100) / 100
        r = { tipo: "CON_DIF", parejas: [con(cercana, { diferencia: dif })],
          propuesta: `${ORIGEN_TEXTO[cercana.origen]} de ${cercana.quien} por ${plata(cercana.importe)}; el banco ${m.lado === "D" ? "pagó" : "cobró"} ${plata(imp)}: diferencia ${plata(dif)} (${(Math.abs(dif) / cercana.importe * 100).toFixed(1)} %). Corregir el monto a abonar o registrar la retención / el descuento, y conciliar.` }
      } else if (exLibreOtra.length) {
        const o = exLibreOtra[0]
        r = { tipo: "OTRA_EMPRESA", parejas: exLibreOtra.map(o2 => con(o2)),
          propuesta: `La pareja exacta es de ${o.empresa}: ${ORIGEN_TEXTO[o.origen].toLowerCase()} ${o.quien}. Lo pagó ${m.cuenta.empresa} por cuenta y orden de ${o.empresa} → retiro/aporte entre empresas (cuenta corriente), a confirmar.` }
      } else if (exUsadas.length) {
        const o = exUsadas[0]
        r = { tipo: "YA_USADA", parejas: exUsadas.map(o2 => con(o2, { vinculadaA: usada(o2) })),
          propuesta: `${ORIGEN_TEXTO[o.origen]} ${o.quien} por el mismo importe ya está conciliada con otro movimiento (${(usada(o) ?? []).join(", ")}). ¿Es un pago duplicado, o el vínculo está con el movimiento equivocado?` }
      } else if (delCuit.length) {
        r = { tipo: "CUIT_SIN_CIERRE", parejas: delCuit.slice(0, 8).map(o => con(o)),
          propuesta: `${m.quienBanco ?? "El proveedor"} tiene ${delCuit.length} comprobante(s) libres, pero ninguno (ni sumados) da ${plata(imp)}. Revisar montos (¿retención, anticipo?) o falta un comprobante.` }
      } else {
        r = { tipo: histFactura ? "HISTORICO_FACTURA" : "SIN_PAREJA", parejas: [],
          propuesta: histFactura ? "Histórico jul–nov 2025: si es pago de factura, por decisión no se concilia (A-FEAT-1315)."
            : `Sin pareja en lo registrado. ${pista}.${coincidencias.length ? ` (Hay ${coincidencias.length} registro(s) por el mismo importe redondo —${coincidencias.slice(0, 2).map(o => o.quien).join(", ")}— pero nada los confirma: probable coincidencia.)` : ""}` }
      }
    }
    return { mov: m, pista, ...r }
  })

  // Deudas de ESTA empresa en el ejercicio, sin movimiento, en un estado que dice «abierta»
  const ABIERTAS = ["pendiente", "pagar", "preparado", "pagado", "cuotas", "credito", "debito", "a cobrar", "cobrado"]
  const deudas: PropuestaDeuda[] = d.obligaciones
    .filter(o => o.empresa === empresa && o.origen !== "factura-neta-sicore" && o.origen !== "anticipo" && o.origen !== "echeq"
      && !!o.fecha && o.fecha >= desde && o.fecha <= hasta && ABIERTAS.includes(o.estado.toLowerCase()) && libre(o))
    .map(o => ({
      obligacion: o,
      candidatos: d.movimientos.filter(m => m.lado === o.signo && Math.abs(m.importe - o.importe) < 1 && dias(m.fecha, o.fecha) <= 90),
      yaConciliados: d.conciliados.filter(c => Math.abs((o.signo === "D" ? c.debitos : c.creditos) - o.importe) < 1 && dias(c.fecha, o.fecha) <= 90).slice(0, 5),
    }))

  return { movimientos, deudas }
}
