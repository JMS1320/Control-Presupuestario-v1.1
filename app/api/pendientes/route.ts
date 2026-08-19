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
 * ⚠️ SIN CACHE, a propósito.
 *
 * Había un cache en memoria ("el archivo sólo cambia con un deploy"). **Era falso en desarrollo**:
 * el `.md` cambia todo el tiempo —se agregan pendientes, se renumeran IDs— y el endpoint seguía
 * sirviendo la versión con la que arrancó el server. Peor: si la forma de la respuesta cambia
 * (campos nuevos), el cliente recibe la vieja y **explota al leer un campo que no está**.
 *
 * Parsear 7.800 líneas son ~10 ms. No vale una sola sorpresa.
 */

export async function GET(request: Request) {
  try {
    // Mismo criterio que el resto de la app: el rol es UX, no seguridad — no hay login real
    // (ver CLAUDE.md § Accesos y roles). Se valida igual para no exponer la lista por defecto.
    const rol = new URL(request.url).searchParams.get('rol')
    if (rol !== 'admin') {
      return NextResponse.json({ error: 'Sólo admin' }, { status: 403 })
    }

    const md = await readFile(path.join(process.cwd(), 'PENDIENTES.md'), 'utf8')
    const r = parsePendientes(md)

    return NextResponse.json({
      grupos: contarPorGrupo(r.pendientes),
      pendientes: r.pendientes,
      noParseadas: r.noParseadas,
      ignoradas: r.ignoradas,
      marcasDesconocidas: r.marcasDesconocidas,
      totalDetectadas: r.totalDetectadas,
      generado_at: new Date().toISOString(),
    })
  } catch (err) {
    // Si el .md no llegó al bundle, el error es éste y hay que mirar next.config.mjs.
    console.error('Error leyendo PENDIENTES.md:', err)
    return NextResponse.json(
      { error: 'No se pudo leer PENDIENTES.md: ' + (err as Error).message },
      { status: 500 },
    )
  }
}
