/**
 * 📖 EL LIBRO DIARIO DEL EJERCICIO — armado y controlado (A-FEAT-1184).
 *
 * ## Qué es y por qué es ESTO y no un balance
 *
 * *«nosotros no podemos mandar nuestro libro diario y él hacer el suyo como hasta ahora? el sistema
 * que tenía antes exportaba un libro diario… luego el contador lo reagrupa como él quiere»*
 * (JMS, 2026-09-28).
 *
 * Eso **sacó del camino crítico** la tabla de equivalencias entre nuestro plan de cuentas (143
 * cuentas, `410801`) y el del contador (93, `4.1.1/01/03`) → quedó pausada en `A-FEAT-1183`. Lo que
 * hay que entregar es **el libro diario**; reagrupar es trabajo de él.
 *
 * ## 🧮 El control, que también lo puso el usuario
 *
 * *«nosotros sabemos que tenemos tanto de compra y tanto de venta total para hacer nuestro cheq…
 * lo otro es la conformación»*. O sea: **el control es por MASA** (total de compras, total de
 * ventas), **no** cuenta contra cuenta. La conformación puede diferir legítimamente porque el
 * contador a veces toma **parcial** del libro diario, y eso no es un error nuestro.
 *
 * ## Las dos fuentes, y por qué hay que mirarlas juntas
 *
 * Las compras del ejercicio 25/26 **no están en una sola tabla**: julio–diciembre 2025 vienen del
 * sistema anterior (`msa.comprobantes_historico`) y de diciembre en adelante entran por ARCA
 * (`msa.comprobantes_arca`). **Diciembre está en las dos** y no coinciden —44 comprobantes por
 * $16.480.809 contra 40 por $16.394.197— porque, según el usuario, *«sin querer entró 2 veces»*.
 * → `A-DAT-61`.
 *
 * 🛑 **Por eso `armarLibroDiario` NO decide sola cuál vale.** Sumarlas cuenta doble; elegir una al
 * azar pierde comprobantes. Devuelve las dos, marcadas, y **muestra el choque** para que lo resuelva
 * quien sabe (§ 🧮: *nada se descarta en silencio*).
 */
import {
  verificarCuadratura, TIPOS_SIN_CREDITO_COMPRAS, TIPOS_SIN_CREDITO_VENTAS,
  type ResultadoCuadratura, type FilaSubdiario,
} from "@/lib/subdiarios/cuadratura"
import {
  claveSubdiario, esDelEjercicio, esProvision, subdiariosVacios,
  type Ejercicio, type Subdiario,
} from "./ejercicio"

/** De dónde salió el asiento. Importa para el choque de diciembre. */
export type FuenteAsiento = "historico" | "arca" | "venta"

/** Una línea del libro diario, ya normalizada desde cualquiera de las fuentes. */
export interface AsientoLibroDiario {
  id: string
  fuente: FuenteAsiento
  /** `2026-06`: el subdiario en el que entró. Es el corte del ejercicio. */
  subdiario: string
  /** Fecha del comprobante (emisión / liquidación). NO es lo que define el período. */
  fecha: string | null
  tipo: number | null
  punto_venta: number | null
  numero: number | null
  cuit: string
  denominacion: string
  neto_gravado: number
  no_gravado: number
  exento: number
  otros_tributos: number
  iva: number
  total: number
  cuenta_contable: string
  nro_cuenta: string
  centro_costo: string
}

/** Un comprobante que aparece en las dos fuentes, o dos veces en la misma. */
export interface Choque {
  subdiario: string
  clave: string
  denominacion: string
  total: number
  fuentes: FuenteAsiento[]
}

export interface SubdiarioDuplicado {
  subdiario: string
  porFuente: Array<{ fuente: FuenteAsiento; comprobantes: number; total: number }>
  /** Diferencia entre la fuente que más suma y la que menos. */
  diferencia: number
}

