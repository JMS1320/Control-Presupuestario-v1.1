"""
🧾 Decisiones MOVIMIENTO POR MOVIMIENTO del histórico MSA jul-2025 → ene-2026 (A-DAT-68, método nuevo).

NO son reglas: cada fila la decidí leyendo el movimiento (a quién se pagó, CUIT, tu detalle, fecha, importe) contra
los templates de la app y contra cómo se resolvió el MISMO caso en feb–jun 2026 en la conciliación («precedente»).
`trabajo_extracto_msa.py` sólo las copia a la planilla de trabajo.

Clave: fila del Excel «Extracto MSA - Control Presupuestario.xlsx» + fecha + importe (débito positivo, crédito
negativo) — si la fila no coincide con la fecha y el importe, el script se frena (la planilla cambió).

Destino, por prefijo (el resumen por CATEG cuenta por prefijo):
  TEMPLATE ·   va a una cuota «anterior» de ese template
  SUELDOS ·    va al módulo Sueldos (pago histórico)
  YA ESTÁ ·    ya está en la app (factura del subdiario o cuota previa): NO se carga
  NO VA ·      no se carga (otro ejercicio, pendiente aparte, etc.)
  PREGUNTA ·   no lo decido: necesito tu respuesta
  NO SE PROCESA · fuera de lo pedido en esta vuelta
"""

# fila, fecha, importe, destino, cuenta, criterio, aviso
D = []
def d(fila, fecha, importe, destino, cuenta='', criterio='', aviso=''):
    D.append(dict(fila=fila, fecha=fecha, importe=importe, destino=destino, cuenta=cuenta, criterio=criterio, aviso=aviso))

PREC = 'precedente feb–jun 2026: el mismo pago se concilió con este template'

# ── 3 · AP 1 ──────────────────────────────────────────────────────────────────────────────────────────────
for f, fe, im in [(47, '26/01/26', -3500000), (36, '27/01/26', -1100000)]:
    d(f, fe, im, 'PREGUNTA · aporte de PAM a MSA', 'Retiro PAM (distribución)',
      'Crédito de SUCESION DE PLACIDO ALBERTO MARTINEZ (CUIT de PAM): PAM le pone plata a MSA. No existe template de aportes.',
      'Propongo template nuevo «Aporte PAM» (ingreso, distribución) para que no se mezcle con los retiros y conserve tu código AP 1 (A-DEC-1009). Alternativa: ingreso dentro de Retiro PAM.')

# ── 13 · CRED P ───────────────────────────────────────────────────────────────────────────────────────────
for f, fe, im, mes in [(849, '01/07/25', 1241.83, 'junio 2025'), (711, '01/08/25', 7298.35, 'julio 2025'), (604, '01/09/25', 13064.66, 'agosto 2025'),
                        (501, '01/10/25', 16563.33, 'septiembre 2025'), (386, '03/11/25', 10489.66, 'octubre 2025'), (260, '01/12/25', 53320.87, 'noviembre 2025'),
                        (149, '02/01/26', 9024.49, 'diciembre 2025')]:
    d(f, fe, im, 'TEMPLATE · Créditos Pagados (MSA)', 'CRED P',
      f'Intereses por saldo deudor de {mes} que debita el banco. {PREC} (detalle «Interes Descubierto»). Una cuota por débito.',
      'Es el interés de junio 2025 (ejercicio 24/25) debitado el 01/07: va por la fecha del débito; avisame si preferís sacarlo.' if f == 849 else '')

# ── 15 · DIST MA ──────────────────────────────────────────────────────────────────────────────────────────
for f, fe, im, banco in [(396, '31/10/25', 3500000, 'Galicia'), (356, '10/11/25', 3000000, 'Banco Francés'), (244, '04/12/25', 4000000, 'Banco Francés'),
                          (219, '15/12/25', 1000000, 'Galicia'), (81, '12/01/26', 150000, 'Galicia')]:
    d(f, fe, im, 'TEMPLATE · Retiro MA mensual', 'Distribucion Mama',
      f'Transferencia a Maria de las Mercedes Areco (CUIT de MA) a su cuenta {banco}. {PREC}. Códigos CTA MA / DIST MA (regla del template = tu planilla).',
      'En la planilla anterior esta fila decía PRES «Tarjetas (MSA + PAM)»; en la nueva la pasaste a DIST MA: tomo la nueva.' if f == 396 else '')

