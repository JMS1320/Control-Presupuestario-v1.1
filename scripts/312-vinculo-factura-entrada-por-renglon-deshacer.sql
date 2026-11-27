-- Deshace el [script 312]. Las seis columnas no existían antes del 312 (verificado el 27/11), así que se pueden quitar enteras.
-- ⚠️ Se pierde la huella de los vínculos hechos desde la 🧾 (lo que tenían las entradas antes): deshacerlos ANTES desde la 🧾 si hace falta.
begin;
alter table productivo.entrega_factura drop column if exists renglon_n, drop column if exists automatico, drop column if exists antes,
  drop column if exists revisado_at, drop column if exists revisado_por;
alter table public.factura_renglones drop column if exists no_vincular_solo;
commit;
