/**
 * 📥 LO QUE DEVUELVE EL CONTADOR — el libro IVA presentado, contra el subdiario de la app (A-AUTO-09).
 *
 * Pedido de JMS (2026-10-27): *«la app debe procesar lo que llega del contador; de esa manera hubiéramos agarrado a
 * tiempo el error de diciembre… el control es totales contra el total de todo lo que recibimos del contador… le
 * podemos pedir el Excel que exporta ARCA; ponelo como nuestros requisitos y la app lo guarda y mira si hay error»*.
 *
 * Lo que se le pide al contador, con la DDJJ: el **zip del libro IVA** que exporta ARCA
 * (`libro_iva_periodo_AAAAMM_original.zip`). Trae todo lo que hace falta:
 *   · `libro_iva.xml` → los TOTALES de lo presentado. `total_liquidado` de compras **es el crédito fiscal de la
 *     DDJJ** (diciembre 2025: 2.348.520,27 en los dos lados). La DDJJ en PDF viene como imagen y no se puede leer
 *     sin OCR; el zip la reemplaza con el mismo número.
 *   · `comprobantes_compras.csv` → un renglón por comprobante declarado, con sus importes en la moneda original
 *     y el tipo de cambio (las NC en negativo).
 *
 * Y se compara contra el subdiario de la app del mismo mes, por dos caminos: TOTALES (cantidad, importe total,
 * crédito fiscal) y COMPROBANTE POR COMPROBANTE (qué está de un lado y no del otro, y qué tiene otro importe).
 * Diciembre 2025 lo prueba: los 109.710,89 de crédito fiscal de más en la app son exactamente las 4 facturas que
 * están en el subdiario y no se presentaron (A-DAT-61).
 *
 * Piezas puras (sin base): la prueba `npm run probar`.
 */

export interface TotalesPresentados {
  periodo: string // «202512»
  secuencia: number
  codigo: string | null
  netoGravado: number
  /** El crédito fiscal liquidado = el de la DDJJ. */
  creditoFiscal: number
  exentoNoGravado: number
  exentoNoGravadoNC: number
  noFiscal: number
}

export interface ComprobantePresentado {
  fecha: string
  tipo: number
  puntoVenta: number
  numero: number
  cuit: string
  denominacion: string
  /**
   * En pesos, TAL CUAL viene en el libro. ⚠️ cambió 2026-10-27: decía «importe original × tipo de cambio» y se
   * multiplicaba — **el libro IVA de ARCA ya informa los importes en PESOS** aunque la factura sea en dólares
   * (Agro Centros 3-5282: «Importe Total» 5.023.287,17 con DOL y TC 1.403 = neto 4.151.477 + IVA 871.810,17).
   * Multiplicar daba 7.047 millones y cada factura en dólares salía «con otro importe».
   */
  total: number
  /** Crédito fiscal computable, en pesos. En VENTAS es el débito fiscal (el «Total IVA» del libro). */
  creditoFiscal: number
  /**
   * 📒 Las columnas, en pesos — para que el libro diario compare columna por columna (A-FEAT-1388 ronda 3).
   * `otrosTributos` junta percepciones, impuestos municipales e internos y otros tributos: es lo mismo que la app
   * guarda en `otros_tributos` (ver `desdeHistorico`). Opcionales: los casos viejos no los traen.
   */
  netoGravado?: number
  noGravado?: number
  exento?: number
  iva?: number
  otrosTributos?: number
  /** 💵 La moneda original (`PES`, `DOL`) y su cotización, tal cual el libro. Sólo para mostrar: los importes ya son pesos. */
  moneda?: string
  tipoCambio?: number
}

const num = (s: string | undefined) => {
  const t = String(s ?? "").replace(/"/g, "").trim()
  if (!t) return 0
  return Number(t.replace(/\./g, "").replace(",", ".")) || 0
}
const r2 = (n: number) => Math.round(n * 100) / 100
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "")

/** Un valor del XML por su etiqueta, dentro de un bloque (o del documento entero). */
function etiqueta(xml: string, nombre: string): string | null {
  const m = xml.match(new RegExp(`<${nombre}>([^<]*)</${nombre}>`))
  return m ? m[1].trim() : null
}

