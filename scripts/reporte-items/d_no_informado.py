# -*- coding: utf-8 -*-
"""Hoja «No informado»: gastos, retiros y pagos reales del ejercicio que el contador no tiene.

Motivo (JMS 15/11/2026): para el contador la Caja es la variable de ajuste; todo gasto o retiro real que no se le
informó le queda como plata en caja. Esta hoja lista bloque por bloque lo NO informado, con el detalle de cada renglón.

Los datos salen de `no_informado.json` (carpeta de fuentes/noinf), armado el 15/11/2026 desde la planilla de cajas,
el export de la app y la base (sólo lectura). Se cargan como VALOR con su fuente; cada total suma sus renglones."""
import datetime
import json
import os

from openpyxl.worksheet.pagebreak import Break

ANCHOS = [10, 19, 25, 21, 15, 15, 18, 12, 15]
SEGURO_EN_PESOS = ["1", "2", "3", "4.1", "4.2", "5", "9.1"]
GRUPO = "E · Para revisar con el contador"


def _ar(v):
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"({s})" if v < 0 else s


def _fecha(v):
    if isinstance(v, str) and len(v) == 10 and v[4] == "-" and v[7] == "-":
        try:
            return datetime.date(int(v[:4]), int(v[5:7]), int(v[8:10]))
        except ValueError:
            return v
    return v


def _bloque(h, b, filas_total):
    ncol = h.ncols
    cols = list(b.get("columnas") or [])
    ci = b.get("col_importe")
    estado = b.get("estado", "")
    n = str(b.get("n", ""))
    titulo = b.get("titulo", "")
    h.blanco()
    h.seccion(f"{n} · {titulo}" + (f" — {estado}" if estado else ""))
    if b.get("nota"):
        h.nota(b["nota"])
    fila_total = None
    filas = b.get("filas") or []
    if cols and filas and ci is not None:
        otras = [i for i in range(len(cols)) if i != ci][:ncol - 1]
        mapa = {i: k + 1 for k, i in enumerate(otras)}
        mapa[ci] = ncol
        enc = [""] * ncol
        for i, c in mapa.items():
            enc[c - 1] = cols[i]
        h.encabezado(enc)
        ini = h.r + 1
        for f in filas:
            vals = [None] * ncol
            for i, c in mapa.items():
                if i >= len(f):
                    continue
                v = f[i]
                if isinstance(v, str):
                    v = _fecha(v) if cols[i].lower().startswith("fecha") else v
                elif isinstance(v, (int, float)) and not isinstance(v, bool):
                    v = float(v)
                vals[c - 1] = v if v != "" else None
            cuenta = not any(isinstance(x, str) and "ya informado" in x.lower() for x in f)
            if not cuenta and isinstance(vals[ncol - 1], float):
                vals[ncol - 1] = "no suma: " + _ar(vals[ncol - 1])  # texto: la suma del bloque no lo toma
            h.fila(vals)
        fin = h.r
        fila_total = h.total(f"Total {n} · {titulo[:70]}", {ncol: h.suma(ncol, ini, fin)})
        if b.get("total") is not None:
            h.control(f"total del bloque {n}", h.cel(ncol, fila_total), float(b["total"]), "detalle del 15/11/2026", tolerancia=0.05)
    subs = []
    for s in b.get("sub") or []:
        ft = _bloque(h, s, filas_total)
        if ft:
            subs.append(ft)
    if fila_total is None and subs:
        h.blanco()
        fila_total = h.total(f"Total {n} · {titulo[:70]} (suma de sus partes)", {ncol: h.suma_de(ncol, subs)})
    if fila_total:
        filas_total[n] = (fila_total, b)
    return fila_total


