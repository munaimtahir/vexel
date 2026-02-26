import { redirect } from 'next/navigation';

// This hub page has been removed. Redirect to the canonical page.
export default function TenantSettingsUsersPage() {
  redirect('/users');
}
