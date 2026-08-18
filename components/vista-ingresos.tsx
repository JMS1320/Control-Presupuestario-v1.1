"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, Receipt, FileText, BookOpen, Building2, Landmark, Wheat, Beef } from "lucide-react"
import { VistaVentasMsa } from "./vista-ventas-msa"
import { VistaLiquidacionesMsa } from "./vista-liquidaciones-msa"
import { VistaSubdiariosVenta } from "./vista-subdiarios-venta"
import { VistaCobrosVenta } from "./vista-cobros-venta"
import { VistaArrendamientos } from "./vista-arrendamientos"
import { VistaGanaderia } from "./vista-ganaderia"

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
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="arrendamientos" className="flex items-center gap-2">
                <Wheat className="h-4 w-4" />
                Arrendamiento
              </TabsTrigger>
              <TabsTrigger value="ganaderia" className="flex items-center gap-2">
                <Beef className="h-4 w-4" />
                Ganadería
              </TabsTrigger>
              <TabsTrigger value="ventas-msa" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Ventas MSA
              </TabsTrigger>
              <TabsTrigger value="liquidaciones-msa" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Comprobantes MSA
              </TabsTrigger>
              <TabsTrigger value="cobros-msa" className="flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                Cobros MSA
              </TabsTrigger>
              <TabsTrigger value="subdiarios-msa" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Subdiarios MSA
              </TabsTrigger>
              <TabsTrigger value="subdiarios-pam" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Subdiarios PAM
              </TabsTrigger>
              <TabsTrigger value="subdiarios-ma" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Subdiarios MA
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="arrendamientos" className="space-y-4">
                <VistaArrendamientos />
              </TabsContent>

              <TabsContent value="ganaderia" className="space-y-4">
                <VistaGanaderia />
              </TabsContent>

              <TabsContent value="ventas-msa" className="space-y-4">
                <VistaVentasMsa userRole={userRole} />
              </TabsContent>

              <TabsContent value="liquidaciones-msa" className="space-y-4">
                <VistaLiquidacionesMsa userRole={userRole} />
              </TabsContent>

              <TabsContent value="cobros-msa" className="space-y-4">
                <VistaCobrosVenta />
              </TabsContent>

              <TabsContent value="subdiarios-msa" className="space-y-4">
                <VistaSubdiariosVenta empresa="MSA" userRole={userRole} />
              </TabsContent>

              <TabsContent value="subdiarios-pam" className="space-y-4">
                <VistaSubdiariosVenta empresa="PAM" userRole={userRole} />
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
