"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, User } from "lucide-react"

/**
 * Iniciales para el avatar cuando no hay foto.
 *
 * Prioriza el nombre si está cargado (dos palabras → dos iniciales) y si no cae al mail, que es
 * el único dato que siempre existe. `javiergc89@gmail.com` → «JA».
 */
function iniciales(nombre: string | null, email: string | null): string {
  const limpio = nombre?.trim()
  if (limpio) {
    const partes = limpio.split(/\s+/).filter(Boolean)
    if (partes.length >= 2) return (partes[0]![0]! + partes[1]![0]!).toUpperCase()
    if (partes[0]) return partes[0].slice(0, 2).toUpperCase()
  }
  const local = email?.split("@")[0]
  return local ? local.slice(0, 2).toUpperCase() : "?"
}

/**
 * Avatar de sesión con su menú: quién sos, tu rol, y por dónde salir.
 *
 * Antes era una línea de texto con el mail entero, el rol, un link «Usuarios» y un botón «Salir»
 * — cuatro elementos compitiendo en la esquina por algo que se mira una vez por día. Ahora es un
 * solo avatar y el resto vive en el menú.
 *
 * La foto sale de `user_metadata.avatar_url` si está cargada, y si no van las iniciales.
 * ⚠️ El **rol NO se lee de `user_metadata`** (el propio usuario puede editarlo): viene por prop,
 * desde la sesión validada en el servidor.
 *
 * El logout sigue siendo un `<form method="post">` y no un link, a propósito: si fuera GET,
 * cualquier `<img src="/auth/signout">` incrustada en una página te desloguearía (CSRF de logout).
 * Por eso el ítem del menú dispara el submit del form en vez de navegar.
 */
export function BarraSesion({ userRole }: { userRole: "admin" | "contable" }) {
  const [email, setEmail] = useState<string | null>(null)
  const [nombre, setNombre] = useState<string | null>(null)
  const [foto, setFoto] = useState<string | null>(null)
  const formSalir = useRef<HTMLFormElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      setEmail(u?.email ?? null)
      // Cosméticos, no de seguridad: acá `user_metadata` es el lugar correcto.
      setNombre((u?.user_metadata?.full_name as string) ?? (u?.user_metadata?.name as string) ?? null)
      setFoto((u?.user_metadata?.avatar_url as string) ?? null)
    })
  }, [])

  return (
    <div className="flex items-center justify-end">
      {/* Fuera del menú: si viviera adentro, se desmonta al cerrarse y el submit se pierde. */}
      <form ref={formSalir} action="/auth/signout" method="post" className="hidden" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-full ring-offset-background transition-[box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] motion-reduce:active:scale-100"
            aria-label="Tu cuenta"
          >
            <Avatar className="h-9 w-9">
              {foto && <AvatarImage src={foto} alt="" />}
              <AvatarFallback className="bg-slate-200 text-xs font-semibold text-slate-700">
                {iniciales(nombre, email)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            {/* El mail completo se mantiene: es lo que identifica con qué cuenta estás entrado
                cuando hay más de una. Antes ocupaba la barra; acá no le molesta a nadie. */}
            <div className="truncate text-sm font-medium">{nombre ?? email ?? "…"}</div>
            {nombre && <div className="truncate text-xs text-muted-foreground">{email}</div>}
            <div className="mt-1 text-xs text-muted-foreground">
              Rol: <span className="font-medium text-foreground">{userRole}</span>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/perfil" className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Tu perfil
            </Link>
          </DropdownMenuItem>

          {userRole === "admin" && (
            /* Antes era «Usuarios» a secas. Ahora Usuarios es una sección adentro de
               Configuración, junto con Roles y los datos de la aplicación: si cada cosa
               administrable entrara acá, este menú sería una lista larga de cosas que se tocan
               una vez cada tanto. */
            <DropdownMenuItem asChild>
              <Link href="/configuracion" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => formSalir.current?.requestSubmit()}
            className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
