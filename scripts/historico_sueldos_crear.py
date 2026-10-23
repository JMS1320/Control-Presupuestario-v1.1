# A-DEC-1009 · Sueldos HISTÓRICOS jul-25 → ene-26 que no existen en la app (usuario 2026-10-18: «sueldos ok»).
#   · JMS y AMS (19 pagos, lote 3 «ok» del usuario): criterio (a) — el período del mes se arma CON LO PAGADO (el total
#     del período = la suma de sus pagos; no se inventa un cálculo).
#   · Manuel Martínez (5 pagos de «Resto»): empleado nuevo POR HORA y eventual (*«no es alguien mensual ni tendrá alta o
#     baja; a veces ayuda y se le pagan las horas»*); su período lleva horas, valor hora y gastos (varios) de su detalle.
# Período en estado «historico», campaña de sueldos 25/26. Pagos «anterior» (no van al Cash Flow), con el DETALLE del
# usuario entero en la descripción. El movimiento del banco se vincula a su pago, como lo hace la app (sueldo_pago_id).
# Sin contable ni interno (A-DEC-1010).
#   python scripts/historico_sueldos_crear.py [--aplicar]
import json, sys, re, urllib.request, urllib.parse, collections
import openpyxl

RAIZ = 'D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1/'
DIR = RAIZ + '- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude/'
APLICAR = '--aplicar' in sys.argv
env = {}
for l in open(RAIZ + '.env.local', encoding='utf-8'):
    if '=' in l and not l.startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
KEY = env['SUPABASE_SERVICE_ROLE_KEY']
def llamar(metodo, tabla, params=None, cuerpo=None, schema=None):
    url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1/' + tabla + ('?' + urllib.parse.urlencode(params, safe='(),.*:') if params else '')
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation'}
    if schema: h['Accept-Profile'] = schema; h['Content-Profile'] = schema
    data = json.dumps(cuerpo).encode() if cuerpo is not None else None
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, data=data, method=metodo, headers=h)).read() or '[]')
c2 = lambda x: round(x + 1e-9, 2)
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

# ── Lote 3: JMS / AMS ────────────────────────────────────────────────────────────────────────────────────────
ws = openpyxl.load_workbook(DIR + 'Lotes del historico MSA - para revisar v2.xlsx', read_only=True)['3 - socios por Sueldos']
items = []
for r in list(ws.iter_rows(values_only=True))[1:]:
    if not r[0] or 'Crear el pago histórico' not in (r[12] or '') or not (r[19] or '').lower().startswith('ok'): continue
    m = re.match(r'Sueldos · (JMS|AMS) · (\w+) (\d{4})', r[11]); assert m, r[11]
    items.append(dict(emp=m.group(1), anio=int(m.group(3)), mes=MESES.index(m.group(2)) + 1, id=r[21]))
assert len(items) == 19, len(items)
# ── Manuel: mes del trabajo y sus horas / gastos (de su detalle) ────────────────────────────────────────────
MANUEL = [  # id movimiento, mes trabajado, horas, gastos
    ('8fc26f5e-af5b-46c1-b5e6-9cb96b44ca42', (2025, 7), 22, 80000.0),     # 14/08: «22 horas x $20.543» + 80K — sin mes: julio
    ('1102fac9-27d1-4496-9590-e691796aad03', (2025, 9), 11, 35000.0),     # 20/10: «11 Horas + 35.000» — sin mes: septiembre
    ('49f77d0c-2906-42cb-8fde-35152f29b1a4', (2025, 10), 19, 20000.0),    # 05/11: «19 Horas Octubre + 20.000»
    ('388a3b9b-9995-428a-aa9e-d7cdcf1d579d', (2025, 11), 41, 98000.0),    # 28/11: «41 Horas Noviembre + 98.000»
    ('58a07476-17ba-4530-a0b3-e6f944a7b925', (2025, 12), 39, 108000.0)]   # 06/01: «39 Horas Diciembre + 108.000»
for mid, (a, me), h, g in MANUEL: items.append(dict(emp='MANUEL', anio=a, mes=me, id=mid, horas=h, gastos=g))

movs = {m['id']: m for m in llamar('GET', 'msa_galicia', {'select': 'id,fecha,debitos,detalle,estado,sueldo_pago_id', 'id': 'in.(' + ','.join(i['id'] for i in items) + ')'})}
assert len(movs) == 24 and all(m['estado'] == 'historico' and not m['sueldo_pago_id'] for m in movs.values()), 'algún movimiento ya no está histórico'
emps = {e['nombre']: e for e in llamar('GET', 'empleados', {'select': '*'}, schema='sueldos')}
assert 'Manuel Martínez' not in emps, 'Manuel ya existe'
camp = [c for c in llamar('GET', 'campanas', {'select': '*'}, schema='sueldos') if c['etiqueta'] == '25/26'][0]
existentes = {(p['empleado_id'], p['anio'], p['mes']) for p in llamar('GET', 'periodos', {'select': 'empleado_id,anio,mes', 'anio': 'eq.2025'}, schema='sueldos')}

periodos = collections.defaultdict(list)
for i in items:
    i['mov'] = movs[i['id']]; periodos[(i['emp'], i['anio'], i['mes'])].append(i)
