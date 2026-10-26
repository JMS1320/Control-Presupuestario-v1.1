"use client"

/**
 * 🧠 **Pestañas que no se recargan al volver** (A-FEAT-1378, paso 1).
 *
 * `TabsVivos` reemplaza a `Tabs` (controlado: con `value`) y `TabsContentVivo` a `TabsContent`. La pestaña
 * que se deja queda **montada y escondida** (CSS), así al volver está como la dejaste, sin bajar todo de
 * nuevo. Sólo quedan vivas las últimas `maxVivas` visitadas (ver `lib/ui/pestanas-vivas.ts`): las demás se
 * desmontan como antes, por memoria. Lo nunca visitado no se monta.
 *
 * ⚠️ Lo escondido sigue montado: un atajo de teclado global de una pantalla escondida seguiría escuchando.
 * Los que hay hoy ya se cuidan (el Alt+P del Cash Flow mira que su botón se vea). Y quien lea «en qué
 * pantalla está el usuario» del DOM tiene que ignorar los paneles inactivos (`lib/contexto-pantalla.ts`).
 */
import * as React from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { actualizarVivas, debeMontarse } from "@/lib/ui/pestanas-vivas"

const Contexto = React.createContext<{ activa?: string; vivas: string[] }>({ vivas: [] })

export function TabsVivos({ maxVivas = 4, ...props }: React.ComponentPropsWithoutRef<typeof Tabs> & { maxVivas?: number }) {
  const activa = props.value
  const [vivas, setVivas] = React.useState<string[]>(() => actualizarVivas([], activa, maxVivas))
  React.useEffect(() => { setVivas(prev => actualizarVivas(prev, activa, maxVivas)) }, [activa, maxVivas])
  const ctx = React.useMemo(() => ({ activa, vivas }), [activa, vivas])
  return (
    <Contexto.Provider value={ctx}>
      <Tabs {...props} />
    </Contexto.Provider>
  )
}

export function TabsContentVivo({ value, className, ...props }: React.ComponentPropsWithoutRef<typeof TabsContent>) {
  const { activa, vivas } = React.useContext(Contexto)
  if (!debeMontarse(value, activa, vivas)) return null
  return <TabsContent value={value} forceMount className={cn(className, "data-[state=inactive]:hidden")} {...props} />
}
