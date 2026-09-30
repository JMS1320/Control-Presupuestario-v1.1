/**
 * 🏦 **LOS PAPELES 7, 8 y 9 DEL BALANCE — bancos, gastos bancarios y retiros.**
 *
 * Los tres salen del **extracto ya parseado y categorizado**, así que son los más baratos de los que
 * faltaban. Los formatos se copiaron de los archivos que el usuario mandó el año pasado
 * (`- Comunicacion JMS Claude - Archivos/Balance/- Enviados/`):
 *
 * | Papel | Archivo original | Qué lleva |
 * |---|---|---|
 * | **7** | `- BANCOS - saldos + FCI + compra venta USS` | saldo al cierre por banco · fondos comunes · dólares |
 * | **8** | `- detalle completo gastos bancarios e impuestos extractos. por mes` | concepto × 12 meses |
 * | **9** | `- Retiros y Aportes` | retiros por tipo y mes · aportes · neto |
 *
 * ## 🔑 La decisión que ordena los tres: el CONCEPTO sale del PLAN DE CUENTAS
 *
 * El papel 8 de él agrupaba por el texto del banco (*«Com. Caja De Seguridad»*, *«Imp. Deb. Ley
 * 25413»*). Acá se agrupa por la **totalizadora del plan de cuentas** —`GASTOS BANCARIOS` e
 * `IMPUESTOS BANCARIOS`, que ya existen con sus 7 cuentas cada una— porque así el papel **sigue al
 * plan** en vez de a una lista escrita acá que se queda vieja (§ 🏷️ de `CLAUDE.md`).
 *
 * ## 🧨 Y el problema real de hacerlo: el `categ` del extracto NO coincide con el nombre del plan
 *
 * Medido el 2026-09-29 sobre el ejercicio 25/26 de MSA:
 * - el extracto dice **`Iva Bancario`**, el plan dice **`IVA Bancario`**;
 * - el extracto dice **`Comision Extraccion Efectivo`**, el plan **`Comisión Extracción Efectivo`**;
 * - el extracto dice **`Debitos / Creditos`**, el plan **`Débitos / Créditos Ley 25413`**.
 *
 * Un `join` por nombre exacto devuelve **cero coincidencias** y hace parecer que nada está en el
 * plan. Es la § 🔎 de `CLAUDE.md` con nombre propio: *buscar `campana` no encuentra `campaña`*.
 *
 * 🔑 **Por eso el match es por nombre NORMALIZADO** (sin tildes, sin mayúsculas, sin puntuación) y
 * **por prefijo**, que es lo que resuelve el `Ley 25413`. Y lo que no matchea **no se descarta**:
 * sale listado en `sinClasificar` con su importe (§ 🧮 *nada se descarta en silencio*).
 *
 * ⚠️ **Por qué no se usa `nro_cuenta`, que sería lo correcto**: porque no está cargado. De los **695**
 * movimientos del ejercicio, sólo **112** lo tienen, y de las 143 cuentas del plan **21 no tienen
 * número** — entre ellas justamente las bancarias. Cuando C-24 termine de pasar el plan a números,
 * este match se reemplaza por el número y se borra toda esta gimnasia.
 */

/** Un movimiento del extracto, con lo mínimo que hace falta. */
export interface MovimientoExtracto {
  fecha: string
  descripcion?: string | null
  categ?: string | null
  nro_cuenta?: string | null
  debitos?: number | null
  creditos?: number | null
  saldo?: number | null
  /**
   * La posición del movimiento **dentro del día**, como vino del banco.
   *
   * 🧨 **Hace falta para el SALDO, no para los gastos.** Sin ella, «el último movimiento del
   * ejercicio» es el que la base quiera devolver, y el 30/06/2026 hay 10 en Banco Galicia con saldos
   * que van de $313.855,13 a −$2.261.369,97: **$2,58 M de diferencia** → [A-BUG-1224]. Las 7 tablas
   * de extracto y caja la tienen. Ver `saldos-al-inicio.ts`.
   */
  orden?: number | null
}

