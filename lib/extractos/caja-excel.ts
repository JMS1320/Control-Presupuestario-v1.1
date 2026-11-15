/**
 * 💵 EL EXCEL DE CAJAS DE AMS — leerlo y analizarlo antes de cargar (A-FEAT-1585). Lógica pura, sin base.
 *
 * AMS lleva las tres cajas de MSA (General, AMS, Sigot) en un Excel, una hoja por caja, y lo sube ENTERO cada vez que «pasa
 * caja» (JMS 15/11). De ahí salen las reglas de este archivo:
 *  - **El Excel es como existe** (JMS 15/11: «no deberíamos borrarle un movimiento; eventualmente que figure la inconsistencia»):
 *    un renglón igual a otro NO se descarta, se carga y se marca «posible repetido». Lo ya cargado se reconoce por contenido
 *    (fecha + importe + texto) contando ocurrencias, así dos renglones iguales del Excel son dos movimientos.
 *  - **Gastos anotados tarde** (JMS 15/11: Sigot encuentra una factura que pagó y la anota con la fecha del pago, desordenada):
 *    se cargan con su fecha real, en el orden del Excel, marcados «anotado tarde». Si su fecha es de un ejercicio anterior al de
 *    los renglones que ya estaban escritos arriba, **cruza el cierre** (alerta grande: con un pago grande cambia el ejercicio).
 *  - **Dos saldos** (JMS 15/11, R4: «al 24/12 no había 120.882»): el del Excel sigue el ORDEN en que escribe AMS y sirve de
 *    control de tipeo (renglón a renglón); el que vale para el balance es el saldo POR FECHA.
 *  - El texto de AMS va a **Detalle**; la app escribe una **Descripción** pareja (R1). «Cat» y «Comp» van a la nota como pista:
 *    AMS no tiene bien las categorías y la categoría se pone al conciliar (JMS 15/11, G6/M7).
 */

export type TablaCaja = "caja_general" | "caja_ams" | "caja_sigot"
export const NOMBRE_CAJA: Record<TablaCaja, string> = { caja_general: "Caja General", caja_ams: "Caja AMS", caja_sigot: "Caja Sigot" }

/** La hoja del Excel de AMS → la caja de la app («CAJA gral», «Caja Sigot», «Caja Andres»). */
export function cajaDeHoja(nombre: string): TablaCaja | null {
  const n = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  if (/sigot/.test(n)) return "caja_sigot"
  if (/andres|\bams\b/.test(n)) return "caja_ams"
  if (/gral|general/.test(n)) return "caja_general"
  return null
}

export interface FilaCaja {
  /** La fila en la hoja (1 = la primera), para ubicarla en el Excel. */
  fila: number
  fecha: string
  concepto: string
  cat: string
  comp: string
  salida: number
  entrada: number
  /** El saldo que escribió AMS (null si la celda está vacía). */
  saldo: number | null
}

const r2 = (x: number) => Math.round(x * 100) / 100
const limpio = (v: unknown) => (v == null ? "" : String(v).trim())

/** Montos: número tal cual; texto en es-AR («$ 1.234,56») o con coma de miles («1,234.56» del formato de Excel). */
export function numeroCaja(v: unknown): number {
  if (v == null || v === "") return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  let s = String(v).replace(/[$\s]/g, "").trim()
  if (!s || s === "-") return 0
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-")
  s = s.replace(/[()]/g, "").replace(/^-/, "")
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".")
  else s = s.replace(/,/g, "")
  const n = parseFloat(s)
  return Number.isFinite(n) ? (neg ? -n : n) : 0
}

/** Fecha: serial de Excel, Date, «dd/mm/aaaa» o «aaaa-mm-dd». Sin zona horaria (un día es un día). */
export function fechaCaja(v: unknown): string | null {
  if (v == null || v === "") return null
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5)
    return d.toISOString().slice(0, 10)
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    // xlsx con cellDates da la medianoche LOCAL de ese día: se suma medio día para no correrla al anterior
    return new Date(v.getTime() + 12 * 3600e3).toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
  return null
}

