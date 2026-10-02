import type { User } from "@supabase/supabase-js"

/**
 * Un rol es **cualquier id de `public.roles`**, no una lista cerrada.
 *
 * ⚠️ Esto era `"admin" | "contable"` hardcodeado, y dejó de ser cierto el 2026-09-05, cuando
 * `scripts/60` movió los roles a una tabla para que el admin creara los suyos. El código no se
 * enteró: el 2026-09-24 había **5 roles en la base** (`productivo`, `pruebas`, `socio` además de
 * los dos), y `getRole()` devolvía `null` para los tres nuevos — o sea que asignarle uno a alguien
 * lo mandaba a `/no-access` con su fila de permisos intacta y sin que nada avisara.
 *
 * Y con la RLS de A-SEC-07 puesta, el desfasaje se vuelve peor que un fastidio: `tiene_rol()` sólo
 * pregunta *«¿tenés algún rol?»*, así que esa persona **sí pasa la base** —lee y escribe las 95
 * tablas— mientras la app la rechaza. Puerta de adelante cerrada, puerta de atrás abierta.
 *
 * Por eso ahora el tipo es `string`: **la lista de roles vive en la tabla y en ningún otro lado.**
 */
export type UserRole = string

/**
 * De dónde sale el rol: `app_metadata.role` del JWT.
 *
 * ⚠️ `app_metadata` y NO `user_metadata`. `user_metadata` lo puede editar el propio usuario con su
 * sesión (`auth.updateUser`), así que guardar el rol ahí es regalar un escalado de privilegios:
 * cualquiera se haría `admin` solo. `app_metadata` únicamente se escribe con `service_role`.
 */
export function getRole(user: User | null | undefined): UserRole | null {
  const rol = user?.app_metadata?.role
  // Sólo se valida la FORMA, no que el rol exista: esto es síncrono y se usa en todos lados,
  // mientras que la tabla es asíncrona. Que el rol exista de verdad lo comprueba
  // `seccionesDelRol()`, que ya lee la tabla — un rol inventado no trae secciones y la persona
  // no ve nada, que es el default seguro. Ver `rolExiste()` más abajo para el caso en que hace
  // falta la certeza (el alta de usuarios).
  return typeof rol === "string" && rol.trim() !== "" ? rol : null
}

export function esAdmin(user: User | null | undefined): boolean {
  return getRole(user) === "admin"
}

/** Nivel de garantía de la sesión: `aal2` = pasó por el segundo factor. */
export type AAL = "aal1" | "aal2"

/**
 * ¿Este usuario está obligado a tener 2FA?
 *
 * ⚠️ Sigue mirando `admin` y **no** la columna `exige_2fa` de la tabla, a propósito: esta función
 * es síncrona y la usa el middleware, que corre en cada request. Leer la tabla ahí costaría una
 * consulta por request para un dato que cambia una vez por año.
 *
 * La columna `exige_2fa` **sí** existe y se edita desde Configuración → Roles; aplicarla es
 * trabajo aparte, y hasta que se haga esto es la única fuente. Mientras tanto vale la regla que
 * decidió el usuario el 2026-09-03: obligatorio para `admin`, opcional para el resto, para no
 * trabar la delegación (§ quinta pieza: el PERMISO, en `CLAUDE.md`).
 */
export function requiere2FA(user: User | null | undefined): boolean {
  return getRole(user) === "admin"
}
