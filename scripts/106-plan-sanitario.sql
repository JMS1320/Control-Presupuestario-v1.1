-- 106 · EL PLAN SANITARIO DE LA HACIENDA + LA CARGA DE IATF — A-FEAT-1380 (2026-10-27)
--
-- Usuario 2026-10-26/27: «poder cargar a la app el plan sanitario… cuando falta un mes ya da warning…
-- todo debería cumplirse y lo que no exige anotar por qué». Y de la IATF: «marcando fecha de IATF calcula
-- hacia atrás… para la carga es una sola carga… Entore lleva su propia fecha… se debe anotar cuáles se
-- echaron, a qué rodeo».
--
-- QUÉ HACE (todo NUEVO, no modifica ninguna fila existente):
--   1. productivo.plan_sanitario_tareas     — el PLAN: cada tarea con su fecha óptima, margen, de qué cuelga.
--   2. productivo.plan_sanitario_registro   — la HUELLA por campaña: «se hizo el…», «no se hizo porque…»,
--                                             «se juntó con…». Lo hecho en sí sigue siendo la ORDEN de aplicación.
--   3. productivo.plan_sanitario_propuestas — los cambios al plan que hace quien no puede aprobar (Enrique),
--                                             hasta que JMS los acepta o rechaza.
--   4. productivo.iatf + productivo.iatf_toros — una carga de IATF = 4 órdenes (dispositivos, retiro, IA,
--                                             entore) atadas entre sí, y qué toros se echaron a qué rodeo.
--   5. Carga el calendario base (la síntesis de las dos solapas de «CALENDARIO GANADERO.xlsx»).
--   6. Agrega a productivo.labores las que faltan (OK del usuario 27/10: «si lo que falta cargar para que
--      sea viable luego crear las labores hacelo»). Find-or-create por nombre: si ya existe, no la toca.
--
-- Permisos: igual que las demás de productivo (recurso «productivo», RLS puede_ver/puede_escribir).
-- Sin DELETE para authenticated en el registro y las propuestas: lo que se escribe queda (huella).
--
-- 🛑 Antes de correr: aviso a Javier en ENTRE-DESARROLLADORES.md (estructura + RLS) y OK del usuario.
-- Deshacer: 106-plan-sanitario-deshacer.sql

begin;

do $$
begin
  if to_regclass('productivo.plan_sanitario_tareas') is not null
     or to_regclass('productivo.plan_sanitario_registro') is not null
     or to_regclass('productivo.plan_sanitario_propuestas') is not null
     or to_regclass('productivo.iatf') is not null
     or to_regclass('productivo.iatf_toros') is not null then
    raise exception 'Alguna tabla del 106 YA EXISTE: no se corre. Avisar antes de seguir.';
  end if;
end $$;

-- ── 1 · El plan ──────────────────────────────────────────────────────────────────────────────
create table productivo.plan_sanitario_tareas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- la columna del calendario: servicio · veterinario · manejo · ventas · caballos · pasto
  columna text not null default 'veterinario',
  -- a quién se le hace: Vacas, Vaquillonas, Toros, Terneros al pie, Recría, CUT, Caballos, Campo
  grupos text[] not null default '{}',
  -- fecha óptima en el año, 'MM-DD'. Si hay ventana (parición 07-01 → 09-30), hasta_mmdd es el fin.
  optimo_mmdd text not null check (optimo_mmdd ~ '^\d{2}-\d{2}$'),
  hasta_mmdd text check (hasta_mmdd is null or hasta_mmdd ~ '^\d{2}-\d{2}$'),
  -- fija = parición, servicio, IATF: casi no se mueven. El resto orbita.
  es_fija boolean not null default false,
  -- margen SIN explicación (días antes / después). Fuera de eso se exige anotar por qué.
  tol_antes int not null default 15,
  tol_despues int not null default 15,
  -- de qué cuelga: «N días después de» otra tarea. Si la otra se corre, ésta se corre (cadena).
  ancla_id uuid references productivo.plan_sanitario_tareas(id),
  ancla_dias int,
  -- obligatoria = si no se hace, pide explicación. Deseable = se muestra, no reclama.
  obligatoria boolean not null default true,
  -- palabras para reconocer la orden que la cumple (labores e insumos): «Tacto», «Fasiolisida»…
  claves text[] not null default '{}',
  -- tarea con lógica propia: 'iatf' · 'entore' · 'paricion'
  codigo text,
  detalle text,
  orden int not null default 0,
  activa boolean not null default true,
  actualizado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table productivo.plan_sanitario_tareas is
  '[script 106] A-FEAT-1380 — el plan sanitario y de manejo: cada tarea con su fecha óptima, margen, cadena y claves para reconocer la orden que la cumple.';

