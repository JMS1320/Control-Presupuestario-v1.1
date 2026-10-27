/**
 * 💾 LAS VERSIONES DE LOS PAPELES DEL BALANCE — A-FEAT-1337 paso 2 (2026-10-27).
 *
 * Usuario 2026-10-24: *«cada balance tendrá su dato de cada ítem; si se hace query de los datos debería dar lo
 * mismo que el dato fijado, pero el dato fijado debe existir porque es una variable en sí»*. Y 2026-10-27:
 * *«creo que dijimos que guardaría y no haría falta generar todo cada vez»*.
 *
 * Decisiones del 27/10:
 * - **Se guarda sólo cuando el usuario aprieta «Guardar»**, y la pantalla dice siempre **si lo que se ve está
 *   guardado o no** (comparando ítem por ítem contra la última versión).
 * - El Excel queda guardado en la versión, pero **siempre se puede bajar** — el de ahora y el de cada versión.
 *
 * Acá vive la parte PURA (sin base ni React), probada en `lib/pruebas/casos.ts`:
 * - `itemsDeLosPapeles`: «el valor de cada ítem de cada papel», con una clave estable (papel + clave) para poder
 *   comparar versiones. Sale de las MISMAS estructuras que arman el Excel: no se recalcula nada.
 * - `compararItems`: qué cambió entre dos juegos de ítems (avisa, no frena — § 🚦 es una discrepancia).
 */
import type { LibroDiario, AsientoLibroDiario } from "./libro-diario"
import type { TemplatesDelEjercicio } from "./templates-libro"
import type { ValuacionHacienda } from "./hacienda-stock"
import type { StockInsumos } from "./stock-insumos"
import type { CuadreGranos, ValuacionGranos, Sementeras } from "./granos-sementeras"
import type { CuentasAlCierre } from "./cuentas-al-cierre"
import type { ChequesDados, AnticiposAlCierre } from "./valores-al-cierre"
import type { GastosBancarios, RetirosYAportes, FondoComun } from "./papeles-bancarios"
import type { ImpuestoCheque } from "./impuesto-cheque"
import type { SueldosDelEjercicio } from "./sueldos-balance"
import type { PapelDeCuentasCorrientes } from "./cuentas-corrientes"
import type { SaldosAnteriores } from "./ajustes-balance"

export type UnidadItem = "$" | "cabezas" | "tn" | "ha" | "cantidad" | "comprobantes"

/** Un ítem de un papel: lo que se guarda en una versión y se compara entre versiones. */
export interface ItemPapel {
  /** La solapa: «02 Hacienda», «07 Bancos»… */
  papel: string
  /** Estable entre versiones: es lo que se compara. */
  clave: string
  /** Cómo se lee. */
  concepto: string
  valor: number | null
  unidad: UnidadItem
}

/** Lo que tienen armado los papeles en la pantalla. Todo opcional menos el libro: lo que no está, no da ítems. */
export interface DatosParaItems {
  libro: LibroDiario
  templates?: TemplatesDelEjercicio | null
  hacienda?: { valuacion: ValuacionHacienda } | null
  insumos?: StockInsumos | null
  campo?: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras } | null
  cuentas?: { pagar?: CuentasAlCierre; cobrar?: CuentasAlCierre; cheques?: ChequesDados; anticipos?: AnticiposAlCierre } | null
  bancarios?: {
    saldos?: Array<{ nombre: string; saldo: number | null }>
    gastos?: GastosBancarios
    impuestoCheque?: ImpuestoCheque
    retiros?: RetirosYAportes
    fci?: { fondos: FondoComun[]; total: FondoComun }
  } | null
  sueldos?: SueldosDelEjercicio | null
  cuentasCorrientes?: PapelDeCuentasCorrientes | null
  saldosAnteriores?: SaldosAnteriores | null
  asientosContables?: AsientoLibroDiario[] | null
}

const r2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : v == null ? NaN : Number(v)
  return Number.isFinite(n) ? r2(n) : null
}

/**
 * 💾 **El valor de cada ítem de cada papel.** Los papeles que no están armados (sin traer el sector productivo,
 * sin extracto) simplemente no dan ítems: la comparación los muestra como «ya no está» o «nuevo».
 * Si dos ítems salieran con la misma clave, se suman en uno (no se pisan): pasa con dos comprobantes del mismo CUIT.
 */
