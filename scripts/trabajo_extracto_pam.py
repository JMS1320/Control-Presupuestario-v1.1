"""
📒 Excel de TRABAJO del extracto PAM (mismo procedimiento que MSA, 2026-10-18). SÓLO LECTURA de la base.

Toma «Extracto PAM - Control Presupuestario.xlsx» del usuario: en una misma hoja vienen PEGADAS la CAJA DE AHORRO
(arriba, formato CA: «Movimiento», 02/01/2025 → 23/01/2026) y la CUENTA CORRIENTE (abajo, formato Galicia CC con
leyendas, abierta el 24/09/2025 → 30/01/2026). Guarda una COPIA versionada («… - TRABAJO vN.xlsx»): su hoja queda
igual y se agregan columnas a la derecha. La v1 sólo MARCA, no propone cargas:
  · Cuenta (CA / CC) y Ejercicio (PAM cierra el 31/12: 2025, o «2026» para enero)
  · Contrapartida en el extracto de MSA (mismo día —o hasta 3 días— e importe del otro lado): es lo que puede
    afectar a MSA (aportes, retiros, pagos por cuenta) — pedido del usuario: «puede que haya cosas de su segundo
    semestre que afecten a MSA»
  · Transferencia entre las dos cuentas de PAM (CA ↔ CC)
  · Cuota de template o pago de sueldo que ya esté en la app por fecha + importe
Y las solapas «Resumen por CATEG» (por cuenta) con fórmulas y su control.

    python scripts/trabajo_extracto_pam.py 1
Si existe la versión anterior, se traen las columnas «JMS:» que haya completado el usuario.
"""
import openpyxl, collections, datetime, json, re, sys, os, urllib.request, urllib.parse
from openpyxl.styles import PatternFill, Font
from openpyxl.utils import get_column_letter as L

V = sys.argv[1] if len(sys.argv) > 1 else '1'
RAIZ = 'D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1/'
DIR = RAIZ + '- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude/'
FUENTE = DIR + 'Extracto PAM - Control Presupuestario.xlsx'
SALIDA = DIR + f'Extracto PAM - Control Presupuestario - TRABAJO v{V}.xlsx'
PREVIA = DIR + f'Extracto PAM - Control Presupuestario - TRABAJO v{int(V) - 1}.xlsx'

env = {}
for l in open(RAIZ + '.env.local', encoding='utf-8'):
    if '=' in l and not l.strip().startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
def rest(tabla, params, schema=None):
    out, off = [], 0
    while True:
        url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1/' + tabla + '?' + urllib.parse.urlencode(dict(params, limit=1000, offset=off), safe='(),.*:')
        h = {'apikey': env['SUPABASE_SERVICE_ROLE_KEY'], 'Authorization': 'Bearer ' + env['SUPABASE_SERVICE_ROLE_KEY']}
        if schema: h['Accept-Profile'] = schema
        r = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=h)).read())
        out += r
        if len(r) < 1000: return out
        off += 1000

r2 = lambda x: round(float(x), 2) if isinstance(x, (int, float)) else 0.0
iso = lambda d: d.strftime('%Y-%m-%d') if isinstance(d, (datetime.datetime, datetime.date)) else str(d)[:10]
dmy = lambda s_: '/'.join(reversed(str(s_)[:10].split('-')))
s = lambda x: '' if x is None else str(x)
money = lambda x: f'{x:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')