export interface LibroDiario {
  ejercicio: Ejercicio
  compras: AsientoLibroDiario[]
  ventas: AsientoLibroDiario[]
  /** Del ejercicio por fecha, pero entraron en un subdiario POSTERIOR: van al papel 05. */
  provisiones: AsientoLibroDiario[]
  /** Comprobantes sin `año_contable`/`mes_contable`: no se sabe dónde van. */
  sinSubdiario: AsientoLibroDiario[]
  controles: {
    compras: ResultadoCuadratura
    ventas: ResultadoCuadratura
    /** 🛑 Subdiarios presentes en más de una fuente. Frena: el total estaría mal. */
    subdiariosDuplicados: SubdiarioDuplicado[]
    /** Mismo comprobante (tipo+PV+número+CUIT) más de una vez. */
    choques: Choque[]
    /** De los 12, los que no tienen ni un comprobante. */
    vacios: Subdiario[]
    /** true sólo si NADA impide entregar el papel. */
    sePuedeEntregar: boolean
    /** Por qué no, en el idioma del usuario. Vacío si se puede. */
    motivos: string[]
  }
}

const n = (v: unknown): number => {
  const x = typeof v === "string" ? parseFloat(v) : (v as number)
  return Number.isFinite(x) ? x : 0
}
const s = (v: unknown): string => (v == null ? "" : String(v))

/** Identidad de un comprobante, para detectar el mismo dos veces. */
const claveComprobante = (a: AsientoLibroDiario) =>
  `${a.tipo ?? "?"}|${a.punto_venta ?? "?"}|${a.numero ?? "?"}|${a.cuit}`

/** `msa.comprobantes_arca` → asiento. */
export function desdeArca(f: Record<string, unknown>): AsientoLibroDiario {
  return {
    id: s(f.id), fuente: "arca",
    subdiario: claveSubdiario(f["año_contable"] as number, f.mes_contable as number),
    fecha: f.fecha_emision ? s(f.fecha_emision).slice(0, 10) : null,
    tipo: f.tipo_comprobante == null ? null : Number(f.tipo_comprobante),
    punto_venta: f.punto_venta == null ? null : Number(f.punto_venta),
    numero: f.numero_desde == null ? null : Number(f.numero_desde),
    cuit: s(f.cuit), denominacion: s(f.denominacion_emisor),
    neto_gravado: n(f.imp_neto_gravado), no_gravado: n(f.imp_neto_no_gravado),
    exento: n(f.imp_op_exentas), otros_tributos: n(f.otros_tributos),
    iva: n(f.iva), total: n(f.imp_total),
    cuenta_contable: s(f.cuenta_contable), nro_cuenta: s(f.nro_cuenta),
    centro_costo: s(f.centro_costo),
  }
}

/**
 * `msa.comprobantes_historico` → asiento.
 *
 * ⚠️ **No tiene las mismas columnas que ARCA**, y la diferencia afecta al control: acá los tributos
 * vienen abiertos en `percepcion_iibb` y `percepcion_iva`, y la identidad de cuadratura espera
 * **un solo** `otros_tributos`. Se suman los tres — si no, el control marcaría descuadre en cada
 * comprobante viejo que tenga percepciones, y el «error» sería del mapeo, no del dato.
 */
export function desdeHistorico(f: Record<string, unknown>): AsientoLibroDiario {
  return {
    id: s(f.id), fuente: "historico",
    subdiario: claveSubdiario(f.anio_contable as number, f.mes_contable as number),
    fecha: f.fecha ? s(f.fecha).slice(0, 10) : null,
    tipo: f.tipo == null ? null : Number(f.tipo),
    punto_venta: f.punto_de_venta == null ? null : Number(f.punto_de_venta),
    numero: f.numero_desde == null ? null : Number(f.numero_desde),
    cuit: s(f.nro_doc_emisor), denominacion: s(f.denominacion_emisor),
    neto_gravado: n(f.imp_neto_gravado), no_gravado: n(f.imp_neto_no_gravado),
    exento: n(f.imp_op_exentas),
    otros_tributos: n(f.otros_tributos) + n(f.percepcion_iibb) + n(f.percepcion_iva),
    iva: n(f.iva), total: n(f.imp_total),
    cuenta_contable: s(f.cuenta_contable), nro_cuenta: s(f.nro_cuenta),
    centro_costo: "",
  }
}

