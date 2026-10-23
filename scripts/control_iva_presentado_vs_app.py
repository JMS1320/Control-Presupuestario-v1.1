"""🧾 A-DAT-61 (2026-10-21) — LIBRO IVA COMPRAS INFORMADO A ARCA vs la APP, por SUBDIARIO. SÓLO LECTURA.

Criterio del usuario: lo informado a ARCA es lo que tiene que estar en la app; toda diferencia es un
error de la app. Lo no informado en ningún período se lista aparte («No incluidas — balance»).

Entrada: la carpeta con los zips que baja ARCA («libro_iva_periodo_AAAAMM_original.zip»: CSV de
compras + XML de la presentación). jul–dic 2025 se compara contra `msa.comprobantes_historico`,
ene–jun 2026 contra `msa.comprobantes_arca`, y diciembre contra los dos. Se cruza por DATOS (número e
importe; si el PV o el número están escritos distinto, por emisor + fecha + importe), no por formato.

Uso:  python scripts/control_iva_presentado_vs_app.py "<carpeta de zips>" "<salida.xlsx>"
Lee la clave de `.env.local` de la carpeta principal del proyecto. No escribe nada en la base.
"""
import sys, re, io, csv, zipfile, glob, os, requests, unicodedata, xml.etree.ElementTree as ET
from collections import Counter
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

carpeta, out = sys.argv[1], sys.argv[2]
env = {}
for l in open(r"D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1/.env.local", encoding="utf-8"):
    m = re.match(r"\s*([A-Z_]+)\s*=\s*(.*)\s*$", l)
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
URL = env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/"; KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
def get(t, p, schema):
    h = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Accept-Profile": schema}
    out, off = [], 0
    while True:
        r = requests.get(URL + t, params={**p, "offset": off, "limit": 1000}, headers=h); r.raise_for_status(); d = r.json(); out += d
        if len(d) < 1000: return out
        off += 1000

HIST = get("comprobantes_historico", {"select": "*"}, "msa")
ARCA = get("comprobantes_arca", {"select": "*"}, "msa")

def f2(x):
    s = str(x or "0").strip()
    if "," in s: s = s.replace(".", "").replace(",", ".")
    return float(s or 0)
def nombre(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]", "", s)[:12]
def ent(x):
    try: return int(float(str(x or 0).replace(",", ".")))
    except: return 0

def leer_zip(p):
    z = zipfile.ZipFile(p)
    n = [i for i in z.namelist() if i.lower().endswith("comprobantes_compras.csv")][0]
    rows = list(csv.DictReader(io.StringIO(z.read(n).decode("latin-1")), delimiter=";"))
    cols = list(rows[0].keys()) if rows else []
    pick = lambda pref: [c for c in cols if c.startswith(pref)][0]
    xmln = [i for i in z.namelist() if i.endswith(".xml")][0]
    x = ET.fromstring(z.read(xmln)); ns = {"a": "http://fisca.afip.gob.ar/xml"}
    cons = x.find("a:iva_compras/a:informacion_consolidada", ns)
    computable = float(cons.find("a:total_computable_global", ns).text) if cons is not None and cons.find("a:total_computable_global", ns) is not None else None
    out = []
    for r in rows:
        out.append({"fecha": r[cols[0]][:10], "tipo": ent(r[pick("Tipo de Comprobante")]), "pv": ent(r[pick("Punto de Venta")]),
                    "nro": ent(r[[c for c in cols if "mero de Comprobante" in c][0]]), "cuit": re.sub(r"\D", "", r[pick("Nro. Doc")]),
                    "den": r[pick("Denominaci")], "total": f2(r["Importe Total"]), "cf": f2(r.get("Crédito Fiscal Computable") or r.get([c for c in cols if c.startswith("Cr")][0]))})
    return out, computable

