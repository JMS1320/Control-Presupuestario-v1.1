/**
 * 🔗 **PROPAGAR LA CUENTA CONTABLE DE UNA FACTURA A SUS MOVIMIENTOS — un solo camino.**
 *
 * Objetivo, en palabras del usuario (2026-09-30): *«lo de propagar es para chequear si la asignación
 * que yo haga ahí propague correctamente: a egresos, que ya está hecho, pero luego **si la FC ya está
 * conciliada debe ir hacia extracto**»*. Y el norte del circuito, también suyo: **«la factura debe
 * quedar con categoría a una cuenta contable y los movimientos conciliados también»**.
 *
 * ## 🧨 Por qué existe este archivo (A-BUG-1221)
 *
 * La misma regla estaba escrita **a mano en cuatro lugares**, y ninguno nombraba las diez tablas:
 *
 * | Dónde | Qué tenía |
 * |---|---|
 * | `app/api/arca-asignar/route.ts` | 3 tablas |
 * | `components/vista-facturas-arca.tsx` (dos veces) | 3 tablas |
 * | `components/vista-facturas-arca.tsx` (una tercera) | **1 tabla** — sólo `msa_galicia` |
 *
 * `msa.tarjeta_visa_business` ya tenía **7 movimientos enganchados que nunca recibieron la cuenta**.
 * Es § 🗺️ de `CLAUDE.md` en su forma más literal: *se arregló un camino de los dos*.
 *
 * ## 🎨 La regla que pidió el usuario: no sobrescribir mal
 *
 * *«Puede haber detalles de ver que no sobrescriba mal, usando un formato incorrecto, ya que hemos
 * trabajado mucho en el formato de los datos en las columnas.»* Medido antes de tocar nada:
 *
 * - ✅ **`nro_cuenta` tiene el mismo formato** en el extracto y en el plan: texto de 5, 6 y 7 dígitos
 *   (`42301` · `421113` · `4230501`). No hay ceros que se pierdan.
 * - 🔴 **Pero `categ` NO es un solo espacio de valores.** Tiene **74** distintos en `msa_galicia` y
 *   **32 no están en el plan de cuentas**, porque son de movimientos que **no pagan una factura de
 *   ARCA**: ahí `categ` lleva el nombre del **template o de la regla** (`FCI` con 82 movimientos y
 *   $304 M · `Sueldos` con 70 y $70 M · `CAJA` · `Tarjetas MSA` · `CRED P` · `Débitos / Créditos`).
 *
 * 🧨 **Y el costo de pisar uno de ésos está escrito en `CLAUDE.md`** (§ 🏷️): de la `categ` depende el
 * `tipo`, y el `tipo` decide **si algo se presupuesta**. Pisar **`FCI`** —financiero, que no se
 * proyecta— con una cuenta de gasto **infla el egreso con plata que sigue siendo de la empresa**: es
 * el bug del FCI de ~$135 M que esa regla cita como motivo.
 *
 * ## ✅ Entonces hay dos clases de valor, y el usuario las separó
 *
 * *«El anticipo nunca es una cuenta contable, es una vía de pago cuando no hay factura. Anticipo es
 * provisorio.»*
 *
 * | Qué había en `categ` | Qué es | Qué se hace |
 * |---|---|---|
 * | `ANTICIPO` · `SIN_CATEG` · `INVALIDA:` · vacío | **provisorio** o placeholder | **se pisa siempre** — es justamente el trabajo |
 * | una cuenta **del plan** | ya está bien imputado | se pisa (es la cuenta nueva de la misma factura) |
 * | cualquier **otro** nombre | clasificación **de otro sistema** | 🛑 **no se pisa**: se devuelve para avisar |
 *
 * 📌 Y la tercera fila **avisa, no frena** (§ 🚦): puede ser legítimo que un movimiento de template
 * termine pagando una factura, pero eso lo decide una persona, no un `UPDATE` en silencio.
 *
 * ## 🔇 Lo que antes se perdía
 *
 * Si la propagación fallaba, iba a `console.error` y el usuario veía **«Cuenta asignada»** igual. Acá
 * se devuelve **qué se propagó, a dónde, y qué se salteó**, para que la pantalla lo muestre
 * (§ 🧮 *nada se descarta en silencio*).
 */
import { TABLAS_CON_VINCULO_ARCA, COLUMNA_VINCULO_ARCA } from "./tablas-con-vinculo-arca"

/**
 * Los valores de `categ` que **no clasifican nada**: son un lugar guardado hasta que aparezca la
 * cuenta de verdad. Se comparan sin distinguir mayúsculas ni espacios.
 *
 * 🔑 **`ANTICIPO` está acá por decisión del usuario (2026-09-30)**, y el motivo vale escribirlo
 * porque no es obvio: *«el anticipo nunca es una cuenta contable, es una vía de pago cuando no hay
 * factura»*. Cuando la factura aparece, el movimiento **tiene que** pasar a la cuenta de la factura —
 * dejarlo en `ANTICIPO` es dejar el circuito a medias.
 */
