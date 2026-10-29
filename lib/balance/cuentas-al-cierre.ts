/**
 * 💳 **CUENTAS A PAGAR y CUENTAS A COBRAR al cierre — papeles 03 y 04.**
 *
 * Pedido del usuario 2026-09-29, revisando qué faltaba del export:
 * > *«En función de los ítems que aún no desarrollaste, debés desarrollar todos los que estén a tu
 * > alcance. **Ejemplo cuentas a pagar y cobrar, ¿lo hiciste? Eso es súper básico.**»*
 *
 * Tenía razón: estaban en su carpeta `- Enviados/` de papeles del balance anterior y yo no los había
 * mirado. Son los papeles **«03 - CUENTAS A COBRAR»** y **«04 - CUENTAS A PAGAR»**, con el mismo
 * formato de fila del libro de IVA (fecha, tipo, punto de venta, número, CUIT, denominación y la
 * apertura de importes) más su TOTAL.
 *
 * ## 🔑 EL PUNTO ENTERO: el estado de HOY no sirve
 *
 * Una factura que **hoy** figura como pagada pudo haberse pagado **después del cierre** — y entonces
 * al 30/06 era una deuda, y va al papel. Mirar `estado` contesta *«¿está paga ahora?»*, que es otra
 * pregunta.
 *
 * 🧨 **Y no es teórico: medido sobre el ejercicio 25/26 de MSA, 4 facturas conciliadas se pagaron
 * después del 30/06.** Con el criterio ingenuo desaparecían del papel.
 *
 * Entonces la pregunta correcta es **¿cuándo se pagó?**, y se contesta con dos datos, en este orden:
 *
 * 1. **`fecha_pago`** del comprobante, si la tiene.
 * 2. **La fecha del movimiento bancario** al que está conciliado. Es el dato bueno: es el banco
 *    diciendo cuándo salió la plata, no alguien declarándolo.
 *
 * ## ⚠️ Y el tercer caso, que es el que hay que mostrar y no esconder
 *
 * Hay comprobantes marcados **conciliados que no tienen ninguno de los dos datos**: ni fecha de pago
 * ni movimiento bancario enganchado. **Sobre el 25/26 de MSA son 46, por $6.368.187,17.**
 *
 * De ésos **no se puede afirmar nada**: ni que estaban pagos al cierre ni que no. Van a una lista
 * aparte, `sinDatoDePago`, con su total — § 🧮 *nada se descarta en silencio*. Meterlos en el papel
 * sería inventar una deuda; dejarlos afuera sin decirlo sería esconderla. Se dicen.
 *
 * ## 🧨 El tercer caso, que encontré dando un número falso
 *
 * **`msa.comprobantes_historico` no tiene ni `estado` ni `fecha_pago`.** Es lo que migró del sistema
 * anterior: son registros contables, no de pago. La primera versión los tomaba como «pendientes» por
 * defecto y **la deuda al cierre daba $193.981.013,42** — sobre $302 M de compras, o sea el 64 %.
 * El número era absurdo y por eso se miró; con el histórico aparte queda en su orden real.
 *
 * ✅ **RESUELTO por el usuario el 2026-09-29: «el bloque histórico dalo como pago sí».** Son los
 * comprobantes de jul–dic 2025 que migraron del sistema anterior: **se consideran pagados** y **no**
 * son cuentas a pagar al cierre.
 *
 * 📌 **Pero se siguen listando**, en `sinEstadoDePago`, con su total —**$162.885.886,68** en el
 * ejercicio 25/26 de MSA—. No es un descarte silencioso: es una **decisión declarada**, y el papel
 * tiene que poder mostrar sobre qué se apoya. Si alguna vez aparece un impago viejo, está la lista
 * para revisarlo.
 *
 * ⚠️ **Y la excepción se respeta**: si un comprobante del histórico **sí** tiene fecha de pago —o
 * está conciliado contra un movimiento bancario— manda la fecha, como con cualquier otro. La regla
 * es «sin dato, se da por pagado», no «el histórico se ignora».
 *
 * ## 🛡️ Las facturas de seguro en «cuotas»: se pagan por las cuotas de SU póliza (A-FEAT-1385)
 *
 * 🧨 **Entraban enteras al papel.** Una factura de Federación Patronal en estado `cuotas` no tiene
 * `fecha_pago` ni movimiento bancario propio: lo que se paga son las **cuotas**, que el banco debita
 * mes a mes y se concilian contra las cuotas del template de la póliza. Medido sobre el 25/26 de MSA:
 * la flota 34160783 entraba por **$3.437.834,03** cuando al 30/06 sólo quedaba impaga la cuota de julio.
 *
 * La regla, que es la de la pantalla de Seguros (§ «la póliza manda», `lib/polizas/sincronizar.ts`):
 *
 * - **La póliza es una sola**, aunque tenga varios endosos (JMS: *«la flota es una sola póliza»*), y
 *   tiene **un solo template** (`polizas_seguro.template_id`). Cada cuota del template es, por
 *   vencimiento, la suma de los endosos que vencen ese día menos lo que compensan las notas de crédito.
 * - La factura se ata a **su endoso** (`polizas_endosos.comprobante_arca_id`), y el endoso trae **su
 *   plan de cuotas** (`polizas_cuotas`: vencimiento e importe).
 * - Cada vencimiento de ese plan está **cancelado al cierre** si la cuota del template de ese
 *   vencimiento (±7 días, como `cuotasDeLaPoliza`) se pagó **hasta el cierre** —¿cuándo se pagó? con
 *   el mismo criterio de arriba: `fecha_pago` de la cuota o el movimiento bancario conciliado— o si
 *   **la compensó una NC** antes del cierre (cuota en 0, o ni siquiera generada porque el saldo a
 *   favor la cubría entera).
 * - **Deuda al cierre = total de la factura − lo cancelado de su plan.** Si da 0 no es deuda, y se
 *   lista aparte (`canceladasPorCuotas`): decisión declarada, no descarte en silencio.
 * - Una **NC** en `cuotas` es un crédito que se va **consumiendo** al compensar las cuotas siguientes
 *   (primero la más vieja). Al cierre queda en el papel sólo lo que todavía no se consumió.
 * - 🛑 **Si la factura no se puede atar a una póliza con template**, se queda como antes —entera, es
 *   lo prudente— pero se lista en `sinVinculoPoliza`, con su total, para que se vea.
 *
 * La lectura (pólizas, endosos, cuotas, fechas) la hace quien llama; acá se le pasa ya armado
 * (`canceladoPorCuotasAlCierre`) y el cálculo es puro.
 *
 * ## 📌 Lo que este módulo NO cubre todavía
 *
 * El papel 04 del usuario tiene además **cheques dados** (emitidos y no debitados al cierre) y
 * **anticipos a proveedores**; el 03 tiene **cheques en cartera** y **provisión de cobros**. Están
 * identificados y quedan registrados aparte — ver [A-FEAT-1195]. Acá está el cuerpo principal, que
 * es el listado de comprobantes impagos, y es el que mueve el número grande.
 */
