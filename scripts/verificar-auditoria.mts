/**
 * ✅ **A-FEAT-145 — corre el audit contra la base y lo compara con LA EXPECTATIVA ESCRITA.**
 *
 * ```
 * node --experimental-strip-types scripts/verificar-auditoria.mts
 * ```
 *
 * 🛑 **SÓLO LECTURA.** No escribe una sola fila.
 *
 * ## Para qué sirve, y es la razón de que exista
 * `MODULO_CONCILIACION.md` § 30.9.7 registró —**antes** de que este audit existiera— qué número
 * tiene que dar cada control. Este script corre **la misma función que usa la pantalla** contra los
 * datos reales y **compara contra esos números**.
 *
 * 🔑 Si algo no coincide, **o el audit está mal o la expectativa estaba mal**, y las dos
 * posibilidades hay que mirarlas. Sin esto, un audit recién escrito parece cierto sólo porque lo
 * dijo la máquina — y este proyecto produjo tres falsas alarmas en un día que se veían exactamente
 * igual que un hallazgo real.
 */
import fs from 'node:fs'
import { auditar, importeDe, type MovimientoAuditable, type ParCuadratura } from '../lib/conciliacion/auditoria.ts'

const R = process.cwd()
const env = Object.fromEntries(
  fs.readFileSync(`${R}/.env.local`, 'utf8').split(/\r?\n/)
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

/** ⚠️ PostgREST corta en 1.000 filas pase el `limit` que le pases: hay que paginar de verdad. */
async function traerTodo(tabla: string, schema: string, select = '*'): Promise<any[]> {
  const PASO = 1000
  const filas: any[] = []
  for (let desde = 0; ; desde += PASO) {
    const r = await fetch(`${URL}/rest/v1/${tabla}?select=${select}`, {
      headers: {
        apikey: KEY!, Authorization: `Bearer ${KEY}`,
        'Accept-Profile': schema,
        Range: `${desde}-${desde + PASO - 1}`,
      },
    })
    const txt = await r.text()
    if (!r.ok) throw new Error(`${schema}.${tabla}: ${r.status} ${txt}`)
    const lote = txt.trim() ? JSON.parse(txt) : []
    filas.push(...lote)
    if (lote.length < PASO) return filas
  }
}

const CUENTAS = [
  { nombre: 'MSA Galicia', tabla: 'msa_galicia', schema: 'public' },
  { nombre: 'PAM Galicia', tabla: 'pam_galicia', schema: 'public' },
  { nombre: 'PAM Galicia CC', tabla: 'pam_galicia_cc', schema: 'public' },
  { nombre: 'MA Galicia', tabla: 'ma_galicia', schema: 'ma' },
  { nombre: 'Caja General MSA', tabla: 'caja_general', schema: 'msa' },
  { nombre: 'Caja AMS MSA', tabla: 'caja_ams', schema: 'msa' },
  { nombre: 'Caja Sigot MSA', tabla: 'caja_sigot', schema: 'msa' },
  { nombre: 'VISA Business MSA', tabla: 'tarjeta_visa_business', schema: 'msa' },
  { nombre: 'VISA PAM', tabla: 'tarjeta_visa', schema: 'pam' },
  { nombre: 'VISA MA', tabla: 'tarjeta_visa', schema: 'ma' },
]

/** Lo medido el 2026-09-13 y escrito en § 30.9.7 ANTES de que este audit existiera. */
const ESPERADO: Record<string, number> = {
  universo: 1498,
  auditados: 676,
  'sin-vinculo': 10,
  // ⚠️ Corregido tras la 1a corrida. La expectativa decia 1, y medi con SQL sobre 4 columnas de
  // vinculo: `comprobante_venta_id` solo existe en msa_galicia y no lo incluí. El 2o caso
  // (anticipo + venta, 31/07, importe 0) era invisible para esa consulta.
  'vinculo-doble': 2,
  // ⚠️ Corregido tras la 1a corrida. La expectativa decia 16 porque conto los comprobantes
  // VACIOS. El estandar pide mas: que IDENTIFIQUE cual (numero o periodo). Los 9 que faltaban
  // tienen texto que no identifica nada -- 6 repiten el nombre del proveedor
  // ("AUTOPISTAS URBANAS S. A.") y 3 son partidas de ARBA sin periodo.
  'sin-comprobante': 25,
  'detalle-repite': 96,
  'categ-fuera-plan': 152,
  imputacion: 22,            // 13 ARCA sin nro_cuenta + 9 de otros orígenes con él
  'sin-proveedor': 209,
  cuadratura: 0,             // 446/446 tras las correcciones del 13/09
}

const movimientos: MovimientoAuditable[] = []
for (const c of CUENTAS) {
  const filas = await traerTodo(c.tabla, c.schema)
  for (const f of filas) {
    movimientos.push({
      id: String(f.id), cuenta: c.nombre,
      fecha: f.fecha ?? null, descripcion: f.descripcion ?? null,
      debitos: f.debitos ?? null, creditos: f.creditos ?? null, estado: f.estado ?? null,
      categ: f.categ ?? null, nro_cuenta: f.nro_cuenta ?? null,
      proveedor_nombre: f.proveedor_nombre ?? null,
      comprobantes_pagados: f.comprobantes_pagados ?? null, detalle: f.detalle ?? null,
      comprobante_arca_id: f.comprobante_arca_id ?? null,
      template_cuota_id: f.template_cuota_id ?? null,
      sueldo_pago_id: f.sueldo_pago_id ?? null, anticipo_id: f.anticipo_id ?? null,
      comprobante_venta_id: f.comprobante_venta_id ?? null,
    })
  }
  console.log(`  ${c.nombre.padEnd(20)} ${String(filas.length).padStart(5)} movimientos`)
}

const plan = await traerTodo('cuentas_contables', 'public', 'categ')
const categsDelPlan = new Set<string>(plan.map((c: any) => String(c.categ ?? '').trim()))

const cuotas = await traerTodo('cuotas_egresos_sin_factura', 'public', 'id,monto,grupo_pago_id')
const porCuota = new Map<string, number>(), porGrupo = new Map<string, number>()
for (const c of cuotas) {
  const m = Number(c.monto) || 0
  porCuota.set(String(c.id), m)
  if (c.grupo_pago_id) porGrupo.set(String(c.grupo_pago_id), (porGrupo.get(String(c.grupo_pago_id)) ?? 0) + m)
}

const cuadratura: ParCuadratura[] = []
for (const m of movimientos) {
  const v = m.template_cuota_id
  if (!v || String(m.estado ?? '').toLowerCase() !== 'conciliado') continue
  const origen = porGrupo.has(String(v)) ? porGrupo.get(String(v))! : porCuota.get(String(v))
  if (origen === undefined) continue
  cuadratura.push({ movimientoId: m.id, importeBanco: importeDe(m), importeOrigen: origen })
}

const res = auditar({ movimientos, categsDelPlan, cuadratura })

console.log(`\n📏 Plan de cuentas: ${categsDelPlan.size} categorías · cuotas: ${cuotas.length} · pares de cuadratura: ${cuadratura.length}`)
console.log(`\nOrígenes: ${Object.entries(res.porOrigen).filter(([, n]) => n > 0).map(([o, n]) => `${o} ${n}`).join(' · ')}`)

console.log('\n┌─ CONTRA LA EXPECTATIVA DE § 30.9.7 ────────────────────────────────')
const obtenido: Record<string, number> = {
  universo: res.universo,
  auditados: res.auditados,
  ...Object.fromEntries(res.grupos.map(g => [g.control, g.total])),
}
let divergencias = 0
for (const [k, esp] of Object.entries(ESPERADO)) {
  const obt = obtenido[k] ?? 0
  const ok = obt === esp
  if (!ok) divergencias++
  console.log(`│ ${ok ? '✅' : '🔴'} ${k.padEnd(18)} esperado ${String(esp).padStart(5)}   obtenido ${String(obt).padStart(5)}`)
}
console.log('└────────────────────────────────────────────────────────────────────')

for (const g of res.grupos) {
  console.log(`\n▸ ${g.titulo} — ${g.total}${g.enElOrigen ? ` (${g.enElOrigen} se arreglan en el origen)` : ''}`)
  for (const c of g.causas.slice(0, 6)) console.log(`    ${String(c.cantidad).padStart(4)} · ${c.causa}`)
  if (g.causas.length > 6) console.log(`         … y ${g.causas.length - 6} causas más`)
}

for (const n of res.noVerificado) console.log(`\n⚠️  ${n}`)
console.log(`\n${res.limpios} de ${res.auditados} conciliados cumplen el estándar.`)
console.log(divergencias === 0
  ? '\n✅ El audit reproduce la expectativa exactamente.'
  : `\n🔴 ${divergencias} divergencia(s): o el audit está mal, o la expectativa estaba mal. Hay que mirar las dos.`)
