import { SelectHTMLAttributes, forwardRef, ReactNode } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  leftIcon?: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, leftIcon, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 flex items-center justify-center pointer-events-none z-10">
              {leftIcon}
            </div>
          )}
          <select
            ref={ref}
            className={`w-full bg-panel border rounded-xl px-4 py-2.5 text-sm font-bold text-text outline-none transition-all duration-200 appearance-none cursor-pointer ${
              error ? 'border-red/50 focus:border-red' : 'border-border-glass-subtle focus:border-accent'
            } ${leftIcon ? 'pl-10' : ''} disabled:opacity-30 disabled:pointer-events-none ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5l3 3 3-3" />
            </svg>
          </div>
        </div>
        {error && <p className="text-[0.65rem] font-bold text-red m-0">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
export default Select;
