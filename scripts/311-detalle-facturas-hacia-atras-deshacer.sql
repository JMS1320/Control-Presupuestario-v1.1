-- [script 311] DESHACER — borra sólo el detalle que cargó el 311 (lecturas marcadas '[script 311]' y sus renglones).
begin;
delete from public.factura_renglones r using public.factura_lecturas l
 where l.empresa = r.empresa and l.comprobante_id = r.comprobante_id and l.leido_por like '[script 311]%';
delete from public.factura_lecturas where leido_por like '[script 311]%';
commit;
