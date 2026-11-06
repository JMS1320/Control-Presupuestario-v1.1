/**
 * POST /api/gas/respaldo — el respaldo del balance en el Drive (A-FEAT-1571 paso 2).
 *
 * `{ accion: "copiar", destino_ruta, items: [{ file_id, subcarpeta, nombre }] }` → el GAS copia cada documento a
 *   «<destino>/<subcarpeta>/<nombre>» (sin pisar: lo que ya está se saltea).
 * `{ accion: "zip", origen_ruta, destino_ruta, subcarpeta, nombre }` → un zip con la carpeta del banco y sus subcarpetas.
 *
 * Sólo copia y crea: nunca mueve ni borra. Env: `GAS_BUSCAR_PDF_URL`, `GAS_AUTH_TOKEN`. Necesita el GAS 0.23.0.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const url = process.env.GAS_BUSCAR_PDF_URL
  const token = process.env.GAS_AUTH_TOKEN
  if (!url || !token) return NextResponse.json({ ok: false, error: "GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados" }, { status: 500 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* vacío */ }
  const accion = body.accion === "zip" ? "respaldo_zip" : body.accion === "copiar" ? "respaldo_copiar" : null
  if (!accion) return NextResponse.json({ ok: false, error: "accion tiene que ser «copiar» o «zip»." }, { status: 400 })
  if (typeof body.destino_ruta !== "string" || !body.destino_ruta.trim()) return NextResponse.json({ ok: false, error: "Falta la carpeta destino." }, { status: 400 })

  let txt: string
  try {
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, _token: token, accion }),
      signal: AbortSignal.timeout(58_000),
    })
    txt = await r.text()
    if (!r.ok) return NextResponse.json({ ok: false, error: `El GAS respondió HTTP ${r.status}: ${txt.slice(0, 200)}` }, { status: 502 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: `No se pudo contactar al GAS: ${(e as Error).message}` }, { status: 502 })
  }
  try {
    const j = JSON.parse(txt)
    if (j?.ok === undefined) return NextResponse.json({ ok: false, error: "El GAS desplegado no conoce esta acción: subí la versión 0.23.0 (Implementar → Gestionar implementaciones → Nueva versión)." }, { status: 502 })
    return NextResponse.json(j)
  } catch {
    return NextResponse.json({ ok: false, error: "El GAS no devolvió JSON: " + txt.slice(0, 160) }, { status: 502 })
  }
}
