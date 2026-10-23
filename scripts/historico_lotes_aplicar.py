# A-DEC-1009 · Aplicar los lotes 2 / 4 / 3b del extracto histórico MSA (jul-25 → ene-26).
#
# Decisión del usuario 2026-10-18: se carga SÓLO template + cuota, SIN contable ni interno (van en una tanda aparte,
# por template + período; los códigos de su planilla siguen en la nota del movimiento).
# Criterio de campaña: igual que el lote 1 — los templates vigentes; la revisión de campañas va con la tanda de códigos.
#
#   python scripts/historico_lotes_aplicar.py 2            → SIMULA (sólo lee) y muestra el plan
#   python scripts/historico_lotes_aplicar.py 2 --aplicar  → escribe (con OK del usuario), foto antes y control después
#
# Cada movimiento: una cuota «anterior» propia (fecha e importe del movimiento) en su template, y el movimiento pasa a
# «conciliado» con la cuenta del template. Red Vial: un movimiento → una cuota por partida (su detalle), y el control
# exige que las partidas sumen el débito del banco.
import json, sys, urllib.request, urllib.parse, collections
import openpyxl

RAIZ = 'D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1/'
DIR = RAIZ + '- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude/'
EXCEL = DIR + 'Lotes del historico MSA - para revisar v2.xlsx'
LOTE = sys.argv[1]
APLICAR = '--aplicar' in sys.argv
SOLAPA = {'2': '2 - retiros y aportes', '4': '4 - lo aprobado a templates'}[LOTE]   # 3 y 3b son de Sueldos: otro script

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
leer = lambda tabla, params: llamar('GET', tabla, params)
r2 = lambda x: round(float(x) + 1e-9, 2)

# ── Templates nuevos (aprobados 2026-10-18): copia de uno existente, para que la creación sea consistente ──────
NUEVOS = {
    'Aporte PAM': ('Retiro PAM', {'categ': 'Aporte PAM'}),
    'Imp Automotores Amarok Cuota': ('Imp Automotores Voyage Cuota',
        {'proveedor': 'ARBA', 'nombre_quien_cobra': 'ARBA', 'cuit_quien_cobra': None, 'centro_costo': 'Amarok',
         'grupo_impuesto_id': 'Imp Automotores Amarok', 'cuotas': 5, 'fecha_primera_cuota': None, 'monto_por_cuota': None}),
}
NO_COPIAR = {'id', 'created_at', 'updated_at'}

# ── El lote, leído de SU Excel (decisión «ok») ───────────────────────────────────────────────────────────────
ws = openpyxl.load_workbook(EXCEL)[SOLAPA]
filas, ultimo = [], None
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[0] is None: continue
    f = dict(fecha=r[2], deb=r[4], cre=r[5], detalle=r[8], destino=r[11], hace=r[12] or '', aviso=r[18] or '',
             decision=(r[19] or '').strip().lower(), nota=r[20] or '', id=r[21])
    if '↳' in f['hace']:                       # partida de la misma operación (Red Vial)
        f['id'] = ultimo['id']; f['deb'] = None
    else:
        ultimo = f
    filas.append(f)
no_ok = [f for f in filas if not f['decision'].startswith('ok')]
if no_ok: raise SystemExit(f'⛔ hay {len(no_ok)} filas sin «ok» en la solapa: no sigo. {no_ok[:2]}')

def importe_partida(f):
    # «Partida Tango Parra 1: $28.162,64» → 28162.64
    t = f['aviso'].split('$')[-1].strip()
    return r2(t.replace('.', '').replace(',', '.'))

ids = sorted({f['id'] for f in filas})
movs = {}
for d in range(0, len(ids), 100):
    for m in leer('msa_galicia', {'select': '*', 'id': 'in.(' + ','.join(ids[d:d + 100]) + ')'}): movs[m['id']] = m
faltan = [i for i in ids if i not in movs]
if faltan: raise SystemExit(f'⛔ {len(faltan)} movimientos del Excel no están en la base: {faltan[:3]}')
no_hist = [m for m in movs.values() if m['estado'] != 'historico']
if no_hist: raise SystemExit(f'⛔ {len(no_hist)} movimientos ya no están «historico» (¿ya se aplicó?): no sigo.')

