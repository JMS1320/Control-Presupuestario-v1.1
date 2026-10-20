/**
 * 📨 El estado DDJJ de un comprobante en el subdiario, y quién lo puede mover (A-FEAT-1295).
 *
 * Cuatro estados, en este orden:
 *   No → Imputado → **Enviado** (al contador) → DDJJ OK (presentado)
 *
 * «Enviado» nació porque mandarle el subdiario al contador **no es presentarlo**, pero tampoco es
 * un mes que se pueda seguir moviendo en silencio: el contador ya está trabajando sobre eso.
 *
 * La regla, decidida por el usuario 2026-10-19:
 *   · Sobre un comprobante, o un mes, **Enviado o DDJJ OK**: sólo el admin, y siempre con advertencia.
 *   · El resto de los roles (Ulises, `contable`) **no lo toca nunca**.
 *   · Marcar Enviado o DDJJ OK también es sólo del admin.
 *
 * Vale igual para Compras (`comprobantes_arca`) y Ventas (`comprobantes_venta`): misma columna
 * `ddjj_iva`, misma lógica. Por eso vive acá y no en cada pantalla.
 */

export type EstadoDDJJ = "No" | "Imputado" | "Enviado" | "DDJJ OK"

export const ENVIADO: EstadoDDJJ = "Enviado"
export const PRESENTADO: EstadoDDJJ = "DDJJ OK"

/** Los estados de un comprobante que ya está en un subdiario (tiene mes y año contable). */
export const ESTADOS_IMPUTADOS: EstadoDDJJ[] = ["Imputado", "Enviado", "DDJJ OK"]

/** Enviado al contador o presentado: lo que no se mueve sin aviso. */
export function estaProtegido(estado: string | null | undefined): boolean {
  return estado === ENVIADO || estado === PRESENTADO
}

/**
 * El estado de un MES, a partir de los estados de sus comprobantes: el más avanzado que haya.
 * Un comprobante imputado tarde a un mes ya enviado queda «Imputado», pero el mes sigue «Enviado»
 * — justamente para que la advertencia salga y para que se note cuál le falta mandar.
 */
export function estadoDelPeriodo(estados: (string | null | undefined)[]): EstadoDDJJ | null {
  if (estados.some(e => e === PRESENTADO)) return PRESENTADO
  if (estados.some(e => e === ENVIADO)) return ENVIADO
  if (estados.some(e => e === "Imputado")) return "Imputado"
  return null
}

export type Decision =
  | { accion: "libre" }
  | { accion: "advertir"; mensaje: string }
  | { accion: "bloquear"; mensaje: string }

export interface CambioDDJJ {
  /** Estados actuales de los comprobantes que se van a tocar. */
  estadosAfectados: (string | null | undefined)[]
  /** Período al que van (MM/AAAA) y su estado, si el cambio los lleva a otro mes. */
  periodoDestino?: string | null
  estadoPeriodoDestino?: EstadoDDJJ | null
  /** Estado que se les quiere poner, si cambia. */
  estadoNuevo?: string | null
  esAdmin: boolean
}

const nombre = (e: EstadoDDJJ) => (e === ENVIADO ? "enviado al contador" : "presentado (DDJJ OK)")

/**
 * ¿Se puede hacer este cambio? Una sola función para todos los caminos: imputar, desimputar,
 * cambiar de mes, editar, borrar, marcar Enviado o DDJJ OK.
 */
export function evaluarCambioDDJJ(c: CambioDDJJ): Decision {
  const motivos: string[] = []

  const enviados = c.estadosAfectados.filter(e => e === ENVIADO).length
  const presentados = c.estadosAfectados.filter(e => e === PRESENTADO).length
  if (presentados > 0) motivos.push(`${presentados} comprobante(s) ya presentado(s) (DDJJ OK)`)
  if (enviados > 0) motivos.push(`${enviados} comprobante(s) ya enviado(s) al contador`)

  if (c.periodoDestino && estaProtegido(c.estadoPeriodoDestino)) {
    motivos.push(`el período ${c.periodoDestino} ya está ${nombre(c.estadoPeriodoDestino as EstadoDDJJ)}`)
  }

  const sella = c.estadoNuevo === ENVIADO || c.estadoNuevo === PRESENTADO
  if (!c.esAdmin) {
    if (sella) return { accion: "bloquear", mensaje: `❌ Sin permisos: marcar «${c.estadoNuevo}» lo hace sólo el administrador.` }
    if (motivos.length > 0) {
      return {
        accion: "bloquear",
        mensaje: `❌ Sin permisos: ${motivos.join(" y ")}.\n\nLo enviado al contador o presentado sólo lo puede modificar el administrador.`,
      }
    }
    return { accion: "libre" }
  }

  if (motivos.length === 0) return { accion: "libre" }
  return {
    accion: "advertir",
    mensaje:
      `⚠️ Atención: ${motivos.join(" y ")}.\n\n` +
      `Si lo cambiás, lo que tiene el contador (o lo presentado en ARCA) deja de coincidir con la app: avisale.\n\n` +
      `¿Seguro querés seguir?`,
  }
}

