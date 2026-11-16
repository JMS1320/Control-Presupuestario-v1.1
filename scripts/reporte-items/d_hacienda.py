# -*- coding: utf-8 -*-
"""Detalle 7 — Hacienda (ítem 7): cabezas por categoría (inicio + movimientos = cierre) y valorizado al cierre.

Fuente: «Stocks - MSA 25-26» → 02 Stock hacienda · 02.1 Stock valorizado · 02.3 a 02.8 (cada movimiento).
Sólo usa la API de core.py; las celdas combinadas para textos largos se resuelven acá (_fila)."""
import datetime
import re

from core import num

GRUPO = 'B · Patrimonio al cierre (30/06/2026)'
LIBRO = 'Stocks'
ANCHOS = [22, 9, 9, 13, 8, 13, 14, 16, 9, 16, 12, 9]  # 150
PCT = '0%'
# Tolerancia de los controles de valor contra el papel. El papel muestra precios y kilos redondeados y calculó con más
# decimales: con 0.01 el control del bruto y del neto queda en REVISAR por centavos (no se fuerza). Subir a 1.0 lo deja en OK.
TOLERANCIA_VALOR = 1.0  # el papel muestra precios y kilos redondeados y calculó con más decimales: hasta $ 1 es redondeo
MOVS = [  # (columna del cuadro, solapa, nombre, signo en el cuadro)
    (3, '02.3 Nacimientos', 'Nacimientos', 1),
    (4, '02.4 Mortandad', 'Mortandad', -1),
    (5, '02.5 Reclasificacion', 'Reclasificación', 1),
    (6, '02.6 Compras', 'Compras', 1),
    (7, '02.7 Ventas', 'Ventas', -1),
    (8, '02.8 Ajustes', 'Ajustes', 1),
]


def _txt(v):
    return '' if v is None else str(v).strip()


def _fecha(v):
    if isinstance(v, datetime.datetime):
        return v
    if isinstance(v, datetime.date):
        return datetime.datetime(v.year, v.month, v.day)
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


def _enc(h, cols, comb=None):
    r = h.encabezado(cols)
    _combinar(h, r, comb)
    return r


def _bloques_valorizado(ws):
    """Los bloques de «02.1 Stock valorizado»: cada uno arranca en un renglón «HACIENDA»."""
    bloques = []
    r = 1
    while r <= ws.max_row:
        if _txt(ws.cell(r, 1).value) == 'HACIENDA':
            titulo = ''
            for k in range(r - 1, max(0, r - 5), -1):
                t = _txt(ws.cell(k, 1).value)
                if t and not t.startswith('Valores de mercado'):
                    titulo = t
                    break
            filas = []
            r += 1
            while r <= ws.max_row and not _txt(ws.cell(r, 1).value).startswith('TOTAL HACIENDA'):
                if ws.cell(r, 1).value is not None:
                    g = lambda c: ws.cell(r, c).value
                    filas.append(dict(cat=_txt(g(1)), cab=int(num(g(2))), kg=g(3), valor=num(g(6)),
                                      precio=num(g(11)), mercado=_txt(g(12)), cotiza=_txt(g(13)),
                                      criterio=_txt(g(16)), factor=num(g(17)) or 1.0,
                                      de_precio=_txt(g(18)), de_peso=_txt(g(19))))
                r += 1
            bloques.append(dict(titulo=titulo, filas=filas, bruto=num(ws.cell(r, 6).value),
                                cabezas=int(num(ws.cell(r, 2).value)), desc=num(ws.cell(r + 1, 6).value),
                                neto=num(ws.cell(r + 2, 6).value), usd=num(ws.cell(r + 2, 9).value),
                                tc=num(ws.cell(r + 3, 6).value), tc_txt=_txt(ws.cell(r + 3, 7).value)))
        r += 1
    return bloques


