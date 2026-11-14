-- Deshace el 276: vuelve los 8 importes y el detalle/origen como estaban (por id).
begin;
update public.balance_foto_valores v set importe = n.antes, origen = n.origen, detalle = n.detalle, updated_at = now()
from (values
 ('912c91d2-869f-4aa1-b567-9e3556c220fc'::uuid, 5299830::numeric, 'planilla', null::text),
 ('0159d6be-a21c-4c54-b4f1-0a1e976205a8', 26894811.38, 'planilla', null),
 ('08ceac20-6045-4a25-b400-1d0aab629906', 5660415.43, 'planilla', null),
 ('f9c8d236-cd86-45b9-92c4-a5ec700d8692', 3830287.5, 'planilla', null),
 ('9369c1bc-d721-4b57-a256-1a060eeff692', 6522697.9, 'manual', '[script 273] PENDIENTE tuyo: el conteo al cierre — mientras, neutro'),
 ('db664ddf-85b6-4542-b973-65e72c600f50', 33100444.66, 'manual', '[script 273] PENDIENTE tuyo: el conteo al cierre — mientras, neutro'),
 ('49e95ba5-c4ae-4955-8b31-e01fb99ac172', 6966483.8, 'manual', '[script 273] PENDIENTE tuyo: falta el precio de los insumos aplicados y la tarifa de labores (papel 3 Sementeras) — mientras, neutro'),
 ('d2179050-875d-45af-9957-eee6f9ee2eee', 4714077.29, 'manual', '[script 273] PENDIENTE tuyo: ídem — mientras, neutro')
) as n(id, antes, origen, detalle)
where v.id = n.id and v.detalle like '[script 276]%';
commit;
