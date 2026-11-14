-- 274 · A-FEAT-1627 (JMS 14/11: «cargá vos las 15,12 t de AFA»). Las toneladas de la certificación electrónica de granos de AFA
-- (28/04/2026, N° 42191, C.O.E. 332022543744, soja, peso neto 15.120 kg — PDF «04-28 - Agricultores Federados Argentinos Cert Granos.pdf»),
-- en el papel nuevo «granos.certificaciones» (clave = id del comprobante). Con esto el control de la pantalla compara la cosecha escrita
-- (15,12) contra la certificación. Sólo crea una fila; no toca la cosecha escrita ni la factura.
-- Deshacer: 274-toneladas-certificacion-afa-deshacer.sql
begin;
insert into public.balance_datos_usuario (empresa, anio_cierre, papel, clave, texto, valor, historial, actualizado_por)
select 'MSA', 2026, 'granos.certificaciones', '98cad2ef-cc4d-4574-963b-081c639bd3db', '15,12', 15.12, '[]'::jsonb,
  '[script 274] Claude · certificación AFA 28/04/2026 N° 42191, soja, peso neto 15.120 kg (del PDF; OK de JMS 14/11)'
where not exists (select 1 from public.balance_datos_usuario where empresa = 'MSA' and anio_cierre = 2026 and papel = 'granos.certificaciones' and clave = '98cad2ef-cc4d-4574-963b-081c639bd3db');
do $$ begin
  if (select count(*) from public.balance_datos_usuario where papel = 'granos.certificaciones' and actualizado_por like '[script 274]%' and valor = 15.12) <> 1 then raise exception '274: no quedó la fila'; end if;
end $$;
commit;