import type { AsientoLibroDiario } from "./libro-diario"

/** Cómo se supo (o no) cuándo se pagó un comprobante. */
export type OrigenFechaPago =
  /** Lo dice el comprobante. */
  | "fecha_pago"
  /** Lo dice el banco: está conciliado contra un movimiento con fecha. Es el dato bueno. */
  | "movimiento bancario"
  /** No hay ninguno de los dos. */
  | "sin dato"

/** Un comprobante del ejercicio con lo que se sabe de su pago. */
export interface ComprobanteConPago {
  asiento: AsientoLibroDiario
  estado: string
  /** `fecha_pago` del comprobante, o la del movimiento bancario conciliado. `null` si no hay. */
  fechaPago: string | null
  origenFecha: OrigenFechaPago
}

/** Por qué un comprobante quedó (o no) en el papel. Se muestra: el criterio tiene que ser auditable. */
export type MotivoCuenta =
  | "no se pagó nunca"
  | "se pagó DESPUÉS del cierre"
  | "conciliado, pero sin saber cuándo"
  | "del sistema anterior: se da por pagado (decisión del usuario 2026-09-29)"
  | "seguro en cuotas: queda el saldo de su póliza al cierre"
  | "seguro en cuotas: su póliza tenía todo pago al cierre"
  | "seguro en cuotas: sin vínculo con la póliza (va entera)"