-- ── 2 · La huella por campaña ────────────────────────────────────────────────────────────────
create table productivo.plan_sanitario_registro (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references productivo.plan_sanitario_tareas(id),
  -- campaña = año en que empieza (jul → jun). 2026 = jul-2026 a jun-2027.
  campania int not null,
  -- hecha (con o sin orden) · no_se_hizo · programada (se movió o se juntó a una fecha)
  estado text not null check (estado in ('hecha', 'no_se_hizo', 'programada')),
  fecha date,
  orden_id uuid references productivo.ordenes_aplicacion(id),
  explicacion text,
  autor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tarea_id, campania)
);
comment on table productivo.plan_sanitario_registro is
  '[script 106] A-FEAT-1380 — por tarea y campaña: se hizo / no se hizo y por qué / se programó para tal fecha. Lo hecho en sí es la orden de aplicación.';

-- ── 3 · Lo que propone quien no aprueba ──────────────────────────────────────────────────────
create table productivo.plan_sanitario_propuestas (
  id uuid primary key default gen_random_uuid(),
  -- null = tarea nueva
  tarea_id uuid references productivo.plan_sanitario_tareas(id),
  -- 'editar' · 'nueva' · 'desactivar' · 'programar' (mover/juntar una campaña)
  tipo text not null default 'editar',
  -- los campos que cambia, tal como quedarían: {"optimo_mmdd":"09-22", ...}
  cambios jsonb not null default '{}'::jsonb,
  -- foto de la tarea al proponer (para mostrar antes → después aunque la tarea cambie)
  antes jsonb,
  campania int,
  nota text,
  autor text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  resuelto_por text,
  resuelto_at timestamptz,
  respuesta text,
  created_at timestamptz not null default now()
);
comment on table productivo.plan_sanitario_propuestas is
  '[script 106] A-FEAT-1380 — cambios al plan propuestos por un rol sin «Aprobar», hasta que el dueño los acepta o rechaza.';

-- ── 4 · La IATF: una carga, cuatro órdenes ───────────────────────────────────────────────────
create table productivo.iatf (
  id uuid primary key default gen_random_uuid(),
  anio int not null,
  fecha_dispositivos date not null,
  fecha_retiro date not null,
  fecha_ia date not null,
  fecha_entore date not null,
  orden_dispositivos_id uuid references productivo.ordenes_aplicacion(id),
  orden_retiro_id uuid references productivo.ordenes_aplicacion(id),
  orden_ia_id uuid references productivo.ordenes_aplicacion(id),
  orden_entore_id uuid references productivo.ordenes_aplicacion(id),
  explicacion text,
  observaciones text,
  autor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- las distancias entre las tres fechas NO se mueven (usuario 27/10)
  check (fecha_ia - fecha_dispositivos = 10 and fecha_ia - fecha_retiro = 2),
  check (fecha_entore >= fecha_ia)
);
comment on table productivo.iatf is
  '[script 106] A-FEAT-1380 — una carga de IATF: dispositivos (IA−10), retiro (IA−2), IA y entore, cada una con su orden de aplicación.';

create table productivo.iatf_toros (
  id uuid primary key default gen_random_uuid(),
  iatf_id uuid not null references productivo.iatf(id) on delete cascade,
  rodeo text not null,
  categoria_hacienda_id uuid references productivo.categorias_hacienda(id),
  cabezas int,
  toros text,
  cantidad_toros int,
  created_at timestamptz not null default now()
);
comment on table productivo.iatf_toros is
  '[script 106] A-FEAT-1380 — por rodeo de una IATF: cuántas cabezas y qué toros se echaron al entore.';

