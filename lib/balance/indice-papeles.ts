/**
 * 🗂️ **EL ÍNDICE DE LOS PAPELES DEL BALANCE — la primera solapa del Excel.**
 *
 * Pedido del usuario como lo más importante del export, y confirmado 2026-09-29:
 * > *«Las solapas, los puntos, el índice, los pendientes. Tal vez no haga falta una UI de % de
 * > completado con tal que tengamos el índice por ahora.»*
 *
 * ## 🔑 La decisión de diseño: el índice se CALCULA, no se escribe
 *
 * La tentación era poner una tabla a mano con los nueve papeles y su estado. **No sirve**: envejece
 * en la primera semana y después miente con cara de índice. Acá cada estado sale de **mirar el dato
 * que se acaba de armar** — si el papel trae filas está completo, si trae menos meses de los que
 * tiene el ejercicio está parcial, y si no se pudo armar falta.
 *
 * Es la § 🔄 de `CLAUDE.md` aplicada de antemano: en vez de corregir la documentación cuando cambia
 * el dato, **el índice no puede quedar viejo porque no guarda nada**.
 *
 * ## De dónde sale la lista de los nueve
 *
 * De la carpeta `- Comunicacion JMS Claude - Archivos/Balance/- Enviados/`, que son los archivos que
 * él mandó al contador el año pasado. **La lista no se inventó**; y el número de cada papel es el que
 * él ya usaba (`03 - CUENTAS A COBRAR`, `04 - CUENTAS A PAGAR`, `05 - PROVISION FC`).
 */
import type { LibroDiario } from "./libro-diario"
import { claveSubdiario } from "./ejercicio"
import type { TemplatesDelEjercicio } from "./templates-libro"
import type { CuentasAlCierre } from "./cuentas-al-cierre"
import type { ChequesDados, AnticiposAlCierre } from "./valores-al-cierre"
import type { GastosBancarios, RetirosYAportes } from "./papeles-bancarios"
import type { ValuacionHacienda } from "./hacienda-stock"
import type { StockInsumos } from "./stock-insumos"
import type { CuadreGranos, Sementeras } from "./granos-sementeras"

export type EstadoParte = "completo" | "parcial" | "falta" | "lo carga el usuario"

export interface ParteDelBalance {
  /** El número que él usa en sus papeles. Vacío para los que no tenían uno. */
  numero: string
  papel: string
  estado: EstadoParte
  /** Qué hay hoy, con su número si tiene uno. */
  queTiene: string
  /** Qué falta para poder entregarlo. Vacío si está completo. */
  queFalta: string
  /** En qué solapa del Excel está. Vacío si todavía no tiene. */
  solapa: string
  /**
   * `true` si lo que falta impide entregar el balance, no sólo ese papel.
   * Se muestra arriba, separado del resto (§ 🧮: el control es **proporcional**).
   */
  bloqueante: boolean
}

