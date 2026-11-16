# -*- coding: utf-8 -*-
"""Detalle 10 — Cuentas con socios (ítem 10: 10a JMS · 10b AMS · 10c MA · 10d PAM).

Fuente: «Socios y Libertad - MSA 25-26» → 14.1 Cuentas con socios (resumen + detalle por asiento) y, como cruce,
«I · MSA · Retiros-Distrib soc». Por socio: saldo al inicio, movimientos agrupados POR MES con subtotal, saldo al cierre.
Sólo usa la API de core.py; las celdas combinadas para textos largos se resuelven acá (_fila)."""
import datetime

from core import num

GRUPO = 'C · Socios'
LIBRO = 'Socios y Libertad'
DONDE = 'D10 Socios'
ANCHOS = [11, 18, 35, 15, 11, 15, 15, 15, 15]  # 150
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre']
SOCIOS = [  # (sub-ítem, nombre en la fuente, cierre esperado, contador 24/25)
    ('10a', 'José María Martínez', -36482265.53, None),
    ('10b', 'Andrés Martínez', -5463334.73, None),
    ('10c', 'Mercedes Areco', -44459338.17, None),
    ('10d', 'Sucesión de Plácido Martínez', -189826.57, 45905575.52),
]
TOTAL_ESPERADO = -86594765.00
COLS = ['Fecha', 'Cuenta', 'Concepto / comprobante', 'Agrupadora / template', 'Otra punta',
        'Debe: MSA le pagó o retiró', 'Haber: facturó, sueldo o pagó por MSA', 'Movimiento (haber − debe)', 'Saldo']


def _txt(v):
    return '' if v is None else str(v).strip()


def _ar(x, dec=2):
    return f"{x:,.{dec}f}".replace(',', 'X').replace('.', ',').replace('X', '.')


def _combinar(h, r, comb):
    for c1, c2 in (comb or {}).items():
        if c2 > c1:
            h.ws.merge_cells(start_row=r, start_column=c1 + 1, end_row=r, end_column=c2 + 1)


