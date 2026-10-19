"""
📑 Los Excel de trabajo del histórico, con la PLANILLA DEL USUARIO COMPLETA (A-DAT-68, 2026-10-07).

Regla del usuario (2026-10-07): «en cada desglose, si contiene filas del extracto, vuelve a copiar toda la BBDD mía
tal cual más las nuevas columnas tuyas. O sea, siempre que se usa un movimiento, que vaya con la info completa».
`sugeridos_v2.py` lo hizo con los templates sugeridos; este script lo hace con los que faltaban y deja todo al día:

    python scripts/excels_planilla_completa.py

  A · Extracto_..._TEMPLATES_SUGERIDOS_v3.xlsx   ← la v2 + «Cargado en la app» por movimiento + «hoy en la app» al día
  B · Extracto_..._SEGMENTADO_v2_completo.xlsx    ← cada solapa de categoría con tu planilla completa + control
  C · Extractos_PAM_TEMPLATES_SUGERIDOS_v2_completo.xlsx
  D · Extractos_PAM_jul25-ene26_TEMPLATES_DE_MSA_v2_completo.xlsx

Nombres nuevos: no pisa nada. Colores: gris = tu planilla · verde = mi propuesta · amarillo = tus columnas ·
azul = lo que ya está cargado en la app. No escribe en la base (sólo lee las cuotas para «cargado» / «hoy en la app»).
Cada movimiento se empareja con su fila de la planilla por clave (fecha, importes y un dato que lo distingue) y
orden de aparición; el control de cada archivo dice cuántos se emparejaron y si alguno quedó sin fila.
"""
import openpyxl, collections, datetime, json, re, urllib.request, urllib.parse
from openpyxl.styles import PatternFill, Font
from openpyxl.utils import get_column_letter as L

RAIZ = 'D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1/'
DIR = RAIZ + '- Comunicacion JMS Claude - Archivos/Balance/'
GRIS = PatternFill('solid', fgColor='EDEDED'); VERDE = PatternFill('solid', fgColor='E2EFDA')
AMARILLO = PatternFill('solid', fgColor='FFF2CC'); AZUL = PatternFill('solid', fgColor='DDEBF7'); NEGRITA = Font(bold=True)
MONEDA = '#,##0.00'
HOY = datetime.date.today().strftime('%d/%m/%Y')

env = {}
for l in open(RAIZ + '.env.local', encoding='utf-8'):
    if '=' in l and not l.strip().startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
def rest(tabla, params):
    url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1/' + tabla + '?' + urllib.parse.urlencode(params, safe='(),.*:')
    req = urllib.request.Request(url, headers={'apikey': env['SUPABASE_SERVICE_ROLE_KEY'], 'Authorization': 'Bearer ' + env['SUPABASE_SERVICE_ROLE_KEY']})
    return json.loads(urllib.request.urlopen(req).read())

def fecha_iso(v):
    if isinstance(v, datetime.datetime): return v.strftime('%Y-%m-%d')
    s = str(v or '').strip()
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', s)
    return f'{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}' if m else s[:10]
def a_fecha(v):
    iso = fecha_iso(v)
    try: return datetime.datetime.strptime(iso, '%Y-%m-%d')
    except ValueError: return v
r2 = lambda x: round(float(x), 2) if isinstance(x, (int, float)) else 0.0
txt = lambda v: re.sub(r'\s+', ' ', str(v or '')).strip().lower()

def cabecera(ws, fila, tramos):
    for j, c in enumerate(ws[fila], start=1):
        c.font = NEGRITA
        for a, b, fill in tramos:
            if a <= j <= b: c.fill = fill
def formatear(ws, desde):
    for row in ws.iter_rows(min_row=desde):
        for c in row:
            if isinstance(c.value, datetime.datetime): c.number_format = 'DD/MM/YYYY'
            elif isinstance(c.value, float): c.number_format = MONEDA
