-- 158 · EL $ 1 DE PRUEBA A WILSON (DATOS) — ✅ corrido el 01/11/2026 con OK de JMS en su tarea («que quede que se le pagó un
-- peso de más, que es la realidad»).
--
-- Qué hizo: (1) un pago de $ 1 (anticipo, banco, conciliado) en el sueldo de MARZO 2026 de Wilson Barreto
-- (sueldos.pagos id aaddce15-876c-4edb-b6fd-5d864f7edc8a); (2) concilió contra él el movimiento de Galicia del 25/03/2026
-- de $ 1 (msa_galicia id 3014cf6c-4868-49de-9ab7-28211fde2678): CATEG Sueldos, centro ESTRUCTURA, detalle de prueba.
-- Efecto buscado: marzo de Wilson queda pagado $ 1 de más (es lo que pasó).

with nuevo as (
  insert into sueldos.pagos (id, periodo_id, empleado_id, tipo, fecha, monto, estado, medio_pago, descripcion, visible_contable)
  values ('aaddce15-876c-4edb-b6fd-5d864f7edc8a', 'e3ecfc9d-4ac1-4d62-9ad2-22639da95a13', '508fa845-9608-42d3-a47d-8fdbcac3069e', 'anticipo', '2026-03-25', 1,
          'conciliado', 'banco', 'Prueba de funcionamiento: transferencia de $ 1 (pagado de más) [tarea JMS 01/11]', false)
  returning id)
update public.msa_galicia g set sueldo_pago_id = (select id from nuevo), estado = 'conciliado', categ = 'Sueldos', centro_de_costo = 'ESTRUCTURA',
  detalle = 'Prueba de funcionamiento — $ 1 de más a Wilson (sueldo marzo 2026)'
 where g.id = '3014cf6c-4868-49de-9ab7-28211fde2678' and g.estado = 'pendiente';