# ── 17 · FIJOS BS AS ──────────────────────────────────────────────────────────────────────────────────────
for f, fe, im in [(813, '10/07/25', 1631000.11), (665, '14/08/25', 1747500.11), (573, '09/09/25', 1631000.11), (449, '14/10/25', 1524846.11)]:
    d(f, fe, im, 'TEMPLATE · Expensas Libertad', 'Expensas Libertad',
      f'Pago a Consorcio Libertad 1366 (CUIT 30-53292377-4). {PREC}. Códigos LIB / DIST MA (regla = tu planilla).')
for f, fe, im in [(795, '10/07/25', 36670.98), (690, '11/08/25', 34302.46), (572, '09/09/25', 56253.72), (450, '14/10/25', 57558.68), (343, '11/11/25', 59100.71)]:
    d(f, fe, im, 'TEMPLATE · Expensas Posadas', 'Expensas Cochera Posadas',
      f'Pago a Consorcio de Propietarios Posadas (CUIT 30-60183248-4). {PREC}.',
      'Códigos: tu planilla dice LIB; en feb–jun se conciliaron RET 3 PAM / DIST MA (regla); el template dice «No Lleva» → A-DEC-1009.')
for f, fe, im in [(777, '14/07/25', 122060.44), (651, '19/08/25', 123240.15), (553, '15/09/25', 124472.58), (443, '15/10/25', 125675.59), (326, '17/11/25', 126932.35)]:
    d(f, fe, im, 'TEMPLATE · AYSA Libertad', 'Fijos Libertad',
      'Débito automático de AYSA (consumo de Libertad, tu detalle «AYSA»/«AYSA Libertad»). Códigos LIB / DIST MA (regla = tu planilla).')

# ── 18 · FIJOS GRAL ───────────────────────────────────────────────────────────────────────────────────────
SUB = 'factura en el subdiario histórico (jul–dic 2025)'
for f, fe, im, fc in [(823, '10/07/25', 120000, '01/07/2025 $120.000'), (685, '11/08/25', 120000, '03/08/2025 $120.000'), (569, '09/09/25', 120000, '02/09/2025 $120.000'),
                       (455, '14/10/25', 180000, '01/10/2025 $180.000'), (342, '11/11/25', 180000, '03/11/2025 $180.000')]:
    d(f, fe, im, 'YA ESTÁ · factura de Miceli (cochera)', '', f'Pago a Miceli Luciana Yanina = {SUB} del {fc}, mismo importe. No va a template.')
d(54, '26/01/26', 160000, 'YA ESTÁ · factura de Miceli (cochera)', '', 'Pago a Miceli = factura ARCA 1-0003-00002570 del 04/01/2026, mismo importe.')
d(815, '10/07/25', 1082000, 'YA ESTÁ · factura de La Mercure (estudio contable)', '', f'Pago a La Mercure = {SUB} del 03/07/2025 $1.082.000, mismo importe.')
for f, fe, im, fc, dif in [(667, '14/08/25', 1129306.04, '06/08/2025 $1.146.920', '17.613,96'), (567, '09/09/25', 1129306.04, '02/09/2025 $1.146.920', '17.613,96'),
                            (454, '14/10/25', 1129306.04, '03/10/2025 $1.146.920', '17.613,96'), (338, '11/11/25', 1196654.14, '05/11/2025 $1.215.400', '18.745,86')]:
    d(f, fe, im, 'YA ESTÁ · factura de La Mercure (estudio contable)', '', f'Pago a La Mercure de la {SUB} del {fc}, neto de ${dif} (la retención de Ganancias).')
d(128, '06/01/26', 2430800, 'YA ESTÁ · factura de La Mercure (estudio contable)', '', 'Pago = factura 1-0002-00001984 del 04/12/2025 $2.430.800 (diciembre: subdiario y ARCA).')
d(48, '26/01/26', 2391964.89, 'YA ESTÁ · factura de La Mercure (estudio contable)', '', 'Pago de la factura ARCA 1-0002-00001994 del 06/01/2026 $2.430.800, neto de $38.835,11 (retención).')
d(97, '08/01/26', 36359.81, 'PREGUNTA · pago extra a La Mercure', '',
  'Tu detalle: «Estudio Contable ret de ganancias no declarada». No es una factura: parece la devolución a La Mercure de una retención que no se declaró.',
  '¿Va contra la factura de diciembre (que se pagó sin retener) o es un gasto/ajuste de SICORE? No lo cargo hasta que me digas.')
