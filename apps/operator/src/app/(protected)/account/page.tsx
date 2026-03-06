'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, SectionCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { invalidateCurrentUserCache } from '@/hooks/use-current-user';

type AccountProfile = {
  userId: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  tenantName: string | null;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
};

type AdminNavigationSummary = {
  hasAdminAppAccess: boolean;
  hasAnyAdminPermission: boolean;
  landingPath: string;
};

const ADMIN_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_APP_URL ?? '/admin';

function buildAdminHref(landingPath?: string): string {
  const normalizedBase = ADMIN_BASE_URL.endsWith('/') ? ADMIN_BASE_URL.slice(0, -1) : ADMIN_BASE_URL;
  const normalizedPath = landingPath && landingPath.startsWith('/') ? landingPath : '/account';
  return `${normalizedBase}${normalizedPath}`;
}

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [adminSummary, setAdminSummary] = useState<AdminNavigationSummary | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const [{ data: accountData, error: accountError }, { data: navData }] = await Promise.all([
        api.GET('/account/me'),
        api.GET('/admin/navigation'),
      ]);
      if (accountError || !accountData) throw new Error('Failed to load account');
      setProfile(accountData as AccountProfile);
      setDisplayName((accountData as AccountProfile).displayName);
      if (navData) setAdminSummary(navData as AdminNavigationSummary);
    } catch {
      setError('Failed to load account settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rolesSummary = useMemo(() => {
    if (!profile?.roles?.length) return 'No roles assigned';
    return profile.roles.join(', ');
  }, [profile?.roles]);

  const onSaveDisplayName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('Display name is required');
      return;
    }
    setSavingName(true);
    setError('');
    setMessage('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.PATCH('/account/me', {
        body: { displayName: trimmed },
      });
      if (apiError || !data) throw new Error('Failed to update profile');
      setProfile(data as AccountProfile);
      setDisplayName((data as AccountProfile).displayName);
      invalidateCurrentUserCache();
      setMessage('Display name updated');
    } catch {
      setError('Could not update display name');
    } finally {
      setSavingName(false);
    }
  };

  const onChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setError('Current and new password are required');
      return;
    }
    setSavingPassword(true);
    setError('');
    setMessage('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiError } = await api.POST('/account/change-password', {
        body: { currentPassword, newPassword },
      });
      if (apiError) throw new Error('Failed to change password');
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password updated. You may need to sign in again on other tabs.');
    } catch {
      setError('Could not change password. Check your current password and try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Account" description="Manage your profile and security settings." />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <SectionCard title="Profile">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading account details...</p>
        ) : profile ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant">Tenant</Label>
              <Input id="tenant" value={profile.tenantName ?? profile.tenantId} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roles">Roles</Label>
              <Input id="roles" value={rolesSummary} readOnly />
            </div>
            <div className="md:col-span-2">
              <Button type="button" onClick={onSaveDisplayName} disabled={savingName}>
                {savingName ? 'Saving...' : 'Save Display Name'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No profile data found.</p>
        )}
      </SectionCard>

      <SectionCard title="Security">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
            />
          </div>
          <div className="md:col-span-2">
            <Button type="button" onClick={onChangePassword} disabled={savingPassword}>
              {savingPassword ? 'Updating...' : 'Change Password'}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Admin App">
        <p className="text-sm text-muted-foreground">
          Open the Back Office app. You will only see sections allowed by your permissions.
        </p>
        <div className="pt-3">
          <Button
            type="button"
            onClick={() => {
              window.location.href = buildAdminHref(adminSummary?.landingPath);
            }}
          >
            Open Admin Panel
          </Button>
          {adminSummary && !adminSummary.hasAdminAppAccess && (
            <p className="mt-2 text-xs text-muted-foreground">
              Your current access is limited to account self-service pages.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