# ── 1. La planilla: dos bloques en la misma hoja ─────────────────────────────────────────────────────────
wb = openpyxl.load_workbook(FUENTE)
ws = wb.worksheets[0]
wd = openpyxl.load_workbook(FUENTE, data_only=True).worksheets[0]
encabezados = [i for i in range(1, ws.max_row + 1) if s(wd.cell(i, 1).value).strip() == 'Fecha']
assert len(encabezados) == 2, f'esperaba 2 filas de encabezado «Fecha», hay {encabezados}'
H_CA, H_CC = encabezados
hca = {s(wd.cell(H_CA, c).value).strip(): c for c in range(1, ws.max_column + 1) if wd.cell(H_CA, c).value}
hcc = {s(wd.cell(H_CC, c).value).strip(): c for c in range(1, ws.max_column + 1) if wd.cell(H_CC, c).value}
assert 'Movimiento' in hca and 'Descripción' in hcc, 'el formato de los bloques no es el esperado (CA arriba, CC abajo)'
movs = {}
for i in range(H_CA + 1, ws.max_row + 1):
    f = wd.cell(i, 1).value
    if not isinstance(f, datetime.datetime): continue
    cc = i > H_CC
    h = hcc if cc else hca
    g = lambda n: wd.cell(i, h[n]).value if n in h else None
    texto = s(g('Descripción')) + ' ' + ' '.join(s(g(k)) for k in ('Leyendas Adicionales1', 'Leyendas Adicionales2', 'Leyendas Adicionales3', 'Leyendas Adicionales4')) if cc \
        else s(g('Movimiento')).replace('\n', ' ')
    movs[i] = {'fila': i, 'cuenta': 'CC' if cc else 'CA', 'fecha': f, 'deb': r2(g('Débitos') if cc else g('Débito')),
               'cre': r2(g('Créditos') if cc else g('Crédito')), 'saldo': r2(g('Saldo')), 'texto': texto.strip(),
               'categ': s(g('CATEG') if cc else g('Categ')).strip(), 'det': s(g('Detalle') if cc else g('Observaciones')),
               'cont': s(g('Contable')), 'int': s(g('Interno'))}
ultima = max(movs)
ejercicio = lambda m: '2025' if m['fecha'].year == 2025 else str(m['fecha'].year)
print(f"CA {sum(1 for m in movs.values() if m['cuenta']=='CA')} · CC {sum(1 for m in movs.values() if m['cuenta']=='CC')} movimientos")

# ── 2. Contrapartida en el extracto de MSA (plata que va o viene de MSA) ─────────────────────────────────
msa = rest('msa_galicia', {'select': 'id,fecha,debitos,creditos,descripcion,detalle,categ,estado,template_id,nota_operador',
                           'and': '(fecha.gte.2024-12-25,fecha.lte.2026-02-10)'})
tpls = {t['id']: t for t in rest('egresos_sin_factura', {'select': 'id,nombre_referencia,responsable,categ,año'})}
usados_msa = set(); marca = {}
# ⚠️ v1 daba falsos cruces: comisiones de $1.000 o IVA de $210 que cobra el banco igual en las dos cuentas, y
# transferencias distintas del mismo importe con días de diferencia. Ahora: MISMO DÍA, importe desde $5.000 y nunca
# contra un gasto bancario de MSA.
BANCARIOS = re.compile(r'comisi|iva banc|debitos / creditos|percepci|sellos|iibb banc|impuesto pais|ley 25413|imp\. deb', re.I)
def nombre_msa(x):
    t = tpls.get(x['template_id'])
    plan = re.search(r'tu planilla: (.*)', s(x['nota_operador']))
    return (f"template «{t['nombre_referencia']}»" if t else (f"tu planilla: {plan.group(1)}" if plan else (x['categ'] or 'sin clasificar')))
for i, m in sorted(movs.items(), key=lambda kv: kv[1]['fecha']):
    imp, lado = (m['cre'], 'debitos') if m['cre'] else (m['deb'], 'creditos')   # crédito en PAM = débito en MSA
    if not imp: continue
    if imp < 5000: continue
    for dias in (0,):
        c = [x for x in msa if x['id'] not in usados_msa and abs(r2(x[lado] or 0) - imp) < 0.01
             and x['fecha'] == iso(m['fecha']) and not BANCARIOS.search(nombre_msa(x) + ' ' + s(x['descripcion']))]
        if c:
            x = c[0]; usados_msa.add(x['id'])
            sent = 'MSA → PAM' if m['cre'] else 'PAM → MSA'
            marca[i] = ('Contrapartida en MSA', f"{sent} · MSA {dmy(x['fecha'])} «{s(x['detalle'] or x['descripcion'])[:60]}» · {nombre_msa(x)} ({x['estado']})", x['id'])
            break