type FilaPeriodo = { año_contable: number | null; mes_contable: number | null; ddjj_iva: string | null }

/** Un mes del subdiario y en qué quedó. `sinMandar` = imputados tarde a un mes ya enviado o presentado. */
export interface EstadoMes {
  periodo: string
  estado: EstadoDDJJ
  comprobantes: number
  sinMandar: number
}

/**
 * El estado de CADA mes del subdiario, del más viejo al más nuevo — el tablero de arriba de
 * Subdiarios. Recibe las filas `{año_contable, mes_contable, ddjj_iva}`; las que no tienen mes, o
 * están en «No», no cuentan (en Ventas un comprobante en «No» puede tener mes cargado).
 */
export function estadoDeLosMeses(filas: FilaPeriodo[]): EstadoMes[] {
  const porMes = new Map<string, (string | null)[]>()
  for (const f of filas) {
    if (!f.año_contable || !f.mes_contable) continue
    if (!ESTADOS_IMPUTADOS.includes(f.ddjj_iva as EstadoDDJJ)) continue
    const k = `${f.año_contable}-${String(f.mes_contable).padStart(2, "0")}`
    porMes.set(k, [...(porMes.get(k) ?? []), f.ddjj_iva])
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, est]) => {
      const estado = estadoDelPeriodo(est) as EstadoDDJJ
      return {
        periodo: `${k.slice(5)}/${k.slice(0, 4)}`,
        estado,
        comprobantes: est.length,
        sinMandar: estaProtegido(estado) ? est.filter(e => e === "Imputado").length : 0,
      }
    })
}

/**
 * Los meses enviados al contador que todavía no figuran presentados — para cerrarlos cuando él
 * avise. Devuelve `MM/AAAA`, del más viejo al más nuevo. Un mes con algo ya en DDJJ OK no se
 * lista: ya se cerró.
 */
export function mesesEnviadosSinPresentar(filas: FilaPeriodo[]): string[] {
  return estadoDeLosMeses(filas).filter(m => m.estado === ENVIADO).map(m => m.periodo)
}

/**
 * Lee el estado de un mes en la base. `tabla` = `comprobantes_arca` (Compras) o
 * `comprobantes_venta` (Ventas). Recibe el cliente para no atar este archivo a la conexión
 * (los casos de prueba importan las funciones de arriba sin tocar la base).
 */
export async function consultarEstadoPeriodo(
  supabase: any, schema: string, tabla: string, periodo: string,
): Promise<EstadoDDJJ | null> {
  const [mes, año] = periodo.split("/")
  const { data, error } = await supabase
    .schema(schema).from(tabla).select("ddjj_iva")
    .eq("año_contable", parseInt(año)).eq("mes_contable", parseInt(mes))
    .in("ddjj_iva", [ENVIADO, PRESENTADO])
  // Si no se pudo leer, se supone protegido: una advertencia de más es barata; un mes presentado
  // movido sin aviso, no.
  if (error) return PRESENTADO
  return estadoDelPeriodo((data ?? []).map((r: any) => r.ddjj_iva))
}

/**
 * El estado de cada mes de una tabla. Lee de a 1000 (el tope de cada pedido), porque Compras
 * pasa ese número en un año. Si la lectura falla devuelve `null`: no se muestra un tablero a medias.
 */
export async function consultarEstadoDeLosMeses(supabase: any, schema: string, tabla: string): Promise<EstadoMes[] | null> {
  const filas: FilaPeriodo[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .schema(schema).from(tabla).select("*")
      .in("ddjj_iva", ESTADOS_IMPUTADOS)
      .order("id")
      .range(desde, desde + 999)
    if (error) return null
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return estadoDeLosMeses(filas)
}

/** Pregunta según la decisión: `true` = seguir. Bloquear muestra el motivo y corta. */
export function confirmarDecision(d: Decision): boolean {
  if (d.accion === "libre") return true
  if (d.accion === "bloquear") { window.alert(d.mensaje); return false }
  return window.confirm(d.mensaje)
}
