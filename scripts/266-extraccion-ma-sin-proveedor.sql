-- [script 266] nota JMS 11/11 (F2, OK: «correcto»): la extracción en autoservicio de MA del 14/10/2026 ($ 200.000), que JMS
-- pasó a Caja, quedó con «Wilson Barreto» en proveedor (venía del vínculo viejo con su anticipo de sueldo). Se limpia.
-- Foto antes: proveedor_nombre = 'Wilson Barreto'.
update ma.ma_galicia set proveedor_nombre = null
where id = '42c29013-9937-4d2f-b4d8-90291cc7a669' and proveedor_nombre = 'Wilson Barreto';