/** `msa.comprobantes_venta` → asiento. */
export function desdeVenta(f: Record<string, unknown>): AsientoLibroDiario {
  return {
    id: s(f.id), fuente: "venta",
    subdiario: claveSubdiario(f["año_contable"] as number, f.mes_contable as number),
    fecha: f.fecha_liquidacion ? s(f.fecha_liquidacion).slice(0, 10) : null,
    tipo: f.tipo_comprobante == null ? null : Number(f.tipo_comprobante),
    punto_venta: f.punto_venta == null ? null : Number(f.punto_venta),
    numero: f.numero_desde == null ? null : Number(f.numero_desde),
    cuit: s(f.cuit_cliente), denominacion: s(f.denominacion_cliente),
    neto_gravado: n(f.imp_neto_gravado), no_gravado: n(f.imp_neto_no_gravado),
    exento: n(f.imp_op_exentas), otros_tributos: 0,
    iva: n(f.iva), total: n(f.imp_total),
    cuenta_contable: s(f.cuenta_contable), nro_cuenta: s(f.nro_cuenta),
    centro_costo: s(f.centro_costo),
  }
}

/** Para pasarle un asiento al control de cuadratura, que habla el idioma del subdiario. */
const aFilaSubdiario = (a: AsientoLibroDiario): FilaSubdiario => ({
  id: a.id, tipo_comprobante: a.tipo, tipo_cambio: 1,
  imp_neto_gravado: a.neto_gravado, imp_neto_no_gravado: a.no_gravado,
  imp_op_exentas: a.exento, otros_tributos: a.otros_tributos,
  iva: a.iva, imp_total: a.total,
  fecha_emision: a.fecha, denominacion_emisor: a.denominacion,
  punto_venta: a.punto_venta, numero_desde: a.numero,
})

/**
 * 🛑 **Subdiarios que aparecen en más de una fuente.** Éste es el control que frena.
 *
 * No es una discrepancia contra el negocio: es **el sistema contradiciéndose** — el mismo mes
 * cargado dos veces. Sumarlo infla el total del ejercicio y **el papel sale mal sin que se note**
 * (§ 🚦: frena sólo la contradicción interna, y ésta lo es).
 */
export function detectarSubdiariosDuplicados(asientos: AsientoLibroDiario[]): SubdiarioDuplicado[] {
  const porSub = new Map<string, Map<FuenteAsiento, { comprobantes: number; total: number }>>()
  for (const a of asientos) {
    if (!a.subdiario) continue
    if (!porSub.has(a.subdiario)) porSub.set(a.subdiario, new Map())
    const m = porSub.get(a.subdiario)!
    const acc = m.get(a.fuente) ?? { comprobantes: 0, total: 0 }
    acc.comprobantes++; acc.total += a.total
    m.set(a.fuente, acc)
  }
  const out: SubdiarioDuplicado[] = []
  for (const [subdiario, m] of porSub) {
    if (m.size < 2) continue
    const porFuente = [...m.entries()].map(([fuente, v]) => ({ fuente, ...v }))
    const totales = porFuente.map(p => p.total)
    out.push({
      subdiario, porFuente,
      diferencia: Math.round((Math.max(...totales) - Math.min(...totales)) * 100) / 100,
    })
  }
  return out.sort((a, b) => a.subdiario.localeCompare(b.subdiario))
}

/** El mismo comprobante más de una vez (mismo tipo, punto de venta, número y CUIT). */
export function detectarChoques(asientos: AsientoLibroDiario[]): Choque[] {
  const porClave = new Map<string, AsientoLibroDiario[]>()
  for (const a of asientos) {
    // Sin número no hay identidad posible; esos no se pueden comparar y no se inventan choques.
    if (a.numero == null) continue
    const k = claveComprobante(a)
    porClave.set(k, [...(porClave.get(k) ?? []), a])
  }
  const out: Choque[] = []
  for (const [clave, list] of porClave) {
    if (list.length < 2) continue
    out.push({
      subdiario: list[0].subdiario, clave,
      denominacion: list[0].denominacion, total: list[0].total,
      fuentes: [...new Set(list.map(a => a.fuente))],
    })
  }
  return out
}

