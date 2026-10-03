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

  { id: "stock_cria", rubro: "stock_ganadero", etiqueta: "Stock de cría", nota: "JMS: valuación propia" },
  { id: "stock_recria", rubro: "stock_ganadero", etiqueta: "Stock de recría", nota: "JMS: valuación propia" },
  { id: "equinos", rubro: "stock_ganadero", etiqueta: "Equinos", nota: "JMS no los pone" },

  { id: "bienes_uso_neto", rubro: "bienes_uso", etiqueta: "Bienes de uso (neto de amortizaciones)", nota: "JMS no los pone, salvo compra reciente" },

  { id: "proveedores", rubro: "deudas_comerciales", etiqueta: "Proveedores" },
  { id: "tarjetas", rubro: "deudas_comerciales", etiqueta: "Tarjetas de crédito", nota: "JMS la suma a proveedores" },
  { id: "provision_gastos", rubro: "deudas_comerciales", etiqueta: "Provisión para gastos" },
  { id: "otras_deudas_comerciales", rubro: "deudas_comerciales", etiqueta: "Otras deudas" },

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
  for (const v of valores) {
    if (v.version !== version) continue
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
  return valores
    .filter(v => v.version === version && RENGLON_DE.get(v.renglon)?.rubro === rubroId)
    .reduce((s, v) => s + v.importe, 0)
}

/** Parseo de un monto es-AR escrito a mano. Vacío = sin valor (null), no cero. */
export function parsearMonto(texto: string): number | null {
  const t = texto.trim()
  if (!t) return null
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}
