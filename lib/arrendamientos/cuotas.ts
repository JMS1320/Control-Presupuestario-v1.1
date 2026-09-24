// Cuotas de un contrato de arrendamiento: armarlas, copiarlas de otro contrato y guardarlas.
//
// ── Por qué existe (A-BUG-101) ───────────────────────────────────────────────
// Hasta 2026-09-21 la pantalla de Arrendamientos **no tenía dónde crear una cuota**: sólo fijaba
// las que ya existían. Las de MSA se sembraron por SQL al armar el módulo, así que todo contrato
// nuevo (PAM Nazarenas 25/26, MA Lima 26/27) quedaba con cero cuotas y sin forma de ponerle.
//
// Lógica pura, sin BD: el modal decide con esto y `lib/pruebas/casos.ts` lo prueba.
//
// ⚠️ SIN IMPORTS a propósito: `npm run probar` sólo resuelve el alias `@/` dentro de `casos.ts`, no
// dentro de las librerías (y `calculo.ts` importa `@/lib/precios/serie`). Por eso las dos fórmulas
// que hacen falta de `calculo.ts` están repetidas acá abajo — son de una línea y tienen que dar lo
// mismo que `tonsCuota` y `validarGuardarrailQq`.
//
// ── Las reglas ───────────────────────────────────────────────────────────────
// - Cada contrato es independiente: cantidad de cuotas, qq/ha y fechas son libres. Copiar el
//   esquema de otro contrato es un PUNTO DE PARTIDA, no un vínculo.
// - FRENA sólo la contradicción interna (§ 🚦 CLAUDE.md): borrar una cuota que ya tiene venta, o
//   dejarla con menos toneladas que las ya vendidas. Eso rompería ventas existentes.
// - AVISA y deja seguir que las cuotas no sumen los qq/ha del contrato — mismo criterio que el
//   guardarraíl `validarGuardarrailQq`, que se reusa.
// - La fecha ORIGINAL de la cuota es lo que dice el contrato; la ESTIMADA es a dónde la movió el
//   presupuesto. Editar el contrato redefine la original; si la cuota no se había movido, la
//   estimada la acompaña. Si se había movido, se respeta el movimiento.


/** Cuota tal como está en `cuotas_arrendamiento`. */
/** = `tonsCuota` de calculo.ts: has × qq/ha ÷ 10 (10 qq = 1 tn). */
const tonsCuota = (has: number, qq: number) => (has * qq) / 10

/** = `validarGuardarrailQq` de calculo.ts: la diferencia se redondea a 2 decimales. */
function validarGuardarrailQq(qqHaTotal: number, cuotas: { qq_ha_cuota: number }[]) {
  const suma = cuotas.reduce((s, c) => s + Number(c.qq_ha_cuota || 0), 0)
  const diferencia = Math.round((suma - qqHaTotal) * 100) / 100
  return { ok: diferencia === 0, suma, diferencia }
}

export interface CuotaGuardada {
  id: string
  numero_cuota: number
  qq_ha_cuota: number
  fecha_cobro_estimada: string
  posicion_anio: number
  posicion_mes: number
  fecha_cobro_original?: string | null
  posicion_orig_anio?: number | null
  posicion_orig_mes?: number | null
}

/** Una fila del editor. Sin `id` = cuota nueva. */
export interface FilaCuota {
  id?: string
  qq_ha_cuota: number
  fecha_cobro: string          // yyyy-mm-dd
  posicion_anio: number
  posicion_mes: number         // 1..12
}

/** "25/26" → 2025 · "2025/26" → 2025 · "2025/2026" → 2025. `null` si no se entiende. */
export function anioInicioCampania(campania: string | null | undefined): number | null {
  const m = String(campania ?? "").trim().match(/^(\d{2}|\d{4})\s*\/\s*\d{2,4}$/)
  if (!m) return null
  const a = Number(m[1])
  return m[1].length === 2 ? 2000 + a : a
}

/** Corre una fecha yyyy-mm-dd N años. El 29/02 cae al 28/02 si el año destino no es bisiesto. */
export function correrAnios(fecha: string, delta: number): string {
  const [y, m, d] = fecha.split("-").map(Number)
  const ny = y + delta
  const bisiesto = (ny % 4 === 0 && ny % 100 !== 0) || ny % 400 === 0
  const nd = m === 2 && d === 29 && !bisiesto ? 28 : d
  return `${ny}-${String(m).padStart(2, "0")}-${String(nd).padStart(2, "0")}`
}