export function itemsDeLosPapeles(d: DatosParaItems): ItemPapel[] {
  const items = new Map<string, ItemPapel>()
  const poner = (papel: string, clave: string, concepto: string, valor: unknown, unidad: UnidadItem = "$") => {
    const k = `${papel}|${clave}`
    const v = num(valor)
    const ya = items.get(k)
    if (ya) { ya.valor = ya.valor == null && v == null ? null : r2((ya.valor ?? 0) + (v ?? 0)); return }
    items.set(k, { papel, clave, concepto, valor: v, unidad })
  }
  const sumar = (xs: AsientoLibroDiario[]) => xs.reduce((s, a) => s + (Number(a.total) || 0), 0)

  // ── El libro diario ─────────────────────────────────────────────────────────────────────
  const L = d.libro
  poner("Compras", "total", "Compras del ejercicio — total", L.controles.compras.totalGeneral)
  poner("Compras", "cantidad", "Compras del ejercicio — comprobantes", L.controles.compras.cantidad, "comprobantes")
  for (const a of L.compras) poner("Compras", `subdiario ${a.subdiario}`, `Compras del subdiario ${a.subdiario}`, a.total)
  poner("Ventas", "total", "Ventas del ejercicio — total", L.controles.ventas.totalGeneral)
  poner("Ventas", "cantidad", "Ventas del ejercicio — comprobantes", L.controles.ventas.cantidad, "comprobantes")
  for (const a of L.ventas) poner("Ventas", `subdiario ${a.subdiario}`, `Ventas del subdiario ${a.subdiario}`, a.total)
  poner("05 Provision", "total", "Provisión — total", sumar(L.provisiones))
  poner("05 Provision", "cantidad", "Provisión — comprobantes", L.provisiones.length, "comprobantes")
  poner("Sin subdiario", "cantidad", "Sin subdiario — comprobantes", L.sinSubdiario.length, "comprobantes")
  if (d.asientosContables) {
    poner("Asientos Contables", "total", "Asientos contables — total", sumar(d.asientosContables))
    poner("Asientos Contables", "cantidad", "Asientos contables — comprobantes", d.asientosContables.length, "comprobantes")
  }

  // ── 03 y 04 ─────────────────────────────────────────────────────────────────────────────
  const porContraparte = (papel: string, c: CuentasAlCierre | undefined) => {
    if (!c) return
    poner(papel, "total", `${papel} — total`, c.total)
    for (const f of c.filas) {
      const quien = f.asiento.denominacion || f.asiento.cuit || "(sin nombre)"
      poner(papel, `${f.asiento.cuit || quien}`, `${papel} — ${quien}`, f.asiento.total)
    }
  }
  porContraparte("04 Cuentas a pagar", d.cuentas?.pagar)
  porContraparte("03 Cuentas a cobrar", d.cuentas?.cobrar)
  if (d.cuentas?.cheques) poner("04.1 Cheques dados", "total", "Cheques dados pendientes de débito — total", d.cuentas.cheques.total)
  if (d.cuentas?.anticipos) {
    poner("04.2 Anticipos", "a proveedores", "Anticipos a proveedores — total", d.cuentas.anticipos.totalAProveedores)
    poner("04.2 Anticipos", "de clientes", "Anticipos de clientes — total", d.cuentas.anticipos.totalDeClientes)
  }

  // ── 13 Sueldos ──────────────────────────────────────────────────────────────────────────
  if (d.sueldos) {
    poner("13 Sueldos", "bruto", "Sueldos — bruto del ejercicio", d.sueldos.total.bruto)
    poner("13 Sueldos", "pagado", "Sueldos — pagado", d.sueldos.total.pagado)
    poner("13 Sueldos", "saldo", "Sueldos — saldo", d.sueldos.total.saldo)
    for (const f of d.sueldos.filas) poner("13 Sueldos", `bruto ${f.empleado}`, `Sueldos — bruto de ${f.empleado}`, f.brutoCalculado)
  }

  // ── 14 Cuentas corrientes ───────────────────────────────────────────────────────────────
  const cc = d.cuentasCorrientes
  if (cc) {
    for (const c of cc.cuentas) {
      poner("14 Cuentas corrientes", `${c.contraparte.clave} · inicio`, `${c.contraparte.nombre} — saldo de inicio`, c.saldoInicio)
      poner("14 Cuentas corrientes", `${c.contraparte.clave} · cierre`, `${c.contraparte.nombre} — saldo al cierre`, c.saldoAlCierre)
    }
    for (const x of cc.sinTratar) poner("14 Cuentas corrientes", `sin tratar · ${x.etiqueta}`, `Sin tratar — ${x.etiqueta}`, x.total)
    for (const a of cc.aseguradoras ?? []) poner("14 Cuentas corrientes", `aseguradora · ${a.nombre}`, `Aseguradora ${a.nombre} — saldo`, a.saldo)
  }

  // ── Templates ───────────────────────────────────────────────────────────────────────────
  const t = d.templates
  if (t) {
    for (const g of t.porTipo ?? []) poner("Templates", `tipo ${g.tipo}`, `Templates — ${g.tipo} (neto)`, g.totalNeto)
    for (const f of t.porMes) poner("Templates por mes", `${f.tipo}|${f.responsable}|${f.categ}`, `${f.responsable} · ${f.categ} (${f.tipo})`, f.totalNeto)
    if (t.totalEnFacturas) poner("Templates", "seguros con poliza", "Templates — seguros con póliza fuera del gasto", t.totalEnFacturas)
  }
  if (d.saldosAnteriores) poner("Saldos ej. anterior", "total", "Saldos del ejercicio anterior — total", d.saldosAnteriores.total)

  // ── El sector productivo ────────────────────────────────────────────────────────────────
  if (d.hacienda) {
    const v = d.hacienda.valuacion
    poner("02 Hacienda", "cabezas", "Hacienda — cabezas al cierre", v.cabezas, "cabezas")
    poner("02 Hacienda", "valuado", "Hacienda — valuado al cierre", v.valuado)
    for (const f of v.filas) {
      poner("02 Hacienda", `${f.categoria} · cabezas`, `${f.categoria} — cabezas`, f.cabezas, "cabezas")
      poner("02 Hacienda", `${f.categoria} · valuado`, `${f.categoria} — valuado`, f.valorTotal)
    }
  }
  if (d.insumos) {
    poner("Stock insumos", "valuado", "Insumos — valuado al cierre", d.insumos.valuado)
    for (const g of d.insumos.grupos) {
      for (const f of g.filas) {
        poner("Stock insumos", `${f.ambito}|${f.producto} · cantidad`, `${f.producto} — cantidad (${f.unidad})`, f.cantidad, "cantidad")
        poner("Stock insumos", `${f.ambito}|${f.producto} · valuado`, `${f.producto} — valuado`, f.valorTotal)
      }
    }
  }
  if (d.campo) {
    poner("1 Granos", "toneladas", "Granos — toneladas al cierre", d.campo.valuacionGranos.toneladas, "tn")
    poner("1 Granos", "neto final", "Granos — valuado (neto final)", d.campo.valuacionGranos.netoFinal)
    poner("3 Sementeras", "costo", "Sementeras — costo", d.campo.sementeras.costo)
    poner("3 Sementeras", "hectareas", "Sementeras — hectáreas", d.campo.sementeras.hectareas, "ha")
  }

  // ── 07, 08, 08.1, 09 ────────────────────────────────────────────────────────────────────
  const b = d.bancarios
  if (b) {
    for (const s of b.saldos ?? []) poner("07 Bancos", s.nombre, `${s.nombre} — saldo al cierre`, s.saldo)
    if (b.fci) {
      for (const f of b.fci.fondos) poner("07 Bancos", `FCI ${f.donde}`, `FCI ${f.donde} — saldo al cierre`, f.saldoCierre)
    }
    if (b.gastos) {
      for (const f of b.gastos.filas) poner("08 Gastos bancarios", f.concepto, `${f.concepto} — neto`, f.totalDebitos - f.totalCreditos)
      poner("08 Gastos bancarios", "total", "Gastos bancarios — total neto", b.gastos.total.totalDebitos - b.gastos.total.totalCreditos)
    }
    if (b.impuestoCheque) {
      for (const m of b.impuestoCheque.porMes) poner("08.1 Impuesto al cheque", m.mes, `Impuesto al cheque ${m.mes}`, m.total)
      poner("08.1 Impuesto al cheque", "total", "Impuesto al cheque — total", b.impuestoCheque.total.total)
      poner("08.1 Impuesto al cheque", "computable", "Impuesto al cheque — computable", b.impuestoCheque.computable)
    }
    if (b.retiros) {
      for (const f of b.retiros.filas) poner("09 Retiros y aportes", f.etiqueta, `${f.etiqueta} — total`, f.total)
      poner("09 Retiros y aportes", "neto", "Retiros y aportes — neto", b.retiros.neto.total)
    }
  }
  return [...items.values()]
}

