import DashboardShell from '@/components/DashboardShell'
import { AuthProvider } from '@/components/AuthProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider><DashboardShell>{children}</DashboardShell></AuthProvider>
}
