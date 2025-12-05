# Component Quick Reference Guide

Quick copy-paste examples for common UI patterns.

## 🔘 Buttons

```jsx
import { Button } from '@/components/ui';

// Primary action
<Button variant="primary">Save</Button>

// With icon
<Button variant="primary" icon="fas fa-plus">New Expense</Button>

// Loading state
<Button loading={isSubmitting}>Submitting...</Button>

// Danger action
<Button variant="danger" icon="fas fa-trash">Delete</Button>

// Ghost/subtle button
<Button variant="ghost" icon="fas fa-edit" />

// Full width
<Button variant="primary" fullWidth>Continue</Button>
```

## 📦 Cards

```jsx
import { Card } from '@/components/ui';

// Simple card
<Card>
  <h3>Title</h3>
  <p>Content</p>
</Card>

// Card with sections
<Card variant="elevated">
  <Card.Header>
    <h3>Expense Details</h3>
  </Card.Header>
  <Card.Body>
    <p>Amount: $125.50</p>
  </Card.Body>
  <Card.Footer>
    <Button variant="primary">Approve</Button>
    <Button variant="secondary">Reject</Button>
  </Card.Footer>
</Card>

// Clickable card
<Card clickable hoverable onClick={() => navigate('/details')}>
  <h3>Click me</h3>
</Card>
```

## 🏷️ Badges

```jsx
import { Badge } from '@/components/ui';

// Status badges
<Badge variant="success">Approved</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="danger">Rejected</Badge>
<Badge variant="info">In Review</Badge>

// With icon
<Badge variant="success" icon="fas fa-check">Completed</Badge>

// Rounded
<Badge variant="primary" rounded>New</Badge>

// Solid variant
<Badge variant="success-solid">Paid</Badge>
```

## 📝 Form Inputs

```jsx
import { Input, Select, Textarea } from '@/components/ui';

// Text input
<Input
  label="Expense Title"
  required
  placeholder="Enter title..."
  value={title}
  onChange={(e) => setTitle(e.target.value)}
  error={errors.title}
/>

// Input with icon
<Input
  label="Amount"
  type="number"
  icon="fas fa-dollar-sign"
  required
/>

// Select dropdown
<Select label="Category" required value={category} onChange={(e) => setCategory(e.target.value)}>
  <option value="">Select...</option>
  <option value="travel">Travel</option>
  <option value="meals">Meals</option>
</Select>

// Textarea
<Textarea
  label="Description"
  rows={4}
  placeholder="Provide details..."
  helperText="Be as specific as possible"
/>
```

## 📎 File Upload

```jsx
import { FileUpload } from '@/components/ui';

<FileUpload
  label="Attachments"
  accept=".pdf,.jpg,.jpeg,.png"
  multiple
  maxSize={5 * 1024 * 1024}
  maxFiles={5}
  onChange={(files) => setAttachments(files)}
  helperText="Upload receipts or supporting documents"
  required
/>
```

## 🔔 Toast Notifications

```jsx
import { useToast } from '@/components/ui';

function MyComponent() {
  const { success, error, warning, info } = useToast();

  const handleSubmit = async () => {
    try {
      await submitData();
      success('Expense submitted successfully!');
    } catch (err) {
      error('Failed to submit expense. Please try again.');
    }
  };

  return <Button onClick={handleSubmit}>Submit</Button>;
}

// Custom duration (default is 5000ms)
success('Saved!', 3000);
error('Error occurred!', 10000);
```

## ⏳ Loading Skeletons

```jsx
import { Skeleton } from '@/components/ui';

// Table loading
{loading ? (
  <Skeleton.Table rows={5} columns={4} />
) : (
  <DataTable data={data} />
)}

// List loading
{loading ? (
  <Skeleton.List items={3} />
) : (
  <ItemList items={items} />
)}

// Card loading
{loading ? (
  <Skeleton.Card />
) : (
  <ExpenseCard expense={expense} />
)}

// Custom skeleton
<Skeleton variant="text" width="70%" />
<Skeleton variant="avatar" />
<Skeleton variant="button" width="120px" />
<Skeleton variant="text" count={3} />
```

## 📭 Empty States

