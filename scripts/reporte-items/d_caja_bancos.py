# -*- coding: utf-8 -*-
"""Detalle 5 — Caja y bancos (ítem 5): una sección por cuenta, con su cadena de saldos.

Fuentes (sólo lectura): Saldos → «07 Bancos» y «07.1 Cadena de saldos»; Balance en línea →
«F · Caja y bancos», «F · FCI» y «F · Balance en linea»; Templates → «H · MSA · Inversiones» (los
movimientos del fondo, uno por uno); Balance propio (cajas de la app al cierre).
"""
import datetime

from core import num

GRUPO = 'B · Patrimonio al cierre (30/06/2026)'
HOJA = 'D5 Caja y bancos'
ANCHOS = [46, 12, 12, 9, 18, 18, 15, 11]          # 141 (horizontal)
F6 = '#,##0.000000'
C_IMP = 5                                         # columna del importe


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


def _fila_de(ws, etiqueta, col=1, desde=1):
    """Primer renglón cuya columna `col` empieza con `etiqueta` (sin espacios ni mayúsculas)."""
    e = etiqueta.lower()
    for r in range(desde, ws.max_row + 1):
        if _txt(ws.cell(r, col).value).lower().startswith(e):
            return r
    raise SystemExit(f'No encuentro «{etiqueta}» en la hoja «{ws.title}»')


def _dm(d):
    return d.strftime('%d/%m/%Y') if d else 's/d'


def _pesos(x):
    s = f'{abs(x):,.2f}'.replace(',', '#').replace('.', ',').replace('#', '.')
    return ('−' if x < 0 else '') + s


ENC = ['Concepto', 'Desde', 'Hasta', 'Movim.', 'Importe $', 'Según la fuente', 'Diferencia', 'Control']


