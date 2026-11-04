/**
 * 👷 **LOS SUELDOS EN LOS PAPELES DEL BALANCE — el total de A y el total de B** (A-FEAT-1216).
 *
 * Pedido del usuario 2026-09-30: *«otro tema que el export contable debe exportar es sueldos! **Debe
 * dar el total de A y el total de B**»*.
 *
 * ## 🕳️ Y tenía razón en que faltaba: no eran ninguna de las 12 partes
 *
 * El índice del balance lista **12 partes** y los sueldos **no son ninguna**. Hoy entran mezclados
 * —por el extracto como movimientos y por los templates— pero **no hay un papel que los abra**. Para
 * un campo con 7 empleados, eso es un pedazo del resultado sin apertura.
 *
 * ## 🔑 Por qué A y B separados, y no el total
 *
 * Son **las dos categorías del convenio** y se informan distinto: **A** es lo que va por el recibo y
 * **B** el resto. El contador las necesita abiertas.
 *
 * ## ⚠️ Pero el bruto NO es A + B, y ahí está el riesgo del papel
 *
 * La fórmula real (de `MODULO_SUELDOS.md`, replicada acá para que el papel cierre solo):
 *
 * ```
 * ab_francos    (A + B) + valor_franco × francos + extras
 * por_dia       valor_por_dia × días  + extras
 * por_hora_ipc  valor_por_hora × horas + extras
 * plano_ipc     A + extras
 * extras        varios + vacaciones + premio + aguinaldo A + aguinaldo B
 * ```
 *
 * 🧨 **Un papel que muestre sólo A y B dejaría afuera los francos y los extras** — en Sigot los
 * francos son $320.000 sobre $1,6 M — y **no cerraría contra lo que se pagó**. Por eso el papel abre
 * **todas** las columnas y termina en el bruto.
 *
 * ## 🧾 Y la cuota alimentaria va aparte aunque esté adentro de A
 *
 * `cuota_alimentaria` (A-FEAT-1213) es **la apertura de A**: no suma al bruto. Se muestra en su
 * columna porque es plata que se le paga a un tercero, y el contador puede necesitar verla — pero
 * **no se suma**, o el papel contaría dos veces.
 *
 * ## 📅 El corte: por AÑO y MES, no por subdiario
 *
 * Los sueldos **no tienen subdiario** —eso es de los comprobantes—, así que el ejercicio se recorta
 * por `anio`/`mes`, igual que los templates.
 */

/** Un período de sueldo, tal como viene de `sueldos.periodos` con su empleado. */
export interface PeriodoDeSueldo {
  anio: number
  mes: number
  empleado?: { nombre?: string | null; empresa?: string | null; tipo_empleado?: string | null } | null
  monto_a?: number | null
  monto_b?: number | null
  cuota_alimentaria?: number | null
  francos_cantidad?: number | null
  valor_franco?: number | null
  valor_por_dia?: number | null
  dias_trabajados?: number | null
  valor_por_hora?: number | null
  horas_mes?: number | null
  varios?: number | null
  vacaciones?: number | null
  premio?: number | null
  aguinaldo_a?: number | null
  aguinaldo_b?: number | null
  bruto_calculado?: number | null
  anticipos_descontados?: number | null
  saldo_pendiente?: number | null
}

/** Una fila del papel: un empleado en un mes. */
export interface FilaSueldo {
  anio: number
  mes: number
  /** `2026-06`, para ordenar y agrupar. */
  periodo: string
  empleado: string
  empresa: string
  tipo: string
  montoA: number
  montoB: number
  cuotaAlimentaria: number
  francos: number
  valorFranco: number
  /** `valor_franco × francos`, que es lo que el papel suma. */
  porFrancos: number
  /** `valor_por_dia × días` o `valor_por_hora × horas`, según el tipo. */
  porJornal: number
  extras: number
  /** Lo que sale de la fórmula. */
  brutoCalculado: number
  /** Lo que tiene guardado el período. */
  brutoGuardado: number
  /**
   * 🧮 `brutoCalculado − brutoGuardado`. **Tiene que ser cero.**
   *
   * Es el camino inverso (§ 🧮 de `CLAUDE.md`): si el papel recompone el bruto desde sus partes y no
   * da lo mismo que el sistema tiene guardado, **una de las dos está mal** y el papel no se puede
   * entregar sin mirarlo.
   */
  diferencia: number
  pagado: number
  saldo: number
}

export interface SueldosDelEjercicio {
  filas: FilaSueldo[]
  /** Los totales de las columnas, que es lo que el usuario pidió. */
  total: {
    montoA: number
    montoB: number
    cuotaAlimentaria: number
    porFrancos: number
    porJornal: number
    extras: number
    bruto: number
    pagado: number
    saldo: number
  }
  /** Un subtotal por mes, para que el contador vea la evolución. */
  porMes: Array<{ periodo: string; montoA: number; montoB: number; bruto: number }>
  /** 🧮 Las filas donde el bruto recompuesto no da el guardado. Vacío = el papel cierra. */
  descuadres: FilaSueldo[]
  /** Los meses del ejercicio que no tienen ni un período cargado. */
  mesesVacios: string[]
  /** 👷 A-FEAT-1537: lo devengado y no pagado al cierre (deuda del papel 04). Lo agrega la pantalla con los pagos. */
  impagosAlCierre?: SueldosImpagosAlCierre
}

