// ════════════════════════════════════════════════════════════════════════════
// Libro IVA COMPRAS en archivo de texto para ARCA (IVA Simple) — A-FEAT-1286
//
// Arma los dos archivos que importa el Libro IVA Compras de IVA Simple (diseño RG 4597,
// revisión 30/07/2025): COMPROBANTES (uno por factura) y ALÍCUOTAS (uno por cada alícuota
// de cada factura). Es texto de ANCHO FIJO: cada dato ocupa siempre las mismas posiciones.
//
// ── Lo acordado con el usuario (2026-10-16) ─────────────────────────────────────────────
// 1. SE PLASMAN LOS DATOS, NO SE TRATAN. Cada columna de la app va a su campo del archivo:
//    «Otros tributos» → Otros tributos; los campos de percepciones quedan en cero porque la
//    app no los tiene separados. Factura C = sólo el total, como está cargada.
// 2. Tipo de documento: SIEMPRE CUIT (80).
// 3. Dos versiones, para ver cuál acepta el portal:
//      A = el registro de 2023 (325 caracteres), el que ARCA aceptó al sistema viejo;
//      B = con el campo nuevo del final (Reintegro Decreto 1043/2016 / TurIVA, 15 ceros) = 340.
// 4. Toma lo IMPUTADO al mes en el subdiario (año_contable/mes_contable), igual que PDF y Excel.
//
// ── Las únicas reglas que se aplican, y son de FORMATO de ARCA, no de dato ──────────────
// · Importes en positivo, 13 enteros + 2 decimales sin coma. La app guarda las notas de crédito
//   en NEGATIVO; en el archivo el tipo de comprobante ya dice que resta, así que van en positivo.
// · Comprobantes B y C: «cantidad de alícuotas» = 0 y sin renglón en el archivo de alícuotas.
// · Moneda: se informa en la moneda ORIGINAL con su cotización (al importar, elegir «los
//   importes están expresados en la moneda original del comprobante»). La app guarda los
//   comprobantes en dólares en dólares; pasarlos a pesos acá sería tratar el dato.
// · Tipos 033/058/059/060/063 piden «CUIT emisor/corredor»: si no hay intermediario, ARCA manda
//   poner la CUIT del informante (nosotros) con IVA comisión 0. La app no guarda corredor.
// · Crédito fiscal computable = IVA del comprobante («sin prorrateo»: así lo dice el diseño).
//
// ── Lo que NO se arregla acá: se AVISA ──────────────────────────────────────────────────
// Un comprobante raro (total que no da la suma de sus partes, tipo 0, IVA sin separar por
// alícuota) se genera igual y se lista: el usuario decide (§ 🚦 un control que avisa).
// Lo único que FRENA es que el archivo no diga lo mismo que el subdiario: eso sería la app
// contradiciéndose (§ 🚦 integridad) — ver `controlarArchivo`.
// ════════════════════════════════════════════════════════════════════════════

/** Una fila de `comprobantes_arca`, con lo que el archivo necesita. */
export interface FilaCompraArca {
  id?: string
  fecha_emision: string | null
  tipo_comprobante: number | null
  punto_venta: number | null
  numero_desde: number | null
  cuit: string | null
  denominacion_emisor: string | null
  moneda?: string | null
  tipo_cambio?: number | string | null
  imp_total: number | string | null
  imp_neto_gravado?: number | string | null
  imp_neto_no_gravado?: number | string | null
  imp_op_exentas?: number | string | null
  otros_tributos?: number | string | null
  iva?: number | string | null
  neto_grav_iva_0?: number | string | null
  neto_grav_iva_2_5?: number | string | null
  neto_grav_iva_5?: number | string | null
  neto_grav_iva_10_5?: number | string | null
  neto_grav_iva_21?: number | string | null
  neto_grav_iva_27?: number | string | null
  iva_2_5?: number | string | null
  iva_5?: number | string | null
  iva_10_5?: number | string | null
  iva_21?: number | string | null
  iva_27?: number | string | null
}

export type VersionArchivo = 'A' | 'B'

/** Largo del registro de comprobantes según la versión (el de alícuotas es siempre 84). */
export const LARGO_CBTE: Record<VersionArchivo, number> = { A: 325, B: 340 }
export const LARGO_ALICUOTA = 84

