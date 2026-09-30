/**
 * 🏦 **Control de los papeles 7, 8 y 9 del balance** — bancos, gastos bancarios y retiros.
 *
 * Corre la misma lógica que el export contra la base y la imprime, para poder ver los números sin
 * bajar el Excel. Es también donde se ve **lo que quedó sin clasificar**, que es el trabajo que falta
 * en el plan de cuentas.
 *
 * 🔴 **SÓLO LEE.** § 🛑 Datos.
 *
 * ```
 * npx tsx scripts/verificar-papeles-bancarios.mts            # MSA, cierre 2026
 * npx tsx scripts/verificar-papeles-bancarios.mts MSA 2026
 * ```
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import {
  mesesDelEjercicio, armarGastosBancarios, armarFondosComunes, armarRetirosYAportes,
  esFCI, CUENTAS_DEL_EXTRACTO, type MovimientoExtracto, type CuentaDelPlan,
} from "../lib/balance/papeles-bancarios"
import {
  armarCadenaDeSaldos, saldoAlInicioDe, type CadenaDeSaldos,
} from "../lib/balance/saldos-al-inicio"
import { armarEjercicio } from "../lib/balance/ejercicio"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
    }),
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}
const sb = createClient(url, key)
const pesos = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2 })

/**
 * El mes de cierre de cada empresa. **Las cuentas salen de `CUENTAS_DEL_EXTRACTO`**, la misma lista
 * que usa el Excel: si el control mirara otras cuentas, los números no coincidirían y no se sabría
 * a cuál creerle.
 */
const MES_CIERRE: Record<string, number> = { MSA: 6, PAM: 12, MA: 12 }

const empresaId = (process.argv[2] || "MSA").toUpperCase()
const anioCierre = Number(process.argv[3] || 2026)
const empresa = MES_CIERRE[empresaId]
  ? { mesCierre: MES_CIERRE[empresaId], tablas: CUENTAS_DEL_EXTRACTO[empresaId] } : undefined
if (!empresa) { console.error(`❌ Empresa desconocida: ${empresaId}`); process.exit(1) }

const meses = mesesDelEjercicio(anioCierre, empresa.mesCierre)
const desde = `${meses[0]}-01`
const [aa, mm] = meses[11].split("-").map(Number)
const hasta = new Date(Date.UTC(aa, mm, 0)).toISOString().slice(0, 10)
/**
 * La etiqueta del ejercicio, como la arma `armarEjercicio`: `25/26`. Es la clave con la que se
 * busca el saldo al inicio declarado, así que tiene que salir igual que en el export.
 */
const etiquetaEjercicio = armarEjercicio(anioCierre, empresa.mesCierre).etiqueta

console.log(`\n🏦 PAPELES BANCARIOS · ${empresaId} · ejercicio ${desde} → ${hasta}`)

const { data: plan } = await sb.from("cuentas_contables")
  .select("nro_cuenta, cuenta_contable, nombre_totalizadora, tipo")
const cuentas = (plan ?? []) as CuentaDelPlan[]

/** Se traen los movimientos de todas las cuentas de la empresa, marcando de dónde salió cada uno. */
const movimientos: Array<MovimientoExtracto & { donde: string }> = []
const saldosAlCierre: Array<{ nombre: string; saldo: number | null; fecha: string | null }> = []
/** 🏦 La cadena inicio → cierre de cada cuenta, con su control (A-FEAT-1206). */
const cadenas: CadenaDeSaldos[] = []

for (const t of empresa.tablas) {
  const q = t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)
  const { data, error } = await q
    // 🧨 `orden` es la posición dentro del día. Sin ella el saldo al cierre sale de cualquier
    //    movimiento del 30/06 → A-BUG-1224. El Presupuesto ya lo pedía así; este script no.
    .select("fecha, descripcion, categ, nro_cuenta, debitos, creditos, saldo, orden")
    .gte("fecha", desde).lte("fecha", hasta)
    .order("fecha", { ascending: true }).order("orden", { ascending: true })
  if (error) {
    // No se corta: una cuenta que no se puede leer no puede tapar a las otras. Se dice y sigue.
    console.log(`\n⚠️  ${t.nombre}: no se pudo leer — ${error.message}`)
    saldosAlCierre.push({ nombre: t.nombre, saldo: null, fecha: null })
    continue
  }
  const filas = (data ?? []) as MovimientoExtracto[]
  filas.forEach(f => movimientos.push({ ...f, donde: t.nombre }))
  /**
   * 🧮 El saldo al cierre y la cadena que lo explica salen del **mismo** lugar que en el export, así
   * que la consola y el Excel no pueden discrepar. Ver `lib/balance/saldos-al-inicio.ts`.
   */
  const cadena = armarCadenaDeSaldos(
    t.nombre, filas, saldoAlInicioDe(empresaId, etiquetaEjercicio, t.nombre))
  cadenas.push(cadena)
  saldosAlCierre.push({ nombre: t.nombre, saldo: cadena.saldoAlCierre, fecha: cadena.hasta })
}

// ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n══════ PAPEL 7 · SALDOS AL CIERRE ══════`)
console.log("  (el saldo del último movimiento del ejercicio en cada cuenta)")
for (const s of saldosAlCierre) {
  if (s.saldo == null) { console.log(`  ${s.nombre.padEnd(34)} — sin saldo en el período`); continue }
  console.log(`  ${s.nombre.padEnd(34)} $ ${pesos(s.saldo).padStart(18)}   (al ${s.fecha})`)
}

// ══════════════════════════════════════════════════════════════════════════════════
// 🧮 LA CADENA: el saldo al cierre reconstruido desde el saldo al inicio (A-FEAT-1206).
console.log(`
══════ PAPEL 7.1 · LA CADENA DEL EJERCICIO ══════`)
for (const c of cadenas) {
  console.log(`
  ${c.cuenta}  (${c.movimientos} movimiento(s), ${c.desde ?? "—"} → ${c.hasta ?? "—"})`)
  if (c.movimientos === 0) { console.log("     sin movimientos en el ejercicio: no se puede armar"); continue }
  console.log(`     saldo al inicio            ${c.saldoInicio == null ? "NO SE CONOCE" : "$ " + pesos(c.saldoInicio)}`)
  if (c.netoNoCargado != null) console.log(`     + meses NO cargados        $ ${pesos(c.netoNoCargado)}`)
  console.log(`     = al arrancar lo cargado   ${c.saldoAntesDeLoCargado == null ? "—" : "$ " + pesos(c.saldoAntesDeLoCargado)}`)
  console.log(`     + neto de lo cargado       $ ${pesos(c.netoCargado)}`)
  console.log(`     = cierre calculado         ${c.cierreCalculado == null ? "—" : "$ " + pesos(c.cierreCalculado)}`)
  console.log(`       saldo del extracto       ${c.saldoAlCierre == null ? "—" : "$ " + pesos(c.saldoAlCierre)}`)
  if (c.diferencia == null) console.log("     ⚠️  no se puede controlar")
  else if (Math.abs(c.diferencia) <= 0.01) console.log("     ✓ CIERRA")
  else {
    console.log(`     ⚠️  NO CIERRA — diferencia $ ${pesos(c.diferencia)}`)
    // 🔍 Un salto = falta un movimiento. Muchos que se compensan = el orden esta mal.
    console.log(c.saltos <= 1
      ? "        parece faltar (o sobrar) UN movimiento: la plata esta ahi"
      : `        el ORDEN no sigue a los saldos (${c.saltos} saltos que suman $ ${pesos(c.sumaDeSaltos)}):`
        + " NO falta plata, lo que no sirve es el orden")
  }
  if (c.fuenteInicio) console.log(`     saldo al inicio: ${c.fuenteInicio}`)
}

// ── Fondos comunes ─────────────────────────────────────────────────────────────────
const movFCI = movimientos.filter(esFCI)
console.log(`\n══════ PAPEL 7 · FONDOS COMUNES DE INVERSIÓN ══════`)
if (movFCI.length === 0) {
  console.log("  (sin movimientos de FCI en el período)")
} else {
  /**
   * ⚠️ El **saldo del fondo** no está en el extracto: el extracto ve la plata que sale y entra de la
   * cuenta, no cuánto quedó invertido. Se pide al usuario. Sin ese dato el resultado financiero no
   * se puede calcular, y **eso se dice** en vez de mostrar un cero que parecería un resultado.
   */
  const { fondos, total } = armarFondosComunes(movFCI, {}, {})
  for (const f of fondos) {
    console.log(`  ▸ ${f.donde}   (${f.movimientos} movimientos)`)
    console.log(`      suscripciones  $ ${pesos(f.suscripciones).padStart(18)}`)
    console.log(`      rescates       $ ${pesos(f.rescates).padStart(18)}`)
    console.log(`      neto invertido $ ${pesos(f.suscripciones - f.rescates).padStart(18)}`)
  }
  console.log(`  ${"─".repeat(56)}`)
  console.log(`  TOTAL   suscripciones $ ${pesos(total.suscripciones)}   rescates $ ${pesos(total.rescates)}`)
  console.log("  ⚠️ FALTA el saldo del fondo al inicio y al cierre — no está en el extracto.")
  console.log("     Sin esos dos números no se puede calcular el RESULTADO FINANCIERO del fondo.")
}

