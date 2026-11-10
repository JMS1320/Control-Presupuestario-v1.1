/**
 * 🏦 **EL BANCO DE CADA CUOTA DE TEMPLATE** — A-FEAT-1515 (JMS 01/11, libro H).
 *
 * JMS: *«el primer usuario del reporte soy yo, que lo tengo que auditar… como se da en el extracto: la fecha, el monto, el
 * comprobante, el proveedor y el detalle»*. Para eso cada cuota necesita su lado del banco: **en qué cuenta se pagó, con qué
 * comprobante, y cuánto de ella respalda el movimiento** — eso último es el control contra el banco de cada solapa (§ 🧮: el
 * mismo número por dos caminos; el banco es una fuente independiente de las cuotas).
 *
 * | Vínculo | Cómo se resuelve |
 * |---|---|
 * | el movimiento apunta a la CUOTA (`template_cuota_id` = id de la cuota) | respalda lo que suma el movimiento (débito − crédito) |
 * | el movimiento apunta al GRUPO (`template_cuota_id` = `grupo_pago_id`: varias cuotas pagadas juntas) | si el grupo entero suma lo que pagó el banco, cada cuota está respaldada por su monto; si no, se reparte en proporción y se dice |
 * | ningún movimiento, y la cuota dice «conciliado» | no hay respaldo: se lista |
 * | la cuenta está en dólares | no se compara (la cuota está en pesos): se lista |
 *
 * Las tablas son las de `TABLAS_CON_VINCULO_ARCA` — todas llevan también `template_cuota_id` (leído de la base el 01/11).
 */
import type { ClienteMinimo } from "./fechas-de-pago"
import type { CuotaTemplate, BancoDeCuota } from "./templates-libro"
import { TABLAS_CON_VINCULO_ARCA, type TablaConVinculoArca } from "@/lib/conciliacion/tablas-con-vinculo-arca"

export interface MovimientoDeCuota {
  /** A qué apunta: el id de la cuota o el de su grupo de pago. */
  vinculo: string
  cuenta: string
  /** De quién es la cuenta (MSA / PAM / MA / Cotitulares): QUIÉN PAGÓ la cuota (A-FEAT-1521, Libertad). */
  titular: string
  fecha: string
  comprobante: string
  debitos: number
  creditos: number
  enDolares: boolean
  /** 💳 A-BUG-1584: lo que la TARJETA cobró en dólares (`debitos_usd` − `creditos_usd`); 0 si no es tarjeta o no hay dólares. */
  usd?: number
  /** 🔍 A-FEAT-1579: el código contable del movimiento (`CTA MA`, `DIST MA`, `LIB`…), para el libro H para auditar. */
  contable?: string
  /** 🔍 A-FEAT-1579 (contexto para auditar, JMS 09/11): la descripción del banco, el beneficiario / CUIT (leyendas), el código interno y la
   * factura vinculada al movimiento (su id; el texto lo pone `conFacturas`). */
  descripcion?: string
  beneficiario?: string
  interno?: string
  comprobanteArcaId?: string
}

export interface MovimientosDeCuotas {
  movimientos: MovimientoDeCuota[]
  /** Tablas que no se pudieron leer: se muestran (un vínculo no mirado parece un vínculo que no existe). */
  tablasQueFallaron: string[]
}

const r2 = (n: number) => Math.round(n * 100) / 100
const TANDA = 300
const nombreCuenta = (t: TablaConVinculoArca) => t.cuenta ?? `${t.schema}.${t.tabla}`

