# -*- coding: utf-8 -*-
"""Ítem 3 — Templates de MSA (lo que no entra por factura: impuestos, gastos bancarios, etc.).

Hojas (en orden de presentación):
  D3 Templates        resumen del ejercicio: tipo → agrupadora → categoría (total · 1er sem · 2do sem)
  D3.1 Meses jul-dic  las mismas filas, mes por mes del 1er semestre
  D3.2 Meses ene-jun  ídem 2do semestre
  D3.3 <tipo>…        el detalle cuota por cuota de cada tipo (Egresos, Financiero…)

Encadenamiento: D3 (semestre) → D3.1/D3.2 (suma de sus 6 meses) → cada mes apunta a la celda del
detalle (la cuota, o el «Total <mes>» que suma sus cuotas). Ninguna fórmula filtra.
"""
import collections
import re

from openpyxl.styles import Alignment

from core import F_LINK, num

GRUPO = "A · Resultado del ejercicio"
LIBRO = "Templates"
MESES = [(2025, 7, "jul-25"), (2025, 8, "ago-25"), (2025, 9, "sep-25"), (2025, 10, "oct-25"),
         (2025, 11, "nov-25"), (2025, 12, "dic-25"), (2026, 1, "ene-26"), (2026, 2, "feb-26"),
         (2026, 3, "mar-26"), (2026, 4, "abr-26"), (2026, 5, "may-26"), (2026, 6, "jun-26")]
ETI = {(a, m): t for a, m, t in MESES}
SEM = [MESES[:6], MESES[6:]]
ESTADO = {"conciliado": "conciliado", "anterior": "pagado (anterior)", "pendiente": "pendiente",
          "nada_a_pagar": "nada a pagar"}
MAX_DETALLE = 250  # una agrupadora con más cuotas que esto va por concepto y por mes
TOL = 0.005


def _ar(v):
    return f"{v:,.2f}".replace(",", "§").replace(".", ",").replace("§", ".")


# Lo ENVIADO al contador (al tipo de cambio comprador) y la diferencia contra el detalle del export (al vendedor).
# JMS 15/11: la tabla principal queda como está; la diferencia va en un anexo al pie con su subtotal.
ENVIADO = {
    "Gastos Bancarios": (3629838.20, 1080.00, "12 débitos de US$ 10 de la cuenta en dólares, $ 9 por dólar"),
    "Impuestos Bancarios": (7502758.61, 2177.46, "impuestos debitados en la cuenta en dólares, pesificados al comprador "
                                                 "en lo enviado y al vendedor en este detalle"),
}
NOMBRE_ITEM = {"(sin agrupadora en el concepto)": "Otros gastos (sin agrupadora) — NO enviado al contador"}
COMP_EXTRA = {"Impuestos Automotores": "Igual a lo enviado; las multas de la Amarok (1.167.757,00) están en 3i Otros gastos."}


# Renglones comparables del balance del contador 24/25 (se leen de «Balance en línea»; fragmento del nombre)
CONTADOR_AGRUP = {"Gastos Bancarios": ["Gastos Bancarios"], "Impuestos Automotores": ["Patente automotor"]}
CONTADOR_CATEG = {
    ("Impuestos General", "Impuestos Laborales ARCA"): ["Cargas Sociales"],
    ("Impuestos General", "Impuesto IIBB"): ["Ingresos Brutos"],
    ("Impuestos Rurales", "Impuesto inmobiliario"): ["Impuesto Inmobiliario"],
    ("Impuestos Rurales", "Impuesto Red Vial"): ["Red Vial"],
}


def _contador(src, fragmentos):
    """Importe (positivo) del balance del contador 24/25: capítulo RESULTADOS, columna «Apertura»."""
    try:
        ws = src.hoja("Balance en l", "Balance en linea")
    except SystemExit:
        return None
    tot = 0.0
    for frag in fragmentos:
        hall = [num(ws.cell(r, 4).value) for r in range(1, ws.max_row + 1)
                if ws.cell(r, 1).value == "RESULTADOS" and frag.lower() in str(ws.cell(r, 3).value or "").lower()]
        if len(hall) != 1:
            return None
        tot += abs(hall[0])
    return round(tot, 2)


