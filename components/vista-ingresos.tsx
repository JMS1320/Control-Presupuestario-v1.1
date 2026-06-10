"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, Receipt, FileText, BookOpen, Building2 } from "lucide-react"
import { VistaVentasMsa } from "./vista-ventas-msa"
import { VistaLiquidacionesMsa } from "./vista-liquidaciones-msa"
import { VistaSubdiariosVenta } from "./vista-subdiarios-venta"

export function VistaIngresos({ userRole = 'admin' }: { userRole?: 'admin' | 'contable' }) {
  const [tabActiva, setTabActiva] = useState("ventas-msa")

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Ingresos</h1>
        <p className="text-muted-foreground">
          Ventas y liquidaciones — IVA Ventas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Gestión de Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tabActiva} onValueChange={setTabActiva}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="ventas-msa" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Ventas MSA
              </TabsTrigger>
              <TabsTrigger value="liquidaciones-msa" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Liquidaciones MSA
              </TabsTrigger>
              <TabsTrigger value="subdiarios-msa" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Subdiarios MSA
              </TabsTrigger>
              <TabsTrigger value="subdiarios-ma" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Subdiarios MA
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="ventas-msa" className="space-y-4">
                <VistaVentasMsa userRole={userRole} />
              </TabsContent>

              <TabsContent value="liquidaciones-msa" className="space-y-4">
                <VistaLiquidacionesMsa userRole={userRole} />
              </TabsContent>

              <TabsContent value="subdiarios-msa" className="space-y-4">
                <VistaSubdiariosVenta empresa="MSA" userRole={userRole} />
              </TabsContent>

              <TabsContent value="subdiarios-ma" className="space-y-4">
                <VistaSubdiariosVenta empresa="MA" userRole={userRole} />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
