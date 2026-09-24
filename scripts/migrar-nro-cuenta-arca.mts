/**
 * 🔢 **A-DAT-48 — las facturas de ARCA que tienen el NOMBRE de la cuenta y no su NÚMERO.**
 *
 * ```
 * node --experimental-strip-types scripts/migrar-nro-cuenta-arca.mts            # INFORME, no escribe
 * node --experimental-strip-types scripts/migrar-nro-cuenta-arca.mts --aplicar  # escribe
 * ```
 *
 * ## Qué corrige, y por qué en la FACTURA y no en el extracto
 * El audit ([A-FEAT-145](../PENDIENTES.md#a-feat-145)) marcó **13 movimientos de ARCA conciliados
 * sin `nro_cuenta`**. Al mirarlos, **12 de 13 apuntan a una factura que tampoco lo tiene**: el hueco
 * no está en la línea del banco, está en el comprobante.
 *
 * 🔑 **Corregir el movimiento sería tapar el síntoma.** La imputación del movimiento es **derivada**
 * de su factura; si se rellena el extracto y la factura sigue vacía, la próxima conciliación vuelve
 * a propagar el vacío — y además el **Libro IVA y el subdiario** siguen mal, porque leen la factura.
 *
 * ## Por qué es seguro
 * Es **derivación pura**: el nombre ya está escrito en `cuenta_contable`; sólo falta buscar su
 * número en el plan. Medido el 2026-09-13: los **27 nombres distintos resuelven exacto** — una sola
 * coincidencia cada uno, **cero ambiguos y cero fuera del plan**. No se inventa ninguna imputación.
 *
 * 🛑 **Lo que NO toca**: las **152 facturas sin ninguna cuenta** (ni nombre ni número). Ésas no se
 * pueden derivar de nada y necesitan criterio — se listan al final para que se decidan a mano.
 *
 * ## 📸 Foto previa en `public.respaldo_a_dat_48`
 * Con `id`, `schema`, `cuenta_contable` y el `nro_cuenta` anterior. Revertir es un `UPDATE` desde ahí.
 */
import fs from 'node:fs'

const R = process.cwd()
const env = Object.fromEntries(
  fs.readFileSync(`${R}/.env.local`, 'utf8').split(/\r?\n/)
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))

const APLICAR = process.argv.includes('--aplicar')
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

