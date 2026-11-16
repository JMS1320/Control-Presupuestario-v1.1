# -*- coding: utf-8 -*-
"""Detalle 8 — Granos, insumos y sementeras (ítem 8: 8a granos · 8b insumos · 8c sementeras).

Fuente: «Stocks - MSA 25-26» → 1 Granos · 00 Stocks inicio y cierre · Stock insumos · 3 Sementeras.
Sólo usa la API de core.py; las celdas combinadas para textos largos se resuelven acá (_fila)."""
import datetime

from core import num

GRUPO = 'B · Patrimonio al cierre (30/06/2026)'
LIBRO = 'Stocks'
ANCHOS = [33, 9, 11, 12, 14, 11, 12, 14, 14, 11, 9]  # 150
TN = '#,##0.000'
CANT = '#,##0.00;-#,##0.00;0'
PCT = '0%'
DONDE = 'D8 Granos insumos'


def _txt(v):
    return '' if v is None else str(v).strip()


def _es_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _fecha(v):
    if isinstance(v, datetime.datetime):
        return v
    if isinstance(v, datetime.date):
        return datetime.datetime(v.year, v.month, v.day)
    return _txt(v) or None


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


def _enc(h, cols, comb=None):
    r = h.encabezado(cols)
    _combinar(h, r, comb)
    return r


def _buscar(ws, texto, col=1, desde=1):
    for r in range(desde, ws.max_row + 1):
        if _txt(ws.cell(r, col).value).startswith(texto):
            return r
    return None


def _tabla(ws, r_titulo, ncols, fin=('TOTAL', 'Total')):
    """Renglones de una tabla: título en r_titulo, encabezado en r_titulo+1, datos hasta un total o un blanco."""
    filas = []
    r = r_titulo + 2
    while r <= ws.max_row:
        vals = [ws.cell(r, c).value for c in range(1, ncols + 1)]
        if all(v is None for v in vals) or _txt(vals[0]).startswith(fin):
            break
        filas.append(vals)
        r += 1
    return filas, r


