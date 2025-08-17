"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Banknote, 
  Settings, 
  Play, 
  FileSpreadsheet, 
  Upload, 
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock
} from "lucide-react"
import { ConfiguradorReglas } from "./configurador-reglas"
import { useMotorConciliacion, CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"

export function VistaExtractoBancario() {
  const [configuradorAbierto, setConfiguradorAbierto] = useState(false)
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("")
  const [selectorAbierto, setSelectorAbierto] = useState(false)

  const { procesoEnCurso, error, resultados, ejecutarConciliacion, cuentasDisponibles } = useMotorConciliacion()

  // Iniciar proceso de conciliación
  const iniciarConciliacion = () => {
    if (!cuentaSeleccionada) {
      setSelectorAbierto(true)
      return
    }
    
    const cuenta = cuentasDisponibles.find(c => c.id === cuentaSeleccionada)
    if (cuenta) {
      ejecutarConciliacion(cuenta)
    }
  }

  // Ejecutar conciliación con cuenta seleccionada
  const ejecutarConCuenta = async (cuentaId: string) => {
    const cuenta = cuentasDisponibles.find(c => c.id === cuentaId)
    if (!cuenta) return
    
    setCuentaSeleccionada(cuentaId)
    setSelectorAbierto(false)
    
    try {
      await ejecutarConciliacion(cuenta)
    } catch (error) {
      console.error('Error en conciliación:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6" />
            Extracto Bancario
            {cuentaSeleccionada && (
              <Badge variant="outline" className="ml-2">
                {cuentasDisponibles.find(c => c.id === cuentaSeleccionada)?.nombre}
              </Badge>
            )}
          </h2>
          <p className="text-gray-600">Conciliación automática de movimientos bancarios</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setConfiguradorAbierto(true)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Configuración
          </Button>
          
          <Button 
            onClick={iniciarConciliacion}
            disabled={procesoEnCurso}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            {procesoEnCurso ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Conciliación Bancaria
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Estado del Proceso */}
      {procesoEnCurso && (
        <Alert>
          <RotateCcw className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Procesando conciliación bancaria automática...
          </AlertDescription>
        </Alert>
      )}

      {/* Error del Proceso */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Error en conciliación: {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Resultados del Proceso */}
      {resultados && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Conciliación Completada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {resultados.automaticos}
                </div>
                <div className="text-sm text-gray-600">Automáticos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {resultados.revision_manual}
                </div>
                <div className="text-sm text-gray-600">Revisión Manual</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {resultados.sin_match}
                </div>
                <div className="text-sm text-gray-600">Sin Match</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {resultados.total_movimientos}
                </div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs del contenido */}
      <Tabs defaultValue="movimientos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="movimientos" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Movimientos
          </TabsTrigger>
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </TabsTrigger>
          <TabsTrigger value="reportes" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movimientos" className="space-y-4">
          {/* Estadísticas */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">156</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  Total Movimientos
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">124</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Conciliados
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">18</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Pendientes
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">14</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Sin Match
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Movimientos (simulada) */}
          <Card>
            <CardHeader>
              <CardTitle>Movimientos Bancarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">No hay datos de extracto bancario</p>
                <p className="text-sm">
                  Importa un extracto bancario para visualizar los movimientos y ejecutar la conciliación automática.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar Extracto Bancario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">Importador de Extractos</p>
                <p className="text-sm mb-4">
                  Arrastra y suelta tu archivo CSV del extracto bancario MSA Galicia
                </p>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar Archivo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reportes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reportes de Conciliación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">Reportes y Análisis</p>
                <p className="text-sm">
                  Genera reportes detallados del proceso de conciliación y análisis de movimientos.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Configurador */}
      <Dialog open={configuradorAbierto} onOpenChange={setConfiguradorAbierto}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuración de Reglas de Conciliación</DialogTitle>
          </DialogHeader>
          <ConfiguradorReglas />
        </DialogContent>
      </Dialog>

      {/* Modal Selector de Cuenta */}
      <Dialog open={selectorAbierto} onOpenChange={setSelectorAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Cuenta Bancaria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Selecciona la cuenta bancaria que deseas conciliar:
            </p>
            <div className="space-y-2">
              {cuentasDisponibles.map((cuenta) => (
                <Button
                  key={cuenta.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => ejecutarConCuenta(cuenta.id)}
                >
                  <div className="flex items-center gap-3">
                    <Banknote className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">{cuenta.nombre}</div>
                      <div className="text-sm text-gray-500">{cuenta.empresa}</div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}