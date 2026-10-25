-- Deshace 102 · vuelve el check de columna_busqueda a los 4 valores de antes (A-FEAT-1362).
--
-- Sólo si el check lleva la marca '[script 102]' (lo creó el 102) y NINGUNA regla usa 'nombre' o 'texto':
-- si hay reglas que las usan, se frena — borrarlas o cambiarlas es decisión del usuario, no de este script.

-- Control previo (sólo lee): las reglas que usan las columnas nuevas.
select id, cuenta_bancaria_id, columna_busqueda, texto_buscar from public.reglas_conciliacion
where columna_busqueda in ('nombre', 'texto');

begin;

do $$
declare
  marca text;
  usadas int;
begin
  select obj_description(oid, 'pg_constraint') into marca from pg_constraint
  where conrelid = 'public.reglas_conciliacion'::regclass and conname = 'reglas_conciliacion_columna_busqueda_check';
  if marca is null or position('[script 102]' in marca) = 0 then
    raise exception 'El check no tiene la marca [script 102]: no lo creó el 102. No se toca.';
  end if;
  select count(*) into usadas from public.reglas_conciliacion where columna_busqueda in ('nombre', 'texto');
  if usadas > 0 then
    raise exception 'Hay % regla(s) que buscan por nombre/texto: el deshacer las dejaría inválidas. Se frena.', usadas;
  end if;

  alter table public.reglas_conciliacion drop constraint reglas_conciliacion_columna_busqueda_check;
  alter table public.reglas_conciliacion add constraint reglas_conciliacion_columna_busqueda_check
    check (columna_busqueda = any (array['descripcion', 'cuit', 'monto_debito', 'monto_credito']));
end $$;

commit;
