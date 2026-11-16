# -*- coding: utf-8 -*-
"""PAM · Detalle 10 — Cuentas con MSA, con MA y con socios, vistas desde los bancos de la Sucesión (ítem 10).

Fuente: extracto de la base (pam/cuentas.json: movimientos de la caja de ahorro y la cuenta corriente con marca de
MSA, MA, Libertad, JMS, AMS o Mabel Rojas; pam/bancos.json: lo marcado como de MA en cada resumen de la tarjeta) y,
para el cruce, la cuenta de la Sucesión en el reporte de ítems de MSA (hoja «D10 Socios», sub-ítem 10d).

Cada grupo va por mes, con cada movimiento debajo y su ficha. NO hay un total general: son cuentas con contrapartes
distintas y sumarlas no dice nada. La cuenta con MSA se cruza contra lo que dice MSA, a la vista."""
from e_pam_comun import G_CUENTAS, EJERCICIO, MESES, ar, cargar, control, dma, fch, fila, hoja, refs

HOJA = 'D10 Cuentas'
ANCHOS = [11, 9, 34, 30, 21, 15, 15, 15]  # 150
ENC = ['Fecha', 'Cuenta de PAM', 'A quién o de quién · descripción del banco', 'Detalle', 'Categoría · código',
       'Sale de PAM $', 'Entra a PAM $', 'Neto (entra − sale) $']
GRUPOS = [
    ('MSA', '10a', 'Cuenta con MSA — retiros que MSA le giró a PAM y aportes que PAM le hizo a MSA',
     'Con categoría «Retiro de MSA» o «Aporte a MSA» (código CTA MSA). Neto positivo = PAM recibió de MSA más de lo que aportó.'),
    ('MA', '10b', 'Giros de PAM a Mercedes Areco (MA) — «Retiro MA mensual PAM»',
     'Con categoría «Distribución Mamá» (código DIST MA): transferencias a las cuentas de Mercedes Areco, CUIT 27066824611.'),
    ('LIB', '10c', 'Gastos del departamento de Libertad pagados por PAM (código LIB)',
     'ABL, expensas y gas de Libertad. En MSA estos gastos se reparten con el cuadro «Gastos Libertad»; acá va lo que pagó PAM.'),
    ('GMA', '10d', 'Otros pagos y reintegros marcados como de MA (código DIST MA), por los bancos de PAM',
     'Impuestos, expensas, ACA, gastos médicos y los reintegros de promociones del banco, marcados DIST MA en el código '
     'contable o en el interno. Incluye impuestos que dicen «PAM» en el detalle: ver pendientes.'),
    ('SOC', '10e', 'Pagos «sueldo» de PAM a José María Martínez y a Andrés Martínez (códigos CTA JMS y CTA AMS)',
     'Transferencias desde la cuenta corriente de la Sucesión con categoría «Sueldos».'),
    ('MAB', '10f', 'Sueldos y liquidación final de Mabel Rojas pagados por PAM',
     'Celia Mabel Rojas, CUIL 27203615367. Categoría «Sueldos», sin código contable ni interno.'),
    ('COT', '10h', 'Transferencias «A cuenta Cotitulares» a una cuenta a nombre de Mercedes Areco (código CTA COTITULARES)',
     'No están entre los giros a MA: llevan el código de la cuenta de los cotitulares. Van acá porque el banco muestra el CUIT de MA.'),
]


def _grupo(m):
    cta, fecha, desc, sale, entra, categ, det, cont, inte, est, prov, ley = m
    if categ in ('Retiro de MSA', 'Aporte a MSA'):
        return 'MSA'
    if cont == 'CTA COTITULARES':
        return 'COT'
    if categ == 'Distribucion Mama':
        return 'MA'
    if cont in ('CTA JMS', 'CTA AMS'):
        return 'SOC'
    if 'mabel' in ((det or '') + ' ' + (prov or '')).lower():
        return 'MAB'
    if cont == 'LIB':
        return 'LIB'
    if cont == 'DIST MA' or inte == 'DIST MA':
        return 'GMA'
    return 'OTRO'


def _codigo(categ, cont, inte):
    cods = []
    for x in (cont, inte):
        if x and x not in cods:
            cods.append(x)
    return (categ or 'sin categoría') + ' · ' + (' / '.join(cods) if cods else 'sin código')


