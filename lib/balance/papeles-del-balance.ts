/**
 * 🗂️ **LOS LIBROS DEL BALANCE, ENTEROS Y POR SUBS** — A-FEAT-1624 etapa 2 (JMS 12–13/11).
 *
 * JMS 12/11: *«el balance tenga la posibilidad de exportar individualmente estos papeles… yo tengo que poder ir tildando lo que
 * yo ya envié»*. JMS 13/11 (página «Libros y papeles del balance», respuestas en su colección `respuestas`) fijó la estructura:
 *
 * | Libro | Subs |
 * |---|---|
 * | **Saldos** | bancos y caja · inversiones · provisiones — SÓLO saldos; las operaciones salen del maestro de Templates |
 * | **Libro Diario** (ex A) | compras · ventas · su control (resumen 12 meses, sin subdiario, asientos) |
 * | **Templates** (ex H, el maestro) | cada grupo (CZ Ganadera, Imp Rurales, Gastos Bancarios, Inversiones…) — cada ítem: próximo |
 * | **Sueldos** | — |
 * | **Proveedores** (ex B, deudas y créditos al cierre) | — |
 * | **Stocks** (ex E) | hacienda · granos · insumos · sementeras · inicio y cierre |
 * | **Balance en línea** (ex F, la simulación) | — |
 * | **Socios y Libertad** (ex I) | cuentas con socios · Libertad |
 *
 * Regla de JMS (CLAUDE.md § ♻️): **todo libro se baja entero y también por sus subs**. El set A–H viejo se conserva aparte; lo
 * que no entra acá (Control del balance, C, G, lo viejo del D) sigue sólo en el set viejo.
 *
 * 🔑 **Se arma UNA vez y se recorta**: el mismo libro completo de siempre (`armarSetCompleto`) y cada unidad se queda con sus
 * solapas. Así un sub suelto no puede dar un número distinto del set.
 *
 * 🧮 **El control**: cada solapa del set cae en algún libro, o se lista como «sólo en el set viejo»; una fórmula que apunta a una
 * solapa que quedó afuera se pasa a su valor (si no, Excel la rompe con #REF) y se cuenta; cada archivo termina en «Control del
 * papel» con sus solapas, de dónde sale y qué fórmulas se pasaron a valor.
 *
 * Pura: no lee la base.
 */
import XLSX from "xlsx-js-style"
import { libroDeSolapa } from "./libros-del-balance"

/**
 * - `sistema`: la app lo arma entero, igual que lo que se mandó.
 * - `sistema-distinto`: la app arma una versión, pero lo que se mandó salió de un programa aparte (Copias o un script): igualarlo es
 *   la etapa 4.
 * - `falta-definir`: el papel no existe todavía (ej. Caja). Se lista para que se vea; no se puede bajar.
 */
export type OrigenPapel = "sistema" | "sistema-distinto" | "falta-definir"

export interface PapelDelBalance {
  /** Código estable (no cambia aunque cambie el nombre): se usará para el tilde de «enviado» (etapa 3). */
  id: string
  /** El libro al que pertenece (su `id`); un libro entero se apunta a sí mismo. */
  libro: string
  /** `libro` = el libro entero; `sub` = una parte. */
  nivel: "libro" | "sub"
  nombre: string
  origen: OrigenPapel
  /** Qué solapas del set completo lleva. */
  solapas: (nombre: string) => boolean
  /** Lo que conviene saber al bajarlo (de dónde salió lo enviado, qué falta). */
  nota?: string
}

const en = (...xs: string[]) => { const s = new Set(xs); return (n: string) => s.has(n) }
const alguno = (...fs: ((n: string) => boolean)[]) => (n: string) => fs.some(f => f(n))

