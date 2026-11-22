/**
 * 📥 EL EXCEL DEL DASHBOARD — A-FEAT-1637 (JMS 22/11/2026).
 *
 * Lo mismo que está en pantalla (empresas de los chips, año y semestre), con las reglas de los exports (CLAUDE.md § ♻️):
 *   · **Resumen por categoría Y por mes, con Nro** que lleva al detalle (`armarResumenPorMes`, el armado común) — la categoría es
 *     «Sección · Agrupadora» y cada sección lleva su subtotal; con el año entero, los **dos semestres** a la izquierda y un borde
 *     marcado que los separa de los meses (A-FEAT-1621: el borde no corre las letras de las fórmulas).
 *   · **El detalle debajo**, movimiento por movimiento (fecha, empresa, canal, descripción, categoría, template, agrupadora, sección).
 *   · **Fechas reales** (`fechasReales`), **totales con fórmula** que apuntan a sus celdas.
 *   · Hoja **Control**: por canal (movimientos, neto, sin categoría) y la identidad «total de la tabla + lo que quedó afuera =
 *     suma de los canales», con fórmulas y su ✓ / ⚠️.
 */
import XLSX from "xlsx-js-style"
import { armarResumenPorMes, type ItemDetalle } from "@/lib/balance/resumen-por-mes"
import { agregarHoja, vistasDe } from "@/lib/balance/export-libro-diario"
import { aplicarVistas, MONEDA } from "@/lib/balance/formato-excel"
import { fechasReales } from "@/lib/excel/fechas-reales"
import { descargarBlob } from "@/lib/descargar-archivo"
import { SECCIONES_DASHBOARD, type Clasificacion } from "./resumen"
import type { ControlDashboard } from "./control"

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

/** Los meses del período, en orden: el año entero o el semestre. */
export function mesesDelPeriodo(año: number, semestre?: number): { clave: string; rotulo: string }[] {
  const desde = semestre === 2 ? 7 : 1, hasta = semestre === 1 ? 6 : 12
  const out: { clave: string; rotulo: string }[] = []
  for (let m = desde; m <= hasta; m++) out.push({ clave: `${año}-${String(m).padStart(2, "0")}`, rotulo: `${MESES_CORTOS[m - 1]}-${String(año).slice(2)}` })
  return out
}

/** El título: empresas, año y semestre. */
export function tituloDashboard(empresas: readonly string[], año: number, semestre?: number): string {
  const per = semestre === 1 ? "1er semestre" : semestre === 2 ? "2do semestre" : "año entero"
  return `Dashboard — ${empresas.length ? empresas.join(" + ") : "(sin empresa)"} — ${año} (${per})`
}

