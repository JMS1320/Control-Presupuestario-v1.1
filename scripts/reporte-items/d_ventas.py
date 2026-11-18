# -*- coding: utf-8 -*-
"""D1 Ventas — el subdiario de ventas del ejercicio, por cuenta contable y por mes, hasta la factura.

Fuente: «Libro Diario - MSA 25-26», solapa «Ventas» y «Resumen 12 meses» (control por mes).
Las tres últimas columnas son importes anchos porque ahí escribe el control de core.py; por eso
Producto / Toneladas / Cabezas / Kilos van ANTES de los importes.
"""
import collections

from openpyxl.styles import Alignment

from core import ENTERO
from d_compras import EJERCICIO, GRUPO, ar, comprobante, f0, leer, mes_lbl, nombre_bloque, norm, pon, resumen_12_meses

TON = '#,##0.000_);\\(#,##0.000\\);"-"??_);@_)'
# cuenta -> (n° de ítem, nombre del ítem, renglón comparable del balance 24/25 del contador)
SUB_ITEMS = [("4109", "1a", "Arrendamientos cobrados (sin IVA)", 222559662.67),
             ("410101", "1b", "Venta de soja (sin IVA)", 155989812.30),
             ("4102", "1d", "Venta de bienes de uso (sin IVA)", None)]
HACIENDA = ["410802", "410805"]
# prefijo de la cuenta -> (cuenta agrupadora del plan, nombre que usa JMS)
AGRUPADORAS = [("4101", "4101", "Agricultura"), ("4108", "4108", "Ganadería"), ("4109", "4109", "Arrendamientos"), ("4102", "4102", "Bienes de uso")]


