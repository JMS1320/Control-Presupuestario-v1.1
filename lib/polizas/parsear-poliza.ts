/**
 * 🛡️ Lector de PÓLIZAS de seguro — A-FEAT-1309.
 *
 * Lee el texto en renglones de un PDF de la aseguradora (ver `renglones-pdf.ts`) y devuelve lo que
 * dice el papel. Hoy está hecho sobre **Federación Patronal**, que es la que usa el grupo; si mañana
 * entra otra, el lector **no rechaza**: devuelve lo que pudo leer y avisa qué faltó (§ 📄 de `CLAUDE.md`).
 *
 * ## Las cuatro partes que puede traer un PDF (y casi nunca trae todas)
 * | Parte | Qué aporta |
 * |---|---|
 * | **Factura original** (1 página) | el comprobante: prima, recargos, IVA, percepciones, tasas, total y las cuotas del endoso |
 * | **Frente de póliza** | vigencia, endoso, póliza anterior, período facturado, liquidación del premio, cargo financiero |
 * | **Pago consolidado** | TODAS las cuotas vivas de la póliza, con su saldo (0 = cobrada) |
 * | **Certificados / nómina** | los bienes asegurados: vehículos con su prima, o personas con su alta o baja |
 *
 * 📌 **No toca la base ni los templates.** Sólo lee; qué se hace con eso lo decide `controlar-poliza.ts`
 * y, al final, el usuario.
 */

export interface CuotaPoliza {
  nro: number
  de: number
  vencimiento: string // ISO
  importe: number
  /** Sólo en el pago consolidado: lo que falta cobrar (0 = cobrada). */
  saldo?: number | null
}

export interface ConceptoLiquidacion {
  concepto: string
  importe: number
  /** «SUBTOTAL …» o «SUB-TOTAL»: no se suma, se controla. */
  esSubtotal: boolean
}

export interface VehiculoAsegurado {
  certificado: number
  descripcion: string | null
  tipo: string | null
  anio: number | null
  /** `null` si el papel trae el comodín `AAA111` (maquinaria sin patente). */
  patente: string | null
  /** El premio del certificado: es la base del reparto. */
  prima: number | null
}

export interface PersonaAsegurada {
  certificado: number | null
  documento: string
  nombre: string
  movimiento: "alta" | "baja" | "activa"
  sumaAsegurada: number | null
}

export interface PolizaLeida {
  aseguradora: string | null
  poliza: string | null
  /** «AUTOMOTORES», «VIDA COLECTIVO», «ACCIDENTES PERSONALES»… */
  seccion: string | null
  producto: string | null
  endoso: number | null
  polizaAnterior: string | null
  fechaEmision: string | null
  vigenciaDesde: string | null
  vigenciaHasta: string | null
  periodoDesde: string | null
  periodoHasta: string | null

  /** De la FACTURA ORIGINAL: la liquidación renglón por renglón. */
  conceptos: ConceptoLiquidacion[]
  /** Del FRENTE: la liquidación resumida. */
  frente: {
    prima: number | null
    iva: number | null
    sellado: number | null
    otrosImpuestos: number | null
    premioEndoso: number | null
    total: number | null
    tea: number | null
    cargoFinanciero: number | null
  } | null
  /** Total del endoso: el de la factura si está, si no el del frente. */
  total: number | null
  /** Cuotas en que se paga ESTE endoso. */
  cuotasEndoso: CuotaPoliza[]
  consolidado: {
    fecha: string | null
    ultimoEndoso: number | null
    periodoDesde: string | null
    periodoHasta: string | null
    cuotas: CuotaPoliza[]
  } | null
  vehiculos: VehiculoAsegurado[]
  personas: PersonaAsegurada[]
  /** Total negativo: el endoso es una nota de crédito (una baja, una devolución). */
  esNotaCredito: boolean
  partes: { factura: boolean; frente: boolean; consolidado: boolean; certificados: boolean; nomina: boolean }
  avisos: string[]
}

