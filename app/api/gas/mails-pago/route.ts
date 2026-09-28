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
    /**
     * ⚠️ **Falta la variable — pero el arreglo NO es el mismo en local que en Vercel**, y decir
     * sólo *«no está configurada»* deja al usuario adivinando cuál de las dos cosas hacer.
     *
     * Pasó apenas se entregó el fix (2026-09-28): el cartel era correcto y **aun así no ayudaba**,
     * porque la causa más común en local es que el `npm run dev` **venía corriendo desde antes** de
     * que la variable existiera — Next lee el entorno al arrancar, no en cada request.
     */
    const enVercel = !!process.env.VERCEL
    return NextResponse.json({
      ok: false,
      error: enVercel
        ? "Falta GAS_MAILS_PAGO_URL en Vercel. Cargala en Settings → Environment Variables " +
          "(para Production y Preview) y volvé a desplegar: las variables se toman en el build."
        : "Falta GAS_MAILS_PAGO_URL en el servidor local. Si ya está en .env.local, el motivo es " +
          "que el «npm run dev» venía corriendo desde antes: paralo y arrancalo de nuevo, porque " +
          "Next lee las variables al arrancar.",
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

  /**
   * 🔴 **Apps Script devuelve HTTP 200 aunque el script haya REVENTADO.**
   *
   * Cuando `doGet` lanza una excepción, Google sirve **una página de error HTML con status 200** —
   * no un 5xx. Así que el status **no sirve** para saber si anduvo: lo único que lo dice es
   * **que la respuesta sea el JSON** que el script produce cuando llega al final.
   *
   * 🧨 Esto no es teórico, es [A-BUG-1217]: el 28/09 la app cantó *«Borrador preparado»* con el
   * mail todavía en la cola, porque miraba el status y no el contenido. El cuerpo tenía, en texto
   * plano, la causa exacta: `Supabase 401: permission denied for table mails_pago`.
   *
   * 📌 Por eso se busca primero la **primera hipótesis descartada** (login) y después se **extrae
   * el mensaje de error de Apps Script**, que viene en el último `<div>` de esa página. Mostrar
   * *ese* texto en vez de 500 caracteres de HTML es la diferencia entre diagnosticar en 10 segundos
   * y no poder.
   */
  const pareceLogin = /accounts\.google\.com|<title>\s*Iniciar sesión|Sign in/i.test(txt)
  if (pareceLogin) {
    return NextResponse.json({
      ok: false,
      error: "El GAS devolvió la pantalla de login de Google. El despliegue tiene que ser accesible " +
             "para «Cualquier usuario» (Apps Script → Implementar → Quién tiene acceso).",
    }, { status: 502 })
  }

  let datos: unknown
  try {
    datos = JSON.parse(txt)
  } catch {
    // La página de error de Apps Script termina en un <div> con el mensaje. Se saca de ahí.
    const m = txt.match(/<div[^>]*monospace[^>]*>([\s\S]*?)<\/div>/i)
    const crudo = (m?.[1] ?? txt)
      .replace(/<[^>]*>/g, " ")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
      .replace(/\s+/g, " ").trim()
    return NextResponse.json({
      ok: false,
      error: crudo
        ? `El script falló: ${crudo.slice(0, 300)}`
        : "El GAS no devolvió JSON (suele ser un error del script o una redirección del despliegue).",
    }, { status: 502 })
  }

  return NextResponse.json({ ok: true, id: id ?? null, respuesta: JSON.stringify(datos).slice(0, 500) })
}