/** Qué cambió en un ítem entre dos versiones. */
export interface CambioItem {
  papel: string
  clave: string
  concepto: string
  antes: number | null
  ahora: number | null
  /** ahora − antes (null si falta uno de los dos). */
  diferencia: number | null
  tipo: "cambió" | "nuevo" | "ya no está"
  unidad: UnidadItem
}

/**
 * 🔍 Qué cambió de `antes` a `ahora`, ítem por ítem. Un centavo de redondeo no es un cambio (tolerancia).
 * Ordenado por papel y, adentro, por lo que más se movió.
 */
export function compararItems(antes: ItemPapel[], ahora: ItemPapel[], tolerancia = 0.005): CambioItem[] {
  const k = (x: { papel: string; clave: string }) => `${x.papel}|${x.clave}`
  const mapaAntes = new Map(antes.map(x => [k(x), x]))
  const mapaAhora = new Map(ahora.map(x => [k(x), x]))
  const out: CambioItem[] = []
  for (const [clave, a] of mapaAhora) {
    const p = mapaAntes.get(clave)
    if (!p) { out.push({ ...base(a), antes: null, ahora: a.valor, diferencia: null, tipo: "nuevo" }); continue }
    const igual = (p.valor == null && a.valor == null)
      || (p.valor != null && a.valor != null && Math.abs(a.valor - p.valor) <= tolerancia)
    if (!igual) {
      out.push({ ...base(a), antes: p.valor, ahora: a.valor,
        diferencia: p.valor != null && a.valor != null ? r2(a.valor - p.valor) : null, tipo: "cambió" })
    }
  }
  for (const [clave, p] of mapaAntes) {
    if (!mapaAhora.has(clave)) out.push({ ...base(p), antes: p.valor, ahora: null, diferencia: null, tipo: "ya no está" })
  }
  return out.sort((a, b) => a.papel.localeCompare(b.papel, "es")
    || Math.abs(b.diferencia ?? Infinity) - Math.abs(a.diferencia ?? Infinity)
    || a.clave.localeCompare(b.clave, "es"))
}
const base = (x: ItemPapel) => ({ papel: x.papel, clave: x.clave, concepto: x.concepto, unidad: x.unidad })

