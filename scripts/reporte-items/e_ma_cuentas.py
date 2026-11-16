# -*- coding: utf-8 -*-
"""MA · D10 Cuentas — lo que pasó entre MA y MSA y entre MA y PAM, visto desde las cuentas de MA, cruzado con MSA.

Fuentes: ma/cuentas.json (movimientos de la caja de ahorro Galicia y de la tarjeta de MA con código CTA MSA / DIST PAM o con
el CUIT de MSA o de PAM) y ma/msa_d10c.json (la cuenta de Mercedes Areco tal como la muestra el reporte de MSA, hoja
«D10 Socios», bloque 10c: renglón por renglón).

Orden: (1) resumen visto desde MA · (2) cruce con MSA · (3)-(5) detalle por mes de lo visto desde MA · (6) lo que dice MSA."""
import collections

from e_ma_comun import GRUPO_C, ar, cerca, dma, fecha, fila, hoja, leer, mes_largo

D = 'D10 Cuentas'
ENC = ['Fecha', 'Cuenta', 'Concepto', 'Contraparte / a quién', 'Código contable', 'Código interno', 'Importe', '', '']


def _por_mes(h, filas, armar, primero=False):
    """Escribe los renglones agrupados por mes con su subtotal. Devuelve los renglones de los subtotales."""
    grupos = collections.OrderedDict()
    for v in sorted(filas, key=lambda v: v[0]):
        grupos.setdefault(v[0][:7], []).append(v)
    subs = []
    for m, vs in grupos.items():
        a = h.r + 1
        for v in vs:
            fila(h, armar(v))
        subs.append(h.total(f"Subtotal {mes_largo(m)}", {7: h.suma(7, a, h.r)}))
    return subs


def _msa(filas):
    """Clasifica los renglones de la cuenta de MA en el reporte de MSA."""
    cl = collections.defaultdict(list)
    for f in filas:
        _, fe, cuenta, concepto, agrup, otra, debe, haber = f[:8]
        if not (isinstance(fe, str) and len(fe) == 10 and fe[4] == '-'):
            continue
        cuenta, agrup = str(cuenta or ''), str(agrup or '')
        concepto = str(concepto or '').replace('  ← sin referencia', '')
        if isinstance(debe, (int, float)) and debe:
            k = ('retiros' if agrup.startswith('Retiros') else 'libertad_debe' if cuenta.startswith('Gastos Libertad')
                 else 'terceros')
            cl[k].append([fe, cuenta, concepto, agrup, float(debe)])
        if isinstance(haber, (int, float)) and haber:
            k = ('sueldos' if cuenta.startswith('Facturas') else 'libertad_haber' if cuenta.startswith('Gastos Libertad')
                 else 'pagos_ma' if cuenta.startswith('MA ') else 'otros_haber')
            cl[k].append([fe, cuenta, concepto, agrup, float(haber)])
    return cl


