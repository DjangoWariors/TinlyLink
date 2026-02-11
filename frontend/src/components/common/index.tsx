import { useState, useRef, useEffect, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { X, Loader2 } from 'lucide-react';

// Re-export additional components
export { Button } from './Button';
export { Input } from './Input';
export { Card, CardHeader, CardTitle, CardDescription } from './Card';
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
export { 
  Skeleton, 
  SkeletonText, 
  SkeletonCard, 
  SkeletonTable, 
  SkeletonStatCard, 
  SkeletonChart,
  SkeletonLinkRow,
  SkeletonDashboard 
} from './Skeleton';
export { ConfirmDialog } from './ConfirmDialog';
export { LinkPreview } from './LinkPreview';
export { VirtualList } from './VirtualList';
export { FileUpload } from './FileUpload';

// =============================================================================
// BADGE
// =============================================================================

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'primary';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-success-bg text-success',
    danger: 'bg-danger-bg text-danger',
    warning: 'bg-warning-bg text-warning',
    primary: 'bg-primary-100 text-primary-700',
  };

  return (
    <span className={clsx('badge', variantStyles[variant], className)}>
      {children}
    </span>
  );
}

// =============================================================================
// MODAL
// =============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const modal = modalRef.current;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          className={clsx(
            'relative w-full bg-white rounded-xl shadow-xl transform transition-all animate-fade-in',
            sizeStyles[size]
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 id="modal-title" className="text-lg font-semibold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// LOADING SPINNER
// =============================================================================

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Loading({ size = 'md', className }: LoadingProps) {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={clsx('flex items-center justify-center', className)}>
      <Loader2 className={clsx('animate-spin text-primary', sizeStyles[size])} />
    </div>
  );
}

// =============================================================================
// FULL PAGE LOADING
// =============================================================================

export function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loading size="lg" />
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {description && <p className="mt-2 text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// =============================================================================
// STAT CARD
// =============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon, trend, className }: StatCardProps) {
  return (
    <div className={clsx('stat-card', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{title}</p>
          <p className="stat-value mt-1">{value}</p>
          {trend && (
            <div className={clsx('stat-trend', trend.isPositive ? 'stat-trend-up' : 'stat-trend-down')}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span className="ml-1">{Math.abs(trend.value)}%</span>
              <span className="ml-1 text-gray-400">vs last period</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-primary-50 text-primary">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PROGRESS BAR
// =============================================================================

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ProgressBar({ value, max = 100, showLabel = false, size = 'md', className }: ProgressBarProps) {
  const percentage = Math.min(100, (value / max) * 100);
  
  const sizeStyles = {
    sm: 'h-1.5',
    md: 'h-2',
  };

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{value}</span>
          <span>{max}</span>
        </div>
      )}
      <div className={clsx('progress-bar', sizeStyles[size])}>
        <div
          className="progress-fill transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// DROPDOWN
// =============================================================================

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
}

export function Dropdown({ trigger, children, align = 'right' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          className={clsx(
            'absolute z-[100] mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 animate-scale-in',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}

export function DropdownItem({ children, onClick, danger }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2',
        danger ? 'text-danger hover:bg-danger-bg' : 'text-gray-700'
      )}
    >
      {children}
    </button>
  );
}

// =============================================================================
// COPY TO CLIPBOARD WITH FEEDBACK
// =============================================================================

interface CopyButtonProps {
  text: string;
  onCopy?: () => void;
  className?: string;
  children?: ReactNode;
}

export function CopyButton({ text, onCopy, className, children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-1 text-sm rounded transition-colors',
        copied ? 'text-success bg-success/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
        className
      )}
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {children || 'Copy'}
        </>
      )}
    </button>
  );
}

// =============================================================================
// TOAST NOTIFICATIONS (wrapper for react-hot-toast)
// =============================================================================

export { toast } from 'react-hot-toast';

// =============================================================================
// TOOLTIP
// =============================================================================

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);
  
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className={clsx(
          'absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap animate-fade-in',
          positionClasses[position]
        )}>
          {content}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TABS
// =============================================================================

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
}

export function Tabs({ tabs, activeTab, onChange, variant = 'default' }: TabsProps) {
  const baseStyles = 'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm';

  const variantStyles = {
    default: (active: boolean) => active
      ? 'bg-white text-primary border-b-2 border-primary'
      : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent',
    pills: (active: boolean) => active
      ? 'bg-primary text-white rounded-lg'
      : 'text-gray-600 hover:bg-gray-100 rounded-lg',
    underline: (active: boolean) => active
      ? 'text-primary border-b-2 border-primary'
      : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent',
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (currentIndex + 1) % tabs.length;
      onChange(tabs[next].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (currentIndex - 1 + tabs.length) % tabs.length;
      onChange(tabs[prev].id);
    }
  };

  return (
    <div
      className={clsx(
        'flex',
        variant === 'default' && 'border-b border-gray-200',
        variant === 'pills' && 'gap-1 bg-gray-100 p-1 rounded-lg'
      )}
      role="tablist"
      onKeyDown={handleKeyDown}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={clsx(baseStyles, variantStyles[variant](activeTab === tab.id))}
        >
          {tab.icon}
          {tab.label}
          {tab.badge !== undefined && (
            <span className={clsx(
              'px-1.5 py-0.5 text-xs rounded-full',
              activeTab === tab.id ? 'bg-white/20' : 'bg-gray-200'
            )}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// ALERT
// =============================================================================

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: ReactNode;
  onClose?: () => void;
}

export function Alert({ variant = 'info', title, children, onClose }: AlertProps) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-success/10 border-success/20 text-success-dark',
    warning: 'bg-warning/10 border-warning/20 text-warning-dark',
    danger: 'bg-danger/10 border-danger/20 text-danger',
  };

  return (
    <div className={clsx('p-4 rounded-lg border', styles[variant])}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {title && <p className="font-medium mb-1">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// DATE RANGE PICKER
// =============================================================================

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  presets?: { label: string; days: number }[];
}

export function DateRangePicker({ startDate, endDate, onChange, presets }: DateRangePickerProps) {
  const defaultPresets = presets || [
    { label: '7 days', days: 7 },
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
  ];

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
          className="input text-sm py-1.5"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
          className="input text-sm py-1.5"
        />
      </div>
      <div className="flex gap-1">
        {defaultPresets.map(preset => (
          <button
            key={preset.days}
            onClick={() => applyPreset(preset.days)}
            className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
