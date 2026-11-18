# -*- coding: utf-8 -*-
"""D2 Compras — el subdiario de compras del ejercicio, por cuenta contable y por mes, hasta la factura.

Fuente: «Libro Diario - MSA 25-26», solapa «Compras» (una fila por comprobante) y «Resumen 12 meses»
(control por mes). Cada total apunta a las celdas que suma: renglón → subtotal del mes → total de la
cuenta → resumen por cuenta → total compras.
"""
import collections
import unicodedata

from openpyxl.styles import Alignment

from core import ENTERO, F_NOTA, Fuentes, Libro  # noqa: F401  (tipos de la API)

GRUPO = "A · Resultado del ejercicio"
TIPOS = {1: "Fac A", 2: "ND A", 3: "NC A", 6: "Fac B", 11: "Fac C", 81: "Tique A", 332: "Liq. granos",
         60: "Liq. A", 201: "FCE A"}
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
                "octubre", "noviembre", "diciembre"]
EJERCICIO = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
             "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]


# ---------- utilidades comunes a compras y ventas ----------

def ar(x, dec=2):
    """Número en formato es-AR: 1.234.567,89"""
    return f"{x:,.{dec}f}".replace(",", "§").replace(".", ",").replace("§", ".")


def mes_lbl(sub):
    """'2025-07' -> 'jul-25'"""
    return f"{MESES[int(sub[5:7]) - 1]}-{sub[2:4]}"


