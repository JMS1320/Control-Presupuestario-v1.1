-- 🔙 DESHACER 69 — saca la columna de la huella.
-- ⚠️ Escrito ANTES de correr el 69, y con freno: si ya hay huellas guardadas, NO se deshace —
-- borrar la columna borraría la historia de las correcciones (§ 🛑 Datos: nada destructivo).

do $$
declare n int;
begin
  select count(*) into n from msa.comprobantes_venta where correcciones is not null;
  if n > 0 then
    raise exception 'Hay % liquidaciones con huella guardada: deshacer la borraría. No se toca nada.', n;
  end if;
end $$;

alter table msa.comprobantes_venta drop column if exists correcciones;
