/**
 * POST /api/gas/leer-archivo — el texto de un documento ya archivado en el Drive (A-FEAT-1442 etapa 3).
 * `{ file_id }` → `{ ok, nombre, texto }`. Sólo lee (el OCR del buscador de facturas). Env: `GAS_BUSCAR_PDF_URL`, `GAS_AUTH_TOKEN`.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const url = process.env.GAS_BUSCAR_PDF_URL
  const token = process.env.GAS_AUTH_TOKEN
  if (!url || !token) return NextResponse.json({ ok: false, error: "GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados" }, { status: 500 })
  let b: { file_id?: unknown } = {}
  try { b = await request.json() } catch { /* vacío */ }
  const fileId = typeof b.file_id === "string" ? b.file_id : ""
  if (!fileId) return NextResponse.json({ ok: false, error: "Falta el archivo." }, { status: 400 })
  try {
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _token: token, accion: "leer_archivo", file_id: fileId }),
      signal: AbortSignal.timeout(55_000),
    })
    const txt = await r.text()
    if (!r.ok) return NextResponse.json({ ok: false, error: `El GAS respondió HTTP ${r.status}: ${txt.slice(0, 200)}` }, { status: 502 })
    const j = JSON.parse(txt)
    if (j?.ok === undefined) return NextResponse.json({ ok: false, error: "El GAS desplegado no conoce esta acción: subí la versión 0.20.0 (Nueva versión)." }, { status: 502 })
    return NextResponse.json(j)
  } catch (e) {
    return NextResponse.json({ ok: false, error: `No se pudo leer el archivo: ${(e as Error).message}` }, { status: 502 })
  }
}
