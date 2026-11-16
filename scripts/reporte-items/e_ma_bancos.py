# -*- coding: utf-8 -*-
"""MA · D5 Bancos — las cuentas bancarias y la tarjeta de MA: saldos en las puntas y, por mes, débitos, créditos y saldo.

Fuente: ma/bancos.json (agregados por mes de los extractos cargados; el saldo de fin de mes es el del extracto).
La cadena de saldos se muestra: saldo anterior − débitos + créditos contra el saldo del extracto, mes por mes.
Pesos y dólares van en tablas separadas."""
from core import ENTERO
from e_ma_comun import EJERCICIO, GRUPO_B, ar, cerca, dma, fecha, fila, hoja, leer, mes_largo

D = 'D5 Bancos'
USD = '#,##0.00_);\\(#,##0.00\\);"-"??_);@_)'


def _cuenta(lib, h, c, foto_3112, foto_3006):
    """Bloque de una cuenta en pesos. Devuelve (celda saldo 31/12, celda saldo 30/06, celda débitos, celda créditos)."""
    h.blanco()
    h.seccion(c['nombre'])
    h.nota(f"Primer movimiento cargado: {dma(c['primer'])} · último cargado: {dma(c['ultimo'])} · {c['movimientos']} movimientos "
           f"en total. {c['arranque_txt']}")
    h.encabezado(['Mes', 'Movi-mientos', 'Débitos', 'Créditos', 'Saldo del extracto a fin de mes',
                  'Saldo calculado (anterior − débitos + créditos)', 'Diferencia (salto en la cadena)'])
    meses = {m[0]: m for m in c['meses']}
    r_ini = h.fila(['Saldo antes del primer movimiento cargado', None, None, None, float(c['saldo_arranque'])])
    r_prev = r_ini
    r_mes = {}
    r_sem = []
    saldo = c['saldo_arranque']
    for tit, tramo in (('1er semestre (julio a diciembre de 2025)', EJERCICIO[:6]),
                       ('2do semestre (enero a junio de 2026)', EJERCICIO[6:])):
        a = h.r + 1
        for m in tramo:
            r = h.r + 1
            if m in meses:
                x = meses[m]
                h.fila([mes_largo(m), int(x[1]), float(x[2]), float(x[3]), float(x[4]),
                        f"={h.cel(5, r_prev)}-{h.cel(3, r)}+{h.cel(4, r)}", f"={h.cel(5, r)}-{h.cel(6, r)}"], fmt={2: ENTERO})
                if not cerca(saldo - x[2] + x[3], x[4]):
                    lib.pendiente(f"Bancos MA: salto en la cadena de saldos — {c['nombre']}",
                                  f"{mes_largo(m)}: saldo anterior $ {ar(saldo)} − débitos $ {ar(x[2])} + créditos $ {ar(x[3])} = "
                                  f"$ {ar(saldo - x[2] + x[3])}, y el extracto dice $ {ar(x[4])}.",
                                  f"diferencia $ {ar(x[4] - (saldo - x[2] + x[3]))}", D)
                saldo = x[4]
                r_prev = r
            else:
                antes = m < c['meses'][0][0]
                h.fila([mes_largo(m) + (' — todavía sin movimientos cargados' if antes else ' — sin movimientos'),
                        0, 0.0, 0.0, f"={h.cel(5, r_prev)}", f"={h.cel(5, r_prev)}-{h.cel(3, r)}+{h.cel(4, r)}",
                        f"={h.cel(5, r)}-{h.cel(6, r)}"], fmt={2: ENTERO})
                r_prev = r
            r_mes[m] = r
        r_sem.append(h.total(f"Total {tit}", {k: h.suma(k, a, h.r) for k in (2, 3, 4, 7)}, fmt={2: ENTERO}))
    r_ej = h.total('Total del ejercicio (01/07/2025 al 30/06/2026)', {k: h.suma_de(k, r_sem) for k in (2, 3, 4, 7)},
                   clave=True, fmt={2: ENTERO})
    r_31 = h.fila(['Saldo al 31/12/2025 (saldo del extracto)', None, None, None, f"={h.cel(5, r_mes['2025-12'])}"], negrita=True)
    r_30 = h.fila(['Saldo al 30/06/2026 (saldo del extracto)', None, None, None, f"={h.cel(5, r_mes['2026-06'])}"], negrita=True)
    r_cam = h.fila(['Por el otro camino: saldo de arranque − débitos + créditos del ejercicio', None, None, None,
                    f"={h.cel(5, r_ini)}-{h.cel(3, r_ej)}+{h.cel(4, r_ej)}"])
    h.control(f"{c['nombre']}: arranque − débitos + créditos contra el saldo del extracto al 30/06/2026", h.cel(5, r_cam),
              meses['2026-06'][4] if '2026-06' in meses else saldo, 'saldo del último movimiento de junio de 2026')
    h.control(f"{c['nombre']}: saldo al 31/12/2025 contra el balance propio de MA", h.cel(5, r_31), foto_3112,
              'balance propio de MA, renglón Bancos al 31/12/2025')
    h.control(f"{c['nombre']}: saldo al 30/06/2026 contra el balance propio de MA", h.cel(5, r_30), foto_3006,
              'balance propio de MA, renglón Bancos al 30/06/2026')
    # verificación en Python
    deb = sum(m[2] for m in c['meses'] if m[0] in EJERCICIO)
    cre = sum(m[3] for m in c['meses'] if m[0] in EJERCICIO)
    if not cerca(c['saldo_arranque'] - deb + cre, saldo):
        lib.pendiente(f"Bancos MA: {c['nombre']} no cierra", f"arranque − débitos + créditos = $ "
                      f"{ar(c['saldo_arranque'] - deb + cre)} vs saldo al cierre $ {ar(saldo)}", 'Control en REVISAR', D)
    return h.cel(5, r_31), h.cel(5, r_30), deb, cre


