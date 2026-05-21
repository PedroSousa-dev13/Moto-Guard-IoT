import { Play, RotateCcw, Loader2, CheckCircle } from 'lucide-react';

interface ParsedGpxRoute {
  waypoints: Array<{
    latitude: number;
    longitude: number;
    elevation?: number;
    time?: Date;
  }>;
  distanceKm: number;
  totalTimeSec?: number;
  simulatorRoute?: {
    start: { latitude: number; longitude: number };
    end: { latitude: number; longitude: number };
    loop: boolean;
  };
}

interface RouteActionsComponentProps {
  route: ParsedGpxRoute | null;
  onSendToSimulator: () => void;
  onClearRoute: () => void;
  isSending: boolean;
  routeSent: boolean;
  disabled?: boolean;
}

export default function RouteActionsComponent({
  route,
  onSendToSimulator,
  onClearRoute,
  isSending,
  routeSent,
  disabled = false
}: RouteActionsComponentProps) {
  if (!route) return null;

  const canSendToSimulator = route.waypoints && route.waypoints.length >= 2;

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex gap-3">
        <button 
          className="flex-1 py-3 rounded-2xl bg-panel border border-border-glass-subtle text-[0.65rem] font-black uppercase tracking-widest text-muted hover:text-text transition-all duration-300 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-30 disabled:pointer-events-none" 
          onClick={onClearRoute}
          disabled={disabled || isSending}
          title="Limpar rota carregada"
        >
          <RotateCcw size={12} /> 
          Limpar
        </button>
        
        <button
          className={`flex-[2] py-3 rounded-2xl text-[0.65rem] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 shadow-xl ${
            routeSent
              ? "bg-green/10 text-green border border-green/20"
              : "bg-accent text-white shadow-accent/20 hover:scale-[1.02] hover:bg-accent-strong active:scale-[0.98]"
          } disabled:opacity-30 disabled:pointer-events-none`}
          onClick={onSendToSimulator}
          disabled={disabled || isSending || !canSendToSimulator}
          title={
            !canSendToSimulator 
              ? "A rota deve ter pelo menos 2 pontos" 
              : routeSent 
                ? "Rota enviada com sucesso" 
                : "Enviar rota para o simulador"
          }
        >
          {isSending ? (
            <>
              <Loader2 size={12} className="animate-spin" /> 
              A enviar...
            </>
          ) : routeSent ? (
            <>
              <CheckCircle size={12} /> 
              Enviada ✓
            </>
          ) : (
            <>
              <Play size={12} /> 
              Usar Rota
            </>
          )}
        </button>
      </div>

      {!canSendToSimulator && route.waypoints && (
        <div className="p-4 rounded-2xl bg-yellow/10 border border-yellow/20 text-yellow text-[0.75rem] font-bold animate-fade-in flex flex-col gap-1">
          <span>A rota deve conter pelo menos 2 pontos para ser enviada ao simulador.</span>
          <span className="opacity-60 text-[0.65rem] font-medium uppercase tracking-wider">Pontos atuais: {route.waypoints.length}</span>
        </div>
      )}

      {routeSent && (
        <div className="p-4 rounded-2xl bg-green/10 border border-green/20 text-green text-[0.75rem] font-bold animate-pulse">
          Rota enviada com sucesso! A redirecionar para o simulador...
        </div>
      )}
    </div>
  );
}