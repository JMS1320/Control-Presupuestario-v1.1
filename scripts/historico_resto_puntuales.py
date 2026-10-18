# A-DEC-1009 · Tres casos puntuales de la solapa «Resto» del histórico MSA, con OK del usuario (2026-10-18):
#   3 · Legalización del balance en el Consejo ($451.300, 15/12/2025): template NUEVO «Legalización Balance MSA»,
#       campaña 25/26, fijo, UNA cuota en el año, cuenta HONORARIOS VARIOS.
#   4 · Voyage 2026 anual ($439.827,26, 30/01/2026): la cuota «anterior» ya existía en $439.827,00 → se ajusta al banco
#       y se vincula.
#   5 · Venta de dólares (Rescate FIMA 04/08/2025, $45.431.590,72 + $0,29): template NUEVO «Compra / Venta de dólares»,
#       abierto, de doble sentido y FINANCIERO (no es ingreso ni gasto).
# Sin contable ni interno (A-DEC-1010). El DETALLE del usuario se respeta: el del movimiento no se toca y va también en
# la descripción de la cuota (usuario: «yo doy un detalle que ayuda a entender muchas veces, así que respetalo siempre»).
#   python scripts/historico_resto_puntuales.py [--aplicar]
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
uno = lambda tabla, **f: llamar('GET', tabla, {'select': '*', **{k: 'eq.' + v for k, v in f.items()}})

M_LEGAL, M_VOYAGE = '325ce029-cb73-41e3-9b01-76c94443eb07', '5aabe472-e098-4e90-b8b0-356533d6b58e'
M_USD = ['bd8db6d8-a8a0-40a2-88ef-0a7d9c936e4d', '5d0c79b8-fc62-4027-abe2-5e55276bb5a8']
movs = {m['id']: m for m in llamar('GET', 'msa_galicia', {'select': '*', 'id': 'in.(' + ','.join([M_LEGAL, M_VOYAGE] + M_USD) + ')'})}
assert len(movs) == 4 and all(m['estado'] == 'historico' for m in movs.values()), [(m['fecha'], m['estado']) for m in movs.values()]
voy_t = [t for t in uno('egresos_sin_factura', nombre_referencia='Imp Automotores Voyage Anual') if t['año'] == '2026']
assert len(voy_t) == 1
voy_c = [c for c in llamar('GET', 'cuotas_egresos_sin_factura', {'select': '*', 'egreso_id': 'eq.' + voy_t[0]['id'], 'estado': 'eq.anterior'})]
assert len(voy_c) == 1 and llamar('GET', 'msa_galicia', {'select': 'id', 'template_cuota_id': 'eq.' + voy_c[0]['id']}) == [], 'la cuota de la Voyage no está sola o ya tiene movimiento'
base_legal = [t for t in uno('egresos_sin_factura', nombre_referencia='IIBB Mensual MSA') if t['año'] == '25/26'][0]
base_usd = [t for t in uno('egresos_sin_factura', nombre_referencia='Plazo Fijo Banco Galicia') if t['responsable'] == 'MSA'][0]
for n in ('Legalización Balance MSA', 'Compra / Venta de dólares'):
    assert not uno('egresos_sin_factura', nombre_referencia=n), f'«{n}» ya existe'
ml, mv = movs[M_LEGAL], movs[M_VOYAGE]
print(f"3 · Legalización: template nuevo 25/26 (HONORARIOS VARIOS) + 1 cuota {ml['fecha']} ${ml['debitos']:,} → «{ml['detalle']}»")
print(f"4 · Voyage: cuota {voy_c[0]['fecha_estimada']} ${float(voy_c[0]['monto']):,} → ${mv['debitos']:,} y se vincula")
print(f"5 · Dólares: template nuevo abierto financiero de doble sentido + {len(M_USD)} cuotas de ingreso: " + ', '.join(f"${movs[i]['creditos']:,}" for i in M_USD))
if not APLICAR: print('SIMULACIÓN — no se escribió nada.'); sys.exit()

