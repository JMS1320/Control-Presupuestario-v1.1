import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { COOKIE_RECORDAR, ajustarPersistencia } from "@/lib/auth/cookies-sesion"
import { COOKIE_ACTIVIDAD, sesionDelToken, sesionVencida } from "@/lib/auth/inactividad"
import { RUTA_PAUSA, desvioPorPausa } from "@/lib/auth/pausa"

/**
 * MIDDLEWARE DE SESIÓN Y ACCESO
 *
 * Corre antes que cualquier página. Hace tres cosas, en orden:
 *   1. refresca la sesión (el access token dura 1 h; sin esto el usuario se caería solo);
 *   2. deja pasar sólo a quien está autenticado — y al admin, sólo con 2FO cumplido;
 *   3. pone las cabeceras de seguridad.
 *
 * Reemplaza a las rutas-como-password de `config/access-routes.ts`: la URL ya no da acceso.
 * Decidido con el usuario 2026-09-03 → `MODULO_USUARIOS.md` § Cambio de rumbo.
 */

/** Rutas que se sirven sin sesión. Todo lo demás exige login. */
const RUTAS_PUBLICAS = ["/login", "/auth", "/no-access"]

function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(r + "/"))
}

function cabecerasDeSeguridad(res: NextResponse, urlSupabase: string): NextResponse {
  // Clickjacking: la app no se embebe en ningún lado.
  res.headers.set("X-Frame-Options", "DENY")
  // Nada de MIME sniffing.
  res.headers.set("X-Content-Type-Options", "nosniff")
  // No filtrar la URL interna (que puede llevar ids) a sitios externos.
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  // Sin cámara, micrófono ni geolocalización.
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  )
  // HSTS: sólo tiene efecto sobre HTTPS, así que en localhost no molesta.
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )
  // CSP. `connect-src` habilita la API de Supabase (REST + Realtime por websocket).
  // ⚠️ `script-src` lleva 'unsafe-inline' porque Next inyecta su bootstrap inline; cerrarlo
  // requiere CSP por nonce (pendiente, ver A-SEC-05).
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // ⚠️ El dominio de Supabase va acá además de en `connect-src`: las fotos de perfil viven
      // en Storage y se muestran con un <img>, que la CSP filtra por `img-src`, no por
      // `connect-src`. Sin esto el navegador bloquea la imagen **en silencio**: la subida anda,
      // la URL devuelve 200, y el avatar igual muestra las iniciales de fallback como si nada.
      // `data:` es para el QR del segundo factor, que viene embebido.
      `img-src 'self' data: blob: ${urlSupabase}`,
      "font-src 'self' data:",
      `connect-src 'self' ${urlSupabase} ${urlSupabase.replace("https://", "wss://")}`,
      // El visor de Google Drive embebido («👁 ver» de un PDF sin vincular, en Subdiarios). Sin esta
      // línea cae en `default-src 'self'` y el navegador muestra «Este contenido está bloqueado»
      // (A-BUG-1248). Es qué puede embeber la app; quién puede embeberla a ella sigue siendo nadie.
      "frame-src https://drive.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ")
  )
  return res
}

