

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

**19 · 17/11 noche — script 285 CORRIDO (OK de JMS en la terminal): caja real, distribución en cero, cuota solidaria y cuenta de MA**

- `scripts/285-balance-propio-jms-caja-socios-msa-2026.sql` y su deshacer. Versión JMS del balance propio de MSA:
  1. **Caja al cierre = 628.213,68** (lo real, JMS: General 0,00 · AMS 197.340,68 · Sigot 430.873,00). Antes 1.766.085,92.
  2. **Distribución de fondos en cero en las dos puntas** (antes 11.200.207,00 al 30/06/25 y 64.623.846,86 al 30/06/26).
  3. **Cuota solidaria a pagar 85.233,06** (nueva, como el contador).
  4. **Cuenta socios = 92.875.208,86, TENTATIVO**: sólo Mercedes Areco por su cuenta interna; JMS: «se tomaría como un activo en MSA
     porque es un anticipo de algo, ya sea arrendamiento o distribución». Los demás socios en cero. **Al 30/06/25 no se cargó nada
     de MA** (el export no tiene dato de inicio). **JMS 17/11: «sí, arranca en cero»** — confirmado.
  5. **Socio Plácido Martínez** (45.905.575,52 en las dos puntas): queda como **nota de balance**, fuera del cálculo (está escrita en
     el detalle del renglón «Cuenta socios»).
- **Cómo queda la versión JMS**: inicio activo 474.311.231,33 − pasivo 105.458.415,77 = 368.852.815,56 (US$ 307.249,33) · cierre
  activo 947.127.174,39 − pasivo 151.492.625,51 = 795.634.548,88 (US$ 538.500,54) · diferencia 426.781.733,32 (US$ 231.251,21).
- Página «Balance interno MSA» actualizada (v5).

**20 · 17/11 noche — la página «Balance interno MSA» pasó al FORMATO ACORDADO del balance propio (v6)**

- JMS: «¿le podrías dar el formato mío al interno?… tenemos todo lo consensuado de cómo mostrarlo, separado de corriente, no
  corriente, con los detalles de la ganancia que proviene de lo ganadero». Es el de `lib/balance/balance-propio-excel.ts`
  (A-FEAT-1190, 14/11): $ y US$ de cada punta, flujos del año (MEP, distribución) sólo en el cierre, las vacas como activo no
  corriente, ganancia desglosada y hacienda a promedio de junio. La página lo replica; los renglones salen de la base (17/11).
- **Números con el modelo** (controles ✓): ganancia total US$ 255.250,42 · − revalúo de vacas y toros 119.866,78 = del ejercicio
  135.383,64 · − reinvertido en vacas 20.525,46 · **+ aumento del pasivo por impuesto diferido 25.686,91** = líquida 140.545,09
  (= corriente) · − recría 86.341,33 = líquida sin recría 54.203,76. ⚠️ **Renglón nuevo en el desglose**: el impuesto diferido dejó
  de ser neutro (ahora es el del contador) y, como es no corriente, hace falta para que la líquida cierre contra la corriente.
  **Falta llevarlo a `balance-propio-excel.ts` (hoja «Ganancia desglosada»)**: hoy el Excel de la app daría un control distinto de 0.
  Los «activo menos pasivo» de los puntos 16 y 19 eran sumas simples (con el MEP del inicio adentro), no el modelo.
- Dentro de la líquida hay US$ 62.859,70 de la cuenta de Mercedes Areco (tentativa) y cuatro stocks neutros.
- **Página**: preguntas viejas (A1, C1–C8, D1–D4) retiradas; quedan AB1–AB6 (dólares, stocks, arrendamiento MA, camioneta, cuenta de
  MA, proveedores/tarjetas). El 💬 de cada renglón ahora se guarda como `F-B-<renglón>`. **Botón nuevo «Borrar las respuestas que
  Claude ya procesó»**: Claude marca `procesada: true` en cada respuesta que procesó y JMS las borra con el botón. Las 23 respuestas
  del 17/11 (ya asentadas en el punto 15) se movieron a la colección `respuestas_procesadas`.
- Generadores guardados en `- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude/Copias/programas/balance-interno-msa-pagina/`.

**21 · 18/11 — pedidos de JMS sobre la página del balance interno (v7) y tres verificaciones**

- **Página**: tipo de cambio arriba y en el encabezado, encabezado fijo al bajar, y **la ganancia abajo y simple** (Ganancia corriente
  US$ 140.545,09 · Ganancia total US$ 255.250,42) seguida del desglose «de dónde sale y dónde está», que **separa lo fiscal para dejar
  sola la líquida** (JMS): cría (revalúo 119.866,78 + reinvertido 20.525,46) · fiscal no corriente (impuesto diferido −25.686,91) →
  corriente 140.545,09 = recría 86.341,33 + fiscal corriente 1.750,93 + stocks −1.703,78 + **líquido 54.156,61** (controles ✓).
  Reemplaza al desglose del punto 20. Generador: `arma_interno3.py` en la carpeta de programas.
