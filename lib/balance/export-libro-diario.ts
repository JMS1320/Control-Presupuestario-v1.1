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
import * as XLSX from "xlsx"
import type { LibroDiario, AsientoLibroDiario } from "./libro-diario"
import { nombreSubdiario } from "./ejercicio"
import type { TemplatesDelEjercicio } from "./templates-libro"
import type { ValuacionHacienda, PrecioMag, PrecioMercado } from "./hacienda-stock"
import { PAPELES_SIN_ORIGEN, type StockInsumos } from "./stock-insumos"
import type { CuadreGranos, ValuacionGranos, Sementeras } from "./granos-sementeras"

const money = (n: number) => Math.round(n * 100) / 100

/** Cabecera + filas de un listado de asientos. Misma forma para compras, ventas y provisiones. */
function hojaDeAsientos(asientos: AsientoLibroDiario[]): unknown[][] {
  const filas: unknown[][] = [[
    "Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Denominación",
    "Neto Gravado", "No Gravado", "Exentas", "Otros Tributos", "IVA", "Total",
    "Cuenta contable", "Nro cuenta", "Centro de costo", "Origen del dato",
  ]]
  for (const a of asientos) {
    filas.push([
      a.subdiario, a.fecha ?? "", a.tipo ?? "", a.punto_venta ?? "", a.numero ?? "",
      a.cuit, a.denominacion,
      money(a.neto_gravado), money(a.no_gravado), money(a.exento),
      money(a.otros_tributos), money(a.iva), money(a.total),
      a.cuenta_contable, a.nro_cuenta, a.centro_costo,
      a.fuente === "historico" ? "sistema anterior" : a.fuente === "arca" ? "ARCA" : "ventas",
    ])
  }
  return filas
}

/** La solapa que se abre primero: qué se puede entregar y qué no. */
function hojaDeControl(libro: LibroDiario): unknown[][] {
  const { controles: c, ejercicio: ej } = libro
  const f: unknown[][] = []

  f.push([`PAPELES DE TRABAJO — EJERCICIO ${ej.etiqueta}`])
  f.push([`Cierre: ${ej.fechaCierre}`])
  f.push([`Los 12 subdiarios: ${nombreSubdiario(ej.subdiarios[0])} a ${nombreSubdiario(ej.subdiarios[11])}`])
  f.push([])
  f.push(["El período NO se corta por la fecha de las facturas, sino por el subdiario en el que entraron."])
  f.push([])

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

const hoja = (wb: XLSX.WorkBook, nombre: string, filas: unknown[][]) => {
  // 31 caracteres es el máximo que acepta Excel para el nombre de una solapa.
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombre.slice(0, 31))
}

/**
 * Las cuotas de templates, en el mismo formato de fila que el libro diario — pedido del usuario:
 * *«replicar formato de libro diario con los templates»*.
 */
function hojaDeTemplates(t: TemplatesDelEjercicio): unknown[][] {
  const f: unknown[][] = [[
    "Fecha", "Concepto", "Proveedor", "Categoría", "Cuenta contable", "Nro cuenta",
    "Centro de costo", "Responsable", "Estado", "Débito", "Crédito",
  ]]
  for (const c of t.detalle) {
    f.push([
      c.fecha ?? "", c.concepto, c.proveedor, c.categ, c.cuenta_contable, c.nro_cuenta,
      c.centro_costo, c.responsable, c.estado,
      c.monto >= 0 ? money(c.monto) : "", c.monto < 0 ? money(-c.monto) : "",
    ])
  }
  f.push([])
  f.push(["TOTAL", "", "", "", "", "", "", "", "", money(t.totalDebitos), money(t.totalCreditos)])
  return f
}

/**
 * El resumen `concepto × los 12 meses` — **la forma exacta de su planilla** *«detalle completo
 * gastos bancarios e impuestos por mes»*: filas de concepto, columnas jul→jun con «Suma de
 * Débitos / Suma de Créditos», y el total del ejercicio al final.
 */