// ─── utilidades ──────────────────────────────────────────────────────────────

/** `556,094.00` · `-16,362.00` · `39564` → número. El emisor usa coma de miles y punto decimal. */
export function numeroPoliza(s: string | null | undefined): number | null {
  if (s == null) return null
  const t = String(s).replace(/\s|\$/g, "")
  if (!/^-?[\d,]+(\.\d+)?$/.test(t)) return null
  const n = parseFloat(t.replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

/** `29-07-2026` o `01/08/2026` → `2026-07-29`. */
export function fechaPoliza(s: string | null | undefined): string | null {
  const m = String(s ?? "").match(/(\d{2})[-/](\d{2})[-/](\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const RE_FECHA = /\d{2}[-/]\d{2}[-/]\d{4}/
const RE_FECHAS = /\d{2}[-/]\d{2}[-/]\d{4}/g
const RE_IMPORTE = /^-?[\d,]+\.\d{2}$/

const columnas = (renglon: string) => renglon.split(/\s{2,}/).map(c => c.trim()).filter(Boolean)
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")

/** Primer renglón (desde `desde`) que cumple; -1 si no hay. */
function buscar(renglones: string[], re: RegExp, desde = 0, hasta = renglones.length): number {
  for (let i = Math.max(0, desde); i < Math.min(hasta, renglones.length); i++) if (re.test(renglones[i])) return i
  return -1
}

/**
 * Primer importe en los `n` renglones siguientes a `i` que NO sea una cuota.
 * 🧨 En el frente, la columna de cuotas comparte renglón con la liquidación: `5/12  01-12-2026  $  556,094.00`
 * está justo debajo de «PRIMA». Un importe con una fecha a una o dos columnas antes es de una cuota.
 */
function importeDespues(renglones: string[], i: number, n = 3): number | null {
  for (let k = i + 1; k <= i + n && k < renglones.length; k++) {
    const cols = columnas(renglones[k])
    for (let j = 0; j < cols.length; j++) {
      if (!RE_IMPORTE.test(cols[j])) continue
      const previas = cols.slice(Math.max(0, j - 2), j)
      if (previas.some(c => RE_FECHA.test(c))) continue
      return numeroPoliza(cols[j])
    }
  }
  return null
}

/** Cuotas `1/12  01-08-2026  $  556,094.00` en cualquier parte del renglón (comparten renglón con la liquidación). */
function cuotasDeRenglones(renglones: string[]): CuotaPoliza[] {
  const out: CuotaPoliza[] = []
  const re = /(?:^|\s)(\d{1,2})\/(\d{1,2})\s+(\d{2}-\d{2}-\d{4})\s+\$\s+(-?[\d,]+\.\d{2})/g
  for (const r of renglones) {
    for (const m of r.matchAll(re)) {
      out.push({ nro: +m[1], de: +m[2], vencimiento: fechaPoliza(m[3])!, importe: numeroPoliza(m[4])! })
    }
  }
  // Un mismo endoso puede repetirse (frente y factura): se queda una por número.
  const vistas = new Set<number>()
  return out.filter(c => (vistas.has(c.nro) ? false : (vistas.add(c.nro), true)))
}

function seccionDe(r: string): { seccion: string | null; producto: string | null; poliza: string | null } {
  const cols = columnas(r)
  const iS = cols.findIndex(c => /^SECCI[ÓO]N$/i.test(c))
  const iP = cols.findIndex(c => /^PRODUCTO$/i.test(c))
  const iPol = cols.findIndex(c => /^P[ÓO]LIZA/i.test(c))
  let poliza: string | null = null
  if (iPol >= 0) {
    const m = cols[iPol].match(/(\d{5,10})/) ?? (cols[iPol + 1] ?? "").match(/^(\d{5,10})$/)
    poliza = m ? m[1] : null
  }
  const limpiar = (s: string | undefined) => (s ? s.replace(/^\d+\s*-\s*/, "").trim() || null : null)
  return {
    seccion: iS >= 0 ? limpiar(cols[iS + 1]) : null,
    producto: iP >= 0 && cols[iP + 1] && !/^P[ÓO]LIZA/i.test(cols[iP + 1]) ? cols[iP + 1] : null,
    poliza,
  }
}

// ─── las partes ──────────────────────────────────────────────────────────────

function leerFactura(r: string[], p: PolizaLeida) {
  const ini = buscar(r, /^FACTURA ORIGINAL|^NOTA DE CR[EÉ]DITO/i)
  if (ini < 0) return
  p.partes.factura = true
  const fin = (() => { const f = buscar(r, /^\f$|^FACTURA ORIGINAL|^FRENTE DE P[ÓO]LIZA/i, ini + 1); return f < 0 ? r.length : f })()
  const b = r.slice(ini, fin)

  const iSec = buscar(b, /SECCI[ÓO]N/i)
  if (iSec >= 0) {
    const s = seccionDe(b[iSec])
    p.seccion ??= s.seccion; p.producto ??= s.producto; p.poliza ??= s.poliza
  }
  // Fecha de emisión: el renglón siguiente al rótulo trae la fecha.
  const iEm = buscar(b, /Fecha de Emisi[óo]n/i)
  if (iEm >= 0 && b[iEm + 1]) p.fechaEmision ??= fechaPoliza(b[iEm + 1].match(RE_FECHA)?.[0])
  // Endoso: rótulo al final de un renglón de encabezados → el número está al final del siguiente.
  const iEnd = buscar(b, /\bEndoso$/i)
  if (iEnd >= 0 && b[iEnd + 1]) {
    const m = b[iEnd + 1].match(/\s(\d{1,4})$/)
    if (m) p.endoso ??= +m[1]
  }
  // Período facturado: las dos primeras fechas en los renglones siguientes al rótulo.
  const iPer = buscar(b, /Per[íi]odo Facturado/i)
  if (iPer >= 0) {
    const fechas: string[] = []
    for (let k = iPer + 1; k < Math.min(b.length, iPer + 5) && fechas.length < 2; k++) {
      if (/^(Asegurado nro|IVA|CUIT)/i.test(b[k]) && fechas.length === 0 && !RE_FECHA.test(b[k])) continue
      for (const f of b[k].match(RE_FECHAS) ?? []) fechas.push(f)
    }
    if (fechas[0]) p.periodoDesde ??= fechaPoliza(fechas[0])
    if (fechas[1]) p.periodoHasta ??= fechaPoliza(fechas[1])
  }
  // La liquidación: pares «RÓTULO  $  importe» que NO vienen detrás de una fecha (ésas son cuotas).
  const iLiq = buscar(b, /LIQUIDACI[ÓO]N DE PREMIO/i)
  const conceptos: ConceptoLiquidacion[] = []
  for (let k = Math.max(0, iLiq); k < b.length; k++) {
    const cols = columnas(b[k])
    for (let j = 1; j < cols.length - 1; j++) {
      if (cols[j] !== "$" || !RE_IMPORTE.test(cols[j + 1])) continue
      const rotulo = cols[j - 1]
      if (RE_FECHA.test(rotulo) || RE_IMPORTE.test(rotulo) || /^TOTALES:?$/i.test(rotulo)) continue
      // «NRO.  VENCIMIENTO  IMPORTE  PRIMA» → el rótulo es la última columna antes del $.
      conceptos.push({
        concepto: rotulo.replace(/:$/, ""),
        importe: numeroPoliza(cols[j + 1])!,
        esSubtotal: /^SUB[- ]?TOTAL/i.test(rotulo),
      })
    }
  }
  const iTotal = conceptos.findIndex(c => /MONTO TOTAL/i.test(c.concepto))
  if (iTotal >= 0) {
    p.total = conceptos[iTotal].importe
    conceptos.splice(iTotal, 1)
  } else if (conceptos.length) {
    p.avisos.push("La factura no trae «MONTO TOTAL DEL PREMIO»: el total sale del frente o de las cuotas.")
  }
  p.conceptos = conceptos
  const cuotas = cuotasDeRenglones(b)
  if (cuotas.length) p.cuotasEndoso = cuotas
}

function leerFrente(r: string[], p: PolizaLeida) {
  const ini = buscar(r, /^FRENTE DE P[ÓO]LIZA\s{2,}P[óo]liza impresa/i)
  if (ini < 0) return
  p.partes.frente = true
  const finPag = buscar(r, /^\f$/, ini + 1)
  const b = r.slice(ini, finPag < 0 ? r.length : finPag)

  const iSec = buscar(b, /^SECCI[ÓO]N/i)
  if (iSec >= 0) {
    const s = seccionDe(b[iSec])
    p.seccion ??= s.seccion; p.producto ??= s.producto; p.poliza ??= s.poliza
  }
  const vig = b.join("\n").match(/Desde\s+[\d:]+\s+Hs\.\s+del\s+(\d{2}-\d{2}-\d{4})\s+Hasta\s+[\d:]+\s+Hs\.\s+del\s+(\d{2}-\d{2}-\d{4})/)
  if (vig) { p.vigenciaDesde = fechaPoliza(vig[1]); p.vigenciaHasta = fechaPoliza(vig[2]) }

  const iEnd = buscar(b, /^Endoso\s{2,}Lugar de emisi/i)
  if (iEnd >= 0) {
    const m = (b[iEnd + 1] ?? "").match(/^(\d{1,4})\s/)
    if (m) p.endoso ??= +m[1]
  }
  const iAnt = buscar(b, /^P[óo]liza anterior/i)
  if (iAnt >= 0) {
    for (let k = iAnt + 1; k < Math.min(b.length, iAnt + 4); k++) {
      const m = b[k].match(/^(?:(\d{4,10})\s{2,})?(\d{2}-\d{2}-\d{4})$/)
      if (m) {
        if (m[1]) p.polizaAnterior ??= m[1]
        p.fechaEmision ??= fechaPoliza(m[2])
        break
      }
    }
  }
  const iPer = buscar(b, /PER[ÍI]ODO FACTURADO/i)
  if (iPer >= 0) {
    for (let k = iPer + 1; k < Math.min(b.length, iPer + 5); k++) {
      const m = b[k].match(/^(\d{2}-\d{2}-\d{4})\s{2,}(\d{2}-\d{2}-\d{4})$/)
      if (m) { p.periodoDesde ??= fechaPoliza(m[1]); p.periodoHasta ??= fechaPoliza(m[2]); break }
    }
  }
  const iPrima = buscar(b, /(^|\s)PRIMA$/)
  const iImp = buscar(b, /I\.V\.A\.\s{2,}SELLADO/)
  let iva: number | null = null, sellado: number | null = null, otros: number | null = null
  if (iImp >= 0 && b[iImp + 1]) {
    const imps = columnas(b[iImp + 1]).filter(c => RE_IMPORTE.test(c)).map(c => numeroPoliza(c)!)
    if (imps.length >= 3) [iva, sellado, otros] = imps.slice(-3)
  }
  const iPremio = buscar(b, /^PREMIO DEL ENDOSO/i)
  const tot = b.join("\n").match(/TOTAL:\s+\$\s+(-?[\d,]+\.\d{2})/)
  const fin = b.join("\n").match(/(-?\d+\.\d+)%\s+\$\s+(-?[\d,]+\.\d{2})/)
  p.frente = {
    prima: iPrima >= 0 ? importeDespues(b, iPrima, 3) : null,
    iva, sellado, otrosImpuestos: otros,
    premioEndoso: iPremio >= 0 ? importeDespues(b, iPremio, 2) : null,
    total: tot ? numeroPoliza(tot[1]) : null,
    tea: fin ? parseFloat(fin[1]) : null,
    cargoFinanciero: fin ? numeroPoliza(fin[2]) : null,
  }
  p.total ??= p.frente.total
  if (!p.cuotasEndoso.length) p.cuotasEndoso = cuotasDeRenglones(b)
}

function leerConsolidado(r: string[], p: PolizaLeida) {
  const ini = buscar(r, /^PAGO CONSOLIDADO/i)
  if (ini < 0) return
  p.partes.consolidado = true
  const finPag = buscar(r, /^\f$/, ini + 1)
  const b = r.slice(ini, finPag < 0 ? r.length : finPag)
  const texto = b.join("\n")
  const iSec = buscar(b, /^SECCI[ÓO]N/i)
  if (iSec >= 0) {
    const s = seccionDe(b[iSec])
    p.seccion ??= s.seccion; p.poliza ??= s.poliza
  }
  const per = texto.match(/Per[íi]odo facturado\s+(\d{2}-\d{2}-\d{4})\s+al\s+(\d{2}-\d{2}-\d{4})/i)
  const ult = texto.match(/[úu]ltimo endoso facturado:\s*(\d+)/i)
  const riesgo = texto.match(/Riesgo:\s*(.+?)\s*\(/)
  if (riesgo) p.producto ??= riesgo[1].trim()
  const cuotas: CuotaPoliza[] = []
  for (const m of texto.matchAll(/(\d{1,2})\/(\d{1,2})\s+Vencimiento\s+(\d{2}\/\d{2}\/\d{4})\.?\s+PESOS\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})/g)) {
    cuotas.push({ nro: +m[1], de: +m[2], vencimiento: fechaPoliza(m[3])!, importe: numeroPoliza(m[4])!, saldo: numeroPoliza(m[5]) })
  }
  p.consolidado = {
    fecha: fechaPoliza(b[0]),
    ultimoEndoso: ult ? +ult[1] : null,
    periodoDesde: per ? fechaPoliza(per[1]) : null,
    periodoHasta: per ? fechaPoliza(per[2]) : null,
    cuotas,
  }
  if (!cuotas.length) p.avisos.push("El pago consolidado no trajo cuotas legibles.")
}

function leerVehiculos(r: string[], p: PolizaLeida) {
  const porCert = new Map<number, VehiculoAsegurado>()
  const nuevo = (c: number): VehiculoAsegurado => {
    if (!porCert.has(c)) porCert.set(c, { certificado: c, descripcion: null, tipo: null, anio: null, patente: null, prima: null })
    return porCert.get(c)!
  }
  // 1) Las tarjetas «Póliza  35881289 / 10»: modelo, tipo, año, patente.
  for (let i = 0; i < r.length; i++) {
    const m = r[i].match(/^P[óo]liza\s+\d{5,10}\s*\/\s*(\d+)\b/)
    if (!m) continue
    const v = nuevo(+m[1])
    for (let k = i + 1; k < Math.min(r.length, i + 16); k++) {
      const c = columnas(r[k])
      if (c[0] === "Modelo" && c[1] && !/^Vigencia/i.test(c[1])) v.descripcion ??= c[1]
      if (c[0] === "T. Vehículo" && c[1] && !RE_FECHA.test(c[1])) v.tipo ??= c[1]
      if (c[0] === "Año" && /^\d{4}$/.test(c[1] ?? "")) v.anio ??= +c[1]
      if (c[0] === "Patente" && c[1]) v.patente ??= /^AAA111$/i.test(c[1]) ? null : c[1].toUpperCase()
    }
  }
  // 2) «CERTIFICADO: n» … «PREMIO: x»: el premio es del último certificado nombrado antes.
  let ultimo: number | null = null
  for (const renglon of r) {
    const c = renglon.match(/CERTIFICADO:\s+(\d+)/)
    if (c) ultimo = +c[1]
    const pr = renglon.match(/PREMIO:\s+(-?[\d,]+\.\d{2})/)
    if (pr && ultimo != null) {
      const v = nuevo(ultimo)
      if (v.prima == null) v.prima = numeroPoliza(pr[1])
    }
  }
  p.vehiculos = [...porCert.values()].sort((a, b) => a.certificado - b.certificado)
  p.partes.certificados = p.vehiculos.length > 0
}

function leerNomina(r: string[], p: PolizaLeida) {
  const vistas = new Set<string>()
  let modo: PersonaAsegurada["movimiento"] | null = null
  const re = /^(\d+)\s{2,}(?:CUIL|CUIT|DNI|LE|LC)\s{2,}(\d{6,11})\s{2,}(.+?)\s{2,}(\d{2}[-/]\d{2}[-/]\d{4})(?:\s{2,}([\d,]+\.\d{2}))?/
  for (const renglon of r) {
    if (/^ALTA PERSONAL/i.test(renglon)) { modo = "alta"; continue }
    if (/^BAJA PERSONAL/i.test(renglon)) { modo = "baja"; continue }
    if (/^NOMINA ACTIVA/i.test(sinAcentos(renglon))) { modo = "activa"; continue }
    if (!modo) continue
    if (/^Cert\./i.test(renglon)) continue
    const m = renglon.match(re)
    if (!m) { modo = null; continue }
    const clave = `${modo}|${m[2]}`
    if (vistas.has(clave)) continue
    vistas.add(clave)
    p.personas.push({
      certificado: +m[1], documento: m[2], nombre: m[3].trim(), movimiento: modo,
      sumaAsegurada: m[5] ? numeroPoliza(m[5]) : null,
    })
  }
  p.partes.nomina = p.personas.length > 0
}

// ─── entrada ─────────────────────────────────────────────────────────────────

export function parsearPoliza(texto: string): PolizaLeida {
  const renglones = texto.split(/\r?\n/).map(s => s.replace(/\s+$/, ""))
  const p: PolizaLeida = {
    aseguradora: null, poliza: null, seccion: null, producto: null, endoso: null, polizaAnterior: null,
    fechaEmision: null, vigenciaDesde: null, vigenciaHasta: null, periodoDesde: null, periodoHasta: null,
    conceptos: [], frente: null, total: null, cuotasEndoso: [], consolidado: null,
    vehiculos: [], personas: [], esNotaCredito: false,
    partes: { factura: false, frente: false, consolidado: false, certificados: false, nomina: false },
    avisos: [],
  }
  if (/FEDERACI[ÓO]N PATRONAL/i.test(texto)) p.aseguradora = "FEDERACION PATRONAL"

  leerFactura(renglones, p)
  leerFrente(renglones, p)
  leerConsolidado(renglones, p)
  leerVehiculos(renglones, p)
  leerNomina(renglones, p)

  if (p.total == null && p.cuotasEndoso.length) {
    p.total = Math.round(p.cuotasEndoso.reduce((s, c) => s + c.importe, 0) * 100) / 100
    p.avisos.push("El total se calculó sumando las cuotas del endoso: el papel no lo trae legible.")
  }
  p.esNotaCredito = (p.total ?? 0) < 0

  if (!p.aseguradora) p.avisos.push("No se reconoce la aseguradora: el lector está hecho sobre Federación Patronal. Revisá todo lo leído.")
  if (!p.poliza) p.avisos.push("No se encontró el número de póliza.")
  if (p.endoso == null) p.avisos.push("No se encontró el número de endoso.")
  if (p.total == null) p.avisos.push("No se encontró el total del endoso.")
  if (!p.partes.factura && !p.partes.frente && !p.partes.consolidado) {
    p.avisos.push("El PDF no tiene ninguna de las partes conocidas (factura, frente de póliza, pago consolidado).")
  }
  return p
}
