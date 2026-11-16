# -*- coding: utf-8 -*-
"""Detalle 10.1 — Cuentas con socios, lectura INTERNA (ítem 10i: 10ia JMS · 10ib AMS · 10ic MA · 10id PAM).

Objetivo O4 (JMS 15/11): cada socio con su saldo al inicio, lo que ganó, lo que retiró y su saldo al cierre, por mes,
contable e interno LADO A LADO, con control.

- CONTABLE = la cuenta de MSA con el socio según el SISTEMA (export «Socios y Libertad» → 14.1 Cuentas con socios; la
  misma lectura que la tabla 4 de «D10 Socios»). OJO: D10 muestra arriba «como se envió al contador»; acá se parte del
  sistema porque de ahí sale la capa interna.
- INTERNO = «la realidad»: la capa interna de la app (solapa «I · Interno por socio»), que no reescribe nada: cada ajuste
  le saca a una cuenta y le pone a otra. Interno = contable − compensación.

Orden de la hoja: (1) tabla por socio, contable e interno lado a lado · (1.1) control de la capa · (2) cada socio mes por
mes · (3) detalle de los ajustes por socio y por mes · (4) lo sin resolver.
No modifica d_socios.py: sólo reusa su lectura de la 14.1 y sus ayudantes de renglón."""
import datetime

from openpyxl.styles import Alignment, Border
from openpyxl.utils import get_column_letter

from core import F_B, FINO, R_ENC, num
from d_socios import MESES, _ar, _enc, _fila, _leer, _txt

GRUPO = 'C · Socios'
LIBRO = 'Socios y Libertad'
DONDE = 'D10.1 Socios interno'
D10 = 'D10 Socios'
ANCHOS = [11, 19, 15, 15, 15, 15, 15, 15, 15, 15]  # 150
# (sub-ítem, sub-ítem de D10, clave en la solapa interna, nombre en la 14.1)
SOCIOS = [
    ('10ia', '10a', 'JMS', 'José María Martínez'),
    ('10ib', '10b', 'AMS', 'Andrés Martínez'),
    ('10ic', '10c', 'MA', 'Mercedes Areco'),
    ('10id', '10d', 'PAM', 'Sucesión de Plácido Martínez'),
]
PERIODO = [(2025, m) for m in range(7, 13)] + [(2026, m) for m in range(1, 7)]
DIF_ENVIADO = 3529081.86  # total enviado al contador (−90.123.846,86) menos total del sistema (−86.594.765,00): anexo de D10
PREVIAS = {'JMS': -36793752.36, 'AMS': -6802618.10, 'MA': -92875208.86, 'PAM': -198826.57}  # cifras escritas antes


def _fecha(v):
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    try:
        return datetime.date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def _t(v):
    """Texto de celda: nunca empieza con «=»."""
    s = _txt(v)
    return ('· ' + s) if s.startswith('=') else s


def _mes(ym):
    return f'{MESES[ym[1] - 1]} {ym[0]}'


def _leer_interno(ws):
    """La solapa «I · Interno por socio»: tabla, contrapartidas, detalle por socio y lo sin resolver."""
    out = dict(tabla={}, otras=[], otras_total=None, detalle={}, subtotal={}, sin=[], cabecera=[])
    r = 1
    while r <= ws.max_row and _txt(ws.cell(r, 1).value) != 'Socio':
        if _txt(ws.cell(r, 1).value):
            out['cabecera'].append(_txt(ws.cell(r, 1).value))
        r += 1
    r += 1
    while r <= ws.max_row and _txt(ws.cell(r, 1).value) and not _txt(ws.cell(r, 1).value).startswith('Empresas'):
        out['tabla'][_txt(ws.cell(r, 1).value)] = dict(
            balance=num(ws.cell(r, 2).value), movs=num(ws.cell(r, 3).value), fijos=num(ws.cell(r, 4).value),
            total=num(ws.cell(r, 5).value), realidad=num(ws.cell(r, 6).value), n=int(num(ws.cell(r, 7).value)))
        r += 1
    if _txt(ws.cell(r, 1).value).startswith('Empresas'):
        out['otras_total'] = num(ws.cell(r, 3).value)
        r += 1
        while r <= ws.max_row and _txt(ws.cell(r, 1).value):
            out['otras'].append((_txt(ws.cell(r, 1).value), num(ws.cell(r, 3).value)))
            r += 1
    q = None
    en_sin = False
    for k in range(r, ws.max_row + 1):
        a = ws.cell(k, 1).value
        ta = _txt(a)
        if ta.startswith('DETALLE — '):
            q = ta[len('DETALLE — '):].strip()
            out['detalle'][q] = []
            continue
        if ta.startswith('SIN RESOLVER'):
            en_sin, q = True, None
            continue
        f = _fecha(a) if a is not None and not isinstance(a, str) else None
        if en_sin:
            if f:
                out['sin'].append(dict(fila=k, fecha=f, cuenta=_txt(ws.cell(k, 2).value), detalle=_txt(ws.cell(k, 3).value),
                                       categ=_txt(ws.cell(k, 4).value), contable=_txt(ws.cell(k, 5).value),
                                       interno=_txt(ws.cell(k, 6).value), deb=num(ws.cell(k, 7).value),
                                       cred=num(ws.cell(k, 8).value), porque=_txt(ws.cell(k, 9).value)))
            continue
        if q is None:
            continue
        if f:
            out['detalle'][q].append(dict(
                fila=k, fecha=f, cuenta=_txt(ws.cell(k, 2).value), detalle=_txt(ws.cell(k, 3).value),
                categ=_txt(ws.cell(k, 4).value), contable=_txt(ws.cell(k, 5).value), interno=_txt(ws.cell(k, 6).value),
                imp=num(ws.cell(k, 7).value), donde=_txt(ws.cell(k, 8).value), porque=_txt(ws.cell(k, 9).value),
                fijo=_txt(ws.cell(k, 8).value) == 'ajuste fijo'))
        elif _txt(ws.cell(k, 3).value).startswith('Subtotal'):
            out['subtotal'][q] = num(ws.cell(k, 7).value)
    return out


