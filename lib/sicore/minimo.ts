/**
 * 🧮 El MÍNIMO NO IMPONIBLE de SICORE cuando se pagan VARIAS facturas al mismo proveedor.
 *
 * ## El problema que resuelve
 * RG 830 fija un mínimo por régimen y por período (Bienes $224.000, Servicios $67.170, …). El
 * mínimo se consume **una sola vez por proveedor y régimen en el MES** (RG 830 — corregido
 * 2026-09-23, [A-BUG-193]: antes acá decía «en la quincena»), no una vez por
 * factura. Entonces tres facturas de $148.202,62 · $95.916,33 · $74.140,48 —ninguna llega sola al
 * mínimo de bienes— **sí retienen**, porque suman $318.259,43.
 *
 * ## Cómo se reparte
 * Se procesan en orden y cada una consume lo que puede del mínimo que queda:
 *
 * | Factura | Mínimo disponible | Consume | Base | Retiene |
 * |---|---:|---:|---:|---:|
 * | 148.202,62 | 224.000,00 | 148.202,62 | 0 | no |
 * | 95.916,33 | 75.797,38 | 75.797,38 | 20.118,95 | 402,38 |
 * | 74.140,48 | el mínimo ya se consumió | 0 | 74.140,48 | 1.482,81 |
 * | | | **224.000,00** | **94.259,43** | **1.885,19** |
 *
 * 🧮 **Y ahí está el control** (§ CLAUDE.md — el mejor control es el camino inverso): sumar las
 * retenciones factura por factura tiene que dar **exactamente** `(total − mínimo) × alícuota`, y la
 * suma de los mínimos consumidos tiene que dar **el mínimo del régimen, una sola vez**. Si alguna de
 * las dos identidades no cierra, el reparto está mal.
 *
 * ## Por qué vive acá y no adentro del componente
 * Porque adentro **no se puede probar**: el cálculo estaba mezclado con lecturas a Supabase y con
 * el estado del modal. Acá es aritmética pura y entra en `lib/pruebas/casos.ts`.
 *
 * Nace de `A-BUG-137` (caso Alcorta, 10/09/2026).
 */

/** Redondeo a 2 decimales, como el resto de la plata del sistema. */
const r2 = (n: number) => Math.round(n * 100) / 100

export interface EntradaRetencion {
  /** Neto de la factura **ya en pesos** (convertido al TC de pago). */
  neto: number
  /** Mínimo del régimen elegido. Sale de `tipos_sicore_config`, nunca de una constante. */
  minimoRegimen: number
  /**
   * Neto ya pagado en el MES al mismo proveedor **sin retener**: consumió parte del mínimo.
   * Es lo que hace que el acumulado funcione entre pagos de días distintos.
   */
  netoPrevio: number
  /**
   * ¿Ya hubo una retención en el MES para este proveedor? Entonces el mínimo está consumido
   * entero y esta factura retiene sobre el neto completo, sin mínimo.
   */
  yaRetuvo: boolean
  /** Fracción: 2 % → 0.02. */
  alicuota: number
}

export interface ResultadoRetencion {
  /** Cuánto del mínimo consumió esta factura. La suma del grupo = el mínimo del régimen. */
  minimoAplicado: number
  baseImponible: number
  retencion: number
  /**
   * `false` = no llega al mínimo: se paga **sin** retención, pero **consume mínimo** y el circuito
   * tiene que seguir con la próxima. Ese "y sigue" es exactamente lo que faltaba en A-BUG-137.
   */
  retiene: boolean
}

export function calcularRetencion(e: EntradaRetencion): ResultadoRetencion {
  // El mínimo ya se consumió en el MES → cualquier positivo retiene, sin mínimo.
  if (e.yaRetuvo) {
    return {
      minimoAplicado: 0,
      baseImponible: r2(e.neto),
      retencion: r2(e.neto * e.alicuota),
      retiene: e.neto > 0,
    }
  }

  const minimoDisponible = Math.max(0, r2(e.minimoRegimen - e.netoPrevio))

  // No llega: consume todo lo que puede del mínimo y no retiene.
  if (e.neto <= minimoDisponible) {
    return { minimoAplicado: r2(e.neto), baseImponible: 0, retencion: 0, retiene: false }
  }

  const baseImponible = r2(e.neto - minimoDisponible)
  return {
    minimoAplicado: minimoDisponible,
    baseImponible,
    retencion: r2(baseImponible * e.alicuota),
    retiene: true,
  }
}

