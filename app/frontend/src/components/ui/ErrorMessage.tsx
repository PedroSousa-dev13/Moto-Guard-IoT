import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  inline?: boolean;
}

export default function ErrorMessage({ message, onRetry, inline }: ErrorMessageProps) {
  if (inline) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red/10 border border-red/20 text-red">
        <AlertCircle size={16} className="shrink-0" />
        <span className="text-xs font-bold">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-red/20 text-red text-[0.6rem] font-black uppercase tracking-widest hover:bg-red hover:text-white transition-all"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-12 px-8">
      <div className="w-16 h-16 rounded-full bg-red/10 flex items-center justify-center text-red border border-red/20">
        <AlertCircle size={28} />
      </div>
      <div className="flex flex-col gap-1 max-w-xs">
        <h3 className="text-base font-black text-red tracking-tight m-0">Error</h3>
        <p className="text-xs font-medium text-muted leading-relaxed m-0">{message}</p>
      </div>
      {onRetry && (
        <Button variant="danger" size="md" icon={<RefreshCw size={14} />} onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
