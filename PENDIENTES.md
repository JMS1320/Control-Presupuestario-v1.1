

**16 · 17/11 noche — script 284 CORRIDO (JMS: «E1 ok») y dos pendientes visibles del balance interno**

- **Script 284** (`scripts/284-balance-propio-jms-fiscal-del-contador-msa-2026.sql` y su deshacer): en la versión JMS del balance
  propio de MSA al 30/06/2026, lo fiscal pasó a ser lo del contador. 9 filas actualizadas y 2 nuevas, verificadas iguales a la
  versión contador: retenciones 18.872.189,78 · percepciones 259.692,28 · saldo a favor de Ganancias 27.790.561,65 (nueva) · IVA
  libre disponibilidad 337.160,55 · IVA saldo técnico 18.657.003,88 · impuesto al cheque 1.931.152,86 · IVA a computar 137.765,76
  (nueva) · Ganancias a pagar 18.072.967,28 · impuesto diferido 120.168.309,48. **Anticipos de Ganancias y saldo a favor de IIBB
  quedaron en 0** (el contador no los tiene). Efecto: activo +5.536.746,69 · pasivo +40.902.160,55 → activo menos pasivo al cierre
  pasa de 803.971.706,04 a **768.606.292,18**. Cada fila guarda en su detalle el valor anterior.
- **Pendientes visibles del trabajo de balance interno (JMS 17/11)**:
  1. **Arrendamiento que MA le factura a MSA**: importe de la factura y cómo entra al interno.
  2. **Camioneta vendida**: descontarla como menor valor en el activo; hoy no hay renglón de bienes de uso en la versión JMS.

**17 · 17/11 noche — anotaciones de JMS sobre la planilla del contador (columna G): el criterio del balance interno, cuenta por cuenta**

JMS las escribió en el mismo archivo del balance presentado (columnas F y G; los saldos del contador no cambiaron y están en
`balance_contador_cuentas`). Copia con las anotaciones:
`- Comunicacion JMS Claude - Archivos/Balance/Balance contador 25-26 - trabajo/Balance MS AGRO SRL 2026 - con anotaciones JMS 17-11 v1.xlsx`.

1. **Caja, caja dólares y los 4 bancos**: saldo propio según nuestro extracto.
2. **Deudores por ventas**: nuestro saldo de «pendientes de cobro» (papel de trabajo que hoy da cero). **Cambio a hacer en el
   papel**: al provisionar una venta se pregunta si ya se cobró; si no, queda como pendiente de cobro y suma al activo. Hoy está en
   la provisión de ventas pero no en pendientes de cobro.
3. **Retenciones y percepciones de Ganancias, IVA técnico, IVA libre disponibilidad, impuesto al cheque, IVA a computar, saldo a
   favor de Ganancias**: tomar el contador, **y poner también lo nuestro en la medida que tengamos el dato**. Ganancias a pagar:
   contador, y calcularlo cuando se pueda. Pasivo por impuesto diferido: contador.
4. **Anticipos a proveedores**: se llena con nuestros pagos a cuenta de facturas por venir; **este año es cero**.
5. **Cuentas de socios** (marcadas con x): Soledad, Mercedes (hija) y Manuel **quedan en cero** · José y Andrés **tentativo en
   cero** · Plácido **tentativo tal cual: mismo saldo al inicio y al cierre** (45.905.575,52) · Mercedes Areco **tentativo el saldo
   de nuestros papeles de trabajo**.
6. **Equinos y todos los bienes de uso con sus amortizaciones**: no van.
7. **Vacas de cría**: promedio de junio sobre los valores de cada categoría, desglosado en cría y recría.
8. **Insumos para la producción ganadera y Rollos y fardos**: no van; lo que se active se activa por sementeras e insumos.
9. **Proveedores y las dos tarjetas**: según deudas al cierre. **SUSS**: el último siempre va como deuda. **Cuota solidaria**:
   incluida en el total de SUSS.
10. **Patrimonio neto** (6 cuentas): no va. **Todas las cuentas de resultado** (ventas, gastos, impuestos, amortizaciones): no van,
    «porque nosotros tomamos la diferencia de punta a punta».

**18 · 17/11 noche — respuestas de JMS a las preguntas sobre sus anotaciones (nada aplicado todavía en la base)**

1. **Socios José y Andrés / distribución de fondos**: «en principio cero en las dos puntas».
2. **Socio Plácido Martínez**: el mismo saldo (45.905.575,52) al inicio y al cierre, **sin influencia en la ganancia** (convertido a
   dólares en cada punta daría un resultado que no es). Falta definir cómo se carga para que no pese en el resultado en dólares.
3. **Cuota solidaria**: por ahora como el contador (SUSS 2.495.547,51 y cuota solidaria 85.233,06 aparte). **Para el balance en
   línea** (que será dos: interno y contable): el total que JMS carga en el template de cargas sociales es **la suma de las dos**.
4. **Camioneta vendida** y **arrendamiento de MA a MSA**: siguen como pendientes visibles (punto 16).
5. **Deudores por ventas**: el papel «pendientes de cobro» del sistema da cero, pero en este balance va el monto actual
   (50.000.850,00 — ya está en la versión JMS). El cambio del papel queda como desarrollo.
6. **«Poner también lo que tenemos» en lo fiscal**: es para cuando lo calculemos nosotros: si tenemos el dato se usa; si no, neutro
   o se le pide al contador.
7. **Caja — hallazgo**: el balance propio tiene 1.766.085,92 = «Caja General 457.212,92» (en realidad la suma de las tres cajas al
   30/06/2025, que la app nunca movió) + Caja Sigot 1.308.873,00 (saldo de la app al último movimiento cargado, 19/05/2026) + AMS 0.
   El Anexo A del reporte (hoja «D5 Caja y bancos») usa la planilla de cajas de AMS «- CAJA 25-26.xlsx»: General 0,00 + AMS
   197.340,68 + Sigot 430.873,00 = **628.213,68** al cierre (inicio 40.000,00 + 110.550,92 + 306.662,00 = 457.212,92). La caja de la
   app no tiene la carga inicial completa (A-TEST-1382): General 0 movimientos, AMS 2, Sigot 79 (05/02 a 19/05/2026).
   **Propuesto a JMS**: caja al cierre = 628.213,68 (baja 1.137.872,24).
8. **Cuenta interna de Mercedes Areco (92.875.208,86 a favor de MSA), por agrupados** (export «Socios y Libertad» del 15/11):
   saldo con MSA 44.459.338,17 + compensación interna 28.915.870,69 + ajuste fijo 19.500.000,00 (lo facturado/sueldo que en lo
   real no se cuenta). El detalle por agrupado se le dio a JMS en el chat el 17/11 para que elija qué saldo va.
