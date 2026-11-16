# -*- coding: utf-8 -*-
"""Detalle 5 — Caja y bancos (ítem 5), versión 2: «como se envió» + Anexo A (Caja).

Regla de JMS (15/11): cuando lo de hoy difiere de lo que YA SE ENVIÓ al contador, la tabla principal va como se
envió, con su total sin cambiar; lo nuevo va DEBAJO, en una tabla anexa con su subtotal y el NUEVO TOTAL.

Fuentes (sólo lectura): Saldos → «07 Bancos» y «07.1 Cadena de saldos»; Balance en línea → «F · Caja y bancos»,
«F · FCI» y «F · Balance en linea»; Templates → «H · MSA · Inversiones»; Balance propio. Fuera de la carpeta de
fuentes: lo enviado («- Bancos y Saldos.xlsx») y la planilla de cajas de AMS («- CAJA 25-26.xlsx»), en la carpeta
«- Enviados» (variable de entorno REPORTE_ENVIADOS para cambiarla). Si no están, se usan los valores leídos y
verificados el 15/11/2026 y se avisa en la hoja.
"""
import datetime
import os

import openpyxl
from openpyxl.styles import Alignment

from core import num

GRUPO = 'B · Patrimonio al cierre (30/06/2026)'
HOJA = 'D5 Caja y bancos'
ANCHOS = [40, 16, 16, 16, 18, 18, 15, 11]         # 150 (horizontal)
F6 = '#,##0.000000'
C_IMP = 5                                         # columna del importe
ENC = ['Concepto', 'Desde', 'Hasta', 'Movim.', 'Importe $', 'Según la fuente', 'Diferencia', 'Control']

DIR_ENVIADOS = os.environ.get('REPORTE_ENVIADOS') or (
    r'D:\Users\josem\Documents\Jose\Automatizarr\Claude\Control-Presupuestario-v1.1'
    r'\- Comunicacion JMS Claude - Archivos\Balance\- Enviados')
F_ENVIADO = os.path.join('2026', 'Enviar', '- Bancos y Saldos.xlsx')
F_CAJAS = '- CAJA 25-26.xlsx'

# Lo ENVIADO al contador («- Bancos y Saldos.xlsx» → «07 Bancos»), leído el 15/11/2026: (inicio, cierre)
ENVIADO = {'BANCO GALICIA': (832605.05, -2261369.97), 'BANCO SANTANDER': (7204.86, 208814.82),
           'BANCO PROVINCIA': (15298.25, -179053.43), 'TOTAL EN PESOS': (855108.16, -2231608.58)}
# Planilla de cajas de AMS, leída el 15/11/2026: (saldo 30/06/2025, entradas, salidas, saldo 30/06/2026, movimientos)
CAJAS_150 = {'Caja General': (40000.0, 64274293.0, 64314293.0, 0.0, 114),
             'Caja AMS': (110550.92, 9682293.0, 9595503.24, 197340.68, 135),
             'Caja Sigot': (306662.0, 24430000.0, 24316669.0, 430873.0, 192)}
CAJA_PLANILLA_CIERRE = 628213.68                  # General 0 + AMS 197.340,68 + Sigot 430.873,00
CAJA_PLANILLA_INICIO = 457212.92                  # 40.000 + 306.662 + 110.550,92
# Puente de la caja (informe del 15/11/2026 sobre la planilla y el extracto Galicia, § 1)
PUENTE = [
    ('Más: extracciones del Banco Galicia cta. cte. a la caja (48 movimientos del extracto)', 29036135.56),
    ('Más: cobros en efectivo sin factura (vaca de descarte 04/05/26 2.094.493; chatarra 11/05/26 1.500.000 + 740.000)', 4334493.00),
    ('Más: pase desde la caja en dólares (US$ 21.400 × 1.470), 17/01/26', 31752000.00),
    ('Menos: distribución a socios en efectivo, 17/01/26 (cuatro de 6.468.000 y una de 5.880.000)', -31752000.00),
    ('Menos: sueldos y jornales pagados en efectivo por Caja Sigot', -20925831.00),
    ('Menos: gastos de MA pagados por Caja Sigot (albañil, pintor, almacén)', -2535900.00),
    ('Menos: gastos varios de Caja Sigot (nafta, gomería, ferretería…)', -854938.00),
    ('Menos: Caja AMS, por cuenta de socios (ITGB sucesión, consumos del chalet, monotributo AMS)', -5350622.47),
    ('Menos: Caja AMS, gastos de la empresa (materiales de ganadería, fletes, varios)', -3844880.77),
    ('Más: entradas a Caja Sigot / Caja AMS que no cruzan con el banco (sin identificar)', 301664.44),
]
PUENTE_DIF_PLANILLA = 10880.00                    # dos renglones «Ret 1» de Caja Sigot fuera de su saldo


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