/**
 * Esquema de cuotas de otro contrato, corrido a la campaña destino. Toma los términos del
 * CONTRATO (fecha y posición originales), no dónde las movió el presupuesto.
 * Si alguna de las dos campañas no se entiende, copia las fechas tal cual.
 */
export function copiarEsquemaCuotas(
  origen: CuotaGuardada[],
  campaniaOrigen: string,
  campaniaDestino: string,
): FilaCuota[] {
  const a = anioInicioCampania(campaniaOrigen)
  const b = anioInicioCampania(campaniaDestino)
  const delta = a != null && b != null ? b - a : 0
  return [...origen]
    .sort((x, y) => x.numero_cuota - y.numero_cuota)
    .map(c => ({
      qq_ha_cuota: Number(c.qq_ha_cuota),
      fecha_cobro: correrAnios(c.fecha_cobro_original || c.fecha_cobro_estimada, delta),
      posicion_anio: Number(c.posicion_orig_anio ?? c.posicion_anio) + delta,
      posicion_mes: Number(c.posicion_orig_mes ?? c.posicion_mes),
    }))
}

export interface Validacion {
  /** Contradicciones internas: no se puede guardar. */
  frenos: string[]
  /** Diferencias que el negocio puede explicar: se muestran y se deja seguir. */
  avisos: string[]
}

/**
 * @param vendidoPorCuota toneladas ya fijadas (vendidas) de cada cuota guardada, por id.
 * @param idsOriginales ids de las cuotas que hoy existen en la BD — las que falten en `filas` se borran.
 */
export function validarCuotas(
  filas: FilaCuota[],
  has: number,
  qqHaTotal: number,
  vendidoPorCuota: Record<string, number>,
  idsOriginales: string[],
): Validacion {
  const frenos: string[] = []
  const avisos: string[] = []

  filas.forEach((f, i) => {
    const n = `Cuota ${i + 1}`
    if (!(Number(f.qq_ha_cuota) > 0)) frenos.push(`${n}: los qq/ha tienen que ser mayores a cero`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha_cobro || "")) frenos.push(`${n}: falta la fecha de cobro`)
    if (!(f.posicion_mes >= 1 && f.posicion_mes <= 12) || !(f.posicion_anio >= 2000 && f.posicion_anio <= 2100)) {
      frenos.push(`${n}: la posición (mes y año) no es válida`)
    }
    const vendido = f.id ? vendidoPorCuota[f.id] ?? 0 : 0
    if (vendido > 0) {
      const tons = tonsCuota(Number(has), Number(f.qq_ha_cuota))
      if (tons < vendido - 0.001) {
        frenos.push(`${n}: ya tiene ${vendido.toLocaleString("es-AR", { maximumFractionDigits: 2 })} tn vendidas `
          + `y quedaría con ${tons.toLocaleString("es-AR", { maximumFractionDigits: 2 })} tn`)
      }
    }
  })

  const quedan = new Set(filas.map(f => f.id).filter(Boolean) as string[])
  for (const id of idsOriginales) {
    if (!quedan.has(id) && (vendidoPorCuota[id] ?? 0) > 0) {
      frenos.push("No se puede borrar una cuota que ya tiene una venta fijada")
      break
    }
  }

  if (filas.length > 0) {
    const g = validarGuardarrailQq(Number(qqHaTotal), filas)
    if (!g.ok) {
      avisos.push(`Las cuotas suman ${g.suma.toLocaleString("es-AR", { maximumFractionDigits: 2 })} qq/ha y el `
        + `contrato dice ${Number(qqHaTotal).toLocaleString("es-AR", { maximumFractionDigits: 2 })} `
        + `(diferencia ${g.diferencia.toLocaleString("es-AR", { maximumFractionDigits: 2 })})`)
    }
  } else {
    avisos.push("El contrato queda sin cuotas: no va a proyectar ingresos ni se va a poder fijar")
  }

  return { frenos, avisos }
}

export interface PlanCuotas {
  insertar: Array<Omit<CuotaGuardada, "id">>
  actualizar: Array<{ id: string; cambios: Partial<CuotaGuardada> }>
  borrar: string[]
}

/**
 * Qué hay que escribir para que la BD quede como el editor. El número de cuota sale del orden
 * en pantalla (1..n): las ventas apuntan a la cuota por id, así que renumerar no rompe nada.
 */