export const CATEGS_PROVISORIAS = ["anticipo", "sin_categ", "invalida:", "invalida", "sin categ"]

/** ¿Este valor de `categ` es un provisorio que corresponde pisar? */
export function esCategProvisoria(categ: string | null | undefined): boolean {
  const v = (categ ?? "").trim().toLowerCase()
  if (v === "") return true
  return CATEGS_PROVISORIAS.includes(v)
}

/** Un movimiento que la propagación mira antes de escribirle. */
export interface MovimientoAPropagar {
  id: string
  categ?: string | null
  nro_cuenta?: string | null
}

/** Qué se decidió hacer con un movimiento, y por qué. Se muestra. */
export interface DecisionDePropagacion {
  schema: string
  tabla: string
  movimientoId: string
  categAnterior: string | null
  /** `true` = se escribe. `false` = se saltea y se avisa. */
  seEscribe: boolean
  motivo:
    | "estaba vacío o provisorio"
    | "tenía una cuenta del plan"
    | "tenía una clasificación de otro sistema"
}

export interface ResultadoPropagacion {
  /** Cuántos movimientos recibieron la cuenta. */
  propagados: number
  /** Los que se saltearon porque su `categ` es de otro sistema: hay que decidirlos a mano. */
  salteados: DecisionDePropagacion[]
  /** Las tablas que no se pudieron leer o escribir, con su error. Nunca se silencian. */
  fallaron: Array<{ schema: string; tabla: string; error: string }>
  /** Todas las decisiones, para poder auditar. */
  decisiones: DecisionDePropagacion[]
}

/**
 * Decide qué hacer con cada movimiento **sin tocar la base**: es la parte pura y la que se prueba.
 *
 * @param movimientos    los enganchados a las facturas
 * @param cuentasDelPlan los nombres de cuenta del plan, para reconocer lo que ya está bien imputado
 */
export function decidirPropagacion(
  movimientos: Array<MovimientoAPropagar & { schema: string; tabla: string }>,
  cuentasDelPlan: string[],
): DecisionDePropagacion[] {
  const plan = new Set(cuentasDelPlan.map(c => c.trim().toLowerCase()).filter(Boolean))
  return movimientos.map(m => {
    const categ = m.categ ?? null
    if (esCategProvisoria(categ)) {
      return {
        schema: m.schema, tabla: m.tabla, movimientoId: m.id, categAnterior: categ,
        seEscribe: true, motivo: "estaba vacío o provisorio",
      }
    }
    if (plan.has((categ ?? "").trim().toLowerCase())) {
      return {
        schema: m.schema, tabla: m.tabla, movimientoId: m.id, categAnterior: categ,
        seEscribe: true, motivo: "tenía una cuenta del plan",
      }
    }
    return {
      schema: m.schema, tabla: m.tabla, movimientoId: m.id, categAnterior: categ,
      seEscribe: false, motivo: "tenía una clasificación de otro sistema",
    }
  })
}

/** Lo mínimo que hace falta de un cliente de Supabase. Así la función se puede probar y reusar. */
export interface ClienteParaPropagar {
  from: (tabla: string) => any
  schema: (s: string) => { from: (tabla: string) => any }
}

/**
 * 🔗 Propaga la cuenta contable de una o varias facturas a **todos** sus movimientos.
 *
 * @param db          cliente de Supabase (el del navegador o el de servicio)
 * @param facturaIds  los comprobantes que se acaban de imputar
 * @param cuenta      `{ cuenta_contable, nro_cuenta }`. **`null` en los dos = DESASIGNAR**
 * @param cuentasDelPlan nombres del plan, para distinguir lo imputado de lo de otro sistema
 *
 * 🔑 **Corre también al DESASIGNAR** (hueco 3 de A-BUG-1221): antes la propagación vivía dentro de un
 * `if (cuenta_contable)`, así que al quitarle la cuenta a una factura **el movimiento se quedaba con
 * la vieja** — imputado a una cuenta que la factura ya no tiene.
 */
