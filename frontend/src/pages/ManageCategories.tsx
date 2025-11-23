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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, ChevronRight, ChevronDown, FolderTree, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Department, Category, Subcategory } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ManageCategories() {
    const queryClient = useQueryClient();
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [expandedCategories, setExpandedCategories] = useState<number[]>([]);

    // Dialog states
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
    const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null);

    // Form states
    const [itemName, setItemName] = useState('');
    const [itemBudget, setItemBudget] = useState('');

    // Fetch Departments
    const { data: departments } = useQuery({
        queryKey: ['departments'],
        queryFn: async () => {
            const response = await api.getDepartments();
            return response.data.data || [];
        },
    });

    // Fetch Categories (dependent on selected department)
    const { data: categories, isLoading: categoriesLoading } = useQuery({
        queryKey: ['categories', selectedDepartmentId],
        queryFn: async () => {
            if (!selectedDepartmentId) return [];
            const response = await api.getCategories(parseInt(selectedDepartmentId));
            return response.data.data || [];
        },
        enabled: !!selectedDepartmentId,
    });

    // Mutations - Category
    const createCategoryMutation = useMutation({
        mutationFn: (data: { name: string; budget: number; department_id: number }) =>
            api.createCategory(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast.success('Category created');
            setIsCategoryDialogOpen(false);
            resetForms();
        },
    });

    const updateCategoryMutation = useMutation({
        mutationFn: (data: { id: number; name: string; budget: number }) =>
            api.updateCategory(data.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast.success('Category updated');
            setIsCategoryDialogOpen(false);
            resetForms();
        },
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: (id: number) => api.deleteCategory(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast.success('Category deleted');
        },
    });

    // Mutations - Subcategory
    const createSubcategoryMutation = useMutation({
        mutationFn: (data: { name: string; budget: number; category_id: number }) =>
            api.createSubcategory(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subcategories'] });
            toast.success('Subcategory created');
            setIsSubcategoryDialogOpen(false);
            resetForms();
        },
    });

    const updateSubcategoryMutation = useMutation({
        mutationFn: (data: { id: number; name: string; budget: number }) =>
            api.updateSubcategory(data.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subcategories'] });
            toast.success('Subcategory updated');
            setIsSubcategoryDialogOpen(false);
            resetForms();
        },
    });

    const deleteSubcategoryMutation = useMutation({
        mutationFn: (id: number) => api.deleteSubcategory(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subcategories'] });
            toast.success('Subcategory deleted');
        },
    });

    const resetForms = () => {
        setItemName('');
        setItemBudget('');
        setEditingCategory(null);
        setEditingSubcategory(null);
        setTargetCategoryId(null);
    };

    const handleOpenCategoryDialog = (category?: Category) => {
        resetForms();
        if (category) {
            setEditingCategory(category);
            setItemName(category.name);
            setItemBudget(category.budget.toString());
        }
        setIsCategoryDialogOpen(true);
    };

    const handleOpenSubcategoryDialog = (categoryId: number, subcategory?: Subcategory) => {
        resetForms();
        setTargetCategoryId(categoryId);
        if (subcategory) {
            setEditingSubcategory(subcategory);
            setItemName(subcategory.name);
            setItemBudget(subcategory.budget.toString());
        }
        setIsSubcategoryDialogOpen(true);
    };

    const handleCategorySubmit = () => {
        if (!selectedDepartmentId || !itemName) return;
        const budget = parseFloat(itemBudget) || 0;

        if (editingCategory) {
            updateCategoryMutation.mutate({ id: editingCategory.id, name: itemName, budget });
        } else {
            createCategoryMutation.mutate({
                name: itemName,
                budget,
                department_id: parseInt(selectedDepartmentId)
            });
        }
    };

    const handleSubcategorySubmit = () => {
        if (!targetCategoryId || !itemName) return;
        const budget = parseFloat(itemBudget) || 0;

        if (editingSubcategory) {
            updateSubcategoryMutation.mutate({ id: editingSubcategory.id, name: itemName, budget });
        } else {
            createSubcategoryMutation.mutate({
                name: itemName,
                budget,
                category_id: targetCategoryId
            });
        }
    };

    const toggleCategoryExpand = (categoryId: number) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Manage Categories</h1>
                    <p className="text-muted-foreground">Organize budget categories and subcategories</p>
                </div>
                <div className="flex items-center gap-4">
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent>
                            {departments?.map((dept: Department) => (
                                <SelectItem key={dept.id} value={dept.id.toString()}>
                                    {dept.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        onClick={() => handleOpenCategoryDialog()}
                        disabled={!selectedDepartmentId}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Category
                    </Button>
                </div>
            </div>

            {!selectedDepartmentId ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                        <FolderTree className="h-12 w-12 mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold">No Department Selected</h3>
                        <p>Please select a department to manage its categories.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {categoriesLoading ? (
                        <div className="text-center py-8">Loading categories...</div>
                    ) : categories?.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <Layers className="h-12 w-12 mb-4 opacity-20" />
                                <h3 className="text-lg font-semibold">No Categories</h3>
                                <p>This department has no categories yet.</p>
                                <Button variant="link" onClick={() => handleOpenCategoryDialog()}>
                                    Create the first one
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        categories?.map((category: Category) => (
                            <CategoryItem
                                key={category.id}
                                category={category}
                                isExpanded={expandedCategories.includes(category.id)}
                                onToggleExpand={() => toggleCategoryExpand(category.id)}
                                onEdit={() => handleOpenCategoryDialog(category)}
                                onDelete={() => deleteCategoryMutation.mutate(category.id)}
                                onAddSubcategory={() => handleOpenSubcategoryDialog(category.id)}
                                onEditSubcategory={(sub) => handleOpenSubcategoryDialog(category.id, sub)}
                                onDeleteSubcategory={(id) => deleteSubcategoryMutation.mutate(id)}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Category Dialog */}
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
                        <DialogDescription>
                            {editingCategory ? 'Update category details' : 'Create a new budget category'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input value={itemName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemName(e.target.value)} placeholder="e.g., Office Supplies" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Budget</label>
                            <Input type="number" value={itemBudget} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemBudget(e.target.value)} placeholder="0.00" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCategorySubmit}>{editingCategory ? 'Update' : 'Create'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Subcategory Dialog */}
            <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSubcategory ? 'Edit Subcategory' : 'New Subcategory'}</DialogTitle>
                        <DialogDescription>
                            {editingSubcategory ? 'Update subcategory details' : 'Create a new budget subcategory'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input value={itemName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemName(e.target.value)} placeholder="e.g., Paper & Ink" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Budget</label>
                            <Input type="number" value={itemBudget} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemBudget(e.target.value)} placeholder="0.00" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSubcategoryDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubcategorySubmit}>{editingSubcategory ? 'Update' : 'Create'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Sub-component for rendering a category and its subcategories
function CategoryItem({
    category,
    isExpanded,
    onToggleExpand,
    onEdit,
    onDelete,
    onAddSubcategory,
    onEditSubcategory,
    onDeleteSubcategory
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
    // Fetch subcategories for this category
    const { data: subcategories, isLoading } = useQuery({
        queryKey: ['subcategories', category.id],
        queryFn: async () => {
            const response = await api.getSubcategories(category.id);
            return response.data.data || [];
        },
        enabled: isExpanded, // Only fetch when expanded
    });

    return (
        <Card>
            <div className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={onToggleExpand}>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div className="font-medium">{category.name}</div>
                    <Badge variant="secondary" className="text-xs">Budget: {category.budget}</Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={onEdit}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm('Delete category?')) onDelete();
                    }} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
            </div>

            {isExpanded && (
                <div className="border-t bg-muted/20 p-4 pl-10 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Subcategories</h4>
                        <Button size="sm" variant="outline" className="h-7" onClick={onAddSubcategory}>
                            <Plus className="mr-1 h-3 w-3" /> Add Subcategory
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="text-sm text-muted-foreground">Loading subcategories...</div>
                    ) : subcategories?.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic">No subcategories found.</div>
                    ) : (
                        <div className="grid gap-2">
                            {subcategories?.map((sub: Subcategory) => (
                                <div key={sub.id} className="flex items-center justify-between bg-background p-2 rounded border">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium">{sub.name}</span>
                                        <span className="text-xs text-muted-foreground">Budget: {sub.budget}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditSubcategory(sub)}>
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => {
                                            if (confirm('Delete subcategory?')) onDeleteSubcategory(sub.id);
                                        }}>
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
