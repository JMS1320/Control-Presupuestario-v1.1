import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw } from "lucide-react"

/** Aviso para quien está en pausa mientras se actualiza el sistema (ver `lib/auth/pausa.ts`). */
export default function ActualizandoPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <RefreshCw className="h-12 w-12 text-blue-500" />
          </div>
          <CardTitle className="text-xl text-blue-700">Estamos actualizando el sistema</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Mientras tanto la aplicación no está disponible para tu usuario. Probá de nuevo más tarde.
          </p>
          <p className="text-sm text-gray-500">Te avisamos cuando esté lista.</p>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm text-gray-500 underline hover:text-gray-700">
              Cerrar sesión
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