export interface ColumnasCaja { fecha: number; comp: number; cat: number; concepto: number; salida: number; entrada: number; saldo: number }

/** El encabezado: los nombres de las tres hojas de AMS (SALIDAS/ENTADAS, SALIDA/ENTRADA, DEBE/HABER, «FC/fondo fijo/X»). */
export function detectarColumnasCaja(rows: unknown[][]): { headerRow: number; cols: ColumnasCaja } | null {
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const up = (rows[i] ?? []).map(c => limpio(c).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))
    const fecha = up.findIndex(c => c === "FECHA")
    if (fecha < 0) continue
    const de = (...xs: string[]) => up.findIndex(c => xs.includes(c))
    const concepto = de("CONCEPTO", "DESCRIPCION", "DETALLE")
    const salida = de("SALIDA", "SALIDAS", "DEBE", "DEBITO", "DEBITOS")
    const entrada = de("ENTRADA", "ENTRADAS", "ENTADAS", "HABER", "CREDITO", "CREDITOS")
    if (concepto < 0 || (salida < 0 && entrada < 0)) continue
    return { headerRow: i, cols: {
      fecha, concepto, salida, entrada, saldo: de("SALDO"),
      cat: de("CAT", "CATEG", "CATEGORIA"),
      comp: up.findIndex(c => c === "COMP" || c === "COMPROBANTE" || /FONDO FIJO|^FC\b/.test(c)),
    } }
  }
  return null
}

export interface HojaLeida { filas: FilaCaja[]; sinFecha: { fila: number; concepto: string; importe: number }[]; error?: string }

/** Lee una hoja: los renglones con fecha son movimientos; los que tienen importe y no fecha se listan (no se cargan). */
export function leerHojaCaja(rows: unknown[][]): HojaLeida {
  const d = detectarColumnasCaja(rows)
  if (!d) return { filas: [], sinFecha: [], error: "No encontré el encabezado (FECHA, CONCEPTO y SALIDA/ENTRADA o DEBE/HABER)." }
  const { headerRow, cols: c } = d
  const filas: FilaCaja[] = [], sinFecha: HojaLeida["sinFecha"] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] ?? []
    const salida = c.salida >= 0 ? numeroCaja(r[c.salida]) : 0, entrada = c.entrada >= 0 ? numeroCaja(r[c.entrada]) : 0
    const fecha = fechaCaja(r[c.fecha]), concepto = limpio(r[c.concepto])
    if (!fecha) { if (salida || entrada) sinFecha.push({ fila: i + 1, concepto, importe: r2(entrada - salida) }); continue }
    filas.push({ fila: i + 1, fecha, concepto, cat: c.cat >= 0 ? limpio(r[c.cat]) : "", comp: c.comp >= 0 ? limpio(r[c.comp]) : "",
      salida: r2(salida), entrada: r2(entrada), saldo: c.saldo >= 0 && limpio(r[c.saldo]) !== "" ? r2(numeroCaja(r[c.saldo])) : null })
  }
  return { filas, sinFecha }
}

/** Ejercicio de MSA (julio → junio): el año en que cierra. */
export const ejercicioDe = (fecha: string) => Number(fecha.slice(0, 4)) + (fecha.slice(5) > "06-30" ? 1 : 0)

/** El texto pelado para reconocer un renglón ya cargado (mayúsculas, espacios y acentos no cuentan). */
export const textoClave = (s: string | null | undefined) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
const clave = (fecha: string, salida: number, entrada: number, texto: string) => `${fecha}|${r2(salida)}|${r2(entrada)}|${textoClave(texto)}`

/** Lo que ya está en la caja de la app. El texto de AMS puede estar en Detalle (desde 15/11) o en Descripción (lo viejo). */
export interface ExistenteCaja { id: string; fecha: string; descripcion: string | null; detalle: string | null; debitos: number; creditos: number }
const textoDe = (e: ExistenteCaja) => e.detalle?.trim() ? e.detalle : (e.descripcion ?? "")
const esRenglonDeSaldo = (e: ExistenteCaja) => /^saldo al /i.test(String(e.descripcion ?? ""))

