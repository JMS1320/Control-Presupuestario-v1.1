-- =====================================================================================
-- 117 · LA CUOTA QUE QUEDA EN DÓLARES — `public.cuotas_arrendamiento.en_dolares` (A-FEAT-1393)
-- =====================================================================================
-- Decisión de JMS 2026-10-27: la 2B de Sanpa 25/26 (2 qq/ha, u$s 14.244,12) se cobró EN DÓLARES, EN
-- EFECTIVO, y en el contrato se marcan las cuotas que «quedan en dólares» para que el Cash Flow no las
-- espere en pesos en el banco. El presupuesto las sigue contando como ingreso.
--
-- QUÉ HACE:
--   1. Columna nueva `en_dolares boolean not null default false` (verificado el 27/10: no existía).
--   2. Datos: la marca en las dos cuotas de 2 qq/ha de Sanpa que hoy están en la app — 26/27 cuota 3
--      (a7e6c9fd…, ya fijada a u$s 365) y 27/28 cuota 3 (7923c7f4…). Las demás quedan en false.
-- Deshacer: scripts/117-cuota-en-dolares-deshacer.sql
-- =====================================================================================
begin;

alter table public.cuotas_arrendamiento add column if not exists en_dolares boolean not null default false;
comment on column public.cuotas_arrendamiento.en_dolares is
  '[script 117] La cuota se cobra en dólares y no se pesifica (A-FEAT-1393): el presupuesto la cuenta como ingreso, pero el Cash Flow no la espera en pesos en el banco.';

-- Foto: las dos cuotas tienen que ser las de 2 qq/ha de Sanpa.
do $$
begin
  if (select count(*) from public.cuotas_arrendamiento c join public.contratos_arrendamiento k on k.id = c.contrato_id
       where c.id in ('a7e6c9fd-6be5-4bdd-8223-344d174b078b','7923c7f4-222b-4440-b947-7a55ff71bd90')
         and k.cliente_cuit = '30712200622' and c.qq_ha_cuota = 2) <> 2
  then raise exception '117: las 2 cuotas de Sanpa no están como en la foto'; end if;
end $$;

update public.cuotas_arrendamiento set en_dolares = true
 where id in ('a7e6c9fd-6be5-4bdd-8223-344d174b078b','7923c7f4-222b-4440-b947-7a55ff71bd90');

do $$
begin
  if (select count(*) from public.cuotas_arrendamiento where en_dolares) <> 2
  then raise exception '117: esperaba 2 cuotas en dólares'; end if;
end $$;

commit;