def construir(lib, src):
    d = leer(src, 'bancos')
    f = d['foto']
    v = d['visa']
    #               1 Mes/concepto 2 Mov 3 Débitos 4 Créditos 5 Saldo extracto 6 Saldo calculado 7 Diferencia
    h = hoja(lib, D, [44, 10, 18, 18, 20, 20, 20])
    h.titulo('D5 · Bancos y tarjeta de MA — saldos y movimiento por mes, ejercicio 01/07/2025 al 30/06/2026')
    h.nota('Fuente: los extractos de las cuentas de MA cargados en el sistema. Débitos = plata que salió; créditos = plata que '
           'entró. El saldo de fin de mes es el que trae el extracto en el último movimiento del mes. Al lado se recalcula '
           '(saldo anterior − débitos + créditos): si la cadena de saldos tuviera un salto, aparece en la columna «Diferencia».')
    h.nota('Pesos y dólares van en tablas separadas y no se suman entre sí. La tarjeta es una deuda: va aparte y no entra en el '
           'total de bancos.')

    # 1) resumen
    h.blanco()
    h.seccion('1 · Resumen — saldos en pesos')
    h.encabezado(['Cuenta', '', '', '', 'Saldo al 30/06/2025', 'Saldo al 31/12/2025', 'Saldo al 30/06/2026'])
    r_res = {}
    for c in d['cuentas']:
        r_res[c['clave']] = h.fila([c['nombre'], None, None, None, 'sin cargar', '=0', '=0'])
    claves = [c['clave'] for c in d['cuentas']]
    r_tot = h.total('Total ítem 5 — bancos de MA en pesos',
                    {k: h.suma(k, r_res[claves[0]], r_res[claves[-1]]) for k in (6, 7)}, clave=True)
    h.control('bancos en pesos al 31/12/2025', h.cel(6, r_tot), f['galicia_3112'] + f['anses_3112'],
              'balance propio de MA, renglón Bancos al 31/12/2025')
    h.control('bancos en pesos al 30/06/2026', h.cel(7, r_tot), f['galicia_3006'] + f['anses_3006'],
              'balance propio de MA, renglón Bancos al 30/06/2026')
    h.nota('«Sin cargar»: ninguna cuenta de MA tiene movimientos cargados antes de octubre de 2025, así que no hay saldo del '
           'extracto al 30/06/2025. Cuentas en dólares: ' + ' y '.join(f"«{n}»" for n in d['dolares_vacias'])
           + ' existen en el sistema y no tienen ningún movimiento cargado. La cuenta de MA en el Banco Francés no está cargada.')

    # 2) cada cuenta en pesos
    tot_deb = tot_cre = 0.0
    for c in d['cuentas']:
        c31, c30, deb, cre = _cuenta(lib, h, c, f[c['clave'] + '_3112'], f[c['clave'] + '_3006'])
        h.celda(6, r_res[c['clave']]).value = f"={c31}"
        h.celda(7, r_res[c['clave']]).value = f"={c30}"
        tot_deb += deb
        tot_cre += cre

    # 3) cuentas en dólares
    h.blanco()
    h.seccion('Cuentas en dólares (US$) — sin movimientos cargados')
    h.encabezado(['Cuenta', 'Movi-mientos', '', '', 'Saldo al 31/12/2025 en US$', 'Saldo al 30/06/2026 en US$', ''])
    for n in d['dolares_vacias']:
        h.fila([n, 0, None, None, 'sin datos', 'sin datos'], fmt={2: ENTERO})

    # 4) tarjeta en pesos
    h.blanco()
    h.seccion(f"{v['nombre']} — en pesos, resumen por resumen")
    h.nota(f"Primer consumo cargado: {dma(v['primer'])} · último resumen cargado: cierre del {dma(v['ultimo'])}. «Total del resumen» "
           '= consumos − devoluciones: es lo que se paga al vencimiento desde la caja de ahorro.')
    h.encabezado(['Resumen (cierre → vencimiento)', 'Consu-mos', 'Consumos', 'Devoluciones', 'Total del resumen a pagar', '', ''])
    a = h.r + 1
    for x in v['resumenes']:
        r = h.r + 1
        h.fila([f"Cierre {dma(x[0])} → vence {dma(x[1])}", int(x[2]), float(x[3]), float(x[4]),
                f"={h.cel(3, r)}-{h.cel(4, r)}"], fmt={2: ENTERO})
        if not cerca(x[3] - x[4], x[5]):
            lib.pendiente('Tarjeta MA: consumos − devoluciones no da el total del resumen', f"cierre {dma(x[0])}: "
                          f"$ {ar(x[3] - x[4])} vs $ {ar(x[5])}", '', D)
    r_vt = h.total('Total de los resúmenes cerrados y vencidos hasta el 30/06/2026', {k: h.suma(k, a, h.r) for k in (2, 3, 4, 5)},
                   fmt={2: ENTERO})
    p = v['pagos_por_el_banco_ejercicio']
    r_pg = h.fila([f"Pagos de tarjeta que salieron de la caja de ahorro Galicia en el ejercicio ({p['n']} débitos)", None, None,
                   None, float(p['importe'])])
    r_df = h.fila(['Diferencia: pagado por el banco − resúmenes en pesos', None, None, None,
                   f"={h.cel(5, r_pg)}-{h.cel(5, r_vt)}"])
    usd_pagados = sum(x[6] for x in v['resumenes'])
    h.nota(f"La diferencia no está identificada movimiento por movimiento. Lo más probable (inferido, no verificado): es la parte en "
           f"dólares de los resúmenes (US$ {ar(usd_pagados)} en total, tabla de abajo) que se pagó en pesos.")
    ab = v['abierto_al_cierre']
    h.blanco()
    r_31 = h.fila(['Deuda de tarjeta al 31/12/2025: resumen que cerró ese día (venció el 09/01/2026)', None, None, None,
                   f"={h.cel(5, a + 3)}"], negrita=True)
    r_30 = h.fila([f"Deuda de tarjeta al 30/06/2026: consumos hasta el 30/06 del resumen abierto (cierra el {dma(ab['cierre'])})",
                   int(ab['consumos_hasta_3006_n']), None, None, float(ab['consumos_hasta_3006'])], negrita=True, fmt={2: ENTERO})
    h.nota(f"Ese resumen cerró el {dma(ab['cierre'])} por $ {ar(ab['total_resumen'])}: la diferencia con la deuda al 30/06 "
           f"($ {ar(ab['total_resumen'] - ab['consumos_hasta_3006'])}) son consumos del 01 y 02 de julio de 2026.")
    if v['resumenes'][3][0] != '2025-12-31':
        raise SystemExit('D5 Bancos: el 4° resumen ya no es el del 31/12/2025')
    h.control('deuda de tarjeta en pesos al 31/12/2025', h.cel(5, r_31), f['visa_3112'],
              'balance propio de MA, renglón Tarjeta (parte en pesos)')
    h.control('deuda de tarjeta en pesos al 30/06/2026', h.cel(5, r_30), f['visa_3006'],
              'balance propio de MA, renglón Tarjeta (parte en pesos)')

    # 5) tarjeta en dólares
    h.blanco()
    h.seccion(f"{v['nombre']} — en DÓLARES (US$), aparte")
    h.encabezado(['Resumen (cierre → vencimiento)', '', '', '', 'Consumos en US$', '', ''])
    a2 = h.r + 1
    for x in v['resumenes']:
        h.fila([f"Cierre {dma(x[0])} → vence {dma(x[1])}", None, None, None, float(x[6])], fmt={5: USD})
    h.total('Total en US$ de los resúmenes cerrados', {5: h.suma(5, a2, h.r)}, fmt={5: USD})
    r_u31 = h.fila(['Deuda de tarjeta en US$ al 31/12/2025 (resumen del 31/12/2025)', None, None, None, f"={h.cel(5, a2 + 3)}"],
                   negrita=True, fmt={5: USD})
    r_u30 = h.fila(['Deuda de tarjeta en US$ al 30/06/2026 (resumen abierto)', None, None, None, float(ab['usd_hasta_3006'])],
                   negrita=True, fmt={5: USD})
    h.control('deuda de tarjeta en US$ al 31/12/2025', h.cel(5, r_u31), f['visa_usd_3112'],
              'balance propio de MA, renglón Tarjeta (parte en dólares)')
    h.control('deuda de tarjeta en US$ al 30/06/2026', h.cel(5, r_u30), f['visa_usd_3006'],
              'balance propio de MA, renglón Tarjeta (parte en dólares)')

    # 6) efectivo
    h.blanco()
    h.seccion('Efectivo que salió de las cuentas y no tiene caja donde seguirlo')
    h.encabezado(['Concepto', 'Extrac-ciones', 'Importe', '', '', '', ''])
    a3 = h.r + 1
    for t, n, imp in d['efectivo']:
        fila(h, [t, int(n), float(imp)], fmt={2: ENTERO})
    r_ef = h.total('Total extraído en efectivo en el ejercicio', {2: h.suma(2, a3, h.r), 3: h.suma(3, a3, h.r)}, fmt={2: ENTERO})

    # 7) sin identificar
    h.blanco()
    h.seccion('Transferencias a terceros sin destinatario ni categoría (caja de ahorro Galicia)')
    h.encabezado(['Fecha · concepto', '', 'Importe', '', 'Estado', '', ''])
    a4 = h.r + 1
    for fe, t, imp, est in d['sin_identificar']:
        h.fila([f"{dma(fe)} · {t}", None, float(imp), None, est])
    h.total('Total sin identificar', {3: h.suma(3, a4, h.r)})

    # --- ítems ---
    lib.item('5', 'Bancos de MA en pesos — saldo al 30/06/2026', h, h.cel(7, r_tot), GRUPO_B,
             'caja de ahorro Galicia + caja de ahorro de la jubilación; por mes en D5')
    for c in d['cuentas']:
        lib.item('5a' if c['clave'] == 'galicia' else '5b', c['nombre'], h, h.cel(7, r_res[c['clave']]), GRUPO_B,
                 f"movimientos cargados del {dma(c['primer'])} al {dma(c['ultimo'])}")
    lib.item('5c', 'Tarjeta VISA de MA — deuda en pesos al 30/06/2026', h, h.cel(5, r_30), GRUPO_B,
             'consumos hasta el 30/06 del resumen abierto; es deuda, no entra en el ítem 5')
    lib.item('5d', 'Tarjeta VISA de MA — deuda en dólares al 30/06/2026 (US$)', h, h.cel(5, r_u30), GRUPO_B,
             'en US$, no sumada a los pesos')
    lib.item('5e', 'Efectivo extraído en el ejercicio, sin caja registrada', h, h.cel(3, r_ef), GRUPO_B,
             'extracciones por cajero y autoservicio; informativo')

    # --- pendientes ---
    sem = sum(x[2] for x in d['efectivo'][2:])
    lib.pendiente('MA no tiene caja registrada: el efectivo extraído no tiene destino',
                  ' ‖ '.join(f"{t}: {n} por $ {ar(imp)}" for t, n, imp in d['efectivo'])
                  + f". En el semestre 01/01–30/06/2026 son $ {ar(sem)}.",
                  f"$ {ar(sum(x[2] for x in d['efectivo']))} en el ejercicio que no se sabe en qué se gastó (¿gastos personales, "
                  'pagos a proveedores con factura «pendiente», retiros?)', D)
    lib.pendiente('La cuenta de MA en el Banco Francés no está cargada',
                  'PAM le giró $ 4.000.000,00 el 06/08/2025 a esa cuenta (dato de JMS). No hay extracto cargado: no se ve ese '
                  'ingreso, ni el saldo, ni en qué se usó. Hacen falta los extractos del Banco Francés desde el 30/06/2025.',
                  'Falta un banco entero en el ítem 5', D)
    lib.pendiente('Bancos MA: no hay movimientos cargados del 01/07/2025 al 06/10/2025',
                  'La caja de ahorro Galicia arranca el 07/10/2025 con saldo cero y la de la jubilación el 11/11/2025. Si MA tuvo '
                  'otras cuentas o movimientos entre julio y septiembre de 2025, no están en el sistema. No hay saldo al 30/06/2025.',
                  'Si se cierra el año 30/06/2025–30/06/2026, falta el primer trimestre', D)
    lib.pendiente('Bancos MA: la caja de ahorro de la jubilación está entera sin conciliar',
                  'Sus 22 movimientos (11/11/2025 al 20/03/2026) están en estado «pendiente», sin categoría ni código: 6 '
                  'acreditaciones de ANSES por $ 7.058.613,75 en total (una de $ 4.913.731,21 el 16/03/2026), consumos y una '
                  'extracción de $ 1.000.000,00 el 12/01/2026.',
                  'Los haberes de ANSES ($ 7.058.613,75) no figuran como ingreso de MA en ningún lado', D)
    lib.pendiente('Bancos MA: transferencias a terceros sin destinatario ni categoría',
                  ' ‖ '.join(f"{dma(fe)} · {t} · $ {ar(imp)} · estado «{est}» · caja de ahorro Galicia de MA"
                             for fe, t, imp, est in d['sin_identificar']),
                  f"$ {ar(sum(x[2] for x in d['sin_identificar']))} sin saber a quién ni por qué", D)
    lib.pendiente('Tarjeta MA: lo pagado por el banco no coincide con los resúmenes en pesos',
                  f"Pagos de tarjeta desde la caja de ahorro Galicia en el ejercicio: {p['n']} por $ {ar(p['importe'])}. Resúmenes "
                  f"en pesos vencidos hasta el 30/06/2026: $ {ar(sum(x[5] for x in v['resumenes']))}. Los resúmenes traen además "
                  f"US$ {ar(usd_pagados)}.",
                  f"diferencia $ {ar(p['importe'] - sum(x[5] for x in v['resumenes']))}: probablemente los dólares pagados en "
                  'pesos (inferido); falta confirmarlo pago por pago', D)
    lib.pendiente('Cuentas en dólares de MA: sin movimientos cargados',
                  ' y '.join(d['dolares_vacias']) + ': existen en el sistema y están vacías.',
                  '¿MA tiene dólares (cuenta o efectivo) al 30/06/2026? El balance propio no los incluye', D)
    return h
