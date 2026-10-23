# A-DEC-1009 · Créditos Pagados (MSA) vuelve a UN solo template (usuario 2026-10-18: «corregí las campañas de acuerdo a
# lo que viste»). Motivo: es un template ABIERTO, y los abiertos no se renuevan — persisten entre años y la app los busca
# por tipo y activo, no por año (MANUAL-USO § generador de campaña). Partirlo en 25/26 (scripts historico_campanas_2025*)
# fue contra ese diseño. Se devuelven sus 12 cuotas al template original (sin campaña), el movimiento las sigue, y se
# borra la copia 25/26 creada ese mismo día — sólo si quedó vacía.
#   python scripts/historico_creditos_un_template.py [--aplicar]
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

ts = llamar('GET', 'egresos_sin_factura', {'select': '*', 'nombre_referencia': 'eq.Créditos Pagados', 'responsable': 'eq.MSA'})
orig = [t for t in ts if t['año'] is None]; copia = [t for t in ts if t['año'] == '25/26']
assert len(orig) == 1 and len(copia) == 1, [(t['año'], t['id']) for t in ts]
assert copia[0]['created_at'][:10] == '2026-10-18', 'la copia 25/26 no es la creada hoy: no sigo'
cs = llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,egreso_id,fecha_estimada,monto,estado', 'egreso_id': 'eq.' + copia[0]['id']})
movs = llamar('GET', 'msa_galicia', {'select': 'id,template_id,template_cuota_id', 'template_cuota_id': 'in.(' + ','.join(c['id'] for c in cs) + ')'})
print(f'{len(cs)} cuotas vuelven al template original (sin campaña) · {len(movs)} movimientos las siguen · se borra la copia 25/26 vacía')
if not APLICAR: print('SIMULACIÓN — no se escribió nada.'); sys.exit()
json.dump({'copia': copia[0], 'cuotas': cs, 'movimientos': movs}, open(DIR + 'Creditos un template - foto antes de aplicar.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
for c in cs:
    if len(llamar('PATCH', 'cuotas_egresos_sin_factura', {'id': 'eq.' + c['id'], 'egreso_id': 'eq.' + copia[0]['id']}, {'egreso_id': orig[0]['id']})) != 1:
        raise SystemExit(f'⛔ la cuota {c["id"]} no se movió; lo hecho está en la foto')
for m in movs: llamar('PATCH', 'msa_galicia', {'id': 'eq.' + m['id']}, {'template_id': orig[0]['id']})
quedan = llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id', 'egreso_id': 'eq.' + copia[0]['id']})
quedan_m = llamar('GET', 'msa_galicia', {'select': 'id', 'template_id': 'eq.' + copia[0]['id']})
if quedan or quedan_m: raise SystemExit(f'⛔ la copia todavía tiene {len(quedan)} cuotas / {len(quedan_m)} movimientos: no la borro')
llamar('DELETE', 'egresos_sin_factura', {'id': 'eq.' + copia[0]['id']})
# CONTROL
d = llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,egreso_id,monto,fecha_estimada,estado', 'id': 'in.(' + ','.join(c['id'] for c in cs) + ')'})
a = {c['id']: c for c in cs}
mal = [c for c in d if c['egreso_id'] != orig[0]['id'] or float(c['monto']) != float(a[c['id']]['monto']) or c['fecha_estimada'] != a[c['id']]['fecha_estimada'] or c['estado'] != a[c['id']]['estado']]
mv = llamar('GET', 'msa_galicia', {'select': 'id,template_id', 'id': 'in.(' + ','.join(m['id'] for m in movs) + ')'})
print(f'✅ CONTROL: {len(d) - len(mal)}/{len(d)} cuotas en el original sin cambios · movimientos en el original {sum(m["template_id"] == orig[0]["id"] for m in mv)}/{len(mv)} · copia borrada: {not llamar("GET", "egresos_sin_factura", {"select": "id", "id": "eq." + copia[0]["id"]})}')
