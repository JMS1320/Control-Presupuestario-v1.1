-- 83 · Notas de la app: la marca «podés arrancar sin mí» — A-FEAT-1266 (2026-10-13)
--
-- Pedido del usuario: «todo lo que tiene (*) significa que podés empezar a trabajar sobre eso sin mi
-- supervisión. Pero mejor agregá a notas la marca para poder trabajar sin supervisión».
-- Hasta hoy el permiso viajaba en una convención del título, que hay que acordarse de tipear y de leer.
--
-- Una columna nueva en public.notas_para_claude: boolean, NOT NULL, default false. Las notas que ya
-- existen quedan en false (no se le inventa el permiso a ninguna). No toca RLS ni permisos: los
-- grants de la tabla son a nivel tabla, así que la columna los hereda; no hay vistas sobre la tabla.
-- Avisado a Javier antes (ENTRE-DESARROLLADORES.md).

alter table public.notas_para_claude
  add column if not exists sin_supervision boolean not null default false;

comment on column public.notas_para_claude.sin_supervision is
  'El usuario autoriza a Claude a desarrollar esta nota sin supervisión (dentro de los límites de CLAUDE.md § Trabajar sin supervisión). A-FEAT-1266.';

notify pgrst, 'reload schema';