export interface FilaCuenta {
  asiento: AsientoLibroDiario
  estado: string
  fechaPago: string | null
  motivo: MotivoCuenta
  /**
   * 💰 Lo que pesa en el papel al cierre. Es el total de la factura salvo en los seguros en
   * `cuotas`, donde es **el saldo** (total − cuotas de la póliza pagadas al cierre).
   */
  importe: number
  /** Cómo se llegó al importe, cuando no es el total (los seguros en cuotas). */
  detalle?: string
}

export interface CuentasAlCierre {
  /** Lo que se debe (o se tiene a cobrar) al cierre, con certeza. */
  filas: FilaCuenta[]
  total: number
  /**
   * Los que están marcados como cobrados/pagados pero **sin ninguna fecha**: no se puede decidir.
   * Se listan aparte con su total, nunca se descartan en silencio.
   */
  sinDatoDePago: FilaCuenta[]
  totalSinDato: number
  /**
   * Los que vienen del **sistema anterior**, que no migró estado de pago ni fecha.
   *
   * ✅ **Se dan por PAGADOS** por decisión del usuario (2026-09-29) — no son deuda al cierre.
   * Se listan igual, con su total, para que el papel muestre en qué se apoya.
   */
  sinEstadoDePago: FilaCuenta[]
  totalSinEstado: number
  /**
   * 🛑 **La red: estados que este módulo no conoce.**
   *
   * No se tiran ni se cuentan: se informan, con su total y el nombre del estado, para que alguien
   * decida de qué lado van. § 🧮 *nada se descarta en silencio* — y esta red no es teórica: apenas
   * se puso, atrapó **$103.044.319,07** de ventas en estado `a cobrar`, que hasta ese momento
   * desaparecían del papel sin dejar rastro.
   */
  estadoDesconocido: FilaCuenta[]
  totalDesconocido: number
  /** Los nombres de estado que no se reconocieron, para poder agregarlos. */
  estadosSinClasificar: string[]
  /**
   * 🛡️ Seguros en `cuotas` cuya póliza tenía **todo pago** al cierre (ver § del encabezado). No son
   * deuda; se listan con su total para que se vea qué salió del papel y por qué.
   */
  canceladasPorCuotas: FilaCuenta[]
  totalCanceladasPorCuotas: number
  /**
   * 🛑 Seguros en `cuotas` que **no se pudieron atar** a una póliza con template. Siguen en `filas`
   * (enteros, como antes); esta lista los repite para que se vean. No suma aparte: ya están en `total`.
   */
  sinVinculoPoliza: FilaCuenta[]
  totalSinVinculoPoliza: number
  /**
   * 🛡️ Cuotas de póliza vencidas al cierre que **nunca se debitaron** (JMS 29/10/2026: *«una cuota mensual que no
   * se debitó más implica por ahora la conclusión de que faltan NC a recibir»*). NO son deuda: salen del total y se
   * marcan aparte. El papel 14 (cuenta corriente con la aseguradora) las muestra como «NC pendiente».
   */
  faltaNc: FilaCuenta[]
  totalFaltaNc: number
  /** Cuántos se pagaron después del cierre — el caso que el criterio ingenuo perdía. */
  pagadosDespues: number
  /** Total de comprobantes mirados, para poder cerrar contra el libro. */
  mirados: number
}

