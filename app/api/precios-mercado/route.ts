import { NextResponse } from "next/server"

// Precios de hacienda de entresurcosycorralesya.com (endpoint ajax-modulo-ternero.php).
// Server-side (evita CORS). Devuelve la tabla parseada: 8 columnas por fila.
// GET /api/precios-mercado?desde=YYYY-MM-DD&hasta=YYYY-MM-DD

export interface FilaMercado {
  categoria: string
  cantidad: number
  promKilo: number
  kiloMax: number
  kiloMin: number
  promBulto: number
  bultoMax: number
  bultoMin: number
}

const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")
  if (!desde || !hasta) {
    return NextResponse.json({ error: "Faltan parámetros desde/hasta (YYYY-MM-DD)" }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return NextResponse.json({ error: "Fechas inválidas (formato YYYY-MM-DD)" }, { status: 400 })
  }
  try {
    const url = `https://www.entresurcosycorralesya.com/ajax-modulo-ternero.php?desde=${desde}&hasta=${hasta}`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest" },
      cache: "no-store",
    })
    if (!res.ok) return NextResponse.json({ error: `La web respondió ${res.status}` }, { status: 502 })
    const html = await res.text()

    const filas: FilaMercado[] = []
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let m: RegExpExecArray | null
    while ((m = trRe.exec(html)) !== null) {
      const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x => x[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim())
      if (tds.length < 8) continue
      const categoria = tds[0]
      if (!/kg/i.test(categoria)) continue // salta header / filas sin categoría
      filas.push({
        categoria,
        cantidad: num(tds[1]),
        promKilo: num(tds[2]),
        kiloMax: num(tds[3]),
        kiloMin: num(tds[4]),
        promBulto: num(tds[5]),
        bultoMax: num(tds[6]),
        bultoMin: num(tds[7]),
      })
    }

    if (!filas.length) {
      return NextResponse.json({ error: "No se pudo parsear la tabla (¿cambió la estructura de la web?)" }, { status: 502 })
    }
    return NextResponse.json({ desde, hasta, filas })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
