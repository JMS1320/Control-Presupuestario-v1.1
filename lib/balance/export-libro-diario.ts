/**
 * 📗 EL EXCEL DE LOS PAPELES DE TRABAJO — A-FEAT-1184.
 *
 * Arma el archivo que se le manda al contador. **Una solapa por papel**, como el usuario los venía
 * mandando a mano, para que del otro lado no haya que aprender nada nuevo.
 *
 * ## 🧮 La primera solapa es el CONTROL, y eso es a propósito
 *
 * No es un anexo al final: es **lo primero que se abre**. Si el libro no se puede entregar, hay que
 * enterarse antes de mirar ningún número, no después de mandarlo (§ 🧮 de `CLAUDE.md`: *el control
 * se ve, y es proporcional*).
 *
 * ## ⚠️ Y el archivo SALE IGUAL aunque el control no cierre
 *
 * Instrucción explícita del usuario (2026-09-28): *«sería bueno que el export se termine y dé la
 * info. que estará mal hasta que yo después no corrija algunos datos como ya vimos»*. Entonces el
 * export **nunca se niega a generar**: lo que hace es **decir en la cara** qué está mal y por qué
 * ese número no se puede entregar todavía. Frenar la generación le sacaría la herramienta justo
 * cuando la necesita para encontrar el problema.
 */
// 🎨 `xlsx-js-style` (misma API) para que el Excel guarde negrita y colores — ver `presentarHoja`.
// Import por DEFAULT: el paquete es CommonJS (ver lib/presupuesto/export.ts).
import XLSX from "xlsx-js-style"
import { lecturaIncompleta, type Lectura } from "@/lib/supabase-paginado"
import { ETIQUETA_CONCEPTO, type ImpuestoCheque } from "./impuesto-cheque"
import { controlarCheque, chequeEnPapel08, chequeEnTemplates, type ControlCheque } from "./control-cheque"
import type { LibroDiario, AsientoLibroDiario } from "./libro-diario"
import { armarEjercicio, nombreSubdiario } from "./ejercicio"
import { explicarFila } from "./facturas-fijas"
import { armarLibroPorCuenta, TIPOS_SIN_CREDITO_VENTAS, SIN_IMPUTAR, type LibroPorCuenta } from "./libro-por-cuenta"
import type { Descuadre } from "@/lib/subdiarios/cuadratura"
import type { CuentasAlCierre, FilaCuenta } from "./cuentas-al-cierre"
import type { CadenaDeSaldos } from "./saldos-al-inicio"
import type { SueldosDelEjercicio, FilaSueldo } from "./sueldos-balance"
import { leyendaSaldo } from "@/lib/proveedores/cuenta-corriente"
import type { PapelDeCuentasCorrientes } from "./cuentas-corrientes"
import type {
  ChequesDados, ChequeAlCierre, AnticiposAlCierre, AnticipoAlCierre,
} from "./valores-al-cierre"
import type { CuadreHacienda } from "./cuadre-hacienda"
import { agregarSaldosHacienda, agregarSaldosProductivos, hojaStockInicio, conLink, type SaldosParaExcel } from "./saldos-excel"
import type { RenglonStockInicio, Pastura } from "./stock-inicio"
import type { FuentePrecio } from "./precio-al-cierre"
import type { CuentasSinCuentaCorriente } from "./fuera-por-cuenta-corriente"
import { armarIndice, type IndiceDelBalance, type EstadoParte, type DatosDelIndice } from "./indice-papeles"
import { hojaDePendientes, type PendienteBalance } from "./pendientes-balance"
import { hojaDeSaldosAnteriores, type SaldosAnteriores } from "./ajustes-balance"
import {
  TOTALIZADORAS_BANCARIAS,
  type GastosBancarios, type FilaConceptoPorMes, type RetirosYAportes, type FondoComun,
} from "./papeles-bancarios"
import { ORDEN_TIPOS, NOMBRE_TIPO, SIN_AGRUPADORA, partirEnImpuestosYOtros, type TemplatesDelEjercicio, type CuotaTemplate, type TipoTemplate } from "./templates-libro"
import type { ValuacionHacienda, PrecioMag, PrecioMercado, PrecioCabeza } from "./hacienda-stock"
import { resumenControlCuotas, conProblema, type ControlCuotasTemplates } from "./control-cuotas-templates"
import { PAPELES_SIN_ORIGEN, type StockInsumos } from "./stock-insumos"
import type { CuadreGranos, ValuacionGranos, Sementeras } from "./granos-sementeras"
import {
  formatearHoja, presentarHoja, anchosAutomaticos, colorDeSolapa, aplicarVistas,
  conFormula, MONEDA, ENTERO, TONELADAS, COEFICIENTE, type Columna, type Vista,
} from "./formato-excel"
import { ESPERA_ANTES_DE_LIBERAR_MS } from "@/lib/descargar-archivo"

const money = (n: number) => Math.round(n * 100) / 100

/**
 * 🛑 Un renglón con ERROR (las partes del comprobante no suman su propio total): fondo rojo suave y letra roja.
 * Usuario 27/10: *«que quede marcado el error en subplanilla y detalle… dejalo a la vista con la marca de los
 * renglones que dan error»*. No se corrige ningún dato: se marca, para que se vea dónde está.
 */
export const ESTILO_ERROR = {
  font: { color: { rgb: "FFA12B2B" } },
  fill: { patternType: "solid", fgColor: { rgb: "FFFBE4E4" } },
}
const fmtAr = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** El texto de la marca: cuánto suman las partes y cuánto falta (o sobra) para el total. */
export const marcaDescuadre = (d: Descuadre) =>
  `NO CUADRA: las partes suman ${fmtAr(d.suma_partes)} y el total es ${fmtAr(d.imp_total)} — ${d.diferencia > 0 ? "faltan" : "sobran"} ${fmtAr(Math.abs(d.diferencia))}`

/**
 * Cabecera + filas de un listado de asientos. Misma forma para compras, ventas y provisiones.
 * @param descuadres  los del Control (el MISMO criterio, `verificarCuadratura`): si vienen, se agrega la columna
 *                    «Control de partes» y los renglones con error van en rojo con su marca.
 */
export function hojaDeAsientos(asientos: AsientoLibroDiario[], descuadres?: Descuadre[]): unknown[][] {
  const malos = new Map((descuadres ?? []).filter(d => d.id).map(d => [d.id!, d]))
  const conCantidades = asientos.some(a => a.cantidades && (a.cantidades.producto || a.cantidades.toneladas || a.cantidades.cabezas || a.cantidades.kilos))
  const filas: unknown[][] = [[
    "Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Denominación",
    "Neto Gravado", "No Gravado", "Exentas", "Otros Tributos", "IVA", "Total",
    "Cuenta contable", "Nro cuenta", "Centro de costo", "Origen del dato",
    // 💵 A-BUG-1316: los importes van en pesos; la moneda y la cotización quedan a la vista al final
    // (al final y no al lado del Total, para no correr las columnas que suman otras solapas).
    "Moneda", "Tipo de cambio", "Total en moneda original",
    // 🌾 U2: qué se vendió y cuánto — sólo si alguna fila lo trae (ventas).
    ...(conCantidades ? ["Producto", "Toneladas", "Cabezas", "Kilos"] : []),
    ...(descuadres ? ["Control de partes"] : []),
  ]]
  for (const a of asientos) {
    const enOtraMoneda = !!a.moneda && a.moneda !== "PES"
    const fila: unknown[] = [
      a.subdiario, a.fecha ?? "", a.tipo ?? "", a.punto_venta ?? "", a.numero ?? "",
      a.cuit, a.denominacion,
      money(a.neto_gravado), money(a.no_gravado), money(a.exento),
      money(a.otros_tributos), money(a.iva), money(a.total),
      a.cuenta_contable, a.nro_cuenta, a.centro_costo,
      a.fuente === "historico" ? "sistema anterior" : a.fuente === "arca" ? "ARCA" : "ventas",
      enOtraMoneda ? (a.moneda === "DOL" ? "USD" : a.moneda) : "$",
      enOtraMoneda ? a.tipo_cambio ?? "" : "",
      enOtraMoneda ? money(a.total_moneda_original ?? 0) : "",
    ]
    if (conCantidades) {
      const q = a.cantidades
      fila.push(q?.producto ?? "", q?.toneladas ?? "", q?.cabezas ?? "", q?.kilos ?? "")
    }
    const d = malos.get(a.id)
    if (descuadres) fila.push(d ? marcaDescuadre(d) : "")
    filas.push(d ? conEstilo(fila, ESTILO_ERROR) : fila)
  }
  return filas
}

/**
 * ➕ JMS 29/10 (A-FEAT-1422 notas 1-2): «agregar totales para controles» en Compras y Ventas. Un renglón
 * TOTAL al pie, separado por uno vacío (así el filtro no lo agarra), con **SUBTOTAL(9, …)**: suma sólo lo que
 * queda a la vista cuando se filtra — filtrás un proveedor o un mes y el total es el de ese filtro.
 */
export function conTotalAlPie(filas: unknown[][]): unknown[][] {
  if (filas.length < 2) return filas
  const titulos = (filas[0] as unknown[]).map(String)
  const SUMAN = ["Neto Gravado", "No Gravado", "Exentas", "Otros Tributos", "IVA", "Total", "Toneladas", "Cabezas", "Kilos"]
  const n = filas.length          // la última fila de datos, en la numeración de Excel (encabezado = 1)
  const total: unknown[] = titulos.map(() => "")
  total[0] = "TOTAL"
  titulos.forEach((t, c) => {
    if (!SUMAN.includes(t)) return
    const col = XLSX.utils.encode_col(c)
    const suma = filas.slice(1).reduce((s: number, f) => {
      const v = (f as unknown[])[c]
      const x = v && typeof v === "object" && "v" in (v as object) ? (v as { v: unknown }).v : v
      return s + (typeof x === "number" ? x : 0)
    }, 0)
    total[c] = conFormula(`SUBTOTAL(9,${col}2:${col}${n})`, money(suma), t === "Toneladas" || t === "Kilos" || t === "Cabezas" ? "#,##0.00" : MONEDA)
  })
  return [...filas, [], total]
}

/**
 * 🧾 Papel 05 — PROVISIÓN DE FACTURAS (A-FEAT-1331). Arriba la de ESTE ejercicio (la que suma a su
 * gasto), con cómo entró cada una: por la regla (fecha del ejercicio, subdiario posterior) o puesta a
 * mano con su motivo. Abajo la del ejercicio ANTERIOR, **sólo informativa** — no se resta: *«el
 * contador lo maneja»* (usuario 2026-10-23).
 */
function hojaDeProvision(este: AsientoLibroDiario[], anterior: AsientoLibroDiario[], etiqueta: string, etiquetaAnterior: string): unknown[][] {
  const conMotivo = (lista: AsientoLibroDiario[]) => {
    const t = hojaDeAsientos(lista)
    t[0] = [...t[0], "Cómo entró a provisión", "Motivo"]
    lista.forEach((a, i) => {
      t[i + 1] = [...t[i + 1],
        a.provision_motivo ? "puesta a mano" : `fecha del ejercicio, subdiario ${a.subdiario || "—"}`,
        a.provision_motivo ?? ""]
    })
    return t
  }
  const total = (l: AsientoLibroDiario[]) => money(l.reduce((s, a) => s + a.total, 0))
  const f: unknown[][] = [
    [`PROVISIÓN DE FACTURAS — ejercicio ${etiqueta} (suman al gasto de este ejercicio)`],
    [`${este.length} comprobante(s) · total ${total(este).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`],
    ...conMotivo(este),
    [],
    [`PROVISIÓN DEL EJERCICIO ANTERIOR — ${etiquetaAnterior} (sólo informativa: NO se resta)`],
    [`${anterior.length} comprobante(s) · total ${total(anterior).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`],
    ...conMotivo(anterior),
  ]
  return f
}
/**
 * 🧮 ¿LLEGÓ TODO DE LA BASE? (A-FEAT-1343) — por cada consulta, cuántas filas dijo la base y cuántas
 * se usaron. Es integridad: si no coinciden, el papel se armó con datos de menos (§ 🚦: frena).
 */
export function bloqueDeLecturas(lecturas: Lectura[] | undefined): unknown[][] {
  if (!lecturas || lecturas.length === 0) return []
  const mal = lecturas.filter(lecturaIncompleta)
  const f: unknown[][] = []
  f.push([mal.length === 0
    ? `¿LLEGÓ TODO DE LA BASE? — sí: ${lecturas.length} consultas, todas completas`
    : `¿LLEGÓ TODO DE LA BASE? — NO: ${mal.length} consulta(s) llegaron incompletas`])
  f.push(["Consulta", "En la base", "Llegaron", ""])
  for (const l of lecturas) {
    f.push([l.nombre, l.esperadas ?? "sin dato", l.llegaron,
      l.esperadas == null ? "sin dato" : lecturaIncompleta(l) ? "NO CUADRA" : "cuadra"])
  }
  f.push([])
  return f
}


/** La solapa que se abre primero: qué se puede entregar y qué no. */
function hojaDeControl(libro: LibroDiario, lecturas?: Lectura[]): unknown[][] {
  const { controles: c, ejercicio: ej } = libro
  const f: unknown[][] = []

  f.push([`PAPELES DE TRABAJO — EJERCICIO ${ej.etiqueta}`])
  f.push([`Cierre: ${ej.fechaCierre}`])
  f.push([`Los 12 subdiarios: ${nombreSubdiario(ej.subdiarios[0])} a ${nombreSubdiario(ej.subdiarios[11])}`])
  f.push([])
  f.push(["El período NO se corta por la fecha de las facturas, sino por el subdiario en el que entraron."])
  f.push([])
  f.push(...bloqueDeLecturas(lecturas))

  f.push([c.sePuedeEntregar ? "CONTROL OK — se puede entregar" : "NO SE PUEDE ENTREGAR TODAVÍA"])
  if (!c.sePuedeEntregar) {
    f.push(["Motivo(s):"])
    c.motivos.forEach(m => f.push(["", m]))
    f.push([])
    f.push(["El archivo se genera igual, para que se pueda ver dónde está el problema."])
  }
  f.push([])

  f.push(["TOTALES POR MASA", "Comprobantes", "Total"])
  f.push(["Compras del ejercicio", c.compras.cantidad, money(c.compras.totalGeneral)])
  f.push(["Ventas del ejercicio", c.ventas.cantidad, money(c.ventas.totalGeneral)])
  f.push([])
  f.push(["Este es el número que tiene que coincidir con el del contador. La conformación (cómo"])
  f.push(["reagrupa cada cuenta) puede diferir legítimamente y no se controla."])
  f.push([])

  f.push(["APERTURA DE COMPRAS", "Importe"])
  f.push(["Neto gravado", money(c.compras.netoGravado)])
  f.push(["Exento / No gravado", money(c.compras.exentoNoGravado)])
  f.push(["IVA", money(c.compras.iva)])
  f.push(["Otros tributos", money(c.compras.otrosTributos)])
  f.push(["Sin crédito fiscal (Fac B y C)", money(c.compras.sinCredito)])
  f.push(["Diferencia contra el total", money(c.compras.diferencia),
    c.compras.ok ? (c.compras.soloRedondeo ? "cuadra, con residuo de redondeo" : "cuadra") : "NO CUADRA"])
  f.push([])

  // 🧾 Segundo camino: cada subdiario de compras contra lo presentado a ARCA (A-DAT-61).
  if (c.contraPresentado) {
    const mal = c.contraPresentado.filter(x => !x.ok).length
    f.push([mal === 0
      ? "COMPRAS vs. LO PRESENTADO A ARCA — los 12 subdiarios coinciden"
      : `COMPRAS vs. LO PRESENTADO A ARCA — ${mal} subdiario(s) NO coinciden`])
    f.push(["Subdiario", "App: comprobantes", "App: total", "Presentado: comprobantes", "Presentado: total", "Diferencia", ""])
    for (const x of c.contraPresentado) {
      f.push([x.subdiario, x.app.comprobantes, money(x.app.total),
        x.presentado?.comprobantes ?? "sin dato", x.presentado ? money(x.presentado.total) : "sin dato",
        money(x.diferenciaTotal), x.ok ? "coincide" : "NO COINCIDE"])
    }
    f.push([])
  } else {
    f.push(["COMPRAS vs. LO PRESENTADO A ARCA — no hay dato de lo presentado para esta empresa: no se controló."])
    f.push([])
  }
  // 🔢 Proveedores fijos (A-FEAT-1332): aviso, no frena.
  if (c.facturasFijas && c.facturasFijas.length > 0) {
    const mal = c.facturasFijas.filter(x => !x.ok).length
    f.push([mal === 0
      ? `PROVEEDORES FIJOS — están todas las facturas (${c.facturasFijas[0].mesesContados} meses contados)`
      : `PROVEEDORES FIJOS — ${mal} no tienen la cantidad esperada (aviso, no frena; ${c.facturasFijas[0].mesesContados} meses contados)`])
    f.push(["Proveedor", "CUIT", "Por mes", "Esperadas", "Hay", "Carga", "Detalle"])
    for (const x of c.facturasFijas) {
      f.push([x.nombre, x.cuit, x.facturasPorMes, x.esperado, x.hay, x.aMano ? "a mano" : "ARCA",
        x.ok ? "coincide" : explicarFila(x)])
    }
    f.push([])
  }
  if (libro.historicoSuperado.length > 0) {
    f.push([`Sistema anterior: ${libro.historicoSuperado.length} comprobante(s) con subdiario posterior a noviembre 2025 NO se cuentan`
      + " — para esos meses manda la app. Siguen guardados en el histórico."])
    f.push([])
  }

  if (c.subdiariosDuplicados.length > 0) {
    const nombreFuente = (x: string) =>
      x === "historico" ? "sistema anterior" : x === "arca" ? "ARCA" : x

    f.push(["SUBDIARIOS CARGADOS EN MÁS DE UNA FUENTE — sumarlos contaría doble"])
    f.push(["Subdiario", "Fuente", "Comprobantes", "Total", "Diferencia"])
    for (const d of c.subdiariosDuplicados) {
      d.porFuente.forEach((p, i) => f.push([
        i === 0 ? d.subdiario : "", nombreFuente(p.fuente),
        p.comprobantes, money(p.total), i === 0 ? money(d.diferencia) : "",
      ]))

      // 🔑 Lo que de verdad deja DECIDIR: si una fuente contiene a la otra, la elección es obvia.
      f.push(["", `${d.enComun} comprobante(s) están en las dos: son el mismo cargado dos veces.`])
      if (d.soloEn.length === 0) {
        f.push(["", "Ninguna fuente tiene nada que la otra no tenga: son idénticas, quedate con una."])
      } else if (d.soloEn.length === 1) {
        const u = d.soloEn[0]
        f.push(["", `Sólo «${nombreFuente(u.fuente)}» tiene ${u.asientos.length} comprobante(s) que la otra no.`])
        f.push(["", `Entonces «${nombreFuente(u.fuente)}» CONTIENE a la otra: quedate con ésa y descartá la otra.`])
      } else {
        f.push(["", "Cada fuente tiene comprobantes que la otra no: hay que fusionarlas, no elegir una."])
      }
      for (const u of d.soloEn) {
        f.push(["", `Sólo en ${nombreFuente(u.fuente)}:`, "Fecha", "Proveedor", "Tipo", "Importe"])
        u.asientos.forEach(a => f.push(["", "", a.fecha ?? "", a.denominacion, a.tipo ?? "sin código", money(a.total)]))
      }
      f.push([])
    }
  }

  if (c.choques.length > 0) {
    f.push(["COMPROBANTES QUE APARECEN MÁS DE UNA VEZ"])
    f.push(["Subdiario", "Tipo|PtoVta|Número|CUIT", "Denominación", "Total", "Fuentes"])
    c.choques.forEach(ch => f.push([ch.subdiario, ch.clave, ch.denominacion, money(ch.total), ch.fuentes.join(" + ")]))
    f.push([])
  }

  if (c.vacios.length > 0) {
    f.push(["SUBDIARIOS SIN NINGÚN COMPROBANTE — avisa, no frena"])
    f.push(["Puede ser un mes sin movimiento, o un mes que falta cargar. Un mes faltante NO se nota"])
    f.push(["mirando el total: por eso se listan."])
    c.vacios.forEach(s => f.push(["", nombreSubdiario(s)]))
    f.push([])
  }

  if (c.compras.descuadres.length > 0 || c.ventas.descuadres.length > 0) {
    f.push(["COMPROBANTES CUYAS PARTES NO SUMAN SU PROPIO TOTAL"])
    // 🛑 A-FEAT-1388: no se corrigen acá — se marcan donde están, para encontrarlos.
    f.push(["Están en ROJO, con la marca, en las solapas Compras / Ventas y en el renglón de su cuenta y mes de Compras / Ventas por cuenta."])
    f.push(["Fecha", "Nombre", "Comprobante", "Total", "Suma de las partes", "Diferencia"])
    ;[...c.compras.descuadres, ...c.ventas.descuadres].forEach(d => f.push([
      d.fecha, d.nombre, d.comprobante, money(d.imp_total), money(d.suma_partes), money(d.diferencia),
    ]))
    f.push([])
  }

  f.push(["QUÉ HAY EN CADA SOLAPA"])
  f.push(["", "Compras", `${libro.compras.length} comprobante(s) de los 12 subdiarios`])
  f.push(["", "Ventas", `${libro.ventas.length} comprobante(s) de los 12 subdiarios`])
  f.push(["", "05 Provisión", `${libro.provisiones.length} — son del ejercicio por fecha pero entraron después`])
  f.push(["", "Sin subdiario", `${libro.sinSubdiario.length} en total, de los cuales ${c.sinSubdiarioQueAfectan.length} tienen fecha del ejercicio o anterior`])
  if (libro.sinSubdiario.length > 0 && c.sinSubdiarioQueAfectan.length === 0) {
    f.push(["", "", "Los sin subdiario son todos POSTERIORES al cierre: son del mes en curso y no tocan este balance."])
  }
  f.push([])
  f.push(["NO ESTÁ EN ESTE ARCHIVO, y va aparte como siempre: gastos bancarios e impuestos,"])
  f.push(["inmobiliario / red vial / automotor, retiros y aportes. Son los templates, que no"])
  f.push(["entran por subdiario."])

  return f
}

