/**
 * 📄 Resumen PDF de CAJA DE AHORRO del Galicia → la misma planilla que el Excel del banco — A-FEAT-1352.
 *
 * ## Para qué
 * Galicia no deja bajar movimientos viejos: si el Excel no se descargó a tiempo, lo único que queda
 * es el resumen mensual en PDF. Decisión del usuario (2026-10-24): **un adaptador dentro del
 * importador** — el PDF se convierte a las mismas filas que trae el Excel y entra por el camino de
 * siempre, para que las reglas de parseo lo reconozcan sin tocar nada.
 *
 * ## En qué difiere el PDF del Excel (medido sobre MA abril y mayo 2026 contra lo cargado por Excel)
 * | Dato | PDF | Excel |
 * |---|---|---|
 * | tarjeta | completa `4517699027757829` | enmascarada `4517XXXXXXXXXX29` |
 * | origen | columna propia `0279` | última línea `A279` (`C` en extracciones por sucursal) |
 * | tarjeta en transferencias | antes de `VARIOS` | al final |
 * | CUIT rotulado | `CU 2014…` | `CU  2014…` (dos espacios) |
 * | CBU | **cortado a 20 dígitos** | 22 |
 * | nombres | **cortados a 20 letras** | completos (salvo en compras, donde el banco también corta) |
 *
 * Lo cortado se completa **sólo con un candidato único** de lo ya conocido (decisión del usuario
 * 2026-10-24); si no hay, queda como viene y se avisa. Un CBU que no se pudo completar se toma
 * igual como CBU (incompleto): ver `esCbu` en `parseo-movimiento.ts`.
 *
 * Todo lo de este archivo es puro (sin base ni PDF): lo prueban los casos de `lib/pruebas/casos.ts`.
 */

import { agruparRenglones, type TextoUbicado } from "@/lib/polizas/renglones-pdf"

export interface MovimientoPdfCA {
  /** YYYY-MM-DD */
  fecha: string
  /** Renglones de la columna Descripción, tal como vienen: el primero es el tipo. */
  lineas: string[]
  /** Columna Origen (`0279`), o null si no trae. */
  origen: string | null
  credito: number
  /** Positivo (el PDF lo trae con signo menos). */
  debito: number
  saldo: number | null
  pagina: number
}

export interface ResumenPdfCA {
  numeroCuenta: string | null
  cbu: string | null
  /** «CUIT del Responsable Impositivo», sin guiones. Dice de quién es la cuenta. */
  cuitTitular: string | null
  /** YYYY-MM-DD */
  desde: string | null
  hasta: string | null
  saldoInicial: number | null
  saldoFinal: number | null
  /** El renglón «Total» del final del resumen. */
  totales: { creditos: number; debitos: number; saldo: number } | null
  movimientos: MovimientoPdfCA[]
  /** Lo que no se pudo leer bien. Nunca se descarta en silencio. */
  avisos: string[]
}

// 💵 A-FEAT-1424: la caja de ahorro en DÓLARES imprime «USD 1.000,00» / «-USD 140.000,00» donde la de pesos pone «$».
const RE_IMPORTE = /^-?\s*(?:\$|USD)?\s*-?\d{1,3}(?:\.\d{3})*,\d{2}$/
const RE_FECHA_CORTA = /^(\d{2})\/(\d{2})\/(\d{2})$/
const RE_FECHA_LARGA = /^(\d{2})\/(\d{2})\/(\d{4})$/

/** `-$ 5.366.252,36` → -5366252.36 · `-USD 140.000,00` → -140000 */
export function importeDelPdf(s: string): number {
  const t = s.replace(/\s/g, "").replace(/USD/gi, "")
  const negativo = t.includes("-")
  const n = parseFloat(t.replace(/[-$]/g, "").replace(/\./g, "").replace(",", "."))
  if (isNaN(n)) return 0
  return negativo ? -n : n
}

function fechaIso(s: string): string | null {
  const c = s.match(RE_FECHA_CORTA)
  if (c) return `20${c[3]}-${c[2]}-${c[1]}`
  const l = s.match(RE_FECHA_LARGA)
  if (l) return `${l[3]}-${l[2]}-${l[1]}`
  return null
}

