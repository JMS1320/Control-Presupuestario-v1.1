-- Deshace scripts/82 (A-FEAT-1259): dias_trabajados vuelve a INTEGER.
-- ⚠️ Un medio día cargado (10,5) se REDONDEA al volver a entero: mirar antes si hay alguno
--    (select * from sueldos.periodos where dias_trabajados <> trunc(dias_trabajados)).
begin;
drop view public.sueldos_periodos;
alter table sueldos.periodos alter column dias_trabajados type integer using round(dias_trabajados)::integer;
create view public.sueldos_periodos as
 SELECT id, empleado_id, campana_id, anio, mes, fecha_inicio_periodo, fecha_fin_periodo, bruto_calculado, sueldo_x_ipc,
    sueldo_pagado, anticipos_descontados, saldo_pendiente, estado, observaciones, created_at, monto_a, monto_b,
    francos_cantidad, valor_por_dia, dias_trabajados, valor_por_hora, horas_mes, varios, valor_franco, vacaciones,
    premio, aguinaldo_a, aguinaldo_b, cuota_alimentaria
   FROM sueldos.periodos;
revoke all on public.sueldos_periodos from anon;
grant select, insert, update, delete, truncate, references, trigger on public.sueldos_periodos to authenticated;
grant select, insert, update, delete, truncate, references, trigger on public.sueldos_periodos to service_role;
commit;
notify pgrst, 'reload schema';