/** Cuántos cambios hay por papel, para el resumen de una línea. */
export function cambiosPorPapel(cambios: CambioItem[]): Array<{ papel: string; cambios: number }> {
  const m = new Map<string, number>()
  for (const c of cambios) m.set(c.papel, (m.get(c.papel) ?? 0) + 1)
  return [...m.entries()].map(([papel, n]) => ({ papel, cambios: n }))
}

/** Una versión, tal como la lista la pantalla (sin el archivo ni lo traído, que pesan). */
export interface VersionBalance {
  id: string
  numero: number
  estado: "guardada" | "entregada" | "anulada"
  destinatario: string | null
  nota: string | null
  creada_at: string
  creada_por: string | null
  entregada_at: string | null
  entregada_por: string | null
  anulada_at: string | null
  anulada_motivo: string | null
  items_cantidad: number
  archivo_nombre: string | null
}

/** El número de la próxima versión: el siguiente al mayor (las anuladas cuentan: un número no se reusa). */
export const proximoNumero = (vs: Array<{ numero: number }>): number =>
  vs.reduce((m, v) => Math.max(m, v.numero), 0) + 1

/** La última que vale (no anulada) — contra ésta se dice si lo actual está guardado. */
export const ultimaVigente = (vs: VersionBalance[]): VersionBalance | null =>
  [...vs].filter(v => v.estado !== "anulada").sort((a, b) => b.numero - a.numero)[0] ?? null

/** La última ENTREGADA — contra ésta se avisa qué cambió desde lo que se mandó. */
export const ultimaEntregada = (vs: VersionBalance[]): VersionBalance | null =>
  [...vs].filter(v => v.estado === "entregada").sort((a, b) => b.numero - a.numero)[0] ?? null

/** Lo que el Excel dice de la versión, en su solapa Control. */
export interface InfoVersionExcel {
  /** El número de esta versión si se está guardando; null = se baja sin guardar. */
  numero: number | null
  /** La última guardada, para decir si lo que sale está guardado. */
  ultima: { numero: number; fecha: string } | null
  cambiosContraUltima: number | null
  /** La última entregada y lo que cambió desde ahí. */
  entregada: { numero: number; destinatario: string; fecha: string; cambios: CambioItem[] } | null
}
