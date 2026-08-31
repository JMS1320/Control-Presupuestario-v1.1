import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * 🔐 Lectura de las notas — DEL LADO DEL SERVIDOR, a propósito (A-SEC-04).
 *
 * Antes el navegador leía `notas_para_claude` directo con la clave `anon`, que es **pública**
 * (viaja en el bundle). Con las tablas sin RLS, eso significaba que cualquiera que llegara a la API
 * podía **bajarse todas las notas** — y las notas guardaban la ruta-password en claro.
 *
 * El fix del lado del dato tiene dos mitades y ésta es la segunda:
 *  1. la nota ya no guarda la llave (`rutaSinLlave()` en `notas-para-claude.tsx`);
 *  2. **`anon` pierde el permiso de LEER** estas tablas — sólo puede INSERTAR, que es lo que la
 *     app necesita para que dejar una nota siga siendo instantáneo.
 *
 * Como leer deja de ser posible desde el navegador, la lista pasa por acá, donde la
 * `SERVICE_ROLE_KEY` **nunca sale del servidor** y saltea la RLS.
 *
 * ⚠️ Esto NO reemplaza a A-SEC-03 (usuarios de verdad): mientras todo el mundo entre como `anon`,
 * este endpoint tampoco sabe *quién* pregunta. Lo que sí hace es que la puerta abierta deje de dar
 * a la tabla entera.
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("notas_para_claude")
      .select("id, titulo, estado, resultado, created_at, notas_capturas(count)")
      .order("created_at", { ascending: false })
      .limit(30)

    if (error) throw error
    return NextResponse.json({ notas: data ?? [] })
  } catch (e) {
    // Que falle la lista no puede romper la pantalla: el botón de notas tiene que seguir andando.
    return NextResponse.json(
      { notas: [], error: (e as Error).message },
      { status: 500 },
    )
  }
}