export interface FilaAnalizada extends FilaCaja {
  /** Ya está en la app: no se carga. */
  yaEsta: boolean
  /** Ya está, pero con otro texto (se reconoció por fecha e importe, único): lo cargado antes a mano. */
  textoDistinto?: boolean
  existenteId?: string
  anotadoTarde: boolean
  cruzaCierre: boolean
  posibleRepetido: boolean
  /** Saldo del Excel − (saldo anterior del Excel − salida + entrada). 0 = la cadena de AMS cierra. */
  difCadena: number
}

export interface AnalisisCaja {
  tabla: TablaCaja
  /** Desde dónde se carga: el renglón del saldo a la fecha de corte (si se pidió). */
  corte?: { fecha: string; fila: number; saldo: number }
  filas: FilaAnalizada[]
  aCargar: FilaAnalizada[]
  yaEstaban: number
  posiblesRepetidos: FilaAnalizada[]
  anotadosTarde: FilaAnalizada[]
  cruzanCierre: FilaAnalizada[]
  /** Renglones ANTES del corte con fecha posterior (o sea, del período que se carga): quedan afuera, se muestran. */
  antesDelCorteConFechaPosterior: FilaCaja[]
  difsCadena: FilaAnalizada[]
  /** Están en la app (en el período del archivo) y ya no en el Excel: ¿se corrigieron o borraron? No se toca nada. */
  cambiadosOBorrados: ExistenteCaja[]
  saldoFinalExcel: number | null
  /** El saldo que vale para el balance, a cada 30/06 dentro del período y a la última fecha. */
  saldosPorFecha: { fecha: string; porFecha: number; porRenglon: number | null }[]
}

/**
 * El renglón que tiene el saldo a una fecha según el ORDEN del Excel: el último con fecha ≤ f tal que los siguientes (hasta 5)
 * ya son posteriores. Así un renglón suelto con la fecha mal tipeada no corre el corte. Si no hay, el último con fecha ≤ f.
 */
export function renglonDelSaldoA(hoja: FilaCaja[], f: string): number {
  let j = -1, ult = -1
  for (let i = 0; i < hoja.length; i++) {
    if (hoja[i].fecha > f) continue
    ult = i
    const sig = hoja.slice(i + 1, i + 6)
    if (sig.length && sig.every(x => x.fecha > f)) j = i
  }
  return j >= 0 ? j : ult
}

/**
 * Cruza la hoja con lo ya cargado. `desde` (opcional) = la fecha de corte de una carga inicial: se arranca del renglón que tiene el
 * saldo a esa fecha (el último con fecha ≤ desde tal que los siguientes ya son posteriores), así un renglón aislado con la fecha
 * mal tipeada no corre el corte.
 */
