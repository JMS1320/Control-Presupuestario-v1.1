# -*- coding: utf-8 -*-
"""Ítem 4 — Sueldos. Hoja «D4 Sueldos».

1) PAGADO por persona y por mes de pago (por banco / por caja), en dos tablas por semestre  → ítem 4.
2) DEVENGADO por persona y por mes de sueldo: cada celda apunta al renglón del detalle de más abajo.
3) Detalle mes por mes: cada empleado con cómo se compone su bruto; subtotal por mes; total = suma de los 12.
4) Sueldos a pagar al cierre (informativo: es deuda, no resultado).

Lo pagado (1) NO sale de un libro exportado por la app: es `sueldos/pagos_por_mes.json` (pagos por banco del
sistema, extracto del Galicia para jul–dic 25 y planilla de la Caja Sigot). Va como valor, con su control.
"""
from openpyxl.styles import Border as _Border, Side as _Side
import collections
import json
import os
import re
import unicodedata

from openpyxl.styles import Alignment

from core import num

GRUPO = "A · Resultado del ejercicio"
LIBRO = "Sueldos"
MES = {"01": "ene", "02": "feb", "03": "mar", "04": "abr", "05": "may", "06": "jun",
       "07": "jul", "08": "ago", "09": "sep", "10": "oct", "11": "nov", "12": "dic"}
MODALIDAD = {"plano_ipc": "fijo (IPC)", "por_hora_ipc": "por hora (IPC)", "ab_francos": "A + B + francos",
             "por_dia": "por día"}
EMPRESA = {"MSA/PAM/MA": "las tres"}
TOL = 0.005
# Totales del informe de sueldos pagados (scratchpad/sueldos/informe.md), para el control del cuadro 1
PAGADO_TOTAL, PAGADO_BANCO, PAGADO_CAJA = 142986985.92, 121460154.92, 21526831.00
FIJOS = {"sigot", "barreto", "coria"}      # los empleados de MSA que JMS quiere arriba, con Mercedes Areco
MA_DETALLE = ("MSA", "MA")                 # (empresa, empleado) con que el export trae el sueldo de Mercedes Areco
MA_ROTULO = "Sueldo de Mercedes Areco: no se paga, se acredita en su cuenta con MSA (ver D10)"
GRUPOS = [("g1", "Empleados de MSA"), ("g2", "Aparte — otros de MSA (jornales, temporarios y bajas)"),
          ("g3", "Aparte — de otras empresas (MA y PAM)"), ("g4", "José y Andrés (honorarios)")]


def _ar(v):
    return f"{v:,.2f}".replace(",", "§").replace(".", ",").replace("§", ".")


def _eti(p):
    return f"{MES.get(p[5:7], p[5:7])}-{p[2:4]}"


def _tokens(s):
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return set(re.findall(r"[a-z0-9]+", s))


def _contador(src, frag):
    try:
        ws = src.hoja("Balance en l", "Balance en linea")
    except SystemExit:
        return None
    hall = [num(ws.cell(r, 4).value) for r in range(1, ws.max_row + 1)
            if ws.cell(r, 1).value == "RESULTADOS" and frag.lower() in str(ws.cell(r, 3).value or "").lower()]
    return round(abs(hall[0]), 2) if len(hall) == 1 else None


def _leer_export(ws):
    r0 = next(r for r in range(1, ws.max_row + 1) if ws.cell(r, 1).value == "Período" and ws.cell(r, 3).value == "Empleado")
    filas, tot_src = [], None
    r = r0 + 1
    while r <= ws.max_row:
        v = [ws.cell(r, k).value for k in range(1, 18)]
        if v[0] == "TOTAL":
            tot_src = v
            break
        if isinstance(v[0], str) and re.match(r"^\d{4}-\d{2}$", v[0]):
            filas.append(dict(per=v[0], emp=str(v[1]), nombre=str(v[2]), tipo=v[3], a=num(v[4]), b=num(v[5]),
                              alim=num(v[6]), francos=num(v[7]), vfranco=num(v[8]), pfrancos=num(v[9]),
                              jornal=num(v[10]), extras=num(v[11]), bruto=num(v[12]), recalc=num(v[13]),
                              pagado=num(v[15]), saldo=num(v[16])))
        r += 1
    por_mes_src, aviso, a_pagar, a_pagar_tot, efectivo = {}, [], [], None, None
    r += 1
    while r <= ws.max_row:
        a = ws.cell(r, 1).value
        if isinstance(a, str):
            if re.match(r"^\d{4}-\d{2}$", a) and isinstance(ws.cell(r, 4).value, (int, float)) and ws.cell(r, 5).value is None:
                por_mes_src[a] = (num(ws.cell(r, 2).value), num(ws.cell(r, 3).value), num(ws.cell(r, 4).value))
            elif a.startswith("ATENCION"):
                aviso.append(a)
            elif a.startswith("SUELDOS A PAGAR AL CIERRE"):
                k = r + 2
                while k <= ws.max_row and ws.cell(k, 1).value and not str(ws.cell(k, 1).value).startswith("TOTAL"):
                    a_pagar.append([ws.cell(k, c).value for c in range(1, 7)])
                    k += 1
                a_pagar_tot = num(ws.cell(k, 5).value)
                r = k
            elif a.startswith("Pagados en efectivo"):
                efectivo = a
        r += 1
    return filas, tot_src, por_mes_src, aviso, a_pagar, a_pagar_tot, efectivo