const r2 = (n: number) => Math.round(n * 100) / 100

interface Columnas { fecha: number; descripcion: number; origen: number; credito: number; debito: number; saldo: number }

/** El renglón de títulos de la tabla de movimientos, si éste lo es. */
function columnasDe(items: TextoUbicado[]): Columnas | null {
  const x = (re: RegExp) => items.find(i => re.test(i.s.trim()))?.x
  const fecha = x(/^Fecha$/i), descripcion = x(/^Descripci[oó]n$/i), origen = x(/^Origen$/i)
  const credito = x(/^Cr[eé]dito$/i), debito = x(/^D[eé]bito$/i), saldo = x(/^Saldo$/i)
  if ([fecha, descripcion, credito, debito, saldo].some(v => v === undefined)) return null
  return {
    fecha: fecha!, descripcion: descripcion!, origen: origen ?? (descripcion! + credito!) / 2,
    credito: credito!, debito: debito!, saldo: saldo!,
  }
}

/**
 * Pura: los textos ubicados de cada página → el resumen leído.
 *
 * Cómo distingue las columnas: con el renglón de títulos de **cada página** (de un resumen a otro
 * el banco mueve todo — abril tiene «Saldo» en x=499 y mayo en x=542). El saldo es el importe que
 * cae del medio entre «Débito» y «Saldo» para la derecha; el otro importe del renglón va a débito
 * si viene con signo menos y a crédito si no, y se avisa si el signo contradice la columna.
 */
