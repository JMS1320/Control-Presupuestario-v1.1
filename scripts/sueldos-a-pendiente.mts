/**
 * 🔄 **A-DAT-50 — pagos de sueldo que dicen `conciliado` sin tener movimiento bancario.**
 *
 * ```
 * node --experimental-strip-types scripts/sueldos-a-pendiente.mts             # INFORME
 * node --experimental-strip-types scripts/sueldos-a-pendiente.mts --aplicar   # escribe
 * node --experimental-strip-types scripts/sueldos-a-pendiente.mts --aplicar --incluir-julio
 * ```
 *
 * ## Qué corrige
 * La misma plata queda en **dos estados contradictorios**: el pago de sueldo dice `conciliado` y su
 * movimiento del extracto sigue `pendiente`. Y mientras el pago diga `conciliado`, **el motor no lo
 * ofrece**, así que el movimiento no se puede conciliar nunca.
 *
 * Pasarlos a `pendiente` los devuelve al circuito: el usuario corre el motor y se vinculan de verdad.
 *
 * ## Los 5 del lote (19-30/06), autorizados por el usuario el 2026-09-19
 * | Movimiento del extracto | Pagos de sueldo |
 * |---|---|
 * | $1.400.000 (30/06) | uno, por el mismo importe |
 * | $588.333 (30/06) | uno, por el mismo importe |
 * | **$2.699.370** «Servicio Acreditamiento De Haberes» | **tres**: 1.086.893 + 1.487.477 + 125.000 |
 *
 * 📌 **El tercero es el caso que el usuario anticipó**: *«tal vez tenga 2 beneficiarios porque el
 * banco los agrupa y no es prolijo para nosotros, pero no tenemos otro modo ahora»*. Los tres van a
 * `pendiente` para que él arme el grupo de pago.
 *
 * ## ⏳ Los 2 de julio, que quedan FUERA salvo `--incluir-julio`
 * `$5.326.331` (Pago Saldo Jun) y `$691.061,70` (el embargo, `Trf Orden Judic.`) también están
 * `conciliado` sin movimiento — pero **su movimiento cae el 01/07**, fuera del lote que se está
 * revisando. Se separan para no mezclar dos tandas de conciliación.
 *
 * ## 📸 Foto previa en un ARCHIVO, no en una tabla
 * `respaldos/a-dat-50-<fecha>.json`, con el `id` y el estado anterior de cada fila. Se eligió
 * archivo porque **crear una tabla es un cambio de estructura** y para 5 filas no se justifica:
 * revertir es igual de directo, el JSON tiene el id y el estado al que volver.
 */
import fs from 'node:fs'

const R = process.cwd()
const env = Object.fromEntries(
  fs.readFileSync(`${R}/.env.local`, 'utf8').split(/\r?\n/)
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))

const APLICAR = process.argv.includes('--aplicar')
const CON_JULIO = process.argv.includes('--incluir-julio')
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

