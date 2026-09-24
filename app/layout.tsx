import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es-AR">
      <body>
        {children}
        {/*
          ⚠️ **Acá NO va un `<Toaster />`.** Ya hay uno en `dashboard.tsx`, montado a nivel app y
          fuera de las pestañas.

          🐞 El 2026-09-08 puse uno acá porque busqué «Toaster» sólo en `app/` y `components/` —
          **`dashboard.tsx` está en la raíz del repo y quedó afuera de la búsqueda**— y concluí que
          no existía ninguno. Resultado: durante un día **cada aviso salió dos veces**.

          🔑 La lección, que es la que vale: *buscar en algunos lados y no encontrar algo no es lo
          mismo que que no exista*. Es el mismo error que cometí con `egresos_sin_factura.responsable`
          — mirar una columna, no verlo, y declarar que el dato no estaba.
        */}
      </body>
    </html>
  )
}