def _leer_por_mes(ws):
    """«Por mes» del export: tipos → agrupadoras → categorías, con sus 12 meses y los totales."""
    r0 = next(r for r in range(1, ws.max_row + 1) if ws.cell(r, 1).value == "Responsable")
    tipos, totales, fin = [], {}, None
    tipo = None
    for r in range(r0 + 1, ws.max_row + 1):
        a, b, c = (ws.cell(r, k).value for k in (1, 2, 3))
        nro = ws.cell(r, 18).value
        if isinstance(nro, int) and c:
            cat = dict(nro=nro, agr=str(b), cat=str(c), meses=[num(ws.cell(r, k).value) for k in range(4, 16)],
                       total=num(ws.cell(r, 16).value))
            if not tipo["agrs"] or tipo["agrs"][-1]["nombre"] != cat["agr"]:
                tipo["agrs"].append(dict(nombre=cat["agr"], cats=[]))
            tipo["agrs"][-1]["cats"].append(cat)
        elif isinstance(a, str) and a.startswith("TOTAL DEL EJERCICIO"):
            totales["__todo__"] = dict(meses=[num(ws.cell(r, k).value) for k in range(4, 16)],
                                       total=num(ws.cell(r, 16).value))
            fin = r
            break
        elif isinstance(a, str) and a.startswith("TOTAL ") and tipo:
            totales[tipo["corto"]] = dict(meses=[num(ws.cell(r, k).value) for k in range(4, 16)],
                                          total=num(ws.cell(r, 16).value))
        elif isinstance(a, str) and "—" in a and c is None and not a.lower().startswith(("subtotal", "total")):
            corto = a.split("—")[0].strip().capitalize()
            tipo = dict(titulo=a.strip(), corto=corto, agrs=[])
            tipos.append(tipo)
    extras = []  # lo que el export avisa debajo de sus controles
    solapa_de = {}
    pagado = {}
    for r in range((fin or r0) + 1, ws.max_row + 1):
        v = [ws.cell(r, k).value for k in range(1, 6)]
        t = " ".join(str(x) for x in v if isinstance(x, str))
        m = re.search(r"−\s*(.+?)\s*\(«(.+?)»\)", t)
        if m:
            solapa_de[m.group(1).strip()] = m.group(2)
        if isinstance(v[1], str) and v[1].startswith("⚠️ Extracto SIN"):
            extras.append(("extracto", v[1].replace("⚠️ ", ""), num(ws.cell(r, 4).value)))
        if isinstance(v[0], str) and v[0].startswith("VAN POR LA CUENTA DE UN SOCIO"):
            k = r + 1
            while k <= ws.max_row and ws.cell(k, 2).value:
                extras.append(("socio", "Va por la cuenta de un socio — " + " · ".join(
                    str(ws.cell(k, c).value) for c in (2, 3, 4) if ws.cell(k, c).value), num(ws.cell(k, 5).value)))
                k += 1
        if isinstance(v[1], str) and v[1].capitalize() in [t_["corto"] for t_ in tipos] and isinstance(v[2], (int, float)):
            pagado[v[1].capitalize()] = (num(v[3]), num(v[4]))
    return tipos, totales, extras, solapa_de, pagado


