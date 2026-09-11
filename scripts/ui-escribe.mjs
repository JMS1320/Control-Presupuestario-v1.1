/**
 * 🛑 `npm run ui:escribe` — corre TAMBIÉN los tests de UI que ESCRIBEN en la base.
 *
 * ## Por qué existe este rodeo
 * Los `*.escribe.spec.ts` quedan fuera de `npm run ui` (ver `playwright.config.ts`). El 2026-09-11
 * uno de ellos vivía en la carpeta sin distintivo y **una corrida de `npm run ui` lo ejecutó sin
 * que nadie lo pidiera**: pasó una factura real a `pagar`, le estampó la quincena de SICORE y creó
 * su fila de retención. Hubo que restaurar a mano.
 *
 * 🔑 **El permiso tiene que estar en la configuración, no en un comentario.** El spec decía en su
 * docstring que el permiso no se hereda — y el runner no lee docstrings.
 *
 * ## Antes de correr esto
 * Vale la § 🛑 Datos entera de `CLAUDE.md`: **permiso del usuario para ESTA corrida**, apuntar al
 * registro por id, foto antes y restaurar después. El permiso de una corrida **no vale para la
 * siguiente**.
 *
 * Un `node` que setea la variable y delega es a propósito: `PRUEBA_ESCRITURA=1 playwright test`
 * **no funciona en PowerShell**, que es la consola de esta máquina.
 */
import { spawnSync } from 'node:child_process'

console.log('\n🛑 Vas a correr los tests de UI que ESCRIBEN en la base REAL.')
console.log('   Requieren permiso explícito del usuario para esta corrida (§ CLAUDE.md — 🛑 Datos).')
console.log('   Los demás tests corren con `npm run ui`.\n')

const r = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PRUEBA_ESCRITURA: '1' },
})
process.exit(r.status ?? 1)