# ── 3. Transferencias entre las dos cuentas de PAM (CA ↔ CC) ─────────────────────────────────────────────
for i, m in movs.items():
    if i in marca: continue
    otro = 'CC' if m['cuenta'] == 'CA' else 'CA'
    c = [j for j, n in movs.items() if j not in marca and n['cuenta'] == otro and n['fecha'] == m['fecha']
         and ((m['deb'] and abs(n['cre'] - m['deb']) < 0.01) or (m['cre'] and abs(n['deb'] - m['cre']) < 0.01))]
    if c and (m['deb'] or m['cre']) >= 5000:     # desde $5.000: un reintegro de $1.000 no es una transferencia
        j = c[0]
        sentido = f"{m['cuenta']} → {otro}" if m['deb'] else f"{otro} → {m['cuenta']}"
        marca[i] = ('Entre cuentas de PAM', sentido, f'fila {j}')
        marca[j] = ('Entre cuentas de PAM', sentido, f'fila {i}')

# ── 4. Cuotas de template y pagos de sueldo ya en la app (fecha + importe) ──────────────────────────────
cuotas = rest('cuotas_egresos_sin_factura', {'select': 'id,egreso_id,fecha_estimada,monto,estado,tipo_movimiento',
                                             'and': '(fecha_estimada.gte.2025-01-01,fecha_estimada.lte.2026-01-31)'})
emps = {e['id']: e['nombre'] for e in rest('empleados', {'select': 'id,nombre'}, 'sueldos')}
pagos = rest('pagos', {'select': 'id,empleado_id,fecha,monto,tipo,estado', 'and': '(fecha.gte.2025-01-01,fecha.lte.2026-01-31)'}, 'sueldos')
# sólo cuotas SIN movimiento vinculado en ningún extracto (si ya tiene uno, ese pago no es éste)
vinculadas = set()
for tabla in ('msa_galicia', 'pam_galicia', 'pam_galicia_cc'):
    vinculadas |= {x['template_cuota_id'] for x in rest(tabla, {'select': 'template_cuota_id', 'template_cuota_id': 'not.is.null'})}
grupo_de = {c['id']: c.get('grupo_pago_id') for c in rest('cuotas_egresos_sin_factura', {'select': 'id,grupo_pago_id', 'grupo_pago_id': 'not.is.null'})}
libre = lambda c: c['id'] not in vinculadas and grupo_de.get(c['id']) not in vinculadas
for i, m in movs.items():
    if i in marca: continue
    imp = m['deb'] or m['cre']
    q = [c for c in cuotas if libre(c) and c['fecha_estimada'] == iso(m['fecha']) and abs(r2(float(c['monto'] or 0)) - imp) < 0.01]
    if q:
        t = tpls.get(q[0]['egreso_id'], {})
        marca[i] = ('Cuota de template en la app', f"«{t.get('nombre_referencia', '?')}» [{t.get('año')}] {dmy(q[0]['fecha_estimada'])} ({q[0]['estado']}) sin movimiento vinculado: sería este pago", q[0]['id'])
        continue
    p = [x for x in pagos if x['fecha'] == iso(m['fecha']) and abs(r2(float(x['monto'])) - m['deb']) < 0.01]
    if p:
        marca[i] = ('Sueldo en la app', f"{emps.get(p[0]['empleado_id'], '?')} · {p[0]['tipo']} ({p[0]['estado']})", p[0]['id'])

# ── 5. Columnas nuevas a la derecha, en las DOS filas de encabezado ─────────────────────────────────────
COL0 = ws.max_column + 2
NUEVAS = ['Cuenta', 'Ejercicio', 'App: ¿ya está?', 'App: qué es', 'App: id', '¿Toca a MSA?',
          'Propuesta: destino', 'Propuesta: cuenta', 'Propuesta: cómo se identificó', 'Aviso', 'JMS: decisión', 'JMS: nota']