/**
 * Los estados que significan **«esto no se pagó»**, y valen sólo cuando no hay ninguna fecha.
 *
 * ⚠️ `anterior` NO está: marca un comprobante de un ejercicio previo y su deuda, si la hay, es de
 * aquel balance, no de éste. Meterlo acá duplicaría la deuda entre dos ejercicios.
 */
const ESTADOS_IMPAGOS = [
  "pendiente", "pagar", "preparado", "programado", "echeq", "cuotas",
  // 🧨 **«a cobrar», con espacio, es el estado de TODAS las ventas.** Faltaba, y las 4 facturas del
  //    ejercicio —**$103.044.319,07**— se caían del papel **sin que nada lo dijera**. Lo encontró la
  //    red de abajo (`estadoDesconocido`), que se puso justamente por esto.
  "a cobrar",
]

/** Los estados que afirman que se pagó. Sin fecha, esa afirmación no se puede ubicar en el tiempo. */
const ESTADOS_PAGADOS = ["pagado", "conciliado", "cobrado"]

/**
 * Los que **no son deuda de este ejercicio**, y se descartan a propósito.
 *
 * - `anterior`: comprobante de un ejercicio previo; su deuda, si la hay, es de aquel balance.
 * - `credito` / `debito`: son notas, no facturas a pagar.
 *
 * ⚠️ **Todo lo que no esté en ninguna de las tres listas cae en `estadoDesconocido`**, que se
 * informa. Es la red que atrapó lo de «a cobrar».
 */
const ESTADOS_AJENOS = ["anterior", "credito", "debito", "anulado"]

const r2 = (n: number) => Math.round(n * 100) / 100

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🛡️ Seguros en «cuotas»: cuánto de cada factura canceló su póliza hasta el cierre
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Un renglón del plan de cuotas de un endoso (`polizas_cuotas`), con la factura del endoso. */
export interface LineaPlanPoliza {
  /** `polizas_endosos.comprobante_arca_id`. `null` si el endoso no tiene factura enganchada. */
  comprobanteId: string | null
  vencimiento: string
  /** Negativo en una nota de crédito. */
  importe: number
}

/** Una cuota del template de la póliza (`cuotas_egresos_sin_factura`), con cuándo se pagó. */
export interface CuotaTemplatePoliza {
  vencimiento: string
  monto: number
  estado: string
  /** `fecha_pago` de la cuota o la del movimiento conciliado a ella (`template_cuota_id`). */
  fechaPago: string | null
}

/** Una póliza, con el plan de todos sus endosos y las cuotas de SU template. */
export interface PolizaParaCierre {
  poliza: string
  /** Todos los endosos, tengan o no su factura en el papel: el template los cuota a todos juntos. */
  lineas: LineaPlanPoliza[]
  cuotasTemplate: CuotaTemplatePoliza[]
}

/** Lo que la póliza canceló de una factura hasta el cierre. */
export interface CanceladoPorCuotas {
  poliza: string
  /** Mismo signo que la factura: positivo en una factura, negativo en una NC (lo ya consumido). */
  cancelado: number
  detalle: string
  /** Lo vencido al cierre cuya cuota NUNCA se debitó: falta la NC a recibir, no es deuda. */
  faltaNc?: number
  detalleFaltaNc?: string
}

/** Margen para juntar vencimientos: el de `cuotasDeLaPoliza` (plan del endoso vs. consolidado). */
const MARGEN_DIAS = 7
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5)

/**
 * 🛡️ **Cuánto de cada factura de seguro canceló su póliza hasta el cierre.** Pura.
 *
 * Recorre los vencimientos de la póliza en orden (juntando los que caen a ≤ 7 días, como la pantalla
 * de Seguros). Un vencimiento queda **cancelado** si su cuota del template se pagó hasta el cierre, o
 * si —vencido antes del cierre— lo compensó el saldo a favor de las NC (cuota en 0, o sin cuota porque
 * el saldo lo cubría entero). Cancelado, cancela **todos** los renglones de ese vencimiento, de todos
 * los endosos; lo que puso la NC se le descuenta a la NC, la más vieja primero.
 *
 * Un vencimiento que no queda cancelado no cancela nada: la factura sigue debiéndolo, y la NC sigue
 * teniendo ese crédito. Así el papel queda parejo de los dos lados.
 *
 * @returns  id de factura → lo cancelado. Una factura que no aparece no se pudo atar a la póliza.
 */
