# -*- coding: utf-8 -*-
"""Detalle 10 — Cuentas con socios (ítem 10: 10a JMS · 10b AMS · 10c MA · 10d PAM · 10e Cotitulares · 10f Hermanos).

Regla de JMS (15/11): cuando lo de hoy difiere de lo que YA SE ENVIÓ al contador, la tabla principal va como se envió
y las diferencias van DEBAJO, en un anexo con su subtotal. Acá el caso es al revés del habitual: el papel enviado
(«Cuentas de socios.xlsx») tiene renglones que el export del sistema todavía no tiene.

Orden de la hoja: (1) cuentas con socios como se envió = saldo del sistema + anexo · (2) anexo: en lo enviado y no en el
sistema · (3) informativos · (4) detalle por socio y por mes, del export («Socios y Libertad» → 14.1 Cuentas con socios).
Sólo usa la API de core.py; las celdas combinadas para textos largos se resuelven acá (_fila)."""
import datetime
import os

import openpyxl

from core import num

GRUPO = 'C · Socios'
LIBRO = 'Socios y Libertad'
DONDE = 'D10 Socios'
ANCHOS = [11, 18, 35, 15, 11, 15, 15, 15, 15]  # 150
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre']
# El papel que se le envió al contador (sólo lectura). Si no está, se usan los valores de la auditoría del 15/11.
ENVIADO = (r'D:\Users\josem\Documents\Jose\Automatizarr\Claude\Control-Presupuestario-v1.1'
           r'\- Comunicacion JMS Claude - Archivos\Balance\- Enviados\2026\Enviar\Cuentas de socios.xlsx')
ENVIADO_TXT = 'Cuentas de socios.xlsx (enviado)'
SOCIOS = [  # (sub-ítem, clave en lo enviado, nombre en el export / a mostrar, saldo enviado esperado, contador 24/25)
    ('10a', 'JMS', 'José María Martínez', -36482265.53, None),
    ('10b', 'AMS', 'Andrés Martínez', -6092248.73, None),
    ('10c', 'MA', 'Mercedes Areco', -45593911.03, None),
    ('10d', 'PAM', 'Sucesión de Plácido Martínez', -189826.57, 45905575.52),
    ('10e', 'Cotitulares', 'Cotitulares', -1756595.00, None),
    ('10f', 'Hermanos', 'Hermanos', -9000.00, None),
]
TOTAL_ENVIADO = -90123846.86
RESPALDO = {  # auditoría del 15/11 (scratchpad\auditoria\informe.md § 2.2): sólo si no se puede leer el archivo enviado
    'cierre': {k: v for _, k, _, v, _ in SOCIOS}, 'inicio': {'JMS': -15000000.0, 'AMS': -10500000.0},
    'anexo': [
        ('AMS', datetime.datetime(2025, 8, 1), 'Santander CC $ MSA', 'Pago de honorarios · sueldo', -389920.00),
        ('AMS', datetime.datetime(2025, 9, 1), 'Santander CC $ MSA', 'Pago de honorarios · sueldo', -238994.00),
        ('MA', datetime.datetime(2026, 5, 16), 'Caja Sigot', 'Pago Victor ALBAÑIL CHALET', -400000.00),
        ('MA', datetime.datetime(2026, 5, 19), 'Caja Sigot', 'Pago Victor ALBAÑIL CHALET', -400000.00),
        ('MA', None, 'MSA VISA', 'Seguro Chalet · Chubb', -121636.43),
        ('MA', None, 'MSA VISA', 'Seguro Chalet · Chubb', -121636.43),
        ('MA', None, 'MSA VISA', 'Internet NZ · ORBITH', -91300.00),
        ('Cotitulares', datetime.datetime(2025, 8, 20), 'Caja AMS', 'ITGB Suc PAM 1 · Retiros Cotitulares', -1756595.00),
        ('Hermanos', datetime.datetime(2026, 6, 2), 'Galicia CC $ MSA', 'Compra Debito · Otros Gastos (PAM)', -9000.00),
    ]}
COLS = ['Fecha', 'Cuenta', 'Concepto / comprobante', 'Agrupadora / template', 'Otra punta',
        'Debe: MSA le pagó o retiró', 'Haber: facturó, sueldo o pagó por MSA', 'Movimiento (haber − debe)', 'Saldo']


def _txt(v):
    return '' if v is None else str(v).strip()