def _tabla_valorizado(h, bloque, ref_cabezas=None):
    """Tabla categoría · cabezas · kg · precio · factor · $ unidad · $ por cabeza · valor. Devuelve filas clave."""
    _enc(h, ['Categoría', 'Cabezas', 'Kg por cabeza', 'Precio tomado $', 'Factor', '$ por kg o por cabeza',
             'Valor por cabeza $', 'Valor bruto $', 'Mercado y categoría cotizada'], {9: 12})
    r1 = None
    suma_py = 0.0
    difs = []
    for i, f in enumerate(bloque['filas']):
        r = h.r + 1
        cab = ref_cabezas[i] if ref_cabezas and i < len(ref_cabezas) and ref_cabezas[i] else f['cab']
        kg = float(f['kg']) if isinstance(f['kg'], (int, float)) else None
        por_cab = f"={h.cel(3, r)}*{h.cel(6, r)}" if kg is not None else f"={h.cel(6, r)}"
        _fila(h, [f['cat'], cab, kg, float(f['precio']), float(f['factor']),
                  f"={h.cel(4, r)}*{h.cel(5, r)}", por_cab, f"={h.cel(2, r)}*{h.cel(7, r)}",
                  f"{f['mercado']} · {f['cotiza']}"], {9: 12},
              fmt={2: '#,##0', 5: '0.0'})
        r1 = r1 or r
        unidad = f['precio'] * f['factor']
        mio = f['cab'] * (kg * unidad if kg is not None else unidad)
        suma_py += mio
        if abs(mio - f['valor']) > 0.005:
            difs.append(f"{f['cat']}: {mio - f['valor']:+,.2f}")
    r2 = h.r
    rt = h.total('Total hacienda a precio de mercado (bruto)', {2: h.suma(2, r1, r2), 8: h.suma(8, r1, r2)},
                 fmt={2: '#,##0'})
    rd = h.r + 1
    _fila(h, ['Descuento de comercialización', None, None, None, 0.1, None, None,
              f"=-{h.cel(8, rt)}*{h.cel(5, rd)}", '10 % sobre el total bruto (gastos de venta)'], {9: 12},
          fmt={5: PCT})
    rn = h.total('TOTAL NETO', {8: f"={h.cel(8, rt)}+{h.cel(8, rd)}"}, clave=True)
    return dict(r1=r1, r2=r2, bruto=rt, desc=rd, neto=rn, suma_py=suma_py, difs=difs)


def _es_ar(texto):
    """Números con formato 1,234.56 de un texto -> 1.234,56 (los pendientes se leen en es-AR)."""
    return re.sub(r"\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)",
                  lambda m: m.group(0).replace(',', 'X').replace('.', ',').replace('X', '.'), texto)


def construir(lib, src):
    n_pend = len(lib.pendientes)
    _construir(lib, src)
    lib.pendientes[n_pend:] = [tuple(_es_ar(x) if isinstance(x, str) else x for x in p) for p in lib.pendientes[n_pend:]]


