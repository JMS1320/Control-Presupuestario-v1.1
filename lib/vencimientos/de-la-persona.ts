/**
 * 💸 «LO QUE TE VENCE» — los vencimientos asignados a una persona, para su Principal (A-FEAT-1543).
 *
 * Pedido de JMS 2026-11-05, para MA (Mercedes Areco): *«ella sólo debería tener un principal que le diga que hoy le
 * vence autónomos por ejemplo, y ABL Libertad… deberá poder decir que pagó, default fecha de ahora, editable con
 * posibilidad de poner detalle; siempre paga desde sus cuentas, sobre todo la principal»*. Y el mismo día:
 * *«¿eso quedará conmigo hasta que confirme antes de impactar, verdad?… que le aparezca si hago hoy o otro día;
 * editar lo que pagó»*.
 *
 * ⚠️ cambió 05/11 (tarde): «Pagué» ya NO pasa la cuota a pagada. Deja una PROPUESTA (`public.propuestas_cambio`, la
 * misma de las correcciones de facturas de Ulises, A-FEAT-1400) y la cuota sólo cambia cuando JMS confirma.
 *
 * | Pregunta | Dato |
 * |---|---|
 * | ¿qué le vence a quién? | `egresos_sin_factura.avisar_a` (mails) — se asigna en Configuración → Quién recibe qué |
 * | ¿con cuánta anticipación? | la columna `alertas` del template, igual que el aviso de impuestos (`diasDeAviso`) |
 * | ¿cuándo vence? | `fecha_vencimiento` de la cuota; si falta, la estimada |
 * | ¿está sin pagar? | estado `pendiente` o `pagar` (`ESTADOS_SIN_PAGAR`) |
 * | ¿lo informó? | una propuesta en estado `propuesta` sobre esa cuota |
 * | ¿desde qué cuenta pagó? | `medio_pago` («Pagado desde», A-FEAT-1321): las cuentas de SUS empresas, la principal primero |
 *
 * ⚠️ Por qué lo asignado y no «todo lo que tiene responsable MA»: con ese criterio le aparecían ~30 cuotas vencidas
 * de 2025-26 que están pagadas y sólo falta conciliar. Avisar de más es lo mismo que no avisar.
 *
 * Pieza pura (sin base): la prueban los casos de `npm run probar`.
 */
import { diasDeAviso, ESTADOS_SIN_PAGAR } from "@/lib/impuestos/vencimientos"
import { CUENTAS_BANCO, type CuentaDePago } from "@/lib/pagos/pagado-desde"

/** Cuántos días se sigue mostrando lo pagado (confirmado) o lo devuelto, para que vea cómo quedó. */
export const DIAS_PAGADOS_A_LA_VISTA = 15

export interface CuotaDeLaPersona {
  id: string
  estado: string
  fecha_vencimiento: string | null
  fecha_estimada: string | null
  fecha_pago: string | null
  monto: number | null
  numero_cuota: number | null
  detalle: string | null
  medio_pago: string | null
  template: { nombre_referencia: string | null; responsable: string | null; alertas: string | null; categ: string | null }
}

/** Lo que la persona informó que pagó (lo que guarda `propuestas_cambio.cambios`). */
export interface PagoInformado {
  fecha_pago: string
  monto: number
  medio_pago: string
  detalle: string | null
}

/** Una propuesta sobre una cuota, como la lee esta pantalla. */
export interface PropuestaDePago {
  id: string
  registro_id: string
  estado: string // propuesta | aceptada | cancelada
  cambios: PagoInformado | null
  resolucion: string | null
  resuelta_at: string | null
  resuelta_por: string | null
}

export type Urgencia = "vencido" | "hoy" | "proximo" | "informado" | "pagado"

export interface Vencimiento {
  id: string
  nombre: string
  empresa: string
  vencimiento: string
  dias: number // negativo = vencido hace N días
  monto: number
  numero_cuota: number | null
  urgencia: Urgencia
  detalle: string
  fecha_pago: string | null
  medio_pago: string | null
  /** Lo que informó y espera confirmación (urgencia «informado»). */
  informado: (PagoInformado & { propuesta_id: string }) | null
  /** Si JMS se lo devolvió hace poco: el motivo (la cuota vuelve a mostrarse como sin pagar). */
  devuelto: string | null
}

const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000)

/** «PAM/MA/Duhau» → ["PAM", "MA", "DUHAU"]. */
export function empresasDe(responsable: string | null | undefined): string[] {
  return String(responsable ?? "").split("/").map(s => s.trim().toUpperCase()).filter(Boolean)
}

/** El texto con que se marca una propuesta devuelta por JMS (para distinguirla de una anulada por ella). */
export const PREFIJO_DEVUELTA = "devuelta: "

/**
 * Pura: lo de la persona, ordenado por urgencia — vencido, hoy, próximo (dentro de su anticipación), lo informado que
 * espera confirmación, y lo pagado en los últimos `DIAS_PAGADOS_A_LA_VISTA` días. Lo que vence más adelante no se
 * muestra: no es un aviso todavía. `hoy` es un día argentino (`hoyArgentina()`), nunca `toISOString()` (§ 🕐).
 */
