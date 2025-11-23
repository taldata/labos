import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api from '@/services/api'
// import { useAuthStore } from '@/hooks/useAuthStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Expense } from '@/types'
import {
  FileText,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Loader2,
  Plus,
} from 'lucide-react'

export default function ExpenseHistory() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // const { user } = useAuthStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<number | null>(null)

  // Fetch expenses
  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {}
      const response = await api.getExpenses(params)
      return response.data.data || []
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] })
      toast.success('Expense deleted successfully')
      setShowDeleteDialog(false)
      setExpenseToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete expense')
    },
  })

  // Filter expenses based on search
  const filteredExpenses = expenses?.filter((expense: Expense) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      expense.description.toLowerCase().includes(query) ||
      expense.reason.toLowerCase().includes(query) ||
      expense.amount.toString().includes(query) ||
      expense.subcategory?.name.toLowerCase().includes(query)
    )
  })

  const handleViewDetails = (expense: Expense) => {
    setSelectedExpense(expense)
    setShowDetailsDialog(true)
  }

  const handleEdit = (expense: Expense) => {
    navigate(`/expense/edit/${expense.id}`)
  }

  const handleDelete = (id: number) => {
    setExpenseToDelete(id)
    setShowDeleteDialog(true)
  }

  const confirmDelete = () => {
    if (expenseToDelete) {
      deleteMutation.mutate(expenseToDelete)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>
      case 'approved':
        return <Badge variant="success">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getPaymentStatusBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid':
        return <Badge variant="success">Paid</Badge>
      case 'pending_payment':
        return <Badge variant="warning">Pending Payment</Badge>
      case 'pending_attention':
        return <Badge variant="info">Needs Attention</Badge>
      default:
        return <Badge variant="outline">{paymentStatus}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Expense History</h1>
          <p className="text-muted-foreground">View and manage all your expense submissions</p>
        </div>
        <Button onClick={() => navigate('/submit-expense')}>
          <Plus className="mr-2 h-4 w-4" />
          New Expense
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by description, reason, amount..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Expenses ({filteredExpenses?.length || 0})
          </CardTitle>
          <CardDescription>
            {statusFilter !== 'all'
              ? `Showing ${statusFilter} expenses`
              : 'Showing all expenses'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredExpenses && filteredExpenses.length > 0 ? (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="text-center p-3 font-medium">Payment</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense: Expense) => (
                      <tr key={expense.id} className="border-b hover:bg-accent/50 transition-colors">
                        <td className="p-3 text-sm text-muted-foreground">
                          {formatDate(expense.date)}
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{expense.description}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {expense.reason}
                            </p>
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          {expense.subcategory?.name || '-'}
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {formatCurrency(expense.amount, expense.currency)}
                        </td>
                        <td className="p-3 text-center">
                          {getStatusBadge(expense.status)}
                        </td>
                        <td className="p-3 text-center">
                          {getPaymentStatusBadge(expense.payment_status)}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(expense)}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {expense.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(expense)}
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(expense.id)}
                                  title="Delete"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredExpenses.map((expense: Expense) => (
                  <Card key={expense.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold">{expense.description}</p>
                            <p className="text-sm text-muted-foreground">{expense.reason}</p>
                          </div>
                          <div className="flex gap-2">
                            {getStatusBadge(expense.status)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Amount:</span>
                            <p className="font-semibold">
                              {formatCurrency(expense.amount, expense.currency)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Date:</span>
                            <p>{formatDate(expense.date)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Category:</span>
                            <p>{expense.subcategory?.name || '-'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Payment:</span>
                            <div className="mt-1">
                              {getPaymentStatusBadge(expense.payment_status)}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(expense)}
                            className="flex-1"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                          {expense.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(expense)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(expense.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No expenses found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Get started by submitting your first expense.'}
              </p>
              {!searchQuery && (
                <div className="mt-6">
                  <Button onClick={() => navigate('/submit-expense')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Submit Expense
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>Complete information about this expense</DialogDescription>
          </DialogHeader>

          {selectedExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedExpense.description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold text-lg">
                    {formatCurrency(selectedExpense.amount, selectedExpense.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedExpense.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <div className="mt-1">{getPaymentStatusBadge(selectedExpense.payment_status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p>{formatDate(selectedExpense.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p>{selectedExpense.subcategory?.name || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="mt-1">{selectedExpense.reason}</p>
              </div>

              {selectedExpense.supplier && (
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p>{selectedExpense.supplier.name}</p>
                </div>
              )}

              {selectedExpense.rejection_reason && (
                <div className="bg-destructive/10 p-4 rounded-lg">
                  <p className="text-sm font-medium text-destructive">Rejection Reason</p>
                  <p className="mt-1">{selectedExpense.rejection_reason}</p>
                </div>
              )}

              {(selectedExpense.quote_filename ||
                selectedExpense.invoice_filename ||
                selectedExpense.receipt_filename) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Attached Documents</p>
                    <div className="space-y-2">
                      {selectedExpense.quote_filename && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4" />
                          <span>Quote: {selectedExpense.quote_filename}</span>
                        </div>
                      )}
                      {selectedExpense.invoice_filename && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4" />
                          <span>Invoice: {selectedExpense.invoice_filename}</span>
                        </div>
                      )}
                      {selectedExpense.receipt_filename && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4" />
                          <span>Receipt: {selectedExpense.receipt_filename}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
            {selectedExpense?.status === 'pending' && (
              <Button onClick={() => {
                setShowDetailsDialog(false)
                handleEdit(selectedExpense)
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Expense
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
