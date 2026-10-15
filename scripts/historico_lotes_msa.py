"""
📦 LOTES del extracto histórico MSA jul-2025 → ene-2026 (A-DEC-1009, Paso 2+). SÓLO LECTURA: arma el Excel.

Los 860 movimientos ya están en `msa_galicia` como «historico», sin clasificar (Paso 1, 15/10). Este Excel
propone, lote por lote, qué hacer con cada uno — para revisarlo con el usuario ANTES de aplicar nada:
  Lote 1 · lo que ya está como cuota «anterior» (tanda 1, FCI, plazos fijos) → vincular
  Lote 2 · retiros y aportes (DIST MA, RET, AP 1)
  Lote 3 · pagos a los socios por Sueldos (JMS, AMS)
  Lote 4 · lo aprobado a templates en la vuelta 1 («ok registrar» de su v2)
  Resto  · lo que no está en ningún lote (queda histórico sin clasificar, o espera definición)
Códigos contable/interno: los de SU planilla, sólo normalizando la escritura (DITRI MA → DIST MA, JMS CTA → CTA JMS…).
"""
import openpyxl, collections, datetime, json, re, sys, os, urllib.request, urllib.parse
from openpyxl.styles import PatternFill, Font
from openpyxl.utils import get_column_letter as L

RAIZ = 'D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1/'
DIR = RAIZ + '- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude/'
FUENTE = DIR + 'Extracto MSA - Control Presupuestario.xlsx'
V2 = DIR + 'Extracto MSA - Control Presupuestario - TRABAJO v2.xlsx'
VIEJA = RAIZ + '- Comunicacion JMS Claude - Archivos/Balance/extracto desde julio del 2025 hasta enero 26 parcial. galicia MSA cta cte pesos.xlsx'
TANDA1 = DIR + 'Tanda 1 - propuesta de carga v3.xlsx'
SALIDA = DIR + 'Lotes del historico MSA - para revisar v1.xlsx'

env = {}
for l in open(RAIZ + '.env.local', encoding='utf-8'):
    if '=' in l and not l.strip().startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
def rest(tabla, params, schema=None):
    url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1/' + tabla + '?' + urllib.parse.urlencode(params, safe='(),.*:')
    h = {'apikey': env['SUPABASE_SERVICE_ROLE_KEY'], 'Authorization': 'Bearer ' + env['SUPABASE_SERVICE_ROLE_KEY']}
    if schema: h['Accept-Profile'] = schema
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=h)).read())

r2 = lambda x: round(float(x), 2) if isinstance(x, (int, float, str)) and str(x) not in ('', 'None') else 0.0
iso = lambda d: d.strftime('%Y-%m-%d') if isinstance(d, (datetime.datetime, datetime.date)) else str(d)[:10]
dmy = lambda s_: '/'.join(reversed(str(s_)[:10].split('-')))
s = lambda x: '' if x is None else str(x).strip()
clave = lambda fecha, deb, cre, saldo: (iso(fecha), r2(deb), r2(cre), r2(saldo))

# ── Los movimientos históricos de la base (con su id) y su fila de la planilla ─────────────────────────
hist = []
for d in range(0, 2000, 1000):
    pag = rest('msa_galicia', {'select': 'id,fecha,debitos,creditos,saldo,orden,descripcion,leyendas_adicionales_1,leyendas_adicionales_2,detalle',
                               'estado': 'eq.historico', 'order': 'orden.asc', 'offset': str(d), 'limit': '1000'})
    hist += pag
    if len(pag) < 1000: break
assert len(hist) == 860, len(hist)
ws = openpyxl.load_workbook(FUENTE, data_only=True).worksheets[0]
H = {s(c.value): c.column for c in ws[4] if c.value}
fila_de = {}
por_clave = collections.defaultdict(list)
for i in range(5, ws.max_row + 1):
    f = ws.cell(i, 1).value
    if isinstance(f, datetime.datetime):
        por_clave[clave(f, ws.cell(i, H['Débitos']).value, ws.cell(i, H['Créditos']).value, ws.cell(i, H['Saldo']).value)].append(i)
