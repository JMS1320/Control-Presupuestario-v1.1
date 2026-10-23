/**
 * Parseo de la CAJA DE AHORRO de PAM con EL MISMO parser y LAS MISMAS reglas que usa el importador
 * (`app/api/import-excel-ca/route.ts`), para que el histórico quede igual que lo que importa la app.
 * Lo llama `scripts/historico_pam_cargar.py`. Sólo lee la base (las reglas de parseo).
 *
 *   npx tsx scripts/historico_pam_parseo_ca.mts <entrada.json> <salida.json>
 *   entrada: [{ "raw": "texto del Movimiento" }, ...]   salida: [{ ...campos parseados }, ...]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parsearMovimiento, cargarReglasParseo } from '../lib/extractos/parseo-movimiento'

const env: Record<string, string> = {}
for (const l of readFileSync('.env.local', 'utf-8').split(/\r?\n/)) {
  const i = l.indexOf('=')
  if (i > 0 && !l.trim().startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const [entrada, salida] = process.argv.slice(2)
const mapa = await cargarReglasParseo(supabase, 'pam_galicia')
if (!Object.keys(mapa).length) throw new Error('No se cargaron reglas de parseo para «pam_galicia»')
const filas: { raw: string }[] = JSON.parse(readFileSync(entrada, 'utf-8'))
writeFileSync(salida, JSON.stringify(filas.map((f) => parsearMovimiento(f.raw, mapa))))
console.log(`parseadas ${filas.length} filas con ${Object.keys(mapa).length} tipos de regla`)