export function planificarCuotas(originales: CuotaGuardada[], filas: FilaCuota[]): PlanCuotas {
  const porId = new Map(originales.map(o => [o.id, o]))
  const plan: PlanCuotas = { insertar: [], actualizar: [], borrar: [] }

  filas.forEach((f, i) => {
    const numero = i + 1
    const o = f.id ? porId.get(f.id) : undefined
    if (!o) {
      plan.insertar.push({
        numero_cuota: numero,
        qq_ha_cuota: Number(f.qq_ha_cuota),
        fecha_cobro_estimada: f.fecha_cobro,
        posicion_anio: f.posicion_anio,
        posicion_mes: f.posicion_mes,
        fecha_cobro_original: f.fecha_cobro,
        posicion_orig_anio: f.posicion_anio,
        posicion_orig_mes: f.posicion_mes,
      })
      return
    }

    // ¿El presupuesto la había movido? Si no, la estimada acompaña a la original.
    const origFecha = o.fecha_cobro_original ?? o.fecha_cobro_estimada
    const origAnio = o.posicion_orig_anio ?? o.posicion_anio
    const origMes = o.posicion_orig_mes ?? o.posicion_mes
    const movida = origFecha !== o.fecha_cobro_estimada
      || Number(origAnio) !== Number(o.posicion_anio) || Number(origMes) !== Number(o.posicion_mes)

    const cambios: Partial<CuotaGuardada> = {}
    if (o.numero_cuota !== numero) cambios.numero_cuota = numero
    if (Number(o.qq_ha_cuota) !== Number(f.qq_ha_cuota)) cambios.qq_ha_cuota = Number(f.qq_ha_cuota)
    const terminosCambiaron = origFecha !== f.fecha_cobro
      || Number(origAnio) !== f.posicion_anio || Number(origMes) !== f.posicion_mes
    if (terminosCambiaron) {
      cambios.fecha_cobro_original = f.fecha_cobro
      cambios.posicion_orig_anio = f.posicion_anio
      cambios.posicion_orig_mes = f.posicion_mes
      if (!movida) {
        cambios.fecha_cobro_estimada = f.fecha_cobro
        cambios.posicion_anio = f.posicion_anio
        cambios.posicion_mes = f.posicion_mes
      }
    }
    if (Object.keys(cambios).length) plan.actualizar.push({ id: o.id, cambios })
  })

  const quedan = new Set(filas.map(f => f.id).filter(Boolean))
  plan.borrar = originales.filter(o => !quedan.has(o.id)).map(o => o.id)
  return plan
}

/** Una fila del editor a partir de lo guardado: muestra los términos del contrato (la original). */
export function filaDesdeGuardada(c: CuotaGuardada): FilaCuota {
  return {
    id: c.id,
    qq_ha_cuota: Number(c.qq_ha_cuota),
    fecha_cobro: c.fecha_cobro_original || c.fecha_cobro_estimada,
    posicion_anio: Number(c.posicion_orig_anio ?? c.posicion_anio),
    posicion_mes: Number(c.posicion_orig_mes ?? c.posicion_mes),
  }
}

/**
 * Escribe el plan. El orden importa porque `(contrato_id, numero_cuota)` es único:
 * 1) borrar · 2) las que se renumeran pasan por un número temporal · 3) número final · 4) insertar.
 * `db` es el cliente de Supabase (se recibe para no atar la lógica a un runtime).
 *
 * ⚠️ Borrar una cuota borra sus ventas EN CASCADA (FK de `ventas_arrendamiento`). Por eso
 * `validarCuotas` frena antes de llegar acá si alguna tiene venta.
 */
export async function aplicarPlanCuotas(db: any, contratoId: string, plan: PlanCuotas): Promise<string | null> {
  const ahora = new Date().toISOString()
  if (plan.borrar.length) {
    const { error } = await db.from("cuotas_arrendamiento").delete().in("id", plan.borrar)
    if (error) return `Al borrar cuotas: ${error.message}`
  }
  for (const u of plan.actualizar) {
    const { numero_cuota, ...resto } = u.cambios
    const temp = numero_cuota != null ? { numero_cuota: numero_cuota + 1000 } : {}
    const { error } = await db.from("cuotas_arrendamiento")
      .update({ ...resto, ...temp, updated_at: ahora }).eq("id", u.id)
    if (error) return `Al actualizar una cuota: ${error.message}`
  }
  for (const u of plan.actualizar) {
    if (u.cambios.numero_cuota == null) continue
    const { error } = await db.from("cuotas_arrendamiento")
      .update({ numero_cuota: u.cambios.numero_cuota }).eq("id", u.id)
    if (error) return `Al renumerar una cuota: ${error.message}`
  }
  if (plan.insertar.length) {
    const { error } = await db.from("cuotas_arrendamiento")
      .insert(plan.insertar.map(c => ({ ...c, contrato_id: contratoId, estado: "presupuestado" })))
    if (error) return `Al crear cuotas: ${error.message}`
  }
  return null
}

