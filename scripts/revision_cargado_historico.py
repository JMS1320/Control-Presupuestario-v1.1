"""
Revisión de lo CARGADO del histórico MSA jul-2025 → ene-2026 (A-DAT-68). SÓLO LECTURA: lee tu Excel de base,
el Excel de la tanda 1 (qué filas formaron cada cuota) y la base (GET). Escribe un Excel NUEVO aparte.

Dos direcciones, como se haría a mano:
  A · cuota → movimientos: cada cuota «anterior» con los movimientos de tu planilla que la forman, y si TU
      CATEG/Detalle/descripción del banco dicen lo mismo que el template.
  B · tu planilla → cuotas: se filtra tu planilla con el criterio de cada template (escrito en la solapa 04)
      y se ve si cada movimiento que pasa el filtro está en una cuota o quedó afuera.
"""
import openpyxl, collections, datetime, json, re, urllib.request, urllib.parse
from openpyxl.styles import PatternFill, Font, Alignment
from openpyxl.utils import get_column_letter as L

RAIZ = 'D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1/'
BAL = RAIZ + '- Comunicacion JMS Claude - Archivos/Balance/'
BASE = BAL + 'extracto desde julio del 2025 hasta enero 26 parcial. galicia MSA cta cte pesos.xlsx'
TANDA1 = BAL + 'Excels trabajando con claude/Tanda 1 - propuesta de carga v3.xlsx'
SALIDA = BAL + 'Excels trabajando con claude/Revision de lo cargado - historico MSA jul25-ene26.xlsx'
HOY = datetime.date.today().strftime('%d/%m/%Y')

env = {}
for l in open(RAIZ + '.env.local', encoding='utf-8'):
    if '=' in l and not l.strip().startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
def rest(tabla, params):
    url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1/' + tabla + '?' + urllib.parse.urlencode(params, safe='(),.*:')
    req = urllib.request.Request(url, headers={'apikey': env['SUPABASE_SERVICE_ROLE_KEY'], 'Authorization': 'Bearer ' + env['SUPABASE_SERVICE_ROLE_KEY']})
    return json.loads(urllib.request.urlopen(req).read())

r2 = lambda x: round(float(x), 2) if isinstance(x, (int, float)) else 0.0
iso = lambda d: d.strftime('%Y-%m-%d') if isinstance(d, (datetime.datetime, datetime.date)) else str(d)[:10]
s = lambda x: '' if x is None else str(x)

# ── 1. Tu planilla (fila = fila de tu Excel) ─────────────────────────────────────────────────────────────
wb = openpyxl.load_workbook(BASE, data_only=True); ws = wb.worksheets[0]
HEAD = [c.value for c in ws[3]][:22]
plan = {}
for i in range(4, ws.max_row + 1):
    v = [c.value for c in ws[i]][:22]
    if not isinstance(v[0], datetime.datetime): continue
    d = dict(zip(HEAD, v)); d['_fila'] = i; d['_fecha'] = iso(v[0]); d['_deb'] = r2(d['Débitos']); d['_cre'] = r2(d['Créditos'])
    plan[i] = d

# ── 2. La base: cuotas del período ───────────────────────────────────────────────────────────────────────
tpls = {t['id']: t for t in rest('egresos_sin_factura', {'select': 'id,nombre_referencia,responsable,año'})}
cuotas = rest('cuotas_egresos_sin_factura', {'select': 'id,egreso_id,fecha_estimada,monto,estado,tipo_movimiento,descripcion,created_at',
                                              'and': '(fecha_estimada.gte.2025-07-01,fecha_estimada.lte.2026-01-31)'})
for c in cuotas:
    t = tpls.get(c['egreso_id'], {}); c['tpl'] = t.get('nombre_referencia', '?'); c['resp'] = t.get('responsable'); c['anio'] = t.get('año')
    c['monto'] = r2(float(c['monto'] or 0)); c['movs'] = []; c['creada'] = c.get('created_at') or ''
anteriores = [c for c in cuotas if c['estado'] == 'anterior']
otras = [c for c in cuotas if c['estado'] != 'anterior']

