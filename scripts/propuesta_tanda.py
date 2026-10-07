"""
🧾 Propuesta de carga de una TANDA — v2, con la planilla del usuario COMPLETA (A-DAT-68, 2026-10-07).

Lee el libro v2 (`sugeridos_v2.py`): las marcas «Tanda» de la solapa 01 y «JMS: tanda» de la 03, y arma un
Excel APARTE con cómo se cargaría cada template. **No escribe en la base.**

    python scripts/propuesta_tanda.py 1             → arma el Excel (no escribe)
    python scripts/propuesta_tanda.py 1 --aplicar   → además carga la tanda (con OK del usuario)

Cada movimiento va con TODA la planilla del usuario (gris) + la propuesta del libro (verde) + sus columnas
(amarillo) + lo de la tanda (azul: template destino, cuota a la que va, aviso). Modo por template: «una cuota
por pago» (pagos sueltos) o «total del mes» (gastos del banco, neto de devoluciones). Estado «anterior».
CONTROL en el resumen, con fórmulas, como lo armó el usuario.
"""
import openpyxl, collections, datetime, json, re, sys, urllib.request, urllib.parse, calendar
from openpyxl.styles import PatternFill, Font
from openpyxl.utils import get_column_letter as L

TANDA = sys.argv[1] if len(sys.argv) > 1 else '1'
RAIZ = 'D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1/'
DIR = RAIZ + '- Comunicacion JMS Claude - Archivos/Balance/'
V2 = DIR + 'Extracto_2025-07_a_2026-01_TEMPLATES_SUGERIDOS_v2_completo.xlsx'
ANTERIOR = DIR + f'Tanda {TANDA} - propuesta de carga v2 completo.xlsx'   # de acá se traen tus respuestas («Orden de trabajo»)
SALIDA = DIR + f'Tanda {TANDA} - propuesta de carga v3.xlsx'
VERDE = PatternFill('solid', fgColor='E2EFDA'); AMARILLO = PatternFill('solid', fgColor='FFF2CC')
GRIS = PatternFill('solid', fgColor='EDEDED'); AZUL = PatternFill('solid', fgColor='DDEBF7'); NEGRITA = Font(bold=True)
MONEDA = '#,##0.00'
POR_PAGO = {'Cargas Sociales', 'UATRE', 'IIBB Mensual MSA', 'CZ Ganadera'}
ALIAS = [(r'debitos\s*/\s*creditos', 'Debitos / Creditos'), (r'\bIVA\b', 'Iva Bancario'),
         (r'comision transferencias', 'Comision Transferencias'), (r'cargas sociales', 'Cargas Sociales'), (r'CZ Ganader', 'CZ Ganadera')]
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

env = {}
for l in open(RAIZ + '.env.local', encoding='utf-8'):
    if '=' in l and not l.strip().startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
def rest(tabla, params):
    url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1/' + tabla + '?' + urllib.parse.urlencode(params, safe='(),.*:')
    req = urllib.request.Request(url, headers={'apikey': env['SUPABASE_SERVICE_ROLE_KEY'], 'Authorization': 'Bearer ' + env['SUPABASE_SERVICE_ROLE_KEY']})
    return json.loads(urllib.request.urlopen(req).read())

r2 = lambda x: round(float(x), 2) if isinstance(x, (int, float)) else 0.0
es_tanda = lambda v: str(v or '').strip().startswith(TANDA + ' ') or str(v or '').strip().startswith(TANDA + '-')
iso = lambda d: d.strftime('%Y-%m-%d') if isinstance(d, datetime.datetime) else str(d)[:10]
dmy = lambda s: '/'.join(reversed(s.split('-')))
ultimo = lambda ym: f"{ym}-{calendar.monthrange(int(ym[:4]), int(ym[5:7]))[1]:02d}"

wv = openpyxl.load_workbook(V2, data_only=True)
# Templates de la tanda (01)
s01 = wv['01 Por template y mes']; h01 = [c.value for c in s01[1]]
it = next(i for i, h in enumerate(h01) if h and 'tanda' in str(h).lower())
templates = {}
for row in s01.iter_rows(min_row=2, values_only=True):
    if row[0] and es_tanda(row[it]): templates[str(row[0]).strip()] = str(row[it]).strip()

