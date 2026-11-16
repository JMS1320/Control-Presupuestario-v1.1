# -*- coding: utf-8 -*-
"""Ítem 4 — Sueldos (bruto devengado del ejercicio). Hoja «D4 Sueldos».

1) Mes por mes: cada empleado con cómo se compone su bruto; subtotal por mes; total = suma de los 12 subtotales.
2) Los mismos renglones por empresa y por empleado (cada importe apunta a su celda de arriba).
3) Sueldos a pagar al cierre (informativo: es deuda, no resultado).
"""
import collections
import re

from core import num

GRUPO = "A · Resultado del ejercicio"
LIBRO = "Sueldos"
MES = {"01": "ene", "02": "feb", "03": "mar", "04": "abr", "05": "may", "06": "jun",
       "07": "jul", "08": "ago", "09": "sep", "10": "oct", "11": "nov", "12": "dic"}
MODALIDAD = {"plano_ipc": "fijo (IPC)", "por_hora_ipc": "por hora (IPC)", "ab_francos": "A + B + francos",
             "por_dia": "por día"}
EMPRESAS = [("MSA", "Empleados de MSA"), ("MSA/PAM/MA", "Compartidos entre MSA, PAM y MA"),
            ("PAM", "Empleados de PAM"), ("MA", "Empleados de MA")]
TOL = 0.005


def _ar(v):
    return f"{v:,.2f}".replace(",", "§").replace(".", ",").replace("§", ".")


def _eti(p):
    return f"{MES.get(p[5:7], p[5:7])}-{p[2:4]}"


def _contador(src, frag):
    try:
        ws = src.hoja("Balance en l", "Balance en linea")
    except SystemExit:
        return None
    hall = [num(ws.cell(r, 4).value) for r in range(1, ws.max_row + 1)
            if ws.cell(r, 1).value == "RESULTADOS" and frag.lower() in str(ws.cell(r, 3).value or "").lower()]
    return round(abs(hall[0]), 2) if len(hall) == 1 else None


