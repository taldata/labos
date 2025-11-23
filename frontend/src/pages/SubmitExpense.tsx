import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import api from '@/services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import FileUpload from '@/components/FileUpload'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'

// Form validation schema
const expenseSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string(),
  description: z.string().min(1, 'Description is required'),
  reason: z.string().min(1, 'Reason is required'),
  type: z.enum(['auto_approved', 'needs_approval', 'pre_approved', 'future_approval']),
  department_id: z.number().optional(),
  category_id: z.number().optional(),
  subcategory_id: z.number({ required_error: 'Subcategory is required' }),
  supplier_id: z.number().optional().nullable(),
  credit_card_id: z.number().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  invoice_date: z.string().optional().nullable(),
  payment_due_date: z.string().optional().nullable(),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

export default function SubmitExpense() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = Boolean(id)

  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [quoteFile, setQuoteFile] = useState<File | null>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [processingOCR, setProcessingOCR] = useState(false)
  const [supplierSearch] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      currency: 'ILS',
      type: 'needs_approval',
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

  // Fetch categories for selected department
  const { data: categories } = useQuery({
    queryKey: ['categories', selectedDepartment],
    queryFn: async () => {
      if (!selectedDepartment) return []
      const response = await api.getCategories(selectedDepartment)
      return response.data.data || []
    },
    enabled: !!selectedDepartment,
  })

  // Fetch subcategories for selected category
  const { data: subcategories } = useQuery({
    queryKey: ['subcategories', selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return []
      const response = await api.getSubcategories(selectedCategory)
      return response.data.data || []
    },
    enabled: !!selectedCategory,
  })

  // Fetch suppliers with search
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', supplierSearch],
    queryFn: async () => {
      if (supplierSearch.length < 2) {
        const response = await api.getSuppliers()
        return response.data.data || []
      }
      const response = await api.searchSuppliers(supplierSearch)
      return response.data.data || []
    },
  })

  // Fetch credit cards
  const { data: creditCards } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: async () => {
      const response = await api.getCreditCards()
      return response.data.data || []
    },
  })

  // Fetch existing expense if editing
  const { data: existingExpense, isLoading: loadingExpense } = useQuery({
    queryKey: ['expense', id],
    queryFn: async () => {
      const response = await api.getExpense(Number(id))
      return response.data.data
    },
    enabled: isEditing,
  })

  // Populate form when editing
  useEffect(() => {
    if (existingExpense && isEditing) {
      setValue('amount', existingExpense.amount)
      setValue('currency', existingExpense.currency)
      setValue('description', existingExpense.description)
      setValue('reason', existingExpense.reason)
      setValue('type', existingExpense.type as any)
      setValue('subcategory_id', existingExpense.subcategory_id)
      setValue('supplier_id', existingExpense.supplier_id)
      setValue('credit_card_id', existingExpense.credit_card_id)
      setValue('payment_method', existingExpense.payment_method)
      setValue('invoice_date', existingExpense.invoice_date?.split('T')[0])
      setValue('payment_due_date', existingExpense.payment_due_date?.split('T')[0])

      // Set selected department and category for cascading dropdowns
      if (existingExpense.subcategory?.category) {
        const category = existingExpense.subcategory.category
        setSelectedCategory(category.id)
        if (category.department) {
          setSelectedDepartment(category.department.id)
        }
      }
    }
  }, [existingExpense, isEditing, setValue])

  // OCR Processing
  const handleOCRProcess = async (file: File, documentType: 'quote' | 'invoice' | 'receipt') => {
    try {
      setProcessingOCR(true)
      const response = await api.processDocument(file, documentType)
      const result = response.data.data

      if (result) {
        if (result.amount) {
          setValue('amount', result.amount)
          toast.success('Amount extracted from document!')
        }
        if (result.date) {
          setValue('invoice_date', result.date)
          toast.success('Date extracted from document!')
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'OCR processing failed')
    } finally {
      setProcessingOCR(false)
    }
  }

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const formData = new FormData()

      // Add form fields
      formData.append('amount', data.amount.toString())
      formData.append('currency', data.currency)
      formData.append('description', data.description)
      formData.append('reason', data.reason)
      formData.append('type', data.type)
      formData.append('subcategory_id', data.subcategory_id.toString())

      if (data.supplier_id) formData.append('supplier_id', data.supplier_id.toString())
      if (data.credit_card_id) formData.append('credit_card_id', data.credit_card_id.toString())
      if (data.payment_method) formData.append('payment_method', data.payment_method)
      if (data.invoice_date) formData.append('invoice_date', data.invoice_date)
      if (data.payment_due_date) formData.append('payment_due_date', data.payment_due_date)

      // Add files
      if (quoteFile) formData.append('quote_file', quoteFile)
      if (invoiceFile) formData.append('invoice_file', invoiceFile)
      if (receiptFile) formData.append('receipt_file', receiptFile)

      if (isEditing) {
        return api.updateExpense(Number(id), formData)
      } else {
        return api.createExpense(formData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] })
      toast.success(isEditing ? 'Expense updated successfully!' : 'Expense submitted successfully!')
      navigate('/dashboard')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to submit expense')
    },
  })

  const onSubmit = (data: ExpenseFormData) => {
    submitMutation.mutate(data)
  }

  if (isEditing && loadingExpense) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{isEditing ? 'Edit Expense' : 'Submit New Expense'}</h1>
          <p className="text-muted-foreground">Fill in the details below to submit your expense request</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Enter the basic details of your expense</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('amount', { valueAsNumber: true })}
                />
                {errors.amount && (
                  <p className="text-sm text-destructive">{errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select
                  value={watch('currency')}
                  onValueChange={(value) => setValue('currency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ILS">ILS (₪)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="e.g., Office supplies, Software license, etc."
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Please explain why this expense is necessary..."
                {...register('reason')}
              />
              {errors.reason && (
                <p className="text-sm text-destructive">{errors.reason.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Expense Type *</Label>
              <Select
                value={watch('type')}
                onValueChange={(value) => setValue('type', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="needs_approval">Needs Manager Approval</SelectItem>
                  <SelectItem value="auto_approved">Automatically Approved</SelectItem>
                  <SelectItem value="pre_approved">Pre-approved by Manager</SelectItem>
                  <SelectItem value="future_approval">Approval for Future Purchase</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Category Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Category</CardTitle>
            <CardDescription>Select the department and category for this expense</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={selectedDepartment?.toString()}
                  onValueChange={(value) => {
                    setSelectedDepartment(Number(value))
                    setSelectedCategory(null)
                    setValue('subcategory_id', 0)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={selectedCategory?.toString()}
                  onValueChange={(value) => {
                    setSelectedCategory(Number(value))
                    setValue('subcategory_id', 0)
                  }}
                  disabled={!selectedDepartment}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategory *</Label>
                <Select
                  value={watch('subcategory_id')?.toString()}
                  onValueChange={(value) => setValue('subcategory_id', Number(value))}
                  disabled={!selectedCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories?.map((sub: any) => (
                      <SelectItem key={sub.id} value={sub.id.toString()}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subcategory_id && (
                  <p className="text-sm text-destructive">{errors.subcategory_id.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supplier & Payment */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier & Payment Details</CardTitle>
            <CardDescription>Optional supplier and payment information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Select
                value={watch('supplier_id')?.toString() || 'none'}
                onValueChange={(value) =>
                  setValue('supplier_id', value === 'none' ? null : Number(value))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers?.map((supplier: any) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select
                  value={watch('payment_method') || 'none'}
                  onValueChange={(value) =>
                    setValue('payment_method', value === 'none' ? null : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="standing_order">Standing Order</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {watch('payment_method') === 'credit_card' && (
                <div className="space-y-2">
                  <Label htmlFor="credit_card">Credit Card</Label>
                  <Select
                    value={watch('credit_card_id')?.toString() || 'none'}
                    onValueChange={(value) =>
                      setValue('credit_card_id', value === 'none' ? null : Number(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select card" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select card</SelectItem>
                      {creditCards?.map((card: any) => (
                        <SelectItem key={card.id} value={card.id.toString()}>
                          **** {card.last_four_digits}
                          {card.description && ` - ${card.description}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Invoice Date</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  {...register('invoice_date')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_due_date">Payment Due Date</Label>
                <Input
                  id="payment_due_date"
                  type="date"
                  {...register('payment_due_date')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Upload relevant documents. OCR will automatically extract information from invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload
              label="Quote"
              value={quoteFile}
              onChange={setQuoteFile}
              onOCRProcess={(file) => handleOCRProcess(file, 'quote')}
              processing={processingOCR}
            />

            <FileUpload
              label="Invoice"
              value={invoiceFile}
              onChange={setInvoiceFile}
              onOCRProcess={(file) => handleOCRProcess(file, 'invoice')}
              processing={processingOCR}
            />

            <FileUpload
              label="Receipt"
              value={receiptFile}
              onChange={setReceiptFile}
              onOCRProcess={(file) => handleOCRProcess(file, 'receipt')}
              processing={processingOCR}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitMutation.isPending}>
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditing ? 'Update Expense' : 'Submit Expense'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