/**
 * Agrega una hoja, y **con su formato**: anchos y formato de número por columna.
 *
 * 📌 El formato es parte del entregable, no un adorno — se lo pidió el usuario pensando en quién
 * lo va a leer: *«que sea lo más amigable para el contador»*. Sin `columnas` la hoja entra sin
 * formato, que es lo correcto para las hojas de texto (Control).
 */
/**
 * 📑 El nivel de esquema de cada fila de una hoja (0 = sin agrupar, 1 = detalle de un grupo), para que se pueda
 * plegar como el «Subtotal» de Excel. La hoja que lo necesita lo anota acá, sin cambiar su firma.
 */
const NIVELES = new WeakMap<unknown[][], number[]>()

/** Un renglón de SUBTOTAL: negrita, fondo suave y línea arriba — se distingue de las cuentas. */
export const ESTILO_SUBTOTAL = {
  font: { bold: true },
  fill: { patternType: "solid", fgColor: { rgb: "FFE6EEF6" } },
  border: { top: { style: "thin", color: { rgb: "FFB9C4C0" } } },
}
/** El total del ejercicio: lo mismo, un tono más fuerte. */
export const ESTILO_TOTAL = { ...ESTILO_SUBTOTAL, fill: { patternType: "solid", fgColor: { rgb: "FFCFDDEB" } } }

/** Le pone estilo a cada celda de un renglón (respetando las fórmulas). */
export const conEstilo = (fila: unknown[], s: Record<string, unknown>): unknown[] => fila.map(v => {
  if (v && typeof v === "object" && "t" in (v as object)) return { ...(v as XLSX.CellObject), s }
  if (typeof v === "number") return { t: "n", v, s }
  return { t: "s", v: v == null ? "" : String(v), s }
})

/** 🪟 La vista de cada solapa (encabezado inmovilizado, color), en el orden en que se agregaron. */
const VISTAS = new WeakMap<XLSX.WorkBook, Vista[]>()
/** Las vistas de un libro armado con `agregarHoja`, para `aplicarVistas` al escribirlo. */
export const vistasDe = (wb: XLSX.WorkBook): Vista[] => VISTAS.get(wb) ?? []

const hoja = (wb: XLSX.WorkBook, nombre: string, filas: unknown[][], columnas?: Columna[]) => {
  const ws = XLSX.utils.aoa_to_sheet(filas)
  if (columnas) formatearHoja(ws, columnas)
  else anchosAutomaticos(ws)
  const vista = { ...presentarHoja(ws), colorSolapa: colorDeSolapa(nombre) }
  VISTAS.set(wb, [...vistasDe(wb), vista])
  const niveles = NIVELES.get(filas)
  if (niveles) ws["!rows"] = niveles.map(l => (l ? { level: l } : {}))
  // 31 caracteres es el máximo que acepta Excel para el nombre de una solapa.
  XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31))
}
/** La misma forma de agregar una hoja (formato, presentación y plegado), para el libro diario aparte. */
export const agregarHoja = hoja
/** Anota qué filas se pliegan (1 = detalle de un grupo) en una hoja que se va a agregar con `agregarHoja`. */
export const plegar = (filas: unknown[][], niveles: number[]) => { NIVELES.set(filas, niveles) }

/**
 * Las columnas de un listado de asientos (Compras, Ventas, Provisión, Sin subdiario).
 * Una sola definición para las cuatro: si se vieran distinto, el lector tendría que reaprender
 * la tabla en cada solapa.
 */
/** Templates, fila por cuota. */
const COLS_TEMPLATES_POR_MES = (meses: number): Columna[] => [
  { ancho: 14 },                                   // Responsable
  { ancho: 30 },                                   // Agrupadora (A-FEAT-1388)
  { ancho: 34 },                                   // Categoría
  ...Array.from({ length: meses }, () => ({ ancho: 15, z: MONEDA })),
  { ancho: 17, z: MONEDA },                        // TOTAL
  { ancho: 11, z: ENTERO },                        // Meses con movimiento
]

const COLS_TEMPLATES: Columna[] = [
  { ancho: 11 },                    // Fecha
  { ancho: 34 },                    // Concepto
  { ancho: 30 },                    // Proveedor
  { ancho: 26 },                    // Categoría
  { ancho: 24 },                    // Cuenta contable
  { ancho: 12 },                    // Nro cuenta
  { ancho: 18 },                    // Centro de costo
  { ancho: 14 },                    // Responsable
  { ancho: 12 },                    // Estado
  { ancho: 16, z: MONEDA },         // Débito
  { ancho: 16, z: MONEDA },         // Crédito
]

/** Hacienda: cabezas enteras, coeficientes con dos decimales, importes en Contabilidad. */
const COLS_HACIENDA: Columna[] = [
  { ancho: 26 },                    // Categoría
  { ancho: 9, z: ENTERO },          // Cabezas
  { ancho: 46 },                    // Criterio
  { ancho: 15, z: MONEDA },         // Precio de referencia
  { ancho: 44 },                    // Origen del precio
  { ancho: 8, z: COEFICIENTE },     // Factor
  { ancho: 9, z: ENTERO },          // Kg/cab
  { ancho: 17, z: MONEDA },         // $ por cabeza
  { ancho: 18, z: MONEDA },         // Valor total
  { ancho: 60 },                    // De dónde salen los kilos
]

/** Los precios de referencia de los dos mercados. */
const COLS_PRECIOS: Columna[] = [
  { ancho: 26 }, { ancho: 16 }, { ancho: 12 },
  { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA },
  { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA },
]

/** Stock de insumos. */
const COLS_INSUMOS: Columna[] = [
  { ancho: 22 },                    // Categoría
  { ancho: 46 },                    // Producto
  { ancho: 12, z: "#,##0.00" },     // Cantidad
  { ancho: 9 },                     // Unidad
  { ancho: 15, z: MONEDA },         // Precio unitario
  { ancho: 16, z: MONEDA },         // Valor total
  { ancho: 34 },                    // Observaciones
]

/** Granos: dos columnas, y las toneladas con tres decimales porque el cuadre se juega ahí. */
const COLS_GRANOS: Columna[] = [
  { ancho: 40 }, { ancho: 18, z: TONELADAS }, { ancho: 54 },
]

/** Sementeras. */
const COLS_SEMENTERAS: Columna[] = [
  { ancho: 11 },                    // Fecha
  { ancho: 34 },                    // Lote
  { ancho: 8, z: "#,##0.00" },      // Ha
  { ancho: 30 },                    // Insumo
  { ancho: 12, z: "#,##0.00" },     // Cantidad
  { ancho: 9 },                     // Unidad
  { ancho: 15, z: MONEDA },         // Precio unitario
  { ancho: 16, z: MONEDA },         // Costo
]

/**
 * 📗 La solapa **«Por cuenta contable»** — el formato de su «Excel - Compras».
 *
 * Columnas A..N **en su orden exacto**, porque es lo que él y el contador ya saben leer; lo que
 * agregamos va **a la derecha del todo** (Q y R), para no correr el bloque familiar de importes.
 *
 * 🧮 **Todo lo que es una cuenta va como FÓRMULA**, no como número pegado (pedido explícito): la
 * columna Diferencia, los «Total general» de cada mes, el total del ejercicio y el Control final.
 * Así él cambia un importe y el papel se recalcula solo.
 *
 * ## Las dos mitades del control, que son distintas (§ 🚦)
 *
 * - **Diferencia** (columna K) es **integridad**: `Total − (neto + no gravado + exento + otros
 *   tributos + IVA)`. Si no da cero, el papel se contradice solo. Frena.
 * - **DDJJ IVA** (M a P) es **discrepancia** contra un papel de afuera: él pega el neto gravado de
 *   la declaración y la app le resta el del libro. Avisa, no frena — y las celdas van **vacías**
 *   porque ese número sale de la DDJJ, que la app no tiene.
 */
export function hojaPorCuenta(
  libro: LibroPorCuenta, titulo: string,
  /**
   * 🛑 Los comprobantes cuyas partes no suman su total (los del Control): el renglón de su cuenta y mes va en rojo,
   * con la marca, y el subtotal del mes avisa. Sin esto la hoja sale como antes.
   */
  marcas?: { asientos: AsientoLibroDiario[]; descuadres: Descuadre[] },
  /**
   * 🌾 VENTAS: qué se vendió y cuánto, por cuenta y mes — producto, toneladas, cabezas, kilos (usuario 27/10, ronda 3:
   * *«poner grano, categoría, cantidad»*). Van a la derecha de «Control de partes»; salen de `marcas.asientos`.
   */
  conCantidades = false,
): unknown[][] {
  const f: unknown[][] = []
  /** Por renglón (año-mes|cuenta): cuántos comprobantes no cuadran y cuánto suman sus diferencias. */
  const conError = new Map<string, { n: number; dif: number }>()
  if (marcas) {
    const malos = new Map(marcas.descuadres.filter(d => d.id).map(d => [d.id!, d]))
    for (const a of marcas.asientos) {
      const d = malos.get(a.id)
      if (!d) continue
      const [anio, mes] = a.subdiario.split("-").map(Number)
      const k = `${anio}-${mes}|${a.cuenta_contable?.trim() || SIN_IMPUTAR}`
      const acc = conError.get(k) ?? { n: 0, dif: 0 }
      acc.n += 1; acc.dif = money(acc.dif + d.diferencia)
      conError.set(k, acc)
    }
  }
  const conCant = conCantidades && !!marcas
  const cant = new Map<string, { productos: Set<string>; t: number; c: number; k: number }>()
  if (conCant) {
    for (const a of marcas!.asientos) {
      const q = a.cantidades
      if (!q) continue
      const [anio, mes] = a.subdiario.split("-").map(Number)
      const k = `${anio}-${mes}|${a.cuenta_contable?.trim() || SIN_IMPUTAR}`
      const acc = cant.get(k) ?? { productos: new Set<string>(), t: 0, c: 0, k: 0 }
      if (q.producto) acc.productos.add(q.producto)
      acc.t += q.toneladas ?? 0; acc.c += q.cabezas ?? 0; acc.k += q.kilos ?? 0
      cant.set(k, acc)
    }
  }
  const r3 = (x: number) => Math.round(x * 1000) / 1000
  const marcaFila = (e: { n: number; dif: number }) =>
    `NO CUADRA: ${e.n} comprobante(s) cuyas partes no suman su total (${e.dif > 0 ? "faltan" : "sobran"} ${fmtAr(Math.abs(e.dif))}) — están en rojo en el detalle`

  f.push([titulo])
  f.push(['Otros tributos va AL GASTO: adentro hay impuestos que no son percepciones (nota del usuario).'])
  f.push(['Las percepciones se toman de ARCA y se restan aparte.'])
  f.push([])
  f.push(["", "", "", "", "", "", "", "", "", "", "", "", "DDJJ IVA — lo llena el usuario"])
  f.push([
    "Año", "Mes", "Cuenta Contable",
    "Suma de Neto Gravado", "Suma de No Gravado", "Suma de Exento",
    "Otros Tributos", "Suma de IVA", "Suma de Total",
    "Sin crédito fiscal (Fac B y C)", "Diferencia Entre Total y suma de columnas", "",
    "Neto Gravado DDJJ", "Diferencia", "Exento + No gravado + Monotributo", "Diferencia",
    "Nro cuenta", "Comprobantes",
    ...(marcas ? ["Control de partes"] : []),
    ...(conCant ? ["Producto", "Toneladas", "Cabezas", "Kilos"] : []),
  ])

  /** Las filas (1-based, como las ve Excel) de cada «Total general» de mes, para el Control final. */
  const filasTotalMes: number[] = []
  /** Las filas de detalle (0-based), para agruparlas: cada mes se pliega a su subtotal. */
  const detalle = new Set<number>()
  const primeraDetalle = f.length + 1

  for (const m of libro.meses) {
    for (const fila of m.filas) {
      const n = f.length + 1
      detalle.add(f.length)
      const e = conError.get(`${fila.anio}-${fila.mes}|${fila.cuenta}`)
      const renglon: unknown[] = [
        fila.anio, fila.mes, fila.cuenta,
        money(fila.netoGravado), money(fila.noGravado), money(fila.exento),
        money(fila.otrosTributos), money(fila.iva), money(fila.total),
        money(fila.sinCredito),
        conFormula(`I${n}-(D${n}+E${n}+F${n}+G${n}+H${n}+J${n})`, fila.diferencia), "",
        "", "", "", "",
        fila.nroCuenta, fila.comprobantes,
      ]
      if (marcas) renglon.push(e ? marcaFila(e) : "")
      if (conCant) {
        const q = cant.get(`${fila.anio}-${fila.mes}|${fila.cuenta}`)
        renglon.push(q ? [...q.productos].join(" · ") : "", q?.t ? r3(q.t) : "", q?.c || "", q?.k || "")
      }
      f.push(e ? conEstilo(renglon, ESTILO_ERROR) : renglon)
    }
    // El subtotal del mes también avisa si adentro hay algo que no cuadra.
    const errMes = [...conError.entries()].filter(([k]) => k.startsWith(`${m.anio}-${m.mes}|`))
      .reduce((acc, [, v]) => ({ n: acc.n + v.n, dif: money(acc.dif + v.dif) }), { n: 0, dif: 0 })

    /**
     * 📑 El SUBTOTAL del mes (usuario 27/10: *«poner con un formato tipo subtotal, pero poner las sumatorias»*):
     * negrita y fondo, y la suma con `SUBTOTAL(9, …)` — la del «Subtotal» de Excel: **respeta los filtros**
     * (suma sólo lo visible) y el total del ejercicio no la cuenta dos veces. El mes se pliega a este renglón.
     */
    const desde = f.length + 1 - m.filas.length
    const hasta = f.length
    const n = f.length + 1
    filasTotalMes.push(n)
    f.push(conEstilo([
      m.anio, m.mes, `Total ${String(m.mes).padStart(2, "0")}/${m.anio}`,
      ...(["D", "E", "F", "G", "H", "I", "J"] as const).map((col, i) =>
        conFormula(`SUBTOTAL(9,${col}${desde}:${col}${hasta})`, [
          m.total.netoGravado, m.total.noGravado, m.total.exento,
          m.total.otrosTributos, m.total.iva, m.total.total, m.total.sinCredito,
        ][i]),
      ),
      conFormula(`I${n}-(D${n}+E${n}+F${n}+G${n}+H${n}+J${n})`, m.total.diferencia), "",
      // 🔑 M y O van VACÍAS a propósito: las llena él con la DDJJ. N y P se calculan solas — es la
      //    mejora sobre su planilla, donde la resta también la hacía a mano.
      "", { t: "n", f: `IF(M${n}="","",M${n}-D${n})`, z: MONEDA },
      "", { t: "n", f: `IF(O${n}="","",O${n}-(E${n}+F${n}))`, z: MONEDA },
      "", m.total.comprobantes,
      ...(marcas ? [errMes.n ? marcaFila(errMes) : ""] : []),
      ...(conCant ? ["",
        ...(["U", "V", "W"] as const).map((col, i) => {
          const del = [...cant.entries()].filter(([k]) => k.startsWith(`${m.anio}-${m.mes}|`)).map(([, v]) => [v.t, v.c, v.k][i])
          return conFormula(`SUBTOTAL(9,${col}${desde}:${col}${hasta})`, r3(del.reduce((s, x) => s + x, 0)), i === 0 ? TONELADAS : ENTERO)
        })] : []),
    ], ESTILO_SUBTOTAL))
    f.push([])
  }
  const ultimaDetalle = f.length

  // El total del ejercicio y el Control, que es el camino inverso: si la suma de los totales
  // mensuales no da el total del ejercicio, la apertura perdió algo por el camino.
  // 📑 SUBTOTAL(9) sobre todo el bloque: suma el detalle y salta los subtotales de mes (no los cuenta dos veces).
  const nTotal = f.length + 1
  f.push(conEstilo([
    "", "", "TOTAL DEL EJERCICIO",
    ...(["D", "E", "F", "G", "H", "I", "J"] as const).map((col, i) =>
      conFormula(`SUBTOTAL(9,${col}${primeraDetalle}:${col}${ultimaDetalle})`, [
        libro.totalGeneral.netoGravado, libro.totalGeneral.noGravado, libro.totalGeneral.exento,
        libro.totalGeneral.otrosTributos, libro.totalGeneral.iva, libro.totalGeneral.total,
        libro.totalGeneral.sinCredito,
      ][i]),
    ),
    conFormula(`I${nTotal}-(D${nTotal}+E${nTotal}+F${nTotal}+G${nTotal}+H${nTotal}+J${nTotal})`, libro.totalGeneral.diferencia),
    "", "", "", "", "", "", libro.totalGeneral.comprobantes,
    ...(conCant ? ["", "",
      ...(["U", "V", "W"] as const).map((col, i) =>
        conFormula(`SUBTOTAL(9,${col}${primeraDetalle}:${col}${ultimaDetalle})`,
          r3([...cant.values()].reduce((s, v) => s + [v.t, v.c, v.k][i], 0)), i === 0 ? TONELADAS : ENTERO))] : []),
  ], ESTILO_TOTAL))

  const nCtrl = f.length + 1
  f.push([
    "", "", "Control (tiene que dar 0)",
    ...(["D", "E", "F", "G", "H", "I", "J"] as const).map(col =>
      conFormula(`${col}${nTotal}-(${filasTotalMes.map(r => `${col}${r}`).join("+") || "0"})`, 0),
    ),
  ])
  f.push([])

  // Lo que falta imputar, dicho en una línea y con su peso. § 🧮: el control se ve.
  if (libro.sinImputar.comprobantes > 0) {
    f.push([`FALTA IMPUTAR: ${libro.sinImputar.comprobantes} comprobante(s) por ${money(libro.sinImputar.total)} — ${libro.sinImputar.porcentaje}% del total`])
    f.push([`Aparece en: ${[...new Set(libro.sinImputar.meses)].join(" · ")}`])
    f.push(["Se imputa en Egresos → Facturas → Asignación Cuentas. Hasta entonces sale como NO IMPUTADO."])
  } else {
    f.push(["TODO IMPUTADO — no hay comprobantes sin cuenta contable."])
  }

  // 📑 Cada mes se pliega a su subtotal (los botones + / − de Excel, a la izquierda).
  NIVELES.set(f, f.map((_, i) => (detalle.has(i) ? 1 : 0)))
  return f
}

