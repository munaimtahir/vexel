import { redirect } from 'next/navigation';

// Tenant settings has been restructured. Each section now lives at its canonical URL.
// Redirect to Tenants page which is the natural entry point for tenant management.
export default function TenantSettingsPage() {
  redirect('/tenants');
}
