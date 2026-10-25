/**
 * 📅 **LAS CUOTAS QUE GENERA EL ASISTENTE DE TEMPLATES** (A-FEAT-1302, 2026-10-20).
 *
 * Salen del asistente para poder probarlas (`lib/pruebas/casos.ts`) y para que la conciliación use las
 * mismas. Dos arreglos respecto de lo que hacía el asistente adentro:
 *
 * 1. **El año sale de la CAMPAÑA, no de hoy.** Antes generaba siempre enero→diciembre del año en curso:
 *    un template de campaña jul–jun («25/26») quedaba con las cuotas de ene–jun en la campaña equivocada,
 *    y uno creado desde la conciliación de un movimiento de otro año, en el año de hoy.
 *    Bianual («25/26»): julio→diciembre van en 2025 y enero→junio en 2026.
 * 2. **Las fechas se arman como texto `AAAA-MM-DD`**, sin `new Date().toISOString()`: un día del
 *    calendario es hora argentina (§ 🕐 de `CLAUDE.md`), y pasar por UTC puede correrlo un día.
 *
 * Un template **abierto** (los que se cargan con los movimientos: comisiones, peajes por tarjeta…) no
 * lleva cuotas precargadas — decisión del usuario: *«si el template es de los que se cargan con
 * movimientos automáticos no le precargamos cuotas; los mensuales o más fijos deben tener esos
 * vencimientos presentes, para recordarlos y que quede presupuestado»*.
 */
import type { Periodicidad } from "./nuevo-desde-conciliacion"

export interface ConfigRecurrencia {
  tipo: "mensual" | "anual" | "cuotas_especificas"
  dia_mes?: number
  ultimo_dia_mes?: boolean
  fecha_anual?: string
  meses_especificos?: number[]
  dia_default?: number
  ultimo_dia_mes_cuotas?: boolean
  incluir_aguinaldo?: boolean
}

export interface CuotaDelTemplate {
  mes: number
  fecha_estimada: string
  fecha_vencimiento: string
  monto: number
}

const dos = (n: number) => String(n).padStart(2, "0")
const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate()

/** El año calendario en que cae `mes` dentro de la campaña («2026» o «25/26»). */
export function añoDelMes(campana: string, periodicidad: Periodicidad, mes: number): number {
  if (periodicidad === "bianual" || campana.includes("/")) {
    const y1 = 2000 + Number(campana.split("/")[0])
    return mes >= 7 ? y1 : y1 + 1
  }
  return Number(campana)
}

function fecha(a: number, m: number, dia: number): string {
  return `${a}-${dos(m)}-${dos(Math.min(dia, ultimoDia(a, m)))}`
}