-- ── Permisos (igual que el resto de productivo) ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['plan_sanitario_tareas','plan_sanitario_registro','plan_sanitario_propuestas','iatf','iatf_toros'] loop
    execute format('alter table productivo.%I enable row level security', t);
    execute format('create policy ver_segun_permiso on productivo.%I for select to authenticated using (public.puede_ver(''productivo'', %L))', t, t);
    execute format('create policy escribir_segun_permiso on productivo.%I for all to authenticated using (public.puede_escribir(''productivo'', %L)) with check (public.puede_escribir(''productivo'', %L))', t, t, t);
    execute format('revoke all on productivo.%I from anon', t);
    execute format('grant select, insert, update on productivo.%I to authenticated', t);
    execute format('grant all on productivo.%I to service_role', t);
  end loop;
end $$;
-- las tareas del plan y los toros de una IATF sí se pueden borrar desde la app (con su permiso)
grant delete on productivo.plan_sanitario_tareas, productivo.iatf_toros to authenticated;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
select 'productivo', t, 'productivo', '[script 106] Plan sanitario (A-FEAT-1380).',
       coalesce((select restringe_lectura from public.recurso_tablas where tabla = 'ordenes_aplicacion' limit 1), false)
from unnest(array['plan_sanitario_tareas','plan_sanitario_registro','plan_sanitario_propuestas','iatf','iatf_toros']) t
on conflict do nothing;

-- ── 5 · Las labores que faltan (find-or-create por nombre) ──────────────────────────────────
insert into productivo.labores (nombre, orden_display, activo)
select v.nombre, v.ord, true
from (values
  ('Colocación dispositivos IATF', 20), ('Retiro dispositivos IATF', 21), ('IATF', 22),
  ('Revisación de toros', 23), ('Corte de parición', 24), ('Corte de cola', 25),
  ('Corte de oreja', 26), ('Abichados', 27), ('Caravana mosca', 28)
) v(nombre, ord)
where not exists (select 1 from productivo.labores l where lower(l.nombre) = lower(v.nombre));

-- ── 6 · El calendario base ──────────────────────────────────────────────────────────────────
-- Síntesis de las dos solapas + lo que fijó el usuario el 27/10. Las que cuelgan de otra se enganchan
-- abajo por nombre (ancla). claves = cómo se reconoce la orden (nombres de labores e insumos).
insert into productivo.plan_sanitario_tareas
  (orden, nombre, columna, grupos, optimo_mmdd, hasta_mmdd, es_fija, tol_antes, tol_despues, obligatoria, claves, codigo, detalle)
