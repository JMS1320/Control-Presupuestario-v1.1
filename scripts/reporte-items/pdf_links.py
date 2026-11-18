# -*- coding: utf-8 -*-
"""Páginas y links del PDF del reporte (JMS 18/11: «¿podríamos hacer que los links anden en el pdf?» · «el índice debe apuntar a
un nro de hoja también (súper importante)»).

Excel, al exportar a PDF, pierde los links que van a otra hoja del mismo libro, y el índice no puede saber en qué página cae
cada ítem hasta que el PDF existe. Dos pasos, los dos leen el PDF ya exportado:

  python -P pdf_links.py paginas "<libro.xlsx>" "<pdf>"
      escribe en la hoja «Items», columna «Pág.», la página del PDF donde está cada ítem. Después hay que volver a exportar
      el PDF (la columna ya tenía su lugar: la paginación no cambia) y conviene correrlo otra vez para confirmar.

  python -P pdf_links.py links "<libro.xlsx>" "<entrada.pdf>" "<salida.pdf>"
      repone los links: busca el texto de cada link en las páginas de su hoja y lo lleva a la página donde está la celda
      destino (si no la encuentra, a la primera página de esa hoja).

La hoja de cada página se reconoce por el pie («&A», abajo a la izquierda). La página de una celda se busca por el texto de su
renglón."""
import collections
import re
import sys

import openpyxl
import pdfplumber

sys.stdout.reconfigure(encoding="utf-8")


def fichas(texto):
    """Palabras comparables de un texto: sin flechas ni signos sueltos."""
    return [w for w in re.split(r"\s+", str(texto).strip()) if re.search(r"\w", w)]


class Pdf:
    def __init__(self, ruta, hojas):
        self.pdf = pdfplumber.open(ruta)
        self.hoja_de, self.palabras, self.alto, self.cabecera = [], [], [], []
        nombres = sorted(hojas, key=len, reverse=True)
        self.primera = {}
        for i, p in enumerate(self.pdf.pages):
            ws = p.extract_words()
            pie = " ".join(w["text"] for w in ws if w["top"] > p.height - 30 and w["x0"] < p.width / 2).strip()
            n = next((s for s in nombres if pie == s or pie.startswith(s)), None)
            self.hoja_de.append(n)
            self.palabras.append([w for w in ws if 25 < w["top"] < p.height - 30 and re.search(r"\w", w["text"])])
            self.cabecera.append([w for w in ws if w["top"] <= 25 and re.search(r"\w", w["text"])])
            self.alto.append(float(p.height))
            if n and n not in self.primera:
                self.primera[n] = i

    def paginas(self, hoja):
        return [i for i, n in enumerate(self.hoja_de) if n == hoja]

    def buscar(self, hoja, f):
        """Apariciones de una secuencia de palabras en las páginas de una hoja: [(página, [palabras])], en orden."""
        out = []
        for i in self.paginas(hoja):
            ws = self.palabras[i]
            k = 0
            while k <= len(ws) - len(f):
                if all(ws[k + j]["text"] == f[j] for j in range(len(f))):
                    out.append((i, ws[k:k + len(f)]))
                    k += len(f)
                else:
                    k += 1
        return out


def pagina_de_celda(pdf, wb, destino, celda):
    """Página del PDF donde está el renglón de una celda: se busca el primer texto de ese renglón. Si no aparece, la primera
    página de la hoja."""
    base = pdf.primera.get(destino)
    if base is None:
        return None
    m = re.match(r"\$?[A-Z]+\$?(\d+)", celda or "")
    if not m:
        return base
    ws = wb[destino]
    for c in ws[int(m.group(1))]:
        if isinstance(c.value, str) and not c.value.startswith("=") and fichas(c.value):
            f = fichas(c.value)[:6]
            ap = pdf.buscar(destino, f)
            if ap:
                return ap[0][0]
            break
    return base


def links_del_libro(wb):
    out = collections.defaultdict(list)
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for c in row:
                if c.hyperlink and c.hyperlink.location and c.value is not None:
                    partes = c.hyperlink.location.split("!")
                    destino = partes[0].strip("'")
                    f = fichas(c.value)
                    if f and destino in wb.sheetnames:
                        out[ws.title].append((c.row, c.column, f, destino, partes[1] if len(partes) > 1 else "A1"))
    return out


def paso_paginas(xlsx, ruta_pdf):
    wb = openpyxl.load_workbook(xlsx)
    pdf = Pdf(ruta_pdf, wb.sheetnames)
    ws = wb["Items"]
    col = next(c.column for c in ws[next(r for r in range(1, 12) if any(str(x.value) == "Pág." for x in ws[r]))] if str(c.value) == "Pág.")
    n = cambios = 0
    for fila, columna, f, destino, celda in links_del_libro(wb)["Items"]:
        if columna != col - 1:
            continue
        pg = pagina_de_celda(pdf, wb, destino, celda)
        if pg is None:
            continue
        x = ws.cell(row=fila, column=col)
        if x.value != pg + 1:
            cambios += 1
        x.value = pg + 1
        x.number_format = "0"
        n += 1
    wb.save(xlsx)
    print(f"páginas escritas en el índice: {n} · cambiaron: {cambios} · páginas del PDF: {len(pdf.pdf.pages)}")