def _personas(src, filas, periodos):
    """Las personas de los cuadros: las del JSON de pagos + Mercedes Areco + quien esté sólo en el export."""
    ruta = os.path.join(src.carpeta, "sueldos", "pagos_por_mes.json")
    datos = None
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as f:
            datos = json.load(f)
    en_export = list(collections.OrderedDict(((f["emp"], f["nombre"]), 1) for f in filas))
    libres = [k for k in en_export if k != MA_DETALLE]
    personas = [dict(key="ma", label=MA_ROTULO, grupo="g1", banco=[0.0] * 12, caja=[0.0] * 12,
                     det=MA_DETALLE if MA_DETALLE in en_export else None, largo=True)]
    if datos:
        idx = [datos["meses"].index(p) if p in datos["meses"] else None for p in periodos]
        for i, p in enumerate(datos["personas"]):
            tk = _tokens(p["nombre"])
            cand = sorted([k for k in libres if _tokens(k[1]) <= tk], key=lambda k: -len(_tokens(k[1])))
            det = cand[0] if cand else None
            if det:
                libres.remove(det)
            g = {"aparte": "g3", "socios": "g4"}.get(p["grupo"], "g1" if tk & FIJOS and "repartir" not in tk else "g2")
            personas.append(dict(key=f"p{i}", label=p["nombre"], grupo=g, det=det, largo=False,
                                 banco=[float(p["banco"][j]) if j is not None else 0.0 for j in idx],
                                 caja=[float(p["caja"][j]) if j is not None else 0.0 for j in idx]))
    for i, k in enumerate(libres):  # en el export y sin pagos en el JSON: no se pierde
        personas.append(dict(key=f"x{i}", label=f"{k[1]} ({k[0]}) — sólo en el sistema", grupo="g2", det=k,
                             largo=False, banco=[0.0] * 12, caja=[0.0] * 12))
    return personas, datos is not None, ruta


