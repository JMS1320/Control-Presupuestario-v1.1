# -*- coding: utf-8 -*-
"""Detalle 9 — A pagar (ítem 9): cuentas a pagar, cheques, anticipos, provisión, tarjeta y cargas sociales.

Fuentes (sólo lectura): Proveedores → «04 Cuentas a pagar», «04.1 Cheques dados», «04.2 Anticipos»,
«04.3 Respaldo cuentas a pagar» (sólo el resumen de sus bloques) y «14 Cuentas corrientes»;
Saldos → «05 Provision»; Balance en línea → «F · Balance en linea» y «F · Deudas y creditos»;
Templates → «H · MSA · Imp Gral» y «H · MSA · Tarjetas» (pagos del ejercicio, como contexto).
"""
import datetime
import re

from openpyxl.styles import Alignment

from core import num

GRUPO = 'B · Patrimonio al cierre (30/06/2026)'
HOJA = 'D9 A pagar'
ANCHOS = [11, 15, 24, 14, 14, 14, 15, 16, 27]     # 150 (horizontal)
C_TOT = 7                                         # debajo del total va el valor de la fuente (control)
ENC = ['Fecha', 'Comprobante', 'Proveedor y CUIT', 'Neto gravado', 'Exento y no gravado', 'IVA y otros tributos', 'Total $',
       'Cuenta contable', 'Estado, fecha de pago, motivo y respaldo']
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