mov = {}
for m in hist:
    i = por_clave[clave(m['fecha'], m['debitos'], m['creditos'], m['saldo'])].pop(0)
    g = lambda n: ws.cell(i, H[n]).value
    mov[i] = {**m, 'fila': i, 'deb': r2(m['debitos']), 'cre': r2(m['creditos']), 'categ_p': s(g('CATEG')), 'det_p': s(g('Detalle')),
              'cont_p': s(g('Contable')), 'int_p': s(g('Interno'))}

# ── Normalización de la ESCRITURA de sus códigos (no del criterio) ────────────────────────────────────
NORM = {'DITRI MA': 'DIST MA', 'DISTRI MA': 'DIST MA', 'JMS CTA': 'CTA JMS', 'AMS CTA': 'CTA AMS', 'CUENTA JMS': 'CTA JMS', 'RET I PAM': 'RET 1 PAM', 'RET i PAM': 'RET 1 PAM'}
norm = lambda c: NORM.get(c, NORM.get(c.upper(), c)) if c else ''

# ── Templates y cuotas de la app ──────────────────────────────────────────────────────────────────────
tpls = {t['id']: t for t in rest('egresos_sin_factura', {'select': 'id,nombre_referencia,categ,responsable,año,codigo_contable,codigo_interno'})}
por_nombre = collections.defaultdict(list)
for t in tpls.values(): por_nombre[t['nombre_referencia']].append(t)
ant = rest('cuotas_egresos_sin_factura', {'select': 'id,egreso_id,fecha_estimada,monto,tipo_movimiento,descripcion', 'estado': 'eq.anterior'})

# ── LOTE 1: qué movimientos forman cada cuota «anterior» (mismo cruce que la revisión del 15/10) ────────
wv = openpyxl.load_workbook(VIEJA, data_only=True).worksheets[0]
hv = {s(c.value): c.column for c in wv[3] if c.value}
vieja_a_nueva, vieja = {}, {}
for i in range(4, wv.max_row + 1):
    f = wv.cell(i, 1).value
    if not isinstance(f, datetime.datetime): continue
    vieja[i] = {'fecha': f, 'deb': r2(wv.cell(i, hv['Débitos']).value), 'cre': r2(wv.cell(i, hv['Créditos']).value),
                'categ': s(wv.cell(i, hv['CATEG']).value).upper(), 'desc': s(wv.cell(i, hv['Descripción']).value), 'det': s(wv.cell(i, hv['Detalle']).value),
                'saldo': r2(wv.cell(i, hv['Saldo']).value)}
idx = {(iso(m['fecha']), m['deb'], m['cre'], r2(m['saldo'])): i for i, m in mov.items()}
for i, m in vieja.items(): vieja_a_nueva[i] = idx[(iso(m['fecha']), m['deb'], m['cre'], m['saldo'])]
wt = openpyxl.load_workbook(TANDA1, data_only=True)['01 Cuotas propuestas']
ht = {c.value: k for k, c in enumerate(wt[1])}
filas_de_cuota, usadas = {}, set()
for row in wt.iter_rows(min_row=2, values_only=True):
    if not isinstance(row[0], int): continue
    monto = r2(row[ht['Débito (egreso)']] or row[ht['Crédito (ingreso)']] or 0)
    c = next(c for c in ant if c['id'] not in usadas and tpls[c['egreso_id']]['nombre_referencia'] == row[ht['Template']]
             and c['fecha_estimada'] == iso(row[ht['Fecha']]) and c['tipo_movimiento'] == row[ht['Tipo']] and abs(r2(c['monto']) - monto) < 0.01)
    usadas.add(c['id']); filas_de_cuota[c['id']] = [vieja_a_nueva[int(x)] for x in re.findall(r'\d+', s(row[ht['Filas de tu planilla']]))]
