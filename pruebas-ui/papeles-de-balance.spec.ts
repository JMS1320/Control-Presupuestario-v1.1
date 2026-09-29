/**
 * 🎭 Los PAPELES DE TRABAJO DEL BALANCE, en el navegador de verdad — A-FEAT-1184.
 *
 * ## Qué agrega sobre los 334 casos de `npm run probar`
 *
 * Aquéllos prueban **la función** con números escritos a mano: que el corte por subdiario sea el
 * subdiario, que un hueco no se valúe en cero, que la provisión salga sola. **Ninguno toca la
 * pantalla.** Los bugs que sobrevivieron a esa capa en este proyecto fueron todos **de apretar**:
 * un botón que no volvía, dos botones donde se tocó uno, una columna que contaba una lista y
 * actuaba sobre otra.
 *
 * Acá se prueba lo que aquéllos no ven: que la pantalla **cargue**, que el botón **traiga datos**
 * y que los números que salen sean los que la lógica promete.
 *
 * ## 🛑 CERO ESCRITURA
 * Esta pantalla **sólo lee**: arma un reporte y genera un archivo. No hay un solo `Guardar` que
 * tocar, así que el test no puede dejar rastro ni por error. Es la razón por la que puede correr
 * sin pedir permiso cada vez (§ 🛑 Datos de `CLAUDE.md`).
 */
import { test, expect } from '@playwright/test'
import { irAlInicio, HAY_ACCESO, MOTIVO_SIN_ACCESO } from './ayuda'

test.skip(!HAY_ACCESO, MOTIVO_SIN_ACCESO)

/** Abre Reportes y baja hasta el bloque de papeles de balance. */
async function abrirPapeles(page: import('@playwright/test').Page) {
  await irAlInicio(page)
  await page.getByRole('tab', { name: /Reporte/i }).click()
  const titulo = page.getByText('Papeles de trabajo del balance', { exact: false })
  await expect(titulo.first()).toBeVisible({ timeout: 60_000 })
  await titulo.first().scrollIntoViewIfNeeded()
}

test('la pantalla carga y arma el libro diario del ejercicio', async ({ page }) => {
  await abrirPapeles(page)

  await page.getByRole('button', { name: /Armar el libro/i }).click()

  // El ejercicio 25/26 de MSA: si esto no aparece, el corte por subdiario no se aplicó.
  await expect(page.getByText(/Ejercicio\s*25\/26/i)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/2026-06-30/)).toBeVisible()
  await expect(page.getByText(/julio 2025/)).toBeVisible()
  await expect(page.getByText(/junio 2026/)).toBeVisible()

  // 🔴 Tiene que FRENAR: diciembre está cargado en las dos fuentes (A-DAT-61). Que el control
  //    diga que sí se puede entregar sería el bug, no al revés.
  await expect(page.getByText(/Todavía no se puede entregar/i)).toBeVisible()
  await expect(page.getByText(/2025-12/)).toBeVisible()

  // Y aun frenando, el botón de bajar el Excel TIENE que estar: fue un pedido explícito.
  await expect(page.getByRole('button', { name: /Bajar el Excel/i })).toBeVisible()
})

test('dice cuál fuente contiene a la otra, que es lo que deja decidir', async ({ page }) => {
  await abrirPapeles(page)
  await page.getByRole('button', { name: /Armar el libro/i }).click()
  await expect(page.getByText(/Ejercicio\s*25\/26/i)).toBeVisible({ timeout: 90_000 })

  // No alcanza con avisar que está duplicado: tiene que decir qué hacer.
  await expect(page.getByText(/está(n)? en las dos/i)).toBeVisible()
  await expect(page.getByText(/la contiene|quedate con ésa|quedate con una|fusionarlas/i)).toBeVisible()
})

test('los templates salen aparte y se cortan por fecha, no por subdiario', async ({ page }) => {
  await abrirPapeles(page)
  await page.getByRole('button', { name: /Armar el libro/i }).click()
  await expect(page.getByText(/Ejercicio\s*25\/26/i)).toBeVisible({ timeout: 90_000 })

  await expect(page.getByText(/Templates/).first()).toBeVisible()
  // La advertencia del criterio distinto es parte del entregable: sin ella, el que lea los
  // números va a suponer que todo se cortó igual.
  await expect(page.getByText(/fecha de pago/i)).toBeVisible()
})

test('la hacienda trae la existencia al cierre y deja los huecos a la vista', async ({ page }) => {
  await abrirPapeles(page)
  await page.getByRole('button', { name: /Armar el libro/i }).click()
  await expect(page.getByText(/Ejercicio\s*25\/26/i)).toBeVisible({ timeout: 90_000 })

  await page.getByRole('button', { name: /Traer stock y precios/i }).click()

  // 428 cabezas al 30/06/2026, medido contra la base el 2026-09-28.
  await expect(page.getByText(/428/)).toBeVisible({ timeout: 90_000 })

  // Los criterios del usuario, textuales, tienen que verse al lado de cada categoría.
  await expect(page.getByText(/vaca regular máximo × 80/i)).toBeVisible()
  await expect(page.getByText(/MEJ especial × 1,5/i)).toBeVisible()

  // 🕳️ Y los huecos: la vaca no tiene precio de mercado publicado y NO se valúa en cero.
  await expect(page.getByText(/sin precio/i).first()).toBeVisible()

  // El stock de insumos viene en la misma pasada.
  await expect(page.locator('[data-test="stock-insumos"]')).toBeVisible()
  await expect(page.getByText(/no tienen de dónde salir/i)).toBeVisible()
})

test('PAM y MA cierran el 31/12, no el 30/06', async ({ page }) => {
  await abrirPapeles(page)

  // El adversario: si el mes de cierre estuviera clavado en 6, esto daría julio→junio igual.
  await page.locator('select').first().selectOption('PAM')
  await page.getByRole('button', { name: /Armar el libro/i }).click()

  await expect(page.getByText(/enero 2026/i)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/diciembre 2026/i)).toBeVisible()
})
