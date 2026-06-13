import { load } from 'cheerio'
import { AxiosInstance } from 'axios'
import { crearClienteHttp } from './http'

const URL_LOGIN = 'https://auth.afip.gob.ar/contribuyente_/login.xhtml'

export interface CredencialesArca {
  cuitPersonal: string
  password: string
}

/**
 * Login completo en ARCA: 3 POSTs JSF + SSO al portal.
 * Devuelve el cliente axios con cookies de sesión activas en
 * portalcf.cloud.afip.gob.ar.
 *
 * Lanza Error si:
 *  - El portal cambió de framework (no encuentra ViewState)
 *  - CUIT o clave inválidos
 *  - Cuenta bloqueada
 *  - ARCA pide captcha visible o 2FA
 *  - El SSO al portal no devuelve JWT
 */
export async function loginArca(cred: CredencialesArca): Promise<AxiosInstance> {
  const client = crearClienteHttp()

  // ── Paso 1: GET login.xhtml — capturar cookies + ViewState ──────
  const r1 = await client.get(URL_LOGIN, { validateStatus: () => true })
  let $ = load(r1.data as string)
  const viewState1 = $('input[name="javax.faces.ViewState"]').val() as string
  if (!viewState1) {
    throw new Error('No se encontró ViewState en página de login. El portal cambió de formato.')
  }
  const formId1 = $('form[id]').first().attr('id') || 'F1'

  // ── Paso 2: POST CUIT (F1:username + F1:btnSiguiente) ──────────
  const body2 = new URLSearchParams({
    [formId1]: formId1,
    [`${formId1}:username`]: cred.cuitPersonal,
    [`${formId1}:btnSiguiente`]: 'Siguiente',
    'javax.faces.ViewState': viewState1,
  })
  const r2 = await client.post(URL_LOGIN, body2.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': URL_LOGIN,
    },
    validateStatus: () => true,
    maxRedirects: 5,
  })

  const respText2 = String(r2.data)
  if (/<img[^>]*captcha/i.test(respText2) || /reCAPTCHA/i.test(respText2)) {
    throw new Error('ARCA pidió captcha visible — el scraping no funciona en esta cuenta.')
  }
  if (/cuit invalido|cuit inv[aá]lido|cuit incorrecto/i.test(respText2)) {
    throw new Error('CUIT no válido o sin clave fiscal activa.')
  }

  // ── Paso 3: POST clave fiscal (campos detectados dinámicamente) ─
  $ = load(respText2)
  const viewState2 = $('input[name="javax.faces.ViewState"]').val() as string
  if (!viewState2) {
    throw new Error('No se encontró ViewState en form de password — flujo de login cambió.')
  }
  const formId2 = $('form[id]').first().attr('id') || 'F1'
  const formPwd = $('form').first()
  const formAction = formPwd.attr('action') || '/contribuyente_/login.xhtml'
  const passwordName = $('input[type="password"]').first().attr('name') || `${formId2}:password`
  const submitName = $('input[type="submit"]').first().attr('name') || `${formId2}:btnIngresar`
  const submitValue = $('input[type="submit"]').first().attr('value') || 'Ingresar'

  // Recolectar todos los hidden + username preservado del paso anterior
  const hiddenFields: Record<string, string> = {}
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name')
    const value = $(el).attr('value') || ''
    if (name) hiddenFields[name] = value
  })
  $('input[name$=":username"]').each((_, el) => {
    const name = $(el).attr('name')
    const value = $(el).attr('value') || ''
    if (name && !(name in hiddenFields)) hiddenFields[name] = value
  })

  const body3 = new URLSearchParams({
    ...hiddenFields,
    [passwordName]: cred.password,
    [submitName]: submitValue,
    'javax.faces.ViewState': viewState2,
  })
  const urlPost3 = formAction.startsWith('http')
    ? formAction
    : `https://auth.afip.gob.ar${formAction}`
  const r3 = await client.post(urlPost3, body3.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': URL_LOGIN,
    },
    validateStatus: () => true,
    maxRedirects: 5,
  })

  const respText3 = String(r3.data)
  if (/clave incorrecta|password incorrecto|clave fiscal inv/i.test(respText3)) {
    throw new Error('Clave fiscal incorrecta.')
  }
  if (/bloqueado/i.test(respText3)) {
    throw new Error('Cuenta bloqueada por intentos fallidos.')
  }

  // ── Paso 4: SSO al portal del contribuyente (JWT) ──────────────
  const $sso = load(respText3)
  const ssoForm = $sso('form[action*="portalcf"]').first()
  const jwt = $sso('input[name="jwt"]').attr('value')
  const ssoAction = ssoForm.attr('action')
  if (!jwt || !ssoAction) {
    throw new Error('Login no completó — no se recibió JWT del SSO. Credenciales o flujo inválidos.')
  }

  const r4 = await client.post(ssoAction, new URLSearchParams({ jwt }).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': urlPost3,
    },
    validateStatus: () => true,
    maxRedirects: 5,
  })
  if (r4.status >= 400) {
    throw new Error(`SSO al portal falló con status ${r4.status}.`)
  }

  return client
}
