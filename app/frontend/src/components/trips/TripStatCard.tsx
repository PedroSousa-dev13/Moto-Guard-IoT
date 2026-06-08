import { type ReactNode } from 'react';

interface TripStatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
}

export default function TripStatCard({ icon, label, value, unit }: TripStatCardProps) {
  return (
    <div className="bg-surface/40 backdrop-blur-xl border border-border-glass rounded-3xl p-7 flex items-center gap-7 group hover:border-accent/40 hover:bg-panel transition-all shadow-xl hover:shadow-accent/5">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent group-hover:scale-110 transition-transform shadow-inner">
        {icon}
      </div>
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-[0.6rem] font-black uppercase tracking-[0.25em] text-muted opacity-60 truncate">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-text tracking-tighter tabular-nums">{value}</span>
          <span className="text-xs font-black text-muted opacity-40 uppercase tracking-widest shrink-0">{unit}</span>
        </div>
      </div>
    </div>
  );
}