# Movimientos (02, completo)
s02 = wv['02 Movimientos']; h02 = [c.value for c in s02[1]]
col = {str(h): i for i, h in enumerate(h02) if h}
iF, iD, iDeb, iCre, iDet = col['Fecha'], col['Descripción'], col['Débitos'], col['Créditos'], col['Detalle']
iTpl, iCar = col['Propuesta: Template sugerido'], col['Propuesta: ¿Cargar?']
iTan = col['JMS: tanda']
movs = []
for row in s02.iter_rows(min_row=2, values_only=True):
    if not isinstance(row[0], int): continue
    row = list(row)
    destino, origen, aviso = None, '', ''
    if es_tanda(row[iTan]) and 'agregar a' in str(row[iTan]):
        destino = next((t for re_, t in ALIAS if re.search(re_, str(row[iTan]), re.I)), None)
        origen = '03 · ' + str(row[iTan])
    elif str(row[iTpl] or '') in templates and str(row[iCar] or '').lower().startswith('s'):
        destino = str(row[iTpl]); origen = '02 · sugerido'
        if destino == 'UATRE' and 'uatre' not in str(row[iDet] or '').lower():
            aviso = '⚠ NO es UATRE (compra con débito): no se carga en esta tanda'
        if destino == 'CZ Ganadera' and re.search(r'smart\s*fa', str(row[iDet] or ''), re.I):
            aviso = '⚠ Smart Farming: es factura, no va a template (respuesta v2)'
    if not destino: continue
    movs.append({'row': row, 'tpl': destino, 'origen': origen, 'aviso': aviso, 'fecha': iso(row[iF]),
                 'deb': r2(row[iDeb]), 'cre': r2(row[iCre]), 'det': str(row[iDet] or row[iD] or '').strip()})
movs.sort(key=lambda m: (m['tpl'], m['fecha'], m['row'][0]))

# Templates y cuotas en la app
tpls = rest('egresos_sin_factura', {'select': 'id,nombre_referencia,categ,año', 'responsable': 'eq.MSA', 'activo': 'eq.true',
                                     'nombre_referencia': 'in.(' + ','.join('"' + t + '"' for t in templates) + ')'})
ids = ','.join(t['id'] for t in tpls)
cuotas_app = rest('cuotas_egresos_sin_factura', {'select': 'id,egreso_id,fecha_estimada,monto,estado', 'egreso_id': f'in.({ids})',
                                                 'and': '(fecha_estimada.gte.2025-07-01,fecha_estimada.lte.2026-01-31)'}) if ids else []
def tpl_de(nombre):
    c = [t for t in tpls if t['nombre_referencia'] == nombre]
    c.sort(key=lambda t: -sum(1 for q in cuotas_app if q['egreso_id'] == t['id']))
    return c[0] if c else None
usadas = set(); ULTIMA_ID = [None]
def accion(tpl, ym):
    for q in cuotas_app:
        if tpl and q['egreso_id'] == tpl['id'] and q['fecha_estimada'].startswith(ym) and float(q['monto']) == 0 and q['id'] not in usadas:
            usadas.add(q['id']); ULTIMA_ID[0] = q['id']; return f"actualizar la cuota en $0 del {dmy(q['fecha_estimada'])}"
    ULTIMA_ID[0] = None; return 'crear'

