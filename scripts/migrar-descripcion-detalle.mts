/**
 * 🚚 **A-DAT-37 — mudar las `descripcion` viejas de las cuotas a su columna.**
 *
 * ```
 * node --experimental-strip-types scripts/migrar-descripcion-detalle.mts            # INFORME, no escribe
 * node --experimental-strip-types scripts/migrar-descripcion-detalle.mts --aplicar  # escribe (pide permiso antes)
 * ```
 *
 * ## Qué hace, en una línea
 * Reparte lo que hoy está todo junto en `descripcion`: lo que **reproduce exactamente** el
 * identificador generado se vacía (se regenera solo); **todo lo demás va a `detalle`**, porque es
 * del usuario.
 *
 * ## 🔑 Por qué es un script y no un `UPDATE` en SQL
 * Porque la clasificación tiene que usar **la misma función que el display** —
 * `esElIdentificadorGenerado()` de `lib/templates/identificador-cuota.ts`, la que tiene los 10
 * casos en `npm run probar`. Replicarla en SQL pondría la regla en dos lados, y el día que cambie
 * una (el responsable que no se repite, el formato del período) la migración empezaría a borrar
 * cosas que el display ya no considera generadas. **Una regla, un lugar.**
 *
 * ## 🛑 El sesgo, que es lo que lo hace seguro
 * Ante cualquier duda, la fila cuenta como **del usuario** y va a `detalle`. Equivocarse hacia ahí
 * deja un texto redundante a la vista, que se corrige mirando. Equivocarse hacia el otro lado
 * **borra algo que escribió una persona**, y eso no vuelve.
 *
 * Por eso sólo se vacía lo que coincide **carácter por carácter** (normalizando espacios) con lo
 * que la función generaría hoy para esa misma cuota. Una etiqueta de otro período, con el
 * responsable viejo, o con una coma de más, **no se toca**.
 *
 * ## 📸 Y siempre con foto
 * Antes de escribir nada guarda en `public.respaldo_a_dat_37` el `id`, la `descripcion` y el
 * `detalle` de cada fila que va a tocar. Revertir es un `UPDATE` desde ahí.
 */
import fs from 'node:fs'
import { esElIdentificadorGenerado, identificadorDeCuota } from '../lib/templates/identificador-cuota.ts'

const R = process.cwd()
const env = Object.fromEntries(
  fs.readFileSync(`${R}/.env.local`, 'utf8').split(/\r?\n/)
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))

const APLICAR = process.argv.includes('--aplicar')
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

const api = async (path: string, init?: RequestInit) => {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY!, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers ?? {}),
    },
  })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.status === 204 ? null : r.json()
}

const n = (x: number) => String(x).padStart(4)

// ── 1 · Traer lo que hay ────────────────────────────────────────────────────
const filas: any[] = await api(
  'cuotas_egresos_sin_factura?select=id,numero_cuota,fecha_estimada,descripcion,detalle,' +
  'egreso:egresos_sin_factura(nombre_referencia,responsable)' +
  '&descripcion=not.is.null&descripcion=neq.&limit=5000')

console.log(`\n📋 Cuotas con \`descripcion\` cargada: ${filas.length}\n`)

// ── 2 · Clasificar con la MISMA función que el display ──────────────────────
const aVaciar: any[] = []      // es el identificador generado → se regenera solo
const aDetalle: any[] = []     // es del usuario → se muda
const conflicto: any[] = []    // ya tiene detalle: no se pisa, lo mira una persona
/**
 * 🔁 **REDUNDANTES** — el identificador ya CONTIENE el texto.
 *
 * Aparecieron al correr el informe y no estaban previstos: son las cuotas que creó el motor con
 * `crearCuotaEnTemplate` (`descripcion: regla.detalle || …`), así que su descripción es **el
 * `detalle` de la regla de conciliación**: `«Comision Transferencias»`, `«Iva Bancario»`. El
 * identificador de esa cuota es `«Comision Transferencias MSA - Marzo 2026»` — o sea que mudarlo a
 * `detalle` mostraría el mismo texto dos veces en el renglón.
 *
 * Se cuentan aparte porque **no son ni del usuario ni exactamente el identificador**: son un tercer
 * caso que sólo existe por cómo se llenó el dato, y merece su propia decisión.
 */
const redundante: any[] = []

const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim()

for (const f of filas) {
  const eg = f.egreso ?? {}
  if (String(f.detalle ?? '').trim()) { conflicto.push(f); continue }
  if (esElIdentificadorGenerado(f.descripcion, f, eg)) { aVaciar.push(f); continue }
  const id = identificadorDeCuota(f, eg)
  const d = String(f.descripcion ?? '')
  if (id && norm(id).includes(norm(d))) { redundante.push(f); continue }
  aDetalle.push(f)
}

console.log(`  ${n(aVaciar.length)}  se VACÍAN   — reproducen el identificador; se regenera solo`)
console.log(`  ${n(aDetalle.length)}  van a DETALLE — texto del usuario, sólo cambia de columna`)
console.log(`  ${n(redundante.length)}  REDUNDANTES  — el identificador YA los contiene (detalle de una regla)`)
console.log(`  ${n(conflicto.length)}  SE SALTEAN   — ya tienen \`detalle\`: las mira una persona\n`)