def _tabla(h, s, periodos, personas, lineas_de, prev, rotulo_total):
    """Una tabla persona × 6 meses de un semestre. Devuelve las filas (por persona, por grupo, por línea)."""
    meses = periodos[s * 6:s * 6 + 6]
    h.encabezado(["Persona", "", ""] + [_eti(p) for p in meses]
                 + [f"Total {'1er' if s == 0 else '2do'} semestre", "Total ejercicio" if s == 1 else "", ""])
    cols = list(range(4, 11)) + ([11] if s == 1 else [])
    out = dict(p={}, g={}, lin={}, medio=collections.defaultdict(list))

    def cola(r, clave_prev):
        v = [f"=SUM({h.cel(4, r)}:{h.cel(9, r)})"]
        if s == 1:
            v.append(f"={h.cel(10, clave_prev)}+{h.cel(10, r)}")
        return v

    for gk, gtitulo in GRUPOS:
        ps = [p for p in personas if p["grupo"] == gk]
        if not ps:
            continue
        r = h.fila([gtitulo], negrita=True)
        h.celda(1, r).alignment = Alignment(wrap_text=False, vertical="top")
        tot_rows = []
        for p in ps:
            lin = lineas_de(p)
            filas_l = []
            for j, (medio, vals) in enumerate(lin):
                r = h.r + 1
                # el nombre va en TODOS los renglones de la persona (JMS 16/11: con el nombre sólo en el primero, el «por caja»
                # y el «total» parecían de la persona siguiente)
                h.fila([p["label"], None if p["largo"] else medio, None]
                       + [float(x) for x in vals[s * 6:s * 6 + 6]] + cola(r, prev["lin"][(p["key"], j)] if prev else None),
                       sangria=0)
                if p["largo"]:
                    h.ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
                    h.ws.row_dimensions[r].height = 39
                out["lin"][(p["key"], j)] = r
                out["medio"][medio].append(r)
                filas_l.append(r)
            if len(filas_l) > 1:
                r = h.r + 1
                h.fila([p["label"], "total", None] + [f"={h.cel(c, filas_l[0])}+{h.cel(c, filas_l[1])}" for c in range(4, 10)]
                       + cola(r, prev["p"][p["key"]] if prev else None), negrita=True)
            out["p"][p["key"]] = r
            for c in range(1, h.ncols + 1):  # una línea marcada cierra el bloque de cada persona
                h.celda(c, r).border = _Border(bottom=_Side(style="thin", color="1F3864"))
            tot_rows.append(r)
        out["g"][gk] = h.total(f"Subtotal {gtitulo}", {c: h.suma_de(c, tot_rows) for c in cols})
        if gk == "g2" and "g1" in out["g"]:
            out["g"]["msa"] = h.total("Total empleados de MSA (los dos subtotales de arriba)",
                                      {c: f"={h.cel(c, out['g']['g1'])}+{h.cel(c, out['g']['g2'])}" for c in cols})
    partes = [out["g"][k] for k in (("msa",) if "msa" in out["g"] else ("g1", "g2")) + ("g3", "g4") if k in out["g"]]
    out["total"] = h.total(rotulo_total, {c: h.suma_de(c, partes) for c in cols}, clave=True)
    out["cols"] = cols
    return out