def _ar(x, dec=2):
    return f"{x:,.{dec}f}".replace(',', 'X').replace('.', ',').replace('X', '.')


def _dt(f):
    if isinstance(f, datetime.datetime):
        return f
    if isinstance(f, datetime.date):
        return datetime.datetime(f.year, f.month, f.day)
    return None


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


def _enc(h, cols, comb=None, repetir=False):
    r = h.encabezado(cols, repetir=repetir)
    _combinar(h, r, comb)
    return r


def _leer(ws):
    """Resumen por socio, bloque «sin tratar» y detalle por socio de la solapa 14.1 del export."""
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
        elif _dt(ws.cell(k, 2).value):
            detalle[socio]['movs'].append(dict(
                orden=k, fecha=_dt(ws.cell(k, 2).value), cuenta=a, que=_txt(ws.cell(k, 3).value),
                debe=num(ws.cell(k, 4).value), haber=num(ws.cell(k, 5).value), agrup=_txt(ws.cell(k, 7).value),
                concepto=_txt(ws.cell(k, 8).value), otra=_txt(ws.cell(k, 9).value)))
        elif 'pago(s) no dicen' in a:
            avisos[socio] = a
            socio = None
    return resumen, total, total_ini, sin_tratar, st_total, detalle, avisos


def _leer_enviado():
    """El papel enviado: saldos por socio (inicio y cierre), total y cada asiento. None si no se puede abrir."""
    if not os.path.exists(ENVIADO):
        return None
    ws = None
    for w in openpyxl.load_workbook(ENVIADO, data_only=True).worksheets:
        if 'cuentas con socios' in w.title.lower():
            ws = w
    if ws is None:
        return None
    env = dict(inicio={}, cierre={}, total=None, filas=[], nota_pam='')
    claves = {}
    for r in range(1, ws.max_row + 1):
        a = _txt(ws.cell(r, 1).value)
        if a == 'Bloque':
            for c in range(2, 9):
                claves[c] = _txt(ws.cell(r, c).value)
        elif a.startswith('B1') and claves:
            env['inicio'] = {claves[c]: round(num(ws.cell(r, c).value), 2) for c in claves if claves[c] != 'TOTAL'}
            if _txt(ws.cell(r, 11).value):
                env['nota_pam'] = f"{_ar(num(ws.cell(r, 10).value))} — «{_txt(ws.cell(r, 11).value)}»"
        elif a.startswith('SALDO AL CIERRE') and claves:
            for c in claves:
                if claves[c] == 'TOTAL':
                    env['total'] = round(num(ws.cell(r, c).value), 2)
                else:
                    env['cierre'][claves[c]] = round(num(ws.cell(r, c).value), 2)
        elif a == 'Nro':
            for k in range(r + 1, ws.max_row + 1):
                if _txt(ws.cell(k, 2).value) and isinstance(ws.cell(k, 10).value, (int, float)):
                    env['filas'].append(dict(orden=k, socio=_txt(ws.cell(k, 2).value), fecha=_dt(ws.cell(k, 4).value),
                                             cuenta=_txt(ws.cell(k, 7).value), codigo=_txt(ws.cell(k, 8).value),
                                             importe=round(num(ws.cell(k, 10).value), 2), grupo=_txt(ws.cell(k, 11).value),
                                             concepto=_txt(ws.cell(k, 12).value)))
            break
    return env if env['cierre'] and env['filas'] else None


def _motivo(f):
    """Por qué el renglón enviado no está en la cuenta del socio del export (lectura de la auditoría del 15/11)."""
    cta = f['cuenta'].lower()
    if 'visa' in cta:
        return ('Consumo de la tarjeta de MSA: lo enviado lo cuenta por fecha de CONSUMO y el sistema por fecha de PAGO del '
                'resumen; la tarjeta lo cobra después del cierre. Cuál de los consumos iguales es el que falta está inferido '
                '(el último).')
    if 'santander' in cta:
        return 'Pagado por el Santander cta. cte. de MSA: el sistema todavía no lo tiene imputado a la cuenta del socio.'
    if 'sigot' in cta:
        return 'Pagado por la Caja Sigot: los movimientos de esa caja todavía no están imputados a la cuenta del socio en el sistema.'
    if f['socio'] == 'Cotitulares':
        return ('Salió por la Caja AMS. El sistema lo tiene en la solapa de retiros («Retiro Cotitulares»), pero no tiene una '
                'cuenta «Cotitulares» entre las cuentas con socios.')
    if f['socio'] == 'Hermanos':
        return ('El sistema lo muestra aparte de las cuentas de socios, bajo la marca ' + (f['codigo'] or 'CTA QUINTA X') +
                ': no tiene una cuenta «Hermanos» entre las cuentas con socios.')
    return 'Está en lo enviado y no en la cuenta del socio del export.'


