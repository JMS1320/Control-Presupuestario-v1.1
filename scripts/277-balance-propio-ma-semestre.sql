-- 277 · A-FEAT-1626 (JMS 14/11, B2: semestre de MA 01/01–30/06/26; «OK B1» 15/11). El BALANCE PROPIO de MA, versión JMS:
-- dos fotos NUEVAS (no había ninguna de MA): apertura 31/12/2025 y cierre 30/06/2026, cada una con su dólar (divisas BNA promedio).
-- Criterio de JMS (14/11): ganancia = activo − pasivo · lo que MSA le giró y los giros de PAM son DEUDA de MA hasta que se defina qué es
-- retiro · la factura Provinvest del 30/09/26 va como a cobrar al 30/06/26 · bienes (Libertad, campos) afuera · todo lo de MA, pagado.
-- Sólo INSERTA (no hay nada que pisar). Deshacer: 277-balance-propio-ma-semestre-deshacer.sql (borra sólo lo marcado [script 277]).
-- Control (abajo): A − P = −14.113.767,80 (US$ −9.730,28) → 40.789.515,52 (US$ 27.607,12) · ganancia del semestre US$ 37.337,39.
-- ✅ CORRIDO 15/11/2026 con OK de JMS («Ok b1»), por el MCP de Supabase (correr-sql no tiene clave). Control en la base: 7 renglones, A − P y ganancia US$ 37.337,39 ✓.
begin;
insert into public.balance_fotos (empresa, fecha_cierre, tc, tc_fuente, notas)
select 'MA', v.fecha::date, v.tc, v.fuente, v.notas from (values
  ('2025-12-31', 1450.5, 'BNA divisas promedio comprador/vendedor 31/12/25 (1.446 / 1.455)', '[script 277] Apertura del semestre de MA (01/01–30/06/26): MA no tuvo ingresos genuinos antes (JMS 14/11). Bienes afuera.'),
  ('2026-06-30', 1477.5, 'BNA divisas promedio comprador/vendedor 30/06/26 (1.473 / 1.482)', '[script 277] Cierre del semestre de MA. Ganancia = activo − pasivo (JMS 14/11). Bienes afuera.')
) as v(fecha, tc, fuente, notas)
where not exists (select 1 from public.balance_fotos f where f.empresa = 'MA' and f.fecha_cierre = v.fecha::date);

insert into public.balance_foto_valores (foto_id, renglon, version, importe, origen, detalle)
select f.id, v.renglon, 'jms', v.importe, v.origen, v.detalle
from (values
  ('2025-12-31', 'banco_galicia', 5281660.39, 'sistema', '[script 277] Galicia CA $ MA 4.437.905,06 + Galicia CA ANSES $ MA 843.755,33 (saldos de los extractos al 31/12/25)'),
  ('2025-12-31', 'tarjetas', 2731208.18, 'sistema', '[script 277] VISA Galicia MA: consumos del resumen abierto $ 2.693.756,27 + US$ 25,82 × 1.450,50'),
  ('2025-12-31', 'otras_deudas_comerciales', 16664220.01, 'sistema', '[script 277] cuenta con MSA 1.664.220,01 (14.1 de MSA al 31/12/25, inicio 30/06/25 = 0) + cuenta con PAM 15.000.000 (giros «Retiro MA mensual PAM»): deuda hasta que se defina qué es retiro (JMS 14/11)'),
  ('2026-06-30', 'banco_galicia', 21899275.38, 'sistema', '[script 277] Galicia CA $ MA 21.899.275,38 + CA ANSES 0 (último movimiento 20/03/26)'),
  ('2026-06-30', 'deudores_ventas', 87895350, 'manual', '[script 277] factura Provinvest del 30/09/26: arrendamiento a cobrar al 30/06/26 (JMS 14/11). La Fac C del 30/07/26 ($ 2.568.943,56) es del semestre siguiente'),
  ('2026-06-30', 'tarjetas', 3295771.69, 'sistema', '[script 277] VISA Galicia MA: consumos del resumen abierto $ 3.257.489,66 + US$ 25,91 × 1.477,50'),
  ('2026-06-30', 'otras_deudas_comerciales', 65709338.17, 'sistema', '[script 277] cuenta con MSA 44.459.338,17 (= saldo de la 14.1 de MSA al 30/06/26) + cuenta con PAM 21.250.000 (giros «Retiro MA mensual PAM»): deuda hasta que se defina qué es retiro (JMS 14/11)')
) as v(fecha, renglon, importe, origen, detalle)
join public.balance_fotos f on f.empresa = 'MA' and f.fecha_cierre = v.fecha::date
where not exists (select 1 from public.balance_foto_valores x where x.foto_id = f.id and x.renglon = v.renglon and x.version = 'jms');

do $$
declare a0 numeric; a1 numeric; g numeric;
begin
  if (select count(*) from public.balance_foto_valores v join public.balance_fotos f on f.id = v.foto_id where f.empresa = 'MA' and v.detalle like '[script 277]%') <> 7 then raise exception '277: no quedaron los 7 renglones'; end if;
  -- A − P de cada punta (activo: bancos y deudores · pasivo: tarjeta y cuentas con MSA/PAM)
  select sum(case when v.renglon in ('banco_galicia','deudores_ventas') then v.importe else -v.importe end) into a0
    from public.balance_foto_valores v join public.balance_fotos f on f.id = v.foto_id where f.empresa = 'MA' and f.fecha_cierre = '2025-12-31' and v.version = 'jms';
  select sum(case when v.renglon in ('banco_galicia','deudores_ventas') then v.importe else -v.importe end) into a1
    from public.balance_foto_valores v join public.balance_fotos f on f.id = v.foto_id where f.empresa = 'MA' and f.fecha_cierre = '2026-06-30' and v.version = 'jms';
  if a0 <> -14113767.80 or a1 <> 40789515.52 then raise exception '277: A − P no da (% / %)', a0, a1; end if;
  g := round(a1 / 1477.5 - a0 / 1450.5, 2);
  if g <> 37337.39 then raise exception '277: la ganancia en US$ da %', g; end if;
end $$;
commit;
