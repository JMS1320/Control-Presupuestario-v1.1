# -*- coding: utf-8 -*-
"""Parte el PDF completo del reporte en varios PDF por tema (JMS 18/11: «dividir en varios PDF»).

  python -P pdf_partes.py "<libro.xlsx>" "<completo.pdf>" "<carpeta de salida>"

No vuelve a exportar: corta las páginas del PDF completo, así cada página conserva su número («Página 73 de 221») y el índice sigue
valiendo para todos los PDF. Los links entre hojas no se conservan (irían a otro archivo). Compras y Templates salen en dos: las
tablas anuales o agrupadas por un lado y el detalle completo por otro."""
import os
import sys

import openpyxl
from PyPDF2 import PdfReader, PdfWriter
from PyPDF2.generic import ArrayObject, NameObject

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdf_links  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
xlsx, completo, salida = sys.argv[1], sys.argv[2], sys.argv[3]

# nombre del PDF -> lista de (hoja, desde, hasta): desde / hasta = comienzo del título de una sección (None = principio / fin)
PARTES = [
    ("01 - Indice", [("Items", None, None)]),
    ("02 - Ventas", [("D1 Ventas", None, None)]),
    ("03 - Compras - tablas anuales y por mes", [("D2 Compras", None, None)]),
    ("04 - Compras - detalle completo, factura por factura", [("D2.1 Compras detalle", None, None)]),
    ("05 - Templates - tablas anuales, por mes y gastos bancarios",
     [("D3 Templates", None, None), ("D3.1 Meses jul-dic", None, None), ("D3.2 Meses ene-jun", None, None),
      ("D3.5 Gastos bancarios", None, None)]),
    ("06 - Templates - detalle completo", [("D3.3 Egresos", None, None), ("D3.4 Financiero", None, None)]),
    ("07 - Sueldos", [("D4 Sueldos", None, None)]),
    ("08 - Caja y bancos", [("D5 Caja y bancos", None, None)]),
    ("09 - A cobrar y a pagar", [("D6 A cobrar", None, None), ("D9 A pagar", None, None)]),
    ("10 - Hacienda", [("D7 Hacienda", None, None)]),
    ("11 - Granos e insumos", [("D8 Granos insumos", None, None)]),
    ("12 - Socios", [("D10 Socios", None, None), ("D10.1 Socios interno", None, None), ("D10.2 Socios falta", None, None)]),
    ("13 - Para revisar con el contador", [("Enviado vs hoy", None, None), ("No informado", None, None), ("Pendientes", None, None)]),
    ("14 - Balance interno y balance anterior", [("D12 Balance propio", None, None), ("D11 Balance contador", None, None)]),
]

wb = openpyxl.load_workbook(xlsx)
pdf = pdf_links.Pdf(completo, wb.sheetnames)
lector = PdfReader(completo)


def pagina_del_titulo(hoja, comienzo):
    """Página donde está el título de sección que empieza con `comienzo` (la última aparición: el título, no una mención)."""
    ws = wb[hoja]
    for r in range(1, ws.max_row + 1):
        c = ws.cell(r, 2)
        if isinstance(c.value, str) and c.value.startswith(comienzo) and c.font and c.font.underline and c.font.bold:
            ap = pdf.buscar(hoja, pdf_links.fichas(c.value)[:6])
            if ap:
                return ap[-1][0]
    raise SystemExit(f"No encontré la sección «{comienzo}» en {hoja}")


os.makedirs(salida, exist_ok=True)
usadas = set()
for nombre, tramos in PARTES:
    paginas = []
    for hoja, desde, hasta in tramos:
        ps = pdf.paginas(hoja)
        if not ps:
            print("  (sin páginas)", hoja)
            continue
        a = pagina_del_titulo(hoja, desde) if desde else ps[0]
        b = pagina_del_titulo(hoja, hasta) if hasta else ps[-1]      # la página donde empieza el otro tramo va en los dos
        paginas += [i for i in ps if a <= i <= b]
    esc = PdfWriter()
    for i in paginas:
        pg = lector.pages[i]
        if "/Annots" in pg:   # los links van a páginas de otro PDF: se sacan
            pg[NameObject("/Annots")] = ArrayObject([x for x in pg["/Annots"] if x.get_object().get("/Subtype") != "/Link"])
        esc.add_page(pg)
    with open(os.path.join(salida, nombre + ".pdf"), "wb") as fh:
        esc.write(fh)
    usadas.update(paginas)
    print(f"{nombre}: {len(paginas)} páginas (de la {paginas[0] + 1} a la {paginas[-1] + 1})")
faltan = [i + 1 for i in range(len(lector.pages)) if i not in usadas]
print("páginas del completo:", len(lector.pages), "· en algún PDF:", len(usadas), "· sin ubicar:", faltan or "ninguna")
