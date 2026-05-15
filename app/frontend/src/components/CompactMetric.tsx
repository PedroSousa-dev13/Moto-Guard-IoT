import { ReactNode } from 'react';

interface CompactMetricProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  source: 'FILE' | 'SIM';
  color?: string;
  title?: string;
}

const CompactMetric: React.FC<CompactMetricProps> = ({ 
  label, 
  value, 
  unit, 
  icon, 
  source,
  color,
  title
}) => {
  const isFile = source === 'FILE';
  const accentColor = isFile ? 'var(--green)' : 'var(--blue)';
  
  return (
    <div 
      className="bg-panel border border-border-glass-subtle rounded-xl p-3 flex flex-col gap-1 relative group overflow-hidden transition-all hover:bg-panel-hover hover:border-border-glass"
      title={title}
    >
      {/* Source Strip */}
      <div 
        className="absolute top-0 left-0 w-1 h-full opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: accentColor }}
      />
      
      {/* Header */}
      <div className="flex items-center justify-between opacity-50 group-hover:opacity-80 transition-opacity">
        <span className="text-[0.5rem] font-black uppercase tracking-widest text-muted">{label}</span>
        {icon && <span className="text-muted scale-75">{icon}</span>}
      </div>
      
      {/* Content */}
      <div className="flex items-baseline gap-1">
        <span 
          className="text-xl font-black tabular-nums tracking-tighter"
          style={{ color: color || 'var(--text)' }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[0.6rem] font-bold opacity-30 uppercase tracking-tighter">
            {unit}
          </span>
        )}
      </div>

      {/* Discrete Label */}
      <div className="absolute bottom-1 right-2 text-[0.4rem] font-black opacity-10 uppercase tracking-[0.2em] group-hover:opacity-30">
        {isFile ? 'Original' : 'Simulated'}
      </div>
    </div>
  );
};

export default CompactMetric;