def paso_links(xlsx, entrada, salida):
    from PyPDF2 import PdfReader, PdfWriter
    from PyPDF2.generic import ArrayObject, DictionaryObject, FloatObject, NameObject, NumberObject
    wb = openpyxl.load_workbook(xlsx)
    pdf = Pdf(entrada, wb.sheetnames)
    lector = PdfReader(entrada)
    escritor = PdfWriter()
    for pg in lector.pages:
        escritor.add_page(pg)
    puestos = faltan = 0
    for hoja, ls in links_del_libro(wb).items():
        por_texto = collections.defaultdict(list)
        for fila, columna, f, destino, celda in sorted(ls, key=lambda x: (x[0], x[1])):
            por_texto[tuple(f)].append((destino, celda))
        for f, destinos in por_texto.items():
            ap = pdf.buscar(hoja, list(f))
            paginas = [pagina_de_celda(pdf, wb, d, c) for d, c in destinos]
            if not ap or any(p is None for p in paginas):
                faltan += len(destinos)
                continue
            unico = len(set(paginas)) == 1
            if not unico and len(ap) != len(destinos):
                faltan += len(destinos)      # no se sabe cuál es cuál: no se pone un link que lleve a otro lado
                continue
            for n, (i, ws_) in enumerate(ap):
                renglones = collections.defaultdict(list)
                for w in ws_:
                    renglones[round(w["top"])].append(w)
                for grupo in renglones.values():
                    x0, x1 = min(w["x0"] for w in grupo) - 1, max(w["x1"] for w in grupo) + 1
                    arriba, abajo = min(w["top"] for w in grupo) - 1, max(w["bottom"] for w in grupo) + 1
                    # El destino tiene que ser la PÁGINA (referencia al objeto), no su número: con el número, Acrobat y los
                    # navegadores ignoran el link (así salieron las v11 a v13 al principio).
                    destino_pg = escritor.pages[paginas[0] if unico else paginas[n]]
                    pagina_ref = escritor.pages[i].indirect_reference
                    link = DictionaryObject({
                        NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Link"),
                        # números cortos (dos decimales, como texto): con 40 decimales algunos visores descartan el link
                        NameObject("/Rect"): ArrayObject([FloatObject(f"{v:.2f}") for v in
                                                          (x0, pdf.alto[i] - abajo, x1, pdf.alto[i] - arriba)]),
                        NameObject("/Border"): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0)]),
                        NameObject("/F"): NumberObject(4), NameObject("/H"): NameObject("/I"),
                        NameObject("/P"): pagina_ref,
                        NameObject("/A"): DictionaryObject({
                            NameObject("/Type"): NameObject("/Action"), NameObject("/S"): NameObject("/GoTo"),
                            NameObject("/D"): ArrayObject([destino_pg.indirect_reference, NameObject("/Fit")])}),
                    })
                    pagina = escritor.pages[i]
                    if "/Annots" not in pagina:
                        pagina[NameObject("/Annots")] = ArrayObject()
                    pagina["/Annots"].append(escritor._add_object(link))
                puestos += 1
    # «Volver al índice» del encabezado de cada página → primera página del índice
    volver = 0
    if "Items" in pdf.primera:
        for i, ws_ in enumerate(pdf.cabecera):
            for k in range(len(ws_) - 2):
                if [w["text"] for w in ws_[k:k + 3]] == ["Volver", "al", "índice"]:
                    g = ws_[k:k + 3]
                    x0, x1 = min(w["x0"] for w in g) - 2, max(w["x1"] for w in g) + 2
                    arriba, abajo = min(w["top"] for w in g) - 2, max(w["bottom"] for w in g) + 2
                    pagina = escritor.pages[i]
                    link = DictionaryObject({
                        NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Link"),
                        NameObject("/Rect"): ArrayObject([FloatObject(f"{v:.2f}") for v in
                                                          (x0, pdf.alto[i] - abajo, x1, pdf.alto[i] - arriba)]),
                        NameObject("/Border"): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0)]),
                        NameObject("/F"): NumberObject(4), NameObject("/H"): NameObject("/I"),
                        NameObject("/P"): pagina.indirect_reference,
                        NameObject("/A"): DictionaryObject({
                            NameObject("/Type"): NameObject("/Action"), NameObject("/S"): NameObject("/GoTo"),
                            NameObject("/D"): ArrayObject([escritor.pages[pdf.primera["Items"]].indirect_reference,
                                                           NameObject("/Fit")])}),
                    })
                    if "/Annots" not in pagina:
                        pagina[NameObject("/Annots")] = ArrayObject()
                    pagina["/Annots"].append(escritor._add_object(link))
                    volver += 1
                    break
    print(f"«Volver al índice» del encabezado: {volver} páginas de {len(lector.pages)}")
    with open(salida, "wb") as fh:
        escritor.write(fh)
    print(f"links puestos en el PDF: {puestos} · links del Excel sin poner: {faltan} · páginas: {len(lector.pages)}")
    print("guardado:", salida)


if __name__ == "__main__":
    if sys.argv[1] == "paginas":
        paso_paginas(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "links":
        paso_links(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        raise SystemExit("uso: pdf_links.py paginas|links …")
