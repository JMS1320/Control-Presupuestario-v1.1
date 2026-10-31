-- 156 · LAS CAJAS, LOS ECHEQS Y LAS TARJETAS CON LAS MISMAS COLUMNAS QUE LAS BANCARIAS (A-BUG-1458, segunda parte)
--
-- Qué hace: lo mismo que el 155, para las 7 tablas de extracto que quedaban incompletas: las 3 cajas de MSA (General, AMS,
-- Sigot; les faltaban las 19), echeqs de terceros (15) y las 3 tarjetas VISA (12: los textos del banco y
-- comprobante_venta_id). Sólo agrega las que faltan, vacías (revisado = false). NO toca ningún dato.
--
-- Por qué: JMS 31/10, al correr el 155: «eso debe estar presente en Provincia y varias cosas más, aprovechá a dejar todo
-- bien». La caja se va a conciliar con el mismo motor y falla igual que Santander si le faltan columnas.
--
-- Marca: comentario '[script 156]' en cada columna creada. El deshacer borra sólo esas, y sólo si siguen vacías.

do $$
declare
  t record; c record; n int := 0;
begin
  for t in select * from (values
      ('msa','caja_general'), ('msa','caja_ams'), ('msa','caja_sigot'), ('msa','echeqs_terceros'),
      ('msa','tarjeta_visa_business'), ('pam','tarjeta_visa'), ('ma','tarjeta_visa')
    ) as x(esquema, tabla)
  loop
    for c in select * from (values
        ('origen','text', null), ('grupo_de_conceptos','text', null), ('concepto','text', null), ('numero_de_terminal','text', null),
        ('observaciones_cliente','text', null), ('numero_de_comprobante','text', null),
        ('leyendas_adicionales_1','text', null), ('leyendas_adicionales_2','text', null), ('leyendas_adicionales_3','text', null),
        ('leyendas_adicionales_4','text', null), ('tipo_de_movimiento','text', null), ('sueldo_pago_id','uuid', null),
        ('revisado','boolean', 'false'), ('nota_operador','text', null), ('anticipo_id','uuid', null),
        ('proveedor_nombre','character varying', null), ('comprobantes_pagados','text', null), ('comprobante_venta_id','uuid', null),
        ('nro_resumen','character varying', null)
      ) as y(columna, tipo, defecto)
    loop
      if not exists (select 1 from information_schema.columns where table_schema = t.esquema and table_name = t.tabla and column_name = c.columna) then
        execute format('alter table %I.%I add column %I %s%s', t.esquema, t.tabla, c.columna, c.tipo,
                       case when c.defecto is not null then ' default ' || c.defecto else '' end);
        execute format('comment on column %I.%I.%I is %L', t.esquema, t.tabla, c.columna, '[script 156]');
        n := n + 1;
      end if;
    end loop;
  end loop;
  raise notice 'Columnas agregadas: %', n;
end $$;

-- Control (sólo lee): a ninguna de las 10 le falta ya ninguna columna de msa_galicia.
select s.esquema || '.' || s.tabla as tabla, count(g.column_name) as faltan
  from (values ('msa','caja_general'), ('msa','caja_ams'), ('msa','caja_sigot'), ('msa','echeqs_terceros'),
               ('msa','tarjeta_visa_business'), ('pam','tarjeta_visa'), ('ma','tarjeta_visa')) s(esquema, tabla)
  left join information_schema.columns g on g.table_schema = 'public' and g.table_name = 'msa_galicia'
   and not exists (select 1 from information_schema.columns x where x.table_schema = s.esquema and x.table_name = s.tabla and x.column_name = g.column_name)
 group by 1 order by 1;
