import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import {
  Home,
  FileText,
  Building2,
  TrendingUp,
  History,
  LogOut,
  Menu,
  X,
  User,
  DollarSign,
  Users
} from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const location = useLocation()

  const navigation = [
    { name: 'Dashboard', to: '/dashboard', icon: Home, roles: ['all'] },
    { name: 'Submit Expense', to: '/submit-expense', icon: FileText, roles: ['all'] },
    { name: 'History', to: '/history', icon: History, roles: ['all'] },
    {
      name: 'Manager Dashboard',
      to: '/manager/dashboard',
      icon: TrendingUp,
      roles: ['manager'],
    },
    {
      name: 'Manage Departments',
      to: '/manager/departments',
      icon: Building2,
      roles: ['manager'],
    },
    {
      name: 'Admin Dashboard',
      to: '/admin/dashboard',
      icon: TrendingUp,
      roles: ['admin'],
    },
    { name: 'Manage Users', to: '/admin/users', icon: Users, roles: ['admin'] },
    { name: 'Manage Suppliers', to: '/admin/suppliers', icon: Building2, roles: ['admin'] },
    {
      name: 'Accounting',
      to: '/accounting/dashboard',
      icon: DollarSign,
      roles: ['accounting'],
    },
  ]

  const canAccessRoute = (roles: string[]) => {
    if (roles.includes('all')) return true
    if (roles.includes('manager') && user?.is_manager) return true
    if (roles.includes('admin') && user?.is_admin) return true
    if (roles.includes('accounting') && user?.is_accounting) return true
    return false
  }

  const filteredNavigation = navigation.filter((item) => canAccessRoute(item.roles))

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-border">
            <h1 className="text-xl font-bold text-primary">LabOS</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-muted-foreground hover:text-foreground"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.to
              return (
                <Link
                  key={item.name}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Back to Old Version */}
          <div className="px-4 pb-2">
            <a
              href="/"
              className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <History className="h-5 w-5" />
              Back to Old Version
            </a>
          </div>

          {/* User info & logout */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3 px-4 py-2 rounded-md bg-muted/50 mb-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 h-16 bg-card border-b border-border lg:hidden">
          <div className="flex h-full items-center justify-between px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold text-primary">LabOS</h1>
            <div className="w-6" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-screen p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