/** Lee los movimientos que apuntan a estas cuotas o a sus grupos de pago, en todas las cuentas. */
export async function leerMovimientosDeCuotas(cliente: ClienteMinimo, cuotas: CuotaTemplate[]): Promise<MovimientosDeCuotas> {
  const ids = [...new Set(cuotas.flatMap(c => [c.id, c.grupoPagoId]).filter((x): x is string => !!x))]
  const movimientos: MovimientoDeCuota[] = []
  const tablasQueFallaron: string[] = []
  if (!ids.length) return { movimientos, tablasQueFallaron }
  for (const t of TABLAS_CON_VINCULO_ARCA) {
    const esTarjeta = /tarjeta/.test(t.tabla)
    for (let i = 0; i < ids.length; i += TANDA) {
      const q = t.schema === "public" ? cliente.from(t.tabla) : cliente.schema(t.schema).from(t.tabla)
      const { data, error } = await q
        // todas las columnas: las leyendas (beneficiario) y el interno no están en todas las cuentas
        .select("*")
        .in("template_cuota_id", ids.slice(i, i + TANDA))
      if (error) { if (!tablasQueFallaron.includes(nombreCuenta(t))) tablasQueFallaron.push(nombreCuenta(t)); continue }
      for (const m of (data ?? []) as Array<Record<string, unknown>>) {
        movimientos.push({
          vinculo: String(m.template_cuota_id),
          cuenta: nombreCuenta(t),
          titular: t.titular ?? "",
          fecha: String(m.fecha ?? "").slice(0, 10),
          comprobante: String((esTarjeta ? m.comprobante || m.numero_de_comprobante : m.numero_de_comprobante) ?? "").trim(),
          debitos: Number(m.debitos) || 0,
          creditos: Number(m.creditos) || 0,
          enDolares: !!t.enDolares,
          // 💳 A-BUG-1584: la tarjeta guarda las compras en dólares aparte (`debitos_usd`): sin esto, una compra en US$ se lee como $ 0
          usd: esTarjeta ? (Number(m.debitos_usd) || 0) - (Number(m.creditos_usd) || 0) : 0,
          contable: String(m.contable ?? "").trim(),
          descripcion: String(m.descripcion ?? "").trim(),
          beneficiario: [m.leyendas_adicionales_1, m.leyendas_adicionales_2, m.leyendas_adicionales_3, m.leyendas_adicionales_4]
            .map(x => String(x ?? "").trim()).filter(Boolean).join(" · "),
          interno: String(m.interno ?? "").trim(),
          comprobanteArcaId: m.comprobante_arca_id ? String(m.comprobante_arca_id) : undefined,
        })
      }
    }
  }
  return { movimientos, tablasQueFallaron }
}

/**
 * Pura. Le pone a cada cuota su lado del banco. `todas` son TODAS las cuotas leídas (para el total de un grupo de pago, que
 * puede tener cuotas en otras solapas o en otro ejercicio). Devuelve cuotas nuevas: no toca las que recibe.
 */
export function vincularBanco(cuotas: CuotaTemplate[], todas: CuotaTemplate[], movs: MovimientoDeCuota[]): CuotaTemplate[] {
  const porVinculo = new Map<string, MovimientoDeCuota[]>()
  for (const m of movs) porVinculo.set(m.vinculo, [...(porVinculo.get(m.vinculo) ?? []), m])
  const totalGrupo = new Map<string, { total: number; n: number }>()
  for (const c of todas) if (c.grupoPagoId) {
    const g = totalGrupo.get(c.grupoPagoId) ?? { total: 0, n: 0 }
    totalGrupo.set(c.grupoPagoId, { total: r2(g.total + c.monto), n: g.n + 1 })
  }
  return cuotas.map(c => ({ ...c, banco: bancoDe(c, porVinculo, totalGrupo) }))
}

/** El motivo de las conciliadas en $ 0 sin movimiento: van al final de la lista de casos. */
export const MOTIVO_EN_CERO = "conciliada en $ 0, sin movimiento (no mueve plata)"