export function canceladoPorCuotasAlCierre(
  polizas: PolizaParaCierre[],
  fechaCierre: string,
): Map<string, CanceladoPorCuotas> {
  const out = new Map<string, CanceladoPorCuotas>()

  for (const p of polizas) {
    const cancelado = new Map<string, number>()
    const faltaNc = new Map<string, { importe: number; cuotas: string[] }>()
    const venc = new Map<string, { cuotas: number; de: number }>()
    const anotar = (id: string | null, importe: number, cuenta: boolean) => {
      if (!id) return
      cancelado.set(id, r2((cancelado.get(id) ?? 0) + importe))
      const v = venc.get(id) ?? { cuotas: 0, de: 0 }
      if (cuenta) v.cuotas += 1
      venc.set(id, v)
    }
    for (const l of p.lineas) {
      if (!l.comprobanteId) continue
      const v = venc.get(l.comprobanteId) ?? { cuotas: 0, de: 0 }
      v.de += 1
      venc.set(l.comprobanteId, v)
      if (!cancelado.has(l.comprobanteId)) cancelado.set(l.comprobanteId, 0)
    }

    // Los vencimientos de la póliza, juntando los que caen a pocos días.
    const grupos: { vencimiento: string; lineas: LineaPlanPoliza[] }[] = []
    for (const l of [...p.lineas].sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))) {
      const prev = grupos[grupos.length - 1]
      if (prev && Math.abs(dias(l.vencimiento, prev.vencimiento)) <= MARGEN_DIAS) {
        prev.lineas.push(l)
        if (l.vencimiento > prev.vencimiento) prev.vencimiento = l.vencimiento
      } else grupos.push({ vencimiento: l.vencimiento, lineas: [l] })
    }

    // Cada cuota del template se usa una vez: la más cercana al vencimiento, dentro del margen.
    const libres = [...p.cuotasTemplate]
    const cuotaDe = (g: { vencimiento: string; lineas: LineaPlanPoliza[] }) => {
      let mejor = -1
      for (let i = 0; i < libres.length; i++) {
        const d = Math.min(...g.lineas.map(l => Math.abs(dias(libres[i].vencimiento, l.vencimiento))),
          Math.abs(dias(libres[i].vencimiento, g.vencimiento)))
        if (d > MARGEN_DIAS) continue
        if (mejor < 0 || Math.abs(dias(libres[i].vencimiento, g.vencimiento))
          < Math.abs(dias(libres[mejor].vencimiento, g.vencimiento))) mejor = i
      }
      return mejor < 0 ? null : libres.splice(mejor, 1)[0]
    }

    /** El saldo a favor de las NC, la más vieja primero. */
    const aFavor: { id: string | null; resto: number }[] = []
    const disponible = () => r2(aFavor.reduce((s, x) => s + x.resto, 0))

    for (const g of grupos) {
      for (const l of g.lineas) if (l.importe < 0) aFavor.push({ id: l.comprobanteId, resto: -l.importe })
      const positivas = g.lineas.filter(l => l.importe > 0)
      const bruto = r2(positivas.reduce((s, l) => s + l.importe, 0))
      const t = cuotaDe(g)
      if (bruto <= 0) continue

      const vencio = g.vencimiento <= fechaCierre
      const pagadaAlCierre = !!t && t.monto > 0.005 && !!t.fechaPago && t.fechaPago <= fechaCierre
      // Compensada: la NC la cubrió. La cuota quedó en 0, o no se generó porque el saldo alcanzaba.
      const compensada = vencio && (t ? t.monto <= 0.005 : disponible() >= bruto - 0.005)
      // 🛡️ Vencida al cierre y su cuota NUNCA se debitó (ni después): la póliza dejó de cobrarse → falta la NC.
      if (vencio && !compensada && t && t.monto > 0.005 && !t.fechaPago && !/^(pagad|concilia)/i.test(t.estado)) {
        for (const l of positivas) {
          if (!l.comprobanteId) continue
          const x = faltaNc.get(l.comprobanteId) ?? { importe: 0, cuotas: [] }
          x.importe = r2(x.importe + l.importe)
          if (!x.cuotas.includes(g.vencimiento)) x.cuotas.push(g.vencimiento)
          faltaNc.set(l.comprobanteId, x)
        }
        continue
      }
      if (!pagadaAlCierre && !compensada) continue

      // Lo que no puso el banco lo puso la NC: se le descuenta, la más vieja primero.
      let porNc = r2(Math.min(disponible(), Math.max(0, bruto - (pagadaAlCierre ? t!.monto : 0))))
      for (const nc of aFavor) {
        if (porNc <= 0.005) break
        const usa = r2(Math.min(nc.resto, porNc))
        nc.resto = r2(nc.resto - usa)
        porNc = r2(porNc - usa)
        anotar(nc.id, -usa, false)
      }
      for (const l of positivas) anotar(l.comprobanteId, l.importe, true)
    }

    for (const [id, monto] of cancelado) {
      const v = venc.get(id) ?? { cuotas: 0, de: 0 }
      const detalle = monto < 0
        ? `NC de la póliza ${p.poliza}: ${fmt(-monto)} ya compensado en cuotas al ${fechaCierre}`
        : `póliza ${p.poliza}: ${v.cuotas} de ${v.de} cuota(s) del plan pagas al ${fechaCierre} (${fmt(monto)})`
      const f = faltaNc.get(id)
      out.set(id, {
        poliza: p.poliza, cancelado: monto, detalle,
        ...(f ? { faltaNc: f.importe, detalleFaltaNc: `póliza ${p.poliza}: ${f.cuotas.length} cuota(s) vencida(s) sin débito (${f.cuotas.join(", ")}) — falta la NC a recibir (ver papel 14)` } : {}),
      })
    }
    // Una factura cuyas cuotas vencidas nunca se debitaron y no tiene nada cancelado: también va.
    for (const [id, f] of faltaNc) if (!out.has(id)) out.set(id, {
      poliza: p.poliza, cancelado: 0, detalle: `póliza ${p.poliza}: ninguna cuota paga al ${fechaCierre}`,
      faltaNc: f.importe, detalleFaltaNc: `póliza ${p.poliza}: ${f.cuotas.length} cuota(s) vencida(s) sin débito (${f.cuotas.join(", ")}) — falta la NC a recibir (ver papel 14)`,
    })
  }
  return out
}

