import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Supplier } from '@/types'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  Building2,
  Mail,
  Phone,
  CreditCard,
} from 'lucide-react'

export default function ManageSuppliers() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierToDelete, setSupplierToDelete] = useState<number | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    bank_name: '',
    bank_account_number: '',
    bank_branch: '',
    bank_swift: '',
    notes: '',
    status: 'active',
  })

  // Fetch suppliers
  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await api.getSuppliers()
      return response.data.data || []
    },
  })

  // Create supplier mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier created successfully')
      setShowCreateDialog(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create supplier')
    },
  })

  // Update supplier mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof formData> }) =>
      api.updateSupplier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier updated successfully')
      setShowEditDialog(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update supplier')
    },
  })

  // Delete supplier mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier deleted successfully')
      setShowDeleteDialog(false)
      setSupplierToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete supplier')
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      tax_id: '',
      bank_name: '',
      bank_account_number: '',
      bank_branch: '',
      bank_swift: '',
      notes: '',
      status: 'active',
    })
    setSelectedSupplier(null)
  }

  const handleCreate = () => {
    resetForm()
    setShowCreateDialog(true)
  }

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setFormData({
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      tax_id: supplier.tax_id || '',
      bank_name: supplier.bank_name || '',
      bank_account_number: supplier.bank_account_number || '',
      bank_branch: supplier.bank_branch || '',
      bank_swift: supplier.bank_swift || '',
      notes: supplier.notes || '',
      status: supplier.status || 'active',
    })
    setShowEditDialog(true)
  }

  const handleDelete = (id: number) => {
    setSupplierToDelete(id)
    setShowDeleteDialog(true)
  }

  const submitCreate = () => {
    if (!formData.name) {
      toast.error('Please enter supplier name')
      return
    }
    createMutation.mutate(formData)
  }

  const submitUpdate = () => {
    if (!selectedSupplier) return
    if (!formData.name) {
      toast.error('Please enter supplier name')
      return
    }
    updateMutation.mutate({ id: selectedSupplier.id, data: formData })
  }

  const confirmDelete = () => {
    if (supplierToDelete) {
      deleteMutation.mutate(supplierToDelete)
    }
  }

  // Filter suppliers
  const filteredSuppliers = suppliers?.filter((supplier: Supplier) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      supplier.name.toLowerCase().includes(query) ||
      supplier.email?.toLowerCase().includes(query) ||
      supplier.phone?.toLowerCase().includes(query) ||
      supplier.tax_id?.toLowerCase().includes(query)
    )
  })

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
          <h1 className="text-3xl font-bold">Manage Suppliers</h1>
          <p className="text-muted-foreground">Vendor and supplier management</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, or tax ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Suppliers List */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers ({filteredSuppliers?.length || 0})</CardTitle>
          <CardDescription>All registered vendors and suppliers</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSuppliers && filteredSuppliers.length > 0 ? (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Contact</th>
                      <th className="text-left p-3 font-medium">Tax ID</th>
                      <th className="text-left p-3 font-medium">Bank</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier: Supplier) => (
                      <tr key={supplier.id} className="border-b hover:bg-accent/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{supplier.name}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1 text-sm">
                            {supplier.email && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {supplier.email}
                              </div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {supplier.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {supplier.tax_id || '-'}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {supplier.bank_name || '-'}
                        </td>
                        <td className="p-3 text-center">
                          {supplier.status === 'active' ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(supplier)}
                              title="Edit supplier"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(supplier.id)}
                              title="Delete supplier"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredSuppliers.map((supplier: Supplier) => (
                  <Card key={supplier.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <p className="font-semibold">{supplier.name}</p>
                            </div>
                            {supplier.email && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {supplier.email}
                              </div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {supplier.phone}
                              </div>
                            )}
                          </div>
                          {supplier.status === 'active' ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </div>

                        {supplier.tax_id && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Tax ID:</span> {supplier.tax_id}
                          </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(supplier)}
                            className="flex-1"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(supplier.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No suppliers found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery ? 'Try adjusting your search' : 'Get started by adding your first supplier'}
              </p>
              {!searchQuery && (
                <div className="mt-6">
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Supplier
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false)
          setShowEditDialog(false)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showCreateDialog ? 'Create New Supplier' : 'Edit Supplier'}</DialogTitle>
            <DialogDescription>
              {showCreateDialog ? 'Add a new supplier to the system' : 'Update supplier information'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Basic Information
              </h3>

              <div className="space-y-2">
                <Label htmlFor="name">Supplier Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ACME Corporation"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@acme.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Business St, City, Country"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID / VAT Number</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="123-456-789"
                />
              </div>
            </div>

            {/* Banking Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Banking Information
              </h3>

              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="Bank of America"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Account Number</Label>
                  <Input
                    id="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_branch">Branch</Label>
                  <Input
                    id="bank_branch"
                    value={formData.bank_branch}
                    onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                    placeholder="Main Branch"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_swift">SWIFT / BIC Code</Label>
                <Input
                  id="bank_swift"
                  value={formData.bank_swift}
                  onChange={(e) => setFormData({ ...formData, bank_swift: e.target.value })}
                  placeholder="BOFAUS3N"
                />
              </div>
            </div>

            {/* Additional Notes */}
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information about this supplier..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setShowEditDialog(false)
                resetForm()
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={showCreateDialog ? submitCreate : submitUpdate}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {showCreateDialog ? 'Creating...' : 'Updating...'}
                </>
              ) : (
                showCreateDialog ? 'Create Supplier' : 'Update Supplier'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this supplier? If the supplier has associated expenses, it will be marked as inactive instead.
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
