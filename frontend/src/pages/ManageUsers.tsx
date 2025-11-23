import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
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
import { Label } from '@/components/ui/label'
import { User, Department } from '@/types'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  Shield,
  ShieldCheck,
  Calculator,
} from 'lucide-react'

export default function ManageUsers() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userToDelete, setUserToDelete] = useState<number | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    is_manager: false,
    is_admin: false,
    is_accounting: false,
    active: true,
    home_department_id: null as number | null,
    managed_department_ids: [] as number[],
  })

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.getUsers()
      return response.data.data || []
    },
  })

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.getDepartments()
      return response.data.data || []
    },
  })

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully')
      setShowCreateDialog(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create user')
    },
  })

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof formData> }) =>
      api.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated successfully')
      setShowEditDialog(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update user')
    },
  })

  // Permission mutation
  const permissionMutation = useMutation({
    mutationFn: ({ id, newFrontend }: { id: number; newFrontend: boolean }) =>
      api.setUserPermission(id, newFrontend),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Permission updated')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update permission')
    },
  })

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted successfully')
      setShowDeleteDialog(false)
      setUserToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete user')
    },
  })

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      is_manager: false,
      is_admin: false,
      is_accounting: false,
      active: true,
      home_department_id: null,
      managed_department_ids: [],
    })
    setSelectedUser(null)
  }

  const handleCreate = () => {
    resetForm()
    setShowCreateDialog(true)
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setFormData({
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      password: '',
      is_manager: user.is_manager,
      is_admin: user.is_admin,
      is_accounting: user.is_accounting,
      active: user.active,
      home_department_id: user.home_department_id,
      managed_department_ids: user.managed_departments?.map(d => d.id) || [],
    })
    setShowEditDialog(true)
  }

  const handleDelete = (id: number) => {
    setUserToDelete(id)
    setShowDeleteDialog(true)
  }

  const handlePermissionChange = (id: number, checked: boolean) => {
    permissionMutation.mutate({ id, newFrontend: checked })
  }

  const submitCreate = () => {
    if (!formData.username || !formData.email || !formData.first_name || !formData.last_name) {
      toast.error('Please fill in all required fields')
      return
    }
    createMutation.mutate(formData)
  }

  const submitUpdate = () => {
    if (!selectedUser) return
    const updateData: Partial<typeof formData> = {
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      is_manager: formData.is_manager,
      is_admin: formData.is_admin,
      is_accounting: formData.is_accounting,
      active: formData.active,
      home_department_id: formData.home_department_id,
    }
    if (formData.password) {
      updateData.password = formData.password
    }
    updateMutation.mutate({ id: selectedUser.id, data: updateData })
  }

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete)
    }
  }

  // Filter users
  const filteredUsers = users?.filter((user: User) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query)
    )
  })

  if (usersLoading) {
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
          <h1 className="text-3xl font-bold">Manage Users</h1>
          <p className="text-muted-foreground">User and permission management</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers?.length || 0})</CardTitle>
          <CardDescription>All system users and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers && filteredUsers.length > 0 ? (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Username</th>
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Roles</th>
                      <th className="text-center p-3 font-medium">New UI</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user: User) => (
                      <tr key={user.id} className="border-b hover:bg-accent/50 transition-colors">
                        <td className="p-3 font-medium">{user.username}</td>
                        <td className="p-3">
                          {user.first_name} {user.last_name}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{user.email}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {user.is_admin && (
                              <Badge variant="default" className="bg-red-600">
                                <Shield className="mr-1 h-3 w-3" />
                                Admin
                              </Badge>
                            )}
                            {user.is_manager && (
                              <Badge variant="default" className="bg-blue-600">
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                Manager
                              </Badge>
                            )}
                            {user.is_accounting && (
                              <Badge variant="default" className="bg-green-600">
                                <Calculator className="mr-1 h-3 w-3" />
                                Accounting
                              </Badge>
                            )}
                            {!user.is_admin && !user.is_manager && !user.is_accounting && (
                              <Badge variant="outline">Employee</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Switch
                            checked={user.new_frontend || false}
                            onCheckedChange={(checked) => handlePermissionChange(user.id, checked)}
                          />
                        </td>
                        <td className="p-3 text-center">
                          {user.active ? (
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
                              onClick={() => handleEdit(user)}
                              title="Edit user"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(user.id)}
                              title="Delete user"
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
                {filteredUsers.map((user: User) => (
                  <Card key={user.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold">{user.username}</p>
                            <p className="text-sm text-muted-foreground">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          {user.active ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {user.is_admin && (
                            <Badge variant="default" className="bg-red-600">
                              <Shield className="mr-1 h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                          {user.is_manager && (
                            <Badge variant="default" className="bg-blue-600">
                              <ShieldCheck className="mr-1 h-3 w-3" />
                              Manager
                            </Badge>
                          )}
                          {user.is_accounting && (
                            <Badge variant="default" className="bg-green-600">
                              <Calculator className="mr-1 h-3 w-3" />
                              Accounting
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between py-2 border-t border-b">
                          <span className="text-sm font-medium">New UI Access</span>
                          <Switch
                            checked={user.new_frontend || false}
                            onCheckedChange={(checked) => handlePermissionChange(user.id, checked)}
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(user)}
                            className="flex-1"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
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
              <p className="text-muted-foreground">No users found</p>
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
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showCreateDialog ? 'Create New User' : 'Edit User'}</DialogTitle>
            <DialogDescription>
              {showCreateDialog ? 'Add a new user to the system' : 'Update user information and permissions'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="johndoe"
                disabled={showEditDialog}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

            {showCreateDialog && (
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
            )}

            {showEditDialog && (
              <div className="space-y-2">
                <Label htmlFor="password">New Password (leave blank to keep current)</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.home_department_id?.toString() || ''}
                onValueChange={(value) => setFormData({ ...formData, home_department_id: value ? parseInt(value) : null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {departments?.map((dept: Department) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Roles & Permissions</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_admin"
                  checked={formData.is_admin}
                  onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_admin: checked })}
                />
                <label htmlFor="is_admin" className="text-sm font-medium">
                  Administrator
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_manager"
                  checked={formData.is_manager}
                  onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_manager: checked })}
                />
                <label htmlFor="is_manager" className="text-sm font-medium">
                  Manager
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_accounting"
                  checked={formData.is_accounting}
                  onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_accounting: checked })}
                />
                <label htmlFor="is_accounting" className="text-sm font-medium">
                  Accounting
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked: boolean) => setFormData({ ...formData, active: checked })}
                />
                <label htmlFor="active" className="text-sm font-medium">
                  Active
                </label>
              </div>
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
                showCreateDialog ? 'Create User' : 'Update User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
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