def _control(h, descripcion, celda, valor, fuente):
    """h.control + el texto combinado a lo ancho con ajuste: no se desborda sobre los importes."""
    r = h.control(descripcion, celda, valor, fuente)
    fin = h.ncols - 3
    h.ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=fin + 1)
    x = h.celda(1, r)
    x.alignment = Alignment(wrap_text=True, vertical='top')
    ancho = sum(ANCHOS[:fin])
    h.ws.row_dimensions[r].height = 12.5 * max(1, -(-len(_txt(x.value)) // int(ancho * 1.15)))
    return r


def _fila_de(ws, etiqueta, col=1, desde=1, falta_ok=False):
    e = etiqueta.lower()
    for r in range(desde, ws.max_row + 1):
        if _txt(ws.cell(r, col).value).lower().startswith(e):
            return r
    if falta_ok:
        return None
    raise SystemExit(f'No encuentro «{etiqueta}» en la hoja «{ws.title}»')


def _cols(ws, r_enc):
    return {_txt(ws.cell(r_enc, c).value): c for c in range(1, ws.max_column + 1) if ws.cell(r_enc, c).value is not None}


def _comprobante(tipo, pv, nro):
    t = TIPOS.get(int(num(tipo)), f'Tipo {int(num(tipo))}') if tipo not in (None, '') else ''
    if pv in (None, '') and nro in (None, ''):
        return (t + ' s/n').strip()
    return f'{t} {int(num(pv)):04d}-{int(num(nro)):08d}'.strip()


def _renglon(ws, r, col):
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
    r1 = r2 = None
    for f in filas:
        r2 = h.fila([f.get('fecha'), f.get('comp'), f.get('quien'),
                     None if f.get('neto') is None else float(f['neto']),
                     None if f.get('exento') is None else float(f['exento']),
                     None if f.get('iva') is None else float(f['iva']),
                     float(f['total']), f.get('cuenta') or None, f.get('nota') or None])
        r1 = r1 or r2
    if r1 is None:
        r1 = r2 = h.fila([None, '—', vacio, None, None, None, 0.0])
    cols = (4, 5, 6, C_TOT) if any(f.get('neto') is not None for f in filas) else (C_TOT,)
    rt = h.total(etiqueta_total, {c: h.suma(c, r1, r2) for c in cols}, clave=clave)
    return rt, sum(f['total'] for f in filas)


def construir(lib, src):
    h = lib.hoja(HOJA, ANCHOS, horizontal=True)
    f_prov, f_sal, f_bl, f_tpl = (src.nombre(x) for x in ('Proveedores', 'Saldos', 'Balance en l', 'Templates'))
    w_cp = src.hoja('Proveedores', '04 Cuentas a pagar')
    w_ch = src.hoja('Proveedores', '04.1 Cheques dados')
    w_an = src.hoja('Proveedores', '04.2 Anticipos')
    w_re = src.hoja('Proveedores', '04.3 Respaldo')
    w_cc = src.hoja('Proveedores', '14 Cuentas corrientes')
    w_pr = src.hoja('Saldos', '05 Provision')
    w_bl = src.hoja('Balance en l', 'Balance en linea')
    w_dc = src.hoja('Balance en l', 'Deudas y creditos')
    w_ig = src.hoja('Templates', 'H · MSA · Imp Gral')
    w_eg = src.hoja('Templates', 'H · MSA · Egresos')
    w_tj = src.hoja('Templates', 'H · MSA · Tarjetas')
    w_bp = src.hoja('Balance propio', 'Balance propio', sub='bp')

    def bl(denominacion):
        """(apertura del contador, cierre de la app), los dos en positivo."""
        r = _fila_de(w_bl, denominacion, col=3)
        return abs(num(w_bl.cell(r, 4).value)), abs(num(w_bl.cell(r, 5).value))

    def dc(renglon):
        r = _fila_de(w_dc, renglon)
        return num(w_dc.cell(r, 2).value), _txt(w_dc.cell(r, 3).value), _txt(w_dc.cell(r, 4).value)

    ap_prov, ci_prov = bl('Proveedores en Cta.Cte.')
    ap_chq, ci_chq = bl('Cheques pend. de debito')
    ap_ant, ci_ant = bl('Anticipos a Proveedores')
    ap_pg, ci_pg = bl('Provision para gastos')
    ap_visa, ci_visa = bl('TARJETA VISA')
    ap_suss, ci_suss = bl('SUSS a pagar')

    h.titulo('Detalle 9 — A pagar (ítem 9)')
    h.nota(f'Fuente: {f_prov} → «04 Cuentas a pagar», «04.1 Cheques dados», «04.2 Anticipos», «04.3 Respaldo cuentas a pagar» y '
           f'«14 Cuentas corrientes»; {f_sal} → «05 Provision»; {f_bl} → «F · Deudas y creditos»; {f_tpl} → «H · MSA · Imp Gral». '
           'Muestra lo que MSA debía al 30/06/2026, comprobante por comprobante: 9a proveedores, 9b cheques dados sin debitar, '
           '9c anticipos a proveedores (es un activo: se muestra acá pero no suma a la deuda), 9d provisión para gastos, 9e tarjeta '
           'Visa y 9f cargas sociales. Manda la fecha de pago, no el estado de hoy. Lo que la fuente lista pero NO suma va marcado '
           '«informativo». Las cuentas con los socios no están acá: van en su propio ítem.')
    h.blanco()
    tot = {}

    # ── 9a.1 · Facturas impagas al cierre ───────────────────────────────────────────────────
    r_enc = _fila_de(w_cp, 'Subdiario')
    col = _cols(w_cp, r_enc)
    r_tot = _fila_de(w_cp, 'TOTAL', col=col['Denominación'], desde=r_enc)
    facturas = [_renglon(w_cp, r, col) for r in range(r_enc + 1, r_tot) if _es_dato(w_cp, r, col)]
    tot_fac_f = num(w_cp.cell(r_tot, col['Total']).value)
    h.seccion(f'9a.1 · Cuentas a pagar — {len(facturas)} facturas de proveedores sin pagar al 30/06/2026')
    h.encabezado(ENC)
    rt_fac, s_fac = _tabla(h, facturas, 'Total 9a.1 — Facturas sin pagar al cierre')
    _control(h, '9a.1 Facturas sin pagar al cierre', h.cel(C_TOT, rt_fac), tot_fac_f, '«04 Cuentas a pagar» → TOTAL')
    pie = [_txt(w_cp.cell(r, 1).value) for r in range(r_tot + 1, w_cp.max_row + 1) if _txt(w_cp.cell(r, 1).value)]
    if pie:
        h.nota(' '.join(pie))
    h.blanco()
    if abs(s_fac - tot_fac_f) > 0.01:
        lib.pendiente('Cuentas a pagar: la lista no da el total de la fuente', f'Listado {_pesos(s_fac)}; fuente {_pesos(tot_fac_f)}.',
                      _pesos(s_fac - tot_fac_f), HOJA)

    # ── 9a.2 · Cuentas corrientes con proveedores que también son clientes ──────────────────
    r_enc = _fila_de(w_cc, 'Contraparte')
    r_tcc = _fila_de(w_cc, 'TOTAL', desde=r_enc)
    cuentas = []
    for r in range(r_enc + 1, r_tcc):
        if not _txt(w_cc.cell(r, 1).value):
            continue
        v = lambda c: w_cc.cell(r, c).value
        cuentas.append(dict(nombre=_txt(v(1)), cuit=_txt(v(2)), inicio=num(v(3)), facturado=num(v(4)), vendido=num(v(5)),
                            pagado=num(v(6)), cierre=num(v(8)), lectura=_txt(v(9))))
    tot_cc_f = num(w_cc.cell(r_tcc, 8).value)
    enc_cc = ['Fecha', 'Qué es', 'Concepto / comprobante', '', '', '', 'Importe $', '', 'Nota']
    rts_cc, s_cc = [], 0.0
    for k, c in enumerate(cuentas, 1):
        r_det = _fila_de(w_cc, 'DETALLE — ' + c['nombre'], falta_ok=True)
        movs, pie_det = [], ''
        if r_det:
            for r in range(r_det + 2, w_cc.max_row + 1):
                f = _fch(w_cc.cell(r, 1).value)
                if f is None:
                    pie_det = _txt(w_cc.cell(r, 1).value)
                    break
                movs.append((f, _txt(w_cc.cell(r, 2).value), _txt(w_cc.cell(r, 3).value), num(w_cc.cell(r, 4).value)))
        h.seccion(f'9a.2.{k} · Cuenta corriente — {c["nombre"]} (CUIT {c["cuit"]}) — positivo = le debemos, negativo = nos debe')
        h.encabezado(enc_cc)
        r1 = h.fila([None, 'saldo', 'Saldo al inicio (30/06/2025)', None, None, None, float(c['inicio']), None,
                     'sin dato de inicio (0 por default)' if 'sin dato de inicio' in c['lectura'] else None])
        r2 = r1
        for f, que, concepto, imp in movs:
            sin_ref = '← sin referencia' in concepto
            r2 = h.fila([f, que, concepto.replace('← sin referencia', '').strip(), None, None, None, float(imp), None,
                         'el pago no dice contra qué comprobante fue' if sin_ref else None])
        calc = c['inicio'] + sum(m[3] for m in movs)
        ajuste = round(c['cierre'] - calc, 2)
        if abs(ajuste) > 0.005:
            m = re.search(r'AJUSTE AL CIERRE.*', c['lectura'])
            r2 = h.fila([datetime.datetime(2026, 6, 30), 'ajuste', 'Ajuste al cierre que hace la app', None, None, None,
                         float(ajuste), None, m.group(0) if m else 'la fuente no explica este ajuste'])
            if not m:
                lib.pendiente(f'Cuenta corriente {c["nombre"]}: ajuste sin explicar',
                              f'Los movimientos dan {_pesos(calc)} y la fuente cierra en {_pesos(c["cierre"])}.', _pesos(ajuste), HOJA)
        rt = h.total(f'Saldo al cierre — {c["nombre"]}', {C_TOT: h.suma(C_TOT, r1, r2)})
        _control(h, f'9a.2.{k} Cuenta corriente {c["nombre"]}', h.cel(C_TOT, rt), c['cierre'], '«14 Cuentas corrientes» → SALDO AL CIERRE')
        h.nota(f'En el ejercicio: nos facturó {_pesos(c["facturado"])} · le vendimos {_pesos(c["vendido"])} · pagado/cobrado '
               f'{_pesos(c["pagado"])}. {c["lectura"]}. {pie_det}')
        h.blanco()
        rts_cc.append(rt)
        s_cc += c['cierre']
        if not r_det:
            lib.pendiente(f'Cuenta corriente {c["nombre"]}: sin detalle', 'La fuente no trae sus movimientos.', '', HOJA)
        if 'sin referencia' in pie_det or 'no dicen contra' in pie_det:
            lib.pendiente(f'Cuenta corriente {c["nombre"]}: pagos sin referencia', pie_det, '', HOJA)

    h.seccion('9a · Total cuentas a pagar — cada renglón trae el total de su sección de arriba')
    h.encabezado(['', '', 'Concepto', '', '', '', 'Total $', '', ''])
    r1 = h.fila([None, None, '9a.1 · Facturas sin pagar al cierre', None, None, None, f'={h.cel(C_TOT, rt_fac)}'])
    r2 = r1
    for c, rt in zip(cuentas, rts_cc):
        r2 = h.fila([None, None, f'9a.2 · Cuenta corriente — {c["nombre"]}', None, None, None, f'={h.cel(C_TOT, rt)}'])
    rt_a = h.total('Total 9a — Cuentas a pagar (proveedores)', {C_TOT: h.suma(C_TOT, r1, r2)}, clave=True)
    tot['9a'] = rt_a
    _control(h, '9a Cuentas a pagar', h.cel(C_TOT, rt_a), ci_prov, 'Balance en línea → «Proveedores en Cta.Cte.», Cierre (la app)')
    otros = [_txt(w_cc.cell(r, 1).value) for r in range(r_tcc + 1, r_tcc + 4) if _txt(w_cc.cell(r, 1).value)]
    if otros:
        h.nota(' '.join(otros))
        lib.pendiente('Cuentas corrientes: comprobantes del sistema anterior sin atribuir', ' '.join(otros), 'sin dato', HOJA)
    h.blanco()
    if abs(s_cc - tot_cc_f) > 0.01 or abs(s_fac + s_cc - ci_prov) > 0.01:
        lib.pendiente('Cuentas a pagar: no da contra el Balance en línea',
                      f'Facturas {_pesos(s_fac)} + cuentas corrientes {_pesos(s_cc)} contra {_pesos(ci_prov)}.',
                      _pesos(s_fac + s_cc - ci_prov), HOJA)

    # informativo: aseguradora (saldo de documentación)
    r_as = _fila_de(w_cc, 'ASEGURADORA', falta_ok=True)
    if r_as:
        r_sal = _fila_de(w_cc, 'SALDO AL CIERRE', desde=r_as)
        saldo_as = num(w_cc.cell(r_sal, 3).value)
        r_rec = _fila_de(w_cc, 'A reclamar', desde=r_as)
        r_fin = _fila_de(w_cc, 'DETALLE', desde=r_rec)
        filas = []
        for r in range(r_rec + 1, r_fin):
            a = _txt(w_cc.cell(r, 1).value)
            if not a or a.lower().startswith('subtotal') or not isinstance(w_cc.cell(r, 3).value, (int, float)):
                continue
            pol = _txt(w_cc.cell(r, 2).value)
            filas.append(dict(comp=('Póliza ' + pol) if pol else 'sin póliza', quien=a, total=num(w_cc.cell(r, 3).value),
                              nota=_txt(w_cc.cell(r, 4).value)))
        h.seccion('9a · Informativo, NO suma — ' + _txt(w_cc.cell(r_as, 1).value))
        h.encabezado(['', 'Póliza', 'Qué hay que reclamar', '', '', '', 'Importe $', '', 'Qué es'])
        rt, s = _tabla(h, filas, 'Saldo de documentación con la aseguradora (no suma al ítem)')
        _control(h, '9a informativo: saldo con la aseguradora', h.cel(C_TOT, rt), saldo_as, '«14 Cuentas corrientes» → aseguradora, SALDO AL CIERRE')
        h.nota(' '.join(_txt(w_cc.cell(r, 1).value) for r in range(r_as + 1, r_sal)) + ' ' + _txt(w_cc.cell(r_sal, 4).value) +
               ' El movimiento por movimiento (cuotas, notas de crédito y débitos del banco) está en la solapa «14 Cuentas corrientes».')
        h.blanco()
        lib.pendiente('Aseguradora: faltan comprobantes', f'Saldo de documentación al cierre {_pesos(saldo_as)} '
                      '(notas de crédito a pedir y un saldo a favor sin devolver). No suma a cuentas a pagar.', _pesos(saldo_as), HOJA)

    # informativo: lo que se miró y no suma (resumen de «04.3 Respaldo»)
    r_enc3 = _fila_de(w_re, 'Subdiario')
    col3 = _cols(w_re, r_enc3)
    bloques, actual = [], None
    for r in range(r_enc3 + 1, w_re.max_row + 1):
        a = _txt(w_re.cell(r, 1).value)
        es_dato = isinstance(w_re.cell(r, col3['Total']).value, (int, float))
        if es_dato:
            if actual is not None:
                actual['n'] += 1
                actual['suma'] += num(w_re.cell(r, col3['Total']).value)
        elif a and not a.startswith('Se miraron') and not a.startswith('Subdiario'):
            if actual is None or actual['n']:
                actual = dict(titulos=[], n=0, suma=0.0)
                bloques.append(actual)
            actual['titulos'].append(a)
    h.seccion('9a · Informativo, NO suma — lo que la app miró y dejó afuera de la deuda (resumen de «04.3 Respaldo cuentas a pagar»)')
    h.encabezado(['', 'Renglones', 'Bloque de la fuente', '', '', '', 'Total del bloque $', '', 'Por qué no suma'])
    for b in bloques:
        titulo = b['titulos'][0]
        nombre, _, motivo = titulo.partition(' — ')
        declarado = None
        for t in b['titulos'][1:]:
            m = re.search(r'—\s*(?:total\s+)?(-?\d[\d.]*)', t)
            if m:
                declarado = float(m.group(1).rstrip('.'))
        b['suma'] = round(b['suma'], 2)
        h.fila([None, b['n'], nombre, None, None, None, float(b['suma']), None, (motivo + ' ' + ' '.join(b['titulos'][1:])).strip()])
        if declarado is not None and abs(declarado - b['suma']) > 0.01:
            lib.pendiente('Respaldo de cuentas a pagar: un bloque no suma lo que dice',
                          f'«{nombre}»: la fuente dice {_pesos(declarado)} y sus renglones suman {_pesos(b["suma"])}.',
                          _pesos(b['suma'] - declarado), HOJA)
        up = nombre.upper()
        if 'A CONFIRMAR' in titulo.upper() or up.startswith('CONCILIADOS PERO SIN') or up.startswith('DADAS POR PAGADAS'):
            lib.pendiente('Cuentas a pagar: bloque dejado afuera de la deuda, a confirmar',
                          f'«{nombre}»: {b["n"]} renglón(es) por {_pesos(b["suma"])}. {motivo}', _pesos(b['suma']), HOJA)
    h.nota('Son bloques de distinta naturaleza: no se totalizan entre sí. El total de cada bloque es la suma de sus renglones en la '
           'fuente (verificado contra el total que la fuente declara). El renglón por renglón (385 filas) queda en la solapa '
           '«04.3 Respaldo cuentas a pagar» del libro Proveedores: es respaldo de lo que NO es deuda, no composición del ítem.')
    h.blanco()

    # ── 9b · Cheques dados sin debitar ──────────────────────────────────────────────────────
    r_enc = _fila_de(w_ch, 'Fecha emisi')
    cch = _cols(w_ch, r_enc)
    r_tot = _fila_de(w_ch, 'TOTAL', col=cch['Concepto'], desde=r_enc)
    cheques = []
    for r in range(r_enc + 1, r_tot):
        v = lambda n: w_ch.cell(r, cch[n]).value
        if not isinstance(v('Importe'), (int, float)):
            continue
        fd = _fch(v('Fecha de débito'))
        cheques.append(dict(fecha=_fch(v('Fecha emisión')), comp='Cheque ' + _txt(v('N° Cheque')),
                            quien=f'{_txt(v("Beneficiario"))} · CUIT {_txt(v("CUIT"))}', total=num(v('Importe')),
                            cuenta=_txt(v('Banco')), nota=' · '.join(x for x in [
                                _txt(v('Concepto')), 'hoy: ' + _txt(v('Estado hoy')),
                                ('debitó el ' + fd.strftime('%d/%m/%Y')) if fd else '', _txt(v('Motivo'))] if x)))
    tot_ch_f = num(w_ch.cell(r_tot, cch['Importe']).value)
    h.seccion('9b · Cheques dados y no debitados al 30/06/2026')
    h.encabezado(['Fecha emisión', 'N° de cheque', 'Beneficiario y CUIT', '', '', '', 'Importe $', 'Banco',
                  'Concepto, estado y fecha de débito'])
    rt_b, s_b = _tabla(h, cheques, 'Total 9b — Cheques dados sin debitar', clave=True,
                       vacio='Ningún cheque emitido antes del cierre quedó sin debitar al 30/06/2026')
    tot['9b'] = rt_b
    _control(h, '9b Cheques dados sin debitar', h.cel(C_TOT, rt_b), tot_ch_f, '«04.1 Cheques dados» → TOTAL')
    notas = [_txt(w_ch.cell(r, 1).value) for r in range(r_tot + 1, w_ch.max_row + 1) if _txt(w_ch.cell(r, 1).value)]
    if notas:
        h.nota(' '.join(notas))
    for n in notas:
        if n.startswith('⚠️'):
            lib.pendiente('Cheques dados: aviso de la fuente', n.replace('⚠️ ', ''), '', HOJA)
    h.blanco()
    if abs(s_b - tot_ch_f) > 0.01 or abs(s_b - ci_chq) > 0.01:
        lib.pendiente('Cheques dados: no da', f'Listado {_pesos(s_b)}; fuente {_pesos(tot_ch_f)}; Balance en línea {_pesos(ci_chq)}.',
                      _pesos(s_b - tot_ch_f), HOJA)

    # ── 9c · Anticipos a proveedores (activo) ───────────────────────────────────────────────
    def anticipos(titulo):
        r_t = _fila_de(w_an, titulo)
        r_e = _fila_de(w_an, 'Fecha', desde=r_t)
        ca = _cols(w_an, r_e)
        r_f = _fila_de(w_an, 'TOTAL', col=ca['Descuento'], desde=r_e)
        filas = []
        for r in range(r_e + 1, r_f):
            v = lambda n: w_an.cell(r, ca[n]).value
            if not isinstance(v('SALDO AL CIERRE'), (int, float)):
                continue
            filas.append(dict(fecha=_fch(v('Fecha')), comp=_txt(v('Tipo')), quien=f'{_txt(v("Razón Social"))} · CUIT {_txt(v("CUIT"))}',
                              total=num(v('SALDO AL CIERRE')), cuenta=_txt(v('Empresa')),
                              nota=f'monto original {_pesos(num(v("Monto original")))} − aplicado al cierre {_pesos(num(v("Aplicado al cierre")))} '
                                   f'− SICORE {_pesos(num(v("SICORE")))} − descuento {_pesos(num(v("Descuento")))} · hoy: {_txt(v("Estado hoy"))}'))
        return filas, num(w_an.cell(r_f, ca['SALDO AL CIERRE']).value), _txt(w_an.cell(r_t, 1).value)

    ant_p, tot_ap_f, tit_p = anticipos('ANTICIPO A PROVEEDORES')
    ant_c, tot_ac_f, tit_c = anticipos('ANTICIPOS DE CLIENTES')
    enc_an = ['Fecha', 'Tipo', 'Razón social y CUIT', '', '', '', 'Saldo al cierre $', 'Empresa', 'Cómo se llega al saldo']
    h.seccion('9c · Anticipos a proveedores con saldo al 30/06/2026 — es un ACTIVO: no suma al Total ítem 9')
    h.encabezado(enc_an)
    rt_c, s_c = _tabla(h, ant_p, 'Total 9c — Anticipos a proveedores', clave=True,
                       vacio='Ningún anticipo a proveedores con saldo al 30/06/2026')
    tot['9c'] = rt_c
    _control(h, '9c Anticipos a proveedores', h.cel(C_TOT, rt_c), tot_ap_f, '«04.2 Anticipos» → TOTAL anticipo a proveedores')
    notas = []
    for r in range(1, w_an.max_row + 1):
        a = _txt(w_an.cell(r, 1).value)
        if (a.startswith('ANTICIPOS AL CIERRE') or a.startswith('⚠️') or a.endswith('de otra empresa.')) and not a.endswith(':'):
            notas.append(a)
    if notas:
        h.nota(' '.join(notas))
    for n in notas:
        if n.startswith('⚠️'):
            lib.pendiente('Anticipos: aviso de la fuente', n.replace('⚠️ ', ''), '', HOJA)
    h.blanco()
    h.seccion('9c · Informativo, NO suma — anticipos de clientes (cobros a cuenta: sería un pasivo)')
    h.encabezado(enc_an)
    rt_ac, s_ac = _tabla(h, ant_c, 'Anticipos de clientes al cierre (no suma al ítem)',
                         vacio='Ningún anticipo de clientes con saldo al 30/06/2026')
    _control(h, '9c informativo: anticipos de clientes', h.cel(C_TOT, rt_ac), tot_ac_f, '«04.2 Anticipos» → TOTAL anticipos de clientes')
    h.blanco()
    if abs(s_c - tot_ap_f) > 0.01 or abs(s_c - ci_ant) > 0.01:
        lib.pendiente('Anticipos a proveedores: no da', f'Listado {_pesos(s_c)}; fuente {_pesos(tot_ap_f)}; Balance en línea {_pesos(ci_ant)}.',
                      _pesos(s_c - tot_ap_f), HOJA)
    if s_ac:
        lib.pendiente('Anticipos de clientes con saldo', f'{_pesos(s_ac)} de cobros a cuenta al cierre que no están en ningún ítem.',
                      _pesos(s_ac), HOJA)

    # ── 9d · Provisión para gastos ──────────────────────────────────────────────────────────
    r_enc = _fila_de(w_pr, 'Subdiario')
    cpr = _cols(w_pr, r_enc)
    r_tot = _fila_de(w_pr, 'TOTAL', col=cpr['Denominación'], desde=r_enc)
    prov = [_renglon(w_pr, r, cpr) for r in range(r_enc + 1, r_tot) if _es_dato(w_pr, r, cpr)]
    tot_pr_f = num(w_pr.cell(r_tot, cpr['Total']).value)
    h.seccion(f'9d · Provisión para gastos — {len(prov)} facturas de gastos del ejercicio que entraron en un subdiario posterior al cierre')
    h.encabezado(ENC)
    rt_d, s_d = _tabla(h, prov, 'Total 9d — Provisión para gastos', clave=True)
    tot['9d'] = rt_d
    _control(h, '9d Provisión para gastos (contra el papel)', h.cel(C_TOT, rt_d), tot_pr_f, '«05 Provision» → TOTAL')
    _control(h, '9d Provisión para gastos (contra el Balance en línea)', h.cel(C_TOT, rt_d), ci_pg,
              'Balance en línea → «Provision para gastos», Cierre (la app)')
    h.blanco()
    if abs(s_d - tot_pr_f) > 0.01 or abs(s_d - ci_pg) > 0.01:
        lib.pendiente('Provisión para gastos: no da', f'Listado {_pesos(s_d)}; papel {_pesos(tot_pr_f)}; Balance en línea {_pesos(ci_pg)}.',
                      _pesos(s_d - tot_pr_f), HOJA)
    # la del ejercicio anterior (informativa)
    r_ant = _fila_de(w_pr, 'PROVISIÓN DEL EJERCICIO ANTERIOR', falta_ok=True)
    if r_ant:
        r_e2 = _fila_de(w_pr, 'Subdiario', desde=r_ant)
        c2 = _cols(w_pr, r_e2)
        r_t2 = _fila_de(w_pr, 'TOTAL', col=c2['Denominación'], desde=r_e2)
        prev = [_renglon(w_pr, r, c2) for r in range(r_e2 + 1, r_t2) if _es_dato(w_pr, r, c2)]
        h.seccion('9d · Informativo, NO suma — ' + _txt(w_pr.cell(r_ant, 1).value))
        h.encabezado(ENC)
        rt, s = _tabla(h, prev, 'Provisión al cierre de 24/25 (no suma al ítem)')
        _control(h, '9d informativo: provisión 24/25 contra el balance del contador', h.cel(C_TOT, rt), ap_pg,
                  'Balance en línea → «Provision para gastos», Apertura (contador)')
        h.nota('Son las dos facturas que formaban la provisión del balance anterior: se facturaron en 25/26 y por eso están en las '
               'compras de este ejercicio. La fuente las muestra para que se vea que la apertura del contador está reconocida.')
        h.blanco()

    # ── 9e · Tarjeta Visa ───────────────────────────────────────────────────────────────────
    imp_v, de_donde_v, det_v = dc('TARJETA VISA')
    ultimo = primero = None
    r_dt = _fila_de(w_tj, 'DETALLE', falta_ok=True)
    if r_dt:
        for r in range(r_dt + 2, w_tj.max_row + 1):
            if _fch(w_tj.cell(r, 3).value) is None:
                break
            ultimo = (_fch(w_tj.cell(r, 3).value), num(w_tj.cell(r, 10).value))
            primero = primero or ultimo
    h.seccion('9e · Tarjeta Visa Business Galicia — deuda al 30/06/2026')
    h.encabezado(['Fecha', 'Qué es', 'Tarjeta', '', '', '', 'Importe $', 'Cuenta contable', 'De dónde sale'])
    rt_e, s_e = _tabla(h, [dict(fecha=datetime.datetime(2026, 6, 30), comp='Consumos sin resumir', quien='Visa Business MSA — Banco Galicia',
                                total=imp_v, cuenta='Tarjetas', nota=f'{det_v} · {de_donde_v}')],
                       'Total 9e — Tarjeta Visa a pagar', clave=True)
    tot['9e'] = rt_e
    _control(h, '9e Tarjeta Visa a pagar', h.cel(C_TOT, rt_e), ci_visa, 'Balance en línea → «TARJETA VISA BUSSINES GALICIA», Cierre (la app)')
    h.nota('La app toma como deuda los consumos de la tarjeta posteriores al último resumen pagado' +
           (f' (el último pago del ejercicio fue el {ultimo[0].strftime("%d/%m/%Y")} por $ {_pesos(ultimo[1])})' if ultimo else '') +
           '. Los libros exportados traen sólo el total: la lista de esos consumos, uno por uno, no está en ninguna solapa. '
           f'En el balance del contador 24/25 este renglón era $ {_pesos(ap_visa)}' +
           (f', que es exactamente el resumen pagado el {primero[0].strftime("%d/%m/%Y")}.'
            if primero and abs(primero[1] - ap_visa) <= 0.01 else '.'))
    h.blanco()
    lib.pendiente('Tarjeta Visa: falta el detalle de los consumos',
                  f'El cierre ({_pesos(imp_v)}) son «{det_v}», pero ningún libro exportado los lista: no se puede bajar al consumo ni '
                  'separar lo que es de MSA de lo marcado para otra persona.', _pesos(imp_v), HOJA)
    if abs(imp_v - ci_visa) > 0.01:
        lib.pendiente('Tarjeta Visa: dos números', f'«F · Deudas y creditos» {_pesos(imp_v)}; Balance en línea {_pesos(ci_visa)}.',
                      _pesos(imp_v - ci_visa), HOJA)

    # ── 9f · Cargas sociales ────────────────────────────────────────────────────────────────
    imp_s, de_donde_s, det_s = dc('SUSS a pagar')
    m = re.search(r'vence\s+(\d{2})/(\d{2})/(\d{4})', det_s)
    f_vto = datetime.datetime(int(m.group(3)), int(m.group(2)), int(m.group(1))) if m else None
    h.seccion('9f · Cargas sociales a pagar (SUSS) — la cuota que vence el mes siguiente al cierre')
    h.encabezado(['Vencimiento', 'Qué es', 'A quién', '', '', '', 'Importe $', 'Cuenta contable', 'De dónde sale'])
    rt_f, s_f = _tabla(h, [dict(fecha=f_vto, comp='Cuota «Cargas Sociales»', quien='ARCA', total=imp_s,
                                cuenta='Impuestos Laborales ARCA', nota=f'{det_s} · {de_donde_s}')],
                       'Total 9f — Cargas sociales a pagar', clave=True)
    tot['9f'] = rt_f
    _control(h, '9f Cargas sociales (contra el Balance en línea)', h.cel(C_TOT, rt_f), ci_suss,
              'Balance en línea → «SUSS a pagar», Cierre (la app)')
    r_bp = _fila_de(w_bp, 'Cargas sociales a pagar')
    _control(h, '9f Cargas sociales (contra el Balance propio)', h.cel(C_TOT, rt_f), num(w_bp.cell(r_bp, 3).value),
              'Balance propio → «Cargas sociales a pagar», $ 2026')
    h.nota('Es el período junio 2026, que se paga en julio: al cierre era deuda. Esa cuota no figura en los libros exportados '
           '(sólo llegan hasta el 30/06): el importe sale del renglón del Balance en línea. Abajo, como referencia, lo pagado en el '
           'ejercicio por el mismo concepto.')
    h.blanco()
    lib.pendiente('Cargas sociales: la cuota de julio no está en los libros exportados',
                  f'El cierre ({_pesos(imp_s)}) es «{det_s}»; los libros de cuotas llegan hasta el 30/06/2026 y no la listan.',
                  _pesos(imp_s), HOJA)
    # informativo: pagos del ejercicio
    r_dt = _fila_de(w_ig, 'DETALLE')
    pagos = []
    for r in range(r_dt + 2, w_ig.max_row + 1):
        v = lambda c: w_ig.cell(r, c).value
        if _fch(v(3)) is None:
            break
        if _txt(v(4)) == 'Cargas Sociales' and (num(v(10)) or num(v(11))):
            pagos.append(dict(fecha=_fch(v(3)), comp=_txt(v(6)), quien=f'{_txt(v(7))} — {_txt(v(4))}', total=num(v(10)) - num(v(11)),
                              cuenta=_txt(v(5)), nota=' · '.join(x for x in [_txt(v(8)), 'estado: ' + _txt(v(9))] if x)))
    if pagos:
        r_eg = _fila_de(w_eg, 'Cargas Sociales')
        tot_eg = max(num(w_eg.cell(r_eg, c).value) for c in range(1, w_eg.max_column + 1))
        h.seccion('9f · Informativo, NO suma — pagos de cargas sociales hechos en el ejercicio')
        h.encabezado(['Fecha de pago', 'Comprobante', 'A quién', '', '', '', 'Importe $', 'Cuenta que pagó', 'Detalle y estado'])
        rt, s = _tabla(h, pagos, 'Pagado en el ejercicio (no suma al ítem)')
        _control(h, '9f informativo: pagos de cargas sociales del ejercicio', h.cel(C_TOT, rt), tot_eg,
                  '«H · MSA · Egresos» → «Cargas Sociales», total del ejercicio')
        if abs(pagos[0]['total'] - ap_suss) <= 0.01:
            h.nota(f'El primer pago ({pagos[0]["fecha"].strftime("%d/%m/%Y")}, $ {_pesos(pagos[0]["total"])}) es exactamente el «SUSS a pagar» '
                   'del balance del contador al 30/06/2025: la deuda de apertura se canceló ahí.')
        h.blanco()

    # ── Resumen y Total ítem 9 ──────────────────────────────────────────────────────────────
    filas = [('9a', 'Cuentas a pagar (proveedores)', ap_prov, ci_prov), ('9b', 'Cheques dados sin debitar', ap_chq, ci_chq),
             ('9d', 'Provisión para gastos', ap_pg, ci_pg), ('9e', 'Tarjeta Visa', ap_visa, ci_visa),
             ('9f', 'Cargas sociales a pagar (SUSS)', ap_suss, ci_suss)]
    h.seccion('Resumen del ítem 9 — cada renglón trae el total de su sección de arriba')
    h.encabezado(['', '', 'Concepto', '', '', 'Balance del contador 30/06/2025 $', 'Saldo al cierre 30/06/2026 $', 'Variación $', ''])
    r1 = r2 = None
    for cod, nombre, ap, ci in filas:
        r2 = h.fila([None, None, f'{cod} · {nombre}', None, None, float(ap), f'={h.cel(C_TOT, tot[cod])}',
                     f'={h.cel(C_TOT, h.r + 1)}-{h.cel(6, h.r + 1)}'])
        r1 = r1 or r2
    rt9 = h.total('Total ítem 9 — A pagar', {6: h.suma(6, r1, r2), C_TOT: h.suma(C_TOT, r1, r2), 8: h.suma(8, r1, r2)}, clave=True)
    _control(h, 'Total ítem 9 contra el Balance en línea', h.cel(C_TOT, rt9), sum(f[3] for f in filas),
              'Balance en línea → suma del Cierre (la app) de los 5 renglones')
    h.fila([None, None, '9c · Anticipos a proveedores — activo, NO suma al total de arriba', None, None, float(ap_ant),
            f'={h.cel(C_TOT, tot["9c"])}', f'={h.cel(C_TOT, h.r + 1)}-{h.cel(6, h.r + 1)}'])
    h.nota('El Balance propio agrupa distinto: «Proveedores» = cuentas a pagar + tarjeta; y suma «Sueldos a pagar» '
           '(sueldos devengados y pagados después del cierre), que va en el detalle de sueldos y no en este ítem.')

    comp = {'9a': 'Facturas sin pagar al cierre + saldo de las cuentas corrientes de proveedores',
            '9b': 'Cheques emitidos antes del cierre y debitados después',
            '9c': 'Anticipos con saldo al cierre (activo: no suma al total del ítem 9)',
            '9d': 'Facturas de gastos del ejercicio que entraron en un subdiario posterior',
            '9e': 'Consumos de la tarjeta posteriores al último resumen',
            '9f': 'Cuota de cargas sociales que vence en julio de 2026'}
    lib.item('9', 'A pagar', h, h.cel(C_TOT, rt9), GRUPO, '9a + 9b + 9d + 9e + 9f (9c es un activo y no suma)', sum(f[2] for f in filas))
    for cod, nombre, ap in [('9a', 'Cuentas a pagar (proveedores)', ap_prov), ('9b', 'Cheques dados sin debitar', ap_chq),
                            ('9c', 'Anticipos a proveedores', ap_ant), ('9d', 'Provisión para gastos', ap_pg),
                            ('9e', 'Tarjeta Visa', ap_visa), ('9f', 'Cargas sociales a pagar (SUSS)', ap_suss)]:
        lib.item(cod, nombre, h, h.cel(C_TOT, tot[cod]), GRUPO, comp[cod], ap)
