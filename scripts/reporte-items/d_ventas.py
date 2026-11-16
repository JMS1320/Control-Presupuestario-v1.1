# -*- coding: utf-8 -*-
"""D1 Ventas — el subdiario de ventas del ejercicio, por cuenta contable y por mes, hasta la factura.

Fuente: «Libro Diario - MSA 25-26», solapa «Ventas» y «Resumen 12 meses» (control por mes).
Las tres últimas columnas son importes anchos porque ahí escribe el control de core.py; por eso
Producto / Toneladas / Cabezas / Kilos van ANTES de los importes.
"""
import collections

from core import ENTERO
from d_compras import EJERCICIO, GRUPO, ar, comprobante, f0, leer, mes_lbl, nombre_bloque, norm, pon, resumen_12_meses

TON = '#,##0.000_);\\(#,##0.000\\);"-"??_);@_)'
# cuenta -> (n° de ítem, nombre del ítem, renglón comparable del balance 24/25 del contador)
SUB_ITEMS = [("4109", "1a", "Arrendamientos cobrados (sin IVA)", 222559662.67),
             ("410101", "1b", "Venta de soja (sin IVA)", 155989812.30),
             ("4102", "1d", "Venta de bienes de uso (sin IVA)", None)]
HACIENDA = ["410802", "410805"]


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

    #            1 Fecha 2 Comp 3 Cliente 4 CUIT 5 Prod 6 Ton 7 Cab 8 Kilos 9 Neto 10 Ex 11 IVA 12 Total 13 Sin IVA
    h = lib.hoja(D, [10, 17, 28, 13, 9, 10, 8, 15, 15, 15, 15, 15, 15])
    FIS = {6: TON, 7: ENTERO, 8: ENTERO}
    h.titulo("D1 · Ventas del ejercicio 25/26 — por cuenta contable y por mes")
    h.nota(f"Fuente: «{fuente}», solapa «Ventas» ({len(vs)} comprobantes, por mes de subdiario). Importes en pesos. "
           "«Sin IVA» = Total − IVA (el IVA es débito fiscal, no ingreso). Los arrendamientos se facturan exentos.")
    h.nota("Cómo se lee: el «Total ventas» del resumen suma el total de cada cuenta; el total de cada cuenta está más "
           "abajo, en su bloque, y suma las facturas que tiene arriba. La tabla por mes apunta a las mismas facturas.")

    # 1) resumen por cuenta
    h.blanco()
    h.seccion("Resumen por cuenta contable")
    h.encabezado(["N° cuenta", "", "Cuenta contable", "Compro-bantes", "", "Toneladas", "Cabezas", "Kilos",
                  "Neto gravado", "Exento / No grav.", "IVA", "Total", "Sin IVA (Total − IVA)"])
    COLS = [4] + list(range(6, 14))
    FM = dict(FIS)
    FM[4] = ENTERO
    r_res = {}
    for k in cuentas:
        vals = [k, None, nombre[k], "=0", None] + ["=0"] * 8
        r_res[k] = h.fila(vals, fmt=FM)
    r_total = h.total("Total ventas", {c: h.suma(c, r_res[cuentas[0]], r_res[cuentas[-1]]) for c in COLS},
                      clave=True, fmt=FM)
    hac = [k for k in HACIENDA if k in r_res]
    r_hac = None
    if hac:
        r_hac = h.total("De las cuales: venta de hacienda (" + " + ".join(hac) + ")",
                        {c: h.suma_de(c, [r_res[k] for k in hac]) for c in COLS}, fmt=FM)
    for txt, c, v in [("Total ventas (con IVA)", 12, f0(tot[13])), ("Neto gravado de las ventas", 9, f0(tot[7])),
                      ("Exento / no gravado de las ventas", 10, f0(tot[8]) + f0(tot[9])),
                      ("IVA de las ventas", 11, f0(tot[12]))]:
        h.control(f"{txt} contra la fila TOTAL del subdiario", h.cel(c, r_total), v, "Libro Diario · Ventas · TOTAL")

    # 2) por mes: una fila por mes, una columna por cuenta (columnas 8..12) y el total del mes en la 13
    h.blanco()
    h.seccion("Ventas por mes — Total con IVA, por mes de subdiario (una columna por cuenta)")
    c_cta = {k: 8 + i for i, k in enumerate(cuentas)}
    enc = ["Mes"] + [""] * 6 + [""] * 5 + ["Total del mes"]
    for k in cuentas:
        enc[c_cta[k] - 1] = f"{k} {nombre[k]}"
    r = h.encabezado(enc)
    h.ws.row_dimensions[r].height = 54
    r_mes = {}
    r_sem = []
    for tit, meses in [("1er semestre", EJERCICIO[:6]), ("2do semestre", EJERCICIO[6:])]:
        for m in meses:
            r = h.r + 1
            vals = [mes_lbl(m)] + [None] * 6 + [None] * 5 + [f"=SUM({h.cel(8, r)}:{h.cel(12, r)})"]
            for k in cuentas:
                vals[c_cta[k] - 1] = "=0"
            h.fila(vals)
            r_mes[m] = r
        r_sem.append(h.total(f"Total {tit}", {c: h.suma(c, r_mes[meses[0]], r_mes[meses[-1]]) for c in range(8, 14)}))
    r_ej = h.total("Total del ejercicio", {c: h.suma_de(c, r_sem) for c in range(8, 14)}, clave=True)
    for m in EJERCICIO:
        if m in r12:
            h.control(f"ventas de {mes_lbl(m)}", h.cel(13, r_mes[m]), r12[m][1],
                      "Libro Diario · Resumen 12 meses · Ventas: total")
        else:
            lib.pendiente("Ventas: mes sin control", f"«Resumen 12 meses» no trae el mes {m}.", "", D)
    h.control("suma de los 12 meses contra la fila TOTAL del subdiario", h.cel(13, r_ej), f0(tot[13]),
              "Libro Diario · Ventas · TOTAL")

    # 3) detalle: un bloque por cuenta
    h.blanco()
    h.seccion("DETALLE — un bloque por cuenta contable, cada factura")
    r_tot = {}
    filas_mes = collections.defaultdict(list)
    primero = True
    for k in cuentas:
        h.blanco()
        h.seccion(f"{k} · {nombre[k]}")
        h.encabezado(["Fecha", "Comprobante", "Cliente", "CUIT", "Producto", "Toneladas", "Cabezas", "Kilos",
                      "Neto gravado", "Exento / No grav.", "IVA", "Total", "Sin IVA"], repetir=primero)
        primero = False
        a = h.r + 1
        for v in sorted(por_cta[k], key=lambda v: (v["sub"], v["fecha"], v["pv"] or 0, v["nro"] or 0)):
            cli = v["den"]
            if v["moneda"] == "USD":
                cli += f" (US$ {ar(f0(v['orig']))} × TC {ar(f0(v['tc']))})"
            if norm(v["cta_nom"]) != norm(nombre[k]):
                cli += f" [{v['cta_nom']}]"
            r = h.r + 1
            h.fila([v["fecha"], comprobante(v["tipo"], v["pv"], v["nro"]), cli, v["cuit"], v["prod"],
                    float(v["ton"]) if v["ton"] is not None else None,
                    float(v["cab"]) if v["cab"] is not None else None,
                    float(v["kg"]) if v["kg"] is not None else None,
                    v["neto"], v["ex"], v["iva"], v["total"], f"={h.cel(12, r)}-{h.cel(11, r)}"], fmt=FIS)
            filas_mes[(k, v["sub"])].append(r)
        b = h.r
        f = {c: h.suma(c, a, b) for c in range(6, 14)}
        f[4] = f"=COUNT({h.cel(12, a)}:{h.cel(12, b)})"
        r_tot[k] = h.total(f"Total {k} · {nombre[k]}", f, clave=True, fmt=FM)

    # 4) vínculos del resumen y de la tabla por mes
    for k in cuentas:
        for c in COLS:
            pon(h, c, r_res[k], f"={h.cel(c, r_tot[k])}")
        for m in EJERCICIO:
            fs = filas_mes.get((k, m))
            pon(h, c_cta[k], r_mes[m], h.suma_de(12, fs) if fs else None)

    # --- ítems ---
    lib.item("1", "Ventas — total del subdiario (con IVA)", h, h.cel(12, r_total), GRUPO,
             f"{len(cuentas)} cuentas · {len(vs)} comprobantes; detalle por cuenta y por mes en D1")
    for k, n, nom, cont in SUB_ITEMS:
        if k in r_res:
            lib.item(n, nom, h, h.cel(13, r_res[k]), GRUPO, f"cuenta {k} {nombre[k]} · {len(por_cta[k])} comprobante(s)",
                     contador_2425=cont)
        else:
            lib.pendiente("Ventas: cuenta esperada que no está en el subdiario", f"Ítem {n} «{nom}»: no hay "
                          f"comprobantes en la cuenta {k}.", "El ítem no se registró", D)
    if r_hac:
        lib.item("1c", "Venta de hacienda (sin IVA)", h, h.cel(13, r_hac), GRUPO,
                 "cuentas " + " + ".join(f"{k} {nombre[k]}" for k in hac), contador_2425=105504350.97)
    else:
        lib.pendiente("Ventas: sin ventas de hacienda", "No hay comprobantes en 410802 ni 410805.", "Ítem 1c sin registrar", D)
    lib.item("1e", "IVA débito fiscal de las ventas", h, h.cel(11, r_total), GRUPO, "IVA discriminado en las facturas de venta")
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