# ── 3. Qué filas formaron cada cuota de la tanda 1 (su Excel) ───────────────────────────────────────────
wt = openpyxl.load_workbook(TANDA1, data_only=True)['01 Cuotas propuestas']
ht = [c.value for c in wt[1]]; it = {h: i for i, h in enumerate(ht)}
usadas = set(); sin_par = []
for row in wt.iter_rows(min_row=2, values_only=True):
    if not isinstance(row[0], int): continue
    tpl, fecha, tipo = row[it['Template']], iso(row[it['Fecha']]), row[it['Tipo']]
    monto = r2(row[it['Débito (egreso)']] or row[it['Crédito (ingreso)']] or 0)
    filas = [int(x) for x in re.findall(r'\d+', s(row[it['Filas de tu planilla']]))]
    c = next((c for c in anteriores if c['id'] not in usadas and c['tpl'] == tpl and c['fecha_estimada'] == fecha
              and c['tipo_movimiento'] == tipo and abs(c['monto'] - monto) < 0.01), None)
    if not c: sin_par.append((tpl, fecha, tipo, monto)); continue
    usadas.add(c['id']); c['movs'] = filas; c['origen'] = 'Tanda 1'

# FCI y plazo fijo: se cargaron aparte (por mes y sentido / por movimiento)
def fci(d): return s(d['CATEG']).strip().upper() == 'FCI'
def pf(d): return bool(re.search(r'plazo fij', s(d['Descripción']) + ' ' + s(d['Detalle']), re.I))
for c in anteriores:
    if c['id'] in usadas: continue
    mes = c['fecha_estimada'][:7]; ing = c['tipo_movimiento'] == 'ingreso'
    if 'FIMA' in c['tpl']:
        filas = [f for f, d in plan.items() if fci(d) and d['_fecha'][:7] == mes and ((d['_cre'] > 0) if ing else (d['_deb'] > 0))]
        c['movs'] = filas; c['origen'] = 'FCI (total del mes por sentido)'
    elif 'Plazo Fijo' in c['tpl']:
        filas = [f for f, d in plan.items() if pf(d) and d['_fecha'] == c['fecha_estimada'] and abs((d['_cre'] if ing else d['_deb']) - c['monto']) < 0.01]
        c['movs'] = filas; c['origen'] = 'Plazo fijo (un movimiento)'
    else:
        c['origen'] = ('no la cargamos en el histórico: existe desde ' + str(c.get('creada', ''))[:10] + '; no hay un débito por este importe en tu extracto de MSA') if c.get('creada', '') < '2026-10-01' else '⚠ no sé de qué movimientos sale'