/** Comprobantes B y C de compras: no discriminan IVA → 0 alícuotas. */
export const TIPOS_SIN_ALICUOTA = [6, 7, 8, 9, 11, 12, 13, 15, 16, 61, 64, 82, 111, 113, 114, 182, 188, 191, 206, 207, 208, 211, 212, 213]

/** Tipos que llevan «CUIT emisor/corredor» (campo 23 del diseño). */
export const TIPOS_CON_CORREDOR = [33, 58, 59, 60, 63]

/** Columna de la app → código de alícuota de ARCA. El orden es el que se escribe. */
const ALICUOTAS: { neto: keyof FilaCompraArca; iva: keyof FilaCompraArca | null; codigo: number; tasa: string }[] = [
  { neto: 'neto_grav_iva_0', iva: null, codigo: 3, tasa: '0%' },
  { neto: 'neto_grav_iva_2_5', iva: 'iva_2_5', codigo: 9, tasa: '2,5%' },
  { neto: 'neto_grav_iva_5', iva: 'iva_5', codigo: 8, tasa: '5%' },
  { neto: 'neto_grav_iva_10_5', iva: 'iva_10_5', codigo: 4, tasa: '10,5%' },
  { neto: 'neto_grav_iva_21', iva: 'iva_21', codigo: 5, tasa: '21%' },
  { neto: 'neto_grav_iva_27', iva: 'iva_27', codigo: 6, tasa: '27%' },
]

export interface AvisoArchivo {
  id?: string
  comprobante: string
  nombre: string
  motivo: string
}

export interface ArchivoArca {
  cbte: string[]
  alicuotas: string[]
  avisos: AvisoArchivo[]
}

const num = (v: number | string | null | undefined): number => {
  const x = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(x as number) ? (x as number) : 0
}

/** Importe → 15 posiciones, centavos sin coma. Negativo: el signo en la primera posición. */
export function importe(v: number): string {
  const c = Math.round(Math.abs(v) * 100)
  return v < 0 && c !== 0 ? '-' + String(c).padStart(14, '0') : String(c).padStart(15, '0')
}

/** Texto → ancho fijo, sólo caracteres que existen en ANSI (Windows-1252 / ISO 8859-1). */
export function texto(s: string | null | undefined, largo: number): string {
  const limpio = Array.from(s ?? '')
    .map(ch => {
      if (ch.charCodeAt(0) < 256) return ch
      const sinTilde = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
      return sinTilde.length === 1 && sinTilde.charCodeAt(0) < 256 ? sinTilde : '?'
    })
    .join('')
    .replace(/[\r\n]/g, ' ')
  return limpio.slice(0, largo).padEnd(largo, ' ')
}

const ceros = (v: number | string | null | undefined, largo: number): string =>
  String(Math.trunc(num(v))).padStart(largo, '0').slice(-largo)

const soloDigitos = (s: string | null | undefined): string => (s ?? '').replace(/\D/g, '')

/** «$», «PES» o vacío = pesos. «USD» = dólar (código DOL de ARCA). */
export function monedaArca(m: string | null | undefined): string {
  const x = (m ?? '').trim().toUpperCase()
  if (x === '' || x === '$' || x === 'PES' || x === 'ARS') return 'PES'
  if (x === 'USD' || x === 'U$S' || x === 'DOL' || x === 'US$') return 'DOL'
  return x.slice(0, 3).padEnd(3, ' ')
}

/** Tipo de cambio: 4 enteros + 6 decimales. Pesos = 1. */
function tipoCambio(f: FilaCompraArca): string {
  const tc = monedaArca(f.moneda) === 'PES' ? 1 : (num(f.tipo_cambio) || 1)
  return String(Math.round(tc * 1_000_000)).padStart(10, '0').slice(-10)
}

const identificar = (f: FilaCompraArca) =>
  `${f.tipo_comprobante ?? '?'}-${f.punto_venta ?? '?'}-${f.numero_desde ?? '?'}`

/** Fecha de la base (`AAAA-MM-DD`) → `AAAAMMDD`. */
const fecha = (s: string | null) => (s ?? '').slice(0, 10).replace(/-/g, '').padEnd(8, '0')

