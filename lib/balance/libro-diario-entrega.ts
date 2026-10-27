/**
 * 📒 EL LIBRO DIARIO PARA ENTREGAR — un Excel APARTE de los papeles de trabajo (A-FEAT-1388, ronda 3).
 *
 * El formato lo fijó el usuario en su hoja «Libro Diario Objetivo de report» (27/10):
 * *«sería un archivo Excel separado · precisamos los 24 subdiarios (si están en cero no hacer export en cero) con
 * todas las columnas · luego la planilla de todas las compras y ventas (separado) ordenadas por fecha, con totales
 * por columna: deben coincidir · luego los subtotales por mes por cuenta con sus columnas: deben coincidir · los de
 * campaña por cuenta con sus columnas: deben coincidir · contra Excel de ARCA y presentaciones: debe coincidir · los
 * errores de imputación FC × NC en subdiarios deben dar warning acá para no informar sino rectificar antes»*.
 * Y en la misma sesión: *«esto debe evidenciar el error de diciembre y de las dos NC cargadas mal de Federación
 * Patronal (dif entre papel y lo cargado; igual entre lo cargado y lo declarado)»*.
 *
 * ## 🧮 Es UNA cadena: el mismo número por cinco caminos
 * Los 12 subdiarios → la planilla por fecha → por mes y cuenta → por campaña y cuenta → lo presentado a ARCA.
 * Las cuatro primeras salen de los MISMOS comprobantes, así que tienen que dar igual al centavo, columna por
 * columna: si no, el armado perdió algo (integridad, § 🚦). La quinta es otro papel (lo que se declaró): una
 * diferencia ahí es un mes a rectificar o reimputar, y se dice cuál y por qué.
 *
 * ## 📄 Y tres versiones de cada comprobante: el PAPEL, lo CARGADO y lo DECLARADO
 * Lo cargado contra lo declarado sale de los zips del libro IVA. Lo cargado contra el papel sale de donde la app
 * leyó el PDF — hoy los endosos de Pólizas. Las dos NC de Federación son el caso: cargado = declarado (las dos
 * mal) y distinto del papel. Tipo y signo están parejos en toda la base, así que **sólo se ven contra el papel**.
 *
 * Las mismas cuentas que la app (`armarLibroDiario`, `armarLibroPorCuenta`, `compararSubdiarioConLibro`): este
 * archivo sólo las presenta. Nunca se niega a generar: lo que está mal se dice en la cara (hoja Control) y se marca
 * en rojo donde está.
 */
import XLSX from "xlsx-js-style"
import type { LibroDiario, AsientoLibroDiario } from "./libro-diario"
import { claveSubdiario, nombreSubdiario } from "./ejercicio"
import { armarLibroPorCuenta, TIPOS_SIN_CREDITO_VENTAS, SIN_IMPUTAR, type LibroPorCuenta } from "./libro-por-cuenta"
import { TIPOS_SIN_CREDITO_COMPRAS, type Descuadre } from "@/lib/subdiarios/cuadratura"
import {
  compararSubdiarioConLibro, type ComprobantePresentado, type ResultadoContraPresentado, type FacturaParaComparar,
} from "@/lib/subdiarios/libro-presentado"
import {
  agregarHoja, hojaPorCuenta, conEstilo, ESTILO_ERROR, ESTILO_SUBTOTAL, ESTILO_TOTAL, marcaDescuadre,
  COLS_POR_CUENTA, COLS_POR_CUENTA_VENTAS,
} from "./export-libro-diario"
import { conFormula, MONEDA, ENTERO, TONELADAS, FECHA, type Columna } from "./formato-excel"

export type Lado = "compras" | "ventas"

/** Lo presentado a ARCA de UN mes (el zip del libro IVA), compras y ventas. */
export interface LoPresentado { compras: ComprobantePresentado[]; ventas: ComprobantePresentado[] }

/** Lo que dice el PAPEL de un comprobante cargado — hoy, el endoso de Pólizas leído del PDF. */
export interface PapelDelComprobante {
  comprobanteId: string
  /** De dónde sale: «Póliza 670821 · endoso 1». */
  origen: string
  total: number
  esNotaCredito: boolean
}

export interface DatosEntrega {
  libro: LibroDiario
  empresa: string
  /** Por subdiario (`2025-07`). Un mes sin zip = sin dato de lo presentado (se dice, no se asume). */
  presentado?: Record<string, LoPresentado>
  papeles?: PapelDelComprobante[]
  /** Fecha y hora para el encabezado. */
  generado?: string
}

const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000
const TOL = 0.05
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Las notas de crédito de ARCA (A, B, C, M, E y las de FCE MiPyME). */
const TIPOS_NC = [3, 8, 13, 53, 113, 203, 208, 213]

const tiposSinCredito = (lado: Lado) => (lado === "compras" ? TIPOS_SIN_CREDITO_COMPRAS : TIPOS_SIN_CREDITO_VENTAS)

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 🧮 LA LÓGICA (pura, con casos en `npm run probar`)
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Las columnas de un comprobante, partidas como en el libro por cuenta: una B o C va entera a «sin crédito». */
export interface Partes {
  netoGravado: number; noGravado: number; exento: number; otrosTributos: number; iva: number; sinCredito: number; total: number
}
export function partesDe(a: AsientoLibroDiario, lado: Lado): Partes {
  if (a.tipo != null && tiposSinCredito(lado).includes(Number(a.tipo))) {
    return { netoGravado: 0, noGravado: 0, exento: 0, otrosTributos: 0, iva: 0, sinCredito: a.total, total: a.total }
  }
  return {
    netoGravado: a.neto_gravado, noGravado: a.no_gravado, exento: a.exento,
    otrosTributos: a.otros_tributos, iva: a.iva, sinCredito: 0, total: a.total,
  }
}

export interface Totales extends Partes { comprobantes: number }
const COLUMNAS: (keyof Partes)[] = ["netoGravado", "noGravado", "exento", "otrosTributos", "iva", "sinCredito", "total"]
export function sumar(asientos: AsientoLibroDiario[], lado: Lado): Totales {
  const t: Totales = { comprobantes: 0, netoGravado: 0, noGravado: 0, exento: 0, otrosTributos: 0, iva: 0, sinCredito: 0, total: 0 }
  for (const a of asientos) {
    const p = partesDe(a, lado)
    t.comprobantes += 1
    for (const c of COLUMNAS) t[c] += p[c]
  }
  for (const c of COLUMNAS) t[c] = r2(t[c])
  return t
}

const porFecha = (a: AsientoLibroDiario, b: AsientoLibroDiario) =>
  (a.fecha ?? "").localeCompare(b.fecha ?? "") || (a.punto_venta ?? 0) - (b.punto_venta ?? 0) || (a.numero ?? 0) - (b.numero ?? 0)

const aComparar = (a: AsientoLibroDiario): FacturaParaComparar => ({
  id: a.id, tipo_comprobante: a.tipo, punto_venta: a.punto_venta, numero_desde: a.numero,
  cuit: a.cuit, denominacion_emisor: a.denominacion, fecha_emision: a.fecha,
  // El asiento ya viene en pesos (los de otra moneda, convertidos con su cotización).
  imp_total: a.total, iva: a.iva, tipo_cambio: 1,
})