nombres = sorted({f['destino'].replace(' (template NUEVO)', '') for f in filas} | {base for base, _ in NUEVOS.values()})
tpl_rows = leer('egresos_sin_factura', {'select': '*', 'nombre_referencia': 'in.(' + ','.join('"' + n + '"' for n in nombres) + ')'})
por_nombre = collections.defaultdict(list)
for t in tpl_rows: por_nombre[t['nombre_referencia']].append(t)
def template(nombre):
    ts = por_nombre.get(nombre, [])
    if nombre == 'Créditos Pagados': ts = [t for t in ts if t['responsable'] == 'MSA']   # usuario 18/10: los de MSA
    if len(ts) > 1: raise SystemExit(f'⛔ «{nombre}» existe {len(ts)} veces: hay que elegir. {[(t["año"], t["responsable"]) for t in ts]}')
    return ts[0] if ts else None

# ── El plan ──────────────────────────────────────────────────────────────────────────────────────────────────
plan = []   # (movimiento, template, monto, tipo_movimiento, descripcion)
for f in filas:
    m = movs[f['id']]; nombre = f['destino'].replace(' (template NUEVO)', '')
    t = template(nombre)
    if t is None and nombre not in NUEVOS: raise SystemExit(f'⛔ no existe el template «{nombre}»')
    ingreso = r2(m['creditos'] or 0) > 0
    if f['aviso'].startswith('Partida'):
        monto = importe_partida(f)
    else:
        monto = r2(m['creditos'] if ingreso else m['debitos'])
    desc = f"{nombre} — {f['detalle'] or m['descripcion']}"
    if 'Cuota Adicional 2025' in f['nota']: desc += ' — Cuota Adicional 2025'
    if 'cuota agrupada 11 y 12' in f['nota']: desc = f'{nombre} — Cuotas 11 y 12 de 2025 (agrupadas, pagadas el 30/01/2026)'
    plan.append(dict(mov=m, nombre=nombre, t=t, monto=monto, tipo='ingreso' if ingreso else 'egreso', desc=desc + f' — histórico lote {LOTE}'))

# Control: por movimiento, la suma de sus cuotas = su importe en el banco (las partidas de Red Vial)
por_mov = collections.defaultdict(float)
for p in plan: por_mov[p['mov']['id']] += p['monto']
for mid, s in por_mov.items():
    m = movs[mid]; banco = r2((m['creditos'] or 0) or (m['debitos'] or 0))
    if abs(r2(s) - banco) > 0.005: raise SystemExit(f'⛔ el movimiento {m["fecha"]} {banco} no cierra contra sus cuotas ({r2(s)})')

print(f'LOTE {LOTE} — {len(plan)} cuotas para {len(por_mov)} movimientos · débitos {r2(sum(p["monto"] for p in plan if p["tipo"]=="egreso")):,.2f} · créditos {r2(sum(p["monto"] for p in plan if p["tipo"]=="ingreso")):,.2f}')
for n, c in collections.Counter(p['nombre'] + ('  (NUEVO)' if p['t'] is None else f"  [{p['t']['año']}]") for p in plan).items(): print(f'   {c:3d} → {n}')
print('   ✓ cada movimiento cierra contra sus cuotas')
if not APLICAR:
    print('SIMULACIÓN — no se escribió nada. Para aplicar: --aplicar'); sys.exit()

