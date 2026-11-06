/**
 * POST /api/gas/ordenar-boletas — A-FEAT-1567: renombra y MUEVE en el Drive las boletas de ARBA ya leídas, con el nombre y
 * la carpeta de JMS. `{ items: [{ file_id, nombre, carpeta }] }` → `{ ok, resultados }`. Nunca borra ni pisa (GAS 0.22.0).
 * Env: `GAS_BUSCAR_PDF_URL`, `GAS_AUTH_TOKEN`.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const url = process.env.GAS_BUSCAR_PDF_URL
  const token = process.env.GAS_AUTH_TOKEN
  if (!url || !token) return NextResponse.json({ ok: false, error: "GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados" }, { status: 500 })
  let b: { items?: unknown } = {}
  try { b = await request.json() } catch { /* vacío */ }
  const items = Array.isArray(b.items) ? b.items.filter((x): x is { file_id: string; nombre: string; carpeta: string } =>
    !!x && typeof x.file_id === "string" && typeof x.nombre === "string" && typeof x.carpeta === "string") : []
  if (!items.length) return NextResponse.json({ ok: false, error: "No hay archivos para ordenar." }, { status: 400 })
  try {
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _token: token, accion: "ordenar_boletas_arba", items }),
      signal: AbortSignal.timeout(55_000),
    })
    const txt = await r.text()
    if (!r.ok) return NextResponse.json({ ok: false, error: `El GAS respondió HTTP ${r.status}: ${txt.slice(0, 200)}` }, { status: 502 })
    const j = JSON.parse(txt)
    if (!Array.isArray(j?.resultados)) return NextResponse.json({ ok: false, error: "El GAS desplegado no sabe ordenar: subí la versión 0.22.0 (Nueva versión)." }, { status: 502 })
    return NextResponse.json(j)
  } catch (e) {
    return NextResponse.json({ ok: false, error: `No se pudo ordenar: ${(e as Error).message}` }, { status: 502 })
  }
}