/**
 * 📅 La solapa **Resumen 12 meses** — usuario 27/10: *«una planilla simplemente con los 12 meses, total compras,
 * total ventas»*, y *«ayuda a controles también»*.
 *
 * Un renglón por subdiario del ejercicio (los 12, aunque alguno esté vacío: un mes sin nada se ve como 0, no
 * desaparece), con compras y ventas. Y al lado, el **control**: las compras de cada mes contra lo presentado a ARCA
 * (el mismo dato del Control), con la diferencia; y abajo, que la suma de los 12 dé el total del ejercicio.
 */
export function hojaResumenMensual(libro: LibroDiario): unknown[][] {
  const f: unknown[][] = []
  f.push([`RESUMEN DE LOS 12 MESES — ejercicio ${libro.ejercicio.etiqueta}`])
  f.push(["Por subdiario (el mes en que entró cada comprobante), como el resto del libro diario."])
  f.push([])
  f.push(["Subdiario", "Compras: comprobantes", "Compras: total", "Ventas: comprobantes", "Ventas: total",
    "ARCA: comprobantes", "ARCA: total presentado", "Diferencia compras − ARCA", "Control"])
  const clave = (s: { anio: number; mes: number }) => `${s.anio}-${String(s.mes).padStart(2, "0")}`
  const porSub = (xs: AsientoLibroDiario[], k: string) => xs.filter(a => a.subdiario === k)
  const presentado = new Map((libro.controles.contraPresentado ?? []).map(p => [p.subdiario, p]))
  const n0 = f.length + 1
  const suma = { cc: 0, tc: 0, cv: 0, tv: 0 }
  for (const s of libro.ejercicio.subdiarios) {
    const k = clave(s)
    const c = porSub(libro.compras, k), v = porSub(libro.ventas, k)
    const tc = money(c.reduce((t, a) => t + (Number(a.total) || 0), 0))
    const tv = money(v.reduce((t, a) => t + (Number(a.total) || 0), 0))
    suma.cc += c.length; suma.tc += tc; suma.cv += v.length; suma.tv += tv
    const p = presentado.get(k)
    const n = f.length + 1
    const fila: unknown[] = [
      nombreSubdiario(s), c.length, tc, v.length, tv,
      p?.presentado ? p.presentado.comprobantes : "sin dato",
      p?.presentado ? money(p.presentado.total) : "sin dato",
      p?.presentado ? conFormula(`C${n}-G${n}`, money(tc - p.presentado.total)) : "",
      !p?.presentado ? "sin dato de ARCA" : p.ok ? "coincide" : "NO COINCIDE",
    ]
    // 🛑 El mes que no coincide con ARCA, en rojo (como diciembre): se ve sin leer la columna Control.
    f.push(p?.presentado && !p.ok ? conEstilo(fila, ESTILO_ERROR) : fila)
  }
  const nU = f.length
  const nT = f.length + 1
  f.push(["TOTAL", ...(["B", "C", "D", "E"] as const).map((col, i) => conFormula(`SUM(${col}${n0}:${col}${nU})`,
    [suma.cc, money(suma.tc), suma.cv, money(suma.tv)][i], i % 2 === 0 ? ENTERO : MONEDA))])
  // 🧮 El camino inverso: la suma de los 12 renglones tiene que ser el total del ejercicio de la solapa Control.
  //    Si un comprobante tiene un subdiario fuera de los 12, no está en ningún renglón y esto no da 0.
  f.push([])
  f.push(["CONTROL", "", "Compras", "", "Ventas"])
  f.push(["Total del ejercicio (solapa Control)", "", money(libro.controles.compras.totalGeneral), "", money(libro.controles.ventas.totalGeneral)])
  const dC = money(suma.tc - libro.controles.compras.totalGeneral)
  const dV = money(suma.tv - libro.controles.ventas.totalGeneral)
  const nD = f.length + 1
  f.push(["Suma de los 12 meses − total (tiene que dar 0)", "", conFormula(`C${nT}-C${nD - 1}`, dC), "", conFormula(`E${nT}-E${nD - 1}`, dV),
    "", "", "", Math.abs(dC) < 0.01 && Math.abs(dV) < 0.01 ? "cuadra" : "NO CUADRA"])
  return f
}

const COLS_RESUMEN_MENSUAL: Columna[] = [
  { ancho: 16 },                     // Subdiario
  { ancho: 12, z: ENTERO },          // Compras: comprobantes
  { ancho: 18, z: MONEDA },          // Compras: total
  { ancho: 12, z: ENTERO },          // Ventas: comprobantes
  { ancho: 18, z: MONEDA },          // Ventas: total
  { ancho: 12, z: ENTERO },          // ARCA: comprobantes
  { ancho: 20, z: MONEDA },          // ARCA: total presentado
  { ancho: 18, z: MONEDA },          // Diferencia compras − ARCA
  { ancho: 18 },                     // Control
]

export const COLS_POR_CUENTA: Columna[] = [
  { ancho: 7, z: ENTERO },          // A Año
  { ancho: 5, z: ENTERO },          // B Mes
  { ancho: 34 },                    // C Cuenta Contable
  { ancho: 17, z: MONEDA },         // D Neto Gravado
  { ancho: 15, z: MONEDA },         // E No Gravado
  { ancho: 15, z: MONEDA },         // F Exento
  { ancho: 15, z: MONEDA },         // G Otros Tributos
  { ancho: 15, z: MONEDA },         // H IVA
  { ancho: 17, z: MONEDA },         // I Total
  { ancho: 20, z: MONEDA },         // J Sin crédito fiscal (Fac B y C)
  { ancho: 19, z: MONEDA },         // K Diferencia
  { ancho: 3 },                     // L separador
  { ancho: 17, z: MONEDA },         // M DDJJ Neto Gravado
  { ancho: 14, z: MONEDA },         // N Diferencia
  { ancho: 22, z: MONEDA },         // O DDJJ Exento + No grav + Mono
  { ancho: 14, z: MONEDA },         // P Diferencia
  { ancho: 12 },                    // Q Nro cuenta
  { ancho: 13, z: ENTERO },         // R Comprobantes
  { ancho: 70 },                    // S Control de partes (A-FEAT-1388)
]
/** Ventas por cuenta: lo mismo + producto, toneladas, cabezas y kilos (T a W). */
export const COLS_POR_CUENTA_VENTAS: Columna[] = [
  ...COLS_POR_CUENTA,
  { ancho: 22 },                    // T Producto
  { ancho: 13, z: TONELADAS },      // U Toneladas
  { ancho: 10, z: ENTERO },         // V Cabezas
  { ancho: 12, z: ENTERO },         // W Kilos
]

/**
 * 💳 Las solapas **03 - Cuentas a cobrar** y **04 - Cuentas a pagar**.
 *
 * Mismo formato de fila que el libro de IVA —el que usan sus papeles originales— más la columna
 * **Motivo**, que dice **por qué** cada comprobante está en el papel. Es lo que lo hace auditable:
 * *«no se pagó nunca»* y *«se pagó DESPUÉS del cierre»* son cosas distintas y el contador puede
 * querer mirarlas distinto.
 *
 * 🧮 **Y abajo van los tres bloques de lo que NO se pudo determinar**, con sus totales. No son un
 * apéndice: son la parte que dice hasta dónde llega lo que el papel afirma.
 */
function hojaDeCuentas(
  c: CuentasAlCierre, titulo: string, fechaCierre: string,
  /** 💳 Sólo en «a pagar»: las cuotas de templates impagas al cierre (A-BUG-1289). */
  templatesImpagos?: { cuotas: CuotaTemplate[]; total: number },
): unknown[][] {
  const f: unknown[][] = []
  f.push([titulo])
  f.push([`Al ${fechaCierre}`])
  f.push(["Entra lo que NO estaba pagado al cierre. Manda la fecha de pago, no el estado de hoy:"])
  f.push(["una factura que hoy figura paga pero se pagó despues del cierre, al cierre era deuda."])
  f.push([])
  f.push([
    "Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Denominación",
    "Neto Gravado", "No Gravado", "Exentas", "Otros Tributos", "IVA", "Total",
    "Cuenta contable", "Estado hoy", "Fecha de pago", "Motivo",
  ])

  const fila = (x: FilaCuenta) => {
    const a = x.asiento
    return [
      a.subdiario, a.fecha ?? "", a.tipo ?? "", a.punto_venta ?? "", a.numero ?? "",
      a.cuit, a.denominacion,
      money(a.neto_gravado), money(a.no_gravado), money(a.exento),
      // 🛡️ A-FEAT-1385: en un seguro en cuotas, «Total» es el saldo al cierre; la cuenta va en el motivo.
      money(a.otros_tributos), money(a.iva), money(x.importe ?? a.total),
      a.cuenta_contable, x.estado, x.fechaPago ?? "", x.detalle ? `${x.motivo} — ${x.detalle}` : x.motivo,
    ]
  }

  c.filas.forEach(x => f.push(fila(x)))
  const desde = 7
  const hasta = 6 + c.filas.length
  if (c.filas.length > 0) {
    f.push(["", "", "", "", "", "", "TOTAL",
      ...(["H", "I", "J", "K", "L", "M"] as const).map((col, i) =>
        conFormula(`SUM(${col}${desde}:${col}${hasta})`, [0, 0, 0, 0, 0, c.total][i])),
    ])
  } else {
    f.push(["", "", "", "", "", "", "TOTAL", "", "", "", "", "", 0])
  }
  /**
   * 💳 **Las cuotas de templates impagas: deuda igual que las facturas** (usuario 2026-10-18). Van en
   * su propio bloque —no tienen tipo, punto de venta ni CUIT— y el TOTAL DEUDA suma los dos con fórmula.
   */
  if (templatesImpagos && templatesImpagos.cuotas.length > 0) {
    const nTotFacturas = f.length
    f.push([])
    f.push(["CUOTAS DE TEMPLATES IMPAGAS AL CIERRE — son deuda igual que las facturas"])
    const d = f.length + 1
    for (const q of templatesImpagos.cuotas) {
      f.push(["Template", q.fecha ?? "", "", "", "", "", `${q.concepto}${q.proveedor ? " — " + q.proveedor : ""}`,
        "", "", "", "", "", money(q.monto), q.categ, q.estado, "", "no se pagó (cuota de template)"])
    }
    const h = f.length
    const nTotTpl = f.length + 1
    f.push(["", "", "", "", "", "", "TOTAL TEMPLATES", "", "", "", "", "",
      conFormula(`SUM(M${d}:M${h})`, templatesImpagos.total)])
    f.push(["", "", "", "", "", "", "TOTAL DEUDA AL CIERRE (facturas + templates)", "", "", "", "", "",
      conFormula(`M${nTotFacturas}+M${nTotTpl}`, Math.round((c.total + templatesImpagos.total) * 100) / 100)])
  }
  f.push([])

  /** Los tres bloques de lo que no se pudo afirmar. Cada uno dice por qué y cuánto pesa. */
  const bloque = (t: string[], filas: FilaCuenta[], total: number) => {
    if (filas.length === 0) return
    f.push([])
    t.forEach(l => f.push([l]))
    f.push([`${filas.length} comprobante(s) — total ${money(total)}`])
    filas.forEach(x => f.push(fila(x)))
  }

  bloque([
    "DEL SISTEMA ANTERIOR — SE DAN POR PAGADOS (decisión del usuario, 29/09/2026)",
    "El histórico migró los comprobantes pero NO su estado de pago ni su fecha.",
    "No se cuentan como deuda al cierre. Se listan para que se vea en qué se apoya el papel.",
  ], c.sinEstadoDePago, c.totalSinEstado)

  bloque([
    "CONCILIADOS PERO SIN NINGUNA FECHA — no se puede ubicar el pago en el tiempo",
    "Dicen estar pagados, pero no tienen fecha de pago ni movimiento bancario enganchado.",
  ], c.sinDatoDePago, c.totalSinDato)

  bloque([
    `ESTADO NO RECONOCIDO — ${c.estadosSinClasificar.join(", ")}`,
    "No se descartan: hay que decidir de qué lado van.",
  ], c.estadoDesconocido, c.totalDesconocido)

  bloque([
    "SEGUROS EN CUOTAS CON LA PÓLIZA PAGA AL CIERRE — no son deuda",
    "Las cuotas de su póliza se pagaron (o las compensó una NC) antes del cierre. A-FEAT-1385.",
  ], c.canceladasPorCuotas, c.totalCanceladasPorCuotas)

  bloque([
    "SEGUROS EN CUOTAS SIN VÍNCULO CON LA PÓLIZA — ya están ENTEROS en el TOTAL de arriba",
    "No se pudieron atar a una póliza con template: no se sabe qué cuotas se pagaron.",
  ], c.sinVinculoPoliza, c.totalSinVinculoPoliza)

  // 🛡️ JMS 29/10: una cuota que dejó de debitarse no es deuda — falta la NC. Fuera del total, marcada.
  bloque([
    "SEGUROS: CUOTAS VENCIDAS QUE NUNCA SE DEBITARON — falta la NC a recibir, NO son deuda",
    "La póliza dejó de cobrarse (¿baja?): por ahora la conclusión es que falta su nota de crédito. Ver papel 14 (Federación).",
  ], c.faltaNc ?? [], c.totalFaltaNc ?? 0)

  // 🔁 JMS 29/10: quien tiene cuenta corriente en el 14 no va comprobante por comprobante acá.
  const enCC = (c as Partial<CuentasSinCuentaCorriente>).enCuentaCorriente
  if (enCC?.length) {
    const porCuenta = [...new Set(enCC.map(x => x.cuentaCorriente))].join(", ")
    bloque([
      `VAN POR SU CUENTA CORRIENTE (papel 14) — NO están en el TOTAL de arriba: ${porCuenta}`,
      "Regla del usuario (29/10/2026): si el balance muestra el saldo en cuenta corriente, no se muestran aparte sus comprobantes.",
    ], enCC, (c as CuentasSinCuentaCorriente).totalEnCuentaCorriente)
  }

  f.push([])
  f.push([`Se miraron ${c.mirados} comprobantes del ejercicio.`])
  return f
}

const COLS_CUENTAS: Columna[] = [
  { ancho: 10 },                    // Subdiario
  { ancho: 11 },                    // Fecha
  { ancho: 6, z: ENTERO },          // Tipo
  { ancho: 8, z: ENTERO },          // Pto Vta
  { ancho: 11, z: ENTERO },         // Número
  { ancho: 13 },                    // CUIT
  { ancho: 42 },                    // Denominación
  { ancho: 15, z: MONEDA },         // Neto Gravado
  { ancho: 14, z: MONEDA },         // No Gravado
  { ancho: 13, z: MONEDA },         // Exentas
  { ancho: 14, z: MONEDA },         // Otros Tributos
  { ancho: 13, z: MONEDA },         // IVA
  { ancho: 16, z: MONEDA },         // Total
  { ancho: 26 },                    // Cuenta contable
  { ancho: 13 },                    // Estado hoy
  { ancho: 13 },                    // Fecha de pago
  { ancho: 34 },                    // Motivo
]

/**
 * 💳 La solapa **04.1 Cheques dados** — los emitidos antes del cierre que todavía no debitaron.
 *
 * Mismas columnas que su hoja `4.1 Cheques dados` del balance anterior, más el **Motivo**.
 *
 * 🧨 **La columna «Estado hoy» está a propósito y NO se usa para decidir.** El estado no se
 * mantiene: al 30/09/2026 los 10 cheques de MSA decían `vigente`, incluidos los que debitaron en
 * abril. Manda la **fecha de débito**. Se muestra igual para que se vea el desfasaje.
 */
function hojaDeChequesDados(ch: ChequesDados, etiqueta: string, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`CHEQUES DADOS Y DIFERIDOS NO DEBITADOS — ejercicio ${etiqueta}`])
  f.push([`Al ${fechaCierre}`])
  f.push(["Emitidos antes del cierre y debitados despues: al cierre la plata todavia estaba en la cuenta."])
  f.push(["Manda la FECHA DE DEBITO, no el estado: el estado no se actualiza cuando el cheque debita."])
  f.push([])
  f.push([
    "Fecha emisión", "Fecha de débito", "N° Cheque", "Estado hoy", "Beneficiario", "CUIT",
    "Banco", "Concepto", "Importe", "Motivo",
  ])

  const fila = (x: ChequeAlCierre) => {
    const c = x.cheque
    return [
      c.fecha_emision ? String(c.fecha_emision).slice(0, 10) : "",
      c.fecha_cobro ? String(c.fecha_cobro).slice(0, 10) : "",
      c.numero ?? "", c.estado ?? "", c.beneficiario_nombre ?? "", c.beneficiario_cuit ?? "",
      c.banco ?? "", c.concepto ?? "", money(c.monto ?? 0), x.motivo,
    ]
  }

  ch.filas.forEach(x => f.push(fila(x)))
  const desde = 7
  const hasta = 6 + ch.filas.length
  f.push(["", "", "", "", "", "", "", "TOTAL",
    ch.filas.length > 0 ? conFormula(`SUM(I${desde}:I${hasta})`, ch.total) : 0])
  f.push([])

  if (ch.sinFechaDeDebito.length > 0) {
    f.push([])
    f.push(["EMITIDOS ANTES DEL CIERRE Y SIN FECHA DE DÉBITO — no se puede afirmar si debitaron"])
    f.push([`${ch.sinFechaDeDebito.length} cheque(s) — total ${money(ch.totalSinFecha)}`])
    ch.sinFechaDeDebito.forEach(x => f.push(fila(x)))
  }

  f.push([])
  f.push([`Se miraron ${ch.mirados} cheque(s): ${ch.debitadosAntes} ya habían debitado al cierre, `
    + `${ch.posteriores} son posteriores al cierre.`])
  if (ch.filas.length === 0 && ch.sinFechaDeDebito.length === 0) {
    // 🔑 Un cero calculado dice algo; una solapa vacía no. Se escribe el cero y de dónde sale.
    f.push(["NO HUBO cheques dados pendientes de débito al cierre. No es que falte el dato: "
      + "los cheques emitidos antes del cierre debitaron todos antes del cierre."])
  }
  ch.avisos.forEach(a => f.push([`⚠️ ${a}`]))
  return f
}

const COLS_CHEQUES: Columna[] = [
  { ancho: 13 },                    // Fecha emisión
  { ancho: 14 },                    // Fecha de débito
  { ancho: 12 },                    // N° Cheque
  { ancho: 11 },                    // Estado hoy
  { ancho: 46 },                    // Beneficiario
  { ancho: 13 },                    // CUIT
  { ancho: 15 },                    // Banco
  { ancho: 34 },                    // Concepto
  { ancho: 16, z: MONEDA },         // Importe
  { ancho: 40 },                    // Motivo
]

/**
 * 💰 La solapa **04.2 Anticipos** — los que tenían saldo al cierre.
 *
 * 🔑 **Dos bloques, y no se pueden sumar**: los `pago` son plata adelantada a un proveedor
 * (**activo**), los `cobro` son plata que adelantó un cliente (**pasivo**). Salen del mismo cálculo
 * y de la misma tabla, así que van en la misma solapa, pero con su total cada uno.
 *
 * 🧮 Al final, el **control del camino inverso**: recalcular el saldo a hoy tiene que dar la columna
 * `monto_restante` del sistema. Si no da, el saldo al cierre tampoco es confiable.
 */