class Emparejador:
    """Clave → filas de la planilla, consumidas en orden de aparición. Si la clave completa no aparece (el último
    dato —detalle u observación— se editó en el derivado), segundo intento sin ese dato: fecha + importes."""
    def __init__(self, filas, clave):
        self.pool = collections.defaultdict(collections.deque); self.pool2 = collections.defaultdict(collections.deque)
        for f in filas: self.pool[clave(f)].append(f); self.pool2[clave(f)[:-1]].append(f)
        self.usadas = set(); self.ok = self.mal = self.flojo = 0
    def _de(self, cola):
        while cola:
            f = cola.popleft()
            if id(f) not in self.usadas: self.usadas.add(id(f)); return f
    def tomar(self, k):
        f = self._de(self.pool.get(k, collections.deque()))
        if f is None:
            f = self._de(self.pool2.get(k[:-1], collections.deque()))
            if f is not None: self.flojo += 1
        if f is None: self.mal += 1
        else: self.ok += 1
        return f
    def sin_usar(self): return sum(1 for q in self.pool.values() for f in q if id(f) not in self.usadas)

# ═══════════ La planilla de MSA (jul-25 → ene-26) ═══════════
pl = openpyxl.load_workbook(DIR + 'extracto desde julio del 2025 hasta enero 26 parcial. galicia MSA cta cte pesos.xlsx', data_only=True).worksheets[0]
COLS_MSA = [str(c.value).strip() for c in pl[3] if c.value is not None]
MSA = []
for i, row in enumerate(pl.iter_rows(min_row=4, max_col=len(COLS_MSA), values_only=True), start=4):
    if not isinstance(row[0], datetime.datetime): continue
    d = dict(zip(COLS_MSA, row)); d['_fila'] = i; MSA.append(d)
iMSA = {h: j for j, h in enumerate(COLS_MSA)}
print(f'Planilla MSA: {len(MSA)} movimientos, {len(COLS_MSA)} columnas')

# Lo que ya está cargado en la app, por fila de la planilla
cargado = {}
t3 = openpyxl.load_workbook(DIR + 'Tanda 1 - propuesta de carga v3.xlsx', read_only=True, data_only=True)['02 Movimientos']
h3 = None
for row in t3.iter_rows(values_only=True):
    if h3 is None: h3 = {str(h): j for j, h in enumerate(row) if h}; continue
    if not isinstance(row[0], int): continue
    av = row[h3['Tanda: aviso']]
    cargado[row[0]] = f"NO se carga — {av.lstrip('⚠ ')}" if av else f"✓ Tanda 1 · {row[h3['Tanda: template destino']]} · cuota {row[h3['Tanda: cuota Nº']]} (anterior)"
for d in MSA:
    if str(d.get('CATEG') or '').strip().upper() == 'FCI': cargado[d['_fila']] = '✓ FCI · FIMA Premium Galicia Pesos · cuota del mes (anterior)'
    if re.search(r'plazo fijo', str(d.get('Descripción') or ''), re.I): cargado[d['_fila']] = '✓ Plazo Fijo Banco Galicia (anterior)'

# ═══════════ A · sugeridos v3 ═══════════
wa = openpyxl.load_workbook(DIR + 'Extracto_2025-07_a_2026-01_TEMPLATES_SUGERIDOS_v2_completo.xlsx')
for hoja in ('02 Movimientos', '03 Sin sugerencia'):
    ws = wa[hoja]
    # fuera las columnas «JMS: (sin título …)» vacías (salían por el formato de la hoja original, sin datos)
    for j in range(ws.max_column, 0, -1):
        h = ws.cell(1, j).value
        if h and str(h).startswith('JMS: (sin título') and all(ws.cell(i, j).value in (None, '') for i in range(2, ws.max_row + 1)):
            ws.delete_cols(j)
    nc = ws.max_column + 1
    ws.cell(1, nc, f'Cargado en la app (al {HOY})').fill = AZUL; ws.cell(1, nc).font = NEGRITA
    n = 0
    for i in range(2, ws.max_row + 1):
        f = ws.cell(i, 1).value
        if isinstance(f, int) and f in cargado: ws.cell(i, nc, cargado[f]); n += 1
    ws.column_dimensions[L(nc)].width = 60
    print(f'A · {hoja}: {n} movimientos marcados como cargados / no se cargan')
