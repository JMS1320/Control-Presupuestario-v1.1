/**
 * 💳 Lector del resumen PDF de la tarjeta VISA del Galicia (MSA, PAM y MA).
 *
 * Vivía adentro de `app/api/import-pdf-tarjeta/route.ts`; se sacó acá (sin cambiar una línea de la
 * lógica) para que el importador de la app y los scripts de estudio lean el PDF con el MISMO código
 * (§ ♻️ Centralizar, no duplicar). 2026-10-25, para la carga de las tarjetas de MA y PAM.
 */
// -----------------------------------------------------------------------------
// Helpers de parseo
// -----------------------------------------------------------------------------

export function parseNumAR(value: string | null | undefined): number {
  if (!value) return 0
  const s = value.trim().replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".")
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

const MESES_ES: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12",
}

export function parseDateGalicia(value: string): string | null {
  if (!value) return null
  const s = value.trim()
  // Formato "DD-MMM-YY" (ej "30-Ene-25")
  const m1 = s.match(/^(\d{1,2})-([A-Za-záéíóú]{3})-(\d{2,4})$/)
  if (m1) {
    let [, d, mo, y] = m1
    if (y.length === 2) y = "20" + y
    const mes = MESES_ES[mo.toLowerCase().slice(0, 3)]
    if (mes) return `${y}-${mes}-${d.padStart(2, "0")}`
  }
  // Formato "DD-MM-YY" (ej "02-01-26")
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (m2) {
    let [, d, mo, y] = m2
    if (y.length === 2) y = "20" + y
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  return null
}

// -----------------------------------------------------------------------------
// Parseo de líneas de movimiento
// -----------------------------------------------------------------------------

export interface MovimientoParsed {
  fecha: string                  // YYYY-MM-DD
  referencia: string | null
  descripcion: string
  cuota: string | null
  comprobante: string | null
  pesos: number                  // signo: positivo consumo, negativo pago/reverso
  dolares: number
}

export const NUM_AR = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`

export function parsearLineaMovimiento(raw: string): MovimientoParsed | null {
  const linea = raw.replace(/\s+/g, " ").trim()

  // Fecha al inicio: DD-MM-YY
  const fechaMatch = linea.match(/^(\d{2}-\d{2}-\d{2})\s+/)
  if (!fechaMatch) return null
  const fechaIso = parseDateGalicia(fechaMatch[1])
  if (!fechaIso) return null
  let resto = linea.substring(fechaMatch[0].length).trim()

  // Referencia opcional: 1 char en {K, Q, U, F, T, *}
  let referencia: string | null = null
  const refMatch = resto.match(/^([KQUFT\*])\s+/)
  if (refMatch) {
    referencia = refMatch[1]
    resto = resto.substring(refMatch[0].length).trim()
  }

  // Montos al final: 1 o 2 números formato AR (pesos y/o dólares)
  // Caso A: dos montos al final
  const dosMontosRegex = new RegExp(`(${NUM_AR})\\s+(${NUM_AR})\\s*$`)
  const unMontoRegex = new RegExp(`(${NUM_AR})\\s*$`)
  let pesos = 0
  let dolares = 0
  // Líneas de impuestos/percepciones (IVA, percepción, RG, IIBB, Sellos) con %: traen
  // "base cargo" (dos números en PESOS). El cargo es el ÚLTIMO; el primero es base informativa.
  // NO son consumos en USD → forzar parseo de un solo monto (pesos) para no inflar dólares.
  // 🐛 A-BUG-1368 — los PUNITORIOS traen el mismo par «base cargo» en pesos, pero SIN «%»
  // («PUNIT. PAG.MIN.ANTERIOR $ 18.678,58 338,84»): se leían como $18.678,58 + USD 338,84 y el
  // resumen de PAM de dic-25 no cerraba el control.
  const esTasaPesos = (/%/.test(resto) && /(IVA|PERCEP|\bRG\b|IIBB|SELLOS)/i.test(resto)) || /^PUNIT/i.test(resto)
  const m2 = esTasaPesos ? null : resto.match(dosMontosRegex)
  if (m2) {
    pesos = parseNumAR(m2[1])
    dolares = parseNumAR(m2[2])
    resto = resto.substring(0, resto.length - m2[0].length).trim()
  } else {
    const m1 = resto.match(unMontoRegex)
    if (!m1) return null
    const monto = parseNumAR(m1[1])
    // Heurística: si menciona USD o U$S o tiene "DÓLARES" cerca, es dólares
    // Si NO, asumimos pesos
    if (!esTasaPesos && /USD|U\$S/i.test(resto)) {
      dolares = monto
    } else {
      pesos = monto
    }
    resto = resto.substring(0, resto.length - m1[0].length).trim()
  }

  // Comprobante: último token al final con dígitos (puede empezar con cero, ej 000001)
  let comprobante: string | null = null
  const compMatch = resto.match(/(\b[A-Z]?\d{4,}\b)\s*$/)
  if (compMatch) {
    comprobante = compMatch[1]
    resto = resto.substring(0, resto.length - compMatch[0].length).trim()
  }

  // Cuota opcional: NN/NN
  let cuota: string | null = null
  const cuotaMatch = resto.match(/(\d{1,2}\/\d{1,2})\s*$/)
  if (cuotaMatch) {
    cuota = cuotaMatch[1]
    resto = resto.substring(0, resto.length - cuotaMatch[0].length).trim()
  }

  const descripcion = resto.trim()
  if (!descripcion) return null

  return { fecha: fechaIso, referencia, descripcion, cuota, comprobante, pesos, dolares }
}

// -----------------------------------------------------------------------------
// Parseo del resumen completo
// -----------------------------------------------------------------------------

export interface TarjetaAdicional {
  tarjeta_nro: string | null
  titular: string | null
}

export interface ResumenParsed {
  nro_resumen: string | null
  fecha_cierre: string | null
  fecha_vencimiento: string | null
  saldo_anterior_pesos: number
  saldo_anterior_usd: number
  total_a_pagar_pesos: number
  total_a_pagar_usd: number
  movimientos: Array<MovimientoParsed & { tarjeta: TarjetaAdicional }>
}

export function parsearResumen(texto: string): ResumenParsed {
  const out: ResumenParsed = {
    nro_resumen: null,
    fecha_cierre: null,
    fecha_vencimiento: null,
    saldo_anterior_pesos: 0,
    saldo_anterior_usd: 0,
    total_a_pagar_pesos: 0,
    total_a_pagar_usd: 0,
    movimientos: [],
  }

  // Nro de resumen
  const nroMatch = texto.match(/Resumen\s*N[°º]\s*([A-Z0-9]+)/i)
  if (nroMatch) out.nro_resumen = nroMatch[1]

  // SALDO ANTERIOR
  const saldoMatch = texto.match(new RegExp(`SALDO\\s+ANTERIOR\\s+(${NUM_AR})(?:\\s+(${NUM_AR}))?`, "i"))
  if (saldoMatch) {
    out.saldo_anterior_pesos = parseNumAR(saldoMatch[1])
    if (saldoMatch[2]) out.saldo_anterior_usd = parseNumAR(saldoMatch[2])
  }

  // TOTAL A PAGAR
  const totalMatch = texto.match(new RegExp(`TOTAL\\s+A\\s+PAGAR\\s+(${NUM_AR})(?:\\s+(${NUM_AR}))?`, "i"))
  if (totalMatch) {
    out.total_a_pagar_pesos = parseNumAR(totalMatch[1])
    if (totalMatch[2]) out.total_a_pagar_usd = parseNumAR(totalMatch[2])
  }

  // Fechas del ciclo — buscar todas las DD-MMM-YY en orden
  const fechasGalicia = Array.from(texto.matchAll(/\b(\d{1,2}-[A-ZÁÉÍÓÚ][a-záéíóú]{2}-\d{2})\b/g)).map((m) => m[1])
  // Las 6 fechas que aparecen son: cierre_anterior, venc_anterior, cierre_actual, venc_actual, prox_cierre, prox_venc
  if (fechasGalicia.length >= 4) {
    out.fecha_cierre = parseDateGalicia(fechasGalicia[2])
    out.fecha_vencimiento = parseDateGalicia(fechasGalicia[3])
  }

  // Movimientos: dividir por líneas y parsear cada una
  const lineas = texto.split(/\r?\n/)
  /**
   * 🐛 A-BUG-1369 — el renglón «TARJETA 9753 Total Consumos de PLACIDO AL MARTINEZ 124.766,16» CIERRA el
   * bloque de esa tarjeta: los consumos de PLÁCIDO están ARRIBA del subtotal (Movistar + Chubb = 124.766,16
   * en el resumen PAM dic-25). Antes el titular se aplicaba a los renglones de ABAJO, así que cada bloque
   * quedaba con el titular del siguiente y el primero sin titular. Los pagos (antes de «DETALLE DEL
   * CONSUMO») y los cargos del banco (después del último subtotal) no son de ninguna tarjeta.
   */
  let inicioBloque: number | null = null

  for (const lineaRaw of lineas) {
    const linea = lineaRaw.trim()
    if (!linea) continue

    // Subtotal de una tarjeta: "TARJETA XXXX Total Consumos de NOMBRE"
    const tarjMatch = linea.match(/^TARJETA\s+(\d+)\s+Total\s+Consumos\s+de\s+(.+?)\s+[\d\.,\-]/i)
    if (tarjMatch) {
      const tarjeta: TarjetaAdicional = { tarjeta_nro: tarjMatch[1], titular: tarjMatch[2].trim() }
      for (let i = inicioBloque ?? 0; i < out.movimientos.length; i++) {
        out.movimientos[i].tarjeta = { ...tarjeta }
      }
      inicioBloque = out.movimientos.length
      continue
    }

    if (/^DETALLE\s+DEL\s+CONSUMO/i.test(linea)) {
      if (inicioBloque === null) inicioBloque = out.movimientos.length
      continue
    }

    // Saltarse líneas de headers/secciones conocidas
    if (/^(CONSOLIDADO|TOTAL\s+A\s+PAGAR|TOTAL\s+EN\s+PESOS|TOTAL\s+EN\s+D[ÓO]LARES|FECHA\s+REFERENCIA|TASAS|L[ÍI]MITES|PAGO\s+MINIMO|SALDO\s+ANTERIOR)/i.test(linea)) {
      continue
    }

    const mov = parsearLineaMovimiento(linea)
    if (mov) {
      out.movimientos.push({ ...mov, tarjeta: { tarjeta_nro: null, titular: null } })
    }
  }

  return out
}

// -----------------------------------------------------------------------------
// Control de saldo
// -----------------------------------------------------------------------------

export interface ControlSaldo {
  ok: boolean
  diferencia_pesos: number
  diferencia_usd: number
  suma_pesos: number
  suma_usd: number
}

export function calcularControl(r: ResumenParsed): ControlSaldo {
  const sumaP = r.movimientos.reduce((acc, m) => acc + m.pesos, 0)
  const sumaU = r.movimientos.reduce((acc, m) => acc + m.dolares, 0)
  const calculadoP = Math.round((r.saldo_anterior_pesos + sumaP) * 100) / 100
  const calculadoU = Math.round((r.saldo_anterior_usd + sumaU) * 100) / 100
  const diffP = Math.round((r.total_a_pagar_pesos - calculadoP) * 100) / 100
  const diffU = Math.round((r.total_a_pagar_usd - calculadoU) * 100) / 100
  return {
    ok: Math.abs(diffP) < 0.5 && Math.abs(diffU) < 0.05,
    diferencia_pesos: diffP,
    diferencia_usd: diffU,
    suma_pesos: Math.round(sumaP * 100) / 100,
    suma_usd: Math.round(sumaU * 100) / 100,
  }
}

/**
 * unpdf devuelve el texto concatenado (sin saltos entre movimientos). Reinsertamos saltos
 * antes de cada fecha de movimiento (DD-MM-YY), subtotales por tarjeta y headers,
 * para que el parser por líneas funcione.
 */
export function normalizarTextoResumen(texto: string): string {
  return texto
    .replace(/\s(?=\d{2}-\d{2}-\d{2}\s)/g, "\n")
    .replace(/\s(?=TARJETA\s+\d+\s+Total\s+Consumos)/gi, "\n")
    .replace(/\s(?=DETALLE\s+DEL\s+CONSUMO|Resumen\s+N[°º]|TOTAL\s+A\s+PAGAR|TOTAL\s+EN\s+(?:PESOS|D[ÓO]LARES))/gi, "\n")
}