/** Un subdiario del ejercicio, de un lado, con su comparación contra lo presentado. */
export interface SubdiarioDelLado {
  clave: string
  nombre: string
  asientos: AsientoLibroDiario[]
  totales: Totales
  /** `null` = no hay zip de ese mes: no se controló. */
  contra: ResultadoContraPresentado | null
  /**
   * 🧾 El IVA de la app contra el «Total IVA» del libro presentado — lo mismo contra lo mismo.
   * ⚠️ NO el «crédito fiscal computable»: en jul y nov 2025 la DDJJ lo tomó GLOBAL (la columna por comprobante viene
   * en 0 y el total está sólo en el XML), y en mayo 2026 difiere del IVA por decisión del contador. Comparar contra
   * eso daba tres meses «con error» que no lo eran.
   */
  iva: { app: number; declarado: number | null }
  /** ¿Coincide con lo declarado? `null` = no se controló (no hay zip). */
  ok: boolean | null
}

/** Un comprobante cuyo papel dice otra cosa que lo cargado. */
export interface PapelDistinto {
  asiento: AsientoLibroDiario
  papel: PapelDelComprobante
  /** Lo declarado de ese comprobante (`undefined` = el mes no tiene zip; `null` = no figura en lo declarado). */
  declarado: ComprobantePresentado | null | undefined
  /** papel − cargado: lo que el resultado tiene de más (negativo = gasto de más en compras). */
  diferencia: number
}

/** Un comprobante cuyo tipo dice una cosa y el signo otra (NC en positivo, factura en negativo). */
export interface TipoSignoCruzado { asiento: AsientoLibroDiario; lado: Lado; motivo: string }

export interface AnalisisEntrega {
  compras: SubdiarioDelLado[]
  ventas: SubdiarioDelLado[]
  porCuenta: { compras: LibroPorCuenta; ventas: LibroPorCuenta }
  papelDistinto: PapelDistinto[]
  tipoSigno: TipoSignoCruzado[]
  /** Los subdiarios (`2025-12`) que hay que rectificar con el contador o reimputar, y por qué. */
  aRectificar: { clave: string; nombre: string; motivos: string[] }[]
  /**
   * 🔢 El mismo comprobante y el mismo importe que lo declarado, con otro tipo o número en la app. No cambia
   * ningún monto: es la carga de la app la que hay que corregir (no se rectifica nada con el contador).
   */
  otroNumero: { lado: Lado; clave: string; nombre: string; app: FacturaParaComparar; presentado: ComprobantePresentado }[]
  /** Comprobantes cuyas partes no suman su total (los mismos del Control de los papeles). */
  descuadres: { compras: Descuadre[]; ventas: Descuadre[] }
  /** ¿Se puede informar? Sólo lo frena un ERROR; lo que falta imputar es pendiente (va aparte). */
  sePuedeInformar: boolean
}

export function analizarEntrega(d: DatosEntrega): AnalisisEntrega {
  const { libro } = d
  const lado = (l: Lado): SubdiarioDelLado[] => libro.ejercicio.subdiarios.map(s => {
    const clave = claveSubdiario(s.anio, s.mes)
    const asientos = (l === "compras" ? libro.compras : libro.ventas).filter(a => a.subdiario === clave).sort(porFecha)
    const pres = d.presentado?.[clave]
    const contra = pres ? compararSubdiarioConLibro(asientos.map(aComparar), pres[l], tiposSinCredito(l)) : null
    const iva = {
      app: r2(asientos.reduce((t, a) => t + a.iva, 0)),
      declarado: pres ? r2(pres[l].reduce((t, p) => t + (p.iva ?? 0), 0)) : null,
    }
    const ok = !contra ? null
      : !contra.soloApp.length && !contra.soloPresentado.length && !contra.importeDistinto.length
        && !contra.otroNumero.some(x => Math.abs(x.diferencia) > TOL)
        && Math.abs(contra.totales.diferencia.total) <= TOL && Math.abs(iva.app - (iva.declarado ?? 0)) <= TOL
    return { clave, nombre: nombreSubdiario(s), asientos, totales: sumar(asientos, l), contra, iva, ok }
  })
  const compras = lado("compras"), ventas = lado("ventas")

  // 📄 Papel contra lo cargado: sólo los que el papel conoce (los endosos de Pólizas tienen comprobante vinculado).
  const papelPorId = new Map((d.papeles ?? []).map(p => [p.comprobanteId, p]))
  const papelDistinto: PapelDistinto[] = []
  for (const s of compras) {
    for (const a of s.asientos) {
      const p = papelPorId.get(a.id)
      if (!p || Math.abs(p.total - a.total) <= TOL) continue
      papelDistinto.push({
        asiento: a, papel: p,
        declarado: s.contra ? s.contra.pares.get(a.id) ?? null : undefined,
        diferencia: r2(p.total - a.total),
      })
    }
  }

  const tipoSigno: TipoSignoCruzado[] = []
  for (const [l, lista] of [["compras", libro.compras], ["ventas", libro.ventas]] as const) {
    for (const a of lista) {
      if (a.tipo == null || a.total === 0) continue
      const esNC = TIPOS_NC.includes(Number(a.tipo))
      if (esNC && a.total > 0) tipoSigno.push({ asiento: a, lado: l, motivo: "es NOTA DE CRÉDITO y está en positivo: suma en vez de restar" })
      if (!esNC && a.total < 0) tipoSigno.push({ asiento: a, lado: l, motivo: "es FACTURA (o débito) y está en negativo: resta en vez de sumar" })
    }
  }

  // 📅 Los meses a rectificar o reimputar — «decir cuántos meses son a reimputar» (usuario, ronda 3).
  const motivos = new Map<string, string[]>()
  const anotar = (clave: string, m: string) => motivos.set(clave, [...(motivos.get(clave) ?? []), m])
  for (const [l, subs] of [["compras", compras], ["ventas", ventas]] as const) {
    for (const s of subs) {
      if (!s.contra || s.ok) continue
      const c = s.contra
      const partes: string[] = []
      if (c.soloApp.length) partes.push(`${c.soloApp.length} en la app y NO declarado(s) (${fmt(r2(c.soloApp.reduce((t, f) => t + Number(f.imp_total), 0)))})`)
      if (c.soloPresentado.length) partes.push(`${c.soloPresentado.length} declarado(s) y NO en la app (${fmt(r2(c.soloPresentado.reduce((t, p) => t + p.total, 0)))})`)
      if (c.importeDistinto.length) partes.push(`${c.importeDistinto.length} con otro importe (${fmt(r2(c.importeDistinto.reduce((t, x) => t + x.diferencia, 0)))})`)
      const conDif = c.otroNumero.filter(x => Math.abs(x.diferencia) > TOL)
      if (conDif.length) partes.push(`${conDif.length} con otro número Y otro importe (${fmt(r2(conDif.reduce((t, x) => t + x.diferencia, 0)))})`)
      const difIva = r2(s.iva.app - (s.iva.declarado ?? 0))
      if (!partes.length && Math.abs(difIva) > TOL) {
        partes.push(`el IVA no coincide: app ${fmt(s.iva.app)} · declarado ${fmt(s.iva.declarado ?? 0)} (${fmt(difIva)})`)
      }
      // 🔀 Declarado de un lado y cargado del otro (Genta 11-77393: declarado como VENTA, cargado como COMPRA).
      for (const p of c.soloPresentado) {
        const otro = (l === "compras" ? libro.ventas : libro.compras)
          .find(a => a.cuit.replace(/\D/g, "") === p.cuit && a.numero === p.numero && (a.punto_venta ?? 0) === p.puntoVenta)
        if (otro) partes.push(`${p.denominacion} ${p.puntoVenta}-${p.numero} está declarado en ${l} y cargado en la app como ${l === "compras" ? "VENTA" : "COMPRA"} (${fmt(otro.total)})`)
      }
      if (!partes.length) partes.push(`los totales no coinciden (${fmt(c.totales.diferencia.total)})`)
      anotar(s.clave, `${l}: ${partes.join(" · ")}`)
    }
  }
  const otroNumero: AnalisisEntrega["otroNumero"] = []
  for (const [l, subs] of [["compras", compras], ["ventas", ventas]] as const) {
    for (const s of subs) {
      for (const x of s.contra?.otroNumero ?? []) {
        if (Math.abs(x.diferencia) <= TOL) otroNumero.push({ lado: l, clave: s.clave, nombre: s.nombre, app: x.app, presentado: x.presentado })
      }
    }
  }
  for (const p of papelDistinto) {
    anotar(p.asiento.subdiario, `compras: ${p.asiento.denominacion} ${p.asiento.punto_venta ?? ""}-${p.asiento.numero ?? ""} — el papel dice ${fmt(p.papel.total)} y está cargado${p.declarado ? " y declarado" : ""} ${fmt(p.asiento.total)}`)
  }
  const nombres = new Map(compras.map(s => [s.clave, s.nombre]))
  const aRectificar = [...motivos.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, m]) => ({ clave, nombre: nombres.get(clave) ?? clave, motivos: m }))

  const descuadres = { compras: libro.controles.compras.descuadres, ventas: libro.controles.ventas.descuadres }
  const sePuedeInformar = !aRectificar.length && !tipoSigno.length && !descuadres.compras.length && !descuadres.ventas.length

  return {
    compras, ventas,
    porCuenta: {
      compras: armarLibroPorCuenta(libro.compras),
      ventas: armarLibroPorCuenta(libro.ventas, TIPOS_SIN_CREDITO_VENTAS),
    },
    papelDistinto, tipoSigno, aRectificar, otroNumero, descuadres, sePuedeInformar,
  }
}

