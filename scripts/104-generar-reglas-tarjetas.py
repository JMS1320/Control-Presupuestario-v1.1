"""
Genera la parte de REGLAS del script 104 (tarjetas VISA de MA y PAM, A-DAT-92) a partir del estudio
«Estudio tarjetas VISA MA y PAM (2026-10-25).xlsx» (hoja «Los movimientos») y de las decisiones del
usuario (Excel «sintesis v2» + respuestas del 25/10).

Para cada comercio con template:
  - el texto de la regla es lo COMÚN a todas sus descripciones del banco (sin números ni montos), y
  - se verifica que ese texto NO coincida con descripciones de otro comercio de la MISMA tarjeta que vaya
    a otro destino (o que no lleve regla). Si choca, se alarga; si no se puede, se avisa y no se genera.

Uso:  python scripts/104-generar-reglas-tarjetas.py  > scripts/104-reglas-generadas.sql.txt
Sólo lee el Excel. No toca la base.
"""
import collections, re, sys, openpyxl

EXCEL = ("- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude/"
         "Estudio tarjetas VISA MA y PAM (2026-10-25).xlsx")
sys.stdout.reconfigure(encoding="utf-8")

ESPERA, SIN = "(espera factura)", "(sin regla)"


def destino(t, c, que, resp):
    """Mismas decisiones que el Excel «sintesis v2» + respuestas del 25/10 (Personal = Paquete TV MA)."""
    C = c.upper(); r = (resp or "").lower()
    if "EDESUR" in C: return "Luz Libertad"
    if "IPLAN" in C: return "Internet Libertad"
    if "MOVISTAR" in C: return "Telefono Fijo 812"
    if "DIRECTV" in C: return SIN            # 2025 sin factura vinculable; 2026 contra la factura de MSA
    if "PERSONAL" in C: return "Paquete TV MA"
    if "OMINT" in C: return "Omint AMS"
    if "CHUBB" in C: return "Seguro Chalet"
    if "JOCKEY" in C: return "Jockey Club"
    if "PROSEGUR" in C: return ESPERA
    for k, n in [("NETFLIX", "Netflix"), ("SPOTIFY", "Spotify"), ("SUSC CLUB LA", "Club La Nación"),
                 ("DISNEY", "Disney Plus"), ("ESET", "Eset (antivirus)")]:
        if k in C: return n
    if "APPLE" in C: return "Consumos MA"
    if "PARADOR SAN PEDRO" in C: return SIN  # espera su factura
    if "ATLASCINES" in C: return "Consumos MA"
    if que == "Farmacia / óptica": return "Gastos Medicos"
    if str(que).startswith("Factura de") and "consumo" not in r: return ESPERA
    if any(x in r for x in ["contra fc", "puede tener factura", "tiene factura", "deberia tener factura",
                            "puede haber factura", "debe ser factura", "eventualmente", "suele estar factura"]) \
            or r.strip() == "factura":
        return ESPERA
    return "Consumos MA"


wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
com = {(r[0], r[1]): r for r in wb["Comercios"].iter_rows(min_row=2, values_only=True) if r[0]}
movs = [r for r in wb["Los movimientos"].iter_rows(min_row=2, values_only=True) if r[0]]

# descripciones por (tarjeta, comercio), sólo grupos 3/4/5 (consumos, servicios, con factura)
descs = collections.defaultdict(list)
for r in movs:
    if str(r[10] or "").startswith(("3", "4", "5")) and r[9]:
        descs[(r[0], r[9])].append(str(r[4] or ""))

dest = {k: destino(k[0], k[1], v[9], v[13]) for k, v in com.items()}


def limpiar(d):
    d = re.sub(r"USD\s*[\d.,]+", " ", d, flags=re.I)
    d = re.sub(r"\b[\dA-Z]*\d[\dA-Z]*\b", " ", d)      # tokens con dígitos (nros de cliente, cuotas)
    return re.sub(r"\s+", " ", d).strip()


def comun(lista):
    """El tramo de texto más largo presente en TODAS las descripciones (insensible a mayúsculas)."""
    base = min((limpiar(x) for x in lista), key=len)
    mejor = ""
    for i in range(len(base)):
        for j in range(len(base), i + len(mejor), -1):
            s = base[i:j].strip()
            if len(s) > len(mejor) and all(s.lower() in x.lower() for x in lista):
                mejor = s
                break
    return mejor.strip(" -*._")