function hojaTemplatesPorMes(t: TemplatesDelEjercicio): unknown[][] {
  const f: unknown[][] = []
  f.push(["TEMPLATES POR MES — lo que no entra por subdiario y se informa aparte"])
  f.push(["⚠️ Estas cuotas se cortan por FECHA DE PAGO (o estimada si no hay), no por subdiario:"])
  f.push(["un template no tiene factura de ARCA, así que no tiene subdiario."])
  f.push([])

  const cab: unknown[] = ["Categoría"]
  t.columnas.forEach(c => { cab.push(`${c} Déb.`, `${c} Créd.`) })
  cab.push("Total Débitos", "Total Créditos")
  f.push(cab)

  for (const fila of t.porMes) {
    const r: unknown[] = [fila.categ]
    for (let i = 0; i < 12; i++) r.push(fila.debitos[i] || "", fila.creditos[i] || "")
    r.push(fila.totalDebitos, fila.totalCreditos)
    f.push(r)
  }

  const tot: unknown[] = ["TOTAL"]
  for (let i = 0; i < 12; i++) {
    tot.push(
      money(t.porMes.reduce((s, x) => s + x.debitos[i], 0)),
      money(t.porMes.reduce((s, x) => s + x.creditos[i], 0)),
    )
  }
  tot.push(t.totalDebitos, t.totalCreditos)
  f.push(tot)

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
function hojaDeHacienda(h: ValuacionHacienda, fechaCierre: string, mesPrecios: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`02 - HACIENDA — existencia al ${fechaCierre}`])
  f.push([`Precios de referencia: mes completo de ${mesPrecios} (Cañuelas y Entresurcos)`])
  f.push([])
  f.push(["Categoría", "Cabezas", "Criterio de valuación", "Precio de referencia", "Origen del precio",
    "Factor", "Kg/cab", "$ por cabeza", "Valor total"])
  for (const x of h.filas) {
    f.push([
      x.categoria, x.cabezas, x.criterio,
      x.precioReferencia ?? "", x.origenPrecio,
      x.factor, x.pesoKg ?? "",
      x.valorPorCabeza ?? "FALTA EL PRECIO",
      x.valorTotal ?? "FALTA EL PRECIO",
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
function hojaDePrecios(mag: PrecioMag[], mercado: PrecioMercado[], mesPrecios: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`PRECIOS DE REFERENCIA — mes completo de ${mesPrecios}`])
  f.push(["Se toma el mes entero, no un día, para que sea representativo."])
  f.push([])
  f.push(["MERCADO AGROGANADERO DE CAÑUELAS — categorías comerciales"])
  f.push(["Familia", "Calidad", "Corte", "Mínimo", "Máximo", "Promedio", "Mediana"])
  mag.forEach(m => f.push([m.familia, m.calidad, m.corte ?? "", m.minimo, m.maximo, m.promedio, m.mediana]))
  f.push([])
  f.push(["ENTRESURCOS Y CORRALES — por rango de kilos"])
  f.push(["Categoría", "Desde kg", "Hasta kg", "Prom. $/kg", "Máx. $/kg", "Mín. $/kg"])
  mercado.forEach(m => f.push([m.categoria, m.pesoLo, m.pesoHi ?? "sin tope", m.promKilo, m.kiloMax, m.kiloMin]))
  return f
}

/** Los stocks de insumos, un bloque por papel, con los huecos contados. */
function hojaDeInsumos(st: StockInsumos, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`STOCK DE INSUMOS al ${fechaCierre}`])
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
function hojaDeGranos(c: CuadreGranos, v: ValuacionGranos, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`1 - GRANOS al ${fechaCierre}`])
  f.push([])
  f.push(["CUADRE DE KILOS (toneladas)"])
  f.push(["Stock al inicio del ejercicio", c.stockInicioTn ?? "FALTA"])
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
export function armarWorkbook(
  libro: LibroDiario,
  templates?: TemplatesDelEjercicio,
  hacienda?: { valuacion: ValuacionHacienda; mag: PrecioMag[]; mercado: PrecioMercado[]; mesPrecios: string },
  insumos?: StockInsumos,
  campo?: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras },
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  hoja(wb, "Control", hojaDeControl(libro))
  hoja(wb, "Compras", hojaDeAsientos(libro.compras))
  hoja(wb, "Ventas", hojaDeAsientos(libro.ventas))
  hoja(wb, "05 Provision", hojaDeAsientos(libro.provisiones))
  // ⚠️ Se incluye SIEMPRE, aunque esté vacía: una solapa vacía dice «no hay», y que falte dice
  // «no se miró». No es lo mismo (§ 🧮: nada se descarta en silencio).
  hoja(wb, "Sin subdiario", hojaDeAsientos(libro.sinSubdiario))
  if (templates) {
    hoja(wb, "Templates", hojaDeTemplates(templates))
    hoja(wb, "Templates por mes", hojaTemplatesPorMes(templates))
  }
  if (hacienda) {
    hoja(wb, "02 Hacienda", hojaDeHacienda(hacienda.valuacion, libro.ejercicio.fechaCierre, hacienda.mesPrecios))
    hoja(wb, "Precios", hojaDePrecios(hacienda.mag, hacienda.mercado, hacienda.mesPrecios))
  }
  if (insumos) hoja(wb, "Stock insumos", hojaDeInsumos(insumos, libro.ejercicio.fechaCierre))
  if (campo) {
    hoja(wb, "1 Granos", hojaDeGranos(campo.granos, campo.valuacionGranos, libro.ejercicio.fechaCierre))
    hoja(wb, "3 Sementeras", hojaDeSementeras(campo.sementeras, libro.ejercicio.fechaCierre))
  }
  return wb
}

export function nombreArchivo(libro: LibroDiario, empresa: string): string {
  const hoy = new Date().toISOString().slice(0, 10)
  const estado = libro.controles.sePuedeEntregar ? "" : "_REVISAR"
  return `Papeles_balance_${empresa}_${libro.ejercicio.etiqueta.replace("/", "-")}_${hoy}${estado}.xlsx`
}

/** Descarga el archivo en el navegador. */
export function descargarLibroDiario(
  libro: LibroDiario, empresa: string,
  templates?: TemplatesDelEjercicio,
  hacienda?: { valuacion: ValuacionHacienda; mag: PrecioMag[]; mercado: PrecioMercado[]; mesPrecios: string },
  insumos?: StockInsumos,
  campo?: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras },
) {
  const wb = armarWorkbook(libro, templates, hacienda, insumos, campo)
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const url = URL.createObjectURL(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  )
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivo(libro, empresa)
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 0)
}
