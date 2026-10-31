-- 145 · Las VENTAS de lo presentado a ARCA, guardadas — A-FEAT-1439 (2026-10-31).
--
-- JMS 31/10, sobre el recorrido del balance: «siempre con la posibilidad de ver lo objetivo, no sólo tu propuesta. Lo
-- objetivo en este caso es el print de ARCA como está declarado». `public.ddjj_presentadas` (script 107) guarda el libro
-- IVA de cada mes, pero SÓLO las compras: las ventas del mismo zip (comprobantes_ventas.csv + el bloque de ventas del
-- XML) se leían y se tiraban. Este script agrega dos columnas para guardarlas; el recorrido las muestra como la fuente.
--
-- QUÉ HACE: agrega dos columnas VACÍAS (no toca ninguna fila, ni RLS, ni permisos — la tabla ya es admin/contable):
--   ventas          jsonb  — cada venta declarada (mismo formato que `comprobantes`, el de las compras)
--   totales_ventas  jsonb  — los totales de ventas del libro_iva.xml (para el control CSV contra XML)
-- 🛡️ Si cualquiera de las dos ya existiera, NO se corre (así el deshacer, que las borra, sólo borra las que creó éste).
-- 🛑 Antes de correr: aviso a Javier en ENTRE-DESARROLLADORES.md (estructura) y OK de JMS.

begin;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ddjj_presentadas'
             and column_name in ('ventas', 'totales_ventas')) then
    raise exception 'public.ddjj_presentadas ya tiene ventas / totales_ventas: no se corre. Avisar antes de seguir.';
  end if;
end $$;

alter table public.ddjj_presentadas add column ventas jsonb;
alter table public.ddjj_presentadas add column totales_ventas jsonb;
comment on column public.ddjj_presentadas.ventas is
  '[script 145] A-FEAT-1439 — las ventas declaradas en el libro IVA (comprobantes_ventas.csv). NULL = se guardó antes de que existiera esta columna.';
comment on column public.ddjj_presentadas.totales_ventas is
  '[script 145] A-FEAT-1439 — los totales de ventas del libro_iva.xml (control CSV contra XML).';

commit;
notify pgrst, 'reload schema';
