"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { seccionesPorIds } from "@/components/layout-app"
import { SelectorImagenPerfil } from "@/components/selector-imagen-perfil"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PREFERENCIAS_DEFAULT, leerPreferencias, type Preferencias } from "@/lib/auth/preferencias"
import { AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react"

function iniciales(nombre: string, email: string): string {
  const limpio = nombre.trim()
  if (limpio) {
    const partes = limpio.split(/\s+/).filter(Boolean)
    if (partes.length >= 2) return (partes[0]![0]! + partes[1]![0]!).toUpperCase()
    if (partes[0]) return partes[0].slice(0, 2).toUpperCase()
  }
  const local = email.split("@")[0]
  return local ? local.slice(0, 2).toUpperCase() : "?"
}

/** El valor del `<Select>` cuando no se eligió sección: no puede ser `""` (Radix lo prohíbe). */
const AUTOMATICA = "__auto__"

/**
 * Tu perfil: lo que se puede cambiar de tu propia cuenta.
 *
 * Se escribe en `user_metadata` con `auth.updateUser()`, que sólo puede tocar **tu** usuario —
 * no hace falta ningún endpoint de admin.
 *
 * ⚠️ Por eso mismo `user_metadata` **no sirve para permisos**: si el propio usuario lo puede
 * editar, el rol tiene que vivir en `app_metadata` (ver `MODULO_USUARIOS.md`). Acá van nombre,
 * foto y preferencias, que son cosméticos, y el rol se muestra como dato de sólo lectura. La
 * sección de inicio elegida se valida igual contra las permitidas — elegirla no da acceso a nada
 * (ver `lib/auth/preferencias.ts`).
 */
export function PanelPerfil({
  userRole,
  secciones,
}: {
  userRole: "admin" | "contable"
  /** Ids de las secciones que ve este usuario: las opciones de «sección de inicio». */
  secciones: string[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [nombre, setNombre] = useState("")
  const [foto, setFoto] = useState("")
  const [prefs, setPrefs] = useState<Preferencias>(PREFERENCIAS_DEFAULT)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [tiene2FA, setTiene2FA] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const u = data.user
      if (cancelado) return
      setEmail(u?.email ?? "")
      setNombre((u?.user_metadata?.full_name as string) ?? "")
      setFoto((u?.user_metadata?.avatar_url as string) ?? "")
      // La misma lectura tolerante que usa el servidor: una sola definición de qué es un default.
      setPrefs(leerPreferencias(u))
      setCargando(false)

      const { data: factores } = await supabase.auth.mfa.listFactors()
      if (!cancelado) setTiene2FA((factores?.totp?.length ?? 0) > 0)
    })()
    return () => { cancelado = true }
  }, [])

  /**
   * Guarda la foto apenas se elige.
   *
   * No espera al botón de abajo a propósito: la imagen ya se subió al Storage, a una ruta fija que
   * se sobrescribe, así que **la foto ya cambió** aunque no se apriete nada. Dejar el perfil
   * apuntando a la anterior sería guardar una mentira. El detalle largo, en `SelectorImagenPerfil`.
   */
  async function cambiarFoto(url: string) {
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: url || null } })
    if (error) {
      toast.error("Se cargó la imagen pero no se pudo guardar en tu perfil.")
      return
    }
    setFoto(url)
    toast.success(url ? "Foto actualizada." : "Foto quitada.")
    // La barra de arriba lee los datos al montarse: sin esto sigue mostrando la foto vieja.
    setTimeout(() => window.location.reload(), 600)
  }

  /**
   * Guarda una preferencia sola, en el momento.
   *
   * Sin botón «Guardar»: son interruptores, y un interruptor que hay que confirmar aparte se queda
   * sin confirmar. Se manda el objeto entero porque `updateUser` **reemplaza** la clave, no la
   * mergea — mandar sólo el campo tocado borraría los otros tres.
   */
  async function cambiarPref<K extends keyof Preferencias>(clave: K, valor: Preferencias[K]) {
    const anterior = prefs
    const nuevas = { ...prefs, [clave]: valor }
    setPrefs(nuevas) // optimista: el interruptor tiene que moverse cuando se lo toca
    const { error } = await supabase.auth.updateUser({ data: { preferencias: nuevas } })
    if (error) {
      setPrefs(anterior)
      toast.error("No se pudo guardar la preferencia.")
      return
    }
    // Las preferencias las lee el servidor en cada carga: sin refresh, el menú y la sección de
    // inicio siguen con los valores con los que se renderizó esta página.
    router.refresh()
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({
      data: { full_name: nombre.trim() || null },
    })
    setGuardando(false)
    if (error) {
      toast.error("No se pudo guardar.")
      return
    }
    toast.success("Perfil guardado.")
    setTimeout(() => window.location.reload(), 600)
  }

  if (cargando) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Cargando tu perfil…</CardContent></Card>
  }

  const opciones = seccionesPorIds(secciones)
  // El control de la preferencia: una sección elegida hace meses puede haber dejado de verse si
  // le cambiaron los permisos al rol. El `<Select>` se quedaría en blanco sin decir nada, y la app
  // abriría en otra sección sin que se entienda por qué. Se avisa y se muestra el valor real.
  const seccionHuerfana =
    prefs.seccionInicio !== null && !secciones.includes(prefs.seccionInicio)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card className="entrada-suave">
          <CardHeader><CardTitle className="text-base">Tus datos</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={guardar} className="space-y-5">
              <div className="space-y-2">
                <Label>Tu foto</Label>
                <SelectorImagenPerfil
                  valor={foto}
                  iniciales={iniciales(nombre, email)}
                  onCambio={cambiarFoto}
                />
                <p className="text-xs text-muted-foreground">
                  Así te ven. Sin foto se muestran tus iniciales. La foto se guarda sola, apenas la
                  elegís.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre y apellido"
                />
                <p className="text-xs text-muted-foreground">
                  Si lo cargás, las iniciales salen de acá en vez de tu mail.
                </p>
              </div>

              <Button type="submit" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar cambios"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="entrada-suave">
          <CardHeader>
            <CardTitle className="text-base">Cómo querés que te abra la app</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Son tuyas: valen para tu cuenta y en cualquier computadora donde entres. No cambian lo
              que ves, sólo cómo te lo acomoda.
            </p>

            <div className="space-y-2">
              <Label htmlFor="seccion-inicio">Sección al entrar</Label>
              <Select
                value={seccionHuerfana ? AUTOMATICA : prefs.seccionInicio ?? AUTOMATICA}
                onValueChange={(v) => cambiarPref("seccionInicio", v === AUTOMATICA ? null : v)}
              >
                <SelectTrigger id="seccion-inicio" className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTOMATICA}>La primera que tengo (automático)</SelectItem>
                  {opciones.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {seccionHuerfana ? (
                <p className="flex items-start gap-2 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Tenías elegida «{prefs.seccionInicio}», que ya no está entre las secciones que
                    ves. Mientras tanto la app te abre en la primera que tenés.
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Dónde caés al abrir la app. Sólo se ofrecen las secciones que ves; si más adelante
                  te sacan la que elegiste, vuelve sola al automático y te lo avisa acá.
                </p>
              )}
            </div>

            <InterruptorPref
              id="menu-abierto"
              titulo="Arrancar con el menú abierto"
              detalle="El menú lateral viene cerrado y se abre con el ☰. Si trabajás saltando entre secciones, conviene dejarlo abierto."
              valor={prefs.menuAbierto}
              onCambio={(v) => cambiarPref("menuAbierto", v)}
            />

            {userRole === "admin" && (
              <InterruptorPref
                id="contadores"
                titulo="Contadores de pendientes en el menú"
                detalle="Los globitos con la cantidad de pendientes de cada sección. Apagalos si preferís el menú limpio."
                valor={prefs.contadoresPendientes}
                onCambio={(v) => cambiarPref("contadoresPendientes", v)}
              />
            )}

            <InterruptorPref
              id="confirmar-salida"
              titulo="Preguntar antes de salir"
              detalle="«Salir» está en el mismo menú que «Tu perfil». Con esto pide confirmación antes de cerrar la sesión."
              valor={prefs.confirmarSalida}
              onCambio={(v) => cambiarPref("confirmarSalida", v)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="entrada-suave">
          <CardHeader><CardTitle className="text-base">Tu cuenta</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Mail</div>
              <div className="break-all font-medium">{email}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                No se cambia desde acá: es con lo que entrás.
              </p>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Rol</div>
              <div className="font-medium">{userRole}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Lo asigna un administrador. Nadie puede cambiarse el suyo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="entrada-suave">
          <CardHeader><CardTitle className="text-base">Segundo factor</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {tiene2FA === null ? (
              <span className="text-muted-foreground">Consultando…</span>
            ) : tiene2FA ? (
              <div className="flex items-start gap-2 text-emerald-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Activado. Te pide el código de 6 dígitos al entrar.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-amber-700">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Sin activar.
                    {userRole === "admin" && " Para una cuenta de administrador es obligatorio."}
                  </span>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/login/2fa/alta">Activar</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Una preferencia de sí/no, con su explicación. Todas se ven igual y se guardan solas. */
function InterruptorPref({
  id,
  titulo,
  detalle,
  valor,
  onCambio,
}: {
  id: string
  titulo: string
  detalle: string
  valor: boolean
  onCambio: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor={id} className="cursor-pointer">{titulo}</Label>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </div>
      <Switch id={id} checked={valor} onCheckedChange={onCambio} className="mt-1 shrink-0" />
    </div>
  )
}
