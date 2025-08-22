"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RefreshCw, AlertTriangle, Calendar, DollarSign, User } from "lucide-react"
import { useAlertasTemplates } from "@/hooks/useAlertasTemplates"

interface AlertasTemplatesProps {
  mostrarSoloUrgentes?: boolean
  limite?: number
}

export function AlertasTemplates({ mostrarSoloUrgentes = false, limite }: AlertasTemplatesProps) {
  const {
    alertas,
    loading,
    error,
    cargarAlertas,
    getAlertasCriticas,
    getColorAlerta,
    getIconoAlerta,
    formatearFecha,
    formatearMonto
  } = useAlertasTemplates()

  const alertasAMostrar = mostrarSoloUrgentes ? getAlertasCriticas() : alertas
  const alertasLimitadas = limite ? alertasAMostrar.slice(0, limite) : alertasAMostrar

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error cargando alertas: {error}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            🚨 Alertas Templates
            {alertasLimitadas.length > 0 && (
              <Badge variant="destructive">{alertasLimitadas.length}</Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={cargarAlertas}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Cargando alertas...</span>
          </div>
        ) : alertasLimitadas.length === 0 ? (
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              {mostrarSoloUrgentes 
                ? "🎉 No hay pagos urgentes (≤7 días)"
                : "📅 No hay alertas de templates en los próximos 30 días"
              }
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {alertasLimitadas.map((alerta) => (
                <div
                  key={alerta.id}
                  className={`p-3 rounded-lg border-l-4 ${getColorAlerta(alerta.tipoAlerta)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getIconoAlerta(alerta.tipoAlerta)}</span>
                        <h4 className="font-semibold text-sm">
                          {alerta.nombreTemplate}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {alerta.diasRestantes === 0 
                            ? 'HOY' 
                            : alerta.diasRestantes === 1 
                              ? 'MAÑANA'
                              : `${alerta.diasRestantes} días`
                          }
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatearFecha(alerta.fechaVencimiento)}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatearMonto(alerta.monto)}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {alerta.responsable}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        {limite && alertasAMostrar.length > limite && (
          <div className="mt-4 text-center">
            <Badge variant="secondary">
              +{alertasAMostrar.length - limite} alertas más
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}