# ------------------------------------------------------------------ 8a granos
def _granos(lib, src, h):
    ws = src.hoja(LIBRO, '1 Granos')
    val = lambda et: num(ws.cell(_buscar(ws, et), 2).value) if _buscar(ws, et) else 0.0
    inicio, cosecha, ventas = val('Stock al inicio'), val('+ Cosecha'), val('− Ventas')
    saldo_f, exist, dif_f = val('= Saldo'), val('− Existencia'), val('= DIFERENCIA')
    r_v = _buscar(ws, 'VENTAS DE GRANO QUE CUENTAN')
    r_n = _buscar(ws, 'NO CUENTAN')
    r_c = _buscar(ws, 'COSECHA')
    vts, r_vt = _tabla(ws, r_v, 6) if r_v else ([], None)
    nos, _ = _tabla(ws, r_n, 6) if r_n else ([], None)
    cos, r_ct = _tabla(ws, r_c, 5) if r_c else ([], None)
    tot_v = num(ws.cell(r_vt, 4).value) if r_vt else 0.0
    tot_c = num(ws.cell(r_ct, 5).value) if r_ct else 0.0
    precio = val('Precio por tonelada')
    r_o = _buscar(ws, 'Origen del precio')
    origen = _txt(ws.cell(r_o, 2).value) if r_o else ''
    calidad, cz, neto_f = val('% calidad'), val('% CZ'), val('NETO FINAL')

    h.blanco()
    h.seccion('8a · Granos (soja) — cuadre de toneladas y valuación al cierre')
    h.nota('Inicio + cosecha − ventas = saldo al cierre, en toneladas; el saldo × el precio de pizarra del 30/06/2026 es el '
           'valor. La cosecha y las ventas apuntan al total de su detalle, más abajo. Los arrendamientos cobrados en soja NO '
           'mueven el stock (la renta se fija en toneladas pero no sale grano): se listan aparte.')
    _enc(h, ['Concepto', None, None, None, None, 'Toneladas', 'Cómo se lee'], {7: 11})
    f_ini = _fila(h, ['Stock al inicio del ejercicio (30/06/2025)', None, None, None, None, float(inicio),
                      'stock declarado; en el balance 24/25 del contador figura como «Soja» por 2.045.386,32'], {7: 11},
                  fmt={6: TN})
    f_cos = _fila(h, ['+ Cosecha del ejercicio', None, None, None, None, 0.0, 'total de las certificaciones (tabla 8a.2)'],
                  {7: 11}, fmt={6: TN})
    f_ven = _fila(h, ['− Ventas del ejercicio', None, None, None, None, 0.0,
                      'total de las ventas en que salió grano (tabla 8a.1)'], {7: 11}, fmt={6: TN})
    f_sal = h.total('Saldo al cierre (30/06/2026) = inicio + cosecha − ventas',
                    {6: f"=ROUND({h.cel(6, f_ini)}+{h.cel(6, f_cos)}-{h.cel(6, f_ven)},3)"}, fmt={6: TN})
    h.control('saldo de granos en toneladas', h.cel(6, f_sal), saldo_f, '1 Granos, «= Saldo»', tolerancia=0.001)
    f_ex = _fila(h, ['Existencia declarada al cierre', None, None, None, None, float(exist),
                     'lo que se declaró en stock al 30/06/2026'], {7: 11}, fmt={6: TN})
    _fila(h, ['Diferencia (saldo − existencia)', None, None, None, None, f"={h.cel(6, f_sal)}-{h.cel(6, f_ex)}",
              'tiene que dar 0'], {7: 11}, fmt={6: TN})

    h.blanco()
    _enc(h, ['Valuación al cierre', None, None, None, None, 'Toneladas', '%', 'Importe $', 'Cómo se lee'], {9: 11})
    f_t = _fila(h, ['Toneladas al cierre', None, None, None, None, f"={h.cel(6, f_sal)}", None, None,
                    'el saldo del cuadre'], {9: 11}, fmt={6: TN})
    f_p = _fila(h, ['Precio por tonelada', None, None, None, None, None, None, float(precio), origen], {9: 11})
    f_b = _fila(h, ['Monto bruto', None, None, None, None, None, None, f"={h.cel(6, f_t)}*{h.cel(8, f_p)}",
                    'toneladas × precio'], {9: 11})
    f_q = _fila(h, ['Monto con el ajuste de calidad', None, None, None, None, None, float(calidad),
                    f"={h.cel(8, f_b)}*{h.cel(7, h.r + 1)}", 'monto bruto × % de calidad'], {9: 11}, fmt={7: PCT})
    f_g = _fila(h, ['Gastos de comercialización (comisión + flete + otros)', None, None, None, None, None, float(cz),
                    f"=-{h.cel(8, f_q)}*{h.cel(7, h.r + 1)}", 'se restan del monto con calidad'], {9: 11}, fmt={7: PCT})
    f_tot = h.total('Total 8a — granos al cierre', {8: f"={h.cel(8, f_q)}+{h.cel(8, f_g)}"}, clave=True)
    h.control('valor de granos al cierre (8a)', h.cel(8, f_tot), neto_f, '1 Granos, «NETO FINAL»')

    def tabla_ventas(titulo, filas, nota):
        h.blanco()
        h.seccion(titulo)
        _enc(h, ['Fecha', 'Cliente', None, None, None, 'Toneladas', 'Grano', 'Comprobante', 'Cuenta'], {2: 5, 9: 11})
        a = None
        s = 0.0
        for v in sorted(filas, key=lambda x: (x[0] is None, x[0])):
            r = _fila(h, [_fecha(v[0]), _txt(v[1]), None, None, None, float(num(v[3])), _txt(v[2]), _txt(v[5]),
                          _txt(v[4])], {2: 5, 9: 11}, fmt={6: TN})
            a = a or r
            s += num(v[3])
        if a is None:
            _fila(h, ['Sin movimientos.'], {1: 11})
            return h.total(nota, {6: '=0'}, fmt={6: TN}), 0.0
        return h.total(nota, {6: h.suma(6, a, h.r)}, fmt={6: TN}), s

    rt, s = tabla_ventas('8a.1 · Ventas de grano que cuentan (salió grano)', vts, 'Total ventas del ejercicio')
    h.celda(6, f_ven).value = f"={h.cel(6, rt)}"
    h.control('ventas de grano en toneladas', h.cel(6, rt), tot_v, '1 Granos, ventas que cuentan, TOTAL', tolerancia=0.001)
    if abs(s - tot_v) > 0.0005 or abs(s - ventas) > 0.0005:
        lib.pendiente('Granos — ventas', f'Las ventas listadas suman {_ar(s, 3)} t; el total de la tabla dice '
                      f'{_ar(tot_v, 3)} t y el cuadre {_ar(ventas, 3)} t.', 'toneladas', DONDE)

    h.blanco()
    h.seccion('8a.2 · Cosecha — certificaciones electrónicas de granos del ejercicio')
    _enc(h, ['Fecha', 'Depositario', None, None, None, 'Toneladas', None, 'Comprobante'], {2: 5})
    a = None
    s = 0.0
    for v in cos:
        r = _fila(h, [_fecha(v[0]), _txt(v[1]), None, None, None, float(num(v[4])), None, _txt(v[2])], {2: 5}, fmt={6: TN})
        a = a or r
        s += num(v[4])
    rt = h.total('Total cosecha certificada', {6: h.suma(6, a, h.r) if a else '=0'}, fmt={6: TN})
    h.celda(6, f_cos).value = f"={h.cel(6, rt)}"
    h.control('cosecha en toneladas', h.cel(6, rt), tot_c, '1 Granos, «Total certificado»', tolerancia=0.001)
    if abs(s - cosecha) > 0.0005:
        lib.pendiente('Granos — cosecha', f'Las certificaciones suman {_ar(s, 3)} t y el cuadre dice {_ar(cosecha, 3)} t.',
                      'toneladas', DONDE)

    tabla_ventas('8a.3 · Informativo — NO cuentan en el cuadre: arrendamientos cobrados en soja', nos,
                 'Total arrendamientos fijados en soja (no mueve stock)')

    if abs(round(inicio + cosecha - ventas, 3) - saldo_f) > 0.0005 or abs(dif_f) > 0.0005:
        lib.pendiente('Granos — cuadre', f'Inicio {_ar(inicio, 3)} + cosecha {_ar(cosecha, 3)} − ventas {_ar(ventas, 3)} no '
                      f'da el saldo del papel ({_ar(saldo_f, 3)}) o queda diferencia con la existencia ({_ar(dif_f, 3)}).',
                      'toneladas', DONDE)
    return f_tot


