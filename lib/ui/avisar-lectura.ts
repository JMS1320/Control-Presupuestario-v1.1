/**
 * 🧮 Aviso en pantalla cuando una lectura por tandas no trajo todo (A-BUG-1379). Ver `lib/supabase-paginado.ts`.
 * Nada se descarta en silencio: se avisa con un cartel y queda en la consola.
 */
import { toast } from "sonner"
import { mensajeLecturaIncompleta } from "@/lib/supabase-paginado"

export function avisarSiIncompleta(nombre: string, r: { data: unknown[]; esperadas: number | null; error?: { message: string } | null }): void {
  if (r.error) { console.error(`${nombre}:`, r.error.message); toast.error(`${nombre}: ${r.error.message}`); return }
  const m = mensajeLecturaIncompleta(nombre, r.data.length, r.esperadas)
  if (m) { console.warn(m); toast.warning(m) }
}
