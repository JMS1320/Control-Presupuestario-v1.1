# A-DEC-1009 · Lotes 3 (los 3 ya cargados) y 3b del histórico MSA: vincular 8 movimientos del banco a pagos de Sueldos
# que YA existen (estado «anterior», sin movimiento). Con OK del usuario 2026-10-18: «sueldos: vinculá los cargados».
# Como lo hace la app: el movimiento pasa a «conciliado», guarda el pago en sueldo_pago_id y toma la cuenta «Sueldos».
# Sin contable ni interno (A-DEC-1010); el pago sigue «anterior» (histórico: no va al Cash Flow). El detalle no se toca.
#   python scripts/historico_sueldos_vincular.py [--aplicar]
import json, sys, urllib.request, urllib.parse

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

import openpyxl
wb = openpyxl.load_workbook(DIR + 'Lotes del historico MSA - para revisar v2.xlsx', read_only=True)
ids = []
for solapa in ('3 - socios por Sueldos', '3b - otros sueldos ya cargados'):
    for r in list(wb[solapa].iter_rows(values_only=True))[1:]:
        if r[0] and 'sólo vincular' in (r[12] or '') and (r[19] or '').lower().startswith('ok'): ids.append(r[21])
movs = llamar('GET', 'msa_galicia', {'select': 'id,fecha,debitos,detalle,estado,sueldo_pago_id', 'id': 'in.(' + ','.join(ids) + ')'})
assert len(movs) == 8 and all(m['estado'] == 'historico' and not m['sueldo_pago_id'] for m in movs), movs
emps = {e['id']: e['nombre'] for e in llamar('GET', 'empleados', {'select': 'id,nombre'}, schema='sueldos')}
pagos = [p for p in llamar('GET', 'pagos', {'select': '*', 'estado': 'eq.anterior'}, schema='sueldos')]
plan, usados = [], set()
for m in sorted(movs, key=lambda x: (x['fecha'], -float(x['debitos']))):
    c = [p for p in pagos if p['fecha'] == m['fecha'] and abs(float(p['monto']) - float(m['debitos'])) < 0.005 and p['id'] not in usados]
    if len(c) != 1: raise SystemExit(f'⛔ {m["fecha"]} ${m["debitos"]}: {len(c)} pagos candidatos — no sigo')
    usados.add(c[0]['id']); plan.append((m, c[0]))
for m, p in plan: print(f"   {m['fecha']} ${float(m['debitos']):>14,.2f} → {emps[p['empleado_id']]:16s} {p['tipo']:9s} «{p['descripcion']}» · tu detalle: {m['detalle']}")
if not APLICAR: print('SIMULACIÓN — no se escribió nada.'); sys.exit()
json.dump({'movimientos': movs}, open(DIR + 'Sueldos vincular - foto antes de aplicar.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
for m, p in plan:
    r = llamar('PATCH', 'msa_galicia', {'id': 'eq.' + m['id'], 'estado': 'eq.historico'}, {'estado': 'conciliado', 'sueldo_pago_id': p['id'], 'categ': 'Sueldos'})
    if len(r) != 1: raise SystemExit(f'⛔ el movimiento {m["id"]} no se actualizó')
d = llamar('GET', 'msa_galicia', {'select': 'id,estado,sueldo_pago_id,detalle,contable,interno,debitos', 'id': 'in.(' + ','.join(ids) + ')'})
pm = {p['id']: p for p in pagos}; antes = {m['id']: m for m in movs}
mal = [x for x in d if x['estado'] != 'conciliado' or abs(float(pm[x['sueldo_pago_id']]['monto']) - float(x['debitos'])) > 0.005]
toc = [x for x in d if x['detalle'] != antes[x['id']]['detalle'] or x['contable'] or x['interno']]
print(f'✅ CONTROL: {len(d)} conciliados contra su pago · {len(mal)} con importe distinto · {len(toc)} con detalle o códigos tocados')