for c in ant:
    if c['id'] in usadas: continue
    nom = tpls[c['egreso_id']]['nombre_referencia']; mes = c['fecha_estimada'][:7]; ing = c['tipo_movimiento'] == 'ingreso'
    if 'FIMA' in nom:
        filas_de_cuota[c['id']] = [vieja_a_nueva[i] for i, m in vieja.items() if m['categ'] == 'FCI' and iso(m['fecha'])[:7] == mes and ((m['cre'] > 0) if ing else (m['deb'] > 0))]
    elif 'Plazo Fijo' in nom:
        filas_de_cuota[c['id']] = [vieja_a_nueva[i] for i, m in vieja.items() if re.search(r'plazo fij', m['desc'] + m['det'], re.I)
                                   and iso(m['fecha']) == c['fecha_estimada'] and abs((m['cre'] if ing else m['deb']) - r2(c['monto'])) < 0.01]

filas = []   # una por movimiento propuesto
def agregar(lote, i, destino, accion, categ_app, cont, inte, aviso='', cuota=None, ctrl=None):
    m = mov[i]
    filas.append({'Lote': lote, 'Fila de tu planilla': i, 'Fecha': dmy(m['fecha']), 'Descripción del banco': m['descripcion'],
                  'Débito': m['deb'] or None, 'Crédito': m['cre'] or None, 'A quién (leyenda)': s(m['leyendas_adicionales_1']),
                  'Tu CATEG': m['categ_p'], 'Tu Detalle': m['det_p'], 'Tu Contable': m['cont_p'], 'Tu Interno': m['int_p'],
                  'Destino en la app': destino, 'Qué se hace': accion, 'Cuenta de la app (categ)': categ_app,
                  'Contable que queda': cont, 'Interno que queda': inte,
                  'Cuota de hoy': cuota or '', 'Control de la cuota': ctrl if ctrl is not None else '', 'Aviso': aviso,
                  'JMS: decisión': '', 'JMS: nota': '', 'id movimiento': m['id']})
asignados = set()

# LOTE 1
for c in sorted(ant, key=lambda c: (tpls[c['egreso_id']]['nombre_referencia'], c['fecha_estimada'])):
    fs = filas_de_cuota.get(c['id'], [])
    if not fs: continue
    t = tpls[c['egreso_id']]; ing = c['tipo_movimiento'] == 'ingreso'
    suma = round(sum(mov[f]['cre'] if ing else mov[f]['deb'] for f in fs), 2)
    for f in fs:
        uno = len(fs) == 1
        agregar('1 · ya está como cuota', f, t['nombre_referencia'],
                'Vincular a su cuota (1 a 1)' if uno else f'Separar: la cuota del mes ({len(fs)} mov.) pasa a una cuota por movimiento, y cada uno se vincula a la suya',
                t['categ'], norm(mov[f]['cont_p']), norm(mov[f]['int_p']),
                cuota=f"{dmy(c['fecha_estimada'])} {c['tipo_movimiento']} ${r2(c['monto']):,.2f} ({len(fs)} mov.)".replace(',', 'X').replace('.', ',').replace('X', '.'),
                ctrl=round(r2(c['monto']) - suma, 2))
        asignados.add(f)

# LOTES 2–4: las decisiones de la vuelta 1 que él marcó «ok registrar»
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from historico_msa_decisiones import D as DEC
wv2 = openpyxl.load_workbook(V2, data_only=True).worksheets[0]
h2 = {s(c.value): c.column for c in wv2[4] if c.value}
marca = {i: (s(wv2.cell(i, h2['JMS: decisión']).value), s(wv2.cell(i, h2['JMS: nota']).value)) for i in mov}
RED_VIAL = {560: [('Tango Parra 1', 28162.64), ('Tango Parra 2', 31475.89), ('Tango Prim Leboso', 28162.64), ('Cholo 1', 21536.13), ('Cholo 2', 19879.51),
                  ('Porteria Nuevo', 28162.64), ('Porteria Viejo', 28162.64), ('Sanchez', 29819.27), ('Anexo', 29819.27)],
            208: [('Tango Parra 1', 29911.72), ('Tango Parra 2', 33430.75), ('Tango Prim Leboso', 29911.72), ('Cholo 1', 22873.67), ('Cholo 2', 21114.15),
                  ('Porteria Nuevo', 29911.72), ('Porteria Viejo', 29911.72), ('Sanchez', 31671.23), ('Anexo', 31671.23)],
            559: [('Casco', 281626.42), ('Entre Rios', 43900.59), ('Tapera 1', 29819.27), ('Tapera 2', 29819.27), ('Tapera 3', 31475.89), ('Ombu', 128388.52)]}
