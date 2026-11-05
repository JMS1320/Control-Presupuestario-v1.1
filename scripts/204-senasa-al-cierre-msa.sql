-- 204 · A-FEAT-1541: el stock de SENASA al CIERRE (30/06/2026) en la pantalla de Hacienda (papel «hacienda.saldos», columna SENASA
-- al cierre), para que el control contra SENASA del papel 02 compare. OK de JMS 05/11: «sí, cargá el stock que tiene SENASA de
-- acuerdo al PDF que te había pasado. Adelante».
-- Fuente: SENASA «Histórico de stock a fecha determinada» al 30/06/2026 (RENSPA 01.107.0.00669/00, PDF en Balance/- Enviados/2026):
-- Vaca 184 · Vaquillona 110 · Toro 16 · Torito/MEJ 16 · Novillito 91 = 417 (hembras 294, machos 123).
-- SENASA no tiene CUT, vaquillona de 1ª parición ni terneros: van en 0. Marca '[script 204]'. Frena si ya hay SENASA al cierre.
do $$
begin
  if exists (select 1 from public.balance_datos_usuario where empresa='MSA' and anio_cierre=2026 and papel='hacienda.saldos' and clave like 'cierre.senasa.%') then
    raise exception 'ya hay SENASA al cierre cargado: no se pisa';
  end if;
  insert into public.balance_datos_usuario (empresa, anio_cierre, papel, clave, texto, valor, historial, actualizado_por)
  select 'MSA', 2026, 'hacienda.saldos', 'cierre.senasa.' || k, n::text, n, '[]'::jsonb,
         '[script 204] Claude · SENASA «Histórico de stock a fecha determinada» al 30/06/2026 (OK de JMS 05/11)'
  from (values ('vacas',184),('vaq-1ra',0),('cut',0),('toros',16),('toritos',16),('vaquillonas',110),('novillitos',91),('terneros',0)) as t(k, n);
end $$;