export function leerResumenCajaAhorro(paginas: TextoUbicado[][]): ResumenPdfCA {
  const res: ResumenPdfCA = {
    numeroCuenta: null, cbu: null, cuitTitular: null, desde: null, hasta: null,
    saldoInicial: null, saldoFinal: null, totales: null, movimientos: [], avisos: [],
  }
  let actual: MovimientoPdfCA | null = null
  let terminado = false

  paginas.forEach((items, ip) => {
    if (terminado) return
    const renglones = agruparRenglones(items)
    let cols: Columnas | null = null

    for (const r of renglones) {
      const textos = r.items.map(i => i.s.trim())

      if (!cols) {
        cols = columnasDe(r.items)
        if (cols) continue
        // Cabecera (sólo antes de la primera tabla): cuenta, CBU, período y saldos
        if (ip === 0) {
          for (const t of textos) {
            if (!res.cbu && /^\d{22}$/.test(t)) res.cbu = t
            const cuit = t.match(/CUIT[^:]*:\s*(\d{2}-?\d{8}-?\d)/i)
            if (!res.cuitTitular && cuit) res.cuitTitular = cuit[1].replace(/-/g, "")
            if (!res.numeroCuenta && /^N°\s*\d/.test(t)) res.numeroCuenta = t.replace(/^N°\s*/, "")
            if (RE_FECHA_LARGA.test(t)) {
              if (!res.desde) res.desde = fechaIso(t)
              else if (!res.hasta) res.hasta = fechaIso(t)
            }
            if (/^(?:\$|USD)\s*-?\d/.test(t) && RE_IMPORTE.test(t)) {
              if (res.saldoInicial === null) res.saldoInicial = importeDelPdf(t)
              else if (res.saldoFinal === null) res.saldoFinal = importeDelPdf(t)
            }
          }
        }
        continue
      }

      // Pie de página: se termina la tabla de esta página
      if (textos.some(t => /^P[aá]gina$/i.test(t)) || /^Resumen de Caja/i.test(textos[0] ?? "")) break

      // El renglón «Total»: cierra el resumen
      if (textos.some(t => /^Total$/i.test(t))) {
        const imp = r.items.filter(i => RE_IMPORTE.test(i.s.trim())).map(i => importeDelPdf(i.s))
        if (imp.length === 3) res.totales = { creditos: Math.abs(imp[0]), debitos: Math.abs(imp[1]), saldo: imp[2] }
        else res.avisos.push(`El renglón «Total» no trae los tres importes (créditos, débitos, saldo): «${textos.join(" ")}».`)
        terminado = true
        break
      }

      const primero = r.items[0]
      const esInicio = primero && RE_FECHA_CORTA.test(primero.s.trim()) && primero.x < cols.descripcion - 2
      // La descripción ocupa desde su título hasta el de «Origen» (los textos se miden por dónde empiezan)
      const limiteTexto = cols.origen - 4
      const medioDebSaldo = (cols.debito + cols.saldo) / 2
      const medioCredDeb = (cols.credito + cols.debito) / 2

      if (esInicio) {
        const desc = r.items.filter(i => i !== primero && i.x >= cols!.descripcion - 4 && i.x < limiteTexto).map(i => i.s.trim())
        const origen = r.items.find(i => i.x >= limiteTexto && i.x < cols!.credito - 20 && /^\d{3,4}$/.test(i.s.trim()))
        const importes = r.items.filter(i => i !== primero && RE_IMPORTE.test(i.s.trim()))
        const saldoIt = importes.filter(i => i.x >= medioDebSaldo)
        const otros = importes.filter(i => i.x < medioDebSaldo)
        const fecha = fechaIso(primero.s.trim())!
        actual = {
          fecha, lineas: desc.length ? [desc.join(" ")] : [], origen: origen ? origen.s.trim() : null,
          credito: 0, debito: 0, saldo: saldoIt.length === 1 ? importeDelPdf(saldoIt[0].s) : null, pagina: ip + 1,
        }
        if (saldoIt.length !== 1) res.avisos.push(`${fecha} «${desc.join(" ")}»: no se pudo leer el saldo del renglón.`)
        if (otros.length !== 1) {
          res.avisos.push(`${fecha} «${desc.join(" ")}»: se esperaba un importe y se leyeron ${otros.length}.`)
        }
        for (const o of otros.slice(0, 1)) {
          const v = importeDelPdf(o.s)
          const porColumna = o.x < medioCredDeb ? "credito" : "debito"
          const porSigno = v < 0 ? "debito" : "credito"
          if (porColumna !== porSigno) {
            res.avisos.push(`${fecha} «${desc.join(" ")}»: el importe ${o.s.trim()} está en la columna de ${porColumna === "credito" ? "créditos" : "débitos"} pero su signo dice ${porSigno === "credito" ? "crédito" : "débito"}; se tomó el signo.`)
          }
          if (porSigno === "debito") actual.debito = r2(Math.abs(v))
          else actual.credito = r2(Math.abs(v))
        }
        res.movimientos.push(actual)
        continue
      }

      // Renglón de continuación: más líneas de la descripción del movimiento en curso
      // (puede venir arriba de una página nueva, si el movimiento quedó partido)
      const texto = r.items.filter(i => i.x >= cols!.descripcion - 4 && i.x < limiteTexto).map(i => i.s.trim()).join(" ")
      if (!texto) continue
      if (actual) actual.lineas.push(texto)
      else res.avisos.push(`Página ${ip + 1}: texto suelto antes del primer movimiento, ignorado: «${texto}».`)
    }
  })

  if (!res.totales) res.avisos.push("No se encontró el renglón «Total» del resumen: no se pueden controlar los totales.")
  return res
}

// ─────────────────────────────────────────────────────────────────────────────
// El control: el resumen tiene que cerrar contra sí mismo
// ─────────────────────────────────────────────────────────────────────────────

export interface ControlResumenPdf {
  /** true = la lectura cierra contra lo que el propio resumen imprime. */
  ok: boolean
  renglones: { que: string; segunResumen: number | null; leido: number; ok: boolean }[]
  /** Movimientos donde saldo anterior + crédito − débito no da el saldo impreso. */
  cadenaRota: { fecha: string; tipo: string; esperado: number; impreso: number | null }[]
}

/**
 * 🛑 Control de INTEGRIDAD (frena): lo leído tiene que dar lo que el resumen imprime — la suma de
 * créditos y débitos contra el renglón «Total», y el saldo fila a fila desde el saldo inicial.
 * Si no cierra, **el lector leyó mal** (no hay explicación de negocio posible): § 🚦 de CLAUDE.md.
 */