/** Los meses en el orden de la campaña: ene→dic (anual) o jul→jun (bianual). */
const ordenDeMeses = (periodicidad: Periodicidad) =>
  periodicidad === "bianual" ? [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export function generarCuotasTemplate(opts: {
  abierto: boolean
  config: ConfigRecurrencia
  montoBase: number
  campana: string
  periodicidad: Periodicidad
}): CuotaDelTemplate[] {
  const { abierto, config, montoBase, campana, periodicidad } = opts
  if (abierto || !campana) return []
  const cuota = (m: number, dia: number, monto = montoBase): CuotaDelTemplate => {
    const f = fecha(añoDelMes(campana, periodicidad, m), m, dia)
    return { mes: m, fecha_estimada: f, fecha_vencimiento: f, monto }
  }
  if (config.tipo === "mensual") {
    return ordenDeMeses(periodicidad).map(m => {
      const dia = config.ultimo_dia_mes ? 31 : (config.dia_mes || 15)
      const monto = config.incluir_aguinaldo && (m === 6 || m === 12) ? montoBase * 1.5 : montoBase
      return cuota(m, dia, monto)
    })
  }
  if (config.tipo === "anual") {
    const f = String(config.fecha_anual || "").slice(0, 10)
    const [, m, d] = f.split("-").map(Number)
    if (!m || !d) return []
    return [cuota(m, d)]
  }
  const meses = new Set(config.meses_especificos || [])
  return ordenDeMeses(periodicidad).filter(m => meses.has(m))
    .map(m => cuota(m, config.ultimo_dia_mes_cuotas ? 31 : (config.dia_default || 15)))
}

/**
 * 🔗 **La cuota del cronograma que paga ESTE movimiento**: la del mismo mes y año. Así la conciliación
 * se ata a la cuota que ya existe en vez de crear una extra (que dejaría ese mes duplicado en el
 * presupuesto). Si no hay ninguna de ese mes, `null`: se crea la cuota nueva como siempre.
 */
export function cuotaDelMovimiento<T extends { id: string; fecha_estimada?: string | null; fecha_vencimiento?: string | null }>(
  cuotas: T[], fechaMovimiento: string,
): T | null {
  const mes = String(fechaMovimiento).slice(0, 7)
  const delMes = cuotas.filter(c => String(c.fecha_vencimiento || c.fecha_estimada || "").slice(0, 7) === mes)
  return delMes.length === 1 ? delMes[0] : null
}

/**
 * 🔗 **A-FEAT-1302 — la regla usa la cuota PENDIENTE del mes en vez de crear otra.**
 *
 * Antes la conciliación por regla insertaba siempre una cuota nueva. Con las cuotas del cronograma ya
 * cargadas (Seguro Chalet, Internet NZ, ACA: mensuales «pendientes hasta que se concilien», pedido del
 * usuario 2026-10-20), eso dejaba el mes **duplicado**: la proyectada sin conciliar y la nueva conciliada.
 *
 * Elige entre las pendientes del mismo mes y año la de importe más cercano (Chubb tiene dos por mes del
 * mismo importe: la primera conciliación toma una y la segunda la otra). Si no hay, `null`: se crea la
 * cuota nueva como siempre.
 */
/**
 * ⚠️ **cambió 2026-10-25 (A-FEAT-1365)** — antes buscaba sólo en el MISMO MES y sólo cuotas «pendiente».
 * Usuario: *«sí, hacé 1 y 2»*, después de ver que AYSA Libertad tenía sus cuotas en estado **«débito»**
 * (se pagan por débito automático: siguen esperando el movimiento) y que el ABL pagado el 23/02 tenía su
 * cuota precargada el 05/03 — los dos casos creaban una cuota nueva y dejaban el mes duplicado.
 * - Estados que esperan su movimiento: `pendiente` y `debito` (`ESTADOS_QUE_ESPERAN_MOVIMIENTO`).
 * - Ventana: ±`DIAS_VENTANA_CUOTA` días alrededor de la fecha prevista, no el mes calendario.
 * - Entre las que entran, la de importe más cercano; a igual importe, la de fecha más cercana.
 * Si la fecha difiere más de `DIAS_TOLERANCIA_PRECARGADA`, el movimiento igual queda a auditar (A-FEAT-1363).
 */
export const ESTADOS_QUE_ESPERAN_MOVIMIENTO = ["pendiente", "debito"] as const
export const DIAS_VENTANA_CUOTA = 15

export function cuotaPendienteDelMes<T extends { id: string; fecha_estimada?: string | null; fecha_vencimiento?: string | null; monto?: number | string | null; estado?: string | null }>(
  cuotas: T[], fechaMovimiento: string, monto: number,
): T | null {
  const tMov = Date.parse(String(fechaMovimiento).slice(0, 10))
  const dias = (c: T) => {
    const f = String(c.fecha_vencimiento || c.fecha_estimada || "").slice(0, 10)
    return f ? Math.abs(Date.parse(f) - tMov) / 86400000 : Infinity
  }
  const libres = cuotas.filter(c =>
    (ESTADOS_QUE_ESPERAN_MOVIMIENTO as readonly string[]).includes(String(c.estado ?? "").toLowerCase())
    && dias(c) <= DIAS_VENTANA_CUOTA)
  if (!libres.length) return null
  const difMonto = (c: T) => Math.abs((Number(c.monto) || 0) - monto)
  return [...libres].sort((a, b) => difMonto(a) - difMonto(b) || dias(a) - dias(b))[0]
}

/**
 * 🔎 **A-FEAT-1363 — la cuota PRECARGADA no coincide con el banco: se concilia, pero queda «a auditar».**
 *
 * Usuario 2026-10-25: *«si el monto precargado es distinto debe quedar como a auditar… que lo reconozca,
 * para eso está la regla, pero que quede en audit por diferencia de montos. Lo mismo con la fecha si es
 * diferencia grande»*. Antes el motor le pisaba el monto a la cuota con el del banco **sin avisar**.
 *
 * Devuelve el motivo para `motivo_revision`, o `null` si coincide. Es un aviso, no un freno (§ 🚦): la
 * diferencia puede tener explicación (un aumento, un mes que se cobró distinto).
 * - **Monto**: más de 1 centavo de diferencia.
 * - **Fecha**: más de `DIAS_TOLERANCIA_PRECARGADA` días entre lo previsto y el débito.
 */
export const DIAS_TOLERANCIA_PRECARGADA = 10

export function diferenciaConPrecargada(
  cuota: { monto?: number | string | null; fecha_estimada?: string | null; fecha_vencimiento?: string | null },
  montoBanco: number, fechaBanco: string,
): string | null {
  const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const ddmm = (f: string) => f.slice(0, 10).split("-").reverse().join("/")
  const motivos: string[] = []
  const previsto = Number(cuota.monto)
  if (Number.isFinite(previsto) && Math.abs(previsto - montoBanco) > 0.01) {
    motivos.push(`monto precargado $${fmt(previsto)}, el banco $${fmt(montoBanco)} (diferencia $${fmt(montoBanco - previsto)})`)
  }
  const fPrevista = String(cuota.fecha_vencimiento || cuota.fecha_estimada || "").slice(0, 10)
  if (fPrevista && fechaBanco) {
    const dias = Math.round((Date.parse(fechaBanco.slice(0, 10)) - Date.parse(fPrevista)) / 86400000)
    if (Math.abs(dias) > DIAS_TOLERANCIA_PRECARGADA) {
      motivos.push(`fecha prevista ${ddmm(fPrevista)}, el banco ${ddmm(fechaBanco)} (${Math.abs(dias)} días)`)
    }
  }
  return motivos.length ? `Cuota precargada distinta: ${motivos.join(" · ")}` : null
}

/**
 * 🔎 A-BUG-1317 — el filtro «Campaña» de Templates. La campaña es TEXTO («2026», «25/26»); antes se
 * comparaba con `parseInt(...)` y no daba igual nunca: elegir un año dejaba la lista vacía. Y desde
 * A-DEC-1016 los abiertos no tienen campaña → opción `SIN_CAMPANA`.
 */
export const SIN_CAMPANA = "sin-campana"
export function coincideCampana(año: string | number | null | undefined, elegido: string): boolean {
  if (!elegido || elegido === "todos") return true
  const a = String(año ?? "").trim()
  return elegido === SIN_CAMPANA ? a === "" : a === elegido
}
