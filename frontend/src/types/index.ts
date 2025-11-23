// User types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_manager: boolean;
  is_admin: boolean;
  is_accounting: boolean;
  active: boolean;
  home_department_id: number | null;
  home_department?: Department;
  managed_departments?: Department[];
  new_frontend?: boolean;
}

// Department types
export interface Department {
  id: number;
  name: string;
  budget: number;
  currency: string;
  categories?: Category[];
}

// Category types
export interface Category {
  id: number;
  name: string;
  budget: number;
  department_id: number;
  department?: Department;
  subcategories?: Subcategory[];
}

// Subcategory types
export interface Subcategory {
  id: number;
  name: string;
  budget: number;
  category_id: number;
  category?: Category;
}

// Expense types
export type ExpenseType = 'auto_approved' | 'needs_approval' | 'pre_approved' | 'future_approval';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';
export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'standing_order' | 'cash';
export type PaymentStatus = 'pending_attention' | 'pending_payment' | 'paid';

export interface Expense {
  id: number;
  amount: number;
  currency: string;
  description: string;
  reason: string;
  type: ExpenseType;
  status: ExpenseStatus;
  date: string;
  user_id: number;
  user?: User;
  subcategory_id: number;
  subcategory?: Subcategory;
  supplier_id: number | null;
  supplier?: Supplier;
  credit_card_id: number | null;
  credit_card?: CreditCard;
  payment_method: PaymentMethod | null;
  is_paid: boolean;
  paid_at: string | null;
  paid_by_id: number | null;
  paid_by?: User;
  payment_status: PaymentStatus;
  payment_due_date: string | null;
  invoice_date: string | null;
  manager_id: number | null;
  manager?: User;
  handled_at: string | null;
  rejection_reason: string | null;
  external_accounting_entry: boolean;
  external_accounting_entry_by_id: number | null;
  external_accounting_entry_by?: User;
  external_accounting_entry_at: string | null;
  quote_filename: string | null;
  invoice_filename: string | null;
  receipt_filename: string | null;
  created_at: string;
  updated_at: string;
}

// Supplier types
export interface Supplier {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  bank_swift: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// Credit Card types
export interface CreditCard {
  id: number;
  last_four_digits: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Form types
export interface ExpenseFormData {
  amount: number;
  currency: string;
  description: string;
  reason: string;
  type: ExpenseType;
  subcategory_id: number;
  supplier_id: number | null;
  credit_card_id: number | null;
  payment_method: PaymentMethod | null;
  invoice_date: string | null;
  payment_due_date: string | null;
  quote_file: File | null;
  invoice_file: File | null;
  receipt_file: File | null;
}

export interface UserFormData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password?: string;
  is_manager: boolean;
  is_admin: boolean;
  is_accounting: boolean;
  active: boolean;
  home_department_id: number | null;
  managed_department_ids: number[];
}

// Dashboard types
export interface DashboardStats {
  total_expenses: number;
  pending_expenses: number;
  approved_expenses: number;
  rejected_expenses: number;
  total_amount: number;
  pending_amount: number;
  approved_amount: number;
}

export interface BudgetUsage {
  department: string;
  budget: number;
  used: number;
  percentage: number;
}

// OCR types
export interface OCRResult {
  amount: number | null;
  date: string | null;
  supplier: string | null;
  invoice_number: string | null;
}
