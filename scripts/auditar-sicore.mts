/**
 * 🧾 **AUDITORÍA DE SICORE — los dos controles que faltaban.**
 *
 * Nace 2026-09-29, cuando el usuario encontró **a mano** que un certificado de BIOFARMA sumaba el
 * pago anterior. Al buscar si había más, aparecieron **dos** casos vivos (BIOFARMA y LONGO) y **un
 * tercero de otra clase** (ALCORTA, que retuvo $1.343,40 de más). Ninguno lo había avisado el
 * sistema.
 *
 * > **La lección (§ 🧮 de `CLAUDE.md`): cuanto más condensado es el número, más control necesita.**
 * > Una retención es el número más condensado que hay acá —sale de un neto, un mínimo y una
 * > alícuota— y nadie lo puede verificar a ojo. Tenía cero controles.
 *
 * ## Los dos controles, y por qué son distintos
 *
 * | | Qué compara | Qué significa una diferencia |
 * |---|---|---|
 * | **1 · Certificados** | el resultado **contra sí mismo**: ¿un número cubre más de un pago? | **integridad** — el sistema se contradice. No hay explicación posible |
 * | **2 · Mínimo del mes** | lo retenido contra **la fórmula de RG 830** | **integridad** también: `(neto del mes − mínimo) × alícuota` es aritmética, no criterio |
 *
 * Los dos son del tipo que **frena** (§ 🚦): no hay decisión de negocio que los explique.
 *
 * 🔴 **SÓLO LEE.** Ni un `UPDATE`. § 🛑 Datos.
 *
 * ```
 * npx tsx scripts/auditar-sicore.mts                 # el ejercicio en curso
 * npx tsx scripts/auditar-sicore.mts 2026-08 2026-09
 * ```
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { certificadosConVariosPagos, clavePago } from "../lib/sicore/clave-certificado"

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

const desde = `${process.argv[2] || "2025-07"}-01`
const hastaMes = process.argv[3] || new Date().toISOString().slice(0, 7)
/**
 * El último día del mes, calculado: `-31` reventaba en los meses de 30 días
 * («date/time field value out of range: 2026-09-31»). Se toma el día 1 del mes siguiente menos uno.
 */
const [aa, mm] = hastaMes.split("-").map(Number)
const hasta = new Date(Date.UTC(aa, mm, 0)).toISOString().slice(0, 10)

const pesos = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2 })

const { data, error } = await sb
  .schema("msa")
  .from("sicore_retenciones")
  .select("*")
  .gte("fecha_pago", desde)
  .lte("fecha_pago", hasta)
if (error) throw new Error(error.message)

type Fila = Record<string, unknown>
const filas = (data ?? []) as Fila[]
const vigentes = filas.filter(f => !f.anulado)

console.log(`\n🧾 AUDITORÍA SICORE · pagos del ${desde} al ${hasta}`)
console.log(`   ${filas.length} retenciones (${vigentes.length} vigentes, ${filas.length - vigentes.length} anuladas)`)

// ── CONTROL 1 · un certificado = un pago ────────────────────────────────────────────────────
console.log("\n══════ 1 · ¿algún certificado cubre MÁS DE UN PAGO? ══════")
const hallazgos = certificadosConVariosPagos(vigentes as Parameters<typeof certificadosConVariosPagos>[0])
if (hallazgos.length === 0) {
  console.log("✅ Ninguno. Cada certificado corresponde a un solo pago.")
} else {
  console.log(`🛑 ${hallazgos.length} certificado(s) sumando pagos distintos:\n`)
  for (const h of hallazgos) {
    console.log(`  ▸ ${h.nroCertificado}  ${h.proveedor}`)
    console.log(`      informaría $ ${pesos(h.totalSumado)} sumando ${h.pagos.length} pagos:`)
    h.pagos.forEach(p => console.log(
      `        ${p.fechaPago}  $ ${pesos(p.retencion).padStart(14)}  (${p.filas} fila/s)  ${p.clave}`,
    ))
    console.log("      → hay que renumerar el/los posteriores y reemitir los certificados.\n")
  }
}

// ── CONTROL 2 · el mínimo del mes, por proveedor y por régimen ──────────────────────────────
//
// 🔑 **El camino inverso** (§ 🧮): en vez de repetir el reparto factura por factura, se calcula el
// mes de una sola vez. `(neto del mes − mínimo del régimen) × alícuota` tiene que dar **exactamente**
// la suma de las retenciones. Si no, el mínimo se aplicó dos veces (retuvo de menos) o ninguna
// (retuvo de más).
//
// ⚠️ El mínimo es **mensual y por régimen** (RG 830, A-BUG-193 y A-BUG-196). Agrupar por quincena o
// sin separar régimen fue exactamente lo que falló en el pasado.
console.log("══════ 2 · el MÍNIMO del mes, por proveedor y por régimen ══════")