values
  -- Fijas: parición, IATF, servicio
  (10, 'Parición', 'servicio', '{Vacas,Vaquillonas}', '07-01', '09-30', true, 1, 1, true, '{Parición}', 'paricion',
      'Del 1/7 al 30/9. Anotar nacimientos y capar careta al nacer.'),
  (11, 'IATF', 'servicio', '{Vacas,Vaquillonas}', '10-01', null, true, 2, 0, true, '{IATF}', 'iatf',
      'Dispositivos IA−10 (lunes) · retiro IA−2 (martes) · IA (jueves). Las distancias no se mueven. Hasta 2 días antes sin explicación; 3 antes o 1 después, con explicación.'),
  (12, 'Servicio / entore', 'servicio', '{Vacas,Vaquillonas,Toros}', '10-03', '12-31', true, 1, 1, true, '{Servicio/Entore}', 'entore',
      'Unos 2 días después de la IATF, hasta el 31/12. Anotar qué toros se echaron a qué rodeo.'),
  -- Veterinario / sanidad
  (20, 'Tacto + reproductiva', 'veterinario', '{Vacas,Vaquillonas}', '02-25', null, false, 10, 10, true, '{Tacto}', null,
      'Orbita el 25/2. Apartar CUT y vacías (cola corta); a las CUT no cortar oreja todavía (mosca), tomar caravana, pelo y razón de descarte.'),
  (21, 'Sanidad general de otoño', 'veterinario', '{Vacas,Vaquillonas,Toros,CUT}', '03-21', null, false, 15, 15, true, '{Fasiolisida,Hemoglobinuria}', null,
      'Fasciolicida + hemoglobinuria + cobre. Arranca el ciclo de sanidad (entrada del otoño). ❓ En las planillas figuraba en febrero, con el tacto: confirmar si pasa a marzo.'),
  (22, 'Aftosa (todo) + brucelosis terneras', 'veterinario', '{Vacas,Vaquillonas,Toros,Recría}', '03-11', '04-11', false, 7, 7, true, '{Aftosa,Brucelosis}', null,
      'Campaña oficial 11/3 a 11/4. Brucelosis sólo a las terneras hembra.'),
  (23, 'Sanidad general + Rotatek', 'veterinario', '{Vacas,Vaquillonas,Toros,CUT}', '06-05', null, false, 5, 10, true, '{Rotatek,Fasiolisida}', null,
      'Rotatek entre el 1 y el 15/6, antes de la parición. Se da acá la sanidad general porque el Rotatek es obligado.'),
  (24, 'Revisación de toros y toritos', 'veterinario', '{Toros}', '07-15', null, false, 15, 15, true, '{Revisación de toros}', null, null),
  (25, 'Reproductiva vaquillonas (1ª dosis)', 'veterinario', '{Vaquillonas}', '08-15', null, false, 7, 7, true, '{Reproductiva}', null, null),
  (26, 'Sanidad general + cobre + reproductiva', 'veterinario', '{Vacas,Vaquillonas,Toros,CUT}', '09-15', null, false, 10, 10, true, '{Fasiolisida,Hemoglobinuria,Reproductiva}', null,
      'Vacas: reproductiva única dosis · vaquillonas: 2ª dosis. Se da acá la sanidad general porque la reproductiva es obligada antes del servicio.'),
  (27, 'Tacto vaquillonas pre-servicio', 'veterinario', '{Vaquillonas}', '09-15', null, false, 10, 10, true, '{Tacto}', null, null),
  (28, 'Min Vit a vaquillonas de 1ª', 'veterinario', '{Vaquillonas}', '10-15', null, false, 15, 15, true, '{MinVit}', null, null),
  (29, 'Tacto de la IA', 'veterinario', '{Vacas,Vaquillonas}', '11-15', null, false, 7, 7, true, '{Tacto}', null, null),
  (30, 'Aftosa terneros, novillos, vaquillonas y toritos + carbunclo', 'veterinario', '{Terneros al pie,Recría,Vacas,Toros}', '12-10', null, false, 15, 15, true, '{Aftosa,Carbunclo}', null,
      'Carbunclo a vacas y toros.'),
  (31, 'Neumo/querato + triple terneros (1ª dosis)', 'veterinario', '{Terneros al pie}', '12-05', null, false, 10, 10, true, '{Neumo,Triple}', null, null),
  (32, 'Neumo/querato + triple terneros (2ª dosis)', 'veterinario', '{Terneros al pie}', '12-20', null, false, 3, 5, true, '{Neumo,Triple}', null,
      '15 días después de la 1ª dosis.'),
  -- Manejo
  (40, 'Marcación: fuego, señal, 7 + asegurar caravanas', 'manejo', '{Recría}', '07-15', null, false, 15, 15, true, '{Marca NZ,Marca 7,Señal}', null,
      'Número a fuego a reposición y toritos. Ver si falta marca, señal y 7. (En la planilla nueva aparecía en septiembre con espuela; se dejó en julio.)'),
  (41, 'Caravanear reposición y toritos', 'manejo', '{Recría}', '05-15', null, false, 15, 15, true, '{Caravana Oficial}', null,
      'Contra la caravana de nacimiento.'),
  (42, 'Cortar oreja a las CUT', 'manejo', '{CUT}', '05-20', null, false, 20, 20, true, '{Corte de oreja}', null,
      'Después de la 1ª helada (por la mosca).'),
  (43, 'Corte de parición', 'manejo', '{Vacas}', '08-10', null, false, 2, 2, true, '{Corte de parición}', null,
      'Separar lo que no parió hasta el 10/8 y llevarlo a parir a otro lote: arma los dos rodeos (se insemina / no).'),
  (44, 'Capar 1ª tanda', 'manejo', '{Terneros al pie}', '09-20', null, false, 15, 15, true, '{Capada}', null, null),
  (45, 'Capar 2ª tanda', 'manejo', '{Terneros al pie}', '10-20', null, false, 15, 15, true, '{Capada}', null, null),
  (46, 'Abichados', 'manejo', '{Terneros al pie}', '10-15', '11-30', false, 0, 0, true, '{Abichados}', null, null),
  (47, 'Caravana mosca', 'manejo', '{Vacas,Vaquillonas,Toros}', '11-15', null, false, 15, 15, true, '{Caravana mosca}', null, null),
  (48, 'Pesada terneros al pie', 'manejo', '{Terneros al pie}', '11-15', null, false, 10, 10, true, '{Pesada}', null,
      'Para la venta del 15/12.'),
  -- Ventas y selección (deseables: se muestran, no reclaman)
  (60, 'Venta de vacías (después del tacto)', 'ventas', '{Vacas}', '03-05', null, false, 15, 15, false, '{}', null, null),
  (61, 'Venta terneros cola de parición', 'ventas', '{Terneros al pie}', '03-15', null, false, 15, 15, false, '{}', null, null),
  (62, 'Pre-selección de toritos', 'ventas', '{Recría}', '09-15', null, false, 15, 15, false, '{}', null, null),
  (63, 'Venta CUT + fallo de parto', 'ventas', '{CUT}', '11-15', null, false, 15, 15, false, '{}', null, null),
  (64, 'Venta cabeza de parición + selección reposición y toritos', 'ventas', '{Terneros al pie,Recría}', '12-15', null, false, 10, 10, false, '{}', null, null),
  -- Caballos
  (70, 'Desparasitario caballos (otoño, 2 dosis)', 'caballos', '{Caballos}', '05-15', null, false, 15, 15, true, '{}', null,
      '2ª dosis a los 15 días.'),
  (71, 'Desparasitario caballos (primavera, 2 dosis)', 'caballos', '{Caballos}', '09-15', null, false, 15, 15, true, '{}', null,
      '2ª dosis a los 15 días.'),
  -- Pasto y campo (deseables)
  (80, 'Bolear rye grass', 'pasto', '{Campo}', '02-20', null, false, 10, 10, false, '{}', null, null),
  (81, 'Piedra de sales (para el rye grass)', 'pasto', '{Campo}', '03-15', '05-31', false, 15, 15, false, '{}', null,
      'Dos meses antes de comer el rye grass.'),
  (82, 'Fumigar promociones de rye grass', 'pasto', '{Campo}', '04-15', null, false, 15, 15, false, '{}', null, null),
  (83, 'Terrazas / vías / guano', 'pasto', '{Campo}', '04-15', '06-30', false, 15, 15, false, '{}', null, null),
  (84, 'Fumigar alambres', 'pasto', '{Campo}', '09-20', null, false, 15, 15, false, '{}', null, null),
  (85, 'Pastar acacios', 'pasto', '{Campo}', '10-15', null, false, 15, 15, false, '{}', null, null);