export async function middleware(request: NextRequest) {
  const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL!
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    urlSupabase,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          // Si el usuario NO pidió que lo recuerden, las cookies se renuevan como cookies de
          // sesión: mueren al cerrar el navegador (ver lib/auth/cookies-sesion.ts).
          const recordar = request.cookies.get(COOKIE_RECORDAR)?.value === "1"
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, ajustarPersistencia(options, recordar))
          )
        },
      },
    }
  )

  // getUser() y NO getSession(): valida el JWT contra el servidor de Auth en vez de creerle
  // a la cookie. Además es lo que dispara el refresh del token.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Sin sesión y pidiendo algo privado → al login, recordando a dónde quería ir.
  if (!user && !esRutaPublica(pathname)) {
    // La API contesta 401 en JSON, no un redirect: un cliente que espera datos no sabe qué
    // hacer con el HTML del login (parte de A-SEC-06).
    if (pathname.startsWith("/api/")) {
      return cabecerasDeSeguridad(
        NextResponse.json({ error: "Sin sesión." }, { status: 401 }),
        urlSupabase
      )
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("volver_a", pathname)
    return cabecerasDeSeguridad(NextResponse.redirect(url), urlSupabase)
  }

  /**
   * ⏱️ Cierre por inactividad (A-FEAT-1351), la mitad del SERVIDOR. La pantalla
   * (`components/cierre-inactividad.tsx`) anota la última actividad en una cookie; acá se mira esa
   * marca ANTES de servir nada. Así, el que reabre la app pasado el tiempo —el celular que quedó en
   * un cajón— va derecho al login **sin que la página llegue a mostrar datos**.
   * Sólo cierra si la marca es de ESTA sesión: una vieja de la sesión anterior no cuenta.
   * Cierra sólo este aparato (`scope: "local"`), no las otras sesiones de la persona.
   */
  if (user && !esRutaPublica(pathname)) {
    const marca = request.cookies.get(COOKIE_ACTIVIDAD)?.value
    if (marca) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (sesionVencida(decodeURIComponent(marca), sesionDelToken(session?.access_token), Date.now())) {
        await supabase.auth.signOut({ scope: "local" })
        const salida = pathname.startsWith("/api/")
          ? NextResponse.json({ error: "La sesión se cerró por inactividad." }, { status: 401 })
          : (() => {
              const url = request.nextUrl.clone()
              url.pathname = "/login"
              url.search = ""
              url.searchParams.set("error", "inactividad")
              url.searchParams.set("volver_a", pathname)
              return NextResponse.redirect(url)
            })()
        // Las cookies de sesión borradas por signOut viajan en `response`: se copian a la salida.
        response.cookies.getAll().forEach((c) => salida.cookies.set(c))
        salida.cookies.delete(COOKIE_ACTIVIDAD)
        return cabecerasDeSeguridad(salida, urlSupabase)
      }
    }
  }

  // ⏸️ Persona en pausa mientras se actualiza el sistema (lib/auth/pausa.ts): ve sólo el aviso.
  if (user) {
    const desvio = desvioPorPausa(user.app_metadata, pathname)
    if (desvio === "api-503") {
      return cabecerasDeSeguridad(
        NextResponse.json({ error: "Estamos actualizando el sistema. Probá más tarde." }, { status: 503 }),
        urlSupabase
      )
    }
    if (desvio === "aviso") {
      const url = request.nextUrl.clone()
      url.pathname = RUTA_PAUSA
      url.search = ""
      return cabecerasDeSeguridad(NextResponse.redirect(url), urlSupabase)
    }
  }

  if (user) {
    const rol = user.app_metadata?.role
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    // Admin sin 2FA cumplido: no entra a ningún lado que no sea completar el segundo factor.
    // `nextLevel === 'aal2'` = tiene factor inscripto y le falta el desafío.
    // Si es admin y ni siquiera tiene factor, lo mandamos a inscribirlo.
    const necesitaDesafio = aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2"
    const adminSinFactor = rol === "admin" && aal?.nextLevel !== "aal2" && aal?.currentLevel !== "aal2"

    if ((necesitaDesafio || adminSinFactor) && !pathname.startsWith("/login")) {
      const url = request.nextUrl.clone()
      url.pathname = adminSinFactor ? "/login/2fa/alta" : "/login/2fa"
      // Se recuerda a dónde iba. Sin esto, un admin recién invitado quedaba mandado a la raíz
      // después de inscribir el 2FA y **nunca veía `/bienvenida`**, que es donde define su
      // contraseña — o sea que entraba una vez y no podía volver (A-FEAT-87).
      url.searchParams.set("next", pathname)
      return cabecerasDeSeguridad(NextResponse.redirect(url), urlSupabase)
    }

    // Ya logueado y con todo cumplido: el login no tiene nada que ofrecerle.
    if (pathname === "/login" && !necesitaDesafio && !adminSinFactor) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return cabecerasDeSeguridad(NextResponse.redirect(url), urlSupabase)
    }
  }

  return cabecerasDeSeguridad(response, urlSupabase)
}

export const config = {
  matcher: [
    /*
     * Todo menos los estáticos de Next y los assets. Ojo: el matcher NO puede depender de la
     * sesión, así que el chequeo real vive arriba.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
