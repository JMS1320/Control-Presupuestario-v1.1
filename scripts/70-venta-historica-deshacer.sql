-- 🔙 DESHACER 70 — saca la marca de venta histórica.
-- ⚠️ Con freno: si ya hay ventas marcadas como históricas, NO se deshace — perderían la marca y
-- pasarían a parecer ventas sin su movimiento de stock (§ 🛑 Datos: nada destructivo).

do $$
declare n int;
begin
  select count(*) into n from productivo.stock_ventas where historica;
  if n > 0 then
    raise exception 'Hay % ventas históricas: deshacer les borraría la marca. No se toca nada.', n;
  end if;
end $$;

alter table productivo.stock_ventas drop column if exists historica;
