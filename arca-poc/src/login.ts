import { load } from 'cheerio'
import { writeFileSync } from 'node:fs'
import { crearClienteHttp, logRequest } from './http-client.js'
import type { CredencialesArca } from './config.js'
import { URLS } from './config.js'

/**
 * Login en ARCA (portal contribuyente).
 *
 * Guarda los HTML de cada paso como debug-step1/2/3.html para
 * diagnóstico cuando algo falla.
 */
export async function loginArca(cred: CredencialesArca) {
  const client = crearClienteHttp()
  console.log(`\n🔐 Login en ARCA — CUIT ${cred.cuitPersonal}`)

  // ── Paso 1: GET login.xhtml ────────────────────────────────────
  console.log('  Paso 1: GET formulario de login')
  const r1 = await client.get(URLS.LOGIN, { validateStatus: () => true, maxRedirects: 5 })
  logRequest('GET', URLS.LOGIN, r1.status)
  console.log(`  Final URL: ${r1.request?.res?.responseUrl || URLS.LOGIN}`)
  console.log(`  Tamaño respuesta: ${String(r1.data).length} bytes`)
  writeFileSync('debug-step1-login-page.html', String(r1.data))
  console.log('  📄 debug-step1-login-page.html guardado')

  let $ = load(r1.data as string)
  // Listar todos los inputs para debug
  const inputs1 = $('input').map((_, el) => {
    const name = $(el).attr('name') || ''
    const id = $(el).attr('id') || ''
    const type = $(el).attr('type') || ''
    return { name, id, type, value: type === 'hidden' ? ($(el).attr('value') || '').slice(0, 60) : '' }
  }).get()
  console.log(`  Inputs encontrados (${inputs1.length}):`)
  inputs1.forEach(i => console.log(`    - name="${i.name}" id="${i.id}" type="${i.type}"${i.value ? ' value="' + i.value + '..."' : ''}`))

  const forms1 = $('form').map((_, el) => ({
    id: $(el).attr('id') || '',
    name: $(el).attr('name') || '',
    action: $(el).attr('action') || '',
    method: $(el).attr('method') || '',
  })).get()
  console.log(`  Forms encontrados (${forms1.length}):`)
  forms1.forEach(f => console.log(`    - id="${f.id}" name="${f.name}" action="${f.action}" method="${f.method}"`))

  const viewState1 = $('input[name="javax.faces.ViewState"]').val() as string
  if (!viewState1) {
    throw new Error('No se encontró javax.faces.ViewState — el portal puede no usar JSF. Inspeccionar debug-step1-login-page.html')
  }
  console.log(`  ViewState capturado (${viewState1.length} chars): "${viewState1.slice(0, 50)}${viewState1.length > 50 ? '...' : ''}"`)
  const formId1 = $('form[id]').first().attr('id') || 'F1'
  console.log(`  Form id detectado: ${formId1}`)

  // ── Paso 2: POST CUIT ──────────────────────────────────────────
  // Campos reales descubiertos:  F1:username (CUIT), F1:btnSiguiente (botón Siguiente)
  console.log('\n  Paso 2: POST CUIT')
  const body2 = new URLSearchParams({
    [formId1]: formId1,
    [`${formId1}:username`]: cred.cuitPersonal,
    [`${formId1}:btnSiguiente`]: 'Siguiente',
    'javax.faces.ViewState': viewState1,
  })

  const r2 = await client.post(URLS.LOGIN, body2.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': URLS.LOGIN,
    },
    validateStatus: () => true,
    maxRedirects: 5,
  })
  logRequest('POST', URLS.LOGIN, r2.status, 'CUIT enviado')
  console.log(`  Final URL: ${r2.request?.res?.responseUrl || URLS.LOGIN}`)
  console.log(`  Tamaño respuesta: ${String(r2.data).length} bytes`)
  writeFileSync('debug-step2-after-cuit.html', String(r2.data))
  console.log('  📄 debug-step2-after-cuit.html guardado')

  const respText2 = String(r2.data)
  // Detección de captcha VISIBLE (no el honeypot hidden de ARCA que es F1:captcha vacío)
  if (/<img[^>]*captcha/i.test(respText2) || /reCAPTCHA/i.test(respText2) || /codigo de verificacion/i.test(respText2)) {
    throw new Error('ARCA pidió captcha visible. El scraping requests no sirve en este caso.')
  }
  if (/cuit invalido|cuit inv[aá]lido|cuit incorrecto/i.test(respText2)) {
    throw new Error('CUIT no válido o sin clave fiscal activa.')
  }

  // Listar inputs del paso 2 para ver qué cambió
  $ = load(respText2)
  const inputs2 = $('input').map((_, el) => ({
    name: $(el).attr('name') || '',
    id: $(el).attr('id') || '',
    type: $(el).attr('type') || '',
  })).get()
  console.log(`  Inputs en respuesta (${inputs2.length}):`)
  inputs2.forEach(i => console.log(`    - name="${i.name}" id="${i.id}" type="${i.type}"`))

  const viewState2 = $('input[name="javax.faces.ViewState"]').val() as string
  if (!viewState2) {
    throw new Error('No se encontró javax.faces.ViewState en form de password. Inspeccionar debug-step2-after-cuit.html')
  }
  const formId2 = $('form[id]').first().attr('id') || 'F1'
  console.log(`  ViewState 2 capturado (${viewState2.length} chars): "${viewState2.slice(0, 50)}${viewState2.length > 50 ? '...' : ''}"`)
  console.log(`  Form id: ${formId2}`)

  // ── Paso 3: POST password ──────────────────────────────────────
  // Detectar nombres y URL action del form de password dinámicamente.
  const formPwd = $('form').first()
  const formAction = formPwd.attr('action') || '/contribuyente_/login.xhtml'
  const passwordInput = $('input[type="password"]').first()
  const passwordName = passwordInput.attr('name') || `${formId2}:password`
  const submitInput = $('input[type="submit"]').first()
  const submitName = submitInput.attr('name') || `${formId2}:btnIngresar`
  const submitValue = submitInput.attr('value') || 'Ingresar'
  console.log(`  Form action: ${formAction}`)
  console.log(`  Campo password detectado: name="${passwordName}"`)
  console.log(`  Botón submit detectado: name="${submitName}" value="${submitValue}"`)

  // Recolectar TODOS los inputs hidden del form (incluye F1:captcha vacío y F1:username con CUIT)
  const hiddenFields: Record<string, string> = {}
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name')
    const value = $(el).attr('value') || ''
    if (name) hiddenFields[name] = value
  })
  // El username preservado también puede estar como type="text" oculto con display:none
  $('input[name$=":username"]').each((_, el) => {
    const name = $(el).attr('name')
    const value = $(el).attr('value') || ''
    if (name && !(name in hiddenFields)) hiddenFields[name] = value
  })
  console.log(`  Hidden fields preservados (${Object.keys(hiddenFields).length}):`)
  Object.entries(hiddenFields).forEach(([k, v]) => console.log(`    - ${k} = "${v.slice(0, 30)}${v.length > 30 ? '...' : ''}"`))

  console.log('\n  Paso 3: POST clave fiscal')
  // Construir body con TODOS los hidden + password + submit
  // ViewState se sobrescribe con el del paso 2 (el más reciente)
  const body3Obj: Record<string, string> = {
    ...hiddenFields,
    [passwordName]: cred.password,
    [submitName]: submitValue,
    'javax.faces.ViewState': viewState2,
  }
  const body3 = new URLSearchParams(body3Obj)

  // URL absoluta del POST: respetar el action del form (puede ser distinto a login.xhtml)
  const urlPost3 = formAction.startsWith('http')
    ? formAction
    : `https://auth.afip.gob.ar${formAction}`
  console.log(`  POST a: ${urlPost3}`)

  const r3 = await client.post(urlPost3, body3.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': URLS.LOGIN,
    },
    validateStatus: () => true,
    maxRedirects: 5,
  })
  logRequest('POST', urlPost3, r3.status, 'password enviado')
  console.log(`  Final URL: ${r3.request?.res?.responseUrl || urlPost3}`)
  console.log(`  Tamaño respuesta: ${String(r3.data).length} bytes`)
  writeFileSync('debug-step3-after-password.html', String(r3.data))
  console.log('  📄 debug-step3-after-password.html guardado')

  const respText3 = String(r3.data)
  if (/clave incorrecta|password incorrecto|clave fiscal inv/i.test(respText3)) {
    throw new Error('Clave fiscal incorrecta.')
  }
  if (/bloqueado/i.test(respText3)) {
    throw new Error('Cuenta bloqueada por intentos fallidos.')
  }

  // ── Paso 4: SSO al portal del contribuyente ────────────────────
  // ARCA devuelve un form auto-submit con un JWT. Lo POSTeamos manualmente
  // a https://portalcf.cloud.afip.gob.ar/portal/login para completar la
  // sesión en el portal (que es donde están los servicios como Mis Comprobantes).
  const $sso = load(respText3)
  const ssoForm = $sso('form[action*="portalcf"]').first()
  const jwt = $sso('input[name="jwt"]').attr('value')
  const ssoAction = ssoForm.attr('action')
  if (!jwt || !ssoAction) {
    throw new Error('No se recibió el JWT de SSO. El login no terminó OK. Revisar debug-step3-after-password.html')
  }
  console.log(`\n  Paso 4: SSO con JWT al portal del contribuyente`)
  console.log(`  JWT recibido (${jwt.length} chars), POST a: ${ssoAction}`)

  const r4 = await client.post(ssoAction, new URLSearchParams({ jwt }).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': urlPost3,
    },
    validateStatus: () => true,
    maxRedirects: 5,
  })
  logRequest('POST', ssoAction, r4.status, 'JWT enviado')
  const finalUrl = r4.request?.res?.responseUrl || ssoAction
  console.log(`  Final URL: ${finalUrl}`)
  console.log(`  Tamaño respuesta: ${String(r4.data).length} bytes`)
  writeFileSync('debug-step4-portal-home.html', String(r4.data))
  console.log('  📄 debug-step4-portal-home.html guardado')

  if (r4.status >= 400) {
    throw new Error(`SSO falló con status ${r4.status}. Revisar debug-step4-portal-home.html`)
  }

  console.log('\n  ✅ Login + SSO OK — sesión iniciada en el portal del contribuyente')
  return client
}
