/**
 * 🔐 SISTEMA DE RUTAS COMO PASSWORDS
 * 
 * Este archivo controla quién puede acceder al sistema usando URLs específicas.
 * Las rutas funcionan como "passwords" - solo quien tenga la URL correcta puede acceder.
 * 
 * 🚀 CÓMO FUNCIONA:
 * 1. Usuario va a: https://tu-app.vercel.app/RUTA_ESPECIAL
 * 2. Sistema busca RUTA_ESPECIAL en ACCESS_ROUTES
 * 3. Si existe → asigna el rol correspondiente
 * 4. Si NO existe → redirige a página de error
 * 
 * 🎯 TIPOS DE ROL:
 * - "admin": Acceso completo (todas las pestañas + edición total)  
 * - "contable": Solo pestaña Egresos (Facturas ARCA + Templates)
 * - "readonly": Solo lectura (para el futuro)
 * 
 * 📝 EJEMPLOS DE USO:
 * 
 * ✅ AGREGAR NUEVO EMPLEADO:
 * "maria2025": "contable",
 * 
 * ✅ CREAR NUEVA RUTA ADMIN:
 * "jefe2025": "admin",
 * 
 * ✅ REVOCAR ACCESO: 
 * // "ulises": "contable",  ← Comentar o eliminar línea
 * 
 * ✅ CAMBIAR "PASSWORD":
 * "ulises": "contable",        ← Eliminar línea vieja
 * "ulises_nuevo": "contable",  ← Agregar línea nueva
 * 
 * ⚡ CAMBIOS SE APLICAN AUTOMÁTICAMENTE:
 * 1. Editar este archivo
 * 2. git add config/access-routes.ts
 * 3. git commit -m "Update: Cambios rutas acceso"
 * 4. git push origin desarrollo
 * 5. Esperar 1-2 minutos → Vercel despliega automáticamente
 * 
 * 🔗 URLS RESULTANTES:
 * https://tu-app.vercel.app/adminjms1320  → Admin completo
 * https://tu-app.vercel.app/ulises       → Empleado contable
 * https://tu-app.vercel.app/             → ERROR (sin acceso)
 * https://tu-app.vercel.app/inventada    → ERROR (ruta no válida)
 */

export const ACCESS_ROUTES = {
  // 👑 RUTAS DE ADMIN (acceso completo a todo el sistema)
  "adminjms1320": "admin",  // JMS - Administrador principal
  
  // 👔 RUTAS DE EMPLEADO CONTABLE (solo pestaña Egresos: Facturas ARCA + Templates)  
  "ulises": "contable",     // Ulises - Empleado contable
  
  // 📋 EJEMPLOS DE RUTAS ADICIONALES (descomentá para usar):
  // "maria2025": "contable",     // Otro empleado contable
  // "jefe2025": "admin",         // Otro admin
  // "consultor": "readonly",     // Solo lectura (requiere implementar rol)
}

// Función para validar acceso y obtener rol
export function getRoleFromRoute(route: string): string | null {
  return ACCESS_ROUTES[route] || null
}

// Función para verificar si una ruta es válida
export function isValidRoute(route: string): boolean {
  return route in ACCESS_ROUTES
}