/**
 * Arma los renglones de los dos archivos para una versión.
 *
 * @param filas        lo imputado al mes en el subdiario de Compras
 * @param informante   CUIT y razón social de la empresa (para los tipos con corredor)
 */
export function armarLibroComprasArca(
  filas: FilaCompraArca[],
  version: VersionArchivo,
  informante: { cuit: string; razonSocial: string },
): ArchivoArca {
  const cbte: string[] = []
  const alicuotas: string[] = []
  const avisos: AvisoArchivo[] = []

  for (const f of filas) {
    const tipo = Number(f.tipo_comprobante ?? 0)
    const nombre = f.denominacion_emisor ?? ''
    const avisar = (motivo: string) => avisos.push({ id: f.id, comprobante: identificar(f), nombre, motivo })

    // La app guarda las notas de crédito en negativo; ARCA las quiere en positivo.
    const signo = num(f.imp_total) < 0 ? -1 : 1
    const v = (x: number | string | null | undefined) => num(x) * signo

    const sinAlicuota = TIPOS_SIN_ALICUOTA.includes(tipo)
    const lineas = sinAlicuota
      ? []
      : ALICUOTAS
          .map(a => ({ codigo: a.codigo, tasa: a.tasa, neto: v(f[a.neto] as number), iva: a.iva ? v(f[a.iva] as number) : 0 }))
          .filter(a => a.neto !== 0 || a.iva !== 0)

    const ivaTotal = v(f.iva)
    const cuit = soloDigitos(f.cuit)

    if (tipo === 0) avisar('Tipo de comprobante 0: ARCA no lo va a reconocer')
    if (cuit.length !== 11) avisar(`CUIT «${f.cuit ?? ''}» no tiene 11 dígitos`)
    if (!sinAlicuota && lineas.length === 0 && (v(f.imp_neto_gravado) !== 0 || ivaTotal !== 0)) {
      avisar('Tiene neto gravado o IVA pero no está separado por alícuota: sale sin renglón de alícuota')
    }
    if (!sinAlicuota && lineas.length > 0) {
      const netoAli = lineas.reduce((s, a) => s + a.neto, 0)
      const ivaAli = lineas.reduce((s, a) => s + a.iva, 0)
      if (Math.abs(netoAli - v(f.imp_neto_gravado)) > 0.005 || Math.abs(ivaAli - ivaTotal) > 0.005) {
        avisar('El neto o el IVA por alícuota no da el total del comprobante')
      }
    }
    if (!sinAlicuota) {
      const partes = v(f.imp_neto_gravado) + v(f.imp_neto_no_gravado) + v(f.imp_op_exentas) + ivaTotal + v(f.otros_tributos)
      const dif = v(f.imp_total) - partes
      if (Math.abs(dif) > 0.05) {
        avisar(`El total no da la suma de sus partes (diferencia ${dif.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`)
      }
    }

    // Comprobante A sin ninguna alícuota cargada pero con exento / no gravado: ARCA pide
    // igual un renglón de alícuota 0% y el código de operación que diga por qué.
    let codigoOperacion = '0'
    if (!sinAlicuota && lineas.length === 0) {
      if (v(f.imp_op_exentas) !== 0) codigoOperacion = 'E'
      else if (v(f.imp_neto_no_gravado) !== 0) codigoOperacion = 'N'
      if (codigoOperacion !== '0') lineas.push({ codigo: 3, tasa: '0%', neto: 0, iva: 0 })
    }

    const conCorredor = TIPOS_CON_CORREDOR.includes(tipo)

    let linea =
      fecha(f.fecha_emision) +
      ceros(tipo, 3) +
      ceros(f.punto_venta, 5) +
      ceros(f.numero_desde, 20) +
      ' '.repeat(16) +                              // despacho de importación
      '80' +                                        // tipo de documento: siempre CUIT
      cuit.padStart(20, '0').slice(-20) +
      texto(nombre, 30) +
      importe(v(f.imp_total)) +
      importe(v(f.imp_neto_no_gravado)) +
      importe(v(f.imp_op_exentas)) +
      importe(0) +                                  // percepciones IVA
      importe(0) +                                  // percepciones otros impuestos nacionales
      importe(0) +                                  // percepciones IIBB
      importe(0) +                                  // percepciones municipales
      importe(0) +                                  // impuestos internos
      monedaArca(f.moneda) +
      tipoCambio(f) +
      String(lineas.length) +
      codigoOperacion +
      importe(sinAlicuota ? 0 : ivaTotal) +         // crédito fiscal computable
      importe(v(f.otros_tributos)) +
      (conCorredor ? informante.cuit.padStart(11, '0') : '0'.repeat(11)) +
      (conCorredor ? texto(informante.razonSocial, 30) : ' '.repeat(30)) +
      importe(0)                                    // IVA comisión
    if (version === 'B') linea += importe(0)        // reintegro Decreto 1043/2016 (TurIVA)

    cbte.push(linea)

    for (const a of lineas) {
      alicuotas.push(
        ceros(tipo, 3) +
        ceros(f.punto_venta, 5) +
        ceros(f.numero_desde, 20) +
        '80' +
        cuit.padStart(20, '0').slice(-20) +
        importe(a.neto) +
        String(a.codigo).padStart(4, '0') +
        importe(a.iva),
      )
    }
  }

  return { cbte, alicuotas, avisos }
}

