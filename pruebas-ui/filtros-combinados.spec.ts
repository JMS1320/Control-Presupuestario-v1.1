/**
 * 🧹 A-BUG-155 — los filtros del Extracto se COMBINAN, no se pisan.
 *
 * 🛑 **CERO ESCRITURA.** Pone filtros y cuenta filas.
 *
 * ## Lo que reprodujo el usuario, conciliando
 * *«Pongo filtro hasta tal fecha y después pongo no conciliados o pendientes, y me vuelve a mostrar
 * todo y debo volver a apretar filtrar hasta la fecha.»*
 *
 * ## Por qué importa más de lo que parece
 * No es el click de más. Al perderse la fecha, la lista vuelve a traer **todo el extracto** — y se
 * puede estar mirando *«los pendientes de todo»* creyendo que son *«los pendientes hasta el 18/06»*.
 * **Un filtro que se va solo no avisa que se fue.**
 */

import { test, expect } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

const OUT = 'C:/Users/josem/AppData/Local/Temp/claude/D--Users-josem-Documents-Jose-Automatizarr-Claude-Control-Presupuestario-v1-1/93fe67ed-ce98-4c07-9cab-ef2f6c13fccd/scratchpad'

test('🧹 poner un chip NO borra el filtro de fecha', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await irAlInicio(page)
  await page.getByRole('tab', { name: /Extracto/ }).click()

  const filas = () => page.locator('table tbody tr')
  const contar = async () => {
    await expect(page.getByText('Cargando movimientos...')).toHaveCount(0, { timeout: 90_000 })
    await page.waitForTimeout(700)
    return filas().count()
  }

  await expect(page.getByRole('button', { name: /^Filtrar$/ })).toBeVisible({ timeout: 120_000 })
  const sinFiltros = await contar()
  console.log(`\n📊 sin filtros: ${sinFiltros}`)
  test.skip(sinFiltros === 0, 'El extracto no trajo movimientos.')

  // ── 1 · Un rango de fechas que recorte de verdad ──────────────────────────────────────────
  await page.getByRole('button', { name: /Avanzados/ }).click()
  const desde = page.locator('input[type="date"]').first()
  await expect(desde).toBeVisible({ timeout: 20_000 })
  await desde.fill('2026-08-01')
  await page.getByRole('button', { name: /^Filtrar$/ }).first().click()

  const conFecha = await contar()
  console.log(`📅 desde 01/08: ${conFecha}`)
  expect(conFecha, 'el filtro de fecha tiene que recortar la lista').toBeLessThan(sinFiltros)
  await page.screenshot({ path: `${OUT}/filtros-01-con-fecha.png` })

  // ── 2 · El chip: la fecha TIENE QUE SOBREVIVIR ────────────────────────────────────────────
  await page.getByRole('button', { name: /^Pendientes \(/ }).click()
  const conAmbos = await contar()
  console.log(`📅+📌 desde 01/08 Y pendientes: ${conAmbos}`)
  await page.screenshot({ path: `${OUT}/filtros-02-fecha-mas-chip.png` })

  // 🧮 EL CONTROL: combinar dos filtros nunca puede traer MÁS que uno solo.
  //    Si trae más, el segundo pisó al primero — que es exactamente el bug.
  expect(conAmbos,
    `combinar fecha + pendientes trajo ${conAmbos}, más que sólo la fecha (${conFecha}): el chip borró la fecha`)
    .toBeLessThanOrEqual(conFecha)

  // Y el cartel de filtros activos tiene que nombrar los dos.
  const barra = await page.locator('body').innerText()
  console.log(`\n🏷️ ¿el cartel menciona las fechas? ${/fechas/i.test(barra) ? 'SÍ' : 'no'}`)

  /**
   * 🔴 **Y el control que cierra la duda del otro lado.**
   *
   * «Nunca más que antes» se cumple igual si el chip **se ignorara**: quedaría en 36 las tres veces
   * y el test pasaría. Así que se prueba que el chip **hace algo**: con la misma fecha, «Pendientes»
   * y «Conciliados» tienen que dar números **distintos**.
   *
   * 📌 Es la otra mitad del bug: uno pisa filtros, el otro no los aplica. Un test que sólo mira la
   * primera mitad da verde con el segundo puesto.
   */
  await page.getByRole('button', { name: /^Conciliados \(/ }).click()
  const conciliadosConFecha = await contar()
  console.log(`📅+✅ desde 01/08 Y conciliados: ${conciliadosConFecha}`)
  expect(conciliadosConFecha,
    `pendientes (${conAmbos}) y conciliados (${conciliadosConFecha}) dan igual: el chip de estado no se está aplicando`)
    .not.toBe(conAmbos)
  expect(conciliadosConFecha, 'y conciliados tampoco puede traer más que la fecha sola').toBeLessThanOrEqual(conFecha)

  // Volver a pendientes para seguir la cadena.
  await page.getByRole('button', { name: /^Pendientes \(/ }).click()
  await contar()

  // ── 3 · El filtro de notas, que nació con el mismo defecto ────────────────────────────────
  const selNotas = page.locator('select').filter({ hasText: 'Con nota mía' })
  await selNotas.selectOption('sin_nota')
  const conTres = await contar()
  console.log(`📅+📌+💬 los tres juntos: ${conTres}`)
  expect(conTres, 'agregar el filtro de notas tampoco puede traer más').toBeLessThanOrEqual(conAmbos)

  console.log(`\n🔴 errores de página: ${errores.length}`)
  for (const e of errores) console.log('   ' + e.slice(0, 300))
})
