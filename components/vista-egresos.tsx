"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Receipt, FileText } from "lucide-react"
import { VistaFacturasArca } from "./vista-facturas-arca"
import { VistaTemplatesEgresos } from "./vista-templates-egresos"

export function VistaEgresos() {
  const [tabActiva, setTabActiva] = useState("facturas")

  return (
    <div className="space-y-6">
      {/* Header principal */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Egresos</h1>
        <p className="text-muted-foreground">
          Gestión completa de egresos: facturas ARCA y compromisos sin factura
        </p>
      </div>

      {/* Tabs para alternar entre facturas y templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gestión de Egresos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tabActiva} onValueChange={setTabActiva}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="facturas" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Facturas ARCA
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Egresos sin Factura
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="facturas" className="space-y-4">
                <VistaFacturasArca />
              </TabsContent>

              <TabsContent value="templates" className="space-y-4">
                <VistaTemplatesEgresos />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}