// ── El camino inverso: leer lo que se generó ────────────────────────────────────────────

const leerImporte = (s: string) => {
  const t = s.trim()
  if (!t) return 0
  return t.startsWith('-') ? -parseInt(t.slice(1), 10) / 100 : parseInt(t, 10) / 100
}

export interface CbteLeido {
  tipo: number
  puntoVenta: number
  numero: number
  total: number
  noGravado: number
  exento: number
  moneda: string
  tipoCambio: number
  cantidadAlicuotas: number
  otrosTributos: number
}

/** Lee un renglón del archivo de comprobantes (posiciones del diseño RG 4597). */
export function leerCbte(l: string): CbteLeido {
  return {
    tipo: parseInt(l.slice(8, 11), 10),
    puntoVenta: parseInt(l.slice(11, 16), 10),
    numero: parseInt(l.slice(16, 36), 10),
    total: leerImporte(l.slice(104, 119)),
    noGravado: leerImporte(l.slice(119, 134)),
    exento: leerImporte(l.slice(134, 149)),
    moneda: l.slice(224, 227),
    tipoCambio: parseInt(l.slice(227, 237), 10) / 1_000_000,
    cantidadAlicuotas: parseInt(l.slice(237, 238), 10),
    otrosTributos: leerImporte(l.slice(254, 269)),
  }
}

export interface AlicuotaLeida { tipo: number; puntoVenta: number; numero: number; neto: number; codigo: number; iva: number }

export function leerAlicuota(l: string): AlicuotaLeida {
  return {
    tipo: parseInt(l.slice(0, 3), 10),
    puntoVenta: parseInt(l.slice(3, 8), 10),
    numero: parseInt(l.slice(8, 28), 10),
    neto: leerImporte(l.slice(50, 65)),
    codigo: parseInt(l.slice(65, 69), 10),
    iva: leerImporte(l.slice(69, 84)),
  }
}

// ── El control: lo que dice el archivo contra lo que dice el subdiario ──────────────────

export interface RenglonControl { concepto: string; subdiario: number; archivo: number; ok: boolean }

export interface ControlArchivo {
  ok: boolean
  renglones: RenglonControl[]
  /** Problemas de forma: un renglón con largo distinto, un orden distinto entre los dos archivos. */
  problemas: string[]
}

/**
 * Relee los archivos generados y los compara con las filas del subdiario. Las dos puntas son
 * los MISMOS comprobantes, así que cualquier diferencia es un error de la app → frena.
 *
 * Los importes se comparan EN LA MONEDA DEL COMPROBANTE y con el signo de la app (notas de
 * crédito restando): el archivo los lleva en positivo, y el signo se recupera de la fila.
 */