export function controlarResumen(res: ResumenPdfCA): ControlResumenPdf {
  const tol = 0.01
  const sumaCred = r2(res.movimientos.reduce((a, m) => a + m.credito, 0))
  const sumaDeb = r2(res.movimientos.reduce((a, m) => a + m.debito, 0))
  const ultimo = res.movimientos[res.movimientos.length - 1]?.saldo ?? null
  const cadenaRota: ControlResumenPdf["cadenaRota"] = []
  let saldo = res.saldoInicial
  for (const m of res.movimientos) {
    if (saldo !== null) {
      const esperado = r2(saldo + m.credito - m.debito)
      if (m.saldo === null || Math.abs(esperado - m.saldo) > tol) {
        cadenaRota.push({ fecha: m.fecha, tipo: m.lineas[0] ?? "", esperado, impreso: m.saldo })
      }
    }
    saldo = m.saldo ?? (saldo === null ? null : r2(saldo + m.credito - m.debito))
  }
  const fila = (que: string, segunResumen: number | null, leido: number) =>
    ({ que, segunResumen, leido, ok: segunResumen !== null && Math.abs(segunResumen - leido) <= tol })
  const renglones = [
    fila("Total de créditos", res.totales?.creditos ?? null, sumaCred),
    fila("Total de débitos", res.totales?.debitos ?? null, sumaDeb),
    fila("Saldo final (cabecera)", res.saldoFinal, ultimo ?? NaN),
    fila("Saldo final (renglón Total)", res.totales?.saldo ?? null, ultimo ?? NaN),
  ]
  return { ok: renglones.every(r => r.ok) && cadenaRota.length === 0 && res.movimientos.length > 0, renglones, cadenaRota }
}

// ─────────────────────────────────────────────────────────────────────────────
// El adaptador: cada movimiento → el texto que habría traído el Excel
// ─────────────────────────────────────────────────────────────────────────────

export type TipoCambio = "tarjeta" | "orden_tarjeta" | "origen" | "origen_supuesto" | "cuit" | "cbu_completado" | "cbu_incompleto" | "nombre_completado"

export interface CambioAdaptacion { tipo: TipoCambio; de: string; a: string }

/** Lo ya conocido, para completar lo que el PDF corta. Se arma con `armarConocido`. */
export interface Conocido {
  /** Letra del origen por tipo de movimiento (`COMPRA DEBITO` → `A`). */
  letraOrigen: Record<string, string>
  /** Renglones (no el primero) de los extractos ya cargados de la cuenta. */
  lineas: Set<string>
  /** CBU completos conocidos, con el CUIT de su dueño si se sabe. */
  cbus: { cbu: string; cuit: string | null }[]
}

/** Letra del origen cuando el tipo nunca vino con origen en esta cuenta. */
const LETRA_POR_DEFECTO: { re: RegExp; letra: string }[] = [
  { re: /^EXTRACCION EN AUTOSERVICIO/i, letra: "C" },
]

/**
 * Pura: lo ya cargado de la cuenta (el texto crudo de cada movimiento) y los CBU del maestro de
 * proveedores → lo que el adaptador necesita para completar.
 */
export function armarConocido(conceptos: (string | null)[], cbusProveedores: { cbu: string | null; cuit: string | null }[]): Conocido {
  const letras: Record<string, Set<string>> = {}
  const lineas = new Set<string>()
  const cbus = new Map<string, string | null>()
  for (const c of conceptos) {
    const ls = String(c ?? "").split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean)
    if (ls.length < 2) continue
    const u = ls[ls.length - 1]
    if (/^[A-Z]\d{3}$/.test(u)) (letras[ls[0].toUpperCase()] ??= new Set()).add(u[0])
    let cuit: string | null = null
    for (const l of ls.slice(1)) {
      lineas.add(l)
      const mc = l.replace(/^(CU|NO)\s+/, "").match(/^\d{11}$/)
      if (mc) cuit = mc[0]
      if (/^\d{22}$/.test(l) && !cbus.has(l)) cbus.set(l, cuit)
    }
  }
  for (const p of cbusProveedores) {
    const cbu = String(p.cbu ?? "").replace(/\D/g, "")
    if (cbu.length === 22 && !cbus.get(cbu)) cbus.set(cbu, p.cuit ? String(p.cuit).replace(/\D/g, "") : null)
  }
  const letraOrigen: Record<string, string> = {}
  for (const [tipo, set] of Object.entries(letras)) if (set.size === 1) letraOrigen[tipo] = [...set][0]
  return { letraOrigen, lineas, cbus: [...cbus.entries()].map(([cbu, cuit]) => ({ cbu, cuit })) }
}

