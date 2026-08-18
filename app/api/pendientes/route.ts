/**
 * GET /api/pendientes?rol=admin
 *
 * Devuelve el índice de `PENDIENTES.md` parseado, para el panel de la app (P-37).
 *
 * 🔒 **Lee el archivo del repo. NO hay copia en base de datos.**
 * `PENDIENTES.md` es la fuente única (CLAUDE.md § dimensión 1): una tabla espejo se
 * desincronizaría al primer commit y tendríamos dos verdades. Como el archivo viaja en el bundle
 * del deploy, lo que muestra el panel es siempre lo del commit que está publicado.
 *
 * ⚠️ Para que el `.md` llegue al servidor en Vercel hace falta `outputFileTracingIncludes` en
 * `next.config.mjs`. Sin eso el endpoint anda en local y tira 500 en producción.
 *
 * Respuesta:
 *   { grupos: {urgente,secundario,test,hecho}, pendientes: [...], noParseadas: [...],
 *     ignoradas: [...], totalDetectadas, generado_at }
 */

import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parsePendientes, contarPorGrupo } from '@/lib/pendientes/parse'

export const runtime = 'nodejs'   // usa fs: no puede ser edge

/**
 * El archivo sólo cambia con un deploy, así que se parsea una vez por instancia.
 * (7.800 líneas: parsearlo en cada request sería gratis igual, pero no hay motivo.)
 */
let cache: { data: unknown; at: string } | null = null

export async function GET(request: Request) {
  try {
    // Mismo criterio que el resto de la app: el rol es UX, no seguridad — no hay login real
    // (ver CLAUDE.md § Accesos y roles). Se valida igual para no exponer la lista por defecto.
    const rol = new URL(request.url).searchParams.get('rol')
    if (rol !== 'admin') {
      return NextResponse.json({ error: 'Sólo admin' }, { status: 403 })
    }

    if (!cache) {
      const md = await readFile(path.join(process.cwd(), 'PENDIENTES.md'), 'utf8')
      const r = parsePendientes(md)
      cache = {
        at: new Date().toISOString(),
        data: {
          grupos: contarPorGrupo(r.pendientes),
          pendientes: r.pendientes,
          noParseadas: r.noParseadas,
          ignoradas: r.ignoradas,
          totalDetectadas: r.totalDetectadas,
        },
      }
    }

    return NextResponse.json({ ...(cache.data as object), generado_at: cache.at })
  } catch (err) {
    // Si el .md no llegó al bundle, el error es éste y hay que mirar next.config.mjs.
    console.error('Error leyendo PENDIENTES.md:', err)
    return NextResponse.json(
      { error: 'No se pudo leer PENDIENTES.md: ' + (err as Error).message },
      { status: 500 },
    )
  }
}
