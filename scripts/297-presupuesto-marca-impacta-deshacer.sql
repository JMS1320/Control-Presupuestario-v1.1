-- 297 DESHACER · vuelve el CHECK del 296. Si ya hay marcas 'impacta' (decisiones de JMS), no se toca: se avisa.
do $$
begin
  if exists (select 1 from public.presupuesto_marcas where marca = 'impacta') then
    raise notice 'Hay marcas impacta de JMS: no se deshace.';
  else
    alter table public.presupuesto_marcas drop constraint presupuesto_marcas_marca_check;
    alter table public.presupuesto_marcas add constraint presupuesto_marcas_marca_check check (marca in ('pagado', 'cobrado', 'impago', 'no_concretado'));
  end if;
end $$;