# «hoy en la app» al día: neto (egreso − ingreso) de las cuotas de cada template, por mes
ws = wa['01 Por template y mes']; h1 = [c.value for c in ws[1]]
cols_hoy = {str(h)[:7]: j + 1 for j, h in enumerate(h1) if h and 'hoy en la app' in str(h)}
tpls = rest('egresos_sin_factura', {'select': 'id,nombre_referencia', 'responsable': 'eq.MSA'})
cq = rest('cuotas_egresos_sin_factura', {'select': 'egreso_id,fecha_estimada,monto,tipo_movimiento,estado',
          'egreso_id': 'in.(' + ','.join(t['id'] for t in tpls) + ')', 'and': '(fecha_estimada.gte.2025-07-01,fecha_estimada.lte.2026-01-31)'})
por_nombre = collections.defaultdict(set)
for t in tpls: por_nombre[t['nombre_referencia'].strip()].add(t['id'])
for ym, j in cols_hoy.items(): ws.cell(1, j, f'{ym} hoy en la app (al {HOY})')
for i in range(2, ws.max_row + 1):
    nombre = str(ws.cell(i, 1).value or '').strip()
    if nombre not in por_nombre: continue
    for ym, j in cols_hoy.items():
        qs = [q for q in cq if q['egreso_id'] in por_nombre[nombre] and q['fecha_estimada'].startswith(ym)]
        ws.cell(i, j, round(sum(float(q['monto']) * (1 if q['tipo_movimiento'] == 'egreso' else -1) for q in qs), 2) if qs else 'sin cuota')
        if qs: ws.cell(i, j).number_format = MONEDA
ws0 = wa['00 Resumen']
ws0.cell(1, 1, str(ws0.cell(1, 1).value) + f' · v3 al {HOY}: columna «Cargado en la app» y «hoy en la app» al día (tanda 1, FCI y plazo fijo ya cargados)')
SAL_A = DIR + 'Extracto_2025-07_a_2026-01_TEMPLATES_SUGERIDOS_v3.xlsx'
wa.save(SAL_A); print('A ·', SAL_A)

# Para B: la propuesta y tu marca de tanda, por fila (de la v2, hoja 02 completa)
w2 = openpyxl.load_workbook(DIR + 'Extracto_2025-07_a_2026-01_TEMPLATES_SUGERIDOS_v2_completo.xlsx', read_only=True, data_only=True)['02 Movimientos']
prop = {}; h2 = None
for row in w2.iter_rows(values_only=True):
    if h2 is None: h2 = {str(h): j for j, h in enumerate(row) if h}; continue
    if isinstance(row[0], int):
        prop[row[0]] = (row[h2['Propuesta: Template sugerido']], row[h2['Propuesta: ¿Cargar?']], row[h2['JMS: tanda']], row[h2['JMS: JMS audit']])