def construir(lib, src):
    ws = src.hoja(LIBRO, "13 Sueldos")
    arch = src.nombre(LIBRO)
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
    fin = r
    # bloques que trae el export debajo del total
    por_mes_src, aviso, a_pagar, a_pagar_tot, efectivo = {}, [], [], None, None
    r = fin + 1
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

    h = lib.hoja("D4 Sueldos", [18, 11, 12, 13, 12, 10, 12.5, 13, 14, 13.5, 12, 9], horizontal=True)
    h.titulo("Detalle 4 — Sueldos: bruto devengado del ejercicio (ítem 4)")
    alim = sum(f["alim"] for f in filas)
    h.nota(f"Fuente: {arch} → «13 Sueldos». Un renglón por empleado y por mes, con cómo se compone su bruto "
           "(categoría A, categoría B, francos, jornal y extras). El bruto es el que guardó la app; al lado va el "
           "bruto que la app recompone desde sus partes: si no coinciden, la columna «Control» dice REVISAR. Cada "
           "mes cierra con su total y el total del ejercicio suma los 12 meses. Más abajo, los mismos renglones "
           "ordenados por empresa y por empleado. El export de MSA trae también empleados de PAM, de MA y los "
           "compartidos (columna «Empresa»). "
           + ("La cuota alimentaria está adentro de la categoría A y en este ejercicio es 0. " if abs(alim) < TOL else
              f"La cuota alimentaria ({_ar(alim)}) está adentro de la categoría A: no se suma al bruto. ")
           + f"Según el export: pagado {_ar(num(tot_src[15]))} · saldo sin pago cargado {_ar(num(tot_src[16]))}.")
    h.blanco()
    h.encabezado(["Empleado", "Empresa", "Modalidad", "Categoría A", "Categoría B", "Por francos", "Por jornal",
                  "Extras", "BRUTO", "Bruto recompuesto por la app", "Diferencia", "Control"], repetir=True)

    # ---------- 1 · mes por mes ----------
    periodos = sorted({f["per"] for f in filas})
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
                fr = f"{f['francos']:g}".replace(".", ",")
                mod += f" · {fr} fr."
            h.fila([f["nombre"], f["emp"], mod, f["a"], f["b"], f["pfrancos"], f["jornal"], f["extras"], f["bruto"],
                    f["recalc"], f"={h.cel(10, r)}-{h.cel(9, r)}",
                    f'=IF(ABS({h.cel(11, r)})<={TOL},"OK","REVISAR")'])
            celda_bruto[(p, f["nombre"])] = r
            r1 = r1 or r
            if abs(f["recalc"] - f["bruto"]) > TOL:
                revisar.append(f)
        rt = h.total(f"Total {_eti(p)}", {k: h.suma(k, r1, r) for k in cols})
        tot_mes.append(rt)
        if p in por_mes_src:  # verificación en Python contra el bloque «POR MES» del export
            sa, sb, sbr = (round(sum(f[k] for f in fs), 2) for k in ("a", "b", "bruto"))
            for nom, nuestro, exp in (("categoría A", sa, por_mes_src[p][0]), ("categoría B", sb, por_mes_src[p][1]),
                                      ("bruto", sbr, por_mes_src[p][2])):
                if abs(nuestro - exp) > TOL:
                    difs.append((p, nom, nuestro, exp))
    h.blanco()
    rT = h.total("TOTAL SUELDOS DEL EJERCICIO — suma de los 12 meses (ítem 4)", {k: h.suma_de(k, tot_mes) for k in cols},
                 clave=True)
    src_col = {4: 4, 5: 5, 6: 9, 7: 10, 8: 11, 9: 12}
    nombres = {4: "categoría A", 5: "categoría B", 6: "por francos", 7: "por jornal", 8: "extras", 9: "BRUTO"}
    for k in (9, 4, 5, 6, 7, 8):
        h.control(f"total {nombres[k]}", h.cel(k, rT), num(tot_src[src_col[k]]), "«13 Sueldos», renglón TOTAL")
        s = round(sum(f[campo[k]] for f in filas), 2)
        if abs(s - num(tot_src[src_col[k]])) > TOL:
            difs.append(("ejercicio", nombres[k], s, num(tot_src[src_col[k]])))

    # ---------- 2 · por empresa y por empleado ----------
    h.blanco()
    h.seccion("Los mismos sueldos, por empresa y por empleado (cada importe apunta a su renglón de arriba)")
    tot_emp_grupo, sub_items = [], []
    otras = [e for e in sorted({f["emp"] for f in filas}) if e not in [x[0] for x in EMPRESAS]]
    for clave, titulo in EMPRESAS + [(e, f"Empresa «{e}»") for e in otras]:
        nombres_e = list(collections.OrderedDict((f["nombre"], 1) for f in filas if f["emp"] == clave))
        if not nombres_e:
            continue
        tot_emp = []
        for n in nombres_e:
            fs = [f for f in filas if f["emp"] == clave and f["nombre"] == n]
            r1 = None
            for i, f in enumerate(fs):
                r = h.fila([n if i == 0 else None, clave if i == 0 else None, _eti(f["per"]), None, None, None, None,
                            None, f"={h.cel(9, celda_bruto[(f['per'], n)])}"], negrita=False)
                r1 = r1 or r
            tot_emp.append(h.fila([None, None, f"Total {n}", None, None, None, None, None, h.suma(9, r1, r)],
                                  negrita=True))
        rg = h.total(f"Total {titulo}", {9: h.suma_de(9, tot_emp)})
        tot_emp_grupo.append(rg)
        sub_items.append((titulo, rg, ", ".join(nombres_e)))
    rT2 = h.total("TOTAL POR EMPRESA — tiene que dar el mismo total del ejercicio", {9: h.suma_de(9, tot_emp_grupo)},
                  clave=True)
    h.control("total por empresa y empleado", h.cel(9, rT2), num(tot_src[12]), "«13 Sueldos», renglón TOTAL, BRUTO")

    # ---------- 3 · a pagar al cierre (informativo) ----------
    if a_pagar:
        h.blanco()
        h.seccion("Sueldos a pagar al cierre — devengados en el ejercicio y pagados después (informativo: es deuda, "
                  "ya está adentro del bruto de arriba)")
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

    # ---------- ítems ----------
    lib.item("4", "Sueldos — bruto devengado del ejercicio", h, h.cel(9, rT), GRUPO,
             "Suma de los 12 totales de mes; cada mes suma sus empleados (categoría A + B + francos + jornal + extras). "
             "Incluye empleados de PAM, de MA y compartidos: ver 4a–4d.", _contador(src, "Sueldos"))
    for i, (titulo, rg, quienes) in enumerate(sub_items):
        lib.item("4" + "abcdefgh"[i], f"Sueldos · {titulo}", h, h.cel(9, rg), GRUPO, quienes, None)

    # ---------- pendientes ----------
    if revisar:
        det = "; ".join(f"{_eti(f['per'])} {f['nombre']}: guardado {_ar(f['bruto'])} · recompuesto {_ar(f['recalc'])} · "
                        f"diferencia {_ar(f['recalc'] - f['bruto'])}" for f in revisar)
        lib.pendiente("Sueldos · el bruto recompuesto no da el guardado",
                      f"{len(revisar)} renglón(es) con «Control» = REVISAR (suma de las diferencias "
                      f"{_ar(sum(f['recalc'] - f['bruto'] for f in revisar))}): {det}",
                      "El total del ítem usa el bruto guardado. En AMS jul–dic 25 la app recompone 0; en Sigot y "
                      "Barreto la diferencia aparece en los meses con francos. Hay que mirar cuál de los dos está bien.",
                      "D4 Sueldos, columna «Control»")
    m = re.search(r"en (\d+) fila", aviso[0]) if aviso else None
    if m and int(m.group(1)) != len(revisar):
        lib.pendiente("Sueldos · el aviso del export no coincide con lo contado",
                      f"El export avisa {m.group(1)} filas y acá se marcan {len(revisar)}.", "", "D4 Sueldos")
    for p, nom, nuestro, exp in difs:
        lib.pendiente("Sueldos · no cierra contra el export",
                      f"{p} {nom}: los renglones suman {_ar(nuestro)} y el export dice {_ar(exp)} "
                      f"(diferencia {_ar(nuestro - exp)})", "El control de la hoja lo marca REVISAR.", "D4 Sueldos")
    ajenos = [(t, rg, q) for (t, rg, q) in sub_items if not t.startswith("Empleados de MSA")]
    if ajenos:
        lib.pendiente("Sueldos · el total incluye empleados que no son sólo de MSA",
                      "El libro de sueldos de MSA trae también: " + " · ".join(f"{t} ({q})" for t, _r, q in ajenos)
                      + ". El export no dice qué parte de los compartidos es costo de MSA.",
                      "El ítem 4 puede estar de más para el resultado de MSA: definir qué va y en qué proporción "
                      "(sub-ítems 4a–4d).", "D4 Sueldos, sección por empresa")
    sin_pago = collections.OrderedDict()
    for f in filas:
        if f["bruto"] > TOL and abs(f["pagado"]) < TOL:
            sin_pago.setdefault(f["nombre"], 0.0)
            sin_pago[f["nombre"]] += f["bruto"]
    if sin_pago:
        lib.pendiente("Sueldos · brutos devengados sin ningún pago cargado",
                      " · ".join(f"{n}: {_ar(v)}" for n, v in sin_pago.items())
                      + (". " + efectivo if efectivo else ""),
                      "Están en el bruto del ítem 4; revisar si son deuda, si se pagaron por caja o si van por otra "
                      "cuenta (socios).", "D4 Sueldos")
    print(f"[d_sueldos] renglones {len(filas)} · bruto {sum(f['bruto'] for f in filas):,.2f} · REVISAR {len(revisar)} · "
          f"diferencias contra el export {len(difs)}")