export function parsearTotalesXml(xml: string): TotalesPresentados {
  const compras = xml.match(/<iva_compras>[\s\S]*?<\/iva_compras>/)?.[0] ?? ""
  const totalesCompras = compras.match(/<totales_compras>[\s\S]*?<\/totales_compras>/)?.[0] ?? ""
  const n = (s: string | null) => Number(s ?? 0) || 0
  return {
    periodo: etiqueta(xml, "periodo") ?? "",
    secuencia: n(etiqueta(xml, "secuencia")),
    codigo: etiqueta(xml, "codigo"),
    netoGravado: n(etiqueta(totalesCompras, "total_neto_gravado")),
    creditoFiscal: n(etiqueta(totalesCompras, "total_liquidado")),
    exentoNoGravado: n(etiqueta(compras, "total_exento_no_gravado")),
    exentoNoGravadoNC: n(etiqueta(compras, "total_exento_no_gravado_nc")),
    noFiscal: n(etiqueta(compras, "total_compras_no_fiscal")),
  }
}

/** `comprobantes_compras.csv`: separado por «;», decimales con coma, la primera fila es el encabezado. */
export function parsearComprasCsv(csv: string): ComprobantePresentado[] {
  return parsearCsvLibro(csv, "compras")
}

/**
 * 🧾 Las VENTAS del mismo zip (`comprobantes_ventas.csv`) — hasta el 27/10 nadie las leía (A-FEAT-1388 ronda 3:
 * el libro diario compara ventas contra lo presentado igual que compras). Mismo formato, con «Comprador» en vez
 * de «Vendedor» y sin crédito fiscal: `creditoFiscal` lleva el débito (el «Total IVA»).
 */
export function parsearVentasCsv(csv: string): ComprobantePresentado[] {
  return parsearCsvLibro(csv, "ventas")
}

