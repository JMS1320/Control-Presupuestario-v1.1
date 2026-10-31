-- 154 · REGLAS DE CONCILIACIÓN DE MSA SANTANDER (A-DAT-96)
--
-- Qué hace: crea 8 reglas en public.reglas_conciliacion para la cuenta msa_santander, cada una apuntando a un template
-- de MSA que YA EXISTE (no crea templates ni toca movimientos). Después JMS corre la conciliación desde el extracto.
--
-- Por qué: Santander se cargó hace poco y sus 148 movimientos (jul-25 → sep-26) están todos «pendiente»; no tenía
-- ninguna regla. Propuesta entregada a JMS en su tarea del recorrido (31/10) y aprobada: «Ok créalas y yo audito
-- directo desde reglas».
--
-- Orden: «Iva percep» va ANTES que «Iva» (la percepción también contiene «Iva»). Las reglas no distinguen mayúsculas.
-- Cobertura medida antes de correr: 140 de los 148 movimientos (el resto: 5 transferencias desde Galicia, a mano, y
-- 3 «Pago de honorarios», pregunta abierta).
--
-- Marca: todas se crean en la misma transacción → mismo created_at. El deshacer (154-…-deshacer.sql) borra sólo las
-- reglas de msa_santander con ese instante.

-- Control previo (sólo lee): no tiene que haber reglas de Santander; los 8 templates tienen que existir una sola vez.
select 'reglas de msa_santander antes' as que, count(*) from public.reglas_conciliacion where cuenta_bancaria_id = 'msa_santander';

begin;

do $$
begin
  if exists (select 1 from public.reglas_conciliacion where cuenta_bancaria_id = 'msa_santander') then
    raise exception 'Ya hay reglas para msa_santander: revisar antes de cargar (este script asume que no hay ninguna).';
  end if;
end $$;

insert into public.reglas_conciliacion
  (cuenta_bancaria_id, orden, tipo, columna_busqueda, tipo_match, texto_buscar, template_id, categ, detalle,
   codigo_contable, codigo_interno, llena_template, activo)
select 'msa_santander', r.orden, 'bancarios', 'descripcion', 'contiene', r.texto, e.id, e.categ, r.detalle,
       e.codigo_contable, e.codigo_interno, true, true
from (values
  (1, 'Iva percep',                       'Percepcion IVA',           'Percepcion IVA'),
  (2, 'Iva',                              'Iva Bancario',             'Iva Bancario'),
  (3, 'Impuesto ley 25.413',              'Debitos / Creditos',       'Debitos / Creditos'),
  (4, 'Iibb percep',                      'IIBB Bancario',            'IIBB Bancario'),
  (5, 'Impuesto de sellos',               'Sellos Bancario',          'Sellos Bancario'),
  (6, 'Comision por servicio de cuenta',  'Comision Cuenta Bancaria', 'Comision Cuenta Bancaria'),
  (7, 'Comision tarjeta debito',          'Comision Cuenta Bancaria', 'Comision tarjeta de débito'),
  (8, 'Intereses por descubierto',        'Créditos Pagados',         'Interes Descubierto')
) as r(orden, texto, template, detalle)
join public.egresos_sin_factura e on e.nombre_referencia = r.template and e.responsable = 'MSA' and e.activo;

do $$ begin
  if (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id = 'msa_santander') <> 8 then
    raise exception 'No quedaron las 8 reglas (¿falta o se repite un template?): %',
      (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id = 'msa_santander');
  end if;
end $$;

commit;

-- Control posterior (sólo lee): las 8, con su template, y el instante para el deshacer.
select r.orden, r.texto_buscar, e.nombre_referencia as template, r.created_at
  from public.reglas_conciliacion r join public.egresos_sin_factura e on e.id = r.template_id
 where r.cuenta_bancaria_id = 'msa_santander' order by r.orden;
