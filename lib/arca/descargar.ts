import { load } from 'cheerio'
import { AxiosInstance } from 'axios'
import JSZip from 'jszip'

const URL_MCMP_INDEX = 'https://fes.afip.gob.ar/mcmp/jsp/index.do'
const URL_SETEAR_CONTRIBUYENTE = 'https://fes.afip.gob.ar/mcmp/jsp/setearContribuyente.do'
const URL_AJAX = 'https://fes.afip.gob.ar/mcmp/jsp/ajax.do'

interface SsoToken { token: string; sign: string }
interface Contribuyente { id: string; cuit: string; nombre: string }

/**
 * Convierte fecha YYYY-MM-DD a DD/MM/YYYY (formato ARCA)
 */
function toAR(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Mapeo de nombres de columnas del CSV ARCA → CSV/Excel del importer existente.
 * Esto permite reutilizar /api/import-facturas-arca sin tocarlo.
 *
 * ARCA usa nombres como "Imp. Neto Gravado IVA 0%" mientras que el importer
 * espera "Neto Grav. IVA 0%". Los datos son los mismos, solo cambian los labels.
 */
const MAPEO_COLUMNAS: Record<string, string> = {
  // Estas dos son las que el endpoint usa para detectar "EXCEL NUEVO"
  // (necesita Fecha + Tipo presentes y Fecha de Emisión ausente)
  'Fecha de Emisión': 'Fecha',
  'Tipo de Comprobante': 'Tipo',
  // Totales IVA
  'IVA': 'Total IVA',
  // Desglose por alícuota
  'Imp. Neto Gravado IVA 0%': 'Neto Grav. IVA 0%',
  'Imp. Neto Gravado IVA 2,5%': 'Neto Grav. IVA 2,5%',
  'Imp. Neto Gravado IVA 5%': 'Neto Grav. IVA 5%',
  'Imp. Neto Gravado IVA 10,5%': 'Neto Grav. IVA 10,5%',
  'Imp. Neto Gravado IVA 21%': 'Neto Grav. IVA 21%',
  'Imp. Neto Gravado IVA 27%': 'Neto Grav. IVA 27%',
  'Imp. Neto Gravado Total': 'Neto Gravado Total',
  'Imp. Neto No Gravado': 'Neto No Gravado',
  'Imp. Op. Exentas': 'Op. Exentas',
}

/**
 * Reescribe el header del CSV de ARCA para que coincida con el formato Excel
 * del importer existente. Mantiene los datos intactos.
 */
function adaptarHeaderCsv(csvText: string): string {
  const lineas = csvText.split(/\r?\n/)
  if (lineas.length === 0) return csvText
  // Reemplazar nombres en la primera línea
  let header = lineas[0]
  for (const [arcaName, importerName] of Object.entries(MAPEO_COLUMNAS)) {
    header = header.split(`"${arcaName}"`).join(`"${importerName}"`)
  }
  lineas[0] = header
  return lineas.join('\n')
}

/**
 * Hace el SSO al servicio Mis Comprobantes (fes.afip.gob.ar) usando el token+sign
 * obtenido del portal API. Devuelve la primera página HTML (selector empresa).
 */
async function ssoMisComprobantes(client: AxiosInstance, cuitPersonal: string): Promise<string> {
  // 1. GET /portal/api/servicios/{cuit}/servicio/mcmp/autorizacion → token + sign
  const urlAuth = `https://portalcf.cloud.afip.gob.ar/portal/api/servicios/${cuitPersonal}/servicio/mcmp/autorizacion`
  const rAuth = await client.get(urlAuth, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://portalcf.cloud.afip.gob.ar/portal/app/',
    },
    validateStatus: () => true,
  })
  if (rAuth.status !== 200 || !rAuth.data?.token || !rAuth.data?.sign) {
    throw new Error('No se pudo obtener token de SSO al servicio Mis Comprobantes.')
  }
  const sso: SsoToken = { token: rAuth.data.token, sign: rAuth.data.sign }

  // 2. POST token+sign al servicio
  const body = new URLSearchParams({ token: sso.token, sign: sso.sign })
  const rIndex = await client.post(URL_MCMP_INDEX, body.toString(), {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://portalcf.cloud.afip.gob.ar',
      'Referer': 'https://portalcf.cloud.afip.gob.ar/',
    },
    validateStatus: () => true,
    maxRedirects: 10,
  })
  const html = String(rIndex.data)
  if (rIndex.status !== 200 || html.length < 5000 || /sesi.+expirad/i.test(html)) {
    throw new Error('No se pudo entrar al servicio Mis Comprobantes.')
  }
  return html
}

