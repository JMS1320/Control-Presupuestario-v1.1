import axios, { AxiosInstance } from 'axios'
import { CookieJar } from 'tough-cookie'
import { wrapper } from 'axios-cookiejar-support'

/**
 * Crea un cliente HTTP con manejo persistente de cookies (como un browser).
 * ARCA usa cookies de sesión + JSESSIONID + ViewState que dependen de la
 * continuidad del cookie jar.
 */
export function crearClienteHttp(): AxiosInstance {
  const jar = new CookieJar()
  const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    maxRedirects: 5,
    timeout: 30_000,
    // Headers para simular un browser real (Chrome 130)
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  }))
  return client
}

/** Helper para loguear lo que va y vuelve cuando algo falla */
export function logRequest(method: string, url: string, status: number, extra?: string) {
  console.log(`  ${method.padEnd(4)} ${url}  →  ${status}${extra ? '  (' + extra + ')' : ''}`)
}
