import AdminCrudPage from '../../components/admin/AdminCrudPage';
import { categoryAPI } from '../../api/api';
import Badge from '../../components/Badge';

export default function Categories() {
  return (
    <AdminCrudPage
      title="Event Categories"
      subtitle="Organize festival events by type and theme"
      breadcrumb="Master Data"
      api={categoryAPI}
      searchKeys={['name', 'description']}
      initialForm={{ name: '', description: '', color: '#6366f1' }}
      statsFn={(items) => [
        { label: 'Total', value: items.length },
        { label: 'Active', value: items.filter((i) => i.isActive).length },
        { label: 'Inactive', value: items.filter((i) => !i.isActive).length },
      ]}
      fields={[
        { name: 'name', label: 'Category Name', required: true },
        { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
        { name: 'color', label: 'Theme Color', type: 'color' },
      ]}
      columns={[
        { key: 'name', label: 'Name', sortable: true },
        { key: 'description', label: 'Description' },
        { key: 'color', label: 'Color', render: (i) => (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border border-slate-600" style={{ backgroundColor: i.color }} />
            {i.color}
          </span>
        )},
        { key: 'isActive', label: 'Status', render: (i) => <Badge type={i.isActive ? 'approved' : 'cancelled'}>{i.isActive ? 'Active' : 'Inactive'}</Badge> },
      ]}
      detailFields={(i) => [
        { label: 'Name', value: i.name },
        { label: 'Description', value: i.description },
        { label: 'Color', value: i.color },
        { label: 'Status', value: i.isActive ? 'Active' : 'Inactive' },
      ]}
    />
  );
}
