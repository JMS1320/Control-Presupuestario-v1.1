/**
 * 🗂️ **LOS PAPELES DEL BALANCE COMO UNIDADES** — A-FEAT-1624 etapa 2 (JMS 12/11: *«el balance tenga la posibilidad de exportar
 * individualmente estos papeles… yo tengo que poder ir tildando lo que yo ya envié»*).
 *
 * Hasta acá el balance se bajaba como un set de libros por LETRA (A–I, `libros-del-balance.ts`): la letra era un cajón, no un
 * papel. Lo que JMS manda al contador es otra cosa: **un archivo por tema** («Provision», «Bancos y Saldos», «Cuentas de socios»).
 * Este catálogo es esa lista, sacada del «Inventario de papeles del balance 25-26» con las marcas de JMS del 13/11 (columna H).
 *
 * 🔑 **Se arma UNA vez y se recorta**: el mismo libro completo de siempre (`armarSetCompleto`) y cada papel se queda con sus
 * solapas. Así un papel suelto no puede dar un número distinto del set.
 *
 * 🧮 **El control** (§ CLAUDE.md «todo desarrollo termina con su control»):
 * - cada solapa del set cae en algún papel, o se lista como «sin papel» (nada se descarta en silencio);
 * - una fórmula que apunta a una solapa que quedó en OTRO papel se pasa a su valor (si no, Excel la rompe con #REF) y se cuenta;
 * - cada archivo lleva al final una solapa «Control del papel» con sus solapas, de dónde sale y qué fórmulas se pasaron a valor.
 *
 * Pura: no lee la base.
 */
import XLSX from "xlsx-js-style"

export type DestinoPapel = "contador" | "interno"

/**
 * - `sistema`: la app lo arma entero, igual que lo que se mandó.
 * - `sistema-distinto`: la app arma una versión, pero lo que se mandó salió de un programa aparte (Copias o un script del repo)
 *   con otro formato o más datos: igualarlo es la etapa 4.
 * - `fuera`: hoy no lo arma la app (sólo un script o un programa de Copias). Se lista para que se vea; no se puede bajar desde acá.
 * - `falta-definir`: el papel no existe todavía (ej. Caja).
 */
export type OrigenPapel = "sistema" | "sistema-distinto" | "fuera" | "falta-definir"

export interface PapelDelBalance {
  /** Código estable (no cambia aunque cambie el nombre): se usará para el tilde de «enviado» (etapa 3). */
  id: string
  /** Orden y agrupación, en palabras de la app. */
  grupo: string
  nombre: string
  destino: DestinoPapel
  origen: OrigenPapel
  /** Qué solapas del set completo lleva. */
  solapas: (nombre: string) => boolean
  /** El renglón del inventario de JMS del que sale (A1, B2…), para la trazabilidad. */
  inventario: string
  /** Lo que conviene saber al bajarlo (de dónde salió lo enviado, qué falta). */
  nota?: string
}

const en = (...xs: string[]) => { const s = new Set(xs); return (n: string) => s.has(n) }
/** Las solapas del H que son el papel de impuestos (inmobiliario, Red Vial, automotores) — A10. */
const esPapelImpuestos = (n: string) => /^H · [A-Z]+ · (Papel |Automotores$)/.test(n)
/** Lo que se sacó del H porque tiene papel propio (JMS A9: «de acá sacar gastos bancarios que ya fueron en su propio export»). */
const esBancarioEnH = (n: string) => /^H · [A-Z]+ · (Gastos|Imp) Bancarios/i.test(n)

/**
 * 📋 EL CATÁLOGO. El orden es el de la lista que ve JMS. Cada renglón dice de qué fila del inventario sale.
 * Cambiar un papel (juntar, separar, renombrar) es tocar acá y nada más.
 */
