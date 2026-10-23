# A-DEC-1009 · Impuestos 2025 de MSA pagados por PAGO ANUAL antes del extracto de la app (que arranca jul-25).
# Datos del usuario 2026-10-18 (y su Excel base «Extracto MSA - Control Presupuestario.xlsx»):
#   · Inmobiliario MSA 2025: pago anual $6.308.119,50 el 21/04/2025 (10 partidas); el balance 24/25 tomó $3.154.059,75.
#   · Inmobiliario Complementario MSA (San Manuel) 2025: $3.038.109,60 el 15/04/2025; tomado en 24/25 $1.519.054,80.
#   · Red Vial Rojas 2025: $4.070.152,50 el 06/01/2025; tomado en 24/25 $1.628.061.
# «Las 4 cuotas de siempre se pagaron vía pago anual en la primera»: se cargan LAS CUOTAS del año en su template 2025
# (fecha = su vencimiento, fecha_pago = la del pago anual), así cada ejercicio toma las que vencen en él. Lo que vence
# hasta el 30/06/2025 tiene que dar exactamente lo que se tomó en el balance 24/25 — es el CONTROL.
# Sin movimiento del banco (el pago es anterior al extracto de la app). Sin contable ni interno.
#   python scripts/historico_impuestos_anuales_2025.py [--aplicar]
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
c2 = lambda x: round(x + 1e-9, 2)

# Vencimientos 2025: el mismo día y mes que los de 2026 en la app (el de 2025 exacto no está cargado).
V_INMO = ['2025-03-17', '2025-06-11', '2025-09-08', '2025-11-05']
V_RV_ROJAS = ['2025-02-23', '2025-05-26', '2025-09-05', '2025-10-05', '2025-12-05']
# Inmobiliario 21/04/2025 — su detalle «Inmobiliario Anual X» → la partida de la app.
# Tango 1 y Tango 3 pagaron lo mismo, igual que Parra 1 y Prim Leboso en 2026: se asignan en orden. La Criolla = Rojas
# (única partida de MSA que queda sin pareja, y la grande en los dos años).
INMO = [('Tango 1', 'Tango Parra 1', 61919.80), ('Tango 2', 'Tango Parra 2', 113212.60), ('Tango 3', 'Tango Prim Leboso', 61919.80),
        ('Sanchez', 'Sanchez', 98694.90), ('Porteria Viejo', 'Porteria Viejo', 95991.80), ('Porteria Nuevo', 'Porteria Nuevo', 95992.10),
        ('Anexo', 'Anexo', 115219.30), ('La Criolla', 'Rojas', 5597075.60), ('Cholo 1', 'Cholo 1', 34217.90), ('Cholo 2', 'Cholo 2', 33875.70)]
assert c2(sum(x[2] for x in INMO)) == 6308119.50
PLAN = [dict(nombre=f'Inmobiliario Cuota {app}', anual=m, pago='2025-04-21', venc=V_INMO, grupo='inmobiliario',
             detalle=f'Inmobiliario Anual {suyo}') for suyo, app, m in INMO]
PLAN.append(dict(nombre='Inmobiliario Complementario Cuota MSA', anual=3038109.60, pago='2025-04-15', venc=V_INMO, grupo='complementario',
                 detalle='INMOBILIARIO COMP SAN MANUEL - PAGO ANUAL'))
PLAN.append(dict(nombre='Red Vial Cuota Rojas', anual=4070152.50, pago='2025-01-06', venc=V_RV_ROJAS, grupo='red vial Rojas',
                 detalle='Red Vial Rojas Anual'))
TOMADO_2425 = {'inmobiliario': 3154059.75, 'complementario': 1519054.80, 'red vial Rojas': 1628061.00}

def repartir(anual, venc):
    """Cuotas iguales, y el redondeo se absorbe DENTRO de cada ejercicio para que la parte 24/25 sea exacta."""
    n = len(venc); q = c2(anual / n); cs = [q] * n
    antes = [i for i, v in enumerate(venc) if v <= '2025-06-30']; desp = [i for i in range(n) if i not in antes]
    parte_antes = c2(anual * len(antes) / n)
    cs[antes[-1]] = c2(parte_antes - q * (len(antes) - 1)); cs[desp[-1]] = c2(anual - parte_antes - q * (len(desp) - 1))
    return cs

