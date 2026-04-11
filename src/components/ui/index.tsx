import React, { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { JobStatus } from '@/types/database';

// ============================================================================
// BUTTON
// ============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-lg shadow-red-500/25',
  secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 focus:ring-zinc-500',
  ghost: 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:ring-zinc-500',
  outline: 'border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:ring-zinc-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          buttonVariants[variant],
          buttonSizes[size],
          className
        )}
        {...props}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ============================================================================
// INPUT
// ============================================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full px-4 py-2.5 text-sm bg-white dark:bg-zinc-900',
              'border border-zinc-300 dark:border-zinc-700 rounded-lg',
              'focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500',
              'placeholder:text-zinc-400 transition-colors duration-200',
              error && 'border-red-500 focus:ring-red-500/50',
              leftIcon && 'pl-10',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ============================================================================
// TEXTAREA
// ============================================================================

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            'w-full px-4 py-2.5 text-sm bg-white dark:bg-zinc-900',
            'border border-zinc-300 dark:border-zinc-700 rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500',
            'placeholder:text-zinc-400 transition-colors duration-200 resize-none',
            error && 'border-red-500',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ============================================================================
// SELECT
// ============================================================================

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'w-full px-4 py-2.5 text-sm bg-white dark:bg-zinc-900',
            'border border-zinc-300 dark:border-zinc-700 rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500',
            'transition-colors duration-200',
            error && 'border-red-500',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

// ============================================================================
// BADGE
// ============================================================================

interface BadgeProps {
  variant?: JobStatus | 'default' | 'success' | 'error';
  children: React.ReactNode;
  className?: string;
}

const badgeVariants: Record<string, string> = {
  default: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  waiting_for_info: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  revision_requested: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className }) => {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', badgeVariants[variant], className)}>
      {children}
    </span>
  );
};

// ============================================================================
// CARD
// ============================================================================

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const cardPadding = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };

export const Card: React.FC<CardProps> = ({ children, className, hover = false, padding = 'md' }) => {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800',
        hover && 'hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200',
        cardPadding[padding],
        className
      )}
    >
      {children}
    </div>
  );
};

// ============================================================================
// SPINNER
// ============================================================================

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ size = 'md', className }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return <Loader2 className={clsx('animate-spin text-red-600', sizes[size], className)} />;
};

// ============================================================================
// EMPTY STATE
// ============================================================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 text-zinc-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-zinc-500 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
};

// ============================================================================
// AVATAR
// ============================================================================

export const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg' }> = ({ name, size = 'md' }) => {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={clsx('rounded-full bg-red-600 text-white font-semibold flex items-center justify-center', sizes[size])}>
      {initials}
    </div>
  );
};

// ============================================================================
// STATUS LABELS
// ============================================================================

export const statusLabels: Record<JobStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  waiting_for_info: 'Waiting for Info',
  completed: 'Completed',
  revision_requested: 'Revision Requested',
  rejected: 'Rejected',
};

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Hook to paginate a client-side array.
 * - `items`: the full (already filtered/sorted) array to paginate
 * - `pageSize`: number of rows per page (defaults to 10)
 *
 * Returns the current page slice plus controls. Automatically resets to
 * page 1 when the length of `items` changes (e.g. when a filter narrows
 * the list) so the user never ends up on an empty page.
 */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset to page 1 whenever the dataset size changes
  useEffect(() => {
    setPage(1);
  }, [totalItems]);

  // Clamp the page if it ever falls outside the valid range
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    totalPages,
    totalItems,
    pageSize,
    pagedItems: paged,
    rangeStart: totalItems === 0 ? 0 : (page - 1) * pageSize + 1,
    rangeEnd: Math.min(page * pageSize, totalItems),
  };
}

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Compact pagination footer. Renders nothing when there's only one page.
 * Designed to sit inside a `<Card padding="none">` below a table.
 */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
  className,
}) => {
  if (totalPages <= 1) return null;

  // Build a compact page list with ellipses
  const pages: (number | 'ellipsis-l' | 'ellipsis-r')[] = [];
  const push = (v: number | 'ellipsis-l' | 'ellipsis-r') => pages.push(v);
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) push(i);
  } else {
    push(1);
    if (page > 3) push('ellipsis-l');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) push(i);
    if (page < totalPages - 2) push('ellipsis-r');
    push(totalPages);
  }

  const baseBtn =
    'inline-flex items-center justify-center min-w-[32px] h-8 px-2 text-sm rounded-md border transition-colors';
  const inactive =
    'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800';
  const active = 'bg-red-600 border-red-600 text-white hover:bg-red-700';
  const disabled = 'opacity-40 cursor-not-allowed';

  return (
    <div
      className={clsx(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3',
        className
      )}
    >
      <p className="text-xs text-zinc-500">
        Showing <span className="font-semibold text-zinc-700 dark:text-zinc-300">{rangeStart}</span>
        {' – '}
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{rangeEnd}</span>
        {' of '}
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{totalItems}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className={clsx(baseBtn, inactive, page === 1 && disabled)}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        {pages.map((p, idx) =>
          p === 'ellipsis-l' || p === 'ellipsis-r' ? (
            <span key={`${p}-${idx}`} className="px-1 text-zinc-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={clsx(baseBtn, p === page ? active : inactive)}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className={clsx(baseBtn, inactive, page === totalPages && disabled)}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
