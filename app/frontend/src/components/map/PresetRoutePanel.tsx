import { ChevronDown, ChevronRight, Navigation } from 'lucide-react';
import type { District, PresetRoute } from '../../data/routes';
import { TYPE_MAP, DIFF_MAP } from '../../data/routes';

interface PresetRoutePanelProps {
  districts: District[];
  expandedDistricts: Set<string>;
  selectedRoute: PresetRoute | null;
  onToggleDistrict: (name: string) => void;
  onSelectRoute: (route: PresetRoute) => void;
}

export default function PresetRoutePanel({
  districts,
  expandedDistricts,
  selectedRoute,
  onToggleDistrict,
  onSelectRoute,
}: PresetRoutePanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
      {districts.map((district) => {
        const isExpanded = expandedDistricts.has(district.name);
        return (
          <div key={district.name} className="flex flex-col gap-2">
            <button
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-panel border border-border-glass-subtle hover:bg-panel-hover transition-all text-left group"
              onClick={() => onToggleDistrict(district.name)}
            >
              <div className="flex flex-col">
                <span className="text-sm font-black text-text tracking-tight group-hover:text-accent transition-colors">
                  {district.name}
                </span>
                <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest opacity-60">
                  {district.region}
                </span>
              </div>
              {isExpanded ? (
                <ChevronDown size={18} className="text-muted" />
              ) : (
                <ChevronRight size={18} className="text-muted" />
              )}
            </button>

            {isExpanded && (
              <div className="flex flex-col gap-2 pl-2">
                {district.routes.map((route) => {
                  const isSelected = selectedRoute?.id === route.id;
                  const typeInfo = TYPE_MAP[route.type];
                  const diffColor = DIFF_MAP[route.difficulty];
                  return (
                    <button
                      key={route.id}
                      className={`w-full p-4 rounded-xl border transition-all text-left flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-accent/10 border-accent/40 shadow-lg'
                          : 'bg-surface border-border-glass-subtle hover:border-border-glass'
                      }`}
                      onClick={() => onSelectRoute(route)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[0.8rem] font-black text-text leading-tight">
                          {route.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[0.55rem] font-black uppercase tracking-widest shrink-0 ${typeInfo.bg} ${typeInfo.text}`}
                        >
                          {typeInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[0.65rem] font-bold text-muted uppercase tracking-widest opacity-60">
                        <span className="flex items-center gap-1">
                          <Navigation size={10} /> {route.distance}
                        </span>
                        <span className="flex items-center gap-1">⏱ {route.duration}</span>
                        <span className={`flex items-center gap-1 ${diffColor}`}>
                          ● {route.difficulty}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