CATEG_DE = {t['nombre_referencia']: t['categ'] for t in tpls.values()}
for x in DEC:
    i = x['fila']
    dj, nj = marca.get(i, ('', ''))
    if dj != 'ok registrar' or i in asignados: continue
    m = mov[i]; dest = x['destino']
    cont, inte = norm(m['cont_p']), norm(m['int_p'])
    if dest.startswith('SUELDOS'):
        quien = 'JMS' if '· JMS' in dest else 'AMS'
        agregar('3 · socios por Sueldos', i, f'Sueldos · {quien} · ' + dest.split('· ')[-1], 'Crear el pago histórico en Sueldos y vincular el movimiento', 'Sueldos',
                cont or f'CTA {quien}', inte, aviso=('Tu planilla no tiene código: propongo el de la regla de la app (CTA AMS).' if not cont else ''))
    elif m['categ_p'] in ('DIST MA', 'RET', 'AP 1'):
        tpl = 'Aporte PAM (template NUEVO)' if m['categ_p'] == 'AP 1' else dest.split('· ', 1)[1]
        agregar('2 · retiros y aportes', i, tpl, 'Crear la cuota «anterior» y vincular' + (' (antes, crear el template «Aporte PAM»: ingreso, distribución)' if m['categ_p'] == 'AP 1' else ''),
                'Aporte PAM' if m['categ_p'] == 'AP 1' else CATEG_DE.get(tpl, ''), cont, inte, aviso=nj)
    else:
        tpl = dest.split('· ', 1)[1].split(' (')[0]
        if i in RED_VIAL:
            for k, (part, imp) in enumerate(RED_VIAL[i]):
                agregar('4 · lo aprobado a templates', i, f'Red Vial Cuota {part}', 'Una cuota «anterior» por partida (tu detalle), pagadas juntas por este movimiento' if k == 0 else '   ↳ misma operación',
                        'Impuesto Red Vial', cont if k == 0 else '', inte if k == 0 else '', aviso=f'Partida {part}: ${imp:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'),
                        ctrl=round(m['deb'] - sum(v for _, v in RED_VIAL[i]), 2) if k == 0 else None)
                if k > 0: filas[-1]['Débito'] = None   # el importe del banco va sólo en la primera fila
        elif 'Amarok' in dest:
            agregar('4 · lo aprobado a templates', i, 'Imp Automotores Amarok Cuota (template NUEVO)', 'Crear el template como los de los otros vehículos, crear la cuota «anterior» y vincular', 'Impuesto Automotores', cont, inte, aviso=nj)
        elif 'ABL Posadas' in dest:
            agregar('4 · lo aprobado a templates', i, 'ABL Cochera Posadas Cuota', '⏸ Falta definir: «ver en qué cuota y cómo se registra» (son 2 cuotas de 2025 en un pago)', 'ABL Cochera Posadas', cont, inte, aviso=nj)
        else:
            agregar('4 · lo aprobado a templates', i, tpl, 'Crear la cuota «anterior» y vincular', CATEG_DE.get(tpl, ''), cont, inte, aviso=nj)
    asignados.add(i)
# Lote 3: los pagos de sueldo que YA están en Sueldos (30/01 y Coria 08/01) → sólo vincular
pagos = rest('pagos', {'select': 'id,empleado_id,fecha,monto,tipo', 'and': '(fecha.gte.2025-07-01,fecha.lte.2026-01-31)'}, 'sueldos')
emps = {e['id']: e['nombre'] for e in rest('empleados', {'select': 'id,nombre'}, 'sueldos')}
for p in pagos:
    i = next((i for i, m in mov.items() if i not in asignados and iso(m['fecha']) == p['fecha'] and abs(m['deb'] - r2(p['monto'])) < 0.01), None)
    if i is None: continue
    q = emps.get(p['empleado_id'], '?')
    agregar('3 · socios por Sueldos' if q in ('JMS', 'AMS') else '3b · otros sueldos ya cargados', i, f'Sueldos · {q} · {p["tipo"]} {dmy(p["fecha"])}', 'Ya está en Sueldos: sólo vincular el movimiento', 'Sueldos',
            norm(mov[i]['cont_p']) or ('CTA ' + q if q in ('JMS', 'AMS') else ''), norm(mov[i]['int_p']))
    asignados.add(i)