/** 🔑 Un 2xx sin cuerpo es éxito: PostgREST responde el INSERT con 201 y cuerpo vacío. */
async function api(path: string, init: RequestInit & { schema?: string } = {}) {
  const { schema, ...rest } = init
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
      ...(schema ? { 'Accept-Profile': schema, 'Content-Profile': schema } : {}),
      ...(rest.headers ?? {}),
    },
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${txt}`)
  return txt.trim() ? JSON.parse(txt) : null
}

/** ⚠️ PostgREST corta en 1.000 filas pase el limit que le pases. */
async function traerTodo(path: string, schema: string): Promise<any[]> {
  const PASO = 1000, filas: any[] = []
  for (let d = 0; ; d += PASO) {
    const lote = await api(path, { schema, headers: { Range: `${d}-${d + PASO - 1}` } }) ?? []
    filas.push(...lote)
    if (lote.length < PASO) return filas
  }
}

const norm = (s: string) => s.trim().toUpperCase()

// El plan de cuentas: nombre → número. Sólo se usa si el nombre resuelve a UNA sola cuenta.
const plan = await traerTodo('cuentas_contables?select=categ,nro_cuenta', 'public')
const porNombre = new Map<string, string[]>()
for (const c of plan) {
  const n = norm(String(c.categ ?? ''))
  if (!n || !String(c.nro_cuenta ?? '').trim()) continue
  porNombre.set(n, [...(porNombre.get(n) ?? []), String(c.nro_cuenta).trim()])
}

const SCHEMAS = ['msa', 'pam', 'ma']
type Fila = { schema: string; id: string; nombre: string; nro: string }
const aplicables: Fila[] = []
const ambiguos: Fila[] = []
const fueraDelPlan: { schema: string; id: string; nombre: string }[] = []
const sinNingunaCuenta: { schema: string; id: string; emisor: string }[] = []

for (const schema of SCHEMAS) {
  const fs_ = await traerTodo(
    'comprobantes_arca?select=id,nro_cuenta,cuenta_contable,denominacion_emisor', schema)
  for (const f of fs_) {
    if (String(f.nro_cuenta ?? '').trim()) continue          // ya lo tiene: no se toca
    const nombre = String(f.cuenta_contable ?? '').trim()
    if (!nombre) { sinNingunaCuenta.push({ schema, id: f.id, emisor: f.denominacion_emisor }); continue }

    const nros = porNombre.get(norm(nombre)) ?? []
    if (nros.length === 1) aplicables.push({ schema, id: f.id, nombre, nro: nros[0] })
    else if (nros.length > 1) ambiguos.push({ schema, id: f.id, nombre, nro: nros.join(' | ') })
    else fueraDelPlan.push({ schema, id: f.id, nombre })
  }
}

console.log(`\n${APLICAR ? '✍️  APLICANDO' : '🔍 INFORME (no escribe nada)'}\n`)
console.log(`  ✅ Se pueden derivar     ${String(aplicables.length).padStart(4)}  facturas`)
console.log(`  ⚠️  Nombre ambiguo        ${String(ambiguos.length).padStart(4)}`)
console.log(`  🔴 Nombre fuera del plan ${String(fueraDelPlan.length).padStart(4)}`)
console.log(`  🛑 Sin ninguna cuenta    ${String(sinNingunaCuenta.length).padStart(4)}  (no se derivan: necesitan criterio)`)

const porCuenta = new Map<string, number>()
for (const a of aplicables) porCuenta.set(`${a.nro} · ${a.nombre}`, (porCuenta.get(`${a.nro} · ${a.nombre}`) ?? 0) + 1)
console.log(`\n  Las ${porCuenta.size} cuentas que se van a escribir:`)
for (const [k, n] of [...porCuenta.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(4)} × ${k}`)
}
for (const a of ambiguos) console.log(`  ⚠️  ambiguo: "${a.nombre}" → ${a.nro}`)
for (const f of fueraDelPlan) console.log(`  🔴 fuera del plan: "${f.nombre}"`)

if (!APLICAR) {
  console.log('\n📌 Nada se escribió. Para aplicar: agregar --aplicar\n')
  process.exit(0)
}

// 📸 Foto ANTES de tocar nada.
await api('respaldo_a_dat_48', {
  method: 'POST', schema: 'public',
  body: JSON.stringify(aplicables.map(a => ({
    comprobante_id: a.id, schema_bd: a.schema, cuenta_contable: a.nombre, nro_cuenta_anterior: null,
  }))),
})
console.log(`\n📸 Foto de ${aplicables.length} filas en public.respaldo_a_dat_48`)

let escritas = 0
for (const a of aplicables) {
  await api(`comprobantes_arca?id=eq.${a.id}`, {
    method: 'PATCH', schema: a.schema, body: JSON.stringify({ nro_cuenta: a.nro }),
  })
  escritas++
  if (escritas % 25 === 0) console.log(`   ${escritas}/${aplicables.length}…`)
}
console.log(`\n✅ ${escritas} facturas actualizadas.`)

// 🧮 El control: volver a contar desde la base, no desde la variable.
let quedan = 0
for (const schema of SCHEMAS) {
  const fs2 = await traerTodo('comprobantes_arca?select=id,nro_cuenta,cuenta_contable', schema)
  quedan += fs2.filter(f => !String(f.nro_cuenta ?? '').trim() && String(f.cuenta_contable ?? '').trim()).length
}
console.log(quedan === 0
  ? '🧮 Control: no queda ninguna factura con nombre de cuenta y sin número. ✅'
  : `🧮 Control: 🔴 quedan ${quedan} sin número — revisar.`)
