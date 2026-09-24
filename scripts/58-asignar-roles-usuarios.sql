-- =====================================================================================
-- 58 — BOOTSTRAP: EL PRIMER ADMIN
-- Fecha: 2026-09-03 · Parte de A-SEC-03
-- =====================================================================================
--
-- 🥚 POR QUÉ EXISTE ESTE SCRIPT
--   El alta de cuentas vive en la app (`/usuarios`), pero esa pantalla exige **ya ser admin con
--   2FA**. La primera cuenta no puede salir de ahí. Este script rompe ese huevo-y-gallina, una
--   sola vez. **Todas las demás cuentas (Ulises incluido) se crean desde `/usuarios`** — no hace
--   falta volver acá.
--
-- ⚠️ POR QUÉ `app_metadata` Y NO `user_metadata`
--   `user_metadata` lo puede editar el propio usuario con su sesión (`auth.updateUser`). Si el rol
--   viviera ahí, cualquiera se haría `admin` desde la consola del browser. `app_metadata` sólo se
--   escribe con `service_role` — es decir, desde el SQL Editor, como acá.
--
-- ⚠️ TOCA DATOS (`auth.users`). Correr los pasos de a uno y mirar la salida de cada uno.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- PASO 1 — ¿Existe la cuenta? (crearla antes en Authentication → Users → Add user)
--   Esperado: 1 fila, con rol NULL.
-- -------------------------------------------------------------------------------------
SELECT id, email, raw_app_meta_data ->> 'role' AS rol, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'javiergc89@gmail.com';


-- -------------------------------------------------------------------------------------
-- PASO 2 — Asignar el rol admin.
--   `||` MERGEA sobre lo que ya hay (no pisa `provider`/`providers`, que Supabase usa).
--   Escribir el objeto entero rompería el login.
--   Esperado: UPDATE 1.
-- -------------------------------------------------------------------------------------
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', 'admin')
WHERE email = 'javiergc89@gmail.com';


-- -------------------------------------------------------------------------------------
-- PASO 3 — Verificar. Esperado: rol = admin.
-- -------------------------------------------------------------------------------------
SELECT email,
       raw_app_meta_data ->> 'role'     AS rol,
       raw_app_meta_data ->> 'provider' AS proveedor_login
FROM auth.users
WHERE email = 'javiergc89@gmail.com';


-- =====================================================================================
-- REVERT — sacar el rol (deja la cuenta sin acceso: cae en /no-access)
-- =====================================================================================
-- UPDATE auth.users
-- SET raw_app_meta_data = raw_app_meta_data - 'role'
-- WHERE email = 'javiergc89@gmail.com';
