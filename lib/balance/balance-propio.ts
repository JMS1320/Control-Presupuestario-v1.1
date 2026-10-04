/**
 * 📸 **EL BALANCE PROPIO — activo menos pasivo, fin menos inicio, en pesos y en dólares.**
 * A-FEAT-1190 · decisión A-DEC-1001 (2026-10-03).
 *
 * Es el balance que el usuario arma para él, aparte del del contador: *«determinación de ganancia
 * según activo menos pasivo»*. El catálogo de renglones es su solapa **NOTAS** (`BAPU JMS USS 2025.xlsx`).
 *
 * ## La idea que ordena todo: la FOTO
 * Un balance es un **dato duro**: una vez puesto, no cambia aunque cambie el origen (*«a lo sumo puede
 * dar alerta»*). Por eso se guarda **una foto por empresa y fecha de cierre** (`public.balance_fotos`)
 * y adentro **un valor por renglón y por versión** (`public.balance_foto_valores`):
 * - **contador** — lo que dice su balance;
 * - **jms** — el criterio propio del usuario (stock, insumos y caja valuados a su manera);
 * - **sistema** / **senasa** — fuentes extra, para comparar (p. ej. el stock según SENASA).
 *
 * El cierre de una foto **es el inicio** de la siguiente: la ganancia es foto nueva − foto anterior.
 *
 * ## Los cuatro resultados (usuario, 2026-10-03)
 * activo − pasivo **corriente** y activo − pasivo **total**, en **pesos** y en **US$** (cada foto con
 * el TC de SU fecha, guardado en la foto: si se reimporta una cotización los US$ no se mueven).
 *
 * Todo lo de acá es lógica pura — probada en `lib/pruebas/casos.ts`, sin tocar la base.
 */

export type Lado = "activo" | "pasivo"
export type Version = "contador" | "jms" | "sistema" | "senasa"

export const VERSIONES: { id: Version; etiqueta: string }[] = [
  { id: "contador", etiqueta: "Contador" },
  { id: "jms", etiqueta: "JMS" },
  { id: "sistema", etiqueta: "Sistema" },
  { id: "senasa", etiqueta: "SENASA" },
]

export interface Rubro {
  id: string
  etiqueta: string
  lado: Lado
  corriente: boolean
}

export interface Renglon {
  id: string
  rubro: string
  etiqueta: string
  /** Una nota del usuario sobre cómo lo trata (va en pantalla, chica). */
  nota?: string
}

/**
 * Los rubros, en el orden de la solapa NOTAS. El signo lo da el lado: los importes se guardan
 * **en positivo** y un pasivo resta. Un valor negativo en un activo es posible (p. ej. una cuenta
 * regularizadora) y se respeta.
 */
export const RUBROS: Rubro[] = [
  { id: "caja_bancos", etiqueta: "Caja y bancos", lado: "activo", corriente: true },
  { id: "creditos_impositivos", etiqueta: "Créditos impositivos", lado: "activo", corriente: true },
  { id: "otros_creditos", etiqueta: "Otros créditos", lado: "activo", corriente: true },
  { id: "bienes_cambio", etiqueta: "Bienes de cambio", lado: "activo", corriente: true },
  { id: "insumos", etiqueta: "Insumos para la producción", lado: "activo", corriente: true },
  { id: "stock_ganadero", etiqueta: "Stock ganadero", lado: "activo", corriente: false },
  { id: "bienes_uso", etiqueta: "Bienes de uso", lado: "activo", corriente: false },
  { id: "deudas_comerciales", etiqueta: "Deudas comerciales", lado: "pasivo", corriente: true },
  { id: "deudas_fiscales", etiqueta: "Deudas fiscales", lado: "pasivo", corriente: true },
  { id: "deudas_sociales", etiqueta: "Deudas sociales", lado: "pasivo", corriente: true },
  { id: "deudas_financieras", etiqueta: "Deudas financieras", lado: "pasivo", corriente: true },
  { id: "deudas_financieras_nc", etiqueta: "Deudas financieras no corrientes", lado: "pasivo", corriente: false },
  { id: "otras_deudas_nc", etiqueta: "Otras deudas no corrientes", lado: "pasivo", corriente: false },
]

