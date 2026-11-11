-- Deshace [script 264]. Las dos columnas las creó el script 264 (no existían antes: verificado el 11/11), así que borrarlas
-- no pierde ningún dato previo. Se pierde lo cargado en ellas después (el día de pago de cada proveedor).
alter table public.proveedores drop column if exists pago_dia_mes;
alter table public.proveedores drop column if exists pago_dias_emision;
