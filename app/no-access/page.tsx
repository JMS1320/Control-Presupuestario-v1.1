import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export default function NoAccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-xl text-red-600">Acceso Denegado</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            La URL que has intentado acceder no es válida o ha sido revocada.
          </p>
          <p className="text-sm text-gray-500">
            Si crees que esto es un error, contacta al administrador del sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}