C = {n: COL0 + k for k, n in enumerate(NUEVAS)}
AZUL = PatternFill('solid', fgColor='DDEBF7'); VERDE = PatternFill('solid', fgColor='E2EFDA'); AMAR = PatternFill('solid', fgColor='FFF2CC'); GRIS = PatternFill('solid', fgColor='EDEDED'); B = Font(bold=True)
fill_de = lambda n: AMAR if n.startswith('JMS') else (VERDE if n.startswith('Propuesta') or n == 'Aviso' else AZUL)
for hr in (H_CA, H_CC):
    for n, c in C.items():
        cell = ws.cell(hr, c, n); cell.font = B; cell.fill = fill_de(n)
clave = lambda m: (m['cuenta'], iso(m['fecha']), m['deb'], m['cre'], m['saldo'])
previas = {}
if os.path.exists(PREVIA):
    wp = openpyxl.load_workbook(PREVIA, data_only=True).worksheets[0]
    hp = {s(wp.cell(H_CA, c).value): c for c in range(1, wp.max_column + 1) if wp.cell(H_CA, c).value}
    for i, m in movs.items():
        previas[clave(m)] = {n: wp.cell(i, hp[n]).value for n in NUEVAS if n.startswith('JMS') and n in hp}
TOCA = re.compile(r'MARTINEZ SOBRADO|30617786016|\bMSA\b', re.I)
cuenta = collections.Counter()
for i, m in movs.items():
    ws.cell(i, C['Cuenta'], m['cuenta']); ws.cell(i, C['Ejercicio'], ejercicio(m))
    t, d, ref = marca.get(i, ('No está en la app', '', ''))
    ws.cell(i, C['App: ¿ya está?'], t); ws.cell(i, C['App: qué es'], d or None); ws.cell(i, C['App: id'], ref or None)
    toca = t == 'Contrapartida en MSA' or TOCA.search(m['texto'] + ' ' + m['det'] + ' ' + m['cont'] + ' ' + m['int'])
    ws.cell(i, C['¿Toca a MSA?'], 'Sí' if toca else None)
    cuenta[(m['cuenta'], t)] += 1
    for n, v in previas.get(clave(m), {}).items():
        if v not in (None, ''): ws.cell(i, C[n], v)

# ── 6. Resumen por CATEG, por cuenta (fórmulas sobre la hoja) ───────────────────────────────────────────
rs = wb.create_sheet('Resumen por CATEG')
N = ws.title.replace("'", "''")
rng = lambda col: f"'{N}'!${L(col)}${H_CA + 1}:${L(col)}${ultima}"
cCAT, cDEB, cCRE = hca['Categ'], hca['Débito'], hca['Crédito']
assert (hcc['CATEG'], hcc['Débitos'], hcc['Créditos']) == (cCAT, cDEB, cCRE), 'CATEG / débito / crédito no están en la misma columna en los dos bloques'
cCTA, cEJ, cAPP, cTOCA = C['Cuenta'], C['Ejercicio'], C['App: ¿ya está?'], C['¿Toca a MSA?']
TIPOS = ['Contrapartida en MSA', 'Entre cuentas de PAM', 'Cuota de template en la app', 'Sueldo en la app', 'No está en la app']
rs.append([f'RESUMEN POR CATEG — extracto PAM (caja de ahorro 02/01/2025 → 23/01/2026 y cuenta corriente 24/09/2025 → 30/01/2026). Fórmulas sobre la hoja. Generado {datetime.date.today():%d/%m/%Y}. v{V}: sólo marca, no propone cargas.'])
rs.append(['«Contrapartida en MSA» = el mismo importe, del otro lado, en el extracto de MSA el mismo día (o hasta 3 días): plata que fue o vino de MSA. «¿Toca a MSA?» = eso, o que el texto/detalle/código nombre a MSA.'])
rs.append([])
fila_ctrl = {}
for cta in ('CA', 'CC'):
    rs.append([f'{"CAJA DE AHORRO" if cta == "CA" else "CUENTA CORRIENTE"} ({cta})'])
    rs.cell(rs.max_row, 1).font = B
    enc = ['CATEG', 'Movimientos', 'Débitos', 'Créditos', '¿Toca a MSA? (cant.)']
    for t in TIPOS: enc += [f'{t} · cant.', f'{t} · débitos', f'{t} · créditos']
    enc += ['Control: movimientos − suma de las partes (tiene que dar 0)']
    rs.append(enc); hr = rs.max_row
    for cell in rs[hr]: cell.font = B; cell.fill = AZUL
    ini = hr + 1
    for cat in sorted({m['categ'] for m in movs.values() if m['cuenta'] == cta}, key=lambda x: x.upper()):
        n = rs.max_row + 1
        crit = f'{rng(cCAT)},{"$A" + str(n) if cat else chr(34) + chr(34)},{rng(cCTA)},"{cta}"'
        fila = [cat or '(sin CATEG)', f'=COUNTIFS({crit})', f'=SUMIFS({rng(cDEB)},{crit})', f'=SUMIFS({rng(cCRE)},{crit})', f'=COUNTIFS({crit},{rng(cTOCA)},"Sí")']
        for t in TIPOS:
            fila += [f'=COUNTIFS({crit},{rng(cAPP)},"{t}")', f'=SUMIFS({rng(cDEB)},{crit},{rng(cAPP)},"{t}")', f'=SUMIFS({rng(cCRE)},{crit},{rng(cAPP)},"{t}")']
        fila.append(f'=B{n}-' + '-'.join(f'{L(6 + 3 * k)}{n}' for k in range(len(TIPOS))))
        rs.append(fila)
    fin = rs.max_row
    rs.append(['TOTAL'] + [f'=SUM({L(j)}{ini}:{L(j)}{fin})' for j in range(2, len(enc) + 1)])
    fila_ctrl[cta] = rs.max_row
    rs.append([])
