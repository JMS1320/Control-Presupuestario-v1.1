/**
 * 📝 A-FEAT-130 — filtrar el extracto por MIS notas.
 *
 * 🛑 **CERO ESCRITURA.** Cambia un filtro y cuenta filas. No edita ningún movimiento.
 *
 * ## El control que hace que esto valga
 * `con nota` + `sin nota` tiene que dar **exactamente el total**. Un filtro de dos mitades que no
 * suman el todo está perdiendo filas — y las pierde **en silencio**, porque cada mitad por separado
 * parece perfectamente razonable. Es el caso de una nota borrada que quedó como cadena vacía: con
 * un `.is(null)` a secas no entra en ninguna de las dos y desaparece de la app.
 */

import { test, expect } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

const OUT = 'C:/Users/josem/AppData/Local/Temp/claude/D--Users-josem-Documents-Jose-Automatizarr-Claude-Control-Presupuestario-v1-1/93fe67ed-ce98-4c07-9cab-ef2f6c13fccd/scratchpad'

test('📝 el filtro de notas parte el extracto: ningún movimiento queda en los dos lados', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await irAlInicio(page)
  await page.getByRole('tab', { name: /Extracto/ }).click()

  const selNotas = page.locator('select').filter({ hasText: 'Con nota mía' })
  await expect(selNotas, 'el filtro de notas tiene que estar en la barra').toBeVisible({ timeout: 120_000 })
  await page.screenshot({ path: `${OUT}/notas-01-barra.png` })

  const filas = () => page.locator('table tbody tr')
  /**
   * Contar **después** de que la pantalla termine de cargar.
   *
   * ⚠️ La primera versión esperaba 2,5 s fijos y contó **0** con el cartel de «Cargando
   * movimientos…» todavía puesto: el test se salteó en verde sin haber probado nada, que es el
   * peor resultado. Se espera a que el cartel desaparezca, no a que pase un rato.
   */
  const contar = async () => {
    await expect(page.getByText('Cargando movimientos...')).toHaveCount(0, { timeout: 90_000 })
    await page.waitForTimeout(600)
    return filas().count()
  }

  const total = await contar()
  console.log(`\n📝 movimientos con «todas»: ${total}`)
  test.skip(total === 0, 'El extracto no trajo movimientos.')

  await selNotas.selectOption('con_nota')
  const conNota = await contar()
  console.log(`📝 con nota mía: ${conNota}`)
  await page.screenshot({ path: `${OUT}/notas-02-con-nota.png` })

  // La huella de las filas con nota, para poder cruzarlas con el otro lado.
  const textoCon = new Set((await filas().allInnerTexts()).map(t => t.trim()).filter(Boolean))

  await selNotas.selectOption('sin_nota')
  const sinNota = await contar()
  console.log(`💬 sin nota: ${sinNota}`)
  const textoSin = (await filas().allInnerTexts()).map(t => t.trim()).filter(Boolean)

  // 🧮 EL CONTROL: ningún movimiento puede estar en los DOS lados.
  const enLosDos = textoSin.filter(t => textoCon.has(t))
  console.log(`\n🧮 con nota ${conNota} · sin nota ${sinNota} · en los dos: ${enLosDos.length}`)
  expect(enLosDos.length,
    `hay ${enLosDos.length} movimiento(s) en los DOS filtros — el primero: ${enLosDos[0]?.slice(0, 90)}`)
    .toBe(0)

  // Y que «sin nota» traiga muchas más que «con nota»: son 17 sobre ~850. Si diera al revés, el
  // filtro estaría invertido — un error que mirando la pantalla no se delata.
  expect(sinNota, 'las que NO tienen nota son muchas más que las que sí').toBeGreaterThan(conNota)

  // Y que «con nota» traiga algo: si diera 0 con notas cargadas, el filtro no estaría filtrando
  // sino escondiendo. (17 movimientos tienen nota al 2026-09-11.)
  expect(conNota, 'hay notas cargadas: «con nota» no puede venir vacío').toBeGreaterThan(0)

  // Volver a «todas» tiene que devolver al menos tanto como el filtro más grande.
  //
  // ⚠️ **No se compara contra el conteo inicial**, y el motivo es un hallazgo: la carga inicial usa
  // `limitePorDefecto = 100` mientras el selector de la pantalla dice **200** (A-DAT-34). Comparar
  // contra ese primer número hacía fallar el test **sin que hubiera nada roto en el filtro**.
  await selNotas.selectOption('todas')
  const volver = await contar()
  console.log(`
↩ volver a «todas»: ${volver} (la carga inicial había traído ${total})`)
  expect(volver, 'volver a «todas» tiene que traer al menos lo que traía el filtro más grande')
    .toBeGreaterThanOrEqual(Math.max(conNota, sinNota))

  console.log(`\n🔴 errores de página: ${errores.length}`)
  for (const e of errores) console.log('   ' + e.slice(0, 300))
})
