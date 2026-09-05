import { lookup } from "node:dns/promises"

export type ImagenRemota =
  | { ok: true; bytes: ArrayBuffer; tipo: string }
  | { ok: false; error: string; status: number }

/** Cuántos saltos se siguen. Cada uno se vuelve a validar; ninguno se sigue a ciegas. */
const MAX_REDIRECCIONES = 3
const TIMEOUT_MS = 10_000

/**
 * ¿Esta IP es de la red interna? Si lo es, no se descarga nada de ahí.
 *
 * Es la defensa contra **SSRF**: el que pega el link elige a qué dirección se conecta *el
 * servidor*, no su navegador. Sin este filtro, pegar `http://169.254.169.254/…` haría que el
 * servidor le pida las credenciales al metadata service del hosting y las devuelva como si fueran
 * una foto de perfil. Mismo problema con `localhost`, con la red privada del datacenter y con
 * cualquier servicio interno que no esté publicado.
 */
function esPrivada(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase()
    // ::1 (loopback), fc00::/7 (únicas locales), fe80::/10 (link-local), y el ::ffff: mapeado a v4.
    if (v6 === "::1" || v6 === "::" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)) return true
    const mapeada = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapeada) return esPrivada(mapeada[1]!)
    return false
  }
  const o = ip.split(".").map(Number)
  if (o.length !== 4 || o.some((n) => Number.isNaN(n))) return true // no se entiende → no se sale
  const [a, b] = o as [number, number, number, number]
  return (
    a === 0 ||                            // 0.0.0.0/8
    a === 10 ||                           // privada
    a === 127 ||                          // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||           // link-local — el metadata service del cloud vive acá
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224                              // multicast y reservadas
  )
}

/** Valida esquema y destino de una URL antes de conectarse a ella. */
async function destinoPermitido(url: URL): Promise<string | null> {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "El link tiene que empezar con http:// o https://."
  }
  try {
    // ⚠️ Se resuelve el nombre **antes** de conectarse: un dominio público puede apuntar a
    // 127.0.0.1 a propósito. Mirar sólo el texto del host no alcanza.
    const { address } = await lookup(url.hostname)
    if (esPrivada(address)) return "Ese link apunta a una dirección interna."
  } catch {
    return "No se pudo resolver el dominio del link."
  }
  return null
}

/**
 * Descarga una imagen de una URL pública, para guardarla como propia.
 *
 * **Por qué se descarga en vez de guardar el link.** Tres motivos, y el primero es que si no, no
 * se ve: la CSP de `middleware.ts` sólo permite imágenes de `'self'` y de Supabase, así que un
 * `<img>` a un dominio ajeno lo bloquea el navegador **en silencio** y el avatar queda en las
 * iniciales como si la carga hubiera fallado. Además, un link ajeno se rompe el día que el otro
 * sitio lo borra, y mientras tanto le cuenta a ese sitio quién mira la app y desde dónde.
 *
 * El que valida tipo y tamaño es el que llama (mismos límites que para un archivo subido).
 */
export async function traerImagenRemota(link: string, maxBytes: number): Promise<ImagenRemota> {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return { ok: false, error: "Eso no parece un link válido.", status: 400 }
  }

  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    const problema = await destinoPermitido(url)
    if (problema) return { ok: false, error: problema, status: 400 }

    let res: Response
    try {
      res = await fetch(url, {
        // `manual` para poder revalidar cada salto: seguir redirecciones automáticamente
        // dejaría entrar por la puerta de atrás justo lo que filtra `destinoPermitido`.
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "image/*" },
      })
    } catch {
      return { ok: false, error: "No se pudo descargar la imagen de ese link.", status: 502 }
    }

    if (res.status >= 300 && res.status < 400) {
      const destino = res.headers.get("location")
      if (!destino) return { ok: false, error: "El link redirige a ningún lado.", status: 502 }
      url = new URL(destino, url)
      continue
    }
    if (!res.ok) {
      return { ok: false, error: `El link respondió ${res.status}.`, status: 502 }
    }

    const tipo = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase()

    // Corte barato antes de bajar nada: si el servidor declara el tamaño y no entra, se corta acá.
    const declarado = Number(res.headers.get("content-length"))
    if (declarado && declarado > maxBytes) {
      return {
        ok: false,
        error: `La imagen del link pesa ${(declarado / 1024 / 1024).toFixed(1)} MB.`,
        status: 413,
      }
    }

    const bytes = await res.arrayBuffer().catch(() => null)
    if (!bytes) return { ok: false, error: "No se pudo leer la imagen del link.", status: 502 }
    // Y el corte de verdad: `content-length` es lo que el otro servidor *dice*, no lo que manda.
    if (bytes.byteLength > maxBytes) {
      return {
        ok: false,
        error: `La imagen del link pesa ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB.`,
        status: 413,
      }
    }

    return { ok: true, bytes, tipo }
  }

  return { ok: false, error: "El link da demasiadas vueltas antes de llegar a la imagen.", status: 502 }
}
