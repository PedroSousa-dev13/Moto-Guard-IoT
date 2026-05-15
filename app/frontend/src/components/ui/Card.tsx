import { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
}

const Card: React.FC<CardProps> = ({ 
  title, 
  subtitle, 
  children, 
  className = '', 
  headerActions,
  footer 
}) => {
  return (
    <div className={`bg-surface/60 backdrop-blur-md border border-border-glass rounded-xl shadow-sm flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-accent/10 ${className}`}>
      {(title || subtitle || headerActions) && (
        <div className="px-5 py-4 border-b border-border-glass-subtle flex items-center justify-between gap-3 bg-panel">
          <div className="flex flex-col gap-0.5">
            {title && <h3 className="text-[0.7rem] font-black tracking-widest uppercase text-muted leading-none m-0">{title}</h3>}
            {subtitle && <p className="text-xs text-text-2 m-0 font-medium">{subtitle}</p>}
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}
      <div className="p-5 flex-1">
        {children}
      </div>
      {footer && (
        <div className="px-5 py-3 bg-panel border-t border-border-glass-subtle">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
