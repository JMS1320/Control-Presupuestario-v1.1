/**
 * 🧮 Controles y REPARTO de una póliza leída — A-FEAT-1309.
 *
 * ## Qué frena y qué avisa (§ 🚦 de `CLAUDE.md`)
 * - 🛑 **Integridad** — la póliza **contra sí misma**: los conceptos de la factura suman el total que
 *   la misma factura imprime, las cuotas del endoso suman el total, las primas de los vehículos suman
 *   el total. Si no cierra, **el papel se contradice o el lector leyó mal**: no hay explicación de
 *   negocio posible. Eso frena.
 * - ⚠️ **Discrepancia** — la póliza **contra lo cargado en la app**: otro importe, otro número, una
 *   nota de crédito cargada como factura. Puede tener explicación; avisa y deja seguir.
 *
 * ## El reparto (usuario 2026-10-20)
 * *«Cada póliza puede cambiar el reparto, pero básicamente se dice cuál es el costo de cada una y así
 * se reparte.»* → la proporción es **la prima de cada bien** en ESA póliza. Cada bien tiene un
 * **responsable interno** (Tiguan → MA, Gol → JMS, el resto MSA); la cuota sigue siendo una sola —la
 * que se debita— y la app calcula la parte de cada uno.
 */
import type { PolizaLeida, VehiculoAsegurado, PersonaAsegurada } from "./parsear-poliza"

export interface ControlPoliza {
  que: string
  ok: boolean
  detalle: string
}

const r2 = (n: number) => Math.round(n * 100) / 100
const $ = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** El emisor redondea centavo a centavo: tolerancia de 2 centavos por renglón sumado, mínimo 2. */
const tolerancia = (renglones: number) => Math.max(0.02, 0.02 * renglones)

export function controlarPoliza(p: PolizaLeida): { integridad: ControlPoliza[]; frena: boolean } {
  const integridad: ControlPoliza[] = []

  // 1 · La factura: los conceptos suman el total, y cada subtotal es la suma de lo que tiene arriba.
  if (p.conceptos.length && p.total != null && p.partes.factura) {
    let acumulado = 0
    for (const c of p.conceptos) {
      if (c.esSubtotal) {
        const ok = Math.abs(acumulado - c.importe) <= tolerancia(1)
        if (!ok) integridad.push({ que: `Factura: ${c.concepto}`, ok, detalle: `los renglones de arriba suman ${$(r2(acumulado))} y el papel dice ${$(c.importe)}` })
      } else acumulado += c.importe
    }
    const ok = Math.abs(acumulado - p.total) <= tolerancia(p.conceptos.length)
    integridad.push({
      que: "Factura: conceptos = total",
      ok,
      detalle: ok ? `${$(p.total)}` : `los conceptos suman ${$(r2(acumulado))} y el total impreso es ${$(p.total)} (diferencia ${$(r2(acumulado - p.total))})`,
    })
  }

  // 2 · Las cuotas del endoso suman el total del endoso.
  if (p.cuotasEndoso.length && p.total != null) {
    const suma = r2(p.cuotasEndoso.reduce((s, c) => s + c.importe, 0))
    const ok = Math.abs(suma - p.total) <= tolerancia(p.cuotasEndoso.length)
    integridad.push({
      que: "Cuotas del endoso = total",
      ok,
      detalle: ok ? `${p.cuotasEndoso.length} cuota(s) · ${$(suma)}` : `las ${p.cuotasEndoso.length} cuotas suman ${$(suma)} y el total es ${$(p.total)}`,
    })
  }

  // 3 · Factura y frente dicen el mismo total.
  if (p.partes.factura && p.frente?.total != null && p.total != null && Math.abs(p.frente.total - p.total) > 0.02) {
    integridad.push({ que: "Factura = frente de póliza", ok: false, detalle: `factura ${$(p.total)} · frente ${$(p.frente.total)}` })
  }

  // 4 · Las primas de los vehículos suman el total: es lo que hace confiable el reparto.
  const conPrima = p.vehiculos.filter(v => v.prima != null)
  if (conPrima.length && p.total != null) {
    const suma = r2(conPrima.reduce((s, v) => s + (v.prima ?? 0), 0))
    const ok = Math.abs(suma - p.total) <= tolerancia(conPrima.length)
    const sinPrima = p.vehiculos.length - conPrima.length
    integridad.push({
      que: "Primas de los vehículos = total",
      ok: ok && sinPrima === 0,
      detalle: (ok ? `${conPrima.length} vehículos · ${$(suma)}` : `las primas suman ${$(suma)} y el total es ${$(p.total)}`)
        + (sinPrima ? ` · ${sinPrima} vehículo(s) sin prima leída` : ""),
    })
  }

  return { integridad, frena: integridad.some(c => !c.ok) }
}