export const RENGLONES: Renglon[] = [
  { id: "caja", rubro: "caja_bancos", etiqueta: "Caja" },
  { id: "caja_dolares", rubro: "caja_bancos", etiqueta: "Caja dólares" },
  { id: "dolares_mep", rubro: "caja_bancos", etiqueta: "Dólar MEP comprados en el ejercicio", nota: "sólo lo comprado o vendido en el ejercicio, no lo que había" },
  { id: "distribucion_fondos", rubro: "caja_bancos", etiqueta: "Distribución de fondos en el ejercicio" },
  { id: "valores_depositar", rubro: "caja_bancos", etiqueta: "Valores a depositar" },
  { id: "banco_galicia", rubro: "caja_bancos", etiqueta: "Banco Galicia" },
  { id: "fci", rubro: "caja_bancos", etiqueta: "Fondos comunes de inversión" },
  { id: "banco_galicia_usd", rubro: "caja_bancos", etiqueta: "Banco Galicia cta. USD", nota: "JMS no la pone: sólo compras y ventas" },
  { id: "banco_nacion", rubro: "caja_bancos", etiqueta: "Banco Nación cta. cte." },
  { id: "banco_santander", rubro: "caja_bancos", etiqueta: "Banco Santander cta. cte." },
  { id: "banco_provincia", rubro: "caja_bancos", etiqueta: "Banco Provincia cta. cte." },

  { id: "ret_ganancias", rubro: "creditos_impositivos", etiqueta: "Retenciones Imp. a las Ganancias" },
  { id: "perc_ganancias", rubro: "creditos_impositivos", etiqueta: "Percepciones Imp. a las Ganancias" },
  { id: "saldo_favor_ganancias", rubro: "creditos_impositivos", etiqueta: "Saldo a favor Ganancias anteriores" },
  { id: "saldo_favor_iibb", rubro: "creditos_impositivos", etiqueta: "Saldo a favor Ingresos Brutos" },
  { id: "anticipos_ganancias", rubro: "creditos_impositivos", etiqueta: "Anticipos Imp. a las Ganancias" },
  { id: "iva_libre_disponibilidad", rubro: "creditos_impositivos", etiqueta: "IVA saldo de libre disponibilidad" },
  { id: "iva_saldo_tecnico", rubro: "creditos_impositivos", etiqueta: "IVA saldo técnico" },
  { id: "impuesto_cheque", rubro: "creditos_impositivos", etiqueta: "Crédito Impuesto Ley 25.413 (cheque)" },

  { id: "deudores_ventas", rubro: "otros_creditos", etiqueta: "Deudores por ventas" },
  { id: "anticipos_proveedores", rubro: "otros_creditos", etiqueta: "Anticipos a proveedores" },
  { id: "otros_creditos_comerciales", rubro: "otros_creditos", etiqueta: "Otros créditos comerciales" },
  { id: "cuenta_socios", rubro: "otros_creditos", etiqueta: "Cuenta socios", nota: "para JMS son retiros" },

  { id: "cereales", rubro: "bienes_cambio", etiqueta: "Cereales" },
  { id: "sementeras_agricolas", rubro: "bienes_cambio", etiqueta: "Sementeras agrícolas" },
  { id: "sementeras_ganaderas", rubro: "bienes_cambio", etiqueta: "Sementeras ganaderas" },

  { id: "insumos_agricolas", rubro: "insumos", etiqueta: "Insumos agrícolas", nota: "JMS: valor real" },
  { id: "insumos_ganaderos", rubro: "insumos", etiqueta: "Insumos ganaderos", nota: "JMS: valor real" },
  { id: "insumos_otros", rubro: "insumos", etiqueta: "Gas oil y otros (ambos ámbitos)" },

  { id: "stock_cria", rubro: "stock_ganadero", etiqueta: "Stock de cría", nota: "JMS: valuación propia" },
  { id: "stock_recria", rubro: "stock_ganadero", etiqueta: "Stock de recría", nota: "JMS: valuación propia" },
  { id: "equinos", rubro: "stock_ganadero", etiqueta: "Equinos", nota: "JMS no los pone" },

  { id: "bienes_uso_neto", rubro: "bienes_uso", etiqueta: "Bienes de uso (neto de amortizaciones)", nota: "JMS no los pone, salvo compra reciente" },

  { id: "proveedores", rubro: "deudas_comerciales", etiqueta: "Proveedores" },
  { id: "tarjetas", rubro: "deudas_comerciales", etiqueta: "Tarjetas de crédito", nota: "JMS la suma a proveedores" },
  { id: "provision_gastos", rubro: "deudas_comerciales", etiqueta: "Provisión para gastos" },
  { id: "otras_deudas_comerciales", rubro: "deudas_comerciales", etiqueta: "Otras deudas" },
  { id: "anticipos_clientes", rubro: "deudas_comerciales", etiqueta: "Anticipos de clientes", nota: "plata que un cliente adelantó: es deuda al cierre" },

  { id: "ganancias_a_pagar", rubro: "deudas_fiscales", etiqueta: "Impuesto a las Ganancias a pagar" },
  { id: "iibb_a_pagar", rubro: "deudas_fiscales", etiqueta: "IIBB a pagar" },
  { id: "iva_a_pagar", rubro: "deudas_fiscales", etiqueta: "IVA a pagar" },
  { id: "retenciones_a_depositar", rubro: "deudas_fiscales", etiqueta: "Retenciones a depositar" },

  { id: "sueldos_a_pagar", rubro: "deudas_sociales", etiqueta: "Sueldos a pagar" },
  { id: "cargas_sociales", rubro: "deudas_sociales", etiqueta: "Cargas sociales a pagar" },
  { id: "cuota_solidaria", rubro: "deudas_sociales", etiqueta: "Cuota solidaria a pagar" },

  { id: "prestamos", rubro: "deudas_financieras", etiqueta: "Préstamos (porción corriente)" },
  { id: "cheques_pendientes", rubro: "deudas_financieras", etiqueta: "Cheques pendientes de débito", nota: "el contador lo resta en bancos; acá va como deuda" },

  { id: "prestamos_nc", rubro: "deudas_financieras_nc", etiqueta: "Préstamos (no corriente)" },

  { id: "impuesto_diferido", rubro: "otras_deudas_nc", etiqueta: "Pasivo por impuesto diferido", nota: "tal cual el contador; no corriente: se ejecuta sólo si se venden las vacas" },
]

