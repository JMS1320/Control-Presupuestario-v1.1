-- Deshacer del script 146: borra SÓLO las DDJJ de IVA de MSA que cargó el 146 (marca en cargado_por).
-- Seguro: el 146 se niega a correr si ya había alguna DDJJ de MSA en esos meses, así que todas éstas son suyas.
begin;
delete from public.ddjj_presentadas where empresa = 'MSA' and impuesto = 'IVA' and cargado_por = '[script 146]';
commit;
