-- 138 · Preguntas del cruce de papeles 24/25 vs export 25/26 → «Pendientes a revisar» del balance MSA 25/26
-- A-FEAT-1420 / A-FEAT-1427 (2026-10-30). OK de JMS en la terminal de balance: «sí, cargá las preguntas como pendientes».
-- Sólo INSERTA filas nuevas en public.balance_pendientes, marcadas en creado_por con «[script 138]».
-- Deshacer: 138-balance-preguntas-cruce-papeles-deshacer.sql (borra sólo las filas con esa marca).
-- Quedan afuera las ya contestadas por JMS el 30/10 (equinos, facturas JMS/AMS, automotores) y «CTA HIJOS» (es de conciliación).

begin;

insert into public.balance_pendientes (empresa, anio_cierre, texto, creado_por)
select 'MSA', 2026, t, 'Claude cruce de papeles 2026-10-30 [script 138]'
from (values
  ('❓ Bancos · Saldos (E11): tu caja en dólares al 30/06/2025 es 0, pero el contador tiene «CAJA DÓLARES» $ 932.000. ¿Qué es?'),
  ('❓ Gastos bancarios · bloque «FONDO FIJO» $ 1.194.833,68 (24/25): ¿de qué caja es — general, Sigot o AMS?'),
  ('❓ Retiros · Cta Cte MSA (filas 113-114): JMS $ 12.151.946,28 y AMS $ 9.984.483,64. ¿Son los honorarios a facturar por mes? ¿Por qué junio de JMS va ×1,5?'),
  ('❓ Bancos · Compra-venta USD (fila 89): «Gastos X (Retiro?)» US$ 500 del 14/01/2025. ¿A quién se le pagó?'),
  ('❓ Cuentas a pagar · hoja 05 (A16): «Pendiente de emitir por arrendamiento ganadero — Plácido Alberto Martínez», sin importe. ¿Se emitió? ¿Por cuánto?'),
  ('❓ Stock insumos (E50/E51): Urea «0,7 kg» a US$ 600 y SPS «0,44 kg» a US$ 800. ¿Son toneladas (700 kg y 440 kg)?'),
  ('❓ Forrajeros (C5): el rollo de alfalfa vale «20 × dólar × 2» = $ 48.200. ¿Qué son el 20 y el 2?'),
  ('❓ Stock hacienda · columna O «STOCK SENASA 30/6/24»: ¿es en realidad el SENASA al 30/06/2025? ¿Los 80 «terneros macho» de SENASA son los 71 novillitos + 9 toritos?'),
  ('❓ Stock hacienda (A4) «SAN MANUEL S.R.L.»: ¿es el establecimiento o quedó de otra planilla?'),
  ('❓ Stock insumos (B56) Baronthal (caballos): no tiene cantidad, sólo dice «Parvo 1500 kg a peso». ¿Cuánto había al 30/06/2025?'),
  ('❓ Stock insumos: «Triple» 9,25 ml (E94) y «Kit adaptados mini – Vit >» 9,35 ml (E89). ¿Cuántas dosis eran? ¿Qué es el kit?'),
  ('❓ Stock insumos: Hemoflubrina 35 y Bovacartogen 20, en «animales» (E93/E95). ¿Son 35 y 20 dosis?'),
  ('❓ Sementeras (B12) «Soja 24/25» sale de facturas de junio 2025: ¿es la soja que se cosecha en 25/26? ¿Las labores de Moragues se activan con IVA o sin IVA?'),
  ('❓ Granos · consulta Mauricio (C37:C44) «Faltaban»: 219.230 kg de AFA en mayo y junio. ¿Son ventas que no estaban en «kl vendidos ej»?')
) v(t)
where not exists (select 1 from public.balance_pendientes p where p.texto = v.t);

commit;