def f0(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0.0


def comprobante(tipo, pv, nro):
    t = TIPOS.get(tipo, f"T{tipo}" if tipo is not None else "s/tipo")
    p = f"{int(pv):04d}" if isinstance(pv, (int, float)) else "s/pv"
    n = f"{int(nro):08d}" if isinstance(nro, (int, float)) else "s/n°"
    return f"{t} {p}-{n}"


def norm(s):
    """Nombre de cuenta para comparar: sin mayúsculas, acentos ni espacios de más."""
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().upper()
    return " ".join(s.replace(" ,", ",").split())


def leer(ws):
    """Filas de datos (columna A = aaaa-mm) y la fila TOTAL de una solapa Compras / Ventas."""
    filas, total = [], None
    for i, r in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        a = r[0]
        if isinstance(a, str) and len(a) == 7 and a[4] == "-" and a[:4].isdigit():
            filas.append((i, r))
        elif a == "TOTAL":
            total = r
    return filas, total


def resumen_12_meses(wb):
    """{'2025-07': (compras_total, ventas_total)} de la solapa «Resumen 12 meses»."""
    out = {}
    for r in wb["Resumen 12 meses"].iter_rows(values_only=True):
        a = r[0]
        if isinstance(a, str) and len(a.split()) == 2 and a.split()[0].lower() in MESES_LARGOS and a.split()[1].isdigit():
            m = MESES_LARGOS.index(a.split()[0].lower()) + 1
            out[f"{a.split()[1]}-{m:02d}"] = (f0(r[2]), f0(r[4]))
    return out


def pon(h, c, r, v):
    """Reemplaza el valor de una celda ya escrita (conserva formato)."""
    h.celda(c, r).value = v


def nombre_bloque(nombres):
    """nombres = {nombre original: importe}. Prefiere los escritos en MAYÚSCULAS (plan de cuentas vigente)."""
    mayus = {n: v for n, v in nombres.items() if n == n.upper()}
    base = mayus or nombres
    return max(base, key=lambda n: abs(base[n])).upper()


# ---------- la hoja ----------

def construir(lib, src):
    wb = src.libro("Libro Diario")
    fuente = src.nombre("Libro Diario")
    crudas, tot = leer(wb["Compras"])
    r12 = resumen_12_meses(wb)

    comps = []
    for i, r in crudas:
        comps.append(dict(
            fila=i, sub=r[0], fecha=r[1], tipo=r[2], pv=r[3], nro=r[4], cuit=str(r[5] or ""), den=str(r[6] or ""),
            neto=f0(r[7]), ngex=f0(r[8]) + f0(r[9]), mono=f0(r[10]), otros=f0(r[11]), iva=f0(r[12]), total=f0(r[13]),
            dif=f0(r[14]), cta_nom=str(r[15] or "SIN CUENTA"), cta=str(r[16] or "SIN N°"), moneda=r[19], tc=r[20],
            orig=r[21], ctrl=r[22]))

    def ficha(c):
        f = c["fecha"].strftime("%d/%m/%Y") if hasattr(c["fecha"], "strftime") else str(c["fecha"])
        return (f"{f} · {comprobante(c['tipo'], c['pv'], c['nro'])} · {c['den']} (CUIT {c['cuit']}) · "
                f"$ {ar(c['total'])} · cuenta {c['cta']} {c['cta_nom']} · subdiario {mes_lbl(c['sub'])}")

    # --- agrupación por N° de cuenta ---
    por_cta = collections.defaultdict(list)
    for c in comps:
        por_cta[c["cta"]].append(c)
    cuentas = sorted(por_cta)
    nombre = {}
    varios = []
    for k in cuentas:
        nombres = collections.defaultdict(float)
        for c in por_cta[k]:
            nombres[c["cta_nom"]] += c["total"]
        nombre[k] = nombre_bloque(nombres)
        if len({norm(n) for n in nombres}) > 1:
            varios.append(f"{k} (bloque «{nombre[k]}»): " + " / ".join(
                f"{n} $ {ar(v)}" for n, v in sorted(nombres.items(), key=lambda x: -abs(x[1]))))
    fuera_ej = sorted({c["sub"] for c in comps} - set(EJERCICIO))

    # --- hoja ---
    h = lib.hoja("D2 Compras", [10, 17, 40, 14, 14, 13, 13, 11, 13, 14, 14])
    NUM = range(5, 12)  # columnas numéricas del detalle
    h.titulo("D2 · Compras del ejercicio 25/26 — por cuenta contable y por mes")
    h.nota(f"Fuente: «{fuente}», solapa «Compras» ({len(comps)} comprobantes, por mes de subdiario = el mes en que "
           "entró cada comprobante). Importes en pesos. «Al gasto» = Total − IVA (el IVA es crédito fiscal, no gasto).")
    h.nota("Cómo se lee: el «Total compras» del resumen suma el total de cada cuenta; el total de cada cuenta está más "
           "abajo, en su bloque, y suma los subtotales de sus meses (sólo llevan subtotal de mes las cuentas donde casi todos los meses tienen varios comprobantes; las demás van como lista); cada subtotal suma los comprobantes que tiene "
           "arriba. Las tablas por mes muestran el mismo subtotal mensual de cada bloque. Nada se obtiene filtrando.")

    # 1) resumen por cuenta
    h.blanco()
    h.seccion("Resumen por cuenta contable")
    h.encabezado(["N° cuenta", "", "Cuenta contable", "Compro-bantes", "Neto gravado", "No grav. + Exento",
                  "Monotributo (sin crédito)", "Otros tributos", "IVA", "Total", "Al gasto (Total − IVA)"])
    r_res = {}
    for k in cuentas:
        r_res[k] = h.fila([k, None, nombre[k], "=0"] + ["=0"] * 7, fmt={4: ENTERO})
    r1, r2 = r_res[cuentas[0]], r_res[cuentas[-1]]
    r_total = h.total("Total compras", {c: h.suma(c, r1, r2) for c in range(4, 12)}, clave=True, fmt={4: ENTERO})
    h.control("Total compras (con IVA) contra la fila TOTAL del subdiario", h.cel(10, r_total), f0(tot[13]),
              "Libro Diario · Compras · TOTAL")
    h.control("IVA de las compras contra la fila TOTAL del subdiario", h.cel(9, r_total), f0(tot[12]),
              "Libro Diario · Compras · TOTAL")
    h.control("Neto gravado contra la fila TOTAL del subdiario", h.cel(5, r_total), f0(tot[7]),
              "Libro Diario · Compras · TOTAL")
    h.control("Cantidad de comprobantes contra el Resumen 12 meses", h.cel(4, r_total), float(len(comps)),
              "Libro Diario · Resumen 12 meses · TOTAL comprobantes", tolerancia=0)

    # 1.1) de qué se compone «Al gasto»: la diferencia entre el Total y la suma de sus columnas va en renglón propio
    # (JMS 16/11, sobre los ~40.000 de «diferencia de algo más»: que se vea aparte y no adentro de «al gasto»).
    h.blanco()
    h.seccion("De qué se compone «Al gasto» (Total − IVA)")
    h.encabezado(["", "", "Componente", "", "", "", "", "", "", "", "Importe"])
    partes = []
    for etiqueta, col in (("Neto gravado", 5), ("No gravado + Exento", 6), ("Monotributo (sin crédito fiscal)", 7),
                          ("Otros tributos", 8)):
        partes.append(h.fila([None, None, etiqueta] + [None] * 7 + [f"={h.cel(col, r_total)}"]))
    r_dif = h.fila([None, None, "Diferencia entre el Total y la suma de sus columnas («Dif. de algo más» en el libro diario)"]
                   + [None] * 7 + [f"={h.cel(10, r_total)}-{h.cel(9, r_total)}-{h.cel(5, r_total)}-{h.cel(6, r_total)}"
                                   f"-{h.cel(7, r_total)}-{h.cel(8, r_total)}"])
    partes.append(r_dif)
    r_comp = h.total("Total al gasto", {11: h.suma(11, partes[0], partes[-1])}, col_etiqueta=3)
    h.control("la composición da el «Al gasto» del resumen (Total − IVA de todos los comprobantes)", h.cel(11, r_comp),
              sum(c["total"] - c["iva"] for c in comps), "Libro Diario · Compras · suma de los comprobantes", tolerancia=0.05)
    h.control("diferencia entre el Total y sus columnas contra la columna «Dif. de algo más» de la fuente", h.cel(11, r_dif),
              f0(tot[14]), "Libro Diario · Compras · TOTAL", tolerancia=0.05)

    # 2) por mes, dos semestres
    sems = [("1er semestre", EJERCICIO[:6]), ("2do semestre", EJERCICIO[6:])]
    r_mes = [{}, {}]
    r_mes_tot = [None, None]
    for s, (tit, meses) in enumerate(sems):
        h.blanco()
        h.seccion(f"Compras por mes — {tit} ({mes_lbl(meses[0])} a {mes_lbl(meses[-1])}) · Total con IVA, por mes de subdiario")
        h.encabezado(["N° cuenta", "", "Cuenta contable", "Total del ejercicio" if s else ""]
                     + [mes_lbl(m) for m in meses] + [f"Total {tit}"])
        for k in cuentas:
            r = h.r + 1
            h.fila([k, None, nombre[k], f"={h.cel(11, r_mes[0][k])}+{h.cel(11, r)}" if s else None]
                   + ["=0"] * 6 + [f"=SUM({h.cel(5, r)}:{h.cel(10, r)})"])
            r_mes[s][k] = r
        a, b = r_mes[s][cuentas[0]], r_mes[s][cuentas[-1]]
        r_mes_tot[s] = h.total(f"Total compras — {tit}", {c: h.suma(c, a, b) for c in range(4 if s else 5, 12)},
                               clave=True)
    for s, (tit, meses) in enumerate(sems):
        for j, m in enumerate(meses):
            if m in r12:
                h.control(f"compras de {mes_lbl(m)}", h.cel(5 + j, r_mes_tot[s]), r12[m][0],
                          "Libro Diario · Resumen 12 meses · Compras: total")
            else:
                lib.pendiente("Compras: mes sin control", f"«Resumen 12 meses» no trae el mes {m}.", "", "D2 Compras")
    h.control("suma de los 12 meses contra la fila TOTAL del subdiario", h.cel(4, r_mes_tot[1]), f0(tot[13]),
              "Libro Diario · Compras · TOTAL")

    # 3) detalle: un bloque por cuenta
    h.blanco()
    h.seccion("DETALLE — un bloque por cuenta contable, ordenados por N° de cuenta; adentro, por mes de subdiario")
    enc = ["Fecha", "Comprobante", "Proveedor", "CUIT", "Neto gravado", "No grav. + Exento", "Monotributo",
           "Otros tributos", "IVA", "Total", "Al gasto"]
    r_tot = {}
    r_sub = {}
    primero = True
    for k in cuentas:
        h.blanco()
        h.seccion(f"{k} · {nombre[k]}")
        h.encabezado(enc, repetir=primero)
        primero = False
        subs = []          # lo que suma el total de la cuenta: subtotales de mes y comprobantes sueltos
        solo_sub = []      # sólo los subtotales (para no contarlos como comprobantes)
        a_blk = h.r + 1
        meses_k = sorted({c["sub"] for c in por_cta[k]})
        # JMS 18/11: subtotales de mes sólo si la mayoría de los meses del bloque (2 de cada 3) tiene más de un comprobante;
        # si no, la cuenta va como lista simple (un subtotal suelto entre meses sin subtotal parece un error).
        n_varios = sum(1 for m in meses_k if sum(1 for c in por_cta[k] if c["sub"] == m) > 1)
        con_subtotales = n_varios * 3 >= len(meses_k) * 2
        for m in meses_k:
            del_mes = sorted((c for c in por_cta[k] if c["sub"] == m),
                             key=lambda c: (c["fecha"], c["pv"] or 0, c["nro"] or 0))
            a = h.r + 1
            for c in del_mes:
                prov = c["den"]
                if c["moneda"] == "USD":
                    prov += f" (US$ {ar(f0(c['orig']))} × TC {ar(f0(c['tc']))})"
                if norm(c["cta_nom"]) != norm(nombre[k]):
                    prov += f" [{c['cta_nom']}]"
                r = h.r + 1
                h.fila([c["fecha"], comprobante(c["tipo"], c["pv"], c["nro"]), prov, c["cuit"], c["neto"], c["ngex"],
                        c["mono"], c["otros"], c["iva"], c["total"], f"={h.cel(10, r)}-{h.cel(9, r)}"])
            b = h.r
            if b == a or not con_subtotales:     # sin subtotal: el total y la tabla por mes apuntan a los comprobantes
                filas_m = list(range(a, b + 1))
                subs += filas_m
                r_sub[(k, m)] = h.suma_de(10, filas_m)
                continue
            f = {c: h.suma(c, a, b) for c in NUM}
            f[4] = f"=COUNT({h.cel(10, a)}:{h.cel(10, b)})"
            rs = h.total(f"Subtotal {mes_lbl(m)}", f, fmt={4: ENTERO})
            x = h.celda(3, rs)
            x.value = "comprobantes →"
            x.font = F_NOTA
            x.alignment = Alignment(horizontal="right")
            subs.append(rs)
            solo_sub.append(rs)
            r_sub[(k, m)] = f"={h.cel(10, rs)}"
        f = {c: h.suma_de(c, subs) for c in NUM}
        f[4] = f"=COUNT({h.cel(10, a_blk)}:{h.cel(10, h.r)})" + (
            "-COUNT(" + ",".join(h.cel(10, r) for r in solo_sub) + ")" if solo_sub else "")
        r_tot[k] = h.total(f"Total {k} · {nombre[k]}", f, clave=True, fmt={4: ENTERO})

    # 4) los vínculos del resumen y de las tablas por mes (ahora que se sabe dónde quedó cada bloque)
    for k in cuentas:
        for c in range(4, 12):
            pon(h, c, r_res[k], f"={h.cel(c, r_tot[k])}")
        for s, (_, meses) in enumerate(sems):
            for j, m in enumerate(meses):
                rs = r_sub.get((k, m))
                pon(h, 5 + j, r_mes[s][k], rs if rs else None)

    # --- ítems ---
    n_c = len(cuentas)
    comp_txt = f"{n_c} cuentas · {len(comps)} comprobantes; detalle por cuenta y por mes en D2"
    lib.item("2", "Compras — total del subdiario (con IVA)", h, h.cel(10, r_total), GRUPO, comp_txt)
    lib.item("2a", "Compras — al gasto (sin IVA)", h, h.cel(11, r_total), GRUPO,
             "Total − IVA: neto gravado + no gravado + exento + monotributo + otros tributos")
    lib.item("2b", "IVA crédito fiscal de las compras", h, h.cel(9, r_total), GRUPO,
             "IVA discriminado en los comprobantes de compra")

    # --- verificación en Python contra la fila TOTAL + pendientes ---
    D = "D2 Compras"
    cols = [("Neto gravado", "neto", f0(tot[7])), ("No gravado + Exento", "ngex", f0(tot[8]) + f0(tot[9])),
            ("Monotributo", "mono", f0(tot[10])), ("Otros tributos", "otros", f0(tot[11])), ("IVA", "iva", f0(tot[12])),
            ("Total", "total", f0(tot[13]))]
    malas = [(n, sum(c[k] for c in comps), t) for n, k, t in cols if abs(sum(c[k] for c in comps) - t) > 0.005]
    if malas:
        lib.pendiente("Compras: la suma de los comprobantes no da la fila TOTAL de la fuente",
                      "; ".join(f"{n}: suma {ar(s)} vs TOTAL {ar(t)} (dif {ar(s - t)})" for n, s, t in malas),
                      "El control de la hoja va a decir REVISAR", D)
    if fuera_ej:
        lib.pendiente("Compras: subdiarios fuera del ejercicio", f"Meses {fuera_ej}: están en su bloque pero no en "
                      "las tablas por mes.", "Las tablas por mes no llegan al total", D)
    if varios:
        lib.pendiente("Cuentas con más de un nombre",
                      f"{len(varios)} números de cuenta traen más de un nombre en el subdiario (se agrupó por N°; el "
                      "nombre original va entre corchetes en el proveedor). " + " ‖ ".join(varios),
                      "No cambia el total; sí puede cambiar a qué cuenta va cada gasto si el nombre era el correcto "
                      "y el número no", D)
    nc = [c for c in comps if c["ctrl"]]
    if nc:
        lib.pendiente("Compras: comprobantes cuyas partes no suman su total (NO CUADRA)",
                      f"{len(nc)} comprobantes por $ {ar(sum(c['total'] for c in nc))} (faltan "
                      f"$ {ar(sum(c['dif'] for c in nc))} entre las partes y el total). "
                      + " ‖ ".join(ficha(c) + f" · {c['ctrl']}" for c in nc[:10]),
                      "La diferencia queda adentro de «Al gasto» (Total − IVA)", D)
    sd = [c for c in comps if abs(c["dif"]) > 0.05 and not c["ctrl"]]
    if sd:
        lib.pendiente("Compras: comprobantes con diferencia entre partes y total que la fuente NO marca",
                      f"{len(sd)} comprobantes, diferencia $ {ar(sum(c['dif'] for c in sd))}. "
                      + " ‖ ".join(ficha(c) + f" · dif $ {ar(c['dif'])}" for c in sd[:10]),
                      "La diferencia queda adentro de «Al gasto»", D)
    dif_tot = sum(c["dif"] for c in comps)
    if abs(dif_tot) > 0.05:
        lib.pendiente("Compras: el Total no es igual a la suma de sus columnas",
                      f"Total − (neto + no gravado + exento + monotributo + otros + IVA) = $ {ar(dif_tot)} en todo el "
                      f"ejercicio (la fuente lo trae en la columna «Dif. de algo más»: $ {ar(f0(tot[14]))}). Son los "
                      "casos de arriba más redondeos de centavos.",
                      "«Al gasto» se calcula como Total − IVA, así que incluye esa diferencia", D)
    ff = [c for c in comps if not hasattr(c["fecha"], "strftime") or c["fecha"].strftime("%Y-%m") != c["sub"]]
    if ff:
        fe = [c for c in ff if hasattr(c["fecha"], "strftime") and not ("2025-07" <= c["fecha"].strftime("%Y-%m") <= "2026-06")]
        lib.pendiente("Compras: comprobantes cuya fecha no cae en el mes de su subdiario",
                      f"{len(ff)} comprobantes por $ {ar(sum(c['total'] for c in ff))}; de ellos {len(fe)} con fecha "
                      f"fuera del ejercicio ($ {ar(sum(c['total'] for c in fe))}). Primeros 10: "
                      + " ‖ ".join(ficha(c) for c in ff[:10]),
                      "Las tablas por mes van por subdiario, no por fecha del comprobante", D)
    st = [c for c in comps if c["tipo"] not in TIPOS]
    if st:
        lib.pendiente("Compras: comprobantes con tipo sin nombre",
                      f"{len(st)} comprobantes por $ {ar(sum(c['total'] for c in st))} (figuran como «T<n>» o "
                      "«s/tipo»): " + " ‖ ".join(ficha(c) for c in st[:10]), "Sólo de presentación", D)
    no_gasto = [k for k in cuentas if not k.startswith("4")]
    if no_gasto:
        lib.pendiente("Compras: cuentas que no son de gasto adentro del subdiario",
                      " ‖ ".join(f"{k} {nombre[k]}: {len(por_cta[k])} comprobante(s) por $ "
                                 f"{ar(sum(c['total'] for c in por_cta[k]))}" for k in no_gasto),
                      "Están sumadas en «Compras — al gasto»; si son un crédito (retención), habría que sacarlas", D)
    arca = []
    for r in wb["Resumen 12 meses"].iter_rows(values_only=True):
        if isinstance(r[8], str) and r[8].strip().upper() == "NO COINCIDE":
            arca.append(f"{r[0]}: compras $ {ar(f0(r[2]))} vs ARCA presentado $ {ar(f0(r[6]))} (dif $ {ar(f0(r[7]))})")
    if arca:
        lib.pendiente("Compras: meses que no coinciden con lo presentado en ARCA (lo dice la fuente)",
                      " ‖ ".join(arca), "Diferencia entre el subdiario y el libro IVA presentado", D)
    return h
