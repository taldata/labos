import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Building2,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  // Fetch all departments for budget overview
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.getDepartments();
      return response.data.data || [];
    },
  });

  // Fetch all users
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.getUsers();
      return response.data.data || [];
    },
  });

  // Fetch recent expenses
  const { data: expenses } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: async () => {
      const response = await api.getExpenses({});
      console.log('Expenses response:', response.data);
      return response.data.data || [];
    },
  });

  const totalUsers = users?.length || 0;
  const totalDepartments = departments?.length || 0;
  const totalExpenses = expenses?.length || 0;
  const totalBudget = departments?.reduce((sum, dept) => sum + (dept.budget || 0), 0) || 0;

  const pendingExpenses = expenses?.filter((e) => e.status === 'pending').length || 0;
  const approvedExpenses = expenses?.filter((e) => e.status === 'approved').length || 0;
  const rejectedExpenses = expenses?.filter((e) => e.status === 'rejected').length || 0;

  const totalSpent = expenses
    ?.filter((e) => e.status === 'approved')
    .reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

  const budgetUsagePercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">System administration and oversight</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">Active system users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDepartments}</div>
            <p className="text-xs text-muted-foreground">Organizational units</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExpenses}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                <Clock className="mr-1 h-3 w-3" />
                {pendingExpenses} pending
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₪{totalBudget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {budgetUsagePercentage.toFixed(1)}% utilized
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Budget Utilization</CardTitle>
            <CardDescription>Overall spending across all departments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Total Spent</span>
                  <span className="text-sm font-bold">₪{totalSpent.toLocaleString()}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${budgetUsagePercentage > 90
                      ? 'bg-destructive'
                      : budgetUsagePercentage > 75
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                      }`}
                    style={{ width: `${Math.min(budgetUsagePercentage, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    Remaining: ₪{(totalBudget - totalSpent).toLocaleString()}
                  </span>
                  <span className="text-xs font-medium">
                    {budgetUsagePercentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              {budgetUsagePercentage > 90 && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Budget Alert</p>
                    <p className="text-muted-foreground">
                      Budget utilization is above 90%. Consider reviewing expenses.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Status</CardTitle>
            <CardDescription>Distribution of expense requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Approved</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{approvedExpenses}</span>
                  <Badge variant="secondary" className="text-xs">
                    {totalExpenses > 0 ? ((approvedExpenses / totalExpenses) * 100).toFixed(0) : 0}%
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{pendingExpenses}</span>
                  <Badge variant="secondary" className="text-xs">
                    {totalExpenses > 0 ? ((pendingExpenses / totalExpenses) * 100).toFixed(0) : 0}%
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Rejected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{rejectedExpenses}</span>
                  <Badge variant="secondary" className="text-xs">
                    {totalExpenses > 0 ? ((rejectedExpenses / totalExpenses) * 100).toFixed(0) : 0}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Budget Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Department Budgets</CardTitle>
          <CardDescription>Budget allocation and spending by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departments?.map((dept) => {
              const deptExpenses =
                expenses?.filter(
                  (e) =>
                    e.status === 'approved' &&
                    e.user?.home_department_id === dept.id
                ) || [];
              const deptSpent = deptExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
              const deptPercentage = dept.budget > 0 ? (deptSpent / dept.budget) * 100 : 0;

              return (
                <div key={dept.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{dept.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {deptExpenses.length} expenses
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        ₪{deptSpent.toLocaleString()} / ₪{dept.budget.toLocaleString()}
                      </span>
                      {deptPercentage > 90 ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${deptPercentage > 90
                        ? 'bg-destructive'
                        : deptPercentage > 75
                          ? 'bg-yellow-500'
                          : 'bg-primary'
                        }`}
                      style={{ width: `${Math.min(deptPercentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Remaining: ₪{(dept.budget - deptSpent).toLocaleString()}</span>
                    <span>{deptPercentage.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link to="/admin/users">
              <div className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-medium">Manage Users</h3>
                  <p className="text-sm text-muted-foreground">Add, edit, or remove users</p>
                </div>
              </div>
            </Link>

            <Link to="/admin/suppliers">
              <div className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <Building2 className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-medium">Manage Suppliers</h3>
                  <p className="text-sm text-muted-foreground">Vendor and supplier management</p>
                </div>
              </div>
            </Link>

            <Link to="/manager/departments">
              <div className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div>
                  <h3 className="font-medium">Manage Budgets</h3>
                  <p className="text-sm text-muted-foreground">Department and budget management</p>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
