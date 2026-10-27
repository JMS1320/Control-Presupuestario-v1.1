-- =====================================================================================
-- 112 · DESHACER — carga de las 2 pólizas ANTERIORES de Federación Patronal (A-FEAT-1385)
-- =====================================================================================
-- La carga (27/10/2026, OK de JMS) se hizo con scripts/112-polizas-anteriores.mts:
--   · flota 32436252 endoso 4 (PDF «04-10 - Federacion.pdf», abr-25) — su cuota 12/12 del 01/07/2025 es el
--     débito de $591.670,04 del 02/07/2025;
--   · AP 9536537 endoso 0 (PDF «05-13 - Federacion Patronal.pdf», may-25) — 12 cuotas de $12.902; las 10 de
--     jul-25 a abr-26 son los débitos del banco.
-- Las dos estaban en «2024-2025 › Seguros › En sistema afip» del Drive. Antes de la carga NO existían en
-- polizas_seguro (verificado). La sincronización corrió SÓLO para esas 2 (las demás tenían 0 cambios).
--
-- Borra SÓLO lo que creó la carga (ids fijos, tomados de la base después de cargar):
--   pólizas 77e04c33… (32436252) y b6ff33ec… (9536537) con sus endosos, cuotas y bienes;
--   templates f995e08d… (flota) y 258a2f69… (AP) con sus cuotas; la regla 2f092310… (copiada de la flota hermana).
-- 🛑 Si algún movimiento del banco ya quedó conciliado contra estos templates, se frena: primero desconciliar.
-- =====================================================================================
begin;

do $$
begin
  if exists (select 1 from public.msa_galicia
             where template_id in ('f995e08d-1f18-4ebc-b077-3b8a1cbbe79b','258a2f69-febb-442e-98e5-177d48242896')
                or template_cuota_id in (select id from public.cuotas_egresos_sin_factura
                                         where egreso_id in ('f995e08d-1f18-4ebc-b077-3b8a1cbbe79b','258a2f69-febb-442e-98e5-177d48242896'))) then
    raise exception 'script 112 deshacer: hay movimientos del banco conciliados contra estos templates — desconciliarlos primero';
  end if;
end $$;

delete from public.reglas_contable_interno where id = '2f092310-76c8-4576-8e94-b179d2e652e8';
delete from public.cuotas_egresos_sin_factura
 where egreso_id in ('f995e08d-1f18-4ebc-b077-3b8a1cbbe79b','258a2f69-febb-442e-98e5-177d48242896');
update public.polizas_seguro set template_id = null
 where id in ('77e04c33-053f-4146-87ce-154b6bc890de','b6ff33ec-560a-4650-b215-690bdeafebf5');
delete from public.egresos_sin_factura
 where id in ('f995e08d-1f18-4ebc-b077-3b8a1cbbe79b','258a2f69-febb-442e-98e5-177d48242896');
delete from public.polizas_cuotas  where endoso_id in (select id from public.polizas_endosos
  where poliza_id in ('77e04c33-053f-4146-87ce-154b6bc890de','b6ff33ec-560a-4650-b215-690bdeafebf5'));
delete from public.polizas_bienes  where endoso_id in (select id from public.polizas_endosos
  where poliza_id in ('77e04c33-053f-4146-87ce-154b6bc890de','b6ff33ec-560a-4650-b215-690bdeafebf5'));
delete from public.polizas_endosos where poliza_id in ('77e04c33-053f-4146-87ce-154b6bc890de','b6ff33ec-560a-4650-b215-690bdeafebf5');
delete from public.polizas_seguro  where id in ('77e04c33-053f-4146-87ce-154b6bc890de','b6ff33ec-560a-4650-b215-690bdeafebf5');

commit;