def construir(lib, src):
    d = leer(src, 'cuentas')
    cl = _msa(leer(src, 'msa_d10c'))
    dice = d['msa_dice']
    de_msa, de_pam, por_msa = d['de_msa'], d['de_pam'], d['por_msa']
    s = lambda vs: sum(v[-1] for v in vs)  # noqa: E731

    #               1 Fecha 2 Cuenta 3 Concepto 4 Contraparte 5 Contable 6 Interno 7 8 9 importes
    h = hoja(lib, D, [10, 18, 34, 28, 9, 9, 14, 14, 14])
    h.titulo('D10 · Cuentas de MA con MSA y con PAM — ejercicio 01/07/2025 al 30/06/2026')
    h.nota('Fuente: la caja de ahorro Galicia y la tarjeta VISA de MA (movimientos con el código «CTA MSA» o «DIST PAM», o con el '
           'CUIT de MSA o de PAM), y la cuenta de Mercedes Areco en el reporte de MSA 25/26 (hoja «D10 Socios», 10c). Importes en '
           'pesos. Las cuentas de MA tienen movimientos cargados recién desde el 07/10/2025.')
    h.nota('Cómo se lee: la tabla 1 resume lo que se ve desde las cuentas de MA; la tabla 2 lo pone al lado de lo que dice MSA y '
           'muestra la diferencia; las tablas 3 a 5 son cada movimiento de MA, por mes; la tabla 6 es la cuenta de MA tal como la '
           'lleva MSA, renglón por renglón. Cada total suma los renglones que tiene arriba.')

    # 1) resumen visto desde MA
    h.blanco()
    h.seccion('1 · Resumen — visto desde las cuentas de MA')
    h.encabezado(['Concepto', '', '', '', '', 'Movi-mientos', 'Importe', '', ''])
    r1a = fila(h, ['Recibido de MSA: transferencias a la caja de ahorro Galicia (tabla 3)', None, None, None, None, len(de_msa),
                   '=0'], comb={1: 5})
    r1b = fila(h, ['Pagado por MA por cuenta de MSA, con su caja de ahorro y su tarjeta (tabla 4) — resta', None, None, None, None,
                   len(por_msa), '=0'], comb={1: 5})
    r1n = h.total('Neto recibido de MSA', {7: f"={h.cel(7, r1a)}-{h.cel(7, r1b)}"})
    r1c = fila(h, ['Recibido de PAM: transferencias a la caja de ahorro Galicia (tabla 5)', None, None, None, None, len(de_pam),
                   '=0'], comb={1: 5})
    r1t = h.total('Total ítem 10 — neto recibido de MSA y de PAM, visto desde las cuentas de MA',
                  {7: f"={h.cel(7, r1n)}+{h.cel(7, r1c)}"}, clave=True)
    h.nota('MA no pagó nada por cuenta de PAM que esté marcado como tal en sus cuentas. La caja de ahorro de la jubilación no tiene '
           'ningún movimiento con MSA ni con PAM.')

    # 2) cruce con MSA
    h.blanco()
    h.seccion('2 · Cruce con MSA — lo que ve MA al lado de lo que dice la cuenta de socio en MSA')
    h.encabezado(['Concepto', '', '', '', '', '', 'Visto desde las cuentas de MA', 'Según la cuenta de socio en MSA',
                  'Diferencia (MA − MSA)'])

    def cruce(texto, ma, msa):
        r = h.r + 1
        return fila(h, [texto, None, None, None, None, None, ma, msa, f"={h.cel(7, r)}-{h.cel(8, r)}"], comb={1: 6})

    r2a = cruce('a) Transferencias de MSA a MA (en MSA: «Retiros / Distribución socios»)', '=0', '=0')
    r2b = cruce('b) Pagos que hizo MA por cuenta de MSA — resta (en MSA: haber de la cuenta, pagado con cuentas de MA)', '=0', '=0')
    r2c = cruce('c) Pagos que hizo MSA a terceros por cuenta de MA: no pasan por las cuentas de MA (tabla 6b)', 0.0, '=0')
    r2d = cruce('d) Libertad 2do semestre «retiró MA»: asiento de MSA, no pasa por las cuentas de MA (tabla 6c)', 0.0, '=0')
    r2t = h.total('Pagado a MA en el ejercicio = a − b + c + d',
                  {c: f"={h.cel(c, r2a)}-{h.cel(c, r2b)}+{h.cel(c, r2c)}+{h.cel(c, r2d)}" for c in (7, 8)}
                  | {9: f"={h.cel(7, h.r + 1)}-{h.cel(8, h.r + 1)}"}, clave=True)
    h.nota('La diferencia del total se explica entera por los renglones c) y d): son pagos y asientos que MSA le carga a MA y que '
           'no pasan por ninguna cuenta bancaria de MA. En a) y en b) las dos empresas dicen lo mismo.')
    r_pag = fila(h, ['Pagado a MA en el ejercicio según MSA (para el control)', None, None, None, None, None, None,
                     f"={h.cel(8, r2t)}"], comb={1: 6})
    h.control('pagado a MA en el ejercicio según MSA', h.cel(8, r_pag), dice['pagado_a_ma'], 'reporte de MSA 25/26, D10 Socios')
    h.control('transferencias recibidas de MSA: MA contra MSA (diferencia tiene que ser cero)', h.cel(9, r2a), 0.0,
              'caja de ahorro de MA contra «Retiros» de la cuenta de socio en MSA')
    h.control('pagos de MA por cuenta de MSA: MA contra MSA (diferencia tiene que ser cero)', h.cel(9, r2b), 0.0,
              'caja de ahorro y tarjeta de MA contra el haber de la cuenta de socio en MSA')

    h.blanco()
    h.seccion('2.1 · La cuenta de MA en MSA, armada con las partes de arriba — saldo al 30/06/2026')
    h.encabezado(['Concepto', '', '', '', '', '', '', 'Según MSA', ''])
    r3 = {}
    for k, t in (('debe', 'MSA le pagó o pagó por ella (a + c + d de arriba)'),
                 ('sueldos', 'MSA le devengó sueldo, julio 2025 a junio 2026 (tabla 6d) — a favor de MA'),
                 ('lib', 'Libertad 1er semestre «aportó MA» (tabla 6e) — a favor de MA'),
                 ('pagos', 'MA pagó por cuenta de MSA (b de arriba) — a favor de MA')):
        r3[k] = fila(h, [t, None, None, None, None, None, None, '=0'], comb={1: 7})
    h.celda(8, r3['debe']).value = f"={h.cel(8, r2a)}+{h.cel(8, r2c)}+{h.cel(8, r2d)}"
    h.celda(8, r3['pagos']).value = f"={h.cel(8, r2b)}"
    r3s = h.total('Saldo según el sistema de MSA (negativo = MA le debe a MSA) = sueldo + Libertad + pagos de MA − lo pagado',
                  {8: f"={h.cel(8, r3['sueldos'])}+{h.cel(8, r3['lib'])}+{h.cel(8, r3['pagos'])}-{h.cel(8, r3['debe'])}"})
    r3x = fila(h, ['Anexo: 5 renglones que están en lo enviado al contador y todavía no en el sistema de MSA (albañil del chalet '
                   '16 y 19/05/2026, internet y dos seguros del chalet por la tarjeta de MSA)', None, None, None, None, None, None,
                   float(dice['anexo'])], comb={1: 7})
    r3e = h.total('Saldo de la cuenta de MA como se envió al contador de MSA', {8: f"={h.cel(8, r3s)}+{h.cel(8, r3x)}"}, clave=True)
    r_c1 = fila(h, ['Saldo según el sistema de MSA (para el control)', None, None, None, None, None, None, f"={h.cel(8, r3s)}"],
                comb={1: 7})
    h.control('saldo de MA según el sistema de MSA', h.cel(8, r_c1), dice['saldo_sistema'], 'reporte de MSA 25/26, D10 Socios')
    r_c2 = fila(h, ['Saldo como se envió al contador (para el control)', None, None, None, None, None, None, f"={h.cel(8, r3e)}"],
                comb={1: 7})
    h.control('saldo de MA como se envió al contador de MSA', h.cel(8, r_c2), dice['saldo_enviado'],
              'reporte de MSA 25/26, D10 Socios')

    def mov(v):
        return [fecha(v[0]), v[1], v[2], v[3], v[4], v[5], float(v[6])]

    # 3) recibido de MSA
    h.blanco()
    h.seccion('3 · Recibido de MSA — cada transferencia a la caja de ahorro Galicia de MA, por mes')
    h.encabezado(ENC, repetir=True)
    subs = _por_mes(h, de_msa, mov)
    r_t3 = h.total('Total recibido de MSA', {7: h.suma_de(7, subs)}, clave=True)

    # 4) MA pagó por MSA
    h.blanco()
    h.seccion('4 · Pagado por MA por cuenta de MSA — con su caja de ahorro y con su tarjeta, por mes')
    h.encabezado(ENC)
    subs = _por_mes(h, por_msa, mov)
    r_t4 = h.total('Total pagado por MA por cuenta de MSA', {7: h.suma_de(7, subs)}, clave=True)
    h.nota('Los consumos de la tarjeta van por fecha de consumo, igual que en la cuenta de socio de MSA.')

    # 5) recibido de PAM
    h.blanco()
    h.seccion('5 · Recibido de PAM — cada transferencia a la caja de ahorro Galicia de MA, por mes')
    h.encabezado(ENC)
    subs = _por_mes(h, de_pam, mov)
    r_t5 = h.total('Total recibido de PAM, visto en las cuentas de MA', {7: h.suma_de(7, subs)}, clave=True)
    nv = d['pam_no_visto']
    r_nv = fila(h, [fecha(nv['fecha']), 'Banco Francés (sin cargar)', nv['texto'], 'SUCESION DE PLACIDO ALBERTO MARTINEZ', None,
                    None, float(nv['importe'])])
    r_t5b = h.total('Total girado por PAM a MA = visto en las cuentas de MA + giro al Banco Francés',
                    {7: f"={h.cel(7, r_t5)}+{h.cel(7, r_nv)}"})
    h.nota('En las cuentas de MA los giros de PAM están marcados «DIST PAM» (distribución), no «CTA PAM» (cuenta). El balance propio '
           'de MA (D12) los toma como deuda con PAM hasta que se defina qué es retiro.')
    r_c3 = fila(h, ['Total girado por PAM (para el control)', None, None, None, None, None, None, f"={h.cel(7, r_t5b)}"], comb={1: 7})
    h.control('girado por PAM contra la cuenta con PAM del balance propio de MA', h.cel(8, r_c3), d['foto_pam_3006'],
              'balance propio de MA al 30/06/2026, cuenta con PAM')

    # 6) lo que dice MSA
    h.blanco()
    h.seccion('6 · Lo que dice MSA — la cuenta de Mercedes Areco en el reporte de MSA, renglón por renglón')
    h.nota(f"Copiado de «{dice['archivo']}». «Cuenta» dice por dónde pasó en MSA (su banco, su tarjeta) o con qué cuenta de MA se "
           'pagó. No se modificó ningún importe.')
    enc6 = ['Fecha', 'Cuenta (según MSA)', 'Concepto', 'Agrupadora / template', '', '', 'Importe', '', '']
    r6 = {}
    for k, tit, tot in (
            ('retiros', '6a · Transferencias de MSA a MA («Retiros / Distribución socios»)', 'Total 6a — transferencias a MA'),
            ('terceros', '6b · Pagos de MSA a terceros por cuenta de MA (no pasan por las cuentas de MA)',
             'Total 6b — pagado a terceros por cuenta de MA'),
            ('libertad_debe', '6c · Libertad 2do semestre «retiró MA»', 'Total 6c'),
            ('sueldos', '6d · Sueldo devengado a favor de MA', 'Total 6d — sueldo devengado'),
            ('libertad_haber', '6e · Libertad 1er semestre «aportó MA»', 'Total 6e'),
            ('pagos_ma', '6f · Pagos de MA por cuenta de MSA (pagados con cuentas de MA)', 'Total 6f — pagado por MA')):
        h.blanco()
        h.seccion(tit)
        h.encabezado(enc6)
        subs = _por_mes(h, cl.get(k, []), lambda v: [fecha(v[0]), v[1], v[2], v[3], None, None, float(v[4])])
        r6[k] = h.total(tot, {7: h.suma_de(7, subs)}, clave=True)

    # vínculos
    h.celda(7, r1a).value = f"={h.cel(7, r_t3)}"
    h.celda(7, r1b).value = f"={h.cel(7, r_t4)}"
    h.celda(7, r1c).value = f"={h.cel(7, r_t5)}"
    h.celda(7, r2a).value = f"={h.cel(7, r_t3)}"
    h.celda(7, r2b).value = f"={h.cel(7, r_t4)}"
    h.celda(8, r2a).value = f"={h.cel(7, r6['retiros'])}"
    h.celda(8, r2b).value = f"={h.cel(7, r6['pagos_ma'])}"
    h.celda(8, r2c).value = f"={h.cel(7, r6['terceros'])}"
    h.celda(8, r2d).value = f"={h.cel(7, r6['libertad_debe'])}"
    h.celda(8, r3['sueldos']).value = f"={h.cel(7, r6['sueldos'])}"
    h.celda(8, r3['lib']).value = f"={h.cel(7, r6['libertad_haber'])}"

    # --- ítems ---
    lib.item('10', 'Cuentas de MA con MSA y con PAM — neto recibido, visto desde las cuentas de MA', h, h.cel(7, r1t), GRUPO_C,
             'recibido de MSA − pagado por cuenta de MSA + recibido de PAM; cruce con MSA en D10')
    lib.item('10a', 'Recibido de MSA (transferencias a la caja de ahorro)', h, h.cel(7, r1a), GRUPO_C,
             f"{len(de_msa)} transferencias, del {dma(de_msa[0][0])} al {dma(de_msa[-1][0])}")
    lib.item('10b', 'Pagado por MA por cuenta de MSA', h, h.cel(7, r1b), GRUPO_C,
             f"{len(por_msa)} pagos con la caja de ahorro y la tarjeta de MA")
    lib.item('10c', 'Recibido de PAM (transferencias a la caja de ahorro)', h, h.cel(7, r1c), GRUPO_C,
             f"{len(de_pam)} transferencias, del {dma(de_pam[0][0])} al {dma(de_pam[-1][0])}; falta el giro al Banco Francés")
    lib.item('10d', 'Saldo de la cuenta de MA en MSA, como se envió al contador de MSA (negativo = MA debe)', h, h.cel(8, r3e),
             GRUPO_C, 'saldo según el sistema de MSA + anexo; informativo, es el número de MSA')

    # --- verificación en Python ---
    T = {k: s(v) for k, v in cl.items()}
    debe = T.get('retiros', 0) + T.get('terceros', 0) + T.get('libertad_debe', 0)
    haber = T.get('sueldos', 0) + T.get('libertad_haber', 0) + T.get('pagos_ma', 0)
    malas = []
    if not cerca(s(de_msa), T.get('retiros', 0)):
        malas.append(f"transferencias: MA $ {ar(s(de_msa))} vs MSA $ {ar(T.get('retiros', 0))}")
    if not cerca(s(por_msa), T.get('pagos_ma', 0)):
        malas.append(f"pagos de MA por MSA: MA $ {ar(s(por_msa))} vs MSA $ {ar(T.get('pagos_ma', 0))}")
    if not cerca(debe - T.get('pagos_ma', 0), dice['pagado_a_ma']):
        malas.append(f"pagado a MA: $ {ar(debe - T.get('pagos_ma', 0))} vs $ {ar(dice['pagado_a_ma'])}")
    if not cerca(haber - debe, dice['saldo_sistema']):
        malas.append(f"saldo según el sistema: $ {ar(haber - debe)} vs $ {ar(dice['saldo_sistema'])}")
    if not cerca(haber - debe + dice['anexo'], dice['saldo_enviado']):
        malas.append(f"saldo enviado: $ {ar(haber - debe + dice['anexo'])} vs $ {ar(dice['saldo_enviado'])}")
    if not cerca(s(de_pam) + nv['importe'], d['foto_pam_3006']):
        malas.append(f"PAM: $ {ar(s(de_pam) + nv['importe'])} vs balance propio $ {ar(d['foto_pam_3006'])}")
    if cl.get('otros_haber'):
        malas.append(f"{len(cl['otros_haber'])} renglones del haber de MSA sin clasificar por $ {ar(T['otros_haber'])}")
    if malas:
        lib.pendiente('Cuentas MA: el cruce con MSA no cierra', '; '.join(malas), 'Control en REVISAR', D)

    # --- pendientes ---
    ter = cl.get('terceros', [])
    lib.pendiente('Lo que MSA y PAM le giraron a MA: ¿retiro / distribución o deuda?',
                  f"De MSA: {len(de_msa)} transferencias por $ {ar(s(de_msa))} ({dma(de_msa[0][0])} al {dma(de_msa[-1][0])}, caja de "
                  f"ahorro Galicia de MA, código contable «CTA MSA», interno «DIST MA») + {len(ter)} pagos de MSA a terceros por "
                  f"cuenta de MA por $ {ar(s(ter))}. De PAM: {len(de_pam)} transferencias por $ {ar(s(de_pam))} ({dma(de_pam[0][0])} "
                  f"al {dma(de_pam[-1][0])}, código contable «DIST PAM», interno «DIST MA») + $ {ar(nv['importe'])} del "
                  f"{dma(nv['fecha'])} al Banco Francés. El balance propio los toma como deuda: $ {ar(-dice['saldo_sistema'])} con "
                  f"MSA y $ {ar(d['foto_pam_3006'])} con PAM.",
                  f"$ {ar(-dice['saldo_sistema'] + d['foto_pam_3006'])} de pasivo de MA al 30/06/2026 que cambia la ganancia si es "
                  'retiro', D)
    lib.pendiente('MSA le devenga a MA un sueldo que en MA no figura como ingreso',
                  f"En la cuenta de socio de MSA: {len(cl.get('sueldos', []))} renglones «Sueldo mm/aaaa (a pagar)» por "
                  f"$ {ar(T.get('sueldos', 0))} (julio 2025 a junio 2026; $ 1.500.000 por mes y $ 2.250.000 en diciembre y junio). "
                  'En MA no hay factura ni otro registro de ese ingreso: D1 sólo tiene el arrendamiento a Provinvest.',
                  f"$ {ar(T.get('sueldos', 0))}: ¿es ingreso de MA del ejercicio? Hoy sólo baja su deuda con MSA", D)
    de_pam_txt = [v for v in ter if 'PAM' in v[2]]
    lib.pendiente('Pagos de MSA a terceros cargados a la cuenta de MA: no se ven desde MA',
                  f"{len(ter)} pagos por $ {ar(s(ter))} (tabla 6b): tarjeta de MSA, impuestos rurales, expensas, anticipos a una "
                  f"empleada, pintura. {len(de_pam_txt)} de ellos por $ {ar(s(de_pam_txt))} dicen «PAM» en el concepto (expensas "
                  'Posadas, inmobiliario Tapera): ¿son de MA o de PAM?',
                  'En MA no hay gasto ni comprobante por estos pagos; sólo existen en la cuenta de socio de MSA', D)
    lib.pendiente('Cuenta de MA en MSA: lo enviado al contador difiere de lo que tiene el sistema',
                  f"Saldo según el sistema de MSA $ {ar(dice['saldo_sistema'])}; como se envió $ {ar(dice['saldo_enviado'])}. "
                  f"Diferencia $ {ar(dice['anexo'])}: 5 renglones que están en lo enviado y no en el sistema (albañil del chalet "
                  '16/05 y 19/05/2026 por la Caja Sigot; internet 02/06 y dos seguros del chalet 26/06/2026 por la tarjeta de MSA).',
                  f"El balance propio de MA usa el saldo del sistema ($ {ar(-dice['saldo_sistema'])}): ¿cuál de los dos va?", D)
    lib.pendiente('Libertad: asientos de MSA en la cuenta de MA sin movimiento de banco',
                  f"1er semestre «aportó MA» $ {ar(T.get('libertad_haber', 0))} (31/12/2025, a favor de MA) y 2do semestre «retiró "
                  f"MA» $ {ar(T.get('libertad_debe', 0))} (30/06/2026, en contra). Salen del cuadro de gastos de Libertad de MSA.",
                  'No se pueden verificar desde las cuentas de MA. En las cuentas de MA hay pagos marcados «LIB» (expensas, ABL, '
                  'agua, gas): falta cruzarlos contra ese cuadro', D)
    lib.pendiente('Giros de PAM a MA: sólo se ven desde octubre de 2025',
                  f"El giro de PAM del {dma(nv['fecha'])} por $ {ar(nv['importe'])} fue al Banco Francés, que no está cargado. Si "
                  'hubo otros giros de MSA o de PAM entre el 01/07/2025 y el 06/10/2025, no se ven desde MA. Del lado de MSA no hay '
                  'ninguna transferencia a MA antes del 31/10/2025.',
                  'Falta el lado de PAM para cruzar los $ 21.250.000,00', D)
    lib.pendiente('Dos transferencias de MA a Andrés Martínez (AMS) — no son de PAM', d['descartados'],
                  '$ 325.000,00 clasificados como consumos de MA: ¿corresponde, o es cuenta con un socio?', D)
    return h
