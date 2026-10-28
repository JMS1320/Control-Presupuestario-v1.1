/**
 * 💵 **Las condiciones comerciales de una venta de hacienda** — A-FEAT-1403.
 *
 * Nota 🌙 de JMS 2026-10-27: *«¿la venta entra al cash flow y presupuesto desde acá? Le di cantidad y
 * monto total pero no se pudo desde la edición. Le falta completarse: plazo. Editar debe ofrecer toda la
 * paleta de datos necesarios para el cálculo. Pongo montos netos yo pero mostraría el IVA también»*.
 *
 * - **Neto**: el escrito a mano manda; vacío = el calculado (kg × precio − CZ). Regla «default del dato
 *   real, siempre editable»: una venta por cabeza o por un total no tiene kilos × precio, y sin esto no
 *   había dónde poner el monto (las 2 ventas de toros del 27/10 quedaron en $0).
 * - **IVA**: 10,5 % por defecto (hacienda), editable; se muestra el IVA y el total con IVA.
 * - **Cobro**: la fecha escrita manda; si no, fecha de venta + plazo en días; si no hay ninguno, vacío
 *   (el Cash Flow cae a la fecha de venta, como hasta hoy).
 */
export const IVA_HACIENDA = 10.5

const num = (v: string | null | undefined): number | null => {
  const s = String(v ?? "").trim()
  if (!s) return null
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

/** 'YYYY-MM-DD' + días, sin pasar por la zona horaria (fecha de calendario). */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number)
  const t = Date.UTC(y, m - 1, d) + dias * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

export interface EntradaCondiciones {
  netoCalculado: number | null
  netoEscrito: string
  alicuotaIva: string
  fechaVenta: string
  plazoDias: string
  fechaCobroEscrita: string
}

export function condicionesVenta(e: EntradaCondiciones) {
  const escrito = num(e.netoEscrito)
  const neto = escrito ?? e.netoCalculado
  const netoDeDonde: "escrito" | "calculado" | null = escrito != null ? "escrito" : e.netoCalculado != null ? "calculado" : null
  // la alícuota y los días nunca tienen miles: «10.5» y «10,5» son lo mismo (no 105)
  const pct = parseFloat(String(e.alicuotaIva ?? "").trim().replace(",", "."))
  const alicuota = Number.isFinite(pct) ? pct : IVA_HACIENDA
  const iva = neto != null ? Math.round(neto * alicuota) / 100 : null
  const total = neto != null && iva != null ? Math.round((neto + iva) * 100) / 100 : null
  const d = parseInt(String(e.plazoDias ?? "").trim(), 10)
  const dias = Number.isFinite(d) ? d : null
  const fechaCobro = e.fechaCobroEscrita?.trim()
    ? e.fechaCobroEscrita.trim()
    : dias != null && e.fechaVenta ? sumarDias(e.fechaVenta, Math.round(dias)) : null
  const plazoTexto = dias != null ? `${Math.round(dias)} días` : null
  return { neto, netoDeDonde, alicuota, iva, total, fechaCobro, plazoTexto }
}

/**
 * 💵 **Lo que ENTRA al banco por una venta de hacienda todavía sin liquidación** — A-FEAT-1403.
 *
 * Regla de JMS 2026-10-28: *«una venta de hacienda se cobra como el total del neto (gravado, no gravado o
 * exento: lo que suma menos lo que resta, comisiones, etc.) más el IVA, menos las retenciones de la
 * liquidación propia o hechas fuera»*.
 * - Con la liquidación cargada, eso ya lo hace `cobroEsperado()` (total − retenciones − lo imputado aparte).
 * - SIN liquidación, el Cash Flow cobraba sólo el neto. Ahora: neto pendiente × (1 + IVA). Las retenciones
 *   todavía no se conocen (llegan con la liquidación): se dice, no se inventan.
 * ⚠️ Lo ya facturado se descuenta EN NETO (el vínculo con la liquidación asigna el neto de la venta), por
 *   eso el IVA se aplica después de restar, sobre el neto pendiente.
 */
export function cobroVentaSinLiquidacion(netoPendiente: number, alicuota: number | null | undefined) {
  const a = alicuota != null && Number.isFinite(Number(alicuota)) ? Number(alicuota) : IVA_HACIENDA
  const iva = Math.round(netoPendiente * a) / 100
  return { neto: netoPendiente, alicuota: a, iva, cobro: Math.round((netoPendiente + iva) * 100) / 100 }
}