export function analizarCaja(tabla: TablaCaja, hoja: FilaCaja[], existentes: ExistenteCaja[], opciones: { desde?: string } = {}): AnalisisCaja {
  let ini = 0, corte: AnalisisCaja["corte"], saldoAnt: number | null = null
  const antesDelCorteConFechaPosterior: FilaCaja[] = []
  if (opciones.desde) {
    const d = opciones.desde
    const j = renglonDelSaldoA(hoja, d)
    if (j >= 0) {
      const saldo = hoja[j].saldo ?? 0
      corte = { fecha: d, fila: hoja[j].fila, saldo }
      saldoAnt = saldo; ini = j + 1
      antesDelCorteConFechaPosterior.push(...hoja.slice(0, j + 1).filter(x => x.fecha > d))
    }
  }
  const tramo = hoja.slice(ini)
  // ya cargados: por contenido, contando ocurrencias (dos iguales en el Excel = dos movimientos)
  const bolsa = new Map<string, ExistenteCaja[]>()
  const desdeF = tramo[0]?.fecha, hastaF = tramo.reduce((m, x) => (x.fecha > m ? x.fecha : m), "")
  const minF = tramo.reduce((m, x) => (x.fecha < m ? x.fecha : m), desdeF ?? "")
  for (const e of existentes) {
    if (esRenglonDeSaldo(e)) continue
    const k = clave(e.fecha, Number(e.debitos) || 0, Number(e.creditos) || 0, textoDe(e))
    bolsa.set(k, [...(bolsa.get(k) ?? []), e])
  }
  const vecesEnHoja = new Map<string, number>()
  const claveRep = (x: FilaCaja) => `${clave(x.fecha, x.salida, x.entrada, x.concepto)}|${textoClave(x.cat)}|${textoClave(x.comp)}`
  for (const x of tramo) { const k = claveRep(x); vecesEnHoja.set(k, (vecesEnHoja.get(k) ?? 0) + 1) }
  let maxFecha = corte?.fecha ?? ""
  const filas: FilaAnalizada[] = tramo.map(x => {
    const k = clave(x.fecha, x.salida, x.entrada, detalleDeCaja(x))
    const lista = bolsa.get(k)
    const ex = lista?.shift()
    const anotadoTarde = !!maxFecha && x.fecha < maxFecha
    const cruzaCierre = !!maxFecha && ejercicioDe(x.fecha) < ejercicioDe(maxFecha)
    if (x.fecha > maxFecha) maxFecha = x.fecha
    let difCadena = 0
    if (x.saldo != null) {
      if (saldoAnt != null) difCadena = r2(x.saldo - (saldoAnt - x.salida + x.entrada))
      saldoAnt = x.saldo
    } else if (saldoAnt != null) saldoAnt = r2(saldoAnt - x.salida + x.entrada)
    return { ...x, yaEsta: !!ex, existenteId: ex?.id, anotadoTarde, cruzaCierre, posibleRepetido: (vecesEnHoja.get(claveRep(x)) ?? 0) > 1, difCadena }
  })
  // 2ª pasada: lo cargado antes con OTRO texto (p. ej. a mano, script 245) se reconoce por fecha e importe si hay uno solo de cada lado
  const sueltos = [...bolsa.values()].flat()
  const porImporte = (f: string, s: number, e: number) => `${f}|${r2(s)}|${r2(e)}`
  for (const f of filas.filter(f => !f.yaEsta)) {
    const k = porImporte(f.fecha, f.salida, f.entrada)
    const cand = sueltos.filter(e => porImporte(e.fecha, Number(e.debitos) || 0, Number(e.creditos) || 0) === k)
    const otras = filas.filter(g => !g.yaEsta && porImporte(g.fecha, g.salida, g.entrada) === k)
    if (cand.length === 1 && otras.length === 1) {
      f.yaEsta = true; f.textoDistinto = true; f.existenteId = cand[0].id
      sueltos.splice(sueltos.indexOf(cand[0]), 1)
      for (const [kk, l] of bolsa) { const i = l.indexOf(cand[0]); if (i >= 0) { l.splice(i, 1); bolsa.set(kk, l) } }
    }
  }
  const cambiadosOBorrados = [...bolsa.values()].flat().filter(e => minF && e.fecha >= minF && e.fecha <= hastaF)
  // 📅 Saldos POR FECHA (los que valen para el balance — JMS 15/11, R4). Partiendo del saldo escrito en el renglón del arranque:
  //   saldo a F = ese saldo − lo de ANTES del arranque con fecha posterior a F + lo de DESPUÉS del arranque con fecha ≤ F.
  // Al lado, el saldo que dice el Excel en su renglón: si difieren, hay movimientos de esa fecha anotados en otro lugar.
  const neto = (x: FilaCaja) => x.entrada - x.salida
  const antes = hoja.slice(0, ini)
  const base = corte?.saldo ?? (tramo[0]?.saldo != null ? r2(tramo[0].saldo - neto(tramo[0])) : 0)
  const porFecha = (f: string) => r2(base - antes.filter(x => x.fecha > f).reduce((t, x) => t + neto(x), 0) + tramo.filter(x => x.fecha <= f).reduce((t, x) => t + neto(x), 0))
  const porRenglon = (f: string) => { const i = renglonDelSaldoA(hoja, f); return i >= 0 ? hoja[i].saldo : null }
  const cortes = new Set<string>(corte ? [corte.fecha] : [])
  for (const x of tramo) { const c = `${ejercicioDe(x.fecha) - 1}-06-30`; if (c > (corte?.fecha ?? desdeF ?? "") && c < hastaF) cortes.add(c) }
  const saldosPorFecha = [...[...cortes].sort(), hastaF].filter(Boolean).map(f => ({ fecha: f, porFecha: porFecha(f), porRenglon: porRenglon(f) }))
  return {
    tabla, corte, filas, aCargar: filas.filter(f => !f.yaEsta), yaEstaban: filas.filter(f => f.yaEsta).length,
    posiblesRepetidos: filas.filter(f => f.posibleRepetido), anotadosTarde: filas.filter(f => f.anotadoTarde),
    cruzanCierre: filas.filter(f => f.cruzaCierre), antesDelCorteConFechaPosterior, difsCadena: filas.filter(f => Math.abs(f.difCadena) > 0.01),
    cambiadosOBorrados, saldoFinalExcel: [...tramo].reverse().find(x => x.saldo != null)?.saldo ?? null, saldosPorFecha,
  }
}

