-- 102 · REGLAS DE CONCILIACIÓN QUE BUSCAN POR «NOMBRE / COMERCIO» Y POR «TEXTO DEL BANCO» (A-FEAT-1362)
--
-- Usuario 2026-10-25: «si el comercio es identificado y es pescadería Napoli es bastante claro ese método
-- para hacer reglas, o sea en base al comercio, CUIT, etc.» — y «adelante» al cambio.
--
-- QUÉ HACE: amplía el check `reglas_conciliacion_columna_busqueda_check` para aceptar dos valores más:
--   · 'nombre' → busca en el Nombre / comercio que desglosa el parseo (leyendas_adicionales_1).
--   · 'texto'  → busca en todo el texto del banco (concepto, descripción y lo desglosado).
-- Los 4 valores de antes siguen igual. No toca filas, RLS, GRANTs ni políticas.
--
-- 🛑 Aviso a Javier en ENTRE-DESARROLLADORES.md ANTES de correrlo. Lo corre T1 con el OK del usuario.
--
-- VERIFICADO EN LA BASE, por el propio script: si el check ya no es el de 4 valores (alguien lo cambió),
-- se frena sin tocar nada.
--
-- Deshacer: 102-reglas-columna-nombre-texto-deshacer.sql

begin;

do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint
  where conrelid = 'public.reglas_conciliacion'::regclass and conname = 'reglas_conciliacion_columna_busqueda_check';
  if def is null then
    raise exception 'No existe reglas_conciliacion_columna_busqueda_check: no se corre el 102.';
  end if;
  if position('nombre' in def) > 0 or position('texto' in def) > 0 then
    raise exception 'El check ya incluye nombre/texto: no se corre el 102 (no es de este script). Definición: %', def;
  end if;
  if position('descripcion' in def) = 0 or position('monto_credito' in def) = 0 then
    raise exception 'El check no es el esperado (4 valores): no se corre el 102. Definición: %', def;
  end if;
end $$;

alter table public.reglas_conciliacion drop constraint reglas_conciliacion_columna_busqueda_check;
alter table public.reglas_conciliacion add constraint reglas_conciliacion_columna_busqueda_check
  check (columna_busqueda = any (array['descripcion', 'cuit', 'monto_debito', 'monto_credito', 'nombre', 'texto']));

comment on constraint reglas_conciliacion_columna_busqueda_check on public.reglas_conciliacion is
  '[script 102] A-FEAT-1362 — agrega nombre (Nombre / comercio) y texto (Texto del banco).';

commit;

-- ── Control (sólo lee) ──────────────────────────────────────────────────────────────────────────
select pg_get_constraintdef(oid) as definicion, obj_description(oid, 'pg_constraint') as marca
from pg_constraint where conrelid = 'public.reglas_conciliacion'::regclass and conname = 'reglas_conciliacion_columna_busqueda_check';
