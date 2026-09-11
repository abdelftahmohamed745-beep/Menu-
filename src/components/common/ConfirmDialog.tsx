import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isDangerous?: boolean;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  isDestructive = true,
  isDangerous,
  isLoading = false,
}) => {
  const handleClose = () => {
    if (isLoading) return;
    if (onClose) {
      onClose();
    } else if (onCancel) {
      onCancel();
    }
  };

  const destructiveMode = isDangerous !== undefined ? isDangerous : isDestructive;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="sm" showCloseButton={false}>
      <div className="text-center sm:text-right">
        <div className="mx-auto sm:mx-0 w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 mb-2">{title}</h3>
        <p className="text-sm text-neutral-600 mb-6 leading-relaxed">{message}</p>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={isLoading}
            className={`w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-xl text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 ${
              destructiveMode
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
            }`}
          >
            {isLoading ? 'جاري التنفيذ...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
