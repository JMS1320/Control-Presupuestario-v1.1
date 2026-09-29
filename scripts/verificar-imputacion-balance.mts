/**
 * 📗 **Control: cuánto falta imputar del ejercicio que va al contador.**
 *
 * Arma el libro diario del ejercicio con la **misma lógica que la pantalla** (`armarLibroDiario` +
 * `armarLibroPorCuenta`) y muestra la apertura por cuenta contable, mes a mes, con lo que todavía
 * sale como **NO IMPUTADO**.
 *
 * Sirve para contestar la pregunta que hay que contestar antes del 01/10: *«¿cuánto trabajo de
 * imputación queda?»* — sin abrir la app y sin bajar el Excel.
 *
 * 🔴 **SÓLO LEE.** § 🛑 Datos.
 *
 * ```
 * npx tsx scripts/verificar-imputacion-balance.mts            # MSA, cierre 2026
 * npx tsx scripts/verificar-imputacion-balance.mts PAM 2025
 * ```
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { armarEjercicio } from "../lib/balance/ejercicio"
import { armarLibroDiario, desdeArca, desdeHistorico, desdeVenta } from "../lib/balance/libro-diario"
import {
  armarLibroPorCuenta, SIN_IMPUTAR, TIPOS_SIN_CREDITO_VENTAS, type LibroPorCuenta,
} from "../lib/balance/libro-por-cuenta"

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

const EMPRESAS: Record<string, { schema: string; mesCierre: number }> = {
  MSA: { schema: "msa", mesCierre: 6 },
  PAM: { schema: "pam", mesCierre: 12 },
  MA: { schema: "ma", mesCierre: 12 },
}

const empresaId = (process.argv[2] || "MSA").toUpperCase()
const anioCierre = Number(process.argv[3] || 2026)
const empresa = EMPRESAS[empresaId]
if (!empresa) {
  console.error(`❌ Empresa desconocida: ${empresaId}. Usá MSA, PAM o MA.`)
  process.exit(1)
}

const ej = armarEjercicio(anioCierre, empresa.mesCierre)
const anios = [anioCierre - 1, anioCierre, anioCierre + 1]

const [arca, historico, ventas] = await Promise.all([
  sb.schema(empresa.schema).from("comprobantes_arca").select("*").in("año_contable", anios),
  empresaId === "MSA"
    ? sb.schema("msa").from("comprobantes_historico").select("*").in("anio_contable", anios)
    : Promise.resolve({ data: [], error: null }),
  sb.schema(empresa.schema).from("comprobantes_venta").select("*").in("año_contable", anios),
])
for (const r of [arca, historico, ventas]) {
  if (r.error) throw new Error(r.error.message)
}

const compras = [
  ...(arca.data ?? []).map(desdeArca),
  ...(historico.data ?? []).map(desdeHistorico),
]
const libro = armarLibroDiario(compras, (ventas.data ?? []).map(desdeVenta), ej)

const pesos = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2 })

function mostrar(titulo: string, l: LibroPorCuenta) {
  console.log(`\n══════ ${titulo} ══════`)
  if (l.meses.length === 0) {
    console.log("(sin comprobantes)")
    return
  }
  for (const m of l.meses) {
    const sin = m.filas.find(f => f.cuenta === SIN_IMPUTAR)
    const marca = sin ? `   ⚠️ NO IMPUTADO $ ${pesos(sin.total)} (${sin.comprobantes})` : ""
    console.log(
      `  ${String(m.mes).padStart(2, "0")}/${m.anio}  ` +
      `${String(m.filas.length).padStart(3)} cuentas  ` +
      `${String(m.total.comprobantes).padStart(4)} compr.  ` +
      `total $ ${pesos(m.total.total).padStart(18)}` +
      (m.total.diferencia !== 0 ? `   🛑 DIFERENCIA $ ${pesos(m.total.diferencia)}` : "") +
      marca,
    )
  }
  console.log(`  ${"─".repeat(76)}`)
  console.log(`  TOTAL DEL EJERCICIO   $ ${pesos(l.totalGeneral.total)}   (${l.totalGeneral.comprobantes} comprobantes)`)
  if (l.totalGeneral.diferencia !== 0) {
    console.log(`  🛑 La suma de las columnas NO da el total: diferencia $ ${pesos(l.totalGeneral.diferencia)}`)
  }
  if (l.sinImputar.comprobantes > 0) {
    console.log(`  ⚠️ FALTA IMPUTAR: ${l.sinImputar.comprobantes} comprobante(s) por $ ${pesos(l.sinImputar.total)} — ${l.sinImputar.porcentaje}% del total`)
  } else {
    console.log("  ✅ Todo imputado.")
  }
}

console.log(`Ejercicio ${ej.etiqueta} · ${empresaId} · cierre ${ej.fechaCierre}`)
mostrar("COMPRAS por cuenta contable", armarLibroPorCuenta(libro.compras))
mostrar("VENTAS por cuenta contable", armarLibroPorCuenta(libro.ventas, TIPOS_SIN_CREDITO_VENTAS))

// Las cuentas más grandes sin imputar, para saber por dónde empezar a imputar.
const sinImputarCompras = libro.compras.filter(a => !a.cuenta_contable?.trim())
if (sinImputarCompras.length > 0) {
  console.log("\n══════ LO QUE FALTA IMPUTAR — los 15 más grandes ══════")
  sinImputarCompras
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    .slice(0, 15)
    .forEach(a => console.log(
      `  ${a.subdiario}  $ ${pesos(a.total).padStart(16)}  ${a.denominacion.slice(0, 44)}`,
    ))
}

// Los comprobantes cuyas partes no suman su propio total. § 🧮: el número global avisa que algo
// pasa, **la lista es la que deja arreglarlo**. Es la misma que va a la solapa «Control» del Excel.
const descuadres = [...libro.controles.compras.descuadres, ...libro.controles.ventas.descuadres]
  .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
if (descuadres.length > 0) {
  console.log(`
══════ COMPROBANTES QUE NO CUADRAN CONSIGO MISMOS — ${descuadres.length} ══════`)
  console.log("  (las partes no suman el total que el propio comprobante declara)")
  descuadres.slice(0, 20).forEach(d => console.log(
    `  ${(d.fecha || "").slice(0, 10).padEnd(11)} $ ${pesos(d.diferencia).padStart(14)}  ${String(d.nombre).slice(0, 42)}`,
  ))
  if (descuadres.length > 20) console.log(`  … y ${descuadres.length - 20} más (están todos en la solapa «Control» del Excel)`)
}
