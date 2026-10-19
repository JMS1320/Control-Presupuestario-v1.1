"""
Propuesta movimiento por movimiento del extracto PAM — CATEG elegidas por el usuario 2026-10-18:
«de las dos cuentas IMP, BSAS (FIJOS BS AS), FCI, BANC, DIST MA, DIST HNOS».

Lo procesa Claude, como con MSA: cada movimiento recibe un DESTINO con su CRITERIO a la vista. Reglas que vienen
de lo decidido con el usuario:
  · SIN contable ni interno (A-DEC-1010, 18/10): se carga template + cuota; los códigos van en una tanda aparte.
  · Campañas (18/10): los templates ABIERTOS (banco, FCI, retiros) no van por campaña → el vigente. Los FIJOS
    (impuestos, expensas, servicios) van a la campaña de la OBLIGACIÓN: 2025 (si no existe el template 2025, se
    crea como copia del 2026, inactivo y sin generación) — un pago de enero-26 de algo de 2025 va a 2025.
  · Cuota que YA existe en la app sin movimiento (las «previas» del 02/02) → VINCULAR, no crear otra.
  · Ante la duda: PREGUNTA, no se inventa.
"""
import re

ABIERTO = '(abierto: sin campaña)'

def tpl(nombre, campania, nota=''):
    return f'TEMPLATE · {nombre} [{campania}]' + (f' — {nota}' if nota else '')

