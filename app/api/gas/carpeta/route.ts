/**
 * POST /api/gas/carpeta — la carpeta del archivo digital en el Drive (A-FEAT-1442).
 *
 * `{ ruta }`  → el GAS la busca desde «Mi unidad» como la escribe el usuario en su PC y devuelve su id.
 * `{ id }`    → dónde está HOY esa carpeta (si el usuario la movió, la app muestra la ruta nueva).
 *
 * Sólo busca: no crea ni mueve nada (la del año la crea el GAS al archivar). Env: `GAS_BUSCAR_PDF_URL`, `GAS_AUTH_TOKEN`.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: Request) {
  const url = process.env.GAS_BUSCAR_PDF_URL
  const token = process.env.GAS_AUTH_TOKEN
  if (!url || !token) return NextResponse.json({ ok: false, error: "GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados" }, { status: 500 })

  let body: { ruta?: unknown; id?: unknown } = {}
  try { body = await request.json() } catch { /* vacío */ }
  const ruta = typeof body.ruta === "string" ? body.ruta.trim() : ""
  const id = typeof body.id === "string" ? body.id.trim() : ""
  if (!ruta && !id) return NextResponse.json({ ok: false, error: "Falta la ruta o el id de la carpeta." }, { status: 400 })

  let txt: string
  try {
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ruta ? { _token: token, accion: "resolver_carpeta", ruta } : { _token: token, accion: "info_carpeta", id }),
      signal: AbortSignal.timeout(25_000),
    })
    txt = await r.text()
    if (!r.ok) return NextResponse.json({ ok: false, error: `El GAS respondió HTTP ${r.status}: ${txt.slice(0, 200)}` }, { status: 502 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: `No se pudo contactar al GAS: ${(e as Error).message}` }, { status: 502 })
  }
  try {
    const j = JSON.parse(txt)
    // Un GAS anterior a 0.20.0 no conoce la acción y cae en la búsqueda de facturas: se dice qué hacer
    if (j?.ok === undefined) return NextResponse.json({ ok: false, error: "El GAS desplegado no conoce esta acción: subí la versión 0.20.0 (Implementar → Gestionar implementaciones → Nueva versión)." }, { status: 502 })
    return NextResponse.json(j)
  } catch {
    return NextResponse.json({ ok: false, error: "El GAS no devolvió JSON: " + txt.slice(0, 160) }, { status: 502 })
  }
}