# ═══════════ B · segmentado v2 ═══════════
wb = openpyxl.load_workbook(DIR + 'Extracto_2025-07_a_2026-01_SEGMENTADO_por_categoria.xlsx')
emp = Emparejador(MSA, lambda d: (fecha_iso(d['Fecha']), txt(d['Descripción']), r2(d['Débitos']), r2(d['Créditos']), txt(d['Detalle'])))
EXTRA_B = ['Propuesta: Template sugerido', 'Propuesta: ¿Cargar?', 'JMS: tanda', 'JMS: JMS audit', f'Cargado en la app (al {HOY})']
total_b = 0
for ws in wb.worksheets[1:]:
    hdr = next((r for r in range(1, ws.max_row + 1) if ws.cell(r, 1).value == 'Fecha' and str(ws.cell(r, 2).value or '').startswith('Descrip')), None)
    if not hdr: continue
    viejo = [[c.value for c in ws[r]] for r in range(hdr + 1, ws.max_row + 1)]
    viejo = [v for v in viejo if v and v[0]]
    tot_cuadro = next((r for r in range(hdr, 0, -1) if ws.cell(r, 1).value == 'TOTAL'), None)
    col_tot = next((j for j in range(1, ws.max_column + 1) if ws.cell(5, j).value == 'TOTAL'), None)
    ws.delete_rows(hdr, ws.max_row - hdr + 1)
    ws.cell(hdr - 1, 1, 'LOS MOVIMIENTOS, uno por uno — con tu planilla completa (gris), mi propuesta (verde), tus marcas (amarillo) y lo ya cargado (azul)')
    for j, h in enumerate(['Fila de tu planilla'] + COLS_MSA + EXTRA_B, start=1): ws.cell(hdr, j, h)
    cabecera(ws, hdr, [(1, 1 + len(COLS_MSA), GRIS), (2 + len(COLS_MSA), 3 + len(COLS_MSA), VERDE), (4 + len(COLS_MSA), 5 + len(COLS_MSA), AMARILLO), (6 + len(COLS_MSA), 6 + len(COLS_MSA), AZUL)])
    r = hdr
    for v in viejo:
        d = emp.tomar((fecha_iso(v[0]), txt(v[1]), r2(v[2]), r2(v[3]), txt(v[4])))
        r += 1
        if d is None:
            ws.cell(r, 1, '⚠ sin fila en la planilla'); ws.cell(r, 2, a_fecha(v[0])); ws.cell(r, 3, v[1]); ws.cell(r, 2 + iMSA['Débitos'], v[2]); ws.cell(r, 2 + iMSA['Créditos'], v[3]); continue
        p = prop.get(d['_fila'], (None, None, None, None))
        for j, val in enumerate([d['_fila']] + [d[h] for h in COLS_MSA] + [p[0], p[1], p[2], p[3], cargado.get(d['_fila'])], start=1):
            ws.cell(r, j, val)
    ult = r; total_b += len(viejo)
    cD, cC = L(2 + iMSA['Débitos']), L(2 + iMSA['Créditos'])
    ws.cell(ult + 2, 1, 'TOTAL movimientos').font = NEGRITA
    ws.cell(ult + 2, 2 + iMSA['Débitos'], f'=SUM({cD}{hdr + 1}:{cD}{ult})'); ws.cell(ult + 2, 2 + iMSA['Créditos'], f'=SUM({cC}{hdr + 1}:{cC}{ult})')
    if tot_cuadro and col_tot:
        ws.cell(ult + 3, 1, 'control: (débitos − créditos) − TOTAL del cuadro de arriba (tiene que dar 0)').font = NEGRITA
        ws.cell(ult + 3, 2 + iMSA['Débitos'], f'={cD}{ult + 2}-{cC}{ult + 2}-{L(col_tot)}{tot_cuadro}')
    formatear(ws, hdr + 1)
    for j in (2 + iMSA['Débitos'], 2 + iMSA['Créditos']):
        for rr in (ult + 2, ult + 3): ws.cell(rr, j).number_format = MONEDA
    ws.freeze_panes = ws.cell(hdr + 1, 2)
c0 = wb['00 Control']; fc = c0.max_row + 2
c0.cell(fc, 1, f'4 · v2 ({HOY}): cada movimiento con tu planilla completa').font = NEGRITA
c0.cell(fc + 1, 2, 'Movimientos en las solapas'); c0.cell(fc + 1, 3, total_b)
c0.cell(fc + 2, 2, 'Emparejados con su fila de la planilla'); c0.cell(fc + 2, 3, emp.ok)
c0.cell(fc + 3, 2, 'Sin fila (tiene que dar 0)'); c0.cell(fc + 3, 3, emp.mal)
c0.cell(fc + 4, 2, 'Filas de la planilla que no aparecen en ninguna solapa (tiene que dar 0)'); c0.cell(fc + 4, 3, emp.sin_usar())
SAL_B = DIR + 'Extracto_2025-07_a_2026-01_SEGMENTADO_v2_completo.xlsx'
wb.save(SAL_B); print(f'B · {SAL_B}\n    {total_b} movimientos · emparejados {emp.ok} (sin el detalle: {emp.flojo}) · sin fila {emp.mal} · planilla sin usar {emp.sin_usar()}')

# ═══════════ La planilla de PAM (CA y CC, columnas distintas → se unifican) ═══════════
wp = openpyxl.load_workbook(DIR + 'extractos PAM.xlsx', data_only=True)
RENOMBRE_CA = {'Movimiento': 'Descripción', 'Débito': 'Débitos', 'Crédito': 'Créditos', 'Categ': 'CATEG', 'Observaciones': 'Detalle'}
def leer_pam(hoja, fila_enc, cuenta, renombre):
    ws = wp[hoja]
    enc = [(j, renombre.get(str(c.value).strip(), str(c.value).strip())) for j, c in enumerate(ws[fila_enc]) if c.value is not None]
    out = []
    for i, row in enumerate(ws.iter_rows(min_row=fila_enc + 1, values_only=True), start=fila_enc + 1):
        f = row[enc[0][0]] if row else None
        if not (isinstance(f, datetime.datetime) or re.match(r'\d{1,2}/\d{1,2}/\d{4}', str(f or ''))): continue
        d = {h: row[j] for j, h in enc}; d['Fecha'] = a_fecha(d['Fecha']); d['_fila'] = i; d['_cuenta'] = cuenta; out.append(d)
    return out, [h for _, h in enc]
