# -*- coding: utf-8 -*-
"""Hoja «D10.2 Socios falta»: movimientos de las cuentas de MSA que van a un socio (o por cuenta de un socio) y NO están en la
cuenta de socios enviada al contador ni en el detalle del sistema, más los dudosos que sólo JMS puede decidir.

Sale de recorrer los 2.127 movimientos del ejercicio de las cuentas de MSA (bancos, tarjeta y cajas de la app), el 16/11/2026,
sólo lectura. Los datos llegan como JSON fuera del repo (carpeta de fuentes/socios2); se cargan como VALOR con su fuente."""
import datetime
import json
import os

GRUPO = "C · Socios"
ANCHOS = [10, 15, 20, 28, 27, 22, 14, 14]


def _f(v):
    try:
        return datetime.date(int(v[:4]), int(v[5:7]), int(v[8:10]))
    except Exception:
        return v or None


def _tabla(h, filas, titulo_total):
    h.encabezado(["Fecha", "Socio", "Cuenta de donde salió", "A quién", "Detalle (banco · concepto)", "Por qué", "Códigos", "Importe"])
    ini = h.r + 1
    for x in filas:
        det = " · ".join(t for t in (x.get("descripcion"), x.get("detalle")) if t)
        motivo = (x.get("motivo") or "").replace("[FIRME] ", "").replace("[CRITERIO] ", "")
        h.fila([_f(x.get("fecha") or ""), x.get("socio"), x.get("cuenta"), x.get("a_quien"), det, motivo[:260], x.get("codigos"),
                float(x.get("importe") or 0)])
    return h.total(titulo_total, {8: h.suma(8, ini, h.r)})


def construir(lib, src):
    carpeta = os.path.join(src.carpeta, "socios2")
    if not os.path.exists(os.path.join(carpeta, "hallazgos.json")):
        lib.pendiente("Hoja «Socios falta» sin armar", "No está el recorrido de los movimientos de MSA buscando los de socios.", "", "")
        return
    hall = json.load(open(os.path.join(carpeta, "hallazgos.json"), encoding="utf-8"))["filas"]
    dud = json.load(open(os.path.join(carpeta, "dudosos.json"), encoding="utf-8"))["filas"] if os.path.exists(
        os.path.join(carpeta, "dudosos.json")) else []
    # lo que PAM pagó desde SU cuenta a José María y a Andrés va en su propia tabla (4): se saca de los dudosos para no repetirlo
    dud = [x for x in dud if "PAM" not in (x.get("cuenta") or "")]
    firmes = [x for x in hall if "[FIRME]" in (x.get("motivo") or "")]
    criterio = [x for x in hall if "[FIRME]" not in (x.get("motivo") or "")]
    h = lib.hoja("D10.2 Socios falta", ANCHOS, horizontal=True)
    h.titulo("Detalle 10.2 — Socios: movimientos que NO están en la cuenta enviada")
    h.nota("Se recorrieron los 2.127 movimientos del ejercicio de las cuentas de MSA (Galicia, Santander, Provincia, cuenta en "
           "dólares, tarjeta y cajas de la app) buscando los que van a un socio o por cuenta de un socio. Lo que el papel enviado "
           "dice que salió de cuentas de MSA coincide con el banco (144 movimientos, al centavo). Esta hoja lista lo que NO está en "
           "el papel enviado ni en el detalle del sistema. No cambia ningún saldo del reporte: son casos para definir. Aparte está "
           "lo que salió por las cajas (hoja «No informado», bloque 4).")
    h.blanco()
    h.seccion(f"1 · Firmes — son de un socio y no están en su cuenta ({len(firmes)})")
    t1 = _tabla(h, firmes, "Total 1 · Firmes")
    h.blanco()
    h.seccion(f"2 · De criterio — marcados para un socio en la columna interna, con la contable vacía ({len(criterio)})")
    h.nota("El papel de socios se arma con la columna contable. Estos movimientos tienen «DIST MA» en la interna y nada en la "
           "contable: no entran al papel. Puede ser una decisión (el contable sigue a nombre de quién está la factura) y no un olvido.")
    t2 = _tabla(h, criterio, "Total 2 · De criterio")
    h.blanco()
    tt = h.total("TOTAL que no está en la cuenta de socios (1 + 2)", {8: f"={h.cel(8, t1)}+{h.cel(8, t2)}"}, clave=True)
    h.control("total de lo que falta", h.cel(8, tt), sum(float(x.get("importe") or 0) for x in hall),
              "recorrido de movimientos del 16/11/2026", tolerancia=0.05)
    lib.item("10f1", "Socios — movimientos que no están en la cuenta enviada (firmes + de criterio)", h, h.cel(8, tt), GRUPO,
             "No cambia el saldo del reporte: casos para definir. Firmes: sueldo de junio 2025 de Andrés por Santander, electricista "
             "del chalet, seguro de Alondra, estados parcelarios")
    lib.item("10f2", "   de los cuales: firmes", h, h.cel(8, t1), GRUPO, "")
    lib.item("10f3", "   de los cuales: de criterio (interna marcada, contable vacía)", h, h.cel(8, t2), GRUPO, "")
    if dud:
        h.blanco()
        h.seccion(f"3 · Dudosos — puede ser de un socio; sólo JMS puede decidirlo ({len(dud)} renglones)")
        h.nota("No suman a ningún total. Algunos renglones agrupan varios movimientos iguales (el motivo lo dice).")
        t3 = _tabla(h, dud, "Total 3 · Dudosos (no suma)")
        lib.item("10f4", "Socios — dudosos a definir (no suman)", h, h.cel(8, t3), GRUPO, "Seguro de flota, chalet sin marca, prepaga, "
                 "Manuel Martínez, caballos, multas")
    h.blanco()
    h.seccion("4 · Lo que PAM les pagó a José María y a Andrés Martínez — no está en ninguna cuenta de socios de MSA")
    h.encabezado(["Fecha", "Socio", "Cuenta de donde salió", "A quién", "Detalle (banco · concepto)", "Por qué", "Códigos", "Importe"])
    ini = h.r + 1
    for f, s, det, imp in (("2025-11-28", "JMS", "Premio JMS US$ 5.000", 7250000.0), ("2025-12-30", "JMS", "sueldo", 2341786.19),
                           ("2025-12-30", "JMS", "sueldo", 1000000.0), ("2025-12-30", "AMS", "sueldo", 2000000.0)):
        h.fila([_f(f), s, "Galicia cta. cte. de PAM", "José María Martínez" if s == "JMS" else "Andrés Martínez", det,
                "Si cancela su factura de honorarios a PAM, está bien que no figure; si era sueldo de MSA pagado por PAM, falta en "
                "las tres cuentas", "CTA " + s, imp])
    t4 = h.total("Total 4 · Pagado por PAM a José María y a Andrés (no suma)", {8: h.suma(8, ini, h.r)})
    lib.item("10f5", "Pagado por PAM a José María y a Andrés Martínez (a definir: ¿honorarios a PAM o sueldo de MSA?)", h,
             h.cel(8, t4), GRUPO, "Facturas a PAM: José María 1-69 por 22.735.000,00 y Andrés 2-61 por 25.500.000,00")
    lib.pendiente("Socios: movimientos que no están en la cuenta enviada",
                  f"{len(hall)} movimientos de cuentas de MSA van a un socio y no están en el papel enviado ni en el sistema "
                  f"({len(firmes)} firmes y {len(criterio)} de criterio), más {len(dud)} renglones dudosos y lo que PAM pagó a José "
                  "María y a Andrés Martínez (12.591.786,19).", "ver D10.2", "D10.2 Socios falta")