# ------------------------------------------------------------------ 8b insumos
def _insumos(lib, src, h):
    ws = src.hoja(LIBRO, '00 Stocks')
    wsi = src.hoja(LIBRO, 'Stock insumos')
    rubros = {}
    subt_f = {}
    for r in range(6, ws.max_row + 1):
        a = _txt(ws.cell(r, 1).value)
        if a.startswith('Subtotal'):
            subt_f[a.replace('Subtotal ', '')] = (num(ws.cell(r, 6).value), num(ws.cell(r, 8).value),
                                                  num(ws.cell(r, 11).value), num(ws.cell(r, 13).value))
        elif a:
            rubros.setdefault(a, []).append([ws.cell(r, c).value for c in range(1, 17)])

    h.blanco()
    h.seccion('8b · Insumos, forrajes y combustible — cantidad × precio = valor, al inicio y al cierre')
    h.nota('Un renglón por producto. Inicio: el stock que declaró JMS al 30/06/2025, con el precio que declaró. Cierre: la '
           'existencia que reconstruye la app (compras − usos) al 30/06/2026, al precio de la última compra. Donde falta el '
           'precio el valor queda vacío y NO suma: la última columna dice qué falta. Una cantidad negativa al cierre quiere '
           'decir que se registraron más usos que compras (falta cargar compras o el stock inicial en la app).')
    cols = ['Producto', 'Unidad', 'Inicio: cantidad', 'Inicio: precio $', 'Inicio: valor $', 'Cierre: cantidad',
            'Cierre: precio $', 'Cierre: valor $', 'Qué falta']
    subt = []
    sin_precio_c, sin_precio_i, negativos = [], [], []
    otros_precios = 0
    for rubro in ('Insumos', 'Forrajes', 'Combustible'):
        filas = rubros.get(rubro, [])
        if not filas:
            continue
        h.blanco()
        _enc(h, [f'{rubro} — producto'] + cols[1:], {9: 11})
        a = None
        s_i = s_c = 0.0
        for v in filas:
            item, un = _txt(v[1]), _txt(v[2])
            qi, pi, qc, pc = v[3], v[6], v[8], v[9]
            if _es_num(v[4]) or _es_num(v[11]):
                otros_precios += 1
            falta = []
            if _es_num(qi) and qi and not _es_num(pi):
                falta.append('inicio sin precio')
                sin_precio_i.append(item)
            if _es_num(qc) and qc and not _es_num(pc):
                falta.append('cierre sin precio')
                sin_precio_c.append(f'{item} ({_ar(qc)} {un})')
            if _es_num(qc) and qc < 0:
                falta.append('existencia negativa')
                negativos.append(f'{item} ({_ar(qc)} {un})')
            if not _es_num(qi) and not _es_num(qc):
                falta.append('sin cantidades')
            r = h.r + 1
            _fila(h, [item, un or None,
                      float(qi) if _es_num(qi) else None, float(pi) if _es_num(pi) else None,
                      f"={h.cel(3, r)}*{h.cel(4, r)}" if _es_num(qi) and _es_num(pi) else None,
                      float(qc) if _es_num(qc) else None, float(pc) if _es_num(pc) else None,
                      f"={h.cel(6, r)}*{h.cel(7, r)}" if _es_num(qc) and _es_num(pc) else None,
                      ' · '.join(falta) or None], {9: 11}, fmt={3: CANT, 6: CANT})
            a = a or r
            if _es_num(qi) and _es_num(pi):
                s_i += qi * pi
            if _es_num(qc) and _es_num(pc):
                s_c += qc * pc
        rs = h.total(f'Subtotal {rubro.lower()}', {5: h.suma(5, a, h.r), 8: h.suma(8, a, h.r)})
        subt.append(rs)
        fi, fc = subt_f.get(rubro, (0, 0, 0, 0))[1], subt_f.get(rubro, (0, 0, 0, 0))[2]
        if abs(s_i - fi) > 0.01 or abs(s_c - fc) > 0.01:
            lib.pendiente(f'Insumos — {rubro}', f'Los renglones dan inicio {_ar(s_i)} / cierre {_ar(s_c)} y los subtotales '
                          f'del papel {_ar(fi)} / {_ar(fc)}.', '$', DONDE)
    f_tot = h.total('Total 8b — insumos, forrajes y combustible', {5: h.suma_de(5, subt), 8: h.suma_de(8, subt)}, clave=True)
    ini_f = sum(subt_f.get(k, (0, 0, 0, 0))[1] for k in ('Insumos', 'Forrajes', 'Combustible'))
    r_tv = _buscar(wsi, 'TOTAL VALUADO')
    tv = num(wsi.cell(r_tv, 2).value) if r_tv else 0.0
    h.control('insumos valuados al cierre (8b)', h.cel(8, f_tot), tv, 'Stock insumos, «TOTAL VALUADO»')
    h.control('insumos valuados al inicio', h.cel(5, f_tot), ini_f,
              '00 Stocks inicio y cierre, subtotales de inicio')

    # pendientes de 8b
    if sin_precio_c:
        lib.pendiente('Insumos — sin precio al cierre', f'{len(sin_precio_c)} producto(s) con existencia al cierre y sin '
                      'precio: NO están en el total. ' + '; '.join(sin_precio_c) + '.',
                      'el total 8b no los incluye', DONDE)
    if negativos:
        lib.pendiente('Insumos — existencias negativas', f'{len(negativos)} producto(s) con existencia negativa al cierre '
                      '(más usos que compras cargadas): ' + '; '.join(negativos) + '.',
                      f'por esto el total valuado al cierre da negativo ({_ar(tv)})', DONDE)
    if sin_precio_i:
        lib.pendiente('Insumos — sin precio al inicio', f'{len(sin_precio_i)} producto(s) con cantidad al inicio y sin '
                      'precio (no suman al valor de inicio): ' + '; '.join(sin_precio_i) + '.',
                      'valor de inicio incompleto', DONDE)
    if otros_precios:
        lib.pendiente('Insumos — precios', f'{otros_precios} renglón(es) traen además precio contable de inicio o precio '
                      'económico de cierre, que esta hoja no muestra (toma económico al inicio y contable al cierre).', '', DONDE)
    r_ctl = _buscar(wsi, '⚠️ CONTROL')
    if r_ctl:
        k = r_ctl + 2
        casos = []
        while wsi.cell(k, 2).value is not None:
            casos.append(f"{_txt(wsi.cell(k, 2).value)}: hoy {_ar(num(wsi.cell(k, 3).value))} contra "
                         f"{_ar(num(wsi.cell(k, 4).value))} de la suma de movimientos ({_txt(wsi.cell(k, 5).value)})")
            k += 1
        lib.pendiente('Insumos — existencia de hoy', _txt(wsi.cell(r_ctl, 1).value) + ' ' + '; '.join(casos) + '.',
                      'cantidades', DONDE)
    r_f = _buscar(wsi, '🕳️ LO QUE TODAVÍA LE FALTA')
    if r_f:
        k = r_f + 1
        while wsi.cell(k, 2).value is not None:
            lib.pendiente(f'Stocks — falta en el papel «{_txt(wsi.cell(k, 2).value)}»', _txt(wsi.cell(k, 3).value), '', DONDE)
            k += 1

    # informativo: sistema contra lo declarado en el campo
    r_s = _buscar(wsi, 'SALDOS DE INSUMOS')
    if r_s:
        bloques = {}
        actual = None
        for r in range(r_s + 1, wsi.max_row + 1):
            a = _txt(wsi.cell(r, 1).value)
            if a.startswith('Al INICIO') or a.startswith('Al CIERRE'):
                actual = 'inicio' if a.startswith('Al INICIO') else 'cierre'
                bloques[actual] = {}
            elif a and actual:
                bloques[actual][a] = (wsi.cell(r, 2).value, wsi.cell(r, 3).value, wsi.cell(r, 4).value)
        h.blanco()
        h.seccion('8b.1 · Informativo — lo declarado en el campo (planilla de stocks de JMS) contra lo que valúa el sistema')
        h.nota('No interviene en el total 8b. «Campo» es el stock valuado que declara JMS en su planilla (el que usa el balance '
               'propio); «sistema» es lo que la app llega a valuar con sus precios (tabla 8b). La diferencia muestra cuánto le '
               'falta a la app para reemplazar la planilla.')
        _enc(h, ['Concepto', None, None, None, 'Inicio: campo $', None, None, 'Cierre: campo $', 'Balance 24/25 del contador'],
             {9: 11})
        a = None
        s_cc = 0.0
        for nom in [k for k in bloques.get('cierre', {}) if k != 'TOTAL']:
            ci = bloques.get('inicio', {}).get(nom, (None, None, None))
            cc = bloques['cierre'][nom]
            r = _fila(h, [nom, None, None, None, float(ci[1]) if _es_num(ci[1]) else None, None, None,
                          float(cc[1]) if _es_num(cc[1]) else None,
                          f'{_ar(ci[2])} al inicio' if _es_num(ci[2]) else None], {9: 11})
            a = a or r
            s_cc += num(cc[1])
        rc = h.total('Total declarado en el campo', {5: h.suma(5, a, h.r), 8: h.suma(8, a, h.r)})
        tc_f = num(bloques['cierre'].get('TOTAL', (0, 0, 0))[1])
        h.control('total declarado en el campo al cierre', h.cel(8, rc), tc_f, 'Stock insumos, TOTAL Campo al cierre')
        _fila(h, ['Sistema: insumos valuados (tabla 8b)', None, None, None, None, None, None, f"={h.cel(8, f_tot)}",
                  'no incluye sementeras (8c)'], {9: 11})
        _fila(h, ['Campo − sistema', None, None, None, None, None, None, f"={h.cel(8, rc)}-{h.cel(8, h.r)}",
                  'lo que todavía no sale del sistema'], {9: 11}, negrita=True)
        lib.pendiente('Insumos — sistema contra campo', f'Al cierre el sistema valúa {_ar(tv)} de insumos y la planilla de '
                      f'JMS declara {_ar(s_cc)} entre insumos y sementeras. El ítem 8b muestra el número del sistema (el '
                      'del papel de Stocks), que hoy no es un valor presentable: falta cargar precios y stock inicial. '
                      'Hay que decidir cuál va al balance.', f'{_ar(s_cc - tv)} de diferencia', DONDE)
    return f_tot