/**
 * Parsea la pantalla de selección de empresa y devuelve la lista de contribuyentes
 * disponibles para representar (con sus IDs internos).
 */
function parsearContribuyentes(html: string): Contribuyente[] {
  const $ = load(html)
  const contribuyentes: Contribuyente[] = []
  $('a[onclick*="idcontribuyente"]').each((_, el) => {
    const onclick = $(el).attr('onclick') || ''
    const idMatch = onclick.match(/idcontribuyente['"]?\)\.value\s*=\s*['"]?(\d+)/i)
    const id = idMatch ? idMatch[1] : null
    // CUIT puede estar en <small>, <p.text-muted> u otros tags → buscar regex en todo el texto del <a>
    const textoCompleto = $(el).text()
    const cuitMatch = textoCompleto.match(/(\d{2}-?\d{8}-?\d)/)
    const cuit = cuitMatch ? cuitMatch[1].replace(/-/g, '') : null
    const nombre = $(el).find('h1, h2, h3, h4').first().text().trim()
    // id puede ser '0' (caso MA con un solo contribuyente) → comparar contra null explícito
    if (id !== null && cuit && !contribuyentes.find(c => c.cuit === cuit)) {
      contribuyentes.push({ id, cuit, nombre })
    }
  })
  return contribuyentes
}

/**
 * Selecciona la empresa (representado) en el servicio Mis Comprobantes.
 * Debe llamarse después de ssoMisComprobantes.
 */
async function seleccionarEmpresa(client: AxiosInstance, idContribuyente: string): Promise<void> {
  const body = new URLSearchParams({ idContribuyente })
  const r = await client.post(URL_SETEAR_CONTRIBUYENTE, body.toString(), {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://fes.afip.gob.ar',
      'Referer': URL_MCMP_INDEX,
    },
    validateStatus: () => true,
    maxRedirects: 10,
  })
  if (r.status !== 200) {
    throw new Error(`Falló selección de empresa: status ${r.status}`)
  }
  // Navegar a la pantalla de filtros para inicializar la sesión del menú
  const urlTipo = 'https://fes.afip.gob.ar/mcmp/jsp/comprobantesRecibidos.do'
  await client.get(urlTipo, {
    headers: { 'Referer': URL_SETEAR_CONTRIBUYENTE },
    validateStatus: () => true,
  })
}

/**
 * Genera una consulta de comprobantes y devuelve el idConsulta para descargar.
 */
async function generarConsulta(
  client: AxiosInstance,
  cuitEmpresa: string,
  fechaDesde: string,
  fechaHasta: string,
  tipo: 'recibidos' | 'emitidos',
): Promise<string> {
  const tipoLetra = tipo === 'emitidos' ? 'E' : 'R'
  const rangoFechas = `${toAR(fechaDesde)} - ${toAR(fechaHasta)}`
  const urlTipoFiltros = tipo === 'emitidos'
    ? 'https://fes.afip.gob.ar/mcmp/jsp/comprobantesEmitidos.do'
    : 'https://fes.afip.gob.ar/mcmp/jsp/comprobantesRecibidos.do'

  const r = await client.get(URL_AJAX, {
    params: {
      f: 'generarConsulta',
      t: tipoLetra,
      fechaEmision: rangoFechas,
      tiposComprobantes: '',
      cuitConsultada: cuitEmpresa,
    },
    headers: {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': urlTipoFiltros,
    },
    validateStatus: () => true,
  })

  if (r.status !== 200 || r.data?.estado !== 'ok') {
    const msg = r.data?.mensajeError || 'Error desconocido'
    throw new Error(`generarConsulta falló: ${msg}`)
  }
  const idConsulta = r.data?.datos?.idConsulta
  if (!idConsulta) {
    throw new Error('generarConsulta no devolvió idConsulta')
  }
  return String(idConsulta)
}

/**
 * Descarga el ZIP del servicio, extrae el CSV y adapta los nombres de columnas.
 */
async function descargarCsvAdaptado(
  client: AxiosInstance,
  idConsulta: string,
  tipo: 'recibidos' | 'emitidos',
): Promise<{ csvText: string; cantidad: number }> {
  const tipoLetra = tipo === 'emitidos' ? 'E' : 'R'
  const urlTipoFiltros = tipo === 'emitidos'
    ? 'https://fes.afip.gob.ar/mcmp/jsp/comprobantesEmitidos.do'
    : 'https://fes.afip.gob.ar/mcmp/jsp/comprobantesRecibidos.do'
  const urlDescarga = `https://fes.afip.gob.ar/mcmp/jsp/descargarComprobantes.do?id=${idConsulta}&tc=${tipoLetra}&tf=csv`

  const r = await client.get(urlDescarga, {
    headers: {
      'Accept': 'application/zip,text/csv,text/plain,*/*;q=0.8',
      'Referer': urlTipoFiltros,
    },
    validateStatus: () => true,
    responseType: 'arraybuffer',
  })
  if (r.status !== 200) {
    throw new Error(`Descarga falló con status ${r.status}`)
  }

  const buf = Buffer.from(r.data as ArrayBuffer)
  const zip = await JSZip.loadAsync(buf)
  const archivos = Object.keys(zip.files)
  const csvFile = archivos.find(n => /\.csv$/i.test(n))
  if (!csvFile) {
    throw new Error('No se encontró CSV dentro del ZIP descargado')
  }
  const csvRaw = await zip.files[csvFile].async('string')
  const csvText = adaptarHeaderCsv(csvRaw)

  // Contar líneas (1 header + N comprobantes)
  const lineas = csvText.split(/\r?\n/).filter(l => l.trim().length > 0)
  const cantidad = Math.max(0, lineas.length - 1)
  return { csvText, cantidad }
}

export interface DescargaInput {
  cuitPersonal: string             // CUIT del que loguea (vos)
  cuitEmpresa: string              // CUIT a representar
  fechaDesde: string               // YYYY-MM-DD
  fechaHasta: string               // YYYY-MM-DD
  tipo: 'recibidos' | 'emitidos'
}

export interface DescargaResult {
  csvText: string                  // CSV con nombres adaptados al importer
  cantidad: number                 // comprobantes descargados
  rango: string                    // "DD/MM/YYYY - DD/MM/YYYY"
}

/**
 * Flujo end-to-end: SSO al servicio + seleccionar empresa + descargar CSV adaptado.
 * Requiere un cliente axios YA logueado (con sesión activa en portalcf.cloud.afip.gob.ar).
 */
export async function descargarMisComprobantes(
  client: AxiosInstance,
  input: DescargaInput,
): Promise<DescargaResult> {
  // 1. SSO al servicio
  const htmlSelector = await ssoMisComprobantes(client, input.cuitPersonal)

  // 2. Buscar el CUIT objetivo en la lista de contribuyentes
  //    - MSA: la lista trae varios (los representados de tu CUIT personal)
  //    - MA: la lista trae uno solo (vos mismo, con idContribuyente='0')
  const contribuyentes = parsearContribuyentes(htmlSelector)
  const objetivo = contribuyentes.find(c => c.cuit === input.cuitEmpresa)
  if (!objetivo) {
    throw new Error(`CUIT ${input.cuitEmpresa} no aparece en tus representados. Disponibles: ${contribuyentes.map(c => c.cuit).join(', ') || '(ninguno)'}`)
  }

  // 3. Seleccionar la empresa (POST a setearContribuyente.do)
  await seleccionarEmpresa(client, objetivo.id)

  // 4. Generar consulta + descargar CSV adaptado
  const idConsulta = await generarConsulta(client, input.cuitEmpresa, input.fechaDesde, input.fechaHasta, input.tipo)
  const { csvText, cantidad } = await descargarCsvAdaptado(client, idConsulta, input.tipo)

  return {
    csvText,
    cantidad,
    rango: `${toAR(input.fechaDesde)} - ${toAR(input.fechaHasta)}`,
  }
}