const r2 = (n: number) => Math.round(n * 100) / 100
const n0 = (v: number | null | undefined) => Number(v ?? 0)

/**
 * 🧮 El bruto recompuesto desde las partes — **la misma fórmula que la pantalla**.
 *
 * ⚠️ Está replicada a propósito y no importada: la de la pantalla vive adentro del componente. Si
 * alguna vez cambia allá y no acá, **el control de abajo lo detecta** — que es exactamente para lo
 * que sirve.
 */
export function brutoDesdePartes(p: PeriodoDeSueldo): number {
  const extras = n0(p.varios) + n0(p.vacaciones) + n0(p.premio) + n0(p.aguinaldo_a) + n0(p.aguinaldo_b)
  switch (p.empleado?.tipo_empleado) {
    case "ab_francos":
      return r2(n0(p.monto_a) + n0(p.monto_b) + n0(p.valor_franco) * n0(p.francos_cantidad) + extras)
    case "por_dia":
      return r2(n0(p.valor_por_dia) * n0(p.dias_trabajados) + extras)
    case "por_hora_ipc":
      return r2(n0(p.valor_por_hora) * n0(p.horas_mes) + extras)
    case "plano_ipc":
      return r2(n0(p.monto_a) + extras)
    default:
      // Tipo desconocido: se usa lo guardado y el control no lo marca, porque no hay con qué comparar.
      return r2(n0(p.bruto_calculado))
  }
}

/**
 * 👷 Arma el papel de sueldos del ejercicio.
 *
 * @param periodos  todos los que traiga la consulta; el recorte se hace acá
 * @param meses     los 12 del ejercicio, en `AAAA-MM` (de `mesesDelEjercicio`)
 */
