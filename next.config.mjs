/**
 * 🏷️ A-FEAT-1656 — la versión publicada, para mostrarla arriba a la derecha (JMS 25/11: «así no tengo
 * que entrar en Vercel»). Se fija AL BUILDEAR: Vercel pasa el commit, la rama y el entorno; la hora es
 * la del build, en hora argentina (§ fechas: un instante que se muestra como día y hora local).
 */
const horaBuild = new Date().toLocaleString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_VERSION_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 8),
    NEXT_PUBLIC_VERSION_RAMA: process.env.VERCEL_GIT_COMMIT_REF || '',
    NEXT_PUBLIC_VERSION_ENTORNO: process.env.VERCEL_ENV || 'local',
    NEXT_PUBLIC_VERSION_MENSAJE: (process.env.VERCEL_GIT_COMMIT_MESSAGE || '').split('\n')[0].slice(0, 160),
    NEXT_PUBLIC_VERSION_HORA: horaBuild,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // jsPDF usa jspdf.node.min.js → fflate/lib/node.cjs durante SSR.
  // Excluirlos del bundle del servidor evita el error de módulo no encontrado.
  serverExternalPackages: ['jspdf', 'xlsx', 'fflate'],
  // El panel de pendientes (P-37) LEE `PENDIENTES.md` del repo — no hay copia en BD, porque la
  // fuente única es el .md. Next no incluye archivos que no importa nadie, así que hay que
  // pedirlo explícito o el endpoint anda en local y tira 500 en Vercel.
  outputFileTracingIncludes: {
    '/api/pendientes': ['./PENDIENTES.md'],
  },
  turbopack: {},
}

export default nextConfig