def norm_app(a, fuente):
    if fuente == "hist":
        return {"id": a["id"], "fecha": str(a.get("fecha") or "")[:10], "tipo": a.get("tipo"), "pv": ent(a.get("punto_de_venta")), "nro": ent(a.get("numero_desde")),
                "cuit": re.sub(r"\D", "", str(a.get("nro_doc_emisor") or "")), "den": a.get("denominacion_emisor"), "total": float(a.get("imp_total") or 0),
                "cuenta": a.get("cuenta_asignada") or a.get("cuenta_contable"), "sub": f'{a.get("mes_contable")}/{a.get("anio_contable")}'}
    return {"id": a["id"], "fecha": str(a.get("fecha_emision") or "")[:10], "tipo": a.get("tipo_comprobante_desc"), "pv": ent(a.get("punto_venta")), "nro": ent(a.get("numero_desde")),
            "cuit": re.sub(r"\D", "", str(a.get("cuit") or "")), "den": a.get("denominacion_emisor"), "total": float(a.get("imp_total") or 0),
            "cuenta": a.get("cuenta_contable"), "sub": f'{a.get("mes_contable")}/{a.get("año_contable")}', "estado": a.get("estado")}

def cruzar(pres, app):
    """Empareja por DATOS, en pasadas de más a menos estricta. Devuelve (pares, sobran_pres, sobran_app)."""
    libres = list(app); pares = []; resto = []
    igual = lambda a, b: abs(abs(a) - abs(b)) < 0.02
    pasadas = [
        ("número e importe", lambda p, a: p["pv"] == a["pv"] and p["nro"] == a["nro"] and igual(p["total"], a["total"])),
        ("número e importe (PV escrito distinto)", lambda p, a: p["nro"] == a["nro"] and igual(p["total"], a["total"])),
        ("emisor, fecha e importe (número escrito distinto)", lambda p, a: igual(p["total"], a["total"]) and p["fecha"] == a["fecha"] and ((p["cuit"] and p["cuit"] == a["cuit"]) or nombre(p["den"])[:8] == nombre(a["den"])[:8])),
        ("MISMO comprobante, IMPORTE DISTINTO", lambda p, a: p["nro"] == a["nro"] and p["pv"] == a["pv"] and p["nro"] != 0),
    ]
    pend = list(pres)
    for etiqueta, ok in pasadas:
        sig = []
        for p in pend:
            m = next((a for a in libres if ok(p, a)), None)
            if m: pares.append((etiqueta, p, m)); libres.remove(m)
            else: sig.append(p)
        pend = sig
    return pares, pend, libres

def donde(p):
    """Un presentado que no está en su subdiario: ¿está en otro lado?"""
    igual = lambda a, b: abs(abs(a) - abs(b)) < 0.02
    r = [f'histórico {norm_app(h,"hist")["sub"]}' for h in HIST if ent(h.get("numero_desde")) == p["nro"] and igual(float(h.get("imp_total") or 0), p["total"])]
    r += [f'app {norm_app(a,"arca")["sub"]}' for a in ARCA if ent(a.get("numero_desde")) == p["nro"] and igual(float(a.get("imp_total") or 0), p["total"])]
    return "; ".join(r) or "en ningún lado"
def donde_app(x):
    r = []
    for per, (pres, _) in PRES.items():
        for p in pres:
            if p["nro"] == x["nro"] and abs(abs(p["total"]) - abs(x["total"])) < 0.02: r.append(f"presentado {per[4:]}/{per[:4]}")
    return "; ".join(r) or "no está en ningún libro presentado"

PRES = {}
for zp in sorted(glob.glob(os.path.join(carpeta, "libro_iva_periodo_*_original.zip"))):
    per = re.search(r"(\d{6})", os.path.basename(zp)).group(1); PRES[per] = leer_zip(zp)