// ─── cotejo contra lo cargado ────────────────────────────────────────────────

/** Lo mínimo de un comprobante de la app para cotejarlo con la póliza. */
export interface ComprobanteCargado {
  numero: string | number | null
  punto_venta: string | number | null
  total: number | null
  /** Tipo de comprobante tal como está en la app: 1 = FC A, 3 = NC A, etc. o un texto «NC». */
  esNotaCredito?: boolean
}

/**
 * ⚠️ Discrepancias, no errores: avisa y deja seguir. Convención de la carga a mano: **número = póliza,
 * punto de venta = endoso** (usuario, 2026-10-20).
 */
export function cotejarConComprobante(p: PolizaLeida, c: ComprobanteCargado): string[] {
  const avisos: string[] = []
  const soloDigitos = (x: unknown) => String(x ?? "").replace(/\D/g, "").replace(/^0+/, "")
  if (p.poliza && c.numero != null && soloDigitos(c.numero) !== soloDigitos(p.poliza)) {
    avisos.push(`El número cargado (${c.numero}) no es el de la póliza (${p.poliza}).`)
  }
  if (p.endoso != null && c.punto_venta != null && soloDigitos(c.punto_venta) !== soloDigitos(p.endoso) && !(p.endoso === 0 && soloDigitos(c.punto_venta) === "")) {
    avisos.push(`El punto de venta cargado (${c.punto_venta}) no es el endoso (${p.endoso}).`)
  }
  if (p.total != null && c.total != null) {
    const cargado = c.esNotaCredito ? -Math.abs(c.total) : c.total
    if (Math.abs(Math.abs(cargado) - Math.abs(p.total)) > 0.05) {
      avisos.push(`El total cargado (${$(Math.abs(c.total))}) no es el del endoso (${$(Math.abs(p.total))}).`)
    }
  }
  if (p.esNotaCredito && c.esNotaCredito === false) avisos.push("El endoso es una NOTA DE CRÉDITO (total negativo) y está cargado como factura.")
  if (!p.esNotaCredito && c.esNotaCredito === true) avisos.push("El endoso es una factura y está cargado como nota de crédito.")
  return avisos
}

// ─── responsable interno y reparto ───────────────────────────────────────────

export type Responsable = string // «MSA», «MA», «JMS»… — los mismos códigos que Distribuciones

export interface ReglaResponsable {
  /** Patente del vehículo (sin espacios) o DNI de la persona (8 dígitos; un CUIL se compara por su DNI). */
  patente?: string
  dni?: string
  /** A qué empresa corresponde CONTABLEMENTE (su código contable). */
  contable: Responsable
  /** A quién le corresponde INTERNAMENTE (código interno → Distribuciones si paga otra empresa). */
  interno: Responsable
  motivo: string
}

/**
 * El dato de arranque, dicho por el usuario el 2026-10-20. Es el **default**: en la app cada bien
 * guarda su responsable y se puede cambiar (§ 🎚️ default del dato real, siempre editable).
 * *«Vida colectivo: MSA contable e interno. Alondra: contable e interno MA. Rojas Celia: contable e
 * interno PAM. De la flota todo MSA salvo Gol JMS y Tiguan MA a nivel interno.»* (el Voyage es MSA)
 */