/** Una cuenta del plan, con su totalizadora. */
export interface CuentaDelPlan {
  nro_cuenta?: string | null
  cuenta_contable: string
  nombre_totalizadora?: string | null
  tipo?: string | null
}

const r2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"))
  return Number.isFinite(n) ? n : 0
}

/**
 * Normaliza un nombre de cuenta para poder compararlo: saca tildes, mayúsculas y puntuación.
 *
 * `"Débitos / Créditos Ley 25413"` → `"debitos creditos ley 25413"`.
 */
export function normalizarCuenta(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // fuera las tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Busca a qué cuenta del plan corresponde un `categ` del extracto.
 *
 * Tres intentos, del más estricto al más laxo, y **en ese orden**:
 * 1. el **número de cuenta**, si el movimiento lo trae — es la identidad de verdad;
 * 2. el nombre **normalizado exacto**;
 * 3. el nombre del plan **empieza con** el del extracto, que es lo que resuelve
 *    `Debitos / Creditos` → `Débitos / Créditos Ley 25413`.
 *
 * 🛑 **No hay un cuarto intento por parecido.** Un match difuso acá pondría un gasto en la
 * totalizadora equivocada y **el papel saldría plausible y mal**, que es lo peor que puede pasarle a
 * un número que va al contador. Lo que no matchea se informa.
 */
export function buscarCuenta(
  mov: MovimientoExtracto,
  plan: CuentaDelPlan[],
): CuentaDelPlan | null {
  if (mov.nro_cuenta) {
    const porNumero = plan.find(c => c.nro_cuenta && String(c.nro_cuenta) === String(mov.nro_cuenta))
    if (porNumero) return porNumero
  }
  const n = normalizarCuenta(mov.categ)
  if (!n) return null
  const exacta = plan.find(c => normalizarCuenta(c.cuenta_contable) === n)
  if (exacta) return exacta
  // Por prefijo: el plan es más específico que el extracto («… Ley 25413»), nunca al revés.
  const porPrefijo = plan.filter(c => normalizarCuenta(c.cuenta_contable).startsWith(n + " "))
  // ⚠️ Si hay más de una candidata, NO se elige: sería adivinar. Se informa como sin clasificar.
  return porPrefijo.length === 1 ? porPrefijo[0] : null
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// PAPEL 8 · Gastos bancarios e impuestos, mes por mes
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Las dos totalizadoras del plan que arma este papel. Son las que ya existen, no una lista nueva. */
export const TOTALIZADORAS_BANCARIAS = ["GASTOS BANCARIOS", "IMPUESTOS BANCARIOS"] as const

export interface FilaConceptoPorMes {
  totalizadora: string
  /** El nombre del plan, no el del extracto: el papel habla el idioma del plan de cuentas. */
  concepto: string
  /** Débitos por mes, en el orden de `meses`. */
  debitos: number[]
  creditos: number[]
  totalDebitos: number
  totalCreditos: number
  movimientos: number
}

export interface GastosBancarios {
  /** Los meses del ejercicio, `AAAA-MM`, en orden. Son las columnas. */
  meses: string[]
  filas: FilaConceptoPorMes[]
  /** Subtotal por totalizadora, en el mismo orden de columnas. */
  subtotales: FilaConceptoPorMes[]
  total: FilaConceptoPorMes
  /**
   * Los `categ` que no se pudieron ubicar en el plan, con su importe. **No son un error del papel:
   * son el trabajo que falta en el plan de cuentas**, y hay que verlos (§ 🧮).
   */
  sinClasificar: Array<{ categ: string; movimientos: number; debitos: number; creditos: number }>
}

/** Los 12 meses `AAAA-MM` de un ejercicio, desde su primer subdiario. */
export function mesesDelEjercicio(anioCierre: number, mesCierre: number): string[] {
  const meses: string[] = []
  // El ejercicio termina en `mesCierre` y arranca el mes siguiente del año anterior.
  let a = mesCierre === 12 ? anioCierre : anioCierre - 1
  let m = mesCierre === 12 ? 1 : mesCierre + 1
  for (let i = 0; i < 12; i++) {
    meses.push(`${a}-${String(m).padStart(2, "0")}`)
    m += 1
    if (m > 12) { m = 1; a += 1 }
  }
  return meses
}

const filaVacia = (totalizadora: string, concepto: string, n: number): FilaConceptoPorMes => ({
  totalizadora, concepto,
  debitos: Array(n).fill(0), creditos: Array(n).fill(0),
  totalDebitos: 0, totalCreditos: 0, movimientos: 0,
})

function sumarFila(f: FilaConceptoPorMes, i: number, deb: number, cre: number): void {
  f.debitos[i] = r2(f.debitos[i] + deb)
  f.creditos[i] = r2(f.creditos[i] + cre)
  f.totalDebitos = r2(f.totalDebitos + deb)
  f.totalCreditos = r2(f.totalCreditos + cre)
  f.movimientos += 1
}

/**
 * Arma el papel 8: cada concepto bancario en una fila, los 12 meses en columnas.
 *
 * @param movimientos  el extracto del ejercicio (de todas las cuentas que correspondan)
 * @param plan         `cuentas_contables`
 * @param meses        los 12 del ejercicio (`mesesDelEjercicio`)
 */
export function armarGastosBancarios(
  movimientos: MovimientoExtracto[],
  plan: CuentaDelPlan[],
  meses: string[],
): GastosBancarios {
  const porConcepto = new Map<string, FilaConceptoPorMes>()
  const sinClasificar = new Map<string, { categ: string; movimientos: number; debitos: number; creditos: number }>()
  const indice = new Map(meses.map((m, i) => [m, i]))

  for (const mov of movimientos) {
    const mes = String(mov.fecha ?? "").slice(0, 7)
    const i = indice.get(mes)
    if (i === undefined) continue          // fuera del ejercicio: no es de este papel
    const deb = num(mov.debitos)
    const cre = num(mov.creditos)
    if (deb === 0 && cre === 0) continue

    const cuenta = buscarCuenta(mov, plan)
    const tot = cuenta?.nombre_totalizadora ?? ""

    if (!TOTALIZADORAS_BANCARIAS.includes(tot as typeof TOTALIZADORAS_BANCARIAS[number])) {
      // Sólo interesa lo que NO se pudo ubicar **y parece bancario**; el resto del extracto
      // (sueldos, insumos, impuestos provinciales) no es de este papel y no es un hueco.
      if (!cuenta && pareceBancario(mov.categ)) {
        const k = String(mov.categ ?? "(sin categoría)")
        const e = sinClasificar.get(k) ?? { categ: k, movimientos: 0, debitos: 0, creditos: 0 }
        e.movimientos += 1
        e.debitos = r2(e.debitos + deb)
        e.creditos = r2(e.creditos + cre)
        sinClasificar.set(k, e)
      }
      continue
    }

    const concepto = cuenta!.cuenta_contable
    const f = porConcepto.get(concepto) ?? filaVacia(tot, concepto, meses.length)
    sumarFila(f, i, deb, cre)
    porConcepto.set(concepto, f)
  }

  const filas = [...porConcepto.values()].sort((a, b) =>
    a.totalizadora.localeCompare(b.totalizadora, "es") || a.concepto.localeCompare(b.concepto, "es"))

  const subtotales = TOTALIZADORAS_BANCARIAS.map(t => {
    const s = filaVacia(t, `Total ${t}`, meses.length)
    for (const f of filas.filter(f => f.totalizadora === t)) {
      f.debitos.forEach((v, i) => { s.debitos[i] = r2(s.debitos[i] + v) })
      f.creditos.forEach((v, i) => { s.creditos[i] = r2(s.creditos[i] + v) })
      s.totalDebitos = r2(s.totalDebitos + f.totalDebitos)
      s.totalCreditos = r2(s.totalCreditos + f.totalCreditos)
      s.movimientos += f.movimientos
    }
    return s
  }).filter(s => s.movimientos > 0)

  const total = filaVacia("", "TOTAL DEL EJERCICIO", meses.length)
  for (const s of subtotales) {
    s.debitos.forEach((v, i) => { total.debitos[i] = r2(total.debitos[i] + v) })
    s.creditos.forEach((v, i) => { total.creditos[i] = r2(total.creditos[i] + v) })
    total.totalDebitos = r2(total.totalDebitos + s.totalDebitos)
    total.totalCreditos = r2(total.totalCreditos + s.totalCreditos)
    total.movimientos += s.movimientos
  }

  return {
    meses, filas, subtotales, total,
    sinClasificar: [...sinClasificar.values()].sort((a, b) => (b.debitos + b.creditos) - (a.debitos + a.creditos)),
  }
}

/**
 * ¿Este `categ` huele a gasto o impuesto bancario?
 *
 * Se usa **sólo para decidir si vale la pena avisar** de algo que no se pudo ubicar en el plan —
 * nunca para clasificarlo. Sin este filtro, `sinClasificar` traería el extracto entero y el aviso
 * se volvería ruido: lo que importa es *«esto parece bancario y no está en el plan»*.
 */
function pareceBancario(categ: unknown): boolean {
  const n = normalizarCuenta(categ)
  if (!n) return false
  return ["comision", "impuesto pais", "sello", "iva bancario", "percepcion", "debitos creditos", "iibb bancario"]
    .some(p => n.includes(p))
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// PAPEL 7 · Fondos comunes de inversión
// ══════════════════════════════════════════════════════════════════════════════════════════

export interface FondoComun {
  /** Cómo se llama en el extracto / el broker. */
  donde: string
  saldoInicio: number
  suscripciones: number
  rescates: number
  saldoCierre: number
  /**
   * 🧮 **`saldo cierre − (saldo inicio + suscripciones − rescates)`.**
   *
   * Es el **camino inverso** (§ 🧮): lo que el fondo rindió no se declara, **se deduce** de que la
   * plata que entró y salió no explica el saldo final. Verificado contra su planilla del balance
   * anterior: Galicia, `0 + 390.900.000 − 371.998.456,97 = 18.901.543,03`, saldo al cierre
   * `23.244.019,93` → resultado **$4.342.476,90**, que es exactamente el número que él puso.
   */
  resultadoFinanciero: number
  movimientos: number
}

/**
 * Arma el bloque de fondos comunes del papel 7.
 *
 * @param movimientos  los del extracto cuyo concepto es el FCI
 * @param saldoInicio  el saldo del fondo al inicio del ejercicio, por lugar
 * @param saldoCierre  el saldo al cierre, por lugar
 */
export function armarFondosComunes(
  movimientos: Array<MovimientoExtracto & { donde?: string | null }>,
  saldoInicio: Record<string, number>,
  saldoCierre: Record<string, number>,
): { fondos: FondoComun[]; total: FondoComun } {
  const porDonde = new Map<string, FondoComun>()
  const donde = (m: { donde?: string | null }) => String(m.donde ?? "BANCO GALICIA")

  // Los lugares salen de los saldos **y** de los movimientos: un fondo que se abrió y se cerró
  // dentro del ejercicio tiene saldo 0 en las dos puntas y existiría sólo en los movimientos.
  for (const k of new Set([...Object.keys(saldoInicio), ...Object.keys(saldoCierre), ...movimientos.map(donde)])) {
    porDonde.set(k, {
      donde: k,
      saldoInicio: r2(saldoInicio[k] ?? 0),
      suscripciones: 0, rescates: 0,
      saldoCierre: r2(saldoCierre[k] ?? 0),
      resultadoFinanciero: 0, movimientos: 0,
    })
  }

  for (const m of movimientos) {
    const f = porDonde.get(donde(m))
    if (!f) continue
    // Suscribir es plata que SALE de la cuenta (débito); rescatar es plata que entra (crédito).
    f.suscripciones = r2(f.suscripciones + num(m.debitos))
    f.rescates = r2(f.rescates + num(m.creditos))
    f.movimientos += 1
  }

  const cerrar = (f: FondoComun) => {
    f.resultadoFinanciero = r2(f.saldoCierre - r2(f.saldoInicio + f.suscripciones - f.rescates))
    return f
  }

  const fondos = [...porDonde.values()].map(cerrar).sort((a, b) => a.donde.localeCompare(b.donde, "es"))
  const total = cerrar(fondos.reduce((t, f) => ({
    donde: "TOTAL",
    saldoInicio: r2(t.saldoInicio + f.saldoInicio),
    suscripciones: r2(t.suscripciones + f.suscripciones),
    rescates: r2(t.rescates + f.rescates),
    saldoCierre: r2(t.saldoCierre + f.saldoCierre),
    resultadoFinanciero: 0,
    movimientos: t.movimientos + f.movimientos,
  }), { donde: "TOTAL", saldoInicio: 0, suscripciones: 0, rescates: 0, saldoCierre: 0, resultadoFinanciero: 0, movimientos: 0 }))

  return { fondos, total }
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// PAPEL 9 · Retiros y aportes
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Los conceptos de retiro y aporte, **tal como están escritos en el extracto**.
 *
 * 🛑 **Y acá hay un hueco que hay que decir, no tapar: NINGUNO de estos está en el plan de cuentas.**
 * Medido el 2026-09-29: `Distribucion Mama` ($37.945.000 en el ejercicio), `Retiro PAM` ($5.705.000),
 * `Gastos Reintegro JMS` ($2.137.884,27) — los tres con `nombre_totalizadora` en NULL.
 *
 * Así que este papel **no puede salir del plan** como el 8: sale de esta lista, que es frágil por
 * definición —un `categ` nuevo no aparece— y por eso el papel **informa lo que no reconoció**.
 *
 * 📌 El arreglo de fondo es darles cuenta contable en el plan; mientras no la tengan, esta lista es
 * lo que hay. → `A-DAT-66`.
 */
export const CONCEPTOS_RETIRO_APORTE: Array<{ categ: string; etiqueta: string; clase: "retiro" | "aporte" }> = [
  { categ: "Distribucion Mama", etiqueta: "Distribución a la madre", clase: "retiro" },
  { categ: "Retiro PAM", etiqueta: "Retiro de PAM", clase: "retiro" },
  { categ: "Retiro AMS", etiqueta: "Retiro de AMS", clase: "retiro" },
  { categ: "Retiro JMS", etiqueta: "Retiro de JMS", clase: "retiro" },
  { categ: "Gastos Reintegro JMS", etiqueta: "Reintegro de gastos a JMS", clase: "retiro" },
  { categ: "Aporte PAM", etiqueta: "Aporte de PAM", clase: "aporte" },
  { categ: "Aporte AMS", etiqueta: "Aporte de AMS", clase: "aporte" },
  { categ: "Aporte JMS", etiqueta: "Aporte de JMS", clase: "aporte" },
]

export interface FilaRetiro {
  etiqueta: string
  clase: "retiro" | "aporte"
  /** Por mes, en el orden de `meses`. Un retiro va **negativo**, un aporte **positivo**. */
  porMes: number[]
  total: number
  movimientos: number
}

export interface RetirosYAportes {
  meses: string[]
  filas: FilaRetiro[]
  /** `aportes − retiros` por mes. Es la línea que él mira. */
  neto: FilaRetiro
  /** Conceptos del extracto que parecen retiro o aporte y no están en la lista. */
  sinReconocer: Array<{ categ: string; movimientos: number; importe: number }>
}

/**
 * Arma el papel 9.
 *
 * **Signo:** un retiro sale de la empresa, así que va **negativo**; un aporte entra, **positivo**. Es
 * como él lo tenía en su planilla (`Retiros Directos −500000`), y hace que el neto se lea de una.
 */
export function armarRetirosYAportes(
  movimientos: MovimientoExtracto[],
  meses: string[],
): RetirosYAportes {
  const indice = new Map(meses.map((m, i) => [m, i]))
  const porNormal = new Map(CONCEPTOS_RETIRO_APORTE.map(c => [normalizarCuenta(c.categ), c]))
  const filas = new Map<string, FilaRetiro>()
  const sinReconocer = new Map<string, { categ: string; movimientos: number; importe: number }>()

  for (const mov of movimientos) {
    const i = indice.get(String(mov.fecha ?? "").slice(0, 7))
    if (i === undefined) continue
    const deb = num(mov.debitos)
    const cre = num(mov.creditos)
    if (deb === 0 && cre === 0) continue

    const n = normalizarCuenta(mov.categ)
    const concepto = porNormal.get(n)

    if (!concepto) {
      // Sólo se avisa de lo que parece del tema: el resto del extracto no es de este papel.
      if (n.includes("retiro") || n.includes("aporte") || n.includes("distribucion")) {
        const k = String(mov.categ ?? "(sin categoría)")
        const e = sinReconocer.get(k) ?? { categ: k, movimientos: 0, importe: 0 }
        e.movimientos += 1
        e.importe = r2(e.importe + deb - cre)
        sinReconocer.set(k, e)
      }
      continue
    }

    const f = filas.get(concepto.etiqueta) ?? {
      etiqueta: concepto.etiqueta, clase: concepto.clase,
      porMes: Array(meses.length).fill(0), total: 0, movimientos: 0,
    }
    // Un retiro es un débito de la cuenta y se informa negativo; un aporte es un crédito, positivo.
    const valor = concepto.clase === "retiro" ? -(deb - cre) : (cre - deb)
    f.porMes[i] = r2(f.porMes[i] + valor)
    f.total = r2(f.total + valor)
    f.movimientos += 1
    filas.set(concepto.etiqueta, f)
  }

  const lista = [...filas.values()].sort((a, b) =>
    a.clase.localeCompare(b.clase) || a.etiqueta.localeCompare(b.etiqueta, "es"))

  const neto: FilaRetiro = {
    etiqueta: "Aportes − Retiros", clase: "aporte",
    porMes: Array(meses.length).fill(0), total: 0, movimientos: 0,
  }
  for (const f of lista) {
    f.porMes.forEach((v, i) => { neto.porMes[i] = r2(neto.porMes[i] + v) })
    neto.total = r2(neto.total + f.total)
    neto.movimientos += f.movimientos
  }

  return {
    meses, filas: lista, neto,
    sinReconocer: [...sinReconocer.values()].sort((a, b) => Math.abs(b.importe) - Math.abs(a.importe)),
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// De qué cuentas sale el extracto de cada empresa
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🏦 **Las cuentas cuyo extracto arma los papeles 7, 8 y 9**, por empresa.
 *
 * Está acá y no en la pantalla ni en el script porque **los dos la necesitan y tienen que coincidir**:
 * si el control mira tres cuentas y el Excel cuatro, los números no van a dar lo mismo y nadie va a
 * saber cuál creer. Es la § ♻️ de `CLAUDE.md`.
 *
 * ⚠️ **Las tarjetas NO están.** El resumen de la tarjeta es un gasto de la empresa, pero sus
 * comisiones e impuestos **no son gastos bancarios de la cuenta**: van adentro del resumen y se
 * pagan con el template de la tarjeta. Meterlas acá contaría dos veces.
 */
export const CUENTAS_DEL_EXTRACTO: Record<string, Array<{ schema: string; tabla: string; nombre: string }>> = {
  MSA: [
    { schema: "public", tabla: "msa_galicia", nombre: "BANCO GALICIA (cta cte)" },
    { schema: "msa", tabla: "caja_general", nombre: "CAJA GENERAL" },
    { schema: "msa", tabla: "caja_ams", nombre: "CAJA AMS" },
    { schema: "msa", tabla: "caja_sigot", nombre: "CAJA SIGOT" },
  ],
  PAM: [
    { schema: "public", tabla: "pam_galicia", nombre: "BANCO GALICIA (caja de ahorro)" },
    { schema: "public", tabla: "pam_galicia_cc", nombre: "BANCO GALICIA (cta cte)" },
  ],
  MA: [
    { schema: "ma", tabla: "ma_galicia", nombre: "BANCO GALICIA" },
  ],
}

/** ¿Este movimiento es del fondo común de inversión? */
export function esFCI(m: MovimientoExtracto): boolean {
  const n = normalizarCuenta(m.categ)
  return n === "fci" || n.includes("fondos comunes") || n.includes("fima")
}