def _leer_cuotas(src):
    """Las cuotas del export, con la ficha que traen las solapas por agrupadora (banco, comprobante, detalle)."""
    ws = src.hoja(LIBRO, "MSA · Cuotas")
    ficha = collections.defaultdict(list)
    for w in src.libro(LIBRO).worksheets:
        if not w.title.startswith("H · MSA ·"):
            continue
        hr = next((r for r in range(1, w.max_row + 1)
                   if w.cell(r, 1).value == "Nro" and w.cell(r, 4).value == "Concepto"), None)
        if not hr:
            continue
        for r in range(hr + 1, w.max_row + 1):
            if not isinstance(w.cell(r, 1).value, int):
                break
            v = [w.cell(r, k).value for k in range(1, 12)]
            ficha[(v[2], v[3], round(num(v[9]), 2), round(num(v[10]), 2))].append((v[4], v[5], v[7]))
    cuotas = collections.defaultdict(list)
    no_incluidas = []
    sin_ficha = 0
    for r in range(2, ws.max_row + 1):
        v = [ws.cell(r, k).value for k in range(1, 13)]
        if isinstance(v[0], str) and v[0].startswith("NO INCLUIDAS"):
            no_incluidas.append(v[0])
        if not isinstance(v[11], int):
            continue
        k = (v[0], v[1], round(num(v[9]), 2), round(num(v[10]), 2))
        if ficha.get(k):
            banco, comp, det = ficha[k].pop(0)
        else:
            banco, comp, det = None, None, None
            sin_ficha += 1
        det = re.sub(r"\s*\[script \d+\]", "", str(det or "")).strip()
        pref = f"{v[1]} — "
        if det.startswith(pref):
            det = det[len(pref):]
        if det == str(v[1]):
            det = ""
        txt = " · ".join(x for x in [det, f"comp. {comp}" if comp else ""] if x)
        cuotas[v[11]].append(dict(fecha=v[0], concepto=v[1], prov=v[2], detalle=txt or None, banco=banco,
                                  cc=v[6], estado=ESTADO.get(v[8], v[8]),
                                  importe=round(num(v[9]) - num(v[10]), 2)))
    return cuotas, no_incluidas, sin_ficha


def _rotulo(h, texto, col=1):
    r = h.fila([None] * (col - 1) + [texto], negrita=True)
    h.celda(col, r).alignment = Alignment(wrap_text=False, vertical="top")
    return r