export function vencimientosDeLaPersona(cuotas: CuotaDeLaPersona[], hoy: string, propuestas: PropuestaDePago[] = []): Vencimiento[] {
  const abierta = new Map<string, PropuestaDePago>()
  const devuelta = new Map<string, PropuestaDePago>()
  for (const p of propuestas) {
    if (p.estado === "propuesta") abierta.set(p.registro_id, p)
    else if (p.estado === "cancelada" && (p.resolucion ?? "").startsWith(PREFIJO_DEVUELTA) && p.resuelta_at
      && diasEntre(p.resuelta_at.slice(0, 10), hoy) <= DIAS_PAGADOS_A_LA_VISTA) {
      const ya = devuelta.get(p.registro_id)
      if (!ya || (ya.resuelta_at ?? "") < p.resuelta_at) devuelta.set(p.registro_id, p)
    }
  }
  const fuera: Vencimiento[] = []
  for (const c of cuotas) {
    const venc = (c.fecha_vencimiento ?? c.fecha_estimada ?? "").slice(0, 10)
    if (!venc) continue
    const dias = diasEntre(hoy, venc)
    const prop = abierta.get(c.id)
    let urgencia: Urgencia | null = null
    if ((ESTADOS_SIN_PAGAR as readonly string[]).includes(c.estado)) {
      if (prop?.cambios) urgencia = "informado"
      else if (dias < 0) urgencia = "vencido"
      else if (dias === 0) urgencia = "hoy"
      else if (dias <= diasDeAviso(c.template.alertas)) urgencia = "proximo"
    } else if ((c.estado === "pagado" || c.estado === "conciliado") && c.fecha_pago
      && diasEntre(c.fecha_pago.slice(0, 10), hoy) <= DIAS_PAGADOS_A_LA_VISTA) {
      urgencia = "pagado"
    }
    if (!urgencia) continue
    const dev = urgencia !== "informado" && urgencia !== "pagado" ? devuelta.get(c.id) : undefined
    fuera.push({
      id: c.id, nombre: c.template.nombre_referencia ?? c.template.categ ?? "Vencimiento",
      empresa: c.template.responsable ?? "—", vencimiento: venc, dias, monto: Number(c.monto ?? 0),
      numero_cuota: c.numero_cuota ?? null, urgencia, detalle: c.detalle ?? "",
      fecha_pago: c.fecha_pago ? c.fecha_pago.slice(0, 10) : null, medio_pago: c.medio_pago ?? null,
      informado: urgencia === "informado" && prop?.cambios ? { ...prop.cambios, propuesta_id: prop.id } : null,
      devuelto: dev ? (dev.resolucion ?? "").slice(PREFIJO_DEVUELTA.length) : null,
    })
  }
  const orden: Record<Urgencia, number> = { vencido: 0, hoy: 1, proximo: 2, informado: 3, pagado: 4 }
  return fuera.sort((a, b) => orden[a.urgencia] - orden[b.urgencia] || a.vencimiento.localeCompare(b.vencimiento))
}

/**
 * Las cuentas desde las que puede pagar: las de SUS empresas (las de los templates que tiene asignados), con la de la
 * empresa que más se repite primero — ésa es «la principal» y va por defecto.
 */
export function cuentasParaPagar(responsables: (string | null)[]): CuentaDePago[] {
  const cuenta = new Map<string, number>()
  for (const r of responsables) for (const e of empresasDe(r)) cuenta.set(e, (cuenta.get(e) ?? 0) + 1)
  const empresas = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e)
  return empresas.flatMap(e => CUENTAS_BANCO.filter(c => (c.empresa ?? "").toUpperCase() === e))
}

/** «1.234,56» → 1234.56 (es-AR). Vacío o ilegible → NaN. */
export function montoAR(texto: string): number {
  const t = String(texto ?? "").trim()
  if (!t) return NaN
  return parseFloat(t.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""))
}

/**
 * ¿Se puede informar (o confirmar) este pago? Devuelve el motivo si no, o null. La cuota tiene que seguir sin pagar, la
 * fecha no puede ser futura (todavía no pagó), el monto tiene que ser mayor a cero y la cuenta, una de las suyas.
 */
export function motivoPagoInvalido(p: { fecha: string; medio: string; estado: string; monto?: number }, permitidas: string[], hoy: string): string | null {
  if (!(ESTADOS_SIN_PAGAR as readonly string[]).includes(p.estado)) return "Esta cuota ya no está pendiente."
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha) || Number.isNaN(Date.parse(p.fecha))) return "La fecha no es válida."
  if (p.fecha > hoy) return "La fecha de pago no puede ser futura."
  if (p.monto !== undefined && !(p.monto > 0)) return "El monto tiene que ser mayor a cero."
  if (!permitidas.includes(p.medio)) return "Esa cuenta no es una de las tuyas."
  return null
}

/** La empresa de la propuesta: la de la cuenta desde la que pagó (MA Galicia → MA). La tabla sólo acepta MSA, PAM y MA. */
export function empresaDelPago(medio: string, responsable: string | null): "MSA" | "PAM" | "MA" | null {
  const validas = ["MSA", "PAM", "MA"] as const
  const deCuenta = (CUENTAS_BANCO.find(c => c.id === medio)?.empresa ?? "").toUpperCase()
  if ((validas as readonly string[]).includes(deCuenta)) return deCuenta as "MSA" | "PAM" | "MA"
  const deTemplate = empresasDe(responsable).find(e => (validas as readonly string[]).includes(e))
  return (deTemplate as "MSA" | "PAM" | "MA" | undefined) ?? null
}