const fechaAR = (iso: string) => { const [a, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${a}` }
const tituloSeccion = (k: string | null) => SECCIONES_DASHBOARD.find(s => s.key === k)?.titulo ?? "(fuera)"

/** Los renglones del detalle (sólo lo que entra en la tabla), con su categoría «Sección · Agrupadora». Pura. */
export function itemsDelDashboard(movs: Array<{ mov: any; c: Clasificacion; template?: string }>): ItemDetalle[] {
  return movs.filter(x => x.c.seccion).map(({ mov, c, template }) => ({
    categoria: `${tituloSeccion(c.seccion)} · ${c.agrupadora}`,
    orden: `${mov.fecha}|${mov._empresa ?? ""}|${mov._canal ?? ""}|${String(mov.id ?? "").padStart(12, "0")}`,
    mes: String(mov.fecha).slice(0, 7),
    importe: c.monto,
    columnas: [fechaAR(mov.fecha), mov._empresa ?? "", mov._canal ?? "", mov.descripcion ?? "", mov.categ ?? "", template ?? "", c.agrupadora, tituloSeccion(c.seccion), c.detalle],
  }))
}

/** Orden de las categorías: por sección (Ingresos, Egresos, Financieros, Distribuciones) y dentro, alfabético con «(…)» al final. */
const ordenCategoria = (cat: string) => {
  const [sec, ...resto] = cat.split(" · ")
  const i = SECCIONES_DASHBOARD.findIndex(s => s.titulo === sec)
  const ag = resto.join(" · ")
  return `${i < 0 ? 9 : i}|${ag.startsWith("(") ? 1 : 0}|${ag.toLowerCase()}`
}

export interface DatosExcelDashboard {
  empresas: readonly string[]
  año: number
  semestre?: number
  /** Cada movimiento leído con su clasificación y el nombre de su template. */
  movimientos: Array<{ mov: any; c: Clasificacion; template?: string }>
  control: ControlDashboard
  /** Las cuentas que NO entran (dólares), para la nota. */
  fueraDelDashboard: string[]
}

/** Arma el libro (sin escribirlo). */
export function libroDelDashboard(d: DatosExcelDashboard): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const meses = mesesDelPeriodo(d.año, d.semestre)
  const semestres = d.semestre === undefined
  const titulo = tituloDashboard(d.empresas, d.año, d.semestre)
  const items = itemsDelDashboard(d.movimientos)
  const nota = `Suma TODOS los canales en pesos de ${d.empresas.join(", ")} (bancos, cajas, tarjetas, echeqs). No incluye cuentas en dólares${d.fueraDelDashboard.length ? ` (${d.fueraDelDashboard.join(", ")})` : ""} ni las de Cotitulares. Importe = créditos − débitos.`
  const { filas, ubicacion } = armarResumenPorMes(items, {
    titulo,
    notas: [nota],
    meses,
    semestres,
    encabezadoDetalle: ["Fecha", "Empresa", "Canal", "Descripción", "Categ", "Template", "Agrupadora", "Sección", "Detalle"],
    rotuloImporte: "Importe",
    subtotalDe: (cat) => cat.split(" · ")[0],
    ordenCategoria,
  })
  agregarHoja(wb, "Resumen", filas)
  // ↔️ A-FEAT-1621: borde marcado entre «total» (de los semestres) y el primer mes, en las filas del resumen.
  if (semestres) {
    const ws = wb.Sheets["Resumen"]
    for (let r = 0; r < ubicacion.det1 - 3; r++) {
      const dir = XLSX.utils.encode_cell({ r, c: 5 })
      const fila = filas[r] ?? []
      if (fila.length <= 5) continue
      const cel = (ws[dir] ??= { t: "s", v: "" }) as XLSX.CellObject & { s?: Record<string, any> }
      cel.s = { ...(cel.s ?? {}), border: { ...((cel.s?.border as object) ?? {}), left: { style: "medium", color: { rgb: "FF7F7F7F" } } } }
    }
  }

  // 🧮 Hoja Control
  const c = d.control
  const h: unknown[][] = [[`Control — ${titulo}`], [nota], [], ["Canal", "Empresa", "Movimientos con categoría", "Neto (créditos − débitos)", "Sin categoría (no entran)", "Lectura"]]
  const f1 = h.length + 1
  for (const k of c.canales) h.push([k.nombre, k.empresa, k.movimientos, { t: "n", v: k.neto, z: MONEDA }, k.sinCateg ?? "no se pudo contar", k.incompleta ? "⚠️ incompleta" : "completa"])
  const fN = h.length
  const filaSuma = h.length + 1
  h.push(["Suma de los canales", "", { t: "n", f: `SUM(C${f1}:C${fN})`, v: c.canales.reduce((t, k) => t + k.movimientos, 0) }, { t: "n", f: `SUM(D${f1}:D${fN})`, v: c.totalMovimientos, z: MONEDA }, { t: "n", f: `SUM(E${f1}:E${fN})`, v: c.sinCategTotal }])
  h.push([])
  const fuera = d.movimientos.filter(x => !x.c.seccion)
  const filaTabla = h.length + 1
  const celdaTotal = ubicacion.celdaTotal
  h.push(["Total de la tabla (hoja Resumen)", "", "", celdaTotal ? { t: "n", f: `Resumen!${celdaTotal}`, v: c.totalTabla, z: MONEDA } : { t: "n", v: c.totalTabla, z: MONEDA }])
  const filaFuera = h.length + 1
  const iniFuera = filaFuera + 7, finFuera = iniFuera + fuera.length - 1
  h.push(["Movimientos que no entran en ninguna sección (tipo «NO» o vacío, del template o de la cuenta)", "", "", fuera.length ? { t: "n", f: `SUM(F${iniFuera}:F${finFuera})`, v: c.fueraTotal, z: MONEDA } : { t: "n", v: 0, z: MONEDA }])
  const filaDif = h.length + 1
  h.push(["Diferencia: tabla + fuera − suma de los canales", "", "", { t: "n", f: `D${filaTabla}+D${filaFuera}-D${filaSuma}`, v: Math.round((c.totalTabla + c.fueraTotal - c.totalMovimientos) * 100) / 100, z: MONEDA }])
  h.push(["Estado", "", "", { t: "s", f: `IF(ABS(D${filaDif})<0.01,"✓ cierra","⚠️ REVISAR")`, v: c.explicada ? "✓ cierra" : "⚠️ REVISAR" }])
  h.push([c.fueraTotal ? "⚠️ La tabla no muestra los movimientos de abajo: el tipo que les toca (del template o de la cuenta, dice cuál) es «NO» o vacío." : "✓ Todo movimiento con categoría está en la tabla."])
  h.push([])
  h.push(["MOVIMIENTOS FUERA DE LA TABLA"])
  h.push(["Fecha", "Empresa", "Canal", "Descripción", "Categ / tipo", "Importe"])
  if (!fuera.length) h.push(["(ninguno)"])
  for (const x of fuera) h.push([fechaAR(x.mov.fecha), x.mov._empresa ?? "", x.mov._canal ?? "", x.mov.descripcion ?? "", `${x.mov.categ ?? ""} (tipo ${x.c.tipo ?? "vacío"}${x.c.origenTipo ? `, de ${x.c.origenTipo}` : ""})`, { t: "n", v: x.c.monto, z: MONEDA }])
  agregarHoja(wb, "Control", h)
  return wb
}

/** Arma, escribe y baja el Excel. */
export async function descargarExcelDashboard(d: DatosExcelDashboard, nombre: string): Promise<void> {
  const wb = libroDelDashboard(d)
  fechasReales(wb) // 📅 fechas como fecha: el filtro agrupa por año y mes
  const out = await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wb))
  descargarBlob(new Blob([out as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nombre)
}