export interface IndiceDelBalance {
  partes: ParteDelBalance[]
  /** Cuántas de cada estado, para la línea de resumen. */
  cuenta: Record<EstadoParte, number>
  /** Lo que impide entregar. Vacío = se puede entregar. */
  bloqueos: ParteDelBalance[]
}

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`

/** Qué se le pasa al índice. Todo opcional: el índice tiene que poder armarse con lo que haya. */
export interface DatosDelIndice {
  libro: LibroDiario
  templates?: TemplatesDelEjercicio | null
  cuentas?: {
    pagar?: CuentasAlCierre; cobrar?: CuentasAlCierre
    /** Bloque 04.1. `undefined` = no se pudo leer; vacío = se leyó y no había. */
    cheques?: ChequesDados
    /** Bloques 04.2 y 03.2 — a proveedores (activo) y de clientes (pasivo). */
    anticipos?: AnticiposAlCierre
  } | null
  hacienda?: ValuacionHacienda | null
  insumos?: StockInsumos | null
  campo?: { granos: CuadreGranos; sementeras: Sementeras } | null
  bancarios?: {
    gastos: GastosBancarios
    retiros: RetirosYAportes
    /** Saldo al cierre por cuenta. `null` = no se pudo leer o no hubo movimientos en el período. */
    saldos: Array<{ nombre: string; saldo: number | null; fecha: string | null }>
    /** Movimientos de FCI encontrados. */
    movimientosFCI: number
  } | null
}

/**
 * Cuántos de los meses del ejercicio tienen algún movimiento. Es la medida de si un papel que se
 * arma mes a mes está completo o le falta parte del período.
 */
function mesesConDatos(gastos: GastosBancarios): number {
  return gastos.meses.filter((_, i) =>
    gastos.total.debitos[i] !== 0 || gastos.total.creditos[i] !== 0).length
}

export function armarIndice(d: DatosDelIndice): IndiceDelBalance {
  const partes: ParteDelBalance[] = []
  const { libro } = d

  // ── 01 · Libro diario ──────────────────────────────────────────────────────────────────
  /** Un subdiario del ejercicio sin un solo comprobante: o falta cargarlo, o el mes fue vacío. */
  const clavesUsadas = new Set([...libro.compras, ...libro.ventas].map(a => a.subdiario))
  const vacios = libro.ejercicio.subdiarios
    .map(s => claveSubdiario(s.anio, s.mes))
    .filter(k => !clavesUsadas.has(k))
  partes.push({
    numero: "01", papel: "Libro Diario (compras y ventas)",
    estado: vacios.length === 0 ? "completo" : "parcial",
    queTiene: `Compras ${pesos(libro.controles.compras.totalGeneral)} (${libro.controles.compras.cantidad} comprobantes) · `
      + `Ventas ${pesos(libro.controles.ventas.totalGeneral)} (${libro.controles.ventas.cantidad})`,
    queFalta: vacios.length === 0 ? "" : `${vacios.length} subdiario(s) sin ningún comprobante: ${vacios.join(", ")}`,
    solapa: "Compras · Ventas · Compras por cuenta · Ventas por cuenta",
    bloqueante: vacios.length > 0,
  })

  // La apertura por cuenta, que es lo que el contador reagrupa.
  const sinImputarCompras = libro.compras.filter(a => !a.cuenta_contable?.trim())
  const sinImputarVentas = libro.ventas.filter(a => !a.cuenta_contable?.trim())
  const totalSinImputar = sinImputarCompras.length + sinImputarVentas.length
  partes.push({
    numero: "01.b", papel: "Apertura por cuenta contable",
    estado: totalSinImputar === 0 ? "completo" : "parcial",
    queTiene: "Año · Mes · Cuenta contable, con Total general por mes y el Control al final",
    queFalta: totalSinImputar === 0 ? ""
      : `${sinImputarCompras.length} compra(s) y ${sinImputarVentas.length} venta(s) sin cuenta contable: salen como NO IMPUTADO`,
    solapa: "Compras por cuenta · Ventas por cuenta",
    bloqueante: false,
  })

  // ── 02 · Stock de hacienda ─────────────────────────────────────────────────────────────
  partes.push({
    numero: "02", papel: "Stock de hacienda",
    estado: !d.hacienda ? "falta"
      : (d.hacienda.huecos.length > 0 || d.hacienda.sinCriterio.length > 0) ? "parcial" : "completo",
    queTiene: d.hacienda
      ? `${pesos(d.hacienda.valuado)} · ${d.hacienda.cabezas} cabezas`
      : "nada: hay que apretar «Traer stock y precios»",
    queFalta: !d.hacienda ? "traer el stock y los precios" : [
      d.hacienda.huecos.length > 0
        ? `${d.hacienda.huecos.length} categoría(s) sin precio (${d.hacienda.cabezasSinValuar} cabezas sin valuar)` : null,
      d.hacienda.sinCriterio.length > 0
        ? `sin criterio de valuación: ${d.hacienda.sinCriterio.join(", ")}` : null,
    ].filter(Boolean).join(" · "),
    solapa: "02 Hacienda · Precios",
    bloqueante: false,
  })

  // ── 03 y 04 · Cuentas a cobrar y a pagar ───────────────────────────────────────────────
  for (const [numero, papel, c] of [
    ["03", "Cuentas a COBRAR al cierre", d.cuentas?.cobrar],
    ["04", "Cuentas a PAGAR al cierre", d.cuentas?.pagar],
  ] as const) {
    const pendiente: string[] = []
    if (c) {
      if (c.sinDatoDePago.length > 0) pendiente.push(`${c.sinDatoDePago.length} conciliado(s) sin fecha de pago (${pesos(c.totalSinDato)})`)
      if (c.estadoDesconocido.length > 0) pendiente.push(`${c.estadoDesconocido.length} con estado no reconocido: ${c.estadosSinClasificar.join(", ")}`)
    }
    partes.push({
      numero, papel,
      estado: !c ? "falta" : pendiente.length > 0 ? "parcial" : "completo",
      queTiene: c ? `${pesos(c.total)} · ${c.filas.length} comprobante(s)` : "nada",
      queFalta: c ? pendiente.join(" · ") : "armar el papel",
      solapa: c ? `${numero} Cuentas a ${numero === "04" ? "pagar" : "cobrar"}` : "",
      bloqueante: false,
    })
  }

  /**
   * ── 04.1 · Cheques dados ──────────────────────────────────────────────────────────────
   *
   * 🔑 **Un cero calculado no es un papel que falta.** Si se leyó la tabla y ningún cheque quedaba
   * sin debitar al cierre, el papel está **completo** y dice cero. Marcarlo como «falta» mandaría a
   * buscar un dato que no existe — y el año pasado, con cinco cheques, existía.
   */
  const ch = d.cuentas?.cheques
  partes.push({
    numero: "04.1", papel: "Cheques dados y diferidos no debitados al cierre",
    estado: !ch ? "falta" : ch.sinFechaDeDebito.length > 0 ? "parcial" : "completo",
    queTiene: !ch ? "nada"
      : ch.filas.length === 0
        ? `ninguno: los ${ch.debitadosAntes} cheque(s) emitidos antes del cierre debitaron antes del cierre`
        : `${pesos(ch.total)} · ${ch.filas.length} cheque(s)`,
    queFalta: !ch ? "leer la tabla de cheques (existe sólo en MSA)"
      : ch.sinFechaDeDebito.length > 0
        ? `${ch.sinFechaDeDebito.length} cheque(s) sin fecha de débito (${pesos(ch.totalSinFecha)}): no se puede afirmar si debitaron`
        : "",
    solapa: ch ? "04.1 Cheques dados" : "",
    bloqueante: false,
  })

  /**
   * ── 04.2 · Anticipos ──────────────────────────────────────────────────────────────────
   *
   * 🧨 Los `cobro` son **pasivo**, no activo. Se dicen aparte en el índice justamente porque en el
   * papel del año pasado no había ninguno y este año son el número más grande de la solapa.
   */
  const an = d.cuentas?.anticipos
  const faltaAnt: string[] = []
  if (an) {
    if (an.descuadres.length > 0) {
      faltaAnt.push(`🧮 el control no cierra en ${an.descuadres.length} anticipo(s): el saldo recalculado no da el del sistema`)
    }
    if (an.sinTipo.length > 0) {
      faltaAnt.push(`${an.sinTipo.length} sin tipo (${pesos(an.totalSinTipo)}): no se sabe si son a proveedor o de cliente`)
    }
    if (an.sinEmpresa > 0) {
      faltaAnt.push(`${an.sinEmpresa} sin empresa asignada (${pesos(an.totalSinEmpresa)}), tomados como de esta empresa — A-DAT-73`)
    }
    if (an.deClientes.length > 0) {
      faltaAnt.push(`decidir dónde van los ${pesos(an.totalDeClientes)} de anticipos DE CLIENTES: son PASIVO y el papel del año pasado no tenía ese bloque`)
    }
  }
  partes.push({
    numero: "04.2", papel: "Anticipos: a proveedores (activo) y de clientes (pasivo)",
    estado: !an ? "falta" : faltaAnt.length > 0 ? "parcial" : "completo",
    queTiene: an
      ? `a proveedores ${pesos(an.totalAProveedores)} (${an.aProveedores.length}) · `
        + `de clientes ${pesos(an.totalDeClientes)} (${an.deClientes.length})`
      : "nada",
    queFalta: !an ? "leer los anticipos y sus aplicaciones" : faltaAnt.join(" · "),
    solapa: an ? "04.2 Anticipos" : "",
    bloqueante: false,
  })

  /**
   * ── 03.1 · Provisión de cobros y cheques en cartera ───────────────────────────────────
   *
   * 🚫 Los **cheques en cartera** no salen del sistema: no hay tabla de valores recibidos. El papel
   * se entrega igual **diciéndolo**, que es distinto de entregarlo sin el bloque.
   */
  const provVentas = libro.provisiones.filter(a => a.fuente === "venta")
  partes.push({
    numero: "03.1", papel: "Provisión de cobros · cheques en cartera",
    estado: "parcial",
    queTiene: provVentas.length > 0
      ? `provisión de cobros ${pesos(provVentas.reduce((s, a) => s + a.total, 0))} · ${provVentas.length} venta(s)`
      : "provisión de cobros: ninguna venta con fecha anterior al cierre entró en un subdiario posterior",
    queFalta: "los CHEQUES EN CARTERA no se pueden calcular: el sistema sólo registra los cheques "
      + "que emitimos, no los recibidos. El año pasado no había ninguno — A-DAT-74",
    solapa: "03.1 Provision cobros",
    bloqueante: false,
  })

  /**
   * ── 05 · Provisión de facturas ─────────────────────────────────────────────────────────
   *
   * ⚠️ **Sólo las de COMPRA.** Las ventas a provisionar son el papel 03.1: mezclarlas contaría un
   * ingreso adentro del gasto a provisionar (corregido 2026-09-30, A-FEAT-1195).
   */
  const provCompras = libro.provisiones.filter(a => a.fuente !== "venta")
  partes.push({
    numero: "05", papel: "Provisión de facturas (compras)",
    estado: "completo",
    queTiene: `${pesos(provCompras.reduce((s, a) => s + a.total, 0))} · ${provCompras.length} comprobante(s) `
      + "con fecha anterior al cierre que entraron en subdiarios posteriores",
    queFalta: "",
    solapa: "05 Provision",
    bloqueante: false,
  })

  // ── 06 · Stocks del campo ──────────────────────────────────────────────────────────────
  const faltaCampo: string[] = []
  if (!d.insumos) faltaCampo.push("el stock de insumos")
  else if (d.insumos.huecos.length > 0) faltaCampo.push(`${d.insumos.huecos.length} producto(s) con stock y sin precio`)
  if (!d.campo) faltaCampo.push("granos y sementeras")
  else {
    if (!d.campo.granos.cierra) faltaCampo.push(`el cuadre de granos no cierra: ${d.campo.granos.faltan.join(", ") || "ver la solapa"}`)
    if (d.campo.sementeras.huecos.length > 0) faltaCampo.push(`${d.campo.sementeras.huecos.length} línea(s) de sementera sin costo`)
    if (d.campo.sementeras.ordenesNoContadas.length > 0) faltaCampo.push(`${d.campo.sementeras.ordenesNoContadas.length} orden(es) de sementera no contadas`)
  }
  faltaCampo.push("el GASOIL, que su papel original incluye y todavía no sale del sistema")
  partes.push({
    numero: "06", papel: "Stocks: granos · insumos · sementeras · gasoil",
    estado: !d.insumos && !d.campo ? "falta" : "parcial",
    queTiene: [
      d.insumos ? `insumos ${pesos(d.insumos.valuado)} (${d.insumos.productos} productos)` : null,
      d.campo?.granos.saldoTn != null ? `granos ${d.campo.granos.saldoTn.toLocaleString("es-AR")} tn` : null,
      d.campo ? `sementeras ${pesos(d.campo.sementeras.costo)} en ${d.campo.sementeras.hectareas} ha` : null,
    ].filter(Boolean).join(" · ") || "nada",
    queFalta: faltaCampo.join(" · "),
    solapa: "Stock insumos · 1 Granos · 3 Sementeras",
    bloqueante: false,
  })

  // ── 07 · Bancos ────────────────────────────────────────────────────────────────────────
  const b = d.bancarios
  const faltaBancos: string[] = []
  if (b) {
    const sinSaldo = b.saldos.filter(s => s.saldo == null)
    if (sinSaldo.length > 0) faltaBancos.push(`sin saldo al cierre: ${sinSaldo.map(s => s.nombre).join(", ")}`)
    faltaBancos.push("los SALDOS AL INICIO del ejercicio, que no están en el sistema (los carga el usuario)")
    if (b.movimientosFCI > 0) faltaBancos.push("el SALDO DEL FONDO al inicio y al cierre: el extracto ve la plata que entra y sale, no cuánto quedó invertido")
    faltaBancos.push("la compra-venta de DÓLARES")
  }
  partes.push({
    numero: "07", papel: "Bancos: saldos · fondos comunes · dólares",
    estado: !b ? "falta" : "parcial",
    queTiene: b
      ? b.saldos.filter(s => s.saldo != null).map(s => `${s.nombre} ${pesos(s.saldo!)}`).join(" · ") || "ningún saldo"
      : "nada",
    queFalta: b ? faltaBancos.join(" · ") : "armar el papel",
    solapa: b ? "07 Bancos" : "",
    bloqueante: false,
  })

  // ── 08 · Gastos bancarios ──────────────────────────────────────────────────────────────
  if (b) {
    const conDatos = mesesConDatos(b.gastos)
    const falta: string[] = []
    if (conDatos < b.gastos.meses.length) {
      const vacios = b.gastos.meses.filter((_, i) =>
        b.gastos.total.debitos[i] === 0 && b.gastos.total.creditos[i] === 0)
      falta.push(`🛑 SÓLO ${conDatos} de los 12 meses tienen movimientos. Sin datos: ${vacios.join(", ")}`)
    }
    if (b.gastos.sinClasificar.length > 0) {
      falta.push(`${b.gastos.sinClasificar.length} concepto(s) que parecen bancarios y no están en el plan de cuentas`)
    }
    partes.push({
      numero: "08", papel: "Gastos bancarios e impuestos del extracto, por mes",
      estado: conDatos === b.gastos.meses.length ? "completo" : "parcial",
      queTiene: `${pesos(b.gastos.total.totalDebitos)} en ${conDatos} mes(es) · ${b.gastos.filas.length} concepto(s)`,
      queFalta: falta.join(" · "),
      solapa: "08 Gastos bancarios",
      bloqueante: conDatos < b.gastos.meses.length,
    })

    // ── 09 · Retiros y aportes ───────────────────────────────────────────────────────────
    const faltaRet: string[] = []
    if (b.retiros.sinReconocer.length > 0) {
      faltaRet.push(`${b.retiros.sinReconocer.length} concepto(s) que parecen retiro o aporte y no se reconocieron: `
        + b.retiros.sinReconocer.map(s => s.categ).join(", "))
    }
    if (mesesConDatos(b.gastos) < b.gastos.meses.length) {
      faltaRet.push("los mismos meses de extracto que le faltan al papel 08")
    }
    partes.push({
      numero: "09", papel: "Retiros y aportes de los socios",
      estado: faltaRet.length === 0 ? "completo" : "parcial",
      queTiene: `Aportes − retiros ${pesos(b.retiros.neto.total)} · ${b.retiros.filas.length} concepto(s)`,
      queFalta: faltaRet.join(" · "),
      solapa: "09 Retiros y aportes",
      bloqueante: false,
    })
  } else {
    partes.push({ numero: "08", papel: "Gastos bancarios e impuestos del extracto, por mes", estado: "falta", queTiene: "nada", queFalta: "armar el papel", solapa: "", bloqueante: false })
    partes.push({ numero: "09", papel: "Retiros y aportes de los socios", estado: "falta", queTiene: "nada", queFalta: "armar el papel", solapa: "", bloqueante: false })
  }

  // ── Los que dependen de él, y se dicen igual para que no se olviden ────────────────────
  /**
   * 🏛️ **Inmobiliario · Red Vial · Automotor — y por qué NO lleva su detalle en este balance.**
   *
   * Pregunta del usuario 2026-09-29, en su solapa «cosas a revisar»: *«impuesto inmobiliario, red vial
   * y automotor también lleva su detalle como gastos bancarios, pero habrá que ver si sigue valiendo
   * la pena tanto detalle si finalmente ya tenemos algo más sintético con los templates»*.
   *
   * 🔑 **Respuesta: para el balance, alcanza el template.** Y hay un dato que la vuelve fácil:
   * `public.boletas_arba` está **VACÍA**, así que hoy el detalle **no existe en el sistema** — armarlo
   * significaría tipear las 63 boletas y 21 partidas a mano para un papel que el contador **no
   * necesita para el resultado**: el número que va al balance es el total, y el total lo da el template.
   *
   * 📌 **Pero el detalle sirve para otra cosa, y ahí sí vale**: es el control de que se pagaron
   * **todas** las cuotas y **ninguna dos veces**, y el respaldo si ARBA reclama. Es cumplimiento, no
   * resultado — y cuando se haga **no se tipea**: sale del importador de boletas, que ya existe
   * (A-FEAT-95/104). Ahí el detalle cuesta casi nada.
   */
  partes.push({
    numero: "10", papel: "Inmobiliario · Red Vial · Automotor",
    estado: "completo",
    queTiene: "el total del ejercicio, por el template de cada impuesto (es lo que va al balance)",
    queFalta: "el detalle por partida y cuota NO hace falta para el balance — decidido 2026-09-29. "
      + "Sirve como control de cumplimiento, y sale del importador de boletas de ARBA, que hoy está vacío",
    solapa: "Templates · Templates por mes",
    bloqueante: false,
  })
  partes.push({
    numero: "11", papel: "Balance propio: activo − pasivo, fin − inicio, en pesos y dólares",
    estado: "lo carga el usuario",
    queTiene: "nada todavía",
    queFalta: "la planilla del usuario, el valor del dólar a las dos fechas y el activo/pasivo agrupado (A-FEAT-1190)",
    solapa: "",
    bloqueante: false,
  })
  partes.push({
    numero: "12", papel: "Templates del período (lo que se informa aparte)",
    estado: !d.templates ? "falta"
      : (d.templates.sinCategoria.length > 0 || d.templates.sinFecha.length > 0) ? "parcial" : "completo",
    queTiene: d.templates
      ? `${pesos(d.templates.totalDebitos - d.templates.totalCreditos)} neto · ${d.templates.detalle.length} cuota(s)`
      : "nada",
    queFalta: !d.templates ? "armar el papel" : [
      d.templates.sinCategoria.length > 0 ? `${d.templates.sinCategoria.length} cuota(s) sin categoría contable` : null,
      d.templates.sinFecha.length > 0 ? `${d.templates.sinFecha.length} cuota(s) sin fecha de ningún tipo` : null,
    ].filter(Boolean).join(" · "),
    solapa: "Templates · Templates por mes",
    bloqueante: false,
  })

  const cuenta: Record<EstadoParte, number> = {
    completo: 0, parcial: 0, falta: 0, "lo carga el usuario": 0,
  }
  partes.forEach(p => { cuenta[p.estado] += 1 })

  return { partes, cuenta, bloqueos: partes.filter(p => p.bloqueante) }
}