print(f'{len(items)} pagos en {len(periodos)} períodos «historico» (campaña {camp["etiqueta"]}):')
for (e, a, me), its in sorted(periodos.items()):
    its.sort(key=lambda x: x['mov']['fecha'])
    for k, i in enumerate(its): i['tipo'] = 'sueldo' if k == len(its) - 1 else 'anticipo'
    eid = emps[e]['id'] if e != 'MANUEL' else None
    if eid and (eid, a, me) in existentes: raise SystemExit(f'⛔ ya existe el período {e} {me}/{a}')
    tot = c2(sum(float(i['mov']['debitos']) for i in its))
    extra = ''
    if e == 'MANUEL':
        i = its[0]; i['valor_hora'] = round((tot - i['gastos']) / i['horas'], 4)
        extra = f" · {i['horas']} h × ${i['valor_hora']:,.4f} + gastos ${i['gastos']:,.0f}"
    print(f"   {e:7s} {ABR[me-1]} {a}: {len(its)} pago(s) ${tot:>13,.2f}{extra}")
if not APLICAR: print('SIMULACIÓN — no se escribió nada.'); sys.exit()

foto = {'empleado_creado': None, 'periodos_creados': [], 'pagos_creados': [], 'movimientos': list(movs.values())}
guardar = lambda: json.dump(foto, open(DIR + 'Sueldos historicos - creados.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
guardar()
man = llamar('POST', 'empleados', None, {'nombre': 'Manuel Martínez', 'tipo_empleado': 'por_hora_ipc', 'empresa': 'MSA', 'activo': True,
    'francos_dias_promedio': 0, 'dias_promedio': 0, 'horas_promedio': 0, 'sueldo_presupuesto': None}, schema='sueldos')[0]
foto['empleado_creado'] = man['id']; guardar(); emps['MANUEL'] = man
import calendar
for (e, a, me), its in sorted(periodos.items()):
    tot = c2(sum(float(i['mov']['debitos']) for i in its))
    per = {'empleado_id': emps[e]['id'], 'campana_id': camp['id'], 'anio': a, 'mes': me,
           'fecha_inicio_periodo': f'{a}-{me:02d}-01', 'fecha_fin_periodo': f'{a}-{me:02d}-{calendar.monthrange(a, me)[1]:02d}',
           'bruto_calculado': tot, 'sueldo_x_ipc': 0, 'monto_a': tot, 'monto_b': 0, 'anticipos_descontados': tot, 'saldo_pendiente': 0,
           'varios': 0, 'estado': 'historico', 'observaciones': 'Histórico jul25-ene26: armado con lo pagado (extracto del banco)'}
    if e == 'MANUEL':
        i = its[0]; per.update({'horas_mes': i['horas'], 'valor_por_hora': i['valor_hora'], 'varios': i['gastos'],
                                'observaciones': 'Histórico: horas y gastos tomados del detalle del pago (por hora, eventual)'})
    p = llamar('POST', 'periodos', None, per, schema='sueldos')[0]; foto['periodos_creados'].append(p['id']); guardar()
    for i in its:
        etiqueta = ('Pago Saldo' if i['tipo'] == 'sueldo' else 'Anticipo') + f' {ABR[me-1]} {a}'
        pg = llamar('POST', 'pagos', None, {'periodo_id': p['id'], 'empleado_id': emps[e]['id'], 'tipo': i['tipo'], 'fecha': i['mov']['fecha'],
            'monto': float(i['mov']['debitos']), 'descripcion': f"{etiqueta} — {i['mov']['detalle']}", 'estado': 'anterior', 'medio_pago': 'banco',
            'visible_contable': False}, schema='sueldos')[0]
        foto['pagos_creados'].append(pg['id']); guardar()
        r = llamar('PATCH', 'msa_galicia', {'id': 'eq.' + i['id'], 'estado': 'eq.historico'}, {'estado': 'conciliado', 'sueldo_pago_id': pg['id'], 'categ': 'Sueldos'})
        if len(r) != 1: raise SystemExit(f'⛔ el movimiento {i["id"]} no se actualizó; lo hecho está en la foto')
# CONTROL leído de la base
pg = {x['id']: x for x in llamar('GET', 'pagos', {'select': '*', 'id': 'in.(' + ','.join(foto['pagos_creados']) + ')'}, schema='sueldos')}
pr = {x['id']: x for x in llamar('GET', 'periodos', {'select': '*', 'id': 'in.(' + ','.join(foto['periodos_creados']) + ')'}, schema='sueldos')}
mv = llamar('GET', 'msa_galicia', {'select': 'id,estado,sueldo_pago_id,debitos,detalle,contable,interno', 'id': 'in.(' + ','.join(movs) + ')'})
mal_mov = [m for m in mv if m['estado'] != 'conciliado' or m['sueldo_pago_id'] not in pg or abs(float(pg[m['sueldo_pago_id']]['monto']) - float(m['debitos'])) > 0.005]
toc = [m for m in mv if m['detalle'] != movs[m['id']]['detalle'] or m['contable'] or m['interno']]
mal_per = [p for p in pr.values() if abs(float(p['bruto_calculado']) - sum(float(x['monto']) for x in pg.values() if x['periodo_id'] == p['id'])) > 0.005]
man_ok = [p for p in pr.values() if p['empleado_id'] == man['id'] and abs(float(p['horas_mes']) * float(p['valor_por_hora']) + float(p['varios']) - float(p['bruto_calculado'])) > 0.5]  # el valor hora se guarda con 2 decimales
print(f'✅ CONTROL: {len(mv)} movimientos conciliados contra su pago ({len(mal_mov)} mal) · {len(toc)} con detalle/códigos tocados · '
      f'{len(pr)} períodos = suma de sus pagos ({len(mal_per)} mal) · Manuel horas×valor+gastos = total ({len(man_ok)} mal)')
