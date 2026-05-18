import { InputHTMLAttributes, forwardRef } from 'react';

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  description?: string;
}

const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, description, className = '', id, ...props }, ref) => {
    const toggleId = id ?? `toggle-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <label htmlFor={toggleId} className={`flex items-center gap-4 cursor-pointer group ${className}`}>
        <div className="relative">
          <input
            ref={ref}
            id={toggleId}
            type="checkbox"
            className="sr-only peer"
            {...props}
          />
          <div className="w-10 h-6 rounded-full bg-panel border border-border-glass-subtle peer-checked:bg-accent peer-checked:border-accent transition-all duration-200 peer-disabled:opacity-30 peer-disabled:pointer-events-none" />
          <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-text peer-checked:bg-white peer-checked:translate-x-4 transition-all duration-200 shadow-md peer-disabled:opacity-30" />
        </div>
        {(label || description) && (
          <div className="flex flex-col gap-0.5">
            {label && <span className="text-sm font-bold text-text leading-tight">{label}</span>}
            {description && (
              <span className="text-[0.65rem] font-medium text-muted leading-tight">{description}</span>
            )}
          </div>
        )}
      </label>
    );
  },
);

Toggle.displayName = 'Toggle';
export default Toggle;