rs.append(['CONTROL contra la hoja', 'movimientos', 'débitos', 'créditos'])
for cta in ('CA', 'CC'):
    t_ = fila_ctrl[cta]; n = rs.max_row + 1
    rs.append([f'{cta}: la hoja', f'=COUNTIFS({rng(cCTA)},"{cta}")', f'=SUMIFS({rng(cDEB)},{rng(cCTA)},"{cta}")', f'=SUMIFS({rng(cCRE)},{rng(cCTA)},"{cta}")'])
    rs.append([f'{cta}: diferencia con su TOTAL (tiene que dar 0)', f'=B{t_}-B{n}', f'=ROUND(C{t_}-C{n},2)', f'=ROUND(D{t_}-D{n},2)'])
for row in rs.iter_rows(min_row=4):
    for cell in row:
        if isinstance(cell.value, str) and (cell.value.startswith('=SUMIFS') or cell.value.startswith('=ROUND')): cell.number_format = '#,##0.00'
for cta in ('CA', 'CC'):
    for j in range(3, 5): rs.cell(fila_ctrl[cta], j).number_format = '#,##0.00'
rs.column_dimensions['A'].width = 24

# ── 7. v2+: la PROPUESTA en las CATEG elegidas (scripts/historico_pam_propuesta.py) ─────────────────────
PROCESADAS = {'IMP', 'FIJOS BS AS', 'FCI', 'BANC', 'DIST MA', 'DIST HNOS',     # usuario 2026-10-18 (v2)
              'DOM', 'RET', 'AP', 'SUELD', 'JORN'}                                 # usuario 2026-10-18 (v3)