def _empresa(cuenta):
    return cuenta.split(' · ')[0].strip() if ' · ' in cuenta else cuenta


def _legible(x, empresa):
    """La cuenta de la otra punta, en palabras."""
    if x == '(propio)':
        return f'gasto propio de {empresa}'
    if x.startswith('LIB'):
        return f'Gastos Libertad 50/50 (pagó {empresa})'
    if x == 'QUINTA':
        return 'CTA QUINTA X (marca sin tratar)'
    return f'cuenta de {x}'


def _puntas(a, q):
    """(sale de, va a) de un ajuste del socio q, según «viene de X» / «va a X» del export."""
    emp = _empresa(a['cuenta'])
    d = a['donde']
    if d.startswith('viene de '):
        return _legible(d[len('viene de '):], emp), f'cuenta de {q}', d[len('viene de '):]
    if d.startswith('va a '):
        return f'cuenta de {q}', _legible(d[len('va a '):], emp), d[len('va a '):]
    return d, f'cuenta de {q}', d


def _regla(a):
    p = a['porque']
    if p.startswith('seguro'):
        return 'Regla 3 (Desglosar) — ' + p
    if p.startswith('pago de tarjeta'):
        return 'Regla 3 (Desglosar) — ' + p
    if 'es una actividad' in p:
        return 'Regla 4 — ' + p
    if p.startswith('interno «'):
        return 'Regla 2 — ' + p + ': en lo real es de quien dice el interno'
    return p


def _banda(h, textos):
    """Renglón de banda sobre el encabezado: {col_desde: (col_hasta, texto)}."""
    h.r += 1
    for c1, (c2, t) in textos.items():
        x = h.celda(c1, h.r)
        x.value = t
        x.font = F_B
        x.fill = R_ENC
        x.alignment = Alignment(horizontal='center', vertical='center')
        x.border = Border(top=FINO)
        for c in range(c1, c2 + 1):
            h.celda(c, h.r).fill = R_ENC
            h.celda(c, h.r).border = Border(top=FINO)
        if c2 > c1:
            h.ws.merge_cells(start_row=h.r, start_column=c1 + 1, end_row=h.r, end_column=c2 + 1)
    return h.r


def _subtotales_d10(lib, sub_d10, nombre):
    """Si la hoja D10 está en el libro: {(año, mes): renglón del subtotal mensual} del detalle de ese socio."""
    if D10 not in lib.wb.sheetnames:
        return None
    ws = lib.wb[D10]
    filas, dentro = {}, False
    rot = {f'Subtotal {_mes(ym)} — saldo al fin del mes': ym for ym in PERIODO}
    for r in range(1, ws.max_row + 1):
        b, c = _txt(ws.cell(r, 2).value), _txt(ws.cell(r, 3).value)
        if b.startswith(f'4 · {sub_d10} · {nombre}'):
            dentro = True
        elif dentro and c in rot:
            filas[rot[c]] = r
        elif dentro and c.startswith('Saldo al cierre según el sistema'):
            break
    return filas if dentro else None