d(689, '11/08/25', 986436, 'PREGUNTA · gasto de PAM pagado por MSA', '',
  'Pago a Ameijeiras Eduardo Mauricio «Estudio Contable DDJJ PAM», tu código RET 3 PAM: es un gasto de PAM que pagó MSA. No hay factura a MSA ni template.',
  '¿Lo registramos como gasto de PAM (RET 3 PAM) en algún template, o queda fuera del histórico de MSA? (A-DEC-1009)')

# ── 19 · FIJOS SP ─────────────────────────────────────────────────────────────────────────────────────────
for f, fe, im, fc in [(810, '10/07/25', 17600, '01/07/2025 $17.600'), (686, '11/08/25', 19721.44, '01/08/2025 $19.721,44'), (570, '09/09/25', 18800, '01/09/2025 $18.800'),
                       (457, '14/10/25', 19200, '01/10/2025 $19.200'), (345, '11/11/25', 19800, '01/11/2025 $19.800')]:
    d(f, fe, im, 'YA ESTÁ · factura de ICT Net (internet)', '', f'Pago a I.C.T. Net = {SUB} del {fc}, mismo importe.')
d(136, '06/01/26', 20399.12, 'YA ESTÁ · factura de ICT Net (internet)', '', 'Pago = factura 1-0010-00010346 del 01/12/2025, mismo importe.')
d(119, '06/01/26', 21000, 'YA ESTÁ · factura de ICT Net (internet)', '', 'Pago = factura 1-0010-00010454 del 01/01/2026, mismo importe.')
d(798, '10/07/25', 14290.17, 'NO VA · factura del ejercicio anterior', '', 'Tu detalle: «ICT Net adeudado Diciembre 24 y al día». Es una factura de diciembre 2024 (ejercicio 24/25), que no está en la app.',
  'Si querés que figure como deuda pagada del ejercicio anterior, es tema del balance de apertura, no de templates.')
d(123, '06/01/26', 155.44, 'PREGUNTA · recargo de ICT Net', '', 'Tu detalle: «dif por pago fuera de término». No hay factura por esto.', 'Es un recargo chico: ¿lo dejo como diferencia de pago o lo cargo como gasto (¿en qué cuenta?)?')
for f, fe, im, fc in [(801, '10/07/25', 15755.81, '2 facturas del 01/07/2025 ($7.871,95 + $7.883,96 = $15.755,91; dif $0,10)'),
                       (687, '11/08/25', 15755.81, '2 facturas del 01/08/2025 ($7.883,98 + $7.871,97 = $15.755,95; dif $0,14)'),
                       (571, '09/09/25', 18694.71, '2 facturas del 01/09/2025 ($9.341,35 + $9.353,36 = $18.694,71)'),
                       (456, '14/10/25', 19202.65, '2 facturas del 01/10/2025 ($9.595,35 + $9.607,36 = $19.202,71; dif $0,06)'),
                       (344, '11/11/25', 20011.97, '2 facturas del 01/11/2025 ($10.011,99 + $9.999,98 = $20.011,97)')]:
    d(f, fe, im, 'YA ESTÁ · facturas de Coop. Río Tala (agua/teléfono)', '', f'Pago a la Cooperativa de Río Tala = {fc}.')
d(57, '26/01/26', 20462.94, 'YA ESTÁ · facturas de Coop. Río Tala (agua/teléfono)', '', 'Pago de las 2 facturas del 01/12/2025 ($20.011,97) + $450,97 de diferencia (¿recargo por pago tardío?).', 'Diferencia de $450,97 sin factura: la dejo como diferencia de pago salvo que me digas otra cosa.')
d(56, '26/01/26', 28053.26, 'YA ESTÁ · facturas de Coop. Río Tala (agua/teléfono)', '', 'Pago de las 2 facturas del 02/01/2026 ($13.717,98 × 2 = $27.435,96) + $617,30 de diferencia.', 'Diferencia de $617,30 sin factura: idem.')
d(807, '10/07/25', 11431.44, 'NO VA · factura del ejercicio anterior', '', 'Tu detalle: «Coop Tala Diciembre 2024». Factura de 24/25, no está en la app.')
d(804, '10/07/25', 11852.17, 'NO VA · factura del ejercicio anterior', '', 'Tu detalle: «Coop Tala Mes Junio» (junio 2025, ejercicio 24/25). No está en la app.')

