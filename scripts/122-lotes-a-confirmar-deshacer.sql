-- ↩️ Deshacer del script 122 (A-FEAT-1408). Borra SÓLO lo que creó el 122: las 4 columnas (el 122 frena si ya
-- existían) y vuelve el rol `pruebas` a sus dos claves de antes (con «Nuevo lote» en Lotes Agrícolas, sin el
-- permiso de crear lote desde la orden). Antes, volver la pantalla a la versión sin estas columnas.
begin;
alter table productivo.lotes_agricolas
  drop column if exists a_confirmar,
  drop column if exists creado_por,
  drop column if exists confirmado_por,
  drop column if exists confirmado_at;
update public.roles
   set permisos = (coalesce(permisos, '{}'::jsonb) - 'productivo.ordenes.nuevo-lote')
                  || jsonb_build_object('productivo.lotes.nuevo', 'escritura')
 where id = 'pruebas';
commit;