export const PAPELES: PapelDelBalance[] = [
  // ── A · Subdiarios ──────────────────────────────────────────────────────────────────────────────────────────────
  { id: "ventas", grupo: "Subdiarios", nombre: "Subdiario de ventas", destino: "contador", origen: "sistema", inventario: "A1",
    solapas: en("Ventas", "Ventas por cuenta") },
  { id: "compras", grupo: "Subdiarios", nombre: "Subdiario de compras", destino: "contador", origen: "sistema", inventario: "B3",
    solapas: en("Compras", "Compras por cuenta"), nota: "Se mandó el 04/11 y quedó cerrado." },
  // ── B · Deudas y créditos ───────────────────────────────────────────────────────────────────────────────────────
  { id: "deudas", grupo: "Deudas y créditos", nombre: "Deudas, créditos y cuentas corrientes", destino: "contador", origen: "sistema", inventario: "A2",
    solapas: en("04 Cuentas a pagar", "04.1 Cheques dados", "04.2 Anticipos", "04.3 Respaldo cuentas a pagar", "03 Cuentas a cobrar", "14 Cuentas corrientes") },
  { id: "provisiones", grupo: "Deudas y créditos", nombre: "Provisiones al cierre", destino: "contador", origen: "sistema", inventario: "A3",
    solapas: en("05 Provision", "03.1 Provision cobros") },
  // ── C · Bancos e inversiones ────────────────────────────────────────────────────────────────────────────────────
  { id: "bancos", grupo: "Bancos e inversiones", nombre: "Bancos y saldos", destino: "contador", origen: "sistema", inventario: "A4",
    solapas: en("07 Bancos", "07.1 Cadena de saldos") },
  { id: "caja", grupo: "Bancos e inversiones", nombre: "Caja", destino: "contador", origen: "falta-definir", inventario: "B4",
    solapas: () => false, nota: "Falta definir el papel. Apertura del contador: caja $ 9.903.617,62 y US$ 932.000." },
  { id: "extractos", grupo: "Bancos e inversiones", nombre: "Índice de extractos", destino: "contador", origen: "fuera", inventario: "A5",
    solapas: () => false, nota: "Hoy sale del script excel-indice-extractos (etapa 4: pasarlo a la app)." },
  { id: "imp-bancarios", grupo: "Bancos e inversiones", nombre: "Impuestos bancarios", destino: "contador", origen: "sistema-distinto", inventario: "A6",
    solapas: en("C · Impuestos bancarios", "08.1 Impuesto al cheque"),
    nota: "Lo enviado es «por cuenta», con TC comprador y vendedor (script excel-imp-bancarios-por-cuenta). Acá sale el resumen por concepto y mes." },
  { id: "gastos-bancarios", grupo: "Bancos e inversiones", nombre: "Gastos bancarios", destino: "contador", origen: "sistema-distinto", inventario: "A7",
    solapas: en("C · Gastos bancarios", "08 Gastos bancarios"),
    nota: "Lo enviado es «por cuenta», con TC comprador y vendedor (script con --gastos). Acá sale el resumen por concepto y mes." },
  { id: "inversiones", grupo: "Bancos e inversiones", nombre: "Inversiones y créditos", destino: "contador", origen: "sistema-distinto", inventario: "A8",
    solapas: en("C · Inversiones", "C · Intereses", "07.2 Operaciones en dólares"),
    nota: "Lo enviado salió de Copias (una solapa por inversión: dólares, FIMA, plazo fijo). Igualarlo es la etapa 4." },
  // ── H · Gastos ──────────────────────────────────────────────────────────────────────────────────────────────────
  { id: "egresos", grupo: "Gastos", nombre: "Egresos por agrupadora", destino: "contador", origen: "sistema", inventario: "A9",
    solapas: n => n.startsWith("H · ") && !esPapelImpuestos(n) && !esBancarioEnH(n),
    nota: "Sin gastos ni impuestos bancarios (tienen su papel). Partirlo en más papeles por rubro queda para la 2ª pasada (tu «ver»)." },
  { id: "otros-gastos", grupo: "Gastos", nombre: "Otros gastos", destino: "contador", origen: "sistema", inventario: "B1",
    solapas: n => /^H · MSA · \(sin agrupadora\)/.test(n),
    nota: "También está adentro de «Egresos por agrupadora». No fue al contador: ¿lo tiene ya en el libro de compras?" },
  { id: "impuestos", grupo: "Gastos", nombre: "Inmobiliario, Red Vial y Automotores", destino: "contador", origen: "sistema", inventario: "A10",
    solapas: esPapelImpuestos, nota: "Partirlo por impuesto queda para la 2ª pasada (tu «ver»)." },
  // ── I · Socios ──────────────────────────────────────────────────────────────────────────────────────────────────
  { id: "socios", grupo: "Socios", nombre: "Cuentas con socios", destino: "contador", origen: "sistema-distinto", inventario: "A11",
    solapas: n => n === "14.1 Cuentas con socios" || n.startsWith("I · "),
    nota: "Lo enviado salió de Copias (build_envio_contador). Acá va además el «Retiros por mes» de cada socio (lo que se rescata del libro I)." },
  { id: "libertad", grupo: "Socios", nombre: "Libertad 50/50", destino: "contador", origen: "sistema-distinto", inventario: "B2",
    solapas: en("Gastos Libertad", "G · LIB (paralelo)"),
    nota: "La versión 50/50 salió de Copias (build_libertad); igualarla es la etapa 4. Va con lo marcado LIB en los bancos (se rescata del libro G)." },
  // ── E · Stocks ──────────────────────────────────────────────────────────────────────────────────────────────────
  { id: "hacienda", grupo: "Stocks", nombre: "Stock de hacienda", destino: "contador", origen: "sistema", inventario: "A12",
    solapas: n => /^02(\.\d+)? /.test(n) && n !== "02 Hacienda", nota: "El respaldo de SENASA va en el Excel de documentación de respaldo (A13)." },
  { id: "stocks", grupo: "Stocks", nombre: "Stocks de granos e insumos", destino: "contador", origen: "sistema", inventario: "C6",
    solapas: en("00 Stocks inicio y cierre", "1 Granos", "3 Sementeras", "Stock insumos"), nota: "Este año lo informaste de palabra." },
  // ── Papeles TUYOS (no van al contador) ──────────────────────────────────────────────────────────────────────────
  { id: "maestro-templates", grupo: "Libros maestros (para auditar)", nombre: "Templates", destino: "interno", origen: "sistema", inventario: "C1",
    solapas: n => /^C · (MSA|MA|PAM) · /.test(n) || n === "Templates" || n === "Templates por mes" || n === "Control cuotas templates",
    nota: "Todos los templates de las tres empresas, completos: listado, cuotas y por mes." },
  { id: "maestro-diario", grupo: "Libros maestros (para auditar)", nombre: "Libro diario", destino: "interno", origen: "sistema", inventario: "C2",
    solapas: en("Asientos Contables", "Resumen 12 meses", "Sin subdiario", "Saldos ej. anterior") },
  { id: "maestro-sueldos", grupo: "Libros maestros (para auditar)", nombre: "Sueldos", destino: "interno", origen: "sistema", inventario: "C2",
    solapas: en("13 Sueldos") },
  { id: "balance-en-linea", grupo: "Tuyos", nombre: "Balance en línea", destino: "interno", origen: "sistema", inventario: "C3",
    solapas: n => n.startsWith("F · ") },
  { id: "control", grupo: "Tuyos", nombre: "Control del balance", destino: "interno", origen: "sistema", inventario: "C7",
    solapas: n => /^00 (Indice|Cobertura|Inicio y cierre|Pendientes a revisar|Recorrido|Respaldos)$/.test(n) || n === "Control",
    nota: "Índice, cobertura, pendientes y recorrido. El H para auditar y el control de la plata siguen bajando con el set." },
]

