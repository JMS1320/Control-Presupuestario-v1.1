"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ControlPresupuestario() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Control Presupuestario</h1>
          <p className="text-gray-600 mt-2">Sistema de gestión y control de presupuestos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Presupuesto Total</CardTitle>
              <CardDescription>Resumen general del presupuesto</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">$0.00</div>
              <p className="text-sm text-gray-500">Disponible</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gastos del Mes</CardTitle>
              <CardDescription>Gastos acumulados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">$0.00</div>
              <p className="text-sm text-gray-500">Gastado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
              <CardDescription>Gestión del presupuesto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full">Nuevo Gasto</Button>
              <Button variant="outline" className="w-full bg-transparent">
                Ver Reportes
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Estado del Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">
                  ✅ Estructura básica recreada - Lista para recibir tus archivos completos
                </p>
                <p className="text-sm text-blue-600 mt-2">
                  Puedes hacer deploy de esta versión y luego subir todos tus archivos a GitHub
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
