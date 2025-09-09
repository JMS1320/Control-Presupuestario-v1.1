// Configuración de rutas de acceso como sistema de "passwords"
// Puedes cambiar estas rutas cuando quieras revocar/otorgar acceso

export const ACCESS_ROUTES = {
  // Rutas de Admin (acceso completo)
  "adminjms1320": "admin",
  
  // Rutas de Empleado Contable (solo pestaña Egresos)
  "ulises": "contable"
}

// Función para validar acceso y obtener rol
export function getRoleFromRoute(route: string): string | null {
  return ACCESS_ROUTES[route] || null
}

// Función para verificar si una ruta es válida
export function isValidRoute(route: string): boolean {
  return route in ACCESS_ROUTES
}