cuotas = []
for nombre in templates:
    tpl = tpl_de(nombre)
    suyos = [m for m in movs if m['tpl'] == nombre and not m['aviso']]
    if nombre in POR_PAGO:
        for m in suyos:
            tipo = 'ingreso' if m['cre'] > 0 and not m['deb'] else 'egreso'
            k = len(cuotas) + 1
            cuotas.append({'n': k, 'tpl': nombre, 'fecha': m['fecha'], 'monto': m['deb'] or m['cre'], 'tipo': tipo,
                           'desc': m['det'] + (' (devolución / anulación)' if tipo == 'ingreso' else '') + ' — histórico',
                           'accion': accion(tpl, m['fecha'][:7]) if tipo == 'egreso' else 'crear', 'movs': [m], 'modo': 'una cuota por pago'})
            m['cuota'] = k; cuotas[-1]['cuota_id'] = ULTIMA_ID[0] if tipo == 'egreso' else None
    else:
        por_mes = collections.defaultdict(list)
        for m in suyos: por_mes[m['fecha'][:7]].append(m)
        for ym in sorted(por_mes):
            # Sin netear (respuesta v2): los débitos del mes en una cuota egreso y los créditos en otra ingreso.
            for tipo, ms in (('egreso', [m for m in por_mes[ym] if m['deb']]), ('ingreso', [m for m in por_mes[ym] if not m['deb'] and m['cre']])):
                if not ms: continue
                k = len(cuotas) + 1; monto = round(sum(m['deb'] or m['cre'] for m in ms), 2)
                cuotas.append({'n': k, 'tpl': nombre, 'fecha': ultimo(ym), 'monto': monto, 'tipo': tipo,
                               'desc': f"{nombre} {MESES[int(ym[5:7]) - 1]} {ym[:4]}" + (' devoluciones' if tipo == 'ingreso' else '') + f" ({len(ms)} mov.) — histórico",
                               'accion': accion(tpl, ym) if tipo == 'egreso' else 'crear', 'movs': ms, 'modo': 'total del mes'})
                for m in ms: m['cuota'] = k
                cuotas[-1]['cuota_id'] = ULTIMA_ID[0] if tipo == 'egreso' else None

wb = openpyxl.Workbook(); wb.remove(wb.active)
def pintar_cab(ws, rangos):
    for j, c in enumerate(ws[1], start=1):
        c.font = NEGRITA
        for (a, b, fill) in rangos:
            if a <= j <= b: c.fill = fill

# 02 · movimientos con TODA la planilla
ws02 = wb.create_sheet('02 Movimientos')
extra = ['Tanda: template destino', 'Tanda: cuota Nº', 'Tanda: de dónde viene', 'Tanda: aviso']
ws02.append([h if h is not None else '' for h in h02] + extra)
n_pl = 1 + col['Propuesta: Template sugerido'] - 1  # fila planilla + columnas de la planilla
ini_v, ini_a = col['Propuesta: Template sugerido'] + 1, col['JMS: JMS audit'] + 1
pintar_cab(ws02, [(1, ini_v - 1, GRIS), (ini_v, ini_a - 1, VERDE), (ini_a, len(h02), AMARILLO), (len(h02) + 1, len(h02) + 4, AZUL)])
for m in movs:
    ws02.append(m['row'] + [m['tpl'], m.get('cuota', ''), m['origen'], m['aviso']])
ult = ws02.max_row
cD, cC, cAv = L(iDeb + 1), L(iCre + 1), L(len(h02) + 4)
for row in ws02.iter_rows(min_row=2):
    for c in row:
        if isinstance(c.value, datetime.datetime): c.number_format = 'DD/MM/YYYY'
        elif isinstance(c.value, float): c.number_format = MONEDA
ws02.append([])
ws02.append(['TOTAL movimientos de la tanda'] + [None] * (iDeb - 1) + [f'=SUM({cD}2:{cD}{ult})', f'=SUM({cC}2:{cC}{ult})']); t02 = ws02.max_row
ws02.append(['  de esos, NO se cargan (avisos)'] + [None] * (iDeb - 1) + [f'=SUMIFS({cD}2:{cD}{ult},{cAv}2:{cAv}{ult},"⚠*")', f'=SUMIFS({cC}2:{cC}{ult},{cAv}2:{cAv}{ult},"⚠*")']); no02 = ws02.max_row
for f in (t02, no02):
    ws02[f'A{f}'].font = NEGRITA; ws02[f'{cD}{f}'].number_format = MONEDA; ws02[f'{cC}{f}'].number_format = MONEDA
ws02.freeze_panes = 'B2'

# 01 · cuotas propuestas (con las filas de la planilla que la forman)
ws01 = wb.create_sheet('01 Cuotas propuestas', 0)
# Tus respuestas de la v2, por fila de planilla (la numeración de cuotas cambió al separar débitos y créditos)
resp = {}
try:
    wa = openpyxl.load_workbook(ANTERIOR, data_only=True)['01 Cuotas propuestas']
    ha = [c.value for c in wa[1]]
    iN = next(i for i, h in enumerate(ha) if h and 'orden de trabajo' in str(h).lower())
    for r in wa.iter_rows(min_row=2, values_only=True):
        if isinstance(r[0], int) and r[iN]:
            for f in str(r[9] or '').split(','): resp[f.strip()] = str(r[iN])
