import { InputHTMLAttributes, forwardRef, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 flex items-center justify-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-panel border rounded-xl px-4 py-2.5 text-sm font-bold text-text outline-none transition-all duration-200 placeholder:text-muted/40 ${
              error
                ? 'border-red/50 focus:border-red'
                : 'border-border-glass-subtle focus:border-accent'
            } ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} disabled:opacity-30 disabled:pointer-events-none ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 flex items-center justify-center pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-[0.65rem] font-bold text-red m-0">{error}</p>}
        {helperText && !error && (
          <p className="text-[0.6rem] font-medium text-muted/60 m-0">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
export default Input;
