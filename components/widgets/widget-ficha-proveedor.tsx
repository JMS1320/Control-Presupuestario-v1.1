"use client"

import { useState } from "react"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ModalFichaProveedor } from "@/components/proveedores/modal-ficha-proveedor"

/**
 * FICHA DE PROVEEDOR — acceso rápido (A-FEAT-88).
 *
 * No es un widget de datos: es una **puerta**, y existe porque el botón vivía en la barra fija de
 * `vista-principal`. Al volver configurable la pantalla, esa barra desaparece — y un acceso que
 * sólo estaba ahí se habría perdido en silencio con el refactor, que es la forma más común de
 * romper algo mientras se «mejora» otra cosa.
 *
 * Se puede quitar del inicio como cualquier otro; la ficha sigue abriéndose desde los demás
 * contextos que ya la usan con `cuitInicial`.
 */
export function WidgetFichaProveedor() {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-medium">Ficha de proveedor</p>
            <p className="text-xs text-muted-foreground">
              Buscar un proveedor y ver su cuenta corriente, CBU y comprobantes.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="gap-2" onClick={() => setAbierto(true)}>
            <Building2 className="h-4 w-4" />
            Abrir
          </Button>
        </CardContent>
      </Card>

      <ModalFichaProveedor open={abierto} onClose={() => setAbierto(false)} />
    </>
  )
}
