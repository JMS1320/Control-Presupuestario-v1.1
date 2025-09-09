import { redirect } from 'next/navigation'

export default function Page() {
  // Redirigir a página de error cuando acceden a la raíz
  redirect('/no-access')
}