avisos, reglas = [], []
for (t, c), lista in sorted(descs.items()):
    d = dest.get((t, c))
    if d is None or d in (ESPERA, SIN):
        continue
    texto = comun(lista)
    # choque: el texto coincide con descripciones de OTRO comercio de la misma tarjeta con otro destino
    choques = [(c2, dest.get((t, c2))) for (t2, c2), l2 in descs.items()
               if t2 == t and c2 != c and dest.get((t, c2)) != d and any(texto.lower() in x.lower() for x in l2)]
    if len(texto) < 4 or choques:
        avisos.append(f"-- ⚠️ {t} · {c} → {d}: texto «{texto}» no sirve (choca con {choques[:3]}); NO se genera")
        continue
    reglas.append((t, c, d, texto, len(lista)))

# dedup: mismo (tarjeta, texto, destino) → una regla
vistos, finales = set(), []
for r in reglas:
    k = (r[0], r[3].lower(), r[2])
    if k in vistos: continue
    vistos.add(k); finales.append(r)

# ── Ajustes a mano (revisados uno por uno) ─────────────────────────────────────────────────────────
#  · Personal: por NÚMERO DE CLIENTE, que distingue las dos cuentas y no agarra otro «personal».
#  · Textos que el común dejó con códigos o cortados.
AJUSTE = {
    ("MA", "PERSONAL"): "300076464741", ("MA", "PERSONAL FLOW"): None,   # None = lo cubre la anterior
    ("PAM", "PERSONAL FLOW"): "100334148151",
    ("PAM", "SKOOL"): "SKOOL.COM",
    ("MA", "SPOTIFY"): "SPOTIFY", ("PAM", "SPOTIFY"): "SPOTIFY",
    ("MA", "MARKET ACASUSSO AV"): "Market Acasusso",
    ("MA", "TEMU COM"): None,                                              # «TEMU» ya lo cubre
    ("MA", "JUGUETERIA OSITO AZUL"): None, ("PAM", "JUGUETERIA OSITO AZUL"): None,  # lo cubre «…AZU»
}
ajustadas = []
for t, c, d, texto, n in finales:
    if (t, c) in AJUSTE:
        if AJUSTE[(t, c)] is None: continue
        texto = AJUSTE[(t, c)]
    ajustadas.append((t, c, d, texto, n))
finales = ajustadas

# ── Templates ───────────────────────────────────────────────────────────────────────────────────────
# clave → (nombre, responsable, año, categ, agrupadora, centro, cod_contable, cod_interno, proveedor, resp_interno,
#          solo_conciliacion, tipo, origen(clave 2025) )
L = ("Libertad", "LIB")
SUSC, GPM, FBA = "Suscripciones MA", "Gastos Personales MA", "Fijos Buenos Aires MA"
TEL = "TELEFONOS E INTERNET BS. AS."
T = []
def par(nombre, categ, agr, centro, cc, prov, solo_2026=False):
    if not solo_2026:
        T.append((f"{nombre} · PAM 2025", nombre, "PAM", "2025", categ, agr, centro, cc, "DIST MA", prov, "MA", False, "egreso", None))
    T.append((f"{nombre} · MA 2026", nombre, "MA", "2026", categ, agr, centro, cc, None, prov, "MA", False, "egreso",
              None if solo_2026 else f"{nombre} · PAM 2025"))
par("Luz Libertad", "LUZ", FBA, *L, "Edesur")
par("Internet Libertad", TEL, FBA, *L, "Iplan")
par("Telefono Fijo 812", TEL, FBA, *L, "Movistar (Telefónica)")
par("Paquete TV MA", TEL, SUSC, None, None, "Personal Flow (Telecom)")
for n in ["Club La Nación", "Disney Plus", "Jockey Club", "Netflix", "Spotify"]:
    par(n, "Consumos", SUSC, None, None, n if n != "Club La Nación" else "La Nación")
