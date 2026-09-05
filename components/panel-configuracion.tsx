"use client"

import { useState } from "react"
import { PanelUsuarios } from "@/components/panel-usuarios"
import { seccionesDe } from "@/components/layout-app"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DATOS_FISCALES, EMPRESAS, cuitFormateado } from "@/lib/empresas"
import { Users, ShieldCheck, Building2, KeyRound, Check, Minus } from "lucide-react"
import { useEffect } from "react"

const PANELES = [
  { id: "usuarios",   label: "Usuarios",   Icono: Users,       ayuda: "Cuentas, roles y acceso" },
  { id: "roles",      label: "Roles",      Icono: ShieldCheck, ayuda: "Qué es cada rol" },
  { id: "permisos",   label: "Permisos",   Icono: KeyRound,    ayuda: "Quién puede hacer qué" },
  { id: "aplicacion", label: "Aplicación", Icono: Building2,   ayuda: "Empresas y datos fiscales" },
] as const

export type IdPanel = (typeof PANELES)[number]["id"]
export const PANELES_IDS = new Set<string>(PANELES.map((p) => p.id))

/**
 * Configuración: un solo lugar para lo que se administra, con su propio menú al costado.
 *
 * Antes «Usuarios» era una pantalla suelta colgada del menú del avatar. Al aparecer más cosas
 * administrables (roles, datos de las empresas) una entrada por cada una en ese menú lo hubiera
 * convertido en una lista larga de cosas que se tocan una vez cada tanto.
 */