// ── Partir una cuota al fijar parcial (A-BUG-183) ────────────────────────────
// Al partir MANDAN LAS TONELADAS: lo vendido y el saldo tienen que quedar exactos, y los qq/ha se
// derivan de ahí. Antes se repartía en qq/ha y la columna guardaba 2 decimales: en Rojas (242 ha)
// 0,01 qq/ha son 0,242 tn, y fijar 100 tn dejaba la cuota en 99,946 y el saldo en 113,014.

/** Decimales con que se guardan los qq/ha de una cuota (`cuotas_arrendamiento.qq_ha_cuota`). */
export const DECIMALES_QQ = 6

const redondearQq = (qq: number) => Number(qq.toFixed(DECIMALES_QQ))

/**
 * @param tonsQueQuedan toneladas que se queda la cuota original (lo ya vendido + lo que se fija ahora).
 * El saldo es el resto de la cuota. Los dos qq/ha salen de sus toneladas, no uno por diferencia del otro.
 */
export function partirCuota(has: number, qqCuota: number, tonsQueQuedan: number): { qqOriginal: number; qqSaldo: number } {
  const tonsTotal = tonsCuota(has, qqCuota)
  const tonsSaldo = tonsTotal - tonsQueQuedan
  return {
    qqOriginal: redondearQq((tonsQueQuedan * 10) / has),
    qqSaldo: redondearQq((tonsSaldo * 10) / has),
  }
}

// ── Guardar una venta (fijación) — alta o edición (A-BUG-100) ────────────────
// Una venta cerrada se tiene que poder CAMBIAR: el usuario le puso TC sin querer y no había forma
// de sacarlo (*«la solución es permitir cambiar algo de una posición cerrada, que quedaría abierta
// pendiente de TC en este caso»*). El estado de la venta no se guarda: sale de sus campos
// (`estadoVenta` en calculo.ts), así que borrar el TC la vuelve a «falta TC» sola.

export interface CamposVenta {
  tons: number
  modo: "matba" | "pizarra"
  precio_usd: number | null
  precio_pesos: number | null
  tc: number | null
  fecha_fijacion_tc: string | null
  monto_pesos: number | null
}

/**
 * @param tcAnterior / fechaTcAnterior de la venta que se edita: si el TC no cambió, se conserva la
 *   fecha en que se fijó. En un alta van null.
 */
export function camposDeVenta(p: {
  tons: number; modo: "matba" | "pizarra"; precio: number; tc: number | null
  fechaFijacion: string; tcAnterior?: number | null; fechaTcAnterior?: string | null
}): CamposVenta {
  const tc = p.modo === "matba" && p.tc && p.tc > 0 ? p.tc : null
  const fechaTc = tc == null ? null
    : (p.tcAnterior != null && Number(p.tcAnterior) === tc && p.fechaTcAnterior ? p.fechaTcAnterior : p.fechaFijacion)
  return {
    tons: p.tons,
    modo: p.modo,
    precio_usd: p.modo === "matba" ? p.precio : null,
    precio_pesos: p.modo === "pizarra" ? p.precio : null,
    tc,
    fecha_fijacion_tc: fechaTc,
    monto_pesos: p.modo === "pizarra" ? p.tons * p.precio : (tc ? p.tons * p.precio * tc : null),
  }
}

/** Toneladas máximas de una venta que se EDITA: lo que tiene la cuota menos las OTRAS ventas. */
export function tonsMaximasEdicion(tonsDeLaCuota: number, tonsOtrasVentas: number): number {
  return Math.max(0, tonsDeLaCuota - tonsOtrasVentas)
}

// ── Duplicar un contrato a otra campaña (A-FEAT-166) ─────────────────────────
// Pedido del usuario 2026-09-21: *«también se podría copiar todo un contrato con cuotas y todo
// dentro cuando sólo hay cambio de campaña»*. Se abre el modal de Nuevo contrato ya lleno — campo,
// cliente, has, qq/ha — con la campaña siguiente y las cuotas corridas un año. Nada se guarda hasta
// que el usuario aprieta Guardar: es un punto de partida, igual que «Copiar cuotas de…».

/** "26/27" → "27/28" · "2025/26" → "2026/27" · "2025/2026" → "2026/2027". Si no se entiende, igual. */
export function campaniaSiguiente(campania: string): string {
  const m = String(campania ?? "").trim().match(/^(\d{2}|\d{4})\s*\/\s*(\d{2}|\d{4})$/)
  if (!m) return campania
  const suma = (x: string) => String(Number(x) + 1).padStart(x.length, "0").slice(-x.length)
  return `${suma(m[1])}/${suma(m[2])}`
}
