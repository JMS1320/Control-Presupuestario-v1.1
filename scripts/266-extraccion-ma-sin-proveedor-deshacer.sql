-- Deshace [script 266]: vuelve el proveedor que tenía (foto antes).
update ma.ma_galicia set proveedor_nombre = 'Wilson Barreto' where id = '42c29013-9937-4d2f-b4d8-90291cc7a669' and proveedor_nombre is null;
