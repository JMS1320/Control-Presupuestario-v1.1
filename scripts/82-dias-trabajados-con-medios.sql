-- 82 · Los días trabajados admiten medio día — A-FEAT-1259 (2026-10-09)
--
-- Pedido del usuario: los que cobran por jornal (Elvio, Vulcano) «la planilla servirá para ver cuántos días
-- trabajaron por mes y multiplicar por el monto diario… si tienen 10,5 días u 11 se computa eso».
-- `sueldos.periodos.dias_trabajados` era INTEGER y la planilla de asistencia admite medio día (½).
--
-- ⚠️ La vista public.sueldos_periodos depende de la columna: Postgres no deja cambiarle el tipo con la vista
-- viva, así que se la recrea con la MISMA definición y se le devuelven los MISMOS permisos (un drop + create
-- pierde los GRANTs — § CLAUDE.md, la propagación del dato). Nada a anon, como antes.
-- No cambia ningún dato: un entero pasa a numeric igual. Avisado a Javier antes.

begin;

drop view public.sueldos_periodos;

alter table sueldos.periodos alter column dias_trabajados type numeric using dias_trabajados::numeric;

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
