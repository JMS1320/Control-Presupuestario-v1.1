/**
 * POC completo: login → navegar a Mis Comprobantes → seleccionar empresa →
 * pedir Recibidos en el rango → parsear → imprimir resumen.
 *
 * Uso:
 *   npm install
 *   cp .env.example .env  (editar)
 *   npm run fetch
 */
import { load } from 'cheerio'
import { writeFileSync } from 'node:fs'
import { getCredenciales, PARAMS } from './config.js'
import { loginArca } from './login.js'
import { logRequest } from './http-client.js'

interface ComprobanteScraped {
  fecha_emision: string
  tipo_comprobante: string
  punto_venta: string
  numero: string
  cuit: string
  razon_social: string
  imp_neto_gravado?: number
  imp_neto_no_gravado?: number
  imp_op_exentas?: number
  iva?: number
  imp_total?: number
}

/**
 * NOTA: Este parser es un STUB. Los selectores reales del portal de Mis
 * Comprobantes deben ajustarse después de ver una respuesta real (HTML o JSON).
 * Por eso el script guarda los HTML/JSON intermedios como debug-*.html/json
 * para que podamos inspeccionarlos y ajustar.
 */
function parsearListadoComprobantes(html: string): ComprobanteScraped[] {
  const $ = load(html)
  const filas: ComprobanteScraped[] = []

  // Selector tentativo: ajustar contra el portal real
  $('table tbody tr').each((_, tr) => {
    const $tr = $(tr)
    const tds = $tr.find('td').map((__, td) => $(td).text().trim()).get()
    if (tds.length < 6) return
    filas.push({
      fecha_emision: tds[0] || '',
      tipo_comprobante: tds[1] || '',
      punto_venta: tds[2] || '',
      numero: tds[3] || '',
      cuit: tds[4] || '',
      razon_social: tds[5] || '',
      // Importes — placeholder; ajustar índices contra HTML real
    })
  })

  return filas
}

async function main() {
  try {
    const cred = await getCredenciales(PARAMS.empresa)
    console.log(`\n🎯 Objetivo: comprobantes ${PARAMS.tipo} de ${cred.empresa} (CUIT ${cred.cuitEmpresa})`)
    console.log(`   Rango: ${PARAMS.fechaDesde} → ${PARAMS.fechaHasta}`)

    // 1. Login
    const client = await loginArca(cred)

    // 2. Navegar al servicio "Mis Comprobantes"
    // Esta URL es estimada — al testear ajustamos
    console.log('\n📍 Paso 4: Navegar a Mis Comprobantes')
    const urlMisComprobantes = 'https://serviciosweb.afip.gob.ar/genericos/comprobantes/RecibidosFiltro.aspx'
    const r4 = await client.get(urlMisComprobantes, { validateStatus: () => true })
    logRequest('GET', urlMisComprobantes, r4.status)
    writeFileSync('debug-mis-comprobantes.html', String(r4.data))
    console.log('  📄 HTML guardado en debug-mis-comprobantes.html')

    if (r4.status >= 400) {
      throw new Error(`No se pudo acceder a Mis Comprobantes (status ${r4.status}). Revisar URL en debug-mis-comprobantes.html`)
    }

    // 3. Seleccionar empresa (representado) si hay dropdown
    console.log('\n📍 Paso 5: Seleccionar empresa representada')
    const $form = load(String(r4.data))
    const viewState = $form('input[name="javax.faces.ViewState"]').val() as string
    if (!viewState) {
      console.warn('  ⚠️ No se encontró ViewState — el portal puede no usar JSF acá. Verificar.')
    }

    // 4. POST filtros (fecha desde, fecha hasta, recibidos) — SELECTORES A AJUSTAR
    console.log('\n📍 Paso 6: Aplicar filtros y consultar')
    const bodyFiltro = new URLSearchParams({
      // Estos nombres de campo SON ESTIMADOS. Hay que inspeccionar el portal real
      // y ajustar (los inputs reales se ven en debug-mis-comprobantes.html).
      'ctl00$ContentPlaceHolder1$txtFechaDesde': PARAMS.fechaDesde,
      'ctl00$ContentPlaceHolder1$txtFechaHasta': PARAMS.fechaHasta,
      'ctl00$ContentPlaceHolder1$rblTipo': PARAMS.tipo === 'recibidos' ? 'R' : 'E',
      'ctl00$ContentPlaceHolder1$btnConsultar': 'Consultar',
      ...(viewState ? { 'javax.faces.ViewState': viewState } : {}),
    })

    const r5 = await client.post(urlMisComprobantes, bodyFiltro.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': urlMisComprobantes,
      },
      validateStatus: () => true,
    })
    logRequest('POST', urlMisComprobantes, r5.status, 'consulta enviada')

    writeFileSync('debug-listado.html', String(r5.data))
    console.log('  📄 HTML del listado guardado en debug-listado.html')

    // 5. Parsear listado
    console.log('\n📍 Paso 7: Parsear listado')
    const comprobantes = parsearListadoComprobantes(String(r5.data))
    console.log(`  → ${comprobantes.length} comprobante(s) detectados`)

    if (comprobantes.length === 0) {
      console.log('  ⚠️ No se encontraron comprobantes — verificar:')
      console.log('     - Rango de fechas válido')
      console.log('     - Empresa con actividad en el período')
      console.log('     - Selectores del parser (revisar debug-listado.html)')
    } else {
      console.log('\n📋 Primeros 5:')
      comprobantes.slice(0, 5).forEach((c, i) => {
        console.log(`  ${i + 1}.`, JSON.stringify(c))
      })

      // Guardar como JSON para inspección
      writeFileSync('comprobantes.json', JSON.stringify(comprobantes, null, 2))
      console.log(`\n💾 ${comprobantes.length} comprobante(s) guardados en comprobantes.json`)
    }

    console.log('\n✅ POC FETCH terminado')
  } catch (err) {
    console.error('\n❌ Error:', (err as Error).message)
    if ((err as any).response) {
      console.error('   Status HTTP:', (err as any).response.status)
    }
    process.exit(1)
  }
}

main()
