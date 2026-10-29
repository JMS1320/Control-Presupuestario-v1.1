-- Deshace el script 133: sólo el empleado de id fijo y sus meses marcados [script 133].
begin;
delete from sueldos.periodos where empleado_id = '81ef3d7c-37d3-461a-8c46-400935a81b26' and observaciones like '[script 133]%';
delete from sueldos.empleados where id = '81ef3d7c-37d3-461a-8c46-400935a81b26' and not exists (select 1 from sueldos.periodos where empleado_id = '81ef3d7c-37d3-461a-8c46-400935a81b26');
commit;
