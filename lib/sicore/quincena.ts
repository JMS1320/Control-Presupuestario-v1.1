// Capa compartida (UI-agnóstica): quincena SICORE a partir de una fecha.
// Un solo generador para Modal + Cash Flow (antes duplicado en generarQuincenaSicore /
// generarQuincenaSicoreLocal). Ver MANUAL-USO § Pagos.
// Formato: "YY-MM - 1ra|2da" (ej. "26-06 - 1ra").

export function generarQuincenaSicore(fecha: string): string {
  const d = new Date(fecha)
  const yy = d.getFullYear().toString().slice(-2)
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${yy}-${mm} - ${d.getDate() <= 15 ? '1ra' : '2da'}`
}
