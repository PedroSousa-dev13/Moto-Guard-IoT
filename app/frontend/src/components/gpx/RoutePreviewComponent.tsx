import { useEffect } from 'react';
import { MapPin, Clock, Route, TrendingUp } from 'lucide-react';

interface GpxWaypoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  time?: Date;
}

interface ParsedGpxRoute {
  waypoints: GpxWaypoint[];
  distanceKm: number;
  totalTimeSec?: number;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  startedAt?: Date;
  endedAt?: Date;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface RoutePreviewComponentProps {
  route: ParsedGpxRoute;
  onMapRender?: (waypoints: GpxWaypoint[]) => void;
}

export default function RoutePreviewComponent({
  route,
  onMapRender
}: RoutePreviewComponentProps) {
  useEffect(() => {
    if (onMapRender && route.waypoints) {
      onMapRender(route.waypoints);
    }
  }, [route.waypoints, onMapRender]);

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatSpeed = (speed?: number): string => {
    if (!speed) return 'N/A';
    return `${speed.toFixed(1)} km/h`;
  };

  const formatCoordinate = (coord: number): string => {
    return coord.toFixed(6);
  };

  const startPoint = route.waypoints[0];
  const endPoint = route.waypoints[route.waypoints.length - 1];

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      <div className="flex items-center gap-2 text-text font-black tracking-tight">
        <Route size={16} className="text-accent animate-pulse" />
        <span className="text-sm">Detalhes da Rota GPX</span>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="p-3.5 rounded-2xl bg-panel border border-border-glass-subtle flex items-center gap-3 hover:bg-panel-hover/50 transition-all duration-300">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
            <Route size={14} />
          </div>
          <div className="flex flex-col text-left">
            <div className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-60">Distância</div>
            <div className="text-xs font-black text-text tracking-tight">{route.distanceKm.toFixed(1)} km</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-panel border border-border-glass-subtle flex items-center gap-3 hover:bg-panel-hover/50 transition-all duration-300">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
            <Clock size={14} />
          </div>
          <div className="flex flex-col text-left">
            <div className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-60">Duração</div>
            <div className="text-xs font-black text-text tracking-tight">{formatDuration(route.totalTimeSec)}</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-panel border border-border-glass-subtle flex items-center gap-3 hover:bg-panel-hover/50 transition-all duration-300">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
            <MapPin size={14} />
          </div>
          <div className="flex flex-col text-left">
            <div className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-60">Pontos</div>
            <div className="text-xs font-black text-text tracking-tight">{route.waypoints.length}</div>
          </div>
        </div>

        {route.avgSpeedKmh && (
          <div className="p-3.5 rounded-2xl bg-panel border border-border-glass-subtle flex items-center gap-3 hover:bg-panel-hover/50 transition-all duration-300">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
              <TrendingUp size={14} />
            </div>
            <div className="flex flex-col text-left">
              <div className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-60">Velocidade Média</div>
              <div className="text-xs font-black text-text tracking-tight">{formatSpeed(route.avgSpeedKmh)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full">
        <div className="p-4 rounded-2xl bg-surface border border-border-glass-subtle flex flex-col gap-1.5 relative overflow-hidden group hover:border-border-glass transition-colors">
          <div className="absolute top-0 left-0 w-1 h-full bg-green" />
          <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-green">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            Início
          </div>
          <div className="text-xs font-black text-text tabular-nums tracking-tight">
            {formatCoordinate(startPoint.latitude)}, {formatCoordinate(startPoint.longitude)}
          </div>
          {startPoint.elevation && (
            <div className="text-[0.65rem] font-bold text-muted uppercase tracking-widest opacity-60">
              Altitude: {startPoint.elevation.toFixed(0)}m
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-border-glass-subtle flex flex-col gap-1.5 relative overflow-hidden group hover:border-border-glass transition-colors">
          <div className="absolute top-0 left-0 w-1 h-full bg-red" />
          <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-red">
            <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
            Fim
          </div>
          <div className="text-xs font-black text-text tabular-nums tracking-tight">
            {formatCoordinate(endPoint.latitude)}, {formatCoordinate(endPoint.longitude)}
          </div>
          {endPoint.elevation && (
            <div className="text-[0.65rem] font-bold text-muted uppercase tracking-widest opacity-60">
              Altitude: {endPoint.elevation.toFixed(0)}m
            </div>
          )}
        </div>
      </div>

      {route.startedAt && route.endedAt && (
        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-surface border border-border-glass-subtle w-full text-[0.65rem] font-bold text-muted uppercase tracking-widest">
          <div className="flex justify-between items-center">
            <span>Hora de Início</span>
            <span className="text-text font-black tracking-tight normal-case font-mono">{route.startedAt.toLocaleString('pt-PT')}</span>
          </div>
          <div className="w-full h-[1px] bg-border-glass-subtle" />
          <div className="flex justify-between items-center">
            <span>Hora de Fim</span>
            <span className="text-text font-black tracking-tight normal-case font-mono">{route.endedAt.toLocaleString('pt-PT')}</span>
          </div>
        </div>
      )}
    </div>
  );
}