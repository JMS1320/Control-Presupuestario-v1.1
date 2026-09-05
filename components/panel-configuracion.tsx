"use client"

import { useState } from "react"
import { PanelUsuarios } from "@/components/panel-usuarios"
import { seccionesDe } from "@/components/layout-app"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DATOS_FISCALES, EMPRESAS, cuitFormateado } from "@/lib/empresas"
import { Users, ShieldCheck, Building2 } from "lucide-react"

const PANELES = [
  { id: "usuarios",   label: "Usuarios",   Icono: Users,       ayuda: "Cuentas, roles y acceso" },
  { id: "roles",      label: "Roles",      Icono: ShieldCheck, ayuda: "Qué ve y qué exige cada rol" },
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
        {panel === "aplicacion" && <PanelAplicacion />}
      </div>
    </div>
  )
}

/**
 * Los roles, de sólo lectura.
 *
 * No se crean ni se editan roles: son dos, fijos en el código (`lib/auth/roles.ts`), y lo único
 * que se cambia es **qué rol tiene cada cuenta** — eso se hace en Usuarios. Esta pantalla existe
 * para poder contestar *"¿qué ve un contable?"* sin abrir el código.
 *
 * Lo que muestra sale de las mismas funciones que aplican el permiso de verdad (`seccionesDe`),
 * así que no puede quedar desactualizada respecto de lo que realmente pasa.
 */
function PanelRoles() {
  const roles = [
    {
      id: "admin" as const,
      titulo: "admin",
      descripcion: "Ve y edita todo el sistema. Es el rol del dueño de la información.",
      exige2FA: true,
    },
    {
      id: "contable" as const,
      titulo: "contable",
      descripcion: "Acceso acotado para delegar la carga sin abrir el resto del sistema.",
      exige2FA: false,
    },
  ]

  return (
    <div className="space-y-6">
      {roles.map((r) => {
        const secciones = seccionesDe(r.id)
        return (
          <Card key={r.id} className="entrada-suave">
            <CardHeader>
              <CardTitle className="text-base">{r.titulo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">{r.descripcion}</p>

              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Secciones que ve ({secciones.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {secciones.map((s) => (
                    <span key={s.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs">
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Segundo factor
                </div>
                {r.exige2FA ? (
                  <p><strong>Obligatorio.</strong> Sin activarlo no se entra.</p>
                ) : (
                  <p>
                    <strong>Opcional.</strong> Se dejó así para no trabar la delegación: exigirlo
                    convierte el alta de una persona en un trámite.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Card className="entrada-suave border-slate-300 bg-slate-50">
        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Los roles no se crean ni se editan desde acá.</strong>{" "}
            Son dos y están fijos en el código. Lo que sí se cambia es qué rol tiene cada cuenta, y
            eso se hace en <strong className="text-foreground">Usuarios</strong>.
          </p>
          <p>
            El rol de cada cuenta vive en <code className="text-xs">app_metadata</code> del token, que
            sólo se escribe desde el servidor. Guardarlo donde el propio usuario pueda editarlo sería
            regalarle a cualquiera la posibilidad de hacerse administrador.
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