def construir(lib, src):
    ruta = os.path.join(src.carpeta, "noinf", "no_informado.json")
    if not os.path.exists(ruta):
        lib.pendiente("Hoja «No informado» sin armar", "Todavía no está el detalle de lo no informado al contador.", "", "")
        return
    d = json.load(open(ruta, encoding="utf-8"))
    h = lib.hoja("No informado", ANCHOS, horizontal=True)
    h.titulo("Lo no informado al contador — gastos, retiros y pagos reales del ejercicio que él no tiene")
    h.nota("Para el contador la Caja es la variable de ajuste: arma el balance con lo que se le informa y lo que no cierra queda en "
           "Caja. Todo gasto o retiro real que no se le informó le queda como plata en caja. Esta hoja lista, bloque por bloque y "
           "renglón por renglón, lo que no se le informó. «Seguro» = no está en nada de lo enviado. «A confirmar» = hay que "
           "preguntarle si lo tiene. Los renglones que dicen «no suma» ya están informados por otro papel (factura en el libro de "
           "compras o renglón en Cuentas de socios) y se muestran sin sumar. Fuentes: planilla de cajas (- CAJA 25-26.xlsx), export "
           "de la app del 15/11/2026 y la base, sólo lectura. El resumen va primero; el detalle de cada bloque, desde la página siguiente.")
    nc = h.ncols
    titulos = {}

    def juntar(b):
        titulos[str(b.get("n", ""))] = b
        for x in b.get("sub") or []:
            juntar(x)

    for b in d.get("bloques", []):
        juntar(b)
    pend = {}  # n del bloque -> fila del resumen cuya celda de importe se completa al final

    def renglon(n, etiqueta=None):
        b = titulos[n]
        r = h.fila([n, etiqueta or b.get("titulo", ""), None, None, None, None, None, b.get("estado", ""), 0.0])
        h.ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=8)
        h.ws.row_dimensions[r].height = 15 if len(etiqueta or b.get("titulo", "")) < 105 else 28
        pend[n] = r
        return r

    h.blanco()
    h.seccion("RESUMEN — lo no informado, de lo seguro a lo que hay que confirmar (cada importe viene de su bloque, más abajo)")
    h.encabezado(["N°", "Bloque", "", "", "", "", "", "Estado", "Importe"])
    seg = [renglon(n) for n in SEGURO_EN_PESOS if n in titulos]
    t1 = h.total("A · Gasto y retiro NO informado, seguro, en pesos (caja y banco)", {nc: h.suma_de(nc, seg)}, clave=True)
    lib.item("13", "No informado al contador — gasto y retiro seguro, en pesos", h, h.cel(nc, t1), GRUPO,
             "Otros gastos, gastos por las cajas de AMS y Sigot, retiros de socios por caja, jornales de Elvio Paz y Fabián Vulcano, "
             "transferencia sin factura; detalle renglón por renglón")
    for k, n in enumerate([x for x in SEGURO_EN_PESOS if x in titulos]):
        lib.item("13" + chr(97 + k), "No informado · " + titulos[n].get("titulo", "")[:70], h, h.cel(nc, pend[n]), GRUPO, "seguro")
    if "4.3" in titulos:
        r = renglon("4.3")
        h.total("B · Con la distribución en efectivo del 17/01/2026 (salió de la caja en dólares)",
                {nc: f"={h.cel(nc, t1)}+{h.cel(nc, r)}"})
        lib.item("14", "Distribución en efectivo a socios del 17/01/2026 (caja en dólares) — no informada", h, h.cel(nc, r), GRUPO,
                 "US$ 21.400 × 1.470; no está en Cuentas de socios enviado")
    conf = [renglon(n) for n in ("4.4", "9.2", "9.3", "9.4") if n in titulos]
    if conf:
        t3 = h.total("C · A confirmar con el contador", {nc: h.suma_de(nc, conf)})
        lib.item("15", "No informado — a confirmar (PAM por caja, pagos sobre lo facturado, compras con débito sin factura)", h,
                 h.cel(nc, t3), GRUPO, "hay que preguntar si lo tiene")
    h.blanco()
    h.seccion("Aparte — no son gasto no informado, pero mueven la Caja del contador")
    h.encabezado(["N°", "Qué es", "", "", "", "", "", "Estado", "Importe"])
    for n, num_item, nombre in (("6", "16", "Venta de la Amarok cobrada en efectivo: ¿dónde puso el cobro?"),
                                ("8", "17", "Cobros en efectivo no informados (le BAJAN la caja)"),
                                ("7", "18", "Libertad, 50 % de MSA (recordatorio: confirmar que lo tomó)")):
        if n in titulos:
            r = renglon(n, nombre)
            lib.item(num_item, nombre, h, h.cel(nc, r), GRUPO, titulos[n].get("estado", ""))
    h.ws.row_breaks.append(Break(id=h.r))  # el detalle arranca en página nueva
    ft = {}
    for b in d.get("bloques", []):
        _bloque(h, b, ft)
    for n, r in pend.items():
        if n in ft:
            h.celda(nc, r).value = f"={h.cel(nc, ft[n][0])}"
    h.blanco()
    h.nota("Sueldos: en el bloque 5 sólo suman como seguro los jornales en efectivo de Elvio Paz y Fabián Vulcano, que no tienen recibo. "
           "Los pagos de julio a diciembre de 2025 a Sigot, Coria, Cejas y Pucheta (20.529.826,30) no están cargados en el sistema, "
           "pero no se sabe si el contador los tiene por sus recibos: hay que preguntarle qué sueldos tomó. El cuadro completo por "
           "persona y por mes está en D4 Sueldos.")
    lib.pendiente("Amarok: destino del cobro", "FC A 10-19 del 26/11/2025 a Parra Roberto José por 25.000.000,11, cobrada en efectivo: "
                  "en el sistema figura cobrada sin fecha ni movimiento; no entró a ningún banco ni a la Caja general de la planilla.",
                  "25.000.000,11", "No informado · bloque 6")
