-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🚦 Script 151 — A-FEAT-1449 tanda 1: la 🚩 pasa a ser LA TAREA — de dónde viene, sus señales, quién confirma
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-31: respondió la vista previa (https://claude.ai/artifact/WdPFFfn1BrdXSVkJJGDWDo) y «arrancá».
--
-- public.revisiones ya tiene persona (asignado_a), tarea con fecha (es_tarea, tarea_hasta), hilo (seguimiento) y el
-- cierre con «qué se hizo». Se le suma:
--   · origen       'manual' (lo de hoy) · 'mail' · 'cuota' · 'control' — de dónde salió la tarea.
--   · senales      jsonb [{nombre, peso}] — las señales FIJAS al crearla (impuestos, aviso de deuda…). Las que cambian
--                  con el tiempo (vencida, vence pronto) se calculan al mostrarla. Nivel = suma (lib/revisiones/nivel.ts).
--   · confirma     mail de quien tiene que CONFIRMAR el cierre (JMS 31/10: lo de Ulises «sólo desaparece si yo
--                  confirmo»). Si está, «Listo» deja la tarea en estado 'por_confirmar' en vez de 'resuelta'.
--   · cierre_auto  la regla con que se cierra SOLA cuando el hecho queda registrado (tanda 2: 'cuota_conciliada').
-- `estado` es texto libre (sin CHECK): se suma el valor 'por_confirmar' sin tocar nada.
-- 🤖 Claude como asignado: asignado_a = 'claude' (no hace falta estructura).
--
-- Escribe: 4 columnas (FRENA si alguna ya existe). Las 13 marcas que hay quedan origen 'manual', sin señales.
-- No toca RLS ni grants. Deshacer: 151-revisiones-origen-nivel-confirma-deshacer.sql.
-- Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'revisiones'
             and column_name in ('origen', 'senales', 'confirma', 'cierre_auto')) then
    raise exception 'public.revisiones ya tiene origen / senales / confirma / cierre_auto: no se corre nada.';
  end if;
end $$;
alter table public.revisiones
  add column origen text not null default 'manual',
  add column senales jsonb,
  add column confirma text,
  add column cierre_auto text;
comment on column public.revisiones.origen is '[script 151] A-FEAT-1449 — de dónde salió: manual · mail · cuota · control.';
comment on column public.revisiones.senales is '[script 151] A-FEAT-1449 — señales fijas [{nombre, peso}]; el nivel suma éstas + vencida/vence pronto.';
comment on column public.revisiones.confirma is '[script 151] A-FEAT-1449 — mail de quien confirma el cierre (Listo → por_confirmar).';
comment on column public.revisiones.cierre_auto is '[script 151] A-FEAT-1449 — regla de cierre automático (tanda 2).';
commit;
notify pgrst, 'reload schema';

-- Control (sólo lee): 4 columnas, las marcas de antes intactas
select count(*) as marcas, count(*) filter (where origen = 'manual') as manuales, count(senales) as con_senales from public.revisiones;