CA, encCA = leer_pam('Extracto PAM CA Pesos', 7, 'CA', RENOMBRE_CA)
CC, encCC = leer_pam('Extracto SUC PAM CC', 3, 'CC', {})
COLS_PAM = encCC + [h for h in encCA if h not in encCC]
print(f'Planilla PAM: CA {len(CA)} · CC {len(CC)} movimientos · {len(COLS_PAM)} columnas unificadas')
ETIQ = {'Detalle': 'Detalle (en CA: Observaciones)', 'Descripción': 'Descripción (en CA: Movimiento)', 'CATEG': 'CATEG (en CA: Categ)'}

def rehacer_pam(ws, clave_derivado, clave_planilla, propias):
    """Reemplaza la tabla de movimientos (encabezado en la fila 1) por: tu planilla completa + mis columnas."""
    h = [c.value for c in ws[1]]; col = {str(x): j for j, x in enumerate(h) if x}
    filas = [list(r) for r in ws.iter_rows(min_row=2, values_only=True) if r and r[0] in ('CA', 'CC')]
    emp = Emparejador(CA + CC, clave_planilla)
    mias = [x for x in h if x and x in propias]
    tuyas = [x for x in h if x and x not in propias and x not in ('Cuenta', 'Fecha', 'Descripción', 'Leyenda', 'Débitos', 'Créditos', 'Saldo', 'Su CATEG', 'Observaciones')]
    ws.delete_rows(1, ws.max_row)
    enc = ['Cuenta', 'Fila de tu planilla'] + [ETIQ.get(x, x) for x in COLS_PAM] + ['Propuesta: ' + x for x in mias] + ['JMS: ' + x for x in tuyas]
    ws.append(enc)
    n1 = 2 + len(COLS_PAM); n2 = n1 + len(mias)
    cabecera(ws, 1, [(1, n1, GRIS), (n1 + 1, n2, VERDE), (n2 + 1, n2 + len(tuyas), AMARILLO)])
    for v in filas:
        d = emp.tomar(clave_derivado(v, col))
        if d is None:
            ws.append([v[0], '⚠ sin fila en la planilla', a_fecha(v[col['Fecha']]), v[col['Descripción']]]); continue
        ws.append([d['_cuenta'], d['_fila']] + [d.get(x) for x in COLS_PAM] + [v[col[x]] for x in mias] + [v[col[x]] for x in tuyas])
    ult = ws.max_row
    iD, iC = 3 + COLS_PAM.index('Débitos'), 3 + COLS_PAM.index('Créditos')
    ws.append([]); ws.append(['TOTAL movimientos'])
    t = ws.max_row
    ws.cell(t, iD, f'=SUM({L(iD)}2:{L(iD)}{ult})'); ws.cell(t, iC, f'=SUM({L(iC)}2:{L(iC)}{ult})')
    ws.cell(t, 1).font = NEGRITA
    formatear(ws, 2)
    for j in (iD, iC): ws.cell(t, j).number_format = MONEDA
    ws.freeze_panes = 'C2'
    return emp, len(filas), t, L(iD), L(iC)

