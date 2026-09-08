import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

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
          🔴 **Sin esto, TODA la app avisa al vacío.**
          Hay 445 llamadas a `toast()` —280 de ellas `toast.error`— y el `Toaster` no estaba montado
          en ninguna parte, así que ninguna se veía nunca. El usuario apretó «Ver qué hay» en las
          boletas de ARBA, algo falló, la pantalla no dijo nada y quedó esperando (2026-09-08).

          Es el modo de falla más caro que tiene esta app: **el silencio miente**. Un error que no se
          muestra no se distingue de que no haya pasado nada, y manda a buscar el problema donde no
          está — acá, en el GAS que todavía no se había desplegado.

          `duration` largo y `closeButton` a propósito: varios de esos errores traen el texto que
          explica qué hacer (la respuesta del GAS, el nombre de la columna que falta), y 4 segundos
          no alcanzan para leerlo.
        */}
        <Toaster richColors closeButton duration={8000} position="bottom-right" />
      </body>
    </html>
  )
}
