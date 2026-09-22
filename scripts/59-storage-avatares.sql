-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 59 · Bucket de Storage para las fotos de perfil          A-FEAT-79 · 2026-09-05
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Hasta acá la foto de perfil sólo se podía poner pegando una URL externa. Esto habilita subir
-- un archivo desde la computadora.
--
-- POR QUÉ UN BUCKET Y NO GUARDAR LA IMAGEN EN `user_metadata`:
--   `user_metadata` **viaja dentro del JWT**, y el JWT viaja en una cookie. Una imagen en base64
--   ahí adentro revienta el límite de ~4 KB de la cookie y rompe la sesión entera. No es una
--   cuestión de prolijidad: no funciona.
--
-- DECISIONES DE SEGURIDAD:
--   · `public = true` → las fotos se leen sin autenticación (es lo que permite que el <img> las
--     muestre). Son avatares de un sistema interno; no hay dato sensible en una foto de perfil.
--   · **NO se crean políticas de INSERT/UPDATE/DELETE.** La escritura pasa SOLO por
--     `/api/perfil/avatar`, que usa `service_role` (ignora RLS) y valida tipo, tamaño y que sólo
--     escribas en TU carpeta. Sin políticas, un cliente con la anon key **no puede subir nada**
--     por su cuenta ni saltear esas validaciones.
--   · El límite de tamaño y los tipos permitidos se declaran acá además de en el endpoint: dos
--     puertas para lo mismo, por si alguna vez se agrega otra vía de subida.
--
-- Es idempotente y NO destructivo: si el bucket ya existe, actualiza sus límites y no toca ni un
-- archivo. Se puede correr las veces que haga falta.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatares',
  'avatares',
  true,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Control: tiene que devolver una fila con public = true y el límite en 2097152.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'avatares';