export function controlarArchivo(
  filas: FilaCompraArca[],
  archivo: ArchivoArca,
  version: VersionArchivo,
): ControlArchivo {
  const problemas: string[] = []
  const largoCbte = LARGO_CBTE[version]

  archivo.cbte.forEach((l, i) => {
    if (l.length !== largoCbte) problemas.push(`Comprobante ${i + 1}: mide ${l.length} caracteres, tienen que ser ${largoCbte}`)
  })
  archivo.alicuotas.forEach((l, i) => {
    if (l.length !== LARGO_ALICUOTA) problemas.push(`Alícuota ${i + 1}: mide ${l.length} caracteres, tienen que ser ${LARGO_ALICUOTA}`)
  })
  if (archivo.cbte.length !== filas.length) {
    problemas.push(`El archivo tiene ${archivo.cbte.length} comprobantes y el subdiario ${filas.length}`)
  }

  const leidos = archivo.cbte.map(leerCbte)
  const alis = archivo.alicuotas.map(leerAlicuota)

  // Las alícuotas tienen que venir en el mismo orden que los comprobantes, y tantas como dice cada uno.
  let k = 0
  leidos.forEach((c, i) => {
    for (let j = 0; j < c.cantidadAlicuotas; j++, k++) {
      const a = alis[k]
      if (!a || a.tipo !== c.tipo || a.puntoVenta !== c.puntoVenta || a.numero !== c.numero) {
        problemas.push(`Comprobante ${i + 1}: sus alícuotas no están en el orden del archivo de comprobantes`)
        break
      }
    }
  })
  if (k !== alis.length && !problemas.some(p => p.includes('orden'))) {
    problemas.push(`Sobran o faltan renglones de alícuota (${alis.length} escritos, ${k} anunciados)`)
  }

  // Sumas del subdiario (fila por fila, con su signo).
  const sub = { total: 0, noGravado: 0, exento: 0, otros: 0, neto: 0, iva: 0 }
  for (const f of filas) {
    const tipo = Number(f.tipo_comprobante ?? 0)
    sub.total += num(f.imp_total)
    sub.noGravado += num(f.imp_neto_no_gravado)
    sub.exento += num(f.imp_op_exentas)
    sub.otros += num(f.otros_tributos)
    if (!TIPOS_SIN_ALICUOTA.includes(tipo)) {
      for (const a of ALICUOTAS) {
        sub.neto += num(f[a.neto] as number)
        if (a.iva) sub.iva += num(f[a.iva] as number)
      }
    }
  }

  // Sumas del archivo, devolviéndole el signo de la fila a cada comprobante.
  const arc = { total: 0, noGravado: 0, exento: 0, otros: 0, neto: 0, iva: 0 }
  let m = 0
  leidos.forEach((c, i) => {
    const s = num(filas[i]?.imp_total) < 0 ? -1 : 1
    arc.total += s * c.total
    arc.noGravado += s * c.noGravado
    arc.exento += s * c.exento
    arc.otros += s * c.otrosTributos
    for (let j = 0; j < c.cantidadAlicuotas; j++, m++) {
      const a = alis[m]
      if (!a) break
      arc.neto += s * a.neto
      arc.iva += s * a.iva
    }
  })

  const r = (x: number) => Math.round(x * 100) / 100
  const renglon = (concepto: string, a: number, b: number): RenglonControl =>
    ({ concepto, subdiario: r(a), archivo: r(b), ok: Math.abs(r(a) - r(b)) < 0.005 })

  const renglones = [
    { concepto: 'Comprobantes', subdiario: filas.length, archivo: leidos.length, ok: filas.length === leidos.length },
    renglon('Total', sub.total, arc.total),
    renglon('Neto gravado (por alícuota)', sub.neto, arc.neto),
    renglon('IVA (por alícuota)', sub.iva, arc.iva),
    renglon('No gravado', sub.noGravado, arc.noGravado),
    renglon('Exento', sub.exento, arc.exento),
    renglon('Otros tributos', sub.otros, arc.otros),
  ]

  return { ok: problemas.length === 0 && renglones.every(x => x.ok), renglones, problemas }
}

/** Texto final del archivo: renglones separados por CRLF, como los de 2023. */
export function contenidoArchivo(renglones: string[]): string {
  return renglones.length ? renglones.join('\r\n') + '\r\n' : ''
}

/** A bytes ANSI (ISO 8859-1): `texto()` ya dejó sólo caracteres de un byte. */
export function aBytesAnsi(contenido: string): Uint8Array {
  const out = new Uint8Array(contenido.length)
  for (let i = 0; i < contenido.length; i++) {
    const c = contenido.charCodeAt(i)
    out[i] = c < 256 ? c : 63 // '?'
  }
  return out
}
