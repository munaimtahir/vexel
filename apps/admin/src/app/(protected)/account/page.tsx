'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type AccountProfile = {
  userId: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  tenantName: string | null;
  roles: string[];
};

export default function MyAccountPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.GET('/account/me');
      if (apiError || !data) throw new Error('Failed to load account');
      setProfile(data as AccountProfile);
      setDisplayName((data as AccountProfile).displayName);
    } catch {
      setError('Failed to load account');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveDisplayName = async () => {
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    setSavingName(true);
    setError('');
    setSuccess('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.PATCH('/account/me', {
        body: { displayName: displayName.trim() },
      });
      if (apiError || !data) throw new Error('Failed to update profile');
      setProfile(data as AccountProfile);
      setDisplayName((data as AccountProfile).displayName);
      setSuccess('Display name updated');
    } catch {
      setError('Could not update display name');
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword) {
      setError('Current and new password are required');
      return;
    }
    setSavingPassword(true);
    setError('');
    setSuccess('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiError } = await api.POST('/account/change-password', {
        body: { currentPassword, newPassword },
      });
      if (apiError) throw new Error('Failed to change password');
      setCurrentPassword('');
      setNewPassword('');
      setSuccess('Password changed successfully');
    } catch {
      setError('Could not change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-bold">My Account</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Manage your profile and password.
      </p>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {success && <div className="mb-3 text-sm text-emerald-700">{success}</div>}

      <div className="mb-4 rounded-lg border border-border p-4">
        <h2 className="mb-3 text-base font-semibold">Profile</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : profile ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1.5 text-xs text-muted-foreground">Display name</div>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1.5 text-xs text-muted-foreground">Email</div>
                <input
                  value={profile.email}
                  readOnly
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1.5 text-xs text-muted-foreground">Tenant</div>
                <input
                  value={profile.tenantName ?? profile.tenantId}
                  readOnly
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1.5 text-xs text-muted-foreground">Roles</div>
                <input
                  value={profile.roles.join(', ') || 'No roles assigned'}
                  readOnly
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button
              onClick={saveDisplayName}
              disabled={savingName}
              className="mt-3 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
            >
              {savingName ? 'Saving...' : 'Save Display Name'}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Profile unavailable.</p>
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-base font-semibold">Change Password</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1.5 text-xs text-muted-foreground">Current password</div>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1.5 text-xs text-muted-foreground">New password</div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          onClick={savePassword}
          disabled={savingPassword}
          className="mt-3 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
        >
          {savingPassword ? 'Updating...' : 'Change Password'}
        </button>
      </div>
    </div>
  );
}