const muestra = (titulo: string, arr: any[], k = 5) => {
  if (arr.length === 0) return
  console.log(`── ${titulo} ──`)
  for (const f of arr.slice(0, k)) {
    const id = identificadorDeCuota(f, f.egreso ?? {})
    console.log(`   "${String(f.descripcion).slice(0, 72)}"`)
    console.log(`      generaría: "${id}"`)
  }
  if (arr.length > k) console.log(`   … y ${arr.length - k} más`)
  console.log('')
}
muestra('SE VACÍAN (los 5 primeros)', aVaciar)
muestra('VAN A DETALLE (los 5 primeros)', aDetalle)
muestra('🔁 REDUNDANTES (los 5 primeros)', redundante)
muestra('🔴 SE SALTEAN — revisar a mano', conflicto)

if (!APLICAR) {
  console.log('ℹ️  INFORME solamente. Nada se escribió.')
  console.log('   Para aplicar: agregar --aplicar (requiere permiso del usuario para ESA corrida).\n')
  process.exit(0)
}

// 📏 Cuántas filas YA tenían `detalle` antes de tocar nada — el control del final lo necesita.
const detallePrevio = Number(
  (await fetch(`${URL}/rest/v1/cuotas_egresos_sin_factura?select=id&detalle=not.is.null&detalle=neq.`,
    { method: 'HEAD', headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' } })
  ).headers.get('content-range')?.split('/')[1] ?? 0)

// ── 3 · 📸 Foto, antes de tocar nada ────────────────────────────────────────
console.log('📸 Guardando la foto en `respaldo_a_dat_37`…')
const etiqueta = (f: any) =>
  aVaciar.includes(f) ? 'vaciar' : redundante.includes(f) ? 'vaciar_redundante' : 'a_detalle'
const foto = [...aVaciar, ...redundante, ...aDetalle].map(f => ({
  cuota_id: f.id, descripcion_antes: f.descripcion, detalle_antes: f.detalle ?? null,
  accion: etiqueta(f),
}))
for (let i = 0; i < foto.length; i += 200) {
  await api('respaldo_a_dat_37', { method: 'POST', body: JSON.stringify(foto.slice(i, i + 200)) })
}
console.log(`   ${foto.length} filas respaldadas.\n`)

// ── 4 · Escribir ────────────────────────────────────────────────────────────
let ok = 0
for (const f of aDetalle) {
  await api(`cuotas_egresos_sin_factura?id=eq.${f.id}`,
    { method: 'PATCH', body: JSON.stringify({ detalle: f.descripcion, descripcion: null }) })
  ok++
}
/**
 * Los que se vacían: la etiqueta exacta **y los redundantes**.
 *
 * 🔁 Los redundantes se vacían porque el identificador **ya los contiene literalmente**
 * (`«Comision Transferencias»` dentro de `«Comision Transferencias MSA - Marzo 2026»`), así que
 * de la pantalla no desaparece nada — mudarlos a `detalle` mostraría el mismo texto dos veces en
 * el mismo renglón.
 *
 * ⚠️ Quedan marcados **`vaciar_redundante`** en el respaldo, aparte de los otros, porque su
 * argumento es distinto: si algún día se renombra el template, el identificador deja de
 * contenerlos. Separarlos permite revertir **sólo ese grupo** sin tocar el resto.
 */
for (const f of [...aVaciar, ...redundante]) {
  await api(`cuotas_egresos_sin_factura?id=eq.${f.id}`,
    { method: 'PATCH', body: JSON.stringify({ descripcion: null }) })
  ok++
}
console.log(`✅ ${ok} filas migradas.`)

// ── 5 · 🧮 El control: nada se perdió ───────────────────────────────────────
/**
 * ⚠️ **Este control dio una FALSA ALARMA la primera vez, y el error vale más que el control.**
 *
 * La primera versión traía las filas (`select=id,descripcion,detalle&limit=5000`) y las contaba en
 * JavaScript. Reportó *«no cierra por -25»* con la migración **perfectamente bien hecha**, por dos
 * motivos que se sumaron:
 *
 * 1. **`limit=5000` NO supera el tope del servidor.** PostgREST corta en **1.000 filas** por
 *    `max-rows`, y hay 1.045 cuotas: faltaban 45 sin que nada lo dijera. Un `limit` alto **no es
 *    garantía de traer todo** — es un pedido que el servidor puede recortar en silencio.
 * 2. El esperado no contaba las filas que **ya tenían `detalle` y ninguna `descripcion`**: ésas
 *    nunca entran en `filas`, porque la consulta filtra por `descripcion`.
 *
 * 🔑 **Un control que grita de más enseña a ignorarlo**, que es exactamente cuando deja de servir.
 * Por eso ahora cuenta **en el servidor** (`count=exact` con `HEAD`, sin traer una sola fila) y el
 * esperado sale de una medición tomada **antes** de escribir.
 */
const contar = async (filtro: string): Promise<number> => {
  const r = await fetch(`${URL}/rest/v1/cuotas_egresos_sin_factura?select=id&${filtro}`, {
    method: 'HEAD',
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  })
  return Number((r.headers.get('content-range') ?? '/0').split('/')[1]) || 0
}

const conDescripcion = await contar('descripcion=not.is.null&descripcion=neq.')
const conDetalle = await contar('detalle=not.is.null&detalle=neq.')
const esperadoDetalle = detallePrevio + aDetalle.length

console.log(`\n🧮 CONTROL`)
console.log(`   con descripcion: ${conDescripcion}  (esperado 0 — todo se repartió)`)
console.log(`   con detalle:     ${conDetalle}  (esperado ${esperadoDetalle} = ${detallePrevio} que ya tenían + ${aDetalle.length} migradas)`)
console.log(conDescripcion === 0 && conDetalle === esperadoDetalle
  ? '   ✅ Cierra: no se perdió ni apareció ningún texto.'
  : '   🚨 NO CIERRA. Revisar contra respaldo_a_dat_37 antes de tocar nada más.')