# ── 21 · IMP (los 21 que no estaban) ──────────────────────────────────────────────────────────────────────
for f, fe, im, c in [(770, '15/07/25', 151442.60, '3/5'), (592, '08/09/25', 151442.60, '4/5'), (354, '10/11/25', 151442.60, '5/5')]:
    d(f, fe, im, 'PREGUNTA · Automotores Amarok (no hay template)', 'Impuesto Automotores',
      f'Pago ARBA AUTOM. «Automotores Amarok - {c}». Hay templates de Gol, Tiguan, Toyota y Voyage, no de la Amarok.',
      'Propongo crear «Imp Automotores Amarok Cuota» (MSA, Impuesto Automotores) y cargar las 3 cuotas ahí.')
for f, fe, im, c in [(769, '15/07/25', 2067776.32, '8/10'), (564, '09/09/25', 271066.38, '10/10')]:
    d(f, fe, im, 'PREGUNTA · anticipo de Ganancias del impuesto 24/25', 'Impuestos ARCA',
      f'VEP «Anticipo Ganancias SM {c}». Los anticipos 1 a 10 que vencen dic-24 → sep-25 son a cuenta del impuesto 24/25. El template «Anticipo Ganancias MSA 25/26» arranca en dic-25 (el impuesto 25/26).',
      'No es gasto del 25/26: es un pago a cuenta del 24/25. ¿Lo dejo fuera de templates (lo toma el contador contra la DDJJ 24/25) o creo «Anticipo Ganancias MSA 24/25»?')
for f, fe, im, c in [(683, '11/08/25', 66121.80, '4 de 6'), (489, '06/10/25', 61271.03, '5 de 6'), (211, '15/12/25', 66121.80, '6 de 6')]:
    d(f, fe, im, 'TEMPLATE · Imp Automotores Voyage Cuota', 'Impuesto Automotores',
      f'Pago GCBA-PVG «Automotores Voyage - Cuota {c}» (plan 2025).',
      'El template es del plan 2026 (está inactivo, cuotas desde feb-26); las cuotas 2025 entran como «anterior» con su fecha.' if f == 683 else '')
d(8, '30/01/26', 439827.26, 'YA ESTÁ · cuota previa «Imp Automotores Voyage Anual»', '', 'Pago GCBA «Automotores Voyage 2026 Anual» = la cuota que ya estaba en la app del 30/01/2026 por $439.827,00 (creada en feb-26).', 'Diferencia de $0,26 entre el banco y la cuota: no duplicar.')
d(673, '12/08/25', 46967.21, 'TEMPLATE · Autonomos MA', 'Impuestos ARCA', 'VEP «Autonomos MA»: MSA paga un impuesto de MA.', 'Códigos: tu planilla CTA MA / DIST MA; la regla del template (y feb–jun) RET 3 MA / DIST MA → A-DEC-1009.')
for f, fe, im, tpl, q in [(637, '25/08/25', 75694.56, 'SICORE 1er Quincena', '«Sicore 08 - 1ra»: 1ª quincena de agosto'),
                           (591, '08/09/25', 7244.92, 'SICORE 2da Quincena', '«Sicore 08 - 2da»: 2ª quincena de agosto'),
                           (537, '22/09/25', 131601.40, 'SICORE 1er Quincena', '«Sicore 09 - 1ra»: 1ª quincena de septiembre')]:
    d(f, fe, im, f'TEMPLATE · {tpl}', 'Retenciones ARCA', f'VEP {q}. {PREC} (los VEP de SICORE van al template de su quincena).',
      'SICORE no es gasto: es la retención que MSA ingresa por cuenta de terceros.' if f == 637 else '')
d(82, '12/01/26', 1351504.60, 'PREGUNTA · SICORE sin quincena', 'Retenciones ARCA', 'VEP con tu detalle «SICORE», sin quincena. Por la fecha (12/01) sería la 2ª quincena de diciembre, pero el importe es 10 veces lo habitual.',
  '¿Junta varias quincenas atrasadas? Decime cuáles, o lo cargo como 2ª quincena de diciembre. Además faltan los VEP de jul, oct y nov en este extracto: ¿se pagaron desde otra cuenta?')
