/**
 * 🧹 **A-DAT-38 — poner cada cosa en su columna en los movimientos YA conciliados.**
 *
 * ```
 * node --experimental-strip-types scripts/migrar-extracto-comprobante.mts            # INFORME
 * node --experimental-strip-types scripts/migrar-extracto-comprobante.mts --aplicar  # escribe
 * ```
 *
 * ## Qué corrige
 * [A-FEAT-138] arregló el código, pero los movimientos conciliados **antes** siguen como estaban:
 *
 * | Columna | Qué tiene hoy | Qué debe tener |
 * |---|---|---|
 * | `comprobantes_pagados` | `«UATRE»` — el nombre del template a secas, igual en las 12 cuotas | `«UATRE MSA - Junio 2026»` |
 * | `detalle` | `«UATRE»` / `«Comision Transferencias»` — repite la CATEG o el Comprobante | vacío |
 *
 * ## 🛑 Lo que NO se toca, y es la mitad que importa
 * El `detalle` **sólo se vacía si repite** la CATEG o el Comprobante. Si dice cualquier otra cosa
 * —`«400 Para Victor - 1 MM para Pintor - Resto Caja Sigot»`— **queda intacto**. Al 2026-09-12 eran
 * **144 de 506**, y son justamente los que valen: lo que una persona se tomó el trabajo de escribir.
 *
 * ⚠️ Y el `comprobantes_pagados` sólo se reescribe **si el identificador se puede generar**. Si el
 * template no tiene nombre, se saltea: mejor el texto viejo que uno a medias.
 *
 * ## 📸 Foto previa en `public.respaldo_a_dat_38`
 * Con las dos columnas de antes. Revertir es un `UPDATE` desde ahí.
 */
import fs from 'node:fs'
import { identificadorDeCuota } from '../lib/templates/identificador-cuota.ts'

const R = process.cwd()
const env = Object.fromEntries(
  fs.readFileSync(`${R}/.env.local`, 'utf8').split(/\r?\n/)
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))

const APLICAR = process.argv.includes('--aplicar')
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

/**
 * ⚠️ **Se lee el cuerpo como TEXTO y se parsea sólo si hay algo.**
 *
 * La primera versión hacía `r.json()` salvo en 204, y reventó con `Unexpected end of JSON input`
 * a mitad del respaldo: **PostgREST responde un `INSERT` con `201` y cuerpo VACÍO** cuando no se
 * le pide `Prefer: return=representation`. O sea que la escritura **sí había funcionado** — lo que
 * fallaba era leer la respuesta, y desde afuera eso se veía como «se cortó».
 *
 * 🔑 Un código 2xx sin cuerpo es éxito, no un error de formato.
 */
