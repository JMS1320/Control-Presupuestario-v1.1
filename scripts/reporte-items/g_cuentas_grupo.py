# -*- coding: utf-8 -*-
"""Grupo · Cuentas entre MSA, MA y PAM (borrador) — lo que cada empresa dice de las otras, lado a lado, con la diferencia.

Fuentes (todas de sólo lectura):
· export de la app «Socios y Libertad» → «14.1 Cuentas con socios» (la cuenta de MA y de PAM que lleva MSA) y «Gastos Libertad»;
· export de la app «Templates» → solapas «H · MSA/MA/PAM · …», detalle de cuotas con la columna «Banco / cuenta» (pagado desde);
· ma/cuentas.json y pam/cuentas.json (lo que se ve desde los bancos de MA y de PAM; los usan los reportes de cada empresa);
· grupo/extra.json (consultas del 16/11/2026: caja de ahorro de MA en octubre 2025 y pagos del libro de sueldos).

Hojas: Matriz · G1 MSA-MA · G2 MSA-PAM · G3 PAM-MA · G4 Gastos cruzados · G5 Libertad · G6 Sueldos.
Sólo usa la API de core.py (más los ayudantes de e_ma_comun / e_pam_comun). No decide nada: lo que hay que definir va a Pendientes."""
import collections
import datetime
import itertools
import json
import os
import re

from openpyxl.styles import Alignment

import d_socios
from core import num
from e_ma_comun import ar, fila, mes_largo

GRUPO_1 = 'A · Saldos entre las tres empresas al 30/06/2026'
GRUPO_2 = 'B · Cómo se forman: movimientos del ejercicio que cruzan empresas'
EMP = ('MSA', 'MA', 'PAM')
NOMBRE = {'MSA': 'MSA', 'MA': 'MA', 'PAM': 'PAM'}
A8 = [10, 18, 36, 30, 11, 15, 15, 15]          # 150 — hojas de los pares y de sueldos
A_G4 = [10, 26, 32, 19, 17, 15, 20, 11]        # 150 — gastos cruzados
A_G5 = [14, 14, 14, 14, 14, 14, 14, 16, 16, 16]  # 146 — Libertad
A_M = [50, 16, 17, 17, 16, 34]                 # 150 — matriz
H1, H2, H3, H4, H5, H6 = 'G1 MSA-MA', 'G2 MSA-PAM', 'G3 PAM-MA', 'G4 Gastos cruzados', 'G5 Libertad', 'G6 Sueldos'
MESES_EJ = ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
            '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
T_LIB = 'Libertad: va por el cuadro de Libertad (G5)'
T_CTA = 'En la cuenta de {} que lleva MSA'
T_ENV = 'No está en la cuenta según el sistema; sí en lo enviado al contador'
T_NO = 'No está en la cuenta que lleva MSA'
T_NADIE = 'Ninguna de las dos lo lleva como cuenta'


# ---------------------------------------------------------------- lectura
def _d(f):
    if isinstance(f, datetime.datetime):
        return f.date()
    if isinstance(f, datetime.date):
        return f
    if isinstance(f, str) and len(f) >= 10:
        return datetime.date(int(f[0:4]), int(f[5:7]), int(f[8:10]))
    return None


def _json(src, sub, nombre):
    ruta = os.path.join(src.carpeta, sub, nombre + '.json')
    if not os.path.exists(ruta):
        raise SystemExit(f'Falta el extracto: {ruta}')
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def _hoja(lib, nombre, anchos):
    if sum(anchos) > 150:
        raise SystemExit(f'{nombre}: los anchos suman {sum(anchos)} (máximo 150)')
    h = lib.hoja(nombre, anchos, horizontal=True)
    h.ws.oddHeader.right.text = '&"Arial,Italic"&8Grupo 25/26 — Cuentas entre MSA, MA y PAM (borrador)'
    return h


