/**
 * Test rápido: solo loguearse y verificar que la sesión se establece.
 * Uso:
 *   cp .env.example .env
 *   # editar .env con tus credenciales
 *   npm install
 *   npm run login
 */
import { getCredenciales, PARAMS } from './config.js'
import { loginArca } from './login.js'
import { writeFileSync } from 'node:fs'

async function main() {
  try {
    const cred = getCredenciales(PARAMS.empresa)
    console.log(`\nEmpresa objetivo: ${cred.empresa}  |  CUIT empresa: ${cred.cuitEmpresa}`)

    const client = await loginArca(cred)

    // Test: pedir la home del contribuyente
    console.log('\n📋 Test: GET portal del contribuyente')
    const r = await client.get('https://auth.afip.gob.ar/contribuyente_/index.xhtml', {
      maxRedirects: 5,
      validateStatus: () => true,
    })
    console.log(`  Status: ${r.status}`)
    console.log(`  Content-Type: ${r.headers['content-type']}`)
    console.log(`  Tamaño respuesta: ${String(r.data).length} bytes`)

    // Guardar HTML para inspección manual si algo anduvo raro
    writeFileSync('debug-home.html', String(r.data))
    console.log('  📄 HTML guardado en debug-home.html (para inspección)')

    console.log('\n✅ POC LOGIN OK')
  } catch (err) {
    console.error('\n❌ Error:', (err as Error).message)
    process.exit(1)
  }
}

main()
