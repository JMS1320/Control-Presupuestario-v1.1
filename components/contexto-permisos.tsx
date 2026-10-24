"use client"

import { createContext, useContext, useMemo } from "react"
import { nivelEnBorrador, type Borrador } from "@/lib/auth/modo-permisos"

/**
 * LOS PERMISOS FINOS, DISPONIBLES EN CUALQUIER VISTA — A-FEAT-169
 *
 * Por contexto y no por props: las pestañas a esconder viven dentro de `vista-*.tsx` de miles de
 * líneas, y hacerlas llegar por props obligaba a tocar la firma de cada componente intermedio.
 * El permiso no es un dato de la vista, es del ambiente.
 *
 * ⚠️ **Se guardan las EXCEPCIONES, no los permisos.** Lo que no figura hereda de la sección, que
 * hoy significa escritura. Así, un recurso que todavía nadie registró en `lib/auth/recursos.ts`
 * **se sigue viendo y editando**: desaparecer una pestaña que nadie prohibió sería el peor default
 * posible, y encima mudo.
 *
 * ⚠️ **Esto NO es seguridad, es orden.** Esconder una pestaña o apagar un botón en el navegador no
 * impide nada: quien quiera, escribe desde la consola con la misma sesión. La barrera real es la
 * RLS por recurso — etapa 5 de A-FEAT-169.
 */
export type Nivel = "ninguno" | "lectura" | "escritura"

const ContextoPermisos = createContext<Record<string, Nivel>>({})

export function ProveedorPermisos({
  niveles,
  children,
}: {
  niveles: Record<string, Nivel>
  children: React.ReactNode
}) {
  const valor = useMemo(() => niveles ?? {}, [niveles])
  return <ContextoPermisos.Provider value={valor}>{children}</ContextoPermisos.Provider>
}

/**
 * 🖱️ MODO PERMISOS (A-FEAT-1334): un admin recorre la app prendiendo lo que ve OTRO rol. Vive acá,
 * y no en `modo-permisos.tsx`, porque cambia lo que responde `useNivel`: mientras está activo la
 * pantalla muestra TODO (para poder prender lo que el rol no tiene, que se ve atenuado), salvo con
 * «ver como lo ve él», que muestra exactamente lo del borrador. Sólo lo abre un admin
 * (`app/page.tsx`), así que para cualquier otro usuario esto es siempre `null`.
 */
export type EstadoModoPermisos = {
  rolId: string
  descripcion: string
  borrador: Borrador
  soloLoQueVe: boolean
  alternarSeccion: (seccion: string) => void
  alternarRecurso: (recurso: string) => void
}

export const ContextoModoPermisos = createContext<EstadoModoPermisos | null>(null)

export function useModoPermisos() {
  return useContext(ContextoModoPermisos)
}

/** El nivel de un recurso. Sin excepción declarada = `"escritura"` (hereda de la sección). */
export function useNivel() {
  const niveles = useContext(ContextoPermisos)
  const modo = useModoPermisos()
  return useMemo(() => (recurso: string): Nivel => {
    if (modo) return modo.soloLoQueVe ? nivelEnBorrador(modo.borrador, recurso) : "escritura"
    return niveles[recurso] ?? "escritura"
  }, [niveles, modo])
}

/** `puedeVer("productivo.insumos")` — falso sólo si está explícitamente en `"ninguno"`. */
export function usePuedeVer() {
  const nivel = useNivel()
  return useMemo(() => (recurso: string) => nivel(recurso) !== "ninguno", [nivel])
}

/**
 * `puedeEditar("productivo.insumos")`.
 *
 * ⚠️ **Existe y devuelve el dato correcto, pero hoy casi nadie lo llama.** Apagar los controles de
 * guardar en cada pantalla es la etapa 3, y frenar de verdad la escritura es la etapa 5 (RLS). Se
 * expone ahora para que las pantallas lo vayan adoptando sin esperar a nada.
 */
export function usePuedeEditar() {
  const nivel = useNivel()
  return useMemo(() => (recurso: string) => nivel(recurso) === "escritura", [nivel])
}

/**
 * La primera pestaña visible de una lista, para el `defaultValue` de un `<Tabs>`.
 *
 * Sin esto, esconder la primera pestaña deja el `<Tabs>` apuntando a un valor que ya no existe:
 * la pantalla abre **en blanco** y parece un error de carga, no un permiso.
 */
export function usePrimeraVisible() {
  const puedeVer = usePuedeVer()
  return (recursos: string[]) => {
    const elegido = recursos.find((r) => puedeVer(r)) ?? recursos[0]
    return elegido?.split(".").slice(1).join(".") ?? ""
  }
}