export const papelPorId = (id: string) => PAPELES.find(p => p.id === id)

/** Se puede bajar desde la app (la app lo arma, igual o con otra forma que lo enviado). */
export const sePuedeBajar = (p: PapelDelBalance) => p.origen === "sistema" || p.origen === "sistema-distinto"

export interface ControlDeCobertura {
  /** Cuántas solapas lleva cada papel, en este set. */
  porPapel: Record<string, string[]>
  /** Solapas del set que no van a ningún papel: se listan (C2 — «lo que el libro D tenía y nadie usa»). */
  sinPapel: string[]
  /** Papeles bajables que en este set no trajeron ninguna solapa (por ej. sin stock): se avisan. */
  vacios: string[]
}

/** 🧮 El control de cobertura: dónde cae cada solapa del set completo. */
export function controlDeCobertura(solapas: string[], papeles: PapelDelBalance[] = PAPELES): ControlDeCobertura {
  const porPapel: Record<string, string[]> = {}
  for (const p of papeles) porPapel[p.id] = solapas.filter(n => p.solapas(n))
  const sinPapel = solapas.filter(n => !papeles.some(p => p.solapas(n)))
  const vacios = papeles.filter(p => sePuedeBajar(p) && porPapel[p.id].length === 0).map(p => p.id)
  return { porPapel, sinPapel, vacios }
}

/** Las solapas a las que apunta una fórmula (`'H · MSA · Por mes'!B5`, `Compras!C3`). */
export function solapasDeFormula(f: string): string[] {
  const out = new Set<string>()
  for (const m of f.matchAll(/'((?:[^']|'')+)'!/g)) out.add(m[1].replace(/''/g, "'"))
  for (const m of f.replace(/'(?:[^']|'')+'!/g, "").matchAll(/([A-Za-z_][A-Za-z0-9_.]*)!/g)) out.add(m[1])
  return [...out]
}

