/**
 * POST /api/gas/archivar-mail — guarda los adjuntos de UN mail en la carpeta del archivo digital (A-FEAT-1442 etapa 2).
 *
 * `{ message_id, carpeta_id, anio }` → el GAS (`archivar_mail`, Carpetas.gs) usa la carpeta elegida → la del año
 * (si existe la usa, si no la crea) y guarda cada PDF/imagen como «AAAA-MM-DD - nombre». Si ya hay un archivo con ese
 * nombre, NO lo pisa ni lo duplica: lo devuelve como «ya estaba». Env: `GAS_BUSCAR_PDF_URL`, `GAS_AUTH_TOKEN`.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const url = process.env.GAS_BUSCAR_PDF_URL
  const token = process.env.GAS_AUTH_TOKEN
  if (!url || !token) return NextResponse.json({ ok: false, error: "GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados" }, { status: 500 })
  let b: { message_id?: unknown; carpeta_id?: unknown; anio?: unknown } = {}
  try { b = await request.json() } catch { /* vacío */ }
  const messageId = typeof b.message_id === "string" ? b.message_id : ""
  const carpetaId = typeof b.carpeta_id === "string" ? b.carpeta_id : ""
  if (!messageId || !carpetaId) return NextResponse.json({ ok: false, error: "Falta el mail o la carpeta." }, { status: 400 })
  try {
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _token: token, accion: "archivar_mail", message_id: messageId, carpeta_id: carpetaId, anio: Number(b.anio) || undefined }),
      signal: AbortSignal.timeout(55_000),
    })
    const txt = await r.text()
    if (!r.ok) return NextResponse.json({ ok: false, error: `El GAS respondió HTTP ${r.status}: ${txt.slice(0, 200)}` }, { status: 502 })
    const j = JSON.parse(txt)
    if (j?.ok === undefined) return NextResponse.json({ ok: false, error: "El GAS desplegado no conoce esta acción: subí la versión 0.20.0 (Nueva versión)." }, { status: 502 })
    return NextResponse.json(j)
  } catch (e) {
    return NextResponse.json({ ok: false, error: `No se pudo archivar: ${(e as Error).message}` }, { status: 502 })
  }
}