interface Acum {
  proveedor: string; tipo: string; mes: string
  neto: number; minimoAplicado: number; retenido: number; alicuota: number
  pagos: Set<string>; minimoRegimen: number
  /** El mínimo más grande que alguna fila del mes aplicó. Ver `minimoVigente`. */
  minimoMaxEnFilas: number
}
const acum = new Map<string, Acum>()

// El mínimo de cada régimen sale de la configuración, nunca de una constante escrita acá.
const { data: tipos } = await sb.from("tipos_sicore_config").select("tipo, minimo_no_imponible")
const minimoDe = new Map<string, number>()
for (const t of (tipos ?? []) as Array<{ tipo: string; minimo_no_imponible: number }>) {
  minimoDe.set(String(t.tipo), Number(t.minimo_no_imponible) || 0)
}

for (const f of vigentes) {
  const mes = String(f.fecha_pago ?? "").slice(0, 7)
  const tipo = String(f.tipo_sicore ?? "")
  const k = `${f.cuit_emisor}|${tipo}|${mes}`
  const e = acum.get(k) ?? {
    proveedor: String(f.denominacion_emisor ?? ""), tipo, mes,
    neto: 0, minimoAplicado: 0, retenido: 0,
    alicuota: Number(f.alicuota) || 0,
    pagos: new Set<string>(),
    minimoRegimen: minimoDe.get(tipo) ?? 0,
    minimoMaxEnFilas: 0,
  }
  e.neto += Number(f.neto_gravado_pagado) || 0
  e.minimoAplicado += Number(f.minimo_no_imponible) || 0
  e.retenido += Number(f.retencion) || 0
  e.minimoMaxEnFilas = Math.max(e.minimoMaxEnFilas, Number(f.minimo_no_imponible) || 0)
  e.pagos.add(clavePago(f as Parameters<typeof clavePago>[0]))
  acum.set(k, e)
}

const r2 = (n: number) => Math.round(n * 100) / 100
let malos = 0
for (const e of [...acum.values()].sort((a, b) => a.mes.localeCompare(b.mes))) {
  /**
   * 🧨 **El mínimo del régimen CAMBIA con el tiempo** (lo actualiza ARCA por resolución), así que
   * comparar una retención de marzo contra el mínimo de hoy da un error que no existe.
   *
   * Lo demostró el control en su primera corrida: marcó a **RIGO · Bienes · 03/2026** por $354,34
   * «de menos». No era un error — en marzo el mínimo de bienes era **$241.717,20** y la fila lo
   * aplicó exacto; hoy la configuración dice $224.000. **Falso positivo por comparar contra el
   * presente.**
   *
   * 🔑 Entonces el mínimo vigente de ese mes es **el más grande que alguna fila aplicó**, y la
   * configuración actual se usa sólo como piso — porque si **ninguna** fila aplicó mínimo (el caso
   * ALCORTA), el máximo es 0 y sin piso el control se quedaría callado justo en el error que busca.
   */
  const minimoVigente = Math.max(e.minimoMaxEnFilas, e.minimoRegimen)
  if (minimoVigente === 0) {
    console.log(`  ⚠️ ${e.proveedor.slice(0, 30)} · ${e.tipo} · ${e.mes}: sin mínimo configurado ni aplicado, no se puede controlar`)
    continue
  }
  const deberia = r2(Math.max(0, r2(e.neto - minimoVigente)) * e.alicuota)
  const dif = r2(e.retenido - deberia)
  if (Math.abs(dif) < 0.02) continue     // centavos de redondeo del reparto
  malos += 1
  const signo = dif > 0 ? "DE MÁS" : "DE MENOS"
  console.log(`\n  🛑 ${e.proveedor} · ${e.tipo} · ${e.mes} — retuvo $ ${pesos(Math.abs(dif))} ${signo}`)
  console.log(`      neto del mes      $ ${pesos(e.neto)}   (${e.pagos.size} pago/s)`)
  console.log(`      mínimo vigente    $ ${pesos(minimoVigente)}   ·   aplicado en el mes: $ ${pesos(e.minimoAplicado)}`)
  console.log(`      retenido          $ ${pesos(e.retenido)}   ·   debería: $ ${pesos(deberia)}`)
  if (e.minimoAplicado === 0) {
    console.log("      💡 el mínimo NO se aplicó ninguna vez — típico de A-BUG-196 (un régimen se comía el del otro)")
  } else if (e.minimoAplicado > minimoVigente) {
    console.log("      💡 el mínimo se aplicó MÁS de una vez — típico de A-BUG-193 (se reiniciaba por quincena)")
  }
}
if (malos === 0) console.log("✅ Todas las combinaciones proveedor × régimen × mes cierran con la fórmula.")

console.log(`\n   ${acum.size} combinaciones proveedor × régimen × mes controladas.\n`)
