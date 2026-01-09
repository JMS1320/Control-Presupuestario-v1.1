import { getRoleFromRoute } from '@/config/access-routes'
import { redirect } from 'next/navigation'
import ControlPresupuestario from '@/dashboard'

interface Props {
  params: Promise<{ accessRoute: string }>
}

export default async function AccessPage({ params }: Props) {
  const { accessRoute } = await params
  const userRole = getRoleFromRoute(accessRoute)

  // Si la ruta no existe en la configuración, redirigir a error
  if (!userRole) {
    redirect('/no-access')
  }

  return <ControlPresupuestario userRole={userRole as 'admin' | 'contable'} />
}