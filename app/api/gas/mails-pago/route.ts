/**
 * POST /api/gas/mails-pago — le pide al GAS que prepare el/los borradores de Detalle de pago.
 *
 * 🐞 **Nace de [A-BUG-1216]**: *«Error disparando el GAS: Failed to fetch»*. El panel de mails era
 * **el único lugar de la app que llamaba al GAS desde el navegador** — las otras 7 integraciones
 * ya iban por `/api/gas/*`. Llamaba a una URL que el usuario había pegado a mano y que quedaba en
 * `localStorage.gas_mails_url`, con `mode: "no-cors"`.
 *
 * Eso traía **dos problemas**, y el segundo es el peor:
 *
 * 1. **La URL envejecía sin arreglo posible.** Apps Script cambia la URL `/exec` en cada re-deploy,
 *    y la pantalla sólo la preguntaba si `localStorage` estaba vacío: una vez guardada, no había
 *    forma de corregirla. Ahora vive en `GAS_MAILS_PAGO_URL`, en un solo lugar y para todos.
 *
 * 2. 🔴 **`no-cors` devuelve una respuesta OPACA: la app no podía saber si el GAS hizo algo.**
 *    Mostraba *«Preparando borrador… revisá Gmail»* con sólo que el request saliera. O sea que el
 *    caso inverso —decir que anduvo y no haber borrador— **era invisible**. Yendo por el servidor
 *    no hay CORS, así que se lee la respuesta de verdad y el éxito se puede **afirmar**, no suponer
 *    (§ 🧮 de `CLAUDE.md`: nada se descarta en silencio).
 *
 * 📌 **El contrato con el GAS no se toca**: sigue siendo un `GET` a `…/exec?id=<uuid>` (o sin `id`
 * para los pendientes), que es lo que ese Apps Script entiende hoy. Acá cambia **quién** lo llama,
 * no **qué** se le pide — así el arreglo no depende de re-desplegar el script.
 *
 * 🔑 **Sin token, a propósito**: este despliegue no valida uno (a diferencia de `GAS_BUSCAR_PDF_URL`,
 * que sí). El secreto es la URL misma, y por eso ahora vive en una env var y no en el navegador.
 *
 * Env: `GAS_MAILS_PAGO_URL`.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

/** Debajo de `maxDuration`, para alcanzar a devolver un error explicado en vez de que nos maten. */
const TOPE_GAS_MS = 50_000

export async function POST(request: Request) {
  const base = process.env.GAS_MAILS_PAGO_URL
  if (!base) {
    return NextResponse.json({
      ok: false,
      error: "GAS_MAILS_PAGO_URL no está configurada. Es la URL del Apps Script de mails de pago " +
             "desplegado como Web App (Apps Script → Implementar → Aplicación web → URL /exec).",
    }, { status: 500 })
  }

  // `id` = un mail puntual. Sin `id`, el GAS prepara todos los pendientes — por eso se manda
  // sólo cuando viene, y nunca por omisión.
  let id: string | undefined
  try {
    const body = await request.json()
    if (typeof body?.id === "string" && body.id.trim()) id = body.id.trim()
  } catch { /* sin body = todos los pendientes */ }

  const url = id ? `${base}?id=${encodeURIComponent(id)}` : base

  let r: Response
  try {
    r = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(TOPE_GAS_MS) })
  } catch (e) {
    const err = e as Error
    const msg = err.name === "TimeoutError" || err.name === "AbortError"
      ? `El GAS no respondió en ${TOPE_GAS_MS / 1000}s.`
      // Éste es el que antes llegaba como «Failed to fetch» y no decía nada: ahora se ve el motivo.
      : `No se pudo contactar al GAS: ${err.message}. Suele ser que GAS_MAILS_PAGO_URL quedó vieja ` +
        `(Apps Script cambia la URL en cada re-deploy).`
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }

  // Se lee como texto primero: el GAS devuelve **HTML** cuando hay problema de permisos o una
  // redirección del despliegue, y mostrarlo recortado dice mucho más que un error genérico.
  const txt = await r.text()
  if (!r.ok) {
    return NextResponse.json({
      ok: false,
      error: `El GAS respondió HTTP ${r.status}: ${txt.slice(0, 200)}`,
    }, { status: 502 })
  }

  // ⚠️ Un despliegue con acceso restringido responde **200 con la pantalla de login de Google**.
  // Sin esta verificación eso pasaría por éxito — que es exactamente el agujero que vino a tapar
  // esta ruta.
  const pareceLogin = /accounts\.google\.com|<title>\s*Iniciar sesión|Sign in/i.test(txt)
  if (pareceLogin) {
    return NextResponse.json({
      ok: false,
      error: "El GAS devolvió la pantalla de login de Google. El despliegue tiene que ser accesible " +
             "para «Cualquier usuario» (Apps Script → Implementar → Quién tiene acceso).",
    }, { status: 502 })
  }

  return NextResponse.json({ ok: true, id: id ?? null, respuesta: txt.slice(0, 500) })
}