foto = {'movimientos': list(movs.values()), 'cuota_voyage': voy_c[0], 'templates_creados': [], 'cuotas_creadas': []}
guardar = lambda: json.dump(foto, open(DIR + 'Resto puntuales - foto antes de aplicar.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
guardar()
def copiar(base, cambios):
    c = {k: v for k, v in base.items() if k not in ('id', 'created_at', 'updated_at')}; c.update(cambios)
    t = llamar('POST', 'egresos_sin_factura', None, c)[0]; foto['templates_creados'].append(t['id']); guardar(); return t
def cuota_y_vinculo(t, m, tipo, desc, monto):
    c = llamar('POST', 'cuotas_egresos_sin_factura', None, {'egreso_id': t['id'], 'fecha_estimada': m['fecha'], 'fecha_vencimiento': m['fecha'],
        'monto': monto, 'estado': 'anterior', 'tipo_movimiento': tipo, 'descripcion': desc})[0]
    foto['cuotas_creadas'].append(c['id']); guardar(); vincular(m, t, c['id'])
def vincular(m, t, cuota_id):
    r = llamar('PATCH', 'msa_galicia', {'id': 'eq.' + m['id'], 'estado': 'eq.historico'},
               {'estado': 'conciliado', 'template_id': t['id'], 'template_cuota_id': cuota_id, 'categ': t['categ']})
    if len(r) != 1: raise SystemExit(f'⛔ el movimiento {m["id"]} no se actualizó; lo hecho está en la foto')

# 3 · Legalización
tl = copiar(base_legal, {'nombre_referencia': 'Legalización Balance MSA', 'categ': 'HONORARIOS VARIOS', 'tipo': 'egreso',
    'proveedor': 'Consejo Profesional de Ciencias Económicas', 'nombre_quien_cobra': 'Consejo Profesional de Ciencias Económicas',
    'cuit_quien_cobra': None, 'cuotas': 1, 'monto_por_cuota': float(ml['debitos']), 'fecha_primera_cuota': ml['fecha'],
    'completar_cuotas': None, 'grupo_impuesto_id': None, 'codigo_contable': None, 'codigo_interno': None, 'alertas': None,
    'cuenta_agrupadora': 'Honorarios', 'template_origen_id': None, 'observaciones_template': 'Una cuota por año (usuario 2026-10-18)'})
cuota_y_vinculo(tl, ml, 'egreso', f"Legalización Balance MSA — {ml['detalle']} — histórico", float(ml['debitos']))
# 4 · Voyage
llamar('PATCH', 'cuotas_egresos_sin_factura', {'id': 'eq.' + voy_c[0]['id']}, {'monto': float(mv['debitos'])})
vincular(mv, voy_t[0], voy_c[0]['id'])
# 5 · Dólares
tu = copiar(base_usd, {'nombre_referencia': 'Compra / Venta de dólares', 'categ': 'Compra / Venta de dólares', 'tipo': 'financiero',
    'tipo_template': 'abierto', 'es_bidireccional': True, 'cuenta_agrupadora': 'Inversiones', 'template_origen_id': None,
    'codigo_contable': None, 'codigo_interno': None, 'aplica_generacion': False})
for i in M_USD:
    m = movs[i]; cuota_y_vinculo(tu, m, 'ingreso', f"Compra / Venta de dólares — {m['detalle']} — histórico", float(m['creditos']))
print(f"✅ {len(foto['templates_creados'])} templates nuevos · {len(foto['cuotas_creadas'])} cuotas nuevas · Voyage ajustada y vinculada")

# CONTROL leído de la base
d = {m['id']: m for m in llamar('GET', 'msa_galicia', {'select': 'id,estado,template_id,template_cuota_id,detalle,contable,interno,debitos,creditos', 'id': 'in.(' + ','.join(movs) + ')'})}
ids_c = foto['cuotas_creadas'] + [voy_c[0]['id']]
cs = {c['id']: c for c in llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,monto,estado', 'id': 'in.(' + ','.join(ids_c) + ')'})}
mal = [i for i, m in d.items() if m['estado'] != 'conciliado' or m['template_cuota_id'] not in cs
       or abs(float(cs[m['template_cuota_id']]['monto']) - float(m['debitos'] or 0) - float(m['creditos'] or 0)) > 0.005]
det = [i for i, m in d.items() if m['detalle'] != movs[i]['detalle'] or (m['contable'] or '') != (movs[i]['contable'] or '') or (m['interno'] or '') != (movs[i]['interno'] or '')]
print(f'CONTROL: {len(d)} conciliados · {len(mal)} con cuota distinta al banco · {len(det)} con detalle o códigos tocados · cuotas «anterior»: {all(c["estado"] == "anterior" for c in cs.values())}')