const api = async (path: string, init?: RequestInit) => {
  const r = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } })
  const txt = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${txt}`)
  return txt.trim() ? JSON.parse(txt) : null
}

/** Las 3 tablas con vínculos vivos (las otras 9 tienen 0 — medido en A-BUG-156). */
const TABLAS = ['msa_galicia', 'pam_galicia', 'pam_galicia_cc']
const norm = (x: any) => String(x ?? '').trim().toLowerCase()

let totalComp = 0, totalDet = 0, totalIntacto = 0, totalSalteado = 0, salteadoConDetalle = 0
const plan: any[] = []

for (const tabla of TABLAS) {
  /**
   * ⚠️ **Se pagina de a 100, por DOS motivos distintos:**
   *
   * 1. Un `limit` alto **no garantiza traer todo**: PostgREST corta en `max-rows` y devuelve 200
   *    con menos filas, sin avisar. Es el error que dio la falsa alarma en A-DAT-37.
   * 2. Los `id` de las cuotas se consultan con `id=in.(…)` **en la URL**. Con 500 UUIDs el pedido
   *    revienta con `UND_ERR_HEADERS_OVERFLOW` — pasó en la primera corrida. Cien entran holgados.
   */
  let desde = 0
  for (;;) {
    const filas: any[] = await api(
      `${tabla}?select=id,categ,comprobantes_pagados,detalle,template_cuota_id` +
      `&estado=eq.conciliado&template_cuota_id=not.is.null&limit=100&offset=${desde}`)
    if (filas.length === 0) break

    const ids = filas.map(f => `"${f.template_cuota_id}"`).join(',')
    const cuotas: any[] = await api(
      `cuotas_egresos_sin_factura?select=id,fecha_estimada,egreso:egresos_sin_factura(nombre_referencia,responsable)` +
      `&id=in.(${ids})`)
    const porId = new Map(cuotas.map(c => [c.id, c]))

    for (const f of filas) {
      const c = porId.get(f.template_cuota_id)
      // ⚠️ Los salteados que TENÍAN detalle se cuentan aparte: si no, el control del final los
      //    reclama como sobrantes. Es la segunda falsa alarma por el mismo motivo — el esperado
      //    calculado sobre el universo que la lógica ya había recortado (ver A-DAT-37).
      if (!c) { totalSalteado++; if (String(f.detalle ?? '').trim()) salteadoConDetalle++; continue }
      const id = identificadorDeCuota(c, c.egreso ?? {})
      if (!id) { totalSalteado++; if (String(f.detalle ?? '').trim()) salteadoConDetalle++; continue }

      const cambios: any = {}
      if (norm(f.comprobantes_pagados) !== norm(id)) { cambios.comprobantes_pagados = id; totalComp++ }

      const d = String(f.detalle ?? '').trim()
      if (d && (norm(d) === norm(f.categ) || norm(d) === norm(f.comprobantes_pagados) || norm(d) === norm(id))) {
        cambios.detalle = null; totalDet++
      } else if (d) {
        totalIntacto++
      }

      if (Object.keys(cambios).length > 0) {
        plan.push({ tabla, id: f.id, cambios, antes: { comprobantes_pagados: f.comprobantes_pagados, detalle: f.detalle } })
      }
    }
    if (filas.length < 100) break
    desde += 100
  }
}

console.log(`\n🧹 A-DAT-38 — movimientos conciliados contra una cuota\n`)
console.log(`  ${String(totalComp).padStart(4)}  Comprobante a reescribir con el período`)
console.log(`  ${String(totalDet).padStart(4)}  Detalle a vaciar — repetía la CATEG o el Comprobante`)
console.log(`  ${String(totalIntacto).padStart(4)}  Detalle que APORTA — 🔴 NO SE TOCAN`)
console.log(`  ${String(totalSalteado).padStart(4)}  salteados (sin cuota o sin nombre de template)\n`)

for (const p of plan.slice(0, 6)) {
  console.log(`   ${p.tabla}`)
  console.log(`     comprobante: "${p.antes.comprobantes_pagados ?? ''}"  →  "${p.cambios.comprobantes_pagados ?? '(igual)'}"`)
  if ('detalle' in p.cambios) console.log(`     detalle:     "${p.antes.detalle}"  →  (vacío)`)
}
if (plan.length > 6) console.log(`   … y ${plan.length - 6} movimientos más\n`)

if (!APLICAR) {
  console.log('ℹ️  INFORME solamente. Nada se escribió.\n')
  process.exit(0)
}

console.log('📸 Guardando la foto en `respaldo_a_dat_38`…')
const foto = plan.map(p => ({
  tabla: p.tabla, movimiento_id: p.id,
  comprobante_antes: p.antes.comprobantes_pagados, detalle_antes: p.antes.detalle,
  comprobante_nuevo: p.cambios.comprobantes_pagados ?? null,
}))
// ⚠️ Lotes de 50 y progreso a la vista: con 200 la foto se cortó en la mitad **sin decir por
// qué**, y desde afuera eso era indistinguible de «terminó bien». Un proceso largo que escribe
// tiene que decir dónde va — si no, al cortarse no se sabe si hay que reintentar o limpiar.
for (let i = 0; i < foto.length; i += 50) {
  await api('respaldo_a_dat_38', { method: 'POST', body: JSON.stringify(foto.slice(i, i + 50)) })
  console.log(`   respaldadas ${Math.min(i + 50, foto.length)}/${foto.length}`)
}
console.log(`   ${foto.length} filas respaldadas.\n`)

let ok = 0
for (const p of plan) {
  await api(`${p.tabla}?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify(p.cambios) })
  ok++
  if (ok % 50 === 0) console.log(`   corregidos ${ok}/${plan.length}`)
}
console.log(`✅ ${ok} movimientos corregidos.`)

// 🧮 El control: los que aportaban siguen ahí. Se cuenta EN EL SERVIDOR.
const contar = async (tabla: string, filtro: string) => {
  const r = await fetch(`${URL}/rest/v1/${tabla}?select=id&${filtro}`,
    { method: 'HEAD', headers: { ...H, Prefer: 'count=exact' } })
  return Number((r.headers.get('content-range') ?? '/0').split('/')[1]) || 0
}
let conDetalle = 0
for (const t of TABLAS) {
  conDetalle += await contar(t, 'estado=eq.conciliado&template_cuota_id=not.is.null&detalle=not.is.null&detalle=neq.')
}
console.log(`\n🧮 CONTROL — movimientos con detalle: ${conDetalle} · esperados: ${totalIntacto}`)
console.log(conDetalle === totalIntacto
  ? '   ✅ Cierra: sobrevivieron exactamente los que aportaban algo.'
  : '   🚨 NO CIERRA. Revisar contra respaldo_a_dat_38 antes de tocar nada más.')