const RUBRO_DE = new Map(RUBROS.map(r => [r.id, r]))
const RENGLON_DE = new Map(RENGLONES.map(r => [r.id, r]))

export const rubroDelRenglon = (renglonId: string): Rubro | undefined => {
  const r = RENGLON_DE.get(renglonId)
  return r ? RUBRO_DE.get(r.rubro) : undefined
}

/** Un valor guardado: renglón + versión + importe en pesos. */
export interface ValorFoto {
  renglon: string
  version: Version
  importe: number
}

export interface Resultados {
  activo: number
  pasivoCorriente: number
  pasivoTotal: number
  /** activo − pasivo corriente */
  netoCorriente: number
  /** activo − pasivo total */
  netoTotal: number
}

/**
 * Activo, pasivo y los dos netos de UNA versión en UNA foto, en pesos. Un renglón que no está en el
 * catálogo **no se descarta en silencio**: se devuelve en `desconocidos`.
 */
export function resultadosDeVersion(valores: ValorFoto[], version: Version): Resultados & { desconocidos: string[] } {
  let activo = 0, pasivoCorriente = 0, pasivoTotal = 0
  const desconocidos: string[] = []
  // En JMS, un renglón vacío toma el del sistema (default del dato real).
  for (const v of valoresEfectivos(valores, version)) {
    const rubro = rubroDelRenglon(v.renglon)
    if (!rubro) { desconocidos.push(v.renglon); continue }
    if (rubro.lado === "activo") activo += v.importe
    else {
      pasivoTotal += v.importe
      if (rubro.corriente) pasivoCorriente += v.importe
    }
  }
  return {
    activo, pasivoCorriente, pasivoTotal,
    netoCorriente: activo - pasivoCorriente,
    netoTotal: activo - pasivoTotal,
    desconocidos,
  }
}

/** Lo mismo en dólares, al TC de la foto. Sin TC no hay US$ (se devuelve null, no un cero). */
export function enDolares(r: Resultados, tc: number | null | undefined): Resultados | null {
  if (!tc || tc <= 0) return null
  return {
    activo: r.activo / tc,
    pasivoCorriente: r.pasivoCorriente / tc,
    pasivoTotal: r.pasivoTotal / tc,
    netoCorriente: r.netoCorriente / tc,
    netoTotal: r.netoTotal / tc,
  }
}

/** Los cuatro resultados de un ejercicio: foto de cierre − foto de inicio, en pesos y en US$. */
export interface GananciaDelEjercicio {
  pesosCorriente: number
  pesosTotal: number
  usdCorriente: number | null
  usdTotal: number | null
}

