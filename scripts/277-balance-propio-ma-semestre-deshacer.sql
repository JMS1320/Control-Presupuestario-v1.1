-- Deshace el 277: borra SÓLO lo que creó (renglones marcados [script 277] y las dos fotos de MA si quedan vacías y son del 277).
-- Antes del 277 no había ninguna foto de MA (verificado 15/11: sólo MSA 2024, 2025 y 2026).
begin;
delete from public.balance_foto_valores where detalle like '[script 277]%'
  and foto_id in (select id from public.balance_fotos where empresa = 'MA' and fecha_cierre in ('2025-12-31', '2026-06-30'));
delete from public.balance_fotos where empresa = 'MA' and fecha_cierre in ('2025-12-31', '2026-06-30') and notas like '[script 277]%'
  and not exists (select 1 from public.balance_foto_valores v where v.foto_id = balance_fotos.id);
commit;
