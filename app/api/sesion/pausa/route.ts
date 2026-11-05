import { NextResponse } from "next/server"

/**
 * 👁️ Lo consulta el vigía de la pantalla (`components/vigia-pausa.tsx`, A-BUG-1542). No hace nada a propósito: si la
 * persona está en pausa, el middleware contesta 503 antes de llegar acá; si no, 200. Así la decisión vive en un solo
 * lugar (`lib/auth/pausa.ts` vía `middleware.ts`) y este archivo no la repite.
 */
export async function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
}
