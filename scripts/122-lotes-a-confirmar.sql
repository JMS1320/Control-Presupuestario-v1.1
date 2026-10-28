-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔒 Script 122 — A-FEAT-1408 + A-DEC-1024: el lote que crea alguien que no es JMS queda «A CONFIRMAR»
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-28: «no le quiero dar acceso a empezar a crear lotes así porque sí: siempre quedará pendiente de mi
-- cheq» y, como regla general (A-DEC-1024), «todo lo que hagan los usuarios que no sean yo debe quedar pendiente
-- de mi OK por default». Mismo mecanismo que el «Se hizo» de las órdenes (A-FEAT-1223): confirma sólo el admin.
--
-- 1) productivo.lotes_agricolas: a_confirmar (false por defecto: los 13 lotes que hay quedan confirmados),
--    creado_por, confirmado_por, confirmado_at.
-- 2) Rol `pruebas` (el de San Manuel): se le SACA «Nuevo lote» de Lotes Agrícolas y se le DA el permiso nuevo
--    «Crear lote desde la orden» (JMS 28/10: «restringir este botón acá pero dejarlo abierto dentro de órdenes»).
--    Se tocan sólo esas dos claves; el resto del rol no se toca (CLAUDE.md regla 17).
--
-- Deshacer: 122-lotes-a-confirmar-deshacer.sql (columnas: el script frena si ya existían; el rol vuelve a sus dos
-- claves de antes). Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'productivo' and table_name = 'lotes_agricolas' and column_name = 'a_confirmar') then
    raise exception 'productivo.lotes_agricolas.a_confirmar YA EXISTE: no se corre. Avisar antes de seguir.';
  end if;
end $$;

alter table productivo.lotes_agricolas
  add column a_confirmar boolean not null default false,
  add column creado_por text,
  add column confirmado_por text,
  add column confirmado_at timestamptz;
comment on column productivo.lotes_agricolas.a_confirmar is
  '[script 122] A-FEAT-1408 / A-DEC-1024 — creado por alguien que no es admin: pendiente del OK de JMS. Se puede usar en sus órdenes.';

update public.roles
   set permisos = (coalesce(permisos, '{}'::jsonb) - 'productivo.lotes.nuevo')
                  || jsonb_build_object('productivo.ordenes.nuevo-lote', 'escritura')
 where id = 'pruebas';

commit;