// ── Los subs con solapas fijas ─────────────────────────────────────────────────────────────────────────────────────
const BANCOS = en("07 Bancos", "07.1 Cadena de saldos")
const PROVISIONES = en("05 Provision", "03.1 Provision cobros")
const COMPRAS = en("Compras", "Compras por cuenta")
const VENTAS = en("Ventas", "Ventas por cuenta")
const CONTROL_DIARIO = en("Resumen 12 meses", "Sin subdiario", "Asientos Contables")
const PROVEEDORES = en("04 Cuentas a pagar", "04.1 Cheques dados", "04.2 Anticipos", "04.3 Respaldo cuentas a pagar", "03 Cuentas a cobrar", "14 Cuentas corrientes")
const HACIENDA = (n: string) => /^02(\.\d+)? /.test(n) && n !== "02 Hacienda"
const GRANOS = en("1 Granos"), INSUMOS = en("Stock insumos"), SEMENTERAS = en("3 Sementeras"), INICIO_CIERRE = en("00 Stocks inicio y cierre")
const SOCIOS = (n: string) => n === "14.1 Cuentas con socios" || n.startsWith("I · ")
const LIBERTAD = en("Gastos Libertad", "G · LIB (paralelo)")
/** El maestro de Templates = lo que el set manda al libro H (el H para el contador). */
const TEMPLATES = (n: string) => libroDeSolapa(n) === "H"
/** Las solapas del H que no son un grupo: el listado, las cuotas, el por mes y lo del extracto sin categoría. */
const BASE_TEMPLATES = (n: string) => /^H · [A-Z]+ · (Egresos|Templates|Cuotas|Por mes|Extracto sin categ)$/.test(n)

/**
 * 📋 EL CATÁLOGO FIJO. Orden = el de la lista que ve JMS (sección N de su página). Cambiar un libro o un sub es tocar acá.
 * Los subs de Templates (uno por grupo) no son fijos: salen de las solapas del armado (`subsDeTemplates`).
 */
export const PAPELES: PapelDelBalance[] = [
  // ── Saldos — sólo saldos (JMS R2: «acá sólo bancos, caja, inversiones, sus saldos, no sus operaciones; agregar acá provisión») ──
  { id: "saldos", libro: "saldos", nivel: "libro", nombre: "Saldos", origen: "sistema", solapas: alguno(BANCOS, PROVISIONES),
    nota: "Bancos, caja e inversiones (sus saldos) y provisiones. Las operaciones (dólares, FCI, intereses, gastos e impuestos bancarios) salen de Templates." },
  { id: "saldos-bancos", libro: "saldos", nivel: "sub", nombre: "Bancos", origen: "sistema", solapas: BANCOS,
    nota: "Saldo de cada cuenta al inicio y al cierre, y la cadena de saldos." },
  { id: "saldos-caja", libro: "saldos", nivel: "sub", nombre: "Caja", origen: "falta-definir", solapas: () => false,
    nota: "Falta definir el papel. Apertura del contador: caja $ 9.903.617,62 y US$ 932.000." },
  { id: "saldos-inversiones", libro: "saldos", nivel: "sub", nombre: "Inversiones", origen: "falta-definir", solapas: () => false,
    nota: "Falta el papel de SALDOS de inversiones (lo que hay hoy son sus operaciones, que van en Templates)." },
  { id: "saldos-provisiones", libro: "saldos", nivel: "sub", nombre: "Provisiones", origen: "sistema", solapas: PROVISIONES,
    nota: "05 provisión de gastos y 03.1 provisión de cobros, al cierre." },
  // ── Libro Diario (ex A) ──
  { id: "diario", libro: "diario", nivel: "libro", nombre: "Libro Diario", origen: "sistema", solapas: alguno(COMPRAS, VENTAS, CONTROL_DIARIO) },
  { id: "diario-compras", libro: "diario", nivel: "sub", nombre: "Compras", origen: "sistema", solapas: COMPRAS, nota: "Se mandó el 04/11 y quedó cerrado." },
  { id: "diario-ventas", libro: "diario", nivel: "sub", nombre: "Ventas", origen: "sistema", solapas: VENTAS },
  { id: "diario-control", libro: "diario", nivel: "sub", nombre: "Control del diario", origen: "sistema", solapas: CONTROL_DIARIO,
    nota: "Resumen 12 meses (lo cargado contra lo presentado a ARCA), Sin subdiario y Asientos Contables." },
  // ── Templates (ex H, el maestro) ──
  { id: "templates", libro: "templates", nivel: "libro", nombre: "Templates", origen: "sistema", solapas: TEMPLATES,
    nota: "El H para el contador, entero. Cada grupo se baja suelto abajo. La versión para auditar se define después de comparar las dos (S3)." },
  { id: "templates-base", libro: "templates", nivel: "sub", nombre: "Listado, cuotas y por mes", origen: "sistema", solapas: BASE_TEMPLATES,
    nota: "Las solapas de cada responsable que no son un grupo." },
  // ── Sueldos ──
  { id: "sueldos", libro: "sueldos", nivel: "libro", nombre: "Sueldos", origen: "sistema", solapas: en("13 Sueldos") },
  // ── Proveedores (ex B) ──
  { id: "proveedores", libro: "proveedores", nivel: "libro", nombre: "Proveedores (deudas y créditos al cierre)", origen: "sistema", solapas: PROVEEDORES },
  // ── Stocks (ex E) ──
  { id: "stocks", libro: "stocks", nivel: "libro", nombre: "Stocks", origen: "sistema", solapas: alguno(HACIENDA, GRANOS, INSUMOS, SEMENTERAS, INICIO_CIERRE) },
  { id: "stocks-hacienda", libro: "stocks", nivel: "sub", nombre: "Hacienda", origen: "sistema", solapas: HACIENDA,
    nota: "02 a 02.10. El respaldo de SENASA va en el Excel de documentación de respaldo." },
  { id: "stocks-granos", libro: "stocks", nivel: "sub", nombre: "Granos", origen: "sistema", solapas: GRANOS },
  { id: "stocks-insumos", libro: "stocks", nivel: "sub", nombre: "Insumos", origen: "sistema", solapas: INSUMOS },
  { id: "stocks-sementeras", libro: "stocks", nivel: "sub", nombre: "Sementeras", origen: "sistema", solapas: SEMENTERAS },
  { id: "stocks-inicio-cierre", libro: "stocks", nivel: "sub", nombre: "Inicio y cierre", origen: "sistema", solapas: INICIO_CIERRE },
  // ── Balance en línea (ex F) ──
  { id: "balance-en-linea", libro: "balance-en-linea", nivel: "libro", nombre: "Balance en línea", origen: "sistema", solapas: n => n.startsWith("F · "),
    nota: "La simulación del balance en proceso." },
  // ── Socios y Libertad (ex I) ──
  { id: "socios", libro: "socios", nivel: "libro", nombre: "Socios y Libertad", origen: "sistema-distinto", solapas: alguno(SOCIOS, LIBERTAD) },
  { id: "socios-cuentas", libro: "socios", nivel: "sub", nombre: "Cuentas con socios", origen: "sistema-distinto", solapas: SOCIOS,
    nota: "Lo enviado salió de Copias (build_envio_contador). Lleva además el retiro de cada socio por mes." },
  { id: "socios-libertad", libro: "socios", nivel: "sub", nombre: "Libertad", origen: "sistema-distinto", solapas: LIBERTAD,
    nota: "La versión 50/50 enviada salió de Copias (build_libertad); igualarla es la etapa 4. Va con lo marcado LIB en los bancos." },
]