# ══ APLICAR ══════════════════════════════════════════════════════════════════════════════════════════════════
foto = {'movimientos': list(movs.values()), 'templates_creados': [], 'cuotas_creadas': [], 'grupos_creados': []}
json.dump(foto, open(DIR + f'Lote {LOTE} - foto antes de aplicar.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
for p in plan:
    if p['t'] is None:
        base, cambios = NUEVOS[p['nombre']]
        if template(p['nombre']) is None:
            b = template(base)
            nuevo = {k: v for k, v in b.items() if k not in NO_COPIAR}
            nuevo.update(cambios); nuevo['nombre_referencia'] = p['nombre']
            creado = llamar('POST', 'egresos_sin_factura', None, nuevo)[0]
            por_nombre[p['nombre']] = [creado]; foto['templates_creados'].append(creado['id'])
            print('   + template', p['nombre'], creado['id'])
        p['t'] = template(p['nombre'])
vinc = collections.defaultdict(list)
# Un movimiento con varias cuotas (Red Vial por partida) = un GRUPO DE PAGO, como lo hace la app: el movimiento guarda el
# grupo en template_cuota_id y cada partida es una cuota del grupo (ARQUITECTURA-BD § template_cuota_id).
cuenta = collections.Counter(p['mov']['id'] for p in plan); grupo_de = {}
for mid, n in cuenta.items():
    if n > 1:
        m = movs[mid]
        g = llamar('POST', 'grupos_pago', None, {'cuit': '30669239765', 'proveedor': 'Municipalidad SP', 'monto_total': r2(m['debitos']),
                   'estado': 'conciliado', 'observaciones': f"Histórico lote {LOTE}: {m['detalle'] or m['descripcion']} — una cuota por partida"}, schema='msa')[0]
        grupo_de[mid] = g['id']; foto['grupos_creados'].append(g['id'])
for p in plan:
    fe = p['mov']['fecha']
    c = llamar('POST', 'cuotas_egresos_sin_factura', None, {
        'egreso_id': p['t']['id'], 'fecha_estimada': fe, 'fecha_vencimiento': fe, 'monto': p['monto'], 'estado': 'anterior',
        'tipo_movimiento': p['tipo'], 'descripcion': p['desc'], 'grupo_pago_id': grupo_de.get(p['mov']['id'])})[0]
    foto['cuotas_creadas'].append(c['id']); vinc[p['mov']['id']].append((c['id'], p['t']))
    json.dump(foto, open(DIR + f'Lote {LOTE} - foto antes de aplicar.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
for mid, cs in vinc.items():
    cuota_id, t = cs[0]
    if mid in grupo_de: cuota_id = grupo_de[mid]     # pago agrupado: el vínculo es el grupo
    r = llamar('PATCH', 'msa_galicia', {'id': 'eq.' + mid, 'estado': 'eq.historico'},
               {'estado': 'conciliado', 'template_id': t['id'], 'template_cuota_id': cuota_id, 'categ': t['categ']})
    if len(r) != 1: raise SystemExit(f'⛔ el movimiento {mid} no se actualizó. Lo hecho está en la foto.')
print(f'✅ lote {LOTE}: {len(foto["templates_creados"])} templates nuevos · {len(foto["grupos_creados"])} grupos de pago · {len(foto["cuotas_creadas"])} cuotas · {len(vinc)} movimientos conciliados')
json.dump(foto, open(DIR + f'Lote {LOTE} - foto antes de aplicar.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)

# ── CONTROL leído de la base ─────────────────────────────────────────────────────────────────────────────────
desp = {m['id']: m for m in leer('msa_galicia', {'select': 'id,estado,template_id,template_cuota_id,categ,contable,interno,debitos,creditos', 'id': 'in.(' + ','.join(vinc) + ')'})}
cuotas = {c['id']: c for c in leer('cuotas_egresos_sin_factura', {'select': 'id,egreso_id,monto,estado,fecha_estimada', 'id': 'in.(' + ','.join(foto['cuotas_creadas']) + ')'})}
mal = [i for i, m in desp.items() if m['estado'] != 'conciliado' or m['template_cuota_id'] not in (set(cuotas) | set(grupo_de.values()))]
codigos = [i for i, m in desp.items() if (m['contable'] or '') != (movs[i]['contable'] or '') or (m['interno'] or '') != (movs[i]['interno'] or '')]
suma_c = r2(sum(float(c['monto']) for c in cuotas.values())); suma_b = r2(sum(float(m['debitos'] or 0) + float(m['creditos'] or 0) for m in desp.values()))
print(f'CONTROL: {len(desp)} conciliados · {len(mal)} mal vinculados · {len(codigos)} con códigos tocados · cuotas {len(cuotas)} todas «anterior»: {all(c["estado"]=="anterior" for c in cuotas.values())} · suma cuotas {suma_c:,.2f} vs banco {suma_b:,.2f} → dif {r2(suma_c - suma_b)}')