export const RESPONSABLES_INICIALES: ReglaResponsable[] = [
  { patente: "LMW911", contable: "MSA", interno: "MA", motivo: "Tiguan — interno de MA" },
  { patente: "LFO201", contable: "MSA", interno: "JMS", motivo: "Gol Trend — interno de JMS (seguro y automotor)" },
  { dni: "27673775", contable: "MSA", interno: "MA", motivo: "Elvio Paz — responsable interno MA" },
  { dni: "47926088", contable: "MA", interno: "MA", motivo: "Olivo Alondra Aylin — contable e interno MA" },
  { dni: "20361536", contable: "PAM", interno: "PAM", motivo: "Rojas Celia Mabel — contable e interno PAM" },
]
export const RESPONSABLE_POR_DEFECTO: Responsable = "MSA"

/** DNI de un documento: un CUIL `20-33318934-9` → `33318934`. */
export function dniDe(documento: string): string {
  const d = documento.replace(/\D/g, "")
  return d.length === 11 ? d.slice(2, 10) : d
}

export type Eje = "contable" | "interno"

export function responsableDe(bien: { patente?: string | null; documento?: string | null }, reglas = RESPONSABLES_INICIALES): { contable: Responsable; interno: Responsable; responsable: Responsable; motivo: string } {
  const pat = (bien.patente ?? "").replace(/\s/g, "").toUpperCase()
  const dni = bien.documento ? dniDe(bien.documento) : ""
  const r = reglas.find(x => (x.patente && pat && x.patente.toUpperCase() === pat) || (x.dni && dni && x.dni === dni))
  if (r) return { contable: r.contable, interno: r.interno, responsable: r.interno, motivo: r.motivo }
  return { contable: RESPONSABLE_POR_DEFECTO, interno: RESPONSABLE_POR_DEFECTO, responsable: RESPONSABLE_POR_DEFECTO, motivo: "por defecto" }
}

export interface ParteReparto {
  responsable: Responsable
  peso: number
  proporcion: number
  bienes: string[]
}
export interface RepartoPoliza {
  /** Por qué eje se repartió: contable (a qué empresa va el gasto) o interno (Distribuciones). */
  eje: Eje
  /** De dónde sale la proporción: se muestra para que se note al pisarla. */
  base: "prima de cada vehículo" | "suma asegurada de cada persona" | "partes iguales por persona"
  partes: ParteReparto[]
}

const nombreVehiculo = (v: VehiculoAsegurado) => `${v.descripcion ?? v.tipo ?? "vehículo"}${v.patente ? " " + v.patente : ""} (cert. ${v.certificado})`

/**
 * La proporción de cada responsable en esta póliza. `null` si no hay bienes para repartir (una
 * factura sola, sin certificados ni nómina): entonces todo es del que paga.
 */
