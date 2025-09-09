import { getRoleFromRoute } from '@/config/access-routes'
import { redirect } from 'next/navigation'
import ControlPresupuestario from '@/dashboard'

interface Props {
  params: { accessRoute: string }
}

export default function AccessPage({ params }: Props) {
  const userRole = getRoleFromRoute(params.accessRoute)
  
  // Si la ruta no existe en la configuración, redirigir a error
  if (!userRole) {
    redirect('/no-access')
  }
  
  return <ControlPresupuestario userRole={userRole as 'admin' | 'contable'} />
}