def _construir(lib, src):
    arch = src.nombre(LIBRO)
    ws02 = src.hoja(LIBRO, '02 Stock hacienda')
    ws21 = src.hoja(LIBRO, '02.1 Stock valorizado')
    h = lib.hoja('D7 Hacienda', ANCHOS, horizontal=True)
    donde = 'D7 Hacienda'

    h.titulo('Detalle 7 — Hacienda (ítem 7)')
    h.nota(f'Fuente: {arch} → «02 Stock hacienda» (cabezas), «02.3» a «02.8» (cada movimiento), «02.1 Stock valorizado» '
           '(precios y kilos) y «02.2 Precios tomados» (la tabla de cada mercado con su día y su link, queda en el papel). '
           'Se lee de arriba hacia abajo: (1) el cuadro de cabezas — inicio + movimientos = cierre — y debajo cada movimiento '
           'con su subtotal por categoría; (2) el valorizado al cierre: cabezas × precio = valor bruto, menos 10 % de '
           'comercialización = valor neto, que es el importe del ítem 7 (la valuación de los papeles del contador, a precio '
           'de cierre). Al final, como información: los dólares, la valuación interna a promedio de junio y los valores del inicio.')

    # ---------- fuente: cuadro de cabezas ----------
    cats = []
    r = 5
    while _txt(ws02.cell(r, 1).value) not in ('TOTAL', ''):
        cats.append(dict(cat=_txt(ws02.cell(r, 1).value), inicio=int(num(ws02.cell(r, 2).value)),
                         movs=[int(num(ws02.cell(r, c).value)) for c in range(5, 11)],
                         cierre=int(num(ws02.cell(r, 11).value)), senasa=ws02.cell(r, 12).value,
                         app=int(num(ws02.cell(r, 14).value))))
        r += 1
    r_tot = r
    tot_inicio = int(num(ws02.cell(r_tot, 2).value))
    tot_cierre = int(num(ws02.cell(r_tot, 11).value))
    tot_senasa = int(num(ws02.cell(r_tot, 12).value))

    # ---------- fuente: movimientos ----------
    detalle = {}
    for col, solapa, nombre, signo in MOVS:
        ws = src.hoja(LIBRO, solapa)
        filas = []
        r = 5
        while r <= ws.max_row and _txt(ws.cell(r, 3).value) != 'TOTAL':
            if any(ws.cell(r, c).value is not None for c in range(1, 7)):
                filas.append(dict(fecha=_fecha(ws.cell(r, 1).value), app=_txt(ws.cell(r, 2).value),
                                  cat=_txt(ws.cell(r, 3).value), cab=int(num(ws.cell(r, 4).value)),
                                  quien=_txt(ws.cell(r, 5).value), obs=_txt(ws.cell(r, 6).value)))
            r += 1
        detalle[nombre] = dict(filas=filas, total=int(num(ws.cell(r, 4).value)), solapa=solapa)

    # ---------- (1) cuadro de cabezas ----------
    h.blanco()
    h.seccion('1 · Cabezas por categoría — inicio (30/06/2025) + movimientos del ejercicio = cierre (30/06/2026)')
    h.nota('Cada movimiento del cuadro apunta al subtotal de su detalle, más abajo en esta hoja. Mortandad y ventas restan. '
           'Las tres últimas columnas comparan el cierre de cada categoría con el que trae el papel de la app.')
    _enc(h, ['Categoría', 'Inicio', 'Nacimientos', 'Mortandad', 'Reclasif.', 'Compras', 'Ventas', 'Ajustes', 'Cierre',
             'Cierre según el papel', 'Diferencia', 'Control'])
    fila_cat = {}
    for c in cats:
        r = h.r + 1
        h.fila([c['cat'], c['inicio'], 0, 0, 0, 0, 0, 0, f"={h.cel(2, r)}+SUM({h.cel(3, r)}:{h.cel(8, r)})",
                c['cierre'], f"={h.cel(9, r)}-{h.cel(10, r)}",
                f'=IF({h.cel(11, r)}=0,"OK","REVISAR")'],
               fmt={9: '#,##0', 10: '#,##0', 11: '#,##0;-#,##0;0'})
        fila_cat[c['cat']] = r
    r1, r2 = fila_cat[cats[0]['cat']], fila_cat[cats[-1]['cat']]
    r_cuadro_tot = h.total('TOTAL cabezas', {c: h.suma(c, r1, r2) for c in range(2, 10)},
                           fmt={c: '#,##0;-#,##0;0' for c in range(2, 10)})
    h.control('cabezas al inicio (cuadro)', h.cel(2, r_cuadro_tot), tot_inicio, '02 Stock hacienda, TOTAL INICIO NZ')
    h.control('cabezas al cierre (cuadro: inicio + movimientos)', h.cel(9, r_cuadro_tot), tot_cierre,
              '02 Stock hacienda, TOTAL CIERRE NZ')

    # control en Python del cuadro de la fuente
    for c in cats:
        if c['inicio'] + sum(c['movs']) != c['cierre']:
            lib.pendiente('Hacienda — cuadro de cabezas', f"{c['cat']}: inicio {c['inicio']} + movimientos "
                          f"{sum(c['movs'])} no da el cierre {c['cierre']} del papel.", 'cabezas', donde)

    # SENASA
    h.blanco()
    h.seccion('1.1 · Informativo — cierre contra lo registrado en SENASA (no interviene en el importe)')
    _enc(h, ['Grupo', 'Nuestro registro', 'SENASA', 'Diferencia', None, None, None, None, 'Qué categorías junta'], {9: 12})
    grupos = [('Hembras (sin terneras al pie)', (0, 1, 2, 5)), ('Machos (sin terneros al pie)', (3, 4, 6))]
    rs = []
    for nom, idx in grupos:
        idx = [i for i in idx if i < len(cats)]
        r = h.r + 1
        _fila(h, [nom, '=' + '+'.join(h.cel(9, fila_cat[cats[i]['cat']]) for i in idx),
                  int(sum(num(cats[i]['senasa']) for i in idx)), f"={h.cel(3, r)}-{h.cel(2, r)}", None, None, None, None,
                  ' + '.join(cats[i]['cat'] for i in idx)], {9: 12},
              fmt={2: '#,##0', 4: '#,##0;-#,##0;0'})
        rs.append(r)
    h.total('Total', {2: h.suma(2, rs[0], rs[-1]), 3: h.suma(3, rs[0], rs[-1]), 4: h.suma(4, rs[0], rs[-1])},
            fmt={2: '#,##0', 3: '#,##0', 4: '#,##0;-#,##0;0'})
    if tot_senasa != tot_cierre:
        lib.pendiente('Hacienda — SENASA', f'SENASA registra {tot_senasa} cabezas al cierre y nuestro registro {tot_cierre} '
                      f'(diferencia {tot_senasa - tot_cierre}). El papel dice que se explica (muerte o nacimiento no '
                      'informado), no se fuerza; la explicación todavía no está escrita.',
                      'cabezas; no cambia el importe mientras se valúe con nuestro registro', donde)

    # ---------- detalle de cada movimiento ----------
    orden = [c['cat'] for c in cats]
    for col, solapa, nombre, signo in MOVS:
        d = detalle[nombre]
        h.blanco()
        h.seccion(f'1.{col - 1} · {nombre} — detalle ({solapa})' + (' — restan en el cuadro' if signo < 0 else ''))
        reales = [f for f in d['filas'] if f['cat']]
        if not reales:
            texto = ' · '.join(f['obs'] for f in d['filas'] if f['obs']) or 'sin movimientos'
            _fila(h, [f'Sin movimientos: {texto}.'], {1: 12})
            rt = h.total(f'Total {nombre.lower()}', {2: '=0'}, fmt={2: '#,##0'}, col_etiqueta=3)
        else:
            _enc(h, ['Fecha', 'Cabezas', 'Categoría en la app', None, None, 'Cliente / proveedor', None, None,
                     'Observación'], {3: 5, 6: 8, 9: 12})
            subt = []
            suma_py = 0
            otras = [c for c in dict.fromkeys(f['cat'] for f in reales) if c not in orden]
            for cat in orden + otras:
                fs = [f for f in reales if f['cat'] == cat]
                if not fs:
                    continue
                a = None
                for f in fs:
                    r = _fila(h, [f['fecha'], f['cab'], f['app'], None, None, f['quien'] or None, None, None,
                                  f['obs'] or None], {3: 5, 6: 8, 9: 12}, fmt={2: '#,##0;-#,##0;0'})
                    a = a or r
                    suma_py += f['cab']
                rsub = h.total(f'Subtotal {nombre.lower()} — {cat}', {2: h.suma(2, a, h.r)},
                               fmt={2: '#,##0;-#,##0;0'}, col_etiqueta=3)
                subt.append(rsub)
                if cat in fila_cat:
                    x = h.celda(col, fila_cat[cat])
                    x.value = ('=-' if signo < 0 else '=') + h.cel(2, rsub)
                    x.number_format = '#,##0;-#,##0;0'
                else:
                    lib.pendiente('Hacienda — movimientos', f'{nombre}: la categoría «{cat}» no está en el cuadro de '
                                  'cabezas; sus movimientos quedan listados pero no suman en el cuadro.', 'cabezas', donde)
            rt = h.total(f'Total {nombre.lower()}', {2: h.suma_de(2, subt)}, fmt={2: '#,##0;-#,##0;0'}, col_etiqueta=3)
            if suma_py != d['total']:
                lib.pendiente('Hacienda — movimientos', f'{nombre}: los renglones suman {suma_py} y el total de la solapa '
                              f'{solapa} dice {d["total"]}.', 'cabezas', donde)
        h.control(f'{nombre.lower()} (cabezas)', h.cel(2, rt), d['total'], f'{solapa}, TOTAL')
        # cada movimiento por categoría contra el cuadro de la fuente
        for i, c in enumerate(cats):
            mio = signo * sum(f['cab'] for f in reales if f['cat'] == c['cat'])
            if mio != c['movs'][col - 3]:
                lib.pendiente('Hacienda — movimientos', f"{nombre} de {c['cat']}: el detalle da {mio} y el cuadro del "
                              f"papel {c['movs'][col - 3]}.", 'cabezas', donde)

    # ---------- (2) valorizado al cierre ----------
    bloques = _bloques_valorizado(ws21)
    if len(bloques) < 3:
        lib.pendiente('Hacienda — valorizado', f'«02.1 Stock valorizado» trae {len(bloques)} bloques; se esperaban 4 '
                      '(cierre e inicio de los papeles, interna de junio 2026 y 2025).', 'no se pudo armar todo', donde)
    cierre = bloques[0]
    h.blanco()
    h.seccion('2 · Valorizado al cierre (30/06/2026) — valuación de los papeles del contador, a precio de cierre')
    h.nota('Cabezas = el cierre del cuadro de arriba (la celda apunta ahí). Lo que se valúa por cabeza no lleva kilos; lo que '
           'se valúa por kilo: kilos × ($ por kg) = valor por cabeza. Precio tomado × factor = $ por kg o por cabeza. '
           'De dónde sale cada precio y cada peso está en la tabla 2.1.')
    refs = []
    for i, f in enumerate(cierre['filas']):
        ok = i < len(cats) and cats[i]['cierre'] == f['cab']
        refs.append(f"={h.cel(9, fila_cat[cats[i]['cat']])}" if ok else None)
        if not ok:
            lib.pendiente('Hacienda — valorizado', f"{f['cat']}: {f['cab']} cabezas en el valorizado no coinciden con la "
                          'categoría del cuadro en la misma posición; se dejó el número del valorizado sin vínculo.',
                          'cabezas', donde)
    sin_valuar = [c for c in cats[len(cierre['filas']):] if c['cierre']]
    for c in sin_valuar:
        lib.pendiente('Hacienda — valorizado', f"{c['cat']}: {c['cierre']} cabezas al cierre sin renglón en el valorizado.",
                      'falta valuar', donde)
    v = _tabla_valorizado(h, cierre, refs)
    h.control('valor bruto a precio de mercado', h.cel(8, v['bruto']), cierre['bruto'],
              '02.1 Stock valorizado, TOTAL HACIENDA (a precio de mercado)', tolerancia=TOLERANCIA_VALOR)
    h.control('valor neto (ítem 7)', h.cel(8, v['neto']), cierre['neto'], '02.1 Stock valorizado, TOTAL NETO — valor del balance',
              tolerancia=TOLERANCIA_VALOR)
    h.control('cabezas valorizadas contra el cierre del cuadro', h.cel(2, v['bruto']), tot_cierre,
              '02 Stock hacienda, TOTAL CIERRE NZ')
    if abs(v['suma_py'] - cierre['bruto']) > 0.01:
        neto_py = v['suma_py'] * 0.9
        lib.pendiente('Hacienda — valorizado', f"Recalculado con los kilos y precios que el papel muestra (cabezas × kilos × "
                      f"$ por kg), el bruto da {v['suma_py']:,.2f} y el papel dice {cierre['bruto']:,.2f} (diferencia "
                      f"{v['suma_py'] - cierre['bruto']:,.2f}); el neto da {neto_py:,.2f} contra {cierre['neto']:,.2f} "
                      f"(diferencia {neto_py - cierre['neto']:,.2f}). Por categoría (nuestro cálculo − papel): " + '; '.join(v['difs'])
                      + '. Causa probable: el papel muestra precios y kilos promedio redondeados y calculó con más decimales. '
                      'No se forzó: el control de la hoja queda en REVISAR.',
                      'centavos/pesos sobre el ítem 7', donde)

    h.blanco()
    h.seccion('2.1 · De dónde sale cada precio y cada peso')
    _enc(h, ['Categoría', 'Precio: mercado, categoría y criterio', None, None, None, None, None,
             'Peso: de dónde sale', None, None, None, None], {2: 7, 8: 12})
    for f in cierre['filas']:
        _fila(h, [f['cat'], f"{f['de_precio']} — criterio: {f['criterio']}", None, None, None, None, None,
                  f['de_peso']], {2: 7, 8: 12})
        if '⚠' in f['de_peso'] or 'estimado' in f['de_peso'].lower():
            lib.pendiente('Hacienda — pesos', f"{f['cat']}: {f['de_peso']}",
                          f"valor de la categoría: {f['valor']:,.2f} (bruto)", donde)

    # dólares (aparte: nunca mezclados con los pesos)
    h.blanco()
    h.seccion('2.2 · El valor neto en dólares (informativo)')
    ra = _fila(h, ['Valor neto en pesos', None, None, None, None, None, None, f"={h.cel(8, v['neto'])}",
                   'viene del TOTAL NETO de la tabla 2'], {9: 12})
    rb = _fila(h, ['Tipo de cambio', None, None, None, None, None, None, float(cierre['tc']), cierre['tc_txt']], {9: 12})
    ru = h.total('Valor neto en US$', {8: f"={h.cel(8, ra)}/{h.cel(8, rb)}"})
    h.control('valor neto en US$', h.cel(8, ru), cierre['usd'], '02.1 Stock valorizado, TOTAL NETO, columna STOCK U$S')

    # ---------- (3) informativo: valuación interna ----------
    interna = next((b for b in bloques[1:] if '2026' in b['titulo'] and 'INTERNA' in b['titulo'].upper()), None)
    if interna:
        h.blanco()
        h.seccion('3 · Informativo — valuación interna a PROMEDIO DE JUNIO 2026 (balance propio; no es la de los papeles)')
        h.nota('Mismas cabezas y kilos; el precio es el promedio de todo junio en los mismos mercados, para que un remate raro '
               'no mueva el resultado. No interviene en el ítem 7: se muestra para explicar por qué el balance propio da otro número.')
        vi = _tabla_valorizado(h, interna, refs if len(interna['filas']) == len(refs) else None)
        h.control('valor neto interno (promedio de junio)', h.cel(8, vi['neto']), interna['neto'],
                  '02.1 Stock valorizado, bloque INTERNA — PROMEDIO DE JUNIO 2026, TOTAL NETO', tolerancia=15)  # el papel trae el valor por cabeza ya redondeado (−10,80)
        rd = _fila(h, ['Papeles − interna', None, None, None, None, None, None,
                       f"={h.cel(8, v['neto'])}-{h.cel(8, vi['neto'])}",
                       'TOTAL NETO de la tabla 2 menos TOTAL NETO de la tabla 3'], {9: 12}, negrita=True)
        bp = None
        try:
            wbp = src.hoja('Balance propio', 'Balance propio', sub='bp')
            for r in range(1, wbp.max_row + 1):
                if _txt(wbp.cell(r, 1).value).lower().startswith('subtotal stock ganadero'):
                    bp = num(wbp.cell(r, 3).value)
        except SystemExit:
            bp = None
        if bp is not None:
            rb2 = _fila(h, ['Balance propio dice', None, None, None, None, None, None, float(bp),
                            f'{src.nombre("Balance propio", "bp")} → «Balance propio», Subtotal Stock ganadero, cierre'], {9: 12})
            _fila(h, ['Balance propio − interna', None, None, None, None, None, None,
                      f"={h.cel(8, rb2)}-{h.cel(8, vi['neto'])}",
                      'tendría que dar 0: los dos dicen ser el promedio de junio'], {9: 12})
            if abs(bp - interna['neto']) > 1:
                lib.pendiente('Hacienda — valuación interna', f"El balance propio muestra {bp:,.2f} de stock ganadero y el "
                              f"bloque interno del papel de Stocks {interna['neto']:,.2f}: diferencia "
                              f"{bp - interna['neto']:,.2f}. La diferencia está en la recría (la hoja «Hacienda promedio junio» "
                              'del mismo balance propio suma el número del papel de Stocks). No se pudo determinar cuál es el bueno.',
                              'sólo el balance propio; no toca el ítem 7', donde)
        if abs(vi['suma_py'] * 0.9 - interna['neto']) > 1:
            lib.pendiente('Hacienda — valuación interna', f"Los renglones internos dan neto {vi['suma_py'] * 0.9:,.2f} y el "
                          f"papel {interna['neto']:,.2f} (diferencia {vi['suma_py'] * 0.9 - interna['neto']:,.2f}; el papel "
                          'trae el valor por cabeza ya redondeado). Por categoría, en bruto: ' + '; '.join(vi['difs']) + '.',
                          'sólo el bloque informativo', donde)

    # ---------- (4) informativo: el inicio ----------
    ini = bloques[1] if len(bloques) > 1 else None
    h.blanco()
    h.seccion('4 · Informativo — el valor del INICIO (30/06/2025), tres lecturas')
    _enc(h, ['Lectura', None, None, None, None, None, None, 'Importe $', 'De dónde sale'], {1: 7, 9: 12})
    lecturas = []
    for r in range(1, ws21.max_row + 1):
        if _txt(ws21.cell(r, 1).value).startswith('LOS TRES VALORES DEL INICIO'):
            k = r + 1
            while ws21.cell(k, 1).value is not None:
                lecturas.append((_txt(ws21.cell(k, 1).value), num(ws21.cell(k, 6).value)))
                k += 1
    for t, imp in lecturas:
        _fila(h, [t.split(' — ')[0].split(' (')[0], None, None, None, None, None, None, float(imp), t], {1: 7, 9: 12})
    if ini:
        _fila(h, ['Cabezas al inicio', None, None, None, None, None, None, ini['cabezas'],
                  f"a precio de mercado del 30/06/2025: bruto {ini['bruto']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
                  + ' menos 10 %'], {1: 7, 9: 12}, fmt={8: '#,##0'})
    h.nota('El balance del contador 24/25 tiene un solo renglón, «Vacas de cría» 255.479.054,90, sin apertura por categoría: '
           'no es comparable categoría por categoría con este cierre.')

    lib.item('7', 'Hacienda', h, h.cel(8, v['neto']), GRUPO,
             f"{tot_cierre} cabezas a precio de cierre (bruto {cierre['bruto']:,.2f}) menos 10 % de comercialización"
             .replace(',', 'X').replace('.', ',').replace('X', '.'),
             255479054.90)
