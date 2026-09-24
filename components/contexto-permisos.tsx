"use client"

import { createContext, useContext, useMemo } from "react"

/**
 * LOS PERMISOS FINOS, DISPONIBLES EN CUALQUIER VISTA — A-FEAT-169
 *
 * Por contexto y no por props: las pestañas a esconder viven dentro de `vista-*.tsx` de miles de
 * líneas, y hacerlas llegar por props obligaba a tocar la firma de cada componente intermedio.
 * El permiso no es un dato de la vista, es del ambiente.
 *
 * ⚠️ **Se guarda lo OCULTO, no lo permitido.** Así, un recurso que todavía nadie registró en
 * `lib/auth/recursos.ts` **se sigue viendo**: desaparecer una pestaña que nadie prohibió sería el
 * peor default posible, y encima mudo. El control `npm run verificar:recursos` es el que avisa de
 * lo no registrado.
 *
 * ⚠️ **Esto NO es seguridad, es orden.** Esconder una pestaña en el navegador no impide nada:
 * quien quiera, escribe desde la consola con la misma sesión. La barrera real es la RLS
 * (A-SEC-07, ya puesta) y el permiso por recurso en la base, que es la etapa 5.
 */
const ContextoPermisos = createContext<Set<string>>(new Set())

export function ProveedorPermisos({
  ocultos,
  children,
}: {
  ocultos: string[]
  children: React.ReactNode
}) {
  const valor = useMemo(() => new Set(ocultos), [ocultos])
  return <ContextoPermisos.Provider value={valor}>{children}</ContextoPermisos.Provider>
}

/** `puedeVer("productivo.insumos")`. Lo no declarado se ve. */
export function usePuedeVer() {
  const ocultos = useContext(ContextoPermisos)
  return useMemo(() => (recurso: string) => !ocultos.has(recurso), [ocultos])
}

/**
 * La primera pestaña visible de una lista, para el `defaultValue` de un `<Tabs>`.
 *
 * Sin esto, esconder la primera pestaña deja el `<Tabs>` apuntando a un valor que ya no existe:
 * la pantalla abre **en blanco** y parece un error de carga, no un permiso. Devuelve la primera
 * igual si están todas ocultas — es preferible mostrar algo a mostrar nada, y ese caso ya lo
 * evita la pantalla de Roles, que no deja dejar una sección sin nada adentro.
 */
export function usePrimeraVisible() {
  const puedeVer = usePuedeVer()
  return (recursos: string[]) => {
    const visible = recursos.find((r) => puedeVer(r))
    const elegido = visible ?? recursos[0]
    return elegido?.split(".").slice(1).join(".") ?? ""
  }
}
