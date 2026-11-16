# -*- coding: utf-8 -*-
"""PAM · Detalle 5 — Bancos y tarjeta (ítem 5): cada cuenta de la Sucesión cargada en el sistema.

Fuente: extracto de la base (pam/bancos.json): caja de ahorro y cuenta corriente del Banco Galicia (en pesos) y la
tarjeta VISA. Por cuenta: saldo al 30/06/2025, 31/12/2025 y 30/06/2026 (el saldo del extracto en el último movimiento
hasta esa fecha) y, mes por mes, débitos, créditos y saldo de fin de mes, con la cadena de saldos a la vista
(saldo anterior + créditos − débitos contra el saldo del extracto). Pesos y dólares van en tablas separadas.
No hay cargadas cuentas en dólares ni la tenencia del fondo común (FIMA): van como pendientes, sin valor."""
from e_pam_comun import G_SALDOS, EJERCICIO, ar, cargar, control, dma, fch, fila, hoja, mes_txt, refs

HOJA = 'D5 Bancos'
ANCHOS = [28, 8, 9, 9, 16, 16, 16, 16, 16, 16]  # 150
ENTERO = '#,##0'


def _cuenta(h, lib, c):
    """Detalle de una cuenta: una fila por mes. Devuelve las filas (inicio, diciembre, total) y la fila total."""
    h.blanco()
    h.seccion(f"{c['clave']} · {c['nombre']} — mes por mes")
    h.nota(f"Movimientos cargados: {c['movs_cargados']}, del {dma(c['primer_mov'])} al {dma(c['ultimo_mov'])}; del ejercicio, "
           f"{c['movs_ejercicio']}. «Saldo calculado» = saldo del extracto al fin del mes anterior + créditos − débitos del mes; "
           '«Diferencia» = saldo según el extracto − saldo calculado (si no es cero, en ese mes la cadena tiene un salto). '
           '«Sin conciliar» = movimientos que no están en estado conciliado; «Sin categoría» = sin categoría asignada.')
    h.encabezado(['Mes', 'Movim.', 'Sin conciliar', 'Sin categoría', 'Débitos $', 'Créditos $', 'Neto del mes $',
                  'Saldo calculado $', 'Saldo según el extracto $', 'Diferencia $'])
    if c['saldo_inicio_fecha_mov']:
        t_ini = f"Saldo al 30/06/2025 (último movimiento: {dma(c['saldo_inicio_fecha_mov'])})"
    else:
        t_ini = f"Saldo al 30/06/2025: sin movimientos (el primero cargado es del {dma(c['primer_mov'])})"
    r_ini = fila(h, [t_ini, None, None, None, None, None, None, None, float(c['saldo_inicio'])], negrita=True)
    ant = r_ini
    saldo = c['saldo_inicio']
    filas = {}
    saltos = []
    for mes, n, deb, cre, saldo_fin, sin_conc, sin_cat in c['meses']:
        r = h.r + 1
        fila(h, [mes_txt(mes), n, sin_conc, sin_cat, float(deb), float(cre), f'={h.cel(6, r)}-{h.cel(5, r)}',
                 f'={h.cel(9, ant)}+{h.cel(7, r)}', float(saldo_fin), f'={h.cel(9, r)}-{h.cel(8, r)}'],
             fmt={2: ENTERO, 3: ENTERO, 4: ENTERO})
        if abs(saldo + cre - deb - saldo_fin) > 0.01:
            saltos.append((mes, round(saldo_fin - (saldo + cre - deb), 2)))
        saldo = saldo_fin
        filas[mes] = r
        ant = r
    a, b = r_ini + 1, h.r
    r_tot = h.total(f"Total {c['clave']} — ejercicio y saldo al 30/06/2026",
                    {2: h.suma(2, a, b), 3: h.suma(3, a, b), 4: h.suma(4, a, b), 5: h.suma(5, a, b), 6: h.suma(6, a, b),
                     7: h.suma(7, a, b), 8: f'={h.cel(9, r_ini)}+{h.cel(7, h.r + 1)}', 9: f'={h.cel(9, b)}',
                     10: f'={h.cel(9, h.r + 1)}-{h.cel(8, h.r + 1)}'}, clave=True, fmt={2: ENTERO, 3: ENTERO, 4: ENTERO})
    control(h, f"{c['clave']}: débitos del ejercicio", h.cel(5, r_tot), c['debitos_ejercicio'], 'suma de los débitos del extracto')
    control(h, f"{c['clave']}: créditos del ejercicio", h.cel(6, r_tot), c['creditos_ejercicio'], 'suma de los créditos del extracto')
    control(h, f"{c['clave']}: saldo calculado al cierre contra el extracto", h.cel(8, r_tot), c['saldo_cierre'],
            f"saldo del extracto en el último movimiento del ejercicio ({dma(c['saldo_cierre_fecha_mov'])})")
    # verificación en Python
    if abs(c['saldo_inicio'] + c['creditos_ejercicio'] - c['debitos_ejercicio'] - c['saldo_cierre']) > 0.01:
        lib.pendiente(f"PAM · {c['nombre']}: no cierra", f"Inicio {ar(c['saldo_inicio'])} + créditos {ar(c['creditos_ejercicio'])} − "
                      f"débitos {ar(c['debitos_ejercicio'])} no da el saldo del extracto {ar(c['saldo_cierre'])}.", '$', HOJA)
    if abs(sum(m[2] for m in c['meses']) - c['debitos_ejercicio']) > 0.01 or abs(sum(m[3] for m in c['meses']) - c['creditos_ejercicio']) > 0.01:
        lib.pendiente(f"PAM · {c['nombre']}: los meses no suman el ejercicio", 'La suma de los meses no da el total de la consulta.',
                      '$', HOJA)
    for mes, dif in saltos:
        lib.pendiente(f"PAM · {c['nombre']}: salto en la cadena de saldos", f'En {mes_txt(mes)} el saldo del extracto difiere en '
                      f'{ar(dif)} del saldo anterior + créditos − débitos.', ar(dif), HOJA)
    if c['saltos_cadena']:
        lib.pendiente(f"PAM · {c['nombre']}: saltos movimiento a movimiento", f"{c['saltos_cadena']} salto(s) entre movimientos "
                      'consecutivos del extracto.', '', HOJA)
    return r_ini, filas.get('2025-12'), r_tot