def _fila(h, valores, comb=None, negrita=False, fmt=None):
    """h.fila + celdas combinadas para los textos (comb = {col_desde: col_hasta}) y alto del renglón."""
    r = h.fila(valores, negrita=negrita, fmt=fmt)
    _combinar(h, r, comb)
    lineas = 1
    for i, v in enumerate(valores):
        if isinstance(v, str) and not v.startswith('='):
            c1 = i + 1
            c2 = (comb or {}).get(c1, c1)
            ancho = sum(h.ws.column_dimensions[h.col(k)].width for k in range(c1, c2 + 1))
            lineas = max(lineas, -(-len(v) // max(4, int(ancho))))
    if lineas > 1:
        h.ws.row_dimensions[r].height = 13 * lineas
    return r


def _leer(ws):
    """Resumen por socio, bloque «sin tratar» y detalle por socio de la solapa 14.1."""
    resumen, sin_tratar, detalle, avisos = {}, [], {}, {}
    r = 1
    while r <= ws.max_row and _txt(ws.cell(r, 1).value) != 'Contraparte':
        r += 1
    r += 1
    while r <= ws.max_row and _txt(ws.cell(r, 1).value) not in ('TOTAL', ''):
        resumen[_txt(ws.cell(r, 1).value)] = dict(
            cuit=_txt(ws.cell(r, 2).value), inicio=num(ws.cell(r, 3).value), facturado=num(ws.cell(r, 4).value),
            vendido=num(ws.cell(r, 5).value), pagado=num(ws.cell(r, 6).value), cierre=num(ws.cell(r, 8).value),
            lee=_txt(ws.cell(r, 9).value))
        r += 1
    total = num(ws.cell(r, 8).value)
    total_ini = num(ws.cell(r, 3).value)
    # sin tratar
    st_total = None
    for k in range(r, ws.max_row + 1):
        if _txt(ws.cell(k, 1).value).upper().startswith('TODAV'):
            j = k + 3
            while ws.cell(j, 1).value is not None:
                a = _txt(ws.cell(j, 1).value)
                if a.startswith('TOTAL'):
                    st_total = num(ws.cell(j, 3).value)
                else:
                    sin_tratar.append((a, int(num(ws.cell(j, 2).value)), num(ws.cell(j, 3).value)))
                j += 1
            break
    # detalle
    socio = None
    for k in range(r, ws.max_row + 1):
        a = _txt(ws.cell(k, 1).value)
        if a.startswith('DETALLE — '):
            socio = a[len('DETALLE — '):].split(' (')[0].strip()
            detalle[socio] = dict(inicio=None, movs=[], cierre=None)
            continue
        if socio is None or not a:
            continue
        if a == 'Saldo al inicio':
            detalle[socio]['inicio'] = num(ws.cell(k, 6).value)
        elif a.startswith('SALDO AL CIERRE'):
            detalle[socio]['cierre'] = num(ws.cell(k, 6).value)
        elif isinstance(ws.cell(k, 2).value, (datetime.date, datetime.datetime)):
            f = ws.cell(k, 2).value
            f = f if isinstance(f, datetime.datetime) else datetime.datetime(f.year, f.month, f.day)
            detalle[socio]['movs'].append(dict(
                orden=k, fecha=f, cuenta=a, que=_txt(ws.cell(k, 3).value), debe=num(ws.cell(k, 4).value),
                haber=num(ws.cell(k, 5).value), agrup=_txt(ws.cell(k, 7).value), concepto=_txt(ws.cell(k, 8).value),
                otra=_txt(ws.cell(k, 9).value)))
        elif 'pago(s) no dicen' in a:
            avisos[socio] = a
            socio = None
    return resumen, total, total_ini, sin_tratar, st_total, detalle, avisos


def construir(lib, src):
    arch = src.nombre(LIBRO)
    ws = src.hoja(LIBRO, '14.1')
    resumen, total_f, total_ini_f, sin_tratar, st_total, detalle, avisos = _leer(ws)
    h = lib.hoja(DONDE, ANCHOS, horizontal=True)

    h.titulo('Detalle 10 — Cuentas con socios (ítem 10)')
    h.nota(f'Fuente: {arch} → «14.1 Cuentas con socios» (resumen y detalle por asiento). Signo, como en la fuente: saldo '
           'POSITIVO = MSA le debe al socio; NEGATIVO = el socio le debe a MSA (MSA tiene a cobrar). Debe = MSA le pagó o él '
           'retiró (baja el saldo); Haber = el socio facturó, se le devengó sueldo, aportó o pagó algo por MSA (sube el saldo). '
           '«Cuenta» dice por dónde pasó: el banco o la tarjeta de MSA, la cuenta del socio que pagó por MSA, «Facturas y sueldo» '
           '(lo devengado) o el cuadro final de Gastos Libertad. '
           'Arriba el resumen de los cuatro socios; debajo, cada socio con su saldo al inicio, sus movimientos mes por mes '
           '(subtotal mensual y saldo al fin de cada mes) y su saldo al cierre = inicio + la suma de los subtotales mensuales. '
           'Existe además la solapa «I · Interno por socio» (la cuenta interna entre socios): es otra capa y no se usa acá.')

    # ---------- resumen (apunta a los totales de cada socio, más abajo) ----------
    h.blanco()
    h.seccion('Resumen del ítem 10 — saldo de cada socio al 30/06/2026')
    h.encabezado(['Sub-ítem', 'Socio', 'CUIT', None, None, 'Debe del ejercicio', 'Haber del ejercicio',
                  'Saldo al inicio', 'Saldo al cierre'], repetir=False)
    f_res = {}
    for sub, nombre, _, _ in SOCIOS:
        cuit = resumen.get(nombre, {}).get('cuit', '')
        f_res[sub] = _fila(h, [sub, nombre, cuit, None, None, 0.0, 0.0, 0.0, 0.0])
    r1, r2 = f_res[SOCIOS[0][0]], f_res[SOCIOS[-1][0]]
    f_total = h.total('Total ítem 10 — cuentas con socios', {c: h.suma(c, r1, r2) for c in (6, 7, 8, 9)}, clave=True)
    h.control('saldo total con socios al cierre', h.cel(9, f_total), total_f, '14.1 Cuentas con socios, TOTAL, SALDO AL CIERRE')
    h.control('saldo total con socios al inicio', h.cel(8, f_total), total_ini_f, '14.1 Cuentas con socios, TOTAL, Saldo al INICIO')
    if abs(total_f - TOTAL_ESPERADO) > 0.01:
        lib.pendiente('Socios — total', f'El total de la solapa 14.1 es {_ar(total_f)} y se esperaba {_ar(TOTAL_ESPERADO)}.',
                      _ar(total_f - TOTAL_ESPERADO), DONDE)

    # ---------- cada socio ----------
    f_cierre = {}
    retiros = {}  # socio -> filas del detalle con agrupadora de retiros
    for sub, nombre, esperado, _ in SOCIOS:
        d = detalle.get(nombre)
        res = resumen.get(nombre)
        if d is None or res is None:
            lib.pendiente('Socios — fuente', f'No se encontró a «{nombre}» en la solapa 14.1 (resumen o detalle).',
                          'falta el sub-ítem ' + sub, DONDE)
            continue
        h.blanco()
        h.seccion(f"{sub} · {nombre} — CUIT {res['cuit']}")
        if res['lee']:
            h.nota(f"Según la fuente: {res['lee']}." + (f" {avisos[nombre]}" if nombre in avisos else ''))
        h.encabezado(COLS, repetir=True)
        ini = d['inicio'] if d['inicio'] is not None else res['inicio']
        f_ini = _fila(h, [None, 'Saldo al inicio (30/06/2025)', None, None, None, None, None, None, float(ini)],
                      negrita=True)
        movs = sorted(d['movs'], key=lambda m: (m['fecha'], m['orden']))
        meses = {}
        for m in movs:
            meses.setdefault((m['fecha'].year, m['fecha'].month), []).append(m)
        subt = []
        f_saldo = f_ini
        saldo_py = ini
        for (anio, mes), ms in meses.items():
            a = None
            for m in ms:
                r = h.r + 1
                _fila(h, [m['fecha'], m['cuenta'], m['concepto'] or None, m['agrup'] or None,
                          m['otra'] or None, float(m['debe']) if m['debe'] else None,
                          float(m['haber']) if m['haber'] else None, f"={h.cel(7, r)}-{h.cel(6, r)}"])
                a = a or r
                saldo_py += m['haber'] - m['debe']
                if 'retiros' in m['agrup'].lower():
                    retiros.setdefault(nombre, []).append(r)
            rs = h.total(f'Subtotal {MESES[mes - 1]} {anio} — saldo al fin del mes',
                         {6: h.suma(6, a, h.r), 7: h.suma(7, a, h.r), 8: h.suma(8, a, h.r),
                          9: f"={h.cel(9, f_saldo)}+{h.cel(8, h.r + 1)}"}, col_etiqueta=2)
            subt.append(rs)
            f_saldo = rs
        fc = h.total(f'Saldo al cierre {sub} — {nombre} (inicio + subtotales mensuales)',
                     {6: h.suma_de(6, subt), 7: h.suma_de(7, subt), 8: h.suma_de(8, subt),
                      9: f"={h.cel(9, f_ini)}+" + h.suma_de(8, subt)[1:]}, clave=True, col_etiqueta=2)
        f_cierre[sub] = fc
        h.control(f'saldo al cierre de {nombre}', h.cel(9, fc), res['cierre'], '14.1 Cuentas con socios, resumen, SALDO AL CIERRE')
        # vínculos del resumen
        for c, ref in ((6, h.cel(6, fc)), (7, h.cel(7, fc)), (8, h.cel(9, f_ini)), (9, h.cel(9, fc))):
            h.celda(c, f_res[sub]).value = f"={ref}"
        # verificación en Python
        if abs(saldo_py - res['cierre']) > 0.01:
            lib.pendiente(f'Socios — {nombre}', f'Inicio {_ar(ini)} + movimientos del detalle da {_ar(saldo_py)} y el resumen de '
                          f"la fuente dice {_ar(res['cierre'])}: diferencia {_ar(saldo_py - res['cierre'])}.", '$', DONDE)
        if abs(res['cierre'] - esperado) > 0.01:
            lib.pendiente(f'Socios — {nombre}', f"El cierre de la fuente ({_ar(res['cierre'])}) no es el esperado "
                          f'({_ar(esperado)}).', _ar(res['cierre'] - esperado), DONDE)
        if d['cierre'] is not None and abs(d['cierre'] - res['cierre']) > 0.01:
            lib.pendiente(f'Socios — {nombre}', f"El detalle de la fuente cierra en {_ar(d['cierre'])} y su resumen en "
                          f"{_ar(res['cierre'])}.", '$', DONDE)
        debe, haber = sum(m['debe'] for m in movs), sum(m['haber'] for m in movs)
        if abs(debe - res['pagado']) > 0.01 or abs(haber - res['facturado']) > 0.01:
            lib.pendiente(f'Socios — {nombre}: columnas del resumen', f'El detalle suma debe {_ar(debe)} y haber {_ar(haber)}; '
                          f"el resumen de la fuente muestra «Pagado/cobrado» {_ar(res['pagado'])} y «Facturado» "
                          f"{_ar(res['facturado'])}. La diferencia es la misma en las dos columnas ({_ar(debe - res['pagado'])}): "
                          'el resumen compensa lo que el socio pagó por MSA o aportó contra lo pagado. El saldo no cambia.',
                          'sólo presentación', DONDE)
        if res['inicio'] == 0 and 'sin dato de inicio' in res['lee']:
            lib.pendiente(f'Socios — {nombre}: saldo de inicio', 'La fuente no tiene saldo de inicio cargado y toma 0 por '
                          'defecto' + (' (el balance 24/25 del contador traía «Socio Plácido Martínez» por 45.905.575,52).'
                                       if sub == '10d' else '.'), 'mueve el saldo al cierre en el mismo importe', DONDE)
        if nombre in avisos:
            lib.pendiente(f'Socios — {nombre}: pagos sin comprobante', avisos[nombre] +
                          ' (en el detalle figuran como «← sin referencia»).', 'falta el respaldo de esos pagos', DONDE)

    # ---------- informativo: cruce de retiros con la solapa de templates ----------
    try:
        wr = src.hoja(LIBRO, 'I · MSA · Retiros-Distrib soc')
    except SystemExit:
        wr = None
    if wr is not None:
        r0 = 1
        while r0 <= wr.max_row and _txt(wr.cell(r0, 1).value) != 'Nro':
            r0 += 1
        por = {}
        fuera = []
        r = r0 + 1
        while r <= wr.max_row and wr.cell(r, 3).value is not None:
            quien = _txt(wr.cell(r, 7).value)
            cuenta = _txt(wr.cell(r, 5).value)
            neto = num(wr.cell(r, 10).value) - num(wr.cell(r, 11).value)
            if 'Galicia' in cuenta:
                por[quien] = por.get(quien, 0.0) + neto
            elif neto:
                fuera.append((wr.cell(r, 3).value, _txt(wr.cell(r, 4).value), cuenta, quien, _txt(wr.cell(r, 8).value), neto))
            r += 1
        h.blanco()
        h.seccion('Informativo — cruce de los retiros con la solapa «I · MSA · Retiros-Distrib soc» (no interviene en el saldo)')
        h.nota('Los renglones de arriba con agrupadora «Retiros / Distribucion Socios» (retiros menos aportes), contra los '
               'retiros por el banco Galicia que lista la solapa de templates para la misma persona.')
        h.encabezado(['', 'Socio', 'Qué compara', None, None, None, 'Retiros netos en esta hoja', 'Según la solapa de retiros',
                      'Diferencia'], repetir=False)
        for nombre, clave in (('Mercedes Areco', 'Mercedes Areco'), ('Sucesión de Plácido Martínez', 'PAM')):
            filas = retiros.get(nombre, [])
            if not filas:
                continue
            r = h.r + 1
            _fila(h, [None, nombre, 'debe − haber de sus renglones de retiros y aportes', None, None, None,
                      h.suma_de(6, filas) + '-(' + h.suma_de(7, filas)[1:] + ')', float(por.get(clave, 0.0)),
                      f"={h.cel(7, r)}-{h.cel(8, r)}"])
        for f, concepto, cuenta, quien, det, neto in fuera:
            _fila(h, [f if isinstance(f, datetime.datetime) else None, quien,
                      f'{concepto} · {cuenta} · {det} — está en la solapa de retiros y NO en la cuenta del socio', None, None,
                      None, None, float(neto), None])
            lib.pendiente('Socios — retiro fuera de la cuenta', f'«{concepto}» por {_ar(neto)} ({cuenta}, {quien}, {det}) figura '
                          'en la solapa de retiros de MSA y no aparece en la cuenta de ningún socio de la solapa 14.1 '
                          '(no salió por el banco Galicia).', f'{_ar(neto)} sin imputar a un socio', DONDE)

    # ---------- informativo: todavía sin tratar ----------
    if sin_tratar:
        h.blanco()
        h.seccion('Informativo — TODAVÍA SIN TRATAR: marcas del extracto que no son ninguna de estas cuentas')
        h.nota('Según la solapa 14.1 se muestran enteras y no se reparten entre los socios: cada una se trata por separado. '
               'No están en el saldo del ítem 10.')
        h.encabezado(['', 'Marca en la columna Contable', None, None, None, None, None, 'Movimientos', 'Total $'], repetir=False)
        a = None
        s = 0.0
        for marca, n, imp in sin_tratar:
            r = _fila(h, [None, marca, None, None, None, None, None, n, float(imp)], fmt={8: '#,##0'})
            a = a or r
            s += imp
        rt = h.total('Total sin tratar', {8: h.suma(8, a, h.r), 9: h.suma(9, a, h.r)}, fmt={8: '#,##0'}, col_etiqueta=2)
        if st_total is not None:
            h.control('total sin tratar', h.cel(9, rt), st_total, '14.1 Cuentas con socios, TOTAL SIN TRATAR')
        lib.pendiente('Socios — todavía sin tratar', 'Marcas del extracto sin repartir entre los socios: ' +
                      '; '.join(f'{m}: {n} movimiento(s) por {_ar(i)}' for m, n, i in sin_tratar) +
                      f'. Total {_ar(s)}. No están en el saldo del ítem 10.', f'{_ar(s)} a definir a qué cuenta va', DONDE)

    # ---------- ítems ----------
    lib.item('10', 'Cuentas con socios', h, h.cel(9, f_total), GRUPO,
             'saldo de los cuatro socios al cierre (negativo = el socio le debe a MSA)', None)
    for sub, nombre, _, contador in SOCIOS:
        if sub in f_cierre:
            lib.item(sub, nombre, h, h.cel(9, f_cierre[sub]), GRUPO,
                     'saldo al inicio + movimientos del ejercicio, mes por mes', contador)
