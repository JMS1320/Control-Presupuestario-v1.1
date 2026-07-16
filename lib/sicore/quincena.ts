// Capa compartida (UI-agnóstica): quincena SICORE a partir de una fecha.
// Un solo generador para Modal + Cash Flow (antes duplicado en generarQuincenaSicore /
// generarQuincenaSicoreLocal). Ver MANUAL-USO § Pagos.
// Formato: "YY-MM - 1ra|2da" (ej. "26-06 - 1ra").

export function generarQuincenaSicore(fecha: string): string {
  // Parsear la fecha como LOCAL desde el string (evita el corrimiento de zona horaria:
  // new Date("2026-07-16") es UTC medianoche → en Argentina cae al 15/07 → quincena mal).
  // fecha viene como "YYYY-MM-DD" (o ISO); tomamos los primeros 10 chars.
  const [y, m, d] = fecha.slice(0, 10).split('-')
  const yy = (y ?? '').slice(-2)
  const mm = (m ?? '01').padStart(2, '0')
  const dia = parseInt(d ?? '01', 10) || 1
  return `${yy}-${mm} - ${dia <= 15 ? '1ra' : '2da'}`
}