export function repartoDeLaPoliza(p: PolizaLeida, reglas = RESPONSABLES_INICIALES, eje: Eje = "interno"): RepartoPoliza | null {
  const pesos = new Map<Responsable, { peso: number; bienes: string[] }>()
  const sumar = (resp: Responsable, peso: number, bien: string) => {
    const x = pesos.get(resp) ?? { peso: 0, bienes: [] }
    x.peso += peso; x.bienes.push(bien); pesos.set(resp, x)
  }
  let base: RepartoPoliza["base"]
  const vehiculos = p.vehiculos.filter(v => (v.prima ?? 0) > 0)
  if (vehiculos.length) {
    base = "prima de cada vehículo"
    for (const v of vehiculos) sumar(responsableDe({ patente: v.patente }, reglas)[eje], v.prima!, nombreVehiculo(v))
  } else {
    // 🧨 Cada endoso trae el COSTO DE LAS PERSONAS QUE MUEVE: el de alta cobra a los que entran y el de
    // baja devuelve el de los que salen. Repartir por la nómina activa mezclaba costos: la cuota 2/12 de
    // la AP 10183421 (48.996) es 15.740 de Elvio (endoso 0) + 33.256 del alta de Barreto y Vulcano
    // (endoso 1) — repartida por la nómina daba a MA un tercio, y lo de MA son exactamente 15.740.
    // Sólo el endoso que no mueve a nadie (el 0, una renovación) se reparte por la nómina activa.
    const movidas = p.personas.filter((x: PersonaAsegurada) => x.movimiento !== "activa")
    const base_ = movidas.length ? movidas : p.personas.filter((x: PersonaAsegurada) => x.movimiento === "activa")
    if (!base_.length) return null
    const conSuma = base_.every(x => (x.sumaAsegurada ?? 0) > 0)
    base = conSuma ? "suma asegurada de cada persona" : "partes iguales por persona"
    for (const x of base_) sumar(responsableDe({ documento: x.documento }, reglas)[eje], conSuma ? x.sumaAsegurada! : 1, x.nombre)
  }
  const total = [...pesos.values()].reduce((s, x) => s + x.peso, 0)
  if (total <= 0) return null
  const partes = [...pesos.entries()]
    .map(([responsable, x]) => ({ responsable, peso: r2(x.peso), proporcion: x.peso / total, bienes: x.bienes }))
    .sort((a, b) => b.proporcion - a.proporcion)
  return { eje, base, partes }
}

/**
 * Reparte un importe (una cuota, un débito) según el reparto. Redondea a centavos y el resto de
 * redondeo va a la parte más grande, así **las partes siempre suman exactamente el importe**.
 */
export function repartirImporte(importe: number, reparto: RepartoPoliza | null, quienPaga: Responsable = RESPONSABLE_POR_DEFECTO): { responsable: Responsable; importe: number }[] {
  if (!reparto || !reparto.partes.length) return [{ responsable: quienPaga, importe: r2(importe) }]
  const out = reparto.partes.map(x => ({ responsable: x.responsable, importe: r2(importe * x.proporcion) }))
  const resto = r2(importe - out.reduce((s, x) => s + x.importe, 0))
  if (resto !== 0) out[0].importe = r2(out[0].importe + resto)
  return out
}

/**
 * El reparto de CADA CUOTA de una póliza, sumando lo que aporta cada endoso. Una cuota del pago
 * consolidado es la suma de las cuotas de todos los endosos que vencen ese día, y cada endoso se
 * reparte con lo suyo (sus vehículos o las personas que mueve). Un endoso sin bienes (una nota de
 * crédito que trae sólo la factura) va al que paga.
 * Devuelve, por vencimiento, cuánto le toca a cada responsable; las partes suman la cuota exacta.
 */
export function repartoDeLasCuotas(endosos: PolizaLeida[], reglas = RESPONSABLES_INICIALES, eje: Eje = "interno"): Map<string, { responsable: Responsable; importe: number }[]> {
  const vistos = new Set<string>()
  const porVenc = new Map<string, Map<Responsable, number>>()
  for (const e of endosos) {
    const clave = `${e.poliza}|${e.endoso}`
    if (vistos.has(clave)) continue // el mismo endoso en dos PDF
    vistos.add(clave)
    const rep = repartoDeLaPoliza(e, reglas, eje)
    for (const c of e.cuotasEndoso) {
      const m = porVenc.get(c.vencimiento) ?? new Map<Responsable, number>()
      for (const x of repartirImporte(c.importe, rep)) m.set(x.responsable, r2((m.get(x.responsable) ?? 0) + x.importe))
      porVenc.set(c.vencimiento, m)
    }
  }
  const out = new Map<string, { responsable: Responsable; importe: number }[]>()
  for (const [v, m] of [...porVenc.entries()].sort()) out.set(v, [...m.entries()].map(([responsable, importe]) => ({ responsable, importe })).filter(x => x.importe !== 0).sort((a, b) => b.importe - a.importe))
  return out
}
