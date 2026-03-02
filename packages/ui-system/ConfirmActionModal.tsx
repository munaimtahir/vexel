'use client';
import * as React from 'react';
import { cn } from './utils';

export function ConfirmActionModal({
  open,
  title,
  description,
  actionPreview,
  requireTyping,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  actionPreview?: React.ReactNode;
  requireTyping?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = React.useState('');

  React.useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  if (!open) return null;

  const typingRequired = typeof requireTyping === 'string' && requireTyping.length > 0;
  const typingValid = !typingRequired || typed === requireTyping;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-float">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        {actionPreview ? <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm">{actionPreview}</div> : null}

        {typingRequired ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono text-foreground">{requireTyping}</span> to continue.
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={cn(
              'rounded-md px-3 py-2 text-sm text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50',
              danger ? 'bg-destructive' : 'bg-primary',
            )}
            onClick={onConfirm}
            disabled={loading || !typingValid}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