def _por_mes(h, movs):
    """Renglones de un grupo, mes por mes, con subtotal mensual. Devuelve (filas de subtotal, fila total del grupo)."""
    meses = {}
    for m in sorted(movs, key=lambda x: (x[1], x[0])):
        meses.setdefault(m[1][:7], []).append(m)
    subt = []
    for mes, ms in meses.items():
        a = None
        for cta, fecha, desc, sale, entra, categ, det, cont, inte, est, prov, ley in ms:
            r = h.r + 1
            quien = ' — '.join(x for x in [ley or prov or 'sin dato en el extracto', desc] if x)
            if est != 'conciliado':
                quien += ' (sin conciliar)'
            fila(h, [fch(fecha), 'Caja ahorro' if cta == 'CA' else 'Cta. cte.', quien, det or 'sin detalle', _codigo(categ, cont, inte),
                     float(sale) if sale else None, float(entra) if entra else None, f'={h.cel(7, r)}-{h.cel(6, r)}'])
            a = a or r
        subt.append(h.total(f'Subtotal {MESES[int(mes[5:7]) - 1]} {mes[:4]}',
                            {6: h.suma(6, a, h.r), 7: h.suma(7, a, h.r), 8: h.suma(8, a, h.r)}, col_etiqueta=3))
    return subt