par("Eset (antivirus)", "INFORMATICA", SUSC, None, None, "Eset", solo_2026=True)
# Omint: es de AMS, los dos años en PAM (misma familia) con DIST AMS
T.append(("Omint AMS · PAM 2025", "Omint AMS", "PAM", "2025", "GASTOS MEDICOS", "Retiros / Distribucion Socios", None, None, "DIST AMS", "Omint", None, False, "egreso", None))
T.append(("Omint AMS · PAM 2026", "Omint AMS", "PAM", "2026", "GASTOS MEDICOS", "Retiros / Distribucion Socios", None, None, "DIST AMS", "Omint", None, False, "egreso", "Omint AMS · PAM 2025"))
# 2025 de templates cuyo 2026 YA existe (el enganche del 2026 al 2025 va en el 105)
T.append(("Seguro Chalet · PAM 2025", "Seguro Chalet", "PAM", "2025", "SEGUROS ESTRUCTURA", "Seguros", "Nazarenas", None, "DIST MA", "Chubb", "MA", False, "egreso", None))
T.append(("Consumos MA · PAM 2025", "Consumos MA", "PAM", "2025", "Consumos", GPM, None, None, "DIST MA", None, "MA", False, "egreso", None))
T.append(("Gastos Medicos · PAM 2025", "Gastos Medicos", "PAM", "2025", "GASTOS MEDICOS", GPM, None, None, "DIST MA", None, "MA", False, "egreso", None))
# Cargos del banco (sin campaña: cargan siempre en el elegido)
BANCO_MSA = {  # se copian proveedor / cuit / nombre_quien_cobra / periodicidad del de MSA
    "Comision Cuenta Bancaria": ("Gastos Bancarios", "Comision Cuenta Bancaria"),
    "IIBB CABA Bancario": ("Impuestos Bancarios", "IIBB CABA Bancario"),
    "Iva Bancario": ("Impuestos Bancarios", "Iva Bancario"),
    "Percepcion Ganancias Bancario": ("Impuestos Bancarios", "Percepcion Ganancias Bancario"),
    "Percepcion IVA": ("Impuestos Bancarios", "Percepcion IVA"),
}
BANCO_NUEVOS = [("MA", n) for n in BANCO_MSA] + [("PAM", "Percepcion Ganancias Bancario")]
INTERESES = [("MA", None), ("PAM", "DIST MA")]

# ── Reglas de cargos del banco (textos medidos en los 30 resúmenes) ─────────────────────────────────
#   (tarjeta, texto, clave template, detalle)
BANCO_REGLAS = [
    ("MA", "DERECHO EMISION", "Comision Cuenta Bancaria · MA", "Comisión emisión tarjeta (y su bonificación)"),
    ("MA", "IIBB PERCEP-CABA", "IIBB CABA Bancario · MA", "IIBB CABA tarjeta"),
    ("MA", "INTERESES FINANCIACION", "Intereses Tarjeta · MA", "Intereses de financiación"),
    ("MA", "DB IVA", "Iva Bancario · MA", "IVA sobre intereses/comisiones"),
    ("MA", "RG 5617", "Percepcion Ganancias Bancario · MA", "Percepción Ganancias RG 5617"),
    ("MA", "IVA RG", "Percepcion IVA · MA", "IVA servicios digitales RG 4240"),
    ("PAM", "IIBB PERCEP-CABA", "IIBB Bancario · PAM", "IIBB CABA tarjeta"),
    ("PAM", "INTERESES FINANCIACION", "Intereses Tarjeta · PAM", "Intereses de financiación"),
    ("PAM", "PUNIT", "Intereses Tarjeta · PAM", "Punitorios"),
    ("PAM", "DB IVA", "Iva Bancario · PAM", "IVA sobre intereses/comisiones"),
    ("PAM", "RG 5617", "Percepcion Ganancias Bancario · PAM", "Percepción Ganancias RG 5617"),
    ("PAM", "IVA RG", "Percepcion IVA · PAM", "IVA servicios digitales RG 4240"),
    ("PAM", "IMP DE SELLOS", "Sellos Bancario · PAM", "Sellos sobre intereses"),
]
# chequeo: ningún texto de banco agarra descripciones de comercios (grupos 3/4/5) de su tarjeta
for t, texto, _, _ in BANCO_REGLAS:
    malos = [c for (t2, c), l in descs.items() if t2 == t and any(texto.lower() in x.lower() for x in l)]
    if malos: avisos.append(f"-- ⚠️ regla de banco {t} «{texto}» también coincide con comercios: {malos}")

