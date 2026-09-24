/**
 * ✏️ **A-FEAT-131 — editar una campaña de templates sin romper lo conciliado.**
 *
 * Lógica pura: no toca Supabase, no importa React. Se prueba con `npm run probar`.
 *
 * ## El invariante, que es lo que pidió el usuario y lo que manda sobre todo lo demás
 * > *«El tema caliente es que si hay cosas conciliadas, sea lo que sea que yo haga, los links de
 * > códigos deben perdurar.»*
 *
 * El vínculo entre un movimiento bancario y una cuota es el `id` de la cuota, copiado a
 * `template_cuota_id`. **Y no es foreign key en ninguna de las 12 tablas que lo tienen**
 * (A-BUG-156): si la cuota desaparece, el movimiento queda apuntando a la nada — sin error, sin
 * cascade y sin aviso. Ya pasó **9 veces** sobre 491 vínculos vivos, y la firma es siempre la misma:
 * `template_id` válido con `template_cuota_id` muerto, o sea **una regeneración de cuotas**
 * (borrar + recrear). Los UUID nuevos no son los viejos.
 *
 * De ahí salen las tres reglas que este archivo hace cumplir:
 *
 * **1 · Editar es UPDATE por `id`. Nunca borrar y recrear.** Cambiar la fecha o el monto de una
 * cuota no cambia su identidad: es la misma cuota con otro dato. Recrearla la convierte en otra y
 * el movimiento se queda hablando de un muerto.
 *
 * **2 · Quitar una cuota la DESACTIVA, no la borra.** Vale incluso para las que hoy no tienen nada
 * enganchado, y es a propósito (§ `CLAUDE.md` 🛑 Datos: *nada destructivo, nunca*): el `id` cuesta
 * 16 bytes y es la única pista de contra qué estaba conciliado algo. `estado = 'desactivado'` ya
 * existe en el modelo y la vista de Templates ya lo esconde por defecto.
 *
 * **3 · `numero_cuota` se recalcula por fecha, pero NO es la identidad.** Que la cuota 2 pase a ser
 * la 3 al insertar una anterior es cosmético. Lo que no se puede mover es el `id`.
 *
 * ## Y la segunda mitad: el CHECK al momento del cambio
 * > *«Eventualmente advertir: si cambio una cuota a otra fecha o monto, hace el check al momento, se
 * > fija contra qué está vinculado y advierte que tal vez estoy por cambiar algo erróneamente porque
 * > coincide proveedor, fecha, monto contra salida bancaria por ej.»*
 *
 * Es la § 🧮 *Todo desarrollo termina con su control* aplicada a la edición — con la diferencia de
 * que acá el control corre **antes de guardar**, que es cuando todavía sirve. Y mira para los dos
 * lados, porque las dos direcciones son errores distintos:
 *
 * | | Qué pasó | Por qué importa |
 * |---|---|---|
 * | 🔴 `VINCULO_SE_ROMPE` | la cuota está conciliada y el cambio la **aleja** de su movimiento | el estado sigue diciendo «conciliado» y ya no cierra contra nada |
 * | 🟠 `COINCIDE_CON_OTRO` | el valor nuevo coincide con **otra** salida bancaria | es el que pidió el usuario: *«tal vez estoy por cambiar algo erróneamente»* |
 * | 🔵 `SE_ACERCA` | el valor nuevo coincide con un movimiento **sin conciliar** | probablemente sea lo correcto — se muestra igual, para que se vea que el sistema lo vio |
 *
 * 🔑 **El criterio de coincidencia es el MISMO que usa el motor**: importe exacto y ≤ 5 días
 * (`useMotorConciliacion.buscarEnPool`). No se inventa uno nuevo a propósito — si este archivo
 * advirtiera con un criterio más laxo que el del motor, avisaría de matches que el motor nunca va a
 * hacer, y la advertencia se vuelve ruido. Y si fuera más estricto, callaría justo los casos que el
 * motor sí va a agarrar solo.
 */