function hojaDeAnticipos(an: AnticiposAlCierre, etiqueta: string, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`ANTICIPOS CON SALDO AL CIERRE — ejercicio ${etiqueta}`])
  f.push([`Al ${fechaCierre}`])
  f.push(["El saldo se RECALCULA a la fecha de cierre. La columna del sistema es la foto de hoy:"])
  f.push(["un anticipo hoy consumido pudo tener saldo al cierre, y ese saldo es el que va al balance."])
  f.push(["Saldo = monto - aplicado a facturas hasta el cierre - retencion de SICORE - descuento."])

  const cabecera = [
    "Fecha", "Razón Social", "CUIT", "Empresa", "Tipo", "Monto original",
    "Aplicado al cierre", "SICORE", "Descuento", "SALDO AL CIERRE",
    "Aplicado después", "Estado hoy",
  ]
  const fila = (x: AnticipoAlCierre) => {
    const a = x.anticipo
    return [
      a.fecha_pago ? String(a.fecha_pago).slice(0, 10) : "",
      a.nombre_proveedor ?? "", a.cuit_proveedor ?? "",
      a.empresa ?? "(sin empresa)", a.tipo ?? "(sin tipo)",
      money(a.monto ?? 0), money(x.aplicadoAlCierre),
      money(a.monto_sicore ?? 0), money(a.descuento_aplicado ?? 0),
      money(x.saldoAlCierre), money(x.aplicadoDespues),
      [a.estado, a.estado_pago].filter(Boolean).join(" / "),
    ]
  }

  /** Un bloque con su cabecera, sus filas y su TOTAL con fórmula sobre la columna del saldo. */
  const bloque = (titulo: string[], filas: AnticipoAlCierre[], total: number) => {
    f.push([])
    titulo.forEach(t => f.push([t]))
    f.push(cabecera)
    const desde = f.length + 1
    filas.forEach(x => f.push(fila(x)))
    const hasta = f.length
    f.push(["", "", "", "", "", "", "", "", "TOTAL",
      filas.length > 0 ? conFormula(`SUM(J${desde}:J${hasta})`, total) : 0])
  }

  bloque([
    "ANTICIPO A PROVEEDORES — es un ACTIVO: plata adelantada que todavía no se consumió",
  ], an.aProveedores, an.totalAProveedores)

  bloque([
    "ANTICIPOS DE CLIENTES (cobros a cuenta) — es un PASIVO: plata que ya se cobró y no se facturó",
    "Vienen de la misma tabla que los de arriba (columna Tipo = cobro). NO se suman con ellos.",
  ], an.deClientes, an.totalDeClientes)

  if (an.sinTipo.length > 0) {
    bloque([
      `SIN TIPO — no dicen si son a proveedor o de cliente (${an.tiposSinClasificar.join(", ")})`,
      "No se suman a ninguno de los dos bloques: hay que decidir de qué lado van.",
    ], an.sinTipo, an.totalSinTipo)
  }

  // 🧮 El control, al final y con nombre propio.
  f.push([])
  f.push([])
  f.push(["CONTROL — el camino inverso: recalcular el saldo a HOY tiene que dar el del sistema"])
  if (an.descuadres.length === 0) {
    f.push([`✓ Cierra en los ${an.mirados} anticipos mirados.`])
  } else {
    f.push([`⚠️ NO cierra en ${an.descuadres.length} de ${an.mirados}:`])
    f.push(["Razón Social", "Monto", "Saldo del sistema", "Saldo recalculado", "Diferencia"])
    an.descuadres.forEach(d => f.push([d.nombre, money(d.monto), money(d.guardado),
      money(d.recalculado), money(d.diferencia)]))
  }

  f.push([])
  an.avisos.forEach(a => f.push([`⚠️ ${a}`]))
  if (an.deOtraEmpresa > 0) {
    f.push([`${an.deOtraEmpresa} anticipo(s) quedaron afuera por ser de otra empresa.`])
  }
  return f
}

const COLS_ANTICIPOS: Columna[] = [
  { ancho: 11 },                    // Fecha
  { ancho: 46 },                    // Razón Social
  { ancho: 13 },                    // CUIT
  { ancho: 13 },                    // Empresa
  { ancho: 10 },                    // Tipo
  { ancho: 17, z: MONEDA },         // Monto original
  { ancho: 17, z: MONEDA },         // Aplicado al cierre
  { ancho: 13, z: MONEDA },         // SICORE
  { ancho: 12, z: MONEDA },         // Descuento
  { ancho: 18, z: MONEDA },         // SALDO AL CIERRE
  { ancho: 16, z: MONEDA },         // Aplicado después
  { ancho: 22 },                    // Estado hoy
]

/**
 * 🧮 **La solapa 07.1 — LA CADENA DE SALDOS, de dónde arranca el ejercicio hasta dónde termina.**
 *
 * Es el camino inverso del papel 07 (§ 🧮 de `CLAUDE.md`): el saldo al cierre **no se afirma, se
 * reconstruye** desde el saldo al inicio, y se compara con el que trae el extracto.
 *
 * 🔑 **Y el tramo que la app no tiene cargado no se carga: se deduce** del primer movimiento que sí
 * está (`saldo + débito − crédito`). Por eso el ejercicio 25/26 se puede cerrar **sin cargar los
 * extractos de julio-25 a enero-26**, que es lo que el usuario decidió no hacer.
 *
 * 📌 **Va en solapa propia y no pegada a los saldos** por una razón práctica: `07 Bancos` ya mezcla
 * la tabla de saldos con la de cuotapartes del FCI, y sus columnas quieren formatos distintos
 * (importes contra cuotapartes con 4 decimales). Una tercera tabla ahí adentro haría que ninguna de
 * las tres se vea bien.
 */
function hojaDeCadenaDeSaldos(cadenas: CadenaDeSaldos[], fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`LA CADENA DEL EJERCICIO — el saldo al cierre reconstruido desde el saldo al inicio`])
  f.push([`Al ${fechaCierre}`])
  f.push([])
  f.push(["Cuenta", "Saldo al inicio", "Neto NO cargado", "Saldo al arrancar lo cargado",
    "Neto de lo cargado", "Saldo al cierre calculado", "Saldo del extracto", "Diferencia",
    "Desde", "Hasta", "Movim."])
  for (const c of cadenas) {
    const n = f.length + 1
    f.push([
      c.cuenta,
      c.saldoInicio ?? "NO SE CONOCE",
      c.netoNoCargado ?? "",
      c.saldoAntesDeLoCargado ?? "",
      money(c.netoCargado),
      c.cierreCalculado ?? "",
      c.saldoAlCierre ?? "",
      c.cierreCalculado != null && c.saldoAlCierre != null
        ? conFormula(`F${n}-G${n}`, c.diferencia ?? 0)
        : "no se puede controlar",
      c.desde ?? "", c.hasta ?? "", c.movimientos,
    ])
  }
  f.push([])

  const conControl = cadenas.filter(c => c.diferencia != null)
  const noCierran = conControl.filter(c => Math.abs(c.diferencia ?? 0) > 0.01)
  if (conControl.length === 0) {
    f.push(["No se pudo controlar ninguna cuenta: no hay movimientos con saldo en el ejercicio."])
  } else if (noCierran.length === 0) {
    f.push([`CONTROL OK — en ${conControl.length} cuenta(s) los movimientos explican el saldo al cierre, al centavo.`])
  } else {
    f.push([`ATENCION — en ${noCierran.length} cuenta(s) los movimientos NO explican el saldo al cierre:`])
    /**
     * 🔍 **Y se dice CUAL de las dos causas es**, porque mandan a lugares distintos: un salto solo es
     * un movimiento que falta (ahí está la plata); muchos saltos que se compensan es el orden mal, y
     * no falta un peso. Ver `saltos` en `saldos-al-inicio.ts`.
     */
    for (const c of noCierran) {
      const causa = c.saltos <= 1
        ? "parece faltar (o sobrar) UN movimiento: la plata esta ahi"
        : `el ORDEN de los movimientos no sigue a los saldos (${c.saltos} saltos que suman `
          + `${money(c.sumaDeSaltos)}): NO falta plata, lo que no sirve es el orden`
      f.push([`   ${c.cuenta}: diferencia ${money(c.diferencia ?? 0)} — ${causa}`])
    }
  }

  f.push([])
  f.push(["Como se lee: el ejercicio arranca en el Saldo al inicio; el Neto NO cargado son los meses"])
  f.push(["que el extracto de la app no tiene y se DEDUCEN del primer movimiento cargado (no hay que"])
  f.push(["cargarlos); despues se suma el neto de lo que si esta, y eso tiene que dar el saldo del extracto."])
  f.push([])
  for (const c of cadenas) {
    if (c.fuenteInicio) f.push([`Saldo al inicio de ${c.cuenta} — de donde sale: ${c.fuenteInicio}`])
  }
  const sinInicio = cadenas.filter(c => c.saldoInicio == null)
  if (sinInicio.length > 0) {
    f.push([`Sin saldo al inicio declarado: ${sinInicio.map(c => c.cuenta).join(", ")}.`])
    f.push(["Esas cuentas estan vacias en el sistema, asi que el saldo al inicio no sale de ningun lado."])
  }
  return f
}

const COLS_CADENA: Columna[] = [
  { ancho: 30 },                    // Cuenta
  { ancho: 18, z: MONEDA },         // Saldo al inicio
  { ancho: 18, z: MONEDA },         // Neto NO cargado
  { ancho: 22, z: MONEDA },         // Saldo al arrancar lo cargado
  { ancho: 18, z: MONEDA },         // Neto de lo cargado
  { ancho: 22, z: MONEDA },         // Saldo al cierre calculado
  { ancho: 18, z: MONEDA },         // Saldo del extracto
  { ancho: 16, z: MONEDA },         // Diferencia
  { ancho: 11 },                    // Desde
  { ancho: 11 },                    // Hasta
  { ancho: 9, z: ENTERO },          // Movim.
]

/**
 * 👷 La solapa **13 Sueldos** — el total de A y el total de B (A-FEAT-1216).
 *
 * Pedido del usuario: *«el export contable debe exportar sueldos! Debe dar el total de A y el total
 * de B»*. Van **abiertos por empleado y por mes**, porque es como está el dato y es lo que deja
 * revisar un número que no cierra.
 *
 * ⚠️ **Y con TODAS las columnas, no sólo A y B**: el bruto de un sueldo **no es A + B** — lleva los
 * francos y los extras —, así que un papel con dos columnas no cerraría contra lo que se pagó.
 *
 * 🧮 Cada fila trae **el bruto recompuesto desde sus partes** contra **el guardado**, y su diferencia.
 * Es el camino inverso: si no dan lo mismo, el papel lo dice antes de que lo vea el contador.
 */
function hojaDeSueldos(s: SueldosDelEjercicio, etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`SUELDOS — ejercicio ${etiqueta}`])
  f.push(["El bruto NO es A + B: lleva ademas los francos (o el jornal) y los extras."])
  f.push(["La cuota alimentaria esta ADENTRO de A y se muestra aparte: no se suma al bruto."])
  f.push([])
  f.push([
    "Período", "Empresa", "Empleado", "Tipo", "Categoría A", "Categoría B",
    "de la cual, cuota alim.", "Francos", "Valor franco", "Por francos", "Por jornal",
    "Extras", "BRUTO", "Bruto recalculado", "Diferencia", "Pagado", "Saldo",
  ])

  const fila = (x: FilaSueldo) => [
    x.periodo, x.empresa, x.empleado, x.tipo,
    money(x.montoA), money(x.montoB), money(x.cuotaAlimentaria),
    x.francos, money(x.valorFranco), money(x.porFrancos), money(x.porJornal),
    money(x.extras), money(x.brutoGuardado), money(x.brutoCalculado), money(x.diferencia),
    money(x.pagado), money(x.saldo),
  ]

  const desde = f.length + 1
  s.filas.forEach(x => f.push(fila(x)))
  const hasta = f.length

  // 🔑 Los totales que él pidió, con fórmula para que sigan al filtro.
  f.push([
    "TOTAL", "", "", "",
    ...(["E", "F", "G"] as const).map((col, i) =>
      conFormula(`SUM(${col}${desde}:${col}${hasta})`,
        [s.total.montoA, s.total.montoB, s.total.cuotaAlimentaria][i])),
    "", "",
    conFormula(`SUM(J${desde}:J${hasta})`, s.total.porFrancos),
    conFormula(`SUM(K${desde}:K${hasta})`, s.total.porJornal),
    conFormula(`SUM(L${desde}:L${hasta})`, s.total.extras),
    conFormula(`SUM(M${desde}:M${hasta})`, s.total.bruto),
    "", "",
    conFormula(`SUM(P${desde}:P${hasta})`, s.total.pagado),
    conFormula(`SUM(Q${desde}:Q${hasta})`, s.total.saldo),
  ])

  f.push([])
  f.push([])
  f.push(["POR MES — como evolucionaron A y B a lo largo del ejercicio"])
  f.push(["Mes", "Categoría A", "Categoría B", "Bruto"])
  s.porMes.forEach(m => f.push([m.periodo, money(m.montoA), money(m.montoB), money(m.bruto)]))

  f.push([])
  // 🧮 El control, al final y proporcional.
  if (s.descuadres.length === 0) {
    f.push([`CONTROL OK — el bruto recompuesto da el guardado en las ${s.filas.length} filas.`])
  } else {
    f.push([`ATENCION — en ${s.descuadres.length} fila(s) el bruto recompuesto NO da el guardado:`])
    s.descuadres.forEach(d =>
      f.push([`   ${d.periodo} ${d.empleado}: guardado ${money(d.brutoGuardado)} · recalculado `
        + `${money(d.brutoCalculado)} · diferencia ${money(d.diferencia)}`]))
    f.push(["Alguna de las dos esta mal. No se puede entregar el numero sin mirarlo."])
  }
  if (s.mesesVacios.length > 0) {
    f.push([`ATENCION — ${s.mesesVacios.length} mes(es) del ejercicio sin ningun sueldo cargado: `
      + s.mesesVacios.join(", ")])
  }
  return f
}

const COLS_SUELDOS: Columna[] = [
  { ancho: 10 },                    // Período
  { ancho: 9 },                     // Empresa
  { ancho: 24 },                    // Empleado
  { ancho: 13 },                    // Tipo
  { ancho: 16, z: MONEDA },         // Categoría A
  { ancho: 16, z: MONEDA },         // Categoría B
  { ancho: 18, z: MONEDA },         // cuota alimentaria
  { ancho: 9, z: COEFICIENTE },     // Francos
  { ancho: 14, z: MONEDA },         // Valor franco
  { ancho: 15, z: MONEDA },         // Por francos
  { ancho: 15, z: MONEDA },         // Por jornal
  { ancho: 14, z: MONEDA },         // Extras
  { ancho: 17, z: MONEDA },         // BRUTO
  { ancho: 17, z: MONEDA },         // Bruto recalculado
  { ancho: 13, z: MONEDA },         // Diferencia
  { ancho: 16, z: MONEDA },         // Pagado
  { ancho: 16, z: MONEDA },         // Saldo
]

/**
 * 🧾 La solapa **14 Cuentas corrientes** — el saldo al cierre con cada contraparte (A-FEAT-1218).
 *
 * Pedido del usuario: *«él le factura a la SRL y cobra mensual (…) **es una cuenta corriente, se
 * debería reflejar el saldo a cierre de balance**»*. Y su definición, que es la que gobierna el
 * signo: *«si AMS factura 100 y cobré 120, debe 20; si cobré 90, tiene a cobrar 10»*.
 *
 * 📋 **Primero el resumen** —una fila por contraparte con su saldo— y **después el detalle** de cada
 * una, asiento por asiento con el saldo acumulado. El resumen es lo que va al balance; el detalle es
 * lo que deja revisar un número que no cierra.
 *
 * 🛑 **Y al final, lo que NO se trató todavía**, por pedido expreso suyo: *«no es lo mismo todo lo
 * relacionado a RET, RET 3, AP; debemos ir tratando cada cosa a la vez»*. No se reparte ni se
 * esconde — se muestra con su total, que es cuánta plata falta encuadrar.
 */
