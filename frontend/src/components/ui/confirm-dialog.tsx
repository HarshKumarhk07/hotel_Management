'use client';

import { ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="text-sm text-zinc-600">{description}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            isLoading={isLoading}
            disabled={isLoading}
            className={
              destructive
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-[#D4AF37] text-white hover:bg-[#AE963C]'
            }
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
