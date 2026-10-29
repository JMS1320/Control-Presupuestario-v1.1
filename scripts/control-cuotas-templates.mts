/**
 * 🔢 **Control de cuotas de templates, por consola** — la misma lógica que Papeles de balance
 * (`lib/balance/control-cuotas-templates.ts`), para verlo sin abrir la pantalla.
 *
 * 🔴 **SÓLO LEE.** § 🛑 Datos. Toca `cuotas_egresos_sin_factura` (+ su template), `<empresa>.comprobantes_venta`
 * (qué subdiarios tienen ventas) y `msa.sicore_retenciones` (las presentaciones de SICORE).
 *
 * ```
 * npx tsx scripts/control-cuotas-templates.mts                 # MSA 2026 · PAM y MA 2025 y 2026
 * npx tsx scripts/control-cuotas-templates.mts PAM 2026        # una sola
 * npx tsx scripts/control-cuotas-templates.mts MSA 2026 --todo # también las que están bien
 * ```
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import {
  armarControlCuotas, resumenControlCuotas, conProblema,
  cuotaParaControlDesde, subdiariosConVentasDesde, presentacionesSicoreDesde,
  type CuotaParaControl, type PresentacionSicore,
} from "../lib/balance/control-cuotas-templates"

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

const args = process.argv.slice(2).filter(a => !a.startsWith("--"))
const todo = process.argv.includes("--todo")
const corridas: Array<[string, number]> = args.length >= 2
  ? [[args[0].toUpperCase(), Number(args[1])]]
  : [["MSA", 2026], ["PAM", 2025], ["PAM", 2026], ["MA", 2025], ["MA", 2026]]

/** Trae todo de a 1000 (la base corta ahí). */
async function todas<T>(q: (d: number, h: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let d = 0; ; d += 1000) {
    const { data, error } = await q(d, d + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) return out
  }
}

const crudas = await todas<Record<string, any>>((d, h) => sb.from("cuotas_egresos_sin_factura")
  .select("id, egreso_id, estado, monto, fecha_vencimiento, fecha_estimada, fecha_pago, detalle, egreso:egresos_sin_factura(nombre_referencia, responsable)")
  .order("id").range(d, h))
const cuotas: CuotaParaControl[] = crudas.map(cuotaParaControlDesde)

const ventasDe = new Map<string, string[] | null>()
for (const s of ["msa", "pam", "ma"]) {
  try {
    const v = await todas<Record<string, any>>((d, h) => sb.schema(s).from("comprobantes_venta")
      .select("año_contable, mes_contable").order("id").range(d, h))
    ventasDe.set(s.toUpperCase(), subdiariosConVentasDesde(v))
  } catch (e) {
    console.log(`⚠️ No se pudieron leer las ventas de ${s}: ${(e as Error).message}`)
    ventasDe.set(s.toUpperCase(), null)
  }
}

let sicore: PresentacionSicore[] | null = null
try {
  const r = await todas<Record<string, any>>((d, h) => sb.schema("msa").from("sicore_retenciones")
    .select("quincena, retencion, estado_quincena").order("id").range(d, h))
  sicore = presentacionesSicoreDesde(r)
} catch (e) {
  console.log(`⚠️ No se pudieron leer las presentaciones de SICORE: ${(e as Error).message}`)
}

const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10) // día argentino
console.log(`\n🔢 CONTROL DE CUOTAS DE TEMPLATES — ${cuotas.length} cuotas leídas · hoy ${hoy}`)
console.log(`   Subdiarios con ventas: ${[...ventasDe].map(([e, v]) => `${e} ${v ? v.join(",") || "ninguno" : "sin leer"}`).join(" · ")}`)
console.log(`   Presentaciones SICORE (MSA): ${sicore ? sicore.map(p => p.quincena).sort().join(", ") : "sin leer"}`)

for (const [empresa, anio] of corridas) {
  const c = armarControlCuotas(empresa, anio, {
    cuotas, hoy,
    subdiariosConVentas: ventasDe.get(empresa) ?? null,
    presentacionesSicore: empresa === "MSA" ? sicore : [],
  })
  console.log(`\n══ ${empresa} · ${c.campania} ══`)
  console.log("   " + resumenControlCuotas(c.filas).map(r => `${r.estado}: ${r.cantidad}`).join(" · "))
  for (const f of c.filas) {
    if (!todo && f.estado === "ok") continue
    const marca = f.estado === "ok" ? "✓" : conProblema(f) ? "⚠️" : "·"
    console.log(`   ${marca} ${f.preview ? "★ " : "  "}[${f.estado}] ${f.nombre} — ${f.regla} → ${f.detalle}`)
  }
}