/** Por campaña y cuenta: el ejercicio entero, una fila por cuenta (lo no imputado al final). */
export interface FilaCampana extends Partes { cuenta: string; nroCuenta: string; comprobantes: number }
export function porCampanaYCuenta(l: LibroPorCuenta): FilaCampana[] {
  // 🔑 Por NÚMERO de cuenta cuando lo hay («la cuenta se trabaja vía su número, no su string», regla del usuario):
  // «TELEFONOS E INTERNET» y «Telefonos e internet», las dos 422123, son UNA cuenta. Si llegan con dos nombres se
  // muestran los dos, para que se vea y se unifique.
  const m = new Map<string, FilaCampana>()
  for (const mes of l.meses) {
    for (const f of mes.filas) {
      const k = f.nroCuenta ? `nro:${f.nroCuenta}` : `nombre:${f.cuenta}`
      const acc = m.get(k) ?? {
        cuenta: f.cuenta, nroCuenta: f.nroCuenta, comprobantes: 0,
        netoGravado: 0, noGravado: 0, exento: 0, otrosTributos: 0, iva: 0, sinCredito: 0, total: 0,
      }
      if (!acc.cuenta.split(" / ").includes(f.cuenta)) acc.cuenta = `${acc.cuenta} / ${f.cuenta}`
      acc.comprobantes += f.comprobantes
      for (const c of COLUMNAS) acc[c] += f[c]
      m.set(k, acc)
    }
  }
  return [...m.values()].map(f => { for (const c of COLUMNAS) f[c] = r2(f[c]); return f })
    .sort((a, b) => (a.cuenta === SIN_IMPUTAR ? 1 : b.cuenta === SIN_IMPUTAR ? -1 : a.cuenta.localeCompare(b.cuenta, "es")))
}

/**
 * Por qué un comprobante tiene otro importe en lo declarado, cuando se puede decir solo: si la diferencia es
 * exactamente lo que el libro presentado lleva en percepciones / otros tributos, la app no los cargó (Sáenz Valiente:
 * ARCA resta −330.665,50 de «pagos a cuenta» que la liquidación de la app no tiene).
 */