def construir(lib, src):
    ws = src.hoja(LIBRO, "13 Sueldos")
    arch = src.nombre(LIBRO)
    filas, tot_src, por_mes_src, aviso, a_pagar, a_pagar_tot, efectivo = _leer_export(ws)
    periodos = sorted({f["per"] for f in filas})
    personas, hay_pagos, ruta_json = _personas(src, filas, periodos)
    dev = collections.defaultdict(float)
    pag_sis = collections.defaultdict(float)
    for f in filas:
        dev[(f["emp"], f["nombre"])] += f["bruto"]
        pag_sis[(f["emp"], f["nombre"])] += f["pagado"]

    h = lib.hoja("D4 Sueldos", [17, 8, 10, 13, 13, 13, 13, 13, 14.5, 13, 14.5, 8], horizontal=True)
    h.titulo("Detalle 4 — Sueldos: lo pagado y lo devengado, por persona y por mes (ítem 4)")
    h.nota("Qué muestra: (1) lo PAGADO a cada persona, por mes de pago, separado en banco y caja; (2) lo DEVENGADO "
           "según el sistema, por mes de sueldo; (3) el detalle mes por mes de cómo se compone cada bruto; (4) los "
           "sueldos a pagar al cierre. Cada total suma las celdas que tiene arriba; el total del ejercicio es 1er "
           "semestre + 2do semestre.")

    # ================= 1 · PAGADO, por fecha de pago =================
    t1 = None
    if hay_pagos:
        def lineas_pagado(p):
            lin = [(m, p[k]) for m, k in (("por banco", "banco"), ("por caja", "caja")) if any(abs(x) > TOL for x in p[k])]
            return lin or [("—", [0.0] * 12)]

        h.blanco()
        h.seccion("1 · PAGADO, por fecha de pago — por persona y por mes (ítem 4)")
        h.nota("Fuente: informe de sueldos pagados (sueldos/pagos_por_mes.json), armado con: los pagos por banco "
               "cargados en el sistema desde enero de 2026 y los de José y Andrés; el extracto del Galicia para julio "
               "a diciembre de 2025; y la planilla de la Caja Sigot para el efectivo (por la fecha de la planilla). "
               "Los 23 pagos por caja que estaban en el sistema y en la planilla se cuentan una sola vez. No es un "
               "libro exportado por la app: los importes de cada mes van como valor y abajo está el control de la "
               "suma. Por persona: un renglón «por banco», otro «por caja» y su total.")
        h.nota("1er semestre — pagado de julio a diciembre de 2025")
        t1a = _tabla(h, 0, periodos, personas, lineas_pagado, None, "TOTAL PAGADO — 1er semestre")
        h.blanco()
        h.nota("2do semestre — pagado de enero a junio de 2026, y total del ejercicio (1er + 2do semestre)")
        t1 = _tabla(h, 1, periodos, personas, lineas_pagado, t1a, "TOTAL PAGADO EN EL EJERCICIO (ítem 4)")
        rb = h.total("  de lo cual por banco", {c: h.suma_de(c, t1["medio"]["por banco"]) for c in t1["cols"]})
        rc = h.total("  de lo cual por caja", {c: h.suma_de(c, t1["medio"]["por caja"]) for c in t1["cols"]})
        h.control("total pagado en el ejercicio", h.cel(11, t1["total"]), PAGADO_TOTAL, "informe de sueldos pagados, total")
        h.control("pagado por banco", h.cel(11, rb), PAGADO_BANCO, "informe de sueldos pagados, banco")
        h.control("pagado por caja", h.cel(11, rc), PAGADO_CAJA, "informe de sueldos pagados, caja")
        msa_pag = sum(sum(p["banco"]) + sum(p["caja"]) for p in personas if p["grupo"] in ("g1", "g2"))
        msa_dev = sum(dev[p["det"]] for p in personas if p["grupo"] in ("g1", "g2") and p["det"] and p["key"] != "ma")
        h.nota(f"Por qué lo pagado a empleados de MSA ({_ar(msa_pag)}) supera a lo devengado en el sistema "
               f"({_ar(msa_dev)}, sin Mercedes Areco): el sistema no tiene cargado el sueldo de julio a diciembre de "
               "2025 de Sigot, Coria, Cejas ni Pucheta. Elvio Paz y Fabián Vulcano cobran en efectivo por la Caja "
               "Sigot: lo real es lo pagado; el devengado del sistema es un estimado. «Por banco» incluye lo que "
               "pagó otra cuenta (PAM a José, Andrés y Mabel; Santander MSA a Andrés).")

    # ================= 2 · DEVENGADO, por mes de sueldo (las celdas se llenan después del detalle) =================
    h.blanco()
    h.seccion("2 · DEVENGADO según el sistema, por mes de sueldo — cada importe apunta a su renglón del detalle (punto 3)")
    h.nota(f"Fuente: {arch} → «13 Sueldos» (el bruto guardado de cada período). Mismas personas y grupos que el "
           "cuadro de pagos. Una celda vacía = ese mes no tiene sueldo cargado para esa persona.")
    h.nota("1er semestre — sueldos de julio a diciembre de 2025")
    t2a = _tabla(h, 0, periodos, personas, lambda p: [("", [0.0] * 12)], None, "TOTAL DEVENGADO — 1er semestre")
    h.blanco()
    h.nota("2do semestre — sueldos de enero a junio de 2026, y total del ejercicio")
    t2 = _tabla(h, 1, periodos, personas, lambda p: [("", [0.0] * 12)], t2a, "TOTAL DEVENGADO EN EL EJERCICIO")
    r_ctrl_dev = h.control("total devengado por persona", h.cel(11, t2["total"]), num(tot_src[12]),
                           "«13 Sueldos», renglón TOTAL, BRUTO")
    h.blanco()
    h.nota("Devengado contra lo que el sistema tiene como pagado (según el export; no incluye los pagos que sólo "
           "están en el extracto o en la planilla de caja)")
    h.encabezado(["Persona", "", "", "Devengado (cuadro de arriba)", "Pagado según el sistema",
                  "Sin pago cargado en el sistema", "", "", "", "", "", ""])
    r1 = None
    for p in personas:
        r = h.r + 1
        h.fila([p["label"], None, None, f"={h.cel(11, t2['p'][p['key']])}", float(round(pag_sis[p["det"]], 2)) if p["det"] else 0.0,
                f"={h.cel(4, r)}-{h.cel(5, r)}"])
        if p["largo"]:
            h.ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
            h.ws.row_dimensions[r].height = 39
        r1 = r1 or r
    rps = h.total("Total", {c: h.suma(c, r1, r) for c in (4, 5, 6)})
    h.control("pagado según el sistema", h.cel(5, rps), num(tot_src[15]), "«13 Sueldos», renglón TOTAL, Pagado")

    # ================= 3 · DETALLE mes por mes =================
    h.blanco()
    h.seccion("3 · DETALLE — cómo se compone el bruto de cada empleado, mes por mes")
    alim = sum(f["alim"] for f in filas)
    h.nota(f"Fuente: {arch} → «13 Sueldos». Un renglón por empleado y por mes: categoría A, categoría B, francos, "
           "jornal y extras. El bruto es el que guardó la app; al lado va el que la app recompone desde sus partes: si "
           "no coinciden, «Control» dice REVISAR. Empresa «las tres» = compartido entre MSA, PAM y MA. "
           + ("La cuota alimentaria está adentro de la categoría A y en este ejercicio es 0." if abs(alim) < TOL else
              f"La cuota alimentaria ({_ar(alim)}) está adentro de la categoría A: no se suma al bruto."))
    h.encabezado(["Empleado", "Empresa", "Modalidad", "Categoría A", "Categoría B", "Por francos", "Por jornal",
                  "Extras", "BRUTO", "Recompuesto por la app", "Diferencia", "Control"], repetir=True)
    cols = [4, 5, 6, 7, 8, 9]
    campo = {4: "a", 5: "b", 6: "pfrancos", 7: "jornal", 8: "extras", 9: "bruto"}
    tot_mes, celda_bruto, revisar, difs = [], {}, [], []
    for p in periodos:
        fs = [f for f in filas if f["per"] == p]
        h.seccion(f"{_eti(p)} — {len(fs)} empleados")
        r1 = None
        for f in fs:
            r = h.r + 1
            mod = MODALIDAD.get(f["tipo"], str(f["tipo"]))
            if f["francos"]:
                mod += " · " + f"{f['francos']:g}".replace(".", ",") + " fr."
            h.fila([f["nombre"], EMPRESA.get(f["emp"], f["emp"]), mod, f["a"], f["b"], f["pfrancos"], f["jornal"],
                    f["extras"], f["bruto"], f["recalc"], f"={h.cel(10, r)}-{h.cel(9, r)}",
                    f'=IF(ABS({h.cel(11, r)})<={TOL},"OK","REVISAR")'])
            celda_bruto[(p, f["emp"], f["nombre"])] = r
            r1 = r1 or r
            if abs(f["recalc"] - f["bruto"]) > TOL:
                revisar.append(f)
        tot_mes.append(h.total(f"Total {_eti(p)}", {k: h.suma(k, r1, r) for k in cols}))
        if p in por_mes_src:  # verificación en Python contra el bloque «POR MES» del export
            sa, sb, sbr = (round(sum(f[k] for f in fs), 2) for k in ("a", "b", "bruto"))
            for nom, nuestro, exp in (("categoría A", sa, por_mes_src[p][0]), ("categoría B", sb, por_mes_src[p][1]),
                                      ("bruto", sbr, por_mes_src[p][2])):
                if abs(nuestro - exp) > TOL:
                    difs.append((p, nom, nuestro, exp))
    h.blanco()
    rT = h.total("TOTAL DEVENGADO DEL EJERCICIO — suma de los 12 meses", {k: h.suma_de(k, tot_mes) for k in cols},
                 clave=True)
    src_col = {4: 4, 5: 5, 6: 9, 7: 10, 8: 11, 9: 12}
    nombres = {4: "categoría A", 5: "categoría B", 6: "por francos", 7: "por jornal", 8: "extras", 9: "BRUTO"}
    for k in (9, 4, 5, 6, 7, 8):
        h.control(f"total {nombres[k]}", h.cel(k, rT), num(tot_src[src_col[k]]), "«13 Sueldos», renglón TOTAL")
        s_ = round(sum(f[campo[k]] for f in filas), 2)
        if abs(s_ - num(tot_src[src_col[k]])) > TOL:
            difs.append(("ejercicio", nombres[k], s_, num(tot_src[src_col[k]])))

    # ---- ahora sí: las celdas del cuadro 2 apuntan a los renglones del detalle ----
    for p in personas:
        for s_i, t in enumerate((t2a, t2)):
            r = t["lin"][(p["key"], 0)]
            for i, per in enumerate(periodos[s_i * 6:s_i * 6 + 6]):
                rd = celda_bruto.get((per,) + p["det"]) if p["det"] else None
                h.celda(4 + i, r).value = f"={h.cel(9, rd)}" if rd else None
    sin_cuadro = [k for k in celda_bruto if (k[1], k[2]) not in [p["det"] for p in personas]]
    if sin_cuadro:
        lib.pendiente("Sueldos · renglones del detalle que no entraron al cuadro por persona", str(sin_cuadro),
                      "El control del cuadro 2 lo va a marcar REVISAR.", "D4 Sueldos")

    # ================= 4 · a pagar al cierre (informativo) =================
    if a_pagar:
        h.blanco()
        h.seccion("4 · Sueldos a pagar al cierre — devengados en el ejercicio y pagados después (informativo: es "
                  "deuda, ya está adentro del devengado)")
        h.encabezado(["Empleado", "Período", "", "Bruto", "Pagado al cierre", "", "Pagado después", "Fecha del pago",
                      "", "", "", ""])
        r1 = None
        for v in a_pagar:
            r = h.fila([str(v[1]), _eti(str(v[0])), None, num(v[2]), num(v[3]), None, num(v[4]), v[5]])
            r1 = r1 or r
        rp = h.total("Total a pagar al cierre", {7: h.suma(7, r1, r)})
        if a_pagar_tot is not None:
            h.control("sueldos a pagar al cierre", h.cel(7, rp), a_pagar_tot, "«13 Sueldos», TOTAL A PAGAR AL CIERRE")
        if efectivo:
            h.nota("Según el export — " + efectivo)

    # ================= ítems =================
    cont = _contador(src, "Sueldos")
    ma_dev_cel = h.cel(11, t2["p"]["ma"])
    if t1:
        lib.item("4", "Sueldos — pagado en el ejercicio (por fecha de pago)", h, h.cel(11, t1["total"]), GRUPO,
                 "Empleados de MSA (4a) + aparte de otras empresas (4b) + José y Andrés (4c); cada persona = por banco "
                 "+ por caja, mes por mes. Fuente: pagos del sistema, extracto del Galicia (jul–dic 25) y Caja Sigot.",
                 cont)
        lib.item("4a", "Sueldos pagados · Empleados de MSA", h, h.cel(11, t1["g"]["msa"]), GRUPO,
                 "Sigot, Barreto y Coria + aparte de MSA (Elvio Paz, Fabián Vulcano, Manuel Martínez, Pucheta, Cejas "
                 "y el pago sin repartir). Mercedes Areco figura con pagado 0.", None)
        lib.item("4b", "Sueldos pagados · Aparte, de otras empresas (Alondra Olivo de MA, Celia Mabel Rojas de PAM)",
                 h, h.cel(11, t1["g"]["g3"]), GRUPO, "Por banco + por caja.", None)
        lib.item("4c", "Sueldos pagados · José y Andrés (honorarios)", h, h.cel(11, t1["g"]["g4"]), GRUPO,
                 "Pagos por banco del sistema, por fecha de pago (incluye lo que pagó PAM y el Santander).", None)
        lib.item("4d", "Sueldos — bruto devengado según el sistema", h, h.cel(9, rT), GRUPO,
                 "Suma de los 12 totales de mes del detalle (categoría A + B + francos + jornal + extras). Incluye el "
                 "sueldo de Mercedes Areco (4e) y no tiene jul–dic 25 de Sigot, Coria, Cejas ni Pucheta.", None)
        lib.item("4e", "Sueldo de Mercedes Areco (se acredita en su cuenta)", h, ma_dev_cel, GRUPO,
                 "Devengado según el sistema, 12 meses; no se paga: se acredita en su cuenta con MSA (ver D10).", None)
    else:
        lib.item("4", "Sueldos — bruto devengado según el sistema", h, h.cel(9, rT), GRUPO,
                 "Suma de los 12 totales de mes. (No se encontró el informe de sueldos pagados.)", cont)
        lib.pendiente("Sueldos · falta el informe de sueldos pagados", f"No está {ruta_json}",
                      "El ítem 4 quedó en el devengado del sistema, sin el cuadro de pagado por persona.", "D4 Sueldos")

    # ================= pendientes =================
    if t1:
        tot_json = round(sum(sum(p["banco"]) + sum(p["caja"]) for p in personas), 2)
        if abs(tot_json - PAGADO_TOTAL) > TOL:
            lib.pendiente("Sueldos · el cuadro de pagado no da el total del informe",
                          f"Los importes por mes suman {_ar(tot_json)} y el informe dice {_ar(PAGADO_TOTAL)} "
                          f"(diferencia {_ar(tot_json - PAGADO_TOTAL)})", "El control lo marca REVISAR.", "D4 Sueldos, cuadro 1")
        lib.pendiente("Sueldos · el sistema no tiene cargado el semestre julio–diciembre 2025 de cuatro empleados",
                      "Sigot, Coria, Cejas y Pucheta no tienen sueldo cargado de julio a diciembre de 2025 (Cejas, "
                      "ninguno en el ejercicio). Sus pagos por banco de ese semestre están en el extracto del Galicia "
                      "pero no cargados como pagos de sueldo.",
                      f"Lo pagado a empleados de MSA ({_ar(msa_pag)}) supera a lo devengado en el sistema "
                      f"({_ar(msa_dev)}): no se puede cerrar el año contra el sistema. Hacen falta los recibos o la "
                      "planilla de ese semestre.", "D4 Sueldos, cuadros 1 y 2")
        lib.pendiente("Sueldos · liquidación final de Mabel dos veces",
                      "La liquidación final de Celia Mabel Rojas, 219.892,00 del 09/10/2025, figura dos veces: "
                      "transferencia desde la cuenta de PAM y, el mismo día, pago por la Caja Sigot. Se contaron las dos.",
                      "Si uno de los dos registros sobra, lo pagado está 219.892,00 de más.", "D4 Sueldos, cuadro 1 (oct-25)")
        lib.pendiente("Sueldos · «Pago Elvio jornales» repetido en la planilla",
                      "El pago a Elvio Paz de 205.000,00 del 11/04/2026 está dos veces en la planilla de la Caja Sigot. "
                      "Se contó dos veces, como está en la planilla.",
                      "Posible repetido: lo pagado a Elvio Paz puede estar 205.000,00 de más.", "D4 Sueldos, cuadro 1 (abr-26)")
        lib.pendiente("Sueldos · pago por banco sin repartir",
                      "El pago por banco del 05/11/2025 de 164.819,00 (acreditamiento de haberes) no se pudo repartir "
                      "entre Sigot y Coria: va en renglón propio.",
                      "No cambia el total; cambia cuánto se le pagó a cada uno.", "D4 Sueldos, cuadro 1 (nov-25)")
        lib.pendiente("Sueldos · Elvio Paz y Fabián Vulcano: el devengado del sistema es un estimado",
                      "Cobran en efectivo por la Caja Sigot; lo real es lo pagado "
                      + " y ".join(f"{p['label']} {_ar(sum(p['banco']) + sum(p['caja']))}" for p in personas
                                   if _tokens(p["label"]) & {"elvio", "vulcano"}) + ".",
                      "El devengado del sistema (4d) no coincide con lo pagado para estas dos personas.",
                      "D4 Sueldos, cuadros 1 y 2")
    if revisar:
        det = "; ".join(f"{_eti(f['per'])} {f['nombre']}: guardado {_ar(f['bruto'])} · recompuesto {_ar(f['recalc'])} · "
                        f"diferencia {_ar(f['recalc'] - f['bruto'])}" for f in revisar)
        lib.pendiente("Sueldos · el bruto recompuesto no da el guardado",
                      f"{len(revisar)} renglón(es) con «Control» = REVISAR (suma de las diferencias "
                      f"{_ar(sum(f['recalc'] - f['bruto'] for f in revisar))}): {det}",
                      "El devengado usa el bruto guardado. En AMS jul–dic 25 la app recompone 0; en Sigot y Barreto la "
                      "diferencia aparece en los meses con francos. Hay que mirar cuál de los dos está bien.",
                      "D4 Sueldos, detalle (punto 3), columna «Control»")
    m = re.search(r"en (\d+) fila", aviso[0]) if aviso else None
    if m and int(m.group(1)) != len(revisar):
        lib.pendiente("Sueldos · el aviso del export no coincide con lo contado",
                      f"El export avisa {m.group(1)} filas y acá se marcan {len(revisar)}.", "", "D4 Sueldos")
    for p, nom, nuestro, exp in difs:
        lib.pendiente("Sueldos · no cierra contra el export",
                      f"{p} {nom}: los renglones suman {_ar(nuestro)} y el export dice {_ar(exp)} "
                      f"(diferencia {_ar(nuestro - exp)})", "El control de la hoja lo marca REVISAR.", "D4 Sueldos")
    print(f"[d_sueldos] renglones {len(filas)} · devengado {sum(f['bruto'] for f in filas):,.2f} · REVISAR {len(revisar)} · "
          f"diferencias contra el export {len(difs)} · personas {len(personas)} · pagos: {'sí' if hay_pagos else 'NO'}")
