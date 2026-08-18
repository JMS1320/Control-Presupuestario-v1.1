/** @type {import('next').NextConfig} */
const nextConfig = {
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