/** El texto de AMS para Detalle: su concepto; si lo dejó vacío, su «Cat» (las distribuciones del 17/01/26 no tienen concepto). */
export const detalleDeCaja = (x: Pick<FilaCaja, "concepto" | "cat">) => x.concepto || x.cat

/** Qué fue el movimiento, en una palabra pareja (para filtrar y para que las reglas aprendan). El texto de AMS va a Detalle. */
export function descripcionDeCaja(x: Pick<FilaCaja, "concepto" | "comp" | "salida" | "entrada">): string {
  const t = textoClave(x.concepto), comp = textoClave(x.comp)
  if (/caja gral|caja general|de caja|a caja|a sigot|galicia a caja|extracc/.test(t)) {
    if (/galicia|extracc/.test(t)) return x.entrada ? "Pase desde el banco" : "Pase al banco"
    return x.entrada ? "Pase desde otra caja" : "Pase a otra caja"
  }
  if (/^ajuste\b/.test(t)) return "Ajuste de arqueo"
  const lado = x.entrada && !x.salida ? "Entrada a caja" : "Salida de caja"
  if (/^fc\b|^factura/.test(comp)) return `${lado} · con factura`
  if (/fondo fijo|^f\.? ?fijo/.test(comp)) return `${lado} · fondo fijo`
  if (/^dist\b/.test(comp)) return `${lado} · por cuenta de un socio`
  if (comp === "x") return `${lado} · sin factura`
  return lado
}

/** La nota: de dónde vino, la «Cat» y el «Comp» de AMS (pista, no categoría) y las marcas. */
export function notaDeCaja(tabla: TablaCaja, f: FilaAnalizada, marca?: string): string {
  const planilla = [f.cat && `CATEG ${f.cat}`, f.comp && f.comp !== "-" && `Comp ${f.comp}`].filter(Boolean).join(" · ")
  const avisos = [f.cruzaCierre && "🔴 cruza el cierre (fecha de un ejercicio anterior a los renglones de arriba)", f.anotadoTarde && !f.cruzaCierre && "⚠️ anotado tarde",
    f.posibleRepetido && "⚠️ posible repetido (hay otro igual en el Excel)", Math.abs(f.difCadena) > 0.01 && `⚠️ el saldo del Excel no sigue (${f.difCadena})`].filter(Boolean)
  return [`💵 ${NOMBRE_CAJA[tabla]} (Excel de AMS, fila ${f.fila})${planilla ? " — tu planilla: " + planilla : ""}`, ...avisos, marca].filter(Boolean).join(" · ")
}
