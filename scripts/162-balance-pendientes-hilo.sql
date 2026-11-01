-- 162 · «TU RESPUESTA» DE UN TEMA DEL BALANCE COMO HILO (ESTRUCTURA) — A-BUG-1478 — OK de JMS 01/11 («un hilo secuencial: si
-- estoy escribiendo abajo de todo, lo que guardo debería ir ahí como último mensaje»).
--
-- Qué hace: agrega `hilo jsonb` a `public.balance_pendientes`: la lista de mensajes del tema, [{fecha, autor, texto, imagen?}],
-- que se AGREGAN (nunca se pisan). `resolucion` sigue llevando el último mensaje (lo usan el export y el papel). Vacía. No toca
-- datos. Sin cambios de RLS ni de permisos.
-- Por qué: «Tu respuesta» guardaba un solo texto y el mensaje nuevo reemplazaba al anterior (se perdió uno de JMS el 01/11).
-- Marca: comentario '[script 162]'. Deshacer: 162-…-deshacer.sql (sólo si sigue vacía).

alter table public.balance_pendientes add column if not exists hilo jsonb;
comment on column public.balance_pendientes.hilo is '[script 162] Los mensajes del tema del recorrido, en orden: [{fecha, autor, texto, imagen?}]. Se agregan, no se pisan.';
