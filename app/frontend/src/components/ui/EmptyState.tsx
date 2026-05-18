import { ReactNode } from 'react';
import { Inbox, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'empty' | 'error';
}

export default function EmptyState({ icon, title, description, action, variant = 'empty' }: EmptyStateProps) {
  const isError = variant === 'error';
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-12 px-8">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center border ${
          isError ? 'bg-red/10 text-red border-red/20' : 'bg-panel text-muted border-border-glass-subtle'
        }`}
      >
        {icon ?? (isError ? <AlertCircle size={28} /> : <Inbox size={28} />)}
      </div>
      <div className="flex flex-col gap-1 max-w-xs">
        <h3 className={`text-base font-black tracking-tight m-0 ${isError ? 'text-red' : 'text-text'}`}>{title}</h3>
        {description && <p className="text-xs font-medium text-muted leading-relaxed m-0">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