/** El nombre de un grupo a partir de su solapa: «H · MSA · Imp Rurales» → «MSA · Imp Rurales». */
const nombreDeGrupo = (solapa: string) => solapa.replace(/^H · /, "")

/**
 * Los subs de Templates: uno por solapa de grupo del H (responsable + agrupadora), con su id estable `tpl:<solapa>`. Salen de las
 * solapas del armado, porque los grupos dependen de los templates de la campaña.
 */
export function subsDeTemplates(solapas: string[]): PapelDelBalance[] {
  return solapas.filter(n => TEMPLATES(n) && n.startsWith("H · ") && !BASE_TEMPLATES(n)).map(n => ({
    id: `tpl:${n}`, libro: "templates", nivel: "sub" as const, nombre: nombreDeGrupo(n), origen: "sistema" as const, solapas: en(n),
  }))
}

/** Todas las unidades: las fijas y, si ya se armó el set, los grupos de Templates. */
export const todasLasUnidades = (solapas: string[] = []) => [...PAPELES, ...subsDeTemplates(solapas)]

/** Busca una unidad por id (las de Templates se resuelven por su solapa). */
export function papelPorId(id: string, solapas: string[] = []): PapelDelBalance | undefined {
  if (id.startsWith("tpl:")) return subsDeTemplates(solapas.length ? solapas : [id.slice(4)]).find(p => p.id === id)
  return PAPELES.find(p => p.id === id)
}

/** Se puede bajar desde la app. */
export const sePuedeBajar = (p: PapelDelBalance) => p.origen === "sistema" || p.origen === "sistema-distinto"

/** Los libros, en orden, con sus subs. */
export function librosConSubs(solapas: string[] = []): { libro: PapelDelBalance; subs: PapelDelBalance[] }[] {
  const us = todasLasUnidades(solapas)
  return us.filter(p => p.nivel === "libro").map(libro => ({ libro, subs: us.filter(p => p.nivel === "sub" && p.libro === libro.id) }))
}

