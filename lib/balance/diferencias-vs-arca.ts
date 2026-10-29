/**
 * 🔍 DIFERENCIAS vs ARCA — lo que la app tiene distinto a lo PRESENTADO, comprobante por comprobante (A-FEAT-1388).
 *
 * ## Qué es
 * El segundo botón de Reportes → Balance, al lado de «Bajar Libro Diario»: «Bajar Diferencias vs ARCA». Se eligen los
 * 12 zips del libro IVA que exporta ARCA (`libro_iva_periodo_AAAAMM_original.zip`), se leen en el navegador y se
 * cruzan contra las compras y ventas del libro ya armado. Sale UN libro que reproduce los dos reportes armados a mano
 * el 27/10/2026 («Diferencias Compras / Ventas MSA 25-26 - app vs ARCA.xlsx», carpeta «Sesion Claude Estanco»):
 *   · `Compras - Diferencias` = el de compras (generador `armar_diferencias_vs_arca.py` + `generar_libro_diario_compras.ps1`).
 *   · `Ventas - Diferencias`  = el de ventas  (`armar_ventas_arca.py` + `generar_libro_diario_ventas.ps1`).
 *   · `Zips de ARCA`          = qué zip se usó para cada mes, cuáles se descartaron y por qué, qué mes falta.
 * Cada reporte queda en UNA solapa, en las mismas celdas que el original: así se compara celda por celda.
 *
 * ## Diferencia = ARCA − app
 * - **Compras**, criterio del cuadro consensuado: la Factura C (tipo 11) va con no gravado y exento en 0 y el total a
 *   Monotributo — en los DOS lados. La app sale de `filasComprasConsensuado` (las mismas cuentas del Libro Diario).
 * - **Ventas**, criterio DDJJ IVA: neto, no gravado, exento, IVA vendido y total. Del lado de ARCA el total va **sin**
 *   retenciones / percepciones / pagos a cuenta (lo que el CSV junta en «otros tributos»), y la nota de débito que
 *   trae sólo total (sin neto ni IVA) **no entra en el cuadro**: se lista aparte.
 *
 * ## Los grupos salen de los DATOS (reglas generales)
 * Compras: 1. signo distinto (ARCA = −app) · 2. otros tributos que la app no tiene (a la app le falta justo eso para
 * llegar al total) · 3. exento repetido en otros tributos (en ARCA las partes superan el total en lo que difiere otros)
 * · 4. centavos (todo < 1 peso) · 5. identificación distinta (mismos importes, otro tipo / punto de venta / número) ·
 * 6. otro importe distinto · 9. de un solo lado.
 * Ventas: 1. centavos · 2. IVA con comisión / almacenaje (la app ya resta: el IVA del libro es el vendido) ·
 * 3. identificación distinta · 4. otro importe distinto · 9. de un solo lado.
 * Lo que NO se puede deducir (el nombre «Federación Patronal», los links a los PDF, la nota de arriba, el «por qué» de
 * Pedro Genta 77393) vive en `LIBRO_DIARIO_CONSENSUADO[empresa][año].diferencias`: otro ejercicio no lo muestra.
 *
 * ## Los zips — nada en silencio
 * El período sale del XML (`<periodo>`), o del nombre del archivo si no tiene. Un mes repetido: se toma la secuencia
 * más alta (la rectificativa) y se dice. Un zip de otro ejercicio: se descarta y se dice. Un mes sin zip: sus
 * comprobantes de la app quedan FUERA del cruce (si no, saldrían todos como «no presentados») y se dice.
 *
 * Totales, subtotales y controles van como fórmula (con el valor ya calculado), como en el Libro Diario.
 */
import XLSX from "xlsx-js-style"
import type { LibroDiario } from "./libro-diario"
import { claveSubdiario, type Ejercicio } from "./ejercicio"
import {
  filasComprasConsensuado, filasVentasConsensuado, LIBRO_DIARIO_CONSENSUADO, Hoja, COLOR, NEGRITA, ITALICA, GRIS,
  fondo, ENCABEZADO_OSCURO, subtotal, numOTexto, aplicarVistas, IMPORTE, CANT,
  type FilaCompraConsensuada, type FilaVentaConsensuada, type ConsensuadoDelEjercicio, type FacturaMarcada, type Vista,
} from "./libro-diario-consensuado"
import {
  leerZipLibroIva, type ComprobantePresentado, type TotalesVentasPresentados,
} from "@/lib/subdiarios/libro-presentado"
import { hoyArgentina } from "@/lib/fechas"
import { ESPERA_ANTES_DE_LIBERAR_MS } from "@/lib/descargar-archivo"

const r2 = (x: number) => Math.round((Number(x) || 0) * 100) / 100
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "")
const ars = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cmpTexto = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Los zips
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Un zip del libro IVA ya leído. */
export interface ZipLibroIva {
  archivo: string
  /** `202507`, del XML; si el XML no lo tiene, del nombre del archivo. */
  periodo: string | null
  secuencia: number | null
  compras: ComprobantePresentado[]
  ventas: ComprobantePresentado[]
  totalesVentas: TotalesVentasPresentados | null
  /** El período del nombre del archivo, si es distinto del XML (se avisa). */
  periodoDelNombre?: string | null
}

const periodoDelNombre = (archivo: string) => archivo.match(/periodo_(\d{6})/)?.[1] ?? null

/** Lee un zip (navegador o Node). */
export async function leerZipParaDiferencias(archivo: string, datos: ArrayBuffer | Uint8Array): Promise<ZipLibroIva> {
  const z = await leerZipLibroIva(datos)
  const delNombre = periodoDelNombre(archivo)
  const periodo = z.totales?.periodo || delNombre
  return {
    archivo, periodo: periodo || null, secuencia: z.totales ? z.totales.secuencia : null,
    compras: z.compras, ventas: z.ventas, totalesVentas: z.totalesVentas,
    periodoDelNombre: delNombre && periodo && delNombre !== periodo ? delNombre : null,
  }
}

export interface ZipRevisado { zip: ZipLibroIva; subdiario: string | null; usado: boolean; motivo: string }

export interface ValidacionZips {
  /** El zip que vale para cada subdiario del ejercicio. */
  porSubdiario: Map<string, ZipLibroIva>
  /** Subdiarios del ejercicio sin zip. */
  faltan: string[]
  /** Todos los archivos, con qué se hizo con cada uno. */
  revisados: ZipRevisado[]
  /** Avisos para mostrar (toast y solapa «Zips de ARCA»). */
  avisos: string[]
}

const aSubdiario = (p: string) => `${p.slice(0, 4)}-${p.slice(4, 6)}`

/**
 * ¿Qué zip vale para cada mes? Fuera del ejercicio → descartado. Repetido → la secuencia más alta (la rectificativa;
 * a igual secuencia, el primero). Nada se descarta sin decirlo.
 */
