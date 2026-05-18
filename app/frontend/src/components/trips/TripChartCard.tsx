import { type ReactNode } from 'react';

interface TripChartCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

export default function TripChartCard({ title, icon, children }: TripChartCardProps) {
  return (
    <div className="bg-surface/40 backdrop-blur-xl border border-border-glass rounded-[2.5rem] p-10 flex flex-col gap-10 group hover:border-accent/40 transition-all shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-150 transition-transform">
        {icon}
      </div>
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4 text-xl font-black text-text tracking-tight uppercase tracking-widest leading-none">
          <div className="text-accent bg-accent/10 p-2.5 rounded-xl shadow-lg">{icon}</div>
          {title}
        </div>
      </div>
      <div className="flex-1 min-h-[300px] relative z-10">
        {children}
      </div>
    </div>
  );
}
