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
  agregarHoja, plegar, conEstilo, ESTILO_ERROR, ESTILO_SUBTOTAL, ESTILO_TOTAL, marcaDescuadre,
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

/** Una tabla del libro IVA tal cual el CSV de ARCA: su encabezado y cada renglón con el mes del zip. */
export interface TablaOriginal { encabezado: string[]; filas: { periodo: string; valores: string[] }[] }

export interface DatosEntrega {
  libro: LibroDiario
  empresa: string
  /** Por subdiario (`2025-07`). Un mes sin zip = sin dato de lo presentado (se dice, no se asume). */
  presentado?: Record<string, LoPresentado>
  papeles?: PapelDelComprobante[]
  /** Lo declarado tal cual lo exporta ARCA (las columnas del CSV), para la solapa «original». */
  arcaOriginal?: { compras: TablaOriginal; ventas: TablaOriginal }
  /**
   * ✍️ La RECTIFICACIÓN de lo declarado, aplicada encima de los zips (que no se tocan): ARCA antes → cambio → ARCA ahora
   * (JMS 27/10: *«poné las modificaciones a los archivos de ARCA, sin modificar los originales: ARCA antes, cambio, ARCA ahora;
   * match con el diario que sale de la app»*).
   */
  ajustesArca?: AjusteArca[]
  /** Fecha y hora para el encabezado. */
  generado?: string
}

/** Un cambio a lo declarado: sacar un comprobante o reemplazar sus importes. */
export interface AjusteArca {
  /** `2026-02` */
  periodo: string
  lado: Lado
  comprobante: { tipo: number; puntoVenta: number; numero: number; cuit: string }
  accion: "sacar" | "reemplazar"
  nuevo?: Partial<Pick<ComprobantePresentado, "netoGravado" | "noGravado" | "exento" | "iva" | "otrosTributos" | "total" | "creditoFiscal">>
  motivo: string
}

export interface AjusteAplicado { ajuste: AjusteArca; antes: ComprobantePresentado | null; despues: ComprobantePresentado | null }

