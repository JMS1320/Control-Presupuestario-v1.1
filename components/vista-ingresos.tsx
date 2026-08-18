"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, Receipt, FileText, BookOpen, Landmark, Wheat, Beef } from "lucide-react"
import { VistaVentasMsa } from "./vista-ventas-msa"
import { VistaLiquidacionesMsa } from "./vista-liquidaciones-msa"
import { VistaSubdiariosVenta } from "./vista-subdiarios-venta"
import { VistaCobrosVenta } from "./vista-cobros-venta"
import { VistaArrendamientos } from "./vista-arrendamientos"
import { VistaGanaderia } from "./vista-ganaderia"
import { EMPRESAS, COLOR_EMPRESA, type Empresa } from "@/lib/empresas"

// ════════════════════════════════════════════════════════════════════════════
// Ingresos, en 2 niveles: EMPRESA → vista. (Antes eran 8 solapas planas con la
// empresa metida en el nombre: "Ventas MSA", "Subdiarios MA"… — con 3 empresas
// × 5 vistas eso escalaba a 15 solapas.)
//
// No todas las vistas aplican a las 3 empresas, y no por falta de ganas:
//   · Ventas (granos) y Ganadería → SOLO MSA (decisión del usuario).
//   · Cobros → SOLO MSA por un dato que no existe: `comprobante_venta_id` está
//     únicamente en `public.msa_galicia`. Los extractos de PAM (`pam_galicia`,
//     `pam_galicia_cc`) y MA (`ma.ma_galicia`) NO tienen esa columna, así que
//     ahí un cobro no se puede vincular a una factura. Mostrar la solapa diría
//     "cobrado $0" en todas las facturas, que miente peor que no estar.
//     → PENDIENTES § A-FEAT-24.
// ════════════════════════════════════════════════════════════════════════════

type Vista = 'arrendamientos' | 'ventas' | 'comprobantes' | 'cobros' | 'subdiarios' | 'ganaderia'

const VISTAS: { id: Vista; label: string; icono: typeof Wheat; soloMsa?: boolean }[] = [
  { id: 'arrendamientos', label: 'Arrendamientos', icono: Wheat },
  { id: 'ventas',         label: 'Ventas',         icono: Receipt,  soloMsa: true },
  { id: 'comprobantes',   label: 'Comprobantes',   icono: FileText },
  { id: 'cobros',         label: 'Cobros',         icono: Landmark, soloMsa: true },
  { id: 'subdiarios',     label: 'Subdiarios',     icono: BookOpen },
  { id: 'ganaderia',      label: 'Ganadería',      icono: Beef,     soloMsa: true },
]

const vistasDe = (empresa: Empresa) =>
  VISTAS.filter(v => empresa === 'MSA' || !v.soloMsa)

export function VistaIngresos({ userRole = 'admin' }: { userRole?: 'admin' | 'contable' }) {
  const [empresa, setEmpresa] = useState<Empresa>('MSA')
  const [vista, setVista] = useState<Vista>('arrendamientos')

  // Al cambiar de empresa, si la vista actual no existe ahí, se cae a la primera disponible
  const cambiarEmpresa = (valor: string) => {
    const nueva = valor as Empresa
    setEmpresa(nueva)
    if (!vistasDe(nueva).some(v => v.id === vista)) setVista('arrendamientos')
  }

  const disponibles = vistasDe(empresa)

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
        <CardContent className="space-y-4">

          {/* ── Nivel 1: empresa ────────────────────────────────────────── */}
          <Tabs value={empresa} onValueChange={cambiarEmpresa}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              {EMPRESAS.map(e => (
                <TabsTrigger key={e} value={e} className="font-semibold">
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${COLOR_EMPRESA[e].split(' ')[0]}`} />
                  {e}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* ── Nivel 2: vista dentro de la empresa ─────────────────────── */}
          <Tabs value={vista} onValueChange={v => setVista(v as Vista)}>
            <TabsList
              className="grid w-full"
              style={{ gridTemplateColumns: `repeat(${disponibles.length}, minmax(0, 1fr))` }}
            >
              {disponibles.map(v => (
                <TabsTrigger key={v.id} value={v.id} className="flex items-center gap-2">
                  <v.icono className="h-4 w-4" />
                  {v.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-6">
              <TabsContent value="arrendamientos" className="space-y-4">
                <VistaArrendamientos empresa={empresa} />
              </TabsContent>

              <TabsContent value="comprobantes" className="space-y-4">
                <VistaLiquidacionesMsa userRole={userRole} empresa={empresa} />
              </TabsContent>

              <TabsContent value="subdiarios" className="space-y-4">
                <VistaSubdiariosVenta empresa={empresa} userRole={userRole} />
              </TabsContent>

              {/* Sólo MSA — ver el comentario del encabezado */}
              {empresa === 'MSA' && (
                <>
                  <TabsContent value="ventas" className="space-y-4">
                    <VistaVentasMsa userRole={userRole} />
                  </TabsContent>

                  <TabsContent value="cobros" className="space-y-4">
                    <VistaCobrosVenta />
                  </TabsContent>

                  <TabsContent value="ganaderia" className="space-y-4">
                    <VistaGanaderia />
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
