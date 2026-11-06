-- 📎 Script 221 — A-FEAT-1571: vincula los 11 extractos de la cuenta corriente SANTANDER de MSA, ago-25 → jun-26.
-- Los PDF estaban en «- Comunicacion JMS Claude - Archivos/Extractos/Varias» (de ahí los cargó el script 139 el 30/10);
-- se COPIARON (sin mover ni pisar) a «BANCOS y entidades financieras / BANCO SANTANDER RIO / 2025-26». Julio ya estaba (script 217).
-- JMS 06/11: «vinculá todos los extractos, completá las carpetas, que los PDF los tenés todos». Control: junio dice
-- «Saldo total en cuentas al 30/06/26 $ 208.814,82» = el saldo de la app.
-- Escribe 11 filas NUEVAS en public.documentos_respaldo, marca '[script 221]'. Deshacer: 221-vincular-santander-msa-deshacer.sql.
begin;
insert into public.documentos_respaldo (empresa, cuenta, periodo, tipo, drive_file_id, url, nombre_archivo, ruta_drive, saldo_documento, observaciones, creado_por)
select 'MSA', 'BANCO SANTANDER', p, 'extracto', id, 'https://drive.google.com/file/d/' || id || '/view',
       'MSA - Santander - CC - Pesos - ' || substr(p, 3) || '.pdf', 'BANCOS y entidades financieras / BANCO SANTANDER RIO / 2025-26',
       s, 'copia de la carpeta de comunicación (Extractos/Varias)', '[script 221] Claude · OK de JMS 06/11'
from (values
  ('2025-08', '1bod_qRx1r2YBkomE54rw_F_VSr-Xko5k', 118621.29),
  ('2025-09', '1d5zrgtQP5_VicruyBh9JT5tFEBFoN7nK', 140925.73),
  ('2025-10', '1WP3douxa5sf9seS8cyB_NlAcmwiZI2Gv', 73658.13),
  ('2025-11', '17FWZDXMzow42u1-GliqZP_HUXtih-d4I', 6390.53),
  ('2025-12', '10-FZk_0DP9wNJ8BiaRdifq86JXgH3aKu', -66116.32),
  ('2026-01', '18wXmt5XqVbyKMnrKumsrAePxmi9clnAp', -139402.50),
  ('2026-02', '1D1XvclNPlv1XBg93TxE7mcJinjOtQDmF', 229839.70),
  ('2026-03', '1pnR5B9S-ukcb30QFQbAgpKD1MSD8Nbhi', null),
  ('2026-04', '1OJ0CyrGlpO3fXqmJ-J506HSIT2saxtFK', 73906.99),
  ('2026-05', '1q0RQRgT-8DUgGbGPXOjcZtC58kb1whmq', -13732.01),
  ('2026-06', '1vdF7LOaUFcjgZgnWKGajjFATt3i2W1KL', 208814.82)
) v(p, id, s)
where not exists (select 1 from public.documentos_respaldo d where d.empresa='MSA' and d.cuenta='BANCO SANTANDER' and d.periodo=v.p and d.tipo='extracto');
commit;
select periodo, nombre_archivo, saldo_documento from public.documentos_respaldo where cuenta='BANCO SANTANDER' order by periodo;
