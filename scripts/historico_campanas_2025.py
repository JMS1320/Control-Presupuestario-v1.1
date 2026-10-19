# A-DEC-1009/1010 · Corrige la CAMPAÑA de lo cargado en el lote 4 del histórico (usuario 2026-10-18):
#   «cred P 25/26 · expensas libertad y aysa 2025 · ABL posadas · autonomos · amarok · voyage · inmobiliarios todos ·
#    red vial todos — esos son todos de 2025».
# Motivo: un template es un concepto EN UNA CAMPAÑA; el Red Vial 2026 tiene que sumar el de 2026, y la renovación de
# campaña y el presupuesto parten del template de la campaña anterior.
#
# Qué hace (sólo con las cuotas del LOTE 4, que son todas obligaciones de 2025 — o del ejercicio 25/26 en CRED P):
#   · crea el template de la campaña correcta como COPIA del vigente (inactivo, sin generación, sin template_origen)
#     — o lo reusa si ya existe —; la Amarok, que se creó hoy, sólo cambia de campaña;
#   · mueve sus cuotas al template nuevo, y el movimiento del banco (template_id) con ellas;
#   · NO toca códigos, montos, fechas, estados ni los grupos de pago.
#
#   python scripts/historico_campanas_2025.py            → SIMULA
#   python scripts/historico_campanas_2025.py --aplicar  → escribe, foto antes y control después
import json, sys, urllib.request, urllib.parse, collections

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

def campania(t):
    n = t['nombre_referencia']
    if n == 'Créditos Pagados': return '25/26'
    if n in ('Expensas Libertad', 'AYSA Libertad', 'ABL Cochera Posadas Cuota', 'Autonomos MA', 'Imp Automotores Amarok Cuota',
             'Imp Automotores Voyage Cuota') or n.startswith('Inmobiliario') or n.startswith('Red Vial'):
        return '2025'
    return None      # Expensas Posadas y lo demás: no está en la lista del usuario → no se toca

cuotas = llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,egreso_id,fecha_estimada,monto,descripcion', 'descripcion': 'like.*histórico lote 4'})
tpl = {t['id']: t for t in llamar('GET', 'egresos_sin_factura', {'select': '*', 'id': 'in.(' + ','.join({c['egreso_id'] for c in cuotas}) + ')'})}
plan = collections.defaultdict(list)
for c in cuotas:
    t = tpl[c['egreso_id']]; destino = campania(t)
    if destino and t['año'] != destino: plan[t['id']].append(c)
todos = llamar('GET', 'egresos_sin_factura', {'select': 'id,nombre_referencia,año,responsable'})
def ya_existe(t, destino):
    m = [x for x in todos if x['nombre_referencia'] == t['nombre_referencia'] and x['año'] == destino and x['responsable'] == t['responsable']]
    return m[0]['id'] if m else None

print(f'{sum(len(v) for v in plan.values())} cuotas del lote 4 cambian de campaña, en {len(plan)} templates:')
for tid, cs in sorted(plan.items(), key=lambda kv: tpl[kv[0]]['nombre_referencia']):
    t = tpl[tid]; destino = campania(t)
    accion = 'cambia la campaña del template (creado hoy)' if t['nombre_referencia'] == 'Imp Automotores Amarok Cuota' else \
             ('reusa el template ' + destino) if ya_existe(t, destino) else 'crea el template ' + destino
    print(f"   {t['nombre_referencia']:40s} [{t['año']}] → {destino}: {len(cs)} cuota(s) · {accion}")
quedan = [(tpl[c['egreso_id']]['nombre_referencia'], c['fecha_estimada']) for c in cuotas if not campania(tpl[c['egreso_id']])]
print(f'   no se tocan: {collections.Counter(n for n, _ in quedan)}')
if not APLICAR: print('SIMULACIÓN — no se escribió nada. Para aplicar: --aplicar'); sys.exit()