# ── 4. Filtros «a mano» sobre TU planilla, por template ─────────────────────────────────────────────────
D = lambda d: s(d['Descripción']); DET = lambda d: s(d['Detalle']); CAT = lambda d: s(d['CATEG']).strip().upper()
LEY = lambda d: ' '.join(s(d.get(k)) for k in ('Leyendas Adicionales1', 'Leyendas Adicionales2', 'Leyendas Adicionales3', 'Leyendas Adicionales4'))
FILTROS = {
    'Debitos / Creditos': ('Descripción del banco contiene «25413» (impuesto al débito y crédito y sus devoluciones)', lambda d: '25413' in D(d)),
    'Iva Bancario': ('Descripción del banco es «Iva» o «Reintegro Iva»', lambda d: D(d).strip().lower() in ('iva', 'reintegro iva')),
    'Percepcion IVA': ('Descripción del banco contiene «Percep» + «Iva»', lambda d: bool(re.search(r'percep.*iva', D(d), re.I))),
    'IIBB Bancario': ('Descripción del banco contiene «Ing. Brutos»', lambda d: bool(re.search(r'ing\.? brutos', D(d), re.I))),
    'Sellos Bancario': ('Descripción del banco contiene «Sellos»', lambda d: 'sellos' in D(d).lower()),
    'Comision Caja de Seguridad': ('Descripción del banco contiene «Caja De Seguridad»', lambda d: 'caja de seguridad' in D(d).lower()),
    'Comision Cheques': ('Descripción del banco contiene «Comision Cheque»', lambda d: 'comision cheque' in D(d).lower()),
    'Comision Cuenta Bancaria': ('Descripción del banco contiene «Servicio De Cuenta»', lambda d: 'servicio de cuenta' in D(d).lower()),
    'Comision Extraccion Efectivo': ('Descripción del banco contiene «Comision Extraccion»', lambda d: 'comision extraccion' in D(d).lower()),
    'Comision Transferencias': ('Descripción del banco contiene «Transf» y «Com» (comisión o su devolución)', lambda d: bool(re.search(r'com.*transf|transf.*com', D(d), re.I))),
    'Cargas Sociales': ('Tu Detalle contiene «Cargas Sociales», «SUSS» o «931»', lambda d: bool(re.search(r'cargas soc|suss|931', DET(d), re.I))),
    'UATRE': ('Tu Detalle, tu CATEG o las leyendas contienen «UATRE»', lambda d: 'uatre' in (DET(d) + ' ' + CAT(d) + ' ' + LEY(d)).lower()),
    'IIBB Mensual MSA': ('Tu Detalle contiene «IIBB» y la descripción del banco NO es «Ing. Brutos» (ése es el bancario)', lambda d: bool(re.search(r'\biibb\b', DET(d), re.I)) and not re.search(r'ing\.? brutos', D(d), re.I)),
    'CZ Ganadera': ('Tu CATEG es «CZ», o tu Detalle/leyendas dicen «DTE», «SENASA» o «CZ Ganad»', lambda d: CAT(d) == 'CZ' or bool(re.search(r'\bdte\b|senasa|cz ganad', DET(d) + ' ' + LEY(d), re.I))),
    'FIMA Premium Galicia Pesos (rescate inmediato)': ('Tu CATEG es «FCI»', fci),
    'Plazo Fijo Banco Galicia': ('Descripción del banco o tu Detalle contienen «Plazo Fij»', pf),
}
# Barrido amplio: palabras que deberían hacer sospechar de cada template aunque el filtro no las agarre
SOSPECHA = {
    'Cargas Sociales': r'cargas|sicoss|seguridad social|f\.?\s?931|aportes', 'UATRE': r'uatre|sindicato|osprera|renatre',
    'IIBB Mensual MSA': r'iibb|ingresos brutos|arba|agip', 'CZ Ganadera': r'senasa|\bdte\b|ganader',
    'FIMA Premium Galicia Pesos (rescate inmediato)': r'fima|fondo|fci|suscrip|rescate',
    'Plazo Fijo Banco Galicia': r'plazo|vencim|\bpf\b',
    'Debitos / Creditos': r'25413|deb\.? ?cred|\bdc\b', 'Iva Bancario': r'\biva\b',
    'Sellos Bancario': r'sellos', 'Comision Transferencias': r'comisi',
}

en_cuota = {}   # fila -> (template, cuota)
for c in anteriores:
    for f in c['movs']: en_cuota.setdefault(f, []).append(c)
plantillas = sorted({c['tpl'] for c in anteriores})

# ── 5. Excel ────────────────────────────────────────────────────────────────────────────────────────────
VERDE = PatternFill('solid', fgColor='E2EFDA'); AMAR = PatternFill('solid', fgColor='FFF2CC'); ROJO = PatternFill('solid', fgColor='F8CBAD')
GRIS = PatternFill('solid', fgColor='EDEDED'); AZUL = PatternFill('solid', fgColor='DDEBF7'); B = Font(bold=True); MON = '#,##0.00'
out = openpyxl.Workbook()
s0 = out.active; s0.title = '00 Resumen'
s1 = out.create_sheet('01 Cuotas cargadas'); s2 = out.create_sheet('02 Movimientos'); s3 = out.create_sheet('03 Fuera de cuota')
s4 = out.create_sheet('04 Filtros usados'); s5 = out.create_sheet('05 Inventario anterior')

COLS = [h for h in HEAD if h]
h2 = ['Veredicto', 'Por qué'] + ['Fila de tu planilla'] + COLS + ['Template de la cuota', 'Fecha cuota', 'Importe que aporta', 'Tipo', 'Id cuota', 'Filtro de template que lo agarra']
LT = {h: L(i + 1) for i, h in enumerate(h2)}
IMP, IDC, TPC, FIL, DEB, CRE = LT['Importe que aporta'], LT['Id cuota'], LT['Template de la cuota'], LT['Filtro de template que lo agarra'], LT['Débitos'], LT['Créditos']
# 01 · una fila por cuota cargada
h1 = ['Template', 'Responsable', 'Fecha cuota', 'Tipo', 'Monto cuota', 'Descripción de la cuota', 'De dónde salió', 'Filas de tu planilla', 'Cant. movimientos', 'Suma de los movimientos', 'Diferencia', 'Id cuota']
s1.append(h1)
for c in sorted(anteriores, key=lambda c: (c['tpl'], c['fecha_estimada'], c['tipo_movimiento'])):
    s1.append([c['tpl'], c['resp'], datetime.datetime.fromisoformat(c['fecha_estimada']), c['tipo_movimiento'], c['monto'], c['descripcion'],
               c['origen'], ', '.join(map(str, c['movs'])), len(c['movs']), None, None, c['id'][:8]])
    n = s1.max_row
    s1.cell(n, 10, f"=SUMIFS('02 Movimientos'!${IMP}:${IMP},'02 Movimientos'!${IDC}:${IDC},L{n})")
    s1.cell(n, 11, f'=ROUND(E{n}-J{n},2)')
