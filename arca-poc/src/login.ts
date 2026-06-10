import { load } from 'cheerio'
import { crearClienteHttp, logRequest } from './http-client.js'
import type { CredencialesArca } from './config.js'
import { URLS } from './config.js'

/**
 * Login en ARCA (portal contribuyente).
 * El flujo del portal con JSF / PrimeFaces es:
 *
 *   1. GET login.xhtml  →  recibo cookies + token ViewState
 *   2. POST F1 (form de CUIT) con javax.faces.ViewState + el CUIT
 *      →  ARCA responde con form de password (form distinto, otro ViewState)
 *   3. POST F2 (form de password) con nuevo ViewState + clave
 *      →  ARCA hace redirect al portal del contribuyente con cookies de sesión
 *
 * Si en cualquier paso ARCA pide captcha, OTP, validación de imagen, etc.,
 * la promesa lanza con un mensaje claro.
 *
 * Devuelve el cliente axios con cookies persistentes (la "sesión").
 */
export async function loginArca(cred: CredencialesArca) {
  const client = crearClienteHttp()
  console.log(`\n🔐 Login en ARCA — CUIT ${cred.cuitPersonal}`)

  // ── Paso 1: GET login.xhtml ────────────────────────────────────
  console.log('  Paso 1: GET formulario de login')
  const r1 = await client.get(URLS.LOGIN)
  logRequest('GET', URLS.LOGIN, r1.status)

  let $ = load(r1.data as string)
  const viewState1 = $('input[name="javax.faces.ViewState"]').val() as string
  if (!viewState1) {
    throw new Error('No se encontró javax.faces.ViewState en la página de login. El portal cambió de formato.')
  }
  console.log(`  ViewState capturado (${viewState1.length} chars)`)

  // Nombres de campos típicos del form de ARCA
  // (pueden requerir ajuste post-test contra el portal real)
  const formId1 = $('form[id]').first().attr('id') || 'F1'
  console.log(`  Form id detectado: ${formId1}`)

  // ── Paso 2: POST CUIT ──────────────────────────────────────────
  console.log('  Paso 2: POST CUIT')
  const body2 = new URLSearchParams({
    [formId1]: formId1,
    [`${formId1}:F1:vc:cuit`]: cred.cuitPersonal,
    [`${formId1}:F1:vc:btnIngresar`]: '',
    'javax.faces.ViewState': viewState1,
  })

  const r2 = await client.post(URLS.LOGIN, body2.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': URLS.LOGIN,
    },
  })
  logRequest('POST', URLS.LOGIN, r2.status, 'CUIT enviado')

  // Detectar captcha / 2FA en la respuesta
  const respText2 = String(r2.data)
  if (/captcha/i.test(respText2) || /codigo de verificacion/i.test(respText2)) {
    throw new Error('ARCA pidió captcha o código de verificación. El scraping requests no funciona en este escenario.')
  }
  if (/cuit invalido|cuit inv[aá]lido|cuit incorrecto/i.test(respText2)) {
    throw new Error('CUIT no válido o sin clave fiscal activa.')
  }

  // Extraer nuevo ViewState (el segundo form, de password)
  $ = load(respText2)
  const viewState2 = $('input[name="javax.faces.ViewState"]').val() as string
  if (!viewState2) {
    throw new Error('No se encontró javax.faces.ViewState en el formulario de password.')
  }

  const formId2 = $('form[id]').first().attr('id') || 'F1'
  console.log(`  ViewState 2 capturado (${viewState2.length} chars), form id: ${formId2}`)

  // ── Paso 3: POST password ──────────────────────────────────────
  console.log('  Paso 3: POST clave fiscal')
  const body3 = new URLSearchParams({
    [formId2]: formId2,
    [`${formId2}:F1:vc:password`]: cred.password,
    [`${formId2}:F1:vc:btnIngresar`]: '',
    'javax.faces.ViewState': viewState2,
  })

  const r3 = await client.post(URLS.LOGIN, body3.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': URLS.LOGIN,
    },
  })
  logRequest('POST', URLS.LOGIN, r3.status, 'password enviado')

  const respText3 = String(r3.data)
  if (/clave incorrecta|password incorrecto|clave fiscal inv/i.test(respText3)) {
    throw new Error('Clave fiscal incorrecta.')
  }
  if (/bloqueado/i.test(respText3)) {
    throw new Error('Cuenta bloqueada por intentos fallidos. Esperá unos minutos antes de reintentar.')
  }

  // Si llegamos acá, debería haber redirigido al portal del contribuyente.
  // Las cookies de sesión están en el jar del cliente.
  console.log('  ✅ Login OK — sesión iniciada')

  return client
}