# Templates YA existentes que usan las reglas (id fijo, verificado por nombre/responsable en el script)
EXISTENTES = {
    "IIBB Bancario · PAM": ("262f16e5-d4c6-483e-a400-5d5554bcf07e", "IIBB Bancario", "PAM"),
    "Iva Bancario · PAM": ("bf14703f-130d-4b08-bdcc-7e1b0414d2f7", "Iva Bancario", "PAM"),
    "Percepcion IVA · PAM": ("f4f13ed5-e9c3-4894-8935-093d1e77e706", "Percepcion IVA", "PAM"),
    "Sellos Bancario · PAM": ("2e07bf32-9e49-4859-90a3-d3f086575872", "Sellos Bancario", "PAM"),
    "Consumos MA · MA": ("79c4229e-288c-40a1-98a0-da24482b3eeb", "Consumos MA", "MA"),
    "Gastos Medicos · MA": ("930e624d-b74b-4430-ad00-743c6ba02923", "Gastos Medicos", "MA"),
}


def clave_regla(t, d):
    """A qué renglón apunta la regla de un comercio. Tarjeta PAM → el 2025 (PAM); tarjeta MA → el 2026 (MA)."""
    if t == "PAM":
        if d == "Omint AMS": return "Omint AMS · PAM 2025"
        return f"{d} · PAM 2025"
    if d in ("Consumos MA", "Gastos Medicos"): return f"{d} · MA"           # existentes (sin año hasta el 105)
    if d == "Seguro Chalet": return None                                     # no hay Chubb en la tarjeta de MA
    return f"{d} · MA 2026"