# ═══════════════ REPORTE — lo informado a ARCA es la verdad; la app se corrige ═══════════════
from openpyxl.styles import Alignment
FMT = '#,##0.00;-#,##0.00'
wb = Workbook(); neg = Font(bold=True); hdr = PatternFill("solid", fgColor="DDEBF7")
ROJO, AMAR, VERDE, GRIS = "F8CBAD", "FFF2CC", "E2EFDA", "EDEDED"
def hoja(ws, cab, filas, montos=(), anchos=None, colores=None):
    ws.append(cab)
    for c in ws[ws.max_row]: c.font = neg; c.fill = hdr; c.alignment = Alignment(wrap_text=True, vertical="top")
    ini = ws.max_row
    for i, f in enumerate(filas):
        ws.append(f)
        if colores and colores[i]:
            for c in ws[ws.max_row]: c.fill = PatternFill("solid", fgColor=colores[i])
    for j in montos:
        for c in ws[get_column_letter(j)][ini:]: c.number_format = FMT
    for i, w in enumerate(anchos or [], 1): ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(row=ini + 1, column=1)
    ws.auto_filter.ref = f"A{ini}:{get_column_letter(len(cab))}{ws.max_row}"

detalle, errores, no_incluidas, resumen = [], [], [], []
for per, (pres, computable) in PRES.items():
    anio, mes = int(per[:4]), int(per[4:])
    # La app arma el libro diario así: jul–dic 2025 desde el histórico, ene–jun 2026 desde lo cargado de ARCA.
    contra = [("histórico", "hist")] if (anio, mes) < (2026, 1) else [("app (ARCA)", "arca")]
    if (anio, mes) == (2025, 12): contra = [("histórico", "hist"), ("app (ARCA)", "arca")]
    for nom, fuente in contra:
        base = HIST if fuente == "hist" else ARCA
        ca = ("anio_contable" if fuente == "hist" else "año_contable")
        app = [norm_app(a, fuente) for a in base if a.get(ca) == anio and a.get("mes_contable") == mes]
        pares, faltan, sobran = cruzar(pres, app)
        n_err = 0; cnt = Counter()
        for etiqueta, p, a in pares:
            dif = round(abs(p["total"]) - abs(a["total"]), 2)
            if etiqueta == "número e importe":
                cnt["ok"] += 1; detalle.append([f"{mes:02d}/{anio}", nom, "✓ coincide", p["fecha"], p["den"], p["pv"], p["nro"], p["total"], a["total"], 0, ""])
                continue
            if etiqueta.startswith("MISMO"):
                usd = next((x for x in ARCA if x["id"] == a["id"] and (x.get("moneda") or "PES") not in ("PES", "$")), None)
                if usd:
                    tipo = "Factura en USD cargada en dólares"
                    acc = f'La app tiene USD {float(usd["imp_total"]):,.2f} (TC {float(usd["tipo_cambio"] or 0):,.2f}); ARCA informó ${p["total"]:,.2f}. Corregir: el libro diario tiene que tomar el importe en pesos (A-BUG-1316).'
                else:
                    tipo = "Importe distinto"; acc = "Corregir el importe en la app al de lo informado a ARCA."
            else:
                tipo = "Dato del comprobante distinto (punto de venta / número)"
                acc = f'La app tiene PV {a["pv"]} Nº {a["nro"]}; ARCA informó PV {p["pv"]} Nº {p["nro"]}. Corregir el número en la app.'
            cnt["err"] += 1; n_err += 1
            errores.append([f"{mes:02d}/{anio}", nom, tipo, p["fecha"], p["den"], p["pv"], p["nro"], a["pv"], a["nro"], p["total"], a["total"], dif, acc])
            detalle.append([f"{mes:02d}/{anio}", nom, "⚠ " + tipo, p["fecha"], p["den"], p["pv"], p["nro"], p["total"], a["total"], dif, acc])
        for p in faltan:
            cnt["err"] += 1; n_err += 1
            acc = f"Falta en la app. ¿Dónde aparece? {donde(p)}. Cargarlo en el subdiario {mes:02d}/{anio}."
            errores.append([f"{mes:02d}/{anio}", nom, "Falta en la app (ARCA lo tiene)", p["fecha"], p["den"], p["pv"], p["nro"], None, None, p["total"], None, None, acc])
            detalle.append([f"{mes:02d}/{anio}", nom, "⚠ falta en la app", p["fecha"], p["den"], p["pv"], p["nro"], p["total"], None, None, acc])
        for a in sobran:
            cnt["err"] += 1; n_err += 1
            otro = donde_app(a)
            acc = (f"Sobra en el subdiario {mes:02d}/{anio} de la app: no se informó a ARCA en ese período ({otro}). "
                   "Sacarlo del subdiario (sin borrarlo) y llevarlo a la lista de NO INCLUIDAS para el balance.")
            errores.append([f"{mes:02d}/{anio}", nom, "Sobra en la app (no informado a ARCA)", a["fecha"], a["den"], None, None, a["pv"], a["nro"], None, a["total"], None, acc])
            detalle.append([f"{mes:02d}/{anio}", nom, "⚠ sobra en la app", a["fecha"], a["den"], a["pv"], a["nro"], None, a["total"], None, acc])
            if fuente == "hist" or not any(x[4] == a["nro"] and abs(x[8] - a["total"]) < 0.02 for x in no_incluidas):
                if not any(x[4] == a["nro"] and abs(x[8] - a["total"]) < 0.02 for x in no_incluidas):
                    en_app = any(ent(x.get("numero_desde")) == a["nro"] and abs(abs(float(x.get("imp_total") or 0)) - abs(a["total"])) < 0.02 for x in ARCA)
                    en_hist = any(ent(x.get("numero_desde")) == a["nro"] and abs(abs(float(x.get("imp_total") or 0)) - abs(a["total"])) < 0.02 for x in HIST)
                    no_incluidas.append([f"{mes:02d}/{anio}", a["fecha"], a["tipo"], a["pv"], a["nro"], a["cuit"], a["den"], a.get("cuenta"), a["total"],
                                         "sí" if en_hist else "no", "sí" if en_app else "no", otro,
                                         "Gasto real no informado a ARCA en ningún período. Para el balance: tenerlo en cuenta (provisión / gasto sin crédito fiscal) — lo define el contador."])
        resumen.append([f"{mes:02d}/{anio}", nom, len(pres), len(app), cnt["ok"], n_err, round(sum(p["total"] for p in pres), 2), round(sum(a["total"] for a in app), 2)])