export interface PapelArmado<V> {
  wb: XLSX.WorkBook
  vistas: V[]
  solapas: string[]
  /** Fórmulas que apuntaban a una solapa de otro papel y quedaron con su valor. */
  formulasAValor: { solapa: string; celda: string; apuntaba: string[] }[]
}

/**
 * Recorta del libro completo las solapas de un papel. Las hojas se COPIAN (celda por celda donde hace falta) para no tocar el
 * libro completo, que se usa para los demás papeles.
 */
export function recortarPapel<V>(wb: XLSX.WorkBook, vistas: V[], papel: PapelDelBalance): PapelArmado<V> {
  const nuevo = XLSX.utils.book_new()
  const solapas = wb.SheetNames.filter(n => papel.solapas(n))
  const quedan = new Set(solapas)
  const out: PapelArmado<V> = { wb: nuevo, vistas: [], solapas, formulasAValor: [] }
  for (const nombre of solapas) {
    const orig = wb.Sheets[nombre] as Record<string, unknown>
    const hoja: Record<string, unknown> = { ...orig }
    for (const k of Object.keys(orig)) {
      if (k.startsWith("!")) continue
      const c = orig[k] as { f?: string } | undefined
      if (!c || typeof c !== "object" || !c.f) continue
      const fuera = solapasDeFormula(c.f).filter(s => !quedan.has(s))
      if (!fuera.length) continue
      const { f: _f, ...sinFormula } = c as Record<string, unknown>
      hoja[k] = sinFormula
      out.formulasAValor.push({ solapa: nombre, celda: k, apuntaba: fuera })
    }
    XLSX.utils.book_append_sheet(nuevo, hoja as XLSX.WorkSheet, nombre)
    out.vistas.push(vistas[wb.SheetNames.indexOf(nombre)])
  }
  return out
}

const ORIGEN_EN_PALABRAS: Record<OrigenPapel, string> = {
  sistema: "La app lo arma entero, igual que lo enviado.",
  "sistema-distinto": "La app arma esta versión; lo enviado salió de un programa aparte (se iguala en la etapa 4).",
  fuera: "Hoy no lo arma la app.",
  "falta-definir": "Falta definir el papel.",
}

/** La solapa «Control del papel», al final de cada archivo: qué lleva, de dónde sale y qué se pasó a valor. */
export function hojaControlDelPapel(papel: PapelDelBalance, armado: { solapas: string[]; formulasAValor: PapelArmado<unknown>["formulasAValor"] },
  empresa: string, etiqueta: string, generado: string): unknown[][] {
  const f: unknown[][] = [
    [`CONTROL DEL PAPEL — ${papel.nombre} — ${empresa} ${etiqueta}`],
    [`Generado ${generado} desde la app (Reportes → Balance). Sale del mismo cálculo que el set completo: los números son los mismos.`],
    [],
    ["De dónde sale", ORIGEN_EN_PALABRAS[papel.origen]],
    ...(papel.nota ? [["Nota", papel.nota]] : []),
    ["Renglón del inventario", papel.inventario],
    [],
    ["SOLAPAS QUE LLEVA"],
    ...armado.solapas.map((s, i) => [i + 1, s]),
    [],
  ]
  if (armado.formulasAValor.length) {
    f.push(["FÓRMULAS PASADAS A VALOR"], [`${armado.formulasAValor.length} celdas apuntaban a solapas que están en otro papel; quedaron con su valor (el número no cambia, sólo deja de recalcularse).`],
      ["Solapa", "Celda", "Apuntaba a"],
      ...armado.formulasAValor.map(x => [x.solapa, x.celda, x.apuntaba.join(" · ")]))
  } else {
    f.push(["✓ Todas las fórmulas siguen vivas: ninguna apunta afuera del papel."])
  }
  return f
}

/** El nombre del archivo de un papel: «Papel - Provisiones al cierre - MSA 25-26 (2026-11-13).xlsx». */
export function nombreDelPapel(papel: PapelDelBalance, empresa: string, etiqueta: string, fecha: string): string {
  const limpio = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-")
  return `Papel - ${limpio(papel.nombre)} - ${empresa} ${etiqueta.replace("/", "-")} (${fecha}).xlsx`
}
