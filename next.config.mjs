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
  turbopack: {},
}

export default nextConfig
