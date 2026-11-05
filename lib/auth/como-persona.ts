/**
 * 👁️ «VER COMO LO VE ÉL» CON LA PERSONA REAL — A-BUG-1544.
 *
 * En el modo permisos, los paneles que son de cada persona («Para vos», «Lo que te vence») mostraban lo del admin,
 * porque se filtran por la sesión. Con `?como=<mail>`, un ADMIN puede leer los de otra persona — sólo leer: las rutas
 * que escriben siguen tomando a la persona de la sesión. (La búsqueda de la cuenta vive en `como-persona-servidor.ts`,
 * aparte, porque esto lo importan también los casos de prueba que corren en el navegador.)
 *
 * Pura: ¿se acepta mirar como otra persona? Sólo si quien pide es admin y el mail no está vacío.
 */
export function puedeMirarComo(rolSesion: string | null | undefined, como: string | null | undefined): boolean {
  return rolSesion === "admin" && !!(como ?? "").trim()
}
