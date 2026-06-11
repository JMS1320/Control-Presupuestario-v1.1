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
    const cred = await getCredenciales(PARAMS.empresa)
    console.log(`\nEmpresa objetivo: ${cred.empresa}  |  CUIT empresa: ${cred.cuitEmpresa}`)

    const client = await loginArca(cred)

    // Test: pedir el portal real del contribuyente (post-SSO)
    console.log('\n📋 Test: GET portal del contribuyente (post-SSO)')
    const r = await client.get('https://portalcf.cloud.afip.gob.ar/portal/app/', {
      maxRedirects: 5,
      validateStatus: () => true,
    })
    console.log(`  Status: ${r.status}`)
    console.log(`  Final URL: ${r.request?.res?.responseUrl || ''}`)
    console.log(`  Content-Type: ${r.headers['content-type']}`)
    console.log(`  Tamaño respuesta: ${String(r.data).length} bytes`)

    writeFileSync('debug-portal-final.html', String(r.data))
    console.log('  📄 HTML guardado en debug-portal-final.html')

    if (r.status === 200 && String(r.data).length > 2000) {
      console.log('\n✅ POC LOGIN COMPLETO — sesión activa en el portal')
    } else {
      console.log('\n⚠️ Login terminó pero el GET final no devolvió una página rica. Revisar debug-portal-final.html')
    }
  } catch (err) {
    console.error('\n❌ Error:', (err as Error).message)
    process.exit(1)
  }
}

main()
