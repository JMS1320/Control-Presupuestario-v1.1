-- 155 · LAS CUENTAS DE CARGA MANUAL CON LAS MISMAS COLUMNAS QUE LAS BANCARIAS (A-BUG-1458)
--
-- Qué hace: agrega a las 10 cuentas que se cargan a mano (Santander, Provincia, ANSES de MA, Cotitulares en pesos y las 6
-- en dólares) las 19 columnas que tienen las cuentas del importador (public.msa_galicia) y les faltaban. Todas vacías
-- (revisado = false, como en Galicia). NO toca ningún dato.
--
-- Por qué: al conciliar Santander con sus 8 reglas nuevas (script 154), el motor encontró la regla en 113 movimientos y
-- falló AL GRABAR los 113 («Errores 113»): escribe proveedor_nombre, anticipo_id, comprobante_venta_id… y esas columnas no
-- existían. Lo mismo rompe «revisado», las notas del operador y los contadores del extracto (daban 0). Las tablas se
-- crearon en los scripts 126, 129 y 135 con un juego reducido de columnas.
--
-- Marca: cada columna creada lleva el comentario '[script 155]'. El deshacer borra sólo esas, y sólo si siguen vacías.

do $$
declare
  t record; c record; n int := 0;
begin
  for t in select * from (values
      ('msa','santander'), ('msa','provincia'), ('ma','anses_ca_pesos'), ('public','cotitulares_ca_pesos'),
      ('msa','cc_usd'), ('msa','caja_usd'), ('ma','ca_usd'), ('ma','caja_usd'), ('public','cotitulares_ca_usd'), ('public','cotitulares_caja_usd')
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
        execute format('comment on column %I.%I.%I is %L', t.esquema, t.tabla, c.columna, '[script 155]');
        n := n + 1;
      end if;
    end loop;
  end loop;
  raise notice 'Columnas agregadas: %', n;
end $$;

-- Control (sólo lee): a ninguna de las 10 le falta ya ninguna columna de msa_galicia.
select s.esquema || '.' || s.tabla as tabla, count(g.column_name) as faltan
  from (values ('msa','santander'), ('msa','provincia'), ('ma','anses_ca_pesos'), ('public','cotitulares_ca_pesos'),
               ('msa','cc_usd'), ('msa','caja_usd'), ('ma','ca_usd'), ('ma','caja_usd'), ('public','cotitulares_ca_usd'), ('public','cotitulares_caja_usd')) s(esquema, tabla)
  left join information_schema.columns g on g.table_schema = 'public' and g.table_name = 'msa_galicia'
   and not exists (select 1 from information_schema.columns x where x.table_schema = s.esquema and x.table_name = s.tabla and x.column_name = g.column_name)
 group by 1 order by 1;
