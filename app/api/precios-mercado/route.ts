import { NextResponse } from "next/server"

// Precios de hacienda de entresurcosycorralesya.com (endpoint ajax-modulo-ternero.php).
// Server-side (evita CORS). Devuelve la tabla parseada: 8 columnas por fila.
// GET /api/precios-mercado?desde=YYYY-MM-DD&hasta=YYYY-MM-DD

export interface FilaMercado {
  categoria: string
  pesoLo: number          // límite inferior del rango (kg)
  pesoHi: number | null   // límite superior (null = abierto, "+400")
  cantidad: number
  promKilo: number
  kiloMax: number
  kiloMin: number
  promBulto: number
  bultoMax: number
  bultoMin: number
}

const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0

// "Terneros 160-180 Kg." → {lo:160,hi:180} · "Terneros -100 Kg." → {lo:0,hi:100} · "Novillitos +400 Kg." → {lo:400,hi:null}
function parseRango(cat: string): { lo: number; hi: number | null } {
  const rango = cat.match(/(\d+)\s*-\s*(\d+)/)
  if (rango) return { lo: parseInt(rango[1]), hi: parseInt(rango[2]) }
  const mas = cat.match(/\+\s*(\d+)/)
  if (mas) return { lo: parseInt(mas[1]), hi: null }
  const menos = cat.match(/-\s*(\d+)/)
  if (menos) return { lo: 0, hi: parseInt(menos[1]) }
  return { lo: 0, hi: null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")
  const sexo = searchParams.get("sexo") === "hembra" ? "hembra" : "macho"
  if (!desde || !hasta) {
    return NextResponse.json({ error: "Faltan parámetros desde/hasta (YYYY-MM-DD)" }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return NextResponse.json({ error: "Fechas inválidas (formato YYYY-MM-DD)" }, { status: 400 })
  }
  try {
    const modulo = sexo === "hembra" ? "ternera" : "ternero"
    const url = `https://www.entresurcosycorralesya.com/ajax-modulo-${modulo}.php?desde=${desde}&hasta=${hasta}`
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
      if (/holando/i.test(categoria)) continue // lechera, otro mercado
      const { lo, hi } = parseRango(categoria)
      filas.push({
        categoria,
        pesoLo: lo,
        pesoHi: hi,
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
