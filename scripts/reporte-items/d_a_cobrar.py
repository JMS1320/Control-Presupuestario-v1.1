# -*- coding: utf-8 -*-
"""Detalle 6 — A cobrar (ítem 6): cuentas a cobrar comprobante por comprobante y provisión de cobros.

Fuentes (sólo lectura): Proveedores → «03 Cuentas a cobrar»; Saldos → «03.1 Provision cobros»;
Balance propio → «Deudores por ventas» (control del total).
"""
import datetime
import re

from core import num

GRUPO = 'B · Patrimonio al cierre (30/06/2026)'
HOJA = 'D6 A cobrar'
ANCHOS = [11, 15, 24, 14, 14, 14, 15, 16, 27]     # 150 (horizontal)
C_TOT = 7                                         # debajo del total va el valor de la fuente (control)
ENC = ['Fecha', 'Comprobante', 'Cliente y CUIT', 'Neto gravado', 'Exento y no gravado', 'IVA y otros tributos', 'Total $',
       'Cuenta contable', 'Estado, motivo y respaldo']
TIPOS = {1: 'Factura A', 2: 'N. débito A', 3: 'N. crédito A', 6: 'Factura B', 8: 'N. crédito B', 11: 'Factura C',
         13: 'N. crédito C', 81: 'Tique fact. A', 201: 'Fact. créd. A'}


def _txt(v):
    return str(v).strip() if v is not None else ''


def _fch(v):
    if isinstance(v, datetime.datetime):
        return v
    if isinstance(v, datetime.date):
        return datetime.datetime(v.year, v.month, v.day)
    if isinstance(v, str) and len(v) >= 10 and v[4] == '-' and v[7] == '-':
        try:
            return datetime.datetime.strptime(v[:10], '%Y-%m-%d')
        except ValueError:
            return None
    return None


def _pesos(x):
    s = f'{abs(x):,.2f}'.replace(',', '#').replace('.', ',').replace('#', '.')
    return ('−' if x < 0 else '') + s


def _fila_de(ws, etiqueta, col=1, desde=1):
    e = etiqueta.lower()
    for r in range(desde, ws.max_row + 1):
        if _txt(ws.cell(r, col).value).lower().startswith(e):
            return r
    raise SystemExit(f'No encuentro «{etiqueta}» en la hoja «{ws.title}»')


def _cols(ws, r_enc):
    return {_txt(ws.cell(r_enc, c).value): c for c in range(1, ws.max_column + 1) if ws.cell(r_enc, c).value is not None}


def _comprobante(tipo, pv, nro):
    t = TIPOS.get(int(num(tipo)), f'Tipo {int(num(tipo))}') if tipo not in (None, '') else ''
    if pv in (None, '') and nro in (None, ''):
        return (t + ' s/n').strip()
    return f'{t} {int(num(pv)):04d}-{int(num(nro)):08d}'.strip()


def _renglon(ws, r, col):
    """Un comprobante de la fuente → valores de la ficha (los 4 importes y los textos)."""
    v = lambda nombre: ws.cell(r, col[nombre]).value if nombre in col else None
    exento = num(v('No Gravado')) + num(v('Exentas')) + num(v('Monotributo'))
    iva = num(v('IVA')) + num(v('Otros Tributos'))
    partes = []
    if _txt(v('Subdiario')):
        partes.append('Subdiario ' + _txt(v('Subdiario')))
    if _txt(v('Estado hoy')):
        partes.append('hoy: ' + _txt(v('Estado hoy')))
    if _fch(v('Fecha de pago')):
        partes.append('se pagó el ' + _fch(v('Fecha de pago')).strftime('%d/%m/%Y'))
    for k in ('Motivo', 'Dónde verlo', 'Centro de costo', 'Cómo entró a provisión', 'Respaldo'):
        if _txt(v(k)):
            partes.append(_txt(v(k)))
    return dict(fecha=_fch(v('Fecha')), comp=_comprobante(v('Tipo'), v('Pto Vta'), v('Número')),
                quien=f'{_txt(v("Denominación"))} · CUIT {_txt(v("CUIT"))}', cuenta=_txt(v('Cuenta contable')),
                neto=num(v('Neto Gravado')), exento=exento, iva=iva, total=num(v('Total')), nota=' · '.join(partes),
                nombre=_txt(v('Denominación')))


def _es_dato(ws, r, col):
    return isinstance(ws.cell(r, col['Total']).value, (int, float)) and _fch(ws.cell(r, col['Fecha']).value) is not None


