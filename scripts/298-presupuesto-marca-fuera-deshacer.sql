-- 298 DESHACER · vuelve el CHECK del 297. Si ya hay marcas 'fuera' (decisiones de JMS), no se toca.
do $$
begin
  if exists (select 1 from public.presupuesto_marcas where marca = 'fuera') then
    raise notice 'Hay marcas fuera de JMS: no se deshace.';
  else
    alter table public.presupuesto_marcas drop constraint presupuesto_marcas_marca_check;
    alter table public.presupuesto_marcas add constraint presupuesto_marcas_marca_check check (marca in ('pagado', 'cobrado', 'impago', 'no_concretado', 'impacta'));
  end if;
end $$;
