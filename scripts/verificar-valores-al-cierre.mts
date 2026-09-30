/**
 * 💵 **Control de los bloques 04.1, 04.2 y 03.1 del balance** — cheques dados y anticipos.
 *
 * Corre la misma lógica que el export contra la base y la imprime, para poder ver los números sin
 * bajar el Excel. Y sobre todo: corre **el control del camino inverso** de los anticipos, que es el
 * que dice si el saldo al cierre se puede creer.
 *
 * 🔴 **SÓLO LEE.** § 🛑 Datos. Toca tres tablas: `<empresa>.cheques`, `anticipos_proveedores` y
 * `anticipos_facturas`.
 *
 * ```
 * npx tsx scripts/verificar-valores-al-cierre.mts            # MSA, cierre 2026
 * npx tsx scripts/verificar-valores-al-cierre.mts MSA 2026
 * ```
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import {
  armarChequesDados, armarAnticiposAlCierre,
  type ChequeCrudo, type AnticipoCrudo, type AplicacionDeAnticipo,
} from "../lib/balance/valores-al-cierre"
import { armarEjercicio } from "../lib/balance/ejercicio"
import { hoyArgentina } from "../lib/cotizaciones/parsers"

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

const empresa = (process.argv[2] ?? "MSA").toUpperCase()
const anioCierre = Number(process.argv[3] ?? 2026)
const mesCierre = empresa === "MSA" ? 6 : 12
const ej = armarEjercicio(anioCierre, mesCierre)

console.log(`\n💵 VALORES AL CIERRE — ${empresa}, ejercicio ${ej.etiqueta} (corte ${ej.fechaCierre})\n`)

// ── 04.1 · Cheques dados ───────────────────────────────────────────────────────────────────
// ⚠️ La tabla existe SÓLO en el schema `msa`. En PAM y MA no hay nada que leer, y eso no es un cero.
if (empresa === "MSA") {
  const { data, error } = await sb.schema("msa").from("cheques")
    .select("id, numero, banco, monto, moneda, fecha_emision, fecha_cobro, beneficiario_nombre, "
      + "beneficiario_cuit, estado, concepto, factura_id, anticipo_id")
  if (error) throw new Error(error.message)

  const ch = armarChequesDados((data ?? []) as unknown as ChequeCrudo[], ej.fechaCierre, hoyArgentina())
  console.log("── 04.1 CHEQUES DADOS Y DIFERIDOS NO DEBITADOS ──")
  console.log(`   ${ch.mirados} cheque(s) en la tabla · ${ch.debitadosAntes} ya habían debitado al `
    + `cierre · ${ch.posteriores} posteriores al cierre`)
  for (const x of ch.filas) {
    console.log(`   ${x.cheque.fecha_emision} → debita ${x.cheque.fecha_cobro} · `
      + `N° ${x.cheque.numero ?? "(sin número)"} · ${pesos(x.cheque.monto ?? 0)} · ${x.cheque.beneficiario_nombre}`)
  }
  console.log(`   TOTAL del papel: ${pesos(ch.total)} en ${ch.filas.length} cheque(s)`)
  if (ch.sinFechaDeDebito.length > 0) {
    console.log(`   ⚠️ Sin fecha de débito: ${ch.sinFechaDeDebito.length} por ${pesos(ch.totalSinFecha)}`)
  }
  ch.avisos.forEach(a => console.log(`   ⚠️ ${a}`))
} else {
  console.log("── 04.1 CHEQUES DADOS: la tabla `cheques` existe sólo en el schema `msa`. ──")
  console.log("   No es cero: no hay dónde mirar. El índice del Excel lo dice así.")
}

// ── 04.2 · Anticipos ───────────────────────────────────────────────────────────────────────
const [ant, apl] = await Promise.all([
  sb.from("anticipos_proveedores")
    .select("id, empresa, nombre_proveedor, cuit_proveedor, monto, monto_restante, monto_sicore, "
      + "descuento_aplicado, fecha_pago, tipo, estado, estado_pago, descripcion"),
  sb.from("anticipos_facturas").select("anticipo_id, monto_aplicado, fecha_aplicacion"),
])
for (const r of [ant, apl]) if (r.error) throw new Error(r.error.message)

const an = armarAnticiposAlCierre(
  (ant.data ?? []) as unknown as AnticipoCrudo[],
  (apl.data ?? []) as unknown as AplicacionDeAnticipo[],
  ej.fechaCierre, empresa,
  // Las filas sin empresa se cuentan como de MSA — ver el encabezado de `valores-al-cierre.ts`.
  empresa === "MSA",
)

console.log("\n── 04.2 ANTICIPOS A PROVEEDORES (activo) ──")
for (const x of an.aProveedores) {
  console.log(`   ${x.anticipo.fecha_pago} · ${x.anticipo.nombre_proveedor} · `
    + `monto ${pesos(x.anticipo.monto ?? 0)} − aplicado ${pesos(x.aplicadoAlCierre)} `
    + `− sicore ${pesos(x.anticipo.monto_sicore ?? 0)} = SALDO ${pesos(x.saldoAlCierre)}`
    + (x.aplicadoDespues > 0 ? `   (después del cierre se aplicaron ${pesos(x.aplicadoDespues)})` : "")
    + (x.sinEmpresa ? "   [sin empresa]" : ""))
}
console.log(`   TOTAL: ${pesos(an.totalAProveedores)} en ${an.aProveedores.length} anticipo(s)`)

console.log("\n── ANTICIPOS DE CLIENTES (pasivo: cobros a cuenta) ──")
for (const x of an.deClientes) {
  console.log(`   ${x.anticipo.fecha_pago} · ${x.anticipo.nombre_proveedor} · SALDO ${pesos(x.saldoAlCierre)}`
    + (x.sinEmpresa ? "   [sin empresa]" : ""))
}
console.log(`   TOTAL: ${pesos(an.totalDeClientes)} en ${an.deClientes.length} anticipo(s)`)

if (an.sinTipo.length > 0) {
  console.log(`\n   ⚠️ SIN TIPO: ${an.sinTipo.length} por ${pesos(an.totalSinTipo)} `
    + `(${an.tiposSinClasificar.join(", ")})`)
}

// 🧮 El control del camino inverso.
console.log("\n── 🧮 CONTROL: recalcular el saldo a HOY tiene que dar el del sistema ──")
if (an.descuadres.length === 0) {
  console.log(`   ✓ Cierra en los ${an.mirados} anticipos del cierre.`)
} else {
  console.log(`   ⚠️ NO cierra en ${an.descuadres.length} de ${an.mirados}:`)
  for (const d of an.descuadres) {
    console.log(`      ${d.nombre} · monto ${pesos(d.monto)} · sistema ${pesos(d.guardado)} · `
      + `recalculado ${pesos(d.recalculado)} · diferencia ${pesos(d.diferencia)}`)
  }
}
an.avisos.forEach(a => console.log(`   ⚠️ ${a}`))
console.log("")
