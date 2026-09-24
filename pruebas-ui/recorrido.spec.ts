/**
 * 🧭 El recorrido del presupuesto, apretando los botones de verdad.
 *
 * 🛑 **CERO ESCRITURA.** Abre, mira y lee. Ningún «Guardar», ningún «no va», ninguna marca.
 *    Ver el encabezado de `playwright.config.ts` — la app apunta al Supabase real.
 *
 * ## Por qué estos casos y no otros
 * Cada uno reproduce **un bug que ya pasó** y que las otras dos capas dejaron pasar. Un test de UI
 * que no defiende un bug real envejece mal: se rompe cuando se mueve un botón y no protegía nada.
 */

import { test, expect } from '@playwright/test'
import { abrirPresupuesto, RUTA } from './ayuda'

test.beforeEach(async ({ page }) => {
  test.skip(!RUTA,
    'Falta PRUEBA_RUTA en .env.local — el primer segmento de la URL es la contraseña y no se escribe en el repo.')
  await abrirPresupuesto(page)
})

test('el tablero abre y el marcador dice algo que se puede accionar', async ({ page }) => {
  const boton = page.getByRole('button', { name: /hueco\(s\)|Sin huecos/ })
  const etiqueta = (await boton.textContent())?.trim() ?? ''
  await boton.click()

  const tablero = page.getByRole('dialog')
  await expect(tablero.getByText('Lo que le falta al presupuesto')).toBeVisible()

  // 🔴 A-BUG-136 — el cero que significa «no pude medir» no se dice como cero.
  //    Con huecos abiertos, «$0 sin cubrir» es el mensaje contrario al que el tablero da.
  if (!/Sin huecos/.test(etiqueta)) {
    await expect(tablero.getByText('$0 sin cubrir')).toHaveCount(0)
  }

  // 🔴 A-BUG-134 — un padrón mudo se confunde con «está todo bien», que es lo que viene a desmentir.
  //    No se fija un número (cambia con el trabajo del usuario): se fija que el tablero DIGA algo.
  //    ⚠️ El texto va partido entre nodos (`huecos abiertos · <b>…</b>`), así que se busca sobre
  //    el marcador entero y no con `getByText`, que compara nodo por nodo.
  await expect(tablero).toContainText(/huecos abiertos|No queda ningún hueco abierto/)
})

test('🔴 A-BUG-131 · «Al tablero» vuelve AL TABLERO, no a la pantalla que lo contiene', async ({ page }) => {
  await page.getByRole('button', { name: /hueco\(s\)/ }).click()
  // ⚠️ Esperar a que el cartel esté ABIERTO antes de preguntar si el botón se ve: preguntarlo
  //    antes devuelve `false` y el test se **saltea en verde** sin haber probado nada.
  await expect(page.getByText('Lo que le falta al presupuesto')).toBeVisible()
  const empezar = page.getByRole('button', { name: /Empezar el recorrido/ })
  test.skip(!(await empezar.isVisible()), 'No hay huecos abiertos: nada que recorrer hoy.')
  await empezar.click()

  // El tablero se cierra y aparece la barra de abajo.
  await expect(page.getByRole('button', { name: '↩ Al tablero' })).toBeVisible()

  await page.getByRole('button', { name: '↩ Al tablero' }).click()

  // Esto es TODO el bug: antes navegaba a la solapa y dejaba el cartel cerrado, así que había que
  // apretar «N hueco(s)» otra vez. «Volver» es volver a VERLO.
  await expect(page.getByText('Lo que le falta al presupuesto')).toBeVisible()
})

test('🔴 A-FEAT-125 · los DOS botones de anotar aceptan captura', async ({ page }) => {
  // La primera versión cubrió uno solo y el usuario lo encontró al primer intento:
  // «no me permite en la primera pantalla pero si voy a las secciones sí me permite».

  // 1 · El del tablero.
  await page.getByRole('button', { name: /hueco\(s\)|Sin huecos/ }).click()
  await expect(page.getByText('Lo que le falta al presupuesto')).toBeVisible()
  await page.getByRole('button', { name: /Anotar una idea/ }).click()
  await expect(page.getByText(/pegala acá con/)).toBeVisible()
  await expect(page.getByText('Captura de pantalla — opcional')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()   // ⚠️ Cancelar, nunca Guardar.

  // 2 · El de la barra del recorrido.
  // ⚠️ Con un modal abierto, Radix pone `aria-hidden` en el resto de la página: **el botón de
  //    huecos deja de existir para los selectores**. Por eso se pregunta DENTRO del diálogo, que
  //    además es lo que ve una persona.
  const tablero = page.getByRole('dialog')
  await expect(tablero.getByText('Lo que le falta al presupuesto')).toBeVisible()
  const empezar = tablero.getByRole('button', { name: /Empezar el recorrido/ })
  test.skip(await empezar.count() === 0, 'Hoy no hay huecos abiertos: no hay recorrido que empezar.')
  await empezar.click()

  // `exact` porque «💡 Anotar» es prefijo de «💡 Anotar una idea» — los dos botones conviven
  // en pantalla (el tablero queda abierto detrás de la barra), y sin esto el selector es ambiguo.
  await page.getByRole('button', { name: '💡 Anotar', exact: true }).click()
  await expect(page.getByText(/pegala acá con/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
})

test('la foto de la pantalla, para poder mirarla', async ({ page }, testInfo) => {
  // No verifica nada: **deja la captura**. Es la mitad que un test no da — poder ver la pantalla
  // en vez de razonarla leyendo el render, que es donde vivía A-BUG-136.
  await page.getByRole('button', { name: /hueco\(s\)|Sin huecos/ }).click()
  await expect(page.getByText('Lo que le falta al presupuesto')).toBeVisible()
  await testInfo.attach('tablero', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
})