todos = llamar('GET', 'egresos_sin_factura', {'select': '*', 'nombre_referencia': 'in.(' + ','.join('"' + p['nombre'] + '"' for p in PLAN) + ')'})
for p in PLAN:
    t25 = [t for t in todos if t['nombre_referencia'] == p['nombre'] and t['año'] == '2025']
    t26 = [t for t in todos if t['nombre_referencia'] == p['nombre'] and t['año'] == '2026']
    assert len(t26) == 1 and len(t25) <= 1, (p['nombre'], len(t25), len(t26))
    p['t25'] = t25[0] if t25 else None; p['t26'] = t26[0]; p['cuotas'] = repartir(p['anual'], p['venc'])
    if p['t25']:
        ya = llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,descripcion', 'egreso_id': 'eq.' + p['t25']['id'], 'descripcion': 'like.*pago anual*'})
        assert not ya, f"{p['nombre']} 2025 ya tiene cuotas del pago anual: no sigo"
for g, tomado in TOMADO_2425.items():
    ps = [p for p in PLAN if p['grupo'] == g]
    antes = c2(sum(c for p in ps for c, v in zip(p['cuotas'], p['venc']) if v <= '2025-06-30'))
    total = c2(sum(p['anual'] for p in ps))
    print(f'{g:16s} anual {total:>15,.2f} · vence ≤30/06/2025 {antes:>14,.2f} vs tomado en 24/25 {tomado:>14,.2f} → dif {c2(antes - tomado)} · queda para 25/26 {c2(total - antes):,.2f}')
    if abs(antes - tomado) > 0.005: raise SystemExit('⛔ la parte 24/25 no da lo tomado en el balance: no sigo')
for p in PLAN:
    print(f"   {p['nombre']:40s} {'usa 2025' if p['t25'] else 'crea 2025'} · {len(p['cuotas'])} cuotas {p['cuotas']} · pago {p['pago']}")
if not APLICAR: print('SIMULACIÓN — no se escribió nada.'); sys.exit()

foto = {'templates_creados': [], 'cuotas_creadas': []}
guardar = lambda: json.dump(foto, open(DIR + 'Impuestos anuales 2025 - creados.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
for p in PLAN:
    if not p['t25']:
        c = {k: v for k, v in p['t26'].items() if k not in ('id', 'created_at', 'updated_at')}
        c.update({'año': '2025', 'activo': False, 'aplica_generacion': False, 'template_origen_id': None, 'fecha_primera_cuota': p['venc'][0]})
        p['t25'] = llamar('POST', 'egresos_sin_factura', None, c)[0]; foto['templates_creados'].append(p['t25']['id']); guardar()
    n = len(p['cuotas']); pago = p['pago'][8:10] + '/' + p['pago'][5:7] + '/' + p['pago'][:4]
    for k, (monto, v) in enumerate(zip(p['cuotas'], p['venc']), 1):
        cu = llamar('POST', 'cuotas_egresos_sin_factura', None, {'egreso_id': p['t25']['id'], 'numero_cuota': k, 'fecha_estimada': v,
            'fecha_vencimiento': v, 'fecha_pago': p['pago'], 'monto': monto, 'estado': 'anterior', 'tipo_movimiento': 'egreso',
            'descripcion': f"Cuota {k}/{n} 2025 — pagada con el pago anual del {pago} («{p['detalle']}») — histórico"})[0]
        foto['cuotas_creadas'].append(cu['id']); guardar()
# CONTROL leído de la base
cs = llamar('GET', 'cuotas_egresos_sin_factura', {'select': 'id,egreso_id,monto,fecha_estimada,estado', 'id': 'in.(' + ','.join(foto['cuotas_creadas']) + ')'})
g_de = {p['t25']['id']: p['grupo'] for p in PLAN}
for g, tomado in TOMADO_2425.items():
    a = c2(sum(float(c['monto']) for c in cs if g_de[c['egreso_id']] == g and c['fecha_estimada'] <= '2025-06-30'))
    t = c2(sum(float(c['monto']) for c in cs if g_de[c['egreso_id']] == g))
    print(f'✅ CONTROL {g}: total {t:,.2f} · 24/25 {a:,.2f} (tomado {tomado:,.2f}, dif {c2(a - tomado)}) · 25/26 {c2(t - a):,.2f}')
print(f'   {len(foto["templates_creados"])} templates 2025 creados · {len(cs)} cuotas, todas «anterior»: {all(c["estado"] == "anterior" for c in cs)}')
