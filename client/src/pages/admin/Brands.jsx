import AdminCrudPage from '../../components/admin/AdminCrudPage';
import { brandAPI } from '../../api/api';
import Badge from '../../components/Badge';

const sponsorshipOptions = [
  { value: 'platinum', label: 'Platinum' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'partner', label: 'Partner' },
];

export default function Brands() {
  return (
    <AdminCrudPage
      title="Brands & Sponsors"
      subtitle="Manage sponsorship partners and brand assignments"
      breadcrumb="Master Data"
      api={brandAPI}
      modalSize="lg"
      searchKeys={['name', 'contactEmail', 'website']}
      initialForm={{ name: '', description: '', sponsorshipType: 'partner', website: '', contactEmail: '', logo: '' }}
      statsFn={(items) => [
        { label: 'Total Brands', value: items.length },
        { label: 'Active', value: items.filter((i) => i.isActive).length },
        { label: 'Platinum/Gold', value: items.filter((i) => ['platinum', 'gold'].includes(i.sponsorshipType)).length },
      ]}
      fields={[
        { name: 'name', label: 'Brand Name', required: true },
        { name: 'sponsorshipType', label: 'Sponsorship Tier', type: 'select', options: sponsorshipOptions },
        { name: 'website', label: 'Website URL' },
        { name: 'contactEmail', label: 'Contact Email', type: 'email' },
        { name: 'logo', label: 'Logo URL' },
        { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
      ]}
      columns={[
        { key: 'name', label: 'Brand', sortable: true },
        { key: 'sponsorshipType', label: 'Tier', render: (i) => <Badge>{i.sponsorshipType}</Badge> },
        { key: 'contactEmail', label: 'Contact' },
        { key: 'website', label: 'Website', render: (i) => i.website ? <a href={i.website} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">Visit</a> : '—' },
        { key: 'isActive', label: 'Status', render: (i) => <Badge type={i.isActive ? 'approved' : 'cancelled'}>{i.isActive ? 'Active' : 'Inactive'}</Badge> },
      ]}
      detailFields={(i) => [
        { label: 'Name', value: i.name },
        { label: 'Tier', value: i.sponsorshipType },
        { label: 'Email', value: i.contactEmail },
        { label: 'Website', value: i.website },
        { label: 'Description', value: i.description },
      ]}
    />
  );
}