def control(h, descripcion, celda, valor, fuente, tol=0.01):
    """h.control con el texto combinado a lo ancho (no se monta sobre los importes)."""
    r = h.control(descripcion, celda, valor, fuente, tolerancia=tol)
    fin = h.ncols - 3
    if fin > 1:
        h.ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=fin + 1)
    x = h.celda(1, r)
    x.alignment = Alignment(wrap_text=True, vertical='top')
    ancho = sum(h.ws.column_dimensions[h.col(k)].width for k in range(1, fin + 1))
    h.ws.row_dimensions[r].height = 12.5 * max(1, -(-len(str(x.value)) // max(10, int(ancho * 1.15))))
    return r


def _limpio(s):
    s = re.sub(r'\s*\[script \d+\]', '', str(s or ''))
    return s.replace('  ← sin referencia', '').replace('✅ ', '').strip()


def _cuotas_cruzadas(src):
    """Del libro de Templates: las cuotas de cada empresa cuyo «Banco / cuenta» es de OTRA empresa. Devuelve (cruzadas, totales)."""
    cruz, n_todas = [], collections.Counter()
    for w in src.libro('Templates').worksheets:
        m = re.match(r'H · (MSA|MA|PAM) · (.+)', w.title)
        if not m:
            continue
        emp = m.group(1)
        hr = next((r for r in range(1, w.max_row + 1)
                   if w.cell(r, 1).value == 'Nro' and w.cell(r, 4).value == 'Concepto'), None)
        if not hr:
            continue
        for r in range(hr + 1, w.max_row + 1):
            if not isinstance(w.cell(r, 1).value, int):
                break
            v = [w.cell(r, k).value for k in range(1, 12)]
            n_todas[emp] += 1
            banco = str(v[4] or '')
            tk = set(re.findall(r'[A-Za-z]+', banco))
            otras = (tk & set(EMP)) - {emp}
            if otras and emp not in tk:
                det = _limpio(v[7])
                if det.startswith(f'{v[3]} — '):
                    det = det[len(str(v[3])) + 3:]
                prov = str(v[6] or '')
                if prov == banco:
                    prov = ''
                cruz.append(dict(emp=emp, paga=sorted(otras)[0], hoja=m.group(2), fecha=_d(v[2]), concepto=str(v[3] or ''),
                                 banco=banco, comp=str(v[5] or ''), prov=prov, det=det if det != str(v[3]) else '',
                                 estado=str(v[8] or ''), imp=round(num(v[9]) - num(v[10]), 2), trat=None, marca=''))
    cruz.sort(key=lambda q: (q['fecha'], q['concepto'], q['imp']))
    return cruz, n_todas


def _libertad(src):
    """«Gastos Libertad» del export: el cuadro (por mes) y el detalle de cuotas."""
    w = src.libro('Socios y Libertad')['Gastos Libertad']
    cuadro = {}
    hr = None
    for r in range(1, w.max_row + 1):
        e = w.cell(r, 5).value
        if w.cell(r, 1).value == 'Nro' and w.cell(r, 2).value == 'Mes':
            hr = r
            break
        if isinstance(e, str) and isinstance(w.cell(r, 6).value, (int, float)):
            cuadro.setdefault(e.strip(), [num(w.cell(r, k).value) for k in range(6, 18)])
    det = []
    for r in range(hr + 1, w.max_row + 1):
        if not isinstance(w.cell(r, 1).value, int):
            break
        v = [w.cell(r, k).value for k in range(1, 12)]
        det.append(dict(fecha=_d(v[2]), concepto=str(v[3]), resp=str(v[4]), pago=str(v[5]), cuenta=str(v[6]),
                        imp=round(num(v[9]) - num(v[10]), 2), usado=False))

    def serie(prefijo):
        ks = [k for k in cuadro if k.startswith(prefijo)]
        if not ks:
            raise SystemExit(f'Gastos Libertad: no encontré el renglón «{prefijo}»')
        return cuadro[ks[0]]

    return dict(det=det, costo=serie('Costo de Libertad'), msa=serie('Pagó MSA'), pam=serie('Pagó PAM'), ma=serie('Pagó MA'),
                c_pam=serie('CUENTA MSA ↔ PAM'), c_ma=serie('CUENTA MSA ↔ MA'), entre=serie('ENTRE PAM Y MA'))


def _clasificar(movs):
    """Los movimientos de la cuenta de una empresa en MSA, por tipo."""
    cl = collections.defaultdict(list)
    for m in movs:
        m = dict(m, f=_d(m['fecha']), concepto=_limpio(m['concepto']), otra=_limpio(m['otra']), cuotas=[])
        if m['cuenta'].startswith('Gastos Libertad'):
            cl['lib_debe' if m['debe'] else 'lib_haber'].append(m)
        elif m['agrup'].startswith('Retiros'):
            cl['retiros' if m['debe'] else 'aportes'].append(m)
        elif m['cuenta'].startswith('Facturas'):
            cl['facturas'].append(m)
        elif m['haber']:
            cl['pago_por_msa'].append(m)      # la otra empresa pagó algo de MSA
        else:
            cl['terceros'].append(m)          # MSA pagó a un tercero por cuenta de la otra
    return cl


def _emparejar(cruz, lib, ctas, anexo, pam_movs):
    """Le pone a cada cuota cruzada su tratamiento: Libertad · en la cuenta que lleva MSA · no está."""
    for q in cruz:                                               # 1) Libertad
        for l in lib['det']:
            if not l['usado'] and l['fecha'] == q['fecha'] and abs(l['imp'] - q['imp']) < 0.01 and l['pago'] == q['paga']:
                l['usado'] = True
                q['trat'] = T_LIB
                break
    filas = [(e, m) for e in ('MA', 'PAM') for m in ctas[e]['terceros']]
    libres = lambda p: [q for q in cruz if q['trat'] is None and q['paga'] == 'MSA' and p(q)]  # noqa: E731

    def tomar(q, e, m):
        q['trat'] = T_CTA.format(e) + ('' if q['emp'] == e else f' (la cuota es de {q["emp"]})')
        q['en'] = e
        m['cuotas'].append(q)

    for e, m in filas:                                           # 2) mismo día, mismo importe, misma empresa
        for q in libres(lambda q: q['emp'] == e and q['fecha'] == m['f'] and abs(q['imp'] - m['debe']) < 0.01):
            if not m['cuotas']:
                tomar(q, e, m)
    for e, m in sorted(filas, key=lambda x: x[1]['f']):          # 3) tarjeta: el consumo se carga cuando se paga el resumen
        if m['cuotas'] or not m['cuenta'].startswith('MSA VISA'):
            continue
        cs = libres(lambda q: q['emp'] == e and q['banco'].startswith('VISA') and abs(q['imp'] - m['debe']) < 0.01
                    and 0 <= (m['f'] - q['fecha']).days <= 75 and q['concepto'] in m['concepto'])
        if cs:
            tomar(cs[0], e, m)
    for e, m in filas:                                           # 4) un renglón de la cuenta = varias cuotas del mismo día
        if m['cuotas']:
            continue
        cs = libres(lambda q: q['fecha'] == m['f'] and not q['banco'].startswith('VISA'))[:14]
        hecho = False
        for n in range(1, len(cs) + 1):
            for combo in itertools.combinations(cs, n):
                if abs(sum(q['imp'] for q in combo) - m['debe']) < 0.01:
                    for q in combo:
                        tomar(q, e, m)
                    hecho = True
                    break
            if hecho:
                break
    env = [a for a in anexo if a[0] == 'MA' and a[2] == 'MSA VISA']  # 5) lo que está en lo enviado y no en el sistema
    usados = set()
    for q in cruz:
        if q['trat'] is None and q['paga'] == 'MSA':
            k = next((i for i, a in enumerate(env) if i not in usados and abs(-a[4] - q['imp']) < 0.01
                      and q['concepto'].split(' ')[0] in a[3]), None)
            if k is not None:
                usados.add(k)
                q['trat'] = T_ENV
            else:
                q['trat'] = T_NO
    banco = [dict(f=_d(m[1]), imp=round(m[3] - m[4], 2), cod=' / '.join(x for x in (m[7], m[8]) if x) or 'sin código', usado=False)
             for m in pam_movs]
    for q in cruz:                                               # 6) entre PAM y MA nadie lleva cuenta: se anota la marca del banco de PAM
        if q['trat'] is None:
            q['trat'] = T_NADIE
        if q['paga'] == 'PAM' and not q['banco'].startswith('VISA'):
            b = next((b for b in banco if not b['usado'] and b['f'] == q['fecha'] and abs(b['imp'] - q['imp']) < 0.01), None)
            if b is None:
                b = next((b for b in banco if not b['usado'] and abs(b['imp'] - q['imp']) < 0.01
                          and abs((b['f'] - q['fecha']).days) <= 3), None)
            if b:
                b['usado'] = True
                q['marca'] = b['cod']


def _por_mes(h, filas, clave, armar, cols, etiqueta_col=1):
    """Renglones agrupados por mes con su subtotal. armar(x, r) -> valores. Devuelve los renglones de los subtotales."""
    grupos = collections.OrderedDict()
    for x in sorted(filas, key=clave):
        grupos.setdefault(clave(x).strftime('%Y-%m'), []).append(x)
    subs = []
    for m, xs in grupos.items():
        a = h.r + 1
        for x in xs:
            fila(h, armar(x, h.r + 1))
        subs.append(h.total(f'Subtotal {mes_largo(m)}', {c: h.suma(c, a, h.r) for c in cols}, col_etiqueta=etiqueta_col))
    return subs


def _parear(A, B, ka, kb):
    """Empareja dos listas por (fecha, importe). Devuelve [(a|None, b|None)] por fecha."""
    libres = list(B)
    pares = []
    for a in A:
        b = next((x for x in libres if kb(x) == ka(a)), None)
        if b is not None:
            libres.remove(b)
        pares.append((a, b))
    pares += [(None, b) for b in libres]
    pares.sort(key=lambda p: ka(p[0]) if p[0] is not None else kb(p[1]))
    return pares


def _lado_a_lado(h, pares, ka, kb, txt):
    """Tabla por mes con el importe de cada lado y la diferencia. txt(a, b) -> [cuenta, concepto, detalle, marca]."""
    def armar(p, r):
        a, b = p
        f, _ = ka(a) if a is not None else kb(b)
        return [f] + txt(a, b) + [float(ka(a)[1]) if a is not None else None, float(kb(b)[1]) if b is not None else None,
                                  f'={h.cel(7, r)}-{h.cel(6, r)}']
    return _por_mes(h, pares, lambda p: (ka(p[0]) if p[0] is not None else kb(p[1]))[0], armar, (6, 7, 8), etiqueta_col=3)


# ---------------------------------------------------------------- G5 Libertad
def _g5(lib, h, X):
    L = X['lib']
    R = X['R']
    h.titulo('G5 · Libertad — lo que pagó cada una y lo que le correspondía (ítem 5)')
    h.nota('Fuente: export «Socios y Libertad» → «Gastos Libertad» (cuadro por mes). El costo del departamento de Libertad se reparte '
           '50% MSA y 50% el otro: PAM hasta diciembre 2025 y MA desde enero 2026. La tercera (MA hasta diciembre, PAM desde enero) '
           'no carga costo: lo que paga, lo paga por las otras dos, mitad por cada una. «Cuenta MSA ↔ …»: positivo = esa empresa le '
           'debe a MSA (en su cuenta figura como «retiró»); negativo = MSA le debe («aportó»). Los importes por mes son los del '
           'export; los repartos y los totales son fórmulas de esta hoja.')
    h.blanco()
    h.seccion('5 · Libertad por mes')
    h.encabezado(['Mes', 'Costo del mes', '50% de MSA', '50% del otro (PAM / MA)', 'Pagó MSA', 'Pagó PAM', 'Pagó MA',
                  'Cuenta MSA ↔ PAM', 'Cuenta MSA ↔ MA', 'Entre PAM y MA (sin MSA)'], repetir=True)
    sem = []
    for s in (0, 1):
        a = h.r + 1
        for i in range(s * 6, s * 6 + 6):
            r = h.r + 1
            c = h.cel
            if s == 0:   # el otro es PAM; la tercera es MA
                f_pam, f_ma, f_e = f'={c(5, r)}-{c(3, r)}+{c(7, r)}/2', f'=-{c(7, r)}/2', f'={c(7, r)}/2'
            else:        # el otro es MA; la tercera es PAM
                f_pam, f_ma, f_e = f'=-{c(6, r)}/2', f'={c(5, r)}-{c(3, r)}+{c(6, r)}/2', f'={c(6, r)}/2'
            h.fila([mes_largo(MESES_EJ[i]), float(L['costo'][i]), f'={c(2, r)}/2', f'={c(2, r)}/2', float(L['msa'][i]),
                    float(L['pam'][i]), float(L['ma'][i]), f_pam, f_ma, f_e])
        sem.append(h.total('1er semestre (el otro 50% es de PAM)' if s == 0 else '2do semestre (el otro 50% es de MA)',
                           {k: h.suma(k, a, h.r) for k in range(2, 11)}))
    tot = h.total('Total ítem 5 — Libertad del ejercicio', {k: h.suma_de(k, sem) for k in range(2, 11)}, clave=True)
    h.nota('«Entre PAM y MA»: 1er semestre = la mitad de lo que pagó MA, que le correspondía a PAM (PAM le debe a MA); 2do semestre = '
           'la mitad de lo que pagó PAM, que le correspondía a MA (MA le debe a PAM). MSA no interviene y hoy ninguna de las dos lo '
           'tiene registrado.')
    h.blanco()
    pm, pa = X['ctas']['PAM'], X['ctas']['MA']
    s = lambda xs, k: sum(x[k] for x in xs)  # noqa: E731
    control(h, 'costo de Libertad del ejercicio', h.cel(2, tot), sum(L['costo']), 'export «Gastos Libertad», costo de Libertad del mes')
    for k, nom, serie in ((5, 'MSA', 'msa'), (6, 'PAM', 'pam'), (7, 'MA', 'ma')):
        control(h, f'Libertad pagado por {nom}', h.cel(k, tot), sum(L[serie]), f'export «Gastos Libertad», «Pagó {nom}»')
    for i, (dbe, hab) in enumerate(((s(pm['lib_debe'], 'debe'), 0.0), (0.0, s(pm['lib_haber'], 'haber')))):
        control(h, f'cuenta MSA ↔ PAM, {i + 1}º semestre, contra el asiento en la cuenta de PAM que lleva MSA', h.cel(8, sem[i]),
                  dbe - hab, 'export «14.1 Cuentas con socios», Sucesión, «Gastos Libertad (cuadro final)»', tol=0.05)
    for i, (dbe, hab) in enumerate(((0.0, s(pa['lib_haber'], 'haber')), (s(pa['lib_debe'], 'debe'), 0.0))):
        control(h, f'cuenta MSA ↔ MA, {i + 1}º semestre, contra el asiento en la cuenta de MA que lleva MSA', h.cel(9, sem[i]),
                  dbe - hab, 'export «14.1 Cuentas con socios», Mercedes Areco, «Gastos Libertad (cuadro final)»', tol=0.05)
    control(h, 'entre PAM y MA', h.cel(10, tot), sum(L['entre']), 'export «Gastos Libertad», «Entre PAM y MA»')
    R['lib_tot'], R['lib_sem'] = tot, sem
    lib.item('5', 'Libertad — costo del ejercicio (50% MSA, 50% PAM hasta dic-25 y MA desde ene-26)', h, h.cel(2, tot), GRUPO_2,
             'quién pagó y la cuenta que le queda a cada una, mes por mes')
    lib.item('5a', 'Libertad: cuenta MSA ↔ PAM (positivo = PAM le debe a MSA)', h, h.cel(8, tot), GRUPO_2, 'está dentro del saldo del ítem 2')
    lib.item('5b', 'Libertad: cuenta MSA ↔ MA (positivo = MA le debe a MSA)', h, h.cel(9, tot), GRUPO_2, 'está dentro del saldo del ítem 1')
    lib.item('5c', 'Libertad: entre PAM y MA, sin pasar por MSA', h, h.cel(10, tot), GRUPO_2,
             'suma de las dos mitades (1er sem. PAM le debe a MA; 2do sem. MA le debe a PAM): no está en ninguna cuenta')
    dif = [(n, a, b) for n, a, b in (('PAM 1er sem.', sum(L['c_pam'][:6]), s(pm['lib_debe'], 'debe')),
                                     ('PAM 2do sem.', -sum(L['c_pam'][6:]), s(pm['lib_haber'], 'haber')),
                                     ('MA 1er sem.', -sum(L['c_ma'][:6]), s(pa['lib_haber'], 'haber')),
                                     ('MA 2do sem.', sum(L['c_ma'][6:]), s(pa['lib_debe'], 'debe'))) if abs(a - b) > 0.005]
    if dif:
        lib.pendiente('Libertad: los asientos en las cuentas de socios difieren en centavos del cuadro',
                      '; '.join(f'{n}: cuadro {ar(a)}, asiento {ar(b)}' for n, a, b in dif),
                      f'{ar(sum(abs(a - b) for _, a, b in dif))} en total: redondeo del asiento', H5)


# ---------------------------------------------------------------- G4 gastos cruzados
BLOQUES = [('MSA', 'MA', '4a'), ('MSA', 'PAM', '4b'), ('PAM', 'MA', '4c'), ('MA', 'PAM', '4d')]


def _g4(lib, h, X):
    cruz, R = X['cruz'], X['R']
    h.titulo('G4 · Gastos de una empresa pagados desde cuentas de otra — según el libro de Templates (ítem 4)')
    h.nota('Fuente: export «Templates» de las tres empresas, detalle de cuotas de cada agrupadora: se toman las cuotas del ejercicio '
           'cuyo «Pagado desde» (banco o tarjeta) es de otra empresa. «Tratamiento» dice dónde quedó cada una: si va por el cuadro de '
           'Libertad (G5), si está en la cuenta que MSA lleva de esa empresa (emparejada por fecha e importe con el export «14.1 '
           'Cuentas con socios»; los consumos de tarjeta, con el pago del resumen) o si no está. Entre PAM y MA ninguna de las dos '
           'lleva una cuenta: se anota el código con que PAM marcó el pago en su banco. No se modificó ningún importe.')
    h.blanco()
    h.seccion('4 · Resumen — quién pagó y de quién era el gasto')
    h.encabezado(['Ítem', 'Quién pagó → de quién era', 'Tratamiento', None, 'Cuotas', 'Importe', None, None])
    res = {}
    grupos = {}
    for paga, emp, sub in BLOQUES:
        qs = [q for q in cruz if q['paga'] == paga and q['emp'] == emp]
        ts = sorted({q['trat'] for q in qs}, key=lambda t: (not t.startswith('En la cuenta'), t))
        grupos[(paga, emp)] = [(t, [q for q in qs if q['trat'] == t]) for t in ts]
        a = h.r + 1
        for t, xs in grupos[(paga, emp)]:
            res[(paga, emp, t)] = fila(h, [None, None, t, None, len(xs), '=0'], comb={3: 4})
        res[(paga, emp)] = h.total(f'{sub} · Pagó {paga}, el gasto era de {emp}', {5: h.suma(5, a, h.r), 6: '=0'}, fmt={5: '#,##0'})
    fila(h, [None, 'Pagó MA, el gasto era de MSA', 'No son cuotas de template: 12 pagos con la caja de ahorro y la tarjeta de MA (G1, '
             'tabla 4)', None, None, None], comb={3: 5})
    fila(h, [None, 'Pagó PAM, el gasto era de MSA', 'No son cuotas de template: sueldos de JMS y AMS pagados por PAM (G6, tabla 6b) — a '
             'definir si son de MSA', None, None, None], comb={3: 5})
    r_tot = h.total('Total ítem 4 — cuotas de una empresa pagadas desde cuentas de otra',
                    {5: '=' + '+'.join(h.cel(5, res[(p, e)]) for p, e, _ in BLOQUES),
                     6: '=' + '+'.join(h.cel(6, res[(p, e)]) for p, e, _ in BLOQUES)}, clave=True, fmt={5: '#,##0'})
    r_de = {}
    for emp in ('MA', 'PAM'):
        bl = [(p, e) for p, e, _ in BLOQUES if e == emp]
        r_de[emp] = fila(h, [None, f'Control: cuotas de {emp} pagadas desde cuentas de otra empresa', None, None,
                             '=' + '+'.join(h.cel(5, res[b]) for b in bl), '=' + '+'.join(h.cel(6, res[b]) for b in bl)], comb={2: 4})
    R['g4_res_fin'] = h.r

    enc = ['Fecha', 'Concepto (template)', 'A quién · detalle y comprobante', 'Agrupadora', 'Pagado desde', 'Importe', 'Tratamiento',
           'Estado · marca']
    tot = {}
    primero = True
    for paga, emp, sub in BLOQUES:
        tot_t = []
        for t, xs in grupos[(paga, emp)]:
            h.blanco()
            h.seccion(f'{sub} · Pagó {paga}, el gasto era de {emp} — {t} ({len(xs)} cuotas)')
            h.encabezado(enc, repetir=primero)
            primero = False

            def armar(q, r):
                quien = ' · '.join(x for x in (q['prov'], q['det'], f"comp. {q['comp']}" if q['comp'] else '') if x)
                est = {'conciliado': 'conciliada', 'anterior': 'pagada'}.get(q['estado'], q['estado'])
                return [q['fecha'], q['concepto'], quien or 'sin dato', q['hoja'], q['banco'], float(q['imp']), q['trat'],
                        est + (f" · {q['marca']}" if q['marca'] else '')]
            subs = _por_mes(h, xs, lambda q: q['fecha'], armar, (6,), etiqueta_col=3)
            rt = h.total(f'Total {sub} — {t}', {6: h.suma_de(6, subs)}, col_etiqueta=3)
            tot[(paga, emp, t)] = rt
            tot_t.append(rt)
            h.celda(6, res[(paga, emp, t)]).value = f'={h.cel(6, rt)}'
        h.blanco()
        tot[(paga, emp)] = h.total(f'Total {sub} — pagó {paga}, el gasto era de {emp}', {6: h.suma_de(6, tot_t)}, clave=True,
                                   col_etiqueta=3)
        h.celda(6, res[(paga, emp)]).value = f'={h.cel(6, tot[(paga, emp)])}'
        control(h, f'{sub}: cuotas de {emp} pagadas desde cuentas de {paga}', h.cel(6, tot[(paga, emp)]),
                sum(q['imp'] for q in cruz if q['paga'] == paga and q['emp'] == emp),
                'export «Templates», detalle de cuotas, columna «Banco / cuenta»')
    h.blanco()
    # las cuotas de Libertad pagadas por otra, contra el cuadro de Libertad (otra fuente: «Gastos Libertad»)
    L = X['lib']
    for (paga, emp), valor, que in ((('MSA', 'PAM'), sum(L['msa'][:6]), '«Pagó MSA», 1er semestre'),
                                    (('MSA', 'MA'), sum(L['msa'][6:]), '«Pagó MSA», 2do semestre'),
                                    (('PAM', 'MA'), sum(L['pam'][6:]), '«Pagó PAM», 2do semestre'),
                                    (('MA', 'PAM'), sum(L['ma'][:6]), '«Pagó MA», 1er semestre')):
        if (paga, emp, T_LIB) in tot:
            control(h, f'cuotas de Libertad de {emp} pagadas por {paga}, contra el cuadro de Libertad', h.cel(6, tot[(paga, emp, T_LIB)]),
                    valor, f'export «Gastos Libertad», {que}')
    # controles del resumen contra el conteo hecho sobre el export
    for emp, esperado in (('MA', 26267632.57), ('PAM', 10729575.79)):
        control(h, f'cuotas de {emp} pagadas desde cuentas de otra empresa: resumen de esta hoja contra el conteo del libro de Templates',
                  h.cel(6, r_de[emp]), esperado, 'conteo del 15/11/2026 sobre el export «Templates»')
    R['g4'] = tot
    R['g4_item'] = r_tot
    lib.item('4', 'Gastos de una empresa pagados desde cuentas de otra (cuotas de Templates)', h, h.cel(6, r_tot), GRUPO_2,
             f"{len(cruz)} cuotas: {sum(1 for q in cruz if q['emp'] == 'MA')} de MA y {sum(1 for q in cruz if q['emp'] == 'PAM')} "
             'de PAM; ninguna de MSA')
    for paga, emp, sub in BLOQUES:
        n = sum(1 for q in cruz if q['paga'] == paga and q['emp'] == emp)
        lib.item(sub, f'Pagó {paga}, el gasto era de {emp}', h, h.cel(6, res[(paga, emp)]), GRUPO_2,
                 f'{n} cuotas; ' + '; '.join(f'{t.split(":")[0].split(" (")[0]}: {len(xs)}' for t, xs in grupos[(paga, emp)]))
    X['grupos'] = grupos


# ---------------------------------------------------------------- G6 sueldos
def _g6(lib, h, X):
    R, ex, pam = X['R'], X['extra'], X['pam']
    h.titulo('G6 · Sueldos y honorarios que cruzan empresas (ítem 6)')
    h.nota('Fuentes: la cuenta de Mercedes Areco que lleva MSA (export «14.1 Cuentas con socios»), los bancos de PAM, y el libro de '
           'sueldos de MSA (export «Sueldos» y sus pagos, consultados el 16/11/2026). El libro de sueldos de MSA incluye empleados '
           'que son de MA (Alondra Olivo) y de PAM (Celia Mabel Rojas), y a JMS y AMS como de las tres empresas. No hay un total '
           'general: son cuatro cosas distintas.')
    # 6a
    h.blanco()
    h.seccion('6a · Sueldo que MSA le devenga a Mercedes Areco — a favor de MA, sin pago')
    h.encabezado(['Fecha', 'Cuenta (según MSA)', 'Concepto', 'Qué dice MA', 'Estado', 'Según MSA', 'Visto desde MA', 'Diferencia (MA − MSA)'],
                 repetir=True)
    a = h.r + 1
    for m in X['ctas']['MA']['facturas']:
        r = h.r + 1
        fila(h, [m['f'], m['cuenta'], m['concepto'], 'sin factura ni otro registro en MA', 'a pagar', float(m['haber']), None,
                 f'={h.cel(7, r)}-{h.cel(6, r)}'])
    r6a = h.total('Total 6a — sueldo devengado a favor de MA', {k: h.suma(k, a, h.r) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)
    control(h, '6a: sueldo de MA contra el libro de sueldos de MSA', h.cel(6, r6a), X['sueldos'].get(('MSA', 'MA'), (0, 0))[0],
            'export «Sueldos», empleado «MA», bruto de julio 2025 a junio 2026')
    # 6b
    h.blanco()
    h.seccion('6b · Pagos «sueldo» de PAM a José María Martínez (JMS) y a Andrés Martínez (AMS)')
    h.encabezado(['Fecha', 'Cuenta de PAM', 'Detalle en el banco de PAM', 'En el libro de sueldos de MSA', 'Código en PAM',
                  'Según los bancos de PAM', 'Según el libro de sueldos de MSA', 'Diferencia'])
    soc = [m for m in pam['movs'] if m[7] in ('CTA JMS', 'CTA AMS')]
    pares = _parear(soc, ex['sueldos_pam_pago'], lambda m: (_d(m[1]), round(m[3], 2)), lambda p: (_d(p[2]), round(p[3], 2)))
    a = h.r + 1
    for m, p in pares:
        r = h.r + 1
        fila(h, [_d(m[1]) if m else _d(p[2]), 'Cta. cte.' if m else None,
                 f"{m[6]} — {m[11]}" if m else 'no está en los bancos de PAM',
                 f"{p[0]} {p[1]} · {p[4]} ({p[6]})" if p else 'no está en el libro de sueldos', m[7] if m else None,
                 float(m[3]) if m else None, float(p[3]) if p else None, f'={h.cel(6, r)}-{h.cel(7, r)}'])
    r6b = h.total('Total 6b — pagado por PAM a JMS y a AMS', {k: h.suma(k, a, h.r) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)
    tq = pam['totales_consulta']
    control(h, '6b: pagos de PAM a JMS y AMS', h.cel(6, r6b), tq['pagos_jms'] + tq['pagos_ams'],
            'consulta a los extractos de PAM (códigos CTA JMS y CTA AMS)')
    h.nota('En el libro de sueldos de MSA estos cuatro pagos figuran como sueldo PAGADO de noviembre y diciembre 2025 de JMS y de AMS '
           '(tres dicen «pagado por PAM (cta cte)»; el premio del 28/11/2025 no dice quién pagó). En la cuenta de la Sucesión que '
           'lleva MSA no hay ningún aporte de PAM por estos importes: hoy no están en el saldo MSA ↔ PAM.')
    # 6c
    h.blanco()
    h.seccion('6c · Alondra Olivo — empleada de MA en el libro de sueldos de MSA: lo pagado y lo cargado a la cuenta de MA')
    h.encabezado(['Fecha', 'Pagado con', 'Concepto', 'En la cuenta de MA que lleva MSA', 'Estado del pago',
                  'Según el libro de sueldos', 'Cargado a la cuenta de MA', 'Diferencia'])
    ter = [m for m in X['ctas']['MA']['terceros'] if not m['cuotas']]
    usados = []
    a = h.r + 1
    n_caja = caja = despues = 0.0
    for per, f, monto, tipo, medio, est, desc in sorted(ex['alondra'], key=lambda p: p[1]):
        m = next((x for x in ter if x not in usados and abs(x['debe'] - monto) < 0.01 and abs((x['f'] - _d(f)).days) <= 3), None)
        if m:
            usados.append(m)
            m['alondra'] = True
        r = h.r + 1
        if not m and medio != 'banco':
            caja += monto
            n_caja += 1
        if not m and medio == 'banco':
            despues += monto
        fila(h, [_d(f), 'Banco de MSA' if medio == 'banco' else 'Caja Sigot (efectivo de MSA)', f'{tipo.capitalize()} {per} · {desc}',
                 f"sí: {m['f'].strftime('%d/%m/%Y')} · {m['concepto']}" if m else 'no figura', est, float(monto),
                 float(m['debe']) if m else None, f'={h.cel(6, r)}-{h.cel(7, r)}'])
    r6c = h.total('Total 6c — Alondra Olivo', {k: h.suma(k, a, h.r) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)
    control(h, '6c: pagado a Alondra Olivo contra el libro de sueldos', h.cel(6, r6c), X['sueldos'].get(('MA', 'Alondra Olivo'), (0, 0))[1],
            'export «Sueldos», Alondra Olivo, columna «Pagado»')
    X['alondra'] = dict(caja=caja, n_caja=int(n_caja), despues=despues, cargado=sum(m['debe'] for m in usados), n=len(usados))
    # 6d
    h.blanco()
    h.seccion('6d · Celia Mabel Rojas — empleada de PAM en el libro de sueldos de MSA, pagada por los bancos de PAM')
    h.encabezado(['Fecha', 'Cuenta de PAM', 'Detalle en el banco de PAM', 'En el libro de sueldos de MSA', 'Código en PAM',
                  'Según los bancos de PAM', 'Según el libro de sueldos de MSA', 'Diferencia'])
    mab = [m for m in pam['movs'] if 'mabel' in ((m[6] or '') + ' ' + (m[10] or '')).lower()]
    pares = _parear(mab, ex['mabel'], lambda m: (_d(m[1]), round(m[3], 2)), lambda p: (_d(p[1]), round(p[2], 2)))
    a = h.r + 1
    for m, p in pares:
        r = h.r + 1
        fila(h, [_d(m[1]) if m else _d(p[1]), ('Caja ahorro' if m[0] == 'CA' else 'Cta. cte.') if m else None,
                 f"{m[6]} — {m[10] or m[11]}" if m else 'no está en los bancos de PAM', f"{p[0]} · {p[3]}" if p else 'no está en el libro',
                 'sin código' if m else None, float(m[3]) if m else None, float(p[2]) if p else None, f'={h.cel(6, r)}-{h.cel(7, r)}'])
    r6d = h.total('Total 6d — Mabel Rojas', {k: h.suma(k, a, h.r) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)
    control(h, '6d: pagos a Mabel Rojas', h.cel(6, r6d), tq['mabel'], 'consulta a los extractos de PAM (detalle o beneficiario «Mabel»)')
    R.update(r6a=r6a, r6b=r6b, r6c=r6c, r6d=r6d)
    lib.item('6', 'Sueldos y honorarios que cruzan empresas', h, None, GRUPO_2, 'cuatro casos distintos; sin total general')
    lib.item('6a', 'Sueldo que MSA le devenga a MA (a pagar)', h, h.cel(6, r6a), GRUPO_2, 'está dentro del saldo del ítem 1; en MA no figura')
    lib.item('6b', 'Pagos «sueldo» de PAM a JMS y a AMS', h, h.cel(6, r6b), GRUPO_2,
             'en el libro de sueldos de MSA figuran como pagados; no están en la cuenta MSA ↔ PAM')
    lib.item('6c', 'Alondra Olivo (empleada de MA): pagado según el libro de sueldos de MSA', h, h.cel(6, r6c), GRUPO_2,
             'lo pagado por banco está cargado a la cuenta de MA; lo de Caja Sigot no')
    lib.item('6d', 'Mabel Rojas (empleada de PAM): pagado por los bancos de PAM', h, h.cel(6, r6d), GRUPO_2,
             'figura en el libro de sueldos de MSA; no toca la cuenta MSA ↔ PAM')


# ---------------------------------------------------------------- tablas comunes de G1 y G2
def _tabla_terceros(lib, h, X, emp, titulo):
    """Renglones de la cuenta (pagos de MSA a terceros por cuenta de `emp`) contra las cuotas de Templates."""
    h.blanco()
    h.seccion(titulo)
    h.encabezado(['Fecha', 'Cuenta (según MSA)', 'Concepto en la cuenta que lleva MSA', 'Respaldo en el libro de Templates',
                  'Qué es', 'En la cuenta que lleva MSA', 'Según Templates', 'Diferencia (cuenta − Templates)'])

    def armar(m, r):
        if m['cuotas']:
            resp = ' + '.join(f"{q['concepto']} ({q['emp']} · {q['hoja']}, {q['fecha'].strftime('%d/%m/%Y')})" for q in m['cuotas'])
            emps = sorted({q['emp'] for q in m['cuotas']})
            que = 'cuota de ' + ' y '.join(emps)
        else:
            resp = 'sin cuota de template: ' + (m['agrup'] or 'sin agrupadora')
            que = 'sueldo (G6)' if m.get('alondra') else 'sin cuota'
        return [m['f'], m['cuenta'], m['concepto'], resp, que, float(m['debe']),
                float(round(sum(q['imp'] for q in m['cuotas']), 2)) if m['cuotas'] else None, f'={h.cel(6, r)}-{h.cel(7, r)}']
    subs = _por_mes(h, X['ctas'][emp]['terceros'], lambda m: m['f'], armar, (6, 7, 8), etiqueta_col=3)
    return h.total(f'Total — pagos de MSA a terceros por cuenta de {emp}', {k: h.suma_de(k, subs) for k in (6, 7, 8)}, clave=True,
                   col_etiqueta=3)


def _puente(h, X, emp, r_ter, otras):
    """De las cuotas de Templates pagadas por MSA a lo que está en la cuenta: lo que sobra o falta. Devuelve el renglón final."""
    g4 = X['R']['g4']
    ref = lambda k: f"='{H4}'!{X['R']['h4'].cel(6, g4[k])}" if k in g4 else 0.0  # noqa: E731
    t_cta, t_cta_otra = T_CTA.format(emp), None
    h.blanco()
    h.seccion(f'Puente — de las cuotas de {emp} pagadas por MSA según Templates a lo que hay en la cuenta que lleva MSA')
    h.encabezado(['', None, 'Concepto', None, None, 'Importe', None, None])
    f1 = fila(h, [None, None, f'Cuotas de {emp} pagadas desde cuentas de MSA, según Templates (G4)', None, None,
                  ref(('MSA', emp))], comb={3: 5})
    quita = []
    for k in [k for k in g4 if len(k) == 3 and k[0] == 'MSA' and k[1] == emp and not k[2].startswith(t_cta)]:
        quita.append(fila(h, [None, None, f'Menos: {k[2]}', None, None, ref(k)], comb={3: 5}))
    suma = []
    for k in [k for k in g4 if len(k) == 3 and k[0] == 'MSA' and k[1] != emp and k[2].startswith(t_cta)]:
        suma.append(fila(h, [None, None, f'Más: cuotas de {k[1]} que MSA cargó a la cuenta de {emp} (G4)', None, None, ref(k)], comb={3: 5}))
    f2 = h.total(f'Cuotas de Templates que están en la cuenta de {emp}',
                 {6: f'={h.cel(6, f1)}' + ''.join(f'-{h.cel(6, r)}' for r in quita) + ''.join(f'+{h.cel(6, r)}' for r in suma)},
                 col_etiqueta=3)
    f3 = fila(h, [None, None, 'Más: renglones de la cuenta sin cuota de template (columna «Diferencia» de la tabla de arriba)', None, None,
                  f'={h.cel(8, r_ter)}'], comb={3: 5})
    f4 = h.total(f'Pagos de MSA a terceros por cuenta de {emp}, en la cuenta que lleva MSA', {6: f'={h.cel(6, f2)}+{h.cel(6, f3)}'},
                 col_etiqueta=3)
    control(h, f'puente de {emp}: cuotas de Templates en la cuenta contra la columna «Según Templates» de la tabla',
              f'{h.cel(6, f2)}-{h.cel(7, r_ter)}', 0.0, 'G4 contra la tabla de arriba (tiene que dar cero)')
    control(h, f'puente de {emp}: llega al total de la tabla', f'{h.cel(6, f4)}-{h.cel(6, r_ter)}', 0.0,
              'puente contra la tabla de arriba (tiene que dar cero)')
    return f4


def _resumen(h, titulo, col6, col7, filas):
    """Tabla resumen de un par. filas = [(texto, signo)] ; devuelve (renglones, total)."""
    h.blanco()
    h.seccion(titulo)
    h.encabezado(['Tipo de movimiento', None, None, None, 'Suma o resta', col6, col7, 'Diferencia'])
    rs = []
    for texto, signo in filas:
        r = h.r + 1
        rs.append(fila(h, [texto, None, None, None, 'suma' if signo > 0 else 'resta', '=0', '=0', f'={h.cel(7, r)}-{h.cel(6, r)}'],
                       comb={1: 4}))
    f = {c: '=' + ''.join(('+' if s > 0 else '-') + h.cel(c, r) for (t, s), r in zip(filas, rs)).lstrip('+') for c in (6, 7)}
    f[8] = f'={h.cel(7, h.r + 1)}-{h.cel(6, h.r + 1)}'
    return rs, f


# ---------------------------------------------------------------- G1 MSA-MA
def _g1(lib, h, X):
    R, cl, ma = X['R'], X['ctas']['MA'], X['ma']
    dice = ma['msa_dice']
    s = lambda xs, k: sum(x[k] for x in xs)  # noqa: E731
    h.titulo('G1 · MSA ↔ MA — la cuenta entre las dos, lado a lado (ítem 1)')
    h.nota('«Según MSA» = la cuenta de Mercedes Areco que lleva MSA (export «14.1 Cuentas con socios»). «Visto desde MA» = lo que pasó '
           'por la caja de ahorro Galicia y la tarjeta de MA (cargadas desde el 07/10/2025): MA no lleva una cuenta con MSA. Signo del '
           'saldo, el de MSA: negativo = MA le debe a MSA. Cada renglón del resumen viene del total de su tabla, más abajo.')
    filas = [('a) Transferencias de MSA a MA («Retiros / Distribución socios») — tabla 2', -1),
             ('b) Gastos de MA (y otros) pagados por MSA a terceros y cargados a la cuenta de MA — tabla 3', -1),
             ('c) Libertad: lo que MSA le carga a MA, neto (2do semestre «retiró» menos 1er semestre «aportó») — tabla 5 y G5', -1),
             ('d) Sueldo que MSA le devenga a MA (a pagar) — G6, tabla 6a', 1),
             ('e) Gastos de MSA pagados por MA con su caja de ahorro y su tarjeta — tabla 4', 1)]
    rs, f = _resumen(h, '1 · Resumen — cómo se forma el saldo del ejercicio (saldo al inicio: 0 en las dos)', 'Según MSA',
                     'Visto desde MA', filas)
    r_sal = h.total('Saldo al 30/06/2026 = d + e − a − b − c (negativo = MA le debe a MSA)', f, clave=True)
    r_anx = fila(h, ['Anexo: renglones que están en lo enviado al contador de MSA y todavía no en el sistema (albañil del chalet '
                     '16 y 19/05/2026; internet y dos seguros del chalet por la tarjeta de MSA)', None, None, None, 'suma',
                     float(dice['anexo'])], comb={1: 4})
    r_env = h.total('Saldo de la cuenta de MA como se envió al contador de MSA', {6: f'={h.cel(6, r_sal)}+{h.cel(6, r_anx)}'})
    control(h, 'saldo de MA según el sistema de MSA', h.cel(6, r_sal), X['resumen']['Mercedes Areco']['cierre'],
            'export «14.1 Cuentas con socios», resumen, Mercedes Areco, saldo al cierre')
    control(h, 'saldo de MA como se envió al contador', h.cel(6, r_env), dice['saldo_enviado'], 'papel enviado «Cuentas de socios»')
    h.nota('La diferencia entre las dos miradas se explica entera por b), c) y d): son pagos a terceros, un asiento de Libertad y un '
           'sueldo devengado que MSA anota y que no pasan por ninguna cuenta bancaria de MA. En a) y e) las dos dicen lo mismo.')

    # 2 · transferencias
    h.blanco()
    h.seccion('2 · Transferencias de MSA a MA — cada una, por mes, según MSA y según el banco de MA')
    h.encabezado(['Fecha', 'De → a', 'Concepto según MSA', 'Según el banco de MA', 'Código en MA', 'Según MSA', 'Visto desde MA',
                  'Diferencia (MA − MSA)'], repetir=True)
    pares = _parear(cl['retiros'], ma['de_msa'], lambda m: (m['f'], round(m['debe'], 2)), lambda v: (_d(v[0]), round(v[6], 2)))
    subs = _lado_a_lado(h, pares, lambda m: (m['f'], m['debe']), lambda v: (_d(v[0]), v[6]),
                        lambda a, b: ['MSA Galicia cta. cte. → caja de ahorro Galicia de MA', a['concepto'] if a else 'no figura en MSA',
                                      f'{b[2]} — {b[3]}' if b else 'no figura en el banco de MA', f'{b[4]} / {b[5]}' if b else None])
    r_t2 = h.total(f"Total a — transferencias de MSA a MA ({len(cl['retiros'])} según MSA; {len(ma['de_msa'])} según MA)",
                   {k: h.suma_de(k, subs) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)
    control(h, 'transferencias de MSA a MA: las dos miradas (la diferencia tiene que ser cero)', h.cel(8, r_t2), 0.0,
            'cuenta de socio en MSA contra la caja de ahorro Galicia de MA')

    # 3 · terceros + puente
    r_t3 = _tabla_terceros(lib, h, X, 'MA', '3 · Pagos de MSA a terceros cargados a la cuenta de MA — renglón por renglón, contra las cuotas '
                           'del libro de Templates')
    h.nota('«Diferencia» = lo que está en la cuenta y no tiene cuota de template que lo respalde (anticipos y haberes de Alondra Olivo, '
           'pintura, una factura en efectivo, una compra por error). Los consumos de la tarjeta de MSA se cargan en la fecha en que se '
           'paga el resumen; la cuota de Templates lleva la fecha del consumo.')
    r_p3 = _puente(h, X, 'MA', r_t3, None)

    # 4 · MA pagó por MSA
    h.blanco()
    h.seccion('4 · Gastos de MSA pagados por MA — con su caja de ahorro y con su tarjeta, por mes')
    h.encabezado(['Fecha', 'Pagado con', 'Concepto según MSA', 'Según las cuentas de MA', 'Código en MA', 'Según MSA', 'Visto desde MA',
                  'Diferencia (MA − MSA)'])
    pares = _parear(cl['pago_por_msa'], ma['por_msa'], lambda m: (m['f'], round(m['haber'], 2)), lambda v: (_d(v[0]), round(v[6], 2)))
    subs = _lado_a_lado(h, pares, lambda m: (m['f'], m['haber']), lambda v: (_d(v[0]), v[6]),
                        lambda a, b: [a['cuenta'] if a else b[1], f"{a['agrup']} · {a['concepto']}" if a else 'no figura en MSA',
                                      f'{b[2]} — {b[3]}' if b else 'no figura en las cuentas de MA', (b[4] or None) if b else None])
    r_t4 = h.total(f"Total e — gastos de MSA pagados por MA ({len(cl['pago_por_msa'])} según MSA; {len(ma['por_msa'])} según MA)",
                   {k: h.suma_de(k, subs) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)
    control(h, 'gastos de MSA pagados por MA: las dos miradas (la diferencia tiene que ser cero)', h.cel(8, r_t4), 0.0,
            'cuenta de socio en MSA contra la caja de ahorro y la tarjeta de MA')
    h.nota('No son cuotas de template de MSA: en el libro de Templates de MSA ninguna cuota del ejercicio figura pagada desde una cuenta '
           'de MA o de PAM. Son facturas y gastos de MSA con el código «CTA MSA» en las cuentas de MA.')

    # 5 · Libertad
    h.blanco()
    h.seccion('5 · Libertad — los dos asientos en la cuenta de MA que lleva MSA, contra el cuadro de Libertad (G5)')
    h.encabezado(['Fecha', 'Cuenta (según MSA)', 'Concepto', 'Cuadro de Libertad (G5)', 'Sentido', 'Según MSA (+ carga a MA)',
                  'Según el cuadro (G5)', 'Diferencia'])
    h5 = R['h5']
    a = h.r + 1
    for i, (ms, sg) in enumerate(((cl['lib_haber'], -1), (cl['lib_debe'], 1))):
        for m in ms:
            r = h.r + 1
            fila(h, [m['f'], m['cuenta'], m['concepto'].split(' — ')[0], f'{i + 1}º semestre, columna «Cuenta MSA ↔ MA»',
                     'a favor de MA' if sg < 0 else 'carga a MA', float(sg * (m['haber'] or m['debe'])),
                     f"='{H5}'!{h5.cel(9, R['lib_sem'][i])}", f'={h.cel(6, r)}-{h.cel(7, r)}'])
    r_t5 = h.total('Total c — Libertad, neto cargado a MA', {k: h.suma(k, a, h.r) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)
    control(h, 'Libertad en la cuenta de MA contra el cuadro (centavos de redondeo del asiento)', h.cel(8, r_t5), 0.0,
              'G5 Libertad, cuenta MSA ↔ MA', tol=0.05)

    # vínculos del resumen
    h6 = R['h6']
    for c, v in ((6, f'={h.cel(6, r_t2)}'), (7, f'={h.cel(7, r_t2)}')):
        h.celda(c, rs[0]).value = v
    h.celda(6, rs[1]).value = f'={h.cel(6, r_t3)}'
    h.celda(7, rs[1]).value = 0.0
    h.celda(6, rs[2]).value = f'={h.cel(6, r_t5)}'
    h.celda(7, rs[2]).value = 0.0
    h.celda(6, rs[3]).value = f"='{H6}'!{h6.cel(6, R['r6a'])}"
    h.celda(7, rs[3]).value = 0.0
    for c in (6, 7):
        h.celda(c, rs[4]).value = f'={h.cel(c, r_t4)}'
    R['g1'] = dict(sal=r_sal, env=r_env, rs=rs, t3=r_t3)

    sal_py = (s(cl['facturas'], 'haber') + s(cl['pago_por_msa'], 'haber') + s(cl['lib_haber'], 'haber') - s(cl['retiros'], 'debe')
              - s(cl['terceros'], 'debe') - s(cl['lib_debe'], 'debe'))
    X['py']['g1'] = dict(msa=sal_py, ma=s(ma['por_msa'], 6) - s(ma['de_msa'], 6), ter=s(cl['terceros'], 'debe'),
                         ter_tpl=sum(q['imp'] for m in cl['terceros'] for q in m['cuotas']))
    lib.item('1', 'MSA ↔ MA — saldo al 30/06/2026 según MSA, el sistema (negativo = MA le debe a MSA)', h, h.cel(6, r_sal), GRUPO_1,
             'sueldo devengado + pagos de MA por MSA − transferencias − pagos a terceros − Libertad')
    lib.item('1a', 'MSA ↔ MA — lo mismo, visto desde las cuentas de MA', h, h.cel(7, r_sal), GRUPO_1,
             'sólo lo que pasó por su caja de ahorro y su tarjeta')
    lib.item('1b', 'MSA ↔ MA — diferencia entre las dos miradas (MA − MSA)', h, h.cel(8, r_sal), GRUPO_1,
             'se explica por lo que MSA anota y no pasa por los bancos de MA')
    lib.item('1c', 'MSA ↔ MA — saldo como se envió al contador de MSA', h, h.cel(6, r_env), GRUPO_1, 'sistema + anexo de lo enviado')


# ---------------------------------------------------------------- G2 MSA-PAM
def _g2(lib, h, X):
    R, cl, pam = X['R'], X['ctas']['PAM'], X['pam']
    sm = pam['segun_msa']
    s = lambda xs, k: sum(x[k] for x in xs)  # noqa: E731
    h.titulo('G2 · MSA ↔ PAM — la cuenta entre las dos, lado a lado (ítem 2)')
    h.nota('«Según MSA» = la cuenta de la Sucesión de Plácido Martínez que lleva MSA (export «14.1 Cuentas con socios»). «Visto desde '
           'PAM» = lo que pasó por la caja de ahorro y la cuenta corriente de la Sucesión: PAM no lleva una cuenta con MSA. Signo del '
           'saldo, el de MSA: negativo = PAM le debe a MSA. El sistema arranca la cuenta en 0: ver Pendientes (saldo de inicio).')
    filas = [('a) Retiros: transferencias de MSA a PAM — tabla 2', -1),
             ('b) Aportes: transferencias de PAM a MSA — tabla 2', 1),
             ('c) Gastos de PAM pagados por MSA a terceros y cargados a la cuenta de PAM — tabla 3', -1),
             ('d) Libertad: lo que MSA le carga a PAM, neto (1er semestre «retiró» menos 2do semestre «aportó») — tabla 5 y G5', -1),
             ('e) Factura C 2-31 de la Sucesión a MSA (arrendamiento), acreditada en la cuenta — tabla 4', 1)]
    rs, f = _resumen(h, '1 · Resumen — cómo se forma el saldo del ejercicio (saldo al inicio: 0 según el sistema)', 'Según MSA',
                     'Visto desde PAM', filas)
    r_sal = h.total('Saldo al 30/06/2026 = b + e − a − c − d (negativo = PAM le debe a MSA)', f, clave=True)
    control(h, 'saldo de PAM según el sistema de MSA', h.cel(6, r_sal), X['resumen']['Sucesión de Plácido Martínez']['cierre'],
            'export «14.1 Cuentas con socios», resumen, Sucesión, saldo al cierre')
    h.nota('La diferencia entre las dos miradas se explica por c), d) y e): gastos, Libertad y una factura que MSA anota y que no '
           'pasan por los bancos de PAM. Fuera de este saldo, en las dos: los sueldos de JMS y AMS pagados por PAM (G6, tabla 6b) y la '
           f"apertura del contador de MSA «Socio Plácido Martínez» por {ar(sm['apertura_contador_socio_placido'])} al 30/06/2025.")

    # 2 · transferencias
    h.blanco()
    h.seccion('2 · Transferencias entre MSA y PAM — cada una, por mes, según MSA y según los bancos de PAM')
    h.encabezado(['Fecha', 'Sentido', 'Concepto según MSA', 'Según los bancos de PAM', 'Código en PAM', 'Según MSA (+ retiro, − aporte)',
                  'Visto desde PAM (+ retiro, − aporte)', 'Diferencia (PAM − MSA)'], repetir=True)
    de_pam = [m for m in pam['movs'] if m[5] in ('Retiro de MSA', 'Aporte a MSA')]
    A = cl['retiros'] + cl['aportes']
    ka = lambda m: (m['f'], round(m['debe'] - m['haber'], 2))  # noqa: E731
    kb = lambda m: (_d(m[1]), round(m[4] - m[3], 2))  # noqa: E731
    subs = _lado_a_lado(h, _parear(A, de_pam, ka, kb), ka, kb,
                        lambda a, b: [('MSA → PAM (retiro)' if (a['debe'] if a else b[4]) else 'PAM → MSA (aporte)'),
                                      a['concepto'] if a else 'no figura en MSA',
                                      (f"{'Caja ahorro' if b[0] == 'CA' else 'Cta. cte.'} · {b[6] or b[2]} — {b[11]}" if b
                                       else 'no figura en los bancos de PAM'), ' / '.join(x for x in (b[7], b[8]) if x) if b else None])
    r_t2 = h.total(f"Total transferencias, neto = retiros − aportes ({len(A)} según MSA; {len(de_pam)} según PAM)",
                   {k: h.suma_de(k, subs) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)
    r_ret = fila(h, [None, None, f"de eso, a) retiros: {len(cl['retiros'])} transferencias de MSA a PAM", None, None,
                     float(s(cl['retiros'], 'debe')), float(sum(m[4] for m in de_pam))], comb={3: 5})
    r_apo = fila(h, [None, None, f"de eso, b) aportes: {len(cl['aportes'])} transferencias de PAM a MSA", None, None,
                     float(s(cl['aportes'], 'haber')), float(sum(m[3] for m in de_pam))], comb={3: 5})
    control(h, 'transferencias: retiros − aportes da el neto de la tabla (según MSA)',
              f'{h.cel(6, r_ret)}-{h.cel(6, r_apo)}-{h.cel(6, r_t2)}', 0.0, 'tabla de arriba (tiene que dar cero)')
    control(h, 'transferencias: retiros − aportes da el neto de la tabla (según PAM)',
              f'{h.cel(7, r_ret)}-{h.cel(7, r_apo)}-{h.cel(7, r_t2)}', 0.0, 'tabla de arriba (tiene que dar cero)')
    control(h, 'transferencias entre MSA y PAM: las dos miradas (la diferencia tiene que ser cero)', h.cel(8, r_t2), 0.0,
            'cuenta de socio en MSA contra los bancos de PAM')

    # 3 · terceros + puente
    r_t3 = _tabla_terceros(lib, h, X, 'PAM', '3 · Pagos de MSA a terceros cargados a la cuenta de PAM — renglón por renglón, contra las '
                           'cuotas del libro de Templates')
    _puente(h, X, 'PAM', r_t3, None)

    # 4 · factura
    h.blanco()
    h.seccion('4 · Factura de la Sucesión a MSA acreditada en la cuenta')
    h.encabezado(['Fecha', 'Cuenta (según MSA)', 'Concepto', 'Qué dice PAM', 'Estado', 'Según MSA', 'Visto desde PAM', 'Diferencia (PAM − MSA)'])
    a = h.r + 1
    for m in cl['facturas']:
        r = h.r + 1
        fila(h, [m['f'], m['cuenta'], f"Factura C {m['concepto']} (arrendamiento)", 'no se cobró por banco; la factura no está cargada en PAM',
                 'acreditada', float(m['haber']), None, f'={h.cel(7, r)}-{h.cel(6, r)}'])
    r_t4 = h.total('Total e — facturas de PAM a MSA', {k: h.suma(k, a, h.r) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)

    # 5 · Libertad
    h.blanco()
    h.seccion('5 · Libertad — los dos asientos en la cuenta de PAM que lleva MSA, contra el cuadro de Libertad (G5)')
    h.encabezado(['Fecha', 'Cuenta (según MSA)', 'Concepto', 'Cuadro de Libertad (G5)', 'Sentido', 'Según MSA (+ carga a PAM)',
                  'Según el cuadro (G5)', 'Diferencia'])
    h5 = R['h5']
    a = h.r + 1
    for i, (ms, sg) in enumerate(((cl['lib_debe'], 1), (cl['lib_haber'], -1))):
        for m in ms:
            r = h.r + 1
            fila(h, [m['f'], m['cuenta'], m['concepto'].split(' — ')[0], f'{i + 1}º semestre, columna «Cuenta MSA ↔ PAM»',
                     'a favor de PAM' if sg < 0 else 'carga a PAM', float(sg * (m['haber'] or m['debe'])),
                     f"='{H5}'!{h5.cel(8, R['lib_sem'][i])}", f'={h.cel(6, r)}-{h.cel(7, r)}'])
    r_t5 = h.total('Total d — Libertad, neto cargado a PAM', {k: h.suma(k, a, h.r) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)
    control(h, 'Libertad en la cuenta de PAM contra el cuadro (centavos de redondeo del asiento)', h.cel(8, r_t5), 0.0,
              'G5 Libertad, cuenta MSA ↔ PAM', tol=0.05)

    for c in (6, 7):
        h.celda(c, rs[0]).value = f'={h.cel(c, r_ret)}'
        h.celda(c, rs[1]).value = f'={h.cel(c, r_apo)}'
    h.celda(6, rs[2]).value = f'={h.cel(6, r_t3)}'
    h.celda(7, rs[2]).value = 0.0
    h.celda(6, rs[3]).value = f'={h.cel(6, r_t5)}'
    h.celda(7, rs[3]).value = 0.0
    h.celda(6, rs[4]).value = f'={h.cel(6, r_t4)}'
    h.celda(7, rs[4]).value = 0.0
    R['g2'] = dict(sal=r_sal, rs=rs, t3=r_t3)
    sal_py = (s(cl['facturas'], 'haber') + s(cl['aportes'], 'haber') + s(cl['lib_haber'], 'haber') - s(cl['retiros'], 'debe')
              - s(cl['terceros'], 'debe') - s(cl['lib_debe'], 'debe'))
    X['py']['g2'] = dict(msa=sal_py, pam=sum(m[3] - m[4] for m in de_pam), ter=s(cl['terceros'], 'debe'),
                         ter_tpl=sum(q['imp'] for m in cl['terceros'] for q in m['cuotas']))
    lib.item('2', 'MSA ↔ PAM — saldo al 30/06/2026 según MSA, el sistema (negativo = PAM le debe a MSA)', h, h.cel(6, r_sal), GRUPO_1,
             'factura + aportes − retiros − gastos pagados por MSA − Libertad; arranca en 0')
    lib.item('2a', 'MSA ↔ PAM — lo mismo, visto desde los bancos de PAM', h, h.cel(7, r_sal), GRUPO_1, 'aportes − retiros')
    lib.item('2b', 'MSA ↔ PAM — diferencia entre las dos miradas (PAM − MSA)', h, h.cel(8, r_sal), GRUPO_1,
             'se explica por lo que MSA anota y no pasa por los bancos de PAM')


# ---------------------------------------------------------------- G3 PAM-MA
def _g3(lib, h, X):
    R, pam, ma, ex = X['R'], X['pam'], X['ma'], X['extra']
    g4, h4 = R['g4'], R['h4']
    h.titulo('G3 · PAM ↔ MA — lo que hay entre las dos, lado a lado (ítem 3)')
    h.nota('Ninguna de las dos lleva una cuenta con la otra. «Según PAM» = lo que salió de la caja de ahorro y la cuenta corriente de '
           'la Sucesión con la categoría «Distribución Mamá». «Visto desde MA» = lo que entró a la caja de ahorro Galicia de MA '
           '(cargada desde el 07/10/2025) con el CUIT de la Sucesión. Positivo = plata que PAM puso para MA. Los gastos cruzados, '
           'Libertad y las transferencias «a cuenta Cotitulares» van aparte, más abajo: hoy no están en ninguna cuenta.')
    # 1 · giros
    h.blanco()
    h.seccion('1 · Giros de PAM a MA («Retiro MA mensual PAM») — cada uno, por mes, según PAM y según el banco de MA')
    h.encabezado(['Fecha', 'Cuenta de PAM', 'Detalle según PAM', 'Según el banco de MA', 'Código PAM · MA', 'Según PAM', 'Visto desde MA',
                  'Diferencia (MA − PAM)'], repetir=True)
    giros = [m for m in pam['movs'] if m[5] == 'Distribucion Mama' and m[7] != 'CTA COTITULARES']
    ka = lambda m: (_d(m[1]), round(m[3], 2))  # noqa: E731
    kb = lambda v: (_d(v[0]), round(v[6], 2))  # noqa: E731
    subs = _lado_a_lado(h, _parear(giros, ma['de_pam'], ka, kb), ka, kb,
                        lambda a, b: [('Caja ahorro' if a[0] == 'CA' else 'Cta. cte.') if a else None,
                                      f'{a[6]} — {a[11]}' if a else 'no figura en PAM',
                                      f'{b[2]} — {b[3]}' if b else 'no entró a la caja de ahorro Galicia de MA',
                                      ' · '.join(x for x in ((a[7] if a else None), (b[4] if b else None)) if x)])
    r_t1 = h.total(f"Total ítem 3 — giros de PAM a MA ({len(giros)} según PAM; {len(ma['de_pam'])} según MA)",
                   {k: h.suma_de(k, subs) for k in (6, 7, 8)}, clave=True, col_etiqueta=3)
    r_bp = fila(h, [None, None, 'Lo que el balance propio de MA toma como deuda con PAM al 30/06/2026', None, None, None,
                    float(ma['foto_pam_3006'])], comb={3: 5})
    control(h, 'giros según PAM', h.cel(6, r_t1), pam['totales_consulta']['giros_a_ma'],
            'consulta a los extractos de PAM (categoría «Distribución Mamá»)')
    control(h, 'giros según PAM contra la deuda con PAM del balance propio de MA', f'{h.cel(6, r_t1)}-{h.cel(7, r_bp)}', 0.0,
              'balance propio de MA al 30/06/2026 (tiene que dar cero)')
    nv = ma['pam_no_visto']
    control(h, 'diferencia entre las dos miradas: el giro al Banco Francés, que no está cargado', h.cel(8, r_t1), -float(nv['importe']),
              f"giro del {_d(nv['fecha']).strftime('%d/%m/%Y')} a la cuenta de MA en el Banco Francés (dato de JMS)")

    # 2 · cotitulares
    h.blanco()
    h.seccion('2 · Transferencias «A cuenta Cotitulares» de PAM a una cuenta a nombre de Mercedes Areco — aparte, no son giros a MA')
    h.encabezado(['Fecha', 'Cuenta de PAM', 'Detalle según PAM', 'Según el banco de MA', 'Código en PAM', 'Según PAM', 'Visto desde MA',
                  'Diferencia (MA − PAM)'])
    cot = [m for m in pam['movs'] if m[7] == 'CTA COTITULARES']
    a = h.r + 1
    for m in sorted(cot, key=lambda m: m[1]):
        r = h.r + 1
        fila(h, [_d(m[1]), 'Cta. cte.', f'{m[6]} — {m[11]}', 'no entró a la caja de ahorro Galicia de MA', m[7], float(m[3]), None,
                 f'={h.cel(7, r)}-{h.cel(6, r)}'])
    r_t2 = h.total(f'Total — «a cuenta Cotitulares» ({len(cot)} transferencias)', {k: h.suma(k, a, h.r) for k in (6, 7, 8)}, clave=True,
                   col_etiqueta=3)
    control(h, '«a cuenta Cotitulares» según PAM', h.cel(6, r_t2), pam['totales_consulta']['a_cuenta_cotitulares'],
            'consulta a los extractos de PAM (código CTA COTITULARES)')
    cr = ex['ma_galicia']['creditos_oct_2025']
    h.nota('Verificado en el banco de MA: en octubre de 2025 la caja de ahorro Galicia de MA sólo recibió '
           + '; '.join(f"{ar(c[2])} el {_d(c[0]).strftime('%d/%m/%Y')} ({c[3]})" for c in cr)
           + f". Los {ar(sum(m[3] for m in cot))} no entraron ahí: fueron a otra cuenta a nombre de Mercedes Areco que no está cargada. "
           + ex['ma_galicia']['otras_cuentas'])

    # 3 · gastos cruzados
    h.blanco()
    h.seccion('3 · Gastos de una pagados desde cuentas de la otra, según el libro de Templates — detalle en G4')
    h.encabezado(['', None, 'Concepto', None, None, 'Importe (+ PAM puso por MA)', None, None])
    r3 = []
    for k in [k for k in g4 if len(k) == 3 and k[0] == 'PAM' and k[1] == 'MA']:
        r3.append(fila(h, [None, None, f'Gastos de MA pagados desde cuentas de PAM — {k[2]} (G4, 4c)', None, None,
                           f"='{H4}'!{h4.cel(6, g4[k])}"], comb={3: 5}))
    for k in [k for k in g4 if len(k) == 3 and k[0] == 'MA' and k[1] == 'PAM']:
        r3.append(fila(h, [None, None, f'Menos: gastos de PAM pagados desde cuentas de MA — {k[2]} (G4, 4d)', None, None,
                           f"=-'{H4}'!{h4.cel(6, g4[k])}"], comb={3: 5}))
    r_t3 = h.total('Total — gastos cruzados entre PAM y MA, neto (PAM pagó por MA − MA pagó por PAM)', {6: h.suma(6, r3[0], r3[-1])},
                   clave=True, col_etiqueta=3)
    control(h, 'gastos cruzados entre PAM y MA contra los totales de G4',
              f"{h.cel(6, r_t3)}-('{H4}'!{h4.cel(6, g4[('PAM', 'MA')])}-'{H4}'!{h4.cel(6, g4[('MA', 'PAM')])})", 0.0,
              'G4, totales 4c y 4d (tiene que dar cero)')
    h.nota('Las cuotas de Libertad van acá por el total pagado. El cuadro de Libertad (G5) reparte distinto: la mitad de lo que paga la '
           'tercera es de MSA y la otra mitad de la otra empresa («Entre PAM y MA»). Qué criterio se usa entre PAM y MA es una '
           'definición pendiente. En los bancos de PAM, los pagos por MA llevan el código «DIST MA» (columna «Estado · marca» de G4).')
    h5 = R['h5']
    r_lib = fila(h, [None, None, 'Informativo — Libertad «Entre PAM y MA» según el cuadro (G5): 1er sem. PAM le debe a MA; 2do sem. MA le '
                     'debe a PAM; neto a favor de PAM', None, None,
                     f"='{H5}'!{h5.cel(10, R['lib_sem'][1])}-'{H5}'!{h5.cel(10, R['lib_sem'][0])}"], comb={3: 5})
    R['g3'] = dict(t1=r_t1, bp=r_bp, cot=r_t2, cruz=r_t3, lib=r_lib)
    X['py']['g3'] = dict(pam=sum(m[3] for m in giros), ma=sum(v[6] for v in ma['de_pam']), cot=sum(m[3] for m in cot))
    lib.item('3', 'PAM ↔ MA — giros de PAM a MA en el ejercicio, según PAM', h, h.cel(6, r_t1), GRUPO_1,
             'ninguna lleva cuenta con la otra; el balance propio de MA lo toma como deuda con PAM')
    lib.item('3a', 'PAM ↔ MA — lo mismo, visto desde el banco de MA', h, h.cel(7, r_t1), GRUPO_1, 'falta el giro al Banco Francés')
    lib.item('3b', 'PAM ↔ MA — diferencia entre las dos miradas (MA − PAM)', h, h.cel(8, r_t1), GRUPO_1, 'giro del 06/08/2025, cuenta no cargada')
    lib.item('3c', 'PAM ↔ MA — «a cuenta Cotitulares» a nombre de Mercedes Areco (aparte)', h, h.cel(6, r_t2), GRUPO_1,
             'no entró a la caja de ahorro Galicia de MA')
    lib.item('3d', 'PAM ↔ MA — gastos cruzados, neto (fuera de toda cuenta)', h, h.cel(6, r_t3), GRUPO_1, 'cuotas de Templates; detalle en G4')


# ---------------------------------------------------------------- Matriz
def _matriz(lib, h, X):
    R = X['R']
    ref = lambda hoja, hh, c, r: f"='{hoja}'!{hh.cel(c, r)}"  # noqa: E731
    h1, h2, h3, h4, h6 = R['h1'], R['h2'], R['h3'], R['h4'], R['h6']
    g1, g2, g3, g4 = R['g1'], R['g2'], R['g3'], R['g4']
    sm = X['pam']['segun_msa']
    h.titulo('Matriz — lo que cada empresa dice de las otras al 30/06/2026, lado a lado')
    h.nota('Ejercicio 01/07/2025 al 30/06/2026. Para cada par hay un renglón «según la primera» y otro «según la segunda», y la '
           'diferencia. Cada número viene de la hoja del par (G1, G2, G3), donde está cada movimiento. Signo: en MSA ↔ MA y MSA ↔ PAM, '
           'el de la cuenta que lleva MSA (negativo = la otra le debe a MSA); en PAM ↔ MA, positivo = plata que PAM puso para MA. '
           'Nada de esto decide qué es retiro y qué es deuda: eso está en Pendientes.')
    h.blanco()
    h.seccion('1 · Saldos entre las tres')
    h.encabezado(['Par · quién lo dice', 'Saldo al inicio (30/06/2025)', 'Movimiento del ejercicio', 'Saldo al 30/06/2026',
                  'Diferencia con el primer renglón', 'Qué incluye · dónde se ve'], repetir=True)

    def par(titulo, filas):
        h.fila([titulo], negrita=True)
        r0 = None
        for texto, ini, mov, que in filas:
            r = h.r + 1
            fila(h, [texto, ini, mov, f'={h.cel(2, r)}+{h.cel(3, r)}', f'={h.cel(4, r)}-{h.cel(4, r0)}' if r0 else None, que])
            r0 = r0 or r
        return r0

    m1 = par('MSA ↔ MA (negativo = MA le debe a MSA)', [
        ('Según MSA — cuenta de Mercedes Areco, el sistema', 0.0, ref(H1, h1, 6, g1['sal']),
         'transferencias, pagos a terceros, Libertad, sueldo y pagos de MA · G1'),
        ('Según MA — visto desde su caja de ahorro y su tarjeta', 0.0, ref(H1, h1, 7, g1['sal']),
         'sólo transferencias recibidas y pagos hechos por MSA · G1'),
        ('Según MSA — como se envió al contador', 0.0, ref(H1, h1, 6, g1['env']), 'sistema + 5 renglones del anexo · G1')])
    m2 = par('MSA ↔ PAM (negativo = PAM le debe a MSA)', [
        ('Según MSA — cuenta de la Sucesión, el sistema', 0.0, ref(H2, h2, 6, g2['sal']),
         'factura, aportes, retiros, gastos pagados por MSA y Libertad · G2'),
        ('Según PAM — visto desde su caja de ahorro y su cuenta corriente', 0.0, ref(H2, h2, 7, g2['sal']), 'sólo aportes y retiros · G2')])
    r_ap = fila(h, ['Informativo — apertura del contador de MSA: «Socio Plácido Martínez» al 30/06/2025 (el sistema arranca en 0)',
                    float(sm['apertura_contador_socio_placido']), None, None, None, 'no está sumado: ver Pendientes'])
    m3 = par('PAM ↔ MA (positivo = plata que PAM puso para MA)', [
        ('Según PAM — giros a MA («Distribución Mamá»)', 0.0, ref(H3, h3, 6, g3['t1']), '7 transferencias · G3'),
        ('Según MA — recibido de PAM en su caja de ahorro Galicia', 0.0, ref(H3, h3, 7, g3['t1']),
         '6 transferencias; falta el giro al Banco Francés · G3'),
        ('Según MA — deuda con PAM en su balance propio', 0.0, ref(H3, h3, 7, g3['bp']), 'toma el número de PAM · G3')])
    h.blanco()
    py = X['py']
    control(h, 'MSA ↔ MA según MSA', h.cel(4, m1), X['resumen']['Mercedes Areco']['cierre'], 'export «14.1 Cuentas con socios»')
    control(h, 'MSA ↔ MA como se envió al contador', h.cel(4, m1 + 2), X['ma']['msa_dice']['saldo_enviado'], 'papel enviado «Cuentas de socios»')
    control(h, 'MSA ↔ MA visto desde MA', h.cel(4, m1 + 1), py['g1']['ma'], 'caja de ahorro y tarjeta de MA: pagado por MSA − recibido de MSA')
    control(h, 'MSA ↔ PAM según MSA', h.cel(4, m2), X['resumen']['Sucesión de Plácido Martínez']['cierre'], 'export «14.1 Cuentas con socios»')
    tq = X['pam']['totales_consulta']
    control(h, 'MSA ↔ PAM visto desde PAM', h.cel(4, m2 + 1), tq['aportes_a_msa'] - tq['retiros_de_msa'],
            'consulta a los extractos de PAM: aportes a MSA − retiros de MSA')
    control(h, 'PAM ↔ MA según PAM', h.cel(4, m3), tq['giros_a_ma'], 'consulta a los extractos de PAM (categoría «Distribución Mamá»)')

    # 2 · por tipo de movimiento
    h.blanco()
    h.seccion('2 · Movimiento del ejercicio por tipo — según la cuenta que lleva MSA (signo: + a favor de la otra, − a favor de MSA)')
    h.encabezado(['Tipo de movimiento', 'MSA ↔ MA', 'MSA ↔ PAM', None, None, 'Dónde se ve'])
    t = [('Transferencias directas (retiros − aportes)', f"=-'{H1}'!{h1.cel(6, g1['rs'][0])}",
          f"='{H2}'!{h2.cel(6, g2['rs'][1])}-'{H2}'!{h2.cel(6, g2['rs'][0])}", 'G1 tabla 2 · G2 tabla 2'),
         ('Gastos de la otra pagados por MSA a terceros', f"=-'{H1}'!{h1.cel(6, g1['rs'][1])}", f"=-'{H2}'!{h2.cel(6, g2['rs'][2])}",
          'G1 tabla 3 · G2 tabla 3 · G4'),
         ('Gastos de MSA pagados por la otra', f"='{H1}'!{h1.cel(6, g1['rs'][4])}", 0.0, 'G1 tabla 4'),
         ('Libertad (neto del cuadro)', f"=-'{H1}'!{h1.cel(6, g1['rs'][2])}", f"=-'{H2}'!{h2.cel(6, g2['rs'][3])}", 'G5'),
         ('Sueldo devengado o factura a MSA', f"='{H1}'!{h1.cel(6, g1['rs'][3])}", f"='{H2}'!{h2.cel(6, g2['rs'][4])}", 'G6 tabla 6a · G2 tabla 4')]
    a = h.r + 1
    for x in t:
        fila(h, [x[0], x[1], x[2], None, None, x[3]])
    r_tt = h.total('Movimiento del ejercicio', {2: h.suma(2, a, h.r), 3: h.suma(3, a, h.r)}, clave=True)
    control(h, 'movimiento por tipo de MSA ↔ MA contra el renglón de la tabla 1', f'{h.cel(2, r_tt)}-{h.cel(3, m1)}', 0.0,
              'tabla 1 de esta hoja (tiene que dar cero)')
    control(h, 'movimiento por tipo de MSA ↔ PAM contra el renglón de la tabla 1', f'{h.cel(3, r_tt)}-{h.cel(3, m2)}', 0.0,
              'tabla 1 de esta hoja (tiene que dar cero)')

    # 3 · fuera de los saldos
    h.blanco()
    h.seccion('3 · Lo que cruza empresas y hoy NO está en ninguno de esos saldos')
    h.encabezado(['Qué es', None, 'Importe', None, None, 'Dónde se ve'])
    fuera = []

    def f3(texto, formula, donde):
        fuera.append(fila(h, [texto, None, formula, None, None, donde]))
    for k in [k for k in g4 if len(k) == 3 and k[0] == 'MSA' and not k[2].startswith('En la cuenta') and k[2] != T_LIB]:
        f3(f'Cuotas de {k[1]} pagadas por MSA — {k[2]}', ref(H4, h4, 6, g4[k]), 'G4')
    f3('Gastos de MA pagados desde cuentas de PAM (cuotas de Templates, con Libertad)', ref(H4, h4, 6, g4[('PAM', 'MA')]), 'G4, 4c · G3')
    f3('Gastos de PAM pagados desde cuentas de MA (cuotas de Templates, todas de Libertad)', ref(H4, h4, 6, g4[('MA', 'PAM')]), 'G4, 4d · G3')
    f3('Sueldos de JMS y de AMS pagados por PAM (en el libro de sueldos de MSA figuran pagados)', ref(H6, h6, 6, R['r6b']), 'G6, tabla 6b')
    f3('Alondra Olivo (empleada de MA): pagado según el libro de sueldos de MSA y no cargado a la cuenta de MA',
       ref(H6, h6, 8, R['r6c']), 'G6, tabla 6c')
    f3('Transferencias «a cuenta Cotitulares» de PAM a nombre de Mercedes Areco', ref(H3, h3, 6, g3['cot']), 'G3, tabla 2')
    f3('Giro de PAM a MA al Banco Francés, 06/08/2025 (está en PAM; el banco de MA no está cargado)',
       f"=-'{H3}'!{h3.cel(8, g3['t1'])}", 'G3, tabla 1')
    h.nota('Sin renglón de total a propósito: son cosas de naturaleza distinta y entre partes distintas; sumarlas no dice nada.')
    lib.pendiente('Matriz: la mirada de MA y la de PAM no son un saldo',
                  'MA y PAM no llevan una cuenta con las otras: lo que se muestra «según MA» y «según PAM» es lo que pasó por sus '
                  'bancos. Por eso la diferencia con MSA no es un error: es todo lo que MSA anota sin movimiento de banco en la otra '
                  '(pagos a terceros, Libertad, sueldo devengado, la factura 2-31).',
                  f"MSA ↔ MA: {ar(py['g1']['ma'] - py['g1']['msa'])} · MSA ↔ PAM: {ar(py['g2']['pam'] - py['g2']['msa'])}", 'Matriz')


# ---------------------------------------------------------------- pendientes
def _pendientes(lib, X):
    P = lib.pendiente
    cruz, py, pam, ma = X['cruz'], X['py'], X['pam'], X['ma']
    sm, tq = pam['segun_msa'], pam['totales_consulta']
    cl_ma, cl_pam = X['ctas']['MA'], X['ctas']['PAM']
    s = lambda xs: sum(q['imp'] for q in xs)  # noqa: E731
    tr = lambda p, e, t: [q for q in cruz if q['paga'] == p and q['emp'] == e and q['trat'].startswith(t)]  # noqa: E731
    f = lambda d: d.strftime('%d/%m/%Y')  # noqa: E731

    P('¿Qué es retiro (o distribución) y qué es deuda?',
      f"De MSA a MA: {len(cl_ma['retiros'])} transferencias por {ar(sum(m['debe'] for m in cl_ma['retiros']))} (MSA Galicia cta. cte. → "
      f"caja de ahorro Galicia de MA, del {f(cl_ma['retiros'][0]['f'])} al {f(max(m['f'] for m in cl_ma['retiros']))}; en MSA "
      "«Retiros / Distribución socios»; en MA código contable «CTA MSA», interno «DIST MA»). De MSA a PAM: "
      f"{len(cl_pam['retiros'])} retiros por {ar(sum(m['debe'] for m in cl_pam['retiros']))} y {len(cl_pam['aportes'])} aportes de PAM "
      f"por {ar(sum(m['haber'] for m in cl_pam['aportes']))} (código «CTA MSA» en PAM). De PAM a MA: {ar(py['g3']['pam'])} en 7 giros "
      "(categoría «Distribución Mamá», código «DIST MA» en PAM y «DIST PAM» en MA). Hoy el balance propio de MA toma todo como deuda.",
      f"MA: {ar(-py['g1']['msa'])} con MSA y {ar(py['g3']['pam'])} con PAM; PAM: {ar(-py['g2']['msa'])} con MSA", 'Matriz · G1 · G2 · G3')
    P('PAM: saldo de inicio de la cuenta con MSA',
      f"La apertura del contador de MSA dice «Socio Plácido Martínez» {ar(sm['apertura_contador_socio_placido'])} al 30/06/2025 y el "
      'sistema arranca la cuenta de la Sucesión en 0. Según cómo se defina (dividendos, devolución, condonación o saldo que sigue), el '
      'saldo al cierre cambia en ese importe.', ar(sm['apertura_contador_socio_placido']), 'Matriz · G2')
    cot = [m for m in pam['movs'] if m[7] == 'CTA COTITULARES']
    P('Destino de los 33.180.000 «a cuenta Cotitulares»',
      '; '.join(f"{f(_d(m[1]))}: {ar(m[3])}, cuenta corriente de PAM → «{m[11]}», detalle «{m[6]}», código {m[7]}" for m in cot)
      + '. Verificado: no entraron a la caja de ahorro Galicia de MA (en octubre 2025 sólo recibió 2.000.000,00 el 07/10 por '
      'transferencia entre cuentas y 3.500.000,00 de MSA el 31/10). ¿A qué cuenta fueron? ¿Es plata de los cotitulares (y no de MA)? '
      'No está en ningún saldo de este libro.', ar(sum(m[3] for m in cot)), 'G3, tabla 2')
    nv = ma['pam_no_visto']
    P('Cuenta de MA en el Banco Francés: no está cargada',
      f"PAM giró {ar(nv['importe'])} el {f(_d(nv['fecha']))} (caja de ahorro de PAM, «Retiro MAM Frances», CUIT 27066824611, código "
      'DIST MA). Del lado de MA no se ve: su caja de ahorro Galicia arranca el 07/10/2025 y el Banco Francés no está cargado. Tampoco se '
      'puede saber si antes del 07/10/2025 hubo otros movimientos de MA con MSA o con PAM. En MSA, dos transferencias a MA dicen «MA '
      'Banco Frances» (10/11 y 04/12/2025) pero entraron a la caja de ahorro Galicia.', f"{ar(nv['importe'])} de diferencia en PAM ↔ MA",
      'G3, tabla 1')
    # gastos cruzados
    env = tr('MSA', 'MA', T_ENV)
    if env:
        P('Cuotas de MA pagadas con la tarjeta de MSA que no están en la cuenta de MA según el sistema',
          '; '.join(f"{f(q['fecha'])} {q['concepto']} · {q['prov']} · {q['banco']} · {ar(q['imp'])}" for q in env)
          + '. Coinciden con 3 de los 5 renglones del anexo de lo enviado al contador (los otros 2 son el albañil del chalet, 400.000,00 '
          'el 16/05 y 400.000,00 el 19/05/2026 por Caja Sigot). Inferido por concepto e importe.',
          f'{ar(s(env))}: en lo enviado sí están; en el sistema todavía no', 'G4, 4a · G1, puente')
    no = tr('MSA', 'MA', T_NO) + tr('MSA', 'PAM', T_NO)
    if no:
        P('Cuotas pagadas por MSA que no están en la cuenta que MSA lleva de esa empresa',
          '; '.join(f"{f(q['fecha'])} {q['concepto']} ({q['emp']} · {q['hoja']}) · {q['prov'] or q['det']} · {q['det']} · {q['banco']} · "
                    f"{ar(q['imp'])}" for q in no)
          + '. En MSA el pago del 02/06/2026 figura en «Hermanos / Quinta» («todavía sin tratar», 9.000,00).',
          ar(s(no)), 'G4')
    otra = [q for q in cruz if q['paga'] == 'MSA' and q.get('en') and q['en'] != q['emp']]
    if otra:
        P('Cuotas de PAM que MSA cargó a la cuenta de MA',
          '; '.join(f"{f(q['fecha'])} {q['concepto']} (PAM · {q['hoja']}) · {q['prov']} · {q['banco']} · {ar(q['imp'])}" for q in otra)
          + '. En el libro de Templates son cuotas de PAM; en MSA están dentro de renglones de la cuenta de Mercedes Areco («ABL Posadas '
          '2025 Cuotas 11 y 12» y el pago del Inmobiliario del 11/06/2026). ¿De quién es el gasto?',
          f'{ar(s(otra))} que hoy le suma deuda a MA y no a PAM', 'G1, tabla 3 · G4, 4b')
    al_reves = [m for m in cl_ma['terceros'] if 'PAM' in m['concepto']]
    P('Pagos de MSA cargados a MA que dicen «PAM» en el concepto',
      f"{len(al_reves)} renglones de la cuenta de MA por {ar(sum(m['debe'] for m in al_reves))} (expensas de Posadas desde febrero 2026, "
      'Red Vial e Inmobiliario «PAM» de marzo y junio 2026). En Templates esas cuotas son de MA desde 2026 (pase de los bienes de PAM a '
      'MA desde el 01/01/2026); hasta diciembre 2025 las mismas cuotas eran de PAM y se cargaban a la cuenta de PAM. A confirmar el corte.',
      ar(sum(m['debe'] for m in al_reves)), 'G1, tabla 3')
    sin = [m for m in cl_ma['terceros'] if not m['cuotas']]
    P('Cuenta de MA en MSA: renglones sin cuota de template que los respalde',
      f"{len(sin)} renglones por {ar(sum(m['debe'] for m in sin))}: "
      + '; '.join(f"{f(m['f'])} {m['concepto'][:70]} {ar(m['debe'])}" for m in sin if not m.get('alondra'))
      + f"; y {sum(1 for m in sin if m.get('alondra'))} pagos a Alondra Olivo por {ar(sum(m['debe'] for m in sin if m.get('alondra')))} "
      '(G6, tabla 6c). No se ven desde MA: sólo existen en la cuenta de socio de MSA.',
      'sin comprobante ni registro del lado de MA', 'G1, tabla 3')
    sinp = [m for m in cl_pam['terceros'] if not m['cuotas']]
    P('Cuenta de PAM en MSA: renglones sin cuota de template que los respalde',
      '; '.join(f"{f(m['f'])} {m['concepto']} {ar(m['debe'])}" for m in sinp)
      + '. En PAM no hay registro. «OS Manuel» y «Chano»: ¿son gastos de la Sucesión?', ar(sum(m['debe'] for m in sinp)), 'G2, tabla 3')
    nad = [q for q in cruz if q['trat'] == T_NADIE]
    P('PAM ↔ MA: gastos de MA pagados por PAM que nadie lleva como cuenta',
      f"{len(nad)} cuotas de MA por {ar(s(nad))} pagadas desde cuentas de PAM, fuera de Libertad: "
      f"{sum(1 for q in nad if q['banco'].startswith('VISA'))} consumos con la tarjeta de PAM por "
      f"{ar(s([q for q in nad if q['banco'].startswith('VISA')]))} (suscripciones y consumos personales, julio 2025 a abril 2026) y "
      f"{sum(1 for q in nad if not q['banco'].startswith('VISA'))} pagos por banco por {ar(s([q for q in nad if not q['banco'].startswith('VISA')]))} "
      '(Inmobiliario y Complementario cuota 1 del 17/03/2026, Red Vial Lima, autónomos adeudados de MA 389.166,88 del 19/02/2026, ABL y '
      'expensas de Posadas). En el banco de PAM llevan el código «DIST MA». ¿Son deuda de MA con PAM, distribución a MA, o gasto de PAM?',
      ar(s(nad)), 'G4, 4c · G3, tabla 3')
    P('Libertad entre PAM y MA: ¿por el total pagado o por la mitad?',
      f"Según Templates, MA pagó {ar(s(tr('MA', 'PAM', T_LIB)))} de cuotas de Libertad a cargo de PAM (nov-dic 2025) y PAM pagó "
      f"{ar(s(tr('PAM', 'MA', T_LIB)))} a cargo de MA (2026). El cuadro de Libertad de MSA toma sólo la mitad como cuenta entre PAM y MA "
      f"(1er sem. {ar(sum(X['lib']['entre'][:6]))} que PAM le debe a MA; 2do sem. {ar(sum(X['lib']['entre'][6:]))} que MA le debe a PAM) "
      'porque la otra mitad es de MSA y ya está en las cuentas de socios. Ninguna de las dos lo tiene registrado.',
      f"neto a favor de PAM {ar(sum(X['lib']['entre'][6:]) - sum(X['lib']['entre'][:6]))} según el cuadro", 'G5 · G3, tabla 3')
    P('Sueldos de JMS y AMS pagados por PAM: ¿de quién es el gasto?',
      'Desde la cuenta corriente de PAM: 7.250.000,00 el 28/11/2025 a José María Martínez (CUIT 23342147739, «Premio JMS USS 5.000», '
      'código CTA JMS); 1.000.000,00 y 2.341.786,19 el 30/12/2025 («JMS SUELDO»); 2.000.000,00 el 30/12/2025 a Plácido Andrés Martínez '
      '(CUIT 20287492546, «AMS SUELDO», código CTA AMS). En el libro de sueldos de MSA los cuatro figuran como sueldo pagado (el bruto de '
      'JMS de noviembre incluye el premio de 7.250.000 y diciembre es 3.341.786,19). Si el gasto es de MSA, MSA le debe a PAM ese '
      'importe y la cuenta de la Sucesión pasaría de deber 189.826,57 a tener a favor 12.401.959,62; si es de PAM (honorarios), no '
      'debería estar en el libro de sueldos de MSA. Hoy no está en la cuenta MSA ↔ PAM.',
      ar(tq['pagos_jms'] + tq['pagos_ams']), 'G6, tabla 6b')
    al = X['alondra']
    P('Alondra Olivo (empleada de MA en el libro de sueldos de MSA)',
      f"El libro de sueldos de MSA registra {ar(X['sueldos'][('MA', 'Alondra Olivo')][1])} pagados (febrero a junio 2026). {al['n']} pagos "
      f"por banco de MSA, {ar(al['cargado'])}, están cargados a la cuenta de MA. {al['n_caja']} pagos por Caja Sigot ({ar(al['caja'])}: "
      "405.000,00 el 30/04 y 196.000,00 el 14/05/2026, estado «programado») no están en la cuenta de MA, y 56.000,00 se pagaron el "
      '17/07/2026, después del cierre. Además en la cuenta de MA los pagos del 09/06 (120.000,00) y 16/06/2026 (84.000,00) figuran sin '
      'nombre («Trf Inmed Proveed»). ¿Se pagaron los de Caja Sigot? Si sí, faltan en la cuenta de MA.',
      f"{ar(al['caja'])} sin cargar a MA", 'G6, tabla 6c')
    P('Sueldo que MSA le devenga a MA: no figura en MA',
      f"12 renglones «Sueldo mm/aaaa (a pagar)» por {ar(sum(m['haber'] for m in cl_ma['facturas']))} (1.500.000 por mes; 2.250.000 en "
      'diciembre y junio). En MA no hay factura ni ingreso. Baja la deuda de MA con MSA sin que MA lo registre.',
      ar(sum(m['haber'] for m in cl_ma['facturas'])), 'G6, tabla 6a · G1')
    P('Mabel Rojas: empleada de PAM, en el libro de sueldos de MSA',
      f"Celia Mabel Rojas (CUIL 27203615367): {ar(tq['mabel'])} pagados por los bancos de PAM (3 sueldos y la liquidación final de "
      '219.892,00 del 09/10/2025), registrados en el libro de sueldos de MSA con empresa PAM. No toca la cuenta MSA ↔ PAM. El reporte de '
      'PAM dejó planteado que la misma liquidación final figuraría también pagada por la Caja Sigot de MSA: no se pudo confirmar.',
      ar(tq['mabel']), 'G6, tabla 6d')
    j = X['extra']['ma_galicia']['de_jms']
    P('Transferencia de José María Martínez a MA',
      f"El {f(_d(j[0]))} entraron {ar(j[2])} a la caja de ahorro Galicia de MA («{j[1]}», categoría Consumos, detalle «{j[3]}»). No es "
      'de MSA ni de PAM: es de un socio. Queda anotado porque es el único crédito grande de MA en el ejercicio, fuera de MSA, PAM y '
      'Provinvest, que no se clasificó como cuenta.', ar(j[2]), 'no está en este libro')
    P('MSA ↔ MA: lo enviado al contador difiere del sistema',
      f"Sistema {ar(py['g1']['msa'])}; enviado {ar(ma['msa_dice']['saldo_enviado'])}; diferencia {ar(ma['msa_dice']['anexo'])} (5 "
      'renglones que están en lo enviado y no en el sistema).', ar(ma['msa_dice']['anexo']), 'G1 · Matriz')


# ---------------------------------------------------------------- entrada
def construir(lib, src):
    ws = src.hoja('Socios y Libertad', '14.1')
    resumen, _, _, sin_tratar, _, det, _ = d_socios._leer(ws)
    cruz, n_todas = _cuotas_cruzadas(src)
    X = dict(R={}, py={}, resumen=resumen, cruz=cruz, lib=_libertad(src), ma=_json(src, 'ma', 'cuentas'), pam=_json(src, 'pam', 'cuentas'),
             extra=_json(src, 'grupo', 'extra'),
             ctas={'MA': _clasificar(det['Mercedes Areco']['movs']), 'PAM': _clasificar(det['Sucesión de Plácido Martínez']['movs'])})
    w = src.libro('Sueldos')['13 Sueldos']
    sue = collections.defaultdict(lambda: [0.0, 0.0])
    for r in range(5, w.max_row + 1):
        v = [w.cell(r, k).value for k in range(1, 17)]
        if isinstance(v[0], str) and re.match(r'\d{4}-\d{2}$', v[0]):
            sue[(str(v[1]), str(v[2]))][0] += num(v[12])
            sue[(str(v[1]), str(v[2]))][1] += num(v[15])
    X['sueldos'] = dict(sue)
    _emparejar(cruz, X['lib'], X['ctas'], d_socios.RESPALDO['anexo'], X['pam']['movs'])

    R = X['R']
    hm = _hoja(lib, 'Matriz', A_M)
    R['h1'], R['h2'], R['h3'] = _hoja(lib, H1, A8), _hoja(lib, H2, A8), _hoja(lib, H3, A8)
    R['h4'], R['h5'], R['h6'] = _hoja(lib, H4, A_G4), _hoja(lib, H5, A_G5), _hoja(lib, H6, A8)
    _g5(lib, R['h5'], X)
    _g4(lib, R['h4'], X)
    _g6(lib, R['h6'], X)
    _g1(lib, R['h1'], X)
    _g2(lib, R['h2'], X)
    _g3(lib, R['h3'], X)
    _matriz(lib, hm, X)
    _pendientes(lib, X)

    # ---- verificación en Python (nada se fuerza: lo que no da, va a Pendientes)
    py = X['py']
    malas = []
    for nombre, a, b in (
            ('MSA ↔ MA según MSA', py['g1']['msa'], resumen['Mercedes Areco']['cierre']),
            ('MSA ↔ PAM según MSA', py['g2']['msa'], resumen['Sucesión de Plácido Martínez']['cierre']),
            ('cuotas de MA pagadas por otra', sum(q['imp'] for q in cruz if q['emp'] == 'MA'), 26267632.57),
            ('cuotas de PAM pagadas por otra', sum(q['imp'] for q in cruz if q['emp'] == 'PAM'), 10729575.79),
            ('Libertad: cuotas del detalle contra el costo', sum(x['imp'] for x in X['lib']['det']), sum(X['lib']['costo'])),
            ('Libertad cruzada en Templates contra el detalle de Libertad',
             sum(q['imp'] for q in cruz if q['trat'] == T_LIB), sum(x['imp'] for x in X['lib']['det'] if x['pago'] != x['resp']))):
        if abs(a - b) > 0.01:
            malas.append(f'{nombre}: {ar(a)} contra {ar(b)}')
    if any(q['emp'] == 'MSA' for q in cruz):
        malas.append('hay cuotas de MSA pagadas desde otra empresa que esta hoja no muestra')
    if malas:
        lib.pendiente('Grupo: verificaciones que no cierran', '; '.join(malas), 'REVISAR', 'Matriz')
    print(f"[g_cuentas_grupo] cuotas del libro de Templates: {dict(n_todas)} · cruzadas: {len(cruz)} · "
          + ' · '.join(f'{k}: {v}' for k, v in sorted(collections.Counter(f"{q['paga']}→{q['emp']} {q['trat'][:22]}" for q in cruz).items())))
    print(f"[g_cuentas_grupo] python: G1 {py['g1']} · G2 {py['g2']} · G3 {py['g3']} · alondra {X['alondra']}")