def construir(lib, src):
    d = cargar(src, 'bancos')
    h = hoja(lib, HOJA, ANCHOS)
    cuentas = d['cuentas']
    v = d['visa']
    res = v['resumenes']

    h.titulo('PAM · Detalle 5 — Bancos y tarjeta (ítem 5)')
    h.nota(f'Sucesión de Plácido Alberto Martínez — ejercicio {EJERCICIO}. Fuente: los extractos cargados en el sistema (extraído '
           f"el {dma(d['extraido'])}). Arriba, el resumen: cada saldo viene de su detalle, más abajo. Después, cada cuenta mes por "
           'mes con su cadena de saldos; el fondo común (sólo lo que entró y salió: la tenencia no está cargada); y la tarjeta, '
           'resumen por resumen, en pesos y —en tabla aparte— en dólares. No hay cuentas en dólares de la Sucesión cargadas.')

    # ---------- 1 · resumen ----------
    h.blanco()
    h.seccion('1 · Bancos en pesos — saldos al 30/06/2025, 31/12/2025 y 30/06/2026')
    h.encabezado(['Cuenta', 'Movim. del ejercicio', 'Sin conciliar', 'Sin categoría', 'Débitos del ejercicio $',
                  'Créditos del ejercicio $', 'Neto del ejercicio $', 'Saldo 30/06/2025 $', 'Saldo 31/12/2025 $',
                  'Saldo 30/06/2026 $'])
    f_res = {}
    for c in cuentas:
        r = h.r + 1
        f_res[c['clave']] = fila(h, [f"{c['clave']} · {c['nombre']}", 0, 0, 0, '=0', '=0', f'={h.cel(6, r)}-{h.cel(5, r)}',
                                     '=0', '=0', '=0'], fmt={2: ENTERO, 3: ENTERO, 4: ENTERO})
    a, b = f_res[cuentas[0]['clave']], f_res[cuentas[-1]['clave']]
    r_tot = h.total('Total ítem 5 — Bancos en pesos', {k: h.suma(k, a, b) for k in range(2, 11)}, clave=True,
                    fmt={2: ENTERO, 3: ENTERO, 4: ENTERO})
    control(h, 'bancos en pesos al 30/06/2026', h.cel(10, r_tot), sum(c['saldo_cierre'] for c in cuentas),
            'suma de los saldos de los extractos al cierre')
    control(h, 'bancos en pesos al 31/12/2025', h.cel(9, r_tot), sum(c['saldo_dic'] for c in cuentas),
            'suma de los saldos de los extractos al 31/12/2025')
    control(h, 'bancos en pesos al 30/06/2025', h.cel(8, r_tot), sum(c['saldo_inicio'] for c in cuentas),
            'suma de los saldos de los extractos al 30/06/2025')

    h.blanco()
    h.seccion('1.1 · Qué está cargado de cada cuenta')
    h.encabezado(['Cuenta', 'Movim. cargados', None, None, 'Primer movimiento', 'Último movimiento',
                  'Saltos en la cadena de saldos', 'Observación', None, None])
    h.ws.merge_cells(start_row=h.r, start_column=9, end_row=h.r, end_column=11)
    for c in cuentas:
        fila(h, [c['nombre'], c['movs_cargados'], None, None, fch(c['primer_mov']), fch(c['ultimo_mov']), c['saltos_cadena'],
                 'cadena de saldos sin saltos, movimiento a movimiento' if not c['saltos_cadena'] else 'ver los saltos en el detalle',
                 None, None], {8: 10}, fmt={2: ENTERO, 7: ENTERO})
    fila(h, [v['nombre'], v['movs_cargados'], None, None, fch(v['primer_mov']), fch(v['ultimo_mov']), None,
             'faltan los resúmenes de mayo y junio de 2026', None, None], {8: 10}, fmt={2: ENTERO})
    for t in d['no_cargado']:
        fila(h, [None, None, None, None, None, None, None, 'NO CARGADO: ' + t, None, None], {8: 10})

    # ---------- 2 · cada cuenta ----------
    R = refs(lib)
    tot = {}
    for c in cuentas:
        r_ini, r_dic, rt = _cuenta(h, lib, c)
        tot[c['clave']] = rt
        fr = f_res[c['clave']]
        for k in (2, 3, 4, 5, 6):
            h.celda(k, fr).value = f'={h.cel(k, rt)}'
        h.celda(8, fr).value = f'={h.cel(9, r_ini)}'
        h.celda(9, fr).value = f'={h.cel(9, r_dic)}' if r_dic else '=0'
        h.celda(10, fr).value = f'={h.cel(9, rt)}'
        R[c['clave'] + '_ini'], R[c['clave'] + '_dic'], R[c['clave'] + '_cie'] = h.ref(8, fr), h.ref(9, fr), h.ref(10, fr)
    R['bancos_ini'], R['bancos_dic'], R['bancos_cie'] = h.ref(8, r_tot), h.ref(9, r_tot), h.ref(10, r_tot)

    # ---------- 3 · fondo común ----------
    h.blanco()
    h.seccion('3 · Informativo — Fondo común de inversión (FIMA): lo que salió hacia el fondo y lo que volvió, por cuenta')
    h.nota('No interviene en el total del ítem. El sistema no tiene la tenencia del fondo (cuotapartes y valor) al inicio ni al '
           'cierre: sólo se ven las suscripciones (plata que salió de la cuenta al fondo) y los rescates (plata que volvió).')
    h.encabezado(['Cuenta', 'Movim.', None, None, 'Suscripciones (sale) $', 'Rescates (entra) $', 'Neto: rescates − suscripciones $',
                  None, None, None])
    a = None
    for c in cuentas:
        r = h.r + 1
        fila(h, [c['nombre'], c['fci_movs'], None, None, float(c['fci_suscripciones']), float(c['fci_rescates']),
                 f'={h.cel(6, r)}-{h.cel(5, r)}'], fmt={2: ENTERO})
        a = a or r
    r_fci = h.total('Total fondo común — movimientos del ejercicio', {k: h.suma(k, a, h.r) for k in (2, 5, 6, 7)}, fmt={2: ENTERO})
    fci_neto = sum(c['fci_rescates'] - c['fci_suscripciones'] for c in cuentas)
    R['fci_neto'] = h.ref(7, r_fci)

    # ---------- 4 · tarjeta en pesos ----------
    h.blanco()
    h.seccion(f"5c · {v['nombre']} — resumen por resumen, en PESOS")
    h.nota('Saldo positivo = deuda con la tarjeta; negativo = saldo a favor. «Saldo calculado» = saldo anterior − pagos + consumos '
           'y cargos (netos de bonificaciones). El primer renglón es el resumen cerrado el 26/06/2025: es el saldo que se usa '
           'como referencia del 30/06/2025. El último resumen cargado es el del 30/04/2026.')
    h.encabezado(['Resumen: cierre · vencimiento', 'Movim.', 'Sin conciliar', 'Sin categoría', 'Saldo anterior $', 'Pagos $',
                  'Consumos y cargos $', 'Saldo calculado $', 'Saldo según el resumen $', 'Diferencia $'])
    f_v = {}
    ant = None
    for nr, cierre, vto, sal_ant, pagos, cons, bonif, saldo, usd_ant, usd, n, sc, scat, n_ma, neto_ma in res:
        r = h.r + 1
        f_v[cierre] = fila(h, [f'{dma(cierre)} · vence {dma(vto)}', n, sc, scat, float(sal_ant), float(pagos), float(cons - bonif),
                               f'={h.cel(5, r)}-{h.cel(6, r)}+{h.cel(7, r)}', float(saldo), f'={h.cel(9, r)}-{h.cel(8, r)}'],
                           fmt={2: ENTERO, 3: ENTERO, 4: ENTERO})
        if abs(sal_ant - pagos + cons - bonif - saldo) > 0.01:
            lib.pendiente('PAM · Tarjeta: un resumen no cierra', f'Resumen del {dma(cierre)}: saldo anterior − pagos + consumos da '
                          f'{ar(sal_ant - pagos + cons - bonif)} y el resumen dice {ar(saldo)}.', ar(saldo - (sal_ant - pagos + cons - bonif)),
                          HOJA)
        if ant is not None and abs(ant - sal_ant) > 0.01:
            lib.pendiente('PAM · Tarjeta: salto entre resúmenes', f'El resumen del {dma(cierre)} arranca en {ar(sal_ant)} y el '
                          f'anterior cerró en {ar(ant)}.', ar(sal_ant - ant), HOJA)
        ant = saldo
    en_ej = [x for x in res if d['ejercicio'][0] <= x[1] <= d['ejercicio'][1]]
    a, b = f_v[en_ej[0][1]], f_v[en_ej[-1][1]]
    r_vt = h.total(f"Total 5c — tarjeta: {len(en_ej)} resúmenes del ejercicio y saldo al último cargado ({dma(res[-1][1])})",
                   {2: h.suma(2, a, b), 3: h.suma(3, a, b), 4: h.suma(4, a, b), 6: h.suma(6, a, b), 7: h.suma(7, a, b),
                    9: f'={h.cel(9, b)}'}, clave=True, fmt={2: ENTERO, 3: ENTERO, 4: ENTERO})
    control(h, 'tarjeta: saldo anterior del primer resumen del ejercicio − pagos + consumos = último saldo',
            h.cel(9, r_vt), en_ej[0][3] - sum(x[4] for x in en_ej) + sum(x[5] - x[6] for x in en_ej),
            'cadena de los resúmenes del ejercicio')
    R['visa_jun25'] = h.ref(9, f_v[res[0][1]])
    if '2025-12-31' in f_v:
        R['visa_dic'] = h.ref(9, f_v['2025-12-31'])
    R['visa_ult'] = h.ref(9, r_vt)
    R['visa_ult_fecha'] = res[-1][1]

    # ---------- 5 · tarjeta en dólares ----------
    h.blanco()
    h.seccion(f"5c · {v['nombre']} — saldo de cada resumen, en DÓLARES (tabla aparte: no se suma a los pesos)")
    h.encabezado(['Resumen: cierre · vencimiento', None, None, None, 'Saldo anterior US$', None, None, None, 'Saldo según el resumen US$',
                  None])
    for nr, cierre, vto, sal_ant, pagos, cons, bonif, saldo, usd_ant, usd, n, sc, scat, n_ma, neto_ma in res:
        fila(h, [f'{dma(cierre)} · vence {dma(vto)}', None, None, None, float(usd_ant), None, None, None, float(usd)])
    h.nota('Los dólares de la tarjeta se pagan en pesos al tipo de cambio del día del pago; el sistema no tiene cargado ese '
           'detalle resumen por resumen, por eso acá va sólo el saldo en dólares de cada resumen.')

    # ---------- ítems ----------
    lib.item('5', 'Bancos de PAM en pesos (caja de ahorro + cuenta corriente)', h, h.cel(10, r_tot), G_SALDOS,
             'saldo de cada extracto en el último movimiento del ejercicio', None)
    for c in cuentas:
        lib.item(c['clave'], c['nombre'], h, h.cel(9, tot[c['clave']]), G_SALDOS,
                 'saldo al 30/06/2025 + créditos − débitos del ejercicio, mes por mes', None)
    lib.item('5c', f"Tarjeta VISA de PAM — saldo del último resumen cargado ({dma(res[-1][1])}; negativo = a favor)", h,
             h.cel(9, r_vt), G_SALDOS, 'saldo anterior − pagos + consumos, resumen por resumen', None)

    # ---------- pendientes ----------
    for c in cuentas:
        sc = sum(m[5] for m in c['meses'])
        scat = sum(m[6] for m in c['meses'])
        if sc or scat:
            con = [m for m in c['meses'] if m[5] or m[6]]
            lib.pendiente(f"PAM · {c['nombre']}: movimientos sin conciliar y sin categoría",
                          f"Del ejercicio, {sc} de {c['movs_ejercicio']} movimientos no están conciliados y {scat} no tienen categoría "
                          f"(todos entre {mes_txt(con[0][0])} y {mes_txt(con[-1][0])}; de febrero 2026 en adelante están todos "
                          'conciliados). Mientras no tengan categoría no se puede armar el resultado de la Sucesión por rubro.',
                          f'{sc} movimientos', HOJA)
    lib.pendiente('PAM · Tarjeta: faltan los resúmenes de mayo y junio de 2026',
                  f"El último resumen cargado cerró el {dma(res[-1][1])} con saldo {ar(res[-1][7])} (a favor) y US$ {ar(res[-1][9])}. "
                  'Sin los de mayo y junio no hay saldo de la tarjeta al 30/06/2026.', 'saldo al cierre sin dato', HOJA)
    lib.pendiente('PAM · Fondo común (FIMA): sin tenencia cargada',
                  'En el ejercicio salieron al fondo ' + ar(sum(c['fci_suscripciones'] for c in cuentas)) + ' y volvieron ' +
                  ar(sum(c['fci_rescates'] for c in cuentas)) + f' (neto rescatado {ar(fci_neto)}) entre la caja de ahorro y la cuenta '
                  'corriente. El sistema no tiene las cuotapartes ni su valor al 30/06/2025, 31/12/2025 ni 30/06/2026: hace falta el '
                  'resumen de tenencia del fondo en esas tres fechas.', 'inversión sin valor al cierre', HOJA)
    lib.pendiente('PAM · Dólares: no hay ninguna cuenta ni caja en dólares cargada',
                  'Si la Sucesión tiene caja de ahorro en dólares, caja de seguridad con dólares o dólares billete, no están en el '
                  'sistema (sí se paga la «comisión caja de seguridad»: 443.315,20 en 4 débitos del ejercicio). Los únicos dólares '
                  'que se ven son los de la tarjeta.', 'sin dato', HOJA)
    lib.pendiente('PAM · Cuenta corriente: abrió el 24/09/2025',
                  'El primer movimiento cargado de la cuenta corriente es del 24/09/2025 (fondeo de 2.346.229,44 desde la caja de '
                  'ahorro, saldo anterior 0). Se toma saldo 0 al 30/06/2025: a confirmar que la cuenta no existía antes.',
                  'saldo de inicio 0,00 (inferido)', HOJA)