- **Saldo a favor Ganancias anteriores (27.790.561,65)**: en el 30/06/2025 no había ese renglón en ninguna versión (ni JMS ni
  contador). El crédito de Ganancias estaba en anticipos 14.474.434,24 + retenciones 13.577.503,78 + percepciones 61.910,75 =
  28.113.848,77 (diferencia contra el saldo a favor: 323.287,12, **sin explicar → preguntarle al contador**).
- **Provisión para gastos — JMS: «creo que esto no va»**: es una factura de otro ejercicio que entra por haberse originado ahí el
  gasto; si las provisionadas se pagaron, para este análisis no cuenta. **A conversar con la composición a la vista** (queda en la
  página, pregunta PV1): 2025 = 2 facturas de arrendamiento de 6.228.000,07 (Sucesión PAM 19/08/25 y María Magdalena Martínez
  17/10/25); 2026 = 10 facturas por 778.144,76 (2 de junio 2026 y 8 de diciembre 2025 que entraron al libro IVA en 10/2026). Hoy
  suma US$ 9.849,01 a la ganancia.
- **Sueldos a pagar (1.066.310,00)**: sí, son los pagos posteriores al 30/06 de períodos del ejercicio, tal cual el sistema (papel 13
  Sueldos): Sigot mayo 512.000 y junio 434.200 (pagados 24/07) · Barreto junio 120.110 (31/07).

**22 · 18/11 — script 286 CORRIDO (JMS: «provisión sacalas a las 2») · tarjeta sin duplicar · página v8**

- **Script 286** (`scripts/286-balance-propio-jms-sin-provision-gastos-msa.sql` y su deshacer): «Provisión para gastos» en 0 en las
  dos fotos de la versión JMS (antes 12.456.000,14 al 30/06/25 y 778.144,76 al 30/06/26). Motivo (JMS): es una factura de otro
  ejercicio que entra por haberse originado ahí el gasto; las provisionadas se pagaron, para este análisis no cuenta.
- **Cómo queda** (modelo, controles ✓): ganancia total **US$ 245.401,41** · corriente **US$ 130.696,07** = recría 86.341,33 + fiscal
  corriente 1.750,93 + stocks −1.703,78 + **líquido 44.307,60**. Pasivo total 93.002.415,63 → 150.714.480,75.
- **Tarjeta (JMS: «no duplicar la tarjeta como deuda en dos lugares»)** — verificado, no está duplicada: «Proveedores» 8.826.113,42 =
  11 facturas de junio pagadas en julio (6.486.568,02) + deuda de tarjeta al cierre (2.339.545,40 = resúmenes que vencen después del
  cierre + consumos hasta el 30/06). El renglón «Tarjetas» no se usa en la versión JMS. De las 11 facturas, tres peajes (6.300 +
  4.500 + 3.900 = 14.700) se pagaron con la VISA el 01 y 02/07: consumos posteriores al cierre, fuera de la deuda de tarjeta.
- **Página v8**: todo el ancho, líneas de tabla, sin el bloque de la provisión; AB6 ahora pregunta sólo si la tarjeta queda dentro de
  proveedores o en su renglón. Generador: `arma_interno4.py`.
- **JMS 18/11: «AB6 queda así, tarjeta dentro de proveedores»** — decidido; la pregunta AB6 se retiró de la página (v9).

**23 · 18/11 — detalle de la cuenta interna de Mercedes Areco (pedido de JMS)**

- Excel `- Comunicacion JMS Claude - Archivos/Balance/Balance contador 25-26 - trabajo/Cuenta interna Mercedes Areco - detalle 25-26 v1.xlsx`:
  Resumen (38 grupos con Nro) + 3 hojas de detalle, movimiento por movimiento (96 de la 14.1 · 171 de compensación interna · 1 ajuste
  fijo), subtotales que suman sus filas y control contra los 92.875.208,86 cargados. Fuente: export «Socios y Libertad» del 15/11.
  Generador `detalle_ma.py` en la carpeta de programas. **Sin abrir ni recalcular con Excel** (el total se verificó al generarlo).
- **Ídem para PAM** (pedido de JMS 18/11: ver los movimientos del ejercicio más allá del saldo): `…/Balance contador 25-26 - trabajo/Cuenta interna Sucesion Placido Martinez (PAM) - detalle 25-26 v1.xlsx` — 24 movimientos de la 14.1 (se llevó 9.858.160,16 · aportó o nos facturó 9.668.333,59 → saldo 189.826,57) + 1 de compensación interna (9.000,00) = 198.826,57 a favor de MSA. Generador único para los dos socios: `detalle_socio.py <fuentes> <salida> <MA|PAM>`.
