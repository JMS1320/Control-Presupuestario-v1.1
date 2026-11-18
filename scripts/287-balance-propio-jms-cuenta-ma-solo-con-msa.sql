-- 287 · BALANCE PROPIO MSA, versión JMS: en «Cuenta socios» sólo lo que Mercedes Areco le debe a MSA (DATOS)  A-FEAT-1629
-- JMS 18/11: «en el interno de MA se mezcla MA con PAM y MA con MSA en una misma cuenta… entre MA y PAM sería otra» · plan de
-- acción P4 con su OK en esta terminal («podés avanzar con todo el plan de acción de corrido»).
-- Se saca lo que pagó PAM y en lo real es de MA (Libertad pagada por PAM 6.233.331,84 + gastos propios pagados por PAM 736.214,93
-- = 6.969.546,77): es deuda de MA con PAM, no un activo de MSA. Detalle: «Cuenta interna Mercedes Areco - detalle 25-26 v2.xlsx».
-- Toca 1 fila de public.balance_foto_valores (por id). Deshacer: 287-…-deshacer.sql.

begin;

update public.balance_foto_valores set importe = 85905662.09, updated_at = now(),
       detalle = '[script 287] TENTATIVO (JMS 18/11): sólo lo que Mercedes Areco le debe a MSA = saldo con MSA 44.459.338,17 + interno pagado por MSA 21.946.323,92 + ajuste fijo 19.500.000,00. Afuera lo que pagó PAM (6.969.546,77): es deuda de MA con PAM. A confirmar: posible doble conteo de Libertad por 730.000,14. Es un anticipo (de arrendamiento o de distribución); arranca en cero. Los demás socios, en cero. NOTA DE BALANCE: Socio Plácido Martínez 45.905.575,52, el mismo saldo al inicio y al cierre, fuera del cálculo. Antes: 92875208.86 (script 285).'
 where id = '3b90311a-df44-44ed-a1a5-bc2452d2a0e0';

commit;
