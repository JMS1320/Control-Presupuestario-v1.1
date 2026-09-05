import { supabaseAdmin } from "@/lib/supabase-admin"

/** Los ids de las 12 secciones, en el orden en que se muestran. Fuente: el menú lateral. */
export const SECCIONES_IDS = [
  "principal", "dashboard", "distribucion", "reporte", "egresos", "ingresos",
  "cashflow", "extracto", "productivo", "sueldos", "presupuesto", "importar",
] as const

export type Rol = {
  id: string
  descripcion: string
  secciones: string[]
  exige_2fa: boolean
  es_sistema: boolean
}

/**
 * El reparto que estaba escrito en el código antes de que existiera la tabla.
 *
 * ⚠️ **No es código muerto: es el paracaídas.** Si la tabla todavía no se creó (falta correr
 * `scripts/60`) o la consulta falla, la app sigue funcionando exactamente como antes en vez de
 * dejar a todo el mundo sin secciones — que es lo que pasaría si se devolviera una lista vacía.
 * Un sistema de permisos que falla abriendo todo es un agujero; uno que falla cerrando todo deja
 * a la gente afuera. Acá falla **al reparto anterior**, que es el único que no sorprende.
 */
const FALLBACK: Record<string, Rol> = {
  admin: {
    id: "admin",
    descripcion: "Ve y edita todo el sistema. Es el rol del dueño de la información.",
    secciones: [...SECCIONES_IDS],
    exige_2fa: true,
    es_sistema: true,
  },
  contable: {
    id: "contable",
    descripcion: "Acceso acotado, para delegar la carga sin abrir el resto del sistema.",
    secciones: ["egresos"],
    exige_2fa: false,
    es_sistema: false,
  },
}

export type ResultadoRoles = { roles: Rol[]; desdeLaBase: boolean }

/**
 * Los roles con sus permisos. Se lee con `service_role` porque la tabla tiene RLS sin políticas:
 * no se entra con la anon key.
 */
export async function leerRoles(): Promise<ResultadoRoles> {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("id, descripcion, secciones, exige_2fa, es_sistema")
    .order("es_sistema", { ascending: false })
    .order("id")

  if (error || !data || data.length === 0) {
    return { roles: Object.values(FALLBACK), desdeLaBase: false }
  }
  return { roles: data as Rol[], desdeLaBase: true }
}

/** Las secciones que ve un rol. Si el rol no existe en la tabla, no ve nada. */
export async function seccionesDelRol(rol: string | null): Promise<string[]> {
  if (!rol) return []
  const { roles } = await leerRoles()
  return roles.find((r) => r.id === rol)?.secciones ?? []
}