export interface PasoSecuencia extends ResultadoRetencion {
  neto: number
}

/**
 * Procesa **una tanda entera** de facturas del mismo proveedor y régimen, en orden.
 *
 * Es el modelo de lo que hace la cola del Cash Flow: cada factura que no retiene queda pagada y
 * suma al `netoPrevio` de la siguiente; la primera que retiene deja `yaRetuvo` en verdadero para
 * las que vienen atrás.
 *
 * ⚠️ **Es un modelo, no el camino real**: en la app el `netoPrevio` y el `yaRetuvo` se releen de la
 * base entre factura y factura. Sirve para probar la aritmética y el orden — **no** prueba que la
 * cola de la pantalla avance. Eso se prueba a mano (A-TEST-108).
 */
export function simularSecuencia(
  netos: number[], minimoRegimen: number, alicuota: number, netoPrevioInicial = 0
): PasoSecuencia[] {
  let netoPrevio = netoPrevioInicial
  let yaRetuvo = false
  const pasos: PasoSecuencia[] = []

  for (const neto of netos) {
    const res = calcularRetencion({ neto, minimoRegimen, netoPrevio, yaRetuvo, alicuota })
    pasos.push({ ...res, neto })
    if (res.retiene) yaRetuvo = true
    else netoPrevio = r2(netoPrevio + neto)   // pagada sin retener: consumió mínimo
  }

  return pasos
}

/** El control del camino inverso: lo que el grupo tiene que retener, calculado de una sola vez. */
export function retencionDelGrupo(netos: number[], minimoRegimen: number, alicuota: number): number {
  const total = r2(netos.reduce((s, n) => s + n, 0))
  return r2(Math.max(0, r2(total - minimoRegimen)) * alicuota)
}

/**
 * 🧾 La base DESPUÉS de aplicar un descuento — con la misma regla que `calcularRetencion` (A-BUG-1251).
 *
 * El paso del descuento del Cash Flow hacía su propia cuenta: `max(0, neto − mínimo)`. Con importes
 * positivos da lo mismo; con una **nota de crédito** (neto negativo) llevaba la base a cero y la NC
 * dejaba de restar. Caso Alcorta 13/10/2026: NC 820 por −110.194,67 pasó de «−2.203,89» a «0,00»
 * al aplicarle el 5 % — y el grupo retuvo $2.093,70 de más.
 *
 * - **Retención adicional** (el mínimo del mes ya se consumió): la base es el neto, tal cual —
 *   positivo o negativo.
 * - **Con mínimo**: lo que supere al mínimo aplicado; nunca negativa.
 */
export function baseTrasDescuento(netoAjustado: number, minimoAplicado: number, esRetencionAdicional: boolean): number {
  if (esRetencionAdicional) return r2(netoAjustado)
  return Math.max(0, r2(netoAjustado - minimoAplicado))
}

export interface RetencionVigente {
  id: string
  retencion: number
  grupo_pago_id?: string | null
}

/**
 * 🔁 ¿De qué factura se descuenta lo que resta una NOTA DE CRÉDITO? (A-BUG-1251)
 *
 * Una NC no lleva retención propia: lo que resta (`ajuste`, negativo) se descuenta de la retención
 * de una factura ya retenida del mismo proveedor, régimen y quincena. Así cada renglón de SICORE,
 * el certificado y el detalle de pago siguen siendo positivos y suman lo que de verdad se retuvo.
 *
 * Se elige, en orden: del **mismo grupo de pago** antes que de afuera, y la de **mayor retención**
 * (es la que seguro alcanza). `null` si ninguna alcanza a absorber el ajuste — ahí no se netea y la
 * pantalla lo avisa: no se deja una retención negativa ni se reparte en silencio.
 */
export function destinoDeNotaDeCredito(
  vigentes: readonly RetencionVigente[], ajuste: number, grupoPagoId?: string | null,
): RetencionVigente | null {
  const falta = r2(Math.abs(ajuste))
  if (falta === 0) return null
  const alcanzan = vigentes.filter(v => r2(v.retencion) >= falta)
  if (alcanzan.length === 0) return null
  const delGrupo = grupoPagoId ? alcanzan.filter(v => v.grupo_pago_id === grupoPagoId) : []
  const candidatas = delGrupo.length > 0 ? delGrupo : alcanzan
  return [...candidatas].sort((a, b) => b.retencion - a.retencion)[0]
}
