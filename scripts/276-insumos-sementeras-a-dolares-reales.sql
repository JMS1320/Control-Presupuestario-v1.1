-- 276 · A-FEAT-1190 (JMS 14/11: «sí… si los dólares son los mismos estamos sin dif»). Insumos y sementeras del balance propio (versión JMS):
-- su origen es en DÓLARES (planilla BAPU), y los pesos de la foto del 30/06/25 estaban calculados con el dólar billete 1.215. Desde el script 273
-- el dólar de esa foto es 1.200,50 (promedio de divisas), así que esos pesos mostraban más dólares de los reales (ej. US$ 4.415 en vez de 4.362).
-- Se pasan a pesos con el dólar de cada punta, manteniendo los US$ reales: 30/06/25 × 1.200,50 y 30/06/26 (neutro, mismos US$) × 1.477,50.
-- La ganancia NO cambia (neutros: variación en US$ = 0 antes y después). Huella del valor anterior en «detalle».
-- Deshacer: 276-insumos-sementeras-a-dolares-reales-deshacer.sql
-- ✅ CORRIDO 14/11/2026 con OK de JMS: 8 filas; la ganancia leída de la base sigue en US$ 260.893 (controles 0).
begin;
update public.balance_foto_valores v set importe = n.nuevo, origen = 'manual',
  detalle = concat_ws(' · ', '[script 276] antes: ' || n.antes || ' (pesos con dólar 1.215). Ahora US$ ' || n.usd || ' × ' || n.tc, v.detalle), updated_at = now()
from (values
 ('912c91d2-869f-4aa1-b567-9e3556c220fc'::uuid, 5299830::numeric,     5236581::numeric,     '4.362,00',  '1.200,50'),
 ('0159d6be-a21c-4c54-b4f1-0a1e976205a8',       26894811.38,          26573844.5,           '22.135,65', '1.200,50'),
 ('08ceac20-6045-4a25-b400-1d0aab629906',       5660415.43,           5592863.15,           '4.658,78',  '1.200,50'),
 ('f9c8d236-cd86-45b9-92c4-a5ec700d8692',       3830287.5,            3784576.25,           '3.152,50',  '1.200,50'),
 ('9369c1bc-d721-4b57-a256-1a060eeff692',       6522697.9,            6444855,              '4.362,00',  '1.477,50'),
 ('db664ddf-85b6-4542-b973-65e72c600f50',       33100444.66,          32705418.78,          '22.135,65', '1.477,50'),
 ('49e95ba5-c4ae-4955-8b31-e01fb99ac172',       6966483.8,            6883344.69,           '4.658,78',  '1.477,50'),
 ('d2179050-875d-45af-9957-eee6f9ee2eee',       4714077.29,           4657818.75,           '3.152,50',  '1.477,50')
) as n(id, antes, nuevo, usd, tc)
where v.id = n.id and v.version = 'jms' and v.importe = n.antes;
do $$ begin
  if (select count(*) from public.balance_foto_valores where detalle like '[script 276]%') <> 8 then raise exception '276: no quedaron las 8 filas'; end if;
end $$;
commit;