/**
 * Arma el libro diario del ejercicio y lo controla.
 *
 * 📌 **Recibe TODO y filtra acá**, en vez de pedirle a la pantalla que filtre: así el corte por
 * subdiario vive en un solo lugar y no se puede aplicar mal en una de las dos fuentes.
 */
export function armarLibroDiario(
  comprasCrudas: AsientoLibroDiario[],
  ventasCrudas: AsientoLibroDiario[],
  ej: Ejercicio,
): LibroDiario {
  const clasificar = (todos: AsientoLibroDiario[]) => {
    const delEjercicio: AsientoLibroDiario[] = []
    const provisiones: AsientoLibroDiario[] = []
    const sinSubdiario: AsientoLibroDiario[] = []
    for (const a of todos) {
      const [anio, mes] = a.subdiario ? a.subdiario.split("-").map(Number) : [null, null]
      if (!a.subdiario) { sinSubdiario.push(a); continue }
      if (esDelEjercicio(anio, mes, ej)) { delEjercicio.push(a); continue }
      if (esProvision(a.fecha, anio, mes, ej)) provisiones.push(a)
      // Lo que no es del ejercicio ni provisión es de OTRO ejercicio: no se reporta, no es un hueco.
    }
    return { delEjercicio, provisiones, sinSubdiario }
  }

  const c = clasificar(comprasCrudas)
  const v = clasificar(ventasCrudas)

  const subdiariosDuplicados = detectarSubdiariosDuplicados(c.delEjercicio)
  const choques = detectarChoques(c.delEjercicio)
  const vacios = subdiariosVacios(ej, c.delEjercicio.map(a => {
    const [anio, mes] = a.subdiario.split("-").map(Number)
    return { anio, mes }
  }))

  const controlCompras = verificarCuadratura(c.delEjercicio.map(aFilaSubdiario), TIPOS_SIN_CREDITO_COMPRAS, false)
  const controlVentas = verificarCuadratura(v.delEjercicio.map(aFilaSubdiario), TIPOS_SIN_CREDITO_VENTAS, false)

  /**
   * 🚦 Qué FRENA y qué sólo AVISA (§ 🚦 de `CLAUDE.md`).
   *
   * Frena lo que delata que **el sistema se contradice**: un mes cargado dos veces, un comprobante
   * repetido, o las partes que no suman el total que el propio comprobante declara. Todo eso hace
   * que el número entregado sea falso y no hay explicación de negocio posible.
   *
   * ⚠️ **Un subdiario vacío AVISA y no frena.** Puede ser un mes sin movimiento de verdad — raro,
   * pero posible—, y frenar ahí le sacaría la herramienta justo cuando la necesita.
   */
  const motivos: string[] = []
  if (subdiariosDuplicados.length > 0) {
    motivos.push(
      `${subdiariosDuplicados.length} subdiario(s) están cargados en dos fuentes a la vez ` +
      `(${subdiariosDuplicados.map(d => d.subdiario).join(", ")}). Sumarlos contaría doble.`,
    )
  }
  if (choques.length > 0) {
    motivos.push(`${choques.length} comprobante(s) aparecen más de una vez.`)
  }
  if (!controlCompras.ok) {
    motivos.push("En compras, las partes de los comprobantes no suman su propio total.")
  }
  if (!controlVentas.ok) {
    motivos.push("En ventas, las partes de los comprobantes no suman su propio total.")
  }

  return {
    ejercicio: ej,
    compras: c.delEjercicio,
    ventas: v.delEjercicio,
    provisiones: [...c.provisiones, ...v.provisiones],
    sinSubdiario: [...c.sinSubdiario, ...v.sinSubdiario],
    controles: {
      compras: controlCompras,
      ventas: controlVentas,
      subdiariosDuplicados, choques, vacios,
      sePuedeEntregar: motivos.length === 0,
      motivos,
    },
  }
}
