-- 133 · A-FEAT-1422 (8) — MA (ARECO, María de las Mercedes) como empleada de MSA en Sueldos.
-- Fuente: «Sueldos/Recibos - SUSS/» (recibos e Informe de Liquidación de MSA, legajo 1254, CUIL 27-06682461-1,
-- Gerente General desde el 01/06/2025, contratación LRT directores: sin aportes, neto = bruto = $ 1.500.000).
-- JMS 29/10: «ella cobra pero no por recibo, es una cuenta corriente y esto entra dentro de su cuenta corriente.
-- Marcá el recibo como entero a pagar por MSA. Cargas sociales se imputan como cargas sociales. En sueldos debe
-- ser lo que cobra en mano MA.» → cada mes queda con TODO el saldo pendiente (nada pagado).
-- Meses: como el alta de la app, en las campañas 25/26 y 26/27 (jul-25 → jun-27), estado «proyectado».
-- Aguinaldo A $ 750.000 en diciembre y junio (recibos SAC 2do 25 y SAC 1er 26; los futuros, proyectados).
-- El SAC 1er 25 ($ 125.000, pagado 07/2025) es del ejercicio 24/25: no se carga.
-- Deshacer: 133-sueldo-ma-msa-deshacer.sql (borra sólo el empleado de id fijo y sus meses marcados).
begin;
insert into sueldos.empleados (id, nombre, tipo_empleado, empresa, cuit_empleado, activo, fecha_ingreso, sueldo_presupuesto)
select '81ef3d7c-37d3-461a-8c46-400935a81b26', 'MA', 'plano_ipc', 'MSA', '27-06682461-1', true, '2025-06-01', 1500000
where not exists (select 1 from sueldos.empleados where cuit_empleado in ('27-06682461-1','27066824611'));

insert into sueldos.periodos (empleado_id, campana_id, anio, mes, fecha_inicio_periodo, fecha_fin_periodo,
  bruto_calculado, sueldo_x_ipc, anticipos_descontados, saldo_pendiente, estado, monto_a, aguinaldo_a, varios, observaciones)
select '81ef3d7c-37d3-461a-8c46-400935a81b26', c.id, extract(year from d)::int, extract(month from d)::int, d::date, (d + interval '1 month - 1 day')::date,
  1500000 + case when extract(month from d) in (6,12) then 750000 else 0 end, 1500000, 0,
  1500000 + case when extract(month from d) in (6,12) then 750000 else 0 end,
  'proyectado', 1500000, case when extract(month from d) in (6,12) then 750000 else null end, 0,
  '[script 133] ' || case when d <= '2026-09-01' then 'recibo MSA legajo 1254' else 'proyectado' end
    || ' · no se paga por recibo: va a su cuenta corriente (a pagar por MSA)'
from generate_series('2025-07-01'::date, '2027-06-01'::date, interval '1 month') d
join sueldos.campanas c on d::date between c.fecha_inicio and c.fecha_fin
where exists (select 1 from sueldos.empleados where id = '81ef3d7c-37d3-461a-8c46-400935a81b26');
commit;
