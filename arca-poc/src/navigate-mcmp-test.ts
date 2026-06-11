/**
 * Test del flujo: login + handshake con el portal API + Mis Comprobantes + selección de empresa.
 *
 * Uso:
 *   npm run mcmp
 */
import { load } from 'cheerio'
import { writeFileSync } from 'node:fs'
import JSZip from 'jszip'
import { getCredenciales, PARAMS } from './config.js'
import { loginArca } from './login.js'

async function main() {
  try {
    const cred = await getCredenciales(PARAMS.empresa)
    console.log(`\nEmpresa objetivo: ${cred.empresa}  |  CUIT empresa: ${cred.cuitEmpresa}  |  CUIT que loguea: ${cred.cuitPersonal}`)

    const client = await loginArca(cred)

    // ── Paso 5: GET info del servicio ──────────────────────────────
    console.log('\n📍 Paso 5: GET info del servicio mcmp')
    const urlInfo = `https://portalcf.cloud.afip.gob.ar/portal/api/servicios/${cred.cuitPersonal}/servicio/mcmp`
    const r5 = await client.get(urlInfo, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://portalcf.cloud.afip.gob.ar/portal/app/',
      },
      validateStatus: () => true,
    })
    console.log(`  GET ${urlInfo}  →  ${r5.status}`)
    console.log(`  Content-Type: ${r5.headers['content-type']}`)
    console.log(`  Tamaño respuesta: ${JSON.stringify(r5.data).length} bytes`)
    writeFileSync('debug-step5-mcmp-info.json', JSON.stringify(r5.data, null, 2))
    console.log('  📄 debug-step5-mcmp-info.json guardado')
    console.log('  Body:', typeof r5.data === 'object' ? JSON.stringify(r5.data, null, 2).slice(0, 400) : String(r5.data).slice(0, 400))

    // ── Paso 6: GET autorización ───────────────────────────────────
    console.log('\n📍 Paso 6: GET autorización (esto debería devolver token/URL del SSO)')
    const urlAuth = `https://portalcf.cloud.afip.gob.ar/portal/api/servicios/${cred.cuitPersonal}/servicio/mcmp/autorizacion`
    const r6 = await client.get(urlAuth, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://portalcf.cloud.afip.gob.ar/portal/app/',
      },
      validateStatus: () => true,
    })
    console.log(`  GET ${urlAuth}  →  ${r6.status}`)
    console.log(`  Content-Type: ${r6.headers['content-type']}`)
    console.log(`  Tamaño respuesta: ${JSON.stringify(r6.data).length} bytes`)
    writeFileSync('debug-step6-mcmp-autorizacion.json', JSON.stringify(r6.data, null, 2))
    console.log('  📄 debug-step6-mcmp-autorizacion.json guardado')
    console.log('  Body completo:', typeof r6.data === 'object' ? JSON.stringify(r6.data, null, 2) : String(r6.data).slice(0, 1500))

    // ── Paso 7: POST token+sign al servicio Mis Comprobantes ───────
    // El browser hace un POST con token y sign como form-urlencoded.
    // El servicio responde con la HTML del módulo Y setea cookies de sesión
    // en fes.afip.gob.ar (SESSION_TOKEN, SESSION_SIGN, JSESSIONID, etc.)
    const auth = r6.data as { token?: string, sign?: string }
    if (!auth?.token || !auth?.sign) {
      throw new Error('Autorización no devolvió token+sign. Revisar debug-step6-mcmp-autorizacion.json')
    }

    const urlServicio = 'https://fes.afip.gob.ar/mcmp/jsp/index.do'
    console.log(`\n📍 Paso 7: POST token+sign al servicio Mis Comprobantes`)
    console.log(`  POST ${urlServicio}`)
    const body7 = new URLSearchParams({
      token: auth.token,
      sign: auth.sign,
    })
    const r7 = await client.post(urlServicio, body7.toString(), {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://portalcf.cloud.afip.gob.ar',
        'Referer': 'https://portalcf.cloud.afip.gob.ar/',
        'Upgrade-Insecure-Requests': '1',
      },
      validateStatus: () => true,
      maxRedirects: 10,
    })
    console.log(`  →  ${r7.status}`)
    console.log(`  Final URL: ${r7.request?.res?.responseUrl || urlServicio}`)
    console.log(`  Content-Type: ${r7.headers['content-type']}`)
    console.log(`  Tamaño respuesta: ${String(r7.data).length} bytes`)
    writeFileSync('debug-step7-mcmp-index.html', String(r7.data))
    console.log('  📄 debug-step7-mcmp-index.html guardado')

    const respText7 = String(r7.data)
    if (r7.status === 200 && respText7.length > 5000 && !/sesi.+expirad/i.test(respText7)) {
      console.log('\n✅ Entramos al servicio Mis Comprobantes — sesión activa en fes.afip.gob.ar')
      const titulo = respText7.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
      console.log(`  Título de la página: "${titulo || '(sin title)'}"`)
    } else if (/sesi.+expirad/i.test(respText7)) {
      throw new Error('Sesión expirada — el token vence rápido. Reintentar todo el flujo.')
    } else {
      throw new Error('Respuesta inesperada del servicio. Revisar debug-step7-mcmp-index.html')
    }

    // ── Paso 8: Seleccionar empresa (representado) ─────────────────
    // La pantalla post-login es un selector de contribuyente con varios <a onclick=...idcontribuyente='N'...>.
    // Cada uno tiene un CUIT con guiones (ej "30-61778601-6"). Buscamos el que coincide con el CUIT del .env.
    console.log(`\n📍 Paso 8: Seleccionar empresa (CUIT objetivo: ${cred.cuitEmpresa})`)
    const $page = load(respText7)
    interface Contribuyente { id: string; cuit: string; nombre: string }
    const contribuyentes: Contribuyente[] = []
    $page('a[onclick*="idcontribuyente"]').each((_, el) => {
      const onclick = $page(el).attr('onclick') || ''
      const idMatch = onclick.match(/idcontribuyente['"]?\)\.value\s*=\s*['"]?(\d+)/i)
      const id = idMatch ? idMatch[1] : null
      const cuitText = $page(el).find('small').first().text().trim()           // "30-61778601-6"
      const cuit = cuitText.replace(/-/g, '')                                  // "30617786016"
      const nombre = $page(el).find('h2, h3').first().text().trim()
      if (id && cuit && !contribuyentes.find(c => c.cuit === cuit)) {
        contribuyentes.push({ id, cuit, nombre })
      }
    })
    console.log(`  Contribuyentes detectados (${contribuyentes.length}):`)
    contribuyentes.forEach(c => console.log(`    - id=${c.id}  CUIT=${c.cuit}  ${c.nombre}`))

    const objetivo = contribuyentes.find(c => c.cuit === cred.cuitEmpresa)
    if (!objetivo) {
      throw new Error(`No se encontró el CUIT ${cred.cuitEmpresa} en el selector de empresas. Disponibles: ${contribuyentes.map(c => c.cuit).join(', ')}`)
    }
    console.log(`  ✓ Empresa seleccionada: id=${objetivo.id} (${objetivo.nombre})`)

    const urlSetear = 'https://fes.afip.gob.ar/mcmp/jsp/setearContribuyente.do'
    const body8 = new URLSearchParams({ idContribuyente: objetivo.id })
    const r8 = await client.post(urlSetear, body8.toString(), {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://fes.afip.gob.ar',
        'Referer': urlServicio,
      },
      validateStatus: () => true,
      maxRedirects: 10,
    })
    console.log(`  POST ${urlSetear}  →  ${r8.status}`)
    console.log(`  Final URL: ${r8.request?.res?.responseUrl || urlSetear}`)
    console.log(`  Tamaño respuesta: ${String(r8.data).length} bytes`)
    writeFileSync('debug-step8-after-empresa-selected.html', String(r8.data))
    console.log('  📄 debug-step8-after-empresa-selected.html guardado')

    const respText8 = String(r8.data)
    if (r8.status === 200 && /Comprobantes Recibidos|Comprobantes Emitidos|btnRecibidos/i.test(respText8)) {
      console.log('\n✅ Empresa seleccionada — estamos en el menú de Mis Comprobantes')
    } else if (/seleccionaEmpresaForm/.test(respText8)) {
      throw new Error('Volvió al selector de empresa — algo falló en el POST. Revisar debug-step8.')
    } else {
      throw new Error('Respuesta inesperada. Revisar debug-step8-after-empresa-selected.html')
    }

    // ── Paso 9: Ir a Comprobantes Recibidos (o Emitidos) ───────────
    const urlTipo = PARAMS.tipo === 'emitidos'
      ? 'https://fes.afip.gob.ar/mcmp/jsp/comprobantesEmitidos.do'
      : 'https://fes.afip.gob.ar/mcmp/jsp/comprobantesRecibidos.do'
    console.log(`\n📍 Paso 9: GET ${PARAMS.tipo} (form de filtros)`)
    console.log(`  ${urlTipo}`)
    const r9 = await client.get(urlTipo, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://fes.afip.gob.ar/mcmp/jsp/setearContribuyente.do',
      },
      validateStatus: () => true,
      maxRedirects: 5,
    })
    console.log(`  →  ${r9.status}`)
    console.log(`  Final URL: ${r9.request?.res?.responseUrl || urlTipo}`)
    console.log(`  Tamaño respuesta: ${String(r9.data).length} bytes`)
    writeFileSync('debug-step9-form-filtros.html', String(r9.data))
    console.log('  📄 debug-step9-form-filtros.html guardado')

    const respText9 = String(r9.data)
    if (r9.status === 200 && respText9.length > 5000) {
      console.log(`\n✅ Pantalla de filtros de "${PARAMS.tipo}" cargada`)
    } else {
      throw new Error('Respuesta inesperada. Revisar debug-step9-form-filtros.html')
    }

    // ── Paso 10: Generar consulta ──────────────────────────────────
    // GET ajax.do?f=generarConsulta&t=R&fechaEmision=DD/MM/YYYY-DD/MM/YYYY
    // Convertir fechas del .env (YYYY-MM-DD) a formato AR (DD/MM/YYYY)
    const toAR = (yyyymmdd: string): string => {
      const [y, m, d] = yyyymmdd.split('-')
      return `${d}/${m}/${y}`
    }
    // El separador del daterangepicker es " - " (con espacios alrededor del guión)
    const rangoFechas = `${toAR(PARAMS.fechaDesde)} - ${toAR(PARAMS.fechaHasta)}`
    const tipoLetra = PARAMS.tipo === 'emitidos' ? 'E' : 'R'

    console.log(`\n📍 Paso 10: Generar consulta (rango ${rangoFechas}, tipo ${tipoLetra}, cuit ${cred.cuitEmpresa})`)
    const urlAjax = 'https://fes.afip.gob.ar/mcmp/jsp/ajax.do'
    const r10 = await client.get(urlAjax, {
      params: {
        f: 'generarConsulta',
        t: tipoLetra,
        fechaEmision: rangoFechas,
        tiposComprobantes: '',
        cuitConsultada: cred.cuitEmpresa,
      },
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': urlTipo,
      },
      validateStatus: () => true,
    })
    console.log(`  GET ${urlAjax}?f=generarConsulta&t=${tipoLetra}&fechaEmision=${rangoFechas}&cuitConsultada=${cred.cuitEmpresa}  →  ${r10.status}`)
    console.log(`  Body:`, typeof r10.data === 'object' ? JSON.stringify(r10.data).slice(0, 500) : String(r10.data).slice(0, 500))
    writeFileSync('debug-step10-generarConsulta.json', typeof r10.data === 'object' ? JSON.stringify(r10.data, null, 2) : String(r10.data))

    if (r10.status !== 200 || typeof r10.data !== 'object' || r10.data?.estado !== 'ok') {
      throw new Error('generarConsulta no devolvió OK. Revisar debug-step10.')
    }
    const idConsulta = r10.data?.datos?.idConsulta
    if (!idConsulta) {
      throw new Error('No vino idConsulta en la respuesta. Revisar debug-step10.')
    }
    console.log(`  ✓ idConsulta: ${idConsulta}`)

    // ── Paso 11: Recuperar lista de resultados ─────────────────────
    console.log(`\n📍 Paso 11: Listar resultados (idConsulta=${idConsulta})`)
    const r11 = await client.get(urlAjax, {
      params: {
        f: 'listaResultados',
        id: idConsulta,
        start: 0,
        length: 500,   // hasta 500 comprobantes por página
        'draw': 1,
      },
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': urlTipo,
      },
      validateStatus: () => true,
    })
    console.log(`  GET ${urlAjax}?f=listaResultados&id=${idConsulta}  →  ${r11.status}`)
    console.log(`  Tamaño respuesta: ${JSON.stringify(r11.data).length} bytes`)
    writeFileSync('debug-step11-listaResultados.json', typeof r11.data === 'object' ? JSON.stringify(r11.data, null, 2) : String(r11.data))

    const datos = (r11.data as any)?.datos
    if (datos?.data && Array.isArray(datos.data)) {
      console.log(`\n✅ ${datos.data.length} comprobante(s) recibidos. Primeros 3:`)
      datos.data.slice(0, 3).forEach((row: any, i: number) => {
        console.log(`  ${i + 1}.`, Array.isArray(row) ? row.slice(0, 8).join(' | ') : JSON.stringify(row).slice(0, 200))
      })
    } else if ((r11.data as any)?.datos?.estado === 'PE' || (r11.data as any)?.datos?.estado === 'PR') {
      console.log('  ⚠️ Consulta todavía pendiente/procesando. Hace falta hacer polling.')
    } else {
      console.log('  ⚠️ Respuesta inesperada. Revisar debug-step11.')
    }

    // ── Paso 12: Descargar ZIP (con CSV adentro) ───────────────────
    console.log(`\n📍 Paso 12: Descargar ZIP del servicio`)
    const urlCsv = `https://fes.afip.gob.ar/mcmp/jsp/descargarComprobantes.do?id=${idConsulta}&tc=${tipoLetra}&tf=csv`
    const r12 = await client.get(urlCsv, {
      headers: {
        'Accept': 'application/zip,text/csv,text/plain,*/*;q=0.8',
        'Referer': urlTipo,
      },
      validateStatus: () => true,
      responseType: 'arraybuffer',
    })
    console.log(`  GET ${urlCsv}  →  ${r12.status}`)
    console.log(`  Content-Type: ${r12.headers['content-type']}`)
    const buf = Buffer.from(r12.data as ArrayBuffer)
    console.log(`  Tamaño respuesta: ${buf.length} bytes`)
    writeFileSync('debug-step12-comprobantes.zip', buf)
    console.log('  📄 debug-step12-comprobantes.zip guardado')

    // ── Paso 13: Descomprimir y extraer el CSV ──────────────────────
    console.log(`\n📍 Paso 13: Descomprimir ZIP y extraer CSV`)
    const zip = await JSZip.loadAsync(buf)
    const archivos = Object.keys(zip.files)
    console.log(`  Archivos en el ZIP (${archivos.length}):`)
    archivos.forEach(n => console.log(`    - ${n}`))

    const csvFile = archivos.find(n => /\.csv$/i.test(n))
    if (!csvFile) {
      throw new Error('No se encontró CSV dentro del ZIP')
    }
    const csvText = await zip.files[csvFile].async('string')
    writeFileSync('debug-step13-comprobantes.csv', csvText)
    console.log(`  📄 debug-step13-comprobantes.csv guardado (${csvText.length} bytes)`)

    const lineas = csvText.split(/\r?\n/).filter(l => l.trim().length > 0)
    console.log(`\n✅ CSV extraído: ${lineas.length} línea(s) (1 header + ${Math.max(0, lineas.length - 1)} comprobantes)`)
    if (lineas.length > 0) {
      console.log(`  Header (${lineas[0].split(';').length} columnas):`)
      console.log(`    ${lineas[0].slice(0, 400)}`)
    }
    if (lineas.length > 1) {
      console.log(`  Fila 1:`)
      console.log(`    ${lineas[1].slice(0, 400)}`)
    }
    if (lineas.length > 2) {
      console.log(`  Fila 2:`)
      console.log(`    ${lineas[2].slice(0, 400)}`)
    }

    console.log(`\n🎉 POC COMPLETO — descarga del CSV de Mis Comprobantes funciona end-to-end.`)

  } catch (err) {
    console.error('\n❌ Error:', (err as Error).message)
    process.exit(1)
  }
}

main()