def _leer_enviado():
    """Lo enviado al contador, del archivo; None si no está."""
    ruta = os.path.join(DIR_ENVIADOS, F_ENVIADO)
    if not os.path.exists(ruta):
        return None
    ws = openpyxl.load_workbook(ruta, data_only=True)['07 Bancos']
    out = {}
    for k in ENVIADO:
        r = _fila_de(ws, k)
        out[k] = (num(ws.cell(r, 4).value), num(ws.cell(r, 2).value))
    return out


def _leer_cajas():
    """Planilla de cajas de AMS: por caja (saldo 30/06/2025, entradas, salidas, saldo 30/06/2026, movimientos)."""
    ruta = os.path.join(DIR_ENVIADOS, F_CAJAS)
    if not os.path.exists(ruta):
        return None
    wb = openpyxl.load_workbook(ruta, data_only=True)
    d0, d1 = datetime.datetime(2025, 7, 1), datetime.datetime(2026, 6, 30, 23, 59)
    out = {}
    for nombre, solapa, c_sal, c_ent, c_saldo in (('Caja General', 'CAJA gral', 4, 5, 6), ('Caja AMS', 'Caja Andres', 6, 7, 8),
                                                 ('Caja Sigot', 'Caja Sigot', 5, 6, 7)):
        ws = wb[solapa]
        ini = fin = None
        ent = sal = 0.0
        n = 0
        for r in range(2, ws.max_row + 1):
            d = ws.cell(r, 1).value
            if not isinstance(d, datetime.datetime):
                continue
            sd = ws.cell(r, c_saldo).value
            if d < d0:
                if isinstance(sd, (int, float)):
                    ini = float(sd)
                continue
            if d > d1:
                continue
            n += 1
            ent += num(ws.cell(r, c_ent).value)
            sal += num(ws.cell(r, c_sal).value)
            if isinstance(sd, (int, float)):
                fin = float(sd)
        if ini is None or fin is None:
            return None
        out[nombre] = (round(ini, 2), round(ent, 2), round(sal, 2), round(fin, 2), n)
    return out


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
        return _txt(w_ban.cell(_fila_de(w_ban, cuenta), 5).value)

    def origen_inicio(cuenta):
        try:
            return _txt(w_cad.cell(_fila_de(w_cad, f'Saldo al inicio de {cuenta}'), 1).value)
        except SystemExit:
            return ''

    ap_caja, ci_caja_bl = bl('Caja (cash)')
    ap_cusd, _ = bl('CAJA DOLARES')
    ap_san, ci_san = bl('Banco Santander')
    ap_pro, ci_pro = bl('Banco de la Provincia')
    ap_fci, ci_fci = bl('Fondo comun de Inversi')
    ap_gal, ci_gal = bl('Banco Galicia')
    ap_gus, ci_gus = bl('Banco Galicia cta. USD')

    enviado_leido = _leer_enviado()
    enviado = enviado_leido or ENVIADO
    cajas_leidas = _leer_cajas()
    cajas = cajas_leidas or CAJAS_150
    if enviado_leido:
        for k, (i0, c0) in ENVIADO.items():
            if abs(enviado_leido[k][0] - i0) > 0.01 or abs(enviado_leido[k][1] - c0) > 0.01:
                lib.pendiente('Bancos: lo enviado cambió', f'«{k}» en «- Bancos y Saldos.xlsx» dice hoy inicio {_pesos(enviado_leido[k][0])} '
                              f'y cierre {_pesos(enviado_leido[k][1])}; el 15/11 se leyó {_pesos(i0)} y {_pesos(c0)}.', '', HOJA)
    tot_env_ini, tot_env_cie = enviado['TOTAL EN PESOS']

    h.titulo('Detalle 5 — Caja y bancos (ítem 5)')
    h.nota('Fuente: lo enviado al contador («- Bancos y Saldos.xlsx» → «07 Bancos»); '
           f'{f_sal} → «07 Bancos» y «07.1 Cadena de saldos»; {f_bl} → «F · Caja y bancos» y «F · FCI»; {f_tpl} → '
           '«H · MSA · Inversiones»; planilla de cajas de AMS («- CAJA 25-26.xlsx»). Arriba, los bancos en pesos como se enviaron, '
           'con su total sin cambiar. Debajo, el Anexo A con la caja (no informada al enviar) y el nuevo total. Después, el '
           'detalle de cada cuenta: saldo al inicio + movimientos del ejercicio = saldo al cierre, con el control contra el '
           'extracto. La cuenta en dólares y el fondo común van en sus bloques aparte, al final.'
           + ('' if enviado_leido and cajas_leidas else ' ATENCIÓN: no se encontró la carpeta «- Enviados»; lo enviado y la planilla '
              'de cajas van con los valores leídos el 15/11/2026.'))
    h.blanco()

    # ── Caja y bancos en pesos, como se envió ───────────────────────────────────────────────
    cuentas = [('5a', 'Banco Galicia cta. cte.', 'BANCO GALICIA', ap_gal, ci_gal),
               ('5b', 'Banco Santander cta. cte.', 'BANCO SANTANDER', ap_san, ci_san),
               ('5c', 'Banco Provincia cta. cte.', 'BANCO PROVINCIA', ap_pro, ci_pro)]
    h.seccion('Caja y bancos en pesos, como se envió al contador — cada saldo viene de su detalle, más abajo')
    h.encabezado(['Cuenta', 'Saldo al inicio 30/06/2025 $', '', '', 'Saldo al cierre 30/06/2026 $', 'Según lo enviado', 'Diferencia',
                  'Control'])
    f_env = {}
    for cod, nombre, clave_src, ap, ci in cuentas:
        f_env[cod] = h.fila([f'{cod} · {nombre}', '=0', None, None, '=0'])
    r_caja_env = h.fila(['Caja', None, None, None, 'Pendiente de informar'])
    rt_env = h.total('Total ítem 5 — Bancos en pesos, como se envió',
                     {2: h.suma(2, f_env['5a'], r_caja_env), C_IMP: h.suma(C_IMP, f_env['5a'], r_caja_env)}, clave=True)
    _control(h, 'Total en pesos al cierre, igual a lo enviado', h.cel(C_IMP, rt_env), tot_env_cie,
             '«- Bancos y Saldos.xlsx» enviado → TOTAL EN PESOS')
    _control(h, 'Total en pesos al inicio, igual a lo enviado', h.cel(2, rt_env), tot_env_ini,
             '«- Bancos y Saldos.xlsx» enviado → TOTAL EN PESOS, saldo al inicio')
    h.fila(['▸ Tiene anexo: Anexo A — Caja (no informada al enviar), acá abajo, con su subtotal y el nuevo total.'], negrita=True)
    h.ws.merge_cells(start_row=h.r, start_column=2, end_row=h.r, end_column=h.ncols + 1)
    h.blanco()

    # ── Anexo A · Caja ──────────────────────────────────────────────────────────────────────
    h.seccion('Anexo A — Caja (lo nuevo): UNA caja = Caja General + Caja AMS + Caja Sigot, según la planilla de cajas')
    h.encabezado(['Sub-caja', 'Saldo 30/06/2025 $', 'Entradas $', 'Salidas $', 'Saldo 30/06/2026 $ (planilla)',
                  'Inicio + entradas − salidas', 'Diferencia', ''])
    r1 = r2 = None
    for nombre in ('Caja General', 'Caja AMS', 'Caja Sigot'):
        ini, ent, sal, fin, n = cajas[nombre]
        rr = h.r + 1
        r2 = h.fila([f'{nombre} ({n} movimientos)', float(ini), float(ent), float(sal), float(fin),
                     f'={h.cel(2, rr)}+{h.cel(3, rr)}-{h.cel(4, rr)}', f'={h.cel(5, rr)}-{h.cel(6, rr)}'])
        r1 = r1 or r2
    rt_anx = h.total('Subtotal de lo nuevo — Caja (Anexo A)', {c: h.suma(c, r1, r2) for c in (2, 3, 4, 5, 6, 7)})
    _control(h, 'Caja al 30/06/2026 según la planilla', h.cel(C_IMP, rt_anx), CAJA_PLANILLA_CIERRE,
             'planilla de cajas → General 0,00 + AMS 197.340,68 + Sigot 430.873,00')
    _control(h, 'Caja al 30/06/2025 según la planilla', h.cel(2, rt_anx), CAJA_PLANILLA_INICIO,
             'planilla de cajas → 40.000,00 + 110.550,92 + 306.662,00')
    rt_nuevo = h.total('NUEVO TOTAL en pesos — bancos como se envió + caja',
                       {2: f'={h.cel(2, rt_env)}+{h.cel(2, rt_anx)}', C_IMP: f'={h.cel(C_IMP, rt_env)}+{h.cel(C_IMP, rt_anx)}'},
                       clave=True)
    h.nota('Cómo se lee: cada sub-caja con su saldo al último renglón anterior al 01/07/2025 y al último del ejercicio. Entradas y '
           'salidas incluyen los pases entre las tres cajas (lo que sale de Caja General entra a Sigot o a AMS): por eso sus '
           'totales no son plata nueva. La «Diferencia» de Caja Sigot son dos renglones de la planilla que no entran en su saldo.')
    h.blanco()
    s_ini = sum(cajas[k][0] for k in cajas)
    s_fin = round(sum(cajas[k][3] for k in cajas), 2)
    cadena_cajas = round(sum(cajas[k][0] + cajas[k][1] - cajas[k][2] for k in cajas), 2)

    h.seccion('Anexo A — Puente de la caja: de dónde vino y a dónde fue el efectivo del ejercicio')
    h.encabezado(['Renglón', '', '', '', 'Importe $', 'Según la fuente', 'Diferencia', 'Control'])
    p1 = h.fila(['Caja al 30/06/2025 (las tres cajas; viene del subtotal de arriba)', None, None, None, f'={h.cel(2, rt_anx)}'])
    p2 = p1
    for t, imp in PUENTE:
        p2 = h.fila([t, None, None, None, float(imp)])
        h.ws.merge_cells(start_row=p2, start_column=2, end_row=p2, end_column=5)
        h.ws.row_dimensions[p2].height = 13 * max(1, -(-len(t) // 95))
    rt_p = h.total('Caja al 30/06/2026 según el puente', {C_IMP: h.suma(C_IMP, p1, p2)})
    _control(h, 'El puente da la cadena de la planilla (inicio + entradas − salidas)', h.cel(C_IMP, rt_p), cadena_cajas,
             'planilla de cajas → suma de inicio + entradas − salidas de las tres')
    pd = h.fila(['Más: dos renglones «Ret 1» de Caja Sigot que la planilla no cuenta en su saldo', None, None, None,
                 float(PUENTE_DIF_PLANILLA)])
    rt_p2 = h.total('Caja al 30/06/2026 según la planilla', {C_IMP: f'={h.cel(C_IMP, rt_p)}+{h.cel(C_IMP, pd)}'})
    _control(h, 'Puente + diferencia = saldo de la planilla (el subtotal del Anexo A)', h.cel(C_IMP, rt_p2), s_fin,
             'planilla de cajas → saldos al 30/06/2026')
    ci_app = num(w_bp.cell(next(r for r in range(1, w_bp.max_row + 1) if _txt(w_bp.cell(r, 1).value) == 'Caja'), 3).value)
    r_sg = _fila_de(w_ban, 'CAJA SIGOT')
    sg_app, sg_f = num(w_ban.cell(r_sg, 2).value), _fch(w_ban.cell(r_sg, 3).value)
    cg_app = num(w_ban.cell(_fila_de(w_ban, 'CAJA GENERAL'), 2).value)
    h.nota('Los renglones del puente salen del análisis de la planilla de cajas y del extracto del Galicia hecho el 15/11/2026 '
           '(extracciones, cobros en efectivo, sueldos y gastos por caja). Nada de esto se le informó al contador este año.')
    h.nota(f'Nota: la app muestra hoy otra caja, $ {_pesos(ci_app)} = «Caja General {_pesos(cg_app)}» (que en realidad es la suma de '
           f'las tres cajas al inicio) + «Caja Sigot {_pesos(sg_app)}» (que es el saldo al '
           f'{sg_f.strftime("%d/%m/%Y") if sg_f else "último movimiento cargado"}, último movimiento cargado). Y el «Balance en línea» '
           f'arma $ {_pesos(ci_caja_bl)} (apertura del contador {_pesos(ap_caja)} + movimientos de las cajas en la app). Ninguna de '
           'las dos es el saldo real: quedan como pendiente del sistema. El balance del contador traía además «Caja dólares» por '
           f'$ {_pesos(ap_cusd)}: no hay dato en ninguna fuente y no se informa.')
    h.blanco()
    lib.pendiente('Caja: la app no muestra el saldo real',
                  f'Saldo real por la planilla de cajas: {_pesos(s_fin)}. La app muestra {_pesos(ci_app)} (suma de las tres cajas al '
                  f'inicio + Caja Sigot al último movimiento cargado) y el Balance en línea {_pesos(ci_caja_bl)} (apertura del contador '
                  '+ movimientos cargados). Falta cargar las cajas completas en la app y corregir los dos cálculos.',
                  _pesos(ci_app - s_fin), HOJA)
    lib.pendiente('Caja dólares: sin dato', f'El balance del contador 24/25 traía «Caja dólares» por {_pesos(ap_cusd)}; ninguna fuente '
                  'tiene sus movimientos ni su saldo (la planilla registra una salida de US$ 21.400 el 17/01/26). No se informa.',
                  _pesos(ap_cusd), HOJA)
    lib.pendiente('Caja: partes del puente sin identificar',
                  f'Entradas a Caja Sigot / Caja AMS que no cruzan con el banco por {_pesos(PUENTE[-1][1])}, y {_pesos(PUENTE_DIF_PLANILLA)} '
                  'de dos renglones «Ret 1» de Caja Sigot fuera de su saldo.', _pesos(PUENTE[-1][1] + PUENTE_DIF_PLANILLA), HOJA)
    if abs(s_fin - CAJA_PLANILLA_CIERRE) > 0.01 or abs(s_ini - CAJA_PLANILLA_INICIO) > 0.01:
        lib.pendiente('Caja: la planilla cambió', f'Hoy la planilla suma {_pesos(s_ini)} al inicio y {_pesos(s_fin)} al cierre; el 15/11 '
                      f'se leyó {_pesos(CAJA_PLANILLA_INICIO)} y {_pesos(CAJA_PLANILLA_CIERRE)}.', _pesos(s_fin - CAJA_PLANILLA_CIERRE), HOJA)
    puente_py = s_ini + sum(p[1] for p in PUENTE)
    if abs(puente_py - cadena_cajas) > 0.01:
        lib.pendiente('Caja: el puente no da la cadena de la planilla', f'Puente {_pesos(puente_py)}; planilla {_pesos(cadena_cajas)}.',
                      _pesos(puente_py - cadena_cajas), HOJA)

    # ── 5a, 5b, 5c · detalle de cada banco en pesos ─────────────────────────────────────────
    totales = {}
    for cod, nombre, clave_src, ap, ci in cuentas:
        c = cadena(clave_src)
        h.seccion(f'{cod} · {nombre} — detalle')
        h.encabezado(ENC)
        r1 = h.fila(['Saldo al inicio (30/06/2025)', None, None, None, float(c['inicio'])])
        h.fila(['Movimientos anteriores al primero cargado (los deduce la app)', None, None, None, float(c['no_cargado'])])
        r2 = h.fila([f'Movimientos del ejercicio (neto de {c["mov"]} movimientos del extracto)', c['desde'], c['hasta'], c['mov'],
                     float(c['cargado'])])
        rt = h.total(f'Total {cod} — {nombre} al cierre', {C_IMP: h.suma(C_IMP, r1, r2)}, clave=True)
        totales[cod] = rt
        _control(h, f'{cod}: saldo al cierre contra el extracto', h.cel(C_IMP, rt), c['extracto'],
                 '«07.1 Cadena de saldos» de hoy → saldo del extracto')
        _control(h, f'{cod}: saldo al cierre contra lo enviado', h.cel(C_IMP, rt), enviado[clave_src][1],
                 '«- Bancos y Saldos.xlsx» enviado → saldo al cierre')
        h.nota(' · '.join(x for x in [origen_inicio(clave_src), 'Respaldo del saldo al cierre: ' + respaldo(clave_src)] if x))
        h.blanco()
        h.celda(2, f_env[cod]).value = f'={h.cel(C_IMP, r1)}'
        h.celda(C_IMP, f_env[cod]).value = f'={h.cel(C_IMP, rt)}'
        calc = c['inicio'] + c['no_cargado'] + c['cargado']
        if abs(calc - c['extracto']) > 0.01 or abs(calc - enviado[clave_src][1]) > 0.01 or abs(c['extracto'] - ci) > 0.01:
            lib.pendiente(f'{nombre}: no cierra', f'Cadena {_pesos(calc)} · extracto {_pesos(c["extracto"])} · enviado '
                          f'{_pesos(enviado[clave_src][1])} · Balance en línea {_pesos(ci)}.', _pesos(calc - c['extracto']), HOJA)
        if abs(c['inicio'] - ap) > 0.01 or abs(c['inicio'] - enviado[clave_src][0]) > 0.01:
            lib.pendiente(f'{nombre}: el inicio difiere', f'Hoy arranca en {_pesos(c["inicio"])}; enviado {_pesos(enviado[clave_src][0])}; '
                          f'el contador cerró 24/25 en {_pesos(ap)}.', _pesos(c['inicio'] - ap), HOJA)

    # ── 5d · Banco Galicia en dólares ───────────────────────────────────────────────────────
    r_us = _fila_de(w_fcb, 'MSA Cuenta Corriente USD')
    v = lambda c: w_fcb.cell(r_us, c).value
    us_ini, us_mov, us_cie = num(v(2)), num(v(5)), num(v(7))
    us_d, us_h = _fch(v(3)), _fch(v(4))
    r_ub = _fila_de(w_ban, 'MSA Cuenta Corriente USD')
    tc = num(w_ban.cell(r_ub, 5).value)
    us_pesos = num(w_ban.cell(r_ub, 6).value)
    nota_tc = _txt(w_ban.cell(_fila_de(w_ban, 'TC al cierre:'), 1).value)
    h.seccion('5d · Cuenta en dólares (Banco Galicia) — en US$, como se envió')
    h.encabezado(['Concepto', 'Desde', 'Hasta', 'Movim.', 'Importe US$', 'Según la fuente', 'Diferencia', 'Control'])
    r1 = h.fila(['Saldo al inicio (30/06/2025), en US$', None, None, None, float(us_ini)])
    r2 = h.fila(['Movimientos del ejercicio (neto), en US$', us_d, us_h, None, float(us_mov)])
    ru = h.total('Saldo al cierre en US$', {C_IMP: h.suma(C_IMP, r1, r2)})
    _control(h, '5d: saldo al cierre en dólares', h.cel(C_IMP, ru), us_cie,
             '«F · Caja y bancos» → saldo de la app al cierre US$ (lo enviado: US$ 599,71)')
    h.blanco()
    h.seccion('5d · Cuenta en dólares — pasada a pesos')
    h.encabezado(['Concepto', 'US$', 'Tipo de cambio', '', 'Importe $', 'Según la fuente', 'Diferencia', 'Control'])
    rp = h.total('Total 5d — Cuenta en dólares al cierre, en pesos (US$ × tipo de cambio)',
                 {2: f'={h.cel(C_IMP, ru)}', 3: float(tc), C_IMP: f'={h.cel(2, h.r + 1)}*{h.cel(3, h.r + 1)}'}, clave=True)
    totales['5d'] = rp
    _control(h, '5d: saldo al cierre en pesos', h.cel(C_IMP, rp), ci_gus, 'Balance en línea → «Banco Galicia cta. USD», Cierre (la app)')
    tc_ap = ap_gus / us_ini if us_ini else 0
    h.nota(nota_tc + ' Respaldo del saldo: ' + _txt(w_ban.cell(r_ub, 7).value) + '. La apertura del contador era $ ' +
           _pesos(ap_gus) + f' por US$ {_pesos(us_ini)} (da un dólar de {_pesos(tc_ap)}). Las fuentes no traen los movimientos '
           'de esta cuenta uno por uno, sólo el neto. No suma al total en pesos de arriba.')
    h.blanco()
    if abs(us_ini + us_mov - us_cie) > 0.01 or abs(us_cie * tc - ci_gus) > 0.01 or abs(us_pesos - ci_gus) > 0.01:
        lib.pendiente('Cuenta en dólares: no cierra', f'US$ {_pesos(us_ini + us_mov)} calculado vs {_pesos(us_cie)}; en pesos '
                      f'{_pesos(us_cie * tc)} vs {_pesos(ci_gus)}.', _pesos(us_cie * tc - ci_gus), HOJA)

    # ── 5e · Fondo común de inversión ───────────────────────────────────────────────────────
    r_enc = _fila_de(w_fci, 'Cuotapartes', col=2)
    r_in, r_su, r_re = (_fila_de(w_fci, e, desde=r_enc) for e in ('Inicio', 'Suscripciones', 'Rescates'))
    r_ci, r_rs = _fila_de(w_fci, 'Cierre', desde=r_enc), _fila_de(w_fci, 'Resultado', desde=r_enc)
    q0, p0, v0 = num(w_fci.cell(r_in, 2).value), num(w_fci.cell(r_in, 3).value), num(w_fci.cell(r_in, 4).value)
    q1, p1, v1 = num(w_fci.cell(r_ci, 2).value), num(w_fci.cell(r_ci, 3).value), num(w_fci.cell(r_ci, 4).value)
    susc_f, resc_f = num(w_fci.cell(r_su, 4).value), num(w_fci.cell(r_re, 4).value)
    result_f = num(w_fci.cell(r_rs, 4).value)
    aviso_fci = _txt(w_fci.cell(r_rs, 5).value)

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
        texto = ' · '.join(x for x in [_txt(v(4)), _txt(v(8)), 'estado: ' + _txt(v(9))] if x)
        deb, cre = num(v(10)), num(v(11))
        if deb:
            suscripciones.append((_fch(v(3)), texto, _txt(v(5)), deb))
        if cre:
            rescates.append((_fch(v(3)), texto, _txt(v(5)), -cre))
    s_susc = sum(x[3] for x in suscripciones)
    s_resc = -sum(x[3] for x in rescates)

    h.seccion('5e · Fondo común de inversión — FIMA Premium A (Galicia), como se envió')
    h.encabezado(['Concepto', 'Cuotapartes', 'Valor de la cuotaparte', 'Movim.', 'Importe $', 'Según la fuente', 'Diferencia',
                  'Control'])
    producto_ok = abs(q0 * p0 - v0) <= 0.01
    ri = h.fila(['Saldo al inicio (30/06/2025): cuotapartes × valor de la cuotaparte', float(q0), float(p0), None,
                 f'={h.cel(2, h.r + 1)}*{h.cel(3, h.r + 1)}' if producto_ok else float(v0)], fmt={3: F6})
    r_s = h.fila(['Más: suscripciones del ejercicio (plata que salió de la cuenta Galicia al fondo) — detalle abajo', None, None,
                  len(suscripciones), '=0'])
    r_r = h.fila(['Menos: rescates del ejercicio (plata que volvió del fondo a la cuenta Galicia) — detalle abajo', None, None,
                  len(rescates), '=0'])
    r_g = h.fila(['Más: resultado del fondo (lo deduce la app: cierre − inicio − suscripciones + rescates)', None, None, None,
                  float(result_f)])
    rt_fci = h.total('Total 5e — Fondo común de inversión al cierre', {C_IMP: h.suma(C_IMP, ri, r_g)}, clave=True)
    totales['5e'] = rt_fci
    _control(h, '5e: saldo al cierre del fondo', h.cel(C_IMP, rt_fci), v1,
             f'«F · FCI» → cierre: {_pesos(q1)} cuotapartes × {p1:.4f}'.replace('.', ',') if q1 == 0 else '«F · FCI» → cierre valorizado')
    _control(h, '5e: saldo al inicio contra el balance del contador 24/25', h.cel(C_IMP, ri), ap_fci,
             'Balance en línea → «Fondo comun de Inversión», Apertura (contador)')
    h.nota('Cuotapartes y valor: ' + _txt(w_fci.cell(r_in, 5).value) + ' · Cierre: ' + _txt(w_fci.cell(r_ci, 5).value) +
           '. El fondo se rescató entero: al 30/06/2026 quedan 0 cuotapartes. El resultado es el mismo que se envió (6.983.092,49).')
    if aviso_fci:
        h.nota('Sobre el resultado: ' + aviso_fci)
        lib.pendiente('Fondo común: resultado deducido', aviso_fci.replace('⚠️ ', ''), _pesos(result_f), HOJA)
    if not producto_ok:
        lib.pendiente('Fondo común: inicio', f'Cuotapartes × valor da {_pesos(q0 * p0)} y la fuente valoriza {_pesos(v0)}.',
                      _pesos(q0 * p0 - v0), HOJA)
    h.blanco()

    enc_mov = ['Movimiento del extracto (concepto · detalle · estado)', 'Fecha', 'Cuenta', '', 'Importe $', 'Según la fuente',
               'Diferencia', 'Control']
    h.seccion(f'5e · Suscripciones del ejercicio — {len(suscripciones)} movimientos')
    h.encabezado(enc_mov)
    r1 = r2 = None
    for f, t, cta, imp in suscripciones:
        r2 = h.fila([t, f, cta, None, float(imp)])
        r1 = r1 or r2
    rs_tot = h.total('Total suscripciones', {C_IMP: h.suma(C_IMP, r1, r2) if r1 else '=0'})
    _control(h, '5e: suscripciones del fondo', h.cel(C_IMP, rs_tot), susc_f, '«F · FCI» → Suscripciones del ejercicio (banco)')
    h.blanco()
    h.seccion(f'5e · Rescates del ejercicio — {len(rescates)} movimientos (en negativo: bajan el fondo)')
    h.encabezado(enc_mov)
    r1 = r2 = None
    for f, t, cta, imp in rescates:
        r2 = h.fila([t, f, cta, None, float(imp)])
        r1 = r1 or r2
    rr_tot = h.total('Total rescates', {C_IMP: h.suma(C_IMP, r1, r2) if r1 else '=0'})
    _control(h, '5e: rescates del fondo', h.cel(C_IMP, rr_tot), -resc_f, '«F · FCI» → Rescates del ejercicio (banco), en negativo')
    h.celda(C_IMP, r_s).value = f'={h.cel(C_IMP, rs_tot)}'
    h.celda(C_IMP, r_r).value = f'={h.cel(C_IMP, rr_tot)}'
    if abs(s_susc - susc_f) > 0.01 or abs(s_resc - resc_f) > 0.01:
        lib.pendiente('Fondo común: los movimientos listados no dan el total de la fuente',
                      f'Suscripciones listadas {_pesos(s_susc)} (fuente {_pesos(susc_f)}); rescates listados {_pesos(s_resc)} '
                      f'(fuente {_pesos(resc_f)}).', _pesos((s_susc - susc_f) - (s_resc - resc_f)), HOJA)
    cierre_fci = v0 + s_susc - s_resc + result_f
    if abs(cierre_fci - v1) > 0.01 or abs(v1 - ci_fci) > 0.01:
        lib.pendiente('Fondo común: el cierre no da', f'Inicio + suscripciones − rescates + resultado = {_pesos(cierre_fci)}; '
                      f'la fuente dice {_pesos(v1)}.', _pesos(cierre_fci - v1), HOJA)

    # ── ítems ───────────────────────────────────────────────────────────────────────────────
    lib.item('5', 'Bancos en pesos, como se envió', h, h.cel(C_IMP, rt_env), GRUPO,
             'Galicia + Santander + Provincia (la caja se envió «Pendiente de informar»: ver anexo 5f)', ap_gal + ap_san + ap_pro)
    for cod, nombre, clave_src, ap, ci in cuentas:
        lib.item(cod, nombre, h, h.cel(C_IMP, totales[cod]), GRUPO, 'Saldo al inicio + movimientos del extracto', ap)
    lib.item('5d', 'Cuenta en dólares (en pesos)', h, h.cel(C_IMP, totales['5d']), GRUPO,
             'US$ al cierre × dólar BNA divisas comprador del 30/06/2026', ap_gus)
    lib.item('5e', 'Fondo común de inversión', h, h.cel(C_IMP, totales['5e']), GRUPO,
             'Cuotapartes × valor al inicio + suscripciones − rescates + resultado', ap_fci)
    lib.item('5f', 'Anexo: Caja (suma de las tres cajas, planilla)', h, h.cel(C_IMP, rt_anx), GRUPO,
             'Caja General + Caja AMS + Caja Sigot al 30/06/2026, según la planilla de cajas', ap_caja)
    lib.item('5g', 'Nuevo total en pesos, con la caja', h, h.cel(C_IMP, rt_nuevo), GRUPO,
             'Total enviado (ítem 5) + subtotal del Anexo A (5f)', ap_gal + ap_san + ap_pro + ap_caja)

    lib.pendiente('Bancos: el detalle movimiento por movimiento no está en los libros exportados',
                  'Santander, Provincia, Galicia en pesos y la cuenta en dólares van con el neto del ejercicio (la fuente no trae '
                  'débitos y créditos ni el corte por mes). El último nivel —cada movimiento del extracto— queda en la app.',
                  '', HOJA)