export function validarZips(zips: ZipLibroIva[], ej: Ejercicio): ValidacionZips {
  const meses = ej.subdiarios.map(s => claveSubdiario(s.anio, s.mes))
  const avisos: string[] = []
  const revisados: ZipRevisado[] = zips.map(zip => {
    if (zip.periodoDelNombre) avisos.push(`${zip.archivo}: el nombre dice ${aSubdiario(zip.periodoDelNombre)} pero el XML dice ${aSubdiario(zip.periodo!)}; vale el XML.`)
    if (!zip.periodo || !/^\d{6}$/.test(zip.periodo)) {
      avisos.push(`${zip.archivo}: no se pudo saber de qué período es (no trae libro_iva.xml ni el período en el nombre); no se usa.`)
      return { zip, subdiario: null, usado: false, motivo: "Sin período: no se usa" }
    }
    const sub = aSubdiario(zip.periodo)
    if (!meses.includes(sub)) {
      avisos.push(`${zip.archivo}: es de ${sub}, fuera del ejercicio ${ej.etiqueta}; no se usa.`)
      return { zip, subdiario: sub, usado: false, motivo: `Fuera del ejercicio ${ej.etiqueta}: no se usa` }
    }
    return { zip, subdiario: sub, usado: true, motivo: "Se usa" }
  })
  const porSubdiario = new Map<string, ZipLibroIva>()
  for (const m of meses) {
    const del = revisados.filter(r => r.usado && r.subdiario === m)
    if (!del.length) continue
    const elegido = del.reduce((a, b) => ((b.zip.secuencia ?? 0) > (a.zip.secuencia ?? 0) ? b : a))
    porSubdiario.set(m, elegido.zip)
    if (del.length > 1) {
      for (const r of del) {
        if (r === elegido) { r.motivo = `Se usa: secuencia ${elegido.zip.secuencia ?? "?"}, la más alta del mes (rectificativa)`; continue }
        r.usado = false
        r.motivo = (r.zip.secuencia ?? 0) === (elegido.zip.secuencia ?? 0)
          ? `Repetido (misma secuencia ${r.zip.secuencia ?? "?"} que ${elegido.zip.archivo}): no se usa`
          : `Secuencia ${r.zip.secuencia ?? "?"}, reemplazada por la ${elegido.zip.secuencia ?? "?"} (${elegido.zip.archivo}): no se usa`
      }
      avisos.push(`${m}: llegaron ${del.length} zips (secuencias ${del.map(r => r.zip.secuencia ?? "?").join(", ")}); se toma la ${elegido.zip.secuencia ?? "?"} — la más alta, la rectificativa — de ${elegido.zip.archivo}.`)
    }
  }
  const faltan = meses.filter(m => !porSubdiario.has(m))
  if (faltan.length) avisos.push(`Faltan los zips de ${faltan.join(", ")}: esos meses quedan fuera del cruce (la app no se compara contra nada en ellos).`)
  return { porSubdiario, faltan, revisados, avisos }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// El emparejamiento — el mismo para compras y ventas
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

interface Id { tipo: string; pv: number; nro: number | null; cuit: string; total: number }

/**
 * App ↔ ARCA, en cuatro pasos (los del armado a mano, generalizados): 1) tipo + punto de venta + número + CUIT;
 * 2) número + CUIT, si queda uno solo; 3) CUIT + mismo total, si queda uno solo (la CEG de AFA con otro número);
 * 4) CUIT, si queda uno de cada lado. Lo que no se empareja queda «de un solo lado».
 */
export function emparejar<A, P>(app: A[], arca: P[], idA: (a: A) => Id, idP: (p: P) => Id) {
  const libres = new Set(arca.map((_, i) => i))
  const pares: Array<{ a: A; p: P }> = []
  const exacto = new Map<string, number[]>()
  const k = (x: Id) => `${x.tipo}|${x.pv}|${x.nro}|${x.cuit}`
  arca.forEach((p, i) => { const kk = k(idP(p)); exacto.set(kk, [...(exacto.get(kk) ?? []), i]) })
  let sueltos: A[] = []
  for (const a of app) {
    const i = (exacto.get(k(idA(a))) ?? []).find(j => libres.has(j))
    if (i == null || idA(a).nro == null) { sueltos.push(a); continue }
    libres.delete(i); pares.push({ a, p: arca[i] })
  }
  const paso = (cond: (ia: Id, ip: Id, a: A) => boolean, unoDeCadaLado = false) => {
    const quedan: A[] = []
    for (const a of sueltos) {
      const ia = idA(a)
      const cand = [...libres].filter(j => cond(ia, idP(arca[j]), a))
      const otrosApp = unoDeCadaLado ? sueltos.filter(x => idA(x).cuit === ia.cuit).length : 1
      if (cand.length === 1 && otrosApp === 1) { libres.delete(cand[0]); pares.push({ a, p: arca[cand[0]] }) } else quedan.push(a)
    }
    sueltos = quedan
  }
  paso((ia, ip) => ia.cuit === ip.cuit && ia.nro != null && ia.nro === ip.nro)
  paso((ia, ip) => ia.cuit === ip.cuit && Math.abs(ia.total - ip.total) <= 0.01)
  paso((ia, ip) => ia.cuit === ip.cuit, true)
  return { pares, soloApp: sueltos, soloArca: [...libres].sort((x, y) => x - y).map(i => arca[i]) }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Compras
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Neto, no gravado, exento, otros, IVA, total — el orden de las columnas H..M. */
export type Imp6 = [number, number, number, number, number, number]

export interface FilaDiferencia {
  grupo: string
  subdiario: string
  fecha: string | null
  denominacion: string
  cuit: string
  compApp: string
  compArca: string
  /** ARCA − app. Compras: 6 (con otros tributos); ventas: 5 (sin). */
  dif: number[]
  modificaIva: string
  quePasa: string
  queHacer: string
  /** Ventas: el estado DDJJ IVA de la app. */
  ddjj?: string
  /** Compras: link al PDF (constante del ejercicio). */
  link?: string
  /** Para ordenar dentro del grupo. */
  orden: string
}

export const GRUPOS_COMPRAS = {
  signo: "1. Se le cambió el signo",
  otros: "2. Otros tributos que la app no tiene",
  exentoRepetido: "3. Exento repetido en Otros tributos (ARCA)",
  centavos: "4. Centavos",
  identificacion: "5. Identificación distinta",
  otroImporte: "6. Otro importe distinto",
  soloArca: "9. En ARCA y no en la app",
  soloApp: "9. En la app y no en ARCA",
}

/** Lo presentado, con la regla del cuadro: Factura C → no gravado y exento en 0 (el total va a Monotributo). */
export function importesArcaCompra(p: ComprobantePresentado): Imp6 {
  const c = p.tipo === 11
  return [r2(p.netoGravado ?? 0), c ? 0 : r2(p.noGravado ?? 0), c ? 0 : r2(p.exento ?? 0), r2(p.otrosTributos ?? 0), r2(p.iva ?? 0), r2(p.total)]
}
const importesAppCompra = (f: FilaCompraConsensuada): Imp6 => [f.neto, f.noGravado, f.exento, f.otros, f.iva, f.total]

const tipoApp = (f: FilaCompraConsensuada) => (f.tipo == null ? "" : String(f.tipo))
const identApp = (tipo: string, pv: number | null, nro: number | null) =>
  `tipo ${tipo || "(vacío)"} / PV ${pv ?? "(vacío)"} / N° ${nro ?? "(vacío)"}`
const identArca = (p: ComprobantePresentado) => `tipo ${p.tipo} / PV ${p.puntoVenta} / N° ${p.numero}`
const modificaIva = (d: number) => (d === 0 ? "No" : Math.abs(d) < 1 ? "Sí (centavos)" : "Sí")
const isoFecha = (f: string) => {
  const m = f.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : f.slice(0, 10) || null
}

/**
 * El grupo de una diferencia de compras, con reglas generales (el armado a mano las tenía atadas a Autopistas del Sol
 * y a «cualquier diferencia de total = signo»; acá cada una se comprueba con los importes).
 */
export function clasificarCompra(arca: Imp6, app: Imp6, mismaIdentificacion: boolean, nombreSigno?: string) {
  const dif = arca.map((x, i) => r2(x - app[i])) as Imp6
  const [, , , dOtros, , dTotal] = dif
  const partes = (v: Imp6) => r2(v[0] + v[1] + v[2] + v[3] + v[4])
  const todoCentavos = dif.every(x => Math.abs(x) < 1)
  let g: keyof typeof GRUPOS_COMPRAS | null = null
  if (dif.every(x => x === 0)) g = mismaIdentificacion ? null : "identificacion"
  else if (Math.abs(app[5]) >= 1 && Math.abs(arca[5] + app[5]) <= 0.01) g = "signo"
  else if (Math.abs(dTotal) < 0.01 && Math.abs(dOtros) >= 1 && arca[2] !== 0 && Math.abs((partes(arca) - arca[5]) - dOtros) <= 0.01) g = "exentoRepetido"
  else if (Math.abs(dTotal) < 0.01 && dOtros >= 1 && (app[5] - partes(app)) >= dOtros - 1) g = "otros"
  else if (todoCentavos) g = "centavos"
  else g = "otroImporte"
  if (!g) return null
  const enNegativo = app[5] < 0 ? "en la app la factura está en negativo y en lo presentado a ARCA en positivo" : "en la app la factura está en positivo y en lo presentado a ARCA en negativo"
  const textos: Record<string, [string, string]> = {
    signo: [`Se le cambió el signo: ${enNegativo} (impacto = factura x 2).`,
      "Definir el signo correcto. Si es nota de crédito, cargarla como tipo 3; si es factura, corregir la app (ARCA está bien)."],
    exentoRepetido: ["En lo presentado a ARCA el exento figura también en Otros tributos: la suma de partes supera el total.",
      "Diferencia de cómo quedó presentado en ARCA. No cambia el total ni el IVA."],
    otros: ["ARCA tiene el impuesto en Otros tributos y la app no (neto + IVA no llegan al total).",
      "Cargar el impuesto en Otros tributos en la app. No cambia el total ni el IVA."],
    centavos: ["Redondeo de centavos entre ARCA y la app.", "Sin acción (centavos)."],
    identificacion: ["Mismo comprobante e importes, pero con otro tipo, punto de venta o número.",
      "Corregir el dato en la app para que coincida con el comprobante."],
    otroImporte: ["ARCA y la app tienen otros importes en este comprobante.", "Revisar el comprobante: corregir la app o rectificar la DDJJ."],
  }
  let [que, accion] = textos[g]
  if (!mismaIdentificacion && g !== "identificacion") que += " Además cambia la identificación."
  const grupo = g === "signo" && nombreSigno ? `${GRUPOS_COMPRAS.signo} (${nombreSigno})` : GRUPOS_COMPRAS[g]
  return { grupo, dif, quePasa: que, queHacer: accion, modificaIva: modificaIva(dif[4]) }
}

const esLaFactura = (pv: number | null, nro: number | null, cuit: string, m: FacturaMarcada) =>
  pv === m.puntoVenta && nro === m.numero && dig(cuit) === dig(m.cuit)

export interface CruceCompras {
  filas: FilaDiferencia[]
  /** Totales de los dos lados (meses con zip), H..M. */
  arca: Imp6
  app: Imp6
  /** Meses que tienen alguna fila del grupo «signo» (van en naranja en el resumen). */
  mesesSigno: Set<string>
  pares: number
}

export function cruzarCompras(compras: FilaCompraConsensuada[], porSub: Map<string, ZipLibroIva>, k?: ConsensuadoDelEjercicio): CruceCompras {
  const kd = k?.diferencias?.compras
  const app = compras.filter(f => porSub.has(f.subdiario))
  const arca: Array<ComprobantePresentado & { sub: string }> = []
  for (const [sub, z] of porSub) for (const p of z.compras) arca.push({ ...p, sub })
  const { pares, soloApp, soloArca } = emparejar(app, arca,
    f => ({ tipo: tipoApp(f), pv: f.puntoVenta ?? 0, nro: f.numero, cuit: dig(f.cuit), total: f.total }),
    p => ({ tipo: String(p.tipo), pv: p.puntoVenta, nro: p.numero, cuit: dig(p.cuit), total: importesArcaCompra(p)[5] }))
  const filas: FilaDiferencia[] = []
  for (const { a, p } of pares) {
    const misma = tipoApp(a) === String(p.tipo) && (a.puntoVenta ?? 0) === p.puntoVenta && a.numero === p.numero
    const c = clasificarCompra(importesArcaCompra(p), importesAppCompra(a), misma, kd?.nombreGrupoSigno)
    if (!c) continue
    let quePasa = c.quePasa
    if (p.sub !== a.subdiario) quePasa += ` En ARCA está en el período ${p.sub}.`
    const link = c.grupo.startsWith("1.") ? kd?.links?.find(m => esLaFactura(a.puntoVenta, a.numero, a.cuit, m))?.url : undefined
    filas.push({
      grupo: c.grupo, subdiario: a.subdiario, fecha: a.fecha, denominacion: a.denominacion, cuit: a.cuit,
      compApp: identApp(tipoApp(a), a.puntoVenta, a.numero), compArca: identArca(p),
      dif: c.dif, modificaIva: c.modificaIva, quePasa, queHacer: c.queHacer, link,
      orden: `${a.fecha ?? ""}|${String(a.puntoVenta ?? 0).padStart(6, "0")}|${String(a.numero ?? 0).padStart(10, "0")}`,
    })
  }
  for (const p of soloArca) {
    const v = importesArcaCompra(p)
    filas.push({
      grupo: GRUPOS_COMPRAS.soloArca, subdiario: p.sub, fecha: isoFecha(p.fecha), denominacion: p.denominacion, cuit: p.cuit,
      compApp: "", compArca: identArca(p), dif: v, modificaIva: modificaIva(v[4]),
      quePasa: "Está presentado en ARCA y no se encontró en la app.", queHacer: "Cargarlo en la app, o rectificar la DDJJ si no corresponde.",
      orden: `${isoFecha(p.fecha) ?? ""}|${p.numero}`,
    })
  }
  for (const a of soloApp) {
    const v = importesAppCompra(a).map(x => r2(-x))
    filas.push({
      grupo: GRUPOS_COMPRAS.soloApp, subdiario: a.subdiario, fecha: a.fecha, denominacion: a.denominacion, cuit: a.cuit,
      compApp: identApp(tipoApp(a), a.puntoVenta, a.numero), compArca: "", dif: v, modificaIva: modificaIva(v[4]),
      quePasa: "Está en la app y no se encontró en lo presentado a ARCA.", queHacer: "Revisar: presentarlo (rectificativa) o sacarlo / reimputarlo en la app.",
      orden: `${a.fecha ?? ""}|${a.numero ?? 0}`,
    })
  }
  ordenarFilas(filas)
  const suma = (xs: Imp6[]) => [0, 1, 2, 3, 4, 5].map(i => r2(xs.reduce((s, x) => s + x[i], 0))) as Imp6
  return {
    filas, pares: pares.length,
    arca: suma(arca.map(importesArcaCompra)), app: suma(app.map(importesAppCompra)),
    mesesSigno: new Set(filas.filter(f => f.grupo.startsWith("1.")).map(f => f.subdiario)),
  }
}

function ordenarFilas(filas: FilaDiferencia[]) {
  filas.sort((x, y) => cmpTexto(x.grupo, y.grupo) || cmpTexto(x.subdiario, y.subdiario) || cmpTexto(x.orden, y.orden))
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Ventas
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const GRUPOS_VENTAS = {
  centavos: "1. Centavos",
  ivaGastos: "2. IVA cargado incluye el IVA de comisión/almacenaje (la app ya usa el IVA vendido)",
  identificacion: "3. Identificación distinta",
  otroImporte: "4. Otro importe distinto",
  soloArca: "9. En ARCA y no en la app",
  soloApp: "9. En la app y no en ARCA",
}

/** Una venta presentada, con el criterio DDJJ IVA: el total SIN retenciones / percepciones / pagos a cuenta. */
export interface VentaArca {
  p: ComprobantePresentado
  sub: string
  /** Neto, no gravado, exento, IVA, total sin retenciones. */
  v: [number, number, number, number, number]
  /** Lo que se restó del total («otros tributos» del CSV: retenciones, percepciones, pagos a cuenta). */
  pagosACuenta: number
  /** Nota de débito (o lo que sea) con sólo total: no entra en el cuadro. */
  soloTotal: boolean
}

/**
 * ⚠️ Se resta SIEMPRE lo que el CSV junta en «otros tributos», positivo o negativo (como `armar_ventas_arca.py`). La
 * `ventasComoLaApp` de la entrega sólo suma de vuelta los negativos: para la DDJJ IVA el total es neto + IVA, y una
 * percepción cobrada tampoco es venta.
 */
export function ventaArca(p: ComprobantePresentado, sub: string): VentaArca {
  const neto = r2(p.netoGravado ?? 0), ng = r2(p.noGravado ?? 0), ex = r2(p.exento ?? 0), iva = r2(p.iva ?? 0)
  const pac = r2(p.otrosTributos ?? 0)
  return {
    p, sub, v: [neto, ng, ex, iva, r2(p.total - pac)], pagosACuenta: pac,
    soloTotal: neto === 0 && ng === 0 && ex === 0 && iva === 0 && r2(p.total) !== 0,
  }
}

const nroDesdeComprobante = (s: string) => {
  const partes = s.split("-").map(dig).filter(Boolean)
  return partes.length ? Number(partes[partes.length - 1]) : null
}
const pvDesdeComprobante = (s: string) => {
  const partes = s.split("-").map(dig).filter(Boolean)
  return partes.length > 1 ? Number(partes[0]) : 0
}
const importesAppVenta = (f: FilaVentaConsensuada): [number, number, number, number, number] => [f.neto, f.noGravado, f.exento, f.iva, f.total]

export interface CruceVentas {
  filas: FilaDiferencia[]
  /** ARCA (sin retenciones ni lo de sólo total) y app, en los meses con zip: neto, no grav, exento, IVA, total. */
  arca: number[]
  app: number[]
  noEntra: Array<{ concepto: string; subdiario: string; cliente: string; comprobante: string; importe: number; porQue: string }>
  csvVsXml: Array<{ subdiario: string; csvNeto: number; xmlNeto: number; csvIva: number; xmlIva: number; csvExento: number; xmlExento: number }>
  ddjjDistinta: Array<{ subdiario: string; fecha: string | null; cliente: string; cuit: string; comprobante: string; ddjj: string }>
  avisos: string[]
}

export function cruzarVentas(ventas: FilaVentaConsensuada[], porSub: Map<string, ZipLibroIva>, compras: FilaCompraConsensuada[], k?: ConsensuadoDelEjercicio): CruceVentas {
  const avisos: string[] = []
  const app = ventas.filter(f => porSub.has(f.subdiario))
  const todas: VentaArca[] = []
  for (const [sub, z] of porSub) for (const p of z.ventas) todas.push(ventaArca(p, sub))
  const soloTotal = todas.filter(x => x.soloTotal)
  const arca = todas.filter(x => !x.soloTotal)
  const { pares, soloApp, soloArca } = emparejar(app, arca,
    f => ({ tipo: String(f.tipo ?? ""), pv: f.puntoVenta ?? pvDesdeComprobante(f.nroComprobante), nro: f.numero ?? nroDesdeComprobante(f.nroComprobante), cuit: dig(f.cuit), total: f.total }),
    x => ({ tipo: String(x.p.tipo), pv: x.p.puntoVenta, nro: x.p.numero, cuit: dig(x.p.cuit), total: x.v[4] }))
  const filas: FilaDiferencia[] = []
  const ordenApp = (f: FilaVentaConsensuada) => `${f.fecha ?? ""}|${String(f.tipo ?? 0).padStart(4, "0")}|${f.nroComprobante}`
  const ddjjDistinta: CruceVentas["ddjjDistinta"] = []
  for (const { a, p: x } of pares) {
    const dif = x.v.map((v, i) => r2(v - importesAppVenta(a)[i]))
    const misma = String(a.tipo ?? "") === String(x.p.tipo) && (a.puntoVenta ?? 0) === x.p.puntoVenta && a.numero != null && a.numero === x.p.numero
    const base = {
      subdiario: a.subdiario, fecha: a.fecha, denominacion: a.cliente, cuit: a.cuit, ddjj: a.ddjjIva, orden: ordenApp(a),
      compApp: `${identApp(String(a.tipo ?? ""), a.puntoVenta, a.numero)} (${a.nroComprobante})`, compArca: identArca(x.p),
    }
    const lineas: Array<[string, string, string]> = []
    if (dif.some(d => d !== 0)) {
      lineas.push(dif.every(d => Math.abs(d) < 1)
        ? [GRUPOS_VENTAS.centavos, "Redondeo de centavos entre ARCA y la app.", "Sin acción (centavos)."]
        : [GRUPOS_VENTAS.otroImporte, "ARCA y la app tienen otros importes en esta venta.", "Revisar la venta: corregir la app o rectificar la DDJJ."])
    }
    if (a.ivaGastos !== 0) {
      const alic = a.neto ? `${ars(Math.round((a.iva / a.neto) * 1000) / 10).replace(/,0+$/, "").replace(/(,\d)0$/, "$1")}% del neto` : "del neto"
      const igual = dif[3] === 0 ? "igual a lo presentado: el reporte usa ese." : `y lo presentado es ${ars(x.v[3])}.`
      lineas.push([GRUPOS_VENTAS.ivaGastos,
        `El campo IVA de la app (${ars(a.ivaCargado)}) suma el IVA de la comisión/almacenaje (${ars(a.ivaGastos)}). El IVA vendido es ${ars(a.iva)} (${alic}), ${igual}`,
        "Sin acción: la app ya toma el IVA vendido (IVA − comisión − almacenaje, regla de JMS A-BUG-1391). No corregir el campo IVA en la base."])
    }
    if (!misma) lineas.push([GRUPOS_VENTAS.identificacion, "Mismo comprobante e importes, con otro tipo o punto de venta/número en la app.",
      "Corregir el dato en la app para que coincida con el comprobante."])
    lineas.forEach(([grupo, que, hacer], i) => {
      const d = i === 0 ? dif : [0, 0, 0, 0, 0]   // el importe se cuenta una sola vez
      filas.push({ ...base, grupo, dif: d, modificaIva: modificaIva(d[3]), quePasa: que, queHacer: hacer })
    })
    if (a.ddjjIva !== "DDJJ OK") ddjjDistinta.push({ subdiario: a.subdiario, fecha: a.fecha, cliente: a.cliente, cuit: a.cuit, comprobante: `tipo ${a.tipo ?? ""} / ${a.nroComprobante}`, ddjj: a.ddjjIva })
  }
  for (const x of soloArca) filas.push({
    grupo: GRUPOS_VENTAS.soloArca, subdiario: x.sub, fecha: isoFecha(x.p.fecha), denominacion: x.p.denominacion, cuit: x.p.cuit,
    compApp: "", compArca: identArca(x.p), dif: [...x.v], modificaIva: modificaIva(x.v[3]),
    quePasa: "Está presentada en ARCA y no se encontró en la app.", queHacer: "Cargarla en la app, o rectificar la DDJJ si no corresponde.",
    ddjj: "", orden: `${isoFecha(x.p.fecha) ?? ""}|${x.p.numero}`,
  })
  for (const a of soloApp) {
    const v = importesAppVenta(a).map(x => r2(-x))
    filas.push({
      grupo: GRUPOS_VENTAS.soloApp, subdiario: a.subdiario, fecha: a.fecha, denominacion: a.cliente, cuit: a.cuit,
      compApp: `${identApp(String(a.tipo ?? ""), a.puntoVenta, a.numero)} (${a.nroComprobante})`, compArca: "", dif: v, modificaIva: modificaIva(v[3]),
      quePasa: "Está en la app y no se encontró en lo presentado a ARCA.", queHacer: "Revisar: presentarla (rectificativa) o sacarla / reimputarla en la app.",
      ddjj: a.ddjjIva, orden: ordenApp(a),
    })
  }
  ordenarFilas(filas)
  ddjjDistinta.sort((x, y) => cmpTexto(x.subdiario, y.subdiario) || cmpTexto(x.fecha ?? "", y.fecha ?? "") || cmpTexto(x.comprobante, y.comprobante))

  // Lo que no entra en el cuadro: lo de sólo total, y las retenciones / pagos a cuenta que ARCA restó del total.
  const porQueFijo = k?.diferencias?.ventas?.porQue ?? []
  const noEntra: CruceVentas["noEntra"] = []
  for (const x of soloTotal) {
    const fijo = porQueFijo.find(m => esLaFactura(x.p.puntoVenta, x.p.numero, x.p.cuit, m))
    const enCompras = compras.find(c => esLaFactura(c.puntoVenta, c.numero, c.cuit, { puntoVenta: x.p.puntoVenta, numero: x.p.numero, cuit: x.p.cuit }))
    const porQue = fijo?.texto ?? ("Comprobante con sólo total (sin neto ni IVA): se obvia."
      + (enCompras ? ` En la app está en compras (${enCompras.subdiario}, ${enCompras.cuenta || "sin cuenta"}, en ${enCompras.total >= 0 ? "positivo" : "negativo"}).` : " No está en la app."))
    // El armado a mano la llamó «nota de débito» (Genta 180-11-77393, en negativo); sin signo negativo no se le pone nombre.
    noEntra.push({ concepto: x.p.total < 0 ? "Nota de débito (sólo total)" : "Comprobante con sólo total",
      subdiario: x.sub, cliente: x.p.denominacion, comprobante: identArca(x.p), importe: r2(x.p.total), porQue })
  }
  if (fueraDeLista(porQueFijo, soloTotal)) avisos.push("Hay un «por qué» fijo del ejercicio para un comprobante que no está entre los de sólo total de los zips.")
  const conRet = pares.filter(({ p: x }) => x.pagosACuenta !== 0).map(({ a, p: x }) => ({ a, x }))
    .sort((u, w) => cmpTexto(u.a.subdiario, w.a.subdiario) || cmpTexto(u.a.fecha ?? "", w.a.fecha ?? "") || cmpTexto(u.a.nroComprobante, w.a.nroComprobante))
  for (const { a, x } of conRet) noEntra.push({
    concepto: "Retenciones / pagos a cuenta", subdiario: a.subdiario, cliente: a.cliente, comprobante: `tipo ${a.tipo ?? ""} / ${a.nroComprobante}`,
    importe: x.pagosACuenta, porQue: 'Retenciones de la liquidación: no van en la DDJJ de IVA. Ver solapa "Retenciones sufridas" del Libro Diario.',
  })

  // CSV vs XML de cada DDJJ (lo de sólo total no suma: no tiene neto, IVA ni exento).
  const csvVsXml: CruceVentas["csvVsXml"] = []
  for (const [sub, z] of [...porSub].sort((x, y) => cmpTexto(x[0], y[0]))) {
    const del = arca.filter(x => x.sub === sub)
    const t = z.totalesVentas
    if (!t) { avisos.push(`${sub}: el zip no trae libro_iva.xml con los totales de ventas; el control CSV vs XML de ese mes queda en 0.`) }
    if (t?.otrosBloques.length) avisos.push(`${sub}: el XML de ventas tiene importes en ${t.otrosBloques.join(", ")}, que este control no mira.`)
    csvVsXml.push({
      subdiario: sub,
      csvNeto: r2(del.reduce((s, x) => s + x.v[0], 0)), xmlNeto: r2(t?.netoGravadoRI ?? 0),
      csvIva: r2(del.reduce((s, x) => s + x.v[3], 0)), xmlIva: r2(t?.debitoRI ?? 0),
      csvExento: r2(del.reduce((s, x) => s + x.v[1] + x.v[2], 0)), xmlExento: r2((t?.exentoNoGravado ?? 0) - (t?.exentoNoGravadoNC ?? 0)),
    })
  }
  const suma = (xs: number[][]) => [0, 1, 2, 3, 4].map(i => r2(xs.reduce((s, x) => s + x[i], 0)))
  return { filas, arca: suma(arca.map(x => x.v)), app: suma(app.map(importesAppVenta)), noEntra, csvVsXml, ddjjDistinta, avisos }
}
const fueraDeLista = (fijos: FacturaMarcada[], soloTotal: VentaArca[]) =>
  fijos.some(m => !soloTotal.some(x => esLaFactura(x.p.puntoVenta, x.p.numero, x.p.cuit, m)))

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// El Excel
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

const L = (i: number) => XLSX.utils.encode_col(i)
const sumar = (xs: number[]) => r2(xs.reduce((s, x) => s + x, 0))
const periodoTitulo = (ej: Ejercicio) => {
  const primero = ej.subdiarios[0].anio
  return primero === ej.anioCierre ? String(primero) : `${primero}-${String(ej.anioCierre).slice(-2)}`
}

interface Bloques { detIni: number; detFin: number; tD: number; subtotales: number[] }

/** El detalle por grupo con su subtotal, y el TOTAL DIFERENCIAS EXPLICADAS. Común a compras y ventas. */
function detallePorGrupos(h: Hoja, filas: FilaDiferencia[], cols: string[], ultima: string, opciones: {
  esNaranja: (grupo: string) => boolean; textoCant: string; cuitTexto: boolean; extras: (f: FilaDiferencia, r: number) => void
}): Bloques {
  const grupos = [...new Set(filas.map(f => f.grupo))]
  let r = 5
  const subtotales: number[] = []
  for (const g of grupos) {
    const gs = r
    const del = filas.filter(f => f.grupo === g)
    for (const f of del) {
      h.texto(`A${r}`, f.grupo)
      h.textoFijo(`B${r}`, f.subdiario)
      h.fecha(`C${r}`, f.fecha)
      h.texto(`D${r}`, f.denominacion)
      if (opciones.cuitTexto) h.textoFijo(`E${r}`, f.cuit); else h.valor(`E${r}`, numOTexto(f.cuit))
      h.texto(`F${r}`, f.compApp); h.texto(`G${r}`, f.compArca)
      cols.forEach((c, i) => h.valor(`${c}${r}`, f.dif[i], IMPORTE))
      opciones.extras(f, r)
      if (opciones.esNaranja(g)) h.estilo(r, "A", ultima, fondo(COLOR.naranjaClaro))
      r++
    }
    const ge = r - 1
    h.texto(`A${r}`, `Subtotal ${g}`)
    h.formula(`C${r}`, `COUNTA(B${gs}:B${ge})&" ${opciones.textoCant}"`, `${del.length} ${opciones.textoCant}`)
    cols.forEach((c, i) => h.formula(`${c}${r}`, `SUM(${c}${gs}:${c}${ge})`, sumar(del.map(f => f.dif[i]))))
    h.estilo(r, "A", ultima, subtotal(opciones.esNaranja(g) ? COLOR.naranjaSubtotal : COLOR.azulSubtotal))
    subtotales.push(r)
    r += 2
  }
  const tD = r
  h.texto(`A${tD}`, "TOTAL DIFERENCIAS EXPLICADAS")
  cols.forEach((c, i) => h.formula(`${c}${tD}`, subtotales.length ? subtotales.map(s => `${c}${s}`).join("+") : "0", sumar(filas.map(f => f.dif[i]))))
  h.estilo(tD, "A", ultima, subtotal(COLOR.azulTotal))
  return { detIni: 5, detFin: Math.max(tD - 2, 5), tD, subtotales }
}

/** El resumen por mes: cantidad y Δ de cada subdiario (SUMIF sobre el detalle) con su TOTAL y control. */
function resumenPorMes(h: Hoja, filas: FilaDiferencia[], cols: string[], meses: string[], b: Bloques, r0: number, ultima: string,
  colIva: string, extra?: (r: number, del: FilaDiferencia[]) => void, naranja?: Set<string>) {
  const rng = (c: string) => `${c}$${b.detIni}:${c}$${b.detFin}`
  const B = `$B$${b.detIni}:$B$${b.detFin}`
  let rr = r0
  const ivaIdx = cols.indexOf(colIva)
  for (const m of meses) {
    const del = filas.filter(f => f.subdiario === m)
    h.textoFijo(`A${rr}`, m)
    h.formula(`B${rr}`, `COUNTIF(${B},$A${rr})`, del.length, CANT)
    cols.forEach((c, i) => h.formula(`${c}${rr}`, `SUMIF(${B},$A${rr},${rng(c)})`, sumar(del.map(f => f.dif[i]))))
    const iva = sumar(del.map(f => f.dif[ivaIdx]))
    const sig = L(XLSX.utils.decode_col(cols[cols.length - 1]) + 1)
    h.formula(`${sig}${rr}`, `IF(ABS(${colIva}${rr})>=1,"Sí",IF(${colIva}${rr}<>0,"Sólo centavos","No"))`, Math.abs(iva) >= 1 ? "Sí" : iva !== 0 ? "Sólo centavos" : "No")
    extra?.(rr, del)
    if (naranja?.has(m)) h.estilo(rr, "A", ultima, fondo(COLOR.naranjaSubtotal))
    rr++
  }
  const ini = r0, fin = rr - 1
  const enMeses = filas.filter(f => meses.includes(f.subdiario))
  h.texto(`A${rr}`, "TOTAL")
  h.formula(`B${rr}`, `SUM(B${ini}:B${fin})`, enMeses.length, CANT)
  cols.forEach((c, i) => h.formula(`${c}${rr}`, `SUM(${c}${ini}:${c}${fin})`, sumar(enMeses.map(f => f.dif[i]))))
  h.estilo(rr, "A", ultima, subtotal(COLOR.azulTotal))
  h.texto(`A${rr + 1}`, "Control: total del resumen - total explicado (debe dar 0)")
  cols.forEach((c, i) => h.formula(`${c}${rr + 1}`, `ROUND(${c}${rr}-${c}${b.tD},2)`, r2(sumar(enMeses.map(f => f.dif[i])) - sumar(filas.map(f => f.dif[i])))))
  h.estilo(rr + 1, "A", ultima, GRIS)
  return rr + 1
}

const COLS_COMPRAS = ["H", "I", "J", "K", "L", "M"]
const COLS_VENTAS = ["H", "I", "J", "K", "L"]

function hojaCompras(c: CruceCompras, ej: Ejercicio, empresa: string, meses: string[], k?: ConsensuadoDelEjercicio, faltan: string[] = []) {
  const kd = k?.diferencias?.compras
  const h = new Hoja()
  const conLinks = c.filas.some(f => f.link)
  const ultima = conLinks ? "Q" : "P"
  h.texto("A1", `DIFERENCIAS ENTRE LO PRESENTADO A ARCA Y LA APP - COMPRAS ${empresa} ${periodoTitulo(ej)}   (Diferencia = ARCA presentado - app)`, { font: { bold: true, sz: 13 } })
  h.texto("A2", "Para decidir la rectificación: si la diferencia modifica el IVA, se rectifica la DDJJ de IVA y el subdiario; si no lo modifica, sólo el subdiario (criterio de la app, tabla subdiario_cambios). La decisión final es del contador.", ITALICA)
  if (kd?.notaArriba && c.mesesSigno.size) h.texto("A3", kd.notaArriba, { ...NEGRITA, ...fondo(COLOR.naranjaClaro) })
  ;["Grupo", "Subdiario", "Fecha", "Denominación", "CUIT", "Comprobante en la app", "Comprobante en ARCA", "Δ Neto Gravado", "Δ No Gravado",
    "Δ Exentas", "Δ Otros Tributos", "Δ IVA", "Δ Total", "¿Modifica IVA?", "Qué pasa", "Qué hay que hacer", ...(conLinks ? ["Factura (PDF)"] : [])]
    .forEach((t, i) => h.texto(`${L(i)}4`, t))
  h.estilo(4, "A", ultima, ENCABEZADO_OSCURO)
  const ARRIBA = { alignment: { vertical: "top" } }
  const b = detallePorGrupos(h, c.filas, COLS_COMPRAS, "P", {
    esNaranja: g => g.startsWith("1."), textoCant: "comprobantes", cuitTexto: false,
    extras: (f, r) => {
      h.texto(`N${r}`, f.modificaIva); h.texto(`O${r}`, f.quePasa); h.texto(`P${r}`, f.queHacer)
      h.estilo(r, "A", "P", ARRIBA); h.estilo(r, "O", "P", { alignment: { wrapText: true, vertical: "top" } })
      if (f.link) {
        h.texto(`Q${r}`, "Ver factura (Drive)", { font: { color: { rgb: "0563C1" }, underline: true } })
        ;(h.ws[`Q${r}`] as XLSX.CellObject).l = { Target: f.link, Tooltip: "Abrir la factura en Google Drive" }
      }
    },
  })
  // Control contra lo presentado: ARCA (los zips) − app (la fila TOTAL de Compras del Libro Diario).
  const k1 = b.tD + 2
  const etqMeses = faltan.length ? ` — sólo los meses con zip (faltan ${faltan.join(", ")})` : ""
  h.texto(`A${k1}`, `ARCA presentado (libro IVA de los zips)${etqMeses}`)
  h.texto(`A${k1 + 1}`, `App (Libro Diario de compras, fila TOTAL de Comprobantes)${etqMeses}`)
  COLS_COMPRAS.forEach((col, i) => { h.valor(`${col}${k1}`, c.arca[i], IMPORTE); h.valor(`${col}${k1 + 1}`, c.app[i], IMPORTE) })
  h.texto(`A${k1 + 2}`, "ARCA - app", NEGRITA)
  h.texto(`A${k1 + 3}`, "Control: total explicado - (ARCA - app)  (debe dar 0)")
  const explicado = COLS_COMPRAS.map((_, i) => sumar(c.filas.map(f => f.dif[i])))
  const control: number[] = []
  COLS_COMPRAS.forEach((col, i) => {
    const d = r2(c.arca[i] - c.app[i])
    h.formula(`${col}${k1 + 2}`, `ROUND(${col}${k1}-${col}${k1 + 1},2)`, d)
    control.push(r2(explicado[i] - d))
    h.formula(`${col}${k1 + 3}`, `ROUND(${col}${b.tD}-${col}${k1 + 2},2)`, control[i])
  })
  h.estiloLlenas(k1 + 3, "A", "P", ITALICA)
  // Resumen por mes.
  const rm = k1 + 6
  h.texto(`A${rm}`, "RESUMEN POR MES (para ver qué subdiario / DDJJ habría que rectificar)", NEGRITA)
  const hm: Record<string, string> = { A: "Subdiario", B: "Cant.", H: "Δ Neto Gravado", I: "Δ No Gravado", J: "Δ Exentas", K: "Δ Otros Tributos", L: "Δ IVA", M: "Δ Total", N: "¿Modifica IVA?", O: "Diferencias de importe" }
  for (const [col, t] of Object.entries(hm)) h.texto(`${col}${rm + 1}`, t)
  h.estilo(rm + 1, "A", "P", ENCABEZADO_OSCURO)
  const fin = resumenPorMes(h, c.filas, COLS_COMPRAS, meses, b, rm + 2, "P", "L", (rr, del) => {
    const s = (i: number) => sumar(del.map(f => f.dif[i]))
    const v = Math.abs(s(5)) >= 1 ? "Cambia el total del mes" : Math.abs(s(2)) + Math.abs(s(3)) >= 1 ? "Cambian conceptos, no el total" : del.length > 0 ? "Sólo centavos o identificación" : "Sin diferencias"
    h.formula(`O${rr}`, `IF(ABS(M${rr})>=1,"Cambia el total del mes",IF(ABS(J${rr})+ABS(K${rr})>=1,"Cambian conceptos, no el total",IF(B${rr}>0,"Sólo centavos o identificación","Sin diferencias")))`, v)
  }, c.mesesSigno)
  h.estiloLlenas(fin, "A", "P", ITALICA)
  // ➕ (no estaba en el armado a mano) Lo leído de los zips contra la fila ARCA del cuadro consensuado.
  let controlConsensuado: number[] | null = null
  if (kd?.arcaConsensuado && !faltan.length) {
    const q = fin + 3
    const a = kd.arcaConsensuado
    const v = [a.neto, a.noGravado, a.exento, a.otros, a.iva, a.total]
    h.texto(`A${q}`, "CONTROL: LO LEÍDO DE LOS ZIPS vs LA FILA ARCA DEL CUADRO CONSENSUADO", NEGRITA)
    h.texto(`A${q + 1}`, "ARCA presentado (cuadro consensuado)")
    h.texto(`A${q + 2}`, "Control: ARCA de los zips - cuadro consensuado (debe dar 0)")
    controlConsensuado = []
    COLS_COMPRAS.forEach((col, i) => {
      h.valor(`${col}${q + 1}`, v[i], IMPORTE)
      controlConsensuado!.push(r2(c.arca[i] - v[i]))
      h.formula(`${col}${q + 2}`, `ROUND(${col}${k1}-${col}${q + 1},2)`, controlConsensuado![i])
    })
    h.estilo(q + 2, "A", "P", GRIS)
  }
  const anchos: Record<string, number> = { A: 34.71, B: 10.71, C: 11.71, D: 38.71, E: 13.71, F: 30.71, G: 30.71, H: 14.71, I: 14.71, J: 14.71, K: 14.71, L: 14.71, M: 14.71, N: 14.71, O: 60.71, P: 60.71 }
  if (conLinks) anchos.Q = 18.71
  return { ws: h.cerrar(anchos, { 4: 32 }), explicado, control, controlConsensuado, tD: b.tD }
}

function hojaVentas(c: CruceVentas, ej: Ejercicio, empresa: string, meses: string[], faltan: string[] = []) {
  const h = new Hoja()
  const N = ["neto", "no gravado", "exento", "IVA", "total"]
  const dif = c.arca.map((x, i) => r2(x - c.app[i]))
  const difAlgoMas = (v: number[]) => r2(v[4] - (v[0] + v[1] + v[2] + v[3]))
  h.texto("A1", `DIFERENCIAS ENTRE LO PRESENTADO A ARCA Y LA APP - VENTAS ${empresa} ${periodoTitulo(ej)}   (Diferencia = ARCA presentado - app)`, { font: { bold: true, sz: 13 } })
  h.texto("A2", "Criterio DDJJ IVA ventas: Neto (gravado / no gravado / exento), IVA vendido y Total. Sin retenciones; se obvia la nota de débito con sólo total.", ITALICA)
  const coincide = dif.every(d => Math.abs(d) < 1) && !c.filas.some(f => f.grupo.startsWith("9."))
  const centavos = dif.map((d, i) => (d !== 0 ? `${ars(Math.abs(d))} de ${N[i]}` : "")).filter(Boolean)
  h.texto("A3", coincide
    ? `Resultado: la app coincide con lo presentado a ARCA${centavos.length ? ` (sólo ${centavos.join(", ")} por redondeo)` : ""}. Lo que sigue son datos a corregir en la app; no hay nada para rectificar en ARCA.`
    : "Resultado: la app NO coincide con lo presentado a ARCA: ver las diferencias de importe y el cuadro de control.", NEGRITA)
  ;["Grupo", "Subdiario", "Fecha", "Cliente", "CUIT", "Comprobante en la app", "Comprobante en ARCA", "Δ Neto Gravado", "Δ No Gravado",
    "Δ Exentas", "Δ IVA", "Δ Total", "¿Modifica IVA?", "Qué pasa", "Qué hay que hacer", "DDJJ IVA en la app"].forEach((t, i) => h.texto(`${L(i)}4`, t))
  h.estilo(4, "A", "P", ENCABEZADO_OSCURO)
  const b = detallePorGrupos(h, c.filas, COLS_VENTAS, "P", {
    esNaranja: g => g.startsWith("2."), textoCant: "comprobante(s)", cuitTexto: true,
    extras: (f, r) => {
      h.texto(`M${r}`, f.modificaIva); h.texto(`N${r}`, f.quePasa); h.texto(`O${r}`, f.queHacer); h.texto(`P${r}`, f.ddjj)
      h.estilo(r, "A", "P", { alignment: { vertical: "top" } }); h.estilo(r, "N", "O", { alignment: { wrapText: true, vertical: "top" } })
    },
  })
  // Cuadro de control.
  const k1 = b.tD + 3
  h.texto(`A${k1 - 1}`, "CUADRO DE CONTROL VENTAS - criterio DDJJ IVA (ARCA vs Sistema)", NEGRITA)
  ;["Neto Gravado", "No Gravado", "Exentas", "IVA", "Total", "Dif. de algo más"].forEach((t, i) => h.texto(`${L(7 + i)}${k1}`, t))
  h.estilo(k1, "A", "M", ENCABEZADO_OSCURO)
  const etqMeses = faltan.length ? ` — sólo los meses con zip (faltan ${faltan.join(", ")})` : ""
  h.texto(`A${k1 + 1}`, `de ARCA (CSV = XML de cada DDJJ, sin retenciones ni la nota de débito)${etqMeses}`)
  h.texto(`A${k1 + 2}`, `Sistema (Libro Diario de ventas, fila TOTAL)${etqMeses}`)
  for (const [q, v] of [[1, c.arca], [2, c.app]] as const) {
    COLS_VENTAS.forEach((col, i) => h.valor(`${col}${k1 + q}`, v[i], IMPORTE))
    h.formula(`M${k1 + q}`, `ROUND(L${k1 + q}-SUM(H${k1 + q}:K${k1 + q}),2)`, difAlgoMas(v))
  }
  h.estilo(k1 + 1, "A", "M", fondo(COLOR.gris)); h.estilo(k1 + 2, "A", "M", fondo(COLOR.gris))
  h.texto(`A${k1 + 3}`, "Diferencia (ARCA - Sistema)")
  ;[...COLS_VENTAS, "M"].forEach((col, i) => h.formula(`${col}${k1 + 3}`, `ROUND(${col}${k1 + 1}-${col}${k1 + 2},2)`, i < 5 ? dif[i] : r2(difAlgoMas(c.arca) - difAlgoMas(c.app))))
  h.estiloLlenas(k1 + 3, "A", "M", NEGRITA)
  h.texto(`A${k1 + 4}`, "Control: total explicado - diferencia (debe dar 0)")
  const explicado = COLS_VENTAS.map((_, i) => sumar(c.filas.map(f => f.dif[i])))
  const control = COLS_VENTAS.map((col, i) => {
    const v = r2(explicado[i] - dif[i])
    h.formula(`${col}${k1 + 4}`, `ROUND(${col}${b.tD}-${col}${k1 + 3},2)`, v)
    return v
  })
  h.estilo(k1 + 4, "A", "M", GRIS)
  // No entra en el cuadro.
  const ke = k1 + 7
  h.texto(`A${ke}`, "NO ENTRA EN EL CUADRO (presentado en ARCA pero no es neto / IVA / total de la DDJJ)", NEGRITA)
  for (const [col, t] of Object.entries({ A: "Concepto", B: "Subdiario", D: "Cliente", F: "Comprobante", L: "Importe en ARCA", N: "Por qué" })) h.texto(`${col}${ke + 1}`, t)
  h.estilo(ke + 1, "A", "P", ENCABEZADO_OSCURO)
  let re = ke + 2
  for (const x of c.noEntra) {
    h.texto(`A${re}`, x.concepto); h.textoFijo(`B${re}`, x.subdiario); h.texto(`D${re}`, x.cliente); h.texto(`F${re}`, x.comprobante)
    h.valor(`L${re}`, x.importe, IMPORTE); h.texto(`N${re}`, x.porQue)
    re++
  }
  // Resumen por mes.
  const rm = re + 2
  h.texto(`A${rm}`, "RESUMEN POR MES", NEGRITA)
  for (const [col, t] of Object.entries({ A: "Subdiario", B: "Cant.", H: "Δ Neto Gravado", I: "Δ No Gravado", J: "Δ Exentas", K: "Δ IVA", L: "Δ Total", M: "¿Modifica IVA?" })) h.texto(`${col}${rm + 1}`, t)
  h.estilo(rm + 1, "A", "P", ENCABEZADO_OSCURO)
  const fin = resumenPorMes(h, c.filas, COLS_VENTAS, meses, b, rm + 2, "P", "K")
  // CSV vs XML.
  const rx = fin + 3
  h.texto(`A${rx}`, "CONTROL: CSV DE VENTAS vs XML DE CADA DDJJ (lo que se presentó)", NEGRITA)
  for (const [col, t] of Object.entries({ A: "Subdiario", H: "CSV: neto gravado", I: "XML: neto gravado RI", J: "CSV: IVA", K: "XML: IVA liquidado", L: "CSV: exento + no grav.", M: "XML: exento / no grav.", N: "Diferencia" })) h.texto(`${col}${rx + 1}`, t)
  h.estilo(rx + 1, "A", "N", ENCABEZADO_OSCURO)
  let rz = rx + 2
  const xmlDif: number[] = []
  for (const x of c.csvVsXml) {
    h.textoFijo(`A${rz}`, x.subdiario)
    const v = [x.csvNeto, x.xmlNeto, x.csvIva, x.xmlIva, x.csvExento, x.xmlExento]
    v.forEach((n, i) => h.valor(`${L(7 + i)}${rz}`, n, IMPORTE))
    const d = r2((v[0] - v[1]) + (v[2] - v[3]) + (v[4] - v[5]))
    xmlDif.push(d)
    h.formula(`N${rz}`, `ROUND((H${rz}-I${rz})+(J${rz}-K${rz})+(L${rz}-M${rz}),2)`, d)
    rz++
  }
  h.texto(`A${rz}`, "TOTAL")
  ;["H", "I", "J", "K", "L", "M", "N"].forEach((col, i) => {
    const vals = c.csvVsXml.map(x => [x.csvNeto, x.xmlNeto, x.csvIva, x.xmlIva, x.csvExento, x.xmlExento][i] ?? 0)
    h.formula(`${col}${rz}`, `SUM(${col}${rx + 2}:${col}${rz - 1})`, i < 6 ? sumar(vals) : sumar(xmlDif))
  })
  h.estilo(rz, "A", "N", subtotal(COLOR.azulTotal))
  // DDJJ IVA desactualizada en la app.
  const ry = rz + 3
  h.texto(`A${ry}`, 'PRESENTADOS EN ARCA QUE EN LA APP FIGURAN CON DDJJ IVA DISTINTO DE "DDJJ OK" (actualizar el estado en la app)', NEGRITA)
  for (const [col, t] of Object.entries({ A: "Subdiario", C: "Fecha", D: "Cliente", E: "CUIT", F: "Comprobante en la app", G: "DDJJ IVA en la app" })) h.texto(`${col}${ry + 1}`, t)
  h.estilo(ry + 1, "A", "G", ENCABEZADO_OSCURO)
  let rq = ry + 2
  for (const x of c.ddjjDistinta) {
    h.textoFijo(`A${rq}`, x.subdiario); h.fecha(`C${rq}`, x.fecha); h.texto(`D${rq}`, x.cliente); h.textoFijo(`E${rq}`, x.cuit)
    h.texto(`F${rq}`, x.comprobante); h.texto(`G${rq}`, x.ddjj || "(vacío)")
    rq++
  }
  if (!c.ddjjDistinta.length) h.texto(`A${rq}`, "Ninguno.", GRIS)
  const ws = h.cerrar({ A: 40.71, B: 10.71, C: 11.71, D: 36.71, E: 13.71, F: 34.71, G: 26.71, H: 15.71, I: 15.71, J: 15.71, K: 15.71, L: 15.71, M: 14.71, N: 60.71, O: 55.71, P: 12.71 }, { 4: 32 })
  return { ws, explicado, control, dif, csvVsXml: sumar(xmlDif) }
}

function hojaZips(v: ValidacionZips, ej: Ejercicio, empresa: string, avisos: string[]) {
  const h = new Hoja()
  h.texto("A1", `ZIPS DEL LIBRO IVA DE ARCA - ${empresa} ${periodoTitulo(ej)}`, { font: { bold: true, sz: 13 } })
  h.texto("A2", "Lo que se leyó para las otras dos solapas: un zip por mes; si un mes vino repetido, vale la secuencia más alta (la rectificativa).", ITALICA)
  ;["Archivo", "Período", "Secuencia", "Compras (renglones)", "Ventas (renglones)", "¿Se usa?", "Por qué"].forEach((t, i) => h.texto(`${L(i)}4`, t))
  h.estilo(4, "A", "G", ENCABEZADO_OSCURO)
  let r = 5
  const orden = [...v.revisados].sort((x, y) => cmpTexto(x.subdiario ?? "~", y.subdiario ?? "~") || cmpTexto(x.zip.archivo, y.zip.archivo))
  for (const x of orden) {
    h.texto(`A${r}`, x.zip.archivo)
    if (x.subdiario) h.textoFijo(`B${r}`, x.subdiario)
    h.valor(`C${r}`, x.zip.secuencia, CANT)
    h.valor(`D${r}`, x.zip.compras.length, CANT); h.valor(`E${r}`, x.zip.ventas.length, CANT)
    h.texto(`F${r}`, x.usado ? "Sí" : "No"); h.texto(`G${r}`, x.motivo)
    if (!x.usado) h.estilo(r, "A", "G", fondo(COLOR.naranjaClaro))
    r++
  }
  r++
  const meses = ej.subdiarios.map(s => claveSubdiario(s.anio, s.mes))
  h.texto(`A${r}`, v.faltan.length ? `⚠️ Meses del ejercicio SIN zip: ${v.faltan.join(", ")} — quedan fuera del cruce.` : `✓ Están los ${meses.length} meses del ejercicio.`,
    v.faltan.length ? { font: { bold: true, color: { rgb: "A12B2B" } } } : NEGRITA)
  r += 2
  if (avisos.length) {
    h.texto(`A${r}`, "Avisos", NEGRITA); r++
    for (const a of avisos) { h.texto(`A${r}`, a); r++ }
  }
  return h.cerrar({ A: 44.71, B: 10.71, C: 10.71, D: 12.71, E: 12.71, F: 9.71, G: 70.71 }, { 4: 32 })
}

// ─────────────────────────────── El libro ───────────────────────────────

export interface ResumenDiferencias {
  compras: { filas: number; porGrupo: Record<string, number>; explicado: number[]; control: number[]; controlConsensuado: number[] | null; pares: number }
  ventas: { filas: number; porGrupo: Record<string, number>; explicado: number[]; control: number[]; dif: number[]; noEntra: number; csvVsXml: number }
  zips: { usados: number; faltan: string[]; descartados: number }
  avisos: string[]
}

export interface LibroDiferencias { wb: XLSX.WorkBook; vistas: Vista[]; resumen: ResumenDiferencias }

const porGrupo = (filas: FilaDiferencia[]) => filas.reduce<Record<string, number>>((m, f) => ({ ...m, [f.grupo]: (m[f.grupo] ?? 0) + 1 }), {})

/** Arma el libro de tres solapas desde el libro ya armado y los zips leídos. */
export function armarDiferenciasVsArca(libro: LibroDiario, empresa: string, zips: ZipLibroIva[]): LibroDiferencias {
  const ej = libro.ejercicio
  const k = LIBRO_DIARIO_CONSENSUADO[empresa]?.[ej.anioCierre]
  const v = validarZips(zips, ej)
  const meses = ej.subdiarios.map(s => claveSubdiario(s.anio, s.mes))
  const compras = filasComprasConsensuado(libro.compras).filter(f => meses.includes(f.subdiario))
  const ventas = filasVentasConsensuado(libro.ventas).filter(f => meses.includes(f.subdiario))
  const cc = cruzarCompras(compras, v.porSubdiario, k)
  const cv = cruzarVentas(ventas, v.porSubdiario, compras, k)
  const avisos = [...v.avisos, ...cv.avisos]
  const wb = XLSX.utils.book_new()
  const hc = hojaCompras(cc, ej, empresa, meses, k, v.faltan)
  XLSX.utils.book_append_sheet(wb, hc.ws, "Compras - Diferencias")
  const hv = hojaVentas(cv, ej, empresa, meses, v.faltan)
  XLSX.utils.book_append_sheet(wb, hv.ws, "Ventas - Diferencias")
  if (hc.control.some(x => x !== 0)) avisos.push(`Compras: el total explicado no cierra contra ARCA − app (${hc.control.map(ars).join(" · ")}).`)
  if (hv.control.some(x => x !== 0)) avisos.push(`Ventas: el total explicado no cierra contra ARCA − app (${hv.control.map(ars).join(" · ")}).`)
  if (hc.controlConsensuado?.some(x => x !== 0)) avisos.push(`Compras: lo leído de los zips no coincide con la fila ARCA del cuadro consensuado (${hc.controlConsensuado.map(ars).join(" · ")}).`)
  if (hv.csvVsXml !== 0) avisos.push(`Ventas: el CSV no coincide con el XML de las DDJJ (${ars(hv.csvVsXml)}).`)
  XLSX.utils.book_append_sheet(wb, hojaZips(v, ej, empresa, avisos), "Zips de ARCA")
  return {
    wb,
    vistas: [{ congelarFilas: 4, sinCuadricula: true }, { congelarFilas: 4, sinCuadricula: true }, { sinCuadricula: true }],
    resumen: {
      compras: { filas: cc.filas.length, porGrupo: porGrupo(cc.filas), explicado: hc.explicado, control: hc.control, controlConsensuado: hc.controlConsensuado, pares: cc.pares },
      ventas: { filas: cv.filas.length, porGrupo: porGrupo(cv.filas), explicado: hv.explicado, control: hv.control, dif: hv.dif, noEntra: cv.noEntra.length, csvVsXml: hv.csvVsXml },
      zips: { usados: v.porSubdiario.size, faltan: v.faltan, descartados: v.revisados.filter(r => !r.usado).length },
      avisos,
    },
  }
}

export async function bytesDiferenciasVsArca(l: LibroDiferencias): Promise<Uint8Array> {
  const out = XLSX.write(l.wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer
  return aplicarVistas(out, l.vistas)
}

/** `Diferencias_vs_ARCA_MSA_25-26_2026-10-28.xlsx` — el día en hora argentina. */
export function nombreArchivoDiferencias(libro: LibroDiario, empresa: string, hoy: string): string {
  return `Diferencias_vs_ARCA_${empresa}_${libro.ejercicio.etiqueta.replace("/", "-")}_${hoy}.xlsx`
}

/** Lee los zips elegidos, arma el libro y lo baja. Devuelve el resumen (con los avisos, para mostrarlos). */
export async function descargarDiferenciasVsArca(libro: LibroDiario, empresa: string, archivos: File[]): Promise<ResumenDiferencias> {
  const zips: ZipLibroIva[] = []
  for (const f of archivos) {
    try { zips.push(await leerZipParaDiferencias(f.name, await f.arrayBuffer())) }
    catch (e) { throw new Error(`${f.name}: no se pudo leer como zip del libro IVA (${(e as Error).message})`) }
  }
  const l = armarDiferenciasVsArca(libro, empresa, zips)
  const bytes = await bytesDiferenciasVsArca(l)
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivoDiferencias(libro, empresa, hoyArgentina())
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, ESPERA_ANTES_DE_LIBERAR_MS)
  return l.resumen
}