fin1 = s1.max_row

# 02 · un movimiento por fila: los que forman cuotas + los que pasan algún filtro y quedaron afuera
s2.append(h2)
veredictos = collections.Counter(); filas_02 = []
for f, d in sorted(plan.items(), key=lambda x: (x[1]['_fecha'], -x[0])):
    pasa = [t for t, (_, fn) in FILTROS.items() if fn(d)]
    cs = en_cuota.get(f, [])
    if not cs and not any(t in plantillas for t in pasa): continue
    for c in (cs or [None]):
        if c:
            ok = c['tpl'] in pasa
            if ok: v, por = '✓ coincide', f'tu planilla lo identifica como {c["tpl"]} (filtro de la solapa 04)'
            else: v, por = '⚠ revisar', f'está en la cuota de {c["tpl"]} pero el filtro de ese template no lo agarra' + (f'; el filtro que lo agarra es {", ".join(pasa)}' if pasa else '')
            aporta = d['_cre'] if c['tipo_movimiento'] == 'ingreso' else d['_deb']
            fila_c = [c['tpl'], datetime.datetime.fromisoformat(c['fecha_estimada']), aporta, c['tipo_movimiento'], c['id'][:8]]
        else:
            t = next(t for t in pasa if t in plantillas)
            v, por = '❌ falta cargar', f'tu planilla lo identifica como {t} y no está en ninguna cuota'
            fila_c = [None, None, None, None, None]
        veredictos[v] += 1
        s2.append([v, por, f] + [d[h] for h in COLS] + fila_c + [', '.join(pasa)])
        fill = VERDE if v.startswith('✓') else (AMAR if v.startswith('⚠') else ROJO)
        s2.cell(s2.max_row, 1).fill = fill
        filas_02.append((v, c['tpl'] if c else t))
fin2 = s2.max_row

# 03 · palabras que hacen sospechar y no están en ninguna cuota de ese template
h3 = ['Template que podría ser', 'Por qué lo muestro', 'Fila de tu planilla'] + COLS + ['¿Está en alguna cuota?']
s3.append(h3)
for f, d in sorted(plan.items(), key=lambda x: (x[1]['_fecha'], -x[0])):
    texto = ' '.join([D(d), DET(d), CAT(d), LEY(d)])
    for t, rx in SOSPECHA.items():
        if t not in plantillas: continue
        if not re.search(rx, texto, re.I): continue
        if f in en_cuota: continue   # ya está en una cuota y tu planilla coincide (solapa 02)
        if FILTROS[t][1](d): continue   # ya figura como «falta cargar» en la 02
        otra = ', '.join(sorted({c['tpl'] for c in en_cuota.get(f, [])})) or 'no'
        s3.append([t, f'contiene una palabra de «{t}» ({rx})', f] + [d[h] for h in COLS] + [otra])

# 04 · filtros
s4.append(['Template', 'Filtro sobre TU planilla (lo mismo que harías con el autofiltro)', 'Palabras de sospecha (solapa 03)'])
for t in plantillas:
    s4.append([t, FILTROS[t][0] if t in FILTROS else '⚠ sin filtro definido', SOSPECHA.get(t, '')])

# 05 · inventario: TODAS las cuotas «anterior» de la base (cualquier fecha) + las demás cuotas del período
todas_ant = rest('cuotas_egresos_sin_factura', {'select': 'id,egreso_id,fecha_estimada,monto,estado,tipo_movimiento,descripcion,created_at,updated_at', 'estado': 'eq.anterior'})
def origen_de(c):
    hist = s(c.get('descripcion')).endswith('— histórico'); cre = s(c.get('created_at'))[:10]; act = s(c.get('updated_at'))[:10]
    if hist and cre >= '2026-10-07': return 'CARGA DEL HISTÓRICO 07/10/2026 — cuota creada'
    if hist: return f'CARGA DEL HISTÓRICO 07/10/2026 — cuota que ya existía en $0 (creada {cre}), completada'
    return f'YA ESTABA ANTES de la carga del histórico (creada {cre}) — no la tocamos'
