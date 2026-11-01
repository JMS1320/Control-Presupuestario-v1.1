-- Deshace 168 · el movimiento vuelve exactamente a como estaba (atado al pago de Sigot por caja, a auditar).
update public.msa_galicia
   set sueldo_pago_id = '566df873-229a-4f51-9b0b-132401d9fc85', estado = 'auditar', detalle = null,
       contable = '', interno = '', comprobantes_pagados = null, motivo_revision = 'Fecha no exacta: 3 días diferencia'
 where id = '6dc505bc-371d-4246-ae4a-277f77d83b0b' and sueldo_pago_id = '9954c5fc-9736-4bfc-a463-e2285e39672e';