/** El mismo que usa el motor de conciliación. Cambiar los dos juntos o ninguno. */
export const TOLERANCIA_DIAS = 5

export interface CuotaExistente {
  id: string
  numero_cuota: number | null
  fecha_estimada: string | null
  monto: number
  estado: string | null
}

/** Una fila del editor. `id === null` es una cuota que todavía no existe. */
export interface CuotaEditada {
  id: string | null
  fecha_estimada: string
  monto: number
}

/** Sirve para las dos cosas: los que YA apuntan a una cuota y los candidatos sueltos. */
export interface MovimientoBancario {
  id: string
  tabla: string
  fecha: string
  debitos: number
  creditos: number
  descripcion: string | null
  estado: string | null
  template_cuota_id: string | null
}

export type AccionCuota =
  | { tipo: 'modificar'; id: string; antes: CuotaExistente; fecha_estimada: string; monto: number; cambios: ('fecha' | 'monto')[] }
  | { tipo: 'crear'; fecha_estimada: string; monto: number; numero_cuota: number }
  | { tipo: 'desactivar'; id: string; antes: CuotaExistente }

export interface PlanEdicion {
  acciones: AccionCuota[]
  /** `numero_cuota` que le toca a cada `id` una vez ordenado por fecha. Cosmético, no identidad. */
  renumerar: Record<string, number>
}

export type CodigoAviso =
  | 'VINCULO_SE_ROMPE'
  | 'COINCIDE_CON_OTRO'
  | 'SE_ACERCA'
  | 'DESACTIVA_VINCULADA'
  | 'EDITA_PAGADA'

export interface Aviso {
  nivel: 'rojo' | 'ambar' | 'azul'
  codigo: CodigoAviso
  cuotaId: string | null
  titulo: string
  detalle: string
  movimiento?: MovimientoBancario
}

// ── Utilidades de fecha ─────────────────────────────────────────────────────
/**
 * Días entre dos `YYYY-MM-DD`, en UTC y a partir de las PARTES del string.
 *
 * ⚠️ `new Date('2026-06-16')` da medianoche UTC pero `new Date('2026/06/16')` da medianoche local,
 * y mezclarlos corre un día en Argentina (UTC-3). Un día de más acá convierte un match exacto en
 * «fecha no exacta» y dispara una advertencia falsa.
 */
export function diasEntre(a: string, b: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return Date.UTC(y, (m || 1) - 1, d || 1)
  }
  return Math.abs(ms(a) - ms(b)) / 86_400_000
}

/** El importe con el que el movimiento pagaría una cuota de egreso. */
export const importeDe = (m: MovimientoBancario): number => m.debitos > 0 ? m.debitos : m.creditos

/**
 * ¿Este movimiento matchearía esta cuota? Importe exacto y ≤ `TOLERANCIA_DIAS`.
 * Mismo criterio que `useMotorConciliacion.buscarEnPool` — ver el encabezado.
 */
export function coincide(mov: MovimientoBancario, fecha: string, monto: number): boolean {
  if (monto <= 0) return false
  if (importeDe(mov) !== monto) return false
  return diasEntre(mov.fecha, fecha) <= TOLERANCIA_DIAS
}

// ── 1 · El plan ─────────────────────────────────────────────────────────────
/**
 * Traduce «lo que quedó en el editor» a acciones sobre la base.
 *
 * 🔒 No emite ni un solo borrado. Lo que el usuario sacó de la lista sale como `desactivar`.
 */
