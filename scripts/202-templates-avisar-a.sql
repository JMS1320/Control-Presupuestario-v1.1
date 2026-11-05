-- 📜 Script 202 — A-FEAT-1543: a quién le vence cada template («Lo que te vence» en el Principal).
-- Pedido de JMS (05/11, camino 3): «MA sólo debería tener un principal que le diga que hoy le vence autónomos por
-- ejemplo, y ABL Libertad… deberá poder decir que pagó, default fecha de ahora, editable con detalle; siempre paga
-- desde sus cuentas, sobre todo la principal» → «ok a todo, adelante».
--
-- Por qué una columna y no «todo lo que tiene responsable MA»: con ese criterio le aparecían ~30 cuotas «vencidas»
-- de 2025-26 (Internet NZ, Seguro Chalet, Red Vial…) que están pagadas y sólo falta conciliar. La lista de cada persona
-- es lo que se le ASIGNA. Se asigna desde Configuración → Quién recibe qué; vacío = no le avisa a nadie.
-- La copia el generador de campaña nueva (clona la fila entera), así que pasa sola al año siguiente.
--
-- Verificado antes de escribir esto (05/11): la columna NO existe (ninguna parecida a «avis*»), y ninguna vista public.*
-- se arma sobre egresos_sin_factura. Los GRANT de la tabla alcanzan a la columna nueva. Sin cambios de RLS ni permisos.
-- Aviso a Javier: ENTRE-DESARROLLADORES 05/11. Deshacer: 202-templates-avisar-a-deshacer.sql

begin;

alter table public.egresos_sin_factura add column if not exists avisar_a text[] not null default '{}';
comment on column public.egresos_sin_factura.avisar_a is
  'A-FEAT-1543 [script 202]: mails de las personas a las que les vence este template (bloque «Lo que te vence» del Principal; pueden marcarlo pagado)';

-- Control: la columna existe y nace vacía en todas las filas (no se asigna nada acá: lo asigna JMS desde la app).
do $$ begin
  if (select count(*) from public.egresos_sin_factura where cardinality(avisar_a) > 0) <> 0 then
    raise exception 'la columna avisar_a no nació vacía';
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
