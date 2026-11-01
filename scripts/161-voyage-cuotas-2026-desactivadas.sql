-- 161 · VOYAGE: LAS CUOTAS 2026 DEL TEMPLATE DE CUOTAS, DESACTIVADAS (DATOS) — A-BUG-1477 — OK de JMS 01/11 («voyage debe
-- quedar las cuotas desactivadas y el anual activado con su cuota anual paga y conciliada»).
--
-- El template «Imp Automotores Voyage Cuota» 2026 (c8abaa5e…) ya está desactivado (el anual 863e7c88… activo, su cuota del
-- 30/01/2026 $ 439.827,26 conciliada en Galicia), pero sus 6 cuotas quedaron «pendiente». Se pasan a «desactivado», que es
-- lo mismo que hace el pase a anual (usePagoAnual): así el balance deja de contar $ 244.347 del 25/26 como gasto y deuda.
-- ✅ CORRIDO 01/11/2026: 6 cuotas (62e80460, b043e304, fb3ef6fe, adb1c361, 61a1f46d, a5092b0f). Deshacer: 161-…-deshacer.sql (por ids).

update public.cuotas_egresos_sin_factura set estado = 'desactivado'
 where egreso_id = 'c8abaa5e-690b-4017-b74c-1c80060c6c0e' and estado = 'pendiente'
returning id, fecha_estimada, monto;