s5.append(['Origen', 'Template', 'Responsable', 'Fecha cuota', 'Tipo', 'Monto', 'Estado', 'Descripción', 'Creada', 'Última modificación', '¿Sale de tu extracto MSA jul–ene?', 'Id cuota'])
ids_rev = {c['id']: c for c in anteriores}
for c in sorted(todas_ant, key=lambda c: (origen_de(c), tpls.get(c['egreso_id'], {}).get('nombre_referencia', ''), c['fecha_estimada'])):
    tp = tpls.get(c['egreso_id'], {}); rv = ids_rev.get(c['id'])
    sale = ('sí: filas ' + ', '.join(map(str, rv['movs']))) if rv and rv['movs'] else ('no' if rv else 'fuera del período jul–ene')
    s5.append([origen_de(c), tp.get('nombre_referencia'), tp.get('responsable'), datetime.datetime.fromisoformat(c['fecha_estimada']), c['tipo_movimiento'],
               r2(float(c['monto'] or 0)), c['estado'], c['descripcion'], s(c['created_at'])[:10], s(c['updated_at'])[:10], sale, c['id']])
for c in sorted(otras, key=lambda c: (c['tpl'], c['fecha_estimada'])):
    s5.append(['OTRA CUOTA DEL PERÍODO, no «anterior»', c['tpl'], c['resp'], datetime.datetime.fromisoformat(c['fecha_estimada']), c['tipo_movimiento'],
               c['monto'], c['estado'], c['descripcion'], s(c.get('created_at'))[:10], '', '', c['id']])
print('inventario:', collections.Counter(origen_de(c).split(' (')[0].split(' —')[0] + (' · creada' if 'creada' in origen_de(c) and 'existía' not in origen_de(c) else '') for c in todas_ant))

# 00 · resumen por template, con fórmulas
s0.append([f'ESTO ES UN CONTROL DE LO YA CARGADO, NO UNA PROPUESTA DE CARGA. REVISIÓN DE LO CARGADO — histórico MSA jul-2025 → ene-2026 (cuotas «anterior»). Sólo lectura: no cambia nada en la app. Generado {HOY}.'])
s0.append(['Cómo leerlo: A) cada cuota cargada contra los movimientos de tu planilla que la forman (la diferencia tiene que dar 0); B) tu planilla filtrada con el criterio de cada template (solapa 04): cada movimiento que pasa el filtro tiene que estar en una cuota.'])
s0.append([])
h0 = ['Template', 'Cuotas cargadas', 'Egresos cargados', 'Ingresos cargados', 'Movimientos que las forman', 'Suma de esos movimientos', 'Control A: cuotas − movimientos (tiene que dar 0)',
      '✓ coincide', '⚠ revisar', '❌ falta cargar (tu planilla lo marca y no está)', 'Suma de lo que falta', 'Posibles en solapa 03']
s0.append(h0); ini = s0.max_row + 1
for t in plantillas:
    n = s0.max_row + 1
    s0.append([t,
               f"=COUNTIFS('01 Cuotas cargadas'!A:A,A{n})",
               f"=SUMIFS('01 Cuotas cargadas'!E:E,'01 Cuotas cargadas'!A:A,A{n},'01 Cuotas cargadas'!D:D,\"egreso\")",
               f"=SUMIFS('01 Cuotas cargadas'!E:E,'01 Cuotas cargadas'!A:A,A{n},'01 Cuotas cargadas'!D:D,\"ingreso\")",
               f"=SUMIFS('01 Cuotas cargadas'!I:I,'01 Cuotas cargadas'!A:A,A{n})",
               f"=SUMIFS('01 Cuotas cargadas'!J:J,'01 Cuotas cargadas'!A:A,A{n})",
               f'=ROUND(C{n}+D{n}-F{n},2)',
               f"=COUNTIFS('02 Movimientos'!{TPC}:{TPC},A{n},'02 Movimientos'!A:A,\"✓*\")",
               f"=COUNTIFS('02 Movimientos'!{TPC}:{TPC},A{n},'02 Movimientos'!A:A,\"⚠*\")",
               f"=COUNTIFS('02 Movimientos'!{FIL}:{FIL},\"*\"&A{n}&\"*\",'02 Movimientos'!A:A,\"❌*\")",
               f"=SUMIFS('02 Movimientos'!{DEB}:{DEB},'02 Movimientos'!{FIL}:{FIL},\"*\"&A{n}&\"*\",'02 Movimientos'!A:A,\"❌*\")+SUMIFS('02 Movimientos'!{CRE}:{CRE},'02 Movimientos'!{FIL}:{FIL},\"*\"&A{n}&\"*\",'02 Movimientos'!A:A,\"❌*\")",
               f"=COUNTIFS('03 Fuera de cuota'!A:A,A{n})"])
