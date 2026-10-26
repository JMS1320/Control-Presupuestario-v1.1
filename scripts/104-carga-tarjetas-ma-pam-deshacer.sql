-- Deshace 104 · borra SÓLO lo que cargó el 104 (tarjetas VISA de MA y PAM, A-DAT-92).
--
-- Antes de correrlo: reemplazar __MARCA__ (dos lugares) por el «marca_created_at» que imprimió el control del 104.
-- Si queda __MARCA__, el script falla al convertir la fecha y no borra nada.
--
-- Qué identifica lo del 104:
--   · templates: '[script 104]' al principio de observaciones_template (ninguna otra fila la tiene: el 104 se
--     frena si ya existía);
--   · reglas de las tarjetas de PAM y MA: created_at = la marca (el 104 se frena si ya había reglas ahí);
--   · regla contable/interno: descripcion '[script 104]…';
--   · centro de costo «Chalet»: sólo si su created_at es la marca (si ya existía, no lo creó el 104).
--
-- 🛑 Se frena si:
--   · algún template del 104 ya tiene CUOTAS (se concilió algo contra él: es dato del usuario, se revisa a mano);
--   · el 105 está aplicado (un template existente apunta a uno del 104, o usa el centro Chalet): primero su deshacer.

-- Control previo (sólo lee)
select 'cuotas en templates del 104' as que, count(*) from public.cuotas_egresos_sin_factura c
  join public.egresos_sin_factura e on e.id = c.egreso_id
 where e.observaciones_template like '[script 104]%'
union all
select 'templates ajenos que apuntan a uno del 104 (105 aplicado)', count(*) from public.egresos_sin_factura x
 where x.template_origen_id in (select id from public.egresos_sin_factura where observaciones_template like '[script 104]%')
   and coalesce(x.observaciones_template, '') not like '[script 104]%';

begin;

do $$
begin
  if exists (select 1 from public.cuotas_egresos_sin_factura c join public.egresos_sin_factura e on e.id = c.egreso_id
             where e.observaciones_template like '[script 104]%') then
    raise exception 'Hay cuotas en los templates del 104 (ya se concilió algo): revisar a mano antes de deshacer.';
  end if;
  if exists (select 1 from public.egresos_sin_factura x
             where x.template_origen_id in (select id from public.egresos_sin_factura where observaciones_template like '[script 104]%')
               and coalesce(x.observaciones_template, '') not like '[script 104]%')
     or exists (select 1 from public.egresos_sin_factura where centro_costo = 'Chalet' and coalesce(observaciones_template, '') not like '[script 104]%') then
    raise exception 'El 105 está aplicado: correr primero 105-...-deshacer.sql.';
  end if;
end $$;

delete from public.reglas_contable_interno
 where cuenta_bancaria_id = 'tarjeta_visa_ma' and descripcion like '[script 104]%';

delete from public.reglas_conciliacion
 where cuenta_bancaria_id in ('tarjeta_visa_pam', 'tarjeta_visa_ma') and created_at = '__MARCA__'::timestamptz;

-- Los 2026 primero (apuntan a los 2025 por template_origen_id)
delete from public.egresos_sin_factura where observaciones_template like '[script 104]%' and template_origen_id is not null;
delete from public.egresos_sin_factura where observaciones_template like '[script 104]%';

delete from public.centros_costo where nombre = 'Chalet' and created_at = '__MARCA__'::timestamptz;

-- Control: todo en cero
select (select count(*) from public.egresos_sin_factura where observaciones_template like '[script 104]%') as templates,
       (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id in ('tarjeta_visa_pam', 'tarjeta_visa_ma')) as reglas_tarjetas,
       (select count(*) from public.reglas_contable_interno where descripcion like '[script 104]%') as contable_interno;

commit;
