-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🌾 Script 213 — A-FEAT-1574: la COSECHA y la existencia al CIERRE de granos de MSA 25/26, en el cuadre de kilos
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 06/11 (nota en «1 Granos»): «las certificaciones electrónicas de granos son el documento por el cual nos acreditan la
-- cosecha en el lugar de entrega… Son de AFA. ¿Podés chequear y agregar la cosecha? El saldo a 30/6 es cero».
--   · cosecha = 15,12 t: la ÚNICA certificación electrónica del ejercicio — AFA, 28/04/2026, C.O.E. 332022543744, campaña
--     25/26, soja, peso neto 15.120 kg (CTG del 19/04 10.840 kg y del 20/04 4.280 kg). Leída del PDF vinculado a la factura
--     T332 42191 y la misma que figura en el resumen de cuenta corriente de AFA («CERT.DEPOEF1116A … Cosecha 26 Cereal SOJA
--     Kilos 15120»).
--   · cierre = 0: lo dijo JMS.
--   · Control: 6,926 (inicio) + 15,12 (cosecha) − 22,046 (ventas de grano: Sancor 6,832 + AFA 15,214) = 0.
-- Escribe: 2 filas NUEVAS en public.balance_datos_usuario (MSA 2026, papel granos, claves cosecha y cierre) — el mismo lugar
-- que la casilla de la pantalla. FRENA si ya hay alguna de las dos. Marca '[script 213]' en actualizado_por.
-- Deshacer: 213-granos-cosecha-cierre-msa-deshacer.sql (sólo las suyas, y sólo si nadie las editó).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
do $$
begin
  if exists (select 1 from public.balance_datos_usuario where empresa='MSA' and anio_cierre=2026 and papel='granos' and clave in ('cosecha','cierre')) then
    raise exception 'ya hay cosecha o cierre de granos para MSA 2026: no se pisan';
  end if;
  insert into public.balance_datos_usuario (empresa, anio_cierre, papel, clave, texto, valor, historial, actualizado_por) values
  ('MSA', 2026, 'granos', 'cosecha', '15,12', 15.12, '[]'::jsonb,
   '[script 213] Claude · certificación electrónica de granos AFA 28/04/2026, C.O.E. 332022543744, campaña 25/26, soja, peso neto 15.120 kg (PDF «04-28 - Agricultores Federados Argentinos Cert Granos.pdf»)'),
  ('MSA', 2026, 'granos', 'cierre', '0', 0, '[]'::jsonb,
   '[script 213] JMS 06/11: «el saldo a 30/6 es cero»');
end $$;

-- ── Control (sólo lee) ──
select clave, texto, left(actualizado_por, 80) from public.balance_datos_usuario where empresa='MSA' and anio_cierre=2026 and papel='granos' order by clave;