def construir(lib, src):
    h = lib.hoja(HOJA, ANCHOS, horizontal=True)
    f_sal = src.nombre('Saldos')
    f_bl = src.nombre('Balance en l')
    f_tpl = src.nombre('Templates')
    w_ban = src.hoja('Saldos', '07 Bancos')
    w_cad = src.hoja('Saldos', '07.1 Cadena de saldos')
    w_fcb = src.hoja('Balance en l', 'Caja y bancos')
    w_fci = src.hoja('Balance en l', 'FCI')
    w_bl = src.hoja('Balance en l', 'Balance en linea')
    w_inv = src.hoja('Templates', 'H · MSA · Inversiones')
    w_bp = src.hoja('Balance propio', 'Balance propio', sub='bp')

    # ── lectura de las fuentes ──────────────────────────────────────────────────────────────
    def bl(denominacion):
        """(apertura del contador en positivo, cierre de la app) del Balance en línea."""
        r = _fila_de(w_bl, denominacion, col=3)
        return abs(num(w_bl.cell(r, 4).value)), num(w_bl.cell(r, 5).value)

    def cadena(cuenta):
        r = _fila_de(w_cad, cuenta)
        v = lambda c: w_cad.cell(r, c).value
        return dict(inicio=num(v(2)), no_cargado=num(v(3)), cargado=num(v(5)), calculado=num(v(6)),
                    extracto=num(v(7)), dif=num(v(8)), desde=_fch(v(9)), hasta=_fch(v(10)), mov=int(num(v(11))))

    def respaldo(cuenta):
        r = _fila_de(w_ban, cuenta)
        return _txt(w_ban.cell(r, 5).value)

    def origen_inicio(cuenta):
        try:
            return _txt(w_cad.cell(_fila_de(w_cad, f'Saldo al inicio de {cuenta}'), 1).value)
        except SystemExit:
            return ''

    ap_caja, ci_caja = bl('Caja (cash)')
    ap_cusd, ci_cusd = bl('CAJA DOLARES')
    ap_san, ci_san = bl('Banco Santander')
    ap_pro, ci_pro = bl('Banco de la Provincia')
    ap_fci, ci_fci = bl('Fondo comun de Inversi')
    ap_gal, ci_gal = bl('Banco Galicia')
    ap_gus, ci_gus = bl('Banco Galicia cta. USD')

    h.titulo('Detalle 5 — Caja y bancos (ítem 5)')
    h.nota(f'Fuente: {f_sal} → «07 Bancos» y «07.1 Cadena de saldos»; {f_bl} → «F · Caja y bancos», «F · FCI» y '
           f'«F · Balance en linea»; {f_tpl} → «H · MSA · Inversiones». Una sección por cuenta: saldo al inicio + '
           'movimientos del ejercicio = saldo al cierre, y al lado el control contra el saldo del extracto o de la app. '
           'Las fuentes traen el NETO de los movimientos de cada cuenta (no débitos y créditos ni el corte por mes); el '
           'fondo común sí va movimiento por movimiento. Al final, el resumen con el Total ítem 5.')
    h.blanco()

    totales = {}      # sub-ítem → renglón de su total (columna Importe $)

    def bloque(cod, titulo, inicio_txt, inicio, partes, etiqueta_total, valor_fuente, fuente_txt, notas=(), clave=True,
               enc=ENC):
        """inicio + partes (texto, desde, hasta, movim, importe) = total; control contra la fuente."""
        h.seccion(f'{cod} · {titulo}')
        h.encabezado(enc, repetir=True)
        r1 = h.fila([inicio_txt, None, None, None, float(inicio)])
        r2 = r1
        for (t, d, ha, m, imp) in partes:
            r2 = h.fila([t, d, ha, m, float(imp)])
        rt = h.total(etiqueta_total, {C_IMP: h.suma(C_IMP, r1, r2)}, clave=clave)
        calc = inicio + sum(p[4] for p in partes)
        h.control(f'{cod} {titulo}: saldo al cierre', h.cel(C_IMP, rt), valor_fuente, fuente_txt)
        for n in notas:
            if n:
                h.nota(n)
        h.blanco()
        return rt, calc

    # ── 5a · Caja ───────────────────────────────────────────────────────────────────────────
    cg, ca, cs = cadena('CAJA GENERAL'), cadena('CAJA AMS'), cadena('CAJA SIGOT')
    rt, calc = bloque(
        '5a', 'Caja en pesos — como la lleva el Balance en línea',
        'Apertura del contador al 30/06/2025 (una sola caja)', ap_caja,
        [(f'Movimientos del ejercicio — Caja General ({cg["mov"]} movimientos cargados)', None, None, cg['mov'], cg['cargado']),
         (f'Movimientos del ejercicio — Caja AMS ({ca["mov"]} movimientos cargados)', None, None, ca['mov'], ca['cargado']),
         (f'Movimientos del ejercicio — Caja Sigot ({cs["mov"]} movimientos cargados)', cs['desde'], cs['hasta'], cs['mov'], cs['cargado'])],
        'Total 5a — Caja al cierre', ci_caja, 'Balance en línea → «Caja (cash)», Cierre (la app)',
        notas=['Cómo se lee: es la apertura del contador más lo que movieron las tres cajas en la app. No hay un saldo único '
               'de caja en la app para comparar: la planilla de JMS arrancaba la caja en $ ' + _pesos(cg['inicio']) +
               ' (no en los $ ' + _pesos(ap_caja) + ' del contador). Abajo, las mismas cajas según la app (informativo: NO suma al ítem).'])
    totales['5a'] = rt
    if abs(calc - ci_caja) > 0.01:
        lib.pendiente('Caja', f'Apertura + movimientos de las cajas da {_pesos(calc)} y el Balance en línea pone {_pesos(ci_caja)}.',
                      _pesos(calc - ci_caja), HOJA)

    cajas_app = []
    for n, (nombre, c) in enumerate([('Caja General', cg), ('Caja AMS', ca), ('Caja Sigot', cs)], 1):
        clave_src = nombre.upper()
        _, calc = bloque(
            f'5a.{n}', f'{nombre} según la app — cadena de saldos (informativo, no suma al ítem)',
            'Saldo al inicio (30/06/2025) según la app', c['inicio'],
            [('Movimientos anteriores al primero cargado (los deduce la app)', None, None, None, c['no_cargado']),
             ('Movimientos cargados del ejercicio (neto)', c['desde'], c['hasta'], c['mov'], c['cargado'])],
            f'Saldo al cierre calculado — {nombre}', c['extracto'], f'«07.1 Cadena de saldos» → saldo de la app, {nombre}',
            notas=[origen_inicio(clave_src), 'Respaldo del saldo al cierre: ' + respaldo(clave_src)], clave=False)
        cajas_app.append((nombre, c))
        if abs(calc - c['extracto']) > 0.01:
            aviso = ''
            try:
                aviso = _txt(w_cad.cell(_fila_de(w_cad, clave_src + ':'), 1).value)
            except SystemExit:
                pass
            lib.pendiente(f'{nombre}: la cadena no cierra',
                          f'Inicio {_pesos(c["inicio"])} + no cargado {_pesos(c["no_cargado"])} + cargado {_pesos(c["cargado"])} = '
                          f'{_pesos(calc)}; la app dice {_pesos(c["extracto"])}. ' + (f'La fuente avisa: «{aviso}».' if aviso else
                          'La fuente no lo marca como diferencia.'), _pesos(calc - c['extracto']), HOJA)
        if '🟡' in respaldo(clave_src):
            lib.pendiente(f'{nombre}: respaldo del saldo', respaldo(clave_src).replace('🟡 ', ''), '', HOJA)

    h.seccion('5a (otra lectura) · Las cajas de la app al cierre — informativo, no suma al ítem')
    h.encabezado(['Caja', 'Último mov.', '', '', 'Saldo de la app $', 'Según la fuente', 'Diferencia', 'Control'])
    r1 = r2 = None
    for nombre, c in cajas_app:
        r2 = h.fila([nombre, c['hasta'], None, None, float(c['extracto'])])
        r1 = r1 or r2
    rt = h.total('Cajas de la app al cierre', {C_IMP: h.suma(C_IMP, r1, r2)})
    r_bp = _fila_de(w_bp, 'Concepto')
    while _txt(w_bp.cell(r_bp, 1).value) != 'Caja':
        r_bp += 1
    bp_caja = num(w_bp.cell(r_bp, 3).value)
    h.control('Cajas de la app al cierre', h.cel(C_IMP, rt), bp_caja, 'Balance propio → «Caja», $ 2026')
    h.blanco()
    app_cajas = sum(c['extracto'] for _, c in cajas_app)
    lib.pendiente('Caja: falta definir qué número va',
                  f'El Balance en línea cierra la caja en {_pesos(ci_caja)} (apertura del contador {_pesos(ap_caja)} + movimientos); '
                  f'las cajas de la app cierran en {_pesos(app_cajas)} (así la toma el Balance propio), partiendo de la planilla de '
                  f'JMS ({_pesos(cg["inicio"])}).', _pesos(ci_caja - app_cajas), HOJA)

    # ── 5b · Caja dólares ───────────────────────────────────────────────────────────────────
    r_cu = _fila_de(w_ban, 'MSA Caja USD')
    estado_cu = _txt(w_ban.cell(r_cu, 2).value)
    resp_cu = _txt(w_ban.cell(r_cu, 7).value)
    rt, _ = bloque('5b', 'Caja dólares (expresada en pesos, como en el balance del contador)',
                   'Apertura del contador al 30/06/2025', ap_cusd,
                   [(f'Movimientos del ejercicio — la app dice: «{estado_cu}»', None, None, 0, 0.0)],
                   'Total 5b — Caja dólares al cierre', ci_cusd, 'Balance en línea → «CAJA DOLARES», Cierre (la app)',
                   notas=['Queda la apertura porque no hay nada cargado. La fuente no dice cuántos dólares son ni a qué tipo de '
                          'cambio: por eso no se muestra en US$. ' + resp_cu])
    totales['5b'] = rt
    lib.pendiente('Caja dólares sin movimientos cargados',
                  f'{resp_cu.replace("🔴 ", "")}. El cierre repite la apertura del contador ({_pesos(ap_cusd)}); no se sabe '
                  'cuántos US$ son ni si siguen estando.', _pesos(ci_cusd), HOJA)

    # ── 5c, 5d, 5e · bancos en pesos ────────────────────────────────────────────────────────
    for cod, nombre, clave_src, ap, ci in [('5c', 'Banco Santander cta. cte.', 'BANCO SANTANDER', ap_san, ci_san),
                                           ('5d', 'Banco Provincia cta. cte.', 'BANCO PROVINCIA', ap_pro, ci_pro),
                                           ('5e', 'Banco Galicia cta. cte. en pesos', 'BANCO GALICIA', ap_gal, ci_gal)]:
        c = cadena(clave_src)
        rt, calc = bloque(cod, nombre, 'Saldo al inicio (30/06/2025)', c['inicio'],
                          [('Movimientos anteriores al primero cargado (los deduce la app)', None, None, None, c['no_cargado']),
                           (f'Movimientos del ejercicio (neto de {c["mov"]} movimientos del extracto)', c['desde'], c['hasta'],
                            c['mov'], c['cargado'])],
                          f'Total {cod} — {nombre} al cierre', c['extracto'], '«07.1 Cadena de saldos» → saldo del extracto',
                          notas=[origen_inicio(clave_src), 'Respaldo del saldo al cierre: ' + respaldo(clave_src)])
        totales[cod] = rt
        if abs(calc - c['extracto']) > 0.01 or abs(c['extracto'] - ci) > 0.01:
            lib.pendiente(f'{nombre}: no cierra', f'Cadena {_pesos(calc)} · extracto {_pesos(c["extracto"])} · Balance en línea '
                          f'{_pesos(ci)}.', _pesos(calc - c['extracto']), HOJA)
        if abs(c['inicio'] - ap) > 0.01:
            lib.pendiente(f'{nombre}: el inicio no es la apertura del contador',
                          f'La app arranca en {_pesos(c["inicio"])} y el contador cerró 24/25 en {_pesos(ap)}.',
                          _pesos(c['inicio'] - ap), HOJA)

    # ── 5f · Fondo común de inversión ───────────────────────────────────────────────────────
    r_enc = _fila_de(w_fci, 'Cuotapartes', col=2)
    r_in, r_su, r_re = (_fila_de(w_fci, e, desde=r_enc) for e in ('Inicio', 'Suscripciones', 'Rescates'))
    r_ci, r_rs = _fila_de(w_fci, 'Cierre', desde=r_enc), _fila_de(w_fci, 'Resultado', desde=r_enc)
    q0, p0, v0 = num(w_fci.cell(r_in, 2).value), num(w_fci.cell(r_in, 3).value), num(w_fci.cell(r_in, 4).value)
    q1, p1, v1 = num(w_fci.cell(r_ci, 2).value), num(w_fci.cell(r_ci, 3).value), num(w_fci.cell(r_ci, 4).value)
    susc_f, resc_f = num(w_fci.cell(r_su, 4).value), num(w_fci.cell(r_re, 4).value)
    result_f = num(w_fci.cell(r_rs, 4).value)
    aviso_fci = _txt(w_fci.cell(r_rs, 5).value)

    # los movimientos del fondo, del extracto Galicia (Templates → Inversiones, líneas «FCI — …»)
    r_res = None
    for r in range(1, w_inv.max_row + 1):
        if _txt(w_inv.cell(r, 2).value).upper().startswith('FCI'):
            r_res = r
            break
    if r_res is None:
        raise SystemExit('No encuentro la línea «FCI» en el resumen de «H · MSA · Inversiones»')
    nro_fci = w_inv.cell(r_res, 1).value
    r_det = _fila_de(w_inv, 'DETALLE')
    suscripciones, rescates = [], []
    for r in range(r_det + 2, w_inv.max_row + 1):
        if w_inv.cell(r, 1).value != nro_fci or _fch(w_inv.cell(r, 3).value) is None:
            continue
        v = lambda c: w_inv.cell(r, c).value
        texto = ' · '.join(x for x in [_txt(v(4)), _txt(v(8)), _txt(v(5)), 'estado: ' + _txt(v(9))] if x)
        deb, cre = num(v(10)), num(v(11))
        if deb:
            suscripciones.append((_fch(v(3)), texto, deb))
        if cre:
            rescates.append((_fch(v(3)), texto, -cre))
    s_susc = sum(x[2] for x in suscripciones)
    s_resc = -sum(x[2] for x in rescates)

    h.seccion('5f · Fondo común de inversión — FIMA Premium A (Galicia)')
    h.encabezado(['Concepto', 'Cuotapartes', 'Valor de la cuotaparte', 'Movim.', 'Importe $', 'Según la fuente', 'Diferencia',
                  'Control'], repetir=True)
    producto_ok = abs(q0 * p0 - v0) <= 0.01
    ri = h.fila(['Saldo al inicio (30/06/2025): cuotapartes × valor de la cuotaparte', float(q0), float(p0), None,
                 f'={h.cel(2, h.r + 1)}*{h.cel(3, h.r + 1)}' if producto_ok else float(v0)], fmt={3: F6})
    r_s = h.fila(['Más: suscripciones del ejercicio (plata que salió de la cuenta Galicia al fondo) — detalle abajo', None, None,
                  len(suscripciones), '=0'])
    r_r = h.fila(['Menos: rescates del ejercicio (plata que volvió del fondo a la cuenta Galicia) — detalle abajo', None, None,
                  len(rescates), '=0'])
    r_g = h.fila(['Más: resultado del fondo (lo deduce la app: cierre − inicio − suscripciones + rescates)', None, None, None,
                  float(result_f)])
    rt_fci = h.total('Total 5f — Fondo común de inversión al cierre', {C_IMP: h.suma(C_IMP, ri, r_g)}, clave=True)
    totales['5f'] = rt_fci
    h.control('5f Fondo común: saldo al cierre', h.cel(C_IMP, rt_fci), v1,
              f'«F · FCI» → cierre: {q1:,.2f} cuotapartes × {p1:,.4f}'.replace(',', '#').replace('.', ',').replace('#', '.'))
    h.control('5f Fondo común: saldo al inicio contra el balance del contador 24/25', h.cel(C_IMP, ri), ap_fci,
              'Balance en línea → «Fondo comun de Inversión», Apertura (contador)')
    h.nota('Cuotapartes y valor: ' + _txt(w_fci.cell(r_in, 5).value) + ' · Cierre: ' + _txt(w_fci.cell(r_ci, 5).value) +
           '. El fondo se rescató entero: al 30/06/2026 quedan 0 cuotapartes.')
    if aviso_fci:
        h.nota('Sobre el resultado: ' + aviso_fci)
        lib.pendiente('Fondo común: resultado deducido', aviso_fci.replace('⚠️ ', ''), _pesos(result_f), HOJA)
    if not producto_ok:
        lib.pendiente('Fondo común: inicio', f'Cuotapartes × valor da {_pesos(q0 * p0)} y la fuente valoriza {_pesos(v0)}.',
                      _pesos(q0 * p0 - v0), HOJA)
    h.blanco()

    enc_mov = ['Movimiento del extracto Galicia (concepto · detalle · cuenta · estado)', 'Fecha', '', '', 'Importe $',
               'Según la fuente', 'Diferencia', 'Control']
    h.seccion(f'5f · Suscripciones del ejercicio — {len(suscripciones)} movimientos')
    h.encabezado(enc_mov)
    r1 = r2 = None
    for f, t, imp in suscripciones:
        r2 = h.fila([t, f, None, None, float(imp)])
        r1 = r1 or r2
    rs_tot = h.total('Total suscripciones', {C_IMP: h.suma(C_IMP, r1, r2) if r1 else '=0'})
    h.control('5f Suscripciones del fondo', h.cel(C_IMP, rs_tot), susc_f, '«F · FCI» → Suscripciones del ejercicio (banco)')
    h.blanco()
    h.seccion(f'5f · Rescates del ejercicio — {len(rescates)} movimientos (en negativo: bajan el fondo)')
    h.encabezado(enc_mov)
    r1 = r2 = None
    for f, t, imp in rescates:
        r2 = h.fila([t, f, None, None, float(imp)])
        r1 = r1 or r2
    rr_tot = h.total('Total rescates', {C_IMP: h.suma(C_IMP, r1, r2) if r1 else '=0'})
    h.control('5f Rescates del fondo', h.cel(C_IMP, rr_tot), -resc_f, '«F · FCI» → Rescates del ejercicio (banco), en negativo')
    h.blanco()
    h.celda(C_IMP, r_s).value = f'={h.cel(C_IMP, rs_tot)}'
    h.celda(C_IMP, r_r).value = f'={h.cel(C_IMP, rr_tot)}'
    if abs(s_susc - susc_f) > 0.01 or abs(s_resc - resc_f) > 0.01:
        lib.pendiente('Fondo común: los movimientos listados no dan el total de la fuente',
                      f'Suscripciones listadas {_pesos(s_susc)} (fuente {_pesos(susc_f)}); rescates listados {_pesos(s_resc)} '
                      f'(fuente {_pesos(resc_f)}).', _pesos((s_susc - susc_f) - (s_resc - resc_f)), HOJA)
    cierre_fci = v0 + s_susc - s_resc + result_f
    if abs(cierre_fci - v1) > 0.01:
        lib.pendiente('Fondo común: el cierre no da', f'Inicio + suscripciones − rescates + resultado = {_pesos(cierre_fci)}; '
                      f'la fuente dice {_pesos(v1)}.', _pesos(cierre_fci - v1), HOJA)

    # ── 5g · Banco Galicia en dólares ───────────────────────────────────────────────────────
    r_us = _fila_de(w_fcb, 'MSA Cuenta Corriente USD')
    v = lambda c: w_fcb.cell(r_us, c).value
    us_ini, us_mov, us_cie = num(v(2)), num(v(5)), num(v(7))
    us_d, us_h = _fch(v(3)), _fch(v(4))
    r_ub = _fila_de(w_ban, 'MSA Cuenta Corriente USD')
    tc = num(w_ban.cell(r_ub, 5).value)
    us_pesos = num(w_ban.cell(r_ub, 6).value)
    nota_tc = _txt(w_ban.cell(_fila_de(w_ban, 'TC al cierre:'), 1).value)
    h.seccion('5g · Banco Galicia cuenta en dólares — en US$')
    h.encabezado(['Concepto', 'Desde', 'Hasta', 'Movim.', 'Importe US$', 'Según la fuente', 'Diferencia', 'Control'], repetir=True)
    r1 = h.fila(['Saldo al inicio (30/06/2025), en US$', None, None, None, float(us_ini)])
    r2 = h.fila(['Movimientos del ejercicio (neto), en US$', us_d, us_h, None, float(us_mov)])
    ru = h.total('Saldo al cierre en US$', {C_IMP: h.suma(C_IMP, r1, r2)})
    h.control('5g Galicia US$: saldo al cierre en dólares', h.cel(C_IMP, ru), us_cie,
              '«F · Caja y bancos» → saldo de la app al cierre US$')
    h.blanco()
    h.seccion('5g · Banco Galicia cuenta en dólares — pasado a pesos')
    h.encabezado(['Concepto', 'US$', 'Tipo de cambio', '', 'Importe $', 'Según la fuente', 'Diferencia', 'Control'])
    rp = h.total('Total 5g — Banco Galicia US$ al cierre, en pesos (US$ × tipo de cambio)',
                 {2: f'={h.cel(C_IMP, ru)}', 3: float(tc), C_IMP: f'={h.cel(2, h.r + 1)}*{h.cel(3, h.r + 1)}'}, clave=True)
    totales['5g'] = rp
    h.control('5g Galicia US$: saldo al cierre en pesos', h.cel(C_IMP, rp), ci_gus,
              'Balance en línea → «Banco Galicia cta. USD», Cierre (la app)')
    tc_ap = ap_gus / us_ini if us_ini else 0
    h.nota(nota_tc + ' Respaldo del saldo: ' + _txt(w_ban.cell(r_ub, 7).value) + '. La apertura del contador era $ ' +
           _pesos(ap_gus) + f' por US$ {_pesos(us_ini)} (da un dólar de {_pesos(tc_ap)}). Las fuentes no traen los movimientos '
           'de esta cuenta uno por uno, sólo el neto.')
    h.blanco()
    if abs(us_ini + us_mov - us_cie) > 0.01 or abs(us_cie * tc - ci_gus) > 0.01 or abs(us_pesos - ci_gus) > 0.01:
        lib.pendiente('Galicia US$: no cierra', f'US$ {_pesos(us_ini + us_mov)} calculado vs {_pesos(us_cie)}; en pesos '
                      f'{_pesos(us_cie * tc)} vs {_pesos(ci_gus)}.', _pesos(us_cie * tc - ci_gus), HOJA)

    # ── Resumen y Total ítem 5 ──────────────────────────────────────────────────────────────
    filas = [('5a', 'Caja', ap_caja, ci_caja), ('5b', 'Caja dólares', ap_cusd, ci_cusd),
             ('5c', 'Banco Santander cta. cte.', ap_san, ci_san), ('5d', 'Banco Provincia cta. cte.', ap_pro, ci_pro),
             ('5e', 'Banco Galicia cta. cte.', ap_gal, ci_gal), ('5f', 'Fondo común de inversión', ap_fci, ci_fci),
             ('5g', 'Banco Galicia cuenta en dólares (en pesos)', ap_gus, ci_gus)]
    h.seccion('Resumen del ítem 5 — cada cuenta trae el total de su sección de arriba')
    h.encabezado(['Cuenta', '', '', '', 'Saldo al cierre 30/06/2026 $', 'Balance del contador 30/06/2025 $', 'Variación $', ''])
    r1 = r2 = None
    for cod, nombre, ap, ci in filas:
        r2 = h.fila([f'{cod} · {nombre}', None, None, None, f'={h.cel(C_IMP, totales[cod])}', float(ap),
                     f'={h.cel(C_IMP, h.r + 1)}-{h.cel(6, h.r + 1)}'])
        r1 = r1 or r2
    rt5 = h.total('Total ítem 5 — Caja y bancos', {C_IMP: h.suma(C_IMP, r1, r2), 6: h.suma(6, r1, r2), 7: h.suma(7, r1, r2)},
                  clave=True)
    tot_bl = sum(f[3] for f in filas)
    h.control('Total ítem 5 contra el Balance en línea', h.cel(C_IMP, rt5), tot_bl,
              'Balance en línea → suma del Cierre (la app) de las 7 cuentas')
    h.nota('El Balance propio muestra este rubro con otro armado (cajas de la app, sin la cuenta en dólares, y con dos renglones '
           'de flujo del año: dólar MEP comprado y distribución de fondos): su subtotal no es comparable con este total.')

    comp = {'5a': 'Apertura del contador + movimientos de las tres cajas en la app',
            '5b': 'Apertura del contador: sin movimientos cargados',
            '5c': 'Saldo al inicio + movimientos del extracto', '5d': 'Saldo al inicio + movimientos del extracto',
            '5e': 'Saldo al inicio + movimientos del extracto',
            '5f': 'Cuotapartes × valor al inicio + suscripciones − rescates + resultado',
            '5g': 'US$ al cierre × dólar BNA divisas comprador del 30/06/2026'}
    lib.item('5', 'Caja y bancos', h, h.cel(C_IMP, rt5), GRUPO, 'Suma de 5a a 5g', sum(f[2] for f in filas))
    for cod, nombre, ap, ci in filas:
        lib.item(cod, nombre, h, h.cel(C_IMP, totales[cod]), GRUPO, comp[cod], ap)

    lib.pendiente('Bancos: el detalle movimiento por movimiento no está en los libros exportados',
                  'Santander, Provincia, Galicia en pesos y Galicia en dólares van con el neto del ejercicio (la fuente no trae '
                  'débitos y créditos ni el corte por mes). El último nivel —cada movimiento del extracto— queda en la app.',
                  '', HOJA)