q = lambda s: "null" if s is None else "'" + str(s).replace("'", "''") + "'"
out = []
w = out.append
w("-- 104 · CARGA: templates y reglas de las TARJETAS VISA de MA y PAM (A-DAT-92)")
w("--")
w("-- GENERADO por scripts/104-generar-reglas-tarjetas.py — no editar a mano: corregir el generador y volver a generar.")
w("-- DATOS, no estructura. Decisiones del usuario 2026-10-25 (Excel «Templates tarjetas MA y PAM - sintesis v2»")
w("-- + respuestas: Personal = Paquete TV MA · centro de costo Chalet · Intereses PAM con DIST MA · DirecTV 2025 y")
w("-- Parador sin regla). 🛑 Correr SÓLO con OK del usuario.")
w("--")
w("-- QUÉ HACE, en UNA transacción. SÓLO AGREGA: no modifica ninguna fila existente (eso es el 105).")
w("--   1. Centro de costo «Chalet» (si no existe).")
w(f"--   2. {len(T) + len(BANCO_NUEVOS) + len(INTERESES)} templates nuevos (marca '[script 104]' en observaciones_template). Cada servicio")
w("--      tiene su renglón 2025 (PAM, DIST MA) y 2026 (MA, sin DIST MA), y el 2026 apunta al 2025 (template_origen_id).")
w(f"--   3. {len(BANCO_REGLAS) + len(finales)} reglas en reglas_conciliacion (tarjeta_visa_pam / tarjeta_visa_ma; hoy no hay ninguna):")
w("--      cargos del banco primero, servicios después, consumos al final; UNA por comercio, ninguna «comodín».")
w("--      · Tarjeta de PAM → el renglón 2025 de PAM, con código interno DIST MA (Omint: DIST AMS), los dos años.")
w("--      · Tarjeta de MA  → el renglón 2026 de MA, sin código interno.")
w("--   4. 1 regla contable/interno (Tab 2) en la tarjeta de MA: si la cuota cae en un template de PAM → DIST MA.")
w("--")
w("-- ⚠️ LO QUE ESTE SCRIPT NO RESUELVE (ver el informe del 104 en A-DAT-92): el motor arma la «familia» de un")
w("-- template por NOMBRE + RESPONSABLE. Luz Libertad 2025 (PAM) y 2026 (MA) son dos familias, así que hasta que")
w("-- el motor siga el enlace template_origen_id: los movimientos de 2026 de la tarjeta de PAM y los de sep–dic 2025")
w("-- de la tarjeta de MA quedan A AUDITAR con «Falta la campaña…» (no se carga nada mal; no tocar ese botón).")
w("--")
w("-- MARCA para el deshacer: created_at = now() de la transacción (lo imprime el control final) + '[script 104]'.")
w("-- SE FRENA sin tocar nada si ya hay reglas en las dos tarjetas, templates con la marca, o falta un existente.")
w("--")
w("-- 📄 LOS RESÚMENES NO SE CARGAN ACÁ: van por la app (Extracto → tarjeta → Importar → «📄 Resumen PDF»), que controla")
w("-- el saldo, frena un resumen repetido y deja la fila RESUMEN. Archivos en «- Comunicacion JMS Claude - Archivos/Extractos/»:")
w("--   · TJ VISA PAM/  VISA PAM - 25-02 … 26-04.pdf  (15; el 25-01 ya está; el 24-12 NO se carga: PAM arranca en ene-25)")
w("--   · TJ VISA MA/   MA - VISA - 25-09 … 26-09.pdf (13)")
w("--   Orden recomendado: correr el 104, importar, y conciliar de a un resumen, del más viejo al más nuevo.")
w("")
w("begin;")
w("")
w("do $$")
w("begin")
w("  if exists (select 1 from public.reglas_conciliacion where cuenta_bancaria_id in ('tarjeta_visa_pam', 'tarjeta_visa_ma')) then")
w("    raise exception 'Ya hay reglas en las tarjetas de PAM o MA: no se corre el 104 (revisar antes).';")
w("  end if;")
w("  if exists (select 1 from public.egresos_sin_factura where observaciones_template like '%[script 104]%') then")
w("    raise exception 'Ya hay templates con la marca [script 104]: no se corre de nuevo.';")
w("  end if;")
w("  if exists (select 1 from public.reglas_contable_interno where cuenta_bancaria_id = 'tarjeta_visa_ma') then")
w("    raise exception 'Ya hay reglas contable/interno en la tarjeta de MA: revisar antes.';")
w("  end if;")
w("end $$;")
w("")
w("-- 1 · Centro de costo ------------------------------------------------------------------------------")
w("insert into public.centros_costo (nombre, activo, tipo)")
w("select 'Chalet', true, 'campo' where not exists (select 1 from public.centros_costo where lower(nombre) = 'chalet');")
w("")
w("-- 2 · Templates -----------------------------------------------------------------------------------")
w("create temp table t104 (clave text primary key, id uuid) on commit drop;")
w("")
COLS = ("nombre_referencia, responsable, año, activo, categ, centro_costo, responsable_interno, cuenta_agrupadora, "
        "tipo_template, tipo, tipo_recurrencia, periodicidad, es_bidireccional, solo_conciliacion, aplica_generacion, "
        "codigo_contable, codigo_interno, proveedor, cuit_quien_cobra, nombre_quien_cobra, observaciones_template, template_origen_id")


def insertar(filas, titulo):
    w(f"-- {titulo}")
    w("with nuevos as (")
    w(f"  insert into public.egresos_sin_factura ({COLS})")
    w("  select v.nombre, v.resp, v.anio, true, v.categ, v.centro, v.resp_int, v.agr, 'abierto', v.tipo::text::" +
      "public.tipo_cuenta, 'abierto', v.periodicidad, v.bidi, v.solo, false, v.cc, v.ci, v.prov, v.cuit, v.nqc,")
    w("         '[script 104] ' || v.obs, (select id from t104 where clave = v.origen)")
    w("  from (values")
    for i, f in enumerate(filas):
        w("    (" + ", ".join(f) + ")" + ("," if i < len(filas) - 1 else ""))
    w("  ) as v(clave, nombre, resp, anio, categ, centro, resp_int, agr, tipo, periodicidad, bidi, solo, cc, ci, prov, cuit, nqc, obs, origen)")
    w("  returning id, nombre_referencia, responsable, año, observaciones_template")
    w(")")
    w("insert into t104 select substring(observaciones_template from '\\{(.*)\\}'), id from nuevos;")
    w("")