export function explicarDiferencia(diferencia: number, p: ComprobantePresentado): string {
  const otros = p.otrosTributos ?? 0
  if (otros && Math.abs(diferencia + otros) <= TOL) {
    return `la diferencia es lo que el libro declarado lleva en percepciones / otros tributos (${fmt(otros)}), que la app no tiene cargado`
  }
  return ""
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 📗 EL EXCEL
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** La fecha como fecha de Excel (número de serie), para que ordene y filtre como fecha. */
function fechaExcel(iso: string | null): XLSX.CellObject | string {
  if (!iso) return ""
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return iso
  return { t: "n", v: (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000, z: FECHA }
}
/** La fecha como texto dd/mm/aaaa — para los bloques fuera del listado, donde la columna tiene otro formato. */
const fechaTexto = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "")
const col = (i: number) => XLSX.utils.encode_col(i)
const ref = (hoja: string, celda: string) => `'${hoja.replace(/'/g, "''")}'!${celda}`
const nombreHoja = (lado: Lado, clave: string) => `${lado === "compras" ? "C" : "V"} ${clave}`

const ENCABEZADO_ASIENTO = [
  "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Razón social",
  "Neto gravado", "No gravado", "Exento", "Otros tributos", "IVA", "Sin crédito fiscal (B y C)", "Total",
  "Cuenta contable", "Nro cuenta", "Centro de costo", "Origen",
]
/** Columnas de importes del listado (G a M), en el orden de `COLUMNAS`. */
const PRIMERA_IMPORTE = 6
const COLS_ASIENTO: Columna[] = [
  { ancho: 11, z: FECHA }, { ancho: 5, z: ENTERO }, { ancho: 7, z: ENTERO }, { ancho: 10, z: ENTERO }, { ancho: 13 }, { ancho: 34 },
  ...COLUMNAS.map(() => ({ ancho: 15, z: MONEDA })),
  { ancho: 28 }, { ancho: 10 }, { ancho: 14 }, { ancho: 14 },
]
const COLS_CANTIDADES: Columna[] = [{ ancho: 18 }, { ancho: 12, z: TONELADAS }, { ancho: 9, z: ENTERO }, { ancho: 11, z: ENTERO }]

interface MarcasDeFila { textos: Map<string, string[]> }
function marcasDeFilas(a: AnalisisEntrega): MarcasDeFila {
  const textos = new Map<string, string[]>()
  const poner = (id: string, t: string) => textos.set(id, [...(textos.get(id) ?? []), t])
  for (const d of [...a.descuadres.compras, ...a.descuadres.ventas]) if (d.id) poner(d.id, marcaDescuadre(d))
  for (const p of a.papelDistinto) {
    poner(p.asiento.id, `PAPEL ≠ CARGADO: ${p.papel.origen} dice ${fmt(p.papel.total)}${p.papel.esNotaCredito ? " (NOTA DE CRÉDITO)" : ""}; cargado ${fmt(p.asiento.total)}` +
      (p.declarado ? ` y declarado igual (${fmt(p.declarado.total)}): el error viajó a la DDJJ` : ""))
  }
  for (const t of a.tipoSigno) poner(t.asiento.id, `TIPO/SIGNO: ${t.motivo}`)
  for (const s of [...a.compras, ...a.ventas]) {
    if (!s.contra) continue
    for (const f of s.contra.soloApp) poner(f.id, "NO DECLARADO: está en la app y no en el libro IVA presentado")
    for (const x of s.contra.importeDistinto) {
      const por = explicarDiferencia(x.diferencia, x.presentado)
      poner(x.app.id, `OTRO IMPORTE EN LO DECLARADO: ${fmt(x.presentado.total)} (diferencia ${fmt(x.diferencia)})${por ? ` — ${por}` : ""}`)
    }
    for (const x of s.contra.otroNumero) {
      const comp = `${x.presentado.tipo} ${x.presentado.puntoVenta}-${x.presentado.numero}`
      poner(x.app.id, Math.abs(x.diferencia) <= TOL
        ? `OTRO NÚMERO: declarado como ${comp}, mismo importe — corregir la carga en la app`
        : `OTRO NÚMERO Y OTRO IMPORTE: declarado como ${comp} por ${fmt(x.presentado.total)} (diferencia ${fmt(x.diferencia)})`)
    }
  }
  return { textos }
}

/** El renglón de un comprobante (con o sin la columna Subdiario adelante). */
function filaAsiento(a: AsientoLibroDiario, lado: Lado, marcas: MarcasDeFila, conSubdiario: boolean, conCant: boolean): unknown[] {
  const p = partesDe(a, lado)
  const fila: unknown[] = [
    ...(conSubdiario ? [a.subdiario] : []),
    fechaExcel(a.fecha), a.tipo ?? "", a.punto_venta ?? "", a.numero ?? "", a.cuit, a.denominacion,
    ...COLUMNAS.map(c => r2(p[c])),
    a.cuenta_contable || SIN_IMPUTAR, a.nro_cuenta, a.centro_costo,
    a.fuente === "historico" ? "sistema anterior" : a.fuente === "arca" ? "app (ARCA)" : "app (ventas)",
  ]
  if (conCant) {
    const q = a.cantidades
    fila.push(q?.producto ?? "", q?.toneladas ?? "", q?.cabezas ?? "", q?.kilos ?? "")
  }
  const m = marcas.textos.get(a.id)
  fila.push(m ? m.join(" · ") : "")
  return m ? conEstilo(fila, ESTILO_ERROR) : fila
}

/** Dónde quedó el renglón de totales de una hoja (1-based) y la letra de cada columna de importes. */
interface DondeTotal { hoja: string; fila: number; letras: Record<keyof Partes, string>; comprobantes: string }

/** Un listado de comprobantes con su fila TOTAL (SUMA por columna). Devuelve las filas y dónde quedó el total. */
function listado(
  hoja: string, titulo: string[], asientos: AsientoLibroDiario[], lado: Lado, marcas: MarcasDeFila, conSubdiario: boolean,
): { filas: unknown[][]; total: DondeTotal } {
  const conCant = lado === "ventas"
  const f: unknown[][] = titulo.map(t => [t])
  f.push([])
  f.push([...(conSubdiario ? ["Subdiario"] : []), ...ENCABEZADO_ASIENTO,
    ...(conCant ? ["Producto", "Toneladas", "Cabezas", "Kilos"] : []), "Control"])
  const desde = f.length + 1
  for (const a of asientos) f.push(filaAsiento(a, lado, marcas, conSubdiario, conCant))
  const hasta = f.length
  const off = conSubdiario ? 1 : 0
  const letras = Object.fromEntries(COLUMNAS.map((c, i) => [c, col(PRIMERA_IMPORTE + off + i)])) as Record<keyof Partes, string>
  const t = sumar(asientos, lado)
  const n = f.length + 1
  const fila: unknown[] = Array(PRIMERA_IMPORTE + off).fill("")
  fila[0] = "TOTAL"
  fila[PRIMERA_IMPORTE + off - 1] = `${asientos.length} comprobante(s)`
  for (const c of COLUMNAS) fila.push(conFormula(asientos.length ? `SUM(${letras[c]}${desde}:${letras[c]}${hasta})` : "0", t[c]))
  if (conCant) {
    const q = (k: "toneladas" | "cabezas" | "kilos") => r3(asientos.reduce((s, a) => s + (a.cantidades?.[k] ?? 0), 0))
    const base = PRIMERA_IMPORTE + off + COLUMNAS.length + 4
    fila.push("", "", "", "", "")
    ;(["toneladas", "cabezas", "kilos"] as const).forEach((k, i) => {
      fila[base + 1 + i] = conFormula(asientos.length ? `SUM(${col(base + 1 + i)}${desde}:${col(base + 1 + i)}${hasta})` : "0", q(k), i === 0 ? TONELADAS : ENTERO)
    })
  }
  f.push(conEstilo(fila, ESTILO_TOTAL))
  return { filas: f, total: { hoja, fila: n, letras, comprobantes: `${asientos.length}` } }
}

/** El bloque del subdiario como se le manda al contador: FC, NC y neto; y lo que no da crédito fiscal. */
function resumenSubdiario(asientos: AsientoLibroDiario[], lado: Lado): unknown[][] {
  const sinCred = tiposSinCredito(lado)
  const con = asientos.filter(a => !(a.tipo != null && sinCred.includes(Number(a.tipo))))
  const sin = asientos.filter(a => a.tipo != null && sinCred.includes(Number(a.tipo)))
  // Los importes van en las MISMAS columnas que el listado (G a M), así toman su formato y se leen en fila.
  const fila = (etiqueta: string, xs: AsientoLibroDiario[]) => {
    const t = sumar(xs, lado)
    return [etiqueta, "", "", "", xs.length, "", ...COLUMNAS.map(c => t[c])]
  }
  const fc = con.filter(a => a.total >= 0), nc = con.filter(a => a.total < 0)
  const f: unknown[][] = []
  f.push([lado === "compras" ? "LIBRO IVA COMPRAS — generan crédito fiscal" : "LIBRO IVA VENTAS — generan débito fiscal"])
  f.push(["", "", "", "", "Comprobantes", "", ...ENCABEZADO_ASIENTO.slice(PRIMERA_IMPORTE, PRIMERA_IMPORTE + COLUMNAS.length)])
  f.push(fila("Facturas y débitos", fc))
  f.push(fila("Notas de crédito (restan)", nc))
  f.push(conEstilo(fila("Neto (FC − NC)", con), ESTILO_SUBTOTAL))
  if (sin.length) {
    f.push([])
    f.push([lado === "compras" ? "NO GENERAN CRÉDITO FISCAL (Fac B y C)" : "SIN DÉBITO DISCRIMINADO"])
    f.push(fila("Comprobantes", sin.filter(a => a.total >= 0)))
    f.push(fila("Notas de crédito (restan)", sin.filter(a => a.total < 0)))
    f.push(conEstilo(fila("Neto", sin), ESTILO_SUBTOTAL))
  }
  return f
}

/** La comparación de un mes contra lo presentado, para el pie de su subdiario. */
function bloqueContra(s: SubdiarioDelLado, lado: Lado): unknown[][] {
  const f: unknown[][] = []
  void lado
  if (!s.contra) {
    f.push(["CONTRA LO DECLARADO A ARCA — sin dato: no está el libro IVA presentado de este mes, no se controló."])
    return f
  }
  const c = s.contra
  f.push([s.ok ? "CONTRA LO DECLARADO A ARCA — coincide" : "CONTRA LO DECLARADO A ARCA — NO COINCIDE"])
  const fila = (etiqueta: string, comprobantes: number, iva: number, total: number) =>
    [etiqueta, "", "", "", comprobantes, "", "", "", "", "", iva, "", total]
  const ivaDecl = s.iva.declarado ?? 0
  f.push(["", "", "", "", "Comprobantes", "", "", "", "", "", "IVA", "", "Total"])
  f.push(fila("En la app (este subdiario)", c.totales.app.comprobantes, s.iva.app, c.totales.app.total))
  f.push(fila("Declarado (libro IVA)", c.totales.presentado.comprobantes, ivaDecl, c.totales.presentado.total))
  const dif = fila("Diferencia", c.totales.diferencia.comprobantes, r2(s.iva.app - ivaDecl), c.totales.diferencia.total)
  f.push(s.ok ? dif : conEstilo(dif, ESTILO_ERROR))
  return [...f, ...detalleContra(c)]
}

function detalleContra(c: ResultadoContraPresentado): unknown[][] {
  const f: unknown[][] = []
  if (c.soloApp.length) {
    f.push(["En la app y NO declarados", "Fecha", "Comprobante", "Razón social", "Total", "Qué hacer"])
    for (const x of c.soloApp) f.push(["", fechaTexto(x.fecha_emision), `${x.tipo_comprobante ?? ""} ${x.punto_venta ?? ""}-${x.numero_desde ?? ""}`, x.denominacion_emisor ?? "", Number(x.imp_total),
      "rectificar el mes con el contador, o reimputarlo a un mes abierto (entra a provisión)"])
  }
  if (c.soloPresentado.length) {
    f.push(["Declarados y NO en la app", "Fecha", "Comprobante", "Razón social", "Total", "Qué hacer"])
    for (const x of c.soloPresentado) f.push(["", fechaTexto(x.fecha), `${x.tipo} ${x.puntoVenta}-${x.numero}`, x.denominacion, x.total,
      "cargarlo en la app (y provisionarlo si es de este ejercicio)"])
  }
  if (c.importeDistinto.length) {
    f.push(["Con otro importe", "Fecha", "Comprobante", "Razón social", "App", "Declarado", "Diferencia", "Por qué"])
    for (const x of c.importeDistinto) f.push(["", fechaTexto(x.app.fecha_emision), `${x.app.tipo_comprobante ?? ""} ${x.app.punto_venta ?? ""}-${x.app.numero_desde ?? ""}`,
      x.app.denominacion_emisor ?? "", Number(x.app.imp_total), x.presentado.total, x.diferencia, explicarDiferencia(x.diferencia, x.presentado)])
  }
  if (c.otroNumero.length) {
    f.push(["Mismo comprobante con otro número", "Fecha", "En la app", "Razón social", "App", "Declarado", "Diferencia", "Declarado como"])
    for (const x of c.otroNumero) f.push(["", fechaTexto(x.app.fecha_emision), `${x.app.tipo_comprobante ?? "sin tipo"} ${x.app.punto_venta ?? "sin pto"}-${x.app.numero_desde ?? "sin número"}`,
      x.app.denominacion_emisor ?? "", Number(x.app.imp_total), x.presentado.total, x.diferencia, `${x.presentado.tipo} ${x.presentado.puntoVenta}-${x.presentado.numero}`])
  }
  return f
}

/** La hoja por campaña y cuenta, con su TOTAL y el control contra «por mes y cuenta». */
function hojaPorCampana(
  hoja: string, titulo: string, filas: FilaCampana[], lado: Lado, asientos: AsientoLibroDiario[],
  porMes: { hoja: string; fila: number },
): { filas: unknown[][]; total: DondeTotal } {
  const conCant = lado === "ventas"
  const f: unknown[][] = [[titulo], ["El ejercicio entero, una fila por cuenta. Tiene que dar lo mismo que «por mes y cuenta», columna por columna."], []]
  f.push(["Cuenta contable", "Nro cuenta", "Comprobantes", "Neto gravado", "No gravado", "Exento", "Otros tributos", "IVA", "Sin crédito fiscal (B y C)", "Total",
    "Diferencia entre total y columnas", ...(conCant ? ["Producto", "Toneladas", "Cabezas", "Kilos"] : [])])
  const cant = new Map<string, { productos: Set<string>; t: number; c: number; k: number }>()
  if (conCant) {
    for (const a of asientos) {
      const k = a.cuenta_contable?.trim() ? (a.nro_cuenta?.trim() ? `nro:${a.nro_cuenta.trim()}` : `nombre:${a.cuenta_contable.trim()}`) : `nombre:${SIN_IMPUTAR}`
      const acc = cant.get(k) ?? { productos: new Set<string>(), t: 0, c: 0, k: 0 }
      const q = a.cantidades
      if (q?.producto) acc.productos.add(q.producto)
      acc.t += q?.toneladas ?? 0; acc.c += q?.cabezas ?? 0; acc.k += q?.kilos ?? 0
      cant.set(k, acc)
    }
  }
  const desde = f.length + 1
  for (const x of filas) {
    const n = f.length + 1
    const q = cant.get(x.nroCuenta ? `nro:${x.nroCuenta}` : `nombre:${x.cuenta}`)
    f.push([x.cuenta, x.nroCuenta, x.comprobantes, ...COLUMNAS.map(c => x[c]),
      conFormula(`J${n}-(D${n}+E${n}+F${n}+G${n}+H${n}+I${n})`, r2(x.total - (x.netoGravado + x.noGravado + x.exento + x.otrosTributos + x.iva + x.sinCredito))),
      ...(conCant ? [q ? [...q.productos].join(" · ") : "", q?.t ? r3(q.t) : "", q?.c || "", q?.k || ""] : [])])
  }
  const hasta = f.length
  const n = f.length + 1
  const letras = Object.fromEntries(COLUMNAS.map((c, i) => [c, col(3 + i)])) as Record<keyof Partes, string>
  const tot = (c: keyof Partes) => r2(filas.reduce((s, x) => s + x[c], 0))
  f.push(conEstilo(["TOTAL DEL EJERCICIO", "", conFormula(`SUM(C${desde}:C${hasta})`, filas.reduce((s, x) => s + x.comprobantes, 0), ENTERO),
    ...COLUMNAS.map(c => conFormula(`SUM(${letras[c]}${desde}:${letras[c]}${hasta})`, tot(c))),
    conFormula(`J${n}-(D${n}+E${n}+F${n}+G${n}+H${n}+I${n})`, 0)], ESTILO_TOTAL))
  // 🧮 El camino inverso: el mismo total que la hoja por mes y cuenta (TOTAL DEL EJERCICIO, columnas D a J).
  const ordenMes: Record<keyof Partes, string> = { netoGravado: "D", noGravado: "E", exento: "F", otrosTributos: "G", iva: "H", sinCredito: "J", total: "I" }
  f.push([])
  f.push(["CONTROL — «por mes y cuenta» (su TOTAL DEL EJERCICIO)", "", "", ...COLUMNAS.map(c => conFormula(ref(porMes.hoja, `${ordenMes[c]}${porMes.fila}`), tot(c)))])
  const nc = f.length
  f.push(["Diferencia (tiene que dar 0)", "", "", ...COLUMNAS.map(c => conFormula(`${letras[c]}${n}-${letras[c]}${nc}`, 0))])
  return { filas: f, total: { hoja, fila: n, letras, comprobantes: `C${n}` } }
}

/** «Contra ARCA»: dos cuadros (compras y ventas), un renglón por mes, y el detalle de lo que no coincide. */
function hojaContraArca(a: AnalisisEntrega): unknown[][] {
  const f: unknown[][] = [["CONTRA LO DECLARADO A ARCA — mes por mes"],
    ["Cada subdiario de la app contra el libro IVA presentado de ese mes (el zip que exporta ARCA). Compras y ventas en cuadros separados."], []]
  for (const lado of ["compras", "ventas"] as const) {
    const subs = lado === "compras" ? a.compras : a.ventas
    f.push([lado === "compras" ? "COMPRAS" : "VENTAS"])
    f.push(["Subdiario", "App: comprobantes", "App: total", "App: IVA", "Declarado: comprobantes", "Declarado: total", "Declarado: IVA",
      "Diferencia total", "Diferencia IVA", "Control", "Qué hacer"])
    const desde = f.length + 1
    for (const s of subs) {
      const n = f.length + 1
      const c = s.contra
      const queHacer = !c || s.ok ? "" : [
        c.soloApp.length ? "rectificar el mes o reimputar lo no declarado (entra a provisión)" : "",
        c.soloPresentado.length ? "cargar y provisionar lo declarado que falta" : "",
        c.importeDistinto.length || c.otroNumero.some(x => Math.abs(x.diferencia) > TOL) ? "corregir el importe o rectificar" : "",
      ].filter(Boolean).join(" · ") || "revisar el IVA de los comprobantes del mes"
      const ivaDecl = s.iva.declarado ?? 0
      const fila: unknown[] = [s.nombre, s.totales.comprobantes, s.totales.total, s.iva.app,
        c ? c.totales.presentado.comprobantes : "sin dato", c ? c.totales.presentado.total : "sin dato", c ? ivaDecl : "sin dato",
        c ? conFormula(`C${n}-F${n}`, c.totales.diferencia.total) : "", c ? conFormula(`D${n}-G${n}`, r2(s.iva.app - ivaDecl)) : "",
        !c ? "sin dato" : s.ok ? "coincide" : "NO COINCIDE", queHacer]
      f.push(c && !s.ok ? conEstilo(fila, ESTILO_ERROR) : fila)
    }
    const hasta = f.length
    const sum = (g: (s: SubdiarioDelLado) => number) => r2(subs.reduce((t, s) => t + g(s), 0))
    const valores = [
      sum(s => s.totales.comprobantes), sum(s => s.totales.total), sum(s => s.iva.app),
      sum(s => s.contra?.totales.presentado.comprobantes ?? 0), sum(s => s.contra?.totales.presentado.total ?? 0),
      sum(s => s.iva.declarado ?? 0), sum(s => s.contra?.totales.diferencia.total ?? 0),
      sum(s => (s.contra ? r2(s.iva.app - (s.iva.declarado ?? 0)) : 0)),
    ]
    f.push(conEstilo(["TOTAL", ...["B", "C", "D", "E", "F", "G", "H", "I"].map((l, i) =>
      conFormula(`SUM(${l}${desde}:${l}${hasta})`, valores[i], i === 0 || i === 3 ? ENTERO : MONEDA))], ESTILO_TOTAL))
    f.push([])
  }
  const conDetalle = [...a.compras.map(s => ["compras", s] as const), ...a.ventas.map(s => ["ventas", s] as const)].filter(([, s]) => s.contra && (!s.ok || s.contra.otroNumero.length))
  if (conDetalle.length) {
    f.push(["DETALLE DE LO QUE NO COINCIDE"])
    for (const [lado, s] of conDetalle) {
      f.push([`${s.nombre} — ${lado}`])
      f.push(...detalleContra(s.contra!))
      f.push([])
    }
  }
  return f
}

/** La primera hoja: qué se puede informar, la cadena, y lo que hay que rectificar antes. */
function hojaControl(d: DatosEntrega, a: AnalisisEntrega, cadena: Record<Lado, { camino: string; donde: DondeTotal | DondeTotal[] | null; valores: Totales | null; nota?: string }[]>): unknown[][] {
  const { libro } = d
  const f: unknown[][] = []
  f.push([`LIBRO DIARIO — ${d.empresa} — ejercicio ${libro.ejercicio.etiqueta}`])
  f.push([`Los 12 subdiarios: ${a.compras[0]?.nombre ?? ""} a ${a.compras[a.compras.length - 1]?.nombre ?? ""} · cierre ${libro.ejercicio.fechaCierre}${d.generado ? ` · generado ${d.generado}` : ""}`])
  f.push(["El período se corta por el subdiario en que entró cada comprobante, no por su fecha."])
  f.push([])
  f.push([a.sePuedeInformar ? "CONTROL OK — se puede informar" : "NO INFORMAR TODAVÍA — hay que rectificar antes (abajo, qué y dónde)"])
  f.push([])

  // 1 · La cadena
  f.push(["1 · EL MISMO NÚMERO POR TODOS LOS CAMINOS — columna por columna"])
  for (const lado of ["compras", "ventas"] as const) {
    f.push([lado === "compras" ? "COMPRAS" : "VENTAS", "Comprobantes", "Neto gravado", "No gravado", "Exento", "Otros tributos", "IVA", "Sin crédito fiscal (B y C)", "Total", "Diferencia de total con los subdiarios", "Control"])
    const n0 = f.length + 1
    for (const paso of cadena[lado]) {
      const n = f.length + 1
      const v = paso.valores
      const celda = (c: keyof Partes) => {
        if (!v) return ""
        const w = paso.donde
        if (!w) return v[c]
        const lista = Array.isArray(w) ? w : [w]
        if (!lista.length) return v[c]
        return conFormula(lista.map(x => ref(x.hoja, `${x.letras[c]}${x.fila}`)).join("+"), v[c])
      }
      const fila: unknown[] = [paso.camino, v ? v.comprobantes : "",
        ...COLUMNAS.map(c => celda(c)),
        n === n0 || !v ? "" : conFormula(`I${n}-I${n0}`, r2(v.total - (cadena[lado][0].valores?.total ?? 0))),
        paso.nota ?? (n === n0 || !v ? "" : Math.abs(v.total - (cadena[lado][0].valores?.total ?? 0)) <= TOL ? "coincide" : "NO COINCIDE")]
      f.push(fila)
    }
    f.push([])
  }

  // 2 · Lo que hay que rectificar
  f.push(["2 · ANTES DE INFORMAR — RECTIFICAR"])
  if (!a.aRectificar.length && !a.descuadres.compras.length && !a.descuadres.ventas.length && !a.tipoSigno.length) {
    f.push(["coincide — no hay nada que rectificar"])
  }
  if (a.aRectificar.length) {
    f.push([`Meses a rectificar con el contador o a reimputar: ${a.aRectificar.length} — ${a.aRectificar.map(x => x.nombre).join(" · ")}`])
    f.push(["Subdiario", "Qué pasa"])
    for (const x of a.aRectificar) for (const [i, m] of x.motivos.entries()) f.push(conEstilo([i === 0 ? x.nombre : "", m], ESTILO_ERROR))
    f.push(["Qué hacer, según el caso: cargar y provisionar lo declarado que falta · reimputar a un mes abierto lo no declarado (entra a provisión) · o rectificar el mes con el contador."])
    f.push([])
  }
  // Papel / cargado / declarado
  f.push([a.papelDistinto.length
    ? `PAPEL ≠ CARGADO — ${a.papelDistinto.length} comprobante(s): lo cargado no es lo que dice el papel`
    : `PAPEL vs. CARGADO — coincide en los ${(d.papeles ?? []).length} comprobantes que tienen el papel leído (endosos de Pólizas)`])
  if (a.papelDistinto.length) {
    f.push(["Subdiario", "Fecha", "Comprobante", "Proveedor", "Papel (de dónde)", "Papel", "Cargado (app)", "Declarado (ARCA)", "Papel − cargado", "Cargado − declarado", "Qué pasa"])
    for (const p of a.papelDistinto) {
      const n = f.length + 1
      const dec = p.declarado
      f.push(conEstilo([p.asiento.subdiario, fechaTexto(p.asiento.fecha), `${p.asiento.tipo ?? ""} ${p.asiento.punto_venta ?? ""}-${p.asiento.numero ?? ""}`, p.asiento.denominacion,
        p.papel.origen, p.papel.total, p.asiento.total, dec ? dec.total : dec === null ? "no figura" : "sin dato",
        conFormula(`F${n}-G${n}`, p.diferencia), dec ? conFormula(`G${n}-H${n}`, r2(p.asiento.total - dec.total)) : "",
        (p.papel.esNotaCredito && p.asiento.total > 0 ? "El papel es NOTA DE CRÉDITO y se cargó como factura: suma al gasto en vez de restar. " : "") +
        (dec && Math.abs(p.asiento.total - dec.total) <= TOL ? "Cargado y declarado coinciden: el error viajó a la DDJJ → rectificar con el contador." : "")], ESTILO_ERROR))
    }
    const efecto = r2(a.papelDistinto.reduce((s, p) => s + p.diferencia, 0))
    f.push(["", "", "", "", "Efecto en el resultado", "", "", "", efecto, "", efecto < 0 ? `el gasto está inflado en ${fmt(-efecto)}` : `el gasto está corto en ${fmt(efecto)}`])
  }
  f.push([])
  f.push([a.tipoSigno.length
    ? `TIPO vs. SIGNO — ${a.tipoSigno.length} comprobante(s) con el tipo y el signo cruzados`
    : `TIPO vs. SIGNO — coincide en los ${libro.compras.length + libro.ventas.length} comprobantes (ninguna nota de crédito en positivo ni factura en negativo)`])
  for (const t of a.tipoSigno) f.push(conEstilo(["", t.lado, t.asiento.subdiario, `${t.asiento.tipo} ${t.asiento.punto_venta ?? ""}-${t.asiento.numero ?? ""}`, t.asiento.denominacion, t.asiento.total, t.motivo], ESTILO_ERROR))
  f.push([])
  f.push([a.otroNumero.length
    ? `AVISO — ${a.otroNumero.length} comprobante(s) declarados con OTRO TIPO O NÚMERO que en la app, por el mismo importe: no cambia montos, hay que corregir la carga`
    : "NÚMEROS — coinciden con lo declarado en todos los comprobantes emparejados"])
  if (a.otroNumero.length) {
    f.push(["", "Subdiario", "Lado", "Razón social", "En la app", "Declarado como", "Importe"])
    for (const x of a.otroNumero) f.push(["", x.nombre, x.lado, x.app.denominacion_emisor ?? "",
      `${x.app.tipo_comprobante ?? "sin tipo"} ${x.app.punto_venta ?? "sin pto"}-${x.app.numero_desde ?? "sin número"}`,
      `${x.presentado.tipo} ${x.presentado.puntoVenta}-${x.presentado.numero}`, x.presentado.total])
  }
  f.push([])
  const desc = [...a.descuadres.compras, ...a.descuadres.ventas]
  f.push([desc.length ? `COMPROBANTES CUYAS PARTES NO SUMAN SU TOTAL — ${desc.length}` : "PARTES vs. TOTAL — cuadra en todos los comprobantes"])
  if (desc.length) {
    f.push(["", "Fecha", "Nombre", "Comprobante", "Total", "Suma de las partes", "Diferencia"])
    for (const x of desc) f.push(conEstilo(["", fechaTexto(x.fecha), x.nombre, x.comprobante, r2(x.imp_total), r2(x.suma_partes), r2(x.diferencia)], ESTILO_ERROR))
  }
  f.push([])

  // 3 · Pendiente (no es error)
  f.push(["3 · PENDIENTE — no es error, falta cargar"])
  for (const [lado, l] of [["Compras", a.porCuenta.compras], ["Ventas", a.porCuenta.ventas]] as const) {
    f.push([l.sinImputar.comprobantes
      ? `${lado}: falta imputar la cuenta contable a ${l.sinImputar.comprobantes} comprobante(s) por ${fmt(l.sinImputar.total)} (${l.sinImputar.porcentaje}% del total) — salen como «${SIN_IMPUTAR}»`
      : `${lado}: todo imputado`])
  }
  f.push([])

  // 4 · Qué hay en cada hoja
  f.push(["4 · QUÉ HAY EN CADA HOJA"])
  f.push(["", "C AAAA-MM / V AAAA-MM", "los subdiarios de compras y de ventas, uno por hoja (los meses sin comprobantes no van)"])
  f.push(["", "Compras · Ventas", "todos los comprobantes del ejercicio, ordenados por fecha, con totales por columna"])
  f.push(["", "… por mes y cuenta", "el subtotal de cada mes por cuenta contable (se pliega con + / −)"])
  f.push(["", "… por campaña y cuenta", "el ejercicio entero por cuenta contable"])
  f.push(["", "Contra ARCA", "cada mes contra el libro IVA presentado, compras y ventas por separado"])
  f.push(["", "Las marcas en rojo", "están en el renglón del comprobante, en su subdiario y en la planilla (columna Control)"])
  return f
}

/** Arma el libro entero. El orden de las hojas es el de su pedido, con el Control primero. */
export function armarEntregaLibroDiario(d: DatosEntrega): { wb: XLSX.WorkBook; analisis: AnalisisEntrega } {
  const a = analizarEntrega(d)
  const marcas = marcasDeFilas(a)
  const { libro } = d
  const etiqueta = libro.ejercicio.etiqueta

  const hojas: { nombre: string; filas: unknown[][]; cols?: Columna[] }[] = []
  const totalesSub: Record<Lado, DondeTotal[]> = { compras: [], ventas: [] }

  // 1 · Los 24 subdiarios (los vacíos no van).
  for (const lado of ["compras", "ventas"] as const) {
    for (const s of lado === "compras" ? a.compras : a.ventas) {
      if (!s.asientos.length) continue
      const nombre = nombreHoja(lado, s.clave)
      const origen = s.asientos.some(x => x.fuente === "historico") ? "sistema anterior (lo que se presentó)" : "la app"
      const l = listado(nombre, [`SUBDIARIO DE ${lado === "compras" ? "COMPRAS" : "VENTAS"} — ${s.nombre} — ${d.empresa}`, `Origen: ${origen}`], s.asientos, lado, marcas, false)
      totalesSub[lado].push(l.total)
      hojas.push({ nombre, filas: [...l.filas, [], ...resumenSubdiario(s.asientos, lado), [], ...bloqueContra(s, lado)],
        cols: [...COLS_ASIENTO, ...(lado === "ventas" ? COLS_CANTIDADES : []), { ancho: 70 }] })
    }
  }

  // 2 · Todas las compras y todas las ventas, por fecha.
  const planilla: Record<Lado, DondeTotal | null> = { compras: null, ventas: null }
  for (const lado of ["compras", "ventas"] as const) {
    const nombre = lado === "compras" ? "Compras" : "Ventas"
    const lista = [...(lado === "compras" ? libro.compras : libro.ventas)].sort(porFecha)
    const l = listado(nombre, [`${lado === "compras" ? "TODAS LAS COMPRAS" : "TODAS LAS VENTAS"} DEL EJERCICIO ${etiqueta} — por fecha`,
      "Los totales tienen que dar lo mismo que la suma de los subdiarios (hoja Control, punto 1)."], lista, lado, marcas, true)
    planilla[lado] = l.total
    hojas.push({ nombre, filas: l.filas, cols: [{ ancho: 9 }, ...COLS_ASIENTO, ...(lado === "ventas" ? COLS_CANTIDADES : []), { ancho: 70 }] })
  }

  // 3 · Por mes y cuenta (la misma hoja de los papeles de trabajo).
  const porMes: Record<Lado, { hoja: string; fila: number }> = { compras: { hoja: "", fila: 0 }, ventas: { hoja: "", fila: 0 } }
  for (const lado of ["compras", "ventas"] as const) {
    const nombre = lado === "compras" ? "Compras por mes y cuenta" : "Ventas por mes y cuenta"
    const filas = hojaPorCuenta(a.porCuenta[lado], `LIBRO DIARIO MENSUAL (${lado === "compras" ? "Compras" : "Ventas"}) — ejercicio ${etiqueta}`,
      { asientos: lado === "compras" ? libro.compras : libro.ventas, descuadres: a.descuadres[lado] }, lado === "ventas")
    const i = filas.findIndex(r => { const c = (r as unknown[])[2]; return (c && typeof c === "object" ? (c as { v?: unknown }).v : c) === "TOTAL DEL EJERCICIO" })
    porMes[lado] = { hoja: nombre, fila: i + 1 }
    hojas.push({ nombre, filas, cols: lado === "ventas" ? COLS_POR_CUENTA_VENTAS : COLS_POR_CUENTA })
  }

  // 4 · Por campaña y cuenta.
  const porCampana: Record<Lado, DondeTotal | null> = { compras: null, ventas: null }
  for (const lado of ["compras", "ventas"] as const) {
    const nombre = lado === "compras" ? "Compras por campaña y cuenta" : "Ventas por campaña y cuenta"
    const h = hojaPorCampana(nombre, `${lado === "compras" ? "COMPRAS" : "VENTAS"} POR CUENTA — campaña ${etiqueta}`, porCampanaYCuenta(a.porCuenta[lado]), lado,
      lado === "compras" ? libro.compras : libro.ventas, porMes[lado])
    porCampana[lado] = h.total
    hojas.push({ nombre, filas: h.filas, cols: [{ ancho: 34 }, { ancho: 10 }, { ancho: 12, z: ENTERO }, ...COLUMNAS.map(() => ({ ancho: 16, z: MONEDA })), { ancho: 16, z: MONEDA },
      ...(lado === "ventas" ? COLS_CANTIDADES : [])] })
  }

  // 5 · Contra ARCA.
  hojas.push({ nombre: "Contra ARCA", filas: hojaContraArca(a), cols: [{ ancho: 26 }, { ancho: 14 }, { ancho: 17 }, { ancho: 30 }, { ancho: 17 }, { ancho: 17 }, { ancho: 16 }, { ancho: 15 }, { ancho: 15 }, { ancho: 14 }, { ancho: 60 }] })

  // La cadena de la hoja Control: los mismos totales, leídos de cada hoja con fórmula.
  const presentadoTotales = (lado: Lado): Totales | null => {
    const subs = lado === "compras" ? a.compras : a.ventas
    if (!subs.some(s => s.contra)) return null
    const ps = subs.flatMap(s => (s.contra ? (d.presentado?.[s.clave]?.[lado] ?? []) : []))
    return {
      comprobantes: ps.length, netoGravado: r2(ps.reduce((t, p) => t + (p.netoGravado ?? 0), 0)), noGravado: r2(ps.reduce((t, p) => t + (p.noGravado ?? 0), 0)),
      exento: r2(ps.reduce((t, p) => t + (p.exento ?? 0), 0)), otrosTributos: r2(ps.reduce((t, p) => t + (p.otrosTributos ?? 0), 0)),
      iva: r2(ps.reduce((t, p) => t + (p.iva ?? 0), 0)), sinCredito: 0, total: r2(ps.reduce((t, p) => t + p.total, 0)),
    }
  }
  const sinDato = (lado: Lado) => (lado === "compras" ? a.compras : a.ventas).filter(s => !s.contra).length
  const porCuentaTotales = (lado: Lado): Totales => {
    const g = a.porCuenta[lado].totalGeneral
    return { comprobantes: g.comprobantes, netoGravado: g.netoGravado, noGravado: g.noGravado, exento: g.exento, otrosTributos: g.otrosTributos, iva: g.iva, sinCredito: g.sinCredito, total: g.total }
  }
  const porMesDonde = (lado: Lado): DondeTotal => ({ hoja: porMes[lado].hoja, fila: porMes[lado].fila, comprobantes: "",
    letras: { netoGravado: "D", noGravado: "E", exento: "F", otrosTributos: "G", iva: "H", sinCredito: "J", total: "I" } })
  const cadena = Object.fromEntries((["compras", "ventas"] as const).map(lado => {
    const pres = presentadoTotales(lado)
    const subs = lado === "compras" ? a.compras : a.ventas
    const sumaSubs = sumar(subs.flatMap(s => s.asientos), lado)
    return [lado, [
      { camino: `Los subdiarios (${totalesSub[lado].length} hojas)`, donde: totalesSub[lado], valores: sumaSubs },
      { camino: `Todas las ${lado} por fecha`, donde: planilla[lado], valores: sumar(lado === "compras" ? libro.compras : libro.ventas, lado) },
      { camino: "Por mes y cuenta", donde: porMesDonde(lado), valores: porCuentaTotales(lado) },
      { camino: "Por campaña y cuenta", donde: porCampana[lado], valores: porCuentaTotales(lado) },
      { camino: "Declarado a ARCA (libros IVA)", donde: null, valores: pres,
        nota: !pres ? "sin dato de lo presentado" : sinDato(lado) ? `${sinDato(lado)} mes(es) sin dato` :
          Math.abs(pres.total - sumaSubs.total) <= TOL ? "coincide" : "NO COINCIDE — ver «Contra ARCA»" },
    ]]
  })) as Record<Lado, { camino: string; donde: DondeTotal | DondeTotal[] | null; valores: Totales | null; nota?: string }[]>

  const wb = XLSX.utils.book_new()
  agregarHoja(wb, "Control", hojaControl(d, a, cadena), [{ ancho: 34 }, { ancho: 13, z: ENTERO }, ...COLUMNAS.map(() => ({ ancho: 16, z: MONEDA })), { ancho: 18, z: MONEDA }, { ancho: 60 }])
  for (const h of hojas) agregarHoja(wb, h.nombre, h.filas, h.cols)
  return { wb, analisis: a }
}

export function nombreArchivoEntrega(d: DatosEntrega, hoy: string): string {
  return `Libro diario ${d.empresa} ${d.libro.ejercicio.etiqueta.replace("/", "-")} (${hoy}).xlsx`
}
