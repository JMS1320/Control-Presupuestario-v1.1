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
import { supabase } from "@/lib/supabase"
import { leerPreferencias } from "@/lib/auth/preferencias"

/**
 * ⚙️ Preferencia del usuario «Mantener abiertas las pantallas» (Tu perfil). APAGADA por defecto: así cada
 * pestaña se comporta como siempre (se desmonta y al volver carga de nuevo, con datos frescos). Se lee una
 * vez por carga de la página; un cambio en el perfil vale desde la próxima vez que se abre la app.
 */
let prefVivas: Promise<boolean> | null = null
function leerPrefVivas(): Promise<boolean> {
  if (!prefVivas) prefVivas = supabase.auth.getUser()
    .then(({ data }) => leerPreferencias(data.user).pantallasVivas)
    .catch(() => false)
  return prefVivas
}

const Contexto = React.createContext<{ activa?: string; vivas: string[] }>({ vivas: [] })

export function TabsVivos({ maxVivas = 4, ...props }: React.ComponentPropsWithoutRef<typeof Tabs> & { maxVivas?: number }) {
  const activa = props.value
  const [habilitado, setHabilitado] = React.useState(false)
  React.useEffect(() => { leerPrefVivas().then(setHabilitado) }, [])
  // Apagada la preferencia: sólo la activa (= el comportamiento de siempre).
  const tope = habilitado ? maxVivas : 1
  const [vivas, setVivas] = React.useState<string[]>(() => actualizarVivas([], activa, 1))
  React.useEffect(() => { setVivas(prev => actualizarVivas(prev, activa, tope)) }, [activa, tope])
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