# ══ APLICAR ══════════════════════════════════════════════════════════════════════════════════════════════════
ids_c = [c['id'] for cs in plan.values() for c in cs]
movs = llamar('GET', 'msa_galicia', {'select': 'id,template_id,template_cuota_id', 'template_id': 'in.(' + ','.join(plan) + ')', 'fecha': 'lt.2026-02-01'})
foto = {'cuotas': [dict(c) for cs in plan.values() for c in cs], 'templates': [tpl[t] for t in plan], 'movimientos': movs, 'templates_creados': []}
json.dump(foto, open(DIR + 'Campañas 2025 - foto antes de aplicar.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
nuevo_de = {}
for tid in plan:
    t = tpl[tid]; destino = campania(t)
    if t['nombre_referencia'] == 'Imp Automotores Amarok Cuota':
        llamar('PATCH', 'egresos_sin_factura', {'id': 'eq.' + tid}, {'año': destino, 'aplica_generacion': False, 'activo': False})
        continue
    existe = ya_existe(t, destino)
    if existe: nuevo_de[tid] = existe; continue
    copia = {k: v for k, v in t.items() if k not in ('id', 'created_at', 'updated_at')}
    copia.update({'año': destino, 'activo': False, 'aplica_generacion': False, 'template_origen_id': None})
    n = llamar('POST', 'egresos_sin_factura', None, copia)[0]
    nuevo_de[tid] = n['id']; foto['templates_creados'].append(n['id'])
    json.dump(foto, open(DIR + 'Campañas 2025 - foto antes de aplicar.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
cuota_a_tpl = {}
for tid, cs in plan.items():
    if tid not in nuevo_de: continue
    for c in cs:
        r = llamar('PATCH', 'cuotas_egresos_sin_factura', {'id': 'eq.' + c['id'], 'egreso_id': 'eq.' + tid}, {'egreso_id': nuevo_de[tid]})
        if len(r) != 1: raise SystemExit(f'⛔ la cuota {c["id"]} no se movió. Lo hecho está en la foto.')
        cuota_a_tpl[c['id']] = nuevo_de[tid]
# el movimiento sigue a su cuota (o a la primera partida de su grupo de pago)
grupos = {}
for c in llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,egreso_id,grupo_pago_id', 'id': 'in.(' + ','.join(ids_c) + ')'}):
    if c['grupo_pago_id']: grupos.setdefault(c['grupo_pago_id'], c['egreso_id'])
for m in movs:
    nuevo = cuota_a_tpl.get(m['template_cuota_id']) or grupos.get(m['template_cuota_id']) or nuevo_de.get(m['template_id'])
    if nuevo and nuevo != m['template_id']:
        llamar('PATCH', 'msa_galicia', {'id': 'eq.' + m['id']}, {'template_id': nuevo})
print(f'✅ {len(foto["templates_creados"])} templates creados · {len(cuota_a_tpl)} cuotas movidas · Amarok → 2025')

# ── CONTROL leído de la base ─────────────────────────────────────────────────────────────────────────────────
desp = {c['id']: c for c in llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,egreso_id,monto,estado,fecha_estimada', 'id': 'in.(' + ','.join(ids_c) + ')'})}
camp = {t['id']: t['año'] for t in llamar('GET', 'egresos_sin_factura', {'select': 'id,año', 'id': 'in.(' + ','.join({c['egreso_id'] for c in desp.values()}) + ')'})}
antes = {c['id']: c for cs in plan.values() for c in cs}
mal_camp = [i for i, c in desp.items() if camp[c['egreso_id']] != campania(tpl[antes[i]['egreso_id']])]
cambio = [i for i, c in desp.items() if float(c['monto']) != float(antes[i]['monto']) or c['fecha_estimada'] != antes[i]['fecha_estimada'] or c['estado'] != 'anterior']
mv = llamar('GET', 'msa_galicia', {'select': 'id,template_id', 'id': 'in.(' + ','.join(m['id'] for m in movs) + ')'})
mv_mal = [m['id'] for m in mv if camp.get(m['template_id']) is None and m['template_id'] in plan]
print(f'CONTROL: {len(desp)} cuotas · {len(mal_camp)} en campaña equivocada · {len(cambio)} con monto/fecha/estado cambiado · {len(mv_mal)} movimientos apuntando al template viejo')