fin0 = s0.max_row
s0.append(['TOTAL'] + [f'=SUM({L(j)}{ini}:{L(j)}{fin0})' for j in range(2, 13)])
s0.append([])
if sin_par: s0.append([f'⚠ {len(sin_par)} cuota(s) de la tanda 1 que NO encontré en la base: ' + '; '.join(map(str, sin_par))])
else: s0.append(['✓ Las 74 cuotas de la tanda 1 están en la base tal como se propusieron (template, fecha, tipo y monto).'])
if otras:
    s0.append([f'Otras cuotas del período que NO son «anterior» (no las cargamos nosotros; se listan para que se vean): {len(otras)}'])
    for c in sorted(otras, key=lambda c: (c['tpl'], c['fecha_estimada'])):
        s0.append(['', c['tpl'], c['fecha_estimada'], c['estado'], c['monto'], c['resp']])

for sh in (s0, s1, s2, s3, s4, s5):
    for row in sh.iter_rows():
        for cell in row:
            if isinstance(cell.value, float): cell.number_format = MON
            if isinstance(cell.value, datetime.datetime): cell.number_format = 'DD/MM/YYYY'
    for cell in sh[1 if sh is not s0 else 4]: cell.font = B; cell.fill = AZUL
    sh.freeze_panes = 'A2' if sh is not s0 else 'B5'
for j in range(3, 13):
    for i in range(ini, fin0 + 2): s0.cell(i, j).number_format = MON if j in (3, 4, 6, 7, 11) else '0'
out.save(SALIDA)
print('cuotas anterior', len(anteriores), '| tanda1 sin par', len(sin_par), '| otras', len(otras))
print('veredictos', dict(veredictos))
print('columnas 02:', {h: L(i + 1) for i, h in enumerate(h2) if h in ('Template de la cuota', 'Importe que aporta', 'Id cuota', 'Filtro de template que lo agarra', 'Débitos', 'Créditos')})
print(SALIDA)

# ── verificación en Python (la misma cuenta que las fórmulas) ──
print('\n--- control A por cuota (sólo las que no dan 0 o no tienen origen claro) ---')
tot = collections.defaultdict(lambda: [0, 0.0, 0.0])
for c in anteriores:
    suma = sum((plan[f]['_cre'] if c['tipo_movimiento'] == 'ingreso' else plan[f]['_deb']) for f in c['movs'])
    dif = round(c['monto'] - suma, 2)
    tot[c['tpl']][0] += 1; tot[c['tpl']][1] += c['monto']; tot[c['tpl']][2] += dif
    if abs(dif) > 0.009 or c['origen'].startswith('⚠'):
        print(c['tpl'], c['fecha_estimada'], c['tipo_movimiento'], c['monto'], 'movs', c['movs'], 'dif', dif, c['origen'], c['estado'], c['descripcion'])
for t, (n, m, d) in sorted(tot.items()): print(f'{t:50} {n:3} {m:16,.2f} dif {d:,.2f}')
import sys
if '--detalle' not in sys.argv: raise SystemExit
print('\n--- solapa 03: sospechas ---')
for r in s3.iter_rows(min_row=2, values_only=True): print(r[0], '|', r[2], r[3], r[4], r[6], r[7], '|', r[20], r[21], '| en cuota:', r[-1])
print('\n--- otras cuotas del período (no anterior) con monto ≠ 0 ---')
for c in otras:
    if c['monto']: print(c['tpl'], c['fecha_estimada'], c['estado'], c['monto'], c['resp'])
print('otras en $0:', sum(1 for c in otras if not c['monto']))