# ═══════════ C · PAM sugeridos v2 ═══════════
k_saldo = lambda d: (d['_cuenta'], fecha_iso(d['Fecha']), r2(d.get('Débitos')), r2(d.get('Créditos')), r2(d.get('Saldo')))
wc = openpyxl.load_workbook(DIR + 'Extractos_PAM_TEMPLATES_SUGERIDOS.xlsx')
PROPIAS_C = {'Template sugerido', 'Confianza', 'Cómo', '¿Cargar?', '¿En el período a llenar?'}
res_c = {}
for hoja in ('03 Movimientos', '04 Sin sugerencia (periodo)'):
    e, n, t, cD, cC = rehacer_pam(wc[hoja], lambda v, c: (v[0], fecha_iso(v[c['Fecha']]), r2(v[c['Débitos']]), r2(v[c['Créditos']]), r2(v[c['Saldo']])), k_saldo, PROPIAS_C)
    res_c[hoja] = (e, n, t, cD, cC); print(f'C · {hoja}: {n} mov. · emparejados {e.ok} (por fecha e importes: {e.flojo}) · sin fila {e.mal}')
c0 = wc['00 Control']; fc = c0.max_row + 2
c0.cell(fc, 1, f'v2 ({HOY}): cada movimiento con tu planilla completa').font = NEGRITA
e, n, t, cD, cC = res_c['03 Movimientos']
for k, (txt_, val) in enumerate([('  movimientos en «03 Movimientos»', n), ('  emparejados con su fila de la planilla', e.ok), ('  sin fila (tiene que dar 0)', e.mal),
                                 ('  filas de la planilla que no aparecen (tiene que dar 0)', e.sin_usar())], start=1):
    c0.cell(fc + k, 1, txt_); c0.cell(fc + k, 2, val)
c0.cell(fc + 6, 1, '  débitos de la planilla (CA + CC)'); c0.cell(fc + 6, 2, round(sum(r2(d.get('Débitos')) for d in CA + CC), 2))
c0.cell(fc + 7, 1, '  débitos de «03 Movimientos» (fórmula)'); c0.cell(fc + 7, 2, f"='03 Movimientos'!{cD}{t}")
c0.cell(fc + 8, 1, '  control débitos (tiene que dar 0)'); c0.cell(fc + 8, 2, f'=B{fc + 6}-B{fc + 7}')
c0.cell(fc + 9, 1, '  créditos de la planilla (CA + CC)'); c0.cell(fc + 9, 2, round(sum(r2(d.get('Créditos')) for d in CA + CC), 2))
c0.cell(fc + 10, 1, '  créditos de «03 Movimientos» (fórmula)'); c0.cell(fc + 10, 2, f"='03 Movimientos'!{cC}{t}")
c0.cell(fc + 11, 1, '  control créditos (tiene que dar 0)'); c0.cell(fc + 11, 2, f'=B{fc + 9}-B{fc + 10}')
for k in range(6, 12): c0.cell(fc + k, 2).number_format = MONEDA
SAL_C = DIR + 'Extractos_PAM_TEMPLATES_SUGERIDOS_v2_completo.xlsx'
wc.save(SAL_C); print('C ·', SAL_C)

# ═══════════ D · PAM → MSA v2 ═══════════
k_obs = lambda d: (d['_cuenta'], fecha_iso(d['Fecha']), r2(d.get('Débitos')), r2(d.get('Créditos')), txt(d.get('Detalle')))
wd = openpyxl.load_workbook(DIR + 'Extractos_PAM_jul25-ene26_TEMPLATES_DE_MSA.xlsx')
PROPIAS_D = {'Vínculo con MSA', 'Template de MSA', 'Confianza', 'Cómo'}
for hoja in ('01 Marcados para MSA', '03 Todos los movimientos'):
    e, n, t, cD, cC = rehacer_pam(wd[hoja], lambda v, c: (v[0], fecha_iso(v[c['Fecha']]), r2(v[c['Débitos']]), r2(v[c['Créditos']]), txt(v[c['Observaciones']])), k_obs, PROPIAS_D)
    print(f'D · {hoja}: {n} mov. · emparejados {e.ok} (sin la observación: {e.flojo}) · sin fila {e.mal}')
    if hoja == '03 Todos los movimientos': res_d = (e, n)
r0 = wd['00 Resumen']; fr = r0.max_row + 2
r0.cell(fr, 1, f'v2 ({HOY}): cada movimiento con tu planilla completa — emparejados {res_d[0].ok} de {res_d[1]}, sin fila {res_d[0].mal}').font = NEGRITA
SAL_D = DIR + 'Extractos_PAM_jul25-ene26_TEMPLATES_DE_MSA_v2_completo.xlsx'
wd.save(SAL_D); print('D ·', SAL_D)