def _anexo(env, detalle):
    """Renglones de lo enviado que no aparean (por socio e importe) con el detalle del export. Devuelve (anexo, sobran)."""
    anexo, sobran = [], []
    por_clave = {k: n for _, k, n, _, _ in SOCIOS}
    for clave, nombre in por_clave.items():
        disp = {}
        for m in detalle.get(nombre, {}).get('movs', []):
            k = round(m['haber'] - m['debe'], 2)
            disp[k] = disp.get(k, 0) + 1
        for f in sorted([x for x in env['filas'] if x['socio'] == clave],
                        key=lambda x: (x['fecha'] or datetime.datetime.max, x['orden'])):
            k = round(f['importe'], 2)
            if disp.get(k, 0) > 0:
                disp[k] -= 1
            else:
                anexo.append(f)
        sobran += [(nombre, k, n) for k, n in disp.items() if n > 0]
    otros = [f for f in env['filas'] if f['socio'] not in por_clave]
    return anexo, sobran, otros


def construir(lib, src):
    arch = src.nombre(LIBRO)
    ws = src.hoja(LIBRO, '14.1')
    resumen, total_f, total_ini_f, sin_tratar, st_total, detalle, avisos = _leer(ws)
    env = _leer_enviado()
    if env is None:
        lib.pendiente('Socios — archivo enviado', f'No se pudo leer «{ENVIADO}». La tabla «como se envió» y el anexo se armaron '
                      'con los valores de la auditoría del 15/11 (sin fecha exacta en los consumos de tarjeta).',
                      'los controles contra lo enviado comparan con la auditoría, no con el archivo', DONDE)
        env = dict(inicio=dict(RESPALDO['inicio']), cierre=dict(RESPALDO['cierre']), total=TOTAL_ENVIADO, nota_pam='', filas=[])
        anexo = [dict(orden=i, socio=s, fecha=f, cuenta=c, codigo='', importe=imp, grupo='', concepto=con)
                 for i, (s, f, c, con, imp) in enumerate(RESPALDO['anexo'])]
        sobran, otros = [], []
    else:
        anexo, sobran, otros = _anexo(env, detalle)
    h = lib.hoja(DONDE, ANCHOS, horizontal=True)

    h.titulo('Detalle 10 — Cuentas con socios (ítem 10)')
    h.nota(f'Fuentes: lo ENVIADO al contador ({ENVIADO_TXT} → «Cuentas con socios») y el export del sistema ({arch} → «14.1 '
           'Cuentas con socios»). Signo: saldo POSITIVO = MSA le debe al socio; NEGATIVO = el socio le debe a MSA. '
           'Orden de la hoja: (1) las cuentas como se enviaron — cada saldo enviado se forma con el saldo del sistema más los '
           'renglones del anexo; (2) el anexo: lo que está en lo enviado y todavía no en el sistema; (3) informativos; '
           '(4) el detalle del sistema, socio por socio y mes por mes. Existe además la solapa «I · Interno por socio» (la '
           'cuenta interna entre socios): es otra capa y no se usa acá.')

    # ---------- (1) como se envió ----------
    h.blanco()
    h.seccion('1 · Cuentas con socios, como se envió al contador — saldo al 30/06/2026')
    h.nota('TIENE ANEXO: renglones que están en lo enviado y todavía no en el sistema (tabla 2). Saldo enviado = saldo según el '
           'sistema (apunta al cierre del detalle de cada socio, tabla 4) + anexo (apunta al subtotal del socio en la tabla 2). '
           'Movimiento del ejercicio = saldo enviado − saldo al inicio.')
    _enc(h, ['Sub-ítem', 'Socio', 'CUIT · observación', 'Saldo al inicio', None, 'Saldo al cierre según el sistema',
             'Anexo: en lo enviado y no en el sistema', 'Movimiento del ejercicio', 'SALDO AL CIERRE ENVIADO'])
    f_res = {}
    for sub, clave, nombre, _, _ in SOCIOS:
        res = resumen.get(nombre)
        obs = f"CUIT {res['cuit']}" if res else 'no figura como cuenta de socio en el sistema: todo su saldo viene del anexo'
        r = h.r + 1
        f_res[sub] = _fila(h, [sub, nombre, obs, float(env['inicio'].get(clave, 0.0)), None, 0.0, 0.0,
                               f"={h.cel(9, r)}-{h.cel(4, r)}", f"={h.cel(6, r)}+{h.cel(7, r)}"])
    r1, r2 = f_res[SOCIOS[0][0]], f_res[SOCIOS[-1][0]]
    f_total = h.total('Total ítem 10 — como se envió', {c: h.suma(c, r1, r2) for c in (4, 6, 7, 8, 9)}, clave=True)
    h.control('total enviado', h.cel(9, f_total), env['total'], f'{ENVIADO_TXT}, SALDO AL CIERRE, TOTAL')
    for sub, clave, nombre, esperado, _ in SOCIOS:
        h.control(f'saldo enviado {clave}', h.cel(9, f_res[sub]), env['cierre'].get(clave, 0.0),
                  f'{ENVIADO_TXT}, SALDO AL CIERRE')
        if abs(env['cierre'].get(clave, 0.0) - esperado) > 0.01:
            lib.pendiente(f'Socios — {nombre}', f"El archivo enviado dice {_ar(env['cierre'].get(clave, 0.0))} y se esperaba "
                          f'{_ar(esperado)}.', _ar(env['cierre'].get(clave, 0.0) - esperado), DONDE)
    h.control('total según el sistema', h.cel(6, f_total), total_f, '14.1 Cuentas con socios, TOTAL')
    h.control('saldo total al inicio', h.cel(4, f_total), total_ini_f, '14.1 Cuentas con socios, TOTAL')
    if abs(env['total'] - TOTAL_ENVIADO) > 0.01:
        lib.pendiente('Socios — total enviado', f"El archivo enviado suma {_ar(env['total'])} y se esperaba {_ar(TOTAL_ENVIADO)}.",
                      _ar(env['total'] - TOTAL_ENVIADO), DONDE)

    # ---------- (2) anexo ----------
    h.blanco()
    h.seccion('2 · Anexo — en lo enviado y todavía NO en el sistema')
    h.nota('NO son novedades para el contador: estos renglones ya están en el papel que tiene. Son lo que falta cargar o imputar '
           'en el sistema para que su export dé lo mismo que lo enviado. Importe con el signo de la cuenta: negativo = MSA pagó '
           'por el socio o él retiró (baja el saldo).')
    _enc(h, ['Fecha', 'Socio', 'Detalle (como figura en lo enviado)', 'Quién pagó', 'Por qué el sistema no lo tiene', None,
             None, None, 'Importe'], {5: 8})
    nombres = {k: n for _, k, n, _, _ in SOCIOS}
    f_anexo = {}
    tot_anexo_py = 0.0
    for sub, clave, nombre, _, _ in SOCIOS:
        fs = [f for f in anexo if f['socio'] == clave]
        if not fs:
            continue
        a = None
        s = 0.0
        for f in fs:
            det = f['concepto'] + (f" · {f['grupo']}" if f['grupo'] else '') + (f" · código {f['codigo']}" if f['codigo'] else '')
            r = _fila(h, [f['fecha'], nombre, det, f['cuenta'], _motivo(f), None, None, None, float(f['importe'])], {5: 8})
            a = a or r
            s += f['importe']
        f_anexo[sub] = h.total(f'Subtotal anexo — {nombre}', {9: h.suma(9, a, h.r)}, col_etiqueta=2)
        tot_anexo_py += s
        h.celda(7, f_res[sub]).value = f"={h.cel(9, f_anexo[sub])}"
        sistema = resumen.get(nombre, {}).get('cierre', 0.0)
        if abs(sistema + s - env['cierre'].get(clave, 0.0)) > 0.01:
            lib.pendiente(f'Socios — {nombre}: anexo', f'Sistema {_ar(sistema)} + anexo {_ar(s)} = {_ar(sistema + s)} y lo '
                          f"enviado dice {_ar(env['cierre'].get(clave, 0.0))}: quedan {_ar(env['cierre'].get(clave, 0.0) - sistema - s)} "
                          'sin explicar renglón por renglón.', '$', DONDE)
    f_tot_anexo = h.total('Total anexo — lo que falta en el sistema', {9: h.suma_de(9, list(f_anexo.values()))}, clave=True,
                          col_etiqueta=2)
    h.control('total del anexo', h.cel(9, f_tot_anexo), round(env['total'] - total_f, 2), 'total enviado − total de 14.1')
    for sub, clave, nombre, _, _ in SOCIOS:  # socios sin anexo: enviado tiene que ser igual al sistema
        if sub not in f_anexo and abs(resumen.get(nombre, {}).get('cierre', 0.0) - env['cierre'].get(clave, 0.0)) > 0.01:
            lib.pendiente(f'Socios — {nombre}', f"Sin renglones de anexo, pero el sistema dice "
                          f"{_ar(resumen.get(nombre, {}).get('cierre', 0.0))} y lo enviado {_ar(env['cierre'].get(clave, 0.0))}.",
                          '$', DONDE)
    for nombre, imp, n in sobran:
        lib.pendiente(f'Socios — {nombre}: en el sistema y no en lo enviado', f'{n} renglón(es) de {_ar(imp)} del export no '
                      'tienen par en el papel enviado.', _ar(imp * n), DONDE)
    if otros:
        lib.pendiente('Socios — archivo enviado', f'{len(otros)} renglón(es) de lo enviado con un socio que no es ninguno de los '
                      'seis: ' + '; '.join(sorted({f["socio"] for f in otros})) + '.', '', DONDE)
    if anexo:
        lib.pendiente('Socios — cargar en el sistema lo que ya se envió', f'{len(anexo)} renglón(es) por {_ar(tot_anexo_py)} '
                      'están en el papel enviado al contador y no en la cuenta del socio del sistema: ' +
                      '; '.join(f"{nombres[f['socio']]} {f['fecha'].strftime('%d/%m/%Y') if f['fecha'] else 's/f'} "
                                f"{f['cuenta']} {_ar(f['importe'])}" for f in anexo) +
                      '. Hasta cargarlos, el export da ' + _ar(total_f) + ' y lo enviado ' + _ar(env['total']) + '.',
                      'el balance propio ya mezcla los dos números (control −3.529.082)', DONDE)

    # ---------- (3) informativos (antes del detalle, para que el encabezado repetido sea sólo el del detalle) ----------
    wr = None
    try:
        wr = src.hoja(LIBRO, 'I · MSA · Retiros-Distrib soc')
    except SystemExit:
        pass
    cruce = {}
    if wr is not None:
        r0 = 1
        while r0 <= wr.max_row and _txt(wr.cell(r0, 1).value) != 'Nro':
            r0 += 1
        por = {}
        r = r0 + 1
        while r <= wr.max_row and wr.cell(r, 3).value is not None:
            if 'Galicia' in _txt(wr.cell(r, 5).value):
                q = _txt(wr.cell(r, 7).value)
                por[q] = por.get(q, 0.0) + num(wr.cell(r, 10).value) - num(wr.cell(r, 11).value)
            r += 1
        h.blanco()
        h.seccion('3 · Informativo — cruce de los retiros con la solapa «I · MSA · Retiros-Distrib soc» (no interviene en el saldo)')
        h.nota('Los renglones del detalle (tabla 4) con agrupadora «Retiros / Distribucion Socios» (retiros menos aportes), contra '
               'los retiros por el banco Galicia que lista la solapa de templates para la misma persona.')
        _enc(h, ['', 'Socio', 'Qué compara', None, None, None, 'Retiros netos en el detalle', 'Según la solapa de retiros',
                 'Diferencia'], {3: 6})
        for nombre, clave in (('Mercedes Areco', 'Mercedes Areco'), ('Sucesión de Plácido Martínez', 'PAM')):
            r = h.r + 1
            cruce[nombre] = _fila(h, [None, nombre, 'debe − haber de sus renglones de retiros y aportes', None, None, None,
                                      0.0, float(por.get(clave, 0.0)), f"={h.cel(7, r)}-{h.cel(8, r)}"], {3: 6})
    if sin_tratar:
        h.blanco()
        h.seccion('3.1 · Informativo — marcas del extracto que el sistema muestra aparte de estas cuentas')
        h.nota('El export las rotula «todavía sin tratar», pero ESTÁN tratadas (JMS 16/11): Libertad tiene su propio reparto y '
               'CTA QUINTA X es «Hermanos» en lo enviado. Lo que falta es que el sistema las muestre en su cuenta. '
               'Según la solapa 14.1 se muestran enteras y no se reparten entre los socios. No están en el saldo del sistema. '
               'La marca CTA QUINTA X es el renglón de «Hermanos» del anexo (tabla 2).')
        _enc(h, ['', 'Marca en la columna Contable', None, None, None, None, None, 'Movimientos', 'Total $'], {2: 7})
        a = None
        s = 0.0
        for marca, n, imp in sin_tratar:
            r = _fila(h, [None, marca, None, None, None, None, None, n, float(imp)], {2: 7}, fmt={8: '#,##0'})
            a = a or r
            s += imp
        rt = h.total('Total de las marcas que van aparte', {8: h.suma(8, a, h.r), 9: h.suma(9, a, h.r)}, fmt={8: '#,##0'}, col_etiqueta=2)
        if st_total is not None:
            h.control('total de las marcas que van aparte', h.cel(9, rt), st_total, '14.1, TOTAL SIN TRATAR')
        lib.pendiente('Socios — marcas que el sistema muestra aparte de las cuentas', 'Marcas del extracto que el export rotula «sin tratar» (están tratadas: Libertad y Quinta X): ' +
                      '; '.join(f'{m}: {n} movimiento(s) por {_ar(i)}' for m, n, i in sin_tratar) +
                      f'. Total {_ar(s)}. No están en el saldo del sistema; CTA QUINTA X (9.000,00) es «Hermanos» en lo enviado.',
                      'sólo presentación: falta que el sistema las muestre en su cuenta', DONDE)

    # ---------- (4) detalle del sistema, por socio y por mes ----------
    h.blanco()
    h.seccion('4 · Detalle según el sistema — cada socio, mes por mes (export 14.1 Cuentas con socios)')
    h.nota('Debe = MSA le pagó o él retiró (baja el saldo); Haber = el socio facturó, se le devengó sueldo, aportó o pagó algo '
           'por MSA (sube el saldo). «Cuenta» dice por dónde pasó: el banco o la tarjeta de MSA, la cuenta del socio que pagó por '
           'MSA, «Facturas y sueldo» (lo devengado) o el cuadro final de Gastos Libertad. Saldo al cierre de cada socio = saldo '
           'al inicio + la suma de los subtotales mensuales. Cotitulares y Hermanos no tienen detalle acá: están sólo en el anexo.')
    retiros = {}
    for sub, clave, nombre, _, _ in SOCIOS:
        d = detalle.get(nombre)
        res = resumen.get(nombre)
        if d is None or res is None:
            if clave not in ('Cotitulares', 'Hermanos'):
                lib.pendiente('Socios — fuente', f'No se encontró a «{nombre}» en la solapa 14.1 (resumen o detalle).',
                              'falta el sub-ítem ' + sub, DONDE)
            continue
        h.blanco()
        h.seccion(f"4 · {sub} · {nombre} — CUIT {res['cuit']} — según el sistema")
        if res['lee']:
            h.nota(f"Según el export: {res['lee']}." + (f" {avisos[nombre]}" if nombre in avisos else ''))
        h.encabezado(COLS, repetir=True)
        ini = d['inicio'] if d['inicio'] is not None else res['inicio']
        f_ini = _fila(h, [None, 'Saldo al inicio (30/06/2025)', None, None, None, None, None, None, float(ini)], {2: 3},
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
                _fila(h, [m['fecha'], m['cuenta'], m['concepto'] or None, m['agrup'] or None, m['otra'] or None,
                          float(m['debe']) if m['debe'] else None, float(m['haber']) if m['haber'] else None,
                          f"={h.cel(7, r)}-{h.cel(6, r)}"])
                a = a or r
                saldo_py += m['haber'] - m['debe']
                if 'retiros' in m['agrup'].lower():
                    retiros.setdefault(nombre, []).append(r)
            rs = h.total(f'Subtotal {MESES[mes - 1]} {anio} — saldo al fin del mes',
                         {6: h.suma(6, a, h.r), 7: h.suma(7, a, h.r), 8: h.suma(8, a, h.r),
                          9: f"={h.cel(9, f_saldo)}+{h.cel(8, h.r + 1)}"}, col_etiqueta=2)
            subt.append(rs)
            f_saldo = rs
        fc = h.total(f'Saldo al cierre según el sistema — {nombre}',
                     {6: h.suma_de(6, subt), 7: h.suma_de(7, subt), 8: h.suma_de(8, subt),
                      9: f"={h.cel(9, f_ini)}+" + h.suma_de(8, subt)[1:]}, clave=True, col_etiqueta=2)
        h.control(f'cierre {clave} según el sistema', h.cel(9, fc), res['cierre'], '14.1, resumen, SALDO AL CIERRE')
        h.celda(6, f_res[sub]).value = f"={h.cel(9, fc)}"
        # verificación en Python
        if abs(saldo_py - res['cierre']) > 0.01:
            lib.pendiente(f'Socios — {nombre}', f'Inicio {_ar(ini)} + movimientos del detalle da {_ar(saldo_py)} y el resumen del '
                          f"export dice {_ar(res['cierre'])}: diferencia {_ar(saldo_py - res['cierre'])}.", '$', DONDE)
        if abs(ini - env['inicio'].get(clave, 0.0)) > 0.01:
            lib.pendiente(f'Socios — {nombre}: saldo de inicio', f"El sistema arranca en {_ar(ini)} y lo enviado en "
                          f"{_ar(env['inicio'].get(clave, 0.0))}.", '$', DONDE)
        if d['cierre'] is not None and abs(d['cierre'] - res['cierre']) > 0.01:
            lib.pendiente(f'Socios — {nombre}', f"El detalle del export cierra en {_ar(d['cierre'])} y su resumen en "
                          f"{_ar(res['cierre'])}.", '$', DONDE)
        debe, haber = sum(m['debe'] for m in movs), sum(m['haber'] for m in movs)
        if abs(debe - res['pagado']) > 0.01 or abs(haber - res['facturado']) > 0.01:
            lib.pendiente(f'Socios — {nombre}: columnas del resumen', f'El detalle suma debe {_ar(debe)} y haber {_ar(haber)}; '
                          f"el resumen del export muestra «Pagado/cobrado» {_ar(res['pagado'])} y «Facturado» "
                          f"{_ar(res['facturado'])}. La diferencia es la misma en las dos columnas ({_ar(debe - res['pagado'])}): "
                          'el resumen compensa lo que el socio pagó por MSA o aportó contra lo pagado. El saldo no cambia.',
                          'sólo presentación', DONDE)
        if res['inicio'] == 0 and 'sin dato de inicio' in res['lee']:
            extra = ''
            if sub == '10d':
                extra = ' (el balance 24/25 del contador traía «Socio Plácido Martínez» por 45.905.575,52'
                extra += (f"; en el papel enviado JMS anotó al costado {env['nota_pam']}" if env['nota_pam'] else '') + ')'
            lib.pendiente(f'Socios — {nombre}: saldo de inicio', 'Ni el sistema ni lo enviado tienen saldo de inicio: va 0' +
                          extra + '.', 'mueve el saldo al cierre en el mismo importe', DONDE)
        if nombre in avisos:
            lib.pendiente(f'Socios — {nombre}: pagos sin comprobante', avisos[nombre] +
                          ' (en el detalle figuran como «← sin referencia»).', 'falta el respaldo de esos pagos', DONDE)

    # el cruce de retiros apunta a los renglones del detalle
    for nombre, r in cruce.items():
        filas = retiros.get(nombre, [])
        if filas:
            h.celda(7, r).value = h.suma_de(6, filas) + '-(' + h.suma_de(7, filas)[1:] + ')'

    # ---------- ítems: todos apuntan al saldo ENVIADO de la tabla 1 ----------
    lib.item('10', 'Cuentas con socios (como se envió)', h, h.cel(9, f_total), GRUPO,
             f'saldo según el sistema {_ar(total_f)} + anexo de lo enviado que falta en el sistema {_ar(tot_anexo_py)}', None)
    for sub, clave, nombre, _, contador in SOCIOS:
        lib.item(sub, nombre, h, h.cel(9, f_res[sub]), GRUPO,
                 'saldo según el sistema + sus renglones del anexo' if sub in f_anexo and resumen.get(nombre)
                 else ('sólo en lo enviado: sus renglones del anexo' if sub in f_anexo else 'saldo según el sistema (sin anexo)'),
                 contador)
