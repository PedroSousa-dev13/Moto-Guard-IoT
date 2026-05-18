import { ReactNode, ButtonHTMLAttributes, forwardRef } from 'react';
import LoadingSpinner from './LoadingSpinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-lg shadow-accent/20 hover:scale-[1.02] hover:bg-accent-strong active:scale-[0.98]',
  secondary:
    'bg-panel border border-border-glass-subtle text-muted hover:text-text hover:border-border-glass active:scale-[0.98]',
  danger:
    'bg-red/10 border border-red/20 text-red hover:bg-red hover:text-white hover:shadow-lg hover:shadow-red/20 active:scale-[0.98]',
  ghost:
    'bg-transparent text-muted hover:text-text hover:bg-panel active:scale-[0.98]',
  outline:
    'bg-transparent border border-border-glass text-muted hover:text-text hover:border-accent active:scale-[0.98]',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[0.65rem] gap-1.5',
  md: 'px-4 py-2.5 text-[0.7rem] gap-2',
  lg: 'px-6 py-3.5 text-[0.8rem] gap-2.5',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-black uppercase tracking-widest rounded-xl transition-all duration-200 ${variantClasses[variant]} ${sizeClasses[size]} ${
          disabled || loading ? 'opacity-30 pointer-events-none' : ''
        } ${className}`}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size="small" color="currentColor" />
        ) : icon ? (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
        ) : null}
        {children && <span>{children}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';
export default Button;