if int(V) >= 2:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from historico_pam_propuesta import proponer
    for i, m in movs.items():
        if m['categ'] not in PROCESADAS: continue
        dest, cta, crit, aviso = proponer(m, marca.get(i))
        if i in marca and marca[i][0] == 'Contrapartida en MSA':
            aviso = (aviso + ' · ' if aviso else '') + 'Tiene contrapartida en MSA: ver «App: qué es».'
        ws.cell(i, C['Propuesta: destino'], dest); ws.cell(i, C['Propuesta: cuenta'], cta or None)
        ws.cell(i, C['Propuesta: cómo se identificó'], crit); ws.cell(i, C['Aviso'], aviso or None)
    rd = wb.create_sheet('Propuesta por destino')
    cDES = C['Propuesta: destino']
    PREF = ['TEMPLATE', 'VINCULAR', 'SUELDOS', 'PREGUNTA']
    rd.append([f'PROPUESTA — CATEG de esta vuelta: {", ".join(sorted(PROCESADAS))}, de las dos cuentas. Nada está cargado: es para que lo revises y marques en «JMS: decisión / nota». Sin contable ni interno. Fórmulas sobre la hoja.'])
    rd.append([])
    rd.append(['1 · Por cuenta y CATEG', 'Cuenta'] + [f'{p} · cant.' for p in PREF] + ['Movimientos', 'Control (tiene que dar 0)'] + [f'{p} · débitos' for p in PREF] + [f'{p} · créditos' for p in PREF])
    h1 = rd.max_row
    for cell in rd[h1]: cell.font = B; cell.fill = AZUL
    i1 = h1 + 1
    for cta in ('CA', 'CC'):
        for cat in sorted({m['categ'] for m in movs.values() if m['cuenta'] == cta and m['categ'] in PROCESADAS}):
            n = rd.max_row + 1
            crit = f'{rng(cCAT)},$A{n},{rng(cCTA)},$B{n}'
            fila = [cat, cta] + [f'=COUNTIFS({crit},{rng(cDES)},"{p} ·*")' for p in PREF]
            cMOV = L(3 + len(PREF))                                   # columna «Movimientos»
            fila += [f'=COUNTIFS({crit})', f'={cMOV}{n}-SUM(C{n}:{L(2 + len(PREF))}{n})']
            fila += [f'=SUMIFS({rng(cDEB)},{crit},{rng(cDES)},"{p} ·*")' for p in PREF] + [f'=SUMIFS({rng(cCRE)},{crit},{rng(cDES)},"{p} ·*")' for p in PREF]
            rd.append(fila)
    f1 = rd.max_row
    rd.append(['TOTAL', ''] + [f'=SUM({L(j)}{i1}:{L(j)}{f1})' for j in range(3, 5 + 3 * len(PREF))])
    rd.append([])
    rd.append(['2 · Por destino', 'Movimientos', 'Débitos', 'Créditos'])
    h2 = rd.max_row
    for cell in rd[h2]: cell.font = B; cell.fill = AZUL
    dest = sorted({s(ws.cell(i, cDES).value) for i in movs if ws.cell(i, cDES).value}, key=lambda x: (PREF.index(x.split(' ·')[0]) if x.split(' ·')[0] in PREF else 9, x))
    i2 = h2 + 1
    for x in dest:
        n = rd.max_row + 1
        rd.append([x, f'=COUNTIFS({rng(cDES)},$A{n})', f'=SUMIFS({rng(cDEB)},{rng(cDES)},$A{n})', f'=SUMIFS({rng(cCRE)},{rng(cDES)},$A{n})'])
    f2 = rd.max_row
    rd.append(['TOTAL', f'=SUM(B{i2}:B{f2})', f'=SUM(C{i2}:C{f2})', f'=SUM(D{i2}:D{f2})'])
    rd.append(['Control: el total por destino tiene que ser igual al de la sección 1', f'=B{rd.max_row}-{L(3 + len(PREF))}{f1 + 1}'])
    for row in rd.iter_rows(min_row=i1):
        for cell in row:
            if isinstance(cell.value, str) and cell.value.startswith(('=SUMIFS', '=SUM(')): cell.number_format = '#,##0.00'
    rd.column_dimensions['A'].width = 70
    print('propuesta:', collections.Counter(s(ws.cell(i, cDES).value).split(' ·')[0] for i in movs if ws.cell(i, cDES).value))
ws.auto_filter.ref = None
wb.save(SALIDA)
print(SALIDA)
for k, v in sorted(cuenta.items()): print(f'  {k[0]} {v:4} {k[1]}')
print('¿Toca a MSA?:', sum(1 for i in movs if ws.cell(i, C['¿Toca a MSA?']).value == 'Sí'))
