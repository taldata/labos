
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '@/services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function EmployeeDashboard() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['employee-dashboard'],
    queryFn: async () => {
      const response = await api.getEmployeeDashboard()
      return response.data.data
    },
  })

  const { data: recentExpenses } = useQuery({
    queryKey: ['recent-expenses'],
    queryFn: async () => {
      const response = await api.getExpenses()
      return response.data.data?.slice(0, 5) || []
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-2 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const stats = [
    {
      title: 'Total Expenses',
      value: dashboardData?.total_expenses || 0,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: 'Pending Approval',
      value: dashboardData?.pending_expenses || 0,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    },
    {
      title: 'Approved',
      value: dashboardData?.approved_expenses || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: 'Rejected',
      value: dashboardData?.rejected_expenses || 0,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your expense overview.</p>
        </div>
        <Link to="/submit-expense">
          <Button size="lg">
            <FileText className="mr-2 h-4 w-4" />
            Submit Expense
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`p - 2 rounded - lg ${stat.bgColor} `}>
                  <Icon className={`h - 4 w - 4 ${stat.color} `} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Amount Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Amount</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboardData?.total_amount || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Amount</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboardData?.pending_amount || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved Amount</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboardData?.approved_amount || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Expenses */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>Your latest expense submissions</CardDescription>
            </div>
            <Link to="/history">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentExpenses && recentExpenses.length > 0 ? (
            <div className="space-y-4">
              {recentExpenses.map((expense: any) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{expense.description}</p>
                    <p className="text-sm text-muted-foreground">{expense.reason}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold">{formatCurrency(expense.amount, expense.currency)}</p>
                    <div className="flex items-center gap-2">
                      {expense.status === 'pending' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Pending
                        </span>
                      )}
                      {expense.status === 'approved' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Approved
                        </span>
                      )}
                      {expense.status === 'rejected' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No expenses yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by submitting your first expense.</p>
              <div className="mt-6">
                <Link to="/submit-expense">
                  <Button>
                    <FileText className="mr-2 h-4 w-4" />
                    Submit Expense
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