def fila_servicio(t):
    clave, nombre, resp, anio, categ, agr, centro, cc, ci, prov, rint, solo, tipo, origen = t
    obs = f"{{{clave}}} tarjeta VISA — {'gasto de MA pagado por PAM' if resp == 'PAM' and ci == 'DIST MA' else 'año ' + anio}"
    return [q(clave), q(nombre), q(resp), q(anio), q(categ), q(centro), q(rint), q(agr), q(tipo), "'anual'", "false", "false",
            q(cc), q(ci), q(prov), "null::text", "null::text", q(obs), q(origen)]


filas25 = [fila_servicio(t) for t in T if t[13] is None]
filas26 = [fila_servicio(t) for t in T if t[13] is not None]
filas_banco = []
for resp, n in BANCO_NUEVOS:
    clave = f"{n} · {resp}"
    ci = "DIST MA" if resp == "PAM" else None
    filas_banco.append(["{c}", q(n), q(resp), "null::text", q(BANCO_MSA[n][1]), "null::text", "null::text", q(BANCO_MSA[n][0]),
                        "'egreso'", "(select periodicidad from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = " + q(n) + " limit 1)",
                        "true", "true", "null::text", q(ci),
                        "(select proveedor from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = " + q(n) + " limit 1)",
                        "(select cuit_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = " + q(n) + " limit 1)",
                        "(select nombre_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = " + q(n) + " limit 1)",
                        q(f"{{{clave}}} cargo del banco de la tarjeta, copia del de MSA"), "null::text"])
    filas_banco[-1][0] = q(clave)
for resp, ci in INTERESES:
    clave = f"Intereses Tarjeta · {resp}"
    filas_banco.append([q(clave), "'Intereses Tarjeta'", q(resp), "null::text", "'INTERESES'", "null::text", "null::text", "'Créditos Bancarios'",
                        "null::text", "'anual'", "true", "true", "null::text", q(ci), "'Banco Galicia'", "null::text", "'Banco Galicia'",
                        q(f"{{{clave}}} intereses y punitorios de la tarjeta (cuenta INTERESES, como Interes Capitalizado)"), "null::text"])

insertar(filas25 + filas_banco, "2a · los renglones 2025 (PAM) y los cargos del banco (sin campaña)")
insertar(filas26, "2b · los renglones 2026 (MA), enganchados a su 2025")
n_nuevos = len(filas25) + len(filas_banco) + len(filas26)
w("do $$ begin")
w(f"  if (select count(*) from t104) <> {n_nuevos} then raise exception 'No se crearon los {n_nuevos} templates: %', (select count(*) from t104); end if;")
w("end $$;")
w("")
w("-- Templates que YA existen y usan las reglas (se verifica nombre y responsable)")
w("insert into t104 (clave, id) values")
w(",\n".join(f"  ({q(k)}, {q(v[0])}::uuid)" for k, v in EXISTENTES.items()) + ";")
w("do $$ begin")
w("  if exists (select 1 from t104 t join (values")
w(",\n".join(f"    ({q(k)}, {q(v[1])}, {q(v[2])})" for k, v in EXISTENTES.items()))
w("  ) as x(clave, nombre, resp) on x.clave = t.clave")
w("  left join public.egresos_sin_factura e on e.id = t.id and e.nombre_referencia = x.nombre and e.responsable = x.resp and e.activo")
w("  where e.id is null) then raise exception 'Un template existente cambió o no está: revisar antes de correr el 104.'; end if;")
w("end $$;")
w("")
w("-- 3 · Reglas ----------------------------------------------------------------------------------------")
reglas_sql = []
orden = {"MA": 0, "PAM": 0}
cuenta = {"MA": "tarjeta_visa_ma", "PAM": "tarjeta_visa_pam"}
tipo_b = {"Comision": "bancarios", "Intereses": "bancarios"}
for t, texto, clave, det in BANCO_REGLAS:
    orden[t] += 1
    ci = "DIST MA" if t == "PAM" else None
    tipo = "impuestos" if any(k in clave for k in ("IIBB", "Iva", "Percepcion", "Sellos")) else "bancarios"
    reglas_sql.append((cuenta[t], orden[t], tipo, texto, clave, det, ci))
