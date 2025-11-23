import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  Expense,
  Department,
  Category,
  Subcategory,
  Supplier,
  CreditCard,
  ApiResponse,
  UserFormData,
  DashboardStats,
  OCRResult
} from '@/types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Important for session-based auth
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Redirect to login if unauthorized
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async login(username: string, password: string) {
    return this.client.post<ApiResponse<{ user: User }>>('/auth/login', { username, password });
  }

  async logout() {
    return this.client.post<ApiResponse<null>>('/auth/logout');
  }

  async getCurrentUser() {
    return this.client.get<ApiResponse<User>>('/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.client.post<ApiResponse<null>>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  // Expenses
  async getExpenses(params?: { status?: string; user_id?: number; department_id?: number }) {
    return this.client.get<ApiResponse<Expense[]>>('/expenses', { params });
  }

  async getExpense(id: number) {
    return this.client.get<ApiResponse<Expense>>(`/expenses/${id}`);
  }

  async createExpense(data: FormData) {
    return this.client.post<ApiResponse<Expense>>('/expenses', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async updateExpense(id: number, data: FormData) {
    return this.client.put<ApiResponse<Expense>>(`/expenses/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async deleteExpense(id: number) {
    return this.client.delete<ApiResponse<null>>(`/expenses/${id}`);
  }

  async approveExpense(id: number) {
    return this.client.post<ApiResponse<Expense>>(`/expenses/${id}/approve`);
  }

  async rejectExpense(id: number, reason: string) {
    return this.client.post<ApiResponse<Expense>>(`/expenses/${id}/reject`, { reason });
  }

  async processDocument(file: File, documentType: 'quote' | 'invoice' | 'receipt') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    return this.client.post<ApiResponse<OCRResult>>('/expenses/process-document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async markExpensePaid(id: number) {
    return this.client.post<ApiResponse<Expense>>(`/expenses/${id}/mark-paid`);
  }

  async markExpenseUnpaid(id: number) {
    return this.client.post<ApiResponse<Expense>>(`/expenses/${id}/mark-unpaid`);
  }

  async markExpensePendingPayment(id: number) {
    return this.client.post<ApiResponse<Expense>>(`/expenses/${id}/mark-pending-payment`);
  }

  async markExternalAccounting(id: number) {
    return this.client.post<ApiResponse<Expense>>(`/expenses/${id}/mark-external-accounting`);
  }

  async unmarkExternalAccounting(id: number) {
    return this.client.post<ApiResponse<Expense>>(`/expenses/${id}/unmark-external-accounting`);
  }

  // Departments
  async getDepartments() {
    return this.client.get<ApiResponse<Department[]>>('/departments');
  }

  async getDepartment(id: number) {
    return this.client.get<ApiResponse<Department>>(`/departments/${id}`);
  }

  async createDepartment(data: { name: string; budget: number; currency: string }) {
    return this.client.post<ApiResponse<Department>>('/departments', data);
  }

  async updateDepartment(id: number, data: { name?: string; budget?: number; currency?: string }) {
    return this.client.put<ApiResponse<Department>>(`/departments/${id}`, data);
  }

  async deleteDepartment(id: number) {
    return this.client.delete<ApiResponse<null>>(`/departments/${id}`);
  }

  // Categories
  async getCategories(departmentId?: number) {
    return this.client.get<ApiResponse<Category[]>>('/categories', {
      params: { department_id: departmentId }
    });
  }

  async getCategory(id: number) {
    return this.client.get<ApiResponse<Category>>(`/categories/${id}`);
  }

  async createCategory(data: { name: string; budget: number; department_id: number }) {
    return this.client.post<ApiResponse<Category>>('/categories', data);
  }

  async updateCategory(id: number, data: { name?: string; budget?: number }) {
    return this.client.put<ApiResponse<Category>>(`/categories/${id}`, data);
  }

  async deleteCategory(id: number) {
    return this.client.delete<ApiResponse<null>>(`/categories/${id}`);
  }

  // Subcategories
  async getSubcategories(categoryId?: number) {
    return this.client.get<ApiResponse<Subcategory[]>>('/subcategories', {
      params: { category_id: categoryId }
    });
  }

  async getSubcategory(id: number) {
    return this.client.get<ApiResponse<Subcategory>>(`/subcategories/${id}`);
  }

  async createSubcategory(data: { name: string; budget: number; category_id: number }) {
    return this.client.post<ApiResponse<Subcategory>>('/subcategories', data);
  }

  async updateSubcategory(id: number, data: { name?: string; budget?: number }) {
    return this.client.put<ApiResponse<Subcategory>>(`/subcategories/${id}`, data);
  }

  async deleteSubcategory(id: number) {
    return this.client.delete<ApiResponse<null>>(`/subcategories/${id}`);
  }

  // Users
  async getUsers() {
    return this.client.get<ApiResponse<User[]>>('/users');
  }

  async getUser(id: number) {
    return this.client.get<ApiResponse<User>>(`/users/${id}`);
  }

  async createUser(data: UserFormData) {
    return this.client.post<ApiResponse<User>>('/users', data);
  }

  async updateUser(id: number, data: Partial<UserFormData>) {
    return this.client.put<ApiResponse<User>>(`/users/${id}`, data);
  }

  // New permission endpoint for new_frontend flag
  async setUserPermission(id: number, newFrontend: boolean) {
    return this.client.put<ApiResponse<null>>(`/users/${id}/permissions`, { new_frontend: newFrontend });
  }

  async deleteUser(id: number) {
    return this.client.delete<ApiResponse<null>>(`/users/${id}`);
  }

  async resetUserPassword(id: number) {
    return this.client.post<ApiResponse<{ temporary_password: string }>>(`/users/${id}/reset-password`);
  }

  // Suppliers
  async getSuppliers() {
    return this.client.get<ApiResponse<Supplier[]>>('/suppliers');
  }

  async getSupplier(id: number) {
    return this.client.get<ApiResponse<Supplier>>(`/suppliers/${id}`);
  }

  async searchSuppliers(query: string) {
    return this.client.get<ApiResponse<Supplier[]>>('/suppliers/search', { params: { q: query } });
  }

  async createSupplier(data: Partial<Supplier>) {
    return this.client.post<ApiResponse<Supplier>>('/suppliers', data);
  }

  async updateSupplier(id: number, data: Partial<Supplier>) {
    return this.client.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data);
  }

  async deleteSupplier(id: number) {
    return this.client.delete<ApiResponse<null>>(`/suppliers/${id}`);
  }

  // Credit Cards
  async getCreditCards() {
    return this.client.get<ApiResponse<CreditCard[]>>('/credit-cards');
  }

  async createCreditCard(data: { last_four_digits: string; description?: string }) {
    return this.client.post<ApiResponse<CreditCard>>('/credit-cards', data);
  }

  async updateCreditCard(id: number, data: { last_four_digits?: string; description?: string; status?: string }) {
    return this.client.put<ApiResponse<CreditCard>>(`/credit-cards/${id}`, data);
  }

  async deleteCreditCard(id: number) {
    return this.client.delete<ApiResponse<null>>(`/credit-cards/${id}`);
  }

  // Dashboard
  async getEmployeeDashboard() {
    return this.client.get<ApiResponse<DashboardStats>>('/dashboard/employee');
  }

  async getManagerDashboard() {
    return this.client.get<ApiResponse<DashboardStats>>('/dashboard/manager');
  }

  async getAdminDashboard() {
    return this.client.get<ApiResponse<DashboardStats>>('/dashboard/admin');
  }

  async getAccountingDashboard() {
    return this.client.get<ApiResponse<DashboardStats>>('/dashboard/accounting');
  }

  // Reports & Exports
  async exportAccountingExcel() {
    return this.client.get('/exports/accounting-excel', { responseType: 'blob' });
  }

  async exportDepartmentsExcel() {
    return this.client.get('/exports/departments-excel', { responseType: 'blob' });
  }
}

export const api = new ApiClient();
export default api;