export function hojaDeCuentasCorrientes(cc: PapelDeCuentasCorrientes, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`CUENTAS CORRIENTES — saldo al ${fechaCierre}`])
  f.push(["Saldo positivo = le debemos. Negativo = tenemos a cobrar."])
  // ✍️ A-FEAT-1388 — usuario 27/10: «poner saldo de inicio cero y que dé lo que dé, pero luego podremos modificar».
  f.push(["Saldo de INICIO: el cargado en la pantalla del balance; si no hay, 0 marcado «sin dato». El SALDO AL CIERRE es formula: se puede cambiar el inicio aca."])
  f.push([])
  f.push(["Contraparte", "CUIT", "Saldo al INICIO", "Facturado", "Vendido (compensa)",
    "Pagado/cobrado", "Movimiento del ejercicio", "SALDO AL CIERRE", "Cómo se lee"])

  const desde = f.length + 1
  for (const c of cc.cuentas) {
    const n = f.length + 1
    f.push([
      c.contraparte.nombre,
      c.contraparte.cuit,
      money(c.saldoInicio),
      money(c.resumen.totalComprado),
      money(c.resumen.totalVendido),
      money(c.resumen.totalPagado),
      money(c.resumen.saldo),
      conFormula(`C${n}+G${n}`, money(c.saldoAlCierre)),
      // 🎚️ El 0 de un inicio sin cargar es un default, no un dato: se dice (y sale en ámbar).
      c.inicioSinDato
        ? `sin dato de inicio (0 por default) · ${leyendaSaldo(c.saldoAlCierre)}`
        // 🤖 A-FEAT-1386: el inicio que puso Claude y espera el OK de JMS se dice en el Excel
        : c.inicioTentativo ? `${c.inicioTentativo} · ${leyendaSaldo(c.saldoAlCierre)}` : leyendaSaldo(c.saldoAlCierre),
    ])
  }
  const hasta = f.length
  f.push(["TOTAL", "", ...(["C", "D", "E", "F", "G", "H"] as const).map((col, i) =>
    conFormula(`SUM(${col}${desde}:${col}${hasta})`, money([
      cc.cuentas.reduce((s, c) => s + c.saldoInicio, 0),
      cc.cuentas.reduce((s, c) => s + c.resumen.totalComprado, 0),
      cc.cuentas.reduce((s, c) => s + c.resumen.totalVendido, 0),
      cc.cuentas.reduce((s, c) => s + c.resumen.totalPagado, 0),
      cc.cuentas.reduce((s, c) => s + c.resumen.saldo, 0),
      cc.cuentas.reduce((s, c) => s + c.saldoAlCierre, 0),
    ][i])))])

  // ── 🛑 Lo que falta encuadrar ────────────────────────────────────────────────────────
  if (cc.sinTratar.length > 0) {
    f.push([])
    f.push([])
    f.push(["TODAVIA SIN TRATAR — marcas del extracto que no son ninguna de estas cuentas"])
    f.push(["Se muestran enteras y NO se reparten: cada una se trata por separado."])
    f.push(["Marca en la columna Contable", "Movimientos", "Total"])
    cc.sinTratar.forEach(x => f.push([x.etiqueta, x.movimientos, money(x.total)]))
    f.push(["TOTAL SIN TRATAR", "", money(cc.totalSinTratar)])
  }

  // ── 💳 «Desglosar» abierto con los consumos de la tarjeta (A-FEAT-1388) ─────────────────
  const dt = cc.desgloseTarjeta
  if (dt && dt.pagos.length > 0) {
    f.push([])
    f.push([])
    f.push(["DESGLOSAR — los pagos de la tarjeta Visa Business de MSA, abiertos con los consumos de su resumen"])
    f.push(["Cada consumo va con SU marca de la tarjeta. Lo marcado para otra persona sigue sin tratar bajo esa marca; lo sin marca es gasto de MSA."])
    f.push(["Destino", "Póliza", "Consumos", "Importe", "Qué es"])
    const n0 = f.length + 1
    dt.porDestino.forEach(d => f.push([d.destino, d.poliza ? "SÍ — póliza" : "", d.consumos, money(d.importe), d.ejemplos.join(" · ")]))
    const nT = f.length + 1
    // 🧮 Dos caminos: la suma de los destinos (consumo por consumo) contra los débitos del banco.
    const abierto = money(dt.porDestino.reduce((s, d) => s + d.importe, 0))
    f.push(["TOTAL ABIERTO", "", "", conFormula(`SUM(D${n0}:D${nT - 1})`, abierto)])
    if (dt.sinAbrir !== 0) f.push(["⚠️ Sin resumen que lo abra (queda como Desglosar)", "", "", money(dt.sinAbrir)])
    f.push(["Pagos del banco marcados Desglosar", "", "", money(dt.total)])
    const dif = money(dt.total - abierto - dt.sinAbrir)
    f.push(["CONTROL: pagos del banco − (lo abierto + lo sin abrir) (tiene que dar 0)", "", "", money(dif), Math.abs(dif) < 0.01 ? "cuadra" : "NO CUADRA"])
    f.push([])
    f.push(["Pago del banco", "Débitos", "Importe del pago", "Consumos del resumen", "Diferencia", "Control"])
    dt.pagos.forEach(p => f.push([p.fecha, p.debitos, money(p.importe), money(p.importe - p.diferencia), money(p.diferencia),
      p.cierra ? "cuadra" : p.partes.length === 0 ? "NO CUADRA: no hay resumen que venza ese día" : "NO CUADRA: los consumos no dan el pago"]))
  }
  if (cc.historicoSinAtribuir > 0) {
    f.push([])
    f.push([`${cc.historicoSinAtribuir} comprobante(s) del sistema anterior no se pudieron atribuir `
      + "a ninguna de estas cuentas (el historico no guarda CUIT, se une por nombre)."])
  }

  // ── 🛡️ Las aseguradoras: saldo de DOCUMENTACIÓN al cierre (A-FEAT-1385) ─────────────────
  for (const a of cc.aseguradoras ?? []) {
    f.push([])
    f.push([])
    f.push([`ASEGURADORA — ${a.nombre} — saldo de documentación al ${a.fechaCierre}`])
    f.push(["Sale de las pólizas (cuotas y notas de crédito de sus PDF) contra los débitos y reintegros del banco, estén o no conciliados."])
    f.push(["Saldo positivo = nos debitaron o acreditaron algo que ningún comprobante cierra (FALTAN COMPROBANTES). Negativo = la aseguradora nos debe."])
    const nSaldo = f.length + 1
    f.push(["SALDO AL CIERRE", "", money(a.saldo), a.saldo === 0 ? "✓ papeles y plata coinciden" : "⚠️ FALTAN COMPROBANTES: reclamar lo de abajo"])
    if (a.aReclamar.length) {
      f.push(["A reclamar", "Póliza", "Importe", "Qué es", "Desde"])
      // Agrupado: «Notas de crédito pendientes» (falta el papel) aparte de «Saldo a favor pendiente» (falta la plata).
      const cats = [...new Set(a.aReclamar.map(x => x.categoria))]
      for (const cat of cats) {
        const del = a.aReclamar.filter(x => x.categoria === cat)
        del.forEach(x => {
          f.push([cat, x.poliza ?? "", money(x.importe), x.que, x.desde ? `viene de ${x.desde}` : ""])
          // Desde el monto de la póliza, para poder controlarlo: facturado − NC = neto; pagado; diferencia.
          if (x.explicacion) f.push(["", "", "", `Facturado ${money(x.explicacion.facturado)} − NC ${money(-x.explicacion.notasCredito)} = neto ${money(x.explicacion.neto)} · pagado ${money(x.explicacion.pagado)}`])
        })
        if (del.length > 1) f.push([`Subtotal ${cat}`, "", money(Math.round(del.reduce((t, x) => t + x.importe, 0) * 100) / 100)])
      }
    }
    if (!a.cierra) f.push(["🛑 CONTROL: la suma de «a reclamar» no da el saldo de la cuenta corriente. Avisar."])
    f.push([])
    f.push([`DETALLE — cuenta corriente con ${a.nombre}`])
    f.push(["Fecha", "Póliza", "Concepto", "Cargo", "Crédito", "Saldo"])
    a.lineas.forEach(l => f.push([l.fecha, l.poliza ?? "", l.concepto, l.cargo ? money(l.cargo) : "", l.credito ? money(l.credito) : "", money(l.saldo)]))
    /**
     * 🧮 A-FEAT-1388 — usuario 27/10: *«¿esto no debería dar mismo resultado de lo de arriba?»*. Da lo
     * mismo, pero el papel no lo mostraba: el saldo final del detalle tiene que ser el SALDO AL CIERRE.
     */
    if (a.lineas.length > 0) {
      const nUltima = f.length
      const final = a.lineas[a.lineas.length - 1].saldo
      const dif = money(final - a.saldo)
      f.push(["CONTROL: saldo final del detalle − SALDO AL CIERRE de arriba (tiene que dar 0)", "", "", "", "",
        conFormula(`F${nUltima}-C${nSaldo}`, dif), Math.abs(dif) < 0.01 ? "cuadra" : "NO CUADRA"])
    }

    // 🚗 A-FEAT-1422 nota 9 (JMS 29/10): el desglose de la FLOTA, tabla aparte.
    const rf = a.repartoFlota
    if (rf && rf.filas.length) {
      f.push([])
      f.push([`DESGLOSE DE LA FLOTA — cada débito del ejercicio repartido por vehículo (prima de cada uno)`])
      f.push(["Lo que no es de MSA lo pagó MSA por otro: va a su cuenta corriente / Distribuciones. El responsable de cada vehículo se edita en Egresos → Seguros."])
      f.push(["Fecha débito", "Póliza", "Vencimiento", "Debitado", ...rf.responsables, "Control"])
      const n0 = f.length + 1
      rf.filas.forEach((x, i) => {
        const fila = n0 + i
        const ultimaParte = XLSX.utils.encode_col(3 + rf.responsables.length)
        f.push([x.fecha, x.poliza, x.vencimiento, money(x.debitado), ...rf.responsables.map(r => money(x.partes[r] ?? 0)),
          conFormula(`D${fila}-SUM(E${fila}:${ultimaParte}${fila})`, 0)])
      })
      const nf = n0 + rf.filas.length - 1
      f.push(["TOTAL", "", "", conFormula(`SUM(D${n0}:D${nf})`, rf.total),
        ...rf.responsables.map((r, i) => { const col = XLSX.utils.encode_col(4 + i); return conFormula(`SUM(${col}${n0}:${col}${nf})`, rf.totales[r] ?? 0) })])
      if (rf.sinReparto) f.push([`⚠️ ${money(rf.sinReparto)} de débitos sin vehículos leídos en su póliza: van enteros a MSA.`])
    }
  }

  // ── El detalle de cada cuenta ────────────────────────────────────────────────────────
  for (const c of cc.cuentas) {
    if (c.resumen.asientos.length === 0) continue
    f.push([])
    f.push([])
    f.push([`DETALLE — ${c.contraparte.nombre}`])
    f.push(["Fecha", "Qué es", "Concepto", "Importe", "Saldo acumulado"])
    for (const x of c.resumen.asientos) {
      f.push([
        x.fecha,
        x.tipo === "compra" ? "nos factura" : x.tipo === "venta" ? "le facturamos" : "pago",
        // 🔴 Un pago que no dice contra qué fue es el que genera saldo sin que nadie lo note.
        x.sinReferencia ? `${x.concepto}  ← sin referencia` : x.concepto,
        money(x.importe),
        money(x.saldo),
      ])
    }
    if (c.resumen.pagosSinReferencia > 0) {
      f.push([`${c.resumen.pagosSinReferencia} pago(s) no dicen contra que comprobante fueron.`])
    }
  }
  return f
}

const COLS_CUENTAS_CORRIENTES: Columna[] = [
  { ancho: 34 },                    // Contraparte / Fecha
  { ancho: 14 },                    // CUIT / Qué es
  { ancho: 18, z: MONEDA },         // Saldo al inicio / Concepto
  { ancho: 18, z: MONEDA },         // Facturado / Importe
  { ancho: 18, z: MONEDA },         // Vendido / Saldo acumulado
  { ancho: 18, z: MONEDA },         // Pagado
  { ancho: 20, z: MONEDA },         // Movimiento del ejercicio
  { ancho: 20, z: MONEDA },         // SALDO AL CIERRE
  { ancho: 26 },                    // Cómo se lee
]

/**
 * 🧾 La solapa **03.1 Provisión de cobros** — el espejo del papel 05, del lado de las ventas.
 *
 * *«Facturas o liquidaciones (siempre de venta) de cosas que sucedieron antes del cierre y se
 * emitieron después»* — la definición es suya, de la hoja `PROVISION COBROS`.
 *
 * 📌 Es exactamente la misma regla que la provisión de facturas: **fecha ≤ cierre, subdiario
 * posterior**. Por eso no hay que marcar nada a mano: la marca ya está, es el subdiario.
 *
 * 🚫 Y abajo va el bloque de **cheques en cartera diciendo que no hay registro**. Omitirlo se leería
 * como *«no había»*, que no es lo mismo que *«no lo sabemos»*.
 */
/**
 * 📒 «Asientos Contables» (A-FEAT-1318): las facturas no informadas en ARCA que no entraron en ningún
 * subdiario, para que el contador las registre con asientos. Del ejercicio por su fecha de emisión.
 */
export function hojaDeAsientosContables(asientos: AsientoLibroDiario[], etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`ASIENTOS CONTABLES — ejercicio ${etiqueta}`])
  f.push(["Facturas NO informadas en ARCA que no van al subdiario de IVA: se registran con asientos contables."])
  f.push(["No están en ningún subdiario (ni en el Libro IVA): pertenecen al ejercicio por su fecha de emisión."])
  f.push([])
  hojaDeAsientos(asientos).forEach(r => f.push(r))
  if (asientos.length > 0) {
    // La fila 5 es la cabecera, así que el detalle arranca en la 6. Columnas H..M = Neto … Total.
    const desde = 6
    const hasta = 5 + asientos.length
    const suma = (k: keyof AsientoLibroDiario) => money(asientos.reduce((s, a) => s + (Number(a[k]) || 0), 0))
    f.push(["", "", "", "", "", "", "TOTAL",
      conFormula(`SUM(H${desde}:H${hasta})`, suma("neto_gravado")),
      conFormula(`SUM(I${desde}:I${hasta})`, suma("no_gravado")),
      conFormula(`SUM(J${desde}:J${hasta})`, suma("exento")),
      conFormula(`SUM(K${desde}:K${hasta})`, suma("otros_tributos")),
      conFormula(`SUM(L${desde}:L${hasta})`, suma("iva")),
      conFormula(`SUM(M${desde}:M${hasta})`, suma("total"))])
  } else {
    f.push([])
    f.push(["NO HAY facturas en «Asientos Contables» en este ejercicio."])
  }
  return f
}

function hojaDeProvisionCobros(ventas: AsientoLibroDiario[], etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`PROVISIÓN DE COBROS — ejercicio ${etiqueta}`])
  f.push(["Ventas de cosas que pasaron ANTES del cierre y se facturaron DESPUES:"])
  f.push(["fecha del comprobante anterior al cierre, pero entro en un subdiario posterior."])
  f.push([])
  hojaDeAsientos(ventas).forEach(r => f.push(r))
  if (ventas.length > 0) {
    // La fila 5 es la cabecera, así que el detalle arranca en la 6. La columna M es el Total.
    const desde = 6
    const hasta = 5 + ventas.length
    const total = ventas.reduce((s, a) => s + a.total, 0)
    f.push(["", "", "", "", "", "", "TOTAL", "", "", "", "", "",
      conFormula(`SUM(M${desde}:M${hasta})`, money(total))])
  }
  if (ventas.length === 0) {
    f.push([])
    f.push(["NO HAY ventas a provisionar: ninguna con fecha anterior al cierre entró en un "
      + "subdiario posterior. El año pasado tampoco hubo."])
  }

  f.push([])
  f.push([])
  f.push(["CHEQUES EN CARTERA — NO SE PUEDE CALCULAR: el sistema no registra valores recibidos"])
  f.push(["La tabla de cheques guarda solo los que EMITIMOS (el beneficiario es el proveedor)."])
  f.push(["No hay tabla de cheques de clientes, asi que este bloque no sale del sistema: hay que"])
  f.push(["cargarlo a mano si hubiera. En el balance anterior no habia ninguno. Ver A-DAT-74."])
  f.push([])
  f.push(["ANTICIPOS DE CLIENTES (cobros a cuenta) — están en la solapa «04.2 Anticipos»"])
  f.push(["Salen de la misma tabla que los anticipos a proveedores, por eso van juntos alli."])
  return f
}

/**
 * 🗂️ La solapa **00 Índice** — la primera que se abre.
 *
 * Es el checklist de los papeles con lo que hay y lo que falta de cada uno, **calculado del dato**
 * (ver `indice-papeles.ts`). Arriba, separados, los que **impiden entregar**: § 🧮 de `CLAUDE.md`,
 * *el control se ve y es proporcional*.
 */
function hojaDeIndice(indice: IndiceDelBalance, libro: LibroDiario, empresa: string): unknown[][] {
  const f: unknown[][] = []
  const ej = libro.ejercicio

  f.push([`PAPELES DE TRABAJO DEL BALANCE — ${empresa} — EJERCICIO ${ej.etiqueta}`])
  f.push([`Cierre: ${ej.fechaCierre}`])
  f.push([`Generado: ${new Date().toISOString().slice(0, 10)}`])
  f.push([])
  f.push(["Los 9 papeles son los que se le mandaron al contador el balance anterior."])
  f.push(["El estado de cada uno NO esta escrito a mano: sale de mirar el dato de este mismo archivo."])
  f.push([])

  const c = indice.cuenta
  f.push(["RESUMEN", `${c.completo} completos`, `${c.parcial} parciales`,
    `${c.falta} sin armar`, `${c["lo carga el usuario"]} los carga el usuario`])
  f.push([])

  if (indice.bloqueos.length > 0) {
    f.push([`NO SE PUEDE ENTREGAR TODAVIA — ${indice.bloqueos.length} bloqueo(s)`])
    indice.bloqueos.forEach(b => f.push(["", `${b.numero} ${b.papel}`, b.queFalta]))
    f.push([])
    f.push(["El archivo se genera igual: es la forma de ver donde esta el problema."])
    f.push([])
  } else {
    f.push(["Sin bloqueos: los papeles que estan armados se pueden entregar."])
    f.push([])
  }

  f.push(["#", "Papel", "Estado", "Que hay hoy", "Que falta", "Solapa"])
  for (const p of indice.partes) {
    f.push([p.numero, p.papel, etiquetaEstado(p.estado), p.queTiene, p.queFalta, p.solapa])
  }
  return f
}

/** El estado en palabras. Sin emojis: el contador lo abre en Excel y los emojis no siempre salen. */
const etiquetaEstado = (e: EstadoParte): string => ({
  completo: "COMPLETO",
  parcial: "PARCIAL",
  falta: "SIN ARMAR",
  "lo carga el usuario": "LO CARGA EL USUARIO",
}[e])

/** La solapa de pendientes: número, texto largo, fechas y la resolución. */
const COLS_PENDIENTES: Columna[] = [
  { ancho: 4 }, { ancho: 80 }, { ancho: 11 }, { ancho: 10 }, { ancho: 50 }, { ancho: 11 },
]

const COLS_INDICE: Columna[] = [
  { ancho: 7 },                     // #
  { ancho: 46 },                    // Papel
  { ancho: 21 },                    // Estado
  { ancho: 60 },                    // Que hay hoy
  { ancho: 70 },                    // Que falta
  { ancho: 42 },                    // Solapa
]

/**
 * 🏦 La solapa **07 Bancos** — saldos al cierre y fondos comunes.
 *
 * ⚠️ Dos cosas van **vacías a propósito** y el papel lo dice: el **saldo al inicio** del ejercicio
 * (no está en el sistema) y el **saldo del fondo** en las dos puntas (el extracto ve la plata que
 * entra y sale de la cuenta, no cuánto quedó invertido). Sin esos números el resultado financiero
 * **no se puede calcular**, y mostrar un cero ahí parecería un resultado.
 */
function hojaDeBancos(
  saldos: Array<{ nombre: string; saldo: number | null; fecha: string | null }>,
  fci: { fondos: FondoComun[]; total: FondoComun },
  fechaCierre: string,
  /** 🏦 La cadena inicio → cierre de cada cuenta (A-FEAT-1206). Vacío = no se pudo armar. */
  cadenas: CadenaDeSaldos[] = [],
): unknown[][] {
  const f: unknown[][] = []
  f.push([`SALDOS BANCARIOS Y DE CAJA AL ${fechaCierre}`])
  f.push([])
  f.push(["Cuenta", "Saldo al cierre", "Fecha del ultimo movimiento", "Saldo al INICIO del ejercicio"])
  for (const s of saldos) {
    const c = cadenas.find(x => x.cuenta === s.nombre)
    f.push([
      s.nombre, s.saldo ?? "sin saldo en el periodo", s.fecha ?? "",
      /**
       * 🎚️ El saldo al inicio viene puesto **si está declarado**, y la celda sigue siendo suya
       * (§ 🎚️ *default del dato real, siempre editable*). Donde no se conoce, se dice — antes iba
       * vacío en todas y no se distinguía «no lo sabemos» de «es cero».
       */
      c?.saldoInicio ?? "",
    ])
  }
  const conSaldo = saldos.filter(s => s.saldo != null)
  const desde = 4
  const hasta = 3 + saldos.length
  f.push(["TOTAL",
    conSaldo.length > 0
      ? conFormula(`SUM(B${desde}:B${hasta})`, money(conSaldo.reduce((t, s) => t + (s.saldo ?? 0), 0)))
      : 0,
    "",
    conFormula(`SUM(D${desde}:D${hasta})`,
      money(cadenas.reduce((t, c) => t + (c.saldoInicio ?? 0), 0)))])
  f.push([])
  f.push(["El saldo al cierre es el del ULTIMO movimiento del ejercicio, tomado por fecha Y por orden"])
  f.push(["dentro del dia: el 30/06 hay 10 movimientos y entre el primero y el ultimo hay $2,58 M."])
  f.push([])
  f.push([])


  /**
   * 💹 **Los fondos comunes son CUOTAPARTES, no un saldo.**
   *
   * Corrección del usuario 2026-09-29: *«FCI son cuotapartes, con lo cual el saldo de inicio es
   * cuotas × precio y el final también»*.
   *
   * 🔑 **No es un detalle de presentación: cambia de dónde sale el resultado.** Un fondo no rinde
   * porque el saldo suba, rinde porque **el precio de la cuotaparte** sube; y las cuotapartes sólo
   * cambian cuando se suscribe o se rescata. Pedir un «saldo» obliga al usuario a hacer la
   * multiplicación afuera —y a rehacerla cada vez que corrige un precio—, que es justo lo que la
   * § 🎚️ de `CLAUDE.md` manda evitar.
   *
   * Entonces la solapa pide **cuatro números** —cuotapartes y precio, al inicio y al cierre— y
   * calcula los dos saldos **y** el resultado con fórmulas.
   */
  f.push(["FONDOS COMUNES DE INVERSION — son CUOTAPARTES: el saldo es cuotas x precio"])
  f.push([])
  f.push(["Complete las cuatro columnas en amarillo (cuotapartes y precio, al inicio y al cierre)."])
  f.push(["Los saldos y el resultado se calculan solos."])
  f.push([])
  f.push(["Donde",
    "Cuotapartes al inicio", "Precio al inicio", "Saldo al inicio",
    "Suscripciones", "Rescates",
    "Cuotapartes al cierre", "Precio al cierre", "Saldo al cierre",
    "Resultado financiero", "Movimientos"])

  const filaPrimerFondo = f.length + 1
  for (const x of fci.fondos) {
    const n = f.length + 1
    f.push([
      x.donde,
      "", "",                                               // B, C — los carga el usuario
      { t: "n", f: `IF(OR(B${n}="",C${n}=""),"",B${n}*C${n})`, z: MONEDA },
      money(x.suscripciones), money(x.rescates),
      "", "",                                               // G, H — los carga el usuario
      { t: "n", f: `IF(OR(G${n}="",H${n}=""),"",G${n}*H${n})`, z: MONEDA },
      /**
       * 🧮 El resultado por el camino inverso: lo que el fondo rindió es lo que el saldo final tiene
       * y que la plata movida no explica. Con las cuotapartes puestas, sale solo.
       */
      { t: "n", f: `IF(OR(D${n}="",I${n}=""),"faltan cuotapartes y precio",I${n}-(D${n}+E${n}-F${n}))`, z: MONEDA },
      x.movimientos,
    ])
  }
  const ultimoFondo = f.length
  const nT = f.length + 1
  f.push(["TOTAL",
    "", "", conFormula(`SUM(D${filaPrimerFondo}:D${ultimoFondo})`, 0),
    conFormula(`SUM(E${filaPrimerFondo}:E${ultimoFondo})`, money(fci.total.suscripciones)),
    conFormula(`SUM(F${filaPrimerFondo}:F${ultimoFondo})`, money(fci.total.rescates)),
    "", "", conFormula(`SUM(I${filaPrimerFondo}:I${ultimoFondo})`, 0),
    conFormula(`SUM(J${filaPrimerFondo}:J${ultimoFondo})`, 0),
    fci.total.movimientos])
  void nT
  f.push([])
  f.push(["Suscribir es plata que SALE de la cuenta; rescatar es plata que ENTRA."])
  f.push(["Las cuotapartes SOLO cambian al suscribir o rescatar; lo que se mueve entre medio es el PRECIO."])
  f.push(["Control: saldo al cierre - (saldo al inicio + suscripciones - rescates) = resultado financiero."])
  f.push(["Y el control cruzado: si las cuotapartes al cierre no son las del inicio mas lo neto suscripto,"])
  f.push(["falta o sobra una operacion del fondo."])
  return f
}

