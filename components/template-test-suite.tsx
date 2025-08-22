"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, AlertTriangle, PlayCircle, Loader2 } from "lucide-react"
import { useTemplateValidator } from "@/hooks/useTemplateValidator"

interface TemplateTestSuiteProps {
  templateId: string
  templateName: string
}

export function TemplateTestSuite({ templateId, templateName }: TemplateTestSuiteProps) {
  const { testing, results, runFullTestSuite } = useTemplateValidator()
  const [showDetails, setShowDetails] = useState(false)

  const currentResult = results.find(r => r.templateId === templateId)

  const handleRunTests = async () => {
    await runFullTestSuite(templateId, templateName)
  }

  const getStatusIcon = (valid: boolean, severity: string) => {
    if (valid) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (severity === 'error') return <XCircle className="h-4 w-4 text-red-600" />
    if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    return <CheckCircle className="h-4 w-4 text-blue-600" />
  }

  const getStatusColor = (valid: boolean, severity: string) => {
    if (valid) return 'bg-green-100 text-green-800'
    if (severity === 'error') return 'bg-red-100 text-red-800'
    if (severity === 'warning') return 'bg-yellow-100 text-yellow-800'
    return 'bg-blue-100 text-blue-800'
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            🧪 Test Suite: {templateName}
          </CardTitle>
          <Button 
            onClick={handleRunTests} 
            disabled={testing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Ejecutar Tests
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {currentResult && (
          <>
            {/* Resumen de resultados */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-green-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold text-green-600">{currentResult.passed}</p>
                      <p className="text-sm text-gray-600">Tests Pasados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">{currentResult.failed}</p>
                      <p className="text-sm text-gray-600">Tests Fallados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="text-2xl font-bold text-yellow-600">{currentResult.warnings}</p>
                      <p className="text-sm text-gray-600">Advertencias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso Tests</span>
                <span>{currentResult.passed} / {currentResult.results.length}</span>
              </div>
              <Progress 
                value={(currentResult.passed / currentResult.results.length) * 100} 
                className="w-full"
              />
            </div>

            {/* Estado general */}
            <Alert className={currentResult.failed > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
              <AlertDescription>
                {currentResult.failed > 0 ? (
                  <>❌ <strong>Template tiene problemas</strong> - {currentResult.failed} errores encontrados</>
                ) : (
                  <>✅ <strong>Template funcionando correctamente</strong> - Todos los tests pasaron</>
                )}
              </AlertDescription>
            </Alert>

            {/* Botón detalles */}
            <Button 
              variant="outline" 
              onClick={() => setShowDetails(!showDetails)}
              className="w-full"
            >
              {showDetails ? 'Ocultar Detalles' : 'Ver Detalles'}
            </Button>

            {/* Detalles de tests */}
            {showDetails && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold">Resultados Detallados:</h4>
                {currentResult.results.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.valid, result.severity)}
                      <div>
                        <p className="font-medium">{result.field}</p>
                        <p className="text-sm text-gray-600">{result.message}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(result.valid, result.severity)}>
                      {result.valid ? 'PASS' : result.severity.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!currentResult && !testing && (
          <Alert>
            <AlertDescription>
              Haz clic en "Ejecutar Tests" para validar la funcionalidad completa del template.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}