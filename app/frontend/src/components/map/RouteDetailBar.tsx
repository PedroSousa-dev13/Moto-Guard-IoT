import { Play, RotateCcw, Navigation } from 'lucide-react';
import type { PresetRoute } from '../../data/routes';
import { TYPE_MAP, DIFF_MAP } from '../../data/routes';

interface RouteDetailBarProps {
  route: PresetRoute;
  sent: boolean;
  onClear: () => void;
  onUse: () => void;
}

export default function RouteDetailBar({ route, sent, onClear, onUse }: RouteDetailBarProps) {
  const typeInfo = TYPE_MAP[route.type];
  const diffColor = DIFF_MAP[route.difficulty];

  return (
    <div className="bg-surface/60 backdrop-blur-xl border border-border-glass rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shrink-0 animate-fade-in">
      <div className="flex-1 flex flex-col gap-2">
        <div className="text-xl font-black text-text tracking-tight leading-none">{route.name}</div>
        <div className="text-sm font-medium text-muted leading-relaxed max-w-2xl">{route.description}</div>
        <div className="flex flex-wrap items-center gap-6 mt-1 text-[0.7rem] font-black uppercase tracking-widest text-muted">
          <span className="flex items-center gap-1.5">
            <Navigation size={14} className="text-accent" /> {route.distance}
          </span>
          <span className="flex items-center gap-1.5 opacity-60">⏱ {route.duration}</span>
          <span className={`flex items-center gap-1.5 ${typeInfo.text}`}>
            ● {typeInfo.label}
          </span>
          <span className={`flex items-center gap-1.5 ${diffColor}`}>
            ● {route.difficulty}
          </span>
        </div>
      </div>
      <div className="flex gap-3 shrink-0">
        <button
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-panel border border-border-glass-subtle text-xs font-black text-muted uppercase tracking-widest hover:text-text hover:bg-panel-hover transition-all"
          onClick={onClear}
        >
          <RotateCcw size={16} /> Limpar
        </button>
        <button
          className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl ${
            sent
              ? 'bg-green/10 text-green border border-green/20'
              : 'bg-accent text-white shadow-accent/20 hover:scale-105 active:scale-95'
          }`}
          onClick={onUse}
        >
          <Play size={16} />
          {sent ? 'Rota enviada ✓' : 'Usar esta rota'}
        </button>
      </div>
    </div>
  );
}
