-- 287 · DESHACER: devuelve «Cuenta socios» a lo que dejó el script 285 (verificado en la base el 18/11, por id).

begin;

update public.balance_foto_valores set importe = 92875208.86, updated_at = now(),
       detalle = '[script 285] TENTATIVO (JMS 17/11): sólo Mercedes Areco, por su cuenta interna (export «Socios y Libertad» 15/11): saldo con MSA 44.459.338,17 + compensación interna 28.915.870,69 + ajuste fijo 19.500.000,00. Es un anticipo (de arrendamiento o de distribución). Los demás socios, en cero. NOTA DE BALANCE: Socio Plácido Martínez 45.905.575,52, el mismo saldo al inicio y al cierre, fuera del cálculo para que no pese en la ganancia.'
 where id = '3b90311a-df44-44ed-a1a5-bc2452d2a0e0' and detalle like '[script 287]%';

commit;
