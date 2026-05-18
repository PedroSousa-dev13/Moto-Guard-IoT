import { ReactNode } from 'react';

type BadgeVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  info: 'bg-blue/10 text-blue border-blue/20',
  success: 'bg-green/10 text-green border-green/20',
  warning: 'bg-yellow/10 text-yellow border-yellow/20',
  danger: 'bg-red/10 text-red border-red/20',
  neutral: 'bg-panel text-muted border-border-glass-subtle',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[0.55rem] gap-1',
  md: 'px-2.5 py-1 text-[0.65rem] gap-1.5',
};

export default function Badge({ variant = 'neutral', size = 'md', dot, icon, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-black uppercase tracking-widest rounded-lg border ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full bg-current`} />}
      {icon && <span className="w-3 h-3 flex items-center justify-center">{icon}</span>}
      {children}
    </span>
  );
}
