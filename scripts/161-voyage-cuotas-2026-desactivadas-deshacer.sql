-- Deshace 161 · las 6 cuotas 2026 del Voyage vuelven a «pendiente» (sólo las que el 161 pasó a desactivado).
update public.cuotas_egresos_sin_factura set estado = 'pendiente'
 where estado = 'desactivado' and id in ('62e80460-d5d4-43dc-b375-2d1a6558700f', 'b043e304-11df-4e94-b164-a779cbdd8aa5', 'fb3ef6fe-be08-41b6-bde2-d9bcad745c52',
   'adb1c361-4583-4e89-8eb7-6c454f3b5269', '61a1f46d-6dbe-4d86-9559-9252aed821d9', 'a5092b0f-c1f8-4b91-9952-add340a7c188');
