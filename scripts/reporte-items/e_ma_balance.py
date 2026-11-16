# -*- coding: utf-8 -*-
"""MA · D12 Balance propio — las dos fotos guardadas de MA (31/12/2025 y 30/06/2026), renglón por renglón.

Fuente: ma/balance.json (las fotos del balance propio de MA y sus valores, versión de JMS). Criterio de JMS (14/11/2026):
ganancia = (activo − pasivo) al cierre − (activo − pasivo) a la apertura, cada punta en dólares con su dólar.
Primero la tabla en pesos; debajo, aparte, la misma tabla en dólares (cada celda = su celda en pesos / el dólar de la punta).
Cruza los bancos y la tarjeta con ma/bancos.json (los extractos)."""
from e_ma_comun import GRUPO_D, TC_FMT, ar, cerca, dma, fila, hoja, leer

D = 'D12 Balance propio'


def construir(lib, src):
    d = leer(src, 'balance')
    b = leer(src, 'bancos')['foto']
    f0, f1 = d['fotos']
    ren = d['renglones']
    act = [r for r in ren if r['lado'] == 'activo']
    pas = [r for r in ren if r['lado'] == 'pasivo']

    #               1 Renglón 2 Cómo se armó 3 apertura 4 cierre 5 variación
    h = hoja(lib, D, [34, 56, 20, 20, 20])
    h.titulo('D12 · Balance propio de MA — apertura 31/12/2025 y cierre 30/06/2026')
    h.nota('Fuente: las dos fotos del balance propio de MA guardadas en el sistema el 15/11/2026 (versión de JMS). Criterio de JMS '
           '(14/11/2026): ganancia = activo − pasivo; lo que MSA y PAM le giraron a MA va como deuda hasta que se defina qué es '
           'retiro; los bienes (Libertad, campos) quedan afuera.')
    h.nota('Cómo se lee: la tabla 1 está en pesos; la tabla 2 es la misma en dólares: cada número es el de la tabla 1 dividido por '
           'el dólar de su fecha. La ganancia del semestre es la diferencia en dólares entre el cierre y la apertura. Abajo, cómo '
           'se armó cada renglón.')

    # 1) en pesos
    h.blanco()
    h.seccion('1 · En pesos')
    h.encabezado(['Renglón', '', f"Apertura {dma(f0['fecha'])}", f"Cierre {dma(f1['fecha'])}", 'Variación (cierre − apertura)'],
                 repetir=True)

    def bloque(titulo, rs, total):
        fila(h, [titulo], negrita=True)
        a = h.r + 1
        filas = {}
        for r in rs:
            n = h.r + 1
            filas[r['clave']] = fila(h, [r['nombre'], None, float(r['v0'] or 0), float(r['v1'] or 0),
                                         f"={h.cel(4, n)}-{h.cel(3, n)}"], comb={1: 2})
        t = h.total(total, {c: h.suma(c, a, h.r) for c in (3, 4, 5)})
        return filas, t

    fa, r_act = bloque('ACTIVO', act, 'Total activo')
    fp, r_pas = bloque('PASIVO', pas, 'Total pasivo')
    r_ap = h.total('Activo − pasivo, en pesos', {c: f"={h.cel(c, r_act)}-{h.cel(c, r_pas)}" for c in (3, 4, 5)}, clave=True)
    s = d['script277']
    r_x0 = fila(h, ['Activo − pasivo a la apertura (para el control)', None, None, None, f"={h.cel(3, r_ap)}"], comb={1: 2})
    h.control('activo − pasivo al 31/12/2025', h.cel(5, r_x0), s['a_menos_p_0'], 'control del script que guardó las fotos')
    r_x1 = fila(h, ['Activo − pasivo al cierre (para el control)', None, None, None, f"={h.cel(4, r_ap)}"], comb={1: 2})
    h.control('activo − pasivo al 30/06/2026', h.cel(5, r_x1), s['a_menos_p_1'], 'control del script que guardó las fotos')

    # 2) en dólares
    h.blanco()
    h.seccion('2 · En dólares (US$) — cada número de la tabla 1 dividido por el dólar de su fecha')
    h.encabezado(['Renglón', '', f"Apertura {dma(f0['fecha'])} en US$", f"Cierre {dma(f1['fecha'])} en US$",
                  'Variación en US$ (cierre − apertura)'])
    r_tc = fila(h, ['Dólar de cada fecha (pesos por dólar)', 'Banco Nación, divisas, promedio comprador / vendedor',
                    float(f0['tc']), float(f1['tc'])], negrita=True, fmt={3: TC_FMT, 4: TC_FMT})

    def bloque_usd(titulo, rs, origen, total):
        fila(h, [titulo], negrita=True)
        a = h.r + 1
        for r in rs:
            n = h.r + 1
            fila(h, [r['nombre'], None, f"={h.cel(3, origen[r['clave']])}/{h.cel(3, r_tc)}",
                     f"={h.cel(4, origen[r['clave']])}/{h.cel(4, r_tc)}", f"={h.cel(4, n)}-{h.cel(3, n)}"], comb={1: 2})
        return h.total(total, {c: h.suma(c, a, h.r) for c in (3, 4, 5)})

    u_act = bloque_usd('ACTIVO', act, fa, 'Total activo en US$')
    u_pas = bloque_usd('PASIVO', pas, fp, 'Total pasivo en US$')
    r_uap = h.total('Activo − pasivo, en US$', {c: f"={h.cel(c, u_act)}-{h.cel(c, u_pas)}" for c in (3, 4)})
    r_gan = h.total('Total ítem 12 — ganancia del semestre en US$ = (activo − pasivo) al cierre − a la apertura',
                    {5: f"={h.cel(4, r_uap)}-{h.cel(3, r_uap)}"}, clave=True)
    h.control('ganancia del semestre en US$', h.cel(5, r_gan), s['ganancia_usd'], 'control del script que guardó las fotos',
              tolerancia=0.01)
    h.nota('La variación de cada renglón en dólares mezcla dos dólares distintos (el de la apertura y el del cierre): por eso la '
           'ganancia se toma de la diferencia de los totales y no de pasar a dólares la variación en pesos.')

    # 3) cruce con los extractos
    h.blanco()
    h.seccion('3 · Cruce de los renglones con los extractos (D5 Bancos) — en pesos')
    h.encabezado(['Renglón del balance propio', 'Qué se compara', 'Según el balance propio', 'Según los extractos',
                  'Diferencia'])
    cruces = [
        ('Bancos al 31/12/2025', 'caja de ahorro Galicia + caja de ahorro de la jubilación, saldos de los extractos',
         h.cel(3, fa['banco_galicia']), b['galicia_3112'] + b['anses_3112']),
        ('Bancos al 30/06/2026', 'caja de ahorro Galicia + caja de ahorro de la jubilación, saldos de los extractos',
         h.cel(4, fa['banco_galicia']), b['galicia_3006'] + b['anses_3006']),
        ('Tarjeta al 31/12/2025', f"consumos en pesos del resumen abierto + US$ {ar(b['visa_usd_3112'])} × {ar(f0['tc'])}",
         h.cel(3, fp['tarjetas']), round(b['visa_3112'] + b['visa_usd_3112'] * f0['tc'], 2)),
        ('Tarjeta al 30/06/2026', f"consumos en pesos del resumen abierto + US$ {ar(b['visa_usd_3006'])} × {ar(f1['tc'])}",
         h.cel(4, fp['tarjetas']), round(b['visa_3006'] + b['visa_usd_3006'] * f1['tc'], 2)),
    ]
    malas = []
    for nombre, que, celda, valor in cruces:
        n = h.r + 1
        fila(h, [nombre, que, f"={celda}", float(valor), f"={h.cel(3, n)}-{h.cel(4, n)}"])
        h.control(f"{nombre}: balance propio contra los extractos", h.cel(3, n), valor, 'extractos de MA (D5 Bancos)')
    rv = {r['clave']: r for r in ren}
    for txt, a, c in (('bancos 31/12', rv['banco_galicia']['v0'], cruces[0][3]), ('bancos 30/06', rv['banco_galicia']['v1'], cruces[1][3]),
                      ('tarjeta 31/12', rv['tarjetas']['v0'], cruces[2][3]), ('tarjeta 30/06', rv['tarjetas']['v1'], cruces[3][3])):
        if not cerca(a, c):
            malas.append(f"{txt}: balance $ {ar(a)} vs extractos $ {ar(c)}")

    # 4) cómo se armó
    h.blanco()
    h.seccion('4 · Cómo se armó cada renglón (texto guardado con cada foto)')
    for f, k in ((f0, 'd0'), (f1, 'd1')):
        h.nota(f"Foto del {dma(f['fecha'])} — dólar {ar(f['tc'])}: {f['tc_fuente']}. {f['notas']}")
        for r in ren:
            h.nota(f"   · {r['nombre']}: {r[k]}.")

    # --- ítems ---
    lib.item('12', 'Balance propio de MA — ganancia del semestre 01/01–30/06/2026, en US$', h, h.cel(5, r_gan), GRUPO_D,
             'activo − pasivo al 30/06/2026 menos al 31/12/2025, cada punta con su dólar; bienes afuera')
    lib.item('12a', 'Activo − pasivo de MA al 30/06/2026, en pesos', h, h.cel(4, r_ap), GRUPO_D,
             'bancos + arrendamiento a cobrar − tarjeta − cuentas con MSA y PAM')

    # --- verificación en Python ---
    ap0 = sum(r['v0'] or 0 for r in act) - sum(r['v0'] or 0 for r in pas)
    ap1 = sum(r['v1'] or 0 for r in act) - sum(r['v1'] or 0 for r in pas)
    g = ap1 / f1['tc'] - ap0 / f0['tc']
    if not cerca(ap0, s['a_menos_p_0']) or not cerca(ap1, s['a_menos_p_1']):
        malas.append(f"activo − pasivo: {ar(ap0)} / {ar(ap1)} vs {ar(s['a_menos_p_0'])} / {ar(s['a_menos_p_1'])}")
    if not cerca(g, s['ganancia_usd'], 0.01):
        malas.append(f"ganancia US$ {ar(g)} vs {ar(s['ganancia_usd'])}")
    if malas:
        lib.pendiente('Balance propio MA: no cierra contra los extractos o contra el control del script', '; '.join(malas),
                      'Control en REVISAR', D)

    # --- pendientes ---
    dv = rv['deudores_ventas']
    lib.pendiente('¿Qué período se cierra para MA?',
                  f"Lo guardado es el semestre 01/01–30/06/2026 (apertura {dma(f0['fecha'])}, cierre {dma(f1['fecha'])}; ganancia "
                  f"US$ {ar(g)}). La alternativa es el año 30/06/2025–30/06/2026, como MSA. La contabilidad oficial de MA es por "
                  'año calendario.',
                  'Para el año entero falta una foto al 30/06/2025 y no hay ningún banco de MA cargado antes del 07/10/2025', D)
    lib.pendiente('El valor de los bienes de MA no está en ninguna foto',
                  'Las dos fotos dejan afuera los bienes (Libertad, campos) por criterio de JMS del 14/11/2026. El activo sólo tiene '
                  'bancos y el arrendamiento a cobrar.',
                  'El balance propio muestra el resultado del semestre, no el patrimonio de MA', D)
    lib.pendiente('Balance propio MA: el arrendamiento a cobrar es una factura emitida después del cierre',
                  f"Renglón «{dv['nombre']}» al 30/06/2026: $ {ar(dv['v1'])}, cargado a mano. {dv['d1']}. Esa factura (Provinvest "
                  'S.A., CUIT 33710346939, Factura de crédito electrónica C 00001-00000002) tiene fecha 30/09/2026 y el banco '
                  'muestra un cobro de $ 82.617.301,00 el 01/10/2026.',
                  f"$ {ar(dv['v1'])} = US$ {ar(dv['v1'] / f1['tc'])}: es más que toda la ganancia del semestre. ¿Qué parte "
                  'corresponde devengar al 30/06/2026?', D)
    lib.pendiente('Balance propio MA: no tiene renglón de proveedores a pagar',
                  'En D2 hay 21 comprobantes de compra en pesos «pendientes de pago» por $ 25.774.929,37 neto y uno en dólares por '
                  'US$ 10.285,00 (los dos más grandes: Allende Carlos Ignacio, 06/02/2026, $ 23.747.800,00 y US$ 10.285,00). El '
                  'criterio guardado es «todo lo de MA, pagado».',
                  'Si alguno se debía al 30/06/2026, el pasivo está corto y la ganancia es menor', D)
    lib.pendiente('Balance propio MA: cuenta con MSA al saldo del sistema, no al enviado al contador',
                  'El renglón «Cuentas con MSA y con PAM» al 30/06/2026 toma $ 44.459.338,17 con MSA (saldo del sistema). Lo que MSA '
                  'le envió a su contador dice $ 45.593.911,03.',
                  'Diferencia $ 1.134.572,86 (5 renglones; detalle en D10)', D)
    return h