const COLS_BANCOS: Columna[] = [
  { ancho: 34 },                          // A · Cuenta / Donde
  { ancho: 16, z: "#,##0.0000" },         // B · Cuotapartes al inicio (llevan decimales)
  { ancho: 15, z: "#,##0.0000" },         // C · Precio al inicio
  { ancho: 18, z: MONEDA },               // D · Saldo al inicio
  { ancho: 18, z: MONEDA },               // E · Suscripciones
  { ancho: 18, z: MONEDA },               // F · Rescates
  { ancho: 16, z: "#,##0.0000" },         // G · Cuotapartes al cierre
  { ancho: 15, z: "#,##0.0000" },         // H · Precio al cierre
  { ancho: 18, z: MONEDA },               // I · Saldo al cierre
  { ancho: 22, z: MONEDA },               // J · Resultado financiero
  { ancho: 13, z: ENTERO },               // K · Movimientos
]

/**
 * 🏦 La solapa **08 Gastos bancarios** — un concepto por fila, los 12 meses en columnas.
 *
 * Es el formato de su `- detalle completo gastos bancarios e impuestos extractos. por mes`. Los
 * conceptos salen del **plan de cuentas** (`IMPUESTOS BANCARIOS` y `GASTOS BANCARIOS`), no de una
 * lista escrita acá.
 */
function hojaDeGastosBancarios(g: GastosBancarios, etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`GASTOS BANCARIOS E IMPUESTOS DEL EXTRACTO — ejercicio ${etiqueta}`])
  f.push(["Los conceptos salen del plan de cuentas: totalizadoras IMPUESTOS BANCARIOS y GASTOS BANCARIOS."])
  // ⚠️ cambió 2026-10-27 (A-FEAT-1388): mostraba sólo lo debitado y las devoluciones quedaban afuera.
  f.push(["Cada mes es el NETO: lo que debito el banco menos lo que devolvio. La columna Devoluciones dice cuanto se resto."])

  const conDatos = g.meses.filter((_, i) => g.total.debitos[i] !== 0 || g.total.creditos[i] !== 0)
  if (conDatos.length < g.meses.length) {
    f.push([])
    f.push([`ATENCION: solo ${conDatos.length} de los ${g.meses.length} meses del ejercicio tienen movimientos.`])
    f.push([`Sin datos: ${g.meses.filter(m => !conDatos.includes(m)).join(", ")}`])
    f.push(["El total de abajo NO es el del ejercicio completo."])
  }
  f.push([])
  f.push(["Totalizadora", "Concepto", ...g.meses, "TOTAL (neto)", "Devoluciones", "Movimientos"])

  const fila = (x: FilaConceptoPorMes, esTotal = false) => {
    const n = f.length + 1
    const ultima = String.fromCharCode(66 + g.meses.length)   // la del ultimo mes (C es el primero)
    f.push([
      esTotal ? "" : x.totalizadora, x.concepto,
      ...x.debitos.map((v, i) => money(v - x.creditos[i])),
      conFormula(`SUM(C${n}:${ultima}${n})`, money(x.totalDebitos - x.totalCreditos)),
      x.totalCreditos ? money(x.totalCreditos) : "",
      x.movimientos,
    ])
  }

  for (const t of TOTALIZADORAS_BANCARIAS) {
    const dela = g.filas.filter(x => x.totalizadora === t)
    if (dela.length === 0) continue
    dela.forEach(x => fila(x))
    const s = g.subtotales.find(s => s.totalizadora === t)
    if (s) fila(s, true)
    f.push([])
  }
  fila(g.total, true)

  if (g.sinClasificar.length > 0) {
    f.push([])
    f.push([])
    f.push(["PARECEN BANCARIOS Y NO ESTAN EN EL PLAN DE CUENTAS"])
    f.push(["No entran al papel porque no se sabe en que totalizadora van. Hay que darles cuenta contable."])
    f.push(["Categoria del extracto", "Debitos", "Creditos", "Movimientos"])
    g.sinClasificar.forEach(s => f.push([s.categ, money(s.debitos), money(s.creditos), s.movimientos]))
  }
  return f
}

/**
 * 🔄 La solapa **09 Retiros y aportes**.
 *
 * Un retiro va **negativo** y un aporte **positivo**, como en su planilla, así que el neto se lee de
 * una sola pasada.
 */
/**
 * 🧾 **Papel 08.1 — impuesto a los débitos y créditos (Ley 25.413), total y desglosado.**
 * Pedido del usuario 2026-10-03: *«debe ser un cuadro importante, total y desglosado»*. Lo
 * computable como pago a cuenta de Ganancias se calcula con FÓRMULA sobre los porcentajes de la
 * solapa, así si el contador usa otro porcentaje lo cambia en una celda.
 */
function hojaDeImpuestoCheque(c: ImpuestoCheque, etiqueta: string, control?: ControlCheque): unknown[][] {
  const f: unknown[][] = []
  f.push([`IMPUESTO A LOS DEBITOS Y CREDITOS BANCARIOS (Ley 25.413) — ejercicio ${etiqueta}`])
  f.push(["Sale del extracto: cada debito del impuesto es un movimiento propio del banco."])
  f.push([])
  f.push(["Mes", ETIQUETA_CONCEPTO.creditos, ETIQUETA_CONCEPTO.debitos, ETIQUETA_CONCEPTO.efectivo, "TOTAL", "Movimientos"])
  const primera = f.length + 1
  for (const m of c.porMes) {
    const n = f.length + 1
    f.push([m.mes, money(m.creditos), money(m.debitos), money(m.efectivo),
      conFormula(`SUM(B${n}:D${n})`, money(m.total)),
      c.mesesSinExtracto.includes(m.mes) ? "SIN EXTRACTO" : m.movimientos])
  }
  const ultima = f.length
  const nT = f.length + 1
  f.push(["TOTAL",
    conFormula(`SUM(B${primera}:B${ultima})`, money(c.total.creditos)),
    conFormula(`SUM(C${primera}:C${ultima})`, money(c.total.debitos)),
    conFormula(`SUM(D${primera}:D${ultima})`, money(c.total.efectivo)),
    conFormula(`SUM(E${primera}:E${ultima})`, money(c.total.total)),
    c.total.movimientos])
  f.push([])
  f.push(["COMPUTABLE COMO PAGO A CUENTA DE GANANCIAS (credito impositivo al cierre)"])
  const nPg = f.length + 1
  f.push(["% sobre alicuota general (creditos + debitos)", c.pctGeneral])
  const nPe = f.length + 1
  f.push(["% sobre alicuota doble (extraccion en efectivo)", c.pctEfectivo])
  f.push(["Computable", conFormula(`(B${nT}+C${nT})*B${nPg}+D${nT}*B${nPe}`, money(c.computable))])
  f.push(["No computable (va a gasto)", conFormula(`E${nT}-((B${nT}+C${nT})*B${nPg}+D${nT}*B${nPe})`, money(c.total.total - c.computable))])
  f.push([])
  f.push(["MSA computa el 100% por su categoria de empresa; el resto, 33% / 20% (Decreto 409/2018). Se cambia en la celda."])
  if (c.mesesSinExtracto.length > 0) {
    f.push([`ATENCION: ${c.mesesSinExtracto.length} mes(es) sin extracto en la app (${c.mesesSinExtracto.join(", ")}): el impuesto de esos meses NO esta en este total.`])
  }
  // 🧮 A-FEAT-1388 — el mismo impuesto llega por tres caminos independientes: tienen que dar igual.
  if (control) {
    f.push([])
    f.push(["CONTROL — EL MISMO IMPUESTO POR TRES CAMINOS (tienen que dar igual)"])
    f.push(["Camino", "Importe", "Diferencia con este papel"])
    const n0 = f.length + 1
    control.caminos.forEach((x, i) => f.push([
      x.camino,
      x.importe ?? "sin dato: ese papel no esta en este Excel",
      i === 0 || x.importe == null ? "" : conFormula(`B${n0 + i}-B${n0}`, x.diferencia ?? 0),
    ]))
    f.push([control.cuadra
      ? "cuadra: los caminos que hay dan lo mismo"
      : "NO CUADRA: alguno de los caminos tiene un movimiento que los otros no — mirar la diferencia"])
  }
  return f
}

function hojaDeRetiros(r: RetirosYAportes, etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`RETIROS Y APORTES DE LOS SOCIOS — ejercicio ${etiqueta}`])
  f.push(["Un retiro va en NEGATIVO (sale de la empresa) y un aporte en POSITIVO."])
  f.push(["No son gasto del resultado: son movimientos patrimoniales."])
  f.push([])
  f.push(["Concepto", ...r.meses, "TOTAL", "Movimientos"])

  const ultima = String.fromCharCode(65 + r.meses.length)
  const fila = (x: typeof r.neto) => {
    const n = f.length + 1
    f.push([x.etiqueta, ...x.porMes.map(v => money(v)),
      conFormula(`SUM(B${n}:${ultima}${n})`, money(x.total)), x.movimientos])
  }

  r.filas.filter(x => x.clase === "retiro").forEach(fila)
  r.filas.filter(x => x.clase === "aporte").forEach(fila)
  f.push([])
  fila(r.neto)

  if (r.sinReconocer.length > 0) {
    f.push([])
    f.push([])
    f.push(["PARECEN RETIRO O APORTE Y NO SE RECONOCIERON"])
    f.push(["Los conceptos de retiro no estan en el plan de cuentas, asi que el papel usa una lista."])
    f.push(["Categoria del extracto", "Importe", "Movimientos"])
    r.sinReconocer.forEach(s => f.push([s.categ, money(s.importe), s.movimientos]))
  }
  return f
}

const COLS_ASIENTOS: Columna[] = [
  { ancho: 10 },                    // Subdiario
  { ancho: 11 },                    // Fecha
  { ancho: 6, z: ENTERO },          // Tipo
  { ancho: 8, z: ENTERO },          // Pto Vta
  { ancho: 11, z: ENTERO },         // Número
  { ancho: 13 },                    // CUIT
  { ancho: 42 },                    // Denominación
  { ancho: 15, z: MONEDA },         // Neto Gravado
  { ancho: 14, z: MONEDA },         // No Gravado
  { ancho: 13, z: MONEDA },         // Exentas
  { ancho: 14, z: MONEDA },         // Otros Tributos
  { ancho: 13, z: MONEDA },         // IVA
  { ancho: 16, z: MONEDA },         // Total
  { ancho: 26 },                    // Cuenta contable
  { ancho: 12 },                    // Nro cuenta
  { ancho: 18 },                    // Centro de costo
  { ancho: 17 },                    // Origen del dato
  { ancho: 8 },                     // Moneda
  { ancho: 10, z: COEFICIENTE },    // Tipo de cambio
  { ancho: 16, z: MONEDA },         // Total en moneda original
  { ancho: 70 },                    // Control de partes (A-FEAT-1388)
]

/** Ventas: lo mismo que los asientos, más qué se vendió y cuánto (U2), antes del Control de partes. */
const COLS_VENTAS: Columna[] = [
  ...COLS_ASIENTOS.slice(0, 20),
  { ancho: 16 },                    // Producto
  { ancho: 12, z: TONELADAS },      // Toneladas
  { ancho: 10, z: ENTERO },         // Cabezas
  { ancho: 12, z: ENTERO },         // Kilos
  { ancho: 70 },                    // Control de partes
]

/**
 * Las cuotas de templates, en el mismo formato de fila que el libro diario — pedido del usuario:
 * *«replicar formato de libro diario con los templates»*.
 */
export function hojaDeTemplates(t: TemplatesDelEjercicio): unknown[][] {
  const f: unknown[][] = [[
    "Fecha", "Concepto", "Proveedor", "Categoría", "Cuenta contable", "Nro cuenta",
    "Centro de costo", "Responsable", "Estado", "Débito", "Crédito",
  ]]
  // Ordenado por tipo, responsable (la empresa del balance primero) y fecha: el orden lo pone
  // `armarTemplatesDelEjercicio`, el mismo de «Templates por mes» (usuario 2026-10-24: «las 2 deben
  // estar ordenadas por responsable»; 2026-10-27: «si es MSA primero MSA, luego MA, luego PAM»).
  const ordenadas = t.detalle
  /** Una cuota en el formato del libro diario: lo que salió en Débito, lo que entró en Crédito. */
  const filaCuota = (c: CuotaTemplate) => [
    c.fecha ?? "", c.concepto, c.proveedor, c.categ, c.cuenta_contable, c.nro_cuenta,
    c.centro_costo, c.responsable, c.estado,
    c.monto >= 0 ? money(c.monto) : "", c.monto < 0 ? money(-c.monto) : "",
  ]
  // 🗂️ A-FEAT-1342: un bloque por tipo, con su subtotal.
  let tipoActual: string | null = null
  const cerrarTipo = () => {
    if (tipoActual == null) return
    const g = (t.porTipo ?? []).find(x => x.tipo === tipoActual)
    f.push([`Total ${NOMBRE_TIPO[tipoActual as TipoTemplate].split(" — ")[0]}`, "", "", "", "", "", "", "", "",
      money(g?.totalDebitos ?? 0), money(g?.totalCreditos ?? 0)])
    // 💳 A-FEAT-1388 — *«¿muestran lo pagado o lo pendiente también?»*: las dos cosas, y se dice cuánto.
    const pendiente = g?.totalPendiente ?? 0
    f.push(["  de lo cual PAGADO", "", "", "", "", "", "", "", "", money((g?.totalNeto ?? 0) - pendiente)])
    f.push(["  de lo cual PENDIENTE al cierre", "", "", "", "", "", "", "", "", money(pendiente)])
    // 🔎 Con un punto en vez de una fila vacía, el filtro de Excel toma la tabla entera (usuario 27/10:
    //    «puse puntos entre los subtotales para que anden los filtros»).
    f.push(["."])
  }
  for (const c of ordenadas) {
    const tp = c.tipo ?? "sin clasificar"
    if (tp !== tipoActual) { cerrarTipo(); tipoActual = tp; f.push([NOMBRE_TIPO[tp]]) }
    f.push(filaCuota(c))
  }
  cerrarTipo()
  f.push(["TOTAL (todos los tipos)", "", "", "", "", "", "", "", "", money(t.totalDebitos), money(t.totalCreditos)])
  f.push(["Los saldos «PAGADO» y «PENDIENTE» van como DEBITO menos CREDITO. El estado de cada cuota esta en la columna Estado."])
  // 💳 A-BUG-1289: las impagas están en el total (vencieron en el ejercicio) y además son deuda.
  if (t.impagasAlCierre.length > 0) {
    f.push(["."])
    f.push([`IMPAGAS AL CIERRE: ${t.impagasAlCierre.length} cuota(s) por ${money(t.totalImpagas)}. Estan en el total`])
    f.push(["de arriba (son gasto del ejercicio) y ademas figuran como deuda en «04 Cuentas a pagar»."])
  }
  // 🛡️ A-FEAT-1388: los seguros con póliza ya son gasto por su factura. Se listan, no se suman.
  if ((t.enFacturas ?? []).length > 0) {
    f.push(["."])
    f.push([`NO INCLUIDAS — ${t.enFacturas.length} cuota(s) de SEGUROS CON POLIZA por ${money(t.totalEnFacturas)}`])
    f.push(["Ya estan en las facturas de la aseguradora (Compras) y en su cuenta corriente (papel 14):"])
    f.push(["la cuota del template sirve para conciliar el debito del banco. Sumarla aca la contaria dos veces."])
    for (const c of t.enFacturas) f.push(filaCuota(c))
  }
  // 🛑 A-BUG-1289: las desactivadas NO son gasto, pero se listan — nada se descarta en silencio.
  if (t.noIncluidas.length > 0) {
    f.push(["."])
    f.push([`NO INCLUIDAS — ${t.noIncluidas.length} cuota(s) DESACTIVADAS por ${money(t.totalNoIncluidas)}`])
    f.push(["No son gasto: se eligio la otra forma de pago (ej. en cuotas en vez de anual) y su importe"])
    f.push(["suele ser una estimacion. No estan en el total de arriba."])
    for (const c of t.noIncluidas) f.push(filaCuota(c))
  }
  return f
}

/**
 * El resumen `concepto × los 12 meses` — **la forma exacta de su planilla** *«detalle completo
 * gastos bancarios e impuestos por mes»*: filas de concepto, columnas jul→jun con «Suma de
 * Débitos / Suma de Créditos», y el total del ejercicio al final.
 */
/**
 * 🧾 La solapa **Templates por mes** — un mes por columna, **saldado**, y subtotal por responsable.
 *
 * Dos pedidos del usuario del 2026-09-29, revisando el export:
 * > *«templates sin desglosar por responsable»*
 * > *«template x mes siguen con 2 columnas deb y cred en vez de saldado»*
 *
 * Los dos apuntan a lo mismo: la tabla anterior tenía **24 columnas de importes** —débito y crédito
 * por cada mes— y no decía **quién** pagó. Para saber cuánto costó un concepto había que **restar a
 * ojo**, y para saber de qué empresa era, no había forma.
 *
 * Ahora: **un mes, una columna, con el saldo** (débito − crédito), y las filas agrupadas por
 * responsable con su subtotal. Los débitos y créditos abiertos siguen estando en la solapa
 * **Templates**, que es la del detalle.
 */