-- Las cadenas: «si algo se corre, se corre el resto»
update productivo.plan_sanitario_tareas t set ancla_id = a.id, ancla_dias = v.dias
from (values
  ('Servicio / entore',                         'IATF',                                  2),
  ('Tacto de la IA',                            'IATF',                                 45),
  ('Sanidad general + Rotatek',                 'Sanidad general de otoño',             76),
  ('Sanidad general + cobre + reproductiva',    'Sanidad general + Rotatek',           102),
  ('Neumo/querato + triple terneros (2ª dosis)','Neumo/querato + triple terneros (1ª dosis)', 15),
  ('Venta de vacías (después del tacto)',       'Tacto + reproductiva',                  8)
) v(tarea, ancla, dias)
join productivo.plan_sanitario_tareas a on a.nombre = v.ancla
where t.nombre = v.tarea;

update productivo.plan_sanitario_tareas set actualizado_por = '[script 106]';

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee) ──────────────────────────────────────────────────────────────────────
select (select count(*) from productivo.plan_sanitario_tareas) as tareas,               -- 38
       (select count(*) from productivo.plan_sanitario_tareas where ancla_id is not null) as en_cadena, -- 6
       (select count(*) from productivo.labores where nombre in ('Colocación dispositivos IATF','Retiro dispositivos IATF','IATF')) as labores_iatf, -- 3
       (select count(*) from public.recurso_tablas where motivo like '[script 106]%') as en_recursos; -- 5
