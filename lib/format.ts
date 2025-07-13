export function formatNumber(value: number, showDecimals = true): string {
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
    useGrouping: true,
    signDisplay: "auto", // Esto asegura que se muestren los signos + y -
  }

  return new Intl.NumberFormat("es-AR", options).format(value)
}

export function getMonthName(monthNumber: number): string {
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ]
  return months[monthNumber - 1]
}