/** Tarjeta completa → como la escribe el Excel: 4 primeros, 10 X, 2 últimos. */
export function enmascararTarjeta(t: string): string {
  return t.slice(0, 4) + "X".repeat(t.length - 6) + t.slice(-2)
}

/**
 * Pura: un movimiento del PDF → el texto de la celda «Movimiento» del Excel, con la lista de lo
 * que se cambió (la huella de la adaptación, que el importador muestra).
 */
export function adaptarMovimiento(mov: MovimientoPdfCA, conocido: Conocido): { texto: string; cambios: CambioAdaptacion[] } {
  const cambios: CambioAdaptacion[] = []
  const [tipo = "", ...resto] = mov.lineas.map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean)
  const cuitDelMov = resto.map(l => l.replace(/^(CU|NO)\s+/, "")).find(l => /^\d{11}$/.test(l)) ?? null

  const lineas: string[] = []
  const tarjetas: string[] = []
  for (const l of resto) {
    if (/^\d{16}$/.test(l)) {
      const m = enmascararTarjeta(l)
      cambios.push({ tipo: "tarjeta", de: l, a: m })
      tarjetas.push(m)
      continue
    }
    const rot = l.match(/^(CU|NO) (\d{11})$/)
    if (rot) {
      lineas.push(`${rot[1]}  ${rot[2]}`)
      continue
    }
    if (/^\d{20}$/.test(l)) {
      const cand = conocido.cbus.filter(c => c.cbu.startsWith(l))
      const delMismo = cuitDelMov ? cand.filter(c => c.cuit === cuitDelMov) : []
      const elegido = delMismo.length === 1 ? delMismo[0] : cand.length === 1 ? cand[0] : null
      if (elegido) { cambios.push({ tipo: "cbu_completado", de: l, a: elegido.cbu }); lineas.push(elegido.cbu) }
      else { cambios.push({ tipo: "cbu_incompleto", de: l, a: l }); lineas.push(l) }
      continue
    }
    if (l.length === 20 && !/^\d+$/.test(l) && !conocido.lineas.has(l)) {
      const cand = [...conocido.lineas].filter(k => k.length > 20 && k.startsWith(l))
      if (cand.length === 1) { cambios.push({ tipo: "nombre_completado", de: l, a: cand[0] }); lineas.push(cand[0]); continue }
    }
    lineas.push(l)
  }
  // En el Excel la tarjeta va al final (en las transferencias el PDF la pone antes de «VARIOS»)
  if (tarjetas.length && resto.length && !/^\d{16}$/.test(resto[resto.length - 1])) {
    cambios.push({ tipo: "orden_tarjeta", de: "antes del final", a: "al final" })
  }
  lineas.push(...tarjetas)

  if (mov.origen) {
    const clave = tipo.toUpperCase()
    let letra = conocido.letraOrigen[clave]
    let supuesta = false
    if (!letra) { letra = LETRA_POR_DEFECTO.find(d => d.re.test(tipo))?.letra ?? "A"; supuesta = true }
    const cod = letra + mov.origen.slice(-3)
    cambios.push({ tipo: supuesta ? "origen_supuesto" : "origen", de: mov.origen, a: cod })
    lineas.push(cod)
  }

  return { texto: [tipo, ...lineas].join("\r\n "), cambios }
}

/** Fila con las columnas del Excel del banco (lo que espera el importador de caja de ahorro). */
export interface FilaComoExcel { fecha: string; movimiento: string; debito: number; credito: number; saldo: number | null; cambios: CambioAdaptacion[]; pdf: string[] }

/** Pura: el resumen leído → las filas del Excel, de la más vieja a la más nueva. */
export function resumenComoExcel(res: ResumenPdfCA, conocido: Conocido): FilaComoExcel[] {
  return res.movimientos.map(m => {
    const { texto, cambios } = adaptarMovimiento(m, conocido)
    return { fecha: m.fecha, movimiento: texto, debito: m.debito, credito: m.credito, saldo: m.saldo, cambios, pdf: m.lineas }
  })
}