export async function propagarCuentaAMovimientos(
  db: ClienteParaPropagar,
  facturaIds: string[],
  cuenta: { cuenta_contable: string | null; nro_cuenta: string | null },
  cuentasDelPlan: string[],
): Promise<ResultadoPropagacion> {
  const salteados: DecisionDePropagacion[] = []
  const fallaron: ResultadoPropagacion["fallaron"] = []
  const decisiones: DecisionDePropagacion[] = []
  let propagados = 0

  if (facturaIds.length === 0) return { propagados, salteados, fallaron, decisiones }

  const desasignar = cuenta.cuenta_contable == null && cuenta.nro_cuenta == null

  for (const t of TABLAS_CON_VINCULO_ARCA) {
    const q = t.schema === "public" ? db.from(t.tabla) : db.schema(t.schema).from(t.tabla)

    // 1 · Primero se MIRA lo que hay. Sin esto no se puede decidir si pisar o no.
    const { data, error } = await q
      .select(`id, categ, nro_cuenta`)
      .in(COLUMNA_VINCULO_ARCA, facturaIds)
    if (error) { fallaron.push({ schema: t.schema, tabla: t.tabla, error: error.message }); continue }

    const filas = (data ?? []) as MovimientoAPropagar[]
    if (filas.length === 0) continue

    /**
     * Al **desasignar** no hay nada que decidir: se limpia lo que esta propagación había puesto, y
     * sólo donde la `categ` era una cuenta del plan o un provisorio — una clasificación de otro
     * sistema no se borra nunca.
     */
    const decs = decidirPropagacion(
      filas.map(f => ({ ...f, schema: t.schema, tabla: t.tabla })), cuentasDelPlan)
    decisiones.push(...decs)

    const aEscribir = decs.filter(d => d.seEscribe).map(d => d.movimientoId)
    salteados.push(...decs.filter(d => !d.seEscribe))
    if (aEscribir.length === 0) continue

    // 2 · Y recién ahí se escribe, sólo sobre los que se decidió.
    const qEscritura = t.schema === "public" ? db.from(t.tabla) : db.schema(t.schema).from(t.tabla)
    const { error: errUp } = await qEscritura
      .update(desasignar
        ? { categ: null, nro_cuenta: null }
        : { categ: cuenta.cuenta_contable, nro_cuenta: cuenta.nro_cuenta })
      .in("id", aEscribir)
    if (errUp) { fallaron.push({ schema: t.schema, tabla: t.tabla, error: errUp.message }); continue }
    propagados += aEscribir.length
  }

  return { propagados, salteados, fallaron, decisiones }
}

/**
 * 🔢 **Cuántos movimientos tiene enganchados una factura, en las DIEZ tablas.**
 *
 * 🧨 **Es el cuarto lugar donde la lista estaba escrita a mano — y el peor de los cuatro.** El chequeo
 * de dependencias de una factura (antes de editarla o borrarla) miraba **4 tablas**: los tres
 * extractos de MSA/PAM y el de MA. Le faltaban **las 3 tarjetas y las 3 cajas**, y
 * `msa.tarjeta_visa_business` **ya tiene 7 movimientos enganchados**.
 *
 * ⚠️ **Por qué es el peor**: acá una omisión no deja un dato viejo, **deja pasar un borrado**. La
 * pantalla concluía *«esta factura no tiene conciliaciones»* teniendo movimientos de tarjeta colgados.
 */
export async function contarMovimientosDeFactura(
  db: ClienteParaPropagar,
  facturaId: string,
): Promise<{ total: number; porTabla: Array<{ schema: string; tabla: string; que: string; n: number }>; fallaron: string[] }> {
  const porTabla: Array<{ schema: string; tabla: string; que: string; n: number }> = []
  const fallaron: string[] = []
  let total = 0

  for (const t of TABLAS_CON_VINCULO_ARCA) {
    const q = t.schema === "public" ? db.from(t.tabla) : db.schema(t.schema).from(t.tabla)
    const { data, error } = await q.select("id").eq(COLUMNA_VINCULO_ARCA, facturaId)
    if (error) {
      // 🛑 Una tabla que no se pudo leer NO se cuenta como cero: eso dejaría pasar un borrado.
      fallaron.push(t.tabla)
      continue
    }
    const n = (data ?? []).length
    if (n > 0) { porTabla.push({ schema: t.schema, tabla: t.tabla, que: t.que, n }); total += n }
  }
  return { total, porTabla, fallaron }
}

/**
 * El texto para mostrarle al usuario. `null` = no hay nada que decir (propagó todo o no había nada).
 *
 * 📌 Se arma acá y no en cada pantalla para que las cuatro digan lo mismo.
 */
export function avisoDePropagacion(r: ResultadoPropagacion): string | null {
  const partes: string[] = []
  if (r.fallaron.length > 0) {
    partes.push(`no se pudo propagar a ${r.fallaron.map(f => f.tabla).join(", ")}`)
  }
  if (r.salteados.length > 0) {
    const cuales = [...new Set(r.salteados.map(s => s.categAnterior ?? "(vacío)"))]
    partes.push(
      `${r.salteados.length} movimiento(s) NO se tocaron porque ya están clasificados en otro `
      + `sistema (${cuales.join(", ")}): hay que decidirlos a mano`)
  }
  if (partes.length === 0) return null
  return `${r.propagados} movimiento(s) actualizados, pero ${partes.join(" · ")}.`
}