export function hojaTemplatesPorMes(t: TemplatesDelEjercicio): unknown[][] {
  const f: unknown[][] = []
  f.push(["TEMPLATES POR MES — lo que no entra por subdiario y se informa aparte"])
  f.push(["Cada mes es UNA columna, con el SALDO del mes: debito menos credito."])
  f.push(["Un importe negativo es plata que ENTRO: un ingreso, un rescate o una devolucion del banco."])
  f.push(["Incluye lo PAGADO y lo PENDIENTE al cierre: abajo, en el CONTROL, cuanto es cada uno."])
  f.push(["Las cuotas se cortan por FECHA DE PAGO (o estimada si no hay), no por subdiario:"])
  f.push(["un template no tiene factura de ARCA, asi que no tiene subdiario."])
  if ((t.enFacturas ?? []).length > 0) {
    f.push([`No estan los SEGUROS CON POLIZA (${t.enFacturas.length} cuotas, ${money(t.totalEnFacturas)}): ya son gasto por la factura`])
    f.push(["de la aseguradora y estan en su cuenta corriente (papel 14). Su detalle, al final de la solapa de detalle (Impuestos u Otros)."])
  }
  f.push(["."])

  /**
   * 🗂️ A-FEAT-1388: la columna **Agrupadora** (la totalizadora del plan de cuentas) para poder filtrar
   * por ella — usuario 27/10: *«mejorar orden, agrupadoras»*. Por eso los meses arrancan en la D.
   */
  f.push(["Responsable", "Agrupadora", "Categoría", ...t.columnas, "TOTAL", "Meses con movimiento"])

  /** La letra de la columna del mes `j` (0 = el primero, en la D). */
  const colMes = (j: number) => String.fromCharCode(68 + j)
  /** La última columna de meses, para las fórmulas de total por fila. */
  const ultima = colMes(t.columnas.length - 1)
  const colTotal = colMes(t.columnas.length)
  const sumaFilas = (filas: number[], j: number) => filas.map(r => `${colMes(j)}${r}`).join("+") || "0"

  const filaDe = (x: { responsable: string; agrupadora: string; categ: string; neto: number[]; totalNeto: number }) => {
    const n = f.length + 1
    f.push([
      x.responsable, x.agrupadora, x.categ,
      ...x.neto.map(v => money(v)),
      conFormula(`SUM(D${n}:${ultima}${n})`, money(x.totalNeto)),
      x.neto.filter(v => v !== 0).length,
    ])
    return n
  }
  /** Un renglón de subtotal que suma OTROS renglones (no un rango: adentro hay subtotales). */
  const filaSuma = (etiqueta: [string, string], filas: number[], neto: number[], totalNeto: number) => {
    const n = f.length + 1
    f.push([
      etiqueta[0], etiqueta[1], "",
      ...t.columnas.map((_, j) => conFormula(sumaFilas(filas, j), money(neto[j]))),
      conFormula(`SUM(D${n}:${ultima}${n})`, money(totalNeto)),
      "",
    ])
    return n
  }
  const sumarNeto = (xs: { neto: number[] }[]) => t.columnas.map((_, j) => xs.reduce((s, x) => s + x.neto[j], 0))
  const sumarTotal = (xs: { totalNeto: number }[]) => xs.reduce((s, x) => s + x.totalNeto, 0)

  /**
   * 🗂️ A-FEAT-1342 + A-FEAT-1388: primero el TIPO (egresos, ingresos, distribuciones, financiero…),
   * adentro cada RESPONSABLE (la empresa del balance primero) y, adentro, cada AGRUPADORA del plan con
   * su subtotal (sólo si tiene más de una cuenta). El total de cada responsable suma sus agrupadoras;
   * el del tipo, sus responsables; el del ejercicio, los tipos. El orden ya viene de `armarTemplatesDelEjercicio`.
   */
  const filasTotalTipo: number[] = []
  for (const tp of ORDEN_TIPOS) {
    const delTipo = t.porMes.filter(x => x.tipo === tp)
    if (delTipo.length === 0) continue
    f.push([NOMBRE_TIPO[tp]])
    const filasResponsable: number[] = []
    for (const r of [...new Set(delTipo.map(x => x.responsable))]) {
      const dela = delTipo.filter(x => x.responsable === r)
      const filasDelResponsable: number[] = []
      for (const a of [...new Set(dela.map(x => x.agrupadora ?? SIN_AGRUPADORA))]) {
        const delGrupo = dela.filter(x => (x.agrupadora ?? SIN_AGRUPADORA) === a)
        const filas = delGrupo.map(x => filaDe({ ...x, agrupadora: x.agrupadora ?? SIN_AGRUPADORA }))
        filasDelResponsable.push(filas.length === 1
          ? filas[0]
          : filaSuma([`Subtotal ${a}`, ""], filas, sumarNeto(delGrupo), sumarTotal(delGrupo)))
      }
      filasResponsable.push(filaSuma([`Total ${r}`, ""], filasDelResponsable, sumarNeto(dela), sumarTotal(dela)))
    }
    filasTotalTipo.push(filaSuma([`TOTAL ${NOMBRE_TIPO[tp].split(" — ")[0]}`, ""], filasResponsable,
      sumarNeto(delTipo), sumarTotal(delTipo)))
    f.push(["."])
  }

  const nTot = filaSuma(["TOTAL DEL EJERCICIO (todos los tipos)", ""], filasTotalTipo,
    sumarNeto(t.porMes), t.totalDebitos - t.totalCreditos)

  /**
   * 🧮 El control: el saldo total tiene que ser **débitos − créditos** de la solapa del detalle. Es el
   * camino inverso — si el saldado perdió una cuota por el camino, esto no da.
   */
  f.push([])
  f.push(["CONTROL", "Total debitos (solapa de detalle: Impuestos u Otros)", money(t.totalDebitos)])
  f.push(["", "Total creditos", money(t.totalCreditos)])
  f.push(["", "= Saldo", money(t.totalDebitos - t.totalCreditos)])
  const nC = f.length + 1
  f.push(["", "Suma de esta solapa", conFormula(`${colTotal}${nTot}`, money(t.totalDebitos - t.totalCreditos))])
  f.push(["", "Diferencia (tiene que dar 0)",
    conFormula(`C${nC - 1}-C${nC}`, 0)])
  // 🧮 Y por tipo: la suma de los grupos tiene que dar el total (ninguna cuota afuera ni dos veces).
  const sumaTipos = Math.round((t.porTipo ?? []).reduce((x, g) => x + g.totalNeto, 0) * 100) / 100
  const difTipos = Math.round((t.totalDebitos - t.totalCreditos - sumaTipos) * 100) / 100
  f.push(["", "Suma de los tipos", money(sumaTipos)])
  f.push(["", "Diferencia por tipo (tiene que dar 0)", money(difTipos), difTipos === 0 ? "cuadra" : "NO CUADRA"])

  // 💳 A-FEAT-1388 — *«¿muestran lo pagado o lo pendiente también?»*: las dos cosas, por tipo.
  f.push([])
  f.push(["PAGADO Y PENDIENTE", "Tipo", "Saldo del ejercicio", "Pagado", "Pendiente al cierre"])
  for (const g of t.porTipo ?? []) {
    f.push(["", NOMBRE_TIPO[g.tipo].split(" — ")[0], money(g.totalNeto), money(g.totalNeto - g.totalPendiente), money(g.totalPendiente)])
  }

  if (t.sinCategoria.length > 0 || t.sinFecha.length > 0) {
    f.push([])
    f.push(["LO QUE NO SE PUDO UBICAR"])
    if (t.sinCategoria.length > 0) {
      f.push(["", `${t.sinCategoria.length} cuota(s) SIN CATEGORÍA contable: no se pueden ubicar en el balance.`])
    }
    if (t.sinFecha.length > 0) {
      f.push(["", `${t.sinFecha.length} cuota(s) SIN FECHA (ni de pago ni estimada): no se pueden asignar a un período.`])
    }
  }
  return f
}

/**
 * `02 - HACIENDA` — existencia al cierre y su valuación, con el criterio de cada categoría a la
 * vista y **los huecos listados**, no escondidos en un total.
 */
function hojaDeHacienda(
  h: ValuacionHacienda, fechaCierre: string, mesPrecios: string, cuadre?: CuadreHacienda,
  saldos?: SaldosParaExcel["hacienda"], fechaInicio?: string, fuentes?: FuentePrecio[],
): unknown[][] {
  const f: unknown[][] = []
  f.push([`02 - HACIENDA — existencia al ${fechaCierre}`])
  // 📅 A-FEAT-1422 (16): ya no es el promedio del mes; es el último publicado al cierre, fuente por fuente.
  f.push([`Precios de referencia: ${mesPrecios}`])
  // 🔗 (14): el link de cada fuente, para que el contador la revise.
  for (const x of fuentes ?? []) f.push([conLink(`${x.nombre} — ${x.fecha ? x.fecha.split("-").reverse().join("/") : "sin dato al cierre"}`, x.url), x.url])
  f.push([])

  /**
   * 🧮 **El cuadre va ARRIBA de la valuación**, no al final.
   *
   * Pedido del usuario 2026-09-29: *«hacienda precisa el cheq de consistencia de inicio más menos mov
   * = stock final»*. Y va primero porque **si la existencia no cuadra, valuarla no tiene sentido**:
   * se estaría poniendo precio a un rodeo equivocado.
   */
  if (cuadre) {
    // ⚠️ cambió 29/10 (A-FEAT-1422 nota 12: «no se ve el texto»): los rótulos van en la columna A (la ancha), no en la B.
    f.push(["CUADRE DE LA EXISTENCIA — de donde salen las cabezas que se valuan"])
    f.push([])
    f.push(["Existencia al INICIO del ejercicio", cuadre.existenciaInicio, "cabezas"])
    cuadre.porTipo.forEach(t => f.push([`  ${t.tipo}`, t.cabezas, `cabezas · ${t.movimientos} movimiento(s)`]))
    const nMov = f.length + 1
    const desdeMov = nMov - cuadre.porTipo.length
    f.push(["Movimientos del ejercicio",
      cuadre.porTipo.length > 0
        ? conFormula(`SUM(B${desdeMov}:B${nMov - 1})`, cuadre.movimientosDelEjercicio, ENTERO)
        : 0,
      "cabezas"])
    const nCalc = f.length + 1
    f.push(["= Existencia al CIERRE (calculada)",
      conFormula(`B${nCalc - cuadre.porTipo.length - 2}+B${nCalc - 1}`, cuadre.existenciaCierreCalculada, ENTERO),
      "cabezas"])
    f.push(["Existencia que se valua abajo", cuadre.existenciaCierreDeclarada, "cabezas"])
    const nDif = f.length + 1
    f.push(["Diferencia", conFormula(`B${nDif - 2}-B${nDif - 1}`, cuadre.diferencia, ENTERO),
      cuadre.diferencia === 0 ? "CIERRA" : "NO CIERRA"])
    if (cuadre.avisos.length > 0) {
      f.push([])
      f.push(["ATENCION"])
      cuadre.avisos.forEach(a => f.push([a]))
    }
    f.push([])
    f.push([])
  }
  // 🐄 A-FEAT-1386: los saldos Sistema · SENASA · Campo · Balance, al inicio y al cierre (JMS 29/10).
  if (saldos) agregarSaldosHacienda(f, saldos, fechaInicio ?? "", fechaCierre)

  f.push(["Categoría", "Cabezas", "Criterio de valuación", "Precio de referencia", "Origen del precio",
    "Factor", "Kg/cab", "$ por cabeza", "Valor total", "De dónde salen los kilos"])

  /**
   * 🧮 **Fórmulas, no resultados** — pedido textual del usuario en este mismo papel:
   * *«si son fórmulas deben quedar las fórmulas en el excel y no los datos»*.
   *
   * `$ por cabeza` = precio × factor × kg (o precio × factor cuando ya viene por cabeza)
   * `Valor total`  = cabezas × $ por cabeza
   *
   * 🔑 Así él cambia un precio en la columna D y **el papel se recalcula solo**. Con el número
   * pegado tendría que rehacer la cuenta a mano, y el Excel dejaría de ser una herramienta para
   * pasar a ser una foto.
   *
   * ⚠️ Las filas **sin precio siguen diciendo «FALTA EL PRECIO» en texto**: una fórmula sobre una
   * celda vacía daría **0**, y un cero se lee como *«vale cero»*, que es justo lo contrario de lo
   * que pasa.
   */
  for (const x of h.filas) {
    const fila = f.length + 1  // 1-based, la fila donde va a caer ésta
    f.push([
      x.categoria, x.cabezas, x.criterio,
      x.precioReferencia ?? "", x.origenPrecio,
      x.factor, x.pesoKg ?? "",
      x.valorPorCabeza == null
        ? "FALTA EL PRECIO"
        : conFormula(
            x.pesoKg ? `D${fila}*F${fila}*G${fila}` : `D${fila}*F${fila}`,
            x.valorPorCabeza,
          ),
      x.valorTotal == null
        ? "FALTA EL PRECIO"
        : conFormula(`B${fila}*H${fila}`, x.valorTotal),
      // El origen del peso va al lado: un kilo estimado y uno medido no valen lo mismo, y el
      // papel tiene que poder decir cuál es cuál sin preguntarle a nadie.
      x.origenPeso,
    ])
  }
  f.push([])
  f.push(["TOTAL", h.cabezas, "", "", "", "", "", "", money(h.valuado)])
  f.push([])
  if (h.huecos.length > 0) {
    f.push(["🕳️ LO QUE FALTA VALUAR — el total de arriba NO lo incluye"])
    f.push(["", `${h.huecos.length} categoría(s) y ${h.cabezasSinValuar} cabezas sin precio.`])
    f.push(["", "No se valúan en cero a propósito: un supuesto silencioso daría un total completo y mal."])
    h.huecos.forEach(x => f.push(["", x.categoria, x.cabezas, x.criterio]))
    f.push([])
  }
  if (h.sinCriterio.length > 0) {
    f.push(["⚠️ CATEGORÍAS CON EXISTENCIA Y SIN CRITERIO DEFINIDO"])
    h.sinCriterio.forEach(c => f.push(["", c]))
  }
  return f
}

/** Los precios que se usaron, para que la valuación se pueda auditar y no haya que creerle. */
function hojaDePrecios(
  mag: PrecioMag[],
  mercado: { macho: PrecioMercado[]; hembra: PrecioMercado[] },
  porCabeza: { vientres: PrecioCabeza[]; toros: PrecioCabeza[] },
  mesPrecios: string,
): unknown[][] {
  const f: unknown[][] = []
  f.push([`PRECIOS DE REFERENCIA — ${mesPrecios}`])
  f.push(["Se toma el mes entero, no un día, para que sea representativo."])
  f.push([])
  f.push(["MERCADO AGROGANADERO DE CAÑUELAS — categorías comerciales"])
  f.push(["Familia", "Calidad", "Corte", "Mínimo", "Máximo", "Promedio", "Mediana"])
  mag.forEach(m => f.push([m.familia, m.calidad, m.corte ?? "", m.minimo, m.maximo, m.promedio, m.mediana]))
  f.push([])
  f.push(["ENTRESURCOS Y CORRALES — POR CABEZA (vientres y toros)"])
  f.push(["Un vientre o un toro NO se valúan por kilo: valen lo que valen."])
  f.push(["Categoría", "Cabezas operadas", "Promedio", "Máximo", "Mínimo"])
  for (const [tipo, filas] of Object.entries(porCabeza)) {
    filas.forEach(m => f.push([`${tipo} · ${m.categoria}`, m.cantidad, m.promedio, m.maximo, m.minimo]))
  }
  f.push([])
  f.push(["ENTRESURCOS Y CORRALES — por rango de kilos"])
  f.push(["Categoría", "Desde kg", "Hasta kg", "Prom. $/kg", "Máx. $/kg", "Mín. $/kg"])
  for (const [sexo, filas] of Object.entries(mercado)) {
    filas.forEach(m => f.push([`${sexo} · ${m.categoria}`, m.pesoLo, m.pesoHi ?? "sin tope", m.promKilo, m.kiloMax, m.kiloMin]))
  }
  return f
}

/** Los stocks de insumos, un bloque por papel, con los huecos contados. */
function hojaDeInsumos(st: StockInsumos, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`STOCK DE INSUMOS al ${fechaCierre}`])
  // 📅 A-FEAT-1427: de dónde sale la existencia, y su control (hoy = suma de movimientos).
  if (st.alCierre) {
    f.push([`Existencia al ${st.alCierre.fecha}: suma de compras, usos y ajustes hasta esa fecha` +
      (st.alCierre.posteriores > 0 ? ` (se descontaron ${st.alCierre.posteriores} movimiento(s) posteriores).` : ".")])
    if (st.alCierre.descuadres.length === 0) f.push(["CONTROL ✓ cada producto: existencia de hoy = suma de sus movimientos"])
    else {
      f.push(conEstilo([`⚠️ CONTROL: ${st.alCierre.descuadres.length} producto(s) con existencia de hoy distinta de la suma de sus movimientos — al cierre se toma la de los movimientos`], ESTILO_ERROR))
      f.push(["", "Producto", "Hoy", "Suma de movimientos", "Unidad"])
      st.alCierre.descuadres.forEach(d => f.push(["", d.producto, d.hoy, d.sumaMovimientos, d.unidad]))
    }
  } else {
    f.push(conEstilo(["⚠️ La existencia es la de HOY, no la del cierre: no se pudieron leer los movimientos."], ESTILO_ERROR))
  }
  f.push([])
  for (const g of st.grupos) {
    f.push([g.papel])
    f.push(["Categoría", "Producto", "Cantidad", "Unidad", "Precio unitario", "Valor total", "Observaciones"])
    for (const x of g.filas) {
      f.push([
        x.categoria, x.producto, x.cantidad, x.unidad,
        x.costoUnitario ?? "FALTA EL PRECIO",
        x.valorTotal ?? "FALTA EL PRECIO",
        x.observaciones,
      ])
    }
    f.push(["", `Subtotal ${g.papel}`, "", "", "", money(g.valuado),
      g.huecos > 0 ? `⚠️ ${g.huecos} producto(s) sin precio, NO incluidos` : ""])
    f.push([])
  }
  f.push(["TOTAL VALUADO", money(st.valuado)])
  f.push(["Productos con existencia", st.productos])
  f.push(["Productos SIN PRECIO", st.huecos.length])
  f.push([])
  if (st.huecos.length > 0) {
    f.push(["🕳️ LO QUE FALTA VALUAR — el total de arriba NO lo incluye"])
    f.push(["Categoría", "Producto", "Cantidad", "Unidad"])
    st.huecos.forEach(x => f.push([x.categoria, x.producto, x.cantidad, x.unidad]))
    f.push([])
  }
  f.push(["🕳️ LO QUE TODAVÍA LE FALTA A CADA PAPEL"])
  PAPELES_SIN_ORIGEN.forEach(p => f.push(["", p.papel, p.falta]))
  return f
}

/** `1 - GRANOS`: el cuadre de kilos y la valuación, con la diferencia a la vista. */
function hojaDeGranos(c: CuadreGranos, v: ValuacionGranos, fechaCierre: string, origen?: { texto: string; url: string | null } | null): unknown[][] {
  const f: unknown[][] = []
  f.push([`1 - GRANOS al ${fechaCierre}`])
  f.push([])
  f.push(["CUADRE DE KILOS (toneladas)"])
  f.push(["Stock al inicio del ejercicio", c.stockInicioTn ?? "FALTA", c.notaInicio ?? ""])
  f.push(["+ Cosecha del ejercicio", c.cosechaTn ?? "FALTA"])
  f.push(["− Ventas del ejercicio", c.ventasTn, "← esto lo sabe la app, de los comprobantes de venta"])
  f.push(["= Saldo", c.saldoTn ?? "no se puede calcular"])
  f.push(["− Existencia declarada al cierre", c.stockEmpresaTn ?? "FALTA"])
  f.push(["= DIFERENCIA", c.diferenciaTn ?? "no se puede calcular",
    c.diferenciaTn == null ? "" : c.cierra ? "cierra dentro de la tolerancia" : "NO CIERRA — hay que explicarla"])
  f.push([])
  if (c.faltan.length > 0) {
    f.push(["Para poder cuadrar falta cargar:"])
    c.faltan.forEach(x => f.push(["", x]))
    f.push([])
  }
  f.push(["VALUACIÓN"])
  f.push(["Toneladas", v.toneladas])
  f.push(["Precio por tonelada", v.precioPorTn ?? "FALTA EL PRECIO"])
  // 📅 A-FEAT-1422 (16): de dónde sale el precio (la pizarra de Rosario al cierre, o el escrito a mano), con su link.
  if (origen) f.push(["Origen del precio", origen.url ? conLink(origen.texto, origen.url) : origen.texto, origen.url ?? ""])
  f.push(["Monto bruto", v.montoBruto ?? ""])
  f.push(["% calidad", v.pctCalidad])
  f.push(["Monto neto", v.montoNeto ?? ""])
  f.push(["% CZ (comisión + flete + otros)", v.pctCz])
  f.push(["NETO FINAL", v.netoFinal ?? "FALTA EL PRECIO"])
  return f
}

/** `3 - SEMENTERAS`: lo sembrado y no cosechado, con lo que no entró y por qué. */
function hojaDeSementeras(s: Sementeras, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`3 - SEMENTERAS al ${fechaCierre}`])
  f.push(["Sólo cuenta las órdenes EJECUTADAS hasta el cierre: una planificada todavía no costó nada."])
  f.push([])
  f.push([`${s.ordenesEjecutadas} orden(es) ejecutada(s) · ${s.hectareas} ha`])
  f.push([])
  f.push(["Fecha", "Lote", "Ha", "Insumo", "Cantidad", "Unidad", "Precio unitario", "Costo"])
  s.lineas.forEach(l => f.push([
    l.fecha ?? "", l.lote, l.hectareas, l.insumo, l.cantidad ?? "", l.unidad,
    l.precioUnitario ?? "FALTA EL PRECIO", l.costo ?? "FALTA EL PRECIO",
  ]))
  f.push([])
  f.push(["COSTO", money(s.costo)])
  f.push([])
  f.push(["⚠️ EL COSTO ESTÁ INCOMPLETO — falta:"])
  s.faltan.forEach(x => f.push(["", x]))
  f.push([])
  if (s.ordenesNoContadas.length > 0) {
    f.push(["ÓRDENES QUE NO SE CONTARON, Y POR QUÉ"])
    f.push(["Fecha", "Lote", "Estado", "Motivo"])
    s.ordenesNoContadas.forEach(o => f.push([o.fecha ?? "", o.lote, o.estado, o.motivo]))
  }
  return f
}

/** Arma el workbook. Separado de la descarga para poder probarlo sin navegador. */
/**
 * 🔢 **Control cuotas templates** — ¿cada template tiene las cuotas esperadas en la campaña? Mismo
 * resultado que la pantalla (`lib/balance/control-cuotas-templates.ts`): preview importante primero,
 * lo que falta o sobra en rojo. Es un aviso: no cambia ningún número del libro.
 */