export function PanelConfiguracion({ miId, panelInicial }: { miId: string; panelInicial?: string }) {
  const [panel, setPanel] = useState<string>(
    panelInicial && PANELES_IDS.has(panelInicial) ? panelInicial : "usuarios"
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Menú del costado. Es navegación de esta pantalla, no de la app: por eso vive acá y no
          en el menú lateral grande. */}
      <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {PANELES.map(({ id, label, Icono, ayuda }) => {
          const activo = panel === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPanel(id)}
              aria-current={activo ? "page" : undefined}
              className={`flex shrink-0 items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ease-out active:scale-[0.99] motion-reduce:active:scale-100 ${
                activo ? "bg-slate-200 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icono className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {label}
                <span className="hidden text-xs font-normal text-muted-foreground lg:block">{ayuda}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="min-w-0">
        {panel === "usuarios" && <PanelUsuarios miId={miId} />}
        {panel === "roles" && <PanelRoles />}
        {panel === "permisos" && <PanelPermisos />}
        {panel === "aplicacion" && <PanelAplicacion />}
      </div>
    </div>
  )
}

/** Los dos roles del sistema, con lo que hoy define a cada uno (`lib/auth/roles.ts`). */
const ROLES = [
  {
    id: "admin" as const,
    descripcion: "Ve y edita todo el sistema. Es el rol del dueño de la información.",
    exige2FA: true,
  },
  {
    id: "contable" as const,
    descripcion: "Acceso acotado, para delegar la carga sin abrir el resto del sistema.",
    exige2FA: false,
  },
]

/** Cuántas cuentas tiene cada rol. Sin esto «admin» y «contable» son etiquetas sin peso. */
function useCuentasPorRol() {
  const [porRol, setPorRol] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    let cancelado = false
    fetch("/api/admin/usuarios")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelado || !j?.usuarios) return
        const conteo: Record<string, number> = {}
        for (const u of j.usuarios) if (u.rol) conteo[u.rol] = (conteo[u.rol] ?? 0) + 1
        setPorRol(conteo)
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [])
  return porRol
}

/**
 * Los roles.
 *
 * Lo que muestra sale de las mismas funciones que aplican el permiso de verdad (`seccionesDe`),
 * así que no puede quedar desactualizado respecto de lo que realmente pasa. Una pantalla de
 * permisos escrita aparte del código que los aplica miente en cuanto alguien toca algo.
 */
function PanelRoles() {
  const cuentas = useCuentasPorRol()

  return (
    <div className="space-y-4">
      {ROLES.map((r) => {
        const secciones = seccionesDe(r.id)
        const n = cuentas === null ? undefined : (cuentas[r.id] ?? 0)
        const esAdmin = r.id === "admin"
        return (
          <Card key={r.id} className="entrada-suave overflow-hidden">
            {/* Cabecera con el nombre del rol y cuánta gente lo tiene: es el dato que convierte
                una etiqueta en algo concreto. */}
            <div className={`flex items-center justify-between gap-3 border-b px-5 py-3 ${esAdmin ? "bg-slate-100" : "bg-slate-50"}`}>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className={`h-5 w-5 ${esAdmin ? "text-slate-700" : "text-slate-400"}`} />
                <span className="font-semibold">{r.id}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {n === undefined ? "…" : n === 1 ? "1 cuenta" : n === 0 ? "sin cuentas" : `${n} cuentas`}
              </span>
            </div>

            <CardContent className="space-y-4 pt-4 text-sm">
              <p className="text-muted-foreground">{r.descripcion}</p>

              {/* Los dos números que definen al rol, juntos y grandes: cuánto ve y qué le exige
                  para entrar. Antes estaban perdidos en dos bloques de texto separados. */}
              <div className="flex flex-wrap gap-2">
                <div className="rounded-md border bg-white px-3 py-2">
                  <div className="text-lg font-semibold leading-none">{secciones.length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {secciones.length === 1 ? "sección" : "secciones"} de 12
                  </div>
                </div>
                <div className="rounded-md border bg-white px-3 py-2">
                  <div className={`text-lg font-semibold leading-none ${r.exige2FA ? "text-emerald-700" : "text-slate-500"}`}>
                    {r.exige2FA ? "Sí" : "No"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">exige 2FA</div>
                </div>
              </div>

              {/* Con los mismos íconos del menú lateral: se reconoce cada sección de un vistazo,
                  sin leer. */}
              <div className="flex flex-wrap gap-1.5">
                {secciones.map(({ id, label, Icono }) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-xs"
                  >
                    <Icono className="h-3.5 w-3.5 text-slate-500" />
                    {label}
                  </span>
                ))}
              </div>

              {!r.exige2FA && (
                <p className="text-xs text-muted-foreground">
                  El segundo factor quedó opcional para no trabar la delegación: exigirlo convierte
                  el alta de una persona en un trámite.
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}

      <Card className="entrada-suave border-amber-300 bg-amber-50">
        <CardContent className="space-y-2 p-4 text-sm">
          <p className="font-medium text-amber-900">Todavía no se pueden crear ni editar roles.</p>
          <p className="text-amber-900/80">
            Son dos y están escritos en el código, junto con las secciones que ve cada uno. Lo que sí
            se cambia hoy es <strong>qué rol tiene cada cuenta</strong>, y eso se hace en{" "}
            <strong>Usuarios</strong>.
          </p>
          <p className="text-amber-900/80">
            Para que se puedan crear hay que mover los roles y sus permisos a la base de datos. Está
            pedido y pendiente de definir.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * La matriz de permisos: quién puede hacer qué, en una sola vista.
 *
 * Las secciones salen de `seccionesDe()` — la función que aplica el permiso — así que esa mitad
 * de la tabla no se puede desincronizar. Los permisos de administración de abajo **sí están
 * escritos a mano** porque viven repartidos en guardas de páginas y endpoints; cada fila dice de
 * dónde sale, para poder verificarla.
 */
function PanelPermisos() {
  const roles = ROLES.map((r) => r.id)
  const seccionesPorRol = Object.fromEntries(
    roles.map((r) => [r, new Set(seccionesDe(r).map((s) => s.id))])
  ) as Record<string, Set<string>>

  const todasLasSecciones = seccionesDe("admin")

  const administracion = [
    { label: "Entrar a Configuración", puede: { admin: true, contable: false }, donde: "app/configuracion/page.tsx" },
    { label: "Crear y revocar cuentas", puede: { admin: true, contable: false }, donde: "lib/auth/guard-admin.ts" },
    { label: "Cambiarle el rol a otro", puede: { admin: true, contable: false }, donde: "lib/auth/guard-admin.ts" },
    { label: "Ver el panel de pendientes", puede: { admin: true, contable: false }, donde: "dashboard.tsx" },
    { label: "Ver y editar su propio perfil", puede: { admin: true, contable: true }, donde: "app/perfil/page.tsx" },
    { label: "Subir su foto", puede: { admin: true, contable: true }, donde: "app/api/perfil/avatar/route.ts" },
  ]

  const Celda = ({ si }: { si: boolean }) =>
    si ? (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
        <Check className="h-3.5 w-3.5 text-emerald-700" />
      </span>
    ) : (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
        <Minus className="h-3.5 w-3.5 text-slate-400" />
      </span>
    )

  return (
    <div className="space-y-6">
      <Card className="entrada-suave">
        <CardHeader>
          <CardTitle className="text-base">Secciones de la app</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Sección</th>
                  {roles.map((r) => (
                    <th key={r} className="pb-2 px-3 text-center font-medium">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todasLasSecciones.map(({ id, label, Icono }) => (
                  <tr key={id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-2">
                        <Icono className="h-4 w-4 text-slate-400" />
                        {label}
                      </span>
                    </td>
                    {roles.map((r) => (
                      <td key={r} className="px-3 py-2 text-center">
                        <Celda si={seccionesPorRol[r]!.has(id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Esta tabla no está escrita a mano: sale de la misma función que decide el acceso de
            verdad. Si mañana cambia lo que ve un rol, cambia sola.
          </p>
        </CardContent>
      </Card>

      <Card className="entrada-suave">
        <CardHeader>
          <CardTitle className="text-base">Administración</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Puede</th>
                  {roles.map((r) => (
                    <th key={r} className="px-3 pb-2 text-center font-medium">{r}</th>
                  ))}
                  <th className="hidden pb-2 pl-4 text-left font-medium lg:table-cell">Dónde se aplica</th>
                </tr>
              </thead>
              <tbody>
                {administracion.map((f) => (
                  <tr key={f.label} className="border-b last:border-0">
                    <td className="py-2 pr-4">{f.label}</td>
                    {roles.map((r) => (
                      <td key={r} className="px-3 py-2 text-center">
                        <Celda si={f.puede[r as keyof typeof f.puede]} />
                      </td>
                    ))}
                    <td className="hidden py-2 pl-4 lg:table-cell">
                      <code className="text-xs text-muted-foreground">{f.donde}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            ⚠️ Estas filas <strong>sí están escritas a mano</strong>: los permisos de administración
            viven repartidos en guardas de páginas y de endpoints. Por eso cada una dice dónde se
            aplica, para poder verificarla. Si se agrega una guarda nueva, hay que sumarla acá.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Datos de la aplicación, de sólo lectura.
 *
 * Las empresas y sus CUIT salen de `lib/empresas.ts`, que es de donde los toman los encabezados
 * de todos los reportes. Se muestran acá para poder verificarlos sin abrir el código — el Libro
 * IVA de PAM y de MA ya salió una vez con la razón social y el CUIT de MSA impresos.
 */
function PanelAplicacion() {
  return (
    <div className="space-y-6">
      <Card className="entrada-suave">
        <CardHeader>
          <CardTitle className="text-base">Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Sigla</th>
                  <th className="pb-2 pr-4 font-medium">Razón social</th>
                  <th className="pb-2 font-medium">CUIT</th>
                </tr>
              </thead>
              <tbody>
                {EMPRESAS.map((e) => (
                  <tr key={e} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{e}</td>
                    <td className="py-2 pr-4">{DATOS_FISCALES[e].razonSocial}</td>
                    <td className="py-2 tabular-nums">{cuitFormateado(DATOS_FISCALES[e].cuit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Es de sólo lectura: estos datos viven en <code>lib/empresas.ts</code> y de ahí los toman
            los encabezados de todos los reportes. Se muestran para poder verificarlos sin abrir el
            código.
          </p>
        </CardContent>
      </Card>

      <Card className="entrada-suave border-slate-300 bg-slate-50">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Todavía no hay nada configurable acá.</strong> Cuando
            aparezca una opción que se pueda cambiar por el usuario —o por rol— este es su lugar.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