def proponer(m, marca_app):
    """m: el movimiento (cuenta, fecha, deb, cre, texto, categ, det). Devuelve (destino, cuenta, criterio, aviso)."""
    cat, det, txt = m['categ'], (m['det'] or ''), (m['texto'] or '')
    d = (det + ' ' + txt).lower()
    anio = m['fecha'].year
    if marca_app and marca_app[0] == 'Cuota de template en la app':
        return ('VINCULAR · a la cuota que ya está en la app', '', f'Ya existe la cuota «{marca_app[1][:70]}» sin movimiento: es este pago.', '')
    if cat == 'BANC':
        if 'caja de seguridad' in d: return (tpl('Comision Caja de Seguridad', ABIERTO), 'Comision Caja de Seguridad', 'Banco: «COM CAJA DE SEGURIDAD».', '')
        if 'cheque' in d: return (tpl('Comision Cheques', ABIERTO), 'Comision Cheques', 'Banco: «COM DEPOSITO DE CHEQUE».', '')
        if 'transf' in d: return (tpl('Comision Transferencias', ABIERTO), 'Comision Transferencias', 'Banco: «COM. GESTION TRANSF.».', '')
    if cat == 'FCI':
        return (tpl('FIMA Premium Galicia Pesos (rescate inmediato)', ABIERTO), 'FCI', 'Suscripción / rescate FIMA: el template FCI de PAM (de doble sentido).', '')
    if cat == 'DIST HNOS':
        for quien, t in (('jose', 'Retiro Jose semestral'), ('andres', 'Retiro Andres semestral'), ('mechi', 'Retiro Mechi semestral'),
                         ('soledad', 'Retiro Soledad semestral'), ('manuel', 'Retiro Manuel semestral')):
            if quien in d: return (tpl(t, ABIERTO), t.replace('Retiro', 'Distribucion').replace(' semestral', ''), f'Tu detalle: «{det}». Template de PAM de ese socio.', '')
    if cat == 'DIST MA':
        return (tpl('Retiro MA semestral PAM', ABIERTO), 'Distribucion Mama', f'Transferencia a MA («{det}»). Es el template de retiros de MA de PAM («Retiro MA mensual» es el de MSA).',
                'Confirmar: ¿«Retiro MA semestral PAM» o el mismo «Retiro MA mensual» de MSA?')
    if cat == 'FIJOS BS AS':
        if 'metrogas' in d: return (tpl('Metrogas Libertad', 2025 if anio == 2025 else 2026, 'si no existe 2025, se crea'), 'Fijos Libertad', 'Débito automático METROGAS.', '' if anio == 2025 else 'Pago de enero-26: ¿es la factura de diciembre (2025)?')
        if 'aysa' in d: return (tpl('AYSA Libertad', 2025), 'Fijos Libertad', 'Pago AYSA.', '')
        if 'expensas libertad' in d: return (tpl('Expensas Libertad', 2025), 'Expensas Libertad', 'Transferencia de expensas; el período es el mes anterior → 2025.', '')
        if 'expensas posadas' in d: return (tpl('Expensas Posadas', 2025), 'Expensas Cochera Posadas', f'Tu detalle: «{det}» → diciembre 2025.', '')
        if 'aca' == det.strip().lower() or 'autclub' in d:
            return ('PREGUNTA · cuota del ACA (Automóvil Club): no hay template', '', 'Débito automático «AUTCLUB ARGCS CUOTA».', '¿Template nuevo «Cuota ACA» (fijo, Fijos Libertad) o no va?')
    if cat == 'IMP':
        if re.search(r'\biva\b', d) and m['deb'] < 50000:
            return (tpl('Iva Bancario', ABIERTO), 'Iva Bancario', 'IVA del banco sobre comisiones.', '')
        if det.strip().upper() == 'DC' or 'ley 25413' in d or 'ley 25413' in d.replace('.', ''):
            return (tpl('Debitos / Creditos', ABIERTO), 'Debitos / Creditos', 'Impuesto al cheque (Ley 25.413).', '')
        if 'ing brutos s/ cred' in d or 'ing. brutos s/ cred' in d or 'ley 12837' in d:
            return (tpl('IIBB Bancario', ABIERTO), 'IIBB Bancario', 'Percepción de IIBB sobre créditos que cobra el banco (Ley 12.837).',
                    'Importe alto para una percepción: confirmar' if m['deb'] > 100000 else '')
        if 'arba iibb' in d or re.search(r'iibb (agosto|octubre|pam)', d) or 'iibb pam' in d:
            camp = 2025 if (anio == 2025 or m['fecha'].month == 1) else anio
            return (tpl('IIBB Mensual PAM', camp, 'si no existe 2025, se crea'), 'Impuesto IIBB', f'Pago ARBA IIBB («{det}»).',
                    'Pago de enero-26: ¿es el IIBB de diciembre 2025?' if m['fecha'].year == 2026 else '')
        if 'abl libertad' in d: return (tpl('ABL Libertad Cuota', 2025, 'si no existe 2025, se crea'), 'ABL Libertad', 'Pago ABL Libertad (GCBA).', '')
        if 'abl posadas deuda' in d:
            return ('PREGUNTA · ABL Posadas deuda 2024 y 2025', '', f'Tu detalle: «{det}».', '¿Va al template ABL Cochera Posadas 2025, o se separa la parte 2024?')
        if 'abl posadas' in d: return (tpl('ABL Cochera Posadas Cuota', 2025), 'ABL Cochera Posadas', 'Pago ABL Posadas (GCBA).', '')
        if 'abl incorrecto' in d:
            return ('PREGUNTA · pago de ABL por error', '', f'Tu detalle: «{det}» ($351.993,33).', '¿Se recuperó? ¿A qué va?')
        if 'ganancias pam 2024' in d: return (tpl('Imp. Ganancias / Bs Pers PAM', 2025), 'Impuestos ARCA', 'Ganancias 2024 pagado en 2025 (el template 2025 que ya existe).', '')
        if 'anticipos pam' in d: return (tpl('Anticipo Ganancias / Bs Pers PAM', 2025, 'si no existe 2025, se crea'), 'Impuestos ARCA', f'Tu detalle: «{det}» → anticipos del período 2025.', '')
        if 'deuda complementario' in d or 'adeudado ultimo debito' in d or 'cuota deuda complementario' in d:
            return ('PREGUNTA · plan de pagos ARBA del complementario PAM', '', f'Tu detalle: «{det}». Débito mensual del plan (MINISTERIO DE HA … PLA).',
                    '¿Template nuevo «Plan de pagos Complementario PAM» (abierto, Impuesto inmobiliario Complementario)?')
        if 'complementario pam cuota 4/4' in d: return (tpl('Inmobiliario Complementario Cuota PAM', 2025, 'si no existe 2025, se crea'), 'Impuesto inmobiliario Complementario', f'Tu detalle: «{det}».', '')
        if 'inmobiliario pam cuota 4/4' in d:
            return ('PREGUNTA · inmobiliario PAM cuota 4/4 adicional Nazarenas', '', f'Tu detalle: «{det}».', '¿De qué partida(s)? (Casco, Ombú, Tapera 1/2/3, Entre Ríos)')
        if 'red vial pam' in d:
            return ('PREGUNTA · Red Vial PAM cuota 4/4', '', f'Tu detalle: «{det}». Como en MSA, va abierto por partida.', '¿Me pasás el detalle por partida (como el de la 3/4)?')
        if 'autonomos' in d: return ('PREGUNTA · autónomos (enero 2025)', '', 'Débito «AFIP AUTONOMOS».', '¿De quién son? En PAM no hay template de autónomos.')
        if det.strip().upper() == 'VER': return ('PREGUNTA · transferencia a AFIP', '', 'Tu detalle dice «VER».', '¿Qué se pagó?')
    # ── v3 (18/10): DOM, RET, AP, SUELD, JORN ──
    # Lo que va y viene con MSA: en MSA existen «Retiro PAM» y «Aporte PAM» (distribución, doble sentido); del
    # lado de PAM no hay template. Se propone el espejo, uno por sentido, igual que en MSA.
    ej_msa = 'MSA 25/26' if (m['fecha'].year, m['fecha'].month) >= (2025, 7) else 'MSA 24/25 (ya cerrado)'
    if cat == 'RET':
        return (tpl('Retiro de MSA (nuevo, espejo de «Retiro PAM» de MSA)', ABIERTO), 'Distribucion MSA',
                f'Entra de MSA («SERVICIO PAGO A PROVEEDORES MARTINEZ SOBRADO»), tu detalle «{det}». Ejercicio de MSA: {ej_msa}.',
                'Template nuevo de PAM: confirmar nombre y que sea uno solo para todo el año. La cuenta no está en el plan (como «Distribucion Mama» y las de los hermanos): hay que darla de alta.')
    if cat == 'AP':
        return (tpl('Aporte a MSA (nuevo, espejo de «Aporte PAM» de MSA)', ABIERTO), 'Aporte MSA',
                f'Sale a MSA («MARTINEZ SOBRADO AG»), tu detalle «{det}». Ejercicio de MSA: {ej_msa}.',
                'Template nuevo de PAM: confirmar nombre. La cuenta no está en el plan: hay que darla de alta.' + (' En MSA es del 24/25, que no está cargado en la app: sólo va del lado de PAM.' if ej_msa.endswith('cerrado)') else ''))
    if cat == 'DOM':
        quien = 'Mabel' if 'mabel' in d or 'sole' in d else ('Nadia' if 'nadia' in d or '27285708740' in d else 'doméstica NZ')
        return (tpl('Sueldo Doméstica NZ (nuevo)', 2025), 'Sueldo Domestica', f'Transferencia a la doméstica de Nazarenas ({quien}), tu detalle «{det}».',
                'En PAM no hay template de doméstica (MA tiene «Aportes Domesticas») y la cuenta no está en el plan. ¿Template nuevo de PAM, o va por Sueldos con la empleada cargada?')
    if cat == 'SUELD':
        quien = 'JMS' if 'jms' in d else ('AMS' if 'ams' in d else '?')
        if 'premio' in d:
            return ('PREGUNTA · premio JMS (USD 5.000)', '', f'Tu detalle: «{det}» ($7.250.000).',
                    '¿Va por Sueldos como pago a JMS (tipo premio/aguinaldo), o es un gasto de PAM con template propio?')
        return (f'SUELDOS · pago a {quien} desde PAM', 'Sueldos', f'Tu detalle «{det}». {quien} es empleado de MSA/PAM/MA en Sueldos; diciembre 2025 '
                + ('no tiene período cargado para JMS.' if quien == 'JMS' else 'tiene período (saldo $1.575.213 pagado el 06/01 desde MSA).'),
                '¿Es sueldo de diciembre, aguinaldo o un extra? Con eso creo el período/pago histórico, como hicimos con MSA.')
    if cat == 'JORN':
        return ('PREGUNTA · jornales (Chano, 2 días × 2 personas)', '', f'Tu detalle: «{det}» ($680.000).',
                'En PAM no hay template de jornales; en el plan está «JORNALEROS - Labores Varias». ¿Qué trabajo fue? ¿Template nuevo «Jornales PAM» con esa cuenta?')
    return ('PREGUNTA · sin regla', '', f'Tu detalle: «{det}».', 'No supe a qué va.')