d(560, '11/09/25', 245180.63, 'TEMPLATE · Red Vial Cuota Cholo 1 (agrupa las partidas MSA de San Pedro)', 'Impuesto Red Vial',
  'Pago a Municipalidad de San Pedro «Red VIAL MSA SP Cuota 3 de 4». En feb–jun la «Red Vial MSA Cuota 1/4» de todas las partidas MSA se concilió en Red Vial Cuota Cholo 1, con el detalle de partidas.',
  'La de Nazarenas («MSA NZ») va a Tango Parra 1: confirmá que «MSA SP» es el grupo de San Pedro.')
d(208, '17/12/25', 260407.91, 'TEMPLATE · Red Vial Cuota Cholo 1 (agrupa las partidas MSA de San Pedro)', 'Impuesto Red Vial', 'Pago a Municipalidad de San Pedro «Red VIAL MSA SP Cuota 4 de 4». Mismo criterio que la 3 de 4.')
d(559, '11/09/25', 545029.96, 'PREGUNTA · Red Vial de PAM pagada por MSA', 'Impuesto Red Vial',
  'Pago a Municipalidad de San Pedro «Red Vial PAM 3/4», tu código RET i PAM. En feb–jun las de PAM fueron a Red Vial Cuota Tapera 1 / Tapera 3 con RET 3 PAM.',
  '¿A cuál de los templates de PAM va (Tapera 1, Tapera 3, otro)? Códigos RET 3 PAM (A-DEC-1009).')
d(206, '18/12/25', 820669.30, 'TEMPLATE · Inmobiliario Complementario Cuota MSA', 'Impuesto inmobiliario Complementario',
  f'Débito Ministerio de Hacienda «INMOBILIARIO COMP - MSA CUOTA 4/4 - Adicional». {PREC}. En la base no hay boletas ARBA de 2025: no hay doble carga.')
d(204, '18/12/25', 1511909.80, 'TEMPLATE · Inmobiliario Cuota Rojas (agrupa las partidas MSA)', 'Impuesto inmobiliario',
  f'Pago ARBA LIQ. INT «INMOBILIARIO SAN MANUEL CUOTA 4/4 - Adicional Rojas». {PREC} (la liquidación integrada de MSA se concilió en Inmobiliario Cuota Rojas, con el detalle de partidas).')
d(202, '18/12/25', 1026690.80, 'TEMPLATE · Inmobiliario Cuota Lima', 'Impuesto inmobiliario',
  f'Pago ARBA INMOB. «Inmobiliario Lima MA cuota adicional»: MSA paga un impuesto de MA. {PREC}.', 'Códigos: tu planilla CTA MA / DIST MA; feb–jun RET 3 MA / DIST MA → A-DEC-1009.')
d(9, '30/01/26', 13394.50, 'PREGUNTA · ABL Posadas cuotas 11 y 12 de 2025', 'ABL Cochera Posadas',
  'Compra con débito «ABL 2831491» = ABL de la cochera Posadas, cuotas 11 y 12 de 2025, pagadas en enero.',
  'Template «ABL Cochera Posadas Cuota» (PAM, inactivo). Códigos: tu planilla LIB / RET MA; el template «No Lleva» → A-DEC-1009. No es la cuota anual 2026 de $48.068,04 que ya estaba.')

# ── 37 · RET ──────────────────────────────────────────────────────────────────────────────────────────────
for f, fe, im in [(460, '14/10/25', 1200000), (459, '14/10/25', 100000), (458, '14/10/25', 100000), (357, '10/11/25', 1050000)]:
    d(f, fe, im, 'TEMPLATE · Retiro PAM', 'Retiro PAM', f'Transferencia a Placido Alberto Martinez (CUIT de PAM), tu detalle «Retiro PAM». {PREC}. Código RET 1 PAM.')