def construir(lib, src):
    wb = src.libro("Libro Diario")
    fuente = src.nombre("Libro Diario")
    crudas, tot = leer(wb["Ventas"])
    r12 = resumen_12_meses(wb)
    D = "D1 Ventas"

    vs = []
    for i, r in crudas:
        vs.append(dict(
            fila=i, sub=r[0], fecha=r[1], tipo=r[2], pv=r[3], nro=r[4], cuit=str(r[5] or ""), den=str(r[6] or ""),
            neto=f0(r[7]), ex=f0(r[8]) + f0(r[9]), mono=f0(r[10]), otros=f0(r[11]), iva=f0(r[12]), total=f0(r[13]),
            dif=f0(r[14]), cta_nom=str(r[15] or "SIN CUENTA"), cta=str(r[16] or "SIN N°"), moneda=r[19], tc=r[20],
            orig=r[21], prod=r[22], ton=r[23], cab=r[24], kg=r[25], ctrl=r[26]))

    def ficha(v):
        return (f"{v['fecha'].strftime('%d/%m/%Y')} · {comprobante(v['tipo'], v['pv'], v['nro'])} · {v['den']} "
                f"(CUIT {v['cuit']}) · $ {ar(v['total'])} · cuenta {v['cta']} {v['cta_nom']}")

    por_cta = collections.defaultdict(list)
    for v in vs:
        por_cta[v["cta"]].append(v)
    cuentas = sorted(por_cta)
    nombre = {}
    for k in cuentas:
        ns = collections.defaultdict(float)
        for v in por_cta[k]:
            ns[v["cta_nom"]] += v["total"]
        nombre[k] = nombre_bloque(ns)
        if len({norm(n) for n in ns}) > 1:
            lib.pendiente("Ventas: cuenta con más de un nombre", f"{k}: " + " / ".join(f"{n} $ {ar(x)}" for n, x in ns.items()), "", D)
    if len(cuentas) > 5:
        raise SystemExit(f"D1 Ventas: {len(cuentas)} cuentas; la tabla por mes está armada para 5 como máximo")

    # agrupadoras (JMS 18/11: «mostralo por su cuenta agrupadora: Agricultura, Ganadería, Arrendamiento y Bienes de uso»)
    def agr_de(k):
        for pref, cod, nom in AGRUPADORAS:
            if k.startswith(pref):
                return cod
        return "otras"
    AGR_NOM = {cod: nom for _p, cod, nom in AGRUPADORAS}
    AGR_NOM["otras"] = "Otras ventas"
    agrs = [cod for cod in [x[1] for x in AGRUPADORAS] + ["otras"] if any(agr_de(k) == cod for k in cuentas)]
    ctas_de = {g: [k for k in cuentas if agr_de(k) == g] for g in agrs}
    if len(agrs) > 4:
        raise SystemExit(f"D1 Ventas: {len(agrs)} agrupadoras; la tabla por mes está armada para 4 como máximo")
    # dato que falta en la fuente y dio JMS (18/11): toneladas de la factura de Sanpa del 11/05/2026
    for v in vs:
        if v["cta"] == "4109" and v["ton"] is None and v["fecha"].strftime("%Y-%m-%d") == "2026-05-11" and "sanpa" in v["den"].lower():
            v["ton"], v["prod"], v["ton_jms"] = 212.96, v["prod"] or "SOJA", True
            lib.pendiente("Ventas: toneladas cargadas a mano en el reporte", ficha(v) + " — 212,96 t (dato de JMS, 18/11)",
                          "Falta cargarlas en el sistema; el reporte ya las suma", D)

    # 1 Fecha 2 Comp 3 Cliente 4 CUIT 5 Prod 6 Ton 7 Cab 8 Kilos 9 Kg prom. 10 Neto 11 Ex 12 IVA 13 Total 14 Sin IVA
    C_TON, C_CAB, C_KG, C_PROM, C_NETO, C_EX, C_IVA, C_TOT, C_SIN = 6, 7, 8, 9, 10, 11, 12, 13, 14
    h = lib.hoja(D, [10, 17, 28, 13, 9, 10, 8, 10, 9, 15, 15, 15, 15, 15])
    FIS = {C_TON: TON, C_CAB: ENTERO, C_KG: ENTERO, C_PROM: ENTERO}
    h.titulo("D1 · Ventas del ejercicio 25/26 — por agrupadora, por cuenta contable y por mes")
    h.nota(f"Fuente: «{fuente}», solapa «Ventas» ({len(vs)} comprobantes, por mes de subdiario). Importes en pesos. "
           "«Sin IVA» = Total − IVA (el IVA es débito fiscal, no ingreso). Los arrendamientos se facturan exentos.")
    h.nota("Cómo se lee: el resumen suma el total de cada agrupadora; el total de cada agrupadora está más abajo, en su "
           "bloque, y suma sus cuentas contables, que suman las facturas. La tabla por mes apunta a las mismas facturas. "
           "«Kg prom.» = kilos sobre las cabezas que tienen kilos informados.")

    # 1) resumen por agrupadora
    h.blanco()
    h.seccion("Resumen por agrupadora")
    r_enc = h.encabezado(["Agrupadora", "", "Cuentas contables", "Compro-bantes", "", "Toneladas", "Cabezas", "Kilos", "Kg prom.",
                          "Neto gravado", "Exento / No grav.", "IVA", "Total", "Sin IVA (Total − IVA)"])
    h.ws.merge_cells(start_row=r_enc, start_column=2, end_row=r_enc, end_column=3)
    COLS = [4, C_TON, C_CAB, C_KG, C_NETO, C_EX, C_IVA, C_TOT, C_SIN]
    FM = dict(FIS)
    FM[4] = ENTERO
    r_agr = {}
    for g in agrs:
        vals = [AGR_NOM[g], None, " · ".join(f"{k} {nombre[k]}" for k in ctas_de[g]), "=0", None, "=0", "=0", "=0", None] + ["=0"] * 5
        r_agr[g] = h.fila(vals, fmt=FM)
        h.ws.merge_cells(start_row=r_agr[g], start_column=2, end_row=r_agr[g], end_column=3)
    r_total = h.total("Total ventas", {c: h.suma(c, r_agr[agrs[0]], r_agr[agrs[-1]]) for c in COLS}, clave=True, fmt=FM)
    for txt, c, v in [("Total ventas (con IVA)", C_TOT, f0(tot[13])), ("Neto gravado de las ventas", C_NETO, f0(tot[7])),
                      ("Exento / no gravado de las ventas", C_EX, f0(tot[8]) + f0(tot[9])),
                      ("IVA de las ventas", C_IVA, f0(tot[12]))]:
        h.control(f"{txt} contra la fila TOTAL del subdiario", h.cel(c, r_total), v, "Libro Diario · Ventas · TOTAL")

    # 2) por mes: una fila por mes, una columna por agrupadora (sin IVA), el total sin IVA y el total con IVA
    h.blanco()
    h.seccion("Ventas por mes — sin IVA, por mes de subdiario (una columna por agrupadora)")
    C_AGR = dict(zip(agrs, [8, 10, 11, 12]))          # la primera ocupa las columnas 8 y 9 combinadas

    def une_8_9(r):
        h.ws.merge_cells(start_row=r, start_column=9, end_row=r, end_column=10)

    enc = ["Mes"] + [""] * 11 + ["Total sin IVA", "Total con IVA"]
    for g in agrs:
        enc[C_AGR[g] - 1] = AGR_NOM[g]
    une_8_9(h.encabezado(enc))
    r_mes = {}
    for m in EJERCICIO:
        r = h.r + 1
        vals = [mes_lbl(m)] + [None] * 11 + ["=" + "+".join(h.cel(C_AGR[g], r) for g in agrs), "=0"]
        for g in agrs:
            vals[C_AGR[g] - 1] = "=0"
        h.fila(vals)
        une_8_9(r)
        r_mes[m] = r
    r_ej = h.total("Total del ejercicio", {c: h.suma(c, r_mes[EJERCICIO[0]], r_mes[EJERCICIO[-1]])
                                           for c in list(C_AGR.values()) + [C_TOT, C_SIN]}, clave=True)
    une_8_9(r_ej)
    for m in EJERCICIO:
        if m in r12:
            h.control(f"ventas de {mes_lbl(m)} (con IVA)", h.cel(C_SIN, r_mes[m]), r12[m][1],
                      "Libro Diario · Resumen 12 meses · Ventas: total")
        else:
            lib.pendiente("Ventas: mes sin control", f"«Resumen 12 meses» no trae el mes {m}.", "", D)
    h.control("suma de los 12 meses (con IVA) contra la fila TOTAL del subdiario", h.cel(C_SIN, r_ej), f0(tot[13]),
              "Libro Diario · Ventas · TOTAL")
    h.control("total sin IVA de la tabla por mes contra el resumen", h.cel(C_TOT, r_ej), 0.0, "esta hoja · resumen")
    r_ctl_sin = h.r

    # 3) detalle: un bloque por agrupadora y, adentro, por cuenta contable
    h.blanco()
    h.seccion("DETALLE — por agrupadora y por cuenta contable, cada factura")
    r_tot = {}
    r_tot_agr = {}
    cab_con_kg = collections.defaultdict(list)       # cuenta -> celdas de cabezas de las filas que tienen kilos
    filas_mes = collections.defaultdict(list)
    primero = True
    ENC_DET = ["Fecha", "Comprobante", "Cliente", "CUIT", "Producto", "Toneladas", "Cabezas", "Kilos", "Kg prom.",
               "Neto gravado", "Exento / No grav.", "IVA", "Total", "Sin IVA"]

    def arriba(c, r):
        x = h.celda(c, r)
        x.number_format = ENTERO
        x.alignment = Alignment(vertical="top")

    def prom(celdas_cab, r):
        return ("=" + h.cel(C_KG, r) + "/(" + "+".join(celdas_cab) + ")") if celdas_cab else None

    for g in agrs:
        h.blanco()
        h.seccion(AGR_NOM[g].upper())
        for k in ctas_de[g]:
            if len(ctas_de[g]) > 1:
                h.blanco()
            h.seccion(f"{k} · {nombre[k]}")
            h.encabezado(ENC_DET, repetir=primero)
            primero = False
            a = h.r + 1
            for v in sorted(por_cta[k], key=lambda v: (v["sub"], v["fecha"], v["pv"] or 0, v["nro"] or 0)):
                cli = v["den"]
                if v["moneda"] == "USD":
                    cli += f" (US$ {ar(f0(v['orig']))} × TC {ar(f0(v['tc']))})"
                if norm(v["cta_nom"]) != norm(nombre[k]):
                    cli += f" [{v['cta_nom']}]"
                if v.get("ton_jms"):
                    cli += " (toneladas: dato de JMS)"
                r = h.r + 1
                con_kg = v["cab"] is not None and v["kg"] is not None and float(v["cab"]) > 0
                h.fila([v["fecha"], comprobante(v["tipo"], v["pv"], v["nro"]), cli, v["cuit"], v["prod"],
                        float(v["ton"]) if v["ton"] is not None else None,
                        float(v["cab"]) if v["cab"] is not None else None,
                        float(v["kg"]) if v["kg"] is not None else None,
                        f"={h.cel(C_KG, r)}/{h.cel(C_CAB, r)}" if con_kg else None,
                        v["neto"], v["ex"], v["iva"], v["total"], f"={h.cel(C_TOT, r)}-{h.cel(C_IVA, r)}"], fmt=FIS)
                if con_kg:
                    cab_con_kg[k].append(h.cel(C_CAB, r))
                filas_mes[(g, v["sub"])].append(r)
            b = h.r
            f = {c: h.suma(c, a, b) for c in (C_TON, C_CAB, C_KG, C_NETO, C_EX, C_IVA, C_TOT, C_SIN)}
            f[4] = f"=COUNT({h.cel(C_TOT, a)}:{h.cel(C_TOT, b)})"
            una = len(ctas_de[g]) == 1
            r_tot[k] = h.total(f"Total {AGR_NOM[g]} · {k} {nombre[k]}" if una else f"Total {k} · {nombre[k]}", f, clave=una, fmt=FM)
            pr = prom(cab_con_kg[k], r_tot[k])
            if pr:
                pon(h, C_PROM, r_tot[k], pr)
                arriba(C_PROM, r_tot[k])
        if len(ctas_de[g]) == 1:
            r_tot_agr[g] = r_tot[ctas_de[g][0]]
        else:
            h.blanco()
            f = {c: h.suma_de(c, [r_tot[k] for k in ctas_de[g]]) for c in COLS}
            r_tot_agr[g] = h.total(f"Total {AGR_NOM[g]}", f, clave=True, fmt=FM)
            pr = prom([x for k in ctas_de[g] for x in cab_con_kg[k]], r_tot_agr[g])
            if pr:
                pon(h, C_PROM, r_tot_agr[g], pr)
                arriba(C_PROM, r_tot_agr[g])

    # 4) vínculos del resumen y de la tabla por mes
    for g in agrs:
        for c in COLS:
            pon(h, c, r_agr[g], f"={h.cel(c, r_tot_agr[g])}")
        if any(cab_con_kg[k] for k in ctas_de[g]):
            pon(h, C_PROM, r_agr[g], f"={h.cel(C_PROM, r_tot_agr[g])}")
            arriba(C_PROM, r_agr[g])
        for m in EJERCICIO:
            fs = filas_mes.get((g, m))
            pon(h, C_AGR[g], r_mes[m], h.suma_de(C_SIN, fs) if fs else None)
    for m in EJERCICIO:
        fs = [r for g in agrs for r in filas_mes.get((g, m), [])]
        pon(h, C_SIN, r_mes[m], h.suma_de(C_TOT, fs) if fs else None)
    pon(h, C_IVA, r_ctl_sin, f"={h.cel(C_SIN, r_total)}")       # el control compara contra el «Sin IVA» del resumen
    r_res = {k: r_agr[agr_de(k)] for k in cuentas if len(ctas_de[agr_de(k)]) == 1}
    r_hac = r_agr.get("4108")
    hac = [k for k in HACIENDA if k in por_cta]

    # --- ítems ---
    lib.item("1", "Ventas — total del subdiario (con IVA)", h, h.cel(C_TOT, r_total), GRUPO,
             f"{len(agrs)} agrupadoras · {len(cuentas)} cuentas · {len(vs)} comprobantes; detalle por agrupadora, cuenta y mes en D1")
    for k, n, nom, cont in SUB_ITEMS:
        if k in r_res:
            lib.item(n, nom, h, h.cel(C_SIN, r_res[k]), GRUPO, f"cuenta {k} {nombre[k]} · {len(por_cta[k])} comprobante(s)",
                     contador_2425=cont)
        else:
            lib.pendiente("Ventas: cuenta esperada que no está en el subdiario", f"Ítem {n} «{nom}»: no hay "
                          f"comprobantes en la cuenta {k}.", "El ítem no se registró", D)
    if r_hac:
        lib.item("1c", "Venta de hacienda (sin IVA)", h, h.cel(C_SIN, r_hac), GRUPO,
                 "cuentas " + " + ".join(f"{k} {nombre[k]}" for k in hac), contador_2425=105504350.97)
    else:
        lib.pendiente("Ventas: sin ventas de hacienda", "No hay comprobantes en 410802 ni 410805.", "Ítem 1c sin registrar", D)
    lib.item("1e", "IVA débito fiscal de las ventas", h, h.cel(C_IVA, r_total), GRUPO, "IVA discriminado en las facturas de venta")
    otras = [k for k in cuentas if k not in HACIENDA and k not in [s[0] for s in SUB_ITEMS]]
    if otras:
        lib.pendiente("Ventas: cuentas sin sub-ítem propio",
                      " ‖ ".join(f"{k} {nombre[k]} $ {ar(sum(v['total'] for v in por_cta[k]))}" for k in otras),
                      "Están en el ítem 1 pero no en 1a–1d", D)

    # --- verificación en Python + pendientes ---
    cols = [("Neto gravado", "neto", f0(tot[7])), ("Exento / no gravado", "ex", f0(tot[8]) + f0(tot[9])),
            ("IVA", "iva", f0(tot[12])), ("Total", "total", f0(tot[13]))]
    malas = [(n, sum(v[k] for v in vs), t) for n, k, t in cols if abs(sum(v[k] for v in vs) - t) > 0.005]
    if malas:
        lib.pendiente("Ventas: la suma de los comprobantes no da la fila TOTAL de la fuente",
                      "; ".join(f"{n}: suma {ar(s)} vs TOTAL {ar(t)}" for n, s, t in malas), "Control en REVISAR", D)
    fuera = sorted({v["sub"] for v in vs} - set(EJERCICIO))
    if fuera:
        lib.pendiente("Ventas: subdiarios fuera del ejercicio", str(fuera), "La tabla por mes no llega al total", D)
    om = [v for v in vs if abs(v["mono"]) + abs(v["otros"]) > 0.005]
    if om:
        lib.pendiente("Ventas: comprobantes con Monotributo u Otros tributos (la hoja no tiene esa columna)",
                      " ‖ ".join(ficha(v) for v in om[:10]), "Quedan adentro de «Sin IVA»", D)
    nc = [v for v in vs if v["ctrl"] or abs(v["dif"]) > 0.05]
    if nc:
        lib.pendiente("Ventas: comprobantes cuyas partes no suman su total",
                      " ‖ ".join(ficha(v) + f" · dif $ {ar(v['dif'])}" for v in nc[:10]), "", D)
    ff = [v for v in vs if v["fecha"].strftime("%Y-%m") != v["sub"]]
    if ff:
        lib.pendiente("Ventas: comprobantes cuya fecha no cae en el mes de su subdiario",
                      f"{len(ff)} por $ {ar(sum(v['total'] for v in ff))}: " + " ‖ ".join(ficha(v) for v in ff[:10]), "", D)
    sn = [v for v in vs if v["pv"] is None or v["nro"] is None]
    if sn:
        lib.pendiente("Ventas: comprobantes sin punto de venta o sin número en la fuente",
                      f"{len(sn)} por $ {ar(sum(v['total'] for v in sn))}: " + " ‖ ".join(ficha(v) for v in sn[:10]),
                      "No se pueden identificar por número (son liquidaciones recibidas)", D)
    sk = [v for v in vs if v["cab"] and not v["kg"]]
    if sk:
        lib.pendiente("Ventas: hacienda con cabezas y sin kilos", " ‖ ".join(ficha(v) for v in sk), "El total de kilos queda corto", D)
    return h
