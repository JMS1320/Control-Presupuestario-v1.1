-- Deshace 105 · vuelve las 8 filas de templates y la regla CHUBB a la FOTO del 2026-10-25 (valores escritos acá).
-- Sólo pisa una columna si todavía tiene el valor que puso el 105: si alguien la cambió después, se deja y se avisa.

begin;

-- A · Consumos MA
update public.egresos_sin_factura set año = null, template_origen_id = null
 where id = '79c4229e-288c-40a1-98a0-da24482b3eeb' and año = '2026';
-- B · Gastos Medicos (MA)
update public.egresos_sin_factura set año = null, template_origen_id = null
 where id = '930e624d-b74b-4430-ad00-743c6ba02923' and año = '2026';
-- C · Seguro Chalet + regla CHUBB de la tarjeta de MSA
update public.egresos_sin_factura set categ = 'Seguro Chalet', centro_costo = 'Estructura', proveedor = null, template_origen_id = null
 where id = '2bdfc04c-9ed1-4a55-9e9c-9c5997f65640' and categ = 'SEGUROS ESTRUCTURA' and centro_costo = 'Chalet';
update public.reglas_conciliacion set categ = 'Seguro Chalet'
 where id = '0e1f115f-54f5-4864-af69-32515b95ed44' and categ = 'SEGUROS ESTRUCTURA';
-- D · Libertad 2026 vuelven a PAM
update public.egresos_sin_factura set responsable = 'PAM', template_origen_id = null
 where id in ('11921930-21d4-4867-9b6f-c01de2247ad4', '6563c6a5-9a45-4051-8080-7ff51baa7993', 'c0acd49c-9b7f-44fb-9459-4839a7b800d6')
   and responsable = 'MA';
update public.egresos_sin_factura set responsable = 'PAM', categ = 'Fijos Libertad', template_origen_id = null
 where id = '3c7911fd-8cc9-4df7-974f-d8fc3adf8eec' and responsable = 'MA' and categ = 'GAS';
update public.egresos_sin_factura set responsable = 'PAM'
 where id = '8d52aacd-885f-435b-b811-9882fb0f6d25' and responsable = 'MA';

-- Control: tiene que coincidir con la foto (año vacío en A/B; Seguro Chalet/Estructura; Libertad en PAM)
select id, nombre_referencia, responsable, año, categ, centro_costo, proveedor, template_origen_id
  from public.egresos_sin_factura
 where id in ('79c4229e-288c-40a1-98a0-da24482b3eeb', '930e624d-b74b-4430-ad00-743c6ba02923', '2bdfc04c-9ed1-4a55-9e9c-9c5997f65640',
              '11921930-21d4-4867-9b6f-c01de2247ad4', '3c7911fd-8cc9-4df7-974f-d8fc3adf8eec', '6563c6a5-9a45-4051-8080-7ff51baa7993',
              'c0acd49c-9b7f-44fb-9459-4839a7b800d6', '8d52aacd-885f-435b-b811-9882fb0f6d25')
 order by nombre_referencia;
select categ from public.reglas_conciliacion where id = '0e1f115f-54f5-4864-af69-32515b95ed44';

commit;