# ------------------------------------------------------------------ 8c sementeras
def _sementeras(lib, src, h):
    ws = src.hoja(LIBRO, '3 Sementeras')
    ws0 = src.hoja(LIBRO, '00 Stocks')
    r_enc = _buscar(ws, 'Fecha')
    filas = []
    r = r_enc + 1
    while ws.cell(r, 1).value is not None and not _txt(ws.cell(r, 1).value).startswith('COSTO'):
        filas.append([ws.cell(r, c).value for c in range(1, 9)])
        r += 1
    r_costo = _buscar(ws, 'COSTO')
    costo_f = num(ws.cell(r_costo, 2).value) if r_costo else 0.0
    resumen = _txt(ws.cell(4, 1).value)

    h.blanco()
    h.seccion('8c · Sementeras — insumos aplicados en las órdenes ejecutadas hasta el cierre')
    h.nota(f'{resumen}. Cada renglón es un insumo aplicado en un lote: cantidad × precio = costo. Sólo cuentan las órdenes '
           'EJECUTADAS hasta el 30/06/2026; las que no se contaron están en 8c.1 con su motivo. En el balance 24/25 del '
           'contador figura «Sementeras agricultura» por 4.738.332,10.')
    _enc(h, ['Fecha', 'Lote', None, None, 'Hectáreas', 'Cantidad', 'Precio unitario $', 'Costo $', 'Insumo (unidad)'],
         {2: 4, 9: 11})
    a = None
    s = 0.0
    sin = 0
    for v in filas:
        q, p = v[4], v[6]
        q = float(q) if _es_num(q) else (float(str(q).replace(',', '.')) if _txt(q).replace('.', '', 1).isdigit() else None)
        rr = h.r + 1
        _fila(h, [_fecha(v[0]), _txt(v[1]), None, None, float(v[2]) if _es_num(v[2]) else None, q,
                  float(p) if _es_num(p) else None,
                  f"={h.cel(6, rr)}*{h.cel(7, rr)}" if q is not None and _es_num(p) else None,
                  f"{_txt(v[3])} ({_txt(v[5])})" + ('' if _es_num(p) else ' — falta el precio')], {2: 4, 9: 11},
              fmt={5: CANT, 6: CANT})
        a = a or rr
        if q is not None and _es_num(p):
            s += q * p
        else:
            sin += 1
    f_tot = h.total('Total 8c — sementeras al cierre (costo de los insumos con precio)',
                    {8: h.suma(8, a, h.r) if a else '=0'}, clave=True)
    h.control('costo de sementeras (8c)', h.cel(8, f_tot), costo_f, '3 Sementeras, «COSTO»')
    if abs(s - costo_f) > 0.01:
        lib.pendiente('Sementeras — costo', f'Los renglones con precio suman {_ar(s)} y el papel dice {_ar(costo_f)}.', '$', DONDE)
    r_inc = _buscar(ws, '⚠️ EL COSTO')
    falta = []
    if r_inc:
        k = r_inc + 1
        while ws.cell(k, 2).value is not None:
            falta.append(_txt(ws.cell(k, 2).value))
            k += 1
    if sin or falta:
        lib.pendiente('Sementeras — costo incompleto', f'{sin} de {len(filas)} línea(s) de insumo sin precio: el costo de '
                      f'sementeras da {_ar(s)}. El papel dice que falta: ' + '; '.join(falta) + '.',
                      'el ítem 8c está sin valuar (contador 24/25: 4.738.332,10)', DONDE)
    raras = sorted({f"{_txt(v[3])} en «{_txt(v[5])}»" for v in filas
                    if (_txt(v[5]) == 'L' and _txt(v[3]).split()[0] in ('Avena', 'MAP', 'Urea'))
                    or _txt(v[5]) == 'cc'})
    if raras:
        lib.pendiente('Sementeras — unidades', 'Unidades que no parecen las del producto (el mismo producto figura en kg o '
                      'en L en el stock de insumos): ' + '; '.join(raras) + '.', 'afecta cantidad × precio cuando se cargue el precio', DONDE)

    r_no = _buscar(ws, 'ÓRDENES QUE NO SE CONTARON')
    if r_no:
        nos, _ = _tabla(ws, r_no, 4)
        h.blanco()
        h.seccion('8c.1 · Informativo — órdenes que no se contaron, y por qué')
        _enc(h, ['Fecha', 'Lote', None, None, 'Estado', 'Motivo'], {2: 4, 6: 11})
        for v in sorted(nos, key=lambda x: (x[0] is None, x[0])):
            _fila(h, [_fecha(v[0]), _txt(v[1]), None, None, _txt(v[2]), _txt(v[3])], {2: 4, 6: 11})

    # sementera al inicio y pasturas (US$) según el cuadro inicio/cierre
    ini = [(_txt(ws0.cell(r, 2).value), _txt(ws0.cell(r, 15).value)) for r in range(6, ws0.max_row + 1)
           if _txt(ws0.cell(r, 1).value) == 'Sementeras' and _txt(ws0.cell(r, 2).value).lower().startswith('sementera al inicio')]
    for nom, de in ini:
        lib.pendiente('Sementeras — inicio', f'«{nom}» no tiene cantidad ni valor cargado. {de}',
                      'el inicio de sementeras está sin valuar en el sistema', DONDE)
    past = [[ws0.cell(r, c).value for c in range(1, 17)] for r in range(6, ws0.max_row + 1)
            if _txt(ws0.cell(r, 1).value) == 'Pasturas']
    if past:
        h.blanco()
        h.seccion('8c.2 · Informativo — pasturas, en DÓLARES (no suman al total en pesos)')
        h.nota('Hectáreas × US$ por hectárea (valor de implantación ya amortizado según la vida útil). Va aparte porque está '
               'en dólares y el papel no trae su conversión a pesos.')
        _enc(h, ['Lote', 'Unidad', 'Inicio: hectáreas', 'Inicio: US$ por ha', 'Inicio: valor US$', 'Cierre: hectáreas',
                 'Cierre: US$ por ha', 'Cierre: valor US$', 'Siembra y amortización'], {9: 11})
        a = None
        si = sc = 0.0
        for v in past:
            rr = h.r + 1
            _fila(h, [_txt(v[1]), 'ha', float(num(v[3])), float(num(v[4])), f"={h.cel(3, rr)}*{h.cel(4, rr)}",
                      float(num(v[8])), float(num(v[9])), f"={h.cel(6, rr)}*{h.cel(7, rr)}",
                      f"{_txt(v[13])} · {_txt(v[14])}"], {9: 11}, fmt={3: CANT, 6: CANT})
            a = a or rr
            si += num(v[3]) * num(v[4])
            sc += num(v[8]) * num(v[9])
        rp = h.total('Total pasturas US$', {5: h.suma(5, a, h.r), 8: h.suma(8, a, h.r)})
        sub = None
        for r in range(6, ws0.max_row + 1):
            if _txt(ws0.cell(r, 1).value).startswith('Subtotal Pasturas'):
                sub = (num(ws0.cell(r, 6).value), num(ws0.cell(r, 11).value))
        if sub:
            h.control('pasturas al cierre en US$', h.cel(8, rp), sub[1], '00 Stocks inicio y cierre, Subtotal Pasturas (US$)')
            if abs(si - sub[0]) > 0.01 or abs(sc - sub[1]) > 0.01:
                lib.pendiente('Pasturas', f'Renglones US$ {_ar(si)} / {_ar(sc)} contra subtotales {_ar(sub[0])} / {_ar(sub[1])}.',
                              'US$', DONDE)
        lib.pendiente('Pasturas — en dólares y fuera del total', f'Las pasturas valen US$ {_ar(sc)} al cierre (US$ {_ar(si)} '
                      'al inicio) según el cuadro inicio/cierre; no tienen conversión a pesos en el papel y no están en el '
                      'total del ítem 8.', 'falta definir si van al balance y a qué tipo de cambio', DONDE)
    return f_tot