# RESTO
for i, m in sorted(mov.items(), key=lambda kv: kv[1]['orden']):
    if i in asignados: continue
    dj, nj = marca.get(i, ('', ''))
    agregar('Resto', i, '', 'Queda histórico sin clasificar' + (f' — tu marca: {dj}' if dj else ''), '', '', '', aviso=nj)

# ── Excel ─────────────────────────────────────────────────────────────────────────────────────────────
AZUL = PatternFill('solid', fgColor='DDEBF7'); VERDE = PatternFill('solid', fgColor='E2EFDA'); AMAR = PatternFill('solid', fgColor='FFF2CC'); B = Font(bold=True)
wb = openpyxl.Workbook(); s0 = wb.active; s0.title = '00 Resumen'
LOTES = ['1 · ya está como cuota', '2 · retiros y aportes', '3 · socios por Sueldos', '3b · otros sueldos ya cargados', '4 · lo aprobado a templates', 'Resto']
hojas = {}
for lt in LOTES:
    hojas[lt] = wb.create_sheet(lt.replace('·', '-')[:31])
cols = list(filas[0].keys())
for lt, sh in hojas.items():
    sh.append(cols)
    for c in sh[1]: c.font = B; c.fill = AMAR if c.value.startswith('JMS') else AZUL
    for f in filas:
        if f['Lote'] == lt: sh.append([f[k] for k in cols])
    sh.freeze_panes = 'C2'
    for row in sh.iter_rows(min_row=2):
        for c in row:
            if cols[c.column - 1] in ('Débito', 'Crédito', 'Control de la cuota') and isinstance(c.value, float): c.number_format = '#,##0.00'
s0.append(['LOTES DEL EXTRACTO HISTÓRICO MSA jul-2025 → ene-2026 — PARA REVISAR. Nada de esto está aplicado: los 860 movimientos están en la app como «histórico», sin clasificar.'])
s0.append(['Cada solapa es un lote, con los movimientos de a uno. Tus códigos contable/interno se respetan; sólo se normaliza la escritura (DITRI MA → DIST MA, JMS CTA → CTA JMS, AMS CTA → CTA AMS, RET i PAM → RET 1 PAM). Anotá en «JMS: decisión / nota».'])
s0.append([])
s0.append(['Lote', 'Movimientos', 'Débitos', 'Créditos'])
for c in s0[4]: c.font = B; c.fill = AZUL
ini = s0.max_row + 1
for lt in LOTES:
    n = s0.max_row + 1; hn = "'" + hojas[lt].title + "'"
    s0.append([lt, f'=COUNTA({hn}!B:B)-1', f'=SUM({hn}!E:E)', f'=SUM({hn}!F:F)'])
fin = s0.max_row
s0.append(['TOTAL', f'=SUM(B{ini}:B{fin})', f'=SUM(C{ini}:C{fin})', f'=SUM(D{ini}:D{fin})'])
extra = len(filas) - len({f['Fila de tu planilla'] for f in filas})
s0.append([f'Tiene que dar: los 860 históricos (+{extra} filas extra de partidas de Red Vial)', 860 + extra, 493264842.31, 493632619.78])
s0.append(['⚠️ En Red Vial un movimiento ocupa una fila por partida: la cantidad suma esas filas, y el débito va sólo en la primera.'])
for r in range(ini, s0.max_row + 1):
    for j in (3, 4): s0.cell(r, j).number_format = '#,##0.00'
s0.column_dimensions['A'].width = 60
# en Red Vial el importe va sólo en la primera fila
wb.save(SALIDA)
cnt = collections.Counter(f['Lote'] for f in filas)
print(SALIDA); print(dict(cnt))
print('mov únicos', len({f['Fila de tu planilla'] for f in filas}))
print('lote1 cuotas que no cierran', [f for f in filas if f['Lote'].startswith('1') and f['Control de la cuota'] not in ('', 0, 0.0)][:3])