# ── Hoja Resumen
r = wb.active; r.title = "Resumen"
r.append(["Libro IVA Compras: lo INFORMADO A ARCA vs la APP · MSA · ejercicio 25/26"]); r["A1"].font = Font(bold=True, size=13)
r.append(["Criterio: lo informado a ARCA es lo que tiene que estar en la app. Toda diferencia es un ERROR de la app a corregir."])
r.append(["La app arma el libro diario: jul–dic 2025 desde el histórico · ene–jun 2026 desde lo cargado de ARCA. Diciembre se muestra contra las dos."])
r.append([])
cab = ["Período", "Contra", "Cant. informada a ARCA", "Cant. en la app", "Coinciden", "Errores", "Total informado", "Total en la app", "Diferencia", "Control"]
filas = []
for x in resumen:
    n = len(filas) + 6
    filas.append(x + [f"=G{n}-H{n}", f'=IF(AND(F{n}=0,ABS(I{n})<0.02),"✓","⚠ ver Errores")'])
hoja(r, cab, filas, montos=(7, 8, 9), anchos=[9, 12, 12, 11, 10, 9, 17, 17, 15, 14],
     colores=[None if x[5] == 0 else ROJO for x in resumen])
fin = r.max_row
r.append([]); r.append(["TOTAL ejercicio (sin repetir diciembre: contra el histórico)", None,
                        f'=SUMIFS(C6:C{fin},B6:B{fin},"<>app (ARCA)")+SUMIFS(C6:C{fin},A6:A{fin},"<>12/2025",B6:B{fin},"app (ARCA)")', None, None,
                        f"=SUM(F6:F{fin})", f'=SUMIFS(G6:G{fin},B6:B{fin},"<>app (ARCA)")+SUMIFS(G6:G{fin},A6:A{fin},"<>12/2025",B6:B{fin},"app (ARCA)")',
                        f'=SUMIFS(H6:H{fin},B6:B{fin},"<>app (ARCA)")+SUMIFS(H6:H{fin},A6:A{fin},"<>12/2025",B6:B{fin},"app (ARCA)")', f"=G{fin+2}-H{fin+2}"])
