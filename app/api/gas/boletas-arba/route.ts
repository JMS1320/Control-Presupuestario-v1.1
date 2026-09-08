/**
 * POST /api/gas/boletas-arba — le pide al GAS que baje del mail las boletas de ARBA (A-FEAT-95).
 *
 * `{ solo_contar: true }` informa **qué encontraría sin guardar nada**. Es el mismo patrón que el
 * «Contar (no vincula)» de las facturas, que ya enseñó que separar *mirar* de *escribir* evita el
 * susto de una corrida que hizo cosas que nadie esperaba.
 *
 * 🔴 **Esto NO toca los templates.** Baja PDFs y los archiva. El importe se compara y se aplica
 * después, con el visto bueno del usuario, desde la pantalla «🏛️ Boletas ARBA».
 *
 * Env: `GAS_BUSCAR_PDF_URL`, `GAS_AUTH_TOKEN`.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

/** Por debajo de `maxDuration`: así la ruta alcanza a devolver un error EXPLICADO en vez de que la plataforma la mate. */
const TOPE_GAS_MS = 45_000

export async function POST(request: Request) {
  const url = process.env.GAS_BUSCAR_PDF_URL
  const token = process.env.GAS_AUTH_TOKEN
  if (!url || !token) {
    return NextResponse.json({ ok: false, error: "GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados" }, { status: 500 })
  }

  let soloContar = true
  let dias: number | undefined
  try {
    const body = await request.json()
    soloContar = body?.solo_contar !== false
    // La ventana de búsqueda la elige el usuario desde la pantalla. Achicarla es lo primero que hay
    // que probar cuando la bajada no llega a tiempo.
    if (Number(body?.dias) > 0) dias = Math.round(Number(body.dias))
  } catch { /* body vacío = contar */ }

  let r: Response
  try {
    r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _token: token, accion: "boletas_arba", solo_contar: soloContar, dias,
        // El GAS corta solo antes que nosotros: así devuelve «quedaron N» en vez de morir mudo.
        presupuesto_ms: TOPE_GAS_MS - 10_000,
      }),
      signal: AbortSignal.timeout(TOPE_GAS_MS),
    })
  } catch (e) {
    const err = e as Error
    const msg = err.name === "TimeoutError" || err.name === "AbortError"
      ? `El GAS no respondió en ${TOPE_GAS_MS / 1000}s. Si hay muchos mails, achicá la ventana en la Script Property ARBA_QUERY (ej. newer_than:15d).`
      : `No se pudo contactar al GAS: ${err.message}`
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }

  // Se lee como texto primero: el GAS devuelve HTML cuando hay problema de permisos o una
  // redirección del despliegue, y mostrarlo recortado dice mucho más que «Unexpected token <».
  const txt = await r.text()
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: `El GAS respondió HTTP ${r.status}: ${txt.slice(0, 200)}` }, { status: 502 })
  }
  try {
    return NextResponse.json({ ok: true, solo_contar: soloContar, ...JSON.parse(txt) })
  } catch {
    return NextResponse.json({
      ok: false,
      error: "El GAS no devolvió JSON. Suele ser permisos o una redirección del despliegue. Empieza con: " + txt.slice(0, 160),
    }, { status: 502 })
  }
}