def construir(lib, src):
    arch = src.nombre(LIBRO)
    h = lib.hoja(DONDE, ANCHOS, horizontal=True)
    h.titulo('Detalle 8 — Granos, insumos y sementeras (ítem 8)')
    h.nota(f'Fuente: {arch} → «1 Granos» (8a), «00 Stocks inicio y cierre» y «Stock insumos» (8b), «3 Sementeras» (8c). '
           'El resumen de abajo junta las tres partes; cada una tiene su detalle a continuación, en esta misma hoja, con su '
           'cálculo (cantidad × precio) y su control contra el papel. Lo que el papel marca sin precio queda a la vista, '
           'no suma, y está listado en los pendientes. La hacienda del mismo cuadro inicio/cierre es el ítem 7.')
    h.blanco()
    h.seccion('Resumen del ítem 8 — valor al cierre (30/06/2026)')
    _enc(h, ['Parte', None, None, None, None, None, None, 'Valor al cierre $', 'De qué se compone'], {9: 11})
    partes = [('8a · Granos', 'toneladas al cierre × precio de pizarra (tabla 8a)'),
              ('8b · Insumos, forrajes y combustible', 'cantidad × precio de cada producto con precio (tabla 8b)'),
              ('8c · Sementeras', 'insumos aplicados en órdenes ejecutadas × precio (tabla 8c)')]
    fr = [_fila(h, [n, None, None, None, None, None, None, 0.0, d], {9: 11}) for n, d in partes]
    f_res = h.total('Total ítem 8', {8: h.suma(8, fr[0], fr[-1])}, clave=True)

    ta = _granos(lib, src, h)
    tb = _insumos(lib, src, h)
    tc = _sementeras(lib, src, h)
    for f, t in zip(fr, (ta, tb, tc)):
        h.celda(8, f).value = f"={h.cel(8, t)}"

    lib.item('8', 'Granos, insumos y sementeras', h, h.cel(8, f_res), GRUPO, '8a granos + 8b insumos + 8c sementeras', None)
    lib.item('8a', 'Granos (soja)', h, h.cel(8, ta), GRUPO,
             'inicio + cosecha − ventas = toneladas al cierre × precio de pizarra', 2045386.32)
    lib.item('8b', 'Insumos, forrajes y combustible (valuado del sistema: incompleto, ver pendientes)', h, h.cel(8, tb), GRUPO,
             'cantidad × precio por producto (sólo los que tienen precio)', None)
    lib.item('8c', 'Sementeras', h, h.cel(8, tc), GRUPO,
             'insumos aplicados en órdenes ejecutadas × precio', 4738332.10)