def _tabla(h, filas, etiqueta_total, clave=False, vacio='No hay ninguno al 30/06/2026'):
    """Escribe los comprobantes y su total (suma del tramo). Devuelve (renglón del total, suma en Python)."""
    r1 = r2 = None
    for f in filas:
        r2 = h.fila([f['fecha'], f['comp'], f['quien'], float(f['neto']), float(f['exento']), float(f['iva']),
                     float(f['total']), f['cuenta'], f['nota']])
        r1 = r1 or r2
    if r1 is None:
        r1 = r2 = h.fila([None, '—', vacio, 0.0, 0.0, 0.0, 0.0])
    rt = h.total(etiqueta_total, {c: h.suma(c, r1, r2) for c in (4, 5, 6, C_TOT)}, clave=clave, col_etiqueta=1)
    return rt, sum(f['total'] for f in filas)


def construir(lib, src):
    h = lib.hoja(HOJA, ANCHOS, horizontal=True)
    f_prov, f_sal = src.nombre('Proveedores'), src.nombre('Saldos')
    w_cc = src.hoja('Proveedores', '03 Cuentas a cobrar')
    w_pc = src.hoja('Saldos', '03.1 Provision cobros')
    w_bp = src.hoja('Balance propio', 'Balance propio', sub='bp')

    h.titulo('Detalle 6 — A cobrar (ítem 6)')
    h.nota(f'Fuente: {f_prov} → «03 Cuentas a cobrar»; {f_sal} → «03.1 Provision cobros». Muestra lo que al 30/06/2026 se le '
           'debía a MSA por ventas: 6a los comprobantes emitidos y no cobrados al cierre (manda la fecha de cobro, no el estado de '
           'hoy) y 6b las ventas del ejercicio que se facturaron después del cierre. Cada sección cierra con su total; lo que la '
           'fuente lista pero NO suma va aparte, marcado «informativo».')
    h.blanco()

    # ── 6a · Cuentas a cobrar ───────────────────────────────────────────────────────────────
    r_enc = _fila_de(w_cc, 'Subdiario')
    col = _cols(w_cc, r_enc)
    r_tot = _fila_de(w_cc, 'TOTAL', col=col['Denominación'], desde=r_enc)
    principales = [_renglon(w_cc, r, col) for r in range(r_enc + 1, r_tot) if _es_dato(w_cc, r, col)]
    total_fuente = num(w_cc.cell(r_tot, col['Total']).value)

    h.seccion('6a · Cuentas a cobrar — comprobantes de venta sin cobrar al 30/06/2026')
    h.encabezado(ENC, repetir=True)
    rt_a, s_a = _tabla(h, principales, 'Total 6a — Cuentas a cobrar', clave=True,
                       vacio='Ningún comprobante de venta quedó sin cobrar al 30/06/2026')
    h.control('6a Cuentas a cobrar', h.cel(C_TOT, rt_a), total_fuente, '«03 Cuentas a cobrar» → TOTAL')
    miro = [_txt(w_cc.cell(r, 1).value) for r in range(r_tot, w_cc.max_row + 1) if _txt(w_cc.cell(r, 1).value).startswith('Se miraron')]
    if miro:
        h.nota(miro[0] + ' Los de abajo están en la fuente pero NO suman a 6a: cada bloque dice por qué.')
    h.blanco()
    if abs(s_a - total_fuente) > 0.01:
        lib.pendiente('Cuentas a cobrar: la lista no da el total de la fuente', f'Listado {_pesos(s_a)}; fuente {_pesos(total_fuente)}.',
                      _pesos(s_a - total_fuente), HOJA)

    # bloques que la fuente lista aparte (no suman)
    bloques, actual = [], None
    for r in range(r_tot + 1, w_cc.max_row + 1):
        a = _txt(w_cc.cell(r, 1).value)
        if _es_dato(w_cc, r, col):
            if actual is not None:
                actual['filas'].append(_renglon(w_cc, r, col))
        elif a and not a.startswith('Se miraron'):
            if actual is None or actual['filas']:
                actual = dict(titulos=[], filas=[])
                bloques.append(actual)
            actual['titulos'].append(a)
    for n, b in enumerate(bloques, 1):
        titulo = b['titulos'][0]
        declarado = None
        for t in b['titulos']:
            m = re.search(r'total\s+(-?[\d.]+)', t)
            if m:
                declarado = float(m.group(1))
        h.seccion(f'6a · Informativo, NO suma — {titulo}')
        h.encabezado(ENC)
        rt, s = _tabla(h, b['filas'], 'Subtotal (no suma al ítem)')
        if declarado is not None:
            h.control(f'6a informativo {n}: {titulo[:40]}', h.cel(C_TOT, rt), declarado, '«03 Cuentas a cobrar» → total del bloque')
        if len(b['titulos']) > 1:
            h.nota(' '.join(b['titulos'][1:]))
        h.blanco()
        if titulo.upper().startswith('CONCILIADOS PERO SIN'):
            for f in b['filas']:
                lib.pendiente('Venta cobrada sin fecha de cobro',
                              f'{f["comp"]} del {f["fecha"].strftime("%d/%m/%Y")} a {f["quien"]} ({f["cuenta"]}) por {_pesos(f["total"])}: '
                              'figura cobrada pero sin fecha ni movimiento del banco. No se sabe si al cierre estaba cobrada; '
                              'hoy NO suma a cuentas a cobrar.', _pesos(f['total']), HOJA)

    # ── 6b · Provisión de cobros ────────────────────────────────────────────────────────────
    r_enc = _fila_de(w_pc, 'Subdiario')
    colp = _cols(w_pc, r_enc)
    r_tot = _fila_de(w_pc, 'TOTAL', col=colp['Denominación'], desde=r_enc)
    prov = [_renglon(w_pc, r, colp) for r in range(r_enc + 1, r_tot) if _es_dato(w_pc, r, colp)]
    tot_prov_f = num(w_pc.cell(r_tot, colp['Total']).value)
    h.seccion('6b · Provisión de cobros — ventas del ejercicio facturadas después del cierre')
    h.encabezado(ENC)
    rt_b, s_b = _tabla(h, prov, 'Total 6b — Provisión de cobros', clave=True)
    h.control('6b Provisión de cobros', h.cel(C_TOT, rt_b), tot_prov_f, '«03.1 Provision cobros» → TOTAL')
    otras = [_txt(w_pc.cell(r, 1).value) for r in range(r_tot + 1, w_pc.max_row + 1) if _txt(w_pc.cell(r, 1).value)]
    motivo = [t for t in otras if t.startswith('*')]
    if motivo:
        h.nota(' '.join(motivo))
    cheques = [t for t in otras if not t.startswith('*') and 'ANTICIPOS DE CLIENTES' not in t.upper()
               and not t.startswith('Salen de la misma')]
    if cheques:
        h.nota(' '.join(cheques))
        lib.pendiente('Cheques de terceros en cartera', ' '.join(cheques), 'sin dato', HOJA)
    h.blanco()
    if abs(s_b - tot_prov_f) > 0.01:
        lib.pendiente('Provisión de cobros: la lista no da el total de la fuente', f'Listado {_pesos(s_b)}; fuente {_pesos(tot_prov_f)}.',
                      _pesos(s_b - tot_prov_f), HOJA)
    for f in prov:
        if '🟡' in f['nota'] or '🔴' in f['nota']:
            lib.pendiente('Provisión de cobros: respaldo', f'{f["comp"]} a {f["nombre"]} por {_pesos(f["total"])}: '
                          + f['nota'].split('🟡')[-1].split('🔴')[-1].strip(), '', HOJA)

    # ── Total ítem 6 ────────────────────────────────────────────────────────────────────────
    h.seccion('Resumen del ítem 6 — cada renglón trae el total de su sección de arriba')
    h.encabezado(['', '', 'Concepto', '', '', '', 'Total $', '', ''])
    r1 = h.fila([None, None, '6a · Cuentas a cobrar', None, None, None, f'={h.cel(C_TOT, rt_a)}'])
    r2 = h.fila([None, None, '6b · Provisión de cobros', None, None, None, f'={h.cel(C_TOT, rt_b)}'])
    rt6 = h.total('Total ítem 6 — A cobrar', {C_TOT: h.suma(C_TOT, r1, r2)}, clave=True)
    r_bp = _fila_de(w_bp, 'Deudores por ventas')
    bp = num(w_bp.cell(r_bp, 3).value)
    h.control('Total ítem 6 contra el Balance propio', h.cel(C_TOT, rt6), bp, 'Balance propio → «Deudores por ventas», $ 2026')
    h.nota('El balance del contador al 30/06/2025 no traía un renglón de deudores por ventas: no hay importe del año anterior para comparar.')

    lib.item('6', 'A cobrar', h, h.cel(C_TOT, rt6), GRUPO, '6a cuentas a cobrar + 6b provisión de cobros', None)
    lib.item('6a', 'Cuentas a cobrar', h, h.cel(C_TOT, rt_a), GRUPO,
             'Comprobantes de venta sin cobrar al cierre, uno por uno', None)
    lib.item('6b', 'Provisión de cobros', h, h.cel(C_TOT, rt_b), GRUPO,
             'Ventas del ejercicio facturadas después del cierre', None)