```jsx
import { EmptyState } from '@/components/ui';

<EmptyState
  icon="fa-inbox"
  title="No expenses found"
  description="You haven't submitted any expenses yet. Create your first expense to get started."
  actionLabel="Create Expense"
  onAction={() => navigate('/submit-expense')}
/>

// Small empty state
<EmptyState
  size="small"
  icon="fa-search"
  title="No results"
  description="Try adjusting your filters"
/>
```

## 📋 Complete Form Example

```jsx
import { Input, Select, Textarea, FileUpload, Button } from '@/components/ui';
import { useToast } from '@/components/ui';

function ExpenseForm() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '',
    description: '',
    files: []
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submitExpense(formData);
      success('Expense submitted successfully!');
      navigate('/my-expenses');
    } catch (err) {
      error('Failed to submit expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        label="Expense Title"
        required
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
      />

      <Input
        label="Amount"
        type="number"
        icon="fas fa-dollar-sign"
        required
        value={formData.amount}
        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
      />

      <Select
        label="Category"
        required
        value={formData.category}
        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
      >
        <option value="">Select category...</option>
        <option value="travel">Travel</option>
        <option value="meals">Meals</option>
      </Select>

      <Textarea
        label="Description"
        rows={4}
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      />

      <FileUpload
        label="Attachments"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        onChange={(files) => setFormData({ ...formData, files })}
      />

      <Button type="submit" variant="primary" loading={loading} fullWidth>
        Submit Expense
      </Button>
    </form>
  );
}
```

## 📊 Data Display Pattern

```jsx
import { Card, Badge, Button, Skeleton, EmptyState } from '@/components/ui';

function ExpenseList() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenses().then(data => {
      setExpenses(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <Skeleton.List items={5} />;
  }

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon="fa-receipt"
        title="No expenses found"
        description="Start by creating your first expense"
        actionLabel="Create Expense"
        onAction={() => navigate('/submit-expense')}
      />
    );
  }

  return (
    <div>
      {expenses.map(expense => (
        <Card key={expense.id} clickable hoverable onClick={() => navigate(`/expenses/${expense.id}`)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>{expense.title}</h3>
              <p>${expense.amount}</p>
            </div>
            <Badge variant={getStatusVariant(expense.status)}>
              {expense.status}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

## 🎯 Modal Pattern (Using Card)

```jsx
import { Card, Button } from '@/components/ui';

function ConfirmationModal({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <Card
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px', margin: '2rem auto' }}
      >
        <Card.Header>
          <h3>{title}</h3>
        </Card.Header>
        <Card.Body>
          <p>{message}</p>
        </Card.Body>
        <Card.Footer>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Confirm
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}

// CSS for modal
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

## 🎨 Status Badge Helper

```jsx
// Utility function for status badges
const getStatusBadge = (status) => {
  const variants = {
    'pending': 'warning',
    'approved': 'success',
    'rejected': 'danger',
    'paid': 'info'
  };

  const icons = {
    'pending': 'fas fa-clock',
    'approved': 'fas fa-check',
    'rejected': 'fas fa-times',
    'paid': 'fas fa-dollar-sign'
  };

  return (
    <Badge
      variant={variants[status] || 'default'}
      icon={icons[status]}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};
```

---

## 💡 Tips

1. **Always wrap your app with ToastProvider:**
   ```jsx
   <ToastProvider>
     <App />
   </ToastProvider>
   ```

2. **Use Skeleton for loading states** instead of spinners for better UX

3. **Provide helpful EmptyStates** with clear calls-to-action

4. **Use appropriate button variants:**
   - `primary` for main actions
   - `secondary` for secondary actions
   - `danger` for destructive actions
   - `ghost` for tertiary actions

5. **Always include labels for form inputs** for accessibility

6. **Use consistent status colors:**
   - Green (success) = Approved, Completed, Paid
   - Yellow (warning) = Pending, In Review
   - Red (danger) = Rejected, Failed
   - Blue (info) = Information, Processing

7. **Add error prop to inputs** for inline validation feedback

8. **Use loading prop on buttons** during async operations

---

For complete documentation, see [UX_IMPROVEMENTS.md](./UX_IMPROVEMENTS.md)
