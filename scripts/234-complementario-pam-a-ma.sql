-- 234 · Inmobiliario Complementario PAM 2026 → responsable MA (DATOS) — A-FEAT-1577 (14). OK JMS 07/11: «complementario de PAM pasará a MA».
-- El Fondo Educativo queda como está (JMS: «dejalo sin nada por ahora»). Backup: scripts/234-foto-antes.json. Deshacer: 234-…-deshacer.sql.
begin;
update public.egresos_sin_factura set responsable = 'MA' where id = 'c17d666a-82af-41a6-8279-022ccdb56476' and responsable = 'PAM';  -- Inmobiliario Complementario Anual PAM 2026
update public.egresos_sin_factura set responsable = 'MA' where id = '79b2c3b0-a6bb-48d4-b4d7-952f926162ff' and responsable = 'PAM';  -- Inmobiliario Complementario Cuota PAM 2026
commit;
