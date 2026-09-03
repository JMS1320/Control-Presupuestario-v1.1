"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"

/**
 * Barra fina de sesión: quién sos, tu rol, y por dónde salir.
 *
 * El logout es un `<form method="post">` y no un link, a propósito: si fuera GET, cualquier
 * `<img src="/auth/signout">` incrustada en una página te desloguearía (CSRF de logout).
 */
export function BarraSesion({ userRole }: { userRole: "admin" | "contable" }) {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  return (
    <div className="mb-4 flex items-center justify-end gap-3 text-sm">
      <span className="text-muted-foreground">
        {email ?? "…"} · <span className="font-medium">{userRole}</span>
      </span>

      {userRole === "admin" && (
        <Link href="/usuarios" className="underline underline-offset-4">
          Usuarios
        </Link>
      )}

      <form action="/auth/signout" method="post">
        <Button type="submit" variant="outline" size="sm">Salir</Button>
      </form>
    </div>
  )
}