export interface ControlDeCobertura {
  /** Solapas de cada unidad, en este set. */
  porPapel: Record<string, string[]>
  /** Solapas del set que no van a ningún libro nuevo: siguen sólo en el set viejo (se listan, no se descartan en silencio). */
  sinPapel: string[]
  /** Unidades bajables que en este set no trajeron ninguna solapa (por ej. sin stock): se avisan. */
  vacios: string[]
  /** Subs de un libro que traen solapas que el libro entero NO lleva (sería un error del catálogo). */
  subFueraDelLibro: string[]
  /** Solapas del set, para armar la lista de grupos de Templates. */
  solapas: string[]
}

/** 🧮 El control de cobertura: dónde cae cada solapa del set completo. Sólo cuentan los LIBROS (los subs son partes de ellos). */
export function controlDeCobertura(solapas: string[]): ControlDeCobertura {
  const us = todasLasUnidades(solapas)
  const porPapel: Record<string, string[]> = {}
  for (const p of us) porPapel[p.id] = solapas.filter(n => p.solapas(n))
  const libros = us.filter(p => p.nivel === "libro")
  const sinPapel = solapas.filter(n => !libros.some(p => p.solapas(n)))
  const vacios = us.filter(p => sePuedeBajar(p) && porPapel[p.id].length === 0).map(p => p.id)
  const subFueraDelLibro = us.filter(p => p.nivel === "sub").flatMap(p => {
    const libro = libros.find(l => l.id === p.libro)
    return porPapel[p.id].filter(n => !libro?.solapas(n)).map(n => `${p.id}:${n}`)
  })
  return { porPapel, sinPapel, vacios, subFueraDelLibro, solapas }
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
  /** Fórmulas que apuntaban a una solapa que quedó afuera y quedaron con su valor. */
  formulasAValor: { solapa: string; celda: string; apuntaba: string[] }[]
}

/**
 * Recorta del libro completo las solapas de una unidad. Las hojas se COPIAN (celda por celda donde hace falta) para no tocar el
 * libro completo, que se usa para las demás.
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
  "falta-definir": "Falta definir el papel.",
}

/** La solapa «Control del papel», al final de cada archivo: qué lleva, de dónde sale y qué se pasó a valor. */
export function hojaControlDelPapel(papel: PapelDelBalance, armado: { solapas: string[]; formulasAValor: PapelArmado<unknown>["formulasAValor"] },
  empresa: string, etiqueta: string, generado: string, libro?: PapelDelBalance): unknown[][] {
  const f: unknown[][] = [
    [`CONTROL DEL PAPEL — ${libro && libro.id !== papel.id ? `${libro.nombre} → ` : ""}${papel.nombre} — ${empresa} ${etiqueta}`],
    [`Generado ${generado} desde la app (Reportes → Balance). Sale del mismo cálculo que el set completo: los números son los mismos.`],
    [],
    ["Qué es", papel.nivel === "libro" ? "El libro entero" : `Una parte del libro «${libro?.nombre ?? papel.libro}»`],
    ["De dónde sale", ORIGEN_EN_PALABRAS[papel.origen]],
    ...(papel.nota ? [["Nota", papel.nota]] : []),
    [],
    ["SOLAPAS QUE LLEVA"],
    ...armado.solapas.map((s, i) => [i + 1, s]),
    [],
  ]
  if (armado.formulasAValor.length) {
    f.push(["FÓRMULAS PASADAS A VALOR"], [`${armado.formulasAValor.length} celdas apuntaban a solapas que no están en este archivo; quedaron con su valor (el número no cambia, sólo deja de recalcularse).`],
      ["Solapa", "Celda", "Apuntaba a"],
      ...armado.formulasAValor.map(x => [x.solapa, x.celda, x.apuntaba.join(" · ")]))
  } else {
    f.push(["✓ Todas las fórmulas siguen vivas: ninguna apunta afuera del archivo."])
  }
  return f
}

/** El nombre del archivo: «Saldos - Provisiones - MSA 25-26 (2026-11-13).xlsx» o «Saldos - MSA 25-26 (…).xlsx» para el libro entero. */
export function nombreDelPapel(papel: PapelDelBalance, empresa: string, etiqueta: string, fecha: string, libro?: PapelDelBalance): string {
  const limpio = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-")
  const titulo = papel.nivel === "libro" ? papel.nombre : `${libro?.nombre ?? papel.libro} - ${papel.nombre}`
  return `${limpio(titulo)} - ${empresa} ${etiqueta.replace("/", "-")} (${fecha}).xlsx`
}
