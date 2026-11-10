-- 245 · ITGB de la sucesión pagado desde la CAJA AMS como retiro de los COTITULARES + template nuevo «Retiros Cotitulares» (DATOS) — DR4.
-- OK JMS 10/11: «creás la entrada en Caja AMS de esa extracción de MSA y los vincularás. Luego creás el retiro a pago ITGB que será template
-- de Cotitulares. Y el detalle es ITGB Suc PAM 1» · «C4 creá cotitulares» · y la extracción «queda sin código… pero llevará una correspondencia
-- inter caja» (el circuito Galicia → caja General → caja AMS / Sigot / JMS queda como pendiente: A-FEAT-1585).
-- Lo que hace:
--   1. template «Retiros Cotitulares» (MSA, «Retiros / Distribucion Socios», tipo distribución, contable CTA COTITULARES), copiado de «Retiro PAM»;
--   2. su cuota de 1.756.595,00 del 20/08/25, detalle «ITGB Suc PAM 1», conciliada;
--   3. en la caja AMS: la ENTRADA de 1.800.000 (de caja General, la extracción del Galicia MSA) con la nota de correspondencia, y la SALIDA de
--      1.756.595 (ITGB) con CTA COTITULARES, vinculada a la cuota nueva;
--   4. la extracción del Galicia MSA del 20/08/25 deja de llevar «CTA COTITULARES» (es MSA llevando plata a su caja) y anota la correspondencia.
-- Planilla de origen: la caja de JMS (fila 209 «DE CAJA GRAL» 1.800.000 y fila 210 «Ret SUC · ITGB» 1.756.595, 20/08/2025).
-- Foto: scripts/245-foto-antes.json · Deshacer: 245-…-deshacer.sql (borra SÓLO los ids creados acá).
begin;
insert into public.egresos_sin_factura select * from jsonb_populate_record(null::public.egresos_sin_factura,
  (select to_jsonb(e) from public.egresos_sin_factura e where id = '6ac71ff4-6230-4302-a48e-13832f1f91f6') || jsonb_build_object(
    'id', '7a2c1e0e-245a-4c0b-9b1a-c07170000245'::text, 'created_at', now(), 'updated_at', now(),
    'nombre_referencia', 'Retiros Cotitulares'::text, 'categ', 'Retiro Cotitulares'::text, 'codigo_contable', 'CTA COTITULARES'::text,
    'observaciones_template', '[script 245] retiros de los cotitulares (la sucesión: los 5 hermanos)'::text));
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_estimada, fecha_vencimiento, monto, estado, detalle, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('7a2c1e0e-245a-4c0b-9b1a-c07170001245', '7a2c1e0e-245a-4c0b-9b1a-c07170000245', 1, '2025-08-20', '2025-08-20', 1756595.00, 'conciliado',
        'ITGB Suc PAM 1', 'ITGB Suc PAM 1 — pagado de la caja AMS [script 245]', 'egreso', 'banco', false);
insert into msa.caja_ams (id, fecha, descripcion, debitos, creditos, categ, estado, template_id, nota_operador)
values ('7a2c1e0e-245a-4c0b-9b1a-c07170002245', '2025-08-20', 'DE CAJA GRAL — extracción Galicia MSA 20/08/25', 0, 1800000.00, 'CAJA', 'conciliado',
        '5767ce58-807d-4c47-a91f-1dc7fc53e699', '↔ correspondencia: Galicia MSA, extracción del 20/08/25 por $ 1.800.000 (abe11128-25b2-4442-a5ce-086894183e00) [script 245]');
insert into msa.caja_ams (id, fecha, descripcion, debitos, creditos, categ, contable, estado, template_id, template_cuota_id, nota_operador)
values ('7a2c1e0e-245a-4c0b-9b1a-c07170003245', '2025-08-20', 'ITGB Suc PAM 1', 1756595.00, 0, 'Retiro Cotitulares', 'CTA COTITULARES', 'conciliado',
        '7a2c1e0e-245a-4c0b-9b1a-c07170000245', '7a2c1e0e-245a-4c0b-9b1a-c07170001245', 'Ret SUC · ITGB (planilla de caja, fila 210) [script 245]');
update public.msa_galicia set contable = null,
       nota_operador = concat_ws(' · ', nullif(nota_operador, ''), '↔ correspondencia: entra a la caja AMS el 20/08/25 (de caja General); el retiro de cotitulares es el ITGB de $ 1.756.595 pagado de la caja [script 245]')
 where id = 'abe11128-25b2-4442-a5ce-086894183e00' and contable = 'CTA COTITULARES';
commit;
