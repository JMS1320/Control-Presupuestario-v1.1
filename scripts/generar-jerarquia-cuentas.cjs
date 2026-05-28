// Genera un Excel con la jerarquía de cuentas contables TAL COMO LA RECONSTRUYE EL CÓDIGO
// (replica construirRutaJerarquia de components/ui/selector-cuenta-contable.tsx).
// Uso: node scripts/generar-jerarquia-cuentas.cjs
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

// Cargar .env.local manualmente
const env = {}
fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function main() {
  const { data, error } = await supabase
    .from('cuentas_contables')
    .select('nro_cuenta, categ, cuenta_contable, cta_totalizadora, nombre_totalizadora, imputable, tipo, activo')
    .order('nro_cuenta', { ascending: true })
  if (error) { console.error('Error:', error.message); process.exit(1) }

  // Mapa categ(lower) -> nombre_totalizadora (igual que cargarJerarquia)
  const jer = new Map()
  for (const r of data) {
    if (r.nombre_totalizadora) jer.set((r.categ || '').toLowerCase(), r.nombre_totalizadora)
  }

  // Ruta subiendo por nombre_totalizadora (igual que construirRutaJerarquia)
  function rutaPadre(nt) {
    if (!nt) return ''
    const partes = [nt]; let actual = nt; const vis = new Set()
    while (true) {
      const k = actual.toLowerCase()
      if (vis.has(k)) break
      vis.add(k)
      const p = jer.get(k)
      if (!p) break
      partes.unshift(p)
      actual = p
    }
    return partes.join(' > ')
  }

  const rows = data.map(r => {
    const rp = rutaPadre(r.nombre_totalizadora)
    const rutaCompleta = rp ? `${rp} > ${r.cuenta_contable}` : r.cuenta_contable
    return {
      'Ruta jerárquica (como la ve el código)': rutaCompleta,
      'Nivel': rutaCompleta.split(' > ').length,
      'nro_cuenta': r.nro_cuenta,
      'categ': r.categ,
      'cuenta_contable': r.cuenta_contable,
      'cta_totalizadora (nro padre)': r.cta_totalizadora,
      'nombre_totalizadora (nombre padre)': r.nombre_totalizadora,
      'imputable': r.imputable,
      'tipo': r.tipo,
      'activo': r.activo,
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 70 }, { wch: 7 }, { wch: 12 }, { wch: 38 }, { wch: 38 }, { wch: 16 }, { wch: 34 }, { wch: 10 }, { wch: 10 }, { wch: 8 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Jerarquia cuentas')
  const out = path.join(__dirname, '..', 'Jerarquia_Cuentas_Contables.xlsx')
  XLSX.writeFile(wb, out)
  console.log('OK →', out, '| filas:', rows.length)
}

main()