export function armarSueldosDelEjercicio(
  periodos: PeriodoDeSueldo[],
  meses: string[],
): SueldosDelEjercicio {
  const delEjercicio = new Set(meses)
  const filas: FilaSueldo[] = []

  for (const p of periodos) {
    const periodo = `${p.anio}-${String(p.mes).padStart(2, "0")}`
    if (!delEjercicio.has(periodo)) continue

    const tipo = p.empleado?.tipo_empleado ?? "(sin tipo)"
    const extras = r2(n0(p.varios) + n0(p.vacaciones) + n0(p.premio) + n0(p.aguinaldo_a) + n0(p.aguinaldo_b))
    const porFrancos = tipo === "ab_francos" ? r2(n0(p.valor_franco) * n0(p.francos_cantidad)) : 0
    const porJornal = tipo === "por_dia" ? r2(n0(p.valor_por_dia) * n0(p.dias_trabajados))
      : tipo === "por_hora_ipc" ? r2(n0(p.valor_por_hora) * n0(p.horas_mes))
      : 0
    const brutoCalculado = brutoDesdePartes(p)
    const brutoGuardado = r2(n0(p.bruto_calculado))

    filas.push({
      anio: p.anio, mes: p.mes, periodo,
      empleado: p.empleado?.nombre ?? "(sin nombre)",
      empresa: p.empleado?.empresa ?? "",
      tipo,
      montoA: r2(n0(p.monto_a)),
      montoB: r2(n0(p.monto_b)),
      cuotaAlimentaria: r2(n0(p.cuota_alimentaria)),
      francos: n0(p.francos_cantidad),
      valorFranco: r2(n0(p.valor_franco)),
      porFrancos, porJornal, extras,
      brutoCalculado, brutoGuardado,
      diferencia: r2(brutoCalculado - brutoGuardado),
      pagado: r2(n0(p.anticipos_descontados)),
      saldo: r2(n0(p.saldo_pendiente)),
    })
  }

  filas.sort((a, b) => a.periodo.localeCompare(b.periodo) || a.empleado.localeCompare(b.empleado, "es"))

  const sumar = (f: (x: FilaSueldo) => number) => r2(filas.reduce((s, x) => s + f(x), 0))
  const porMes = meses.map(m => {
    const delMes = filas.filter(f => f.periodo === m)
    return {
      periodo: m,
      montoA: r2(delMes.reduce((s, x) => s + x.montoA, 0)),
      montoB: r2(delMes.reduce((s, x) => s + x.montoB, 0)),
      bruto: r2(delMes.reduce((s, x) => s + x.brutoGuardado, 0)),
    }
  })

  return {
    filas,
    total: {
      montoA: sumar(f => f.montoA),
      montoB: sumar(f => f.montoB),
      // 🧾 La cuota se totaliza para mostrarla, pero NO entra en el bruto: está adentro de A.
      cuotaAlimentaria: sumar(f => f.cuotaAlimentaria),
      porFrancos: sumar(f => f.porFrancos),
      porJornal: sumar(f => f.porJornal),
      extras: sumar(f => f.extras),
      bruto: sumar(f => f.brutoGuardado),
      pagado: sumar(f => f.pagado),
      saldo: sumar(f => f.saldo),
    },
    porMes,
    // 🧮 Un centavo de tolerancia: los valores del franco se redondean al guardarse.
    descuadres: filas.filter(f => Math.abs(f.diferencia) > 0.01),
    // 🛑 Un mes sin un solo período no se nota mirando el total, igual que los subdiarios vacíos.
    mesesVacios: meses.filter(m => !filas.some(f => f.periodo === m)),
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 👷 SUELDOS DEVENGADOS Y NO PAGADOS AL CIERRE — deuda del papel 04 (A-FEAT-1537, 2026-11-04)
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Un pago de sueldo con su fecha (de `sueldos_pagos`). */
export interface PagoDeSueldo { periodo_id: string; fecha: string | null; monto: number | string | null }

/** Un período del ejercicio con el `id`, para unirlo con sus pagos. */
export type PeriodoConId = PeriodoDeSueldo & { id: string }

export interface SueldoImpagoAlCierre {
  periodo: string
  empleado: string
  bruto: number
  pagadoAlCierre: number
  /** Lo que se pagó después del cierre: ESO es la deuda al cierre. */
  pagadoDespues: number
  fechaPago: string | null
  /** Lo que no se pagó nunca (si hay pagos después, es la diferencia que queda). */
  sinPagar: number
}

export interface SueldosImpagosAlCierre {
  /** Pagados (en todo o en parte) después del cierre: deuda al cierre, suman. */
  filas: SueldoImpagoAlCierre[]
  total: number
  /**
   * 🛑 A confirmar: períodos sin NINGÚN pago cargado, o con un resto que no se pagó nunca. No se sabe si son deuda —
   * van al respaldo, NO suman (nada se descarta en silencio).
   */
  aConfirmar: SueldoImpagoAlCierre[]
  totalAConfirmar: number
}

/**
 * JMS 04/11 en el papel 04: *«agregar sueldos (sin José, Andrés, MA que van por cta cte)»*.
 *
 * Manda la **fecha de cada pago**, no el estado de hoy (igual que las facturas): lo pagado después del cierre era deuda al
 * cierre. Entran sólo los empleados de la empresa del papel; los socios (MA, AMS, JMS) y los empleados de otra empresa,
 * no. Lo que no se pagó NUNCA (sin pagos cargados, o un resto) no se afirma como deuda: se lista aparte para confirmar.
 */
export function sueldosImpagosAlCierre(periodos: PeriodoConId[], pagos: PagoDeSueldo[], meses: string[],
  fechaCierre: string, empresa = "MSA"): SueldosImpagosAlCierre {
  const SOCIOS = new Set(["MA", "AMS", "JMS", "JOSE MARIA MARTINEZ", "ANDRES MARTINEZ", "MERCEDES ARECO"])
  const norm = (v: string | null | undefined) => (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim()
  const delEjercicio = new Set(meses)
  const porPeriodo = new Map<string, PagoDeSueldo[]>()
  for (const p of pagos) porPeriodo.set(p.periodo_id, [...(porPeriodo.get(p.periodo_id) ?? []), p])
  const filas: SueldoImpagoAlCierre[] = [], aConfirmar: SueldoImpagoAlCierre[] = []
  for (const p of periodos) {
    const periodo = `${p.anio}-${String(p.mes).padStart(2, "0")}`
    if (!delEjercicio.has(periodo)) continue
    if (norm(p.empleado?.empresa) !== norm(empresa) || SOCIOS.has(norm(p.empleado?.nombre))) continue
    const bruto = r2(n0(p.bruto_calculado))
    const ps = porPeriodo.get(p.id) ?? []
    const antes = r2(ps.filter(x => x.fecha && x.fecha <= fechaCierre).reduce((t, x) => t + n0(Number(x.monto)), 0))
    const despues = ps.filter(x => x.fecha && x.fecha > fechaCierre)
    const pagadoDespues = r2(despues.reduce((t, x) => t + n0(Number(x.monto)), 0))
    // $ 100 de tolerancia: los anticipos se redondean (Sigot enero: $ 30 de diferencia).
    if (bruto - antes < 100) continue
    const fila: SueldoImpagoAlCierre = {
      periodo, empleado: p.empleado?.nombre ?? "(sin nombre)", bruto, pagadoAlCierre: antes, pagadoDespues,
      fechaPago: despues.map(x => x.fecha!).sort().pop() ?? null, sinPagar: r2(Math.max(0, bruto - antes - pagadoDespues)),
    }
    if (pagadoDespues > 0) filas.push(fila)
    if (fila.sinPagar >= 100) aConfirmar.push(fila)
  }
  const orden = (a: SueldoImpagoAlCierre, b: SueldoImpagoAlCierre) => a.periodo.localeCompare(b.periodo) || a.empleado.localeCompare(b.empleado, "es")
  filas.sort(orden); aConfirmar.sort(orden)
  return {
    filas, total: r2(filas.reduce((t, x) => t + x.pagadoDespues, 0)),
    aConfirmar, totalAConfirmar: r2(aConfirmar.reduce((t, x) => t + x.sinPagar, 0)),
  }
}
