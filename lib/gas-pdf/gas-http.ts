/**
 * Habla con el GAS del buscador de PDFs y devuelve su JSON, o tira un error que se entiende solo.
 *
 * Las tres formas de fallar que se veían todas igual —tiempo agotado, HTTP no-200, y respuesta que
 * no es JSON (el GAS devuelve HTML cuando hay problema de permisos o redirección)— dicen cuál fue.
 * El cuerpo se lee como texto primero para poder mostrar el HTML recortado en vez de un
 * `Unexpected token < in JSON`, que no le sirve a nadie.
 *
 * `topeMs` va POR DEBAJO del `maxDuration` de la ruta: si no, la plataforma mata la ruta desde afuera,
 * el `catch` nunca corre y el navegador recibe un error pelado, sin motivo.
 */
export async function pedirAlGas(url: string, payload: unknown, etiqueta: string, topeMs = 45_000): Promise<any> {
  let r: Response
  try {
    r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(topeMs),
    })
  } catch (e) {
    const err = e as Error
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error(
        `El GAS no respondió en ${topeMs / 1000}s (${etiqueta}). ` +
        `Suele ser el OCR: probá con menos archivos por tanda.`
      )
    }
    throw new Error(`No se pudo contactar al GAS (${etiqueta}): ${err.message}`)
  }

  const txt = await r.text()
  if (!r.ok) {
    throw new Error(`El GAS respondió HTTP ${r.status} (${etiqueta}): ${txt.slice(0, 200)}`)
  }
  try {
    return JSON.parse(txt)
  } catch {
    throw new Error(
      `El GAS no devolvió JSON (${etiqueta}). Suele ser permisos o una redirección del despliegue. ` +
      `Empieza con: ${txt.slice(0, 160)}`
    )
  }
}
