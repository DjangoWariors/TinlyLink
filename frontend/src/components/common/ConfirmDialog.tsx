import { AlertTriangle, Trash2, Info } from 'lucide-react';
import { Modal } from './index';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const icons = {
    danger: <Trash2 className="w-6 h-6 text-danger" />,
    warning: <AlertTriangle className="w-6 h-6 text-warning" />,
    info: <Info className="w-6 h-6 text-primary" />,
  };

  const colors = {
    danger: 'bg-danger/10',
    warning: 'bg-warning/10',
    info: 'bg-primary/10',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="text-center">
        <div className={`w-14 h-14 mx-auto mb-4 rounded-full ${colors[variant]} flex items-center justify-center`}>
          {icons[variant]}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <div className="text-gray-600 mb-6">{message}</div>
        <div className="flex justify-center gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
