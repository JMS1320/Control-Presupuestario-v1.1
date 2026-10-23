# A-DEC-1009 · Segunda parte de la corrección de campañas (usuario 2026-10-18):
#   «expensas posadas también 2025, créditos pasalos a 25/26 hasta el 30/06/2026».
#   · Expensas Posadas: las 5 cuotas del lote 4 (jul–nov 2025) → template 2025 (copia del 2026, inactivo, sin generación).
#   · Créditos Pagados de MSA: las cuotas del template SIN campaña con fecha ≤ 30/06/2026 → el template 25/26 (ya creado).
#     Las de jul-26 en adelante (campaña 26/27) quedan donde están.
#   El movimiento del banco sigue a su cuota. No se tocan montos, fechas, estados ni códigos.
#   python scripts/historico_campanas_2025_b.py [--aplicar]
import json, sys, urllib.request, urllib.parse

RAIZ = 'D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1/'
DIR = RAIZ + '- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude/'
APLICAR = '--aplicar' in sys.argv
env = {}
for l in open(RAIZ + '.env.local', encoding='utf-8'):
    if '=' in l and not l.startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
KEY = env['SUPABASE_SERVICE_ROLE_KEY']
def llamar(metodo, tabla, params=None, cuerpo=None):
    url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1/' + tabla + ('?' + urllib.parse.urlencode(params, safe='(),.*:') if params else '')
    h = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation'}
    data = json.dumps(cuerpo).encode() if cuerpo is not None else None
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, data=data, method=metodo, headers=h)).read() or '[]')

ts = llamar('GET', 'egresos_sin_factura', {'select': '*', 'nombre_referencia': 'in.("Expensas Posadas","Créditos Pagados")'})
exp26 = [t for t in ts if t['nombre_referencia'] == 'Expensas Posadas' and t['año'] == '2026']
exp25 = [t for t in ts if t['nombre_referencia'] == 'Expensas Posadas' and t['año'] == '2025']
cred_sin = [t for t in ts if t['nombre_referencia'] == 'Créditos Pagados' and t['responsable'] == 'MSA' and t['año'] is None]
cred_2526 = [t for t in ts if t['nombre_referencia'] == 'Créditos Pagados' and t['año'] == '25/26']
assert len(exp26) == 1 and len(cred_sin) == 1 and len(cred_2526) == 1 and len(exp25) <= 1, ts
c_exp = llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,egreso_id,fecha_estimada,monto,estado', 'egreso_id': 'eq.' + exp26[0]['id'], 'descripcion': 'like.*histórico lote 4'})
c_cred = llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,egreso_id,fecha_estimada,monto,estado', 'egreso_id': 'eq.' + cred_sin[0]['id'], 'fecha_estimada': 'lte.2026-06-30'})
c_quedan = llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'fecha_estimada', 'egreso_id': 'eq.' + cred_sin[0]['id'], 'fecha_estimada': 'gt.2026-06-30'})
print(f'Expensas Posadas 2026 → 2025: {len(c_exp)} cuotas {[c["fecha_estimada"] for c in c_exp]}')
print(f'Créditos Pagados (sin campaña) → 25/26: {len(c_cred)} cuotas {[c["fecha_estimada"] for c in c_cred]}')
print(f'   quedan en el sin campaña (26/27): {[c["fecha_estimada"] for c in c_quedan]}')
if not APLICAR: print('SIMULACIÓN — no se escribió nada.'); sys.exit()

todas = c_exp + c_cred
foto = {'cuotas': todas, 'movimientos': llamar('GET', 'msa_galicia', {'select': 'id,template_id,template_cuota_id', 'template_cuota_id': 'in.(' + ','.join(c['id'] for c in todas) + ')'}), 'templates_creados': []}
json.dump(foto, open(DIR + 'Campañas 2025 b - foto antes de aplicar.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
if exp25: destino_exp = exp25[0]['id']
else:
    copia = {k: v for k, v in exp26[0].items() if k not in ('id', 'created_at', 'updated_at')}
    copia.update({'año': '2025', 'activo': False, 'aplica_generacion': False, 'template_origen_id': None})
    destino_exp = llamar('POST', 'egresos_sin_factura', None, copia)[0]['id']; foto['templates_creados'].append(destino_exp)
    json.dump(foto, open(DIR + 'Campañas 2025 b - foto antes de aplicar.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
for cs, origen, destino in ((c_exp, exp26[0]['id'], destino_exp), (c_cred, cred_sin[0]['id'], cred_2526[0]['id'])):
    for c in cs:
        if len(llamar('PATCH', 'cuotas_egresos_sin_factura', {'id': 'eq.' + c['id'], 'egreso_id': 'eq.' + origen}, {'egreso_id': destino})) != 1:
            raise SystemExit(f'⛔ la cuota {c["id"]} no se movió. Lo hecho está en la foto.')
    for m in foto['movimientos']:
        if m['template_cuota_id'] in {c['id'] for c in cs}:
            llamar('PATCH', 'msa_galicia', {'id': 'eq.' + m['id']}, {'template_id': destino})
# CONTROL
d = llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,egreso_id,monto,fecha_estimada,estado', 'id': 'in.(' + ','.join(c['id'] for c in todas) + ')'})
antes = {c['id']: c for c in todas}
ok_dest = sum(1 for c in d if c['egreso_id'] == (destino_exp if c['id'] in {x['id'] for x in c_exp} else cred_2526[0]['id']))
cambio = [c for c in d if float(c['monto']) != float(antes[c['id']]['monto']) or c['fecha_estimada'] != antes[c['id']]['fecha_estimada'] or c['estado'] != antes[c['id']]['estado']]
mv = llamar('GET', 'msa_galicia', {'select': 'id,template_id,template_cuota_id', 'id': 'in.(' + ','.join(m['id'] for m in foto['movimientos']) + ')'}) if foto['movimientos'] else []
mv_ok = sum(1 for m in mv if m['template_id'] == {c['id']: c['egreso_id'] for c in d}[m['template_cuota_id']])
print(f'✅ CONTROL: {ok_dest}/{len(d)} cuotas en su campaña · {len(cambio)} con monto/fecha/estado cambiado · movimientos que siguen a su cuota {mv_ok}/{len(mv)}')
