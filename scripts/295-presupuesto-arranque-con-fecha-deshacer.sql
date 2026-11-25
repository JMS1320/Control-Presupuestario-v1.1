-- 295 DESHACER · borra las dos columnas que creó el 295 (no existían antes: el 295 usa ADD COLUMN sin IF NOT EXISTS,
-- así que si hubieran existido el 295 habría fallado sin tocar nada).
alter table public.presupuesto_config drop column if exists composicion_saldo;
alter table public.presupuesto_config drop column if exists fecha_arranque;
