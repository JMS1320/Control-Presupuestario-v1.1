-- 🔙 DESHACER 68 — saca las 6 columnas de la liquidación de hacienda.
-- ⚠️ Escrito ANTES de correr el 68. Y con un freno: si ya hay liquidaciones de hacienda cargadas
-- (tipo 60/61), NO se deshace — borrar la columna borraría sus datos. Primero se mira, después se
-- decide (§ 🛑 Datos: nada destructivo, nunca).

do $$
declare n int;
begin
  select (select count(*) from msa.comprobantes_venta where tipo_comprobante in (60, 61))
    into n;
  if n > 0 then
    raise exception 'Hay % liquidaciones de hacienda cargadas: deshacer borraría sus datos. No se toca nada.', n;
  end if;
end $$;

begin;
alter table msa.comprobantes_venta drop column if exists cabezas, drop column if exists hacienda_lineas,
  drop column if exists redondeo, drop column if exists nro_guia, drop column if exists dte, drop column if exists plazos;
commit;