const fmt = (n: number) => "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Arma las pólizas para `canceladoPorCuotasAlCierre` desde lo leído. Pura: la usan la pantalla y el script.
 *
 * @param polizas      `polizas_seguro` con `template_id` y `polizas_endosos(comprobante_arca_id, polizas_cuotas(vencimiento, importe))`
 * @param cuotas       `cuotas_egresos_sin_factura` (las de los templates de las pólizas; las demás se ignoran)
 * @param fechasBanco  id de cuota → fecha del movimiento conciliado (`buscarFechasDePagoDeCuotas`)
 *
 * Una póliza **sin template** no entra: sus facturas quedan «sin vínculo con la póliza», y se ven.
 */
export function polizasParaCierreDesde(
  polizas: Array<Record<string, unknown>>,
  cuotas: Array<Record<string, unknown>>,
  fechasBanco: Map<string, string>,
): PolizaParaCierre[] {
  const f10 = (v: unknown) => (v ? String(v).slice(0, 10) : null)
  const porTemplate = new Map<string, CuotaTemplatePoliza[]>()
  for (const q of cuotas) {
    const tpl = q.egreso_id ? String(q.egreso_id) : null
    const vencimiento = f10(q.fecha_vencimiento) ?? f10(q.fecha_estimada)
    if (!tpl || !vencimiento) continue
    porTemplate.set(tpl, [...(porTemplate.get(tpl) ?? []), {
      vencimiento, monto: Number(q.monto ?? 0), estado: String(q.estado ?? ""),
      fechaPago: f10(q.fecha_pago) ?? fechasBanco.get(String(q.id)) ?? null,
    }])
  }
  const out: PolizaParaCierre[] = []
  for (const p of polizas) {
    if (!p.template_id) continue
    const endosos = (p.polizas_endosos ?? []) as Array<Record<string, unknown>>
    out.push({
      poliza: String(p.poliza ?? ""),
      lineas: endosos.flatMap(e => ((e.polizas_cuotas ?? []) as Array<Record<string, unknown>>).map(c => ({
        comprobanteId: e.comprobante_arca_id ? String(e.comprobante_arca_id) : null,
        vencimiento: f10(c.vencimiento) ?? "",
        importe: Number(c.importe ?? 0),
      }))).filter(l => l.vencimiento),
      cuotasTemplate: porTemplate.get(String(p.template_id)) ?? [],
    })
  }
  return out
}