// ══════════════════════════════════════════════════════════════════════════════════
const gastos = armarGastosBancarios(movimientos, cuentas, meses)
console.log(`\n══════ PAPEL 8 · GASTOS BANCARIOS E IMPUESTOS, por mes ══════`)
if (gastos.filas.length === 0) {
  console.log("  (no se reconoció ningún gasto bancario — ver lo sin clasificar)")
} else {
  console.log(`  ${"concepto".padEnd(34)} ${"débitos".padStart(15)} ${"créditos".padStart(14)}  movs`)
  for (const t of ["IMPUESTOS BANCARIOS", "GASTOS BANCARIOS"]) {
    const dela = gastos.filas.filter(f => f.totalizadora === t)
    if (dela.length === 0) continue
    console.log(`\n  ── ${t} ──`)
    dela.forEach(f => console.log(
      `  ${f.concepto.slice(0, 34).padEnd(34)} $ ${pesos(f.totalDebitos).padStart(13)} $ ${pesos(f.totalCreditos).padStart(12)}  ${String(f.movimientos).padStart(4)}`,
    ))
    const s = gastos.subtotales.find(s => s.totalizadora === t)
    if (s) console.log(`  ${("Total " + t).padEnd(34)} $ ${pesos(s.totalDebitos).padStart(13)} $ ${pesos(s.totalCreditos).padStart(12)}`)
  }
  console.log(`\n  ${"TOTAL DEL EJERCICIO".padEnd(34)} $ ${pesos(gastos.total.totalDebitos).padStart(13)} $ ${pesos(gastos.total.totalCreditos).padStart(12)}`)
  console.log("\n  Por mes (débitos):")
  meses.forEach((m, i) => console.log(`    ${m}  $ ${pesos(gastos.total.debitos[i]).padStart(14)}`))
}
if (gastos.sinClasificar.length > 0) {
  console.log(`\n  🛑 PARECEN BANCARIOS Y NO ESTÁN EN EL PLAN DE CUENTAS (${gastos.sinClasificar.length}):`)
  gastos.sinClasificar.forEach(s => console.log(
    `     ${s.categ.slice(0, 40).padEnd(40)} $ ${pesos(s.debitos).padStart(13)}  (${s.movimientos} movs)`,
  ))
  console.log("     → hay que darles cuenta contable, o el papel los deja afuera.")
}

// ══════════════════════════════════════════════════════════════════════════════════
const retiros = armarRetirosYAportes(movimientos, meses)
console.log(`\n══════ PAPEL 9 · RETIROS Y APORTES ══════`)
if (retiros.filas.length === 0) {
  console.log("  (no se reconoció ningún retiro ni aporte)")
} else {
  retiros.filas.forEach(f => console.log(
    `  ${f.etiqueta.padEnd(30)} $ ${pesos(f.total).padStart(16)}   (${f.movimientos} movs)`,
  ))
  console.log(`  ${"─".repeat(54)}`)
  console.log(`  ${"APORTES − RETIROS".padEnd(30)} $ ${pesos(retiros.neto.total).padStart(16)}`)
}
if (retiros.sinReconocer.length > 0) {
  console.log(`\n  🛑 PARECEN RETIRO O APORTE Y NO ESTÁN EN LA LISTA (${retiros.sinReconocer.length}):`)
  retiros.sinReconocer.forEach(s => console.log(
    `     ${s.categ.slice(0, 40).padEnd(40)} $ ${pesos(s.importe).padStart(14)}  (${s.movimientos} movs)`,
  ))
  console.log("     → agregarlos a CONCEPTOS_RETIRO_APORTE, o mejor: darles cuenta en el plan.")
}

console.log(`\n   ${movimientos.length} movimientos leídos de ${empresa.tablas.length} cuenta(s).\n`)
