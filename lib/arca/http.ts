import axios, { AxiosInstance } from 'axios'
import { CookieJar } from 'tough-cookie'
import { wrapper } from 'axios-cookiejar-support'
import type { Agent as HttpsAgent } from 'node:https'
import { rootCertificates } from 'node:tls'
import { INTERMEDIOS_ARCA } from './certificados'

const CONFIANZA_ARCA = [...rootCertificates, ...INTERMEDIOS_ARCA]

/**
 * Cliente HTTP con cookie jar persistente — simula un browser para ARCA.
 * Cada invocación crea un cliente nuevo (no se comparte sesión entre requests).
 */
export function crearClienteHttp(): AxiosInstance {
  const jar = new CookieJar()
  const base = axios.create({
    jar,
    withCredentials: true,
    maxRedirects: 5,
    timeout: 30_000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  })
  // El portal de ARCA no envía su certificado intermedio (A-BUG-1630): se suma a los de confianza de la conexión.
  // Va ANTES de `wrapper`: los interceptores de pedido corren del último al primero, así que primero corre el de las
  // cookies (que crea la conexión de cada pedido) y después éste, que le agrega los certificados. No se desactiva la
  // verificación: se sigue exigiendo una cadena que termine en una raíz conocida.
  base.interceptors.request.use(config => {
    const agente = config.httpsAgent as HttpsAgent | undefined
    if (agente) agente.options.ca = CONFIANZA_ARCA
    return config
  })
  const client = wrapper(base)
  return client
}
