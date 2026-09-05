"use client"

import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { BarraSesion } from "@/components/barra-sesion"
import { Toaster } from "@/components/ui/sonner"
import { usePendientesPorPantalla } from "@/hooks/usePendientesPorPantalla"
import {
  Menu, Home, BarChart3, Users, FileText, Receipt, ArrowUpRight,
  TrendingUp, Banknote, Tractor, Landmark, PieChart, Upload,
} from "lucide-react"

/**
 * Las 12 secciones, en un solo lugar.
 *
 * El `id` es el mismo `value` de la solapa en `dashboard.tsx` y la misma clave con la que
 * `usePendientesPorPantalla` cuenta los pendientes — no inventar nombres nuevos acá.
 */
export const SOLAPAS = [
  { id: "principal",    label: "Principal",           Icono: Home },
  { id: "dashboard",    label: "Dashboard",           Icono: BarChart3 },
  { id: "distribucion", label: "Distribución Socios", Icono: Users },
  { id: "reporte",      label: "Reporte Detallado",   Icono: FileText },
  { id: "egresos",      label: "Egresos",             Icono: Receipt },
  { id: "ingresos",     label: "Ingresos",            Icono: ArrowUpRight },
  { id: "cashflow",     label: "Cash Flow",           Icono: TrendingUp },
  { id: "extracto",     label: "Extracto Bancario",   Icono: Banknote },
  { id: "productivo",   label: "Productivo",          Icono: Tractor },
  { id: "sueldos",      label: "Sueldos",             Icono: Landmark },
  { id: "presupuesto",  label: "Presupuesto",         Icono: PieChart },
  { id: "importar",     label: "Importar Excel",      Icono: Upload },
] as const

export type IdSeccion = (typeof SOLAPAS)[number]["id"]

/** Qué secciones ve cada rol. El `contable` sólo trabaja Egresos. */
export function seccionesDe(userRole: "admin" | "contable") {
  return SOLAPAS.filter((s) => userRole === "admin" || s.id === "egresos")
}

/**
 * El botón que abre el menú.
 *
 * No se usa `SidebarTrigger` de shadcn porque trae `<PanelLeft/>` hardcodeado adentro y los
 * children en JSX no se pueden pisar desde props. Las tres líneas son el ícono que la gente
 * reconoce como "menú"; el de panel sugiere otra cosa.
 *
 * Componente aparte porque `useSidebar()` sólo funciona dentro del `SidebarProvider`.
 */
function BotonMenu({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar()
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-9 w-9 shrink-0 ${className ?? ""}`}
      onClick={toggleSidebar}
    >
      <Menu />
      <span className="sr-only">Abrir el menú</span>
    </Button>
  )
}

/**
 * El mismo botón, en el chrome del contenido: sólo aparece con el menú **cerrado**.
 *
 * Abierto, el ☰ quedaba flotando en el contenido, al lado de un menú con el que no tenía ninguna
 * relación visual. Un control se pone al lado de lo que afecta.
 *
 * ⚠️ El estado se lee distinto según el dispositivo: en mobile el menú es un panel aparte y su
 * apertura vive en `openMobile`, no en `open`.
 */
function BotonMenuChrome() {
  const { open, openMobile, isMobile } = useSidebar()
  return (isMobile ? openMobile : open) ? null : <BotonMenu />
}

function MenuLateral({
  userRole,
  activa,
  onElegir,
}: {
  userRole: "admin" | "contable"
  activa?: string
  onElegir: (id: string) => void
}) {
  const { setOpen, setOpenMobile, isMobile } = useSidebar()
  // Sólo admin: el endpoint lo exige y el contable no trabaja los pendientes de desarrollo.
  const pendientes = usePendientesPorPantalla(userRole === "admin")

  const elegir = (id: string) => {
    onElegir(id)
    // Se cierra al elegir: un menú que tapa el contenido y queda abierto estorba.
    if (isMobile) setOpenMobile(false)
    else setOpen(false)
  }

  return (
    <Sidebar collapsible="offcanvas">
      {/* Sólo el botón: el título decía «Control Presupuestario», que es el nombre de la app y no
          ayuda a elegir una sección — las de abajo se explican solas. */}
      {/* Sólo el botón: el título decía «Control Presupuestario», que es el nombre de la app y no
          ayuda a elegir una sección — las de abajo se explican solas.
          El `justify-start pl-2` NO es cosmético: sin eso el ícono queda centrado en un botón de
          36 px y cae a 18 px del borde, mientras los ítems caen a 8 — 10 px de desalineación que
          se ve. Con esto los dos quedan a 16. */}
      <SidebarHeader className="px-2 py-3">
        <BotonMenu className="justify-start pl-2" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="px-2">
          {seccionesDe(userRole).map(({ id, label, Icono }) => {
            const c = pendientes[id]
            // Color proporcional a los urgentes, no binario, para que el rojo señale dónde está el
            // bulto de verdad y no se encienda en todas las secciones a la vez.
            const color = !c || c.total === 0 ? null
              : c.urgentes >= 5 ? "bg-red-100 text-red-700"
              : c.urgentes > 0 ? "bg-amber-100 text-amber-700"
              : "bg-gray-200 text-gray-600"
            return (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton isActive={activa === id} onClick={() => elegir(id)}>
                  <Icono className="h-4 w-4" />
                  <span>{label}</span>
                </SidebarMenuButton>
                {color && c && (
                  <SidebarMenuBadge
                    data-nota-ignorar
                    title={`${c.total} pendiente(s)${c.urgentes ? ` · ${c.urgentes} urgente(s)` : ""} — se ven en Principal → Pendientes`}
                    className={`rounded-full ${color}`}
                  >
                    {c.total}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}

/**
 * El marco de la app: menú lateral + barra superior con el avatar.
 *
 * Existe porque antes esto vivía **adentro de `dashboard.tsx`**, así que `/usuarios` —y cualquier
 * ruta nueva— quedaban sin menú y sin sesión, como islas desde las que sólo se salía con un link
 * «← Volver al sistema».
 *
 * Dos modos, según quién maneja la navegación:
 * - **Con `onElegirSeccion`** (la pantalla principal): elegir una sección cambia la solapa en el
 *   lugar, sin recargar.
 * - **Sin `onElegirSeccion`** (`/usuarios`, `/perfil`): elegir navega a `/?seccion=<id>`. Por eso
 *   la sección viaja en la URL — es lo que hace que el menú funcione desde cualquier ruta.
 */
export function LayoutApp({
  userRole,
  seccionActiva,
  onElegirSeccion,
  children,
}: {
  userRole: "admin" | "contable"
  seccionActiva?: string
  onElegirSeccion?: (id: string) => void
  children: React.ReactNode
}) {
  const router = useRouter()
  const elegir = onElegirSeccion ?? ((id: string) => router.push(`/?seccion=${id}`))

  return (
    <SidebarProvider defaultOpen={false}>
      <MenuLateral userRole={userRole} activa={seccionActiva} onElegir={elegir} />
      <SidebarInset className="bg-gray-50">
        {/* A nivel marco: los toasts sobreviven el cambio de sección y existen en todas las
            rutas, no sólo en la principal. */}
        <Toaster richColors closeButton position="top-right" />
        {/* Chrome fijo y translúcido: el menú y la sesión tienen que seguir a mano después de
            scrollear media pantalla de tabla. El contenido pasa por debajo. */}
        <div className="chrome-superior">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
            <BotonMenuChrome />
            <div className="min-w-0 flex-1">
              <BarraSesion userRole={userRole} />
            </div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-10 pt-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