/** Aplica los cambios a una copia de lo declarado. Lo que no se encuentra se devuelve con `antes: null` (se muestra, no se calla). */
export function aplicarAjustes(presentado: Record<string, LoPresentado> | undefined, ajustes: AjusteArca[]) {
  if (!presentado || !ajustes.length) return { ahora: presentado, aplicados: [] as AjusteAplicado[] }
  const ahora: Record<string, LoPresentado> = Object.fromEntries(Object.entries(presentado).map(([k, v]) => [k, { compras: [...v.compras], ventas: [...v.ventas] }]))
  const aplicados: AjusteAplicado[] = []
  for (const aj of ajustes) {
    const lista = ahora[aj.periodo]?.[aj.lado]
    const c = aj.comprobante
    const i = lista ? lista.findIndex(p => p.tipo === c.tipo && p.puntoVenta === c.puntoVenta && p.numero === c.numero && p.cuit === c.cuit) : -1
    if (!lista || i < 0) { aplicados.push({ ajuste: aj, antes: null, despues: null }); continue }
    const antes = lista[i]
    if (aj.accion === "sacar") { lista.splice(i, 1); aplicados.push({ ajuste: aj, antes, despues: null }); continue }
    const despues = { ...antes, ...aj.nuevo }
    lista[i] = despues
    aplicados.push({ ajuste: aj, antes, despues })
  }
  return { ahora, aplicados }
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
export interface TipoSignoCruzado { asiento: AsientoLibroDiario; lado: Lado; motivo: string
  /** El papel (PDF de la póliza) confirma el importe con su signo: se acepta (JMS 27/10, «es una póliza… está bien así»). */
  aceptado?: boolean }

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
      if (!esNC && a.total < 0) {
        const papel = (d.papeles ?? []).find(p => p.comprobanteId === a.id)
        const aceptado = !!papel && Math.abs(papel.total - a.total) <= TOL
        tipoSigno.push({ asiento: a, lado: l, aceptado, motivo: aceptado
          ? `factura en negativo: el papel (${papel!.origen}) dice ${fmt(papel!.total)} — aceptada (póliza; decisión de JMS 27/10)`
          : "es FACTURA (o débito) y está en negativo: resta en vez de sumar" })
      }
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
  const sePuedeInformar = !aRectificar.length && !tipoSigno.some(t => !t.aceptado) && !descuadres.compras.length && !descuadres.ventas.length

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
// 📗 EL EXCEL — UNA sola fila de columnas para TODAS las hojas
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * 🔑 **LAS MISMAS COLUMNAS, EN EL MISMO LUGAR, EN TODAS LAS HOJAS.** Usuario 27/10, sobre «Contra ARCA»: *«¿no
 * podría ser con todas las columnas del resto, así comparamos columna por columna?»*; y: *«la idea es las mismas
 * columnas en todas las planillas que integran el libro diario»*.
 *
 * Un comprobante, un subtotal por cuenta, un mes contra ARCA, un camino de la cadena: todos usan esta fila, y lo
 * que no aplica queda vacío. Así el Neto gravado está siempre en K y el Total siempre en Q, y una columna se compara
 * contra la misma de otra hoja sin buscarla (y los filtros andan igual en todas).
 */
const CAMPOS = [
  ["sub", "Subdiario", { ancho: 12 }],
  ["fecha", "Fecha", { ancho: 11, z: FECHA }],
  ["tipo", "Tipo", { ancho: 6, z: ENTERO }],
  ["pv", "Pto Vta", { ancho: 7, z: ENTERO }],
  ["nro", "Número", { ancho: 11, z: ENTERO }],
  ["cuit", "CUIT", { ancho: 13 }],
  ["razon", "Razón social / Detalle", { ancho: 36 }],
  ["cuenta", "Cuenta contable", { ancho: 28 }],
  ["nroCuenta", "Nro cuenta", { ancho: 10 }],
  ["cc", "Centro de costo", { ancho: 13 }],
  ["netoGravado", "Neto gravado", { ancho: 16, z: MONEDA }],
  ["noGravado", "No gravado", { ancho: 14, z: MONEDA }],
  ["exento", "Exento", { ancho: 15, z: MONEDA }],
  ["otrosTributos", "Otros tributos", { ancho: 14, z: MONEDA }],
  ["iva", "IVA", { ancho: 15, z: MONEDA }],
  ["sinCredito", "Sin crédito fiscal (B y C)", { ancho: 16, z: MONEDA }],
  ["total", "Total", { ancho: 17, z: MONEDA }],
  ["dif", "Total − columnas", { ancho: 14, z: MONEDA }],
  ["comprobantes", "Comprobantes", { ancho: 12, z: ENTERO }],
  ["producto", "Producto", { ancho: 14 }],
  ["toneladas", "Toneladas", { ancho: 11, z: TONELADAS }],
  ["cabezas", "Cabezas", { ancho: 9, z: ENTERO }],
  ["kilos", "Kilos", { ancho: 10, z: ENTERO }],
  ["origen", "Origen", { ancho: 18 }],
  ["control", "Control", { ancho: 80 }],
] as const
type Campo = typeof CAMPOS[number][0]
const POS = Object.fromEntries(CAMPOS.map(([k], i) => [k, i])) as Record<Campo, number>
const L = (k: Campo) => XLSX.utils.encode_col(POS[k])
const ENCABEZADO = CAMPOS.map(c => c[1])
const COLS: Columna[] = CAMPOS.map(c => ({ ...c[2] }) as Columna)
const CANTIDADES = ["toneladas", "cabezas", "kilos"] as const
const SUMABLES: Campo[] = [...COLUMNAS, "comprobantes", ...CANTIDADES]
const formatoDe = (k: Campo) => (k === "toneladas" ? TONELADAS : k === "comprobantes" || k === "cabezas" || k === "kilos" ? ENTERO : MONEDA)

type Fila = Partial<Record<Campo, unknown>>
/** Un renglón con la fila única de columnas: lo que no se nombra queda vacío. */
function fila(v: Fila): unknown[] {
  const r: unknown[] = Array(CAMPOS.length).fill("")
  for (const [k, x] of Object.entries(v)) if (x !== undefined && x !== null) r[POS[k as Campo]] = x
  return r
}
/** «Total − columnas» del renglón n: la integridad del comprobante (0 si sus partes suman su total). */
const difDe = (v: Partial<Record<keyof Partes, number>>) =>
  r2((v.total ?? 0) - COLUMNAS.filter(c => c !== "total").reduce((s, c) => s + (v[c] ?? 0), 0))
const difFormula = (n: number, v: Partial<Record<keyof Partes, number>>) =>
  conFormula(`${L("total")}${n}-(${COLUMNAS.filter(c => c !== "total").map(c => `${L(c)}${n}`).join("+")})`, difDe(v))

/** La fecha como fecha de Excel (número de serie), para que ordene y filtre como fecha. */
function fechaExcel(iso: string | null | undefined): XLSX.CellObject | string {
  if (!iso) return ""
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return iso
  return { t: "n", v: (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000, z: FECHA }
}
const ref = (hoja: string, celda: string) => `'${hoja.replace(/'/g, "''")}'!${celda}`
const nombreHoja = (lado: Lado, clave: string) => `${lado === "compras" ? "C" : "V"} ${clave}`

/** Los valores sumables de un conjunto de comprobantes (importes partidos como en el libro + cantidades). */
type Valores = Totales & { toneladas: number; cabezas: number; kilos: number }
function valoresDe(asientos: AsientoLibroDiario[], lado: Lado): Valores {
  const t = sumar(asientos, lado)
  const q = (k: typeof CANTIDADES[number]) => r3(asientos.reduce((s, a) => s + (a.cantidades?.[k] ?? 0), 0))
  return { ...t, toneladas: q("toneladas"), cabezas: q("cabezas"), kilos: q("kilos") }
}
/** Lo declarado, partido igual que la app: una B o C va entera a «sin crédito fiscal». */
function valoresDeclarados(ps: ComprobantePresentado[], lado: Lado): Valores {
  const v: Valores = { comprobantes: ps.length, netoGravado: 0, noGravado: 0, exento: 0, otrosTributos: 0, iva: 0, sinCredito: 0, total: 0, toneladas: 0, cabezas: 0, kilos: 0 }
  for (const p of ps) {
    v.total += p.total
    if (tiposSinCredito(lado).includes(p.tipo)) { v.sinCredito += p.total; continue }
    v.netoGravado += p.netoGravado ?? 0; v.noGravado += p.noGravado ?? 0; v.exento += p.exento ?? 0
    v.otrosTributos += p.otrosTributos ?? 0; v.iva += p.iva ?? 0
  }
  for (const c of COLUMNAS) v[c] = r2(v[c])
  return v
}
const importes = (v: Partial<Record<keyof Partes, number>>): Fila => Object.fromEntries(COLUMNAS.map(c => [c, v[c] ?? 0]))

/** El renglón de un SUMA (o SUBTOTAL, que respeta filtros y se pliega) sobre filas desde..hasta. */
function filaSuma(base: Fila, n: number, desde: number, hasta: number, v: Valores, fn: "SUM" | "SUBTOTAL" = "SUM"): unknown[] {
  const celdas: Fila = {}
  for (const k of SUMABLES) {
    const valor = (v as unknown as Record<string, number>)[k] ?? 0
    celdas[k] = hasta < desde ? valor
      : conFormula(fn === "SUM" ? `SUM(${L(k)}${desde}:${L(k)}${hasta})` : `SUBTOTAL(9,${L(k)}${desde}:${L(k)}${hasta})`, valor, formatoDe(k))
  }
  return fila({ ...base, ...celdas, dif: difFormula(n, v) })
}

interface MarcasDeFila { textos: Map<string, string[]> }
function marcasDeFilas(a: AnalisisEntrega): MarcasDeFila {
  const textos = new Map<string, string[]>()
  const poner = (id: string, t: string) => textos.set(id, [...(textos.get(id) ?? []), t])
  for (const d of [...a.descuadres.compras, ...a.descuadres.ventas]) if (d.id) poner(d.id, marcaDescuadre(d))
  for (const p of a.papelDistinto) {
    poner(p.asiento.id, `PAPEL ≠ CARGADO: ${p.papel.origen} dice ${fmt(p.papel.total)}${p.papel.esNotaCredito ? " (NOTA DE CRÉDITO)" : ""}; cargado ${fmt(p.asiento.total)}` +
      (p.declarado ? ` y declarado igual (${fmt(p.declarado.total)}): el error viajó a la DDJJ` : ""))
  }
  for (const t of a.tipoSigno) if (!t.aceptado) poner(t.asiento.id, `TIPO/SIGNO: ${t.motivo}`)
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

const origenDe = (a: AsientoLibroDiario) => (a.fuente === "historico" ? "sistema anterior" : a.fuente === "arca" ? "app (ARCA)" : "app (ventas)")

/** El renglón de un comprobante de la app (en la fila n). */
function filaAsiento(a: AsientoLibroDiario, lado: Lado, n: number, marcas?: MarcasDeFila, control?: string): unknown[] {
  const p = partesDe(a, lado)
  const q = a.cantidades
  const m = [...(marcas?.textos.get(a.id) ?? []), ...(control ? [control] : [])]
  const r = fila({
    sub: a.subdiario, fecha: fechaExcel(a.fecha), tipo: a.tipo ?? "", pv: a.punto_venta ?? "", nro: a.numero ?? "",
    cuit: a.cuit, razon: a.denominacion, cuenta: a.cuenta_contable || SIN_IMPUTAR, nroCuenta: a.nro_cuenta, cc: a.centro_costo,
    ...importes(Object.fromEntries(COLUMNAS.map(c => [c, r2(p[c])]))), dif: difFormula(n, p), comprobantes: 1,
    producto: q?.producto || "", toneladas: q?.toneladas ?? "", cabezas: q?.cabezas ?? "", kilos: q?.kilos ?? "",
    origen: origenDe(a), control: m.join(" · "),
  })
  return m.length ? conEstilo(r, ESTILO_ERROR) : r
}

/** El renglón de un comprobante DECLARADO (del libro IVA presentado), partido igual que la app. */
function filaDeclarada(p: ComprobantePresentado, lado: Lado, clave: string, n: number, control: string, rojo = true, cuenta?: AsientoLibroDiario): unknown[] {
  const v = valoresDeclarados([p], lado)
  const r = fila({
    sub: clave, fecha: fechaExcel(p.fecha), tipo: p.tipo, pv: p.puntoVenta, nro: p.numero, cuit: p.cuit, razon: p.denominacion,
    cuenta: cuenta?.cuenta_contable || "", nroCuenta: cuenta?.nro_cuenta || "",
    ...importes(v), dif: difFormula(n, v), comprobantes: 1, origen: "declarado (libro IVA)", control,
  })
  return rojo ? conEstilo(r, ESTILO_ERROR) : r
}

/** Dónde quedó el renglón de totales de una hoja (1-based). Las columnas son las mismas en todas. */
interface DondeTotal { hoja: string; fila: number }

/** Título + encabezado + un renglón por comprobante + TOTAL (SUMA por columna). */
function listado(hoja: string, titulos: string[], asientos: AsientoLibroDiario[], lado: Lado, marcas: MarcasDeFila): { filas: unknown[][]; total: DondeTotal } {
  const f: unknown[][] = titulos.map(t => [t])
  f.push([])
  f.push(ENCABEZADO)
  const desde = f.length + 1
  for (const a of asientos) f.push(filaAsiento(a, lado, f.length + 1, marcas))
  const hasta = f.length
  const n = f.length + 1
  f.push(conEstilo(filaSuma({ sub: "TOTAL", razon: `${asientos.length} comprobante(s)` }, n, desde, hasta, valoresDe(asientos, lado)), ESTILO_TOTAL))
  return { filas: f, total: { hoja, fila: n } }
}

/** El pie del subdiario como se le manda al contador (FC, NC y neto; lo que no da crédito) y contra lo declarado. */
function pieSubdiario(s: SubdiarioDelLado, lado: Lado, d: DatosEntrega, porId: Map<string, AsientoLibroDiario>, inicio: number): unknown[][] {
  const f: unknown[][] = []
  const n = () => inicio + f.length
  const sinCred = tiposSinCredito(lado)
  const esSin = (a: AsientoLibroDiario) => a.tipo != null && sinCred.includes(Number(a.tipo))
  const con = s.asientos.filter(a => !esSin(a)), sin = s.asientos.filter(esSin)
  const renglon = (detalle: string, xs: AsientoLibroDiario[], estilo?: Record<string, unknown>) => {
    const v = valoresDe(xs, lado)
    const r = fila({ razon: detalle, ...importes(v), dif: difFormula(n(), v), comprobantes: v.comprobantes })
    f.push(estilo ? conEstilo(r, estilo) : r)
  }
  f.push([lado === "compras" ? "LIBRO IVA COMPRAS — como el subdiario que se le manda al contador" : "LIBRO IVA VENTAS — como el subdiario que se le manda al contador"])
  renglon("Facturas y débitos (con crédito / débito fiscal)", con.filter(a => a.total >= 0))
  renglon("Notas de crédito (restan)", con.filter(a => a.total < 0))
  if (sin.length) {
    renglon("Comprobantes B y C (sin crédito fiscal)", sin.filter(a => a.total >= 0))
    renglon("Notas de crédito B y C (restan)", sin.filter(a => a.total < 0))
  }
  renglon("Neto del subdiario", s.asientos, ESTILO_SUBTOTAL)
  f.push([])
  if (!s.contra) {
    f.push(["CONTRA LO DECLARADO A ARCA — sin dato: no está el libro IVA presentado de este mes, no se controló."])
    return f
  }
  f.push([s.ok ? "CONTRA LO DECLARADO A ARCA — coincide, columna por columna" : "CONTRA LO DECLARADO A ARCA — NO COINCIDE"])
  f.push(...bloqueMes(s, lado, d, n() , true))
  f.push(...detalleMes(s, lado, porId, n()))
  return f
}

/**
 * Un mes contra lo declarado, en TRES renglones con todas las columnas: la app, lo declarado y la diferencia
 * (con fórmula, columna por columna). Lo usan el pie de cada subdiario y la hoja «Contra ARCA».
 */
function bloqueMes(s: SubdiarioDelLado, lado: Lado, d: DatosEntrega, inicio: number, sinNombre = false): unknown[][] {
  const app = valoresDe(s.asientos, lado)
  const dec = valoresDeclarados(d.presentado?.[s.clave]?.[lado] ?? [], lado)
  const nApp = inicio, nDec = inicio + 1, nDif = inicio + 2
  const etiqueta = sinNombre ? "" : s.nombre
  const dif: Fila = {}
  for (const k of [...COLUMNAS, "comprobantes"] as Campo[]) {
    const va = (app as unknown as Record<string, number>)[k] ?? 0, vd = (dec as unknown as Record<string, number>)[k] ?? 0
    dif[k] = conFormula(`${L(k)}${nApp}-${L(k)}${nDec}`, r2(va - vd), formatoDe(k))
  }
  const c = s.contra!
  const queHacer = s.ok ? "" : [
    c.soloApp.length ? `${c.soloApp.length} en la app y no declarado(s): rectificar el mes o reimputarlo a un mes abierto (entra a provisión)` : "",
    c.soloPresentado.length ? `${c.soloPresentado.length} declarado(s) y no en la app: cargarlo(s) y provisionar` : "",
    c.importeDistinto.length || c.otroNumero.some(x => Math.abs(x.diferencia) > TOL) ? "importes distintos: corregir la carga o rectificar" : "",
  ].filter(Boolean).join(" · ") || "revisar el IVA de los comprobantes del mes"
  const difFila = fila({ sub: etiqueta, razon: "Diferencia (app − declarado)", ...dif, control: s.ok ? "coincide" : `NO COINCIDE — ${queHacer}` })
  return [
    fila({ sub: etiqueta, razon: "En la app (este subdiario)", ...importes(app), dif: difFormula(nApp, app), comprobantes: app.comprobantes, origen: "app" }),
    fila({ sub: etiqueta, razon: "Declarado (libro IVA)", ...importes(dec), dif: difFormula(nDec, dec), comprobantes: dec.comprobantes, origen: "declarado (libro IVA)" }),
    s.ok ? difFila : conEstilo(difFila, ESTILO_ERROR),
  ]
}

/** Los comprobantes que explican la diferencia de un mes, cada uno con la fila única de columnas. */
function detalleMes(s: SubdiarioDelLado, lado: Lado, porId: Map<string, AsientoLibroDiario>, inicio: number): unknown[][] {
  const c = s.contra
  if (!c) return []
  const f: unknown[][] = []
  const n = () => inicio + f.length
  const app = (id: string, control: string) => {
    const a = porId.get(id)
    if (a) f.push(conEstilo(filaAsiento(a, lado, n(), undefined, control), ESTILO_ERROR))
  }
  for (const x of c.soloApp) app(x.id, "NO DECLARADO: está en la app y no en el libro IVA")
  for (const p of c.soloPresentado) f.push(filaDeclarada(p, lado, s.clave, n(), "DECLARADO Y NO ESTÁ EN LA APP"))
  for (const x of c.importeDistinto) {
    const por = explicarDiferencia(x.diferencia, x.presentado)
    app(x.app.id, `OTRO IMPORTE: así está en la app${por ? ` — ${por}` : ""}`)
    f.push(filaDeclarada(x.presentado, lado, s.clave, n(), `OTRO IMPORTE: así se declaró (diferencia ${fmt(x.diferencia)})`))
  }
  for (const x of c.otroNumero) {
    const igual = Math.abs(x.diferencia) <= TOL
    app(x.app.id, igual ? "OTRO NÚMERO: así está en la app (mismo importe)" : "OTRO NÚMERO Y OTRO IMPORTE: así está en la app")
    f.push(filaDeclarada(x.presentado, lado, s.clave, n(), igual ? "OTRO NÚMERO: así se declaró — corregir la carga en la app" : `así se declaró (diferencia ${fmt(x.diferencia)})`))
  }
  if (f.length) f.unshift(["Los comprobantes que no coinciden — cada uno como está en la app y como se declaró:"])
  return f
}

/** Agrupa comprobantes por cuenta: por NÚMERO cuando lo hay (la regla del usuario), si no por nombre. */
const claveCuenta = (a: AsientoLibroDiario) =>
  a.cuenta_contable?.trim() ? (a.nro_cuenta?.trim() ? `nro:${a.nro_cuenta.trim()}` : `nombre:${a.cuenta_contable.trim()}`) : `nombre:${SIN_IMPUTAR}`
function porCuenta(asientos: AsientoLibroDiario[]): { cuenta: string; nroCuenta: string; asientos: AsientoLibroDiario[] }[] {
  const m = new Map<string, { cuenta: string; nroCuenta: string; asientos: AsientoLibroDiario[] }>()
  for (const a of asientos) {
    const k = claveCuenta(a)
    const nombre = a.cuenta_contable?.trim() || SIN_IMPUTAR
    const g = m.get(k) ?? { cuenta: nombre, nroCuenta: a.nro_cuenta?.trim() ?? "", asientos: [] }
    // Una cuenta con dos nombres («TELEFONOS E INTERNET» / «Telefonos e internet», las dos 422123) se muestra con los dos.
    if (!g.cuenta.split(" / ").includes(nombre)) g.cuenta = `${g.cuenta} / ${nombre}`
    g.asientos.push(a)
    m.set(k, g)
  }
  return [...m.values()].sort((a, b) => (a.cuenta === SIN_IMPUTAR ? 1 : b.cuenta === SIN_IMPUTAR ? -1 : a.cuenta.localeCompare(b.cuenta, "es")))
}
const productosDe = (xs: AsientoLibroDiario[]) => [...new Set(xs.map(a => a.cantidades?.producto).filter(Boolean))].join(" · ")
const marcadosEn = (xs: AsientoLibroDiario[], marcas: MarcasDeFila) => {
  const k = xs.filter(a => marcas.textos.has(a.id)).length
  return k ? `${k} comprobante(s) con marca — ver el detalle en su subdiario` : ""
}

/** Por mes y cuenta: un renglón por cuenta de cada subdiario, el subtotal del mes (se pliega) y el total. */
function hojaPorMes(hoja: string, titulo: string, subs: SubdiarioDelLado[], lado: Lado, marcas: MarcasDeFila): { filas: unknown[][]; total: DondeTotal } {
  const f: unknown[][] = [[titulo], ["Un renglón por cuenta contable de cada subdiario; cada mes se pliega a su subtotal (+ / − a la izquierda)."], []]
  f.push(ENCABEZADO)
  const niveles: number[] = f.map(() => 0)
  const primera = f.length + 1
  const todos: AsientoLibroDiario[] = []
  for (const s of subs) {
    if (!s.asientos.length) continue
    const desde = f.length + 1
    for (const g of porCuenta(s.asientos)) {
      const n = f.length + 1
      const v = valoresDe(g.asientos, lado)
      const m = marcadosEn(g.asientos, marcas)
      const r = fila({ sub: s.clave, cuenta: g.cuenta, nroCuenta: g.nroCuenta, ...importes(v), dif: difFormula(n, v), comprobantes: v.comprobantes,
        producto: productosDe(g.asientos), toneladas: v.toneladas || "", cabezas: v.cabezas || "", kilos: v.kilos || "", control: m })
      f.push(m ? conEstilo(r, ESTILO_ERROR) : r)
      niveles.push(1)
    }
    const hasta = f.length
    const n = f.length + 1
    const m = marcadosEn(s.asientos, marcas)
    f.push(conEstilo(filaSuma({ sub: s.clave, razon: `Total ${s.nombre}`, control: m }, n, desde, hasta, valoresDe(s.asientos, lado), "SUBTOTAL"), ESTILO_SUBTOTAL))
    niveles.push(0)
    todos.push(...s.asientos)
  }
  const n = f.length + 1
  f.push(conEstilo(filaSuma({ sub: "TOTAL", razon: "TOTAL DEL EJERCICIO" }, n, primera, f.length, valoresDe(todos, lado), "SUBTOTAL"), ESTILO_TOTAL))
  niveles.push(0)
  plegar(f, niveles)
  return { filas: f, total: { hoja, fila: n } }
}

/** Por campaña y cuenta: el ejercicio entero, un renglón por cuenta; y el control contra «por mes y cuenta». */
function hojaPorCampana(hoja: string, titulo: string, etiqueta: string, asientos: AsientoLibroDiario[], lado: Lado, marcas: MarcasDeFila, porMes: DondeTotal): { filas: unknown[][]; total: DondeTotal } {
  const f: unknown[][] = [[titulo], ["El ejercicio entero, un renglón por cuenta. Tiene que dar lo mismo que «por mes y cuenta», columna por columna (abajo)."], []]
  f.push(ENCABEZADO)
  const desde = f.length + 1
  for (const g of porCuenta(asientos)) {
    const n = f.length + 1
    const v = valoresDe(g.asientos, lado)
    const m = marcadosEn(g.asientos, marcas)
    const r = fila({ sub: etiqueta, cuenta: g.cuenta, nroCuenta: g.nroCuenta, ...importes(v), dif: difFormula(n, v), comprobantes: v.comprobantes,
      producto: productosDe(g.asientos), toneladas: v.toneladas || "", cabezas: v.cabezas || "", kilos: v.kilos || "", control: m })
    f.push(m ? conEstilo(r, ESTILO_ERROR) : r)
  }
  const hasta = f.length
  const n = f.length + 1
  const v = valoresDe(asientos, lado)
  f.push(conEstilo(filaSuma({ sub: "TOTAL", razon: "TOTAL DEL EJERCICIO" }, n, desde, hasta, v), ESTILO_TOTAL))
  f.push([])
  // 🧮 El camino inverso: el mismo total que «por mes y cuenta» — mismas columnas, misma letra.
  const nOtro = f.length + 1
  const otro: Fila = {}
  for (const k of SUMABLES) otro[k] = conFormula(ref(porMes.hoja, `${L(k)}${porMes.fila}`), (v as unknown as Record<string, number>)[k] ?? 0, formatoDe(k))
  f.push(fila({ razon: `CONTROL — el total de «${porMes.hoja}»`, ...otro }))
  const dif: Fila = {}
  for (const k of SUMABLES) dif[k] = conFormula(`${L(k)}${n}-${L(k)}${nOtro}`, 0, formatoDe(k))
  f.push(fila({ razon: "Diferencia (tiene que dar 0)", ...dif, control: "coincide" }))
  return { filas: f, total: { hoja, fila: n } }
}

/** «Contra ARCA»: compras y ventas en cuadros separados; cada mes en tres renglones con TODAS las columnas. */
function hojaContraArca(a: AnalisisEntrega, d: DatosEntrega, porId: Map<string, AsientoLibroDiario>): unknown[][] {
  const f: unknown[][] = [["CONTRA LO DECLARADO A ARCA — mes por mes, columna por columna"],
    ["Cada subdiario de la app contra el libro IVA presentado de ese mes (el zip que exporta ARCA). Las B y C van enteras a «sin crédito fiscal» de los dos lados."], []]
  for (const lado of ["compras", "ventas"] as const) {
    const subs = lado === "compras" ? a.compras : a.ventas
    f.push([lado === "compras" ? "COMPRAS" : "VENTAS"])
    f.push(ENCABEZADO)
    const filasApp: number[] = [], filasDec: number[] = []
    for (const s of subs) {
      if (!s.contra) { f.push(fila({ sub: s.nombre, razon: "sin dato de lo declarado — no se controló" })); continue }
      if (!s.asientos.length && !(d.presentado?.[s.clave]?.[lado] ?? []).length) {
        f.push(fila({ sub: s.nombre, razon: "sin comprobantes en la app ni en lo declarado", control: "coincide" }))
        continue
      }
      filasApp.push(f.length + 1); filasDec.push(f.length + 2)
      f.push(...bloqueMes(s, lado, d, f.length + 1))
    }
    // Los totales del ejercicio, también en tres renglones: suma de los renglones de la app y de lo declarado.
    const tot = (filas: number[], valores: Valores, detalle: string, n: number) => {
      const c: Fila = {}
      for (const k of [...COLUMNAS, "comprobantes"] as Campo[]) {
        const valor = (valores as unknown as Record<string, number>)[k] ?? 0
        c[k] = filas.length ? conFormula(filas.map(r => `${L(k)}${r}`).join("+"), valor, formatoDe(k)) : valor
      }
      return conEstilo(fila({ sub: "TOTAL", razon: detalle, ...c, dif: difFormula(n, valores) }), ESTILO_TOTAL)
    }
    const conDato = subs.filter(s => s.contra)
    const vApp = valoresDe(conDato.flatMap(s => s.asientos), lado)
    const vDec = valoresDeclarados(conDato.flatMap(s => d.presentado?.[s.clave]?.[lado] ?? []), lado)
    const nA = f.length + 1
    f.push(tot(filasApp, vApp, "Total en la app", nA))
    f.push(tot(filasDec, vDec, "Total declarado", nA + 1))
    const dif: Fila = {}
    for (const k of [...COLUMNAS, "comprobantes"] as Campo[]) {
      dif[k] = conFormula(`${L(k)}${nA}-${L(k)}${nA + 1}`, r2(((vApp as unknown as Record<string, number>)[k] ?? 0) - ((vDec as unknown as Record<string, number>)[k] ?? 0)), formatoDe(k))
    }
    const okLado = conDato.every(s => s.ok)
    const r = fila({ sub: "TOTAL", razon: "Diferencia (app − declarado)", ...dif, control: okLado ? "coincide" : "NO COINCIDE — el detalle, abajo y en el pie de cada subdiario" })
    f.push(okLado ? conEstilo(r, ESTILO_TOTAL) : conEstilo(r, ESTILO_ERROR))
    f.push([])
  }
  const conDetalle = [...a.compras.map(s => ["compras", s] as const), ...a.ventas.map(s => ["ventas", s] as const)]
    .filter(([, s]) => s.contra && (!s.ok || s.contra.otroNumero.length))
  if (conDetalle.length) {
    f.push(["DETALLE DE LO QUE NO COINCIDE"])
    f.push(ENCABEZADO)
    for (const [lado, s] of conDetalle) f.push(...detalleMes(s, lado, porId, f.length + 1).slice(1))
  }
  return f
}

/**
 * 🧾 Lo declarado TAL CUAL lo exporta ARCA (usuario 27/10: *«dejame una solapa con la original tal cual export
 * ARCA»*): las columnas del CSV del libro IVA, en su orden, un renglón por comprobante de los 12 meses. Sólo se
 * agrega al final de qué mes es (el CSV no lo trae: sale del nombre del zip). Los importes pasan a número para que se
 * puedan sumar; lo demás queda como texto, como viene.
 */
function hojaArcaOriginal(t: TablaOriginal, titulo: string): unknown[][] {
  const f: unknown[][] = [[titulo], ["Tal cual el CSV del zip del libro IVA. La última columna dice de qué mes es."], []]
  f.push([...t.encabezado, "Período (del zip)"])
  const esImporte = (x: string) => /^-?\d+,\d+$/.test(x)
  for (const r of t.filas) f.push([...r.valores.map(x => (esImporte(x) ? Number(x.replace(",", ".")) : x)), r.periodo])
  return f
}

/**
 * 🧾 Lo declarado con NUESTRAS columnas (usuario 27/10: *«y las que equivalen de ARCA las ponemos como las
 * nuestras»*): cada comprobante del libro IVA en la fila única, partido igual que la app (B y C enteras a «sin crédito
 * fiscal»), con la cuenta contable del comprobante de la app que le corresponde y qué pasó con él.
 */
function hojaArcaNuestra(hoja: string, titulo: string, lado: Lado, a: AnalisisEntrega, d: DatosEntrega, porId: Map<string, AsientoLibroDiario>): { filas: unknown[][]; total: DondeTotal } {
  const f: unknown[][] = [[titulo], ["Cada comprobante declarado con las mismas columnas que la app. La columna Control dice si está igual en la app." +
    (lado === "ventas" ? " En ventas el total va BRUTO: se le suma la retención o pago a cuenta que ARCA descuenta (como lo guarda la app)." : "")], []]
  f.push(ENCABEZADO)
  const renglones: { clave: string; p: ComprobantePresentado; app?: AsientoLibroDiario; control: string; mal: boolean }[] = []
  for (const s of (lado === "compras" ? a.compras : a.ventas).filter(x => x.contra)) {
    const c = s.contra!
    const deApp = new Map<ComprobantePresentado, string>([...c.pares.entries()].map(([id, p]) => [p, id]))
    const distinto = new Set(c.importeDistinto.map(x => x.presentado))
    const otro = new Map(c.otroNumero.map(x => [x.presentado, x]))
    for (const p of d.presentado?.[s.clave]?.[lado] ?? []) {
      const id = deApp.get(p)
      const app = id ? porId.get(id) : undefined
      const o = otro.get(p)
      const control = !id ? "NO ESTÁ EN LA APP"
        : distinto.has(p) ? "en la app con OTRO IMPORTE"
        : o ? (Math.abs(o.diferencia) <= TOL ? `en la app con otro número (${app?.tipo ?? "sin tipo"} ${app?.punto_venta ?? "sin pto"}-${app?.numero ?? "sin número"})` : "en la app con otro número y OTRO IMPORTE")
        : "igual en la app"
      renglones.push({ clave: s.clave, p, app, control, mal: !id || distinto.has(p) || (!!o && Math.abs(o.diferencia) > TOL) })
    }
  }
  renglones.sort((x, y) => x.p.fecha.localeCompare(y.p.fecha) || x.p.puntoVenta - y.p.puntoVenta || x.p.numero - y.p.numero)
  const desde = f.length + 1
  for (const r of renglones) f.push(filaDeclarada(r.p, lado, r.clave, f.length + 1, r.control, r.mal, r.app))
  const hasta = f.length
  const n = f.length + 1
  f.push(conEstilo(filaSuma({ sub: "TOTAL", razon: `${renglones.length} comprobante(s) declarados` }, n, desde, hasta,
    valoresDeclarados(renglones.map(r => r.p), lado)), ESTILO_TOTAL))
  return { filas: f, total: { hoja, fila: n } }
}

/**
 * ✍️ «ARCA rectificación»: cada cambio a lo declarado en tres renglones — ANTES (lo presentado), AHORA (rectificado) y el
 * CAMBIO (con fórmula) —, y por lado el total como se presentó, los cambios, el rectificado y la app.
 */
function hojaRectificacionArca(aplicados: AjusteAplicado[], original: Record<string, LoPresentado> | undefined, d: DatosEntrega, a: AnalisisEntrega): unknown[][] {
  const f: unknown[][] = [["ARCA RECTIFICACIÓN — lo declarado antes, el cambio y lo declarado ahora"],
    ["Los zips de ARCA no se modifican: los cambios se aplican encima. «Ahora» es lo que tiene que quedar después de rectificar, y tiene que coincidir con la app."], []]
  f.push(ENCABEZADO)
  for (const x of aplicados) {
    const c = x.ajuste.comprobante
    const comp = `${c.tipo} ${c.puntoVenta}-${c.numero}`
    if (!x.antes) {
      f.push(conEstilo(fila({ sub: x.ajuste.periodo, razon: `${comp} · CUIT ${c.cuit}`, control: `NO SE ENCONTRÓ en lo declarado de ${x.ajuste.periodo} (${x.ajuste.lado}): ${x.ajuste.motivo}` }), ESTILO_ERROR))
      continue
    }
    const vA = valoresDeclarados([x.antes], x.ajuste.lado)
    const vD = x.despues ? valoresDeclarados([x.despues], x.ajuste.lado) : null
    const nA = f.length + 1
    f.push(filaDeclarada(x.antes, x.ajuste.lado, x.ajuste.periodo, nA, `ANTES (como se presentó, ${x.ajuste.lado}) — ${x.ajuste.motivo}`, false))
    const nD = f.length + 1
    f.push(x.despues
      ? filaDeclarada(x.despues, x.ajuste.lado, x.ajuste.periodo, nD, "AHORA (rectificado)", false)
      : fila({ sub: x.ajuste.periodo, razon: `${comp} — se saca del libro`, ...importes({}), comprobantes: 0, origen: "rectificado", control: "AHORA: no va" }))
    const cambio: Fila = {}
    for (const k of [...COLUMNAS, "comprobantes"] as Campo[]) {
      const va = (vA as unknown as Record<string, number>)[k] ?? 0, vd = vD ? (vD as unknown as Record<string, number>)[k] ?? 0 : 0
      cambio[k] = conFormula(`${L(k)}${nD}-${L(k)}${nA}`, r2(vd - va), formatoDe(k))
    }
    f.push(conEstilo(fila({ sub: x.ajuste.periodo, razon: "CAMBIO", ...cambio,
      control: (vD ? r2(vD.iva - vA.iva) : -vA.iva) === 0 ? "no modifica IVA" : "MODIFICA IVA" }), ESTILO_SUBTOTAL))
    f.push([])
  }
  f.push(["POR LADO — como se presentó, los cambios, rectificado y la app"])
  f.push(ENCABEZADO)
  for (const lado of ["compras", "ventas"] as const) {
    const subs = (lado === "compras" ? a.compras : a.ventas).filter(s => s.contra)
    const antes = valoresDeclarados(subs.flatMap(s => original?.[s.clave]?.[lado] ?? []), lado)
    const ahora = valoresDeclarados(subs.flatMap(s => d.presentado?.[s.clave]?.[lado] ?? []), lado)
    const app = valoresDe(subs.flatMap(s => s.asientos), lado)
    const n0 = f.length + 1
    f.push(fila({ sub: lado, razon: "Declarado — como se presentó", ...importes(antes), comprobantes: antes.comprobantes }))
    f.push(fila({ sub: lado, razon: "Declarado — rectificado", ...importes(ahora), comprobantes: ahora.comprobantes }))
    f.push(fila({ sub: lado, razon: "App", ...importes(app), comprobantes: app.comprobantes }))
    const dif: Fila = {}
    for (const k of [...COLUMNAS, "comprobantes"] as Campo[]) {
      dif[k] = conFormula(`${L(k)}${n0 + 2}-${L(k)}${n0 + 1}`, r2(((app as unknown as Record<string, number>)[k] ?? 0) - ((ahora as unknown as Record<string, number>)[k] ?? 0)), formatoDe(k))
    }
    const ok = Math.abs(app.total - ahora.total) <= TOL && Math.abs(app.iva - ahora.iva) <= TOL
    f.push(conEstilo(fila({ sub: lado, razon: "App − rectificado", ...dif, control: ok ? "coincide" : "NO COINCIDE" }), ok ? ESTILO_TOTAL : ESTILO_ERROR))
    f.push([])
  }
  return f
}

/** La cadena de la hoja Control: un camino por renglón, con la fila única de columnas leída de cada hoja. */
interface Paso { camino: string; donde: DondeTotal[] | null; valores: Totales | null; nota?: string }

/** La primera hoja: qué se puede informar, la cadena, y lo que hay que rectificar antes. */
function hojaControl(d: DatosEntrega, a: AnalisisEntrega, cadena: Record<Lado, Paso[]>, porId: Map<string, AsientoLibroDiario>): unknown[][] {
  const { libro } = d
  const f: unknown[][] = []
  f.push([`LIBRO DIARIO — ${d.empresa} — ejercicio ${libro.ejercicio.etiqueta}`])
  f.push([`Los 12 subdiarios: ${a.compras[0]?.nombre ?? ""} a ${a.compras[a.compras.length - 1]?.nombre ?? ""} · cierre ${libro.ejercicio.fechaCierre}${d.generado ? ` · generado ${d.generado}` : ""}`])
  f.push(["El período se corta por el subdiario en que entró cada comprobante, no por su fecha. Todas las hojas tienen las mismas columnas, en el mismo lugar."])
  f.push([])
  const porQue = [
    a.aRectificar.length ? `${a.aRectificar.length} mes(es) a rectificar` : "",
    a.tipoSigno.filter(t => !t.aceptado).length ? `${a.tipoSigno.filter(t => !t.aceptado).length} con tipo y signo cruzados` : "",
    a.descuadres.compras.length + a.descuadres.ventas.length ? `${a.descuadres.compras.length + a.descuadres.ventas.length} comprobante(s) cuyas partes no suman su total` : "",
  ].filter(Boolean)
  f.push([a.sePuedeInformar ? "CONTROL OK — se puede informar" : `NO INFORMAR TODAVÍA — ${porQue.join(" · ")} (abajo, qué y dónde)`])
  f.push([])

  // 1 · La cadena
  f.push(["1 · EL MISMO NÚMERO POR TODOS LOS CAMINOS — columna por columna"])
  for (const lado of ["compras", "ventas"] as const) {
    f.push([lado === "compras" ? "COMPRAS" : "VENTAS"])
    f.push(ENCABEZADO)
    const base = cadena[lado][0].valores
    for (const paso of cadena[lado]) {
      const n = f.length + 1
      const v = paso.valores
      if (!v) { f.push(fila({ razon: paso.camino, control: paso.nota ?? "sin dato" })); continue }
      const celdas: Fila = {}
      for (const k of [...COLUMNAS, "comprobantes"] as Campo[]) {
        const valor = (v as unknown as Record<string, number>)[k] ?? 0
        celdas[k] = paso.donde?.length ? conFormula(paso.donde.map(x => ref(x.hoja, `${L(k)}${x.fila}`)).join("+"), valor, formatoDe(k)) : valor
      }
      const dt = base ? r2(v.total - base.total) : 0
      f.push(fila({ razon: paso.camino, ...celdas, dif: difFormula(n, v),
        control: paso.nota ?? (paso === cadena[lado][0] ? "" : Math.abs(dt) <= TOL ? "coincide" : `NO COINCIDE (${fmt(dt)})`) }))
    }
    f.push([])
  }

  // 2 · Lo que hay que rectificar
  f.push(["2 · ANTES DE INFORMAR — RECTIFICAR"])
  if (!a.aRectificar.length && !a.descuadres.compras.length && !a.descuadres.ventas.length && !a.tipoSigno.length) f.push(["coincide — no hay nada que rectificar"])
  if (a.aRectificar.length) {
    f.push([`Meses a rectificar con el contador o a reimputar: ${a.aRectificar.length} — ${a.aRectificar.map(x => x.nombre).join(" · ")}`])
    for (const x of a.aRectificar) for (const [i, m] of x.motivos.entries()) f.push(conEstilo(fila({ sub: i === 0 ? x.nombre : "", razon: m }), ESTILO_ERROR))
    f.push(["Qué hacer, según el caso: cargar y provisionar lo declarado que falta · reimputar a un mes abierto lo no declarado (entra a provisión) · o rectificar el mes con el contador."])
    f.push([])
  }
  // Papel / cargado / declarado: el mismo comprobante tres veces, con las mismas columnas.
  f.push([a.papelDistinto.length
    ? `PAPEL ≠ CARGADO — ${a.papelDistinto.length} comprobante(s): lo cargado no es lo que dice el papel`
    : `PAPEL vs. CARGADO — coincide en los ${(d.papeles ?? []).length} comprobantes que tienen el papel leído (endosos de Pólizas)`])
  if (a.papelDistinto.length) {
    f.push(ENCABEZADO)
    for (const p of a.papelDistinto) {
      const x = p.asiento
      f.push(conEstilo(fila({ sub: x.subdiario, fecha: fechaExcel(x.fecha), tipo: p.papel.esNotaCredito ? "NC" : "", pv: x.punto_venta ?? "", nro: x.numero ?? "", cuit: x.cuit,
        razon: x.denominacion, total: p.papel.total, origen: `papel: ${p.papel.origen}`,
        control: p.papel.esNotaCredito ? "el PDF es NOTA DE CRÉDITO (en negativo)" : "lo que dice el PDF" }), ESTILO_ERROR))
      f.push(filaAsiento(x, "compras", f.length + 1, undefined,
        p.papel.esNotaCredito && x.total > 0 ? "cargado como FACTURA: suma al gasto en vez de restar" : "así está cargado"))
      if (p.declarado) {
        f.push(filaDeclarada(p.declarado, "compras", x.subdiario, f.length + 1,
          Math.abs(p.declarado.total - x.total) <= TOL ? "declarado IGUAL que lo cargado: el error viajó a la DDJJ → rectificar con el contador" : "así se declaró"))
      }
    }
    const efecto = r2(a.papelDistinto.reduce((s, p) => s + p.diferencia, 0))
    f.push(fila({ razon: "Efecto en el resultado (papel − cargado)", total: efecto, control: efecto < 0 ? `el gasto está inflado en ${fmt(-efecto)}` : `el gasto está corto en ${fmt(efecto)}` }))
  }
  f.push([])
  const cruzados = a.tipoSigno.filter(t => !t.aceptado).length
  f.push([cruzados
    ? `TIPO vs. SIGNO — ${cruzados} comprobante(s) con el tipo y el signo cruzados`
    : a.tipoSigno.length ? `TIPO vs. SIGNO — coincide (${a.tipoSigno.length} factura(s) en negativo aceptadas: el papel de la póliza lo confirma)`
    : `TIPO vs. SIGNO — coincide en los ${libro.compras.length + libro.ventas.length} comprobantes (ninguna nota de crédito en positivo ni factura en negativo)`])
  for (const t of a.tipoSigno) {
    const r = filaAsiento(t.asiento, t.lado, f.length + 1, undefined, t.motivo)
    f.push(t.aceptado ? r : conEstilo(r, ESTILO_ERROR))
  }
  f.push([])
  f.push([a.otroNumero.length
    ? `AVISO — ${a.otroNumero.length} comprobante(s) declarados con OTRO TIPO O NÚMERO que en la app, por el mismo importe: no cambia montos, hay que corregir la carga`
    : "NÚMEROS — coinciden con lo declarado en todos los comprobantes emparejados"])
  if (a.otroNumero.length) {
    f.push(ENCABEZADO)
    for (const x of a.otroNumero) {
      const as = porId.get(x.app.id)
      if (as) f.push(filaAsiento(as, x.lado, f.length + 1, undefined, `declarado como ${x.presentado.tipo} ${x.presentado.puntoVenta}-${x.presentado.numero}`))
    }
  }
  f.push([])
  const desc = [...a.descuadres.compras, ...a.descuadres.ventas]
  f.push([desc.length ? `COMPROBANTES CUYAS PARTES NO SUMAN SU TOTAL — ${desc.length} (la columna «Total − columnas» dice cuánto)` : "PARTES vs. TOTAL — cuadra en todos los comprobantes"])
  if (desc.length) {
    f.push(ENCABEZADO)
    const lados = new Map<string, Lado>([...libro.ventas.map(x => [x.id, "ventas"] as const), ...libro.compras.map(x => [x.id, "compras"] as const)])
    for (const x of desc) {
      const as = x.id ? porId.get(x.id) : undefined
      if (as) f.push(conEstilo(filaAsiento(as, lados.get(as.id) ?? "compras", f.length + 1, undefined, marcaDescuadre(x)), ESTILO_ERROR))
    }
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
  f.push(["4 · QUÉ HAY EN CADA HOJA — todas con las mismas columnas"])
  f.push(["C AAAA-MM / V AAAA-MM: los subdiarios de compras y de ventas, uno por hoja (los meses sin comprobantes no van), con su pie contra lo declarado"])
  f.push(["Compras · Ventas: todos los comprobantes del ejercicio, ordenados por fecha"])
  f.push(["… por mes y cuenta: un renglón por cuenta de cada mes, con el subtotal del mes (se pliega con + / −)"])
  f.push(["… por campaña y cuenta: el ejercicio entero por cuenta contable (agrupado por número de cuenta)"])
  f.push(["Contra ARCA: cada mes en tres renglones — la app, lo declarado y la diferencia —, compras y ventas por separado"])
  f.push(["ARCA … formato nuestro: cada comprobante declarado con las columnas de la app, y si está igual en la app"])
  f.push(["ARCA … original: el libro IVA declarado tal cual lo exporta ARCA (sus columnas)"])
  return f
}

/**
 * 🧾 Las VENTAS declaradas, como las guarda la app: el total BRUTO. En las liquidaciones (tipos 60 / 180) ARCA declara el
 * total ya descontada la retención o el pago a cuenta (va como «otros» en negativo); la app guarda el bruto y la retención
 * aparte. Error mío del 27/10, visto por JMS: comparaba bruto contra neto y marcaba diferencias que no existían (Sáenz
 * Valiente −330.665,50 y −270.618; Genta −970.830 — neto e IVA iguales al centavo). Se suma de vuelta para comparar.
 */
export function ventasComoLaApp(presentado: Record<string, LoPresentado> | undefined): Record<string, LoPresentado> | undefined {
  if (!presentado) return presentado
  return Object.fromEntries(Object.entries(presentado).map(([k, v]) => [k, {
    compras: v.compras,
    ventas: v.ventas.map(p => ((p.otrosTributos ?? 0) < 0 ? { ...p, total: r2(p.total - (p.otrosTributos ?? 0)), otrosTributos: 0 } : p)),
  }]))
}

/**
 * 📅 **Resumen 12 meses** — el formato de la hoja de los papeles de la app (JMS 27/10: *«me ayudaba a ver bien… el
 * formato es lo que quiero»*), pero contra lo DECLARADO de los zips **ya rectificado** (hoja «ARCA rectificación»), no
 * contra el total fijo de `presentado-arca.ts`: con ése, enero y abril seguían en NO COINCIDE por las NC de Federación.
 * Y suma ventas contra ARCA, que este libro también controla.
 */
function hojaResumen12Meses(d: DatosEntrega, a: AnalisisEntrega): unknown[][] {
  const { libro } = d
  const f: unknown[][] = []
  f.push([`RESUMEN DE LOS 12 MESES — ejercicio ${libro.ejercicio.etiqueta}`])
  f.push(["Por subdiario (el mes en que entró cada comprobante). ARCA = lo declarado en los zips, ya rectificado (ver «ARCA rectificación»); ventas en bruto."])
  f.push([])
  f.push(["Subdiario", "Compras: comprobantes", "Compras: total", "Ventas: comprobantes", "Ventas: total",
    "ARCA compras: comprobantes", "ARCA compras: total declarado", "Diferencia compras − ARCA",
    "ARCA ventas: comprobantes", "ARCA ventas: total declarado", "Diferencia ventas − ARCA", "Control"])
  const n0 = f.length + 1
  const suma = { cc: 0, tc: 0, cv: 0, tv: 0 }
  a.compras.forEach((c, i) => {
    const v = a.ventas[i]
    const tc = r2(c.totales.total), tv = r2(v.totales.total)
    suma.cc += c.totales.comprobantes; suma.tc += tc; suma.cv += v.totales.comprobantes; suma.tv += tv
    const n = f.length + 1
    const pc = c.contra?.totales.presentado, pv = v.contra?.totales.presentado
    const control = c.ok === null && v.ok === null ? "sin dato de ARCA"
      : [c.ok === false ? "compras NO COINCIDE" : "", v.ok === false ? "ventas NO COINCIDE" : ""].filter(Boolean).join(" · ") || "coincide"
    const fila: unknown[] = [
      c.nombre, c.totales.comprobantes, tc, v.totales.comprobantes, tv,
      pc ? pc.comprobantes : "sin dato", pc ? r2(pc.total) : "sin dato", pc ? conFormula(`C${n}-G${n}`, r2(tc - pc.total)) : "",
      pv ? pv.comprobantes : "sin dato", pv ? r2(pv.total) : "sin dato", pv ? conFormula(`E${n}-J${n}`, r2(tv - pv.total)) : "",
      control,
    ]
    // 🛑 El mes que no coincide con ARCA, en rojo: se ve sin leer la columna Control.
    f.push(c.ok === false || v.ok === false ? conEstilo(fila, ESTILO_ERROR) : fila)
  })
  const nU = f.length
  const nT = f.length + 1
  const sumaCol = (col: string) => `SUM(${col}${n0}:${col}${nU})`
  const decl = (l: SubdiarioDelLado[]) => l.reduce((t, s) => ({ c: t.c + (s.contra?.totales.presentado.comprobantes ?? 0), t: t.t + (s.contra?.totales.presentado.total ?? 0) }), { c: 0, t: 0 })
  const dc = decl(a.compras), dv = decl(a.ventas)
  f.push(conEstilo(["TOTAL",
    conFormula(sumaCol("B"), suma.cc, ENTERO), conFormula(sumaCol("C"), r2(suma.tc), MONEDA),
    conFormula(sumaCol("D"), suma.cv, ENTERO), conFormula(sumaCol("E"), r2(suma.tv), MONEDA),
    conFormula(sumaCol("F"), dc.c, ENTERO), conFormula(sumaCol("G"), r2(dc.t), MONEDA), conFormula(`C${nT}-G${nT}`, r2(suma.tc - dc.t), MONEDA),
    conFormula(sumaCol("I"), dv.c, ENTERO), conFormula(sumaCol("J"), r2(dv.t), MONEDA), conFormula(`E${nT}-J${nT}`, r2(suma.tv - dv.t), MONEDA),
  ], ESTILO_TOTAL))
  // 🧮 El camino inverso: la suma de los 12 renglones tiene que ser el total del ejercicio del libro diario.
  f.push([])
  f.push(["CONTROL", "", "Compras", "", "Ventas"])
  f.push(["Total del ejercicio (libro diario)", "", r2(libro.controles.compras.totalGeneral), "", r2(libro.controles.ventas.totalGeneral)])
  const dC = r2(suma.tc - libro.controles.compras.totalGeneral), dV = r2(suma.tv - libro.controles.ventas.totalGeneral)
  const nD = f.length + 1
  f.push(["Suma de los 12 meses − total (tiene que dar 0)", "", conFormula(`C${nT}-C${nD - 1}`, dC, MONEDA), "", conFormula(`E${nT}-E${nD - 1}`, dV, MONEDA),
    "", "", "", "", "", "", Math.abs(dC) < 0.01 && Math.abs(dV) < 0.01 ? "cuadra" : "NO CUADRA"])
  return f
}
const COLS_RESUMEN_12: Columna[] = [
  { ancho: 16 }, { ancho: 12, z: ENTERO }, { ancho: 18, z: MONEDA }, { ancho: 12, z: ENTERO }, { ancho: 18, z: MONEDA },
  { ancho: 12, z: ENTERO }, { ancho: 20, z: MONEDA }, { ancho: 18, z: MONEDA },
  { ancho: 12, z: ENTERO }, { ancho: 20, z: MONEDA }, { ancho: 18, z: MONEDA }, { ancho: 24 },
]

/** Arma el libro entero. El orden de las hojas es el de su pedido, con el Control primero. */
export function armarEntregaLibroDiario(datos: DatosEntrega): { wb: XLSX.WorkBook; analisis: AnalisisEntrega } {
  const original = ventasComoLaApp(datos.presentado)
  const rect = aplicarAjustes(original, datos.ajustesArca ?? [])
  const d: DatosEntrega = { ...datos, presentado: rect.ahora }
  const a = analizarEntrega(d)
  const marcas = marcasDeFilas(a)
  const { libro } = d
  const etiqueta = libro.ejercicio.etiqueta
  const porId = new Map([...libro.compras, ...libro.ventas].map(x => [x.id, x]))

  const hojas: { nombre: string; filas: unknown[][] }[] = []
  const totalesSub: Record<Lado, DondeTotal[]> = { compras: [], ventas: [] }

  // 1 · Los 24 subdiarios (los vacíos no van).
  for (const lado of ["compras", "ventas"] as const) {
    for (const s of lado === "compras" ? a.compras : a.ventas) {
      if (!s.asientos.length) continue
      const nombre = nombreHoja(lado, s.clave)
      const origen = s.asientos.some(x => x.fuente === "historico") ? "sistema anterior (lo que se presentó)" : "la app"
      const l = listado(nombre, [`SUBDIARIO DE ${lado === "compras" ? "COMPRAS" : "VENTAS"} — ${s.nombre} — ${d.empresa}`, `Origen: ${origen}`], s.asientos, lado, marcas)
      totalesSub[lado].push(l.total)
      const inicioPie = l.filas.length + 2
      hojas.push({ nombre, filas: [...l.filas, [], ...pieSubdiario(s, lado, d, porId, inicioPie)] })
    }
  }

  // 2 · Todas las compras y todas las ventas, por fecha.
  const planilla: Record<Lado, DondeTotal | null> = { compras: null, ventas: null }
  for (const lado of ["compras", "ventas"] as const) {
    const nombre = lado === "compras" ? "Compras" : "Ventas"
    const lista = [...(lado === "compras" ? libro.compras : libro.ventas)].sort(porFecha)
    const l = listado(nombre, [`${lado === "compras" ? "TODAS LAS COMPRAS" : "TODAS LAS VENTAS"} DEL EJERCICIO ${etiqueta} — por fecha`,
      "Los totales tienen que dar lo mismo que la suma de los subdiarios (hoja Control, punto 1)."], lista, lado, marcas)
    planilla[lado] = l.total
    hojas.push({ nombre, filas: l.filas })
  }

  // 3 · Por mes y cuenta.  4 · Por campaña y cuenta.
  const porMes: Record<Lado, DondeTotal> = { compras: { hoja: "", fila: 0 }, ventas: { hoja: "", fila: 0 } }
  const porCampana: Record<Lado, DondeTotal | null> = { compras: null, ventas: null }
  for (const lado of ["compras", "ventas"] as const) {
    const nombre = lado === "compras" ? "Compras por mes y cuenta" : "Ventas por mes y cuenta"
    const h = hojaPorMes(nombre, `${lado === "compras" ? "COMPRAS" : "VENTAS"} POR MES Y CUENTA — ejercicio ${etiqueta}`, lado === "compras" ? a.compras : a.ventas, lado, marcas)
    porMes[lado] = h.total
    hojas.push({ nombre, filas: h.filas })
  }
  for (const lado of ["compras", "ventas"] as const) {
    const nombre = lado === "compras" ? "Compras por campaña y cuenta" : "Ventas por campaña y cuenta"
    const h = hojaPorCampana(nombre, `${lado === "compras" ? "COMPRAS" : "VENTAS"} POR CUENTA — campaña ${etiqueta}`, etiqueta,
      lado === "compras" ? libro.compras : libro.ventas, lado, marcas, porMes[lado])
    porCampana[lado] = h.total
    hojas.push({ nombre, filas: h.filas })
  }

  // 5 · Contra ARCA, y lo declarado: con nuestras columnas y tal cual lo exporta ARCA.
  hojas.push({ nombre: "Contra ARCA", filas: hojaContraArca(a, d, porId) })
  if (rect.aplicados.length) hojas.push({ nombre: "ARCA rectificación", filas: hojaRectificacionArca(rect.aplicados, original, d, a) })
  const declarado: Record<Lado, DondeTotal | null> = { compras: null, ventas: null }
  for (const lado of ["compras", "ventas"] as const) {
    if (!(lado === "compras" ? a.compras : a.ventas).some(s => s.contra)) continue
    const nombre = lado === "compras" ? "ARCA compras - formato nuestro" : "ARCA ventas - formato nuestro"
    const h = hojaArcaNuestra(nombre, `${lado === "compras" ? "COMPRAS" : "VENTAS"} DECLARADAS (libro IVA) — con las columnas de la app`, lado, a, d, porId)
    declarado[lado] = h.total
    hojas.push({ nombre, filas: h.filas })
  }
  const originales: { nombre: string; filas: unknown[][] }[] = []
  for (const lado of ["compras", "ventas"] as const) {
    const t = d.arcaOriginal?.[lado]
    if (t && t.filas.length) originales.push({ nombre: lado === "compras" ? "ARCA compras - original" : "ARCA ventas - original",
      filas: hojaArcaOriginal(t, `${lado === "compras" ? "COMPRAS" : "VENTAS"} — libro IVA declarado, tal cual lo exporta ARCA`) })
  }

  // La cadena de la hoja Control: los mismos totales, leídos de cada hoja con fórmula (misma columna en todas).
  const cadena = Object.fromEntries((["compras", "ventas"] as const).map(lado => {
    const subs = lado === "compras" ? a.compras : a.ventas
    const conDato = subs.filter(s => s.contra)
    const pres = conDato.length ? valoresDeclarados(conDato.flatMap(s => d.presentado?.[s.clave]?.[lado] ?? []), lado) : null
    const sumaSubs = sumar(subs.flatMap(s => s.asientos), lado)
    const sinDato = subs.length - conDato.length
    const pasos: Paso[] = [
      { camino: `Los subdiarios (${totalesSub[lado].length} hojas)`, donde: totalesSub[lado], valores: sumaSubs },
      { camino: `Todas las ${lado} por fecha`, donde: planilla[lado] ? [planilla[lado]!] : null, valores: sumar(lado === "compras" ? libro.compras : libro.ventas, lado) },
      { camino: "Por mes y cuenta", donde: [porMes[lado]], valores: sumaSubs },
      { camino: "Por campaña y cuenta", donde: porCampana[lado] ? [porCampana[lado]!] : null, valores: sumaSubs },
      ...(rect.aplicados.some(x => x.ajuste.lado === lado) ? [{
        camino: "Declarado a ARCA — como se presentó", donde: null,
        valores: conDato.length ? valoresDeclarados(conDato.flatMap(s => original?.[s.clave]?.[lado] ?? []), lado) : null,
        nota: "antes de rectificar (los zips tal cual) — ver «ARCA rectificación»",
      }] : []),
      { camino: rect.aplicados.some(x => x.ajuste.lado === lado) ? "Declarado a ARCA — RECTIFICADO" : "Declarado a ARCA (libros IVA)",
        donde: declarado[lado] ? [declarado[lado]!] : null, valores: pres,
        nota: !pres ? "sin dato de lo presentado" : sinDato ? `${sinDato} mes(es) sin dato`
          : Math.abs(pres.total - sumaSubs.total) <= TOL ? "coincide" : `NO COINCIDE (${fmt(r2(sumaSubs.total - pres.total))}) — ver «Contra ARCA»` },
    ]
    return [lado, pasos]
  })) as Record<Lado, Paso[]>

  const wb = XLSX.utils.book_new()
  agregarHoja(wb, "Control", hojaControl(d, a, cadena, porId), COLS)
  agregarHoja(wb, "Resumen 12 meses", hojaResumen12Meses(d, a), COLS_RESUMEN_12)
  for (const h of hojas) agregarHoja(wb, h.nombre, h.filas, COLS)
  // Lo original de ARCA va con SUS columnas (no la fila única): es la referencia tal cual.
  for (const h of originales) agregarHoja(wb, h.nombre, h.filas)
  return { wb, analisis: a }
}

export function nombreArchivoEntrega(d: DatosEntrega, hoy: string): string {
  return `Libro diario ${d.empresa} ${d.libro.ejercicio.etiqueta.replace("/", "-")} (${hoy}).xlsx`
}