export function gananciaDelEjercicio(
  inicio: { valores: ValorFoto[]; tc: number | null },
  cierre: { valores: ValorFoto[]; tc: number | null },
  version: Version,
): GananciaDelEjercicio {
  const ri = resultadosDeVersion(inicio.valores, version)
  const rc = resultadosDeVersion(cierre.valores, version)
  const ui = enDolares(ri, inicio.tc), uc = enDolares(rc, cierre.tc)
  return {
    pesosCorriente: rc.netoCorriente - ri.netoCorriente,
    pesosTotal: rc.netoTotal - ri.netoTotal,
    usdCorriente: ui && uc ? uc.netoCorriente - ui.netoCorriente : null,
    usdTotal: ui && uc ? uc.netoTotal - ui.netoTotal : null,
  }
}

/** El total de un rubro en una versión (para la grilla). */
export function totalDelRubro(valores: ValorFoto[], rubroId: string, version: Version): number {
  return valoresEfectivos(valores, version)
    .filter(v => RENGLON_DE.get(v.renglon)?.rubro === rubroId)
    .reduce((s, v) => s + v.importe, 0)
}

/** Parseo de un monto es-AR escrito a mano. Vacío = sin valor (null), no cero. */
export function parsearMonto(texto: string): number | null {
  const t = texto.trim()
  if (!t) return null
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

// ══ LA FOTO QUE SE ARMA SOLA — la versión «sistema» (A-FEAT-1190, 2026-10-03) ══════════════════
//
// Pedido del usuario: *«avanzá sobre que la foto del 30/6/26 se arme sola»*. Los números salen de
// los **papeles de trabajo** —los mismos cálculos, no otros—: esta función sólo los reparte en los
// renglones del balance propio. Lo que el sistema no sabe (créditos impositivos, el fondo común,
// las deudas fiscales) **no se inventa**: queda vacío y se completa a mano.

/** Lo mínimo de cada papel que hace falta. Todo opcional: un papel que no se armó no propone nada. */
export interface DatosDeLosPapeles {
  /** Saldos al cierre por cuenta del extracto (`saldo: null` = no se pudo calcular). */
  saldos?: Array<{ nombre: string; saldo: number | null }>
  cuentasAPagar?: { total: number; totalSinDato: number }
  cuentasACobrar?: { total: number; totalSinDato: number }
  cheques?: { total: number; totalSinFecha: number }
  anticipos?: { totalAProveedores: number; totalDeClientes: number }
  /** Hacienda valuada por categoría (`valorTotal: null` = sin precio). */
  hacienda?: Array<{ categoria: string; cabezas: number; valorTotal: number | null }>
  /** Insumos valuados por ámbito: agricola / ganadero / ambos. */
  insumos?: Array<{ ambito: string; valuado: number; huecos: number }>
  granosNetoFinal?: number | null
  sementerasCosto?: number | null
}

export interface ValorPropuesto { renglon: string; importe: number; detalle: string }

const esCaja = (nombre: string) => /caja/i.test(nombre)
const esGalicia = (nombre: string) => /galicia/i.test(nombre)
/** Las categorías de recría las nombra el módulo productivo con «Recria»; el resto es cría. */
export const esRecria = (categoria: string) => /recr[ií]a/i.test(categoria)

/**
 * Reparte lo que calcularon los papeles en los renglones del balance propio. **No suma nada que no
 * esté**: un papel ausente no propone, y una parte que el papel no pudo valuar se dice en `detalle`.
 */
export function propuestaDelSistema(d: DatosDeLosPapeles): ValorPropuesto[] {
  const out: ValorPropuesto[] = []
  const poner = (renglon: string, importe: number, detalle: string) => {
    if (Math.abs(importe) >= 0.005) out.push({ renglon, importe: Math.round(importe * 100) / 100, detalle })
  }
  if (d.saldos) {
    const galicia = d.saldos.filter(x => esGalicia(x.nombre) && x.saldo != null)
    if (galicia.length) poner("banco_galicia", galicia.reduce((a, x) => a + (x.saldo ?? 0), 0), "saldo al cierre del extracto (papel 07)")
    const cajas = d.saldos.filter(x => esCaja(x.nombre))
    const conSaldo = cajas.filter(x => x.saldo != null)
    if (conSaldo.length) poner("caja", conSaldo.reduce((a, x) => a + (x.saldo ?? 0), 0),
      `cajas del sistema (papel 07)${conSaldo.length < cajas.length ? ` — ${cajas.length - conSaldo.length} sin saldo` : ""}`)
  }
  if (d.cuentasAPagar) poner("proveedores", d.cuentasAPagar.total,
    `facturas impagas al cierre (papel 03)${d.cuentasAPagar.totalSinDato ? ` — aparte, $${d.cuentasAPagar.totalSinDato.toFixed(2)} sin dato de pago` : ""}`)
  if (d.cuentasACobrar) poner("deudores_ventas", d.cuentasACobrar.total,
    `ventas sin cobrar al cierre (papel 04)${d.cuentasACobrar.totalSinDato ? ` — aparte, $${d.cuentasACobrar.totalSinDato.toFixed(2)} sin dato de cobro` : ""}`)
  if (d.cheques) poner("cheques_pendientes", d.cheques.total,
    `cheques emitidos sin debitar al cierre (04.1)${d.cheques.totalSinFecha ? ` — aparte, $${d.cheques.totalSinFecha.toFixed(2)} sin fecha de débito` : ""}`)
  if (d.anticipos) {
    poner("anticipos_proveedores", d.anticipos.totalAProveedores, "anticipos a proveedores al cierre (04.2)")
    poner("anticipos_clientes", d.anticipos.totalDeClientes, "anticipos de clientes al cierre (04.2)")
  }
  if (d.hacienda) {
    for (const [renglon, filtro, nombre] of [["stock_recria", true, "recría"], ["stock_cria", false, "cría"]] as const) {
      const filas = d.hacienda.filter(h => esRecria(h.categoria) === filtro && h.cabezas > 0)
      if (!filas.length) continue
      const valuadas = filas.filter(h => h.valorTotal != null)
      const sinPrecio = filas.filter(h => h.valorTotal == null)
      poner(renglon, valuadas.reduce((a, h) => a + (h.valorTotal ?? 0), 0),
        `${nombre}: ${filas.reduce((a, h) => a + h.cabezas, 0)} cabezas valuadas a mercado (papel de hacienda)`
        + (sinPrecio.length ? ` — SIN precio: ${sinPrecio.map(h => `${h.categoria} (${h.cabezas})`).join(", ")}` : ""))
    }
  }
  if (d.insumos) {
    const MAPA: Record<string, string> = { agricola: "insumos_agricolas", ganadero: "insumos_ganaderos", ambos: "insumos_otros" }
    for (const g of d.insumos) {
      const renglon = MAPA[g.ambito] ?? "insumos_otros"
      poner(renglon, g.valuado, `stock de insumos (${g.ambito})${g.huecos ? ` — ${g.huecos} producto(s) sin precio` : ""}`)
    }
  }
  if (d.granosNetoFinal != null) poner("cereales", d.granosNetoFinal, "granos al cierre, neto de calidad y gastos (papel de granos)")
  if (d.sementerasCosto != null) poner("sementeras_agricolas", d.sementerasCosto, "costo de las órdenes ejecutadas (papel de sementeras)")
  return out
}

/**
 * 🎚️ **Default del dato real**: en la versión JMS, un renglón vacío toma el valor del sistema.
 * Campo lleno = «acá mando yo». La versión contador NO toma nada: es lo que dice el contador.
 */
export function valoresEfectivos(valores: ValorFoto[], version: Version): ValorFoto[] {
  const propios = valores.filter(v => v.version === version)
  if (version !== "jms") return propios
  const tiene = new Set(propios.map(v => v.renglon))
  const delSistema = valores.filter(v => v.version === "sistema" && !tiene.has(v.renglon)).map(v => ({ ...v, version: "jms" as Version }))
  return [...propios, ...delSistema]
}

/** Lo guardado contra lo que el sistema dice hoy: el aviso, sin pisar nada. */
export interface CambioDelSistema { renglon: string; guardado: number | null; hoy: number | null }

export function cambiosContraLoGuardado(guardado: ValorFoto[], propuesta: ValorPropuesto[]): CambioDelSistema[] {
  const antes = new Map(guardado.filter(v => v.version === "sistema").map(v => [v.renglon, v.importe]))
  const ahora = new Map(propuesta.map(p => [p.renglon, p.importe]))
  const out: CambioDelSistema[] = []
  for (const r of new Set([...antes.keys(), ...ahora.keys()])) {
    const a = antes.get(r) ?? null, h = ahora.get(r) ?? null
    if (a === null || h === null ? a !== h : Math.abs(a - h) >= 0.01) out.push({ renglon: r, guardado: a, hoy: h })
  }
  return out
}