except Exception as e: print('sin respuestas v2:', e)
ws01.append(['Cuota Nº', 'Template', 'Modo', 'Fecha', 'Tipo', 'Débito (egreso)', 'Crédito (ingreso)', 'Descripción de la cuota', 'Qué se hace en la app', 'Movimientos', 'Filas de tu planilla', 'Débitos que la forman', 'Créditos que la forman', 'Tu respuesta en la v2'])
pintar_cab(ws01, [(1, 13, AZUL), (14, 14, AMARILLO)])
for c in cuotas:
    filas = [str(m['row'][0]) for m in c['movs']]
    ws01.append([c['n'], c['tpl'], c['modo'], datetime.datetime.strptime(c['fecha'], '%Y-%m-%d'), c['tipo'],
                 c['monto'] if c['tipo'] == 'egreso' else None, c['monto'] if c['tipo'] == 'ingreso' else None, c['desc'], c['accion'],
                 len(c['movs']), ', '.join(filas), round(sum(m['deb'] for m in c['movs']), 2), round(sum(m['cre'] for m in c['movs']), 2),
                 ' / '.join(dict.fromkeys(resp[f] for f in filas if f in resp))])
u01 = ws01.max_row
ws01.append([]); ws01.append(['TOTAL', None, None, None, None, f'=SUM(F2:F{u01})', f'=SUM(G2:G{u01})', None, None, f'=SUM(J2:J{u01})', None, f'=SUM(L2:L{u01})', f'=SUM(M2:M{u01})']); t01 = ws01.max_row
for row in ws01.iter_rows(min_row=2):
    for c in row:
        if isinstance(c.value, datetime.datetime): c.number_format = 'DD/MM/YYYY'
        elif isinstance(c.value, float): c.number_format = MONEDA
for j, w in enumerate([8, 26, 18, 11, 8, 15, 15, 60, 36, 11, 30, 18, 18, 50], start=1): ws01.column_dimensions[L(j)].width = w

# 00 · resumen + CONTROL
ws00 = wb.create_sheet('00 Resumen', 0)
ws00.append([f'TANDA {TANDA} — propuesta de carga del histórico jul-2025 → ene-2026 en templates MSA (estado «anterior»). NO cargado: es para revisar. v3: débitos y créditos sin netear, sin Smart Farming; cada movimiento con tu planilla completa.'])
ws00.append([])
ws00.append(['Template', 'Lo que marcaste', 'Modo propuesto', 'Cuotas', 'a crear', 'a actualizar (la de $0 del mes)', 'Débitos', 'Créditos', 'Neto (sólo referencia)', 'Template en la app'])
pintar_cab(ws00, [])
for c in ws00[3]: c.font = NEGRITA
for nombre, marca in templates.items():
    cs = [c for c in cuotas if c['tpl'] == nombre]; tpl = tpl_de(nombre)
    deb = round(sum(m['deb'] for c in cs for m in c['movs']), 2); cre = round(sum(m['cre'] for c in cs for m in c['movs']), 2)
    ws00.append([nombre, marca, 'una cuota por pago' if nombre in POR_PAGO else 'total del mes', len(cs),
                 sum(1 for c in cs if c['accion'] == 'crear'), sum(1 for c in cs if c['accion'] != 'crear'), deb, cre, round(deb - cre, 2),
                 f"{tpl['categ']} · año {tpl['año']}" if tpl else '⚠ NO EXISTE'])