# ── 41 · SUELD (sólo JMS, AMS y Manuel, como pediste) ─────────────────────────────────────────────────────
PER = 'Período propuesto: el pago de fin de mes es de ese mes; el de los primeros días, saldo del mes anterior.'
for f, fe, im, mes in [(729, '31/07/25', 2062503.57, 'julio'), (629, '29/08/25', 1200000, 'agosto'), (613, '01/09/25', 900000, 'agosto'),
                        (524, '26/09/25', 950000, 'septiembre'), (515, '30/09/25', 1143205.38, 'septiembre'), (377, '05/11/25', 1000000, 'octubre'),
                        (376, '05/11/25', 1093205, 'octubre'), (284, '28/11/25', 2227857, 'noviembre')]:
    d(f, fe, im, f'SUELDOS · JMS · {mes} 2025', 'CTA JMS', f'Transferencia a Martinez Jose Maria (CUIT 23-34214773-9), tu detalle «JMS SUELDO». {PREC.replace("template", "módulo Sueldos")}. {PER}',
      'No hay pagos a JMS en octubre ni diciembre en este extracto.' if f == 729 else '')
for f, fe, im, mes in [(732, '31/07/25', 1500000, 'julio'), (612, '01/09/25', 1600000, 'agosto'), (547, '16/09/25', 172355, 'septiembre'),
                        (516, '30/09/25', 2500000, 'septiembre'), (481, '07/10/25', 537757, 'septiembre'), (399, '31/10/25', 1000000, 'octubre'),
                        (373, '05/11/25', 2016212, 'octubre'), (369, '05/11/25', 43089, 'octubre'), (285, '28/11/25', 1949074, 'noviembre'),
                        (222, '12/12/25', 298094, 'noviembre'), (109, '06/01/26', 1575213, 'diciembre')]:
    d(f, fe, im, f'SUELDOS · AMS · {mes} 2025', 'CTA AMS', f'Transferencia a Martinez Placido Andres (CUIT 20-28749254-6), tu código AMS CTA. {PREC.replace("template", "módulo Sueldos")}. {PER}',
      'Esta fila está en tu CATEG VER, sin detalle; por el CUIT y tu código «AMS CTA» es un pago a AMS.' if f == 547 else
      ('Tu nota: son pagos a AMS contra sus facturas, pero se registran como sueldo (sueldo histórico).' if f == 732 else ''))
for f, fe, im, txt in [(664, '14/08/25', 531946, 'reintegros (combustible + varios = $80.000) + 22 horas × $20.543'),
                        (436, '20/10/25', 271988.10, '11 horas + $35.000 de gastos'), (372, '05/11/25', 429343.03, '19 horas de octubre + $20.000 de combustible'),
                        (278, '28/11/25', 1038141.62, '41 horas de noviembre + $98.000 de combustible'), (113, '06/01/26', 1002270, '39 horas de diciembre + $108.000 de combustible')]:
    d(f, fe, im, 'PREGUNTA · Manuel Martinez (horas + gastos)', '', f'Transferencia a Manuel Martinez (CUIT 24-24754471-9): {txt}. Tu código «X».',
      'Manuel no está como empleado en Sueldos, y sus 2 pagos de feb–jun siguen sin conciliar en la app. ¿Lo damos de alta en Sueldos (por hora) y separamos los gastos de combustible, o va a otro lado?' if f == 664 else 'Mismo caso que el del 14/08.')

# ── 44 · USS ──────────────────────────────────────────────────────────────────────────────────────────────
d(704, '04/08/25', -45431590.72, 'NO VA · pendiente aparte (A-DAT-81)', '', 'Rescate FIMA por venta de dólares vía Galicia Securities; fondeó el plazo fijo 01 el mismo día. Dijiste «por ahora dejalo así».')
d(703, '04/08/25', -0.29, 'NO VA · pendiente aparte (A-DAT-81)', '', 'Centavos de la misma operación de venta de dólares.')

# ── 46 · VER (la de AMS está arriba, en SUELD) ────────────────────────────────────────────────────────────
d(562, '10/09/25', 245038.54, 'PREGUNTA · Federación Patronal (¿qué póliza?)', 'Seguros Estructura',
  'Débito automático de Federación Patronal, tu detalle «Federacion Patronal». En feb–jun sus débitos fueron a Seguro Flota (~$568 mil por mes), Seguro Accidentes de Trabajo (~$24 mil) o a una factura.',
  'El importe no coincide con ninguno: ¿es una cuota de Seguro Flota, otra póliza, o tiene factura?')
