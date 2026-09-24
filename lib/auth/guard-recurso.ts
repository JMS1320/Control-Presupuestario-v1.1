import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"
import { nivelesDe, seccionesDelRol } from "@/lib/auth/permisos"
import { RECURSOS } from "@/lib/auth/recursos"

/**
 * ¿ESTA SESIÓN PUEDE ESCRIBIR EN ESTE RECURSO? — A-FEAT-169, etapa 4
 *
 * La segunda barrera. La primera (apagar los controles en la pantalla, `solo-lectura.tsx`) evita
 * el error honesto; ésta frena el pedido aunque venga de la consola del navegador, de `curl` o de
 * una pantalla vieja que nadie actualizó.
 *
 * ⚠️ **Tampoco es la última.** Sólo protege lo que pasa por `app/api`, y la mayor parte de este
 * proyecto **escribe directo desde el navegador** contra PostgREST (452 llamadas en 66
 * componentes, medido el 2026-09-24). Para eso hace falta RLS por recurso — etapa 5. Lo que esta
 * función cubre es la minoría; decirlo importa más que la función.
 */
export type ResultadoRecurso =
  | { ok: true; rol: string }
  | { ok: false; status: number; motivo: string }

export async function exigirEscritura(recurso: string): Promise<ResultadoRecurso> {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  const rol = getRole(user)
  if (!rol) return { ok: false, status: 401, motivo: "Sin sesión o sin rol asignado." }

  // El recurso tiene que existir en el registro. Si no, esto no protege nada y encima lo aparenta:
  // un id mal escrito no matchearía ninguna excepción y dejaría pasar todo (§ Contrapartes — el
  // UPDATE que no matchea no falla, y el hueco queda invisible).
  const declarado = RECURSOS.find((r) => r.id === recurso)
  if (!declarado) {
    return { ok: false, status: 500, motivo: `Recurso no declarado: ${recurso}` }
  }

  // Primero la sección: sin ella no hay nada que discutir sobre el grano fino.
  const secciones = await seccionesDelRol(rol)
  if (!secciones.includes(declarado.seccion)) {
    return { ok: false, status: 403, motivo: "No tenés acceso a esa sección." }
  }

  const niveles = await nivelesDe(rol)
  // Si el padre está en "ninguno", el hijo tampoco — igual que en la pantalla.
  if (declarado.padre && niveles[declarado.padre] === "ninguno") {
    return { ok: false, status: 403, motivo: "No tenés acceso a esa parte." }
  }

  // Sin excepción declarada hereda de la sección = escritura. Es el default de siempre, y el
  // único que no rompe lo que ya funcionaba.
  const nivel = niveles[recurso] ?? "escritura"
  if (nivel === "ninguno") return { ok: false, status: 403, motivo: "No tenés acceso a esa parte." }
  if (nivel === "lectura") {
    return { ok: false, status: 403, motivo: "Tenés esa parte en sólo lectura: no podés guardar cambios." }
  }

  return { ok: true, rol }
}
