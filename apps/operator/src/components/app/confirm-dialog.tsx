'use client';
import { ConfirmActionModal } from '@vexel/ui-system';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  return (
    <ConfirmActionModal
      open={open}
      title={title}
      description={description}
      confirmText={confirmLabel}
      cancelText={cancelLabel}
      danger={variant === 'destructive'}
      loading={loading}
      onCancel={() => onOpenChange(false)}
      onConfirm={onConfirm}
    />
  );
}