def construir(lib, src):
    d = cargar(src, 'cuentas')
    b = cargar(src, 'bancos')
    tq = d['totales_consulta']
    sm = d['segun_msa']
    h = hoja(lib, HOJA, ANCHOS)
    R = refs(lib)
    por = {}
    for m in d['movs']:
        por.setdefault(_grupo(m), []).append(m)
    res_ej = [x for x in b['visa']['resumenes'] if b['ejercicio'][0] <= x[1] <= b['ejercicio'][1]]

    h.titulo('PAM · Detalle 10 — Cuentas con MSA, con MA y con socios, desde los bancos de PAM (ítem 10)')
    h.nota(f'Sucesión de Plácido Alberto Martínez — ejercicio {EJERCICIO}. Fuente: la caja de ahorro, la cuenta corriente y la '
           f"tarjeta de la Sucesión cargadas en el sistema (extraído el {dma(d['extraido'])}), con la categoría y los códigos que "
           'tiene hoy cada movimiento; y, para el cruce, la cuenta de la Sucesión en el reporte de MSA. «Sale» = PAM pagó o giró; '
           '«Entra» = PAM recibió. Cada grupo va mes por mes, con cada movimiento debajo y su ficha (fecha, cuenta, a quién, '
           'detalle, categoría y código). NO hay un total general: son cuentas con contrapartes distintas. La Sucesión no lleva '
           'una cuenta corriente con cada uno: esto es lo que se ve desde sus bancos, no un saldo.')

    # ---------- 0 · resumen ----------
    h.blanco()
    h.seccion('0 · Resumen — cada renglón viene del total de su grupo, más abajo')
    h.encabezado(['Sub-ítem', 'Movim.', 'Qué es', None, None, 'Sale de PAM $', 'Entra a PAM $', 'Neto (entra − sale) $'])
    h.ws.merge_cells(start_row=h.r, start_column=4, end_row=h.r, end_column=6)
    f_res = {}
    for clave, sub, titulo, _ in GRUPOS[:6]:
        f_res[clave] = fila(h, [sub, len(por.get(clave, [])), titulo, None, None, '=0', '=0', '=0'], {3: 5}, fmt={2: '#,##0'})
    f_res['TAR'] = fila(h, ['10g', sum(x[13] for x in res_ej), 'Consumos de la tarjeta de PAM marcados como de MA (código DIST MA), '
                            'por resumen', None, None, '=0', '=0', '=0'], {3: 5}, fmt={2: '#,##0'})
    clave, sub, titulo, _ = GRUPOS[6]
    f_res[clave] = fila(h, [sub, len(por.get(clave, [])), titulo, None, None, '=0', '=0', '=0'], {3: 5}, fmt={2: '#,##0'})
    h.nota('Sin renglón de total a propósito: sumar la cuenta con MSA, los giros a MA y los pagos a socios mezclaría contrapartes.')

    # ---------- grupos ----------
    tot = {}
    for clave, sub, titulo, nota in GRUPOS:
        movs = por.get(clave, [])
        h.blanco()
        h.seccion(f'{sub} · {titulo}')
        h.nota(nota)
        h.encabezado(ENC, repetir=True)
        subt = _por_mes(h, movs)
        tot[clave] = h.total(f'Total {sub} — {len(movs)} movimientos', {k: h.suma_de(k, subt) for k in (6, 7, 8)}, clave=True,
                             col_etiqueta=3)
        for k in (6, 7, 8):
            h.celda(k, f_res[clave]).value = f'={h.cel(k, tot[clave])}'
        sale = sum(m[3] for m in movs)
        entra = sum(m[4] for m in movs)

        if clave == 'MSA':
            control(h, '10a: retiros recibidos de MSA, según los bancos de PAM contra la consulta', h.cel(7, tot[clave]),
                    tq['retiros_de_msa'], 'consulta a los extractos de PAM (categoría «Retiro de MSA»)')
            control(h, '10a: aportes hechos a MSA, según los bancos de PAM contra la consulta', h.cel(6, tot[clave]),
                    tq['aportes_a_msa'], 'consulta a los extractos de PAM (categoría «Aporte a MSA»)')
            # cruce con MSA
            h.blanco()
            h.seccion('10a · Cruce — lo que dicen los bancos de PAM al lado de lo que dice MSA')
            h.nota(f"Fuente de la columna «Según MSA»: {sm['fuente']}.")
            h.encabezado(['', None, 'Concepto', None, None, 'Según los bancos de PAM $', 'Según MSA $', 'Diferencia $'])
            h.ws.merge_cells(start_row=h.r, start_column=4, end_row=h.r, end_column=6)
            n_ret = len([m for m in movs if m[4]])
            n_apo = len([m for m in movs if m[3]])
            r = h.r + 1
            c_ret = fila(h, [None, None, f"Retiros: MSA le giró a PAM ({n_ret} movimientos en PAM; {sm['retiros_movs']} en MSA)", None, None,
                             f'={h.cel(7, tot[clave])}', float(sm['retiros']), f'={h.cel(6, r)}-{h.cel(7, r)}'], {3: 5})
            r = h.r + 1
            c_apo = fila(h, [None, None, f"Aportes: PAM le giró a MSA ({n_apo} movimientos en PAM; {sm['aportes_movs']} en MSA)", None, None,
                             f'={h.cel(6, tot[clave])}', float(sm['aportes']), f'={h.cel(6, r)}-{h.cel(7, r)}'], {3: 5})
            r = h.r + 1
            c_net = h.total('Neto: retiros − aportes', {6: f'={h.cel(6, c_ret)}-{h.cel(6, c_apo)}',
                                                         7: f'={h.cel(7, c_ret)}-{h.cel(7, c_apo)}',
                                                         8: f'={h.cel(6, r)}-{h.cel(7, r)}'}, col_etiqueta=3)
            control(h, '10a: retiros, PAM contra MSA', h.cel(6, c_ret), sm['retiros'], 'reporte de MSA, «D10 Socios», 10d: retiros')
            control(h, '10a: aportes, PAM contra MSA', h.cel(6, c_apo), sm['aportes'], 'reporte de MSA, «D10 Socios», 10d: aportes')

            # la cuenta en los libros de MSA
            h.blanco()
            h.seccion('10a · La cuenta de la Sucesión en los libros de MSA — cómo llega MSA a su saldo (lo que los bancos de PAM no ven)')
            h.nota('Signo de MSA: positivo = MSA le debe a la Sucesión; negativo = la Sucesión le debe a MSA. Los retiros y los '
                   'aportes apuntan a los totales de arriba (bancos de PAM); la factura, los gastos y Libertad son datos del reporte '
                   'de MSA, que en PAM no tienen registro.')
            h.encabezado(['Fecha', None, 'Concepto', None, None, None, 'Origen del dato', 'Importe $'])
            h.ws.merge_cells(start_row=h.r, start_column=4, end_row=h.r, end_column=7)
            l1 = fila(h, [fch('2025-06-30'), None, 'Saldo al inicio según MSA (el sistema arranca en 0)', None, None, None, 'MSA',
                          float(sm['saldo_inicio'])], {3: 6})
            fila(h, [fch(sm['factura_2_31_fecha']), None, 'Más: Factura C 2-31 de la Sucesión a MSA (arrendamiento)', None, None, None,
                     'MSA', float(sm['factura_2_31'])], {3: 6})
            fila(h, [None, None, 'Más: aportes de PAM a MSA (total de arriba)', None, None, None, 'bancos de PAM',
                     f'={h.cel(6, tot[clave])}'], {3: 6})
            fila(h, [None, None, 'Menos: retiros que MSA le giró a PAM (total de arriba)', None, None, None, 'bancos de PAM',
                     f'=-{h.cel(7, tot[clave])}'], {3: 6})
            r_g = fila(h, [None, None, 'Menos: gastos de la Sucesión pagados por MSA (detalle abajo)', None, None, None, 'MSA', '=0'],
                       {3: 6})
            fila(h, [fch('2025-12-31'), None, 'Menos: Libertad 1er semestre, «retiró PAM» (cuadro Gastos Libertad de MSA)', None, None,
                     None, 'MSA', float(-sm['libertad_1er_semestre_retiro_pam'])], {3: 6})
            l2 = fila(h, [fch('2026-06-30'), None, 'Más: Libertad 2do semestre, «aportó PAM» (cuadro Gastos Libertad de MSA)', None, None,
                          None, 'MSA', float(sm['libertad_2do_semestre_aporto_pam'])], {3: 6})
            r_sal = h.total('Saldo de la Sucesión en MSA al 30/06/2026 (negativo = la Sucesión le debe a MSA)',
                            {8: h.suma(8, l1, l2)}, clave=True, col_etiqueta=3)
            control(h, '10a: saldo de la Sucesión en MSA, reconstruido con los bancos de PAM', h.cel(8, r_sal), sm['saldo_cierre'],
                    'reporte de MSA, «D10 Socios», 10d: saldo al cierre según el sistema')
            h.blanco()
            h.seccion('10a · Gastos de la Sucesión pagados por MSA (dato de MSA: en PAM no hay registro de estos gastos)')
            h.encabezado(['Fecha', None, 'Concepto según MSA', None, None, None, 'Pagó', 'Importe $'])
            h.ws.merge_cells(start_row=h.r, start_column=4, end_row=h.r, end_column=7)
            a = None
            for fecha, concepto, imp in sm['gastos_detalle']:
                r = fila(h, [fch(fecha), None, concepto, None, None, None, 'MSA Galicia cta. cte.', float(imp)], {3: 6})
                a = a or r
            r_gt = h.total(f"Total gastos de la Sucesión pagados por MSA — {len(sm['gastos_detalle'])} pagos", {8: h.suma(8, a, h.r)},
                           col_etiqueta=3)
            control(h, '10a: gastos pagados por MSA', h.cel(8, r_gt), sm['gastos_pagados_por_msa'],
                    'reporte de MSA, «D10 Socios», 10d: pagos que no son retiros ni Libertad')
            h.celda(8, r_g).value = f'=-{h.cel(8, r_gt)}'
            R['msa_saldo'] = h.ref(8, r_sal)
            R['msa_neto_bancos'] = h.ref(8, tot[clave])
            saldo_py = (sm['saldo_inicio'] + sm['factura_2_31'] + sale - entra - sum(g[2] for g in sm['gastos_detalle'])
                        - sm['libertad_1er_semestre_retiro_pam'] + sm['libertad_2do_semestre_aporto_pam'])
            if abs(saldo_py - sm['saldo_cierre']) > 0.01:
                lib.pendiente('PAM · Cuenta con MSA: el saldo reconstruido no da el de MSA', f'Reconstruido {ar(saldo_py)}; MSA dice '
                              f"{ar(sm['saldo_cierre'])}.", ar(saldo_py - sm['saldo_cierre']), HOJA)
            if abs(entra - sm['retiros']) > 0.01 or abs(sale - sm['aportes']) > 0.01:
                lib.pendiente('PAM · Cuenta con MSA: retiros o aportes no coinciden con MSA', f'PAM: retiros {ar(entra)}, aportes '
                              f"{ar(sale)}. MSA: retiros {ar(sm['retiros'])}, aportes {ar(sm['aportes'])}.",
                              ar((entra - sm['retiros']) - (sale - sm['aportes'])), HOJA)
        elif clave == 'MA':
            control(h, '10b: giros a MA', h.cel(6, tot[clave]), tq['giros_a_ma'], 'consulta a los extractos de PAM (categoría «Distribución Mamá»)')
            R['ma_giros'] = h.ref(6, tot[clave])
        elif clave == 'LIB':
            control(h, '10c: Libertad pagado por PAM', h.cel(6, tot[clave]), tq['libertad_codigo_lib'], 'consulta a los extractos de PAM (código LIB)')
        elif clave == 'GMA':
            control(h, '10d: marcados MA, lo que salió', h.cel(6, tot[clave]), tq['marcados_ma_sale'],
                    'consulta a los extractos de PAM (código DIST MA sin LIB, sin los giros)')
            control(h, '10d: marcados MA, lo que entró', h.cel(7, tot[clave]), tq['marcados_ma_entra'],
                    'consulta a los extractos de PAM (reintegros de promociones marcados DIST MA)')
        elif clave == 'SOC':
            control(h, '10e: pagos «sueldo» a JMS y a AMS', h.cel(6, tot[clave]), tq['pagos_jms'] + tq['pagos_ams'],
                    'consulta a los extractos de PAM (códigos CTA JMS y CTA AMS)')
            R['socios_sueldo'] = h.ref(6, tot[clave])
        elif clave == 'MAB':
            control(h, '10f: pagos a Mabel Rojas', h.cel(6, tot[clave]), tq['mabel'], 'consulta a los extractos de PAM (detalle o beneficiario «Mabel»)')
        elif clave == 'COT':
            control(h, '10h: a cuenta Cotitulares', h.cel(6, tot[clave]), tq['a_cuenta_cotitulares'],
                    'consulta a los extractos de PAM (código CTA COTITULARES)')

        if clave == 'GMA':
            # ---------- 10g · tarjeta ----------
            h.blanco()
            h.seccion('10g · Consumos de la tarjeta de PAM marcados como de MA (código DIST MA) — por resumen')
            h.nota('Un renglón por resumen de la tarjeta cerrado en el ejercicio: lo marcado DIST MA, neto de bonificaciones. Cada '
                   'consumo está en el sistema (resúmenes de la tarjeta de la Sucesión); acá no se listan uno por uno. El pago de la '
                   'tarjeta sale de la caja de ahorro: estos importes NO se suman a los de 10d.')
            h.encabezado(['Cierre', 'Cuenta de PAM', 'Resumen', 'Movimientos marcados MA', 'Código', 'Sale de PAM $', 'Entra a PAM $',
                          'Neto (entra − sale) $'])
            a = None
            for x in res_ej:
                r = h.r + 1
                neto = x[14]
                fila(h, [fch(x[1]), 'Tarjeta', f'Resumen cerrado el {dma(x[1])}, vence el {dma(x[2])}',
                         f'{x[13]} de {x[10]} movimientos del resumen', 'DIST MA', float(neto) if neto > 0 else None,
                         float(-neto) if neto < 0 else None, f'={h.cel(7, r)}-{h.cel(6, r)}'])
                a = a or r
            tot['TAR'] = h.total(f'Total 10g — {len(res_ej)} resúmenes', {k: h.suma(k, a, h.r) for k in (6, 7, 8)}, clave=True,
                                 col_etiqueta=3)
            for k in (6, 7, 8):
                h.celda(k, f_res['TAR']).value = f'={h.cel(k, tot["TAR"])}'
            control(h, '10g: tarjeta marcada MA, neto', h.cel(8, tot['TAR']), -sum(x[14] for x in res_ej),
                    'consulta a los resúmenes de la tarjeta (código DIST MA)')

    if por.get('OTRO'):
        lib.pendiente('PAM · Cuentas: movimientos sin grupo', f"{len(por['OTRO'])} movimiento(s) del extracto no entraron en ningún "
                      'grupo de esta hoja.', ar(sum(m[3] - m[4] for m in por['OTRO'])), HOJA)

    # ---------- ítems ----------
    nombres = {'MSA': 'PAM con MSA: retiros recibidos − aportes hechos (bancos de PAM)', 'MA': 'Giros de PAM a MA (negativo = salió de PAM)',
               'LIB': 'Libertad pagado por PAM', 'GMA': 'Otros pagos marcados MA, por bancos de PAM',
               'SOC': 'Pagos «sueldo» de PAM a JMS y a AMS', 'MAB': 'Sueldos y liquidación de Mabel Rojas pagados por PAM',
               'TAR': 'Consumos de la tarjeta de PAM marcados MA', 'COT': 'Transferencias «A cuenta Cotitulares» a nombre de MA'}
    subs = {g[0]: g[1] for g in GRUPOS}
    subs['TAR'] = '10g'
    for clave in ('MSA', 'MA', 'LIB', 'GMA', 'SOC', 'MAB', 'TAR', 'COT'):
        lib.item(subs[clave], nombres[clave], h, h.cel(8, tot[clave]), G_CUENTAS, 'entra − sale de sus movimientos, mes por mes', None)

    # ---------- pendientes ----------
    P = lib.pendiente
    P('PAM · Deuda con MSA al 30/06/2025',
      f"La apertura del contador de MSA trae «Socio Plácido Martínez» por {ar(sm['apertura_contador_socio_placido'])} al 30/06/2025 y el "
      'sistema arranca la cuenta en 0. ¿Fueron dividendos, una devolución o una condonación? ¿Con qué saldo arranca la cuenta de la '
      f"Sucesión con MSA? Partiendo de 0, MSA cierra el ejercicio con la Sucesión debiéndole {ar(-sm['saldo_cierre'])}.",
      f"{ar(sm['apertura_contador_socio_placido'])} mueve el saldo al cierre en el mismo importe", HOJA)
    P('PAM · Pagos «sueldo» a José María y a Andrés Martínez',
      'Desde la cuenta corriente de la Sucesión: a José María Martínez (CUIT 23342147739) 7.250.000,00 el 28/11/2025 (detalle «Premio '
      'JMS USS 5.000…») y 1.000.000,00 + 2.341.786,19 el 30/12/2025 («JMS SUELDO»); a Plácido Andrés Martínez (CUIT 20287492546) '
      '2.000.000,00 el 30/12/2025 («AMS SUELDO»). ¿Es plata que la Sucesión puso por MSA (y entonces MSA se la debe a la Sucesión), '
      'o es a cuenta de los honorarios que los dos le facturaron a la Sucesión en junio 2026 (hoja D2)? En la cuenta de la Sucesión que '
      'lleva MSA no figuran.', '12.591.786,19', HOJA)
    P('PAM · Liquidación final de Mabel Rojas, dos veces',
      'Celia Mabel Rojas (CUIL 27203615367): liquidación final de 219.892,00 el 09/10/2025, transferida desde la cuenta corriente de la '
      'Sucesión («Mabel Liq Final»). El mismo importe figura pagado por la Caja Sigot de MSA. En la Caja Sigot cargada en el sistema no '
      'se encontró ese renglón (ni por importe ni por nombre): hay que ver la planilla de cajas. ¿Se pagó una sola vez? ¿Quién la pagó? '
      'Además la Sucesión le pagó sueldos por 429.000,00 (31/07/2025), 360.000,00 (01/09/2025) y 380.000,00 (30/09/2025): ¿de quién es '
      'empleada?', '219.892,00 (y 1.169.000,00 de sueldos)', HOJA)
    P('PAM · Giros a MA: 21.250.000 incluye los 4.000.000 del 06/08/2025',
      'Desde los bancos de la Sucesión los giros a Mercedes Areco suman 21.250.000,00 en 7 transferencias: 4.000.000,00 el 06/08/2025 '
      '(caja de ahorro, «Retiro MAM Francés») y 17.250.000,00 desde la cuenta corriente (20/11, 15/12 y 30/12/2025; 12/01, 15/01 y '
      '22/01/2026). Si del lado de MA figuran 21.250.000 de «Retiro MA mensual PAM» MÁS 4.000.000 del 06/08/2025, sobran 4.000.000: '
      'a cruzar con el banco de MA.', 'posible diferencia de 4.000.000,00', HOJA)
    P('PAM · 33.180.000 «A cuenta Cotitulares» a nombre de Mercedes Areco',
      'El 20/10/2025 (24.440.000,00) y el 29/10/2025 (8.740.000,00) la cuenta corriente de la Sucesión transfirió a «María de las '
      'Mercedes Areco» (CUIT 27066824611) con detalle «A cuenta Cotit Pesos» y código CTA COTITULARES. Es el mismo importe que entró esos '
      'días por arrendamiento de Rosello de Martí (hoja D1). ¿Es plata de los cotitulares (no de MA) y por eso no va en la cuenta con MA?',
      '33.180.000,00', HOJA)
    P('PAM · Impuestos de la Sucesión marcados como de MA desde marzo 2026',
      'El 17/03/2026 la cuenta corriente pagó «Inmobiliario PAM Cuota 1» por 1.794.257,10 y «Inmobiliario Complementario PAM Cuota 1» '
      'por 1.602.612,50, los dos con código DIST MA; hasta diciembre 2025 esos impuestos iban sin código (gasto de la Sucesión). ¿Es por '
      'el pase de los bienes de PAM a MA desde el 01/01/2026? Si no, son gasto de la Sucesión y no van en la cuenta con MA.',
      '3.396.869,60', HOJA)
    P('PAM · ABL de Libertad con dos códigos',
      'El ABL de Libertad lleva código LIB hasta enero 2026 (6 pagos) y código DIST MA en abril, mayo y junio 2026 (280.251,88 el 16/04, '
      '283.854,77 el 06/05 y 283.854,77 el 02/06): por eso esos tres quedaron en 10d y no en 10c. ¿Cuál es el código correcto?',
      '847.961,42', HOJA)
    P('PAM · Libertad: lo pagado por PAM contra el cuadro de MSA',
      f"Desde los bancos de la Sucesión se pagaron {ar(tq['libertad_codigo_lib'])} de Libertad (código LIB) en el ejercicio. El reporte de "
      f"MSA le carga a la Sucesión «Libertad 1er semestre: retiró PAM» {ar(sm['libertad_1er_semestre_retiro_pam'])} y le acredita «2do "
      f"semestre: aportó PAM» {ar(sm['libertad_2do_semestre_aporto_pam'])}. No se pudo cruzar un número con el otro: hace falta el cuadro "
      '«Gastos Libertad» con la columna de lo que pagó cada uno.', 'sin cruzar', HOJA)
    P('PAM · Gastos de la Sucesión pagados por MSA: no están en los libros de PAM',
      f"MSA pagó {ar(sm['gastos_pagados_por_msa'])} de gastos de la Sucesión en {len(sm['gastos_detalle'])} pagos (Estudio contable DDJJ PAM "
      '986.436,00 el 11/08/2025; Chano 680.000,00 el 28/11/2025; Red Vial PAM 3/4 545.029,96 el 11/09/2025; OS Manuel 240.600,00 el '
      '10/07/2025; expensas de Posadas 243.886,55 en 5 pagos; impresiones de la tasación 35.332,00 el 30/10/2025). En PAM no hay ningún '
      'registro: para el resultado de la Sucesión hay que sumarlos como gasto. «OS Manuel» y «Chano»: ¿son de la Sucesión?',
      ar(sm['gastos_pagados_por_msa']), HOJA)
    P('PAM · Aporte a MSA del 27/01/2026: el banco muestra otro nombre',
      'El aporte de 1.100.000,00 del 27/01/2026 figura en el extracto a nombre de «San Manuel SRL» con el CUIT de MSA (30617786016). MSA lo '
      'reconoce como aporte de PAM; es sólo el nombre de la cuenta destino.', 'sin efecto en el importe', HOJA)
    P('PAM · Consumos de la tarjeta marcados MA: sin el detalle uno por uno en esta hoja',
      f"Los {sum(x[13] for x in res_ej)} consumos marcados DIST MA de los {len(res_ej)} resúmenes del ejercicio van por resumen "
      f"(neto {ar(sum(x[14] for x in res_ej))}). El último nivel —cada consumo— queda en el sistema.", '', HOJA)