/** 🔑 Un 2xx sin cuerpo es éxito: PostgREST responde el INSERT con 201 y cuerpo vacío. */
async function api(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${txt}`)
  return txt.trim() ? JSON.parse(txt) : null
}

/** Los 5 del lote 19-30/06. Se apunta **por id**, nunca por «el primero que aparezca» (§ 🛑 Datos). */
const DEL_LOTE = [
  { id: '38e98ea5-4a10-4768-84b3-ee50ffd4057a', monto: 1400000,    contra: 'Trf Inmed Proveed 30/06 $1.400.000' },
  { id: '2c5cbd32-2510-484e-957c-6e900b8d49d7', monto: 588333,     contra: 'Trf Inmed Proveed 30/06 $588.333' },
  { id: '97e7b363-9b11-4243-8fb0-662ac8e15f0c', monto: 1086893,    contra: 'Haberes 30/06 $2.699.370 (1 de 3)' },
  { id: '1576cda7-8f73-4e6f-a6c8-75d9c603f837', monto: 1487477,    contra: 'Haberes 30/06 $2.699.370 (2 de 3)' },
  { id: 'f11283ad-9483-4ddf-b857-997738c8e0b8', monto: 125000,     contra: 'Haberes 30/06 $2.699.370 (3 de 3)' },
]

/** Los 2 cuyo movimiento cae el 01/07. Sólo con `--incluir-julio`. */
const DE_JULIO = [
  { id: 'eea6c801-60a8-45d7-969f-a2013f62505e', monto: 5326331,    contra: 'Trf Inmed Proveed 01/07 $5.326.331' },
  { id: '6a400579-910f-4491-b742-6d21a14a29d0', monto: 691061.70,  contra: 'Trf Orden Judic. 01/07 $691.061,70' },
]

const objetivo = CON_JULIO ? [...DEL_LOTE, ...DE_JULIO] : DEL_LOTE

console.log(`\n${APLICAR ? '✍️  APLICANDO' : '🔍 INFORME (no escribe nada)'}${CON_JULIO ? ' · incluyendo los 2 de julio' : ''}\n`)

// Se relee el estado real antes de tocar: si alguno ya no está `conciliado`, no se toca.
const ids = objetivo.map(o => o.id).join(',')
const filas: any[] = await api(`sueldos_pagos?id=in.(${ids})&select=id,fecha,monto,estado,descripcion`) ?? []
const porId = new Map(filas.map(f => [f.id, f]))

const aCambiar = objetivo.filter(o => porId.get(o.id)?.estado === 'conciliado')
const yaEstaban = objetivo.filter(o => porId.get(o.id) && porId.get(o.id)!.estado !== 'conciliado')
const noEncontrados = objetivo.filter(o => !porId.get(o.id))

for (const o of objetivo) {
  const f = porId.get(o.id)
  const marca = !f ? '🔴 NO EXISTE' : f.estado === 'conciliado' ? '→ pendiente' : `⏭️  ya está en «${f.estado}»`
  console.log(`  ${String(o.monto).padStart(12)}  ${o.contra.padEnd(42)} ${marca}`)
}
console.log(`\n  A cambiar: ${aCambiar.length} · ya estaban: ${yaEstaban.length} · no encontrados: ${noEncontrados.length}`)

if (!APLICAR) {
  console.log('\n📌 Nada se escribió. Para aplicar: agregar --aplicar\n')
  process.exit(0)
}
if (aCambiar.length === 0) {
  console.log('\n✅ No hay nada que cambiar.\n')
  process.exit(0)
}

// 📸 Foto ANTES de tocar nada.
const foto = aCambiar.map(o => ({
  sueldo_pago_id: o.id,
  estado_anterior: porId.get(o.id)!.estado,
  fecha: porId.get(o.id)!.fecha,
  monto: o.monto,
  contra: o.contra,
}))
fs.mkdirSync(`${R}/respaldos`, { recursive: true })
const archivo = `${R}/respaldos/a-dat-50-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
fs.writeFileSync(archivo, JSON.stringify(foto, null, 2), 'utf8')
console.log(`\n📸 Foto de ${aCambiar.length} filas en ${archivo.replace(R, '.')}`)

for (const o of aCambiar) {
  await api(`sueldos_pagos?id=eq.${o.id}`, {
    method: 'PATCH', body: JSON.stringify({ estado: 'pendiente' }),
  })
}
console.log(`✅ ${aCambiar.length} pagos pasados a «pendiente».`)

// 🧮 El control: se vuelve a contar DESDE LA BASE, no desde la variable.
const verif: any[] = await api(`sueldos_pagos?id=in.(${ids})&select=id,estado`) ?? []
const quedan = verif.filter(f => f.estado === 'conciliado').length
console.log(quedan === 0
  ? '🧮 Control: ninguno de los apuntados quedó en «conciliado». ✅'
  : `🧮 Control: 🔴 quedan ${quedan} en «conciliado» — revisar.`)
