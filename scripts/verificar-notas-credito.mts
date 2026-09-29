/**
 * 🧾 **Control: notas de crédito sin aplicar contra facturas por pagar.**
 *
 * Corre la misma detección que el aviso del Cash Flow (A-FEAT-1192) contra la base, y lista qué
 * proveedores tienen las dos puntas. Sirve para dos cosas:
 *
 * 1. **Verificar el aviso sin abrir la app** — el mismo `detectarProveedoresConNC` que usa la
 *    pantalla, así que si acá sale bien, ahí sale bien.
 * 2. **Como control de cierre**: antes de una tanda de pagos, ver si hay plata que se está por
 *    pagar de más.
 *
 * 🔴 **SÓLO LEE.** Ni un `UPDATE`. § 🛑 Datos.
 *
 * ```
 * npx tsx scripts/verificar-notas-credito.mts
 * ```
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { detectarProveedoresConNC, abreviaturaComprobante } from "../lib/pagos/notas-credito"

// Se lee el .env.local sin dependencias extra — el idiom de los demás scripts del proyecto.
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

/** Los schemas que llevan comprobantes de compra. MA y PAM tienen los suyos. */
const SCHEMAS = ["msa", "pam", "ma"] as const

for (const schema of SCHEMAS) {
  const { data, error } = await sb
    .schema(schema)
    .from("comprobantes_arca")
    .select("id, cuit, denominacion_emisor, tipo_comprobante, imp_total, estado, numero_desde")
    .in("estado", ["pendiente", "pagar", "preparado", "programado"])

  if (error) {
    // No se corta: un schema que no responde no puede tapar los otros dos.
    console.log(`\n⚠️  ${schema.toUpperCase()}: no se pudo leer — ${error.message}`)
    continue
  }

  const comprobantes = (data || []).map(f => ({
    id: f.id as string,
    cuit: (f.cuit as string) || "",
    proveedor: (f.denominacion_emisor as string) || "",
    display: `${abreviaturaComprobante(f.tipo_comprobante as number)} ${f.numero_desde || ""}`,
    tipoComprobante: f.tipo_comprobante as number | null,
    importe: Math.abs(Number(f.imp_total) || 0),
    estado: f.estado as string,
  }))

  const conNC = detectarProveedoresConNC(comprobantes)
  console.log(`\n══ ${schema.toUpperCase()} — ${comprobantes.length} comprobantes pendientes ══`)

  if (conNC.length === 0) {
    console.log("✅ Ningún proveedor tiene notas de crédito sin aplicar.")
    continue
  }

  const total = conNC.reduce((s, p) => s + p.totalNotasCredito, 0)
  console.log(`🧾 ${conNC.length} proveedor(es) · $ ${pesos(total)} en notas de crédito sin aplicar\n`)

  for (const p of conNC) {
    console.log(`▸ ${p.proveedor}   (CUIT ${p.cuit})`)
    console.log(`    por pagar        $ ${pesos(p.totalFacturas)}   (${p.facturas.length})`)
    console.log(`    notas de crédito $ ${pesos(p.totalNotasCredito)}   (${p.notasCredito.length})`)
    console.log(`    quedaría         $ ${pesos(p.saldo)}${p.saldo < 0 ? "   ← saldo a favor" : ""}`)
    console.log(`    ${p.notasCredito.map(n => n.display).join(" · ")}\n`)
  }
}
