-- 168 · ALONDRA 29/05/2026 — el movimiento al pago correcto (DATOS) — A-BUG-1486 caso 1 — OK de JMS en el tema del
-- recorrido 01/11 («perfecto entonces hacelo vos… te dejo a ti el cambio»).
--
-- Qué estaba mal: el movimiento de MSA Galicia del 29/05/2026 ($ 110.000 a Alondra Aylin Olivo, CUIT 27479260880) estaba
-- «a auditar» y atado por error al pago de SIGOT por caja (sueldos.pagos 566df873…, 01/06, caja_sigot, programado). El
-- anticipo de ALONDRA del 29/05 por banco (9954c5fc…) figuraba conciliado sin movimiento.
-- Qué hace: ata el movimiento al anticipo de Alondra y lo concilia con los mismos datos que sus otros anticipos de mayo
-- (Sueldos · ESTRUCTURA · RET 3 MA / DIST MA · «Anticipo May 2026»). El pago de Sigot por caja no se toca.
update public.msa_galicia
   set sueldo_pago_id = '9954c5fc-9736-4bfc-a463-e2285e39672e', estado = 'conciliado', detalle = 'Anticipo May 2026',
       contable = 'RET 3 MA', interno = 'DIST MA', comprobantes_pagados = 'Anticipo May 2026', motivo_revision = null
 where id = '6dc505bc-371d-4246-ae4a-277f77d83b0b' and sueldo_pago_id = '566df873-229a-4f51-9b0b-132401d9fc85' and estado = 'auditar';
-- Control: 1 fila, atada a Alondra, conciliada
select g.estado, e.nombre, g.detalle from public.msa_galicia g join sueldos.pagos p on p.id = g.sueldo_pago_id join sueldos.empleados e on e.id = p.empleado_id
 where g.id = '6dc505bc-371d-4246-ae4a-277f77d83b0b';
