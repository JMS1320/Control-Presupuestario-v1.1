import { supabase } from "@/lib/supabase"
import { leerPreferencias, type Preferencias } from "./preferencias"

/**
 * Guarda UNA o varias preferencias sin pisar las demás (A-FEAT-1277).
 *
 * 🧨 `auth.updateUser` **reemplaza** la clave `preferencias` entera. Cada pantalla mandaba
 * `{ ...lasQueTeníaAlCargar, campo }` — y lo que tenía al cargar puede estar viejo: si en el Cash
 * Flow se acomodan las columnas y después se mueve un widget en Inicio (que cargó antes), Inicio
 * escribía su copia vieja y **borraba las columnas sin aviso**. Por eso se leen las preferencias
 * **vigentes** de la cuenta justo antes de escribir y se cambia sólo lo pedido.
 */
export async function guardarPreferencias(cambios: Partial<Preferencias>): Promise<{ error: string | null; preferencias: Preferencias | null }> {
  const { data, error: errLeer } = await supabase.auth.getUser()
  if (errLeer || !data.user) return { error: errLeer?.message ?? 'sin sesión', preferencias: null }
  const nuevas = { ...leerPreferencias(data.user), ...cambios }
  const { error } = await supabase.auth.updateUser({ data: { preferencias: nuevas } })
  return { error: error?.message ?? null, preferencias: error ? null : nuevas }
}