export function planificarEdicion(actuales: CuotaExistente[], editadas: CuotaEditada[]): PlanEdicion {
  const acciones: AccionCuota[] = []
  const porId = new Map(actuales.map(c => [c.id, c]))
  const vistos = new Set<string>()

  for (const e of editadas) {
    if (e.id && porId.has(e.id)) {
      vistos.add(e.id)
      const antes = porId.get(e.id)!
      const cambios: ('fecha' | 'monto')[] = []
      if ((antes.fecha_estimada || '').slice(0, 10) !== e.fecha_estimada.slice(0, 10)) cambios.push('fecha')
      if (Number(antes.monto) !== Number(e.monto)) cambios.push('monto')
      if (cambios.length > 0) {
        acciones.push({ tipo: 'modificar', id: e.id, antes, fecha_estimada: e.fecha_estimada, monto: e.monto, cambios })
      }
    } else {
      // Sin `id`, o con uno que no está entre las actuales: es nueva. El número definitivo se
      // asigna abajo, con todas ordenadas por fecha.
      acciones.push({ tipo: 'crear', fecha_estimada: e.fecha_estimada, monto: e.monto, numero_cuota: 0 })
    }
  }

  for (const c of actuales) {
    if (!vistos.has(c.id) && c.estado !== 'desactivado') {
      acciones.push({ tipo: 'desactivar', id: c.id, antes: c })
    }
  }

  // Renumerar por fecha sobre lo que va a QUEDAR vivo — existentes y nuevas en la misma cuenta.
  const vivas = editadas
    .map((e, orden) => ({ id: e.id, fecha: e.fecha_estimada, orden }))
    .sort((a, b) => a.fecha === b.fecha ? a.orden - b.orden : a.fecha.localeCompare(b.fecha))

  const renumerar: Record<string, number> = {}
  const numeroPorOrden = new Map<number, number>()
  vivas.forEach((v, i) => {
    numeroPorOrden.set(v.orden, i + 1)
    if (v.id) renumerar[v.id] = i + 1
  })

  // Las nuevas salen en el mismo orden en que entraron a `editadas`, así que se emparejan por
  // posición. Nada de buscar por fecha: dos cuotas nuevas el mismo día se pisarían el número.
  let k = 0
  editadas.forEach((e, orden) => {
    if (e.id && porId.has(e.id)) return
    const accion = acciones.filter(a => a.tipo === 'crear')[k++]
    if (accion && accion.tipo === 'crear') accion.numero_cuota = numeroPorOrden.get(orden) ?? 0
  })

  return { acciones, renumerar }
}

// ── 2 · El check al momento ─────────────────────────────────────────────────
/**
 * Mira cada acción contra la realidad bancaria y devuelve lo que hay que advertir.
 *
 * @param vinculos    movimientos cuyo `template_cuota_id` apunta a alguna de estas cuotas
 * @param candidatos  movimientos de la misma contraparte en la ventana de fechas, vinculados o no
 */