for c in r[r.max_row]: c.font = neg
for c in r[r.max_row][6:9]: c.number_format = FMT
r.append([])
r.append(["Cómo leer: «Errores» = comprobantes con diferencia (ver hoja Errores). Los no informados a ARCA están aparte en «No incluidas — balance»."])
r.append(["Lo que la app dice en Diciembre contra el histórico es lo que hoy toma el libro diario (desde el 28/09)."])

# ── Hoja Errores
e = wb.create_sheet("Errores")
cab = ["Período", "Contra", "Tipo de error", "Fecha", "Emisor", "PV informado", "Nº informado", "PV en la app", "Nº en la app", "Total informado", "Total en la app", "Diferencia", "Qué hay que corregir"]
col = {"Factura en USD cargada en dólares": AMAR, "Dato del comprobante distinto (punto de venta / número)": GRIS}
hoja(e, cab, errores, montos=(10, 11, 12), anchos=[9, 11, 30, 11, 34, 9, 11, 9, 11, 15, 15, 13, 70],
     colores=[col.get(x[2], ROJO) for x in errores])
for row in e.iter_rows(min_row=2):
    row[12].alignment = Alignment(wrap_text=True, vertical="top")
e.append([]); e.append(["Errores por tipo", None, None]); e[e.max_row][0].font = neg
for t, n in Counter(x[2] for x in errores).items(): e.append([t, n])

# ── Hoja No incluidas
ni = wb.create_sheet("No incluidas — balance")
ni.append(["Comprobantes que están en el subdiario de la app pero NO se informaron a ARCA en ningún período"]); ni["A1"].font = Font(bold=True, size=12)
ni.append(["No son un error a borrar: son gastos reales que no entraron al IVA. Hay que tenerlos en cuenta para el balance (lo define el contador)."])
ni.append([])
cab = ["Subdiario donde estaban", "Fecha", "Tipo", "PV", "Número", "CUIT", "Emisor", "Cuenta", "Total", "¿En el histórico?", "¿En la app (ARCA)?", "¿En algún libro presentado?", "Nota"]
hoja(ni, cab, no_incluidas, montos=(9,), anchos=[12, 11, 20, 7, 11, 13, 38, 30, 14, 11, 11, 22, 60])
ni.append([None] * 7 + ["TOTAL", f"=SUM(I5:I{ni.max_row})"]); ni[ni.max_row][8].number_format = FMT
for c in ni[ni.max_row]: c.font = neg

# ── Hoja Detalle
d = wb.create_sheet("Detalle completo")
hoja(d, ["Período", "Contra", "Resultado", "Fecha", "Emisor", "PV", "Número", "Total informado", "Total en la app", "Diferencia", "Observación"], detalle,
     montos=(8, 9, 10), anchos=[9, 11, 34, 11, 38, 7, 11, 15, 15, 12, 60],
     colores=[VERDE if x[2].startswith("✓") else ROJO for x in detalle])

wb.save(out)
print("errores:", Counter(x[2] for x in errores)); print("no incluidas:", len(no_incluidas), round(sum(x[8] for x in no_incluidas), 2))
for x in resumen: print(x)
