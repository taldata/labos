import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, ChevronRight, ChevronDown, Building2, Layers, FolderTree } from 'lucide-react';
import { toast } from 'sonner';
import { Department, Category, Subcategory } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type DialogMode = 'department' | 'category' | 'subcategory';

export default function ManageDepartments() {
  const queryClient = useQueryClient();

  // Expanded state
  const [expandedDepartments, setExpandedDepartments] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('department');
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [targetDepartmentId, setTargetDepartmentId] = useState<number | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null);

  // Form states
  const [itemName, setItemName] = useState('');
  const [itemBudget, setItemBudget] = useState('');
  const [itemCurrency, setItemCurrency] = useState('ILS');

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.getDepartments();
      return response.data.data || [];
    },
  });

  // Department mutations
  const createDepartmentMutation = useMutation({
    mutationFn: (data: { name: string; budget: number; currency: string }) =>
      api.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department created');
      setDialogOpen(false);
      resetForms();
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: (data: { id: number; name: string; budget: number; currency: string }) =>
      api.updateDepartment(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department updated');
      setDialogOpen(false);
      resetForms();
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: (id: number) => api.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department deleted');
    },
  });

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; budget: number; department_id: number }) =>
      api.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Category created');
      setDialogOpen(false);
      resetForms();
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: (data: { id: number; name: string; budget: number }) =>
      api.updateCategory(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Category updated');
      setDialogOpen(false);
      resetForms();
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => api.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Category deleted');
    },
  });

  // Subcategory mutations
  const createSubcategoryMutation = useMutation({
    mutationFn: (data: { name: string; budget: number; category_id: number }) =>
      api.createSubcategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Subcategory created');
      setDialogOpen(false);
      resetForms();
    },
  });

  const updateSubcategoryMutation = useMutation({
    mutationFn: (data: { id: number; name: string; budget: number }) =>
      api.updateSubcategory(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Subcategory updated');
      setDialogOpen(false);
      resetForms();
    },
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: (id: number) => api.deleteSubcategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Subcategory deleted');
    },
  });

  const resetForms = () => {
    setItemName('');
    setItemBudget('');
    setItemCurrency('ILS');
    setEditingDepartment(null);
    setEditingCategory(null);
    setEditingSubcategory(null);
    setTargetDepartmentId(null);
    setTargetCategoryId(null);
  };

  const handleOpenDepartmentDialog = (department?: Department) => {
    resetForms();
    setDialogMode('department');
    if (department) {
      setEditingDepartment(department);
      setItemName(department.name);
      setItemBudget(department.budget.toString());
      setItemCurrency(department.currency);
    }
    setDialogOpen(true);
  };

  const handleOpenCategoryDialog = (departmentId: number, category?: Category) => {
    resetForms();
    setDialogMode('category');
    setTargetDepartmentId(departmentId);
    if (category) {
      setEditingCategory(category);
      setItemName(category.name);
      setItemBudget(category.budget.toString());
    }
    setDialogOpen(true);
  };

  const handleOpenSubcategoryDialog = (categoryId: number, subcategory?: Subcategory) => {
    resetForms();
    setDialogMode('subcategory');
    setTargetCategoryId(categoryId);
    if (subcategory) {
      setEditingSubcategory(subcategory);
      setItemName(subcategory.name);
      setItemBudget(subcategory.budget.toString());
    }
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!itemName) return;
    const budget = parseFloat(itemBudget) || 0;

    if (dialogMode === 'department') {
      if (editingDepartment) {
        updateDepartmentMutation.mutate({ id: editingDepartment.id, name: itemName, budget, currency: itemCurrency });
      } else {
        createDepartmentMutation.mutate({ name: itemName, budget, currency: itemCurrency });
      }
    } else if (dialogMode === 'category') {
      if (editingCategory) {
        updateCategoryMutation.mutate({ id: editingCategory.id, name: itemName, budget });
      } else {
        if (!targetDepartmentId) return;
        createCategoryMutation.mutate({ name: itemName, budget, department_id: targetDepartmentId });
      }
    } else if (dialogMode === 'subcategory') {
      if (editingSubcategory) {
        updateSubcategoryMutation.mutate({ id: editingSubcategory.id, name: itemName, budget });
      } else {
        if (!targetCategoryId) return;
        createSubcategoryMutation.mutate({ name: itemName, budget, category_id: targetCategoryId });
      }
    }
  };

  const toggleDepartmentExpand = (deptId: number) => {
    setExpandedDepartments(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const toggleCategoryExpand = (catId: number) => {
    setExpandedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Manage Budget Structure</h1>
          <p className="text-muted-foreground">Organize departments, categories, and subcategories</p>
        </div>
        <Button onClick={() => handleOpenDepartmentDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Add Department
        </Button>
      </div>

      <div className="space-y-4">
        {departments?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mb-4 opacity-20" />
              <h3 className="text-lg font-semibold">No Departments</h3>
              <p>Create your first department to get started.</p>
            </CardContent>
          </Card>
        ) : (
          departments?.map((dept: Department) => (
            <DepartmentItem
              key={dept.id}
              department={dept}
              isExpanded={expandedDepartments.includes(dept.id)}
              onToggleExpand={() => toggleDepartmentExpand(dept.id)}
              onEdit={() => handleOpenDepartmentDialog(dept)}
              onDelete={() => {
                if (confirm('Delete department?')) deleteDepartmentMutation.mutate(dept.id);
              }}
              onAddCategory={() => handleOpenCategoryDialog(dept.id)}
              expandedCategories={expandedCategories}
              onToggleCategoryExpand={toggleCategoryExpand}
              onEditCategory={(cat) => handleOpenCategoryDialog(dept.id, cat)}
              onDeleteCategory={(id) => {
                if (confirm('Delete category?')) deleteCategoryMutation.mutate(id);
              }}
              onAddSubcategory={handleOpenSubcategoryDialog}
              onEditSubcategory={handleOpenSubcategoryDialog}
              onDeleteSubcategory={(id) => {
                if (confirm('Delete subcategory?')) deleteSubcategoryMutation.mutate(id);
              }}
            />
          ))
        )}
      </div>

      {/* Universal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'department' && (editingDepartment ? 'Edit Department' : 'New Department')}
              {dialogMode === 'category' && (editingCategory ? 'Edit Category' : 'New Category')}
              {dialogMode === 'subcategory' && (editingSubcategory ? 'Edit Subcategory' : 'New Subcategory')}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'department' && (editingDepartment ? 'Update department details' : 'Create a new department')}
              {dialogMode === 'category' && (editingCategory ? 'Update category details' : 'Create a new budget category')}
              {dialogMode === 'subcategory' && (editingSubcategory ? 'Update subcategory details' : 'Create a new budget subcategory')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Enter name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Budget</label>
              <Input type="number" value={itemBudget} onChange={(e) => setItemBudget(e.target.value)} placeholder="0.00" />
            </div>
            {dialogMode === 'department' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Currency</label>
                <Input value={itemCurrency} onChange={(e) => setItemCurrency(e.target.value)} placeholder="ILS" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {(editingDepartment || editingCategory || editingSubcategory) ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Department Item Component
function DepartmentItem({
  department,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddCategory,
  expandedCategories,
  onToggleCategoryExpand,
  onEditCategory,
  onDeleteCategory,
  onAddSubcategory,
  onEditSubcategory,
  onDeleteSubcategory,
}: {
  department: Department;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddCategory: () => void;
  expandedCategories: number[];
  onToggleCategoryExpand: (id: number) => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: number) => void;
  onAddSubcategory: (categoryId: number, sub?: Subcategory) => void;
  onEditSubcategory: (categoryId: number, sub: Subcategory) => void;
  onDeleteSubcategory: (id: number) => void;
}) {
  const { data: categories } = useQuery({
    queryKey: ['categories', department.id],
    queryFn: async () => {
      const response = await api.getCategories(department.id);
      return response.data.data || [];
    },
    enabled: isExpanded,
  });

  return (
    <Card>
      <div className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={onToggleExpand}>
          {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
          <Building2 className="h-5 w-5 text-primary" />
          <div className="font-semibold text-lg">{department.name}</div>
          <Badge variant="secondary">Budget: {department.budget} {department.currency}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t bg-muted/20 p-4 pl-10 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Categories</h4>
            <Button size="sm" variant="outline" className="h-7" onClick={onAddCategory}>
              <Plus className="mr-1 h-3 w-3" /> Add Category
            </Button>
          </div>

          {categories?.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">No categories found.</div>
          ) : (
            categories?.map((cat: Category) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                isExpanded={expandedCategories.includes(cat.id)}
                onToggleExpand={() => onToggleCategoryExpand(cat.id)}
                onEdit={() => onEditCategory(cat)}
                onDelete={() => onDeleteCategory(cat.id)}
                onAddSubcategory={() => onAddSubcategory(cat.id)}
                onEditSubcategory={(sub) => onEditSubcategory(cat.id, sub)}
                onDeleteSubcategory={onDeleteSubcategory}
              />
            ))
          )}
        </div>
      )}
    </Card>
  );
}

// Category Item Component
function CategoryItem({
  category,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddSubcategory,
  onEditSubcategory,
  onDeleteSubcategory,
}: {
  category: Category;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSubcategory: () => void;
  onEditSubcategory: (sub: Subcategory) => void;
  onDeleteSubcategory: (id: number) => void;
}) {
  const { data: subcategories } = useQuery({
    queryKey: ['subcategories', category.id],
    queryFn: async () => {
      const response = await api.getSubcategories(category.id);
      return response.data.data || [];
    },
    enabled: isExpanded,
  });

  return (
    <Card className="ml-4">
      <div className="p-3 flex items-center justify-between hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={onToggleExpand}>
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Layers className="h-4 w-4 text-primary" />
          <div className="font-medium">{category.name}</div>
          <Badge variant="secondary" className="text-xs">Budget: {category.budget}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}><Edit className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive"><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t bg-muted/30 p-3 pl-8 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subcategories</h4>
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={onAddSubcategory}>
              <Plus className="mr-1 h-2 w-2" /> Add
            </Button>
          </div>

          {subcategories?.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No subcategories found.</div>
          ) : (
            <div className="space-y-1">
              {subcategories?.map((sub: Subcategory) => (
                <div key={sub.id} className="flex items-center justify-between bg-background p-2 rounded border">
                  <div className="flex items-center gap-3">
                    <FolderTree className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{sub.name}</span>
                    <span className="text-xs text-muted-foreground">Budget: {sub.budget}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditSubcategory(sub)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDeleteSubcategory(sub.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