/**
 * Arma el papel de cuentas a pagar (o a cobrar: es el mismo cálculo del otro lado del mostrador).
 *
 * @param comprobantes  los del ejercicio, con lo que se sabe de su pago
 * @param fechaCierre   `AAAA-MM-DD`. Se compara como texto, que en ISO ordena igual que la fecha
 * @param cuotasPoliza  🛡️ para los seguros en `cuotas`: lo que su póliza canceló hasta el cierre
 *                      (`canceladoPorCuotasAlCierre`). Sin él, el estado `cuotas` va entero como antes
 *                      (las ventas no lo necesitan).
 */
export function armarCuentasAlCierre(
  comprobantes: ComprobanteConPago[],
  fechaCierre: string,
  cuotasPoliza?: Map<string, CanceladoPorCuotas>,
): CuentasAlCierre {
  const filas: FilaCuenta[] = []
  const sinDatoDePago: FilaCuenta[] = []
  const sinEstadoDePago: FilaCuenta[] = []
  const estadoDesconocido: FilaCuenta[] = []
  const canceladasPorCuotas: FilaCuenta[] = []
  const sinVinculoPoliza: FilaCuenta[] = []
  const faltaNc: FilaCuenta[] = []
  const estadosSinClasificar = new Set<string>()
  let pagadosDespues = 0

  for (const c of comprobantes) {
    const estado = (c.estado || "pendiente").toLowerCase()
    const base = { asiento: c.asiento, estado, fechaPago: c.fechaPago, importe: c.asiento.total }

    /**
     * 🧨 El histórico primero, ANTES de mirar el estado: no tiene ninguno, y el default de la
     * pantalla («pendiente») lo convertiría en deuda. Así daba $194 M de cuentas a pagar.
     *
     * ✅ **Decisión del usuario (2026-09-29): se dan por PAGADOS.** No entran al papel, pero quedan
     * listados con su total, porque una decisión declarada no es lo mismo que un descarte en
     * silencio (§ 🧮): el papel tiene que poder mostrar sobre qué se apoya.
     */
    if (c.asiento.fuente === "historico" && !c.fechaPago) {
      sinEstadoDePago.push({
        ...base,
        motivo: "del sistema anterior: se da por pagado (decisión del usuario 2026-09-29)",
      })
      continue
    }

    if (c.fechaPago) {
      // Hay fecha: la pregunta se contesta sola y no depende del estado de hoy.
      if (c.fechaPago <= fechaCierre) continue          // pagado al cierre: no es deuda
      filas.push({ ...base, motivo: "se pagó DESPUÉS del cierre" })
      pagadosDespues += 1
      continue
    }

    /**
     * 🛡️ El seguro en `cuotas`: lo que se paga son las cuotas de su póliza, no la factura. Ver § del
     * encabezado. Sin vínculo con la póliza va entero, como antes, pero se dice.
     */
    if (estado === "cuotas" && cuotasPoliza) {
      const p = cuotasPoliza.get(c.asiento.id)
      if (!p) {
        const fila: FilaCuenta = { ...base, motivo: "seguro en cuotas: sin vínculo con la póliza (va entera)" }
        filas.push(fila)
        sinVinculoPoliza.push(fila)
        continue
      }
      // 🛡️ Lo que nunca se debitó no es deuda: falta la NC (JMS 29/10). Se marca aparte, fuera del total.
      if (p.faltaNc && Math.abs(p.faltaNc) >= 0.01) {
        faltaNc.push({ ...base, importe: p.faltaNc, motivo: "seguro en cuotas: dejó de debitarse — falta la NC a recibir", detalle: p.detalleFaltaNc })
      }
      const saldo = r2(c.asiento.total - p.cancelado - (p.faltaNc ?? 0))
      if (Math.abs(saldo) < 0.01) {
        if (!p.faltaNc) canceladasPorCuotas.push({ ...base, motivo: "seguro en cuotas: su póliza tenía todo pago al cierre", detalle: p.detalle })
        continue
      }
      filas.push({
        ...base, importe: saldo, motivo: "seguro en cuotas: queda el saldo de su póliza al cierre",
        detalle: `factura ${fmt(c.asiento.total)} − ${p.detalle} = ${fmt(saldo)}`,
      })
      continue
    }

    // Sin fecha, manda el estado — y sólo alcanza para uno de los dos lados.
    if (ESTADOS_IMPAGOS.includes(estado)) {
      filas.push({ ...base, motivo: "no se pagó nunca" })
      continue
    }
    if (ESTADOS_PAGADOS.includes(estado)) {
      // 🔑 Acá está el hueco honesto: dice que se pagó, pero no cuándo.
      sinDatoDePago.push({ ...base, motivo: "conciliado, pero sin saber cuándo" })
      continue
    }
    if (ESTADOS_AJENOS.includes(estado)) continue   // no es deuda de este ejercicio, a propósito

    // 🛑 Un estado que no conocemos NO se tira: se informa. Ver `estadoDesconocido`.
    estadosSinClasificar.add(estado)
    estadoDesconocido.push({ ...base, motivo: "no se pagó nunca" })
  }

  // 💰 Suma `importe`, no el total: en un seguro en cuotas lo que se debe es el saldo.
  const sumar = (f: FilaCuenta[]) => r2(f.reduce((s, x) => s + x.importe, 0))
  const porPeso = (f: FilaCuenta[]) => f.sort((a, b) => Math.abs(b.importe) - Math.abs(a.importe))

  return {
    filas: filas.sort((a, b) =>
      (a.asiento.denominacion || "").localeCompare(b.asiento.denominacion || "", "es")),
    total: sumar(filas),
    sinDatoDePago: porPeso(sinDatoDePago),
    totalSinDato: sumar(sinDatoDePago),
    sinEstadoDePago: porPeso(sinEstadoDePago),
    totalSinEstado: sumar(sinEstadoDePago),
    estadoDesconocido: porPeso(estadoDesconocido),
    totalDesconocido: sumar(estadoDesconocido),
    estadosSinClasificar: [...estadosSinClasificar].sort(),
    canceladasPorCuotas: porPeso(canceladasPorCuotas),
    totalCanceladasPorCuotas: sumar(canceladasPorCuotas),
    sinVinculoPoliza: porPeso(sinVinculoPoliza),
    totalSinVinculoPoliza: sumar(sinVinculoPoliza),
    faltaNc: porPeso(faltaNc),
    totalFaltaNc: sumar(faltaNc),
    pagadosDespues,
    mirados: comprobantes.length,
  }
}