def construir(lib, src):
    arch = src.nombre(LIBRO)
    resumen, total_f, total_ini_f, _st, _stt, detalle, _av = _leer(src.hoja(LIBRO, '14.1'))
    inte = _leer_interno(src.hoja(LIBRO, 'I · Interno por socio'))
    h = lib.hoja(DONDE, ANCHOS, horizontal=True)
    col = lambda c: get_column_letter(c + 1)  # noqa: E731

    # ---------- preparación y verificaciones en Python (nada se descarta en silencio) ----------
    datos = {}
    for sub, sub10, q, nombre in SOCIOS:
        d, res, t = detalle.get(nombre), resumen.get(nombre), inte['tabla'].get(q)
        if d is None or res is None or t is None:
            lib.pendiente('Socios interno — fuente', f'No se encontró a «{nombre}» ({q}) en la 14.1 o en la solapa interna.',
                          'falta el sub-ítem ' + sub, DONDE)
            continue
        ini = d['inicio'] if d['inicio'] is not None else res['inicio']
        cont = {ym: [0.0, 0.0] for ym in PERIODO}  # haber, debe
        fuera = 0.0
        for m in d['movs']:
            ym = (m['fecha'].year, m['fecha'].month)
            if ym in cont:
                cont[ym][0] += m['haber']
                cont[ym][1] += m['debe']
            else:
                fuera += m['haber'] - m['debe']
        if abs(fuera) > 0.005:
            lib.pendiente(f'Socios interno — {nombre}', f'La 14.1 tiene movimientos fuera de jul-25/jun-26 por {_ar(fuera)}: '
                          'no entran en la tabla por mes.', _ar(fuera), DONDE)
        ajustes = [a for a in inte['detalle'].get(q, []) if not a['fijo']]
        fijos_exp = [a for a in inte['detalle'].get(q, []) if a['fijo']]
        s_movs, s_fijos = sum(a['imp'] for a in ajustes), sum(a['imp'] for a in fijos_exp)
        if abs(s_movs - t['movs']) > 0.01 or abs(s_fijos - t['fijos']) > 0.01:
            lib.pendiente(f'Socios interno — {nombre}', f'El detalle del export suma movimientos {_ar(s_movs)} y fijos '
                          f"{_ar(s_fijos)}; su tabla dice {_ar(t['movs'])} y {_ar(t['fijos'])}.", '$', DONDE)
        if abs(t['balance'] - res['cierre']) > 0.01:
            lib.pendiente(f'Socios interno — {nombre}', f"La solapa interna parte de un balance de {_ar(t['balance'])} y la "
                          f"14.1 cierra en {_ar(res['cierre'])}.", _ar(t['balance'] - res['cierre']), DONDE)
        if abs(t['balance'] - t['total'] - t['realidad']) > 0.01:
            lib.pendiente(f'Socios interno — {nombre}', 'En el export, balance − compensación no da su «realidad».', '$', DONDE)
        # el ajuste fijo, mes por mes: los renglones de sueldo de la 14.1 (si suman lo mismo que el fijo del export)
        fijos = []
        if fijos_exp:
            sueldos = [m for m in d['movs'] if m['cuenta'] == 'Facturas y sueldo' and m['concepto'].startswith('Sueldo')]
            if abs(sum(m['haber'] - m['debe'] for m in sueldos) - s_fijos) <= 0.01:
                fijos = [dict(fecha=m['fecha'].date(), cuenta='MSA · 14.1 (Facturas y sueldo)', detalle=m['concepto'],
                              imp=m['haber'] - m['debe'], porque=fijos_exp[0]['porque'] + ' — ' + fijos_exp[0]['detalle'])
                         for m in sorted(sueldos, key=lambda m: m['fecha'])]
            else:
                fijos = [dict(fecha=a['fecha'], cuenta=a['cuenta'], detalle=a['detalle'], imp=a['imp'], porque=a['porque'])
                         for a in fijos_exp]
                lib.pendiente(f'Socios interno — {nombre}: ajuste fijo', 'Los renglones de sueldo de la 14.1 no suman el ajuste '
                              f'fijo del export ({_ar(s_fijos)}): el fijo va entero en la fecha que le pone el export, no mes '
                              'por mes.', 'sólo la distribución por mes', DONDE)
        fuera_aj = [a for a in ajustes if (a['fecha'].year, a['fecha'].month) not in cont] + \
                   [a for a in fijos if (a['fecha'].year, a['fecha'].month) not in cont]
        if fuera_aj:
            lib.pendiente(f'Socios interno — {nombre}', f'{len(fuera_aj)} ajuste(s) con fecha fuera de jul-25/jun-26: están en '
                          'el detalle pero no en la tabla por mes.', _ar(sum(a['imp'] for a in fuera_aj)), DONDE)
        if abs(t['realidad'] - PREVIAS[q]) > 0.01:
            lib.pendiente(f'Socios interno — {nombre}: cifra anterior', f"La realidad escrita antes era {_ar(PREVIAS[q])} y el "
                          f"export del 15/11 dice {_ar(t['realidad'])} (diferencia {_ar(t['realidad'] - PREVIAS[q])}). Vale el "
                          'export.', 'sólo informativo', DONDE)
        datos[q] = dict(sub=sub, sub10=sub10, nombre=nombre, ini=ini, cont=cont, res=res, t=t, ajustes=ajustes, fijos=fijos)
    # contrapartida: lo que el detalle le pone a los socios, visto desde la otra punta, contra las cuentas «otras» del export
    contra = {}
    for q, x in datos.items():
        for a in x['ajustes']:
            k = f"{_empresa(a['cuenta'])}→{_puntas(a, q)[2]}"
            contra[k] = contra.get(k, 0.0) - a['imp']
    otras_exp = {k.strip().replace('gasto propio', '(propio)'): v for k, v in inte['otras']}
    socios_q = {q for _, _, q, _ in SOCIOS}
    for k in sorted(set(contra) | set(otras_exp)):
        if k.split('→')[-1] in socios_q or k.startswith('MA→'):
            continue  # entre socios (se netea) · cuentas de la empresa MA: se mueven entre sí, sin tocar a un socio
        if abs(contra.get(k, 0.0) - otras_exp.get(k, 0.0)) > 0.01:
            lib.pendiente('Socios interno — contrapartida', f'La cuenta «{k}» da {_ar(contra.get(k, 0.0))} sumando el detalle '
                          f'de los socios y {_ar(otras_exp.get(k, 0.0))} en la tabla del export.', '$', DONDE)
    por_emp = {}
    for q, x in datos.items():
        for a in x['ajustes']:
            e = _empresa(a['cuenta'])
            por_emp.setdefault(q, {}).setdefault(e, 0.0)
            por_emp[q][e] += a['imp']
    n_sin = len(inte['sin'])
    tot_sin = sum(m['deb'] - m['cred'] for m in inte['sin'])
    tot_cont = sum(x['res']['cierre'] for x in datos.values())
    tot_real = sum(x['t']['realidad'] for x in datos.values())

    # ---------- título y notas ----------
    h.titulo('Detalle 10.1 — Cuentas con socios: lectura CONTABLE y lectura INTERNA, lado a lado (ítem 10i)')
    h.nota('CONTABLE = la cuenta de MSA con cada socio como la lleva el sistema para el contador (códigos «CTA JMS», «CTA AMS», '
           '«CTA MA», «CTA PAM»). INTERNO = «la realidad»: una capa encima que no cambia ningún registro; toma cada movimiento '
           'cuya marca interna dice que la plata fue para otro lado que su marca contable y lo pasa de una cuenta a la otra.')
    h.nota('Signo de los saldos: POSITIVO = MSA le debe al socio · NEGATIVO = el socio le debe a MSA (se llevó de más). '
           'Saldo interno = saldo contable − compensación de la capa (compensación positiva = en lo real el socio se llevó más).')
    h.nota(f'Fuentes: {arch} → «14.1 Cuentas con socios» (contable) e «I · Interno por socio» (interno). ESTA HOJA PARTE DE LO QUE '
           f'DICE EL SISTEMA ({_ar(total_f)}), que es de donde sale la capa interna; la tabla principal de «{D10}» va como se '
           f'envió al contador (−90.123.846,86). La diferencia de {_ar(DIF_ENVIADO)} son los renglones del anexo de «{D10}» '
           '(tabla 2: lo enviado que todavía no está en el sistema, incluidos Cotitulares y Hermanos, que no tienen lectura '
           'interna). Orden de la hoja: (1) tabla por socio · (1.1) control de la capa · (2) cada socio mes por mes · '
           '(3) detalle de los ajustes · (4) lo sin resolver.')
    for c in inte['cabecera'][2:]:
        if c.startswith('⚠'):
            h.nota('Aviso del export: ' + c)
            lib.pendiente('Socios interno — cuentas sin leer', c, 'la compensación puede estar incompleta', DONDE)

    # ---------- (1) tabla principal ----------
    h.blanco()
    h.seccion('1 · Cada socio: saldo al inicio, lo que ganó, lo que se le pagó o retiró y saldo al cierre — contable e interno')
    h.nota('El saldo al inicio es el mismo en las dos lecturas (la capa sólo mira los movimientos del ejercicio). «Ganó» = facturó, '
           'se le devengó sueldo, aportó o pagó algo por MSA (haber). «Se le pagó o retiró» = MSA le pagó o él retiró (debe). En el '
           'interno, los movimientos que la capa le asigna van a «se le pagó o retiró» y el sueldo que es sólo contable se saca de '
           f'«ganó». Cada celda apunta a la tabla 2 (por mes) o a la tabla 3 (ajustes). El saldo interno queda SUJETO a los {n_sin} '
           f'movimientos sin resolver de la tabla 4 ({_ar(tot_sin)}), que hoy quedan como en el contable.')
    _banda(h, {1: (3, ''), 4: (6, 'CONTABLE — según el sistema (14.1)'), 7: (9, 'INTERNO — la realidad'), 10: (10, '')})
    _enc(h, ['Sub-ítem · socio', None, 'Saldo al inicio (30/06/2025)', 'Ganó: facturó, sueldo, aportó o pagó por MSA',
             'Se le pagó o retiró', 'SALDO AL CIERRE CONTABLE', 'Ganó (real)', 'Se le pagó o retiró (real)',
             'SALDO AL CIERRE INTERNO', 'Diferencia: interno − contable'], {1: 2})
    f_res = {}
    for q, x in datos.items():
        r = h.r + 1
        f_res[q] = _fila(h, [f"{x['sub']} · {x['nombre']}", None, 0.0, 0.0, 0.0, f"={h.cel(3, r)}+{h.cel(4, r)}-{h.cel(5, r)}",
                             0.0, 0.0, f"={h.cel(3, r)}+{h.cel(7, r)}-{h.cel(8, r)}", f"={h.cel(9, r)}-{h.cel(6, r)}"], {1: 2})
    filas_res = list(f_res.values())
    f_total = h.total('Total ítem 10i — los cuatro socios', {c: h.suma(c, filas_res[0], filas_res[-1]) for c in range(3, 11)},
                      clave=True)
    h.control('total contable de los cuatro', h.cel(6, f_total), total_f, '14.1 Cuentas con socios, TOTAL')
    for q, x in datos.items():
        h.control(f'cierre contable {q}', h.cel(6, f_res[q]), x['res']['cierre'], '14.1, resumen, SALDO AL CIERRE')
    h.control('total interno de los cuatro', h.cel(9, f_total), tot_real, 'I · Interno por socio, suma de «La REALIDAD»')
    for q, x in datos.items():
        h.control(f'cierre interno {q}', h.cel(9, f_res[q]), x['t']['realidad'], 'I · Interno por socio, «La REALIDAD»')

    # ---------- (1.1) control de la capa ----------
    h.blanco()
    h.seccion('1.1 · Control de la capa interna: lo que se le pone a un socio sale de otra cuenta (la capa mueve plata, no la crea)')
    h.nota('Compensación por MOVIMIENTOS de cada socio (apunta a su total de la tabla 3) más la contrapartida: las cuentas de las '
           'empresas y de Gastos Libertad de donde sale esa plata (dato de la tabla del export). Tiene que sumar 0. Los ajustes '
           'FIJOS van aparte: el sueldo de Mercedes Areco no pasa a la cuenta de otro socio — en lo real es dividendo —, así que '
           'no tiene contrapartida entre estas cuentas y los cuatro socios solos NO suman 0. Los movimientos que la capa toma '
           'salen de las cuentas de las TRES empresas (MSA, PAM y MA): la realidad de cada socio es su saldo con MSA menos lo '
           'que en lo real se llevó por cualquiera de las tres (ver «Empresa · cuenta» en la tabla 3).')
    _enc(h, ['Cuenta', None, None, None, None, None, 'Qué es', None, None, 'Compensación por movimientos'], {1: 6, 7: 9})
    f_capa = {}
    a = None
    for q, x in datos.items():
        emp = ' · '.join(f'por cuentas de {e}: {_ar(v)}' for e, v in sorted(por_emp.get(q, {}).items()))
        f_capa[q] = _fila(h, [f"Socio — {x['nombre']} ({q})", None, None, None, None, None,
                              'en lo real se llevó de más (+)' + (f' — {emp}' if emp else ''), None, None, 0.0], {1: 6, 7: 9})
        a = a or f_capa[q]
    for k, v in inte['otras']:
        _fila(h, ['Contrapartida — ' + k.strip().replace('→', ' → '), None, None, None, None, None,
                  'sale de acá (−) o vuelve acá (+)', None, None, float(v)], {1: 6, 7: 9})
    f_cero = h.total('Suma: socios + contrapartida (tiene que dar 0)', {10: h.suma(10, a, h.r)}, clave=True)
    h.control('la capa sólo mueve entre cuentas', h.cel(10, f_cero), 0.0, 'identidad de la capa (el export dice «✅ 0»)')
    if inte['otras_total'] is not None and abs(sum(v for _, v in inte['otras']) - inte['otras_total']) > 0.01:
        lib.pendiente('Socios interno — contrapartida', 'Las cuentas de contrapartida del export no suman su propio total.', '$',
                      DONDE)
    h.blanco()
    _enc(h, ['Ajustes fijos (no son movimientos)', None, None, None, None, None, 'Qué es', None, None, 'Ajuste fijo'],
         {1: 6, 7: 9})
    f_fijo_res = {}
    a = None
    for q, x in datos.items():
        if not x['fijos']:
            continue
        f_fijo_res[q] = _fila(h, [f"Socio — {x['nombre']} ({q})", None, None, None, None, None,
                                  'sueldo sólo contable: en lo real es dividendo (apunta a la tabla 3)', None, None, 0.0],
                              {1: 6, 7: 9})
        a = a or f_fijo_res[q]
    if a:
        f_fijos_tot = h.total('Total ajustes fijos', {10: h.suma(10, a, h.r)})
        h.control('ajustes fijos', h.cel(10, f_fijos_tot), sum(x['t']['fijos'] for x in datos.values()),
                  'I · Interno por socio, «Ajustes fijos»')
    else:
        _fila(h, ['(ninguno)'], {1: 6})

    # ---------- (2) por socio y por mes ----------
    h.blanco()
    h.seccion('2 · Cada socio, mes por mes: movimiento contable, ajuste interno, movimiento real y saldo real al fin de mes')
    enlazado = D10 in lib.wb.sheetnames
    h.nota('Ganó y se le pagó o retiró (contable): ' +
           (f'cada celda apunta al subtotal de ese mes en el detalle de «{D10}» (tabla 4).' if enlazado else
            f'suma del mes de los renglones de la 14.1 (el renglón por renglón está en «{D10}», tabla 4).') +
           ' Ajuste por movimientos = el subtotal del mes en la tabla 3, con el signo cambiado (lo que en lo real se llevó de más '
           'baja su saldo). Ajuste fijo = el sueldo sólo contable de ese mes, con el signo cambiado. Movimiento real = contable + '
           'los dos ajustes. Los dos semestres van separados; el total suma los dos semestres.')
    f_mes, f_tot_mes = {}, {}
    for q, x in datos.items():
        d10 = _subtotales_d10(lib, x['sub10'], x['nombre'])
        h.blanco()
        h.seccion(f"2 · {x['sub']} · {x['nombre']} — por mes")
        _banda(h, {1: (2, ''), 3: (5, 'CONTABLE'), 6: (7, 'AJUSTE INTERNO'), 8: (8, 'INTERNO'), 9: (10, 'SALDO AL FIN DEL MES')})
        _enc(h, ['Mes', None, 'Ganó (haber)', 'Se le pagó o retiró (debe)', 'Movimiento contable', 'Ajuste por movimientos',
                 'Ajuste fijo (sueldo sólo contable)', 'Movimiento REAL', 'Saldo contable', 'Saldo REAL'], {1: 2})
        f_ini = _fila(h, ['Saldo al inicio (30/06/2025)', None, None, None, None, None, None, None, float(x['ini']),
                          f"={h.cel(9, h.r + 1)}"], {1: 2}, negrita=True)
        prev = f_ini
        sems = []
        for s, tramo in enumerate((PERIODO[:6], PERIODO[6:])):
            a = None
            for ym in tramo:
                r = h.r + 1
                hab, deb = x['cont'][ym]
                if d10 is not None and ym in d10:
                    v_h, v_d = f"='{D10}'!{col(7)}{d10[ym]}", f"='{D10}'!{col(6)}{d10[ym]}"
                else:
                    v_h, v_d = float(hab), float(deb)
                    if d10 is not None and (abs(hab) > 0.005 or abs(deb) > 0.005):
                        lib.pendiente(f"Socios interno — {x['nombre']}", f'No se encontró el subtotal de {_mes(ym)} en «{D10}»: '
                                      'ese mes va como número, sin enlace.', 'sólo el enlace', DONDE)
                _fila(h, [_mes(ym), None, v_h, v_d, f"={h.cel(3, r)}-{h.cel(4, r)}", 0.0, 0.0,
                          f"={h.cel(5, r)}+{h.cel(6, r)}+{h.cel(7, r)}", f"={h.cel(9, prev)}+{h.cel(5, r)}",
                          f"={h.cel(10, prev)}+{h.cel(8, r)}"], {1: 2})
                f_mes[(q, ym)] = r
                a = a or r
                prev = r
            rot = '1er semestre (julio a diciembre 2025)' if s == 0 else '2do semestre (enero a junio 2026)'
            fs = {c: h.suma(c, a, h.r) for c in range(3, 9)}
            fs[9], fs[10] = f"={h.cel(9, prev)}", f"={h.cel(10, prev)}"
            sems.append(h.total('Subtotal ' + rot, fs))
            if s == 0:
                h.blanco()
        ft = {c: h.suma_de(c, sems) for c in range(3, 9)}
        ft[9] = f"={h.cel(9, f_ini)}+{h.cel(5, h.r + 1)}"
        ft[10] = f"={h.cel(10, f_ini)}+{h.cel(8, h.r + 1)}"
        f_tot_mes[q] = h.total(f"Ejercicio 25/26 — {x['nombre']}: movimientos y saldo al cierre", ft, clave=True)
        h.control(f'saldo contable al cierre {q}', h.cel(9, f_tot_mes[q]), x['res']['cierre'], '14.1, resumen, SALDO AL CIERRE')
        h.control(f'saldo real al cierre {q}', h.cel(10, f_tot_mes[q]), x['t']['realidad'], 'I · Interno por socio, «La REALIDAD»')
        # la tabla principal apunta acá
        h.celda(3, f_res[q]).value = f"={h.cel(9, f_ini)}"
        h.celda(4, f_res[q]).value = f"={h.cel(3, f_tot_mes[q])}"
        h.celda(5, f_res[q]).value = f"={h.cel(4, f_tot_mes[q])}"
        h.celda(7, f_res[q]).value = f"={h.cel(3, f_tot_mes[q])}+{h.cel(7, f_tot_mes[q])}"
        h.celda(8, f_res[q]).value = f"={h.cel(4, f_tot_mes[q])}-{h.cel(6, f_tot_mes[q])}"

    # ---------- (3) detalle de los ajustes ----------
    h.blanco()
    h.seccion('3 · Detalle de los ajustes de la capa interna — por socio y por mes')
    h.nota('Cada renglón es un movimiento de una cuenta de MSA, PAM o MA cuya marca INTERNA dice que la plata fue para otro lado '
           'que su marca CONTABLE. Importe con el signo del export: POSITIVO = en lo real el socio se llevó más (baja su saldo); '
           'NEGATIVO = se le saca de su cuenta (lo suyo era, por ejemplo, gasto de la empresa). Reglas de la capa: (1) interno '
           'vacío = igual al contable · (2) «DIST X» o «GASTO X» = en lo real es de X · (3) «Desglosar» = se reparte (un seguro, '
           'por la prima de cada bien y su responsable; un pago de tarjeta, por sus consumos) · (4) «VER» o sin dato para abrirlo '
           '= sin resolver (tabla 4) · (5) una transferencia entre dos cuentas propias se cuenta una sola vez · (6) lo que va a '
           'nombre de la misma empresa es gasto propio.')
    for q, x in datos.items():
        h.blanco()
        h.seccion(f"3 · {x['sub']} · {x['nombre']} — ajustes de la capa interna")
        h.encabezado(['Fecha', 'Empresa · cuenta', 'Concepto · categoría', None, 'Marca contable → interna', 'Sale de', 'Va a',
                      'Regla que lo mueve', None, 'Compensación (+ se llevó más)'], repetir=True)
        h.ws.merge_cells(start_row=h.r, start_column=4, end_row=h.r, end_column=5)
        h.ws.merge_cells(start_row=h.r, start_column=9, end_row=h.r, end_column=10)
        meses = {}
        for a in sorted(x['ajustes'], key=lambda a: (a['fecha'], a['fila'])):
            meses.setdefault((a['fecha'].year, a['fecha'].month), []).append(a)
        subt = []
        for ym, ajs in meses.items():
            a0 = None
            for a in ajs:
                sale, va, _ = _puntas(a, q)
                con = _t(a['detalle']) + (f" · {a['categ']}" if a['categ'] else '')
                r = _fila(h, [a['fecha'], a['cuenta'], con or '(sin detalle)', None,
                              f"{a['contable'] or '(sin marca)'} → {a['interno'] or '(sin marca)'}", sale, va, _regla(a), None,
                              float(a['imp'])], {3: 4, 8: 9})
                a0 = a0 or r
            rs = h.total(f"Subtotal {_mes(ym)} — {x['nombre']}", {10: h.suma(10, a0, h.r)}, col_etiqueta=2)
            subt.append(rs)
            if (q, ym) in f_mes:
                h.celda(6, f_mes[(q, ym)]).value = f"=-{h.cel(10, rs)}"
        if not meses:
            _fila(h, [None, '(la capa no le mueve ningún movimiento)'], {2: 9})
        f_movs = h.total(f"Total compensación por movimientos — {x['nombre']}", {10: h.suma_de(10, subt)}, col_etiqueta=2)
        h.control(f'compensación por movimientos {q}', h.cel(10, f_movs), x['t']['movs'],
                  'I · Interno por socio, «Compensación interna (movimientos)»')
        h.celda(10, f_capa[q]).value = f"={h.cel(10, f_movs)}"
        partes = [f_movs]
        if x['fijos']:
            h.blanco()
            _enc(h, ['Fecha', 'Empresa · cuenta', 'Ajuste fijo — concepto', None, 'Marca contable → interna', 'Sale de', 'Va a',
                     'Regla que lo mueve', None, 'Compensación (+ se llevó más)'], {3: 4, 8: 9})
            a0 = None
            for a in x['fijos']:
                r = _fila(h, [a['fecha'], a['cuenta'], _t(a['detalle']), None, 'haber de la 14.1 → (no existe en lo real)',
                              f'cuenta de {q} (sueldo devengado)', 'dividendo (no es cuenta con MSA)',
                              'Ajuste fijo — ' + a['porque'], None, float(a['imp'])], {3: 4, 8: 9})
                a0 = a0 or r
                ym = (a['fecha'].year, a['fecha'].month)
                if (q, ym) in f_mes:
                    actual = h.celda(7, f_mes[(q, ym)]).value
                    nuevo = f"-{h.cel(10, r)}"
                    h.celda(7, f_mes[(q, ym)]).value = (actual + nuevo) if isinstance(actual, str) else '=' + nuevo
            f_fj = h.total(f"Total ajustes fijos — {x['nombre']}", {10: h.suma(10, a0, h.r)}, col_etiqueta=2)
            h.control(f'ajustes fijos {q}', h.cel(10, f_fj), x['t']['fijos'], 'I · Interno por socio, «Ajustes fijos»')
            if q in f_fijo_res:
                h.celda(10, f_fijo_res[q]).value = f"={h.cel(10, f_fj)}"
            partes.append(f_fj)
        f_comp = h.total(f"Compensación total — {x['nombre']} (movimientos + fijos)", {10: h.suma_de(10, partes)}, clave=True,
                         col_etiqueta=2)
        h.control(f'compensación total {q}', h.cel(10, f_comp), x['t']['total'], 'I · Interno por socio, «Compensación total»')

    # ---------- (4) sin resolver ----------
    h.blanco()
    h.seccion(f'4 · SIN RESOLVER — {n_sin} movimientos que la capa interna no pudo asignar (quedan como en el contable)')
    h.nota('La capa NO los mueve: no adivina. Los «Desglosar» de sueldos son pagos de sueldo y anticipo que hay que abrir (qué '
           'parte es sueldo y qué parte es otra cosa) y no hay un dato que lo haga; los «VER» no dicen de quién son. Hasta que se '
           'decida, los que tienen marca contable de un socio están en su saldo (contable e interno) como retiro, y los que no '
           'tienen marca contable están como gasto de la empresa. EL SALDO INTERNO DE LA TABLA 1 QUEDA SUJETO A ESTOS: cuando se '
           'abran, lo que no sea del socio saldrá de su cuenta y lo que sea de otro entrará en la de ese otro.')
    grupos = {}
    for m in sorted(inte['sin'], key=lambda m: (m['fecha'], m['fila'])):
        grupos.setdefault(m['contable'] or '', []).append(m)
    nombre_de = {f'CTA {q}': x['nombre'] for q, x in datos.items()}
    subt = []
    for marca in sorted(grupos, key=lambda k: (k == '', k)):
        ms = grupos[marca]
        quien = nombre_de.get(marca.upper())
        rot = (f'Hoy en la cuenta de {quien} (marca contable «{marca}»)' if quien else
               (f'Marca contable «{marca}»' if marca else 'Sin marca contable — hoy son gasto de la empresa'))
        h.blanco()
        h.seccion('4 · ' + rot)
        _enc(h, ['Fecha', 'Empresa · cuenta', 'Concepto · categoría', None, 'Marca contable → interna', 'Hoy está en',
                 'Por qué no se pudo asignar', None, None, 'Importe (débito − crédito)'], {3: 4, 7: 9})
        a0 = None
        for m in ms:
            emp = _empresa(m['cuenta'])
            hoy = f'cuenta de {marca.upper()[4:]}' if quien else (marca or f'gasto propio de {emp}')
            r = _fila(h, [m['fecha'], m['cuenta'], (_t(m['detalle']) or '(sin detalle)') + (f" · {m['categ']}" if m['categ'] else ''),
                          None, f"{m['contable'] or '(sin marca)'} → {m['interno'] or '(sin marca)'}", hoy, _t(m['porque']),
                          None, None, float(m['deb'] - m['cred'])], {3: 4, 7: 9})
            a0 = a0 or r
        subt.append(h.total(f'Subtotal — {rot}', {10: h.suma(10, a0, h.r)}, col_etiqueta=2))
        s = sum(m['deb'] - m['cred'] for m in ms)
        lib.pendiente(f"Socios interno — sin resolver: {quien or marca or 'sin marca contable'}",
                      f'{len(ms)} movimiento(s) por {_ar(s)} que la capa interna no pudo asignar: ' +
                      '; '.join(f"{m['fecha'].strftime('%d/%m/%Y')} {m['cuenta']} «{m['detalle']}» {_ar(m['deb'] - m['cred'])} "
                                f"(interno «{m['interno']}»)" for m in ms) + '.',
                      (f'el saldo interno de {quien} queda sujeto a {_ar(s)}' if quien else
                       f'{_ar(s)} que hoy son gasto de la empresa pueden ser de un socio'), DONDE)
    if not grupos:
        _fila(h, [None, '(ninguno)'], {2: 9})
        f_sin = h.total('Total sin resolver', {10: '=0'}, clave=True, col_etiqueta=2)
    else:
        f_sin = h.total(f'Total sin resolver — {n_sin} movimientos', {10: h.suma_de(10, subt)}, clave=True, col_etiqueta=2)
    h.control('total sin resolver', h.cel(10, f_sin), tot_sin, 'I · Interno por socio, SIN RESOLVER (débito − crédito)')

    # ---------- ítems ----------
    lib.item('10i', 'Cuentas con socios — lectura interna (la realidad)', h, h.cel(9, f_total), GRUPO,
             f'saldo contable según el sistema {_ar(tot_cont)} − compensación de la capa interna {_ar(tot_cont - tot_real)}; '
             f'sujeto a {n_sin} movimientos sin resolver ({_ar(tot_sin)})', None)
    for q, x in datos.items():
        lib.item(x['sub'], f"{x['nombre']} — interno", h, h.cel(9, f_res[q]), GRUPO,
                 f"contable {_ar(x['res']['cierre'])} − compensación {_ar(x['t']['total'])}", None)