export function hojaControlCuotas(c: ControlCuotasTemplates): unknown[][] {
  const f: unknown[][] = []
  const mal = c.filas.filter(conProblema)
  f.push([`CONTROL DE CUOTAS DE TEMPLATES — ${c.empresa}, ${c.campania}`])
  f.push(["¿Cada template controlado tiene las cuotas que tiene que tener? Lista y cantidades: decisión de JMS del 28/10/2026."])
  f.push(["Anual o en cuotas: vale cualquiera de las dos, no las dos el mismo año. IIBB: un pago el mes siguiente a cada subdiario con ventas. SICORE: un pago por presentación."])
  f.push(["Un template compartido («PAM/MA/Duhau») se controla en la primera empresa nombrada. ★ = preview importante. Es un AVISO: no frena el libro."])
  f.push([mal.length === 0
    ? `Resultado: están todas (${c.filas.length} templates controlados).`
    : `Resultado: ${mal.length} de ${c.filas.length} no tienen las cuotas esperadas — ${resumenControlCuotas(c.filas).map(r => `${r.cantidad} ${r.estado}`).join(" · ")}`])
  f.push([])
  f.push(["Preview", "Estado", "Agrupadora", "Template", "Regla", "Esperado", "Encontrado", "Detalle", "Nota"])
  for (const x of c.filas) {
    const fila = [x.preview ? "★" : "", x.estado, x.agrupadora, x.nombre, x.regla,
      x.esperado ?? "", x.encontrado, x.detalle, x.nota ?? ""]
    f.push(x.estado === "falta" || x.estado === "mixto" ? conEstilo(fila, ESTILO_ERROR) : fila)
  }
  return f
}
const COLS_CONTROL_CUOTAS: Columna[] = [
  { ancho: 8 }, { ancho: 13 }, { ancho: 26 }, { ancho: 36 }, { ancho: 40 },
  { ancho: 10, z: ENTERO }, { ancho: 11, z: ENTERO }, { ancho: 80 }, { ancho: 50 },
]

export function armarWorkbook(
  libro: LibroDiario,
  /** Para el encabezado del índice. */
  empresa: string,
  templates?: TemplatesDelEjercicio,
  hacienda?: {
    valuacion: ValuacionHacienda; mag: PrecioMag[]
    mercado: { macho: PrecioMercado[]; hembra: PrecioMercado[] }
    porCabeza: { vientres: PrecioCabeza[]; toros: PrecioCabeza[] }
    mesPrecios: string
    /** El cuadre de la existencia. Va arriba de la valuación — ver `hojaDeHacienda`. */
    cuadre?: CuadreHacienda
    /** 🐄🌾 A-FEAT-1386: las tablas de saldos Sistema · SENASA · Campo · Balance. */
    saldos?: SaldosParaExcel
    /** 📦 A-FEAT-1420: el stock declarado al inicio por producto y las pasturas. */
    stockInicio?: { renglones: RenglonStockInicio[]; pasturas: Pastura[]; fecha: string }
    /** 📅 A-FEAT-1422: de dónde salió cada precio (fecha y link para el contador). */
    fuentesPrecios?: FuentePrecio[]
  },
  insumos?: StockInsumos,
  campo?: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras; origenPrecioGranos?: { texto: string; url: string | null } | null },
  /**
   * Papeles 03 y 04. `pagar`/`cobrar` van sólo si la pantalla pudo averiguar **cuándo** se pagó cada
   * comprobante; `cheques` y `anticipos` son los bloques 04.1, 04.2 y 03.1 (A-FEAT-1195).
   */
  cuentas?: {
    pagar?: CuentasAlCierre; cobrar?: CuentasAlCierre
    cheques?: ChequesDados; anticipos?: AnticiposAlCierre
  },
  /** Papeles 07, 08 y 09. Salen del extracto ya parseado y categorizado. */
  bancarios?: DatosDelIndice["bancarios"] & {
    fci?: { fondos: FondoComun[]; total: FondoComun }
    /** 🧾 El impuesto al cheque, total y desglosado (A-FEAT-1190). */
    impuestoCheque?: ImpuestoCheque
  },
  /** 👷 El papel de sueldos: el total de A y el total de B (A-FEAT-1216). */
  sueldos?: SueldosDelEjercicio,
  /** 🧾 Las cuentas corrientes con su saldo al cierre (A-FEAT-1218). */
  cuentasCorrientes?: PapelDeCuentasCorrientes,
  /** 📌 Los pendientes a revisar que anotó el usuario en la pantalla (A-FEAT-1258). */
  pendientes?: PendienteBalance[],
  /** ✍️ Los saldos del ejercicio anterior: gasto de este ejercicio (A-FEAT-1207). */
  saldosAnteriores?: SaldosAnteriores,
  /** 📒 Las facturas de «Asientos Contables» del ejercicio (A-FEAT-1318). */
  asientosContables?: AsientoLibroDiario[],
  /** 🧮 A-FEAT-1343: cuántas filas dijo la base y cuántas llegaron. */
  lecturas?: Lectura[],
  /** 🔢 ¿Cada template tiene sus cuotas en la campaña? (JMS 28/10/2026). */
  controlCuotas?: ControlCuotasTemplates,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  /**
   * 🗂️ **El ÍNDICE va PRIMERO**, antes del Control: es lo que contesta *«¿qué hay y qué falta?»*,
   * que es la pregunta con la que se abre el archivo. El Control viene atrás porque contesta la
   * siguiente — *«¿los números cierran?»*.
   */
  const indice = armarIndice({
    libro, templates, cuentas, sueldos, cuentasCorrientes,
    hacienda: hacienda?.valuacion ?? null,
    insumos: insumos ?? null,
    campo: campo ? { granos: campo.granos, sementeras: campo.sementeras } : null,
    bancarios: bancarios ?? null,
    lecturas,
  })
  hoja(wb, "00 Indice", hojaDeIndice(indice, libro, empresa), COLS_INDICE)
  // 📌 A-FEAT-1258 — los pendientes a revisar van pegados al índice: también contestan «¿qué falta?».
  if (pendientes && pendientes.length) {
    hoja(wb, "00 Pendientes a revisar", hojaDePendientes(pendientes,
      `${empresa} — pendientes a revisar del ejercicio ${libro.ejercicio.etiqueta}`), COLS_PENDIENTES)
  }
  hoja(wb, "Control", hojaDeControl(libro, lecturas))
  // 📅 Los 12 meses en una línea cada uno, pegado al Control: es otro control (contra lo presentado a ARCA).
  hoja(wb, "Resumen 12 meses", hojaResumenMensual(libro), COLS_RESUMEN_MENSUAL)
  // 🛑 A-FEAT-1388: los comprobantes cuyas partes no suman su total, en rojo y con la marca (los mismos del Control).
  hoja(wb, "Compras", conTotalAlPie(hojaDeAsientos(libro.compras, libro.controles.compras.descuadres)), COLS_ASIENTOS)
  hoja(wb, "Ventas", conTotalAlPie(hojaDeAsientos(libro.ventas, libro.controles.ventas.descuadres)), COLS_VENTAS)
  // 📗 La apertura por cuenta contable — el formato que el usuario ya usaba (A-FEAT-1187).
  //    Van pegadas a su listado: primero el detalle, después el resumen que se le manda al contador.
  hoja(wb, "Compras por cuenta", hojaPorCuenta(armarLibroPorCuenta(libro.compras),
    `LIBRO DIARIO MENSUAL (Compras) — ejercicio ${libro.ejercicio.etiqueta}`,
    { asientos: libro.compras, descuadres: libro.controles.compras.descuadres }), COLS_POR_CUENTA)
  hoja(wb, "Ventas por cuenta", hojaPorCuenta(armarLibroPorCuenta(libro.ventas, TIPOS_SIN_CREDITO_VENTAS),
    `LIBRO DIARIO MENSUAL (Ventas) — ejercicio ${libro.ejercicio.etiqueta}`,
    { asientos: libro.ventas, descuadres: libro.controles.ventas.descuadres }, true), COLS_POR_CUENTA_VENTAS)
  /**
   * 🧾 **El papel 05 es la provisión de FACTURAS (compras); la de COBROS (ventas) es del papel 03.**
   *
   * Hasta el 2026-09-30 las dos iban juntas en `05 Provision`, porque `armarLibroDiario` las devuelve
   * en una sola lista. **Son dos papeles distintos de su balance** —`05 - PROVISION FC` y el bloque
   * `PROVISION COBROS` del 03—, y sumar una venta a provisionar dentro de la provisión de compras
   * infla el gasto del ejercicio con un ingreso.
   */
  const provisionCompras = libro.provisiones.filter(a => a.fuente !== "venta")
  const provisionVentas = libro.provisiones.filter(a => a.fuente === "venta")
  hoja(wb, "05 Provision", hojaDeProvision(provisionCompras, libro.provisionesEjercicioAnterior,
    libro.ejercicio.etiqueta, armarEjercicio(libro.ejercicio.anioCierre - 1, libro.ejercicio.mesCierre).etiqueta),
    [...COLS_ASIENTOS, { ancho: 30 }, { ancho: 50 }])
  // 💳 Cuentas a pagar y a cobrar al cierre — papeles 03 y 04 (A-FEAT-1187), con sus bloques de
  //    cheques, anticipos y provisión de cobros (A-FEAT-1195).
  if (cuentas?.pagar) {
    hoja(wb, "04 Cuentas a pagar",
      hojaDeCuentas(cuentas.pagar, `CUENTAS A PAGAR — ejercicio ${libro.ejercicio.etiqueta}`,
        libro.ejercicio.fechaCierre,
        templates ? { cuotas: templates.impagasAlCierre, total: templates.totalImpagas } : undefined),
      COLS_CUENTAS)
  }
  if (cuentas?.cheques) {
    hoja(wb, "04.1 Cheques dados",
      hojaDeChequesDados(cuentas.cheques, libro.ejercicio.etiqueta, libro.ejercicio.fechaCierre),
      COLS_CHEQUES)
  }
  if (cuentas?.anticipos) {
    hoja(wb, "04.2 Anticipos",
      hojaDeAnticipos(cuentas.anticipos, libro.ejercicio.etiqueta, libro.ejercicio.fechaCierre),
      COLS_ANTICIPOS)
  }
  if (cuentas?.cobrar) {
    hoja(wb, "03 Cuentas a cobrar",
      hojaDeCuentas(cuentas.cobrar, `CUENTAS A COBRAR — ejercicio ${libro.ejercicio.etiqueta}`,
        libro.ejercicio.fechaCierre), COLS_CUENTAS)
  }
  // ⚠️ Va SIEMPRE, incluso sin una sola fila: es donde se dice que los cheques en cartera no salen
  //    del sistema. Si la solapa faltara, el contador leería «no había» (§ 🧮).
  hoja(wb, "03.1 Provision cobros",
    hojaDeProvisionCobros(provisionVentas, libro.ejercicio.etiqueta), COLS_ASIENTOS)
  // ⚠️ Se incluye SIEMPRE, aunque esté vacía: una solapa vacía dice «no hay», y que falte dice
  // «no se miró». No es lo mismo (§ 🧮: nada se descarta en silencio).
  hoja(wb, "Sin subdiario", hojaDeAsientos(libro.sinSubdiario), COLS_ASIENTOS)
  // 📒 A-FEAT-1318 — también SIEMPRE cuando la pantalla la pudo leer: vacía dice «no hay».
  if (asientosContables) {
    hoja(wb, "Asientos Contables", hojaDeAsientosContables(asientosContables, libro.ejercicio.etiqueta), COLS_ASIENTOS)
  }
  // 👷 Los sueldos van pegados a los templates: son las dos partes que NO salen de comprobantes.
  if (sueldos) {
    hoja(wb, "13 Sueldos", hojaDeSueldos(sueldos, libro.ejercicio.etiqueta), COLS_SUELDOS)
  }
  // 🧾 Las cuentas corrientes, pegadas a los sueldos: las dos son saldos con personas.
  if (cuentasCorrientes) {
    hoja(wb, "14 Cuentas corrientes",
      hojaDeCuentasCorrientes(cuentasCorrientes, libro.ejercicio.fechaCierre),
      COLS_CUENTAS_CORRIENTES)
  }
  if (templates) {
    // 🧾 JMS 29/10 (A-FEAT-1422 nota 10): en dos solapas, «Impuestos» y «Otros», cada una con su «por mes».
    const partes = partirEnImpuestosYOtros(templates)
    if (partes) {
      for (const [nombre, t] of [["Impuestos", partes.impuestos], ["Otros", partes.otros]] as const) {
        hoja(wb, nombre, hojaDeTemplates(t), COLS_TEMPLATES)
        hoja(wb, `${nombre} por mes`, hojaTemplatesPorMes(t), COLS_TEMPLATES_POR_MES(t.columnas.length))
      }
    } else {
      hoja(wb, "Templates", hojaDeTemplates(templates), COLS_TEMPLATES)
      hoja(wb, "Templates por mes", hojaTemplatesPorMes(templates),
        COLS_TEMPLATES_POR_MES(templates.columnas.length))
    }
  }
  // 🔢 Pegado a los templates: es su control de cantidad (el de las facturas fijas va en «Control»).
  if (controlCuotas) hoja(wb, "Control cuotas templates", hojaControlCuotas(controlCuotas), COLS_CONTROL_CUOTAS)
  // ✍️ A-FEAT-1207 — va pegada a los templates: es gasto del ejercicio que no viene de una cuota.
  if (saldosAnteriores && (saldosAnteriores.vigentes.length > 0 || saldosAnteriores.anulados.length > 0)) {
    const filas = hojaDeSaldosAnteriores(saldosAnteriores, libro.ejercicio.etiqueta)
    if (templates) {
      /**
       * ⚠️ cambió 2026-10-27 (A-FEAT-1388): sumaba TODOS los tipos — FCI, plazo fijo, retiros — y lo
       * llamaba gasto. El gasto son sólo los EGRESOS.
       */
      const gastoTemplates = (templates.porTipo ?? []).find(g => g.tipo === "egreso")?.totalNeto ?? 0
      filas.push([])
      filas.push(["GASTO DE TEMPLATES DEL EJERCICIO", "cuotas de EGRESOS (solapa Templates, neto)", money(gastoTemplates)])
      filas.push(["", "+ saldos del ejercicio anterior", saldosAnteriores.total])
      filas.push(["", "= total", money(gastoTemplates + saldosAnteriores.total)])
    }
    hoja(wb, "Saldos ej. anterior", filas)
  }
  if (hacienda) {
    hoja(wb, "02 Hacienda",
      hojaDeHacienda(hacienda.valuacion, libro.ejercicio.fechaCierre, hacienda.mesPrecios, hacienda.cuadre,
        hacienda.saldos?.hacienda, hacienda.saldos?.productivos?.fechaInicio, hacienda.fuentesPrecios),
      COLS_HACIENDA)
    hoja(wb, "Precios", hojaDePrecios(hacienda.mag, hacienda.mercado, hacienda.porCabeza, hacienda.mesPrecios), COLS_PRECIOS)
  }
  if (insumos) {
    const filasIns = hojaDeInsumos(insumos, libro.ejercicio.fechaCierre)
    // 🌾 A-FEAT-1386: Sistema · Campo · Balance de insumos, gas oil y sementeras (JMS 29/10), al pie del stock.
    if (hacienda?.saldos?.productivos) { filasIns.push([]); agregarSaldosProductivos(filasIns, hacienda.saldos.productivos) }
    hoja(wb, "Stock insumos", filasIns, COLS_INSUMOS)
  }
  // 📦 A-FEAT-1420: el stock DECLARADO al inicio, producto por producto, y las pasturas.
  if (hacienda?.stockInicio && (hacienda.stockInicio.renglones.length || hacienda.stockInicio.pasturas.length)) {
    hoja(wb, "Stock al inicio", hojaStockInicio(hacienda.stockInicio.renglones, hacienda.stockInicio.pasturas, hacienda.stockInicio.fecha))
  }
  // 🏦 Los papeles bancarios (07, 08, 09). Van al final: son anexos del resultado, no el resultado.
  if (bancarios) {
    if (bancarios.fci) {
      hoja(wb, "07 Bancos",
        hojaDeBancos(bancarios.saldos, bancarios.fci, libro.ejercicio.fechaCierre,
          bancarios.cadenas ?? []), COLS_BANCOS)
      // 🧮 El control del papel 07, en su propia solapa: ver `hojaDeCadenaDeSaldos`.
      if ((bancarios.cadenas ?? []).length > 0) {
        hoja(wb, "07.1 Cadena de saldos",
          hojaDeCadenaDeSaldos(bancarios.cadenas ?? [], libro.ejercicio.fechaCierre), COLS_CADENA)
      }
    }
    hoja(wb, "08 Gastos bancarios",
      hojaDeGastosBancarios(bancarios.gastos, libro.ejercicio.etiqueta))
    if (bancarios.impuestoCheque) {
      hoja(wb, "08.1 Impuesto al cheque",
        hojaDeImpuestoCheque(bancarios.impuestoCheque, libro.ejercicio.etiqueta,
          controlarCheque(bancarios.impuestoCheque.total.total, chequeEnPapel08(bancarios.gastos),
            chequeEnTemplates(templates, empresa), empresa)))
    }
    hoja(wb, "09 Retiros y aportes",
      hojaDeRetiros(bancarios.retiros, libro.ejercicio.etiqueta))
  }
  if (campo) {
    hoja(wb, "1 Granos", hojaDeGranos(campo.granos, campo.valuacionGranos, libro.ejercicio.fechaCierre, campo.origenPrecioGranos), COLS_GRANOS)
    hoja(wb, "3 Sementeras", hojaDeSementeras(campo.sementeras, libro.ejercicio.fechaCierre), COLS_SEMENTERAS)
  }
  return wb
}

export function nombreArchivo(libro: LibroDiario, empresa: string): string {
  const hoy = new Date().toISOString().slice(0, 10)
  const estado = libro.controles.sePuedeEntregar ? "" : "_REVISAR"
  return `Papeles_balance_${empresa}_${libro.ejercicio.etiqueta.replace("/", "-")}_${hoy}${estado}.xlsx`
}

/** Descarga el archivo en el navegador. */
export async function descargarLibroDiario(
  libro: LibroDiario, empresa: string,
  templates?: TemplatesDelEjercicio,
  hacienda?: {
    valuacion: ValuacionHacienda; mag: PrecioMag[]
    mercado: { macho: PrecioMercado[]; hembra: PrecioMercado[] }
    porCabeza: { vientres: PrecioCabeza[]; toros: PrecioCabeza[] }
    mesPrecios: string
    /** El cuadre de la existencia. Va arriba de la valuación — ver `hojaDeHacienda`. */
    cuadre?: CuadreHacienda
    /** 🐄🌾 A-FEAT-1386: las tablas de saldos Sistema · SENASA · Campo · Balance. */
    saldos?: SaldosParaExcel
    /** 📦 A-FEAT-1420: el stock declarado al inicio por producto y las pasturas. */
    stockInicio?: { renglones: RenglonStockInicio[]; pasturas: Pastura[]; fecha: string }
    /** 📅 A-FEAT-1422: de dónde salió cada precio (fecha y link para el contador). */
    fuentesPrecios?: FuentePrecio[]
  },
  insumos?: StockInsumos,
  campo?: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras; origenPrecioGranos?: { texto: string; url: string | null } | null },
  cuentas?: Parameters<typeof armarWorkbook>[6],
  bancarios?: Parameters<typeof armarWorkbook>[7],
  sueldos?: Parameters<typeof armarWorkbook>[8],
  cuentasCorrientes?: Parameters<typeof armarWorkbook>[9],
  pendientes?: PendienteBalance[],
  saldosAnteriores?: SaldosAnteriores,
  asientosContables?: AsientoLibroDiario[],
  lecturas?: Lectura[],
  controlCuotas?: ControlCuotasTemplates,
) {
  const wb = armarWorkbook(libro, empresa, templates, hacienda, insumos, campo, cuentas,
    bancarios, sueldos, cuentasCorrientes, pendientes, saldosAnteriores, asientosContables, lecturas, controlCuotas)
  const out = await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wb))
  const url = URL.createObjectURL(
    new Blob([out as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  )
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivo(libro, empresa)
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, ESPERA_ANTES_DE_LIBERAR_MS)
}