def construir(lib, src):
    arch = src.nombre(LIBRO)
    tipos, totales, extras, solapa_de, pagado = _leer_por_mes(src.hoja(LIBRO, "MSA · Por mes"))
    cuotas, no_incluidas, sin_ficha = _leer_cuotas(src)

    # ---- hojas, en el orden de presentación ----
    hR = lib.hoja("D3 Templates", [36, 16, 1.5, 16, 16, 24, 16, 13, 9], horizontal=True)
    hS = [lib.hoja("D3.1 Meses jul-dic", [38, 16, 1.5, 15, 15, 15, 15, 15, 15], horizontal=True),
          lib.hoja("D3.2 Meses ene-jun", [38, 16, 1.5, 15, 15, 15, 15, 15, 15], horizontal=True)]
    hD = {}
    for i, t in enumerate(tipos):
        hD[t["corto"]] = lib.hoja(f"D3.{i + 3} {t['corto']}", [10, 27, 21, 32, 17, 14, 13, 15], horizontal=True)

    # letras de sub-ítem: sólo las agrupadoras del gasto (el primer tipo: EGRESOS)
    letra = {}
    for i, a in enumerate(tipos[0]["agrs"]):
        letra[(tipos[0]["corto"], a["nombre"])] = "3" + "abcdefghijklmnopqrstuvwxyz"[i]

    # =============== 1 · DETALLE (se escribe primero: el resumen apunta a sus celdas) ===============
    mcel = {}   # (nro, (año, mes)) -> referencia a la celda del mes en el detalle
    ctot = {}   # nro -> (hoja, fila del «Total categoría»)
    difs = []   # diferencias contra el export, verificadas acá en Python
    resumidas = []
    for t in tipos:
        h = hD[t["corto"]]
        n_hoja = h.nombre.split(" ")[0]
        h.titulo(f"Detalle {n_hoja[1:]} — Templates · {t['corto']}, cuota por cuota (ítem 3)")
        h.nota(f"Fuente: {arch} → «H · MSA · Cuotas» (+ banco, comprobante y detalle de las solapas por agrupadora). "
               f"{t['titulo']}. Cada categoría lista sus cuotas por fecha; cuando un mes tiene más de una, lleva su "
               "«Total <mes>». Ese importe del mes es el que toma el resumen por mes (D3.1 / D3.2), y el «Total "
               "<categoría>» es el que figura en «D3 Templates». Importe = débito − crédito: las devoluciones, "
               "rescates y acreditaciones van entre paréntesis. Estado «pagado (anterior)» = pagado, registrado "
               "antes de que la app conciliara contra el banco; «conciliado» = atado a su movimiento del banco.")
        h.blanco()
        h.encabezado(["Fecha", "Concepto (template)", "A quién", "Detalle y comprobante", "Pagado desde",
                      "Centro de costo", "Estado", "Importe"], repetir=True)
        filas_cat_tipo = []
        for a in t["agrs"]:
            n_cuotas = sum(len(cuotas.get(c["nro"], [])) for c in a["cats"])
            resumir = n_cuotas > MAX_DETALLE
            pref = letra.get((t["corto"], a["nombre"]))
            h.seccion((f"{pref} · " if pref else "") + a["nombre"] + f" — {n_cuotas} cuotas / movimientos")
            if resumir:
                solapa = solapa_de.get(a["nombre"], "la solapa de la agrupadora")
                h.nota(f"Son {n_cuotas} movimientos del extracto: acá va el subtotal por concepto y por mes. El "
                       f"movimiento por movimiento está en el libro Templates → «{solapa}».")
                resumidas.append((a["nombre"], n_cuotas, solapa, h.nombre))
            filas_cat = []
            for c in a["cats"]:
                cs = sorted(cuotas.get(c["nro"], []), key=lambda x: (x["fecha"], str(x["concepto"])))
                por_mes = collections.OrderedDict()
                for q in cs:
                    por_mes.setdefault((q["fecha"].year, q["fecha"].month), []).append(q)
                fuera = [k for k in por_mes if k not in ETI]
                if fuera:
                    lib.pendiente("Templates · cuota fuera del ejercicio",
                                  f"«{c['cat']}» ({a['nombre']}) tiene cuotas con fecha fuera de jul-25 a jun-26: {fuera}",
                                  "No entran en el resumen por mes; el control de la hoja lo va a marcar.", h.nombre)
                _rotulo(h, f"{c['cat']}  ({len(cs)})")
                filas_mes = []
                for k, qs in por_mes.items():
                    eti = ETI.get(k, f"{k[1]:02d}/{k[0]}")
                    if resumir:
                        r = h.fila([None, eti, None, f"{len(qs)} movimientos", None, None, None,
                                    round(sum(q["importe"] for q in qs), 2)])
                    else:
                        r1 = None
                        for q in qs:
                            r = h.fila([q["fecha"], q["concepto"], q["prov"], q["detalle"], q["banco"], q["cc"],
                                        q["estado"], float(q["importe"])])
                            r1 = r1 or r
                        if len(qs) > 1:
                            r = h.fila([None, f"Total {eti}", None, None, None, None, None, h.suma(8, r1, r)],
                                       negrita=True)
                    filas_mes.append(r)
                    mcel[(c["nro"], k)] = h.ref(8, r)
                rt = h.total(f"Total {c['cat']}", {8: h.suma_de(8, filas_mes)})
                ctot[c["nro"]] = (h, rt)
                filas_cat.append(rt)
                # verificación en Python contra «Por mes» del export
                for i, (y, m, eti) in enumerate(MESES):
                    s = round(sum(q["importe"] for q in por_mes.get((y, m), [])), 2)
                    if abs(s - c["meses"][i]) > TOL:
                        difs.append((c["cat"], eti, s, c["meses"][i]))
                s = round(sum(q["importe"] for q in cs), 2)
                if abs(s - c["total"]) > TOL:
                    difs.append((c["cat"], "total", s, c["total"]))
            if len(a["cats"]) > 1:
                h.total(f"Total {a['nombre']}", {8: h.suma_de(8, filas_cat)}, clave=True)
            filas_cat_tipo += filas_cat
            h.blanco()
        rT = h.total(f"TOTAL {t['corto'].upper()} — suma de los totales de categoría", {8: h.suma_de(8, filas_cat_tipo)},
                     clave=True)
        h.control(f"total {t['corto']} del detalle", h.cel(8, rT), totales[t["corto"]]["total"],
                  f"«H · MSA · Por mes», TOTAL {t['corto'].upper()}")

    # =============== 2 · RESUMEN POR MES (dos hojas, una por semestre) ===============
    fila_sem = [dict(), dict()]  # por semestre: clave -> fila   (clave = ('c', nro) | ('a', tipo, agr) | ('t', tipo))
    for s, h in enumerate(hS):
        meses = SEM[s]
        nom = ["1er semestre (jul-25 a dic-25)", "2do semestre (ene-26 a jun-26)"][s]
        h.titulo(f"Detalle 3.{s + 1} — Templates por mes · {nom} (ítem 3)")
        h.nota(f"Fuente: {arch} → «H · MSA · Por mes» y «H · MSA · Cuotas». Las mismas filas de «D3 Templates», "
               "abiertas mes por mes. Cada importe de un mes apunta a la celda del detalle (hojas D3.3 en adelante) "
               "donde están sus cuotas; el total del semestre suma sus 6 meses; cada subtotal suma sus renglones.")
        h.blanco()
        h.encabezado(["Tipo · agrupadora · categoría", f"Total {'1er' if s == 0 else '2do'} semestre", ""]
                     + [m[2] for m in meses], repetir=True)
        cols = [2, 4, 5, 6, 7, 8, 9]
        for t in tipos:
            h.seccion(t["titulo"])
            subs = []
            for a in t["agrs"]:
                r1 = None
                for c in a["cats"]:
                    r = h.r + 1
                    vals = [c["cat"], f"=SUM({h.cel(4, r)}:{h.cel(9, r)})", None]
                    for (y, m, _e) in meses:
                        ref = mcel.get((c["nro"], (y, m)))
                        vals.append(f"={ref}" if ref else 0.0)
                    h.fila(vals, sangria=1)
                    fila_sem[s][("c", c["nro"])] = r
                    r1 = r1 or r
                pref = letra.get((t["corto"], a["nombre"]))
                rs = h.total((f"{pref} · " if pref else "") + f"Total {a['nombre']}", {k: h.suma(k, r1, r) for k in cols})
                fila_sem[s][("a", t["corto"], a["nombre"])] = rs
                subs.append(rs)
            rt = h.total(f"TOTAL {t['corto'].upper()}", {k: h.suma_de(k, subs) for k in cols}, clave=True)
            fila_sem[s][("t", t["corto"])] = rt
            h.blanco()
        for t in tipos:
            i0 = 0 if s == 0 else 6
            h.control(f"{t['corto']} del semestre", h.cel(2, fila_sem[s][("t", t["corto"])]),
                      round(sum(totales[t["corto"]]["meses"][i0:i0 + 6]), 2),
                      f"«H · MSA · Por mes», TOTAL {t['corto'].upper()}, suma de {meses[0][2]} a {meses[5][2]}")

    # =============== 3 · RESUMEN DEL EJERCICIO ===============
    h = hR
    h.titulo("Detalle 3 — Templates de MSA: lo que no entra por factura (ítem 3)")
    pag = " · ".join(f"{k}: pagado {_ar(v[0])}; pendiente al cierre {_ar(v[1])}" for k, v in pagado.items())
    h.nota(f"Fuente: {arch} → «H · MSA · Por mes». Los templates son los egresos que no vienen por factura de "
           "compra (impuestos, gastos e impuestos del banco, tasas) y los movimientos financieros (inversiones, caja, "
           "pago de tarjeta), que NO son gasto y se muestran aparte. Cómo se lee: cada total del ejercicio = 1er "
           "semestre + 2do semestre; cada semestre viene de su hoja por mes (D3.1 / D3.2), y cada mes baja a sus "
           "cuotas en el detalle (columna «Detalle en»). La columna «Total en el detalle» trae el «Total "
           f"<categoría>» de esa hoja: tiene que coincidir. Gastos e impuestos bancarios están acá al tipo de cambio vendedor (como "
           "los trae el detalle); al contador se enviaron al comprador: ver el ANEXO al pie de esta hoja. "
           f"Según el export — {pag}.")
    h.blanco()
    h.encabezado(["Tipo · agrupadora · categoría", "Total ejercicio 25/26", "", "1er semestre (jul–dic 25)",
                  "2do semestre (ene–jun 26)", "Detalle en", "Total en el detalle", "Diferencia", "¿Coincide?"],
                 repetir=True)
    cols = [2, 4, 5, 7]
    fila_tipo, fila_agr, fila_cat = {}, {}, {}

    def cierre(r):
        return {8: f"={h.cel(2, r)}-{h.cel(7, r)}", 9: f'=IF(ABS({h.cel(8, r)})<=0.01,"OK","REVISAR")'}

    for t in tipos:
        h.seccion(t["titulo"])
        subs = []
        for a in t["agrs"]:
            r1 = None
            for c in a["cats"]:
                r = h.r + 1
                hd, rd = ctot[c["nro"]]
                h.fila([c["cat"], f"={h.cel(4, r)}+{h.cel(5, r)}", None,
                        f"={hS[0].ref(2, fila_sem[0][('c', c['nro'])])}",
                        f"={hS[1].ref(2, fila_sem[1][('c', c['nro'])])}",
                        f"{hd.nombre} → fila {rd}", f"={hd.ref(8, rd)}",
                        cierre(r)[8], cierre(r)[9]], sangria=1)
                x = h.celda(6, r)
                x.hyperlink = f"#'{hd.nombre}'!B{rd}"
                x.font = F_LINK
                fila_cat[c["nro"]] = r
                r1 = r1 or r
            pref = letra.get((t["corto"], a["nombre"]))
            rs = h.r + 1
            f = {k: h.suma(k, r1, r) for k in cols}
            f.update(cierre(rs))
            h.total((f"{pref} · " if pref else "") + f"Total {a['nombre']}"
                    + (" (TC vendedor — ver anexo al pie)" if a["nombre"] in ENVIADO else ""), f)
            fila_agr[(t["corto"], a["nombre"])] = rs
            subs.append(rs)
        rt = h.r + 1
        f = {k: h.suma_de(k, subs) for k in cols}
        f.update(cierre(rt))
        h.total(f"TOTAL {t['corto'].upper()}" + (" — ítem 3" if t is tipos[0] else " — no es gasto, no interviene en el resultado"),
                f, clave=True)
        fila_tipo[t["corto"]] = rt
        h.blanco()
    rtodo = h.total("Suma de todos los tipos (sólo para cerrar contra el export; no es un resultado)",
                    {k: h.suma_de(k, list(fila_tipo.values())) for k in cols})
    h.blanco()
    for t in tipos:
        h.control(f"total {t['corto']} del ejercicio", h.cel(2, fila_tipo[t["corto"]]), totales[t["corto"]]["total"],
                  f"«H · MSA · Por mes», TOTAL {t['corto'].upper()}")
    if "__todo__" in totales:
        h.control("todos los tipos", h.cel(2, rtodo), totales["__todo__"]["total"],
                  "«H · MSA · Por mes», TOTAL DEL EJERCICIO (= «H · MSA · Egresos», TOTAL)")
    # controles por agrupadora del gasto, contra el subtotal del export
    ws_pm = src.hoja(LIBRO, "MSA · Por mes")
    sub_export = {}
    for r in range(1, ws_pm.max_row + 1):
        a_ = ws_pm.cell(r, 1).value
        if isinstance(a_, str) and a_.startswith("Subtotal "):
            sub_export.setdefault(a_[9:].strip(), []).append(num(ws_pm.cell(r, 16).value))
    for t in tipos:
        for a in t["agrs"]:
            if len(a["cats"]) > 1:
                cand = [v for v in sub_export.get(a["nombre"], [])
                        if abs(v - sum(c["total"] for c in a["cats"])) <= TOL]
                fuente_v = cand[0] if cand else (sub_export.get(a["nombre"]) or [0.0])[0]
                txt = f"«H · MSA · Por mes», Subtotal {a['nombre']}"
            else:
                fuente_v = a["cats"][0]["total"]
                txt = f"«H · MSA · Por mes», renglón {a['cats'][0]['cat']}"
            h.control(f"{a['nombre']} ({t['corto']})", h.cel(2, fila_agr[(t["corto"], a["nombre"])]), fuente_v, txt)

    # anexo: gastos e impuestos bancarios como se enviaron (TC comprador) + diferencia por tipo de cambio
    h.blanco()
    h.seccion("ANEXO — Gastos e impuestos bancarios: como se enviaron (TC comprador) y la diferencia por tipo de cambio")
    h.nota("Al contador se le enviaron al tipo de cambio comprador. El detalle de este reporte (el export de la app) "
           "está al vendedor. Enviado + diferencia por tipo de cambio = al vendedor, y ese importe tiene que coincidir "
           "con el del resumen de arriba (columna «En este resumen»). Lo enviado y la diferencia van como valor.")
    h.encabezado(["Concepto", "Enviado al contador (TC comprador)", "", "Diferencia por tipo de cambio",
                  "Al TC vendedor (enviado + diferencia)", "De dónde sale", "En este resumen (TC vendedor)",
                  "Diferencia", "¿Coincide?"])
    anexo_env = {}
    filas_anexo = []
    for nombre, (enviado, dif_tc, explica) in ENVIADO.items():
        partes = [(t, a) for t in tipos for a in t["agrs"] if a["nombre"] == nombre]
        if not partes:
            continue
        filas_res = [fila_agr[(t["corto"], a["nombre"])] for t, a in partes]
        en_resumen = round(sum(c["total"] for _t, a in partes for c in a["cats"]), 2)
        donde = " + ".join((letra.get((t["corto"], nombre)) or ", ".join(c["cat"] for c in a["cats"]) + f" (en {t['corto']})")
                           + " " + _ar(sum(c["total"] for c in a["cats"])) for t, a in partes)
        r = h.r + 1
        h.fila([nombre, float(enviado), None, float(dif_tc), f"={h.cel(2, r)}+{h.cel(4, r)}",
                f"{explica}. En el resumen: {donde}", h.suma_de(2, filas_res),
                f"={h.cel(5, r)}-{h.cel(7, r)}", f'=IF(ABS({h.cel(8, r)})<=0.01,"OK","REVISAR")'])
        filas_anexo.append(r)
        anexo_env[nombre] = (enviado, dif_tc, en_resumen, r)
    if filas_anexo:
        rta = h.r + 1
        f = {k: h.suma(k, filas_anexo[0], filas_anexo[-1]) for k in (2, 4, 5, 7)}
        f.update(cierre(rta))
        f[8] = f"={h.cel(5, rta)}-{h.cel(7, rta)}"
        h.total("Total gastos e impuestos bancarios", f)
        for nombre, (enviado, dif_tc, en_resumen, r) in anexo_env.items():
            h.control(f"{nombre}: enviado + diferencia por TC", h.cel(5, r), en_resumen,
                      f"«H · MSA · Por mes», {nombre} (todos los tipos)")
            if abs(enviado + dif_tc - en_resumen) > TOL:
                lib.pendiente("Templates · anexo de tipo de cambio no cierra",
                              f"{nombre}: enviado {_ar(enviado)} + diferencia {_ar(dif_tc)} = {_ar(enviado + dif_tc)} y el "
                              f"resumen da {_ar(en_resumen)}", "El control del anexo lo marca REVISAR.", "D3 Templates, anexo")

    # lo que el export deja afuera de estos totales (informativo)
    h.blanco()
    h.seccion("Fuera de estos totales — lo avisa el export (informativo, no suma arriba)")
    for tipo_x, texto, valor in extras:
        r = h.fila([texto, float(valor),
                    "no entra en ningún control del libro Templates: ver «H · MSA · Extracto sin categ»"
                    if tipo_x == "extracto" else "no es gasto: va por la cuenta corriente del socio"])
        h.ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=10)
    for texto in no_incluidas:
        r = h.fila([texto])
        h.ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=10)
        h.celda(1, r).alignment = Alignment(wrap_text=False, vertical="top")

    # =============== 4 · ÍTEMS ===============
    t0 = tipos[0]
    lib.item("3", "Templates — egresos que no entran por factura (impuestos, gastos bancarios y otros)", hR,
             h.cel(2, fila_tipo[t0["corto"]]), GRUPO,
             "Suma de las agrupadoras 3a, 3b… (D3 Templates); cada una baja a sus categorías, por mes "
             "(D3.1 / D3.2) y a sus cuotas (D3.3).", None)
    for a in t0["agrs"]:
        n = letra[(t0["corto"], a["nombre"])]
        comp = "Categorías: " + ", ".join(c["cat"] for c in a["cats"])
        if a["nombre"] in anexo_env:
            env, dtc, enres, _r = anexo_env[a["nombre"]]
            propio = sum(c["total"] for c in a["cats"])
            comp += (f". Al TC vendedor; enviado al comprador: {_ar(env)} (diferencia por TC {_ar(dtc)}"
                     + (f"; lo enviado incluye {_ar(enres - propio)} de «"
                        + ", ".join(c["cat"] for t in tipos[1:] for x in t["agrs"] if x["nombre"] == a["nombre"]
                                    for c in x["cats"]) + "», que acá va en otro grupo (Financiero)"
                        if abs(enres - propio) > TOL else "") + "). Ver anexo al pie de D3 Templates.")
        if a["nombre"] in COMP_EXTRA:
            comp += ". " + COMP_EXTRA[a["nombre"]]
        cont = _contador(src, CONTADOR_AGRUP[a["nombre"]]) if a["nombre"] in CONTADOR_AGRUP else None
        lib.item(n, NOMBRE_ITEM.get(a["nombre"], a["nombre"]), hR, h.cel(2, fila_agr[(t0["corto"], a["nombre"])]), GRUPO,
                 comp, cont)
        k = 0
        for c in a["cats"]:
            frag = CONTADOR_CATEG.get((a["nombre"], c["cat"]))
            if frag:
                k += 1
                lib.item(f"{n}{k}", f"{a['nombre']} · {c['cat']}", hR, h.cel(2, fila_cat[c["nro"]]), GRUPO,
                         "Renglón de categoría; comparable con el balance del contador: " + " + ".join(frag),
                         _contador(src, frag))

    # =============== 5 · PENDIENTES ===============
    for cat, donde, nuestro, export in difs:
        lib.pendiente("Templates · no cierra contra el export",
                      f"«{cat}» {donde}: las cuotas suman {_ar(nuestro)} y «Por mes» dice {_ar(export)} "
                      f"(diferencia {_ar(nuestro - export)})", "El control de la hoja lo marca REVISAR.", "D3 Templates")
    for nombre, n, solapa, hoja in resumidas:
        lib.pendiente("Templates · forma: detalle resumido por mes",
                      f"«{nombre}» tiene {n} movimientos del extracto: en el reporte va el subtotal por concepto y por "
                      f"mes (como valor, sin sus renglones). El movimiento por movimiento está en el libro Templates → «{solapa}».",
                      "El último nivel de esa agrupadora no está a la vista en el reporte.", hoja)
    if sin_ficha:
        lib.pendiente("Templates · cuotas sin ficha completa",
                      f"{sin_ficha} cuota(s) de «H · MSA · Cuotas» no se encontraron en las solapas por agrupadora: "
                      "van sin banco, comprobante ni detalle.", "Sólo de forma: el importe está.", "D3.3 en adelante")
    for tipo_x, texto, valor in extras:
        if tipo_x == "extracto":
            lib.pendiente("Templates · extracto sin categoría", f"{texto}: {_ar(valor)}",
                          "Movimientos del banco que no están en ningún control del libro Templates; pueden incluir "
                          "gasto sin registrar.", "D3 Templates (sección «Fuera de estos totales»)")
        else:
            lib.pendiente("Templates · pagos que van por la cuenta de un socio", f"{texto}: {_ar(valor)}",
                          "No son gasto de MSA: revisar que estén en la cuenta del socio.",
                          "D3 Templates (sección «Fuera de estos totales»)")
    ceros = [f"{c['cat']} ({a['nombre']})" for t in tipos for a in t["agrs"] for c in a["cats"]
             if any(q["estado"] == "pendiente" for q in cuotas.get(c["nro"], []))]
    if ceros:
        lib.pendiente("Templates · cuotas en estado «pendiente» dentro del ejercicio",
                      "Categorías con cuotas todavía pendientes (el export las trae con su importe, en general 0): "
                      + "; ".join(sorted(set(ceros))),
                      "Si alguna se pagó y no se cargó, falta gasto.", "D3.3 Egresos / D3.4 Financiero")

    print(f"[d_templates] cuotas {sum(len(v) for v in cuotas.values())} · diferencias contra «Por mes»: {len(difs)} · "
          f"sin ficha: {sin_ficha} · " + " · ".join(f"{k}: {v['total']:,.2f}" for k, v in totales.items()))