export function evaluarAvisos(
  plan: PlanEdicion,
  vinculos: MovimientoBancario[],
  candidatos: MovimientoBancario[],
): Aviso[] {
  const avisos: Aviso[] = []
  const plata = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const vinculadosDe = (id: string) => vinculos.filter(v => v.template_cuota_id === id)

  for (const a of plan.acciones) {
    if (a.tipo === 'desactivar') {
      const vs = vinculadosDe(a.id)
      if (vs.length > 0) {
        avisos.push({
          nivel: 'ambar', codigo: 'DESACTIVA_VINCULADA', cuotaId: a.id,
          titulo: `La cuota ${a.antes.numero_cuota ?? ''} está conciliada: se DESACTIVA, no se borra`,
          detalle: `Tiene ${vs.length} movimiento${vs.length === 1 ? '' : 's'} apuntando `
            + `(${vs.map(v => `${v.fecha} $${plata(importeDe(v))}`).join(', ')}). `
            + `Se marca como desactivada y el vínculo queda intacto — borrarla dejaría a `
            + `${vs.length === 1 ? 'ese movimiento' : 'esos movimientos'} apuntando a la nada.`,
          movimiento: vs[0],
        })
      }
      continue
    }

    if (a.tipo !== 'modificar') continue

    // 🔴 ¿El cambio la aleja de lo que ya tiene enganchado?
    for (const v of vinculadosDe(a.id)) {
      if (coincide(v, a.fecha_estimada, a.monto)) continue
      const motivos: string[] = []
      if (importeDe(v) !== a.monto) {
        motivos.push(`el importe del banco es $${plata(importeDe(v))} y la cuota pasaría a $${plata(a.monto)}`)
      }
      const dias = diasEntre(v.fecha, a.fecha_estimada)
      if (dias > TOLERANCIA_DIAS) {
        motivos.push(`quedarían ${Math.round(dias)} días de diferencia (el motor tolera ${TOLERANCIA_DIAS})`)
      }
      avisos.push({
        nivel: 'rojo', codigo: 'VINCULO_SE_ROMPE', cuotaId: a.id,
        titulo: 'Esta cuota está conciliada y el cambio la deja sin cerrar',
        detalle: `Está vinculada al movimiento del ${v.fecha} por $${plata(importeDe(v))}`
          + `${v.descripcion ? ` (${v.descripcion})` : ''}. Con el cambio, ${motivos.join(' y ')}. `
          + `El vínculo NO se rompe —el id se conserva—, pero el movimiento va a seguir diciendo `
          + `«conciliado» sin cerrar contra nada.`,
        movimiento: v,
      })
    }

    // 🟠 ¿El valor nuevo se parece a OTRA salida bancaria?
    const yaEsMio = new Set(vinculadosDe(a.id).map(v => v.id))
    for (const c of candidatos) {
      if (yaEsMio.has(c.id)) continue
      if (!coincide(c, a.fecha_estimada, a.monto)) continue

      const deOtraCuota = !!c.template_cuota_id && c.template_cuota_id !== a.id
      avisos.push(deOtraCuota
        ? {
            nivel: 'ambar', codigo: 'COINCIDE_CON_OTRO', cuotaId: a.id,
            titulo: 'Ojo: con este valor coincide con un movimiento que YA es de otra cuota',
            detalle: `El movimiento del ${c.fecha} por $${plata(importeDe(c))}`
              + `${c.descripcion ? ` (${c.descripcion})` : ''} coincide en importe y fecha con lo que `
              + `estás poniendo, pero ya está conciliado contra otra cuota. `
              + `Puede que estés corrigiendo la cuota equivocada.`,
            movimiento: c,
          }
        : {
            nivel: 'azul', codigo: 'SE_ACERCA', cuotaId: a.id,
            titulo: 'Con este valor coincide con una salida bancaria sin conciliar',
            detalle: `El movimiento del ${c.fecha} por $${plata(importeDe(c))}`
              + `${c.descripcion ? ` (${c.descripcion})` : ''} quedaría a tiro del motor. `
              + `Probablemente sea justo lo que buscabas.`,
            movimiento: c,
          })
    }

    // ⚠️ Editar una cuota ya pagada es legítimo (corregir un monto mal cargado) pero no es rutina.
    if ((a.antes.estado === 'pagado' || a.antes.estado === 'conciliado') && vinculadosDe(a.id).length === 0) {
      avisos.push({
        nivel: 'ambar', codigo: 'EDITA_PAGADA', cuotaId: a.id,
        titulo: `Estás editando una cuota en estado «${a.antes.estado}» que no tiene movimiento enganchado`,
        detalle: `Dice ${a.antes.estado} pero ningún movimiento bancario la señala, así que el estado `
          + `no sale de una conciliación. Si el pago existe, conviene vincularlo desde el Extracto en `
          + `vez de dejar el estado suelto.`,
      })
    }
  }

  const orden = { rojo: 0, ambar: 1, azul: 2 }
  return avisos.sort((x, y) => orden[x.nivel] - orden[y.nivel])
}

/** ¿Hay algo que amerite frenar? Sólo los rojos frenan; los demás informan. */
export const hayQueFrenar = (avisos: Aviso[]): boolean => avisos.some(a => a.nivel === 'rojo')
