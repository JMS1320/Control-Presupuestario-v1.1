import { supabaseAdmin } from "@/lib/supabase-admin"

/** Los ids de las 12 secciones, en el orden en que se muestran. Fuente: el menú lateral. */
export const SECCIONES_IDS = [
  "principal", "dashboard", "distribucion", "reporte", "egresos", "ingresos",
  "cashflow", "extracto", "productivo", "sueldos", "presupuesto", "importar",
] as const

/** Los niveles que existen. `"lectura"` está declarado pero todavía NO lo aplica nadie (etapa 3). */
export type Nivel = "ninguno" | "lectura" | "escritura"

export type Rol = {
  id: string
  descripcion: string
  secciones: string[]
  exige_2fa: boolean
  es_sistema: boolean
  /**
   * EXCEPCIONES dentro de las secciones (A-FEAT-169, `scripts/61`). `{}` = todo lo de adentro.
   * Clave = id de `lib/auth/recursos.ts`; hoy el único valor que se escribe es `"ninguno"`.
   */
  permisos: Record<string, Nivel>
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
    permisos: {},
  },
  contable: {
    id: "contable",
    descripcion: "Acceso acotado, para delegar la carga sin abrir el resto del sistema.",
    secciones: ["egresos"],
    exige_2fa: false,
    es_sistema: false,
    permisos: {},
  },
}

export type ResultadoRoles = {
  roles: Rol[]
  desdeLaBase: boolean
  /** Qué falta, cuando falta algo. La pantalla necesita distinguirlo para no decir una mentira. */
  falta?: "tabla" | "columna_permisos"
}

/**
 * Los roles con sus permisos. Se lee con `service_role` porque la tabla tiene RLS sin políticas:
 * no se entra con la anon key.
 */
export async function leerRoles(): Promise<ResultadoRoles> {
  const COLUMNAS = "id, descripcion, secciones, exige_2fa, es_sistema"

  /**
   * ⚠️ Se pide `permisos` aparte y con reintento, y el motivo vale la pena:
   *
   * Un `select` con una columna que no existe **falla entero**. Cuando se agregó `permisos`
   * (A-FEAT-169, `scripts/61`) sin correr todavía el script, la lectura de roles empezó a fallar
   * y la app cayó al FALLBACK diciendo **«falta crear la tabla de roles»** — que era falso: la
   * tabla estaba, faltaba una columna. El cartel mandaba a correr `scripts/60`, que no arreglaba
   * nada, y el estado real quedaba invisible.
   *
   * Reintentar sin la columna nueva hace que **un script pendiente degrade una función, no la
   * tabla entera**, y que el cartel diga cuál de los dos falta.
   */
  let falta: ResultadoRoles["falta"]
  let filas: Rol[] | null = null

  const conPermisos = await supabaseAdmin
    .from("roles")
    .select(`${COLUMNAS}, permisos`)
    .order("es_sistema", { ascending: false })
    .order("id")

  if (!conPermisos.error) {
    filas = conPermisos.data as Rol[]
  } else {
    const sinPermisos = await supabaseAdmin
      .from("roles")
      .select(COLUMNAS)
      .order("es_sistema", { ascending: false })
      .order("id")
    if (!sinPermisos.error && sinPermisos.data) {
      filas = sinPermisos.data as Rol[]
      falta = "columna_permisos"
    }
  }

  if (!filas || filas.length === 0) {
    return { roles: Object.values(FALLBACK), desdeLaBase: false, falta: "tabla" }
  }
  const data = filas
  // `permisos` puede faltar si todavía no se corrió `scripts/61`: se normaliza a {} (sin
  // excepciones), que es el comportamiento anterior. Igual que el FALLBACK: se falla al reparto
  // que ya había, nunca a "no ve nada" ni a "ve todo".
  const roles = data.map((r) => ({ ...r, permisos: r.permisos ?? {} }))
  return { roles, desdeLaBase: true, falta }
}

/**
 * LOS RECURSOS QUE UN ROL **NO** PUEDE VER, dentro de las secciones que sí tiene.
 *
 * Se devuelve la lista de ocultos y no la de permitidos por una razón concreta: los permitidos
 * dependen del registro `recursos.ts`, así que una pestaña **nueva y sin registrar** quedaría
 * fuera de la lista y desaparecería de la pantalla sin que nadie la haya prohibido. Con la lista
 * de ocultos, lo no declarado **se ve** — que es como funciona hoy y el único default que no
 * sorprende. El control `npm run verificar:recursos` es el que avisa de lo no registrado.
 */
export async function recursosOcultosDe(rol: string | null): Promise<string[]> {
  if (!rol) return []
  const { roles } = await leerRoles()
  const permisos = roles.find((r) => r.id === rol)?.permisos ?? {}
  return Object.entries(permisos)
    .filter(([, nivel]) => nivel === "ninguno")
    .map(([recurso]) => recurso)
}

/** Las secciones que ve un rol. Si el rol no existe en la tabla, no ve nada. */
export async function seccionesDelRol(rol: string | null): Promise<string[]> {
  if (!rol) return []
  const { roles } = await leerRoles()
  return roles.find((r) => r.id === rol)?.secciones ?? []
}