ws00.append([None])
ws00.append(['CONTROL', None, None, None, None, None, 'Débitos', 'Créditos'])
b = ws00.max_row   # la fila del título CONTROL: las cuentas van en b+1 … b+5 (antes se contaba una fila de menos)
ws00.append(['Movimientos de la tanda (02)', None, None, None, None, None, f"='02 Movimientos'!{cD}{t02}", f"='02 Movimientos'!{cC}{t02}"])
ws00.append(['menos: los que no se cargan (avisos)', None, None, None, None, None, f"='02 Movimientos'!{cD}{no02}", f"='02 Movimientos'!{cC}{no02}"])
ws00.append(['a cargar, por diferencia (movimientos − no se cargan)', None, None, None, None, None, f'=G{b+1}-G{b+2}', f'=H{b+1}-H{b+2}'])
ws00.append(['Cuotas propuestas (01): débito y crédito de las cuotas', None, None, None, None, None, f"='01 Cuotas propuestas'!F{t01}", f"='01 Cuotas propuestas'!G{t01}"])
ws00.append(['control (tiene que dar 0)', None, None, None, None, None, f'=G{b+3}-G{b+4}', f'=H{b+3}-H{b+4}'])
ws00.append(['control interno: cuotas vs. movimientos que las forman (tiene que dar 0)', None, None, None, None, None, f"='01 Cuotas propuestas'!F{t01}-'01 Cuotas propuestas'!L{t01}", f"='01 Cuotas propuestas'!G{t01}-'01 Cuotas propuestas'!M{t01}"])
for f in (b, b + 5, b + 6): ws00[f'A{f}'].font = NEGRITA
for row in ws00.iter_rows(min_row=4):
    for c in row:
        if isinstance(c.value, float) or (isinstance(c.value, str) and c.value.startswith('=')): c.number_format = MONEDA
for j, w in enumerate([30, 46, 18, 8, 8, 28, 16, 16, 16, 40], start=1): ws00.column_dimensions[L(j)].width = w
wb.save(SALIDA)

td = round(sum(m['deb'] for m in movs), 2); tc = round(sum(m['cre'] for m in movs), 2)
nd = round(sum(m['deb'] for m in movs if m['aviso']), 2); nc = round(sum(m['cre'] for m in movs if m['aviso']), 2)
cd = round(sum(m['deb'] for c in cuotas for m in c['movs']), 2); cc = round(sum(m['cre'] for c in cuotas for m in c['movs']), 2)
print('Excel:', SALIDA)
print(f'templates {len(templates)} · movimientos {len(movs)} · cuotas {len(cuotas)} · control débitos {round(td-nd-cd,2)} créditos {round(tc-nc-cc,2)}')

# ── --aplicar: carga la tanda en la app (con OK del usuario). Estado «anterior», fecha = la del movimiento
# (o fin de mes en los «total del mes»). Las cuotas en $0 del mes se ACTUALIZAN en vez de duplicarse.
if '--aplicar' in sys.argv:
    def escribir(metodo, tabla, params, cuerpo):
        url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1/' + tabla + ('?' + urllib.parse.urlencode(params) if params else '')
        req = urllib.request.Request(url, data=json.dumps(cuerpo).encode(), method=metodo, headers={
            'apikey': env['SUPABASE_SERVICE_ROLE_KEY'], 'Authorization': 'Bearer ' + env['SUPABASE_SERVICE_ROLE_KEY'],
            'Content-Type': 'application/json', 'Prefer': 'return=representation'})
        return json.loads(urllib.request.urlopen(req).read())
    # No duplicar: si el template ya tiene cuotas «anterior» en jul–ene con monto, se frena
    ya = [q for q in cuotas_app if q['estado'] == 'anterior' and float(q['monto']) != 0]
    if ya: sys.exit(f'⛔ ya hay {len(ya)} cuotas «anterior» con monto en jul–ene de estos templates: no se carga (¿ya se aplicó?)')
    creadas = actualizadas = 0
    for c in cuotas:
        tpl = tpl_de(c['tpl'])
        cuerpo = {'fecha_estimada': c['fecha'], 'fecha_vencimiento': c['fecha'], 'monto': c['monto'], 'estado': 'anterior',
                  'tipo_movimiento': c['tipo'], 'descripcion': c['desc']}
        if c.get('cuota_id'):
            r = escribir('PATCH', 'cuotas_egresos_sin_factura', {'id': 'eq.' + c['cuota_id']}, cuerpo); actualizadas += len(r)
        else:
            r = escribir('POST', 'cuotas_egresos_sin_factura', None, dict(cuerpo, egreso_id=tpl['id'])); creadas += len(r)
    print(f'✅ tanda {TANDA} cargada: {creadas} cuotas creadas · {actualizadas} cuotas en $0 actualizadas')
    sobran = [q for q in cuotas_app if float(q['monto']) == 0 and q['id'] not in usadas]
    for q in sobran:
        t = next(t for t in tpls if t['id'] == q['egreso_id'])
        print(f"   queda en $0: {t['nombre_referencia']} {dmy(q['fecha_estimada'])} ({q['estado']})")