const unicos = (xs: string[]) => [...new Set(xs.filter(Boolean))].join(" + ")
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function bancoDe(c: CuotaTemplate, porVinculo: Map<string, MovimientoDeCuota[]>, totalGrupo: Map<string, { total: number; n: number }>): BancoDeCuota {
  const conciliada = /conciliad/i.test(c.estado)
  const propios = porVinculo.get(c.id) ?? []
  const delGrupo = c.grupoPagoId ? porVinculo.get(c.grupoPagoId) ?? [] : []
  const ms = propios.length ? propios : delGrupo
  const cuenta = unicos(ms.map(m => m.cuenta))
  const comprobante = unicos(ms.map(m => m.comprobante))
  const titular = unicos(ms.map(m => m.titular))
  const contable = unicos(ms.map(m => m.contable ?? ""))
  const contexto = { descripcion: unicos(ms.map(m => m.descripcion ?? "")), beneficiario: unicos(ms.map(m => m.beneficiario ?? "")),
    interno: unicos(ms.map(m => m.interno ?? "")), facturaIds: [...new Set(ms.map(m => m.comprobanteArcaId).filter((x): x is string => !!x))] }
  if (!ms.length) {
    if (!conciliada) return { cuenta: "", comprobante: "", respaldo: null, motivo: null }
    // 01/11: 85 de las 87 conciliadas sin movimiento están en $ 0 (SICORE sin retenciones, retiros semestrales…): no mueven
    // plata y no cambian el control, pero se dicen aparte para que no tapen a las que sí (A-BUG-1517).
    return Math.abs(c.monto) < 0.005
      ? { cuenta: "", comprobante: "", respaldo: 0, motivo: MOTIVO_EN_CERO }
      : { cuenta: "", comprobante: "", respaldo: null, motivo: "conciliada sin movimiento en el banco" }
  }
  if (ms.some(m => m.enDolares)) return { cuenta, titular, contable, ...contexto, comprobante, respaldo: null, motivo: "pagada desde una cuenta en dólares: no se compara con la cuota en pesos" }
  const neto = r2(ms.reduce((t, m) => t + m.debitos - m.creditos, 0))
  // 💳 A-BUG-1584 (JMS 10/11: «siempre y cuando la inconsistencia salte»): una compra en DÓLARES con la tarjeta tiene $ 0 en pesos — si la
  // cuota también está en $ 0, el gasto no suma en pesos. Se dice con el importe en dólares (no se elige un tipo de cambio en silencio).
  const usd = r2(ms.reduce((t, m) => t + (m.usd ?? 0), 0))
  if (Math.abs(neto) < 0.005 && Math.abs(usd) >= 0.005 && Math.abs(c.monto) < 0.005)
    return { cuenta, titular, contable, ...contexto, comprobante, respaldo: 0, motivo: `se pagó US$ ${fmt(usd)} con la tarjeta y la cuota dice $ 0 (no está pasada a pesos)` }
  if (propios.length) {
    return { cuenta, titular, contable, ...contexto, comprobante, respaldo: neto, motivo: Math.abs(neto - c.monto) > 0.01 ? `el banco movió $ ${fmt(neto)} y la cuota dice $ ${fmt(c.monto)}` : null }
  }
  const g = totalGrupo.get(c.grupoPagoId!) ?? { total: c.monto, n: 1 }
  if (Math.abs(neto - g.total) <= 0.01) return { cuenta, titular, contable, ...contexto, comprobante, respaldo: c.monto, motivo: null }
  const respaldo = g.total ? r2(c.monto * neto / g.total) : 0
  return { cuenta, titular, contable, ...contexto, comprobante, respaldo, motivo: `pago agrupado de ${g.n} cuotas por $ ${fmt(g.total)}; el banco movió $ ${fmt(neto)}` }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
/**
 * 🔎 **EL EXTRACTO DEL EJERCICIO, PARA EL CONTROL 4 DEL LIBRO H** — A-FEAT-1518 (JMS 01/11, «H · MSA · Imp Rurales»:
 * *«¿están hechos los controles de los registros desde extractos contra templates?»*).
 *
 * El control 3 va de la cuota al banco. Éste va al revés: cada movimiento del banco con la categoría de una solapa, ¿a qué
 * quedó atado? A una cuota de esa solapa (✓), a una cuota de OTRO responsable (pagado por cuenta de otra empresa ⚠️), a una
 * cuota del mismo responsable en otra solapa (ℹ️ ya está allá), a una factura (ℹ️ va por el subdiario) o a nada (⚠️).
 * Caso que lo justificó (01/11): de 31 movimientos de MSA con categoría de impuesto rural, 17 pagaban impuestos de MA y PAM.
 */
export interface MovimientoExtractoH {
  titular: string
  cuenta: string
  fecha: string
  descripcion: string
  categ: string
  debitos: number
  creditos: number
  templateCuotaId: string | null
  comprobanteArcaId: string | null
  /** Atado a un sueldo, una venta (cobro) o un anticipo: ya figura en su papel. */
  otroVinculo: boolean
  estado: string
  /** La marca contable del movimiento (`LIB`, `CTA MA`…). */
  contable: string
  enDolares: boolean
}

/**
 * Los movimientos del ejercicio de todas las cuentas, de a 1000 — con categoría Y sin ella (02/11: los 12 pagos de la VISA de
 * MSA estaban sin categoría y por eso el control 4 no los vio; ahora los sin categoría van a su propia solapa).
 */
export async function leerExtractoDelEjercicio(cliente: ClienteMinimo, desde: string, hasta: string): Promise<{ movimientos: MovimientoExtractoH[]; tablasQueFallaron: string[] }> {
  const movimientos: MovimientoExtractoH[] = []
  const tablasQueFallaron: string[] = []
  for (const t of TABLAS_CON_VINCULO_ARCA) {
    for (let d = 0; ; d += 1000) {
      const q = t.schema === "public" ? cliente.from(t.tabla) : cliente.schema(t.schema).from(t.tabla)
      // ClienteMinimo no tipa gte/lte/not/range: se usan igual que en el resto del repo.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (q.select("fecha, descripcion, categ, contable, debitos, creditos, estado, template_cuota_id, comprobante_arca_id, sueldo_pago_id, comprobante_venta_id, anticipo_id") as any)
        .gte("fecha", desde).lte("fecha", hasta).order("fecha").range(d, d + 999)
      if (error) { tablasQueFallaron.push(nombreCuenta(t)); break }
      for (const m of (data ?? []) as Array<Record<string, unknown>>) {
        movimientos.push({
          titular: t.titular ?? "", cuenta: nombreCuenta(t), fecha: String(m.fecha ?? "").slice(0, 10),
          descripcion: String(m.descripcion ?? ""), categ: String(m.categ ?? ""),
          debitos: Number(m.debitos) || 0, creditos: Number(m.creditos) || 0,
          templateCuotaId: m.template_cuota_id ? String(m.template_cuota_id) : null,
          comprobanteArcaId: m.comprobante_arca_id ? String(m.comprobante_arca_id) : null,
          otroVinculo: !!(m.sueldo_pago_id || m.comprobante_venta_id || m.anticipo_id),
          estado: String(m.estado ?? ""),
          contable: String(m.contable ?? ""),
          enDolares: !!t.enDolares,
        })
      }
      if (!data || data.length < 1000) break
    }
  }
  return { movimientos, tablasQueFallaron }
}

/** A qué quedó atado un movimiento: la cuota (o el grupo de pago) resuelta contra todas las cuotas leídas. */
export interface DestinoMovimiento { responsable: string; agrupadora: string; concepto: string; cuotaIds: string[] }

/** Pura. El índice de destinos: id de cuota o de grupo → a qué responsable / agrupadora / template pertenece. */
export function indiceDeDestinos(todas: CuotaTemplate[]): Map<string, DestinoMovimiento> {
  const resp1 = (r: string) => (r || "").split("/")[0].trim().toUpperCase()
  const m = new Map<string, DestinoMovimiento>()
  for (const c of todas) {
    const d = { responsable: resp1(c.responsable), agrupadora: (c.agrupadoraTemplate ?? "").trim(), concepto: c.concepto, cuotaIds: [c.id] }
    m.set(c.id, d)
    if (c.grupoPagoId) {
      const g = m.get(c.grupoPagoId)
      if (!g) m.set(c.grupoPagoId, { ...d, cuotaIds: [c.id] })
      else {
        g.cuotaIds.push(c.id)
        if (g.responsable !== d.responsable) g.responsable = "varios"
        if (g.agrupadora !== d.agrupadora) g.agrupadora = "varias"
        if (g.concepto !== d.concepto) g.concepto = `pago agrupado (${g.cuotaIds.length} cuotas)`
      }
    }
  }
  return m
}

/** 🔎 Pura. Los movimientos SIN categoría y SIN ningún vínculo (cuota, factura, sueldo, venta, anticipo) de un titular. */
export function sinCategoriaNiVinculo(movs: MovimientoExtractoH[], titular: string): MovimientoExtractoH[] {
  return movs.filter(m => m.titular === titular && !m.categ.trim() && !m.templateCuotaId && !m.comprobanteArcaId && !m.otroVinculo
    && (m.debitos !== 0 || m.creditos !== 0))
}


/**
 * 🔍 A-FEAT-1579: el texto de la factura vinculada a cada movimiento («factura de MSA: BOLIG ALBERTO NICOLAS FC 39 · $ 95.000»), que en una
 * cuota pagada por otra empresa dice de quién era la factura. Busca en las tres empresas. Si la lectura falla, las cuotas salen como estaban.
 */
export async function conFacturas(cliente: ClienteMinimo, cuotas: CuotaTemplate[]): Promise<CuotaTemplate[]> {
  const ids = [...new Set(cuotas.flatMap(c => c.banco?.facturaIds ?? []))]
  if (!ids.length) return cuotas
  const texto = new Map<string, string>()
  for (const s of ["msa", "pam", "ma"]) {
    for (let i = 0; i < ids.length; i += TANDA) {
      const { data, error } = await cliente.schema(s).from("comprobantes_arca")
        .select("id, denominacion_emisor, tipo_comprobante_desc, punto_venta, numero_desde, imp_total").in("id", ids.slice(i, i + TANDA))
      if (error) continue
      for (const f of (data ?? []) as Array<Record<string, unknown>>) texto.set(String(f.id),
        `factura de ${s.toUpperCase()}: ${f.denominacion_emisor ?? ""} ${f.tipo_comprobante_desc ?? ""} ${f.punto_venta ?? ""}-${f.numero_desde ?? ""} · $ ${fmt(Number(f.imp_total) || 0)}`)
    }
  }
  return cuotas.map(c => c.banco?.facturaIds?.length ? { ...c, banco: { ...c.banco, factura: c.banco.facturaIds.map(id => texto.get(id) ?? "").filter(Boolean).join(" | ") } } : c)
}