SERV = {"Luz Libertad", "Internet Libertad", "Telefono Fijo 812", "Paquete TV MA", "Club La Nación", "Disney Plus",
        "Jockey Club", "Netflix", "Spotify", "Eset (antivirus)", "Omint AMS", "Seguro Chalet"}
for grupo in (SERV, None):
    for t, c, d, texto, n in finales:
        if (grupo is not None) != (d in SERV): continue
        clave = clave_regla(t, d)
        if clave is None: continue
        orden[t] += 1
        ci = ("DIST AMS" if d == "Omint AMS" else "DIST MA") if t == "PAM" else None
        reglas_sql.append((cuenta[t], orden[t], "otras", texto, clave, f"{d} — {c.title()}", ci))
w("insert into public.reglas_conciliacion")
w("  (cuenta_bancaria_id, orden, tipo, columna_busqueda, tipo_match, texto_buscar, template_id, categ, detalle,")
w("   codigo_contable, codigo_interno, llena_template, activo)")
w("select r.cuenta, r.orden, r.tipo, 'descripcion', 'contiene', r.texto, t.id, e.categ, r.detalle, e.codigo_contable, r.ci, true, true")
w("from (values")
w(",\n".join(f"  ({q(a)}, {b}, {q(c)}, {q(d)}, {q(e)}, {q(f)}, {q(g)})" for a, b, c, d, e, f, g in reglas_sql))
w(") as r(cuenta, orden, tipo, texto, clave, detalle, ci)")
w("join t104 t on t.clave = r.clave")
w("join public.egresos_sin_factura e on e.id = t.id;")
w("")
w("do $$ begin")
w(f"  if (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id in ('tarjeta_visa_pam', 'tarjeta_visa_ma')) <> {len(reglas_sql)} then")
w(f"    raise exception 'No quedaron las {len(reglas_sql)} reglas (falta un template de alguna regla): %',")
w("      (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id in ('tarjeta_visa_pam', 'tarjeta_visa_ma'));")
w("  end if;")
w("end $$;")
w("")
w("-- 4 · Contable/interno (Tab 2): tarjeta de MA pagando un template de PAM (2025) → DIST MA ----------------")
w("insert into public.reglas_contable_interno (cuenta_bancaria_id, orden, activo, tipo_regla, responsable, codigo_contable, codigo_interno, descripcion)")
w("values ('tarjeta_visa_ma', 1, true, 'responsable', 'PAM', null, 'DIST MA', '[script 104] tarjeta de MA pagando gasto de MA del año contable de PAM (2025)');")
w("")
w("-- ── Control (antes del commit, se ve en la salida) ──────────────────────────────────────────────")
w("select now() as marca_created_at,")
w("  (select count(*) from public.egresos_sin_factura where observaciones_template like '[script 104]%') as templates,")
w("  (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id = 'tarjeta_visa_pam') as reglas_pam,")
w("  (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id = 'tarjeta_visa_ma') as reglas_ma,")
w("  (select count(*) from public.reglas_contable_interno where descripcion like '[script 104]%') as contable_interno,")
w("  (select count(*) from public.centros_costo where lower(nombre) = 'chalet') as centro_chalet;")
w("-- 🏷️ Toda categ de lo cargado existe en el plan con su tipo (regla de CLAUDE.md § Templates). Tiene que dar 0 filas.")
w("select e.nombre_referencia, e.responsable, e.categ from public.egresos_sin_factura e")
w(" left join public.cuentas_contables c on c.categ = e.categ")
w(" where e.observaciones_template like '[script 104]%' and (c.categ is null or c.tipo is null);")
w("-- 🔗 Cada 2026 apunta a su 2025. Tiene que dar 0 filas.")
w("select e.nombre_referencia from public.egresos_sin_factura e")
w(" where e.observaciones_template like '[script 104]%' and e.responsable = 'MA' and e.año = '2026'")
w("   and e.template_origen_id is null and e.nombre_referencia <> 'Eset (antivirus)';")
w("")
w("commit;")
sql = "\n".join(out) + "\n"
open("scripts/104-carga-tarjetas-ma-pam.sql", "w", encoding="utf-8", newline="\n").write(sql)

for a in avisos: print(a)
print(f"templates nuevos: {n_nuevos} · reglas: {len(reglas_sql)} (PAM {orden['PAM']} · MA {orden['MA']})")