function parsearCsvLibro(csv: string, lado: "compras" | "ventas"): ComprobantePresentado[] {
  const lineas = csv.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim())
  if (lineas.length < 2) return []
  const cab = lineas[0].split(";").map(c => c.replace(/"/g, "").trim().toLowerCase())
  const col = (...nombres: string[]) => cab.findIndex(c => nombres.some(n => c.startsWith(n)))
  const iFecha = col("fecha de emisi"), iTipo = col("tipo de comprobante"), iPv = col("punto de venta")
  // ⚠️ «número de comprobante hasta» (ventas) también empieza así: se toma la PRIMERA, que es la «desde».
  const iNum = col("número de comprobante", "numero de comprobante", "nmero de comprobante")
  const iCuit = col(lado === "compras" ? "nro. doc. vendedor" : "nro. doc. comprador")
  const iDen = col("denominaci"), iTotal = col("importe total")
  const iTc = col("tipo de cambio"), iMon = col("moneda original", "moneda"), iCred = col("crédito fiscal computable", "credito fiscal computable", "crdito fiscal computable")
  const iNoGrav = col("importe no gravado"), iExento = col("importe exento")
  const iNeto = col("total neto gravado"), iIva = col("total iva")
  // El «Total IVA» del libro viene REDONDEADO (4.464,57 de IVA 21 % figura 4.464,60): el exacto es la suma de las
  // columnas por alícuota. Si no hay ninguna (un formato viejo), se usa el total.
  const iIvaAlicuotas = cab.map((c, i) => (c.startsWith("importe iva ") ? i : -1)).filter(i => i >= 0)
  // Todo lo que la app junta en «otros tributos»: percepciones, municipales, internos y otros.
  const iOtros = cab.map((c, i) => (/^(importe de per|importe de percepciones|importe de impuestos|importe otros tributos|percepci)/.test(c) ? i : -1))
    .filter(i => i >= 0)
  const val = (v: string[], i: number) => (i >= 0 ? num(v[i]) : 0)
  const vacio = (v: string[], i: number) => i < 0 || !String(v[i] ?? "").replace(/"/g, "").trim()
  return lineas.slice(1).map(l => {
    const v = l.split(";")
    const tc = 1
    const iva = r2((iIvaAlicuotas.length ? iIvaAlicuotas.reduce((t, i) => t + val(v, i), 0) : val(v, iIva)) * tc)
    return {
      fecha: String(v[iFecha] ?? "").replace(/"/g, "").trim(),
      tipo: parseInt(dig(v[iTipo])) || 0,
      puntoVenta: parseInt(dig(v[iPv])) || 0,
      numero: parseInt(dig(v[iNum])) || 0,
      cuit: dig(v[iCuit]),
      denominacion: String(v[iDen] ?? "").replace(/"/g, "").trim(),
      total: r2(num(v[iTotal]) * tc),
      // En algunos meses (jul y nov 2025) el libro trae «Crédito Fiscal Computable» VACÍO: ahí el crédito es el IVA.
      creditoFiscal: lado === "compras" ? (vacio(v, iCred) ? iva : r2(val(v, iCred) * tc)) : iva,
      netoGravado: r2(val(v, iNeto) * tc),
      noGravado: r2(val(v, iNoGrav) * tc),
      exento: r2(val(v, iExento) * tc),
      iva,
      otrosTributos: r2(iOtros.reduce((s, i) => s + val(v, i), 0) * tc),
      // El tipo de cambio se informa pero NO se aplica: los importes del libro ya están en pesos (ver `total`).
      moneda: iMon >= 0 ? String(v[iMon] ?? "").replace(/"/g, "").trim() || undefined : undefined,
      tipoCambio: iTc >= 0 ? num(v[iTc]) || undefined : undefined,
    }
  })
}

/** Lo mínimo de una factura de la app para comparar. */
export interface FacturaParaComparar {
  id: string
  tipo_comprobante: number | null
  punto_venta: number | null
  numero_desde: number | null
  cuit: string | null
  denominacion_emisor: string | null
  fecha_emision: string | null
  imp_total: number | string | null
  iva: number | string | null
  tipo_cambio?: number | string | null
}

export interface ResultadoContraPresentado {
  totales: {
    app: { comprobantes: number; total: number; creditoFiscal: number }
    presentado: { comprobantes: number; total: number; creditoFiscal: number }
    diferencia: { comprobantes: number; total: number; creditoFiscal: number }
  }
  /** En la app y no presentadas. */
  soloApp: FacturaParaComparar[]
  /** Presentadas y no en la app. */
  soloPresentado: ComprobantePresentado[]
  /** En los dos lados con otro importe total. */
  importeDistinto: { app: FacturaParaComparar; presentado: ComprobantePresentado; diferencia: number }[]
  /**
   * 🔢 El MISMO comprobante con otro tipo o número: emparejados por CUIT + importe, o por CUIT cuando queda uno de
   * cada lado (A-FEAT-1388 ronda 3: Federación 0-34160783 vs 1-34160783, las liquidaciones de granos sin número en
   * la app). Con `diferencia` 0 es un dato de identificación a corregir en la app, no un mes a rectificar.
   */
  otroNumero: { app: FacturaParaComparar; presentado: ComprobantePresentado; diferencia: number }[]
  /** Cada comprobante de la app con el presentado que le tocó (por id de la app). Para poner lo declarado al lado. */
  pares: Map<string, ComprobantePresentado>
  ok: boolean
}

const TOL = 0.05

/**
 * El subdiario de la app contra lo presentado. Se busca cada comprobante por tipo + punto de venta + número + CUIT;
 * si no aparece, por punto de venta + número + CUIT (la cooperativa: tipo 17 en ARCA, tipo 1 en la app).
 * El crédito fiscal de la app es el IVA de los comprobantes que dan crédito (sin B ni C), en pesos.
 */
export function compararSubdiarioConLibro(
  app: FacturaParaComparar[],
  presentado: ComprobantePresentado[],
  tiposSinCredito: number[],
): ResultadoContraPresentado {
  const n = (v: unknown) => Number(v) || 0
  const tc = (f: FacturaParaComparar) => n(f.tipo_cambio) || 1
  const clave = (t: number, pv: number, nro: number, cuit: string) => `${t}-${pv}-${nro}-${cuit}`
  const sinTipo = (pv: number, nro: number, cuit: string) => `${pv}-${nro}-${cuit}`
  const libres = new Map<string, ComprobantePresentado[]>()
  const libresSinTipo = new Map<string, ComprobantePresentado[]>()
  for (const p of presentado) {
    const k = clave(p.tipo, p.puntoVenta, p.numero, p.cuit)
    libres.set(k, [...(libres.get(k) ?? []), p])
    const k2 = sinTipo(p.puntoVenta, p.numero, p.cuit)
    libresSinTipo.set(k2, [...(libresSinTipo.get(k2) ?? []), p])
  }
  const usados = new Set<ComprobantePresentado>()
  const tomar = (lista: ComprobantePresentado[] | undefined) => {
    const p = lista?.find(x => !usados.has(x))
    if (p) usados.add(p)
    return p
  }
  const soloApp: FacturaParaComparar[] = []
  const importeDistinto: ResultadoContraPresentado["importeDistinto"] = []
  const pares = new Map<string, ComprobantePresentado>()
  for (const f of app) {
    const cuit = dig(f.cuit), pv = n(f.punto_venta), nro = n(f.numero_desde)
    const p = tomar(libres.get(clave(n(f.tipo_comprobante), pv, nro, cuit))) ?? tomar(libresSinTipo.get(sinTipo(pv, nro, cuit)))
    if (!p) { soloApp.push(f); continue }
    pares.set(f.id, p)
    const dif = r2(n(f.imp_total) * tc(f) - p.total)
    if (Math.abs(dif) > TOL) importeDistinto.push({ app: f, presentado: p, diferencia: dif })
  }
  // 2º y 3º paso: lo que no se encontró por tipo + punto de venta + número, por CUIT.
  const otroNumero: ResultadoContraPresentado["otroNumero"] = []
  const pesosApp = (f: FacturaParaComparar) => r2(n(f.imp_total) * tc(f))
  const libresDe = (cuit: string) => presentado.filter(p => !usados.has(p) && p.cuit === cuit)
  for (const f of [...soloApp]) {
    const p = libresDe(dig(f.cuit)).find(x => Math.abs(x.total - pesosApp(f)) <= TOL)
    if (!p) continue
    usados.add(p); pares.set(f.id, p)
    otroNumero.push({ app: f, presentado: p, diferencia: 0 })
    soloApp.splice(soloApp.indexOf(f), 1)
  }
  for (const f of [...soloApp]) {
    const cuit = dig(f.cuit)
    const libresCuit = libresDe(cuit)
    if (libresCuit.length !== 1 || soloApp.filter(x => dig(x.cuit) === cuit).length !== 1) continue
    const p = libresCuit[0]
    usados.add(p); pares.set(f.id, p)
    otroNumero.push({ app: f, presentado: p, diferencia: r2(pesosApp(f) - p.total) })
    soloApp.splice(soloApp.indexOf(f), 1)
  }
  const soloPresentado = presentado.filter(p => !usados.has(p))
  const appTotal = r2(app.reduce((t, f) => t + n(f.imp_total) * tc(f), 0))
  const appCred = r2(app.filter(f => !tiposSinCredito.includes(n(f.tipo_comprobante))).reduce((t, f) => t + n(f.iva) * tc(f), 0))
  const prTotal = r2(presentado.reduce((t, p) => t + p.total, 0))
  const prCred = r2(presentado.reduce((t, p) => t + p.creditoFiscal, 0))
  const totales = {
    app: { comprobantes: app.length, total: appTotal, creditoFiscal: appCred },
    presentado: { comprobantes: presentado.length, total: prTotal, creditoFiscal: prCred },
    diferencia: { comprobantes: app.length - presentado.length, total: r2(appTotal - prTotal), creditoFiscal: r2(appCred - prCred) },
  }
  const ok = !soloApp.length && !soloPresentado.length && !importeDistinto.length
    && !otroNumero.some(x => Math.abs(x.diferencia) > TOL)
    && Math.abs(totales.diferencia.total) <= TOL && Math.abs(totales.diferencia.creditoFiscal) <= TOL
  return { totales, soloApp, soloPresentado, importeDistinto, otroNumero, pares, ok }
}

/** Lee el zip que exporta ARCA (en el navegador o en el servidor). */
export async function leerZipLibroIva(datos: ArrayBuffer | Uint8Array): Promise<{
  totales: TotalesPresentados | null; compras: ComprobantePresentado[]; ventas: ComprobantePresentado[]
}> {
  const JSZip = (await import("jszip")).default
  const zip = await JSZip.loadAsync(datos)
  const archivo = (fin: string) => Object.values(zip.files).find(f => f.name.toLowerCase().endsWith(fin))
  const xml = archivo("libro_iva.xml")
  // El CSV viene en latin-1 (las tildes de los encabezados): se decodifica así para poder reconocer las columnas.
  const texto = async (fin: string) => {
    const f = archivo(fin)
    return f ? new TextDecoder("latin1").decode(await f.async("uint8array")) : ""
  }
  return {
    totales: xml ? parsearTotalesXml(await xml.async("string")) : null,
    compras: parsearComprasCsv(await texto("comprobantes_compras.csv")),
    ventas: parsearVentasCsv(await texto("comprobantes_ventas.csv")),
  }
}
